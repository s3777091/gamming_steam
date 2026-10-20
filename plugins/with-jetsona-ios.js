const { withAppDelegate } = require('expo/config-plugins');

const MARKER = '// Jetsona Game Controller host';

function configureAppDelegate(source) {
  // SDK 57's generated module provider uses explicit internal imports. Swift 6
  // rejects mixing those with an implicit import in another app source file.
  source = source.replace(/^import JetsonaInput\s*$/gm, 'internal import JetsonaInput');
  if (source.includes(MARKER)) return source;
  const declaration = /class ReactNativeDelegate\s*:\s*ExpoReactNativeFactoryDelegate\s*\{/;
  if (!declaration.test(source) || /override func createRootViewController\(/.test(source)) {
    throw new Error('Jetsona iOS input: AppDelegate template changed; review the root controller integration.');
  }
  const withImport = source.includes('import JetsonaInput') ? source : `internal import JetsonaInput\n${source}`;
  return withImport.replace(declaration, (match) => `${match}
  ${MARKER}
  override func createRootViewController() -> UIViewController {
    return JetsonaInputViewController()
  }
`);
}

module.exports = function withJetsonaIos(config) {
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error('Jetsona iOS input requires the Expo SDK 57 Swift AppDelegate.');
    }
    mod.modResults.contents = configureAppDelegate(mod.modResults.contents);
    return mod;
  });
};

module.exports.configureAppDelegate = configureAppDelegate;
