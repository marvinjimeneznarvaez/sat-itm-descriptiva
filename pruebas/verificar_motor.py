# -*- coding: utf-8 -*-
"""Contraste independiente del motor de calculo de la app.

Replica en Python las mismas reglas que implementa `js/datos.js` y comprueba que
reproducen, cifra por cifra, la serie publicada por Permanencia y la tabla
institucional de desercion recogidas en `datos/VERIFICACION.md`.

No contiene ningun dato de estudiantes: lee los agregados publicados.

Uso:  python -I pruebas/verificar_motor.py
Devuelve codigo de salida 0 si todas las cifras coinciden."""
import io, json, sys

import os
BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'datos') + os.sep
meta = json.load(io.open(BASE + 'meta.json', encoding='utf-8'))
hechos = json.load(io.open(BASE + 'hechos.json', encoding='utf-8'))
E = meta['estados']; P = meta['periodos']; M = [m['id'] for m in meta['metodologias']]

DEF = {'fin_pensum': 'excluir', 'bajo_rendimiento': 'riesgo_competitivo',
       'suspension': 'permanece', 'graduados': 'excluir'}

def roles(fenomeno, trat, metod):
    r = {e: {'ev': False, 'den': False} for e in E}
    for e in ['MATRICULADO', 'REINGRESO', 'AUSENTE', 'DESERTOR',
              'RIESGO_COMPETITIVO', 'SALIDA_INSTITUCIONAL', 'NO_ETIQUETABLE']:
        r[e]['den'] = True
    r['GRADUADO']['den'] = trat['graduados'] == 'incluir'
    r['EGRESADO_NO_GRADUADO']['den'] = trat['fin_pensum'] != 'excluir'
    for e in (metod.get('estados_evento') or []):
        r[e]['ev'] = True
    if trat['bajo_rendimiento'] == 'contar_desertor': r['RIESGO_COMPETITIVO']['ev'] = True
    if trat['suspension'] == 'contar_desertor': r['SALIDA_INSTITUCIONAL']['ev'] = True
    if trat['fin_pensum'] == 'incluir_ambos': r['EGRESADO_NO_GRADUADO']['ev'] = True
    if fenomeno == 'permanencia':
        for e in E: r[e]['ev'] = r[e]['den'] and not r[e]['ev']
    return r

def tasa_por_periodo(met_id, fenomeno='ausentismo', trat=None):
    trat = trat or DEF
    metod = [m for m in meta['metodologias'] if m['id'] == met_id][0]
    r = roles(fenomeno, trat, metod)
    im = M.index(met_id)
    num = [0.0] * len(P); den = [0.0] * len(P); cen = [0.0] * len(P)
    for i in range(len(hechos['n'])):
        if hechos['metodologia'][i] != im: continue
        p = hechos['periodo'][i]; e = E[hechos['estado'][i]]; n = hechos['n'][i]
        if r[e]['ev']: num[p] += n
        if r[e]['den']: den[p] += n
        if e == 'CENSURADO': cen[p] += n
    out = []
    for p in range(len(P)):
        if den[p] == 0: out.append((P[p], num[p], den[p], None)); continue
        t = None if (num[p] == 0 and cen[p] > 0) else 100.0 * num[p] / den[p]
        out.append((P[p], num[p], den[p], t))
    return out

ESPERADO_PERM = {'2020-01': (1493, 20584, 7.25), '2020-02': (2605, 22553, 11.55),
    '2021-01': (3324, 23665, 14.05), '2021-02': (3028, 23230, 13.03),
    '2022-01': (3586, 22760, 15.76), '2022-02': (3554, 22253, 15.97),
    '2023-01': (3957, 22983, 17.22), '2023-02': (3753, 22191, 16.91),
    '2024-01': (4010, 22708, 17.66), '2024-02': (4817, 24167, 19.93),
    '2025-01': (5679, 26258, 21.63), '2025-02': (5645, 26212, 21.54)}
ESPERADO_ITM = {'2022-01': (3400, 21330, 15.94), '2022-02': (3322, 22239, 14.94),
    '2023-01': (3692, 22979, 16.07), '2023-02': (3518, 22185, 15.86),
    '2024-01': (3714, 22704, 16.36), '2024-02': (4515, 24148, 18.70),
    '2025-01': (5166, 26189, 19.73)}

fallos = 0
for nombre, met, fen, esperado in [
        ('ITM · ausentismo intersemestral', 'itm', 'ausentismo', ESPERADO_PERM),
        ('Tabla institucional de desercion', 'itm_desercion_anual', 'desercion', ESPERADO_ITM)]:
    print('\n=== %s ===' % nombre)
    print('%-9s %10s %10s %8s | %10s %10s %8s | %s' %
          ('periodo', 'num', 'den', 'tasa', 'num esp', 'den esp', 'esp', 'resultado'))
    for per, n, d, t in tasa_por_periodo(met, fen):
        if per not in esperado: continue
        en, ed, et = esperado[per]
        ok_n = (n == en); ok_t = (t is not None and abs(t - et) < 0.005)
        if not (ok_n and ok_t): fallos += 1
        print('%-9s %10.0f %10.0f %7.2f%% | %10d %10d %7.2f%% | %s' %
              (per, n, d, t if t is not None else float('nan'), en, ed, et,
               'OK' if (ok_n and ok_t) else ('numerador!' if not ok_n else 'tasa!')))

print('\n=== SPADIES: censura de los dos ultimos periodos ===')
for per, n, d, t in tasa_por_periodo('spadies', 'desercion'):
    if per in ('2024-02', '2025-01', '2025-02'):
        print('%-9s num=%6.0f den=%7.0f tasa=%s' % (per, n, d, 'sin confirmar' if t is None else '%.2f %%' % t))

print('\nControl del nivel 1 (metodologia permanencia, 2025-02)')
im = M.index('itm'); ip = P.index('2025-02'); i1 = meta['niveles'].index(1)
num = den = 0
for i in range(len(hechos['n'])):
    if hechos['metodologia'][i] != im or hechos['periodo'][i] != ip: continue
    if hechos['nivel'][i] != i1: continue
    e = E[hechos['estado'][i]]
    if e == 'AUSENTE': num += hechos['n'][i]
    if e in ('MATRICULADO', 'AUSENTE'): den += hechos['n'][i]
print('  ausentes %d / base %d = %.1f %%   (esperado 3.709 / 9.157 = 40,5 %%)' %
      (num, den, 100.0 * num / den))

print('\n%s' % ('TODAS LAS CIFRAS COINCIDEN.' if fallos == 0 else '%d discrepancia(s).' % fallos))
sys.exit(1 if fallos else 0)
