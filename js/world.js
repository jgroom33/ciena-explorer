// The world of Netlandia: terrain, places and every network, as plain data.
// No three.js in here, so the tests can check it under node.

// The map is drawn flat in x/z and then wrapped onto a small planet: an azimuthal
// equidistant projection around the map centre, so distance from (0, 0) on the
// map is arc length on the planet. Everything far from the centre is the back side.
export const PLANET_R = 100;
export const SEA_FLOOR = -6;
// The part of the flat map that holds the home country.
export const BOARD = { x0: -130, x1: 130, z0: -88, z1: 88 };

// Flat (x, z) -> unit vector from the planet centre. Map centre is +Z, map north (-z) is +Y.
export function flatToDir(x, z) {
  const r = Math.hypot(x, z);
  const s = r > 1e-9 ? Math.sin(r / PLANET_R) / r : 1 / PLANET_R;
  return [x * s, -z * s, Math.cos(r / PLANET_R)];
}
export function dirToFlat(a, b, c) {
  const th = Math.acos(Math.max(-1, Math.min(1, c)));
  const st = Math.sin(th);
  if (st < 1e-9) return th < 1 ? [0, 0] : [0, Math.PI * PLANET_R];
  const k = (th * PLANET_R) / st;
  return [a * k, -b * k];
}
// How much the map is squeezed sideways at a point: 1 at the centre, ~0.55 at the far islands.
export function squeeze(x, z) {
  const th = Math.hypot(x, z) / PLANET_R;
  return th < 1e-6 ? 1 : Math.sin(th) / th;
}

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

// Lands on the far side of the planet are round caps measured on the sphere itself,
// so the projection does not stretch them: [flat x, flat z, angular radius].
export const CAPS = [
  { id: 'farland', at: [158, 70], r: 0.26 },
  { id: 'westerland', at: [-160, 52], r: 0.21 },
  { id: 'antipoda', at: [-150, 228], r: 0.12 },
  { id: 'north-ice', at: [0, -Math.PI * PLANET_R / 2], r: 0.3, ice: true },
  { id: 'south-ice', at: [0, Math.PI * PLANET_R / 2], r: 0.24, ice: true },
].map((c) => ({ ...c, dir: flatToDir(...c.at) }));

// > 0 on land, < 0 at sea. Roughly the fraction of the way in from the coast.
export function landness(x, z) {
  let f = -Infinity;
  for (const [cx, cz, rx, rz] of BLOBS) {
    const dx = (x - cx) / rx, dz = (z - cz) / rz;
    f = Math.max(f, 1 - (dx * dx + dz * dz));
  }
  if (Math.hypot(x, z) > 110) {
    const d = flatToDir(x, z);
    for (const c of CAPS) {
      const ang = Math.acos(Math.min(1, d[0] * c.dir[0] + d[1] * c.dir[1] + d[2] * c.dir[2])) / c.r;
      f = Math.max(f, 1 - ang * ang);
    }
  }
  return f + fbm(x * 0.045, z * 0.045) * 0.14;
}

// True on the polar ice caps.
export function icy(x, z) {
  const d = flatToDir(x, z);
  return Math.abs(d[1]) > 0.93;
}

const MOUNTAINS = [
  [-88, -44, 16, 14],
  [-70, -56, 10, 9],
  [-100, -24, 10, 7],
  [104, -32, 6, 5],
];

function rawHeight(x, z) {
  const f = landness(x, z);
  if (f <= 0) return SEA_FLOOR * smoothstep(0, 0.5, -f) - 0.6 * (1 - smoothstep(0, 0.5, -f));
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
  if (Math.hypot(x, z) > 140 && icy(x, z)) return 0.9;   // flat polar ice sheets
  const base = Math.floor(h / STEP) * STEP;
  return Math.max(0.4, base + STEP * smoothstep(0.7, 1, (h - base) / STEP));
}

// ---------------------------------------------------------------- layers

