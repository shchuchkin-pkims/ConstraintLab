/* ConstraintLab – API банка вопросов: XT.bank.module({...}), XT.bank.add({...}) */
(function (XT) {
  'use strict';
  const bank = {
    modules: new Map(),
    list: [],
    byId: new Map(),
    source: 'bank',
    module(m) {
      if (!m || !m.id) throw new Error('XT.bank.module: нужен id');
      const prev = this.modules.get(m.id) || {};
      this.modules.set(m.id, Object.assign({ order: 100, title: m.id, about: '' }, prev, m));
    },
    add(q) {
      if (Array.isArray(q)) { q.forEach((x) => this.add(x)); return; }
      if (!q || !q.id) throw new Error('XT.bank.add: у вопроса нет id');
      const n = Object.assign({ tool: 'vivado', type: 'sdc', level: 1, tags: [], hints: [], module: 'misc' }, q);
      n._src = this.source;
      if (this.byId.has(n.id)) {
        const k = this.list.findIndex((x) => x.id === n.id);
        if (k >= 0) this.list[k] = n;
      } else this.list.push(n);
      this.byId.set(n.id, n);
      if (!this.modules.has(n.module)) this.module({ id: n.module, title: n.module === 'misc' ? XT.L('Прочее', 'Other') : n.module, order: 900 });
    },
    remove(id) {
      this.byId.delete(id);
      this.list = this.list.filter((q) => q.id !== id);
    },
    // ---------- переводы банка ----------
    // XT.bank.i18n('en', { modules: { id: { title, about } }, questions: { id: { … } }, strings: { 'рус': 'eng' } })
    tr: {},
    i18n(lang, data) {
      const t = this.tr[lang] = this.tr[lang] || { modules: {}, questions: {}, strings: {} };
      Object.assign(t.modules, (data && data.modules) || {});
      Object.assign(t.questions, (data && data.questions) || {});
      Object.assign(t.strings, (data && data.strings) || {});
    },
    // Применить перевод к загруженному банку (один раз после загрузки). Возвращает id задач без перевода.
    applyLang(lang) {
      const t = this.tr[lang];
      const missing = [];
      if (!t) return { missing: this.list.map((q) => q.id) };
      for (const [id, mt] of Object.entries(t.modules)) {
        const m = this.modules.get(id);
        if (!m) continue;
        if (mt.title !== undefined) m.title = mt.title;
        if (mt.about !== undefined) m.about = mt.about;
      }
      const common = Object.assign({}, COMMON[lang] || {}, t.strings);
      for (const q of this.list) {
        const qt = t.questions[q.id];
        if (!qt) { missing.push(q.id); continue; }
        Object.assign(q, translateQuestion(q, qt, Object.assign({}, common, qt.strings || {})));
      }
      return { missing };
    },
    ordered() {
      const mods = [...this.modules.values()].sort((a, b) => (a.order - b.order) || String(a.id).localeCompare(String(b.id)));
      return mods.map((m) => ({ m, qs: this.list.filter((q) => q.module === m.id).sort((a, b) => (a.order || 0) - (b.order || 0)) })).filter((x) => x.qs.length);
    },
  };
  XT.bank = bank;

  // Строки на схемах и диаграммах, общие для многих задач (точное совпадение всей строки)
  const COMMON = {
    en: { 'Схема': 'Schematic', 'запуск': 'launch', 'захват': 'capture', 'нс': 'ns', 'пФ': 'pF', 'МГц': 'MHz', 'ГГц': 'GHz', 'ПЛИС': 'FPGA' },
  };
  const CYR = /[А-Яа-яЁё]/;
  // свойства-идентификаторы: строки без кириллицы в них не заменяются (имена экземпляров, концы проводов, типы)
  const STRUCT = new Set(['id', 't', 'from', 'to', 'kind', 'cls', 'net', 'side', 'n', 'pin', 'anchor', 'type', 'name', 'ref']);
  // Глубокая замена строк по словарю (совпадение всей строки): строки с кириллицей – везде,
  // строки без кириллицы (например, «Tcd 0,9…1,1» с десятичными запятыми) – только в текстовых свойствах
  function deepMap(o, map, key) {
    if (typeof o === 'string') {
      if (!Object.prototype.hasOwnProperty.call(map, o)) return o;
      return CYR.test(o) || !STRUCT.has(key) ? map[o] : o;
    }
    if (Array.isArray(o)) return o.map((x) => deepMap(x, map, key));
    if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) r[k] = deepMap(v, map, k); return r; }
    return o;
  }
  // Десятичная точка вместо запятой в подписях схем и диаграмм (английский текст): 1,2 → 1.2
  function decimalPoint(o, key) {
    if (typeof o === 'string') return STRUCT.has(key) ? o : o.replace(/(\d),(\d)/g, '$1.$2');
    if (Array.isArray(o)) return o.map((x) => decimalPoint(x, key));
    if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) r[k] = decimalPoint(v, k); return r; }
    return o;
  }
  // Перевод одного вопроса: поля целиком, рисунки и схема – по словарю строк и по индексам figures
  function translateQuestion(q, qt, map) {
    const r = {};
    for (const k of ['title', 'text', 'explain', 'langNote', 'refs']) if (qt[k] !== undefined) r[k] = qt[k];
    if (qt.tags) r.tags = qt.tags;
    if (qt.hints) r.hints = qt.hints;
    if (qt.options && q.options) r.options = q.options.map((o, i) => Object.assign({}, o, qt.options[i] || {}));
    const fields = qt.fields && q.fields ? q.fields.map((f, i) => Object.assign({}, f, qt.fields[i] || {})) : q.fields;
    if (fields) r.fields = fields.map((f) => (f.unit && map[f.unit] ? Object.assign({}, f, { unit: map[f.unit] }) : f));
    if (q.design) r.design = decimalPoint(deepMap(q.design, map));
    if (q.figures) r.figures = q.figures.map((f, i) => Object.assign(decimalPoint(deepMap(f, map)), (qt.figures || [])[i] || {}));
    if (qt.code) for (const k of ['solution', 'solutions', 'starter', 'given', 'after']) if (qt.code[k] !== undefined) r[k] = qt.code[k];
    if (qt.check && q.check) {
      r.check = Object.assign({}, q.check);
      for (const k of ['forbid', 'require']) if (qt.check[k] && q.check[k]) r.check[k] = q.check[k].map((x, i) => Object.assign({}, x, qt.check[k][i] || {}));
    }
    return r;
  }
  XT.bankDeepMap = deepMap;

  // Рисунки вопроса: схема проекта добавляется автоматически первой
  // Где применимо решение: 'both' – XDC и SDC, 'xdc' – только Vivado, 'sdc' – только САПР ASIC
  XT.LANGS = ['both', 'xdc', 'sdc'];
  XT.langOf = function (q) { return XT.LANGS.includes(q.lang) ? q.lang : (q.tool === 'vivado' ? 'xdc' : 'sdc'); };
  XT.questionFigures = function (q) {
    const figs = (q.figures || []).slice();
    if (q.design && q.design.elements && q.design.elements.length && !q.noSchematic && !figs.some((f) => f.kind === 'schematic' && !f.design)) {
      figs.unshift({ kind: 'schematic', title: XT.L('Схема', 'Schematic') });
    }
    return figs;
  };
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
