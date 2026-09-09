/* «Нихао»: китайский с нуля. Всё на телефоне, сервера нет.
   1. Состояние  2. Пиньинь и тоны  3. Озвучка  4. Интервальное повторение
   5. Сессия упражнений  6. Экраны  7. Прописи (онлайн)  8. Запуск */

/* ---------- 1. Состояние ---------- */
const KEY = 'nihao.v1';
const DAY = 86400000;

const ALL_WORDS = LESSONS.flatMap(l => l.words.map(w => ({ hz: w[0], py: w[1], ru: w[2], ex: w[3], exPy: w[4], exRu: w[5], lesson: l.id })));
const BY_HZ = Object.fromEntries(ALL_WORDS.map(w => [w.hz, w]));

const defaults = () => ({
  cards: {},                 /* hz → { due, ivl, ease, reps, lapses } */
  lessonsDone: {},
  tonesSeen: false,
  streak: { count: 0, last: null },
  xp: { total: 0, byDay: {} },
  settings: { dailyNew: 10, goal: 30, rate: 0.85, autoplay: true, pinyinInTasks: true }
});
let S = load();
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    const d = defaults();
    return Object.assign(d, raw, { settings: Object.assign(d.settings, raw.settings || {}), streak: Object.assign(d.streak, raw.streak || {}), xp: Object.assign(d.xp, raw.xp || {}) });
  } catch { return defaults(); }
}
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const view = $('#view');
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const startOfToday = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
function plural(n, one, few, many) { const a = n % 10, b = n % 100; if (a === 1 && b !== 11) return one; if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return few; return many; }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2000); }
function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch {} }

/* ---------- 2. Пиньинь и тоны ---------- */
const TONE_MARKS = { 1: 'āēīōūǖ', 2: 'áéíóúǘ', 3: 'ǎěǐǒǔǚ', 4: 'àèìòùǜ' };
function toneOf(syl) {
  for (const t of [1, 2, 3, 4]) for (const ch of TONE_MARKS[t]) if (syl.includes(ch)) return t;
  return 0;
}
const SYL_RE = /[bpmfdtnlgkhjqxzcsrywBPMFDTNLGKHJQXZCSRYW]*[aeiouüAEIOUāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+(?:ng|n)?r?/g;
function syllables(py) {
  return py.split(/[\s']+/).flatMap(part => {
    const m = part.match(SYL_RE);
    return m && m.join('') === part.replace(/[^\p{L}]/gu, '') ? m : [part];
  });
}
const TOKEN_RE = new RegExp(SYL_RE.source + '|[^\\p{L}]+', 'gu');
/* Раскрашивает слоги по тонам, сохраняя пробелы, апострофы и знаки препинания как есть. */
function pinyinHtml(py) {
  const tokens = py.match(TOKEN_RE);
  if (!tokens || tokens.join('') !== py) return `<span class="t${toneOf(py)}">${esc(py)}</span>`;
  return tokens.map(t => /\p{L}/u.test(t) ? `<span class="t${toneOf(t)}">${esc(t)}</span>` : esc(t)).join('');
}
const STRIP = { 'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a', 'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e', 'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i', 'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o', 'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u', 'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v', 'ü': 'v' };
function plainPinyin(py) {
  return py.toLowerCase().replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, c => STRIP[c]).replace(/[^a-z]/g, '');
}

/* ---------- 3. Озвучка ---------- */
let zhVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices();
  zhVoice = vs.find(v => /^zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
}
function speak(text, rate) {
  if (!('speechSynthesis' in window)) return;
  if (!zhVoice) pickVoice();
  const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, ''));
  u.lang = 'zh-CN';
  if (zhVoice) u.voice = zhVoice;
  u.rate = rate || S.settings.rate;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

/* ---------- 4. Интервальное повторение (SM-2 с четырьмя исходами) ---------- */
function card(hz) { return S.cards[hz] || null; }
function isLearned(hz) { return !!S.cards[hz]; }
function dueWords() {
  const now = Date.now();
  return ALL_WORDS.filter(w => S.cards[w.hz] && S.cards[w.hz].due <= now);
}
function grade(hz, ok) {
  const c = S.cards[hz] || { due: 0, ivl: 0, ease: 2.5, reps: 0, lapses: 0 };
  if (ok) {
    c.ivl = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.max(c.ivl + 1, Math.round(c.ivl * c.ease));
    c.reps++;
  } else {
    c.ivl = 1; c.reps = Math.min(c.reps, 1); c.lapses++; c.ease = Math.max(1.3, c.ease - 0.2);
  }
  c.due = startOfToday() + c.ivl * DAY + 4 * 3600000;   /* с четырёх утра следующего дня */
  S.cards[hz] = c;
}
function nextLesson() { return LESSONS.find(l => !S.lessonsDone[l.id]) || null; }
function learnedCount() { return Object.keys(S.cards).length; }