export const LAYERS = [
  {
    id: 'dci', name: 'Data center interconnect', short: 'DCI', color: '#9b5de5',
    blurb: 'A ring of waves joining the four Capitalia data centers around downtown. The harbor campus hands its traffic to the subsea cables for Isla Verde and Farland.',
    gear: 'Ciena Waveserver with WaveLogic coherent optics',
  },
  {
    id: 'regional', name: 'Regional transport', short: 'Regional', color: '#ff8c1a',
    blurb: 'Rings through the western towns. Each ring starts on one backbone ROADM and ends on a different one, so neither a fibre cut nor a site failure cuts a town off.',
    gear: 'Ciena 6500 Packet-Optical',
  },
  {
    id: 'backbone', name: 'Countrywide RLS mesh', short: 'RLS mesh', color: '#e63946',
    blurb: 'A meshed line system across the middle of the country. Every ROADM site has at least three ways out, with amplifier huts along each span, and it lands on three of the Capitalia metro hubs.',
    gear: 'Ciena RLS (Reconfigurable Line System) with WaveLogic 6',
  },
  {
    id: 'submarine', name: 'Submarine cable', short: 'Submarine', color: '#ffc300',
    blurb: 'Cables on the sea floor between landing stations, with repeaters along the seabed, out to Isla Verde and over the horizon to Farland and Westerland.',
    gear: 'Ciena GeoMesh Extreme submarine networking',
  },
  {
    id: 'mpls', name: 'MPLS transport', short: 'MPLS', color: '#2f80ed',
    blurb: 'The packet layer over the Capitalia metro: four hub routers in a full mesh of label-switched paths, drawn as arcs in the sky, with a path across to Isla Verde.',
    gear: 'Ciena 8100 Coherent Routers and 5100 series routers',
  },
  {
    id: 'access', name: 'Access network', short: 'Access', color: '#ff4fa3',
    blurb: 'Access rings that leave one hub, pass banks, offices, hospitals and cell towers, and come back into the next hub, so every customer has two ways home.',
    gear: 'Ciena 3900 / 5100 series access devices and NIDs',
  },
];
export const LAYER = Object.fromEntries(LAYERS.map((l) => [l.id, l]));

// ---------------------------------------------------------------- places
//
// The country is laid out in three bands so the networks don't sit on top of each other:
//   west   (x < -62)   regional rings through small towns
//   centre (-62..-10)  the countrywide RLS mesh between ROADM towns
//   east   (x > -5)    Capitalia: skyline, data centers, metro hubs, MPLS and access

export const METRO = { x: 20, z: 12 };   // downtown Capitalia

export const CITIES = [
  { id: 'capitalia', name: 'Capitalia', x: METRO.x, z: METRO.z, r: 12, big: true, tall: 1.2, dense: true },
  // west: regional ring towns
  { id: 'northgate', name: 'Northgate', x: -76, z: -36, r: 3.5, town: true },
  { id: 'ridgeway', name: 'Ridgeway', x: -98, z: -16, r: 3, town: true },
  { id: 'pinecrest', name: 'Pinecrest', x: -84, z: -2, r: 3, town: true },
  { id: 'westmoor', name: 'Westmoor', x: -96, z: 16, r: 3.5, town: true },
  { id: 'fernbank', name: 'Fernbank', x: -86, z: 36, r: 3, town: true },
  { id: 'elmford', name: 'Elmford', x: -62, z: 38, r: 3, town: true },
  // centre: ROADM towns
  { id: 'oakridge', name: 'Oakridge', x: -62, z: -22, r: 3, town: true },
  { id: 'lakeview', name: 'Lakeview', x: -60, z: 10, r: 3, town: true },
  { id: 'southvale', name: 'Southvale', x: -40, z: 32, r: 3, town: true },
  { id: 'midhill', name: 'Midhill', x: -38, z: -36, r: 3, town: true },
  { id: 'junction', name: 'Junction', x: -38, z: -2, r: 3, town: true },
  { id: 'cedargap', name: 'Cedar Gap', x: -14, z: -28, r: 3, town: true },
  { id: 'stonebridge', name: 'Stonebridge', x: -16, z: 0, r: 3, town: true },
  { id: 'millbrook', name: 'Millbrook', x: -16, z: 28, r: 3, town: true },
  // islands
  { id: 'isla', name: 'Isla Verde', x: 92, z: 6, r: 6, big: true, tall: 0.5 },
  { id: 'palmtown', name: 'Palmtown', x: 104, z: -26, r: 3, town: true },
  { id: 'reefside', name: 'Reefside', x: 86, z: 26, r: 3, town: true },
  { id: 'farland', name: 'Farland', x: 160, z: 72, r: 7, big: true, tall: 0.6, far: true },
  { id: 'westerland', name: 'Westerland', x: -162, z: 52, r: 5, tall: 0.4, far: true },
];
export const CITY = Object.fromEntries(CITIES.map((c) => [c.id, c]));

