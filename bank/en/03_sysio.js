/* English translation of bank/03_sysio.js (module 3: system-synchronous I/O) */
XT.bank.i18n('en', {
  modules: {
    sysio: {
      title: '3. System-synchronous I/O',
      about: 'A common oscillator for the FPGA and external devices: input/output delays including clock traces, asynchronous inputs and slow outputs, a combinational path through the FPGA, a virtual clock',
    },
  },
  questions: {
    'sysio.adc_in': {
      title: 'Parallel ADC input with a common oscillator',
      langNote: 'The input delay formulas and commands are the same for an FPGA and an ASIC die: the delays describe the external side.',
      tags: ['set_input_delay', 'system-synchronous interface', 'ADC'],
      text: `
        A parallel 12-bit ADC with CMOS outputs and the FPGA are clocked from a common **50 MHz** oscillator. A fanout buffer on the board distributes the oscillator signal: one of its outputs drives the CLK input of the ADC, the other one drives the \`clk50\` pin of the FPGA. The ADC outputs each new sample on the rising edge of its clock, and the FPGA captures the \`adc_d[11:0]\` bits on the next rising edge into the \`adc_d_reg\` registers placed in the I/O blocks (IOB).

        | Parameter | Min | Max |
        |---|---|---|
        | Tco – ADC delay from the CLK edge to the data output | 2.0 ns | 6.5 ns |
        | Tcd – clock trace from the buffer to the ADC | 0.9 ns | 1.1 ns |
        | Tcf – clock trace from the buffer to the FPGA | 0.6 ns | 0.8 ns |
        | Td – data trace from the ADC to the FPGA | 0.7 ns | 1.0 ns |

        The skew between the fanout buffer outputs is negligible: the buffer delay enters both clocks equally and drops out of the calculation. The clock \`clk50\` is already defined on the input port (the "Already in the project" box).

        **Task.** Specify the input delays for the \`adc_d[11:0]\` bus: the latest time new data appears and the earliest time the data changes, relative to the clock edge **at the FPGA pin**.
      `,
      strings: {
        'АЦП 12 бит': '12-bit ADC',
        'Буфер': 'Buffer',
        '50 МГц': '50 MHz',
        'обработка': 'processing',
        'генератор': 'oscillator',
        'CLK АЦП': 'ADC CLK',
        'D на выходе АЦП': 'D at ADC output',
        'adc_d на ПЛИС': 'adc_d at FPGA',
        'clk50 на ПЛИС': 'clk50 at FPGA',
        'опорный фронт (0)': 'reference edge (0)',
      },
      figures: [
        {
          title: 'The same oscillator edge at different points on the board',
          // the whole list is repeated: labels without Cyrillic cannot be converted (decimal comma) through `strings`
          spans: [
            { row: 1, t0: 0, t1: 1.1, label: 'Tcd ≤ 1.1', cls: 'clk' },
            { row: 2, t0: 1.1, t1: 7.6, label: 'Tco max 6.5', cls: 'data' },
            { row: 3, t0: 7.6, t1: 8.6, label: 'Td ≤ 1.0', cls: 'data' },
            { row: 3, t0: 0.6, t1: 8.6, label: '-max = 8.0 ns', cls: 'setup' },
            { row: 3, t0: 0.8, t1: 3.6, label: '-min = 2.8 ns', cls: 'hold' },
            { row: 4, t0: 0, t1: 0.6, label: 'Tcf ≥ 0.6', cls: 'clk' },
          ],
          caption: 'Hatched areas are uncertainty intervals. New data appears at the FPGA pin 3.6…8.6 ns after the oscillator edge, while the edge itself reaches the FPGA after 0.6…0.8 ns. The input delay is measured from the edge at the FPGA pin: the worst-case combinations give 8.0 ns (-max) and 2.8 ns (-min).',
        },
      ],
      hints: [
        'Time 0 for the input delay is the clock edge at the clock definition point, that is, at the `clk50` pin of the FPGA, not at the oscillator output.',
        'The data travels along "buffer → ADC → data trace", and the reference edge along "buffer → FPGA". The input delay is the difference between these paths. For -max, take the late components of the data path and the early arrival of the clock at the FPGA; for -min, the opposite.',
        '-max = Tcd_max + Tco_max + Td_max − Tcf_min; -min = Tcd_min + Tco_min + Td_min − Tcf_max.',
      ],
      explain: `
        \`\`\`
        set_input_delay -clock clk50 -max 8.000 [get_ports {adc_d[*]}]
        set_input_delay -clock clk50 -min 2.800 [get_ports {adc_d[*]}]
        \`\`\`
        **Reference point.** The clock \`clk50\` is defined on the FPGA port, so the input delays are measured from the edge at the FPGA pin. This edge arrives from the oscillator through Tcf, and the data through Tcd + Tco + Td. The input delay is the difference: \`Tcd + Tco + Td − Tcf\`.

        **Substitution.**
        - -max (setup check): data as late as possible, reference edge as early as possible: 1.1 + 6.5 + 1.0 − 0.6 = **8.0 ns**;
        - -min (hold check): data as early as possible, reference edge as late as possible: 0.9 + 2.0 + 0.7 − 0.8 = **2.8 ns**.

        **What the analysis gets.** Capture happens on the next edge: the setup requirement equals the period, 20 ns. The path inside the FPGA (input buffer, routing to the IOB register, register setup time adjusted for the clock tree delay) gets 20 − 8 = 12 ns. For hold, the data is guaranteed to stay stable for 2.8 ns after the edge at the pin. The clock tree delay (IBUF, BUFG, routing) is subtracted from this margin, because the edge reaches the register later than the pin. Whether the margin is sufficient is shown by the hold check after implementation (in 7 series FPGAs it is helped by the automatic ZHOLD delay at the input of the IOB register).

        **Common mistakes.**
        - Ignoring the clock traces (-max = Tco_max + Td_max = 7.5 ns). Here the clock reaches the ADC later than the FPGA, so the setup analysis becomes optimistic by 0.5 ns: Vivado reports slack that does not exist on the board.
        - Swapping -max and -min: the setup check gets 2.8 ns instead of 8.0, and the hold check 8.0 instead of 2.8. Both checks become unreliable, and a real hold violation is hidden.
        - A single value without -max/-min: it applies to both setup and hold, so the data uncertainty interval (2.8…8.0 ns) collapses to a single point.

        Instead of \`clk50\`, you can refer to a virtual clock with the same period (\`create_clock -name adc_vclk -period 20\`): its edge is also taken as time 0 at the FPGA pin, and the requirements are the same. A virtual clock becomes mandatory when the clock of the external device does not enter the FPGA or differs from the internal clock in frequency and phase.

        **Check in Vivado:** \`report_timing -from [get_ports {adc_d[*]}] -delay_type min_max\`: the report shows an *input delay* line with the values 8.000 (max) and 2.800 (min); \`check_timing\` must not report *no_input_delay* or *partial_input_delay*. In ConstraintLab, the requirements are shown on the "Path analysis" tab.
      `,
      refs: 'UG903, chapter "Constraining I/O Delay", section on system-synchronous interfaces',
    },

    // -------------------------------------------------------------------------
    'sysio.dac_out': {
      title: 'Parallel DAC output with a common oscillator',
      langNote: 'The output delay formulas and commands are the same for an FPGA and an ASIC die.',
      tags: ['set_output_delay', 'system-synchronous interface', 'DAC'],
      text: `
        A parallel 14-bit DAC and the FPGA are clocked from a common **100 MHz** oscillator through a fanout buffer. The FPGA outputs the \`dac_d[13:0]\` samples from the \`dac_d_reg\` registers (in IOBs) on the rising edge of \`sys_clk\`, and the DAC latches them on the next rising edge of its CLK input.

        | Parameter | Value |
        |---|---|
        | tsu – DAC setup time relative to the CLK edge | 2.0 ns |
        | th – DAC hold time | 1.5 ns |
        | Tcd – clock trace from the buffer to the DAC | 1.2…1.4 ns |
        | Tcf – clock trace from the buffer to the FPGA | 0.5…0.7 ns |
        | Td – data trace from the FPGA to the DAC | 0.8…1.1 ns |

        The clock \`sys_clk\` is already defined on the input port.

        **Task.** Specify the output delays for the \`dac_d[13:0]\` bus relative to the \`sys_clk\` edge at the FPGA pin.
      `,
      strings: {
        '100 МГц': '100 MHz',
        'Буфер': 'Buffer',
        'отсчёты': 'samples',
        'ЦАП 14 бит': '14-bit DAC',
        'tsu 2,0 нс\nth 1,5 нс': 'tsu 2.0 ns\nth 1.5 ns',
        'Tcd 1,2…1,4 нс': 'Tcd 1.2…1.4 ns',
        'sys_clk на ПЛИС': 'sys_clk at FPGA',
        'dac_d на ПЛИС': 'dac_d at FPGA',
        'dac_d на ЦАП': 'dac_d at DAC',
        'CLK ЦАП': 'DAC CLK',
        'захват (отсчёт для -max)': 'capture (-max reference)',
      },
      figures: [
        {
          title: 'Allowed data change interval at the FPGA output',
          // the whole list is repeated: 'Td ≤ 1,1' has no Cyrillic, so `strings` cannot convert its decimal comma
          spans: [
            { row: 1, t0: 7.4, t1: 10, label: '-max = 2.6 ns', cls: 'setup' },
            { row: 1, t0: 0, t1: 1.6, label: '-min = −1.6 ns', cls: 'hold' },
            { row: 2, t0: 7.4, t1: 8.5, label: 'Td ≤ 1.1', cls: 'data' },
            { row: 3, t0: 0, t1: 0.9, label: 'shift ≤ 0.9', cls: 'clk' },
            { row: 3, t0: 10, t1: 10.5, label: 'shift ≥ 0.5', cls: 'clk' },
          ],
          caption: 'Time is measured from the edge at the FPGA pin. The edge at the DAC lags it by Tcd − Tcf = 0.5…0.9 ns. The hatched interval is where the FPGA output may change without violating the DAC tsu and th: from 1.6 ns after the edge to 2.6 ns before the next edge.',
        },
      ],
      hints: [
        'The output delay describes the external part of the path up to the receiving register: -max is how much time the data needs outside the FPGA before the capture edge (trace and setup), -min is the smallest external delay, taking hold into account.',
        'The edge at the DAC lags the edge at the FPGA pin by Tcd − Tcf. For setup, the smallest shift is the worst case (earlier capture); for hold, the largest one (later capture).',
        '-max = Td_max + tsu − (Tcd_min − Tcf_max); -min = Td_min − th − (Tcd_max − Tcf_min).',
      ],
      explain: `
        \`\`\`
        set_output_delay -clock sys_clk -max 2.600 [get_ports {dac_d[*]}]
        set_output_delay -clock sys_clk -min -1.600 [get_ports {dac_d[*]}]
        \`\`\`
        **Model.** Vivado assumes that the external register captures the data on the \`sys_clk\` edge at the definition point, that is, at the FPGA pin. The output delay describes everything outside: -max is the time the data needs before this edge (trace plus receiver setup), -min is the shortest external delay minus the hold time.

        **Capture edge shift.** The edge reaches the DAC through Tcd and the FPGA through Tcf, so at the DAC it lags by Tcd − Tcf = 0.5…0.9 ns. A late capture edge helps setup and hurts hold, so the lag is subtracted in both formulas.

        **Substitution.**
        - -max: the data takes as long as possible to reach the DAC, and the capture edge arrives as early as possible: 1.1 + 2.0 − (1.2 − 0.7) = **2.6 ns**;
        - -min: the data arrives as early as possible, and the capture edge as late as possible: 0.8 − 1.5 − (1.4 − 0.5) = **−1.6 ns**.

        A negative -min means that the data must remain stable for another 1.6 ns after the edge at the FPGA pin. This is usually met automatically thanks to the clock tree and output buffer delays, but only the hold check can confirm it.

        **Common mistakes.**
        - The sign of -min: a value of +1.6 means "the data may change 1.6 ns before the edge". The hold requirement becomes 3.2 ns looser than the real one, and a DAC hold violation goes unnoticed.
        - Ignoring the clock traces (-max = Td_max + tsu = 3.1 ns, -min = Td_min − th = −0.7 ns): -max is overestimated by 0.5 ns (unnecessary pessimism), and the hold check becomes optimistic by 0.9 ns.
        - Applying \`set_input_delay\` to an output port: Vivado rejects the command, and the path to the DAC remains unconstrained.

        **Check in Vivado:** \`report_timing -to [get_ports {dac_d[*]}] -delay_type min_max\`: the report shows an *output delay* line; the setup check is performed against the next edge (10 ns requirement) and the hold check against the same edge (0 ns requirement); \`check_timing\` must not report *no_output_delay* or *partial_output_delay*.
      `,
      refs: 'UG903, chapter "Constraining I/O Delay", section "Output Delay"',
    },

    // -------------------------------------------------------------------------
    'sysio.slow_io': {
      title: 'Buttons, LEDs and UART: what not to analyze',
      langNote: '`set_false_path` is common to XDC and SDC, but the `ASYNC_REG` property exists only in Vivado. In an ASIC, synchronizer stages are protected from optimization by synthesis tool settings and verified by structural CDC analysis.',
      tags: ['set_false_path', 'ASYNC_REG', 'synchronizer'],
      text: `
        On a development board, the FPGA is connected to four buttons \`btn[3:0]\`, eight LEDs \`led[7:0]\` and a USB-UART bridge (receive line \`uart_rx\` and transmit line \`uart_tx\`, 115,200 bit/s). All logic runs on the 100 MHz clock \`sys_clk\` (already defined).

        A button press and the arrival of a UART bit are in no way related to the phase of \`sys_clk\`, so each input passes through a two-flip-flop synchronizer: \`btn_meta_reg\` → \`btn_sync_reg\` and \`rx_meta_reg\` → \`rx_sync_reg\`. The LEDs and the \`uart_tx\` line are driven by the registers \`led_reg\` and \`tx_reg\`: for the human eye and for the UART receiver (bit time 8.68 µs), a delay of a few nanoseconds does not matter.

        **Task.**
        1. Exclude from timing analysis the paths from the asynchronous inputs \`btn[3:0]\`, \`uart_rx\` and the paths to the slow outputs \`led[7:0]\`, \`uart_tx\`.
        2. Mark the registers of both synchronizers (both stages) with the property that makes Vivado place them next to each other and protects them from optimizations.
      `,
      strings: {
        'логика': 'logic',
        'btn[0] (вывод)': 'btn[0] (pin)',
        'нажатие (в любой момент)': 'press (at any time)',
        'вторая ступень': 'second stage',
        'время на успокоение ≈ T': 'resolution time ≈ T',
        'метастабильность': 'metastability',
      },
      figures: [
        {
          title: 'Asynchronous input: the phase relative to sys_clk is random',
          caption: 'The press may fall into the setup/hold window of the first register (highlighted in red), and the register then goes metastable for a while. Static timing analysis cannot prevent this: reliability is provided by the second stage, which leaves a full period for the first stage to resolve. The closer the registers are to each other, the more of this time remains.',
        },
      ],
      hints: [
        'There is no "correct" set_input_delay value for an asynchronous input: its phase relative to sys_clk is random. Such paths are excluded from analysis with `set_false_path`.',
        'Inputs: `set_false_path -from [get_ports …]`; outputs: `set_false_path -to [get_ports …]`.',
        'Synchronizer registers are marked with the `ASYNC_REG` property: `set_property ASYNC_REG TRUE [get_cells {…}]`, on both stages.',
      ],
      explain: `
        \`\`\`
        set_false_path -from [get_ports {btn[*] uart_rx}]
        set_false_path -to [get_ports {led[*] uart_tx}]
        set_property ASYNC_REG TRUE [get_cells {btn_meta_reg[*] btn_sync_reg[*] rx_meta_reg rx_sync_reg}]
        \`\`\`
        **Why these paths are not analyzed.** Static timing analysis checks paths whose launch time is rigidly tied to a clock edge. A button press (with contact bounce lasting several milliseconds) and a UART bit lasting 8.68 µs arrive at an arbitrary time, and any \`set_input_delay\` value would be fiction: Vivado would get a requirement that reflects nothing real and could waste effort on "violations" or hide real problems. The correctness of such an input is ensured by the synchronizer, not by the analysis. For the outputs to the LEDs and \`uart_tx\`, a delay of nanoseconds is irrelevant, so there is no reason to constrain them either.

        **Why not set_input_delay of zero.** A zero delay relative to \`sys_clk\` claims that the button switches exactly at the \`sys_clk\` edge, which is false. The path becomes timed, and the analysis result becomes meaningless.

        **Why ASYNC_REG.**
        - The synchronizer registers are placed close together in one slice: the delay between the stages is minimal, and almost the whole period remains for the metastable first register to resolve. The mean time between failures (MTBF) depends exponentially on this time.
        - Synthesis and placement do not merge the stages into an SRL shift register, and do not replicate or move them.
        - The property is needed on **both** stages (and on the third one, if present): it is the pair of registers that forms the synchronizer.

        **Common mistakes.**
        - \`ASYNC_REG\` is missing or set only on the first stage: the registers may end up far apart, MTBF drops, and optimization may turn the pair into an SRL with poor metastability robustness.
        - Only the inputs are excluded: the outputs to the LEDs and \`uart_tx\` remain unconstrained ports that look forgotten in the reports.
        - A synchronizer without an exception: the path from the port to \`btn_meta_reg\` remains unconstrained, but any general constraint such as \`set_input_delay … [all_inputs]\` makes it timed and meaningless.

        An equivalent option is to exclude the input paths by their endpoints: \`set_false_path -to [get_cells {btn_meta_reg[*] rx_meta_reg}]\`. The path \`btn_meta_reg → btn_sync_reg\` then remains an ordinary synchronous path within the \`sys_clk\` domain and is analyzed.

        **Check in Vivado:** \`report_exceptions\` lists the active false paths; \`report_property [get_cells btn_sync_reg[0]]\` shows the ASYNC_REG value; \`report_cdc\` and (for UltraScale) \`report_synchronizer_mtbf\` identify synchronizers by this property.
      `,
      refs: 'UG903, chapter "Constraining I/O Delay" and the section on set_false_path; UG912, ASYNC_REG property',
    },

    // -------------------------------------------------------------------------
    'sysio.feedthrough': {
      title: 'Combinational path through the FPGA without a clock',
      langNote: '`set_max_delay` between ports is written the same way in XDC and SDC.',
      tags: ['set_max_delay', 'combinational path'],
      text: `
        The FPGA sits between a processor and a peripheral device and passes four control signals: \`ctl_in[3:0]\` → input buffers → interlock logic in LUTs (each output depends on all four inputs) → output buffers → \`ctl_out[3:0]\`. There are no registers or clocks on this path.

        The timing diagram of the bus cycle between the processor and the peripheral device allots at most **7.0 ns** to the propagation through the FPGA, from any \`ctl_in\` pin to any \`ctl_out\` pin.

        **Task.** Constrain the delay of this combinational path.
      `,
      strings: {
        'Процессор': 'Processor',
        'Периферия': 'Peripheral',
        'блокировка': 'interlock',
        'ctl_in → ctl_out: не более 7,0 нс': 'ctl_in → ctl_out: max 7.0 ns',
        'изменение входа': 'input change',
        'предел 7,0 нс': 'limit 7.0 ns',
        'допустимо': 'allowed',
        'нарушение': 'violation',
      },
      figures: [
        {
          title: 'Combinational path budget',
          caption: 'There is no clock: the requirement is set directly as the maximum delay from the input port to the output port. It includes the input buffer, routing, the LUT and the output buffer.',
        },
      ],
      hints: [
        'Input/output delays are specified relative to a clock, and there is none here. You need a command that sets the maximum path delay directly.',
        'Syntax: `set_max_delay <ns> -from <startpoints> -to <endpoints>`. The startpoints are the input ports, the endpoints are the output ports.',
      ],
      explain: `
        \`\`\`
        set_max_delay 7.000 -from [get_ports {ctl_in[*]}] -to [get_ports {ctl_out[*]}]
        \`\`\`
        **Why not set_input_delay/set_output_delay.** These commands tie the external part of a path to a clock edge. A port-to-port combinational path has no clocks, and without an exception the paths remain unconstrained: Vivado lists them under *Unconstrained Paths*, and \`check_timing\` reports *no_input_delay* and *no_output_delay*.

        **What set_max_delay does.** The command sets the requirement directly: the total delay from the input port to the output port (IBUF, routing, LUT, OBUF) must not exceed 7.0 ns. Here 16 paths are analyzed: each input affects each output through the interlock logic. The \`-datapath_only\` option is not needed: there are no clocks, so there is no clock skew to account for.

        **Common mistakes.**
        - \`set_false_path\` instead of a constraint: the path is excluded from analysis, the router may make it arbitrarily long, and the system fails on the board.
        - Swapped -from and -to: output ports cannot be startpoints, Vivado discards such objects, and the exception has no effect, so the path is unconstrained again.
        - A wrong value (for example, with trace delays subtracted once more although they are already included in the 7.0 ns budget).

        If the system also required a minimum delay (for example, for hold at the receiver), it would be set with \`set_min_delay\`. Another approach is also used: a virtual clock with \`set_input_delay\`/\`set_output_delay\` that "eat up" part of the period. It is justified when the path budget is specified relative to the processor clock; with a directly specified limit, \`set_max_delay\` is clearer and creates no extra hold checks.

        **Check in Vivado:** \`report_timing -from [get_ports {ctl_in[*]}] -to [get_ports {ctl_out[*]}] -max_paths 16\`: a requirement of 7.000 ns marked *max delay*; \`report_exceptions\` shows that the exception applies to all 16 paths.
      `,
      refs: 'UG903, section "set_max_delay"',
    },

    // -------------------------------------------------------------------------
    'sysio.calc': {
      title: 'Calculation: input delays with length-matched clock traces',
      langNote: 'The input delay calculation is the same for an FPGA and an ASIC.',
      tags: ['set_input_delay', 'calculation'],
      text: `
        A controller with a synchronous parallel bus and the FPGA are clocked from a common **40 MHz** oscillator. The clock traces to both devices are length-matched, so the edge arrives at both at the same time. The controller outputs the data \`bus_d[15:0]\` on the rising edge, and the FPGA captures it on the next rising edge.

        | Parameter | Min | Max |
        |---|---|---|
        | Controller Tco (edge → data at the output) | 1.5 ns | 5.0 ns |
        | Td – data trace from the controller to the FPGA | 0.5 ns | 0.9 ns |

        **Task.** Calculate the \`-max\` and \`-min\` values for the \`set_input_delay\` command relative to the FPGA clock (in nanoseconds).
      `,
      strings: {
        '40 МГц': '40 MHz',
        'Контроллер': 'Controller',
        'Tclk (та же длина)': 'Tclk (same length)',
        'Td 0,5…0,9 нс': 'Td 0.5…0.9 ns',
        'CLK (обе)': 'CLK (both)',
        'выход контроллера': 'controller output',
        'bus_d на ПЛИС': 'bus_d at FPGA',
        'фронт (0)': 'edge (0)',
      },
      figures: [
        {
          title: 'Data change window (not to scale)',
          caption: 'The edge arrives at both devices at the same time, so measuring from the edge at the FPGA pin is the same as measuring from the edge at the controller. The data trace delay is added to the change interval at the controller output.',
        },
      ],
      fields: [
        { label: '`set_input_delay -max`' },
        { label: '`set_input_delay -min`' },
      ],
      hints: [
        'With length-matched clock traces, the Tcd and Tcf terms are equal and cancel out.',
        '-max = Tco_max + Td_max, -min = Tco_min + Td_min.',
      ],
      explain: `
        The general system-synchronous input formula: \`-max = Tcd_max + Tco_max + Td_max − Tcf_min\`, \`-min = Tcd_min + Tco_min + Td_min − Tcf_max\`. With length-matched clock traces, Tcd = Tcf, and they cancel out:
        - -max = 5.0 + 0.9 = **5.9 ns**;
        - -min = 1.5 + 0.5 = **2.0 ns**.

        \`\`\`
        set_input_delay -clock clk40 -max 5.900 [get_ports {bus_d[*]}]
        set_input_delay -clock clk40 -min 2.000 [get_ports {bus_d[*]}]
        \`\`\`
        The period (25 ns) is not part of the input delay: the analysis itself accounts for it by comparing the data arrival time with the next edge. The path inside the FPGA gets 25 − 5.9 = 19.1 ns.

        **Common mistakes:** mixing minimum and maximum values (for example, \`Tco_max + Td_min\`), subtracting the result from the period (Vivado already does that), or using a single value for -max and -min.

        If the clock traces are not length-matched, go back to the general formula: with Tcd > Tcf (the edge reaches the controller later), -max increases; with Tcd < Tcf, it decreases.
      `,
      refs: 'UG903, chapter "Constraining I/O Delay"',
    },

    // -------------------------------------------------------------------------
    'sysio.vclk_q': {
      title: 'When is a virtual clock needed?',
      langNote: 'Virtual clocks are the same in XDC and SDC; in ASICs they are also used to specify the timing budgets of blocks on the die (see [[q:asic.vclk_io|the task on block budgets]]).',
      tags: ['virtual clock', 'understanding'],
      text: `
        A virtual clock is created with \`create_clock\` without objects, for example \`create_clock -name codec_vclk -period 40\`. It does not propagate through the FPGA design and serves only as a reference for \`set_input_delay\` and \`set_output_delay\`.

        The figure shows an example: a frequency synthesizer supplies 100 MHz to the FPGA and a phase-aligned 25 MHz to a codec, to which the FPGA sends the data \`codec_d[7:0]\`.

        In which situations **should** input/output delays be specified relative to a virtual clock? Select all that apply.
      `,
      strings: {
        'Синтезатор': 'Synthesizer',
        '100 МГц': '100 MHz',
        '25 МГц': '25 MHz',
        'syn.100 МГц': 'syn.100 MHz',
        'syn.25 МГц': 'syn.25 MHz',
        '25 МГц – в ПЛИС не заходит': '25 MHz – does not enter the FPGA',
        'отсчёты': 'samples',
        'Кодек': 'Codec',
        'sys_clk 100 МГц': 'sys_clk 100 MHz',
        'CLK кодека 25 МГц': 'codec CLK 25 MHz',
        '10 нс': '10 ns',
      },
      figures: [
        {
          title: 'Reference edges for the output to the codec',
          caption: 'The codec clock does not exist in the FPGA, so it is described by a virtual clock with the same period and phase. Vivado expands 100 and 25 MHz over the common period (40 ns) and finds the closest launch-capture edge pair.',
        },
      ],
      options: [
        { text: 'The external device is clocked by a signal that does not enter the FPGA: like the codec in the figure, which receives 25 MHz from the synthesizer, phase-aligned with the 100 MHz at the FPGA input.', why: 'Correct. The output delays are measured from the edges of the codec clock. This clock does not exist in the design, so it is described as a virtual clock: `create_clock -name codec_vclk -period 40`, followed by `set_output_delay -clock codec_vclk …`.' },
        { text: 'The I/O is clocked by an MMCM output whose frequency is not a multiple of the FPGA input clock frequency (for example, 100 → 66.667 MHz), and the external device runs at the MMCM output frequency.', why: 'Correct. If you refer to the 100 MHz input clock, Vivado expands 100 and 66.667 MHz over the common period and selects the closest edge pair, so the requirement becomes unrealistically small. A virtual clock with a 15 ns period defines the natural launch-capture pair.' },
        { text: 'You need to specify uncertainty or board delay (`set_clock_uncertainty`, `set_clock_latency -source`) only for the external clock, without changing the analysis of internal paths.', why: 'Correct. The properties of a virtual clock affect only the I/O paths that refer to it; register-to-register paths inside the FPGA are analyzed as before.' },
        { text: 'An ADC and the FPGA are clocked by one oscillator, and its signal is routed to an FPGA pin.', why: 'Not necessary. The delays can be specified relative to the clock defined on that pin: its edge already serves as time 0 at the FPGA pin. A virtual clock with the same period gives the same requirements; it is a matter of style, not a necessity.' },
        { text: 'The input is asynchronous (a button, a UART line): to keep the path from being analyzed, the delay is specified relative to a virtual clock.', why: 'Wrong. A delay relative to any clock makes the path timed, and with a meaningless requirement. Asynchronous inputs are excluded with `set_false_path`, and reliability is ensured by a synchronizer.' },
        { text: 'The device sends data together with its own clock, which is routed to a clock input of the FPGA (source-synchronous interface).', why: 'Not needed. The reference clock physically arrives at the FPGA and is defined with `create_clock` on that port; the delays are specified relative to it. A virtual clock with the same period would only duplicate the definition.' },
      ],
      explain: `
        A virtual clock describes an **external** clock that does not exist in the FPGA design. It is used when:
        1. the reference clock of the external device does not enter the FPGA;
        2. the I/O is clocked by an internal clock (an MMCM output) that cannot be correctly related to the board clock because the frequency ratio is not an integer;
        3. uncertainty or latency must be specified only for the external clock.

        For the example in the figure:
        \`\`\`
        create_clock -name sys_clk -period 10.000 [get_ports sys_clk]
        create_clock -name codec_vclk -period 40.000
        set_output_delay -clock codec_vclk -max <tsu + trace> [get_ports {codec_d[*]}]
        set_output_delay -clock codec_vclk -min <trace − th> [get_ports {codec_d[*]}]
        \`\`\`
        Vivado treats the clocks as related (by default, all clocks are related): data launched by the 100 MHz edge at 30 ns is captured by the codec edge at 40 ns, which gives a 10 ns requirement. If the clock phases at the device pins differ, this is accounted for with the -waveform option of the virtual clock or with \`set_clock_latency -source\`.

        When the external device and the FPGA are clocked by one signal that is routed to an FPGA pin, a virtual clock is not mandatory: the clock on the port gives the same requirements.

        Check in Vivado: \`report_clocks\` (a virtual clock has no definition points), \`report_clock_interaction\`: the internal-virtual pair is analyzed as synchronous.
      `,
      refs: 'UG903, section "Virtual Clocks"',
    },
  },
});
