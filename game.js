(() => {
'use strict';
const WORDS = window.WORDS.map((o, i) => ({ ...o, i }));
const $ = s => document.querySelector(s);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, n) => shuffle(a).slice(0, n);
const rand = (a, b) => a + Math.random() * (b - a);
const SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const ALLCHARS = [...new Set(WORDS.flatMap(w => [...w.w]))];
const wrongChar = w => { const cs = [...w.w], bs = [...w.bad]; const k = cs.findIndex((c, j) => c !== bs[j]); return k < 0 ? { pos: 0, ch: null } : { pos: k, ch: bs[k] }; };

/* ---------- state (memory only) ---------- */
const S = { group: 0, total: 0, best: {}, trophies: [], sfx: true };
const GROUPS = [
  { name: '第一組', sub: '詞語 1–10', r: [0, 10] }, { name: '第二組', sub: '詞語 11–20', r: [10, 20] },
  { name: '第三組', sub: '詞語 21–30', r: [20, 30] }, { name: '第四組', sub: '詞語 31–40', r: [30, 40] },
  { name: '全部詞語', sub: '40個大挑戰', r: [0, 40] }];
const GW = () => WORDS.slice(...GROUPS[S.group].r);
const GAMES = [
  { id: 'whack', t: '聽音打兔仔', d: '聽讀音，打中舉起正確詞語的兔仔', ic: '<img src="img/bunny.webp" alt="">', c: 'c-mint', run: () => gWhack() },
  { id: 'memory', t: '翻翻樂配對', d: '把詞語卡和讀音卡配成一對', ic: '🃏', c: 'c-lav', run: () => gMemory() },
  { id: 'catch', t: 'Neko 接字', d: '移動籃子，接住詞語缺少的字', ic: '<img src="img/neko_basket.webp" alt="">', c: 'c-sky', run: () => gCatch() },
  { id: 'balloon', t: '氣球砌詞語', d: '按次序戳破氣球，砌出聽到的詞語', ic: '🎈', c: 'c-pink', run: () => gBalloon() },
  { id: 'boss', t: '寫字打怪獸', d: '寫對每一個字，打敗搗蛋小怪獸', ic: '<img src="img/monster.webp" alt="">', c: 'c-butter', run: () => gBoss() }];
const TROPHY = { whack: '🐰', memory: '🃏', catch: '🧺', balloon: '🎈', boss: '👾' };

/* ---------- audio ---------- */
let player = new Audio();
let zhVoice = null;
function loadVoices() { const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || []; const hk = vs.filter(v => /zh[-_]HK|yue|粵/i.test(v.lang + v.name)); zhVoice = hk.find(v => /Sin-?ji|HiuGaai|HiuMaan|Google/i.test(v.name)) || hk[0] || null; }
if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(t) { if (!window.speechSynthesis) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'zh-HK'; u.rate = .8; if (zhVoice) u.voice = zhVoice; speechSynthesis.speak(u); }
function play(src, txt) { try { player.pause(); } catch (e) {} player = new Audio(src); player.play().catch(() => txt && speak(txt)); }
const sayW = w => play(`audio/w_${w.i}.mp3`, w.w);
const sayS = w => play(`audio/s_${w.i}.mp3`, w.s);
const PH = { good: '答對了，好叻呀！', great: '好犀利！繼續努力！', retry: '唔緊要，再試一次！', done: '完成了！你真係好棒呀！' };
const sayP = k => play(`audio/p_${k}.mp3`, PH[k]);

let AC = null;
function tone(freqs, dur = .12, type = 'sine', vol = .18) {
  if (!S.sfx) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    let t = AC.currentTime;
    freqs.forEach(f => { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur); t += dur * .8; });
  } catch (e) {}
}
const sfx = { ok: () => tone([660, 880, 1320], .1, 'triangle'), bad: () => tone([220, 160], .16, 'square', .08), pop: () => tone([900, 1400], .05, 'triangle', .15), win: () => tone([523, 659, 784, 1047, 1319], .14, 'triangle'), flip: () => tone([520], .05, 'sine', .1), hit: () => tone([300, 120], .12, 'sawtooth', .08) };