// Hand-placed equipment. Access endpoints, amplifiers and repeaters are generated below.
const N = (id, type, name, x, z, layers, extra = {}) => ({ id, type, name, x, z, layers, ...extra });
const ROADM = (id, town, x, z) => N(id, 'pop', `${CITY[town].name} ROADM`, x, z, ['backbone'], { role: 'RLS ROADM site in the countrywide mesh' });
const HUB = (id, name, x, z) => N(id, 'hub', name, x, z, ['mpls', 'backbone', 'access'], { role: 'Capitalia metro hub: where the RLS mesh, MPLS core and access rings meet' });
const HUT = (id, town, x, z, ring) => N(id, 'regional', `${CITY[town].name} hut`, x, z, ['regional'], { role: `Ring site on the ${ring} ring` });

const PLACED = [
  // Capitalia: four data centers on a ring around downtown, four metro hubs between them
  N('dc_nw', 'dc', 'Capitalia DC North-West', 7, -9, ['dci'], { role: 'Colocation campus' }),
  N('dc_ne', 'dc', 'Capitalia DC North-East', 32, -8, ['dci'], { role: 'Cloud on-ramp campus' }),
  N('dc_se', 'dc', 'Capitalia Harbor DC', 31, 32, ['dci'], { role: 'Carrier hotel next to the cable landing', size: 1.2 }),
  N('dc_sw', 'dc', 'Capitalia DC South-West', 7, 33, ['dci'], { role: 'Enterprise campus' }),
  HUB('hub_n', 'Capitalia North hub', 19, -14),
  HUB('hub_e', 'Capitalia East hub', 37, 12),
  HUB('hub_s', 'Capitalia South hub', 20, 40),
  HUB('hub_w', 'Capitalia West hub', -3, 12),

  // the RLS mesh
  ROADM('bb_oak', 'oakridge', -62, -22),
  ROADM('bb_lake', 'lakeview', -60, 10),
  ROADM('bb_south', 'southvale', -40, 32),
  ROADM('bb_mid', 'midhill', -38, -36),
  ROADM('bb_junc', 'junction', -38, -2),
  ROADM('bb_cedar', 'cedargap', -14, -28),
  ROADM('bb_stone', 'stonebridge', -16, 0),
  ROADM('bb_mill', 'millbrook', -16, 28),

  // western regional rings
  HUT('reg_north', 'northgate', -76, -36, 'Highlands'),
  HUT('reg_ridge', 'ridgeway', -98, -16, 'Highlands'),
  HUT('reg_pine', 'pinecrest', -84, -2, 'Highlands'),
  HUT('reg_west', 'westmoor', -96, 16, 'Moorland'),
  HUT('reg_fern', 'fernbank', -86, 36, 'Moorland'),
  HUT('reg_elm', 'elmford', -62, 38, 'Moorland'),

  // Isla Verde
  N('pop_isla', 'pop', 'Isla Verde Central Office', 86, -2, ['backbone', 'regional'], { role: 'Island ROADM hub and ring head-end' }),
  HUT('reg_palm', 'palmtown', 100, -22, 'Isla Verde'),
  HUT('reg_reef', 'reefside', 84, 22, 'Isla Verde'),
  N('dc_isla', 'dc', 'Isla Verde DC', 96, 12, ['dci'], { role: 'Island edge data center' }),

  // cable landing stations
  N('cls_port', 'cls', 'Capitalia Landing Station', 39, 22, ['submarine'], { role: 'Lands the Isla Verde and Farland cables' }),
  N('cls_isla_w', 'cls', 'Isla West Landing Station', 74, 8, ['submarine'], { role: 'Lands the cable from Capitalia' }),
  N('cls_isla_s', 'cls', 'Isla South Landing Station', 94, 31, ['submarine'], { role: 'Lands the Farland trans-ocean cable' }),
  N('cls_west', 'cls', 'Westmoor Landing Station', -106, 14, ['submarine'], { role: 'Lands the Westerland cable' }),
  N('cls_far', 'cls', 'Farland Landing Station', 0, 0, ['submarine'], { role: 'Lands both trans-ocean cables from Netlandia', coastOf: 'farland', toward: [60, 40] }),
  N('cls_wester', 'cls', 'Westerland Landing Station', 0, 0, ['submarine'], { role: 'Lands the Westerland cable', coastOf: 'westerland', toward: [-106, 12] }),
  N('dc_far', 'dc', 'Farland Cloud Region', 168, 66, ['dci'], { role: 'Overseas cloud region reached over the trans-ocean cables' }),
];

