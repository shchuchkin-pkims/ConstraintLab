/* English translation of bank/02_gen.js (module 2: generated clocks) */
XT.bank.i18n('en', {
  modules: {
    gen: {
      title: '2. Generated clocks',
      about: 'create_generated_clock, register-based divider, clock multiplexer, multiple clocks on one port, edge relationships',
    },
  },
  questions: {
    'gen.div_reg': {
      title: 'Register-based clock divider',
      langNote: '`create_generated_clock` for a register-based divider is written the same way in XDC and SDC.',
      text: `
        In a legacy design, the 100 MHz clock is divided by 2 with the toggle flip-flop \`clk_div_reg\`: its output is fed back to the D input through an inverter, and the same output clocks the registers \`slow_reg[7:0]\` through the global buffer \`BUFG\`. The data for \`slow_reg\` comes from the registers \`fast_reg[7:0]\`, which run at 100 MHz.

        The primary clock \`sys_clk\` is already defined. The \`slow_reg\` registers do not receive any clock yet: \`check_timing\` reports *no_clock*, and the path \`fast_reg → slow_reg\` is not analyzed.

        **Task.** Define the clock \`clk_div2\` at the divider output so that Vivado knows its relationship to \`sys_clk\`.
      `,
      strings: {
        'запуск fast_reg': 'launch fast_reg',
        'захват slow_reg': 'capture slow_reg',
        'предустановка 10 нс': 'setup 10 ns',
      },
      figures: [
        {
          title: 'Master clock and generated clock',
          caption: 'The clk_div2 edges coincide with every second sys_clk edge. For the fast_reg → slow_reg path, the tightest edge pair is launch at 10 ns and capture at 20 ns.',
        },
      ],
      hints: [
        'A clock derived from another clock inside the design is defined with `create_generated_clock`.',
        'The `-source` option names a pin where the master clock is present (the clock input of the divider); the object of the command is the divider output.',
        '`create_generated_clock -name clk_div2 -source [get_pins clk_div_reg/C] -divide_by 2 [get_pins clk_div_reg/Q]`',
      ],
      explain: `
        \`\`\`
        create_generated_clock -name clk_div2 -source [get_pins clk_div_reg/C] -divide_by 2 [get_pins clk_div_reg/Q]
        \`\`\`
        - **Definition point**: the output \`clk_div_reg/Q\`, where the signal starts acting as a clock. From there, Vivado propagates it through the BUFG to \`slow_reg\` on its own.
        - **-source**: the clock input of the divider, \`clk_div_reg/C\`. The delay from the \`sys_clk\` port to this pin is included in the latency of the generated clock, so the relationship between \`sys_clk\` and \`clk_div2\` is computed correctly.
        - **-divide_by 2**: a period of 20 ns, with edges coinciding with every second \`sys_clk\` edge (equivalent to \`-edges {1 3 5}\`).

        The path \`fast_reg → slow_reg\` is now analyzed as synchronous: the setup requirement is 10 ns (launch at the last \`sys_clk\` edge before a \`clk_div2\` edge), the hold requirement is 0.

        **Why not create_clock.** A primary clock on \`clk_div_reg/Q\` would not be related to \`sys_clk\`: the path \`fast_reg → slow_reg\` would become a crossing between unrelated clocks (*Timed (unsafe)*), and the delay from the port to the divider output would be ignored.

        **A design note.** In an FPGA, clocks are better generated with an MMCM/PLL or with buffers that support division (BUFGCE_DIV, BUFR) and clock enable (BUFGCE): a flip-flop output is routed through general logic resources and introduces large skew. But if such a divider already exists in the design, it must be defined as a generated clock.
      `,
    },

    // -------------------------------------------------------------------------
    'gen.bufgmux': {
      title: 'BUFGMUX clock multiplexer',
      langNote: 'Constraining a clock multiplexer (`-add`, `-master_clock`, `-physically_exclusive`) works the same way in Vivado and PrimeTime; in ASICs, cells such as CKMUX2 are constrained the same way, often with the `-combinational` option.',
      text: `
        An MMCM generates two related clocks from 100 MHz: \`clk100\` (CLKOUT0) and \`clk125\` (CLKOUT1). Both are used directly: the register \`a_reg\` runs on \`clk100\`, the register \`b_reg\` on \`clk125\`, and there is a **synchronous** path between them that must be analyzed.

        In addition, a peripheral block is clocked through the \`BUFGMUX\` multiplexer (\`clk_mux\`): depending on the mode, its output carries either \`clk100\` or \`clk125\`, but never both at once. Without additional constraints, Vivado analyzes the \`m1_reg → m2_reg\` paths for all clock combinations, including the physically impossible "\`clk100\` launches, \`clk125\` captures".

        **Task.** Constrain the multiplexer output as UG903 recommends: one generated clock per input (\`clk100_mux\`, \`clk125_mux\`) and mutual exclusion between them. The path \`a_reg → b_reg\` must still be analyzed.
      `,
      strings: {
        '100 МГц': '100 MHz',
        '125 МГц': '125 MHz',
        'S: выбор режима': 'S: mode select',
        'O (режим 0)': 'O (mode 0)',
        'O (режим 1)': 'O (mode 1)',
        '2 нс – ложная проверка': '2 ns – spurious check',
      },
      figures: [
        {
          title: 'Only one of the clocks is present at the multiplexer output',
          caption: 'Without an exception, Vivado checks the m1_reg → m2_reg path with launch on clk100 and capture on clk125 (2 ns requirement). This combination never occurs at the multiplexer output.',
        },
      ],
      hints: [
        'The `clk_mux/O` output needs two generated clocks: one from input I0 and one from input I1. The second one is added with the `-add` option and an explicit `-master_clock`.',
        'The clocks at the multiplexer output cannot exist on the same net at the same time: this is `set_clock_groups -physically_exclusive`.',
        'Do not declare `clk100` and `clk125` themselves exclusive: there is a real path `a_reg → b_reg` between them.',
      ],
      explain: `
        \`\`\`
        create_generated_clock -name clk100_mux -divide_by 1 -source [get_pins clk_mux/I0] [get_pins clk_mux/O]
        create_generated_clock -name clk125_mux -divide_by 1 -add -master_clock clk125 \\
            -source [get_pins clk_mux/I1] [get_pins clk_mux/O]
        set_clock_groups -physically_exclusive -group [get_clocks clk100_mux] -group [get_clocks clk125_mux]
        \`\`\`
        - The generated clocks defined on \`clk_mux/O\` **replace** the master clocks after the multiplexer: beyond its output only \`clk100_mux\` and \`clk125_mux\` exist.
        - The second clock needs \`-add\` (otherwise it replaces the first one at the same point) and \`-master_clock\` (several master clocks reach the multiplexer output).
        - \`-physically_exclusive\` excludes only the paths between \`clk100_mux\` and \`clk125_mux\`. The path \`a_reg → b_reg\` (\`clk100 → clk125\`) is still analyzed, and so would be any path between a master clock and a clock at the multiplexer output (if, for example, \`a_reg\` sent data to \`m1_reg\`, the pairs \`clk100 → clk100_mux\` and \`clk100 → clk125_mux\` would be analyzed): these are real synchronous crossings.

        **A common mistake:** \`set_clock_groups -logically_exclusive -group clk100 -group clk125\`. It removes the spurious checks at the multiplexer output, but it also disables the real path \`a_reg → b_reg\`. UG903 allows this variant only if the master clocks interact exclusively through the multiplexer.
      `,
    },

    // -------------------------------------------------------------------------
    'gen.two_on_port': {
      title: 'Two possible frequencies on one input',
      langNote: '`create_clock -add` and `-physically_exclusive` groups are supported both in Vivado and in ASIC tools.',
      text: `
        The board is built in two variants: the oscillator connected to the \`clk_in\` pin of the FPGA is either **100 MHz** or **125 MHz**. There is a single FPGA configuration, and it must meet the timing requirements in both cases.

        **Task.** Define both clock variants on the \`clk_in\` port (named \`clk_100\` and \`clk_125\`) and specify that they cannot exist at the same time.
      `,
      strings: {
        'Генератор 100 или 125 МГц': 'Oscillator 100/125 MHz',
        'логика': 'logic',
        '10 нс': '10 ns',
        '8 нс': '8 ns',
      },
      figures: [
        {
          title: 'Two variants of one clock input',
          caption: 'Each variant must be analyzed separately, but mixed pairs such as "launch at 100 MHz, capture at 125 MHz" must not be analyzed.',
        },
      ],
      check: {
        forbid: [
          { msg: 'Clocks on the same port are not asynchronous but mutually exclusive', detail: 'For path analysis the result is the same, but -physically_exclusive is more precise: the clocks cannot be present on the same net at the same time (this also matters for crosstalk analysis).' },
          { msg: '-physically_exclusive is more precise', detail: 'Clocks on the same port physically cannot exist at the same time; -logically_exclusive describes clocks that are present in the chip at the same time but do not interact.' },
        ],
      },
      hints: [
        'A second clock on the same object is added with the `-add` option; without it, the new clock replaces the first one.',
        'Clocks that cannot exist on the same net at the same time are declared with `set_clock_groups -physically_exclusive`.',
      ],
      explain: `
        \`\`\`
        create_clock -name clk_100 -period 10.000 [get_ports clk_in]
        create_clock -name clk_125 -period 8.000 [get_ports clk_in] -add
        set_clock_groups -physically_exclusive -group [get_clocks clk_100] -group [get_clocks clk_125]
        \`\`\`
        - Without \`-add\`, the second \`create_clock\` command replaces the first one, and the analysis covers only 125 MHz.
        - Without \`set_clock_groups\`, Vivado also checks mixed pairs: launch by a 100 MHz edge and capture by a 125 MHz edge (2 ns requirement) and vice versa. These are false violations.
        - \`-physically_exclusive\` describes the situation most precisely: the net carries either one clock or the other.

        This way, a single analysis run covers both board variants: every path is checked at 100 MHz and at 125 MHz.
      `,
    },

    // -------------------------------------------------------------------------
    'gen.bufr_q': {
      title: 'BUFR with division: what to constrain?',
      langNote: 'Vivado derives the clock at the output of a dividing BUFR automatically. In an ASIC, a divider is defined manually with `create_generated_clock -divide_by`.',
      tags: ['BUFR', 'understanding'],
      text: `
        A source-synchronous input interface: the 400 MHz clock \`rx_clk\` arrives at an FPGA pin and goes through a \`BUFIO\` to the input registers and through a \`BUFR\` with \`BUFR_DIVIDE = 4\` to the logic running at 100 MHz.

        Which clock constraints are needed in XDC?
      `,
      strings: {
        '400 МГц': '400 MHz',
        '100 МГц': '100 MHz',
      },
      options: [
        { text: 'Only `create_clock -period 2.5 [get_ports rx_clk]`.', why: 'Correct. Vivado derives the clock after a dividing BUFR automatically (just as for an MMCM) and keeps its relationship to rx_clk.' },
        { text: '`create_clock` on the port and `create_clock -period 10` at the BUFR output.', why: 'create_clock at the BUFR output creates an independent primary clock: the 400 → 100 MHz crossing is no longer analyzed as synchronous.' },
        { text: '`create_clock` on the port and a mandatory `create_generated_clock -divide_by 4` at the BUFR output.', why: 'Not necessary: Vivado derives this clock itself. create_generated_clock is acceptable here only for renaming (without -source and -divide_by).' },
        { text: '`create_clock` at the BUFIO and BUFR outputs, without defining the port.', why: 'The clock is defined where it enters the FPGA; otherwise the input buffer delay is ignored, and the BUFIO and BUFR clocks end up unrelated.' },
      ],
      explain: `
        Vivado automatically derives the clocks at the outputs of MMCMs, PLLs, \`BUFR\` with \`BUFR_DIVIDE\` (other than BYPASS), \`BUFGCE_DIV\` and transceivers. Only the primary clock on the port has to be defined:
        \`\`\`
        create_clock -name rx_clk -period 2.500 [get_ports rx_clk]
        \`\`\`
        You can verify the result with \`report_clocks\`: it lists a clock with a 10 ns period and \`rx_clk\` as its master clock.
      `,
    },

    // -------------------------------------------------------------------------
    'gen.rel_num': {
      title: 'Calculation: edge relationship of 100 and 150 MHz',
      langNote: 'The rule for selecting launch and capture edges over the common period is the same in Vivado and PrimeTime.',
      tags: ['edge relationship', 'calculation'],
      text: `
        An MMCM generates **100 MHz** and **150 MHz** clocks from one input clock, with coincident rising edges at time 0. A register running at 100 MHz sends data to a register running at 150 MHz, and vice versa.

        Determine the requirements that static timing analysis derives with ideal clocks.
      `,
      figures: [
        {
          title: 'Common period 20 ns',
          marks: [{ t: 0, label: '0' }, { t: 10, label: '10' }, { t: 13.333, label: '13.333' }, { t: 20, label: '20' }],
          caption: 'All "launch edge – nearest following capture edge" pairs within the common period are examined, and the tightest one is selected.',
        },
      ],
      fields: [
        { label: 'Setup requirement, 100 → 150 MHz' },
        { label: 'Hold requirement, 100 → 150 MHz' },
        { label: 'Setup requirement, 150 → 100 MHz' },
      ],
      hints: [
        'The common period is the least common multiple: LCM(10, 6.667) = 20 ns. The 100 MHz edges: 0, 10; the 150 MHz edges: 0, 6.667, 13.333.',
        'For each launch edge, find the nearest following capture edge and select the smallest interval.',
      ],
      explain: `
        **100 → 150 MHz.** Launch edges at 0 and 10 ns; the nearest following capture edges are at 6.667 and 13.333 ns. The intervals are 6.667 and 3.333 ns → setup requirement **3.333 ns**.

        Hold requirement: data launched at 0 must not corrupt the capture by the preceding capture edge, which is also at time 0 (the edges coincide) → **0 ns**.

        **150 → 100 MHz.** Launch edges at 0, 6.667 and 13.333 ns; capture edges at 10 and 20 ns. For the capture at 10 ns, the last preceding launch is at 6.667 ns (an interval of 3.333 ns); for the capture at 20 ns, it is at 13.333 ns (6.667 ns). Setup requirement **3.333 ns**.

        This is a typical case where a synchronous transfer between related clocks "eats up" most of the period. If the data is held stable for several clock cycles, a multicycle path is applied; otherwise, pipelining or a transfer through a FIFO is used.

        You can check this in the console of any task with an MMCM: \`report_clock_interaction\`.
      `,
    },

    // -------------------------------------------------------------------------
    'gen.phase_num': {
      title: 'Calculation: phase-shifted clock',
      langNote: 'The edge relationship calculation is the same. In Vivado, a phase-shifted MMCM clock is derived automatically; in an ASIC, a phase-shifted PLL output is defined with `create_generated_clock` (the shift is set by the `-edge_shift` option together with `-edges`).',
      tags: ['edge relationship', 'phase', 'calculation'],
      text: `
        From a 125 MHz input clock (8 ns period), an MMCM generates a copy, \`clk_90\`, shifted by **+90°**. A register clocked on the rising edge of the master clock sends data to a register clocked on the rising edge of \`clk_90\`.

        Determine the setup and hold requirements. Then determine the same values for a **−90°** shift.
      `,
      strings: {
        'предыдущий захват': 'previous capture',
      },
      figures: [
        { title: 'Shift +90° = 2 ns' },
      ],
      fields: [
        { label: '+90° shift: setup requirement' },
        { label: '+90° shift: hold requirement' },
        { label: '−90° shift: setup requirement' },
        { label: '−90° shift: hold requirement' },
      ],
      hints: [
        '+90° at an 8 ns period is 2 ns. The nearest capture edge after the launch at 0 ns is at 2 ns.',
        'Hold: data launched at 0 must not corrupt the capture by the previous clk_90 edge, at 2 − 8 = −6 ns.',
      ],
      explain: `
        **+90°:** the \`clk_90\` edges are at 2, 10, … ns. Launch at 0 → capture at 2: setup **2 ns**. The previous capture edge is at −6 ns; the next launch edge is at 8 ns (relative to the capture at 2 ns: 2 − 8 = −6) → hold **−6 ns**.

        **−90°:** the edges are at 6, 14, … ns (−2 modulo the period). Launch at 0 → capture at 6: setup **6 ns**; the previous capture is at −2 ns → hold **−2 ns**.

        A phase shift redistributes the margin between setup and hold: a positive shift reduces the time available for setup and relaxes the hold requirement. This is exactly why, in interfaces with edge-aligned data, the capture clock is shifted by 90°: its edge then falls in the middle of the data window.
      `,
    },
  },
});