function addXp(n) {
  const k = todayKey();
  S.xp.total += n;
  S.xp.byDay[k] = (S.xp.byDay[k] || 0) + n;
}
function touchStreak() {
  const k = todayKey();
  if (S.streak.last === k) return;
  const y = new Date(startOfToday() - DAY);
  const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  S.streak.count = S.streak.last === yk ? S.streak.count + 1 : 1;
  S.streak.last = k;
}
function streakAlive() {
  const k = todayKey();
  const y = new Date(startOfToday() - DAY);
  const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  return S.streak.last === k || S.streak.last === yk;
}

/* ---------- 5. Сессия упражнений ---------- */
/* Типы: intro, hz2ru, ru2hz, audio2hz, tone, pinyin, sentence */
let session = null;

function distractors(word, field, n) {
  const pool = shuffle(ALL_WORDS.filter(w => w.hz !== word.hz && w[field] !== word[field]));
  const same = pool.filter(w => w.lesson === word.lesson);
  const out = [];
  for (const w of same.concat(pool)) { if (out.length >= n) break; if (!out.some(o => o[field] === w[field])) out.push(w); }
  return out;
}
function tasksFor(word, kinds) {
  return kinds.map(k => ({ kind: k, word }));
}
function buildLessonSession(lesson) {
  const items = [];
  const chunks = [];
  for (let i = 0; i < lesson.words.length; i += 5) chunks.push(lesson.words.slice(i, i + 5).map(w => BY_HZ[w[0]]));
  chunks.forEach(chunk => {
    chunk.forEach(w => items.push({ kind: 'intro', word: w }));
    let drills = [];
    chunk.forEach(w => {
      const kinds = ['hz2ru', 'ru2hz'];
      kinds.push(w.hz.length === 1 && toneOf(syllables(w.py)[0]) ? 'tone' : 'audio2hz');
      drills = drills.concat(tasksFor(w, kinds));
    });
    items.push(...shuffle(drills));
    items.push(...shuffle(chunk.map(w => ({ kind: Math.random() < 0.5 ? 'pinyin' : 'sentence', word: w }))));
  });
  return { mode: 'lesson', lesson, items, i: 0, correct: 0, wrong: 0, requeue: [], xp: 0 };
}
function buildReviewSession(words, mode) {
  const kinds = ['hz2ru', 'ru2hz', 'audio2hz', 'pinyin', 'sentence', 'tone'];
  const items = shuffle(words).slice(0, 20).map(w => {
    let k = kinds[Math.floor(Math.random() * kinds.length)];
    if (k === 'tone' && !(w.hz.length === 1 && toneOf(syllables(w.py)[0]))) k = 'audio2hz';
    return { kind: k, word: w };
  });
  return { mode: mode || 'review', items, i: 0, correct: 0, wrong: 0, requeue: [], xp: 0, graded: {} };
}
function startSession(s) {
  session = s;
  $('#session').hidden = false;
  document.body.classList.add('in-session');
  renderTask();
}
function endSession() {
  const s = session;
  session = null;
  if (!s) return;
  if (s.mode === 'lesson') {
    S.lessonsDone[s.lesson.id] = true;
    s.lesson.words.forEach(w => { if (!S.cards[w[0]]) grade(w[0], true); });
  }
  const done = s.correct + s.wrong > 0;
  if (done) { addXp(s.xp); touchStreak(); }
  save();
  $('#sessBody').innerHTML = `
    <div class="done">
      <div class="done-emoji">${s.wrong === 0 ? '🎉' : '👍'}</div>
      <h2>${s.mode === 'lesson' ? 'Урок пройден' : 'Повторение закончено'}</h2>
      <div class="done-stats">
        <div><b>${s.correct}</b><span>верно</span></div>
        <div><b>${s.wrong}</b><span>${plural(s.wrong, 'ошибка', 'ошибки', 'ошибок')}</span></div>
        <div><b>+${s.xp}</b><span>очков</span></div>
      </div>
      <p class="muted">${s.mode === 'lesson' ? 'Слова урока попали в повторение. Завтра приложение спросит их снова.' : 'Следующая порция придёт, когда подойдёт срок.'}</p>
      <p class="muted">Серия: ${S.streak.count} ${plural(S.streak.count, 'день', 'дня', 'дней')} 🔥</p>
    </div>`;
  $('#sessionFoot').innerHTML = `<button class="btn block" id="sessClose">Готово</button>`;
  $('#sessClose').onclick = closeSession;
  $('#sessProgress').style.width = '100%';
}
function closeSession() {
  session = null;
  $('#session').hidden = true;
  document.body.classList.remove('in-session');
  render();
}
$('#sessQuit').onclick = () => {
  if (!session) return closeSession();
  if (session.correct + session.wrong === 0 || confirm('Прервать сессию? Пройденное засчитается.')) endSession();
};

