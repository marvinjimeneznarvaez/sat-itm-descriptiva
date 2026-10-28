# VERIFICACION de los agregados de la app descriptiva

Generado por `src/app/00_construir_agregados.py`.

Todo lo que sigue sale de ese script. Ninguna cifra esta transcrita a mano.


## 1. Conteos por periodo y tasa por metodologia

`itm` = ausentes de t / matriculados de t. Es la metodologia de Permanencia Estudiantil: mismo denominador. Ellos rotulan la tasa con el semestre siguiente; aqui todo se rotula con el semestre base.

`itm_desercion_anual` es la tabla institucional de desercion anual: otro evento sobre otra poblacion, publicada como contraste.


| Periodo | itm: ausentes / matriculados | % | publicado ITM % | itm_desercion_anual: desertores / matriculados | % | verificado % | spadies: desertores / matriculados | % |
|---|---|---|---|---|---|---|---|---|
| 2020-01 | 1,493 / 20,584 | 7.25 | 7.25 | sin cobertura | - | - | 696 / 20,584 | 3.38 |
| 2020-02 | 2,605 / 22,553 | 11.55 | 11.55 | sin cobertura | - | - | 868 / 22,553 | 3.85 |
| 2021-01 | 3,324 / 23,665 | 14.05 | 14.05 | sin cobertura | - | - | 1,448 / 23,665 | 6.12 |
| 2021-02 | 3,028 / 23,230 | 13.03 | 13.03 | sin cobertura | - | - | 1,330 / 23,230 | 5.73 |
| 2022-01 | 3,586 / 22,760 | 15.76 | 15.76 | 3,400 / 21,330 | 15.94 | 15.94 | 1,736 / 22,760 | 7.63 |
| 2022-02 | 3,554 / 22,253 | 15.97 | 15.97 | 3,322 / 22,239 | 14.94 | 14.94 | 500 / 22,253 | 2.25 |
| 2023-01 | 3,957 / 22,983 | 17.22 | 17.22 | 3,692 / 22,979 | 16.07 | 16.07 | 1,992 / 22,983 | 8.67 |
| 2023-02 | 3,753 / 22,191 | 16.91 | 16.91 | 3,518 / 22,185 | 15.86 | 15.86 | 1,926 / 22,191 | 8.68 |
| 2024-01 | 4,010 / 22,708 | 17.66 | 17.66 | 3,714 / 22,704 | 16.36 | 16.36 | 1,894 / 22,708 | 8.34 |
| 2024-02 | 4,817 / 24,167 | 19.93 | 19.93 | 4,515 / 24,148 | 18.70 | 18.7 | 2,019 / 24,167 | 8.35 |
| 2025-01 | 5,679 / 26,258 | 21.63 | 21.63 | 5,166 / 26,189 | 19.73 | 19.73 | 0 / 26,258 | 0.00 |
| 2025-02 | 5,645 / 26,212 | 21.54 | 21.54 | sin cobertura | - | - | 0 / 26,212 | 0.00 |

## 2. Contraste obligatorio

| Cifra | Esperada | Obtenida | Resultado |
|---|---|---|---|
| Ausencias totales 2020-2025 | 45,451 | 45,451 | OK |
| Filas del archivo de ausentismo | 279,564 | 279,564 | OK |
| Tasa institucional 2022-01 | 15.94 % | 15.94 % | OK |
| Tasa institucional 2025-01 | 19.73 % | 19.73 % | OK |
| Ausentismo nivel 1 en 2025-02 | 40,5 % (3.709 / 9.157) | 40.5 % (3,709 / 9,157) | OK |
| Serie completa de Permanencia (12 periodos) | igual en conteos y % | igual en los 12 | OK |

## 3. Supresion de celdas pequenas (n < 5)

| Bloque | Celdas suprimidas | Estudiantes-periodo reubicados |
|---|---|---|
| flujos | 117 | 149 |
| hechos | 5,772 | 11,249 |
| numericas:correlaciones | 0 | 0 |
| numericas:histogramas | 570 | 0 |
| numericas:resumenes | 0 | 0 |
| socio:antiguedad | 113 | 138 |
| socio:colegio | 165 | 191 |
| socio:discapacidad | 173 | 196 |
| socio:estado_academico | 442 | 590 |
| socio:estrato | 568 | 681 |
| socio:etnia | 552 | 653 |
| socio:nivel | 685 | 1,210 |
| socio:nivel_formacion | 99 | 121 |
| socio:rango_edad | 224 | 352 |
| socio:rango_promedio | 210 | 311 |
| socio:sede | 985 | 1,694 |
| socio:sexo | 106 | 126 |
| **total** | **10,781** | **17,661** |

