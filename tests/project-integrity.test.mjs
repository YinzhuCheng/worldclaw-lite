import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('every UI selector exists in index.html', async () => {
  const [html, ui] = await Promise.all([read('index.html'), read('src/ui.js')]);
  const htmlIds = new Set([...html.matchAll(/id=["']([^"']+)["']/g)].map((match) => match[1]));
  const selectorIds = new Set([...ui.matchAll(/\$\('#([^']+)'\)/g)].map((match) => match[1]));
  const missing = [...selectorIds].filter((id) => !htmlIds.has(id));
  assert.deepEqual(missing, []);
});

test('all local module imports resolve', async () => {
  const files = ['src/main.js', 'src/world.js', 'src/world-helpers.js', 'src/world-methods-1.js', 'src/world-methods-2.js', 'src/world-methods-3.js', 'src/world-methods-4.js', 'src/world-methods-5.js', 'src/player.js', 'src/ui.js', 'src/assets.js', 'src/world-model.js'];
  for (const file of files) {
    const source = await read(file);
    const imports = [...source.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)].map((match) => match[1]);
    for (const specifier of imports) {
      const target = path.resolve(path.dirname(path.join(root, file)), specifier);
      const info = await stat(target);
      assert.ok(info.isFile(), `${file} imports missing file ${specifier}`);
    }
  }
});

test('deployment configuration is valid JSON and allows the pinned model CDN', async () => {
  const config = JSON.parse(await read('vercel.json'));
  assert.equal(config.cleanUrls, true);
  const serialized = JSON.stringify(config);
  assert.match(serialized, /cdn\.jsdelivr\.net/);
  assert.match(serialized, /Content-Security-Policy/);
});

test('the import map pins one Three.js version', async () => {
  const html = await read('index.html');
  const versions = [...html.matchAll(/three@([0-9.]+)/g)].map((match) => match[1]);
  assert.ok(versions.length >= 2);
  assert.equal(new Set(versions).size, 1);
});
