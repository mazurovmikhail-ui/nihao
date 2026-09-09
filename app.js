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
  dialogsDone: {},
  confusions: {},
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
  const confused = pool.filter(w => confusionWith(word.hz, w.hz) > 0).sort((a, b) => confusionWith(word.hz, b.hz) - confusionWith(word.hz, a.hz));
  const same = pool.filter(w => w.lesson === word.lesson);
  const out = [];
  for (const w of confused.concat(same, pool)) { if (out.length >= n) break; if (!out.some(o => o[field] === w[field] || o.hz === w.hz)) out.push(w); }
  return out;
}
const canWrite = w => /^[\u4e00-\u9fff]{1,3}$/.test(w.hz);
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
    items.push(...shuffle(chunk.filter(canWrite)).slice(0, 2).map(w => ({ kind: 'write', word: w })));
    items.push({ kind: 'listen', word: chunk[Math.floor(Math.random() * chunk.length)] });
    if (recognizerAvailable()) items.push({ kind: 'speak', word: chunk[Math.floor(Math.random() * chunk.length)] });
  });
  return { mode: 'lesson', lesson, items, i: 0, correct: 0, wrong: 0, requeue: [], xp: 0 };
}
function buildReviewSession(words, mode) {
  const kinds = mode === 'write' ? ['write'] : mode === 'speak' ? ['speak'] : ['hz2ru', 'ru2hz', 'audio2hz', 'pinyin', 'sentence', 'tone', 'write', 'listen'].concat(recognizerAvailable() ? ['speak'] : []);
  const items = shuffle(words).slice(0, mode === 'write' ? 8 : 20).map(w => {
    let k = kinds[Math.floor(Math.random() * kinds.length)];
    if (k === 'tone' && !(w.hz.length === 1 && toneOf(syllables(w.py)[0]))) k = 'audio2hz';
    if (k === 'write' && !canWrite(w)) k = 'hz2ru';
    if (k === 'speak' && !recognizerAvailable()) k = 'audio2hz';
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
      <h2>${({ lesson: 'Урок пройден', pics: 'Картинки пройдены', write: 'Прописи закончены', free: 'Практика закончена', tones: 'Тоны отработаны', speak: 'Произношение отработано' })[s.mode] || 'Повторение закончено'}</h2>
      <div class="done-stats">
        <div><b>${s.correct}</b><span>верно</span></div>
        <div><b>${s.wrong}</b><span>${plural(s.wrong, 'ошибка', 'ошибки', 'ошибок')}</span></div>
        <div><b>+${s.xp}</b><span>очков</span></div>
      </div>
      <p class="muted">${s.mode === 'lesson' ? 'Слова урока попали в повторение. Завтра приложение спросит их снова.' : s.mode === 'pics' ? 'Картинки закрепляют слова, а в повторение они попадают из уроков.' : 'Следующая порция придёт, когда подойдёт срок.'}</p>
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
      </div>
      ${typeof CULTURE !== 'undefined' && CULTURE[w.hz] ? `<div class="culture"><span class="culture-k">🏮 Из жизни</span>${esc(CULTURE[w.hz])}</div>` : ''}`;
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
      if (!ok) { b.classList.add('wrong'); recordConfusion(w.hz, chosen.hz); }
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

  if (t.kind === 'listen') {
    const raw = w.ex.split(' ');
    const punct = raw.filter(x => /^[。！？，]+$/.test(x)).join('');
    const tokens = raw.filter(x => !/^[。！？，]+$/.test(x));
    const pool = shuffle(tokens.map((tk, i) => ({ tk, i })));
    let built = [];
    body.innerHTML = `
      <div class="task-label">Что вы услышали? Соберите фразу</div>
      <div class="prompt" id="playP"><div class="speaker-big">🔊</div><div class="muted">Нажмите, чтобы послушать ещё раз</div></div>
      <div class="built" id="built"><span class="placeholder">Нажимайте слова по порядку</span></div>
      <div class="bank" id="bank">${pool.map(p => `<button class="tok" data-i="${p.i}">${esc(p.tk)}</button>`).join('')}</div>`;
    $('#playP').onclick = () => speak(w.ex);
    speak(w.ex);
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
      finish(ok, `${w.ex.replace(/\s+/g, '')} · ${w.exPy} · ${w.exRu}`);
    };
    return;
  }

  if (t.kind === 'speak') {
    let attempts = 0, busy = false;
    body.innerHTML = `
      <div class="task-label">Произнесите вслух</div>
      <div class="prompt" id="playP"><div class="hz-big">${esc(w.hz)}</div><div class="py-mid">${pinyinHtml(w.py)}</div><div class="ru-mid">${esc(w.ru)}</div><div class="speaker">🔊</div></div>
      <button class="mic" id="mic"><span class="mic-ic">🎤</span><span id="micLabel">Нажмите и говорите</span></button>
      <div class="heard" id="heard"></div>
      <p class="small" style="text-align:center">Речь распознаёт система телефона. Если ничего не слышит, установите китайский язык для голосового ввода.</p>`;
    $('#playP').onclick = () => speak(w.hz);
    foot.innerHTML = `<button class="btn btn-light block" id="skip">Пропустить</button>`;
    $('#skip').onclick = () => { s.i++; renderTask(); };
    $('#mic').onclick = async () => {
      if (busy) return; busy = true;
      $('#mic').classList.add('rec'); $('#micLabel').textContent = 'Слушаю…';
      let r;
      try { r = evaluateSpeech(w, await recognize()); }
      catch (e) { r = { ok: false, html: '<span class="muted">Микрофон недоступен или нет разрешения.</span>' }; }
      busy = false; $('#mic').classList.remove('rec'); $('#micLabel').textContent = 'Ещё раз';
      $('#heard').innerHTML = r.html;
      attempts++;
      if (r.ok) finish(true, `${w.hz} · ${w.py}`);
      else if (attempts >= 3) finish(false, `${w.hz} · ${w.py} · послушайте образец и повторите позже`);
    };
    return;
  }

  if (t.kind === 'tone1') {
    body.innerHTML = `
      <div class="task-label">Какой тон? Слог «${esc(w.syl)}»</div>
      <div class="prompt" id="playP"><div class="speaker-big">🔊</div><div class="muted">Нажмите, чтобы послушать ещё раз</div></div>
      <div class="tones">${[1, 2, 3, 4].map(n => `<button class="opt tone-opt t${n}" data-t="${n}"><span class="tone-mark">${TONE_MARK_CHAR[n]}</span><span>${n}-й тон</span><small>${['', 'ровный', 'вверх', 'вниз-вверх', 'резко вниз'][n]}</small></button>`).join('')}</div>`;
    $('#playP').onclick = () => speak(w.hz, 0.75);
    speak(w.hz, 0.75);
    body.querySelectorAll('.tone-opt').forEach(b => b.onclick = () => {
      const ok = +b.dataset.t === w.tone;
      body.querySelectorAll('.tone-opt').forEach(x => { x.disabled = true; if (+x.dataset.t === w.tone) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      finish(ok, `${w.hz} · ${w.syl}, ${w.tone}-й тон`);
    });
    return;
  }

  if (t.kind === 'tonepair') {
    const right = [w.ta, w.tb];
    const all = []; for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) if (a !== b) all.push([a, b]);
    const opts = shuffle([right].concat(shuffle(all.filter(p => !(p[0] === w.ta && p[1] === w.tb))).slice(0, 3)));
    body.innerHTML = `
      <div class="task-label">Два слога «${esc(w.syl)}». Какие тоны?</div>
      <div class="prompt" id="playP"><div class="speaker-big">🔊</div><div class="muted">Нажмите, чтобы послушать ещё раз</div></div>
      <div class="tones">${opts.map((p, i) => `<button class="opt tone-opt" data-i="${i}"><span class="tone-mark"><span class="t${p[0]}">${TONE_MARK_CHAR[p[0]]}</span> <span class="t${p[1]}">${TONE_MARK_CHAR[p[1]]}</span></span><span>${p[0]}-й и ${p[1]}-й</span></button>`).join('')}</div>`;
    $('#playP').onclick = () => speakLines([w.a, w.b], 0.75);
    speakLines([w.a, w.b], 0.75);
    body.querySelectorAll('.tone-opt').forEach(b => b.onclick = () => {
      const p = opts[+b.dataset.i];
      const ok = p[0] === w.ta && p[1] === w.tb;
      body.querySelectorAll('.tone-opt').forEach(x => { x.disabled = true; const q = opts[+x.dataset.i]; if (q[0] === w.ta && q[1] === w.tb) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      finish(ok, `${w.a} ${w.b} · ${w.syl}: ${w.ta}-й и ${w.tb}-й тон`);
    });
    return;
  }

  if (t.kind === 'pic2hz' || t.kind === 'hz2pic') {
    const cat = PICS.find(c => c.items.some(it => it[0] === w.hz)) || PICS[0];
    const emojiOf = hz => (cat.items.find(it => it[0] === hz) || ['', '❔'])[1];
    const pool = shuffle(cat.items.filter(it => it[0] !== w.hz && it[1] !== emojiOf(w.hz))).slice(0, 3).map(it => BY_HZ[it[0]]).filter(Boolean);
    const opts = shuffle([w].concat(pool));
    if (t.kind === 'pic2hz') {
      body.innerHTML = `
        <div class="task-label">Что на картинке?</div>
        <div class="prompt"><div class="emoji-big">${emojiOf(w.hz)}</div></div>
        <div class="options">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="opt-hz">${esc(o.hz)}</span>${py ? `<span class="opt-py">${pinyinHtml(o.py)}</span>` : ''}</button>`).join('')}</div>`;
    } else {
      body.innerHTML = `
        <div class="task-label">Найдите картинку</div>
        <div class="prompt" id="playP"><div class="hz-big">${esc(w.hz)}</div>${py ? `<div class="py-mid">${pinyinHtml(w.py)}</div>` : ''}<div class="speaker">🔊</div></div>
        <div class="pic-grid">${opts.map((o, i) => `<button class="opt pic-opt" data-i="${i}"><span class="emoji">${emojiOf(o.hz)}</span></button>`).join('')}</div>`;
      $('#playP').onclick = () => speak(w.hz);
      if (S.settings.autoplay) speak(w.hz);
    }
    body.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const chosen = opts[+b.dataset.i];
      const ok = chosen.hz === w.hz;
      body.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (opts[+x.dataset.i].hz === w.hz) x.classList.add('right'); });
      if (!ok) { b.classList.add('wrong'); recordConfusion(w.hz, chosen.hz); }
      speak(w.hz);
      finish(ok, `${emojiOf(w.hz)} ${w.hz} · ${w.py} · ${w.ru}`);
    });
    return;
  }

  if (t.kind === 'write') {
    const chars = [...w.hz];
    body.innerHTML = `
      <div class="task-label">Напишите ${chars.length > 1 ? 'иероглифы' : 'иероглиф'}</div>
      <div class="prompt" id="playP"><div class="ru-prompt">${esc(w.ru)}</div>${py ? `<div class="py-mid">${pinyinHtml(w.py)}</div>` : ''}<div class="speaker">🔊</div></div>
      <div class="write-box" id="wbox"></div>
      <div class="write-hint"><button class="btn btn-light" id="wShow">Показать контур</button></div>
      <p class="small" style="text-align:center">Рисуйте пальцем черту за чертой в правильном порядке. После двух ошибок появится подсказка.</p>`;
    $('#playP').onclick = () => speak(w.hz);
    if (S.settings.autoplay) speak(w.hz);
    const box = $('#wbox');
    const size = Math.max(90, Math.min(150, Math.floor((box.clientWidth || 320) / chars.length) - 14));
    let done = 0, mistakes = 0;
    const writers = chars.map(ch => {
      const d = document.createElement('div'); d.className = 'hw'; box.appendChild(d);
      const hw = HanziWriter.create(d, ch, Object.assign({ width: size, height: size, padding: 6, showOutline: false, showCharacter: false, strokeColor: '#16181d', drawingColor: '#c8102e', drawingWidth: 9, showHintAfterMisses: 2, highlightOnComplete: true, onLoadCharDataError: () => { d.innerHTML = '<span class="muted">?</span>'; } }, HW_OPTS));
      hw.quiz({
        onMistake: () => { mistakes++; },
        onComplete: () => { d.classList.add('done'); done++; if (done === chars.length) finish(mistakes <= chars.length * 3, `${w.hz} · ${w.py}${mistakes ? ` · ошибок в чертах: ${mistakes}` : ' · без ошибок'}`); }
      });
      return hw;
    });
    $('#wShow').onclick = () => { mistakes += 2; writers.forEach(hw => hw.showOutline()); };
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
    if (s.mode !== 'lesson' && s.mode !== 'tones' && BY_HZ[w.hz] && (s.mode !== 'pics' || isLearned(w.hz)) && !graded[w.hz]) { grade(w.hz, ok); graded[w.hz] = true; save(); }
    if (!ok) s.requeue.push({ kind: t.kind, word: w });
    const foot = $('#sessionFoot');
    foot.innerHTML = `<div class="feedback ${ok ? 'ok' : 'bad'}"><b>${ok ? 'Верно' : 'Не совсем'}</b><span>${esc(answerText)}</span></div><button class="btn block ${ok ? 'btn-ok' : 'btn-bad'}" id="next">Дальше</button>`;
    $('#next').onclick = () => { s.i++; renderTask(); };
    if (ok && S.settings.autoplay) setTimeout(() => { if (session === s && s.items[s.i] === t) { s.i++; renderTask(); } }, 900);
  }
}

