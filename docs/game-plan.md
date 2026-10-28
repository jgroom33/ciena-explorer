# Netlandia Quest: story plan for a game mode

Netlandia starts dark. Each mini-game wins back one part of the network, and each win ends with a short
lesson on what that win means in a real network. Win them all and the whole map is lit, ready to explore
freely.

> “I think doing the mini games is a way to slowly show the network. Otherwise, it's a bit boring to just
> openly explore.”

This is the plan: the whole story first, then each part filled in one level at a time.

## Premise: Lord Lag has switched off Netlandia

On the night of the big premiere, every screen in Popcorn Hill freezes on a spinning wheel. Lord Lag, who
hates anything that arrives on time, has sent his minions across Netlandia. They fill queues, dig up fibre,
start storms and knock the cell sites out of step. The map goes dark one network at a time.

You are the new apprentice at the Netlandia network operations center. Your guide is Pip, a small packet
with a header for a hat. Starting from one living room, you win the network back hop by hop, from the home
outward to the undersea cables where Lord Lag hides.

## Cast

| | Who | What they do |
|---|---|---|
| 🙂 | **You** | The apprentice. Every win promotes you one rank: Apprentice, Technician, Engineer, Architect, Chief of the NOC. |
| 📦 | **Pip** | A packet with a header hat. Explains each game in one line and cheers when you win. In Engineer mode Pip uses the real terms. |
| 😈 | **Lord Lag** | The nemesis. Shows up between levels with a taunt, and as the final boss at the submarine landing. |
| 👾 | **The Buffer Gremlin** | Spins the loading wheel on every screen in Popcorn Hill. |
| 🐘 | **The Elephant Flows** | Huge backups and downloads that stomp into the queues. “Oh no! Here come the elephant flows.” |
| 📢 | **The Broadcast Banshee** | Screams one frame into a loop until every port is full. |
| 🚜 | **Backhoe Bob** | Digs where he shouldn't, and always finds the fibre. |
| 🐞 | **The Jitterbugs** | Nudge timing packets late, so the cell sites drift out of step. |
| 🐷 | **The Spectrum Hog** | Takes the whole width of the light on a fibre for itself. |

## The route: eight levels, from the sofa to the seabed

The order follows a packet's trip outward: home, city, mobile, core, then the optical networks underneath.
Every level unlocks a layer that already exists in Netlandia and the explainers that go with it. That way
the game reuses the map, the packets and the queues that are already built.

| Level | Network | Mini-game | Villain |
|---|---|---|---|
| Prologue | Home fibre (PON) | Last Mile Dash | The Buffer Gremlin |
| 1 | Metro aggregation | Packet Tetris | The Elephant Flows |
| 2 | Business access | Storm Chaser | The Broadcast Banshee |
| 3 | Collector ring | Stop the Fiber Cut | Backhoe Bob |
| 4 | 5G mobile xhaul | Keep the Beat | The Jitterbugs |
| 5 | IP/MPLS core | Packet Race | Lord Lag |
| 6 | Lumen City metro optical | Rainbow Packing | The Spectrum Hog |
| 7 | Long-haul RLS mesh | Mesh Rescue | Backhoe Bob's crew |
| Finale | Submarine network | The Deep Boss | Lord Lag |

### Prologue · Home fibre (PON) · Last Mile Dash

Guide one packet of the premiere from the Couchwave cache to a home in Popcorn Hill: splitter, OLT,
aggregation router, cache. Tap the next hop before the Buffer Gremlin's wheel fills up. In the second
round the show isn't in the cache, so the packet has to go all the way to the origin, and players feel
how much longer it takes.

- **Villain:** The Buffer Gremlin
- **You died:** “Buffering… Movie night is over. 312 homes gave up.”
- **You won:** “You unlocked Home fibre. The premiere plays in every home.”
- **Why it works:** a cache a few hops from the sofa means the show starts at once and the core carries
  each title only once.
- **Unlocks:** `pon` layer · FTTH and the streaming CDN · Your film's journey

### Level 1 · Metro aggregation · Packet Tetris

Packets fall toward the uplink of the East aggregation router: voice, timing, video, business, web. Drop
each one into its queue. The queues drain at the speed of the link. Midway, the Elephant Flows arrive,
giant blocks of backup traffic. Put them in best effort, where they can wait, and keep the voice queue
from overflowing.

