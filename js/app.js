"use strict";
/* 모두의 영어 app — 시안(모두의영어_시안\index.html)의 화면·동작을 여러 지문·지연 로딩·진행 저장으로 확장 */

/* ───────── 저장 (localStorage 접두어 mye., 실패해도 동작) ───────── */
const MEM = {};
const LS = {
  get(k, d) { try { const v = localStorage.getItem("mye." + k); return v === null ? d : JSON.parse(v); } catch (e) { return k in MEM ? MEM[k] : d; } },
  set(k, v) { MEM[k] = v; try { localStorage.setItem("mye." + k, JSON.stringify(v)); } catch (e) { /* 저장 불가: 메모리만 */ } }
};

/* ───────── 대입 공용 하루 시간 (화면표준 7절): 키 tera_daeip_subjects · tera_daeip_per_min ───────── */
const DSUBJ = [["tongsa", "통합사회"], ["hanguksa", "한국사"], ["tonggwa", "통합과학"], ["math", "수학"], ["gukeo", "국어"], ["english", "영어"]];
const PERMIN = [[15, "15분"], [30, "30분"], [45, "45분"], [60, "1시간"], [90, "1시간 30분"], [120, "2시간"]], DAYMAX = 480;
function rawGet(k) { try { return localStorage.getItem(k); } catch (e) { return MEM["raw." + k] === undefined ? null : MEM["raw." + k]; } }
function rawSet(k, v) { MEM["raw." + k] = v; try { localStorage.setItem(k, v); } catch (e) { } }
function dSubjects() {
  let a = []; try { a = JSON.parse(rawGet("tera_daeip_subjects") || "[]"); } catch (e) { }
  if (!Array.isArray(a)) a = [];
  a = a.filter(x => DSUBJ.some(d => d[0] === x));
  if (!a.includes("english")) a.push("english");
  return a;
}
function dPerMin() {
  let m = +rawGet("tera_daeip_per_min"); if (!(m > 0)) m = 30;
  m = Math.min(m, 120); const n = dSubjects().length;
  while (m > 15 && m * n > DAYMAX) m = PERMIN[Math.max(0, PERMIN.findIndex(x => x[0] === m) - 1)][0];
  return m;
}
function fmtMin(m) { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? h + "시간 " + r + "분" : h + "시간") : r + "분"; }
function dayTotal() { return dPerMin() * dSubjects().length; }
function settingsCard(g, n) {
  const subs = dSubjects(), pm = dPerMin(), nn = subs.length;
  return `<h2 class="stitle">설정</h2>
  <div class="card"><h3 style="margin-top:0">공부할 과목</h3>
    <div class="seg wrap">${DSUBJ.map(d => `<button class="${subs.includes(d[0]) ? "on" : ""}" data-a="subj" data-v="${d[0]}" ${d[0] === "english" ? "disabled" : ""}>${d[1]}</button>`).join("")}</div>
    <h3>과목당 하루 시간</h3>
    <div class="seg wrap">${PERMIN.map(x => `<button class="${pm === x[0] ? "on" : ""}" data-a="permin" data-v="${x[0]}" ${x[0] * nn > DAYMAX ? "disabled" : ""}>${x[1]}</button>`).join("")}</div>
    <div class="dsum">고른 과목 ${nn}개 · 하루 합계 ${fmtMin(pm * nn)}</div></div>
  <div class="card"><h3 style="margin-top:0">학습</h3>
    <div class="muted">학년</div><div class="seg">${[1, 2, 3].map(x => `<button class="${g === x ? "on" : ""}" data-a="grade" data-v="${x}">고${x}</button>`).join("")}</div>
    <div class="muted">하루 지문</div><div class="seg">${[3, 4].map(x => `<button class="${n === x ? "on" : ""}" data-a="count" data-v="${x}">${x}개</button>`).join("")}</div>
    <div class="muted">지문에서 할 단계(기본 구성 · 지문마다 따로 바꿀 수 있어요)</div><div class="seg wrap">${STEP_KEYS.map((k, i) => `<button class="${planDef().includes(k) ? "on" : ""}" data-a="pdef" data-v="${k}">${STEPS[i]}</button>`).join("")}</div>
    <button class="li" data-zs="1"><span>합격 전략</span></button></div>`;
}/*1111선택형*/
const INDEX = window.MYE_INDEX || [];
const PIDX = {};   /* pid -> {e: 회차, p: [pid,번호,유형,ready]} */
INDEX.forEach(e => e.p.forEach(p => { PIDX[p[0]] = { e, p }; }));

/* ───────── 도구 ───────── */
const root = document.getElementById("root");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const CIRC = "①②③④⑤";
/* 1111 선택형 개편: 단계는 의무가 아니다. 지문마다 할 단계를 고르고(plan.<지문id>), 고르지 않으면 기본 구성(plan)을 쓴다. 배열은 서술형에서 떼어 따로 둔다 */
const STEP_KEYS = ["voc", "an", "ck", "ch", "mcq", "arr", "wr"];
const STEPS = ["단어", "분석", "확인", "양자택일", "객관식", "배열", "서술형"];
const WRHOT = window.MYE_WRHOT || {};   /* 서술형 강추: { 지문id: [지문 강추 0|1, 강추 문항 색인, 문장 색인, 문법 표지] } — _패치/서술형강추.js */
const pad2 = n => (n < 10 ? "0" : "") + n;
const ymd = d => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
const weekStart = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return ymd(x); };
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/* ───────── 상태 ───────── */
let P = null;                 /* 현재 지문 */
const nav = { tab: "home", back: "home", ex: { g: null, y: null, u: null }, loading: false, err: "" };
let st = null;                /* 현재 지문 진행 상태 */
let WT = null;                /* 주말 단어 테스트 상태 */

function planDef() { const a = LS.get("plan", null); const b = Array.isArray(a) ? a.filter(k => STEP_KEYS.includes(k)) : []; return b.length ? b : STEP_KEYS.slice(); }
function planOf(pid) { const a = LS.get("plan." + pid, null); const b = Array.isArray(a) ? a.filter(k => STEP_KEYS.includes(k)) : []; return b.length ? b : planDef(); }
function hasStep(k) {
  if (k === "arr") return P.write.some(w => w.tiles);
  if (k === "wr") return P.write.some(w => !w.tiles);
  if (k === "ck") return P.checks.length > 0;
  if (k === "ch") return !!(P.choice && P.choice.items.length);
  if (k === "mcq") return P.orig.length + P.mcq.length > 0;
  return true;
}
function actSteps() { const pl = planOf(st.pid); const a = STEP_KEYS.map((k, i) => i).filter(i => pl.includes(STEP_KEYS[i]) && hasStep(STEP_KEYS[i])); return a.length ? a : [1]; }
function nextStep() { return actSteps().find(i => i > st.step); }
function nextLabel() { const n = nextStep(); return n === undefined ? "지문 완료" : "다음: " + STEPS[n]; }
function wList(kind) { return P.write.map((w, i) => i).filter(i => (kind === "arr") === !!P.write[i].tiles); }
function enterStep() {
  const a = actSteps(); if (!a.includes(st.step)) st.step = a.find(i => i > st.step) ?? a[0];
  const k = STEP_KEYS[st.step];
  if (k === "arr" || k === "wr") { const l = wList(k); if (!l.includes(st.dr.lv)) st.dr.lv = l[0]; }
}
function finishPassage() {
  const dm = doneMap(); dm[st.pid] = Date.now(); LS.set("done", dm); markAtt();
  const pr = LS.get("prog." + st.pid, {}); pr.done = true; LS.set("prog." + st.pid, pr);
  nav.tab = nav.back || "home";
}
function goNext(skip) {
  if (!skip) bump();
  const n = nextStep();
  if (n === undefined) { finishPassage(); return; }
  st.step = n; enterStep(); saveProg(); window.scrollTo(0, 0);
}
function freshSt(pid) {
  const prog = LS.get("prog." + pid, null);
  const max = prog ? Math.min(prog.max || 0, 6) : 0;
  return {
    pid, step: prog && prog.cur != null ? Math.min(prog.cur, 6) : 0, maxStep: max, did: (prog && prog.did) || {}, planOpen: !LS.get("plan." + pid, null) && !prog,
    voc: { phase: "list", sel: {}, words: [], queue: [], cur: 0, pick: null, opts: [], wrong: 0 },
    an: { si: -1, k: 3, note: -1, seen: {}, bg: false },
    ck: { i: 0, ph: "S", found: { S: [], V: [] }, pop: [], flash: null, miss: 0, msg: "", ok: false, pick: null, score: 0 },
    dr: { ch: {}, graded: false, q: 0, pick: {}, lv: 0, tiles: {}, text: {}, res: {} }
  };
}
function newSt(pid) { const s = freshSt(pid); svInit(s.ck); return s; }
/* 공동 주어(앞 절과 S 공유)인 절은 S 누르기를 자동 통과 처리한다 */
function svInit(c) {
  const q = P.checks[c.i];
  c.found = { S: [], V: [] };
  if (q && q.type === "sv") P.sentences[q.si].main.forEach((m, k) => { if (!m.s.h.length) c.found.S.push(k); });
}
function saveProg() {
  if (!st) return;
  const old = LS.get("prog." + st.pid, {});
  LS.set("prog." + st.pid, { max: Math.max(old.max || 0, st.maxStep), cur: st.step, did: st.did, ts: Date.now(), done: !!old.done });
}
/* 지금 단계를 끝낸 것으로 적는다(건너뛴 단계는 적지 않는다) */
function bump() { st.did[STEP_KEYS[st.step]] = 1; st.maxStep = Math.max(st.maxStep, st.step); saveProg(); markAtt(); }

/* ───────── 데이터 지연 로딩 ───────── */
function loadSrc(uid) {
  return new Promise((res, rej) => {
    window.MYE_DATA = window.MYE_DATA || {};
    if (window.MYE_DATA[uid]) return res(window.MYE_DATA[uid]);
    const s = document.createElement("script");
    s.src = "data/" + uid + ".js";
    s.onload = () => (window.MYE_DATA[uid] ? res(window.MYE_DATA[uid]) : rej(new Error("데이터 없음")));
    s.onerror = () => rej(new Error("파일을 불러오지 못했다"));
    document.head.appendChild(s);
  });
}
function openPassage(pid, back) {
  const it = PIDX[pid];
  if (!it || !it.p[3]) return;
  nav.loading = true; nav.err = ""; nav.tab = "p"; nav.back = back || "home"; render();
  loadSrc(it.e.u).then(d => {
    P = d[pid]; P.wordsAll = P.wordsAll || P.words || []; P.words = P.wordsAll.filter(lvOk); st = newSt(pid); enterStep(); nav.loading = false; window.scrollTo(0, 0); render();
  }).catch(e => { nav.loading = false; nav.err = e.message; render(); });
}

/* ───────── 오늘 지문 고르기 ───────── */
function doneMap() { return LS.get("done", {}); }
/* 고른 학년에 열린 지문이 하나도 없으면 열린 지문이 있는 가장 가까운 학년으로 대신 낸다 */
function readyGrade(g) {
  const has = x => INDEX.some(e => e.g === x && e.p.some(p => p[3]));
  if (has(g)) return g;
  for (const x of [3, 2, 1]) if (has(x)) return x;
  return g;
}
function todayIds() {
  const key = ymd(new Date()), g = readyGrade(LS.get("grade", 3)), n = LS.get("count", 4);
  const t = LS.get("today", null), done = doneMap();
  const sc = scopeOn() ? scopeMap() : null, sk = sc ? Object.keys(sc).sort().join(",") : "";
  const ids = (t && t.date === key && t.g === g && t.n === n && (t.sk || "") === sk) ? t.ids.slice() : [];
  const before = ids.length;
  for (const e of INDEX) {              /* INDEX 는 최근 회차 순 */
    if (ids.length >= n) break;
    if (!sc && e.g !== g) continue;
    for (const p of e.p) { if (ids.length >= n) break; if (p[3] && !done[p[0]] && !ids.includes(p[0]) && (!sc || sc[p[0]])) ids.push(p[0]); }
  }
  if (ids.length !== before || !t || t.date !== key || (t.sk || "") !== sk) LS.set("today", { date: key, g, n, ids, sk });
  return ids;
}
/* 내 시험 범위(내신): 회차와 문항을 골라 담는다. scope = { 지문id: 1 } · scopeOn = 오늘 지문을 범위에서 낼지 */
function scopeMap() { const m = LS.get("scope", {}); return m && typeof m === "object" ? m : {}; }
function scopeN() { return Object.keys(scopeMap()).filter(id => PIDX[id]).length; }
function scopeOn() { return !!LS.get("scopeOn", false) && scopeN() > 0; }
function statusOf(pid) {
  if (doneMap()[pid]) return { t: "완료", c: "g" };
  const pr = LS.get("prog." + pid, null);
  if (pr && (pr.max > 0 || pr.cur > 0)) return { t: STEPS[Math.min(pr.cur != null ? pr.cur : pr.max, 6)] + " 단계", c: "" };
  return { t: "시작 전", c: "" };
}

