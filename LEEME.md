# Tablero descriptivo de ausentismo y deserción · SAT-ITM

Sitio estático: HTML, CSS y JavaScript de navegador. **No necesita Node.js, ni npm, ni compilación.**
La única dependencia externa es Plotly.js, que se carga por CDN.

---

## Cómo verlo en este equipo

Hay que servirlo por HTTP. Abrir `index.html` con doble clic **no funciona**: el navegador bloquea
la lectura de los JSON bajo el protocolo `file://`, y la aplicación lo detecta y lo explica en
pantalla en lugar de fallar en silencio.

```
cd "C:\ProyectosClaude\SAT-ITM\App Descriptiva\app"
python -m http.server 8000
```

Después, en el navegador:

| Qué | Dirección |
|---|---|
| Tablero | <http://localhost:8000/> |
| Pruebas | <http://localhost:8000/pruebas/pruebas.html> |

Para detener el servidor, `Ctrl+C` en esa consola.

---

## Qué datos usa

La aplicación intenta cargar `datos/` y, **solo si esa carpeta no existe**, cae a `datos-demo/`.
Cuando está en modo de demostración lo dice con una insignia naranja en la cabecera y un aviso
en la parte superior del contenido, para que nadie confunda cifras simuladas con cifras reales.

| Carpeta | Contenido | Quién la genera |
|---|---|---|
| `datos/` | Agregados reales publicados por el pipeline | `src/app/00_construir_agregados.py` |
| `datos-demo/` | Cifras **simuladas** que cumplen el mismo contrato | `generar_datos_demo.py` (semilla fija) |

Para regenerar los datos de demostración:

```
python -I generar_datos_demo.py
```

---

## Pruebas

**1. Pruebas de las funciones del tablero** — <http://localhost:8000/pruebas/pruebas.html>

Unos sesenta casos sobre las funciones puras: roles de estado según el fenómeno, la metodología
y cada tratamiento; selección de la partición de metodología; rollup con filtros combinados;
tratamiento de la censura; detección de atípicos; tablas de contingencia; Pearson y Spearman;
formato de CSV; y una prueba de integración contra los datos publicados. Los datos de las pruebas
unitarias son sintéticos y están escritos a mano dentro del propio archivo.

La barra superior queda verde si pasan todas y naranja si falla alguna.

**2. Contraste del motor de cálculo contra las cifras publicadas**

```
python -I pruebas/verificar_motor.py
```

Replica en Python las reglas que implementa `js/datos.js` y comprueba que reproducen, cifra por
cifra, las 12 tasas de ausentismo de Permanencia y las 7 de la tabla institucional de deserción
recogidas en `datos/VERIFICACION.md`. Devuelve código de salida 0 si todas coinciden.

**3. Verificación de sintaxis sin Node.js**

No hay Node en el equipo, pero Windows trae un motor de JavaScript. El procedimiento está en
`pruebas/README_sintaxis.md`.

---

## Cómo publicarlo en GitHub Pages

Todas las rutas del sitio son relativas, así que funciona en una subruta del tipo
`usuario.github.io/sat-itm-descriptiva/` sin cambiar nada.

1. Crear el repositorio y copiar **el contenido de esta carpeta `app/`** en su raíz.
2. En el repositorio: *Settings* → *Pages* → *Source: Deploy from a branch* → rama `main`, carpeta `/ (root)`.
3. Esperar un par de minutos y abrir la dirección que indica GitHub.

`robots.txt` y la etiqueta `<meta name="robots" content="noindex, nofollow, noarchive">` impiden
que los buscadores indexen el prototipo.

---

## Estructura

```
app/
  index.html                 estructura, pestañas y textos fijos
  robots.txt                 bloqueo de indexación
  css/estilos.css            sistema de diseño: colores de marca, tipografía, espaciado
  js/datos.js                carga, normalización, motor de tasas  (funciones puras)
  js/filtros.js              barra lateral construida desde meta.json y socio.json
  js/graficos.js             envoltorio de Plotly con el tema y las reglas de calidad
  js/tablas.js               tablas, contingencia, correlaciones y CSV
  js/app.js                  orquestador: estado, pestañas y pintado
  img/logo_itm.png           logo institucional
  datos/                     agregados reales (los produce el pipeline)
  datos-demo/                agregados simulados de respaldo
  pruebas/pruebas.html       pruebas de las funciones del tablero
  pruebas/verificar_motor.py contraste contra las cifras publicadas
  generar_datos_demo.py      generador de los datos simulados
```

---

## Decisiones de diseño que conviene conocer

- **Colores.** Todo el cromo de la aplicación se deriva de dos valores de marca: azul `#0C215B` y
  gris `#5A6472`. Los gráficos usan la paleta Okabe-Ito, diseñada para que se distinga con
  daltonismo, y una escala secuencial de tonos del azul institucional para las intensidades.
- **Cero no es lo mismo que faltante.** Si no hay denominador, la tasa es un hueco en el gráfico y
  una raya en la tabla, nunca un cero.
- **Censura.** Si un semestre no tiene eventos confirmados pero sí casos censurados, la tasa se
  deja vacía con una nota, en lugar de dibujar una caída a cero que diría lo contrario de lo que pasa.
- **Decimales.** El número de decimales depende de la n: con menos de 30 observaciones no se
  muestra ninguno y aparece un aviso de cifra inestable.
- **Supresión.** Los grupos con menos de 5 estudiantes no se desglosan. La regla, implementada en
  `SAT.rollup` y cubierta por las pruebas, es:
  1. **Sin filtro de dimensión**, esos estudiantes **sí cuentan**: son reales y el total tiene que
     cuadrar. El total institucional de la metodología `itm` da 279 564 exacto, que son las filas del
     archivo de origen.
  2. **Con un filtro de facultad, programa, modalidad o nivel activo, no cuentan**: su dimensión está
     oculta y atribuirlos a la categoría elegida la inflaría con estudiantes que podrían ser de
     cualquier otra. La aplicación avisa en pantalla cuántos quedaron fuera.
  3. Por eso **la suma de las facultades puede no dar el total institucional**. La diferencia aparece
     como una fila etiquetada «No publicable (grupos menores de 5 estudiantes)» en las tablas de
     desglose, con su conteo, para que se vea por qué no cuadra en lugar de parecer un error.
     En los datos publicados afecta a 30 registros de 279 564, el 0,01 %.
- **Eje desde cero** en todas las barras, y ninguna gráfica de torta.
