# -*- coding: utf-8 -*-
"""
Genera datos SIMULADOS (sinteticos) que cumplen `App Descriptiva/CONTRATO_DATOS.md`
mas las extensiones acordadas tras revisar la presentacion de Permanencia
(tres metodologias, marcas de fuente, periodos provisionales y atipicos).

NO contiene ni deriva de un solo dato real de estudiantes: todas las cifras salen
de un generador pseudoaleatorio con semilla fija. Sirve unicamente para desarrollar
y probar la interfaz mientras el pipeline produce `app/datos/`.

Uso:  python -I generar_datos_demo.py
Salida: app/datos-demo/{meta,hechos,socio,flujos,numericas}.json
"""
import json
import math
import random
from pathlib import Path

SEMILLA = 20261028
rng = random.Random(SEMILLA)

RAIZ = Path(__file__).resolve().parent
SALIDA = RAIZ / "datos-demo"
SALIDA.mkdir(parents=True, exist_ok=True)

UMBRAL = 5

# --------------------------------------------------------------------------
# Dimensiones
# --------------------------------------------------------------------------
PERIODOS = [f"{a}-{s:02d}" for a in range(2018, 2026) for s in (1, 2)]

FACULTADES = [
    {"id": "FCEA", "nombre": "Ciencias Economicas y Administrativas"},
    {"id": "FIng", "nombre": "Ingenierias"},
    {"id": "FCEx", "nombre": "Ciencias Exactas y Aplicadas"},
    {"id": "FArt", "nombre": "Artes y Humanidades"},
]

# nombre de programa -> departamento academico (G4 de la presentacion)
PROGRAMAS_FUENTE = {
    "FCEA": [("Administracion Tecnologica", "Ciencias Administrativas"),
             ("Gestion Administrativa", "Ciencias Administrativas"),
             ("Negocios Internacionales", "Ciencias Administrativas"),
             ("Contaduria Publica", "Finanzas"),
             ("Tecnologia en Gestion de Mercados", "Mercadeo"),
             ("Analitica de Negocios", "Finanzas")],
    "FIng": [("Ingenieria de Sistemas", "Informatica y Sistemas"),
             ("Tecnologia en Sistemas de Informacion", "Informatica y Sistemas"),
             ("Ingenieria Electronica", "Electronica y Telecomunicaciones"),
             ("Tecnologia en Electronica", "Electronica y Telecomunicaciones"),
             ("Ingenieria de Telecomunicaciones", "Electronica y Telecomunicaciones"),
             ("Ingenieria Mecatronica", "Mecatronica y Mantenimiento"),
             ("Tecnologia en Mantenimiento", "Mecatronica y Mantenimiento"),
             ("Ingenieria Biomedica", "Mecatronica y Mantenimiento")],
    "FCEx": [("Ingenieria Financiera", "Ciencias Exactas"),
             ("Ciencias Ambientales", "Calidad y Produccion"),
             ("Quimica Industrial", "Calidad y Produccion"),
             ("Tecnologia en Calidad", "Calidad y Produccion"),
             ("Ingenieria en Higiene y Seguridad", "Calidad y Produccion")],
    "FArt": [("Artes Visuales", "Artes"),
             ("Artes de la Grabacion", "Artes"),
             ("Tecnologia en Produccion Musical", "Artes"),
             ("Ciencias Sociales Aplicadas", "Ciencias Sociales"),
             ("Tecnologia en Idiomas", "Idiomas")],
}

PROGRAMAS = []
_i = 1
for f in FACULTADES:
    for nom, depto in PROGRAMAS_FUENTE[f["id"]]:
        tecnologia = nom.lower().startswith("tecnologia")
        PROGRAMAS.append({
            "id": f"P{_i:03d}",
            "nombre": nom,
            "facultad": f["id"],
            "departamento": depto,
            "nivel_formacion": "Tecnologia" if tecnologia else "Programa profesional",
        })
        _i += 1

MODALIDADES = ["Presencial", "Virtual", "Virtual Dual"]
NIVELES = list(range(1, 13))

ESTADOS = ["MATRICULADO", "AUSENTE", "DESERTOR", "REINGRESO", "GRADUADO",
           "EGRESADO_NO_GRADUADO", "RIESGO_COMPETITIVO", "SALIDA_INSTITUCIONAL",
           "CENSURADO", "NO_ETIQUETABLE"]
