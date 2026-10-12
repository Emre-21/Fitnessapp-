'use strict';

/* ---------- Speicher ---------- */

const KEY = 'fitapp.v1';
const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const DAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MOODS = ['😫', '😕', '😐', '🙂', '💪'];

function defaultState() {
  return {
    version: 1,
    custom: [],
    weeks: {},
    sessions: [],
    active: null,
    bodyweights: [],
    profile: { sex: 'm', age: '', height: '', weight: '', activity: 1.55, goal: 0, rest: 90 },
  };
}

function load() {
  const d = defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = Object.assign(d, JSON.parse(raw));
      s.profile = Object.assign(defaultState().profile, s.profile);
      return s;
    }
  } catch (e) { /* leerer Start */ }
  return d;
}

let S = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Speichern fehlgeschlagen – bitte Backup machen'); }
}

/* ---------- Helfer ---------- */

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const fmt = (n, d = 0) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: d });

function dkey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function parseD(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function weekNo(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}
function dayIdx(d) { return (d.getDay() + 6) % 7; }
function shortDate(d) { return d.getDate() + '.' + (d.getMonth() + 1) + '.'; }
function longDate(d) { return DAYS[dayIdx(d)] + ', ' + d.getDate() + '. ' + MONTHS[d.getMonth()]; }
function dur(ms) {
  const m = Math.round(ms / 60000);
  return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min';
}
function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0');
}

/* ---------- Übungen ---------- */

let exCache = null;
function allEx() { return EXERCISES.concat(S.custom); }
function ex(id) {
  if (!exCache) { exCache = {}; for (const e of allEx()) exCache[e.id] = e; }
  return exCache[id] || { id, name: 'Gelöschte Übung', group: 'custom', equip: '', type: 'w' };
}
function groupName(g) { return (GROUPS.find((x) => x.id === g) || { name: 'Eigene' }).name; }
function typeLabel(t) { return { w: 'Gewicht × Wdh.', bw: 'Wiederholungen', t: 'Zeit', c: 'Dauer & Strecke' }[t]; }
function defaultTarget(t) { return { w: '8–12', bw: '10–15', t: '45 s', c: '30 min' }[t]; }

/* ---------- Sätze & Statistik ---------- */

function setText(type, s) {
  if (type === 'w') return fmt(num(s.w), 2) + ' kg × ' + fmt(num(s.r));
  if (type === 'bw') return fmt(num(s.r)) + ' Wdh.' + (num(s.w) ? ' (+' + fmt(num(s.w), 2) + ' kg)' : '');
  if (type === 't') return fmt(num(s.r)) + ' s';
  return fmt(num(s.r)) + ' min' + (num(s.km) ? ' · ' + fmt(num(s.km), 2) + ' km' : '');
}
function setsText(type, sets) {
  if (type === 'w' && sets.length > 1 && sets.every((s) => num(s.w) === num(sets[0].w))) {
    return fmt(num(sets[0].w), 2) + ' kg × ' + sets.map((s) => fmt(num(s.r))).join(', ');
  }
  return sets.map((s) => setText(type, s)).join(' · ');
}
const e1rm = (w, r) => (r > 0 ? w * (1 + Math.min(r, 30) / 30) : 0);

// Kennzahl pro Satz, mit der Fortschritt verglichen wird.
function metric(type, s) {
  if (type === 'w') return e1rm(num(s.w), num(s.r));
  if (type === 'bw') return num(s.r) + num(s.w) * 0.5;
  if (type === 't') return num(s.r);
  return num(s.km) || num(s.r);
}
function metricName(type) {
  return { w: 'Geschätztes Maximum (1RM, kg)', bw: 'Beste Wiederholungen', t: 'Längste Zeit (s)', c: 'Weiteste Strecke / Dauer' }[type];
}
function volume(entries) {
  let v = 0;
  for (const e of entries) if (ex(e.exId).type === 'w') for (const s of e.sets) v += num(s.w) * num(s.r);
  return v;
}
function setCount(entries) { return entries.reduce((a, e) => a + e.sets.length, 0); }

function historyOf(exId) {
  const out = [];
  for (const s of S.sessions) {
    const e = s.entries.find((x) => x.exId === exId);
    if (e && e.sets.length) out.push({ session: s, sets: e.sets });
  }
  return out.sort((a, b) => a.session.start - b.session.start);
}
function lastOf(exId) { const h = historyOf(exId); return h[h.length - 1] || null; }

function records(exId) {
  const type = ex(exId).type;
  const r = { best: 0, maxW: 0, maxR: 0, count: 0 };
  for (const h of historyOf(exId)) {
    r.count++;
    for (const s of h.sets) {
      r.best = Math.max(r.best, metric(type, s));
      r.maxW = Math.max(r.maxW, num(s.w));
      r.maxR = Math.max(r.maxR, num(s.r));
    }
  }
  return r;
}

/* ---------- Kalorien ---------- */

function bodyKg() { return num(S.profile.weight) || 75; }
function bmr() {
  const p = S.profile;
  if (!num(p.age) || !num(p.height) || !num(p.weight)) return 0;
  return 10 * num(p.weight) + 6.25 * num(p.height) - 5 * num(p.age) + (p.sex === 'w' ? -161 : 5);
}
function sessionKcal(s) {
  const kg = bodyKg();
  const totalMin = (s.end - s.start) / 60000;
  let cardioMin = 0, kcal = 0;
  for (const e of s.entries) {
    const x = ex(e.exId);
    if (x.type !== 'c') continue;
    for (const st of e.sets) { const m = num(st.r); cardioMin += m; kcal += (x.met || 7) * kg * m / 60; }
  }
  kcal += 5 * kg * Math.max(0, totalMin - cardioMin) / 60;
  return Math.round(kcal);
}

/* ---------- Wochenplan ---------- */

function getWeek(key) { return S.weeks[key] || null; }
function ensureWeek(key) {
  if (!S.weeks[key]) S.weeks[key] = { days: DAYS.map(() => ({ title: '', items: [] })) };
  return S.weeks[key];
}
function weekHasPlan(w) { return w && w.days.some((d) => d.items.length || d.title); }
function previousPlannedWeek(key) {
  const keys = Object.keys(S.weeks).filter((k) => k < key && weekHasPlan(S.weeks[k])).sort();
  return keys[keys.length - 1] || null;
}
function copyWeek(from, to) {
  const src = S.weeks[from];
  S.weeks[to] = { days: src.days.map((d) => ({ title: d.title, items: d.items.map((it) => ({ ...it, id: uid() })) })) };
}

/* ---------- UI-Zustand ---------- */

const ui = {
  view: 'heute',
  planMon: mondayOf(new Date()),
  exGroup: 'alle',
  exQuery: '',
  histTab: 'trainings',
  progEx: '',
  woOpen: false,
};
let sheetCtx = null;
let rest = null;

/* ---------- Rendering ---------- */

function render() {
  exCache = null;
  const v = VIEWS[ui.view]();
  $('#view').innerHTML = v;
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === ui.view));
  renderWorkout();
  renderPill();
}

function renderPill() {
  const p = $('#pill');
  if (S.active && !ui.woOpen) {
    p.hidden = false;
    p.innerHTML = '<span>▶ Training läuft</span><span class="num" id="pillclock">' + clock(Date.now() - S.active.start) + '</span>';
    p.dataset.a = 'openWorkout';
  } else p.hidden = true;
}

