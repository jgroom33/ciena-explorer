// The drill-down view: one major network on its own, floating in open space.
// No planet, terrain or buildings: just its sites, its cables and the traffic on them,
// laid out where they sit on the map but flat, and scaled so a far-flung network
// (the submarine cables) reads as clearly as a compact one (the metro).
import * as THREE from 'three';
import { LAYER } from './world.js';
import { modelFor, buildCable, routerPole, place, sph, toon, whale } from './scene.js';
import { PLANET_R } from './world.js';

const DETAIL_SPEED = { dci: 16, backbone: 20, regional: 13, metro: 15, submarine: 14, ipcore: 18, agg: 13, access: 8, xhaul: 10 };

export function buildDetail(world, part) {
  const scene = new THREE.Scene();
  const nodes = part.nodes.map((id) => world.byId[id]);
  const links = part.links.map((id) => world.links.find((l) => l.id === id));

  // A network on one side is laid flat; one that wraps between sides (the subsea
  // cables) keeps its shape round an invisible planet instead.
  const sphere = new Set(nodes.map((n) => n.side)).size > 1;
  const box = new THREE.Box3();
  for (const n of nodes) box.expandByPoint(sphere ? sph(n.x, 0, n.z, n.side) : new THREE.Vector3(n.x, 0, n.z));
  const size = box.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z, 30);
  const mid = box.getCenter(new THREE.Vector3());
  const space = { sphere, cx: mid.x, cz: mid.z, k: THREE.MathUtils.clamp(extent / 70, 1, 4) };
  const center = sphere ? new THREE.Vector3(0, mid.y, 0) : new THREE.Vector3();
  // the side of the network to look at it from
  // (a wrap-round network is seen from high over the pole, so the whole loop of it shows)
  // (the subsea cables cross round the southern ocean, so that view is from the south)
  const viewDir = sphere
    ? new THREE.Vector3().setFromSphericalCoords(1, Math.PI - 0.62, Math.atan2(mid.x, mid.z) + 0.4)
    : new THREE.Vector3().setFromSphericalCoords(1, 0.85, 0.3);

  // Sites sit on an invisible floor; routers float above the hubs that house them.
  // In the undersea view the landing stations stand on the shore, above the water,
  // and everything else lies on the sea floor.
  const SURFACE = 5.5 * space.k;
  const ys = {};
  for (const n of nodes) ys[n.id] = n.type === 'router' ? (n.tier === 'core' ? 12 : 8.5) * space.k : sphere && n.type === 'cls' ? SURFACE : 0;

  scene.add(new THREE.HemisphereLight('#ffffff', '#8a9bb5', 1.7));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
  sun.position.copy(center).addScaledVector(viewDir, extent * 1.3).add(new THREE.Vector3(-extent * 0.4, extent * 0.5, 0));
  sun.target.position.copy(center);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: extent * 4 });
  sun.shadow.bias = -0.003;
  sun.shadow.normalBias = 0.5 * space.k;
  scene.add(sun);

  // Nothing to stand on, but soft shadows underneath give the network some depth.
  if (!sphere) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(extent * 3, extent * 3), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.7 * space.k;
  floor.receiveShadow = true;
  floor.raycast = () => {};
  scene.add(floor);
  }

  const movers = [], toys = [];
  if (sphere) {
    // The sea: a sandy floor, a translucent surface above the network, and whales.
    // deep water behind, a sandy floor under the cables, sunlight filtering down
    scene.background = new THREE.Color('#1b6fa8');
    scene.fog = new THREE.Fog('#1b6fa8', PLANET_R * 1.6, PLANET_R * 4.6);
    scene.add(new THREE.AmbientLight('#7fc4e8', 0.9));
    const floor = new THREE.Mesh(new THREE.SphereGeometry(PLANET_R - 0.9 * space.k, 96, 72),
      new THREE.MeshToonMaterial({ color: '#d8c48c', transparent: true, opacity: 0.6, depthWrite: false }));
    floor.receiveShadow = true;
    floor.raycast = () => {};
    floor.renderOrder = 1;
    scene.add(floor);
    const water = new THREE.Mesh(new THREE.SphereGeometry(PLANET_R + SURFACE - 0.6 * space.k, 96, 72),
      new THREE.MeshToonMaterial({ color: '#5ecbff', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    water.renderOrder = 2;
    water.raycast = () => {};
    scene.add(water);
    // risers: the cable climbs from the floor up to each landing station
    for (const l of links) for (const id of [l.a, l.b]) {
      const n = world.byId[id];
      if (n.type !== 'cls') continue;
      const bottom = sph(n.x, 0.5 * space.k, n.z, n.side), top = sph(n.x, SURFACE - 0.2 * space.k, n.z, n.side);
      const h = bottom.distanceTo(top);
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.36 * space.k, 0.36 * space.k, h, 8), toon(LAYER.submarine.color));
      riser.position.lerpVectors(bottom, top, 0.5);
      riser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bottom).normalize());
      riser.raycast = () => {};
      scene.add(riser);
    }
    // whales cruising just above the floor, each on its own slow circle round the planet
    const Y = new THREE.Vector3(0, 1, 0);
    [[0.25, 0.9, 1.0], [-0.4, 0.7, 1.3], [0.9, -0.3, 0.8]].forEach(([ax, az, sc], i) => {
      const w = whale(sc * space.k * 0.9);
      scene.add(w);
      toys.push(w);
      const axis = new THREE.Vector3(ax, 1, az).normalize();
      const u0 = new THREE.Vector3().crossVectors(axis, Y).normalize();
      const v0 = new THREE.Vector3().crossVectors(axis, u0).normalize();
      const speed = 0.045 + i * 0.012, phase = i * 2.1;
      movers.push((t) => {
        const a = t * speed + phase;
        const up = u0.clone().multiplyScalar(Math.cos(a)).addScaledVector(v0, Math.sin(a)).normalize();
        const fwd = u0.clone().multiplyScalar(-Math.sin(a)).addScaledVector(v0, Math.cos(a)).normalize();
        const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
        w.position.copy(up).multiplyScalar(PLANET_R + (1.8 + 0.6 * Math.sin(t * 0.7 + phase)) * space.k);
        w.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fwd, up, right));
        w.userData.tail.rotation.z = Math.sin(t * 2.2 + phase) * 0.35;
      });
    });
  }

  const nodeObjs = {}, pickables = [];
  for (const n of nodes) {
    const g = modelFor(n, LAYER[n.layers[0]].color);
    if (sphere) place(g, n.x, ys[n.id], n.z, 0, n.side);
    else g.position.set(n.x - space.cx, ys[n.id], n.z - space.cz);
    g.scale.setScalar(space.k);
    g.traverse((o) => {
      o.userData.nodeId = n.id;
      // the underwater haze is for the water, not the equipment lying in it
      if (sphere && o.material) for (const m of [].concat(o.material)) m.fog = false;
    });
    if (n.type === 'router' && ys[n.host] !== undefined) {
      g.add(routerPole(0, -0.4, (ys[n.host] + 3 * space.k - ys[n.id]) / space.k, 0, LAYER.mpls.color));
    }
    scene.add(g);
    nodeObjs[n.id] = g;
    pickables.push(g);
  }

  const linkObjs = {};
  for (const l of links) {
    const c = buildCable(world, l, LAYER[l.layer].color, ys, space);
    if (sphere) { c.mesh.renderOrder = 5; c.ink.renderOrder = 5; c.mat.fog = false; c.ink.material.fog = false; c.mat.depthTest = true; }
    scene.add(c.mesh);
    linkObjs[l.id] = { ...c, layer: l.layer };
  }

  // Traffic, one instanced mesh per layer present.
  const packets = [];
  for (const layer of new Set(links.map((l) => l.layer))) {
    const runs = [];
    for (const l of links.filter((x) => x.layer === layer)) {
      const n = Math.max(1, Math.round(linkObjs[l.id].len / (layer === 'access' ? 6 : 10)));
      for (let k = 0; k < n; k++) runs.push({ link: linkObjs[l.id], phase: (k + Math.random() * 0.5) / n, dir: k % 2 ? -1 : 1 });
    }
    const col = new THREE.Color(LAYER[layer].color).lerp(new THREE.Color('#ffffff'), 0.45);
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry((layer === 'access' ? 0.32 : 0.48) * space.k, 10, 8), new THREE.MeshBasicMaterial({ color: col }), runs.length);
    mesh.raycast = () => {};
    scene.add(mesh);
    packets.push({ layer, mesh, runs });
  }
  let fxRef = null;
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3();
  function update(t, traffic, dt = 0) {
    fxRef.update(dt, t);
    for (const m of movers) m(t);
    for (const { layer, mesh, runs } of packets) {
      mesh.visible = traffic;
      if (!traffic) continue;
      runs.forEach((p, i) => {
        const tab = p.link.table;
        let u = (p.phase + (t * DETAIL_SPEED[layer]) / p.link.len) % 1;
        if (p.dir < 0) u = 1 - u;
        const f = u * (tab.length - 1), k = Math.floor(f);
        v.copy(tab[k]).lerp(tab[Math.min(k + 1, tab.length - 1)], f - k);
        mesh.setMatrixAt(i, m4.makeTranslation(v.x, v.y, v.z));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const id in linkObjs) if (linkObjs[id].mat.alphaMap) linkObjs[id].mat.alphaMap.offset.x = -t * 0.8;
  }

  // Selection ring, laid flat under the picked site (on whatever counts as flat there).
  const ring = new THREE.Group();
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(3 * space.k, 0.28 * space.k, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.raycast = () => {};
  ring.add(ringMesh);
  ring.visible = false;
  scene.add(ring);

  const fx = buildFx({ scene, nodes, links, nodeObjs, linkObjs, space });
  fxRef = fx;
  return { scene, nodes, links, nodeObjs, linkObjs, pickables, ring, ringMesh, update, extent, space, center, viewDir, fx, toys };
}

// ---------------------------------------------------------------- effects
//
// What a technology explainer can do to the network on screen: light links up or
// dim them, cut or block one, put a glow under a site, run a labelled packet along
// a path, pin an HTML tag or a queue readout to a point. `clear()` puts it all back.


function buildFx({ scene, nodes, links, nodeObjs, linkObjs, space }) {
  const k = space.k;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const base = {};
  for (const id in linkObjs) base[id] = linkObjs[id].mat.color.clone();
  const packets = [], spots = [], anchors = [], temps = [];
  const Y = new THREE.Vector3(0, 1, 0);
  const upAt = (o) => Y.clone().applyQuaternion(o.quaternion);

  // the link joining two sites in this view, if any
  const link = (a, b) => links.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))?.id ?? null;
  // every link in this view, or just those of one layer
  const linksOf = (layer) => links.filter((l) => !layer || l.layer === layer).map((l) => l.id);

  // shortest path by hops from one site to another, optionally keeping off some links
  function path(from, to, avoid = []) {
    const skip = new Set(avoid);
    const prev = { [from]: null }, queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === to) break;
      for (const l of links) {
        if (skip.has(l.id)) continue;
        const next = l.a === cur ? l.b : l.b === cur ? l.a : null;
        if (next && !(next in prev)) { prev[next] = cur; queue.push(next); }
      }
    }
    if (!(to in prev)) return null;
    const out = [];
    for (let n = to; n; n = prev[n]) out.unshift(n);
    return out;
  }

  const nodePos = (id, lift = 0) => nodeObjs[id].position.clone().addScaledVector(upAt(nodeObjs[id]), lift * k);

  function linkState(id, state) {
    const o = linkObjs[id];
    if (!o) return;
    o.mat.transparent = state === 'dim';
    o.mat.opacity = state === 'dim' ? 0.14 : 1;
    o.mat.depthWrite = state !== 'dim';
    o.ink.visible = state !== 'dim';
    o.mesh.visible = state !== 'off';
    o.mat.color.copy(base[id]);
    if (state === 'glow') o.mat.color.lerp(new THREE.Color('#ffffff'), 0.3);
    if (state === 'cut') o.mat.color.set('#b0b7c3');
    o.mat.needsUpdate = true;
  }

  // light a set of links (and nothing else)
  function focus(linkIds) {
    const keep = new Set(linkIds);
    for (const id in linkObjs) linkState(id, keep.has(id) ? 'glow' : 'dim');
  }
  const pathLinks = (ids) => ids.slice(1).map((b, i) => link(ids[i], b));

  function spot(id, color = '#ffffff') {
    const o = nodeObjs[id];
    const m = new THREE.Mesh(new THREE.TorusGeometry(2.6 * k, 0.22 * k, 8, 36), new THREE.MeshBasicMaterial({ color }));
    m.rotation.x = -Math.PI / 2;
    m.raycast = () => {};
    const g = new THREE.Group();
    g.position.copy(o.position);
    g.quaternion.copy(o.quaternion);
    g.add(m);
    scene.add(g);
    spots.push({ g, m, phase: Math.random() * 6 });
    o.scale.setScalar(k * 1.1);
    return g;
  }

  // an HTML element that follows a 3D point (a fixed vector or a function returning one)
  function anchor(html, at, cls = '') {
    const el = document.createElement('div');
    el.className = 'fxtag ' + cls;
    el.innerHTML = html;
    document.querySelector('#detail-labels').append(el);
    const a = { el, at: typeof at === 'function' ? at : () => at };
    anchors.push(a);
    return a;
  }

  // a cut or a block marker on the middle of a link; the words come from `fx.words`
  // so the beginner and the engineer read it in their own vocabulary
  function marker(linkId, kind) {
    const o = linkObjs[linkId];
    const mid = o.table[Math.floor(o.table.length / 2)].clone();
    if (kind === 'cut') linkState(linkId, 'cut');
    return anchor(kind === 'cut' ? `<b>✕</b> ${fx.words.cut}` : `<b>▮</b> ${fx.words.block}`, mid, 'mark ' + kind);
  }

  // a packet running along a path of sites; `tag` is HTML that rides with it
  function packet(ids, { color = '#ffffff', speed = 14, loop = true, tag = null, size = 0.55, onHop = null, delay = 0 } = {}) {
    const pts = [], hops = [0];
    for (let i = 1; i < ids.length; i++) {
      const lid = link(ids[i - 1], ids[i]);
      if (!lid) continue;
      const l = links.find((x) => x.id === lid);
      let tab = linkObjs[lid].table;
      if (l.a !== ids[i - 1]) tab = [...tab].reverse();
      for (const p of tab) if (!pts.length || pts[pts.length - 1].distanceTo(p) > 1e-4) pts.push(p.clone());
      hops.push(pts.length - 1);
    }
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size * k, 12, 10), new THREE.MeshBasicMaterial({ color }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(size * k * 1.5, 12, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 }));
    mesh.add(halo);
    mesh.raycast = () => {};
    mesh.visible = false;
    scene.add(mesh);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = cum[cum.length - 1] || 1;
    const pk = { mesh, pts, cum, total, hops, speed: speed * k, loop, s: -delay * speed * k, hop: 0, onHop, tagEl: null, done: false };
    if (tag) pk.tag = anchor(tag, () => mesh.position.clone().addScaledVector(Y, 1.6 * k), 'ride');
    packets.push(pk);
    return pk;
  }

  // a queue readout pinned above a site: lanes of bars, each a class of traffic
  function queue(id, lanes) {
    const html = `<div class="q">${lanes.map((l) => `<div class="lane"><i style="--c:${l.color};height:${Math.round(l.fill * 100)}%"></i><span>${l.name}</span></div>`).join('')}</div>`;
    const a = anchor(html, nodePos(id, 7), 'queue');
    return { set: (i, fill) => { a.el.querySelectorAll('i')[i].style.height = Math.round(fill * 100) + '%'; } };
  }

  function clear() {
    for (const id in linkObjs) linkState(id, 'normal');
    for (const pk of packets) { scene.remove(pk.mesh); }
    for (const s of spots) scene.remove(s.g);
    for (const a of anchors) a.el.remove();
    for (const o of temps) scene.remove(o);
    for (const n of nodes) nodeObjs[n.id].scale.setScalar(k);
    packets.length = spots.length = anchors.length = temps.length = 0;
  }

  function update(dt, t) {
    for (const s of spots) {
      const p = 1 + 0.12 * Math.sin(t * 4 + s.phase);
      s.m.scale.set(p, p, 1);
    }
    for (const pk of packets) {
      if (pk.done) continue;
      pk.s += pk.speed * dt;
      if (pk.s < 0) continue;
      if (pk.s >= pk.total) {
        if (pk.loop) { pk.s -= pk.total; pk.hop = 0; if (pk.onHop) pk.onHop(0, pk); }
        else { pk.s = pk.total; pk.done = true; if (pk.onHop) pk.onHop(pk.hops.length - 1, pk); }
      }
      pk.mesh.visible = true;
      let i = 1;
      while (i < pk.cum.length - 1 && pk.cum[i] < pk.s) i++;
      const f = (pk.s - pk.cum[i - 1]) / ((pk.cum[i] - pk.cum[i - 1]) || 1);
      pk.mesh.position.lerpVectors(pk.pts[i - 1], pk.pts[i], Math.min(1, f));
      const hop = pk.hops.findIndex((h, j) => j === pk.hops.length - 1 || pk.hops[j + 1] > i - 1);
      if (hop !== pk.hop) { pk.hop = hop; if (pk.onHop) pk.onHop(hop, pk); }
    }
  }

  const fx = { byId, link, linksOf, path, pathLinks, nodePos, linkState, focus, spot, anchor, marker, packet, queue, clear, update, anchors, words: { cut: 'fibre cut', block: 'RPL blocked' } };
  return fx;
}