IE = {e: i for i, e in enumerate(ESTADOS)}

# Tres metodologias: cambia el DESPLAZAMIENTO del denominador.
METODOLOGIAS = [
    {"id": "itm", "nombre": "ITM (ausentismo intersemestral)",
     "desplazamiento_denominador": 0, "estados_evento": ["AUSENTE"],
     "formula": "TAI_t = Ausentes_t / Matriculados_(t-1) x 100",
     "descripcion": "Formula declarada por el area de Permanencia (lamina 3). El denominador son "
                    "los matriculados del periodo ANTERIOR. Excluye del denominador fin de pensum "
                    "y graduados del semestre de medicion."},
    {"id": "itm_desercion_anual", "nombre": "Tabla institucional de desercion anual",
     "desplazamiento_denominador": 0, "estados_evento": ["DESERTOR"],
     "formula": "Tasa_t = Desertores_t / Matriculados_t x 100",
     "descripcion": "Desertor anual segun la tabla institucional; el denominador son los "
                    "matriculados del MISMO periodo t."},
    {"id": "spadies", "nombre": "MEN / SPADIES",
     "desplazamiento_denominador": 0, "estados_evento": ["DESERTOR"],
     "formula": "Tasa_t = Evento_t / Matriculados_(t-2) x 100",
     "descripcion": "Dos o mas periodos consecutivos sin matricula; el denominador son los "
                    "matriculados en t-2, que es la cohorte expuesta al riesgo."},
]

TRATAMIENTOS = [
    {"id": "fin_pensum", "etiqueta": "Fin de pensum",
     "opciones": ["excluir", "incluir_denominador", "incluir_ambos"], "defecto": "excluir",
     "etiquetas_opciones": {"excluir": "Fuera de la cuenta",
                            "incluir_denominador": "Solo en el denominador",
                            "incluir_ambos": "Contarlos como evento"},
     "nota": "La bandera marca el ultimo semestre academico. Una parte reaparece matriculada "
             "despues, asi que contarlos como desertores infla la tasa. Permanencia los excluye."},
    {"id": "bajo_rendimiento", "etiqueta": "Exclusion por bajo rendimiento",
     "opciones": ["riesgo_competitivo", "contar_desertor"], "defecto": "riesgo_competitivo",
     "etiquetas_opciones": {"riesgo_competitivo": "Evento aparte (riesgo competitivo)",
                            "contar_desertor": "Contarlos como evento"},
     "nota": "Casi la mitad de las ausencias tiene sancion academica encima. Es una salida "
             "forzosa, un evento distinto de la desercion voluntaria."},
    {"id": "suspension", "etiqueta": "Suspension de matricula",
     "opciones": ["permanece", "contar_desertor"], "defecto": "permanece",
     "etiquetas_opciones": {"permanece": "Permanece (solo denominador)",
                            "contar_desertor": "Contarlos como evento"},
     "nota": "Pendiente institucional P-01. Solo una minoria queda efectivamente ausente."},
    {"id": "graduados", "etiqueta": "Graduados en el denominador",
     "opciones": ["excluir", "incluir"], "defecto": "excluir",
     "etiquetas_opciones": {"excluir": "Fuera del denominador", "incluir": "Dentro del denominador"},
     "nota": "SPADIES 3.0 los incluye; la version 2.8 los excluia. Permanencia los excluye. "
             "Incluirlos baja la tasa."},
]

FUENTES_SERIE = [
    {"id": "spadies_men", "etiqueta": "SPADIES (MEN)", "desde": "2018-01", "hasta": "2019-02",
     "nota": "Tramo tomado de SPADIES. Cambio de fuente en 2020-01: el empalme no esta validado."},
    {"id": "permanencia", "etiqueta": "Registros de Permanencia ITM", "desde": "2020-01",
     "hasta": "2025-02", "nota": "Tramo construido con los registros internos de Permanencia."},
]

ATIPICOS = [
    {"periodo": "2020-01", "nota": "Valor atipico. Cae a menos de la mitad del nivel previo y se "
                                   "recupera despues: efecto casi seguro de las medidas de pandemia."},
]
PROVISIONALES = ["2025-02"]