/* ───────── 출석 · 연속 · D-day · 징검다리 ───────── */
function markAtt() { const a = LS.get("att", {}), k = ymd(new Date()); a[k] = (a[k] || 0) + 1; LS.set("att", a); }
function streakDays() {
  const a = LS.get("att", {}); let d = new Date(), n = 0;
  if (!a[ymd(d)]) d.setDate(d.getDate() - 1);
  while (a[ymd(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
/* 임시 산식: 서버 백분위가 없어 누적 완료 지문과 연속 일수로만 계산한다. 서버 집계 연동 시 교체 */
function topPct() { const n = Object.keys(doneMap()).length; return Math.max(1, 100 - Math.min(99, n * 3 + streakDays() * 2)); }
function ddayInfo() {
  const d = LS.get("dday", null); if (!d || !d.date) return null;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const dt = new Date(d.date + "T00:00:00");
  const n = Math.round((dt - t0) / 86400000);
  return { label: d.label || "", n, txt: n > 0 ? "D-" + n : n === 0 ? "D-day" : "D+" + (-n) };
}
function blocks(total, isDone, cur) {
  if (!total) return "";
  if (total > 20) {   // 단어가 많은 지문(EBS): 칸 대신 막대(칸이 화면 밖으로 넘치지 않게)
    let d = 0; for (let i = 0; i < total; i++) if (isDone(i)) d++;
    return `<div style="height:14px;border-radius:4px;border:2px solid var(--line);background:#fff;margin:10px 0;overflow:hidden"><div style="height:100%;width:${Math.round(100 * d / total)}%;background:var(--green)"></div></div>`;
  }
  let h = `<div class="blk">`;
  for (let i = 0; i < total; i++) h += (i ? `<span class="ln"></span>` : "") + `<span class="b ${isDone(i) ? "done" : ""} ${i === cur ? "cur" : ""}"></span>`;
  return h + `</div>`;
}
const FLAME = `<svg class="flame" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12 2c1 4-3 5.5-3 9.5 0 1.6.8 2.7 1.8 3.3-.3-2 .7-3.6 2-4.6 0 2.2 2.2 3.1 2.2 5.3 0 1.3-.6 2.3-1.5 2.9 2.4-.5 4.5-2.5 4.5-5.9 0-3.6-2.6-5.1-3.6-8-1 .9-1.6 1.6-2.4 3C12.4 6.5 12.3 4.3 12 2z" fill="#0B5E3C"/><path d="M12 22c-3.3 0-6-2.5-6-5.8 0-2 1-3.3 2-4.2.2 1.6 1.3 2.6 2.4 3 .1-1.5.9-2.8 1.8-3.6.2 1.8 2 2.6 2 4.4 0 .9-.4 1.6-1 2.1 1.1-.4 1.8-1.2 1.8-2.3 0 4-1.8 6.4-3 6.4z" fill="#0B5E3C" opacity=".55"/></svg>`;
const SHIELD = `<svg class="shield" viewBox="0 0 24 28" width="26" height="30" aria-hidden="true"><path d="M12 1l9 3.5v8.2c0 6.2-4.1 11-9 13.3C7.1 23.7 3 18.9 3 12.7V4.5z" fill="#0B5E3C"/><path d="M8 13l3 3 5-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* 단어 수준(10-10): lv "m" = 너무 쉬워 출제 안 함, "1"~"3" = 모의고사에 자리 잡는 학년. 학생 학년 이상만 출제, lv 없으면 출제 */
const lvOk = w => w.lv !== "m" && (!w.lv || +w.lv >= LS.get("grade", 3));
/* 단어 한 줄: w (← b)  p  **m**, e1, e2 */
function wline(w) {
  /* 표제어는 원형(b 없으면 en). 뜻은 사전 원형 뜻(hm), 그 아래 작게 지문 속 형태와 뜻. */
  const head = w.b || w.en, hm = w.hm && w.hm.length ? w.hm : null;
  const main = hm ? hm.join(", ") : w.ko;
  const ex = hm ? "" : (w.e || []).filter(x => x !== w.ko).map(x => ", " + esc(x)).join("");
  const showCtx = !w.nt && (w.en !== head || (hm && !hm.includes(w.ko)));
  return `<span class="wl"><span class="en">${esc(head)}</span>${w.hp || w.p ? `<span class="ps">${esc((w.hp || w.p) === "phr" && w.pf ? "phr·" + w.pf : (w.hp || w.p))}</span>` : ""}${w.nt ? `<span class="bf">교재</span>` : ""}<span class="mn"><b>${esc(main)}</b>${ex}</span>${showCtx ? `<span class="cx">지문: ${esc(w.en)} — ${esc(w.ko)}</span>` : ""}</span>`;
}
const slimW = w => ({ en: w.en, ko: w.ko, b: w.b, p: w.p, e: w.e, hp: w.hp, hm: w.hm, pf: w.pf, lv: w.lv });

/* ───────── 이번 주 단어 ───────── */
function recordWords(words, pid) {
  const wk = "wk." + weekStart(new Date());
  const cur = LS.get(wk, {});
  cur[pid] = words.map(slimW);
  LS.set(wk, cur);
  const all = LS.get("words", {});
  words.forEach(w => { if (!all[w.en] || (w.hm && !all[w.en].hm)) all[w.en] = Object.assign(slimW(w), { pid, ts: Date.now() }); });
  LS.set("words", all);
}
function weekWords() {
  const cur = LS.get("wk." + weekStart(new Date()), {}), seen = {}, out = [];
  Object.values(cur).forEach(a => a.forEach(w => { if (!seen[w.en]) { seen[w.en] = 1; out.push(w); } }));
  return out;
}
function dayWordsN() { return weekWords().length + wrongWords().length >= 2 ? 1 : 0; }
function wrongWords() {
  const wr = LS.get("wrong", {}), all = LS.get("words", {});
  return Object.keys(wr).filter(k => wr[k] > 0 && all[k]).map(k => slimW(Object.assign({ en: k }, all[k])));
}

/* ───────── 공통: 문장 토큰 렌더 (시안 그대로 + 명령문·단편 보호) ───────── */
const toks = (P0, si) => P0.sentences[si].t.split(" ");
function renderSent(si, o = {}) {
  const s = P.sentences[si], T = toks(P, si);
  const lab = {}, cls = {};
  const add = (i, c) => { cls[i] = (cls[i] || "") + " " + c; };
  if (o.brackets) s.br.forEach(([a, b, k]) => { if (k === "m") range(a, b).forEach(i => add(i, "dim")); });
  if (o.sv) {
    const addL = (i, t) => { lab[i] = lab[i] ? lab[i] + " " + t : t; };
    s.main.forEach(c => { c.s.h.forEach(i => add(i, "hS")); c.v.h.forEach(i => add(i, "hV")); });
    s.main.forEach(c => { c.s.h.slice(1).forEach(i => { if (!(i in lab)) lab[i] = ""; }); c.v.h.slice(1).forEach(i => { if (!(i in lab)) lab[i] = ""; }); if (c.s.h.length) addL(c.s.h[0], "S"); if (c.v.h.length) addL(c.v.h[0], "V"); });
    s.sub.forEach(c => { c.s.h.forEach((i, n) => { if (!(i in lab)) lab[i] = n ? "" : "s′"; }); c.v.h.forEach((i, n) => { if (!(i in lab)) lab[i] = n ? "" : "v′"; }); });
  }
  const ends = Object.assign({}, o.ends || {});
  if (o.sv) {
    const grp = c => c.h.length && (ends[c.h[0]] = Math.max(ends[c.h[0]] ?? 0, Math.max(...c.h)));
    s.main.forEach(c => { grp(c.s); grp(c.v); }); s.sub.forEach(c => { grp(c.s); grp(c.v); });
  }
  if (o.labels) Object.assign(lab, o.labels);
  (o.pop || []).forEach(i => add(i, "pop"));
  if (o.marks) Object.entries(o.marks).forEach(([i, m]) => add(+i, "m" + m));
  (o.bad || []).forEach(i => add(i, "bad"));
  (o.hl || []).forEach(i => add(i, "hl"));
  let out = "";
  const tokHtml = (w, i) => {
    let pre = "", post = "";
    if (o.brackets) {
      s.br.filter(b => b[0] === i).sort((x, y) => (y[1] - y[0]) - (x[1] - x[0])).forEach(b => pre += b[2] === "m" ? "(" : "[");
      s.br.filter(b => b[1] === i).sort((x, y) => (x[1] - x[0]) - (y[1] - y[0])).forEach(b => post += b[2] === "m" ? ")" : "]");
    }
    let wtxt = esc(w), punct = "";
    if (post) { const m = w.match(/^(.*?)([,.;:?!”’"')]*)$/); wtxt = esc(m[1]); punct = esc(m[2]); }
    return `<span class="tk${cls[i] || ""}" data-i="${i}"><span class="w">${pre ? `<span class="br">${pre}</span>` : ""}${wtxt}${post ? `<span class="br">${post}</span>` : ""}${punct}</span></span>`;
  };
  for (let i = 0; i < T.length; i++) {
    const l = lab[i] || "";
    if (l && (o.sv || o.lab)) {
      const e = Math.max(i, Math.min(ends[i] ?? i, T.length - 1)), lc = l === "S" || l === "S V" ? "S" : l === "V" ? "V" : "s";
      out += `<span class="grp"><span class="gt">` + T.slice(i, e + 1).map((w, k) => tokHtml(w, i + k)).join("") + `</span><span class="lb ${lc}">${l}</span></span>`;
      i = e;
    } else out += tokHtml(T[i], i);
  }
  return `<div class="sent ${o.pick ? "pick" : ""}">` + out + `</div>`;
}

/* ───────── 머리띠 · 아래 탭 (화면표준_1110 1·2절) ───────── */
const SVGI = b => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
const GRIDI = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>`;
const TABI = {
  home: SVGI(`<path d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>`),
  map: SVGI(`<circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="7" r="2.4"/><circle cx="8" cy="18" r="2.4"/><circle cx="18" cy="17" r="2.4"/><path d="M8.2 7 15.8 7M7 8.2 7.6 15.6M16.6 9.2 8.8 16.6M18 9.4v5.2"/>`),
  drill: SVGI(`<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>`),
  explore: SVGI(`<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>`),
  gram: SVGI(`<path d="M12 6.5C10.2 5 7.6 4.5 4.5 4.8v13c3.1-.3 5.7.2 7.5 1.7 1.8-1.5 4.4-2 7.5-1.7v-13c-3.1-.3-5.7.2-7.5 1.7zM12 6.5v13"/>`),
  writ: SVGI(`<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>`),
  words: SVGI(`<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 9.5h7M8.5 14.5h4.5"/>`),
  rec: SVGI(`<path d="M5 19.5V12M12 19.5V5M19 19.5V9"/>`)
};
/* o.back: 뒤로 단추의 data 속성 문자열 · o.title: 안쪽 화면 이름 · o.right: 오른쪽 진행 글 · o.sub: 바깥 화면의 과목 옆 글 */
const HNAV = [["home", "오늘"], ["map", "합격 지도"], ["explore", "기출"], ["drill", "드릴"], ["words", "단어장"], ["rec", "기록"]];
function topBar(o) {
  o = o || {};
  if (o.back) return `<div class="top"><button class="back" ${o.back} aria-label="뒤로">‹</button><div class="ttl">${esc(o.title || "")}</div><div class="sp"></div>${o.right ? `<div class="hprog">${o.right}</div>` : ""}</div>`;
  return `<div class="top"><span class="mark">대</span><div class="logo">모두의 <b>대입</b></div><div class="sub">영어${o.sub ? " · " + esc(o.sub) : ""}</div><div class="sp"></div><nav class="hnav">${HNAV.map(([k, n]) => `<button class="${nav.tab === k || (k === "drill" && (nav.tab === "gram" || nav.tab === "writ")) ? "on" : ""}" data-a="tab" data-v="${k}">${n}</button>`).join("")}</nav><a class="gridb" href="https://teralearning.kr/" aria-label="테라러닝 전체 서비스">${GRIDI}</a></div>`;
}
window.TOPBAR = topBar;

/* 합격전략 알약: index 의 인라인 코드가 머리띠에 넣은 같은 이름 단추는 지우고, 표준 위치(탭 위)의 알약 하나만 쓴다 */
function zsFab() {
  document.querySelectorAll("#root>.top>.zs-btn").forEach(e => e.remove());
  if (window.ZZSTRAT && !document.querySelector("body>.zs-fab")) ZZSTRAT.fab("eng_hs");
}
/* ───────── 화면 틀 ───────── */
function render() { renderBase(); afterRender(); }
function renderBase() {
  if (nav.tab === "p") { root.innerHTML = passageView(); document.body.classList.add("notab"); return; }
  if (nav.tab === "wtest") { root.innerHTML = wtestView(); document.body.classList.add("notab"); return; }
  const body = { home, map: mapView, explore, drill: drillHub, gram: () => DRILL.gram(), writ: () => DRILL.writ(), words: wordsTab, rec: recTab, scope: scopeView }[nav.tab]();
  root.innerHTML = body + `<div class="nav">` + [["home", "오늘"], ["map", "합격 지도"], ["explore", "기출"], ["drill", "드릴"], ["words", "단어장"], ["rec", "기록"]]
    .map(([k, n]) => `<button class="${nav.tab === k || (k === "drill" && (nav.tab === "gram" || nav.tab === "writ")) ? "on" : ""}" data-a="tab" data-v="${k}">${TABI[k]}<span>${n}</span></button>`).join("") + `</div>`;
  document.body.classList.toggle("notab", !!root.querySelector(".top .back"));
}
/* ───────── 문제 화면 공용 부품 어댑터 (화면표준 12절 · 공용 tera-q.js / tera-pad.js 의 펜) ───────── */
const ENGQ = (() => {
  const I = {
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.5a2.4 2.4 0 1 1 3.3 2.2c-.7.3-1 .8-1 1.6M12 16.5h.01" stroke-linecap="round"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 6.5C10.2 5 7.6 4.5 4.5 4.8v13c3.1-.3 5.7.2 7.5 1.7 1.8-1.5 4.4-2 7.5-1.7v-13c-3.1-.3-5.7.2-7.5 1.7zM12 6.5v13"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 19.5l1-4L16 5l3 3L8.5 18.5z"/></svg>'
  };
  const unsureMap = () => LS.get("dq.unsure", {});
  const prog = (done, total) => `<div class="tq-prog"><i><u style="width:${total ? Math.round(100 * done / total) : 0}%"></u></i><span><b>${Math.max(0, total - done)}</b>문제 남았어요</span></div>`;
  const meta = (no, o = {}) => `<div class="tq-meta"><span class="tq-no">${no}</span>${o.tag ? `<span class="tq-tagt">${String(o.tag).split(" · ").map(x => `<span>${x}</span>`).join(" · ")}</span>` : ""}<span data-tq="badge" data-on="${o.hot || 0}"></span><span class="tq-sp"></span><span data-tq="tg"></span></div>`;
  const choices = (opts, f) => `<ul class="tq-choices">` + opts.map((o, i) => `<li><button class="tq-choice ${f.cls(i)}" ${f.attr} data-v="${i}" ${f.dis ? "disabled" : ""}><span class="tq-n">${i + 1}</span><span class="tq-t">${f.label ? f.label(i) : esc(o)}</span></button></li>`).join("") + `</ul>`;
  const exp = (inner, ans) => `<div class="tq-exp"><div class="tq-tabs"><button class="is-on" type="button">해설</button></div><div class="tq-exp-box">${inner}${ans ? `<span class="tq-ans">${ans}</span>` : ""}</div></div>`;
  /* o: key, exp(해설이 있나), prev/next(속성 문자열 또는 null), submit({attr,label,dis}), pos, total, omr(번호판 있음), left(앞에 끼울 html) */
  const bar = o => {
    const un = unsureMap()[o.key];
    return `<div class="tq-bar" data-key="${esc(o.key)}"><button class="tq-tool ${un ? "is-on" : ""}" type="button" data-tq="unsure">${I.help}헷갈림</button><button class="tq-tool ${o.exp ? "" : "is-off"}" type="button" data-tq="exp">${I.book}해설</button><button class="tq-tool" type="button" data-tq="pen">${I.pen}펜</button><span class="tq-sp"></span>` +
      (o.left || "") + (o.submit ? (o.prev ? `<button class="tq-nav" type="button" ${o.prev} aria-label="이전">‹</button>` : "") + `<span class="tq-pos ${o.omr ? "is-btn" : ""}" ${o.omr ? 'data-tq="pos"' : ""}>${o.pos}<small> / ${o.total}</small></span><button class="tq-submit" type="button" ${o.submit.attr} ${o.submit.dis ? "disabled" : ""}>${o.submit.label}</button>` :
        `<button class="tq-nav" type="button" ${o.prev || "disabled"} aria-label="이전">‹</button><span class="tq-pos ${o.omr ? "is-btn" : ""}" ${o.omr ? 'data-tq="pos"' : ""}>${o.pos}<small> / ${o.total}</small></span><button class="tq-nav is-next" type="button" ${o.next || "disabled"} aria-label="다음">다음 ›</button>`) + `</div>`;
  };
  const omr = (rows, cur) => `<aside class="tq-omr"><span data-tq="jump" data-n="${rows.filter(r => r.pick === undefined).length}"></span>` +
    rows.map((r, i) => `<div class="tq-omr-row ${i === cur ? "is-now" : ""} ${r.pick === undefined ? "is-todo" : ""}" role="button" tabindex="0" data-a="mqgo" data-v="${i}"><span class="tq-qn">${i + 1}번</span>${Array.from({ length: r.n }, (_, j) => `<i class="${r.pick === j ? "is-on" : ""}">${j + 1}</i>`).join("")}</div>`).join("") + `</aside>`;
  /* 합격 지도와 같은 기준: 모평·수능 해마다 문항 수 순위 — 상위 20% = 별 3 · 다음 30% = 별 2 · 나머지 = 별 1. 자료 없으면 0 */
  let starMap = null;
  const hot = type => {
    if (!starMap) {
      const IDX = window.MYE_INDEX || [], c = {};
      IDX.filter(e => e.k === "모평" || e.k === "수능").forEach(e => e.p.forEach(p => { c[p[2]] = (c[p[2]] || 0) + 1; }));
      const names = Object.keys(c).sort((a, b) => c[b] - c[a]), n = names.length;
      starMap = {};
      names.forEach((k, i) => { starMap[k] = i < Math.max(1, Math.ceil(n * 0.2)) ? 3 : i < Math.ceil(n * 0.5) ? 2 : 1; });
    }
    return starMap[type] || 0;
  };
  /* ── 공용 부품 불러오기 · 화면을 그린 뒤 붙이기 ── */
  let lastKey = null, loading = false;
  const COACH = [
    ["term", ".tq-term", "표시된 개념어를 누르면 뜻이 나와요", "발문의 개념어에 형광 띠가 있어요. 누르면 뜻이 말풍선으로 떠요."],
    ["unsure", '[data-tq="unsure"]', "헷갈린 문제는 표시해 두세요", "아래 줄의 헷갈림을 누르면 이 문제에 표시가 남아요."],
    ["pen", '[data-tq="pen"]', "문제 위에 바로 쓸 수 있어요", "아래 줄의 펜을 누르면 화면에 필기해요. 다시 누르면 끝나요."]
  ];
  function chain() {
    for (const [key, sel, title, text] of COACH) {
      const t = root.querySelector(sel); if (!t) continue;
      if (window.TERA_Q.coach(t, { key, title, text, onDone: () => setTimeout(chain, 250) })) return;
    }
  }
  function load() {
    if (loading) return; loading = true;
    const add = src => new Promise(res => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = res; document.head.appendChild(s); });
    Promise.all([window.TERA_Q ? 0 : add("js/tera-q.js?v=1110p"), window.TERA_PAD ? 0 : add("js/tera-pad.js?v=1111c")]).then(() => { loading = false; after(); });
  }
  function after() {
    const b = root.querySelector(".tq-bar");
    if (!b) { if (lastKey && window.TERA_PAD) { try { TERA_PAD.penHide(); } catch (e) { } } lastKey = null; return; }
    if (!window.TERA_Q || !window.TERA_PAD) { load(); return; }
    if (b.dataset.key !== lastKey) { try { TERA_PAD.penHide(); } catch (e) { } lastKey = b.dataset.key; const pb = b.querySelector('[data-tq="pen"]'); if (pb) pb.classList.remove("is-on"); }
    const w = root.querySelector(".wrap"); if (w) w.classList.toggle("has-omr", !!root.querySelector(".tq-omr"));
    if (window.TNQ && window.TNQ.terms) TERA_Q.terms(window.TNQ.terms);
    (window.TNQ_KEEP || []).forEach(x => { if (x && x.terms) TERA_Q.terms(x.terms); });   // 1110 개념어 파일(terms.js) — diagram.js 가 TNQ 를 비워 따로 모아 둔 것
    root.querySelectorAll('[data-tq="badge"]').forEach(h => { const n = +h.dataset.on; if (n && !h.firstChild) TERA_Q.badge(h, { stars: n }); });
    root.querySelectorAll('[data-tq="tg"]').forEach(h => { if (!h.firstChild) TERA_Q.toggle(h); });
    root.querySelectorAll(".tq-stem, .tq-exp-box").forEach(e => TERA_Q.annotate(e));
    root.querySelectorAll('[data-tq="jump"]').forEach(h => { if (!h.firstChild) TERA_Q.jump(h, { count: +h.dataset.n, onClick: () => { const r = root.querySelector(".tq-omr-row.is-todo"); if (r) r.click(); } }); });
    setTimeout(chain, 400);
  }
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-tq]"); if (!t || !t.closest(".tq-bar")) return;
    const bar = t.closest(".tq-bar"), k = t.dataset.tq;
    if (k === "unsure") { const m = unsureMap(); if (m[bar.dataset.key]) delete m[bar.dataset.key]; else m[bar.dataset.key] = 1; LS.set("dq.unsure", m); t.classList.toggle("is-on", !!m[bar.dataset.key]); }
    else if (k === "exp") { const x = root.querySelector(".tq-exp"); if (x) x.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (k === "pen" && window.TERA_PAD) TERA_PAD.pen({ key: bar.dataset.key, onChange: on => t.classList.toggle("is-on", !!on) });
    else if (k === "pos") { const o = root.querySelector(".tq-omr"); if (o) o.classList.toggle("is-open"); }
  });
  return { prog, meta, choices, exp, bar, omr, hot, after };
})();
window.ENGQ = ENGQ;
function passageView() {
  if (nav.loading) return topBar({ back: 'data-a="back"', title: "지문" }) + `<div class="loading">불러오는 중</div>`;
  if (nav.err) return topBar({ back: 'data-a="back"', title: "지문" }) + `<div class="loading">${esc(nav.err)}</div>`;
  let h = topBar({ back: 'data-a="back"', title: P.src.label, right: esc(P.type) }) + `<div class="wrap">`;
  const act = actSteps(), nx = nextStep();
  h += planBox();
  h += `<div class="steps free">` + act.map((i, n) => {
    const dn = !!st.did[STEP_KEYS[i]];
    return (n ? `<div class="bar ${dn ? "done" : ""}"></div>` : "") + `<button class="st ${dn ? "done" : ""} ${i === st.step ? "on" : ""}" data-a="step" data-v="${i}"><span class="dot">${dn ? "✓" : n + 1}</span><span class="lab">${STEPS[i]}</span></button>`;
  }).join("") + `</div>`;
  if (nx !== undefined) h += `<div class="skiprow"><button class="skipl" data-a="skip">${STEPS[st.step]} 건너뛰기 ›</button></div>`;
  h += [vocabStep, analyze, check, drillChoice, drillMcq, () => drillWrite("arr"), () => drillWrite("wr")][st.step]();
  return h + `</div>`;
}
function planBox() {
  const pl = planOf(st.pid), own = !!LS.get("plan." + st.pid, null), n = actSteps().length;
  let h = `<div class="planb ${st.planOpen ? "open" : ""}"><button class="planh" data-a="plantog"><span>이 지문에서 할 것</span><span class="plann">${n}단계</span><span class="car">${st.planOpen ? "▲" : "▼"}</span></button>`;
  if (st.planOpen) h += `<div class="planc">` + STEP_KEYS.map((k, i) => hasStep(k) ? `<button class="pchip ${pl.includes(k) ? "on" : ""}" data-a="pl" data-v="${k}" aria-pressed="${pl.includes(k)}">${STEPS[i]}</button>` : "").join("") + `</div>
    <div class="planf"><span>이 지문에만 적용돼요.</span><button class="lk" data-a="plandef">다른 지문도 이 구성으로</button>${own ? `<button class="lk" data-a="planreset">기본 구성 쓰기</button>` : ""}</div>`;
  return h + `</div>`;
}

/* ───────── 홈 ───────── */
function attWeek() {
  const a = LS.get("att", {}), now = new Date(), mon = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  let h = `<div class="wk">`;
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i); const k = ymd(d);
    h += `<div class="wd ${k === ymd(now) ? "now" : ""}"><span class="dn">${DOW[d.getDay()]}</span><span class="dot ${a[k] ? "on" : ""}">${a[k] ? "✓" : d.getDate()}</span></div>`;
  }
  return h + `</div>`;
}
function attMonth() {
  const a = LS.get("att", {}), now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
  let h = `<div class="mo"><div class="mh">${m + 1}월</div><div class="mg">` + ["월", "화", "수", "목", "금", "토", "일"].map(x => `<span class="dh">${x}</span>`).join("");
  for (let i = 0; i < lead; i++) h += `<span></span>`;
  for (let d = 1; d <= days; d++) { const k = y + "-" + pad2(m + 1) + "-" + pad2(d); h += `<span class="dd ${a[k] ? "on" : ""} ${k === ymd(now) ? "now" : ""}">${d}</span>`; }
  return h + `</div></div>`;
}
function home() {
  const g = LS.get("grade", 3), n = LS.get("count", 4), ids = todayIds(), done = doneMap();
  const dn = ids.filter(i => done[i]).length, now = new Date(), dw = now.getDay();
  const wk = weekWords(), bad = wrongWords().length, dd = ddayInfo();
  const wkTag = dw === 6 ? "토요일" : dw === 0 ? "일요일" : "주말";
  const ded = nav.dedit;
  return topBar({ sub: "오늘" }) + `<div class="wrap">
  <div class="dline"><span>${dd ? esc(dd.label) || "시험일" : "시험일을 정하면 D-day 가 보여요"}</span><button class="lk" data-a="ddedit">${dd ? "수정" : "날짜 설정"}</button></div>
  <div class="dbig">${dd ? dd.txt : "D-day"}${dd ? `<small>${esc((LS.get("dday", {}) || {}).date || "")}</small>` : ""}</div>
  ${ded ? `<div class="card"><div class="muted">D-day 이름</div><input id="dl" class="inp" value="${esc((LS.get("dday", {}) || {}).label || "")}" placeholder="수능">
    <div class="muted" style="margin-top:8px">날짜</div><input id="dd" type="date" class="inp" value="${esc((LS.get("dday", {}) || {}).date || "")}">
    <div class="row"><button class="btn pri" data-a="ddsave">저장</button><button class="btn ghost" data-a="ddclear">삭제</button></div></div>` : ""}
  ${readyGrade(g) !== g ? `<div class="muted">고${g} 지문은 아직 열리지 않아 고${readyGrade(g)} 지문으로 학습합니다.</div>` : ""}
  <section class="todayc"><h3>오늘 ${fmtMin(dPerMin())} · ${ids.length || n}지문</h3><p class="tsum">${dn} / ${ids.length || n} 완료 · ${scopeOn() ? "내 시험 범위 " + scopeN() + "지문에서" : "고" + g + " 기준"}</p>
  <div class="plist">` + ids.map((id, k) => {
    const it = PIDX[id], s = statusOf(id), now1 = !done[id] && ids.findIndex(x => !done[x]) === k;
    return `<button class="stp ${now1 ? "now" : ""} ${done[id] ? "done" : ""}" data-a="open" data-v="${id}"><span class="n">${done[id] ? "✓" : k + 1}</span><span class="tx"><b>${esc(it.e.n)} ${esc(it.p[1])}번</b><span>${esc(it.p[2])}</span></span><span class="m">${s.t}</span></button>`;
  }).join("") + `</div>
  <button class="btn pri full" data-a="open" data-v="${ids.find(x => !done[x]) || ids[0] || ""}" ${ids.length ? "" : "disabled"}>시작</button></section>
  <div class="stat2"><div class="card"><b>${Object.keys(done).length}</b><span>완료 지문</span></div><div class="card"><b>${streakDays()}</b><span>연속 출석일</span></div></div>
  <div class="card zsrow"><button class="li" data-a="tab" data-v="scope"><span>내 시험 범위${scopeN() ? ` <small class="lin">${scopeN()}지문${scopeOn() ? " · 오늘 지문에 반영 중" : ""}</small>` : ` <small class="lin">내신 범위의 회차 · 문항만 담기</small>`}</span></button></div>
  <div class="card zsrow"><button class="li" data-zs="1"><span>합격 전략</span></button></div>
  <h3>이번 주 출석</h3>${attWeek()}${attMonth()}
  <div class="card"><h3 style="margin-top:0">주말 단어 테스트</h3>
    <div class="row" style="margin:0"><span class="pill r">${wkTag}</span><span>이번 주 단어 ${wk.length}${bad ? " + 복습 단어 " + bad : ""}</span></div>
    <div class="row"><button class="btn pri" data-a="wstart" ${wk.length + bad < 2 ? "disabled" : ""}>테스트</button></div></div>
  ${settingsCard(g, n)}
  </div>`;
}