const VIEWS = {};

VIEWS.heute = () => {
  const now = new Date();
  const mon = mondayOf(now);
  const wk = getWeek(dkey(mon));
  const di = dayIdx(now);
  const day = wk ? wk.days[di] : null;
  const items = day ? day.items : [];
  const todayKey = dkey(now);

  let strip = '<div class="week">';
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), k = dkey(d);
    const done = S.sessions.some((s) => s.date === k);
    const planned = wk && wk.days[i].items.length;
    strip += `<div class="wd ${k === todayKey ? 'today' : ''} ${done ? 'done' : planned ? 'planned' : ''}">${DAYS_SHORT[i]}<b>${d.getDate()}</b><div class="m"></div></div>`;
  }
  strip += '</div>';

  let main;
  if (S.active) {
    main = `<div class="card hero"><div class="sub">Läuft seit ${clock(Date.now() - S.active.start)}</div>
      <h2 style="margin:4px 0 14px">${esc(S.active.title || 'Training')}</h2>
      <button class="btn primary block" data-a="openWorkout">Training fortsetzen</button></div>`;
  } else if (items.length) {
    const doneToday = S.sessions.some((s) => s.date === todayKey);
    main = `<div class="card hero"><div class="sub">${doneToday ? 'Heute erledigt ✓' : 'Heute geplant'}</div>
      <h2 style="margin:4px 0 10px">${esc(day.title || 'Training')}</h2>
      <div class="stack small" style="margin-bottom:16px">${items.map((it) =>
        `<div class="row"><span class="dot ${ex(it.exId).group}"></span><span class="grow">${esc(ex(it.exId).name)}</span><span class="num">${it.sets} × ${esc(it.target)}</span></div>`).join('')}</div>
      <button class="btn ${doneToday ? '' : 'primary'} block" data-a="startPlan" data-k="${dkey(mon)}" data-d="${di}">${doneToday ? 'Noch einmal starten' : 'Training starten'}</button></div>`;
  } else {
    main = `<div class="card"><h3>${wk && weekHasPlan(wk) ? 'Heute ist Ruhetag' : 'Noch nichts geplant'}</h3>
      <p class="sub" style="margin:4px 0 14px">${wk && weekHasPlan(wk) ? 'Erhol dich gut – oder trainier spontan.' : 'Leg im Plan fest, was du diese Woche trainierst.'}</p>
      <div class="row"><button class="btn primary grow" data-a="go" data-v="plan">Woche planen</button><button class="btn grow" data-a="startFree">Freies Training</button></div></div>`;
  }

  const weekSessions = S.sessions.filter((s) => s.date >= dkey(mon));
  const wVol = weekSessions.reduce((a, s) => a + volume(s.entries), 0);
  const wSets = weekSessions.reduce((a, s) => a + setCount(s.entries), 0);

  const last = S.sessions[S.sessions.length - 1];
  const lastCard = last ? `<h2>Letztes Training</h2>
    <button class="card item" style="display:flex" data-a="sessionDetail" data-id="${last.id}">
      <div class="grow"><div class="name">${esc(last.title || 'Training')}</div>
      <div class="meta">${longDate(parseD(last.date))} · ${dur(last.end - last.start)} · ${setCount(last.entries)} Sätze</div></div>
      <span style="font-size:22px">${last.rating ? MOODS[last.rating - 1] : ''}</span></button>` : '';

  const b = bmr();
  const todayKcal = S.sessions.filter((s) => s.date === todayKey).reduce((a, s) => a + (s.kcal || 0), 0);
  const kcalCard = b ? `<h2>Kalorien heute</h2><div class="card">
      <div class="kv"><span>Dein Tagesbedarf</span><b>${fmt(Math.round(b * num(S.profile.activity) + num(S.profile.goal)))} kcal</b></div>
      <div class="kv"><span>Davon durch Training verbrannt (heute)</span><b>${fmt(todayKcal)} kcal</b></div>
      <p class="sub small" style="margin:8px 0 0">Schätzung aus deinen Profildaten.</p></div>` :
    `<h2>Kalorien</h2><div class="card"><p class="sub" style="margin:0 0 12px">Trag Alter, Größe und Gewicht ein, dann rechnet die App deinen Tagesbedarf und den Verbrauch deiner Trainings aus.</p><button class="btn sm" data-a="go" data-v="profil">Profil ausfüllen</button></div>`;

  return `<p class="sub" style="margin:18px 0 0">${longDate(now)}</p><h1>${greeting()}</h1>
    <div style="margin:16px 0">${strip}</div>
    ${main}
    <h2>Diese Woche</h2>
    <div class="stats"><div class="stat"><b class="num">${weekSessions.length}</b><span>Trainings</span></div>
      <div class="stat"><b class="num">${fmt(wSets)}</b><span>Sätze</span></div>
      <div class="stat"><b class="num">${wVol >= 10000 ? fmt(wVol / 1000, 1) + ' t' : fmt(wVol)}</b><span>${wVol >= 10000 ? 'bewegt' : 'kg bewegt'}</span></div></div>
    ${lastCard}${kcalCard}`;
};

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Guten Morgen' : h < 18 ? 'Bereit fürs Training?' : 'Guten Abend';
}

VIEWS.plan = () => {
  const mon = ui.planMon, key = dkey(mon);
  const wk = getWeek(key);
  const isCurrent = key === dkey(mondayOf(new Date()));
  const todayKey = dkey(new Date());
  const prev = previousPlannedWeek(key);

  let banner = '';
  if (!weekHasPlan(wk)) {
    banner = `<div class="card" style="margin-bottom:12px"><h3>Noch kein Plan für diese Woche</h3>
      <p class="sub" style="margin:4px 0 12px">Füg pro Tag Übungen aus deiner Sammlung hinzu${prev ? ' oder übernimm deinen letzten Plan' : ''}.</p>
      ${prev ? `<button class="btn primary sm" data-a="copyPrev" data-from="${prev}">Plan von KW ${weekNo(parseD(prev))} übernehmen</button>` : ''}</div>`;
  }

  let days = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    const day = wk ? wk.days[i] : { title: '', items: [] };
    days += `<div class="day ${dkey(d) === todayKey ? 'today' : ''}">
      <div class="day-head"><b>${DAYS[i]}</b><span class="sub">${shortDate(d)}</span></div>
      <input class="day-title" data-f="dayTitle" data-d="${i}" value="${esc(day.title)}" placeholder="${day.items.length ? 'Name, z. B. Push-Tag' : 'Ruhetag – tippen zum Benennen'}">
      ${day.items.map((it, j) => {
        const x = ex(it.exId);
        return `<div class="pitem"><span class="dot ${x.group}"></span><span class="name">${esc(x.name)}</span>
          <input data-f="pSets" data-d="${i}" data-i="${j}" value="${it.sets}" inputmode="numeric" aria-label="Sätze"><span class="x">×</span>
          <input class="t" data-f="pTarget" data-d="${i}" data-i="${j}" value="${esc(it.target)}" aria-label="Ziel">
          <button class="icon-btn" data-a="pMenu" data-d="${i}" data-i="${j}" aria-label="Optionen">⋯</button></div>`;
      }).join('')}
      <div class="row" style="margin-top:8px">
        <button class="btn sm" data-a="pickForDay" data-d="${i}">+ Übungen</button>
        ${day.items.length ? `<span class="grow"></span><button class="btn sm primary" data-a="startPlan" data-k="${key}" data-d="${i}">▶ Starten</button>` : ''}
      </div></div>`;
  }

  return `<h1>Plan</h1>
    <div class="weeknav">
      <button class="icon-btn" data-a="weekNav" data-n="-1" aria-label="Vorige Woche" style="font-size:22px">‹</button>
      <div class="mid"><b>KW ${weekNo(mon)}</b><span class="sub">${shortDate(mon)} – ${shortDate(addDays(mon, 6))}${isCurrent ? ' · diese Woche' : ''}</span></div>
      <button class="icon-btn" data-a="weekNav" data-n="1" aria-label="Nächste Woche" style="font-size:22px">›</button>
    </div>
    ${!isCurrent ? '<p style="text-align:center;margin:-4px 0 12px"><button class="link" data-a="weekNav" data-n="0">Zur aktuellen Woche</button></p>' : ''}
    ${banner}${days}
    ${weekHasPlan(wk) ? `<div class="row" style="margin-top:16px"><button class="btn grow" data-a="copyNext">In nächste Woche kopieren</button><button class="btn danger" data-a="clearWeek">Leeren</button></div>` : ''}`;
};

