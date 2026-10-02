#!/usr/bin/env node
/* Проверка банка вопросов ConstraintLab XDC/SDC.
   Запуск: node tools/validate.js [--verbose] [id-фильтр]
   Для каждого вопроса: строится проект, отрисовываются рисунки, эталон проходит собственную
   проверку, тесты (tests) дают ожидаемый результат; ищутся длинные тире. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const filter = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '--only');

global.window = undefined;
const ENGINE = ['util', 'tcl', 'design', 'sdc', 'sta', 'checker', 'reports', 'schematic', 'wave', 'md', 'refdocs', 'bank-api', 'validate'];
for (const f of ENGINE) vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
const XT = globalThis.XT;
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'bank', 'index.js'), 'utf8'), { filename: 'bank/index.js' });
let loadErr = 0;
// --only bank/XX.js – проверить только указанный файл (даже если его нет в манифесте)
const onlyIdx = args.indexOf('--only');
if (onlyIdx >= 0) XT.BANK_FILES = [path.basename(args[onlyIdx + 1])];
for (const f of XT.BANK_FILES) {
  XT.bank.source = f;
  try { vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'bank', f), 'utf8'), { filename: 'bank/' + f }); }
  catch (e) { loadErr++; console.log(`✗ не загружается bank/${f}: ${e.message}`); }
}
// длинное тире во всех исходниках
const EMDASH = '\u2014';
let dashes = 0;
const scan = (dir, re) => {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (!['node_modules', '.git', 'dist'].includes(f)) scan(p, re); continue; }
    if (!re.test(f)) continue;
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    lines.forEach((l, i) => { if (l.includes(EMDASH)) { dashes++; console.log(`✗ длинное тире: ${path.relative(ROOT, p)}:${i + 1}`); } });
  }
};
scan(ROOT, /\.(js|html|css|md|py)$/);

let nQ = 0, nBad = 0, nWarn = 0;
const t0 = Date.now();
for (const { m, qs } of XT.bank.ordered()) {
  if (verbose) console.log(`\n== ${m.title}`);
  for (const q of qs) {
    if (filter && !q.id.includes(filter)) continue;
    nQ++;
    const probs = XT.validateQuestion(q, { quiet: !verbose });
    const errs = probs.filter((p) => p.sev === 'error');
    const warns = probs.filter((p) => p.sev === 'warn');
    nWarn += warns.length;
    if (errs.length) {
      nBad++;
      console.log(`✗ ${q.id}`);
      for (const p of errs) console.log('    ' + p.text);
    } else if (verbose) console.log(`✓ ${q.id}${warns.length ? `  (${warns.length} предупр.)` : ''}`);
    if (verbose) for (const p of warns) console.log('    ⚠ ' + p.text);
  }
}
const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nВопросов: ${nQ}, с ошибками: ${nBad}, предупреждений: ${nWarn}, длинных тире: ${dashes}, ошибок загрузки: ${loadErr} (${dt} с)`);
process.exit(nBad || dashes || loadErr ? 1 : 0);
