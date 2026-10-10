"use strict";
/* 모두의 영어 app — 시안(모두의영어_시안\index.html)의 화면·동작을 여러 지문·지연 로딩·진행 저장으로 확장 */

/* ───────── 저장 (localStorage 접두어 mye., 실패해도 동작) ───────── */
const MEM = {};
const LS = {
  get(k, d) { try { const v = localStorage.getItem("mye." + k); return v === null ? d : JSON.parse(v); } catch (e) { return k in MEM ? MEM[k] : d; } },
  set(k, v) { MEM[k] = v; try { localStorage.setItem("mye." + k, JSON.stringify(v)); } catch (e) { /* 저장 불가: 메모리만 */ } }
};
const INDEX = window.MYE_INDEX || [];
const PIDX = {};   /* pid -> {e: 회차, p: [pid,번호,유형,ready]} */
INDEX.forEach(e => e.p.forEach(p => { PIDX[p[0]] = { e, p }; }));

/* ───────── 도구 ───────── */
const root = document.getElementById("root");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const CIRC = "①②③④⑤";
const STEPS = ["단어", "분석", "확인", "양자택일", "유형", "서술형"];
const pad2 = n => (n < 10 ? "0" : "") + n;
const ymd = d => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
const weekStart = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return ymd(x); };
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/* ───────── 상태 ───────── */
let P = null;                 /* 현재 지문 */
const nav = { tab: "home", back: "home", ex: { g: null, y: null, u: null }, loading: false, err: "" };
let st = null;                /* 현재 지문 진행 상태 */
let WT = null;                /* 주말 단어 테스트 상태 */

function freshSt(pid) {
  const prog = LS.get("prog." + pid, null);
  const max = prog ? Math.min(prog.max || 0, 5) : 0;
  return {
    pid, step: Math.min(max, 5) === 0 ? 0 : max, maxStep: max,
    voc: { phase: "list", queue: [], cur: 0, pick: null, opts: [], wrong: 0 },
    an: { si: 0, k: 0, note: -1 },
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
  LS.set("prog." + st.pid, { max: Math.max(old.max || 0, st.maxStep), ts: Date.now(), done: !!old.done });
}
function bump(n) { st.maxStep = Math.max(st.maxStep, n); saveProg(); markAtt(); }

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
    P = d[pid]; P.wordsAll = P.wordsAll || P.words || []; P.words = P.wordsAll.filter(lvOk); st = newSt(pid); nav.loading = false; window.scrollTo(0, 0); render();
  }).catch(e => { nav.loading = false; nav.err = e.message; render(); });
}

