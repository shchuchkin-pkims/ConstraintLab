/* ConstraintLab – английский текст справочника (подменяет русский при XT.lang === 'en') */
(function (XT) {
  'use strict';
  if (XT.lang !== 'en' || !XT.refdocs) return;

  // Группы и САПР: одна строка на группу (по group строится меню справочника)
  const G = { clk: 'Clocks', io: 'I/O', exc: 'Timing exceptions', obj: 'Objects', prop: 'Properties (XDC)', rep: 'Reports (console)' };
  const BOTH = 'Vivado and SDC', VIV = 'Vivado', ASIC = 'SDC (ASIC)', CON = 'console';

  // Команды по имени; заменяются только поля с русским текстом, команды и опции не меняются
  const CMDS = {
    // ------------------------------------------------------------------ тактовые сигналы
    create_clock: {
      group: G.clk, tool: BOTH,
      brief: 'Primary clock (or a virtual clock if no objects are specified)',
      syn: 'create_clock -period <ns> [-name <name>] [-waveform {<rise> <fall>}] [-add] [<objects>]',
      opts: [
        ['-period <ns>', 'Period in nanoseconds: T = 1000 / f[MHz]. 100 MHz → 10, 125 MHz → 8, 156.25 MHz → 6.4.'],
        ['-name <name>', 'Clock name. Defaults to the name of the first object. Required for a virtual clock.'],
        ['-waveform {r f}', 'Rising and falling edge times within the period. Default: {0 T/2}. 40% duty cycle: {0 0.4T}; 90° phase shift: {T/4 3T/4}.'],
        ['-add', 'Add another clock on the same object (without this option, the existing clock is replaced). Needed when the port can receive one of several frequencies.'],
        ['<objects>', 'The port (typically), pin or net where the clock enters the design. Without objects, a virtual clock is created.'],
      ],
      desc: `Creates a **primary clock**. Its definition point is the reference from which the EDA tool measures clock tree delay. In almost all cases, it is an **input port** driven by an oscillator, a physical-layer device (PHY), an ADC, etc.

A clock defined **without objects** is a **virtual clock**: it describes the clock of an external device that is not part of the design and serves only as a reference for \`set_input_delay\` and \`set_output_delay\`.`,
      ex: `# 100 MHz from a crystal oscillator
create_clock -name sys_clk -period 10.000 [get_ports sys_clk]
# 200 MHz LVDS differential clock: P pin only
create_clock -name clk200 -period 5.000 [get_ports clk200_p]
# clock with a 40% duty cycle
create_clock -name pclk -period 8.000 -waveform {0 3.2} [get_ports pclk]
# virtual clock of an external device
create_clock -name vclk_adc -period 10.000`,
      notes: `- **Vivado:** clocks at MMCM/PLL/BUFR outputs do not need to be defined: Vivado derives them automatically. A \`create_clock\` at an MMCM output breaks the relationship with the input clock.
- **Differential pair:** define the clock on the P pin only; a second clock on the N pin causes spurious timing checks between the two clocks.
- **Command order matters:** commands that refer to a clock (\`get_clocks\`, \`-clock\`) must come *after* the clock is created.
- **ASIC:** \`create_clock\` on the port and \`set_clock_uncertainty/latency/transition\` before clock tree synthesis; \`set_propagated_clock\` after it.`,
    },
    create_generated_clock: {
      group: G.clk, tool: BOTH,
      brief: 'Generated clock: clock divider, forwarded clock, PLL in ASIC, clock multiplexer',
      syn: 'create_generated_clock [-name <name>] -source <pin/port> [-master_clock <clock>]\n    [-divide_by N | -multiply_by N | -edges {e1 e2 e3} [-edge_shift {s1 s2 s3}]]\n    [-duty_cycle %] [-invert] [-combinational] [-add] <objects>',
      opts: [
        ['-source <pin>', 'Pin where the master clock is present: the clock pin of the divider register (div_reg/C), the ODDR clock input (oddr/C), the PLL input. This is not the definition point of the generated clock!'],
        ['-master_clock <name>', 'Which of the clocks at the -source pin is the master clock when there are several (clock multiplexer). Usually used together with -add.'],
        ['-divide_by N', 'Multiplies the period by N. Equivalent to -edges {1 N+1 2N+1}. For a copy without division (forwarded clock): -divide_by 1.'],
        ['-multiply_by N', 'Divides the period by N (PLL outputs in ASIC). Vivado allows combining it with -divide_by.'],
        ['-edges {e1 e2 e3}', 'Master clock edge numbers: 1 is the first rising edge, 2 the first falling edge, 3 the second rising edge, and so on. The rising edge of the generated clock coincides with edge e1, the falling edge with e2 and the next rising edge with e3. Divide-by-3 with a 1/3 duty cycle: {1 3 7}.'],
        ['-edge_shift {…}', 'Shift of each of the three edges in nanoseconds (only together with -edges).'],
        ['-duty_cycle %', 'Duty cycle in percent (usually with -multiply_by).'],
        ['-invert', 'Inverts the resulting clock (for example, an ODDR with D1 = 0, D2 = 1 outputs an inverted copy).'],
        ['-combinational', 'The clock propagates through combinational logic only, without division.'],
        ['-add', 'Add to a clock that already exists at this point (clock multiplexer: two generated clocks on one output).'],
      ],
      desc: `Defines a clock **derived from another clock** inside the design. Unlike a primary clock, a generated clock is related to its master clock: its phase and latency are referenced to the master clock, so paths between the two are timed as synchronous.

Typical cases:
- register-based clock divider (\`-source [get_pins div_reg/C] -divide_by 2 [get_pins div_reg/Q]\`);
- **clock forwarded to an external pin** through an ODDR (\`-source [get_pins oddr/C] -divide_by 1 [get_ports clk_out]\`);
- PLL outputs in ASIC (\`-multiply_by\`);
- clock multiplexer output (one generated clock per input, with the -add and -master_clock options).`,
      ex: `# register-based divide-by-2 clock divider
create_generated_clock -name clk_div2 -source [get_pins clk_div_reg/C] -divide_by 2 [get_pins clk_div_reg/Q]
# clock forwarded to an external pin
create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]
# Vivado: renaming an MMCM clock derived automatically
create_generated_clock -name clk_dsp [get_pins u_clk/mmcm_inst/CLKOUT1]`,
      notes: `- **Vivado:** without -source and without division parameters, the command only *renames* the automatically derived clock at the specified pin.
- A generated clock defined on a pin **blocks** further propagation of the master clock through that pin.
- If the master clock does not reach the -source pin, the generated clock is not created (check_timing: generated_clocks).`,
    },
    set_clock_groups: {
      group: G.clk, tool: BOTH,
      brief: 'Declare clock groups unrelated (asynchronous or exclusive)',
      syn: 'set_clock_groups [-name <name>] -asynchronous | -logically_exclusive | -physically_exclusive\n    -group <clocks> [-group <clocks> …]',
      opts: [
        ['-asynchronous', 'The clocks are independent (different oscillators, no fixed phase relationship). Paths between the groups are not timed.'],
        ['-logically_exclusive', 'The clocks are present on the device at the same time but do not interact logically (for example, both drive the inputs of a multiplexer).'],
        ['-physically_exclusive', 'The clocks cannot exist on the same net at the same time (multiplexer output, two clocks on one port defined with -add).'],
        ['-group <clocks>', 'A group of clocks. Convenient form: [get_clocks -include_generated_clocks clk_a], the clock together with all its generated clocks.'],
      ],
      desc: `Disables timing analysis of **all** paths between clocks in different groups (in both directions). Paths within a group are timed as usual. If only one group is specified, it is isolated from all other clocks in the design.

The command has the **highest priority** of all timing exceptions: it overrides even \`set_max_delay -datapath_only\`.`,
      notes: `> **Warning:** if some paths between the asynchronous domains need \`set_max_delay -datapath_only\` (Gray code, XPM_CDC, handshake), \`set_clock_groups\` overrides it, and those constraints no longer take effect. In such designs, constrain the paths between the domains individually.

- Clocks of the same MMCM are **not asynchronous**: their relationship is deterministic. Declaring them asynchronous hides real violations.`,
    },
    set_input_jitter: {
      group: G.clk, tool: VIV,
      brief: 'Jitter of an input (primary) clock, from the oscillator data sheet',
      syn: 'set_input_jitter <clock> <jitter, ns>',
      opts: [['<jitter, ns>', 'Peak-to-peak jitter in nanoseconds. Vivado includes it in the clock uncertainty.']],
      desc: 'Specifies the jitter of a primary clock. Vivado automatically propagates it to the clocks derived from MMCM/PLL outputs and includes it in the clock uncertainty.',
      notes: '- Applies to primary clocks. The system-wide component is set by `set_system_jitter` (0.05 ns by default; usually it does not need to be changed).',
    },
    set_system_jitter: {
      group: G.clk, tool: VIV,
      brief: 'System jitter component (power supply noise, etc.)',
      syn: 'set_system_jitter <ns>',
      desc: 'System jitter component applied to all clocks (0.050 ns by default).',
    },
    set_clock_uncertainty: {
      group: G.clk, tool: BOTH,
      brief: 'Additional clock uncertainty (jitter, skew, margin)',
      syn: 'set_clock_uncertainty [-setup|-hold] [-from <clock> -to <clock>] <ns> [<clocks>]',
      opts: [
        ['-setup / -hold', 'Setup check only or hold check only. By default, both.'],
        ['-from / -to', 'Uncertainty for a pair of clocks (the paths between them).'],
      ],
      desc: `Reduces the time available for setup and increases the hold requirement by the specified amount.

- **ASIC before clock tree synthesis:** uncertainty = jitter + estimated clock tree skew + margin. After clock tree synthesis, skew is computed from the actual routing, and only jitter and margin remain in the uncertainty.
- **Vivado:** jitter is specified with \`set_input_jitter\`; \`set_clock_uncertainty\` is used for additional margin (for example, in early design stages).`,
    },
    set_clock_latency: {
      group: G.clk, tool: BOTH,
      brief: 'Clock latency: source latency (-source) or an estimate of clock tree latency',
      syn: 'set_clock_latency [-source] [-early|-late] [-min|-max] <ns> <clocks>',
      opts: [
        ['-source', 'Delay from the clock source to the clock definition point (outside the design: board, oscillator).'],
        ['(without -source)', 'Propagation delay through the clock tree (network latency): an estimate for ASIC before clock tree synthesis.'],
        ['-early / -late', 'Early and late latency (to account for variation).'],
      ],
      desc: 'In ASIC flows before clock tree synthesis, clocks are ideal: the clock tree latency is specified as an estimate so that the I/O budgets are realistic. After clock tree synthesis, `set_propagated_clock` is used.',
      ex: `set_clock_latency 0.350 [get_clocks clk]            ;# clock tree latency estimate
set_clock_latency -source 0.200 [get_clocks clk]    ;# off-chip latency`,
    },
    set_clock_transition: {
      group: G.clk, tool: ASIC,
      brief: 'Transition time of an ideal clock before clock tree synthesis',
      syn: 'set_clock_transition [-rise|-fall] [-min|-max] <ns> <clocks>',
      desc: 'Before clock tree synthesis, a clock is ideal and has no real transition time; the transition time is specified as an estimate for cell delay calculation.',
    },
    set_propagated_clock: {
      group: G.clk, tool: ASIC,
      brief: 'Compute clock tree latency from the actual routing (after clock tree synthesis)',
      syn: 'set_propagated_clock <clocks>',
      desc: 'After clock tree synthesis, clocks are switched to propagated mode. In Vivado, all clocks are always analyzed with their actual propagation delay, so the command is not needed.',
    },
    // ------------------------------------------------------------------ ввод/вывод
    set_input_delay: {
      group: G.io, tool: BOTH,
      brief: 'Data arrival time at an input port relative to an edge of the reference clock',
      syn: 'set_input_delay -clock <clock> [-clock_fall] [-max|-min] [-add_delay] <ns> <ports>',
      opts: [
        ['-clock <name>', 'Reference clock that LAUNCHES the data in the external device: the clock on an input port (source-synchronous interface) or a virtual or system clock.'],
        ['-clock_fall', 'The delay is relative to the falling clock edge (DDR, devices that output data on the falling edge).'],
        ['-max', 'LATEST time new data appears after the clock edge (for the setup check).'],
        ['-min', 'EARLIEST time data changes after the clock edge (for the hold check). Can be negative.'],
        ['-add_delay', 'Add this delay to the delays already specified on the port (second edge, second clock). Without this option, a new command REPLACES the previous delays of the same kind (-max or -min).'],
      ],
      desc: `Describes **everything outside the FPGA** on the input path: the clock-to-output delay of the external device (Tco) and the board trace delay. The EDA tool computes the internal part of the path itself.

The delay is measured from the reference clock edge **at the FPGA pins** (for a clock defined on a port) to the time the data changes **at the FPGA pins**.`,
      ex: `# system-synchronous interface: common oscillator
set_input_delay -clock sys_clk -max [expr {$tco_max + $trace_max}] [get_ports {adc_d[*]}]
set_input_delay -clock sys_clk -min [expr {$tco_min + $trace_min}] [get_ports {adc_d[*]}]
# DDR, center-aligned data: four commands
set_input_delay -clock rx_clk -max 2.8 [get_ports {rxd[*]}]
set_input_delay -clock rx_clk -min 1.2 [get_ports {rxd[*]}]
set_input_delay -clock rx_clk -max 2.8 [get_ports {rxd[*]}] -clock_fall -add_delay
set_input_delay -clock rx_clk -min 1.2 [get_ports {rxd[*]}] -clock_fall -add_delay`,
      notes: `- Without \`-max\` and \`-min\`, the value sets both bounds at once.
- If only -max or only -min is specified, check_timing reports *partial_input_delay*: the other check is not performed.
- **Formulas:** see the article "Input delay formulas".`,
    },
    set_output_delay: {
      group: G.io, tool: BOTH,
      brief: 'Requirements of the external receiver relative to an edge of its clock',
      syn: 'set_output_delay -clock <clock> [-clock_fall] [-max|-min] [-add_delay] <ns> <ports>',
      opts: [
        ['-clock <name>', 'Clock with which the receiver CAPTURES the data: a generated clock on an output port (if the FPGA forwards the clock to the receiver), a system clock or a virtual clock.'],
        ['-max', 'Receiver setup time + maximum data trace delay − minimum clock skew (clock arrival at the receiver minus clock arrival at the FPGA). Determines the setup check.'],
        ['-min', '−(receiver hold time) + minimum data trace delay − maximum clock skew. Usually a negative number. Determines the hold check.'],
        ['-clock_fall', 'Capture on the falling clock edge (DDR).'],
        ['-add_delay', 'Add to the delays already specified on the port.'],
      ],
      desc: 'Describes the requirements of the external receiver. The EDA tool subtracts the -max value from the capture time (setup check) and checks that the data does not change earlier than -min after the capture edge (hold check).',
      ex: `# source-synchronous output: the FPGA forwards the clock to the receiver
set_output_delay -clock dac_clk -max [expr {$tsu + $trace_max}] [get_ports {dac_d[*]}]
set_output_delay -clock dac_clk -min [expr {$trace_min - $th}]  [get_ports {dac_d[*]}]`,
      notes: '- If the FPGA itself forwards the clock to the receiver, the reference is the **generated clock on the output clock port**. The clock delay through ODDR/OBUF is then taken into account and partially compensates for the data delay.',
    },
    set_load: {
      group: G.io, tool: ASIC,
      brief: 'Capacitive load on output ports',
      syn: 'set_load [-min|-max] <pF> <ports>',
      desc: 'The load seen by the output driver (the input of the next block, an I/O pad).',
    },
    set_driving_cell: {
      group: G.io, tool: ASIC,
      brief: 'Library cell that drives an input port',
      syn: 'set_driving_cell -lib_cell <cell> [-pin <output pin>] <ports>',
      opts: [['-lib_cell', 'Library cell that models the external driver (BUFX4, etc.).']],
      desc: 'Sets realistic transition times at the block inputs: without it, an input is considered ideal (zero transition time).',
      notes: '- The clock port is usually excluded: its transition time is set by set_clock_transition.',
    },
    set_input_transition: {
      group: G.io, tool: ASIC,
      brief: 'Transition time at input ports',
      syn: 'set_input_transition [-min|-max] <ns> <ports>',
      desc: 'An alternative to set_driving_cell.',
    },
    set_max_transition: {
      group: G.io, tool: ASIC,
      brief: 'Maximum transition time (design rule)',
      syn: 'set_max_transition <ns> <objects>',
      desc: 'A design rule: synthesis and place and route insert buffers so that transition times do not exceed the specified value.',
    },
    set_max_fanout: {
      group: G.io, tool: ASIC,
      brief: 'Maximum fanout',
      syn: 'set_max_fanout <value> <objects>',
    },
    // ------------------------------------------------------------------ исключения
    set_false_path: {
      group: G.exc, tool: BOTH,
      brief: 'False path: exclude a path from timing analysis (asynchronous or functionally impossible)',
      syn: 'set_false_path [-setup|-hold] [-from <objects>] [-through <objects>] [-to <objects>]',
      opts: [
        ['-from', 'Startpoints: clocks, input ports, registers (cells) or their clock pins. NOT the Q output.'],
        ['-to', 'Endpoints: clocks, output ports, registers or their data pins (D, CE, R, CLR, etc.). NOT the clock pin.'],
        ['-through', 'Intermediate pins, nets or cells. Multiple -through options specify the order in which the path passes through them.'],
        ['-setup / -hold', 'Disable only one of the checks.'],
        ['-rise_from / -fall_to …', 'Restrict the exception to a particular launch or capture edge (DDR interfaces).'],
      ],
      desc: `Excludes a path from timing analysis. Used when timing relationships are **meaningless**:
- an asynchronous input (push button, UART receiver) ahead of a synchronizer;
- a single-bit transfer through a synchronizer between unrelated clocks;
- quasi-static signals (configuration that changes only in the idle state);
- an asynchronous reset from an external pin.`,
      notes: `- Priority: **set_clock_groups > set_false_path > set_max_delay/set_min_delay > set_multicycle_path**.
- An overly broad exception (an entire clock) hides real paths. Narrow it down to specific registers.
- With a wrong startpoint or endpoint (a Q output, a clock pin), the exception covers no paths (report_exceptions shows this).`,
    },
    set_multicycle_path: {
      group: G.exc, tool: BOTH,
      brief: 'Multicycle path: data remains stable for longer than one clock period',
      opts: [
        ['<N>', 'For -setup: the number of clock cycles allowed for the path (the capture edge moves N−1 periods later). For -hold: the number of cycles by which the hold check is moved back.'],
        ['-setup', 'Default. The shift is counted in periods of the CAPTURE clock (-end).'],
        ['-hold', 'By default, the shift is counted in periods of the LAUNCH clock (-start).'],
        ['-start / -end', 'Selects the clock whose period is the unit of the shift: -start for the launch clock, -end for the capture clock.'],
      ],
      desc: `Typical case: data is updated once every N clock cycles (under an enable signal), and the receiver also captures it once every N cycles.

**The N and N−1 rule** (single clock): \`-setup N\` and \`-hold N-1\` with the same -from/-to. Without \`-hold\`, the hold check moves together with the setup check by N−1 cycles, and the path is required to be *longer* than several periods: a violation is almost inevitable.`,
      ex: `set_multicycle_path 2 -setup -from [get_cells {acc_reg[*]}] -to [get_cells {res_reg[*]}]
set_multicycle_path 1 -hold  -from [get_cells {acc_reg[*]}] -to [get_cells {res_reg[*]}]
# slow to fast (data is stable for 4 cycles of the fast clock)
set_multicycle_path 4 -setup -end -from [get_clocks clk50] -to [get_clocks clk200]
set_multicycle_path 3 -hold  -end -from [get_clocks clk50] -to [get_clocks clk200]`,
      notes: `- **From a slow clock to a fast clock:** the shift is in capture clock periods, \`-end\` (for the hold check too, -end!).
- **From fast to slow:** the shift is in launch clock periods, \`-start\`.
- A multicycle path has the lowest priority of all timing exceptions.`,
    },
    set_max_delay: {
      group: G.exc, tool: BOTH,
      brief: 'Constrain the maximum path delay instead of using the clock relationship',
      syn: 'set_max_delay <ns> [-datapath_only] [-from …] [-through …] [-to …]',
      opts: [
        ['<ns>', 'Path delay requirement (replaces the requirement derived from the clock relationship).'],
        ['-datapath_only', 'Vivado: consider only the data path delay (no clock skew) and skip the hold check. Requires -from. The standard technique for paths between asynchronous clock domains.'],
      ],
      desc: `Two main uses:
1. **Port-to-port combinational path** (a signal passing through the FPGA): \`set_max_delay 7 -from [get_ports a] -to [get_ports y]\`.
2. **Crossing between asynchronous clock domains** (Vivado): \`set_max_delay -datapath_only <T> -from … -to …\` limits the delay and the delay spread (important for Gray code and handshake buses) without requiring the clocks to be synchronous.`,
      notes: '- Input/output delays on ports are still taken into account: budget = value − input delay − output delay.\n- Overrides a multicycle path but yields to a false path and to clock groups.',
    },
    set_min_delay: {
      group: G.exc, tool: BOTH,
      brief: 'Minimum path delay (similar to a hold requirement)',
      syn: 'set_min_delay <ns> [-from …] [-through …] [-to …]',
      desc: 'Replaces the hold requirement with the specified value: the path delay must be at least this value.',
    },
    set_bus_skew: {
      group: G.exc, tool: VIV,
      brief: 'Limit the skew between bus bits in a clock domain crossing',
      syn: 'set_bus_skew -from <…> -to <…> <ns>',
      desc: 'Checks that the bits of a bus (a Gray-coded FIFO pointer, a multi-bit synchronizer) arrive at the receiver with a skew no greater than the specified value. The value is usually equal to the smaller of the two periods. Does not conflict with other timing exceptions.',
    },
    set_case_analysis: {
      group: G.exc, tool: BOTH,
      brief: 'Set a constant logic value on a port or pin (mode selection)',
      syn: 'set_case_analysis 0|1|rising|falling <ports/pins>',
      desc: 'The EDA tool propagates the constant through the logic: it disables paths through inactive multiplexer inputs and clocks that do not propagate in this mode. Example: functional mode, `test_mode = 0`.',
    },
    set_disable_timing: {
      group: G.exc, tool: BOTH,
      brief: 'Disable timing arcs of a cell',
      syn: 'set_disable_timing [-from <pin>] [-to <pin>] <cells/pins>',
      desc: 'Disables a timing arc of a cell (for example, to break a combinational loop or to exclude an unwanted path through a multiplexer).',
    },
    // ------------------------------------------------------------------ объекты
    get_ports: {
      group: G.obj, tool: BOTH,
      brief: 'Top-level ports',
      syn: 'get_ports [-filter <expression>] [-regexp] [-nocase] [-of_objects <objects>] <patterns>',
      opts: [
        ['<patterns>', '* matches any characters, ? matches one character. Buses are written in braces: {data[*]} (otherwise Tcl tries to execute [*] as a command).'],
        ['-filter', 'For example, {DIRECTION == IN}.'],
      ],
      desc: 'Returns a collection of ports.',
    },
    get_cells: {
      group: G.obj, tool: BOTH,
      brief: 'Cells (instances): registers, buffers, IP blocks',
      syn: 'get_cells [-hierarchical] [-filter <expression>] [-of_objects <objects>] <patterns>',
      opts: [
        ['-hierarchical', 'Search all levels of the hierarchy; the pattern is matched against the local name at each level.'],
        ['-filter', 'For example, {REF_NAME == FDRE && NAME =~ *sync*}.'],
      ],
      desc: 'A register as a cell is a convenient startpoint or endpoint for timing exceptions: -from [get_cells …] means "paths launched by this register", and -to means "paths captured by it".',
      notes: '- Without -hierarchical, the * wildcard does not match the hierarchy separator "/".',
    },
    get_pins: {
      group: G.obj, tool: BOTH,
      brief: 'Cell pins: <cell>/<pin>',
      syn: 'get_pins [-hierarchical] [-filter <expression>] [-of_objects <objects>] <patterns>',
      desc: 'Needed for generated clocks (-source and the definition point), for -through and to specify an exact endpoint (reg/D).',
      notes: '- A startpoint is the clock pin (C), not the Q output.',
    },
    get_nets: {
      group: G.obj, tool: BOTH,
      brief: 'Nets',
      syn: 'get_nets [-hierarchical] [-of_objects <objects>] <patterns>',
      desc: 'Used in -through and in some properties (CLOCK_DEDICATED_ROUTE).',
    },
    get_clocks: {
      group: G.obj, tool: BOTH,
      brief: 'Clocks',
      syn: 'get_clocks [-include_generated_clocks] [-of_objects <pins/cells>] <patterns>',
      opts: [
        ['-of_objects', 'Clocks arriving at a pin: a reliable way to refer to an MMCM clock derived automatically without knowing its name.'],
        ['-include_generated_clocks', 'Add all generated clocks (convenient for set_clock_groups).'],
      ],
    },
    all_inputs: {
      group: G.obj, tool: BOTH,
      brief: 'All input ports (including clock ports!)',
      desc: 'In SDC, it is often used with remove_from_collection to exclude the clock port.',
    },
    all_outputs: { group: G.obj, tool: BOTH, brief: 'All output ports' },
    all_clocks: { group: G.obj, tool: BOTH, brief: 'All clocks' },
    all_registers: {
      group: G.obj, tool: BOTH,
      brief: 'All registers (or their pins)',
      syn: 'all_registers [-clock <clock>] [-data_pins|-clock_pins|-output_pins]',
    },
    remove_from_collection: {
      group: G.obj, tool: BOTH,
      brief: 'Difference of two object collections',
      syn: 'remove_from_collection <collection> <objects_to_remove>',
    },
    // ------------------------------------------------------------------ свойства
    set_property: {
      group: G.prop, tool: VIV,
      brief: 'Physical constraints and attributes: package pins, I/O standards, ASYNC_REG, IOB, configuration',
      syn: 'set_property <PROPERTY> <value> <objects>\nset_property -dict {PROP1 val1 PROP2 val2 …} <objects>',
      opts: [
        ['PACKAGE_PIN', 'Package pin (E3, AA12, etc.). For a differential pair, the P pin only.'],
        ['IOSTANDARD', 'I/O standard: LVCMOS33/25/18, LVDS (HP banks), LVDS_25 (7 series HR banks), SSTL15, TMDS_33, etc.'],
        ['DRIVE / SLEW', 'Drive strength (mA) and slew rate of LVCMOS outputs: SLEW SLOW reduces noise.'],
        ['PULLTYPE / PULLUP', 'Internal pull-up resistor on an input (push buttons without external resistors).'],
        ['DIFF_TERM', 'Internal 100 Ω termination resistor for a differential input.'],
        ['IOB', 'Place the register in the I/O block (stable timing parameters at the pins). Set on the register cell or on the port.'],
        ['ASYNC_REG', 'On all synchronizer registers: place them close together, do not optimize them and take them into account in the mean time between failures (MTBF) calculation.'],
        ['CFGBVS / CONFIG_VOLTAGE', 'Configuration bank voltage (set on [current_design]). Without them, Vivado issues a design rule check (DRC) warning.'],
        ['BITSTREAM.*', 'Bitstream settings: COMPRESS, CONFIGRATE, SPI_BUSWIDTH, etc.'],
      ],
      desc: 'Physical (not timing) XDC constraints. It is common practice to keep them separate from timing constraints.',
    },
    get_property: {
      group: G.prop, tool: BOTH,
      brief: 'Read a property of an object',
      syn: 'get_property <PROPERTY> <object>',
    },
    // ------------------------------------------------------------------ отчёты
    report_clocks: {
      group: G.rep, tool: CON,
      brief: 'List of clocks, including automatically derived clocks',
      desc: 'The first command to run after defining clocks: the report shows the periods, the waveforms and the master clocks of generated clocks.',
    },
    report_clock_interaction: {
      group: G.rep, tool: CON,
      brief: 'Status of the paths between each pair of clocks',
      desc: 'Shows which clock pairs are timed (Timed), excluded (False Path, Asynchronous Groups) or timed unsafely – Timed (unsafe): clocks from different primary sources.',
    },
    check_timing: {
      group: G.rep, tool: CON,
      brief: 'What remains unconstrained',
      desc: 'Registers without a clock, inputs and outputs without delays, incomplete delays, multiple clocks on a pin, generated clocks that could not be created.',
    },
    report_timing: {
      group: G.rep, tool: CON,
      brief: 'Path requirements: launch and capture edges, budget',
      desc: 'ConstraintLab analyzes ideal clocks: the report shows the requirement (edge relationship), the input/output delays and the resulting budget for the path inside the FPGA.',
    },
    report_exceptions: {
      group: G.rep, tool: CON,
      brief: 'Active, overridden and empty timing exceptions',
    },
  };

  // Статьи по id
  const ARTICLES = {
    'art.relationship': {
      title: 'Edge relationship: setup and hold requirements',
      body: `## What a requirement is
For each launch clock → capture clock pair, the EDA tool enumerates the edges of both clocks over their common period (the least common multiple of the periods) and finds:

- the **setup requirement**: the shortest time from an active launch edge to the *nearest following* active capture edge;
- the **hold requirement**: for each setup edge pair, two checks are made: (1) data launched by this edge must not corrupt the capture at the *previous* capture edge; (2) data launched by the *next* launch edge must not corrupt the current capture. The most restrictive (largest) value is selected.

Setup slack = requirement − path delay − register setup time − uncertainty ± clock skew; hold slack is computed in a similar way.

## Examples (ideal clocks)
| Launch → capture | Setup | Hold | Comment |
|---|---|---|---|
| 100 MHz → same clock | 10 | 0 | classic case: one clock cycle |
| rising → falling edge of the same clock (10 ns) | 5 | −5 | half-cycle path |
| 100 MHz → 150 MHz (same MMCM) | 3.333 | 0 | edges at 10 ns and 13.333 ns |
| 125 MHz → 125 MHz shifted by +90° | 2 | −6 | capture 2 ns after launch |
| 50 MHz → 200 MHz | 5 | 0 | nearest edge of the fast clock |
| 200 MHz → 50 MHz | 5 | 0 | last edge of the fast clock before capture |

> **Important:** if the periods are specified manually and are not multiples of each other (for example, 10 and 6.667), a common period may not exist. Vivado reports *unexpandable clocks*, and the requirement may be very small. For clocks of the same MMCM, Vivado derives the periods exactly.

## How to check it in ConstraintLab
The **Path analysis** tab shows the requirements for each edge pair, and clicking a row draws the launch and capture diagram. In the console: \`report_timing -from … -to … -delay_type min_max\`.`,
    },
    'art.input': {
      title: 'Input delay formulas',
      body: `## System-synchronous interface (common oscillator)
Oscillator → (Tcd) → external device; oscillator → (Tcf) → FPGA. The clock is defined on the FPGA port, so the delay is measured from the clock edge **at the FPGA pin**:

\`\`\`text
input_delay_max = Tcd_max + Tco_max + Tdata_max − Tcf_min
input_delay_min = Tcd_min + Tco_min + Tdata_min − Tcf_max
\`\`\`
If the clock traces to both devices are equal, \`Tco + Tdata\` remains.

## Source-synchronous interface, SDR, center-aligned data
The data sheet specifies a window relative to the clock edge at the FPGA pins: data is valid \`tsu\` before the edge and for \`th\` after it.
\`\`\`text
max = T − tsu        # latest change after the previous edge
min = th             # earliest change after the edge
\`\`\`

## SDR, edge-aligned data
Data changes within a ±skew window around the edge: \`max = skew_after\`, \`min = −skew_before\`. Data is captured by the next edge or by an edge of a clock shifted by an MMCM or by an IDELAY delay line.

## DDR, center-aligned data (UG903)
\`\`\`text
set_input_delay -clock C -max [expr {T/2 − dv_bfe}] p        ;# dv_bfe: data valid before the falling edge
set_input_delay -clock C -min dv_are p                         ;# dv_are: data valid after the rising edge
set_input_delay -clock C -max [expr {T/2 − dv_bre}] p -clock_fall -add_delay
set_input_delay -clock C -min dv_afe p -clock_fall -add_delay
\`\`\`
A delay "relative to the rising edge" describes the data captured by the **falling edge**, and vice versa: the reference edge is the LAUNCH edge.

## DDR, edge-aligned data (RGMII without internal delay)
\`\`\`text
max = skew_after_edge, min = −skew_before_edge   (for the rising and the falling edge; the second time with -clock_fall -add_delay)
\`\`\`
plus a 90° shift of the capture clock with an MMCM: Vivado derives the shifted clock automatically.

> **Warning:** the second and subsequent commands for the same port must be written with \`-add_delay\`; otherwise, they replace the previous ones.`,
    },
    'art.output': {
      title: 'Output delay formulas',
      body: `## System-synchronous interface
The FPGA and receiver clocks come from a common oscillator. The delay is measured from the clock edge at the FPGA pin:
\`\`\`text
output_delay_max = Tdata_max + Tsu − (Tcd_min − Tcf_max)
output_delay_min = Tdata_min − Th  − (Tcd_max − Tcf_min)
\`\`\`
With equal clock traces: \`max = Tdata_max + Tsu\`, \`min = Tdata_min − Th\` (usually a negative number).

## Source-synchronous interface (the FPGA forwards the clock to the receiver)
The clock is forwarded from the FPGA through an ODDR and is described by a **generated clock on the output port**:
\`\`\`text
create_generated_clock -name fwd_clk -source [get_pins clk_oddr/C] -divide_by 1 [get_ports clk_out]
set_output_delay -clock fwd_clk -max [expr {Tsu + Tdata_max − Tclk_min}] [get_ports {d[*]}]
set_output_delay -clock fwd_clk -min [expr {Tdata_min − Th − Tclk_max}]  [get_ports {d[*]}]
\`\`\`
The clock delay through the ODDR and OBUF is taken into account automatically and compensates for the data delay through the same primitives.

## DDR
Four commands: -max and -min for the rising edge and for the falling edge (\`-clock_fall -add_delay\`). If the clock is shifted by 90° (center-aligned with the data), the checks between unintended edge pairs are less restrictive; to keep the reports clean, they can be excluded with \`set_false_path -setup -rise_from … -fall_to …\`, etc.`,
    },
    'art.mcp': {
      title: 'Correct multicycle path constraints',
      body: `## Single clock
\`\`\`text
set_multicycle_path N   -setup -from A -to B
set_multicycle_path N-1 -hold  -from A -to B
\`\`\`
After \`-setup N\`, the capture edge moves by N−1 periods, and **the hold check moves along with it**. Without \`-hold N-1\`, the hold requirement becomes (N−1)·T: a violation is almost inevitable.

## Different related clocks
| Direction | Setup | Hold |
|---|---|---|
| slow to fast (data is stable for N cycles of the fast clock) | \`N -setup -end\` | \`N-1 -hold -end\` |
| fast to slow (launch once every N cycles of the fast clock) | \`N -setup -start\` | \`N-1 -hold -start\` |

By default, the -setup shift is counted in periods of the capture clock (**-end**), and the -hold shift in periods of the launch clock (**-start**). Therefore, a slow-to-fast transfer requires \`-hold -end\`; otherwise, the hold check moves by periods of the slow clock.

## When a multicycle path does not apply
- the data changes every cycle (no enable signal): this is simply a long path that must be optimized or pipelined;
- the clocks are asynchronous: this is a clock domain crossing (synchronizers plus a false path or a maximum delay constraint).`,
    },
    'art.cdc': {
      title: 'Clock domain crossing: what to constrain',
      body: `| Crossing type | Constraint | Comment |
|---|---|---|
| 1 bit through 2–3 flip-flops | \`ASYNC_REG TRUE\` on all stages + \`set_false_path -to sync[0]\` (or \`set_max_delay -datapath_only\`) | the synchronizer resolves metastability |
| Gray code (FIFO pointers) | \`set_max_delay -datapath_only T_src\` + \`set_bus_skew\` | the bits must arrive together; the clocks need not be synchronous |
| Handshake bus (req/ack) | maximum delay constraint on the data and synchronizers for req/ack | the data is stable by the time it is captured |
| Quasi-static signals (configuration) | \`set_false_path\` | change only in the idle state |
| XPM_CDC / XPM_FIFO | nothing: the macro contains its own constraints | do **not** override them with \`set_clock_groups\` |
| Related clocks of the same MMCM | regular timing analysis (or a multicycle path) | this is not an asynchronous crossing |

> **Warning:** \`set_clock_groups -asynchronous\` and \`set_false_path\` between clocks take priority over \`set_max_delay\`. If the design contains Gray-coded buses or XPM macros, a global exception disables their constraints as well.`,
    },
    'art.priority': {
      title: 'Timing exception priority',
      body: `If several timing exceptions apply to the same path:

1. **set_clock_groups** (highest priority)
2. **set_false_path**
3. **set_max_delay / set_min_delay**
4. **set_multicycle_path** (lowest priority)

Within the same type, the **more specific** exception wins: one specified on pins and cells takes precedence over one specified on clocks, and -from takes precedence over -to. With equal specificity, the last one in order applies.

To check: \`report_exceptions\` shows which exceptions are in effect, which are overridden and which cover no paths.`,
    },
    'art.vivado_vs_sdc': {
      title: 'Vivado XDC and ASIC SDC: differences',
      body: `| Topic | Vivado XDC | SDC (DC, PrimeTime, Innovus, OpenSTA) |
|---|---|---|
| MMCM/PLL outputs | derived automatically | \`create_generated_clock\` written manually |
| Clock tree | always with actual latency (propagated) | ideal before clock tree synthesis (latency, transition, uncertainty), \`set_propagated_clock\` after it |
| Clock domain crossing | \`set_max_delay -datapath_only\`, \`set_bus_skew\` | maximum delay constraint and a separate structural CDC check |
| Block environment | not required (the I/O buffers are known) | \`set_driving_cell\`, \`set_load\`, \`set_max_transition\` |
| Physical constraints | \`set_property PACKAGE_PIN/IOSTANDARD …\` | in separate files (floorplan, pin placement) |
| Tcl in the constraint file | XDC allows only \`set\`, \`list\`, \`expr\`; loops go into an unmanaged Tcl file | full Tcl |
| Command order | matters: an object must exist before it is referenced | the same |`,
    },
    'art.points': {
      title: 'Startpoints, endpoints and through points',
      body: `- **Startpoint:** an input port or a register clock pin (\`reg/C\`). The register itself (\`[get_cells reg]\`) also works.
- **Endpoint:** an output port or a register data pin (\`reg/D\`, \`CE\`, \`R\`, \`CLR\`, etc.). A register as a cell means all of its data inputs.
- **Through point (-through):** any pin, net or combinational cell on the path.

Common mistakes:
- \`-from [get_pins reg/Q]\`: the Q output is not a startpoint (the exception may not take effect);
- \`-to [get_pins reg/C]\`: the clock pin is not an endpoint;
- \`get_ports data[*]\` without braces: Tcl tries to execute \`[*]\` as a command (Vivado tolerates this, but the notation is unreliable).`,
    },
  };

  // Объекты меняются на месте, поэтому карта byName остаётся верной
  for (const c of XT.refdocs.CMDS) if (CMDS[c.name]) Object.assign(c, CMDS[c.name]);
  for (const a of XT.refdocs.ARTICLES) if (ARTICLES[a.id]) Object.assign(a, ARTICLES[a.id]);
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
