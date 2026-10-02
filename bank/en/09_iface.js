/* English translation of bank/09_iface.js (module 9: complete interfaces and debugging) */

// Shared by iface.spi_out and iface.spi_in (SPI_DESIGN and SPI_WAVE in bank/09_iface.js)
const IFACE_EN_SPI_STRINGS = {
  'счётчик': 'counter',
  'бит n': 'bit n',
  'бит n+1': 'bit n+1',
  'бит n−1': 'bit n−1',
  'бит k': 'bit k',
  'бит k+1': 'bit k+1',
  'бит k−1': 'bit k−1',
  'спад: MOSI': 'fall: MOSI',
  'фронт: захват': 'rise: capture',
  '20 нс до захвата': '20 ns to capture',
  'до 9,6 нс': 'up to 9.6 ns',
};
const IFACE_EN_SPI_FIGURE = {
  title: 'SPI mode 0: SCLK = sys_clk / 4',
  caption: 'MOSI changes on the falling edge of SCLK and is captured by the slave on the next rising edge; the slave drives MISO on the falling edge, and the FPGA captures it in the sys_clk cycle that coincides with the next rising edge of SCLK.',
};

XT.bank.i18n('en', {
  modules: {
    iface: {
      title: '9. Complete interfaces and debugging',
      about: 'SPI with a clock from a divider, SDR SDRAM, finding errors in XDC, reading check_timing',
    },
  },
  questions: {
    'iface.spi_out': {
      title: 'SPI: divider-generated clock and the MOSI output',
      langNote: 'A generated clock on a port, output delays and multicycle paths are the same in XDC and SDC.',
      text: `
        The SPI master in the FPGA generates \`spi_sclk\` = 25 MHz from \`sys_clk\` = 100 MHz: the \`sclk_reg\` register toggles every two cycles (division by 4) and drives the port through an \`OBUF\`. Mode 0: the slave captures MOSI on the **rising edge** of SCLK, and the \`mosi_reg\` register (clocked by \`sys_clk\`) updates MOSI in the cycle that produces the **falling edge** of SCLK, two \`sys_clk\` cycles before the rising edge.

        Slave device requirements: setup time on the SI input 4.0 ns, hold time 4.0 ns; the SCLK and MOSI traces are identical.

        Without further information, Vivado assumes that MOSI can change in any \`sys_clk\` cycle and derives a 10 ns setup requirement and a 0 ns hold requirement. The latter would require the \`spi_mosi\` output to have a delay of at least 4 ns, which is a false violation.

        **Task.**
        1. Define the \`spi_sclk\` clock on the output port.
        2. Set the output delays for \`spi_mosi\`.
        3. Tell the timing analysis that MOSI is launched **2** \`sys_clk\` cycles before the capture edge and does **not** change for 4 cycles (until the next falling edge of SCLK).

        The MISO input is covered in the next task; do not constrain it here.
      `,
      strings: IFACE_EN_SPI_STRINGS,
      figures: [IFACE_EN_SPI_FIGURE],
      hints: [
        'SCLK is driven out of the FPGA, so it is defined as a generated clock on the `spi_sclk` port with `-source [get_pins sclk_reg/C]` and `-divide_by 4`.',
        'This is a multicycle path between different clocks, so the launch is moved one cycle earlier in periods of the **launch** clock: `-setup -start`.',
        'After `-setup 2 -start`, the hold check refers to the launch 10 ns after the setup launch. In reality, the next MOSI launch occurs 40 ns later: move the hold check by 3 cycles with `-hold 3 -start`.',
      ],
      explain: `
        \`\`\`
        create_generated_clock -name spi_sclk -source [get_pins sclk_reg/C] -divide_by 4 [get_ports spi_sclk]
        set_output_delay -clock spi_sclk -max 4.000 [get_ports spi_mosi]
        set_output_delay -clock spi_sclk -min -4.000 [get_ports spi_mosi]
        set_multicycle_path 2 -setup -start -from [get_clocks sys_clk] -to [get_clocks spi_sclk]
        set_multicycle_path 3 -hold  -start -from [get_clocks sys_clk] -to [get_clocks spi_sclk]
        \`\`\`
        **The clock.** The generated clock on the \`spi_sclk\` port is related to \`sys_clk\`, and the delay of the \`sclk_reg → OBUF → port\` path is included in the edge time at the FPGA pin, just like the MOSI data delay.

        **Default edge relationship.** \`sys_clk\` rising edges: 0, 10, 20, 30 ns; \`spi_sclk\` rising edge: 40 ns. The closest pair is the launch at 30 ns and the capture at 40 ns: setup 10 ns, hold 0 ns.

        **With the multicycle path.**
        - \`-setup 2 -start\` moves the launch one cycle earlier: 20 ns → 40 ns, a setup requirement of **20 ns**, a budget of 20 − 4 = 16 ns.
        - The hold check then refers to the launch at 30 ns (a 10 ns requirement). In reality, the next MOSI change occurs only at 60 ns, and the previous capture was at 0 ns: the requirement is −20 ns. \`-hold 3 -start\` shifts the hold check by 3 launch clock cycles: 10 − 30 = **−20 ns**.

        The "N and N−1" rule (\`-hold 1\`) would give a 0 ns requirement here and a false hold violation: the MOSI output would have to have a delay of at least 4 ns. A \`set_false_path -hold\` for these paths is also accepted as correct, but \`-hold 3\` describes the circuit behavior more precisely.

        The slave select signal CS_N is constrained the same way as MOSI.
      `,
    },

    // -------------------------------------------------------------------------
    'iface.spi_in': {
      title: 'SPI: MISO input with a round-trip delay',
      langNote: 'Input delays with `-clock_fall` and multicycle paths with `-end` are the same in XDC and SDC.',
      text: `
        This task continues the previous one. The slave device drives MISO on the **falling edge** of SCLK: new data appears 0…8.0 ns after the falling edge at its pin. Trace delays: SCLK to the device 0.5…0.8 ns, MISO back 0.5…0.8 ns.

        The \`miso_reg\` register is clocked by \`sys_clk\` and captures MISO in the cycle that coincides with the next **rising edge** of SCLK, 2 \`sys_clk\` cycles after the falling edge. In the other cycles it does not load data (it has an enable).

        The clock constraints and the MOSI output constraints are already in place.

        **Task.**
        1. Set the MISO input delays relative to the \`spi_sclk\` clock at the FPGA pin.
        2. Define the multicycle path from \`spi_sclk\` to \`sys_clk\`: the capture occurs 2 \`sys_clk\` cycles after the falling edge of SCLK, and the next capture only 4 cycles later.
      `,
      strings: IFACE_EN_SPI_STRINGS,
      figures: [IFACE_EN_SPI_FIGURE],
      hints: [
        'The reference edge is the falling edge of `spi_sclk`: `-clock_fall`. The delay includes the SCLK path to the slave, its clock-to-output time and the MISO path back: max = 0.8 + 8.0 + 0.8.',
        'By default, the capture is the nearest `sys_clk` edge after the falling edge of SCLK (10 ns later). A capture 2 cycles after the falling edge is specified in periods of the **capture** clock: `-setup 2 -end`.',
        'The hold check then refers to the edge 10 ns before the capture. The real previous capture was 40 ns earlier: `-hold 3 -end`.',
      ],
      explain: `
        \`\`\`
        set_input_delay -clock spi_sclk -clock_fall -max 9.600 [get_ports spi_miso]
        set_input_delay -clock spi_sclk -clock_fall -min 1.000 [get_ports spi_miso]
        set_multicycle_path 2 -setup -end -from [get_clocks spi_sclk] -to [get_clocks sys_clk]
        set_multicycle_path 3 -hold  -end -from [get_clocks spi_sclk] -to [get_clocks sys_clk]
        \`\`\`
        **The input delay is a round trip.** It is measured from the falling edge of SCLK at the FPGA pin:
        - max = 0.8 (SCLK to the slave) + 8.0 (MISO clock-to-output) + 0.8 (MISO back) = **9.6 ns**;
        - min = 0.5 + 0 + 0.5 = **1.0 ns**.

        Because \`spi_sclk\` is a generated clock on the output port, Vivado also accounts for the delay of generating SCLK inside the FPGA, so the round trip is complete.

        **Multicycle path.** The falling edge of SCLK is at 20 ns; the nearest \`sys_clk\` edge is at 30 ns, but \`miso_reg\` captures the data at 40 ns:
        - \`-setup 2 -end\`: capture at 40 ns, a requirement of **20 ns**, a budget of 20 − 9.6 = 10.4 ns;
        - the default hold check then uses the 30 ns edge (a 10 ns requirement); the real previous capture is at 0 ns: \`-hold 3 -end\` gives **−20 ns**.

        The \`-end\` option matters here: the clocks are different, and the shift is counted in \`sys_clk\` periods (10 ns), not in \`spi_sclk\` periods (40 ns).
      `,
    },

    // -------------------------------------------------------------------------
    'iface.sdram': {
      title: 'SDR SDRAM at 100 MHz: clock, commands and bidirectional bus',
      langNote: 'ODDR and IOBUF are FPGA primitives; in an ASIC, ordinary flip-flops and I/O cells play their role, and the constraints are the same.',
      text: `
        An SDR SDRAM controller runs on \`sys_clk\` = 100 MHz. The memory clock is driven through an \`ODDR\` to the \`sdram_clk\` pin; the address \`sdram_a[12:0]\` and the data bus \`sdram_dq[15:0]\` (bidirectional, through an \`IOBUF\`) are driven and captured by registers clocked by \`sys_clk\`. The output enable of the data bus is generated by the \`dq_oe_reg\` register.

        Memory parameters (relative to the rising edge of CLK at the memory pin): input setup time tIS = 1.5 ns, input hold time tIH = 0.8 ns; access time tAC = 5.4 ns (the maximum read data output delay), output hold time tOH = 2.7 ns (the minimum).

        Traces: clock to the memory 0.6…0.8 ns; address and data 0.6…0.9 ns.

        **Task.**
        1. Define the memory clock \`sdram_clk\` on the output port.
        2. Set the output delays for \`sdram_a[*]\` and \`sdram_dq[*]\` (write).
        3. Set the input delays for \`sdram_dq[*]\` (read) relative to \`sdram_clk\`.
      `,
      strings: {
        '0,6…0,8 нс': '0.6…0.8 ns',
        '0,6…0,9 нс': '0.6…0.9 ns',
        'sdram_clk (ПЛИС)': 'sdram_clk (FPGA)',
        'CLK (память)': 'CLK (memory)',
        'DQ (память)': 'DQ (memory)',
        'DQ (ПЛИС)': 'DQ (FPGA)',
        'max 7,1': 'max 7.1',
        'min 3,9': 'min 3.9',
      },
      figures: [
        {
          title: 'Read: memory data relative to sdram_clk at the FPGA pin',
          caption: 'At the FPGA pins, the read data changes between 3.9 and 7.1 ns after the sdram_clk edge; the capture is on the next sys_clk edge.',
        },
      ],
      hints: [
        'The memory clock: `create_generated_clock -source [get_pins sdram_clk_oddr/C] -divide_by 1 [get_ports sdram_clk]`.',
        'Output: max = Tdata_max + tIS − Tclk_min = 0.9 + 1.5 − 0.6; min = Tdata_min − tIH − Tclk_max = 0.6 − 0.8 − 0.8.',
        'Input: the CLK edge at the memory occurs Tclk after the edge at the FPGA pin: max = 0.8 + 5.4 + 0.9; min = 0.6 + 2.7 + 0.6. A bidirectional port needs both input and output delays.',
      ],
      explain: `
        \`\`\`
        create_generated_clock -name sdram_clk -source [get_pins sdram_clk_oddr/C] -divide_by 1 [get_ports sdram_clk]
        set_output_delay -clock sdram_clk -max 1.800 [get_ports {sdram_a[*] sdram_dq[*]}]
        set_output_delay -clock sdram_clk -min -1.000 [get_ports {sdram_a[*] sdram_dq[*]}]
        set_input_delay  -clock sdram_clk -max 7.100 [get_ports {sdram_dq[*]}]
        set_input_delay  -clock sdram_clk -min 3.900 [get_ports {sdram_dq[*]}]
        \`\`\`
        **Write (FPGA → memory).** The memory captures data on the CLK edge at its own pin, which lags the edge at the FPGA pin by 0.6…0.8 ns:
        - max = 0.9 + 1.5 − 0.6 = **1.8 ns** (worst case: the data takes longer, the clock arrives earlier);
        - min = 0.6 − 0.8 − 0.8 = **−1.0 ns** (the data is faster, the clock is later).

        **Read (memory → FPGA).** The data is driven on the CLK edge of the memory: from the edge at the FPGA pin to new data at the FPGA pin, it takes Tclk + tAC + Tdq:
        - max = 0.8 + 5.4 + 0.9 = **7.1 ns**; min = 0.6 + 2.7 + 0.6 = **3.9 ns**.

        The capture is on the next \`sys_clk\` edge: a setup requirement of 10 ns, a budget of 2.9 ns.

        **The bidirectional port** gets both kinds of delays: the output delays describe writes (the paths from \`dq_out_reg\` and \`dq_oe_reg\`), and the input delays describe reads (the path to \`dq_in_reg\`).

        **In practice.** In a real FPGA, the clock delay through the ODDR and OBUF (several nanoseconds) adds to the \`sdram_clk\` edge time and eats into the read budget. That is why the memory clock is often phase-shifted with an MMCM; Vivado accounts for such a shift automatically if the clock is defined as a generated clock.
      `,
    },

    // -------------------------------------------------------------------------
    'iface.fix_xdc': {
      title: 'Find the errors in the XDC file',
      langNote: 'The same errors are just as possible in SDC.',
      tags: ['debugging', 'command order', 'syntax'],
      text: `
        A colleague wrote constraints for a simple datapath: input registers \`din_reg\`, combinational processing, output registers \`dout_reg\`; a 100 MHz clock on the \`sys_clk\` port. The author's intent:

        - input delays: max 2.0 ns, min 0.5 ns;
        - output delays: max 1.5 ns, min −0.5 ns;
        - the \`din_reg → dout_reg\` path is a multicycle path: the data is updated once every 2 cycles.

        The file loads in Vivado with critical warnings, and the analysis does not match the intent.

        **Task.** Find and fix all the errors (there are five). The original file is already in the editor.
      `,
      strings: {
        'обработка': 'processing',
      },
      code: {
        starter: `# Constraints for the processing datapath
set_input_delay -clock sys_clk -max 2.0 [get_ports {din[*]}]
create_clock -name sys_clk -period 10.000 [get_ports sysclk]
set_input_delay -clock sys_clk -min 0.5 [get_ports {din[*]}]
set_output_delay -clock sys_clk -max 1.5 [get_ports {dout[*]}] # max
set_output_delay -clock sys_clk -min -0.5 [get_ports {dout[*]}]
set_multicycle_path 2 -setup -from [get_pins {din_reg[*]/Q}] -to [get_cells {dout_reg[*]}]`,
      },
      hints: [
        'Click "Check" with the original text and read the messages: each one points to a line.',
        'The errors: the command order, a port name, an end-of-line comment, the startpoint of the exception, and a missing companion command for the hold check.',
      ],
      explain: `
        1. **Command order.** \`set_input_delay\` refers to the \`sys_clk\` clock before it is created: Vivado issues a critical warning and skips the command. In XDC, clocks are defined first.
        2. **Port name.** \`sysclk\` instead of \`sys_clk\`: \`get_ports\` finds nothing, and the clock is not created.
        3. **End-of-line comment.** In Tcl, \`#\` starts a comment only at the beginning of a command; at the end of a line, \`;#\` is required. Otherwise \`#\` and \`max\` become extra arguments, and the command is not executed.
        4. **Startpoint of the exception.** \`din_reg[*]/Q\` is the register output, not a startpoint. The startpoint is the clock pin \`C\` or the cell itself: \`[get_cells {din_reg[*]}]\`. With the Q pins, the exception covers no paths at all.
        5. **No companion -hold command.** \`set_multicycle_path 2 -setup\` must be followed by \`set_multicycle_path 1 -hold\`; otherwise the hold requirement becomes 10 ns.

        A useful habit: after reading the XDC, run \`check_timing\` and \`report_exceptions\`. The first shows unconstrained ports and registers; the second shows timing exceptions that cover nothing.
      `,
    },

    // -------------------------------------------------------------------------
    'iface.check_timing': {
      title: 'Reading the check_timing report',
      langNote: 'The report in this task comes from Vivado; in PrimeTime, `check_timing` works the same way, but some categories have different names (for example, *unconstrained_endpoints*).',
      tags: ['check_timing', 'debugging'],
      text: `
        After the design constraints were read, \`check_timing\` reported:

        \`\`\`text
        1. no_clock: 16 registers (slow_reg[0..15])
        2. no_input_delay: 12 ports (adc_d[0..11])
        3. partial_input_delay: 1 port (adc_ovr)
        4. multiple_clock: 8 pins (proc_reg[0..7]/C: clk_a, clk_b)
        5. generated_clocks: 1 (clk_div2: the master clock does not reach pin div_reg/C)
        \`\`\`

        The \`slow_reg\` registers are clocked by the output of a flip-flop divider; the \`adc_d\` ADC is a synchronous interface; \`proc_reg\` is clocked through a clock multiplexer.

        Which statements are **true**?
      `,
      options: [
        { text: 'Item 1: the `slow_reg` registers are missing the generated clock; it is defined (item 5) but could not be derived, so `-source` must be fixed.', why: 'Correct: the generated clock could not be derived, so the registers after the divider are left without a clock. Usually, -source points to a pin that the master clock does not propagate to.' },
        { text: 'Item 2 is best resolved with `set_false_path -from [get_ports {adc_d[*]}]`.', why: 'No: the ADC interface is synchronous and must be constrained with input delays (set_input_delay -max/-min). A false path would hide real violations.' },
        { text: 'Item 3: `adc_ovr` has only `-max` or only `-min` defined, so one of the checks (setup or hold) is not performed.', why: 'Correct: partial_input_delay means an incomplete pair of delays.' },
        { text: 'Item 4 is normal and requires action only if `clk_a` and `clk_b` cannot be present at the multiplexer output at the same time: then `set_clock_groups -physically_exclusive` is needed (usually between generated clocks at the multiplexer output).', why: 'Correct: several clocks on a pin after a multiplexer are acceptable, but the paths between them on these registers are physically impossible and must be excluded.' },
        { text: 'All five items are warnings that do not affect the final analysis.', why: 'No: each item means that some paths are either not analyzed at all or analyzed incorrectly.' },
      ],
      explain: `
        \`check_timing\` is the first thing to run after reading the constraints. Each item indicates that some paths are not analyzed or are analyzed incorrectly:
        - *no_clock*: registers without a clock; paths to and from them are not checked;
        - *no_input_delay / no_output_delay*: ports without delays; paths through them are unconstrained;
        - *partial_input_delay / partial_output_delay*: only one bound is specified;
        - *multiple_clock*: several clocks on a pin; normal for multiplexers, but the impossible clock pairs must be excluded;
        - *generated_clocks*: a generated clock could not be derived.

        In ConstraintLab, the same checks are available in the console: \`check_timing\`.
      `,
    },
  },
});
