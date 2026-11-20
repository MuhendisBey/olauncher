import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const BINARY_EXTS = new Set(['.png', '.jpg', '.jpeg', '.ttf', '.woff2', '.ico', '.wgt', '.gif', '.webp']);

const FORBIDDEN_FILE_RULES = [
  { name: 'local config.json', rx: /^launcher\/config\.json$/ },
  { name: 'personal family wallpaper', rx: new RegExp('^launcher/assets/wallpapers/' + 'fam' + 'ily\\.') },
  { name: 'local TV baseline JSON', rx: /^home-baseline.*\.json$/ },
  { name: 'Tizen signing certificate (.p12)', rx: /\.p12$/i },
  { name: 'plaintext .env file', rx: /(^|\/)\.env(\.[^/]+)?$/ },
  { name: 'raw disassembly dump (.txt)', rx: /^docs\/disassembly\/.*\.txt$/ },
  { name: 'private SDB remote ctl', rx: new RegExp('^tools/' + 'olauncher_' + 'remote_ctl\\.py$') },
  { name: 'private TV query tool', rx: new RegExp('^tools/' + 'tv_' + 'query\\.py$') },
  { name: 'dist build output', rx: /^dist\// }
];

const CONTENT_PATTERNS = [
  { label: 'google_api_key', rx: new RegExp('AIza' + 'Sy') },
  { label: 'github_pat', rx: new RegExp('ghp' + '_') },
  { label: 'github_oauth', rx: new RegExp('gho' + '_') },
  { label: 'jwt_header', rx: new RegExp('eyJ' + 'hbGci') },
  { label: 'sk_key_prefix', rx: new RegExp('\\bsk' + '-[A-Za-z0-9]{6,}') },
  { label: 'private_key_pem', rx: new RegExp('BEGIN [A-Z ]*' + 'PRIVATE KEY') },
  { label: 'lan_192_168', rx: /\b192\.168\.\d{1,3}\.\d{1,3}\b/ },
  { label: 'lan_10_x', rx: /(?<![\d.])10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/ },
  { label: 'lan_172_16_31', rx: /(?<![\d.])172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/ },
  { label: 'age_pubkey', rx: /\bage1[a-z0-9]{20,}\b/ },
  { label: 'macos_user_path', rx: new RegExp('/' + 'Users/') },
  { label: 'workstation_username', rx: new RegExp('\\b' + 'kag' + 'eja' + '\\b', 'i') },
  { label: 'personal_climate_entity', rx: new RegExp('climate\\.zone_circuit_' + 'oturma_odasi_oturma_odasi') },
  { label: 'personal_media_entity', rx: new RegExp('media_player\\.' + 'oturma_odasi_tv') },
  { label: 'tv_wifi_mac', rx: new RegExp('A0:D0:' + '5B:42:5C:86', 'i') }
];

function getTrackedFiles() {
  const out = execSync('git ls-files -z', { cwd: rootDir });
  return out
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

function main() {
  const tracked = getTrackedFiles();
  if (tracked.length === 0) {
    console.error('❌ FAIL: git ls-files returned 0 tracked files. Initialize/stage git files first.');
    process.exit(1);
  }

  const fileHits = [];
  const contentHits = [];

  for (const rel of tracked) {
    if (rel === '.env.example') continue;

    for (const rule of FORBIDDEN_FILE_RULES) {
      if (rule.rx.test(rel)) {
        fileHits.push({ rel, rule: rule.name });
      }
    }

    const ext = path.extname(rel).toLowerCase();
    if (BINARY_EXTS.has(ext)) continue;

    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;

    const text = fs.readFileSync(abs, 'utf8');
    for (const pat of CONTENT_PATTERNS) {
      if (pat.rx.test(text)) {
        contentHits.push({ rel, label: pat.label });
      }
    }
  }

  if (fileHits.length > 0 || contentHits.length > 0) {
    console.error('\n❌ Secret & Privacy Hygiene Audit FAILED:');
    for (const h of fileHits) {
      console.error(`  - Forbidden tracked file [${h.rule}]: ${h.rel}`);
    }
    for (const h of contentHits) {
      console.error(`  - Forbidden content [${h.label}]: ${h.rel}`);
    }
    process.exit(1);
  }

  console.log(`✅ Hygiene PASSED (${tracked.length} tracked files scanned, 0 leaks or forbidden artifacts).`);
}

main();