# --------------------------------------------------------------------------
# hechos.json
# --------------------------------------------------------------------------
perfil = {}
for p in PROGRAMAS:
    mods = ["Presencial"]
    if rng.random() < 0.45:
        mods.append("Virtual")
    if rng.random() < 0.20:
        mods.append("Virtual Dual")
    perfil[p["id"]] = {
        "tam": rng.randint(160, 1400),
        "mods": mods,
        "prop": rng.uniform(0.75, 1.30),
        "niv_max": 6 if p["nivel_formacion"] == "Tecnologia" else 10,
        # Programa que todavia no existia al inicio de la serie: distingue cero de faltante.
        "desde": 4 if p["nombre"] == "Tecnologia en Idiomas" else (6 if p["nombre"] == "Analitica de Negocios" else 0),
    }

col = {c: [] for c in ["periodo", "programa", "modalidad", "nivel", "estado", "n"]}
suprimidos = {}

IDX_PROG = {p["id"]: i for i, p in enumerate(PROGRAMAS)}
PROG_FAC = {p["id"]: p["facultad"] for p in PROGRAMAS}
IDX_FAC = {f["id"]: i for i, f in enumerate(FACULTADES)}


def agrega(ip, iprog, imod, niv, iest, n):
    col["periodo"].append(ip)
    col["programa"].append(iprog)
    col["modalidad"].append(imod)
    col["nivel"].append(niv)
    col["estado"].append(iest)
    col["n"].append(n)


for ip, per in enumerate(PERIODOS):
    anio, sem = int(per[:4]), int(per[-1])
    if per == "2020-01":
        choque = 0.43          # atipico de pandemia
    elif per in ("2020-02", "2021-01", "2021-02"):
        choque = 1.22
    else:
        choque = 1.0
    tendencia = 1.0 + 0.022 * (anio - 2018) + (0.012 if sem == 2 else 0.0)
    crec_matricula = 1.0 + 0.035 * (anio - 2018)
    for p in PROGRAMAS:
        pf = perfil[p["id"]]
        if ip < pf["desde"]:
            continue           # el programa aun no existia: ausencia de fila, no un cero
        for mod in pf["mods"]:
            imod = MODALIDADES.index(mod)
            peso_mod = {"Presencial": 1.0, "Virtual": 0.45, "Virtual Dual": 0.22}[mod]
            riesgo_mod = {"Presencial": 1.0, "Virtual": 1.22, "Virtual Dual": 1.10}[mod]
            for niv in range(1, pf["niv_max"] + 1):
                base = pf["tam"] * peso_mod * crec_matricula * math.exp(-0.24 * (niv - 1))
                base *= rng.uniform(0.82, 1.18)
                total = int(round(base / 4.0))
                if total < 1:
                    continue
                r = 0.105 * pf["prop"] * riesgo_mod * choque * tendencia
                r *= (3.40 if niv == 1 else 1.35 if niv == 2 else max(1.0 - 0.05 * (niv - 2), 0.42))
                r = min(max(r, 0.02), 0.62)

                n_aus = int(round(total * r * 0.58 * rng.uniform(0.85, 1.15)))
                n_des = int(round(total * r * 0.42 * rng.uniform(0.85, 1.15)))
                n_bajo = int(round(total * 0.030 * rng.uniform(0.6, 1.5)))
                n_susp = int(round(total * 0.012 * rng.uniform(0.4, 1.8)))
                n_rein = int(round(total * 0.045 * rng.uniform(0.5, 1.6)))
                tope = niv >= pf["niv_max"] - 1
                n_grad = int(round(total * (0.075 if tope else 0.004) * rng.uniform(0.6, 1.4)))
                n_fin = int(round(total * (0.055 if tope else 0.003) * rng.uniform(0.6, 1.4)))
                n_cens = int(round(total * 0.010 * rng.uniform(0.3, 1.7))) if ip >= len(PERIODOS) - 2 else 0
                n_noet = int(round(total * 0.006 * rng.uniform(0.2, 1.8)))
                consumido = n_aus + n_des + n_bajo + n_susp + n_grad + n_fin + n_cens + n_noet
                n_mat = max(total - consumido, 1)

                celdas = [
                    (IE["MATRICULADO"], n_mat), (IE["AUSENTE"], n_aus), (IE["DESERTOR"], n_des),
                    (IE["REINGRESO"], n_rein), (IE["GRADUADO"], n_grad),
                    (IE["EGRESADO_NO_GRADUADO"], n_fin), (IE["RIESGO_COMPETITIVO"], n_bajo),
                    (IE["SALIDA_INSTITUCIONAL"], n_susp), (IE["CENSURADO"], n_cens),
                    (IE["NO_ETIQUETABLE"], n_noet),
                ]
                for iest, n in celdas:
                    if n <= 0:
                        continue
                    if n < UMBRAL:
                        k = (ip, PROG_FAC[p["id"]], iest)
                        suprimidos[k] = suprimidos.get(k, 0) + n
                    else:
                        agrega(ip, IDX_PROG[p["id"]], imod, niv, iest, n)

