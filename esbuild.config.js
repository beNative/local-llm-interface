const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');

const isProduction = process.argv.includes('--production');

// Source and output directories
const appDir = __dirname;
const outDir = path.join(__dirname, 'dist');

async function build() {
  // Clean the output directory
  await fs.emptyDir(outDir);

  // Copy index.html to the output directory
  await fs.copy(path.join(appDir, 'index.html'), path.join(outDir, 'index.html'));

  // Build main process
  await esbuild.build({
    entryPoints: [path.join(appDir, 'electron/main.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18', // Corresponds to Electron 28+
    outfile: path.join(outDir, 'main.js'),
    external: ['electron'], // Exclude electron from the bundle
    minify: isProduction,
    sourcemap: !isProduction,
  });

  // Build preload script
  await esbuild.build({
    entryPoints: [path.join(appDir, 'electron/preload.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: path.join(outDir, 'preload.js'),
    external: ['electron'],
    minify: isProduction,
    sourcemap: !isProduction,
  });

  // Build renderer process
  await esbuild.build({
    entryPoints: [path.join(appDir, 'index.tsx')],
    bundle: true,
    platform: 'browser',
    target: 'chrome120', // Corresponds to Electron 28+
    outfile: path.join(outDir, 'renderer.js'),
    jsx: 'automatic',
    loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
    },
    minify: isProduction,
    sourcemap: !isProduction,
    define: {
      'process.env.NODE_ENV': isProduction ? '"production"' : '"development"',
    },
  });

  console.log('Build successful!');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