// Routers float above the site that houses them.
const ROUTER_SITES = [['hub_n', 'core'], ['hub_e', 'core'], ['hub_s', 'core'], ['hub_w', 'core'], ['pop_isla', 'agg']];

// ---------------------------------------------------------------- links

const L = (layer, a, b, extra = {}) => ({ layer, a, b, ...extra });

const LINKS = [
  // DCI: a ring around downtown, plus the hand-off to the subsea cables
  L('dci', 'dc_nw', 'dc_ne'),
  L('dci', 'dc_ne', 'dc_se'),
  L('dci', 'dc_se', 'dc_sw'),
  L('dci', 'dc_sw', 'dc_nw'),
  L('dci', 'dc_se', 'cls_port', { note: 'Hands DCI waves to the Isla Verde and Farland cables' }),
  L('dci', 'dc_isla', 'cls_isla_w', { note: 'Picks up DCI waves from the Capitalia cable' }),
  L('dci', 'dc_far', 'cls_far', { note: 'DCI waves from Capitalia arrive here over the subsea cables' }),

  // the countrywide RLS mesh: every ROADM has three or more routes
  L('backbone', 'bb_oak', 'bb_mid'),
  L('backbone', 'bb_oak', 'bb_lake'),
  L('backbone', 'bb_oak', 'bb_junc'),
  L('backbone', 'bb_mid', 'bb_junc'),
  L('backbone', 'bb_mid', 'bb_cedar'),
  L('backbone', 'bb_lake', 'bb_junc'),
  L('backbone', 'bb_lake', 'bb_south'),
  L('backbone', 'bb_junc', 'bb_south'),
  L('backbone', 'bb_junc', 'bb_stone'),
  L('backbone', 'bb_cedar', 'bb_stone'),
  L('backbone', 'bb_south', 'bb_mill'),
  L('backbone', 'bb_stone', 'bb_mill'),
  // ...landing on the Capitalia metro hubs
  L('backbone', 'bb_cedar', 'hub_n'),
  L('backbone', 'bb_stone', 'hub_w'),
  L('backbone', 'bb_mill', 'hub_s'),
  L('backbone', 'hub_e', 'cls_port'),
  L('backbone', 'pop_isla', 'cls_isla_w'),
  L('backbone', 'pop_isla', 'cls_isla_s', { via: [[90, 16]] }),

  // regional rings, each homed on two different ROADMs
  L('regional', 'bb_oak', 'reg_north'),
  L('regional', 'reg_north', 'reg_ridge'),
  L('regional', 'reg_ridge', 'reg_pine'),
  L('regional', 'reg_pine', 'bb_lake'),
  L('regional', 'bb_lake', 'reg_west', { via: [[-78, 20]] }),
  L('regional', 'reg_west', 'reg_fern'),
  L('regional', 'reg_fern', 'reg_elm'),
  L('regional', 'reg_elm', 'bb_south'),
  L('regional', 'reg_west', 'cls_west'),
  L('regional', 'pop_isla', 'reg_palm'),
  L('regional', 'reg_palm', 'reg_reef', { via: [[112, 8]] }),
  L('regional', 'reg_reef', 'pop_isla', { via: [[80, 10]] }),

  // submarine
  L('submarine', 'cls_port', 'cls_isla_w', { sea: true, via: [[50, 30], [62, 22]], name: 'Capitalia – Isla Verde cable' }),
  L('submarine', 'cls_isla_s', 'cls_far', { sea: true, via: [[100, 48], [118, 60]], name: 'Isla – Farland trans-ocean cable' }),
  L('submarine', 'cls_west', 'cls_wester', { sea: true, via: [[-120, 22]], name: 'Westerland cable' }),
  L('submarine', 'cls_port', 'cls_far', { sea: true, via: [[46, 50], [90, 80], [120, 84]], name: 'Capitalia – Farland trans-ocean cable' }),

  // MPLS: the four metro hubs in a full mesh, and across to Isla Verde
  ...[
    ['hub_n', 'hub_e'], ['hub_e', 'hub_s'], ['hub_s', 'hub_w'], ['hub_w', 'hub_n'], ['hub_n', 'hub_s'], ['hub_e', 'hub_w'],
    ['hub_e', 'pop_isla'],
  ].map(([a, b]) => L('mpls', 'rtr_' + a, 'rtr_' + b)),
];