function renderTask() {
  const s = session;
  if (s.i >= s.items.length) {
    if (s.requeue.length) { s.items = s.items.concat(s.requeue); s.requeue = []; }
    else return endSession();
  }
  const t = s.items[s.i];
  $('#sessProgress').style.width = `${Math.round((s.i / (s.items.length + s.requeue.length)) * 100)}%`;
  const body = $('#sessBody');
  const foot = $('#sessionFoot');
  foot.innerHTML = '';
  const w = t.word;
  const py = S.settings.pinyinInTasks;

  if (t.kind === 'intro') {
    body.innerHTML = `
      <div class="task-label">Новое слово</div>
      <div class="bigcard" id="playWord">
        <div class="hz-big">${esc(w.hz)}</div>
        <div class="py-big">${pinyinHtml(w.py)}</div>
        <div class="ru-big">${esc(w.ru)}</div>
        <div class="speaker">🔊</div>
      </div>
      <div class="example" id="playEx">
        <div class="ex-hz">${esc(w.ex.replace(/\s+/g, ''))}</div>
        <div class="ex-py">${pinyinHtml(w.exPy)}</div>
        <div class="ex-ru">${esc(w.exRu)}</div>
      </div>`;
    $('#playWord').onclick = () => speak(w.hz);
    $('#playEx').onclick = () => speak(w.ex);
    if (S.settings.autoplay) speak(w.hz);
    foot.innerHTML = `<button class="btn block" id="next">Понятно</button>`;
    $('#next').onclick = () => { s.i++; renderTask(); };
    return;
  }

  if (t.kind === 'hz2ru' || t.kind === 'ru2hz' || t.kind === 'audio2hz') {
    const field = t.kind === 'hz2ru' ? 'ru' : 'hz';
    const opts = shuffle([w].concat(distractors(w, field, 3)));
    let prompt;
    if (t.kind === 'hz2ru') prompt = `<div class="prompt" id="playP"><div class="hz-big">${esc(w.hz)}</div>${py ? `<div class="py-mid">${pinyinHtml(w.py)}</div>` : ''}<div class="speaker">🔊</div></div>`;
    else if (t.kind === 'ru2hz') prompt = `<div class="prompt"><div class="ru-prompt">${esc(w.ru)}</div></div>`;
    else prompt = `<div class="prompt" id="playP"><div class="speaker-big">🔊</div><div class="muted">Нажмите, чтобы послушать ещё раз</div></div>`;
    body.innerHTML = `
      <div class="task-label">${t.kind === 'hz2ru' ? 'Что это значит?' : t.kind === 'ru2hz' ? 'Как это по-китайски?' : 'Что вы услышали?'}</div>
      ${prompt}
      <div class="options">${opts.map((o, i) => `<button class="opt" data-i="${i}">${field === 'ru' ? esc(o.ru) : `<span class="opt-hz">${esc(o.hz)}</span>${py && t.kind === 'ru2hz' ? `<span class="opt-py">${pinyinHtml(o.py)}</span>` : ''}`}</button>`).join('')}
      </div>`;
    const p = $('#playP'); if (p) p.onclick = () => speak(w.hz);
    if (t.kind !== 'ru2hz' && S.settings.autoplay) speak(w.hz);
    body.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const chosen = opts[+b.dataset.i];
      const ok = chosen.hz === w.hz;
      body.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (opts[+x.dataset.i].hz === w.hz) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      finish(ok, `${w.hz} · ${w.py} · ${w.ru}`);
    });
    return;
  }

  if (t.kind === 'tone') {
    const tone = toneOf(syllables(w.py)[0]);
    body.innerHTML = `
      <div class="task-label">Какой тон?</div>
      <div class="prompt" id="playP"><div class="hz-big">${esc(w.hz)}</div><div class="py-mid plain">${esc(plainPinyin(w.py).replace(/v/g, 'ü'))}</div><div class="speaker">🔊</div></div>
      <div class="tones">${[1, 2, 3, 4].map(n => `<button class="opt tone-opt t${n}" data-t="${n}"><span class="tone-mark">${['', 'ˉ', 'ˊ', 'ˇ', 'ˋ'][n]}</span><span>${n}-й тон</span><small>${['', 'ровный', 'вверх', 'вниз-вверх', 'резко вниз'][n]}</small></button>`).join('')}</div>`;
    $('#playP').onclick = () => speak(w.hz);
    if (S.settings.autoplay) speak(w.hz);
    body.querySelectorAll('.tone-opt').forEach(b => b.onclick = () => {
      const ok = +b.dataset.t === tone;
      body.querySelectorAll('.tone-opt').forEach(x => { x.disabled = true; if (+x.dataset.t === tone) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      finish(ok, `${w.hz} читается ${w.py}, ${tone}-й тон`);
    });
    return;
  }

  if (t.kind === 'pinyin') {
    body.innerHTML = `
      <div class="task-label">Напишите пиньинь</div>
      <div class="prompt" id="playP"><div class="hz-big">${esc(w.hz)}</div><div class="ru-mid">${esc(w.ru)}</div><div class="speaker">🔊</div></div>
      <input class="answer" id="ans" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="латиницей, тоны можно не ставить">`;
    $('#playP').onclick = () => speak(w.hz);
    if (S.settings.autoplay) speak(w.hz);
    foot.innerHTML = `<button class="btn block" id="check">Проверить</button>`;
    const inp = $('#ans');
    setTimeout(() => inp.focus(), 50);
    const check = () => {
      const given = plainPinyin(inp.value.replace(/[0-5]/g, ''));
      if (!given) return;
      const ok = given === plainPinyin(w.py);
      inp.disabled = true; inp.classList.add(ok ? 'right' : 'wrong');
      finish(ok, `Правильно: ${w.py}`);
    };
    $('#check').onclick = check;
    inp.onkeydown = e => { if (e.key === 'Enter') check(); };
    return;
  }

  if (t.kind === 'sentence') {
    const raw = w.ex.split(' ');
    const punct = raw.filter(x => /^[。！？，]+$/.test(x)).join('');
    const tokens = raw.filter(x => !/^[。！？，]+$/.test(x));
    const pool = shuffle(tokens.map((tk, i) => ({ tk, i })));
    let built = [];
    body.innerHTML = `
      <div class="task-label">Соберите фразу</div>
      <div class="prompt"><div class="ru-prompt">${esc(w.exRu)}</div></div>
      <div class="built" id="built"><span class="placeholder">Нажимайте слова по порядку</span></div>
      <div class="bank" id="bank">${pool.map(p => `<button class="tok" data-i="${p.i}">${esc(p.tk)}</button>`).join('')}</div>`;
    foot.innerHTML = `<button class="btn block" id="check" disabled>Проверить</button>`;
    const draw = () => {
      $('#built').innerHTML = built.length ? built.map(b => `<button class="tok in" data-i="${b.i}">${esc(b.tk)}</button>`).join('') + (built.length === tokens.length ? `<span class="punct">${esc(punct)}</span>` : '') : '<span class="placeholder">Нажимайте слова по порядку</span>';
      $('#built').querySelectorAll('.tok').forEach(b => b.onclick = () => { const i = +b.dataset.i; built = built.filter(x => x.i !== i); $(`#bank [data-i="${i}"]`).hidden = false; draw(); });
      $('#check').disabled = built.length !== tokens.length;
    };
    $('#bank').querySelectorAll('.tok').forEach(b => b.onclick = () => { b.hidden = true; built.push({ tk: b.textContent, i: +b.dataset.i }); draw(); });
    $('#check').onclick = () => {
      const ok = built.map(b => b.tk).join(' ') === tokens.join(' ');
      $('#built').classList.add(ok ? 'right' : 'wrong');
      speak(w.ex);
      finish(ok, `${w.ex.replace(/\s+/g, '')} · ${w.exPy}`);
    };
    return;
  }

  function finish(ok, answerText) {
    const s = session;
    if (!s) return;
    const graded = s.graded || (s.graded = {});
    if (ok) { s.correct++; s.xp += 2; vibrate(15); } else { s.wrong++; vibrate([40, 40, 40]); }
    if (s.mode !== 'lesson' && !graded[w.hz]) { grade(w.hz, ok); graded[w.hz] = true; save(); }
    if (!ok) s.requeue.push({ kind: t.kind, word: w });
    const foot = $('#sessionFoot');
    foot.innerHTML = `<div class="feedback ${ok ? 'ok' : 'bad'}"><b>${ok ? 'Верно' : 'Не совсем'}</b><span>${esc(answerText)}</span></div><button class="btn block ${ok ? 'btn-ok' : 'btn-bad'}" id="next">Дальше</button>`;
    $('#next').onclick = () => { s.i++; renderTask(); };
    if (ok && S.settings.autoplay) setTimeout(() => { if (session === s && s.items[s.i] === t) { s.i++; renderTask(); } }, 900);
  }
}

/* ---------- 6. Экраны ---------- */
let route = { tab: 'home', lesson: null, page: null, q: '' };

function render() {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === route.tab));
  $('#btnBack').hidden = !(route.lesson || route.page);
  ({ home: renderHome, lessons: renderLessons, dict: renderDict, more: renderMore })[route.tab]();
  window.scrollTo(0, 0);
}
function setTop(t) { $('#topline').textContent = t; }

