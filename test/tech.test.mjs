import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, MAJORS, majorParts } from '../js/world.js';
import { TOPICS, TechPlayer } from '../js/tech.js';
import { BASICS } from '../js/basics.js';
import { vocab, MODES } from '../js/vocab.js';
import { LAYER, ENDPOINT } from '../js/world.js';

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

for (const [name, SET] of [['engineer', TOPICS], ['explorer', BASICS]]) {
  test(`${name}: every network has topics, and every step only touches that network`, () => {
    for (const m of MAJORS) {
      const topics = SET[m.id];
      assert.ok(topics && topics.length >= 1, `${m.id} has no topics`);
      assert.equal(new Set(topics.map((t) => t.id)).size, topics.length, `${m.id}: topic ids repeat`);
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
}

// Explorer mode is an introduction: the words the trade uses stay out of it unless a
// step is there to introduce them (DWDM has its own topic).
const JARGON = /\b(ROADM|MPLS|DWDM|CDC|G\.8032|R-APS|RPL|MEP|CCM|CFM|QoS|SR|TI-LFA|IGP|VLAN|DSCP|eCPRI|OTN|DCI|ILA|NID|IXP|SLA|Tb\/s|λ|wavelength)\b/;
test('explorer: the plain vocabulary covers everything the HUD prints, without jargon', () => {
  const V = vocab('explorer');
  const E = vocab('engineer');
  for (const m of MAJORS) {
    for (const f of ['majorName', 'majorBlurb', 'majorPlace']) {
      assert.ok(V[f](m.id), `${m.id}: no plain ${f}`);
      assert.ok(!JARGON.test(V[f](m.id)), `${m.id}: plain ${f} has jargon: ${V[f](m.id)}`);
      assert.ok(E[f](m.id), `${m.id}: no engineer ${f}`);
    }
    assert.ok(!JARGON.test(V.stats(m.id, [1, 1, 1])), `${m.id}: plain stats have jargon`);
    for (const t of BASICS[m.id]) {
      if (t.id === 'colours') continue;
      for (const x of [t.name, t.summary, ...t.steps.map((st) => st.say)]) assert.ok(!JARGON.test(x), `${m.id}/${t.id}: "${x}" has jargon`);
    }
    for (const l of m.layers) { assert.ok(V.layerName(l) && V.layerShort(l), `plain names for layer ${l}`); assert.ok(!JARGON.test(V.layerName(l)), V.layerName(l)); }
  }
  for (const id of Object.keys(LAYER)) assert.ok(!JARGON.test(V.layerName(id)) && !JARGON.test(V.layerShort(id)), `layer ${id} not translated`);
  const types = new Set(world.nodes.map((n) => n.type));
  for (const type of types) {
    assert.notEqual(V.typeLabel(type), type, `no plain label for site type ${type}`);
    assert.ok(!JARGON.test(V.typeLabel(type)), `plain label for ${type} has jargon`);
    const n = world.nodes.find((x) => x.type === type);
    assert.ok(!JARGON.test(V.nodeName(n)), `${n.id}: plain name "${V.nodeName(n)}" has jargon`);
    assert.ok(!JARGON.test(V.nodeRole(n)), `${n.id}: plain role has jargon`);
    assert.ok(!JARGON.test(V.nodeGear(n)), `${n.id}: plain gear has jargon`);
  }
  for (const n of world.nodes) assert.ok(!JARGON.test(V.nodeName(n)), `${n.id}: "${V.nodeName(n)}"`);
  for (const k of Object.keys(ENDPOINT)) assert.ok(V.typeLabel(k) !== k, `endpoint ${k}`);
  assert.deepEqual(MODES.map((m) => m.id), ['explorer', 'engineer']);
});

test('the technologies the brief asked for are where it asked for them', () => {
  const ids = (m) => TOPICS[m].map((t) => t.id);
  assert.ok(ids('longhaul').includes('cdc'), 'national backbone: CDC ROADMs');
  assert.ok(ids('metro').includes('ring'), 'metro transport: plain ROADM ring');
  assert.ok(ids('ipcore').includes('sr'), 'data core: SR-MPLS');
  assert.ok(ids('aggregation').includes('g8032') && ids('aggregation').includes('ethagg'), 'data metro: G.8032 and Ethernet aggregation');
  for (const m of ['aggregation', 'xhaul']) assert.ok(ids(m).includes('qos') && ids(m).includes('cfm'), `${m}: QoS and CFM at the edge`);
});