// ---------------------------------------------------------------- access
//
// Access rings: leave one site, pass each customer in turn, come back into another
// (or the same) site. Downtown, four petals run hub to hub between the skyscrapers.

const ACCESS_RINGS = [
  { from: 'hub_n', to: 'hub_e', stops: [['office', 24, -3], ['bank', 30, 3]] },
  { from: 'hub_e', to: 'hub_s', stops: [['hospital', 29, 20], ['tower', 24, 27]] },
  { from: 'hub_s', to: 'hub_w', stops: [['school', 14, 28], ['bank', 8, 21]] },
  { from: 'hub_w', to: 'hub_n', stops: [['bank', 9, 4], ['office', 15, -2]] },
  { from: 'reg_pine', to: 'reg_west', stops: [['tower', -94, 3], ['factory', -104, 8]] },
  { from: 'reg_elm', to: 'reg_fern', stops: [['tower', -70, 28], ['school', -80, 26]] },
  { from: 'reg_north', to: 'reg_ridge', stops: [['tower', -70, -50], ['tower', -88, -54]] },
  { from: 'pop_isla', to: 'reg_reef', stops: [['hotel', 101, 6], ['tower', 99, 22]] },
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
  hospital: ['Capitalia General Hospital', 'Island Medical'],
  school: ['Capitalia Academy', 'Elmford Primary', 'Reef School', 'Northgate High'],
  tower: ['Cell site'],
  factory: ['Moor Wind Farm', 'Granite Works'],
  hotel: ['Lagoon Resort', 'Cove Inn', 'Palm Bay Hotel'],
};


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
  for (const n of nodes) if (n.coastOf) Object.assign(n, coastPoint(CITY[n.coastOf], n.toward));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const links = LINKS.map((l) => ({ ...l }));

  for (const [site, tier] of ROUTER_SITES) {
    const s = byId[site];
    const r = N('rtr_' + site, 'router', `${s.name.replace(/ (Central Office|hub)$/, '')} ${tier === 'core' ? 'core router' : 'aggregation router'}`,
      s.x, s.z, ['mpls'], { host: site, tier, role: tier === 'core' ? 'MPLS core (P/PE) router' : 'MPLS aggregation router' });
    nodes.push(r);
    byId[r.id] = r;
  }

  // Access rings: one node per customer, chained from site to site.
  const used = {};
  const pick = (type) => {
    const i = (used[type] = (used[type] ?? -1) + 1);
    return type === 'tower' ? `Cell site ${i + 1}` : NAMES[type][i % NAMES[type].length];
  };
  ACCESS_RINGS.forEach(({ from, to, stops }, r) => {
    let prev = from;
    stops.forEach(([type, x, z], i) => {
      const e = N(`end_${r}_${i}`, type, pick(type), x, z, ['access'], { role: ENDPOINT[type].label, gear: ENDPOINT[type].gear });
      nodes.push(e); byId[e.id] = e;
      links.push(L('access', prev, e.id));
      prev = e.id;
    });
    links.push(L('access', prev, to));
  });

  // RLS line amplifiers along the countrywide spans.
  for (const link of links) {
    if (link.layer !== 'backbone') continue;
    const pts = [[byId[link.a].x, byId[link.a].z], ...(link.via || []), [byId[link.b].x, byId[link.b].z]];
    const len = pathLength(pts);
    const n = Math.floor(len / 15);
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
}