function renderHome() {
  setTop('Сегодня');
  const due = dueWords();
  const nl = nextLesson();
  const k = todayKey();
  const xpToday = S.xp.byDay[k] || 0;
  const goal = S.settings.goal;
  const pct = Math.min(100, Math.round(xpToday / goal * 100));
  const learned = learnedCount();
  let html = `
    <div class="card hero">
      <div class="hero-row">
        <div class="streak ${streakAlive() && S.streak.count ? 'on' : ''}"><span class="flame">🔥</span><b>${streakAlive() ? S.streak.count : 0}</b><span>${plural(streakAlive() ? S.streak.count : 0, 'день', 'дня', 'дней')}</span></div>
        <div class="goal"><div class="goal-nums"><b>${xpToday}</b> / ${goal} очков</div><div class="bar"><i style="width:${pct}%"></i></div></div>
      </div>
      <p class="muted">${S.streak.last === k ? 'Сегодня уже занимались. Ещё одна короткая сессия закрепит слова.' : 'Серия засчитывается за одну сессию. Пять минут достаточно.'}</p>
    </div>`;

  if (!S.tonesSeen) html += `<button class="row accent" id="goTones"><span class="ic">🎵</span><span><div class="t">Начните с тонов</div><div class="s">Пять минут, без них китайский не звучит</div></span><span class="chev">›</span></button>`;

  html += `<div class="actions">`;
  if (due.length) html += `<button class="action primary" id="goReview"><b>Повторить ${due.length} ${plural(due.length, 'слово', 'слова', 'слов')}</b><span>Подошёл срок, память ещё держит</span></button>`;
  if (nl) html += `<button class="action ${due.length ? '' : 'primary'}" id="goLesson"><b>Урок ${nl.id}: ${esc(nl.title)}</b><span>${nl.words.length} новых слов, около 10 минут</span></button>`;
  if (!due.length && learned) html += `<button class="action" id="goFree"><b>Свободная практика</b><span>Случайные слова из выученных</span></button>`;
  html += `</div>`;

  html += `<div class="card"><h2>Прогресс</h2>
    <div class="kv"><span>Выучено слов</span><b>${learned} из ${ALL_WORDS.length}</b></div>
    <div class="kv"><span>Пройдено уроков</span><b>${Object.keys(S.lessonsDone).length} из ${LESSONS.length}</b></div>
    <div class="kv"><span>Всего очков</span><b>${S.xp.total}</b></div>
    <div class="bar" style="margin-top:8px"><i style="width:${Math.round(learned / ALL_WORDS.length * 100)}%"></i></div></div>`;

  view.innerHTML = html;
  const gt = $('#goTones'); if (gt) gt.onclick = () => { route.tab = 'lessons'; route.page = 'tones'; render(); };
  const gr = $('#goReview'); if (gr) gr.onclick = () => startSession(buildReviewSession(due));
  const gl = $('#goLesson'); if (gl) gl.onclick = () => startSession(buildLessonSession(nl));
  const gf = $('#goFree'); if (gf) gf.onclick = () => startSession(buildReviewSession(ALL_WORDS.filter(w => isLearned(w.hz)), 'free'));
}