/* ---------- 6. Экраны ---------- */
let route = { tab: 'home', lesson: null, page: null, dialog: null, q: '' };

function render() {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === route.tab));
  $('#btnBack').hidden = !(route.lesson || route.page || route.dialog);
  ({ home: renderHome, lessons: renderLessons, read: renderReading, dict: renderDict, more: renderMore })[route.tab]();
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
  const nd = DIALOGS.find(d => !S.dialogsDone[d.id] && S.lessonsDone[d.after]);
  if (nd) html += `<button class="action" id="goRead"><b>Прочитать диалог «${esc(nd.title)}»</b><span>Слова уже знакомы, ${nd.lines.length} реплик</span></button>`;
  html += `<button class="action" id="goPics"><b>Картинки</b><span>Подобрать иероглиф к картинке и картинку к иероглифу</span></button>`;
  if (learned && recognizerAvailable()) html += `<button class="action" id="goSpeak"><b>Произношение</b><span>Скажите выученные слова вслух, приложение проверит слоги и тоны</span></button>`;
  if (learned) html += `<button class="action" id="goWrite"><b>Прописи</b><span>Написать пальцем ${Math.min(8, ALL_WORDS.filter(w => isLearned(w.hz) && canWrite(w)).length)} выученных слов</span></button>`;
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
  const grd = $('#goRead'); if (grd) grd.onclick = () => { route.tab = 'read'; route.dialog = nd.id; render(); };
  const gp = $('#goPics'); if (gp) gp.onclick = () => { route.tab = 'lessons'; route.page = 'pics'; render(); };
  const gs = $('#goSpeak'); if (gs) gs.onclick = () => startSession(buildReviewSession(ALL_WORDS.filter(w => isLearned(w.hz)), 'speak'));
  const gw = $('#goWrite'); if (gw) gw.onclick = () => startSession(buildReviewSession(ALL_WORDS.filter(w => isLearned(w.hz) && canWrite(w)), 'write'));
}