Celdas centinela que, ya totalmente enmascaradas (programa `__suprimido__` y facultad, modalidad y nivel en -1), siguen por debajo del umbral. Se publican para que los totales por periodo y estado sigan siendo exactos; lo unico que informan es «n estudiantes de este periodo y este estado, en programas demasiado pequenos para publicarse». DECISION PENDIENTE de Marvin: si se prefiere no publicarlas, los totales dejan de cuadrar en esa cantidad.

| Bloque | Celdas | Conteo |
|---|---|---|
| flujos | 16 | 45 |
| hechos | 23 | 62 |
| socio:antiguedad | 10 | 28 |
| socio:colegio | 16 | 46 |
| socio:discapacidad | 29 | 83 |
| socio:estado_academico | 39 | 110 |
| socio:estrato | 22 | 67 |
| socio:etnia | 33 | 113 |
| socio:nivel | 39 | 107 |
| socio:nivel_formacion | 11 | 37 |
| socio:rango_edad | 15 | 46 |
| socio:rango_promedio | 18 | 52 |
| socio:sede | 41 | 115 |
| socio:sexo | 10 | 35 |

La supresion no pierde conteos: las celdas pequenas se acumulan en el programa `__suprimido__` (hechos) o en el valor de indice -1 (cubos), de modo que la suma por periodo y estado sigue siendo exacta. El script aborta si un total cambia.


## 4. Tamano de las salidas

| Archivo | KB | Filas publicadas |
|---|---|---|
| meta.json | 13 | 47 |
| hechos.json | 209 | 11,950 |
| socio.json | 184 | 13,289 |
| numericas.json | 130 | 1,376 |
| flujos.json | 4 | 330 |

## 5. Anomalias, limites y pendientes

- `sillas vacias`: concepto DESCONOCIDO. Permanencia ITM declara excluirlos del denominador y no hay ninguna columna ni documento en el acervo que permita identificarlos. Queda como tratamiento declarado, por defecto «incluir», y sin implementar. Pendiente institucional.
- Tabla institucional: 34 filas con `Id Pensum` que no resuelve a ningun programa del pensum; quedan en el programa `(sin dato)`.
- La columna `DESERTORES` del origen trae dos escrituras de la misma categoria ('Desertor ' hasta 2024-02 y 'Desertor' en 2025-01). Se normaliza con trim(): sin eso la desercion parece empezar en 2025.
- `FinPensum` del archivo de ausentismo no se usa: cero valores afirmativos en 279.564 filas (verificado en la Fase 2).
- `Nivel Completo` y `Nivel Incompleto` se tratan como MATRICULADO: son avance academico, no estados de salida.
- Convencion de rotulo resuelta: el periodo t del archivo de ausentismo es el semestre base (matriculados de t) y la ausencia es la no matricula en t+1. Permanencia Estudiantil publica la misma tasa rotulada con el semestre siguiente, con el mismo denominador, y las doce tasas coinciden.
- ANOMALIA del origen: en 2022-02 hay 2,650 filas marcadas «Ausente» que SI tienen matricula en el periodo siguiente; en los demas periodos ese numero es 0, 1 o 2. Por eso la metodologia spadies cae en ese periodo: esas filas pasan a REINGRESO en lugar de DESERTOR. No se corrige; hay que preguntarla al ITM.
- Estados GRADUADO y SALIDA_INSTITUCIONAL no aparecen: el primero exige cruzar Graduados.xlsx y el segundo la lista de programas retirados de la oferta. Ambos pendientes.
- El programa se identifica por `pro_consecutivo` (45 valores en el ausentismo) y el nombre se toma del pensum por llave, nunca por nombre. Un `pro_consecutivo` agrupa hasta 22 versiones de pensum y hasta 2 variantes de nombre: la modalidad se mantiene como dimension aparte.

## 6. Resultado del contraste

Sin diferencias: las 12 tasas de Permanencia, las 7 tasas institucionales, el total de 45.451 ausencias y el corte por nivel de 2025-02 se reproducen exactamente.
