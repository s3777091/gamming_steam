import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.env.EAS_BUILD_PLATFORM && process.env.EAS_BUILD_PLATFORM !== 'ios') process.exit(0);
if (process.platform !== 'darwin') {
  console.log('iOS keyboard tests require the macOS Swift compiler; they run on EAS iOS builds.');
  process.exit(0);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(path.join(tmpdir(), 'jetsona-keyboard-'));
try {
  const binary = path.join(temporary, 'keyboard-tests');
  const compile = spawnSync('xcrun', ['swiftc',
    path.join(root, 'modules/jetsona-input/ios/KeyboardMap.swift'),
    path.join(root, 'scripts/ios-keyboard-tests/main.swift'), '-o', binary,
  ], { stdio: 'inherit' });
  if (compile.error) throw compile.error;
  if (compile.status !== 0) process.exitCode = 1;
  else {
    const test = spawnSync(binary, [], { stdio: 'inherit' });
    if (test.error) throw test.error;
    if (test.status !== 0) process.exitCode = 1;
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