function renderLessons() {
  if (route.page === 'tones') return renderTones();
  if (route.page === 'radicals') return renderRadicals();
  if (route.page === 'pics') return renderPics();
  if (route.page === 'tonepairs') return renderTonePairs();
  if (route.lesson) return renderLesson(LESSONS.find(l => l.id === route.lesson));
  setTop('Уроки');
  view.innerHTML = `
    <button class="row" id="rowTones"><span class="ic">🎵</span><span><div class="t">Тоны</div><div class="s">Четыре тона и нейтральный, с примерами</div></span><span class="chev">›</span></button>
    <button class="row" id="rowRad"><span class="ic">部</span><span><div class="t">Ключи иероглифов</div><div class="s">20 строительных блоков</div></span><span class="chev">›</span></button>
    <button class="row" id="rowTonePairs"><span class="ic">🎯</span><span><div class="t">Тоновые пары</div><div class="s">Тренажёр слуха: один слог четырьмя тонами</div></span><span class="chev">›</span></button>
    <button class="row" id="rowPics"><span class="ic">🍎</span><span><div class="t">Картинки</div><div class="s">${PICS.reduce((a, c) => a + c.items.length, 0)} слов с картинкой: смотреть и проверять</div></span><span class="chev">›</span></button>
    ${[1, 2, 3, 4].map(level => {
      const ls = LESSONS.filter(l => (l.level || 1) === level);
      const total = ls.reduce((a, l) => a + l.words.length, 0);
      return `<h2 class="sec">Уровень ${level} · HSK ${level} · ${total} слов</h2>
      <div class="list">${ls.map(l => {
        const n = l.words.filter(w => isLearned(w[0])).length;
        const done = S.lessonsDone[l.id];
        return `<button class="row ${done ? 'done' : ''}" data-l="${l.id}"><span class="num ${level > 1 ? 'lv' + level : ''}">${l.id}</span><span><div class="t">${esc(l.title)}</div><div class="s">${done ? 'Пройден · ' : ''}${n} из ${l.words.length} слов в повторении</div></span><span class="chev">${done ? '✓' : '›'}</span></button>`;
      }).join('')}</div>`;
    }).join('')}`;
  $('#rowTones').onclick = () => { route.page = 'tones'; render(); };
  $('#rowRad').onclick = () => { route.page = 'radicals'; render(); };
  $('#rowPics').onclick = () => { route.page = 'pics'; render(); };
  $('#rowTonePairs').onclick = () => { route.page = 'tonepairs'; render(); };
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
    ${typeof CULTURE !== 'undefined' && CULTURE[w.hz] ? `<div class="culture"><span class="culture-k">🏮 Из жизни</span>${esc(CULTURE[w.hz])}</div>` : ''}
    <div class="kv"><span>Урок</span><b>${w.lesson}</b></div>
    <div class="kv"><span>Статус</span><b>${c ? `в повторении, интервал ${c.ivl} ${plural(c.ivl, 'день', 'дня', 'дней')}` : 'ещё не учили'}</b></div>
    <h2 class="sec">Разбор</h2>
    <div id="decomp">${decompHtml(w.hz)}</div>
    <div class="writer" id="writer"></div>
    <div class="writer-btns"><button class="btn btn-light" id="wAnim">Порядок черт</button><button class="btn btn-light" id="wQuiz">Прописать</button></div>
    <p class="small">Прописи работают без сети: порядок черт встроен в приложение.</p>`;
  sheet.hidden = false; $('#backdrop').hidden = false;
  $('#shPlay').onclick = () => speak(w.hz);
  $('#shEx').onclick = () => speak(w.ex);
  bindDecomp($('#decomp'));
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
      <p class="small">Распознавание речи для упражнения «Произнесите вслух»: ${SPEECH_OK === null ? 'проверяется…' : SPEECH_OK ? 'доступно' : 'недоступно на этом устройстве. Android: Настройки → Язык и ввод → Голосовой ввод, добавить китайский. Если распознавателя нет вовсе, упражнение не показывается.'}</p>
      <p class="small">${zhVoice ? `Голос: ${esc(zhVoice.name)}` : 'Китайский голос в системе не найден. Android: Настройки → Язык и ввод → Синтез речи → установить китайский. iPhone: Настройки → Универсальный доступ → Устный контент → Голоса → Китайский.'}</p>
    </div>
    <div class="card"><h2>Прогресс</h2>
      <button class="btn btn-light block" id="export">Скопировать прогресс</button>
      <button class="btn btn-light block" id="import">Вставить прогресс</button>
      <button class="btn btn-light block" id="reset">Сбросить всё</button>
      <p class="small">Прогресс лежит только в этом телефоне. «Скопировать» кладёт его в буфер обмена, чтобы перенести на другое устройство.</p>
    </div>
    <div class="card"><h2>О приложении</h2>
      <p class="muted">Курс: ${ALL_WORDS.length} ${plural(ALL_WORDS.length, 'слово', 'слова', 'слов')} уровней HSK 1, 2 и 3 в ${LESSONS.length} ${plural(LESSONS.length, 'уроке', 'уроках', 'уроках')} с грамматикой, тоны, ключи иероглифов, интервальное повторение, ${DIALOGS.length} диалогов для чтения, прописи с проверкой черт. Бесплатно и без рекламы.</p>
      <p class="small">Словарь сверен ${CONTENT_VERIFIED}. Исходники открыты: github.com/mazurovmikhail-ui/nihao</p>
      <p class="small">Версия 0.4.1 · <a href="privacy.html" target="_blank">Политика конфиденциальности</a></p>
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

/* ---------- 7. Прописи и чтение ---------- */
/* Библиотека hanzi-writer и данные о чертах лежат в самом приложении, сеть нужна только
   для иероглифов вне курса. */
const HW_OPTS = {
  charDataLoader: (ch, onLoad, onErr) => {
    if (typeof STROKES !== 'undefined' && STROKES[ch]) return onLoad(STROKES[ch]);
    fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(ch)}.json`).then(r => r.json()).then(onLoad).catch(onErr);
  }
};
async function writer(hz, mode) {
  const box = $('#writer');
  if (typeof HanziWriter === 'undefined') { box.innerHTML = '<p class="muted">Библиотека прописей не загрузилась.</p>'; return; }
  box.innerHTML = '';
  const chars = [...hz].filter(c => /[一-鿿]/.test(c));
  const size = Math.max(80, Math.min(140, Math.floor((box.clientWidth - 8) / chars.length) - 8));
  const writers = chars.map(ch => {
    const d = document.createElement('div'); d.className = 'hw'; box.appendChild(d);
    return HanziWriter.create(d, ch, Object.assign({ width: size, height: size, padding: 4, showOutline: true, strokeColor: '#16181d', radicalColor: '#c8102e', drawingColor: '#c8102e', drawingWidth: 8, strokeAnimationSpeed: 1, delayBetweenStrokes: 200, showHintAfterMisses: 2, highlightOnComplete: true, onLoadCharDataError: () => { d.innerHTML = '<span class="muted">?</span>'; } }, HW_OPTS));
  });
  if (mode === 'animate') { for (const w of writers) await new Promise(r => w.animateCharacter({ onComplete: r })); }
  else writers.forEach(w => { w.hideCharacter(); w.quiz(); });
}

