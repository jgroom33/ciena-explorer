// Technology explainers: for each network, the technologies that matter in that
// space, each told in a few steps that play out live on the network. A step gets
// a clean scene and describes everything it wants shown, so Back and Next are
// just "show step i". No three.js in here; the steps talk to the view's `fx`.

export const TC = {
  wave: '#ff7f50', wave2: '#9b5de5', wave3: '#2ec4b6', red: '#e63946', white: '#ffffff',
  voice: '#e63946', video: '#ff8c1a', biz: '#2f80ed', best: '#8d99ae', ccm: '#2ec4b6', frame: '#7b2cbf',
};

// Reusable scene recipes.
export const glowPath = (fx, ids) => { fx.focus(fx.pathLinks(ids)); return ids; };
const cores = (fx) => Object.values(fx.byId).filter((n) => n.type === 'core').map((n) => n.id);
export const ofType = (fx, t) => Object.values(fx.byId).filter((n) => n.type === t).map((n) => n.id);
const sidTag = (sid) => `<span class="sid">${sid}</span>`;
const stackTag = (labels) => `<span class="stack">${labels.map((l) => `<b>${l}</b>`).join('')}</span>`;

// A packet whose label stack pops one label at each hop.
function srPacket(fx, ids, sids, color = TC.biz, speed = 9) {
  const pk = fx.packet(ids, { color, speed, tag: stackTag(sids) });
  pk.onHop = (hop) => { pk.tag.el.innerHTML = stackTag(sids.slice(hop)) || '<span class="stack empty">payload</span>'; };
  return pk;
}

// Continuity-check heartbeats both ways between two MEPs.
export function ccm(fx, a, b, period = 1.4) {
  const ids = fx.path(a, b);
  fx.focus(fx.pathLinks(ids));
  fx.anchor('<b>MEP</b>', fx.nodePos(a, 6), 'mep');
  fx.anchor('<b>MEP</b>', fx.nodePos(b, 6), 'mep');
  fx.packet(ids, { color: TC.ccm, speed: 16, size: 0.35, tag: '<span class="ccm">CCM</span>' });
  fx.packet([...ids].reverse(), { color: TC.ccm, speed: 16, size: 0.35, delay: period / 2, tag: '<span class="ccm">CCM</span>' });
  return ids;
}

