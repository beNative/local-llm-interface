const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { appBuilderPath } = require('app-builder-bin');

const execFileAsync = promisify(execFile);

const isProduction = process.argv.includes('--production');

// Source and output directories
const appDir = __dirname;
const outDir = path.join(__dirname, 'dist');
const iconSourceDir = path.join(appDir, 'assets');
const iconOutputDir = path.join(appDir, 'build', 'icons');
const docFiles = ['README.md', 'FUNCTIONAL_MANUAL.md', 'TECHNICAL_MANUAL.md', 'CHANGELOG.md'];

const DEFAULT_ICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b0f19" />
      <stop offset="50%" stop-color="#111827" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8" />
      <stop offset="50%" stop-color="#818cf8" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#c084fc" stop-opacity="0.8" />
    </linearGradient>
    <linearGradient id="pathGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#818cf8" />
    </linearGradient>
    <linearGradient id="pathGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#c084fc" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>
    <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="60%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#a855f7" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />
  <rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="url(#borderGrad)" stroke-width="4" opacity="0.6" />
  <circle cx="256" cy="256" r="140" fill="url(#coreGrad)" opacity="0.35" />
  <g transform="translate(256, 256)">
    <polygon points="0,-160 138,-80 138,80 0,160 -138,80 -138,-80" fill="none" stroke="url(#pathGrad1)" stroke-width="4" opacity="0.4" stroke-dasharray="8 6" />
    <polygon points="0,-110 95,-55 95,55 0,110 -95,55 -95,-55" fill="none" stroke="url(#pathGrad2)" stroke-width="5" opacity="0.7" />
    <line x1="0" y1="-160" x2="0" y2="-55" stroke="url(#pathGrad1)" stroke-width="4" stroke-linecap="round" />
    <line x1="138" y1="-80" x2="50" y2="-28" stroke="url(#pathGrad1)" stroke-width="4" stroke-linecap="round" />
    <line x1="138" y1="80" x2="50" y2="28" stroke="url(#pathGrad2)" stroke-width="4" stroke-linecap="round" />
    <line x1="0" y1="160" x2="0" y2="55" stroke="url(#pathGrad2)" stroke-width="4" stroke-linecap="round" />
    <line x1="-138" y1="80" x2="-50" y2="28" stroke="url(#pathGrad1)" stroke-width="4" stroke-linecap="round" />
    <line x1="-138" y1="-80" x2="-50" y2="-28" stroke="url(#pathGrad2)" stroke-width="4" stroke-linecap="round" />
    <circle cx="0" cy="-160" r="12" fill="#38bdf8" />
    <circle cx="138" cy="-80" r="12" fill="#818cf8" />
    <circle cx="138" cy="80" r="12" fill="#c084fc" />
    <circle cx="0" cy="160" r="12" fill="#818cf8" />
    <circle cx="-138" cy="80" r="12" fill="#38bdf8" />
    <circle cx="-138" cy="-80" r="12" fill="#a855f7" />
    <circle cx="0" cy="0" r="46" fill="url(#bgGrad)" stroke="url(#pathGrad1)" stroke-width="6" />
    <circle cx="0" cy="0" r="30" fill="url(#coreGrad)" />
    <circle cx="0" cy="0" r="16" fill="#ffffff" opacity="0.9" />
  </g>
