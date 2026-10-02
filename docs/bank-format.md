# ConstraintLab: analysis model and task bank format

This document is for task authors and developers. How to use the program: [README.md](../README.md);
task authoring rules: [authoring-guide.en.md](authoring-guide.en.md); terminology for Russian texts:
[terminology.md](terminology.md). Russian version: [bank-format.ru.md](bank-format.ru.md).

## What ConstraintLab models

- A Tcl 8.6 subset interpreter (`set`, `expr` with integer division as in Tcl, lists,
  `foreach`, `if`, `proc`, `format`, etc.). In XDC mode, it warns about commands
  that Vivado does not allow in a managed XDC file.
- Objects: ports, cells (including hierarchical cells), pins, nets and clocks; patterns,
  `-hierarchical`, `-regexp`, `-filter`, `-of_objects`, `all_*`, collections.
- Clocks: primary, virtual and generated (`-divide_by`, `-multiply_by`, `-edges`,
  `-edge_shift`, `-invert`, `-duty_cycle`, `-combinational`, `-add`, `-master_clock`);
  clocks derived automatically from MMCM/PLL/BUFR/BUFGCE_DIV outputs (Vivado mode);
  renaming of automatically derived clocks; blocking of the master clock at the definition
  point of a generated clock; propagation through buffers, multiplexers and logic;
  `set_case_analysis`, `set_disable_timing`.
- Paths: from input ports and registers to output ports and to data inputs of registers
  (including asynchronous inputs); IDDR and ODDR DDR primitives; conditional library checks
  (the SI input of a scan flip-flop is checked only when SE = 1, the D input only when SE = 0).
- Comparison with the reference solution by meaning: less restrictive checks of DDR interfaces
  (they are never the worst case) may be excluded or kept; equivalent forms (`-to` on a cell
  or on its D pin, `set_driving_cell` with or without `-pin`) are accepted equally.
- Setup and hold requirements from clock edges over the common period, multicycle paths
  (`-setup/-hold`, `-start/-end`), false paths, `set_max_delay` (including `-datapath_only`),
  `set_min_delay`, clock groups, timing exception priorities; input/output delays with the
  correct `-add_delay` semantics.
- Physical XDC properties (`set_property`, `-dict`), ASIC environment (`set_load`,
  `set_driving_cell`, `set_clock_uncertainty`/`latency`/`transition`, etc.).

**Model limitation:** clocks are ideal; cell and routing delays are not computed.
ConstraintLab checks the meaning of the constraints (which requirements follow from them), not the
slack of a particular implementation. Final verification is done in Vivado or PrimeTime
(`report_timing_summary`, `check_timing`, `report_exceptions`, `report_clock_interaction`).

## How to add a task

Tasks are stored in the `bank/` directory. Each file is listed in `bank/index.js`:

```js
XT.BANK_FILES = [
  '01_clocks.js',
  '50_my.js',        // your file
];
```

You can also use the ⋮ menu → **Author mode**: it provides a template, task checking,
a preview and saving to "my bank" (in the browser) or to a `.js` file.
A finished file can be shared with others through the ⋮ menu → **Import a task pack**.

Checking the whole bank from the console (Node.js required):

```bash
node tools/validate.js            # short report
node tools/validate.js -v         # verbose
node tools/validate.js clocks.    # only tasks whose id contains "clocks."
```

The validator builds the design, renders the figures, checks that the reference solution passes
its own check and that the tests give the expected result, and searches the texts for em dashes.

### Module

```js
XT.bank.module({ id: 'my', order: 50, title: '50. My tasks', about: 'short description' });
```

### Question

```js
XT.bank.add({
  id: 'my.adc_in',            // unique identifier
  module: 'my',               // module
  order: 1,                   // order within the module
  title: 'ADC input',         // title
  tool: 'vivado',             // schematic and checking: 'vivado' (FPGA primitives) or 'sdc' (ASIC cells)
  lang: 'both',               // where the solution applies: 'both' (XDC and SDC), 'xdc' or 'sdc'
  langNote: '…',              // how XDC and SDC differ in this task (shown in the explanation)
  type: 'sdc',                // 'sdc' (write constraints), 'choice' (multiple choice), 'numeric' (calculation)
  level: 2,                   // difficulty 1..3
  tags: ['set_input_delay'],
  text: `Task statement in Markdown.`,
  design: { elements: [...], wires: [...] },   // design: both the schematic and the netlist
  figures: [ ... ],           // additional figures (timing diagrams, schematics)
  given: `...`,               // design constraints applied BEFORE the user's code (shown)
  after: `...`,               // design constraints applied AFTER the user's code (refer to its objects)
  starter: `...`,             // initial editor text (for example, code with mistakes)
  solution: `...`,            // reference solution
  solutions: [`...`, `...`],  // instead of solution: several equivalent reference solutions
  check: { ... },             // check settings (see below)
  hints: ['…', '…'],          // hints in order of increasing detail
  explain: `Explanation in Markdown`,
  refs: 'UG903, chapter "Constraining I/O Delay"',
  tests: [                    // self-test of the task (used by the validator)
    { code: '…', pass: true,  note: 'equivalent form' },
    { code: '…', pass: false, note: 'typical mistake', expect: 'regular expression for the diagnostic text' },
  ],
});
```

