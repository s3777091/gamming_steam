import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('migration success requires a PostgreSQL receipt, not merely a successful SSH exit', { skip: process.platform !== 'win32' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'mapping-migration-test-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'supabase', 'migrations'), { recursive: true });
    const source = readFileSync(new URL('../../../scripts/apply-key-mapping-migration.ps1', import.meta.url), 'utf8');
    const nativeSsh = "$sshPath = Join-Path $env:WINDIR 'System32\\OpenSSH\\ssh.exe'";
    assert.ok(source.includes(nativeSsh), 'The SSH boundary must be replaced before running the test');
    const script = join(root, 'scripts', 'apply.ps1');
    writeFileSync(script, source.replace(nativeSsh, "$sshPath = Join-Path $PSScriptRoot '..\\ssh.ps1'"));
    writeFileSync(join(root, 'supabase', 'migrations', '202610220001_key_mapping_profiles.sql'), readFileSync(new URL('../../../supabase/migrations/202610220001_key_mapping_profiles.sql', import.meta.url)));
    const key = join(root, 'test-key');
    writeFileSync(key, 'Test fixture only; no real credentials or network connection.');
    writeFileSync(join(root, 'ssh.ps1'), `
$sql = $input -join "\n"
if ($args -notcontains 'StrictHostKeyChecking=yes') { throw 'Strict host key checking is missing' }
if (-not $sql.Contains('do $$')) { throw 'SQL dollar quotes were corrupted' }
if ($sql -notmatch "(?s)do \\$\\$.*commit;\\s*select '(KEY_MAPPING_MIGRATION_VERIFIED_[0-9a-f]{32})';\\s*$") { throw 'Receipt must follow verification and COMMIT' }
$receipt = $Matches[1]
$global:LASTEXITCODE = 0
switch ($env:KEY_MAPPING_SSH_TEST) {
  'tunnel' { 'tunnel-only' }
  'empty' { }
  'wrong' { 'KEY_MAPPING_MIGRATION_VERIFIED_wrong' }
  'success' { $receipt }
  'failed' { $receipt; $global:LASTEXITCODE = 17 }
  default { throw 'Unknown SSH test mode' }
}
`);
    for (const [mode, diagnostic] of [
      ['tunnel', /only permits tunnels/],
      ['empty', /expected verification receipt/],
      ['wrong', /expected verification receipt/],
      ['failed', /exit code 17/],
      ['success', /Mapping database setup verified/],
    ] as const) {
      const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-KeyPath', key, '-KnownHostsPath', key], {
        encoding: 'utf8', env: { ...process.env, KEY_MAPPING_SSH_TEST: mode }, timeout: 15_000, windowsHide: true,
      });
      assert.ifError(result.error);
      const output = result.stdout + result.stderr;
      assert.equal(result.status, mode === 'success' ? 0 : 1, `${mode}: ${output}`);
      assert.match(output, diagnostic, mode);
      if (mode !== 'success') assert.doesNotMatch(output, /Mapping database setup verified/, mode);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
