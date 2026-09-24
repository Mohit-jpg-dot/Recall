import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

async function buildExtension() {
  console.log('[Recall] Building extension bundles...');

  const distDir = resolve(rootDir, 'dist');
  fs.mkdirSync(distDir, { recursive: true });

  // 1. Build service worker (self-contained, no external chunks)
  await build({
    configFile: false,
    build: {
      outDir: distDir,
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(rootDir, 'src/service-worker.ts'),
        output: {
          entryFileNames: 'service-worker.js',
          format: 'es',
          inlineDynamicImports: true,
        },
      },
      minify: false,
    },
  });

  // 2. Build popup script (self-contained, no external chunks)
  await build({
    configFile: false,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      rollupOptions: {
        input: resolve(rootDir, 'src/popup/popup.ts'),
        output: {
          entryFileNames: 'popup/popup.js',
          format: 'es',
          inlineDynamicImports: true,
        },
      },
      minify: false,
    },
  });

  // 3. Copy popup HTML & CSS to dist/popup
  const distPopupDir = resolve(distDir, 'popup');
  fs.mkdirSync(distPopupDir, { recursive: true });
  fs.copyFileSync(resolve(rootDir, 'src/popup/popup.html'), resolve(distPopupDir, 'popup.html'));
  fs.copyFileSync(resolve(rootDir, 'src/popup/popup.css'), resolve(distPopupDir, 'popup.css'));

  // 4. Copy icons to dist/icons
  const distIconsDir = resolve(distDir, 'icons');
  fs.mkdirSync(distIconsDir, { recursive: true });
  fs.cpSync(resolve(rootDir, 'icons'), distIconsDir, { recursive: true });

  // 5. Copy base manifest to dist/manifest.json
  fs.copyFileSync(resolve(rootDir, 'manifest.json'), resolve(distDir, 'manifest.json'));

  // 6. Assemble standalone browser-specific distributions
  const targets = [
    { name: 'chrome', manifest: 'manifest.json' },
    { name: 'firefox', manifest: 'manifest.firefox.json' },
    { name: 'safari', manifest: 'manifest.safari.json' },
  ];

  for (const target of targets) {
    const targetDir = resolve(distDir, target.name);
    fs.mkdirSync(targetDir, { recursive: true });

    // Manifest
    fs.copyFileSync(resolve(rootDir, target.manifest), resolve(targetDir, 'manifest.json'));

    // Service worker
    fs.copyFileSync(resolve(distDir, 'service-worker.js'), resolve(targetDir, 'service-worker.js'));

    // Popup directory
    const targetPopupDir = resolve(targetDir, 'popup');
    fs.mkdirSync(targetPopupDir, { recursive: true });
    fs.cpSync(distPopupDir, targetPopupDir, { recursive: true });

    // Icons directory
    const targetIconsDir = resolve(targetDir, 'icons');
    fs.mkdirSync(targetIconsDir, { recursive: true });
    fs.cpSync(resolve(rootDir, 'icons'), targetIconsDir, { recursive: true });

    // Chunks (if any were produced)
    const distChunksDir = resolve(distDir, 'chunks');
    if (fs.existsSync(distChunksDir)) {
      fs.cpSync(distChunksDir, resolve(targetDir, 'chunks'), { recursive: true });
    }
  }

  console.log('[Recall] ✅ Extension build succeeded for Chrome, Firefox, and Safari!');
}

buildExtension().catch((err) => {
  console.error('[Recall] ❌ Build failed:', err);
  process.exit(1);
});
