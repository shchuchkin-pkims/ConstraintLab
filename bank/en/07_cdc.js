/* English translation of bank/07_cdc.js (module 7: clock domain crossing) */
XT.bank.i18n('en', {
  modules: {
    cdc: {
      title: '7. Clock domain crossing',
      about: 'synchronizers and ASYNC_REG, targeted false paths, Gray code: set_max_delay -datapath_only and set_bus_skew, the set_clock_groups trap with XPM macros, related clocks',
    },
  },
  questions: {
    'cdc.sync1': {
      title: 'Single-bit flag: two-flip-flop synchronizer',
      langNote: 'A targeted `set_false_path` is the same in XDC and SDC, while `ASYNC_REG` exists only in Vivado.',
      tags: ['set_false_path', 'ASYNC_REG', 'synchronizer', 'metastability'],
      text: `
        The busy flag \`busy_reg\` is generated in the \`clk_a\` domain (**100 MHz**) and passed to the \`clk_b\` domain (**80 MHz**) through the two-flip-flop synchronizer \`busy_sync_reg[0]\` → \`busy_sync_reg[1]\`. The clocks come from separate crystal oscillators: their phase relationship is random and slowly drifts.

        Along with the flag, the status bus \`stat_reg[3:0]\` crosses into the \`clk_b\` domain. The destination register \`stat_q_reg[3:0]\` loads it only when the synchronized flag shows \`busy = 0\`, by which time the bus has long been stable. The bus is already constrained: see \`set_max_delay -datapath_only\` in the "Already in the project" box. The design does not use clock groups: each path between the domains is constrained individually.

        **Task.** Use a false path to exclude only the \`busy_reg → busy_sync_reg[0]\` path, and mark both synchronizer stages with the \`ASYNC_REG\` property.
      `,
      strings: {
        'контроллер': 'controller',
        'НЕ': 'NOT',
        'вторая ступень': 'second stage',
        '2,5 нс': '2.5 ns',
        'время на разрешение метастабильности': 'metastability resolution time',
      },
      figures: [
        {
          title: 'Without an exception: a random edge pair 2.5 ns apart',
          caption: 'If the clocks are treated as related, Vivado finds a pair of edges 2.5 ns apart over the 50 ns common period. In reality the separation is random and can be arbitrarily small: the first stage occasionally captures a transition inside its setup window (hatched). The second stage gives it a full clk_b period to resolve the metastable state.',
        },
      ],
      code: {
        given: `create_clock -name clk_a -period 10.000 [get_ports clk_a]
create_clock -name clk_b -period 12.500 [get_ports clk_b]
# status bus: datapath delay constraint
set_max_delay -datapath_only -from [get_cells {stat_reg[*]}] -to [get_cells {stat_q_reg[*]}] 10.000`,
      },
      hints: [
        'The endpoint of the exception is the first synchronizer stage: `-to [get_cells {busy_sync_reg[0]}]`. The startpoint can be omitted or given as the cell `busy_reg` (not its Q pin!).',
        'Do not declare the clocks asynchronous and do not exclude all clk_a → clk_b paths: that would override the `set_max_delay` on the `stat_reg` bus.',
        'The property: `set_property ASYNC_REG TRUE [get_cells {busy_sync_reg[*]}]` covers both stages.',
      ],
      explain: `
        \`\`\`
        set_property ASYNC_REG TRUE [get_cells {busy_sync_reg[*]}]
        set_false_path -to [get_cells {busy_sync_reg[0]}]
        \`\`\`
        **Why the path to the first stage is not timed.** The two oscillators have no fixed relationship, so any requirement for the \`busy_reg → busy_sync_reg[0]\` path is arbitrary. Treating the clocks as related, Vivado would find a pair of edges 2.5 ns apart over the 50 ns common period (launch at 10 ns, capture at 12.5 ns), while in reality the separation can be arbitrarily small. Sooner or later the first stage captures a transition inside its setup or hold window. This is expected: it is exactly what the synchronizer is for. Without the exception, \`report_clock_interaction\` would show the \`clk_a → clk_b\` pair as *Timed (unsafe)*.

        **Metastability and MTBF.** When its capture window is violated, \`busy_sync_reg[0]\` can stay in an intermediate state for some time. The second stage samples its output a full \`clk_b\` period later, and by then the state has almost certainly resolved. The mean time between failures (MTBF) grows exponentially with the resolution time, so the \`busy_sync_reg[0] → busy_sync_reg[1]\` path **remains** timed: the smaller its delay, the larger the slack.

        **ASYNC_REG.** The property tells Vivado that the flip-flops form a synchronizer: they are placed close together (in the same slice), are not packed into an SRL shift register, and are not replicated or removed by optimization; \`report_cdc\` classifies the structure as "1-bit synchronized with ASYNC_REG property".

        **Why not set_clock_groups.** Clock groups would disable all paths between \`clk_a\` and \`clk_b\` and, having the highest priority, would override the \`set_max_delay\` on the \`stat_reg\` bus. A clock-to-clock false path would do the same: a false path takes precedence over a delay constraint. A targeted false path affects only the synchronizer input.

        **Alternative: set_max_delay -datapath_only.** Designs with strict requirements on synchronization latency constrain the datapath delay instead of using a false path: \`set_max_delay -datapath_only -from [get_cells busy_reg] -to [get_cells {busy_sync_reg[0]}] 10.000\`. The router then cannot route the path across half the chip, and the flag latency stays predictable. Both options are acceptable for a single-bit flag; this task asks for a false path.

        Common mistakes:
        - \`-from [get_pins busy_reg/Q]\`: the Q output is not a valid startpoint, so Vivado issues a warning and ignores the exception; the path is still timed with the 2.5 ns requirement;
        - \`-to [get_cells {busy_sync_reg[1]}]\`: this excludes the path between the stages (which must be timed) and leaves the synchronizer input timed;
        - no \`ASYNC_REG\`: the stages can end up far apart or in an SRL, and the MTBF drops sharply.

        Check in Vivado: \`report_exceptions\` shows that the new exception covers one path and the \`set_max_delay\` on the bus is still in effect; \`report_timing -from [get_cells busy_reg]\` shows that the path is not timed; \`report_cdc -details\` shows that the synchronizer is recognized.
      `,
      refs: 'UG903, section "Constraining Clock Domain Crossings"; UG906, report_cdc; UG912, ASYNC_REG property; Reference: "Clock domain crossing: what to constrain"',
    },

    // -------------------------------------------------------------------------
    'cdc.gray': {
      title: 'Gray-coded FIFO pointer: set_max_delay -datapath_only and set_bus_skew',
      langNote: '`set_max_delay -datapath_only`, `set_bus_skew` and `ASYNC_REG` exist in this form only in XDC. In an ASIC flow, a Gray-code crossing is constrained with tool-specific commands and verified by structural CDC analysis.',
      tags: ['set_max_delay -datapath_only', 'set_bus_skew', 'Gray code', 'asynchronous FIFO', 'ASYNC_REG'],
      text: `
        In a custom asynchronous FIFO, the Gray-coded write pointer \`wptr_gray_reg[3:0]\` (\`wr_clk\` domain, **125 MHz**) is passed to the \`rd_clk\` domain (**100 MHz**, independent oscillator) through the two-stage synchronizer \`wptr_sync1_reg[3:0]\` → \`wptr_sync2_reg[3:0]\`. The read logic compares the synchronized pointer with its own and generates the "FIFO empty" flag.

        Adjacent Gray-code values differ in one bit, so even if the first stage captures a transition "at the boundary", the destination gets either the old or the new pointer value. This holds only while the bit delays to the first stage are close to each other and shorter than the source clock period: otherwise the pointer changes again while a bit is still in flight, and the destination receives a mix of bits from different values.

        **Task.**
        1. Mark both synchronizer stages with the \`ASYNC_REG\` property.
        2. Constrain the delay of the \`wptr_gray_reg → wptr_sync1_reg\` paths to the source clock period, the way paths between asynchronous domains are normally constrained.
        3. Constrain the skew of this bus (the spread of the bit delays) to the smaller of the two periods.
      `,
      strings: {
        'логика записи': 'write logic',
        'логика чтения': 'read logic',
        'домен wr_clk (125 МГц)  →  домен rd_clk (100 МГц)': 'wr_clk domain (125 MHz)  →  rd_clk domain (100 MHz)',
        'разряд 0 у sync1': 'bit 0 at sync1',
        'разряд 1 у sync1': 'bit 1 at sync1',
        'запуск 0011': 'launch 0011',
        'приход разряда 1': 'bit 1 arrives',
        'd1 = 6 нс': 'd1 = 6 ns',
        'd0 = 2 нс': 'd0 = 2 ns',
      },
      figures: [
        {
          title: 'Bit delays of 2 and 6 ns: both under 8 ns, skew 4 ns',
          caption: 'Each bit reaches the first stage in less than the source period (8 ns), and the spread of the bit delays (6 − 2 = 4 ns) is less than the smaller period. Changes arrive in the order in which the source issued them, and at any rd_clk edge at most one bit is changing at the first-stage inputs: the synchronizer outputs either the old or the new pointer value.',
        },
      ],
      hints: [
        'A false path does not work here: it removes all constraints, while a Gray-coded bus needs a bounded delay. Paths between asynchronous domains are constrained with `set_max_delay` plus an option that excludes the clock trees from the calculation and disables the hold check.',
        'The source clock `wr_clk` has an 8 ns period; the smaller of the two periods is also 8 ns. Skew is constrained with `set_bus_skew -from … -to … <value>`.',
        '`set_max_delay -datapath_only -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000` and `set_bus_skew` with the same objects and a value of 8.000; plus ASYNC_REG on `wptr_sync1_reg[*]` and `wptr_sync2_reg[*]`.',
      ],
      explain: `
        \`\`\`
        set_property ASYNC_REG TRUE [get_cells {wptr_sync1_reg[*] wptr_sync2_reg[*]}]
        set_max_delay -datapath_only -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000
        set_bus_skew -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000
        \`\`\`
        **Why not a false path.** Gray code guarantees that only one bit changes per step, but only at the output of \`wptr_gray_reg\`. Without constraints, the router may route one bit across half the chip: while that bit is in flight, the pointer changes again, and the first stage captures a mix of bits from two different values. The pointer "jumps", and the read logic outputs a word that has not been written yet. A false path removes all constraints, while a bounded delay is needed here.

        **set_max_delay 8 ns.** The delay of each bit does not exceed the source period: while a new value travels to the destination, the pointer changes at most once.

        **-datapath_only.** The clocks are asynchronous, so comparing their clock tree delays is meaningless. The option removes the source and destination clock delays from the calculation, leaving only the datapath (Tco, routing, logic), and disables the hold check: a hold requirement between asynchronous clocks is arbitrary. Without \`-datapath_only\`, Vivado would check hold against the requirement derived from the common period (0 ns here) and would include the clock tree skew.

        **set_bus_skew.** The delay constraint does not prevent one bit from arriving after 1 ns and another after 7.9 ns. \`set_bus_skew\` constrains exactly the spread of the bit arrival times at the first stage, which is the key correctness condition for a Gray-coded bus. The value is the smaller of the two periods, as in the XPM_CDC_GRAY macro. This is not a timing exception but a separate check; its results are shown by \`report_bus_skew\`.

        **Ready-made solution.** The \`xpm_cdc_gray\` macro (and the \`xpm_fifo_async\` asynchronous FIFO) contains the synchronizer and creates exactly these constraints automatically. Custom logic has to be constrained by hand.

        **The danger of global exceptions.** \`set_clock_groups -asynchronous\` and a clock-to-clock \`set_false_path\` take precedence over \`set_max_delay\`: if someone later declares the domains asynchronous "just in case", the delay constraint stops working (the skew check remains, but the delay becomes unconstrained).

        Common mistakes:
        - \`set_false_path\` instead of \`set_max_delay\`: the bit delays are unconstrained;
        - \`set_max_delay\` without \`-datapath_only\`: hold is checked between asynchronous clocks, and the clock trees are included;
        - a value of 10 ns (the destination period): within 10 ns the source pointer can change once more (its period is 8 ns);
        - no \`set_bus_skew\`: the bits can arrive with a spread of almost a full period.

        Check in Vivado: \`report_timing -from [get_cells {wptr_gray_reg[0]}] -to [get_cells {wptr_sync1_reg[0]}]\` shows an 8 ns requirement without clock tree delays; \`report_bus_skew\` shows the bus skew check; \`report_cdc\` lists the recognized synchronizers.
      `,
      refs: 'UG903, sections "Constraining Clock Domain Crossings" and "Set Bus Skew"; UG974, XPM_CDC_GRAY and XPM_FIFO_ASYNC macros; Reference: "Clock domain crossing: what to constrain"',
    },

    // -------------------------------------------------------------------------
    'cdc.xpm_trap': {
      title: 'Find the error: set_clock_groups overrides the XPM constraints',
      langNote: 'XPM macros and their constraints are specific to Vivado; the principle itself (global clock groups override targeted constraints) holds for SDC as well.',
      tags: ['set_clock_groups', 'XPM_FIFO_ASYNC', 'exception priority', 'find the error'],
      text: `
        The design has two independent clocks: \`clk_a\` (**100 MHz**) and \`clk_b\` (**125 MHz**). Data crosses between them through the asynchronous FIFO \`u_fifo\`, an XPM_FIFO_ASYNC macro. The Gray-coded FIFO pointers pass through synchronizers inside the macro, and the macro itself adds \`set_max_delay -datapath_only\` and \`set_bus_skew\` constraints for them. These are shown in the "Already in the project" box; the register names are simplified, and the schematic shows only the write pointer (the read pointer crosses in the opposite direction the same way).

        In addition, the designer built a custom two-flip-flop synchronizer for the flag \`flag_reg\` → \`flag_sync_reg[0]\` → \`flag_sync_reg[1]\`; its ASYNC_REG property is already set. To "get rid of the clock domain crossing violations", the designer added a single command to their own XDC file; it is in the editor.

        **Task.** Fix the user constraints: the macro constraints must stay in effect, and the path to the first stage of the custom synchronizer must be excluded from timing analysis.
      `,
      strings: {
        'запись': 'write',
        'указатель чтения rd → wr не показан': 'read pointer rd → wr not shown',
        'приложение': 'application',
        'с set_max_delay': 'with set_max_delay',
        'с set_clock_groups': 'with set_clock_groups',
        'запуск указателя': 'pointer launch',
        'задержка тракта ≤ 10 нс': 'datapath delay ≤ 10 ns',
        'задержка не ограничена': 'delay unconstrained',
      },
      figures: [
        {
          title: 'Priority: clock groups override the delay constraint',
          caption: 'With the macro constraint, the write pointer must reach the first synchronizer stage within one clk_a period. After set_clock_groups the path is excluded entirely: the router is free to route the bits any way it likes, and the FIFO occasionally loses or duplicates words.',
        },
      ],
      code: {
        given: `create_clock -name clk_a -period 10.000 [get_ports clk_a]
create_clock -name clk_b -period 8.000 [get_ports clk_b]
# --- XPM_FIFO_ASYNC macro constraints (applied automatically) ---
set_max_delay -datapath_only -from [get_cells {u_fifo/wr_gray_reg[*]}] -to [get_cells {u_fifo/rd_sync1_reg[*]}] 10.000
set_bus_skew -from [get_cells {u_fifo/wr_gray_reg[*]}] -to [get_cells {u_fifo/rd_sync1_reg[*]}] 8.000
set_max_delay -datapath_only -from [get_cells {u_fifo/rd_gray_reg[*]}] -to [get_cells {u_fifo/wr_sync1_reg[*]}] 8.000
set_bus_skew -from [get_cells {u_fifo/rd_gray_reg[*]}] -to [get_cells {u_fifo/wr_sync1_reg[*]}] 8.000
set_property ASYNC_REG TRUE [get_cells {u_fifo/rd_sync1_reg[*] u_fifo/rd_sync2_reg[*] u_fifo/wr_sync1_reg[*] u_fifo/wr_sync2_reg[*]}]
# --- flag synchronizer ---
set_property ASYNC_REG TRUE [get_cells {flag_sync_reg[*]}]`,
        starter: `# the clk_a and clk_b domains are independent
set_clock_groups -asynchronous -group [get_clocks clk_a] -group [get_clocks clk_b]`,
      },
      hints: [
        'Recall the timing exception priority: which takes precedence, `set_clock_groups` or `set_max_delay`?',
        'Any global exception between `clk_a` and `clk_b` (clock groups, clock-to-clock false paths) also disables the FIFO pointer paths. Exclude only what really needs to be excluded.',
        'Remove `set_clock_groups` and add `set_false_path -to [get_cells {flag_sync_reg[0]}]`.',
      ],
      explain: `
        \`\`\`
        set_false_path -to [get_cells {flag_sync_reg[0]}]
        \`\`\`
        **What was wrong.** \`set_clock_groups\` is the timing exception with the highest priority, and it applies to **all** paths between the groups in both directions. This includes the FIFO pointer paths for which the macro set \`set_max_delay -datapath_only\`: after the designer's command, Vivado no longer constrains their delay (\`report_exceptions\` lists the macro constraints as overridden). Synchronization of Gray-coded pointers is correct only while the bit delays are shorter than the period; without the constraint, the router is free to route a bit along an arbitrarily long path. The FIFO then occasionally loses or duplicates words, and the failure shows up only on some boards, at a particular temperature, or after another recompilation.

        \`set_bus_skew\` is not a timing exception but a separate check: clock groups do not cancel it, and \`report_bus_skew\` keeps working. But the datapath delay constraint is gone, and with it the guarantee that the pointer does not change again while a bit is in flight.

        **The right way.** Remove the global exception and exclude only the input of the custom synchronizer, with a targeted exception. The paths inside the macro are constrained by its own commands; any \`clk_a → clk_b\` paths the designer did not think of will then show up in the reports as *Timed (unsafe)*, which is useful: each such crossing must be reviewed and constrained deliberately.

        A pair of clock-to-clock \`set_false_path\` commands in both directions would do the same: a false path also takes precedence over \`set_max_delay\`. Hence the recommendation for designs with XPM_CDC and XPM_FIFO_ASYNC: do not declare the clocks asynchronous as a whole; constrain your own crossings with targeted constraints (\`set_false_path\` or \`set_max_delay -datapath_only\` to the first synchronizer stage).

        Check in Vivado: \`report_exceptions\` shows the macro constraints in effect rather than overridden; \`report_clock_interaction\` no longer shows the \`clk_a ↔ clk_b\` pairs as *Asynchronous Groups*; \`report_cdc\` recognizes both synchronization schemes; \`report_methodology\` (TIMING checks) reports suspicious clock domain crossings, such as synchronizers without ASYNC_REG.
      `,
      refs: 'UG903, sections "Exceptions Priority" and "Constraining Clock Domain Crossings"; UG974, XPM_FIFO_ASYNC and XPM_CDC; Reference: "Timing exception priority"',
    },

    // -------------------------------------------------------------------------
    'cdc.related': {
      title: 'Related domains 100 → 150 MHz: the 3.333 ns requirement is violated',
      langNote: 'The reasoning is general: clocks from one PLL are related both in an FPGA and in an ASIC.',
      tags: ['related clocks', 'MMCM', 'understanding'],
      text: `
        The Clocking Wizard IP generates the clocks \`clk_a\` (**100 MHz**) and \`clk_b\` (**150 MHz**) from one input clock. A processing result travels from the registers \`src_reg[15:0]\` (\`clk_a\` domain) through combinational scaling logic and is written to the registers \`dst_reg[15:0]\` (\`clk_b\` domain).

        \`report_timing\` shows a setup requirement of **3.333 ns** and negative slack for the \`src_reg → dst_reg\` paths: the logic delay is about 5 ns.

        **Task.** Select all correct actions.
      `,
      strings: {
        'CLKOUT0: 100 МГц': 'CLKOUT0: 100 MHz',
        'CLKOUT1: 150 МГц': 'CLKOUT1: 150 MHz',
        'масштаб': 'scaling',
        '3,333 нс': '3.333 ns',
        'задержка логики ≈ 5 нс': 'logic delay ≈ 5 ns',
        'нарушение': 'violation',
      },
      figures: [
        {
          title: 'Clocks from one MMCM: the worst edge pair',
          caption: 'The clock phases are locked, and the 10 ns → 13.333 ns edge pair repeats every 20 ns. This is a real requirement: data launched by the clk_a edge at 10 ns is captured by the clk_b edge at 13.333 ns.',
        },
      ],
      hints: [
        'Are clocks generated by the same MMCM related? Does the 3.333 ns requirement reflect the real behavior of the circuit?',
        'A correct action either changes the circuit or accurately describes its real behavior. "Hiding" the path from the report is not a solution.',
      ],
      options: [
        { text: 'Declare the clocks asynchronous: `set_clock_groups -asynchronous -group clk_a -group clk_b`.', why: 'Incorrect. Clocks from one MMCM are synchronous, and the path really must fit within 3.333 ns. Clock groups would only remove the violation from the report, while the hardware would capture corrupted data; moreover, a 16-bit bus without a synchronizer is not a valid asynchronous crossing either.' },
        { text: 'If the source updates the data at most once every few cycles and the destination captures it with an enable signal at an agreed moment, declare the path a multicycle path: `set_multicycle_path` with the matching `-hold` command and the correct `-start`/`-end` option.', why: 'Correct, provided the condition holds: the multicycle path then describes the real behavior of the circuit. Without such a guarantee in the design logic, it would merely hide a bug.' },
        { text: 'Change the design: move the scaling logic into one of the domains (before the source register or after the destination register), so that only a direct register-to-register path crosses between the domains.', why: 'Correct. A direct register-to-register path easily fits within 3.333 ns, and the logic gets the full period of its own clock. This is the primary fix.' },
        { text: 'Increase the period in `create_clock` (or define the MMCM clocks manually with a longer period) to make the requirement larger.', why: 'Incorrect. Constraints must describe the real frequencies: the report turns "green", while the circuit keeps running at the original frequency with violations. Vivado derives the MMCM clocks itself from the block settings.' },
        { text: 'Add a two-flip-flop synchronizer on every bit of the bus and exclude the paths with `set_false_path`.', why: 'Incorrect. Related clocks do not need a synchronizer, and for multi-bit data it is plainly wrong: the bits can pass through the synchronizer in different cycles, and the destination sees a value that never existed.' },
      ],
      explain: `
        Clocks from one MMCM are **related**: their phases are fixed, and within the 20 ns common period the 10 ns → 13.333 ns edge pair always recurs. The 3.333 ns requirement is not an artifact of the analysis but the real time that the circuit allows for the path. That is why any way of "hiding" the path (clock groups, a false path, a wrong period) leaves the bug in the hardware.

        Correct approaches:
        1. **Change the circuit**: move the logic to one side of the domain boundary and add a pipeline register. This is the primary option.
        2. **Multicycle path**: only if the design logic guarantees that the data stays stable for several cycles and the destination captures it at a known moment (an enable that is synchronous with the clock phase). For 100 → 150 MHz the frequency ratio is not an integer, and aligning the capture moment is harder than for 50 → 200 MHz: the multipliers and the \`-start\`/\`-end\` options have to be chosen carefully.

        Asynchronous techniques (synchronizers, asynchronous FIFOs, \`set_clock_groups\`) are meant for independent clocks. For related clocks they are either unnecessary or mask real violations. The exception is a case where the frequency ratio is awkward and it is simpler to go through an asynchronous FIFO; the FIFO macro then provides its own constraints, and global clock groups are still not needed.

        Check: \`report_clock_interaction\` shows the \`clk_a → clk_b\` pair as *Timed* (without the unsafe mark), which means the clocks are related; \`report_timing -from [get_cells {src_reg[0]}] -to [get_cells {dst_reg[0]}]\` shows the 3.333 ns requirement.
      `,
      refs: 'UG903, section "Clock Relationships"; UG949, guidelines for paths between synchronous clock domains; Reference: "Edge relationship: setup and hold requirements"',
    },
  },
});
