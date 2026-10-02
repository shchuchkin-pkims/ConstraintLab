#!/usr/bin/env node
/* Проверка английского перевода банка задач ConstraintLab.
   Запуск: node tools/i18n-check.js [-v] [--only en/01_clocks.js] [id-фильтр]
   Применяет переводы из bank/en и ищет кириллицу во всём, что видит пользователь:
   условие, подсказки, разбор, варианты ответов, подписи схем и диаграмм, комментарии в эталонах.
   Проверяет и соответствие структуры (число вариантов, полей, подсказок, рисунков), ссылки на задачи
   и длинные тире. Код выхода 1 – есть ошибки. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const verbose = args.includes('-v') || args.includes('--verbose');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? path.basename(args[onlyIdx + 1]) : null;
const filter = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '--only');

globalThis.XT = { lang: 'en' };
global.window = undefined;
for (const f of ['util', 'tcl', 'design', 'sdc', 'sta', 'checker', 'reports', 'schematic', 'wave', 'md', 'refdocs', 'bank-api']) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
}
const XT = globalThis.XT;
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'bank', 'index.js'), 'utf8'), { filename: 'bank/index.js' });
let errors = 0;
const err = (m) => { errors++; console.log('✗ ' + m); };
for (const f of XT.BANK_FILES) {
  XT.bank.source = f;
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'bank', f), 'utf8'), { filename: 'bank/' + f });
}
// исходные (русские) данные для сверки структуры
const orig = new Map(XT.bank.list.map((q) => [q.id, JSON.parse(JSON.stringify(q))]));
const enFiles = (XT.BANK_FILES_EN || []).filter((f) => !only || path.basename(f) === only);
const present = [];
for (const f of enFiles) {
  const p = path.join(ROOT, 'bank', f);
  if (!fs.existsSync(p)) { if (verbose || only) console.log(`· нет файла bank/${f}`); continue; }
  present.push(f);
  const src = fs.readFileSync(p, 'utf8');
  if (src.includes('\u2014')) src.split('\n').forEach((l, i) => { if (l.includes('\u2014')) err(`длинное тире: bank/${f}:${i + 1}`); });
  try { vm.runInThisContext(src, { filename: 'bank/' + f }); } catch (e) { err(`не загружается bank/${f}: ${e.message}`); }
}
const tr = (XT.bank.tr.en || { questions: {}, modules: {} });
for (const id of Object.keys(tr.questions)) if (!orig.has(id)) err(`перевод для несуществующей задачи «${id}»`);
const { missing } = XT.bank.applyLang('en');

const CYR = /[А-Яа-яЁё]/;
const ids = new Set(XT.bank.list.map((q) => q.id));
function walk(o, p, out) {
  if (typeof o === 'string') { if (CYR.test(o)) out.push([p, o]); return; }
  if (Array.isArray(o)) { o.forEach((x, i) => walk(x, `${p}[${i}]`, out)); return; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k, out);
}
// поля, которые видит пользователь (тесты и служебные поля не проверяются)
const SHOWN = ['title', 'text', 'hints', 'explain', 'langNote', 'refs', 'tags', 'options', 'fields', 'figures', 'design', 'solution', 'solutions', 'starter', 'given', 'after'];
let nQ = 0, nOk = 0, nCyr = 0;
const byFile = new Map();
for (const { m, qs } of XT.bank.ordered()) {
  if (CYR.test(m.title) || CYR.test(m.about || '')) { if (!only) err(`модуль ${m.id}: заголовок или описание не переведены`); }
  for (const q of qs) {
    if (filter && !q.id.includes(filter)) continue;
    const file = q._src;
    if (only && path.basename(file) !== only.replace(/^en\//, '')) continue;
    nQ++;
    const st = byFile.get(file) || { n: 0, ok: 0 };
    st.n++;
    if (missing.includes(q.id)) { if (verbose || only) console.log(`· ${q.id}: нет перевода`); byFile.set(file, st); continue; }
    const o = orig.get(q.id), t = tr.questions[q.id];
    const out = [];
    for (const k of SHOWN) if (q[k] !== undefined) walk(q[k], k, out);
    if (q.check) for (const k of ['forbid', 'require']) if (q.check[k]) walk(q.check[k].map((r) => ({ msg: r.msg, detail: r.detail })), 'check.' + k, out);
    // в коде допустимы русские имена? нет – комментарии тоже переводятся
    const probs = [];
    if (out.length) { nCyr += out.length; for (const [p, s] of out.slice(0, verbose ? 50 : 6)) probs.push(`кириллица в ${p}: «${s.length > 70 ? s.slice(0, 70) + '…' : s}»`); if (out.length > 6 && !verbose) probs.push(`… ещё ${out.length - 6}`); }
    if (o.options && (!t.options || t.options.length !== o.options.length)) probs.push(`options: ${t.options ? t.options.length : 0} вместо ${o.options.length}`);
    if (o.fields && (!t.fields || t.fields.length !== o.fields.length)) probs.push(`fields: ${t.fields ? t.fields.length : 0} вместо ${o.fields.length}`);
    if ((o.hints || []).length !== (t.hints || []).length) probs.push(`hints: ${(t.hints || []).length} вместо ${(o.hints || []).length}`);
    if (t.figures && (t.figures.length > (o.figures || []).length)) probs.push(`figures: ${t.figures.length} больше, чем в оригинале (${(o.figures || []).length})`);
    for (const k of ['title', 'text', 'explain']) if (o[k] && !t[k]) probs.push(`нет поля ${k}`);
    // ссылки на задачи в тексте
    for (const k of ['text', 'explain', 'langNote']) for (const mm of String(q[k] || '').matchAll(/\[\[q:([\w.\-]+)\|/g)) if (!ids.has(mm[1])) probs.push(`ссылка на неизвестную задачу ${mm[1]} в ${k}`);
    if (probs.length) { console.log(`✗ ${q.id}`); for (const p of probs) console.log('    ' + p); errors++; } else { nOk++; st.ok++; if (verbose) console.log(`✓ ${q.id}`); }
    byFile.set(file, st);
  }
}
console.log('');
for (const [f, s] of byFile) console.log(`${f.padEnd(22)} переведено без замечаний: ${s.ok} из ${s.n}`);
console.log(`\nЗадач: ${nQ}, без замечаний: ${nOk}, без перевода: ${missing.filter((id) => !filter || id.includes(filter)).length}, строк с кириллицей: ${nCyr}, файлов перевода: ${present.length} из ${(XT.BANK_FILES_EN || []).length}`);
process.exit(errors ? 1 : 0);
