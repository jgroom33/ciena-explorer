# Ciena Explorer — Netlandia

A cartoon 3D globe with a country on each face. **Side A**, Netlandia, carries the
transport networks. **Side B**, Packetland, carries the data network that rides on
them. Spin the planet all the way round, or flip sides from the panel, then click
one of the six major networks to open it on its own in open space, where every
site can be clicked for its equipment and connections. Packets run along every link.

| Side A: transport | Side B: data network |
|---|---|
| ![](docs/overview.png) | ![](docs/side-b.png) |

## The two sides

The globe is a toy world, not a diagram: nothing is wired up on it. The equipment
stands in the landscape as landmarks (a data center campus, a landing station on
the beach, amplifier huts up the mountain road, cell towers on the hills), and each
network is a **region** of its country. Hover a region and the ground there tints
in that network's colour and its landmarks lift; click it to open the network.
An airliner circles the planet between the two countries.

**Side A, Netlandia (transport)** is laid out in three bands so the networks don't
pile up: regional rings through the western towns, the countrywide RLS mesh across
the middle, and the Capitalia metro on the east coast.

**Side B, Packetland (data network)** has Coreburg in the middle with its pair of
core routers, the IP core meshed out to each corner, an aggregation ring hugging
the city, and the 5G xhaul ring out in the countryside.

## The six major networks

Each is a region of its country on the globe (the harbour and the strait, the
heartland, the capital, the countryside); clicking that region, or the network's
entry in the panel, opens it.

| side | network | what's in it | example Ciena gear |
|---|---|---|---|
| A | Submarine network | 4 cables, 7 landing stations, 61 repeaters; 3 cables cross to side B | GeoMesh Extreme |
| A | Long-haul RLS mesh | 8 ROADMs, each with 3+ routes, 21 amplifier huts, landing on 3 Capitalia hubs | RLS with WaveLogic 6 |
| A | Capitalia metro optical | 4 metro hubs on a packet-optical ring, 4 data centers on a DCI ring | 6500, Waveserver |
| B | IP/MPLS core | 6 core routers in a mesh, an internet exchange, cloud and 5G core data centers | 8100 Coherent Routers |
| B | Metro aggregation | a segment-routed ring round Coreburg on both core routers, 6 business customers on rings | 5170, 3900 series |
| B | 5G mobile xhaul | 5 pre-aggregation hubs and 7 cell sites on a ring, uplinked into the core at 2 points | 5164, 5166 |

The product names are illustrative placements, not a real network design.

| IP/MPLS core on its own | 5G xhaul on its own |
|---|---|
| ![](docs/ipcore.png) | ![](docs/xhaul.png) |

## A network on its own

Opening a network replaces the globe with just that network floating in open space:
its sites, cables, amplifiers or repeaters, and the traffic on them, with no terrain
or buildings. A network on one side is laid flat. The submarine network, which wraps
from side to side, keeps its shape round an invisible planet and is seen from high
over the pole. **Back to the globe**, the browser's back button or Esc returns.

Each network has its own address: `#submarine`, `#longhaul`, `#metro`, `#ipcore`,
`#aggregation` or `#xhaul`. A link can open straight into one, and a separate page
can later take over that address.

![the submarine network round the planet](docs/submarine.png)

## Controls

- Globe: drag (one finger on a phone) spins the planet in any direction; scroll or
  pinch zooms. **Side A / Side B** in the panel spins it round to the other country;
  the panel also follows whichever side you've spun to.
- A network on its own: drag turns, right-drag or two fingers pan, scroll or pinch zooms.

## Run it

No build step and no dependencies; three.js r160 is vendored in `vendor/` so the
page works offline.

```sh
python3 -m http.server 8765     # then open http://localhost:8765/
node --test test/world.test.mjs
node build.mjs                  # single-file page -> dist/netlandia.html
```

`dist/netlandia.html` loads three.js r160 from jsDelivr and has everything else
inlined, so it can be shared as one file.

## Code

| file | what it does |
|---|---|
| `js/world.js` | pure data: the two sides and their projections onto the planet, terrain, towns, every node and link, generated customers, amplifiers and repeaters, the six major networks, the region each covers on the globe and the links each owns |
| `js/scene.js` | three.js: the planet, sea and atmosphere, towns and trees (instanced), equipment models, solid and dashed cables, boats, wind farm, clouds |
| `js/detail.js` | a network on its own: laid flat, or round an invisible planet, with its own lights and traffic |
| `js/main.js` | globe camera and side switch, the networks as clickable regions with their halos, the airliner, switching views, labels, picking, the site card |
| `css/net.css` | the HUD |
| `test/world.test.mjs` | data checks: links resolve, transport on side A and data on side B, gear and fibre on land, subsea cables at sea, no two cables run alongside each other, every ROADM and core router has 3+ routes, no customer or cell site on a spur, the six networks own their own links, each network's sites stand inside its region |
| `build.mjs` | bundles everything into `dist/netlandia.html`, and fails if two modules declare the same top-level name |
| `vendor/` | three.js r160 and OrbitControls (MIT) |

To add a site, add a node in `PLACED` and links in `LINKS` in `js/world.js` (with
`side: 1` for Packetland); the tests will tell you if it landed in the sea or on the
wrong side.
