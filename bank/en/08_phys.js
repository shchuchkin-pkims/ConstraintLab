/* English translation of bank/08_phys.js (module 8: XDC physical constraints) */
XT.bank.i18n('en', {
  modules: {
    phys: {
      title: '8. XDC physical constraints',
      about: 'Package pin and I/O standard assignment, differential inputs and internal termination, registers in I/O blocks, configuration settings, DRIVE and SLEW',
    },
  },
  questions: {
    'phys.pins': {
      title: 'Pin and I/O standard assignment on a development board',
      langNote: 'Package pins and I/O standards are assigned in XDC; in an ASIC, they are not part of SDC but are defined by the I/O cell instances and the die floorplan.',
      text: `
        A development board with a 7 series FPGA: a 100 MHz oscillator, four LEDs, two push buttons and a USB–UART bridge are connected to the package pins. The connection table from the board documentation:

        | Design port | Package pin | Connected to |
        |---|---|---|
        | \`sys_clk\` | E3 | 100 MHz oscillator |
        | \`led[0]\` | H17 | LED 0 |
        | \`led[1]\` | K15 | LED 1 |
        | \`led[2]\` | J13 | LED 2 |
        | \`led[3]\` | N14 | LED 3 |
        | \`btn[0]\` | M18 | button 0 |
        | \`btn[1]\` | P17 | button 1 |
        | \`uart_tx\` | D4 | FPGA output → bridge RXD input |
        | \`uart_rx\` | C4 | bridge TXD output → FPGA input |

        All these pins are in banks powered at VCCO = 3.3 V, so all ports use the **LVCMOS33** I/O standard.

        Until the pins are assigned, Vivado will not generate a bitstream: the DRC run by \`write_bitstream\` stops on ports without an I/O standard (NSTD-1) and without a package pin (UCIO-1). The \`sys_clk\` clock is already defined.

        **Task.** Assign a package pin (\`PACKAGE_PIN\`) and an I/O standard (\`IOSTANDARD\`) to every port.
      `,
      strings: {
        '100 МГц': '100 MHz',
        'логика проекта': 'design logic',
      },
      hints: [
        'Each port needs two properties: PACKAGE_PIN (the package pin) and IOSTANDARD (the I/O standard). Both can be set in one command with -dict.',
        'Bus bits are assigned one at a time: led[0] and led[1] go to different pins. Enclose the bit name in braces: `[get_ports {led[0]}]`; otherwise Tcl tries to execute `[0]` as a command.',
        'Template: `set_property -dict {PACKAGE_PIN H17 IOSTANDARD LVCMOS33} [get_ports {led[0]}]`, and the same for each of the nine ports.',
      ],
      explain: `
        \`\`\`
        set_property -dict {PACKAGE_PIN E3  IOSTANDARD LVCMOS33} [get_ports sys_clk]
        set_property -dict {PACKAGE_PIN H17 IOSTANDARD LVCMOS33} [get_ports {led[0]}]
        set_property -dict {PACKAGE_PIN K15 IOSTANDARD LVCMOS33} [get_ports {led[1]}]
        set_property -dict {PACKAGE_PIN J13 IOSTANDARD LVCMOS33} [get_ports {led[2]}]
        set_property -dict {PACKAGE_PIN N14 IOSTANDARD LVCMOS33} [get_ports {led[3]}]
        set_property -dict {PACKAGE_PIN M18 IOSTANDARD LVCMOS33} [get_ports {btn[0]}]
        set_property -dict {PACKAGE_PIN P17 IOSTANDARD LVCMOS33} [get_ports {btn[1]}]
        set_property -dict {PACKAGE_PIN D4  IOSTANDARD LVCMOS33} [get_ports uart_tx]
        set_property -dict {PACKAGE_PIN C4  IOSTANDARD LVCMOS33} [get_ports uart_rx]
        \`\`\`
        - **PACKAGE_PIN** is the package pin the port is connected to. Take it from the board schematic or the board constraints file: Vivado cannot determine it by itself.
        - **IOSTANDARD** is the I/O standard: voltage levels, input switching thresholds and output buffer characteristics. The standard must match the bank VCCO: LVCMOS33 requires banks with VCCO = 3.3 V.
        - **Bus bits** are assigned individually, each to its own pin. The braces in \`{led[0]}\` are mandatory: without them, Tcl treats \`[0]\` as command substitution.
        - The \`-dict\` form sets several properties in one command; separate \`set_property\` commands for each property are equivalent. The I/O standard is often assigned to a group of ports at once: \`set_property IOSTANDARD LVCMOS33 [get_ports {led[*] btn[*]}]\`.

        **Common mistakes.**
        - **LVCMOS25 in a 3.3 V bank.** Vivado does not know the actual VCCO on the board: it infers it from the I/O standards of the ports. If a bank contains standards with different VCCO, DRC reports a bank voltage conflict (BIVC-1). If the wrong standard is assigned to all ports of the bank, only the board reveals the error: the input thresholds and output characteristics are set up for 2.5 V while the bank actually runs at 3.3 V.
        - **A typo in the property name** (\`IOSTANDART\`): Vivado reports that the port has no such property, the standard remains unassigned, and \`write_bitstream\` stops on NSTD-1.
        - **Swapped bit pins** are caught by neither DRC nor timing analysis: the LEDs simply light up in the wrong order. Check the assignments against the board schematic.
        - **A pin list for the whole bus** (\`set_property PACKAGE_PIN {H17 K15 J13 N14} [get_ports {led[*]}]\`): every bit gets the entire string, which is not a pin name.

        Buttons, LEDs and a low-speed UART usually get no I/O timing constraints (or their paths are declared false paths): the signals are asynchronous and are synchronized inside the FPGA, like the buttons here by the \`btn_sync_reg\` registers.

        **Check in Vivado:** \`report_io\` lists the ports with their pins, banks and I/O standards; \`report_drc\` shows no NSTD-1 or UCIO-1; the I/O Planning view shows the port placement on the package.
      `,
      refs: 'UG903, chapter "Physical Constraints" (PACKAGE_PIN, IOSTANDARD); UG912 (property reference); UG471 (7 series I/O standards)',
    },

    // -------------------------------------------------------------------------
    'phys.lvds_in': {
      title: 'LVDS differential input: I/O standard and termination',
      langNote: 'These are FPGA I/O properties; in an ASIC, the I/O standard and termination are determined by the selected I/O cell.',
      text: `
        A **200 MHz** reference oscillator with an LVDS output is connected to a clock-capable pin pair of the FPGA: the P line to pin **AD12** (port \`clk200_p\`), the N line to pin **AD11** (port \`clk200_n\`). Inside the FPGA the pair drives an \`IBUFDS\` buffer, followed by a \`BUFG\`. The \`clk200\` clock is already defined.

        The pair is in an **HP** (high-performance) bank of a 7 series FPGA, with a bank supply voltage VCCO = **1.8 V**. There is **no** external 100 Ω termination resistor between the lines of the pair on the board.

        **Task.** Set the physical constraints of the input: package pin, I/O standard and internal termination.
      `,
      strings: {
        'Генератор LVDS 200 МГц': 'LVDS oscillator 200 MHz',
        'обработка': 'processing',
        'банк HP, VCCO = 1,8 В\nрезистора 100 Ом на плате нет': 'HP bank, VCCO = 1.8 V\nno 100 Ω resistor on the board',
      },
      hints: [
        'For a differential pair, constraints are set on the P port: Vivado assigns the N pin automatically.',
        'The LVDS standard (no suffix) is for HP banks with VCCO = 1.8 V; LVDS_25 is for HR banks with VCCO = 2.5 V.',
        'Without an external resistor, internal termination is required: `DIFF_TERM TRUE`. Result: `set_property -dict {PACKAGE_PIN AD12 IOSTANDARD LVDS DIFF_TERM TRUE} [get_ports clk200_p]`.',
      ],
      explain: `
        \`\`\`
        set_property -dict {PACKAGE_PIN AD12 IOSTANDARD LVDS DIFF_TERM TRUE} [get_ports clk200_p]
        \`\`\`
        - **Only the P port.** The pins of a differential pair are fixed: every P pin has its own N pin (here AD12 and AD11). By placing \`clk200_p\` on AD12, you also uniquely determine the location of \`clk200_n\`: Vivado places it automatically, and the I/O standard applies to the whole IBUFDS buffer. You may also set the same values on the N port (many board constraint files do so), but then they must match.
        - **LVDS or LVDS_25.** In 7 series FPGAs, HP banks (VCCO up to 1.8 V) support the LVDS standard, and HR banks (VCCO up to 3.3 V) support LVDS_25 at VCCO = 2.5 V. LVDS_25 is not allowed in an HP bank: Vivado refuses to place such a port.
        - **DIFF_TERM TRUE** enables the internal differential termination resistor of about 100 Ω between the lines of the pair at the receiver input. An LVDS line must be terminated in its characteristic impedance: without termination, the signal reflects, the edges ring, and the input may toggle spuriously; for a clock, this means failures of the whole circuit. In an HP bank, internal LVDS termination works at VCCO = 1.8 V, and that condition is met here.

        **Common mistakes.**
        - \`IOSTANDARD LVDS_25\`: an HR-bank standard in an HP bank causes a placement error.
        - No \`DIFF_TERM\`: neither DRC nor timing analysis notices it, but on the board the line stays unterminated. Conversely, if a termination resistor is fitted on the board, \`DIFF_TERM\` must not be enabled: two resistors in parallel give 50 Ω.
        - The P port on pin AD11: this is the N pin of the pair, and a P port cannot be placed on it; Vivado reports a placement error.

        **Check in Vivado:** \`report_io\` shows both ports of the pair on pins AD12 and AD11 with the LVDS standard and DIFF_TERM TRUE; the I/O Planning view shows the pair and its bank.
      `,
      refs: 'UG903, "Physical Constraints"; UG471, the chapter on differential I/O standards (LVDS, LVDS_25, DIFF_TERM) in HP and HR banks',
    },

    // -------------------------------------------------------------------------
    'phys.iob': {
      title: 'Registers in I/O blocks (IOB)',
      langNote: 'The `IOB` property is FPGA-specific; in an ASIC, registers next to the pads are placed during floorplanning.',
      text: `
        The design receives samples from a 12-bit ADC (\`adc_d[11:0]\`) and sends samples to a 14-bit DAC (\`dac_d[13:0]\`) at 100 MHz. The registers \`adc_d_reg[11:0]\` sit right after the input buffers, and the registers \`dac_d_reg[13:0]\` right before the output buffers; there is no logic between a register and its buffer, and the output registers have no loads other than the OBUF.

        The interface timing constraints (input/output delays) are in another constraints file, but the slack at the pins changes from build to build: Vivado places the registers in logic slices inside the chip, and each pin is reached by a route of a different length. The bits of one bus get different delays.

        To make the delays between the pin and the register minimal, equal for all bits and independent of placement, the registers must be placed **in the I/O blocks** (IOB), that is, in the I/O logic right next to the pins.

        **Task.** Require the input registers \`adc_d_reg[11:0]\` and the output registers \`dac_d_reg[13:0]\` to be placed in the I/O blocks.
      `,
      strings: {
        'от АЦП': 'from ADC',
        'обработка': 'processing',
        'к ЦАП': 'to DAC',
        'dac_d: регистр в логике': 'dac_d: register in fabric',
        'dac_d: регистр в IOB': 'dac_d: register in IOB',
        'фронт sys_clk': 'sys_clk edge',
        'разброс по разрядам': 'bit-to-bit spread',
        'малый разброс': 'small spread',
      },
      figures: [
        {
          title: 'Clock-to-pin delay, bit by bit',
          caption: 'The delays are illustrative. Register in a logic slice: each pin has its own route, the bit transitions are spread out, and the spread changes from build to build. Register in an I/O block: the delay to the pin is minimal, equal for all bits and independent of placement.',
        },
      ],
      hints: [
        'Placement of a register in an I/O block is requested with the IOB property set to TRUE.',
        'The property can be set on the registers themselves (get_cells) or on the ports (get_ports); in the latter case Vivado packs the registers connected to the port into the I/O block.',
        'For example: `set_property IOB TRUE [get_cells {adc_d_reg[*] dac_d_reg[*]}]`.',
      ],
      explain: `
        \`\`\`
        set_property IOB TRUE [get_cells {adc_d_reg[*] dac_d_reg[*]}]
        \`\`\`
        An equivalent form uses the ports: \`set_property IOB TRUE [get_ports {adc_d[*] dac_d[*]}]\`; the port property applies to the registers connected to the port (input, output and 3-state control registers). Mixed variants are accepted too.

        **Why.** An I/O block of a 7 series FPGA has its own flip-flops (in ILOGIC and OLOGIC) right at the pin. A register placed there:
        - has a minimal and **fixed** clock-to-pin delay (Tco) on outputs, and a minimal and fixed setup/hold time relative to the pin on inputs;
        - gives **equal** delays for all bits of a bus, so the bit-to-bit skew is minimal;
        - **does not depend on placement and routing**: the slack at the pins is the same from build to build.

        For source-synchronous and system-synchronous interfaces, the data valid window is a few nanoseconds, and a 1–2 ns spread of routing delays between bits can eat up the entire margin. That is why interface registers are almost always placed in I/O blocks, and the input/output delay constraints are written with that in mind.

        **Packing conditions.** The register must connect to the buffer directly, with no logic in between; an output register must have no loads other than the OBUF (otherwise it cannot be moved to the pin); the clock, enable and reset must be compatible with the I/O block resources. If a condition is violated, Vivado issues a placement warning that the IOB constraint cannot be honored and leaves the register in the fabric; this warning must not be ignored.

        **Common mistakes.**
        - The property on the input registers only: the outputs still depend on placement.
        - IOB on the buffers (\`adc_d_IBUF[*]_inst\`, \`dac_d_OBUF[*]_inst\`): the buffer is in the I/O block anyway, and the register stays in the fabric.
        - A register with an extra load (for example, the \`dac_d_reg\` output also feeds monitoring logic): packing is impossible, so the register is duplicated in RTL.

        The same result can be requested in the source code with the \`(* IOB = "TRUE" *)\` attribute on the register.

        **Check in Vivado:** after placement, \`report_utilization\` shows the used ILOGIC and OLOGIC sites; the \`BEL\` property of the cell (\`get_property BEL [get_cells {adc_d_reg[0]}]\`) points to an I/O block flip-flop; the placer log must contain no warnings about an unmet IOB constraint.
      `,
      refs: 'UG903, "Physical Constraints" (IOB); UG912, IOB property; UG471, 7 series ILOGIC and OLOGIC resources',
    },

    // -------------------------------------------------------------------------
    'phys.config': {
      title: 'Configuration from Quad SPI flash',
      langNote: 'FPGA configuration settings exist only in Vivado.',
      text: `
        A board with a 7 series FPGA is configured from SPI flash with a 4-bit data bus (Quad SPI). According to the board schematic:
        - bank 0 (the configuration pins) is powered from **3.3 V**, and the CFGBVS pin is tied to VCCO_0;
        - the flash is connected with **four** data lines;
        - the configuration clock CCLK runs at **33 MHz** (acceptable for the flash and the board routing);
        - the bitstream must be **compressed**: it then takes less space in the flash and loads faster.

        These settings are design properties, that is, properties of the \`[current_design]\` object.

        **Task.** Set the configuration bank voltage (\`CFGBVS\`, \`CONFIG_VOLTAGE\`) and the bitstream settings: SPI bus width, CCLK frequency and compression.
      `,
      strings: {
        '100 МГц': '100 MHz',
        'Банк 0: конфигурация': 'Bank 0: configuration',
        'VCCO_0 = 3,3 В\nCFGBVS → VCCO_0': 'VCCO_0 = 3.3 V\nCFGBVS → VCCO_0',
        'Флеш SPI ×4': 'SPI flash ×4',
        '33 МГц': '33 MHz',
      },
      hints: [
        'All properties are set on the [current_design] object. The configuration bank voltage is described by the pair of properties CFGBVS and CONFIG_VOLTAGE.',
        'CFGBVS = VCCO if bank 0 is powered from 2.5 V or 3.3 V (the CFGBVS pin is tied to VCCO_0), and GND for 1.8 V and below. CONFIG_VOLTAGE is the voltage itself: `3.3`.',
        'Bitstream settings: BITSTREAM.CONFIG.SPI_BUSWIDTH 4, BITSTREAM.CONFIG.CONFIGRATE 33 (in MHz), BITSTREAM.GENERAL.COMPRESS TRUE.',
      ],
      explain: `
        \`\`\`
        set_property CFGBVS VCCO [current_design]
        set_property CONFIG_VOLTAGE 3.3 [current_design]
        set_property BITSTREAM.CONFIG.SPI_BUSWIDTH 4 [current_design]
        set_property BITSTREAM.CONFIG.CONFIGRATE 33 [current_design]
        set_property BITSTREAM.GENERAL.COMPRESS TRUE [current_design]
        \`\`\`
        - **CFGBVS and CONFIG_VOLTAGE** tell Vivado how the configuration bank is powered on the board: the CFGBVS pin is tied to VCCO_0 (value \`VCCO\`, for 2.5 V and 3.3 V) or to ground (\`GND\`, for 1.8 V and below), and the voltage is 3.3 V. The properties do not switch anything by themselves: DRC uses them to check the compatibility of the I/O standards of the ports in the banks that contain configuration pins. If the properties are not set, Vivado issues the DRC warning CFGBVS-1: the configuration voltage is unknown, so this check cannot be performed.
        - **BITSTREAM.CONFIG.SPI_BUSWIDTH 4.** The FPGA starts reading the flash over a single data line, and this setting in the bitstream header switches it to four lines, so configuration is about four times faster. The flash must support Quad SPI mode, and its programming file is generated for the same interface (\`write_cfgmem -interface SPIx4\`).
        - **BITSTREAM.CONFIG.CONFIGRATE 33** is the CCLK frequency in MHz that the FPGA generates in master mode. It is limited by the flash and the board; too high a frequency causes read errors.
        - **BITSTREAM.GENERAL.COMPRESS TRUE** enables bitstream compression, which is especially effective when the design occupies only part of the device.

        These are often accompanied by \`set_property CONFIG_MODE SPIx4 [current_design]\`, the configuration mode that Vivado uses to reserve the multi-function configuration pins. It is optional in this task.

        **Common mistakes.**
        - Properties on a port or a cell (\`[get_ports sys_clk]\`): these are design properties and do not exist on other objects.
        - \`CFGBVS GND\` at 3.3 V: the description contradicts the board, and DRC checks the I/O standards against the wrong voltage.
        - No \`SPI_BUSWIDTH\`: the FPGA still configures, but over one data line, several times slower.

        **Check in Vivado:** \`report_property [current_design]\` or the Edit Device Properties dialog of the open implemented design; \`report_drc\` shows no CFGBVS-1.
      `,
      refs: 'UG908 (bitstream settings); UG470, 7 series FPGA configuration (CFGBVS, Master SPI); UG912, CFGBVS and CONFIG_VOLTAGE properties',
    },

    // -------------------------------------------------------------------------
    'phys.drive_slew': {
      title: 'DRIVE and SLEW for LVCMOS33 outputs',
      langNote: 'The `DRIVE` and `SLEW` properties are FPGA-specific; in an ASIC, the output drive strength and slew rate are determined by the choice of I/O cell from the library.',
      tags: ['DRIVE', 'SLEW', 'understanding'],
      text: `
        A design on a 7 series FPGA drives the following signals through LVCMOS33 outputs (HR bank, VCCO = 3.3 V):
        - \`led[7:0]\`: LEDs through current-limiting resistors, toggling once every few tens of milliseconds;
        - \`cfg_sck\`, \`cfg_mosi\`, \`cfg_cs_n\`: a slow serial interface for configuring an external chip (1 MHz);
        - \`dac_clk\`, \`dac_d[13:0]\`: the clock and data of a fast DAC (100 MHz), short traces, a tight timing budget.

        If nothing is specified, Vivado assigns LVCMOS33 outputs a drive strength of DRIVE 12 mA and a slew rate of SLEW SLOW.

        Which set of properties best matches these requirements?
      `,
      strings: {
        'короткий фронт': 'fast edge',
        'длинный фронт': 'slow edge',
      },
      figures: [
        {
          title: 'Edge rate (illustrative)',
          caption: 'The transition times are illustrative. A fast edge (SLEW FAST) reduces the output buffer delay and is needed for fast signals, but it causes more reflections, ringing and noise when many outputs switch simultaneously. A slow edge (SLEW SLOW) is gentler on the board.',
        },
      ],
      options: [
        { text: 'SLEW FAST and the highest drive (DRIVE 16) on all outputs: the stronger and faster the output, the more reliable it is.', why: 'Incorrect. Fast edges and high drive increase reflections, ringing, crosstalk and simultaneous switching noise, which on the board means failures of neighboring signals. The LEDs and a 1 MHz interface do not need speed.' },
        { text: 'LEDs and the slow interface: SLEW SLOW and moderate drive (DRIVE 4–8); DAC outputs: SLEW FAST, with the drive chosen by simulating the line (for example, DRIVE 8–12).', why: 'Correct. Where speed is not needed, slow edges and lower drive reduce ringing, crosstalk and simultaneous switching output (SSO) noise. Fast outputs need fast edges: SLEW FAST shortens the rise time and the output buffer delay, preserving the timing margin at 100 MHz.' },
        { text: 'SLEW SLOW on all outputs: there is less noise, and at 100 MHz the edge rate does not matter.', why: 'Incorrect. SLEW SLOW lengthens the edge and increases the output buffer delay; with a tight budget at 100 MHz this eats up the margin, and a slow edge on the dac_clk clock degrades its waveform at the DAC input.' },
        { text: 'DRIVE and SLEW affect only power consumption and are not reflected in delays, so they can be left unset.', why: 'Incorrect. Vivado accounts for DRIVE and SLEW in the output buffer delay: they affect the report_timing results for output paths, as well as the simultaneous switching noise estimate (report_ssn).' },
      ],
      explain: `
        \`\`\`
        set_property -dict {DRIVE 4 SLEW SLOW} [get_ports {led[*]}]
        set_property -dict {DRIVE 8 SLEW SLOW} [get_ports {cfg_sck cfg_mosi cfg_cs_n}]
        set_property SLEW FAST [get_ports {dac_clk dac_d[*]}]
        \`\`\`
        - **SLEW** sets the edge rate of the LVCMOS output buffer: \`SLOW\` (default) or \`FAST\`. A fast edge reduces the buffer delay and is needed for fast interfaces; a slow edge reduces reflections and noise.
        - **DRIVE** is the output drive current in mA (for LVCMOS33 in 7 series HR banks: 4, 8, 12, 16; default 12). A higher drive charges the load faster but increases ringing and simultaneous switching noise.
        - The right values for fast lines are chosen by signal integrity simulation (IBIS models) that accounts for the trace and the load; for slow signals, it is sensible to choose the lowest sufficient drive and \`SLEW SLOW\`.
        - Changing DRIVE and SLEW changes the output buffer delay, so the timing analysis of the outputs is done with the final values of these properties.

        **Check in Vivado:** \`report_io\` (the Drive and Slew columns); \`report_ssn\` estimates simultaneous switching noise per bank.
      `,
    },
  },
});