/* ---------- ui ---------- */
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1300); }
function confetti() { const b = $('#confetti'), em = ['🎀', '💖', '⭐', '🌸', '✨', '🍓']; for (let k = 0; k < 30; k++) { const i = document.createElement('i'); i.textContent = em[k % em.length]; i.style.left = Math.random() * 100 + 'vw'; i.style.animationDelay = Math.random() * .6 + 's'; b.appendChild(i); setTimeout(() => i.remove(), 2600); } }
function fx(parent, x, y, txt, neg) { const e = document.createElement('div'); e.className = 'fx' + (neg ? ' neg' : ''); e.textContent = txt; e.style.left = x + 'px'; e.style.top = y + 'px'; parent.appendChild(e); setTimeout(() => e.remove(), 950); }
let G = null;
function setHUD() { $('#score').textContent = G.score; $('#hearts').textContent = G.hearts == null ? '' : '💖'.repeat(Math.max(0, G.hearts)) + '🤍'.repeat(Math.max(0, G.maxH - G.hearts)); }
function addScore(n) { G.score = Math.max(0, G.score + n); setHUD(); }
function loseHeart() { if (G.hearts == null) return; G.hearts--; setHUD(); if (G.hearts <= 0) G.end(false); }
function stopAll() { if (G) { G.dead = true; (G.timers || []).forEach(clearInterval); (G.timers || []).forEach(clearTimeout); if (G.raf) cancelAnimationFrame(G.raf); (G.writers || []).forEach(w => { try { w.cancelQuiz(); } catch (e) {} }); if (G.cleanup) G.cleanup(); } $('#timer').hidden = true; }

function renderHome() {
  $('#groups').innerHTML = GROUPS.map((g, i) => `<button class="gtab" aria-pressed="${i === S.group}" data-g="${i}"><b>${g.name}</b><span>${g.sub}</span></button>`).join('');
  $('#games').innerHTML = GAMES.map(g => { const b = S.best[g.id + S.group] || 0; return `<button class="gcard ${g.c}" data-id="${g.id}"><span class="ic">${g.ic}</span><span><h3>${g.t}</h3><p>${g.d}</p></span><span class="best">${[1, 2, 3].map(k => `<i class="${k <= b ? 'on' : ''}">★</i>`).join('')}</span></button>`; }).join('');
  $('#totalScore').textContent = S.total;
  $('#trophies').innerHTML = S.trophies.length ? S.trophies.map(t => `<span class="t">${t}</span>`).join('') : '玩完遊戲就會得到獎盃！';
}
$('#groups').addEventListener('click', e => { const b = e.target.closest('.gtab'); if (b) { S.group = +b.dataset.g; renderHome(); } });
$('#games').addEventListener('click', e => { const b = e.target.closest('.gcard'); if (b) start(b.dataset.id); });
$('#homeBtn').onclick = goHome;
$('#soundBtn').onclick = () => { S.sfx = !S.sfx; $('#soundBtn').textContent = S.sfx ? '🔔 音效' : '🔕 靜音'; };
function goHome() { stopAll(); G = null; document.body.classList.remove('playing'); $('#homeBtn').hidden = true; renderHome(); scrollTo(0, 0); }

