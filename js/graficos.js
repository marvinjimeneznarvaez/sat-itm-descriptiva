/* ==========================================================================
   SAT-ITM · graficos.js
   Envoltorio de Plotly con el tema institucional y las reglas de calidad:
   eje Y desde cero en barras, titulo con unidades y n, marcas de fuente,
   periodos provisionales punteados y aviso de cifra inestable.
   ========================================================================== */
(function (global) {
  'use strict';
  var SAT = global.SAT = global.SAT || {};
  var G = SAT.graficos = {};
  var P = SAT.PALETA;

  var CONFIG = {
    responsive: true,
    displaylogo: false,
    locale: 'es',
    toImageButtonOptions: { format: 'png', scale: 2, filename: 'sat-itm-grafico' },
    modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d']
  };
  G.CONFIG = CONFIG;

  var FUENTE = { family: 'Segoe UI, Helvetica Neue, Arial, sans-serif', size: 12, color: '#323944' };

  /** Layout base comun a todos los graficos. */
  function base(titulo, subtitulo, extra) {
    var l = {
      font: FUENTE,
      title: {
        text: '<b>' + titulo + '</b>' +
          (subtitulo ? '<br><span style="font-size:11px;color:#5A6472">' + subtitulo + '</span>' : ''),
        font: { size: 14, color: P.azul }, x: 0, xanchor: 'left', y: 0.97, yanchor: 'top'
      },
      margin: { l: 62, r: 26, t: subtitulo ? 70 : 52, b: 60 },
      paper_bgcolor: '#FFFFFF', plot_bgcolor: '#FFFFFF',
      hoverlabel: { bgcolor: '#06122F', font: { color: '#FFFFFF', size: 12 } },
      legend: { orientation: 'h', y: -0.22, x: 0, font: { size: 11 } },
      xaxis: { gridcolor: '#EFF1F4', linecolor: '#C3C9D1', tickfont: { size: 11 }, automargin: true },
      yaxis: { gridcolor: '#EFF1F4', linecolor: '#C3C9D1', tickfont: { size: 11 }, automargin: true }
    };
    if (extra) Object.keys(extra).forEach(function (k) { l[k] = extra[k]; });
    return l;
  }
  G.base = base;

  function dibuja(id, trazas, layout, config) {
    var nodo = document.getElementById(id);
    if (!nodo) return;
    if (!global.Plotly) { nodo.innerHTML = '<p class="aviso aviso--atencion">No se pudo cargar Plotly.js desde el CDN. Revise la conexion a internet.</p>'; return; }
    global.Plotly.react(nodo, trazas, layout, config || CONFIG);
  }
  G.dibuja = dibuja;

  G.descargarPNG = function (id, nombre) {
    if (!global.Plotly) return;
    global.Plotly.downloadImage(document.getElementById(id),
      { format: 'png', scale: 2, filename: nombre || 'sat-itm-grafico' });
  };

  /* =====================================================================
     Marcas de calidad sobre el eje de tiempo
     ===================================================================== */

  /**
   * Bandas de fondo por fuente de la serie y anotaciones de atipicos.
   * `extra.atipicos` permite anadir atipicos detectados en ejecucion cuando
   * meta.json no los declara; se etiquetan como deteccion automatica.
   */
  function marcasTemporales(meta, periodos, extra) {
    var shapes = [], anots = [];
    var pos = {}; periodos.forEach(function (p, i) { pos[p] = i; });

    (meta.fuentes_serie || []).forEach(function (fu, k) {
      var i0 = pos[fu.desde], i1 = pos[fu.hasta];
      if (i0 === undefined) i0 = 0;
      if (i1 === undefined) i1 = periodos.length - 1;
      if (i1 < 0 || i0 > periodos.length - 1 || i1 < i0) return;
      shapes.push({
        type: 'rect', xref: 'x', yref: 'paper',
        x0: i0 - 0.5, x1: i1 + 0.5, y0: 0, y1: 1,
        fillcolor: k % 2 === 0 ? 'rgba(12,33,91,0.055)' : 'rgba(90,100,114,0.03)',
        line: { width: 0 }, layer: 'below'
      });
      anots.push({
        x: (i0 + i1) / 2, y: 1.045, xref: 'x', yref: 'paper', showarrow: false,
        text: 'Fuente: ' + fu.etiqueta, font: { size: 10, color: P.gris }
      });
    });

    (meta.periodos_atipicos || []).forEach(function (a) {
      var i = pos[a.periodo];
      if (i === undefined) return;
      shapes.push({
        type: 'line', xref: 'x', yref: 'paper', x0: i, x1: i, y0: 0, y1: 1,
        line: { color: P.alerta, width: 1.5, dash: 'dot' }, layer: 'below'
      });
      anots.push({
        x: i, y: 0.02, xref: 'x', yref: 'paper', text: 'atipico',
        showarrow: false, font: { size: 10, color: P.alerta },
        bgcolor: 'rgba(255,255,255,.85)'
      });
    });

    ((extra && extra.anomalias) || []).forEach(function (a) {
      shapes.push({
        type: 'rect', xref: 'x', yref: 'paper', x0: a.indice - 0.5, x1: a.indice + 0.5,
        y0: 0, y1: 1, fillcolor: 'rgba(213,94,0,0.10)', line: { width: 0 }, layer: 'below'
      });
      anots.push({
        x: a.indice, y: 1.01, xref: 'x', yref: 'paper', text: 'anomalia de origen',
        showarrow: false, font: { size: 9, color: P.alerta }, bgcolor: 'rgba(255,255,255,.88)'
      });
    });

    ((extra && extra.atipicos) || []).forEach(function (a) {
      shapes.push({
        type: 'line', xref: 'x', yref: 'paper', x0: a.indice, x1: a.indice, y0: 0, y1: 1,
        line: { color: P.alerta, width: 1.5, dash: 'dot' }, layer: 'below'
      });
      anots.push({
        x: a.indice, y: 0.03, xref: 'x', yref: 'paper',
        text: 'atipico (z robusto ' + (a.z > 0 ? '+' : '') + a.z.toFixed(1) + ')',
        showarrow: false, font: { size: 9, color: P.alerta },
        bgcolor: 'rgba(255,255,255,.88)'
      });
    });
    return { shapes: shapes, annotations: anots };
  }
  G.marcasTemporales = marcasTemporales;

  /** Indices de los periodos marcados como provisionales dentro de la ventana. */
  function indicesProvisionales(meta, periodos, extra) {
    var set = {}; (meta.periodos_provisionales || []).forEach(function (p) { set[p] = 1; });
    var out = [];
    periodos.forEach(function (p, i) { if (set[p]) out.push(i); });
    ((extra && extra.provisionales) || []).forEach(function (i) {
      if (out.indexOf(i) < 0) out.push(i);
    });
    return out.sort(function (a, b) { return a - b; });
  }
  G.indicesProvisionales = indicesProvisionales;

  /**
   * Serie de linea que dibuja punteado el tramo provisional y marcador hueco.
   * Devuelve un array de trazas.
   */
  function lineaConProvisional(x, y, nombre, color, provis) {
    var hayProv = provis.length > 0;
    if (!hayProv) {
      return [{
        type: 'scatter', mode: 'lines+markers', name: nombre, x: x, y: y,
        line: { color: color, width: 2.4 }, marker: { color: color, size: 7 },
        connectgaps: false,
        hovertemplate: '%{x}<br>' + nombre + ': %{y:.1f} %<extra></extra>'
      }];
    }
    var corte = Math.min.apply(null, provis);
    var yFirme = y.map(function (v, i) { return i <= corte ? v : null; });
    var yProv = y.map(function (v, i) { return i >= corte ? v : null; });
    return [
      { type: 'scatter', mode: 'lines+markers', name: nombre, x: x, y: yFirme,
        line: { color: color, width: 2.4 }, marker: { color: color, size: 7 },
        connectgaps: false,
        hovertemplate: '%{x}<br>' + nombre + ': %{y:.1f} %<extra></extra>' },
      { type: 'scatter', mode: 'lines+markers', name: nombre + ' (provisional)', x: x, y: yProv,
        line: { color: color, width: 2.4, dash: 'dot' },
        marker: { color: '#FFFFFF', size: 8, line: { color: color, width: 2 } },
        connectgaps: false, showlegend: true,
        hovertemplate: '%{x}<br>' + nombre + ': %{y:.1f} % (provisional)<extra></extra>' }
    ];
  }
  G.lineaConProvisional = lineaConProvisional;

  /* =====================================================================
     G1 · Combo: barras apiladas de conteos + linea de tasa
     ===================================================================== */
  function comboApilado(id, d) {
    // d: {periodos, evento[], resto[], tasa[], etiquetaEvento, etiquetaResto, titulo, sub, meta}
    var marcas = marcasTemporales(d.meta, d.periodos, d.marcas);
    var provis = indicesProvisionales(d.meta, d.periodos, d.marcas);
    var x = d.periodos.map(function (_, i) { return i; });
    var trazas = [
      { type: 'bar', name: d.etiquetaResto, x: x, y: d.resto,
        marker: { color: P.categorica[7] },
        hovertemplate: '%{customdata}<br>' + d.etiquetaResto + ': %{y:,.0f}<extra></extra>',
        customdata: d.periodos },
      { type: 'bar', name: d.etiquetaEvento, x: x, y: d.evento,
        marker: { color: P.categorica[1] },
        hovertemplate: '%{customdata}<br>' + d.etiquetaEvento + ': %{y:,.0f}<extra></extra>',
        customdata: d.periodos }
    ];
    lineaConProvisional(x, d.tasa, 'Tasa (%)', P.azul, provis).forEach(function (t) {
      t.yaxis = 'y2'; t.customdata = d.periodos;
      t.hovertemplate = '%{customdata}<br>Tasa: %{y:.1f} %<extra></extra>';
      trazas.push(t);
    });
    var l = base(d.titulo, d.sub, {
      barmode: 'stack',
      shapes: marcas.shapes, annotations: marcas.annotations,
      xaxis: { gridcolor: '#EFF1F4', linecolor: '#C3C9D1', tickmode: 'array',
        tickvals: x, ticktext: d.periodos, tickangle: -45, tickfont: { size: 10 }, automargin: true },
      yaxis: { title: 'Estudiantes', rangemode: 'tozero', gridcolor: '#EFF1F4', automargin: true },
      yaxis2: { title: 'Tasa (%)', overlaying: 'y', side: 'right', rangemode: 'tozero',
        showgrid: false, ticksuffix: ' %', automargin: true },
      margin: { l: 66, r: 66, t: 74, b: 76 }
    });
    dibuja(id, trazas, l);
  }
  G.comboApilado = comboApilado;

  /* =====================================================================
     G1-bis · Dos paneles alineados que comparten el eje de tiempo
     ===================================================================== */
  function panelesAlineados(id, d) {
    var marcas = marcasTemporales(d.meta, d.periodos, d.marcas);
    var provis = indicesProvisionales(d.meta, d.periodos, d.marcas);
    var x = d.periodos.map(function (_, i) { return i; });
    var trazas = [
      { type: 'bar', name: d.etiquetaResto, x: x, y: d.resto, marker: { color: P.categorica[7] },
        customdata: d.periodos, hovertemplate: '%{customdata}<br>' + d.etiquetaResto + ': %{y:,.0f}<extra></extra>' },
      { type: 'bar', name: d.etiquetaEvento, x: x, y: d.evento, marker: { color: P.categorica[1] },
        customdata: d.periodos, hovertemplate: '%{customdata}<br>' + d.etiquetaEvento + ': %{y:,.0f}<extra></extra>' }
    ];
    lineaConProvisional(x, d.tasa, 'Tasa (%)', P.azul, provis).forEach(function (t) {
      t.xaxis = 'x2'; t.yaxis = 'y2'; t.customdata = d.periodos;
      t.hovertemplate = '%{customdata}<br>Tasa: %{y:.1f} %<extra></extra>';
      trazas.push(t);
    });
    var sh = [], an = marcas.annotations.slice();
    marcas.shapes.forEach(function (s) {
      sh.push(s);
      var s2 = JSON.parse(JSON.stringify(s)); s2.xref = 'x2'; sh.push(s2);
    });
    var l = base(d.titulo, d.sub + ' · Dos paneles con el mismo eje de tiempo: evita comparar dos escalas en el mismo marco.', {
      barmode: 'stack', shapes: sh, annotations: an,
      // Dos paneles apilados con dominios explicitos: mas predecible que `grid`
      // y conserva el mismo eje de tiempo en los dos.
      xaxis: { domain: [0, 1], anchor: 'y', matches: 'x2', showticklabels: false,
        gridcolor: '#EFF1F4', automargin: true },
      yaxis: { domain: [0.46, 1], title: 'Estudiantes', rangemode: 'tozero', gridcolor: '#EFF1F4', automargin: true },
      xaxis2: { domain: [0, 1], anchor: 'y2', tickmode: 'array', tickvals: x, ticktext: d.periodos,
        tickangle: -45, tickfont: { size: 10 }, gridcolor: '#EFF1F4', automargin: true },
      yaxis2: { domain: [0, 0.34], title: 'Tasa (%)', rangemode: 'tozero', ticksuffix: ' %',
        gridcolor: '#EFF1F4', automargin: true },
      margin: { l: 66, r: 26, t: 86, b: 76 }
    });
    dibuja(id, trazas, l);
  }
  G.panelesAlineados = panelesAlineados;

  /* =====================================================================
     G3 · Lineas multiples por categoria
     ===================================================================== */
  function lineasMultiples(id, d) {
    // d: {periodos, series:[{nombre, valores[]}], titulo, sub, meta, unidad}
    var marcas = marcasTemporales(d.meta, d.periodos, d.marcas);
    var provis = indicesProvisionales(d.meta, d.periodos, d.marcas);
    var x = d.periodos.map(function (_, i) { return i; });
    var trazas = [];
    d.series.forEach(function (s, k) {
      var color = P.categorica[k % P.categorica.length];
      lineaConProvisional(x, s.valores, s.nombre, color, provis).forEach(function (t) {
        t.customdata = d.periodos;
        t.hovertemplate = '%{customdata}<br>' + s.nombre + ': %{y:.1f}' + (d.unidad || ' %') + '<extra></extra>';
        if (t.name.indexOf('provisional') >= 0) t.showlegend = false;
        trazas.push(t);
      });
    });
    var l = base(d.titulo, d.sub, {
      shapes: marcas.shapes, annotations: marcas.annotations,
      xaxis: { tickmode: 'array', tickvals: x, ticktext: d.periodos, tickangle: -45,
        tickfont: { size: 10 }, gridcolor: '#EFF1F4', automargin: true },
      yaxis: { title: d.tituloY || 'Tasa (%)', rangemode: 'tozero', ticksuffix: d.unidad || ' %',
        gridcolor: '#EFF1F4', automargin: true },
      margin: { l: 66, r: 26, t: 74, b: 80 }
    });
    dibuja(id, trazas, l);
  }
  G.lineasMultiples = lineasMultiples;

  /* =====================================================================
     G2 / Comparacion · Barras ordenadas con eje desde cero
     ===================================================================== */
  function barrasOrdenadas(id, d) {
    // d: {categorias[], valores[], ns[], titulo, sub, tituloX, horizontal, ordenar}
    var filas = d.categorias.map(function (c, i) {
      return { c: c, v: d.valores[i], n: d.ns ? d.ns[i] : null };
    }).filter(function (f) { return f.v !== null && f.v !== undefined && !isNaN(f.v); });
    if (d.ordenar !== false) filas.sort(function (a, b) { return b.v - a.v; });

    var colores = filas.map(function (f) {
      return (f.n !== null && f.n < 30) ? P.categorica[7] : P.azul;
    });
    var textos = filas.map(function (f) {
      return (d.esPorcentaje === false ? SAT.fmt.num(f.v) : SAT.fmt.pct(f.v, f.n)) +
        (f.n !== null ? '  (n=' + SAT.fmt.num(f.n) + ')' : '');
    });
    var horiz = d.horizontal !== false && filas.length > 7;
    var traza = horiz
      ? { type: 'bar', orientation: 'h', y: filas.map(function (f) { return f.c; }).reverse(),
          x: filas.map(function (f) { return f.v; }).reverse(),
          marker: { color: colores.slice().reverse() },
          text: textos.slice().reverse(), textposition: 'outside', cliponaxis: false,
          hovertemplate: '%{y}<br>%{x:.2f}<extra></extra>' }
      : { type: 'bar', x: filas.map(function (f) { return f.c; }),
          y: filas.map(function (f) { return f.v; }),
          marker: { color: colores }, text: textos, textposition: 'outside', cliponaxis: false,
          hovertemplate: '%{x}<br>%{y:.2f}<extra></extra>' };
    var l = base(d.titulo, d.sub, horiz
      ? { xaxis: { title: d.tituloX || 'Tasa (%)', rangemode: 'tozero', gridcolor: '#EFF1F4', automargin: true },
          yaxis: { automargin: true, tickfont: { size: 11 } },
          margin: { l: 10, r: 110, t: 70, b: 56 } }
      : { xaxis: { tickangle: filas.length > 6 ? -30 : 0, automargin: true },
          yaxis: { title: d.tituloX || 'Tasa (%)', rangemode: 'tozero', gridcolor: '#EFF1F4', automargin: true },
          margin: { l: 66, r: 26, t: 70, b: 72 } });
    l.showlegend = false;
    dibuja(id, [traza], l);
  }
  G.barrasOrdenadas = barrasOrdenadas;

  /** Barras por nivel con la linea de tasa encima (G2 de la presentacion). */
  function barrasConLinea(id, d) {
    var trazas = [
      { type: 'bar', name: d.etiquetaConteo || 'Eventos', x: d.categorias, y: d.conteos,
        marker: { color: P.categorica[1] }, yaxis: 'y',
        hovertemplate: '%{x}<br>' + (d.etiquetaConteo || 'Eventos') + ': %{y:,.0f}<extra></extra>' },
      { type: 'scatter', mode: 'lines+markers+text', name: 'Tasa (%)', x: d.categorias, y: d.tasas,
        line: { color: P.azul, width: 2.4 }, marker: { size: 8, color: P.azul }, yaxis: 'y2',
        text: d.tasas.map(function (v, i) { return v === null ? '' : SAT.fmt.pct(v, d.ns ? d.ns[i] : null); }),
        textposition: 'top center', textfont: { size: 10, color: P.azul },
        hovertemplate: '%{x}<br>Tasa: %{y:.1f} %<extra></extra>' }
    ];
    var l = base(d.titulo, d.sub, {
      xaxis: { title: d.tituloX || '', type: 'category', automargin: true },
      yaxis: { title: 'Estudiantes', rangemode: 'tozero', gridcolor: '#EFF1F4', automargin: true },
      yaxis2: { title: 'Tasa (%)', overlaying: 'y', side: 'right', rangemode: 'tozero',
        showgrid: false, ticksuffix: ' %', automargin: true },
      margin: { l: 66, r: 66, t: 70, b: 60 }
    });
    dibuja(id, trazas, l);
  }
  G.barrasConLinea = barrasConLinea;

  /** Barras agrupadas: categoria x periodo (G4/G5 de la presentacion). */
  function barrasAgrupadas(id, d) {
    var trazas = d.series.map(function (s, k) {
      return {
        type: 'bar', name: s.nombre, x: d.categorias, y: s.valores,
        marker: { color: P.categorica[k % P.categorica.length] },
        hovertemplate: '%{x}<br>' + s.nombre + ': %{y:.1f} %<extra></extra>'
      };
    });
    var l = base(d.titulo, d.sub, {
      barmode: 'group',
      xaxis: { type: 'category', tickangle: -30, automargin: true },
      yaxis: { title: d.tituloY || 'Tasa (%)', rangemode: 'tozero', ticksuffix: ' %',
        gridcolor: '#EFF1F4', automargin: true },
      margin: { l: 66, r: 26, t: 70, b: 110 }
    });
    dibuja(id, trazas, l);
  }
  G.barrasAgrupadas = barrasAgrupadas;

  /* =====================================================================
     G6 · Mapa de calor
     ===================================================================== */
  function mapaCalor(id, d) {
    // d: {x[], y[], z[][], titulo, sub, unidad, textoCelda}
    var traza = {
      type: 'heatmap', x: d.x, y: d.y, z: d.z,
      colorscale: P.secuencial, hoverongaps: false,
      colorbar: { title: { text: d.unidad || '%', side: 'right' }, thickness: 14, len: 0.85,
        tickfont: { size: 10 } },
      hovertemplate: (d.etiquetaY || 'y') + ': %{y}<br>' + (d.etiquetaX || 'x') + ': %{x}<br>%{z:.1f} ' +
        (d.unidad || '%') + '<extra></extra>',
      xgap: 2, ygap: 2
    };
    if (d.textoCelda) {
      traza.text = d.textoCelda; traza.texttemplate = '%{text}';
      traza.textfont = { size: 10 };
    }
    var l = base(d.titulo, d.sub, {
      xaxis: { type: 'category', title: d.etiquetaX || '', tickangle: -45, automargin: true,
        showgrid: false },
      yaxis: { type: 'category', title: d.etiquetaY || '', automargin: true, showgrid: false },
      margin: { l: 80, r: 26, t: 70, b: 80 }
    });
    l.showlegend = false;
    dibuja(id, [traza], l);
  }
  G.mapaCalor = mapaCalor;

  /* =====================================================================
     Distribuciones
     ===================================================================== */
  function cajas(id, d) {
    // d: {grupos:[{nombre, min,q1,mediana,q3,max,media,n}], titulo, sub, tituloY}
    var trazas = d.grupos.map(function (g, k) {
      return {
        type: 'box', name: g.nombre + ' (n=' + SAT.fmt.num(g.n) + ')',
        q1: [g.q1], median: [g.mediana], q3: [g.q3],
        lowerfence: [g.min], upperfence: [g.max],
        mean: [g.media], boxmean: true,
        marker: { color: P.categorica[k % P.categorica.length] },
        line: { color: P.categorica[k % P.categorica.length] },
        fillcolor: P.categorica[k % P.categorica.length] + '33',
        hovertemplate: g.nombre + '<br>Mediana: ' + SAT.fmt.dec(g.mediana) +
          '<br>Q1–Q3: ' + SAT.fmt.dec(g.q1) + ' – ' + SAT.fmt.dec(g.q3) +
          '<br>n = ' + SAT.fmt.num(g.n) + '<extra></extra>'
      };
    });
    var l = base(d.titulo, d.sub, {
      yaxis: { title: d.tituloY || '', gridcolor: '#EFF1F4', automargin: true },
      xaxis: { automargin: true, showticklabels: false },
      margin: { l: 66, r: 26, t: 70, b: 56 }
    });
    dibuja(id, trazas, l);
  }
  G.cajas = cajas;

  function histograma(id, d) {
    // d: {series:[{nombre, bordes[], conteos[]}], titulo, sub, tituloX}
    var trazas = d.series.map(function (s, k) {
      var centros = [], anchos = [];
      for (var i = 0; i < s.conteos.length; i++) {
        centros.push((s.bordes[i] + s.bordes[i + 1]) / 2);
        anchos.push((s.bordes[i + 1] - s.bordes[i]) * 0.96);
      }
      var tot = s.conteos.reduce(function (a, b) { return a + b; }, 0) || 1;
      return {
        type: 'bar', name: s.nombre, x: centros, width: anchos,
        y: s.conteos.map(function (c) { return 100 * c / tot; }),
        marker: { color: P.categorica[k % P.categorica.length], opacity: 0.78 },
        hovertemplate: s.nombre + '<br>' + (d.tituloX || 'valor') + ': %{x:.2f}<br>%{y:.1f} % de su grupo<extra></extra>'
      };
    });
    var l = base(d.titulo, d.sub, {
      barmode: 'overlay',
      xaxis: { title: d.tituloX || '', gridcolor: '#EFF1F4', automargin: true },
      yaxis: { title: 'Porcentaje dentro del grupo (%)', rangemode: 'tozero', ticksuffix: ' %',
        gridcolor: '#EFF1F4', automargin: true },
      margin: { l: 66, r: 26, t: 70, b: 60 }
    });
    dibuja(id, trazas, l);
  }
  G.histograma = histograma;

  /* =====================================================================
     Sankey
     ===================================================================== */
  function sankey(id, d) {
    // d: {etiquetas[], colores[], origen[], destino[], valor[], titulo, sub}
    var traza = {
      type: 'sankey', orientation: 'h',
      arrangement: 'snap',
      node: {
        label: d.etiquetas, pad: 16, thickness: 18,
        color: d.colores, line: { color: '#FFFFFF', width: 1 },
        hovertemplate: '%{label}<br>%{value:,.0f} estudiantes<extra></extra>'
      },
      link: {
        source: d.origen, target: d.destino, value: d.valor,
        color: d.coloresEnlace,
        hovertemplate: '%{source.label} → %{target.label}<br>%{value:,.0f} estudiantes<extra></extra>'
      }
    };
    var l = base(d.titulo, d.sub, { margin: { l: 16, r: 16, t: 70, b: 26 } });
    l.font = { family: FUENTE.family, size: 11, color: '#323944' };
    dibuja(id, [traza], l);
  }
  G.sankey = sankey;

  /* =====================================================================
     Barra apilada horizontal unica (sustituye a la dona de dos categorias)
     ===================================================================== */
  function barraApiladaUnica(id, d) {
    // d: {partes:[{nombre, valor}], titulo, sub}
    var total = d.partes.reduce(function (a, b) { return a + b.valor; }, 0) || 1;
    var trazas = d.partes.map(function (p, k) {
      var pct = 100 * p.valor / total;
      return {
        type: 'bar', orientation: 'h', name: p.nombre, x: [p.valor], y: [''],
        marker: { color: k === 0 ? P.categorica[7] : P.categorica[1] },
        text: [p.nombre + ': ' + SAT.fmt.num(p.valor) + ' (' + SAT.fmt.pct(pct, total) + ')'],
        textposition: 'inside', insidetextanchor: 'middle',
        textfont: { color: '#FFFFFF', size: 12 },
        hovertemplate: p.nombre + ': %{x:,.0f}<extra></extra>'
      };
    });
    var l = base(d.titulo, d.sub, {
      barmode: 'stack',
      xaxis: { title: 'Estudiantes', rangemode: 'tozero', gridcolor: '#EFF1F4', automargin: true },
      yaxis: { showticklabels: false, showgrid: false },
      margin: { l: 16, r: 26, t: 70, b: 56 }, height: 210
    });
    dibuja(id, trazas, l);
  }
  G.barraApiladaUnica = barraApiladaUnica;

  G.redimensionar = function () {
    if (!global.Plotly) return;
    Array.prototype.forEach.call(document.querySelectorAll('.grafico'), function (n) {
      if (n.data) global.Plotly.Plots.resize(n);
    });
  };

})(window);
