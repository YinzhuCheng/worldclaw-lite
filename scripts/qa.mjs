import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const failures = [];
const checks = [];

function assert(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

const [html, css, main, world, worldMethods, config, packageJson, vercel] = await Promise.all([
  read('index.html'),
  read('styles.css'),
  read('src/main.js'),
  read('src/world.js'),
  Promise.all([1, 2, 3, 4, 5].map((index) => read(`src/world-methods-${index}.js`))).then((parts) => parts.join('\n')),
  read('src/config.js'),
  read('package.json').then(JSON.parse),
  read('vercel.json').then(JSON.parse),
]);

const requiredIds = [
  'game', 'start-screen', 'world-form', 'prompt-input', 'seed-input', 'quality-select',
  'enter-button', 'hud', 'objective-title', 'health-fill', 'stamina-fill', 'minimap',
  'interaction', 'pause-screen', 'world-map', 'complete-screen', 'info-modal',
];
requiredIds.forEach((id) => assert(`DOM id #${id}`, html.includes(`id="${id}"`)));

assert('Three.js import map pinned', html.includes('three@0.184.0'));
assert('ES module entrypoint', html.includes('type="module" src="./src/main.js"'));
assert('Responsive stylesheet', css.includes('@media (max-width: 700px)'));
assert('Procedural world plan', main.includes('createWorldPlan'));
assert('World supports relays', worldMethods.includes('_createRelays'));
assert('World supports shards', worldMethods.includes('_createShards'));
assert('World supports enemies', worldMethods.includes('_createEnemies'));
assert('World supports combat raycast', worldMethods.includes('shoot(origin, direction)'));
assert('CC0 assets are commit pinned', config.includes('8792fe1404eabd93ff12dd0726460da5db648b02'));
assert('Package uses ESM', packageJson.type === 'module');
assert('Vercel headers configured', Array.isArray(vercel.headers) && vercel.headers.length > 0);
assert('No legacy script tags', !html.includes('./src/core.js') && !html.includes('./src/render.js'));
assert('No TODO markers in runtime', !`${main}\n${world}\n${worldMethods}`.includes('TODO'));

const report = {
  generatedAt: new Date().toISOString(),
  passed: failures.length === 0,
  checks,
  failures,
};
await writeFile(resolve(root, 'qa-report.json'), `${JSON.stringify(report, null, 2)}\n`);

if (failures.length) {
  console.error(`QA failed (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`QA passed: ${checks.length} checks`);
