// The two ways of reading the map. Explorer is an introduction to networking: the
// same places and the same gear, described without the trade's acronyms. Engineer
// is the map as an operator would label it. Everything the HUD prints goes through
// `vocab(mode)`, so the two never drift apart in the code that renders them.
import { LAYER, MAJOR, ENDPOINT, SIDES } from './world.js';

export const MODES = [
  { id: 'explorer', name: 'Explorer', tagline: 'Learn how networks work, in plain words' },
  { id: 'engineer', name: 'Engineer', tagline: 'The full picture, with the real terminology' },
];
export const DEFAULT_MODE = 'explorer';

// ---------------------------------------------------------------- plain words

const SIDE_PLAIN = [
  { name: 'Light and cables', blurb: 'Where data travels as light through glass' },
  { name: 'Packets and routers', blurb: 'Where data travels as packets between routers' },
];

const LAYER_PLAIN = {
  submarine: { name: 'Undersea cables', short: 'Undersea' },
  backbone: { name: 'Countrywide light highway', short: 'Light highway' },
  metro: { name: 'City light ring', short: 'City ring' },
  dci: { name: 'Data center links', short: 'DC links' },
  regional: { name: 'Town rings', short: 'Town rings' },
  ipcore: { name: 'Internet core', short: 'Core' },
  agg: { name: 'City collector ring', short: 'Collector ring' },
  access: { name: 'Business connections', short: 'Business' },
  xhaul: { name: 'Mobile phone network', short: 'Mobile' },
};

const MAJOR_PLAIN = {
  submarine: {
    name: 'Undersea cables',
    blurb: 'Cables lying on the sea floor join the two countries. Light runs through them, and little boosters along the seabed keep it bright all the way across the ocean.',
    place: 'The strait, Coherent Isle and the ocean, all the way round',
  },
  longhaul: {
    name: 'Countrywide light highway',
    blurb: 'Glass fibres run between the towns, and the data in them travels as light. Where fibres meet, a station steers each beam onto the right road, so there is always more than one way to get anywhere.',
    place: 'The Wavelands, between the fibre towns',
  },
  metro: {
    name: 'Lumen City light ring',
    blurb: 'Downtown, four hubs are joined in a loop of fibre, and the big computer buildings have a loop of their own. A loop means every place can be reached two ways round.',
    place: 'Lumen City and its data centers',
  },
  ipcore: {
    name: 'Internet core',
    blurb: 'Six big routers pass packets across the country, each with several neighbours so there is always another road. One sits beside the place where other networks meet ours, and two serve the cloud and the mobile network.',
    place: 'The two main routers in Coreburg and the four corner towns',
  },
  aggregation: {
    name: 'Coreburg city network',
    blurb: 'A loop of fibre round the city gathers up the packets from banks, offices, a hospital and a school, and carries them into the big routers in the middle.',
    place: 'The loop round downtown Coreburg',
  },
  xhaul: {
    name: 'Mobile phone network',
    blurb: 'Phone towers out in the countryside turn radio from your phone into packets, and a loop of fibre carries them to the mobile network’s control center and on to the internet.',
    place: 'The loop of phone towers round the countryside',
  },
};

// What each kind of site is, as a label and as a sentence.
const TYPE_PLAIN = {
  dc: ['Data center', 'A building full of computers that hold websites, videos, games and apps.'],
  pop: ['Light junction', 'Where beams of light are steered from one fibre onto another, without ever being turned back into electricity.'],
  hub: ['City hub', 'A hub on the city ring, where the countrywide fibres meet the city’s own loop.'],
  regional: ['Town hut', 'A small building where a town joins the ring of fibre running past it.'],
  ila: ['Booster hut', 'Light fades on a long run of fibre. This hut gives it a boost so it reaches the next town.'],
  cls: ['Beach cable station', 'Where an undersea cable comes ashore and plugs into the fibres on land.'],
  repeater: ['Undersea booster', 'A booster lying on the seabed, powered through a copper wire inside the cable.'],
  core: ['Main router', 'A big router that reads the address on every packet and passes it toward its destination.'],
  agg: ['Collector router', 'Gathers packets from many customers and hands them to the main routers.'],
  xhub: ['Tower collector', 'Collects the packets from the phone towers on its stretch of the loop.'],
  ixp: ['Internet meeting point', 'Where this network plugs into other networks, so packets can reach the rest of the internet.'],
  access: ['Customer site', 'A place that connects to the network.'],
  bank: ['Bank branch', 'A bank branch with a small box that joins it to the city network.'],
  office: ['Office', 'An office building joined to the city network.'],
  hospital: ['Hospital', 'A hospital, connected two ways so it never loses its link.'],
  school: ['School', 'A school joined to the city network.'],
  tower: ['Phone tower', 'Talks to the phones nearby by radio and turns their calls and data into packets on a fibre.'],
  factory: ['Factory', 'A factory joined to the city network.'],
  hotel: ['Hotel', 'A hotel joined to the city network.'],
};

// What is inside, without the part numbers.
const GEAR_PLAIN = {
  dc: 'Racks of computers, and boxes that turn their data into light for the fibres',
  pop: 'A box of tiny mirrors and filters that steers each colour of light',
  hub: 'Light-steering boxes for the city ring and the countrywide fibres',
  regional: 'A box that drops the town’s light off the ring and adds it back',
  ila: 'An amplifier that makes the light brighter without reading it',
  cls: 'The end of the undersea cable, and the power feed for its boosters',
  repeater: 'An amplifier in a pressure-proof case',
  core: 'A very fast router that can handle millions of packets a second',
  agg: 'A router that merges many customers’ packets onto one fibre',
  xhub: 'A router built for phone towers, with a very accurate clock',
  ixp: 'Routers belonging to many different networks, plugged into each other',
  tower: 'A small, tough router at the foot of the mast',
  endpoint: 'A small box that connects the building to the network',
};