function renderLessons() {
  if (route.page === 'tones') return renderTones();
  if (route.page === 'radicals') return renderRadicals();
  if (route.lesson) return renderLesson(LESSONS.find(l => l.id === route.lesson));
  setTop('Уроки');
  view.innerHTML = `
    <button class="row" id="rowTones"><span class="ic">🎵</span><span><div class="t">Тоны</div><div class="s">Четыре тона и нейтральный, с примерами</div></span><span class="chev">›</span></button>
    <button class="row" id="rowRad"><span class="ic">部</span><span><div class="t">Ключи иероглифов</div><div class="s">20 строительных блоков</div></span><span class="chev">›</span></button>
    <h2 class="sec">Уровень 1 · ${ALL_WORDS.length} слов</h2>
    <div class="list">${LESSONS.map(l => {
      const n = l.words.filter(w => isLearned(w[0])).length;
      const done = S.lessonsDone[l.id];
      return `<button class="row ${done ? 'done' : ''}" data-l="${l.id}"><span class="num">${l.id}</span><span><div class="t">${esc(l.title)}</div><div class="s">${done ? 'Пройден · ' : ''}${n} из ${l.words.length} слов в повторении</div></span><span class="chev">${done ? '✓' : '›'}</span></button>`;
    }).join('')}</div>`;
  $('#rowTones').onclick = () => { route.page = 'tones'; render(); };
  $('#rowRad').onclick = () => { route.page = 'radicals'; render(); };
  view.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { route.lesson = +b.dataset.l; render(); });
}

