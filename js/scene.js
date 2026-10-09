// Everything three.js: the diorama board, towns, equipment models, cables and traffic.
import * as THREE from 'three';
import {
  BOARD, SEA_FLOOR, heightAt, landness, smoothstep, linkPath, samplePath, pathLength, distToSegment,
} from './world.js';

export const INK = new THREE.Color('#1d2a44');

// ---------------------------------------------------------------- materials

const gradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const matCache = new Map();
export function toon(color, opts = {}) {
  const key = !Object.keys(opts).length && String(color);
  if (key && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...opts });
  if (key) matCache.set(key, m);
  return m;
}
// Faceted look: toon materials have no flatShading, so split the vertices instead.
function flat(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}
const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

// A black back-face shell slightly bigger than the mesh: the cartoon outline.
function outline(mesh, t = 0.09) {
  mesh.geometry.computeBoundingBox();
  const s = new THREE.Vector3();
  mesh.geometry.boundingBox.getSize(s);
  const o = new THREE.Mesh(mesh.geometry, inkMat);
  o.scale.set((s.x + 2 * t) / Math.max(s.x, 1e-3), (s.y + 2 * t) / Math.max(s.y, 1e-3), (s.z + 2 * t) / Math.max(s.z, 1e-3));
  o.raycast = () => {};
  mesh.add(o);
  return mesh;
}

function box(w, h, d, color, x = 0, y = 0, z = 0, line = 0.08) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  return line ? outline(m, line) : m;
}
function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 12, line = 0.06) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), toon(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  return line ? outline(m, line) : m;
}
function ball(r, color, x, y, z, line = 0.06) {
  const m = new THREE.Mesh(flat(new THREE.IcosahedronGeometry(r, 1)), toon(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return line ? outline(m, line) : m;
}
// Gable roof: a triangular prism along x.
function gable(w, h, d, color, y) {
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, h); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, toon(color));
  m.position.y = y;
  m.castShadow = true;
  return outline(m, 0.07);
}

// ---------------------------------------------------------------- board

export function buildBoard(scene) {
  const W = BOARD.x1 - BOARD.x0, D = BOARD.z1 - BOARD.z0;
  const geo = new THREE.PlaneGeometry(W, D, W, D);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const pal = {
    deep: new THREE.Color('#1c5fa8'), shelf: new THREE.Color('#5fd0e0'), sand: new THREE.Color('#f3dc9a'),
    grass: new THREE.Color('#8fd16a'), grass2: new THREE.Color('#6dbb55'), hill: new THREE.Color('#4f9d4a'),
    rock: new THREE.Color('#a39283'), snow: new THREE.Color('#ffffff'),
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const edge = x <= BOARD.x0 + 0.01 || x >= BOARD.x1 - 0.01 || z <= BOARD.z0 + 0.01 || z >= BOARD.z1 - 0.01;
    const h = edge ? SEA_FLOOR : heightAt(x, z);
    pos.setY(i, h);
    if (h < 0) c.copy(pal.deep).lerp(pal.shelf, smoothstep(SEA_FLOOR, -1, h));
    else if (h < 0.9 && landness(x, z) < 0.12) c.copy(pal.sand);
    else if (h > 13) c.copy(pal.snow);
    else if (h > 8) c.copy(pal.rock);
    else if (h > 4.5) c.copy(pal.hill);
    else c.copy(((Math.sin(x * 0.3) + Math.cos(z * 0.27)) > 0.4) ? pal.grass2 : pal.grass);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const flatGeo = flat(geo);
  const terrain = new THREE.Mesh(flatGeo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient }));
  terrain.receiveShadow = true;
  terrain.name = 'terrain';
  scene.add(terrain);

  // Diorama base: soil, then a darker stratum.
  const base = new THREE.Group();
  const soil = box(W, 3, D, '#b9845a', 0, SEA_FLOOR - 3.4, 0, 0);   // top sits just under the sea floor
  const rock = box(W, 2.5, D, '#7d5a43', 0, SEA_FLOOR - 5.9, 0, 0);
  base.add(soil, rock);
  scene.add(base);

  // Water: a translucent slab so the sea floor and its cables show through.
  const waterMat = new THREE.MeshToonMaterial({ color: '#36b5e8', gradientMap: gradient, transparent: true, opacity: 0.55, depthWrite: false });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 1, 1), waterMat);
  top.rotateX(-Math.PI / 2);
  top.position.y = 0;
  top.renderOrder = 2;
  scene.add(top);
  const sideMat = new THREE.MeshBasicMaterial({ color: '#2a8fc4', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const H = -SEA_FLOOR;
  for (const [w, x, z, ry] of [[W, 0, BOARD.z1, 0], [W, 0, BOARD.z0, 0], [D, BOARD.x1, 0, Math.PI / 2], [D, BOARD.x0, 0, Math.PI / 2]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, H), sideMat);
    s.position.set(x, -H / 2, z);
    s.rotation.y = ry;
    s.renderOrder = 3;
    scene.add(s);
  }

  // Foam: a white ring where land meets water, sampled on a grid.
  const foam = [];
  for (let x = BOARD.x0 + 2; x < BOARD.x1 - 2; x += 1.6) {
    for (let z = BOARD.z0 + 2; z < BOARD.z1 - 2; z += 1.6) {
      const h = heightAt(x, z);
      if (h < 0 && h > -0.9 && landness(x, z) > -0.04) foam.push([x, z]);
    }
  }
  const foamMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.9, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }), foam.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  foam.forEach(([x, z], i) => foamMesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0.03, z), q, new THREE.Vector3(1, 1, 1))));
  foamMesh.renderOrder = 4;
  scene.add(foamMesh);

  return { terrain, water: top, waterMat, foamMesh };
}

