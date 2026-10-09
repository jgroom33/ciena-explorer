import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorld, heightAt, heightDir, linkPath, linkDirs, samplePath, distToSegment, flatToDir, dirToFlat,
  LAYER, CITIES, MAJORS, majorParts,
} from '../js/world.js';

const world = buildWorld();
const degree = (id, layer) => world.links.filter((l) => l.layer === layer && (l.a === id || l.b === id)).length;

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
  for (const id of Object.keys(LAYER)) assert.ok(world.links.some((l) => l.layer === id), id);
});

test('transport lives on side A and the data network on side B', () => {
  for (const l of world.links) {
    if (l.cross) continue;
    const a = world.byId[l.a], b = world.byId[l.b];
    assert.equal(a.side, b.side, `${l.id} ${l.a}-${l.b} joins two sides without being a cross-side cable`);
    if (l.layer !== 'submarine') assert.equal(a.side, LAYER[l.layer].side, `${l.layer} ${l.a} on side ${a.side}`);
  }
  for (const l of world.links.filter((x) => x.cross)) {
    assert.equal(l.layer, 'submarine');
    assert.notEqual(world.byId[l.a].side, world.byId[l.b].side, `${l.id} should cross sides`);
  }
});

test('land equipment and towns sit on dry land', () => {
  const wet = world.nodes.filter((n) => n.type !== 'repeater' && heightAt(n.x, n.z, n.side) < 0.4)
    .map((n) => `${n.id} side ${n.side} (${n.x.toFixed(1)}, ${n.z.toFixed(1)}) h=${heightAt(n.x, n.z, n.side).toFixed(2)}`);
  const wetTowns = CITIES.filter((c) => heightAt(c.x, c.z, c.side) < 0.4).map((c) => c.id);
  assert.deepEqual([...wet, ...wetTowns], []);
});

test('terrestrial links stay on land; submarine cables go to sea', () => {
  const bad = [];
  for (const l of world.links) {
    const s = linkDirs(world, l, 1);
    const wet = s.filter((d) => heightDir(...d) < 0.3).length;
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
  assert.ok(reps.length >= 20, `only ${reps.length}`);
  for (const r of reps) assert.ok(heightAt(r.x, r.z, r.side) < -3);
});

test('the planet projection round-trips on both sides', () => {
  for (const side of [0, 1]) {
    for (const [x, z] of [[0, 0], [30, -20], [-120, 80], [100, 60], [-50, 18]]) {
      const d = flatToDir(x, z, side);
      assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9);
      const [bx, bz, bs] = dirToFlat(...d);
      assert.equal(bs, side);
      assert.ok(Math.hypot(bx - x, bz - z) < 1e-6, `${x},${z} side ${side} -> ${bx},${bz}`);
    }
  }
  // the two maps meet at the rim
  assert.ok(Math.abs(flatToDir(157.0796, 0, 0)[2]) < 1e-4 && Math.abs(flatToDir(-157.0796, 0, 1)[2]) < 1e-4);
});