/* ───────── 오늘 지문 고르기 ───────── */
function doneMap() { return LS.get("done", {}); }
function todayIds() {
  const key = ymd(new Date()), g = LS.get("grade", 3), n = LS.get("count", 4);
  const t = LS.get("today", null), done = doneMap();
  const ids = (t && t.date === key && t.g === g && t.n === n) ? t.ids.slice() : [];
  const before = ids.length;
  for (const e of INDEX) {              /* INDEX 는 최근 회차 순 */
    if (ids.length >= n) break;
    if (e.g !== g) continue;
    for (const p of e.p) { if (ids.length >= n) break; if (p[3] && !done[p[0]] && !ids.includes(p[0])) ids.push(p[0]); }
  }
  if (ids.length !== before || !t || t.date !== key) LS.set("today", { date: key, g, n, ids });
  return ids;
}
function statusOf(pid) {
  if (doneMap()[pid]) return { t: "완료", c: "g" };
  const pr = LS.get("prog." + pid, null);
  if (pr && pr.max > 0) return { t: STEPS[Math.min(pr.max, 5)] + " 단계", c: "" };
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

/* ───────── 화면 틀 ───────── */
function render() { renderBase(); afterRender(); }
function renderBase() {
  if (nav.tab === "p") { root.innerHTML = passageView(); return; }
  if (nav.tab === "wtest") { root.innerHTML = wtestView(); return; }
  const body = { home, explore, gram: () => DRILL.gram(), writ: () => DRILL.writ(), words: wordsTab, rec: recTab }[nav.tab]();
  root.innerHTML = body + `<div class="nav">` + [["home", "오늘"], ["explore", "기출"], ["gram", "문법"], ["writ", "서술형"], ["words", "단어장"], ["rec", "기록"]]
    .map(([k, n]) => `<button class="${nav.tab === k ? "on" : ""}" data-a="tab" data-v="${k}">${n}</button>`).join("") + `</div>`;
}
function passageView() {
  if (nav.loading) return `<div class="top"><button class="back" data-a="back">‹</button><div class="brand">지문</div></div><div class="loading">불러오는 중</div>`;
  if (nav.err) return `<div class="top"><button class="back" data-a="back">‹</button><div class="brand">지문</div></div><div class="loading">${esc(nav.err)}</div>`;
  let h = `<div class="top"><button class="back" data-a="back">‹</button><div class="brand">${esc(P.src.label)}</div><div class="pid">${esc(P.type)}</div></div><div class="wrap">`;
  h += `<div class="steps">` + STEPS.map((n, i) => {
    const c = i < st.maxStep ? "done" : i === st.step ? "on" : i > st.maxStep ? "lock" : "";
    return (i ? `<div class="bar ${i <= st.maxStep ? "done" : ""}"></div>` : "") + `<button class="st ${c} ${i === st.step ? "on" : ""}" data-a="step" data-v="${i}"><span class="dot">${i < st.maxStep ? "✓" : i + 1}</span><span class="lab">${n}</span></button>`;
  }).join("") + `</div>`;
  h += [vocabStep, analyze, check, drillChoice, drillMcq, drillWrite][st.step]();
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
  const wk = weekWords(), bad = wrongWords().length, dd = ddayInfo(), sk = streakDays();
  const wkTag = dw === 6 ? "토요일" : dw === 0 ? "일요일" : "주말";
  const ded = nav.dedit;
  return `<div class="top"><div class="brand">모두의 영어</div><div class="pid">${ymd(now)} (${DOW[dw]})</div></div><div class="wrap">
  <div class="hero">
    <div class="dd-box">${dd ? `<div class="dnum">${dd.txt}</div><div class="dlab">${esc(dd.label)}</div>` : `<div class="dnum off">D-day</div>`}
      <button class="chip" data-a="ddedit">${dd ? "수정" : "날짜 설정"}</button></div>
    <div class="stat">
      <div class="st-i">${FLAME}<b>${sk}</b><span>연속</span></div>
      <div class="st-i">${SHIELD}<b>상위 ${topPct()}%</b></div>
    </div>
  </div>
  ${ded ? `<div class="card"><div class="muted">D-day 이름</div><input id="dl" class="inp" value="${esc((LS.get("dday", {}) || {}).label || "")}" placeholder="수능">
    <div class="muted" style="margin-top:8px">날짜</div><input id="dd" type="date" class="inp" value="${esc((LS.get("dday", {}) || {}).date || "")}">
    <div class="row"><button class="btn pri" data-a="ddsave">저장</button><button class="btn ghost" data-a="ddclear">삭제</button></div></div>` : ""}
  <h3>출석</h3>${attWeek()}${attMonth()}
  <h2>오늘</h2>
  <div class="today"><b>${dn} / ${ids.length || n}</b></div>
  ${blocks(ids.length || n, i => !!(ids[i] && done[ids[i]]), dn)}
  <div class="plist">` + ids.map((id, k) => {
    const it = PIDX[id], s = statusOf(id);
    return `<button class="it ${done[id] ? "done" : ""}" data-a="open" data-v="${id}"><span class="no">${pad2(k + 1)}</span><span class="tt">${esc(it.e.n)} ${esc(it.p[1])}번<span class="sub">${esc(it.p[2])}</span></span><span class="pill ${s.c}">${s.t}</span></button>`;
  }).join("") + `</div>
  <div class="card"><h3 style="margin-top:0">주말 단어 테스트</h3>
    <div class="row" style="margin:0"><span class="pill r">${wkTag}</span><span>이번 주 단어 ${wk.length}${bad ? " + 틀린 단어 " + bad : ""}</span></div>
    <div class="row"><button class="btn pri" data-a="wstart" ${wk.length + bad < 2 ? "disabled" : ""}>테스트</button></div></div>
  <div class="card"><h3 style="margin-top:0">설정</h3>
    <div class="muted">학년</div><div class="seg">${[1, 2, 3].map(x => `<button class="${g === x ? "on" : ""}" data-a="grade" data-v="${x}">고${x}</button>`).join("")}</div>
    <div class="muted">하루 지문</div><div class="seg">${[3, 4].map(x => `<button class="${n === x ? "on" : ""}" data-a="count" data-v="${x}">${x}개</button>`).join("")}</div></div>
  </div>`;
}

/* ───────── 기출 탐색: 학년 → 연도 → 회차 → 번호 ───────── */
function cnt(list) { let r = 0, t = 0; list.forEach(e => e.p.forEach(p => { t++; r += p[3]; })); return [r, t]; }
function explore() {
  const ex = nav.ex;
  let h = `<div class="top"><div class="brand">기출</div></div><div class="wrap">`;
  const crumb = [];
  if (ex.g) crumb.push(`고${ex.g}`); if (ex.y) crumb.push(ex.y + "학년도");
  if (ex.u) { const e = INDEX.find(x => x.u === ex.u); crumb.push(e ? e.n : ""); }
  if (crumb.length) h += `<div class="crumb"><button data-a="exback">‹</button>${esc(crumb.join(" / "))}</div>`;
  else h += `<h2>학년</h2>`;
  const badge = ([r, t]) => `<span class="pill ${r ? "g" : ""}">${r} / ${t}</span>`;
  if (!ex.g) {
    h += `<div class="plist">` + [1, 2, 3].map(g => `<button class="it" data-a="exg" data-v="${g}"><span class="tt">고${g}</span>${badge(cnt(INDEX.filter(e => e.g === g)))}</button>`).join("") + `</div>`;
  } else if (!ex.y) {
    const ys = [...new Set(INDEX.filter(e => e.g === ex.g).map(e => e.y))].sort((a, b) => b - a);
    h += `<div class="plist">` + ys.map(y => `<button class="it" data-a="exy" data-v="${y}"><span class="tt">${y}학년도</span>${badge(cnt(INDEX.filter(e => e.g === ex.g && e.y === y)))}</button>`).join("") + `</div>`;
  } else if (!ex.u) {
    const es = INDEX.filter(e => e.g === ex.g && e.y === ex.y).sort((a, b) => b.mo - a.mo);
    h += `<div class="plist">` + es.map(e => `<button class="it" data-a="exu" data-v="${e.u}"><span class="tt">${esc(e.n)}</span>${badge(cnt([e]))}</button>`).join("") + `</div>`;
  } else {
    const e = INDEX.find(x => x.u === ex.u), done = doneMap();
    h += `<div class="plist">` + e.p.map(p => p[3]
      ? `<button class="it ${done[p[0]] ? "done" : ""}" data-a="open" data-v="${p[0]}" data-back="explore"><span class="no">${esc(p[1])}</span><span class="tt">${esc(p[2])}</span><span class="pill ${statusOf(p[0]).c}">${statusOf(p[0]).t}</span></button>`
      : `<div class="it off"><span class="no">${esc(p[1])}</span><span class="tt">${esc(p[2])}</span><span class="pill">준비 중</span></div>`).join("") + `</div>`;
  }
  return h + `</div>`;
}

/* ───────── 단어장 · 기록 ───────── */
function wordsTab() {
  const all = LS.get("words", {}), wr = LS.get("wrong", {}), wk = weekWords();
  const keys = Object.keys(all).sort();
  let h = `<div class="top"><div class="brand">단어장</div><div class="pid">${keys.length}</div></div><div class="wrap">`;
  if (wk.length) h += `<h2>이번 주</h2>` + wk.map(w => `<div class="wbox">${wline(w)}</div>`).join("");
  const bad = wrongWords();
  if (bad.length) h += `<h2>틀린 단어</h2>` + bad.map(w => `<div class="wbox">${wline(w)}<span class="ct pill r">${wr[w.en]}회</span></div>`).join("");
  if (keys.length) h += `<h2>전체</h2>` + keys.map(k => `<div class="wbox">${wline(Object.assign({ en: k }, all[k]))}</div>`).join("");
  return h + `</div>`;
}
function recTab() {
  const done = doneMap(), ids = Object.keys(done).sort((a, b) => done[b] - done[a]);
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(ymd(d)); }
  const per = {}; ids.forEach(id => { const k = ymd(new Date(done[id])); per[k] = (per[k] || 0) + 1; });
  const mx = Math.max(1, ...days.map(d => per[d] || 0));
  let h = `<div class="top"><div class="brand">기록</div><div class="pid">완료 ${ids.length}</div></div><div class="wrap"><h2>최근 14일</h2>
    <div class="bars">${days.map(d => `<div style="height:${Math.round((per[d] || 0) / mx * 100)}%" title="${d}"></div>`).join("")}</div>
    <div class="row" style="justify-content:space-between;margin:0"><span class="muted">${days[0].slice(5)}</span><span class="muted">${days[13].slice(5)}</span></div>`;
  if (ids.length) h += `<h2>완료</h2><div class="plist">` + ids.map(id => { const it = PIDX[id]; return `<button class="it" data-a="open" data-v="${id}"><span class="tt">${it ? esc(it.e.n) + " " + esc(it.p[1]) + "번" : esc(id)}<span class="sub">${it ? esc(it.p[2]) : ""} → ${ymd(new Date(done[id]))}</span></span></button>`; }).join("") + `</div>`;
  return h + `</div>`;
}

