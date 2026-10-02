# How to write tasks for ConstraintLab

The goal of every task is to teach not only the syntax but also understanding: **why** a constraint
is needed, **when** it applies and **what** changes in the analysis if it is wrong. The question format
is described in `docs/bank-format.md`, the Russian terminology in `docs/terminology.md`; a model task file
is `bank/01_clocks.js` (its English translation: `bank/en/01_clocks.js`). Russian version of this guide:
`docs/authoring-guide.md`.

## Scenario

- A task describes a real situation: which device is connected (ADC, DAC, Ethernet
  physical-layer device, image sensor, memory), how it is connected and which parameters the
  data sheet gives. Use plausible but generic devices ("an ADC with a parallel CMOS output");
  do not present numbers as parameters of a specific part.
- All numbers needed for the solution are given in the text or in a table. Always state the units.
- Decimal separator: a comma in Russian text (3,2 нс), a point in English text (3.2 ns);
  in code and in input fields, always a point.
- End the text with a "**Task.** …" paragraph that states exactly what must be described.
  If a specific clock name is required, give it and enable `check.clockNames`.

## XDC or SDC

- The `tool` field sets the schematic and the checking mode: `'vivado'` for FPGA primitives, `'sdc'` for ASIC cells.
- The `lang` field tells the learner where the solution applies: `'both'` – the syntax is common to Vivado and ASIC tools,
  `'xdc'` – Vivado only (`set_property` properties, `set_bus_skew`, `-datapath_only`, automatic derivation
  of MMCM clocks), `'sdc'` – ASIC tools only (environment, design rules, CTS, OCV).
  The validator checks `lang` against the commands of the reference solution.
- `langNote` is one or two sentences on how this task differs between XDC and SDC. It is shown at the
  end of the explanation, not in the task statement, so it may reveal the essence of the solution.

## Schematic (design)

- Show the FPGA boundary (`boundary`), external devices (`chip`, `osc` with `ext: true`),
  ports, buffers, registers and logic. Clock nets use `kind: 'clk'`.
- Label external wires with trace delays if they are needed for the calculation.
- Instance names follow post-synthesis Vivado style: `adc_d_reg[%]`, `u_rx/sync_reg`.
- Check the figure visually: wires must not cross symbols or labels. All figures of a
  file on one page: `node tools/screenshot.js "file://$PWD/tools/dev/gallery.html?f=<file>.js"
  tools/dev/gal.json <dir>` (add `&lang=en` to the URL to see the English version).
- Junction dots and bus width slashes are placed automatically, so there is no need to draw them
  with labels ("●"). Cell type labels and wire labels are outlined in the background color, so a wire
  crossing a label is acceptable, but it is better avoided (`lx`/`ly`, `nameX`, `mx`, `via`).

## Timing diagram

- At least one timing diagram in nanoseconds (`kind: 'timing'`) for every task with I/O or a
  clock relationship: the data window, launch and capture edges, Tco, trace delays,
  setup and hold times (dimension arrows `spans`, windows `windows`, markers `marks`).
- The `caption` explains what is shown.

## Hints and explanation

- 2–3 hints: from a leading question ("which edge is the reference here?") to an almost complete answer.
- Explanation: the reference solution as code, derivation of the formulas with the numbers substituted,
  what happens with typical mistakes, how to verify the result in Vivado or PrimeTime.

## Tests

- At least one equivalent form (`pass: true`): variables and `expr`, another way to specify
  the objects, another clock name.
- At least two typical mistakes (`pass: false`) with `expect`: a regular expression that must
  match the diagnostic text (title and explanation).
- If there are several correct approaches with different effects, list them in `solutions`.
- The diagnostic text for any answer is easy to view from the console:
  `node tools/dev/q.js <file>.js <id> 'answer code'` (or `@ref`, `@ref2` for the reference solutions);
  `XT_LANG=en node tools/dev/q.js …` applies the English translation of the task.

## Shared names

- Bank files are loaded in `index.html` as ordinary scripts and share one global
  namespace. Name file constants shared by several tasks (schematic, reference solution)
  with the module prefix: `SSIN_DDR_DESIGN`, `SSOUT_RGMII_REF`. Reusing a name in another file
  causes a load error in that file.

## Language

- Russian texts: formal technical Russian without jargon or calques; for Russian texts see
  `docs/terminology.md`.
- English texts: standard STA terminology, as in AMD UG903/UG835 and the Synopsys and Cadence manuals
  (primary clock, generated clock, setup and hold, false path, multicycle path, clock domain crossing),
  American spelling. English translations of tasks go into `bank/en/` (see "English translations"
  in `docs/bank-format.md`).
- The em dash is not used in either language: only the en dash "–" (U+2013) or the hyphen "-".
- Check: `node tools/validate.js --only bank/<file>.js -v` must report no errors; for an English
  translation, also `node tools/i18n-check.js --only en/<file>.js`.