// Last dry spot walking from a town toward a point at sea.
function coastPoint(c, [tx, tz]) {
  let x = c.x, z = c.z;
  const len = Math.hypot(tx - x, tz - z), ux = (tx - x) / len, uz = (tz - z) / len;
  while (heightAt(x + ux * 1.5, z + uz * 1.5) >= 0.6) { x += ux * 0.5; z += uz * 0.5; }
  return { x, z };
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
    case 'pop': return 'Ciena RLS ROADM with WaveLogic 6 transponders';
    case 'hub': return 'Ciena 6500 Packet-Optical and RLS, 8100 router';
    case 'regional': return 'Ciena 6500 Packet-Optical';
    case 'ila': return 'Ciena RLS line amplifier';
    case 'cls': return 'Ciena GeoMesh Extreme submarine line terminal';
    case 'repeater': return 'Submarine optical repeater';
    case 'router': return n.tier === 'core' ? 'Ciena 8100 Coherent Router' : 'Ciena 5100 series router';
    case 'access': return 'Ciena 5100 series access router';
    default: return '';
  }
}

// ---------------------------------------------------------------- major networks
//
// The globe offers three networks to open; everything else on it is scenery.
// Each major owns a set of links, and with them the sites at their ends and the
// amplifiers or repeaters along them.

export const MAJORS = [
  {
    id: 'submarine', name: 'Submarine network', color: LAYER.submarine.color, layers: ['submarine'],
    blurb: 'Cables on the sea floor from the Capitalia, Isla Verde and Westmoor landing stations, out to Isla Verde and over the horizon to Farland and Westerland, with repeaters spaced along the seabed.',
    owns: (l) => l.layer === 'submarine',
  },
  {
    id: 'longhaul', name: 'Long-haul RLS mesh', color: LAYER.backbone.color, layers: ['backbone'],
    blurb: 'The countrywide line system: eight ROADM sites in a mesh, every one with three or more routes, amplifier huts along each span, landing on three Capitalia metro hubs.',
    owns: (l, w) => l.layer === 'backbone' && ![l.a, l.b].some((id) => w.byId[id].type === 'cls' || w.byId[id].x > 60),
  },
  {
    id: 'metro', name: 'Capitalia metro', color: '#2f80ed', layers: ['dci', 'mpls', 'access'],
    blurb: 'Downtown Capitalia: four data centers on a DCI ring, four metro hubs in a full MPLS mesh, and access rings that loop past banks, offices, a hospital, a school and a cell tower from one hub to the next.',
    owns: (l, w) => ['dci', 'mpls', 'access'].includes(l.layer) &&
      [l.a, l.b].every((id) => Math.hypot(w.byId[id].x - METRO.x, w.byId[id].z - METRO.z) < 36),
  },
];
export const MAJOR = Object.fromEntries(MAJORS.map((m) => [m.id, m]));

// For each major: the link ids it owns and every node id that belongs in its own view.
export function majorParts(world) {
  const parts = {};
  for (const m of MAJORS) {
    const links = world.links.filter((l) => m.owns(l, world));
    const nodes = new Set();
    for (const l of links) {
      nodes.add(l.a); nodes.add(l.b);
      for (const n of world.nodes) {
        if (n.id.startsWith(`ila_${l.a}_${l.b}_`) || n.id.startsWith(`rep_${l.a}_${l.b}_`)) nodes.add(n.id);
      }
    }
    // routers stand on their host sites, so bring the hosts along
    for (const id of [...nodes]) if (world.byId[id].host) nodes.add(world.byId[id].host);
    parts[m.id] = { links: links.map((l) => l.id), nodes: [...nodes] };
  }
  return parts;
}