For `type: 'choice'`: `options: [{ text, ok: true, why }]`, `multi: true` for several correct answers.
For `type: 'numeric'`: `fields: [{ label, answer, tol, unit }]`.

### Design

The design description defines both the schematic (coordinates in pixels) and the netlist
for analysis. An element:

```js
{ id: 'r', t: 'ff', name: 'data_reg', w: 8, x: 300, y: 40 }
```

| `t` | Primitive | Pins | Notes |
|---|---|---|---|
| `in`, `out`, `inout` | port | `pad` (outside), the inner side has no name | `w` – bus width, `lsb`; `flip: true` – pad on the other side |
| `ff` | FDRE | C, D, CE, R, Q | `negedge: true` – falling edge; `ce: true`, `rst: 'R'` – show the pins |
| `fdce`, `fdpe`, `fdse` | FDCE/FDPE/FDSE | CLR/PRE are asynchronous | |
| `iddr` | IDDR | C, D, Q1, Q2 | capture on the rising and falling edges |
| `oddr` | ODDR | C, D1, D2, Q | launch on the rising and falling edges |
| `ibuf`, `obuf`, `ibufds`, `obufds`, `iobuf`, `obuft` | I/O buffers | I, O, IB, OB, IO, T | |
| `idelay` | IDELAYE2 | IDATAIN, DATAOUT | |
| `bufg`, `bufh`, `bufio`, `bufgce`, `bufgmux`, `bufr`, `bufgce_div` | clock buffers | I, O, CE, I0, I1, S | `attrs: { BUFR_DIVIDE: 4 }` |
| `mmcm`, `pll` | MMCME2_ADV, PLLE2_ADV | CLKIN1, CLKOUT0…6 | `mult`, `divclk`, `outs: [{ pin, div, phase, duty, clk, label }]` |
| `logic` | combinational logic | I (I0…I3 in the figure), O | `label`, `mix: true` – every output depends on all inputs |
| `ram` | RAMB36E1 | ADDRARDADDR, DIADI, WEA, CLKARDCLK, DOADO | |
| `block` | arbitrary block | `pins: [{ n, d, w, clk, side }]` | `timing: { seq, clk, launch, capture, async, arcs }` |
| `dff`, `dffn`, `dffr`, `sdff`, `sdffr` | ASIC flip-flops | CK, D, Q, RN, SI, SE | for scan flip-flops, D checks apply when SE = 0 and SI checks when SE = 1 |
| `buf`, `inv`, `and2`, `or2`, `nand2`, `nor2`, `xor2`, `mux2`, `ckmux2`, `icg`, `apll` | ASIC cells | A, B, S, Y, CK, E, GCK, REFCLK | |
| `vcc`, `gnd` | constants | P, G | |
| `chip`, `osc`, `conn` | external devices (figure only) | `pins: [{ n, side, y }]` | `ext: true`; `title` may contain a line break `\n` |
| `boundary`, `note`, `label` | chip boundary, note, label | | the boundary is fitted automatically |

Common fields: `name` (instance name, `%` stands for the bit index), `w` (number of instances/bits),
`noName`, `nameX`/`nameY` (offset of the name label), `tag`, `attrs`, `props` (initial properties),
`hidden` (present in the analysis, absent from the figure), `ext` (figure only).

Wire:

```js
{ from: 'bg.O', to: ['r1.C', 'r2.C'], kind: 'clk', label: 'sys_clk', net: 'sys_clk_g' }
```

`kind`: `clk` (clock, orange), `rst`, `ext` (off-chip, dashed); the default is
data. Widths are matched automatically: bus → bus bit by bit, single bit → bus as a
fanout. Routing: `mx` is the x coordinate of the vertical segment, `my` the y coordinate of a detour,
`via: [[x, y], …]` the intermediate points, `trunk` the offset of the common trunk at a branch,
`lx`/`ly` the label position. Individual bits of a multi-bit element or port are selected
in the name: `{ from: 'rc[0:6].Q', to: 'rc[1:7].SI' }` (scan chain), `{ from: 'psel[1]', to: 'mux.S' }`.
Junction dots are placed automatically where wires of the same net
meet in three or more directions. The bus width slash is placed automatically on a free
segment (not next to a junction dot); `noSlash: true` removes it.

### Timing diagram

