// The world of Netlandia: terrain, places and every network, as plain data.
// No three.js in here, so the tests can check it under node.

export const BOARD = { x0: -130, x1: 130, z0: -88, z1: 88 };
export const SEA_FLOOR = -14;

// ---------------------------------------------------------------- noise

function hash(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const smooth = (t) => t * t * (3 - 2 * t);
function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz;
}
function fbm(x, z) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += amp * (valueNoise(x * f, z * f) * 2 - 1); amp *= 0.5; f *= 2.03; }
  return s;
}
export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------- land

// Each blob is an ellipse of land; the coast is where the best blob reaches zero.
const BLOBS = [
  [-50, 0, 62, 50],    // western heartland
  [-5, 12, 48, 42],    // the Portsea lowlands
  [-78, -35, 32, 28],  // northern highlands
  [-15, -40, 42, 26],  // Midhill plateau
  [95, 2, 24, 34],     // Isla Verde
  [108, -30, 14, 14],  // Palm Point
];

// > 0 on land, < 0 at sea. Roughly the fraction of the way in from the coast.
export function landness(x, z) {
  let f = -Infinity;
  for (const [cx, cz, rx, rz] of BLOBS) {
    const dx = (x - cx) / rx, dz = (z - cz) / rz;
    f = Math.max(f, 1 - (dx * dx + dz * dz));
  }
  return f + fbm(x * 0.045, z * 0.045) * 0.14;
}

const MOUNTAINS = [
  [-88, -44, 16, 14],
  [-70, -56, 10, 9],
  [-100, -24, 10, 7],
  [104, -32, 6, 5],
];

function rawHeight(x, z) {
  const f = landness(x, z);
  if (f <= 0) return SEA_FLOOR * smoothstep(0, 0.32, -f) - 0.6 * (1 - smoothstep(0, 0.32, -f));
  let h = 0.4 + smoothstep(0, 0.25, f) * 2.2 + Math.max(0, fbm(x * 0.06 + 7, z * 0.06 - 3)) * 5;
  for (const [mx, mz, mh, s] of MOUNTAINS) {
    const d2 = ((x - mx) ** 2 + (z - mz) ** 2) / (s * s);
    h += mh * Math.exp(-d2);
  }
  return h;
}

// Terraced, so the hills read as toy-like steps.
const STEP = 1.6;
export function heightAt(x, z) {
  const h = rawHeight(x, z);
  if (h <= 0.4) return h;
  const base = Math.floor(h / STEP) * STEP;
  return Math.max(0.4, base + STEP * smoothstep(0.7, 1, (h - base) / STEP));
}

// ---------------------------------------------------------------- layers

export const LAYERS = [
  {
    id: 'dci', name: 'Data center interconnect', short: 'DCI', color: '#9b5de5',
    blurb: 'Point-to-point waves between data center campuses: huge capacity, short hops, no fuss.',
    gear: 'Ciena Waveserver with WaveLogic coherent optics',
  },
  {
    id: 'regional', name: 'Regional transport', short: 'Regional', color: '#ff8c1a',
    blurb: 'Rings that tie the towns around each metro back to its hub, protected so a single cut does not take a town offline.',
    gear: 'Ciena 6500 Packet-Optical and Waveserver',
  },
  {
    id: 'backbone', name: 'Countrywide backbone', short: 'Backbone', color: '#e63946',
    blurb: 'Long-haul ROADM mesh between the big cities, with an amplifier hut every 80 km or so.',
    gear: 'Ciena 6500 RLS line system with WaveLogic',
  },
  {
    id: 'submarine', name: 'Submarine cable', short: 'Submarine', color: '#ffc300',
    blurb: 'Cables on the sea floor between landing stations, with repeaters spaced along the seabed.',
    gear: 'Ciena GeoMesh Extreme submarine networking',
  },
  {
    id: 'mpls', name: 'MPLS transport', short: 'MPLS', color: '#2f80ed',
    blurb: 'The packet layer riding on top of the optics: routers and the label-switched paths between them, drawn as arcs in the sky.',
    gear: 'Ciena 8100 Coherent Routers and 5100 series routers',
  },
  {
    id: 'access', name: 'Access network', short: 'Access', color: '#ff4fa3',
    blurb: 'The last mile to the customer: banks, cell towers, offices, hospitals and schools.',
    gear: 'Ciena 3900 / 5100 series access devices and NIDs',
  },
];
export const LAYER = Object.fromEntries(LAYERS.map((l) => [l.id, l]));