function start(id) {
  stopAll();
  const meta = GAMES.find(g => g.id === id);
  G = { id, meta, score: 0, hearts: null, maxH: 3, timers: [], writers: [], dead: false };
  document.body.classList.add('playing'); $('#homeBtn').hidden = false; scrollTo(0, 0);
  $('#gTitle').textContent = `${meta.t}・${GROUPS[S.group].name}`;
  G.end = win => finish(win);
  setHUD();
  meta.run();
}
function countdown(cb) {
  const a = $('#arena'); const ov = document.createElement('div'); ov.className = 'overlay'; a.appendChild(ov);
  let n = 3; const tick = () => { if (G.dead) return; if (n === 0) { ov.remove(); cb(); return; } ov.innerHTML = `<div class="count">${n}</div>`; tone([440 + (3 - n) * 120], .1, 'triangle'); n--; G.timers.push(setTimeout(tick, 650)); };
  tick();
}
function finish(win, stars) {
  if (G.ended) return; G.ended = true;
  const id = G.id, score = G.score;
  stopAll(); G.dead = true;
  const st = stars != null ? stars : win ? (G.rate ? G.rate() : 3) : 1;
  const key = id + S.group; S.best[key] = Math.max(S.best[key] || 0, st);
  S.total += score; S.trophies.push(TROPHY[id]);
  $('#totalScore').textContent = S.total;
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="box"><img src="img/${win ? 'cheer' : 'think'}.webp" alt=""><h3>${win ? (st === 3 ? '超級厲害！' : '做得好！') : '差少少，再試吓！'}</h3>
    <div class="stars">${[1, 2, 3].map(k => `<i class="${k <= st ? 'on' : ''}">★</i>`).join('')}</div><p>得分：${score}　獎盃：${TROPHY[id]}</p>
    ${G.review && G.review.length ? `<p style="font-size:16px;color:var(--ink-soft)">要再溫習：${[...new Set(G.review)].join('、')}</p>` : ''}
    <div class="row"><button class="btn" id="again">🔁 再玩</button><button class="btn lav" id="nextG">下一個遊戲 →</button><button class="btn ghost" id="home2">🏠 主頁</button></div></div>`;
  $('#arena').appendChild(ov);
  if (win) { sayP('done'); sfx.win(); confetti(); } else sayP('retry');
  ov.querySelector('#again').onclick = () => start(id);
  ov.querySelector('#nextG').onclick = () => { const i = GAMES.findIndex(g => g.id === id); start(GAMES[(i + 1) % GAMES.length].id); };
  ov.querySelector('#home2').onclick = goHome;
}

/* ===================== 1. 聽音打兔仔 ===================== */
function gWhack() {
  G.hearts = 3; G.review = []; setHUD();
  const words = GW(); let target = null, hits = 0, misses = 0, time = 60;
  $('#arena').innerHTML = `<div class="prompt"><button class="btn" id="rep">${SPK} 再聽</button><span class="msg" id="msg">聽清楚讀音，打中舉起這個詞語的兔仔！</span></div>
    <div class="field" id="field">${Array.from({ length: 9 }, (_, k) => `<div class="hole" data-k="${k}"><div class="bun"><img src="img/bunny.webp" alt=""><b></b></div></div>`).join('')}</div>`;
  const holes = [...document.querySelectorAll('.hole')];
  const st = holes.map(() => ({ up: false, w: null, t: 0 }));
  const newTarget = () => { const pool = words.filter(w => !target || w.i !== target.i); target = pool[Math.random() * pool.length | 0]; G.timers.push(setTimeout(() => !G.dead && sayW(target), 350)); };
  $('#rep').onclick = () => target && sayW(target);
  const down = k => { holes[k].classList.remove('up', 'bad', 'hit'); st[k].up = false; };
  const spawn = () => {
    if (G.dead) return;
    const free = st.map((s, k) => s.up ? -1 : k).filter(k => k >= 0); if (!free.length) return;
    const k = free[Math.random() * free.length | 0];
    const onBoard = st.some(s => s.up && s.w && s.w.i === target.i);
    let w;
    if (!onBoard && Math.random() < .55) w = target;
    else { const ds = words.filter(x => x.i !== target.i); w = Math.random() < .25 ? { ...target, w: target.bad, fake: true } : ds[Math.random() * ds.length | 0]; }
    st[k] = { up: true, w }; holes[k].querySelector('b').textContent = w.w; holes[k].classList.add('up');
    const life = Math.max(1300, 2300 - hits * 40);
    G.timers.push(setTimeout(() => { if (st[k].w === w) down(k); }, life));
  };
  holes.forEach((h, k) => h.addEventListener('pointerdown', e => {
    if (G.dead || !st[k].up) return; const w = st[k].w; const r = h.getBoundingClientRect(), ar = $('#arena').getBoundingClientRect();
    const x = r.left - ar.left + r.width / 2 - 20, y = r.top - ar.top + 20;
    if (w.i === target.i && !w.fake) {
      hits++; addScore(10); sfx.ok(); fx($('#arena'), x, y, '+10'); h.classList.add('hit'); setTimeout(() => down(k), 250);
      st.forEach((s, j) => { if (j !== k && s.up && s.w.i === target.i && !s.w.fake) down(j); });
      newTarget();
    } else {
      misses++; G.review.push(target.w); sfx.bad(); fx($('#arena'), x, y, w.fake ? '寫錯字！' : '✗', true); h.classList.add('bad'); setTimeout(() => down(k), 300);
      toast(w.fake ? `小心！「${w.w}」是錯字` : `不是「${w.w}」，再聽一次`); loseHeart(); if (!G.dead) sayW(target);
    }
  }));
  G.rate = () => hits >= 14 && misses <= 1 ? 3 : hits >= 8 ? 2 : 1;
  countdown(() => {
    newTarget(); $('#timer').hidden = false; $('#timer').textContent = '⏰ ' + time;
    G.timers.push(setInterval(spawn, 800));
    G.timers.push(setInterval(() => { time--; $('#timer').textContent = '⏰ ' + time; if (time <= 0) finish(true); }, 1000));
    spawn(); spawn();
  });
}

/* ===================== 2. 翻翻樂 ===================== */
function gMemory() {
  const ws = pick(GW(), 6); let moves = 0, open = [], matched = 0, lock = false;
  const cards = shuffle(ws.flatMap(w => [{ w, kind: 'word' }, { w, kind: 'snd' }]));
  $('#arena').innerHTML = `<div class="prompt"><span class="msg">翻開卡片：把「詞語卡」和「讀音卡 🔊」配成一對！</span><span class="pill">步數 <b id="mv" style="font-weight:400">0</b></span></div>
    <div class="mgrid">${cards.map((c, k) => `<button class="mc" data-k="${k}" aria-label="卡片"><div class="in"><div class="f">🎀</div><div class="b ${c.kind === 'snd' ? 'snd' : ''}">${c.kind === 'snd' ? SPK : c.w.w}</div></div></button>`).join('')}</div>`;
  const els = [...document.querySelectorAll('.mc')];
  els.forEach((el, k) => el.addEventListener('click', () => {
    if (lock || el.classList.contains('open') || el.classList.contains('done')) return;
    const c = cards[k]; el.classList.add('open'); sfx.flip();
    if (c.kind === 'snd') sayW(c.w);
    open.push(k);
    if (open.length === 2) {
      moves++; $('#mv').textContent = moves;
      const [a, b] = open.map(i => cards[i]);
      if (a.w.i === b.w.i && a.kind !== b.kind) {
        open.forEach(i => { els[i].classList.add('done'); els[i].classList.remove('open'); }); open = []; matched++;
        addScore(15); sfx.ok(); setTimeout(() => sayW(a.w), 450); toast(`配對成功：${a.w.w}`);
        if (matched === ws.length) { G.rate = () => moves <= 9 ? 3 : moves <= 14 ? 2 : 1; setTimeout(() => finish(true), 1300); }
      } else { lock = true; G.timers.push(setTimeout(() => { open.forEach(i => els[i].classList.remove('open')); open = []; lock = false; }, 1100)); }
    }
  }));
}

/* ===================== 3. Neko 接字 ===================== */
function gCatch() {
  G.hearts = 3; G.review = []; setHUD();
  const queue = shuffle(GW()).slice(0, 8); let qi = 0, cur, need, wrong;
  $('#arena').innerHTML = `<div class="prompt"><span class="tgt" id="tgt"></span><button class="btn" id="rep">${SPK} 聽詞語</button><span class="pill">${'第'} <b id="qn" style="font-weight:400">1</b> / ${queue.length}</span></div>
    <div class="sky" id="sky"><div class="ground"></div><div class="basket" id="basket"><img src="img/neko_basket.webp" alt="Neko 拿着籃子"></div></div>
    <p style="text-align:center;font-size:15px;color:var(--ink-soft);margin:8px">用手指拖動 Neko，或用鍵盤 ← → 移動</p>`;
  const sky = $('#sky'), bk = $('#basket');
  let W = sky.clientWidth, H = sky.clientHeight, bx = W / 2, bw = bk.offsetWidth, items = [], last = performance.now(), spawnT = 0, sinceNeed = 0, keys = {};
  const setRound = () => {
    cur = queue[qi]; const wc = wrongChar(cur); need = [...cur.w][wc.pos]; wrong = wc.ch;
    $('#tgt').innerHTML = [...cur.w].map((c, k) => k === wc.pos ? '<span class="blank">？</span>' : c).join('');
    $('#qn').textContent = qi + 1; sayW(cur); sinceNeed = 0;
    items.forEach(it => it.el.remove()); items = [];
  };
  $('#rep').onclick = () => sayW(cur);
  const spawn = () => {
    let ch;
    if (sinceNeed >= 2 || Math.random() < .38) { ch = need; sinceNeed = 0; }
    else { sinceNeed++; ch = (wrong && Math.random() < .45) ? wrong : ALLCHARS.filter(c => c !== need)[Math.random() * (ALLCHARS.length - 1) | 0]; }
    const el = document.createElement('div'); el.className = 'drop'; el.textContent = ch; sky.appendChild(el);
    const s = el.offsetWidth; items.push({ el, ch, x: rand(4, W - s - 4), y: -s, v: rand(85, 120) + qi * 8, s });
  };
  const move = x => { bx = Math.max(bw / 2, Math.min(W - bw / 2, x)); };
  const onPtr = e => { const r = sky.getBoundingClientRect(); move(e.clientX - r.left); };
  sky.addEventListener('pointerdown', e => { onPtr(e); sky.setPointerCapture && sky.setPointerCapture(e.pointerId); });
  sky.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch' || e.pointerType === 'mouse') onPtr(e); });
  const kd = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { keys[e.key] = true; e.preventDefault(); } }, ku = e => { keys[e.key] = false; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const rs = () => { W = sky.clientWidth; H = sky.clientHeight; bw = bk.offsetWidth; }; addEventListener('resize', rs);
  G.cleanup = () => { removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('resize', rs); };
  const loop = now => {
    if (G.dead) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (keys.ArrowLeft) move(bx - 420 * dt); if (keys.ArrowRight) move(bx + 420 * dt);
    bk.style.transform = `translateX(${bx - bw / 2}px)`;
    spawnT -= dt; if (spawnT <= 0) { spawn(); spawnT = rand(.8, 1.15); }
    const top = H - bk.offsetHeight * .62;
    for (const it of items.slice()) {
      it.y += it.v * dt; it.el.style.transform = `translate(${it.x}px,${it.y}px)`;
      const cx = it.x + it.s / 2;
      if (it.y + it.s >= top && it.y + it.s <= top + 40 && Math.abs(cx - bx) < bw * .45) {
        it.el.remove(); items.splice(items.indexOf(it), 1);
        if (it.ch === need) {
          addScore(10); sfx.ok(); fx(sky, bx - 20, top - 50, '+10'); toast(`接住了！${cur.w}`);
          $('#tgt').textContent = cur.w; qi++;
          if (qi >= queue.length) { G.rate = () => G.hearts === 3 ? 3 : G.hearts === 2 ? 2 : 1; finish(true); return; }
          items.forEach(x => x.el.remove()); items = []; spawnT = 1.4;
          G.timers.push(setTimeout(() => { if (!G.dead) setRound(); }, 900));
        } else { sfx.bad(); fx(sky, bx - 20, top - 50, `✗ ${it.ch}`, true); G.review.push(cur.w); toast(it.ch === wrong ? `「${it.ch}」是常見錯字！` : '接錯了！'); loseHeart(); if (G.dead) return; }
      } else if (it.y > H) { it.el.remove(); items.splice(items.indexOf(it), 1); }
    }
    G.raf = requestAnimationFrame(loop);
  };
  countdown(() => { rs(); move(W / 2); setRound(); last = performance.now(); G.raf = requestAnimationFrame(loop); });
}

/* ===================== 4. 氣球砌詞語 ===================== */
function gBalloon() {
  G.review = []; const queue = shuffle(GW()).slice(0, 8); let qi = 0, cur, step = 0, mist = 0, totalMist = 0;
  const COLORS = ['#ffb3cd', '#d6c8f7', '#b8ead8', '#bfe0ff', '#ffe6a3', '#ffc7b8'];
  $('#arena').innerHTML = `<div class="prompt"><button class="btn" id="rep">${SPK} 聽詞語</button><div class="slots" id="slots"></div><span class="pill">第 <b id="qn" style="font-weight:400">1</b> / ${queue.length}</span></div>
    <div class="sky" id="sky"></div><p style="text-align:center;font-size:15px;color:var(--ink-soft);margin:8px">按次序戳破氣球，由第一個字開始</p>`;
  const sky = $('#sky'); let W = sky.clientWidth, H = sky.clientHeight, items = [], last = performance.now(), spawnT = 0;
  $('#rep').onclick = () => sayW(cur);
  const setRound = () => {
    cur = queue[qi]; step = 0; mist = 0; $('#qn').textContent = qi + 1;
    $('#slots').innerHTML = [...cur.w].map(() => '<span></span>').join('');
    items.forEach(it => it.el.remove()); items = []; sayW(cur);
    for (let k = 0; k < 4; k++) spawn(true);
  };
  const pool = () => { const cs = [...cur.w]; const wc = wrongChar(cur); const extra = wc.ch ? [wc.ch] : []; return { need: cs[step], others: [...new Set([...cs, ...extra, ...pick(ALLCHARS.filter(c => !cs.includes(c)), 3)])].filter(c => c !== cs[step]) }; };
  const spawn = initial => {
    const p = pool(); const onScreen = items.some(it => it.ch === p.need && it.y > -40);
    const ch = !onScreen || Math.random() < .3 ? p.need : p.others[Math.random() * p.others.length | 0];
    const el = document.createElement('button'); el.className = 'balloon'; el.innerHTML = `<div class="bb" style="background:${COLORS[Math.random() * COLORS.length | 0]}">${ch}</div>`; sky.appendChild(el);
    const bw = el.offsetWidth || 78;
    const it = { el, ch, x: rand(6, W - bw - 6), y: initial ? rand(H * .35, H) : H + 10, v: rand(45, 70), ph: rand(0, 6), bw };
    items.push(it);
    el.addEventListener('pointerdown', () => tap(it));
  };
  const tap = it => {
    if (G.dead || it.done) return; const cs = [...cur.w];
    if (it.ch === cs[step]) {
      it.done = true; it.el.classList.add('popped'); sfx.pop(); setTimeout(() => it.el.remove(), 260); items.splice(items.indexOf(it), 1);
      const sl = $('#slots').children[step]; sl.textContent = it.ch; sl.classList.add('ok'); step++; addScore(5);
      if (step >= cs.length) {
        addScore(mist ? 5 : 10); sfx.ok(); toast(`砌好了：${cur.w}`); qi++;
        G.timers.push(setTimeout(() => { if (G.dead) return; if (qi >= queue.length) { G.rate = () => totalMist <= 1 ? 3 : totalMist <= 5 ? 2 : 1; finish(true); } else setRound(); }, 1000));
        G.timers.push(setTimeout(() => !G.dead && sayW(cur), 150));
      }
    } else {
      mist++; totalMist++; G.review.push(cur.w); sfx.bad(); it.el.animate([{ transform: it.el.style.transform + ' rotate(-10deg)' }, { transform: it.el.style.transform + ' rotate(10deg)' }, { transform: it.el.style.transform }], { duration: 300 });
      toast(cs.includes(it.ch) ? '次序唔啱，由第一個字開始' : (it.ch === wrongChar(cur).ch ? `小心！「${it.ch}」是錯字` : `「${cur.w}」冇「${it.ch}」字`));
    }
  };
  const rs = () => { W = sky.clientWidth; H = sky.clientHeight; }; addEventListener('resize', rs); G.cleanup = () => removeEventListener('resize', rs);
  const loop = now => {
    if (G.dead) return; const dt = Math.min(.05, (now - last) / 1000); last = now;
    spawnT -= dt; if (spawnT <= 0 && items.length < 7) { spawn(); spawnT = rand(.7, 1.1); }
    for (const it of items.slice()) {
      if (it.done) continue; it.y -= it.v * dt; it.ph += dt * 1.6;
      it.el.style.transform = `translate(${it.x + Math.sin(it.ph) * 10}px,${it.y}px)`;
      if (it.y < -140) { it.el.remove(); items.splice(items.indexOf(it), 1); }
    }
    G.raf = requestAnimationFrame(loop);
  };
  countdown(() => { rs(); setRound(); last = performance.now(); G.raf = requestAnimationFrame(loop); });
}

/* ===================== 5. 寫字打怪獸 ===================== */
const loader = (ch, ok, err) => fetch(`hanzi/${ch.codePointAt(0).toString(16)}.json`).then(r => r.json()).then(ok).catch(err);
function gBoss() {
  G.review = []; const queue = shuffle(GW()).slice(0, 5); const HP = queue.reduce((a, w) => a + [...w.w].length, 0); let hp = HP, qi = 0, mistakes = 0;
  $('#arena').innerHTML = `<div class="bossArea"><div class="monster" id="mon"><img src="img/monster.webp" alt="搗蛋小怪獸" id="monImg"><div><div class="hpbar"><i id="hp" style="width:100%"></i></div><div style="font-size:15px;color:var(--ink-soft)">小怪獸塗污了詞語！寫對每個字就可以打中牠</div></div></div>
    <div><div class="row" style="margin-top:0"><button class="btn" id="rep">${SPK} 聽詞語</button><button class="btn lav" id="repS">${SPK} 聽例句</button><button class="btn ghost" id="hint">💡 提示</button></div>
    <div class="sent" id="sent"></div><div class="grids" id="gr"></div><div style="text-align:center;font-size:15px;color:var(--ink-soft);margin-top:6px" id="hl"></div></div></div>`;
  const mon = $('#mon');
  let cur, writers = [], ci = 0;
  const react = cls => { mon.classList.remove('hurt', 'laugh'); void mon.offsetWidth; mon.classList.add(cls); };
  const round = () => {
    cur = queue[qi]; ci = 0; const cs = [...cur.w];
    $('#sent').innerHTML = '📖 ' + cur.s.replace(cur.w, '<u>' + '＿'.repeat(cs.length) + '</u>');
    const avail = innerWidth < 720 ? innerWidth - 90 : Math.min(innerWidth, 1060) - 360;
    const sz = Math.round(Math.min(220, Math.max(105, avail / cs.length - 16)));
    $('#gr').innerHTML = cs.map(() => `<div class="tz" style="--sz:${sz}px"></div>`).join('');
    const boxes = [...document.querySelectorAll('#gr .tz')];
    writers = boxes.map((el, k) => HanziWriter.create(el, cs[k], { width: sz, height: sz, padding: Math.round(sz * .07), charDataLoader: loader, showOutline: false, showCharacter: false, strokeColor: '#5b3a45', radicalColor: '#e8558c', highlightColor: '#9fe0c9', drawingColor: '#5b3a45', drawingWidth: Math.max(12, sz / 14), showHintAfterMisses: 3 }));
    G.writers = writers; sayW(cur);
    const next = () => {
      boxes.forEach((b, k) => b.classList.toggle('active', k === ci));
      $('#hl').textContent = `寫第 ${ci + 1} 個字（共 ${cs.length} 個）・寫錯三次會有提示`;
      writers[ci].quiz({
        onMistake: () => { mistakes++; react('laugh'); sfx.bad(); },
        onComplete: s => {
          boxes[ci].classList.remove('active'); boxes[ci].classList.add('done'); if (s.totalMistakes > 2) G.review.push(cur.w);
          hp--; $('#hp').style.width = (hp / HP * 100) + '%'; react('hurt'); sfx.hit(); addScore(s.totalMistakes ? 6 : 10);
          $('#monImg').src = 'img/monster_hurt.webp'; G.timers.push(setTimeout(() => { if (!G.dead && hp > 0) $('#monImg').src = 'img/monster.webp'; }, 900));
          ci++;
          if (ci < cs.length) next();
          else {
            sayP('good'); toast(`寫對了：${cur.w}`); qi++;
            G.timers.push(setTimeout(() => { if (G.dead) return; if (qi >= queue.length) { G.rate = () => mistakes <= 3 ? 3 : mistakes <= 10 ? 2 : 1; finish(true); } else round(); }, 1400));
          }
        }
      });
    };
    next();
  };
  $('#rep').onclick = () => sayW(cur); $('#repS').onclick = () => sayS(cur);
  $('#hint').onclick = () => { const w = writers[ci]; if (!w) return; mistakes++; w.showOutline(); setTimeout(() => { try { w.hideOutline(); } catch (e) {} }, 1500); };
  round();
}

renderHome();
})();
