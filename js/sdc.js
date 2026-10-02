/* ConstraintLab – сессия и команды SDC/XDC (запросы объектов и ограничения) */
(function (XT) {
  'use strict';
  const U = XT.util;
  const L = XT.L;
  const T = XT.tcl;
  const DS = XT.design;
  const { Frac, Coll } = U;
  const TclError = T.TclError;
  const toStr = T.toStr;
  const objKey = DS.objKey;

  // ---------------------------------------------------------------------------
  // Известные свойства (для проверки опечаток)
  // ---------------------------------------------------------------------------
  const PROPS = {
    port: ['PACKAGE_PIN', 'IOSTANDARD', 'DRIVE', 'SLEW', 'PULLUP', 'PULLDOWN', 'PULLTYPE', 'KEEPER', 'DIFF_TERM', 'DIFF_TERM_ADV',
      'IN_TERM', 'OUT_TERM', 'ODT', 'IBUF_LOW_PWR', 'IOB', 'LOC', 'IODELAY_GROUP', 'DQS_BIAS', 'EQUALIZATION', 'OFFCHIP_TERM',
      'LVDS_PRE_EMPHASIS', 'DONT_TOUCH', 'MARK_DEBUG', 'IO_BUFFER_TYPE', 'CLOCK_BUFFER_TYPE', 'INTERFACE', 'POWER_ON_STATE', 'IN_TERM'],
    cell: ['ASYNC_REG', 'IOB', 'DONT_TOUCH', 'KEEP', 'KEEP_HIERARCHY', 'LOC', 'BEL', 'RLOC', 'SHREG_EXTRACT', 'MAX_FANOUT',
      'RAM_STYLE', 'ROM_STYLE', 'USE_DSP', 'FSM_ENCODING', 'IODELAY_GROUP', 'DIRECT_ENABLE', 'DIRECT_RESET', 'EXTRACT_ENABLE',
      'EXTRACT_RESET', 'LUTNM', 'HLUTNM', 'CLOCK_REGION', 'MARK_DEBUG', 'IS_C_INVERTED', 'BUFR_DIVIDE', 'BUFGCE_DIVIDE', 'DDR_CLK_EDGE', 'DONT_TOUCH'],
    net: ['CLOCK_DEDICATED_ROUTE', 'MARK_DEBUG', 'DONT_TOUCH', 'KEEP', 'MAX_FANOUT', 'IS_ROUTE_FIXED'],
    design: ['CFGBVS', 'CONFIG_VOLTAGE', 'CONFIG_MODE', 'POST_CRC', 'POST_CRC_ACTION', 'POST_CRC_SOURCE', 'POST_CRC_FREQ', 'SEVERITY'],
    pin: ['IS_INVERTED', 'CLOCK_DEDICATED_ROUTE'],
    clock: [],
  };
  const BITSTREAM = ['BITSTREAM.GENERAL.COMPRESS', 'BITSTREAM.CONFIG.CONFIGRATE', 'BITSTREAM.CONFIG.SPI_BUSWIDTH', 'BITSTREAM.CONFIG.SPI_FALL_EDGE',
    'BITSTREAM.CONFIG.SPI_32BIT_ADDR', 'BITSTREAM.CONFIG.UNUSEDPIN', 'BITSTREAM.STARTUP.STARTUPCLK', 'BITSTREAM.CONFIG.EXTMASTERCCLK_EN',
    'BITSTREAM.CONFIG.PERSIST', 'BITSTREAM.CONFIG.USERID', 'BITSTREAM.CONFIG.USR_ACCESS', 'BITSTREAM.ENCRYPTION.ENCRYPT', 'BITSTREAM.CONFIG.OVERTEMPPOWERDOWN',
    'BITSTREAM.GENERAL.CRC', 'BITSTREAM.CONFIG.CCLKPIN', 'BITSTREAM.CONFIG.DONEPIN', 'BITSTREAM.CONFIG.INITPIN', 'BITSTREAM.STARTUP.DONE_CYCLE'];
  const IOSTANDARDS = ['LVCMOS33', 'LVCMOS25', 'LVCMOS18', 'LVCMOS15', 'LVCMOS12', 'LVTTL', 'PCI33_3', 'LVDS', 'LVDS_25', 'BLVDS_25', 'MINI_LVDS_25',
    'RSDS_25', 'PPDS_25', 'TMDS_33', 'SUB_LVDS', 'SLVS_400_25', 'SLVS_400_18', 'LVPECL_25', 'SSTL15', 'SSTL15_R', 'SSTL135', 'SSTL135_R', 'SSTL18_I', 'SSTL18_II',
    'SSTL12', 'SSTL12_DCI', 'POD12', 'POD12_DCI', 'POD10', 'HSTL_I', 'HSTL_II', 'HSTL_I_18', 'HSTL_II_18', 'HSTL_I_DCI', 'HSUL_12', 'DIFF_SSTL15', 'DIFF_SSTL15_R',
    'DIFF_SSTL135', 'DIFF_SSTL135_R', 'DIFF_SSTL18_I', 'DIFF_SSTL12', 'DIFF_POD12', 'DIFF_POD12_DCI', 'DIFF_HSTL_I', 'DIFF_HSTL_II', 'DIFF_HSTL_I_18', 'DIFF_HSUL_12',
    'MIPI_DPHY_DCI', 'LVSTL_11', 'ANALOG'];

  const KIND_RU = { port: L('порт', 'port'), cell: L('ячейка', 'cell'), pin: L('вывод', 'pin'), net: L('цепь', 'net'), clock: L('тактовый сигнал', 'clock'), design: L('проект', 'design'), lib_cell: L('библиотечная ячейка', 'library cell') };
  const kindRu = (k) => KIND_RU[k] || k;

  // ---------------------------------------------------------------------------
  // Разбор опций
  // ---------------------------------------------------------------------------
  function isNumStr(s) { return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s.trim()); }
  function parseArgs(cmd, args, spec) {
    const opts = {};
    const pos = [];
    const flags = spec.flags || {};
    const names = Object.keys(flags);
    for (let k = 0; k < args.length; k++) {
      const a = args[k];
      const s = (typeof a === 'string') ? a : null;
      if (s !== null && s.length > 1 && s[0] === '-' && !isNumStr(s) && !/\s/.test(s)) {
        let name = s;
        if (!flags[name]) {
          const cands = names.filter((n) => n.startsWith(s));
          if (cands.length === 1) name = cands[0];
          else if (cands.length > 1) throw new TclError(L(`${cmd}: неоднозначная опция «${s}» (${cands.join(', ')})`, `${cmd}: ambiguous option '${s}' (${cands.join(', ')})`));
          else {
            const sg = U.suggest(s, names);
            throw new TclError(L(`${cmd}: неизвестная опция «${s}»`, `${cmd}: unknown option '${s}'`) + (sg ? L(` – может быть, «${sg}»?`, ` – did you mean '${sg}'?`) : '') + (spec.usage ? L(`\nСинтаксис: ${spec.usage}`, `\nSyntax: ${spec.usage}`) : ''));
          }
        }
        const kind = flags[name];
        if (kind === 'b') opts[name] = true;
        else {
          if (k + 1 >= args.length) throw new TclError(L(`${cmd}: после ${name} нужно значение`, `${cmd}: ${name} requires a value`));
          const v = args[++k];
          if (kind === 'm') (opts[name] = opts[name] || []).push(v);
          else opts[name] = v;
        }
      } else {
        if (s !== null && s.startsWith('#')) {
          throw new TclError(L(`${cmd}: лишний аргумент «${s}» – в Tcl «#» начинает комментарий только в начале команды; для комментария в конце строки пишите «;#»`, `${cmd}: extra argument '${s}' – in Tcl, '#' starts a comment only at the beginning of a command; for an end-of-line comment, write ';#'`));
        }
        pos.push(a);
      }
    }
    if (spec.maxPos !== undefined && pos.length > spec.maxPos) {
      throw new TclError(L(`${cmd}: лишние аргументы «${pos.slice(spec.maxPos).map(toStr).join(' ')}»`, `${cmd}: extra arguments '${pos.slice(spec.maxPos).map(toStr).join(' ')}'`) + (spec.usage ? L(`\nСинтаксис: ${spec.usage}`, `\nSyntax: ${spec.usage}`) : ''));
    }
    if (spec.minPos !== undefined && pos.length < spec.minPos) {
      throw new TclError(L(`${cmd}: не хватает аргументов`, `${cmd}: not enough arguments`) + (spec.usage ? L(`\nСинтаксис: ${spec.usage}`, `\nSyntax: ${spec.usage}`) : ''));
    }
    return { opts, pos };
  }
  function numArg(cmd, v, what) {
    const s = toStr(v).trim();
    const f = Frac.parse(s);
    if (!f) {
      let hint = '';
      if (/[-+*/]/.test(s.replace(/^[-+]/, ''))) hint = L(' – похоже на выражение: заключите его в [expr {…}]', ' – looks like an expression: enclose it in [expr {…}]');
      throw new TclError(L(`${cmd}: ${what} «${s}» не является числом${hint}`, `${cmd}: ${what} '${s}' is not a number${hint}`));
    }
    return f;
  }
  function intArg(cmd, v, what) {
    const f = numArg(cmd, v, what);
    if (!f.isInt()) throw new TclError(L(`${cmd}: ${what} должно быть целым (получено ${toStr(v)})`, `${cmd}: ${what} must be an integer (got ${toStr(v)})`));
    return Number(f.n);
  }
  function exclusive(cmd, opts, list) {
    const got = list.filter((o) => opts[o] !== undefined);
    if (got.length > 1) throw new TclError(L(`${cmd}: опции ${got.join(' и ')} взаимоисключающие`, `${cmd}: options ${got.join(' and ')} are mutually exclusive`));
    return got[0];
  }

  // ---------------------------------------------------------------------------
  // Сессия
  // ---------------------------------------------------------------------------
  class Session {
    constructor(design, opts) {
      opts = opts || {};
      this.design = design;
      this.tool = opts.tool || design.tool || 'vivado';
      this.I = new T.Interp({ xdcMode: this.tool === 'vivado' && opts.xdcMode !== false });
      this.I.session = this;
      this.db = {
        clocks: [], renames: [], groups: [], io: new Map(), exceptions: [], misc: [], props: [], cmds: [], seq: 0,
        uncertainty: [], latency: [], transition: [], jitter: [], sysJitter: null, propagated: new Set(),
        caseAnalysis: new Map(), disable: [], busSkew: [], units: {},
      };
      this.curInst = '';
      this.clkCache = null;
      this.groupCache = null;
      registerQueries(this);
      registerConstraints(this);
      if (XT.reports && XT.reports.register) XT.reports.register(this);
    }
    get messages() { return this.I.messages; }
    dirty() { this.clkCache = null; }
    clocks() {
      if (!this.clkCache) this.clkCache = XT.sta.computeClocks(this);
      return this.clkCache;
    }
    run(src, label) { return this.I.runScript(src || '', label); }
    warn(text) { return this.I.msg('warn', text); }
    crit(text) { return this.I.msg('crit', text); }
    info(text) { return this.I.msg('info', text); }
    rec(kind, extra) {
      const r = Object.assign({ kind, id: ++this.db.seq, line: this.I.curLine, src: this.I.src, text: this.I.curCmd ? this.I.curCmd.text : '' }, extra);
      this.db.cmds.push(r);
      return r;
    }
    clockObj(name) { return this.clocks().clocks.get(name); }

    // ---- разрешение объектов ----
    allOfKind(kind) {
      const D = this.design;
      if (kind === 'port') return [...D.ports.values()];
      if (kind === 'cell') return D.allCells();
      if (kind === 'pin') return [...D.pins.values()];
      if (kind === 'net') return [...D.nets.values()];
      if (kind === 'clock') return this.clocks().list.slice();
      return [];
    }
    findByName(kind, name) {
      if (kind === 'clock') return this.clocks().clocks.get(name) || null;
      return this.design.get(kind, name) || null;
    }
    // val → массив объектов допустимых видов
    resolve(cmd, val, kinds, what) {
      const out = [];
      const walk = (v) => {
        if (v && v.isColl) {
          for (const o of v.items) {
            if (kinds.includes(o.kind)) out.push(o);
            else this.crit(L(`${cmd}: объект «${o.name}» (${kindRu(o.kind)}) недопустим для ${what} (ожидается: ${kinds.map(kindRu).join(', ')})`, `${cmd}: object '${o.name}' (${kindRu(o.kind)}) is not valid for ${what} (expected: ${kinds.map(kindRu).join(', ')})`));
          }
          return;
        }
        if (v && v.isTList) { v.items.forEach(walk); return; }
        const items = U.parseList(toStr(v));
        for (const nm of items) {
          if (nm === '') continue;
          let found = [];
          for (const k of kinds) {
            if (U.hasWild(nm)) {
              const re = U.globToRe(nm, { slash: k === 'clock' });
              found = this.allOfKind(k).filter((o) => re.test(o.name));
            } else {
              const o = this.findByName(k, nm);
              found = o ? [o] : [];
            }
            if (found.length) {
              if (k !== 'clock' || !kinds.includes('clock') || kinds.length > 1) {
                if (!(kinds.length === 1 && kinds[0] === 'clock')) {
                  this.I.noteOnce(`implicit:${this.I.curLine}:${nm}`, 'info',
                    L(`${cmd}: имя «${nm}» задано строкой, объект (${kindRu(k)}) найден неявным поиском. Явный запрос [get_${k}s ${nm}] надёжнее и нагляднее.`,
                      `${cmd}: '${nm}' is given as a plain string; the object (${kindRu(k)}) was found by implicit lookup. An explicit query [get_${k}s ${nm}] is more reliable and clearer.`));
                }
              }
              break;
            }
          }
          if (!found.length) {
            this.crit(L(`${cmd}: объект «${nm}» не найден (${what})`, `${cmd}: object '${nm}' not found (${what})`));
          }
          out.push(...found);
        }
      };
      walk(val);
      return U.uniq(out);
    }
    resolveClocks(cmd, val, what) {
      const out = [];
      const walk = (v) => {
        if (v && v.isColl) {
          for (const o of v.items) {
            if (o.kind === 'clock') out.push(o.name);
            else throw new TclError(L(`${cmd}: ${what}: ожидается тактовый сигнал, а передан объект «${o.name}» (${kindRu(o.kind)}); используйте get_clocks`, `${cmd}: ${what}: a clock is expected, but object '${o.name}' (${kindRu(o.kind)}) was given; use get_clocks`));
          }
          return;
        }
        if (v && v.isTList) { v.items.forEach(walk); return; }
        for (const nm of U.parseList(toStr(v))) {
          if (!nm) continue;
          const C = this.clocks();
          if (U.hasWild(nm)) {
            const re = U.globToRe(nm, { slash: true });
            const m = C.list.filter((c) => re.test(c.name)).map((c) => c.name);
            if (!m.length) this.crit(L(`${cmd}: ни один тактовый сигнал не соответствует «${nm}»`, `${cmd}: no clocks matched '${nm}'`));
            out.push(...m);
          } else if (C.clocks.has(nm)) out.push(nm);
          else {
            const sg = U.suggest(nm, C.list.map((c) => c.name));
            throw new TclError(L(`${cmd}: тактовый сигнал «${nm}» не найден`, `${cmd}: clock '${nm}' not found`) + (sg ? L(` – может быть, «${sg}»?`, ` – did you mean '${sg}'?`) : '') +
              (C.list.length ? '' : L(' (тактовые сигналы ещё не созданы: в XDC важен порядок команд – сначала create_clock)', ' (no clocks have been created yet: command order matters in XDC, create_clock must come first)')));
          }
        }
      };
      walk(val);
      return U.uniq(out);
    }
  }

  // ---------------------------------------------------------------------------
  // Запросы объектов
  // ---------------------------------------------------------------------------
  const QFLAGS = { '-hierarchical': 'b', '-filter': 'v', '-regexp': 'b', '-nocase': 'b', '-quiet': 'b', '-of_objects': 'v', '-match_style': 'v', '-verbose': 'b', '-exact': 'b' };

  function ofObjects(S, kind, objs) {
    const D = S.design;
    const out = [];
    for (const o of objs) {
      if (kind === 'pin') {
        if (o.kind === 'cell') {
          if (o.hier) { for (const c of D.cells.values()) if (c.name.startsWith(o.name + '/')) out.push(...c.pins.values()); }
          else out.push(...o.pins.values());
        } else if (o.kind === 'net') out.push(...o.members.filter((m) => m.kind === 'pin'));
        else if (o.kind === 'port' && o.net) out.push(...o.net.members.filter((m) => m.kind === 'pin'));
        else if (o.kind === 'clock') {
          const C = S.clocks();
          for (const [k, m] of C.pin) if (m.has(o.name) && k.startsWith('pin:')) { const p = D.pins.get(k.slice(4)); if (p) out.push(p); }
        }
      } else if (kind === 'cell') {
        if (o.kind === 'pin') out.push(o.cell);
        else if (o.kind === 'net') out.push(...o.members.filter((m) => m.kind === 'pin').map((m) => m.cell));
        else if (o.kind === 'port' && o.net) out.push(...o.net.members.filter((m) => m.kind === 'pin').map((m) => m.cell));
        else if (o.kind === 'cell' && o.hier) { for (const c of D.allCells()) if (c.parent === o.name) out.push(c); }
      } else if (kind === 'net') {
        if ((o.kind === 'pin' || o.kind === 'port') && o.net) out.push(o.net);
        else if (o.kind === 'cell') for (const p of o.pins.values()) if (p.net) out.push(p.net);
      } else if (kind === 'port') {
        if (o.kind === 'net') out.push(...o.members.filter((m) => m.kind === 'port'));
        else if (o.kind === 'pin' && o.net) out.push(...o.net.members.filter((m) => m.kind === 'port'));
        else if (o.kind === 'cell') for (const p of o.pins.values()) if (p.net) out.push(...p.net.members.filter((m) => m.kind === 'port'));
      } else if (kind === 'clock') {
        const C = S.clocks();
        const add = (x) => { const m = C.pin.get(objKey(x)); if (m) for (const n of m.keys()) out.push(C.clocks.get(n)); };
        if (o.kind === 'pin' || o.kind === 'port') add(o);
        else if (o.kind === 'net') { if (o.driver) add(o.driver); }
        else if (o.kind === 'cell') {
          if (o.hier) { for (const c of D.cells.values()) if (c.name.startsWith(o.name + '/')) for (const p of c.pins.values()) if (p.spec.clk) add(p); }
          else for (const p of o.pins.values()) if (p.spec.clk || p.dir === 'out' || p.spec.clkin) add(p);
        }
      }
    }
    return U.uniq(out.filter(Boolean));
  }

  function doQuery(S, kind, cmd, args) {
    const flags = Object.assign({}, QFLAGS);
    if (kind === 'clock') { flags['-include_generated_clocks'] = 'b'; }
    const { opts, pos } = parseArgs(cmd, args, { flags, usage: `${cmd} [-hierarchical] [-filter <expr>] [-regexp] [-nocase] [-of_objects <obj>] [<patterns>]` });
    const D = S.design;
    let cands;
    const hier = !!opts['-hierarchical'];
    if (opts['-of_objects'] !== undefined) {
      const src = S.resolve(cmd, opts['-of_objects'], ['port', 'pin', 'cell', 'net', 'clock'], '-of_objects');
      cands = ofObjects(S, kind, src);
    } else if (kind === 'clock') {
      cands = S.clocks().list.slice();
    } else {
      cands = S.allOfKind(kind);
      if (S.curInst) {
        const pre = S.curInst + '/';
        cands = cands.filter((o) => o.kind === 'port' || o.name.startsWith(pre));
      }
    }
    const patterns = [];
    for (const p of pos) {
      if (p && p.isColl) { patterns.push(...p.items.map((o) => o.name)); continue; }
      if (p && p.isTList) { for (const x of p.items) patterns.push(...(x && x.isColl ? x.items.map((o) => o.name) : U.parseList(toStr(x)))); continue; }
      patterns.push(...U.parseList(toStr(p)));
    }
    let res;
    if (!patterns.length) {
      if (opts['-of_objects'] !== undefined || kind === 'clock' || kind === 'port' || hier) res = cands;
      else {
        const pre = S.curInst ? S.curInst + '/' : '';
        res = cands.filter((o) => !o.name.slice(pre.length).includes('/') || (kind === 'pin' && o.name.slice(pre.length).split('/').length === 2));
      }
    } else {
      res = [];
      const seen = new Set();
      for (let pat of patterns) {
        let pat2 = pat;
        if (S.curInst && kind !== 'port' && kind !== 'clock' && !hier && !opts['-regexp']) pat2 = S.curInst + '/' + pat;
        const match = DS.nameMatcher(pat2, { regexp: !!opts['-regexp'], nocase: !!opts['-nocase'], hier: hier && kind !== 'clock' && kind !== 'port' });
        let any = false;
        for (const o of cands) {
          const nm = o.name;
          let ok;
          if (kind === 'clock' && !opts['-regexp']) ok = U.globToRe(pat, { slash: true, nocase: !!opts['-nocase'] }).test(nm);
          else ok = match(nm);
          if (ok) { any = true; if (!seen.has(o)) { seen.add(o); res.push(o); } }
        }
        if (!any && !opts['-quiet']) noMatch(S, kind, cmd, pat, cands, hier);
      }
    }
    if (opts['-filter'] !== undefined) {
      const f = DS.compileFilter(toStr(opts['-filter']));
      res = res.filter((o) => f(o));
    }
    if (kind === 'clock' && opts['-include_generated_clocks']) {
      const C = S.clocks();
      const set = new Set(res.map((c) => c.name));
      let grew = true;
      while (grew) {
        grew = false;
        for (const c of C.list) if (c.master && set.has(c.master) && !set.has(c.name)) { set.add(c.name); grew = true; }
      }
      res = C.list.filter((c) => set.has(c.name));
    }
    return new Coll(kind, res);
  }
  function noMatch(S, kind, cmd, pat, cands, hier) {
    const names = cands.map((o) => o.name);
    let hint = '';
    if (kind === 'port') {
      const bus = cands.filter((p) => p.bus === pat);
      if (bus.length) hint = L(` Порт «${pat}» – шина из ${bus.length} бит: используйте {${pat}[*]}.`, ` Port '${pat}' is a ${bus.length}-bit bus: use {${pat}[*]}.`);
    }
    if (!hint && (kind === 'cell' || kind === 'pin' || kind === 'net') && !hier && !pat.includes('/')) {
      const re = U.globToRe(pat, { slash: false });
      if (cands.some((o) => o.name.split('/').some((seg, i, a) => re.test(a.slice(i).join('/'))))) hint = L(' Объект находится внутри иерархии: добавьте -hierarchical или полный путь.', ' The object is inside the hierarchy: add -hierarchical or use the full path.');
    }
    if (!hint) {
      const plain = pat.replace(/[*?]/g, '');
      const sg = plain ? U.suggest(pat, names) : null;
      if (sg) hint = L(` Может быть, «${sg}»?`, ` Did you mean '${sg}'?`);
    }
    const kindRu = { port: L('портов', 'ports'), cell: L('ячеек', 'cells'), pin: L('выводов', 'pins'), net: L('цепей', 'nets'), clock: L('тактовых сигналов', 'clocks') }[kind];
    S.warn(L(`${cmd}: не найдено ${kindRu}, соответствующих «${pat}».${hint}`, `${cmd}: no ${kindRu} matched '${pat}'.${hint}`));
  }

  function registerQueries(S) {
    const I = S.I;
    const R = (n, f) => I.register(n, f, { sdc: true, query: true });
    R('get_ports', (I, a) => doQuery(S, 'port', 'get_ports', a));
    R('get_cells', (I, a) => doQuery(S, 'cell', 'get_cells', a));
    R('get_pins', (I, a) => doQuery(S, 'pin', 'get_pins', a));
    R('get_nets', (I, a) => doQuery(S, 'net', 'get_nets', a));
    R('get_clocks', (I, a) => doQuery(S, 'clock', 'get_clocks', a));
    R('get_generated_clocks', (I, a) => {
      const c = doQuery(S, 'clock', 'get_generated_clocks', a);
      return new Coll('clock', c.items.filter((x) => x.type === 'generated' || x.type === 'auto'));
    });
    R('get_designs', () => new Coll('design', [S.design.designObj]));
    R('current_design', (I, a) => new Coll('design', [S.design.designObj]));
    R('current_instance', (I, a) => {
      const v = a.length ? toStr(a[0]) : '';
      if (!v || v === '.') { S.curInst = ''; return ''; }
      if (v === '..') { const k = S.curInst.lastIndexOf('/'); S.curInst = k >= 0 ? S.curInst.slice(0, k) : ''; return S.curInst; }
      const name = a[0] && a[0].isColl ? a[0].items[0].name : v;
      if (!S.design.hier.has(name)) throw new TclError(L(`current_instance: иерархическая ячейка «${name}» не найдена`, `current_instance: hierarchical cell '${name}' not found`));
      S.curInst = name;
      return name;
    });
    const dirPorts = (dir) => [...S.design.ports.values()].filter((p) => p.dir === dir || p.dir === 'inout');
    R('all_inputs', (I, a) => {
      const { opts } = parseArgs('all_inputs', a, { flags: { '-clock': 'v', '-edge_triggered': 'b', '-level_sensitive': 'b', '-no_clocks': 'b' }, maxPos: 0 });
      let ps = dirPorts('in');
      if (opts['-no_clocks']) { const C = S.clocks(); ps = ps.filter((p) => !C.list.some((c) => (c.sources || []).includes(p))); }
      return new Coll('port', ps);
    });
    R('all_outputs', (I, a) => { parseArgs('all_outputs', a, { flags: { '-clock': 'v', '-edge_triggered': 'b', '-level_sensitive': 'b' }, maxPos: 0 }); return new Coll('port', dirPorts('out')); });
    R('all_clocks', () => new Coll('clock', S.clocks().list.slice()));
    R('all_registers', (I, a) => {
      const { opts } = parseArgs('all_registers', a, {
        flags: { '-clock': 'v', '-rise_clock': 'v', '-fall_clock': 'v', '-cells': 'b', '-data_pins': 'b', '-clock_pins': 'b', '-output_pins': 'b',
          '-async_pins': 'b', '-edge_triggered': 'b', '-level_sensitive': 'b', '-no_hierarchy': 'b' }, maxPos: 0,
      });
      let cells = [...S.design.cells.values()].filter((c) => c.lib.seq);
      const clkOpt = opts['-clock'] || opts['-rise_clock'] || opts['-fall_clock'];
      if (clkOpt !== undefined) {
        const names = new Set(S.resolveClocks('all_registers', clkOpt, '-clock'));
        const C = S.clocks();
        cells = cells.filter((c) => { const cp = c.pins.get(c.lib.clk); const m = cp && C.pin.get(objKey(cp)); return m && [...m.keys()].some((n) => names.has(n)); });
      }
      if (opts['-level_sensitive']) cells = [];
      if (opts['-data_pins']) return new Coll('pin', cells.flatMap((c) => [...c.pins.values()].filter((p) => c.lib.captureN[p.base] && !c.lib.captureN[p.base].async)));
      if (opts['-async_pins']) return new Coll('pin', cells.flatMap((c) => [...c.pins.values()].filter((p) => c.lib.captureN[p.base] && c.lib.captureN[p.base].async)));
      if (opts['-clock_pins']) return new Coll('pin', cells.flatMap((c) => [...c.pins.values()].filter((p) => p.spec.clk)));
      if (opts['-output_pins']) return new Coll('pin', cells.flatMap((c) => [...c.pins.values()].filter((p) => c.lib.launchN[p.base])));
      return new Coll('cell', cells);
    });
    const fan = (dirOut) => (I, a) => {
      const nm = dirOut ? 'all_fanout' : 'all_fanin';
      const { opts } = parseArgs(nm, a, {
        flags: { '-from': 'v', '-to': 'v', '-flat': 'b', '-endpoints_only': 'b', '-startpoints_only': 'b', '-only_cells': 'b', '-levels': 'v', '-trace_arcs': 'v', '-quiet': 'b' }, maxPos: 0,
      });
      const srcV = dirOut ? opts['-from'] : opts['-to'];
      if (srcV === undefined) throw new TclError(L(`${nm}: нужна опция ${dirOut ? '-from' : '-to'}`, `${nm}: option ${dirOut ? '-from' : '-to'} is required`));
      const src = S.resolve(nm, srcV, ['port', 'pin', 'net'], dirOut ? '-from' : '-to');
      const res = XT.sta.fanTraverse(S, src, dirOut, { endpointsOnly: !!(opts['-endpoints_only'] || opts['-startpoints_only']) });
      if (opts['-only_cells']) return U.collOf(U.uniq(res.filter((o) => o.kind === 'pin').map((p) => p.cell)));
      return U.collOf(res);
    };
    R('all_fanout', fan(true));
    R('all_fanin', fan(false));
    R('remove_from_collection', (I, a) => {
      const { opts, pos } = parseArgs('remove_from_collection', a, { flags: { '-intersect': 'b' }, minPos: 2, maxPos: 2 });
      const A = S.resolve('remove_from_collection', pos[0], ['port', 'pin', 'cell', 'net', 'clock', 'design'], L('коллекция', 'collection'));
      const B = new Set(S.resolve('remove_from_collection', pos[1], ['port', 'pin', 'cell', 'net', 'clock', 'design'], L('коллекция', 'collection')));
      return U.collOf(A.filter((o) => opts['-intersect'] ? B.has(o) : !B.has(o)));
    });
    R('add_to_collection', (I, a) => {
      const { pos } = parseArgs('add_to_collection', a, { flags: { '-unique': 'b' }, minPos: 2, maxPos: 2 });
      const A = S.resolve('add_to_collection', pos[0], ['port', 'pin', 'cell', 'net', 'clock', 'design'], L('коллекция', 'collection'));
      const B = S.resolve('add_to_collection', pos[1], ['port', 'pin', 'cell', 'net', 'clock', 'design'], L('коллекция', 'collection'));
      return U.collOf(U.uniq(A.concat(B)));
    });
    R('sizeof_collection', (I, a) => {
      if (a.length !== 1) throw new TclError(L('sizeof_collection: нужен один аргумент', 'sizeof_collection: exactly one argument is required'));
      return String(a[0] && a[0].isColl ? a[0].items.length : U.parseList(toStr(a[0])).length);
    });
    R('get_object_name', (I, a) => {
      if (a.length !== 1) throw new TclError(L('get_object_name: нужен один аргумент', 'get_object_name: exactly one argument is required'));
      return a[0] && a[0].isColl ? U.formatList(a[0].items.map((o) => o.name)) : toStr(a[0]);
    });
    R('index_collection', (I, a) => {
      if (a.length !== 2 || !a[0].isColl) throw new TclError(L('index_collection: нужна коллекция и индекс', 'index_collection: a collection and an index are required'));
      const k = parseInt(toStr(a[1]), 10);
      return new Coll(a[0].type, a[0].items[k] ? [a[0].items[k]] : []);
    });
    const filterCmd = (nm) => (I, a) => {
      const { opts, pos } = parseArgs(nm, a, { flags: { '-regexp': 'b', '-nocase': 'b', '-quiet': 'b' }, minPos: 2, maxPos: 2 });
      const objs = S.resolve(nm, pos[0], ['port', 'pin', 'cell', 'net', 'clock'], L('коллекция', 'collection'));
      const f = DS.compileFilter(toStr(pos[1]));
      return U.collOf(objs.filter((o) => f(o)));
    };
    R('filter', filterCmd('filter'));
    R('filter_collection', filterCmd('filter_collection'));
    I.register('foreach_in_collection', (I, a) => {
      if (a.length !== 3) throw new TclError(L('foreach_in_collection: синтаксис foreach_in_collection var collection body', 'foreach_in_collection: syntax: foreach_in_collection var collection body'));
      const v = toStr(a[0]);
      const items = a[1] && a[1].isColl ? a[1].items : S.resolve('foreach_in_collection', a[1], ['port', 'pin', 'cell', 'net', 'clock'], L('коллекция', 'collection'));
      for (const o of items) {
        I.setVar(v, new Coll(o.kind, [o]));
        try { I.evalBody(a[2]); } catch (e) {
          if (e instanceof T.BreakSig) break;
          if (!(e instanceof T.ContinueSig)) throw e;
        }
      }
      return '';
    }, { notInXdc: true });
    R('get_lib_cells', (I, a) => {
      const pats = a.map(toStr).filter((s) => !s.startsWith('-'));
      const all = LIBCELLS.map((n) => ({ kind: 'lib_cell', name: 'stdlib/' + n, props: new Map() }));
      const res = all.filter((o) => pats.some((p) => U.globToRe(p, { slash: true }).test(o.name) || U.globToRe(p, { slash: true }).test(o.name.split('/')[1])));
      return new Coll('lib_cell', res);
    });
    R('get_libs', () => new Coll('lib', [{ kind: 'lib', name: 'stdlib', props: new Map() }]));
    R('get_property', (I, a) => {
      const { opts, pos } = parseArgs('get_property', a, { flags: { '-quiet': 'b', '-min': 'b', '-max': 'b' }, minPos: 2, maxPos: 2 });
      const prop = toStr(pos[0]);
      const objs = S.resolve('get_property', pos[1], ['port', 'pin', 'cell', 'net', 'clock', 'design'], L('объект', 'object'));
      const vals = objs.map((o) => DS.getProp(o, prop, S));
      if (vals.some((v) => v === undefined) && !opts['-quiet']) {
        const o = objs[vals.findIndex((v) => v === undefined)];
        throw new TclError(L(`get_property: у объекта «${o.name}» нет свойства «${prop}»`, `get_property: object '${o.name}' has no property '${prop}'`));
      }
      if ((opts['-min'] || opts['-max']) && vals.length) {
        const nums = vals.map(parseFloat).filter((x) => !isNaN(x));
        return String(opts['-min'] ? Math.min(...nums) : Math.max(...nums));
      }
      return vals.length === 1 ? (vals[0] === undefined ? '' : vals[0]) : U.formatList(vals.map((v) => v === undefined ? '' : v));
    });
    R('list_property', (I, a) => {
      const objs = S.resolve('list_property', a[a.length - 1], ['port', 'pin', 'cell', 'net', 'clock', 'design'], L('объект', 'object'));
      return objs.length ? U.formatList(DS.propNames(objs[0])) : '';
    });
    R('startgroup', () => '');
    R('endgroup', () => '');
    R('set_msg_config', () => '');
    R('set_param', () => '');
  }
  const LIBCELLS = ['BUFX1', 'BUFX2', 'BUFX4', 'BUFX8', 'BUFX16', 'INVX1', 'INVX2', 'INVX4', 'INVX8', 'DFFX1', 'DFFX2', 'DFFRX1', 'NAND2X1', 'NOR2X1', 'AND2X1', 'CKBUFX4', 'CKBUFX8', 'MUX2X1', 'ICGX1'];

  // ---------------------------------------------------------------------------
  // Команды ограничений
  // ---------------------------------------------------------------------------
  const EXC_FLAGS = {
    '-from': 'v', '-rise_from': 'v', '-fall_from': 'v', '-to': 'v', '-rise_to': 'v', '-fall_to': 'v',
    '-through': 'm', '-rise_through': 'm', '-fall_through': 'm', '-setup': 'b', '-hold': 'b', '-rise': 'b', '-fall': 'b',
    '-reset_path': 'b', '-comment': 'v', '-quiet': 'b', '-verbose': 'b',
  };

  function registerConstraints(S) {
    const I = S.I;
    const D = S.design;
    const R = (n, f) => I.register(n, f, { sdc: true });
    const vivado = () => S.tool === 'vivado';

    // ---------------- create_clock ----------------
    R('create_clock', (I, a) => {
      const usage = L('create_clock -period <нс> [-name <имя>] [-waveform {<фронт> <спад>}] [-add] [<объекты>]', 'create_clock -period <ns> [-name <name>] [-waveform {<rise> <fall>}] [-add] [<objects>]');
      const { opts, pos } = parseArgs('create_clock', a, { flags: { '-period': 'v', '-name': 'v', '-waveform': 'v', '-add': 'b', '-comment': 'v', '-quiet': 'b', '-verbose': 'b' }, usage });
      if (opts['-period'] === undefined) throw new TclError(L('create_clock: обязательна опция -period\nСинтаксис: ', 'create_clock: option -period is required\nSyntax: ') + usage);
      const period = numArg('create_clock', opts['-period'], L('период', 'period'));
      if (period.sign() <= 0) throw new TclError(L('create_clock: период должен быть положительным', 'create_clock: the period must be positive'));
      let rise = Frac.ZERO, fall = period.div(2);
      if (opts['-waveform'] !== undefined) {
        const wl = T.listItems(opts['-waveform']).map(toStr);
        if (wl.length < 2 || wl.length % 2) throw new TclError(L('create_clock: -waveform требует чётное число значений, например {0 5}', 'create_clock: -waveform requires an even number of values, for example {0 5}'));
        if (wl.length > 2) S.warn(L('create_clock: форму с несколькими импульсами за период ConstraintLab не моделирует, учтены первые два фронта', 'create_clock: ConstraintLab does not model waveforms with several pulses per period; only the first two edges are used'));
        rise = numArg('create_clock', wl[0], L('фронт -waveform', '-waveform rising edge'));
        fall = numArg('create_clock', wl[1], L('спад -waveform', '-waveform falling edge'));
        if (rise.sign() < 0) throw new TclError(L('create_clock: фронт в -waveform не может быть отрицательным', 'create_clock: the rising edge in -waveform cannot be negative'));
        if (!fall.gt(rise)) throw new TclError(L('create_clock: в -waveform спад должен быть позже фронта ({фронт спад})', 'create_clock: in -waveform the falling edge must come after the rising edge ({rise fall})'));
        if (!fall.sub(rise).lt(period)) throw new TclError(L('create_clock: длительность высокого уровня в -waveform должна быть меньше периода', 'create_clock: the high pulse width in -waveform must be less than the period'));
        if (rise.ge(period)) S.warn(L('create_clock: фронт -waveform больше периода – проверьте значения', 'create_clock: the -waveform rising edge is greater than the period – check the values'));
      }
      let sources = [];
      for (const p of pos) sources.push(...S.resolve('create_clock', p, ['port', 'pin', 'net'], L('источника тактового сигнала', 'clock source')));
      if (pos.length && !sources.length) {
        S.crit(L('create_clock: не найдено ни одного объекта-источника – тактовый сигнал НЕ создан', 'create_clock: no source objects found – the clock was NOT created'));
        return new Coll('clock', []);
      }
      sources = sources.map((o) => {
        if (o.kind === 'net') {
          S.warn(L(`create_clock: тактовый сигнал задан на цепи «${o.name}»; лучше указывать порт или вывод`, `create_clock: the clock is defined on net '${o.name}'; a port or a pin is preferable`));
          return o.driver || o;
        }
        return o;
      });
      let name = opts['-name'] !== undefined ? toStr(opts['-name']) : '';
      if (!name) {
        if (!sources.length) throw new TclError(L('create_clock: для виртуального тактового сигнала (без объектов) обязательно -name', 'create_clock: -name is required for a virtual clock (without objects)'));
        name = sources[0].name;
      }
      for (const s of sources) {
        if (s.kind === 'port' && s.dir === 'out') S.warn(L(`create_clock: «${s.name}» – выходной порт. Для тактового сигнала, который ПЛИС выдаёт на внешний вывод, используйте create_generated_clock`, `create_clock: '${s.name}' is an output port. For a clock that the FPGA forwards to an external pin, use create_generated_clock`));
        if (s.kind === 'port' && s.net) {
          const ib = s.net.members.find((m) => m.kind === 'pin' && m.base === 'IB' && /IBUF.*DS/.test(m.cell.ref));
          if (ib) S.warn(L(`create_clock: «${s.name}» – N-вывод дифференциального буфера ${ib.cell.name}. Тактовый сигнал описывают только на P-выводе: второй тактовый сигнал на N-выводе создаст ложные проверки между двумя тактовыми сигналами`, `create_clock: '${s.name}' is the N pin of differential buffer ${ib.cell.name}. Define the clock on the P pin only: a second clock on the N pin creates spurious timing checks between the two clocks`));
        }
        if (s.kind === 'pin') {
          if (s.cell.lib.pll && vivado()) S.warn(L(`create_clock на выходе ${s.cell.ref} (${s.name}): Vivado выводит тактовые сигналы MMCM/PLL автоматически. create_clock здесь заменит их новым первичным тактовым сигналом и разорвёт связь с входным тактовым сигналом. Для переименования используйте create_generated_clock -name <имя> [get_pins ${s.name}]`, `create_clock on the ${s.cell.ref} output (${s.name}): Vivado derives MMCM/PLL clocks automatically. create_clock here replaces them with a new primary clock and breaks the relationship with the input clock. To rename the clock, use create_generated_clock -name <name> [get_pins ${s.name}]`));
          else if (s.dir === 'out' && !s.cell.lib.pll) {
            const C = S.clocks();
            const up = C.pin.get(objKey(s));
            if (up && up.size) S.warn(L(`create_clock на внутреннем выводе «${s.name}»: сюда уже приходит тактовый сигнал ${[...up.keys()].join(', ')}. Новый первичный тактовый сигнал заменит его и потеряет связь с источником: задержка тактового дерева до этой точки не будет учтена`, `create_clock on internal pin '${s.name}': clock ${[...up.keys()].join(', ')} already arrives here. The new primary clock replaces it and loses the relationship with the source: the clock tree delay up to this point is not taken into account`));
          }
        }
      }
      const add = !!opts['-add'];
      // переопределения
      const prevSame = S.db.clocks.findIndex((c) => c.name === name);
      if (prevSame >= 0) {
        S.warn(L(`create_clock: тактовый сигнал «${name}» уже был определён (строка ${S.db.clocks[prevSame].line}) – определение перезаписано`, `create_clock: clock '${name}' was already defined (line ${S.db.clocks[prevSame].line}) – the definition is overwritten`));
        S.db.clocks.splice(prevSame, 1);
      }
      if (!add && sources.length) {
        for (let k = S.db.clocks.length - 1; k >= 0; k--) {
          const c = S.db.clocks[k];
          const tg = c.kind === 'create' ? c.sources : c.targets;
          if (tg.some((x) => sources.includes(x))) {
            S.warn(L(`create_clock: на объекте уже есть тактовый сигнал «${c.name}» – он заменён. Чтобы иметь несколько тактовых сигналов на одном объекте, используйте -add`, `create_clock: the object already has clock '${c.name}' – it is replaced. To have several clocks on one object, use -add`));
            S.db.clocks.splice(k, 1);
          }
        }
      }
      const rec = S.rec('create_clock', { name, period, rise, fall, sources, add, virtual: !sources.length });
      rec.ckind = 'create';
      S.db.clocks.push(Object.assign(rec, { kind: 'create' }));
      S.dirty();
      const c = S.clockObj(name);
      return new Coll('clock', c ? [c] : []);
    });

    // ---------------- create_generated_clock ----------------
    R('create_generated_clock', (I, a) => {
      const usage = L('create_generated_clock [-name <имя>] -source <вывод> [-master_clock <тактовый сигнал>] [-divide_by N | -multiply_by N | -edges {…} [-edge_shift {…}]] [-duty_cycle %] [-invert] [-combinational] [-add] <объекты>', 'create_generated_clock [-name <name>] -source <pin> [-master_clock <clock>] [-divide_by N | -multiply_by N | -edges {…} [-edge_shift {…}]] [-duty_cycle %] [-invert] [-combinational] [-add] <objects>');
      const { opts, pos } = parseArgs('create_generated_clock', a, {
        flags: { '-name': 'v', '-source': 'v', '-master_clock': 'v', '-divide_by': 'v', '-multiply_by': 'v', '-edges': 'v', '-edge_shift': 'v',
          '-duty_cycle': 'v', '-invert': 'b', '-combinational': 'b', '-add': 'b', '-comment': 'v', '-quiet': 'b', '-verbose': 'b' }, usage,
      });
      let targets = [];
      for (const p of pos) targets.push(...S.resolve('create_generated_clock', p, ['port', 'pin', 'net'], L('точки определения', 'clock definition point')));
      targets = targets.map((o) => (o.kind === 'net' ? (o.driver || o) : o));
      if (!targets.length) { S.crit(L('create_generated_clock: не найдено объектов, на которых создаётся тактовый сигнал – тактовый сигнал НЕ создан', 'create_generated_clock: no objects found to create the clock on – the clock was NOT created')); return new Coll('clock', []); }
      const hasMod = ['-divide_by', '-multiply_by', '-edges', '-combinational', '-invert', '-duty_cycle', '-edge_shift', '-master_clock'].some((o) => opts[o] !== undefined);
      // Переименование автоматически выведенного тактового сигнала (Vivado)
      if (opts['-source'] === undefined) {
        if (vivado() && !hasMod && opts['-name'] !== undefined) {
          const C = S.clocks();
          const t = targets[0];
          const at = C.pin.get(objKey(t));
          const auto = at ? [...at.keys()].map((n) => C.clocks.get(n)).find((c) => c && c.type === 'auto' && (c.sources || []).includes(t)) : null;
          if (!auto) throw new TclError(L(`create_generated_clock: без -source можно лишь переименовать автоматически выведенный тактовый сигнал, но на «${t.name}» такого тактового сигнала нет`, `create_generated_clock: without -source you can only rename an automatically derived clock, but there is no such clock on '${t.name}'`));
          const newName = toStr(opts['-name']);
          S.db.renames = S.db.renames.filter((r) => r.key !== objKey(t));
          S.db.renames.push(S.rec('rename', { key: objKey(t), obj: t, name: newName, oldName: auto.name }));
          S.dirty();
          S.info(L(`Автоматически выведенный тактовый сигнал «${auto.name}» переименован в «${newName}»`, `Automatically derived clock '${auto.name}' renamed to '${newName}'`));
          return new Coll('clock', [S.clockObj(newName)].filter(Boolean));
        }
        throw new TclError(L('create_generated_clock: обязательна опция -source (вывод, на котором присутствует исходный тактовый сигнал)\nСинтаксис: ', 'create_generated_clock: option -source is required (the pin where the master clock is present)\nSyntax: ') + usage);
      }
      const srcObjs = S.resolve('create_generated_clock', opts['-source'], ['port', 'pin', 'net'], '-source').map((o) => (o.kind === 'net' ? (o.driver || o) : o));
      if (srcObjs.length !== 1) throw new TclError(L(`create_generated_clock: -source должен указывать ровно на один вывод или порт (найдено: ${srcObjs.length})`, `create_generated_clock: -source must specify exactly one pin or port (found: ${srcObjs.length})`));
      const source = srcObjs[0];
      const mod = exclusive('create_generated_clock', opts, ['-edges', '-divide_by']);
      exclusive('create_generated_clock', opts, ['-edges', '-multiply_by']);
      exclusive('create_generated_clock', opts, ['-edges', '-combinational']);
      if (opts['-divide_by'] === undefined && opts['-multiply_by'] === undefined && opts['-edges'] === undefined && !opts['-combinational']) {
        throw new TclError(L('create_generated_clock: укажите способ получения тактового сигнала: -divide_by, -multiply_by, -edges или -combinational (для копии без деления: -divide_by 1)', 'create_generated_clock: specify how the clock is derived: -divide_by, -multiply_by, -edges or -combinational (for an undivided copy: -divide_by 1)'));
      }
      const g = { divideBy: 1, multiplyBy: 1 };
      if (opts['-divide_by'] !== undefined) { g.divideBy = intArg('create_generated_clock', opts['-divide_by'], '-divide_by'); if (g.divideBy < 1) throw new TclError(L('create_generated_clock: -divide_by должно быть ≥ 1', 'create_generated_clock: -divide_by must be ≥ 1')); }
      if (opts['-multiply_by'] !== undefined) { g.multiplyBy = intArg('create_generated_clock', opts['-multiply_by'], '-multiply_by'); if (g.multiplyBy < 1) throw new TclError(L('create_generated_clock: -multiply_by должно быть ≥ 1', 'create_generated_clock: -multiply_by must be ≥ 1')); }
      if (opts['-edges'] !== undefined) {
        const e = T.listItems(opts['-edges']).map(toStr).map((x) => intArg('create_generated_clock', x, L('номер фронта в -edges', 'edge number in -edges')));
        if (e.length !== 3) throw new TclError(L('create_generated_clock: -edges требует ровно три номера фронтов исходного тактового сигнала, например {1 3 5}', 'create_generated_clock: -edges requires exactly three master clock edge numbers, for example {1 3 5}'));
        if (!(e[0] >= 1 && e[1] > e[0] && e[2] > e[1])) throw new TclError(L('create_generated_clock: номера в -edges должны возрастать и начинаться с 1 и более', 'create_generated_clock: the -edges numbers must be increasing and start from 1 or greater'));
        g.edges = e;
        if (opts['-edge_shift'] !== undefined) {
          const sh = T.listItems(opts['-edge_shift']).map(toStr).map((x) => numArg('create_generated_clock', x, L('сдвиг в -edge_shift', '-edge_shift value')));
          if (sh.length !== 3) throw new TclError(L('create_generated_clock: -edge_shift требует три значения', 'create_generated_clock: -edge_shift requires three values'));
          g.edgeShift = sh;
        }
      } else if (opts['-edge_shift'] !== undefined) throw new TclError(L('create_generated_clock: -edge_shift используется только вместе с -edges', 'create_generated_clock: -edge_shift is used only together with -edges'));
      if (opts['-duty_cycle'] !== undefined) {
        g.duty = numArg('create_generated_clock', opts['-duty_cycle'], '-duty_cycle');
        if (!(g.duty.sign() > 0 && g.duty.lt(100))) throw new TclError(L('create_generated_clock: -duty_cycle задаётся в процентах (0 … 100)', 'create_generated_clock: -duty_cycle is specified in percent (0 … 100)'));
      }
      g.invert = !!opts['-invert'];
      g.combinational = !!opts['-combinational'];
      // исходный тактовый сигнал
      const C = S.clocks();
      const at = C.pin.get(objKey(source));
      let master;
      if (opts['-master_clock'] !== undefined) {
        const ms = S.resolveClocks('create_generated_clock', opts['-master_clock'], '-master_clock');
        if (ms.length !== 1) throw new TclError(L('create_generated_clock: -master_clock должен указывать ровно один тактовый сигнал', 'create_generated_clock: -master_clock must specify exactly one clock'));
        master = ms[0];
        if (!at || !at.has(master)) throw new TclError(L(`create_generated_clock: исходный тактовый сигнал «${master}» не достигает вывода-источника «${source.name}»`, `create_generated_clock: master clock '${master}' does not reach source pin '${source.name}'`));
      } else {
        if (!at || !at.size) {
          throw new TclError(L(`create_generated_clock: на выводе-источнике «${source.name}» нет ни одного тактового сигнала. ` +
            'Сначала создайте исходный тактовый сигнал (create_clock) и убедитесь, что -source указывает на точку, куда он распространяется (обычно тактовый вывод регистра или вход буфера)',
            `create_generated_clock: there is no clock on source pin '${source.name}'. ` +
            'Create the master clock first (create_clock) and make sure that -source points to where it propagates (usually a register clock pin or a buffer input)'));
        }
        const ms = [...at.keys()];
        if (ms.length > 1) S.crit(L(`create_generated_clock: на «${source.name}» несколько тактовых сигналов (${ms.join(', ')}); выбран «${ms[0]}». Укажите -master_clock явно (и -add для нескольких производных тактовых сигналов)`, `create_generated_clock: '${source.name}' has several clocks (${ms.join(', ')}); '${ms[0]}' is selected. Specify -master_clock explicitly (and -add for several generated clocks)`));
        master = ms[0];
      }
      const name = opts['-name'] !== undefined ? toStr(opts['-name']) : targets[0].name;
      const prevSame = S.db.clocks.findIndex((c) => c.name === name);
      if (prevSame >= 0) {
        S.warn(L(`create_generated_clock: тактовый сигнал «${name}» уже был определён (строка ${S.db.clocks[prevSame].line}) – определение перезаписано`, `create_generated_clock: clock '${name}' was already defined (line ${S.db.clocks[prevSame].line}) – the definition is overwritten`));
        S.db.clocks.splice(prevSame, 1);
      }
      if (!opts['-add']) {
        for (let k = S.db.clocks.length - 1; k >= 0; k--) {
          const c = S.db.clocks[k];
          const tg = c.kind === 'create' ? c.sources : c.targets;
          if (tg.some((x) => targets.includes(x))) {
            S.warn(L(`create_generated_clock: на объекте уже есть тактовый сигнал «${c.name}» – он заменён (для нескольких тактовых сигналов в одной точке используйте -add и -master_clock)`, `create_generated_clock: the object already has clock '${c.name}' – it is replaced (for several clocks at one point, use -add and -master_clock)`));
            S.db.clocks.splice(k, 1);
          }
        }
      }
      for (const t of targets) {
        if (t.kind === 'pin' && t.cell.lib.pll && vivado()) S.info(L(`create_generated_clock на выходе ${t.cell.ref}: Vivado и так выводит этот тактовый сигнал автоматически; ваше определение заменит автоматически выведенный тактовый сигнал (убедитесь, что параметры совпадают с настройками MMCM)`, `create_generated_clock on the ${t.cell.ref} output: Vivado already derives this clock automatically; your definition replaces the automatically derived clock (make sure the parameters match the MMCM settings)`));
      }
      const rec = S.rec('create_generated_clock', Object.assign(g, { name, source, master, targets, add: !!opts['-add'] }));
      S.db.clocks.push(Object.assign(rec, { kind: 'generated' }));
      S.dirty();
      const c = S.clockObj(name);
      if (!c) S.crit(L(`create_generated_clock: тактовый сигнал «${name}» не удалось построить`, `create_generated_clock: clock '${name}' could not be built`));
      return new Coll('clock', c ? [c] : []);
    });

    // ---------------- set_clock_groups ----------------
    R('set_clock_groups', (I, a) => {
      const usage = L('set_clock_groups [-name <имя>] -asynchronous|-logically_exclusive|-physically_exclusive -group <тактовые сигналы> [-group <тактовые сигналы> …]', 'set_clock_groups [-name <name>] -asynchronous|-logically_exclusive|-physically_exclusive -group <clocks> [-group <clocks> …]');
      const { opts } = parseArgs('set_clock_groups', a, {
        flags: { '-name': 'v', '-asynchronous': 'b', '-logically_exclusive': 'b', '-physically_exclusive': 'b', '-group': 'm', '-allow_paths': 'b', '-comment': 'v', '-quiet': 'b', '-verbose': 'b' }, usage, maxPos: 0,
      });
      const type = exclusive('set_clock_groups', opts, ['-asynchronous', '-logically_exclusive', '-physically_exclusive']);
      if (!type) throw new TclError(L('set_clock_groups: укажите тип: -asynchronous, -logically_exclusive или -physically_exclusive\nСинтаксис: ', 'set_clock_groups: specify the type: -asynchronous, -logically_exclusive or -physically_exclusive\nSyntax: ') + usage);
      const gs = (opts['-group'] || []).map((g) => S.resolveClocks('set_clock_groups', g, '-group'));
      if (!gs.length) throw new TclError(L('set_clock_groups: нужна хотя бы одна опция -group', 'set_clock_groups: at least one -group option is required'));
      gs.forEach((g, k) => { if (!g.length) throw new TclError(L(`set_clock_groups: группа №${k + 1} пуста`, `set_clock_groups: group #${k + 1} is empty`)); });
      const all = gs.flat();
      if (new Set(all).size !== all.length) S.warn(L('set_clock_groups: один и тот же тактовый сигнал указан в нескольких группах', 'set_clock_groups: the same clock is listed in several groups'));
      if (gs.length === 1) S.info(L('set_clock_groups с одной группой: тактовые сигналы группы считаются несвязанными со ВСЕМИ остальными тактовыми сигналами проекта', 'set_clock_groups with a single group: the clocks of the group are treated as unrelated to ALL other clocks in the design'));
      const t = type.slice(1);
      S.db.groups.push(S.rec('set_clock_groups', { type: t, groups: gs, name: opts['-name'] ? toStr(opts['-name']) : '' }));
      return '';
    });

    // ---------------- set_input_delay / set_output_delay ----------------
    const ioDelay = (kind) => (I, a) => {
      const cmd = kind === 'in' ? 'set_input_delay' : 'set_output_delay';
      const usage = L(`${cmd} [-clock <тактовый сигнал>] [-clock_fall] [-max|-min] [-add_delay] <задержка> <порты>`, `${cmd} [-clock <clock>] [-clock_fall] [-max|-min] [-add_delay] <delay> <ports>`);
      const { opts, pos } = parseArgs(cmd, a, {
        flags: { '-clock': 'v', '-clock_fall': 'b', '-rise': 'b', '-fall': 'b', '-max': 'b', '-min': 'b', '-add_delay': 'b', '-network_latency_included': 'b',
          '-source_latency_included': 'b', '-level_sensitive': 'b', '-reference_pin': 'v', '-quiet': 'b', '-verbose': 'b' }, usage, minPos: 2, maxPos: 2,
      });
      const value = numArg(cmd, pos[0], L('значение задержки', 'delay value'));
      let clock = null;
      if (opts['-clock'] !== undefined) {
        const cs = S.resolveClocks(cmd, opts['-clock'], '-clock');
        if (cs.length !== 1) throw new TclError(L(`${cmd}: -clock должен указывать ровно на один тактовый сигнал`, `${cmd}: -clock must specify exactly one clock`));
        clock = cs[0];
      } else {
        S.crit(L(`${cmd}: не указан -clock – задержка не привязана к тактовому сигналу, путь останется неограниченным по времени`, `${cmd}: -clock is not specified – the delay is not related to any clock, so the path remains unconstrained`));
      }
      if (opts['-clock_fall'] && !clock) throw new TclError(L(`${cmd}: -clock_fall без -clock не имеет смысла`, `${cmd}: -clock_fall has no meaning without -clock`));
      if (opts['-reference_pin'] !== undefined) S.info(L(`${cmd}: -reference_pin ConstraintLab учитывает как обычную задержку относительно тактового сигнала`, `${cmd}: ConstraintLab treats -reference_pin as a regular delay relative to the clock`));
      if (opts['-level_sensitive']) S.warn(L(`${cmd}: -level_sensitive (защёлки) ConstraintLab не моделирует`, `${cmd}: ConstraintLab does not model -level_sensitive (latches)`));
      const ports = S.resolve(cmd, pos[1], ['port', 'pin'], L('портов', 'ports'));
      if (!ports.length) { S.crit(L(`${cmd}: не найдено ни одного порта – ограничение проигнорировано`, `${cmd}: no ports found – the constraint is ignored`)); return ''; }
      const which = opts['-max'] && !opts['-min'] ? ['max'] : opts['-min'] && !opts['-max'] ? ['min'] : ['max', 'min'];
      const fall = !!opts['-clock_fall'];
      const add = !!opts['-add_delay'];
      const C = S.clocks();
      for (const p of ports) {
        if (p.kind === 'pin') { S.warn(L(`${cmd}: задержка на внутреннем выводе «${p.name}» – ConstraintLab анализирует задержки только на портах`, `${cmd}: delay on internal pin '${p.name}' – ConstraintLab analyzes delays only on ports`)); continue; }
        if (kind === 'in' && p.dir === 'out') { S.crit(L(`${cmd}: «${p.name}» – выходной порт; для него нужен set_output_delay`, `${cmd}: '${p.name}' is an output port; it needs set_output_delay`)); continue; }
        if (kind === 'out' && p.dir === 'in') { S.crit(L(`${cmd}: «${p.name}» – входной порт; для него нужен set_input_delay`, `${cmd}: '${p.name}' is an input port; it needs set_input_delay`)); continue; }
        if (kind === 'in' && C.list.some((c) => c.type === 'primary' && (c.sources || []).includes(p))) {
          S.warn(L(`${cmd}: «${p.name}» – источник тактового сигнала; задержка на тактовом порту не влияет на анализ данных`, `${cmd}: '${p.name}' is a clock source; a delay on a clock port does not affect data path analysis`));
        }
        let io = S.db.io.get(p.name);
        if (!io) { io = { in: [], out: [], log: [] }; S.db.io.set(p.name, io); }
        const list = io[kind];
        if (!add) {
          for (const t of which) {
            for (const e of list) {
              if (e[t] !== null && e[t] !== undefined) {
                if (!(e.clock === clock && e.fall === fall)) {
                  io.log.push({ line: I.curLine, overwrote: { clock: e.clock, fall: e.fall, type: t, line: e[t + 'Line'] } });
                }
                e[t] = null;
              }
            }
          }
          for (let k = list.length - 1; k >= 0; k--) if (list[k].max === null && list[k].min === null) list.splice(k, 1);
        }
        let e = list.find((x) => x.clock === clock && x.fall === fall);
        if (!e) { e = { clock, fall, max: null, min: null }; list.push(e); }
        for (const t of which) { e[t] = value; e[t + 'Line'] = I.curLine; e[t + 'Src'] = I.src; }
      }
      S.rec(cmd, { io: kind, clock, fall, value, which, add, ports: ports.map((p) => p.name) });
      return '';
    };
    R('set_input_delay', ioDelay('in'));
    R('set_output_delay', ioDelay('out'));

    // ---------------- исключения ----------------
    function endSpec(cmd, opts, base, isFrom) {
      const keys = ['-' + base, '-rise_' + base, '-fall_' + base];
      const k = exclusive(cmd, opts, keys);
      if (!k) return null;
      const edge = k.startsWith('-rise') ? 'rise' : k.startsWith('-fall') ? 'fall' : null;
      const objs = S.resolve(cmd, opts[k], ['clock', 'port', 'pin', 'cell'], k);
      const spec = { clocks: new Set(), objs: new Set(), edge, opt: k, names: [] };
      const bad = { port: [], comb: [], q: [], qclk: '', clkpin: [], other: [] };
      for (const o of objs) {
        if (o.kind === 'clock') { spec.clocks.add(o.name); spec.names.push(o.name); continue; }
        if (o.kind === 'port') {
          const ok = isFrom ? (o.dir === 'in' || o.dir === 'inout') : (o.dir === 'out' || o.dir === 'inout');
          if (!ok) { bad.port.push(o.name); continue; }
          spec.objs.add(objKey(o)); spec.names.push(o.name); continue;
        }
        if (o.kind === 'cell') {
          let cells = [o];
          if (o.hier) {
            cells = [...D.cells.values()].filter((c) => c.name.startsWith(o.name + '/') && (c.lib.seq || Object.keys(c.lib.captureN).length));
            S.info(L(`${cmd}: иерархическая ячейка «${o.name}» раскрыта в ${cells.length} ${U.plural(cells.length, 'регистр', 'регистра', 'регистров')}`, `${cmd}: hierarchical cell '${o.name}' expanded into ${cells.length} ${cells.length === 1 ? 'register' : 'registers'}`));
          }
          for (const c of cells) {
            const valid = isFrom ? Object.keys(c.lib.launchN).length > 0 : Object.keys(c.lib.captureN).length > 0;
            if (!valid) { bad.comb.push(`${c.name} (${c.ref})`); continue; }
            spec.objs.add(objKey(c)); spec.names.push(c.name);
          }
          continue;
        }
        if (o.kind === 'pin') {
          const lib = o.cell.lib;
          if (isFrom) {
            const isClkOfLauncher = o.spec.clk && Object.values(lib.launchN).some((l) => l.clk === o.base);
            if (isClkOfLauncher) { spec.objs.add(objKey(o)); spec.names.push(o.name); continue; }
            if (lib.launchN[o.base]) { bad.q.push(o.name); bad.qclk = lib.launchN[o.base].clk; continue; }
            bad.other.push(o.name);
            continue;
          }
          if (lib.captureN[o.base]) { spec.objs.add(objKey(o)); spec.names.push(o.name); continue; }
          if (o.spec.clk) { bad.clkpin.push(o.name); continue; }
          bad.other.push(o.name);
        }
      }
      const cn = (a) => U.compressNames(a, 5);
      const role = L(isFrom ? 'начальной' : 'конечной', isFrom ? 'startpoints' : 'endpoints');
      if (bad.port.length) S.warn(L(`${cmd}: ${cn(bad.port)} – ${isFrom ? 'выходные' : 'входные'} порты, они не могут быть ${role} точкой; проигнорированы`, `${cmd}: ${cn(bad.port)} – ${isFrom ? 'output' : 'input'} ports, which cannot be ${role}; ignored`));
      if (bad.comb.length) S.warn(L(`${cmd}: ${cn(bad.comb)} – не последовательные ячейки, они не могут быть ${role} точкой; проигнорированы. Для комбинационных ячеек используйте -through`, `${cmd}: ${cn(bad.comb)} – not sequential cells, which cannot be ${role}; ignored. For combinational cells, use -through`));
      if (bad.q.length) S.warn(L(`${cmd}: ${cn(bad.q)} – выходы регистров, а не начальные точки. Начальная точка пути – тактовый вывод (${bad.qclk}) или сама ячейка (get_cells); выводы проигнорированы`, `${cmd}: ${cn(bad.q)} – register outputs, not startpoints. A path startpoint is the clock pin (${bad.qclk}) or the cell itself (get_cells); the pins are ignored`));
      if (bad.clkpin.length) S.warn(L(`${cmd}: ${cn(bad.clkpin)} – тактовые выводы, они не могут быть конечной точкой. Укажите выводы данных (D) или ячейки целиком; выводы проигнорированы`, `${cmd}: ${cn(bad.clkpin)} – clock pins, which cannot be endpoints. Specify data pins (D) or whole cells; the pins are ignored`));
      if (bad.other.length) S.warn(L(`${cmd}: ${cn(bad.other)} – не ${isFrom ? 'начальные' : 'конечные'} точки (для промежуточных точек есть -through); проигнорированы`, `${cmd}: ${cn(bad.other)} – not ${role} (use -through for intermediate points); ignored`));
      if (!spec.clocks.size && !spec.objs.size) spec.empty = true;
      return spec;
    }
    function throughSpecs(cmd, opts) {
      const out = [];
      for (const k of ['-through', '-rise_through', '-fall_through']) {
        for (const v of opts[k] || []) {
          const objs = S.resolve(cmd, v, ['pin', 'net', 'cell', 'port'], k);
          const set = new Set(objs.map(objKey));
          out.push({ objs: set, names: objs.map((o) => o.name), empty: !objs.length });
        }
      }
      return out;
    }
    function excCommon(cmd, opts) {
      const from = endSpec(cmd, opts, 'from', true);
      const to = endSpec(cmd, opts, 'to', false);
      const through = throughSpecs(cmd, opts);
      if (!from && !to && !through.length) throw new TclError(L(`${cmd}: нужна хотя бы одна из опций -from, -to или -through`, `${cmd}: at least one of the options -from, -to or -through is required`));
      if ((from && from.empty) || (to && to.empty) || through.some((t) => t.empty)) {
        S.crit(L(`${cmd}: после разбора объектов не осталось допустимых ${from && from.empty ? 'начальных' : to && to.empty ? 'конечных' : 'промежуточных'} точек – исключение ПРОИГНОРИРОВАНО`, `${cmd}: no valid ${from && from.empty ? 'startpoints' : to && to.empty ? 'endpoints' : 'through points'} remain after object resolution – the exception is IGNORED`));
        return null;
      }
      if (opts['-reset_path']) S.info(L(`${cmd}: -reset_path ConstraintLab не моделирует`, `${cmd}: ConstraintLab does not model -reset_path`));
      return { from, to, through };
    }
    R('set_false_path', (I, a) => {
      const usage = L('set_false_path [-setup|-hold] [-from <объекты>] [-through <объекты>] [-to <объекты>]', 'set_false_path [-setup|-hold] [-from <objects>] [-through <objects>] [-to <objects>]');
      const { opts } = parseArgs('set_false_path', a, { flags: EXC_FLAGS, usage, maxPos: 0 });
      const c = excCommon('set_false_path', opts);
      if (!c) return '';
      const setup = opts['-setup'] || !opts['-hold'];
      const hold = opts['-hold'] || !opts['-setup'];
      S.db.exceptions.push(S.rec('set_false_path', Object.assign(c, { type: 'false', setup, hold })));
      return '';
    });
    R('set_multicycle_path', (I, a) => {
      const usage = L('set_multicycle_path <N> [-setup|-hold] [-start|-end] [-from <объекты>] [-through <объекты>] [-to <объекты>]', 'set_multicycle_path <N> [-setup|-hold] [-start|-end] [-from <objects>] [-through <objects>] [-to <objects>]');
      const { opts, pos } = parseArgs('set_multicycle_path', a, { flags: Object.assign({ '-start': 'b', '-end': 'b' }, EXC_FLAGS), usage, minPos: 1, maxPos: 1 });
      const n = intArg('set_multicycle_path', pos[0], L('множитель', 'multiplier'));
      if (opts['-setup'] && opts['-hold']) throw new TclError(L('set_multicycle_path: -setup и -hold задаются отдельными командами', 'set_multicycle_path: -setup and -hold are specified in separate commands'));
      exclusive('set_multicycle_path', opts, ['-start', '-end']);
      const c = excCommon('set_multicycle_path', opts);
      if (!c) return '';
      const isHold = !!opts['-hold'];
      const ref = opts['-start'] ? 'start' : opts['-end'] ? 'end' : null;
      if (!isHold && n < 1) S.warn(L(`set_multicycle_path ${n} -setup: множитель меньше 1 сдвигает захват раньше фронта по умолчанию – убедитесь, что это намеренно`, `set_multicycle_path ${n} -setup: a multiplier less than 1 moves the capture edge earlier than the default one – make sure this is intended`));
      if (isHold && n < 0) S.warn(L('set_multicycle_path: отрицательный множитель для проверки удержания – необычная настройка', 'set_multicycle_path: a negative multiplier for the hold check is an unusual setting'));
      S.db.exceptions.push(S.rec('set_multicycle_path', Object.assign(c, { type: 'mcp', setup: !isHold, hold: isHold, mult: n, ref })));
      return '';
    });
    const maxMin = (isMax) => (I, a) => {
      const cmd = isMax ? 'set_max_delay' : 'set_min_delay';
      const usage = L(`${cmd} <значение> ${isMax ? '[-datapath_only] ' : ''}[-from <объекты>] [-through <объекты>] [-to <объекты>]`, `${cmd} <value> ${isMax ? '[-datapath_only] ' : ''}[-from <objects>] [-through <objects>] [-to <objects>]`);
      const flags = Object.assign({ '-ignore_clock_latency': 'b' }, EXC_FLAGS);
      if (isMax) flags['-datapath_only'] = 'b';
      delete flags['-setup']; delete flags['-hold'];
      const { opts, pos } = parseArgs(cmd, a, { flags, usage, minPos: 1, maxPos: 1 });
      const value = numArg(cmd, pos[0], L('значение', 'value'));
      const dp = !!opts['-datapath_only'];
      if (dp) {
        if (!opts['-from'] && !opts['-rise_from'] && !opts['-fall_from']) throw new TclError(L('set_max_delay: с -datapath_only обязательна опция -from', 'set_max_delay: -datapath_only requires the -from option'));
        if (!vivado()) S.warn(L('set_max_delay -datapath_only – расширение Vivado; в стандартном SDC такой опции нет (в PrimeTime близкая по смыслу опция -ignore_clock_latency)', 'set_max_delay -datapath_only is a Vivado extension; standard SDC has no such option (the closest PrimeTime option is -ignore_clock_latency)'));
      }
      const c = excCommon(cmd, opts);
      if (!c) return '';
      S.db.exceptions.push(S.rec(cmd, Object.assign(c, { type: isMax ? 'max' : 'min', setup: isMax, hold: !isMax, value, dp })));
      return '';
    };
    R('set_max_delay', maxMin(true));
    R('set_min_delay', maxMin(false));
    R('set_bus_skew', (I, a) => {
      const { opts, pos } = parseArgs('set_bus_skew', a, { flags: EXC_FLAGS, minPos: 1, maxPos: 1, usage: L('set_bus_skew -from <…> -to <…> <значение>', 'set_bus_skew -from <…> -to <…> <value>') });
      const value = numArg('set_bus_skew', pos[0], L('значение', 'value'));
      const c = excCommon('set_bus_skew', opts);
      if (!c) return '';
      if (!vivado()) S.warn(L('set_bus_skew – команда Vivado', 'set_bus_skew is a Vivado command'));
      S.db.busSkew.push(S.rec('set_bus_skew', Object.assign(c, { value })));
      return '';
    });

    // ---------------- параметры тактовых сигналов ----------------
    R('set_clock_uncertainty', (I, a) => {
      const { opts, pos } = parseArgs('set_clock_uncertainty', a, {
        flags: { '-setup': 'b', '-hold': 'b', '-rise': 'b', '-fall': 'b', '-from': 'v', '-rise_from': 'v', '-fall_from': 'v', '-to': 'v', '-rise_to': 'v', '-fall_to': 'v', '-quiet': 'b' },
        minPos: 1, maxPos: 2, usage: L('set_clock_uncertainty [-setup|-hold] [-from <тактовый сигнал> -to <тактовый сигнал>] <значение> [<тактовые сигналы>]', 'set_clock_uncertainty [-setup|-hold] [-from <clock> -to <clock>] <value> [<clocks>]'),
      });
      const value = numArg('set_clock_uncertainty', pos[0], L('значение', 'value'));
      const types = opts['-setup'] && !opts['-hold'] ? ['setup'] : opts['-hold'] && !opts['-setup'] ? ['hold'] : ['setup', 'hold'];
      const fk = exclusive('set_clock_uncertainty', opts, ['-from', '-rise_from', '-fall_from']);
      const tk = exclusive('set_clock_uncertainty', opts, ['-to', '-rise_to', '-fall_to']);
      if (fk || tk) {
        if (!fk || !tk) throw new TclError(L('set_clock_uncertainty: неопределённость для пары тактовых сигналов задаётся опциями -from и -to вместе', 'set_clock_uncertainty: inter-clock uncertainty is specified with -from and -to together'));
        const fr = S.resolveClocks('set_clock_uncertainty', opts[fk], fk);
        const to = S.resolveClocks('set_clock_uncertainty', opts[tk], tk);
        for (const f of fr) for (const t of to) for (const ty of types) S.db.uncertainty.push(S.rec('set_clock_uncertainty', { key: `${f}>${t}`, clock: null, from: f, to: t, type: ty, value }));
        return '';
      }
      if (pos.length < 2) throw new TclError(L('set_clock_uncertainty: укажите тактовые сигналы (или -from/-to)', 'set_clock_uncertainty: specify the clocks (or -from/-to)'));
      const objs = S.resolve('set_clock_uncertainty', pos[1], ['clock', 'port', 'pin'], L('объектов', 'objects'));
      for (const o of objs) for (const ty of types) S.db.uncertainty.push(S.rec('set_clock_uncertainty', { key: o.kind === 'clock' ? o.name : objKey(o), clock: o.kind === 'clock' ? o.name : null, type: ty, value }));
      return '';
    });
    R('set_clock_latency', (I, a) => {
      const { opts, pos } = parseArgs('set_clock_latency', a, {
        flags: { '-source': 'b', '-early': 'b', '-late': 'b', '-rise': 'b', '-fall': 'b', '-min': 'b', '-max': 'b', '-clock': 'v', '-quiet': 'b' },
        minPos: 2, maxPos: 2, usage: L('set_clock_latency [-source] [-early|-late] [-min|-max] <значение> <тактовые сигналы>', 'set_clock_latency [-source] [-early|-late] [-min|-max] <value> <clocks>'),
      });
      const value = numArg('set_clock_latency', pos[0], L('значение', 'value'));
      const objs = S.resolve('set_clock_latency', pos[1], ['clock', 'port', 'pin'], L('объектов', 'objects'));
      const el = opts['-early'] && !opts['-late'] ? ['early'] : opts['-late'] && !opts['-early'] ? ['late'] : ['early', 'late'];
      const mm = opts['-min'] && !opts['-max'] ? ['min'] : opts['-max'] && !opts['-min'] ? ['max'] : ['min', 'max'];
      const kind = opts['-source'] ? 'source' : 'network';
      for (const o of objs) for (const e of el) for (const m of mm) {
        S.db.latency.push(S.rec('set_clock_latency', { key: `${o.kind === 'clock' ? o.name : objKey(o)}|${kind}|${e}|${m}`, value }));
      }
      return '';
    });
    R('set_clock_transition', (I, a) => {
      const { opts, pos } = parseArgs('set_clock_transition', a, { flags: { '-rise': 'b', '-fall': 'b', '-min': 'b', '-max': 'b', '-quiet': 'b' }, minPos: 2, maxPos: 2 });
      const value = numArg('set_clock_transition', pos[0], L('значение', 'value'));
      const cs = S.resolveClocks('set_clock_transition', pos[1], L('тактовые сигналы', 'clocks'));
      const mm = opts['-min'] && !opts['-max'] ? ['min'] : opts['-max'] && !opts['-min'] ? ['max'] : ['min', 'max'];
      const rf = opts['-rise'] && !opts['-fall'] ? ['rise'] : opts['-fall'] && !opts['-rise'] ? ['fall'] : ['rise', 'fall'];
      for (const c of cs) for (const m of mm) for (const r of rf) S.db.transition.push(S.rec('set_clock_transition', { key: `${c}|${m}|${r}`, value }));
      return '';
    });
    R('set_input_jitter', (I, a) => {
      const { pos } = parseArgs('set_input_jitter', a, { flags: { '-quiet': 'b' }, minPos: 2, maxPos: 2, usage: L('set_input_jitter <тактовый сигнал> <джиттер, нс (размах)>', 'set_input_jitter <clock> <jitter, ns (peak-to-peak)>') });
      const cs = S.resolveClocks('set_input_jitter', pos[0], L('тактовый сигнал', 'clock'));
      const value = numArg('set_input_jitter', pos[1], L('значение джиттера', 'jitter value'));
      for (const c of cs) {
        const co = S.clockObj(c);
        if (co && co.type !== 'primary' && co.type !== 'virtual') S.warn(L(`set_input_jitter: «${c}» – производный тактовый сигнал; входной джиттер задают для первичных тактовых сигналов (на производные он распространяется автоматически)`, `set_input_jitter: '${c}' is a generated clock; input jitter is specified for primary clocks (it propagates to generated clocks automatically)`));
        S.db.jitter.push(S.rec('set_input_jitter', { key: c, value }));
      }
      if (!vivado()) S.warn(L('set_input_jitter – команда Vivado; в SDC джиттер обычно закладывают в set_clock_uncertainty', 'set_input_jitter is a Vivado command; in SDC, jitter is usually included in set_clock_uncertainty'));
      return '';
    });
    R('set_system_jitter', (I, a) => {
      const { pos } = parseArgs('set_system_jitter', a, { flags: {}, minPos: 1, maxPos: 1 });
      S.db.sysJitter = S.rec('set_system_jitter', { value: numArg('set_system_jitter', pos[0], L('значение', 'value')) });
      return '';
    });
    R('set_propagated_clock', (I, a) => {
      const { pos } = parseArgs('set_propagated_clock', a, { flags: { '-quiet': 'b' }, minPos: 1, maxPos: 1 });
      const objs = S.resolve('set_propagated_clock', pos[0], ['clock', 'port', 'pin'], L('объектов', 'objects'));
      for (const o of objs) S.db.propagated.add(o.kind === 'clock' ? o.name : objKey(o));
      S.rec('set_propagated_clock', { objs: objs.map((o) => o.name) });
      if (vivado()) S.info(L('set_propagated_clock: Vivado всегда учитывает реальную задержку распространения тактовых сигналов (propagated), команда не нужна', 'set_propagated_clock: Vivado always uses the actual clock propagation delay (propagated clocks); the command is not needed'));
      return '';
    });
    R('set_clock_gating_check', (I, a) => {
      const { opts, pos } = parseArgs('set_clock_gating_check', a, { flags: { '-setup': 'v', '-hold': 'v', '-rise': 'b', '-fall': 'b', '-high': 'b', '-low': 'b' }, maxPos: 1 });
      const key = pos.length ? S.resolve('set_clock_gating_check', pos[0], ['clock', 'cell', 'pin'], L('объектов', 'objects')).map((o) => o.name).join(',') : 'design';
      if (opts['-setup'] !== undefined) S.db.misc.push(S.rec('set_clock_gating_check', { mkind: 'gating', key: key + '|setup', value: numArg('set_clock_gating_check', opts['-setup'], '-setup') }));
      if (opts['-hold'] !== undefined) S.db.misc.push(S.rec('set_clock_gating_check', { mkind: 'gating', key: key + '|hold', value: numArg('set_clock_gating_check', opts['-hold'], '-hold') }));
      return '';
    });

    // ---------------- окружение (ASIC) ----------------
    const objsOrDesign = (cmd, v) => {
      const objs = S.resolve(cmd, v, ['port', 'net', 'pin', 'design', 'clock', 'cell'], L('объектов', 'objects'));
      return objs;
    };
    const envVal = (cmd, mkind, flags, usage) => (I, a) => {
      const { opts, pos } = parseArgs(cmd, a, { flags: Object.assign({ '-quiet': 'b' }, flags), minPos: 2, maxPos: 2, usage });
      const value = numArg(cmd, pos[0], L('значение', 'value'));
      const objs = objsOrDesign(cmd, pos[1]);
      if (!objs.length) { S.crit(L(`${cmd}: объекты не найдены – ограничение проигнорировано`, `${cmd}: no objects found – the constraint is ignored`)); return ''; }
      const sub = [];
      if (flags['-min'] !== undefined) sub.push(opts['-min'] && !opts['-max'] ? 'min' : opts['-max'] && !opts['-min'] ? 'max' : 'minmax');
      if (flags['-rise'] !== undefined && (opts['-rise'] || opts['-fall'])) sub.push(opts['-rise'] ? 'rise' : 'fall');
      if (opts['-clock_path']) sub.push('clock_path');
      if (opts['-data_path']) sub.push('data_path');
      for (const o of objs) {
        const base = o.kind === 'design' ? 'design' : objKey(o);
        const keys = sub.includes('minmax') ? [sub.map((s) => s === 'minmax' ? 'min' : s), sub.map((s) => s === 'minmax' ? 'max' : s)] : [sub];
        for (const k of keys) S.db.misc.push(S.rec(cmd, { mkind, key: [base, ...k].join('|'), value }));
      }
      return '';
    };
    R('set_load', envVal('set_load', 'load', { '-pin_load': 'b', '-wire_load': 'b', '-min': 'b', '-max': 'b', '-subtract_pin_load': 'b' }, L('set_load [-min|-max] <емкость> <порты>', 'set_load [-min|-max] <capacitance> <ports>')));
    R('set_drive', envVal('set_drive', 'drive', { '-rise': 'b', '-fall': 'b', '-min': 'b', '-max': 'b' }, L('set_drive <сопротивление> <порты>', 'set_drive <resistance> <ports>')));
    R('set_input_transition', envVal('set_input_transition', 'input_transition', { '-rise': 'b', '-fall': 'b', '-min': 'b', '-max': 'b', '-clock': 'v', '-clock_fall': 'b' }, L('set_input_transition <время> <порты>', 'set_input_transition <time> <ports>')));
    R('set_max_transition', envVal('set_max_transition', 'max_transition', { '-clock_path': 'b', '-data_path': 'b', '-rise': 'b', '-fall': 'b' }, L('set_max_transition <время> <объекты>', 'set_max_transition <time> <objects>')));
    R('set_max_fanout', envVal('set_max_fanout', 'max_fanout', {}, L('set_max_fanout <число> <объекты>', 'set_max_fanout <value> <objects>')));
    R('set_max_capacitance', envVal('set_max_capacitance', 'max_capacitance', { '-clock_path': 'b', '-data_path': 'b' }, L('set_max_capacitance <емкость> <объекты>', 'set_max_capacitance <capacitance> <objects>')));
    R('set_min_capacitance', envVal('set_min_capacitance', 'min_capacitance', {}, L('set_min_capacitance <емкость> <объекты>', 'set_min_capacitance <capacitance> <objects>')));
    R('set_driving_cell', (I, a) => {
      const { opts, pos } = parseArgs('set_driving_cell', a, {
        flags: { '-lib_cell': 'v', '-library': 'v', '-pin': 'v', '-from_pin': 'v', '-rise': 'b', '-fall': 'b', '-min': 'b', '-max': 'b', '-input_transition_rise': 'v',
          '-input_transition_fall': 'v', '-no_design_rule': 'b', '-dont_scale': 'b', '-multiply_by': 'v', '-cell': 'v', '-quiet': 'b' },
        minPos: 1, maxPos: 1, usage: L('set_driving_cell -lib_cell <ячейка> [-pin <выход>] <порты>', 'set_driving_cell -lib_cell <cell> [-pin <output pin>] <ports>'),
      });
      const lc = opts['-lib_cell'] !== undefined ? opts['-lib_cell'] : opts['-cell'];
      if (lc === undefined) throw new TclError(L('set_driving_cell: нужна опция -lib_cell', 'set_driving_cell: option -lib_cell is required'));
      let cellName = lc && lc.isColl ? (lc.items[0] ? lc.items[0].name.split('/').pop() : '') : toStr(lc).split('/').pop();
      if (!LIBCELLS.includes(cellName)) S.warn(L(`set_driving_cell: ячейки «${cellName}» нет в условной библиотеке ConstraintLab (${LIBCELLS.slice(0, 8).join(', ')}, …)`, `set_driving_cell: cell '${cellName}' is not in the ConstraintLab sample library (${LIBCELLS.slice(0, 8).join(', ')}, …)`));
      const objs = S.resolve('set_driving_cell', pos[0], ['port'], L('портов', 'ports'));
      for (const o of objs) {
        if (o.dir === 'out') S.warn(L(`set_driving_cell: «${o.name}» – выходной порт; управляющую ячейку задают для входов`, `set_driving_cell: '${o.name}' is an output port; a driving cell is specified for inputs`));
        // выход ячейки (-pin) на сравнение не влияет: у ячеек условной библиотеки он один
        S.db.misc.push(S.rec('set_driving_cell', { mkind: 'driving_cell', key: objKey(o), value: cellName, pin: opts['-pin'] !== undefined ? toStr(opts['-pin']) : null }));
      }
      return '';
    });
    R('set_ideal_network', (I, a) => {
      const { pos } = parseArgs('set_ideal_network', a, { flags: { '-no_propagate': 'b' }, minPos: 1, maxPos: 1 });
      for (const o of S.resolve('set_ideal_network', pos[0], ['port', 'pin', 'net'], L('объектов', 'objects'))) S.db.misc.push(S.rec('set_ideal_network', { mkind: 'ideal_network', key: objKey(o), value: '1' }));
      return '';
    });
    R('set_dont_touch_network', (I, a) => {
      const { pos } = parseArgs('set_dont_touch_network', a, { flags: { '-no_propagate': 'b', '-clear': 'b' }, minPos: 1, maxPos: 1 });
      for (const o of S.resolve('set_dont_touch_network', pos[0], ['port', 'pin', 'net', 'clock'], L('объектов', 'objects'))) S.db.misc.push(S.rec('set_dont_touch_network', { mkind: 'dont_touch_network', key: o.kind === 'clock' ? o.name : objKey(o), value: '1' }));
      return '';
    });
    R('set_case_analysis', (I, a) => {
      const { pos } = parseArgs('set_case_analysis', a, { flags: {}, minPos: 2, maxPos: 2, usage: L('set_case_analysis 0|1|rising|falling <порты/выводы>', 'set_case_analysis 0|1|rising|falling <ports/pins>') });
      const vs = toStr(pos[0]).toLowerCase();
      const map = { '0': '0', '1': '1', zero: '0', one: '1', "1'b0": '0', "1'b1": '1', rise: 'rise', rising: 'rise', fall: 'fall', falling: 'fall' };
      if (!map[vs]) throw new TclError(L(`set_case_analysis: значение «${vs}» недопустимо (0, 1, rising, falling)`, `set_case_analysis: value '${vs}' is not allowed (0, 1, rising, falling)`));
      const objs = S.resolve('set_case_analysis', pos[1], ['port', 'pin'], L('объектов', 'objects'));
      for (const o of objs) S.db.caseAnalysis.set(objKey(o), { value: map[vs], line: I.curLine, obj: o });
      S.rec('set_case_analysis', { value: map[vs], objs: objs.map((o) => o.name) });
      S.dirty();
      return '';
    });
    R('set_disable_timing', (I, a) => {
      const { opts, pos } = parseArgs('set_disable_timing', a, { flags: { '-from': 'v', '-to': 'v', '-restore': 'b' }, minPos: 1, maxPos: 1 });
      const objs = S.resolve('set_disable_timing', pos[0], ['cell', 'pin', 'port'], L('объектов', 'objects'));
      for (const o of objs) {
        if (o.kind === 'cell') S.db.disable.push({ cell: o.name, from: opts['-from'] ? toStr(opts['-from']) : '*', to: opts['-to'] ? toStr(opts['-to']) : '*', line: I.curLine });
        else if (o.kind === 'pin') S.db.disable.push({ cell: o.cell.name, from: o.dir === 'in' ? o.pname : '*', to: o.dir === 'out' ? o.pname : '*', line: I.curLine });
      }
      S.rec('set_disable_timing', { objs: objs.map((o) => o.name) });
      S.dirty();
      return '';
    });
    R('set_units', (I, a) => {
      const { opts } = parseArgs('set_units', a, { flags: { '-time': 'v', '-capacitance': 'v', '-resistance': 'v', '-voltage': 'v', '-current': 'v', '-power': 'v' }, maxPos: 0 });
      for (const [k, v] of Object.entries(opts)) S.db.units[k.slice(1)] = toStr(v);
      if (opts['-time'] && !/^1?ns$/i.test(toStr(opts['-time']))) S.warn(L('set_units: ConstraintLab считает все времена в наносекундах', 'set_units: ConstraintLab uses nanoseconds for all times'));
      S.rec('set_units', { units: Object.assign({}, S.db.units) });
      return '';
    });
    const stub = (n, note) => R(n, (I, a) => { S.rec(n, { stub: true }); if (note) S.I.noteOnce('stub:' + n, 'info', note); return ''; });
    stub('set_operating_conditions', L('set_operating_conditions: условия эксплуатации (PVT) ConstraintLab не моделирует', 'set_operating_conditions: ConstraintLab does not model operating conditions (PVT)'));
    stub('set_wire_load_model', L('set_wire_load_model: модели нагрузки межсоединений ConstraintLab не моделирует', 'set_wire_load_model: ConstraintLab does not model wire load models'));
    stub('set_wire_load_mode');
    stub('set_max_area');
    stub('set_timing_derate', L('set_timing_derate влияет на задержки ячеек, а ConstraintLab анализирует идеальные соотношения фронтов тактовых сигналов', 'set_timing_derate affects cell delays, while ConstraintLab analyzes ideal clock edge relationships'));
    stub('set_max_dynamic_power');
    stub('set_max_leakage_power');
    stub('set_clock_sense', L('set_clock_sense ConstraintLab не моделирует', 'set_clock_sense is not modeled by ConstraintLab'));
    stub('set_sense', L('set_sense ConstraintLab не моделирует', 'set_sense is not modeled by ConstraintLab'));
    stub('group_path', L('group_path влияет только на группировку в отчётах и оптимизацию', 'group_path affects only path grouping in reports and optimization'));
    stub('set_data_check', L('set_data_check ConstraintLab не моделирует', 'set_data_check is not modeled by ConstraintLab'));
    stub('create_pblock', L('Pblock (области размещения) ConstraintLab не моделирует', 'Pblocks (placement regions) are not modeled by ConstraintLab'));
    stub('add_cells_to_pblock');
    stub('resize_pblock');
    stub('set_external_delay');
    stub('set_max_time_borrow', L('Защёлки и заимствование времени (time borrowing) ConstraintLab не моделирует', 'Latches and time borrowing are not modeled by ConstraintLab'));

    // ---------------- set_property ----------------
    R('set_property', (I, a) => {
      const usage = L('set_property <СВОЙСТВО> <значение> <объекты>   или   set_property -dict {СВ1 зн1 СВ2 зн2} <объекты>', 'set_property <PROPERTY> <value> <objects>   or   set_property -dict {PROP1 val1 PROP2 val2} <objects>');
      const { opts, pos } = parseArgs('set_property', a, { flags: { '-dict': 'v', '-quiet': 'b', '-verbose': 'b' }, usage });
      let pairs = [], objV;
      if (opts['-dict'] !== undefined) {
        const l = T.listItems(opts['-dict']).map(toStr);
        if (l.length % 2) throw new TclError(L('set_property -dict: нечётное число элементов – нужны пары «свойство значение»', 'set_property -dict: odd number of elements – property/value pairs are required'));
        for (let k = 0; k < l.length; k += 2) pairs.push([l[k], l[k + 1]]);
        if (pos.length !== 1) throw new TclError(L('set_property -dict: после словаря нужен ровно один аргумент – объекты\nСинтаксис: ', 'set_property -dict: exactly one argument (the objects) is required after the dictionary\nSyntax: ') + usage);
        objV = pos[0];
      } else {
        if (pos.length !== 3) throw new TclError(L(`set_property: нужно три аргумента (свойство, значение, объекты), получено ${pos.length}\nСинтаксис: `, `set_property: three arguments are required (property, value, objects), got ${pos.length}\nSyntax: `) + usage);
        pairs.push([toStr(pos[0]), toStr(pos[1])]);
        objV = pos[2];
      }
      const objs = S.resolve('set_property', objV, ['port', 'cell', 'pin', 'net', 'design', 'clock'], L('объектов', 'objects'));
      if (!objs.length) { S.crit(L('set_property: не найдено ни одного объекта – свойство не установлено', 'set_property: no objects found – the property is not set')); return ''; }
      for (const [prop0, val] of pairs) {
        const prop = prop0.toUpperCase();
        if (prop0 !== prop && /[a-z]/.test(prop0)) S.I.noteOnce('propcase:' + prop0, 'info', L(`set_property: свойство «${prop0}» – Vivado нечувствителен к регистру, но принято писать заглавными (${prop})`, `set_property: property '${prop0}' – Vivado is case-insensitive, but uppercase is the convention (${prop})`));
        for (const o of objs) {
          const known = PROPS[o.kind] || [];
          const isBit = prop.startsWith('BITSTREAM.');
          if (o.kind === 'design' && isBit) {
            if (!BITSTREAM.includes(prop)) {
              const sg = U.suggest(prop, BITSTREAM, 4);
              S.warn(L(`set_property: свойство «${prop}» отсутствует в списке известных ConstraintLab свойств BITSTREAM`, `set_property: property '${prop}' is not in the list of BITSTREAM properties known to ConstraintLab`) + (sg ? L(` (может быть, «${sg}»?)`, ` (did you mean '${sg}'?)`) : ''));
            }
          } else if (!known.includes(prop)) {
            const all = U.uniq(Object.values(PROPS).flat());
            const sg = U.suggest(prop, known.length ? known : all, 3);
            if (all.includes(prop)) throw new TclError(L(`set_property: свойство «${prop}» неприменимо к объекту «${o.name}» (${kindRu(o.kind)})`, `set_property: property '${prop}' is not applicable to object '${o.name}' (${kindRu(o.kind)})`));
            throw new TclError(L(`set_property: неизвестное свойство «${prop}» для объекта «${o.name}» (${kindRu(o.kind)})`, `set_property: unknown property '${prop}' for object '${o.name}' (${kindRu(o.kind)})`) + (sg ? L(` – может быть, «${sg}»?`, ` – did you mean '${sg}'?`) : ''));
          }
          validatePropValue(S, o, prop, val);
          o.props.set(prop, { value: val, line: I.curLine, src: I.src });
          S.db.props.push({ key: objKey(o), kind: o.kind, name: o.name, prop, value: val, line: I.curLine, src: I.src });
        }
      }
      S.rec('set_property', { pairs, objs: objs.map((o) => o.name) });
      return '';
    });
  }

  function validatePropValue(S, o, prop, val) {
    const v = String(val);
    const V = v.toUpperCase();
    const boolP = ['ASYNC_REG', 'IOB', 'DIFF_TERM', 'PULLUP', 'PULLDOWN', 'DONT_TOUCH', 'KEEP', 'MARK_DEBUG', 'IBUF_LOW_PWR', 'BITSTREAM.GENERAL.COMPRESS'];
    if (boolP.includes(prop) && !/^(TRUE|FALSE|1|0|YES|NO)$/i.test(v)) {
      if (!(prop === 'IOB' && /^(FORCE|AUTO)$/i.test(v)) && !(prop === 'DONT_TOUCH' && /^(TRUE|FALSE)$/i.test(v))) throw new TclError(L(`set_property ${prop}: ожидается TRUE/FALSE, получено «${v}»`, `set_property ${prop}: TRUE/FALSE expected, got '${v}'`));
    }
    if (prop === 'IOSTANDARD' && !IOSTANDARDS.includes(V)) {
      const sg = U.suggest(V, IOSTANDARDS, 3);
      S.warn(L(`set_property IOSTANDARD: «${v}» нет в списке стандартов, известных ConstraintLab`, `set_property IOSTANDARD: '${v}' is not in the list of I/O standards known to ConstraintLab`) + (sg ? L(` – может быть, «${sg}»?`, ` – did you mean '${sg}'?`) : ''));
    }
    if (prop === 'PACKAGE_PIN' && !/^[A-Z]{1,2}\d{1,2}$/i.test(v)) S.warn(L(`set_property PACKAGE_PIN: «${v}» не похоже на имя вывода корпуса (например, E3 или AA12)`, `set_property PACKAGE_PIN: '${v}' does not look like a package pin name (for example, E3 or AA12)`));
    if (prop === 'DRIVE' && !['2', '4', '6', '8', '12', '16', '24'].includes(v)) S.warn(L(`set_property DRIVE: допустимые значения 2, 4, 6, 8, 12, 16, 24 мА (получено «${v}»)`, `set_property DRIVE: valid values are 2, 4, 6, 8, 12, 16, 24 mA (got '${v}')`));
    if (prop === 'SLEW' && !['SLOW', 'FAST', 'MEDIUM'].includes(V)) throw new TclError(L(`set_property SLEW: ожидается SLOW или FAST, получено «${v}»`, `set_property SLEW: SLOW or FAST expected, got '${v}'`));
    if (prop === 'CFGBVS' && !['VCCO', 'GND'].includes(V)) throw new TclError(L(`set_property CFGBVS: ожидается VCCO или GND, получено «${v}»`, `set_property CFGBVS: VCCO or GND expected, got '${v}'`));
    if (prop === 'CONFIG_VOLTAGE' && !['1.5', '1.8', '2.5', '3.3'].includes(v)) S.warn(L(`set_property CONFIG_VOLTAGE: обычные значения 1.8, 2.5, 3.3 (получено «${v}»)`, `set_property CONFIG_VOLTAGE: typical values are 1.8, 2.5, 3.3 (got '${v}')`));
    if (prop === 'PULLTYPE' && !['PULLUP', 'PULLDOWN', 'KEEPER', 'NONE'].includes(V)) throw new TclError(L(`set_property PULLTYPE: ожидается PULLUP, PULLDOWN, KEEPER или NONE`, `set_property PULLTYPE: PULLUP, PULLDOWN, KEEPER or NONE expected`));
    if (prop === 'CLOCK_DEDICATED_ROUTE' && !['TRUE', 'FALSE', 'BACKBONE', 'ANY_CMT_COLUMN', 'SAME_CMT_COLUMN'].includes(V)) S.warn(L('set_property CLOCK_DEDICATED_ROUTE: ожидается TRUE, FALSE или BACKBONE', 'set_property CLOCK_DEDICATED_ROUTE: TRUE, FALSE or BACKBONE expected'));
  }

  XT.sdc = { Session, parseArgs, PROPS, IOSTANDARDS, BITSTREAM, LIBCELLS, numArg };
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
