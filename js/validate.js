/* ConstraintLab – проверка вопросов банка (используется в режиме автора и в tools/validate.js) */
(function (XT) {
  'use strict';
  const EMDASH = '\u2014';
  const L = XT.L;

  function walkStrings(o, f, path) {
    if (typeof o === 'string') { f(o, path); return; }
    if (Array.isArray(o)) { o.forEach((x, i) => walkStrings(x, f, path + '[' + i + ']')); return; }
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walkStrings(v, f, path ? path + '.' + k : k);
  }

  // команды и опции, которые есть только в Vivado (XDC) или только в САПР ASIC (SDC)
  const XDC_ONLY = [
    { name: 'set_property', re: /(^|[\s;[])set_property\b/m },
    { name: 'set_bus_skew', re: /(^|[\s;[])set_bus_skew\b/m },
    { name: L('опцию -datapath_only', 'option -datapath_only'), re: /-datapath_only\b/ },
    { name: L('опцию -include_generated_clocks', 'option -include_generated_clocks'), re: /-include_generated_clocks\b/ },
  ];
  const ASIC_ONLY = ['set_driving_cell', 'set_drive', 'set_max_transition', 'set_max_capacitance', 'set_min_capacitance', 'set_max_fanout',
    'set_clock_transition', 'set_input_transition', 'set_ideal_network', 'set_dont_touch_network', 'set_clock_gating_check',
    'set_timing_derate', 'set_operating_conditions', 'set_wire_load_model', 'set_propagated_clock'];
  function validateQuestion(q, opts) {
    opts = opts || {};
    const P = [];
    const err = (m) => P.push({ sev: 'error', text: m });
    const warn = (m) => P.push({ sev: 'warn', text: m });
    if (!q.id) err(L('нет id', 'no id'));
    if (!q.title) err(L('нет title', 'no title'));
    if (!q.module) warn(L('нет module (вопрос попадёт в «Прочее»)', 'no module (the question goes to "Other")'));
    if (!q.text) warn(L('нет текста задания (text)', 'no task text (text)'));
    walkStrings(q, (s, p) => { if (s.includes(EMDASH)) err(L(`длинное тире «\u2014» в поле ${p}: замените на «–»`, `em dash (U+2014) in field ${p}: replace it with an en dash '–'`)); }, '');
    const type = q.type || 'sdc';
    // проект
    if (q.design) {
      try {
        const D = XT.checker.buildDesign(q);
        for (const e of D.errors) err(L('проект: ', 'design: ') + e);
      } catch (e) { err(L('проект не строится: ', 'design cannot be built: ') + e.message); }
    }
    // рисунки
    const figs = XT.questionFigures ? XT.questionFigures(q) : (q.figures || []);
    for (const f of figs) {
      try {
        if (f.kind === 'schematic') {
          const r = XT.schematic.render(f.design || q.design || { elements: [], wires: [] }, {});
          for (const e of r.errors) warn(L('схема: ', 'schematic: ') + e);
        } else XT.wave.render(f, {});
      } catch (e) { err(L(`рисунок «${f.title || f.kind}» не отрисовывается: ${e.message}`, `figure '${f.title || f.kind}' cannot be rendered: ${e.message}`)); }
    }
    // где применимо решение: тег lang должен соответствовать командам эталона
    if (q.lang !== undefined && !XT.LANGS.includes(q.lang)) err(L(`lang: допустимы ${XT.LANGS.join(', ')}`, `lang: allowed values are ${XT.LANGS.join(', ')}`));
    if (q.lang === undefined) warn(L('нет lang (both | xdc | sdc) – где применимо решение', 'no lang (both | xdc | sdc): where the solution applies'));
    if (type === 'sdc') {
      const sols = q.solutions || (q.solution !== undefined ? [q.solution] : []);
      if (!sols.length) err(L('нет эталонного решения (solution)', 'no reference solution (solution)'));
      const lang = XT.langOf(q);
      sols.forEach((s, k) => {
        const code = String(s);
        if (lang !== 'xdc') {
          const x = XDC_ONLY.find((r) => r.re.test(code));
          if (x) err(L(`lang '${lang}': эталон №${k + 1} использует ${x.name} – это есть только в Vivado (поставьте lang: 'xdc')`, `lang '${lang}': reference solution #${k + 1} uses ${x.name}, which exists only in Vivado (set lang: 'xdc')`));
        }
        if (lang !== 'sdc') {
          const a = ASIC_ONLY.find((c) => new RegExp('(^|[\\s;\\[])' + c + '\\b', 'm').test(code));
          if (a) err(L(`lang '${lang}': эталон №${k + 1} использует ${a} – в Vivado этой команды нет (поставьте lang: 'sdc')`, `lang '${lang}': reference solution #${k + 1} uses ${a}, which Vivado does not have (set lang: 'sdc')`));
        }
      });
      sols.forEach((s, k) => {
        try {
          const r = XT.checker.runSession(q, s);
          const bad = r.S.messages.filter((m) => (m.sev === 'error' || m.sev === 'crit'));
          for (const m of bad) err(L(`эталон №${k + 1}, строка ${m.line} [${m.src}]: ${m.text}`, `reference solution #${k + 1}, line ${m.line} [${m.src}]: ${m.text}`));
          const w = r.S.messages.filter((m) => m.sev === 'warn' && m.src === 'user');
          for (const m of w) if (!opts.quiet) warn(L(`эталон №${k + 1}, строка ${m.line}: предупреждение: ${m.text}`, `reference solution #${k + 1}, line ${m.line}: warning: ${m.text}`));
          const res = XT.checker.check(q, s);
          if (!res.pass) err(L(`эталон №${k + 1} не проходит собственную проверку: `, `reference solution #${k + 1} fails its own check: `) + res.findings.filter((f) => f.sev === 'error').map((f) => f.title).join(' | '));
        } catch (e) { err(L(`эталон №${k + 1}: исключение ${e.message}`, `reference solution #${k + 1}: exception ${e.message}`)); }
      });
      for (const [i, t] of (q.tests || []).entries()) {
        try {
          const res = XT.checker.check(q, t.code);
          const want = t.pass === true;
          if (res.pass !== want) {
            err(L(`тест №${i + 1} (${t.note || ''}): ожидалось ${want ? 'ПРОЙДЕН' : 'НЕ ПРОЙДЕН'}, получено ${res.pass ? 'ПРОЙДЕН' : 'НЕ ПРОЙДЕН'}`, `test #${i + 1} (${t.note || ''}): expected ${want ? 'PASS' : 'FAIL'}, got ${res.pass ? 'PASS' : 'FAIL'}`) +
              (res.findings.length ? ' – ' + res.findings.filter((f) => f.sev === 'error').slice(0, 3).map((f) => f.title).join(' | ') : ''));
          } else if (t.expect && XT.lang === 'ru') {
            // ожидаемая диагностика записана по-русски: в английском интерфейсе сверяется только итог проверки
            const all = res.findings.map((f) => f.title + ' ' + f.detail).join('\n');
            for (const ex of [].concat(t.expect)) if (!new RegExp(ex, 'i').test(all)) err(L(`тест №${i + 1} (${t.note || ''}): нет ожидаемой диагностики /${ex}/`, `test #${i + 1} (${t.note || ''}): expected diagnostic /${ex}/ not found`));
          }
        } catch (e) { err(L(`тест №${i + 1}: исключение ${e.message}`, `test #${i + 1}: exception ${e.message}`)); }
      }
    } else if (type === 'choice') {
      if (!q.options || q.options.length < 2) err(L('у вопроса с выбором меньше двух вариантов', 'a choice question has fewer than two options'));
      else if (!q.options.some((o) => o.ok)) err(L('ни один вариант не помечен как верный (ok: true)', 'no option is marked as correct (ok: true)'));
      else if (!q.multi && q.options.filter((o) => o.ok).length > 1) err(L('несколько верных вариантов – укажите multi: true', 'several correct options: set multi: true'));
    } else if (type === 'numeric') {
      if (!q.fields || !q.fields.length) err(L('у числового вопроса нет полей (fields)', 'a numeric question has no fields (fields)'));
      for (const f of q.fields || []) if (typeof f.answer !== 'number') err(L(`поле «${f.label}»: answer должен быть числом`, `field '${f.label}': answer must be a number`));
    } else err(L('неизвестный type: ', 'unknown type: ') + type);
    return P;
  }

  XT.validateQuestion = validateQuestion;
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
