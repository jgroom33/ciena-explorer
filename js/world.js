// The world of Netlandia: terrain, places and every network, as plain data.
// No three.js in here, so the tests can check it under node.

// A small planet with a country on each face. Side A (facing +Z) is Photonia and
// carries the transport networks; side B (facing -Z) is Packetland and carries the
// data network. Each side is drawn on its own flat map in x/z and wrapped onto its
// hemisphere with an azimuthal equidistant projection: distance from that side's
// (0, 0) is arc length on the planet. Map north (-z) is +Y on both sides.
export const PLANET_R = 100;
export const SEA_FLOOR = -6;
const EDGE = (Math.PI / 2) * PLANET_R;   // flat radius of each side's rim

export const SIDES = [
  { id: 0, key: 'A', name: 'Transport', land: 'Photonia', home: [-32, 8] },
  { id: 1, key: 'B', name: 'Data network', land: 'Packetland', home: [2, 6] },
];

// Flat (x, z) on a side -> unit vector from the planet centre.
export function flatToDir(x, z, side = 0) {
  const r = Math.hypot(x, z);
  const s = r > 1e-9 ? Math.sin(r / PLANET_R) / r : 1 / PLANET_R;
  const a = x * s, b = -z * s, c = Math.cos(r / PLANET_R);
  return side ? [-a, b, -c] : [a, b, c];
}
// Unit vector -> [x, z, side] on whichever side's map it falls.
export function dirToFlat(a, b, c) {
  const side = c >= 0 ? 0 : 1;
  if (side) { a = -a; c = -c; }
  const th = Math.acos(Math.max(-1, Math.min(1, c)));
  const st = Math.sin(th);
  if (st < 1e-9) return [0, 0, side];
  const k = (th * PLANET_R) / st;
  return [a * k, -b * k, side];
}
// How much a side's map is squeezed sideways at a point: 1 at its centre, ~0.64 at its rim.
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

// Each blob is an ellipse of land on one side's map; the coast is where the best blob reaches zero.
const BLOBS = [
  [
    [-50, 0, 62, 50],    // Photonia: western heartland
    [-5, 12, 48, 42],    //   eastern lowlands, Lumen City
    [-78, -35, 32, 28],  //   northern highlands
    [-15, -40, 42, 26],  //   Raman Ridge plateau
    [95, 2, 24, 34],     // Coherent Isle
    [108, -30, 14, 14],  //   Palm Point
  ],
  [
    [0, 0, 62, 48],      // Packetland: the heartland around Coreburg
    [-40, 16, 34, 30],   //   Gateway Bay lobe
    [32, -22, 36, 30],   //   Edgewater highlands
    [38, 30, 22, 18],    //   Framefield peninsula
    [-8, -34, 36, 20],   //   Northport coast
  ],
];

// Polar ice: round caps measured on the sphere, shared by both sides.
const ICE = [{ dir: [0, 1, 0], r: 0.3 }, { dir: [0, -1, 0], r: 0.24 }];

// > 0 on land, < 0 at sea. Roughly the fraction of the way in from the coast.
export function landness(x, z, side = 0) {
  let f = -Infinity;
  for (const [cx, cz, rx, rz] of BLOBS[side]) {
    const dx = (x - cx) / rx, dz = (z - cz) / rz;
    f = Math.max(f, 1 - (dx * dx + dz * dz));
  }
  if (Math.hypot(x, z) > 110) {
    const d = flatToDir(x, z, side);
    for (const c of ICE) {
      const ang = Math.acos(Math.min(1, d[0] * c.dir[0] + d[1] * c.dir[1] + d[2] * c.dir[2])) / c.r;
      f = Math.max(f, 1 - ang * ang);
    }
  }
  return f + fbm(x * 0.045 + side * 37.1, z * 0.045 - side * 11.3) * 0.14;
}

// True on the polar ice caps.
export function icy(x, z, side = 0) {
  return Math.abs(flatToDir(x, z, side)[1]) > 0.93;
}

const MOUNTAINS = [
  [[-88, -44, 16, 14], [-70, -56, 10, 9], [-100, -24, 10, 7], [104, -32, 6, 5]],
  [[36, -36, 13, 10], [52, -30, 9, 7], [-18, -46, 7, 6]],
];

function rawHeight(x, z, side) {
  const f = landness(x, z, side);
  if (f <= 0) return SEA_FLOOR * smoothstep(0, 0.5, -f) - 0.6 * (1 - smoothstep(0, 0.5, -f));
  let h = 0.4 + smoothstep(0, 0.25, f) * 2.2 + Math.max(0, fbm(x * 0.06 + 7 + side * 50, z * 0.06 - 3)) * 5;
  for (const [mx, mz, mh, s] of MOUNTAINS[side]) {
    const d2 = ((x - mx) ** 2 + (z - mz) ** 2) / (s * s);
    h += mh * Math.exp(-d2);
  }
  return h;
}

