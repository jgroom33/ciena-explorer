// The drill-down view: one major network on its own, floating in open space.
// No planet, terrain or buildings: just its sites, its cables and the traffic on them,
// laid out where they sit on the map but flat, and scaled so a far-flung network
// (the submarine cables) reads as clearly as a compact one (the metro).
import * as THREE from 'three';
import { LAYER } from './world.js';
import { modelFor, buildCable, routerPole } from './scene.js';

const DETAIL_SPEED = { dci: 16, backbone: 20, regional: 13, submarine: 14, mpls: 15, access: 8 };

export function buildDetail(world, part) {
  const scene = new THREE.Scene();
  const nodes = part.nodes.map((id) => world.byId[id]);
  const links = part.links.map((id) => world.links.find((l) => l.id === id));

  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const n of nodes) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); z0 = Math.min(z0, n.z); z1 = Math.max(z1, n.z); }
  const extent = Math.max(x1 - x0, z1 - z0, 30);
  const space = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, k: THREE.MathUtils.clamp(extent / 70, 1, 4) };

  // Sites sit on an invisible floor; routers float above the hubs that house them.
  const ys = {};
  for (const n of nodes) ys[n.id] = n.type === 'router' ? (n.tier === 'core' ? 12 : 8.5) * space.k : 0;

  scene.add(new THREE.HemisphereLight('#ffffff', '#8a9bb5', 1.7));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
  sun.position.set(-extent * 0.5, extent * 1.2, extent * 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: extent * 4 });
  sun.shadow.bias = -0.003;
  sun.shadow.normalBias = 0.5 * space.k;
  scene.add(sun);

  // Nothing to stand on, but soft shadows underneath give the network some depth.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(extent * 3, extent * 3), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.7 * space.k;
  floor.receiveShadow = true;
  floor.raycast = () => {};
  scene.add(floor);

  const nodeObjs = {}, pickables = [];
  for (const n of nodes) {
    const g = modelFor(n, LAYER[n.layers[0]].color);
    g.scale.setScalar(space.k);
    g.position.set(n.x - space.cx, ys[n.id], n.z - space.cz);
    g.traverse((o) => { o.userData.nodeId = n.id; });
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
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3();
  function update(t, traffic) {
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

  // Selection ring, laid on the floor under the picked site.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3 * space.k, 0.28 * space.k, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  ring.raycast = () => {};
  scene.add(ring);

  return { scene, nodes, links, nodeObjs, linkObjs, pickables, ring, update, extent, space };
}