// A site's name with the trade words swapped out.
const NAME_PLAIN = [
  [/ ROADM$/, ' light junction'],
  [/ pre-aggregation$/, ' tower collector'],
  [/ aggregation$/, ' collector'],
  [/ Central Office$/, ' exchange'],
  [/ DC /, ' data center '],
  [/ DC$/, ' data center'],
  [/ 5G Core$/, ' mobile control center'],
  [/ Internet Exchange$/, ' internet meeting point'],
  [/ Landing Station$/, ' cable station'],
  [/ core$/, ' main router'],
  [/\bAmplifier hut\b/, 'Booster hut'],
  [/\bRepeater\b/, 'Booster'],
];

// ---------------------------------------------------------------- the vocabulary

const ENGINEER_TYPES = {
  dc: 'Data center', pop: 'RLS ROADM site', hub: 'Metro hub', regional: 'Regional ring hut', ila: 'RLS amplifier hut',
  cls: 'Cable landing station', repeater: 'Undersea repeater', core: 'Core router', agg: 'Aggregation router',
  xhub: '5G pre-aggregation hub', ixp: 'Internet exchange', access: 'Access node',
  ...Object.fromEntries(Object.entries(ENDPOINT).map(([k, v]) => [k, v.label])),
};

// The counts each network's one-line summary is built from; the words differ by mode.
const STAT_WORDS = {
  engineer: {
    submarine: ['cables', 'landing stations', 'repeaters'],
    longhaul: ['ROADMs', 'amplifier huts'],
    metro: ['metro hubs', 'data centers'],
    ipcore: ['core routers', 'data centers', 'internet exchange'],
    aggregation: ['aggregation routers', 'business customers'],
    xhaul: ['hubs', 'cell sites'],
  },
  explorer: {
    submarine: ['cables', 'beach stations', 'undersea boosters'],
    longhaul: ['light junctions', 'booster huts'],
    metro: ['city hubs', 'data centers'],
    ipcore: ['main routers', 'data centers', 'internet meeting point'],
    aggregation: ['collector routers', 'customers'],
    xhaul: ['tower collectors', 'phone towers'],
  },
};

export function vocab(mode) {
  const plain = mode === 'explorer';
  const w = STAT_WORDS[plain ? 'explorer' : 'engineer'];
  return {
    mode, plain,
    subtitle: plain ? 'Light and cables on one side, packets and routers on the other' : 'Transport on one side, the data network on the other',
    sideName: (s) => (plain ? SIDE_PLAIN[s].name : SIDES[s].name),
    sideHeading: (s) => `${SIDES[s].land} · ${(plain ? SIDE_PLAIN[s].name : SIDES[s].name).toLowerCase()}`,
    layerName: (id) => (plain ? LAYER_PLAIN[id].name : LAYER[id].name),
    layerShort: (id) => (plain ? LAYER_PLAIN[id].short : LAYER[id].short),
    majorName: (id) => (plain ? MAJOR_PLAIN[id].name : MAJOR[id].name),
    majorBlurb: (id) => (plain ? MAJOR_PLAIN[id].blurb : MAJOR[id].blurb),
    majorPlace: (id) => (plain ? MAJOR_PLAIN[id].place : MAJOR[id].place),
    // counts in the order STAT_WORDS lists them; a count of 1 reads "1 internet exchange"
    stats: (id, counts) => counts.map((c, i) => `${c} ${w[id][i]}`).join(' · '),
    typeLabel: (type) => (plain ? TYPE_PLAIN[type]?.[0] : ENGINEER_TYPES[type]) ?? type,
    nodeName: (n) => (plain ? NAME_PLAIN.reduce((s, [re, to]) => s.replace(re, to), n.name) : n.name),
    nodeRole: (n) => (plain ? TYPE_PLAIN[n.type]?.[1] ?? '' : n.role ?? ''),
    nodeGear: (n) => (plain ? GEAR_PLAIN[n.type] ?? (ENDPOINT[n.type] ? GEAR_PLAIN.endpoint : '') : n.gear ?? ''),
    gearHeading: plain ? 'What is inside' : 'Equipment',
    techHeading: plain ? 'Learn how it works' : 'Explore the technology',
    hints: {
      globe: plain
        ? 'Drag to spin the planet · Scroll or pinch to zoom · Click a part of the country to see its network'
        : 'Drag to spin the planet · Scroll or pinch to zoom · Click a part of the country to open its network',
      detail: plain
        ? 'Drag to turn · Right-drag or two fingers to pan · Scroll or pinch to zoom · Click anything to find out what it is'
        : 'Drag to turn · Right-drag or two fingers to pan · Scroll or pinch to zoom · Click a site',
    },
    cutLabel: plain ? 'cable cut' : 'fibre cut',
    blockLabel: plain ? 'closed on purpose' : 'RPL blocked',
  };
}

export const PLAIN = { SIDE_PLAIN, LAYER_PLAIN, MAJOR_PLAIN, TYPE_PLAIN, GEAR_PLAIN };