/* ───────── 합격 지도 (화면표준 11절): 줄 = 기출 유형 · 문법 · 서술형 · 단어. 어댑터 js/eng-map.js ───────── */
const RECP = `<span class="recp">추천</span>`;
function mapView() {
  return topBar({ sub: "합격 지도" }) + `<div class="wrap mapw"><div id="emap" class="emap"></div></div>`;
}
function mountMap() {
  const host = document.getElementById("emap"); if (!host) return;
  const go = () => window.ENGMAP && window.ENGMAP.mount(host);
  if (window.ENGMAP) return go();
  const sc = document.createElement("script"); sc.src = "js/eng-map.js?v=1110p"; sc.onload = go; document.head.appendChild(sc);
}
/* ───────── 드릴: 문법 드릴 · 서술형 드릴 ───────── */
function drillHub() {
  return topBar({ sub: "드릴" }) + `<div class="wrap"><h2>드릴</h2><div class="plist">
    <button class="it" data-a="tab" data-v="gram"><span class="tt">문법 드릴</span>${RECP}</button>
    <button class="it" data-a="tab" data-v="writ"><span class="tt">서술형 드릴</span></button></div></div>`;
}

/* ───────── 기출 탐색: 학년 → 연도 → 회차 → 번호 ───────── */
function cnt(list) { let r = 0, t = 0; list.forEach(e => e.p.forEach(p => { t++; r += p[3]; })); return [r, t]; }
function explore() {
  const ex = nav.ex;
  let h = topBar({ sub: "기출" }) + `<div class="wrap">`;
  const crumb = [];
  if (ex.g) crumb.push(`고${ex.g}`); if (ex.y) crumb.push(ex.y + "학년도");
  if (ex.u) { const e = INDEX.find(x => x.u === ex.u); crumb.push(e ? e.n : ""); }
  if (crumb.length) h += `<div class="crumb"><button data-a="exback">‹</button>${esc(crumb.join(" / "))}</div>`;
  else h += `<div class="card zsrow"><button class="li" data-a="tab" data-v="scope"><span>내 시험 범위 <small class="lin">${scopeN() ? scopeN() + "지문 담음" : "회차를 열고 문항 오른쪽 동그라미를 누르면 담겨요"}</small></span></button></div><h2>학년</h2>`;
  if (ex.g && !ex.u && !cnt(INDEX.filter(e => e.g === ex.g))[0]) h += `<div class="muted" style="margin:10px 0">고${ex.g} 지문은 아직 열리지 않았습니다.</div>`;
  const badge = ([r, t]) => `<span class="pill ${r ? "g" : ""}">${r} / ${t}</span>`;
  const dn0 = doneMap(), open0 = list => list.some(e => e.p.some(p => p[3] && !dn0[p[0]]));
  if (!ex.g) {
    h += `<div class="plist">` + [1, 2, 3].map(g => `<button class="it" data-a="exg" data-v="${g}"><span class="tt">고${g}</span>${g === readyGrade(LS.get("grade", 3)) ? RECP : ""}${badge(cnt(INDEX.filter(e => e.g === g)))}</button>`).join("") + `</div>`;
  } else if (!ex.y) {
    const ys = [...new Set(INDEX.filter(e => e.g === ex.g).map(e => e.y))].sort((a, b) => b - a);
    const yr = ys.find(y => open0(INDEX.filter(e => e.g === ex.g && e.y === y)));
    h += `<div class="plist">` + ys.map(y => `<button class="it" data-a="exy" data-v="${y}"><span class="tt">${y}학년도</span>${y === yr ? RECP : ""}${badge(cnt(INDEX.filter(e => e.g === ex.g && e.y === y)))}</button>`).join("") + `</div>`;
  } else if (!ex.u) {
    const es = INDEX.filter(e => e.g === ex.g && e.y === ex.y).sort((a, b) => b.mo - a.mo);
    const eu = es.find(e => open0([e]));
    h += `<div class="plist">` + es.map(e => `<button class="it" data-a="exu" data-v="${e.u}"><span class="tt">${esc(e.n)}</span>${eu && e.u === eu.u ? RECP : ""}${badge(cnt([e]))}</button>`).join("") + `</div>`;
  } else {
    const e = INDEX.find(x => x.u === ex.u), done = doneMap(), sc = scopeMap();
    const np = e.p.find(p => p[3] && !done[p[0]]);
    const rd = e.p.filter(p => p[3]), inN = rd.filter(p => sc[p[0]]).length;
    if (rd.length) h += `<div class="scbar"><span>시험 범위에 <b>${inN}</b> / ${rd.length}문항</span><button class="lk" data-a="scall" data-v="${e.u}">${inN === rd.length ? "모두 빼기" : "이 회차 모두 담기"}</button><button class="lk" data-a="tab" data-v="scope">내 시험 범위</button></div>`;
    h += `<div class="plist">` + e.p.map(p => p[3]
      ? `<div class="itw ${sc[p[0]] ? "insc" : ""}"><button class="it ${done[p[0]] ? "done" : ""}" data-a="open" data-v="${p[0]}" data-back="explore"><span class="no">${esc(p[1])}</span><span class="tt">${esc(p[2])}${(WRHOT[p[0]] || [])[0] ? `<span class="whot">서술형 강추</span>` : ""}</span>${np && p[0] === np[0] ? RECP : ""}<span class="pill ${statusOf(p[0]).c}">${statusOf(p[0]).t}</span></button><button class="scb ${sc[p[0]] ? "on" : ""}" data-a="sc" data-v="${p[0]}" aria-pressed="${!!sc[p[0]]}" aria-label="시험 범위에 ${sc[p[0]] ? "담김" : "담기"}">${sc[p[0]] ? "✓" : ""}</button></div>`
      : `<div class="it off"><span class="no">${esc(p[1])}</span><span class="tt">${esc(p[2])}</span><span class="pill">준비 중</span></div>`).join("") + `</div>`;
  }
  return h + `</div>`;
}
function scopeView() {
  const sc = scopeMap(), done = doneMap(), on = scopeOn(), only = !!nav.schot;
  let h = topBar({ back: 'data-a="tab" data-v="explore"', title: "내 시험 범위", right: scopeN() + "지문" }) + `<div class="wrap">`;
  if (!scopeN()) return h + `<h2>내 시험 범위</h2><div class="muted">학교 시험에 들어가는 회차와 문항만 골라 담으세요. 기출에서 회차를 열고 문항 오른쪽 동그라미를 누르면 담깁니다.</div><div class="row"><button class="btn pri full" data-a="tab" data-v="explore">기출에서 고르기</button></div></div>`;
  h += `<div class="card"><h3 style="margin-top:0">오늘 지문</h3><div class="seg"><button class="${on ? "on" : ""}" data-a="scon" data-v="1">시험 범위에서 내기</button><button class="${on ? "" : "on"}" data-a="scon" data-v="0">학년 기준으로 내기</button></div>
    <div class="seg" style="margin-top:10px"><button class="${only ? "" : "on"}" data-a="schot" data-v="0">전체</button><button class="${only ? "on" : ""}" data-a="schot" data-v="1">서술형 강추만</button></div></div>`;
  INDEX.forEach(e => {
    const ps = e.p.filter(p => sc[p[0]] && p[3] && (!only || (WRHOT[p[0]] || [])[0])); if (!ps.length) return;
    h += `<h3>${esc(e.n)} <small class="lin">${ps.length}문항</small></h3><div class="plist">` + ps.map(p =>
      `<div class="itw insc"><button class="it ${done[p[0]] ? "done" : ""}" data-a="open" data-v="${p[0]}" data-back="scope"><span class="no">${esc(p[1])}</span><span class="tt">${esc(p[2])}${(WRHOT[p[0]] || [])[0] ? `<span class="whot">서술형 강추</span>` : ""}</span><span class="pill ${statusOf(p[0]).c}">${statusOf(p[0]).t}</span></button><button class="scb on" data-a="sc" data-v="${p[0]}" aria-pressed="true" aria-label="시험 범위에서 빼기">✓</button></div>`).join("") + `</div>`;
  });
  return h + `<div class="row"><button class="btn ghost full" data-a="tab" data-v="explore">회차 · 문항 더 담기</button></div></div>`;
}

