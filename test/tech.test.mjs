import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, MAJORS, majorParts } from '../js/world.js';
import { TOPICS, TechPlayer } from '../js/tech.js';

const world = buildWorld();
const parts = majorParts(world);

// A stand-in for the view's effects that only checks every site and link a step
// touches really is part of that network.
function mockFx(majorId) {
  const nodes = new Set(parts[majorId].nodes);
  const links = world.links.filter((l) => parts[majorId].links.includes(l.id));
  const byId = Object.fromEntries([...nodes].map((id) => [id, world.byId[id]]));
  const must = (id) => { assert.ok(nodes.has(id), `${majorId}: ${id} is not in this network`); return id; };
  const link = (a, b) => links.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))?.id ?? null;
  const mustLink = (a, b) => { const l = link(must(a), must(b)); assert.ok(l, `${majorId}: no link ${a}–${b}`); return l; };
  function path(from, to, avoid = []) {
    const skip = new Set(avoid), prev = { [must(from)]: null }, q = [from];
    while (q.length) { const c = q.shift(); if (c === to) break; for (const l of links) { if (skip.has(l.id)) continue; const n = l.a === c ? l.b : l.b === c ? l.a : null; if (n && !(n in prev)) { prev[n] = c; q.push(n); } } }
    assert.ok(must(to) in prev, `${majorId}: no path ${from}→${to}`);
    const out = []; for (let n = to; n; n = prev[n]) out.unshift(n); return out;
  }
  const calls = { packets: 0, spots: 0, anchors: 0 };
  return {
    calls, byId, link: mustLink, path,
    linksOf: (layer) => links.filter((l) => !layer || l.layer === layer).map((l) => l.id),
    pathLinks: (ids) => ids.slice(1).map((b, i) => mustLink(ids[i], b)),
    nodePos: (id) => { must(id); return [0, 0, 0]; },
    focus: (ids) => { for (const id of ids) assert.ok(links.some((l) => l.id === id), `${majorId}: focus on foreign link ${id}`); },
    linkState: (id) => assert.ok(links.some((l) => l.id === id)),
    spot: (id) => { must(id); calls.spots++; },
    anchor: () => { calls.anchors++; return { el: { innerHTML: '' } }; },
    marker: (id) => { assert.ok(links.some((l) => l.id === id), `${majorId}: marker on foreign link ${id}`); return { el: {} }; },
    packet: (ids) => { assert.ok(ids.length >= 2); ids.forEach(must); for (let i = 1; i < ids.length; i++) mustLink(ids[i - 1], ids[i]); calls.packets++; return { tag: { el: { innerHTML: '' } } }; },
    queue: (id) => { must(id); return { set() {} }; },
    clear() {},
    update() {},
  };
}

test('every network has technology topics, and every step only touches that network', () => {
  for (const m of MAJORS) {
    const topics = TOPICS[m.id];
    assert.ok(topics && topics.length >= 1, `${m.id} has no topics`);
    for (const t of topics) {
      assert.ok(t.id && t.name && t.tag && t.summary && t.steps.length >= 2, `${m.id}/${t.id} is incomplete`);
      const fx = mockFx(m.id);
      const player = new TechPlayer(fx);
      player.open(t);
      for (let i = 1; i < t.steps.length; i++) player.next();
      for (let i = t.steps.length - 1; i > 0; i--) player.back();
      assert.ok(fx.calls.packets + fx.calls.spots + fx.calls.anchors > 0, `${m.id}/${t.id} shows nothing`);
    }
  }
});

test('the technologies the brief asked for are where it asked for them', () => {
  const ids = (m) => TOPICS[m].map((t) => t.id);
  assert.ok(ids('longhaul').includes('cdc'), 'national backbone: CDC ROADMs');
  assert.ok(ids('metro').includes('ring'), 'metro transport: plain ROADM ring');
  assert.ok(ids('ipcore').includes('sr'), 'data core: SR-MPLS');
  assert.ok(ids('aggregation').includes('g8032') && ids('aggregation').includes('ethagg'), 'data metro: G.8032 and Ethernet aggregation');
  for (const m of ['aggregation', 'xhaul']) assert.ok(ids(m).includes('qos') && ids(m).includes('cfm'), `${m}: QoS and CFM at the edge`);
});