// ---------------------------------------------------------------- instanced helpers

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();

// items: {x, y, z, sx, sy, sz, color, ry}
function instanced(geo, items, { line = 0.1, shadow = true, faceted = false } = {}) {
  if (faceted) geo = flat(geo);
  const g = new THREE.Group();
  if (!items.length) return g;
  const body = new THREE.InstancedMesh(geo, toon('#ffffff'), items.length);
  const ink = line ? new THREE.InstancedMesh(geo, inkMat, items.length) : null;
  geo.computeBoundingBox();
  const size = new THREE.Vector3();
  geo.boundingBox.getSize(size);
  items.forEach((it, i) => {
    _p.set(it.x, it.y, it.z);
    _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, it.ry || 0);
    _s.set(it.sx, it.sy, it.sz);
    body.setMatrixAt(i, _m.compose(_p, _q, _s));
    body.setColorAt(i, _c.set(it.color));
    if (ink) {
      _s.set(it.sx + (2 * line) / size.x, it.sy + (2 * line) / size.y, it.sz + (2 * line) / size.z);
      ink.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
  });
  body.castShadow = shadow;
  body.receiveShadow = true;
  g.add(body);
  if (ink) { ink.raycast = () => {}; g.add(ink); }
  return g;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const unitRoof = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 0.6); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
})();

function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// Segments of every ground link, to keep buildings and trees off the cables.
function cableSegments(world) {
  const segs = [];
  for (const l of world.links) {
    if (l.layer === 'mpls' || l.sea) continue;
    const p = linkPath(world, l);
    for (let i = 1; i < p.length; i++) segs.push([p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]]);
  }
  return segs;
}
const clearOf = (segs, nodes, x, z, cable, node) =>
  segs.every((s) => distToSegment(x, z, ...s) > cable) &&
  nodes.every((n) => Math.hypot(n.x - x, n.z - z) > node);

// ---------------------------------------------------------------- towns and scenery

const BUILDING_COLORS = ['#f6f1e7', '#ffd6a5', '#bde0fe', '#cdb4db', '#ffc8dd', '#caffbf', '#e9edc9', '#a2d2ff'];
const ROOF_COLORS = ['#e76f51', '#c0504d', '#6d597a', '#457b9d', '#e9a03b'];