- **Villain:** The Elephant Flows
- **You died:** “The voice queue overflowed. Grandma's call to Coreburg dropped.”
- **You won:** “You unlocked the City collector ring. Voice and timing packets are EF, and nobody's call
  drops while the backups run.”
- **Why it works:** QoS marks each packet. EF (Expedited Forwarding) goes first in a small strict queue,
  and elephants wait in best effort, which can be delayed without anyone noticing.
- **Unlocks:** `agg` layer · Quality of service · Low-cost Ethernet aggregation

### Level 2 · Business access · Storm Chaser

Someone at Tidewell's Framefield office plugs a cable into two ports of the same switch. Each broadcast
frame now comes back as two, then four, then eight. The links fill up on screen. Find the loop and block
one link before the storm reaches 100%.

- **Villain:** The Broadcast Banshee
- **You died:** “Every port at 100%. The whole office is offline.”
- **You won:** “You unlocked Business connections. The loop is blocked and the office is back online.”
- **Why it works:** an Ethernet loop must keep one link blocked, or frames circle forever. That blocked link
  is what G.8032 calls the RPL, and storm control caps broadcasts at the edge.
- **Unlocks:** `access` layer · business customers on the rings

### Level 3 · Collector ring · Stop the Fiber Cut

Phase one: Backhoe Bob drives around Coreburg. Tap each digger before it reaches a marked fibre route,
which is the “call before you dig” check. Phase two: Bob gets one through anyway. The ring is cut, so open
the blocked link before the clock passes 50 ms. CFM heartbeats on screen show the moment the far end goes
silent.

- **Villain:** Backhoe Bob
- **You died:** “Too slow. Six businesses lost their connection and the phones are ringing at the NOC.”
- **You won:** “You saved the whole office from losing its internet connection. Traffic went the other way
  round the ring in 43 ms.”
- **Why it works:** CFM notices the cut within milliseconds, and G.8032 unblocks the RPL, so traffic takes
  the other side of the ring in under 50 ms.
- **Unlocks:** G.8032 ring protection · Connectivity fault management

### Level 4 · 5G mobile xhaul · Keep the Beat

A rhythm game. The cell sites pulse to a clock, and timing packets travel the ring on the beat. The
Jitterbugs nudge packets late. Tap to put timing and fronthaul in the top queue, and keep every cell site
in step. In the bonus round, place each DU close enough to its radio to stay inside the fronthaul delay
budget, as C-RAN or D-RAN.

- **Villain:** The Jitterbugs
- **You died:** “The cell sites drifted out of sync. Calls drop every time a phone moves between towers.”
- **You won:** “You unlocked the Mobile phone network. Timing and fronthaul ride first, and every cell site
  is in step.”
- **Why it works:** fronthaul and timing have tiny delay budgets, so they get the strictest queue, and the
  DU can only sit as far from the RU as that budget allows.
- **Unlocks:** `xhaul` layer · RAN split: RU, DU, CU · QoS for 5G xhaul · G.8032 on the xhaul ring

### Level 5 · IP/MPLS core · Packet Race

Your packet, the Tidewell video meeting, races Lord Lag's packet from Gateway Bay to Edgewater. Lord Lag
piles the morning backups onto the short way through Coreburg. Pick the labels that steer your packet round
the quiet way through Northport. Then a core link fails mid-race, and the backup path has to be ready
before it happens.

- **Villain:** Lord Lag, in person, with his congestion
- **You died:** “Your packet arrived 37 ms late. The meeting froze on the CEO's face.”
- **You won:** “You fixed it. The main path is back up, and the secondary paths aren't overloaded anymore.”
- **Why it works:** segment routing puts the path in the packet as a label stack. SR-TE moves one flow off a
  busy link, and TI-LFA has the detour ready before a link fails.
- **Unlocks:** `ipcore` and `vpn` layers · Segment routing · Video between offices · TI-LFA

### Level 6 · Lumen City metro optical · Rainbow Packing

Side A, under the routers. Tetris with light: each request is a wavelength of a certain width that has to
fit into the fibre's spectrum, the same colour all the way round the ring. The Spectrum Hog throws in a
block that takes half the band. Pack it without gaps and connect both data centers.