// Terraced, so the hills read as toy-like steps.
const STEP = 1.6;
export function heightAt(x, z, side = 0) {
  const h = rawHeight(x, z, side);
  if (h <= 0.4) return h;
  if (Math.hypot(x, z) > 120 && icy(x, z, side)) return 0.9;   // flat polar ice sheets
  const base = Math.floor(h / STEP) * STEP;
  return Math.max(0.4, base + STEP * smoothstep(0.7, 1, (h - base) / STEP));
}
// Height under a point given as a direction from the planet centre.
export const heightDir = (a, b, c) => heightAt(...dirToFlat(a, b, c));

// ---------------------------------------------------------------- layers
//
// Transport layers live on side A and are drawn as solid fibre. Data layers live on
// side B and are drawn as dashed packet links.

export const LAYERS = [
  {
    id: 'submarine', side: 0, name: 'Submarine cable', short: 'Submarine', color: '#ffc300',
    blurb: 'Cables on the sea floor between landing stations, with repeaters along the seabed.',
    gear: 'Ciena GeoMesh Extreme submarine networking',
  },
  {
    id: 'backbone', side: 0, name: 'Countrywide RLS mesh', short: 'RLS mesh', color: '#e63946',
    blurb: 'A meshed line system across the middle of Photonia.',
    gear: 'Ciena RLS (Reconfigurable Line System) with WaveLogic 6',
  },
  {
    id: 'metro', side: 0, name: 'Metro optical ring', short: 'Metro optical', color: '#14b8a6',
    blurb: 'A packet-optical ring joining the four Lumen City metro hubs.',
    gear: 'Ciena RLS with WaveLogic 5 Nano',
  },
  {
    id: 'dci', side: 0, name: 'Data center interconnect', short: 'DCI', color: '#9b5de5',
    blurb: 'Point-to-point waves between data center campuses.',
    gear: 'Ciena Waveserver with WaveLogic 6 Extreme',
  },
  {
    id: 'regional', side: 0, name: 'Regional transport', short: 'Regional', color: '#ff8c1a',
    blurb: 'Rings through the western towns, each homed on two ROADMs.',
    gear: 'Ciena RLS',
  },
  {
    id: 'ipcore', side: 1, data: true, name: 'IP/MPLS core', short: 'IP core', color: '#2f80ed',
    blurb: 'The core routers of the data network.',
    gear: 'Ciena 8100 Coherent Routers',
  },
  {
    id: 'agg', side: 1, data: true, name: 'Metro aggregation', short: 'Aggregation', color: '#7b2cbf',
    blurb: 'Segment-routed aggregation rings that collect traffic from the edge.',
    gear: 'Ciena 5100 series aggregation routers',
  },
  {
    id: 'access', side: 1, data: true, name: 'Business access', short: 'Business', color: '#ff4fa3',
    blurb: 'Ethernet services to banks, offices, a hospital and a school.',
    gear: 'Ciena 3900 series NIDs and 5100 series routers',
  },
  {
    id: 'xhaul', side: 1, data: true, name: '5G mobile xhaul', short: '5G xhaul', color: '#00a6d6',
    blurb: 'Cell sites on rings back to pre-aggregation hubs and the 5G core.',
    gear: 'Ciena 5164 and 5166 cell-site and pre-aggregation routers',
  },
];
export const LAYER = Object.fromEntries(LAYERS.map((l) => [l.id, l]));

// ---------------------------------------------------------------- places
//
// Side A, Photonia, is laid out in three bands so the networks don't pile up:
//   west   (x < -62)   regional rings through the Glass Highlands and Lightmoor
//   centre (-62..-10)  the Wavelands: the countrywide RLS mesh between ROADM towns
//   east   (x > -5)    Lumen City: skyline, data centers, metro hubs on an optical ring
// Side B, Packetland, has Coreburg in the middle with the IP core around it, the
// aggregation ring hugging the city and the 5G xhaul ring out in the countryside.

export const METRO = { x: 20, z: 12 };      // downtown Lumen City, side A
export const COREBURG = { x: 0, z: 0 };     // downtown Coreburg, side B

