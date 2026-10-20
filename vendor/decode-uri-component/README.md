# CommonJS build of decode-uri-component 0.5.0

Source: https://github.com/SamVerschueren/decode-uri-component/blob/v0.5.0/index.js

The upstream 0.5.0 release fixes GHSA-vcc3-ghjq-m6fr using bounded UTF-8 scanning.
Expo Router SDK 57 requires query-string 7's CommonJS, named-export API. Simply
overriding its decoder to upstream's ESM package breaks that require call.

This copy preserves upstream's implementation, changing only
`export default function` to `module.exports = function` for CommonJS consumers.
The MIT license is retained. Remove this compatibility distribution when the
SDK's query-string dependency includes the patched decoder itself.

The app declares this directory as a direct file dependency and references that
dependency from its npm override. This keeps the lockfile link rooted at
`vendor/decode-uri-component` on clean EAS installs, rather than resolving the
relative override inside `node_modules/query-string`.
