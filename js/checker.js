/* ConstraintLab – проверка ответа: сравнение эффективной временной модели с эталоном */
(function (XT) {
  'use strict';
  const U = XT.util;
  const { Frac } = U;
  const objKey = XT.design.objKey;
  const fmt = U.fmt;
  const TOL = 0.0015;
  const L = XT.L;

  // ---------------------------------------------------------------------------
  // Прогон сессии: given → код → after
  // ---------------------------------------------------------------------------
  function buildDesign(q) {
    return new XT.design.Design(q.design || { elements: [], wires: [] }, { tool: q.tool || 'vivado', name: q.top || 'top' });
  }
  function runSession(q, code) {
    const D = buildDesign(q);
    const S = new XT.sdc.Session(D, { tool: q.tool || 'vivado' });
    if (q.given) S.run(q.given, 'given');
    S.run(code || '', 'user');
    if (q.after) S.run(q.after, 'after');
    let A = null, err = null;
    try { A = XT.sta.analyze(S); } catch (e) { err = e; if (typeof console !== 'undefined') console.error(e); }
    return { S, A, D, err };
  }

  // ---------------------------------------------------------------------------
  // Вспомогательное
  // ---------------------------------------------------------------------------
  const isIdealPort = (c) => c && c.type === 'primary' && (c.sources || []).length > 0 && c.sources.every((s) => s.kind === 'port');
  function sameWave(a, b) { return U.approxEq(a.period, b.period, TOL) && U.approxEq(a.rise, b.rise, TOL) && U.approxEq(a.fall, b.fall, TOL); }
  function defPoint(c) { return (c.sources || []).map(objKey).sort().join(','); }
  function clsOf(c) { return c.type === 'virtual' ? 'virtual' : c.type === 'primary' ? 'primary' : 'generated'; }
  function waveStr(c) { return L(`период ${fmt(c.period)} нс, форма {${fmt(c.rise)} ${fmt(c.fall)}}`, `period ${fmt(c.period)} ns, waveform {${fmt(c.rise)} ${fmt(c.fall)}}`); }
  function edgeRu(e) { return e === 'fall' ? L('спада', 'falling edge') : L('фронта', 'rising edge'); }
  function srcRu(src) {
    return ({ default: L('по умолчанию', 'default'), mcp: L('многотактный путь', 'multicycle path'), mcp_setup: L('сдвиг от set_multicycle_path -setup', 'shifted by set_multicycle_path -setup'), max: 'set_max_delay', max_dp: 'set_max_delay -datapath_only', min: 'set_min_delay' })[src] || src;
  }
  function whyRu(why) {
    return ({
      false: L('ложный путь', 'false path'), async: L('асинхронные группы тактовых сигналов', 'asynchronous clock groups'), exclusive: L('взаимоисключающие тактовые сигналы', 'exclusive clocks'), datapath_only: L('проверка удержания отключена опцией -datapath_only', 'hold check disabled by -datapath_only'),
      no_clock: L('нет тактового сигнала', 'no clock'), no_input_delay: L('нет set_input_delay', 'no set_input_delay'), no_output_delay: L('нет set_output_delay', 'no set_output_delay'), partial_in: L('в set_input_delay нет нужного значения (-max или -min)', 'set_input_delay lacks the required value (-max or -min)'),
      partial_out: L('в set_output_delay нет нужного значения (-max или -min)', 'set_output_delay lacks the required value (-max or -min)'), io_no_clock: L('задержка без -clock', 'delay without -clock'),
    })[why] || why;
  }
  function lineOf(rec) { return rec && rec.line ? rec.line : null; }
  function recSrc(rec) { return rec && rec.src; }

  class Findings {
    constructor() { this.list = []; }
    add(sev, cat, title, detail, extra) {
      const f = Object.assign({ sev, cat, title, detail: detail || '' }, extra || {});
      this.list.push(f);
      return f;
    }
    get errors() { return this.list.filter((f) => f.sev === 'error'); }
  }

  // ---------------------------------------------------------------------------
  // Сопоставление тактовых сигналов
  // ---------------------------------------------------------------------------
  function matchClocks(Au, Ar) {
    const uList = Au.clocks.list, rList = Ar.clocks.list;
    const r2u = new Map(), u2r = new Map();
    const usedU = new Set();
    // 1) по точке определения
    for (const r of rList) {
      if (r.type === 'virtual') continue;
      const dp = defPoint(r);
      let cands = uList.filter((u) => u.type !== 'virtual' && defPoint(u) === dp && !usedU.has(u.name));
      if (!cands.length) continue;
      cands.sort((a, b) => (sameWave(b, r) - sameWave(a, r)) || ((clsOf(b) === clsOf(r)) - (clsOf(a) === clsOf(r))) || ((b.master === r.master) - (a.master === r.master)));
      const u = cands[0];
      r2u.set(r.name, u.name); u2r.set(u.name, r.name); usedU.add(u.name);
    }
    // 2) виртуальные – по форме волны
    for (const r of rList) {
      if (r.type !== 'virtual') continue;
      const cands = uList.filter((u) => u.type === 'virtual' && !usedU.has(u.name) && sameWave(u, r));
      if (cands.length) {
        const u = cands.find((x) => x.name === r.name) || cands[0];
        r2u.set(r.name, u.name); u2r.set(u.name, r.name); usedU.add(u.name);
      }
    }
    return { r2u, u2r };
  }
  function makeEquiv(Au, Ar, M, strictVirtual) {
    return (u, r) => {
      if (u === null || u === undefined || r === null || r === undefined) return (u === null || u === undefined) && (r === null || r === undefined);
      if (M.r2u.get(r) === u) return true;
      const U_ = Au.clocks.clocks.get(u), R_ = Ar.clocks.clocks.get(r);
      if (!U_ || !R_) return false;
      const uIdeal = U_.type === 'virtual' || isIdealPort(U_);
      const rIdeal = R_.type === 'virtual' || isIdealPort(R_);
      // идеальный тактовый сигнал на порту равноценен виртуальному той же формы, если задача не требует именно виртуального
      if (!strictVirtual && uIdeal && rIdeal && (U_.type === 'virtual' || R_.type === 'virtual') && sameWave(U_, R_)) return true;
      return false;
    };
  }

  // ---------------------------------------------------------------------------
  // Слой: тактовые сигналы
  // ---------------------------------------------------------------------------
  function checkClocks(F, q, Su, Au, Sr, Ar, M, root) {
    const chk = q.check || {};
    for (const r of Ar.clocks.list) {
      const un = M.r2u.get(r.name);
      if (r.type === 'virtual') {
        if (!un && chk.requireVirtual) {
          F.add('error', 'clock', L(`Нет виртуального тактового сигнала (${waveStr(r)})`, `No virtual clock (${waveStr(r)})`), L('В задаче требуется описать внешний (виртуальный) тактовый сигнал: create_clock -name … -period … без объектов.', 'The task requires an external (virtual) clock: create_clock -name … -period … with no objects.'));
          root.badClocks.add(r.name);
        }
        continue;
      }
      const where = (r.sources || []).map((s) => s.name).join(', ');
      if (!un) {
        // поищем похожий тактовый сигнал в другом месте
        const sim = Au.clocks.list.find((u) => u.type !== 'virtual' && !M.u2r.has(u.name) && sameWave(u, r));
        if (sim) {
          const uw = (sim.sources || []).map((s) => s.name).join(', ');
          F.add('error', 'clock', L(`Тактовый сигнал определён не в той точке: на «${uw}» вместо «${where}»`, `Clock defined at the wrong point: on '${uw}' instead of '${where}'`),
            explainWrongPoint(sim, r), { lines: [sim.def && sim.def.line].filter(Boolean) });
          M.r2u.set(r.name, sim.name); M.u2r.set(sim.name, r.name);
        } else if (r.type === 'auto') {
          F.add('error', 'clock', L(`Нет тактового сигнала на выходе ${r.cell}/${r.outPin}`, `No clock at output ${r.cell}/${r.outPin}`), L('Vivado выводит этот тактовый сигнал автоматически из входного тактового сигнала MMCM/PLL. Скорее всего, не задан (или задан неверно) первичный тактовый сигнал на входе.', 'Vivado derives this clock automatically from the MMCM/PLL input clock. Most likely the primary clock at the input is missing (or wrong).'));
        } else if (r.type === 'generated') {
          F.add('error', 'clock', L(`Не описан производный тактовый сигнал на «${where}»`, `Generated clock on '${where}' is not defined`), L(`Ожидается тактовый сигнал, полученный из «${r.master}» (${waveStr(r)}). Используйте create_generated_clock с опцией -source, указывающей на вывод, где присутствует исходный тактовый сигнал.`, `Expected a clock derived from '${r.master}' (${waveStr(r)}). Use create_generated_clock with -source pointing to a pin where the master clock is present.`));
        } else {
          F.add('error', 'clock', L(`Не описан тактовый сигнал на «${where}»`, `Clock on '${where}' is not defined`), L(`Ожидается первичный тактовый сигнал: ${waveStr(r)}.`, `Expected a primary clock: ${waveStr(r)}.`), { expected: `create_clock -period ${U.fmtShort(r.period)}${!U.approxEq(r.rise, 0) || !U.approxEq(r.fall, r.period.div(2)) ? ` -waveform {${U.fmtShort(r.rise)} ${U.fmtShort(r.fall)}}` : ''} [get_ports ${where}]` });
        }
        root.badClocks.add(r.name);
        continue;
      }
      const u = Au.clocks.clocks.get(un);
      const lines = [u.def && u.def.line].filter(Boolean);
      if (clsOf(u) !== clsOf(r)) {
        if (clsOf(r) === 'generated' && clsOf(u) === 'primary') {
          F.add('error', 'clock', L(`Тактовый сигнал на «${where}» должен быть производным (create_generated_clock), а не первичным`, `The clock on '${where}' must be a generated clock (create_generated_clock), not a primary one`),
            r.type === 'auto'
              ? L('Это выход MMCM/PLL: Vivado сам выводит здесь тактовый сигнал и знает его связь с входным тактовым сигналом. create_clock создаёт НЕЗАВИСИМЫЙ тактовый сигнал – междоменные пути станут «несвязанными», а задержка входного тактового дерева потеряется. Удалите create_clock (или переименуйте автоматически выведенный тактовый сигнал через create_generated_clock -name).', 'This is an MMCM/PLL output: Vivado derives the clock here by itself and knows its relationship to the input clock. create_clock creates an INDEPENDENT clock: clock domain crossing paths become "unrelated", and the delay of the input clock tree is lost. Remove create_clock (or rename the auto-derived clock with create_generated_clock -name).')
              : L('Тактовый сигнал получен из другого (делитель частоты, вывод тактового сигнала на внешний вывод, мультиплексор), поэтому его фаза и задержка привязаны к исходному тактовому сигналу. Первичный тактовый сигнал (create_clock) теряет эту связь: задержка до точки определения не учитывается, а соотношение с исходным сигналом считается асинхронным.', 'This clock is derived from another one (frequency divider, clock forwarded to an output pin, multiplexer), so its phase and delay are tied to the master clock. A primary clock (create_clock) loses this relationship: the delay up to the definition point is ignored, and the relationship with the master clock is treated as asynchronous.'),
            { lines });
          root.badClocks.add(r.name);
          continue;
        }
        if (clsOf(r) === 'primary' && clsOf(u) === 'generated') {
          F.add('error', 'clock', L(`На «${where}» нужен первичный тактовый сигнал (create_clock)`, `A primary clock (create_clock) is required on '${where}'`), L('Это внешний тактовый вход: здесь тактовый сигнал поступает в микросхему, исходного тактового сигнала у него нет.', 'This is an external clock input: the clock enters the chip here and has no master clock.'), { lines });
          root.badClocks.add(r.name);
          continue;
        }
      }
      let bad = false;
      if (!U.approxEq(u.period, r.period, TOL)) {
        bad = true;
        const ratio = U.num(r.period) / U.num(u.period);
        let hint = '';
        if (Math.abs(ratio - 1000) < 1 || Math.abs(ratio - 0.001) < 1e-6) hint = L(' Похоже на ошибку в единицах: период задаётся в наносекундах.', ' Looks like a unit error: the period is specified in nanoseconds.');
        else if (Math.abs(U.num(u.period) - 1000 / U.num(r.period)) < 0.01) hint = L(' Похоже, вместо периода указана частота: период = 1000 / f[МГц] нс.', ' Looks like the frequency was given instead of the period: period = 1000 / f[MHz] ns.');
        F.add('error', 'clock', L(`Тактовый сигнал «${u.name}» на «${where}»: неверный период ${fmt(u.period)} нс`, `Clock '${u.name}' on '${where}': wrong period ${fmt(u.period)} ns`), L('Проверьте расчёт периода по частоте.', 'Check how the period is calculated from the frequency.') + hint, { lines, expected: L(`${fmt(r.period)} нс`, `${fmt(r.period)} ns`) });
      } else if (!U.approxEq(u.rise, r.rise, TOL) || !U.approxEq(u.fall, r.fall, TOL)) {
        bad = true;
        F.add('error', 'clock', L(`Тактовый сигнал «${u.name}» на «${where}»: неверная форма (waveform {${fmt(u.rise)} ${fmt(u.fall)}})`, `Clock '${u.name}' on '${where}': wrong waveform {${fmt(u.rise)} ${fmt(u.fall)}}`),
          L('Период верный, но моменты фронта и спада не совпадают с ожидаемыми (коэффициент заполнения или фазовый сдвиг).', 'The period is correct, but the rising and falling edge times differ from the expected ones (duty cycle or phase shift).'), { lines, expected: `{${fmt(r.rise)} ${fmt(r.fall)}}` });
      }
      if (clsOf(r) === 'generated' && r.master && u.master) {
        const um = M.u2r.get(u.master) || u.master;
        if (um !== r.master && !bad) F.add('warn', 'clock', L(`Производный тактовый сигнал «${u.name}»: исходный тактовый сигнал «${u.master}», ожидался «${r.master}»`, `Generated clock '${u.name}': the master clock is '${u.master}', expected '${r.master}'`), '', { lines });
      }
      if (bad) { root.badClocks.add(r.name); root.badUClocks.add(u.name); }
      const needName = chk.clockNames === true || (Array.isArray(chk.clockNames) && chk.clockNames.includes(r.name));
      if (needName && u.name !== r.name) {
        F.add('error', 'clock', L(`Тактовый сигнал на «${where}» должен называться «${r.name}» (у вас «${u.name}»)`, `The clock on '${where}' must be named '${r.name}' (yours is '${u.name}')`), L('Имя тактового сигнала задано в условии: на него ссылаются другие ограничения и отчёты.', 'The clock name is given in the task: other constraints and reports refer to it.'), { lines });
      }
    }
    // лишние тактовые сигналы
    for (const u of Au.clocks.list) {
      if (M.u2r.has(u.name)) continue;
      if (u.type === 'virtual') continue;
      if (u.def && u.def.src && u.def.src !== 'user') continue;
      const where = (u.sources || []).map((s) => s.name).join(', ');
      let det = L('Лишний тактовый сигнал создаёт дополнительные междоменные пути и может перекрыть правильный тактовый сигнал.', 'An extra clock creates additional clock domain crossing paths and may override the correct clock.');
      const s0 = (u.sources || [])[0];
      if (s0 && s0.kind === 'port' && s0.net && s0.net.members.some((m) => m.kind === 'pin' && m.base === 'IB')) det = L('Это N-вывод дифференциальной пары. Тактовый сигнал описывают только на P-выводе – второй тактовый сигнал на той же цепи даст ложные междоменные проверки.', 'This is the N pin of a differential pair. The clock is defined only on the P pin: a second clock on the same net produces false clock domain crossing checks.');
      else if (s0 && s0.kind === 'pin' && s0.cell.lib.pll) det = L('Тактовые сигналы на выходах MMCM/PLL Vivado выводит автоматически.', 'Vivado derives the clocks at MMCM/PLL outputs automatically.');
      else if (s0 && s0.kind === 'pin' && /BUFG/.test(s0.cell.ref)) det = L('Тактовый сигнал нужно задавать на входном порту, а не на выходе BUFG: иначе теряется задержка входного буфера и тактового дерева.', 'Define the clock on the input port, not at the BUFG output: otherwise the delay of the input buffer and the clock tree is lost.');
      if (u.type === 'auto') continue;
      F.add('error', 'clock', L(`Лишний тактовый сигнал «${u.name}» на «${where}»`, `Extra clock '${u.name}' on '${where}'`), det, { lines: [u.def && u.def.line].filter(Boolean) });
      root.badUClocks.add(u.name);
    }
    // ненужные виртуальные тактовые сигналы
    for (const u of Au.clocks.list) {
      if (u.type !== 'virtual' || M.u2r.has(u.name) || !(u.def && u.def.src === 'user')) continue;
      const used = [...Su.db.io.values()].some((io) => io.in.concat(io.out).some((e) => e.clock === u.name));
      if (!used) F.add('info', 'clock', L(`Виртуальный тактовый сигнал «${u.name}» нигде не используется`, `Virtual clock '${u.name}' is not used anywhere`), '');
    }
  }
  function explainWrongPoint(u, r) {
    const s0 = (u.sources || [])[0];
    if (s0 && s0.kind === 'pin' && /BUF/.test(s0.cell.ref)) return L('Первичный тактовый сигнал задают на порту ПЛИС, где сигнал входит в микросхему. Тактовый сигнал, определённый на выходе буфера, не учитывает задержку IBUF/BUFG, и анализ входных интерфейсов становится неточным.', 'A primary clock is defined on the FPGA port where the signal enters the chip. A clock defined at a buffer output ignores the IBUF/BUFG delay, and the analysis of input interfaces becomes inaccurate.');
    if (s0 && s0.kind === 'port' && s0.net && s0.net.members.some((m) => m.kind === 'pin' && m.base === 'IB')) return L('Это N-вывод дифференциальной пары. Тактовый сигнал задают на P-выводе (порт, подключённый ко входу I буфера IBUFDS).', 'This is the N pin of a differential pair. The clock is defined on the P pin (the port connected to input I of the IBUFDS buffer).');
    return L('Проверьте, на какой объект указывает get_ports/get_pins.', 'Check which object get_ports/get_pins points to.');
  }

  // ---------------------------------------------------------------------------
  // Слой: какие тактовые сигналы приходят на регистры
  // ---------------------------------------------------------------------------
  function checkClockProp(F, Su, Au, Ar, M, root, equiv) {
    const D = Su.design;
    const groups = new Map();
    for (const c of D.cells.values()) {
      if (!c.lib.seq) continue;
      const cp = c.pins.get(c.lib.clk);
      if (!cp) continue;
      const k = objKey(cp);
      const ru = Ar.clocks.pin.get(k), uu = Au.clocks.pin.get(k);
      const rn = ru ? [...ru.keys()] : [], un = uu ? [...uu.keys()] : [];
      const missing = rn.filter((r) => !un.some((u) => equiv(u, r)));
      const extra = un.filter((u) => !rn.some((r) => equiv(u, r)));
      if (!missing.length && !extra.length) continue;
      if (missing.every((r) => root.badClocks.has(r)) && extra.every((u) => root.badUClocks.has(u))) continue;
      let sig;
      if (!un.length) sig = `none|${rn.join(',')}`;
      else sig = `diff|${missing.join(',')}|${extra.join(',')}`;
      if (!groups.has(sig)) groups.set(sig, { cells: [], rn, un, missing, extra });
      groups.get(sig).cells.push(c.name);
      root.badRegs.add(c.name);
    }
    for (const g of groups.values()) {
      const names = U.compressNames(g.cells);
      if (!g.un.length) {
        F.add('error', 'clockprop', L(`Регистры без тактового сигнала: ${names}`, `Registers without a clock: ${names}`),
          L(`На тактовые входы этих регистров не приходит ни один тактовый сигнал (ожидается: ${g.rn.join(', ')}). Пути к ним и от них не анализируются (check_timing: no_clock). Обычно не хватает create_generated_clock (делитель частоты, вывод тактового сигнала наружу) или тактовый сигнал определён не в той точке.`, `No clock reaches the clock inputs of these registers (expected: ${g.rn.join(', ')}). Paths to and from them are not analyzed (check_timing: no_clock). Usually a create_generated_clock is missing (frequency divider, clock forwarded off-chip) or the clock is defined at the wrong point.`));
      } else {
        F.add('error', 'clockprop', L(`Регистры ${names}: неверный набор тактовых сигналов`, `Registers ${names}: wrong set of clocks`),
          L(`Приходят: ${g.un.join(', ')}`, `Arriving clocks: ${g.un.join(', ')}`) + (g.missing.length ? L(`; не хватает: ${g.missing.join(', ')}`, `; missing: ${g.missing.join(', ')}`) : '') + (g.extra.length ? L(`; лишние: ${g.extra.join(', ')}`, `; extra: ${g.extra.join(', ')}`) : ''));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Слой: задержки ввода/вывода
  // ---------------------------------------------------------------------------
  function checkIO(F, q, Su, Sr, Au, Ar, M, root, equiv) {
    const ports = new Set([...Su.db.io.keys(), ...Sr.db.io.keys()]);
    const groups = new Map();
    const addG = (sig, port, f) => {
      if (!groups.has(sig)) groups.set(sig, Object.assign({ ports: [] }, f));
      groups.get(sig).ports.push(port);
    };
    const nameU = (c) => c || L('(без тактового сигнала)', '(no clock)');
    for (const pn of ports) {
      const iu = Su.db.io.get(pn) || { in: [], out: [], log: [] };
      const ir = Sr.db.io.get(pn) || { in: [], out: [], log: [] };
      for (const dir of ['in', 'out']) {
        const ue = iu[dir], re = ir[dir];
        if (!ue.length && !re.length) continue;
        const cmd = dir === 'in' ? 'set_input_delay' : 'set_output_delay';
        const usedU = new Set();
        for (const r of re) {
          const u = ue.find((x) => !usedU.has(x) && x.fall === r.fall && equiv(x.clock, r.clock));
          if (!u) {
            // кандидат: тот же фронт, другой тактовый сигнал
            const other = ue.find((x) => !usedU.has(x) && x.fall === r.fall);
            let det = '', key;
            const ow = iu.log.find((l) => l.overwrote && l.overwrote.fall === r.fall && equiv(l.overwrote.clock, r.clock));
            if (ow) {
              det = L(`Задержка была задана (строка ${ow.overwrote.line}), но команда в строке ${ow.line} без -add_delay её перезаписала. Если на порту несколько задержек (фронт и спад, разные тактовые сигналы), все последующие команды пишут с -add_delay.`, `The delay was set (line ${ow.overwrote.line}), but the command on line ${ow.line} without -add_delay overwrote it. When a port has several delays (rising and falling edge, different clocks), write all subsequent commands with -add_delay.`);
              key = `ow|${dir}|${r.fall}|${r.clock}`;
              addG(key, pn, { sev: 'error', title: L(`${cmd}: задержка относительно ${edgeRu(r.fall ? 'fall' : 'rise')} тактового сигнала «${r.clock}» перезаписана (нет -add_delay)`, `${cmd}: the delay relative to the ${edgeRu(r.fall ? 'fall' : 'rise')} of clock '${r.clock}' was overwritten (no -add_delay)`), det, lines: [ow.line] });
              root.badPorts.add(pn);
              continue;
            }
            if (other && !root.badClocks.has(r.clock)) {
              key = `clk|${dir}|${r.fall}|${r.clock}|${other.clock}`;
              const oc = Au.clocks.clocks.get(other.clock), rc = Ar.clocks.clocks.get(r.clock);
              if (q.check && q.check.requireVirtual && rc && rc.type === 'virtual' && oc && oc.type !== 'virtual') {
                det = L(`Задержка задана относительно тактового сигнала «${other.clock}», а в этой задаче её отсчитывают от виртуального тактового сигнала (в эталоне «${r.clock}»): он описывает фронты на регистрах внешней стороны, которые не совпадают с фронтом на тактовом порту.`, `The delay is specified relative to clock '${other.clock}', but in this task it is referenced to a virtual clock ('${r.clock}' in the reference solution): it describes the edges at the registers of the external device, which do not coincide with the edge at the clock port.`);
              } else det = L(`Задержка задана относительно тактового сигнала «${other.clock}», а данные на этом порту ${dir === 'in' ? 'запускаются' : 'захватываются'} тактовым сигналом, эквивалентным «${r.clock}».`, `The delay is specified relative to clock '${other.clock}', but the data on this port is ${dir === 'in' ? 'launched' : 'captured'} by a clock equivalent to '${r.clock}'.`);
              if (oc && Ar.clocks.clocks.get(r.clock) && !sameWave(oc, Ar.clocks.clocks.get(r.clock))) det += L(` (у «${other.clock}» другая форма: ${waveStr(oc)})`, ` ('${other.clock}' has a different waveform: ${waveStr(oc)})`);
              addG(key, pn, { sev: 'error', title: L(`${cmd}: неверный опорный тактовый сигнал`, `${cmd}: wrong reference clock`), det, lines: [other.maxLine || other.minLine].filter(Boolean) });
              usedU.add(other);
              root.badPorts.add(pn);
              continue;
            }
            if (root.badClocks.has(r.clock)) { root.badPorts.add(pn); continue; }
            key = `miss|${dir}|${r.fall}|${r.clock}`;
            // порт исключён ложным путём: вместе с задержкой пропадают все проверки путей через него
            const fp = Su.db.exceptions.find((e) => e.type === 'false' && e.src === 'user' && (dir === 'in' ? e.from : e.to) && (dir === 'in' ? e.from : e.to).objs.has('port:' + pn));
            addG(key, pn, {
              sev: 'error', title: L(`Нет ${cmd} относительно ${edgeRu(r.fall ? 'fall' : 'rise')} тактового сигнала «${r.clock}»`, `No ${cmd} relative to the ${edgeRu(r.fall ? 'fall' : 'rise')} of clock '${r.clock}'`),
              det: fp ? L(`Порт исключён командой set_false_path (строка ${fp.line}): пути через него не анализируются совсем, хотя в эталоне они ограничены задержкой ${dir === 'in' ? 'ввода' : 'вывода'}.`, `The port is excluded by set_false_path (line ${fp.line}): paths through it are not analyzed at all, although in the reference solution they are constrained by an ${dir === 'in' ? 'input' : 'output'} delay.`)
                : r.fall ? L('Для DDR и интерфейсов, работающих по спаду, нужна задержка с -clock_fall (и -add_delay, если на порту уже есть задержка относительно фронта).', 'DDR interfaces and interfaces working on the falling edge need a delay with -clock_fall (and -add_delay if the port already has a delay relative to the rising edge).') : L('Без задержки ввода/вывода путь через этот порт не ограничен по времени.', 'Without an input/output delay, the path through this port is unconstrained.'),
              lines: fp ? [fp.line] : undefined,
              expected: `${r.max !== null ? '-max ' + U.fmtShort(r.max) : ''}${r.min !== null ? ' -min ' + U.fmtShort(r.min) : ''}`.trim(),
            });
            root.badPorts.add(pn);
            continue;
          }
          usedU.add(u);
          for (const t of ['max', 'min']) {
            const rv = r[t], uv = u[t];
            const edgeTxt = L(`${r.fall ? 'спада' : 'фронта'} «${nameU(u.clock)}»`, `${r.fall ? 'falling' : 'rising'} edge of '${nameU(u.clock)}'`);
            if (rv === null && uv === null) continue;
            if (rv !== null && uv === null) {
              // значение было, но его стёрла команда без -add_delay для другого фронта или тактового сигнала
              const owH = iu.log.find((l) => l.overwrote && l.overwrote.type === t && l.overwrote.fall === r.fall && equiv(l.overwrote.clock, r.clock));
              if (owH) {
                addG(`owh|${dir}|${r.fall}|${t}|${r.clock}`, pn, { sev: 'error', title: L(`${cmd} относительно ${edgeTxt}: значение -${t} перезаписано (нет -add_delay)`, `${cmd} relative to the ${edgeTxt}: the -${t} value was overwritten (no -add_delay)`),
                  det: L(`Значение -${t} было задано в строке ${owH.overwrote.line}, но команда в строке ${owH.line} без -add_delay его стёрла: без -add_delay новая задержка заменяет все прежние задержки того же вида (-max или -min) на порту. Если на порту несколько задержек (фронт и спад, разные тактовые сигналы), все последующие команды пишут с -add_delay.`, `The -${t} value was set on line ${owH.overwrote.line}, but the command on line ${owH.line} without -add_delay erased it: without -add_delay a new delay replaces all previous delays of the same kind (-max or -min) on the port. When a port has several delays (rising and falling edge, different clocks), write all subsequent commands with -add_delay.`),
                  lines: [owH.line], expected: U.fmtShort(rv) });
                root.badPorts.add(pn);
                continue;
              }
              addG(`nohalf|${dir}|${r.fall}|${t}|${r.clock}`, pn, { sev: 'error', title: L(`${cmd} относительно ${edgeTxt}: нет значения -${t}`, `${cmd} relative to the ${edgeTxt}: no -${t} value`),
                det: t === 'max' ? L('Без -max не выполняется проверка предустановки (setup): не задан самый поздний момент появления данных.', 'Without -max, the setup check is not performed: the latest data arrival time is not specified.') : L('Без -min не выполняется проверка удержания (hold): не задан самый ранний момент изменения данных. check_timing сообщит partial_input_delay или partial_output_delay.', 'Without -min, the hold check is not performed: the earliest data change time is not specified. check_timing reports partial_input_delay or partial_output_delay.'),
                expected: U.fmtShort(rv) });
              root.badPorts.add(pn);
              continue;
            }
            if (rv === null && uv !== null) {
              addG(`extrahalf|${dir}|${r.fall}|${t}`, pn, { sev: 'error', title: L(`${cmd} относительно ${edgeTxt}: лишнее значение -${t}`, `${cmd} relative to the ${edgeTxt}: extra -${t} value`), det: '', lines: [u[t + 'Line']] });
              root.badPorts.add(pn);
              continue;
            }
            if (!U.approxEq(uv, rv, TOL)) {
              let hint = '';
              if (U.approxEq(uv, rv.neg(), TOL)) hint = L('Похоже, ошибка в знаке.', 'Looks like a sign error.');
              else if (r[t === 'max' ? 'min' : 'max'] !== null && U.approxEq(uv, r[t === 'max' ? 'min' : 'max'], TOL)) hint = L('Похоже, перепутаны -max и -min.', 'Looks like -max and -min are swapped.');
              else if (dir === 'in' && t === 'min') hint = L('-min = самое раннее изменение данных после фронта (Tco_min + минимальные задержки), для интерфейсов с выравниванием данных по фронту обычно отрицательно.', '-min = the earliest data change after the clock edge (Tco_min + minimum delays); for edge-aligned interfaces it is usually negative.');
              else if (dir === 'in' && t === 'max') hint = L('-max = самое позднее появление данных после фронта (Tco_max + максимальные задержки трассы).', '-max = the latest data arrival after the clock edge (Tco_max + maximum trace delays).');
              else if (dir === 'out' && t === 'max') hint = L('-max = Tsu приёмника + максимальная задержка трассы данных (− опережение тактового сигнала).', '-max = receiver Tsu + maximum data trace delay (− clock trace delay).');
              else if (dir === 'out' && t === 'min') hint = L('-min = −Th приёмника + минимальная задержка трассы (обычно отрицательное число).', '-min = −Th of the receiver + minimum trace delay (usually a negative number).');
              addG(`val|${dir}|${r.fall}|${t}|${fmt(uv)}|${fmt(rv)}`, pn, { sev: 'error', title: L(`${cmd} -${t} относительно ${edgeTxt}: ${fmt(uv)} нс – неверно`, `${cmd} -${t} relative to the ${edgeTxt}: ${fmt(uv)} ns is wrong`), det: hint, expected: L(`${fmt(rv)} нс`, `${fmt(rv)} ns`), lines: [u[t + 'Line']] });
              root.badPorts.add(pn);
            }
          }
        }
        for (const u of ue) {
          if (usedU.has(u)) continue;
          if (u.maxSrc && u.maxSrc !== 'user' && u.minSrc && u.minSrc !== 'user') continue;
          let det = L('В эталоне такой задержки нет.', 'The reference solution has no such delay.');
          if (u.fall) det = L('Задержка относительно спада тактового сигнала нужна только для DDR-интерфейсов или если данные запускаются/захватываются по спаду.', 'A delay relative to the falling clock edge is needed only for DDR interfaces or when data is launched/captured on the falling edge.');
          if (!u.clock) det = L('Задержка задана без -clock – она ни к чему не привязана.', 'The delay is specified without -clock: it is not tied to anything.');
          else if (q.check && q.check.requireVirtual && re.some((r) => { const c = Ar.clocks.clocks.get(r.clock); return c && c.type === 'virtual'; })) {
            const uc = Au.clocks.clocks.get(u.clock);
            if (uc && uc.type !== 'virtual') det = L('В этой задаче задержку на порту отсчитывают от виртуального тактового сигнала (create_clock -name … -period … без объектов), а не от тактового сигнала на порту проекта.', 'In this task the port delay is referenced to a virtual clock (create_clock -name … -period … with no objects), not to a clock on a design port.');
          }
          addG(`extra|${dir}|${u.fall}|${u.clock}`, pn, { sev: 'error', title: L(`Лишняя ${cmd} относительно ${edgeRu(u.fall ? 'fall' : 'rise')} «${nameU(u.clock)}»`, `Extra ${cmd} relative to the ${edgeRu(u.fall ? 'fall' : 'rise')} of '${nameU(u.clock)}'`), det, lines: [u.maxLine || u.minLine].filter(Boolean) });
          root.badPorts.add(pn);
        }
      }
    }
    for (const g of groups.values()) {
      F.add(g.sev, 'io', `${g.title}`, L(`Порты: ${U.compressNames(g.ports)}.`, `Ports: ${U.compressNames(g.ports)}.`) + (g.det ? ' ' + g.det : ''), { lines: U.uniq((g.lines || []).filter(Boolean)), expected: g.expected });
    }
  }

  // ---------------------------------------------------------------------------
  // Слой: эффективные требования по путям
  // ---------------------------------------------------------------------------
  function evKey(ev) { return ev.clock ? `${ev.clock}:${ev.edge}` : `-:${ev.why || ''}`; }
  function pathDiffs(F, q, Su, Sr, Au, Ar, M, root, equiv) {
    // проверка пользователя x и проверка эталона y – одна и та же пара событий
    const sameEv = (x, y) => x.L.edge === y.L.edge && x.C.edge === y.C.edge && equiv(x.L.clock, y.L.clock) && equiv(x.C.clock, y.C.clock);
    // x[t] – нестрогая: в своём списке есть более строгая проверка того же пути с тем же фронтом запуска, и в другом анализе
    // она тоже включена с тем же требованием (other(y) находит пару для y в другом анализе)
    const relaxedKept = (list, x, t, other) => list.some((y) => {
      if (y === x || !y[t].on || !x[t].on || y.L.edge !== x.L.edge || y.L.clock !== x.L.clock || y.C.clock !== x.C.clock || y.C.edge === x.C.edge) return false;
      const tighter = t === 'setup' ? y[t].budget.le(x[t].budget) : x[t].budget.le(y[t].budget);
      if (!tighter) return false;
      const z = other(y);
      return !!(z && z[t].on && U.approxEq(z[t].req, y[t].req, TOL) && U.approxEq(z[t].budget, y[t].budget, TOL));
    });
    const byKeyU = new Map(), byKeyR = new Map();
    for (const ch of Au.checks) { const k = ch.path.key; if (!byKeyU.has(k)) byKeyU.set(k, []); byKeyU.get(k).push(ch); }
    for (const ch of Ar.checks) { const k = ch.path.key; if (!byKeyR.has(k)) byKeyR.set(k, []); byKeyR.get(k).push(ch); }
    const groups = new Map();
    let suppressed = 0, compared = 0;
    const addG = (sig, ch, info) => {
      if (!groups.has(sig)) groups.set(sig, Object.assign({ starts: [], ends: [], n: 0 }, info));
      const g = groups.get(sig);
      g.starts.push(ch.path.startName); g.ends.push(ch.path.endName); g.n++;
    };
    const keys = new Set([...byKeyU.keys(), ...byKeyR.keys()]);
    for (const k of keys) {
      const lu = byKeyU.get(k) || [], lr = byKeyR.get(k) || [];
      const used = new Set();
      for (const r of lr) {
        const u = lu.find((x) => !used.has(x) && x.L.edge === r.L.edge && x.C.edge === r.C.edge && equiv(x.L.clock, r.L.clock) && equiv(x.C.clock, r.C.clock));
        const p = r.path;
        const portS = p.start.kind === 'port' ? p.start.obj.name : null;
        const portE = p.end.kind === 'port' ? p.end.obj.name : null;
        const rootCause = (portS && root.badPorts.has(portS)) || (portE && root.badPorts.has(portE)) ||
          root.badClocks.has(r.L.clock) || root.badClocks.has(r.C.clock) ||
          (p.start.kind === 'reg' && root.badRegs.has(p.start.cell.name)) || (p.end.kind === 'pin' && root.badRegs.has(p.end.cell.name));
        if (!u) {
          if (rootCause) { suppressed++; continue; }
          if (!r.setup.on && !r.hold.on) continue;
          addG(`missing|${evKey(r.L)}|${evKey(r.C)}`, r, { sev: 'error', title: L(`Отсутствует проверка ${r.L.clock || '?'} → ${r.C.clock || '?'}`, `Missing check ${r.L.clock || '?'} → ${r.C.clock || '?'}`), det: L('В эталоне путь анализируется для этой пары тактовых сигналов, а у вас – нет (проверьте тактовые сигналы и задержки).', 'In the reference solution the path is analyzed for this clock pair, but in yours it is not (check the clocks and delays).') });
          continue;
        }
        used.add(u);
        compared++;
        for (const t of ['setup', 'hold']) {
          const a = u[t], b = r[t];
          const tn = r.async ? (t === 'setup' ? L('Восстановление (recovery)', 'Recovery') : L('Снятие сброса (removal)', 'Removal')) : (t === 'setup' ? L('Предустановка (setup)', 'Setup') : L('Удержание (hold)', 'Hold'));
          if (a.on === b.on) {
            if (!a.on) {
              // оба не анализируются: явное исключение и «просто не ограничен» – не одно и то же
              const EXCL = ['false', 'async', 'exclusive', 'datapath_only'];
              const exR = EXCL.includes(b.why), exU = EXCL.includes(a.why);
              if (exR && !exU) {
                if (rootCause) { suppressed++; continue; }
                addG(`unc|${t}|${b.why}|${a.why}`, r, {
                  sev: 'error', title: L(`${tn}: путь остался без ограничений (${whyRu(a.why)})`, `${tn}: the path is left unconstrained (${whyRu(a.why)})`),
                  det: L(`В эталоне путь явно исключён из анализа (${whyRu(b.why)}), а у вас он просто не ограничен – check_timing сообщит о нём как о неограниченном, и такие пути легко пропустить. Исключите его явно.`, `In the reference solution the path is explicitly excluded from analysis (${whyRu(b.why)}), but in yours it is simply unconstrained: check_timing reports it as unconstrained, and such paths are easy to miss. Exclude it explicitly.`),
                });
              }
              continue;
            }
            const reqEq = U.approxEq(a.req, b.req, TOL);
            const budEq = U.approxEq(a.budget, b.budget, TOL);
            if (reqEq && budEq) continue;
            if (rootCause) { suppressed++; continue; }
            if (reqEq && !budEq) { suppressed++; continue; }
            const pair = `${u.L.clock}:${u.L.edge}→${u.C.clock}:${u.C.edge}`;
            let title = L(`${tn}: требование ${fmt(a.req)} нс вместо ожидаемого`, `${tn}: requirement ${fmt(a.req)} ns instead of the expected value`), det = '';
            if (t === 'hold' && a.src === 'mcp_setup' && b.src === 'mcp') {
              title = L(`Удержание (hold): не задан set_multicycle_path -hold (требование ${fmt(a.req)} нс)`, `Hold: set_multicycle_path -hold is missing (requirement ${fmt(a.req)} ns)`);
              det = L('После set_multicycle_path N -setup проверка удержания сдвигается вместе с проверкой предустановки на N−1 тактов: путь обязан стать длиннее нескольких периодов, что почти наверняка приведёт к нарушению. Верните проверку удержания к исходному фронту командой set_multicycle_path N−1 -hold с теми же -from/-to (для разных тактовых сигналов – с правильной опцией -start или -end).', 'After set_multicycle_path N -setup, the hold check moves together with the setup check by N−1 clock cycles: the path would have to be longer than several periods, which almost certainly causes a violation. Move the hold check back to the original edge with set_multicycle_path N−1 -hold and the same -from/-to (for different clocks, with the correct -start or -end option).');
            } else if (t === 'hold' && a.src === 'mcp' && b.src === 'mcp') {
              det = L('Неверно выбран множитель проверки удержания или опорный тактовый сигнал (-start/-end). При переходе от медленного тактового сигнала к быстрому обычно нужен -end (сдвиг в периодах тактового сигнала захвата), от быстрого к медленному – -start.', 'Wrong hold multiplier or reference clock (-start/-end). From a slow clock to a fast one you usually need -end (shift in capture clock periods); from a fast clock to a slow one, -start.');
            } else if (t === 'setup' && b.src === 'mcp' && a.src === 'default') {
              title = L(`Предустановка (setup): путь не объявлен многотактным (требование ${fmt(a.req)} нс)`, `Setup: the path is not declared a multicycle path (requirement ${fmt(a.req)} ns)`);
              det = L('По условию данные остаются неизменными несколько тактов – это многотактный путь. Без set_multicycle_path САПР требует уложиться в один период.', 'According to the task, the data stays unchanged for several clock cycles: this is a multicycle path. Without set_multicycle_path the tool requires the path to fit into one period.');
            } else if (t === 'setup' && a.src === 'mcp' && b.src === 'default') {
              title = L(`Предустановка (setup): многотактный путь задан без оснований (требование ${fmt(a.req)} нс)`, `Setup: unjustified multicycle path (requirement ${fmt(a.req)} ns)`);
              det = L('Для этого пути многотактное ограничение не обосновано: данные изменяются каждый такт.', 'A multicycle constraint is not justified for this path: the data changes every clock cycle.');
            } else if (t === 'setup' && (b.src === 'max' || b.src === 'max_dp')) {
              title = a.src === 'max' || a.src === 'max_dp' ? L(`Предустановка (setup): неверное значение set_max_delay (${fmt(a.req)} нс)`, `Setup: wrong set_max_delay value (${fmt(a.req)} ns)`) : L(`Предустановка (setup): требуется set_max_delay (сейчас требование ${fmt(a.req)} нс)`, `Setup: set_max_delay is required (the current requirement is ${fmt(a.req)} ns)`);
              det = b.src === 'max_dp' ? L('Для путей между тактовыми доменами ограничивают задержку тракта данных: set_max_delay -datapath_only -from … -to … <значение>.', 'For paths between clock domains, constrain the datapath delay: set_max_delay -datapath_only -from … -to … <value>.') : '';
            } else if (t === 'setup' && a.src === 'mcp' && b.src === 'mcp') {
              det = L('Неверно выбран множитель многотактного пути или опорный тактовый сигнал (-start/-end).', 'Wrong multicycle path multiplier or reference clock (-start/-end).');
            } else if (t === 'setup' && a.src === 'default' && b.src === 'default') {
              det = L('Соотношение фронтов тактовых сигналов отличается от ожидаемого: проверьте форму тактовых сигналов (фазу, коэффициент заполнения) и фронт захвата.', 'The clock edge relationship differs from the expected one: check the clock waveforms (phase, duty cycle) and the capture edge.');
            }
            addG(`req|${t}|${pair}|${fmt(a.req)}|${fmt(b.req)}|${a.src}|${b.src}`, r, { sev: 'error', title, det, expected: L(`${fmt(b.req)} нс (${srcRu(b.src)})`, `${fmt(b.req)} ns (${srcRu(b.src)})`), lines: [lineOf(a.by)].filter(Boolean) });
            continue;
          }
          if (rootCause) { suppressed++; continue; }
          // нестрогая проверка: на том же пути для того же фронта запуска есть более строгая проверка того же вида;
          // исключить её или оставить – результат анализа от этого не меняется
          const pairTxt = (x) => L(`${x.L.clock}:${x.L.edge === 'fall' ? 'спад' : 'фронт'} → ${x.C.clock}:${x.C.edge === 'fall' ? 'спад' : 'фронт'}`, `${x.L.clock}:${x.L.edge === 'fall' ? 'fall' : 'rise'} → ${x.C.clock}:${x.C.edge === 'fall' ? 'fall' : 'rise'}`);
          if (b.on && !a.on && a.why === 'false' && relaxedKept(lr, r, t, (y) => lu.find((x) => sameEv(x, y)))) {
            addG(`relax-off|${t}|${pairTxt(r)}`, r, { sev: 'info', title: L(`${tn}: исключена нестрогая проверка ${pairTxt(r)}`, `${tn}: the non-critical check ${pairTxt(r)} is excluded`), det: L('Она никогда не бывает худшей: на том же пути сохранена более строгая проверка, поэтому результат анализа не меняется.', 'It is never the worst case: the critical check is kept on the same path, so the analysis result does not change.') });
            continue;
          }
          if (!b.on && a.on && b.why === 'false' && relaxedKept(lu, u, t, (y) => lr.find((x) => sameEv(y, x)))) {
            addG(`relax-on|${t}|${pairTxt(u)}`, r, { sev: 'info', title: L(`${tn}: нестрогая проверка ${pairTxt(u)} не исключена`, `${tn}: the non-critical check ${pairTxt(u)} is not excluded`), det: L('В эталоне её исключают, чтобы не засорять отчёты, но на результат она не влияет: на том же пути есть более строгая проверка.', 'The reference solution excludes it to keep reports clean, but it does not affect the result: the same path has a critical check.') });
            continue;
          }
          if (b.on && !a.on) {
            let title, det = '';
            if (a.why === 'false') {
              title = L(`${tn}: путь ошибочно объявлен ложным (set_false_path)`, `${tn}: the path is wrongly declared a false path (set_false_path)`);
              if (b.src === 'max_dp') det = L('В эталоне этот путь не исключается, а ограничивается командой set_max_delay -datapath_only: даже между асинхронными доменами задержку тракта данных ограничивают (шина в коде Грея, синхронизатор). Ложный путь снимает это ограничение полностью.', 'In the reference solution this path is not excluded but constrained with set_max_delay -datapath_only: even between asynchronous domains the datapath delay is constrained (Gray-coded bus, synchronizer). A false path removes this constraint completely.');
              else if (b.src === 'max') det = L('В эталоне путь ограничен командой set_max_delay, а ложный путь снимает ограничение полностью. Сузьте область действия исключения (-from/-to).', 'In the reference solution the path is constrained with set_max_delay, and a false path removes the constraint completely. Narrow the scope of the exception (-from/-to).');
              else det = L('Этот путь должен анализироваться. Сузьте область действия исключения (-from/-to).', 'This path must be analyzed. Narrow the scope of the exception (-from/-to).');
            }
            else if (a.why === 'async' || a.why === 'exclusive') { title = L(`${tn}: тактовые сигналы ${u.L.clock} и ${u.C.clock} ошибочно объявлены ${a.why === 'async' ? 'асинхронными' : 'взаимоисключающими'}`, `${tn}: clocks ${u.L.clock} and ${u.C.clock} are wrongly declared ${a.why === 'async' ? 'asynchronous' : 'exclusive'}`); det = L('set_clock_groups отключает ВСЕ пути между группами (и имеет наивысший приоритет – перекрывает даже set_max_delay). Между этими тактовыми сигналами есть пути, которые должны анализироваться.', 'set_clock_groups disables ALL paths between the groups (and has the highest priority: it overrides even set_max_delay). There are paths between these clocks that must be analyzed.'); }
            else if (a.why === 'datapath_only') { title = L('Удержание (hold): проверка отключена опцией -datapath_only', 'Hold: the check is disabled by -datapath_only'); det = L('Здесь нужен обычный set_max_delay без -datapath_only (или ограничение другого типа).', 'A regular set_max_delay without -datapath_only (or a constraint of another type) is needed here.'); }
            else { title = L(`${tn}: путь не анализируется (${whyRu(a.why)})`, `${tn}: the path is not analyzed (${whyRu(a.why)})`); }
            addG(`off|${t}|${a.why}|${u.L.clock}|${u.C.clock}`, r, { sev: 'error', title, det, lines: [lineOf(a.by)].filter(Boolean) });
          } else if (!b.on && a.on) {
            let title, det = '';
            if (b.why === 'false') { title = L(`${tn}: путь должен быть исключён из анализа`, `${tn}: the path must be excluded from analysis`); det = t === 'hold' && r.setup.on ? L('В эталоне для этого пути отключена только проверка удержания (set_false_path -hold).', 'In the reference solution only the hold check is disabled for this path (set_false_path -hold).') : L('Путь асинхронный или функционально ложный: проверять его относительно тактовых сигналов не имеет смысла.', 'The path is asynchronous or functionally false: timing it against clocks makes no sense.'); }
            else if (b.why === 'async' || b.why === 'exclusive') { title = L(`${tn}: пути ${u.L.clock} → ${u.C.clock} не должны анализироваться`, `${tn}: paths ${u.L.clock} → ${u.C.clock} must not be analyzed`); det = b.why === 'async' ? L('Тактовые сигналы независимы (нет фиксированного соотношения частот и фаз). Нужны синхронизация в RTL и исключение в ограничениях (set_clock_groups -asynchronous или равноценное).', 'The clocks are independent (no fixed frequency and phase relationship). This requires synchronization in RTL and an exclusion in the constraints (set_clock_groups -asynchronous or equivalent).') : L('Эти тактовые сигналы не существуют одновременно (мультиплексор/режимы) – их пути взаимно исключены.', 'These clocks never exist at the same time (multiplexer/modes): their paths are mutually exclusive.'); }
            else if (b.why === 'datapath_only') { title = L('Удержание (hold): проверка должна быть отключена (-datapath_only)', 'Hold: the check must be disabled (-datapath_only)'); det = L('Для путей между асинхронными тактовыми доменами применяют set_max_delay -datapath_only: ограничивается задержка тракта данных, а проверка удержания между асинхронными тактовыми сигналами не имеет смысла.', 'Paths between asynchronous clock domains use set_max_delay -datapath_only: it constrains the datapath delay, and a hold check between asynchronous clocks makes no sense.'); }
            else { title = L(`${tn}: в эталоне путь не анализируется (${whyRu(b.why)})`, `${tn}: the reference solution does not analyze this path (${whyRu(b.why)})`); }
            addG(`on|${t}|${b.why}|${u.L.clock}|${u.C.clock}`, r, { sev: 'error', title, det });
          }
        }
      }
      for (const u of lu) {
        if (used.has(u)) continue;
        if (!u.setup.on && !u.hold.on) continue;
        const p = u.path;
        const portS = p.start.kind === 'port' ? p.start.obj.name : null;
        const portE = p.end.kind === 'port' ? p.end.obj.name : null;
        if ((portS && root.badPorts.has(portS)) || (portE && root.badPorts.has(portE)) || root.badUClocks.has(u.L.clock) || root.badUClocks.has(u.C.clock) ||
          (p.start.kind === 'reg' && root.badRegs.has(p.start.cell.name)) || (p.end.kind === 'pin' && root.badRegs.has(p.end.cell.name))) { suppressed++; continue; }
        addG(`extra|${evKey(u.L)}|${evKey(u.C)}`, u, { sev: 'error', title: L(`Лишняя проверка ${u.L.clock || '?'} → ${u.C.clock || '?'}`, `Extra check ${u.L.clock || '?'} → ${u.C.clock || '?'}`), det: L('Этой пары тактовых сигналов на пути быть не должно (лишний тактовый сигнал или задержка).', 'This clock pair should not exist on the path (an extra clock or delay).') });
      }
    }
    for (const g of groups.values()) {
      const st = U.compressNames(U.uniq(g.starts), 4), en = U.compressNames(U.uniq(g.ends), 4);
      F.add(g.sev, 'path', g.title, L(`Пути: ${st} → ${en} (${g.n} ${U.plural(g.n, 'проверка', 'проверки', 'проверок')}).`, `Paths: ${st} → ${en} (${g.n} ${g.n === 1 ? 'check' : 'checks'}).`) + (g.det ? ' ' + g.det : ''), { lines: U.uniq(g.lines || []), expected: g.expected });
    }
    return { suppressed, compared };
  }

  // ---------------------------------------------------------------------------
  // Слой: свойства (set_property)
  // ---------------------------------------------------------------------------
  function normVal(v) {
    const s = String(v).trim().toUpperCase();
    if (s === '1' || s === 'TRUE' || s === 'YES') return 'TRUE';
    if (s === '0' || s === 'FALSE' || s === 'NO') return 'FALSE';
    return s;
  }
  function finalProps(S, srcs) {
    const m = new Map();
    for (const p of S.db.props) {
      if (!srcs.includes(p.src)) continue;
      m.set(p.key + '|' + p.prop, p);
    }
    return m;
  }
  function checkProps(F, q, Su, Sr) {
    const ru = finalProps(Sr, ['user']), uu = finalProps(Su, ['user']);
    const groups = new Map();
    const addG = (sig, name, info) => { if (!groups.has(sig)) groups.set(sig, Object.assign({ names: [] }, info)); groups.get(sig).names.push(name); };
    for (const [k, r] of ru) {
      const u = uu.get(k);
      if (!u) {
        addG(`miss|${r.prop}|${normVal(r.value)}`, r.name, { sev: 'error', title: L(`Не задано свойство ${r.prop}`, `Property ${r.prop} is not set`), expected: r.value });
        continue;
      }
      if (normVal(u.value) !== normVal(r.value)) {
        addG(`val|${r.prop}|${normVal(u.value)}|${normVal(r.value)}`, r.name, { sev: 'error', title: L(`${r.prop} = ${u.value} – неверно`, `${r.prop} = ${u.value} is wrong`), expected: r.value, lines: [u.line] });
      }
    }
    const strict = q.check && q.check.strictProps;
    // допустимые лишние свойства с известными значениями: check.allowProps = { объект: { СВОЙСТВО: значение } }
    const allow = (q.check && q.check.allowProps) || {};
    const rList = [...ru.values()];
    for (const [k, u] of uu) {
      if (ru.has(k)) continue;
      const al = allow[u.name] && allow[u.name][u.prop];
      if (al !== undefined) {
        if (normVal(u.value) !== normVal(al)) addG(`allow|${u.prop}|${normVal(u.value)}|${normVal(al)}`, u.name, { sev: 'error', title: L(`${u.prop} = ${u.value} – неверно`, `${u.prop} = ${u.value} is wrong`), expected: String(al), lines: [u.line] });
        continue;
      }
      // N-вывод дифференциальной пары (имя …_n): свойство задано для P-вывода в эталоне
      const m = /^(.*)_([nN])(\[\d+\])?$/.exec(u.name);
      const rp = m ? rList.find((r) => r.name === `${m[1]}_${m[2] === 'n' ? 'p' : 'P'}${m[3] || ''}` && r.prop === u.prop) : null;
      if (rp && u.prop === 'PACKAGE_PIN') {
        addG(`diffpin`, u.name, { sev: 'warn', title: L('PACKAGE_PIN задан и для N-вывода дифференциальной пары', 'PACKAGE_PIN is also set for the N pin of the differential pair'), det: L('Обычно его не задают: место N-вывода однозначно следует из P-вывода, и Vivado назначит его сам. Если задаёте, это должен быть именно N-вывод той же пары, иначе размещение завершится ошибкой.', 'It is usually not set: the location of the N pin follows unambiguously from the P pin, and Vivado assigns it automatically. If you set it, it must be the N pin of the same pair, otherwise placement fails.'), lines: [u.line] });
        continue;
      }
      if (rp && normVal(u.value) !== normVal(rp.value)) {
        addG(`diffval|${u.prop}|${normVal(u.value)}`, u.name, { sev: 'error', title: L(`${u.prop} N-вывода (${u.value}) не совпадает с P-выводом`, `${u.prop} of the N pin (${u.value}) does not match the P pin`), det: L('Оба вывода дифференциальной пары принадлежат одному буферу, поэтому их свойства обязаны совпадать.', 'Both pins of a differential pair belong to the same buffer, so their properties must match.'), expected: rp.value, lines: [u.line] });
        continue;
      }
      if (rp) {
        addG(`diffsame|${u.prop}`, u.name, { sev: 'info', title: L(`${u.prop} задано и для N-вывода`, `${u.prop} is also set for the N pin`), det: L('Это допустимо: значение совпадает с P-выводом (так поступают многие файлы ограничений плат).', 'This is acceptable: the value matches the P pin (many board constraint files do this).'), lines: [u.line] });
        continue;
      }
      addG(`extra|${u.prop}`, u.name, { sev: strict ? 'error' : 'info', title: L(`Свойство ${u.prop} задано, хотя в эталоне его нет`, `Property ${u.prop} is set, although the reference solution does not set it`), lines: [u.line] });
    }
    for (const g of groups.values()) {
      F.add(g.sev, 'prop', g.title, L(`Объекты: ${U.compressNames(g.names)}.`, `Objects: ${U.compressNames(g.names)}.`) + (g.det ? ' ' + g.det : ''), { lines: (g.lines || []).filter(Boolean), expected: g.expected });
    }
  }

  // ---------------------------------------------------------------------------
  // Слой: прочие параметры (неопределённость, латентность, окружение ASIC …)
  // ---------------------------------------------------------------------------
  const MISC_RU = {
    uncertainty: 'set_clock_uncertainty', latency: 'set_clock_latency', transition: 'set_clock_transition', jitter: 'set_input_jitter', sysjitter: 'set_system_jitter',
    propagated: 'set_propagated_clock', load: 'set_load', drive: 'set_drive', driving_cell: 'set_driving_cell', input_transition: 'set_input_transition',
    max_transition: 'set_max_transition', max_fanout: 'set_max_fanout', max_capacitance: 'set_max_capacitance', min_capacitance: 'set_min_capacitance',
    ideal_network: 'set_ideal_network', dont_touch_network: 'set_dont_touch_network', case: 'set_case_analysis', disable: 'set_disable_timing',
    bus_skew: 'set_bus_skew', gating: 'set_clock_gating_check',
  };
  // параметры окружения, которые задаются для конкретных портов: лишний порт – ошибка
  const PORT_ENV = ['load', 'drive', 'driving_cell', 'input_transition'];
  function miscMap(S, mapClock) {
    const out = new Map();
    const put = (kind, key, value, line, src) => { if (src !== 'user') return; if (!out.has(kind)) out.set(kind, new Map()); out.get(kind).set(key, { value, line }); };
    const mc = (s) => s.split('>').map((x) => mapClock(x)).join('>');
    for (const e of S.db.uncertainty) put('uncertainty', (e.clock ? mapClock(e.clock) : (e.from ? mc(e.key) : e.key)) + '|' + e.type, e.value, e.line, e.src);
    const virt = (c) => { const k = S.clocks().clocks.get(c); return !!(k && k.type === 'virtual'); };
    for (const e of S.db.latency) {
      const [c, ...rest] = e.key.split('|');
      // у виртуального тактового сигнала нет дерева: задержка -source и сетевая задержка равноценны
      if (virt(c) && rest[0] === 'source') rest[0] = 'network';
      put('latency', [mapClock(c), ...rest].join('|'), e.value, e.line, e.src);
    }
    for (const e of S.db.transition) { const [c, ...rest] = e.key.split('|'); put('transition', [mapClock(c), ...rest].join('|'), e.value, e.line, e.src); }
    for (const e of S.db.jitter) put('jitter', mapClock(e.key), e.value, e.line, e.src);
    if (S.db.sysJitter) put('sysjitter', 'design', S.db.sysJitter.value, S.db.sysJitter.line, S.db.sysJitter.src);
    for (const e of S.db.misc) put(e.mkind, e.key, e.value, e.line, e.src);
    for (const [k, e] of S.db.caseAnalysis) put('case', k, e.value, e.line, 'user');
    // вывод регистра (D, C) и сама ячейка – одна и та же точка пути
    const cellOf = (k) => (k.startsWith('pin:') && k.includes('/') ? 'cell:' + k.slice(4, k.lastIndexOf('/')) : k);
    const side = (sp) => (sp ? U.uniq([...[...sp.objs].map(cellOf), ...sp.clocks]).sort().join(',') : '');
    for (const e of S.db.busSkew) {
      const k = [side(e.from), side(e.to)].join('>');
      put('bus_skew', k, e.value, e.line, e.src);
    }
    for (const k of S.db.propagated) put('propagated', mapClock(k), '1', 0, 'user');
    return out;
  }
  function checkMisc(F, q, Su, Sr, M) {
    const caseSrc = (S) => { const m = new Map(); for (const [k, e] of S.db.caseAnalysis) m.set(k, e); return m; };
    // case analysis: учитываем только заданное пользователем (given тоже может задавать)
    const rMap = miscMap(Sr, (c) => c);
    const uMap = miscMap(Su, (c) => M.u2r.get(c) || ('?' + c));
    // case analysis считаем по итоговому состоянию (без разделения на источники)
    const kinds = new Set([...rMap.keys()]);
    for (const kind of kinds) {
      const r = rMap.get(kind) || new Map(), u = uMap.get(kind) || new Map();
      const miss = [], wrong = [];
      for (const [k, rv] of r) {
        const uv = u.get(k);
        if (!uv) { miss.push({ k, rv }); continue; }
        const eq = (rv.value instanceof Frac || typeof rv.value === 'object') ? U.approxEq(uv.value, rv.value, TOL) : normVal(uv.value) === normVal(rv.value);
        if (!eq) wrong.push({ k, rv, uv });
      }
      const pretty = (k) => k.replace(/(port|pin|cell|net):/g, '').replace(/\|(min|max|early|late|rise|fall|setup|hold|source|network)\b/g, (m) => m.replace('|', ' ')).replace(/\|/g, ' ').trim();
      const objOf = (k) => k.split('|')[0].replace(/(port|pin|cell|net):/g, '');
      const vs = (v) => (v instanceof Frac ? U.fmtShort(v) : String(v));
      if (miss.length) {
        const byVal = new Map();
        for (const x of miss) { const v = vs(x.rv.value); if (!byVal.has(v)) byVal.set(v, []); byVal.get(v).push(x); }
        const objs = U.uniq(miss.map((x) => objOf(x.k)));
        F.add('error', 'misc', L(`Не задано: ${MISC_RU[kind] || kind}`, `Not set: ${MISC_RU[kind] || kind}`), L(`Для: ${U.compressNames(objs, 6)}.`, `For: ${U.compressNames(objs, 6)}.`),
          { expected: [...byVal].slice(0, 4).map(([v, xs]) => `${U.compressNames(U.uniq(xs.map((x) => pretty(x.k))), 3)}: ${v}`).join('; ') });
      }
      const wg = new Map();
      for (const w of wrong) {
        const key = vs(w.uv.value) + '\u0000' + vs(w.rv.value);
        if (!wg.has(key)) wg.set(key, { u: vs(w.uv.value), r: vs(w.rv.value), objs: [], lines: [] });
        const g = wg.get(key); g.objs.push(objOf(w.k)); if (w.uv.line) g.lines.push(w.uv.line);
      }
      for (const g of wg.values()) {
        F.add('error', 'misc', L(`${MISC_RU[kind] || kind}: неверное значение ${g.u}`, `${MISC_RU[kind] || kind}: wrong value ${g.u}`), L(`Для: ${U.compressNames(U.uniq(g.objs), 6)}.`, `For: ${U.compressNames(U.uniq(g.objs), 6)}.`), { lines: U.uniq(g.lines), expected: g.r });
      }
      // объекты, для которых в эталоне эта команда не задаётся
      const extra = [...u].filter(([k]) => !r.has(k));
      if (extra.length) {
        const objs = U.uniq(extra.map(([k]) => objOf(k).replace(/^\?/, '')));
        const lines = U.uniq(extra.map(([, v]) => v.line).filter(Boolean));
        if (PORT_ENV.includes(kind)) {
          F.add('error', 'misc', L(`Лишняя ${MISC_RU[kind] || kind}`, `Extra ${MISC_RU[kind] || kind}`), L(`Для: ${U.compressNames(objs, 6)}. В эталоне для этих портов команда не задаётся – перечитайте условие: какие порты она должна охватывать.`, `For: ${U.compressNames(objs, 6)}. The reference solution does not apply this command to these ports: reread the task to see which ports it must cover.`), { lines });
        } else {
          F.add('warn', 'misc', L(`${MISC_RU[kind] || kind}: задано и для объектов, которых нет в эталоне`, `${MISC_RU[kind] || kind}: also set for objects that are not in the reference solution`), L(`Для: ${U.compressNames(objs, 6)}.`, `For: ${U.compressNames(objs, 6)}.`), { lines });
        }
      }
    }
    for (const [kind, u] of uMap) {
      if (rMap.has(kind)) continue;
      if (kind === 'propagated' && Su.tool === 'vivado') continue;
      F.add('info', 'misc', L(`${MISC_RU[kind] || kind}: в эталоне не используется`, `${MISC_RU[kind] || kind}: not used in the reference solution`), L('Это не ошибка, но в данной задаче команда не требуется.', 'This is not an error, but this task does not require the command.'));
    }
  }

  // ---------------------------------------------------------------------------
  // Правила задачи (require / forbid)
  // ---------------------------------------------------------------------------
  function checkRules(F, q, Su) {
    const chk = q.check || {};
    const userCmds = Su.db.cmds.filter((c) => c.src === 'user');
    const has = (r) => userCmds.some((c) => c.kind === r.cmd && (!r.opt || (c.text || '').includes(r.opt)) && (!r.re || new RegExp(r.re).test(c.text || '')));
    for (const r of chk.require || []) if (!has(r)) F.add('error', 'rule', r.msg || L(`Требуется команда ${r.cmd}${r.opt ? ' ' + r.opt : ''}`, `Command ${r.cmd}${r.opt ? ' ' + r.opt : ''} is required`), r.detail || '');
    for (const r of chk.forbid || []) if (has(r)) {
      const c = userCmds.find((x) => x.kind === r.cmd && (!r.opt || (x.text || '').includes(r.opt)));
      F.add(r.sev || 'error', 'rule', r.msg || L(`Команда ${r.cmd} здесь не нужна`, `Command ${r.cmd} is not needed here`), r.detail || '', { lines: [c && c.line].filter(Boolean) });
    }
  }

  // ---------------------------------------------------------------------------
  // Главная функция проверки
  // ---------------------------------------------------------------------------
  const refCache = new Map();
  function refRun(q, k) {
    const sols = q.solutions || [q.solution];
    const key = q.id + '#' + k + '#' + (q._ver || 0);
    if (!refCache.has(key)) refCache.set(key, runSession(q, sols[k]));
    return refCache.get(key);
  }
  function clearCache() { refCache.clear(); }

  function compare(q, U_, R_) {
    const F = new Findings();
    const Su = U_.S, Au = U_.A, Sr = R_.S, Ar = R_.A;
    // ошибки выполнения
    for (const m of Su.messages) {
      if (m.src === 'user') {
        if (m.sev === 'error' || m.sev === 'crit') F.add('error', 'syntax', m.text, '', { lines: [m.line] });
        else if (m.sev === 'warn') F.add('warn', 'syntax', m.text, '', { lines: [m.line] });
        else F.add('info', 'syntax', m.text, '', { lines: [m.line] });
      } else if (m.src === 'after' && (m.sev === 'error' || m.sev === 'crit')) {
        F.add('error', 'syntax', XT.L('Ограничения проекта, выполняемые после вашего кода, завершились с ошибкой: ', 'Project constraints that run after your code failed: ') + m.text,
          XT.L('Блок «после вашего кода» – это команды проекта, которые ссылаются на ваши объекты (например, на тактовый сигнал по имени). Вероятнее всего, имя тактового сигнала отличается от требуемого.', 'The "after your code" block contains project commands that refer to your objects (for example, to a clock by name). Most likely the clock name differs from the required one.'));
      }
    }
    if (U_.err || !Au) { F.add('error', 'syntax', XT.L('Анализ не выполнен: ', 'Analysis failed: ') + (U_.err ? U_.err.message : ''), ''); return F; }
    const M = matchClocks(Au, Ar);
    const equiv = makeEquiv(Au, Ar, M, !!(q.check && q.check.requireVirtual));
    const root = { badClocks: new Set(), badUClocks: new Set(), badPorts: new Set(), badRegs: new Set() };
    const L = q.check && q.check.layers ? new Set(q.check.layers) : null;
    const on = (x) => !L || L.has(x);
    if (on('clocks')) checkClocks(F, q, Su, Au, Sr, Ar, M, root);
    if (on('clocks')) checkClockProp(F, Su, Au, Ar, M, root, equiv);
    if (on('io')) checkIO(F, q, Su, Sr, Au, Ar, M, root, equiv);
    let ps = { suppressed: 0, compared: 0 };
    if (on('paths')) ps = pathDiffs(F, q, Su, Sr, Au, Ar, M, root, equiv);
    if (on('props')) checkProps(F, q, Su, Sr);
    if (on('misc')) checkMisc(F, q, Su, Sr, M);
    checkRules(F, q, Su);
    // неиспользованные исключения
    for (const e of Su.db.exceptions) {
      if (e.src !== 'user') continue;
      if (!Au.usedExc.has(e.id)) F.add('warn', 'exc', XT.L(`Исключение в строке ${e.line} не покрывает ни одного пути`, `The timing exception on line ${e.line} does not cover any path`), XT.L('Проверьте -from/-to: возможно, указаны не те объекты (например, выход Q вместо ячейки или тактового вывода C).', 'Check -from/-to: the objects may be wrong (for example, output Q instead of the cell or the clock pin C).'), { lines: [e.line] });
    }
    // небезопасные междоменные пути (только если их нет в эталоне)
    for (const pair of Au.issues.unsafe) {
      if (Ar.issues.unsafe.length === 0) F.add('warn', 'path', XT.L(`Небезопасный междоменный анализ: ${pair}`, `Unsafe clock domain crossing analysis: ${pair}`), XT.L('Тактовые сигналы происходят из разных первичных источников, но пути между ними анализируются как синхронные (Vivado: «Timed (unsafe)»).', 'The clocks come from different primary sources, but the paths between them are analyzed as synchronous (Vivado: "Timed (unsafe)").'));
    }
    F.meta = { suppressed: ps.suppressed, compared: ps.compared, M };
    return F;
  }

  function check(q, code) {
    const user = runSession(q, code);
    const sols = q.solutions || [q.solution];
    let best = null;
    for (let k = 0; k < sols.length; k++) {
      const ref = refRun(q, k);
      const F = compare(q, user, ref);
      const nErr = F.errors.length;
      if (!best || nErr < best.nErr) best = { F, nErr, k, ref };
      if (nErr === 0) break;
    }
    const F = best.F;
    const pass = best.nErr === 0 && (code || '').trim() !== '';
    if (!(code || '').trim()) F.add('error', 'syntax', L('Ограничения не введены', 'No constraints entered'), '');
    // сводка успехов
    const ok = [];
    if (pass) {
      const Ar = best.ref.A;
      const nClk = Ar.clocks.list.length;
      if (nClk) ok.push(nClk === 1 ? L('Тактовый сигнал совпадает с эталоном', 'The clock matches the reference solution') : L(`Тактовые сигналы (${nClk}) совпадают с эталоном`, `The clocks (${nClk}) match the reference solution`));
      const nIo = [...best.ref.S.db.io.keys()].length;
      if (nIo) ok.push(L(`Задержки ввода/вывода совпадают: ${nIo} ${U.plural(nIo, 'порт', 'порта', 'портов')}`, `Input/output delays match: ${nIo} ${nIo === 1 ? 'port' : 'ports'}`));
      if (F.meta && F.meta.compared) ok.push(L(`Требования предустановки и удержания совпадают: ${F.meta.compared} ${U.plural(F.meta.compared, 'проверка', 'проверки', 'проверок')}`, `Setup and hold requirements match: ${F.meta.compared} ${F.meta.compared === 1 ? 'check' : 'checks'}`));
      const nP = finalProps(best.ref.S, ['user']).size;
      if (nP) ok.push(L(`Свойства совпадают: ${nP}`, `Properties match: ${nP}`));
    }
    return { pass, findings: F.list, ok, user, ref: best.ref, alt: best.k, meta: F.meta };
  }

  XT.checker = { check, runSession, buildDesign, clearCache, matchClocks, makeEquiv, sameWave, refRun };
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