const C = (id, name, x, z, r, extra = {}) => ({ id, name, x, z, r, side: 0, ...extra });
export const CITIES = [
  C('capitalia', 'Lumen City', METRO.x, METRO.z, 12, { big: true, tall: 1.2, dense: true }),
  C('northgate', 'Lensgate', -76, -36, 3.5, { town: true }),
  C('ridgeway', 'Mirror Ridge', -98, -16, 3, { town: true }),
  C('pinecrest', 'Halo Crest', -84, -2, 3, { town: true }),
  C('westmoor', 'Lightmoor', -96, 16, 3.5, { town: true }),
  C('fernbank', 'Flarebank', -86, 36, 3, { town: true }),
  C('elmford', 'Filterford', -62, 38, 3, { town: true }),
  C('oakridge', 'Prismfield', -62, -22, 3, { town: true }),
  C('lakeview', 'Lambdaview', -60, 10, 3, { town: true }),
  C('southvale', 'Spectraville', -40, 32, 3, { town: true }),
  C('midhill', 'Raman Ridge', -38, -36, 3, { town: true }),
  C('junction', 'Crosspoint', -38, -2, 3, { town: true }),
  C('cedargap', 'Erbium Gap', -14, -28, 3, { town: true }),
  C('stonebridge', 'Glassbridge', -16, 0, 3, { town: true }),
  C('millbrook', 'Beambrook', -16, 28, 3, { town: true }),
  C('isla', 'Coherent Isle', 92, 6, 6, { big: true, tall: 0.5 }),
  C('palmtown', 'Beacon Point', 104, -26, 3, { town: true }),
  C('reefside', 'Amp Reef', 86, 26, 3, { town: true }),
  // side B
  C('coreburg', 'Coreburg', COREBURG.x, COREBURG.z, 11, { side: 1, big: true, tall: 1.1, dense: true }),
  C('gateway', 'Gateway Bay', -50, 18, 5, { side: 1, big: true, tall: 0.5 }),
  C('edgewater', 'Edgewater', 48, -22, 5, { side: 1, tall: 0.45 }),
  C('northport', 'Northport', -14, -36, 3, { side: 1, town: true }),
  C('southfield', 'Framefield', 34, 32, 3.5, { side: 1, town: true }),
  C('leafdale', 'Leafdale', -26, 36, 3, { side: 1, town: true }),
  C('spinehill', 'Spinehill', 20, -42, 3, { side: 1, town: true }),
  C('brightwater', 'Labelbrook', -38, -16, 3, { side: 1, town: true }),
];
export const CITY = Object.fromEntries(CITIES.map((c) => [c.id, c]));

// Hand-placed equipment. Access endpoints, amplifiers and repeaters are generated below.
const N = (id, type, name, x, z, layers, extra = {}) => ({ id, type, name, x, z, layers, side: 0, ...extra });
const NB = (id, type, name, x, z, layers, extra = {}) => N(id, type, name, x, z, layers, { side: 1, ...extra });
const ROADM = (id, town, x, z) => N(id, 'pop', `${CITY[town].name} ROADM`, x, z, ['backbone'], { role: 'RLS ROADM site in the countrywide mesh' });
const HUB = (id, name, x, z) => N(id, 'hub', name, x, z, ['metro', 'backbone'], { role: 'Lumen City metro hub, where the RLS mesh meets the metro optical ring' });
const HUT = (id, town, x, z, ring) => N(id, 'regional', `${CITY[town].name} hut`, x, z, ['regional'], { role: `Ring site on the ${ring} ring` });
const CORE = (id, name, x, z, role) => NB(id, 'core', name, x, z, ['ipcore'], { role });
const AGG = (id, name, x, z) => NB(id, 'agg', name, x, z, ['agg'], { role: 'Aggregation router on a segment-routed ring' });
const XHUB = (id, town, x, z) => NB(id, 'xhub', `${CITY[town].name} pre-aggregation`, x, z, ['xhaul'], { role: 'Collects the cell sites on its stretch of the 5G ring' });

