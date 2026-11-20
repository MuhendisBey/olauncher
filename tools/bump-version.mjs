import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const type = (process.argv[2] || 'minor').toLowerCase();

const pkgPath = path.join(rootDir, 'package.json');
const xmlPath = path.join(rootDir, 'launcher', 'config.xml');
const versionJsPath = path.join(rootDir, 'launcher', 'js', 'core', 'Version.js');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version;
const parts = currentVersion.split('.').map(Number);

if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`[VERSION] Invalid current version format: ${currentVersion}`);
  process.exit(1);
}

let [major, minor, patch] = parts;

if (type === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (type === 'minor') {
  minor += 1;
  patch = 0;
} else if (type === 'patch') {
  patch += 1;
} else {
  console.error(`[VERSION] Unknown bump type: "${type}". Use "major", "minor", or "patch".`);
  process.exit(1);
}

const newVersion = `${major}.${minor}.${patch}`;
console.log(`[VERSION] Bumping version: ${currentVersion} -> ${newVersion} (${type.toUpperCase()})`);

// 1. Update package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// 2. Update launcher/config.xml
let xml = fs.readFileSync(xmlPath, 'utf8');
xml = xml.replace(/version="[0-9]+\.[0-9]+\.[0-9]+"/, `version="${newVersion}"`);
fs.writeFileSync(xmlPath, xml, 'utf8');

// 3. Update launcher/js/core/Version.js
let versionJs = fs.readFileSync(versionJsPath, 'utf8');
versionJs = versionJs.replace(/export const APP_VERSION = '[0-9]+\.[0-9]+\.[0-9]+';/, `export const APP_VERSION = '${newVersion}';`);
fs.writeFileSync(versionJsPath, versionJs, 'utf8');

console.log(`[VERSION] Successfully synchronized all files to v${newVersion}:`);
console.log(`  - package.json -> ${newVersion}`);
console.log(`  - launcher/config.xml -> ${newVersion}`);
console.log(`  - launcher/js/core/Version.js -> ${newVersion}`);
