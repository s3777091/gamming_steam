<#
.SYNOPSIS
    Install the mobile button-mapping schema on the existing Supabase server.
.DESCRIPTION
    Use a server administration SSH key with shell access, not a tunnel key.
    Existing profiles are kept. Reapplying the migration is safe. SSH uses the
    server's existing pinned key. A database receipt is required for success.
.EXAMPLE
    .\scripts\apply-key-mapping-migration.ps1
#>
[CmdletBinding()]
param(
    [string]$Server = 'root@100.114.144.106',
    [string]$KeyPath,
    [string]$KnownHostsPath = 'C:\jetsona\keys\known_hosts',
    # This server's public address is the name already pinned in known_hosts.
    [string]$HostKeyAlias = '36.50.27.142'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $KeyPath) {
    $KeyPath = @(
        $env:JETSONA_VM_KEY,
        (Join-Path $env:USERPROFILE 'OneDrive\Documents\ssh\dathuynh'),
        (Join-Path $env:USERPROFILE 'OneDrive\Music\Documents\ssh\dathuynh'),
        (Join-Path $env:USERPROFILE '.ssh\dathuynh')
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
    if (-not $KeyPath) { throw 'No server administration SSH key found. Pass -KeyPath with an authorized shell-access key; tunnel keys cannot run database commands.' }
}
$migrationPath = Join-Path $PSScriptRoot '..\supabase\migrations\202610220001_key_mapping_profiles.sql'
$sshPath = Join-Path $env:WINDIR 'System32\OpenSSH\ssh.exe'
foreach ($requiredPath in @($migrationPath, $sshPath, $KeyPath, $KnownHostsPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Required file not found: $requiredPath"
    }
}
try {
    $keyStream = [System.IO.File]::OpenRead($KeyPath)
    $keyStream.Dispose()
} catch {
    throw 'Cannot read the server administration SSH key. Pass -KeyPath with an authorized readable key that has shell access.'
}

$sshArguments = @(
    '-i', $KeyPath,
    '-o', 'BatchMode=yes',
    '-o', 'IdentitiesOnly=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', "UserKnownHostsFile=$KnownHostsPath",
    '-o', "HostKeyAlias=$HostKeyAlias",
    '-o', 'ConnectTimeout=10',
    $Server
)
$remotePsql = 'docker exec -i supabase-db psql -X -A -t -v ON_ERROR_STOP=1 -U postgres -d postgres'
$verification = @'
do $$
begin
  if not exists (select 1 from pg_class where oid = 'public.key_mapping_profiles'::regclass and relrowsecurity) then
    raise exception 'Mapping table or row level security is missing';
  end if;
  if exists (select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE']) as p(privilege)
      where not has_table_privilege('authenticated', 'public.key_mapping_profiles', p.privilege)
         or has_table_privilege('anon', 'public.key_mapping_profiles', p.privilege)) then
    raise exception 'Mapping table permissions are incorrect';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'key_mapping_profiles'
      and policyname in ('key_mapping_profiles_select_self', 'key_mapping_profiles_insert_self', 'key_mapping_profiles_update_self', 'key_mapping_profiles_delete_self')) <> 4 then
    raise exception 'Mapping ownership policies are missing';
  end if;
  if not exists (select 1 from storage.buckets where id = 'key-mapping-screenshots' and not public
      and file_size_limit = 10485760 and allowed_mime_types @> array['image/png','image/jpeg','image/webp']) then
    raise exception 'Private mapping screenshot bucket is missing or misconfigured';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('key_mapping_screenshots_select_self', 'key_mapping_screenshots_insert_self', 'key_mapping_screenshots_delete_self')) <> 3 then
    raise exception 'Mapping screenshot ownership policies are missing';
  end if;
end;
$$;
'@

# Verify before COMMIT so a failed check rolls the migration back as well.
$migrationSql = [System.IO.File]::ReadAllText($migrationPath)
$commit = [regex]::Match($migrationSql, '(?i)commit;\s*$')
if (-not $commit.Success) { throw 'The migration must end with COMMIT.' }
# Concatenation preserves PL/pgSQL dollar quotes, which regex replacement expands.
$successMarker = 'KEY_MAPPING_MIGRATION_VERIFIED_' + [guid]::NewGuid().ToString('N')
# A forced SSH command can print "tunnel-only" and exit 0 without executing SQL.
# Require an exact, unique receipt from PostgreSQL after verification and COMMIT.
$sql = $migrationSql.Substring(0, $commit.Index) + $verification + "`ncommit;`nselect '$successMarker';`n"
$previousOutputEncoding = $OutputEncoding
try {
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    Write-Host 'Applying and verifying the button-mapping migration...'
    $remoteOutput = @($sql | & $sshPath @sshArguments $remotePsql)
    if ($LASTEXITCODE -ne 0) {
        throw "Migration failed (SSH/psql exit code $LASTEXITCODE). Check the error above; no success has been confirmed."
    }
    if ($remoteOutput -notcontains $successMarker) {
        if ($remoteOutput -contains 'tunnel-only') {
            throw 'The SSH key only permits tunnels; the database command did not run. Pass -KeyPath with a server administration key that has shell access.'
        }
        throw 'PostgreSQL did not return the expected verification receipt. The migration has not been confirmed.'
    }
} finally {
    $OutputEncoding = $previousOutputEncoding
}
Write-Host 'Mapping database setup verified. In the app, choose Tai lai profile (Reload profiles).'
