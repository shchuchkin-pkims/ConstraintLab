/* English translation of bank/05_ssout.js (module 5: source-synchronous outputs) */
XT.bank.i18n('en', {
  modules: {
    ssout: {
      title: '5. Source-synchronous outputs',
      about: 'Forwarding the clock to the receiver through an ODDR, a generated clock on the output port, set_output_delay relative to the forwarded clock, center alignment, RGMII',
    },
  },
  questions: {
    'ssout.sdr_fwd': {
      title: 'DAC clocked by the FPGA',
      langNote: '`create_generated_clock` on an output port and `set_output_delay` are the same in XDC and SDC; in an ASIC this is how, for example, an SPI clock or an external memory clock driven by the chip is constrained. ODDR is an FPGA primitive.',
      text: `
        A parallel DAC with a CMOS input runs at **100 MHz**. The FPGA drives 14-bit samples \`dac_d[13:0]\` to it from the \`dac_d_reg\` registers and **generates the DAC clock \`dac_clk\` itself**: \`sys_clk\` drives the ODDR \`dac_clk_oddr\` with constant inputs D1 = 1 and D2 = 0, so the Q output replicates the \`sys_clk\` waveform. The data and the clock are launched by the same \`sys_clk\` rising edge and pass through similar circuits (a register or an ODDR, then an OBUF).

        From the DAC data sheet (relative to the rising edge at its CLK pin):

        | Parameter | Value |
        |---|---|
        | setup time t_su | 1.5 ns |
        | hold time t_h | 0.8 ns |

        The clock and data traces on the board are length-matched, so their delays cancel out. The \`sys_clk\` clock (10 ns) is already defined.

        **Task.** Define the clock that the FPGA forwards to the DAC, and the output delays of \`dac_d[13:0]\` for the setup and hold checks.
      `,
      strings: {
        'формирователь': 'generator',
        'ЦАП 14 бит': '14-bit DAC',
        'dac_clk на ЦАП': 'dac_clk at DAC',
        'dac_d на ЦАП': 'dac_d at DAC',
        'требование к предустановке 10 нс': 'setup requirement 10 ns',
        't_su = 1,5 нс → -max 1.5': 't_su = 1.5 ns → -max 1.5',
        't_h = 0,8 нс → -min -0.8': 't_h = 0.8 ns → -min -0.8',
        'sys_clk в ПЛИС': 'sys_clk in FPGA',
        'dac_clk на порту': 'dac_clk at port',
        'dac_d на порту': 'dac_d at port',
        'запуск (sys_clk)': 'launch (sys_clk)',
        'захват (dac_clk)': 'capture (dac_clk)',
        'путь тактового сигнала': 'clock path',
        'путь данных': 'data path',
      },
      figures: [
        {
          title: 'DAC requirements',
          caption: 'Data launched by the rising edge at time 0 is captured by the next dac_clk rising edge: it must settle t_su before that edge (green window) and stay stable for t_h after it (purple window). With identical paths, the data changes almost simultaneously with the dac_clk rising edge, so the hold window overlaps the data transition. The constraints must let Vivado detect this.',
        },
        {
          title: 'Path delays in the FPGA',
          caption: 'The delays are not to scale. A single sys_clk rising edge launches both the data and the forwarded clock; at the ports both are shifted by almost the same amount. The generated clock on the dac_clk port includes the delay of its path (BUFG, ODDR, OBUF), so Vivado compares the data with the actual dac_clk edge rather than with the sys_clk edge inside the FPGA.',
        },
      ],
      hints: [
        'Which clock does the DAC see at its CLK pin? It is derived from sys_clk inside the FPGA, so it is a generated clock. Where is it defined? Where the receiver "sees" it.',
        'The generated clock is defined on the output port, and -source points to the ODDR clock pin: `create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]`.',
        'The output delays are relative to dac_clk: -max = t_su = 1.5 ns, -min = −t_h = −0.8 ns (the traces are matched, so there are no corrections).',
      ],
      explain: `
        \`\`\`
        create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]
        set_output_delay -clock [get_clocks dac_clk] -max 1.500 [get_ports {dac_d[*]}]
        set_output_delay -clock [get_clocks dac_clk] -min -0.800 [get_ports {dac_d[*]}]
        \`\`\`
        **The receiver clock.** An ODDR with D1 = 1 and D2 = 0 outputs 1 on the rising edge and 0 on the falling edge of its clock input C, that is, it replicates \`sys_clk\`. This is a generated clock with a division factor of 1 (\`-divide_by 1\`). The definition point is the \`dac_clk\` output port: it is at this point that the signal goes to the DAC. The \`-source\` option points to the pin where the master clock is present, the ODDR clock input. Vivado itself traces the path from \`sys_clk\` through IBUF, BUFG, ODDR and OBUF to the port and includes its delay in the latency of the \`dac_clk\` clock.

        **Output delays.** For a receiver clocked by the forwarded clock:
        - \`-max\` = t_su + (t_data trace, max − t_clk trace, min) = 1.5 + 0 = **1.5 ns**;
        - \`-min\` = −t_h + (t_data trace, min − t_clk trace, max) = −0.8 + 0 = **−0.8 ns**.

        **The resulting requirements.** The data is launched by the \`sys_clk\` rising edge at time 0.
        - Setup: capture on the next \`dac_clk\` rising edge (10 ns), requirement **10 ns**. Budget 10 − 1.5 = **8.5 ns**: the data path delay to the port may exceed the clock path delay to the port by at most 8.5 ns.
        - Hold: data launched at time 10 must not corrupt the capture at time 10, requirement **0**. Budget 0 − (−0.8) = **0.8 ns**: the data path must be longer than the clock path by at least 0.8 ns.

        The key point: both checks involve the **difference** between the data and clock path delays. Identical segments (the clock tree, OBUF) cancel out, just as they do in reality.

        **What the analysis shows.** A data register placed in an I/O block (task [[q:phys.iob|"Registers in I/O blocks (IOB)"]]) and the ODDR have almost the same delay, so the data changes at the DAC pins almost simultaneously with the \`dac_clk\` rising edge. The setup slack is large (about 8.5 ns), and hold fails by about 0.8 ns. The constraints here are correct: they honestly expose a flaw in the circuit itself. How to eliminate it is covered in the task [[q:ssout.inv_fwd|"Clock centered in the data window"]].

        **Common mistakes.**
        - Delays relative to \`sys_clk\`. Vivado assumes that the DAC captures the data on the \`sys_clk\` edge with no delay at all: the clock path through ODDR and OBUF is lost. The setup check becomes pessimistic by the whole delay of that path, and the hold check optimistic: it passes, although in reality the data changes together with the \`dac_clk\` edge. The real hold violation is hidden.
        - \`create_clock\` on the \`dac_clk\` port. This creates an independent primary clock with zero latency at the definition point: the relationship with \`sys_clk\` and the path delay through ODDR and OBUF are lost, and \`report_clock_interaction\` shows the \`sys_clk → dac_clk\` pair as *Timed (unsafe)*.
        - The clock on the \`dac_clk_oddr/Q\` pin instead of the port: the OBUF delay is not included in the clock path, although the data passes through an identical OBUF.
        - No \`-min\`: the hold check is not performed, and \`check_timing\` reports *partial_output_delay*; the very check that reveals the problem of this circuit is missing.

        **Check in Vivado:** \`report_clocks\` shows \`dac_clk\` as a generated clock with the master clock \`sys_clk\`; in \`report_timing -to [get_ports {dac_d[*]}] -delay_type min_max\` the capture clock path section (Destination Clock Path) shows the ODDR and OBUF; \`check_timing\` reports no *partial_output_delay*.
      `,
      refs: 'UG903, "Constraining Forwarded Clocks" (create_generated_clock), "Constraining I/O Delay"; UG949, section on source-synchronous output interfaces',
    },

    // -------------------------------------------------------------------------
    'ssout.inv_fwd': {
      title: 'Clock centered in the data window',
      langNote: 'The `-invert` and `-edges` options are the same in XDC and SDC.',
      text: `
        The analysis in the task [[q:ssout.sdr_fwd|"DAC clocked by the FPGA"]] revealed a flaw in the circuit: the data and the clock pass through almost identical paths, so at the DAC pins the data changes simultaneously with the \`dac_clk\` rising edge, and the 0.8 ns hold time is not met.

        The circuit was changed: the ODDR \`dac_clk_oddr\` now has D1 = 0 and D2 = 1. On the \`sys_clk\` rising edge the Q output goes to 0, and on the falling edge to 1, so the clock is forwarded **inverted**. Its rising edge falls in the middle of the interval in which the data is stable (center alignment). The DAC still captures the data on the **rising edge** of the signal at its CLK pin.

        Everything else is unchanged: 100 MHz (\`sys_clk\` is already defined), t_su = 1.5 ns, t_h = 0.8 ns, length-matched traces.

        **Task.** Define the \`dac_clk\` clock, taking the inversion into account, and the output delays of \`dac_d[13:0]\`.
      `,
      strings: {
        'формирователь': 'generator',
        'ЦАП 14 бит': '14-bit DAC',
        'dac_clk на ЦАП': 'dac_clk at DAC',
        'dac_d на ЦАП': 'dac_d at DAC',
        'запуск N': 'launch N',
        'захват N': 'capture N',
        'запуск N+1': 'launch N+1',
        'предустановка: 5 нс': 'setup: 5 ns',
        'удержание: −5 нс': 'hold: −5 ns',
      },
      figures: [
        {
          title: 'Rising edge in the middle of the data window',
          caption: 'The rising edge of the inverted clock falls in the middle of the interval in which the data is stable. The t_su and t_h windows (green and purple) are about half a period away from the data transitions on both sides.',
        },
      ],
      hints: [
        'Sketch the signal at the ODDR output: on the rising edge of C it outputs D1 (0), on the falling edge D2 (1). Where are the dac_clk rising edges now relative to sys_clk?',
        'The dac_clk rising edges coincide with the sys_clk falling edges: it is an inverted copy. create_generated_clock has the -invert option for this (equivalent: -edges {2 3 4}).',
        'The output delays do not change: the DAC captures the data on the rising edge of its clock, so -clock_fall is not needed.',
      ],
      explain: `
        \`\`\`
        create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 -invert [get_ports dac_clk]
        set_output_delay -clock [get_clocks dac_clk] -max 1.500 [get_ports {dac_d[*]}]
        set_output_delay -clock [get_clocks dac_clk] -min -0.800 [get_ports {dac_d[*]}]
        \`\`\`
        **Clock waveform.** An ODDR with D1 = 0 and D2 = 1 goes to 0 on the \`sys_clk\` rising edge (0, 10, 20 ns) and to 1 on the falling edge (5, 15 ns). The signal at the port is an inverted copy of \`sys_clk\` with the waveform \`{5 10}\`. It is described with the \`-invert\` option. An equivalent form is \`-edges {2 3 4}\`: the master clock edges are numbered from one (1 is the rising edge at 0 ns, 2 the falling edge at 5 ns, 3 the rising edge at 10 ns, 4 the falling edge at 15 ns); the generated clock rises at the 2nd edge, falls at the 3rd, and its period ends at the 4th: waveform \`{5 10}\`, period 10 ns.

        **Output delays** stay the same: the DAC captures the data on the rising edge of the signal at its pin, and \`dac_clk\` now describes the waveform of that signal correctly. The \`-clock_fall\` option is not needed here.

        **Requirements.** The data is launched by the \`sys_clk\` rising edge at time 0.
        - Setup: the nearest \`dac_clk\` rising edge after launch is at 5 ns, requirement **5 ns**, budget 5 − 1.5 = **3.5 ns**.
        - Hold: data launched at time 10 must not corrupt the capture at time 5, requirement **−5 ns**, budget −5 − (−0.8) = **−4.2 ns**.

        | | Without inversion | With inversion |
        |---|---|---|
        | setup requirement | 10 ns | 5 ns |
        | hold requirement | 0 | −5 ns |
        | allowed difference between the data and clock path delays | 0.8 to 8.5 ns | −4.2 to 3.5 ns |

        The width of the allowed range is the same: 10 − 1.5 − 0.8 = 7.7 ns. The inversion only **moves the margin** from setup to hold. The actual difference between the path delays is close to zero (a register in the I/O block and an ODDR, identical OBUFs, matched traces). Without inversion, zero lies outside the range: hold is violated by 0.8 ns. With inversion, zero is almost in the middle: 3.5 ns of slack for setup and 4.2 ns for hold. This is why center alignment is robust against skew between the paths, delay variation over temperature and voltage, and jitter.

        **Common mistakes.**
        - No \`-invert\`. The described waveform \`{0 5}\` does not match the real signal: Vivado checks setup with a 10 ns requirement instead of 5 ns (optimistic by 5 ns) and reports a nonexistent hold violation.
        - No \`-invert\`, but the output delays are specified with \`-clock_fall\`. The numbers match the reference solution, but the description contradicts reality: the falling edge of the "described" clock sits where the pin has a rising edge. The two errors cancel each other out, and any other constraint or report that uses \`dac_clk\` will be wrong.
        - \`-invert\` together with \`-clock_fall\`: the double inversion moves the capture back to the \`sys_clk\` rising edge, again with requirements of 10 ns and 0.

        **Check in Vivado:** \`report_clocks\` shows the \`dac_clk\` waveform \`{5.000 10.000}\`; in \`report_timing -to [get_ports {dac_d[0]}]\` the \`dac_clk\` capture edge is at 5 ns.
      `,
      refs: 'UG903, "Constraining Forwarded Clocks", create_generated_clock -invert and -edges; UG949, centering the clock in the data window',
    },

    // -------------------------------------------------------------------------
    'ssout.rgmii_tx': {
      title: 'RGMII transmitter with a 90° clock shift',
      langNote: 'Vivado derives the MMCM clocks automatically; in an ASIC, the PLL outputs would have to be defined with `create_generated_clock`.',
      text: `
        The FPGA sends data to an Ethernet physical layer device (PHY) over an **RGMII** interface: four bits \`rgmii_txd[3:0]\` and the control signal \`rgmii_tx_ctl\` are transferred at double data rate, **on both the rising and the falling edge** of the **125 MHz** clock \`rgmii_txc\` (the rising edge carries the low nibble of the byte, the falling edge the high nibble).

        A 125 MHz clock arrives at the \`gtx_clk\` input (already defined, 8 ns). The MMCM \`u_clk/mmcm_inst\` (multiply 8, divide 1, VCO frequency 1000 MHz) generates two 125 MHz clocks: **clk125** (CLKOUT0, phase 0°) and **clk125_90** (CLKOUT1, phase 90°, that is, a 2 ns shift). Vivado derives them automatically under these names.

        - The data and \`rgmii_tx_ctl\` are driven through ODDRs clocked by **clk125**: the data changes on the rising and falling edges of clk125.
        - The \`rgmii_txc\` clock is generated by the ODDR \`txc_oddr\` (D1 = 1, D2 = 0), clocked by **clk125_90**. As a result, the TXC rising and falling edges are placed in the middle of each bit.

        The PHY is configured **without an internal clock delay** and requires the following relative to **each rising and each falling edge** of the signal at its TXC pin:

        | Parameter | Value |
        |---|---|
        | setup time t_su | 1.0 ns |
        | hold time t_h | 0.8 ns |

        The TXC and data traces are length-matched.

        **Task.** Define the \`rgmii_txc\` clock that the FPGA forwards to the PHY, and the output delays of \`rgmii_txd[3:0]\` and \`rgmii_tx_ctl\` relative to the rising and falling edges of \`rgmii_txc\`. If you know which of the resulting checks are non-critical, you may exclude them from the analysis: that variant is accepted too.
      `,
      strings: {
        'VCO 1000 МГц': 'VCO 1000 MHz',
        'запуск ↑': 'launch ↑',
        'запуск ↓': 'launch ↓',
        'удержание ↑→↑ (нестрогая)': 'hold ↑→↑ (non-critical)',
        'удержание ↑→↓': 'hold ↑→↓',
        'предустановка ↑→↑': 'setup ↑→↑',
        'предустановка ↑→↓ (нестрогая)': 'setup ↑→↓ (non-critical)',
        '2 нс': '2 ns',
        '6 нс': '6 ns',
        '−2 нс': '−2 ns',
        '−6 нс': '−6 ns',
        '90° = 2 нс': '90° = 2 ns',
        't_su 1,0': 't_su 1.0',
        't_h 0,8': 't_h 0.8',
      },
      figures: [
        {
          title: 'Center alignment',
          caption: 'The data changes on the rising and falling edges of clk125, while the rgmii_txc edges are shifted by 90° (2 ns), to the middle of each bit. The PHY requires t_su = 1.0 ns and t_h = 0.8 ns relative to each rising and each falling edge of TXC (green and purple windows).',
        },
        {
          title: 'Critical and non-critical checks',
          caption: 'Checks for data launched by the clk125 rising edge at time 0 (the ↑ and ↓ arrows denote rising and falling edges). Critical: setup to the nearest TXC rising edge, 2 ns (green), and hold relative to the previous TXC falling edge, on which the PHY captures the previous nibble, −2 ns (purple). The non-critical checks (6 ns and −6 ns, black) are met automatically when the critical ones are met. For data launched by the clk125 falling edge, the picture is the same, shifted by 4 ns.',
        },
      ],
      hints: [
        'The signal at the rgmii_txc pin is a copy of clk125_90 (ODDR with D1 = 1, D2 = 0). It is a generated clock on the output port; -source is the clock pin of txc_oddr.',
        'The PHY captures the data on both the rising and the falling edge of TXC: you need four set_output_delay commands, -max and -min relative to the rising edge and the same with -clock_fall. The falling-edge commands are written with -add_delay; otherwise they overwrite the delays relative to the rising edge.',
        '-max = t_su = 1.0 ns, -min = −t_h = −0.8 ns. The 90° shift is already part of the clk125_90 waveform (rising edge at 2 ns) and carries over to rgmii_txc through -source; you do not need to account for it manually.',
      ],
      explain: `
        \`\`\`
        create_generated_clock -name rgmii_txc -source [get_pins txc_oddr/C] -divide_by 1 [get_ports rgmii_txc]
        set_output_delay -clock [get_clocks rgmii_txc] -max 1.000 [get_ports {rgmii_txd[*] rgmii_tx_ctl}]
        set_output_delay -clock [get_clocks rgmii_txc] -min -0.800 [get_ports {rgmii_txd[*] rgmii_tx_ctl}]
        set_output_delay -clock [get_clocks rgmii_txc] -clock_fall -max 1.000 -add_delay [get_ports {rgmii_txd[*] rgmii_tx_ctl}]
        set_output_delay -clock [get_clocks rgmii_txc] -clock_fall -min -0.800 -add_delay [get_ports {rgmii_txd[*] rgmii_tx_ctl}]
        \`\`\`
        **Clock.** \`txc_oddr\` with D1 = 1 and D2 = 0 replicates its clock clk125_90, so \`rgmii_txc\` is a generated clock with \`-divide_by 1\` on the output port. Through \`-source [get_pins txc_oddr/C]\` it inherits the clk125_90 waveform: rising edge at 2 ns, falling edge at 6 ns. The MMCM creates the 90° shift; the constraints merely describe it correctly.

        **Output delays.** The PHY captures the data on both the rising and the falling edge of TXC, so each port has two pairs of values: relative to the rising edge and relative to the falling edge (\`-clock_fall\`). The second pair is written with \`-add_delay\`. The values are the same: \`-max\` = t_su = 1.0 ns, \`-min\` = −t_h = −0.8 ns (matched traces).

        **Checks.** The data is launched by the rising edge (time 0) and the falling edge (4 ns) of clk125 and captured by the rising edge (2 ns) and the falling edge (6 ns) of \`rgmii_txc\`. Each port gets four combinations:

        | Launch → capture | Setup | Hold |
        |---|---|---|
        | clk125 rise → TXC rise | **2 ns**, budget 2 − 1.0 = 1.0 ns | −6 ns (non-critical) |
        | clk125 fall → TXC fall | **2 ns**, budget 1.0 ns | −6 ns (non-critical) |
        | clk125 rise → TXC fall | 6 ns (non-critical) | **−2 ns**, budget −2 − (−0.8) = −1.2 ns |
        | clk125 fall → TXC rise | 6 ns (non-critical) | **−2 ns**, budget −1.2 ns |

        Critical checks: the nibble launched by the clk125 rising edge is captured by the nearest TXC rising edge 2 ns later (setup), and the next nibble, launched by the clk125 falling edge at 4 ns, must not corrupt it earlier than t_h after that edge (hold −2 ns). The difference between the data and clock path delays must lie between −1.2 and +1.0 ns. With matched traces and identical ODDRs and OBUFs it is close to zero, which leaves about 1 ns of margin on each side.

        **Non-critical checks** (6 ns and −6 ns) are created by Vivado automatically for all combinations of rising and falling edges. They are never the worst case: if the critical checks pass, these pass too. Excluding them is therefore optional. If you want clean reports, exclude all four at once (both variants are accepted):
        \`\`\`
        set_false_path -setup -rise_from [get_clocks clk125] -fall_to [get_clocks rgmii_txc]
        set_false_path -setup -fall_from [get_clocks clk125] -rise_to [get_clocks rgmii_txc]
        set_false_path -hold -rise_from [get_clocks clk125] -rise_to [get_clocks rgmii_txc]
        set_false_path -hold -fall_from [get_clocks clk125] -fall_to [get_clocks rgmii_txc]
        \`\`\`
        Exclude exactly these four checks: a false path on a critical check (for example, \`-setup -rise_from … -rise_to …\`) disables the real analysis.

        **Common mistakes.**
        - Delays relative to the rising edge only: the nibbles that the PHY captures on the TXC falling edge are not checked.
        - Falling-edge commands without \`-add_delay\`: they overwrite the delays relative to the rising edge, and only half of the data is checked.
        - Delays relative to \`clk125\` instead of \`rgmii_txc\`: both the 90° shift and the clock path delay through ODDR and OBUF are lost.
        - \`-source\` on the clock pin of a data ODDR (clk125): the waveform is \`{0 4}\` instead of \`{2 6}\`; the 90° shift is not taken into account, and the setup and hold requirements shift by 2 ns.
        - The 90° shift is "added" in the constraints as well (\`-edges {1 2 3} -edge_shift {2 2 2}\`): the MMCM has already shifted clk125_90, and the described waveform \`{4 8}\` does not match the signal at the pin.

        **Check in Vivado:** \`report_clocks\` shows \`rgmii_txc\` with the waveform \`{2.000 6.000}\` and the master clock clk125_90; \`report_timing -to [get_ports {rgmii_txd[0]}] -delay_type min_max\`; if you excluded the non-critical checks, run \`report_exceptions\` to make sure that all four commands are in effect.
      `,
      refs: 'UG903, "Constraining Forwarded Clocks", set_output_delay -clock_fall -add_delay; RGMII v2.0 specification',
    },

    // -------------------------------------------------------------------------
    'ssout.why_fwd': {
      title: 'Why use the clock on the output port as the reference?',
      langNote: 'The rule "define the clock where it leaves the chip" is the same for FPGAs and ASICs.',
      tags: ['create_generated_clock', 'set_output_delay', 'understanding'],
      text: `
        Consider again the circuit from the task [[q:ssout.sdr_fwd|"DAC clocked by the FPGA"]]: the FPGA drives the data \`dac_d[13:0]\` and the clock \`dac_clk\`, generated by an ODDR from \`sys_clk\`, to the DAC.

        Why are the output delays of \`dac_d\` specified relative to the **generated clock on the output port** \`dac_clk\` rather than relative to the internal clock \`sys_clk\`?
      `,
      strings: {
        'формирователь': 'generator',
        'ЦАП 14 бит': '14-bit DAC',
      },
      options: [
        {
          text: 'It is not necessary: the ODDR and OBUF delays are small, and with `sys_clk` as the reference the result is practically the same.',
          why: 'Incorrect. The clock tree together with the ODDR and the LVCMOS output buffer adds a delay of several nanoseconds, comparable to the period. With sys_clk as the reference, the setup check becomes pessimistic by that amount and the hold check optimistic: a real hold violation would be hidden.',
        },
        {
          text: '`create_clock -period 10` on the `dac_clk` port is enough: Vivado will figure out by itself that this clock is derived from `sys_clk`.',
          why: 'Incorrect. create_clock creates an independent primary clock with zero latency at the definition point. The relationship with sys_clk and the path delay through ODDR and OBUF are lost, and report_clock_interaction shows the sys_clk → dac_clk pair as Timed (unsafe).',
        },
        {
          text: 'Only this way does the clock path delay from `sys_clk` through BUFG, ODDR and OBUF to the port enter the analysis: Vivado compares the data with the edge that actually arrives at the DAC, and identical segments of the data and clock paths cancel out.',
          why: 'Correct. The generated clock on the port inherits the sys_clk waveform and gets the delay of its own path. The checks involve the difference between the data and clock path delays, just as in the real circuit.',
        },
        {
          text: 'The generated clock is needed only to have the convenient name `dac_clk` in the reports.',
          why: 'Incorrect. The name is secondary. What matters is the definition point (the output port) and the relationship with the master clock: the setup and hold requirements depend on them.',
        },
        {
          text: 'The reference should be a virtual clock with a 10 ns period, since the DAC is an external device.',
          why: 'Incorrect. A virtual clock does not pass through the FPGA and has no delay inside it; it is used when the receiver clock is not generated by the FPGA. Here the FPGA itself drives the DAC clock, and the delay of its path must be taken into account.',
        },
      ],
      explain: `
        \`\`\`
        create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]
        set_output_delay -clock [get_clocks dac_clk] -max 1.500 [get_ports {dac_d[*]}]
        set_output_delay -clock [get_clocks dac_clk] -min -0.800 [get_ports {dac_d[*]}]
        \`\`\`
        In a source-synchronous interface, the receiver is clocked by a signal that the FPGA itself drives. The data and the clock are launched by the same edge and pass through similar circuits, so only the **difference** between the delays of these paths matters to the receiver. That is exactly what Vivado checks when the output delays reference a generated clock defined on the output port: the clock path (BUFG, ODDR, OBUF) enters the analysis just as the data path does.

        A short rule: *define the clock where it leaves the FPGA* – \`create_generated_clock\` on the output port, \`-source\` on the ODDR clock pin, and all \`set_output_delay\` commands of the interface relative to this clock.
      `,
    },
  },
});