function renderLesson(l) {
  setTop(`Урок ${l.id}`);
  view.innerHTML = `
    <h1 class="h1">${esc(l.title)}</h1>
    <div class="card note"><h2>Грамматика</h2><p>${esc(l.note)}</p></div>
    <h2 class="sec">Слова</h2>
    <div class="words">${l.words.map(w => `<div class="word" data-hz="${esc(w[0])}"><div class="w-hz">${esc(w[0])}</div><div><div class="w-py">${pinyinHtml(w[1])}</div><div class="w-ru">${esc(w[2])}</div></div><div class="w-dot ${isLearned(w[0]) ? 'on' : ''}"></div></div>`).join('')}</div>
    <div class="spacer"></div>`;
  view.querySelectorAll('.word').forEach(el => el.onclick = () => speak(el.dataset.hz));
  $('#fab').hidden = false;
  $('#fab').textContent = S.lessonsDone[l.id] ? 'Пройти ещё раз' : 'Учить урок';
  $('#fab').onclick = () => { $('#fab').hidden = true; startSession(buildLessonSession(l)); };
}

function renderTones() {
  setTop('Тоны');
  view.innerHTML = `
    <h1 class="h1">${esc(TONES_INTRO.title)}</h1>
    <p class="muted">${esc(TONES_INTRO.text)}</p>
    ${TONES_INTRO.tones.map(t => `<div class="tone-card t${t[4]}-b" data-hz="${esc(t[1])}">
      <div class="tone-head"><span class="tone-py t${t[4]}">${esc(t[0])}</span><span class="tone-hz">${esc(t[1])}</span><span class="tone-ru">${esc(t[2])}</span><span class="speaker">🔊</span></div>
      <p>${esc(t[3])}</p></div>`).join('')}
    <div class="card"><h2>Как тренировать</h2><p class="muted">Нажимайте карточки и повторяйте вслух, преувеличивая движение голоса. В уроках упражнение «Какой тон?» проверит слух: слово звучит, вы выбираете тон.</p></div>`;
  view.querySelectorAll('.tone-card').forEach(el => el.onclick = () => speak(el.dataset.hz, 0.7));
  if (!S.tonesSeen) { S.tonesSeen = true; save(); }
}