// ---------------------------------------------------------------- places

export const CITIES = [
  { id: 'capitalia', name: 'Capitalia', x: -40, z: 6, r: 12, big: true, tall: 1.0 },
  { id: 'portsea', name: 'Portsea', x: 20, z: 22, r: 9, big: true, tall: 0.7 },
  { id: 'northgate', name: 'Northgate', x: -60, z: -40, r: 7, tall: 0.45 },
  { id: 'southvale', name: 'Southvale', x: -30, z: 42, r: 7, tall: 0.45 },
  { id: 'midhill', name: 'Midhill', x: -4, z: -32, r: 6, tall: 0.4 },
  { id: 'westmoor', name: 'Westmoor', x: -90, z: 8, r: 6, tall: 0.35 },
  { id: 'isla', name: 'Isla Verde', x: 92, z: 6, r: 7, big: true, tall: 0.55 },
  { id: 'elmford', name: 'Elmford', x: -64, z: 26, r: 3.5, town: true },
  { id: 'brookby', name: 'Brookby', x: -12, z: 28, r: 3.5, town: true },
  { id: 'ashton', name: 'Ashton', x: -16, z: -8, r: 3.5, town: true },
  { id: 'pinecrest', name: 'Pinecrest', x: -70, z: -14, r: 3.5, town: true },
  { id: 'cove', name: 'Cove', x: 24, z: 38, r: 3, town: true },
  { id: 'dunmore', name: 'Dunmore', x: 6, z: 2, r: 3, town: true },
  { id: 'palmtown', name: 'Palmtown', x: 104, z: -26, r: 3, town: true },
  { id: 'reefside', name: 'Reefside', x: 88, z: 26, r: 3, town: true },
];
export const CITY = Object.fromEntries(CITIES.map((c) => [c.id, c]));

// Hand-placed equipment. Access gear and amplifiers are generated below.
const N = (id, type, name, x, z, layers, extra = {}) => ({ id, type, name, x, z, layers, ...extra });