- **Villain:** The Spectrum Hog
- **You died:** “No room left on the fibre. The data centers can't talk.”
- **You won:** “You unlocked the City light ring. 400G between the data centers, on one fibre pair.”
- **Why it works:** a ROADM adds, drops or passes each wavelength. Planning the spectrum well puts more
  traffic on the same glass.
- **Unlocks:** `metro` and `dci` layers · Fixed ROADM ring · Ring protection · Data center interconnect

### Level 7 · Long-haul RLS mesh · Mesh Rescue

A storm crosses Netlandia, and Lord Lag's minions cut three long-haul fibres one after another. For each
cut, pick a new route for the wavelengths that were on it before the timer runs out, without sending them
over a fibre that is already full.

- **Villain:** Backhoe Bob's whole crew, in the rain
- **You died:** “Two towns went dark. The cuts beat you.”
- **You won:** “You unlocked the Countrywide light highway. Three cuts and not one town lost.”
- **Why it works:** a mesh with CDC ROADMs can send any wavelength any way round, so the control plane
  restores traffic after one cut after another.
- **Unlocks:** `backbone` and `regional` layers · The line system · CDC ROADMs · Mesh restoration

### Finale · Submarine network · The Deep Boss

Lord Lag's lair is on the seabed. He drags an anchor across one undersea cable, and the island across the
sea starts to go dark. In round one, move its traffic to the other cable before the island goes dark. In
round two, keep the repeaters powered while the repair ship is on its way. Lord Lag throws everything from
the earlier levels at you: elephants, a storm, Jitterbugs.

- **Villain:** Lord Lag
- **You died:** “The island is cut off. Lord Lag laughs. Try again?”
- **You won:** “Netlandia is back on, all of it. You are Chief of the NOC.”
- **Why it works:** islands land on more than one cable, so one can carry the other's traffic, and a powered
  line of repeaters keeps light strong across thousands of kilometres.
- **Unlocks:** `submarine` layer · Line terminals and repeaters · Free explore · Demo mode

## Every level, the same loop

1. **Taunt.** Lord Lag or a minion appears over the dark part of the map with one line. The camera flies
   there.
2. **Play.** A mini-game of one to two minutes, on the real map with the real nodes. Pip explains the
   controls in one sentence.
3. **Win or die.** Losing shows what it would mean in real life (“the whole office is offline”) and offers
   a retry. Winning lights up the layer.
4. **Unlock card.** “Congratulations, you unlocked …”, then why you won and how that win shows up in a real
   network. A button opens the matching explainer for anyone who wants more.

Example cards:

> **Explorer: You unlocked the City collector ring**
> You put calls in the fast lane and made the giant downloads wait. That's what real routers do: every
> packet gets a label for how urgent it is.

> **Engineer: You unlocked Metro aggregation**
> Voice and sync marked EF (DSCP 46) in a strict priority queue, elephant flows in best effort with WRED.
> Uplink 82% full, zero voice drops.

> **You died: Every port at 100%**
> The Broadcast Banshee won this round. In a real network, a loop with no blocked link takes the whole
> office offline in seconds. Try again?

## Modes

- **Story** is the new front door: the map starts dark and the levels unlock in order. Progress is saved in
  the browser.
- **Free explore** is today's Netlandia, everything lit. It stays one tap away from the start (“skip the
  story”), so nobody who just wants the map is forced through the games.
- **Demo** plays the story by itself, with Pip winning each level and the unlock cards on screen. It loops
  for a booth screen or the start of a talk.
- **Explorer and Engineer** both work in every mode. The games are the same, and only the words change, the
  way the explainers already do.

## Building it

| Step | What | Done when |
|---|---|---|
| 1 · Shell | Story mode on the start screen, locked layers drawn dark, progress saved, the taunt, unlock card and “you died” card | The map can lock and unlock a layer, with a card |
| 2 · First slice | Prologue and Level 1 (Last Mile Dash, Packet Tetris), built on the explainers' existing packets and queues | Someone new plays both and can say what EF means |
| 3 · Levels 2–5 | Storm Chaser, Stop the Fiber Cut, Keep the Beat, Packet Race | Side B fully playable |
| 4 · Levels 6–7, finale | Rainbow Packing, Mesh Rescue, The Deep Boss | The whole map unlocks |
| 5 · Demo mode | The story on autoplay | Loops unattended for ten minutes |