const PLACED = [
  // ---- side A: transport
  N('dc_nw', 'dc', 'Lumen City DC North-West', 7, -9, ['dci'], { role: 'Colocation campus' }),
  N('dc_ne', 'dc', 'Lumen City DC North-East', 32, -8, ['dci'], { role: 'Cloud on-ramp campus' }),
  N('dc_se', 'dc', 'Lumen City Harbor DC', 31, 32, ['dci'], { role: 'Carrier hotel next to the cable landing', size: 1.2 }),
  N('dc_sw', 'dc', 'Lumen City DC South-West', 7, 33, ['dci'], { role: 'Enterprise campus' }),
  HUB('hub_n', 'Lumen City North hub', 19, -14),
  HUB('hub_e', 'Lumen City East hub', 37, 12),
  HUB('hub_s', 'Lumen City South hub', 20, 40),
  HUB('hub_w', 'Lumen City West hub', -3, 12),

  ROADM('bb_oak', 'oakridge', -62, -22),
  ROADM('bb_lake', 'lakeview', -60, 10),
  ROADM('bb_south', 'southvale', -40, 32),
  ROADM('bb_mid', 'midhill', -38, -36),
  ROADM('bb_junc', 'junction', -38, -2),
  ROADM('bb_cedar', 'cedargap', -14, -28),
  ROADM('bb_stone', 'stonebridge', -16, 0),
  ROADM('bb_mill', 'millbrook', -16, 28),

  HUT('reg_north', 'northgate', -76, -36, 'Glass Highlands'),
  HUT('reg_ridge', 'ridgeway', -98, -16, 'Glass Highlands'),
  HUT('reg_pine', 'pinecrest', -84, -2, 'Glass Highlands'),
  HUT('reg_west', 'westmoor', -96, 16, 'Lightmoor'),
  HUT('reg_fern', 'fernbank', -86, 36, 'Lightmoor'),
  HUT('reg_elm', 'elmford', -62, 38, 'Lightmoor'),

  N('pop_isla', 'pop', 'Coherent Isle Central Office', 86, -2, ['backbone', 'regional'], { role: 'Island ROADM hub and ring head-end' }),
  HUT('reg_palm', 'palmtown', 100, -22, 'Coherent Isle'),
  HUT('reg_reef', 'reefside', 84, 22, 'Coherent Isle'),
  N('dc_isla', 'dc', 'Coherent Isle DC', 96, 12, ['dci'], { role: 'Island edge data center' }),

  N('cls_port', 'cls', 'Lumen City Landing Station', 39, 22, ['submarine'], { role: 'Lands the Coherent Isle and Framefield cables' }),
  N('cls_isla_w', 'cls', 'Coherent Isle West Landing Station', 74, 8, ['submarine'], { role: 'Lands the cable from Lumen City' }),
  N('cls_isla_s', 'cls', 'Coherent Isle South Landing Station', 94, 31, ['submarine'], { role: 'Lands the cable to Gateway Bay' }),
  N('cls_west', 'cls', 'Lightmoor Landing Station', -106, 14, ['submarine'], { role: 'Lands the cable to Edgewater' }),

  // ---- side B: data network
  CORE('cr_c1', 'Coreburg core 1', -7, -7, 'Core router, one of the redundant pair in Coreburg'),
  CORE('cr_c2', 'Coreburg core 2', 7, 7, 'Core router, one of the redundant pair in Coreburg'),
  CORE('cr_gw', 'Gateway Bay core', -46, 12, 'Core router at the coast, next to the internet exchange'),
  CORE('cr_north', 'Northport core', -12, -32, 'Core router for the north coast'),
  CORE('cr_edge', 'Edgewater core', 44, -18, 'Core router for the east'),
  CORE('cr_south', 'Framefield core', 30, 28, 'Core router for the south'),
  NB('ixp_gw', 'ixp', 'Gateway Bay Internet Exchange', -58, 6, ['ipcore'], { role: 'Peering with content and cloud networks' }),
  NB('dc_cloud', 'dc', 'Coreburg Cloud DC', -16, 15, ['ipcore'], { role: 'Cloud region, dual-homed to both Coreburg core routers' }),
  NB('dc_5gc', 'dc', 'Coreburg 5G Core', 24, -10, ['ipcore'], { role: 'Mobile core: user plane and control plane for the 5G network' }),

  AGG('ag_w', 'Coreburg West aggregation', -17, -8),
  AGG('ag_n', 'Coreburg North aggregation', 7, -18),
  AGG('ag_e', 'Coreburg East aggregation', 19, 5),
  AGG('ag_s', 'Coreburg South aggregation', 4, 19),

  XHUB('xh_bright', 'brightwater', -38, -16),
  XHUB('xh_spine', 'spinehill', 20, -42),
  XHUB('xh_east', 'edgewater', 54, -6),
  XHUB('xh_south', 'southfield', 40, 36),
  XHUB('xh_leaf', 'leafdale', -26, 36),

  NB('cls_gw', 'cls', 'Gateway Bay Landing Station', 0, 0, ['submarine'], { role: 'Lands the cable from Coherent Isle', coastOf: 'gateway', toward: [-120, 10] }),
  NB('cls_south', 'cls', 'Framefield Landing Station', 0, 0, ['submarine'], { role: 'Lands the cable from Lumen City', coastOf: 'southfield', toward: [60, 80] }),
  NB('cls_edge', 'cls', 'Edgewater Landing Station', 0, 0, ['submarine'], { role: 'Lands the cable from Lightmoor', coastOf: 'edgewater', toward: [120, -20] }),
];

