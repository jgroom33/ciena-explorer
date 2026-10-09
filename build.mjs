// Bundle the map into one self-contained HTML page (three.js from jsDelivr).
//   node build.mjs  ->  dist/netlandia.html
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

// --local points at the vendored copy instead, for checking the bundle offline.
const local = process.argv.includes('--local');
const THREE_URL = local ? '../vendor/three.module.min.js' : 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const ORBIT_URL = local ? '../vendor/OrbitControls.js' : 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// Local modules, dependencies first. Their own imports of each other are dropped
// and `export` keywords stripped, so they share one module scope.
const modules = ['js/world.js', 'js/scene.js', 'js/detail.js', 'js/tech.js', 'js/basics.js', 'js/vocab.js', 'js/main.js'].map((p) => read(p)
  .replace(/^import [^;]*? from '\.\/[^']+';\n/gm, '')
  .replace(/^export (const|function|let)/gm, '$1'));
const threeImports = new Set();
const body = modules.map((m) => m.replace(/^import .* from 'three(\/addons\/[^']+)?';\n/gm, (line) => { threeImports.add(line.trim()); return ''; }));

// The modules now share one scope, so two top-level names that collide would only
// fail in the browser. Parse the joined script here and stop the build instead.
const joined = [...threeImports].join('\n') + '\n' + body.join('\n');
const probe = join(mkdtempSync(join(tmpdir(), 'netlandia-')), 'bundle.mjs');
writeFileSync(probe, joined);
try {
  execFileSync(process.execPath, ['--check', probe], { stdio: 'pipe' });
} catch (e) {
  console.error('Bundled script does not parse (a top-level name used in two modules?):\n' + e.stderr);
  process.exit(1);
}

const html = read('index.html');
const hud = html.slice(html.indexOf('<!--HUD-->'), html.indexOf('<!--/HUD-->') + '<!--/HUD-->'.length);
const title = html.match(/<title>.*<\/title>/)[0];
// The favicon rides inside the single file as a data URI, when one is in the repo.
const favicon = (() => {
  for (const [f, type] of [['favicon.svg', 'image/svg+xml'], ['favicon.ico', 'image/x-icon'], ['favicon.png', 'image/png']]) {
    try { return `<link rel="icon" type="${type}" href="data:${type};base64,${readFileSync(join(here, f)).toString('base64')}">`; } catch {}
  }
  return '';
})();
const fonts = html.match(/<link rel="preconnect"[^>]*>\n<link rel="stylesheet" href="https:\/\/fonts[^>]*>/)[0];

const out = `<meta charset="utf-8">
${title}
${favicon}
${fonts}
<style>
${read('css/net.css')}
</style>
<script type="importmap">
{ "imports": { "three": "${THREE_URL}", "three/addons/OrbitControls.js": "${ORBIT_URL}" } }
</script>
${hud}
<script type="module">
${[...threeImports].join('\n')}
${body.join('\n')}
</script>
`;

mkdirSync(join(here, 'dist'), { recursive: true });
const name = local ? 'dist/netlandia.local.html' : 'dist/netlandia.html';
writeFileSync(join(here, name), out);
console.log(`${name}  ${(out.length / 1024).toFixed(1)} KB`);
