"use strict";
/* 모두의 영어 — 출제 지도 어댑터(이름 1111 대표님: 영어는 합격이 아니라 등급이라 「합격 지도」가 안 맞는다) (화면표준 11절). 공용 js/tera-map.js?v=1111g 에 앱 자료를 groups → nodes → leaves 로 넘긴다.
   줄 = 기출 유형 · 문법 · 서술형 · 단어. 해마다 문항 수(avg)는 평가원(모평·수능) 기출 문항 색인에서 센 값만 쓰고, 없는 줄은 비워 둔다.
   app.js 의 INDEX · LS · doneMap · weekWords 등과 drill.js 의 화면을 호출 시점에 쓴다. */
(function () {
  const loadJs = (src, ready) => new Promise((res, rej) => {
    if (ready()) return res();
    const s = document.createElement("script"); s.src = src; s.onload = () => (ready() ? res() : rej(new Error("데이터 없음"))); s.onerror = () => rej(new Error("파일을 불러오지 못했다")); document.head.appendChild(s);
  });
  const prep = () => Promise.all([
    loadJs("js/tera-map.js?v=1111g", () => window.TERA_MAP),
    loadJs("data/drill_grammar.js", () => window.MYE_DG),
    loadJs("data/gramfreq.js?v=1111e", () => window.MYE_GF).catch(() => { window.MYE_GF = {}; })
  ]);
  const pct = (c, t) => (t ? Math.round(100 * c / t) : 0);
  const fire = (a, v) => { const b = document.createElement("button"); b.dataset.a = a; if (v != null) b.dataset.v = v; root.appendChild(b); b.click(); b.remove(); };
  const fireD = (d, v) => { const b = document.createElement("button"); b.dataset.d = d; if (v != null) b.dataset.v = v; document.body.appendChild(b); b.click(); b.remove(); };
  const later = (fn, n) => { let k = 0; const t = setInterval(() => { k++; try { if (fn() || k > (n || 40)) clearInterval(t); } catch (e) { clearInterval(t); } }, 100); };
  const bookOf = e => (e.k === "EBS교재" ? (/영어독해연습/.test(e.n) ? "독연" : /수능완성/.test(e.n) ? "수완" : "수특") : "기출");

  function typeRow() {
    const IDX = window.MYE_INDEX || [], done = doneMap(), types = {};
    const evalY = new Set(IDX.filter(e => e.k === "모평" || e.k === "수능").map(e => e.h));
    const hakY = new Set(IDX.filter(e => e.k === "학평").map(e => e.h));
    IDX.forEach(e => e.p.forEach(p => {
      const t = types[p[2]] || (types[p[2]] = { n: p[2], c: { 평가원: 0, 학평: 0, EBS: 0 }, r: { 평가원: [0, 0], 학평: [0, 0], EBS: [0, 0] }, list: [] });
      const g = e.k === "모평" || e.k === "수능" ? "평가원" : e.k === "학평" ? "학평" : e.k === "EBS교재" ? "EBS" : null;
      if (!g) return;
      t.c[g]++;
      if (p[3]) { t.r[g][1]++; if (done[p[0]]) t.r[g][0]++; t.list.push({ id: p[0], g, done: !!done[p[0]] }); }
    }));
    const next = (t, g) => { const x = t.list.find(y => !y.done && (!g || y.g === g)); return x ? x.id : null; };
    const go = (t, g) => () => { const id = next(t, g) || next(t); if (id) openPassage(id, "map"); else fire("tab", "explore"); };
    return Object.values(types).sort((a, b) => (b.c.평가원 + b.c.학평 + b.c.EBS) - (a.c.평가원 + a.c.학평 + a.c.EBS)).map(t => {
      const rd = t.r.평가원[1] + t.r.학평[1] + t.r.EBS[1], dn = t.r.평가원[0] + t.r.학평[0] + t.r.EBS[0];
      const avg = evalY.size && t.c.평가원 ? Math.max(1, Math.round(t.c.평가원 / evalY.size)) : 0;
      return { id: "t:" + t.n, name: t.n, avg, pct: pct(dn, rd), go: go(t), ty: t.n };   /* 출처(모평·수능/학평/EBS)는 세부 단원이 아니라 leaves 를 주지 않는다(11-10 3.1) */
    });
  }

  function gramRow() {
    const DG = window.MYE_DG, st = LS.get("dg.stat", {});
    return DG.cats.map(([ck, cn, lst]) => {
      const leaves = lst.map(g => { const s = st[g] || [0, 0]; return { name: DG.ids[g][0], pct: pct(s[0], s[1]), g, go: () => { fire("tab", "gram"); later(() => { const b = document.querySelector('[data-d="gstart"][data-v="' + g + '"]'); if (b) { b.click(); return true; } }); } }; });
      const worst = leaves.slice().sort((a, b) => a.pct - b.pct)[0];
      const GF = window.MYE_GF || {};
      return { id: "g:" + ck, name: cn, pct: Math.round(leaves.reduce((s, l) => s + l.pct, 0) / Math.max(1, leaves.length)), leaves, go: worst && worst.go, f: lst.reduce((s, g) => s + (GF[g] || 0), 0) };
    }).sort((a, b) => b.f - a.f).map((n, i, arr) => { const r = i / Math.max(1, arr.length); n.star = n.f ? (r < .2 ? 3 : r < .5 ? 2 : 1) : 1; return n; });
  }

  function writRow() {
    const st = LS.get("dw.stat", {});
    const T = [["cw2", "조건 영작 Lv2", "cw", 2], ["cw3", "조건 영작 Lv3", "cw", 3], ["cw4", "조건 영작 Lv4", "cw", 4], ["ef", "오류 고쳐 쓰기", "ef"], ["sm", "요약문 완성", "sm"], ["ar", "배열", "ar"]];
    return T.map(([ck, nm, tab, lv]) => {
      const s = st[ck] || [0, 0];
      return { id: "s:" + ck, name: nm, pct: pct(s[0], s[1]), go: () => { fire("tab", "writ"); later(() => { if (!document.querySelector('[data-d="wtab"]')) return false; fireD("wtab", tab); if (lv) fireD("wlv", lv); later(() => { const st = document.querySelector('[data-d="wstart"]'); if (!st) return false; st.click(); return true; }); return true; }); } };
    });
  }

  function wordRow() {
    const IDX = window.MYE_INDEX || [], rows = {};
    IDX.forEach(e => e.p.forEach(p => {
      if (!p[3]) return;
      const b = bookOf(e), r = rows[b] || (rows[b] = { n: 0, ok: 0, next: null });
      r.n++;
      const pr = LS.get("prog." + p[0], {});
      if (pr.max >= 1 || pr.done) r.ok++; else if (!r.next) r.next = p[0];
    }));
    return ["기출", "수특", "독연", "수완"].filter(b => rows[b]).map(b => ({
      id: "w:" + b, name: b + " 단어", pct: pct(rows[b].ok, rows[b].n),
      go: () => { if (rows[b].next) openPassage(rows[b].next, "map"); else fire("tab", "words"); }
    }));
  }

  function mount(host) {
    host.innerHTML = '<div class="loading">불러오는 중</div>';
    prep().then(() => {
      if (!document.body.contains(host)) return;
      const dd = typeof ddayInfo === "function" ? ddayInfo() : null;
      /* 출제 지도(1111): 시험에 무엇이 얼마나 나오는지만 싣는다. 유형은 다섯 묶음으로 나눠 묶음마다 출제 비율이 보이게 하고,
         문법은 평가원 지문에서 센 빈도로 별을 매긴다. 출제 자료가 없는 서술형 · 단어 줄은 뺐다(드릴 · 단어장 탭에 있다) */
      const TG = [["대의 파악", ["목적", "심경", "주장", "요지", "주제", "제목"]], ["빈칸 추론", ["빈칸", "함의"]], ["글의 흐름", ["무관한문장", "순서", "삽입"]], ["어법 · 어휘", ["어법", "어휘", "지칭"]], ["요약 · 장문", ["요약", "장문"]]];
      const TR = typeRow(), used = {};
      const groups = TG.map(([name, ks]) => ({ name, nodes: TR.filter(n => ks.includes(n.ty) && (used[n.ty] = 1)) })).filter(g => g.nodes.length);
      const rest = TR.filter(n => !used[n.ty]); if (rest.length) groups.push({ name: "그 밖의 유형", nodes: rest });
      groups.push({ name: "문법", nodes: gramRow() });
      const o = {
        title: "출제 지도", sub: "영어", mark: "star", dday: dd ? dd.txt : "", unit: "문항", groups,
        onStart: n => n.go && n.go(), onLeaf: l => l.go && l.go()
      };
      window.TERA_MAP.mount(host, o);
    }).catch(e => { host.innerHTML = '<div class="loading">' + String(e.message || e) + "</div>"; });
  }
  window.ENGMAP = { mount };
})();