const PLACED = [
  // data centers
  N('dc_cap1', 'dc', 'Capitalia DC-1', -57, 16, ['dci'], { role: 'Colocation campus west of the capital' }),
  N('dc_cap2', 'dc', 'Capitalia DC-2', -26, 16, ['dci'], { role: 'Enterprise and cloud on-ramp campus' }),
  N('dc_north', 'dc', 'Northgate Cloud Campus', -46, -50, ['dci'], { role: 'Hyperscale campus, cheap hydro power from the hills', size: 1.4 }),
  N('dc_port', 'dc', 'Portsea DC', 30, 8, ['dci'], { role: 'Harbor-side carrier hotel next to the cable landing' }),
  N('dc_isla', 'dc', 'Isla Verde DC', 99, 16, ['dci'], { role: 'Island edge data center' }),

  // backbone points of presence (ROADM sites)
  N('pop_cap', 'pop', 'Capitalia Central Office', -46, -6, ['backbone', 'regional'], { role: 'Backbone ROADM hub and regional ring head-end' }),
  N('pop_port', 'pop', 'Portsea Central Office', 14, 14, ['backbone', 'regional'], { role: 'Backbone ROADM and Portsea ring head-end' }),
  N('pop_north', 'pop', 'Northgate PoP', -56, -32, ['backbone'], { role: 'Backbone ROADM site' }),
  N('pop_south', 'pop', 'Southvale PoP', -36, 34, ['backbone'], { role: 'Backbone ROADM site' }),
  N('pop_mid', 'pop', 'Midhill PoP', 0, -24, ['backbone'], { role: 'Backbone ROADM site on the plateau' }),
  N('pop_west', 'pop', 'Westmoor PoP', -86, 16, ['backbone'], { role: 'Backbone ROADM site' }),
  N('pop_isla', 'pop', 'Isla Verde Central Office', 86, -2, ['backbone', 'regional'], { role: 'Island ROADM hub and ring head-end' }),

  // regional ring sites
  N('reg_elm', 'regional', 'Elmford hut', -60, 22, ['regional'], { role: 'Ring site on the Capitalia regional ring' }),
  N('reg_brook', 'regional', 'Brookby hut', -16, 24, ['regional'], { role: 'Ring site on the Capitalia regional ring' }),
  N('reg_ash', 'regional', 'Ashton hut', -20, -12, ['regional'], { role: 'Ring site on the Capitalia regional ring' }),
  N('reg_pine', 'regional', 'Pinecrest hut', -66, -18, ['regional'], { role: 'Ring site on the Capitalia regional ring' }),
  N('reg_cove', 'regional', 'Cove hut', 20, 36, ['regional'], { role: 'Ring site on the Portsea ring' }),
  N('reg_dun', 'regional', 'Dunmore hut', 2, 5, ['regional'], { role: 'Ring site on the Portsea ring' }),
  N('reg_palm', 'regional', 'Palmtown hut', 100, -22, ['regional'], { role: 'Ring site on the Isla Verde ring' }),
  N('reg_reef', 'regional', 'Reefside hut', 84, 22, ['regional'], { role: 'Ring site on the Isla Verde ring' }),

  // cable landing stations
  N('cls_port', 'cls', 'Portsea Landing Station', 38, 22, ['submarine'], { role: 'Lands the Isla Verde cable' }),
  N('cls_isla_w', 'cls', 'Isla West Landing Station', 74, 8, ['submarine'], { role: 'Lands the Portsea cable' }),
  N('cls_isla_s', 'cls', 'Isla South Landing Station', 94, 31, ['submarine'], { role: 'Lands the Farland trans-ocean cable' }),
  N('cls_west', 'cls', 'Westmoor Landing Station', -106, 12, ['submarine'], { role: 'Lands the Westerland cable' }),
  N('edge_far', 'edge', 'To Farland', 124, 84, ['submarine'], { role: 'Trans-ocean cable continues off the map' }),
  N('edge_west', 'edge', 'To Westerland', -126, 60, ['submarine'], { role: 'Cable continues off the map' }),
];

// Routers float above the site that houses them.
const ROUTER_SITES = [
  ['pop_cap', 'core'], ['pop_port', 'core'], ['pop_north', 'core'], ['pop_south', 'core'],
  ['pop_mid', 'core'], ['pop_west', 'core'], ['pop_isla', 'core'],
  ['reg_elm', 'agg'], ['reg_brook', 'agg'], ['reg_ash', 'agg'], ['reg_pine', 'agg'],
  ['reg_cove', 'agg'], ['reg_dun', 'agg'], ['reg_palm', 'agg'], ['reg_reef', 'agg'],
];

// ---------------------------------------------------------------- links

const L = (layer, a, b, extra = {}) => ({ layer, a, b, ...extra });

