import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, heightAt, linkPath, samplePath, LAYER, CITIES, flatToDir, dirToFlat } from '../js/world.js';

const world = buildWorld();
const SEA_TYPES = new Set(['repeater']);

test('every link joins two nodes that exist, on a known layer', () => {
  for (const l of world.links) {
    assert.ok(world.byId[l.a], `${l.id} missing ${l.a}`);
    assert.ok(world.byId[l.b], `${l.id} missing ${l.b}`);
    assert.ok(LAYER[l.layer], `${l.id} layer ${l.layer}`);
  }
});

test('node ids are unique', () => {
  assert.equal(new Set(world.nodes.map((n) => n.id)).size, world.nodes.length);
});

test('every layer has something on it', () => {
  for (const id of Object.keys(LAYER)) {
    assert.ok(world.links.some((l) => l.layer === id), id);
  }
});

test('land equipment and towns sit on dry land', () => {
  const wet = world.nodes.filter((n) => !SEA_TYPES.has(n.type) && heightAt(n.x, n.z) < 0.4)
    .map((n) => `${n.id} (${n.x.toFixed(1)}, ${n.z.toFixed(1)}) h=${heightAt(n.x, n.z).toFixed(2)}`);
  const wetTowns = CITIES.filter((c) => heightAt(c.x, c.z) < 0.4).map((c) => c.id);
  assert.deepEqual([...wet, ...wetTowns], []);
});

test('terrestrial fibre stays on land; submarine cables go to sea', () => {
  const bad = [];
  for (const l of world.links) {
    if (l.layer === 'mpls') continue;
    const s = samplePath(linkPath(world, l), 1);
    const wet = s.filter(([x, z]) => heightAt(x, z) < 0.3).length;
    if (l.sea) {
      if (wet < s.length * 0.6) bad.push(`${l.id} ${l.a}-${l.b} mostly dry`);
    } else if (wet > 0) {
      bad.push(`${l.id} ${l.layer} ${l.a}-${l.b} wet ${wet}/${s.length}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('submarine cables have repeaters on the sea floor', () => {
  const reps = world.nodes.filter((n) => n.type === 'repeater');
  assert.ok(reps.length >= 8, `only ${reps.length}`);
  for (const r of reps) assert.ok(heightAt(r.x, r.z) < -3);
});

test('the planet projection round-trips', () => {
  for (const [x, z] of [[0, 0], [30, -20], [-120, 80], [160, 72], [-150, 228]]) {
    const d = flatToDir(x, z);
    assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9);
    const [bx, bz] = dirToFlat(...d);
    assert.ok(Math.hypot(bx - x, bz - z) < 1e-6, `${x},${z} -> ${bx},${bz}`);
  }
});