// Cables may cross or meet at a shared site, but never run alongside each other.
test('no two cables run alongside each other', () => {
  const ground = world.links.filter((l) => !l.cross);
  const paths = ground.map((l) => linkPath(world, l));
  const ends = ground.map((l) => [world.byId[l.a], world.byId[l.b]]);
  const bad = [];
  for (let i = 0; i < ground.length; i++) {
    for (let j = i + 1; j < ground.length; j++) {
      if (ends[i][0].side !== ends[j][0].side) continue;
      const nearEnds = [...ends[i], ...ends[j]];
      let run = 0;
      for (const [x, z] of samplePath(paths[i], 0.5)) {
        if (nearEnds.some((n) => Math.hypot(n.x - x, n.z - z) < 3.5)) continue;
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

test('the meshes are meshes: every ROADM and every core router has three or more routes', () => {
  const roadms = world.nodes.filter((n) => n.id.startsWith('bb_'));
  assert.ok(roadms.length >= 8);
  for (const n of roadms) assert.ok(degree(n.id, 'backbone') >= 3, `${n.id} has ${degree(n.id, 'backbone')}`);
  const cores = world.nodes.filter((n) => n.type === 'core');
  assert.ok(cores.length >= 6);
  for (const n of cores) assert.ok(degree(n.id, 'ipcore') >= 3, `${n.id} has ${degree(n.id, 'ipcore')}`);
});

test('no customer, cell site or ring site hangs off a single link', () => {
  for (const n of world.nodes.filter((x) => x.id.startsWith('end_'))) assert.equal(degree(n.id, n.layers[0]), 2, n.id);
  for (const n of world.nodes.filter((x) => x.type === 'regional')) assert.ok(degree(n.id, 'regional') >= 2, n.id);
  for (const n of world.nodes.filter((x) => x.type === 'agg')) assert.ok(degree(n.id, 'agg') >= 2, n.id);
  for (const n of world.nodes.filter((x) => x.type === 'xhub')) assert.ok(degree(n.id, 'xhaul') >= 2, n.id);
});

test('on side A each network keeps to its own part of the country', () => {
  const at = (pred) => world.nodes.filter((n) => n.side === 0 && pred(n));
  for (const n of at((x) => x.id.startsWith('bb_'))) assert.ok(n.x > -66 && n.x < -10, `ROADM ${n.id} at x=${n.x}`);
  for (const n of at((x) => (x.type === 'hub' || x.type === 'dc') && x.id !== 'dc_isla')) assert.ok(n.x > -5 && n.x < 45, `${n.id} at x=${n.x}`);
  for (const n of at((x) => x.type === 'regional' && x.x < 60)) assert.ok(n.x <= -60, `${n.id} at x=${n.x}`);
});

test('six major networks, three per side, each owning its own links', () => {
  const parts = majorParts(world);
  assert.deepEqual(MAJORS.map((m) => `${m.side}:${m.id}`), ['0:submarine', '0:longhaul', '0:metro', '1:ipcore', '1:aggregation', '1:xhaul']);
  const seen = new Map();
  for (const m of MAJORS) {
    const p = parts[m.id];
    assert.ok(p.links.length >= 4 && p.nodes.length >= 5, m.id);
    for (const id of p.links) {
      assert.ok(!seen.has(id), `${id} is in ${seen.get(id)} and ${m.id}`);
      seen.set(id, m.id);
    }
    if (m.id !== 'submarine') for (const id of p.nodes) assert.equal(world.byId[id].side, m.side, `${id} in ${m.id}`);
  }
  const has = (m, id) => parts[m].nodes.includes(id);
  assert.ok(has('longhaul', 'bb_junc') && has('longhaul', 'hub_n') && !has('longhaul', 'dc_nw'));
  assert.ok(has('metro', 'dc_nw') && has('metro', 'hub_e') && !has('metro', 'pop_isla'));
  assert.ok(has('submarine', 'cls_gw') && has('submarine', 'cls_port') && parts.submarine.nodes.some((id) => id.startsWith('rep_')));
  assert.ok(has('ipcore', 'ixp_gw') && has('aggregation', 'ag_w') && has('xhaul', 'xh_leaf'));
});

// The sites that define each network stand inside its region on the globe. Sites two
// networks share (a hub where the mesh meets the metro, a core router that an xhaul
// ring uplinks into) belong to whichever region they stand in.
test('the sites that define each network stand inside its region on the globe', async () => {
  const { regionAt } = await import('../js/world.js');
  const own = {
    longhaul: (n) => n.id.startsWith('bb_'),
    metro: (n) => n.type === 'dc' && n.side === 0 && n.id !== 'dc_isla' || n.type === 'hub',
    ipcore: (n) => n.type === 'core' && !n.id.startsWith('cr_c') || n.type === 'ixp',
    aggregation: (n) => n.type === 'agg' || n.id.startsWith('cr_c') || n.id.startsWith('end_') && n.layers[0] === 'access',
    xhaul: (n) => n.type === 'xhub' || n.type === 'tower',
  };
  const bad = [];
  for (const n of world.nodes) {
    for (const m in own) if (own[m](n) && regionAt(n.x, n.z, n.side) !== m) bad.push(`${n.id} should be in ${m}, is in ${regionAt(n.x, n.z, n.side)}`);
  }
  for (const [x, z] of [[58, 22], [-122, 16], [92, 6]]) assert.equal(regionAt(x, z, 0), 'submarine', `A ${x},${z}`);
  // ...and the submarine network wraps round to Packetland's landing coasts
  for (const [x, z] of [[-80, 14], [52, 56], [80, -22]]) assert.equal(regionAt(x, z, 1), 'submarine', `B ${x},${z}`);
  for (const n of world.nodes.filter((x) => x.type === 'cls')) assert.equal(regionAt(n.x, n.z, n.side) === 'submarine' || n.side === 0 && n.x < 60, true, n.id);
  assert.deepEqual(bad, []);
});