</svg>`;

async function collectSvgFiles(dir, results = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectSvgFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function findSvgIcon(baseDir) {
  if (!(await fs.pathExists(baseDir))) {
    return null;
  }
  const svgFiles = await collectSvgFiles(baseDir);
  if (svgFiles.length === 0) {
    return null;
  }
  svgFiles.sort((a, b) => {
    const aName = path.basename(a).toLowerCase();
    const bName = path.basename(b).toLowerCase();
    if (aName === 'icon.svg' && bName !== 'icon.svg') return -1;
    if (bName === 'icon.svg' && aName !== 'icon.svg') return 1;
    return a.localeCompare(b);
  });
  return svgFiles[0];
}

function isValidSvg(content) {
  if (typeof content !== 'string') return false;
  return /<svg[\s>]/i.test(content) && /<\/svg>/i.test(content);
}

async function renderSvgToPng(svgContent, size) {
  return sharp(Buffer.from(svgContent)).resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png().toBuffer();
}

async function generateNativeIcon(format, pngInputs, outputPath) {
  if (!(fs.existsSync(appBuilderPath))) {
    throw new Error(`app-builder binary not found at ${appBuilderPath}`);
  }

  const tempOutputPath = `${outputPath}.tmp`;
  await fs.remove(tempOutputPath);

  const args = ['icon'];
  for (const input of pngInputs) {
    args.push('--input', input);
  }
  args.push('--format', format, '--out', tempOutputPath);

  await execFileAsync(appBuilderPath, args);

  const stat = await fs.stat(tempOutputPath);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(tempOutputPath);
    const nativeFile = entries.find((entry) => entry.toLowerCase().endsWith(`.${format}`));
    if (!nativeFile) {
      throw new Error(`app-builder did not generate a .${format} file in ${tempOutputPath}`);
    }
    await fs.move(path.join(tempOutputPath, nativeFile), outputPath, { overwrite: true });
    await fs.remove(tempOutputPath);
  } else {
    await fs.move(tempOutputPath, outputPath, { overwrite: true });
  }
}

async function writePlatformIcons(svgContent, originDescription) {
  await fs.ensureDir(iconOutputDir);
  await fs.emptyDir(iconOutputDir);

  const basePng = await renderSvgToPng(svgContent, 1024);
  await fs.writeFile(path.join(iconOutputDir, 'icon-1024.png'), basePng);

  const png512 = await sharp(basePng).resize(512, 512).png().toBuffer();
  await fs.writeFile(path.join(iconOutputDir, 'icon.png'), png512);
  await fs.writeFile(path.join(iconOutputDir, 'icon-512.png'), png512);

  const png256 = await sharp(basePng).resize(256, 256).png().toBuffer();
  await fs.writeFile(path.join(iconOutputDir, 'icon-256.png'), png256);

  const iconVariants = {
    128: await sharp(basePng).resize(128, 128).png().toBuffer(),
    64: await sharp(basePng).resize(64, 64).png().toBuffer(),
    48: await sharp(basePng).resize(48, 48).png().toBuffer(),
    32: await sharp(basePng).resize(32, 32).png().toBuffer(),
    24: await sharp(basePng).resize(24, 24).png().toBuffer(),
    16: await sharp(basePng).resize(16, 16).png().toBuffer(),
  };

  for (const [size, buffer] of Object.entries(iconVariants)) {
    await fs.writeFile(path.join(iconOutputDir, `icon-${size}.png`), buffer);
  }

  const pngInputs = [
    path.join(iconOutputDir, 'icon-1024.png'),
    path.join(iconOutputDir, 'icon-512.png'),
    path.join(iconOutputDir, 'icon-256.png'),
  ];

  await generateNativeIcon('icns', pngInputs, path.join(iconOutputDir, 'icon.icns'));

  const icoBuffer = await pngToIco([
    png256,
    iconVariants[128],
    iconVariants[64],
    iconVariants[48],
    iconVariants[32],
    iconVariants[24],
    iconVariants[16],
  ]);
  await fs.writeFile(path.join(iconOutputDir, 'icon.ico'), icoBuffer);

  console.log(`[icon] Generated platform icons from ${originDescription}.`);
}

async function ensurePlatformIcons() {
  let svgContent = DEFAULT_ICON_SVG;
  let originDescription = 'built-in fallback icon';
  let usingFallback = true;

  try {
    const svgPath = await findSvgIcon(iconSourceDir);
    if (svgPath) {
      const content = await fs.readFile(svgPath, 'utf8');
      if (!isValidSvg(content)) {
        throw new Error(`Invalid SVG structure detected at ${path.relative(appDir, svgPath)}`);
      }
      svgContent = content;
      originDescription = path.relative(appDir, svgPath);
      usingFallback = false;
    } else {
      console.warn('[icon] No SVG icon found in the assets directory; using fallback icon.');
    }
  } catch (error) {
    console.warn(`[icon] ${error.message}. Falling back to the default icon.`);
  }

  try {
    await writePlatformIcons(svgContent, originDescription);
  } catch (error) {
    if (!usingFallback) {
      console.error(`[icon] Failed to generate icons from ${originDescription}: ${error.message}. Falling back to default icon.`);
      try {
        await writePlatformIcons(DEFAULT_ICON_SVG, 'built-in fallback icon');
      } catch (fallbackError) {
        console.error(`[icon] Failed to generate fallback icon set: ${fallbackError.message}`);
      }
    } else {
      console.error(`[icon] Failed to generate icons from fallback SVG: ${error.message}`);
    }
  }
}

async function build() {
  // Clean the output directory
  await fs.emptyDir(outDir);

  // Ensure platform-specific icons are generated from the SVG source.
  await ensurePlatformIcons();

  // Copy index.html and documentation to the output directory
  await fs.copy(path.join(appDir, 'index.html'), path.join(outDir, 'index.html'));
  for (const file of docFiles) {
    await fs.copy(path.join(appDir, file), path.join(outDir, file));
  }


  // Copy Pyodide assets
  const pyodidePackagePath = path.dirname(require.resolve('pyodide/package.json'));
  await fs.copy(pyodidePackagePath, path.join(outDir, 'pyodide'));

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
    external: [],
  });

  console.log('Build successful!');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});