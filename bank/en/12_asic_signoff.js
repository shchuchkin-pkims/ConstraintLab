/* English translation of bank/12_asic_signoff.js (module 12: SDC for ASIC, hierarchy and sign-off) */
XT.bank.i18n('en', {
  modules: {
    asic_signoff: {
      title: '12. SDC for ASIC: hierarchy and sign-off',
      about: 'Block budgets with clock latency from the top level, design rules (transition, capacitance), slack calculation with real clock tree skew, on-chip variation (OCV) and clock reconvergence pessimism removal (CRPR), modes, corners and analysis views (MMMC)',
    },
  },
  questions: {
    // -------------------------------------------------------------------------
    'asic.hier_budget': {
      title: 'Hierarchical flow: block budget and clock tree latencies',
      langNote: '`set_clock_latency -source` and virtual clocks also exist in Vivado, but budgeting between the blocks of a chip with the latencies of the shared clock tree taken into account is a practice of the ASIC hierarchical flow.',
      tags: ['set_clock_latency', '-source', 'virtual clock', 'budgets', 'hierarchy'],
      text: `
        The chip is assembled hierarchically: the \`dsp_core\` block is synthesized and placed separately, and the architect has allocated the budgets. The **400 MHz** clock (T = 2.5 ns) comes from the root of the chip clock tree:

        | Point | Latency from the tree root |
        |---|---|
        | \`clk\` port of the \`dsp_core\` block | 0.60 ns |
        | registers of the source block \`u_src\` | 1.00 ns |
        | registers of the receiving block \`u_dst\` | 1.10 ns |

        The data \`din[15:0]\` appears at the \`dsp_core\` inputs **0.50 ns** after the edge at the \`u_src\` registers; the \`u_dst\` block needs \`dout[15:0]\` to arrive at its inputs **0.60 ns** before the edge at its registers.

        The project methodology: the clock latency outside the block is set with \`set_clock_latency -source\` on the block clock, and the external side is described by virtual clocks of the neighboring blocks with their own latency (\`set_clock_latency\`).

        **Task.** Write the block SDC file: the clock \`clk\` and its latency outside the block, the virtual clocks \`vclk_src\` and \`vclk_dst\` with their latencies, the input delay for \`din[15:0]\` and the output delay for \`dout[15:0]\`.
      `,
      strings: {
        'источник u_src': 'source u_src',
        'данные через 0,5 нс\nпосле фронта CK': 'data 0.5 ns after\nthe CK edge',
        'Блок dsp_core': 'Block dsp_core',
        'обработка': 'processing',
        'приёмник u_dst': 'receiver u_dst',
        'нужны за 0,6 нс\nдо фронта CK': 'needed 0.6 ns\nbefore CK edge',
        'корень тактового дерева 400 МГц': 'clock tree root, 400 MHz',
        '1,00 нс': '1.00 ns',
        '0,60 нс': '0.60 ns',
        '1,10 нс': '1.10 ns',
        'корень дерева': 'tree root',
        'порт clk блока': 'block clk port',
        'регистры u_src': 'u_src registers',
        'din на входе': 'din at input',
        'регистры u_dst': 'u_dst registers',
        'dout на выходе': 'dout at output',
        '0,5 нс': '0.5 ns',
        '0,6 нс': '0.6 ns',
        'захват в u_dst': 'capture in u_dst',
        '0,60': '0.60',
        '1,00': '1.00',
        '1,10': '1.10',
      },
      figures: [
        { caption: 'Dashed lines are the neighboring blocks and the branches of the shared chip clock tree, labeled with the latencies from its root. Orange lines are the clock inside dsp_core. Click an element to insert its query into the editor.' },
        {
          title: 'One edge of the tree root at different points of the chip',
          caption: 'Data from u_src leaves at 1.0 + 0.5 = 1.5 ns after the root edge. dout must arrive no later than 2.5 + 1.1 − 0.6 = 3.0 ns. The latencies outside the block enter the timing in the same way before and after the clock tree synthesis of the block.',
        },
      ],
      hints: [
        'The latency from the root to the block port lies *outside* the block: `set_clock_latency -source 0.6 [get_clocks clk]`. Without `-source` it would be an estimate of the tree inside the block, which is replaced by the real latency once that tree is synthesized.',
        'The neighboring blocks are clocked by the same clock, but their registers see the edge 1.00 and 1.10 ns after the root. These are two different virtual clocks (period 2.5 ns) with their own `set_clock_latency` values.',
        'The port delays are the time used outside the block: `set_input_delay -clock vclk_src 0.5 [get_ports {din[*]}]`, `set_output_delay -clock vclk_dst 0.6 [get_ports {dout[*]}]`.',
      ],
      explain: `
        \`\`\`
        create_clock -name clk -period 2.500 [get_ports clk]
        set_clock_latency -source 0.600 [get_clocks clk]
        create_clock -name vclk_src -period 2.500
        create_clock -name vclk_dst -period 2.500
        set_clock_latency 1.000 [get_clocks vclk_src]
        set_clock_latency 1.100 [get_clocks vclk_dst]
        set_input_delay  -clock vclk_src 0.500 [get_ports {din[*]}]
        set_output_delay -clock vclk_dst 0.600 [get_ports {dout[*]}]
        \`\`\`
        **How the EDA tool computes the \`din → din_reg\` path.** The launch is the \`vclk_src\` edge: 0 + 1.00 (virtual clock latency) + 0.50 (input delay) = 1.50 ns from the root edge. The capture is the next \`clk\` edge: 2.5 + 0.60 (\`-source\` latency) + the latency of the block tree to \`din_reg\`. The path inside the block gets 2.5 + 0.60 + T_tree − 1.50 − t_su.

        **The \`dout_reg → dout\` path.** The launch is the \`clk\` edge at the register: 0.60 + T_tree. The capture is the \`vclk_dst\` edge: 2.5 + 1.10 − 0.60 = 3.00 ns from the root edge.

        **Why \`-source\` for \`clk\`.** Latency without \`-source\` is an estimate of the tree *inside* the block: once the block clock tree is synthesized (\`set_propagated_clock\`), the computed latency replaces it. The latency from the chip root to the block port does not change as a result, so it is specified as \`-source\`: it applies both before and after the clock tree synthesis of the block.

        **Why virtual clocks with latency.** A virtual clock is always ideal, and its \`set_clock_latency\` applies at all stages (for a virtual clock, latency with and without \`-source\` is equivalent: it has no tree). The neighboring blocks see the edge at different times, hence two clocks. The budget is written exactly as in the architect's document: "0.5 ns after the source edge", "0.6 ns before the receiver edge", and when the chip clock tree changes, only the clock latencies change, not the values in \`set_input_delay\` and \`set_output_delay\`.

        **Typical mistakes:**
        - \`set_clock_latency 0.6 [get_clocks clk]\` without \`-source\`: after the block clock tree is synthesized these 0.6 ns disappear, and the budgets shift;
        - delays relative to \`clk\`: the input becomes optimistic by 1.00 − 0.60 = 0.40 ns (the launch at the source is actually later), and the output pessimistic by 1.10 − 0.60 = 0.50 ns;
        - a single virtual clock with a latency of 1.00 for both neighbors: the output requirement becomes 0.1 ns tighter than the real one;
        - values "inside the block" (1.4 ns, 1.8 ns) instead of the time used outside.

        **Verification.** \`report_clocks\` shows \`clk\` and the two virtual clocks; in PrimeTime, \`report_clock -skew\` shows the clock latencies, and \`report_timing -from [get_ports {din[0]}] -path_type full_clock\` shows the \`vclk_src\` latency at the start of the path. ConstraintLab analyzes the ideal edge relationships and compares the clock latency values with the reference solution.
      `,
    },

    // -------------------------------------------------------------------------
    'asic.drv': {
      title: 'Design rules: transition and capacitance',
      langNote: 'Design rules (`set_max_transition`, `set_max_capacitance`, `set_input_transition`) are ASIC tool commands; in an FPGA the cells and the routing are prebuilt, and XDC has no such constraints.',
      text: `
        For the \`io_ctrl\` block, the library and reliability requirements define the following design rules:

        | Requirement | Value |
        |---|---|
        | maximum transition on data nets | 0.25 ns |
        | maximum transition on the \`clk\` clock nets | 0.10 ns |
        | maximum load capacitance of any cell output | 0.08 pF |
        | transition at the data inputs \`din[7:0]\` and \`cfg[3:0]\` (driven by a neighboring block) | 0.12 ns |

        The clock \`clk\` (250 MHz) is already defined. Library units: time in nanoseconds, capacitance in picofarads.

        **Task.** Specify these rules with SDC commands.
      `,
      strings: {
        'соседний блок': 'neighbor block',
        'Блок io_ctrl': 'Block io_ctrl',
        'логика': 'logic',
        '0,12 нс': '0.12 ns',
        'clk ≤ 0,10 нс': 'clk ≤ 0.10 ns',
        'тактовая цепь': 'clock net',
        'цепь данных': 'data net',
        'нарушение': 'violation',
        '0,10 нс – предел для clk': '0.10 ns – limit for clk',
        '0,25 нс – предел для данных': '0.25 ns – limit for data',
        '0,45 нс – синтез вставит буфер': '0.45 ns – synthesis adds a buffer',
      },
      figures: [
        { caption: 'The dashed box is the neighboring block that drives the inputs with a 0.12 ns transition. The orange line is the clock net with a stricter transition limit. Click an element to insert its query into the editor.' },
        {
          title: 'Transition: acceptable and excessive',
          caption: 'Transition is the time a signal takes to switch between the threshold levels defined in the library (usually 10–90% or 20–80% of the supply voltage). A slow transition increases the delay of the next cell and its short-circuit current, and in a clock net it also increases noise sensitivity and skew.',
        },
      ],
      hints: [
        'A constraint for the whole block is set on the `[current_design]` object: `set_max_transition 0.25 [current_design]`, `set_max_capacitance 0.08 [current_design]`.',
        'A stricter constraint for clock nets is set on the clock with the `-clock_path` option: `set_max_transition 0.1 -clock_path [get_clocks clk]`.',
        'The input transition without specifying a driving cell: `set_input_transition 0.12 [get_ports {din[*] cfg[*]}]`.',
      ],
      explain: `
        \`\`\`
        set_max_transition 0.250 [current_design]
        set_max_transition 0.100 -clock_path [get_clocks clk]
        set_max_capacitance 0.080 [current_design]
        set_input_transition 0.120 [get_ports {din[*] cfg[*]}]
        \`\`\`
        **Design rules (DRV)** are constraints that synthesis and physical implementation satisfy first, even at the expense of timing slack: on a violation they upsize cells and insert buffers. Similar constraints also exist in the library (the \`max_transition\` and \`max_capacitance\` pin attributes); the stricter value applies.

        **\`set_max_transition\`.** A slow transition increases the delay of the next cell, the short-circuit current and the sensitivity to noise. For clock nets the limit is stricter: the transition affects the skew and the clock-to-output delay of all flip-flops. The \`-clock_path\` option, with a clock in the object list, limits only the clock nets of that clock. Without it (\`set_max_transition 0.1 [get_clocks clk]\`), the data nets of this domain would also get the 0.1 ns limit.

        **\`set_max_capacitance\`** limits the load on the output of any cell (the inputs of the following cells plus the interconnect): a large capacitance means a slow transition and electromigration in the output wires. The unit comes from the library: 0.08 pF here, not 80.

        **\`set_input_transition\`** sets the transition at the inputs when the driving cell is unknown or unimportant. With \`set_driving_cell\` (the [[q:asic.block_basic|basic block SDC file task]]), the EDA tool computes the transition from the port load itself; \`set_input_transition\` specifies it as a number.

        **Typical mistakes:**
        - no \`-clock_path\`: the strict limit applies to all paths of the \`clk\` domain, and synthesis bloats the data logic;
        - \`set_max_capacitance 80\`: the capacitance in femtofarads with a library in picofarads, so the constraint is effectively removed;
        - rules on ports instead of \`[current_design]\`: the internal nets of the block remain unconstrained.

        **Verification.** In Design Compiler and PrimeTime: \`report_constraint -all_violators\` shows the violations of design rules and timing constraints. In ConstraintLab the values are compared with the reference solution.
      `,
    },

    // -------------------------------------------------------------------------
    'asic.skew_num': {
      title: 'Calculation: slack with real clock tree skew',
      langNote: 'The slack calculation is the same in PrimeTime and in Vivado: in an FPGA the clock tree latencies are real too, and the skew appears in the report_timing report (the clock path and clock skew lines).',
      tags: ['skew', 'set_propagated_clock', 'setup', 'hold', 'calculation'],
      text: `
        After clock tree synthesis, the \`a_reg → b_reg\` path (a single clock, T = **2.0 ns**) has the following parameters according to the PrimeTime report:

        | Parameter | Value |
        |---|---|
        | clock tree latency to \`a_reg\` (launch) | 0.30 ns |
        | clock tree latency to \`b_reg\` (capture) | 0.42 ns |
        | clock-to-output delay of \`a_reg\`: min / max | 0.08 / 0.10 ns |
        | logic delay between the registers: min / max | 0.12 / 1.45 ns |
        | setup / hold time of \`b_reg\` | 0.06 / 0.04 ns |
        | uncertainty for setup / hold | 0.05 / 0.02 ns |

        **Task.** Calculate the clock skew (capture latency minus launch latency), the setup slack and the hold slack.
      `,
      strings: {
        'Блок после синтеза тактового дерева': 'Block after clock tree synthesis',
        'логика': 'logic',
        'clk на порту': 'clk at port',
        'данные: 0,30 + 0,10 + 1,45 = 1,85': 'data: 0.30 + 0.10 + 1.45 = 1.85',
        'данные нужны к 2,31': 'data required by 2.31',
        '0,30': '0.30',
        '0,42': '0.42',
      },
      figures: [
        { caption: 'The clock tree after synthesis: a root buffer and two branches. The clock takes 0.30 ns to reach a_reg and 0.42 ns to reach b_reg.' },
        {
          title: 'Launch, capture and check windows',
          caption: 'The latest data settles at b_reg/D at 1.85 ns and is required by 2.0 + 0.42 − 0.06 − 0.05 = 2.31 ns. The earliest new data arrives at 0.30 + 0.08 + 0.12 = 0.50 ns, while the previous data must be held until 0.42 + 0.04 + 0.02 = 0.48 ns (the hold window is shown at the capture edge).',
        },
      ],
      fields: [
        { label: 'Clock skew (capture − launch)' },
        { label: 'Setup slack' },
        { label: 'Hold slack' },
      ],
      hints: [
        'Setup: the data must arrive before the next edge at the capturing register: required time = T + capture latency − t_su − uncertainty. Arrival time = launch latency + maximum Tco + maximum logic delay.',
        'Hold: the earliest new data (minimum delays) must arrive after the hold window at the capturing register closes for the same edge: capture latency + t_h + uncertainty.',
      ],
      explain: `
        **Skew** = 0.42 − 0.30 = **0.12 ns**: the capturing register sees the edge later than the launching one.

        **Setup.**
        - Arrival time: 0.30 + 0.10 + 1.45 = 1.85 ns.
        - Required time: 2.0 + 0.42 − 0.06 − 0.05 = 2.31 ns.
        - Slack: 2.31 − 1.85 = **0.46 ns**.

        **Hold.**
        - Arrival time (minimum delays): 0.30 + 0.08 + 0.12 = 0.50 ns.
        - Required time: 0.42 + 0.04 + 0.02 = 0.48 ns.
        - Slack: 0.50 − 0.48 = **0.02 ns**.

        **Conclusion.** Positive skew (capture later than launch) *adds* time for setup and *takes* it away from hold. Without the skew, the setup slack would be 0.34 ns and the hold slack 0.14 ns. Clock tree synthesis exploits this: intentional useful skew helps critical setup paths, but every such shift has to be paid for with hold slack on neighboring paths, hence the buffers inserted during hold fixing.

        **Relation to SDC.** This calculation is performed only for propagated clocks (\`set_propagated_clock\`, see the [[q:asic.cts|task on clock tree synthesis]]). The uncertainty here no longer includes the skew estimate: the skew enters the calculation directly.

        **Verification in PrimeTime:** \`report_timing -from [get_cells a_reg] -to [get_cells b_reg] -delay_type min_max -path_type full_clock_expanded\`: the report shows the latencies of the tree branches, the data arrival time, the required time and the slack.
      `,
    },

    // -------------------------------------------------------------------------
    'asic.ocv_crpr': {
      title: 'Calculation: on-chip variation (OCV) and the common clock path (CRPR)',
      langNote: 'Derating factors (`set_timing_derate`) are an ASIC tool command (in Vivado, variation is already built into the delay models). Vivado removes common path pessimism in the same way: the clock pessimism line in the report_timing report.',
      tags: ['OCV', 'set_timing_derate', 'CRPR', 'sign-off', 'calculation'],
      text: `
        Sign-off analysis in PrimeTime accounts for on-chip variation (OCV) with fixed derating factors:

        \`\`\`
        set_timing_derate -late  1.08
        set_timing_derate -early 0.92
        \`\`\`
        The factors multiply the delays of cells and nets, both clock and data: for the setup check, the launch path is treated as "late" (×1.08) and the capture path as "early" (×0.92). The factors are not applied to the setup time.

        The \`a_reg → b_reg\` path, T = **2.0 ns**. Nominal delays:

        | Segment | Delay |
        |---|---|
        | common clock tree segment: from the port to the branch point | 0.40 ns |
        | branch to \`a_reg\` | 0.20 ns |
        | branch to \`b_reg\` | 0.25 ns |
        | clock-to-output delay of \`a_reg\` | 0.10 ns |
        | logic between the registers | 1.20 ns |
        | setup time of \`b_reg\` | 0.05 ns |

        **Task.** Calculate the setup slack: without OCV; with OCV but without common path pessimism removal; the CRPR adjustment; the final slack with OCV and CRPR.
      `,
      strings: {
        'Блок после синтеза тактового дерева': 'Block after clock tree synthesis',
        'логика': 'logic',
        'общий участок: поздно': 'common path: late',
        'общий участок: рано': 'common path: early',
        'a_reg/CK (поздно)': 'a_reg/CK (late)',
        'b_reg/CK (рано)': 'b_reg/CK (early)',
        'CRPR: 0,064 нс': 'CRPR: 0.064 ns',
        '0,60 × 1,08': '0.60 × 1.08',
        '0,65 × 0,92': '0.65 × 0.92',
      },
      figures: [
        { caption: 'The common part of the tree is the clk port and the root buffer u_cts_root (0.40 ns); after it come the branches to a_reg (0.20 ns) and b_reg (0.25 ns).' },
        {
          title: 'The same buffer cannot be both slow and fast',
          caption: 'Without pessimism removal, the analysis treats the common path as slow for the launch (0.432 ns) and as fast for the capture (0.368 ns) at the same time. Physically it is the same buffer, so the 0.064 ns difference is credited back to the slack (CRPR).',
        },
      ],
      fields: [
        { label: 'Slack without OCV' },
        { label: 'Slack with OCV, without pessimism removal' },
        { label: 'CRPR adjustment (common path pessimism removal)' },
        { label: 'Final slack with OCV and CRPR' },
      ],
      hints: [
        'Without OCV: arrival time = 0.40 + 0.20 + 0.10 + 1.20; required time = T + (0.40 + 0.25) − t_su.',
        'With OCV, all delays of the launch path (clock and data) are multiplied by 1.08, and the delays of the capture path by 0.92.',
        'The common segment (0.40 ns) is part of both paths: with a factor of 1.08 in one and 0.92 in the other. CRPR adjustment = 0.40 × (1.08 − 0.92).',
      ],
      explain: `
        **Without OCV.** Arrival: 0.40 + 0.20 + 0.10 + 1.20 = 1.90 ns. Required: 2.0 + 0.65 − 0.05 = 2.60 ns. Slack **0.70 ns**.

        **With OCV.** The launch path is "late": 1.90 × 1.08 = 2.052 ns. The capture path is "early": 0.65 × 0.92 = 0.598 ns; required: 2.0 + 0.598 − 0.05 = 2.548 ns. Slack **0.496 ns**.

        **CRPR.** The 0.40 ns common segment is counted as 0.432 ns in the launch path and as 0.368 ns in the capture path. But these are the same cells and wires: for the same clock edge they cannot be slow and fast at once. The difference 0.40 × (1.08 − 0.92) = **0.064 ns** is credited back to the slack. Result: 0.496 + 0.064 = **0.560 ns**.

        **Why it matters.** OCV models the variation of parameters *within a single die*: neighboring cells are manufactured slightly differently and operate at different temperatures and supply voltages. Fixed factors are pessimistic for long chains of cells, so modern flows use depth- and distance-dependent factors (AOCV) or a statistical description of the variation (POCV). Common path pessimism removal (CRPR; CPPR in Cadence tools) is mandatory with any of these approaches: in PrimeTime it is enabled by the \`timing_remove_clock_reconvergence_pessimism\` variable.

        **Where the factors are set.** \`set_timing_derate\` belongs to the analysis corner, not to the mode: the factors differ from corner to corner. In an MMMC configuration they are set for the delay corner, in PrimeTime in the scenario of that corner.

        **Verification in PrimeTime:** \`report_timing -path_type full_clock_expanded\`: the report shows the applied factors and the clock reconvergence pessimism line.
      `,
    },

    // -------------------------------------------------------------------------
    'asic.mmmc_q': {
      title: 'Modes, corners and analysis views (MMMC)',
      langNote: 'Modes, corners and analysis views (MMMC) are how sign-off is organized in ASIC tools. Vivado analyzes the slow and fast corners automatically, and separate modes are not described in it.',
      tags: ['MMMC', 'constraint mode', 'delay corner', 'analysis view', 'understanding'],
      text: `
        The block is being prepared for sign-off in Tempus or Innovus with MMMC (multi-mode multi-corner): constraint modes, delay corners and analysis views. There are two SDC files, functional mode (\`func.sdc\`) and scan shift (\`shift.sdc\`), the ss and ff library sets, and the cmax and cmin interconnect (RC) models.

        **Task.** Select all correct statements.
      `,
      strings: {
        'режим func\n(func.sdc)': 'mode func\n(func.sdc)',
        'режим shift\n(shift.sdc)': 'mode shift\n(shift.sdc)',
        'вид func_ss': 'view func_ss',
        'вид func_ff': 'view func_ff',
        'вид shift_ss': 'view shift_ss',
        'вид shift_ff': 'view shift_ff',
        'угол ss_cmax\nбиблиотеки ss, RC cmax': 'corner ss_cmax\nss libraries, RC cmax',
        'угол ff_cmin\nбиблиотеки ff, RC cmin': 'corner ff_cmin\nff libraries, RC cmin',
      },
      figures: [
        {
          title: 'MMMC diagram',
          caption: 'An analysis view is a "mode + corner" pair. A mode is defined by SDC files, a corner by libraries (PVT) and interconnect models (RC). Setup and hold are checked on their own sets of views.',
        },
      ],
      options: [
        { text: 'A constraint mode is the set of SDC files of one operating mode; the same mode is analyzed in several corners.', why: 'Correct. Frequencies, constants and external delays are properties of the mode; they do not depend on the corner.' },
        { text: 'A delay corner combines a library set (PVT conditions) and an interconnect model (RC); it contains no frequencies and no input/output delays.', why: 'Correct. A corner describes the conditions under which the circuit operates, not what is required of it.' },
        { text: 'An analysis view is a "mode + corner" pair; the setup and hold checks are assigned to their own sets of views (`set_analysis_view -setup … -hold …`).', why: 'Correct. Usually setup is checked in slow corners and hold in fast corners, but with temperature inversion the views for both checks are chosen more carefully.' },
        { text: 'For the ff corner, the SDC file is copied and the clock periods are reduced: the circuit runs faster in the fast corner.', why: 'Incorrect. The period is a system requirement; it is the same in all corners. The fast corner is needed mainly for the hold check.' },
        { text: 'The OCV factors (`set_timing_derate`) are the same for all corners, so they are always written in the SDC file of the mode.', why: 'Incorrect. Variation depends on voltage, temperature and process, that is, on the corner. In an MMMC configuration the factors are set for the delay corner, in PrimeTime in the scenario of the corner.' },
        { text: 'In PrimeTime the same is organized with "mode + corner" scenarios: separate runs or distributed multi-scenario analysis (DMSA).', why: 'Correct. A PrimeTime scenario corresponds to an analysis view in MMMC.' },
      ],
      hints: [
        'Split the information into "what is required of the circuit" (frequencies, constants, external delays) and "under which conditions it operates" (libraries, temperature, voltage, interconnect).',
        'On-chip variation depends on the operating conditions.',
      ],
      explain: `
        A **mode** (constraint mode) is what is required of the circuit: clocks and frequencies, \`set_case_analysis\` constants, input/output delays, timing exceptions. It is defined by SDC files.

        A **delay corner** is the conditions under which the circuit operates: the libraries for voltage, temperature and process variation (library set), the interconnect model after extraction (RC corner), and also the on-chip variation factors (\`set_timing_derate\` for the corner).

        An **analysis view** is a "mode + corner" pair. The \`set_analysis_view -setup {…} -hold {…}\` command assigns which views are used for the setup check and which for the hold check.

        | View | Mode | Corner | Checks |
        |---|---|---|---|
        | func_ss | func.sdc | ss + cmax | setup |
        | func_ff | func.sdc | ff + cmin | hold |
        | shift_ss | shift.sdc | ss + cmax | setup |
        | shift_ff | shift.sdc | ff + cmin | hold |

        A real project has more views: corners for different temperatures, voltages and extractions, and with temperature inversion both checks are performed in more corners. In PrimeTime each pair corresponds to a scenario; several scenarios are analyzed in separate runs or in a distributed way (DMSA).
      `,
    },
  },
});
