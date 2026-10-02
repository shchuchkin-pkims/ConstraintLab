/* ConstraintLab – отрисовка схем (SVG) по описанию элементов и проводов */
(function (XT) {
  'use strict';
  const esc = XT.util.escapeHtml;
  const L = XT.L;

  const CH_MONO = 6.7;   // ширина символа моноширинного шрифта 11px
  const CH_SANS = 6.4;

  function t(x, y, s, cls, anchor, extra) {
    return `<text x="${r1(x)}" y="${r1(y)}" class="${cls || 'sch-t'}"${anchor ? ` text-anchor="${anchor}"` : ''}${extra || ''}>${esc(s)}</text>`;
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function busLabel(el) { const w = el.w || 1; return w > 1 ? `[${(el.lsb || 0) + w - 1}:${el.lsb || 0}]` : ''; }
  function dispName(el) {
    const n = el.label !== undefined ? el.label : (el.name || '');
    if (el.label !== undefined) return n;
    if ((el.w || 1) > 1) return n.includes('%') ? n.replace(/%/g, '*') : n + busLabel(el);
    return n.replace(/%/g, '0');
  }
  function objAttr(el, kind) {
    if (!el.name || el.ext) return '';
    const w = el.w || 1;
    let n = el.name;
    if (kind === 'port') n = w > 1 || el.bus ? `${n}[*]` : n;
    else n = w > 1 ? (n.includes('%') ? n.replace(/%/g, '*') : `${n}[*]`) : n.replace(/%/g, '0');
    return ` data-obj="${esc(kind + ':' + n)}"`;
  }

  // ---------------------------------------------------------------------------
  // Символы: размер, выводы, отрисовка
  // ---------------------------------------------------------------------------
  const SYM = {};

  function ffSym(el, o) {
    const w = 64, h = 76;
    const pins = {};
    pins[o.d || 'D'] = { x: 0, y: 18, side: 'l' };
    pins[o.q || 'Q'] = { x: w, y: 18, side: 'r' };
    pins[o.c || 'C'] = { x: 0, y: 58, side: 'l' };
    if (el.ce || o.ce) pins.CE = { x: 0, y: 38, side: 'l' };
    const rst = el.rst || o.rst;
    if (rst) pins[rst] = { x: w / 2, y: h, side: 'b' };
    if (o.extra) Object.assign(pins, o.extra);
    return {
      w, h, pins,
      draw(x, y) {
        let s = '';
        const multi = (el.w || 1) > 1;
        if (multi) s += `<rect x="${x + 5}" y="${y - 5}" width="${w}" height="${h}" rx="3" class="sch-box sch-stack"/>`;
        s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="sch-box sch-ff"/>`;
        s += t(x + 6, y + 22, o.d || 'D', 'sch-pin');
        s += t(x + w - 6, y + 22, o.q || 'Q', 'sch-pin', 'end');
        if (pins.CE) s += t(x + 6, y + 42, 'CE', 'sch-pin');
        const cy = y + 58;
        s += `<polyline points="${x},${cy - 6} ${x + 9},${cy} ${x},${cy + 6}" class="sch-clk-tri"/>`;
        s += t(x + 12, cy + 4, o.c === 'CK' || o.c === 'CKN' ? '' : '', 'sch-pin');
        if (el.negedge || o.neg) s += `<circle cx="${x - 4}" cy="${cy}" r="3.5" class="sch-bubble"/>`;
        if (rst) s += t(x + w / 2, y + h - 5, rst, 'sch-pin', 'middle');
        if (o.extra) for (const [n, p] of Object.entries(o.extra)) s += t(x + p.x + (p.side === 'l' ? 6 : -6), y + p.y + 4, n, 'sch-pin', p.side === 'l' ? 'start' : 'end');
        // с нижним выводом сброса подпись типа – правее его провода
        s += rst ? t(x + w / 2 + 10, y + h + 13, el.ref || o.ref, 'sch-ref sch-out', 'start') : t(x + w / 2, y + h + 13, el.ref || o.ref, 'sch-ref sch-out', 'middle');
        if (multi) s += t(x + w - 4, y + h - 4, '×' + el.w, 'sch-ref', 'end');
        return s;
      },
    };
  }
  SYM.ff = (el) => ffSym(el, { ref: 'FDRE' });
  SYM.fdre = SYM.ff;
  SYM.fdce = (el) => ffSym(el, { ref: 'FDCE', rst: 'CLR' });
  SYM.fdpe = (el) => ffSym(el, { ref: 'FDPE', rst: 'PRE' });
  SYM.fdse = (el) => ffSym(el, { ref: 'FDSE', rst: 'S' });
  SYM.dff = (el) => ffSym(el, { ref: 'DFF', c: 'CK' });
  SYM.dffn = (el) => ffSym(el, { ref: 'DFFN', c: 'CKN', neg: true });
  SYM.dffr = (el) => ffSym(el, { ref: 'DFFR', c: 'CK', rst: 'RN' });
  SYM.sdff = (el) => ffSym(el, { ref: 'SDFF', c: 'CK', extra: { SI: { x: 0, y: 32, side: 'l' }, SE: { x: 0, y: 44, side: 'l' } } });
  SYM.sdffr = (el) => ffSym(el, { ref: 'SDFFR', c: 'CK', rst: 'RN', extra: { SI: { x: 0, y: 32, side: 'l' }, SE: { x: 0, y: 44, side: 'l' } } });

  function boxSym(el, w, h, pins, title, cls) {
    return {
      w, h, pins,
      draw(x, y) {
        let s = '';
        if ((el.w || 1) > 1) s += `<rect x="${x + 5}" y="${y - 5}" width="${w}" height="${h}" rx="3" class="sch-box sch-stack"/>`;
        s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="sch-box ${cls || ''}"/>`;
        for (const [n, p] of Object.entries(pins)) {
          if (p.hide) continue;
          const lx = p.side === 'l' ? x + 6 : p.side === 'r' ? x + w - 6 : x + p.x;
          const ly = p.side === 't' ? y + 12 : p.side === 'b' ? y + h - 5 : y + p.y + 4;
          const an = p.side === 'l' ? 'start' : p.side === 'r' ? 'end' : 'middle';
          if (p.clk) {
            const cy = y + p.y;
            s += `<polyline points="${x},${cy - 6} ${x + 9},${cy} ${x},${cy + 6}" class="sch-clk-tri"/>`;
            s += t(x + 12, cy + 4, p.label || n, 'sch-pin');
          } else s += t(lx, ly, p.label !== undefined ? p.label : n, 'sch-pin', an);
        }
        // заголовок может состоять из нескольких строк (разделитель \n)
        if (title) String(title).split('\n').forEach((ln, i) => { s += t(x + w / 2, y + (el.titleY || 15) + i * 14, ln, i ? 'sch-t' : 'sch-title', 'middle'); });
        return s;
      },
    };
  }
  SYM.iddr = (el) => boxSym(el, 76, 84, { D: { x: 0, y: 24, side: 'l' }, C: { x: 0, y: 64, side: 'l', clk: true }, Q1: { x: 76, y: 32, side: 'r' }, Q2: { x: 76, y: 56, side: 'r' } }, 'IDDR', 'sch-io');
  SYM.oddr = (el) => boxSym(el, 76, 84, { D1: { x: 0, y: 28, side: 'l' }, D2: { x: 0, y: 46, side: 'l' }, C: { x: 0, y: 66, side: 'l', clk: true }, Q: { x: 76, y: 42, side: 'r' } }, 'ODDR', 'sch-io');
  SYM.icg = (el) => boxSym(el, 64, 60, { E: { x: 0, y: 22, side: 'l' }, CK: { x: 0, y: 44, side: 'l', clk: true }, GCK: { x: 64, y: 33, side: 'r' } }, 'ICG', 'sch-clkcell');
  SYM.ram = (el) => boxSym(el, 110, 112, {
    ADDRARDADDR: { x: 0, y: 30, side: 'l', label: 'ADDR' }, DIADI: { x: 0, y: 50, side: 'l', label: 'DIN' }, WEA: { x: 0, y: 70, side: 'l', label: 'WE' },
    CLKARDCLK: { x: 0, y: 92, side: 'l', clk: true, label: 'CLK' }, DOADO: { x: 110, y: 30, side: 'r', label: 'DOUT' }, ENARDEN: { x: 0, y: 108, side: 'l', hide: true },
  }, 'RAMB36', 'sch-ram');

  function pllSym(el, kind) {
    const outs = el.outs || [];
    const n = Math.max(outs.length, 1);
    const maxL = Math.max(7, ...outs.map((o) => String(o.label || o.pin).length));
    const w = el.bw || Math.max(128, 64 + maxL * 6.2);
    const h = Math.max(74, 44 + 24 * n);
    const inY = el.inY || Math.round(h / 2 + 6);
    const pins = {};
    pins[kind === 'APLL' ? 'REFCLK' : 'CLKIN1'] = { x: 0, y: inY, side: 'l' };
    outs.forEach((o, i) => { pins[o.pin] = { x: w, y: 34 + 24 * i, side: 'r', label: o.label || o.pin }; });
    if (el.locked) pins[kind === 'APLL' ? 'LOCK' : 'LOCKED'] = { x: w, y: h - 10, side: 'r' };
    return {
      w, h, pins,
      draw(x, y) {
        let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="sch-box sch-clkcell"/>`;
        s += t(x + w / 2, y + 16, el.title || (kind === 'APLL' ? 'PLL' : kind === 'PLLE2_ADV' ? 'PLL' : 'MMCM'), 'sch-title', 'middle');
        s += t(x + 6, y + inY + 4, kind === 'APLL' ? 'REFCLK' : 'CLKIN', 'sch-pin');
        outs.forEach((o, i) => { s += t(x + w - 6, y + 38 + 24 * i, o.label || o.pin, 'sch-pin', 'end'); });
        if (el.locked) s += t(x + w - 6, y + h - 6, kind === 'APLL' ? 'LOCK' : 'LOCKED', 'sch-pin', 'end');
        if (el.note) s += t(x + 6, y + h - 6, el.note, 'sch-ref');
        return s;
      },
    };
  }
  SYM.mmcm = (el) => pllSym(el, 'MMCME2_ADV');
  SYM.mmcm4 = SYM.mmcm;
  SYM.pll = (el) => pllSym(el, 'PLLE2_ADV');
  SYM.apll = (el) => pllSym(el, 'APLL');

  function triSym(el, label, o) {
    o = o || {};
    const w = o.w || 36, h = o.h || 28;
    const pins = Object.assign({ [o.i || 'I']: { x: 0, y: h / 2, side: 'l' }, [o.o || 'O']: { x: w, y: h / 2, side: 'r' } }, o.pins || {});
    return {
      w, h, pins,
      draw(x, y) {
        let s = `<polygon points="${x},${y} ${x + w - (o.bubble ? 7 : 0)},${y + h / 2} ${x},${y + h}" class="sch-box ${o.cls || 'sch-buf'}"/>`;
        if (o.bubble) s += `<circle cx="${x + w - 3.5}" cy="${y + h / 2}" r="3.5" class="sch-bubble"/>`;
        if (o.ce) s += `<line x1="${x + w * 0.45}" y1="${y + h * 0.78}" x2="${x + w * 0.45}" y2="${y + h + 2}" class="sch-line"/>`;
        // с нижним выводом (CE, T) подпись типа – правее его провода
        const pb = Object.values(pins).filter((p) => p.side === 'b').reduce((m, p) => Math.max(m, p.x), -1);
        if (label) s += pb >= 0 ? t(x + pb + 10, y + h + 12, label, 'sch-ref sch-out', 'start') : t(x + w / 2 - 2, y + h + 12, label, 'sch-ref sch-out', 'middle');
        if (o.inner) s += t(x + 4, y + h / 2 + 3.5, o.inner, 'sch-inner');
        return s;
      },
    };
  }
  SYM.ibuf = (el) => triSym(el, el.ref || 'IBUF');
  SYM.ibufg = (el) => triSym(el, 'IBUFG');
  SYM.obuf = (el) => triSym(el, 'OBUF');
  SYM.bufg = (el) => triSym(el, 'BUFG', { cls: 'sch-clkbuf' });
  SYM.bufh = (el) => triSym(el, 'BUFH', { cls: 'sch-clkbuf' });
  SYM.bufio = (el) => triSym(el, 'BUFIO', { cls: 'sch-clkbuf' });
  SYM.bufr = (el) => triSym(el, `BUFR${el.attrs && el.attrs.BUFR_DIVIDE && el.attrs.BUFR_DIVIDE !== 'BYPASS' ? ' ÷' + el.attrs.BUFR_DIVIDE : ''}`, { cls: 'sch-clkbuf' });
  SYM.bufgce_div = (el) => triSym(el, `BUFGCE_DIV ÷${(el.attrs && el.attrs.BUFGCE_DIVIDE) || 1}`, { cls: 'sch-clkbuf' });
  SYM.bufgce = (el) => triSym(el, 'BUFGCE', { cls: 'sch-clkbuf', ce: true, pins: { CE: { x: 16, y: 30, side: 'b' } } });
  SYM.buf = (el) => triSym(el, el.ref || 'BUF', { i: 'A', o: 'Y' });
  SYM.ckbuf = (el) => triSym(el, 'CKBUF', { i: 'A', o: 'Y', cls: 'sch-clkbuf' });
  SYM.inv = (el) => triSym(el, '', { i: 'A', o: 'Y', bubble: true, w: 40 });
  SYM.ckinv = SYM.inv;
  SYM.idelay = (el) => boxSym(el, 64, 34, { IDATAIN: { x: 0, y: 17, side: 'l', label: '' }, DATAOUT: { x: 64, y: 17, side: 'r', label: '' } }, 'IDELAY', 'sch-io');
  SYM.odelay = (el) => boxSym(el, 64, 34, { ODATAIN: { x: 0, y: 17, side: 'l', label: '' }, DATAOUT: { x: 64, y: 17, side: 'r', label: '' } }, 'ODELAY', 'sch-io');
  SYM.ibufds = (el) => ({
    w: 42, h: 38, pins: { I: { x: 0, y: 10, side: 'l' }, IB: { x: 0, y: 28, side: 'l' }, O: { x: 42, y: 19, side: 'r' } },
    draw(x, y) {
      return `<polygon points="${x},${y} ${x + 42},${y + 19} ${x},${y + 38}" class="sch-box sch-buf"/>` +
        t(x + 4, y + 13, '+', 'sch-pin') + t(x + 4, y + 31, '−', 'sch-pin') + t(x + 19, y + 51, el.ref || 'IBUFDS', 'sch-ref', 'middle');
    },
  });
  SYM.ibufgds = SYM.ibufds;
  SYM.obufds = (el) => ({
    w: 42, h: 38, pins: { I: { x: 0, y: 19, side: 'l' }, O: { x: 42, y: 10, side: 'r' }, OB: { x: 42, y: 28, side: 'r' } },
    draw(x, y) {
      return `<polygon points="${x},${y} ${x + 42},${y + 19} ${x},${y + 38}" class="sch-box sch-buf"/>` +
        t(x + 30, y + 9, '+', 'sch-pin') + t(x + 30, y + 37, '−', 'sch-pin') + t(x + 19, y + 51, 'OBUFDS', 'sch-ref', 'middle');
    },
  });
  SYM.iobuf = (el) => ({
    w: 48, h: 44, pins: { I: { x: 0, y: 11, side: 'l' }, O: { x: 0, y: 33, side: 'l' }, T: { x: 18, y: 44, side: 'b' }, IO: { x: 48, y: 22, side: 'r' } },
    draw(x, y) {
      let s = `<rect x="${x}" y="${y}" width="48" height="44" rx="3" class="sch-box sch-io"/>`;
      s += `<polygon points="${x + 8},${y + 5} ${x + 26},${y + 11} ${x + 8},${y + 17}" class="sch-buf-mini"/>`;
      s += `<polygon points="${x + 26},${y + 27} ${x + 8},${y + 33} ${x + 26},${y + 39}" class="sch-buf-mini"/>`;
      s += `<polyline points="${x + 26},${y + 11} ${x + 36},${y + 11} ${x + 36},${y + 33} ${x + 26},${y + 33}" class="sch-line"/><line x1="${x + 36}" y1="${y + 22}" x2="${x + 48}" y2="${y + 22}" class="sch-line"/>`;
      s += t(x + 24, y - 4, 'IOBUF', 'sch-ref', 'middle');
      return s;
    },
  });
  SYM.obuft = (el) => triSym(el, 'OBUFT', { pins: { T: { x: 14, y: 28, side: 'b' } } });

  function muxSym(el, names, title, cls) {
    const w = 40, h = 64;
    const [i0, i1, s0, o0] = names;
    return {
      w, h, pins: { [i0]: { x: 0, y: 18, side: 'l' }, [i1]: { x: 0, y: 46, side: 'l' }, [s0]: { x: 20, y: 59, side: 'b' }, [o0]: { x: w, y: 32, side: 'r' } },
      draw(x, y) {
        let s = `<polygon points="${x},${y} ${x + w},${y + 12} ${x + w},${y + h - 12} ${x},${y + h}" class="sch-box ${cls}"/>`;
        s += t(x + 5, y + 22, '0', 'sch-pin') + t(x + 5, y + 50, '1', 'sch-pin');
        if (title) s += t(x + 28, y + h + 10, title, 'sch-ref sch-out', 'start'); // правее провода выбора S
        return s;
      },
    };
  }
  SYM.bufgmux = (el) => muxSym(el, ['I0', 'I1', 'S', 'O'], 'BUFGMUX', 'sch-clkbuf');
  SYM.mux2 = (el) => muxSym(el, ['A', 'B', 'S', 'Y'], el.ref || 'MUX2', 'sch-logic');
  SYM.ckmux2 = (el) => muxSym(el, ['A', 'B', 'S', 'Y'], 'CKMUX2', 'sch-clkbuf');

  function gateSym(el, kind) {
    const w = 46, h = 36;
    return {
      w, h, pins: { A: { x: 0, y: 10, side: 'l' }, B: { x: 0, y: 26, side: 'l' }, Y: { x: w, y: 18, side: 'r' } },
      draw(x, y) {
        let s = '';
        const bub = kind === 'nand' || kind === 'nor';
        const ww = bub ? w - 7 : w;
        if (kind === 'and' || kind === 'nand') {
          s += `<path d="M${x},${y} H${x + ww / 2} A${ww / 2},${h / 2} 0 0 1 ${x + ww / 2},${y + h} H${x} Z" class="sch-box sch-logic"/>`;
        } else {
          const off = kind === 'xor' ? 6 : 0;
          s += `<path d="M${x + off},${y} Q${x + ww * 0.55},${y} ${x + ww},${y + h / 2} Q${x + ww * 0.55},${y + h} ${x + off},${y + h} Q${x + off + 9},${y + h / 2} ${x + off},${y} Z" class="sch-box sch-logic"/>`;
          if (kind === 'xor') s += `<path d="M${x},${y} Q${x + 9},${y + h / 2} ${x},${y + h}" class="sch-line"/>`;
        }
        if (bub) s += `<circle cx="${x + w - 3.5}" cy="${y + h / 2}" r="3.5" class="sch-bubble"/>`;
        return s;
      },
    };
  }
  SYM.and2 = (el) => gateSym(el, 'and');
  SYM.or2 = (el) => gateSym(el, 'or');
  SYM.nand2 = (el) => gateSym(el, 'nand');
  SYM.nor2 = (el) => gateSym(el, 'nor');
  SYM.xor2 = (el) => gateSym(el, 'xor');

  SYM.logic = (el) => {
    const w = el.bw || 78, h = el.bh || 46;
    const pins = { I: { x: 0, y: h / 2, side: 'l' }, O: { x: w, y: h / 2, side: 'r' } };
    for (let i = 0; i < 4; i++) pins['I' + i] = { x: 0, y: h * (i + 1) / 5, side: 'l' };
    for (let i = 0; i < 3; i++) pins['O' + i] = { x: w, y: h * (i + 1) / 4, side: 'r' };
    return {
      w, h, pins,
      draw(x, y) {
        const rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry;
        let s = '';
        if ((el.w || 1) > 1) s += `<ellipse cx="${cx + 4}" cy="${cy - 4}" rx="${rx}" ry="${ry}" class="sch-box sch-stack"/>`;
        s += `<path d="M${x + w * 0.18},${y + h * 0.9} C${x - w * 0.08},${y + h * 0.9} ${x - w * 0.06},${y + h * 0.45} ${x + w * 0.14},${y + h * 0.42} C${x + w * 0.1},${y + h * 0.05} ${x + w * 0.45},${y - h * 0.05} ${x + w * 0.55},${y + h * 0.16} C${x + w * 0.7},${y - h * 0.04} ${x + w * 0.98},${y + h * 0.1} ${x + w * 0.9},${y + h * 0.42} C${x + w * 1.06},${y + h * 0.55} ${x + w * 0.98},${y + h * 0.95} ${x + w * 0.8},${y + h * 0.9} Z" class="sch-box sch-cloud"/>`;
        s += t(cx, cy + 4, el.label || L('логика', 'logic'), 'sch-inner', 'middle');
        return s;
      },
    };
  };
  SYM.lut = SYM.logic;

  SYM.block = (el) => {
    const pins = {};
    const sides = { l: [], r: [], t: [], b: [] };
    for (const p of el.pins || []) {
      const side = p.side || (p.d === 'out' ? 'r' : 'l');
      sides[side].push(p);
    }
    const maxLR = Math.max(sides.l.length, sides.r.length, 1);
    const longest = Math.max(...(el.pins || [{ n: '' }]).map((p) => String(p.label || p.n).length), 3);
    const w = el.bw || Math.max(100, Math.max(...String(el.title || el.name || '').split('\n').map((l) => l.length)) * 7.2 + 24, longest * CH_MONO * 2 + 30);
    const h = el.bh || Math.max(50, 32 + maxLR * 20);
    const place = (arr, side) => {
      arr.forEach((p, i) => {
        if (side === 'l' || side === 'r') {
          const y = p.y !== undefined ? p.y : 32 + i * 20;
          pins[p.n] = { x: side === 'l' ? 0 : w, y, side, clk: p.clk, label: p.label };
        } else {
          const x = p.x !== undefined ? p.x : w * (i + 1) / (arr.length + 1);
          pins[p.n] = { x, y: side === 't' ? 0 : h, side, label: p.label };
        }
      });
    };
    for (const s of ['l', 'r', 't', 'b']) place(sides[s], s);
    const sym = boxSym(el, w, h, pins, el.title !== undefined ? el.title : (el.ext ? el.name : (el.ref || 'BLOCK')), el.ext ? 'sch-ext' : 'sch-block');
    return sym;
  };
  SYM.chip = (el) => SYM.block(Object.assign({}, el, { ext: true }));
  SYM.conn = SYM.chip;

  SYM.osc = (el) => ({
    w: 40, h: 40, pins: { out: { x: 40, y: 20, side: 'r' }, O: { x: 40, y: 20, side: 'r' } },
    draw(x, y) {
      return `<circle cx="${x + 20}" cy="${y + 20}" r="19" class="sch-box sch-ext"/>` +
        `<path d="M${x + 7},${y + 20} q4.5,-10 9,0 t9,0 t9,0" class="sch-line"/>` + t(x + 20, y + 54, el.label || 'OSC', 'sch-t', 'middle');
    },
  });
  SYM.vcc = (el) => ({
    w: 20, h: 20, pins: { P: { x: 10, y: 20, side: 'b' } },
    draw(x, y) { return `<line x1="${x + 10}" y1="${y + 6}" x2="${x + 10}" y2="${y + 20}" class="sch-line"/><line x1="${x}" y1="${y + 6}" x2="${x + 20}" y2="${y + 6}" class="sch-line"/>` + t(x + 10, y + 2, el.label || '1', 'sch-ref', 'middle'); },
  });
  SYM.gnd = (el) => ({
    w: 20, h: 20, pins: { G: { x: 10, y: 0, side: 't' } },
    draw(x, y) { return `<line x1="${x + 10}" y1="${y}" x2="${x + 10}" y2="${y + 10}" class="sch-line"/><line x1="${x}" y1="${y + 10}" x2="${x + 20}" y2="${y + 10}" class="sch-line"/><line x1="${x + 5}" y1="${y + 14}" x2="${x + 15}" y2="${y + 14}" class="sch-line"/>` + t(x + 10, y + 26, el.label || '0', 'sch-ref', 'middle'); },
  });

  function portSym(el) {
    const name = (el.label !== undefined ? el.label : el.name) + (el.label !== undefined ? '' : busLabel(el));
    const w = Math.max(56, name.length * CH_MONO + 22), h = 22;
    const dir = el.t;
    // flip: контактная площадка с другой стороны (для внешних устройств справа/слева)
    const padLeft = (dir === 'in' || dir === 'inout') !== !!el.flip;
    const tipRight = dir === 'in' ? padLeft : !padLeft;
    const pins = padLeft
      ? { pad: { x: 0, y: h / 2, side: 'l' }, O: { x: w, y: h / 2, side: 'r' }, I: { x: w, y: h / 2, side: 'r' }, IO: { x: w, y: h / 2, side: 'r' }, '': { x: w, y: h / 2, side: 'r' } }
      : { pad: { x: w, y: h / 2, side: 'r' }, I: { x: 0, y: h / 2, side: 'l' }, O: { x: 0, y: h / 2, side: 'l' }, IO: { x: 0, y: h / 2, side: 'l' }, '': { x: 0, y: h / 2, side: 'l' } };
    return {
      w, h, pins,
      draw(x, y) {
        let pts, cx;
        if (dir === 'inout') { pts = `${x + 7},${y} ${x + w - 7},${y} ${x + w},${y + h / 2} ${x + w - 7},${y + h} ${x + 7},${y + h} ${x},${y + h / 2}`; cx = x + w / 2; }
        else if (tipRight) { pts = `${x},${y} ${x + w - 9},${y} ${x + w},${y + h / 2} ${x + w - 9},${y + h} ${x},${y + h}`; cx = x + (w - 9) / 2 + 1; }
        else { pts = `${x + 9},${y} ${x + w},${y} ${x + w},${y + h} ${x + 9},${y + h} ${x},${y + h / 2}`; cx = x + 9 + (w - 9) / 2 - 1; }
        return `<polygon points="${pts}" class="sch-port sch-port-${dir}"/>` + t(cx, y + 15, name, 'sch-portname', 'middle');
      },
    };
  }
  SYM.in = portSym; SYM.out = portSym; SYM.inout = portSym;

  SYM.note = (el) => {
    const lines = String(el.text || '').split('\n');
    const w = el.bw || Math.max(...lines.map((l) => l.length)) * CH_SANS + 16;
    const h = el.bh || lines.length * 15 + 10;
    return {
      w, h, pins: {},
      draw(x, y) {
        let s = el.box === false ? '' : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="sch-note"/>`;
        lines.forEach((l, i) => { s += t(x + 8, y + 17 + i * 15, l, el.cls || 'sch-notetext'); });
        return s;
      },
    };
  };
  SYM.label = (el) => ({ w: (el.text || '').length * CH_SANS, h: 14, pins: {}, draw(x, y) { return t(x, y + 11, el.text || '', el.cls || 'sch-t', el.anchor); } });
  SYM.text = SYM.label;
  SYM.boundary = (el) => ({
    w: el.bw || 400, h: el.bh || 200, pins: {},
    draw(x, y) {
      return `<rect x="${x}" y="${y}" width="${el.bw}" height="${el.bh}" rx="10" class="sch-boundary ${el.cls || ''}"/>` + t(x + 12, y + 20, el.label || 'FPGA', 'sch-boundary-label');
    },
  });

  // ---------------------------------------------------------------------------
  // Автоматическая раскладка (для элементов без координат)
  // ---------------------------------------------------------------------------
  function autoLayout(spec, syms) {
    const els = spec.elements.filter((e) => e.t !== 'boundary' && e.t !== 'note' && e.t !== 'label');
    const need = els.filter((e) => e.x === undefined || e.y === undefined);
    if (!need.length) return;
    const id2 = new Map(els.map((e) => [e.id, e]));
    const succ = new Map(els.map((e) => [e.id, []]));
    const pred = new Map(els.map((e) => [e.id, []]));
    for (const w of spec.wires || []) {
      const a = w.from.split('.')[0];
      for (const to of (Array.isArray(w.to) ? w.to : [w.to])) {
        const b = to.split('.')[0];
        if (id2.has(a) && id2.has(b) && a !== b) { succ.get(a).push(b); pred.get(b).push(a); }
      }
    }
    const depth = new Map();
    const visiting = new Set();
    const dep = (id) => {
      if (depth.has(id)) return depth.get(id);
      if (visiting.has(id)) return 0;
      visiting.add(id);
      let d = 0;
      for (const p of pred.get(id)) d = Math.max(d, dep(p) + 1);
      visiting.delete(id);
      depth.set(id, d);
      return d;
    };
    els.forEach((e) => dep(e.id));
    const cols = new Map();
    for (const e of els) { const d = depth.get(e.id); if (!cols.has(d)) cols.set(d, []); cols.get(d).push(e); }
    let x = 40;
    const ds = [...cols.keys()].sort((a, b) => a - b);
    for (const d of ds) {
      const col = cols.get(d);
      let y = 50, maxw = 0;
      for (const e of col) {
        const s = syms.get(e.id);
        if (e.x === undefined) e.x = x;
        if (e.y === undefined) e.y = y;
        y += (s ? s.h : 40) + 50;
        maxw = Math.max(maxw, s ? s.w : 60);
      }
      x += maxw + 80;
    }
  }

  // ---------------------------------------------------------------------------
  // Трассировка проводов
  // ---------------------------------------------------------------------------
  const DIRV = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };
  function orth(pts, vfirst) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = out[out.length - 1];
      const [x1, y1] = pts[i];
      if (x0 !== x1 && y0 !== y1) out.push(vfirst ? [x0, y1] : [x1, y0]);
      out.push([x1, y1]);
    }
    const s = [out[0]];
    for (let i = 1; i < out.length; i++) {
      const p = out[i], q = s[s.length - 1];
      if (p[0] === q[0] && p[1] === q[1]) continue;
      if (s.length >= 2) {
        const r = s[s.length - 2];
        if ((r[0] === q[0] && q[0] === p[0]) || (r[1] === q[1] && q[1] === p[1])) { s[s.length - 1] = p; continue; }
      }
      s.push(p);
    }
    return s;
  }
  function route(A, B, w, trunkX) {
    const st = 12;
    const a1 = [A.x + DIRV[A.side][0] * st, A.y + DIRV[A.side][1] * st];
    const b1 = [B.x + DIRV[B.side][0] * st, B.y + DIRV[B.side][1] * st];
    let mid;
    const fwdPins = (A.side === 'r' && B.side === 'l' && B.x >= A.x) || (A.side === 'l' && B.side === 'r' && B.x <= A.x);
    if (fwdPins && Math.abs(B.x - A.x) < 2 * st + 2) {
      // элементы стоят вплотную: без отводов
      const mx = Math.round((A.x + B.x) / 2);
      return orth([[A.x, A.y], [mx, A.y], [mx, B.y], [B.x, B.y]], false);
    }
    if (w.via) mid = w.via.map((p) => [p[0], p[1]]);
    else if ((A.side === 'r' || A.side === 'l') && (B.side === 'l' || B.side === 'r')) {
      const fwd = (A.side === 'r' && B.side === 'l' && b1[0] >= a1[0]) || (A.side === 'l' && B.side === 'r' && b1[0] <= a1[0]);
      if (fwd || w.mx !== undefined || trunkX !== undefined) {
        const mx = w.mx !== undefined ? w.mx : (trunkX !== undefined ? trunkX : Math.round((a1[0] + b1[0]) / 2));
        mid = [[mx, a1[1]], [mx, b1[1]]];
      } else {
        const my = w.my !== undefined ? w.my : Math.max(A.y, B.y) + 46;
        mid = [[a1[0], my], [b1[0], my]];
      }
    } else if (B.side === 'b' || B.side === 't') {
      mid = [[b1[0], a1[1]]];
      if (w.my !== undefined) mid = [[a1[0], w.my], [b1[0], w.my]];
    } else if (A.side === 'b' || A.side === 't') {
      mid = [[a1[0], b1[1]]];
    } else mid = [];
    const pts = orth([[A.x, A.y], a1, ...mid, b1, [B.x, B.y]], !!w.vfirst);
    return pts;
  }

  // ---------------------------------------------------------------------------
  // Главная функция
  // ---------------------------------------------------------------------------
  // показывается ли над элементом его имя
  function showsName(el) {
    const isDraw = ['note', 'label', 'text', 'chip', 'osc', 'conn', 'vcc', 'gnd'].includes(el.t) || el.ext;
    const isPort = el.t === 'in' || el.t === 'out' || el.t === 'inout';
    return !isDraw && !isPort && el.name && !el.noName && !((el.t === 'logic' || el.t === 'lut') && !el.showName);
  }
  function render(spec, opts) {
    opts = opts || {};
    spec = { elements: (spec.elements || []).map((e) => Object.assign({}, e)), wires: spec.wires || [] };
    const syms = new Map();
    const errs = [];
    for (const el of spec.elements) {
      const f = SYM[el.t];
      if (!f) { errs.push(L('нет символа для типа ', 'no symbol for type ') + el.t); continue; }
      if (el.t === 'boundary') continue;
      if (el.hidden) continue;
      syms.set(el.id, f(el));
    }
    autoLayout(spec, syms);
    // границы (boundary) с автоподгонкой
    for (const el of spec.elements) {
      if (el.t !== 'boundary') continue;
      if (el.bw === undefined || el.bh === undefined || el.x === undefined) {
        const inner = spec.elements.filter((e) => !e.ext && !['boundary', 'note', 'label', 'chip', 'osc', 'conn'].includes(e.t) && syms.has(e.id) && e.x !== undefined);
        if (inner.length) {
          const pad = el.pad || 26;
          // учитываются и подписи имён (они могут быть сдвинуты опцией nameX)
          const ext = (e) => {
            const sw = syms.get(e.id).w;
            let x0 = e.x, x1 = e.x + sw;
            if (showsName(e)) { const cx = e.x + (e.nameX !== undefined ? e.nameX : sw / 2), hw = dispName(e).length * 6.3 / 2; x0 = Math.min(x0, cx - hw); x1 = Math.max(x1, cx + hw); }
            return [x0, x1];
          };
          const minx = Math.min(...inner.map((e) => ext(e)[0])) - pad, miny = Math.min(...inner.map((e) => e.y)) - pad - 16;
          const maxx = Math.max(...inner.map((e) => ext(e)[1])) + pad, maxy = Math.max(...inner.map((e) => e.y + syms.get(e.id).h)) + pad + 10;
          if (el.x === undefined) el.x = minx;
          if (el.y === undefined) el.y = miny;
          if (el.bw === undefined) el.bw = maxx - el.x;
          if (el.bh === undefined) el.bh = maxy - el.y;
        }
      }
      syms.set(el.id, SYM.boundary(el));
    }
    const byId = new Map(spec.elements.map((e) => [e.id, e]));
    const pinPos = (ref) => {
      const k = ref.indexOf('.');
      // выбор разрядов элемента (rc[0:6].Q) на рисунке не отличается от всего элемента
      const id = (k >= 0 ? ref.slice(0, k) : ref).replace(/\[\d+(:\d+)?\]$/, '');
      let pn = k >= 0 ? ref.slice(k + 1) : '';
      const el = byId.get(id), s = syms.get(id);
      if (!el || !s) return null;
      if (!(pn in s.pins)) {
        const bus = pn.replace(/\[\d+\]$/, '');
        if (bus in s.pins) pn = bus;
        else if (el.t === 'logic' && /^I\d*$/.test(pn)) pn = 'I';
        else if (Object.keys(s.pins).length) {
          if (el.t === 'in' || el.t === 'out' || el.t === 'inout') pn = '';
          else { errs.push(L(`вывод ${ref} не найден на символе`, `pin ${ref} not found on the symbol`)); return null; }
        } else return null;
      }
      const p = s.pins[pn];
      return { x: el.x + p.x, y: el.y + p.y, side: p.side, el };
    };
    // провода
    const wiresOut = [];
    const dots = [];
    const drvCount = new Map();
    for (const w of spec.wires) for (const to of (Array.isArray(w.to) ? w.to : [w.to])) { drvCount.set(w.from, (drvCount.get(w.from) || 0) + 1); }
    const trunkUsed = new Map();
    for (const w of spec.wires) {
      const A = pinPos(w.from);
      if (!A) continue;
      const tos = Array.isArray(w.to) ? w.to : [w.to];
      const nDrv = drvCount.get(w.from) || 1;
      const elA = A.el;
      // разрядность провода: выбор разрядов источника (rc[0:6].Q – 7) или разрядность элемента
      const selM = /\[(\d+)(?::(\d+))?\](?=\.|$)/.exec(w.from);
      const selW = selM ? Math.abs((selM[2] !== undefined ? +selM[2] : +selM[1]) - +selM[1]) + 1 : null;
      const width = selW || elA.w || 1;
      const isBus = (w.bus !== undefined ? w.bus : width > 1);
      let trunk;
      if (nDrv > 1 && A.side === 'r' && w.mx === undefined && !w.via) trunk = trunkUsed.get(w.from) || (A.x + (w.trunk || 18));
      let first = true;
      for (const to of tos) {
        const B = pinPos(to);
        if (!B) continue;
        const wl = first ? w : Object.assign({}, w, { label: undefined });
        first = false;
        let tx = trunk;
        if (tx !== undefined && B.side === 'l' && B.x - 12 < tx) tx = undefined;
        if (tx !== undefined && (B.side === 'b' || B.side === 't')) tx = undefined;
        const pts = route(A, B, w, tx);
        if (tx !== undefined) {
          trunkUsed.set(w.from, tx);
          if (B.y !== A.y) dots.push([tx, A.y]);
        }
        wiresOut.push({ w: wl, pts, isBus, width, kind: w.kind || inferKind(elA, B.el, w), A, B, tx });
      }
    }
    const bnd = spec.elements.filter((e) => e.t === 'boundary');
    // точки соединения: в объединении проводов одного источника – вершины, где сходятся три и более направления
    const byDrv = new Map();
    // провода от выбранных разрядов (rc[0:6].Q) выходят из того же вывода, что и rc.Q
    const drvKey = (f) => f.replace(/\[\d+(:\d+)?\](?=\.|$)/, '');
    for (const wo of wiresOut) { const k = drvKey(wo.w.from); if (!byDrv.has(k)) byDrv.set(k, []); byDrv.get(k).push(wo.pts); }
    const dotSet = new Set();
    const pk = (p) => `${r1(p[0])},${r1(p[1])}`;
    const EPS = 0.05;
    for (const list of byDrv.values()) {
      if (list.length < 2) continue;
      const verts = new Map();
      for (const pts of list) for (const p of pts) verts.set(pk(p), p);
      const dirs = new Map();
      const addDir = (p, d) => { const k = pk(p); if (!dirs.has(k)) dirs.set(k, new Set()); dirs.get(k).add(d); };
      for (const pts of list) {
        for (let i = 0; i + 1 < pts.length; i++) {
          const a0 = pts[i], b0 = pts[i + 1];
          const horiz = Math.abs(a0[1] - b0[1]) < EPS, vert = Math.abs(a0[0] - b0[0]) < EPS;
          if (horiz === vert) continue; // точка или наклонный участок
          // участок разбивается всеми вершинами группы, которые на нём лежат
          const ax = horiz ? 0 : 1, lo = Math.min(a0[ax], b0[ax]) - EPS, hi = Math.max(a0[ax], b0[ax]) + EPS;
          const on = [...verts.values()].filter((p) => Math.abs(p[1 - ax] - a0[1 - ax]) < EPS && p[ax] >= lo && p[ax] <= hi).sort((p, q) => p[ax] - q[ax]);
          for (let j = 0; j + 1 < on.length; j++) {
            if (pk(on[j]) === pk(on[j + 1])) continue;
            addDir(on[j], horiz ? 'R' : 'D'); addDir(on[j + 1], horiz ? 'L' : 'U');
          }
        }
      }
      for (const [k, ds] of dirs) if (ds.size >= 3) dotSet.add(k);
    }
    // сборка SVG
    let body = '';
    for (const el of bnd) body += `<g class="sch-el">${syms.get(el.id).draw(el.x, el.y)}</g>`;
    let wsvg = '';
    for (const wo of wiresOut) {
      const d = wo.pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(' ');
      const cls = `sch-wire k-${wo.kind}${wo.isBus ? ' bus' : ''}${wo.w.dash ? ' dash' : ''}`;
      wsvg += `<polyline points="${d}" class="${cls}"/>`;
      if (wo.isBus && !wo.w.noSlash) {
        // косая черта шины – посередине первого участка; если он короче 24 px, на самом длинном из остальных
        // (на 30 % его длины, чтобы не попасть под подпись провода); точки соединения черта не закрывает
        const sg = [];
        for (let i = 0; i + 1 < wo.pts.length; i++) { const a = wo.pts[i], b = wo.pts[i + 1]; sg.push({ a, b, len: Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) }); }
        const rest = sg.slice(1).sort((x, y) => y.len - x.len);
        const order = sg[0].len >= 24 ? [[sg[0], [0.5, 0.3, 0.7]], ...rest.map((x) => [x, [0.3, 0.7, 0.5]])] : [...rest.map((x) => [x, [0.3, 0.7, 0.5]]), [sg[0], [0.5]]];
        const at = (seg, f) => [seg.a[0] + (seg.b[0] - seg.a[0]) * f, seg.a[1] + (seg.b[1] - seg.a[1]) * f];
        const free = (pt) => ![...dotSet].some((k) => { const [dx, dy] = k.split(',').map(Number); return Math.abs(dx - pt[0]) + Math.abs(dy - pt[1]) < 16; });
        let g = order[0][0], fr = order[0][1][0];
        search: for (const [seg, fs] of order) for (const f of fs) if (seg.len >= 16 && free(at(seg, f))) { g = seg; fr = f; break search; }
        const sx = g.a[0] + (g.b[0] - g.a[0]) * fr, sy = g.a[1] + (g.b[1] - g.a[1]) * fr;
        wsvg += `<line x1="${sx - 4}" y1="${sy + 5}" x2="${sx + 4}" y2="${sy - 5}" class="sch-busslash"/>`;
        const vert = Math.abs(g.a[0] - g.b[0]) < 0.05;
        // над горизонтальным участком подпись не должна ложиться на линию границы – иначе под провод
        const hitsBnd = !vert && bnd.some((b) => sx > b.x - 8 && sx < b.x + b.bw + 8 && [b.y, b.y + b.bh].some((by) => by > sy - 17 && by < sy - 2));
        const wtxt = String(wo.w.bw || wo.width || '');
        wsvg += vert ? t(sx + 7, sy + 4, wtxt, 'sch-buswidth', 'start') : t(sx + 2, hitsBnd ? sy + 15 : sy - 7, wtxt, 'sch-buswidth', 'middle');
      }
      if (wo.w.label) {
        // подпись – на самом длинном горизонтальном участке, кроме участка у выхода драйвера
        const segs = [];
        for (let i = 0; i + 1 < wo.pts.length; i++) {
          const a = wo.pts[i], b = wo.pts[i + 1];
          if (a[1] === b[1] && a[0] !== b[0]) segs.push({ len: Math.abs(b[0] - a[0]), x: (a[0] + b[0]) / 2, y: a[1] });
        }
        const cand = segs.length > 1 && segs[segs.length - 1].len >= 30 ? segs.slice(1) : segs;
        let best = null;
        for (const sg of cand) if (!best || sg.len >= best.len) best = sg;
        if (!best) best = { x: (wo.pts[0][0] + wo.pts[wo.pts.length - 1][0]) / 2, y: (wo.pts[0][1] + wo.pts[wo.pts.length - 1][1]) / 2 };
        const lx = wo.w.lx !== undefined ? wo.w.lx : best.x, ly = wo.w.ly !== undefined ? wo.w.ly : best.y + (wo.w.below ? 14 : -5);
        wsvg += t(lx, ly, wo.w.label, `sch-wlabel k-${wo.kind}`, 'middle');
      }
    }
    for (const k of dotSet) { const [x, y] = k.split(',').map(Number); wsvg += `<circle cx="${x}" cy="${y}" r="2.6" class="sch-dot"/>`; }
    body += wsvg;
    for (const el of spec.elements) {
      if (el.t === 'boundary' || !syms.has(el.id)) continue;
      const s = syms.get(el.id);
      const kind = (el.t === 'in' || el.t === 'out' || el.t === 'inout') ? 'port' : 'cell';
      const isDraw = ['note', 'label', 'text', 'chip', 'osc', 'conn', 'vcc', 'gnd'].includes(el.t) || el.ext;
      let g = `<g class="sch-el${isDraw ? ' sch-decor' : ''}" data-id="${esc(el.id)}"${isDraw ? '' : objAttr(el, kind)}>`;
      g += s.draw(el.x, el.y);
      if (!isDraw && kind === 'cell' && showsName(el)) {
        const nm = dispName(el);
        const ny = el.nameY !== undefined ? el.y + el.nameY : el.y - ((el.w || 1) > 1 ? 9 : 5);
        g += t(el.x + (el.nameX !== undefined ? el.nameX : s.w / 2), ny, nm, 'sch-name', 'middle');
      }
      if (el.tag) g += t(el.x + s.w / 2, el.y + s.h + (el.tagY || 26), el.tag, 'sch-tag', 'middle');
      g += '</g>';
      body += g;
    }
    // габариты
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    const grow = (x, y) => { minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); };
    for (const el of spec.elements) {
      const s = syms.get(el.id);
      if (!s) continue;
      grow(el.x - 6, el.y - 22);
      grow(el.x + s.w + 8, el.y + s.h + 22);
      if (el.name && !el.ext) { const tw = dispName(el).length * CH_MONO / 2; grow(el.x + s.w / 2 - tw - 4, el.y - 22); grow(el.x + s.w / 2 + tw + 4, el.y); }
    }
    for (const wo of wiresOut) for (const p of wo.pts) grow(p[0], p[1]);
    for (const wo of wiresOut) if (wo.w.label) { const best = wo.pts; grow(best[0][0], best[0][1] - 16); }
    if (!isFinite(minx)) { minx = 0; miny = 0; maxx = 100; maxy = 50; }
    const pad = 10;
    const vb = [minx - pad, miny - pad, maxx - minx + 2 * pad, maxy - miny + 2 * pad].map((v) => Math.round(v));
    const title = opts.title ? `<title>${esc(opts.title)}</title>` : '';
    const svg = `<svg class="sch" xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${vb[2]}" height="${vb[3]}" role="img" aria-label="${esc(opts.title || L('Схема', 'Schematic'))}">${title}${body}</svg>`;
    return { svg, errors: errs, w: vb[2], h: vb[3] };
  }
  function inferKind(a, b, w) {
    if (w.ext) return 'ext';
    if (a && (a.ext || a.t === 'chip' || a.t === 'osc' || a.t === 'conn')) return 'ext';
    if (b && (b.ext || b.t === 'chip' || b.t === 'conn')) return 'ext';
    return 'data';
  }

  XT.schematic = { render, SYM };
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
