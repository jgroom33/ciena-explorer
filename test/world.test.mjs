import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, heightAt, linkPath, samplePath, distToSegment, LAYER, CITIES, flatToDir, dirToFlat } from '../js/world.js';

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

// Cables of any two links may cross or meet at a shared site, but never run alongside
// each other: that is what made the old map read as one tangle.
test('no two cables run alongside each other', () => {
  const ground = world.links.filter((l) => l.layer !== 'mpls');
  const paths = ground.map((l) => linkPath(world, l));
  const ends = ground.map((l) => [world.byId[l.a], world.byId[l.b]]);
  const bad = [];
  for (let i = 0; i < ground.length; i++) {
    for (let j = i + 1; j < ground.length; j++) {
      const near = [...ends[i], ...ends[j]];
      let run = 0;
      for (const [x, z] of samplePath(paths[i], 0.5)) {
        if (near.some((n) => Math.hypot(n.x - x, n.z - z) < 3.5)) continue;
        const p = paths[j];
        let d = Infinity;
        for (let k = 1; k < p.length; k++) d = Math.min(d, distToSegment(x, z, p[k - 1][0], p[k - 1][1], p[k][0], p[k][1]));
        if (d < 1.4) run++;
      }
      if (run > 10) bad.push(`${ground[i].layer} ${ground[i].a}-${ground[i].b} runs along ${ground[j].layer} ${ground[j].a}-${ground[j].b} (${run / 2} units)`);
    }
  }
  assert.deepEqual(bad, []);
});

const degree = (id, layer) => world.links.filter((l) => l.layer === layer && (l.a === id || l.b === id)).length;

test('the countrywide network is a mesh: every ROADM has three or more routes', () => {
  const roadms = world.nodes.filter((n) => n.id.startsWith('bb_'));
  assert.ok(roadms.length >= 8);
  for (const n of roadms) assert.ok(degree(n.id, 'backbone') >= 3, `${n.id} has ${degree(n.id, 'backbone')}`);
});

test('no customer or ring site hangs off a single link', () => {
  for (const n of world.nodes.filter((x) => x.layers.includes('access') && x.id.startsWith('end_'))) {
    assert.equal(degree(n.id, 'access'), 2, n.id);
  }
  for (const n of world.nodes.filter((x) => x.type === 'regional')) {
    assert.ok(degree(n.id, 'regional') >= 2, n.id);
  }
});

test('each network keeps to its own part of the country', () => {
  const at = (pred) => world.nodes.filter(pred);
  for (const n of at((x) => x.id.startsWith('bb_'))) assert.ok(n.x > -66 && n.x < -10, `ROADM ${n.id} at x=${n.x}`);
  for (const n of at((x) => (x.type === 'hub' || x.type === 'dc') && Math.hypot(x.x, x.z) < 120)) {
    if (n.id === 'dc_isla') continue;
    assert.ok(n.x > -5 && n.x < 45, `${n.id} at x=${n.x} is not in Capitalia`);
  }
  for (const n of at((x) => x.type === 'regional' && x.x < 60)) assert.ok(n.x <= -60, `${n.id} at x=${n.x}`);
});