/* ───────── 1 단어 (지문 단어 · 주말 테스트 공용) ───────── */
function curV() { return nav.tab === "wtest" ? WT : st.voc; }
function curWords() { return nav.tab === "wtest" ? WT.words : P.words; }
function vocabStep() {
  const v = st.voc;
  if (!P.words.length) return `<h2>단어</h2><div class="muted">고${LS.get("grade", 3)} 기준 새로 익힐 단어 없음</div><div class="row"><button class="btn pri" data-a="vskip">분석</button></div>`;
  if (v.phase === "list") {
    return `<h2>단어 ${P.words.length}</h2><div class="wlist">` + P.words.map(w => `<div class="w">${wline(w)}</div>`).join("") + `</div>
    <div class="row"><button class="btn pri" data-a="vstart">테스트</button></div>`;
  }
  if (v.phase === "done") return `<h2>통과</h2><div class="muted">오답 ${v.wrong}회</div><div class="row"><button class="btn pri" data-a="step" data-v="1">분석</button></div>`;
  return vocabQ(v, curWords());
}
function vocabQ(v, W) {
  const w = W[v.queue[v.cur]], left = v.queue.length - v.cur;
  return `<div style="margin-top:14px">${blocks(v.queue.length, i => i < v.cur, v.cur)}</div><div class="muted" style="margin-top:6px">남은 ${left}</div><div class="qword">${esc(w.en)}</div>
  <div class="opts" style="margin-top:22px">` + v.opts.map((o, i) => {
    let c = ""; if (v.pick !== null) { if (o === w.ko) c = "ok"; else if (i === v.pick) c = "no"; }
    return `<button class="opt ${c}" data-a="vpick" data-v="${i}" ${v.pick !== null ? "disabled" : ""}>${esc(o)}</button>`;
  }).join("") + `</div>${v.pick !== null ? `<div class="row"><button class="btn pri" data-a="vnext">다음</button></div>` : ""}`;
}
function vMakeOpts(v, W) {
  const w = W[v.queue[v.cur]];
  const others = shuffle([...new Set(W.filter(x => x.en !== w.en && x.ko !== w.ko).map(x => x.ko))]).slice(0, 3);
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
  let h = `<div class="top"><button class="back" data-a="tab" data-v="home">‹</button><div class="brand">주말 단어 테스트</div><div class="pid">${v.words.length}개</div></div><div class="wrap">`;
  if (v.phase === "list") h += `<h2>단어 ${v.words.length}</h2><div class="wlist">` + v.words.map(w => `<div class="w">${wline(w)}</div>`).join("") + `</div><div class="row"><button class="btn pri" data-a="vstart">테스트</button></div>`;
  else if (v.phase === "done") h += `<h2>통과</h2><div class="muted">오답 ${v.wrong}회</div><div class="row"><button class="btn pri" data-a="tab" data-v="home">홈</button></div>`;
  else h += vocabQ(v, v.words);
  return h + `</div>`;
}

