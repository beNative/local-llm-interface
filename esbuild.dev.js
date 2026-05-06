/**
 * Development watch script for Local LLM Interface.
 *
 * Usage:  npm run dev
 *
 * This script runs three esbuild instances in watch mode (main, preload,
 * renderer) and then launches Electron. When any source file changes,
 * esbuild incrementally rebuilds the affected bundle and logs a message.
 *
 * NOTE: This does NOT provide HMR — you still need to reload the Electron
 * window (Ctrl+R / Cmd+R) to pick up renderer changes. For main-process
 * changes you must restart the app.
 */
const esbuild = require('esbuild');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const appDir = __dirname;
const outDir = path.join(__dirname, 'dist');

// Ensure dist exists and copy static assets once at startup
async function prepareDistDir() {
    await fs.ensureDir(outDir);

    // Copy index.html
    await fs.copy(path.join(appDir, 'index.html'), path.join(outDir, 'index.html'));

    // Copy docs
    const docFiles = ['README.md', 'FUNCTIONAL_MANUAL.md', 'TECHNICAL_MANUAL.md', 'CHANGELOG.md'];
    for (const file of docFiles) {
        const src = path.join(appDir, file);
        if (await fs.pathExists(src)) {
            await fs.copy(src, path.join(outDir, file));
        }
    }

    // Copy Pyodide assets if not already present
    const pyodideDest = path.join(outDir, 'pyodide');
    if (!(await fs.pathExists(pyodideDest))) {
        const pyodidePackagePath = path.dirname(require.resolve('pyodide/package.json'));
        await fs.copy(pyodidePackagePath, pyodideDest);
    }
}

function makeWatchPlugin(label) {
    return {
        name: `watch-${label}`,
        setup(build) {
            build.onEnd(result => {
                const timestamp = new Date().toLocaleTimeString();
                if (result.errors.length > 0) {
                    console.error(`[${timestamp}] ❌ ${label} build failed (${result.errors.length} error(s))`);
                } else {
                    console.log(`[${timestamp}] ✅ ${label} rebuilt`);
                }
            });
        },
    };
}

async function dev() {
    console.log('[dev] Preparing dist directory...');
    await prepareDistDir();

    console.log('[dev] Starting esbuild watchers...\n');

    // Main process watcher
    const mainCtx = await esbuild.context({
        entryPoints: [path.join(appDir, 'electron/main.ts')],
        bundle: true,
        platform: 'node',
        target: 'node18',
        outfile: path.join(outDir, 'main.js'),
        external: ['electron'],
        sourcemap: true,
        plugins: [makeWatchPlugin('main')],
    });

    // Preload script watcher
    const preloadCtx = await esbuild.context({
        entryPoints: [path.join(appDir, 'electron/preload.ts')],
        bundle: true,
        platform: 'node',
        target: 'node18',
        outfile: path.join(outDir, 'preload.js'),
        external: ['electron'],
        sourcemap: true,
        plugins: [makeWatchPlugin('preload')],
    });

    // Renderer process watcher
    const rendererCtx = await esbuild.context({
        entryPoints: [path.join(appDir, 'index.tsx')],
        bundle: true,
        platform: 'browser',
        target: 'chrome120',
        outfile: path.join(outDir, 'renderer.js'),
        jsx: 'automatic',
        loader: { '.tsx': 'tsx', '.ts': 'ts' },
        sourcemap: true,
        define: {
            'process.env.NODE_ENV': '"development"',
        },
        external: [],
        plugins: [makeWatchPlugin('renderer')],
    });

    // Start watching all three
    await Promise.all([
        mainCtx.watch(),
        preloadCtx.watch(),
        rendererCtx.watch(),
    ]);

    console.log('[dev] Watchers active. Launching Electron...\n');

    // Launch Electron
    const electronBin = require('electron');
    const child = spawn(electronBin, ['.'], {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'development' },
    });

    child.on('close', async (code) => {
        console.log(`\n[dev] Electron exited with code ${code}. Stopping watchers...`);
        await mainCtx.dispose();
        await preloadCtx.dispose();
        await rendererCtx.dispose();
        process.exit(code ?? 0);
    });

    // Forward termination signals
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => {
            child.kill(signal);
        });
    }
}

dev().catch((err) => {
    console.error('[dev] Failed to start:', err);
    process.exit(1);
});
