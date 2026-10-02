/* ConstraintLab – временные диаграммы: точный формат (нс), WaveJSON-подмножество, генерация по анализу */
(function (XT) {
  'use strict';
  const U = XT.util;
  const esc = U.escapeHtml;
  const L = XT.L;
  let uid = 0;

  function r1(v) { return Math.round(v * 10) / 10; }
  function niceStep(span, target) {
    const raw = span / (target || 12);
    const steps = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    for (const s of steps) if (s >= raw) return s;
    return steps[steps.length - 1];
  }
  function fmtT(v) { const s = (Math.round(v * 1000) / 1000).toString(); return s; }

  // ---------------------------------------------------------------------------
  // Точные диаграммы: spec.kind = 'timing'
  // ---------------------------------------------------------------------------
  function renderTiming(spec, opts) {
    opts = opts || {};
    const id = 'td' + (++uid);
    const [t0, t1] = spec.t;
    const sigs = spec.signals || [];
    const nameLen = Math.max(4, ...sigs.map((s) => String(s.name || '').length));
    const LW = Math.max(74, Math.min(240, nameLen * 6.9 + 22));
    const PW = spec.width || 700;
    const X = (t) => LW + (t - t0) / (t1 - t0) * PW;
    const spans = spec.spans || [];
    const rowIdx = (r) => (typeof r === 'number' ? r : sigs.findIndex((s) => s.id === r || s.name === r));
    const spanRows = new Map();
    for (const sp of spans) { const i = rowIdx(sp.row); if (i >= 0) spanRows.set(i, (spanRows.get(i) || 0) + 1); }
    const marks = spec.marks || [];
    const markLevels = marks.length ? 2 : 0;
    let y = (spec.title ? 22 : 6) + markLevels * 13 + (marks.length ? 6 : 0);
    const rows = [];
    for (let i = 0; i < sigs.length; i++) {
      const s = sigs[i];
      const extra = (spanRows.get(i) || 0) * 17;
      const h = s.gap ? 12 : 32 + extra;
      rows.push({ s, y, h, top: y + 6, bot: y + 24, mid: y + 15 });
      y += h;
    }
    const plotBottom = y;
    const H = plotBottom + (spec.axis === false ? 6 : 30);
    let out = '';
    out += `<defs><pattern id="${id}h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="td-hatch"/></pattern>` +
      `<marker id="${id}a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" class="td-arrowhead"/></marker></defs>`;
    if (spec.title) out += `<text x="${LW}" y="15" class="td-title">${esc(spec.title)}</text>`;
    // сетка и ось
    const step = spec.tick || niceStep(t1 - t0, 12);
    let gridSvg = '', axisSvg = '';
    const first = Math.ceil(t0 / step - 1e-9) * step;
    for (let tt = first; tt <= t1 + 1e-9; tt += step) {
      const x = X(tt);
      if (spec.grid !== false) gridSvg += `<line x1="${r1(x)}" y1="${rows.length ? rows[0].y : 0}" x2="${r1(x)}" y2="${plotBottom}" class="td-grid"/>`;
      if (spec.axis !== false) {
        axisSvg += `<line x1="${r1(x)}" y1="${plotBottom + 2}" x2="${r1(x)}" y2="${plotBottom + 7}" class="td-axis"/>`;
        axisSvg += `<text x="${r1(x)}" y="${plotBottom + 19}" class="td-tick" text-anchor="middle">${esc(spec.cycles ? fmtT(tt) : fmtT(tt))}</text>`;
      }
    }
    if (spec.axis !== false) {
      axisSvg += `<line x1="${LW}" y1="${plotBottom + 2}" x2="${LW + PW}" y2="${plotBottom + 2}" class="td-axis"/>`;
      axisSvg += `<text x="${LW - 8}" y="${plotBottom + 19}" class="td-tick" text-anchor="end">${esc(spec.unit === undefined ? L('нс', 'ns') : spec.unit)}</text>`;
    }
    out += gridSvg;
    // окна (под сигналами)
    for (const w of spec.windows || []) {
      const i = rowIdx(w.row);
      const r = i >= 0 ? rows[i] : null;
      const ya = r ? r.top - 3 : (rows[0] ? rows[0].top - 3 : 0), yb = r ? r.bot + 3 : plotBottom;
      const xa = X(Math.max(t0, w.t0)), xb = X(Math.min(t1, w.t1));
      if (xb <= xa) continue;
      out += `<rect x="${r1(xa)}" y="${r1(ya)}" width="${r1(xb - xa)}" height="${r1(yb - ya)}" class="td-win ${w.cls || ''}"/>`;
      if (w.label) out += `<text x="${r1((xa + xb) / 2)}" y="${r1(ya - 2)}" class="td-winlabel ${w.cls || ''}" text-anchor="middle">${esc(w.label)}</text>`;
    }
    // сигналы
    for (const r of rows) {
      const s = r.s;
      if (s.gap) continue;
      out += `<text x="${LW - 10}" y="${r.mid + 4}" class="td-name${s.cls ? ' ' + s.cls : ''}" text-anchor="end">${esc(s.name || '')}</text>`;
      if (s.clock) out += drawClock(s, r, X, t0, t1, id);
      else if (s.bus) out += drawBus(s, r, X, t0, t1, id);
      else if (s.bit) out += drawBit(s, r, X, t0, t1, id);
    }
    // метки
    marks.forEach((m, k) => {
      if (m.t < t0 || m.t > t1) return;
      const x = X(m.t);
      const ly = (spec.title ? 22 : 6) + 11 + (k % 2) * 13;
      out += `<line x1="${r1(x)}" y1="${ly + 3}" x2="${r1(x)}" y2="${plotBottom}" class="td-mark ${m.cls || ''}${m.dash === false ? ' solid' : ''}"/>`;
      if (m.label) out += `<text x="${r1(x)}" y="${ly}" class="td-marklabel ${m.cls || ''}" text-anchor="middle">${esc(m.label)}</text>`;
    });
    // размерные стрелки
    const used = new Map();
    for (const sp of spans) {
      const i = rowIdx(sp.row);
      if (i < 0) continue;
      const r = rows[i];
      const n = used.get(i) || 0;
      used.set(i, n + 1);
      const yy = r.bot + 14 + n * 17;
      const xa = X(sp.t0), xb = X(sp.t1);
      out += `<line x1="${r1(xa)}" y1="${yy - 5}" x2="${r1(xa)}" y2="${yy + 4}" class="td-span-tick ${sp.cls || ''}"/><line x1="${r1(xb)}" y1="${yy - 5}" x2="${r1(xb)}" y2="${yy + 4}" class="td-span-tick ${sp.cls || ''}"/>`;
      if (Math.abs(xb - xa) > 3) out += `<line x1="${r1(xa)}" y1="${yy}" x2="${r1(xb)}" y2="${yy}" class="td-span ${sp.cls || ''}" marker-start="url(#${id}a)" marker-end="url(#${id}a)"/>`;
      if (sp.label) {
        const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
        const tw = sp.label.length * 6.4;
        let lx, an;
        // положение подписи можно задать вручную: lt – момент времени, anchor – выравнивание
        if (sp.lt !== undefined) { lx = X(sp.lt); an = sp.anchor || 'middle'; }
        else if (hi - lo > tw + 10) { lx = (lo + hi) / 2; an = 'middle'; }
        else if (hi + 6 + tw <= LW + PW + 8) { lx = hi + 6; an = 'start'; }
        else if (lo - 6 - tw >= LW) { lx = lo - 6; an = 'end'; }
        else { lx = Math.max(LW + tw / 2, Math.min(LW + PW - tw / 2, (lo + hi) / 2)); an = 'middle'; }
        out += `<text x="${r1(lx)}" y="${yy - 3}" class="td-spanlabel ${sp.cls || ''}" text-anchor="${an}">${esc(sp.label)}</text>`;
      }
    }
    // стрелки между точками
    for (const a of spec.arrows || []) {
      const p = (pt) => { const i = rowIdx(pt[1]); const r = rows[i]; const yy = !r ? 0 : pt[2] === 'top' ? r.top : pt[2] === 'bot' ? r.bot : r.mid; return [X(pt[0]), yy]; };
      const [xa, ya] = p(a.from), [xb, yb] = p(a.to);
      if (a.curve) {
        const cx = (xa + xb) / 2, cy = Math.min(ya, yb) - 16;
        out += `<path d="M${r1(xa)},${r1(ya)} Q${r1(cx)},${r1(cy)} ${r1(xb)},${r1(yb)}" class="td-arrow ${a.cls || ''}" marker-end="url(#${id}a)"/>`;
      } else out += `<line x1="${r1(xa)}" y1="${r1(ya)}" x2="${r1(xb)}" y2="${r1(yb)}" class="td-arrow ${a.cls || ''}" marker-end="url(#${id}a)"${a.both ? ` marker-start="url(#${id}a)"` : ''}/>`;
      if (a.label) out += `<text x="${r1((xa + xb) / 2 + (a.dx || 0))}" y="${r1((ya + yb) / 2 - 5 + (a.dy || 0))}" class="td-arrowlabel ${a.cls || ''}" text-anchor="middle">${esc(a.label)}</text>`;
    }
    for (const nt of spec.notes || []) {
      const i = rowIdx(nt.row);
      const r = rows[i];
      if (!r) continue;
      out += `<text x="${r1(X(nt.t))}" y="${r1((nt.pos === 'bot' ? r.bot + 12 : r.top - 3))}" class="td-note ${nt.cls || ''}" text-anchor="${nt.anchor || 'middle'}">${esc(nt.text)}</text>`;
    }
    out += axisSvg;
    const W = LW + PW + 16;
    return { svg: `<svg class="td" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(W)} ${Math.round(H)}" width="${Math.round(W)}" height="${Math.round(H)}" role="img" aria-label="${esc(spec.title || L('Временная диаграмма', 'Timing diagram'))}">${out}</svg>`, w: W, h: H };
  }

  function clockEdges(c, t0, t1) {
    const T = c.period, r = c.rise || 0, f = c.fall !== undefined ? c.fall : r + T / 2;
    const edges = [];
    const k0 = Math.floor((t0 - r) / T) - 1, k1 = Math.ceil((t1 - r) / T) + 1;
    for (let k = k0; k <= k1; k++) {
      const tr = r + k * T, tf = f + k * T;
      if (tr > t0 && tr < t1) edges.push([tr, 1]);
      if (tf > t0 && tf < t1) edges.push([tf, 0]);
    }
    edges.sort((a, b) => a[0] - b[0]);
    let ph = ((t0 - r) % T + T) % T;
    const hi = ph < (f - r);
    return { edges, init: hi ? 1 : 0 };
  }
  function drawClock(s, r, X, t0, t1, id) {
    const c = s.clock;
    const { edges, init } = clockEdges(c, t0, t1);
    const Y = (lv) => (lv ? r.top : r.bot);
    let out = '';
    if (c.jitter) {
      for (const [te] of edges) {
        const xa = X(te - c.jitter / 2), xb = X(te + c.jitter / 2);
        out += `<rect x="${r1(xa)}" y="${r.top}" width="${r1(Math.max(1, xb - xa))}" height="${r.bot - r.top}" fill="url(#${id}h)" class="td-jit"/>`;
      }
    }
    let lv = init;
    let pts = `${r1(X(t0))},${Y(lv)}`;
    for (const [te, nl] of edges) { pts += ` ${r1(X(te))},${Y(lv)} ${r1(X(te))},${Y(nl)}`; lv = nl; }
    pts += ` ${r1(X(t1))},${Y(lv)}`;
    out += `<polyline points="${pts}" class="td-clock ${s.cls || ''}"/>`;
    const arr = s.arrows || c.arrows;
    if (arr) {
      for (const [te, nl] of edges) {
        if ((arr === 'rise' && nl !== 1) || (arr === 'fall' && nl !== 0)) continue;
        const x = X(te), ym = r.mid;
        out += nl ? `<path d="M${r1(x - 3.5)},${ym + 3} L${r1(x)},${ym - 3} L${r1(x + 3.5)},${ym + 3}" class="td-edgearrow"/>` : `<path d="M${r1(x - 3.5)},${ym - 3} L${r1(x)},${ym + 3} L${r1(x + 3.5)},${ym - 3}" class="td-edgearrow"/>`;
      }
    }
    return out;
  }
  function drawBus(s, r, X, t0, t1, id) {
    const list = (s.bus || []).slice().sort((a, b) => a[0] - b[0]);
    const segs = [], trans = [];
    let cur = s.init !== undefined ? s.init : 'X', cs = t0;
    for (const [a, b, v] of list) { segs.push({ s: cs, e: a, v: cur }); trans.push({ a, b }); cur = v; cs = b; }
    segs.push({ s: cs, e: t1, v: cur });
    let out = '';
    const top = r.top, bot = r.bot, mid = r.mid;
    for (const g of segs) {
      const s0 = Math.max(t0, g.s), e0 = Math.min(t1, g.e);
      if (e0 <= s0) continue;
      const xs = X(s0), xe = X(e0);
      const dl = s0 <= t0 ? 0 : Math.min(4, (xe - xs) / 2), dr = e0 >= t1 ? 0 : Math.min(4, (xe - xs) / 2);
      const pts = `${r1(xs)},${mid} ${r1(xs + dl)},${top} ${r1(xe - dr)},${top} ${r1(xe)},${mid} ${r1(xe - dr)},${bot} ${r1(xs + dl)},${bot}`;
      const v = g.v;
      if (v === 'X' || v === 'x') out += `<polygon points="${pts}" fill="url(#${id}h)" class="td-busx"/>`;
      else if (v === 'Z' || v === 'z') out += `<line x1="${r1(xs)}" y1="${mid}" x2="${r1(xe)}" y2="${mid}" class="td-z"/>`;
      else {
        out += `<polygon points="${pts}" class="td-bus ${s.colors && s.colors[v] ? 'c-' + s.colors[v] : ''}"/>`;
        const tw = String(v).length * 6.2;
        if (xe - xs > tw + 6) out += `<text x="${r1((xs + xe) / 2)}" y="${mid + 4}" class="td-busval" text-anchor="middle">${esc(v)}</text>`;
      }
    }
    for (const tr of trans) {
      const a = Math.max(t0, tr.a), b = Math.min(t1, tr.b);
      if (b < a) continue;
      const xa = X(a), xb = X(b);
      if (xb - xa > 1.5) {
        out += `<polygon points="${r1(xa)},${mid} ${r1(xa + 1)},${top} ${r1(xb - 1)},${top} ${r1(xb)},${mid} ${r1(xb - 1)},${bot} ${r1(xa + 1)},${bot}" fill="url(#${id}h)" class="td-unc"/>`;
        out += `<line x1="${r1(xa)}" y1="${top}" x2="${r1(xb)}" y2="${bot}" class="td-cross"/><line x1="${r1(xa)}" y1="${bot}" x2="${r1(xb)}" y2="${top}" class="td-cross"/>`;
      }
    }
    return out;
  }
  function drawBit(s, r, X, t0, t1, id) {
    const list = (s.bit || []).slice().sort((a, b) => a[0] - b[0]);
    const Y = (lv) => (lv ? r.top : r.bot);
    let lv = s.init || 0;
    let pts = `${r1(X(t0))},${Y(lv)}`;
    let out = '';
    for (const [a, b, nl] of list) {
      if (a > t1) break;
      const xa = X(Math.max(t0, a)), xb = X(Math.min(t1, b));
      pts += ` ${r1(xa)},${Y(lv)} ${r1(xb)},${Y(nl)}`;
      if (b - a > 0 && s.unc) out += `<rect x="${r1(xa)}" y="${r.top}" width="${r1(xb - xa)}" height="${r.bot - r.top}" fill="url(#${id}h)" class="td-unc"/>`;
      lv = nl;
    }
    pts += ` ${r1(X(t1))},${Y(lv)}`;
    return out + `<polyline points="${pts}" class="td-bit ${s.cls || ''}"/>`;
  }

  // ---------------------------------------------------------------------------
  // WaveJSON (подмножество WaveDrom)
  // ---------------------------------------------------------------------------
  function flattenSignals(arr, out) {
    for (const s of arr || []) {
      if (Array.isArray(s)) flattenSignals(s.slice(1), out);
      else if (s && typeof s === 'object') out.push(s);
    }
    return out;
  }
  function renderWaveJSON(wj, opts) {
    const sigs = flattenSignals(wj.signal, []);
    const rows = [];
    let maxT = 0;
    const nodes = new Map();
    sigs.forEach((sg, si) => {
      if (!sg.wave) { rows.push({ name: sg.name || '', gap: !sg.name }); return; }
      const per = sg.period || 1, ph = sg.phase || 0;
      const wave = sg.wave;
      const data = Array.isArray(sg.data) ? sg.data.slice() : (sg.data ? String(sg.data).split(/\s+/) : []);
      const isClk = /^[pnPNhlHL.|]+$/.test(wave) && /[pnPN]/.test(wave);
      const bit = [], bus = [];
      let lastChar = null, lastLevel = null, busVal = null, init = null, busInit = null;
      let isBus = /[=2-9x]/.test(wave) && !/[01]/.test(wave.replace(/[=2-9x.|]/g, ''));
      const T0 = (i) => i * per - ph;
      for (let i = 0; i < wave.length; i++) {
        let ch = wave[i];
        const t = T0(i);
        if (ch === '.' || ch === '|') {
          if (lastChar && /[pnPN]/.test(lastChar)) ch = lastChar; else continue;
        }
        if (/[pnPN]/.test(ch)) {
          const posFirst = ch === 'p' || ch === 'P';
          const l1 = posFirst ? 1 : 0;
          if (lastLevel === null) init = posFirst ? 0 : 1;
          bit.push([t, t, l1]);
          bit.push([t + per / 2, t + per / 2, 1 - l1]);
          lastLevel = 1 - l1;
          lastChar = ch;
          continue;
        }
        lastChar = ch;
        if (ch === 'h' || ch === 'H' || ch === '1' || ch === 'u') {
          if (lastLevel === null) { init = 1; lastLevel = 1; } else if (lastLevel !== 1) { bit.push([t, t + (ch === '1' ? per * 0.08 : 0), 1]); lastLevel = 1; }
          continue;
        }
        if (ch === 'l' || ch === 'L' || ch === '0' || ch === 'd') {
          if (lastLevel === null) { init = 0; lastLevel = 0; } else if (lastLevel !== 0) { bit.push([t, t + (ch === '0' ? per * 0.08 : 0), 0]); lastLevel = 0; }
          continue;
        }
        if (ch === 'x' || ch === 'z' || ch === '=' || /[2-9]/.test(ch)) {
          isBus = true;
          const v = ch === 'x' ? 'X' : ch === 'z' ? 'Z' : (data.length ? data.shift() : '');
          if (busInit === null && i === 0) { busInit = v; busVal = v; continue; }
          bus.push([t, t + per * 0.08, v]);
          busVal = v;
        }
      }
      maxT = Math.max(maxT, wave.length * per - ph);
      if (sg.node) {
        for (let i = 0; i < sg.node.length; i++) { const c = sg.node[i]; if (c !== '.') nodes.set(c, { t: T0(i), row: si }); }
      }
      const name = sg.name || '';
      if (isClk) rows.push({ name, bit, init: init || 0, arrowsP: /[PN]/.test(wave) });
      else if (isBus) rows.push({ name, bus, init: busInit === null ? 'X' : busInit });
      else rows.push({ name, bit, init: init || 0 });
    });
    const hs = (wj.config && wj.config.hscale) || 1;
    const spec = {
      kind: 'timing', t: [0, maxT || 1], width: Math.min(900, Math.max(320, (maxT || 1) * 44 * hs)), unit: L('такт', 'cycle'), tick: 1, cycles: true,
      title: wj.head && wj.head.text, grid: true, axis: wj.axis !== false,
      signals: rows.map((r) => (r.gap ? { gap: true, name: '' } : r.bus ? { name: r.name, bus: r.bus, init: r.init } : { name: r.name, bit: r.bit, init: r.init })),
      arrows: [], marks: [],
    };
    for (const e of wj.edge || []) {
      const m = /^\s*(\w)\s*([-~<>|+]+)\s*(\w)\s*(.*)$/.exec(e);
      if (!m) continue;
      const a = nodes.get(m[1]), b = nodes.get(m[3]);
      if (!a || !b) continue;
      spec.arrows.push({ from: [a.t, a.row, 'mid'], to: [b.t, b.row, 'mid'], label: m[4] || '', curve: m[2].includes('~'), both: m[2].startsWith('<') });
    }
    return renderTiming(spec, opts);
  }

  // ---------------------------------------------------------------------------
  // Диаграмма отношения фронтов для проверки из анализа
  // ---------------------------------------------------------------------------
  function relSpec(inst, clocks, opts) {
    opts = opts || {};
    const Lc = clocks.get(inst.L.clock), Cc = clocks.get(inst.C.clock);
    if (!Lc || !Cc) return null;
    const n = (v) => U.num(v);
    const su = inst.setup.on && inst.setup.pair ? inst.setup.pair : null;
    const hd = inst.hold.on && inst.hold.pair ? inst.hold.pair : null;
    const ts = [];
    if (su) ts.push(n(su.L), n(su.C));
    if (hd) ts.push(n(hd.L), n(hd.C));
    if (!ts.length) {
      const r0 = inst.rel0;
      if (r0) ts.push(n(r0.setup.L), n(r0.setup.C));
      else return null;
    }
    const Tm = Math.max(n(Lc.period), n(Cc.period));
    let t0 = Math.min(...ts) - 0.3 * Tm, t1 = Math.max(...ts) + 0.3 * Tm;
    if (t1 - t0 < 1.4 * Tm) { const m = (t0 + t1) / 2; t0 = m - 0.7 * Tm; t1 = m + 0.7 * Tm; }
    const ck = (c) => ({ period: n(c.period), rise: n(c.rise), fall: n(c.fall), jitter: c.jitter ? n(c.jitter) : 0 });
    const signals = [];
    const Lname = L(`${inst.L.clock} (запуск)`, `${inst.L.clock} (launch)`), Cname = L(`${inst.C.clock} (захват)`, `${inst.C.clock} (capture)`);
    signals.push({ id: 'L', name: Lname, clock: ck(Lc), arrows: inst.L.edge, cls: 'launch' });
    const spans = [], marks = [], windows = [];
    if (inst.L.io) {
      const io = inst.L.io;
      const mx = io.max !== null ? n(io.max) : null, mn = io.min !== null ? n(io.min) : null;
      const bus = [];
      const T = n(Lc.period), off = n(inst.L.edge === 'fall' ? Lc.fall : Lc.rise);
      let k = Math.floor((t0 - off) / T) - 1;
      let idx = 0;
      for (; off + k * T < t1 + T; k++) {
        const le = off + k * T;
        const a = le + (mn !== null ? mn : (mx !== null ? mx : 0)), b = le + (mx !== null ? mx : a - le);
        bus.push([Math.min(a, b), Math.max(a, b), 'D' + (idx++)]);
      }
      signals.push({ id: 'D', name: L('данные на входе', 'input data'), bus, init: 'X' });
    }
    signals.push({ id: 'C', name: Cname, clock: ck(Cc), arrows: inst.C.edge, cls: 'capture' });
    if (inst.C.io) {
      const io = inst.C.io;
      if (su && io.max !== null) windows.push({ row: 'C', t0: n(su.C) - n(io.max), t1: n(su.C), cls: 'setup', label: 'out max' });
    }
    if (su) {
      marks.push({ t: n(su.L), label: L('запуск', 'launch'), cls: 'launch' });
      marks.push({ t: n(su.C), label: L('захват (предустановка)', 'capture (setup)'), cls: 'capture' });
      spans.push({ row: 'C', t0: n(su.L), t1: n(su.C), label: L(`предустановка: ${U.fmt(inst.setup.req)} нс`, `setup: ${U.fmt(inst.setup.req)} ns`), cls: 'setup' });
      if (inst.setup.src === 'mcp' && inst.rel0) marks.push({ t: n(inst.rel0.setup.C), label: L('без многотактного пути', 'without multicycle path'), cls: 'default' });
    }
    if (hd) {
      if (!su || n(hd.L) !== n(su.L)) marks.push({ t: n(hd.L), label: L('запуск (удержание)', 'launch (hold)'), cls: 'launch' });
      if (!su || n(hd.C) !== n(su.C)) marks.push({ t: n(hd.C), label: L('удержание', 'hold'), cls: 'hold' });
      spans.push({ row: 'C', t0: n(hd.L), t1: n(hd.C), label: L(`удержание: ${U.fmt(inst.hold.req)} нс`, `hold: ${U.fmt(inst.hold.req)} ns`), cls: 'hold' });
    }
    marks.sort((a, b) => a.t - b.t);
    return { kind: 'timing', t: [t0, t1], signals, marks, spans, windows, width: opts.width || 520 };
  }
  function relDiagram(inst, clocks, opts) {
    const s = relSpec(inst, clocks, opts);
    return s ? renderTiming(s, opts) : null;
  }
  function clocksDiagram(clockList, opts) {
    const list = clockList.filter((c) => c.period);
    if (!list.length) return null;
    const n = (v) => U.num(v);
    const maxT = Math.max(...list.map((c) => n(c.period)));
    const span = (opts && opts.span) || Math.min(maxT * 2.2, Math.max(...list.map((c) => n(c.period))) * 4);
    const spec = {
      kind: 'timing', t: [-0.05 * span, span], width: 640,
      signals: list.map((c) => ({ name: L(`${c.name} (${U.fmtShort(n(c.period))} нс)`, `${c.name} (${U.fmtShort(n(c.period))} ns)`), clock: { period: n(c.period), rise: n(c.rise), fall: n(c.fall), jitter: c.jitter ? n(c.jitter) : 0 }, arrows: 'rise' })),
    };
    return renderTiming(spec, opts);
  }

  function render(fig, opts) {
    if (fig.kind === 'wave' || fig.signal) return renderWaveJSON(fig.wave || fig, opts);
    return renderTiming(fig, opts);
  }

  XT.wave = { render, renderTiming, renderWaveJSON, relDiagram, relSpec, clocksDiagram };
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