/* ───────── 단어장 · 기록 ───────── */
function wordsTab() {
  const all = LS.get("words", {}), wr = LS.get("wrong", {}), wk = weekWords();
  const keys = Object.keys(all).sort();
  let h = topBar({ sub: "단어장 " + keys.length }) + `<div class="wrap">`;
  { const kn = LS.get("know", {}), kv = Object.values(kn); if (kv.length) h += `<div class="stat2"><div class="card"><b>${kv.filter(x => x === 1).length}</b><span>아는 단어</span></div><div class="card"><b>${kv.filter(x => x === 0).length}</b><span>외울 단어</span></div></div>`; }
  if (wk.length) h += `<h2>이번 주</h2>` + wk.map(w => `<div class="wbox">${wline(w)}</div>`).join("");
  if (!keys.length) h += `<div class="muted" style="margin-top:18px">아직 모은 단어가 없습니다.</div>`;
  { const nw = dayWordsN(); h += `<div class="row"><button class="btn pri full" data-a="${nw ? "wstart" : "tab"}" data-v="${nw ? "" : "home"}">${nw ? "단어 테스트" : "오늘"}</button></div>`; }
  const bad = wrongWords();
  if (bad.length) h += `<h2>복습 단어</h2>` + bad.map(w => `<div class="wbox">${wline(w)}<span class="ct pill r">${wr[w.en]}회</span></div>`).join("");
  if (keys.length) h += `<h2>전체</h2>` + keys.map(k => `<div class="wbox">${wline(Object.assign({ en: k }, all[k]))}</div>`).join("");
  return h + `</div>`;
}
function recTab() {
  const done = doneMap(), ids = Object.keys(done).sort((a, b) => done[b] - done[a]);
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(ymd(d)); }
  const per = {}; ids.forEach(id => { const k = ymd(new Date(done[id])); per[k] = (per[k] || 0) + 1; });
  const mx = Math.max(1, ...days.map(d => per[d] || 0));
  const nx = todayIds().find(x => !done[x]);
  let h = topBar({ sub: "기록 · 완료 " + ids.length }) + `<div class="wrap"><div class="row"><button class="btn pri full" data-a="${nx ? "open" : "tab"}" data-v="${nx || "home"}">${nx ? "시작" : "오늘"}</button></div><h2>최근 14일</h2>
    <div class="bars">${days.map(d => `<div style="height:${Math.round((per[d] || 0) / mx * 100)}%" title="${d}"></div>`).join("")}</div>
    <div class="row" style="justify-content:space-between;margin:0"><span class="muted">${days[0].slice(5)}</span><span class="muted">${days[13].slice(5)}</span></div>`;
  if (ids.length) h += `<h2>완료</h2><div class="plist">` + ids.map(id => { const it = PIDX[id]; return `<button class="it" data-a="open" data-v="${id}"><span class="tt">${it ? esc(it.e.n) + " " + esc(it.p[1]) + "번" : esc(id)}<span class="sub">${it ? esc(it.p[2]) : ""} → ${ymd(new Date(done[id]))}</span></span></button>`; }).join("") + `</div>`;
  return h + `</div>`;
}

