// Explorer-mode explainers: an introduction to networking told on the same six
// networks. No acronyms unless the step is there to introduce one. Same shape as
// TOPICS in tech.js, so the same player, the same effects and the same tests apply.
import { TC, glowPath, ofType, ccm } from './tech.js';

const OPTICAL = 'Optical transport';
const PACKETS = 'Packet networking';
const COLOURS = [TC.wave, TC.wave2, TC.wave3];

// Three beams of different colours running one path.
const rainbow = (fx, ids, tags = ['orange beam', 'purple beam', 'teal beam'], speed = 12) =>
  COLOURS.forEach((c, i) => fx.packet(ids, { color: c, speed, delay: i * 0.8, tag: tags[i] }));

export const BASICS = {
  longhaul: [
    {
      id: 'light', name: 'Data travels as light', tag: OPTICAL,
      summary: 'Every line on this map is a glass fibre, and the data inside it is a beam of light.',
      steps: [
        {
          say: 'Each line here is a glass fibre thinner than a hair, buried between the towns. Information does not travel through it as electricity: it travels as flashes of light, millions of them every second.',
          run: (fx) => fx.focus(fx.linksOf()),
        },
        {
          say: 'Watch one message leave Prismfield as a beam of light and ride the glass all the way to Lumen City. It never stops to be turned back into electricity on the way.',
          run: (fx) => { const ids = glowPath(fx, fx.path('bb_oak', 'hub_n')); fx.packet(ids, { color: TC.wave, speed: 12, tag: 'a beam of light' }); },
        },
        {
          say: 'Light gets dimmer the further it goes. Every 80 km or so a small hut gives the beam a boost, like a relay runner handing on the baton, so it arrives bright enough to read.',
          run: (fx) => { const ids = glowPath(fx, fx.path('bb_oak', 'hub_n')); for (const id of ofType(fx, 'ila')) fx.spot(id, TC.red); fx.packet(ids, { color: TC.wave, speed: 12 }); },
        },
      ],
    },
    {
      id: 'colours', name: 'Many colours in one fibre', tag: 'DWDM, in plain words',
      summary: 'One fibre carries many beams at once, as long as each one is a different colour.',
      steps: [
        {
          say: 'One fibre can carry many beams at the same time, as long as each beam is a different colour of light. Think of lanes on a road: the orange lane, the purple lane and the teal lane never get in each other’s way.',
          run: (fx) => rainbow(fx, glowPath(fx, fx.path('bb_oak', 'hub_n'))),
        },
        {
          say: 'Engineers call this DWDM, dense wavelength division multiplexing. “Wavelength” is just the scientific word for a colour, and “multiplexing” means sharing. Dozens of colours can share one strand of glass.',
          run: (fx) => rainbow(fx, glowPath(fx, fx.path('bb_oak', 'hub_n')), ['colour 1', 'colour 2', 'colour 3'], 14),
        },
        {
          say: 'At a junction a filter sorts the colours out again, like a prism splitting sunlight into a rainbow. The orange beam can be sent on toward Glassbridge while the purple one turns south to Spectraville.',
          run: (fx) => {
            fx.spot('bb_junc', TC.red);
            fx.focus([fx.link('bb_junc', 'bb_stone'), fx.link('bb_junc', 'bb_south')]);
            fx.packet(['bb_junc', 'bb_stone'], { color: TC.wave, speed: 10, tag: 'orange → east' });
            fx.packet(['bb_junc', 'bb_south'], { color: TC.wave2, speed: 10, delay: 0.8, tag: 'purple → south' });
          },
        },
      ],
    },
    {
      id: 'break', name: 'When a cable breaks', tag: OPTICAL,
      summary: 'A digger cuts a fibre. The light finds another road.',
      steps: [
        {
          say: 'A message from Prismfield to Lumen City normally takes the short road: through Crosspoint and Glassbridge.',
          run: (fx) => { const ids = glowPath(fx, ['bb_oak', 'bb_junc', 'bb_stone', 'hub_w']); fx.packet(ids, { color: TC.wave, speed: 12 }); fx.packet(ids, { color: TC.wave, speed: 12, delay: 1.5 }); },
        },
        {
          say: 'A digger working on the road between Crosspoint and Glassbridge cuts straight through the fibre. The light stops dead.',
          run: (fx) => { glowPath(fx, ['bb_oak', 'bb_junc']); fx.marker(fx.link('bb_junc', 'bb_stone'), 'cut'); fx.packet(['bb_oak', 'bb_junc'], { color: TC.wave, speed: 12 }); },
        },
        {
          say: 'Every junction has at least three roads out, so the network steers the beam round the break instead: down through Spectraville and Beambrook. It takes a little longer, but it gets there.',
          run: (fx) => { const cut = fx.link('bb_junc', 'bb_stone'); const ids = glowPath(fx, fx.path('bb_oak', 'hub_w', [cut])); fx.marker(cut, 'cut'); fx.packet(ids, { color: TC.wave, speed: 12 }); fx.packet(ids, { color: TC.wave, speed: 12, delay: 1.5 }); },
        },
        {
          say: 'Once the fibre is mended, the light goes back to the short road.',
          run: (fx) => { const ids = glowPath(fx, ['bb_oak', 'bb_junc', 'bb_stone', 'hub_w']); fx.packet(ids, { color: TC.wave, speed: 12 }); fx.packet(ids, { color: TC.wave, speed: 12, delay: 1.5 }); },
        },
      ],
    },
  ],

  metro: [
    {
      id: 'ring', name: 'Why a loop?', tag: OPTICAL,
      summary: 'Join the hubs in a circle and every one can be reached two ways round.',
      steps: [
        {
          say: 'The four city hubs are joined in a loop of fibre. In a loop, every hub can reach every other hub in two directions: clockwise or anticlockwise.',
          run: (fx) => { fx.focus([fx.link('hub_n', 'hub_e'), fx.link('hub_e', 'hub_s'), fx.link('hub_s', 'hub_w'), fx.link('hub_w', 'hub_n')]); for (const h of ['hub_n', 'hub_e', 'hub_s', 'hub_w']) fx.spot(h, '#14b8a6'); },
        },
        {
          say: 'A beam from the West hub to the East hub takes the short way round, passing straight through North without stopping.',
          run: (fx) => { const ids = glowPath(fx, ['hub_w', 'hub_n', 'hub_e']); fx.spot('hub_w', '#14b8a6'); fx.spot('hub_e', '#14b8a6'); fx.packet(ids, { color: TC.wave, speed: 12, tag: 'West → East' }); },
        },
        {
          say: 'The fibre between North and East is cut. The beam simply goes the other way round the loop, through South, in less than the blink of an eye. Nobody in the city notices.',
          run: (fx) => { fx.marker(fx.link('hub_n', 'hub_e'), 'cut'); const ids = glowPath(fx, ['hub_w', 'hub_s', 'hub_e']); fx.packet(ids, { color: TC.wave, speed: 12 }); fx.packet(ids, { color: TC.wave, speed: 12, delay: 1.4 }); },
        },
      ],
    },
    {
      id: 'dc', name: 'Data centers talk to each other', tag: OPTICAL,
      summary: 'The big computer buildings have private fibres of their own.',
      steps: [
        {
          say: 'The four data centers are the buildings where websites, videos and games live. They copy huge amounts of data between each other all day, so they have their own private loop of fibre.',
          run: (fx) => { const ring = ['dc_nw', 'dc_ne', 'dc_se', 'dc_sw', 'dc_nw']; glowPath(fx, ring); fx.packet(ring, { color: TC.wave2, speed: 14 }); fx.packet([...ring].reverse(), { color: TC.wave2, speed: 14, delay: 0.8 }); },
        },
        {
          say: 'The harbour data center is next to the beach cable station, so a data center on the other side of the ocean is just one more stop along the fibre.',
          run: (fx) => { const ids = glowPath(fx, ['dc_nw', 'dc_ne', 'dc_se', 'cls_port']); fx.spot('cls_port', '#ffc300'); fx.packet(ids, { color: TC.wave2, speed: 14, tag: 'to the undersea cable' }); },
        },
      ],
    },
  ],

  submarine: [
    {
      id: 'ocean', name: 'How light crosses an ocean', tag: OPTICAL,
      summary: 'A cable on the sea floor, with boosters along it, joins the two countries.',
      steps: [
        {
          say: 'An undersea cable is a bundle of glass fibres wrapped in plastic and steel, about as thick as a garden hose. A ship lays it on the sea floor from one beach to the other.',
          run: (fx) => { const ids = glowPath(fx, ['cls_port', 'cls_south']); fx.spot('cls_port', '#ffc300'); fx.spot('cls_south', '#ffc300'); fx.packet(ids, { color: TC.wave, speed: 24, tag: 'across the ocean' }); },
        },
        {
          say: 'Light fades on the way, so every 60 to 80 km a booster lying on the seabed gives it a push. Electricity for the boosters comes down a copper wire inside the cable from the station on the beach.',
          run: (fx) => { const ids = glowPath(fx, ['cls_port', 'cls_south']); for (const id of Object.keys(fx.byId).filter((x) => x.startsWith('rep_cls_port_cls_south'))) fx.spot(id, '#ffc300'); fx.packet(ids, { color: TC.wave, speed: 24 }); },
        },
        {
          say: 'Like any fibre, the cable carries many colours at once. The company that owns it can rent some colours to other companies, who send their own light down the same glass.',
          run: (fx) => rainbow(fx, glowPath(fx, ['cls_port', 'cls_isla_w']), ['owner', 'renter A', 'renter B'], 18),
        },
      ],
    },
  ],

  ipcore: [
    {
      id: 'packet', name: 'What is a packet?', tag: PACKETS,
      summary: 'Big things are chopped into small pieces, and each piece carries its address.',
      steps: [
        {
          say: 'A photo or a video is far too big to send in one go. So it is chopped into small pieces called packets, and every packet carries the address it is going to, like a parcel with a label.',
          run: (fx) => { for (const id of ['cr_gw', 'cr_c1', 'cr_c2', 'cr_north', 'cr_edge', 'cr_south']) fx.spot(id, TC.biz); fx.packet(['cr_gw', 'cr_c1'], { color: TC.biz, speed: 6, tag: '📦 to Edgewater' }); },
        },
        {
          say: 'A router is a sorting office. It reads the label on each packet and passes it to the next router in the right direction. Gateway Bay sends this one through the two Coreburg routers toward Edgewater.',
          run: (fx) => { const ids = glowPath(fx, ['cr_gw', 'cr_c1', 'cr_c2', 'cr_edge']); for (const id of ids) fx.anchor('<b>sort</b> → next hop', fx.nodePos(id, 6.5), 'note'); fx.packet(ids, { color: TC.biz, speed: 8, tag: '📦 to Edgewater' }); },
        },
        {
          say: 'Different packets from the same video can take different roads and arrive out of order. The computer at the far end puts the pieces back together before you see a single frame.',
          run: (fx) => {
            fx.focus([...fx.pathLinks(['cr_gw', 'cr_c1', 'cr_c2', 'cr_edge']), ...fx.pathLinks(['cr_gw', 'cr_north', 'cr_edge'])]);
            fx.packet(['cr_gw', 'cr_c1', 'cr_c2', 'cr_edge'], { color: TC.biz, speed: 10, tag: 'piece 1' });
            fx.packet(['cr_gw', 'cr_north', 'cr_edge'], { color: TC.video, speed: 10, delay: 0.4, tag: 'piece 2' });
            fx.packet(['cr_gw', 'cr_c1', 'cr_c2', 'cr_edge'], { color: TC.wave3, speed: 10, delay: 0.8, tag: 'piece 3' });
          },
        },
      ],
    },
    {
      id: 'reroute', name: 'Finding another way', tag: PACKETS,
      summary: 'A link fails and the routers send the packets round another road.',
      steps: [
        {
          say: 'Every main router has at least three neighbours. Packets from Gateway Bay to Edgewater normally go through the pair of routers in Coreburg.',
          run: (fx) => { const ids = glowPath(fx, ['cr_gw', 'cr_c1', 'cr_c2', 'cr_edge']); fx.packet(ids, { color: TC.biz, speed: 12 }); fx.packet(ids, { color: TC.biz, speed: 12, delay: 1.2 }); },
        },
        {
          say: 'The link between the two Coreburg routers fails. Within a blink, the first router starts sending the packets up through Northport instead. Your video keeps playing.',
          run: (fx) => { fx.marker(fx.link('cr_c1', 'cr_c2'), 'cut'); const ids = glowPath(fx, ['cr_gw', 'cr_c1', 'cr_north', 'cr_edge']); fx.spot('cr_c1', TC.red); fx.packet(ids, { color: TC.biz, speed: 11 }); fx.packet(ids, { color: TC.biz, speed: 11, delay: 1.2 }); },
        },
        {
          say: 'A moment later all the routers have agreed on the new best road, straight through Northport, until the broken link is repaired.',
          run: (fx) => { fx.marker(fx.link('cr_c1', 'cr_c2'), 'cut'); const ids = glowPath(fx, ['cr_gw', 'cr_north', 'cr_edge']); fx.packet(ids, { color: TC.biz, speed: 12 }); fx.packet(ids, { color: TC.biz, speed: 12, delay: 1.2 }); },
        },
      ],
    },
  ],

  aggregation: [
    {
      id: 'share', name: 'Sharing one road', tag: PACKETS,
      summary: 'A bank, an office, a hospital and a school all ride the same loop into the city.',
      steps: [
        {
          say: 'A bank branch has a small box that joins it to the network. Its packets ride a loop of fibre, shared with the neighbours, to a collector router and on to the main routers in the city.',
          run: (fx) => { const ids = glowPath(fx, fx.path('end_0_1', 'cr_c2')); fx.spot('end_0_1', '#ff4fa3'); fx.packet(ids, { color: '#ff4fa3', speed: 10, tag: 'from the bank' }); fx.packet([...ids].reverse(), { color: '#ff4fa3', speed: 10, delay: 1, tag: 'to the bank' }); },
        },
        {
          say: 'Sharing is what makes it affordable. Nobody gets their own fibre all the way to the city; the clever, expensive routers sit in the middle where everyone uses them.',
          run: (fx) => { for (const id of Object.keys(fx.byId).filter((x) => x.startsWith('end_'))) fx.spot(id, '#ff4fa3'); fx.focus(fx.linksOf('access')); },
        },
      ],
    },
    {
      id: 'first', name: 'Who goes first?', tag: PACKETS,
      summary: 'Phone calls, video and web pages share one link. Not all of them can wait.',
      steps: [
        {
          say: 'Phone calls, video, work files and ordinary web browsing all share one link from the East collector into the city. Each kind of traffic waits in its own queue.',
          run: (fx) => { fx.queue('ag_e', [{ name: 'Calls', color: TC.voice, fill: 0.2 }, { name: 'Video', color: TC.video, fill: 0.3 }, { name: 'Work', color: TC.biz, fill: 0.35 }, { name: 'Web', color: TC.best, fill: 0.4 }]); const ids = glowPath(fx, ['ag_e', 'cr_c2']); [TC.voice, TC.video, TC.biz, TC.best].forEach((c, i) => fx.packet(ids, { color: c, speed: 10, delay: i * 0.5, size: 0.45 })); fx.spot('ag_e', TC.frame); },
        },
        {
          say: 'When the link is busy, phone calls go first: a delayed voice sounds broken. A web page can wait a moment and nobody minds. If something has to be dropped, it is the web queue.',
          run: (fx) => { fx.queue('ag_e', [{ name: 'Calls', color: TC.voice, fill: 0.1 }, { name: 'Video', color: TC.video, fill: 0.45 }, { name: 'Work', color: TC.biz, fill: 0.6 }, { name: 'Web', color: TC.best, fill: 0.98 }]); const ids = glowPath(fx, ['ag_e', 'cr_c2']); [TC.voice, TC.voice, TC.video, TC.biz].forEach((c, i) => fx.packet(ids, { color: c, speed: 10, delay: i * 0.45, size: 0.45 })); fx.anchor('<b>web waits</b>', fx.nodePos('ag_e', 3.5), 'note warn'); },
        },
      ],
    },
    {
      id: 'heartbeat', name: 'Is it still working?', tag: PACKETS,
      summary: 'The two ends keep asking each other “are you there?”',
      steps: [
        {
          say: 'The bank’s box and the collector router send each other a tiny “are you there?” message ten times a second. As long as the answers keep coming, the link is known to be fine.',
          run: (fx) => ccm(fx, 'end_0_1', 'ag_e'),
        },
        {
          say: 'The fibre to the bank is cut. After three missed messages the router raises an alarm, so the engineers know about the problem before the bank has even picked up the phone.',
          run: (fx) => { const ids = fx.path('end_0_1', 'ag_e'); fx.focus(fx.pathLinks(ids)); fx.marker(fx.link(ids[0], ids[1]), 'cut'); fx.anchor('<b>alarm</b> bank unreachable', fx.nodePos('ag_e', 6), 'note warn'); fx.spot('ag_e', TC.red); },
        },
      ],
    },
  ],

  xhaul: [
    {
      id: 'call', name: 'Your phone call’s journey', tag: PACKETS,
      summary: 'Radio to the tower, then packets on a fibre, then the rest of the internet.',
      steps: [
        {
          say: 'Your phone talks by radio to the nearest tower. At the foot of the tower a small router turns your call into packets and sends them down a fibre.',
          run: (fx) => { const ids = glowPath(fx, ['end_3_0', 'xh_bright']); fx.spot('end_3_0', '#00a6d6'); fx.packet(ids, { color: TC.voice, speed: 10, tag: '📞 your call' }); },
        },
        {
          say: 'The towers sit on a loop of fibre round the countryside. The packets ride the loop to a main router, then on to the mobile network’s control center and the rest of the internet.',
          run: (fx) => { const ids = glowPath(fx, fx.path('end_3_0', 'cr_gw')); fx.spot('cr_gw', TC.biz); fx.packet(ids, { color: TC.voice, speed: 14, tag: '📞 to the internet' }); },
        },
        {
          say: 'The radio part of your call cannot wait even a thousandth of a second, so at every tower it jumps the queue ahead of everything else.',
          run: (fx) => { fx.queue('xh_bright', [{ name: 'Radio', color: TC.voice, fill: 0.1 }, { name: 'Clock', color: TC.video, fill: 0.05 }, { name: 'Calls', color: TC.biz, fill: 0.55 }, { name: 'Data', color: TC.best, fill: 0.95 }]); const ids = glowPath(fx, ['end_3_0', 'xh_bright']); [TC.voice, TC.voice, TC.voice, TC.best].forEach((c, i) => fx.packet(ids, { color: c, speed: 10, delay: i * 0.4, size: 0.45 })); },
        },
      ],
    },
    {
      id: 'twoways', name: 'Two ways out', tag: PACKETS,
      summary: 'The loop of towers joins the core in two places, so a cut never takes a tower off air.',
      steps: [
        {
          say: 'The loop of towers joins the main routers in two places: Gateway Bay and Edgewater. One link on the loop is kept closed on purpose so packets cannot go round and round for ever.',
          run: (fx) => { fx.focus(fx.linksOf()); fx.marker(fx.link('xh_leaf', 'end_7_0'), 'block'); const ids = fx.path('xh_south', 'cr_edge', [fx.link('xh_leaf', 'end_7_0')]); fx.packet(ids, { color: '#00a6d6', speed: 14 }); fx.packet(ids, { color: '#00a6d6', speed: 14, delay: 1.5 }); },
        },
        {
          say: 'A fibre east of Spinehill is cut. The closed link opens, and the towers in the south swing round to Gateway Bay instead. Every phone keeps working.',
          run: (fx) => { const cut = fx.link('xh_spine', 'end_4_0'); fx.marker(cut, 'cut'); const ids = fx.path('xh_south', 'cr_gw', [cut]); glowPath(fx, ids); fx.packet(ids, { color: '#00a6d6', speed: 14 }); fx.packet(ids, { color: '#00a6d6', speed: 14, delay: 1.5 }); },
        },
      ],
    },
  ],
};