const LINKS = [
  // DCI
  L('dci', 'dc_cap1', 'dc_cap2', { note: 'Metro DCI, about 30 km' }),
  L('dci', 'dc_cap1', 'dc_north', { via: [[-60, -20]] }),
  L('dci', 'dc_cap2', 'dc_north', { via: [[-30, -24]] }),
  L('dci', 'dc_cap2', 'dc_port', { via: [[0, 14]] }),
  L('dci', 'dc_port', 'cls_port', { note: 'Hands DCI waves to the Isla Verde cable' }),
  L('dci', 'dc_isla', 'cls_isla_w', { via: [[86, 12]], note: 'Picks up DCI waves from the Portsea cable' }),

  // backbone
  L('backbone', 'pop_west', 'pop_cap'),
  L('backbone', 'pop_west', 'pop_north', { via: [[-78, -12]] }),
  L('backbone', 'pop_north', 'pop_cap'),
  L('backbone', 'pop_north', 'pop_mid', { via: [[-30, -36]] }),
  L('backbone', 'pop_cap', 'pop_south', { via: [[-48, 18]] }),
  L('backbone', 'pop_cap', 'pop_mid', { via: [[-22, -22]] }),
  L('backbone', 'pop_mid', 'pop_port', { via: [[16, -8]] }),
  L('backbone', 'pop_south', 'pop_port', { via: [[-6, 40]] }),
  L('backbone', 'pop_port', 'cls_port'),
  L('backbone', 'pop_isla', 'cls_isla_w'),
  L('backbone', 'pop_isla', 'cls_isla_s', { via: [[92, 18]] }),
  L('backbone', 'pop_west', 'cls_west'),

  // regional rings
  L('regional', 'pop_cap', 'reg_pine'),
  L('regional', 'reg_pine', 'reg_elm', { via: [[-74, 4]] }),
  L('regional', 'reg_elm', 'reg_brook', { via: [[-38, 28]] }),
  L('regional', 'reg_brook', 'reg_ash', { via: [[-6, 8]] }),
  L('regional', 'reg_ash', 'pop_cap'),
  L('regional', 'pop_port', 'reg_cove'),
  L('regional', 'reg_cove', 'reg_dun', { via: [[6, 24]] }),
  L('regional', 'reg_dun', 'pop_port'),
  L('regional', 'pop_isla', 'reg_palm'),
  L('regional', 'reg_palm', 'reg_reef', { via: [[108, 4]] }),
  L('regional', 'reg_reef', 'pop_isla', { via: [[80, 10]] }),

  // submarine
  L('submarine', 'cls_port', 'cls_isla_w', { sea: true, via: [[50, 30], [62, 22]], name: 'Portsea – Isla Verde cable' }),
  L('submarine', 'cls_isla_s', 'edge_far', { sea: true, via: [[100, 48], [114, 66]], name: 'Farland trans-ocean cable' }),
  L('submarine', 'cls_west', 'edge_west', { sea: true, via: [[-116, 26], [-118, 44]], name: 'Westerland cable' }),
  L('submarine', 'cls_port', 'edge_far', { sea: true, via: [[46, 50], [80, 74]], name: 'Portsea – Farland cable' }),

  // MPLS (router to router)
  ...[
    ['pop_cap', 'pop_port'], ['pop_cap', 'pop_north'], ['pop_cap', 'pop_south'], ['pop_cap', 'pop_west'],
    ['pop_north', 'pop_west'], ['pop_mid', 'pop_port'], ['pop_mid', 'pop_north'], ['pop_south', 'pop_port'],
    ['pop_port', 'pop_isla'], ['pop_cap', 'pop_mid'],
    ['reg_elm', 'pop_cap'], ['reg_pine', 'pop_cap'], ['reg_ash', 'pop_cap'], ['reg_brook', 'pop_south'],
    ['reg_brook', 'pop_cap'], ['reg_cove', 'pop_port'], ['reg_dun', 'pop_port'], ['reg_palm', 'pop_isla'], ['reg_reef', 'pop_isla'],
  ].map(([a, b]) => L('mpls', 'rtr_' + a, 'rtr_' + b)),
];

// ---------------------------------------------------------------- access

// Who hangs off each site's access network, and in which direction from it.
const ACCESS = [
  { site: 'pop_cap', city: 'capitalia', ends: ['bank', 'office', 'bank', 'hospital', 'tower', 'office', 'tower'] },
  { site: 'pop_port', city: 'portsea', ends: ['bank', 'tower', 'factory', 'office', 'hospital'] },
  { site: 'pop_north', city: 'northgate', ends: ['tower', 'school', 'bank', 'factory'] },
  { site: 'pop_south', city: 'southvale', ends: ['tower', 'bank', 'school', 'hospital'] },
  { site: 'pop_mid', city: 'midhill', ends: ['tower', 'school', 'bank'] },
  { site: 'pop_west', city: 'westmoor', ends: ['tower', 'bank', 'factory'] },
  { site: 'pop_isla', city: 'isla', ends: ['bank', 'tower', 'hotel', 'hospital', 'office'] },
  { site: 'reg_elm', city: 'elmford', ends: ['tower', 'school', 'bank'] },
  { site: 'reg_brook', city: 'brookby', ends: ['tower', 'bank'] },
  { site: 'reg_ash', city: 'ashton', ends: ['tower', 'school'] },
  { site: 'reg_pine', city: 'pinecrest', ends: ['tower', 'bank'] },
  { site: 'reg_cove', city: 'cove', ends: ['tower', 'hotel'] },
  { site: 'reg_dun', city: 'dunmore', ends: ['tower', 'factory'] },
  { site: 'reg_palm', city: 'palmtown', ends: ['tower', 'hotel'] },
  { site: 'reg_reef', city: 'reefside', ends: ['tower', 'school'] },
];