function buildPicSession(cat) {
  const items = shuffle(cat.items.map(it => BY_HZ[it[0]]).filter(Boolean)).slice(0, 12).map((w, i) => ({ kind: i % 2 ? 'hz2pic' : 'pic2hz', word: w }));
  return { mode: 'pics', items, i: 0, correct: 0, wrong: 0, requeue: [], xp: 0, graded: {} };
}
let picCat = 0;
function renderPics() {
  setTop('Картинки');
  const cat = PICS[picCat] || PICS[0];
  view.innerHTML = `
    <p class="muted" style="margin-bottom:10px">Смотрите и запоминайте: картинка, иероглиф, звучание. Нажмите карточку, чтобы услышать слово. Потом проверьте себя: приложение покажет картинку и спросит иероглиф, и наоборот.</p>
    <div class="chips">${PICS.map((c, i) => `<button class="chip ${i === picCat ? 'active' : ''}" data-i="${i}">${esc(c.cat)}</button>`).join('')}</div>
    <div class="pic-cards">${cat.items.map(it => { const w = BY_HZ[it[0]]; if (!w) return ''; return `<button class="pic-card ${isLearned(w.hz) ? 'known' : ''}" data-hz="${esc(w.hz)}"><span class="emoji">${it[1]}</span><span class="hz">${esc(w.hz)}</span><span class="py">${pinyinHtml(w.py)}</span><span class="ru">${esc(w.ru)}</span></button>`; }).join('')}</div>
    <div class="spacer"></div>`;
  view.querySelectorAll('.chip').forEach(b => b.onclick = () => { picCat = +b.dataset.i; renderPics(); });
  view.querySelectorAll('.pic-card').forEach(b => b.onclick = () => speak(b.dataset.hz));
  $('#fab').hidden = false;
  $('#fab').textContent = `Проверить: ${cat.cat}`;
  $('#fab').onclick = () => { $('#fab').hidden = true; startSession(buildPicSession(cat)); };
}