function exListHTML(list, selected) {
  if (!list.length) return '<div class="empty">Keine Übung gefunden.</div>';
  let html = '';
  for (const g of GROUPS.concat([{ id: 'custom', name: 'Eigene' }])) {
    const items = list.filter((e) => e.group === g.id);
    if (!items.length) continue;
    html += `<h2 style="margin:18px 0 8px;font-size:15px" class="row"><span class="dot ${g.id}"></span>${g.name}<span class="sub" style="font-weight:400">${items.length}</span></h2><div class="list">`;
    for (const e of items) {
      const sel = selected && selected.has(e.id);
      html += `<button class="item ${sel ? 'sel' : ''}" data-a="${selected ? 'pickToggle' : 'exDetail'}" data-id="${e.id}">
        ${selected ? '<span class="check">✓</span>' : ''}
        <div class="grow"><div class="name">${esc(e.name)}</div><div class="meta">${esc(e.equip)}${e.custom ? ' · eigene' : ''}</div></div></button>`;
    }
    html += '</div>';
  }
  return html;
}
function filterEx(group, q) {
  q = q.trim().toLowerCase();
  return allEx().filter((e) => (group === 'alle' || e.group === group) && (!q || e.name.toLowerCase().includes(q) || e.equip.toLowerCase().includes(q)));
}
function chipsHTML(active, action) {
  return '<div class="chips">' + [{ id: 'alle', name: 'Alle' }].concat(GROUPS).map((g) =>
    `<button class="chip ${active === g.id ? 'on' : ''}" data-a="${action}" data-g="${g.id}">${g.name}</button>`).join('') + '</div>';
}
const SEARCH_ICON = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>';

VIEWS.uebungen = () => `<div class="row spread"><h1>Übungen</h1><button class="btn sm primary" data-a="newEx" style="margin-top:14px">+ Eigene</button></div>
  <p class="sub" style="margin:0 0 12px">${allEx().length} Übungen in deiner Sammlung</p>
  <div class="search"><input class="input" id="exq" data-f="exQuery" placeholder="Übung suchen …" value="${esc(ui.exQuery)}" autocomplete="off">${SEARCH_ICON}</div>
  <div style="margin-top:10px">${chipsHTML(ui.exGroup, 'exGroup')}</div>
  <div id="exlist">${exListHTML(filterEx(ui.exGroup, ui.exQuery))}</div>`;

VIEWS.verlauf = () => {
  const tabs = `<div class="seg"><button class="${ui.histTab === 'trainings' ? 'on' : ''}" data-a="histTab" data-t="trainings">Trainings</button><button class="${ui.histTab === 'fortschritt' ? 'on' : ''}" data-a="histTab" data-t="fortschritt">Fortschritt</button></div>`;
  if (!S.sessions.length) {
    return `<h1>Fortschritt</h1>${tabs}<div class="empty">Noch keine Trainings gespeichert.<br>Nach deinem ersten Training siehst du hier deine Entwicklung.</div>`;
  }
  if (ui.histTab === 'trainings') {
    const list = S.sessions.slice().reverse().map((s) => `<button class="item" data-a="sessionDetail" data-id="${s.id}">
      <div class="grow"><div class="name">${esc(s.title || 'Training')}</div>
      <div class="meta">${longDate(parseD(s.date))} · ${dur(s.end - s.start)} · ${s.entries.length} Übungen · ${setCount(s.entries)} Sätze</div></div>
      <span style="font-size:20px">${s.rating ? MOODS[s.rating - 1] : ''}</span></button>`).join('');
    return `<h1>Fortschritt</h1>${tabs}<div class="list">${list}</div>`;
  }

  // Trainings pro Woche, letzte 10 Wochen
  const mon = mondayOf(new Date());
  const weeks = [];
  for (let i = 9; i >= 0; i--) {
    const m = addDays(mon, -7 * i), k1 = dkey(m), k2 = dkey(addDays(m, 7));
    const ss = S.sessions.filter((s) => s.date >= k1 && s.date < k2);
    weeks.push({ label: 'KW' + weekNo(m), v: ss.length, vol: ss.reduce((a, s) => a + volume(s.entries), 0) });
  }

  const used = {};
  for (const s of S.sessions) for (const e of s.entries) used[e.exId] = (used[e.exId] || 0) + 1;
  const exIds = Object.keys(used).sort((a, b) => used[b] - used[a]);
  if (!ui.progEx || !used[ui.progEx]) ui.progEx = exIds[0];
  const x = ex(ui.progEx);
  const hist = historyOf(ui.progEx);
  const pts = hist.map((h) => ({ label: shortDate(parseD(h.session.date)), v: Math.max(...h.sets.map((s) => metric(x.type, s))) }));
  const rec = records(ui.progEx);
  const first = pts[0] ? pts[0].v : 0, lastV = pts.length ? pts[pts.length - 1].v : 0;
  const change = first ? Math.round((lastV / first - 1) * 100) : 0;

  const bw = S.bodyweights.slice().sort((a, b) => (a.date < b.date ? -1 : 1));

  return `<h1>Fortschritt</h1>${tabs}
    <div class="stats"><div class="stat"><b class="num">${S.sessions.length}</b><span>Trainings gesamt</span></div>
      <div class="stat"><b class="num">${fmt(S.sessions.reduce((a, s) => a + setCount(s.entries), 0))}</b><span>Sätze gesamt</span></div>
      <div class="stat"><b class="num">${fmt(S.sessions.reduce((a, s) => a + (s.end - s.start), 0) / 3.6e6, 1)} h</b><span>trainiert</span></div></div>
    <h2>Trainings pro Woche</h2><div class="card">${barChart(weeks)}</div>
    <h2>Übung im Verlauf</h2>
    <select class="input" data-f="progEx">${exIds.map((id) => `<option value="${id}" ${id === ui.progEx ? 'selected' : ''}>${esc(ex(id).name)} (${used[id]}×)</option>`).join('')}</select>
    <div class="card" style="margin-top:10px">
      <div class="row spread"><span class="sub small">${metricName(x.type)}</span>${pts.length > 1 ? `<span class="small" style="font-weight:700;color:${change >= 0 ? 'var(--good)' : 'var(--danger)'}">${change >= 0 ? '+' : ''}${change} %</span>` : ''}</div>
      <div class="big num">${fmt(lastV, 1)}</div>
      ${pts.length > 1 ? lineChart(pts) : '<p class="sub small">Nach dem zweiten Training mit dieser Übung siehst du hier eine Kurve.</p>'}
      ${recordsHTML(x, rec)}
    </div>
    <h2>Körpergewicht</h2>
    <div class="card">${bw.length > 1 ? `<div class="big num">${fmt(bw[bw.length - 1].kg, 1)} kg</div>` + lineChart(bw.map((b) => ({ label: shortDate(parseD(b.date)), v: b.kg }))) :
      `<p class="sub" style="margin:0">${bw.length ? 'Ein Eintrag bisher: ' + fmt(bw[0].kg, 1) + ' kg. ' : ''}Trag im Profil regelmäßig dein Gewicht ein, dann siehst du hier den Verlauf.</p>`}</div>`;
};

