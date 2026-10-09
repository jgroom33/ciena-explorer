import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { buildWorld, LAYERS, LAYER, ENDPOINT, heightAt, PLANET_R, flatToDir, dirToFlat, MAJORS, MAJOR, majorParts, SIDES } from './world.js';
import {
  buildPlanet, buildTowns, buildTrees, buildLife, modelFor, nodeY, buildCable, routerPole, place, sph,
} from './scene.js';
import { buildDetail } from './detail.js';

const world = buildWorld();
const parts = majorParts(world);
// which major network (if any) a link or site belongs to on the globe
const majorOfLink = {}, majorOfNode = {};
for (const m of MAJORS) {
  for (const id of parts[m.id].links) majorOfLink[id] = m.id;
  for (const id of parts[m.id].nodes) majorOfNode[id] ??= m.id;
}
const $ = (s) => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- renderer

const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const R = PLANET_R;
const UP = new THREE.Vector3(0, 1, 0);

// OrbitControls spins a stand-in camera around the planet's centre; the real camera
// is then set from it each frame: straight down at the planet when far away, tilting
// toward the horizon as it comes in close, the way a little-planet game frames it.
const rig = new THREE.PerspectiveCamera(38, 1, 1, 3000);
const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 3000);
const dirOf = (x, z, side = 0) => new THREE.Vector3(...flatToDir(x, z, side));
// Each side opens framed on its country, nudged so the panel doesn't hide its west coast.
const HOMES = SIDES.map((s) => dirOf(...s.home, s.id));
const HOME_H = 245;
rig.position.copy(HOMES[0]).multiplyScalar(R + HOME_H);
// Side A faces +Z, side B faces -Z.
const sideInView = () => (rig.position.z >= 0 ? 0 : 1);

const controls = new OrbitControls(rig, canvas);
controls.target.set(0, 0, 0);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minPolarAngle = 0.25;
controls.maxPolarAngle = Math.PI - 0.25;
controls.minDistance = R + 26;
controls.maxDistance = R * 4.5;
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

const _d = new THREE.Vector3(), _n = new THREE.Vector3(), _f = new THREE.Vector3();
function aimCamera() {
  const dist = rig.position.length();
  const h = dist - R;
  _d.copy(rig.position).normalize();
  _n.copy(UP).addScaledVector(_d, -_d.y);                        // map north at this spot
  if (_n.lengthSq() < 1e-6) _n.set(0, 0, -1);
  _n.normalize();
  const tilt = 0.72 * (1 - THREE.MathUtils.smoothstep(h, 45, 190));
  _f.copy(_d).multiplyScalar(R);                                  // the spot under the camera
  camera.position.copy(_f).addScaledVector(_d, h * Math.cos(tilt)).addScaledVector(_n, -h * Math.sin(tilt));
  camera.up.copy(_n).multiplyScalar(Math.cos(tilt)).addScaledVector(_d, Math.sin(tilt));
  camera.lookAt(_f.addScaledVector(_n, h * 0.12 * Math.sin(tilt)));
  // drag moves the ground under the pointer at about the same rate at any zoom
  controls.rotateSpeed = THREE.MathUtils.clamp(h / (R * 1.9), 0.1, 1);
  // keep the sun and sky light over whatever is in view, so it's always daytime
  sun.position.copy(_d).multiplyScalar(300).addScaledVector(_n, 120).addScaledVector(_side.crossVectors(_n, _d), -140);
  hemi.position.copy(_d);
  // clouds would sit in your face when zoomed in, so they thin out as you come down
  life.cloudMat.opacity = 0.92 * THREE.MathUtils.smoothstep(h, 70, 150);
  life.clouds.visible = opts.clouds && life.cloudMat.opacity > 0.02;
}
const _side = new THREE.Vector3();