```js
{
  kind: 'timing', title: 'Data window', t: [-2, 22],          // time range, ns
  signals: [
    { name: 'clk', clock: { period: 10, rise: 0, fall: 5, jitter: 0.2 }, arrows: 'rise' },
    { name: 'data', bus: [[1.2, 3.1, 'D0'], [11.2, 13.1, 'D1']], init: 'X' }, // [from, to, value]
    { name: 'valid', bit: [[2, 2.4, 1], [12, 12.4, 0]], init: 0 },
  ],
  marks:   [{ t: 0, label: 'launch', cls: 'launch' }],              // vertical markers
  spans:   [{ row: 'data', t0: 0, t1: 3.1, label: 'Tco max', cls: 'data' }], // dimension arrows
           // (lt: 1.5, anchor: 'start' – set the label position manually)
  windows: [{ row: 'data', t0: 8, t1: 10, label: 'tsu', cls: 'setup' }],    // shaded windows
  arrows:  [{ from: [0, 'clk', 'mid'], to: [3.1, 'data', 'mid'], label: '…' }],
  caption: 'caption below the figure',
}
```

A subset of WaveJSON (WaveDrom) is also supported: `{ kind: 'wave', wave: { signal: [...], edge: [...] } }`.

### Check settings (check)

| Field | Meaning |
|---|---|
| `clockNames: true` or `['name']` | require exact clock names |
| `requireVirtual: true` | require a virtual clock |
| `layers: ['clocks', 'io', 'paths', 'props', 'misc']` | compare only the listed layers |
| `strictProps: true` | treat extra properties as errors |
| `allowProps: { port: { PROPERTY: value } }` | extra properties allowed only with this value (for example, the N pin of a differential pair) |
| `require: [{ cmd, opt, msg }]` | required command (with an option) |
| `forbid: [{ cmd, opt, msg }]` | forbidden command |

## English translations

English overlays live in `bank/en/NN_*.js` (listed in `XT.BANK_FILES_EN` in `bank/index.js`) and are
loaded only when the interface language is English. Each file calls
`XT.bank.i18n('en', { modules, questions })`: `modules` maps a module id to its `title` and `about`,
and `questions` maps a question id to its translated fields `title`, `text`, `hints`, `explain`,
`langNote`, `tags`, `refs`, `options`, `fields`, `figures`, `check`, `code` and `strings`. Items of
`options`, `fields`, `figures` and `check.require`/`check.forbid` are merged with the original by index;
`code` holds `solution`, `solutions`, `starter`, `given` and `after` with translated comments.
`strings` maps Russian strings inside `design` and `figures` to English (only whole-string matches are
replaced; a top-level `strings` object applies to all questions). The translation is checked with
`node tools/i18n-check.js`. The language is switched with the EN/RU button or the `?lang=en` URL parameter.

## Terminology

Russian task texts and messages are written in formal technical Russian without jargon
(see [terminology.md](terminology.md)): «тактовый сигнал», not «клок»; «ограничения», not «констрейнты»;
«вывод», not «пин»; «коэффициент заполнения», not «скважность» in the sense of duty cycle.
English texts use standard STA terminology, as in AMD UG903 and the Synopsys and Cadence manuals.
The em dash is not used in either language: only the en dash "–" or the hyphen "-".

## Project structure

```
index.html          – the application
css/app.css         – styles (light and dark themes)
js/util.js          – exact fractions, Tcl lists, patterns
js/tcl.js           – Tcl interpreter
js/design.js        – primitive library, netlist, queries and filters
js/sdc.js           – XDC/SDC commands
js/sta.js           – clocks, paths, edge relationships, timing exceptions
js/checker.js       – comparison with the reference solution and diagnostics
js/reports.js       – console reports
js/schematic.js     – schematic drawing
js/wave.js          – timing diagrams
js/md.js, editor.js – Markdown, syntax highlighting, editor
js/refdocs.js       – command reference
js/refdocs.en.js    – English text of the command reference
js/app.js           – user interface
bank/               – task bank
bank/en/            – English translations of the task bank
tools/validate.js   – bank check (Node.js)
tools/i18n-check.js – check of the English translation of the bank (Node.js)
tools/test-engine.js – regression tests of the engine (Node.js)
tools/screenshot.js – screenshots of the interface in headless Chrome (for task authors)
tools/build.py      – single-file HTML build
tools/dev/q.js      – check one question from the console: verdict and command output
                      (node tools/dev/q.js 10_asic.js asic.test_mux @ref "check_timing")
tools/dev/gallery.html, gal.json – all figures of one bank file on a single page
tools/dev/smoke.json – end-to-end check of all questions in the browser (via tools/screenshot.js)
run.sh, run.bat     – launch in a separate window (Chrome/Edge app mode)
docs/               – task format, authoring guide, glossary
```
