/* English translation of bank/11_asic_modes.js (module 11: SDC for ASIC, modes, scan, clock gating) */
XT.bank.i18n('en', {
  modules: {
    asic_modes: {
      title: '11. SDC for ASIC: modes, scan, clock gating',
      about: 'A separate SDC file for scan shift mode, a programmable divider and clock multiplexers in merged mode, clock gating (ICG and AND gate), ideal reset and scan enable networks during synthesis, the set of modes for sign-off',
    },
  },
  questions: {
    // -------------------------------------------------------------------------
    'asic.scan_shift': {
      title: 'Scan shift mode: a separate SDC file',
      langNote: '`set_case_analysis` and input/output delays also exist in XDC, but scan chains and separate SDC files for test modes are ASIC practice: FPGAs have no scan.',
      tags: ['set_case_analysis', 'scan', 'operating modes', 'set_input_delay'],
      text: `
        The \`core_top\` block from the task [[q:asic.test_mux|"Functional mode"]] is tested in production with scan. The tester applies the scan clock to the \`tck\` port (**25 MHz**, T = 40 ns); with \`test_mode = 1\` the multiplexer \`u_clk_mux\` passes it to the core flip-flops.

        In **shift** mode (\`scan_en = 1\`) the scan flip-flops \`core_reg[7:0]\` form a chain: \`scan_in → core_reg[0]/SI\`, \`core_reg[i]/Q → core_reg[i+1]/SI\`, \`core_reg[7]/Q → scan_out\`. The tester shifts a test pattern in through \`scan_in\` and at the same time shifts the response to the previous pattern out through \`scan_out\`.

        Tester timing relative to the \`tck\` edge at the chip pins:

        | Parameter | Value |
        |---|---|
        | the tester changes \`scan_in\` | 5 ns after the edge (one value for -max and -min) |
        | the tester samples \`scan_out\` | data is needed 8 ns before the next edge (one value for -max and -min) |

        The functional clock \`func_clk\` is defined in the common clock file (the "Already in the project" box).

        **Task.** Write the SDC file for shift mode: define the clock \`tck\`, fix the mode with constants on the \`test_mode\` and \`scan_en\` ports, and set the delays for \`scan_in\` and \`scan_out\`.
      `,
      strings: {
        'Блок core_top': 'Block core_top',
        'логика ядра': 'core logic',
        'tck 25 МГц': 'tck 25 MHz',
        'фронт tck': 'tck edge',
        'следующий фронт': 'next edge',
        'вход: 5 нс': 'input: 5 ns',
        'выход: 8 нс': 'output: 8 ns',
      },
      figures: [
        { caption: 'Orange lines are clocks, blue lines are data and control signals. The loop from the Q output to the SI input is the scan chain: Q[6:0] → SI[7:1], and the last bit Q[7] goes to scan_out. Click an element to insert its query into the editor.' },
        {
          title: 'Shift: the tester and the chain over one tck period',
          caption: 'The tester changes scan_in 5 ns after the tck edge and samples scan_out 8 ns before the next edge. Inside the chip, each stage of the chain passes a bit to the next one in one period. The Q → SI path is very short, so the danger is not setup but hold.',
        },
      ],
      hints: [
        'This is a separate file for a different mode: define the scan clock `tck` on its port (T = 1000 / 25 = 40 ns).',
        'The mode is fixed with constants: `test_mode = 1` (the multiplexer passes `tck`) and `scan_en = 1` (the flip-flops take data from the SI input).',
        '`set_input_delay -clock tck 5 [get_ports scan_in]` and `set_output_delay -clock tck 8 [get_ports scan_out]`.',
      ],
      explain: `
        \`\`\`
        create_clock -name tck -period 40.000 [get_ports tck]
        set_case_analysis 1 [get_ports test_mode]
        set_case_analysis 1 [get_ports scan_en]
        set_input_delay  -clock tck 5.000 [get_ports scan_in]
        set_output_delay -clock tck 8.000 [get_ports scan_out]
        \`\`\`
        **Why a separate file.** Each mode has its own clock path and its own active checks. The functional SDC file (the [[q:asic.test_mux|functional mode task]]) fixes \`test_mode = 0\` and \`scan_en = 0\`, the shift mode file fixes \`test_mode = 1\` and \`scan_en = 1\`. At sign-off both files are analyzed as different modes: in Cadence tools as constraint modes in the MMMC configuration, in PrimeTime as separate scenarios.

        **What the constants do.**
        - \`test_mode = 1\`: the multiplexer \`u_clk_mux\` passes \`tck\`, while \`func_clk\` stops at input A and has no effect in this mode.
        - \`scan_en = 1\`: in the scan flip-flop library, the SI input checks are conditioned on SE = 1, and the D input checks on SE = 0. The constant enables the checks of the \`Q → SI\` chain and disables the functional paths through the core logic: they do not matter during shift.

        **Port delays.** The tester is an ordinary external side: 5 ns after the edge until \`scan_in\` changes, and 8 ns before the edge for \`scan_out\`. The path from the port to the first stage gets 40 − 5 = 35 ns, the path from the last stage to the port 40 − 8 = 32 ns. At 25 MHz, setup is met with a huge margin.

        **The main danger in shift mode is hold.** The Q output is connected to the SI input of the next flip-flop almost directly; the delay of such a path is a few hundredths of a nanosecond. If the clock edge arrives at the next flip-flop later (clock tree skew), the new data reaches it before its hold window closes. The frequency changes nothing here: the hold requirement does not depend on the period. That is why hold is fixed for shift mode as well, and lockup latches are inserted between chain segments from different clock domains.

        **Typical mistakes:**
        - \`scan_en = 0\` is capture mode: the chain checks are disabled, and the functional paths are analyzed at 25 MHz for nothing;
        - no constant on \`test_mode\`: both \`tck\` and \`func_clk\` reach the flip-flops through the multiplexer, and the analysis builds unnecessary cross-domain checks;
        - port delays relative to \`func_clk\`: in shift mode this clock does not reach the flip-flops, and the paths from \`scan_in\` get a meaningless requirement.

        **Verification.** In the ConstraintLab console: \`report_clock_interaction\` shows the single pair \`tck → tck\`; \`report_timing -to [get_pins {core_reg[1]/SI}] -hold\` shows the hold check on the chain. In PrimeTime: \`report_case_analysis\` and \`report_timing -delay_type min\` along the scan chains.
      `,
    },

    // -------------------------------------------------------------------------
    'asic.clk_div_mux': {
      title: 'Programmable divider: three frequencies in one run',
      langNote: 'The `-combinational`, `-add`, `-master_clock` and `-physically_exclusive` options are supported by both PrimeTime and Vivado. Programmable dividers with clock multiplexers and merged-mode analysis are a typical ASIC task.',
      text: `
        The \`cpu_top\` core is clocked by a programmable clock divider. The PLL clock (**1 GHz**) arrives at the \`pll_clk\` port. The toggle flip-flops \`div2_reg\` and \`div4_reg\` divide it by 2 and by 4 (\`div4_reg\` is clocked by the output of \`div2_reg\`). Two clock multiplexers, \`u_mux_a\` and \`u_mux_b\` (CKMUX2 cells), select the core frequency based on the \`div_sel[1:0]\` bits:

        | div_sel[1] | div_sel[0] | Core frequency |
        |---|---|---|
        | 0 | 0 | 1 GHz (\`pll_clk\`) |
        | 0 | 1 | 500 MHz (\`div2_reg\`) |
        | 1 | any | 250 MHz (\`div4_reg\`) |

        The frequency is changed by software, and at sign-off the core must be checked at all three frequencies **in one run** (merged mode), not with three SDC files that have different constants on \`div_sel\`.

        **Task.** Define the clock \`pll_clk\`, the generated clocks at the divider outputs (\`clk_div2\`, \`clk_div4\`) and three generated clocks at the \`u_mux_b\` output, \`core_1g\`, \`core_500\` and \`core_250\`, which physically cannot exist at the same time.
      `,
      strings: {
        'Блок cpu_top': 'Block cpu_top',
        'логика ядра': 'core logic',
        '1 ГГц': '1 GHz',
        '500 МГц': '500 MHz',
        '250 МГц': '250 MHz',
        'pll_clk 1 ГГц': 'pll_clk 1 GHz',
        'clk_div2 500 МГц': 'clk_div2 500 MHz',
        'clk_div4 250 МГц': 'clk_div4 250 MHz',
        '1 нс': '1 ns',
        '2 нс': '2 ns',
        '4 нс': '4 ns',
      },
      figures: [
        { caption: 'Orange lines are clocks, blue lines are data and select signals. The ÷2 dividers are the toggle flip-flops div2_reg and div4_reg; one of the three frequencies passes through the two multiplexers to the core. Click an element to insert its query into the editor.' },
        {
          title: 'Divider and core clocks',
          caption: 'The dividers count their edges from the pll_clk edges. At the u_mux_b output only one of the three core clocks exists at any time, so the core_reg → core_reg paths are checked separately for each frequency (1, 2 and 4 ns), but not between them.',
        },
      ],
      check: {
        forbid: [{
          msg: 'Clocks at the multiplexer output are -physically_exclusive',
          detail: 'core_1g, core_500 and core_250 exist on the same wire and are never present at the same time. The -logically_exclusive option is intended for clocks that are physically present in the design at the same time but do not interact logically; with it, crosstalk analysis between the clocks is retained.',
        }],
      },
      hints: [
        'First define the dividers as in the clock divider task: the master clock at the CK input of the toggle flip-flop, the generated clock at its Q output, `-divide_by 2` for both (div4_reg divides clk_div2).',
        'The `u_mux_b` output needs three generated clocks with the `-combinational` option (the same waveform as the master clock, a path through combinational logic only). `-source` is the multiplexer input where the required master clock is present; the second and third clocks need `-add`, otherwise each new clock replaces the previous one; also specify `-master_clock`.',
        'Clocks on the same wire do not exist at the same time: `set_clock_groups -physically_exclusive -group [get_clocks core_1g] -group [get_clocks core_500] -group [get_clocks core_250]`.',
      ],
      explain: `
        \`\`\`
        create_clock -name pll_clk -period 1.000 [get_ports pll_clk]
        create_generated_clock -name clk_div2 -source [get_pins div2_reg/CK] -divide_by 2 [get_pins div2_reg/Q]
        create_generated_clock -name clk_div4 -source [get_pins div4_reg/CK] -divide_by 2 [get_pins div4_reg/Q]
        create_generated_clock -name core_1g  -combinational -source [get_pins u_mux_a/A] -master_clock pll_clk [get_pins u_mux_b/Y]
        create_generated_clock -name core_500 -combinational -source [get_pins u_mux_a/B] -master_clock clk_div2 -add [get_pins u_mux_b/Y]
        create_generated_clock -name core_250 -combinational -source [get_pins u_mux_b/B] -master_clock clk_div4 -add [get_pins u_mux_b/Y]
        set_clock_groups -physically_exclusive -group [get_clocks core_1g] -group [get_clocks core_500] -group [get_clocks core_250]
        \`\`\`
        **What happens without clocks at the multiplexer output.** If the multiplexers are not fixed with constants, all three clocks pass through them to \`core_reg\`: \`pll_clk\`, \`clk_div2\` and \`clk_div4\`. The \`core_reg → core_reg\` paths are analyzed for all nine pairs, including \`pll_clk → clk_div4\`, although in the chip a launch at one frequency and a capture at another are impossible. The requirements from the worst edge pairs are false, synthesis wastes area, and the reports are cluttered.

        **Two correct approaches.**
        - *A separate mode for each frequency:* \`set_case_analysis\` on \`div_sel[0]\` and \`div_sel[1]\`, so that a single clock reaches the core. Simple, but it means three SDC files and three runs.
        - *Merged mode (this task):* one clock per frequency is defined at the multiplexer output, and these clocks are declared mutually exclusive. All frequencies are checked in one run.

        **Options.**
        - \`-combinational\`: the generated clock repeats the master clock waveform and reaches the definition point only through combinational logic (here, through the multiplexers), without dividers.
        - \`-add\`: without it, each new command for the same pin would replace the previous clock, and only \`core_250\` would remain.
        - \`-master_clock\`: specifies the master clock explicitly; in general, several clocks can reach the \`-source\` pin, and with \`-add\` PrimeTime and Vivado require the master clock to be unambiguous.
        - A clock defined on a pin stops the propagation of the master clocks through that pin: beyond \`u_mux_b/Y\` only \`core_1g\`, \`core_500\` and \`core_250\` propagate.

        **-physically_exclusive, not -logically_exclusive.** Clocks on the same wire do not physically exist at the same time, so there are neither paths nor crosstalk between them. Clocks that are present in the design at the same time but do not interact are declared logically exclusive: for them PrimeTime still accounts for crosstalk. The master clocks \`pll_clk\`, \`clk_div2\` and \`clk_div4\` remain related: if the dividers or other logic exchange data in these domains, such paths are analyzed correctly.

        **Typical mistakes:**
        - \`set_clock_groups\` between the master clocks (\`pll_clk\`, \`clk_div2\`, \`clk_div4\`) instead of the clocks at the multiplexer output: the core is checked, but the analysis of all real paths between these domains disappears;
        - \`create_clock\` on \`u_mux_b/Y\`: an independent primary clock loses the latency from the PLL and the relationship with the dividers;
        - no \`-add\`: only the last of the three clocks is defined.

        **Verification.** \`report_clocks\`: the three core clocks share the pin \`u_mux_b/Y\` and have their own master clocks; \`report_clock_interaction\`: the pairs \`core_1g → core_1g\` (1 ns), \`core_500 → core_500\` (2 ns) and \`core_250 → core_250\` (4 ns) are analyzed, while the pairs between them are mutually exclusive (Exclusive).
      `,
    },

    // -------------------------------------------------------------------------
    'asic.icg': {
      title: 'Clock gating: ICG cell and AND gate',
      langNote: 'In an FPGA, a clock is gated with a BUFGCE buffer, not with logic; `set_clock_gating_check` is an ASIC tool command.',
      tags: ['clock gating', 'ICG', 'set_clock_gating_check', 'power'],
      text: `
        The \`dsp_top\` block (**500 MHz**, T = 2 ns) saves power with clock gating:
        - the accumulator registers \`acc_reg[15:0]\` are clocked through the library clock gating cell \`u_icg\` (ICG: an enable latch and an AND gate in one cell); the enable is produced by the flip-flop \`en_reg\`;
        - a legacy unit clocks the configuration register \`cfg_reg[7:0]\` through a plain AND gate \`u_gate_and\`: \`clk & cfg_en_q\`, where \`cfg_en_q\` is the output of the flip-flop \`cfg_en_reg\`.

        For the AND gate, the EDA tool infers a clock gating check by itself: the enable must remain stable while the clock is high. The margins of this check are set explicitly: **0.10 ns** before the rising edge of \`clk\` (setup) and **0.05 ns** after the falling edge (hold). The input delays are already set (the "Runs after your code" box).

        **Task.** Define the clock \`clk\` and set the clock gating check margins for the \`u_gate_and\` gate. Consider whether separate clocks are needed at the outputs of \`u_icg\` and \`u_gate_and\`.
      `,
      strings: {
        'Блок dsp_top': 'Block dsp_top',
        'сумматор': 'adder',
        'cfg_en_q (верно)': 'cfg_en_q (correct)',
        'gck_cfg (верно)': 'gck_cfg (correct)',
        'cfg_en_q (ошибка)': 'cfg_en_q (wrong)',
        'gck_cfg (ошибка)': 'gck_cfg (wrong)',
        'фронт': 'rising edge',
        'спад': 'falling edge',
        'укороченный импульс': 'clipped pulse',
      },
      figures: [
        { caption: 'Orange lines are clocks, blue lines are data and enables. The u_icg cell gates the accumulator clock, the u_gate_and gate gates the clock of the configuration register. Click an element to insert its query into the editor.' },
        {
          title: 'AND gate: the enable may change only while clk = 0',
          caption: 'An enable that changes while clk = 0 (with a 0.10 ns margin before the rising edge) produces whole pulses at the output. A change while clk = 1 produces a clipped pulse, a false edge for cfg_reg. The clock gating check requires the enable to be stable from 0.10 ns before the rising edge until 0.05 ns after the falling edge.',
        },
      ],
      hints: [
        'The ICG cell and the AND gate pass the clock on like a buffer: `clk` propagates to `acc_reg` and `cfg_reg` by itself. Defining it on the port is enough.',
        'The clock gating check margins are set by the `set_clock_gating_check` command with the `-setup` and `-hold` options; the object is the gate they apply to.',
        '`set_clock_gating_check -setup 0.1 -hold 0.05 [get_cells u_gate_and]`. Nothing has to be added for the ICG: the checks of the E input are defined in the library.',
      ],
      explain: `
        \`\`\`
        create_clock -name clk -period 2.000 [get_ports clk]
        set_clock_gating_check -setup 0.100 -hold 0.050 [get_cells u_gate_and]
        \`\`\`
        **An ICG needs no constraints.** The clock passes through the clock gating cell to the GCK output as through a buffer: the EDA tool propagates \`clk\` to \`acc_reg\` automatically. A separate clock at \`u_icg/GCK\` is not needed: \`create_clock\` there would be a mistake (a new primary clock without the tree latency up to the ICG), and \`create_generated_clock\` would only add one more domain name to the reports. The \`en_reg → u_icg/E\` path is an ordinary data path: in the library, the E input has setup and hold checks relative to CK, like a flip-flop.

        **How an ICG works.** Inside there is a latch, transparent while CK = 0, and an AND gate. The enable may change at any point in the period: the latch holds it while CK is high, and no clipped pulses appear at the output. That is why synthesis inserts ICG cells (in Design Compiler, \`compile_ultra -gate_clock\`) rather than a plain AND gate.

        **AND gate.** There is no latch here, and the enable must change only while clk = 0. If it changes while clk = 1, a clipped pulse appears at the output, a false edge for \`cfg_reg\` (see the timing diagram). EDA tools recognize a gate whose inputs receive a clock and data and infer a clock gating check: for an AND gate, setup relative to the rising edge and hold relative to the falling edge of the clock. The \`set_clock_gating_check\` command sets the margins of this check; without it the margins are zero.

        **Typical mistakes:**
        - \`create_clock\` at the output of the ICG or the AND gate: the latency from the port to the clock gating cell and the relationship with \`clk\` are lost;
        - \`set_false_path\` on the enable input of the ICG: it disables a real check, and a late enable will distort the output pulse;
        - \`set_clock_gating_check\` on the clock (\`[get_clocks clk]\`) instead of the gate: the margins apply to all inferred clock gating checks of this clock, while the task requires them only for \`u_gate_and\`.

        **Verification.** In PrimeTime: \`report_clock_gating_check\` shows the inferred clock gating checks with their margins; \`report_timing -to [get_pins u_gate_and/A]\` shows the enable path. ConstraintLab does not build the clock gating checks themselves, but it compares the \`set_clock_gating_check\` values with the reference solution and checks the path to the E input of the ICG cell.
      `,
    },

    // -------------------------------------------------------------------------
    'asic.ideal_net': {
      title: 'Synthesis: ideal reset and scan enable networks',
      langNote: 'In an FPGA, Vivado routes reset and other high-fanout nets itself (through global buffers if needed); `set_ideal_network` is an ASIC synthesis command.',
      tags: ['set_ideal_network', 'reset', 'scan_en', 'synthesis', 'recovery/removal'],
      text: `
        The \`core_top\` block (about 40 thousand flip-flops, **500 MHz**) is synthesized in Design Compiler or Genus. All flip-flops are scan flip-flops with reset (SDFFR):
        - the reset \`rst_sync_n\` comes from the top level already synchronized: it is released on the rising edge of \`clk\` and changes at the block port **0.3 ns** after the edge; it drives the RN inputs of all flip-flops;
        - the scan enable \`scan_en\` drives the SE inputs of all flip-flops; in functional mode \`scan_en = 0\`.

        Each of these nets drives tens of thousands of inputs. Such nets are not buffered during synthesis: their buffer trees are built during physical implementation, when the placement is known.

        **Task.** Write the synthesis SDC file for functional mode:
        1. define the clock \`clk\`;
        2. set the reset release delay on the \`rst_sync_n\` port: 0.3 ns relative to \`clk\` (for the recovery and removal checks);
        3. fix \`scan_en = 0\`;
        4. declare the \`rst_sync_n\` and \`scan_en\` networks ideal.

        The delays of the \`din[7:0]\` data are already set (the "Runs after your code" box).
      `,
      strings: {
        'Блок core_top': 'Block core_top',
        'логика': 'logic',
        'Показаны 8 триггеров\nиз 40 тысяч: цепи RN и SE\nобщие для всех': 'Shown: 8 of 40 thousand\nflip-flops; the RN and SE\nnets are common to all',
        'rst_sync_n на порту': 'rst_sync_n at port',
        'снятие сброса': 'reset release',
        'первый рабочий фронт': 'first active edge',
        '0,3 нс': '0.3 ns',
        'бюджет восстановления: 1,7 нс': 'recovery budget: 1.7 ns',
      },
      figures: [
        { caption: 'Only 8 of the 40 thousand flip-flops are shown. Blue lines are data and scan_en, the purple line is the reset, the orange line is the clock. The RN and SE nets feed all flip-flops of the block. Click an element to insert its query into the editor.' },
        {
          title: 'Reset release: recovery and removal checks',
          caption: 'The reset is released on the clk edge at the top level and reaches the port 0.3 ns later. It must reach the RN inputs of all flip-flops before the next edge, with a margin for the recovery time, but after the removal window relative to its own edge. During synthesis the net is ideal; after placement the checks are performed with the real buffer tree.',
        },
      ],
      hints: [
        'The reset is released synchronously, so it needs an ordinary input delay relative to `clk`: from it the EDA tool builds the recovery and removal checks on the RN inputs.',
        'The functional mode is fixed with a constant: `set_case_analysis 0 [get_ports scan_en]`.',
        'Ideal networks are set with `set_ideal_network`: `set_ideal_network [get_ports {rst_sync_n scan_en}]`.',
      ],
      explain: `
        \`\`\`
        create_clock -name clk -period 2.000 [get_ports clk]
        set_input_delay -clock clk 0.300 [get_ports rst_sync_n]
        set_case_analysis 0 [get_ports scan_en]
        set_ideal_network [get_ports {rst_sync_n scan_en}]
        \`\`\`
        **What set_ideal_network does.** The net and everything it drives through buffers and inverters is treated as ideal: zero delay and zero transition, and the design rules (transition, capacitance, fanout) are not fixed on it. Synthesis does not build a buffer tree for it. The \`-no_propagate\` option limits the ideal attribute to the net itself.

        **Why reset and scan enable need it.** At the synthesis stage there is no placement: wire lengths are estimated statistically, and a buffer tree built from such an estimate would be wrong. It would be rebuilt after placement anyway: Innovus and IC Compiler II build the buffer trees for high-fanout nets (high-fanout net synthesis) taking the flip-flop locations into account. Without the ideal attribute, synthesis will insert hundreds of buffers and fix transition "violations", and the recovery and removal checks will show the delay of a huge load.

        **Why the reset needs an input delay.** The reset is released synchronously, on the \`clk\` edge at the top level. The recovery and removal checks on the RN inputs must be performed: during synthesis with an ideal net, after placement with the real buffer tree. A false path from this port would disable them for good.

        **Clocks.** For clock nets, the ideal behavior before clock tree synthesis is automatic; no separate command is needed. The \`set_dont_touch_network\` command prohibits modifying a net but does not make it ideal: for the reset net, the delays and transitions would be computed from the huge load.

        **After placement**, \`set_ideal_network\` is removed from the SDC file for physical implementation: the nets get real buffers and delays, and the recovery and removal checks are performed with them.

        **Typical mistakes:**
        - no \`set_ideal_network\`: huge buffer trees and false violations already at synthesis;
        - \`set_false_path -from [get_ports rst_sync_n]\` instead of an input delay: the recovery and removal checks disappear;
        - \`set_dont_touch_network\` instead of \`set_ideal_network\`: no buffers are inserted, but the analysis sees the delay of a huge load.

        **Verification.** In Design Compiler: \`report_ideal_network\` shows the ideal networks and their sources; \`report_timing -to [get_pins {core_reg[0]/RN}]\` shows the recovery check. In the ConstraintLab console: \`report_timing -from [get_ports rst_sync_n]\` shows a recovery requirement of 2 ns and a removal requirement of 0 ns.
      `,
    },

    // -------------------------------------------------------------------------
    'asic.modes_q': {
      title: 'Modes and corners: what differs between the SDC files?',
      langNote: 'Sign-off modes and corners are ASIC practice. In Vivado, the analysis over corners (slow and fast) is performed automatically, and FPGAs have no scan test modes.',
      tags: ['operating modes', 'MMMC', 'scan', 'understanding'],
      text: `
        The \`core_top\` block with the test clock multiplexer and the scan chain (the tasks on [[q:asic.test_mux|functional mode]] and [[q:asic.scan_shift|shift mode]]) is being prepared for sign-off in three modes:
        - functional: \`func_clk\` at 250 MHz;
        - scan shift: \`tck\` at 25 MHz;
        - scan capture: \`tck\` at 25 MHz, \`scan_en = 0\`.

        The analysis is performed in two corners: slow (ss, 0.72 V, 125 °C) and fast (ff, 0.88 V, −40 °C).

        **Task.** Select all correct statements.
      `,
      strings: {
        'Блок core_top': 'Block core_top',
        'логика ядра': 'core logic',
      },
      figures: [
        { caption: 'The core_top block: the clock multiplexer u_clk_mux selects func_clk or tck, and the scan flip-flops core_reg form the chain scan_in → … → scan_out.' },
      ],
      options: [
        { text: 'The modes differ in the `set_case_analysis` constants: `test_mode = 0`, `scan_en = 0` for functional mode; 1 and 1 for shift; 1 and 0 for capture.', why: 'Correct. The constants define the clock path through the multiplexer and the active checks of the scan flip-flops (the D input or the SI input).' },
        { text: 'In the scan modes, the `scan_in` and `scan_out` ports are constrained relative to `tck`, and in functional mode the functional ports are constrained relative to `func_clk`.', why: 'Correct. In each mode the input/output delays describe the external side that operates in that mode: the tester or the neighboring blocks.' },
        { text: 'The ff corner does not need a separate SDC file: a corner changes the libraries and the interconnect parameters, while the mode constraints stay the same.', why: 'Correct. Frequencies, port delays and constants are properties of the mode. A corner means PVT conditions and RC extraction. In Cadence tools these are the constraint mode and the delay corner, combined into an analysis view.' },
        { text: 'In shift mode the frequency is only 25 MHz, so hold checks can be skipped in this mode.', why: 'Incorrect. The hold requirement does not depend on the period, and in shift mode it is often the hardest one: the Q output is connected to the SI input of the next flip-flop almost directly, and the clock tree skew easily exceeds the delay of such a path.' },
        { text: 'One SDC file with `set_clock_groups -logically_exclusive` between `func_clk` and `tck` is enough: then no modes are needed.', why: 'Incorrect. Clock groups remove only the paths between the clocks. Without constants on test_mode and scan_en, the checks of the D and SI inputs and the paths through the test logic are analyzed together: one analysis mixes conditions that never occur together in the chip.' },
        { text: 'For the fast ff corner, an SDC file with shorter clock periods is written: the circuit runs faster in this corner.', why: 'Incorrect. The period is a system requirement, not a property of the corner. In the fast corner, mostly hold is checked, with the same constraints.' },
        { text: 'Setup and hold are checked in every corner: usually the worst case for hold is the fast corner and for setup the slow corner, but with temperature inversion in modern technologies this is not always so.', why: 'Correct. At a low supply voltage, cell delay can increase as the temperature decreases (temperature inversion), so the worst corner is not obvious in advance, and both checks are performed in all corners.' },
      ],
      hints: [
        'Split the information into two kinds: what is defined by how the circuit operates (frequencies, constants, external delays) and what is defined by the manufacturing and operating conditions (voltage, temperature, process variation).',
        'The hold requirement compares times of the same clock edge, so it does not depend on the period.',
      ],
      explain: `
        A **mode** describes *how* the circuit operates: which clocks with which frequencies, which constants on the control inputs, which external delays. Each mode gets its own SDC file or set of files: functional, shift, capture (and for at-speed capture, also with PLL clocks from the on-chip clock controller).

        A **corner** describes *under which conditions* it operates: the libraries for voltage, temperature and process variation, and the interconnect parameters after extraction. SDC files are not part of a corner.

        An **analysis view** is a "mode + corner" pair. Sign-off is performed for all required pairs: in Cadence tools this is the MMMC configuration (constraint mode, delay corner, analysis view), in PrimeTime separate scenarios or distributed multi-scenario analysis (DMSA).

        | Mode / corner | ss, 0.72 V, 125 °C | ff, 0.88 V, −40 °C |
        |---|---|---|
        | functional | setup and hold | setup and hold |
        | shift | setup and hold (hold is especially important) | setup and hold |
        | capture | setup and hold | setup and hold |

        **Why everything is checked in all corners.** Usually setup is worst in the slow corner and hold in the fast corner. But in modern technologies at a low voltage, delay can increase as the temperature decreases (temperature inversion), and the clock tree skew differs from corner to corner. Skipping a corner means risking a missed violation.
      `,
    },
  },
});