export function buildTowns(world) {
  const segs = cableSegments(world);
  const ground = world.nodes.filter((n) => !['router', 'repeater', 'edge'].includes(n.type));
  const r = rand(11);
  const towers = [], roofs = [], caps = [];
  for (const c of world.cities) {
    const step = c.town ? 1.9 : 2.3;
    for (let x = c.x - c.r; x <= c.x + c.r; x += step) {
      for (let z = c.z - c.r; z <= c.z + c.r; z += step) {
        const d = Math.hypot(x - c.x, z - c.z) / c.r;
        if (d > 1 || r() < 0.12) continue;
        const jx = x + (r() - 0.5) * 0.4, jz = z + (r() - 0.5) * 0.4;
        if (heightAt(jx, jz) < 0.6 || !clearOf(segs, ground, jx, jz, 1.5, 2.6)) continue;
        const y = heightAt(jx, jz) - 0.3;
        const color = BUILDING_COLORS[Math.floor(r() * BUILDING_COLORS.length)];
        if (c.town || (d > 0.6 && r() < 0.6)) {
          const w = 1.1 + r() * 0.5, dd = 0.9 + r() * 0.4, h = 0.9 + r() * 0.5, ry = r() < 0.5 ? 0 : Math.PI / 2;
          towers.push({ x: jx, y, z: jz, sx: w, sy: h + 0.3, sz: dd, color, ry });
          roofs.push({ x: jx, y: y + h + 0.3, z: jz, sx: dd + 0.15, sy: 1.1, sz: w + 0.15, color: ROOF_COLORS[Math.floor(r() * ROOF_COLORS.length)], ry: ry + Math.PI / 2 });
        } else {
          const w = 1.3 + r() * 0.6, h = 1.5 + (1 - d) * (c.tall ?? 0.4) * 12 * (0.5 + r());
          towers.push({ x: jx, y, z: jz, sx: w, sy: h, sz: w, color });
          caps.push({ x: jx, y: y + h, z: jz, sx: w * 0.6, sy: 0.35, sz: w * 0.6, color: '#8d99ae' });
        }
      }
    }
  }
  const g = new THREE.Group();
  g.add(instanced(unitBox, towers, { line: 0.09 }), instanced(unitRoof, roofs, { line: 0.08 }), instanced(unitBox, caps, { line: 0.05 }));
  return g;
}

export function buildTrees(world) {
  const segs = cableSegments(world);
  const ground = world.nodes.filter((n) => !['router', 'repeater', 'edge'].includes(n.type));
  const r = rand(5);
  const pines = [], rounds = [], trunks = [];
  for (let x = BOARD.x0; x < BOARD.x1; x += 1.7) {
    for (let z = BOARD.z0; z < BOARD.z1; z += 1.7) {
      const jx = x + (r() - 0.5) * 1.4, jz = z + (r() - 0.5) * 1.4;
      const h = heightAt(jx, jz);
      if (h < 1 || h > 12.5) continue;
      const forest = Math.sin(jx * 0.11 + 1.3) * Math.cos(jz * 0.13) + Math.sin(jx * 0.05 - jz * 0.07);
      if (forest < 0.55 || r() < 0.35) continue;
      if (world.cities.some((c) => Math.hypot(c.x - jx, c.z - jz) < c.r + 2.5)) continue;
      if (!clearOf(segs, ground, jx, jz, 1.6, 3)) continue;
      const s = 0.7 + r() * 0.6;
      trunks.push({ x: jx, y: h - 0.2, z: jz, sx: 0.25 * s, sy: 0.8 * s, sz: 0.25 * s, color: '#8a5a3b' });
      if (h > 5 || r() < 0.3) pines.push({ x: jx, y: h + 0.5 * s, z: jz, sx: s, sy: s * 1.4, sz: s, color: r() < 0.5 ? '#2f8f5b' : '#3a9f60' });
      else rounds.push({ x: jx, y: h + 1.0 * s, z: jz, sx: s, sy: s, sz: s, color: r() < 0.5 ? '#5cb85c' : '#7bc96f' });
    }
  }
  const g = new THREE.Group();
  g.add(
    instanced(unitBox, trunks, { line: 0 }),
    instanced(new THREE.ConeGeometry(0.9, 2, 7).translate(0, 1, 0), pines, { line: 0.08, faceted: true }),
    instanced(new THREE.IcosahedronGeometry(0.9, 0), rounds, { line: 0.08, faceted: true }),
  );
  return g;
}