prog_supr_por_fac = {}
for f in FACULTADES:
    PROGRAMAS.append({"id": f"__suprimido__:{f['id']}",
                      "nombre": f"Celdas suprimidas ({f['id']})",
                      "facultad": f["id"], "departamento": "(sin dato)",
                      "nivel_formacion": "n/d", "suprimido": True})
    prog_supr_por_fac[f["id"]] = len(PROGRAMAS) - 1
for (ip, fac, iest), n in sorted(suprimidos.items()):
    agrega(ip, prog_supr_por_fac[fac], -1, -1, iest, n)

hechos = {"columnas": ["periodo", "programa", "modalidad", "nivel", "estado", "n"], **col}

meta = {
    "version": "0.9-demo",
    "generado": "2026-10-28T09:00:00",
    "demo": True,
    "fuente": ["DATOS SIMULADOS - no provienen de ningun registro real del ITM"],
    "periodos": PERIODOS,
    "facultades": FACULTADES,
    "programas": PROGRAMAS,
    "modalidades": MODALIDADES,
    "niveles": NIVELES,
    "estados": ESTADOS,
    "metodologias": METODOLOGIAS,
    "tratamientos": TRATAMIENTOS,
    "fuentes_serie": FUENTES_SERIE,
    "periodos_provisionales": PROVISIONALES,
    "periodos_atipicos": ATIPICOS,
    "suprimido_umbral": UMBRAL,
}

# --------------------------------------------------------------------------
# socio.json
# --------------------------------------------------------------------------
DIMENSIONES = {
    "estrato": {"etiqueta": "Estrato socioeconomico", "valores": ["1", "2", "3", "4", "5", "6"],
                "pesos": [.14, .33, .32, .13, .05, .03], "riesgo": [1.45, 1.22, 1.0, .82, .70, .62]},
    "sexo": {"etiqueta": "Sexo", "valores": ["Femenino", "Masculino"],
             "pesos": [.42, .58], "riesgo": [.88, 1.10]},
    "rango_edad": {"etiqueta": "Edad", "valores": ["<=18", "19-21", "22-25", "26-30", ">30"],
                   "pesos": [.17, .36, .26, .13, .08], "riesgo": [1.18, 1.0, .95, 1.08, 1.25]},
    "rango_promedio": {"etiqueta": "Promedio acumulado",
                       "valores": ["<2,0", "2,0-2,9", "3,0-3,4", "3,5-3,9", ">=4,0"],
                       "pesos": [.05, .19, .34, .30, .12], "riesgo": [3.10, 1.85, 1.0, .55, .32]},
    "estado_academico": {"etiqueta": "Estado academico",
                         "valores": ["Nivel Completo", "Nivel Incompleto",
                                     "Bajo Rendimiento Academico", "Prueba Academica",
                                     "Sin informacion"],
                         "pesos": [.52, .29, .09, .07, .03], "riesgo": [.72, 1.25, 2.40, 1.95, 1.4]},
    "antiguedad": {"etiqueta": "Antiguedad", "valores": ["Nuevo", "Antiguo", "Admitido"],
                   "pesos": [.22, .70, .08], "riesgo": [2.20, .82, 1.60]},
    "colegio": {"etiqueta": "Colegio de origen", "valores": ["PUBLICO", "PRIVADO"],
                "pesos": [.74, .26], "riesgo": [1.12, .82]},
    "etnia": {"etiqueta": "Pertenencia etnica",
              "valores": ["Ninguna", "Afrodescendiente", "Indigena", "Otra"],
              "pesos": [.90, .066, .022, .012], "riesgo": [.98, 1.28, 1.34, 1.1]},
    "discapacidad": {"etiqueta": "Discapacidad", "valores": ["Si", "No"],
                     "pesos": [.018, .982], "riesgo": [1.30, .99]},
    "nivel_formacion": {"etiqueta": "Nivel de formacion",
                        "valores": ["Tecnologia", "Programa profesional"],
                        "pesos": [.38, .62], "riesgo": [1.15, .92]},
    "sede": {"etiqueta": "Sede", "valores": ["Robledo", "Fraternidad", "Floresta", "Castilla"],
             "pesos": [.44, .31, .17, .08], "riesgo": [1.0, .97, 1.06, 1.12]},
    "estrategia": {"etiqueta": "Estrategia de atencion",
                   "valores": ["Medellin", "Virtual", "UEMB", "UEMR"],
                   "pesos": [.63, .19, .11, .07], "riesgo": [.95, 1.25, 1.05, 1.18]},
    "convenio_sapiencia": {"etiqueta": "Convenio Sapiencia", "valores": ["Si", "No"],
                           "pesos": [.29, .71], "riesgo": [.84, 1.07]},
    "evidencia_contacto": {"etiqueta": "Evidencia de contacto institucional",
                           "valores": ["Con evidencia", "Sin evidencia"],
                           "pesos": [.67, .33], "riesgo": [.78, 1.55]},
}