export const ENDPOINT = {
  bank: { label: 'Bank branch', gear: 'Ciena 3900 series NID, Ethernet business service' },
  office: { label: 'Corporate office', gear: 'Ciena 3900 series NID, 10G business Ethernet' },
  hospital: { label: 'Hospital', gear: 'Ciena 5100 series router, protected dual-homed service' },
  school: { label: 'School', gear: 'Ciena 3900 series NID, 1G Ethernet' },
  tower: { label: 'Cell tower', gear: 'Ciena 5100 series cell-site router, 5G fronthaul and backhaul' },
  factory: { label: 'Factory', gear: 'Ciena 3900 series NID, private line' },
  hotel: { label: 'Resort hotel', gear: 'Ciena 3900 series NID, business Ethernet' },
};

const NAMES = {
  bank: ['First Coastal Bank', 'Union Savings', 'Harbor Trust', 'Capital Credit Union', 'Pinewood Bank', 'Meridian Bank', 'Valley Savings'],
  office: ['Brightlane HQ', 'Orbis Insurance', 'Tessel Labs'],
  hospital: ['General Hospital', 'St. Avery Clinic', 'Harbor Health', 'Island Medical'],
  school: ['Elm Primary', 'Northgate High', 'Hilltop School', 'Southvale Academy', 'Ashton Elementary', 'Reef School'],
  tower: ['Cell site'],
  factory: ['Portsea Container Terminal', 'Granite Works', 'Moor Wind Farm', 'Dunmore Creamery'],
  hotel: ['Lagoon Resort', 'Cove Inn', 'Palm Bay Hotel'],
};

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// ---------------------------------------------------------------- geometry helpers

export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

// Polyline in x/z for a link, endpoint to endpoint through its waypoints.
export function linkPath(world, link) {
  const a = world.byId[link.a], b = world.byId[link.b];
  return [[a.x, a.z], ...(link.via || []), [b.x, b.z]];
}

export function pathLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

// Evenly spaced samples along a polyline.
export function samplePath(pts, step = 1) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return out;
}

// ---------------------------------------------------------------- build

