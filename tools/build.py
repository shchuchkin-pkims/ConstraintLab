#!/usr/bin/env python3
"""Сборка ConstraintLab XDC/SDC в один HTML-файл (стили, сценарии и банк задач внутри).

Запуск:  python3 tools/build.py [путь_к_результату]
По умолчанию результат: dist/constraintlab.html
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def safe(js):
    # «</script» внутри встроенного сценария закрыл бы тег
    return js.replace('</script', '<\\/script')


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'constraintlab.html')
    html = read('index.html')

    html = html.replace('<link rel="stylesheet" href="css/app.css">', '<style>\n' + read('css/app.css') + '\n</style>')

    def inline_js(m):
        src = m.group(1)
        if src == 'bank/index.js':
            manifest = read('bank/index.js')
            files = re.findall(r"'([^']+\.js)'", manifest.split('XT.BANK_FILES =', 1)[1].split(']', 1)[0])
            # английские переводы задач (bank/en) тоже встраиваются
            if 'XT.BANK_FILES_EN' in manifest:
                files += [f for f in re.findall(r"'([^']+\.js)'", manifest.split('XT.BANK_FILES_EN', 1)[1].split(']', 1)[0])
                          if os.path.exists(os.path.join(ROOT, 'bank', f))]
            parts = [manifest, 'XT.BANK_INLINE = XT.BANK_INLINE || {};']
            for f in files:
                parts.append("XT.BANK_INLINE[%r] = function (XT) {\n%s\n};" % (f, read('bank/' + f)))
            return '<script>\n' + safe('\n'.join(parts)) + '\n</script>'
        return '<script>\n' + safe(read(src)) + '\n</script>'

    html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print('Готово: %s (%.0f КБ)' % (os.path.relpath(out, ROOT), os.path.getsize(out) / 1024))


if __name__ == '__main__':
    main()