ESTADOS_SOCIO = [IE["MATRICULADO"], IE["AUSENTE"], IE["DESERTOR"], IE["REINGRESO"],
                 IE["GRADUADO"], IE["RIESGO_COMPETITIVO"]]

tot_pf = {}
for i in range(len(col["n"])):
    fac = PROGRAMAS[col["programa"][i]]["facultad"]
    tot_pf[(col["periodo"][i], fac)] = tot_pf.get((col["periodo"][i], fac), 0) + col["n"][i]

cubos = {}
for dim, d in DIMENSIONES.items():
    c = {k: [] for k in ["periodo", "facultad", "valor", "estado", "n"]}
    for ip in range(len(PERIODOS)):
        for f in FACULTADES:
            total = tot_pf.get((ip, f["id"]), 0)
            if total < 30:
                continue
            for iv, val in enumerate(d["valores"]):
                sub = total * d["pesos"][iv] * rng.uniform(0.9, 1.1)
                r = min(0.15 * d["riesgo"][iv] * rng.uniform(0.9, 1.1), 0.58)
                reparto = {
                    IE["AUSENTE"]: sub * r * 0.58,
                    IE["DESERTOR"]: sub * r * 0.42,
                    IE["REINGRESO"]: sub * 0.045,
                    IE["GRADUADO"]: sub * 0.035,
                    IE["RIESGO_COMPETITIVO"]: sub * 0.030 * d["riesgo"][iv],
                }
                reparto[IE["MATRICULADO"]] = max(sub - sum(reparto.values()), 1)
                for iest in ESTADOS_SOCIO:
                    n = int(round(reparto.get(iest, 0)))
                    if n < UMBRAL:
                        continue
                    c["periodo"].append(ip)
                    c["facultad"].append(IDX_FAC[f["id"]])
                    c["valor"].append(iv)
                    c["estado"].append(iest)
                    c["n"].append(n)
    cubos[dim] = {"columnas": ["periodo", "facultad", "valor", "estado", "n"], **c}

socio = {"dimensiones": {k: {"etiqueta": v["etiqueta"], "valores": v["valores"]}
                         for k, v in DIMENSIONES.items()},
         "cubos": cubos}

# --------------------------------------------------------------------------
# flujos.json
# --------------------------------------------------------------------------
TRANSICIONES = {
    IE["MATRICULADO"]: [(IE["MATRICULADO"], .80), (IE["AUSENTE"], .11), (IE["GRADUADO"], .045),
                        (IE["RIESGO_COMPETITIVO"], .028), (IE["SALIDA_INSTITUCIONAL"], .017)],
    IE["AUSENTE"]: [(IE["DESERTOR"], .58), (IE["REINGRESO"], .34), (IE["GRADUADO"], .08)],
    IE["REINGRESO"]: [(IE["MATRICULADO"], .70), (IE["AUSENTE"], .22), (IE["GRADUADO"], .08)],
    IE["RIESGO_COMPETITIVO"]: [(IE["DESERTOR"], .62), (IE["REINGRESO"], .38)],
    IE["SALIDA_INSTITUCIONAL"]: [(IE["MATRICULADO"], .62), (IE["AUSENTE"], .24), (IE["DESERTOR"], .14)],
    IE["EGRESADO_NO_GRADUADO"]: [(IE["GRADUADO"], .52), (IE["MATRICULADO"], .14), (IE["DESERTOR"], .34)],
}