// Little things that move: boats, wind turbines, clouds.
export function buildLife(scene) {
  const movers = [];
  const boat = (color) => {
    const b = new THREE.Group();
    b.add(box(2.6, 0.6, 1.1, color, 0, -0.2, 0, 0.07), box(1, 0.7, 0.8, '#ffffff', -0.3, 0.4, 0, 0.06));
    return b;
  };
  for (const [cx, cz, r, sp, color] of [[52, -20, 10, 0.12, '#e63946'], [60, 50, 14, -0.08, '#264653'], [-112, -40, 9, 0.1, '#f4a261'], [10, 66, 12, 0.07, '#2a9d8f']]) {
    const b = boat(color);
    scene.add(b);
    movers.push((t) => {
      const a = t * sp;
      b.position.set(cx + Math.cos(a) * r, Math.sin(t * 2 + cx) * 0.08, cz + Math.sin(a) * r);
      b.rotation.y = -a + (sp > 0 ? -Math.PI / 2 : Math.PI / 2);
    });
  }

  // Cable ship parked over the Portsea – Isla Verde cable.
  const ship = new THREE.Group();
  ship.add(box(5, 0.9, 1.8, '#f1faee', 0, -0.3, 0, 0.08), box(1.6, 1.2, 1.4, '#ffc300', 1.2, 0.6, 0, 0.07),
    cyl(0.12, 0.12, 2.2, '#1d2a44', -1.4, 0.6, 0, 6, 0), box(0.2, 0.2, 1.8, '#1d2a44', -1.9, 2.6, 0, 0));
  ship.position.set(56, 0, 30);
  ship.rotation.y = 0.5;
  scene.add(ship);
  movers.push((t) => { ship.position.y = Math.sin(t * 1.6) * 0.1; ship.rotation.z = Math.sin(t * 1.3) * 0.03; });

  // Wind farm on the moor.
  for (const [x, z] of [[-100, -6], [-104, 0], [-97, -12], [-108, -10]]) {
    const y = heightAt(x, z);
    const t = new THREE.Group();
    t.add(cyl(0.15, 0.3, 6, '#ffffff', 0, 0, 0, 8, 0.05));
    const rotor = new THREE.Group();
    rotor.position.set(0, 6, 0.35);
    for (let k = 0; k < 3; k++) {
      const blade = box(0.25, 3, 0.08, '#ffffff', 0, 0, 0, 0.04);
      const arm = new THREE.Group();
      arm.rotation.z = (k * Math.PI * 2) / 3;
      arm.add(blade);
      rotor.add(arm);
    }
    rotor.add(ball(0.3, '#e63946', 0, 0, 0, 0.04));
    t.add(rotor);
    t.position.set(x, y, z);
    t.rotation.y = 0.4;
    scene.add(t);
    movers.push((tt) => { rotor.rotation.z = -tt * 1.4 + x; });
  }

  // Clouds that drift across and cast soft shadows.
  const clouds = new THREE.Group();
  const cr = rand(3);
  const cloudMat = toon('#ffffff', { transparent: true, opacity: 0.92 });
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(flat(new THREE.IcosahedronGeometry(2.4 + cr() * 2, 1)), cloudMat);
      m.position.set((k - 2) * 2.6 + cr(), cr() * 1.2, (cr() - 0.5) * 3);
      m.castShadow = true;
      c.add(m);
    }
    c.position.set(BOARD.x0 + cr() * (BOARD.x1 - BOARD.x0), 34 + cr() * 8, BOARD.z0 + cr() * (BOARD.z1 - BOARD.z0));
    c.userData.speed = 1.2 + cr() * 1.5;
    clouds.add(c);
  }
  scene.add(clouds);
  movers.push((t, dt) => {
    for (const c of clouds.children) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > BOARD.x1 + 15) c.position.x = BOARD.x0 - 15;
    }
  });
  return { movers, clouds };
}

// ---------------------------------------------------------------- equipment models

const routerTop = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#2f80ed'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = 9; g.lineCap = 'round';
  const arrow = (a, inward) => {
    g.save(); g.translate(64, 64); g.rotate(a);
    const [s, e] = inward ? [46, 14] : [14, 46];
    g.beginPath(); g.moveTo(s, 0); g.lineTo(e, 0); g.stroke();
    g.beginPath(); g.moveTo(e + (inward ? -2 : 2), 0); g.lineTo(e + (inward ? 12 : -12), -11); g.lineTo(e + (inward ? 12 : -12), 11); g.closePath(); g.fill();
    g.restore();
  };
  arrow(Math.PI / 4, false); arrow(-3 * Math.PI / 4, false); arrow(3 * Math.PI / 4, true); arrow(-Math.PI / 4, true);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

