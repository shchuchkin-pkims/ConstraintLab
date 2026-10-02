/* English translation of bank/10_asic.js (module 10: SDC for ASIC, block and clocks) */
XT.bank.i18n('en', {
  modules: {
    asic: {
      title: '10. SDC for ASIC: block and clocks',
      about: 'Block environment before clock tree synthesis, PLLs and clock dividers (create_generated_clock, -edges), operating modes and set_case_analysis, virtual clocks, changes after clock tree synthesis',
    },
  },
  questions: {
    // -------------------------------------------------------------------------
    'asic.block_basic': {
      title: 'Basic block SDC file: clock and environment',
      langNote: '`set_driving_cell`, `set_clock_transition`, `set_max_transition` and the clock tree latency estimate are not used in Vivado: FPGA clock networks are prebuilt. `create_clock` and the input/output delays are common to both.',
      text: `
        The digital block \`core_top\` is synthesized for **500 MHz**. It receives 8-bit data \`din[7:0]\` with the \`valid_in\` flag, processes it in one clock cycle and outputs the result \`dout[7:0]\` with the \`valid_out\` flag.

        The \`rst_n\` input is an external asynchronous reset. Inside the block it passes through the synchronizer \`u_rst_sync\`, and its requirements are described in a separate top-level constraint file. Therefore, this task sets **neither** a delay nor a driving cell for \`rst_n\`.

        The SoC architect has allocated the following budget to the block:

        | Parameter | Value |
        |---|---|
        | Clock \`clk\` | 500 MHz (T = 2.0 ns), 50% duty cycle |
        | Clock uncertainty | 0.12 ns for setup, 0.05 ns for hold |
        | Clock tree latency estimate (before clock tree synthesis) | 0.35 ns |
        | Clock transition (before clock tree synthesis) | 0.06 ns |
        | Input delays: all inputs except \`clk\` and \`rst_n\` | 60% of the period relative to \`clk\` = 1.2 ns |
        | Output delays: all outputs | 40% of the period relative to \`clk\` = 0.8 ns |
        | Driving cell of the inputs except \`clk\` and \`rst_n\` | library cell \`BUFX4\` |
        | Load on each output | 0.015 pF |
        | Maximum transition in the block | 0.15 ns |

        Library units: time in nanoseconds, capacitance in picofarads.

        **Task.** Write the SDC file for the \`core_top\` block: define the clock \`clk\` and all parameters from the table.
      `,
      strings: {
        'Блок core_top': 'Block core_top',
        'синхронизатор': 'synchronizer',
        'обработка': 'processing',
        'clk (порт)': 'clk (port)',
        'clk (регистры)': 'clk (registers)',
        'оценка дерева 0,35': 'tree estimate 0.35',
        'вход: 1,2 нс (60 %)': 'input: 1.2 ns (60%)',
        'выход: 0,8 нс (40 %)': 'output: 0.8 ns (40%)',
      },
      figures: [
        { caption: 'Orange lines are clocks, blue lines are data, purple lines are reset. Click an element to insert its query into the editor.' },
        {
          title: 'Block budget at T = 2 ns',
          caption: 'Input data appears 1.2 ns after the clk edge at the port; output data must settle 0.8 ns before the next edge. The clock at the registers shows the tree latency estimate and an uncertainty band 0.12 ns wide. Before clock tree synthesis, DC and PrimeTime add the latency estimate both to the launch time of the external data and to the capture time, so for paths through ports it cancels out, while the uncertainty reduces the budget.',
        },
      ],
      code: {
        solutions: [`create_clock -name clk -period 2.000 [get_ports clk]
set_clock_uncertainty -setup 0.120 [get_clocks clk]
set_clock_uncertainty -hold  0.050 [get_clocks clk]
set_clock_latency    0.350 [get_clocks clk]
set_clock_transition 0.060 [get_clocks clk]

set inputs [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]
set_input_delay  -clock clk 1.200 $inputs
set_output_delay -clock clk 0.800 [all_outputs]
set_driving_cell -lib_cell BUFX4 $inputs
set_load 0.015 [all_outputs]
set_max_transition 0.150 [current_design]`, `create_clock -name clk -period 2.000 [get_ports clk]
set_clock_uncertainty -setup 0.120 [get_clocks clk]
set_clock_uncertainty -hold  0.050 [get_clocks clk]
set_clock_latency    0.350 [get_clocks clk]
set_clock_transition 0.060 [get_clocks clk]

set inputs [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]
set_input_delay  -clock clk 1.200 $inputs
set_output_delay -clock clk 0.800 [all_outputs]
# cell output pin given explicitly (optional for a buffer)
set_driving_cell -lib_cell BUFX4 -pin Y $inputs
set_load 0.015 [all_outputs]
set_max_transition 0.150 [current_design]`],
      },
      hints: [
        'Start with the clock: `create_clock` on the `clk` port, T = 1000 / 500 = 2 ns. The parameters of the ideal clock (uncertainty, tree latency estimate, transition) are set with the `set_clock_*` commands on `[get_clocks clk]`.',
        'Different uncertainty values mean two `set_clock_uncertainty` commands, with `-setup` and `-hold`. The clock tree latency estimate is `set_clock_latency` **without** `-source`.',
        'Inputs without the clock port and the reset: `set inputs [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]`. Then: `set_input_delay -clock clk 1.2 $inputs`, `set_driving_cell -lib_cell BUFX4 $inputs`, `set_output_delay -clock clk 0.8 [all_outputs]`, `set_load 0.015 [all_outputs]`, `set_max_transition 0.15 [current_design]`.',
      ],
      explain: `
        \`\`\`
        create_clock -name clk -period 2.000 [get_ports clk]
        set_clock_uncertainty -setup 0.120 [get_clocks clk]
        set_clock_uncertainty -hold  0.050 [get_clocks clk]
        set_clock_latency    0.350 [get_clocks clk]
        set_clock_transition 0.060 [get_clocks clk]

        set inputs [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]
        set_input_delay  -clock clk 1.200 $inputs
        set_output_delay -clock clk 0.800 [all_outputs]
        set_driving_cell -lib_cell BUFX4 $inputs
        set_load 0.015 [all_outputs]
        set_max_transition 0.150 [current_design]
        \`\`\`
        **The clock before clock tree synthesis (CTS).** During logic synthesis the clock tree does not exist yet: the clock is *ideal* and arrives at all registers simultaneously, with zero latency and an infinitely steep edge. Three commands make this model realistic:
        - \`set_clock_uncertainty\` – a margin for oscillator jitter, the future clock tree skew and modeling error. For setup it shortens the period: 2.0 − 0.12 = 1.88 ns for a register-to-register path; for hold it requires the data to stay stable for another 0.05 ns after the edge. The values differ, so two commands are needed.
        - \`set_clock_latency\` (without \`-source\`) – the clock tree latency estimate (network latency). The times in reports become close to the future real ones. For paths through ports, DC and PrimeTime by default also add this estimate to the launch time of the external data (the \`-network_latency_included\` option of \`set_input_delay\` and \`set_output_delay\` disables this), so the I/O budgets before clock tree synthesis do not depend on it.
        - \`set_clock_transition\` – the transition at the register clock pins. The clock-to-output delay and the setup time in the library depend on the clock transition; without this command it would be taken as zero, and the estimates would be optimistic.

        **Block environment.**
        - \`set_input_delay 1.2\` – the external logic uses 60% of the period. The internal path from the port to the register gets 2.0 − 1.2 − 0.12 = 0.68 ns (minus the register setup time).
        - \`set_output_delay 0.8\` – the receiver needs 40% of the period. From the edge at the \`dout_reg\` register to the port, 2.0 − 0.8 − 0.12 = 1.08 ns remain (including the clock-to-output delay).
        - \`set_driving_cell -lib_cell BUFX4\` – the inputs are driven by a real cell with a finite output resistance: the EDA tool computes the input transition and a delay that depends on the port load. Without it, the input is treated as ideal. The \`-pin\` option (the cell output) is needed only for cells with several outputs.
        - \`set_load 0.015\` – the capacitance seen by the output driver (the input of the neighboring block plus the interconnect). The unit comes from the library (pF here).
        - \`set_max_transition 0.15 [current_design]\` – a design rule for the whole block: synthesis and physical implementation insert buffers and upsize cells wherever a transition exceeds 0.15 ns.

        **Why \`clk\` and \`rst_n\` are excluded.** \`all_inputs\` returns all inputs, including the clock input. An input delay on the clock port makes no sense (it is not data), and the clock transition before clock tree synthesis is set by \`set_clock_transition\`. For \`rst_n\`, a delay relative to \`clk\` would create recovery and removal checks at the synchronizer: for an asynchronous input these are spurious requirements that synthesis would try to meet.

        **Typical mistakes and their consequences:**
        - a single \`set_clock_uncertainty 0.12\` command without \`-setup\`/\`-hold\`: the hold requirement is overstated by 0.07 ns, and after clock tree synthesis unnecessary hold-fixing buffers will be inserted into the block;
        - \`set_clock_latency -source 0.35\`: this is latency *outside* the block (from the clock source to the port). After clock tree synthesis the network estimate is replaced by the real tree latency, but the \`-source\` latency remains: in reports the clock will arrive at the registers 0.35 ns later than it actually does, and the requirements of paths between \`clk\` and other clocks (for example, a virtual one) will shift by the same 0.35 ns;
        - \`set_load 15\` (femtofarads with a library in picofarads): the load is 1000 times the real one, and synthesis will insert huge output buffers;
        - a missing \`set_clock_transition\` or \`set_driving_cell\`: optimistic delays; the violations will show up only after physical implementation.

        **Verification.** In PrimeTime: \`report_clock -skew\` (uncertainty, latency and transition of the ideal clock), \`report_port -verbose\` (port delays, driving cells and loads), \`check_timing\` (ports without delays; \`rst_n\` is expected in the *no_input_delay* list here, since the reset is constrained at the top level), \`report_timing -from [get_ports {din[*]}]\`. In OpenSTA: \`report_clock_properties\`, \`check_setup\`, \`report_checks\`. In the ConstraintLab console: \`report_clocks\`, \`check_timing\`, \`report_timing -from [get_ports {din[*]}]\`.
      `,
    },

    // -------------------------------------------------------------------------
    'asic.pll_div': {
      title: 'PLL and clock divider: generated clocks in an ASIC',
      langNote: 'In Vivado these commands are not needed for MMCM/PLL outputs: the clocks are derived automatically. A register-based divider is described the same way in both.',
      text: `
        The SoC is clocked by an external **25 MHz** crystal oscillator connected to the \`ref_clk\` port. The analog PLL block \`u_pll\` multiplies the frequency by **16**: its output \`u_pll/CLKOUT0\` (400 MHz) clocks the core. The peripherals run at **200 MHz**: this clock is produced by a divide-by-2 circuit, the flip-flop \`div_reg\`, whose output is fed back to its D input through an inverter.

        The core registers \`core_reg[15:0]\` send data to the peripheral registers \`periph_reg[15:0]\`. Both clocks are derived from the same reference, so the transfer is synchronous and must be analyzed.

        In Vivado, the clocks at MMCM/PLL outputs are derived automatically. Design Compiler and PrimeTime know nothing about the multiplication factor: the library model of the analog block (Liberty, .lib) does not contain it, and the clock does not propagate through the PLL by itself.

        **Task.** Define three clocks: the reference clock \`ref_clk\` on the port, \`pll_clk\` at the PLL output and \`clk_div2\` at the divider output. The PLL and divider clocks must be related to the reference clock.
      `,
      strings: {
        '25 МГц': '25 MHz',
        'Кристалл': 'Chip',
        'CLKOUT0: 400 МГц': 'CLKOUT0: 400 MHz',
        'логика ядра': 'core logic',
        '400 МГц': '400 MHz',
        '200 МГц': '200 MHz',
        'ref_clk 25 МГц': 'ref_clk 25 MHz',
        'pll_clk 400 МГц': 'pll_clk 400 MHz',
        'clk_div2 200 МГц': 'clk_div2 200 MHz',
        'общий фронт': 'common edge',
        'T = 40 / 16 = 2,5 нс': 'T = 40 / 16 = 2.5 ns',
        'предустановка 2,5 нс': 'setup 2.5 ns',
      },
      figures: [
        { caption: 'Orange lines are clocks, blue lines are data, dashed lines are off-chip. The divider output div_reg/Q is a single net: it clocks periph_reg and returns to the D input through the inverter. Click an element to insert its query into the editor.' },
        {
          title: 'All clocks are referenced to the ref_clk edge',
          caption: 'The generated clocks are counted from the ref_clk edge: every 16th edge of pll_clk and every 8th edge of clk_div2 coincide with an edge of the reference clock. The core_reg → periph_reg path is launched by the pll_clk edge at 7.5 ns and captured by the nearest clk_div2 edge at 10 ns: the setup requirement is 2.5 ns, the hold requirement is 0.',
        },
      ],
      hints: [
        'The reference clock is a regular `create_clock` on the port: T = 1000 / 25 = 40 ns.',
        'The PLL output is described by a generated clock: `-source` is a point where the master clock is present (the `ref_clk` port or the `u_pll/REFCLK` pin), `-multiply_by 16`, and the definition point is `[get_pins u_pll/CLKOUT0]`.',
        'Divider: `create_generated_clock -name clk_div2 -source [get_pins div_reg/CK] -divide_by 2 [get_pins div_reg/Q]`. The master clock is at the clock input of the flip-flop, the generated clock at its output.',
      ],
      explain: `
        \`\`\`
        create_clock -name ref_clk -period 40.000 [get_ports ref_clk]
        create_generated_clock -name pll_clk -source [get_ports ref_clk] -multiply_by 16 [get_pins u_pll/CLKOUT0]
        create_generated_clock -name clk_div2 -source [get_pins div_reg/CK] -divide_by 2 [get_pins div_reg/Q]
        \`\`\`
        **Why the PLL output is described manually in an ASIC.** A PLL is an analog block (hard macro). Its library model describes the pins but not the frequency relationship: the multiplication factor is set by the dividers in the feedback loop and is often programmed after power-up. The REFCLK → CLKOUT timing arc in the model is either absent, in which case static timing analysis stops the clock at the PLL input, or describes only a delay, not the frequency multiplication. Vivado knows the MMCM/PLL parameters from the primitive settings and derives the clocks itself; in SDC, the designer does it.

        **What happens without \`pll_clk\`.** There is not a single clock beyond the PLL: \`check_timing\` reports registers without a clock (*no_clock*), and all core and peripheral paths remain unconstrained. Synthesis will not optimize them, and \`report_timing\` will not show a single violation: the report looks flawless, although nothing has been checked. This is the most dangerous kind of mistake.

        **Why a generated clock and not \`create_clock\` on CLKOUT0.** A generated clock keeps its relationship to the reference: reports show the master clock, the \`pll_clk\` period is recalculated automatically when the \`ref_clk\` period changes, and structural CDC verification tools treat such clocks as synchronous. In addition, PrimeTime models the delay compensation performed by the PLL feedback loop specifically with a generated clock (the \`-pll_feedback\` and \`-pll_output\` options of \`create_generated_clock\`): the clock tree latencies are then accounted for the way the real PLL compensates them. A primary clock on CLKOUT0 is independent, and all this information is lost. The reference point can also be specified at the PLL input: \`-source [get_pins u_pll/REFCLK]\`; the \`ref_clk\` clock is present there, and the result is the same.

        **Divider.** \`-source\` is the clock input of the flip-flop, \`div_reg/CK\`, where the master clock \`pll_clk\` is present; the definition point is the output \`div_reg/Q\`. \`-divide_by 2\` gives a period of 5 ns and the waveform {0 2.5}: the \`clk_div2\` edges coincide with every second \`pll_clk\` edge (an equivalent form is \`-edges {1 3 5}\`). The fact that \`div_reg/Q\` returns to the D input through an inverter does not affect the definition: it is an ordinary data path in the \`pll_clk\` domain.

        **Core → peripheral path.** Launch on the \`pll_clk\` edge at 7.5 ns, capture on the nearest \`clk_div2\` edge at 10 ns: the setup requirement is 2.5 ns, the hold requirement is 0. Without \`clk_div2\`, the \`periph_reg\` registers would have no clock.

        **Typical mistakes:**
        - \`create_clock -period 2.5 [get_pins u_pll/CLKOUT0]\`: an independent primary clock (see above);
        - a wrong factor (\`-multiply_by 8\`): a period of 5 ns instead of 2.5; the core is synthesized for half the required frequency, and the chip will not work at 400 MHz;
        - \`-source [get_pins div_reg/Q]\`: the source point and the definition point are swapped; the master clock is not present at the divider output, and the EDA tool cannot compute the generated clock (in PrimeTime, \`check_timing\` reports it in the *generated_clocks* section);
        - \`create_clock -period 5 [get_pins div_reg/Q]\` instead of a generated clock: the clock tree latency from the PLL to \`div_reg/CK\` and the clock-to-output delay of the divider drop out of the calculation, and the skew between the core and the peripherals (hundreds of picoseconds at a 2.5 ns period) will be estimated incorrectly.

        **Verification.** \`report_clock\` in PrimeTime (\`report_clocks\` in the ConstraintLab console): \`pll_clk\` and \`clk_div2\` show their master clocks. \`check_timing\` must not report *no_clock* or unexpandable generated clocks (*generated_clocks*). The cross-domain path: \`report_timing -from [get_cells {core_reg[*]}] -to [get_cells {periph_reg[*]}]\`.
      `,
    },

    // -------------------------------------------------------------------------
    'asic.div3': {
      title: 'Divide-by-3: 1/3 duty cycle and edge numbering',
      langNote: 'The `-edges` option is the same in XDC and SDC.',
      tags: ['create_generated_clock', '-edges', 'duty cycle', 'falling edge'],
      text: `
        The **100 MHz** clock \`clk\` enters the block port. The slow peripherals need a **33.3 MHz** clock produced by a divide-by-3 circuit:
        - the 2-bit counter \`cnt_reg[1:0]\` counts 0, 1, 2, 0, … on the rising edges of \`clk\`;
        - the register \`div3_q_reg\` (a DFF cell clocked by the rising edge of \`clk\`) outputs 1 for exactly one \`clk\` period out of three.

        The output \`div3_q_reg/Q\` is the clock \`clk_div3\`: the high level lasts **10 ns**, the low level **20 ns** (a duty cycle of 1/3).

        \`clk_div3\` clocks the registers \`slow_reg[7:0]\` (on the rising edge) and \`neg_reg[7:0]\` (on the falling edge, DFFN cells). Data from \`slow_reg\` must reach \`neg_reg\` within the high phase of \`clk_div3\`, and data going back through the \`u_slow\` logic must arrive within the low phase.

        **Task.** Define the clock \`clk\` and the generated clock \`clk_div3\` with its exact waveform, so that the \`slow_reg → neg_reg\` and \`neg_reg → slow_reg\` paths get the correct requirements.
      `,
      strings: {
        'Блок periph_top': 'Block periph_top',
        'запуск slow_reg ↑': 'launch slow_reg ↑',
        'захват neg_reg ↓': 'capture neg_reg ↓',
        'спад при -divide_by 3': 'fall with -divide_by 3',
        '10 нс': '10 ns',
        '20 нс': '20 ns',
        '15 нс': '15 ns',
      },
      figures: [
        { caption: 'Orange lines are clocks, blue lines are data. neg_reg (DFFN) is clocked by the falling edge of clk_div3. Click an element to insert its query into the editor.' },
        {
          title: 'clk edge numbers and the clk_div3 waveform',
          caption: 'The numbers above clk are the master clock edge numbers used by -edges: odd numbers are rising edges, even numbers are falling edges. div3_q_reg toggles only on the rising edges of clk: 1 (0 ns), 3 (10 ns), 7 (30 ns). The -divide_by 3 waveform ({1 4 7}) puts the falling edge at 15 ns, at a falling edge of clk, when the flip-flop output cannot change.',
        },
      ],
      hints: [
        'The `-divide_by 3` option gives a 50% duty cycle (a high level of 15 ns). The real signal is different: the waveform must be specified by the master clock edges with the `-edges` option.',
        'The `clk` edges are numbered from 1: 1 is the rising edge at 0 ns, 2 the falling edge at 5 ns, 3 the rising edge at 10 ns, and so on. `-edges {e1 e2 e3}`: the rising edge of the generated clock coincides with e1, its falling edge with e2, and the next rising edge with e3.',
        'The `div3_q_reg` output goes to 1 on edge 1 (0 ns), to 0 on edge 3 (10 ns) and back to 1 on edge 7 (30 ns): `create_generated_clock -name clk_div3 -source [get_pins div3_q_reg/CK] -edges {1 3 7} [get_pins div3_q_reg/Q]`.',
      ],
      explain: `
        \`\`\`
        create_clock -name clk -period 10.000 [get_ports clk]
        create_generated_clock -name clk_div3 -source [get_pins div3_q_reg/CK] -edges {1 3 7} [get_pins div3_q_reg/Q]
        \`\`\`
        **Edge numbering.** The \`-edges\` option lists the numbers of master clock events at the \`-source\` pin: odd numbers are rising edges, even numbers are falling edges.

        | Number | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
        |---|---|---|---|---|---|---|---|
        | \`clk\` event | rise | fall | rise | fall | rise | fall | rise |
        | Time, ns | 0 | 5 | 10 | 15 | 20 | 25 | 30 |

        The three numbers set the rising edge of the generated clock, its falling edge and the next rising edge. \`div3_q_reg\` is clocked by the rising edge, so its output changes only on odd events: it goes to 1 on edge 1, to 0 on edge 3 and back to 1 on edge 7. Hence \`{1 3 7}\`: a period of 30 ns, a high level of 10 ns, the waveform {0 10}.

        **Path requirements.**
        - \`slow_reg → neg_reg\` (rising → falling edge of \`clk_div3\`): setup 10 ns.
        - \`neg_reg → u_slow → slow_reg\` (falling → rising edge): setup 20 ns.
        - The counter paths (\`cnt_reg → cnt_reg\`, \`cnt_reg → div3_q_reg\`) are analyzed in the \`clk\` domain: 10 ns.

        **Why not \`-divide_by 3\`.** \`-divide_by N\` is equivalent to \`-edges {1 N+1 2N+1}\`, that is, \`{1 4 7}\`: the falling edge lands on event 4, the falling edge of \`clk\` at 15 ns. A flip-flop clocked by the rising edge cannot switch there. With the {0 15} waveform, the \`slow_reg → neg_reg\` path would get 15 ns instead of 10: the analysis is **optimistic by 5 ns**, and synthesis would leave a path that fails timing in silicon. The reverse path would get 15 ns instead of 20, an unnecessarily tight requirement.

        **Other mistakes:**
        - \`-edges {1 2 7}\`: the falling edge at 5 ns (event 2 is a falling edge of \`clk\`), a duty cycle of 1/6; the \`slow_reg → neg_reg\` path gets only 5 ns;
        - \`-edges {1 3 5}\`: this is division by 2 (a 20 ns period);
        - \`create_clock -period 30 -waveform {0 10} [get_pins div3_q_reg/Q]\`: the waveform is right, but the clock is primary; the clock tree latency to \`div3_q_reg/CK\` and the clock-to-output delay of the divider are not accounted for, and the relationship with \`clk\` for cross-domain paths is lost.

        If the divider really produces a symmetrical signal (for example, with a second flip-flop on the falling edge and an OR gate at the output), the waveform \`{1 4 7}\` and the \`-divide_by 3\` form are correct. The waveform is always taken from the actual divider circuit. Individual edges are shifted by a given time with the \`-edge_shift\` option (only together with \`-edges\`), and in SDC \`-duty_cycle\` can only be combined with \`-multiply_by\`.

        **Verification.** \`report_clock\` (\`report_clocks\` in the ConstraintLab console): \`clk_div3\` has a 30 ns period and the waveform {0 10}. Then \`report_timing -from [get_cells {slow_reg[*]}] -to [get_cells {neg_reg[*]}]\`: the requirement is 10 ns.
      `,
    },

    // -------------------------------------------------------------------------
    'asic.test_mux': {
      title: 'Functional mode: test clock multiplexer and scan',
      langNote: '`set_case_analysis` also exists in Vivado (for example, for a static selection on a BUFGMUX); scan flip-flops and test modes are an ASIC topic.',
      tags: ['set_case_analysis', 'CKMUX2', 'scan', 'operating modes'],
      text: `
        The core is clocked through the clock multiplexer \`u_clk_mux\` (a CKMUX2 cell): with \`test_mode = 0\` the registers receive the functional clock \`func_clk\` at **250 MHz**, with \`test_mode = 1\` the test clock \`tck\` at **20 MHz**. Both clocks enter through ports. \`tck\` also clocks the JTAG controller \`u_tap\`, which operates in functional mode too (debug access).

        The core registers \`core_reg[7:0]\` are scan flip-flops (SDFF): with \`scan_en = 1\` they load data from the SI input (the scan chain starts at the \`scan_in\` port), with \`scan_en = 0\` from the functional D input.

        An SDC file is needed for static timing analysis of the **functional mode**, in which \`test_mode\` and \`scan_en\` are always 0. The scan ports are not used in this mode, and no delays are set for them.

        **Task.** Define the clocks \`func_clk\` and \`tck\` and fix the functional mode with constants on the \`test_mode\` and \`scan_en\` ports: only \`func_clk\` must reach the core registers, and paths through the scan enable input must not be analyzed.
      `,
      strings: {
        'Блок core_top': 'Block core_top',
        'логика ядра': 'core logic',
        'контроллер JTAG (TAP)': 'JTAG controller (TAP)',
        'func_clk 250 МГц': 'func_clk 250 MHz',
        'tck 20 МГц': 'tck 20 MHz',
        'запуск func_clk': 'launch func_clk',
        'захват tck': 'capture tck',
        'предустановка 2 нс': 'setup 2 ns',
      },
      figures: [
        { caption: 'Orange lines are clocks, blue lines are data and control signals. Multiplexer input 0 is selected when test_mode = 0. Click an element to insert its query into the editor.' },
        {
          title: 'Without set_case_analysis: func_clk and tck on the same registers',
          caption: 'If tck is not stopped at the multiplexer, both clocks reach core_reg, and the EDA tool checks the func_clk → tck and tck → func_clk paths. Over the common period of 100 ns, the worst edge pair is only 2 ns apart (48 → 50 ns): a requirement that does not exist in any real mode, since test_mode is set statically and does not toggle during operation.',
        },
      ],
      hints: [
        'Both clocks are defined on ports: 250 MHz → 4 ns, 20 MHz → 50 ns. `tck` is needed in functional mode too: it clocks the TAP controller.',
        'A mode is fixed with constants on the control inputs: `set_case_analysis <value> <ports>`. The EDA tool propagates the constant through the logic and disables the inactive multiplexer inputs.',
        '`set_case_analysis 0 [get_ports test_mode]`: the multiplexer passes only `func_clk`; `set_case_analysis 0 [get_ports scan_en]`: the flip-flops take data from the D input.',
      ],
      explain: `
        \`\`\`
        create_clock -name func_clk -period 4.000 [get_ports func_clk]
        create_clock -name tck -period 50.000 [get_ports tck]
        set_case_analysis 0 [get_ports test_mode]
        set_case_analysis 0 [get_ports scan_en]
        \`\`\`
        **How \`set_case_analysis\` works.** The command sets a logic constant, and the EDA tool propagates it through the cells just as the logic circuit would. A constant 0 on \`u_clk_mux/S\` disables the B → Y and S → Y timing arcs of the multiplexer: \`tck\` stops at its input, and only \`func_clk\` reaches \`core_reg\`. A constant 0 on \`scan_en\` makes the SE pins constant: there are no paths from the \`scan_en\` port, and the checks on the SI input, which the scan flip-flop library usually conditions on SE = 1, are disabled as well. The TAP controller is connected to \`tck\` directly and is still analyzed at 20 MHz. The constants are set on the ports, not on the \`u_clk_mux/S\` pin: in a real design, \`test_mode\` and \`scan_en\` control hundreds of test logic cells, and a constant on the port propagates to all of them at once.

        **What happens without \`set_case_analysis\`.** Both clocks pass through the multiplexer: \`check_timing\` reports multiple clocks on clock pins (*multiple_clock*), and the EDA tool checks the \`core_reg → core_reg\` paths for all four pairs: \`func_clk → func_clk\` (4 ns), \`tck → tck\` (50 ns) and the cross-domain \`func_clk → tck\` and \`tck → func_clk\` with a 2 ns requirement (see the timing diagram). Synthesis will spend area and power on meeting non-existent requirements, and the reports will be cluttered with false violations.

        **\`set_case_analysis 1\`** is the test mode: only \`tck\` reaches the core, and the core logic is analyzed at 20 MHz instead of 250 MHz. Functional-mode violations become invisible.

        **\`set_clock_groups -logically_exclusive -group func_clk -group tck\`** instead of constants removes only the cross-domain checks. Both clocks still reach \`core_reg\`, and the paths through \`scan_en\` remain. This technique is used in merged-mode analysis, when several modes are checked in one run. For the multiplexer output, one generated clock is then defined per input (\`-combinational\`, \`-add\`, \`-master_clock\`), and these clocks are declared \`-physically_exclusive\`. This saves runs, but the analysis keeps paths that exist only in test mode. For sign-off of the functional mode, a separate SDC file with \`set_case_analysis\` is more accurate and simpler; the test mode gets its own file (\`test_mode = 1\`, \`scan_en = 1\` for shift, delays on the scan ports).

        **Verification.** In PrimeTime: \`report_case_analysis\` (active constants), \`report_disable_timing\` (arcs disabled by constants), \`check_timing\`: there must be no *multiple_clock* warning. In the ConstraintLab console: \`check_timing\` reports no issues, and \`report_clock_interaction\` shows the single pair \`func_clk → func_clk\` (the internal paths of the TAP controller are not shown in the schematic). ConstraintLab, like the library, performs the SI input checks only when SE = 1, so after \`set_case_analysis 0 [get_ports scan_en]\` the \`scan_in\` port does not appear in the list of inputs without a delay: it is constrained in the SDC file of the test mode.
      `,
    },

    // -------------------------------------------------------------------------
    'asic.vclk_io': {
      title: 'Virtual clock for block I/O budgets',
      langNote: 'Virtual clocks and input/output delays are common to both; in an ASIC this is how the budgets of the blocks of a chip are specified.',
      tags: ['create_clock', 'virtual clock', 'set_input_delay', 'set_output_delay'],
      text: `
        The block \`dsp_core\` runs at **400 MHz** (T = 2.5 ns) and exchanges data with neighboring blocks of the chip: the source block \`u_src\` sends it 16-bit data \`din[15:0]\`, and the receiving block \`u_dst\` takes the result \`dout[15:0]\`. All three blocks are clocked by different branches of the same clock tree, that is, by the same 400 MHz clock.

        The budget agreed at the chip level:
        - the source block outputs data **1.1 ns** after its clock edge;
        - the receiving block requires the data to be at its inputs **0.7 ns** before its clock edge (an output delay of 0.7 ns).

        For simplicity, each value sets both bounds: the commands are written without \`-max\` and \`-min\`.

        The internal clock of the block is defined on the \`clk\` port. The neighboring blocks launch and capture data with the edges at their own registers; these edges are delayed by their own tree branches and do not coincide with the edge at the \`clk\` port of \`dsp_core\`. Therefore, the external clock is usually described separately, as a **virtual** clock.

        **Task.** Define the clock \`clk\` on the port, a virtual clock with the same period (for example, \`vclk\`), and the input/output delays relative to the virtual clock.
      `,
      strings: {
        'источник u_src': 'source u_src',
        'через 1,1 нс\nпосле фронта CK': '1.1 ns after\nthe CK edge',
        'Блок dsp_core': 'Block dsp_core',
        'обработка': 'processing',
        'приёмник u_dst': 'receiver u_dst',
        'нужны за 0,7 нс\nдо фронта CK': 'needed 0.7 ns\nbefore CK edge',
        'корень тактового дерева 400 МГц': 'clock tree root, 400 MHz',
        'din на входе': 'din at input',
        'dout на выходе': 'dout at output',
        'фронт во всех блоках': 'edge in all blocks',
        'следующий фронт': 'next edge',
        'u_src: 1,1 нс': 'u_src: 1.1 ns',
        'dsp_core: 1,4 нс': 'dsp_core: 1.4 ns',
        'dsp_core: 1,8 нс': 'dsp_core: 1.8 ns',
        'u_dst: 0,7 нс': 'u_dst: 0.7 ns',
      },
      figures: [
        { caption: 'Orange lines are the block clocks, blue lines are data, dashed lines are the neighboring blocks and the clock tree branches outside dsp_core. Click an element to insert its query into the editor.' },
        {
          title: 'Budgets relative to the common edge, T = 2.5 ns',
          caption: 'Input: data appears 1.1 ns after the edge of the source block, leaving 2.5 − 1.1 = 1.4 ns for the internal path of dsp_core. Output: data must settle 0.7 ns before the edge of the receiving block, so the path from dout_reg to the port gets 2.5 − 0.7 = 1.8 ns (not counting uncertainty and setup time).',
        },
      ],
      hints: [
        'A virtual clock is a `create_clock` **without objects**; the `-name` option is mandatory for it.',
        'The virtual clock has the same period, 2.5 ns: the neighboring blocks are clocked by the same 400 MHz clock, only through other tree branches.',
        '`set_input_delay -clock vclk 1.1 [get_ports {din[*]}]` and `set_output_delay -clock vclk 0.7 [get_ports {dout[*]}]`. The values are the time used *outside* the block: the source delay after the edge and the margin the receiver needs before the edge.',
      ],
      explain: `
        \`\`\`
        create_clock -name clk  -period 2.500 [get_ports clk]
        create_clock -name vclk -period 2.500
        set_input_delay  -clock vclk 1.100 [get_ports {din[*]}]
        set_output_delay -clock vclk 0.700 [get_ports {dout[*]}]
        \`\`\`
        **What the virtual clock describes.** \`vclk\` is not attached to any design object: it models the clock *at the registers of the neighboring blocks*. The input/output delays are measured from its edges, while the internal registers of \`dsp_core\` are clocked by \`clk\`. Since both clocks have the same period and zero phase, the EDA tool analyzes the transfer as synchronous: the input gets 2.5 − 1.1 = 1.4 ns, the output 2.5 − 0.7 = 1.8 ns (minus uncertainty and setup time).

        **Why a separate clock if the period is the same.**
        - *Independent parameters of the external side.* The tree branch latency of a neighboring block is set on the virtual clock: \`set_clock_latency 0.40 [get_clocks vclk]\`; the uncertainty of the transfers between blocks is \`set_clock_uncertainty -from [get_clocks vclk] -to [get_clocks clk] …\`. The internal \`clk\` stays unchanged.
        - *Consistency before and after clock tree synthesis.* After CTS, \`clk\` is switched to the \`set_propagated_clock\` mode: the \`dsp_core\` registers get the real tree latency (say, 0.4 ns). Ports have no tree, so delays specified relative to \`clk\` would be measured from the edge at the port with zero latency. The analysis would assume that the neighboring block outputs data 0.4 ns earlier than it actually does: the input would get an extra 0.4 ns (optimistic), and the output would lose it (pessimistic). A virtual clock is always ideal, its \`set_clock_latency\` applies after CTS as well, and the budgets stay honest. That is why a real flow adds \`set_clock_latency\` for \`vclk\` (an estimate of the branch latency of the neighboring blocks) and the same estimate for \`clk\` before CTS; this task gives no tree latencies, so the reference solution has none.
        - *Clean separation of budgets.* The block I/O constraints are usually produced by top-level budgeting, and they must not depend on how the clock is structured inside the block (clock gating, dividers, renamed clocks).

        **Typical mistakes:**
        - delays relative to \`clk\`: before clock tree synthesis the numbers in the report are the same, but after CTS the budgets shift by the tree latency (see above);
        - \`set_input_delay 1.4\` (= 2.5 − 1.1): the command takes the time used **outside** the block, not the time remaining inside; otherwise the input gets only 1.1 ns instead of 1.4;
        - \`set_output_delay 1.8\` (= 2.5 − 0.7): the same mistake for the output; the output path would be required to take 0.7 ns instead of 1.8, and synthesis would speed it up for nothing;
        - a virtual clock with a different period: the requirements of the I/O paths are then determined by the worst edge pair over the common period, and they will not match the real transfer.

        **Verification.** \`report_clock\` (\`report_clocks\` in the ConstraintLab console): \`vclk\` is virtual, without a source. \`report_timing -from [get_ports {din[*]}]\`: the launch edge is \`vclk\`, the input delay is 1.1 ns, the capture is \`clk\`. \`check_timing\` must not report inputs without a delay (*no_input_delay*) or unconstrained endpoints (*unconstrained_endpoints*); in the ConstraintLab console, ports without delays (*no_input_delay*, *no_output_delay*).
      `,
    },

    // -------------------------------------------------------------------------
    'asic.cts': {
      title: 'What changes in the SDC after clock tree synthesis?',
      langNote: 'In an FPGA, the clock networks are prebuilt and always propagated; there is no clock tree synthesis.',
      tags: ['set_propagated_clock', 'CTS', 'set_clock_latency', 'set_clock_uncertainty', 'understanding'],
      text: `
        The SDC file of the \`core_top\` block from the task [[q:asic.block_basic|"Basic block SDC file"]] was used for logic synthesis. Now clock tree synthesis (CTS) has been run in Innovus: a tree of CKBUF cells has been built, and the real latency from the \`clk\` port to the register clock pins ranges from 0.31 to 0.39 ns. The block is being prepared for sign-off static timing analysis in PrimeTime.

        An excerpt from the original file (setup uncertainty 0.12 ns = jitter 0.04 ns + tree skew estimate 0.06 ns + margin 0.02 ns; hold uncertainty 0.05 ns = skew 0.03 ns + margin 0.02 ns):

        \`\`\`
        create_clock -name clk -period 2.000 [get_ports clk]
        set_clock_uncertainty -setup 0.120 [get_clocks clk]
        set_clock_uncertainty -hold  0.050 [get_clocks clk]
        set_clock_latency    0.350 [get_clocks clk]
        set_clock_transition 0.060 [get_clocks clk]
        set_input_delay  -clock clk 1.200 $inputs
        set_output_delay -clock clk 0.800 [all_outputs]
        set_driving_cell -lib_cell BUFX4 $inputs
        set_load 0.015 [all_outputs]
        set_max_transition 0.150 [current_design]
        \`\`\`

        **Task.** Select all changes that must be made to the SDC file for analysis after clock tree synthesis.
      `,
      strings: {
        'Блок core_top после CTS': 'Block core_top after CTS',
        'обработка': 'processing',
        '0,31 нс': '0.31 ns',
        '0,39 нс': '0.39 ns',
        'clk на порту': 'clk at port',
        'до CTS: оценка': 'before CTS: estimate',
        'после CTS: din_reg': 'after CTS: din_reg',
        'после CTS: dout_reg': 'after CTS: dout_reg',
        'set_clock_latency 0,35 нс': 'set_clock_latency 0.35 ns',
        'дерево: 0,31 нс': 'tree: 0.31 ns',
        'дерево: 0,39 нс': 'tree: 0.39 ns',
        'перекос 0,08 нс': 'skew 0.08 ns',
      },
      figures: [
        { caption: 'The clock tree after CTS: a root buffer and two branch buffers. The labels show the real latency from the clk port to the register clock pins. Click an element to insert its query into the editor.' },
        {
          title: 'Clock at the registers before and after CTS',
          caption: 'Before CTS the clock is ideal: one latency estimate for all registers and an uncertainty band 0.12 ns wide, which includes the expected skew. After CTS each register has its own computed latency, and the skew (0.08 ns here) enters the analysis directly.',
        },
      ],
      options: [
        { text: 'Add `set_propagated_clock [all_clocks]`.', why: 'Correct. Without this command PrimeTime keeps treating the clock as ideal: the real tree latency and skew do not enter the analysis. Place-and-route tools (Innovus, IC Compiler II) usually switch the clocks to this mode themselves after CTS, but the SDC file for sign-off in PrimeTime states the command explicitly.' },
        { text: 'Remove the clock tree latency estimate `set_clock_latency 0.350` (without `-source`).', why: 'Correct. For a propagated clock, the network latency is computed from the tree, and the estimate is ignored: keeping it is pointless and only causes confusion. The latency outside the block (`set_clock_latency -source`), if specified, is kept: it is not part of the block tree.' },
        { text: 'Reduce `set_clock_uncertainty`: keep the jitter and the margin, remove the skew estimate.', why: 'Correct. The skew is now computed from the real latencies to each register. If it is also left in the uncertainty, it is counted twice: the analysis becomes overly pessimistic (extra hold-fixing buffers, lost frequency). Here: 0.06 ns for setup and 0.02 ns for hold.' },
        { text: '`set_clock_transition` is no longer needed.', why: 'Correct. The transition at each clock pin is now computed from the real tree cells and their loads; for propagated clocks the command is ignored.' },
        { text: 'Change `create_clock`: define the clock at the output of the root buffer `u_cts_root`.', why: 'Incorrect. The period and the definition point do not change: the clock still enters the block through the `clk` port, and the latency from the port through all tree buffers is exactly what must be accounted for. A clock at the buffer output would exclude part of the tree from the analysis.' },
        { text: 'Adjust the values in `set_input_delay` and `set_output_delay` by the latency of the built clock tree.', why: 'Incorrect. These values describe the external side: how much time the logic outside the block takes relative to the clock edge at its source. Nothing outside the block has changed after CTS, so the values stay the same, and PrimeTime accounts for the real latency to the internal registers itself. The fact that after CTS the input paths get more time and the output paths less is a physical effect that the analysis is supposed to show. If the external side is itself clocked by a branch of the same tree (neighboring blocks of the chip), its latency is described not by editing the values but with `set_clock_latency` on a virtual clock: it applies after CTS as well.' },
        { text: 'Remove `set_driving_cell`, `set_load` and `set_max_transition`: they are not needed after physical implementation.', why: 'Incorrect. They describe the block environment and a design rule, which apply at all stages. After CTS, the constraints on clock nets are often even tightened with a separate `set_max_transition -clock_path` command.' },
      ],
      hints: [
        'Think about which commands describe the *ideal* clock, that is, stand in for the tree that has not been built yet.',
        'The external environment of the block (period, ports, input/output delays, loads) does not depend on the clock tree synthesis inside the block.',
      ],
      explain: `
        | Command | Before CTS | After CTS |
        |---|---|---|
        | \`create_clock\` | on the \`clk\` port | unchanged |
        | \`set_propagated_clock\` | – | \`[all_clocks]\` |
        | \`set_clock_latency\` (network) | estimate 0.35 ns | removed: the latency is computed from the tree |
        | \`set_clock_latency -source\` | latency outside the block | unchanged |
        | \`set_clock_uncertainty\` | jitter + skew + margin | jitter + margin |
        | \`set_clock_transition\` | estimate 0.06 ns | removed: computed from the tree |
        | input/output delays, environment, design rules | as in the original file | unchanged |

        The SDC file for the analysis after CTS:

        \`\`\`
        create_clock -name clk -period 2.000 [get_ports clk]
        set_propagated_clock [all_clocks]
        set_clock_uncertainty -setup 0.060 [get_clocks clk] ;# without skew
        set_clock_uncertainty -hold  0.020 [get_clocks clk] ;# without skew
        set_input_delay  -clock clk 1.200 $inputs
        set_output_delay -clock clk 0.800 [all_outputs]
        set_driving_cell -lib_cell BUFX4 $inputs
        set_load 0.015 [all_outputs]
        set_max_transition 0.150 [current_design]
        \`\`\`
        **The logic of the changes.** Before CTS, three commands (\`set_clock_latency\`, \`set_clock_transition\` and part of \`set_clock_uncertainty\`) *stand in* for the tree that has not been built yet. After CTS the tree exists, and PrimeTime computes its latency, skew and transitions itself, provided that the clock is declared propagated. Everything that describes the world *outside* the block stays the same.

        **What changes in the I/O budgets.** Before CTS, the 0.35 ns estimate was added both to the launch of the external data and to the capture, so it canceled out. After CTS the port has no tree latency, while the registers have the real one: the input paths get about 0.35 ns more, and the output paths lose the same amount. This is not a constraint error but physics: the external edge arrives at the port, and the internal registers see it later. That is why, for outputs with a tight budget, designers try to reduce the tree latency to the output registers during CTS, and transfers between blocks of the same chip are constrained with a virtual clock (see the [[q:asic.vclk_io|task on the virtual clock]]).

        **Verification in PrimeTime:** \`report_clock -skew\` and \`report_clock_timing -type skew\` (real latency and skew), \`report_timing -path_type full_clock_expanded\` (the clock path through the tree buffers), \`check_timing -include {ideal_clocks}\`: no clocks may remain ideal.
      `,
    },
  },
});