function recordsHTML(x, rec) {
  const rows = [['Trainings mit dieser Übung', rec.count]];
  if (x.type === 'w') rows.push(['Schwerstes Gewicht', fmt(rec.maxW, 2) + ' kg'], ['Bestes 1RM (geschätzt)', fmt(rec.best, 1) + ' kg']);
  if (x.type === 'bw') rows.push(['Meiste Wiederholungen', fmt(rec.maxR)]);
  if (x.type === 't') rows.push(['Längste Zeit', fmt(rec.maxR) + ' s']);
  if (x.type === 'c') rows.push(['Bestwert', fmt(rec.best, 2)]);
  return '<div style="margin-top:10px">' + rows.map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('') + '</div>';
}

VIEWS.profil = () => {
  const p = S.profile, b = bmr();
  const tdee = b * num(p.activity), target = tdee + num(p.goal);
  const sel = (f, opts, val) => `<select class="input" data-f="${f}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return `<h1>Profil</h1>
    <h2>Körperdaten</h2>
    <div class="card"><div class="grid2">
      <label class="field"><span>Geschlecht</span>${sel('prof.sex', [['m', 'Männlich'], ['w', 'Weiblich']], p.sex)}</label>
      <label class="field"><span>Alter</span><input class="input" data-f="prof.age" inputmode="numeric" value="${esc(p.age)}" placeholder="Jahre"></label>
      <label class="field"><span>Größe (cm)</span><input class="input" data-f="prof.height" inputmode="numeric" value="${esc(p.height)}" placeholder="180"></label>
      <label class="field"><span>Gewicht (kg)</span><input class="input" data-f="prof.weight" inputmode="decimal" value="${esc(p.weight)}" placeholder="80"></label>
    </div>
    <label class="field" style="margin-top:10px"><span>Alltag & Sport</span>${sel('prof.activity', [[1.2, 'Kaum Bewegung (Bürojob)'], [1.375, 'Leicht aktiv (1–2× Sport/Woche)'], [1.55, 'Aktiv (3–4× Sport/Woche)'], [1.725, 'Sehr aktiv (5–6× Sport/Woche)'], [1.9, 'Extrem aktiv (täglich hart)']], p.activity)}</label>
    <label class="field" style="margin-top:10px"><span>Ziel</span>${sel('prof.goal', [[-500, 'Abnehmen (−500 kcal)'], [-250, 'Leicht abnehmen (−250 kcal)'], [0, 'Gewicht halten'], [250, 'Muskelaufbau (+250 kcal)'], [400, 'Aufbau (+400 kcal)']], p.goal)}</label>
    </div>
    <h2>Kalorienrechner</h2>
    <div class="card">${b ? `
      <div class="kv"><span>Grundumsatz</span><b>${fmt(Math.round(b))} kcal</b></div>
      <div class="kv"><span>Gesamtbedarf pro Tag</span><b>${fmt(Math.round(tdee))} kcal</b></div>
      <div class="kv"><span>Für dein Ziel</span><b style="color:var(--accent-text)">${fmt(Math.round(target))} kcal</b></div>
      <div class="kv"><span>Eiweiß-Empfehlung</span><b>${fmt(Math.round(num(p.weight) * 1.6))}–${fmt(Math.round(num(p.weight) * 2))} g</b></div>
      <p class="sub small" style="margin:8px 0 0">Schätzung nach Mifflin-St Jeor. Der Verbrauch jedes Trainings wird zusätzlich aus Dauer und Übungen geschätzt.</p>` :
      '<p class="sub" style="margin:0">Füll Alter, Größe und Gewicht aus, dann erscheint hier dein Bedarf.</p>'}</div>
    <h2>Gewicht eintragen</h2>
    <div class="card"><div class="row"><input class="input grow" id="bwIn" inputmode="decimal" placeholder="kg heute" value=""><button class="btn primary" data-a="addBw">Eintragen</button></div>
      ${S.bodyweights.length ? `<p class="sub small" style="margin:8px 0 0">Letzter Eintrag: ${fmt(S.bodyweights[S.bodyweights.length - 1].kg, 1)} kg am ${shortDate(parseD(S.bodyweights[S.bodyweights.length - 1].date))}</p>` : ''}</div>
    <h2>Einstellungen</h2>
    <div class="card"><label class="field"><span>Pausentimer nach jedem Satz</span>${sel('prof.rest', [[0, 'Aus'], [60, '1:00 min'], [90, '1:30 min'], [120, '2:00 min'], [180, '3:00 min']], p.rest)}</label></div>
    <h2>Deine Daten</h2>
    <div class="card"><p class="sub" style="margin:0 0 12px">Alles wird nur auf diesem Gerät gespeichert. Mach ab und zu ein Backup, z. B. in iCloud Drive oder Google Drive.</p>
      <div class="row"><button class="btn grow" data-a="export">Backup sichern</button><button class="btn grow" data-a="import">Backup laden</button></div>
      <button class="btn danger block" style="margin-top:10px" data-a="wipe">Alle Daten löschen</button></div>
    <p class="sub small" style="text-align:center;margin:20px 0">${S.sessions.length} Trainings · ${S.custom.length} eigene Übungen</p>`;
};

/* ---------- Diagramme ---------- */

function lineChart(pts) {
  const W = 320, H = 130, P = 8, B = 18;
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
  const x = (i) => P + (pts.length === 1 ? (W - 2 * P) / 2 : i * (W - 2 * P) / (pts.length - 1));
  const y = (v) => P + (H - P - B) * (1 - (v - lo) / (hi - lo));
  const line = pts.map((p, i) => x(i).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ');
  const area = `${x(0)},${H - B} ${line} ${x(pts.length - 1)},${H - B}`;
  const showDots = pts.length <= 24;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    <line class="gl" x1="0" x2="${W}" y1="${H - B}" y2="${H - B}"/>
    <polygon class="ar" points="${area}"/><polyline class="ln" points="${line}"/>
    ${showDots ? pts.map((p, i) => `<circle class="pt" cx="${x(i)}" cy="${y(p.v)}" r="3.5"/>`).join('') : ''}
    <text x="${P}" y="${H - 4}">${esc(pts[0].label)}</text>
    <text x="${W - P}" y="${H - 4}" text-anchor="end">${esc(pts[pts.length - 1].label)}</text></svg>`;
}
function barChart(items) {
  const W = 320, H = 120, B = 18, gap = 6;
  const max = Math.max(1, ...items.map((i) => i.v));
  const bw = (W - gap * (items.length - 1)) / items.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${items.map((it, i) => {
    const h = it.v ? Math.max(4, (H - B - 14) * it.v / max) : 3;
    const x = i * (bw + gap);
    return `<rect class="br ${it.v ? '' : 'z'}" x="${x}" y="${H - B - h}" width="${bw}" height="${h}" rx="4"/>
      ${it.v ? `<text x="${x + bw / 2}" y="${H - B - h - 4}" text-anchor="middle" style="fill:var(--text);font-weight:600">${it.v}</text>` : ''}
      ${i % 3 === items.length % 3 - 1 || i === items.length - 1 ? `<text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle">${it.label}</text>` : ''}`;
  }).join('')}</svg>`;
}

/* ---------- Training ---------- */

function newEntry(exId, sets, target) {
  const n = Math.max(1, Math.min(20, parseInt(sets, 10) || 3));
  return { exId, target: target || '', sets: Array.from({ length: n }, () => ({ w: '', r: '', km: '', done: false })) };
}
function startWorkout(title, items) {
  if (S.active) { toast('Es läuft schon ein Training'); openWorkout(); return; }
  S.active = { id: uid(), start: Date.now(), title, note: '', rating: 0, entries: items.map((it) => newEntry(it.exId, it.sets, it.target)) };
  save();
  openWorkout();
}
function openWorkout() { ui.woOpen = true; render(); window.scrollTo(0, 0); }

function placeholderFor(exId, i) {
  const last = lastOf(exId);
  if (!last) return {};
  return last.sets[Math.min(i, last.sets.length - 1)];
}

function renderWorkout() {
  const box = $('#workout');
  if (!S.active || !ui.woOpen) { box.hidden = true; box.innerHTML = ''; document.body.style.overflow = ''; return; }
  document.body.style.overflow = 'hidden';
  box.hidden = false;
  const A = S.active;
  const entries = A.entries.map((e, ei) => {
    const x = ex(e.exId);
    const last = lastOf(e.exId);
    const one = x.type === 't';
    const heads = { w: ['kg', 'Wdh.'], bw: ['+kg', 'Wdh.'], t: ['Sek.'], c: ['Min.', 'km'] }[x.type];
    const fields = { w: ['w', 'r'], bw: ['w', 'r'], t: ['r'], c: ['r', 'km'] }[x.type];
    let rows = `<span></span>${heads.map((h) => `<span class="h">${h}</span>`).join('')}<span></span>`;
    e.sets.forEach((s, si) => {
      const ph = placeholderFor(e.exId, si);
      rows += `<span class="n">${si + 1}</span>` + fields.map((f) =>
        `<span class="${s.done ? 'setdone' : ''}"><input data-f="set" data-e="${ei}" data-s="${si}" data-k="${f}" inputmode="decimal" value="${esc(s[f])}" placeholder="${esc(ph[f] || (f === 'w' && x.type === 'bw' ? '0' : f === 'w' ? 'kg' : '–'))}" aria-label="Satz ${si + 1} ${f}"></span>`).join('') +
        `<button class="ok ${s.done ? 'on' : ''}" data-a="toggleSet" data-e="${ei}" data-s="${si}" aria-label="Satz erledigt"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button>`;
    });
    return `<div class="entry"><div class="row"><span class="dot ${x.group}"></span><h3 class="grow">${esc(x.name)}</h3>
        <button class="icon-btn" data-a="eMenu" data-e="${ei}" aria-label="Optionen">⋯</button></div>
      <div class="hint">${e.target ? 'Ziel: ' + e.sets.length + ' × ' + esc(e.target) + ' · ' : ''}${last ? 'Letztes Mal (' + shortDate(parseD(last.session.date)) + '): ' + esc(setsText(x.type, last.sets)) : 'Erstes Mal – viel Erfolg!'}</div>
      <div class="sets ${one ? 'one' : ''}">${rows}</div>
      <button class="btn sm" style="margin-top:10px" data-a="addSet" data-e="${ei}">+ Satz</button></div>`;
  }).join('');

  box.innerHTML = `<div class="wo-head"><div class="in">
      <button class="icon-btn" data-a="closeWorkout" aria-label="Minimieren" style="font-size:22px">⌄</button>
      <div class="grow"><div class="sub small">${esc(A.title || 'Training')}</div><div class="timer num" id="elapsed">${clock(Date.now() - A.start)}</div></div>
      <button class="btn primary sm" data-a="finish">Fertig</button></div></div>
    <div class="wo-body">
      ${entries || '<div class="empty">Noch keine Übung. Füg unten welche hinzu.</div>'}
      <button class="btn block" style="margin-top:12px" data-a="pickForWorkout">+ Übung hinzufügen</button>
      <h2>Wie lief's?</h2>
      <div class="rating">${MOODS.map((m, i) => `<button class="${A.rating === i + 1 ? 'on' : ''}" data-a="rate" data-r="${i + 1}">${m}</button>`).join('')}</div>
      <textarea class="input" style="margin-top:10px" data-f="woNote" placeholder="Notiz, z. B. Schulter gezwickt, super Pump …">${esc(A.note)}</textarea>
      <button class="btn danger block" style="margin-top:20px" data-a="discard">Training verwerfen</button>
    </div>${restHTML()}`;
}

function restHTML() {
  if (!rest) return '';
  const left = Math.max(0, rest.end - Date.now());
  return `<div id="restbar"><span class="small" style="opacity:.7">Pause</span><b class="num" id="restclock">${clock(left)}</b><span class="grow"></span>
    <button data-a="restAdd" data-n="-15">−15</button><button data-a="restAdd" data-n="15">+15</button><button data-a="restSkip">Weiter</button>
    <div class="bar" id="restprog" style="width:${100 * left / rest.total}%"></div></div>`;
}
function startRest() {
  const sec = num(S.profile.rest);
  if (!sec) return;
  rest = { end: Date.now() + sec * 1000, total: sec * 1000 };
}

function finishWorkout() {
  const A = S.active;
  const entries = A.entries
    .map((e) => ({ exId: e.exId, sets: e.sets.filter((s) => s.done).map(({ w, r, km }) => ({ w, r, km })) }))
    .filter((e) => e.sets.length);
  if (!entries.length) {
    openSheet(`<div class="sh-head"><h3>Noch kein Satz abgehakt</h3></div><div class="sh-body"><p class="sub">Hake erledigte Sätze mit ✓ ab, damit sie gespeichert werden.</p></div>
      <div class="sh-foot row"><button class="btn grow" data-a="closeSheet">Weiter trainieren</button><button class="btn danger grow" data-a="discardYes">Verwerfen</button></div>`);
    return;
  }
  // Rekorde gegen bisherige Trainings prüfen
  const prs = [];
  for (const e of entries) {
    const x = ex(e.exId), rec = records(e.exId);
    const best = Math.max(...e.sets.map((s) => metric(x.type, s)));
    if (rec.count && best > rec.best + 1e-9) prs.push(x.name);
  }
  const session = {
    id: A.id, date: dkey(new Date(A.start)), start: A.start, end: Date.now(),
    title: A.title, note: A.note, rating: A.rating, entries,
  };
  session.kcal = sessionKcal(session);
  S.sessions.push(session);
  S.sessions.sort((a, b) => a.start - b.start);
  S.active = null; rest = null; ui.woOpen = false;
  save(); render();
  const vol = volume(entries);
  openSheet(`<div class="sh-head" style="text-align:center"><div style="font-size:44px">🎉</div><h3 style="font-size:22px">Stark gemacht!</h3></div>
    <div class="sh-body"><div class="stats" style="margin-top:6px">
      <div class="stat"><b class="num">${dur(session.end - session.start)}</b><span>Dauer</span></div>
      <div class="stat"><b class="num">${setCount(entries)}</b><span>Sätze</span></div>
      <div class="stat"><b class="num">${fmt(session.kcal)}</b><span>kcal (ca.)</span></div></div>
      ${vol ? `<p class="sub" style="text-align:center">${fmt(vol)} kg insgesamt bewegt</p>` : ''}
      ${prs.length ? `<h2>Neue Bestleistungen</h2>${prs.map((n) => `<div class="kv"><span>${esc(n)}</span><span class="pr">REKORD</span></div>`).join('')}` : ''}
    </div><div class="sh-foot"><button class="btn primary block" data-a="closeSheet">Schließen</button></div>`);
}

/* ---------- Sheets ---------- */

function openSheet(html, ctx = null) {
  sheetCtx = ctx;
  $('#sheet .panel').innerHTML = html;
  $('#sheet').hidden = false;
}
function closeSheet() { $('#sheet').hidden = true; $('#sheet .panel').innerHTML = ''; sheetCtx = null; }

function openPicker(title, onDone) {
  sheetCtx = { kind: 'picker', sel: new Set(), group: 'alle', q: '', onDone };
  openSheet(`<div class="sh-head"><div class="row spread"><h3>${esc(title)}</h3><button class="link" data-a="newEx">+ Eigene Übung</button></div>
      <div class="search" style="margin-top:10px"><input class="input" data-f="pickQuery" placeholder="Suchen …" autocomplete="off">${SEARCH_ICON}</div>
      <div style="margin-top:10px" id="pickchips">${chipsHTML('alle', 'pickGroup')}</div></div>
    <div class="sh-body" id="picklist"></div>
    <div class="sh-foot"><button class="btn primary block" data-a="pickDone" id="pickbtn" disabled>Hinzufügen</button></div>`, sheetCtx);
  renderPickList();
}
function renderPickList() {
  const c = sheetCtx;
  $('#picklist').innerHTML = exListHTML(filterEx(c.group, c.q), c.sel);
  $('#pickchips').innerHTML = chipsHTML(c.group, 'pickGroup');
  updatePickButton();
}
function updatePickButton() {
  const c = sheetCtx, b = $('#pickbtn');
  b.disabled = !c.sel.size;
  b.textContent = c.sel.size ? `${c.sel.size} ${c.sel.size === 1 ? 'Übung' : 'Übungen'} hinzufügen` : 'Übungen auswählen';
}

function exForm(e) {
  const isNew = !e;
  e = e || { name: '', group: ui.exGroup !== 'alle' ? ui.exGroup : 'brust', equip: 'Kurzhantel', type: 'w' };
  const back = sheetCtx && sheetCtx.kind === 'picker' ? sheetCtx : null;
  openSheet(`<div class="sh-head"><h3>${isNew ? 'Eigene Übung' : 'Übung bearbeiten'}</h3></div>
    <div class="sh-body stack">
      <label class="field"><span>Name</span><input class="input" id="fName" value="${esc(e.name)}" placeholder="z. B. Bankdrücken mit Pause"></label>
      <label class="field"><span>Muskelgruppe</span><select class="input" id="fGroup">${GROUPS.map((g) => `<option value="${g.id}" ${g.id === e.group ? 'selected' : ''}>${g.name}</option>`).join('')}</select></label>
      <label class="field"><span>Gerät</span><select class="input" id="fEquip">${EQUIP.map((q) => `<option ${q === e.equip ? 'selected' : ''}>${q}</option>`).join('')}</select></label>
      <label class="field"><span>Was trägst du ein?</span><select class="input" id="fType">${['w', 'bw', 't', 'c'].map((t) => `<option value="${t}" ${t === e.type ? 'selected' : ''}>${typeLabel(t)}</option>`).join('')}</select></label>
    </div>
    <div class="sh-foot row"><button class="btn grow" data-a="${back ? 'backToPicker' : 'closeSheet'}">Abbrechen</button><button class="btn primary grow" data-a="saveEx" data-id="${isNew ? '' : e.id}">Speichern</button></div>`,
  { kind: 'exForm', back });
}

function exDetail(id) {
  const x = ex(id), rec = records(id), hist = historyOf(id);
  const pts = hist.map((h) => ({ label: shortDate(parseD(h.session.date)), v: Math.max(...h.sets.map((s) => metric(x.type, s))) }));
  openSheet(`<div class="sh-head"><div class="row"><span class="dot ${x.group}"></span><h3 class="grow" style="font-size:20px">${esc(x.name)}</h3></div>
      <p class="sub" style="margin:4px 0 0">${groupName(x.group)} · ${esc(x.equip)} · ${typeLabel(x.type)}</p></div>
    <div class="sh-body">
      ${hist.length ? `<div class="card" style="margin-top:6px"><span class="sub small">${metricName(x.type)}</span>
          ${pts.length > 1 ? lineChart(pts) : `<div class="big num">${fmt(pts[0].v, 1)}</div>`}${recordsHTML(x, rec)}</div>
        <h2>Letzte Trainings</h2><div class="list">${hist.slice(-8).reverse().map((h) =>
          `<div class="item"><div class="grow"><div class="name small">${longDate(parseD(h.session.date))}</div><div class="meta">${esc(setsText(x.type, h.sets))}</div></div></div>`).join('')}</div>` :
        '<div class="empty">Mit dieser Übung hast du noch nicht trainiert.</div>'}
    </div>
    <div class="sh-foot row">${x.custom ? `<button class="btn danger" data-a="deleteEx" data-id="${x.id}">Löschen</button><button class="btn grow" data-a="editEx" data-id="${x.id}">Bearbeiten</button>` : ''}<button class="btn primary grow" data-a="closeSheet">Schließen</button></div>`);
}

function sessionDetail(id) {
  const s = S.sessions.find((x) => x.id === id);
  if (!s) return;
  openSheet(`<div class="sh-head"><h3 style="font-size:20px">${esc(s.title || 'Training')}</h3>
      <p class="sub" style="margin:4px 0 0">${longDate(parseD(s.date))} · ${dur(s.end - s.start)} · ca. ${fmt(s.kcal || 0)} kcal ${s.rating ? ' · ' + MOODS[s.rating - 1] : ''}</p></div>
    <div class="sh-body">
      ${s.entries.map((e) => { const x = ex(e.exId); return `<div class="card"><div class="row"><span class="dot ${x.group}"></span><h3>${esc(x.name)}</h3></div>
        ${e.sets.map((st, i) => `<div class="kv"><span class="muted">Satz ${i + 1}</span><b>${esc(setText(x.type, st))}</b></div>`).join('')}</div>`; }).join('')}
      ${s.note ? `<h2>Notiz</h2><p style="white-space:pre-wrap;margin:0">${esc(s.note)}</p>` : ''}
      ${volume(s.entries) ? `<p class="sub small" style="margin-top:16px">${fmt(volume(s.entries))} kg bewegt</p>` : ''}
    </div>
    <div class="sh-foot row"><button class="btn danger" data-a="deleteSession" data-id="${s.id}">Löschen</button><button class="btn primary grow" data-a="closeSheet">Schließen</button></div>`);
}

function confirmSheet(title, text, yesLabel, yesAction, extra = '') {
  openSheet(`<div class="sh-head"><h3>${title}</h3></div><div class="sh-body"><p class="sub">${text}</p></div>
    <div class="sh-foot row"><button class="btn grow" data-a="closeSheet">Abbrechen</button><button class="btn danger grow" data-a="${yesAction}" ${extra}>${yesLabel}</button></div>`);
}

/* ---------- Aktionen ---------- */

const ACT = {
  go(el) { ui.view = el.dataset.v; ui.woOpen = false; render(); window.scrollTo(0, 0); },
  closeSheet,

  weekNav(el) {
    const n = +el.dataset.n;
    ui.planMon = n === 0 ? mondayOf(new Date()) : addDays(ui.planMon, 7 * n);
    render();
  },
  copyPrev(el) { copyWeek(el.dataset.from, dkey(ui.planMon)); save(); render(); toast('Plan übernommen'); },
  copyNext() {
    const from = dkey(ui.planMon), to = dkey(addDays(ui.planMon, 7));
    const go = () => { copyWeek(from, to); save(); ui.planMon = addDays(ui.planMon, 7); closeSheet(); render(); toast('In nächste Woche kopiert'); };
    if (weekHasPlan(S.weeks[to])) { confirmSheet('Nächste Woche überschreiben?', 'Für die nächste Woche gibt es schon einen Plan. Er wird ersetzt.', 'Überschreiben', 'confirmGo'); sheetCtx = { go }; }
    else go();
  },
  clearWeek() {
    confirmSheet('Woche leeren?', 'Alle Übungen dieser Woche werden aus dem Plan entfernt. Deine gespeicherten Trainings bleiben.', 'Leeren', 'confirmGo');
    sheetCtx = { go: () => { delete S.weeks[dkey(ui.planMon)]; save(); closeSheet(); render(); } };
  },
  confirmGo() { sheetCtx && sheetCtx.go && sheetCtx.go(); },

  pickForDay(el) {
    const d = +el.dataset.d, key = dkey(ui.planMon);
    openPicker(DAYS[d] + ': Übungen wählen', (ids) => {
      const day = ensureWeek(key).days[d];
      for (const id of ids) day.items.push({ id: uid(), exId: id, sets: ex(id).type === 'c' ? 1 : 3, target: defaultTarget(ex(id).type) });
      save(); render();
    });
  },
  pMenu(el) {
    const d = +el.dataset.d, i = +el.dataset.i;
    const x = ex(S.weeks[dkey(ui.planMon)].days[d].items[i].exId);
    openSheet(`<div class="sh-head"><h3>${esc(x.name)}</h3></div><div class="sh-body"><div class="list">
      <button class="item" data-a="pMove" data-d="${d}" data-i="${i}" data-n="-1">↑ Nach oben</button>
      <button class="item" data-a="pMove" data-d="${d}" data-i="${i}" data-n="1">↓ Nach unten</button>
      <button class="item" data-a="exDetail" data-id="${x.id}">Verlauf ansehen</button>
      <button class="item" style="color:var(--danger)" data-a="pRemove" data-d="${d}" data-i="${i}">Aus dem Plan entfernen</button></div></div>
      <div class="sh-foot"><button class="btn block" data-a="closeSheet">Abbrechen</button></div>`);
  },
  pMove(el) {
    const items = S.weeks[dkey(ui.planMon)].days[+el.dataset.d].items, i = +el.dataset.i, j = i + +el.dataset.n;
    if (j >= 0 && j < items.length) [items[i], items[j]] = [items[j], items[i]];
    save(); closeSheet(); render();
  },
  pRemove(el) { S.weeks[dkey(ui.planMon)].days[+el.dataset.d].items.splice(+el.dataset.i, 1); save(); closeSheet(); render(); },

  startPlan(el) {
    const day = S.weeks[el.dataset.k].days[+el.dataset.d];
    startWorkout(day.title || DAYS[+el.dataset.d], day.items);
  },
  startFree() { startWorkout('Freies Training', []); },
  openWorkout,
  closeWorkout() { ui.woOpen = false; render(); },
  pickForWorkout() {
    openPicker('Übungen hinzufügen', (ids) => {
      for (const id of ids) S.active.entries.push(newEntry(id, ex(id).type === 'c' ? 1 : 3, ''));
      save(); renderWorkout();
    });
  },
  toggleSet(el) {
    const e = S.active.entries[+el.dataset.e], s = e.sets[+el.dataset.s];
    if (!s.done) {
      const ph = placeholderFor(e.exId, +el.dataset.s);
      for (const f of ['w', 'r', 'km']) if (s[f] === '' && ph[f]) s[f] = ph[f];
      if (!num(s.r)) { toast(ex(e.exId).type === 't' ? 'Bitte Sekunden eintragen' : ex(e.exId).type === 'c' ? 'Bitte Minuten eintragen' : 'Bitte Wiederholungen eintragen'); renderWorkout(); return; }
      s.done = true;
      startRest();
    } else s.done = false;
    save(); renderWorkout();
  },
  addSet(el) {
    const e = S.active.entries[+el.dataset.e];
    const prev = e.sets[e.sets.length - 1];
    e.sets.push({ w: prev ? prev.w : '', r: '', km: '', done: false });
    save(); renderWorkout();
  },
  eMenu(el) {
    const ei = +el.dataset.e, x = ex(S.active.entries[ei].exId);
    openSheet(`<div class="sh-head"><h3>${esc(x.name)}</h3></div><div class="sh-body"><div class="list">
      <button class="item" data-a="eRemoveSet" data-e="${ei}">Letzten Satz entfernen</button>
      <button class="item" data-a="eMove" data-e="${ei}" data-n="-1">↑ Nach oben</button>
      <button class="item" data-a="eMove" data-e="${ei}" data-n="1">↓ Nach unten</button>
      <button class="item" data-a="exDetail" data-id="${x.id}">Verlauf ansehen</button>
      <button class="item" style="color:var(--danger)" data-a="eRemove" data-e="${ei}">Übung entfernen</button></div></div>
      <div class="sh-foot"><button class="btn block" data-a="closeSheet">Abbrechen</button></div>`);
  },
  eRemoveSet(el) { const e = S.active.entries[+el.dataset.e]; if (e.sets.length > 1) e.sets.pop(); save(); closeSheet(); renderWorkout(); },
  eMove(el) {
    const a = S.active.entries, i = +el.dataset.e, j = i + +el.dataset.n;
    if (j >= 0 && j < a.length) [a[i], a[j]] = [a[j], a[i]];
    save(); closeSheet(); renderWorkout();
  },
  eRemove(el) { S.active.entries.splice(+el.dataset.e, 1); save(); closeSheet(); renderWorkout(); },
  rate(el) { const r = +el.dataset.r; S.active.rating = S.active.rating === r ? 0 : r; save(); renderWorkout(); },
  restAdd(el) { if (rest) { rest.end += +el.dataset.n * 1000; rest.total = Math.max(rest.total, rest.end - Date.now()); } tick(); },
  restSkip() { rest = null; renderWorkout(); },
  finish: finishWorkout,
  discard() { confirmSheet('Training verwerfen?', 'Alle Einträge dieses Trainings gehen verloren.', 'Verwerfen', 'discardYes'); },
  discardYes() { S.active = null; rest = null; ui.woOpen = false; save(); closeSheet(); render(); },

  exGroup(el) { ui.exGroup = el.dataset.g; render(); },
  exDetail(el) { exDetail(el.dataset.id); },
  newEx() { exForm(null); },
  editEx(el) { exForm(ex(el.dataset.id)); },
  backToPicker() { const c = sheetCtx.back; openPicker('Übungen wählen', c.onDone); sheetCtx.sel = c.sel; renderPickList(); },
  saveEx(el) {
    const name = $('#fName').value.trim();
    if (!name) { toast('Bitte einen Namen eingeben'); return; }
    const data = { name, group: $('#fGroup').value, equip: $('#fEquip').value, type: $('#fType').value };
    const back = sheetCtx && sheetCtx.back;
    let id = el.dataset.id;
    if (id) Object.assign(S.custom.find((e) => e.id === id), data);
    else { id = 'c-' + uid(); S.custom.push({ id, custom: true, ...data }); }
    exCache = null; save();
    if (back) { openPicker('Übungen wählen', back.onDone); back.sel.add(id); sheetCtx.sel = back.sel; renderPickList(); }
    else { closeSheet(); render(); }
    toast('Übung gespeichert');
  },
  deleteEx(el) {
    confirmSheet('Übung löschen?', 'Sie verschwindet aus der Sammlung und aus deinen Plänen. Alte Trainings bleiben erhalten.', 'Löschen', 'deleteExYes', `data-id="${el.dataset.id}"`);
  },
  deleteExYes(el) {
    const id = el.dataset.id;
    S.custom = S.custom.filter((e) => e.id !== id);
    for (const w of Object.values(S.weeks)) for (const d of w.days) d.items = d.items.filter((it) => it.exId !== id);
    save(); closeSheet(); render();
  },

  pickToggle(el) {
    const c = sheetCtx, id = el.dataset.id;
    c.sel.has(id) ? c.sel.delete(id) : c.sel.add(id);
    el.classList.toggle('sel', c.sel.has(id));
    updatePickButton();
  },
  pickGroup(el) { sheetCtx.group = el.dataset.g; renderPickList(); },
  pickDone() { const c = sheetCtx; closeSheet(); c.onDone([...c.sel]); },

  histTab(el) { ui.histTab = el.dataset.t; render(); },
  sessionDetail(el) { sessionDetail(el.dataset.id); },
  deleteSession(el) { confirmSheet('Training löschen?', 'Das Training wird endgültig aus deinem Verlauf entfernt.', 'Löschen', 'deleteSessionYes', `data-id="${el.dataset.id}"`); },
  deleteSessionYes(el) { S.sessions = S.sessions.filter((s) => s.id !== el.dataset.id); save(); closeSheet(); render(); },

  addBw() {
    const kg = num($('#bwIn').value);
    if (kg < 20 || kg > 400) { toast('Bitte ein gültiges Gewicht eingeben'); return; }
    const k = dkey(new Date());
    S.bodyweights = S.bodyweights.filter((b) => b.date !== k).concat({ date: k, kg });
    S.profile.weight = String(kg);
    save(); render(); toast('Gewicht eingetragen');
  },
  export() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fitness-backup-' + dkey(new Date()) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  import() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      f.text().then((t) => {
        const d = JSON.parse(t);
        if (!d || !Array.isArray(d.sessions) || typeof d.weeks !== 'object') throw new Error('format');
        S = Object.assign(defaultState(), d);
        S.profile = Object.assign(defaultState().profile, S.profile);
        save(); render(); toast('Backup geladen');
      }).catch(() => toast('Diese Datei ist kein gültiges Backup'));
    };
    inp.click();
  },
  wipe() { confirmSheet('Alle Daten löschen?', 'Pläne, Trainings, eigene Übungen und Profil werden von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.', 'Alles löschen', 'wipeYes'); },
  wipeYes() { S = defaultState(); rest = null; save(); closeSheet(); render(); toast('Alle Daten gelöscht'); },
};

/* ---------- Events ---------- */

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.a];
  if (fn) { ev.preventDefault(); fn(el, ev); }
});

document.addEventListener('input', (ev) => {
  const el = ev.target, f = el.dataset.f;
  if (!f) return;
  if (f === 'set') {
    S.active.entries[+el.dataset.e].sets[+el.dataset.s][el.dataset.k] = el.value.replace(',', '.').trim();
    save();
  } else if (f === 'woNote') { S.active.note = el.value; save(); }
  else if (f === 'exQuery') { ui.exQuery = el.value; $('#exlist').innerHTML = exListHTML(filterEx(ui.exGroup, ui.exQuery)); }
  else if (f === 'pickQuery') { sheetCtx.q = el.value; renderPickList(); }
});

document.addEventListener('change', (ev) => {
  const el = ev.target, f = el.dataset.f;
  if (!f) return;
  const key = dkey(ui.planMon);
  if (f === 'dayTitle') { ensureWeek(key).days[+el.dataset.d].title = el.value.trim(); save(); }
  else if (f === 'pSets') {
    const it = S.weeks[key].days[+el.dataset.d].items[+el.dataset.i];
    it.sets = Math.max(1, Math.min(20, parseInt(el.value, 10) || it.sets)); el.value = it.sets; save();
  } else if (f === 'pTarget') { S.weeks[key].days[+el.dataset.d].items[+el.dataset.i].target = el.value.trim(); save(); }
  else if (f === 'progEx') { ui.progEx = el.value; render(); }
  else if (f.startsWith('prof.')) {
    const k = f.slice(5);
    S.profile[k] = el.value.replace(',', '.').trim();
    if (k === 'weight' && num(el.value) >= 20) {
      const d = dkey(new Date());
      S.bodyweights = S.bodyweights.filter((b) => b.date !== d).concat({ date: d, kg: num(el.value) });
    }
    save(); render();
  }
});

/* ---------- Timer ---------- */

function tick() {
  if (!S.active) return;
  const el = $('#elapsed'); if (el) el.textContent = clock(Date.now() - S.active.start);
  const pc = $('#pillclock'); if (pc) pc.textContent = clock(Date.now() - S.active.start);
  if (rest) {
    const left = rest.end - Date.now();
    if (left <= 0) {
      rest = null;
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      if (ui.woOpen) { renderWorkout(); toast('Pause vorbei – nächster Satz!'); }
    } else if (!$('#restbar') && ui.woOpen) {
      $('#workout').insertAdjacentHTML('beforeend', restHTML());
    } else {
      const rc = $('#restclock'); if (rc) rc.textContent = clock(left);
      const rp = $('#restprog'); if (rp) rp.style.width = (100 * left / rest.total) + '%';
    }
  }
}
setInterval(tick, 1000);

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

/* ---------- Start ---------- */

if (S.active) ui.woOpen = true;
render();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
