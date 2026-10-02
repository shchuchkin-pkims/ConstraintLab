/* English translation of bank/01_clocks.js (module 1: clock basics) */
XT.bank.i18n('en', {
  modules: {
    clocks: {
      title: '1. Clocks: the basics',
      about: 'create_clock, clock waveform, differential inputs, asynchronous clocks, clocks derived automatically by MMCM',
    },
  },
  questions: {
    'clocks.primary': {
      title: 'Primary clock, 100 MHz',
      langNote: '`create_clock` is written the same way in Vivado and in ASIC tools (Design Compiler, PrimeTime, Genus, Innovus, OpenSTA).',
      text: `
        The board carries a **100 MHz** crystal oscillator. Its output drives the \`sys_clk\` pin of the FPGA (Artix-7). Inside the FPGA the signal passes through the input buffer \`IBUF\` and the global clock buffer \`BUFG\` and clocks an 8-bit counter.

        Until the clock is defined, Vivado does not know its frequency: paths between the counter registers are not analyzed, and \`check_timing\` reports *no_clock*.

        **Task.** Define the primary clock named \`sys_clk\`.
      `,
      strings: {
        '100 МГц': '100 MHz',
        'ПЛИС (Artix-7)': 'FPGA (Artix-7)',
        'T = 10 нс': 'T = 10 ns',
        'высокий уровень 5 нс': 'high level 5 ns',
      },
      figures: [
        { title: 'Oscillator clock at the FPGA pin' },
      ],
      hints: [
        'Period in nanoseconds: T = 1000 / f[MHz].',
        'A primary clock is defined where it enters the FPGA, on the port: `[get_ports sys_clk]`.',
        'Syntax: `create_clock -name <name> -period <ns> [get_ports <port>]`. The {0 5} waveform is the default.',
      ],
      explain: `
        \`\`\`
        create_clock -name sys_clk -period 10.000 [get_ports sys_clk]
        \`\`\`
        - **-period** is given in nanoseconds (the XDC time unit). 100 MHz → 10 ns.
        - **-waveform** defaults to {0 T/2}: rising edge at time 0, falling edge in the middle of the period. That is enough for an oscillator with a symmetrical output.
        - **Why the port.** The clock definition point is where the clock tree delay is measured from. When the clock is defined on the port, Vivado accounts for the delay of IBUF, BUFG and routing to every register, so it computes both register-to-register paths and I/O paths correctly. A clock defined at the BUFG output would ignore the input buffer delay, and input interfaces would be analyzed incorrectly.
        - The name is optional (it then equals the port name), but an explicit name makes reports and the other constraints easier to read.

        Check in Vivado: \`report_clocks\`, then \`check_timing\`: the *no_clock* warning must be gone.
      `,
    },

    // -------------------------------------------------------------------------
    'clocks.diff': {
      title: 'Differential LVDS clock, 200 MHz',
      langNote: 'The command is the same. In an ASIC, the LVDS receiver is an analog block: if its model has no timing arc from the pad to the output, the clock is defined at the receiver output.',
      text: `
        A **200 MHz** reference oscillator with an LVDS output is connected to the pin pair \`clk200_p\` and \`clk200_n\`. Inside the FPGA the pair drives the differential input buffer \`IBUFDS\`, followed by a \`BUFG\`.

        **Task.** Define the clock named \`clk200\`.
      `,
      strings: {
        'Генератор LVDS 200 МГц': 'LVDS oscillator 200 MHz',
        'обработка': 'processing',
        'T = 5 нс': 'T = 5 ns',
      },
      figures: [
        {
          title: 'Differential pair at the FPGA pins',
          caption: 'The signal on the N pin is an inverted copy of the signal on the P pin. It is the same clock, not a second one.',
        },
      ],
      hints: [
        'With an IBUFDS buffer, the clock is defined on only one pin of the pair.',
        'Use the P pin: it is connected to the I input of the buffer.',
      ],
      explain: `
        \`\`\`
        create_clock -name clk200 -period 5.000 [get_ports clk200_p]
        \`\`\`
        A differential pair carries **one** clock. Vivado propagates it from the P pin through the IBUFDS; the N pin needs no definition.

        If you also define a clock on \`clk200_n\`, the same net carries two clocks: spurious checks appear between them (with a half-period edge relationship because of the inversion), and \`check_timing\` reports *multiple_clock*.

        The physical constraints of the pair (\`PACKAGE_PIN\` and \`IOSTANDARD LVDS\` or \`LVDS_25\`) are also set on the P pin: Vivado assigns the N pin automatically.
      `,
    },

    // -------------------------------------------------------------------------
    'clocks.waveform': {
      title: 'Asymmetric clock and half-period paths',
      langNote: 'The `-waveform` option and the analysis of half-period paths are the same in XDC and SDC.',
      tags: ['create_clock', '-waveform', 'falling edge'],
      text: `
        An external device drives the clock \`pclk\` at **125 MHz** with a **40%** duty cycle: according to the data sheet, the high level lasts 3.2 ns and the low level 4.8 ns (worst case).

        The design contains the register \`neg_reg\`, clocked on the **falling edge** (\`IS_C_INVERTED = 1\`). The path \`pos_reg → neg_reg\` is a half-period path: data is launched by a rising edge and captured by the nearest falling edge.

        **Task.** Define the clock \`pclk\` so that the edge relationships match the actual duty cycle.
      `,
      strings: {
        'запуск ↑': 'launch ↑',
        'захват ↓': 'capture ↓',
        'захват ↑': 'capture ↑',
        '3,2 нс': '3.2 ns',
        '4,8 нс': '4.8 ns',
      },
      figures: [
        { title: 'pclk: high level 3.2 ns, low level 4.8 ns' },
      ],
      hints: [
        'The duty cycle is set with the `-waveform {<rising edge time> <falling edge time>}` option, within one period.',
        'Rising edge at time 0, falling edge 3.2 ns later: `-waveform {0 3.2}`.',
      ],
      explain: `
        \`\`\`
        create_clock -name pclk -period 8.000 -waveform {0.000 3.200} [get_ports pclk]
        \`\`\`
        By default, Vivado assumes a symmetrical clock ({0 4}). A rising-to-falling path would then get 4 ns, although only 3.2 ns is actually available, so the analysis would be **optimistic** by 0.8 ns.

        With the correct waveform:
        - \`pos_reg → neg_reg\` (rising → falling): setup requirement 3.2 ns;
        - \`neg_reg → out_reg\` (falling → rising): setup requirement 4.8 ns.

        Both requirements are shown on the "Path analysis" tab. A phase-shifted clock is also described with -waveform: a 90° shift at T = 8 ns is \`{2 6}\`.

        A note on terminology: the fraction of the period spent at the high level (40%) is the **duty cycle**. Do not confuse it with its reciprocal, the ratio of the period to the pulse width: T/τ = 8/3.2 = 2.5.
      `,
    },

    // -------------------------------------------------------------------------
    'clocks.async': {
      title: 'Two independent oscillators',
      langNote: '`set_clock_groups -asynchronous` is supported by both Vivado and ASIC tools; in ASIC flows, crossings between such domains are additionally verified with structural CDC analysis.',
      tags: ['create_clock', 'set_clock_groups', 'clock domains'],
      text: `
        The system logic runs from a **100 MHz** oscillator (\`sys_clk\`). The Ethernet physical layer device (PHY) provides its own **125 MHz** receive clock (\`eth_rxc\`); it comes from the PHY's own crystal and is in no way related to \`sys_clk\`.

        A single-bit flag is passed from the \`sys_clk\` clock domain to the \`eth_rxc\` domain through a classic two-flip-flop synchronizer.

        **Task.** Define both clocks (\`sys_clk\` and \`eth_rxc\`) and tell Vivado that there is no fixed phase relationship between them.
      `,
      strings: {
        'домен sys_clk (100 МГц)  →  домен eth_rxc (125 МГц)': 'sys_clk domain (100 MHz)  →  eth_rxc domain (125 MHz)',
        '2 нс': '2 ns',
      },
      figures: [
        {
          title: 'Without the asynchronous declaration, the worst edge pair is 2 ns apart',
          caption: 'If the clocks are treated as synchronous, Vivado finds a pair of edges only 2 ns apart and requires the path to fit into 2 ns. In reality the phase relationship is random, and the reliability of the transfer is ensured by the synchronizer, not by static timing analysis.',
        },
      ],
      hints: [
        'First, two create_clock commands: one for each input clock port.',
        'Unrelated clocks are declared with `set_clock_groups -asynchronous` with two groups.',
      ],
      explain: `
        \`\`\`
        create_clock -name sys_clk -period 10.000 [get_ports sys_clk]
        create_clock -name eth_rxc -period 8.000 [get_ports eth_rxc]
        set_clock_groups -asynchronous -group [get_clocks sys_clk] -group [get_clocks eth_rxc]
        \`\`\`
        Without \`set_clock_groups\`, Vivado treats any two clocks as **related**: it expands them over a common period (40 ns) and looks for the worst edge pair. For 100 and 125 MHz that is 2 ns, so the path \`flag_reg → flag_sync_reg[0]\` appears "violated", although there is no fixed relationship between the clocks. The \`report_clock_interaction\` report shows this pair as **Timed (unsafe)**: the pair is timed, but the timing is unsafe.

        The \`set_clock_groups -asynchronous\` command excludes all paths between the groups in both directions. The correctness of the transfer is ensured by the synchronizer (together with the \`ASYNC_REG\` property on its registers; see the module on clock domain crossing).

        For this design, an equivalent form is \`set_false_path\` in both directions between the clocks. However, if the design contains Gray-coded buses or XPM_CDC macros with \`set_max_delay -datapath_only\`, the global exception overrides them; in that case, constrain the paths individually.

        A convenient form for designs with an MMCM is \`-group [get_clocks -include_generated_clocks sys_clk]\`, which also puts the generated clocks into the group.
      `,
    },

    // -------------------------------------------------------------------------
    'clocks.mmcm': {
      title: 'MMCM: auto-derived clocks and renaming them',
      langNote: 'Vivado derives the clocks at the MMCM outputs automatically, and `create_generated_clock` without `-source` only renames a derived clock. In ASIC tools, a PLL output is defined manually with a complete `create_generated_clock` command (see [[q:asic.pll_div|the task on a PLL and a divider]]).',
      text: `
        The Clocking Wizard IP (\`u_clk\`) generates **200 MHz** (CLKOUT0) and **50 MHz** (CLKOUT1) clocks from the **100 MHz** clock on the \`sys_clk\` input. A 16-bit bus is transferred from the 200 MHz domain to the 50 MHz domain (the clocks are related, the transfer is synchronous).

        Vivado derives the clocks at the MMCM outputs **automatically**; their names match the net names: \`clk_out1_clk_wiz_0\`, \`clk_out2_clk_wiz_0\`.

        **Task.**
        1. Define what is actually required for the analysis.
        2. The 50 MHz clock must be named \`clk_ctrl\` in the design reports. Rename it **without changing** its parameters or its relationship to the input clock.
      `,
      strings: {
        'CLKOUT0: 200 МГц': 'CLKOUT0: 200 MHz',
        'CLKOUT1: 50 МГц': 'CLKOUT1: 50 MHz',
        '200 МГц': '200 MHz',
        '50 МГц': '50 MHz',
        'предустановка 5 нс': 'setup 5 ns',
      },
      figures: [
        { title: 'The MMCM clocks are tied to the input clock' },
      ],
      hints: [
        'In Vivado, the MMCM outputs need no create_clock: defining the input clock is enough.',
        'To rename an automatically derived clock: `create_generated_clock -name <new_name> [get_pins <MMCM>/CLKOUT1]`, without -source and without -divide_by/-multiply_by.',
      ],
      explain: `
        \`\`\`
        create_clock -name sys_clk -period 10.000 [get_ports sys_clk]
        create_generated_clock -name clk_ctrl [get_pins u_clk/mmcm_inst/CLKOUT1]
        \`\`\`
        - From the MMCM parameters (CLKFBOUT_MULT, DIVCLK_DIVIDE, CLKOUTn_DIVIDE, phase), Vivado itself builds generated clocks with the exact waveform and the **relationship to the input clock**. The 200 → 50 MHz transfer is therefore analyzed as synchronous: the setup requirement is 5 ns (from the last 200 MHz edge before a 50 MHz edge), the hold requirement is 0.
        - The \`create_generated_clock\` command **without -source and without -divide_by/-multiply_by** at an MMCM output only renames the automatically derived clock; the parameters come from the MMCM settings.
        - You can also define the clock completely (\`-source [get_pins …/CLKIN1] -divide_by 2\`): this is accepted too if the parameters match the MMCM settings. However, whenever the MMCM settings change, such a constraint has to be corrected by hand.
        - **Do not** apply \`create_clock\` to a CLKOUT output: it creates a new *primary* clock that has no relationship to \`sys_clk\` and ignores the delay of the input part of the clock tree.

        A robust way to refer to an automatically derived clock without knowing its name: \`[get_clocks -of_objects [get_pins u_clk/mmcm_inst/CLKOUT1]]\`.
      `,
    },

    // -------------------------------------------------------------------------
    'clocks.mmcm_q': {
      title: 'Which constraints do the MMCM outputs need?',
      langNote: 'This question is about Vivado: ASIC tools do not derive PLL output clocks automatically, so each output needs `create_generated_clock` (see [[q:asic.pll_div|the task on a PLL and a divider]]).',
      tags: ['MMCM', 'understanding'],
      text: `
        The same design: the MMCM generates 200 and 50 MHz clocks from a 100 MHz clock, and a synchronous bus crosses from the 200 MHz domain to the 50 MHz domain.

        Which set of clock constraints is **correct and sufficient** in Vivado?
      `,
      strings: {
        'CLKOUT0: 200 МГц': 'CLKOUT0: 200 MHz',
        'CLKOUT1: 50 МГц': 'CLKOUT1: 50 MHz',
        '200 МГц': '200 MHz',
        '50 МГц': '50 MHz',
      },
      options: [
        { text: '`create_clock` on the input port `sys_clk`, and nothing else.', why: 'Correct. Vivado derives the clocks at the MMCM outputs itself, including their phase and their relationship to the input clock.' },
        { text: '`create_clock` on the input port and on each MMCM output (CLKOUT0, CLKOUT1).', why: 'create_clock on the outputs creates independent primary clocks: the relationship to the input clock and the delay of the input part of the clock tree are lost. Paths between the domains are then timed as unsafe.' },
        { text: '`create_clock` on the input and `set_clock_groups -asynchronous` between CLKOUT0 and CLKOUT1.', why: 'Clocks from the same MMCM are synchronous: their phases are rigidly related. Declaring them asynchronous disables the analysis of the real 200 → 50 MHz paths and hides violations.' },
        { text: 'A mandatory `create_generated_clock` for each MMCM output.', why: 'Not required: Vivado creates these clocks automatically. create_generated_clock at an MMCM output is used only for renaming (and in the ASIC design flow).' },
      ],
      explain: `
        In Vivado, the input clock of an MMCM/PLL is the only thing that has to be defined. The same applies to BUFR and BUFGCE_DIV buffers with division and to GT transceivers (the TXOUTCLK and RXOUTCLK clocks are defined by the constraints of the IP itself).

        You can verify this in the console: \`report_clocks\` shows these clocks as automatically derived.
      `,
    },
  },
});
