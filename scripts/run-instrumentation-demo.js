const path = require('path');
const fs = require('fs');
const os = require('os');
const { buildSync } = require('esbuild');

const workspaceRoot = path.resolve(__dirname, '..');
const tmpDir = path.join(os.tmpdir(), 'llm-instrumentation-demo');
const outputFile = path.join(tmpDir, 'instrumentation-demo.cjs');

if (typeof global.window === 'undefined') {
  global.window = {
    electronAPI: undefined,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

buildSync({
  entryPoints: [path.join(__dirname, 'run-instrumentation-demo.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: false,
  outfile: outputFile,
  external: ['electron'],
  absWorkingDir: workspaceRoot,
});

require(outputFile);
