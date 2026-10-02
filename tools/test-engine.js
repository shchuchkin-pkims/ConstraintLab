#!/usr/bin/env node
/* Регрессионные тесты движка ConstraintLab XDC/SDC: node tools/test-engine.js
   Проверяются эталонные соотношения фронтов (UG903), производные тактовые сигналы,
   семантика задержек ввода/вывода, приоритеты исключений и особенности Tcl. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
for (const f of ['util', 'tcl', 'design', 'sdc', 'sta', 'checker', 'reports']) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
}
const XT = globalThis.XT;
const U = XT.util;
let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = typeof want === 'number' ? Math.abs(Number(got) - want) < 1e-6 : got === want;
  if (ok) pass++; else { fail++; console.log(`✗ ${name}: получено ${got}, ожидалось ${want}`); }
}

// ---------------------------------------------------------------- Tcl
const I = new XT.tcl.Interp();
const ev = (s) => XT.tcl.toStr(I.evalConsole(s));
eq('целочисленное деление', ev('expr {10/4}'), '2');
eq('деление с плавающей точкой', ev('expr {10/4.0}'), '2.5');
eq('деление вниз для отрицательных', ev('expr {-7/2}'), '-4');
eq('остаток со знаком делителя', ev('expr {-7%3}'), '2');
eq('foreach по парам', ev('set r {}; foreach {a b} {1 2 3 4} {append r $a$b}; set r'), '1234');
eq('скобки шины без фигурных скобок', ev('set x data[3]'), 'data[3]');
eq('list с фигурными скобками', ev('list a {b c}'), 'a {b c}');
eq('format', ev('format %.3f 3.14159'), '3.142');

// ---------------------------------------------------------------- проект для анализа
function design(outs) {
  return {
    elements: [
      { id: 'p', t: 'in', name: 'clk' }, { id: 'ib', t: 'ibuf', name: 'ib' },
      { id: 'm', t: 'mmcm', name: 'm', mult: 12, divclk: 1, outs },
      { id: 'b0', t: 'bufg', name: 'b0' }, { id: 'b1', t: 'bufg', name: 'b1' },
      { id: 'a', t: 'ff', name: 'a_reg' }, { id: 'b', t: 'ff', name: 'b_reg' },
    ],
    wires: [
      { from: 'p', to: 'ib.I' }, { from: 'ib.O', to: 'm.CLKIN1' },
      { from: 'm.CLKOUT0', to: 'b0.I' }, { from: 'm.CLKOUT1', to: 'b1.I' },
      { from: 'b0.O', to: 'a.C' }, { from: 'b1.O', to: 'b.C' }, { from: 'a.Q', to: 'b.D' },
    ],
  };
}
function req(spec, code) {
  const q = { id: 't' + Math.random(), tool: 'vivado', design: spec };
  const r = XT.checker.runSession(q, 'create_clock -period 10 [get_ports clk]\n' + code);
  const ch = r.A.checks.find((c) => c.path.endName === 'b_reg/D');
  return { s: ch.setup.on ? U.num(ch.setup.req) : null, h: ch.hold.on ? U.num(ch.hold.req) : null, ch, r };
}
const o = (d0, d1, ph1) => [{ pin: 'CLKOUT0', div: d0, clk: 'c0' }, { pin: 'CLKOUT1', div: d1, clk: 'c1', phase: ph1 || 0 }];
let x = req(design(o(12, 8)), '');
eq('100→150: предустановка', x.s, 10 / 3); eq('100→150: удержание', x.h, 0);
x = req(design(o(36, 12)), 'set_multicycle_path 3 -setup -end -from c0 -to c1\nset_multicycle_path 2 -hold -end -from c0 -to c1');
eq('медленный→быстрый MCP: предустановка', x.s, 30); eq('медленный→быстрый MCP: удержание', x.h, 0);
x = req(design(o(36, 12)), 'set_multicycle_path 3 -setup -end -from c0 -to c1\nset_multicycle_path 2 -hold -from c0 -to c1');
eq('медленный→быстрый, hold без -end', x.h, -40);
x = req(design(o(12, 36)), '');
eq('быстрый→медленный: предустановка', x.s, 10); eq('быстрый→медленный: удержание', x.h, 0);
x = req(design(o(12, 36)), 'set_multicycle_path 3 -setup -start -from c0 -to c1\nset_multicycle_path 2 -hold -start -from c0 -to c1');
eq('быстрый→медленный MCP: предустановка', x.s, 30); eq('быстрый→медленный MCP: удержание', x.h, 0);
x = req(design(o(12, 12, 90)), '');
eq('сдвиг +90°: предустановка', x.s, 2.5); eq('сдвиг +90°: удержание', x.h, -7.5);
x = req(design(o(12, 12)), 'set_multicycle_path 2 -from [get_cells a_reg] -to [get_cells b_reg]');
eq('MCP 2 без -hold: удержание', x.h, 10);

// ---------------------------------------------------------------- приоритеты исключений
x = req(design(o(12, 12)), 'set_multicycle_path 2 -from c0 -to c1\nset_max_delay 4 -from [get_cells a_reg] -to [get_cells b_reg]');
eq('max_delay важнее MCP', x.s, 4);
x = req(design(o(12, 12)), 'set_max_delay 4 -from [get_cells a_reg] -to [get_cells b_reg]\nset_false_path -from c0 -to c1');
eq('false path важнее max_delay', x.s, null);
x = req(design(o(12, 12)), 'set_max_delay -datapath_only 4 -from [get_cells a_reg] -to [get_cells b_reg]\nset_clock_groups -asynchronous -group c0 -group c1');
eq('группы важнее max_delay -datapath_only', x.ch.status, 'async');
x = req(design(o(12, 12)), 'set_max_delay -datapath_only 4 -from [get_cells a_reg] -to [get_cells b_reg]');
eq('-datapath_only отключает удержание', x.h, null);
x = req(design(o(12, 12)), 'set_multicycle_path 2 -from [get_pins a_reg/Q] -to [get_cells b_reg]');
eq('выход Q не начальная точка', x.s, 10);

// ---------------------------------------------------------------- производные тактовые сигналы
function gen(code) {
  const spec = { elements: [{ id: 'p', t: 'in', name: 'clk' }, { id: 'r', t: 'ff', name: 'd_reg' }, { id: 'po', t: 'out', name: 'o' }],
    wires: [{ from: 'p', to: 'r.C' }, { from: 'r.Q', to: 'po' }] };
  const r = XT.checker.runSession({ id: 'g' + Math.random(), tool: 'sdc', design: spec }, 'create_clock -period 10 [get_ports clk]\n' + code);
  const c = r.S.clocks().clocks.get('g');
  return c ? `${U.fmtShort(c.period)} ${U.fmtShort(c.rise)} ${U.fmtShort(c.fall)}` : 'нет';
}
eq('-divide_by 2', gen('create_generated_clock -name g -source [get_pins d_reg/C] -divide_by 2 [get_pins d_reg/Q]'), '20 0 10');
eq('-divide_by 3', gen('create_generated_clock -name g -source [get_pins d_reg/C] -divide_by 3 [get_pins d_reg/Q]'), '30 0 15');
eq('-edges {1 3 7}', gen('create_generated_clock -name g -source [get_pins d_reg/C] -edges {1 3 7} [get_pins d_reg/Q]'), '30 0 10');
eq('-invert', gen('create_generated_clock -name g -source [get_pins d_reg/C] -divide_by 1 -invert [get_pins d_reg/Q]'), '10 5 10');
eq('-multiply_by 4', gen('create_generated_clock -name g -source [get_pins d_reg/C] -multiply_by 4 [get_pins d_reg/Q]'), '2.5 0 1.25');
eq('-edge_shift', gen('create_generated_clock -name g -source [get_pins d_reg/C] -edges {1 2 3} -edge_shift {1 1 1} [get_pins d_reg/Q]'), '10 1 6');

// ---------------------------------------------------------------- задержки ввода/вывода
const io = { elements: [{ id: 'p', t: 'in', name: 'clk' }, { id: 'd', t: 'in', name: 'd' }, { id: 'r', t: 'iddr', name: 'r' }],
  wires: [{ from: 'p', to: 'r.C' }, { from: 'd', to: 'r.D' }] };
const ioRun = (code) => XT.checker.runSession({ id: 'io' + Math.random(), tool: 'vivado', design: io }, 'create_clock -name c -period 8 [get_ports clk]\n' + code).S.db.io.get('d').in;
let e = ioRun('set_input_delay -clock c -max 1 [get_ports d]\nset_input_delay -clock c -max 2 -clock_fall [get_ports d]');
eq('без -add_delay вторая задержка заменяет первую', e.length, 1);
e = ioRun('set_input_delay -clock c -max 1 [get_ports d]\nset_input_delay -clock c -max 2 -clock_fall -add_delay [get_ports d]');
eq('с -add_delay задержек две', e.length, 2);
e = ioRun('set_input_delay -clock c 1 [get_ports d]');
eq('без -max/-min задаются обе границы', e[0].max !== null && e[0].min !== null, true);

// ---------------------------------------------------------------- сканируемый триггер: условные проверки SI/D
const scan = { elements: [{ id: 'c', t: 'in', name: 'clk' }, { id: 'd', t: 'in', name: 'd' }, { id: 'si', t: 'in', name: 'si' }, { id: 'se', t: 'in', name: 'se' }, { id: 'r', t: 'sdff', name: 'r_reg' }],
  wires: [{ from: 'c', to: 'r.CK' }, { from: 'd', to: 'r.D' }, { from: 'si', to: 'r.SI' }, { from: 'se', to: 'r.SE' }] };
const ends = (code) => XT.checker.runSession({ id: 's' + Math.random(), tool: 'sdc', design: scan }, 'create_clock -period 10 [get_ports clk]\n' + code).A.paths.map((p) => p.endName).sort().join(' ');
eq('SDFF без констант: проверяются D, SI, SE', ends(''), 'r_reg/D r_reg/SE r_reg/SI');
eq('SDFF при SE = 0: только D', ends('set_case_analysis 0 [get_ports se]'), 'r_reg/D');
eq('SDFF при SE = 1: только SI', ends('set_case_analysis 1 [get_ports se]'), 'r_reg/SI');

// ---------------------------------------------------------------- unsafe: только анализ по соотношению фронтов
const two = { elements: [{ id: 'p1', t: 'in', name: 'ca' }, { id: 'p2', t: 'in', name: 'cb' }, { id: 'a', t: 'ff', name: 'a_reg' }, { id: 'b', t: 'ff', name: 'b_reg' }],
  wires: [{ from: 'p1', to: 'a.C' }, { from: 'p2', to: 'b.C' }, { from: 'a.Q', to: 'b.D' }] };
const uns = (code) => XT.checker.runSession({ id: 'u' + Math.random(), tool: 'vivado', design: two }, 'create_clock -period 10 [get_ports ca]\ncreate_clock -period 8 [get_ports cb]\n' + code).A.checks.find((c) => c.path.endName === 'b_reg/D').unsafe;
eq('несвязанные тактовые сигналы: unsafe', uns(''), true);
eq('set_max_delay -datapath_only: не unsafe', uns('set_max_delay -datapath_only 5 -from [get_cells a_reg] -to [get_cells b_reg]'), false);

// ---------------------------------------------------------------- set_driving_cell: -pin не влияет на сравнение
const env = { elements: [{ id: 'c', t: 'in', name: 'clk' }, { id: 'd', t: 'in', name: 'd' }, { id: 'r', t: 'dff', name: 'r_reg' }], wires: [{ from: 'c', to: 'r.CK' }, { from: 'd', to: 'r.D' }] };
const qEnv = { id: 'env', tool: 'sdc', design: env, solution: 'create_clock -period 10 [get_ports clk]\nset_driving_cell -lib_cell BUFX4 [get_ports d]' };
eq('set_driving_cell -pin Y равноценна записи без -pin', XT.checker.check(qEnv, 'create_clock -period 10 [get_ports clk]\nset_driving_cell -lib_cell BUFX4 -pin Y [get_ports d]').pass, true);
eq('set_driving_cell на лишнем порту – ошибка', XT.checker.check(qEnv, 'create_clock -period 10 [get_ports clk]\nset_driving_cell -lib_cell BUFX4 [get_ports {d clk}]').pass, false);

// ---------------------------------------------------------------- set_bus_skew: вывод D и ячейка – одна точка
const qSk = { id: 'sk', tool: 'vivado', design: two, solution: 'create_clock -period 10 [get_ports ca]\ncreate_clock -period 8 [get_ports cb]\nset_max_delay -datapath_only 8 -from [get_cells a_reg] -to [get_cells b_reg]\nset_bus_skew -from [get_cells a_reg] -to [get_cells b_reg] 8' };
eq('set_bus_skew с -to [get_pins …/D]', XT.checker.check(qSk, 'create_clock -period 10 [get_ports ca]\ncreate_clock -period 8 [get_ports cb]\nset_max_delay -datapath_only 8 -from [get_cells a_reg] -to [get_cells b_reg]\nset_bus_skew -from [get_cells a_reg] -to [get_pins b_reg/D] 8').pass, true);

// ---------------------------------------------------------------- выбор разрядов в проводах: цепочка сканирования
const chain = { elements: [{ id: 'c', t: 'in', name: 'tck' }, { id: 'si', t: 'in', name: 'scan_in' }, { id: 'se', t: 'in', name: 'scan_en' }, { id: 'so', t: 'out', name: 'scan_out' }, { id: 'r', t: 'sdff', name: 'core_reg', w: 4 }],
  wires: [{ from: 'c', to: 'r.CK' }, { from: 'se', to: 'r.SE' }, { from: 'si', to: 'r[0].SI' }, { from: 'r[0:2].Q', to: 'r[1:3].SI' }, { from: 'r[3].Q', to: 'so' }] };
const ch = XT.checker.runSession({ id: 'ch', tool: 'sdc', design: chain }, 'create_clock -name tck -period 40 [get_ports tck]\nset_case_analysis 1 [get_ports scan_en]');
eq('цепочка: r[0:2].Q → r[1:3].SI', ch.A.paths.map((p) => p.startName + '>' + p.endName).sort().join(' '), 'core_reg[0]>core_reg[1]/SI core_reg[1]>core_reg[2]/SI core_reg[2]>core_reg[3]/SI core_reg[3]>scan_out scan_in>core_reg[0]/SI');

console.log(`\nТесты движка: пройдено ${pass}, ошибок ${fail}`);
process.exit(fail ? 1 : 0);