orig_pf = {}
for i in range(len(col["n"])):
    fac = PROGRAMAS[col["programa"][i]]["facultad"]
    k = (col["periodo"][i], fac, col["estado"][i])
    orig_pf[k] = orig_pf.get(k, 0) + col["n"][i]

fl = {k: [] for k in ["periodo_origen", "estado_origen", "estado_destino", "facultad", "n"]}
for ip in range(len(PERIODOS) - 1):
    for f in FACULTADES:
        for eo, destinos in TRANSICIONES.items():
            base = orig_pf.get((ip, f["id"], eo), 0)
            if base < 30:
                continue
            for ed, prop in destinos:
                n = int(round(base * prop * rng.uniform(0.9, 1.1)))
                if n < UMBRAL:
                    continue
                fl["periodo_origen"].append(ip)
                fl["estado_origen"].append(eo)
                fl["estado_destino"].append(ed)
                fl["facultad"].append(IDX_FAC[f["id"]])
                fl["n"].append(n)
flujos = {"columnas": ["periodo_origen", "estado_origen", "estado_destino", "facultad", "n"], **fl}

# --------------------------------------------------------------------------
# numericas.json
# --------------------------------------------------------------------------
VARIABLES = ["promedio_acumulado", "promedio_semestre", "creditos_aprobados", "edad",
             "creditos_asesorados"]
PARAM = {
    "promedio_acumulado": (3.45, 0.52, 0.0, 5.0, 2),
    "promedio_semestre": (3.38, 0.70, 0.0, 5.0, 2),
    "creditos_aprobados": (14.2, 5.1, 0.0, 24.0, 1),
    "edad": (22.6, 5.3, 16.0, 62.0, 1),
    "creditos_asesorados": (3.1, 2.4, 0.0, 18.0, 1),
}
DESPL = {IE["MATRICULADO"]: 0.14, IE["AUSENTE"]: -0.32, IE["DESERTOR"]: -0.52,
         IE["GRADUADO"]: 0.46, IE["RIESGO_COMPETITIVO"]: -1.05}
DESPL_EDAD = {IE["MATRICULADO"]: -0.2, IE["AUSENTE"]: 0.9, IE["DESERTOR"]: 1.6,
              IE["GRADUADO"]: 2.4, IE["RIESGO_COMPETITIVO"]: 0.4}
DESPL_ASES = {IE["MATRICULADO"]: -0.3, IE["AUSENTE"]: 0.8, IE["DESERTOR"]: 0.5,
              IE["GRADUADO"]: -0.1, IE["RIESGO_COMPETITIVO"]: 2.2}
ESTADOS_NUM = list(DESPL.keys())

Z = {"min": -2.9, "p05": -1.645, "q1": -0.674, "mediana": 0.0,
     "q3": 0.674, "p95": 1.645, "max": 2.9}


def cuantiles(mu, de, lo, hi, dec):
    return {k: round(min(max(mu + v * de, lo), hi), dec) for k, v in Z.items()}


res_filas, hist_filas, cor_filas = [], [], []
PARES = {
    ("promedio_acumulado", "promedio_semestre"): 0.78,
    ("promedio_acumulado", "creditos_aprobados"): 0.61,
    ("promedio_acumulado", "edad"): -0.09,
    ("promedio_acumulado", "creditos_asesorados"): -0.34,
    ("promedio_semestre", "creditos_aprobados"): 0.67,
    ("promedio_semestre", "edad"): -0.07,
    ("promedio_semestre", "creditos_asesorados"): -0.29,
    ("creditos_aprobados", "edad"): -0.15,
    ("creditos_aprobados", "creditos_asesorados"): -0.21,
    ("edad", "creditos_asesorados"): 0.05,
}