// ---------------------------------------------------------------- links

const L = (layer, a, b, extra = {}) => ({ layer, a, b, ...extra });

const LINKS = [
  // ---- side A: transport
  L('dci', 'dc_nw', 'dc_ne'),
  L('dci', 'dc_ne', 'dc_se'),
  L('dci', 'dc_se', 'dc_sw'),
  L('dci', 'dc_sw', 'dc_nw'),
  L('dci', 'dc_se', 'cls_port', { note: 'Hands DCI waves to the subsea cables' }),
  L('dci', 'dc_isla', 'cls_isla_w', { note: 'Picks up DCI waves from the Lumen City cable' }),

  L('metro', 'hub_n', 'hub_e'),
  L('metro', 'hub_e', 'hub_s', { via: [[27, 24]] }),
  L('metro', 'hub_s', 'hub_w'),
  L('metro', 'hub_w', 'hub_n'),
  L('metro', 'hub_e', 'cls_port'),

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
  L('backbone', 'bb_cedar', 'hub_n'),
  L('backbone', 'bb_stone', 'hub_w'),
  L('backbone', 'bb_mill', 'hub_s'),
  L('backbone', 'pop_isla', 'cls_isla_w'),
  L('backbone', 'pop_isla', 'cls_isla_s', { via: [[90, 16]] }),

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

  // submarine: one cable within Photonia, three that wrap round the planet to Packetland.
  // Waypoints on a cross-side cable carry their side: [x, z, side].
  L('submarine', 'cls_port', 'cls_isla_w', { sea: true, via: [[50, 30], [62, 22]], name: 'Lumen City – Coherent Isle cable' }),
  L('submarine', 'cls_isla_s', 'cls_gw', { sea: true, cross: true, via: [[112, 52, 0], [-118, 40, 1]], name: 'Coherent Isle – Gateway Bay cable' }),
  L('submarine', 'cls_port', 'cls_south', { sea: true, cross: true, via: [[52, 56, 0], [110, 96, 0], [-60, 96, 1], [30, 68, 1]], name: 'Lumen City – Framefield cable' }),
  L('submarine', 'cls_west', 'cls_edge', { sea: true, cross: true, via: [[-128, 30, 0], [116, 10, 1]], name: 'Lightmoor – Edgewater cable' }),

  // ---- side B: data network
  // IP core: a mesh, every router with three or more neighbours
  L('ipcore', 'cr_c1', 'cr_c2'),
  L('ipcore', 'cr_c1', 'cr_gw'),
  L('ipcore', 'cr_c1', 'cr_north'),
  L('ipcore', 'cr_c2', 'cr_edge'),
  L('ipcore', 'cr_c2', 'cr_south'),
  L('ipcore', 'cr_gw', 'cr_north', { via: [[-40, -20]] }),
  L('ipcore', 'cr_north', 'cr_edge', { via: [[16, -30]] }),
  L('ipcore', 'cr_edge', 'cr_south', { via: [[48, 12]] }),
  L('ipcore', 'cr_south', 'cr_gw', { via: [[-12, 30]] }),
  L('ipcore', 'cr_gw', 'ixp_gw'),
  L('ipcore', 'cr_c1', 'dc_cloud'),
  L('ipcore', 'cr_c2', 'dc_cloud'),
  L('ipcore', 'cr_c2', 'dc_5gc'),
  L('ipcore', 'cr_edge', 'dc_5gc'),

  // aggregation: a ring around Coreburg, homed on both core routers
  L('agg', 'ag_w', 'ag_n'),
  L('agg', 'ag_n', 'ag_e'),
  L('agg', 'ag_e', 'ag_s'),
  L('agg', 'ag_s', 'ag_w'),
  L('agg', 'ag_w', 'cr_c1'),
  L('agg', 'ag_e', 'cr_c2'),

  // 5G xhaul: hubs on a ring round the countryside, uplinked into the core at two points
  L('xhaul', 'xh_bright', 'cr_gw', { via: [[-50, -4]] }),
  L('xhaul', 'xh_east', 'cr_edge'),
];

// ---------------------------------------------------------------- access
//
// Rings of customers: leave one site, pass each customer in turn, come back into
// another site, so every customer has two ways home.