Each level is a module of its own in `js/games/` that gets the scene and the explainer helpers and reports
win or lose, so the levels can be built and reviewed one PR at a time.

## Decided

- **Lord Lag** stays the nemesis.
- **The outward order works.** Played the way a phone's packets travel: the cell towers, the city's
  businesses and homes, then the core. Finishing that packet world makes the undersea cables a new
  discovery, and across the ocean wait the optical networks.
- **The world starts under clouds.** You can't see what Netlandia looks like until you win each area
  back, and the clouds lift one network at a time.
- **Phone and touch** for every game.
- **Score**, so people at a booth can compete.
- **First, the scene-by-scene unlocks** (step 1, the shell), then the mini-games one at a time in the
  order they are played.

## Built so far: five levels

Every mini-game from the route above is built, and five more since (fifteen in all), and each one is a stop with its own villain.
The networks are grouped into five levels; the first four close with a final exam, the fifth is the fight
with Lord Lag.

| Level | Network | Stops (villain) | Closes with |
|---|---|---|---|
| 1 · The city | Metro aggregation | Last Mile Dash (the Buffer Gremlin 👾), Packet Tetris (the Elephant Flows 🐘), Storm Chaser (the Broadcast Banshee 📢) | final exam |
| 2 · The towers and the core | 5G mobile xhaul | Stop the Fiber Cut (Backhoe Bob 🚜), Keep the Beat (the Jitterbugs 🐞) | |
| | IP/MPLS core | Guard the Gate (the Botnet 🤖), Packet Race (Lord Lag) | final exam |
| 3 · Under the sea | Submarine | Repeater Rescue (the Anchor Dragger ⚓), Robot Dive (the Jellyfish Gang 🪼), Fiber Splice (the Big Swell 🌊), Cable Layer (the Kraken 🦑) | final exam |
| 4 · The light | Metro optical | Colour Memory (the Smudger 🦝), Rainbow Packing (the Spectrum Hog 🐷) | |
| | Long-haul | Light Path (Professor Prism 🔮), Mesh Rescue (Backhoe Bob's crew ⛈) | final exam |
| 5 · The final fight | | Lord Lag 😈 | the end |

- **Stops:** a network can have more than one game. Each stop opens with its villain's taunt; a win shows
  **Stop cleared** with a summary and the lesson, and the network is unlocked after its last stop. A loss
  is a retry from that stop, not from the start of the network.
- **Final exams:** the questions of every network in the level (plus a few extra for the levels with one
  network). If it is passed with a mistake, the card lists each missed question, the answer picked and
  the right one.
- **Level 5, a recap of everything:** four short rounds, one game picked at random from each level, with
  Lord Lag taunting between rounds and one heart gone for each round won. Beating him ends the story:
  “Netlandia is back on · Chief of the NOC” 🏆.
- **Ranks:** Apprentice, Technician, Engineer, Senior engineer, Lead engineer, Architect, Principal
  architect, Chief of the NOC.

The difficulty was lowered after the first playtests: slower packets, wider targets, 30 seconds per
question, and slow motion while you choose. The new games were tuned the same way, with robot players
that react late and slip now and then: they should win most rounds, while Lord Lag's race is just quick
enough that a slow player usually loses one of the three. The lesson, not the reflexes, is the challenge.

### The new games

- **Last Mile Dash** (city): homes ask for videos. A video the nearby cache has goes out at once; one it
  doesn't has to be fetched from far away first. Serve 14 before three homes give up.
- **Storm Chaser** (city): an office's switches are wired with loops; pick which links to block so every
  floor is still reached and no loop is left for a broadcast storm (spanning tree).
- **Stop the Fiber Cut** (towers): diggers head for the ring's fibres; tap them away, and when one gets
  through, choose what the ring does: switch to the other way round, wait, or reboot (ring protection).
- **Cable Layer** (sea): steer the new cable north, middle or south round underwater volcanoes,
  seamounts and fishing grounds where anchors would catch it, while the Kraken stirs the seabed.

## Keeping the mystery

From the playtests: “make it single path… don't allow the user to rotate the globe… don't allow the
cities to peek through. Make them wonder: what's next?” The order stays as it is (data, then the sea,
then the light), one linear path.