/* ───────── 1 단어 (지문 단어 · 주말 테스트 공용) ───────── */
function curV() { return nav.tab === "wtest" ? WT : st.voc; }
function curWords() { return nav.tab === "wtest" ? WT.words : st.voc.words; }
const dockNext = () => `<div class="row dock"><button class="btn pri" data-a="nxt">${nextLabel()}</button></div>`;
/* 고른 단어 = 외울 단어(0), 안 고른 단어 = 아는 단어(1). know = { 원형: 0|1 } */
function recordKnow() {
  const v = st.voc, k = LS.get("know", {}); P.words.forEach((w, i) => { k[w.b || w.en] = v.sel[i] ? 0 : 1; }); LS.set("know", k);
  if (window.RESEARCH && RESEARCH.log) { try { RESEARCH.log("word_pick", { pid: P.id, pick: P.words.filter((w, i) => v.sel[i]).map(w => w.b || w.en), know: P.words.filter((w, i) => !v.sel[i]).map(w => w.b || w.en) }); } catch (e) { } }
}
function vocabStep() {
  const v = st.voc;
  if (!P.words.length) return `<h2>단어</h2><div class="muted">고${LS.get("grade", 3)} 기준 새로 익힐 단어 없음</div>` + dockNext();
  if (v.phase === "list") {
    const n = Object.keys(v.sel).length;
    return `<h2>외울 단어 고르기</h2><div class="muted">모르는 단어만 누르세요. 고른 단어만 시험 봐요.</div>
    <div class="vbar"><span><b>${n}</b> / ${P.words.length} 고름</span><button class="lk" data-a="vall">${n === P.words.length ? "모두 풀기" : "모두 고르기"}</button></div>
    <div class="wlist pickw">` + P.words.map((w, i) => `<button class="w ${v.sel[i] ? "sel" : ""}" data-a="vsel" data-v="${i}" aria-pressed="${!!v.sel[i]}"><span class="ckb">${v.sel[i] ? "✓" : ""}</span>${wline(w)}</button>`).join("") + `</div>
    <div class="row dock"><button class="btn pri" data-a="vstart" ${n ? "" : "disabled"}>${n ? "고른 " + n + "개 시험" : "외울 단어를 고르세요"}</button><button class="btn ghost" data-a="vdone">${n ? "시험 건너뛰기" : "다 아는 단어예요"}</button></div>`;
  }
  if (v.phase === "done") return `<h2>단어 끝</h2><div class="muted">${v.words.length ? "외울 단어 " + v.words.length + "개는 단어장에 담았어요." : "외울 단어 없음"}${v.queue.length ? " 시험 오답 " + v.wrong + "회" : ""}</div><div class="row"><button class="btn ghost" data-a="vagain">다시 고르기</button></div>` + dockNext();
  return vocabQ(v, curWords()) + `<div class="skiprow"><button class="skipl" data-a="vquit">시험 그만하기 ›</button></div>`;
}
function vocabQ(v, W) {
  const w = W[v.queue[v.cur]], left = v.queue.length - v.cur;
  return `<div style="margin-top:14px">${blocks(v.queue.length, i => i < v.cur, v.cur)}</div><div class="muted" style="margin-top:6px">남은 ${left}</div><div class="qword">${esc(w.en)}</div>
  <div class="opts" style="margin-top:22px">` + v.opts.map((o, i) => {
    let c = ""; if (v.pick !== null) { if (o === w.ko) c = "ok"; else if (i === v.pick) c = "no"; }
    return `<button class="opt ${c}" data-a="vpick" data-v="${i}" ${v.pick !== null ? "disabled" : ""}>${esc(o)}</button>`;
  }).join("") + `</div>${v.pick !== null ? `<div class="row dock"><button class="btn pri" data-a="vnext">다음</button></div>` : ""}`;
}
function vMakeOpts(v, W) {
  const w = W[v.queue[v.cur]];
  /* 고른 단어가 적어도 보기 네 개가 나오게, 지문 단어 전체에서 오답 보기를 채운다 */
  const pool = nav.tab === "p" ? W.concat(P.wordsAll) : W;
  const others = shuffle([...new Set(pool.filter(x => x.en !== w.en && x.ko !== w.ko).map(x => x.ko))]).slice(0, 3);
  v.opts = shuffle([w.ko, ...others]); v.pick = null;
}
function vStart(v, W) { v.phase = "test"; v.queue = shuffle(W.map((w, i) => i)); v.cur = 0; v.wrong = 0; v.first = {}; vMakeOpts(v, W); }
function vPick(v, W, i) {
  const wi = v.queue[v.cur], w = W[wi]; v.pick = i;
  if (v.opts[i] !== w.ko) {
    v.wrong++; v.queue.push(wi); v.first[wi] = false;
    const wr = LS.get("wrong", {}); wr[w.en] = (wr[w.en] || 0) + 1; LS.set("wrong", wr);
  } else if (v.first[wi] === undefined) v.first[wi] = true;
}
function vNext(v, W) {
  v.cur++;
  if (v.cur >= v.queue.length) {
    v.phase = "done";
    const wr = LS.get("wrong", {});
    if (nav.tab === "wtest") { W.forEach((w, k) => { if (v.first[k] && wr[w.en]) delete wr[w.en]; }); LS.set("wrong", wr); }
    return true;
  }
  vMakeOpts(v, W); return false;
}
function wtestView() {
  const v = WT;
  let h = topBar({ back: 'data-a="tab" data-v="home"', title: "주말 단어 테스트", right: v.words.length + "개" }) + `<div class="wrap">`;
  if (v.phase === "list") h += `<h2>단어 ${v.words.length}</h2><div class="wlist">` + v.words.map(w => `<div class="w">${wline(w)}</div>`).join("") + `</div><div class="row dock"><button class="btn pri" data-a="vstart">테스트</button></div>`;
  else if (v.phase === "done") h += `<h2>통과</h2><div class="muted">오답 ${v.wrong}회</div><div class="row"><button class="btn pri" data-a="tab" data-v="home">오늘</button></div>`;
  else h += vocabQ(v, v.words);
  return h + `</div>`;
}

/* ───────── 2 분석 ───────── */
const AN_STEP = ["원문", "수식어 괄호", "S + V", "해석 + 문법"];
function bgCard() {
  const g = P.bg, open = !!st.an.bg;
  return `<div class="bgc"><button class="bgh" data-a="bgtog"><span>배경지식</span><span class="bgt">${esc(g.t)}</span><span class="car">${open ? "▲" : "▼"}</span></button>` +
    (open ? `<div class="bgb">` + (window.DIAGRAM && window.DOSIK && DOSIK.english && DOSIK.english[P.id] ? /* 도식(2026-10-26 「모든 과목 개념을 도식으로」) — 배경지식 요약을 도식으로, 원문은 접는다 */ DOSIK.english[P.id].map(DIAGRAM.html).join("") + `<details class="bgsrc"><summary>원문</summary><div class="bgs concept-bgs">${esc(g.s)}</div></details>` : `<div class="bgs concept-bgs">${esc(g.s)}</div>`) + ((g.k || []).length ? `<div class="chips">` + g.k.map(c => `<span class="chip"><b>${esc(c.en)}</b> ${esc(c.ko)}<span class="cd">${esc(c.d)}</span></span>`).join("") + `</div>` : "") + `</div>` : "") + `</div>`;
}
function analyze() {
  const a = st.an, N = P.sentences.length, hot = WRHOT[P.id] || [], seenN = Object.keys(a.seen).length;
  let h = (P.bg ? bgCard() : "") + `<div class="fph"><h2>지문</h2><span class="muted">분석할 문장을 누르세요 · ${seenN} / ${N} 봄</span></div><div class="fullp">`;
  P.sentences.forEach((s, i) => {
    h += `<span class="sb ${i === a.si ? "on" : ""} ${a.seen[i] ? "seen" : ""}" role="button" tabindex="0" data-a="sen" data-v="${i}" aria-pressed="${i === a.si}"><sup>${i + 1}</sup>${esc(s.t)}${hot[2] === i ? `<em class="shot">서술형 강추</em>` : ""}</span> `;
    if (i === a.si) h += anPanel(i);
  });
  return h + `</div>` + dockNext();
}
function anPanel(si) {
  const a = st.an, s = P.sentences[si], k = a.k, N = P.sentences.length;
  const hl = a.note >= 0 && s.notes[a.note] ? range(s.notes[a.note][0], s.notes[a.note][1]) : [];
  let h = `<div class="anp"><div class="anh"><span class="pill g">문장 ${si + 1} / ${N}</span><span class="sp"></span><button class="anx" data-a="senx" aria-label="분석 닫기">×</button></div>
    <div class="seg an4">` + AN_STEP.map((n, i) => `<button class="${i === k ? "on" : ""}" data-a="ank" data-v="${i}">${n}</button>`).join("") + `</div>`;
  h += renderSent(si, { brackets: k >= 1, sv: k >= 2, lab: true, hl });
  if (k >= 1) h += `<div class="legend"><b>( )</b> 수식어 &nbsp; <b>[ ]</b> 명사절</div>`;
  if (k >= 2 && (s.frag || (s.main.length && !s.main[0].s.h.length))) h += `<div class="muted" style="margin-top:6px">${s.frag ? "S V 없음 → 단편" : "명령문 → S 생략"}</div>`;
  if (k >= 3) h += `<div class="ko passage-ko">${esc(s.ko)}</div>` + (s.notes.length ? `<ul class="notes">` + s.notes.map((n, i) => `<li class="${i === a.note ? "on" : ""}" data-a="note" data-v="${i}"><span class="n">${i + 1}</span><span><span class="k">${esc(n[2])}</span><br>${esc(n[3])}</span></li>`).join("") + `</ul>` : "");
  return h + `<div class="row"><button class="btn ghost" data-a="senmv" data-v="-1" ${si ? "" : "disabled"}>이전 문장</button><button class="btn ghost" data-a="senmv" data-v="1" ${si < N - 1 ? "" : "disabled"}>다음 문장</button></div></div>`;
}

/* ───────── 3 확인 ───────── */
function check() {
  const c = st.ck;
  if (c.i >= P.checks.length) return `<h2>확인 끝</h2><div class="today"><b>${c.score} / ${P.checks.length}</b><span class="muted">첫 시도 정답</span></div>` + dockNext();
  const q = P.checks[c.i];
  let h = `<div style="margin-top:14px">${ENGQ.prog(c.i, P.checks.length)}</div>`;
  if (q.type === "sv") {
    const s = P.sentences[q.si], n = s.main.length, marks = {}, labels = {}, ends = {};
    ["S", "V"].forEach(k => c.found[k].forEach(ci => { const hh = s.main[ci][k.toLowerCase()].h; if (!hh.length) return; range(Math.min(...hh), Math.max(...hh)).forEach(i => marks[i] = k); labels[hh[0]] = labels[hh[0]] ? labels[hh[0]] + " " + k : k; ends[hh[0]] = Math.max(ends[hh[0]] ?? 0, Math.max(...hh)); }));
    h += `<p class="tq-stem">${c.ph === "done" ? "주절 S + V" : "주절의 " + (c.ph === "S" ? "주어(S)" : "동사(V)") + " 누르기"}${n > 1 && c.ph !== "done" ? ` <span class="pill">${c.found[c.ph].length} / ${n}</span>` : ""}</p>`;
    h += renderSent(q.si, { pick: true, marks, labels, ends, lab: true, pop: c.pop, bad: c.flash != null ? [c.flash] : [] });
    h += `<div class="msg ${c.ok ? "ok" : "no"}">${c.msg}</div>`;
    if (c.ph !== "done") {
      h += `<div class="muted">명사절 주어 → 절 안 아무 단어</div>`;
      h += `<div class="row">${c.miss >= 2 ? `<button class="btn ghost" data-a="svshow">정답 보기</button>` : ""}<button class="btn ghost" data-a="cknext">이 문제 넘기기</button></div>`;
    } else h += `<div class="row dock"><button class="btn pri" data-a="cknext">다음</button></div>`;
  } else {
    const done = c.pick !== null;
    h += ENGQ.meta(`${c.i + 1}번 문제`) + `<p class="tq-stem">${esc(q.q)}</p>` + renderSent(q.si, { hl: range(q.r[0], q.r[1]) });
    h += `<div style="height:18px"></div>` + ENGQ.choices(q.o, { attr: 'data-a="ckpick"', dis: done, cls: i => done ? (i === q.a ? "is-ok" : i === c.pick ? "is-no" : "") : "" });
    if (done) h += ENGQ.exp(esc(q.why), `정답 : ${q.a + 1}번`);
    h += ENGQ.bar({ key: P.id + "/c" + c.i, exp: done, next: 'data-a="cknext"', pos: c.i + 1, total: P.checks.length });
  }
  return h;
}

/* ───────── 4 양자택일 ───────── */
function drillChoice() {
  const d = st.dr, C = P.choice, tot = C.items.length, chosen = Object.keys(d.ch).length;
  let h = `<div style="margin-top:14px">${ENGQ.prog(d.graded ? tot : chosen, tot)}</div>` + ENGQ.meta("양자택일") + `<p class="tq-stem">어법 + 어휘 선택</p><div class="passage">`;
  h += esc(C.text).replace(/\{(\d+)\}/g, (_, n) => {
    n = +n; const it = C.items[n], sel = d.ch[n];
    const cl = d.graded ? (sel === it.a ? "ok" : "no") : "";
    return `<span class="ch ${cl}"><span class="num">${n + 1}</span>` + it.o.map((o, i) => `<button class="${sel === i ? "sel" : ""}" data-a="ch" data-n="${n}" data-v="${i}">${esc(o)}</button>`).join("") + `</span>`;
  });
  h += `</div>`;
  if (!d.graded) h += ENGQ.bar({ key: P.id + "/ch", exp: false, submit: { attr: 'data-a="chgrade"', label: "제출" }, pos: chosen, total: tot });
  else {
    const sc = C.items.filter((it, n) => d.ch[n] === it.a).length;
    h += ENGQ.exp(`<b>${sc} / ${tot}</b>` + C.items.map((it, n) => {
      const right = d.ch[n] === it.a;
      return `<div class="exp"><span class="pill ${right ? "g" : "r"}">${n + 1} ${esc(it.k)}</span> ${it.o.filter((o, i) => i !== it.a).map(o => `<del>${esc(o)}</del>`).join(" ")} <ins>${esc(it.o[it.a])}</ins><br>${esc(it.why)}</div>`;
    }).join(""));
    h += ENGQ.bar({ key: P.id + "/ch", exp: true, left: `<button class="tq-nav" type="button" data-a="chreset" aria-label="다시">↺</button>`, submit: { attr: 'data-a="nxt"', label: nextLabel() }, pos: sc, total: tot });
  }
  return h;
}