/* ───────── 2 분석 ───────── */
const AN_STEP = ["원문", "수식어 괄호", "S + V", "해석 + 문법"];
function bgCard() {
  const g = P.bg, open = st.an.bg !== false;
  return `<div class="bgc"><button class="bgh" data-a="bgtog"><span>배경지식</span><span class="bgt">${esc(g.t)}</span><span class="car">${open ? "▲" : "▼"}</span></button>` +
    (open ? `<div class="bgb"><div class="bgs">${esc(g.s)}</div>` + ((g.k || []).length ? `<div class="chips">` + g.k.map(c => `<span class="chip"><b>${esc(c.en)}</b> ${esc(c.ko)}<span class="cd">${esc(c.d)}</span></span>`).join("") + `</div>` : "") + `</div>` : "") + `</div>`;
}
function analyze() {
  const a = st.an, s = P.sentences[a.si], k = a.k;
  let h = `<div class="row" style="justify-content:space-between"><span class="muted">문장 ${a.si + 1} / ${P.sentences.length}</span><span class="pill">${AN_STEP[k]}</span></div>` + blocks(P.sentences.length, i => i < a.si, a.si);
  const hl = a.note >= 0 ? range(s.notes[a.note][0], s.notes[a.note][1]) : [];
  if (a.si === 0 && k === 0 && P.bg) h = bgCard() + h;
  h += renderSent(a.si, { brackets: k >= 1, sv: k >= 2, lab: true, hl });
  if (k >= 1) h += `<div class="legend"><b>( )</b> 수식어 &nbsp; <b>[ ]</b> 명사절</div>`;
  if (k >= 2 && (s.frag || (s.main.length && !s.main[0].s.h.length))) h += `<div class="muted" style="margin-top:6px">${s.frag ? "S V 없음 → 단편" : "명령문 → S 생략"}</div>`;
  if (k >= 3) {
    h += `<div class="ko">${esc(s.ko)}</div>` + (s.notes.length ? `<ul class="notes">` + s.notes.map((n, i) => `<li class="${i === a.note ? "on" : ""}" data-a="note" data-v="${i}"><span class="n">${i + 1}</span><span><span class="k">${esc(n[2])}</span><br>${esc(n[3])}</span></li>`).join("") + `</ul>` : "");
  }
  const last = a.si === P.sentences.length - 1;
  h += `<div class="row">${a.si || k ? `<button class="btn ghost" data-a="anprev">이전</button>` : ""}` +
    (k < 3 ? `<button class="btn pri" data-a="annext">${AN_STEP[k + 1]}</button>` : last ? `<button class="btn pri" data-a="anend">확인 문제</button>` : `<button class="btn pri" data-a="annext">다음 문장</button>`) + `</div>`;
  return h;
}