export function modelFor(n, layerColor) {
  const g = new THREE.Group();
  const s = n.size || 1;
  switch (n.type) {
    case 'dc': {
      g.add(box(7 * s, 2.4, 4.6 * s, '#eef2f7', 0, -0.4));
      g.add(box(7.1 * s, 0.35, 4.7 * s, layerColor, 0, 1.6, 0, 0.05));
      for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) {
        g.add(box(1.1, 0.5, 1.1, '#8d99ae', (-2.4 + i * 1.6) * s, 1.95, (-0.9 + k * 1.8) * s, 0.04));
        g.add(cyl(0.38, 0.38, 0.08, '#2b2d42', (-2.4 + i * 1.6) * s, 2.45, (-0.9 + k * 1.8) * s, 10, 0));
      }
      g.add(box(1.6, 1.1, 1.2, '#fca311', 4.3 * s, -0.3, 1.2 * s, 0.05));
      if (s > 1.2) g.add(box(7 * s, 2.4, 3.4, '#eef2f7', 0, -0.4, 4.6 * s, 0.08), box(7.1 * s, 0.35, 3.5, layerColor, 0, 1.6, 4.6 * s, 0.05));
      break;
    }
    case 'pop': {
      g.add(box(3.8, 3.2, 3.2, '#c8553d', 0, -0.4));
      g.add(box(4, 0.35, 3.4, layerColor, 0, 2.8, 0, 0.05));
      for (let i = -1; i <= 1; i++) g.add(box(0.6, 0.6, 0.05, '#bde0fe', i * 1.1, 1.2, 1.62, 0));
      g.add(cyl(0.08, 0.08, 2.4, '#adb5bd', 1.3, 3.1, -1, 6, 0));
      g.add(ball(0.18, '#e63946', 1.3, 5.6, -1, 0));
      break;
    }
    case 'regional': {
      g.add(box(2.2, 1.6, 1.8, '#fff3e0', 0, -0.3));
      g.add(gable(2.5, 1, 2.1, layerColor, 1.3));
      g.add(box(0.5, 0.9, 0.05, '#8d5524', 0.5, -0.1, 0.92, 0));
      break;
    }
    case 'ila': {
      g.add(box(1.4, 1.1, 1.2, '#dee2e6', 0, -0.2, 0, 0.06));
      g.add(gable(1.6, 0.6, 1.4, layerColor, 0.9));
      break;
    }
    case 'cls': {
      g.add(box(3, 2, 2.4, '#ffffff', 0, -0.3));
      g.add(box(3.2, 0.35, 2.6, layerColor, 0, 1.7, 0, 0.05));
      g.add(cyl(0.6, 0.6, 0.15, '#495057', 2.6, 0, 0.8, 12, 0.05));
      break;
    }
    case 'repeater': {
      const r = cyl(0.45, 0.45, 1.8, layerColor, 0, 0, 0, 10, 0.06);
      r.rotation.z = Math.PI / 2;
      r.position.y = 0.5;
      g.add(r);
      break;
    }
    case 'edge': {
      g.add(cyl(0.7, 0.9, 1.2, layerColor, 0, -0.4, 0, 10));
      g.add(cyl(0.72, 0.72, 0.3, '#1d2a44', 0, 0.2, 0, 10, 0));
      g.add(cyl(0.06, 0.06, 2.4, '#1d2a44', 0, 0.8, 0, 6, 0));
      g.add(box(1.2, 0.7, 0.05, '#e63946', 0.62, 2.4, 0, 0.03));
      break;
    }
    case 'router': {
      const geo = new THREE.CylinderGeometry(n.tier === 'core' ? 1.4 : 1.05, n.tier === 'core' ? 1.4 : 1.05, 0.8, 24);
      const side = toon(layerColor);
      const top = new THREE.MeshToonMaterial({ map: routerTop, gradientMap: gradient });
      const m = new THREE.Mesh(geo, [side, top, side]);
      m.castShadow = true;
      g.add(outline(m, 0.08));
      break;
    }
    case 'access': {
      g.add(box(1, 1.4, 0.7, '#cfd8dc', 0, -0.2, 0, 0.06));
      g.add(box(0.75, 0.9, 0.05, layerColor, 0, 0.1, 0.37, 0));
      break;
    }
    case 'bank': {
      g.add(box(3.2, 0.3, 2.6, '#e9ecef', 0, -0.2));
      g.add(box(2.8, 1.8, 2, '#fdfdfd', 0, 0, -0.2));
      for (let i = 0; i < 4; i++) g.add(cyl(0.14, 0.14, 1.8, '#ffffff', -1.1 + i * 0.73, 0.1, 1, 8, 0.04));
      g.add(box(3, 0.25, 2.5, '#f2c14e', 0, 1.8, 0, 0.05));
      g.add(gable(2.5, 0.9, 3, '#f2c14e', 2.05));
      break;
    }
    case 'tower': {
      const parts = 4;
      for (let i = 0; i < parts; i++) {
        const r0 = 0.5 - (i * 0.32) / parts, r1 = 0.5 - ((i + 1) * 0.32) / parts;
        g.add(cyl(r1, r0, 1.8, i % 2 ? '#ffffff' : '#e63946', 0, -0.2 + i * 1.8, 0, 4, 0.05));
      }
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI * 2) / 3;
        const p = box(0.35, 1.1, 0.12, '#f8f9fa', Math.cos(a) * 0.45, 5.6, Math.sin(a) * 0.45, 0.04);
        p.rotation.y = -a + Math.PI / 2;
        g.add(p);
      }
      const light = ball(0.2, '#ff1744', 0, 7.2, 0, 0);
      light.material = new THREE.MeshBasicMaterial({ color: '#ff1744' });
      light.userData.blink = true;
      g.add(light);
      break;
    }
    case 'office': {
      g.add(box(2.4, 6.5, 2.4, '#7cc6fe', 0, -0.3));
      for (let i = 0; i < 6; i++) g.add(box(2.45, 0.12, 2.45, '#ffffff', 0, 0.4 + i * 1, 0, 0));
      g.add(box(1.4, 0.5, 1.4, '#8d99ae', 0, 6.2, 0, 0.04));
      break;
    }
    case 'hospital': {
      g.add(box(3.8, 2.2, 3, '#ffffff', 0, -0.3));
      g.add(box(1.8, 0.1, 0.5, '#e63946', 0, 1.9, 0, 0));
      g.add(box(0.5, 0.1, 1.8, '#e63946', 0, 1.9, 0, 0));
      g.add(box(1.2, 1.2, 0.9, '#bde0fe', 1.6, -0.3, 1.6, 0.05));
      break;
    }
    case 'school': {
      g.add(box(3.6, 1.6, 2, '#ffd166', 0, -0.3));
      g.add(gable(3.8, 1, 2.3, '#c0504d', 1.3));
      g.add(cyl(0.05, 0.05, 3, '#6c757d', 2.3, -0.2, 0.8, 6, 0));
      g.add(box(0.8, 0.5, 0.04, '#2f80ed', 2.72, 2.2, 0.8, 0.02));
      break;
    }
    case 'factory': {
      g.add(box(4, 2, 3, '#a8dadc', 0, -0.3));
      for (let i = 0; i < 3; i++) g.add(gable(3, 0.7, 1.3, '#457b9d', 1.7).translateX(-1.3 + i * 1.3).rotateY(Math.PI / 2));
      g.add(cyl(0.35, 0.45, 4, '#e9ecef', 1.5, -0.3, -1, 10, 0.05));
      g.add(cyl(0.36, 0.36, 0.5, '#e63946', 1.5, 3.2, -1, 10, 0.03));
      for (let k = 0; k < 3; k++) {
        const puff = ball(0.45 + k * 0.15, '#f1f3f5', 1.5, 4.4 + k * 0.9, -1, 0.03);
        puff.userData.puff = k;
        g.add(puff);
      }
      break;
    }
    case 'hotel': {
      g.add(box(2.8, 3.6, 2, '#ffafcc', 0, -0.3));
      for (let i = 0; i < 3; i++) g.add(box(2.85, 0.12, 2.05, '#ffffff', 0, 0.7 + i * 0.9, 0, 0));
      g.add(cyl(0.12, 0.16, 2.4, '#8a5a3b', 2.2, -0.2, 0.8, 6, 0));
      g.add(ball(0.8, '#52b788', 2.2, 2.4, 0.8, 0.05));
      break;
    }
  }
  return g;
}

