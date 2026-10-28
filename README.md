# SAT-ITM · Tablero descriptivo de ausentismo y deserción

Aplicación web para explorar las cifras de ausentismo y deserción estudiantil del
Instituto Tecnológico Metropolitano, dirigida a Vicerrectoría, decanaturas y
Permanencia Estudiantil.

**Prototipo.** Forma parte del Sistema de Alertas Tempranas (SAT-ITM) en desarrollo.

---

## Qué permite hacer

Filtrar y combinar libremente, y ver el resultado al instante:

- **Fenómeno:** ausentismo, deserción o permanencia.
- **Metodología de cálculo:** la del ITM o la del Ministerio de Educación (SPADIES).
  Cada opción explica en pantalla qué mide y por qué da una cifra distinta.
- **Tratamiento de casos:** fin de pensum, graduados, exclusión por bajo
  rendimiento, suspensión de matrícula. Son los criterios que hacen que las cifras
  de un área y otra no coincidan; aquí se pueden activar y ver el efecto.
- **Ventana de semestres**, facultad, programa, modalidad y nivel.
- **Variables socioeconómicas y académicas:** estrato, sexo, edad, promedio
  acumulado, estado académico, antigüedad, colegio de origen, etnia, discapacidad,
  nivel de formación y sede.

Siete vistas: panorama, tendencia, comparación, distribuciones, análisis bivariado,
flujos entre estados y tablas. Todos los gráficos se descargan como imagen y todas
las tablas como CSV.

## Protección de datos

**Esta aplicación no contiene datos de ningún estudiante.** Publica únicamente
conteos agregados y estadísticos resumen. No hay nombres, documentos, carnés,
correos, teléfonos ni identificadores de ninguna clase.

Los grupos con menos de 5 estudiantes no se muestran desglosados. Esos estudiantes
**siguen contando en todos los totales y en todas las tasas**: lo que se oculta es a
qué programa pertenecen, no su existencia. Afecta al 1,13 % de los registros.

Los datos originales no salen del equipo donde se procesan. Lo que se publica aquí
se genera por código desde ellos, nunca a mano.

## Verificación

Las cifras reproducen exactamente las que Permanencia Estudiantil publica en sus
informes: los doce semestres de la serie de ausentismo intersemestral coinciden al
segundo decimal, de 7,25 % en 2020-01 a 21,54 % en 2025-02. La suma de los registros
da 279 564, que son las filas del archivo de origen.

Las pruebas del motor de cálculo están en `pruebas/pruebas.html`: ábrelo en el
navegador y el marcador debe quedar verde.

## Uso

Abre el enlace publicado. No hace falta instalar nada.

Para ejecutarlo en local hace falta servirlo por HTTP, porque el navegador no
permite que una página abierta con doble clic lea archivos de datos:

```
python -m http.server 8777
```

y abre `http://localhost:8777/`.

## Estructura

| Carpeta | Contenido |
|---|---|
| `datos/` | agregados publicados y su informe de verificación |
| `js/`, `css/` | la aplicación |
| `pruebas/` | pruebas del motor de cálculo |
| `datos-demo/` | datos sintéticos de respaldo, para desarrollo |

`LEEME.md` tiene el detalle técnico y las limitaciones conocidas.

## Limitaciones conocidas

- Las pestañas de distribuciones y análisis bivariado no admiten filtros de
  programa, modalidad ni nivel: los agregados de esas vistas no tienen ese detalle.
  Está advertido en pantalla.
- La cobertura es 2020-01 a 2025-02.
- Para la metodología del Ministerio, los dos últimos semestres aparecen como «sin
  confirmar» y no como cero: hacen falta dos periodos posteriores para confirmar una
  deserción y todavía no existen.
- El semestre 2022-02 tiene una inconsistencia en el archivo de origen, reportada al
  ITM y señalada en los gráficos.