const hemi = new THREE.HemisphereLight('#ffffff', '#7d8fa3', 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff4e0', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -R * 1.25, right: R * 1.25, top: R * 1.25, bottom: -R * 1.25, near: 100, far: 500 });
sun.shadow.bias = -0.001;
sun.shadow.normalBias = 0.4;
scene.add(sun, sun.target);

// ---------------------------------------------------------------- world

const board = buildPlanet(scene);
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
  place(g, n.x, nodeYs[n.id], n.z, 0, n.side);
  g.userData.node = n;
  g.traverse((o) => {
    o.userData.nodeId = n.id;
    if (o.userData.blink) blinkers.push(o);
    if (o.userData.puff !== undefined) puffs.push(o);
  });
  scene.add(g);
  nodeObjs[n.id] = g;
  pickables.push(g);
}

const linkObjs = {};
for (const l of world.links) {
  const c = buildCable(world, l, LAYER[l.layer].color, nodeYs);
  c.mesh.userData.linkId = l.id;
  layerGroups[l.layer].add(c.mesh);
  linkObjs[l.id] = c;
}

// Traffic: little glowing packets running both ways along every link.
const SPEED = { dci: 16, backbone: 20, regional: 13, metro: 15, submarine: 14, ipcore: 18, agg: 13, access: 8, xhaul: 10 };
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

// ---------------------------------------------------------------- the three majors on the globe

// Hovering any part of a major lights up all of it and dims everything else.
let lit = null;
function emphasise(majorId) {
  if (majorId === lit) return;
  lit = majorId;
  for (const l of world.links) {
    const o = linkObjs[l.id];
    const dim = majorId && majorOfLink[l.id] !== majorId;
    o.mat.transparent = !!dim;
    o.mat.opacity = dim ? 0.18 : 1;
    o.mat.depthWrite = !dim;
    o.ink.visible = !dim;
    o.mat.needsUpdate = true;
  }
  for (const b of document.querySelectorAll('[data-major]')) b.classList.toggle('lit', b.dataset.major === majorId);
}

// ---------------------------------------------------------------- camera moves

let flight = null;
// Spin the planet to bring `dir` under the camera, ending `h` above the ground.
function flyToDir(dir, h, ms = 1400) {
  const from = rig.position.clone().normalize();
  const turn = new THREE.Quaternion().setFromUnitVectors(from, dir.clone().normalize());
  flight = { from, turn, d0: rig.position.length(), d1: R + h, t0: performance.now(), ms: reduceMotion ? 1 : ms };
}
const flyTo = (x, z, h, ms) => flyToDir(dirOf(x, z), h, ms);
const _fq = new THREE.Quaternion();
function stepFlight(now) {
  if (!flight) return;
  const k = Math.min(1, (now - flight.t0) / flight.ms);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  _fq.identity().slerp(flight.turn, e);
  rig.position.copy(flight.from).applyQuaternion(_fq).multiplyScalar(THREE.MathUtils.lerp(flight.d0, flight.d1, e));
  if (k >= 1) flight = null;
}
const height = () => rig.position.length() - R;

const TYPE_LABEL = {
  dc: 'Data center', pop: 'RLS ROADM site', hub: 'Metro hub', regional: 'Regional ring hut', ila: 'RLS amplifier hut',
  cls: 'Cable landing station', repeater: 'Undersea repeater', core: 'Core router', agg: 'Aggregation router',
  xhub: '5G pre-aggregation hub', ixp: 'Internet exchange',
  access: 'Access node', ...Object.fromEntries(Object.entries(ENDPOINT).map(([k, v]) => [k, v.label])),
};


function majorStats(id) {
  const ns = parts[id].nodes.map((n) => world.byId[n]);
  const c = (pred) => ns.filter(pred).length;
  switch (id) {
    case 'submarine': return `${parts[id].links.length} cables · ${c((n) => n.type === 'cls')} landing stations · ${c((n) => n.type === 'repeater')} repeaters`;
    case 'longhaul': return `${c((n) => n.id.startsWith('bb_'))} ROADMs · ${c((n) => n.type === 'ila')} amplifier huts`;
    case 'metro': return `${c((n) => n.type === 'hub')} metro hubs · ${c((n) => n.type === 'dc')} data centers`;
    case 'ipcore': return `${c((n) => n.type === 'core')} core routers · ${c((n) => n.type === 'dc')} data centers · 1 internet exchange`;
    case 'aggregation': return `${c((n) => n.type === 'agg')} aggregation routers · ${c((n) => n.id.startsWith('end_'))} business customers`;
    case 'xhaul': return `${c((n) => n.type === 'xhub')} hubs · ${c((n) => n.type === 'tower')} cell sites`;
  }
  return '';
}