function dialogTokens(d) { return d.lines.flatMap(l => l[1].split(' ')).filter(t => /[一-鿿]/.test(t)); }
function gloss(d, tk) {
  const ex = Object.assign({}, d.extra || {}, d.extra2 || {});
  if (BY_HZ[tk]) return [BY_HZ[tk].py, BY_HZ[tk].ru, isLearned(tk)];
  if (ex[tk]) return [ex[tk][0], ex[tk][1], false];
  if (typeof EXTRA_GLOSS !== 'undefined' && EXTRA_GLOSS[tk]) return [EXTRA_GLOSS[tk][0], EXTRA_GLOSS[tk][1], true];
  return null;
}
function unknownCount(d) {
  const seen = new Set(); let n = 0;
  dialogTokens(d).forEach(tk => { if (seen.has(tk)) return; seen.add(tk); const g = gloss(d, tk); if (!g || !g[2]) n++; });
  return n;
}
function renderReading() {
  if (route.dialog) return renderDialog(DIALOGS.find(d => d.id === route.dialog));
  setTop('Чтение');
  view.innerHTML = `<p class="muted" style="margin-bottom:12px">Диалоги на словах курса. Нажмите реплику, чтобы услышать её, и слово, чтобы увидеть перевод. Красным подчёркнуты слова, которых ещё не было в ваших уроках.</p>
    <div class="list">${DIALOGS.map(d => { const unk = unknownCount(d); const done = S.dialogsDone[d.id]; return `<button class="row ${done ? 'done' : ''}" data-d="${d.id}"><span class="ic">${d.story ? '📖' : '💬'}</span><span><div class="t">${esc(d.title)}</div><div class="s">${d.story ? 'Рассказ, ' + d.lines.length + ' фраз' : d.lines.length + ' реплик'} · после урока ${d.after}${unk ? ` · ${unk} ${plural(unk, 'новое слово', 'новых слова', 'новых слов')}` : ''}${done ? ' · прочитано' : ''}</div></span><span class="chev">${done ? '✓' : '›'}</span></button>`; }).join('')}</div>`;
  view.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { route.dialog = b.dataset.d; render(); });
}
const readOpts = { py: true, ru: false };
function renderDialog(d) {
  setTop(d.title);
  const linesHtml = d.lines.map((l, i) => `<div class="bubble ${l[0] === 'B' ? 'b' : l[0] === 'N' ? 'n' : ''}" data-i="${i}"><div class="who">${l[0] === 'A' ? 'А' : l[0] === 'B' ? 'Б' : ''}</div><div class="hz">${l[1].split(' ').map(tk => { const g = gloss(d, tk); if (!g) return esc(tk); return `<span class="tk ${g[2] ? '' : 'unk'}" data-tk="${esc(tk)}">${esc(tk)}</span>`; }).join('')}</div><div class="py" ${readOpts.py ? '' : 'hidden'}>${pinyinHtml(l[2])}</div><div class="ru" ${readOpts.ru ? '' : 'hidden'}>${esc(l[3])}</div></div>`).join('');
  view.innerHTML = `
    <div class="dlg-tools"><button class="chip ${readOpts.py ? 'active' : ''}" id="tPy">Пиньинь</button><button class="chip ${readOpts.ru ? 'active' : ''}" id="tRu">Перевод</button><button class="chip" id="tAll">▶ Прослушать всё</button></div>
    <div class="dlg">${linesHtml}</div>
    <div class="quiz" id="quiz"><h3>Проверьте себя</h3>${d.quiz.map((q, qi) => `<div class="q" data-q="${qi}"><p><b>${esc(q.q)}</b></p>${q.opts.map((o, oi) => `<button class="opt" data-o="${oi}">${esc(o)}</button>`).join('')}</div>`).join('')}<div id="quizResult"></div></div>`;
  $('#tPy').onclick = () => { readOpts.py = !readOpts.py; renderDialog(d); };
  $('#tRu').onclick = () => { readOpts.ru = !readOpts.ru; renderDialog(d); };
  $('#tAll').onclick = () => speakLines(d.lines.map(l => l[1]));
  view.querySelectorAll('.bubble').forEach(b => b.onclick = e => {
    if (e.target.classList.contains('tk')) { const g = gloss(d, e.target.dataset.tk); if (g) toast(`${e.target.dataset.tk} · ${g[0]} · ${g[1]}`); return; }
    speak(d.lines[+b.dataset.i][1]);
  });
  const answers = {};
  view.querySelectorAll('.q').forEach(qEl => qEl.querySelectorAll('.opt').forEach(o => o.onclick = () => {
    const qi = +qEl.dataset.q, oi = +o.dataset.o, q = d.quiz[qi];
    if (answers[qi] !== undefined) return;
    answers[qi] = oi === q.a;
    qEl.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (+x.dataset.o === q.a) x.classList.add('right'); });
    if (oi !== q.a) o.classList.add('wrong');
    if (Object.keys(answers).length === d.quiz.length) {
      const right = Object.values(answers).filter(Boolean).length;
      const first = !S.dialogsDone[d.id];
      if (first && right >= Math.ceil(d.quiz.length / 2)) { S.dialogsDone[d.id] = true; addXp(10); touchStreak(); save(); }
      $('#quizResult').innerHTML = `<p class="muted" style="margin-top:8px">${right} из ${d.quiz.length} верно.${first && S.dialogsDone[d.id] ? ' Диалог засчитан, +10 очков.' : ''}</p>`;
    }
  }));
}
function speakLines(texts, rate) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  texts.forEach(t => { const u = new SpeechSynthesisUtterance(t.replace(/\s+/g, '')); u.lang = 'zh-CN'; if (zhVoice) u.voice = zhVoice; u.rate = rate || S.settings.rate; speechSynthesis.speak(u); });
}

