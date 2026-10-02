/* ConstraintLab – модель нетлиста: библиотека примитивов, построение из описания схемы, запросы объектов */
(function (XT) {
  'use strict';
  const U = XT.util;
  const TclError = XT.tcl.TclError;

  // ---------------------------------------------------------------------------
  // Библиотека ячеек
  //   pins: {имя: {dir, clk?, async?, w?}}
  //   arcs: [[from, to, 'neg'?]]            – комбинационные дуги
  //   launch:  {выход: {clk, edges}}         – запуск данных фронтом тактового сигнала
  //   capture: {вход:  {clk, edges, async}}  – проверки setup/hold (recovery/removal для async)
  //   seq: true – тактовые выводы останавливают распространение тактового сигнала
  // ---------------------------------------------------------------------------
  const LIB = {};
  function P(dir, extra) { return Object.assign({ dir }, extra || {}); }
  function def(names, spec) {
    for (const n of names.split(/\s+/)) LIB[n] = Object.assign({ ref: n }, spec);
  }
  const FF = (rst) => {
    const pins = { C: P('in', { clk: true }), CE: P('in', { en: true }), D: P('in'), Q: P('out') };
    const cap = { D: ['rise'], CE: ['rise'] };
    const asy = {};
    if (rst === 'R' || rst === 'S') { pins[rst] = P('in', { rst: true }); cap[rst] = ['rise']; }
    else { pins[rst] = P('in', { rst: true, async: true }); asy[rst] = ['rise']; }
    return { group: 'FLOP_LATCH', sub: 'flop', seq: true, clk: 'C', pins, launch: { Q: ['rise'] }, capture: cap, async: asy };
  };
  def('FDRE', Object.assign(FF('R'), { ptype: 'REGISTER.SDR.FDRE' }));
  def('FDSE', Object.assign(FF('S'), { ptype: 'REGISTER.SDR.FDSE' }));
  def('FDCE', Object.assign(FF('CLR'), { ptype: 'REGISTER.SDR.FDCE' }));
  def('FDPE', Object.assign(FF('PRE'), { ptype: 'REGISTER.SDR.FDPE' }));
  def('IDDR', {
    group: 'IO', sub: 'iddr', ptype: 'REGISTER.DDR.IDDR', seq: true, clk: 'C',
    pins: { C: P('in', { clk: true }), CE: P('in', { en: true }), D: P('in'), R: P('in', { rst: true }), S: P('in'), Q1: P('out'), Q2: P('out') },
    launch: { Q1: ['rise'], Q2: ['fall'] }, capture: { D: ['rise', 'fall'], CE: ['rise'] },
  });
  def('ODDR', {
    group: 'IO', sub: 'oddr', ptype: 'REGISTER.DDR.ODDR', seq: true, clk: 'C',
    pins: { C: P('in', { clk: true }), CE: P('in', { en: true }), D1: P('in'), D2: P('in'), R: P('in', { rst: true }), S: P('in'), Q: P('out') },
    launch: { Q: ['rise', 'fall'] }, capture: { D1: ['rise'], D2: ['fall'], CE: ['rise'] },
  });
  const BUF1 = (group, ptype) => ({ group, ptype, pins: { I: P('in'), O: P('out') }, arcs: [['I', 'O']] });
  def('IBUF IBUFG', BUF1('IO', 'IO.INPUT_BUFFER.IBUF'));
  def('OBUF', BUF1('IO', 'IO.OUTPUT_BUFFER.OBUF'));
  def('IBUFDS IBUFGDS', { group: 'IO', ptype: 'IO.INPUT_BUFFER.IBUFDS', pins: { I: P('in'), IB: P('in'), O: P('out') }, arcs: [['I', 'O'], ['IB', 'O', 'neg']] });
  def('OBUFDS', { group: 'IO', ptype: 'IO.OUTPUT_BUFFER.OBUFDS', pins: { I: P('in'), O: P('out'), OB: P('out') }, arcs: [['I', 'O'], ['I', 'OB', 'neg']] });
  def('OBUFT', { group: 'IO', ptype: 'IO.OUTPUT_BUFFER.OBUFT', pins: { I: P('in'), T: P('in'), O: P('out') }, arcs: [['I', 'O'], ['T', 'O']] });
  def('IOBUF', { group: 'IO', ptype: 'IO.BIDIR_BUFFER.IOBUF', pins: { I: P('in'), T: P('in'), O: P('out'), IO: P('inout') }, arcs: [['I', 'IO'], ['T', 'IO'], ['IO', 'O']] });
  def('IDELAYE2', { group: 'IO', ptype: 'IO.DELAY.IDELAYE2', pins: { IDATAIN: P('in'), DATAOUT: P('out') }, arcs: [['IDATAIN', 'DATAOUT']] });
  def('ODELAYE2', { group: 'IO', ptype: 'IO.DELAY.ODELAYE2', pins: { ODATAIN: P('in'), DATAOUT: P('out') }, arcs: [['ODATAIN', 'DATAOUT']] });
  def('BUFG BUFH BUFIO', BUF1('CLOCK', 'CLOCK.BUFFER.BUFG'));
  def('BUFGCE', { group: 'CLOCK', ptype: 'CLOCK.BUFFER.BUFGCE', clk: 'I', pins: { I: P('in'), CE: P('in', { en: true }), O: P('out') }, arcs: [['I', 'O']], capture: { CE: ['rise'] }, gate: { pin: 'CE', on: '1' } });
  def('BUFGMUX', { group: 'CLOCK', ptype: 'CLOCK.MUX.BUFGMUX', pins: { I0: P('in'), I1: P('in'), S: P('in'), O: P('out') }, arcs: [['I0', 'O'], ['I1', 'O']], mux: { sel: 'S', ins: ['I0', 'I1'] } });
  def('BUFR', { group: 'CLOCK', ptype: 'CLOCK.BUFFER.BUFR', pins: { I: P('in'), CE: P('in'), CLR: P('in'), O: P('out') }, arcs: [['I', 'O']], derive: { attr: 'BUFR_DIVIDE', in: 'I', out: 'O' } });
  def('BUFGCE_DIV', { group: 'CLOCK', ptype: 'CLOCK.BUFFER.BUFGCE_DIV', pins: { I: P('in'), CE: P('in'), CLR: P('in'), O: P('out') }, arcs: [['I', 'O']], derive: { attr: 'BUFGCE_DIVIDE', in: 'I', out: 'O' } });
  const PLLPINS = () => {
    const p = { CLKIN1: P('in', { clkin: true }), CLKIN2: P('in', { clkin: true }), CLKINSEL: P('in'), CLKFBIN: P('in'), RST: P('in'), PWRDWN: P('in'), CLKFBOUT: P('out'), LOCKED: P('out') };
    for (let i = 0; i <= 6; i++) p['CLKOUT' + i] = P('out');
    for (let i = 0; i <= 3; i++) p['CLKOUT' + i + 'B'] = P('out');
    return p;
  };
  def('MMCME2_ADV MMCME4_ADV MMCME3_ADV', { group: 'CLOCK', ptype: 'CLOCK.PLL.MMCME2_ADV', pins: PLLPINS(), pll: true, vendor: 'xilinx' });
  def('PLLE2_ADV PLLE4_ADV', { group: 'CLOCK', ptype: 'CLOCK.PLL.PLLE2_ADV', pins: PLLPINS(), pll: true, vendor: 'xilinx' });
  def('VCC', { group: 'OTHERS', pins: { P: P('out') }, konst: '1' });
  def('GND', { group: 'OTHERS', pins: { G: P('out') }, konst: '0' });
  def('LUT6 LUT', { group: 'CLB', sub: 'lut', ptype: 'CLB.LUT.LUT6', pins: { O: P('out') }, dyn: true });
  def('RAMB36E1', {
    group: 'BLOCKRAM', ptype: 'BLOCKRAM.BRAM.RAMB36E1', seq: true, clk: 'CLKARDCLK',
    pins: { CLKARDCLK: P('in', { clk: true }), ENARDEN: P('in'), WEA: P('in'), ADDRARDADDR: P('in'), DIADI: P('in'), DOADO: P('out') },
    launch: { DOADO: ['rise'] }, capture: { ENARDEN: ['rise'], WEA: ['rise'], ADDRARDADDR: ['rise'], DIADI: ['rise'] },
  });
  // --- ASIC (условная стандартная библиотека) ---
  def('DFF', { group: 'FLOP_LATCH', seq: true, clk: 'CK', pins: { CK: P('in', { clk: true }), D: P('in'), Q: P('out') }, launch: { Q: ['rise'] }, capture: { D: ['rise'] }, asic: true });
  def('DFFN', { group: 'FLOP_LATCH', seq: true, clk: 'CKN', pins: { CKN: P('in', { clk: true }), D: P('in'), Q: P('out') }, launch: { Q: ['fall'] }, capture: { D: ['fall'] }, asic: true });
  def('DFFR', { group: 'FLOP_LATCH', seq: true, clk: 'CK', pins: { CK: P('in', { clk: true }), D: P('in'), RN: P('in', { rst: true, async: true }), Q: P('out') }, launch: { Q: ['rise'] }, capture: { D: ['rise'] }, async: { RN: ['rise'] }, asic: true });
  def('SDFF', { group: 'FLOP_LATCH', seq: true, clk: 'CK', pins: { CK: P('in', { clk: true }), D: P('in'), SI: P('in'), SE: P('in'), Q: P('out') }, launch: { Q: ['rise'] }, capture: { D: ['rise'], SI: ['rise'], SE: ['rise'] },
    // условные проверки, как when в Liberty: D проверяется в рабочем режиме (SE = 0), SI – при сдвиге (SE = 1)
    when: { D: { SE: '0' }, SI: { SE: '1' } }, asic: true });
  def('SDFFR', { group: 'FLOP_LATCH', seq: true, clk: 'CK', pins: { CK: P('in', { clk: true }), D: P('in'), SI: P('in'), SE: P('in'), RN: P('in', { rst: true, async: true }), Q: P('out') }, launch: { Q: ['rise'] }, capture: { D: ['rise'], SI: ['rise'], SE: ['rise'] }, async: { RN: ['rise'] },
    when: { D: { SE: '0' }, SI: { SE: '1' } }, asic: true });
  def('BUF CKBUF', { group: 'LOGIC', pins: { A: P('in'), Y: P('out') }, arcs: [['A', 'Y']], asic: true, func: 'buf' });
  def('INV CKINV', { group: 'LOGIC', pins: { A: P('in'), Y: P('out') }, arcs: [['A', 'Y', 'neg']], asic: true, func: 'inv' });
  def('AND2', { group: 'LOGIC', pins: { A: P('in'), B: P('in'), Y: P('out') }, arcs: [['A', 'Y'], ['B', 'Y']], asic: true, func: 'and' });
  def('OR2', { group: 'LOGIC', pins: { A: P('in'), B: P('in'), Y: P('out') }, arcs: [['A', 'Y'], ['B', 'Y']], asic: true, func: 'or' });
  def('NAND2', { group: 'LOGIC', pins: { A: P('in'), B: P('in'), Y: P('out') }, arcs: [['A', 'Y', 'neg'], ['B', 'Y', 'neg']], asic: true, func: 'nand' });
  def('NOR2', { group: 'LOGIC', pins: { A: P('in'), B: P('in'), Y: P('out') }, arcs: [['A', 'Y', 'neg'], ['B', 'Y', 'neg']], asic: true, func: 'nor' });
  def('XOR2', { group: 'LOGIC', pins: { A: P('in'), B: P('in'), Y: P('out') }, arcs: [['A', 'Y'], ['B', 'Y']], asic: true, func: 'xor' });
  def('MUX2 CKMUX2', { group: 'LOGIC', pins: { A: P('in'), B: P('in'), S: P('in'), Y: P('out') }, arcs: [['A', 'Y'], ['B', 'Y'], ['S', 'Y']], mux: { sel: 'S', ins: ['A', 'B'] }, asic: true });
  def('ICG', { group: 'CLOCK', clk: 'CK', pins: { CK: P('in'), E: P('in'), SE: P('in'), GCK: P('out') }, arcs: [['CK', 'GCK']], capture: { E: ['rise'], SE: ['rise'] }, gate: { pin: 'E', alt: 'SE', on: '1' }, asic: true });
  def('APLL', { group: 'CLOCK', pins: { REFCLK: P('in', { clkin: true }), FBCLK: P('in'), CLKOUT0: P('out'), CLKOUT1: P('out'), CLKOUT2: P('out'), CLKOUT3: P('out'), LOCK: P('out') }, pll: true, asic: true });

  // нормализация описаний: capture/launch → {clk, edges, async}
  function normLib(L) {
    const norm = (m, isAsync) => {
      const out = {};
      for (const [pin, v] of Object.entries(m || {})) {
        if (Array.isArray(v)) out[pin] = { clk: L.clk, edges: v, async: !!isAsync };
        else out[pin] = { clk: v.clk || L.clk, edges: v.edges || ['rise'], async: !!(v.async || isAsync) };
      }
      return out;
    };
    const cap = norm(L.capture, false);
    Object.assign(cap, norm(L.async, true));
    L.captureN = cap;
    L.launchN = norm(L.launch, false);
    L.arcsN = (L.arcs || []).map((a) => ({ from: a[0], to: a[1], neg: a[2] === 'neg' }));
    return L;
  }
  for (const k of Object.keys(LIB)) normLib(LIB[k]);

  // Типы элементов схемы → ячейки библиотеки
  const ELEM_REF = {
    ff: 'FDRE', fdre: 'FDRE', fdce: 'FDCE', fdpe: 'FDPE', fdse: 'FDSE', iddr: 'IDDR', oddr: 'ODDR',
    ibuf: 'IBUF', ibufg: 'IBUFG', ibufds: 'IBUFDS', ibufgds: 'IBUFGDS', obuf: 'OBUF', obufds: 'OBUFDS', obuft: 'OBUFT', iobuf: 'IOBUF',
    idelay: 'IDELAYE2', odelay: 'ODELAYE2',
    bufg: 'BUFG', bufgce: 'BUFGCE', bufgmux: 'BUFGMUX', bufh: 'BUFH', bufio: 'BUFIO', bufr: 'BUFR', bufgce_div: 'BUFGCE_DIV',
    mmcm: 'MMCME2_ADV', mmcm4: 'MMCME4_ADV', pll: 'PLLE2_ADV',
    logic: 'LUT6', lut: 'LUT6', vcc: 'VCC', gnd: 'GND', ram: 'RAMB36E1',
    dff: 'DFF', dffn: 'DFFN', dffr: 'DFFR', sdff: 'SDFF', sdffr: 'SDFFR', buf: 'BUF', ckbuf: 'CKBUF', inv: 'INV', ckinv: 'CKINV',
    and2: 'AND2', or2: 'OR2', nand2: 'NAND2', nor2: 'NOR2', xor2: 'XOR2', mux2: 'MUX2', ckmux2: 'CKMUX2', icg: 'ICG', apll: 'APLL',
  };
  const DRAW_ONLY = new Set(['chip', 'osc', 'note', 'boundary', 'label', 'conn', 'box', 'text', 'arrow', 'trace', 'dim']);

  // ---------------------------------------------------------------------------
  // Объекты нетлиста
  // ---------------------------------------------------------------------------
  class Port {
    constructor(name, dir, bus, idx) {
      this.kind = 'port'; this.name = name; this.dir = dir; this.bus = bus; this.idx = idx;
      this.net = null; this.props = new Map(); this.elem = null;
    }
  }
  class Cell {
    constructor(name, ref, lib) {
      this.kind = 'cell'; this.name = name; this.ref = ref; this.lib = lib;
      this.pins = new Map(); this.attrs = {}; this.props = new Map(); this.hier = false; this.elem = null;
      const k = name.lastIndexOf('/');
      this.parent = k >= 0 ? name.slice(0, k) : '';
      this.local = k >= 0 ? name.slice(k + 1) : name;
    }
  }
  class Pin {
    constructor(cell, pname, spec, base) {
      this.kind = 'pin'; this.cell = cell; this.pname = pname; this.base = base || pname;
      this.name = cell.name + '/' + pname; this.dir = spec.dir; this.spec = spec; this.net = null;
      this.props = new Map();
    }
  }
  class Net {
    constructor(name) { this.kind = 'net'; this.name = name; this.members = []; this.props = new Map(); }
  }

  // ---------------------------------------------------------------------------
  // Проект
  // ---------------------------------------------------------------------------
  class Design {
    constructor(spec, opts) {
      opts = opts || {};
      this.spec = spec || { elements: [], wires: [] };
      this.tool = opts.tool || 'vivado';
      this.ports = new Map(); this.cells = new Map(); this.hier = new Map(); this.pins = new Map(); this.nets = new Map();
      this.elemObjs = new Map();   // id элемента → {cells, ports}
      this.errors = [];
      this.designObj = { kind: 'design', name: opts.name || 'top', props: new Map() };
      this.build();
    }
    err(msg) { this.errors.push(msg); }

    build() {
      const els = this.spec.elements || [];
      this.elById = new Map();
      for (const el of els) {
        if (!el.id) { this.err(XT.L('элемент без id: ', 'element without id: ') + JSON.stringify(el).slice(0, 80)); continue; }
        if (this.elById.has(el.id)) this.err(XT.L('повтор id элемента: ', 'duplicate element id: ') + el.id);
        this.elById.set(el.id, el);
      }
      for (const el of els) {
        if (!el.id || el.ext || DRAW_ONLY.has(el.t)) continue;
        if (el.t === 'in' || el.t === 'out' || el.t === 'inout') this.addPortElem(el);
        else this.addCellElem(el);
      }
      for (const w of this.spec.wires || []) this.addWire(w);
      // иерархические ячейки
      for (const c of [...this.cells.values()]) {
        let p = c.parent;
        while (p) {
          if (!this.hier.has(p)) {
            const h = new Cell(p, 'hier', null);
            h.hier = true;
            this.hier.set(p, h);
          }
          const k = p.lastIndexOf('/');
          p = k >= 0 ? p.slice(0, k) : '';
        }
      }
    }
    addPortElem(el) {
      const w = el.w || 1;
      const lsb = el.lsb || 0;
      if (!el.name) { this.err(XT.L(`порт ${el.id}: не задано имя`, `port ${el.id}: no name`)); return; }
      const ports = [];
      for (let i = 0; i < w; i++) {
        const idx = lsb + i;
        const nm = (w > 1 || el.bus) ? `${el.name}[${idx}]` : el.name;
        if (this.ports.has(nm)) { this.err(XT.L('повтор порта ', 'duplicate port ') + nm); continue; }
        const p = new Port(nm, el.t, (w > 1 || el.bus) ? el.name : null, (w > 1 || el.bus) ? idx : null);
        p.elem = el.id;
        if (el.props) for (const [k, v] of Object.entries(el.props)) p.props.set(k.toUpperCase(), { value: String(v), src: 'design' });
        this.ports.set(nm, p);
        ports.push(p);
      }
      this.elemObjs.set(el.id, { ports, cells: [] });
    }
    addCellElem(el) {
      let lib;
      if (el.t === 'block') {
        lib = this.blockLib(el);
      } else {
        const ref = el.ref || ELEM_REF[el.t];
        if (!ref || !LIB[ref]) { this.err(XT.L(`элемент ${el.id}: неизвестный тип «${el.t}»${el.ref ? ' / ref ' + el.ref : ''}`, `element ${el.id}: unknown type '${el.t}'${el.ref ? ' / ref ' + el.ref : ''}`)); return; }
        lib = LIB[ref];
      }
      const w = el.w || 1;
      const base = el.name || (el.t + '_' + el.id);
      const cells = [];
      for (let i = 0; i < w; i++) {
        const nm = w > 1 ? (base.includes('%') ? base.replace(/%/g, String(i)) : `${base}[${i}]`) : base.replace(/%/g, '0');
        if (this.cells.has(nm)) { this.err(XT.L('повтор ячейки ', 'duplicate cell ') + nm); continue; }
        const c = new Cell(nm, el.ref || lib.ref, lib);
        c.elem = el.id;
        c.bit = i;
        c.attrs = Object.assign({}, el.attrs || {});
        if (el.negedge) c.attrs.IS_C_INVERTED = 1;
        if (lib.pll) c.pll = { mult: el.mult || 1, divclk: el.divclk || 1, outs: el.outs || [] };
        if (el.props) for (const [k, v] of Object.entries(el.props)) c.props.set(k.toUpperCase(), { value: String(v), src: 'design' });
        // выводы
        const pw = el.pw || {};
        for (const [pn, spec] of Object.entries(lib.pins)) {
          const bw = pw[pn] || spec.w || 1;
          if (bw > 1) for (let j = 0; j < bw; j++) { const p = new Pin(c, `${pn}[${j}]`, spec, pn); c.pins.set(p.pname, p); this.pins.set(p.name, p); }
          else { const p = new Pin(c, pn, spec, pn); c.pins.set(pn, p); this.pins.set(p.name, p); }
        }
        c.dynIn = 0;
        this.cells.set(nm, c);
        cells.push(c);
      }
      this.elemObjs.set(el.id, { ports: [], cells });
    }
    blockLib(el) {
      // произвольный блок: pins [{n, d, w, clk, async}], timing {launch, capture, async, arcs, seq, clk}
      const pins = {};
      for (const p of el.pins || []) {
        pins[p.n] = { dir: p.d || 'in', clk: !!p.clk, async: !!p.async, w: p.w || 1 };
      }
      const t = el.timing || {};
      const L = {
        ref: el.ref || 'BLOCK', group: el.group || 'OTHERS', pins, seq: !!t.seq, clk: t.clk,
        launch: t.launch || {}, capture: t.capture || {}, async: t.async || {}, arcs: t.arcs || [], block: true,
      };
      return normLib(L);
    }
    // биты вывода элемента
    pinBits(el, pinName, forLoad) {
      const o = this.elemObjs.get(el.id);
      if (!o) return null;
      if (el.t === 'in' || el.t === 'out' || el.t === 'inout') {
        if (pinName === 'pad') return null;
        return o.ports.slice();
      }
      if (o.cells.length === 0) return [];
      const lib = o.cells[0].lib;
      if (lib.dyn) {
        if (forLoad) return { dyn: true, cells: o.cells };
        const pn = pinName || 'O';
        return o.cells.map((c) => c.pins.get(pn)).filter(Boolean);
      }
      if (!pinName) { this.err(XT.L(`элемент ${el.id}: не указан вывод`, `element ${el.id}: no pin specified`)); return []; }
      const out = [];
      for (const c of o.cells) {
        if (c.pins.has(pinName)) { out.push(c.pins.get(pinName)); continue; }
        const bus = [...c.pins.values()].filter((p) => p.base === pinName).sort((a, b) => busIdx(a.pname) - busIdx(b.pname));
        if (bus.length) { out.push(...bus); continue; }
        this.err(XT.L(`элемент ${el.id} (${c.ref}): нет вывода «${pinName}»`, `element ${el.id} (${c.ref}): no pin '${pinName}'`));
        return [];
      }
      return out;
    }
    // конец провода: «id.вывод»; id[i] или id[i:j] выбирает разряды многоразрядного элемента или порта
    parseEnd(s) {
      const k = s.indexOf('.');
      let id = k >= 0 ? s.slice(0, k) : s;
      const pin = k >= 0 ? s.slice(k + 1) : '';
      let sel = null;
      const m = /^(.*)\[(\d+)(?::(\d+))?\]$/.exec(id);
      if (m) { id = m[1]; const a = +m[2], b = m[3] !== undefined ? +m[3] : a; sel = [Math.min(a, b), Math.max(a, b)]; }
      return { id, pin, sel };
    }
    selBits(list, sel, el) {
      if (!sel || !list) return list;
      if (list.dyn) { this.err(XT.L(`элемент ${el.id}: выбор разрядов для логики не поддерживается`, `element ${el.id}: bit selection is not supported for logic`)); return null; }
      const lsb = el.lsb || 0, per = Math.max(1, list.length / (el.w || 1));
      const out = list.slice((sel[0] - lsb) * per, (sel[1] - lsb + 1) * per);
      if (!out.length) { this.err(XT.L(`элемент ${el.id}: нет разрядов [${sel[0]}:${sel[1]}]`, `element ${el.id}: no bits [${sel[0]}:${sel[1]}]`)); return null; }
      return out;
    }
    addWire(w) {
      if (w.ext) return;
      const from = this.parseEnd(w.from);
      const fel = this.elById.get(from.id);
      if (!fel) { this.err(XT.L(`провод: нет элемента «${from.id}»`, `wire: no element '${from.id}'`)); return; }
      if (fel.ext || DRAW_ONLY.has(fel.t)) return;
      const tos = Array.isArray(w.to) ? w.to : [w.to];
      const D = this.selBits(this.pinBits(fel, from.pin, false), from.sel, fel);
      if (!D) return;
      for (const t of tos) {
        const to = this.parseEnd(t);
        const tel = this.elById.get(to.id);
        if (!tel) { this.err(XT.L(`провод: нет элемента «${to.id}»`, `wire: no element '${to.id}'`)); continue; }
        if (tel.ext || DRAW_ONLY.has(tel.t)) continue;
        const L = this.selBits(this.pinBits(tel, to.pin, true), to.sel, tel);
        if (!L) continue;
        if (L.dyn) {
          const cells = L.cells;
          const bitwise = !tel.mix && D.length === cells.length;
          cells.forEach((c, i) => {
            const srcs = bitwise ? [D[i]] : D;
            for (const d of srcs) {
              const pn = 'I' + (c.dynIn++);
              const p = new Pin(c, pn, { dir: 'in' }, 'I');
              c.pins.set(pn, p); this.pins.set(p.name, p);
              this.connect(d, p, w, D.indexOf(d), D.length);
            }
          });
          continue;
        }
        if (D.length === L.length) D.forEach((d, i) => this.connect(d, L[i], w, i, D.length));
        else if (D.length === 1) L.forEach((l) => this.connect(D[0], l, w, 0, 1));
        else this.err(XT.L(`провод ${w.from} → ${t}: разная разрядность (${D.length} и ${L.length})`, `wire ${w.from} → ${t}: width mismatch (${D.length} and ${L.length})`));
      }
    }
    connect(drv, load, w, bit, width) {
      let net = drv.net;
      if (!net) {
        let nm;
        if (w.net) nm = width > 1 ? `${w.net}[${bit}]` : w.net;
        else if (drv.kind === 'port') nm = drv.name;
        else nm = `${drv.cell.name}_${drv.pname}`.replace(/\//g, '_');
        let base = nm, k = 1;
        while (this.nets.has(nm)) nm = `${base}_${k++}`;
        net = new Net(nm);
        this.nets.set(nm, net);
        net.members.push(drv);
        drv.net = net;
        net.driver = drv;
      }
      if (load.net && load.net !== net) { this.err(XT.L(`объект ${load.name} подключён к двум цепям (${load.net.name}, ${net.name})`, `object ${load.name} is connected to two nets (${load.net.name}, ${net.name})`)); return; }
      if (!load.net) { net.members.push(load); load.net = net; }
    }

    // ---------------- обход графа ----------------
    netPeers(o) { return o.net ? o.net.members.filter((m) => m !== o) : []; }
    arcsFrom(pin, disabled) {
      const c = pin.cell;
      const lib = c.lib;
      const res = [];
      if (lib.dyn) {
        if (pin.dir === 'in') for (const p of c.pins.values()) if (p.dir === 'out') res.push({ to: p, neg: false });
        return res;
      }
      for (const a of lib.arcsN) {
        if (a.from !== pin.base) continue;
        if (disabled && disabled.has(`${c.name}|${pin.pname}|${a.to}`)) continue;
        if (disabled && disabled.has(`${c.name}|*|*`)) continue;
        const toPins = [...c.pins.values()].filter((p) => p.base === a.to);
        for (const tp of toPins) {
          if (pin.pname !== pin.base && tp.pname !== tp.base && busIdx(pin.pname) !== busIdx(tp.pname)) continue;
          res.push({ to: tp, neg: a.neg });
        }
      }
      return res;
    }
    cellEdgesInv(cell) {
      const v = cell.attrs.IS_C_INVERTED;
      return v === 1 || v === '1' || v === true || v === "1'b1";
    }
    // тактовый вывод ячейки по имени базового вывода
    clockPin(cell, base) { return base ? cell.pins.get(base) : null; }
    allCells() { return [...this.cells.values(), ...this.hier.values()]; }
    get(kind, name) {
      if (kind === 'port') return this.ports.get(name);
      if (kind === 'cell') return this.cells.get(name) || this.hier.get(name);
      if (kind === 'pin') return this.pins.get(name);
      if (kind === 'net') return this.nets.get(name);
      return null;
    }
  }

  function busIdx(nm) { const m = /\[(\d+)\]$/.exec(nm); return m ? parseInt(m[1], 10) : -1; }
  function objKey(o) { return o.kind + ':' + o.name; }

  // ---------------------------------------------------------------------------
  // Свойства объектов (для -filter и get_property)
  // ---------------------------------------------------------------------------
  function boolStr(b) { return b ? 'TRUE' : 'FALSE'; }
  function getProp(o, name, session) {
    const N = name.toUpperCase();
    if (o.props && o.props.has(N)) return o.props.get(N).value;
    switch (o.kind) {
      case 'port':
        switch (N) {
          case 'NAME': case 'FULL_NAME': return o.name;
          case 'CLASS': case 'OBJECT_CLASS': return 'port';
          case 'DIRECTION': return o.dir === 'in' ? 'IN' : o.dir === 'out' ? 'OUT' : 'INOUT';
          case 'BUS_NAME': return o.bus || '';
          case 'IS_BUS': return boolStr(!!o.bus);
          case 'BUS_INDEX': return o.idx === null ? '' : String(o.idx);
        }
        break;
      case 'cell':
        switch (N) {
          case 'NAME': case 'FULL_NAME': return o.name;
          case 'CLASS': case 'OBJECT_CLASS': return 'cell';
          case 'REF_NAME': case 'ORIG_REF_NAME': return o.hier ? (o.name.split('/').pop()) : o.ref;
          case 'IS_SEQUENTIAL': return boolStr(!o.hier && !!o.lib.seq);
          case 'IS_PRIMITIVE': case 'IS_LEAF': return boolStr(!o.hier);
          case 'IS_HIERARCHICAL': return boolStr(o.hier);
          case 'PRIMITIVE_GROUP': return o.hier ? '' : (o.lib.group || 'OTHERS');
          case 'PRIMITIVE_SUBGROUP': return o.hier ? '' : (o.lib.sub || '');
          case 'PRIMITIVE_TYPE': return o.hier ? '' : (o.lib.ptype || '');
          case 'PARENT': return o.parent;
          case 'LOCAL_NAME': return o.local;
        }
        if (o.attrs && Object.prototype.hasOwnProperty.call(o.attrs, N)) return String(o.attrs[N]);
        break;
      case 'pin':
        switch (N) {
          case 'NAME': case 'FULL_NAME': return o.name;
          case 'CLASS': case 'OBJECT_CLASS': return 'pin';
          case 'REF_PIN_NAME': case 'LIB_PIN_NAME': return o.pname;
          case 'DIRECTION': return o.dir === 'in' ? 'IN' : o.dir === 'out' ? 'OUT' : 'INOUT';
          case 'IS_CLOCK': case 'IS_CLOCK_PIN': return boolStr(!!o.spec.clk);
          case 'IS_ENABLE': return boolStr(!!o.spec.en);
          case 'IS_RESET': return boolStr(!!o.spec.rst && !o.spec.async);
          case 'IS_CLEAR': return boolStr(o.base === 'CLR');
          case 'IS_PRESET': return boolStr(o.base === 'PRE');
          case 'IS_SETRESET': return boolStr(!!o.spec.rst);
          case 'IS_DATA_PIN': return boolStr(o.dir === 'in' && !o.spec.clk);
          case 'IS_LEAF': return 'TRUE';
          case 'PARENT_CELL': return o.cell.name;
          case 'BUS_NAME': return o.pname !== o.base ? o.base : '';
        }
        break;
      case 'net':
        switch (N) {
          case 'NAME': case 'FULL_NAME': return o.name;
          case 'CLASS': case 'OBJECT_CLASS': return 'net';
          case 'TYPE': return 'SIGNAL';
        }
        break;
      case 'clock':
        switch (N) {
          case 'NAME': case 'FULL_NAME': return o.name;
          case 'CLASS': case 'OBJECT_CLASS': return 'clock';
          case 'PERIOD': return U.fmt(o.period);
          case 'WAVEFORM': return U.fmt(o.rise) + ' ' + U.fmt(o.fall);
          case 'IS_GENERATED': return boolStr(o.type === 'generated' || o.type === 'auto');
          case 'IS_VIRTUAL': return boolStr(o.type === 'virtual');
          case 'IS_PROPAGATED': return boolStr(o.type !== 'virtual');
          case 'IS_USER_GENERATED': return boolStr(o.type === 'generated');
          case 'MASTER_CLOCK': return o.master || '';
          case 'SOURCE_PINS': case 'SOURCES': return (o.sources || []).map((s) => s.name).join(' ');
          case 'DIVIDE_BY': return o.divideBy ? String(o.divideBy) : '';
          case 'MULTIPLY_BY': return o.multiplyBy ? String(o.multiplyBy) : '';
          case 'INPUT_JITTER': return o.jitter !== undefined ? U.fmt(o.jitter) : '0.000';
        }
        break;
      case 'design':
        if (N === 'NAME') return o.name;
        break;
    }
    return undefined;
  }
  function propNames(o) {
    const base = {
      port: ['NAME', 'CLASS', 'DIRECTION', 'BUS_NAME', 'IS_BUS'],
      cell: ['NAME', 'CLASS', 'REF_NAME', 'IS_SEQUENTIAL', 'IS_PRIMITIVE', 'PRIMITIVE_GROUP', 'PRIMITIVE_SUBGROUP', 'PRIMITIVE_TYPE', 'PARENT'],
      pin: ['NAME', 'CLASS', 'REF_PIN_NAME', 'DIRECTION', 'IS_CLOCK', 'IS_ENABLE', 'IS_RESET', 'IS_CLEAR', 'IS_PRESET', 'PARENT_CELL'],
      net: ['NAME', 'CLASS', 'TYPE'],
      clock: ['NAME', 'CLASS', 'PERIOD', 'WAVEFORM', 'IS_GENERATED', 'IS_VIRTUAL', 'IS_PROPAGATED', 'MASTER_CLOCK', 'SOURCE_PINS', 'INPUT_JITTER'],
      design: ['NAME'],
    }[o.kind] || ['NAME'];
    const extra = o.props ? [...o.props.keys()] : [];
    const attrs = o.kind === 'cell' && o.attrs ? Object.keys(o.attrs) : [];
    return U.uniq([...base, ...attrs, ...extra]);
  }

  // ---------------------------------------------------------------------------
  // Фильтр-выражения -filter {NAME =~ *sync* && IS_SEQUENTIAL}
  // ---------------------------------------------------------------------------
  function compileFilter(src) {
    const s = src;
    let i = 0;
    const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
    const err = (m) => { throw new TclError(XT.L(`ошибка в выражении -filter «${src}»: ${m}`, `error in -filter expression '${src}': ${m}`)); };
    function parseOr() {
      let a = parseAnd();
      for (;;) { ws(); if (s.startsWith('||', i)) { i += 2; const b = parseAnd(); const x = a; a = (o) => x(o) || b(o); } else break; }
      return a;
    }
    function parseAnd() {
      let a = parseNot();
      for (;;) { ws(); if (s.startsWith('&&', i)) { i += 2; const b = parseNot(); const x = a; a = (o) => x(o) && b(o); } else break; }
      return a;
    }
    function parseNot() {
      ws();
      if (s[i] === '!' && s[i + 1] !== '=' && s[i + 1] !== '~') { i++; const a = parseNot(); return (o) => !a(o); }
      return parsePrimary();
    }
    function readValue() {
      ws();
      if (s[i] === '"') { const k = s.indexOf('"', i + 1); if (k < 0) err(XT.L('нет закрывающей кавычки', 'missing closing quote')); const v = s.slice(i + 1, k); i = k + 1; return v; }
      if (s[i] === '{') { const k = s.indexOf('}', i + 1); if (k < 0) err(XT.L('нет закрывающей }', 'missing closing }')); const v = s.slice(i + 1, k); i = k + 1; return v; }
      let v = '';
      while (i < s.length && !/\s/.test(s[i]) && s[i] !== ')' && !s.startsWith('&&', i) && !s.startsWith('||', i)) { v += s[i]; i++; }
      return v;
    }
    function parsePrimary() {
      ws();
      if (s[i] === '(') { i++; const a = parseOr(); ws(); if (s[i] !== ')') err(XT.L('нет закрывающей )', 'missing closing )')); i++; return a; }
      const m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(s.slice(i));
      if (!m) err(XT.L('ожидалось имя свойства', 'property name expected'));
      const prop = m[0];
      i += prop.length;
      ws();
      const opM = /^(==|!=|=~|!~|<=|>=|<|>)/.exec(s.slice(i));
      if (!opM) {
        return (o) => truthy(getProp(o, prop));
      }
      const op = opM[0];
      i += op.length;
      const val = readValue();
      return (o) => cmpProp(getProp(o, prop), op, val);
    }
    const fn = parseOr();
    ws();
    if (i < s.length) err(XT.L('лишние символы: «' + s.slice(i) + '»', "extra characters: '" + s.slice(i) + "'"));
    return fn;
  }
  function truthy(v) {
    if (v === undefined || v === null) return false;
    const s = String(v).trim().toLowerCase();
    return !(s === '' || s === '0' || s === 'false' || s === 'no' || s === 'off');
  }
  function isBoolStr(s) { return /^(true|false|1|0|yes|no)$/i.test(String(s).trim()); }
  function cmpProp(v, op, val) {
    if (v === undefined || v === null) v = '';
    v = String(v);
    if (op === '=~' || op === '!~') {
      const r = U.globToRe(val, { slash: true, nocase: true }).test(v);
      return op === '=~' ? r : !r;
    }
    if ((op === '==' || op === '!=') && isBoolStr(val) && isBoolStr(v || 'false')) {
      const r = truthy(v) === truthy(val);
      return op === '==' ? r : !r;
    }
    const a = parseFloat(v), b = parseFloat(val);
    if (!isNaN(a) && !isNaN(b) && /^\s*[-+]?[\d.]+(e[-+]?\d+)?\s*$/i.test(v) && /^\s*[-+]?[\d.]+(e[-+]?\d+)?\s*$/i.test(val)) {
      switch (op) { case '==': return a === b; case '!=': return a !== b; case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b; }
    }
    const x = v.toLowerCase(), y = String(val).toLowerCase();
    switch (op) { case '==': return x === y; case '!=': return x !== y; case '<': return x < y; case '>': return x > y; case '<=': return x <= y; case '>=': return x >= y; }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Сопоставление имён
  // ---------------------------------------------------------------------------
  function suffixes(name) {
    const out = [name];
    for (let k = name.indexOf('/'); k >= 0; k = name.indexOf('/', k + 1)) out.push(name.slice(k + 1));
    return out;
  }
  function nameMatcher(pat, opts) {
    if (opts.regexp) {
      let re;
      try { re = new RegExp('^(?:' + pat + ')$', opts.nocase ? 'i' : ''); } catch (e) { throw new TclError(XT.L(`некорректное регулярное выражение «${pat}»`, `invalid regular expression '${pat}'`)); }
      return (name) => re.test(name);
    }
    const re = U.globToRe(pat, { slash: false, nocase: opts.nocase });
    if (opts.hier) return (name) => suffixes(name).some((s) => re.test(s));
    return (name) => re.test(name);
  }

  XT.design = { LIB, ELEM_REF, DRAW_ONLY, Design, Port, Cell, Pin, Net, objKey, getProp, propNames, compileFilter, nameMatcher, busIdx, truthy };
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