const ACCESS_RINGS = [
  // business access in Coreburg, between aggregation routers
  { layer: 'access', from: 'ag_n', to: 'ag_e', stops: [['office', 9, -9], ['bank', 14, -4]] },
  { layer: 'access', from: 'ag_s', to: 'ag_w', stops: [['hospital', -5, 12], ['school', -11, 4]] },
  { layer: 'access', from: 'ag_e', to: 'ag_s', stops: [['office', 14, 8], ['bank', 10, 13]] },
  // the 5G ring: cell sites between pre-aggregation hubs
  { layer: 'xhaul', from: 'xh_bright', to: 'xh_spine', stops: [['tower', -30, -28], ['tower', -4, -44]] },
  { layer: 'xhaul', from: 'xh_spine', to: 'xh_east', stops: [['tower', 38, -40]] },
  { layer: 'xhaul', from: 'xh_east', to: 'xh_south', stops: [['tower', 52, 14]] },
  { layer: 'xhaul', from: 'xh_south', to: 'xh_leaf', stops: [['tower', 16, 40], ['tower', -6, 42]] },
  { layer: 'xhaul', from: 'xh_leaf', to: 'xh_bright', stops: [['tower', -32, 12]] },
];

export const ENDPOINT = {
  bank: { label: 'Bank branch', gear: 'Ciena 3900 series NID, Ethernet business service' },
  office: { label: 'Corporate office', gear: 'Ciena 3900 series NID, 10G business Ethernet' },
  hospital: { label: 'Hospital', gear: 'Ciena 5100 series router, protected dual-homed service' },
  school: { label: 'School', gear: 'Ciena 3900 series NID, 1G Ethernet' },
  tower: { label: 'Cell tower', gear: 'Ciena 5164 cell-site router, 5G fronthaul and backhaul' },
  factory: { label: 'Factory', gear: 'Ciena 3900 series NID, private line' },
  hotel: { label: 'Resort hotel', gear: 'Ciena 3900 series NID, business Ethernet' },
};

const NAMES = {
  bank: ['First Coastal Bank', 'Union Savings', 'Harbor Trust', 'Meridian Bank'],
  office: ['Brightlane HQ', 'Orbis Insurance', 'Tessel Labs'],
  hospital: ['Coreburg General Hospital'],
  school: ['Coreburg Academy'],
  tower: ['Cell site'],
  factory: ['Granite Works'],
  hotel: ['Lagoon Resort'],
};

// ---------------------------------------------------------------- geometry helpers

export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