// Height a node's model stands at.
export function nodeY(world, n) {
  if (n.type === 'router') return Math.max(0, heightAt(n.x, n.z)) + (n.tier === 'core' ? 12 : 8.5);
  if (n.type === 'edge') return 0;
  if (n.type === 'repeater') return heightAt(n.x, n.z);
  return Math.max(0.4, heightAt(n.x, n.z));
}

// ---------------------------------------------------------------- cables

const LIFT = { backbone: 0.55, regional: 0.45, dci: 0.45, access: 0.3, submarine: 0.35 };
const RADIUS = { backbone: 0.42, regional: 0.32, dci: 0.34, access: 0.18, submarine: 0.36, mpls: 0.2 };

function groundY(x, z) {
  let h = -Infinity;
  for (const [dx, dz] of [[0, 0], [0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) h = Math.max(h, heightAt(x + dx, z + dz));
  return h;
}

const dash = (() => {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 4;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 4);
  g.fillStyle = '#fff'; g.fillRect(0, 0, 40, 4);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  return t;
})();

// A cable's centre line as a three.js curve.
export function linkCurve(world, l, nodeYs) {
  if (l.layer === 'mpls') {
    const a = world.byId[l.a], b = world.byId[l.b];
    const A = new THREE.Vector3(a.x, nodeYs[a.id], a.z), B = new THREE.Vector3(b.x, nodeYs[b.id], b.z);
    const len = A.distanceTo(B);
    const mid = A.clone().add(B).multiplyScalar(0.5);
    mid.y = Math.max(A.y, B.y) + 3 + len * 0.16;
    return { curve: new THREE.QuadraticBezierCurve3(A, mid, B), len };
  }
  const path = linkPath(world, l);
  const pts = samplePath(path, 1.4).map(([x, z]) => {
    const h = groundY(x, z);
    const y = h < 0 ? heightAt(x, z) + LIFT.submarine : h + LIFT[l.layer];
    return new THREE.Vector3(x, y, z);
  });
  // Off-map buoys float: rise from the floor to the surface at the very end.
  if (world.byId[l.b].type === 'edge') pts[pts.length - 1].y = -0.4;
  return { curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5), len: pathLength(path) };
}

