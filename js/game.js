// Netlandia Quest on screen: the start screen, the score bar and the challenge card.
// The story and its rules are in js/story.js; the globe is reached through `hooks`,
// so this file never touches the 3D scene itself.
import {
  STORY, STAGES, STORY_ORDER, STORY_LEVELS, BOSS_LEVEL, STORY_SECONDS, STORY_LIVES, loadStory, nextChapter, nextStage,
  isUnlocked, rankOf, storyDone, bossNext, startChallenge, answer, winStage, winChapter, winFinal, restartStory,
  FLAWLESS_BONUS, levelOf, examAt, jumpTo, TEASERS,
  loadNotebook, noteGame, noteExam, noteAnswer, noteChapter, questionOf, newNotebook, loadBoard, addToBoard,
  stagesOf, isQuick, quickQuiz, QUICK_QUIZ,
} from './story.js';
import { MINIGAMES, BOSS, SHORT_OPTS, TIPS } from './minigames.js';

const QUEST_KEY = 'netlandia.quest', PLAY_KEY = 'netlandia.play', NOTE_KEY = 'netlandia.notebook';
const BOARD_KEY = 'netlandia.board', SOUND_KEY = 'netlandia.sound';
const LAG_COLOR = '#e63946';     // Lord Lag's own colour, for the final fight
// the ?dev menu says which build is running; build.mjs stamps the bundle with its date
const BUILD = '__BUILD__';
// on with ?dev in the address, or five quick taps on the Netlandia title (for previews
// where the address can't be changed); the menu itself can switch it off again
const DEV_KEY = 'netlandia.dev';
let DEV = (() => { try { return new URLSearchParams(location.search).has('dev') || localStorage.getItem(DEV_KEY) === '1'; } catch { return false; } })();

// News on the win card when the next network is a new part of the world.
const DISCOVERY = {
  submarine: {
    plain: '🌊 New discovery! Something is moving under the sea…',
    eng: '🌊 New discovery: something lies on the ocean floor, linking the two countries…',
  },
  metro: {
    plain: '🌍 You crossed the ocean! Far away, a city made of light is flickering…',
    eng: '🌍 Across the ocean: side A, where the light runs. Something there is losing its colours…',
  },
};

