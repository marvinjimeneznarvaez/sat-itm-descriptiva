/* ==========================================================================
   SAT-ITM · tablas.js
   Dibujo de tablas descriptivas y de doble entrada, y descarga en CSV.
   Regla de reporte: el conteo nunca va solo, siempre con su denominador.
   ========================================================================== */
(function (global) {
  'use strict';
  var SAT = global.SAT = global.SAT || {};
  var T = SAT.tablas = {};

  /* ---------------------------------------------------------------------
     CSV. Funcion pura: se prueba en pruebas/pruebas.html
     --------------------------------------------------------------------- */
  function escapaCSV(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  T.escapaCSV = escapaCSV;

  /**
   * Construye un CSV con separador punto y coma y coma decimal,
   * que es lo que Excel en configuracion regional de Colombia espera.
   */
  function aCSV(columnas, filas) {
    var lineas = [columnas.map(escapaCSV).join(';')];
    filas.forEach(function (f) {
      lineas.push(f.map(function (v) {
        if (typeof v === 'number') {
          if (v === null || isNaN(v)) return '';
          return String(v).replace('.', ',');
        }
        return escapaCSV(v);
      }).join(';'));
    });
    return lineas.join('\r\n');
  }
  T.aCSV = aCSV;

  function descargarCSV(nombre, columnas, filas, notas) {
    var txt = aCSV(columnas, filas);
    if (notas && notas.length) {
      txt += '\r\n\r\n' + notas.map(function (n) { return escapaCSV(n); }).join('\r\n');
    }
    // BOM para que Excel reconozca UTF-8 y no rompa las tildes.
    var blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (nombre || 'sat-itm-tabla') + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  T.descargarCSV = descargarCSV;

  /* ---------------------------------------------------------------------
     Dibujo
     --------------------------------------------------------------------- */
  /**
   * @param {HTMLElement} cont
   * @param {Object} d {columnas, filas, pie, leyenda, clasesFila}
   *   Cada celda puede ser un valor simple o {texto, clase, titulo}.
   */
  function dibuja(cont, d) {
    cont.innerHTML = '';
    var env = document.createElement('div');
    env.className = 'tabla-envoltura';
    var tb = document.createElement('table');
    tb.className = 'tabla';

    if (d.leyenda) {
      var cap = document.createElement('caption');
      cap.textContent = d.leyenda;
      tb.appendChild(cap);
    }

    var thead = document.createElement('thead');
    var tr = document.createElement('tr');
    d.columnas.forEach(function (c) {
      var th = document.createElement('th');
      th.setAttribute('scope', 'col');
      th.textContent = typeof c === 'object' ? c.texto : c;
      if (typeof c === 'object' && c.titulo) th.title = c.titulo;
      tr.appendChild(th);
    });
    thead.appendChild(tr); tb.appendChild(thead);

    var tbody = document.createElement('tbody');
    d.filas.forEach(function (f, i) {
      var r = document.createElement('tr');
      f.forEach(function (celda, j) {
        var td = document.createElement(j === 0 ? 'th' : 'td');
        if (j === 0) td.setAttribute('scope', 'row');
        if (celda && typeof celda === 'object' && !Array.isArray(celda)) {
          td.textContent = celda.texto;
          if (celda.clase) td.className = celda.clase;
          if (celda.titulo) td.title = celda.titulo;
        } else {
          td.textContent = celda === null || celda === undefined ? '—' : celda;
          if (celda === null || celda === undefined) td.className = 'sin-dato';
        }
        r.appendChild(td);
      });
      if (d.clasesFila && d.clasesFila[i]) r.className = d.clasesFila[i];
      tbody.appendChild(r);
    });
    tb.appendChild(tbody);

    if (d.pie && d.pie.length) {
      var tf = document.createElement('tfoot');
      var rf = document.createElement('tr');
      d.pie.forEach(function (c, j) {
        var td = document.createElement(j === 0 ? 'th' : 'td');
        if (j === 0) td.setAttribute('scope', 'row');
        td.textContent = c === null || c === undefined ? '—' : c;
        rf.appendChild(td);
      });
      tf.appendChild(rf); tb.appendChild(tf);
    }

    env.appendChild(tb);
    cont.appendChild(env);
  }
  T.dibuja = dibuja;

  /* ---------------------------------------------------------------------
     Tabla de doble entrada con porcentajes por fila y por columna
     --------------------------------------------------------------------- */
  /**
   * @param {number[][]} z  matriz de conteos [fila][columna]
   * @returns {{totalFila:number[], totalCol:number[], total:number,
   *            pctFila:number[][], pctCol:number[][], esperados:number[][],
   *            chi2:number, gl:number, v:number}}
   * Funcion pura.
   */
  function contingencia(z) {
    var nf = z.length, nc = nf ? z[0].length : 0;
    var totalFila = new Array(nf).fill(0);
    var totalCol = new Array(nc).fill(0);
    var total = 0;
    for (var i = 0; i < nf; i++) {
      for (var j = 0; j < nc; j++) {
        var v = z[i][j] || 0;
        totalFila[i] += v; totalCol[j] += v; total += v;
      }
    }
    var pctFila = [], pctCol = [], esperados = [], chi2 = 0;
    for (i = 0; i < nf; i++) {
      pctFila.push([]); pctCol.push([]); esperados.push([]);
      for (j = 0; j < nc; j++) {
        var x = z[i][j] || 0;
        pctFila[i].push(totalFila[i] ? 100 * x / totalFila[i] : null);
        pctCol[i].push(totalCol[j] ? 100 * x / totalCol[j] : null);
        var e = total ? totalFila[i] * totalCol[j] / total : 0;
        esperados[i].push(e);
        if (e > 0) chi2 += Math.pow(x - e, 2) / e;
      }
    }
    var gl = (nf - 1) * (nc - 1);
    var minDim = Math.min(nf - 1, nc - 1);
    var v = (total > 0 && minDim > 0) ? Math.sqrt(chi2 / (total * minDim)) : null;
    return { totalFila: totalFila, totalCol: totalCol, total: total,
      pctFila: pctFila, pctCol: pctCol, esperados: esperados,
      chi2: chi2, gl: gl, v: v };
  }
  T.contingencia = contingencia;

  /* ---------------------------------------------------------------------
     Correlaciones calculadas sobre pares ya agregados
     --------------------------------------------------------------------- */
  /** Pearson entre dos vectores. Funcion pura. */
  function pearson(x, y) {
    var n = Math.min(x.length, y.length);
    if (n < 3) return null;
    var sx = 0, sy = 0;
    for (var i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
    var mx = sx / n, my = sy / n, num = 0, dx = 0, dy = 0;
    for (i = 0; i < n; i++) {
      var a = x[i] - mx, b = y[i] - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    if (dx === 0 || dy === 0) return null;
    return num / Math.sqrt(dx * dy);
  }
  T.pearson = pearson;

  /** Rangos con promedio en los empates. Funcion pura. */
  function rangos(v) {
    var idx = v.map(function (x, i) { return [x, i]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var r = new Array(v.length);
    var i = 0;
    while (i < idx.length) {
      var j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      var medio = (i + j) / 2 + 1;
      for (var k = i; k <= j; k++) r[idx[k][1]] = medio;
      i = j + 1;
    }
    return r;
  }
  T.rangos = rangos;

  /** Spearman: Pearson sobre los rangos. Funcion pura. */
  function spearman(x, y) { return pearson(rangos(x), rangos(y)); }
  T.spearman = spearman;

  /** Lectura verbal del tamano de una correlacion, para directivos. */
  function interpretaR(r) {
    if (r === null || r === undefined || isNaN(r)) return 'sin dato suficiente';
    var a = Math.abs(r);
    var fuerza = a < 0.10 ? 'practicamente nula'
      : a < 0.30 ? 'debil' : a < 0.50 ? 'moderada' : a < 0.70 ? 'fuerte' : 'muy fuerte';
    var signo = r > 0 ? 'positiva' : 'negativa';
    return 'asociacion ' + fuerza + ' ' + signo;
  }
  T.interpretaR = interpretaR;

})(window);