export function buildWorld() {
  const nodes = PLACED.map((n) => ({ ...n }));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const links = LINKS.map((l) => ({ ...l }));

  for (const [site, tier] of ROUTER_SITES) {
    const s = byId[site];
    const r = N('rtr_' + site, 'router', `${s.name.replace(/ (Central Office|PoP|hut)$/, '')} ${tier === 'core' ? 'core router' : 'aggregation router'}`,
      s.x, s.z, ['mpls'], { host: site, tier, role: tier === 'core' ? 'MPLS core (P/PE) router' : 'MPLS aggregation router' });
    nodes.push(r);
    byId[r.id] = r;
  }

  // Access: one street cabinet per site, endpoints fanned out around the town.
  const rand = rng(7);
  const used = {};
  const pick = (type) => {
    const list = NAMES[type];
    const i = (used[type] = (used[type] ?? -1) + 1);
    return type === 'tower' ? `Cell site ${i + 1}` : list[i % list.length];
  };
  for (const { site, city, ends } of ACCESS) {
    const s = byId[site], c = CITY[city];
    const away = Math.atan2(c.z - s.z, c.x - s.x);
    const cab = N(`acc_${site}`, 'access', `${c.name} access node`, 0, 0, ['access'], { role: 'Access aggregation for ' + c.name });
    placeNear(cab, c.x + Math.cos(away) * (c.r * 0.35), c.z + Math.sin(away) * (c.r * 0.35), c);
    nodes.push(cab); byId[cab.id] = cab;
    links.push(L('access', cab.id, site));
    ends.forEach((type, i) => {
      const ang = away + (i / ends.length) * Math.PI * 2 + rand() * 0.4;
      const rad = c.r + (type === 'tower' ? 6 : 2.5) + rand() * 3;
      const e = N(`end_${site}_${i}`, type, pick(type), 0, 0, ['access'], { role: ENDPOINT[type].label, gear: ENDPOINT[type].gear });
      placeNear(e, c.x + Math.cos(ang) * rad, c.z + Math.sin(ang) * rad, c);
      nodes.push(e); byId[e.id] = e;
      links.push(L('access', e.id, cab.id));
    });
  }

  // Inline amplifiers along the long backbone and DCI spans.
  for (const link of links) {
    if (link.layer !== 'backbone' && link.layer !== 'dci') continue;
    const pts = [[byId[link.a].x, byId[link.a].z], ...(link.via || []), [byId[link.b].x, byId[link.b].z]];
    const len = pathLength(pts);
    const n = Math.floor(len / 26);
    for (let k = 1; k <= n; k++) {
      const [x, z] = pointAt(pts, (k / (n + 1)) * len);
      const ila = N(`ila_${link.a}_${link.b}_${k}`, 'ila', 'In-line amplifier', x, z, [link.layer],
        { role: `Amplifier hut on ${byId[link.a].name} – ${byId[link.b].name}` });
      nodes.push(ila); byId[ila.id] = ila;
    }
  }

  // Submarine repeaters, every ~9 units along each sea path that is actually underwater.
  for (const link of links) {
    if (!link.sea) continue;
    const pts = [[byId[link.a].x, byId[link.a].z], ...link.via, [byId[link.b].x, byId[link.b].z]];
    const len = pathLength(pts);
    let k = 0;
    for (let d = 9; d < len - 4; d += 9) {
      const [x, z] = pointAt(pts, d);
      if (heightAt(x, z) > -3) continue;
      const rep = N(`rep_${link.a}_${link.b}_${k++}`, 'repeater', 'Undersea repeater', x, z, ['submarine'],
        { role: `Repeater on the ${link.name}` });
      nodes.push(rep); byId[rep.id] = rep;
    }
  }

  for (const n of nodes) {
    n.gear = n.gear || gearFor(n);
    n.links = [];
  }
  links.forEach((l, i) => {
    l.id = 'link' + i;
    byId[l.a].links.push(l.id);
    byId[l.b].links.push(l.id);
  });

  return { nodes, links, byId, cities: CITIES, layers: LAYERS };

  // Walk toward the town centre until the spot is dry land.
  function placeNear(n, x, z, c) {
    for (let i = 0; i < 30 && heightAt(x, z) < 0.6; i++) {
      x += (c.x - x) * 0.15;
      z += (c.z - z) * 0.15;
    }
    n.x = x; n.z = z;
  }
}

function pointAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= seg) {
      const t = d / seg;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
    d -= seg;
  }
  return pts[pts.length - 1];
}

function gearFor(n) {
  switch (n.type) {
    case 'dc': return 'Ciena Waveserver 5 with WaveLogic 6 Extreme';
    case 'pop': return 'Ciena 6500 Packet-Optical with RLS ROADMs';
    case 'regional': return 'Ciena 6500 Packet-Optical';
    case 'ila': return 'Ciena RLS line amplifier';
    case 'cls': return 'Ciena GeoMesh Extreme submarine line terminal';
    case 'repeater': return 'Submarine optical repeater';
    case 'edge': return 'Off-map cable segment';
    case 'router': return n.tier === 'core' ? 'Ciena 8100 Coherent Router' : 'Ciena 5100 series router';
    case 'access': return 'Ciena 5100 series access router';
    default: return '';
  }
}