/* ---------- 9. Произношение, тоновые пары, разбор иероглифа, путаница ---------- */

/* Слог для каждого иероглифа: из слов курса (когда число слогов равно числу знаков),
   иначе из словаря разложения. Нужен, чтобы сравнить услышанное с целью по слогам. */
const CHAR_PY = (() => {
  const m = {};
  ALL_WORDS.forEach(w => {
    const chars = [...w.hz].filter(c => /[一-鿿]/.test(c));
    const syl = syllables(w.py);
    if (chars.length === syl.length) chars.forEach((c, i) => { if (!m[c]) m[c] = syl[i]; });
  });
  if (typeof DECOMP !== 'undefined') Object.keys(DECOMP).forEach(c => { if (!m[c] && DECOMP[c].p && DECOMP[c].p[0]) m[c] = DECOMP[c].p[0]; });
  return m;
})();

/* В нативной сборке плагин регистрируется вручную: сборщика модулей нет, поэтому
   Capacitor.Plugins его сам не подхватывает. Доступность проверяется один раз при запуске. */
let SPEECH_NATIVE = null, SPEECH_OK = null;
function nativeSpeech() {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
  if (SPEECH_NATIVE) return SPEECH_NATIVE;
  if (C.Plugins && C.Plugins.SpeechRecognition) return (SPEECH_NATIVE = C.Plugins.SpeechRecognition);
  try { SPEECH_NATIVE = C.registerPlugin('SpeechRecognition'); } catch (e) { SPEECH_NATIVE = null; }
  return SPEECH_NATIVE;
}
async function probeSpeech() {
  const P = nativeSpeech();
  if (P) { try { const a = await P.available(); SPEECH_OK = !!(a && a.available); } catch (e) { SPEECH_OK = false; } }
  else SPEECH_OK = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
function recognizerAvailable() {
  if (SPEECH_OK !== null) return SPEECH_OK;
  return !!(nativeSpeech() || window.SpeechRecognition || window.webkitSpeechRecognition);
}
async function recognize() {
  const P = nativeSpeech();
  if (P) {
    const a = await P.available();
    if (!a.available) throw new Error('unavailable');
    await P.requestPermissions();
    const r = await P.start({ language: 'zh-CN', maxResults: 3, partialResults: false, popup: false });
    return r.matches || [];
  }
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  return new Promise((res, rej) => {
    const r = new R();
    r.lang = 'zh-CN'; r.maxAlternatives = 3; r.interimResults = false;
    let done = false;
    r.onresult = e => { done = true; res([...e.results[0]].map(x => x.transcript)); };
    r.onerror = e => { if (!done) { done = true; rej(e); } };
    r.onend = () => { if (!done) { done = true; res([]); } };
    r.start();
  });
}
function evaluateSpeech(w, alts) {
  const target = syllables(w.py).map(s => ({ base: plainPinyin(s), tone: toneOf(s), s }));
  let best = null;
  for (const a of alts) {
    const chars = [...a].filter(c => /[一-鿿]/.test(c));
    if (chars.join('') === w.hz) { best = { score: 1e9, marks: target.map(() => 'ok'), heard: a, chars }; break; }
    const syl = chars.map(c => CHAR_PY[c] || null);
    let score = 0;
    const marks = target.map((t, i) => {
      const h = syl[i]; if (!h) return 'bad';
      const hb = plainPinyin(h), ht = toneOf(h);
      if (hb === t.base && ht === t.tone) { score += 2; return 'ok'; }
      if (hb === t.base) { score += 1; return 'tone'; }
      return 'bad';
    });
    if (!best || score > best.score) best = { score, marks, heard: a, chars };
  }
  if (!best) return { ok: false, html: '<span class="muted">Ничего не услышал. Попробуйте ещё раз ближе к микрофону.</span>' };
  const ok = best.marks.every(m => m === 'ok') && best.chars.length === target.length;
  const html = `<div class="heard-syl">${target.map((t, i) => `<span class="hs ${best.marks[i]}">${esc(t.s)}</span>`).join(' ')}</div>
    <div class="small">Услышано: ${esc(best.heard)}</div>
    <div class="small">${ok ? 'Отлично, все слоги и тоны на месте.' : best.marks.includes('tone') ? 'Звуки верные, оранжевый слог: не тот тон.' : 'Красный слог не распознан. Произнесите чётче и медленнее.'}</div>`;
  return { ok, html };
}

function recordConfusion(a, b) {
  if (!a || !b || a === b) return;
  S.confusions = S.confusions || {};
  const k1 = a + '|' + b, k2 = b + '|' + a;
  S.confusions[k1] = (S.confusions[k1] || 0) + 1;
  S.confusions[k2] = (S.confusions[k2] || 0) + 1;
  save();
}
function confusionWith(hz, other) { return (S.confusions && S.confusions[hz + '|' + other]) || 0; }

/* Тоновые пары */
function buildToneSession() {
  const items = [];
  for (let i = 0; i < 16; i++) {
    const set = TONE_SETS[Math.floor(Math.random() * TONE_SETS.length)];
    if (i % 2 === 0) {
      const t = 1 + Math.floor(Math.random() * 4);
      items.push({ kind: 'tone1', word: { hz: set.chars[t - 1], tone: t, syl: set.syl } });
    } else {
      const ta = 1 + Math.floor(Math.random() * 4); let tb = 1 + Math.floor(Math.random() * 4); if (tb === ta) tb = (ta % 4) + 1;
      items.push({ kind: 'tonepair', word: { hz: set.chars[ta - 1] + set.chars[tb - 1], a: set.chars[ta - 1], b: set.chars[tb - 1], ta, tb, syl: set.syl } });
    }
  }
  return { mode: 'tones', items, i: 0, correct: 0, wrong: 0, requeue: [], xp: 0, graded: {} };
}
function renderTonePairs() {
  setTop('Тоновые пары');
  view.innerHTML = `
    <h1 class="h1">Тоновые пары</h1>
    <p class="muted">Русское ухо плохо различает второй и третий тон, а первый путает с четвёртым. Тренажёр играет один слог разными тонами: сначала по одному, потом парами, как в живой речи. Нужен китайский голос в системе.</p>
    <div class="card"><h2>Слоги в тренажёре</h2><div class="tone-sets">${TONE_SETS.map(s => `<button class="chip" data-s="${esc(s.syl)}">${esc(s.syl)}</button>`).join('')}</div><p class="small">Нажмите слог, чтобы услышать все четыре тона подряд.</p></div>
    <div class="card"><h2>Подсказка</h2>
      ${[1, 2, 3, 4].map(n => `<div class="kv"><span class="t${n}"><b>${TONE_MARK_CHAR[n]}</b> ${esc(TONE_NAME[n])}</span><span class="small">${['', 'как гудок', 'как вопрос «а?»', 'как задумчивое «ну-у»', 'как приказ «нет!»'][n]}</span></div>`).join('')}
    </div>
    <div class="spacer"></div>`;
  view.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const set = TONE_SETS.find(s => s.syl === b.dataset.s); speakLines(set.chars, 0.7); });
  $('#fab').hidden = false;
  $('#fab').textContent = 'Тренировать: 16 заданий';
  $('#fab').onclick = () => { $('#fab').hidden = true; startSession(buildToneSession()); };
}

