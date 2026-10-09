# Ciena Explorer — Netlandia

A cartoon, bird's-eye 3D map of a small made-up country, with six kinds of Ciena
network drawn on it. Toggle each network on and off, fly to one, take the guided
tour, or click any building to see what it is, what equipment it runs and what it
connects to. Packets run along every link.

![overview](docs/overview.png)

| Submarine cable layer (the sea goes see-through) | Access network, a bank selected |
|---|---|
| ![](docs/submarine.png) | ![](docs/access.png) |

## The six networks

| layer | colour | what's on the map | example Ciena gear |
|---|---|---|---|
| Data center interconnect | purple | 5 DC campuses, metro and regional DCI spans, handed to the subsea cable at Portsea | Waveserver 5, WaveLogic 6 Extreme |
| Regional transport | orange | 3 protected rings (Capitalia, Portsea, Isla Verde) with ring huts in each town | 6500 Packet-Optical |
| Countrywide backbone | red | 7 ROADM PoPs in a mesh, with in-line amplifier huts along the long spans | 6500 / RLS line system |
| Submarine cable | yellow | 4 cables on the sea floor, landing stations, repeaters, two cables leaving the map | GeoMesh Extreme |
| MPLS transport | blue | 15 core and aggregation routers floating above their sites, LSPs as dashed arcs in the sky | 8100 Coherent Routers, 5100 series |
| Access network | pink | 48 customer sites — banks, cell towers, offices, hospitals, schools, factories, hotels — on access nodes per town | 3900 / 5100 series NIDs and routers |

The product names are illustrative placements, not a real network design.

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

## Controls

- Left-drag pans across the ground, right-drag turns and tilts (the tilt is capped
  so it always stays a bird's-eye view), scroll or pinch zooms.
- Click a layer to show or hide it; the target button beside it isolates that layer
  and flies to it.
- Click anything on the map for its card. The links to other sites jump the camera there.
- **Take the tour** steps through all six layers with a caption for each. Esc stops it.

## Code

| file | what it does |
|---|---|
| `js/world.js` | pure data: terrain height function, towns, every node and link, generated access sites, amplifiers and repeaters |
| `js/scene.js` | three.js: diorama board and sea, towns and trees (instanced), equipment models, cables, boats, wind farm, clouds |
| `js/main.js` | camera and controls, layer state, packets, labels, picking, info card, tour |
| `css/net.css` | the HUD |
| `test/world.test.mjs` | data checks: links resolve, equipment and terrestrial fibre stay on dry land, subsea cables stay at sea |
| `build.mjs` | bundles everything into `dist/netlandia.html` |
| `vendor/` | three.js r160 and OrbitControls (MIT) |

To add a site, add a node in `PLACED` and links in `LINKS` in `js/world.js`; the
tests will tell you if it landed in the sea.
