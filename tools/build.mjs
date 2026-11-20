import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SRC_DIR = path.resolve(rootDir, 'launcher');
const DIST_DIR = path.resolve(rootDir, 'dist');
const WGT_DIR = path.resolve(DIST_DIR, 'wgt');

async function build() {
  console.log('[BUILD] Starting OLauncher WGT packaging build...');

  // Clean dist directory
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(WGT_DIR, { recursive: true });
  fs.mkdirSync(path.join(WGT_DIR, 'js'), { recursive: true });

  // 1. Bundle JavaScript with esbuild into single IIFE file for Tizen file:// protocol compatibility
  console.log('[BUILD] Bundling ES modules into dist/wgt/js/bundle.js (target: chrome85 / ES2020)...');
  await esbuild.build({
    entryPoints: [path.join(SRC_DIR, 'js', 'main.js')],
    bundle: true,
    outfile: path.join(WGT_DIR, 'js', 'bundle.js'),
    format: 'iife',
    target: ['chrome85', 'es2020'],
    minify: false,
    sourcemap: false
  });

  // 2. Copy and adapt index.html
  console.log('[BUILD] Adapting index.html for bundled script...');
  const indexHtml = fs.readFileSync(path.join(SRC_DIR, 'index.html'), 'utf8');
  const bundledHtml = indexHtml.replace(
    '<script type="module" src="js/main.js"></script>',
    '<script src="js/bundle.js"></script>'
  );
  fs.writeFileSync(path.join(WGT_DIR, 'index.html'), bundledHtml, 'utf8');

  // 3. Copy CSS, Assets, Manifest and Config
  function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      fs.readdirSync(src).forEach((child) => {
        copyRecursive(path.join(src, child), path.join(dest, child));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  console.log('[BUILD] Copying CSS, fonts, wallpapers, config and manifest...');
  copyRecursive(path.join(SRC_DIR, 'css'), path.join(WGT_DIR, 'css'));
  copyRecursive(path.join(SRC_DIR, 'assets'), path.join(WGT_DIR, 'assets'));
  copyRecursive(path.join(SRC_DIR, 'config.xml'), path.join(WGT_DIR, 'config.xml'));
  copyRecursive(path.join(SRC_DIR, 'icon.png'), path.join(WGT_DIR, 'icon.png'));

  const localConfigPath = path.join(SRC_DIR, 'config.json');
  const exampleConfigPath = path.join(SRC_DIR, 'config.example.json');
  if (fs.existsSync(localConfigPath)) {
    copyRecursive(localConfigPath, path.join(WGT_DIR, 'config.json'));
  } else if (fs.existsSync(exampleConfigPath)) {
    console.log('[BUILD] launcher/config.json not found; bundling config.example.json as config.json');
    copyRecursive(exampleConfigPath, path.join(WGT_DIR, 'config.json'));
  }

  console.log('[BUILD] Build complete! Artifact directory: dist/wgt');
}

build().catch((err) => {
  console.error('[BUILD] Fatal error:', err);
  process.exit(1);
});