/* Разбор иероглифа */
function decompHtml(hz) {
  if (typeof DECOMP === 'undefined') return '';
  const chars = [...hz].filter(c => /[一-鿿]/.test(c));
  return chars.map(c => {
    const d = DECOMP[c]; if (!d) return '';
    const rad = d.r;
    const comps = d.d.filter(x => x !== rad && /[一-鿿⺀-⻳]/.test(x));
    const others = ALL_WORDS.filter(x => x.hz !== hz && x.hz.includes(c)).slice(0, 6);
    const name = x => RADICAL_RU[x] ? esc(RADICAL_RU[x]) : (DECOMP[x] && DECOMP[x].p && DECOMP[x].p[0] ? esc(DECOMP[x].p[0]) : '');
    return `<div class="dc">
      <div class="dc-head"><span class="dc-char">${esc(c)}</span><span class="dc-py">${esc((d.p && d.p[0]) || '')}</span></div>
      ${rad ? `<div class="dc-row"><span class="dc-k">Ключ</span><span class="dc-comp" data-c="${esc(rad)}">${esc(rad)}</span><span class="dc-name">${name(rad)}</span></div>` : ''}
      ${comps.length ? `<div class="dc-row"><span class="dc-k">Части</span>${comps.map(x => `<span class="dc-comp" data-c="${esc(x)}">${esc(x)}</span><span class="dc-name">${name(x)}</span>`).join('')}</div>` : ''}
      ${others.length ? `<div class="dc-row"><span class="dc-k">Ещё слова</span>${others.map(o => `<span class="dc-word" data-hz="${esc(o.hz)}">${esc(o.hz)}</span>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
}
function bindDecomp(root) {
  root.querySelectorAll('.dc-comp').forEach(el => el.onclick = () => {
    const x = el.dataset.c; const d = DECOMP[x];
    toast(`${x} · ${(d && d.p && d.p[0]) || ''}${RADICAL_RU[x] ? ' · ' + RADICAL_RU[x] : ''}`);
    speak(x);
  });
  root.querySelectorAll('.dc-word').forEach(el => el.onclick = () => openWord(BY_HZ[el.dataset.hz]));
}

/* ---------- 8. Запуск ---------- */
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { route.tab = b.dataset.tab; route.lesson = null; route.page = null; route.dialog = null; $('#fab').hidden = true; render(); });
$('#btnBack').onclick = () => { route.lesson = null; route.page = null; route.dialog = null; $('#fab').hidden = true; render(); };
render();
probeSpeech().then(() => { if (route.tab === 'home' && !session) render(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !session && route.tab === 'home') render(); });
if ('serviceWorker' in navigator && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
