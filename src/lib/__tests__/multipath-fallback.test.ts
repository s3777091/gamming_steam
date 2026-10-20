import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function moduleWithoutNative() {
  const source = readFileSync(new URL('../../../modules/jetsona-multipath/index.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, (...args: unknown[]) => any> = {};
  runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      if (name === './src/JetsonaMultipath.types') return {};
      assert.equal(name, './src/JetsonaMultipathModule');
      return { __esModule: true, default: null };
    },
  });
  return exports;
}

test('iOS and missing native builds never advertise fabricated Wi-Fi networks or a successful connection', () => {
  const api = moduleWithoutNative();
  assert.equal(api.hasNativeMultipath, false);
  assert.equal(api.getNetworkCapabilities().isDualWifiSupported, false);
  assert.equal(api.getNetworkCapabilities().hasCellular, false);
  assert.equal(api.getNetworkCapabilities().primaryWifi.ssid, undefined);
  assert.equal(api.getAvailableWifiNetworks().length, 0);
  assert.equal(api.connectSecondaryWifi('test-network', 'test-password'), false);
  assert.equal(api.enableCellularFallback(), false);
  assert.equal(api.getCurrentMultipathStatus().isMultipathActive, false);
  assert.equal(api.getCurrentMultipathStatus().secondary.status, 'unavailable');
  const remove = api.addMultipathListener('onMultipathStatusChanged', () => assert.fail('no native events'));
  remove();
});