// The panel lists the three networks on whichever side of the globe is in view;
// the switch above it spins the globe round to the other side.
const list = $('#majors');
let listedSide = null;
function listSide(side) {
  if (side === listedSide) return;
  listedSide = side;
  list.replaceChildren(...MAJORS.filter((m) => m.side === side).map((m) => {
    const row = document.createElement('li');
    row.innerHTML = `
      <button class="major" data-major="${m.id}" style="--c:${m.color}">
        <span class="wire${LAYER[m.layers[0]].data ? ' dashed' : ''}" aria-hidden="true"></span>
        <span class="txt"><span class="nm">${m.name}</span><span class="st">${majorStats(m.id)}</span></span>
        <span class="go" aria-hidden="true">Open</span>
      </button>`;
    return row;
  }));
  for (const b of document.querySelectorAll('[data-side]')) b.setAttribute('aria-pressed', String(+b.dataset.side === side));
  $('#side-name').textContent = `${SIDES[side].land} · ${SIDES[side].name.toLowerCase()}`;
}
for (const b of document.querySelectorAll('[data-side]')) {
  b.addEventListener('click', () => {
    const side = +b.dataset.side;
    flyToDir(HOMES[side], HOME_H);
    listSide(side);
  });
}
listSide(0);
list.addEventListener('click', (e) => {
  const b = e.target.closest('[data-major]');
  if (b) openMajor(b.dataset.major);
});
list.addEventListener('pointerover', (e) => emphasise(e.target.closest('[data-major]')?.dataset.major ?? null));
list.addEventListener('pointerleave', () => emphasise(null));

const opts = { labels: true, traffic: true, clouds: true };
for (const b of document.querySelectorAll('[data-opt]')) {
  b.addEventListener('click', () => {
    opts[b.dataset.opt] = !opts[b.dataset.opt];
    b.setAttribute('aria-pressed', String(opts[b.dataset.opt]));
    for (const id in packets) packets[id].mesh.visible = opts.traffic;
  });
}

// ---------------------------------------------------------------- drill-down

// Each major opens on its own view, addressed as #submarine, #longhaul or #metro,
// so the browser's back button works and a real page can take over that address later.
let mode = 'globe', detail = null;
const details = {};
const detailCam = new THREE.PerspectiveCamera(38, 1, 0.5, 6000);
const detailControls = new OrbitControls(detailCam, canvas);
detailControls.enabled = false;
detailControls.enableDamping = true;
detailControls.dampingFactor = 0.08;
detailControls.screenSpacePanning = true;
detailControls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
detailControls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

const panel = $('#panel'), detailPanel = $('#detail'), card = $('#card');
const detailLabels = $('#detail-labels');
const hint = $('.hint');
const GLOBE_HINT = hint.textContent;

