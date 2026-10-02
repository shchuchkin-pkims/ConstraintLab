/* ConstraintLab – упрощённый статический временной анализ: тактовые сигналы, пути, соотношения фронтов, исключения */
(function (XT) {
  'use strict';
  const U = XT.util;
  const { Frac } = U;
  const objKey = XT.design.objKey;

  // ---------------------------------------------------------------------------
  // Постоянные значения (set_case_analysis, VCC/GND)
  // ---------------------------------------------------------------------------
  function computeConsts(S) {
    const D = S.design;
    const val = new Map();
    for (const [k, e] of S.db.caseAnalysis) if (e.value === '0' || e.value === '1') val.set(k, e.value);
    for (const c of D.cells.values()) if (c.lib.konst) for (const p of c.pins.values()) val.set(objKey(p), c.lib.konst);
    let changed = true, guard = 0;
    while (changed && guard++ < 200) {
      changed = false;
      for (const n of D.nets.values()) {
        const drv = n.driver;
        if (!drv) continue;
        const v = val.get(objKey(drv));
        if (v === undefined) continue;
        for (const m of n.members) { const k = objKey(m); if (!val.has(k)) { val.set(k, v); changed = true; } }
      }
      for (const c of D.cells.values()) {
        const outs = cellFunc(c, val);
        for (const [pn, v] of Object.entries(outs)) {
          const p = c.pins.get(pn);
          if (!p) continue;
          const k = objKey(p);
          if (!val.has(k)) { val.set(k, v); changed = true; }
        }
      }
    }
    return val;
  }
  function cellFunc(c, val) {
    const L = c.lib;
    const g = (pn) => { const p = c.pins.get(pn); return p ? val.get(objKey(p)) : undefined; };
    const out = {};
    const inv = (v) => (v === '0' ? '1' : '0');
    if (L.seq || L.pll || L.dyn) return out;
    if (L.mux) {
      const s = g(L.mux.sel);
      const op = L.arcsN.find((a) => a.from === L.mux.ins[0]).to;
      if (s === '0' || s === '1') { const v = g(L.mux.ins[s === '0' ? 0 : 1]); if (v !== undefined) out[op] = v; }
      else { const a = g(L.mux.ins[0]), b = g(L.mux.ins[1]); if (a !== undefined && a === b) out[op] = a; }
      return out;
    }
    if (L.gate) {
      const op = L.arcsN[0].to;
      const e = g(L.gate.pin);
      const alt = L.gate.alt ? g(L.gate.alt) : '0';
      if (e === '0' && alt === '0') out[op] = '0';
      else { const ck = g(L.arcsN[0].from); if (ck !== undefined && (e === '1' || alt === '1')) out[op] = ck; }
      return out;
    }
    if (L.func) {
      const A = g('A'), B = g('B');
      switch (L.func) {
        case 'buf': if (A !== undefined) out.Y = A; break;
        case 'inv': if (A !== undefined) out.Y = inv(A); break;
        case 'and': if (A === '0' || B === '0') out.Y = '0'; else if (A === '1' && B === '1') out.Y = '1'; break;
        case 'or': if (A === '1' || B === '1') out.Y = '1'; else if (A === '0' && B === '0') out.Y = '0'; break;
        case 'nand': if (A === '0' || B === '0') out.Y = '1'; else if (A === '1' && B === '1') out.Y = '0'; break;
        case 'nor': if (A === '1' || B === '1') out.Y = '0'; else if (A === '0' && B === '0') out.Y = '1'; break;
        case 'xor': if (A !== undefined && B !== undefined) out.Y = A === B ? '0' : '1'; break;
      }
      return out;
    }
    // простые буферы (IBUF, OBUF, BUFG …)
    for (const a of L.arcsN) {
      const v = g(a.from);
      if (v !== undefined && L.arcsN.filter((x) => x.to === a.to).length === 1) out[a.to] = a.neg ? inv(v) : v;
    }
    return out;
  }
  // Условная проверка библиотеки (when): отключена, если константа на управляющем выводе противоречит условию
  function capOff(C, cell, pin) {
    const w = cell.lib.when && cell.lib.when[pin];
    if (!w) return false;
    for (const [pn, need] of Object.entries(w)) {
      const p = cell.pins.get(pn);
      const v = p ? C.consts.get(objKey(p)) : undefined;
      if ((v === '0' || v === '1') && v !== need) return true;
    }
    return false;
  }
  function computeDisabled(S, consts) {
    const set = new Set();
    const D = S.design;
    for (const d of S.db.disable) {
      if (d.from === '*' && d.to === '*') { set.add(`${d.cell}|*|*`); continue; }
      const c = D.cells.get(d.cell);
      if (!c) continue;
      for (const a of c.lib.arcsN) if ((d.from === '*' || d.from === a.from) && (d.to === '*' || d.to === a.to)) set.add(`${d.cell}|${a.from}|${a.to}`);
    }
    for (const c of D.cells.values()) {
      const L = c.lib;
      if (!L.mux) continue;
      const sp = c.pins.get(L.mux.sel);
      const s = sp ? consts.get(objKey(sp)) : undefined;
      if (s === '0' || s === '1') {
        const off = L.mux.ins[s === '0' ? 1 : 0];
        for (const a of L.arcsN) if (a.from === off || a.from === L.mux.sel) set.add(`${c.name}|${a.from}|${a.to}`);
      }
    }
    return set;
  }

  // ---------------------------------------------------------------------------
  // Тактовые сигналы
  // ---------------------------------------------------------------------------
  function masterEdge(m, k, inv) {
    let r = m.rise, f = m.fall;
    if (inv) { const r2 = f, f2 = r.add(m.period); r = r2; f = f2; }
    if (f.le(r)) f = f.add(m.period);
    const j = Math.floor((k - 1) / 2);
    return (k % 2 === 1) ? r.add(m.period.mul(j)) : f.add(m.period.mul(j));
  }
  function normWave(period, rise, fall) {
    const k = rise.div(period).floor();
    if (k !== 0n) { const sh = period.mul(new Frac(k)); rise = rise.sub(sh); fall = fall.sub(sh); }
    return { period, rise, fall };
  }
  function genWaveform(m, g, inv) {
    let period, rise, fall;
    if (g.edges) {
      const sh = g.edgeShift || [Frac.ZERO, Frac.ZERO, Frac.ZERO];
      rise = masterEdge(m, g.edges[0], inv).add(sh[0]);
      fall = masterEdge(m, g.edges[1], inv).add(sh[1]);
      period = masterEdge(m, g.edges[2], inv).add(sh[2]).sub(rise);
    } else if (g.combinational) {
      period = m.period; rise = masterEdge(m, 1, inv); fall = masterEdge(m, 2, inv);
    } else {
      const div = g.divideBy || 1, mul = g.multiplyBy || 1;
      rise = masterEdge(m, 1, inv);
      if (mul === 1) {
        period = m.period.mul(div);
        fall = masterEdge(m, div + 1, inv);
      } else {
        period = m.period.mul(div).div(mul);
        const duty = masterEdge(m, 2, inv).sub(masterEdge(m, 1, inv)).div(m.period);
        fall = rise.add(period.mul(duty));
      }
      if (g.duty) fall = rise.add(period.mul(g.duty).div(100));
    }
    if (period.sign() <= 0 || !fall.gt(rise)) return null;
    if (g.invert) { const r2 = fall, f2 = rise.add(period); rise = r2; fall = f2; }
    return normWave(period, rise, fall);
  }

  function computeClocks(S) {
    const D = S.design, db = S.db;
    const consts = computeConsts(S);
    const disabled = computeDisabled(S, consts);
    const R = { clocks: new Map(), list: [], pin: new Map(), defs: new Map(), userDefs: new Set(), issues: [], consts, disabled, clockData: [] };
    const addDef = (o, name) => { const k = objKey(o); if (!R.defs.has(k)) R.defs.set(k, []); if (!R.defs.get(k).includes(name)) R.defs.get(k).push(name); };
    const add = (c) => { R.clocks.set(c.name, c); R.list.push(c); for (const s of c.sources || []) addDef(s, c.name); };
    const renames = new Map(db.renames.map((r) => [r.key, r.name]));
    for (const d of db.clocks) for (const t of (d.kind === 'create' ? d.sources : d.targets)) R.userDefs.add(objKey(t));
    for (const d of db.clocks) if (d.kind === 'generated') for (const t of d.targets) addDef(t, d.name);
    for (const d of db.clocks) {
      if (d.kind !== 'create') continue;
      add({ kind: 'clock', name: d.name, type: d.virtual ? 'virtual' : 'primary', period: d.period, rise: d.rise, fall: d.fall, sources: d.sources, root: d.name, def: d, line: d.line, src: d.src, props: new Map() });
    }
    const pend = db.clocks.filter((d) => d.kind === 'generated').map((g) => ({ g, done: false }));
    const autoDone = new Set();
    for (let iter = 0; iter < 40; iter++) {
      propagate(D, R);
      let changed = false;
      for (const p of pend) {
        if (p.done) continue;
        const c = resolveGenerated(p.g, R);
        if (c) { add(c); p.done = true; changed = true; }
      }
      if (S.tool === 'vivado') changed = deriveAuto(D, R, autoDone, renames) || changed;
      if (!changed) break;
    }
    propagate(D, R);
    for (const p of pend) if (!p.done) R.issues.push({ type: 'generated', name: p.g.name, line: p.g.line, text: XT.L(`производный тактовый сигнал «${p.g.name}» не построен: исходный тактовый сигнал не достигает вывода ${p.g.source.name}`, `generated clock '${p.g.name}' was not built: the master clock does not reach pin ${p.g.source.name}`) });
    for (const c of R.list) {
      const j = db.jitter.filter((x) => x.key === c.name).pop();
      if (j) c.jitter = j.value;
    }
    return R;
  }
  function resolveGenerated(g, R) {
    const at = R.pin.get(objKey(g.source));
    if (!at || !at.size) return null;
    let mname = g.master;
    if (!mname || !at.has(mname)) { if (g.master) return null; mname = [...at.keys()][0]; }
    const m = R.clocks.get(mname);
    if (!m) return null;
    const wf = genWaveform(m, g, !!at.get(mname).inv);
    if (!wf) return null;
    return {
      kind: 'clock', name: g.name, type: 'generated', period: wf.period, rise: wf.rise, fall: wf.fall, sources: g.targets, master: mname, root: m.root,
      def: g, line: g.line, src: g.src, divideBy: g.divideBy, multiplyBy: g.multiplyBy, props: new Map(),
    };
  }
  function deriveAuto(D, R, done, renames) {
    let changed = false;
    for (const cell of D.cells.values()) {
      const L = cell.lib;
      if (L.pll && L.vendor === 'xilinx' && cell.pll) {
        const ip = cell.pins.get('CLKIN1');
        const at = ip ? R.pin.get(objKey(ip)) : null;
        if (!at) continue;
        for (const out of cell.pll.outs) {
          const op = cell.pins.get(out.pin);
          if (!op) continue;
          const ok = objKey(op);
          if (R.userDefs.has(ok)) continue;
          let k = 0;
          for (const [mName] of at) {
            const m = R.clocks.get(mName);
            if (!m || m.type === 'virtual') continue;
            const dk = ok + '|' + mName;
            if (done.has(dk)) { k++; continue; }
            done.add(dk);
            let name = renames.get(ok) || out.clk || (op.net ? op.net.name : `${cell.name}_${out.pin}`);
            if (k > 0) name = `${name}_${k}`;
            const Tout = m.period.mul(Frac.of(cell.pll.divclk)).mul(Frac.of(out.div)).div(Frac.of(cell.pll.mult));
            const ph = Frac.of(out.phase || 0);
            let rise = m.rise.add(Tout.mul(ph).div(360));
            const duty = Frac.of(out.duty === undefined ? 0.5 : out.duty);
            const fall = rise.add(Tout.mul(duty));
            const wf = normWave(Tout, rise, fall);
            const c = {
              kind: 'clock', name, type: 'auto', period: wf.period, rise: wf.rise, fall: wf.fall, sources: [op], master: mName, root: m.root,
              cell: cell.name, outPin: out.pin, phase: out.phase || 0, props: new Map(), renamedFrom: renames.get(ok) ? (out.clk || null) : null,
            };
            R.clocks.set(c.name, c); R.list.push(c);
            if (!R.defs.has(ok)) R.defs.set(ok, []);
            R.defs.get(ok).push(c.name);
            changed = true; k++;
          }
        }
      }
      if (L.derive) {
        const v = cell.attrs[L.derive.attr];
        const n = parseInt(v, 10);
        if (!n || n <= 1 || String(v).toUpperCase() === 'BYPASS') continue;
        const ip = cell.pins.get(L.derive.in), op = cell.pins.get(L.derive.out);
        const at = ip ? R.pin.get(objKey(ip)) : null;
        if (!at) continue;
        const ok = objKey(op);
        if (R.userDefs.has(ok)) continue;
        let k = 0;
        for (const [mName, info] of at) {
          const m = R.clocks.get(mName);
          if (!m || m.type === 'virtual') continue;
          const dk = ok + '|' + mName;
          if (done.has(dk)) { k++; continue; }
          done.add(dk);
          let name = renames.get(ok) || cell.attrs.CLK_NAME || (op.net ? op.net.name : `${cell.name}_O`);
          if (k > 0) name = `${name}_${k}`;
          const wf = genWaveform(m, { divideBy: n }, !!info.inv);
          const c = { kind: 'clock', name, type: 'auto', period: wf.period, rise: wf.rise, fall: wf.fall, sources: [op], master: mName, root: m.root, cell: cell.name, divideBy: n, props: new Map() };
          R.clocks.set(c.name, c); R.list.push(c);
          if (!R.defs.has(ok)) R.defs.set(ok, []);
          R.defs.get(ok).push(c.name);
          changed = true; k++;
        }
      }
    }
    return changed;
  }
  function addPC(R, k, name, inv) {
    let m = R.pin.get(k);
    if (!m) { m = new Map(); R.pin.set(k, m); }
    const prev = m.get(name);
    if (prev) {
      if (prev.inv === inv || prev.both) return false;
      prev.both = true;
      return true;
    }
    m.set(name, { inv });
    return true;
  }
  function propagate(D, R) {
    R.pin = new Map();
    R.clockData = [];
    for (const c of R.list) for (const s of (c.sources || [])) walkClock(D, R, c, s);
  }
  function walkClock(D, R, c, src) {
    const initMode = src.kind === 'port' ? 'drv' : (src.dir === 'in' ? 'load' : 'drv');
    const stack = [[src, false, initMode, true]];
    let guard = 0;
    while (stack.length && guard++ < 200000) {
      const [o, inv, mode, isSrc] = stack.pop();
      const k = objKey(o);
      if (!isSrc) { const d = R.defs.get(k); if (d && !d.includes(c.name)) continue; }
      if (R.consts.has(k)) continue;
      if (!addPC(R, k, c.name, inv)) continue;
      if (mode === 'drv') { for (const p of D.netPeers(o)) stack.push([p, inv, 'load', false]); continue; }
      if (o.kind === 'port') continue;
      const cell = o.cell, L = cell.lib;
      if (L.seq && o.spec.clk) continue;
      if (L.pll) continue;
      if (L.seq) { R.clockData.push({ clock: c.name, pin: o.name }); continue; }
      for (const arc of D.arcsFrom(o, R.disabled)) stack.push([arc.to, inv !== arc.neg, 'drv', false]);
    }
  }

  // ---------------------------------------------------------------------------
  // Пути данных
  // ---------------------------------------------------------------------------
  function displayStart(st) {
    if (st.kind === 'port') return st.obj.name;
    const nLaunch = Object.keys(st.cell.lib.launchN).length;
    return nLaunch > 1 ? st.obj.name : st.cell.name;
  }
  function enumeratePaths(S, C) {
    const D = S.design;
    const paths = [];
    const starts = [];
    for (const p of D.ports.values()) if (p.dir === 'in' || p.dir === 'inout') starts.push({ kind: 'port', obj: p });
    for (const c of D.cells.values()) {
      for (const [pn, spec] of Object.entries(c.lib.launchN)) {
        for (const op of c.pins.values()) if (op.base === pn) starts.push({ kind: 'reg', obj: op, cell: c, spec });
      }
    }
    const LIMIT = 20000;
    let truncated = false;
    for (const st of starts) {
      const trail = [st.obj];
      const onStack = new Set([st.obj]);
      const record = (endObj, cap) => {
        if (paths.length >= LIMIT) { truncated = true; return; }
        const end = endObj.kind === 'port'
          ? { kind: 'port', obj: endObj, name: endObj.name }
          : { kind: 'pin', obj: endObj, cell: endObj.cell, cap, name: endObj.name };
        const startKeys = st.kind === 'port' ? [objKey(st.obj)] : ['cell:' + st.cell.name, 'pin:' + st.cell.name + '/' + st.spec.clk];
        const endKeys = end.kind === 'port' ? [objKey(endObj)] : ['cell:' + endObj.cell.name, objKey(endObj)];
        const tr = trail.slice();
        paths.push({
          id: paths.length, start: st, end, trail: tr, startKeys, endKeys,
          trailKeys: tr.map((o) => (o.kind === 'pin' ? [objKey(o), 'cell:' + o.cell.name] : [objKey(o)])),
          startName: displayStart(st), startId: st.obj.name, endName: end.name,
        });
      };
      const visit = (o, mode) => {
        if (paths.length >= LIMIT) return;
        if (C.consts.has(objKey(o)) && o !== st.obj) return;
        if (mode === 'drv') {
          for (const q of D.netPeers(o)) {
            if (onStack.has(q)) continue;
            onStack.add(q); trail.push(o.net, q);
            visit(q, 'load');
            trail.pop(); trail.pop(); onStack.delete(q);
          }
          return;
        }
        if (o.kind === 'port') {
          // порт, на котором определён тактовый сигнал (вывод тактового сигнала наружу), – конец тактового, а не информационного пути
          if (o.dir !== 'in' && !C.defs.has(objKey(o))) record(o, null);
          return;
        }
        const cell = o.cell, L = cell.lib;
        const cap = L.captureN[o.base];
        if (cap) { if (!capOff(C, cell, o.base)) record(o, cap); return; }
        if (L.seq || L.pll) return;
        for (const arc of D.arcsFrom(o, C.disabled)) {
          const q = arc.to;
          if (onStack.has(q)) continue;
          onStack.add(q); trail.push(q);
          visit(q, 'drv');
          trail.pop(); onStack.delete(q);
        }
      };
      visit(st.obj, 'drv');
    }
    // ключи путей (с учётом параллельных маршрутов)
    const cnt = new Map();
    for (const p of paths) {
      const base = p.startId + ' → ' + p.endName;
      const n = cnt.get(base) || 0;
      cnt.set(base, n + 1);
      p.key = n ? `${base} #${n + 1}` : base;
    }
    paths.truncated = truncated;
    return paths;
  }

  const opp = (e) => (e === 'rise' ? 'fall' : 'rise');
  function dedupeEv(list) {
    const seen = new Set();
    return list.filter((e) => { const k = (e.clock || '') + '|' + e.edge + '|' + (e.io ? 'io' : ''); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  function regEvents(S, C, cell, spec, edgesOverride) {
    const cp = cell.pins.get(spec.clk);
    const at = cp ? C.pin.get(objKey(cp)) : null;
    if (!at || !at.size) return [{ clock: null, why: 'no_clock' }];
    const inv = S.design.cellEdgesInv(cell);
    const out = [];
    for (const [name, info] of at) {
      for (const e of (edgesOverride || spec.edges)) {
        const flip = inv !== !!info.inv;
        out.push({ clock: name, edge: flip ? opp(e) : e });
        if (info.both) out.push({ clock: name, edge: flip ? e : opp(e) });
      }
    }
    return dedupeEv(out);
  }
  function launchEvents(S, C, p) {
    const st = p.start;
    if (st.kind === 'port') {
      const io = S.db.io.get(st.obj.name);
      const ents = io ? io.in : [];
      if (!ents.length) return [{ clock: null, why: 'no_input_delay' }];
      return ents.map((e) => ({ clock: e.clock, edge: e.clock ? (e.fall ? 'fall' : 'rise') : null, io: e, why: e.clock ? null : 'io_no_clock' }));
    }
    let edges = null;
    if (st.cell.ref === 'IDDR' && st.obj.base === 'Q2' && /SAME_EDGE/i.test(String(st.cell.attrs.DDR_CLK_EDGE || ''))) edges = ['rise'];
    return regEvents(S, C, st.cell, st.spec, edges);
  }
  function captureEvents(S, C, p) {
    const en = p.end;
    if (en.kind === 'port') {
      const io = S.db.io.get(en.obj.name);
      const ents = io ? io.out : [];
      if (!ents.length) return [{ clock: null, why: 'no_output_delay' }];
      return ents.map((e) => ({ clock: e.clock, edge: e.clock ? (e.fall ? 'fall' : 'rise') : null, io: e, why: e.clock ? null : 'io_no_clock' }));
    }
    let edges = null;
    if (en.cell.ref === 'ODDR' && en.obj.base === 'D2' && /SAME_EDGE/i.test(String(en.cell.attrs.DDR_CLK_EDGE || ''))) edges = ['rise'];
    const ev = regEvents(S, C, en.cell, en.cap, edges);
    for (const e of ev) e.async = !!en.cap.async;
    return ev;
  }

  // ---------------------------------------------------------------------------
  // Отношения setup/hold между фронтами двух тактовых сигналов
  // ---------------------------------------------------------------------------
  function edgeTime(clk, edge) { return edge === 'fall' ? clk.fall : clk.rise; }
  function relationship(Lc, Le, Cc, Ce, mS, mH) {
    const Tl = Lc.period, Tc = Cc.period;
    const offL = edgeTime(Lc, Le).mod(Tl), offC = edgeTime(Cc, Ce).mod(Tc);
    const W = Frac.lcm(Tl, Tc);
    let nl = Number(W.div(Tl).floor());
    const nc = Number(W.div(Tc).floor());
    let unexp = false;
    if (nl > 1000 || nc > 1000) { unexp = true; nl = Math.min(nl, 1000); }
    const pairs = [];
    for (let k = 0; k < nl; k++) {
      const L = offL.add(Tl.mul(k));
      const j = L.sub(offC).div(Tc).floor() + 1n;
      const C = offC.add(Tc.mul(new Frac(j)));
      const kk = C.sub(offL).div(Tl).ceil() - 1n;
      const Lb = offL.add(Tl.mul(new Frac(kk)));
      if (!Lb.eq(L)) continue;
      pairs.push({ L, C });
    }
    if (!pairs.length) {
      const L = offL; const j = L.sub(offC).div(Tc).floor() + 1n;
      pairs.push({ L, C: offC.add(Tc.mul(new Frac(j))) });
    }
    const sh = mS ? mS.mult - 1 : 0;
    const sp = pairs.map(({ L, C }) => (mS && mS.ref === 'start') ? { L: L.sub(Tl.mul(sh)), C } : { L, C: C.add(Tc.mul(sh)) });
    let su = null;
    for (const p of sp) { const r = p.C.sub(p.L); if (!su || r.lt(su.rel)) su = { rel: r, L: p.L, C: p.C }; }
    let hd = null;
    for (const p of sp) {
      const c1 = { rel: p.C.sub(Tc).sub(p.L), L: p.L, C: p.C.sub(Tc), setupC: p.C, setupL: p.L, which: 'prev_capture' };
      const c2 = { rel: p.C.sub(p.L.add(Tl)), L: p.L.add(Tl), C: p.C, setupC: p.C, setupL: p.L, which: 'next_launch' };
      for (const c of [c1, c2]) if (!hd || c.rel.gt(hd.rel)) hd = c;
    }
    if (mH) {
      const isEnd = mH.ref === 'end';
      const d = (isEnd ? Tc : Tl).mul(mH.mult);
      hd = isEnd ? Object.assign({}, hd, { rel: hd.rel.sub(d), C: hd.C.sub(d) }) : Object.assign({}, hd, { rel: hd.rel.sub(d), L: hd.L.add(d) });
    }
    return { setup: su, hold: hd, unexp, nPairs: pairs.length };
  }

  // ---------------------------------------------------------------------------
  // Группы тактовых сигналов и исключения
  // ---------------------------------------------------------------------------
  function groupsSeparate(groups, a, b) {
    if (a === b) return null;
    for (let gi = groups.length - 1; gi >= 0; gi--) {
      const g = groups[gi];
      if (g.groups.length === 1) {
        const ina = g.groups[0].includes(a), inb = g.groups[0].includes(b);
        if (ina !== inb) return g;
        continue;
      }
      const ia = g.groups.findIndex((x) => x.includes(a));
      const ib = g.groups.findIndex((x) => x.includes(b));
      if (ia >= 0 && ib >= 0 && ia !== ib) return g;
    }
    return null;
  }
  function endMatch(spec, keys, clock, edge) {
    for (const k of keys) {
      if (spec.objs.has(k)) {
        if (spec.edge && !k.startsWith('port:')) return spec.edge === edge;
        return true;
      }
    }
    if (clock && spec.clocks.has(clock)) return !spec.edge || spec.edge === edge;
    return false;
  }
  function throughMatch(list, trailKeys) {
    let pos = 0;
    for (const t of list) {
      let found = -1;
      for (let i = pos; i < trailKeys.length; i++) if (trailKeys[i].some((k) => t.objs.has(k))) { found = i; break; }
      if (found < 0) return false;
      pos = found + 1;
    }
    return true;
  }
  function excMatches(e, p, L, Cp) {
    if (e.from && !endMatch(e.from, p.startKeys, L.clock, L.edge)) return false;
    if (e.to && !endMatch(e.to, p.endKeys, Cp.clock, Cp.edge)) return false;
    if (e.through && e.through.length && !throughMatch(e.through, p.trailKeys)) return false;
    return true;
  }
  function specificity(e) {
    let s = 0;
    if (e.from) s += e.from.objs.size ? 16 : 2;
    if (e.to) s += e.to.objs.size ? 8 : 1;
    if (e.through && e.through.length) s += 4;
    return s;
  }
  function pickExc(arr) {
    if (!arr.length) return null;
    return arr.slice().sort((a, b) => specificity(b) - specificity(a) || b.id - a.id)[0];
  }

  // ---------------------------------------------------------------------------
  // Анализ
  // ---------------------------------------------------------------------------
  function analyze(S) {
    const C = S.clocks();
    const paths = enumeratePaths(S, C);
    const cache = new Map();
    const rel = (Lc, Le, Cc, Ce, mS, mH) => {
      const k = [Lc.name, Le, Cc.name, Ce, mS ? mS.mult + mS.ref : '', mH ? mH.mult + mH.ref : ''].join('|');
      if (!cache.has(k)) cache.set(k, relationship(Lc, Le, Cc, Ce, mS, mH));
      return cache.get(k);
    };
    const checks = [];
    for (const p of paths) {
      const Ls = launchEvents(S, C, p), Cs = captureEvents(S, C, p);
      for (const L of Ls) for (const Cp of Cs) checks.push(evalCheck(S, C, p, L, Cp, rel));
    }
    const res = { clocks: C, paths, checks, truncated: !!paths.truncated };
    res.issues = checkTiming(S, C, res);
    res.usedExc = new Set();
    for (const ch of checks) { for (const e of ch.exc || []) res.usedExc.add(e.id); }
    return res;
  }

  function evalCheck(S, C, p, L, Cp, rel) {
    const inst = { path: p, L, C: Cp, async: !!Cp.async, setup: { on: false }, hold: { on: false } };
    const Lclk = L.clock ? C.clocks.get(L.clock) : null;
    const Cclk = Cp.clock ? C.clocks.get(Cp.clock) : null;
    const ex = S.db.exceptions.filter((e) => excMatches(e, p, L, Cp));
    inst.exc = ex;
    const inMax = L.io ? L.io.max : null, inMin = L.io ? L.io.min : null;
    const outMax = Cp.io ? Cp.io.max : null, outMin = Cp.io ? Cp.io.min : null;
    if (Lclk && Cclk) {
      const g = groupsSeparate(S.db.groups, L.clock, Cp.clock);
      if (g) {
        const st = g.type === 'asynchronous' ? 'async' : 'exclusive';
        inst.status = st;
        inst.setup = { on: false, why: st, by: g };
        inst.hold = { on: false, why: st, by: g };
        inst.groupBy = g;
        return inst;
      }
    }
    const fpS = ex.filter((e) => e.type === 'false' && e.setup);
    const fpH = ex.filter((e) => e.type === 'false' && e.hold);
    const mx = pickExc(ex.filter((e) => e.type === 'max'));
    const mn = pickExc(ex.filter((e) => e.type === 'min'));
    const mcS = pickExc(ex.filter((e) => e.type === 'mcp' && e.setup));
    const mcH = pickExc(ex.filter((e) => e.type === 'mcp' && e.hold));
    const clocked = !!(Lclk && Cclk);
    const why0 = !Lclk ? (L.why || 'no_clock') : (Cp.why || 'no_clock');
    let R = null;
    if (clocked) {
      const mS = (mcS && !mx) ? { mult: mcS.mult, ref: mcS.ref || 'end' } : null;
      const mH = mcH ? { mult: mcH.mult, ref: mcH.ref || 'start' } : null;
      R = rel(Lclk, L.edge, Cclk, Cp.edge, mS, mH);
      inst.rel = R;
      inst.rel0 = rel(Lclk, L.edge, Cclk, Cp.edge, null, null);
      inst.unsafe = Lclk.root !== Cclk.root && Lclk.type !== 'virtual' && Cclk.type !== 'virtual';
      if (R.unexp) inst.unexp = true;
    }
    // setup
    if (fpS.length) inst.setup = { on: false, why: 'false', by: pickExc(fpS) };
    else if (mx) inst.setup = { on: true, req: mx.value, src: mx.dp ? 'max_dp' : 'max', by: mx };
    else if (clocked) inst.setup = { on: true, req: R.setup.rel, src: mcS ? 'mcp' : 'default', by: mcS || null, pair: R.setup };
    else inst.setup = { on: false, why: why0 };
    if (inst.setup.on) {
      if (L.io && (inMax === null || inMax === undefined)) inst.setup = { on: false, why: 'partial_in' };
      else if (Cp.io && (outMax === null || outMax === undefined)) inst.setup = { on: false, why: 'partial_out' };
      else inst.setup.budget = inst.setup.req.sub(inMax || Frac.ZERO).sub(outMax || Frac.ZERO);
    }
    // hold
    if (fpH.length) inst.hold = { on: false, why: 'false', by: pickExc(fpH) };
    else if (mx && mx.dp) inst.hold = { on: false, why: 'datapath_only', by: mx };
    else if (mn) inst.hold = { on: true, req: mn.value, src: 'min', by: mn };
    else if (clocked) inst.hold = { on: true, req: R.hold.rel, src: mcH ? 'mcp' : ((mcS && !mx) ? 'mcp_setup' : 'default'), by: mcH || ((mcS && !mx) ? mcS : null), pair: R.hold };
    else inst.hold = { on: false, why: why0 };
    if (inst.hold.on) {
      if (L.io && (inMin === null || inMin === undefined)) inst.hold = { on: false, why: 'partial_in' };
      else if (Cp.io && (outMin === null || outMin === undefined)) inst.hold = { on: false, why: 'partial_out' };
      else inst.hold.budget = inst.hold.req.sub(inMin || Frac.ZERO).sub(outMin || Frac.ZERO);
    }
    inst.status = (inst.setup.on || inst.hold.on) ? 'timed' : (inst.setup.why === 'false' ? 'false' : 'unconstrained');
    // «небезопасен» только анализ по соотношению фронтов несвязанных тактовых сигналов;
    // путь, ограниченный одним set_max_delay/set_min_delay, от этого соотношения не зависит
    if (inst.unsafe) {
      const relS = inst.setup.on && (inst.setup.src === 'default' || inst.setup.src === 'mcp');
      const relH = inst.hold.on && (inst.hold.src === 'default' || inst.hold.src === 'mcp' || inst.hold.src === 'mcp_setup');
      if (!relS && !relH) inst.unsafe = false;
    }
    return inst;
  }

  // ---------------------------------------------------------------------------
  // check_timing
  // ---------------------------------------------------------------------------
  function checkTiming(S, C, A) {
    const D = S.design;
    const iss = { noClock: [], unconstrainedEndpoints: [], noInputDelay: [], noOutputDelay: [], partialInput: [], partialOutput: [], multipleClock: [], generated: [], unexpandable: [], unsafe: [] };
    for (const c of D.cells.values()) {
      if (!c.lib.seq) continue;
      const cp = c.pins.get(c.lib.clk);
      const m = cp ? C.pin.get(objKey(cp)) : null;
      if (!m || !m.size) iss.noClock.push(c.name);
      else if (m.size > 1) {
        const names = [...m.keys()];
        let excl = true;
        for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
          const g = groupsSeparate(S.db.groups, names[i], names[j]);
          if (!g || g.type === 'asynchronous') excl = false;
        }
        iss.multipleClock.push({ pin: cp.name, clocks: names, exclusive: excl });
      }
    }
    const startPorts = new Set(A.paths.filter((p) => p.start.kind === 'port').map((p) => p.start.obj.name));
    const endPorts = new Set(A.paths.filter((p) => p.end.kind === 'port').map((p) => p.end.obj.name));
    const covered = (pred) => A.checks.filter(pred);
    for (const pn of startPorts) {
      const io = S.db.io.get(pn);
      const chs = covered((ch) => ch.path.start.kind === 'port' && ch.path.start.obj.name === pn);
      const anyConstrained = chs.some((ch) => ch.setup.on || ch.hold.on || ch.setup.why === 'false' || ch.setup.why === 'async');
      if (!io || !io.in.length) { if (!anyConstrained) iss.noInputDelay.push(pn); }
      else if (io.in.some((e) => e.max === null || e.min === null)) iss.partialInput.push(pn);
    }
    for (const pn of endPorts) {
      const io = S.db.io.get(pn);
      const chs = covered((ch) => ch.path.end.kind === 'port' && ch.path.end.obj.name === pn);
      const anyConstrained = chs.some((ch) => ch.setup.on || ch.hold.on || ch.setup.why === 'false' || ch.setup.why === 'async');
      if (!io || !io.out.length) { if (!anyConstrained) iss.noOutputDelay.push(pn); }
      else if (io.out.some((e) => e.max === null || e.min === null)) iss.partialOutput.push(pn);
    }
    const endSeen = new Map();
    for (const ch of A.checks) {
      if (ch.path.end.kind !== 'pin') continue;
      const k = ch.path.end.obj.name;
      const ok = ch.setup.on || ch.hold.on || ['false', 'async', 'exclusive', 'datapath_only'].includes(ch.setup.why);
      endSeen.set(k, (endSeen.get(k) || false) || ok);
    }
    for (const [k, ok] of endSeen) if (!ok) iss.unconstrainedEndpoints.push(k);
    iss.generated = C.issues.filter((x) => x.type === 'generated');
    const ux = new Set(), us = new Set();
    for (const ch of A.checks) {
      if (ch.unexp) ux.add(ch.L.clock + ' → ' + ch.C.clock);
      if (ch.unsafe && ch.status === 'timed') us.add(ch.L.clock + ' → ' + ch.C.clock);
    }
    iss.unexpandable = [...ux];
    iss.unsafe = [...us];
    return iss;
  }

  // ---------------------------------------------------------------------------
  // all_fanout / all_fanin
  // ---------------------------------------------------------------------------
  function fanTraverse(S, src, forward, opts) {
    const D = S.design;
    const C = S.clocks();
    const seen = new Set();
    const out = [];
    const ends = [];
    const st = src.map((o) => (o.kind === 'net' ? (forward ? o.driver : o.driver) : o)).filter(Boolean);
    const stack = st.map((o) => [o, forward ? (o.kind === 'port' ? 'drv' : (o.dir === 'out' ? 'drv' : 'load')) : (o.kind === 'port' ? 'load' : (o.dir === 'in' ? 'load' : 'drv'))]);
    while (stack.length) {
      const [o, mode] = stack.pop();
      const k = objKey(o) + '|' + mode;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(o);
      if (forward) {
        if (mode === 'drv') { for (const q of D.netPeers(o)) stack.push([q, 'load']); continue; }
        if (o.kind === 'port') { ends.push(o); continue; }
        const L = o.cell.lib;
        if (L.captureN[o.base] || L.seq || L.pll) { ends.push(o); continue; }
        for (const a of D.arcsFrom(o, C.disabled)) stack.push([a.to, 'drv']);
      } else {
        if (mode === 'load') {
          if (o.kind === 'port') { if (o.dir !== 'out') ends.push(o); else if (o.net && o.net.driver && o.net.driver !== o) stack.push([o.net.driver, 'drv']); continue; }
          if (o.net && o.net.driver && o.net.driver !== o) stack.push([o.net.driver, 'drv']);
          else ends.push(o);
          continue;
        }
        if (o.kind === 'port') { ends.push(o); continue; }
        const L = o.cell.lib;
        if (L.launchN[o.base]) { ends.push(o); continue; }
        for (const p of o.cell.pins.values()) {
          if (p.dir === 'out') continue;
          if (D.arcsFrom(p, C.disabled).some((a) => a.to === o)) stack.push([p, 'load']);
        }
      }
    }
    return U.uniq(opts && opts.endpointsOnly ? ends : out);
  }

  XT.sta = { computeClocks, analyze, relationship, enumeratePaths, launchEvents, captureEvents, groupsSeparate, fanTraverse, edgeTime, genWaveform, specificity, pickExc };
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
