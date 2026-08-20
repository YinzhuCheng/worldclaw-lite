import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_HALF } from '../src/config.js';
import { createWorldPlan, serializePlan } from '../src/world-model.js';

const prompt = 'A misty emerald valley with an observatory and glowing forest';

test('the same prompt and seed produce the same serializable ScenePlan', () => {
  const first = serializePlan(createWorldPlan(prompt, 'TEST-SEED', 'high'));
  const second = serializePlan(createWorldPlan(prompt, 'TEST-SEED', 'high'));
  assert.deepEqual(first, second);
});

test('a different seed changes spatial generation', () => {
  const first = createWorldPlan(prompt, 'TEST-SEED-A', 'high');
  const second = createWorldPlan(prompt, 'TEST-SEED-B', 'high');
  assert.notDeepEqual(first.relays.map(({ x, z }) => [x, z]), second.relays.map(({ x, z }) => [x, z]));
});

test('planned entities remain within the playable world', () => {
  const plan = createWorldPlan(prompt, 'BOUNDS', 'high');
  const points = [plan.core, plan.camp, plan.lake, ...plan.relays, ...plan.shards, ...plan.nests];
  for (const point of points) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.z));
    assert.ok(Math.abs(point.x) <= WORLD_HALF);
    assert.ok(Math.abs(point.z) <= WORLD_HALF);
  }
});

test('terrain queries are finite and stable across a sample grid', () => {
  const plan = createWorldPlan(prompt, 'HEIGHTS', 'high');
  for (let z = -420; z <= 420; z += 70) {
    for (let x = -420; x <= 420; x += 70) {
      const height = plan.heightAt(x, z);
      const slope = plan.slopeAt(x, z);
      assert.ok(Number.isFinite(height));
      assert.ok(Number.isFinite(slope));
      assert.ok(slope >= 0);
    }
  }
});

test('render profiles adjust mission and scene density', () => {
  const cinematic = createWorldPlan(prompt, 'QUALITY', 'high');
  const balanced = createWorldPlan(prompt, 'QUALITY', 'low');
  assert.equal(cinematic.shards.length, 7);
  assert.equal(balanced.shards.length, 5);
  assert.equal(cinematic.nests.length, 5);
  assert.equal(balanced.nests.length, 3);
});
