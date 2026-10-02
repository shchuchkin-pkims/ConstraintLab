#!/usr/bin/env node
/* Отладка одного вопроса без браузера.
   node tools/dev/q.js <файл банка> <id> [код | @ref | @ref2 | @файл.xdc] [команды консоли через ;;]
   @ref – первый эталон (по умолчанию), @ref2 – второй и т.д. Печатает вердикт проверки и вывод команд.
   Пример: node tools/dev/q.js 10_asic.js asic.test_mux @ref "check_timing;;report_clock_interaction" */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
global.window = undefined;
if (process.env.XT_LANG === 'en') globalThis.XT = { lang: 'en' };
for (const f of ['util', 'tcl', 'design', 'sdc', 'sta', 'checker', 'reports', 'schematic', 'wave', 'md', 'refdocs', 'bank-api', 'validate']) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
}
const XT = globalThis.XT;
const [file, id, codeArg = '@ref', cmds = ''] = process.argv.slice(2);
if (!file || !id) { console.log('node tools/dev/q.js <файл банка> <id> [код|@ref|@refN|@файл] [команды через ;;]'); process.exit(1); }
XT.bank.source = path.basename(file);
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'bank', path.basename(file)), 'utf8'), { filename: file });
// английский режим: перевод задач из bank/en
const enFile = path.join(ROOT, 'bank', 'en', path.basename(file));
if (XT.lang === 'en' && fs.existsSync(enFile)) { vm.runInThisContext(fs.readFileSync(enFile, 'utf8'), { filename: 'en/' + file }); XT.bank.applyLang('en'); }
const q = XT.bank.byId.get(id);
if (!q) { console.log(`нет вопроса ${id}; есть: ${XT.bank.list.map((x) => x.id).join(', ')}`); process.exit(1); }
const sols = q.solutions || (q.solution ? [q.solution] : []);
let code = codeArg;
const m = /^@ref(\d*)$/.exec(codeArg);
if (m) code = sols[(Number(m[1]) || 1) - 1] || '';
else if (codeArg.startsWith('@')) code = fs.readFileSync(codeArg.slice(1), 'utf8');
code = XT.md.dedent(code);

if ((q.type || 'sdc') === 'sdc') {
  const r = XT.checker.check(q, code);
  console.log(`Вердикт: ${r.pass ? 'ВЕРНО' : 'НЕВЕРНО'} (эталон №${r.alt + 1})`);
  for (const f of r.findings) console.log(`  [${f.sev}] ${f.title}${f.detail ? '\n        ' + f.detail.replace(/\n/g, '\n        ') : ''}`);
  for (const t of r.ok) console.log('  ✓ ' + t);
}
if (cmds) {
  const s = XT.checker.runSession(q, code);
  XT.reports.register(s.S);
  const I = s.S.I;
  for (const c of cmds.split(';;').map((x) => x.trim()).filter(Boolean)) {
    I.out = [];
    let res;
    try { res = XT.tcl.toStr(I.evalConsole(c)); } catch (e) { res = 'ОШИБКА: ' + e.message; }
    console.log(`\n> ${c}\n${I.out.join('')}${res || ''}`);
  }
}