/* ───────── 3 확인 ───────── */
function check() {
  const c = st.ck;
  if (c.i >= P.checks.length) return `<h2>확인 끝</h2><div class="today"><b>${c.score} / ${P.checks.length}</b><span class="muted">첫 시도 정답</span></div><div class="row"><button class="btn pri" data-a="go" data-v="3">양자택일</button></div>`;
  const q = P.checks[c.i];
  let h = `<div style="margin-top:14px">${blocks(P.checks.length, i => i < c.i, c.i)}</div>`;
  if (q.type === "sv") {
    const s = P.sentences[q.si], n = s.main.length, marks = {}, labels = {}, ends = {};
    ["S", "V"].forEach(k => c.found[k].forEach(ci => { const hh = s.main[ci][k.toLowerCase()].h; if (!hh.length) return; range(Math.min(...hh), Math.max(...hh)).forEach(i => marks[i] = k); labels[hh[0]] = labels[hh[0]] ? labels[hh[0]] + " " + k : k; ends[hh[0]] = Math.max(ends[hh[0]] ?? 0, Math.max(...hh)); }));
    h += `<div class="qhead">${c.ph === "done" ? "주절 S + V" : "주절의 " + (c.ph === "S" ? "주어(S)" : "동사(V)") + " 누르기"}${n > 1 && c.ph !== "done" ? ` <span class="pill">${c.found[c.ph].length} / ${n}</span>` : ""}</div>`;
    h += renderSent(q.si, { pick: true, marks, labels, ends, lab: true, pop: c.pop, bad: c.flash != null ? [c.flash] : [] });
    h += `<div class="msg ${c.ok ? "ok" : "no"}">${c.msg}</div>`;
    if (c.ph !== "done") {
      h += `<div class="muted">명사절 주어 → 절 안 아무 단어</div>`;
      if (c.miss >= 2) h += `<div class="row"><button class="btn ghost" data-a="svshow">정답 보기</button></div>`;
    } else h += `<div class="row"><button class="btn pri" data-a="cknext">다음</button></div>`;
  } else {
    h += `<div class="qhead">${esc(q.q)}</div>` + renderSent(q.si, { hl: range(q.r[0], q.r[1]) });
    h += `<div class="opts">` + q.o.map((o, i) => { let cl = ""; if (c.pick !== null) { if (i === q.a) cl = "ok"; else if (i === c.pick) cl = "no"; }
      return `<button class="opt ${cl}" data-a="ckpick" data-v="${i}" ${c.pick !== null ? "disabled" : ""}>${esc(o)}</button>`; }).join("") + `</div>`;
    if (c.pick !== null) h += `<div class="ko" style="font-size:16px">${esc(q.why)}</div><div class="row"><button class="btn pri" data-a="cknext">다음</button></div>`;
  }
  return h;
}