for ip in range(len(PERIODOS)):
    for f in FACULTADES:
        ifac = IDX_FAC[f["id"]]
        for var in VARIABLES:
            mu0, de0, lo, hi, dec = PARAM[var]
            for iest in ESTADOS_NUM:
                n = orig_pf.get((ip, f["id"], iest), 0)
                if n < 30:
                    continue
                if var == "edad":
                    desp = DESPL_EDAD[iest]
                elif var == "creditos_asesorados":
                    desp = DESPL_ASES[iest]
                else:
                    desp = DESPL[iest] * de0
                mu = min(max(mu0 + desp + rng.uniform(-0.06, 0.06) * de0, lo), hi)
                de = de0 * rng.uniform(0.9, 1.1)
                q = cuantiles(mu, de, lo, hi, dec)
                res_filas.append([ip, ifac, iest, var, n, round(mu, dec), round(de, dec),
                                  q["min"], q["q1"], q["mediana"], q["q3"], q["max"],
                                  q["p05"], q["p95"]])
                b_lo = round(max(mu - 3 * de, lo), dec)
                b_hi = round(min(mu + 3 * de, hi), dec)
                k = 10
                paso = (b_hi - b_lo) / k
                bordes = [round(b_lo + j * paso, dec) for j in range(k + 1)]
                conteos = []
                for j in range(k):
                    c0 = (bordes[j] + bordes[j + 1]) / 2
                    dens = math.exp(-0.5 * ((c0 - mu) / de) ** 2)
                    conteos.append(int(round(n * dens * paso / (de * 2.5066))))
                conteos[k // 2] = max(conteos[k // 2] + (n - sum(conteos)), 0)
                conteos = [c if c >= UMBRAL else 0 for c in conteos]
                hist_filas.append([ip, ifac, iest, var, bordes, conteos])
        n_fac = sum(orig_pf.get((ip, f["id"], e), 0) for e in ESTADOS_NUM)
        if n_fac < 30:
            continue
        for (vx, vy), r0 in PARES.items():
            pe = round(min(max(r0 + rng.uniform(-0.05, 0.05), -1), 1), 3)
            sp = round(min(max(pe + rng.uniform(-0.04, 0.04), -1), 1), 3)
            cor_filas.append([ip, ifac, vx, vy, n_fac, pe, sp])

numericas = {
    "variables": VARIABLES,
    "etiquetas": {
        "promedio_acumulado": "Promedio acumulado",
        "promedio_semestre": "Promedio del semestre",
        "creditos_aprobados": "Creditos aprobados",
        "edad": "Edad (anos)",
        "creditos_asesorados": "Creditos con asesoria",
    },
    "resumenes": {"columnas": ["periodo", "facultad", "estado", "variable", "n", "media", "de",
                               "min", "q1", "mediana", "q3", "max", "p05", "p95"],
                  "filas": res_filas},
    "histogramas": {"columnas": ["periodo", "facultad", "estado", "variable", "bordes", "conteos"],
                    "filas": hist_filas},
    "correlaciones": {"columnas": ["periodo", "facultad", "var_x", "var_y", "n", "pearson",
                                   "spearman"],
                      "filas": cor_filas},
}


def escribe(nombre, obj):
    ruta = SALIDA / nombre
    with open(ruta, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
    print("  %-16s %8.1f KB" % (nombre, ruta.stat().st_size / 1024))


if __name__ == "__main__":
    print("Datos SIMULADOS escritos en", SALIDA)
    escribe("meta.json", meta)
    escribe("hechos.json", hechos)
    escribe("socio.json", socio)
    escribe("flujos.json", flujos)
    escribe("numericas.json", numericas)
    print("  filas de hechos:", len(col["n"]))
    tot = {}
    for i in range(len(col["n"])):
        if col["nivel"][i] == 1:
            tot[col["estado"][i]] = tot.get(col["estado"][i], 0) + col["n"][i]
    ev = tot.get(IE["AUSENTE"], 0) + tot.get(IE["DESERTOR"], 0)
    den = sum(tot.get(e, 0) for e in [IE["MATRICULADO"], IE["AUSENTE"], IE["DESERTOR"],
                                      IE["REINGRESO"], IE["RIESGO_COMPETITIVO"],
                                      IE["SALIDA_INSTITUCIONAL"]])
    print("  control nivel 1: %.1f %% de evento" % (100 * ev / den))