- **The camera follows the story.** In story mode the globe can't be spun or zoomed; it flies to each
  stop. Explore freely (or beat Lord Lag) and it is free again.
- **Nothing peeks through the clouds.** Towns, town names, huts and other equipment in a locked region
  stay hidden, and so does everything on a side of the world the story hasn't reached yet.
- **What's next? is a riddle.** The panel lists only the networks won back, then a ❓ row with a hint
  (“Something is moving under the sea…”) and how many places are still hidden. The next network's name
  shows only when its first villain appears; the win cards end with the next riddle too.
- **A dev menu** (`?dev` on the address): jump to any stop or to Lord Lag, clear the progress, forget
  everything, reload fresh past the browser's cache, and see when the bundle was built.

## Two scores and a notebook

From the playtests: “add educational score and mini game score, that adds up to one final score but keep
it divided”, and “a notebook where the lessons learned are saved, and keep track if they failed a question
or a test even if they passed after”.

- **🧠 Knowledge + 🎮 Games = score.** Exam answers go to knowledge; mini-games and the fight with Lord
  Lag go to games. The bar, the win cards, the end card and the notebook show both.
- **📓 The notebook** keeps, across restarts:
  - the lessons learned: each won game's lesson and each network's recap, level by level (levels not
    reached yet stay “???”);
  - every missed question with the answer picked and the right one, marked once it is answered right
    later, but never removed;
  - every game and exam tried: won first try, won after N losses, or not won yet.

## Ready for a booth

- **🏆 Board**: the ten best runs on the device, with both halves of the score and the rank reached;
  the end card asks for a name.
- **👤 New player**: offers the board to the player leaving, then resets progress, best score and
  notebook for the next one (the board stays).
- **Sounds**: little synthesized blips and jingles, no audio files; ☰ turns them off.
- **Checks on GitHub**: the tests run on every pull request, and `dist/netlandia.html` must be rebuilt
  (it now also carries the phone viewport, so the single file lays out on a phone).

## More styles: five more games

From the playtests: a tower defence (“tower defense style”), and other kinds of game so the levels stay
even. Levels 2, 3 and 4 now have four stops each; Level 1 keeps three.

- **Guard the Gate** (IP core, tower defence): build guards (access rules), detectives (deep inspection)
  and speed bumps (rate limiters) by the road to the data center; four waves teach plain bots, bots in
  disguise, a flood, and defence in depth. Simulated players who use a detective win; those who never
  do lose.
- **Robot Dive** (undersea, arcade): ping the fibre and follow the echo's mark (an OTDR) to the buried
  cut, dodging jellyfish on the robot's battery.
- **Fiber Splice** (undersea, precision): line the cores up on a rolling ship and fire the arc; offset
  becomes loss, and the losses add up to a budget.
- **Colour Memory** (metro, “Simon says”): repeat the hub's pattern of colours; each colour is a channel.
- **Light Path** (long haul, puzzle): turn the switches until the light runs from Prismfield to
  Spectraville; it shows live how far it gets.

Level 3 now tells a repair story: the anchor cuts the cable, the robot finds the cut, the ship splices
it, and a new cable is laid.

## Two ways to play, and Lord Lag's minions

- **⚡ Quick run** (about ten minutes, for a booth): one game per level, picked at random and played in its
  short version, then a two-question quiz from the level's exam; each win brings back the whole level.
  Lord Lag ends it with two rounds replaying games from the run. It has its own board. Less to read: one
  card before each game (villain, one line of taunt, a one-line tip), a breather after it (the minion
  beaten, a line of the game, the lesson's first sentence as a hint, no clock until "I'm ready"), the quiz,
  and a short win card; the full lessons wait in the notebook.
- **📖 Full story** (about an hour): every stop, every exam, and Lord Lag's four rounds.
- **The minions**: every villain is introduced as one of Lord Lag's minions (“😈 Lord Lag sends his
  minion”), and the notebook keeps a line-up: beaten minions by face and name, the rest as ❓.