export const TOPICS = {
  longhaul: [
    {
      id: 'rls', name: 'The line system', tag: 'Ciena RLS with WaveLogic 6',
      summary: 'What carries the light between cities: fibre, amplifiers and the ROADMs at each end.',
      steps: [
        {
          say: 'A Reconfigurable Line System is the glass and the amplifiers. Every span here is a fibre pair with an amplifier hut every 80 km or so, boosting the light so it reaches the next ROADM.',
          run: (fx) => { fx.focus(fx.linksOf()); for (const id of ofType(fx, 'ila')) fx.spot(id, TC.red); },
        },
        {
          say: 'A wavelength launched at Prismfield rides the same fibre all the way to the Lumen City North hub without ever being turned back into electrons. Watch it pass the amp huts.',
          run: (fx) => { const ids = glowPath(fx, fx.path('bb_oak', 'hub_n')); fx.packet(ids, { color: TC.wave, speed: 12, tag: 'λ 1550.12 nm' }); },
        },
        {
          say: 'Each wave is one WaveLogic 6 channel, up to 1.6 Tb/s on a single colour of light. Dozens of colours share one fibre; here three of them ride the same glass.',
          run: (fx) => { const ids = glowPath(fx, fx.path('bb_oak', 'hub_n')); [TC.wave, TC.wave2, TC.wave3].forEach((c, i) => fx.packet(ids, { color: c, speed: 12, delay: i * 0.9 })); },
        },
      ],
    },
    {
      id: 'cdc', name: 'CDC ROADMs', tag: 'Ciena RLS CDC ROADM',
      summary: 'Colorless, directionless, contentionless switching of light at a five-degree site.',
      steps: [
        {
          say: 'Crosspoint is a five-degree ROADM: five fibre directions meet here, and any wavelength can be switched from any direction to any other, all in the optical domain.',
          run: (fx) => { fx.focus(['bb_oak', 'bb_mid', 'bb_lake', 'bb_south', 'bb_stone'].map((o) => fx.link('bb_junc', o))); fx.spot('bb_junc', TC.red); },
        },
        {
          say: 'Colorless: an add/drop port is not tied to one wavelength. A transponder plugged in at Crosspoint can be tuned to any colour, so three different channels can leave the same port.',
          run: (fx) => { fx.spot('bb_junc', TC.red); const ids = glowPath(fx, ['bb_junc', 'bb_stone']); [TC.wave, TC.wave2, TC.wave3].forEach((c, i) => fx.packet(ids, { color: c, speed: 10, delay: i * 0.7, tag: ['λ 1550.12', 'λ 1551.72', 'λ 1553.33'][i] })); },
        },
        {
          say: 'Directionless: that same port can send its wave out of any degree. The same channel is steered east toward Glassbridge or south toward Spectraville by software, with nobody touching a patch cord.',
          run: (fx) => { fx.spot('bb_junc', TC.red); fx.focus([fx.link('bb_junc', 'bb_stone'), fx.link('bb_junc', 'bb_south')]); fx.packet(['bb_junc', 'bb_stone'], { color: TC.wave, speed: 10, tag: 'λ 1550.12 → east' }); fx.packet(['bb_junc', 'bb_south'], { color: TC.wave, speed: 10, delay: 1.2, tag: 'λ 1550.12 → south' }); },
        },
        {
          say: 'Contentionless: two waves of the same colour arriving from different directions can both be dropped at Crosspoint without colliding. Here the same channel comes in from Prismfield and from Raman Ridge at once.',
          run: (fx) => { fx.spot('bb_junc', TC.red); fx.focus([fx.link('bb_oak', 'bb_junc'), fx.link('bb_mid', 'bb_junc')]); fx.packet(['bb_oak', 'bb_junc'], { color: TC.wave, speed: 10, tag: 'λ 1550.12' }); fx.packet(['bb_mid', 'bb_junc'], { color: TC.wave, speed: 10, delay: 0.3, tag: 'λ 1550.12' }); },
        },
      ],
    },
    {
      id: 'restore', name: 'Mesh restoration', tag: 'Ciena RLS control plane',
      summary: 'What a fibre cut does to a wave, and how the mesh relights it round the break.',
      steps: [
        {
          say: 'A wave from Prismfield to the Lumen City West hub normally takes the short way: Prismfield, Crosspoint, Glassbridge, into the metro.',
          run: (fx) => { const ids = glowPath(fx, ['bb_oak', 'bb_junc', 'bb_stone', 'hub_w']); fx.packet(ids, { color: TC.wave, speed: 12 }); fx.packet(ids, { color: TC.wave, speed: 12, delay: 1.5 }); },
        },
        {
          say: 'A backhoe finds the Crosspoint–Glassbridge span. Every wave on it goes dark.',
          run: (fx) => { glowPath(fx, ['bb_oak', 'bb_junc']); fx.marker(fx.link('bb_junc', 'bb_stone'), 'cut'); fx.packet(['bb_oak', 'bb_junc'], { color: TC.wave, speed: 12 }); },
        },
        {
          say: 'Because every site in the mesh has three or more routes out, the control plane re-tunes the ROADMs and the wave is relit over a path round the cut: here via Spectraville and Beambrook.',
          run: (fx) => { const cut = fx.link('bb_junc', 'bb_stone'); const ids = glowPath(fx, fx.path('bb_oak', 'hub_w', [cut])); fx.marker(cut, 'cut'); fx.packet(ids, { color: TC.wave, speed: 12 }); fx.packet(ids, { color: TC.wave, speed: 12, delay: 1.5 }); },
        },
        {
          say: 'Once the span is spliced, the wave reverts to the short path.',
          run: (fx) => { const ids = glowPath(fx, ['bb_oak', 'bb_junc', 'bb_stone', 'hub_w']); fx.packet(ids, { color: TC.wave, speed: 12 }); fx.packet(ids, { color: TC.wave, speed: 12, delay: 1.5 }); },
        },
      ],
    },
  ],

  metro: [
    {
      id: 'ring', name: 'Fixed ROADM ring', tag: 'Ciena RLS with WaveLogic 5 Nano',
      summary: 'Two-degree ROADMs on a ring: simpler and cheaper than the long-haul mesh.',
      steps: [
        {
          say: 'Metro transport does not need five-degree switching. The four Lumen City hubs sit on a two-degree ring: each ROADM has an east side and a west side, and fixed filters that add and drop that hub’s own wavelengths.',
          run: (fx) => { fx.focus([fx.link('hub_n', 'hub_e'), fx.link('hub_e', 'hub_s'), fx.link('hub_s', 'hub_w'), fx.link('hub_w', 'hub_n')]); for (const h of ['hub_n', 'hub_e', 'hub_s', 'hub_w']) fx.spot(h, '#14b8a6'); },
        },
        {
          say: 'A wave added at the West hub for the East hub goes clockwise round the ring, passing straight through North without being touched.',
          run: (fx) => { const ids = glowPath(fx, ['hub_w', 'hub_n', 'hub_e']); fx.spot('hub_w', '#14b8a6'); fx.spot('hub_e', '#14b8a6'); fx.packet(ids, { color: TC.wave, speed: 12, tag: 'add at West · drop at East' }); },
        },
      ],
    },
    {
      id: 'protect', name: 'Ring protection', tag: 'Ciena RLS optical protection',
      summary: 'Every hub can reach every other in two directions.',
      steps: [
        {
          say: 'Normally traffic takes the short way round the ring.',
          run: (fx) => { const ids = glowPath(fx, ['hub_w', 'hub_n', 'hub_e']); fx.packet(ids, { color: TC.wave, speed: 12 }); fx.packet(ids, { color: TC.wave, speed: 12, delay: 1.4 }); },
        },
        {
          say: 'The span between North and East is cut. The ring heals: the West hub’s wave is switched out of its other degree and goes the long way round, via South, in under 50 ms.',
          run: (fx) => { fx.marker(fx.link('hub_n', 'hub_e'), 'cut'); const ids = glowPath(fx, ['hub_w', 'hub_s', 'hub_e']); fx.packet(ids, { color: TC.wave, speed: 12 }); fx.packet(ids, { color: TC.wave, speed: 12, delay: 1.4 }); },
        },
      ],
    },
    {
      id: 'dci', name: 'Data center interconnect', tag: 'Ciena Waveserver',
      summary: 'The campuses talk to each other on their own point-to-point waves.',
      steps: [
        {
          say: 'The four data centers have a ring of their own: Waveserver boxes in each campus light point-to-point waves straight to the next campus, with huge capacity and very little to configure.',
          run: (fx) => { const ring = ['dc_nw', 'dc_ne', 'dc_se', 'dc_sw', 'dc_nw']; glowPath(fx, ring); fx.packet(ring, { color: TC.wave2, speed: 14 }); fx.packet([...ring].reverse(), { color: TC.wave2, speed: 14, delay: 0.8 }); },
        },
        {
          say: 'The harbor campus hands its waves to the cable landing station, so a data center across the sea is just another hop of DCI.',
          run: (fx) => { const ids = glowPath(fx, ['dc_nw', 'dc_ne', 'dc_se', 'cls_port']); fx.spot('cls_port', '#ffc300'); fx.packet(ids, { color: TC.wave2, speed: 14, tag: 'to the subsea cable' }); },
        },
      ],
    },
  ],

  submarine: [
    {
      id: 'slt', name: 'Line terminals and repeaters', tag: 'Ciena GeoMesh Extreme',
      summary: 'How light crosses an ocean.',
      steps: [
        {
          say: 'A submarine line terminal at each landing station launches the waves. Every 60–80 km a repeater on the seabed, powered over the cable’s copper conductor, amplifies them again.',
          run: (fx) => { const ids = glowPath(fx, ['cls_port', 'cls_south']); for (const id of Object.keys(fx.byId).filter((x) => x.startsWith('rep_cls_port_cls_south'))) fx.spot(id, '#ffc300'); fx.spot('cls_port', '#ffc300'); fx.spot('cls_south', '#ffc300'); fx.packet(ids, { color: TC.wave, speed: 24 }); },
        },
        {
          say: 'One fibre pair carries many colours. A cable owner can sell a slice of its spectrum to a tenant, who lights it with their own WaveLogic transponders at each landing station.',
          run: (fx) => { const ids = glowPath(fx, ['cls_port', 'cls_isla_w']); [TC.wave, TC.wave2, TC.wave3].forEach((c, i) => fx.packet(ids, { color: c, speed: 18, delay: i * 0.6, tag: ['owner', 'tenant A', 'tenant B'][i] })); },
        },
      ],
    },
  ],

  ipcore: [
    {
      id: 'sr', name: 'Segment routing (SR-MPLS)', tag: 'Ciena 8100 Coherent Routers',
      summary: 'The sender writes the route into the packet as a stack of labels.',
      steps: [
        {
          say: 'Each core router owns a node segment: a label such as 16003 that means "get to me". There is no path state in the middle of the network; the route lives in the packet.',
          run: (fx) => { cores(fx).forEach((id, i) => { fx.spot(id, TC.biz); fx.anchor(sidTag(16001 + i), fx.nodePos(id, 6.5)); }); },
        },
        {
          say: 'Gateway Bay wants a packet to reach Edgewater via Coreburg 1 and Coreburg 2, so it pushes the segment list [16001, 16002, 16005] onto it.',
          run: (fx) => { const ids = glowPath(fx, ['cr_gw', 'cr_c1', 'cr_c2', 'cr_edge']); ['cr_c1', 'cr_c2', 'cr_edge'].forEach((id, i) => fx.anchor(sidTag([16001, 16002, 16005][i]), fx.nodePos(id, 6.5))); srPacket(fx, ids, ['16001', '16002', '16005']); },
        },
        {
          say: 'Each hop pops the top label and forwards on the next one. By Edgewater the stack is empty and only the payload is left.',
          run: (fx) => { const ids = glowPath(fx, ['cr_gw', 'cr_c1', 'cr_c2', 'cr_edge']); srPacket(fx, ids, ['16001', '16002', '16005'], TC.biz, 6); },
        },
      ],
    },
    {
      id: 'tilfa', name: 'TI-LFA fast reroute', tag: 'Ciena 8100, SR-MPLS',
      summary: 'A repair path computed before the failure, used in under 50 ms.',
      steps: [
        {
          say: 'Before anything fails, every router has already computed a loop-free repair path for each of its links. Gateway Bay to Edgewater normally goes through the Coreburg pair.',
          run: (fx) => { const ids = glowPath(fx, ['cr_gw', 'cr_c1', 'cr_c2', 'cr_edge']); fx.packet(ids, { color: TC.biz, speed: 12 }); fx.packet(ids, { color: TC.biz, speed: 12, delay: 1.2 }); },
        },
        {
          say: 'Coreburg 1 loses its link to Coreburg 2. Within 50 ms it pushes its precomputed repair segments and steers packets via Northport to Edgewater, long before the routing protocol has noticed.',
          run: (fx) => { fx.marker(fx.link('cr_c1', 'cr_c2'), 'cut'); const ids = glowPath(fx, ['cr_gw', 'cr_c1', 'cr_north', 'cr_edge']); fx.spot('cr_c1', TC.red); srPacket(fx, ids, ['16001', '16004', '16005'], TC.biz, 11); },
        },
        {
          say: 'Once the IGP has converged, the repair path is dropped for the new best path straight through Northport.',
          run: (fx) => { fx.marker(fx.link('cr_c1', 'cr_c2'), 'cut'); const ids = glowPath(fx, ['cr_gw', 'cr_north', 'cr_edge']); fx.packet(ids, { color: TC.biz, speed: 12 }); fx.packet(ids, { color: TC.biz, speed: 12, delay: 1.2 }); },
        },
      ],
    },
  ],

  aggregation: [
    {
      id: 'g8032', name: 'G.8032 ring protection', tag: 'Ciena 5170 aggregation routers',
      summary: 'An Ethernet ring that cannot loop, and heals in under 50 ms.',
      steps: [
        {
          say: 'The four aggregation routers form an Ethernet ring. One link, the Ring Protection Link, is deliberately blocked by its owner so frames can never loop.',
          run: (fx) => { fx.focus([fx.link('ag_w', 'ag_n'), fx.link('ag_n', 'ag_e'), fx.link('ag_e', 'ag_s'), fx.link('ag_s', 'ag_w')]); fx.marker(fx.link('ag_s', 'ag_w'), 'block'); for (const a of ['ag_w', 'ag_n', 'ag_e', 'ag_s']) fx.spot(a, TC.frame); },
        },
        {
          say: 'So frames from West to South go the long way: North, East, South.',
          run: (fx) => { fx.marker(fx.link('ag_s', 'ag_w'), 'block'); const ids = glowPath(fx, ['ag_w', 'ag_n', 'ag_e', 'ag_s']); fx.packet(ids, { color: TC.frame, speed: 12 }); fx.packet(ids, { color: TC.frame, speed: 12, delay: 1.3 }); },
        },
        {
          say: 'The North–East span fails. Both ends raise a Signal Fail, flood R-APS messages round the ring, and the RPL owner unblocks its link: under 50 ms, no spanning tree involved.',
          run: (fx) => { fx.marker(fx.link('ag_n', 'ag_e'), 'cut'); const ids = glowPath(fx, ['ag_w', 'ag_s']); fx.spot('ag_w', TC.frame); fx.packet(['ag_e', 'ag_n'], { color: TC.red, speed: 20, size: 0.3, tag: 'R-APS (SF)' }); fx.packet(['ag_n', 'ag_w'], { color: TC.red, speed: 20, size: 0.3, delay: 0.6, tag: 'R-APS (SF)' }); fx.packet(ids, { color: TC.frame, speed: 12 }); },
        },
        {
          say: 'Every node flushes its MAC table and relearns. The short path to South is now live, and the ring is still a ring.',
          run: (fx) => { fx.marker(fx.link('ag_n', 'ag_e'), 'cut'); const ids = glowPath(fx, ['ag_w', 'ag_s']); fx.packet(ids, { color: TC.frame, speed: 12 }); fx.packet(ids, { color: TC.frame, speed: 12, delay: 1.3 }); for (const a of ['ag_w', 'ag_n', 'ag_e', 'ag_s']) fx.anchor('<b>FDB flush</b>', fx.nodePos(a, 6), 'note'); },
        },
      ],
    },
    {
      id: 'ethagg', name: 'Low-cost Ethernet aggregation', tag: 'Ciena 3900 series NIDs, 5170',
      summary: 'Below the core there is no MPLS at all.',
      steps: [
        {
          say: 'A bank branch gets an E-Line service: a NID at the branch tags its frames with a VLAN, the ring carries them to the aggregation router, and only there do they meet the core.',
          run: (fx) => { const ids = glowPath(fx, fx.path('end_0_1', 'cr_c2')); fx.spot('end_0_1', '#ff4fa3'); fx.packet(ids, { color: '#ff4fa3', speed: 10, tag: 'VLAN 120 · E-Line' }); fx.packet([...ids].reverse(), { color: '#ff4fa3', speed: 10, delay: 1, tag: 'VLAN 120' }); },
        },
        {
          say: 'That keeps the edge cheap: fixed-function Ethernet boxes, no label switching, no routing protocol at the customer site. Intelligence sits in the ring and the core, where it is shared.',
          run: (fx) => { for (const id of Object.keys(fx.byId).filter((x) => x.startsWith('end_'))) fx.spot(id, '#ff4fa3'); fx.focus(fx.linksOf('access')); },
        },
      ],
    },
    {
      id: 'qos', name: 'Quality of service', tag: 'Hierarchical QoS on the 5170',
      summary: 'Voice, business data and internet share one uplink without hurting each other.',
      steps: [
        {
          say: 'The East aggregation router carries voice, video, business data and best-effort internet on one uplink to the core. Each class is marked (p-bits or DSCP) and goes into its own queue.',
          run: (fx) => { fx.queue('ag_e', [{ name: 'Voice', color: TC.voice, fill: 0.2 }, { name: 'Video', color: TC.video, fill: 0.3 }, { name: 'Business', color: TC.biz, fill: 0.35 }, { name: 'Best effort', color: TC.best, fill: 0.4 }]); const ids = glowPath(fx, ['ag_e', 'cr_c2']); [TC.voice, TC.video, TC.biz, TC.best].forEach((c, i) => fx.packet(ids, { color: c, speed: 10, delay: i * 0.5, size: 0.45 })); fx.spot('ag_e', TC.frame); },
        },
        {
          say: 'When the uplink is congested the scheduler serves the strict-priority voice queue first, then shares the rest by weight. Best effort absorbs the loss; voice never notices.',
          run: (fx) => { fx.queue('ag_e', [{ name: 'Voice', color: TC.voice, fill: 0.1 }, { name: 'Video', color: TC.video, fill: 0.45 }, { name: 'Business', color: TC.biz, fill: 0.6 }, { name: 'Best effort', color: TC.best, fill: 0.98 }]); const ids = glowPath(fx, ['ag_e', 'cr_c2']); [TC.voice, TC.voice, TC.video, TC.biz].forEach((c, i) => fx.packet(ids, { color: c, speed: 10, delay: i * 0.45, size: 0.45 })); fx.anchor('<b>drop</b> best effort', fx.nodePos('ag_e', 3.5), 'note warn'); },
        },
        {
          say: 'Policers at the customer NIDs enforce each contract on the way in, so no single service can flood the ring beyond what it bought.',
          run: (fx) => { for (const id of Object.keys(fx.byId).filter((x) => x.startsWith('end_'))) { fx.spot(id, '#ff4fa3'); fx.anchor('<b>policer</b> 100 Mb/s', fx.nodePos(id, 6), 'note'); } },
        },
      ],
    },
    {
      id: 'cfm', name: 'Connectivity fault management', tag: '802.1ag / Y.1731 on 3900 NIDs',
      summary: 'Heartbeats that prove a service is up, and measure how well.',
      steps: [
        {
          say: 'Each end of the bank’s service hosts a Maintenance End Point. The two MEPs exchange Continuity Check Messages every 100 ms; while they keep arriving, the service is up.',
          run: (fx) => ccm(fx, 'end_0_1', 'ag_e'),
        },
        {
          say: 'Y.1731 adds measurement: loss and delay messages ride the same path, so the SLA is measured end to end rather than guessed from counters.',
          run: (fx) => { const ids = fx.path('end_0_1', 'ag_e'); fx.focus(fx.pathLinks(ids)); fx.anchor('<b>MEP</b>', fx.nodePos('end_0_1', 6), 'mep'); fx.anchor('<b>MEP</b>', fx.nodePos('ag_e', 6), 'mep'); fx.packet(ids, { color: TC.video, speed: 14, size: 0.35, tag: '<span class="ccm">DMM</span>' }); fx.packet([...ids].reverse(), { color: TC.video, speed: 14, size: 0.35, delay: 0.5, tag: '<span class="ccm">DMR · 1.8 ms</span>' }); fx.packet(ids, { color: TC.biz, speed: 14, size: 0.35, delay: 1.1, tag: '<span class="ccm">LMM</span>' }); },
        },
        {
          say: 'The access ring is cut between the bank and the router. After three missed CCMs the far MEP declares loss of continuity, raises an alarm, and sends AIS toward the customer so they know before they call.',
          run: (fx) => { const ids = fx.path('end_0_1', 'ag_e'); fx.focus(fx.pathLinks(ids)); fx.marker(fx.link(ids[0], ids[1]), 'cut'); fx.anchor('<b>MEP</b>', fx.nodePos('end_0_1', 6), 'mep'); fx.anchor('<b>LOC</b> alarm', fx.nodePos('ag_e', 6), 'note warn'); fx.spot('ag_e', TC.red); },
        },
      ],
    },
  ],

  xhaul: [
    {
      id: 'qos', name: 'QoS for 5G xhaul', tag: 'Ciena 5164 cell-site router',
      summary: 'Radio traffic goes first; everything else waits.',
      steps: [
        {
          say: 'A cell-site router carries fronthaul (eCPRI), midhaul, backhaul and timing on one fibre. Fronthaul gets the strict-priority queue: its latency budget is about 100 µs.',
          run: (fx) => { fx.queue('xh_bright', [{ name: 'Fronthaul', color: TC.voice, fill: 0.25 }, { name: 'Timing', color: TC.video, fill: 0.1 }, { name: 'Midhaul', color: TC.biz, fill: 0.4 }, { name: 'Backhaul', color: TC.best, fill: 0.5 }]); const ids = glowPath(fx, ['end_3_0', 'xh_bright']); [TC.voice, TC.video, TC.biz, TC.best].forEach((c, i) => fx.packet(ids, { color: c, speed: 10, delay: i * 0.45, size: 0.45 })); fx.spot('end_3_0', '#00a6d6'); },
        },
        {
          say: 'Everything else is shaped behind it, so a busy backhaul can never delay the radio. The queue readout shows backhaul backing up while fronthaul stays almost empty.',
          run: (fx) => { fx.queue('xh_bright', [{ name: 'Fronthaul', color: TC.voice, fill: 0.1 }, { name: 'Timing', color: TC.video, fill: 0.05 }, { name: 'Midhaul', color: TC.biz, fill: 0.55 }, { name: 'Backhaul', color: TC.best, fill: 0.95 }]); const ids = glowPath(fx, ['end_3_0', 'xh_bright']); [TC.voice, TC.voice, TC.voice, TC.best].forEach((c, i) => fx.packet(ids, { color: c, speed: 10, delay: i * 0.4, size: 0.45 })); },
        },
      ],
    },
    {
      id: 'cfm', name: 'CFM to the cell site', tag: '802.1ag / Y.1731 on the 5164',
      summary: 'Know a cell has gone dark in milliseconds, not from the complaints.',
      steps: [
        {
          say: 'A MEP on the cell-site router and one on the pre-aggregation hub exchange CCMs continuously. The operator sees a site go dark within milliseconds.',
          run: (fx) => ccm(fx, 'end_3_0', 'xh_bright'),
        },
        {
          say: 'On a fibre cut the hub raises loss of continuity for that one site while the rest of the ring keeps running.',
          run: (fx) => { const ids = fx.path('end_3_0', 'xh_bright'); fx.focus(fx.pathLinks(ids)); fx.marker(fx.link(ids[0], ids[1]), 'cut'); fx.anchor('<b>MEP</b>', fx.nodePos('end_3_0', 6), 'mep'); fx.anchor('<b>LOC</b> Cell site 1', fx.nodePos('xh_bright', 6), 'note warn'); fx.spot('xh_bright', TC.red); },
        },
      ],
    },
    {
      id: 'ring', name: 'G.8032 on the xhaul ring', tag: 'Ciena 5166 pre-aggregation routers',
      summary: 'Every cell site reachable from both uplinks.',
      steps: [
        {
          say: 'The pre-aggregation hubs and their cell sites sit on one Ethernet ring, protected by G.8032 like the metro ring. The RPL is out at Leafdale, so traffic from the south normally flows east to the Edgewater uplink.',
          run: (fx) => { fx.focus(fx.linksOf()); fx.marker(fx.link('xh_leaf', 'end_7_0'), 'block'); const ids = fx.path('xh_south', 'cr_edge', [fx.link('xh_leaf', 'end_7_0')]); fx.packet(ids, { color: '#00a6d6', speed: 14 }); fx.packet(ids, { color: '#00a6d6', speed: 14, delay: 1.5 }); },
        },
        {
          say: 'A cut east of Spinehill unblocks the RPL in under 50 ms and the southern sites swing round to the Gateway Bay uplink. No cell site loses service.',
          run: (fx) => { const cut = fx.link('xh_spine', 'end_4_0'); fx.marker(cut, 'cut'); const ids = fx.path('xh_south', 'cr_gw', [cut]); glowPath(fx, ids); fx.packet(ids, { color: '#00a6d6', speed: 14 }); fx.packet(ids, { color: '#00a6d6', speed: 14, delay: 1.5 }); },
        },
      ],
    },
  ],
};

// Steps through a topic on a view's fx. Each step starts from a clean scene.
export class TechPlayer {
  constructor(fx) { this.fx = fx; this.topic = null; this.i = 0; }
  open(topic, i = 0) { this.topic = topic; return this.show(i); }
  show(i) {
    this.i = Math.max(0, Math.min(this.topic.steps.length - 1, i));
    this.fx.clear();
    this.topic.steps[this.i].run(this.fx);
    return this.topic.steps[this.i];
  }
  next() { return this.show(this.i + 1); }
  back() { return this.show(this.i - 1); }
  close() { this.fx.clear(); this.topic = null; }
}