function renderRadicals() {
  setTop('Ключи');
  view.innerHTML = `
    <p class="muted">Ключ подсказывает смысл иероглифа: всё с 氵 связано с водой, всё с 讠 с речью. Рядом слова курса, где ключ встречается.</p>
    ${RADICALS.map(r => `<div class="rad"><div class="rad-hz">${esc(r[0])}</div><div><div class="rad-ru"><b>${esc(r[2])}</b> · <span class="t${toneOf(r[1])}">${esc(r[1])}</span></div><div class="rad-ex">${esc(r[3])}</div></div></div>`).join('')}`;
}

function renderDict() {
  setTop('Словарь');
  const q = route.q.trim().toLowerCase();
  const pq = plainPinyin(q);
  const list = ALL_WORDS.filter(w => !q || w.hz.includes(q) || w.ru.toLowerCase().includes(q) || (pq && plainPinyin(w.py).includes(pq)));
  view.innerHTML = `
    <input class="search" id="q" type="search" placeholder="иероглиф, пиньинь или перевод" value="${esc(route.q)}">
    <div class="words">${list.map(w => `<div class="word" data-hz="${esc(w.hz)}"><div class="w-hz">${esc(w.hz)}</div><div><div class="w-py">${pinyinHtml(w.py)}</div><div class="w-ru">${esc(w.ru)}</div></div><div class="w-dot ${isLearned(w.hz) ? 'on' : ''}"></div></div>`).join('') || '<p class="muted">Ничего не найдено</p>'}</div>`;
  const inp = $('#q');
  inp.oninput = () => { route.q = inp.value; const pos = inp.selectionStart; renderDict(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  view.querySelectorAll('.word').forEach(el => el.onclick = () => openWord(BY_HZ[el.dataset.hz]));
}

function openWord(w) {
  const c = card(w.hz);
  const sheet = $('#sheet');
  $('#sheetBody').innerHTML = `
    <div class="bigcard" id="shPlay"><div class="hz-big">${esc(w.hz)}</div><div class="py-big">${pinyinHtml(w.py)}</div><div class="ru-big">${esc(w.ru)}</div><div class="speaker">🔊</div></div>
    <div class="example" id="shEx"><div class="ex-hz">${esc(w.ex.replace(/\s+/g, ''))}</div><div class="ex-py">${pinyinHtml(w.exPy)}</div><div class="ex-ru">${esc(w.exRu)}</div></div>
    <div class="kv"><span>Урок</span><b>${w.lesson}</b></div>
    <div class="kv"><span>Статус</span><b>${c ? `в повторении, интервал ${c.ivl} ${plural(c.ivl, 'день', 'дня', 'дней')}` : 'ещё не учили'}</b></div>
    <div class="writer" id="writer"></div>
    <div class="writer-btns"><button class="btn btn-light" id="wAnim">Порядок черт</button><button class="btn btn-light" id="wQuiz">Прописать</button></div>
    <p class="small">Прописи подгружаются из сети, офлайн недоступны.</p>`;
  sheet.hidden = false; $('#backdrop').hidden = false;
  $('#shPlay').onclick = () => speak(w.hz);
  $('#shEx').onclick = () => speak(w.ex);
  $('#wAnim').onclick = () => writer(w.hz, 'animate');
  $('#wQuiz').onclick = () => writer(w.hz, 'quiz');
}
function closeSheet() { $('#sheet').hidden = true; $('#backdrop').hidden = true; }
$('#sheetClose').onclick = closeSheet;
$('#backdrop').onclick = closeSheet;

function renderMore() {
  setTop('Ещё');
  const st = S.settings;
  view.innerHTML = `
    <div class="card"><h2>Занятия</h2>
      <label class="field"><span>Цель на день, очков (2 очка за верный ответ)</span>
        <select id="goal">${[10, 20, 30, 50, 80].map(v => `<option ${st.goal === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>Скорость озвучки</span>
        <input type="range" id="rate" min="0.6" max="1.1" step="0.05" value="${st.rate}"></label>
      <label class="check"><input type="checkbox" id="autoplay" ${st.autoplay ? 'checked' : ''}><span>Озвучивать автоматически и листать верные ответы</span></label>
      <label class="check"><input type="checkbox" id="pyt" ${st.pinyinInTasks ? 'checked' : ''}><span>Показывать пиньинь в упражнениях (снимите, когда узнаёте иероглифы)</span></label>
      <button class="btn btn-light block" id="testVoice">Проверить китайский голос</button>
      <p class="small">${zhVoice ? `Голос: ${esc(zhVoice.name)}` : 'Китайский голос в системе не найден. Android: Настройки → Язык и ввод → Синтез речи → установить китайский. iPhone: Настройки → Универсальный доступ → Устный контент → Голоса → Китайский.'}</p>
    </div>
    <div class="card"><h2>Прогресс</h2>
      <button class="btn btn-light block" id="export">Скопировать прогресс</button>
      <button class="btn btn-light block" id="import">Вставить прогресс</button>
      <button class="btn btn-light block" id="reset">Сбросить всё</button>
      <p class="small">Прогресс лежит только в этом телефоне. «Скопировать» кладёт его в буфер обмена, чтобы перенести на другое устройство.</p>
    </div>
    <div class="card"><h2>О приложении</h2>
      <p class="muted">Курс: 150 слов уровня HSK 1 по 16 урокам с грамматикой, тоны, ключи иероглифов, интервальное повторение. Бесплатно и без рекламы.</p>
      <p class="small">Словарь сверен ${CONTENT_VERIFIED}. Исходники открыты: github.com/mazurovmikhail-ui/nihao</p>
    </div>`;
  $('#goal').onchange = e => { st.goal = +e.target.value; save(); };
  $('#rate').oninput = e => { st.rate = +e.target.value; save(); };
  $('#rate').onchange = () => speak('你好');
  $('#autoplay').onchange = e => { st.autoplay = e.target.checked; save(); };
  $('#pyt').onchange = e => { st.pinyinInTasks = e.target.checked; save(); };
  $('#testVoice').onclick = () => { speak('你好，我是学生。'); if (!zhVoice) toast('Китайский голос не установлен'); };
  $('#export').onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(S)); toast('Скопировано'); } catch { prompt('Скопируйте текст:', JSON.stringify(S)); } };
  $('#import').onclick = () => { const v = prompt('Вставьте скопированный прогресс:'); if (!v) return; try { const o = JSON.parse(v); if (!o.cards) throw 0; localStorage.setItem(KEY, JSON.stringify(o)); S = load(); toast('Прогресс восстановлен'); render(); } catch { toast('Не похоже на прогресс'); } };
  $('#reset').onclick = () => { if (confirm('Стереть весь прогресс?')) { localStorage.removeItem(KEY); S = load(); render(); } };
}

/* ---------- 7. Прописи (hanzi-writer, только онлайн) ---------- */
let hwLoading = null;
function loadWriter() {
  if (window.HanziWriter) return Promise.resolve();
  if (hwLoading) return hwLoading;
  hwLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js';
    s.onload = res; s.onerror = () => { hwLoading = null; rej(); };
    document.head.appendChild(s);
  });
  return hwLoading;
}
async function writer(hz, mode) {
  const box = $('#writer');
  box.innerHTML = '<p class="muted">Загрузка…</p>';
  try { await loadWriter(); } catch { box.innerHTML = '<p class="muted">Нет сети: прописи недоступны офлайн.</p>'; return; }
  box.innerHTML = '';
  const size = Math.min(140, Math.floor((box.clientWidth - 8) / hz.length) - 6);
  const writers = [...hz].map(ch => {
    const d = document.createElement('div'); d.className = 'hw'; box.appendChild(d);
    return HanziWriter.create(d, ch, { width: size, height: size, padding: 4, showOutline: true, strokeColor: '#16181d', radicalColor: '#c8102e', strokeAnimationSpeed: 1, delayBetweenStrokes: 200, showHintAfterMisses: 2, highlightOnComplete: true, onLoadCharDataError: () => { d.innerHTML = '<span class="muted">?</span>'; } });
  });
  if (mode === 'animate') { for (const w of writers) await new Promise(r => w.animateCharacter({ onComplete: r })); }
  else writers.forEach(w => w.quiz());
}

/* ---------- 8. Запуск ---------- */
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { route.tab = b.dataset.tab; route.lesson = null; route.page = null; $('#fab').hidden = true; render(); });
$('#btnBack').onclick = () => { route.lesson = null; route.page = null; $('#fab').hidden = true; render(); };
render();
document.addEventListener('visibilitychange', () => { if (!document.hidden && !session && route.tab === 'home') render(); });
if ('serviceWorker' in navigator && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
