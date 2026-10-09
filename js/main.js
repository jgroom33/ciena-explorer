import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { buildWorld, BOARD, LAYERS, LAYER, ENDPOINT, heightAt } from './world.js';
import {
  buildBoard, buildTowns, buildTrees, buildLife, modelFor, nodeY, buildCable, routerPole,
} from './scene.js';

const world = buildWorld();
const $ = (s) => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- renderer

const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 1, 2000);
// Start framed on the whole board, nudged so the layer panel doesn't cover the west coast.
const HOME = { pos: new THREE.Vector3(-26, 250, 178), target: new THREE.Vector3(-26, 0, 10) };
camera.position.copy(HOME.pos);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;          // pan across the ground, like a map
controls.minPolarAngle = 0.08;
controls.maxPolarAngle = 1.0;                 // never drop below a bird's-eye tilt
controls.minDistance = 28;
controls.maxDistance = 330;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.addEventListener('change', () => {
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, BOARD.x0, BOARD.x1);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, BOARD.z0, BOARD.z1);
  controls.target.y = 0;
});

scene.add(new THREE.HemisphereLight('#ffffff', '#7d8fa3', 1.6));
const sun = new THREE.DirectionalLight('#fff4e0', 2.4);
sun.position.set(-90, 160, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 110, bottom: -110, near: 10, far: 450 });
sun.shadow.bias = -0.001;
sun.shadow.normalBias = 0.4;
scene.add(sun);

// ---------------------------------------------------------------- world

const board = buildBoard(scene);
scene.add(buildTowns(world), buildTrees(world));
const life = buildLife(scene);

const layerGroups = Object.fromEntries(LAYERS.map((l) => [l.id, new THREE.Group()]));
for (const g of Object.values(layerGroups)) scene.add(g);

const nodeYs = {};
for (const n of world.nodes) nodeYs[n.id] = nodeY(world, n);

// Each node is drawn once, on its first layer, and is shown while any of its layers is.
const nodeObjs = {};
const pickables = [];
const blinkers = [], puffs = [];
for (const n of world.nodes) {
  const home = n.layers[0];
  const g = modelFor(n, LAYER[home].color);
  g.position.set(n.x, nodeYs[n.id], n.z);
  g.userData.node = n;
  g.traverse((o) => {
    o.userData.nodeId = n.id;
    if (o.userData.blink) blinkers.push(o);
    if (o.userData.puff !== undefined) puffs.push(o);
  });
  scene.add(g);
  nodeObjs[n.id] = g;
  pickables.push(g);
  if (n.type === 'router') {
    const host = world.byId[n.host];
    g.add(routerPole(0, -0.4, nodeYs[host.id] + 3 - nodeYs[n.id], 0, LAYER.mpls.color));
  }
}

const linkObjs = {};
for (const l of world.links) {
  const c = buildCable(world, l, LAYER[l.layer].color, nodeYs);
  c.mesh.userData.linkId = l.id;
  layerGroups[l.layer].add(c.mesh);
  linkObjs[l.id] = c;
}