// Polyline in x/z for a link on one side's map, endpoint to endpoint through its waypoints.
// (Cross-side cables have no single flat map; use linkDirs for those.)
export function linkPath(world, link) {
  const a = world.byId[link.a], b = world.byId[link.b];
  return [[a.x, a.z], ...(link.via || []).map(([x, z]) => [x, z]), [b.x, b.z]];
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

const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
function slerp(u, v, t) {
  const w = Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
  if (w < 1e-6) return u.slice();
  const s = Math.sin(w), p = Math.sin((1 - t) * w) / s, q = Math.sin(t * w) / s;
  return [u[0] * p + v[0] * q, u[1] * p + v[1] * q, u[2] * p + v[2] * q];
}

// Points along any link as unit directions from the planet centre, about `step` apart.
// Links on one side follow their flat map; cross-side cables follow great circles
// between their waypoints.
export function linkDirs(world, link, step = 1) {
  const a = world.byId[link.a], b = world.byId[link.b];
  if (!link.cross) return samplePath(linkPath(world, link), step).map(([x, z]) => flatToDir(x, z, a.side));
  const way = [flatToDir(a.x, a.z, a.side), ...link.via.map(([x, z, s]) => flatToDir(x, z, s)), flatToDir(b.x, b.z, b.side)];
  const out = [way[0]];
  for (let i = 1; i < way.length; i++) {
    const n = Math.max(1, Math.ceil((Math.acos(Math.min(1, dot(way[i - 1], way[i]))) * PLANET_R) / step));
    for (let k = 1; k <= n; k++) out.push(slerp(way[i - 1], way[i], k / n));
  }
  return out;
}

// Length of a link along the planet's surface.
export function linkLength(world, link) {
  const d = linkDirs(world, link, 1);
  let s = 0;
  for (let i = 1; i < d.length; i++) s += Math.acos(Math.min(1, dot(d[i - 1], d[i]))) * PLANET_R;
  return s;
}

// ---------------------------------------------------------------- build

export function buildWorld() {
  const nodes = PLACED.map((n) => ({ ...n }));
  for (const n of nodes) if (n.coastOf) Object.assign(n, coastPoint(CITY[n.coastOf], n.toward));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const links = LINKS.map((l) => ({ ...l }));

  const used = {};
  const pick = (type) => {
    const i = (used[type] = (used[type] ?? -1) + 1);
    return type === 'tower' ? `Cell site ${i + 1}` : NAMES[type][i % NAMES[type].length];
  };
  ACCESS_RINGS.forEach(({ layer, from, to, stops }, r) => {
    let prev = from;
    stops.forEach(([type, x, z], i) => {
      const e = NB(`end_${r}_${i}`, type, pick(type), x, z, [layer], { role: ENDPOINT[type].label, gear: ENDPOINT[type].gear });
      nodes.push(e); byId[e.id] = e;
      links.push(L(layer, prev, e.id));
      prev = e.id;
    });
    links.push(L(layer, prev, to));
  });

  // RLS line amplifiers along the countrywide spans.
  for (const link of links) {
    if (link.layer !== 'backbone') continue;
    const pts = linkPath({ byId }, link);
    const len = pathLength(pts);
    const n = Math.floor(len / 15);
    for (let k = 1; k <= n; k++) {
      const [x, z] = pointAt(pts, (k / (n + 1)) * len);
      const ila = N(`ila_${link.a}_${link.b}_${k}`, 'ila', 'In-line amplifier', x, z, [link.layer],
        { role: `Amplifier hut on ${byId[link.a].name} – ${byId[link.b].name}` });
      nodes.push(ila); byId[ila.id] = ila;
    }
  }

  // Submarine repeaters, every ~9 units along each cable where it is properly underwater.
  for (const link of links) {
    if (!link.sea) continue;
    const dirs = linkDirs({ byId }, link, 1);
    let k = 0;
    for (let i = 9; i < dirs.length - 4; i += 9) {
      if (heightDir(...dirs[i]) > -3) continue;
      const [x, z, side] = dirToFlat(...dirs[i]);
      const rep = N(`rep_${link.a}_${link.b}_${k++}`, 'repeater', 'Undersea repeater', x, z, ['submarine'],
        { side, role: `Repeater on the ${link.name}` });
      nodes.push(rep); byId[rep.id] = rep;
    }
  }

  // the sea along every cable, for the submarine region on the globe
  seaBand = [];
  for (const link of links) {
    if (!link.sea) continue;
    for (const d of linkDirs({ byId }, link, 2)) if (heightDir(...d) < -0.5) seaBand.push(d);
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

  return { nodes, links, byId, cities: CITIES, layers: LAYERS, seaBand };
}

// Last dry spot walking from a town toward a point at sea, on the town's side.
function coastPoint(c, [tx, tz]) {
  let x = c.x, z = c.z;
  const len = Math.hypot(tx - x, tz - z), ux = (tx - x) / len, uz = (tz - z) / len;
  while (heightAt(x + ux * 1.5, z + uz * 1.5, c.side) >= 0.6) { x += ux * 0.5; z += uz * 0.5; }
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
    case 'dc': return n.side ? 'Data center gateway on Ciena 8100 Coherent Routers' : 'Ciena Waveserver 5 with WaveLogic 6 Extreme';
    case 'pop': return 'Ciena RLS ROADM with WaveLogic 6 transponders';
    case 'hub': return 'Ciena RLS ROADM, metro degree';
    case 'regional': return 'Ciena RLS ROADM, two-degree';
    case 'ila': return 'Ciena RLS line amplifier';
    case 'cls': return 'Ciena GeoMesh Extreme submarine line terminal';
    case 'repeater': return 'Submarine optical repeater';
    case 'core': return 'Ciena 8100 Coherent Router';
    case 'agg': return 'Ciena 5170 aggregation router';
    case 'xhub': return 'Ciena 5166 pre-aggregation router';
    case 'ixp': return 'Peering on Ciena 8100 Coherent Routers';
    default: return '';
  }
}

// ---------------------------------------------------------------- major networks
//
// Each side of the globe offers three networks to open; everything else is scenery.
// On the globe a network is a *region* of its country (a few circles on that side's
// map): the harbour and straits, the highlands, the capital. Nothing is wired up
// there; you click a place. Each major also owns a set of links, and with them the
// sites at their ends and the amplifiers or repeaters along them, for its own view.

const near = (w, id, c, r) => Math.hypot(w.byId[id].x - c.x, w.byId[id].z - c.z) < r;

export const MAJORS = [
  {
    id: 'submarine', side: 0, name: 'Submarine network', color: LAYER.submarine.color, layers: ['submarine'],
    blurb: 'Cables on the sea floor from Lumen City, Coherent Isle and Lightmoor, three of them wrapping round the planet to land in Packetland, with repeaters spaced along the seabed.',
    place: 'The strait, Coherent Isle and the ocean, all the way round',
    // a region on both sides: the strait and Coherent Isle, the open ocean, and the
    // three landing coasts of Packetland ([x, z, r, side]; side defaults to A)
    both: true,
    region: [[58, 22, 22], [92, 6, 22], [96, 30, 16], [112, 46, 18], [-122, 16, 18], [70, 70, 20], [-140, 30, 20],
      [-80, 14, 16, 1], [46, 50, 14, 1], [80, -22, 16, 1], [110, 0, 18, 1], [-110, 24, 18, 1]],
    owns: (l) => l.layer === 'submarine',
  },
  {
    id: 'longhaul', side: 0, name: 'Long-haul RLS mesh', color: LAYER.backbone.color, layers: ['backbone'],
    blurb: 'The countrywide line system: eight ROADM sites in a mesh, every one with three or more routes, amplifier huts along each span, landing on three Lumen City metro hubs.',
    place: 'The Wavelands, between the ROADM towns',
    region: [[-38, -2, 36], [-62, -22, 14], [-40, 32, 14], [-16, 28, 12]],
    owns: (l, w) => l.layer === 'backbone' && ![l.a, l.b].some((id) => w.byId[id].type === 'cls' || w.byId[id].x > 60),
  },
  {
    id: 'metro', side: 0, name: 'Lumen City metro optical', color: LAYER.metro.color, layers: ['metro', 'dci'],
    area: { ...METRO, r: 24 },
    blurb: 'Downtown Lumen City: four metro hubs on a packet-optical ring, and four data centers on their own DCI ring, the harbor campus handing off to the subsea cables.',
    place: 'Lumen City and its data center campuses',
    region: [[18, 12, 31]],
    owns: (l, w) => ['metro', 'dci'].includes(l.layer) && [l.a, l.b].every((id) => near(w, id, METRO, 36)),
  },
  {
    id: 'ipcore', side: 1, name: 'IP/MPLS core', color: LAYER.ipcore.color, layers: ['ipcore'],
    blurb: 'Six core routers in a mesh, every one with three or more neighbours: a redundant pair in Coreburg and one in each corner of Packetland, peering at the Gateway Bay internet exchange and serving the cloud and 5G core data centers.',
    place: 'Gateway Bay, Northport, Edgewater and Framefield',
    region: [[-52, 12, 16], [-12, -34, 11], [46, -20, 14], [32, 30, 10]],
    owns: (l) => l.layer === 'ipcore',
  },
  {
    id: 'aggregation', side: 1, name: 'Metro aggregation', color: LAYER.agg.color, layers: ['agg', 'access'],
    area: { ...COREBURG, r: 20 },
    blurb: 'A segment-routed aggregation ring round Coreburg, homed on both core routers, with business Ethernet rings looping past banks, offices, a hospital and a school between its routers.',
    place: 'Downtown Coreburg',
    region: [[0, 2, 24]],
    owns: (l) => l.layer === 'agg' || l.layer === 'access',
  },
  {
    id: 'xhaul', side: 1, name: '5G mobile xhaul', color: LAYER.xhaul.color, layers: ['xhaul'],
    blurb: 'A ring round the Packetland countryside: cell sites between five pre-aggregation hubs, uplinked into the IP core at Gateway Bay and Edgewater, on to the 5G core.',
    place: 'The Spine ring of cell towers',
    region: [[-34, -20, 13], [-4, -46, 10], [16, -42, 12], [36, -40, 11], [52, 6, 14], [38, 40, 12], [6, 44, 13], [-22, 38, 12], [-32, 12, 11]],
    owns: (l) => l.layer === 'xhaul',
  },
];
export const MAJOR = Object.fromEntries(MAJORS.map((m) => [m.id, m]));

// The submarine network's region also follows the cables themselves: a band of sea
// either side of every cable, all the way round the planet. buildWorld fills this in.
export const BAND = 7;
let seaBand = [];
const bandCos = Math.cos(BAND / PLANET_R);

// Which major's region a spot on a side's map falls in, if any: the one whose circle
// it is deepest inside, so overlapping edges go to the closer centre; failing that,
// the cable band.
export function regionAt(x, z, side) {
  let best = null, bestD = 1;
  for (const m of MAJORS) {
    for (const [cx, cz, r, cs = m.side] of m.region) {
      if (cs !== side) continue;
      const d = Math.hypot(x - cx, z - cz) / r;
      if (d < bestD) { bestD = d; best = m.id; }
    }
  }
  if (best) return best;
  const d = flatToDir(x, z, side);
  for (const p of seaBand) if (dot(d, p) > bandCos) return 'submarine';
  return null;
}

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
    parts[m.id] = { links: links.map((l) => l.id), nodes: [...nodes] };
  }
  return parts;
}
