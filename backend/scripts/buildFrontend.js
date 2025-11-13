/**
 * Enhanced ESBuild Frontend Bundler
 * - Minification and tree-shaking for production
 * - Content hashing for cache busting
 * - Asset manifest generation
 * - Environment-aware builds
 */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const entryDir = path.join(__dirname, '..', '..', 'frontend', 'src', 'js');
const outDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
const isProd = process.env.NODE_ENV === 'production';

// Create output directory
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Discover entry points
const entries = fs.readdirSync(entryDir)
  .filter(f => f.endsWith('.js'))
  .map(f => path.join(entryDir, f));

console.log(`[Build] Mode: ${isProd ? 'production' : 'development'}`);
console.log(`[Build] Found ${entries.length} entry points`);

// Build with ESBuild
esbuild.build({
  entryPoints: entries,
  outdir: outDir,
  bundle: true,
  splitting: true,
  format: 'esm',
  sourcemap: !isProd,
  minify: isProd,
  treeShaking: true,
  target: 'es2020',
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'info',
  metafile: true, // Generate metadata for analysis
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
  },
}).then((result) => {
  console.log('[Build] Bundle complete');
  
  // Generate asset manifest for production (maps original -> hashed filenames)
  if (isProd && result.metafile) {
    const manifest = {};
    const outputs = result.metafile.outputs;
    
    // Generate content hashes and create manifest
    for (const [outPath, info] of Object.entries(outputs)) {
      if (outPath.endsWith('.js')) {
        const relPath = path.relative(outDir, outPath);
        const content = fs.readFileSync(outPath);
        const hash = crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
        
        // Create hashed filename
        const parsed = path.parse(relPath);
        const hashedName = `${parsed.name}.${hash}${parsed.ext}`;
        const hashedPath = path.join(outDir, hashedName);
        
        // Copy to hashed filename
        fs.copyFileSync(outPath, hashedPath);
        
        // Add to manifest
        manifest[relPath] = hashedName;
        
        console.log(`[Build] ${relPath} -> ${hashedName}`);
      }
    }
    
    // Write manifest file
    const manifestPath = path.join(outDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[Build] Manifest written to ${manifestPath}`);
  }
  
  // Generate build stats
  if (result.metafile) {
    const statsPath = path.join(outDir, 'build-stats.json');
    fs.writeFileSync(statsPath, JSON.stringify(result.metafile, null, 2));
    console.log(`[Build] Stats written to ${statsPath}`);
  }
  
  console.log('[Build] ✓ Frontend build complete');
}).catch((error) => {
  console.error('[Build] ✗ Build failed:', error);
  process.exit(1);
});

