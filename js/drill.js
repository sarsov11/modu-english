"use strict";
/* 문법 드릴 · 서술형 드릴 (설계.md 마지막 절). app.js 의 LS, esc, shuffle, norm, diff, gradeWrite, nav, render 를 호출 시점에 사용한다.
   데이터: data/drill_grammar.js(색인) + drill_g_<범주>.js, data/drill_writing.js(색인) + drill_w_<묶음>.js 를 처음 열 때 지연 로딩한다. */
(function () {
  const CIR = "①②③④⑤";
  const loadJs = (src, ready) => new Promise((res, rej) => {
    if (ready()) return res();
    const s = document.createElement("script");
    s.src = "data/" + src;
    s.onload = () => (ready() ? res() : rej(new Error("데이터 없음")));
    s.onerror = () => rej(new Error("파일을 불러오지 못했다"));
    document.head.appendChild(s);
  });
  const top = (name, extra, back) => `<div class="top">${back ? `<button class="back" data-d="${back}">‹</button>` : ""}<div class="brand">${esc(name)}</div>${extra ? `<div class="pid">${extra}</div>` : ""}</div>`;
  const pct = (c, t) => (t ? Math.round(100 * c / t) : null);
  const rateCls = r => (r === null ? "" : r >= 80 ? "g" : r < 60 ? "r" : "");
  function bl(total, st, cur) {   /* 징검다리: st(i) 0 미응답, 1 맞음, 2 틀림 */
    let h = `<div class="blk">`;
    for (let i = 0; i < total; i++) h += (i ? `<span class="ln"></span>` : "") + `<span class="b ${st(i) === 1 ? "done" : st(i) === 2 ? "bad" : ""} ${i === cur ? "cur" : ""}"></span>`;
    return h + `</div>`;
  }
  const loadingView = (name, back) => top(name, "", back) + `<div class="loading">불러오는 중</div>`;
  const errView = (name, msg) => top(name) + `<div class="wrap"><div class="loading">${esc(msg)}</div></div>`;
  const toks = s => s.split(" ");
  /* 문장에서 [a,b] 어절 구간에 밑줄 */
  function underl(s, r) {
    const T = toks(s);
    return esc(T.slice(0, r[0]).join(" ")) + (r[0] ? " " : "") + `<u>${esc(T.slice(r[0], r[1] + 1).join(" "))}</u>` + (r[1] + 1 < T.length ? " " : "") + esc(T.slice(r[1] + 1).join(" "));
  }

  /* ───────────────────────── 문법 ───────────────────────── */
  const gs = { screen: "list", sort: null, loading: false, err: "", gid: null, set: [], i: 0, rec: true, streak: 0 };
  const gstat = () => LS.get("dg.stat", {});
  const gtitle = g => (window.MYE_DG.ids[g] || ["기타 어법"])[0];

  function gram() {
    if (!window.MYE_DG) {
      if (!gs.loading) {
        gs.loading = true;
        loadJs("drill_grammar.js", () => window.MYE_DG).then(() => { gs.loading = false; render(); }).catch(e => { gs.loading = false; gs.err = e.message; render(); });
      }
      return gs.err ? errView("문법", gs.err) : loadingView("문법");
    }
    if (gs.screen === "load") return loadingView("문법", "glist");
    if (gs.screen === "q") return gQ();
    if (gs.screen === "res") return gRes();
    return gList();
  }

  function gList() {
    const DG = window.MYE_DG, st = gstat(), ids = DG.ids;
    const rate = g => (st[g] && st[g][1] ? st[g][0] / st[g][1] : null);
    const any = Object.keys(st).some(g => st[g][1]);
    const sort = gs.sort || (any ? "weak" : "cat");
    const row = (g, showCat) => {
      const n = ids[g][3], r = pct((st[g] || [0, 0])[0], (st[g] || [0, 0])[1]);
      const cat = DG.cats.find(c => c[0] === ids[g][2]);
      return `<button class="it" data-d="gstart" data-v="${esc(g)}"><span class="tt">${esc(ids[g][0])}${showCat && cat ? `<span class="sub">${esc(cat[1])}</span>` : ""}</span><span class="pill">${n}문항</span><span class="pill ${rateCls(r)}">${r === null ? "–" : r + "%"}</span></button>`;
    };
    let h = top("문법", DG.n + "문항") + `<div class="wrap">`;
    if (gs.err) h += `<div class="msg no">${esc(gs.err)}</div>`;
    h += `<div class="seg"><button class="${sort === "weak" ? "on" : ""}" data-d="gsort" data-v="weak">약한 순</button><button class="${sort === "cat" ? "on" : ""}" data-d="gsort" data-v="cat">범주</button></div>`;
    h += `<div class="muted" style="display:flex;justify-content:flex-end;gap:14px"><span>문항 수</span><span>내 정답률</span></div>`;
    if (sort === "cat") {
      DG.cats.forEach(([ck, cn, lst]) => { h += `<h3>${esc(cn)}</h3><div class="plist">` + lst.map(g => row(g, false)).join("") + `</div>`; });
    } else {
      const all = Object.keys(ids);
      const tried = all.filter(g => rate(g) !== null).sort((a, b) => rate(a) - rate(b) || ids[b][3] - ids[a][3]);
      const rest = all.filter(g => rate(g) === null).sort((a, b) => ids[b][3] - ids[a][3]);
      h += `<div class="plist">` + tried.concat(rest).map(g => row(g, true)).join("") + `</div>`;
    }
    return h + `</div>`;
  }

  function gPrep(it) {
    const o = Object.assign({}, it);
    if (it.t === "c") { o.opts = shuffle([it.a, it.x]); o.ai = o.opts.indexOf(it.a); o.q = "알맞은 쪽 고르기"; }
    else if (it.t === "n") { const T = [gtitle(it.g)].concat(it.dx.map(gtitle)); o.opts = shuffle(T); o.ai = o.opts.indexOf(gtitle(it.g)); o.q = "밑줄 친 부분의 쓰임"; }
    else { o.opts = it.o; o.ai = it.a; }
    o.pick = undefined;
    return o;
  }
  function gStart(g) {
    const cat = window.MYE_DG.ids[g][2];
    gs.gid = g; gs.err = ""; gs.screen = "load"; render();
    loadJs("drill_g_" + cat + ".js", () => window.MYE_DGC && window.MYE_DGC[cat]).then(() => { gMake(g); render(); window.scrollTo(0, 0); })
      .catch(e => { gs.err = e.message; gs.screen = "list"; render(); });
  }
  function gMake(g) {
    const all = window.MYE_DGC[window.MYE_DG.ids[g][2]][g];
    const seen = LS.get("dg.seen", {});
    let sg = seen[g] || {}, pool = all.filter(it => !sg[it.p + "/" + it.k]);
    if (pool.length < Math.min(10, all.length)) { pool = all; seen[g] = {}; LS.set("dg.seen", seen); }
    gs.set = shuffle(pool).slice(0, 10).map(gPrep);
    gs.i = 0; gs.rec = true; gs.streak = 0; gs.screen = "q";
  }
  function shortWhy(it) {
    const e = (window.MYE_DG.ids[it.g] || [])[1] || "";
    const w = it.why || "";
    const rest = e && w.startsWith(e) ? w.slice(e.length).trim() : w;
    return rest || e || w;
  }
  function gSentHtml(it, done) {
    if (it.t === "c") return esc(it.pre) + (done ? `<b class="okw">${esc(it.a)}</b>` : `<span class="blank"></span>`) + esc(it.post);
    return underl(it.s, it.r);
  }
  function gExplain(it) {
    let h = "";
    if (it.t === "c") h += `<div class="fix">${esc(it.pre)}<del>${esc(it.x)}</del> <ins>${esc(it.a)}</ins>${esc(it.post)}</div>`;
    else if (it.t === "n") h += `<div class="fix">${underl(it.s, it.r)}</div><div><b>${esc(gtitle(it.g))}</b></div>`;
    else h += `<div class="fix">${underl(it.s, it.r)}</div>`;
    return h + `<div>${esc(it.why)}</div><div class="muted" style="margin-top:6px">${esc(it.l)}</div>`;
  }
  function gQ() {
    const n = gs.set.length, it = gs.set[gs.i], done = it.pick !== undefined, ok = done && it.pick === it.ai;
    let h = top(gtitle(gs.gid), (gs.i + 1) + " / " + n, "glist") + `<div class="wrap">`;
    h += bl(n, k => (gs.set[k].pick === undefined ? 0 : gs.set[k].pick === gs.set[k].ai ? 1 : 2), gs.i);
    h += `<div class="muted">${n - gs.i - (done ? 1 : 0)} 남음${gs.rec ? "" : " / 오답 모아풀기"}</div>`;
    h += `<div class="qhead" style="margin-top:12px">${esc(it.q)}</div><div class="box">${gSentHtml(it, done)}</div>`;
    h += `<div class="opts">` + it.opts.map((o, i) => {
      let c = ""; if (done) { if (i === it.ai) c = "ok"; else if (i === it.pick) c = "no"; }
      return `<button class="opt ${c}" data-d="gpick" data-v="${i}" ${done ? "disabled" : ""}>${it.t === "c" ? esc(o) : CIR[i] + " " + esc(o)}</button>`;
    }).join("") + `</div>`;
    if (done) {
      h += `<div class="msg ${ok ? "ok" : "no"}" style="margin-top:10px">${ok ? "✓ 정답" + (gs.streak >= 3 ? " " + gs.streak + "연속" : "") : "오답 → 정답 " + esc(it.opts[it.ai])}</div>`;
      if (!ok) h += `<div class="why">${esc(shortWhy(it))}</div>`;
      h += `<details><summary>해설 보기</summary>${gExplain(it)}</details>`;
      h += `<div class="row"><button class="btn pri" data-d="gnext">${gs.i < n - 1 ? "다음" : "결과"}</button></div>`;
    }
    return h + `</div>`;
  }
  function gPick(i) {
    const it = gs.set[gs.i]; if (it.pick !== undefined) return;
    it.pick = i;
    const ok = i === it.ai;
    gs.streak = ok ? gs.streak + 1 : 0;
    if (gs.rec) {
      const st = gstat(); const s = st[it.g] || (st[it.g] = [0, 0]); s[1]++; if (ok) s[0]++; LS.set("dg.stat", st);
      const seen = LS.get("dg.seen", {}); (seen[it.g] || (seen[it.g] = {}))[it.p + "/" + it.k] = 1; LS.set("dg.seen", seen);
    }
  }
  function gRes() {
    const n = gs.set.length, sc = gs.set.filter(x => x.pick === x.ai).length, bad = gs.set.filter(x => x.pick !== x.ai);
    let h = top(gtitle(gs.gid), "", "glist") + `<div class="wrap"><h2>결과</h2><div class="today"><b>${sc} / ${n}</b></div>` +
      bl(n, k => (gs.set[k].pick === gs.set[k].ai ? 1 : 2), -1);
    h += `<div class="row">` + (bad.length ? `<button class="btn pri" data-d="gwrong">오답 모아풀기</button>` : "") + `<button class="btn ${bad.length ? "ghost" : "pri"}" data-d="gagain">↻ 재도전</button><button class="btn ghost" data-d="glist">목록</button></div>`;
    h += `<div style="margin-top:8px">` + gs.set.map((it, k) => {
      const ok = it.pick === it.ai;
      const sent = it.t === "c" ? it.pre + it.a + it.post : it.s;
      return `<div class="exp"><span class="pill ${ok ? "g" : "r"}">${ok ? "✓" : "✗"} ${k + 1}</span> ${esc(sent)}` +
        (ok ? "" : `<details><summary>해설 보기</summary>${gExplain(it)}</details>`) + `</div>`;
    }).join("") + `</div>`;
    return h + `</div>`;
  }

  /* ───────────────────────── 서술형 ───────────────────────── */
  const ws = { tab: "cw", lv: 2, scope: { k: "all", v: "" }, screen: "setup", set: [], i: 0, rec: true, loading: false, err: "" };
  const WTABS = [["cw", "조건 영작"], ["ef", "오류 고쳐 쓰기"], ["sm", "요약문 완성"], ["ar", "배열"]];
  const SETN = { cw: 5, ef: 10, sm: 5, ar: 10 };
  const ckey = () => (ws.tab === "cw" ? "cw" + ws.lv : ws.tab);
  const wstat = () => LS.get("dw.stat", {});

  function countFor(ck) {
    const D = window.MYE_DW, s = ws.scope;
    if (s.k === "all") return D.T[ck] || 0;
    if (s.k === "book") return Object.values(D.U).filter(u => u[2] === s.v).reduce((a, u) => a + (u[3][ck] || 0), 0);
    if (s.k === "uid") return D.U[s.v] ? (D.U[s.v][3][ck] || 0) : 0;
    if (s.k === "g") return ws.tab === "ef" && D.G[s.v] ? D.G[s.v][1] : 0;
    return 0;
  }
  function writ() {
    if (!window.MYE_DW) {
      if (!ws.loading) {
        ws.loading = true;
        loadJs("drill_writing.js", () => window.MYE_DW).then(() => { ws.loading = false; render(); }).catch(e => { ws.loading = false; ws.err = e.message; render(); });
      }
      return ws.err ? errView("서술형", ws.err) : loadingView("서술형");
    }
    if (ws.screen === "load") return loadingView("서술형", "wback");
    if (ws.screen === "q") return wQ();
    if (ws.screen === "res") return wRes();
    return wSetup();
  }
  function wSetup() {
    const D = window.MYE_DW, s = ws.scope, ck = ckey();
    if (s.k === "g" && ws.tab !== "ef") { s.k = "all"; s.v = ""; }
    let h = top("서술형", D.n + "문항") + `<div class="wrap">`;
    if (ws.err) h += `<div class="msg no">${esc(ws.err)}</div>`;
    h += `<div class="tabs w4">` + WTABS.map(([k, n]) => `<button class="${ws.tab === k ? "on" : ""}" data-d="wtab" data-v="${k}">${n}</button>`).join("") + `</div>`;
    if (ws.tab === "cw") h += `<div class="seg">` + [2, 3, 4].map(l => `<button class="${ws.lv === l ? "on" : ""}" data-d="wlv" data-v="${l}">Lv${l}</button>`).join("") + `</div>`;
    h += `<h3>범위</h3><div class="seg">` + [["all", "전체"], ["book", "교재"], ["uid", "회차"]].concat(ws.tab === "ef" ? [["g", "문법 항목"]] : [])
      .map(([k, n]) => `<button class="${s.k === k ? "on" : ""}" data-d="wscope" data-v="${k}">${n}</button>`).join("") + `</div>`;
    if (s.k === "book") h += `<div class="seg">` + D.books.map(b => `<button class="${s.v === b ? "on" : ""}" data-d="wbook" data-v="${esc(b)}">${esc(b)}</button>`).join("") + `</div>`;
    if (s.k === "uid") {
      const us = Object.keys(D.U).filter(u => D.U[u][3][ck]).sort((a, b) => D.U[a][0].localeCompare(D.U[b][0], "ko", { numeric: true }));
      h += `<select class="inp" data-di="wuid"><option value="">회차 선택</option>` + us.map(u => `<option value="${esc(u)}" ${s.v === u ? "selected" : ""}>${esc(D.U[u][0])} (${D.U[u][3][ck]})</option>`).join("") + `</select>`;
    }
    if (s.k === "g") {
      const gs2 = Object.keys(D.G).sort((a, b) => D.G[b][1] - D.G[a][1]);
      h += `<select class="inp" data-di="wg"><option value="">문법 항목 선택</option>` + gs2.map(g => `<option value="${esc(g)}" ${s.v === g ? "selected" : ""}>${esc(D.G[g][0])} (${D.G[g][1]})</option>`).join("") + `</select>`;
    }
    const n = (s.k === "all" || s.v) ? countFor(ck) : 0, st = wstat()[ck];
    h += `<div class="today" style="margin-top:18px"><b>${n}</b><span class="muted">문항</span>${st && st[1] ? `<span class="pill ${rateCls(pct(st[0], st[1]))}">내 정답률 ${pct(st[0], st[1])}%</span>` : ""}</div>`;
    h += `<div class="row"><button class="btn pri" data-d="wstart" ${n ? "" : "disabled"}>시작</button></div>`;
    return h + `</div>`;
  }
  function wStart() {
    const D = window.MYE_DW, s = ws.scope, ck = ckey();
    let us = Object.keys(D.U).filter(u => D.U[u][3][ck]);
    if (s.k === "book") us = us.filter(u => D.U[u][2] === s.v);
    if (s.k === "uid") us = us.filter(u => u === s.v);
    const groups = [...new Set(us.map(u => D.U[u][1]))];
    ws.err = ""; ws.screen = "load"; render();
    Promise.all(groups.map(g => loadJs("drill_w_" + g + ".js", () => window.MYE_DWC && window.MYE_DWC[g]))).then(() => {
      let pool = [];
      groups.forEach(g => window.MYE_DWC[g].forEach(it => {
        if ((ws.tab === "cw" ? it.t === "cw" && it.lv === ws.lv : it.t === ws.tab) && (s.k !== "uid" || it.u === s.v) && (s.k !== "book" || D.U[it.u][2] === s.v) && (s.k !== "g" || it.g === s.v)) pool.push(it);
      }));
      const seen = LS.get("dw.seen", {}), sg = seen[ck] || {};
      let fresh = pool.filter(it => !sg[it.p + "/" + it.k]);
      const nn = Math.min(SETN[ws.tab], pool.length);
      if (fresh.length < nn) { fresh = pool; seen[ck] = {}; LS.set("dw.seen", seen); }
      ws.set = shuffle(fresh).slice(0, nn).map(wPrep);
      ws.i = 0; ws.rec = true; ws.screen = ws.set.length ? "q" : "setup"; render(); window.scrollTo(0, 0);
    }).catch(e => { ws.err = e.message; ws.screen = "setup"; render(); });
  }
  function wPrep(it) {
    const o = Object.assign({}, it);
    o.st = { text: "", sel: null, a: "", b: "", tiles: it.tiles ? { pool: shuffle(it.tiles.map((w, i) => i)), line: [] } : null };
    o.res = null;
    return o;
  }
  const cur = () => ws.set[ws.i];
  const wTypeName = it => (it.t === "cw" ? "조건 영작 Lv" + it.lv : it.t === "ef" ? "오류 고쳐 쓰기" : it.t === "sm" ? "요약문 완성" : "배열");

  function writeBlock(it) {
    const st = it.st, res = it.res;
    let h = `<div class="box">${esc(it.ctx).replace("________", `<span class="blank"></span>`)}</div>`;
    if (it.ko) h += `<div class="muted">우리말: ${esc(it.ko)}</div>`;
    if (it.cond) h += `<div class="cond"><b>조건</b><ol>${it.cond.map(c => `<li>${esc(c)}</li>`).join("")}</ol></div>`;
    if (it.bogi) h += `<div class="muted">&lt;보기&gt;</div><div class="bogi">${it.bogi.map(b => `<span>${esc(b)}</span>`).join("")}</div>`;
    if (it.tiles) {
      const t = st.tiles;
      h += `<div class="ansline">${t.line.map((ti, k) => `<button class="tile" data-d="wtout" data-v="${k}" ${res ? "disabled" : ""}>${esc(it.tiles[ti])}</button>`).join("")}</div>
        <div class="bogi">${t.pool.map((ti, k) => `<button class="tile" data-d="wtin" data-v="${k}" ${res ? "disabled" : ""}>${esc(it.tiles[ti])}</button>`).join("")}</div>`;
    } else h += `<textarea data-di="wtext" placeholder="빈칸에 들어갈 문장" ${res ? "disabled" : ""}>${esc(st.text)}</textarea>`;
    if (res) {
      if (res.feat) {
        h += `<div class="today" style="margin-top:10px"><b>${res.score} / ${res.total}</b><span class="muted">${res.wc}단어 (최대 ${it.max})</span></div>`;
        h += `<div class="card" style="padding:10px 14px">` + res.feat.map(f => `<div class="exp"><span class="pill ${f.ok ? "g" : "r"}">${f.ok ? "맞음" : "틀림"}</span> ${esc(f.lab)} <span class="muted">${f.pt}점</span></div>`).join("") + (res.over ? `<div class="exp"><span class="pill r">초과</span> 단어 수 초과 → 0점</div>` : "") + `</div>`;
      }
      h += `<div class="msg ${res.ok ? "ok" : "no"}">${res.ok ? "✓ 정답" : "고쳐 쓴 문장"}</div>`;
      if (!res.ok) h += `<div class="fix">${res.ops.map(([t, w]) => t === "eq" ? esc(w) : t === "del" ? `<del>${esc(w)}</del>` : `<ins>${esc(w)}</ins>`).join(" ")}</div>`;
      h += `<details><summary>해설 보기</summary><div class="fix">${it.ans.map(a => esc(a)).join("<br>")}</div><div class="rubric">${esc(it.rub)}</div></details>`;
    }
    return h;
  }
  function efBlock(it) {
    const st = it.st, res = it.res, T = toks(it.s), [a, b] = it.w;
    let h = `<div class="qhead">어법상 틀린 부분을 눌러 바르게 고쳐 쓰기</div><div class="box efs">`;
    if (res) {
      h += esc(T.slice(0, a).join(" ")) + (a ? " " : "") + `<del>${esc(T.slice(a, b + 1).join(" "))}</del> <ins>${esc(it.a)}</ins>` + (b + 1 < T.length ? " " : "") + esc(T.slice(b + 1).join(" "));
    } else h += T.map((w, i) => `<button class="etk ${st.sel === i ? "sel" : ""}" data-d="esel" data-v="${i}">${esc(w)}</button>`).join(" ");
    h += `</div>`;
    if (!res) h += `<div class="muted">${st.sel === null ? "틀린 낱말 선택" : "선택: <b>" + esc(T[st.sel]) + "</b>"}</div>`;
    h += `<input class="inp" style="margin-top:10px" data-di="wef" placeholder="바르게 고친 표현" value="${esc(st.text)}" ${res ? "disabled" : ""} autocomplete="off" autocapitalize="off" spellcheck="false">`;
    if (res) {
      h += `<div class="msg ${res.ok ? "ok" : "no"}" style="margin-top:10px">${res.ok ? "✓ 정답" : (res.found ? "오답 → 고친 표현 " + esc(it.a) : "오답 → 틀린 부분 " + esc(it.x))}</div>`;
      h += `<details><summary>해설 보기</summary><div class="fix"><del>${esc(it.x)}</del> <ins>${esc(it.a)}</ins></div><div>${esc(it.why)}</div></details>`;
    }
    return h;
  }
  function smBlock(it) {
    const st = it.st, res = it.res;
    const hint = (k) => it.ans[k][0] + "_".repeat(Math.max(3, it.ans[k].length - 1));
    const sum = esc(it.sum).replace(/\(([AB])\)\s*_+/g, (m, ab) => `<b>(${ab})</b> <span class="hint">${esc(hint(ab === "A" ? 0 : 1))}</span>`);
    let h = `<div class="qhead">본문 요약문의 빈칸 완성 (첫 글자 제시)</div><div class="box">${esc(it.txt)}</div><div style="text-align:center;font-weight:900">↓</div><div class="box">${sum}</div>`;
    ["a", "b"].forEach((k, j) => {
      h += `<div class="row" style="margin:8px 0"><b style="min-width:30px">(${"AB"[j]})</b><input class="inp" style="flex:1" data-di="sm${k}" value="${esc(st[k])}" ${res ? "disabled" : ""} autocomplete="off" autocapitalize="off" spellcheck="false"></div>`;
    });
    if (res) {
      h += `<div class="msg ${res.ok ? "ok" : "no"}">${res.ok ? "✓ 정답" : "오답"}</div>`;
      h += ["a", "b"].map((k, j) => `<div class="exp"><span class="pill ${res[k] ? "g" : "r"}">(${"AB"[j]})</span> ${res[k] ? `<ins>${esc(it.ans[j])}</ins>` : (st[k].trim() ? `<del>${esc(st[k].trim())}</del> ` : "") + `<ins>${esc(it.ans[j])}</ins>`}</div>`).join("");
      if (it.why) h += `<details><summary>해설 보기</summary>${esc(it.why)}</details>`;
    }
    return h;
  }
  function wQ() {
    const n = ws.set.length, it = cur(), res = it.res;
    let h = top("서술형", (ws.i + 1) + " / " + n, "wback") + `<div class="wrap">`;
    h += bl(n, k => (ws.set[k].res ? (ws.set[k].res.ok ? 1 : 2) : 0), ws.i);
    h += `<div class="muted">${n - ws.i - (res ? 1 : 0)} 남음${ws.rec ? "" : " / 오답 모아풀기"}</div>`;
    h += `<div style="margin-top:10px"><span class="tag o">${esc(wTypeName(it))}</span><span class="muted">${esc(it.l)}</span></div>`;
    h += it.t === "ef" ? efBlock(it) : it.t === "sm" ? smBlock(it) : writeBlock(it);
    h += `<div class="row">` + (res ? `<button class="btn pri" data-d="wnext">${ws.i < n - 1 ? "다음" : "결과"}</button>` : `<button class="btn pri" data-d="wgrade2">채점</button>`) + `</div>`;
    return h + `</div>`;
  }
  function wGrade() {
    const it = cur(), st = it.st; if (it.res) return;
    if (it.t === "ef") {
      const found = st.sel !== null && st.sel >= it.w[0] && st.sel <= it.w[1];
      const textOk = norm(st.text).join(" ") === norm(it.a).join(" ");
      it.res = { found, textOk, ok: found && textOk };
    } else if (it.t === "sm") {
      const a = norm(st.a).join(" ") === norm(it.ans[0]).join(" "), b = norm(st.b).join(" ") === norm(it.ans[1]).join(" ");
      it.res = { a, b, ok: a && b };
    } else {
      const raw = it.tiles ? st.tiles.line.map(i => it.tiles[i]).join(" ") : st.text;
      it.res = gradeWrite(it, raw);
    }
    if (ws.rec) {
      const ck = it.t === "cw" ? "cw" + it.lv : it.t, S = wstat(), s = S[ck] || (S[ck] = [0, 0]); s[1]++; if (it.res.ok) s[0]++; LS.set("dw.stat", S);
      const seen = LS.get("dw.seen", {}); (seen[ck] || (seen[ck] = {}))[it.p + "/" + it.k] = 1; LS.set("dw.seen", seen);
    }
  }
  function wRes() {
    const n = ws.set.length, sc = ws.set.filter(x => x.res && x.res.ok).length, bad = ws.set.filter(x => !(x.res && x.res.ok));
    let h = top("서술형", "", "wback") + `<div class="wrap"><h2>결과</h2><div class="today"><b>${sc} / ${n}</b></div>` + bl(n, k => (ws.set[k].res && ws.set[k].res.ok ? 1 : 2), -1);
    h += `<div class="row">` + (bad.length ? `<button class="btn pri" data-d="wwrong">오답 모아풀기</button>` : "") + `<button class="btn ${bad.length ? "ghost" : "pri"}" data-d="wagain">↻ 재도전</button><button class="btn ghost" data-d="wback">범위</button></div><div style="margin-top:8px">`;
    h += ws.set.map((it, k) => {
      const ok = it.res && it.res.ok;
      let body = "";
      if (!ok) {
        if (it.t === "ef") body = `<div class="fix"><del>${esc(it.x)}</del> <ins>${esc(it.a)}</ins></div><div>${esc(it.why)}</div>`;
        else if (it.t === "sm") body = `<div class="fix"><ins>${esc(it.ans.join(" ― "))}</ins></div>`;
        else body = `<div class="fix">${it.ans.map(a => esc(a)).join("<br>")}</div><div class="rubric">${esc(it.rub)}</div>`;
      }
      return `<div class="exp"><span class="pill ${ok ? "g" : "r"}">${ok ? "✓" : "✗"} ${k + 1}</span> ${esc(wTypeName(it))} <span class="muted">${esc(it.l)}</span>${ok ? "" : `<details><summary>해설 보기</summary>${body}</details>`}</div>`;
    }).join("");
    return h + `</div></div>`;
  }

  /* ───────────────────────── 이벤트 ───────────────────────── */
  document.addEventListener("input", e => {
    const t = e.target, k = t.dataset && t.dataset.di; if (!k || nav.tab !== "writ" || ws.screen !== "q") return;
    const st = cur().st;
    if (k === "wtext" || k === "wef") st.text = t.value; else if (k === "sma") st.a = t.value; else if (k === "smb") st.b = t.value;
  });
  document.addEventListener("change", e => {
    const t = e.target, k = t.dataset && t.dataset.di; if (!k) return;
    if (k === "wuid" || k === "wg") { ws.scope.v = t.value; render(); }
  });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-d]"); if (!b) return;
    const a = b.dataset.d, v = b.dataset.v;
    let sc = true;
    switch (a) {
      case "gsort": gs.sort = v; break;
      case "glist": gs.screen = "list"; break;
      case "gstart": gStart(v); return;
      case "gpick": gPick(+v); sc = false; break;
      case "gnext": if (gs.i < gs.set.length - 1) gs.i++; else gs.screen = "res"; break;
      case "gagain": gStart(gs.gid); return;
      case "gwrong": gs.set = gs.set.filter(x => x.pick !== x.ai).map(x => { x.pick = undefined; return x; }); gs.i = 0; gs.rec = false; gs.streak = 0; gs.screen = "q"; break;
      case "wtab": ws.tab = v; ws.scope.v = ws.scope.k === "g" ? "" : ws.scope.v; break;
      case "wlv": ws.lv = +v; break;
      case "wscope": ws.scope = { k: v, v: "" }; break;
      case "wbook": ws.scope.v = v; break;
      case "wstart": wStart(); return;
      case "wback": ws.screen = "setup"; break;
      case "wagain": wStart(); return;
      case "wwrong": ws.set = ws.set.filter(x => !(x.res && x.res.ok)).map(wPrep); ws.i = 0; ws.rec = false; ws.screen = "q"; break;
      case "wnext": if (ws.i < ws.set.length - 1) ws.i++; else ws.screen = "res"; break;
      case "wgrade2": wGrade(); sc = false; break;
      case "esel": if (!cur().res) cur().st.sel = +v; sc = false; break;
      case "wtin": { const t = cur().st.tiles; t.line.push(t.pool.splice(+v, 1)[0]); sc = false; break; }
      case "wtout": { const t = cur().st.tiles; t.pool.push(t.line.splice(+v, 1)[0]); sc = false; break; }
      default: return;
    }
    render();
    if (sc) window.scrollTo(0, 0);
  });

  window.DRILL = { gram, writ };
})();