export function buildCable(world, l, color, nodeYs) {
  const { curve, len } = linkCurve(world, l, nodeYs);
  const r = RADIUS[l.layer];
  const segs = Math.max(8, Math.ceil(len * 1.6));
  const mat = l.layer === 'mpls'
    ? new THREE.MeshToonMaterial({ color, gradientMap: gradient, alphaMap: dash.clone(), alphaTest: 0.5 })
    : new THREE.MeshToonMaterial({ color, gradientMap: gradient });
  if (mat.alphaMap) {
    mat.alphaMap.repeat.set(Math.max(2, Math.round(len / 2.2)), 1);
    mat.alphaMap.needsUpdate = true;
  }
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, 6, false), mat);
  mesh.castShadow = l.layer !== 'submarine';
  const ink = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r + 0.11, 6, false),
    l.layer === 'mpls' ? new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, alphaMap: mat.alphaMap, alphaTest: 0.5 }) : inkMat.clone());
  ink.raycast = () => {};
  mesh.add(ink);
  const table = curve.getSpacedPoints(Math.max(8, Math.ceil(len * 2)));
  return { mesh, table, len, mat, ink };
}

// The dashed pole that ties a floating router to the building it lives in.
export function routerPole(x, yTop, yBottom, z, color) {
  const h = yTop - yBottom;
  const mat = new THREE.MeshBasicMaterial({ color, alphaMap: dash.clone(), alphaTest: 0.5 });
  mat.alphaMap.repeat.set(Math.max(2, Math.round(h / 0.9)), 1);
  mat.alphaMap.needsUpdate = true;
  const geo = new THREE.CylinderGeometry(0.08, 0.08, h, 6, 1, true);
  // swap uv so the dash runs up the pole
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i); uv.setXY(i, uv.getY(i), u); }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, yBottom + h / 2, z);
  m.raycast = () => {};
  return m;
}
