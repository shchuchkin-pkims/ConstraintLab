/* English translation of bank/04_ssin.js (module 4: source-synchronous inputs) */
XT.bank.i18n('en', {
  modules: {
    ssin: {
      title: '4. Source-synchronous inputs',
      about: 'An external device sends the clock together with the data: SDR and DDR, center-aligned and edge-aligned data, launch on the falling edge, LVDS DDR, RGMII with and without internal delay (90° MMCM phase shift)',
    },
  },
  questions: {
    'ssin.sdr_center': {
      title: 'Image sensor: SDR, center-aligned data',
      langNote: 'Input delays and their calculation are the same in XDC and SDC.',
      tags: ['create_clock', 'set_input_delay', 'source-synchronous'],
      text: `
        An image sensor sends 10-bit samples \`pix_d[9:0]\` to the FPGA together with the **100 MHz** clock \`pix_clk\`, which the sensor generates itself. The data and clock traces are length-matched, so the sensor data sheet specifies the timing directly at the receiver pins:

        | Parameter | Value |
        |---|---|
        | data valid before the \`pix_clk\` rising edge | at least 2.0 ns |
        | data valid after the \`pix_clk\` rising edge | at least 1.5 ns |

        The data is center-aligned: the \`pix_clk\` rising edge falls in the middle of the interval in which the data is valid. Inside the FPGA the clock passes through IBUF and BUFG, and the data is captured on the rising edge by the \`pix_d_reg\` registers.

        **Task.** Define the \`pix_clk\` clock and the input delays for the \`pix_d[9:0]\` bus.
      `,
      strings: {
        'Датчик': 'Sensor',
        'трассы выровнены': 'matched traces',
        'обработка': 'processing',
        'pix_clk (ПЛИС)': 'pix_clk (FPGA)',
        'pix_d (ПЛИС)': 'pix_d (FPGA)',
        'запуск D1': 'launch D1',
        'захват D1': 'capture D1',
        '-max = T − 2,0 = 8,0 нс': '-max = T − 2.0 = 8.0 ns',
        '-min = 1,5 нс': '-min = 1.5 ns',
        '2,0': '2.0',
        '1,5': '1.5',
      },
      figures: [
        {
          title: 'Center-aligned data: valid window around the edge',
          caption: 'The valid windows (2.0 ns before the rising edge and 1.5 ns after it) are shaded. Relative to the launch edge (0), the data starts changing no earlier than 1.5 ns (-min) and settles no later than 10 − 2.0 = 8.0 ns (-max). Capture happens on the next rising edge; hold is checked on the same edge.',
        },
      ],
      hints: [
        'The clock arrives from the sensor at the `pix_clk` port: it is a primary clock and is defined on the port.',
        'The input delay is measured from the edge that launched the data. The next data settles no later than 2.0 ns before the next rising edge, and the current data holds for at least 1.5 ns after the edge.',
        '-max = T − 2.0 = 8.0 ns; -min = 1.5 ns.',
      ],
      explain: `
        \`\`\`
        create_clock -name pix_clk -period 10.000 [get_ports pix_clk]
        set_input_delay -clock pix_clk -max 8.000 [get_ports {pix_d[*]}]
        set_input_delay -clock pix_clk -min 1.500 [get_ports {pix_d[*]}]
        \`\`\`
        **The Vivado model.** The data is considered launched by the \`pix_clk\` rising edge at the clock definition point, the FPGA pin (time 0). Capture happens on the next rising edge (10 ns), and hold is checked on the same edge (0 ns). The input delay tells the tool when the data changes relative to the launch edge.

        **Deriving the formulas.** The data sheet specifies a valid window around the rising edge: t_su = 2.0 ns before it and t_h = 1.5 ns after it.
        - New data settles no later than t_su before the next rising edge: -max = T − t_su = 10 − 2.0 = **8.0 ns**;
        - the current data holds for t_h after the edge, so the earliest change is at -min = t_h = **1.5 ns**.

        **What the analysis checks.** Setup: the requirement is 10 ns and the external part of the path is 8.0 ns, which leaves 2.0 ns for the difference between the data and clock delays inside the FPGA plus the register setup time. Hold: the data is stable for 1.5 ns after the edge, a margin against the clock tree delay (IBUF and BUFG). In a source-synchronous interface it is exactly this difference that matters: the clock and the data travel together, so the board traces do not enter the calculation.

        **Common mistakes.**
        - Using the data sheet numbers directly (-max 2.0, -min 1.5): -max = 2.0 means that the data settles 2 ns after the edge, so the setup analysis becomes optimistic by 6 ns.
        - A negative -min (−1.5 ns): it would mean that the data changes 1.5 ns before the edge; the hold check becomes 3 ns stricter than reality, and Vivado will try to fix violations that do not exist.
        - Defining the clock at the BUFG output: the IBUF and BUFG delay drops out of the analysis, and the results for the input paths become unreliable.

        **Check in Vivado:** \`report_timing -from [get_ports {pix_d[*]}] -delay_type min_max\` shows a requirement of 10 ns for setup and 0 ns for hold, with *input delay* lines of 8.000 and 1.500; \`report_datasheet\` shows the resulting input requirements relative to \`pix_clk\`.
      `,
      refs: 'UG903, chapter "Constraining I/O Delay", Source Synchronous, Center Aligned, SDR template',
    },

    // -------------------------------------------------------------------------
    'ssin.sdr_edge': {
      title: 'ADC with a DCO output: SDR, edge-aligned data',
      langNote: 'Input delays are the same in XDC and SDC. The ways to fix the capture (MMCM, IDELAYE2) are FPGA primitives; in an ASIC, programmable delay lines or a PLL with a phase shift serve the same purpose.',
      tags: ['set_input_delay', 'source-synchronous', 'negative delay'],
      text: `
        An ADC with a parallel CMOS output provides 14-bit samples \`adc_d[13:0]\` and an **80 MHz** data clock output DCO (\`adc_dco\`). According to the data sheet, the data is **edge-aligned** to DCO: relative to the DCO rising edge at the FPGA pins, the data can change within **−0.4 to +0.6 ns** (the traces are length-matched). The FPGA captures the data on the \`adc_dco\` rising edge in the \`adc_d_reg\` registers.

        The clock is already defined (see the "Already in the project" box).

        **Task.** Define the input delays for the \`adc_d[13:0]\` bus.
      `,
      strings: {
        'АЦП 14 бит': '14-bit ADC',
        'обработка': 'processing',
        'adc_dco (ПЛИС)': 'adc_dco (FPGA)',
        'adc_d (ПЛИС)': 'adc_d (FPGA)',
        'запуск D1 = удержание D0': 'launch D1 = hold D0',
        'захват D1': 'capture D1',
        'предустановка: 12,5 нс': 'setup: 12.5 ns',
        '-max = +0,6 нс': '-max = +0.6 ns',
        '-min = −0,4 нс': '-min = −0.4 ns',
      },
      figures: [
        {
          title: 'Data changes around the DCO rising edge',
          caption: 'New data D1 appears within −0.4…+0.6 ns of the edge that launched it. By default D1 is captured by the next rising edge (12.5 ns), and hold is checked on the same edge (0): data D0 must remain stable after that edge, yet it starts changing as early as 0.4 ns before it.',
        },
      ],
      hints: [
        'The input delay is the time from the launch edge to the data change. The interval in which the data changes is exactly the interval from -min to -max.',
        'The latest change is 0.6 ns after the edge (-max 0.6); the earliest is 0.4 ns before the edge, that is, −0.4 ns (-min -0.4).',
      ],
      explain: `
        \`\`\`
        set_input_delay -clock adc_dco -max 0.600 [get_ports {adc_d[*]}]
        set_input_delay -clock adc_dco -min -0.400 [get_ports {adc_d[*]}]
        \`\`\`
        **The sign of -min.** The input delay is the time from the launch edge to the data change. The ADC generates DCO and the data through different circuits, so the data can change slightly *before* the edge that "launched" it. The earliest change is 0.4 ns before the edge, hence the negative value **−0.4 ns**. The latest change is **0.6 ns** after the edge.

        **Which edge captures.** By default Vivado checks setup against the *next* rising edge: the requirement is 12.5 ns with an external path part of 0.6 ns, a huge margin. Hold is checked against the *same* edge (requirement 0 ns): the data starts changing 0.4 ns before it, and inside the FPGA the edge is further delayed by the clock tree (IBUF and BUFG, a few nanoseconds). With direct capture the hold check will almost certainly fail, and that is the correct analysis result, not a constraint error.

        **How to fix it.** The constraints describe the interface and stay the same; the capture circuit changes:
        - shift the capture clock with an MMCM (Vivado derives the shifted clock automatically);
        - delay the data with an IDELAYE2 delay line;
        - capture on the DCO falling edge, that is, in the middle of the valid interval: Vivado then selects the "rise → fall" edge pair with a setup requirement of 6.25 ns and a hold requirement of −6.25 ns.

        **Common mistakes.**
        - -min = +0.4 ns: the hold check becomes 0.8 ns more relaxed than reality and hides the violation.
        - Swapping "before" and "after" (-max 0.4, -min −0.6): both checks shift by 0.2 ns in the wrong direction.
        - Using the center-aligned formulas (-max = T − …): they describe a completely different window.
        - Selecting the ports with the pattern \`[get_ports adc_d*]\`: it also matches the clock port \`adc_dco\`. A delay on the clock port is meaningless, and Vivado warns about it. \`[get_ports {adc_d[*]}]\` is safer.

        **Check in Vivado:** \`report_timing -from [get_ports {adc_d[*]}] -hold\` shows hold against the same edge, and \`report_timing -from [get_ports {adc_d[*]}] -setup\` shows setup against the next one.
      `,
      refs: 'UG903, chapter "Constraining I/O Delay", Source Synchronous, Edge Aligned, SDR template',
    },

    // -------------------------------------------------------------------------
    'ssin.dvp_fall': {
      title: 'DVP camera: data launched on the falling edge',
      langNote: 'The `-clock_fall` option is the same in XDC and SDC.',
      text: `
        A camera with a parallel DVP interface sends image bytes \`cam_d[7:0]\` and the line and frame sync signals \`cam_href\` and \`cam_vsync\` to the FPGA together with the **25 MHz** clock \`cam_pclk\`. According to the data sheet, the camera changes all these signals on the **falling edge** of PCLK with a delay of **0…5 ns** (at the FPGA pins), and the receiver must capture them on the rising edge.

        In the FPGA, the registers \`cam_d_reg\`, \`href_reg\` and \`vsync_reg\` are clocked by the rising edge of \`cam_pclk\` through IBUF and BUFG.

        **Task.** Define the clock (any name you like) and the input delays for \`cam_d[7:0]\`, \`cam_href\` and \`cam_vsync\`.
      `,
      strings: {
        'Камера': 'Camera',
        'удержание D0': 'hold D0',
        'запуск D1 (спад)': 'launch D1 (fall)',
        'захват D1 (фронт)': 'capture D1 (rise)',
        'предустановка: 20 нс (спад → фронт)': 'setup: 20 ns (fall → rise)',
        'удержание: −20 нс': 'hold: −20 ns',
        '0…5 нс': '0…5 ns',
        'запас 15 нс': 'margin 15 ns',
      },
      figures: [
        {
          title: 'Launch on the falling edge, capture on the rising edge',
          caption: 'The camera changes the signals on the PCLK falling edge (20 ns) with a delay of 0…5 ns, and the FPGA captures them on the next rising edge (40 ns). The input delay is therefore measured from the falling edge (-clock_fall): half a period minus 5 ns remains for setup, and half a period for hold.',
        },
      ],
      hints: [
        'The input delay is measured from the clock edge on which the external device launches the data. Here it is the falling edge.',
        'The `-clock_fall` option specifies that the delay is measured from the falling edge: `set_input_delay -clock <clock> -clock_fall -max 5 …`, then the same with `-min 0`.',
      ],
      explain: `
        \`\`\`
        create_clock -name pclk -period 40.000 [get_ports cam_pclk]
        set_input_delay -clock pclk -clock_fall -max 5.000 [get_ports {cam_d[*] cam_href cam_vsync}]
        set_input_delay -clock pclk -clock_fall -min 0.000 [get_ports {cam_d[*] cam_href cam_vsync}]
        \`\`\`
        **The reference edge is the falling edge.** With -clock_fall, Vivado treats the data as launched by the falling edge (20 ns) and pairs it with capture edges: setup "fall → next rise" = **20 ns**, hold "fall → previous rise" = **−20 ns**. Before the delays inside the FPGA are taken into account, the margins are 20 − 5 = 15 ns for setup and 20 ns for hold. This is how the interface is designed: changing on the falling edge and capturing on the rising edge gives the data half a period for setup and half a period for hold.

        **Without -clock_fall** the delay is measured from the rising edge: the data "appears" 0…5 ns after the rising edge, capture happens on the next rising edge (40 ns), and hold is checked on the same edge (0 ns). The setup analysis becomes 20 ns more optimistic and the hold analysis 20 ns stricter: Vivado reports false hold violations and starts "fixing" them by adding delays.

        **Why not -max 25 -min 20 relative to the rising edge.** These numbers give the same margins, but only with a duty cycle of exactly 50%. The -clock_fall option ties the delay to the actual falling edge: if the clock waveform is specified with -waveform, the analysis stays correct. An "inverted" clock (\`-waveform {20 40}\`) does not work either: the FPGA registers are clocked by the rising edge of the real signal, and shifting the waveform shifts the capture times.

        The \`cam_href\` and \`cam_vsync\` signals are launched by the same falling edge, so they belong in the same commands: a forgotten sync signal stays unconstrained.

        **Check in Vivado:** in \`report_timing -from [get_ports {cam_d[*]}] -delay_type min_max\` the 20.000 ns setup requirement is computed as *pclk rise@40.000ns − pclk fall@20.000ns*; \`check_timing\` must not report *no_input_delay*.
      `,
      refs: 'UG903, chapter "Constraining I/O Delay", the -clock_fall option',
    },

    // -------------------------------------------------------------------------
    'ssin.ddr_center': {
      title: 'ADC with an LVDS DDR output: center-aligned data',
      langNote: 'The DDR template (`-clock_fall`, `-add_delay`) is the same in XDC and SDC; IDDR is an FPGA primitive.',
      text: `
        A high-speed ADC sends 8-bit samples at double data rate (DDR) over eight LVDS differential pairs \`adc_d_p/n[7:0]\` together with a **250 MHz** data clock output DCO (the \`adc_dco_p/n\` pair). The data is **center-aligned**: according to the ADC data sheet, each data word is valid at the FPGA pins for at least **0.6 ns before and 0.6 ns after** its DCO rising or falling edge.

        In the FPGA, the clock passes through IBUFDS and BUFG, and the data passes through IBUFDS to IDDR flip-flops, which capture data on both the rising and the falling edge.

        **Task.** Define the \`adc_dco\` clock and the data input delays: the -max and -min values relative to the rising edge and relative to the falling edge.
      `,
      strings: {
        'АЦП LVDS': 'LVDS ADC',
        'обработка': 'processing',
        'adc_dco (ПЛИС)': 'adc_dco (FPGA)',
        'adc_d (ПЛИС)': 'adc_d (FPGA)',
        'фронт': 'rise',
        'спад': 'fall',
        '-max = 1,4 (фронт)': '-max = 1.4 (rise)',
        '-min = 0,6 (фронт)': '-min = 0.6 (rise)',
        '-max = 1,4 (спад)': '-max = 1.4 (fall)',
        '-min = 0,6 (спад)': '-min = 0.6 (fall)',
      },
      figures: [
        {
          title: 'Center-aligned DDR: data valid windows',
          caption: 'R is data captured on the rising edge, F on the falling edge; each is valid 0.6 ns before and after its own edge (dv_bre, dv_are, dv_bfe, dv_afe). The delay relative to the rising edge describes the R0 → F0 transition: the earliest change is dv_are after the rising edge (-min = 0.6 ns), the latest is dv_bfe before the falling edge (-max = T/2 − dv_bfe = 1.4 ns). Relative to the falling edge, everything is symmetrical.',
        },
      ],
      hints: [
        'The clock and the delays are specified only on the P-side ports of the differential pairs.',
        'For center-aligned DDR, Vivado by default checks setup over half a period (rise → fall) and hold on the same edge. The delay relative to the rising edge therefore describes the data that the nearest falling edge captures: -max = T/2 − (valid before the falling edge), -min = (valid after the rising edge).',
        'Four commands: -max 1.4 and -min 0.6 relative to the rising edge, then the same values with -clock_fall; the second pair must have -add_delay.',
      ],
      explain: `
        \`\`\`
        create_clock -name adc_dco -period 4.000 [get_ports adc_dco_p]
        set_input_delay -clock adc_dco -max 1.400 [get_ports {adc_d_p[*]}]
        set_input_delay -clock adc_dco -min 0.600 [get_ports {adc_d_p[*]}]
        set_input_delay -clock adc_dco -clock_fall -max 1.400 -add_delay [get_ports {adc_d_p[*]}]
        set_input_delay -clock adc_dco -clock_fall -min 0.600 -add_delay [get_ports {adc_d_p[*]}]
        \`\`\`
        **UG903 template notation:** dv_bre and dv_are mean data valid before and after the rising edge, dv_bfe and dv_afe before and after the falling edge. Here all four equal 0.6 ns, and T = 4 ns.

        **Why the delay "from the rising edge" describes the data captured on the falling edge.** The reference edge of an input delay is the *launch* edge. The default analysis for this interface gives a half-period setup check and a hold check on the same edge. The data that changes after the rising edge (F0) is captured by the nearest falling edge T/2 = 2 ns later; it must settle dv_bfe before the falling edge, so -max = T/2 − dv_bfe = 2 − 0.6 = **1.4 ns**. Hold is checked on the same edge: the data R0 captured by it holds for dv_are after it, so -min = dv_are = **0.6 ns**. For the falling edge everything is symmetrical: -max = T/2 − dv_bre, -min = dv_afe.

        **The resulting checks** (the "Path analysis" tab):

        | Launch → capture | Setup | Hold |
        |---|---|---|
        | rise → fall | 2 ns, slack 2 − 1.4 = 0.6 ns | −2 ns |
        | rise → rise | 4 ns | 0 ns, slack 0.6 ns |
        | fall → rise | 2 ns, slack 0.6 ns | −2 ns |
        | fall → fall | 4 ns | 0 ns, slack 0.6 ns |

        The critical checks are the half-period setup and the same-edge hold; their slacks exactly equal the valid windows from the data sheet.

        **Why -add_delay.** A command without -add_delay replaces an existing delay of the same kind (-max or -min) on that port, even if it was specified relative to a different edge. Without -add_delay the second pair of commands erases the delays relative to the rising edge: half of the checks disappear, and Vivado does not report this as an error.

        **Differential pairs.** A pair is a single signal: the clock and the delays are specified on the P-side ports, and Vivado associates the N-side ports automatically.

        **Common mistakes.**
        - Edge-aligned formulas (-max 0.6, -min −0.6): setup becomes optimistic by 0.8 ns, and hold becomes 1.2 ns stricter.
        - The SDR formula (-max = T − 0.6 = 3.4 ns): the "rise → fall" check gets a negative slack, a false setup violation.
        - No -clock_fall pair, or no -add_delay: the data of one of the phases is not analyzed.

        **Check in Vivado:** \`report_timing -rise_from [get_ports {adc_d_p[*]}] -delay_type min_max\` and the same with \`-fall_from\`; \`check_timing\` reports no *partial_input_delay*.
      `,
      refs: 'UG903, chapter "Constraining I/O Delay", Source Synchronous, Center Aligned, DDR template',
    },

    // -------------------------------------------------------------------------
    'ssin.rgmii_id': {
      title: 'RGMII receive: PHY with internal delay',
      langNote: 'The DDR template (`-clock_fall`, `-add_delay`) is the same in XDC and SDC; IDDR is an FPGA primitive.',
      text: `
        An Ethernet physical layer device (PHY) sends received data to the FPGA over an RGMII interface: the **125 MHz** clock \`rgmii_rxc\`, plus the data \`rgmii_rxd[3:0]\` and the control signal \`rgmii_rx_ctl\` at double data rate (the rising edge carries the low nibble of the byte and RX_DV, the falling edge the high nibble and RX_ER ⊕ RX_DV).

        The PHY has its **internal clock delay** enabled (RGMII-ID mode), so the data arrives center-aligned: according to the PHY data sheet, the data at the FPGA pins is valid for at least **1.2 ns before and 1.2 ns after** each rising and falling edge of RXC.

        In the FPGA, the clock passes through IBUF and BUFG, and the data is captured by IDDR flip-flops.

        **Task.** Define the \`rgmii_rxc\` clock and the input delays for \`rgmii_rxd[3:0]\` and \`rgmii_rx_ctl\`.
      `,
      strings: {
        'режим\nRGMII-ID': 'RGMII-ID\nmode',
        'фронт: запуск': 'rise: launch',
        'спад: захват [7:4]': 'fall: capture [7:4]',
        'фронт': 'rise',
        'предустановка: T/2 = 4 нс': 'setup: T/2 = 4 ns',
        '-max = T/2 − 1,2 = 2,8 нс': '-max = T/2 − 1.2 = 2.8 ns',
        '-min = 1,2 нс': '-min = 1.2 ns',
        '1,2': '1.2',
      },
      figures: [
        {
          title: 'RGMII-ID: RXC edges in the middle of the data window',
          caption: 'The PHY internal delay shifts RXC by about a quarter of a period, so each rising and falling edge falls in the middle of a data window at least 2.4 ns wide. The delays relative to the rising edge describe the [3:0] → [7:4] transition, which the falling edge captures; those relative to the falling edge describe the [7:4] → [3:0] transition, which the next rising edge captures.',
        },
      ],
      hints: [
        'This is center-aligned DDR: the same calculation as for the ADC with the LVDS DDR output, only with T = 8 ns.',
        '-max = T/2 − 1.2 = 2.8 ns, -min = 1.2 ns, relative to the rising edge and (with -clock_fall -add_delay) relative to the falling edge. Do not forget `rgmii_rx_ctl`.',
      ],
      explain: `
        \`\`\`
        create_clock -name rgmii_rxc -period 8.000 [get_ports rgmii_rxc]
        set_input_delay -clock rgmii_rxc -max 2.800 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
        set_input_delay -clock rgmii_rxc -min 1.200 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
        set_input_delay -clock rgmii_rxc -clock_fall -max 2.800 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
        set_input_delay -clock rgmii_rxc -clock_fall -min 1.200 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
        \`\`\`
        **Calculation** (UG903 template for center-aligned DDR, T = 8 ns, all four windows 1.2 ns):
        - -max = T/2 − 1.2 = 4 − 1.2 = **2.8 ns**: the data that changes after the rising edge must settle 1.2 ns before the falling edge;
        - -min = **1.2 ns**: the data captured by the rising edge holds for 1.2 ns after it.

        The same applies relative to the falling edge (\`-clock_fall -add_delay\`).

        **What the analysis checks.** Setup "rise → fall" and "fall → rise": the requirement is 4 ns, and the slack, before the delays inside the FPGA are taken into account, is 4 − 2.8 = 1.2 ns. Hold "rise → rise" and "fall → fall": the requirement is 0 ns, slack 1.2 ns. The PHY internal delay has already placed the RXC edges in the middle of the window, so the FPGA captures the data directly, without an MMCM phase shift.

        **Common mistakes.**
        - The SDR formula (-max = T − 1.2 = 6.8 ns): for capture on the falling edge, it means the data settles only after the falling edge, a false setup violation.
        - Delays relative to the rising edge only: the data launched on the falling edge (the high nibbles) stays unconstrained.
        - Forgetting \`rgmii_rx_ctl\`: the RX_DV/RX_ER signal is transferred the same way as the data, and without delays frame reception may fail even though the report is clean.
        - No \`-add_delay\` in the second pair: the delays relative to the rising edge are erased.

        **Check in Vivado:** \`report_timing -from [get_ports {rgmii_rxd[*] rgmii_rx_ctl}] -delay_type min_max -max_paths 20\`; \`check_timing\` reports neither *no_input_delay* nor *partial_input_delay*.
      `,
      refs: 'UG903, Source Synchronous, Center Aligned, DDR template; RGMII v2.0 specification (internal delay mode)',
    },

    // -------------------------------------------------------------------------
    'ssin.rgmii_noid': {
      title: 'RGMII receive without internal delay: 90° MMCM shift',
      langNote: 'The input delays are the same in XDC and SDC. Vivado derives the 90°-shifted MMCM clock automatically; in an ASIC, the shifted PLL output would have to be defined with `create_generated_clock`.',
      tags: ['set_input_delay', 'DDR', 'RGMII', 'MMCM', 'negative delay'],
      text: `
        The same PHY, but with the internal clock delay **disabled**: the data \`rgmii_rxd[3:0]\` and \`rgmii_rx_ctl\` arrives **edge-aligned** to RXC. According to the PHY data sheet, the data at the FPGA pins changes within **±0.5 ns** of each rising and falling edge of \`rgmii_rxc\` (125 MHz).

        To capture the data in the middle of the valid interval, the clock inside the FPGA passes through an MMCM, which shifts it by **+90°** (2 ns), and a BUFG buffer; the data is captured by IDDR flip-flops. Vivado derives the clock at the MMCM output automatically, under the name \`rx_clk90\`.

        **Task.** Define the \`rgmii_rxc\` clock and the input delays for \`rgmii_rxd[3:0]\` and \`rgmii_rx_ctl\`.
      `,
      strings: {
        'без\nзадержки': 'no\ndelay',
        'rgmii_rxc (вывод)': 'rgmii_rxc (pin)',
        'rx_clk90 (захват)': 'rx_clk90 (capture)',
        'запуск ↑': 'launch ↑',
        'захват ↑': 'capture ↑',
        'запуск ↓': 'launch ↓',
        'захват ↓': 'capture ↓',
        '-max = +0,5': '-max = +0.5',
        '-min = −0,5': '-min = −0.5',
        'предустановка 2 нс': 'setup 2 ns',
        'удержание −2 нс (спад → фронт)': 'hold −2 ns (fall → rise)',
      },
      figures: [
        {
          title: 'Edge-aligned data, capture with the 90°-shifted clock',
          caption: 'The data launched by the rgmii_rxc rising edge (0) is captured by the rx_clk90 rising edge (2 ns): a setup requirement of 2 ns. The data launched by the next falling edge (4 ns) must not corrupt this capture: a "fall → rise" hold check with a requirement of 2 − 4 = −2 ns. The slack is 1.5 ns on each side.',
        },
      ],
      hints: [
        'You do not need to define the MMCM clock: Vivado derives it automatically, including the 90° shift. Define only the input clock on the port.',
        'The delays are specified relative to `rgmii_rxc`, the clock with which the PHY launches the data. The data is edge-aligned: -max = +0.5, -min = −0.5, relative to the rising edge and (with -clock_fall -add_delay) relative to the falling edge.',
      ],
      explain: `
        \`\`\`
        create_clock -name rgmii_rxc -period 8.000 [get_ports rgmii_rxc]
        set_input_delay -clock rgmii_rxc -max 0.500 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
        set_input_delay -clock rgmii_rxc -min -0.500 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
        set_input_delay -clock rgmii_rxc -clock_fall -max 0.500 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
        set_input_delay -clock rgmii_rxc -clock_fall -min -0.500 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
        \`\`\`
        **Clocks.** Defining the input clock on the port is enough. From the MMCM settings (multiply 8, divide 8, phase 90°) Vivado derives \`rx_clk90\`: period 8 ns, waveform {2 6}, that is, a rising edge 2 ns after the \`rgmii_rxc\` rising edge. The input delays are specified relative to \`rgmii_rxc\`: it is with its edges that the PHY launches the data.

        **Delays** (UG903 template for edge-aligned DDR): the data changes from 0.5 ns before the edge to 0.5 ns after it, so -max = **+0.5 ns** and -min = **−0.5 ns**, for both the rising and the falling edge.

        **The resulting checks:**

        | Launch (rgmii_rxc) → capture (rx_clk90) | Setup | Hold |
        |---|---|---|
        | rise 0 → rise 2 | **2 ns**, slack 2 − 0.5 = 1.5 ns | −6 ns |
        | rise 0 → fall 6 | 6 ns | **−2 ns**, slack 1.5 ns |
        | fall 4 → rise 10 | 6 ns | **−2 ns**, slack 1.5 ns |
        | fall 4 → fall 6 | **2 ns**, slack 1.5 ns | −6 ns |

        The critical checks are setup between edges of the same kind (2 ns, exactly the 90° shift) and hold between opposite edges (−2 ns): the data launched by the falling edge at 4 ns changes no earlier than 3.5 ns, and the \`rx_clk90\` rising edge at 2 ns must capture the previous data before that. The 90° shift places the capture point in the middle of the data window: 1.5 ns of slack on each side before the delays inside the FPGA are taken into account.

        **Common mistakes.**
        - No -clock_fall pair: the data launched on the falling edge is not analyzed.
        - \`create_clock\` at the MMCM output: it creates an independent primary clock, the relationship with \`rgmii_rxc\` is lost, and the paths from the ports to the IDDRs become clock domain crossings without a common source.
        - Delays relative to \`rx_clk90\`: the reference point shifts by 2 ns, and the analysis becomes meaningless (setup becomes 8 ns instead of 2).
        - Center-aligned formulas (-max = T/2 − …): they assume that the data settles well before the falling edge, so the requirements become fictitious.

        **Check in Vivado:** \`report_clocks\` shows \`rx_clk90\` with the waveform {2.000 6.000}; \`report_timing -from [get_ports {rgmii_rxd[*]}] -delay_type min_max\` shows a setup requirement of 2.000 ns (*rx_clk90 rise@2.000ns − rgmii_rxc rise@0.000ns*) and a hold requirement of −2.000 ns.
      `,
      refs: 'UG903, Source Synchronous, Edge Aligned, DDR template (with MMCM/PLL); UG472, MMCM phase shift',
    },

    // -------------------------------------------------------------------------
    'ssin.fix_ddr': {
      title: 'Find the errors: LVDS DDR constraints',
      langNote: 'Mistakes with the sign of `-min` and a forgotten `-add_delay` are equally possible in XDC and SDC.',
      tags: ['set_input_delay', 'DDR', '-add_delay', 'troubleshooting'],
      text: `
        For the LVDS DDR ADC from the task [[q:ssin.ddr_center|"ADC with an LVDS DDR output"]], a colleague wrote constraints; they are already in the editor. The parameters are the same: DCO at 250 MHz, data valid at least 0.6 ns before and 0.6 ns after each rising and falling edge.

        After implementation, Vivado reports hold violations on the \`adc_d_p[*]\` inputs, and \`check_timing\` reports partially specified input delays (*partial_input_delay*).

        **Task.** Find and fix the errors in the constraints.
      `,
      strings: {
        'АЦП LVDS': 'LVDS ADC',
        'обработка': 'processing',
        'adc_dco (ПЛИС)': 'adc_dco (FPGA)',
        'adc_d (ПЛИС)': 'adc_d (FPGA)',
        'фронт': 'rise',
        'спад': 'fall',
        '-max = 1,4 (фронт)': '-max = 1.4 (rise)',
        '-min = 0,6 (фронт)': '-min = 0.6 (rise)',
        '-max = 1,4 (спад)': '-max = 1.4 (fall)',
        '-min = 0,6 (спад)': '-min = 0.6 (fall)',
      },
      figures: [
        {
          title: 'Correct model: DDR data valid windows',
          caption: 'R is data captured on the rising edge, F on the falling edge; each is valid 0.6 ns before and after its own edge (dv_bre, dv_are, dv_bfe, dv_afe). The delay relative to the rising edge describes the R0 → F0 transition: the earliest change is dv_are after the rising edge (-min = 0.6 ns), the latest is dv_bfe before the falling edge (-max = T/2 − dv_bfe = 1.4 ns). Relative to the falling edge, everything is symmetrical.',
        },
      ],
      hints: [
        'Check the signs: the data is center-aligned and the valid window surrounds the edge, so the earliest change after the edge is positive.',
        'A command without -add_delay replaces an existing delay of the same kind (-max or -min) on the port, even if it was specified relative to a different edge. Which delay disappeared after line 4?',
        'Fixes: in line 3, -min 0.600 instead of -0.600; in line 4, add -add_delay.',
      ],
      explain: `
        \`\`\`
        create_clock -name adc_dco -period 4.000 [get_ports adc_dco_p]
        set_input_delay -clock adc_dco -max 1.400 [get_ports {adc_d_p[*]}]
        set_input_delay -clock adc_dco -min 0.600 [get_ports {adc_d_p[*]}]
        set_input_delay -clock adc_dco -clock_fall -max 1.400 -add_delay [get_ports {adc_d_p[*]}]
        set_input_delay -clock adc_dco -clock_fall -min 0.600 -add_delay [get_ports {adc_d_p[*]}]
        \`\`\`
        **Error 1: the sign of -min relative to the rising edge.** For center alignment, -min = dv_are = +0.6 ns: the data captured by the rising edge holds for 0.6 ns after it. The value −0.6 describes an edge-aligned interface and makes the hold check 1.2 ns stricter than reality, hence the hold violations. Vivado would try to "fix" them with routing delays, degrading setup.

        **Error 2: no -add_delay in line 4.** The -clock_fall -max command without -add_delay replaced the -max delay specified in line 2 relative to the rising edge. The ports are left with only -min relative to the rising edge (hence *partial_input_delay*), and the setup check for data launched on the rising edge and captured on the falling edge is not performed at all: the tightest check of the interface disappeared without any error message. Line 5 has -add_delay, so -min relative to the rising edge survived.

        **Rule:** if a port has more than one delay (rising and falling edge, several clocks), every command after the first one of the same kind (-max or -min) is written with -add_delay. It is safer to put -add_delay on all -clock_fall commands.

        **Check in Vivado:** \`report_timing -rise_from [get_ports {adc_d_p[*]}] -delay_type min_max\` must show the "rise → fall" setup check with a 2 ns requirement; \`check_timing\` must not report *partial_input_delay*.
      `,
      refs: 'UG903, section on set_input_delay and the -add_delay option',
    },
  },
});