function openMajor(id) {
  if (location.hash.slice(1) !== id) { location.hash = id; return; }   // hashchange comes back here
  const m = MAJOR[id];
  detail = details[id] ??= buildDetail(world, parts[id]);
  mode = 'detail';
  emphasise(null);
  controls.enabled = false;
  detailControls.enabled = true;
  const d = detail.extent * (detail.space.sphere ? 1.85 : 1.55) / Math.min(1, detailCam.aspect || 1);
  detailControls.target.copy(detail.center);
  detailCam.position.copy(detail.center).addScaledVector(detail.viewDir, d);
  detailCam.up.set(0, 1, 0);
  detailControls.minDistance = detail.extent * 0.12;
  detailControls.maxDistance = detail.extent * 4;
  detailControls.update();
  // centre the network in the space beside the panel, not behind it
  if (innerWidth > 760) {
    detailCam.updateMatrixWorld();
    const visibleWidth = 2 * d * Math.tan(THREE.MathUtils.degToRad(detailCam.fov / 2)) * detailCam.aspect;
    const right = new THREE.Vector3().setFromMatrixColumn(detailCam.matrixWorld, 0).setY(0).normalize();
    const shift = right.multiplyScalar(-(panel.offsetWidth / 2 + 16) / innerWidth * visibleWidth);
    detailCam.position.add(shift);
    detailControls.target.add(shift);
    detailControls.update();
  }
  hint.textContent = 'Drag to turn · Right-drag or two fingers to pan · Scroll or pinch to zoom · Click a site';

  detailPanel.style.setProperty('--c', m.color);
  $('#d-title').textContent = m.name;
  $('#d-blurb').textContent = m.blurb;
  $('#d-stats').textContent = majorStats(id);
  $('#d-layers').innerHTML = m.layers.map((l) => `<span class="chip" style="--c:${LAYER[l].color}">${LAYER[l].name}</span>`).join('');
  detailLabels.replaceChildren();
  detail.labels = detail.nodes.filter((n) => !['ila', 'repeater', 'router'].includes(n.type)).map((n) => {
    const el = document.createElement('div');
    el.className = 'lbl tag';
    el.style.setProperty('--c', LAYER[n.layers[0]].color);
    el.textContent = n.name;
    detailLabels.append(el);
    const o = detail.nodeObjs[n.id];
    return { el, pos: o.position.clone().add(new THREE.Vector3(0, (n.type === 'dc' ? 4 : 5) * detail.space.k, 0).applyQuaternion(o.quaternion)) };
  });
  panel.hidden = true;
  detailPanel.hidden = false;
  labelLayer.hidden = true;
  detailLabels.hidden = false;
  tip.hidden = true;
  selectInDetail(null);
}

function closeMajor() {
  mode = 'globe';
  detailControls.enabled = false;
  controls.enabled = true;
  panel.hidden = false;
  detailPanel.hidden = true;
  labelLayer.hidden = false;
  detailLabels.hidden = true;
  card.hidden = true;
  hint.textContent = GLOBE_HINT;
}
$('#btn-back').addEventListener('click', () => { if (location.hash) history.back(); else closeMajor(); });
function route() {
  const id = location.hash.slice(1);
  if (MAJOR[id]) openMajor(id); else if (mode === 'detail') closeMajor();
}
addEventListener('hashchange', route);

// In the drill-down, every site is clickable.
let selected = null;
function selectInDetail(id) {
  selected = id;
  const ring = detail.ring;
  ring.visible = !!id;
  const keep = id ? new Set(world.byId[id].links) : null;
  for (const lid in detail.linkObjs) {
    const o = detail.linkObjs[lid];
    const dim = keep && !keep.has(lid);
    o.mat.transparent = !!dim;
    o.mat.opacity = dim ? 0.18 : 1;
    o.mat.depthWrite = !dim;
    o.ink.visible = !dim;
    o.mat.needsUpdate = true;
  }
  if (!id) { card.hidden = true; return; }
  const n = world.byId[id];
  const layer = LAYER[n.layers[0]];
  ring.position.copy(detail.nodeObjs[id].position);
  ring.quaternion.copy(detail.nodeObjs[id].quaternion);
  ring.scale.setScalar(n.type === 'dc' ? 2 : n.type === 'ila' || n.type === 'repeater' ? 0.5 : 1);
  detail.ringMesh.material.color.set(layer.color);
  card.style.setProperty('--c', layer.color);
  const inView = new Set(detail.links.map((l) => l.id));
  const neighbours = [...new Set(n.links.filter((lid) => inView.has(lid)).map((lid) => {
    const l = world.links.find((x) => x.id === lid);
    return l.a === id ? l.b : l.a;
  }))].map((nid) => world.byId[nid]);
  card.querySelector('.card-k').textContent = TYPE_LABEL[n.type] || n.type;
  card.querySelector('.card-t').textContent = n.name;
  card.querySelector('.card-role').textContent = n.role || '';
  card.querySelector('.card-gear').textContent = n.gear || '';
  card.querySelector('.card-layers').innerHTML = n.layers.map((lid) =>
    `<span class="chip" style="--c:${LAYER[lid].color}">${LAYER[lid].short}</span>`).join('');
  card.querySelector('.card-links').innerHTML = neighbours.map((m) => `<li><button data-goto="${m.id}">${m.name}</button></li>`).join('');
  card.querySelector('.card-links-h').hidden = !neighbours.length;
  card.hidden = false;
}
card.addEventListener('click', (e) => {
  const g = e.target.closest('[data-goto]');
  if (g && detail) selectInDetail(g.dataset.goto);
});
$('#card-close').addEventListener('click', () => selectInDetail(null));

