/* Манифест банка задач: файлы из каталога bank/ загружаются по порядку.
   Чтобы добавить свои задачи, положите файл в bank/ и допишите его имя в список
   (или откройте index.html?bank=имя_файла.js для пробной загрузки без правки манифеста). */
XT.BANK_FILES = [
  '01_clocks.js',
  '02_gen.js',
  '03_sysio.js',
  '04_ssin.js',
  '05_ssout.js',
  '06_exc.js',
  '07_cdc.js',
  '08_phys.js',
  '09_iface.js',
  '10_asic.js',
  '11_asic_modes.js',
  '12_asic_signoff.js',
];
XT.VERSION = '1.0';
// Английские переводы задач (загружаются только в английском интерфейсе)
XT.BANK_FILES_EN = [
  'en/01_clocks.js',
  'en/02_gen.js',
  'en/03_sysio.js',
  'en/04_ssin.js',
  'en/05_ssout.js',
  'en/06_exc.js',
  'en/07_cdc.js',
  'en/08_phys.js',
  'en/09_iface.js',
  'en/10_asic.js',
  'en/11_asic_modes.js',
  'en/12_asic_signoff.js',
];
XT.APP_NAME = 'ConstraintLab';
XT.AUTHOR = { ru: 'Щучкин Евгений Юрьевич', en: 'Evgenii Shchuchkin', url: 'https://github.com/shchuchkin-pkims/' };
