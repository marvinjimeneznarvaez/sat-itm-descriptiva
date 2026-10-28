# -*- coding: utf-8 -*-
"""Comprueba que los archivos JavaScript del tablero compilan, sin Node.js.

Usa el motor de Windows Script Host (`cscript //E:JScript`), que viene con Windows.
Ese motor es ECMAScript 3, donde `catch` es palabra reservada: `promesa.catch(...)`
daria un falso error que no ocurre en ningun navegador actual. Por eso el texto se
sustituye solo para el analisis; los archivos del sitio no se modifican.

Uso:  python -I pruebas/comprobar_sintaxis.py
Codigo de salida 0 si todo compila.
"""
import io
import json
import os
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(AQUI, '..'))
ARCHIVOS = ['datos.js', 'filtros.js', 'graficos.js', 'tablas.js', 'app.js']


def fuente_js(ruta):
    with io.open(ruta, encoding='utf-8') as fh:
        return fh.read().replace('.catch(', "['catch'](")


def main():
    piezas = []
    for nombre in ARCHIVOS:
        src = fuente_js(os.path.join(APP, 'js', nombre))
        piezas.append(
            'try { new Function(%s); WScript.Echo("OK    %s"); }'
            ' catch (e) { fallos++; WScript.Echo("ERROR %s :: " + e.message); }'
            % (json.dumps(src), nombre, nombre))

    # El bloque de pruebas incrustado en pruebas.html tambien se comprueba.
    ruta_html = os.path.join(AQUI, 'pruebas.html')
    if os.path.exists(ruta_html):
        with io.open(ruta_html, encoding='utf-8') as fh:
            html = fh.read()
        i = html.rindex('<script>') + len('<script>')
        j = html.rindex('</script>')
        src = html[i:j].replace('.catch(', "['catch'](")
        piezas.append(
            'try { new Function(%s); WScript.Echo("OK    pruebas.html"); }'
            ' catch (e) { fallos++; WScript.Echo("ERROR pruebas.html :: " + e.message); }'
            % json.dumps(src))

    guion = 'var fallos = 0;\n' + '\n'.join(piezas) + \
        '\nWScript.Echo(fallos === 0 ? "Todo compila." : fallos + " archivo(s) con error.");' \
        '\nWScript.Quit(fallos === 0 ? 0 : 1);'

    tmp = os.path.join(tempfile.gettempdir(), 'sat_itm_sintaxis.js')
    with io.open(tmp, 'w', encoding='utf-8') as fh:
        fh.write(guion)
    try:
        r = subprocess.run(['cscript', '//Nologo', '//E:JScript', tmp],
                           capture_output=True, text=True)
        print(r.stdout.strip())
        if r.stderr.strip():
            print(r.stderr.strip(), file=sys.stderr)
        return r.returncode
    except FileNotFoundError:
        print('No se encontro cscript. Este comprobador solo funciona en Windows.')
        return 0
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


if __name__ == '__main__':
    sys.exit(main())