/* ───────── 4 양자택일 ───────── */
function drillChoice() {
  const d = st.dr, C = P.choice;
  let h = `<div class="qhead">어법 + 어휘 선택</div><div class="passage">`;
  h += esc(C.text).replace(/\{(\d+)\}/g, (_, n) => {
    n = +n; const it = C.items[n], sel = d.ch[n];
    const cl = d.graded ? (sel === it.a ? "ok" : "no") : "";
    return `<span class="ch ${cl}"><span class="num">${n + 1}</span>` + it.o.map((o, i) => `<button class="${sel === i ? "sel" : ""}" data-a="ch" data-n="${n}" data-v="${i}">${esc(o)}</button>`).join("") + `</span>`;
  });
  h += `</div>`;
  if (!d.graded) h += `<div class="row"><button class="btn pri" data-a="chgrade">채점</button><span class="muted">${Object.keys(d.ch).length} / ${C.items.length}</span></div>`;
  else {
    const sc = C.items.filter((it, n) => d.ch[n] === it.a).length;
    h += `<div class="today" style="margin-top:14px"><b>${sc} / ${C.items.length}</b></div>
    <details open><summary>해설 보기</summary>` + C.items.map((it, n) => {
      const right = d.ch[n] === it.a;
      return `<div class="exp"><span class="pill ${right ? "g" : "r"}">${n + 1} ${esc(it.k)}</span> ${it.o.filter((o, i) => i !== it.a).map(o => `<del>${esc(o)}</del>`).join(" ")} <ins>${esc(it.o[it.a])}</ins><br>${esc(it.why)}</div>`;
    }).join("") + `</details>
    <div class="row"><button class="btn ghost" data-a="chreset">다시</button><button class="btn pri" data-a="go" data-v="4">유형</button></div>`;
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
    if (q.head) h += `<div class="box">${esc(q.head)}</div>`;
    h += Object.keys(q.blocks).map(k => `<p>${q.head ? `<span class="olab">(${k})</span> ` : ""}${markPassage((q.head ? "" : "(" + k + ") ") + q.blocks[k], q.ul)}</p>`).join("");
  } else if (q.type === "삽입") {
    h += `<div class="box">${esc(q.given || "")}</div><div class="box">${markPassage(q.p || "", null)}</div>`;
  } else if (q.type === "빈칸") {
    h += `<div class="box">${esc(q.p || "").replace(/_{2,}/g, `<span class="blank"></span>`)}</div>`;
  } else if (q.type === "요약") {
    h += `<div class="box">${esc(q.p || "")}</div><div style="text-align:center;font-weight:900">↓</div><div class="box">${esc(q.sum || "").replace(/\(([AB])\)/g, "<b>($1)</b>")}</div>`;
  } else h += `<div class="box">${markPassage(q.p || "", q.ul)}</div>`;
  if (q.note) h += `<div class="note-small">${esc(q.note)}</div>`;
  return h;
}
function passageHtml(q) {
  const kind = q.p, S = P.sentences.map(s => esc(s.t));
  if (kind === "full") return `<div class="box">${S.join(" ")}</div>`;
  if (kind === "blank") {
    const b = q.blank, T = toks(P, b.si), last = T[b.to], punct = (last.match(/[,.;:?!”’"')]*$/) || [""])[0];
    const post = T.slice(b.to + 1).join(" ");
    return `<div class="box">${S.slice(0, b.si).join(" ")} ${esc(T.slice(0, b.from).join(" "))} <span class="blank"></span>${esc(punct)}${post ? " " + esc(post) : ""} ${S.slice(b.si + 1).join(" ")}</div>`;
  }
  if (kind === "order") {
    const O = q.order, j = a => a.map(i => S[i]).join(" ");
    return `<div class="box">${j(O.given)}</div>` + ["A", "B", "C"].map(k => `<p><span class="olab">(${k})</span> ${j(O[k])}</p>`).join("");
  }
  if (kind === "summary") return `<div class="box">${S.join(" ")}</div><div style="text-align:center;font-weight:900">↓</div><div class="box">${esc(q.summary).replace(/\(([AB])\)/g, "<b>($1)</b>")}</div>`;
  return "";
}
function optLabel(q, i) {
  const t = String(q.o[i]);
  if (/^\(?[a-e]\)?$/.test(t) || /^[①-⑤]/.test(t) || q.type === "무관한문장") return /^[①-⑤]/.test(t) ? esc(t) : (q.type === "무관한문장" ? CIRC[i] : esc(t));
  return CIRC[i] + " " + esc(t);
}
function drillMcq() {
  const d = st.dr, Q = questions(), q = Q[d.q], pk = d.pick[d.q];
  const tag = q.orig ? `<span class="tag o">원 기출</span>${esc(P.src.label.replace(/\s*[\d~]+번$/, ""))} ${q.no}번` : `<span class="tag">변형</span>`;
  let h = blocks(Q.length, i => d.pick[i] !== undefined, d.q) + `<div class="row" style="justify-content:space-between"><span class="muted">${d.q + 1} / ${Q.length}</span><span class="pill">${tag} ${esc(q.orig ? q.type : q.k)}</span></div><div class="qhead">${esc(q.q)}</div>`;
  h += q.orig ? origPassage(q) : passageHtml(q);
  if (!q.orig && q.p === "summary") h += `<div class="muted" style="margin:6px 0">(A) ― (B)</div>`;
  const ans = q.a;
  h += `<div class="opts">` + q.o.map((o, i) => {
    let cl = ""; if (pk !== undefined && ans !== null) { if (i === ans) cl = "ok"; else if (i === pk) cl = "no"; } else if (pk === i) cl = "sel";
    return `<button class="opt ${cl}" data-a="mq" data-v="${i}" ${pk !== undefined ? "disabled" : ""}>${optLabel(q, i)}</button>`;
  }).join("") + `</div>`;
  if (pk !== undefined) {
    if (ans === null) h += `<div class="muted" style="margin-top:8px">정답 미확인</div>`;
    else h += `<div class="msg ${pk === ans ? "ok" : "no"}">${pk === ans ? "정답" : "오답 → 정답 " + CIRC[ans]}</div>`;
    if (q.why) h += `<details open><summary>해설 보기</summary>${esc(q.why)}</details>`;
  }
  const allDone = Q.every((x, i) => d.pick[i] !== undefined);
  h += `<div class="row">${d.q ? `<button class="btn ghost" data-a="mqmove" data-v="-1">이전</button>` : ""}${d.q < Q.length - 1 ? `<button class="btn pri" data-a="mqmove" data-v="1" ${pk === undefined ? "disabled" : ""}>다음</button>` : `<button class="btn pri" data-a="go" data-v="5" ${allDone ? "" : "disabled"}>서술형</button>`}</div>`;
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
function drillWrite() {
  const d = st.dr, W = P.write[d.lv];
  let h = `<div class="tabs">` + P.write.map((w, i) => `<button class="${i === d.lv ? "on" : ""}" data-a="lv" data-v="${i}">Lv${w.lv} ${esc(w.name)}</button>`).join("") + `</div>`;
  h += `<div class="box">${esc(W.ctx).replace("________", `<span class="blank"></span>`)}</div>`;
  if (W.ko) h += `<div class="muted">우리말: ${esc(W.ko)}</div>`;
  if (W.cond) h += `<div class="cond"><b>조건</b><ol>${W.cond.map(c => `<li>${esc(c)}</li>`).join("")}</ol></div>`;
  if (W.bogi) h += `<div class="muted">&lt;보기&gt;</div><div class="bogi">${W.bogi.map(b => `<span>${esc(b)}</span>`).join("")}</div>`;
  const res = d.res[d.lv];
  if (W.tiles) {
    const t = d.tiles[d.lv] || (d.tiles[d.lv] = { pool: shuffle(W.tiles.map((w, i) => i)), line: [] });
    h += `<div class="ansline">${t.line.map((ti, k) => `<button class="tile" data-a="tout" data-v="${k}">${esc(W.tiles[ti])}</button>`).join("")}</div>
        <div class="bogi">${t.pool.map((ti, k) => `<button class="tile" data-a="tin" data-v="${k}">${esc(W.tiles[ti])}</button>`).join("")}</div>`;
  } else h += `<textarea id="wr" placeholder="빈칸에 들어갈 문장">${esc(d.text[d.lv] || "")}</textarea>`;
  h += `<div class="row"><button class="btn pri" data-a="wgrade">채점</button>${res ? `<button class="btn ghost" data-a="wreset">다시</button>` : ""}</div>`;
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
  h += `<div class="row" style="margin-top:22px">${isDone ? `<span class="pill g">완료한 지문</span>` : `<button class="btn pri" data-a="finish">지문 완료</button>`}<button class="btn ghost" data-a="back">목록</button></div>`;
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
function afterRender() { wbHide(); try { wrapWords(); } catch (err) { /* 말풍선 실패가 화면을 막지 않게 */ } }
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
    case "step": { const n = +v; if (n > st.maxStep) return; st.step = n; window.scrollTo(0, 0); break; }
    case "vskip": bump(1); st.step = 1; break;
    case "vstart": { const V = curV(), W = curWords(); vStart(V, W); break; }
    case "vpick": {
      vPick(curV(), curWords(), +v); render();
      /* 단어 테스트는 보기 칸 색(ok/no)만 바뀌어 짜잔이 못 알아본다. 직접 넘긴다(2026-10-09) */
      if (window.ZZ) { const no = root.querySelector(".opts .opt.no"), ok = root.querySelector(".opts .opt.ok"); if (no) ZZ.no(no); else if (ok) ZZ.ok(ok); }
      return;
    }
    case "vnext": {
      const V = curV(), fin = vNext(V, curWords());
      if (fin && nav.tab === "p") { bump(1); recordWords(P.words, P.id); }
      break;
    }
    case "annext": { const an = st.an; an.note = -1; if (an.k < 3) an.k++; else { an.si++; an.k = 0; } break; }
    case "anprev": { const an = st.an; an.note = -1; if (an.k > 0) an.k--; else if (an.si > 0) { an.si--; an.k = 3; } break; }
    case "anend": bump(2); st.step = 2; window.scrollTo(0, 0); break;
    case "bgtog": st.an.bg = st.an.bg === false; break;
    case "note": st.an.note = st.an.note === +v ? -1 : +v; break;
    case "svshow": { const s = P.sentences[P.checks[c.i].si]; c.found = { S: s.main.map((x, k) => k), V: s.main.map((x, k) => k) }; c.ph = "done"; c.ok = false; c.pop = []; c.msg = "정답 확인"; break; }
    case "go": { const n = +v; bump(n); st.step = n; window.scrollTo(0, 0); break; }
    case "ckpick": { c.pick = +v; if (+v === P.checks[c.i].a) c.score++; break; }
    case "cknext": c.i++; c.ph = "S"; svInit(c); c.pop = []; c.flash = null; c.miss = 0; c.msg = ""; c.pick = null; break;
    case "ch": if (!d.graded) d.ch[+b.dataset.n] = +v; break;
    case "chgrade": d.graded = true; break;
    case "chreset": d.ch = {}; d.graded = false; break;
    case "mq": d.pick[d.q] = +v; break;
    case "mqmove": d.q += +v; window.scrollTo(0, 0); break;
    case "lv": d.lv = +v; break;
    case "tin": { const t = d.tiles[d.lv]; t.line.push(t.pool.splice(+v, 1)[0]); delete d.res[d.lv]; break; }
    case "tout": { const t = d.tiles[d.lv]; t.pool.push(t.line.splice(+v, 1)[0]); delete d.res[d.lv]; break; }
    case "wgrade": {
      const W = P.write[d.lv];
      const raw = W.tiles ? (d.tiles[d.lv].line.map(i => W.tiles[i]).join(" ")) : (d.text[d.lv] || "");
      d.res[d.lv] = gradeWrite(W, raw); break;
    }
    case "wreset": delete d.res[d.lv]; d.text[d.lv] = ""; if (d.tiles[d.lv]) delete d.tiles[d.lv]; break;
    case "finish": {
      const dm = doneMap(); dm[st.pid] = Date.now(); LS.set("done", dm); markAtt();
      const pr = LS.get("prog." + st.pid, {}); pr.done = true; pr.max = 5; LS.set("prog." + st.pid, pr);
      nav.tab = nav.back || "home"; break;
    }
  }
  render();
});
render();