// hooks: plain(), majorName(id), majorColor(id), setLocked(id, locked, animate),
// focusMajor(id), openMajor(id), toGlobe(), refresh(), pause(on) (stop drawing the globe
// while a mini-game has the screen), lockCamera(on) (the story steers the camera)
export function initQuest(hooks) {
  const el = (s) => document.querySelector(s);
  const intro = el('#intro'), bar = el('#quest'), card = el('#qcard');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const story = loadStory((() => { try { return JSON.parse(store.get(QUEST_KEY)); } catch { return null; } })());
  // the notebook outlives a restart: what was learned, and every slip on the way
  const notebook = loadNotebook((() => { try { return JSON.parse(store.get(NOTE_KEY)); } catch { return null; } })(), [...Object.keys(MINIGAMES), 'boss']);
  // the best runs on this device, for a booth; `boarded` says this run is already on it
  // one board per way of playing: a quick run's score can't be held against the full story's
  const boardKey = (mode) => (mode === 'quick' ? `${BOARD_KEY}.quick` : BOARD_KEY);
  const boards = Object.fromEntries(['quick', 'full'].map((m) => [m, loadBoard((() => { try { return JSON.parse(store.get(boardKey(m))); } catch { return null; } })())]));
  let boarded = false;
  let playing = store.get(PLAY_KEY) === 'story';
  let view = null;            // what the card shows: { kind, id, challenge, ... }
  let timer = null, asked = 0;
  let play = null;            // a mini-game running: { game, state, raf, canvas }

  // ------------------------------------------------ sounds: little synth blips, no files
  let soundOn = store.get(SOUND_KEY) !== 'off', actx = null, lastBlip = 0;
  const TUNES = {
    good: [[660, 0.07], [880, 0.1]],
    bad: [[196, 0.16, 'square', 0.05]],
    blipGood: [[880, 0.05, 'triangle', 0.04]],
    blipBad: [[150, 0.08, 'square', 0.03]],
    win: [[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.22]],
    lose: [[392, 0.14], [330, 0.14], [262, 0.3]],
    fanfare: [[523, 0.1], [523, 0.1], [523, 0.1], [784, 0.25], [659, 0.12], [784, 0.12], [1047, 0.4]],
  };
  function sfx(name) {
    if (!soundOn) return;
    try {
      actx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      let at = actx.currentTime + 0.01;
      for (const [f, d, type = 'triangle', gain = 0.08] of TUNES[name]) {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(gain, at); g.gain.exponentialRampToValueAtTime(0.0001, at + d);
        o.connect(g).connect(actx.destination); o.start(at); o.stop(at + d + 0.02);
        at += d * 0.92;
      }
    } catch {}
  }
  // a mini-game's own "+100" or "Missed!" floats, heard as a blip (not too often)
  const heard = new WeakSet();
  function blips(st) {
    for (const f of [...(st?.fx ?? []), ...(st?.sub?.fx ?? [])]) {
      if (heard.has(f)) continue;
      heard.add(f);
      const now = performance.now();
      if (now - lastBlip > 90) { lastBlip = now; sfx(f.good ? 'blipGood' : 'blipBad'); }
    }
  }

  const save = () => { store.set(QUEST_KEY, JSON.stringify(story)); store.set(NOTE_KEY, JSON.stringify(notebook)); };
  const num = (x) => x.toLocaleString('en');
  // points won, split the way the score is: games and knowledge
  const gained = (play, know = 0) => [play ? `+${num(play)} 🎮` : '', know ? `+${num(know)} 🧠` : ''].filter(Boolean).join(' · ') || '+0';
  const say = (pair) => (hooks.plain() ? pair.plain : pair.eng);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const locked = (id) => playing && !isUnlocked(story, id);
  // open, next (locked but named) or hidden (still in the clouds, not even named)
  const status = (id) => (!locked(id) ? 'open' : id === nextChapter(story) ? 'next' : 'hidden');
  // the story is on: the camera follows it and the map keeps its secrets
  const storyOn = () => playing && !storyDone(story);
  // the next network keeps its name a mystery until its first villain shows up
  const seen = new Set();
  const revealed = (id) => id !== nextChapter(story) || story.stage > 0 || seen.has(id);
  const riddle = (id) => say(TEASERS[id]);

  // ------------------------------------------------ the globe follows the story
  function applyLocks(animate = null) {
    const lift = [].concat(animate ?? []);
    for (const id of STORY_ORDER) hooks.setLocked(id, locked(id), lift.includes(id));
    hooks.lockCamera(storyOn());
    hooks.refresh();
  }

  // ------------------------------------------------ the score bar
  function renderBar() {
    const dev = DEV ? '<button class="q-menu q-dev" data-q="dev" aria-label="Dev menu">🛠</button>' : '';
    if (!playing) {
      bar.innerHTML = `<button class="q-play" data-q="intro">🎮 <b>Netlandia Quest</b><span>play to unlock the map</span></button>${dev}`;
      return;
    }
    const next = nextChapter(story), gid = nextStage(story), words = hooks.plain() ? 'plain' : 'eng';
    const lvl = next ? levelOf(next) : BOSS_LEVEL;
    const label = next ? (revealed(next) ? `${esc(hooks.majorName(next))} · ${esc(MINIGAMES[gid].name[words])}` : `❓ ${hooks.plain() ? 'What\'s next?' : 'Unknown'}`) : bossNext(story) ? '😈 The final fight' : '';
    bar.innerHTML = `
      <div class="q-stats"><span class="q-rank">${esc(rankOf(story))}</span>
        <span class="q-score"><b>${num(story.score)}</b> pts</span>
        <span class="q-split" title="Knowledge (questions and exams) and games">🧠 ${num(story.know)} · 🎮 ${num(story.play)}</span>
        <span class="q-prog">${isQuick(story) ? '⚡ ' : ''}${storyDone(story) ? '' : `Level ${lvl.n} · `}${story.unlocked.length} / ${STORY_ORDER.length} unlocked</span></div>
      ${label ? `<button class="q-next" data-q="next" style="--c:${next ? hooks.majorColor(next) : LAG_COLOR}">Next: ${label} ▶</button>` : '<button class="q-next" data-q="done">🏆 All done</button>'}
      <button class="q-menu" data-q="notebook" aria-label="Your notebook">📓</button>
      <button class="q-menu" data-q="intro" aria-label="Quest menu">☰</button>${dev}`;
  }

  // ------------------------------------------------ the start screen
  function showIntro() {
    closeCard();
    const started = story.unlocked.length > 0 || story.stage > 0;
    intro.innerHTML = `
      <div class="i-box">
        <span class="i-face" aria-hidden="true">😈</span>
        <h2>Netlandia Quest</h2>
        <p>${hooks.plain()
          ? 'Lord Lag has switched off Netlandia. Win back each network from his minions, one game at a time, through five levels, and the map lights up as you go.'
          : 'Lord Lag has taken Netlandia down. Five levels: win back each network, from the city edge to the ocean floor, and each scene unlocks as you go.'}</p>
        ${story.best ? `<p class="i-best">Best score: <b>${num(story.best)}</b>${story.score ? ` · now 🧠 ${num(story.know)} + 🎮 ${num(story.play)}` : ''}</p>` : ''}
        <div class="i-btns">
          ${started && !storyDone(story) ? `<button class="primary" data-q="play">▶ Continue ${isQuick(story) ? 'the quick run' : 'the full story'}</button>` : ''}
          <button class="${started && !storyDone(story) ? '' : 'primary '}i-mode" data-q="play-quick">⚡ ${started ? 'New quick run' : 'Quick run'}<small>${hooks.plain() ? 'one game a level · about 10 minutes' : '4 games + Lord Lag · ~10 min'}</small></button>
          <button class="i-mode" data-q="play-full">📖 ${started ? 'New full story' : 'Full story'}<small>${hooks.plain() ? 'every game and every exam · about an hour' : '15 games, 4 exams, Lord Lag · ~1 h'}</small></button>
          <button data-q="explore">Explore freely</button>
          ${notebookEmpty() ? '' : '<button data-q="notebook">📓 Your notebook</button>'}
          ${started || !notebookEmpty() ? '<button data-q="newplayer">👤 New player</button>' : ''}
          <button data-q="sound" aria-pressed="${soundOn}">${soundOn ? '🔊 Sound on' : '🔇 Sound off'}</button>
        </div>
        ${boards.quick.length ? `<h3 class="b-title">🏆 Top quick runs</h3>${boardHtml(-1, 5, 'quick')}` : ''}
        ${boards.full.length ? `<h3 class="b-title">🏆 Top full stories</h3>${boardHtml(-1, 5, 'full')}` : ''}
      </div>`;
    intro.hidden = false;
  }
  // ------------------------------------------------ the board
  function boardHtml(mine = -1, max = 10, mode = story.mode) {
    const board = boards[mode];
    if (!board.length) return '';
    return `<ol class="board">${board.slice(0, max).map((e, i) => `<li class="${i === mine ? 'mine' : ''}"><span class="b-pos">${['🥇', '🥈', '🥉'][i] ?? i + 1}</span><b>${esc(e.name)}</b><span class="b-rank">${esc(e.rank)}</span><span class="b-pts"><b>${num(e.score)}</b><small>🧠 ${num(e.know)} · 🎮 ${num(e.play)}</small></span></li>`).join('')}</ol>`;
  }
  const nameField = (label) => `<label class="b-name"><span>${label}</span><input id="b-name" maxlength="12" autocomplete="off" placeholder="${hooks.plain() ? 'Your name or initials' : 'Name or initials'}"></label>`;
  // put this run on the board under the name typed in; returns its place, or -1
  function boardIt() {
    const name = document.getElementById('b-name')?.value ?? '';
    if (boarded) return -1;
    const at = addToBoard(boards[story.mode], name, story);
    if (at >= 0) { boarded = true; store.set(boardKey(story.mode), JSON.stringify(boards[story.mode])); sfx('win'); }
    return at;
  }
  // 👤 New player: offer the board to the one leaving, then a clean start for the next
  function showNewPlayer() {
    closeCard();
    const plain = hooks.plain(), offer = story.score > 0 && !boarded;
    intro.innerHTML = `
      <div class="i-box i-player">
        <h2>👤 New player</h2>
        <p>${plain ? 'The next person starts from the beginning, with a fresh notebook.' : 'Progress, score and notebook are reset for the next player.'}</p>
        ${offer ? `<p class="i-best">This run: <b>${num(story.score)}</b> pts (🧠 ${num(story.know)} + 🎮 ${num(story.play)}) · ${esc(rankOf(story))}</p>${nameField(plain ? 'Put it on the board first?' : 'Add this run to the board')}` : ''}
        <div class="i-btns">
          ${offer ? '<button class="primary" data-q="np-save">🏆 Save and hand over</button><button data-q="np-go">Hand over without saving</button>' : '<button class="primary" data-q="np-go">Start fresh ▶</button>'}
          <button data-q="intro">Cancel</button>
        </div>
      </div>`;
    intro.hidden = false;
    document.getElementById('b-name')?.focus();
  }
  function newPlayer() {
    restartStory(story);
    story.best = 0;
    Object.assign(notebook, newNotebook());
    boarded = false;
    save();
    setPlaying(true);
    applyLocks();
    showIntro();
  }

  // ------------------------------------------------ the notebook
  const notebookEmpty = () => !Object.keys(notebook.games).length && !Object.keys(notebook.misses).length && !notebook.won.length;
  let nbFrom = null;
  function showNotebook() {
    nbFrom = intro.hidden ? null : 'intro';
    closeCard();
    const plain = hooks.plain(), words = plain ? 'plain' : 'eng';
    const gameName = (gid) => (gid === 'boss' ? BOSS.name[words] : MINIGAMES[gid].name[words]);
    const record = (x) => {
      const lost = x.tries - x.wins;
      return x.wins ? (lost ? `✓ won · lost ${lost}× on the way` : '✓ won first try') : `✗ lost ${lost}× · not won yet`;
    };
    // the lessons, level by level; a level not reached yet keeps its secret
    const levelItems = STORY_LEVELS.filter((l) => !l.boss).map((l) => [l, l.chapters.flatMap((id) => [
      ...STORY[id].stages.filter((gid) => notebook.games[gid]?.wins).map((gid) => `<dt>🎮 ${esc(gameName(gid))}</dt><dd>${esc(say(STAGES[gid].lesson))}</dd>`),
      ...(notebook.won.includes(id) ? [`<dt>🌐 ${esc(hooks.majorName(id))}</dt><dd>${esc(say(STORY[id].recap))}</dd>`] : []),
    ])]);
    // the latest level with something in it opens; the others fold away
    const latest = levelItems.filter(([, items]) => items.length).at(-1)?.[0];
    const lessons = levelItems.map(([l, items]) => (items.length
      ? `<details${l === latest ? ' open' : ''}><summary>Level ${l.n} · ${esc(say(l.name))}</summary><dl>${items.join('')}</dl></details>`
      : `<p class="nb-locked">Level ${l.n} · ??? <span>🔒 still under the clouds</span></p>`)).join('');
    const misses = Object.entries(notebook.misses).map(([key, m]) => {
      const q = say(questionOf(key));
      const yours = [...new Set(m.picks)].map((p) => (p == null ? (plain ? 'no answer, the time ran out' : 'no answer (time-out)') : q.a[p]));
      return `<li class="${m.fixed ? 'fixed' : ''}"><b>${esc(q.q)}</b>
        <span class="no">✗ ${plain ? 'You said' : 'Yours'}: ${yours.map(esc).join(' · ')}${m.times > 1 ? ` (missed ${m.times}×)` : ''}</span>
        <span class="yes">✓ ${plain ? 'Right answer' : 'Correct'}: ${esc(q.a[0])}</span>
        <span class="nb-tag">${m.fixed ? (plain ? '✓ You got it right later' : '✓ Since answered correctly') : (plain ? '↻ Not answered right yet' : '↻ Still open')}</span></li>`;
    }).join('');
    const order = [...STORY_ORDER.flatMap((id) => STORY[id].stages), 'boss'];
    const games = order.filter((gid) => notebook.games[gid]).map((gid) => `<li><b>${esc(gameName(gid))}</b><span>${record(notebook.games[gid])}</span></li>`);
    const exams = STORY_LEVELS.filter((l) => !l.boss && notebook.exams[l.chapters.at(-1)]).map((l) => `<li><b>Level ${l.n} exam</b><span>${record(notebook.exams[l.chapters.at(-1)])}</span></li>`);
    intro.innerHTML = `
      <div class="i-box i-notebook">
        <h2>📓 ${plain ? 'Your notebook' : 'Notebook'}</h2>
        <div class="nb-scores">
          <span><i>🧠</i><b>${num(story.know)}</b>${plain ? 'what you know' : 'knowledge'}<small>questions and exams</small></span>
          <span><i>🎮</i><b>${num(story.play)}</b>games<small>the mini-games</small></span>
          <span class="nb-total"><i>=</i><b>${num(story.score)}</b>points<small>best ${num(story.best)}</small></span>
        </div>
        <h3>${plain ? 'What you have learned' : 'Lessons learned'}</h3>
        ${notebook.won.length || Object.values(notebook.games).some((g) => g.wins) ? lessons : `<p class="nb-empty">${plain ? 'Win a game and its lesson is written here.' : 'Lessons appear here as stops are cleared.'}</p>`}
        <h3>😈 ${plain ? 'Lord Lag\'s minions' : 'Lord Lag\'s minions beaten'}</h3>
        <ul class="nb-minions">${order.filter((gid) => gid !== 'boss' && STAGES[gid].villain.name !== 'Lord Lag').map((gid) => {
          const v = STAGES[gid].villain, beaten = notebook.games[gid]?.wins;
          return `<li class="${beaten ? 'beaten' : ''}" title="${beaten ? esc(v.name) : '???'}"><span>${beaten ? v.face : '❓'}</span><small>${beaten ? esc(v.name) : '???'}</small></li>`;
        }).join('')}<li class="${notebook.games.boss?.wins ? 'beaten boss' : 'boss'}"><span>${notebook.games.boss?.wins ? '😈' : '❓'}</span><small>${notebook.games.boss?.wins ? 'Lord Lag' : '???'}</small></li></ul>
        <h3>${plain ? 'Questions you missed' : 'Missed questions'}</h3>
        ${misses ? `<ul class="nb-misses">${misses}</ul>` : `<p class="nb-empty">${plain ? 'None yet. Every miss lands here, even after you get it right.' : 'None so far. Every miss is kept here, even once answered correctly.'}</p>`}
        <h3>${plain ? 'Your games and exams' : 'Attempts'}</h3>
        ${games.length || exams.length ? `<ul class="nb-record">${[...games, ...exams].join('')}</ul>` : `<p class="nb-empty">${plain ? 'Nothing played yet.' : 'No attempts yet.'}</p>`}
        <div class="i-btns"><button class="primary" data-q="nbclose">Close</button></div>
      </div>`;
    intro.hidden = false;
  }

  // ------------------------------------------------ the ?dev menu, for testing
  function showDev() {
    closeCard();
    const words = hooks.plain() ? 'plain' : 'eng';
    intro.innerHTML = `
      <div class="i-box i-dev">
        <h2>🛠 Dev menu</h2>
        <p class="i-best">Build: <b>${BUILD.startsWith('__') ? 'source files (not the bundle)' : esc(BUILD)}</b> · ${esc(rankOf(story))} · ${story.score.toLocaleString('en')} pts</p>
        <h3>🎮 Play one game</h3>
        <p class="dev-note">Just that game, as many times as you like. The story, the score and the notebook stay as they are.</p>
        ${STORY_LEVELS.map((l) => `<div class="dev-row"><b>Level ${l.n} · ${esc(say(l.name))}</b><span>${l.boss
          ? '<button data-dev="try:boss">😈 Lord Lag</button>'
          : l.chapters.flatMap((id) => STORY[id].stages.map((gid) => `<button data-dev="try:${gid}:${id}">${esc(MINIGAMES[gid].name[words])}</button>`)).join('')}</span></div>`).join('')}
        <h3>⏩ Jump the story to a stop</h3>
        <p class="dev-note">Your progress moves there: everything before it counts as won.</p>
        ${STORY_LEVELS.map((l) => `<div class="dev-row"><b>Level ${l.n} · ${esc(say(l.name))}</b><span>${l.boss
          ? '<button data-dev="boss">😈 Lord Lag</button>'
          : l.chapters.flatMap((id) => STORY[id].stages.map((gid, k) => `<button data-dev="jump:${id}:${k}">${esc(MINIGAMES[gid].name[words])}</button>`)).join('')}</span></div>`).join('')}
        <div class="i-btns">
          <button data-dev="clear">Clear progress</button>
          <button data-dev="wipe">Forget everything</button>
          <button data-dev="fresh">Reload fresh</button>
          <button data-dev="hide">Hide the dev menu</button>
          <button class="primary" data-dev="close">Close</button>
        </div>
      </div>`;
    intro.hidden = false;
  }
  function dev(what) {
    const [cmd, id, k] = what.split(':');
    // practice: one game on its own, nothing banked
    if (cmd === 'try') { intro.hidden = true; hooks.toGlobe(); openCard(practiceOf(id, k)); return; }
    if (cmd === 'hide') { DEV = false; try { localStorage.removeItem(DEV_KEY); } catch {} intro.hidden = true; renderBar(); return; }
    if (cmd === 'jump' || cmd === 'boss') { jumpTo(story, cmd === 'boss' ? null : id, +k || 0); save(); setPlaying(true); goNext(); }
    else if (cmd === 'clear') { restartStory(story); story.best = 0; save(); setPlaying(true); showDev(); }
    else if (cmd === 'wipe') { try { localStorage.removeItem(QUEST_KEY); localStorage.removeItem(PLAY_KEY); localStorage.removeItem(NOTE_KEY); } catch {} location.reload(); }
    // a new address, so the browser can't hand back the old page from its cache
    else if (cmd === 'fresh') location.replace(`${location.pathname}?dev&v=${Date.now()}${location.hash}`);
    else if (cmd === 'close') intro.hidden = true;
  }

  const practiceOf = (gid, id) => (gid === 'boss' ? { kind: 'game', boss: true, practice: true } : { kind: 'game', id, gid, practice: true });
  // five quick taps on the title switch the dev menu on (and open it): the map's title,
  // or the start screen's, since that screen covers the map on a first visit
  {
    let taps = [];
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.title h1, #intro .i-box h2')) return;
      const now = performance.now();
      taps = [...taps.filter((x) => now - x < 3000), now];
      if (taps.length < 5) return;
      taps = [];
      DEV = true;
      try { localStorage.setItem(DEV_KEY, '1'); } catch {}
      renderBar(); showDev();
    });
  }

  function setPlaying(on) {
    playing = on;
    store.set(PLAY_KEY, on ? 'story' : 'explore');
    intro.hidden = true;
    if (on) hooks.toGlobe();
    applyLocks();
    renderBar();
  }

  // ------------------------------------------------ the challenge card
  function openCard(v) {
    stopTimer();
    stopGame();
    view = v;
    renderCard();
    card.hidden = false;
  }
  function closeCard() {
    stopTimer();
    stopGame();
    view = null;
    card.hidden = true;
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  // what comes next: the next game of the network being won back, or the final fight
  function goNext() {
    const id = nextChapter(story);
    if (id) taunt(id, nextStage(story));
    else if (bossNext(story)) { hooks.toGlobe(); openCard({ kind: 'how', boss: true }); }
    else openCard({ kind: 'done' });
  }
  function taunt(id, gid) {
    hooks.toGlobe();
    hooks.focusMajor(id);
    if (!seen.has(id)) { seen.add(id); renderBar(); hooks.refresh(); }
    // a quick run puts the villain and the how-to on one short card
    openCard({ kind: isQuick(story) ? 'quickstart' : 'taunt', id, gid });
  }
  // a lesson's first sentence, as a hint before the quiz
  const firstSentence = (s) => (s.match(/^[^.!?]+[.!?]/) ?? [s])[0];
  // a villain's taunt, cut down to its first sentence or two
  const shortTaunt = (s) => {
    const parts = s.match(/[^.!?…]+[.!?…]+["”]?\s*/g) ?? [s];
    let out = '';
    for (const p of parts) { out += p; if (out.length >= 40) break; }
    return out.trim();
  };
  // the questions missed in a challenge, with what was picked and the right answer
  const reviewOf = (c) => (!c?.wrong?.length ? '' : `<dl class="q-review"><dt>${hooks.plain() ? 'Questions to look at again' : 'Review'}</dt>${c.wrong.map((w) => {
    const q = say(c.questions[w.i]);
    const yours = w.pick == null ? (hooks.plain() ? 'No answer: the time ran out' : 'No answer (time-out)') : esc(q.a[w.pick]);
    return `<dd><b>${esc(q.q)}</b><span class="no">✗ ${hooks.plain() ? 'You said' : 'Yours'}: ${yours}</span><span class="yes">✓ ${hooks.plain() ? 'Right answer' : 'Correct'}: ${esc(q.a[0])}</span></dd>`;
  }).join('')}</dl>`);
  // the game a card plays: one of a network's stops, or the fight with Lord Lag
  const gameOf = (v) => (v.boss ? BOSS : MINIGAMES[v.gid]);
  // every stop of a level, in order, to say "stop 2 of 3"
  const stopsOf = (lvl) => [...new Set(lvl.chapters.flatMap((c) => stagesOf(story, c)))];
  const lastStage = (id, gid) => stagesOf(story, id).at(-1) === gid;
  // the questions that close a level: the full exam, or a quick run's short quiz
  const examFor = (id) => (isQuick(story) ? quickQuiz(id) : examAt(id));
  const examName = (lvl) => (isQuick(story) ? `Level ${lvl.n} quiz` : `Level ${lvl.n} final exam`);
  // every villain but Lord Lag himself works for him
  const minion = (v) => (v.name === 'Lord Lag' ? v.name : `${v.name}, Lord Lag's minion`);

  function renderCard() {
    const v = view, words = hooks.plain() ? 'plain' : 'eng';
    const ch = v.id ? STORY[v.id] : null, name = v.id ? esc(hooks.majorName(v.id)) : '';
    const lvl = v.boss || !v.id ? BOSS_LEVEL : levelOf(v.id);
    const stops = stopsOf(lvl), stop = stops.indexOf(v.gid) + 1;
    const where = `${isQuick(story) && !v.practice ? '⚡ ' : ''}Level ${lvl.n} · ${esc(say(lvl.name))}${stop && stops.length > 1 ? ` · stop ${stop} of ${stops.length}` : ''}`;
    const stage = v.gid ? STAGES[v.gid] : null;
    card.style.setProperty('--c', v.boss || !v.id ? LAG_COLOR : hooks.majorColor(v.id));
    card.dataset.kind = v.kind;
    if (v.kind === 'taunt') {
      card.innerHTML = `
        <span class="q-level-tag">${where}</span>
        <div class="q-villain"><span class="q-face" aria-hidden="true">${stage.villain.face}</span>
          <div><span class="q-minion">${stage.villain.name === 'Lord Lag' ? '😈 Lord Lag himself' : '😈 Lord Lag sends his minion'}</span><span class="q-k">${esc(stage.villain.name)} · ${esc(MINIGAMES[v.gid].name[words])}</span><h3>${name}</h3></div></div>
        <p class="q-say">“${esc(say(stage.taunt))}”</p>
        <div class="q-btns"><button data-q="later">Later</button><button class="primary" data-q="begin">Take it back ▶</button></div>`;
    } else if (v.kind === 'quickstart') {
      // the quick run's one card before a game: who, one line of taunt, one line of how
      card.innerHTML = `
        <span class="q-level-tag">${where}</span>
        <div class="q-villain"><span class="q-face" aria-hidden="true">${stage.villain.face}</span>
          <div><span class="q-minion">😈 ${stage.villain.name === 'Lord Lag' ? 'Lord Lag himself' : `${esc(stage.villain.name)}, Lord Lag's minion`}</span><h3>🎮 ${esc(MINIGAMES[v.gid].name[words])}</h3></div></div>
        <p class="q-say">“${esc(shortTaunt(say(stage.taunt)))}”</p>
        <p class="q-tip">👉 ${esc(TIPS[v.gid][words])}</p>
        <div class="q-btns"><button data-q="later">Later</button><button class="primary" data-q="go">Start ▶</button></div>`;
    } else if (v.kind === 'breather') {
      // between a quick run's game and its quiz: cheer, one line of the game, one line of
      // the lesson as a hint, and what comes next; the clock waits for the player
      const who = stage.villain;
      card.innerHTML = `
        <span class="q-level-tag">${where}</span>
        <span class="q-k">🎉 ${who.name === 'Lord Lag' ? (hooks.plain() ? 'You beat Lord Lag\'s packet!' : 'You beat Lord Lag!') : `You beat ${esc(who.name)}!`}</span>
        <h3>${who.face} ${esc(MINIGAMES[v.gid].name[words])} · +${num(v.carry)} 🎮${v.flawless ? ' · flawless' : ''}</h3>
        ${v.st ? `<p class="q-say">${esc(MINIGAMES[v.gid].summary(v.st, words))}</p>` : ''}
        <p class="q-tip">💡 ${esc(firstSentence(say(stage.lesson)))}</p>
        <p class="q-sum">🧠 ${hooks.plain() ? 'Next' : 'Up next'}: ${QUICK_QUIZ} ${hooks.plain() ? 'quick questions' : 'questions'} · ${STORY_SECONDS} s ${hooks.plain() ? 'each' : 'per question'}</p>
        <div class="q-btns"><button class="primary" data-q="exam">${hooks.plain() ? 'I\'m ready ▶' : 'Ready ▶'}</button></div>`;
    } else if (v.kind === 'question') {
      const c = v.c, q = say(c.questions[c.i]);
      const hearts = Array.from({ length: STORY_LIVES }, (_, i) => `<i class="${i < c.lives ? 'on' : ''}">♥</i>`).join('');
      card.innerHTML = `
        <div class="q-head"><span class="q-k">${examName(lvl)} · ${c.i + 1} / ${c.questions.length}</span>
          <span class="q-hearts" aria-label="${c.lives} lives left">${hearts}</span><span class="q-pts">+${c.points}</span></div>
        <div class="q-time"><i></i></div>
        <h3 class="q-q">${esc(q.q)}</h3>
        <div class="q-answers">${c.order[c.i].map((k, pos) => `<button data-answer="${pos}"><kbd>${pos + 1}</kbd>${esc(q.a[k])}</button>`).join('')}</div>
        ${v.last ? `<p class="q-flash ${v.last.right ? 'ok' : 'bad'}">${v.last.right ? `Right! +${v.last.points}` : `${v.last.timeout ? 'Too slow!' : 'Not quite.'} ${hooks.plain() ? 'The right answer was' : 'Correct answer'}: <b>${esc(v.last.answer)}</b>`}</p>` : ''}`;
      startTimer();
    } else if (v.kind === 'how') {
      const game = gameOf(v);
      card.innerHTML = `
        <span class="q-level-tag">${where}</span>
        ${v.boss ? `<div class="q-villain"><span class="q-face" aria-hidden="true">😈</span><div><span class="q-k">${hooks.plain() ? 'The last level' : 'Level 5'}</span><h3>${esc(game.name[words])}</h3></div></div>`
          : `<span class="q-k">Win back ${name} · mini-game</span>
        <h3>🎮 ${esc(game.name[words])}</h3>`}
        <p class="q-say">${esc(v.boss && isQuick(story) ? (hooks.plain() ? 'So you beat all four of my minions, did you? Two rounds, then: two of the games you just played, a little faster and a little meaner. Win both and Netlandia is yours!' : 'Lord Lag\'s last stand: two short rounds, replaying two of the games from this run. Win both to bring Netlandia back.') : game.how[words])}</p>
        <p class="q-sum">Goal: <b>${esc(v.boss && isQuick(story) ? (hooks.plain() ? 'Win both rounds' : 'Win two rounds') : game.goal[words])}</b></p>
        <div class="q-btns"><button data-q="later">Later</button><button class="primary" data-q="go">Start ▶</button></div>`;
    } else if (v.kind === 'game') {
      const game = gameOf(v);
      card.innerHTML = `
        <div class="q-head"><span class="q-k">${v.practice ? '🛠 Practice' : v.boss ? '😈 Final fight' : `Win back ${name}`} · ${esc(game.name[words])}</span><button class="q-quit" data-q="quit" aria-label="Give up">✕</button></div>
        <canvas class="q-canvas${game.tall ? ' tall' : ''}"></canvas>
        <div class="q-lanes">${game.laneNames[words].map((l, i) => `<button data-lane="${i}"><kbd>${i + 1}</kbd>${esc(l)}</button>`).join('')}</div>`;
      startGame(v.id ?? 'boss', game, gameOpts(v));
    } else if (v.kind === 'practice') {
      // a practice game over: how it went and its lesson, and nothing banked
      const game = gameOf(v);
      card.innerHTML = `
        <span class="q-k">🛠 Practice · nothing counts</span>
        <h3>${v.won ? '🎉 You won' : '💥 You lost'}: ${esc(game.name[words])}</h3>
        ${v.st ? `<dl><dt>Your game</dt><dd>${esc(game.summary(v.st, words))}</dd>${stage ? `<dt>${hooks.plain() ? 'Why it works' : 'In a real network'}</dt><dd>${esc(say(stage.lesson))}</dd>` : ''}</dl>` : ''}
        ${v.won ? `<p class="q-sum">${num(v.points)} pts (not added to your score)</p>` : ''}
        <div class="q-btns"><button data-q="later">Close</button><button data-q="dev">🛠 Dev menu</button><button class="primary" data-q="again">Play again ▶</button></div>`;
    } else if (v.kind === 'cleared') {
      // a stop won that is not the network's last: the game in numbers, and its lesson
      const nextG = nextStage(story), left = stagesOf(story, v.id).length - story.stage;
      card.innerHTML = `
        <span class="q-level-tag">${where}</span>
        <span class="q-k">Stop cleared!</span>
        <h3>🎮 ${esc(MINIGAMES[v.gid].name[words])} won</h3>
        <dl><dt>Your game</dt><dd>${esc(MINIGAMES[v.gid].summary(v.st, words))}</dd><dt>${hooks.plain() ? 'Why it works' : 'In a real network'}</dt><dd>${esc(say(stage.lesson))}</dd></dl>
        <p class="q-sum">${gained(v.points)}${v.flawless ? ' · flawless bonus' : ''} · ☁ ${name}: ${left} more stop${left === 1 ? '' : 's'} before the clouds lift</p>
        <div class="q-btns"><button data-q="later">Later</button><button class="primary" data-q="next">Next stop: ${esc(MINIGAMES[nextG].name[words])} ▶</button></div>`;
    } else if (v.kind === 'exam') {
      const n = examAt(v.id).length;
      card.innerHTML = `
        <span class="q-level-tag">${where}</span>
        <span class="q-k">🏁 ${esc(MINIGAMES[v.gid].name[words])} won · +${v.carry.toLocaleString('en')} pts</span>
        <h3>${examName(lvl)}</h3>
        <p class="q-say">${hooks.plain()
          ? `One last challenge before the clouds over Level ${lvl.n} lift: ${n} questions about ${lvl.chapters.map((c) => esc(hooks.majorName(c))).join(', ')}. You have two lives.`
          : `Before ${name} unlocks: ${n} questions across Level ${lvl.n} (${lvl.chapters.map((c) => esc(hooks.majorName(c))).join(', ')}). Two strikes and you're out.`}</p>
        ${v.st ? `<dl><dt>Your game</dt><dd>${esc(MINIGAMES[v.gid].summary(v.st, words))}</dd></dl>` : ''}
        <div class="q-btns"><button class="primary" data-q="exam">Start the exam ▶</button></div>`;
    } else if (v.kind === 'won') {
      const next = nextChapter(story);
      const ended = isQuick(story) || lvl.chapters.at(-1) === v.id, after = STORY_LEVELS.find((l) => l.n === lvl.n + 1);
      // what comes next stays a riddle: a hint, never the name
      const news = next && (DISCOVERY[next] ?? TEASERS[next]);
      if (isQuick(story)) {
        card.innerHTML = `
          <span class="q-k">🏁 Level ${lvl.n} complete!</span>
          <h3>You unlocked ${lvl.chapters.map((c) => esc(hooks.majorName(c))).join(' and ')}</h3>
          <p class="q-say">${esc(say(ch.win))}</p>
          ${reviewOf(v.review)}
          <p class="q-sum">${gained(v.play, v.know)}${v.flawless ? ' · flawless bonus' : ''} · you are now <b>${esc(rankOf(story))}</b></p>
          <p class="q-tip">📓 ${hooks.plain() ? 'What this means in a real network is in your notebook.' : 'The full lesson is in the notebook.'}</p>
          ${news ? `<p class="q-news"><b>${hooks.plain() ? 'What\'s next?' : 'Up next'}</b> ${esc(say(news))}</p>` : after?.boss ? `<p class="q-news"><b>😈 ${hooks.plain() ? 'Lord Lag is waiting!' : 'Lord Lag is next.'}</b></p>` : ''}
          <div class="q-btns"><button class="primary" data-q="next">Next ▶</button></div>`;
        return;
      }
      card.innerHTML = `
        <span class="q-k">Congratulations!</span>
        <h3>You unlocked ${name}</h3>
        <p class="q-say">${esc(say(ch.win))}</p>
        ${v.st ? `<dl><dt>Your game</dt><dd>${esc(MINIGAMES[v.gid].summary(v.st, words))}</dd></dl>` : ''}
        ${reviewOf(v.review)}
        <dl><dt>Why you won</dt><dd>${esc(say(ch.why))}</dd><dt>In a real network</dt><dd>${esc(say(ch.recap))}</dd></dl>
        <p class="q-sum">${gained(v.play, v.know)}${v.flawless ? ' · flawless bonus' : ''} · you are now <b>${esc(rankOf(story))}</b></p>
        ${ended ? `<div class="q-levelup"><b>🏁 Level ${lvl.n} complete: ${esc(say(lvl.name))}</b>
          <span>${lvl.chapters.map((c) => esc(hooks.majorName(c))).join(' · ')}: all back online.</span>
          ${after ? `<span>Next: <b>Level ${after.n}${after.boss ? ` · ${esc(say(after.name))}` : ' · ???'}</b>${after.boss ? (hooks.plain() ? '. Lord Lag is waiting, with a round from every level!' : '. Lord Lag, one round from each level.') : ''}</span>` : ''}</div>` : ''}
        ${news ? `<p class="q-news"><b>${hooks.plain() ? 'What\'s next?' : 'Up next'}</b> ${esc(say(news))}</p>` : ''}
        <div class="q-btns"><button data-q="enter">Go into ${name}</button><button class="primary" data-q="next">Next challenge ▶</button></div>`;
    } else if (v.kind === 'final') {
      card.innerHTML = `
        <span class="q-level-tag">${where}</span>
        <span class="q-k">😈 Lord Lag is beaten!</span>
        <h3>🏁 Level 5 complete</h3>
        <dl><dt>Your fight</dt><dd>${esc(BOSS.summary(v.st, words))}</dd></dl>
        <p class="q-sum">${gained(v.points)}${v.flawless ? ' · flawless bonus' : ''} · you are now <b>${esc(rankOf(story))}</b></p>
        <div class="q-btns"><button class="primary" data-q="done">Finish ▶</button></div>`;
    } else if (v.kind === 'lost') {
      const who = v.boss ? { name: 'Lord Lag', face: '😈' } : stage.villain;
      const lose = v.boss
        ? (hooks.plain() ? 'Lord Lag wins this round. Netlandia flickers…' : 'Lord Lag takes the round. Service is degrading.')
        : say(stage.lose);
      card.innerHTML = `
        <div class="q-villain"><span class="q-face" aria-hidden="true">${who.face}</span>
          <div><span class="q-k">This round goes to ${esc(minion(who))}</span><h3>You died${v.exam ? ' in the exam' : v.boss ? ' in the final fight' : ''}</h3></div></div>
        <p class="q-say">${esc(lose)}${v.exam ? ` ${hooks.plain() ? 'Your game still counts: only the exam starts again.' : 'The game result stands; retake the exam.'}` : ''}</p>
        ${reviewOf(v.review)}
        <div class="q-btns"><button data-q="later">Back to the map</button><button class="primary" data-q="${v.exam ? 'exam' : v.boss ? 'boss' : isQuick(story) ? 'go' : 'begin'}">Try again</button></div>`;
    } else if (v.kind === 'locked') {
      const next = nextChapter(story);
      card.innerHTML = `
        <span class="q-k">☁ Hidden in the clouds</span>
        <h3>Something is down there…</h3>
        <p class="q-say">The clouds only clear one network at a time. ${next && revealed(next) ? `Win back ${esc(hooks.majorName(next))} first.` : `Follow the story first: ${esc(next ? riddle(next) : '')}`}</p>
        <div class="q-btns"><button data-q="later">OK</button><button class="primary" data-q="next">${next && revealed(next) ? `Go to ${esc(hooks.majorName(next))}` : 'What\'s next?'} ▶</button></div>`;
    } else if (v.kind === 'done') {
      card.innerHTML = `
        <span class="q-k">🏆 Netlandia is back on${isQuick(story) ? ' · ⚡ quick run' : ''}</span>
        <h3>You are Chief of the NOC</h3>
        <p class="q-say">${isQuick(story)
          ? (hooks.plain() ? 'You won back all of Netlandia in one quick run and beat Lord Lag! There are eleven more games in the full story, if you want to see everything.' : 'Quick run complete: every level restored and Lord Lag beaten. The full story has eleven more stops and the full exams.')
          : hooks.plain()
          ? 'Every network is back, from the homes of Popcorn Hill to the cables under the ocean, and Lord Lag is beaten. For now.'
          : 'All five levels cleared: aggregation, xhaul, core, subsea, metro and long-haul, and Lord Lag defeated. For now.'}</p>
        <p class="q-sum">Score <b>${num(story.score)}</b> = 🧠 <b>${num(story.know)}</b> ${hooks.plain() ? 'what you know' : 'knowledge'} + 🎮 <b>${num(story.play)}</b> games · best <b>${num(story.best)}</b></p>
        ${boarded ? '' : `${nameField(hooks.plain() ? 'Put your name on the board' : 'Add your run to the board')}<div class="q-btns"><button class="primary" data-q="board">🏆 Save to the board</button></div>`}
        ${boardHtml(v.place ?? -1)}
        <div class="q-btns"><button data-q="newplayer">👤 New player</button><button data-q="notebook">📓 Notebook</button><button data-q="replay">Play again</button><button class="primary" data-q="free">Explore the map ▶</button></div>`;
    }
  }

  // ------------------------------------------------ a mini-game on the card's canvas
  // a quick run plays the short versions; its Lord Lag replays two of the run's games
  function gameOpts(v) {
    if (v.practice || !isQuick(story)) return {};
    if (!v.boss) return SHORT_OPTS[v.gid] ?? {};
    const mine = Object.values(story.picks);
    for (let i = mine.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mine[i], mine[j]] = [mine[j], mine[i]]; }
    return { picks: mine.slice(0, 2) };
  }
  function startGame(id, game, opts = {}) {
    const canvas = card.querySelector('.q-canvas'), g = canvas.getContext('2d');
    play = { id, game, state: game.start(Math.random, opts), raf: 0, canvas, last: performance.now() };
    const size = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight, r = Math.min(devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * r)) { canvas.width = Math.round(w * r); canvas.height = Math.round(h * r); }
      g.setTransform(r, 0, 0, r, 0, 0);
      return [w, h];
    };
    const css = getComputedStyle(card), v = (k) => css.getPropertyValue(k).trim();
    const c = id === 'boss' ? LAG_COLOR : hooks.majorColor(id);
    const theme = {
      ink: css.color, paper: v('--paper'), well: v('--well'), muted: v('--muted'), font: css.fontFamily,
      accent: c, accentSoft: `${c}40`, gold: '#ffc43d', good: hooks.plain() ? '#12825a' : '#4fd59a', bad: '#e63946',
      lane: ['#e76f51', '#7b2cbf', '#8a94a6'],
      sea: hooks.plain() ? '#d6ecff' : '#0e1c2b', land: hooks.plain() ? '#cdeab0' : '#1d3324',
    };
    const loop = (now) => {
      if (!play) return;
      // whatever happens in a frame, the next one still comes: a game never freezes on an error
      play.raf = requestAnimationFrame(loop);
      // real time, in small steps, so a slow device plays the same game, only less smoothly
      let left = Math.min(0.25, (now - play.last) / 1000);
      play.last = now;
      while (left > 0 && !play.state.over) { const dt = Math.min(1 / 60, left); game.tick(play.state, dt); left -= dt; }
      // the result first, so a game that is over always ends, then this last frame
      const res = game.result(play.state);
      if (res) { const st = play.state; setTimeout(() => endGame(id, res, st), 600); cancelAnimationFrame(play.raf); play.raf = 0; }
      const [w, h] = size();
      const words = hooks.plain() ? 'plain' : 'eng';
      game.draw(g, play.state, w, h, words, theme);
      blips(play.state);
      // games whose choices change (Packet Race) relabel their lane buttons as they go
      if (game.lanes) {
        game.lanes(play.state, words).forEach((l, i) => {
          const b = card.querySelector(`[data-lane="${i}"]`);
          if (b && (b.lastChild.textContent !== l || b.disabled !== (l === '—'))) { b.lastChild.textContent = l; b.disabled = l === '—'; }
        });
        // and some colour each button like its road on the board (Mesh Rescue)
        game.laneColors?.(play.state)?.forEach((col, i) => {
          const b = card.querySelector(`[data-lane="${i}"]`);
          if (b && (b.dataset.tint ?? '') !== (col ?? '')) { b.dataset.tint = col ?? ''; b.classList.toggle('tinted', !!col); b.style.setProperty('--lane', col ?? ''); }
        });
      }
    };
    canvas.addEventListener('pointerdown', (e) => {
      const r = canvas.getBoundingClientRect();
      const lane = game.laneAt(e.clientX - r.left, e.clientY - r.top, r.width, r.height, play?.state);
      if (lane != null) press(lane);
    });
    hooks.pause(true);
    play.raf = requestAnimationFrame(loop);
  }
  function press(lane) {
    if (!play) return;
    play.game.press(play.state, lane);
    const b = card.querySelector(`[data-lane="${lane}"]`);
    if (b) { b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 120); }
  }
  function stopGame() {
    if (!play) return;
    if (play.raf) cancelAnimationFrame(play.raf);
    play = null;
    hooks.pause(false);
  }
  function endGame(id, res, st) {
    if (!view || view.kind !== 'game') return;
    const v = view;
    stopGame();
    sfx(!res.won ? 'lose' : v.boss ? 'fanfare' : 'win');
    if (v.practice) { openCard({ ...v, kind: 'practice', won: res.won, st, points: res.points + (res.flawless ? FLAWLESS_BONUS : 0) }); return; }
    noteGame(notebook, v.boss ? 'boss' : v.gid, res.won); save();
    if (!res.won) { openCard({ kind: 'lost', id: v.id, gid: v.gid, boss: v.boss }); return; }
    const points = res.points + (res.flawless ? FLAWLESS_BONUS : 0);
    // Level 5: Lord Lag beaten, the story is over
    if (v.boss) { winFinal(story, points); save(); renderBar(); openCard({ kind: 'final', boss: true, points, flawless: res.flawless, st }); return; }
    // a stop that is not the network's last: bank it and move on to the next game
    if (!lastStage(v.id, v.gid)) {
      winStage(story, v.id, points); save(); renderBar();
      openCard({ kind: 'cleared', id: v.id, gid: v.gid, points, flawless: res.flawless, st });
      return;
    }
    // the last network of a level has its final exam still to come
    // a quick run takes a breath before its two questions: no clock until "I'm ready"
    if (isQuick(story)) { openCard({ kind: 'breather', id: v.id, gid: v.gid, carry: points, flawless: res.flawless, st }); return; }
    if (examAt(v.id)) { openCard({ kind: 'exam', id: v.id, gid: v.gid, carry: points, flawless: res.flawless, st }); return; }
    bank(v.id, v.gid, points, 0, res.flawless, st);
  }
  // a network won: it unlocks, its points join the score, and the win card says why
  function bank(id, gid, play, know, flawless, st = null, review = null) {
    if (isQuick(story) || levelOf(id).chapters.at(-1) === id) sfx('fanfare');
    winChapter(story, { id, over: 'won', points: know }, play);
    for (const c of isQuick(story) ? levelOf(id).chapters : [id]) noteChapter(notebook, c);
    save();
    // a quick run lifts the clouds off the whole level at once
    applyLocks(isQuick(story) ? levelOf(id).chapters : id);
    renderBar();
    openCard({ kind: 'won', id, gid, play, know, flawless, st, review });
  }

  function startTimer() {
    asked = performance.now();
    const fill = card.querySelector('.q-time i');
    timer = setInterval(() => {
      const s = (performance.now() - asked) / 1000;
      if (fill) fill.style.width = `${Math.max(0, 100 - (s / STORY_SECONDS) * 100)}%`;
      if (s >= STORY_SECONDS) pick(null);
    }, 100);
  }
  function pick(pos) {
    if (!view || view.kind !== 'question' || view.c.over) return;
    stopTimer();
    const c = view.c, seconds = (performance.now() - asked) / 1000;
    const q = c.questions[c.i], right = say(q).a[0], picked = pos == null ? null : c.order[c.i][pos];
    const res = answer(c, pos, seconds);
    noteAnswer(notebook, q, res.right, picked);
    sfx(c.over === 'lost' ? 'lose' : res.right ? 'good' : 'bad');
    if (c.over) noteExam(notebook, levelOf(c.id).chapters.at(-1), c.over === 'won');
    save();
    if (c.over === 'won') {
      const ex = view.exam;
      bank(c.id, ex.gid, ex.carry, c.points, ex.flawless && !c.mistakes, ex.st, c);
    } else if (c.over === 'lost') {
      openCard({ kind: 'lost', id: c.id, gid: view.exam.gid, exam: view.exam, review: c });
    } else {
      view.last = { ...res, timeout: pos == null, answer: right };
      renderCard();
    }
  }

  // ------------------------------------------------ clicks and keys
  function act(what) {
    const v = view;
    if (what === 'intro') showIntro();
    else if (what === 'dev') showDev();
    else if (what === 'notebook') showNotebook();
    else if (what === 'newplayer') showNewPlayer();
    else if (what === 'np-save') { if (boardIt() >= 0 || boarded) newPlayer(); else document.getElementById('b-name')?.focus(); }
    else if (what === 'np-go') newPlayer();
    else if (what === 'board') { const place = boardIt(); if (place >= 0) openCard({ kind: 'done', place }); else document.getElementById('b-name')?.focus(); }
    else if (what === 'sound') { soundOn = !soundOn; store.set(SOUND_KEY, soundOn ? 'on' : 'off'); showIntro(); sfx('good'); }
    else if (what === 'nbclose') { intro.hidden = true; if (nbFrom === 'intro') showIntro(); }
    else if (what === 'play') { setPlaying(true); goNext(); }
    else if (what === 'play-quick' || what === 'play-full') { restartStory(story, what === 'play-quick' ? 'quick' : 'full'); boarded = false; save(); setPlaying(true); goNext(); }
    else if (what === 'explore' || what === 'free') { closeCard(); setPlaying(false); }
    else if (what === 'next') goNext();
    else if (what === 'begin' && v) openCard({ kind: 'how', id: v.id, gid: v.gid });
    else if (what === 'go' && v) openCard({ kind: 'game', id: v.id, gid: v.gid, boss: v.boss });
    else if (what === 'boss') openCard({ kind: 'how', boss: true });
    else if (what === 'exam' && v) {
      const ex = v.exam ?? { gid: v.gid, carry: v.carry, flawless: v.flawless, st: v.st };
      openCard({ kind: 'question', id: v.id, c: startChallenge(v.id, Math.random, examFor(v.id)), last: null, exam: ex });
    }
    else if (what === 'quit' && v?.practice) openCard({ ...v, kind: 'practice', won: false, st: null });
    else if (what === 'again' && v?.practice) openCard({ ...v, kind: 'game' });
    else if (what === 'quit' && v) { if (v.kind === 'game') { noteGame(notebook, v.boss ? 'boss' : v.gid, false); save(); } openCard({ kind: 'lost', id: v.id, gid: v.gid, boss: v.boss }); }
    else if (what === 'later') closeCard();
    else if (what === 'enter' && v) { const id = v.id; closeCard(); hooks.openMajor(id); }
    else if (what === 'done') openCard({ kind: 'done' });
    else if (what === 'replay') { restartStory(story); boarded = false; save(); applyLocks(); renderBar(); goNext(); }
  }
  // the lane buttons react on touch-down, the way a game should
  card.addEventListener('pointerdown', (e) => {
    const l = e.target.closest('[data-lane]');
    if (l) { e.preventDefault(); press(+l.dataset.lane); }
  });
  for (const root of [intro, bar, card]) {
    root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-answer]');
      if (a) { pick(+a.dataset.answer); return; }
      const d = e.target.closest('[data-dev]');
      if (d) { dev(d.dataset.dev); return; }
      const b = e.target.closest('[data-q]');
      if (b) act(b.dataset.q);
    });
  }
  addEventListener('keydown', (e) => {
    // Enter in the name box saves it to the board
    if (e.key === 'Enter' && e.target.id === 'b-name') { e.preventDefault(); act(view?.kind === 'done' ? 'board' : 'np-save'); return; }
    if (e.target.id === 'b-name') return;
    if (!['1', '2', '3'].includes(e.key)) return;
    if (view?.kind === 'question') { pick(+e.key - 1); e.stopPropagation(); }
    else if (view?.kind === 'game' && !e.repeat) { press(+e.key - 1); e.stopPropagation(); }
  }, true);

  // ------------------------------------------------ start
  if (store.get(PLAY_KEY) == null) showIntro();
  applyLocks();
  renderBar();
  // the camera can't be moved in the story, so it starts where the story is
  if (storyOn()) hooks.focusMajor(nextChapter(story) ?? story.unlocked.at(-1) ?? STORY_ORDER[0]);

  return {
    isLocked: locked,
    status,
    // for the panel and the labels on the globe
    get story() { return storyOn(); },
    order: STORY_ORDER,
    revealed,
    teaser: riddle,
    // a place's name on the globe stays hidden while its region is under cloud, and so
    // does every name on a side of the world the story hasn't reached yet
    hidesPlace(region, side) {
      if (!storyOn()) return false;
      if (region) return locked(region);
      return !story.unlocked.some((id) => hooks.sideOf(id) === side);
    },
    // for test scripts: the running mini-game's state
    get playing() { return play?.state ?? null; },
    // a click on a locked network: the next one starts its challenge, the others say why not
    blocked(id) {
      hooks.toGlobe();
      if (id === nextChapter(story)) taunt(id, nextStage(story)); else openCard({ kind: 'locked', id });
    },
    // the reading mode changed: say it all again in the other words
    relabel() {
      renderBar();
      if (!intro.hidden) showIntro();
      // a question starts its clock again, now that it reads differently; a game keeps
      // running and only its lane buttons change words (the board redraws itself)
      if (view?.kind === 'game') {
        const names = gameOf(view).laneNames[hooks.plain() ? 'plain' : 'eng'];
        card.querySelectorAll('[data-lane]').forEach((b, i) => { b.lastChild.textContent = names[i]; });
      } else if (view) { stopTimer(); renderCard(); }
    },
  };
}