// Traffic: little glowing packets running both ways along every link.
const SPEED = { dci: 16, backbone: 20, regional: 13, submarine: 14, mpls: 15, access: 8 };
const packets = {};
for (const layer of LAYERS) {
  const runs = [];
  for (const l of world.links.filter((x) => x.layer === layer.id)) {
    const n = Math.max(1, Math.round(linkObjs[l.id].len / (layer.id === 'access' ? 9 : 14)));
    for (let k = 0; k < n; k++) runs.push({ link: linkObjs[l.id], phase: (k + Math.random() * 0.5) / n, dir: k % 2 ? -1 : 1 });
  }
  const r = layer.id === 'access' ? 0.32 : 0.48;
  const col = new THREE.Color(layer.color).lerp(new THREE.Color('#ffffff'), 0.45);
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: col }), runs.length);
  mesh.raycast = () => {};
  layerGroups[layer.id].add(mesh);
  packets[layer.id] = { mesh, runs };
}
const _pm = new THREE.Matrix4(), _v = new THREE.Vector3();
function movePackets(t) {
  for (const id in packets) {
    const { mesh, runs } = packets[id];
    if (!mesh.parent.visible) continue;
    runs.forEach((p, i) => {
      const tab = p.link.table;
      let u = (p.phase + (t * SPEED[id]) / p.link.len) % 1;
      if (p.dir < 0) u = 1 - u;
      const f = u * (tab.length - 1), k = Math.floor(f);
      _v.copy(tab[k]).lerp(tab[Math.min(k + 1, tab.length - 1)], f - k);
      mesh.setMatrixAt(i, _pm.makeTranslation(_v.x, _v.y, _v.z));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
}

// Selection ring.
const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.28, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
ring.rotation.x = -Math.PI / 2;
ring.visible = false;
ring.raycast = () => {};
scene.add(ring);

// ---------------------------------------------------------------- layer state

const shown = Object.fromEntries(LAYERS.map((l) => [l.id, true]));
let selected = null;

function applyLayers() {
  for (const l of LAYERS) layerGroups[l.id].visible = shown[l.id];
  for (const n of world.nodes) nodeObjs[n.id].visible = n.layers.some((id) => shown[id]);
  // see-through sea when the cables underneath are the point
  const onlySub = shown.submarine && LAYERS.filter((l) => shown[l.id]).length <= 2;
  board.waterMat.opacity = onlySub ? 0.3 : 0.55;
  for (const btn of document.querySelectorAll('[data-layer]')) btn.setAttribute('aria-pressed', String(shown[btn.dataset.layer]));
  if (selected && !nodeObjs[selected].visible) select(null);
}

function emphasise() {
  const keep = selected ? new Set(world.byId[selected].links) : null;
  for (const l of world.links) {
    const o = linkObjs[l.id];
    const dim = keep && !keep.has(l.id);
    o.mat.transparent = dim;
    o.mat.opacity = dim ? 0.18 : 1;
    o.mat.depthWrite = !dim;
    o.ink.visible = !dim;
    o.mat.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- camera moves

let flight = null;
function flyTo(target, distance, polar = 0.62, azimuth = null, ms = 1300) {
  const from = { pos: camera.position.clone(), target: controls.target.clone() };
  const off = camera.position.clone().sub(controls.target);
  const sph = new THREE.Spherical().setFromVector3(off);
  sph.radius = distance;
  sph.phi = polar;
  if (azimuth !== null) sph.theta = azimuth;
  const to = { target: target.clone().setY(0) };
  to.pos = to.target.clone().add(new THREE.Vector3().setFromSpherical(sph));
  flight = { from, to, t0: performance.now(), ms: reduceMotion ? 1 : ms };
}
function stepFlight(now) {
  if (!flight) return;
  const k = Math.min(1, (now - flight.t0) / flight.ms);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  camera.position.lerpVectors(flight.from.pos, flight.to.pos, e);
  controls.target.lerpVectors(flight.from.target, flight.to.target, e);
  if (k >= 1) flight = null;
}

function frameNodes(ids, polar = 0.6) {
  const box = new THREE.Box3();
  for (const id of ids) { const n = world.byId[id]; box.expandByPoint(new THREE.Vector3(n.x, 0, n.z)); }
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const fit = Math.max(s.x / camera.aspect, s.z * 1.35, 30);
  flyTo(c, THREE.MathUtils.clamp(fit * 1.25, 45, 320), polar, 0);
}

function focusLayer(id) {
  for (const l of LAYERS) shown[l.id] = l.id === id;
  applyLayers();
  const ids = world.nodes.filter((n) => n.layers.includes(id)).map((n) => n.id);
  frameNodes(ids, id === 'mpls' ? 0.85 : 0.6);
  showCaption(LAYER[id]);
}
function showAll() {
  for (const l of LAYERS) shown[l.id] = true;
  applyLayers();
  flyTo(HOME.target, HOME.pos.distanceTo(HOME.target), new THREE.Spherical().setFromVector3(HOME.pos.clone().sub(HOME.target)).phi, 0);
  showCaption(null);
}

// ---------------------------------------------------------------- HUD

const TYPE_LABEL = {
  dc: 'Data center', pop: 'Backbone point of presence', regional: 'Regional ring hut', ila: 'In-line amplifier hut',
  cls: 'Cable landing station', repeater: 'Undersea repeater', edge: 'Cable leaves the map', router: 'MPLS router',
  access: 'Access node', ...Object.fromEntries(Object.entries(ENDPOINT).map(([k, v]) => [k, v.label])),
};

function layerStats(id) {
  const ns = world.nodes.filter((n) => n.layers.includes(id));
  const ls = world.links.filter((l) => l.layer === id);
  const c = (t) => ns.filter((n) => n.type === t).length;
  switch (id) {
    case 'dci': return `${c('dc')} campuses · ${ls.length} spans`;
    case 'regional': return `3 rings · ${c('regional')} huts`;
    case 'backbone': return `${c('pop')} PoPs · ${c('ila')} amp huts`;
    case 'submarine': return `${ls.length} cables · ${c('repeater')} repeaters`;
    case 'mpls': return `${c('router')} routers · ${ls.length} paths`;
    case 'access': return `${ns.length - c('access')} customer sites`;
  }
  return '';
}

const list = $('#layers');
for (const l of LAYERS) {
  const row = document.createElement('li');
  row.className = 'layer';
  row.style.setProperty('--c', l.color);
  row.innerHTML = `
    <button class="toggle" data-layer="${l.id}" aria-pressed="true" title="Show or hide ${l.name}">
      <span class="wire" aria-hidden="true"></span>
      <span class="txt"><span class="nm">${l.name}</span><span class="st">${layerStats(l.id)}</span></span>
    </button>
    <button class="focus" data-focus="${l.id}" title="Fly to ${l.name}" aria-label="Fly to ${l.name}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg>
    </button>`;
  list.append(row);
}
list.addEventListener('click', (e) => {
  const t = e.target.closest('[data-layer]');
  if (t) { shown[t.dataset.layer] = !shown[t.dataset.layer]; applyLayers(); stopTour(); return; }
  const f = e.target.closest('[data-focus]');
  if (f) { stopTour(); focusLayer(f.dataset.focus); }
});
$('#btn-all').addEventListener('click', () => { stopTour(); showAll(); });
$('#btn-tour').addEventListener('click', () => (tour ? stopTour() : startTour()));

const opts = { labels: true, traffic: true, clouds: true };
for (const b of document.querySelectorAll('[data-opt]')) {
  b.addEventListener('click', () => {
    opts[b.dataset.opt] = !opts[b.dataset.opt];
    b.setAttribute('aria-pressed', String(opts[b.dataset.opt]));
    life.clouds.visible = opts.clouds;
    for (const id in packets) packets[id].mesh.visible = opts.traffic;
  });
}

const caption = $('#caption');
function showCaption(layer, step) {
  caption.hidden = !layer;
  if (!layer) return;
  caption.style.setProperty('--c', layer.color);
  caption.querySelector('.cap-k').textContent = step || 'Layer';
  caption.querySelector('.cap-t').textContent = layer.name;
  caption.querySelector('.cap-b').textContent = layer.blurb;
  caption.querySelector('.cap-g').textContent = layer.gear;
}
$('#cap-close').addEventListener('click', () => { stopTour(); showAll(); });

// Info card for the clicked thing.
const card = $('#card');
function select(id) {
  selected = id;
  ring.visible = !!id;
  emphasise();
  if (!id) { card.hidden = true; return; }
  const n = world.byId[id];
  const layer = LAYER[n.layers[0]];
  ring.position.set(n.x, nodeYs[id] + (n.type === 'router' ? -0.6 : 0.25), n.z);
  ring.scale.setScalar(n.type === 'dc' ? 2 : n.type === 'router' ? 0.7 : n.type === 'ila' || n.type === 'repeater' ? 0.5 : 1);
  ring.material.color.set(layer.color);
  card.style.setProperty('--c', layer.color);
  const neighbours = [...new Set(n.links.map((lid) => {
    const l = world.links.find((x) => x.id === lid);
    return l.a === id ? l.b : l.a;
  }))].map((nid) => world.byId[nid]);
  card.querySelector('.card-k').textContent = TYPE_LABEL[n.type] || n.type;
  card.querySelector('.card-t').textContent = n.name;
  card.querySelector('.card-role').textContent = n.role || '';
  card.querySelector('.card-gear').textContent = n.gear || '';
  card.querySelector('.card-layers').innerHTML = n.layers.map((lid) =>
    `<span class="chip" style="--c:${LAYER[lid].color}">${LAYER[lid].short}</span>`).join('');
  const nb = card.querySelector('.card-links');
  nb.innerHTML = neighbours.length
    ? neighbours.map((m) => `<li><button data-goto="${m.id}">${m.name}</button></li>`).join('')
    : '<li class="none">Nothing else on the map</li>';
  card.querySelector('.card-links-h').hidden = !neighbours.length;
  card.hidden = false;
}
card.addEventListener('click', (e) => {
  const g = e.target.closest('[data-goto]');
  if (g) {
    const n = world.byId[g.dataset.goto];
    const lay = n.layers.find((x) => !shown[x]);
    if (lay && !n.layers.some((x) => shown[x])) { shown[lay] = true; applyLayers(); }
    select(n.id);
    flyTo(new THREE.Vector3(n.x, 0, n.z), Math.min(camera.position.distanceTo(controls.target), 110), 0.6);
  }
});
$('#card-close').addEventListener('click', () => select(null));

// ---------------------------------------------------------------- labels

const labelLayer = $('#labels');
const labels = [];
for (const c of world.cities) {
  const el = document.createElement('div');
  el.className = 'lbl city' + (c.town ? ' town' : '') + (c.big ? ' big' : '');
  el.textContent = c.name;
  labelLayer.append(el);
  labels.push({ el, pos: new THREE.Vector3(c.x, Math.max(0, heightAt(c.x, c.z)) + (c.town ? 4 : 9), c.z), town: c.town });
}
for (const n of world.nodes.filter((x) => x.type === 'edge' || x.type === 'dc')) {
  const el = document.createElement('div');
  el.className = 'lbl tag';
  el.style.setProperty('--c', LAYER[n.layers[0]].color);
  el.textContent = n.type === 'edge' ? n.name + ' →' : n.name;
  labelLayer.append(el);
  labels.push({ el, pos: new THREE.Vector3(n.x, nodeYs[n.id] + (n.type === 'dc' ? 5 : 4), n.z), node: n.id, tag: true });
}
const tip = document.createElement('div');
tip.className = 'lbl tip';
tip.hidden = true;
labelLayer.append(tip);

const _lp = new THREE.Vector3();
function placeLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const dist = camera.position.distanceTo(controls.target);
  for (const L of labels) {
    let vis = opts.labels;
    if (L.town) vis &&= dist < 200;
    if (L.tag) vis &&= dist < 230 && nodeObjs[L.node].visible;
    if (vis) {
      _lp.copy(L.pos).project(camera);
      vis = _lp.z < 1 && Math.abs(_lp.x) < 1.1 && Math.abs(_lp.y) < 1.1;
      if (vis) L.el.style.transform = `translate(${((_lp.x + 1) / 2) * w}px, ${((1 - _lp.y) / 2) * h}px) translate(-50%, -100%)`;
    }
    L.el.hidden = !vis;
  }
}

// ---------------------------------------------------------------- picking

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  for (const hit of ray.intersectObjects(pickables, true)) {
    let o = hit.object, ok = true;
    for (; o; o = o.parent) if (!o.visible) { ok = false; break; }
    if (ok && hit.object.userData.nodeId) return hit.object.userData.nodeId;
  }
  return null;
}
let hoverId = null, lastMove = null;
canvas.addEventListener('pointermove', (ev) => { lastMove = ev; });
canvas.addEventListener('pointerleave', () => { lastMove = null; hoverId = null; tip.hidden = true; canvas.style.cursor = ''; });
let down = null;
canvas.addEventListener('pointerdown', (ev) => { down = [ev.clientX, ev.clientY]; });
canvas.addEventListener('pointerup', (ev) => {
  if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5) return;
  const id = pick(ev);
  select(id);
  if (id) {
    const n = world.byId[id];
    const d = camera.position.distanceTo(controls.target);
    if (d > 140) flyTo(new THREE.Vector3(n.x, 0, n.z), 110, 0.6);
  }
});
function hover() {
  if (!lastMove || flight) return;
  const id = pick(lastMove);
  hoverId = id;
  canvas.style.cursor = id ? 'pointer' : '';
  tip.hidden = !id;
  if (id) {
    const n = world.byId[id];
    tip.style.setProperty('--c', LAYER[n.layers[0]].color);
    tip.innerHTML = `<b>${n.name}</b><span>${TYPE_LABEL[n.type]}</span>`;
    const r = canvas.getBoundingClientRect();
    tip.style.transform = `translate(${lastMove.clientX - r.left + 14}px, ${lastMove.clientY - r.top + 14}px)`;
  }
  lastMove = null;
}

// ---------------------------------------------------------------- tour

let tour = null;
function startTour() {
  tour = { i: 0, timer: null };
  $('#btn-tour').textContent = 'Stop tour';
  $('#btn-tour').setAttribute('aria-pressed', 'true');
  select(null);
  nextStop();
}
function nextStop() {
  if (!tour) return;
  if (tour.i >= LAYERS.length) { stopTour(); showAll(); return; }
  const l = LAYERS[tour.i];
  focusLayer(l.id);
  showCaption(l, `Stop ${tour.i + 1} of ${LAYERS.length}`);
  tour.i++;
  tour.timer = setTimeout(nextStop, 7000);
}
function stopTour() {
  if (!tour) return;
  clearTimeout(tour.timer);
  tour = null;
  $('#btn-tour').textContent = 'Take the tour';
  $('#btn-tour').setAttribute('aria-pressed', 'false');
}
$('#cap-next').addEventListener('click', () => {
  if (!tour) { const i = LAYERS.findIndex((l) => l.name === caption.querySelector('.cap-t').textContent); focusLayer(LAYERS[(i + 1) % LAYERS.length].id); return; }
  clearTimeout(tour.timer);
  nextStop();
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { stopTour(); select(null); }
});

// ---------------------------------------------------------------- loop

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

const clock = new THREE.Clock();
let t = 0;
function frame(now) {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (!reduceMotion) t += dt;
  resize();
  stepFlight(now);
  controls.update();
  for (const m of life.movers) m(t, reduceMotion ? 0 : dt);
  movePackets(t);
  for (const b of blinkers) b.visible = Math.sin(t * 4 + b.id) > -0.2;
  for (const p of puffs) p.position.y = 4.4 + p.userData.puff * 0.9 + ((t * 0.8 + p.userData.puff / 3) % 1) * 0.9;
  for (const id in linkObjs) if (linkObjs[id].mat.alphaMap) linkObjs[id].mat.alphaMap.offset.x = -t * 0.8;
  ring.rotation.z = t;
  ring.position.y += Math.sin(t * 3) * 0.004;
  hover();
  placeLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
applyLayers();
requestAnimationFrame(frame);
window.netlandia = { world, select, focusLayer, showAll, camera, controls };