// ---------------------------------------------------------------- labels

const labelLayer = $('#labels');
const labels = [];
for (const c of world.cities) {
  const el = document.createElement('div');
  el.className = 'lbl city' + (c.town ? ' town' : '') + (c.big ? ' big' : '');
  el.textContent = c.name;
  labelLayer.append(el);
  labels.push({ el, pos: sph(c.x, Math.max(0, heightAt(c.x, c.z, c.side)) + (c.town ? 4 : 9), c.z, c.side), town: c.town });
}
for (const n of world.nodes.filter((x) => x.type === 'dc' || (x.type === 'cls' && x.id.endsWith('far')))) {
  const el = document.createElement('div');
  el.className = 'lbl tag';
  el.style.setProperty('--c', LAYER[n.layers[0]].color);
  el.textContent = n.name;
  labelLayer.append(el);
  labels.push({ el, pos: sph(n.x, nodeYs[n.id] + (n.type === 'dc' ? 5 : 4), n.z, n.side), node: n.id, tag: true });
}
const tip = document.createElement('div');
tip.className = 'lbl tip';
tip.hidden = true;
$('#tips').append(tip);

const _lp = new THREE.Vector3(), _fv = new THREE.Vector3();
// On the side of the planet facing the camera (not over the horizon).
const facing = (p) => _fv.copy(camera.position).sub(p).dot(p) > 0;
function placeLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const hh = height();
  for (const L of labels) {
    let vis = opts.labels && facing(L.pos);
    if (L.town) vis &&= hh < 150;
    if (L.tag) vis &&= hh < 140;
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
const planetBall = new THREE.Sphere(new THREE.Vector3(), R);
const _hit = new THREE.Vector3();
const toScreen = (v, cam, r) => { _lp.copy(v).project(cam); return [((_lp.x + 1) / 2) * r.width, ((1 - _lp.y) / 2) * r.height, _lp.z]; };

// On the globe a click or hover resolves to one of the three majors (or nothing):
// a site or cable that belongs to it, a near miss on one (cables are thin from up
// here, and fingers are fat), or for the metro, anywhere over downtown Capitalia.
function pickMajor(ev) {
  const r = canvas.getBoundingClientRect();
  const px = ev.clientX - r.left, py = ev.clientY - r.top;
  ndc.set((px / r.width) * 2 - 1, -(py / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  for (const hit of ray.intersectObjects(pickables, true)) {
    const id = hit.object.userData.nodeId;
    if (id && majorOfNode[id] && facing(nodeObjs[id].position)) return majorOfNode[id];
  }
  const reach = ev.pointerType === 'touch' ? 22 : 10;
  let best = null, bestD = reach;
  for (const lid in majorOfLink) {
    const tab = linkObjs[lid].table;
    const step = Math.max(1, Math.floor(tab.length / 60));
    let prev = null;
    for (let i = 0; i < tab.length; i += step) {
      if (!facing(tab[i])) { prev = null; continue; }
      const [bx, by] = toScreen(tab[i], camera, r);
      if (prev) {
        const [ax, ay] = prev, dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
        const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
        if (d < bestD) { bestD = d; best = majorOfLink[lid]; }
      }
      prev = [bx, by];
    }
  }
  if (best) return best;
  if (ray.ray.intersectSphere(planetBall, _hit)) {
    _hit.normalize();
    const [x, z, side] = dirToFlat(_hit.x, _hit.y, _hit.z);
    const m = MAJORS.find((mm) => mm.area && mm.side === side && Math.hypot(x - mm.area.x, z - mm.area.z) < mm.area.r);
    if (m) return m.id;
  }
  return null;
}

// In the drill-down, a click or hover resolves to a site: a direct hit, else the nearest within reach.
function pickSite(ev) {
  const r = canvas.getBoundingClientRect();
  const px = ev.clientX - r.left, py = ev.clientY - r.top;
  ndc.set((px / r.width) * 2 - 1, -(py / r.height) * 2 + 1);
  ray.setFromCamera(ndc, detailCam);
  for (const hit of ray.intersectObjects(detail.pickables, true)) if (hit.object.userData.nodeId) return hit.object.userData.nodeId;
  let best = null, bestD = ev.pointerType === 'touch' ? 24 : 14;
  for (const n of detail.nodes) {
    if (n.type === 'ila' || n.type === 'repeater') continue;
    const [x, y, z] = toScreen(detail.nodeObjs[n.id].position, detailCam, r);
    const d = Math.hypot(x - px, y - py);
    if (z < 1 && d < bestD) { bestD = d; best = n.id; }
  }
  return best;
}

let lastMove = null;
canvas.addEventListener('pointermove', (ev) => { lastMove = ev; });
canvas.addEventListener('pointerleave', () => { lastMove = null; tip.hidden = true; canvas.style.cursor = ''; if (mode === 'globe') emphasise(null); });
let down = null;
canvas.addEventListener('pointerdown', (ev) => { down = [ev.clientX, ev.clientY]; });
canvas.addEventListener('pointerup', (ev) => {
  if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5) return;
  if (mode === 'globe') {
    const m = pickMajor(ev);
    if (m) openMajor(m);
  } else {
    selectInDetail(pickSite(ev));
  }
});
function showTip(ev, color, title, sub) {
  const r = canvas.getBoundingClientRect();
  tip.style.setProperty('--c', color);
  tip.innerHTML = `<b>${title}</b><span>${sub}</span>`;
  tip.style.transform = `translate(${ev.clientX - r.left + 14}px, ${ev.clientY - r.top + 14}px)`;
  tip.hidden = false;
}
function hover() {
  if (!lastMove || flight) return;
  if (mode === 'globe') {
    const m = pickMajor(lastMove);
    emphasise(m);
    canvas.style.cursor = m ? 'pointer' : '';
    if (m) showTip(lastMove, MAJOR[m].color, MAJOR[m].name, 'Click to open'); else tip.hidden = true;
  } else {
    const id = pickSite(lastMove);
    canvas.style.cursor = id ? 'pointer' : '';
    if (id) showTip(lastMove, LAYER[world.byId[id].layers[0]].color, world.byId[id].name, TYPE_LABEL[world.byId[id].type]); else tip.hidden = true;
  }
  lastMove = null;
}

addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || mode !== 'detail') return;
  if (selected) selectInDetail(null); else $('#btn-back').click();
});

