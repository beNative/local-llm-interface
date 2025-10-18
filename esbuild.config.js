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
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="default-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#64748b" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#default-grad)" />
  <g fill="#f8fafc" transform="translate(28,28)">
    <path d="M72 12v48a12 12 0 0 1-12 12H12a12 12 0 0 1-12-12V24A12 12 0 0 1 12 12h48l12-12z" opacity="0.8" />
    <circle cx="36" cy="36" r="14" opacity="0.9" />
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