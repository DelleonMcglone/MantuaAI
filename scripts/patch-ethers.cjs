const fs = require('fs');
const path = require('path');

const ethersDir = path.join(__dirname, '..', 'node_modules', 'ethers');
const pkgPath = path.join(ethersDir, 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.log('[patch-ethers] ethers not installed, skipping');
  process.exit(0);
}

const shimMjs = `import { isAddress, AbiCoder } from 'ethers';
const defaultAbiCoder = AbiCoder.defaultAbiCoder();
export { isAddress, defaultAbiCoder };
`;

const shimCjs = `const { isAddress, AbiCoder } = require('ethers');
const defaultAbiCoder = AbiCoder.defaultAbiCoder();
module.exports = { isAddress, defaultAbiCoder };
`;

fs.writeFileSync(path.join(ethersDir, 'ethers-v5-utils-shim.mjs'), shimMjs);
fs.writeFileSync(path.join(ethersDir, 'ethers-v5-utils-shim.cjs'), shimCjs);

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (!pkg.exports['./lib/utils']) {
  pkg.exports['./lib/utils'] = {
    'import': './ethers-v5-utils-shim.mjs',
    'default': './ethers-v5-utils-shim.cjs'
  };
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.log('[patch-ethers] Added ./lib/utils export shim for v5 compat');
} else {
  console.log('[patch-ethers] ./lib/utils export already present');
}
