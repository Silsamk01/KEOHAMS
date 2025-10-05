// Simple esbuild bundler for frontend JS (can be expanded for CSS via plugins)
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const entryDir = path.join(__dirname, '..', '..', 'frontend', 'src', 'js');
const outDir = path.join(__dirname, '..', '..', 'frontend', 'dist');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Discover top-level entry points (you might refine this list)
const entries = fs.readdirSync(entryDir).filter(f => f.endsWith('.js')).map(f => path.join(entryDir, f));

esbuild.build({
  entryPoints: entries,
  outdir: outDir,
  bundle: true,
  splitting: true,
  format: 'esm',
  sourcemap: process.env.NODE_ENV !== 'production',
  minify: process.env.NODE_ENV === 'production',
  target: 'es2019'
}).then(() => {
  console.log('Frontend build complete');
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
