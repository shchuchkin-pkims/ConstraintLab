/* ConstraintLab – отчёты для Tcl-консоли (report_clocks, check_timing, report_timing …) */
(function (XT) {
  'use strict';
  const U = XT.util;
  const T = XT.tcl;
  const fmt = U.fmt;
  const toStr = T.toStr;
  const L = XT.L;

  function table(rows, head) {
    const all = head ? [head, ...rows] : rows;
    const w = [];
    for (const r of all) r.forEach((c, i) => { w[i] = Math.max(w[i] || 0, String(c).length); });
    const line = (r) => r.map((c, i) => String(c).padEnd(w[i])).join('  ').replace(/\s+$/, '');
    const out = [];
    if (head) { out.push(line(head)); out.push(w.map((x) => '-'.repeat(x)).join('  ')); }
    for (const r of rows) out.push(line(r));
    return out.join('\n');
  }
  const TYPE_RU = { primary: L('первичный', 'primary'), virtual: L('виртуальный', 'virtual'), generated: L('производный', 'generated'), auto: L('автоматический', 'auto-derived') };

  function reportClocks(S) {
    const C = S.clocks();
    if (!C.list.length) return L('Тактовые сигналы не определены.', 'No clocks are defined.');
    const rows = C.list.map((c) => [
      c.name, fmt(c.period), `{${fmt(c.rise)} ${fmt(c.fall)}}`, (TYPE_RU[c.type] || c.type) + (c.type === 'auto' ? ` (${c.cell})` : ''),
      (c.sources || []).map((s) => s.name).join(' ') || '–', c.master || '', c.jitter ? fmt(c.jitter) : '',
    ]);
    return table(rows, [L('Тактовый сигнал', 'Clock'), L('Период', 'Period(ns)'), L('Форма', 'Waveform(ns)'), L('Тип', 'Type'), L('Источник', 'Sources'), L('Исходный', 'Master Clock'), L('Джиттер', 'Jitter')]) +
      L(`\n\nЧастоты: ${C.list.map((c) => `${c.name} = ${U.fmtShort(1000 / U.num(c.period))} МГц`).join(', ')}`, `\n\nFrequencies: ${C.list.map((c) => `${c.name} = ${U.fmtShort(1000 / U.num(c.period))} MHz`).join(', ')}`);
  }

  function interaction(S, A) {
    const pairs = new Map();
    for (const ch of A.checks) {
      if (!ch.L.clock || !ch.C.clock) continue;
      const k = ch.L.clock + '\u0000' + ch.C.clock;
      if (!pairs.has(k)) pairs.set(k, { from: ch.L.clock, to: ch.C.clock, list: [] });
      pairs.get(k).list.push(ch);
    }
    const rows = [];
    for (const p of pairs.values()) {
      const L = p.list;
      let st;
      if (L.every((c) => c.status === 'async')) st = XT.L('Асинхронные группы (Asynchronous Groups)', 'Asynchronous Groups');
      else if (L.every((c) => c.status === 'exclusive')) st = XT.L('Взаимоисключающие (Exclusive)', 'Exclusive');
      else if (L.every((c) => c.setup.why === 'false' && c.hold.why === 'false')) st = XT.L('Ложный путь (False Path)', 'False Path');
      else if (L.every((c) => c.setup.src === 'max_dp')) st = XT.L('Ограничение тракта данных (Max Delay Datapath Only)', 'Max Delay Datapath Only');
      else if (L.some((c) => c.setup.why === 'false' || c.hold.why === 'false')) st = XT.L('Частично ложный путь (Partial False Path)', 'Partial False Path');
      else st = XT.L('Анализируется (Timed)', 'Timed');
      if (/Timed|Partial/.test(st) && L.some((c) => c.unsafe && c.status === 'timed')) st = XT.L(st.replace(')', ', unsafe) – небезопасно'), st + ' (unsafe)');
      const su = L.filter((c) => c.setup.on).map((c) => U.num(c.setup.req));
      const hd = L.filter((c) => c.hold.on).map((c) => U.num(c.hold.req));
      rows.push([p.from, p.to, st, su.length ? fmt(Math.min(...su)) : '–', hd.length ? fmt(Math.max(...hd)) : '–', L.length]);
    }
    if (!rows.length) return XT.L('Нет путей между тактовыми сигналами.', 'No paths between clocks.');
    return table(rows, [XT.L('От тактового сигнала', 'From Clock'), XT.L('К тактовому сигналу', 'To Clock'), XT.L('Статус', 'Inter-Clock Constraints'), XT.L('Предустановка, нс', 'Setup Requirement (ns)'), XT.L('Удержание, нс', 'Hold Requirement (ns)'), XT.L('Проверок', 'Checks')]);
  }

  function checkTiming(S, A) {
    const I = A.issues;
    const out = [];
    const sec = (n, title, list, note) => {
      out.push(L(`${n}. ${title}: ${list.length ? list.length : 'нет'}`, `${n}. ${title}: ${list.length ? list.length : 'none'}`));
      if (list.length) out.push('   ' + U.compressNames(list.map((x) => (typeof x === 'string' ? x : x.text || x.pin || JSON.stringify(x))), 12));
      if (list.length && note) out.push('   → ' + note);
    };
    sec(1, L('no_clock (регистры без тактового сигнала)', 'no_clock (registers without a clock)'), I.noClock, L('нужен тактовый сигнал: create_clock/create_generated_clock', 'a clock is needed: create_clock/create_generated_clock'));
    sec(2, 'unconstrained_internal_endpoints', I.unconstrainedEndpoints);
    sec(3, L('no_input_delay (входы без задержки)', 'no_input_delay (inputs without a delay)'), I.noInputDelay, L('set_input_delay или set_false_path/set_max_delay', 'set_input_delay or set_false_path/set_max_delay'));
    sec(4, L('no_output_delay (выходы без задержки)', 'no_output_delay (outputs without a delay)'), I.noOutputDelay, L('set_output_delay или set_false_path/set_max_delay', 'set_output_delay or set_false_path/set_max_delay'));
    sec(5, L('partial_input_delay (только -max или -min)', 'partial_input_delay (only -max or -min)'), I.partialInput);
    sec(6, L('partial_output_delay (только -max или -min)', 'partial_output_delay (only -max or -min)'), I.partialOutput);
    const mc = I.multipleClock.filter((m) => !m.exclusive);
    out.push(L(`7. multiple_clock (несколько тактовых сигналов на выводе без исключения): ${mc.length || 'нет'}`, `7. multiple_clock (several clocks on a pin without an exclusion): ${mc.length || 'none'}`));
    for (const m of mc.slice(0, 8)) out.push(`   ${m.pin}: ${m.clocks.join(', ')}`);
    if (mc.length) out.push(L('   → если тактовые сигналы не существуют одновременно: set_clock_groups -logically/-physically_exclusive', '   → if the clocks never exist at the same time: set_clock_groups -logically/-physically_exclusive'));
    sec(8, L('generated_clocks (непостроенные производные тактовые сигналы)', 'generated_clocks (generated clocks that could not be built)'), I.generated);
    sec(9, L('unexpandable_clocks (нет общего периода)', 'unexpandable_clocks (no common period)'), I.unexpandable);
    sec(10, L('unsafe: тактовые сигналы от разных первичных источников анализируются как синхронные', 'unsafe: clocks from different primary sources are analyzed as synchronous'), I.unsafe);
    return out.join('\n');
  }

  function evDesc(ev, pairTime, isLaunch) {
    if (!ev.clock) return ev.io ? L('задержка без тактового сигнала', 'delay without a clock') : ({ no_input_delay: L('нет set_input_delay', 'no set_input_delay'), no_output_delay: L('нет set_output_delay', 'no set_output_delay'), no_clock: L('нет тактового сигнала', 'no clock') }[ev.why] || L('нет тактового сигнала', 'no clock'));
    let s = `${ev.clock} ${ev.edge === 'fall' ? 'fall' : 'rise'}` + (pairTime !== undefined && pairTime !== null ? L(` @ ${fmt(pairTime)} нс`, ` @ ${fmt(pairTime)} ns`) : '');
    if (ev.io) {
      const mx = ev.io.max, mn = ev.io.min;
      s += `   ${isLaunch ? 'input' : 'output'} delay: max ${mx === null ? '–' : fmt(mx)}, min ${mn === null ? '–' : fmt(mn)}`;
    }
    return s;
  }
  const SRC_RU = { default: L('по умолчанию', 'default'), mcp: L('многотактный путь', 'multicycle path'), mcp_setup: L('сдвиг от set_multicycle_path -setup', 'shifted by set_multicycle_path -setup'), max: 'set_max_delay', max_dp: 'set_max_delay -datapath_only', min: 'set_min_delay' };
  const WHY_RU = { false: L('ложный путь', 'false path'), async: L('асинхронные группы', 'asynchronous clock groups'), exclusive: L('взаимоисключающие тактовые сигналы', 'exclusive clocks'), datapath_only: L('проверка отключена опцией -datapath_only', 'check disabled by -datapath_only'), no_clock: L('нет тактового сигнала', 'no clock'), no_input_delay: L('нет set_input_delay', 'no set_input_delay'), no_output_delay: L('нет set_output_delay', 'no set_output_delay'), partial_in: L('нет -max/-min во входной задержке', 'no -max/-min in the input delay'), partial_out: L('нет -max/-min в выходной задержке', 'no -max/-min in the output delay'), io_no_clock: L('задержка без -clock', 'delay without -clock') };

  function timingBlock(ch, type) {
    const t = ch[type];
    const nm = ch.async ? (type === 'setup' ? L('восстановление, recovery', 'recovery') : L('снятие сброса, removal', 'removal')) : (type === 'setup' ? L('предустановка, setup', 'setup') : L('удержание, hold', 'hold'));
    const out = [L(`Путь: ${ch.path.startName} → ${ch.path.endName}   [${nm}]`, `Path: ${ch.path.startName} → ${ch.path.endName}   [${nm}]`)];
    const pair = t.pair;
    out.push(L(`  Запуск : ${evDesc(ch.L, pair ? pair.L : null, true)}`, `  Launch:  ${evDesc(ch.L, pair ? pair.L : null, true)}`));
    out.push(L(`  Захват : ${evDesc(ch.C, pair ? pair.C : null, false)}`, `  Capture: ${evDesc(ch.C, pair ? pair.C : null, false)}`));
    if (!t.on) { out.push(L(`  Не анализируется: ${WHY_RU[t.why] || t.why}${t.by && t.by.line ? ` (строка ${t.by.line})` : ''}`, `  Not analyzed: ${WHY_RU[t.why] || t.why}${t.by && t.by.line ? ` (line ${t.by.line})` : ''}`)); return out.join('\n'); }
    out.push(L(`  Требование: ${fmt(t.req)} нс  (${SRC_RU[t.src] || t.src}${t.by && t.by.line ? `, строка ${t.by.line}` : ''})`, `  Requirement: ${fmt(t.req)} ns  (${SRC_RU[t.src] || t.src}${t.by && t.by.line ? `, line ${t.by.line}` : ''})`));
    const io = (type === 'setup')
      ? [ch.L.io ? ch.L.io.max : null, ch.C.io ? ch.C.io.max : null]
      : [ch.L.io ? ch.L.io.min : null, ch.C.io ? ch.C.io.min : null];
    if (io[0] !== null || io[1] !== null) {
      out.push(L(`  Бюджет внутреннего пути: ${fmt(t.budget)} нс  (= ${fmt(t.req)}${io[0] !== null ? ` − ${fmt(io[0])} (вх.)` : ''}${io[1] !== null ? ` − ${fmt(io[1])} (вых.)` : ''})`, `  Internal path budget: ${fmt(t.budget)} ns  (= ${fmt(t.req)}${io[0] !== null ? ` − ${fmt(io[0])} (in)` : ''}${io[1] !== null ? ` − ${fmt(io[1])} (out)` : ''})`));
    }
    out.push(type === 'setup'
      ? L(`  Условие: задержка пути (+ перекос тактовых сигналов) ≤ ${fmt(t.budget)} нс`, `  Condition: path delay (+ clock skew) ≤ ${fmt(t.budget)} ns`)
      : L(`  Условие: задержка пути (+ перекос тактовых сигналов) ≥ ${fmt(t.budget)} нс`, `  Condition: path delay (+ clock skew) ≥ ${fmt(t.budget)} ns`));
    return out.join('\n');
  }

  function reportExceptions(S, A) {
    const ex = S.db.exceptions;
    if (!ex.length) return L('Исключений нет.', 'No timing exceptions.');
    const out = [];
    for (const e of ex) {
      let matched = 0, used = 0;
      for (const ch of A.checks) {
        if (!ch.exc || !ch.exc.includes(e)) continue;
        matched++;
        if (ch.setup.by === e || ch.hold.by === e) used++;
      }
      const st = !matched ? L('НЕ ПОКРЫВАЕТ НИ ОДНОГО ПУТИ', 'DOES NOT COVER ANY PATH') : used ? L(`действует: ${used} ${U.plural(used, 'проверка', 'проверки', 'проверок')}`, `active: ${used} ${used === 1 ? 'check' : 'checks'}`) : L(`перекрыто исключением с более высоким приоритетом (${matched})`, `overridden by a higher-priority exception (${matched})`);
      out.push(L(`строка ${e.line} [${e.src}]: ${e.text}\n    → ${st}`, `line ${e.line} [${e.src}]: ${e.text}\n    → ${st}`));
    }
    for (const g of S.db.groups) {
      out.push(L(`строка ${g.line} [${g.src}]: ${g.text}\n    → группы: ${g.groups.map((x) => '{' + x.join(' ') + '}').join(' ')} (наивысший приоритет)`, `line ${g.line} [${g.src}]: ${g.text}\n    → groups: ${g.groups.map((x) => '{' + x.join(' ') + '}').join(' ')} (highest priority)`));
    }
    return out.join('\n');
  }

  function reportIO(S) {
    if (!S.db.io.size) return L('Задержек ввода/вывода нет.', 'No input/output delays.');
    const rows = [];
    for (const [p, io] of S.db.io) {
      for (const dir of ['in', 'out']) {
        for (const e of io[dir]) rows.push([p, dir === 'in' ? 'input' : 'output', e.clock || '–', e.fall ? 'fall' : 'rise', e.max === null ? '–' : fmt(e.max), e.min === null ? '–' : fmt(e.min)]);
      }
    }
    return table(rows, [L('Порт', 'Port'), L('Тип', 'Type'), L('Тактовый сигнал', 'Clock'), L('Фронт', 'Edge'), 'max', 'min']);
  }

  function register(S) {
    const I = S.I;
    const R = (n, f) => I.register(n, f, { report: true, notInXdc: true });
    const ana = () => XT.sta.analyze(S);
    const emit = (txt) => { I.out.push(txt + '\n'); return ''; };
    R('report_clocks', () => emit(reportClocks(S)));
    R('report_clock_interaction', () => emit(interaction(S, ana())));
    R('check_timing', () => emit(checkTiming(S, ana())));
    R('report_exceptions', () => emit(reportExceptions(S, ana())));
    R('report_io_delays', () => emit(reportIO(S)));
    R('report_timing', (I2, a) => {
      const { opts } = XT.sdc.parseArgs('report_timing', a, {
        flags: { '-from': 'v', '-to': 'v', '-through': 'v', '-max_paths': 'v', '-nworst': 'v', '-delay_type': 'v', '-setup': 'b', '-hold': 'b', '-name': 'v', '-file': 'v', '-unique_pins': 'b', '-sort_by': 'v', '-rise_from': 'v', '-fall_from': 'v', '-rise_to': 'v', '-fall_to': 'v' }, maxPos: 0,
      });
      const A = ana();
      const sel = (val) => {
        if (val === undefined) return null;
        const objs = S.resolve('report_timing', val, ['clock', 'port', 'pin', 'cell', 'net'], L('объектов', 'objects'));
        const keys = new Set(objs.map(XT.design.objKey));
        const clocks = new Set(objs.filter((o) => o.kind === 'clock').map((o) => o.name));
        return { keys, clocks };
      };
      const fr = sel(opts['-from'] || opts['-rise_from'] || opts['-fall_from']), to = sel(opts['-to'] || opts['-rise_to'] || opts['-fall_to']), th = sel(opts['-through']);
      let list = A.checks.filter((ch) => {
        if (fr && !(ch.path.startKeys.some((k) => fr.keys.has(k)) || (ch.L.clock && fr.clocks.has(ch.L.clock)))) return false;
        if (to && !(ch.path.endKeys.some((k) => to.keys.has(k)) || (ch.C.clock && to.clocks.has(ch.C.clock)))) return false;
        if (th && !ch.path.trailKeys.some((ks) => ks.some((k) => th.keys.has(k)))) return false;
        return true;
      });
      const dt = opts['-delay_type'] ? toStr(opts['-delay_type']) : (opts['-hold'] ? 'min' : opts['-setup'] ? 'max' : 'max');
      const types = dt === 'min_max' ? ['setup', 'hold'] : dt === 'min' ? ['hold'] : ['setup'];
      const maxp = opts['-max_paths'] ? parseInt(toStr(opts['-max_paths']), 10) : 10;
      const blocks = [];
      for (const t of types) {
        const sorted = list.slice().sort((a, b) => {
          const va = a[t].on ? U.num(a[t].budget) : Infinity, vb = b[t].on ? U.num(b[t].budget) : Infinity;
          return t === 'setup' ? va - vb : (vb === Infinity ? -Infinity : vb) - (va === Infinity ? -Infinity : va);
        });
        for (const ch of sorted.slice(0, maxp)) blocks.push(timingBlock(ch, t));
      }
      if (!blocks.length) return emit(L('Пути не найдены.', 'No paths found.'));
      return emit(blocks.join('\n\n') + (list.length > maxp ? L(`\n\n… всего путей: ${list.length} (используйте -max_paths)`, `\n\n… total paths: ${list.length} (use -max_paths)`) : ''));
    });
    R('report_property', (I2, a) => {
      const pos = a.filter((x) => !(typeof x === 'string' && x.startsWith('-')));
      if (!pos.length) throw new T.TclError(L('report_property: укажите объект', 'report_property: specify an object'));
      const objs = S.resolve('report_property', pos[pos.length - 1], ['port', 'pin', 'cell', 'net', 'clock', 'design'], L('объект', 'object'));
      const out = [];
      for (const o of objs.slice(0, 5)) {
        const rows = XT.design.propNames(o).map((p) => [p, XT.design.getProp(o, p, S) ?? '']);
        out.push(`${o.kind} ${o.name}\n` + table(rows, [L('Свойство', 'Property'), L('Значение', 'Value')]));
      }
      return emit(out.join('\n\n'));
    });
    R('help', () => emit([
      L('Команды консоли ConstraintLab:', 'ConstraintLab console commands:'),
      L('  report_clocks              – список тактовых сигналов (в т.ч. автоматически выведенных)', '  report_clocks              – list of clocks (including auto-derived ones)'),
      L('  report_clock_interaction   – статус путей между парами тактовых сигналов', '  report_clock_interaction   – status of paths between clock pairs'),
      L('  check_timing               – что осталось неограниченным', '  check_timing               – what is left unconstrained'),
      '  report_timing [-from …] [-to …] [-delay_type min|max|min_max] [-max_paths N]',
      L('  report_exceptions          – какие исключения действуют / перекрыты / пусты', '  report_exceptions          – which timing exceptions are active / overridden / empty'),
      L('  report_io_delays           – итоговые задержки ввода/вывода по портам', '  report_io_delays           – resulting input/output delays per port'),
      L('  report_property <объект>   – свойства объекта', '  report_property <object>   – object properties'),
      L('  get_ports/get_cells/get_pins/get_nets/get_clocks [-hier] [-filter …] [-of_objects …] <шаблон>', '  get_ports/get_cells/get_pins/get_nets/get_clocks [-hier] [-filter …] [-of_objects …] <pattern>'),
      L('ConstraintLab работает с идеальными тактовыми сигналами: «бюджет» – это время, которое остаётся на путь внутри ПЛИС.', 'ConstraintLab works with ideal clocks: the "budget" is the time left for the path inside the FPGA.'),
    ].join('\n')));
  }

  XT.reports = { register, reportClocks, interaction, checkTiming, timingBlock, reportExceptions, reportIO, table };
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