// ---------------------------------------------------------------- loop

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = rig.aspect = detailCam.aspect = w / h;
    camera.updateProjectionMatrix();
    rig.updateProjectionMatrix();
    detailCam.updateProjectionMatrix();
  }
}

const clock = new THREE.Clock();
let t = 0;
function frame(now) {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (!reduceMotion) t += dt;
  resize();
  if (mode === 'globe') {
    stepFlight(now);
    controls.update();
    aimCamera();
    if (!flight) listSide(sideInView());
    for (const m of life.movers) m(t, reduceMotion ? 0 : dt);
    movePackets(t);
    for (const b of blinkers) b.visible = Math.sin(t * 4 + b.id) > -0.2;
    for (const p of puffs) p.position.y = 4.4 + p.userData.puff * 0.9 + ((t * 0.8 + p.userData.puff / 3) % 1) * 0.9;
    for (const id in linkObjs) if (linkObjs[id].mat.alphaMap) linkObjs[id].mat.alphaMap.offset.x = -t * 0.8;
    hover();
    placeLabels();
    renderer.render(scene, camera);
  } else {
    detailControls.update();
    detail.update(t, opts.traffic);
    detail.ringMesh.rotation.z = t;
    hover();
    const r = canvas.getBoundingClientRect();
    for (const L of detail.labels) {
      const [x, y, z] = toScreen(L.pos, detailCam, r);
      L.el.hidden = !opts.labels || z > 1;
      L.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }
    renderer.render(detail.scene, detailCam);
  }
  requestAnimationFrame(frame);
}
route();
requestAnimationFrame(frame);
window.netlandia = { world, openMajor, closeMajor, selectInDetail, flyTo, camera, controls, nodeObjs, linkObjs };