/* ───────── 5 유형: 원 기출 문항 먼저, 이어서 변형 ───────── */
function questions() { return P.orig.map(o => ({ orig: true, ...o })).concat(P.mcq.map(m => ({ orig: false, ...m }))); }
function markPassage(text, ul) {
  const re = /([①-⑤])|\(([a-e])\)/g;
  let out = "", pos = 0, k = 0, m;
  const hasUl = ul && ul.length;
  while ((m = re.exec(text))) {
    out += esc(text.slice(pos, m.index)) + `<b class="mk">${esc(m[0])}</b>`;
    pos = m.index + m[0].length;
    if (hasUl && ul[k] && text.startsWith(ul[k], pos)) { out += `<u>${esc(ul[k])}</u>`; pos += ul[k].length; }
    k++;
  }
  return out + esc(text.slice(pos));
}
function origPassage(q) {
  let h = "";
  if (q.blocks) {
    if (q.head) h += `<div class="box stem-box">${esc(q.head)}</div>`;
    h += Object.keys(q.blocks).map(k => `<p>${q.head ? `<span class="olab">(${k})</span> ` : ""}${markPassage((q.head ? "" : "(" + k + ") ") + q.blocks[k], q.ul)}</p>`).join("");
  } else if (q.type === "삽입") {
    h += `<div class="box stem-box">${esc(q.given || "")}</div><div class="box stem-box">${markPassage(q.p || "", null)}</div>`;
  } else if (q.type === "빈칸") {
    h += `<div class="box stem-box">${esc(q.p || "").replace(/_{2,}/g, `<span class="blank"></span>`)}</div>`;
  } else if (q.type === "요약") {
    h += `<div class="box stem-box">${esc(q.p || "")}</div><div style="text-align:center;font-weight:800">↓</div><div class="box stem-box">${esc(q.sum || "").replace(/\(([AB])\)/g, "<b>($1)</b>")}</div>`;
  } else h += `<div class="box stem-box">${markPassage(q.p || "", q.ul)}</div>`;
  if (q.note) h += `<div class="note-small">${esc(q.note)}</div>`;
  return h;
}
function passageHtml(q) {
  const kind = q.p, S = P.sentences.map(s => esc(s.t));
  if (kind === "full") return `<div class="box stem-box">${S.join(" ")}</div>`;
  if (kind === "blank") {
    const b = q.blank, T = toks(P, b.si), last = T[b.to], punct = (last.match(/[,.;:?!”’"')]*$/) || [""])[0];
    const post = T.slice(b.to + 1).join(" ");
    return `<div class="box stem-box">${S.slice(0, b.si).join(" ")} ${esc(T.slice(0, b.from).join(" "))} <span class="blank"></span>${esc(punct)}${post ? " " + esc(post) : ""} ${S.slice(b.si + 1).join(" ")}</div>`;
  }
  if (kind === "order") {
    const O = q.order, j = a => a.map(i => S[i]).join(" ");
    return `<div class="box stem-box">${j(O.given)}</div>` + ["A", "B", "C"].map(k => `<p><span class="olab">(${k})</span> ${j(O[k])}</p>`).join("");
  }
  if (kind === "summary") return `<div class="box stem-box">${S.join(" ")}</div><div style="text-align:center;font-weight:800">↓</div><div class="box stem-box">${esc(q.summary).replace(/\(([AB])\)/g, "<b>($1)</b>")}</div>`;
  return "";
}
function optLabel(q, i) {
  const t = String(q.o[i]);
  if (/^\(?[a-e]\)?$/.test(t) || /^[①-⑤]/.test(t) || q.type === "무관한문장") return /^[①-⑤]/.test(t) ? esc(t) : (q.type === "무관한문장" ? CIRC[i] : esc(t));
  return CIRC[i] + " " + esc(t);
}
function optText(q, i) {
  const t = String(q.o[i]);
  if (q.type === "무관한문장") return CIRC[i];
  return esc(t.replace(/^[①-⑤]\s*/, "")) || CIRC[i];
}
/* 테라에이전트: 이 지문이 어떤 문제로 나오기 좋은지(풀기 전 · 답은 가린다), 변형 문제가 왜 그렇게 만들어졌는지(푼 뒤). 지문 분석 자료에서 조립한다 */
const LINKW = /^(However|But|Yet|Still|Instead|Therefore|Thus|So|Hence|Consequently|As a result|For example|For instance|In fact|Indeed|Moreover|Furthermore|In addition|Also|Similarly|Likewise|In contrast|By contrast|On the contrary|On the other hand|Nevertheless|Nonetheless|Otherwise|Then|Finally|In other words|That is|This|These|That|Those|Such|It|They|He|She)\b/;
const linkOf = si => { const m = P.sentences[si].t.match(LINKW); return m ? m[1] : ""; };
const posWord = si => si === 0 ? "글을 여는 첫 문장" : si === P.sentences.length - 1 ? "글을 맺는 마지막 문장" : `${P.sentences.length}문장 가운데 ${si + 1}번째 문장`;
function topGram(n) { const c = {}; P.sentences.forEach(s => s.notes.forEach(x => { c[x[2]] = (c[x[2]] || 0) + 1; })); return Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, n); }
function agentCard() {
  const d = st.dr, open = d.ag !== false, rows = [], seen = {};
  rows.push(["원 기출", `${esc(P.type)} 문제로 나왔던 지문이에요.`]);
  P.mcq.forEach(m => {
    if (seen[m.k]) return; seen[m.k] = 1;
    if (m.p === "blank") rows.push(["빈칸", `빈칸 자리는 ${posWord(m.blank.si)}. ${m.blank.si === P.sentences.length - 1 ? "앞 내용을 한데 모으는 자리라 빈칸으로 자주 가려요." : m.blank.si === 0 ? "뒤 문장들이 이 문장을 풀어 주니, 뒤에서 단서를 찾으세요." : "바로 앞뒤 문장이 단서가 되는 자리예요."}`]);
    else if (m.p === "order") { const L = P.sentences.map((s, i) => i ? linkOf(i) : "").filter(Boolean); rows.push(["순서", L.length ? `연결어 · 지시어로 시작하는 문장이 ${L.length}개(${esc([...new Set(L)].slice(0, 4).join(", "))}). 이런 글은 순서 · 삽입으로 내기 좋아요.` : "문장 첫머리에 연결어가 거의 없는 글이에요. 내용이 이어지는 흐름으로 순서를 잡아야 해요."]); }
    else if (m.p === "summary") rows.push(["요약", `${P.sentences.length}문장이 한 가지 주장으로 모이는 글이라 한 문장 요약으로 바꿔 냈어요. 빈칸 두 곳은 글에서 되풀이되는 핵심어를 다른 말로 바꾼 자리예요.`]);
    else rows.push([m.k, `원 기출은 ${esc(P.type)}. 같은 글의 중심 생각을 ${esc(m.k)} 문제로 바꿔 물어요.`]);
  });
  const C = P.choice && P.choice.items || [], gk = {}; C.forEach(it => { gk[it.k] = (gk[it.k] || 0) + 1; });
  if (C.length) rows.push(["어법 · 어휘", Object.keys(gk).map(k => `${esc(k)} ${gk[k]}곳`).join(" · ") + `이 바뀌어 나올 수 있어요.${topGram(3).length ? " 이 지문의 문법 포인트: " + esc(topGram(3).join(", ")) : ""}`]);
  const hot = WRHOT[P.id];
  if (hot && hot[2] !== undefined) rows.push(["서술형", `${hot[2] + 1}번째 문장(${esc(hot[3])})이 서술형으로 내기 좋아요.`]);
  return `<div class="agc ${open ? "open" : ""}"><button class="agh" data-a="agtog"><span class="agm">테</span><b>테라에이전트</b><span class="agt">이 지문은 이렇게 나와요</span><span class="car">${open ? "▲" : "▼"}</span></button>` +
    (open ? `<dl class="agl">` + rows.map(r => `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join("") + `</dl>` : "") + `</div>`;
}
/* 푼 뒤: 이 변형 문제가 왜 이렇게 만들어졌나 */
function whyMade(q) {
  if (q.orig) return "";
  if (q.p === "blank") {
    const b = q.blank, T = toks(P, b.si), ph = T.slice(b.from, b.to + 1).join(" ").replace(/[,.;:?!]+$/, "");
    const lab = P.sentences[b.si].notes.filter(n => n[0] <= b.to && n[1] >= b.from).map(n => n[2]);
    return `가린 곳은 ${posWord(b.si)}의 「${esc(ph)}」.` + (lab.length ? ` 이 구절에 걸린 문법: ${esc(lab.slice(0, 2).join(", "))}. 어법 · 서술형으로도 나올 수 있어요.` : "");
  }
  if (q.p === "order") {
    const O = q.order, seq = (String(q.o[q.a]).match(/[ABC]/g) || []);
    const cue = seq.map(k => { const l = linkOf(O[k][0]); return `(${k}) ${l ? "첫머리 " + esc(l) : "연결어 없음"}`; });
    return `주어진 글 뒤를 세 덩어리로 끊어 섞었어요. 단서: ${cue.join(" → ")}.`;
  }
  if (q.p === "summary") return `글 전체를 한 문장으로 줄인 문제예요. (A) · (B)에는 글의 핵심어를 다른 말로 바꾼 낱말이 들어가요.`;
  return `원 기출은 ${esc(P.type)}. 같은 글을 ${esc(q.k)} 문제로 바꿔, 세부 내용이 아니라 글 전체의 중심 생각을 잡았는지 봐요.`;
}
function drillMcq() {
  const d = st.dr, Q = questions(), q = Q[d.q], pk = d.pick[d.q], ans = q.a;
  const nDone = Q.filter((x, i) => d.pick[i] !== undefined).length, last = d.q === Q.length - 1;
  const tag = q.orig ? `원 기출 · ${esc(P.src.label.replace(/\s*[\d~]+번$/, ""))} ${q.no}번 · ${esc(q.type)}` : `변형 · ${esc(q.k)}`;
  let h = agentCard() + `<div style="margin-top:14px">${ENGQ.prog(nDone, Q.length)}</div>` + ENGQ.meta(`${d.q + 1}번 문제`, { tag, hot: q.orig && ENGQ.hot(q.type) }) + `<p class="tq-stem">${esc(q.q)}</p>`;
  h += q.orig ? origPassage(q) : passageHtml(q);
  if (!q.orig && q.p === "summary") h += `<div class="muted" style="margin:6px 0">(A) ― (B)</div>`;
  h += `<div style="height:18px"></div>` + ENGQ.choices(q.o, {
    attr: 'data-a="mq"', dis: pk !== undefined, label: i => optText(q, i),
    cls: i => pk !== undefined && ans !== null ? (i === ans ? "is-ok" : i === pk ? "is-no" : "") : pk === i ? "is-pick" : ""
  });
  if (pk !== undefined && (q.why || ans !== null)) { const wm = whyMade(q); h += ENGQ.exp(esc(q.why || "") + (wm ? `<div class="whym"><b>테라에이전트 · 왜 이 문제가 나왔나</b>${wm}</div>` : ""), ans !== null ? `정답 : ${ans + 1}번` : "정답 미확인"); }
  h += ENGQ.omr(Q.map((x, i) => ({ pick: d.pick[i], n: x.o.length })), d.q);
  h += ENGQ.bar({
    key: P.id + "/m" + d.q, exp: pk !== undefined, omr: true, pos: d.q + 1, total: Q.length,
    prev: d.q ? 'data-a="mqmove" data-v="-1"' : null,
    next: !last ? 'data-a="mqmove" data-v="1"' : null,
    submit: last ? { attr: 'data-a="nxt"', label: nextLabel() } : null
  });
  return h;
}

/* ───────── 6 서술형 ───────── */
function norm(s) { return s.toLowerCase().replace(/[“”"'’‘.,!?;:]/g, " ").split(/\s+/).filter(Boolean); }
function diff(a, b) { /* a=학생, b=정답 */
  const n = a.length, m = b.length, dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { ops.push(["eq", a[i]]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(["del", a[i]]); i++; } else { ops.push(["ins", b[j]]); j++; } }
  while (i < n) ops.push(["del", a[i++]]); while (j < m) ops.push(["ins", b[j++]]);
  return { ops, lcs: dp[0][0] };
}
/* 서술형 채점(지문 서술형 · 서술형 드릴 공용): diff + Lv4 특징 채점 */
function gradeWrite(W, raw) {
  const u = norm(raw); let best = null;
  W.ans.forEach(x => { const r = diff(u, norm(x)); if (!best || r.lcs > best.lcs) best = r; });
  const r = { ok: best.ops.every(o => o[0] === "eq"), ops: best.ops };
  if (W.feat) {
    const s = u.join(" "); r.wc = u.length; r.over = u.length > W.max;
    r.feat = W.feat.map(f => ({ lab: f.lab, pt: f.pt, ok: new RegExp(f.re).test(s) }));
    r.total = W.feat.reduce((a, f) => a + f.pt, 0);
    r.score = r.over ? 0 : r.feat.reduce((a, f) => a + (f.ok ? f.pt : 0), 0);
    r.ok = r.score === r.total;
  }
  return r;
}
function drillWrite(kind) {
  const d = st.dr, L = wList(kind); if (!L.includes(d.lv)) d.lv = L[0];
  const W = P.write[d.lv], hot = WRHOT[P.id] || [];
  let h = L.length > 1 ? `<div class="tabs">` + L.map(i => { const w = P.write[i]; return `<button class="${i === d.lv ? "on" : ""}" data-a="lv" data-v="${i}">Lv${w.lv} ${esc(w.name)}${hot[1] === i ? `<em class="shot">강추</em>` : ""}</button>`; }).join("") + `</div>` : `<h2>${esc(W.name)}${hot[1] === d.lv ? ` <em class="shot">강추</em>` : ""}</h2>`;
  if (hot[1] === d.lv) h += `<div class="hotn"><b>서술형 강추</b> ${esc(hot[3])} — 학교 시험 서술형에 자주 걸리는 구문이 든 문장이에요.</div>`;
  h += `<div class="box stem-box">${esc(W.ctx).replace("________", `<span class="blank"></span>`)}</div>`;
  if (W.ko) h += `<div class="muted stem-ko">우리말: ${esc(W.ko)}</div>`;
  if (W.cond) h += `<div class="cond"><b>조건</b><ol>${W.cond.map(c => `<li>${esc(c)}</li>`).join("")}</ol></div>`;
  if (W.bogi) h += `<div class="muted">&lt;보기&gt;</div><div class="bogi">${W.bogi.map(b => `<span>${esc(b)}</span>`).join("")}</div>`;
  const res = d.res[d.lv];
  if (W.tiles) {
    const t = d.tiles[d.lv] || (d.tiles[d.lv] = { pool: shuffle(W.tiles.map((w, i) => i)), line: [] });
    h += `<div class="ansline">${t.line.map((ti, k) => `<button class="tile" data-a="tout" data-v="${k}">${esc(W.tiles[ti])}</button>`).join("")}</div>
        <div class="bogi">${t.pool.map((ti, k) => `<button class="tile" data-a="tin" data-v="${k}">${esc(W.tiles[ti])}</button>`).join("")}</div>`;
  } else h += `<textarea id="wr" placeholder="빈칸에 들어갈 문장">${esc(d.text[d.lv] || "")}</textarea>`;
  h += `<div class="row dock"><button class="btn pri" data-a="wgrade">채점</button>${res ? `<button class="btn ghost" data-a="wreset">다시</button>` : ""}</div>`;
  if (res) {
    if (res.feat) {
      h += `<div class="today" style="margin-top:10px"><b>${res.score} / ${res.total}</b><span class="muted">${res.wc}단어 (최대 ${W.max})</span></div>`;
      h += `<div class="card" style="padding:10px 14px">` + res.feat.map(f => `<div class="exp"><span class="pill ${f.ok ? "g" : "r"}">${f.ok ? "맞음" : "틀림"}</span> ${esc(f.lab)} <span class="muted">${f.pt}점</span></div>`).join("") + (res.over ? `<div class="exp"><span class="pill r">초과</span> 단어 수 초과 → 0점</div>` : "") + `</div>`;
    }
    h += `<div class="msg ${res.ok ? "ok" : "no"}">${res.ok ? "정답" : "고쳐 쓴 문장"}</div>`;
    if (!res.ok) h += `<div class="fix">${res.ops.map(([t, w]) => t === "eq" ? esc(w) : t === "del" ? `<del>${esc(w)}</del>` : `<ins>${esc(w)}</ins>`).join(" ")}</div>`;
    h += `<details><summary>모범 답안 + 채점 기준</summary><div class="fix">${W.ans.map(a => esc(a)).join("<br>")}</div><div class="rubric">${esc(W.rub)}</div></details>`;
  }
  const isDone = !!doneMap()[st.pid];
  h += `<div class="row"><button class="btn pri" data-a="nxt">${nextLabel()}</button>${isDone ? `<span class="pill g">완료한 지문</span>` : ""}<button class="btn ghost" data-a="back">목록</button></div>`;
  return h;
}

/* ───────── 낱말 뜻 말풍선 (1007b) ───────── */
const DL = {};
function dictLetter(t) { const c = t[0].toLowerCase(); return c >= "a" && c <= "z" ? c : "_"; }
function dictLoad(t, cb) {
  const L = dictLetter(t);
  if (DL[L] === "ok") return cb();
  if (DL[L]) { DL[L].push(cb); return; }
  DL[L] = [cb];
  const sc = document.createElement("script");
  const fin = () => { const q = DL[L]; DL[L] = "ok"; q.forEach(f => f()); };
  sc.onload = fin; sc.onerror = fin; sc.src = "data/dict_" + L + ".js"; document.head.appendChild(sc);
}
const dictFind = t => { const D = window.MYE_DICT || {}; return D[t] || D[t.toLowerCase()] || null; };
const POSK = { n: "명사", v: "동사", adj: "형용사", adv: "부사", prep: "전치사", conj: "접속사", pron: "대명사", aux: "조동사", det: "한정사", int: "감탄사", num: "수사", phr: "숙어", "고유": "고유명사" };
const STOPW = new Set("a an the to of in on at for by with from as and or is are be it that this".split(" "));
let wbEl = null;
function wbHide() { const b = document.getElementById("wbub"); if (b) b.style.display = "none"; wbEl = null; }
function ctxMatch(low, base, el) {
  if (!P || !(P.wordsAll || P.words)) return { one: null, phr: [] };
  const blk = (el.closest(".sent,.box,.passage,p") || root).textContent.toLowerCase();
  let one = null; const phr = [];
  const sig = f => f.split(/[^a-z']+/).filter(x => x.length > 2 && !STOPW.has(x));
  (P.wordsAll || P.words).forEach(w => {
    const f1 = w.en.toLowerCase(), fb = (w.b || "").toLowerCase();
    if (!/\s/.test(f1) && !/\s/.test(fb)) { if (!one && [f1, fb].some(f => f && (f === low || f === base))) one = w; return; }
    const toks = sig(f1 + " " + fb);
    if (!toks.some(x => x === low || x === base || (x.length > 3 && low.length > 3 && x.slice(0, 4) === low.slice(0, 4)))) return;
    if (sig(f1).every(x => new RegExp("(?<![a-z])" + x.slice(0, Math.min(x.length, 4))).test(blk))) phr.push(w);
  });
  return { one, phr };
}
function wbHtml(raw, el) {
  const low = raw.toLowerCase(); const e = dictFind(raw);
  if (!e && raw.includes("-")) {   /* 하이픈 낱말: 조각별 */
    const parts = raw.split("-").map(x => ({ x, e: dictFind(x) })).filter(o => o.e);
    if (parts.length) return `<div class="wb-h"><b>${esc(raw)}</b></div>` + parts.map(o => `<div class="wb-s"><b>${esc(o.x)}</b> ${esc(o.e.d || (o.e.m || []).join(", "))}</div>`).join("");
  }
  const base = (e && e.b ? e.b : low).toLowerCase(), head = e && e.b ? e.b : raw;
  const c = ctxMatch(low, base, el);
  let h = `<div class="wb-h"><b>${esc(head)}</b>${e ? `<span class="ps">${esc(POSK[e.p] || e.p)}</span>` : ""}${head.toLowerCase() !== low ? `<span class="bf">${esc(raw)}</span>` : ""}</div>`;
  if (e && e.p === "고유") h += `<div class="wb-m">${esc(e.d)}</div>`;
  else if (c.one) h += `<div class="wb-m"><b>${esc(c.one.ko)}</b></div>` + (e && e.m && !e.m.includes(c.one.ko) ? `<div class="wb-s">${esc(e.m.join(", "))}</div>` : "");
  else if (e) h += `<div class="wb-m">${esc((e.m || []).join(", "))}</div>`;
  else h += `<div class="wb-s">기초 낱말</div>`;
  c.phr.slice(0, 2).forEach(w => { h += `<div class="wb-s">숙어 <b>${esc(w.b || w.en)}</b> ${esc(w.hm && w.hm.length ? w.hm[0] : w.ko)}${w.en !== (w.b || w.en) || (w.hm && !w.hm.includes(w.ko)) ? ` (지문: ${esc(w.ko)})` : ""}</div>`; });
  return h;
}
function showBubble(el) {
  if (wbEl === el) { wbHide(); return; }
  const raw = el.textContent.replace(/’/g, "'");
  dictLoad(raw, () => {
    if (!document.body.contains(el)) return;
    let b = document.getElementById("wbub");
    if (!b) { b = document.createElement("div"); b.id = "wbub"; document.body.appendChild(b); }
    b.innerHTML = wbHtml(raw, el); b.style.display = "block"; wbEl = el;
    const r = el.getBoundingClientRect(), bw = b.offsetWidth, bh = b.offsetHeight, vw = document.documentElement.clientWidth;
    let x = r.left + r.width / 2 - bw / 2 + window.scrollX; x = Math.max(8 + window.scrollX, Math.min(x, window.scrollX + vw - bw - 8));
    let y = r.bottom + 6 + window.scrollY; if (r.bottom + bh + 12 > window.innerHeight && r.top > bh + 12) y = r.top - bh - 6 + window.scrollY;
    b.style.left = x + "px"; b.style.top = y + "px";
  });
}
const WRAP_SKIP = "button,.br,.blank,.mk,.olab,.num,.tag,.pill,.opts,.exp,.notes,.note-small,.cond,.bogi,.lb,.ko,.legend,.bgc,del,ins";
function wrapWords() {
  if (nav.tab !== "p" || !st || st.step < 1 || st.step > 4) return;
  const re = /[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+)*/g;
  root.querySelectorAll(".wrap .tk .w, .wrap .passage, .wrap .box, .wrap p").forEach(c => {
    const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT), list = [];
    while (tw.nextNode()) { const n = tw.currentNode; if (n.parentElement.closest(WRAP_SKIP) || n.parentElement.classList.contains("lw")) continue; if (/[A-Za-z]/.test(n.nodeValue)) list.push(n); }
    list.forEach(n => {
      const t = n.nodeValue, frag = document.createDocumentFragment(); let last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(t))) {
        if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
        const sp = document.createElement("span"); sp.className = "lw"; sp.textContent = m[0]; frag.appendChild(sp); last = m.index + m[0].length;
      }
      if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
  });
}
function termFix() { document.querySelectorAll(".zs-btn, .zs-fab").forEach(b => b.querySelectorAll("span").forEach(x => { if (x.textContent.trim() === "합격전략") x.textContent = "합격 전략"; })); }
function afterRender() { try { zsFab(); termFix(); } catch (err) { } try { ENGQ.after(); } catch (err) { } try { if (nav.tab === "map") mountMap(); } catch (err) { } wbHide(); try { wrapWords(); } catch (err) { /* 말풍선 실패가 화면을 막지 않게 */ } }
const svMode = el => nav.tab === "p" && st && st.step === 2 && P.checks[st.ck.i] && P.checks[st.ck.i].type === "sv" && !!el.closest(".pick");
let lpT = null, lpFired = false, lpXY = null;
root.addEventListener("pointerdown", e => {
  const lw = e.target.closest(".lw"); if (!lw || !svMode(lw)) return;
  lpFired = false; lpXY = [e.clientX, e.clientY]; clearTimeout(lpT);
  lpT = setTimeout(() => { lpFired = true; showBubble(lw); }, 500);
});
["pointerup", "pointercancel"].forEach(ev => root.addEventListener(ev, () => clearTimeout(lpT)));
root.addEventListener("pointermove", e => { if (lpT && lpXY && Math.hypot(e.clientX - lpXY[0], e.clientY - lpXY[1]) > 10) clearTimeout(lpT); });
root.addEventListener("contextmenu", e => { const lw = e.target.closest(".lw"); if (lw && svMode(lw)) e.preventDefault(); });
root.addEventListener("click", e => {
  const lw = e.target.closest(".lw"); if (!lw) return;
  if (lpFired) { lpFired = false; e.stopPropagation(); return; }
  if (svMode(lw)) return;      /* S V 누르기가 우선: 뜻은 길게 누르기 */
  e.stopPropagation(); showBubble(lw);
}, true);
document.addEventListener("click", e => { if (wbEl && !e.target.closest("#wbub") && !e.target.closest(".lw")) wbHide(); }, true);
document.addEventListener("keydown", e => { if (e.key === "Escape") wbHide(); });

/* ───────── 이벤트 ───────── */
root.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('[role="button"][data-a]')) { e.preventDefault(); e.target.click(); } });
root.addEventListener("input", e => { if (e.target.id === "wr") st.dr.text[st.dr.lv] = e.target.value; });
root.addEventListener("click", e => {
  const tk = e.target.closest(".pick .tk");
  if (tk && nav.tab === "p" && st.step === 2) {
    const c = st.ck, q = P.checks[c.i];
    if (q.type !== "sv" || c.ph === "done") return;
    const i = +tk.dataset.i, s = P.sentences[q.si], key = c.ph.toLowerCase();
    if (c.found[c.ph].some(ci => s.main[ci][key].h.includes(i))) return;
    if (!s.main.some(cl => cl[key].h.includes(i)) && ["S", "V"].some(k => c.found[k].some(ci => s.main[ci][k.toLowerCase()].h.includes(i)))) return;
    const ci = s.main.findIndex((cl, k) => !c.found[c.ph].includes(k) && cl[key].h.includes(i));
    if (ci >= 0) {
      const hh = s.main[ci][key].h; c.found[c.ph].push(ci); c.pop = range(Math.min(...hh), Math.max(...hh)); c.flash = null; c.ok = true;
      c.msg = (c.ph === "S" ? "주어" : "동사") + " 정답";
      if (c.found[c.ph].length === s.main.length) { if (c.ph === "S") c.ph = "V"; else { c.ph = "done"; if (!c.miss) c.score++; c.msg = "S + V 정답"; } }
    } else {
      c.flash = i; c.miss++; c.ok = false; c.pop = []; c.msg = c.ph === "S" ? "주어 아님" : "동사 아님";
      setTimeout(() => { if (c.flash === i) { c.flash = null; render(); } }, 600);
    }
    render();
    /* 짜잔 3판(테라러닝 공용, 2026-10-09): 주어·동사 누르기 판정 */
    if (window.ZZ) { const el = root.querySelector(".msg") || tk; c.ok ? ZZ.ok(el) : ZZ.no(el); }
    return;
  }
  const b = e.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a, v = b.dataset.v, d = st && st.dr, c = st && st.ck;
  switch (a) {
    case "tab": nav.tab = v; nav.dedit = false; window.scrollTo(0, 0); break;
    case "ddedit": nav.dedit = !nav.dedit; break;
    case "ddsave": { const dl = document.getElementById("dl").value.trim(), dt = document.getElementById("dd").value; if (dt) LS.set("dday", { label: dl, date: dt }); nav.dedit = false; break; }
    case "ddclear": LS.set("dday", null); nav.dedit = false; break;
    case "back": nav.tab = nav.back || "home"; window.scrollTo(0, 0); break;
    case "open": openPassage(v, b.dataset.back || nav.tab); return;
    case "grade": LS.set("grade", +v); LS.set("today", null); break;
    case "subj": { let a = dSubjects(); a = a.includes(v) ? a.filter(x => x !== v) : a.concat(v); if (!a.includes("english")) a.push("english"); rawSet("tera_daeip_subjects", JSON.stringify(a)); if (dPerMin() * a.length > DAYMAX) rawSet("tera_daeip_per_min", String(dPerMin())); break; }
    case "permin": if (+v * dSubjects().length <= DAYMAX) rawSet("tera_daeip_per_min", String(+v)); break;
    case "count": LS.set("count", +v); LS.set("today", null); break;
    case "exg": nav.ex = { g: +v, y: null, u: null }; break;
    case "exy": nav.ex.y = +v; nav.ex.u = null; break;
    case "exu": nav.ex.u = v; break;
    case "exback": if (nav.ex.u) nav.ex.u = null; else if (nav.ex.y) nav.ex.y = null; else nav.ex.g = null; break;
    case "wstart": {
      const seen = {}, W = [];
      weekWords().concat(wrongWords()).forEach(w => { if (!seen[w.en]) { seen[w.en] = 1; W.push(w); } });
      WT = { words: W, phase: "list", queue: [], cur: 0, pick: null, opts: [], wrong: 0, first: {} }; nav.tab = "wtest"; break;
    }
    case "step": st.step = +v; enterStep(); saveProg(); window.scrollTo(0, 0); break;
    case "nxt": goNext(false); break;
    case "skip": goNext(true); break;
    case "plantog": st.planOpen = !st.planOpen; break;
    case "pl": { let pl = planOf(st.pid).slice(); pl = pl.includes(v) ? pl.filter(x => x !== v) : pl.concat(v); if (!pl.some(hasStep)) break; LS.set("plan." + st.pid, STEP_KEYS.filter(k => pl.includes(k))); enterStep(); saveProg(); break; }
    case "plandef": LS.set("plan", planOf(st.pid)); b.textContent = "저장했어요"; return;
    case "planreset": LS.set("plan." + st.pid, null); enterStep(); break;
    case "pdef": { let pl = planDef().slice(); pl = pl.includes(v) ? pl.filter(x => x !== v) : pl.concat(v); if (pl.length) LS.set("plan", STEP_KEYS.filter(k => pl.includes(k))); break; }
    case "sc": {
      const m = scopeMap(); if (m[v]) delete m[v]; else m[v] = 1; LS.set("scope", m);
      if (nav.tab !== "explore") break;
      /* 목록을 다시 그리면 줄마다 등장 연출이 되풀이된다. 누른 줄만 그 자리에서 바꾼다 */
      const on = !!m[v]; b.classList.toggle("on", on); b.textContent = on ? "✓" : ""; b.setAttribute("aria-pressed", on); b.parentNode.classList.toggle("insc", on);
      const all = root.querySelectorAll(".scb").length, n = root.querySelectorAll(".scb.on").length, sb = root.querySelector(".scbar b"), sa = root.querySelector('.scbar [data-a="scall"]');
      if (sb) sb.textContent = n; if (sa) sa.textContent = n === all ? "모두 빼기" : "이 회차 모두 담기";
      return;
    }
    case "scall": { const m = scopeMap(), e = INDEX.find(x => x.u === v), rd = e.p.filter(p => p[3]); const all = rd.every(p => m[p[0]]); rd.forEach(p => { if (all) delete m[p[0]]; else m[p[0]] = 1; }); LS.set("scope", m); break; }
    case "scon": LS.set("scopeOn", v === "1"); break;
    case "schot": nav.schot = v === "1"; break;
    case "vsel": {
      const s = st.voc.sel; if (s[v]) delete s[v]; else s[v] = 1;
      /* 누른 단어 칸만 그 자리에서 바꾼다(다시 그리면 아래 단추가 깜빡인다) */
      const on = !!s[v], n = Object.keys(s).length; b.classList.toggle("sel", on); b.setAttribute("aria-pressed", on); b.querySelector(".ckb").textContent = on ? "✓" : "";
      const q = x => root.querySelector(x), vs = q('[data-a="vstart"]');
      q(".vbar b").textContent = n; vs.disabled = !n; vs.textContent = n ? "고른 " + n + "개 시험" : "외울 단어를 고르세요";
      q('[data-a="vdone"]').textContent = n ? "시험 건너뛰기" : "다 아는 단어예요"; q('[data-a="vall"]').textContent = n === P.words.length ? "모두 풀기" : "모두 고르기";
      return;
    }
    case "vall": { const s = st.voc; const all = Object.keys(s.sel).length === P.words.length; s.sel = {}; if (!all) P.words.forEach((w, i) => { s.sel[i] = 1; }); break; }
    case "vdone": { const V = st.voc; V.words = P.words.filter((w, i) => V.sel[i]); recordKnow(); if (V.words.length) recordWords(V.words, P.id); bump(); V.phase = "done"; V.queue = []; break; }
    case "vquit": st.voc.phase = "done"; break;
    case "vagain": st.voc.phase = "list"; break;
    case "vstart": {
      if (nav.tab === "wtest") { vStart(WT, WT.words); break; }
      const V = st.voc; V.words = P.words.filter((w, i) => V.sel[i]); if (!V.words.length) return;
      recordKnow(); recordWords(V.words, P.id); vStart(V, V.words); break;
    }
    case "sen": { const an = st.an; an.note = -1; an.si = an.si === +v ? -1 : +v; if (an.si >= 0) an.seen[an.si] = 1; render(); const pn = root.querySelector(".anp"); if (pn) { const r = pn.getBoundingClientRect(); if (r.bottom > window.innerHeight - 90 || r.top < 60) pn.scrollIntoView({ block: r.height > window.innerHeight - 160 ? "start" : "nearest", behavior: "smooth" }); } return; }
    case "senmv": { const an = st.an; an.note = -1; an.si = Math.max(0, Math.min(P.sentences.length - 1, an.si + +v)); an.seen[an.si] = 1; break; }
    case "senx": st.an.si = -1; break;
    case "ank": st.an.k = +v; st.an.note = -1; break;
    case "agtog": d.ag = d.ag === false; break;
    case "vpick": {
      vPick(curV(), curWords(), +v); render();
      /* 단어 테스트는 보기 칸 색(ok/no)만 바뀌어 짜잔이 못 알아본다. 직접 넘긴다(2026-10-09) */
      if (window.ZZ) { const no = root.querySelector(".opts .opt.no"), ok = root.querySelector(".opts .opt.ok"); if (no) ZZ.no(no); else if (ok) ZZ.ok(ok); }
      return;
    }
    case "vnext": {
      const V = curV(), fin = vNext(V, curWords());
      if (fin && nav.tab === "p") bump();
      break;
    }
    case "bgtog": st.an.bg = !st.an.bg; break;
    case "note": st.an.note = st.an.note === +v ? -1 : +v; break;
    case "svshow": { const s = P.sentences[P.checks[c.i].si]; c.found = { S: s.main.map((x, k) => k), V: s.main.map((x, k) => k) }; c.ph = "done"; c.ok = false; c.pop = []; c.msg = "정답 확인"; break; }
    case "ckpick": { c.pick = +v; if (+v === P.checks[c.i].a) c.score++; break; }
    case "cknext": c.i++; c.ph = "S"; svInit(c); c.pop = []; c.flash = null; c.miss = 0; c.msg = ""; c.pick = null; break;
    case "ch": if (!d.graded) d.ch[+b.dataset.n] = +v; break;
    case "chgrade": d.graded = true; break;
    case "chreset": d.ch = {}; d.graded = false; break;
    case "mq": d.pick[d.q] = +v; break;
    case "mqmove": d.q += +v; window.scrollTo(0, 0); break;
    case "mqgo": d.q = +v; { const o = root.querySelector(".tq-omr"); if (o) o.classList.remove("is-open"); } window.scrollTo(0, 0); break;
    case "lv": d.lv = +v; break;
    case "tin": { const t = d.tiles[d.lv]; t.line.push(t.pool.splice(+v, 1)[0]); delete d.res[d.lv]; break; }
    case "tout": { const t = d.tiles[d.lv]; t.pool.push(t.line.splice(+v, 1)[0]); delete d.res[d.lv]; break; }
    case "wgrade": {
      const W = P.write[d.lv];
      const raw = W.tiles ? (d.tiles[d.lv].line.map(i => W.tiles[i]).join(" ")) : (d.text[d.lv] || "");
      d.res[d.lv] = gradeWrite(W, raw); break;
    }
    case "wreset": delete d.res[d.lv]; d.text[d.lv] = ""; if (d.tiles[d.lv]) delete d.tiles[d.lv]; break;
  }
  render();
});
render();

/* 합격전략 알약(화면표준 2절 — 탭 위 12px · 오른쪽 16px): 공용 엔진이 늦게 올라오므로 load 뒤에 한 번 더 */
window.addEventListener("load", function () { try { zsFab(); } catch (err) { } });

/* 화면표준 14절: 「합격 전략」은 떠 있는 알약 대신 오늘 화면의 줄에서 연다. 공용 창(zzstrat.js)은 그대로 두고 열릴 때 덮개 style 만 넣는다 */
document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest("[data-zs]"); if (a) { e.preventDefault(); if (window.ZZSTRAT) window.ZZSTRAT.open("eng_hs"); } });
  (function(){
    var P="#E5202E", PI="#B61D29", PS="rgba(229,32,46,.10)";
    var 덮개=[
      "#zs,#zst,#zsy{--zs-bg:#FFFFFF;--zs-card:#FFFFFF;--zs-line:#E6E8EC;--zs-red:"+P+";--zs-blue:#F08A91;--zs-gold:#7C818C;--zs-soft:#F1F3F6;--zs-tx:#111419;--zs-sub:#5F6670}",
      "#zs .top .t{letter-spacing:0;font-size:13px}#zs .top button{border-radius:12px}",
      "#zs section{border-radius:18px;box-shadow:none}",
      "#zs .chip{border-radius:999px;background:#F1F3F6;color:#333941}#zs .chip.r{background:"+PS+";color:"+PI+"}",
      "#zs .pk{border:1px solid #E6E8EC;border-radius:14px;background:#FFFFFF}#zs .pk.on{border-color:"+P+";background:"+PS+";box-shadow:none}",
      "#zs .tg{border-radius:999px;font-size:11.5px}#zs .tg.a{background:"+P+";color:#fff}#zs .tg.l{background:rgba(229,32,46,.16);color:"+PI+";border:0}#zs .tg.g{background:#F1F3F6;color:#5F6670;border:0}",
      "#zs .sc,#zs .sc.s,#zs .sc.d{border:1px solid #E6E8EC;border-radius:14px}#zs .sc.on{background:#FFFFFF}#zs .sc .rb{border-radius:999px}",
      "#zs .sc.s .rb,#zs .sc.s .bar b{background:"+P+"}#zs .sc.d .rb,#zs .sc.d .bar b{background:#F08A91}#zs .sc.b .bar b{background:#B4BAC3}",
      "#zs .det{border-radius:14px}#zs .vl i{background:"+P+";border-radius:50%}",
      "#zs .gauge .fl{background:rgba(229,32,46,.14)}#zs .stack i.s{background:"+P+"}#zs .stack i.d{background:#F08A91}#zs .stack i.b{background:#B4BAC3}",
      "#zs .gp b{background:"+P+";border-radius:12px}#zs .gp::after{background:"+P+"}#zs .gb .gline b{border-radius:12px}",
      "#zs .gc .cd{border:1px solid #E6E8EC;border-radius:14px}",
      "#zs .gc .cd:nth-child(1){--c:"+P+"!important}#zs .gc .cd:nth-child(2){--c:#F08A91!important}#zs .gc .cd:nth-child(3){--c:#F6B3B8!important}#zs .gc .cd:nth-child(n+4){--c:#9CA3AF!important}",
      "#zs .gc .cg{border-radius:999px}#zs .hit{border-radius:14px}",
      "#zs .q li.a::before{background:"+P+";border-color:"+P+"}#zs .q .st.f{color:"+PI+";border-color:"+PI+"}#zs .q{border-radius:14px}",
      "#zs .go{background:"+P+";border-radius:12px}#zst .nx{background:"+P+";border-radius:12px}#zst .hole{border-radius:14px}#zst .bub{border-radius:18px}",
      "#zsy .nx{background:"+P+"}#zsy .pg i{background:"+P+"}#zsy .pk{border:1px solid #E6E8EC}#zsy .pk.on{border-color:"+P+";box-shadow:none}",
      "#zsy .end button{border:1px solid "+P+";color:"+PI+"}#zsy .end .main{background:"+P+";color:#fff}"
    ].join("\n");
    function 글(root){ var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false), n; while((n=w.nextNode())){ if(n.nodeValue.indexOf("합격전략")>=0) n.nodeValue=n.nodeValue.replace(/합격전략/g,"합격 전략"); } }
    function 말(){
      document.querySelectorAll(".zs-fab,.zs-btn").forEach(function(el){ 글(el); });
      var h=document.getElementById("zs-host");
      if(h && h.shadowRoot){
        if(!h.shadowRoot.getElementById("mj-ov")){ var st=document.createElement("style"); st.id="mj-ov"; st.textContent=덮개; h.shadowRoot.appendChild(st); }
        글(h.shadowRoot);
      }
    }
    new MutationObserver(말).observe(document.documentElement,{childList:true,subtree:true}); 말();
  })();
