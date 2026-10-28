/* ==========================================================================
   SAT-ITM · app.js
   Orquestador: carga, estado, pestanas y pintado. Rutas siempre relativas.
   Cada grafico lleva al pie la formula aplicada con los filtros activos.
   ========================================================================== */
(function (global) {
  'use strict';
  var SAT = global.SAT = global.SAT || {};
  var F = SAT.filtros, G = SAT.graficos, T = SAT.tablas, fmt = SAT.fmt;

  var est = { meta: null, hechos: null, socio: null, flujos: null, numericas: null,
              idx: null, filtros: null, origen: '', pestana: 'panorama' };
  SAT.estado = est;

  var UMBRAL_INESTABLE = 30;
  var modoG1 = 'combo';

  function $(id) { return document.getElementById(id); }
  function el(t, a, h) { return F.el(t, a, h); }
  function capital(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
  function suma(a, b) { return a + b; }
  function round(v) { return (v === null || v === undefined || isNaN(v)) ? null : Math.round(v * 1000) / 1000; }

  /* =====================================================================
     Arranque
     ===================================================================== */
  function arrancar() {
    if (location.protocol === 'file:') { mostrarErrorFile(); return; }
    SAT.cargar().then(function (d) {
      est.origen = d.origen;
      est.meta = d.meta; est.hechos = d.hechos; est.socio = d.socio;
      est.flujos = d.flujos; est.numericas = d.numericas;
      est.idx = SAT.indexa(est.meta, est.hechos);
      est.filtros = F.filtrosIniciales(est.meta);
      $('cargando').hidden = true;
      $('aplicacion').hidden = false;
      marcarOrigen();
      poblarSelectores();
      F.construir(est, $('panel-filtros'), refrescar);
      conectarPestanas();
      refrescar();
    }).catch(mostrarError);
  }

  function marcarOrigen() {
    var demo = est.origen.indexOf('datos-demo') >= 0;
    var ins = $('insignia-origen');
    ins.textContent = demo ? 'DATOS SIMULADOS DE DEMOSTRACION' : 'Datos v' + (est.meta.version || '');
    ins.className = 'insignia' + (demo ? ' insignia--demo' : '');
    ins.title = demo
      ? 'No se encontro la carpeta datos/: se estan mostrando cifras simuladas de datos-demo/.'
      : 'Datos publicados por el pipeline, version ' + (est.meta.version || 's/v');
    $('pie-version').textContent = est.meta.version || 's/v';
    $('pie-generado').textContent = est.meta.generado || 's/f';
    $('pie-umbral').textContent = String(est.meta.suprimido_umbral);
    $('pie-origen').textContent = est.origen;
    $('pie-fuente').textContent = (est.meta.fuente || []).join(' · ') || '—';
    if (demo) $('aviso-demo').hidden = false;
    var notas = est.meta.notas || [];
    if (notas.length) $('pie-notas').textContent = notas.join(' ');
  }

  function mostrarError(e) {
    $('cargando').hidden = true;
    $('error').hidden = false;
    $('error-detalle').textContent = String(e && e.message ? e.message : e);
  }

  function mostrarErrorFile() {
    $('cargando').hidden = true;
    $('error').hidden = false;
    $('error-titulo').textContent = 'Hay que servir la aplicacion por HTTP';
    $('error-detalle').textContent =
      'La pagina se abrio con doble clic (protocolo file://). Por seguridad el navegador bloquea ' +
      'la lectura de los archivos JSON en ese modo. Use el comando de abajo y abra la direccion que indica.';
  }

  /* =====================================================================
     Pestanas y barra
     ===================================================================== */
  function conectarPestanas() {
    var botones = document.querySelectorAll('.pestanas button');
    Array.prototype.forEach.call(botones, function (b) {
      b.addEventListener('click', function () { irAPestana(b.dataset.panel); });
      b.addEventListener('keydown', function (ev) {
        var l = Array.prototype.slice.call(botones), i = l.indexOf(b);
        if (ev.key === 'ArrowRight') { l[(i + 1) % l.length].focus(); ev.preventDefault(); }
        if (ev.key === 'ArrowLeft') { l[(i - 1 + l.length) % l.length].focus(); ev.preventDefault(); }
      });
    });
    $('alternar-barra').addEventListener('click', function () {
      var oculta = $('disposicion').classList.toggle('barra-oculta');
      this.setAttribute('aria-expanded', String(!oculta));
      this.querySelector('span:last-child').textContent = oculta ? 'Mostrar filtros' : 'Ocultar filtros';
      setTimeout(G.redimensionar, 60);
    });
    global.addEventListener('resize', debounce(G.redimensionar, 180));
  }

  function irAPestana(id) {
    est.pestana = id;
    Array.prototype.forEach.call(document.querySelectorAll('.pestanas button'), function (b) {
      b.setAttribute('aria-selected', String(b.dataset.panel === id));
    });
    Array.prototype.forEach.call(document.querySelectorAll('.panel'), function (p) {
      p.hidden = p.id !== 'panel-' + id;
    });
    refrescar();
  }

  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  /* =====================================================================
     Series
     ===================================================================== */
  function periodosVentana() { return est.meta.periodos.slice(est.filtros.p0, est.filtros.p1 + 1); }

  /**
   * Rollup recortado a la ventana, con la tasa que respeta la censura y las
   * marcas de periodo provisional y atipico ya calculadas.
   */
  function serie(agrupacion) {
    var r = SAT.rollup(est, agrupacion);
    var p0 = est.filtros.p0, p1 = est.filtros.p1;
    var periodos = est.meta.periodos.slice(p0, p1 + 1);
    var provisionales = [];
    var series = r.categorias.map(function (c, k) {
      var tasas = [], nums = [], dens = [], cens = [];
      for (var p = p0; p <= p1; p++) {
        nums.push(r.num[k][p]); dens.push(r.den[k][p]); cens.push(r.cen[k][p]);
        tasas.push(SAT.tasaConCensura(r.num[k][p], r.den[k][p], r.cen[k][p]));
      }
      return { nombre: c, clave: r.claves[k], tasas: tasas, nums: nums, dens: dens, cens: cens,
        totalNum: nums.reduce(suma, 0), totalDen: dens.reduce(suma, 0), totalCen: cens.reduce(suma, 0) };
    });
    // Un periodo con casos censurados y con eventos es provisional: faltan por confirmar.
    series.forEach(function (s) {
      s.cens.forEach(function (c, i) {
        if (c > 0 && s.nums[i] > 0 && provisionales.indexOf(i) < 0) provisionales.push(i);
      });
    });
    var atipicos = [];
    if (!(est.meta.periodos_atipicos || []).length && series.length === 1) {
      atipicos = SAT.atipicosRobustos(series[0].tasas, 3);
    }
    var anomalias = SAT.anomaliasAplicables(periodos, r.metodologia);
    return { periodos: periodos, series: series, suprimidas: r.suprimidas,
      suprimidasFuera: r.suprimidasFuera,
      desplazamiento: r.desplazamiento, metodologia: r.metodologia, mascaras: r.mascaras,
      marcas: { provisionales: provisionales, atipicos: atipicos, anomalias: anomalias } };
  }

  function subtitulo(n, extra) {
    var idMet = SAT.particionPara(est.meta, est.filtros.fenomeno, est.filtros.metodologia);
    var t = SAT.TEXTOS_METODOLOGIA[idMet] || {};
    var m = SAT.metodologiaPorId(est.meta, idMet) || {};
    var p = periodosVentana();
    return 'n = ' + fmt.num(n) + ' estudiantes-semestre · ' + p[0] + ' a ' + p[p.length - 1] +
      ' · ' + (t.titulo || m.nombre || idMet) + (extra ? ' · ' + extra : '');
  }

  /* =====================================================================
     Pie de formula: de donde sale el numero que se esta mirando
     ===================================================================== */
  function estadosDe(mascaras, cual) {
    var out = [];
    est.meta.estados.forEach(function (e, i) {
      if (mascaras[cual][i]) out.push(SAT.ETIQUETA_ESTADO[e] || e);
    });
    return out;
  }

  /** Inserta bajo un grafico la formula aplicada, en texto plano. */
  function pieFormula(idContenedor, r, s) {
    var cont = $(idContenedor);
    if (!cont) return;
    var fen = SAT.FENOMENOS[est.filtros.fenomeno];
    var tot = SAT.tasa(s.totalNum, s.totalDen);
    var p = r.periodos;
    var ult = s.tasas.length - 1;
    while (ult > 0 && s.tasas[ult] === null) ult--;

    var h = '<b>Tasa = ' + fen.evento + ' (' + fmt.num(s.totalNum) + ') ÷ matriculados (' +
      fmt.num(s.totalDen) + ') × 100 = ' + fmt.pct(tot, s.totalDen) + '</b> ' +
      'en toda la ventana ' + p[0] + ' a ' + p[p.length - 1] + '.';
    if (ult >= 0 && s.tasas[ult] !== null) {
      h += '<br>En <b>' + p[ult] + '</b>: ' + fmt.num(s.nums[ult]) + ' ÷ ' +
        fmt.num(s.dens[ult]) + ' × 100 = <b>' + fmt.pct(s.tasas[ult], s.dens[ult]) + '</b>.';
    }
    h += '<br>Cuentan como evento: <code>' + estadosDe(r.mascaras, 'evento').join(', ') +
      '</code>. Cuentan en el denominador: <code>' + estadosDe(r.mascaras, 'denominador').join(', ') + '</code>.';
    if (s.totalCen > 0) {
      h += '<br>' + fmt.num(s.totalCen) + ' estudiantes quedan <b>sin confirmar</b> (censurados): no entran ' +
        'ni en el numerador ni en el denominador, y los semestres afectados se dibujan punteados.';
    }
    cont.className = 'pie-formula';
    cont.innerHTML = h;
  }

  function avisoInestable(n) {
    if (n === null || n === undefined || n >= UMBRAL_INESTABLE) return null;
    return el('div', { clase: 'aviso aviso--atencion' }, [
      el('span', { clase: 'aviso__icono', 'aria-hidden': 'true', texto: '!' }),
      el('span', { texto: 'Cifra inestable: el subconjunto filtrado tiene ' + fmt.num(n) +
        ' observaciones, por debajo de 30. No conviene leer la variacion como una senal.' })
    ]);
  }

  /* =====================================================================
     Refresco
     ===================================================================== */
  function refrescar() {
    if (!est.meta) return;
    F.pintarResumen();
    pintarIndicadores();
    ({ panorama: pintarPanorama, tendencia: pintarTendencia, comparacion: pintarComparacion,
       distribuciones: pintarDistribuciones, bivariado: pintarBivariado,
       flujos: pintarFlujos, tablas: pintarTablas }[est.pestana] || function () {})();
  }
  SAT.refrescar = refrescar;

  /* =====================================================================
     Indicadores
     ===================================================================== */
  function pintarIndicadores() {
    var cont = $('indicadores'); cont.innerHTML = '';
    var r = serie('ninguna'), s = r.series[0];
    var c = SAT.conteoPorEstado(est);
    var iE = {}; est.meta.estados.forEach(function (e, i) { iE[e] = i; });

    var matriculados = (c[iE.MATRICULADO] || 0) + (c[iE.REINGRESO] || 0);
    var ausentes = c[iE.AUSENTE] || 0;
    var desertores = (c[iE.DESERTOR] || 0);
    var tasa = SAT.tasa(s.totalNum, s.totalDen);
    var me = SAT.margenError(s.totalNum, s.totalDen);
    var fen = SAT.FENOMENOS[est.filtros.fenomeno];

    cont.appendChild(tarjeta('Matriculados', fmt.num(matriculados),
      'Matriculados y reingresos en la ventana'));
    cont.appendChild(tarjeta('Ausentes', ausentes ? fmt.num(ausentes) : '—',
      ausentes ? 'No se matriculan el semestre siguiente'
               : 'Este estado no existe en la metodologia activa'));
    cont.appendChild(tarjeta('Desertores', desertores ? fmt.num(desertores) : '—',
      desertores ? 'Abandono confirmado del programa'
                 : 'Este estado no existe en la metodologia activa'));
    cont.appendChild(tarjeta('Tasa de ' + fen.etiqueta.toLowerCase(), fmt.pct(tasa, s.totalDen),
      (me !== null ? '± ' + fmt.dec(me, 1) + ' pp (IC 95 %) · ' : '') +
      'base: ' + fmt.num(s.totalDen), true));

    var ult = s.tasas.length - 1, variacion = null, texto = 'sin periodo anterior comparable';
    while (ult > 0 && s.tasas[ult] === null) ult--;
    var ant = ult - 1;
    while (ant > 0 && s.tasas[ant] === null) ant--;
    if (ult > 0 && ant >= 0 && s.tasas[ult] !== null && s.tasas[ant] !== null) {
      variacion = s.tasas[ult] - s.tasas[ant];
      texto = r.periodos[ult] + ' frente a ' + r.periodos[ant];
    }
    var v = tarjeta('Variacion del ultimo semestre',
      variacion === null ? '—'
        : (variacion >= 0 ? '+' : '−') + fmt.dec(Math.abs(variacion), 1) + ' pp', texto);
    if (variacion !== null) {
      var malo = est.filtros.fenomeno === 'permanencia' ? variacion < 0 : variacion > 0;
      v.querySelector('.indicador__cifra').style.color = Math.abs(variacion) < 0.05
        ? 'var(--gris-700)' : (malo ? 'var(--alerta)' : 'var(--favorable)');
    }
    cont.appendChild(v);

    var av = $('aviso-n'); av.innerHTML = '';
    var a = avisoInestable(s.totalDen); if (a) av.appendChild(a);
    var pieSup = $('pie-suprimido');
    if (pieSup) {
      pieSup.textContent = s.totalDen > 0
        ? fmt.dec(100 * (r.suprimidas + r.suprimidasFuera) / Math.max(s.totalDen, 1), 2) + ' %'
        : '—';
    }
    if (r.suprimidas > 0) {
      av.appendChild(el('div', { clase: 'aviso aviso--info' }, [
        el('span', { clase: 'aviso__icono', 'aria-hidden': 'true', texto: 'i' }),
        el('span', { texto: 'Los grupos con menos de ' + est.meta.suprimido_umbral + ' estudiantes no se ' +
          'muestran desglosados, por proteccion de datos. Esos estudiantes siguen contando en todos los ' +
          'totales y en todas las tasas: lo que se oculta es a que programa pertenecen, no su existencia. ' +
          'Aqui son ' + fmt.num(r.suprimidas) + ' registros, el ' +
          fmt.dec(100 * r.suprimidas / Math.max(s.totalDen, 1), 2) + ' % del total, y al desglosar ' +
          'aparecen agrupados bajo «' + SAT.ETIQUETA_NO_PUBLICABLE + '». Por eso la suma de ' +
          'las facultades puede no dar exactamente el total institucional: la diferencia son esos registros.' })
      ]));
    }
    if (r.suprimidasFuera > 0) {
      av.appendChild(el('div', { clase: 'aviso aviso--atencion' }, [
        el('span', { clase: 'aviso__icono', 'aria-hidden': 'true', texto: '!' }),
        el('span', { texto: 'Hay un filtro de facultad, programa, modalidad o nivel activo, asi que ' +
          fmt.num(r.suprimidasFuera) + ' registros de grupos menores de ' + est.meta.suprimido_umbral +
          ' estudiantes quedan FUERA de esta cifra: su dimension esta oculta y atribuirlos a la categoria ' +
          'elegida inflaria esa categoria con estudiantes que podrian ser de cualquier otra. ' +
          'Quite el filtro para verlos de nuevo en el total.' })
      ]));
    }
  }

  function tarjeta(titulo, cifra, pie, destacado) {
    return el('div', { clase: 'indicador' + (destacado ? ' indicador--destacado' : '') }, [
      el('div', { clase: 'indicador__titulo', texto: titulo }),
      el('div', { clase: 'indicador__cifra', texto: cifra }),
      el('div', { clase: 'indicador__pie', texto: pie })
    ]);
  }

  /* =====================================================================
     Panorama
     ===================================================================== */
  function pintarPanorama() {
    var r = serie('ninguna'), s = r.series[0];
    var fen = SAT.FENOMENOS[est.filtros.fenomeno];
    hallazgoNivel1();

    var datos = {
      periodos: r.periodos, evento: s.nums,
      resto: s.dens.map(function (d, i) { return Math.max(d - s.nums[i], 0); }),
      tasa: s.tasas, meta: est.meta, marcas: r.marcas,
      etiquetaEvento: capital(fen.evento), etiquetaResto: 'Resto de la base',
      titulo: 'Evolucion semestral de ' + fen.etiqueta.toLowerCase() + ' · conteos y tasa',
      sub: subtitulo(s.totalDen, 'eje de conteos desde cero')
    };
    if (modoG1 === 'combo') G.comboApilado('g-panorama-g1', datos);
    else G.panelesAlineados('g-panorama-g1', datos);
    pieFormula('formula-panorama-g1', r, s);
    var avA = $('aviso-anomalias'); avA.innerHTML = '';
    r.marcas.anomalias.forEach(function (a) {
      avA.appendChild(el('div', { clase: 'aviso aviso--atencion' }, [
        el('span', { clase: 'aviso__icono', 'aria-hidden': 'true', texto: '!' }),
        el('span', { texto: a.periodo + ': ' + a.nota })
      ]));
    });

    compararMetodologias();

    G.barraApiladaUnica('g-panorama-dona', {
      partes: [{ nombre: 'Resto de la base', valor: Math.max(s.totalDen - s.totalNum, 0) },
               { nombre: capital(fen.evento), valor: s.totalNum }],
      titulo: 'Reparto de la base en la ventana',
      sub: subtitulo(s.totalDen, 'barra apilada unica: se comparan longitudes, no angulos')
    });

    var rn = serie('nivel');
    var vivos = rn.series.map(function (s2, i) { return { s: s2, i: i }; })
      .filter(function (o) { return o.s.totalDen > 0; });
    G.mapaCalor('g-panorama-heatmap', {
      x: rn.periodos, y: vivos.map(function (o) { return o.s.nombre; }),
      z: vivos.map(function (o) { return o.s.tasas; }),
      textoCelda: vivos.map(function (o) {
        return o.s.tasas.map(function (v) { return v === null ? '' : v.toFixed(0); });
      }),
      etiquetaX: 'Semestre', etiquetaY: 'Nivel', unidad: '%',
      titulo: 'Tasa por nivel y semestre',
      sub: subtitulo(vivos.reduce(function (a, o) { return a + o.s.totalDen; }, 0),
        'mapa de calor en lugar de sesenta barras: aqui si se puede seguir un nivel en el tiempo. Celda en blanco = sin base, no cero')
    });
  }

  function hallazgoNivel1() {
    var cont = $('hallazgo'); cont.innerHTML = '';
    var i1 = F.indiceNivel1(est.meta);
    if (i1 === null) return;
    var guardado = est.filtros.niveles;

    est.filtros.niveles = [i1]; F.recalcularDerivados(est);
    var n1 = serie('ninguna').series[0];
    est.filtros.niveles = est.meta.niveles.map(function (_, i) { return i; })
      .filter(function (i) { return i !== i1; });
    F.recalcularDerivados(est);
    var resto = serie('ninguna').series[0];
    est.filtros.niveles = guardado; F.recalcularDerivados(est);

    var t1 = SAT.tasa(n1.totalNum, n1.totalDen), tr = SAT.tasa(resto.totalNum, resto.totalDen);
    if (t1 === null || tr === null) return;
    var veces = tr > 0 ? t1 / tr : null;
    var fen = SAT.FENOMENOS[est.filtros.fenomeno];

    var caja = el('div', { clase: 'aviso aviso--atencion' }, [
      el('span', { clase: 'aviso__icono', 'aria-hidden': 'true', texto: '▸' }),
      el('span', { html: 'Con los filtros activos, la tasa de <b>' + fen.etiqueta.toLowerCase() +
        '</b> del <b>nivel 1</b> es <b>' + fmt.pct(t1, n1.totalDen) + '</b> (' + fmt.num(n1.totalNum) +
        ' de ' + fmt.num(n1.totalDen) + ') frente a <b>' + fmt.pct(tr, resto.totalDen) + '</b> en los demas niveles (' +
        fmt.num(resto.totalNum) + ' de ' + fmt.num(resto.totalDen) + ')' +
        (veces ? ', es decir <b>' + fmt.dec(veces, 1) + ' veces</b> mas' : '') +
        '. El primer semestre concentra la mayor parte del problema.' })
    ]);
    var btn = el('button', { clase: 'boton', type: 'button', texto: 'Aislar el nivel 1 en toda la app' });
    btn.addEventListener('click', function () {
      est.filtros.niveles = [i1];
      F.construir(est, $('panel-filtros'), refrescar);
      F.recalcularDerivados(est); refrescar();
    });
    caja.appendChild(btn);
    cont.appendChild(caja);
  }

  function compararMetodologias() {
    var cont = $('comparar-metodologias'); cont.innerHTML = '';
    var guardadoFen = est.filtros.fenomeno, guardadoMet = est.filtros.metodologia;
    // Se muestran TODAS las metodologias publicadas, incluida la que no es opcion
    // del selector: esta ahi para trazar la cifra oficial de desercion anual.
    var combos = SAT.todasLasMetodologias(est.meta).map(function (m) {
      return { fen: m.fenomeno, met: m.id, enFiltro: m.enFiltro };
    });

    var cols = ['Metodologia', 'Que mide', 'Eventos', 'Base', 'Tasa', 'IC 95 % (± pp)', 'Cobertura'];
    var filas = [], crudas = [];
    combos.forEach(function (c) {
      est.filtros.fenomeno = c.fen;
      est.filtros.metodologiaForzada = c.met;
      est.filtros.metodologia = c.met;
      F.recalcularDerivados(est);
      var s = serie('ninguna').series[0];
      var t = SAT.tasa(s.totalNum, s.totalDen), me = SAT.margenError(s.totalNum, s.totalDen);
      var txt = SAT.TEXTOS_METODOLOGIA[c.met] || {};
      var m = SAT.metodologiaPorId(est.meta, c.met) || {};
      filas.push([(txt.titulo || m.nombre || c.met) + (c.enFiltro ? '' : ' (solo trazabilidad)'),
        txt.corto || m.descripcion || '',
        fmt.num(s.totalNum), fmt.num(s.totalDen),
        t === null ? '—' : fmt.pct(t, s.totalDen),
        me === null ? '—' : fmt.dec(me, 2), m.cobertura || '—']);
      crudas.push([txt.titulo || c.met, txt.corto || '', s.totalNum, s.totalDen, round(t), round(me),
        m.cobertura || '']);
    });
    est.filtros.fenomeno = guardadoFen; est.filtros.metodologia = guardadoMet;
    delete est.filtros.metodologiaForzada;
    F.recalcularDerivados(est);

    T.dibuja(cont, { columnas: cols, filas: filas,
      leyenda: 'La misma seleccion de filtros medida de las formas que publica la institucion. ' +
        'Las cifras no coinciden porque miden cosas distintas, no porque alguna este mal. ' +
        'La fila marcada «solo trazabilidad» reproduce la cifra oficial de desercion anual del ITM ' +
        'y no es una variante de denominador, por eso no esta en el selector.' });
    conectarCSV('csv-metodologias', 'sat-itm_comparacion-metodologias', cols, crudas);
  }

  /* =====================================================================
     Tendencia
     ===================================================================== */
  function pintarTendencia() {
    var agr = $('sel-agr-tendencia').value;
    var r = serie(agr);
    var total = r.series.reduce(function (a, s) { return a + s.totalDen; }, 0);
    var fen = SAT.FENOMENOS[est.filtros.fenomeno];

    if (agr === 'ninguna') {
      var s = r.series[0];
      var datos = {
        periodos: r.periodos, evento: s.nums,
        resto: s.dens.map(function (d, i) { return Math.max(d - s.nums[i], 0); }),
        tasa: s.tasas, meta: est.meta, marcas: r.marcas,
        etiquetaEvento: capital(fen.evento), etiquetaResto: 'Resto de la base',
        titulo: 'Evolucion semestral de ' + fen.etiqueta.toLowerCase(),
        sub: subtitulo(s.totalDen)
      };
      if (modoG1 === 'combo') G.comboApilado('g-tendencia-principal', datos);
      else G.panelesAlineados('g-tendencia-principal', datos);
      pieFormula('formula-tendencia', r, s);
    } else {
      G.lineasMultiples('g-tendencia-principal', {
        periodos: r.periodos, meta: est.meta, marcas: r.marcas,
        series: r.series.filter(function (x) { return x.totalDen > 0; })
          .map(function (x) { return { nombre: x.nombre, valores: x.tasas }; }),
        titulo: 'Tasa de ' + fen.etiqueta.toLowerCase() + ' por ' + etiquetaAgr(agr) + ', por semestre',
        sub: subtitulo(total, 'una linea por categoria; donde falta base la linea se interrumpe')
      });
      var mayor = r.series.slice().sort(function (a, b) { return b.totalDen - a.totalDen; })[0];
      if (mayor) pieFormula('formula-tendencia', r, mayor);
    }

    G.lineasMultiples('g-tendencia-conteos', {
      periodos: r.periodos, meta: est.meta, marcas: r.marcas, unidad: '', tituloY: 'Estudiantes',
      series: r.series.filter(function (x) { return x.totalNum > 0; })
        .map(function (x) { return { nombre: x.nombre, valores: x.nums }; }),
      titulo: 'Conteo de ' + fen.evento + ' por semestre',
      sub: subtitulo(total, 'el conteo no se lee sin su tasa, ni la tasa sin su conteo')
    });

    var av = $('aviso-tendencia'); av.innerHTML = '';
    if (r.marcas.provisionales.length) {
      av.appendChild(el('div', { clase: 'aviso aviso--atencion' }, [
        el('span', { clase: 'aviso__icono', 'aria-hidden': 'true', texto: '!' }),
        el('span', { texto: 'Hay semestres con casos sin confirmar: se dibujan con linea punteada y ' +
          'marcador hueco. Son provisionales porque todavia falta observar el semestre siguiente.' })
      ]));
    }
    r.marcas.anomalias.forEach(function (a) {
      av.appendChild(el('div', { clase: 'aviso aviso--atencion' }, [
        el('span', { clase: 'aviso__icono', 'aria-hidden': 'true', texto: '!' }),
        el('span', { texto: a.periodo + ': ' + a.nota })
      ]));
    });
    if (r.marcas.atipicos.length) {
      av.appendChild(el('div', { clase: 'aviso aviso--info' }, [
        el('span', { clase: 'aviso__icono', 'aria-hidden': 'true', texto: 'i' }),
        el('span', { texto: 'Deteccion automatica de atipicos (z robusto con mediana y MAD, umbral 3): ' +
          r.marcas.atipicos.map(function (a) { return r.periodos[a.indice]; }).join(', ') +
          '. Se marcan en el grafico para que no distorsionen la lectura de la tendencia.' })
      ]));
    }
  }

  function etiquetaAgr(a) {
    return { facultad: 'facultad', programa: 'programa', departamento: 'departamento',
      modalidad: 'modalidad del programa', nivel: 'nivel', nivel_formacion: 'nivel de formacion',
      ninguna: 'total' }[a] || a;
  }

  /* =====================================================================
     Comparacion
     ===================================================================== */
  function pintarComparacion() {
    var agr = $('sel-agr-comparacion').value;
    var r = serie(agr);
    var vivos = r.series.filter(function (s) { return s.totalDen > 0; });
    var total = vivos.reduce(function (a, s) { return a + s.totalDen; }, 0);
    var fen = SAT.FENOMENOS[est.filtros.fenomeno];

    G.barrasOrdenadas('g-comparacion-barras', {
      categorias: vivos.map(function (s) { return s.nombre; }),
      valores: vivos.map(function (s) { return SAT.tasa(s.totalNum, s.totalDen); }),
      ns: vivos.map(function (s) { return s.totalDen; }),
      titulo: 'Tasa de ' + fen.etiqueta.toLowerCase() + ' por ' + etiquetaAgr(agr) + ', ordenada',
      sub: subtitulo(total, 'eje desde cero · en gris, las categorias con menos de 30 observaciones'),
      tituloX: 'Tasa (%)'
    });
    var mayor = vivos.slice().sort(function (a, b) { return b.totalDen - a.totalDen; })[0];
    if (mayor) pieFormula('formula-comparacion', r, mayor);

    var rn = serie('nivel');
    var vn = rn.series.filter(function (s) { return s.totalDen > 0; });
    G.barrasConLinea('g-comparacion-nivel', {
      categorias: vn.map(function (s) { return s.nombre; }),
      conteos: vn.map(function (s) { return s.totalNum; }),
      tasas: vn.map(function (s) { return SAT.tasa(s.totalNum, s.totalDen); }),
      ns: vn.map(function (s) { return s.totalDen; }),
      etiquetaConteo: capital(fen.evento),
      titulo: 'Conteo y tasa por nivel del estudiante',
      tituloX: 'Nivel dentro del plan de estudios',
      sub: subtitulo(vn.reduce(function (a, s) { return a + s.totalDen; }, 0))
    });
    tablaNiveles(vn, fen);

    var vg = vivos.slice().sort(function (a, b) { return b.totalDen - a.totalDen; }).slice(0, 10);
    var nPer = r.periodos.length, paso = Math.max(1, Math.ceil(nPer / 6)), idxPer = [];
    for (var i = nPer - 1; i >= 0; i -= paso) idxPer.unshift(i);
    G.barrasAgrupadas('g-comparacion-agrupadas', {
      categorias: vg.map(function (s) { return s.nombre; }),
      series: idxPer.map(function (p) {
        return { nombre: r.periodos[p], valores: vg.map(function (s) { return s.tasas[p]; }) };
      }),
      titulo: 'Tasa por ' + etiquetaAgr(agr) + ' y semestre',
      sub: subtitulo(total, 'hasta 10 categorias y ' + idxPer.length +
        ' semestres, para que siga siendo legible. Ausencia de barra = sin base, no cero')
    });
  }

  function tablaNiveles(vn, fen) {
    var cols = ['Nivel', capital(fen.evento), 'Base', 'Tasa', 'IC 95 % (± pp)'];
    var filas = vn.map(function (s) {
      var t = SAT.tasa(s.totalNum, s.totalDen), me = SAT.margenError(s.totalNum, s.totalDen);
      return [s.nombre, fmt.num(s.totalNum), fmt.num(s.totalDen),
        t === null ? '—' : fmt.pct(t, s.totalDen), me === null ? '—' : fmt.dec(me, 2)];
    });
    var crudas = vn.map(function (s) {
      return [s.nombre, s.totalNum, s.totalDen, round(SAT.tasa(s.totalNum, s.totalDen)),
        round(SAT.margenError(s.totalNum, s.totalDen))];
    });
    T.dibuja($('tabla-niveles'), { columnas: cols, filas: filas,
      leyenda: 'Tabla de datos del grafico anterior, con el denominador al lado del conteo.' });
    conectarCSV('csv-niveles', 'sat-itm_tasa-por-nivel', cols, crudas);
  }

  /* =====================================================================
     Distribuciones
     ===================================================================== */
  function filasNumericas(tabla) {
    var t = est.numericas && est.numericas[tabla];
    if (!t) return { ci: {}, filas: [] };
    var ci = {}; t.columnas.forEach(function (c, i) { ci[c] = i; });
    var f = est.filtros;
    return { ci: ci, filas: t.filas.filter(function (r) {
      return r[ci.periodo] >= f.p0 && r[ci.periodo] <= f.p1 &&
        (r[ci.facultad] < 0 || f.facultadesActivas[r[ci.facultad]]);
    }) };
  }

  function etiquetaVariable(v) {
    var e = (est.numericas && est.numericas.etiquetas) || {};
    if (e[v]) return e[v];
    return capital(String(v).replace(/_/g, ' '));
  }

  function pintarDistribuciones() {
    var variable = $('sel-variable').value;
    var etq = etiquetaVariable(variable);
    var d = filasNumericas('resumenes'), ci = d.ci;
    var porEstado = {};
    d.filas.forEach(function (r) {
      if (r[ci.variable] !== variable) return;
      var e = est.meta.estados[r[ci.estado]] || String(r[ci.estado]);
      (porEstado[e] = porEstado[e] || []).push(r);
    });
    var grupos = Object.keys(porEstado).map(function (e) {
      var g = SAT.combinarResumenes(porEstado[e], ci);
      g.estado = e; g.nombre = SAT.ETIQUETA_ESTADO[e] || e;
      return g;
    }).filter(function (g) { return g.n >= UMBRAL_INESTABLE; })
      .sort(function (a, b) { return b.n - a.n; });

    var nTot = grupos.reduce(function (a, g) { return a + g.n; }, 0);
    G.cajas('g-dist-cajas', { grupos: grupos, tituloY: etq,
      titulo: 'Distribucion de ' + etq.toLowerCase() + ' por estado del estudiante',
      sub: subtitulo(nTot, 'cinco numeros publicados por el pipeline; ningun valor individual') });

    var h = filasNumericas('histogramas');
    var porEstadoH = {};
    h.filas.forEach(function (r) {
      if (r[h.ci.variable] !== variable) return;
      var e = est.meta.estados[r[h.ci.estado]] || String(r[h.ci.estado]);
      (porEstadoH[e] = porEstadoH[e] || []).push(r);
    });
    var seriesH = grupos.slice(0, 3).map(function (g) {
      var c = SAT.combinarHistogramas(porEstadoH[g.estado] || [], h.ci);
      return c ? { nombre: g.nombre, bordes: c.bordes, conteos: c.conteos } : null;
    }).filter(Boolean);
    if (seriesH.length) {
      G.histograma('g-dist-hist', { series: seriesH, tituloX: etq,
        titulo: 'Histograma de ' + etq.toLowerCase() + ' por estado',
        sub: subtitulo(nTot, 'clases reagrupadas a una rejilla comun; se compara la forma, no el tamano') });
    }
    tablaResumenes(grupos, etq);

    var av = $('aviso-distribuciones'); av.innerHTML = '';
    av.appendChild(el('div', { clase: 'aviso aviso--info' }, [
      el('span', { clase: 'aviso__icono', 'aria-hidden': 'true', texto: 'i' }),
      el('span', { texto: 'Los resumenes numericos tienen grano (periodo, facultad, estado). Al combinar ' +
        'varios, la media y la desviacion se recalculan de forma exacta; los cuartiles son el promedio ' +
        'ponderado de los subgrupos, una aproximacion. Los filtros de programa, modalidad y nivel no ' +
        'aplican en esta pestana.' + ((est.numericas && est.numericas.nota) ? ' ' + est.numericas.nota : '') })
    ]));
  }

  function tablaResumenes(grupos, etq) {
    var cols = ['Estado', 'n', 'Media', 'Desv. tipica', 'Min', 'P05', 'Q1', 'Mediana', 'Q3', 'P95', 'Max'];
    var filas = grupos.map(function (g) {
      return [g.nombre, fmt.num(g.n), fmt.dec(g.media), fmt.dec(g.de), fmt.dec(g.min), fmt.dec(g.p05),
        fmt.dec(g.q1), fmt.dec(g.mediana), fmt.dec(g.q3), fmt.dec(g.p95), fmt.dec(g.max)];
    });
    var crudas = grupos.map(function (g) {
      return [g.nombre, g.n, round(g.media), round(g.de), round(g.min), round(g.p05), round(g.q1),
        round(g.mediana), round(g.q3), round(g.p95), round(g.max)];
    });
    T.dibuja($('tabla-numericas'), { columnas: cols, filas: filas,
      leyenda: 'Medidas descriptivas de ' + etq.toLowerCase() + ' en la ventana y las facultades activas.' });
    conectarCSV('csv-numericas', 'sat-itm_descriptivas', cols, crudas);
  }

  /* =====================================================================
     Bivariado
     ===================================================================== */
  function pintarBivariado() {
    var dim = $('sel-dimension').value;
    var r = SAT.rollupSocio(est, dim);
    var cont = $('tabla-bivariada');
    if (!r) { cont.innerHTML = '<p class="sin-dato">Dimension no disponible en socio.json.</p>'; return; }
    if (r.sinCobertura) {
      cont.innerHTML = '<p class="sin-dato">Los cubos socioeconomicos no cubren la metodologia «' +
        r.metodologia + '». Elija otra metodologia o otro fenomeno para ver este cruce.</p>';
      $('chi-cuadrado').textContent = '';
      return;
    }
    var sel = est.filtros.socioValores[dim] || [];
    var vis = r.valores.map(function (_, i) { return i; })
      .filter(function (i) { return (sel.length === 0 || sel.indexOf(i) >= 0) && r.den[i] > 0; });
    var fen = SAT.FENOMENOS[est.filtros.fenomeno];
    var z = vis.map(function (i) { return [r.num[i], Math.max(r.den[i] - r.num[i], 0)]; });
    var c = T.contingencia(z);

    var cols = [r.etiqueta, capital(fen.evento), 'Resto', 'Total fila',
      '% fila', '% columna', 'Tasa'];
    var filas = vis.map(function (i, k) {
      var t = SAT.tasa(r.num[i], r.den[i]);
      return [r.valores[i], fmt.num(z[k][0]), fmt.num(z[k][1]), fmt.num(c.totalFila[k]),
        fmt.pct(c.pctFila[k][0], c.totalFila[k]), fmt.pct(c.pctCol[k][0], c.totalCol[0]),
        t === null ? '—' : fmt.pct(t, r.den[i])];
    });
    var crudas = vis.map(function (i, k) {
      return [r.valores[i], z[k][0], z[k][1], c.totalFila[k], round(c.pctFila[k][0]),
        round(c.pctCol[k][0]), round(SAT.tasa(r.num[i], r.den[i]))];
    });
    T.dibuja(cont, { columnas: cols, filas: filas,
      pie: ['Total', fmt.num(c.totalCol[0]), fmt.num(c.totalCol[1]), fmt.num(c.total),
        '100,0 %', '100,0 %', fmt.pct(SAT.tasa(c.totalCol[0], c.total), c.total)],
      leyenda: 'Doble entrada: ' + r.etiqueta.toLowerCase() + ' frente a ' + fen.etiqueta.toLowerCase() +
        ', con porcentajes por fila y por columna.' });
    conectarCSV('csv-bivariado', 'sat-itm_bivariado-' + dim, cols, crudas);

    $('chi-cuadrado').innerHTML = c.gl > 0
      ? 'Ji cuadrado de independencia: <b>χ² = ' + fmt.dec(c.chi2, 1) + '</b>, ' + c.gl +
        ' grado(s) de libertad · V de Cramér = <b>' + fmt.dec(c.v, 3) + '</b> (' +
        (c.v < 0.1 ? 'asociacion practicamente nula' : c.v < 0.2 ? 'asociacion debil'
          : c.v < 0.35 ? 'asociacion moderada' : 'asociacion fuerte') +
        '). Es una asociacion observada, no una relacion causal.' +
        (r.suprimidas > 0 ? ' ' + fmt.num(r.suprimidas) + ' estudiantes quedan en celdas suprimidas.' : '')
      : '';

    var p0 = est.filtros.p0, p1 = est.filtros.p1;
    G.mapaCalor('g-bivariado-calor', {
      x: periodosVentana(), y: vis.map(function (i) { return r.valores[i]; }),
      z: vis.map(function (i) {
        var fila = [];
        for (var p = p0; p <= p1; p++) fila.push(SAT.tasa(r.porPeriodo[i].num[p], r.porPeriodo[i].den[p]));
        return fila;
      }),
      etiquetaX: 'Semestre', etiquetaY: r.etiqueta, unidad: '%',
      titulo: 'Tasa por ' + r.etiqueta.toLowerCase() + ' y semestre',
      sub: subtitulo(c.total, 'celda en blanco = sin base suficiente, no cero')
    });

    G.barrasOrdenadas('g-bivariado-barras', {
      categorias: vis.map(function (i) { return r.valores[i]; }),
      valores: vis.map(function (i) { return SAT.tasa(r.num[i], r.den[i]); }),
      ns: vis.map(function (i) { return r.den[i]; }),
      titulo: 'Tasa por ' + r.etiqueta.toLowerCase() + ', ordenada',
      sub: subtitulo(c.total, 'eje desde cero'), tituloX: 'Tasa (%)', horizontal: true
    });

    correlaciones();
  }

  function correlaciones() {
    var cont = $('tabla-correlaciones');
    var d = filasNumericas('correlaciones');
    if (!d.filas.length) {
      cont.innerHTML = '<p class="sin-dato">No hay coeficientes publicados para la seleccion actual.</p>';
      return;
    }
    var ci = d.ci, acc = {};
    d.filas.forEach(function (r) {
      var k = r[ci.var_x] + '|' + r[ci.var_y];
      acc[k] = acc[k] || { n: 0, zp: 0, zs: 0 };
      var n = r[ci.n];
      acc[k].n += n; acc[k].zp += n * fisher(r[ci.pearson]); acc[k].zs += n * fisher(r[ci.spearman]);
    });
    var cols = ['Variable X', 'Variable Y', 'n', 'Pearson r', 'Spearman ρ', 'Lectura'];
    var pares = Object.keys(acc).map(function (k) {
      var p = k.split('|'), a = acc[k];
      return { x: p[0], y: p[1], n: a.n, r: fisherInv(a.zp / a.n), s: fisherInv(a.zs / a.n) };
    }).sort(function (a, b) { return Math.abs(b.r) - Math.abs(a.r); });
    T.dibuja(cont, {
      columnas: cols,
      filas: pares.map(function (p) {
        return [etiquetaVariable(p.x), etiquetaVariable(p.y), fmt.num(p.n),
          fmt.dec(p.r, 3), fmt.dec(p.s, 3), T.interpretaR(p.r)];
      }),
      leyenda: 'Coeficientes calculados en el pipeline sobre los microdatos y combinados aqui con la ' +
        'transformacion z de Fisher ponderada por n. Pearson mide asociacion lineal; Spearman, monotona. ' +
        'Ninguno demuestra causalidad.'
    });
    conectarCSV('csv-correlaciones', 'sat-itm_correlaciones', cols,
      pares.map(function (p) { return [p.x, p.y, p.n, round(p.r), round(p.s), T.interpretaR(p.r)]; }));
  }
  function fisher(r) { r = Math.max(Math.min(r, 0.999999), -0.999999); return 0.5 * Math.log((1 + r) / (1 - r)); }
  function fisherInv(z) { return (Math.exp(2 * z) - 1) / (Math.exp(2 * z) + 1); }

  /* =====================================================================
     Flujos
     ===================================================================== */
  function pintarFlujos() {
    var fl = est.flujos, av = $('aviso-flujos'); av.innerHTML = '';
    if (!fl || !fl.n || !fl.n.length) {
      av.innerHTML = '<p class="sin-dato">No hay transiciones publicadas.</p>'; return;
    }
    var f = est.filtros, agg = {}, total = 0, suprimidas = 0;
    for (var i = 0; i < fl.n.length; i++) {
      var p = fl.periodo_origen[i];
      if (p < f.p0 || p > f.p1) continue;
      if (fl.facultad[i] < 0) { suprimidas += fl.n[i]; continue; }
      if (!f.facultadesActivas[fl.facultad[i]]) continue;
      var k = fl.estado_origen[i] + '>' + fl.estado_destino[i];
      agg[k] = (agg[k] || 0) + fl.n[i];
      total += fl.n[i];
    }
    var claves = Object.keys(agg).sort(function (a, b) { return agg[b] - agg[a]; });
    if (!claves.length) {
      av.innerHTML = '<p class="sin-dato">No hay transiciones en la seleccion actual.</p>'; return;
    }
    if (fl.nota) {
      av.appendChild(el('div', { clase: 'aviso aviso--info' }, [
        el('span', { clase: 'aviso__icono', 'aria-hidden': 'true', texto: 'i' }),
        el('span', { texto: fl.nota + (suprimidas ? ' ' + fmt.num(suprimidas) +
          ' estudiantes quedan en celdas suprimidas.' : '') })
      ]));
    }
    var nodos = [], mapa = {}, colores = [];
    function nodo(lado, e) {
      var k = lado + e;
      if (mapa[k] === undefined) {
        mapa[k] = nodos.length;
        nodos.push((lado === 'o' ? 'Desde: ' : 'Hacia: ') +
          (SAT.ETIQUETA_ESTADO[est.meta.estados[e]] || e));
        colores.push(SAT.PALETA.categorica[e % SAT.PALETA.categorica.length]);
      }
      return mapa[k];
    }
    var src = [], tgt = [], val = [], colEnlace = [];
    claves.forEach(function (k) {
      var par = k.split('>'), eo = +par[0], ed = +par[1];
      src.push(nodo('o', eo)); tgt.push(nodo('d', ed)); val.push(agg[k]);
      colEnlace.push(hexA(SAT.PALETA.categorica[eo % SAT.PALETA.categorica.length], 0.38));
    });
    G.sankey('g-flujos', { etiquetas: nodos, colores: colores, origen: src, destino: tgt,
      valor: val, coloresEnlace: colEnlace,
      titulo: 'Transiciones de estado de un semestre al siguiente',
      sub: subtitulo(total, 'facultades activas · transiciones con menos de ' +
        est.meta.suprimido_umbral + ' estudiantes suprimidas') });

    var cols = ['Estado de origen', 'Estado de destino', 'Estudiantes', '% del total'];
    T.dibuja($('tabla-flujos'), {
      columnas: cols,
      filas: claves.map(function (k) {
        var par = k.split('>');
        return [SAT.ETIQUETA_ESTADO[est.meta.estados[+par[0]]] || par[0],
          SAT.ETIQUETA_ESTADO[est.meta.estados[+par[1]]] || par[1],
          fmt.num(agg[k]), fmt.pct(100 * agg[k] / total, total)];
      }),
      leyenda: 'Transiciones ordenadas por magnitud.'
    });
    conectarCSV('csv-flujos', 'sat-itm_transiciones', cols, claves.map(function (k) {
      var par = k.split('>');
      return [est.meta.estados[+par[0]], est.meta.estados[+par[1]], agg[k], round(100 * agg[k] / total)];
    }));
  }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* =====================================================================
     Tablas
     ===================================================================== */
  function pintarTablas() {
    tablaPorFacultad(); tablaJerarquica(); tablaPorEstado(); tablaPorDimension();
  }

  function tablaPorFacultad() {
    var r = serie('facultad');
    var vivos = r.series.filter(function (s) { return s.totalDen > 0; })
      .sort(function (a, b) { return (SAT.tasa(b.totalNum, b.totalDen) || 0) - (SAT.tasa(a.totalNum, a.totalDen) || 0); });
    var fen = SAT.FENOMENOS[est.filtros.fenomeno];
    var cols = ['Facultad', capital(fen.evento), 'Base (denominador)', 'Tasa', 'IC 95 % (± pp)'];
    var filas = vivos.map(function (s) {
      var t = SAT.tasa(s.totalNum, s.totalDen), me = SAT.margenError(s.totalNum, s.totalDen);
      var noPub = s.clave === '__no_publicable__';
      return [{ texto: noPub ? 'i  ' + s.nombre : s.nombre,
          clase: noPub ? 'celda-no-publicable' : '',
          titulo: noPub ? 'Grupos con menos de ' + est.meta.suprimido_umbral + ' estudiantes. Siguen ' +
            'contando en los totales y en las tasas: lo que se oculta es a que programa pertenecen, ' +
            'no su existencia.' : '' },
        fmt.num(s.totalNum), fmt.num(s.totalDen),
        { texto: t === null ? '—' : fmt.pct(t, s.totalDen),
          clase: s.totalDen < UMBRAL_INESTABLE ? 'celda-suprimida' : '',
          titulo: s.totalDen < UMBRAL_INESTABLE ? 'Menos de 30 observaciones: cifra inestable' : '' },
        me === null ? '—' : fmt.dec(me, 2)];
    });
    var tn = vivos.reduce(function (a, s) { return a + s.totalNum; }, 0);
    var td = vivos.reduce(function (a, s) { return a + s.totalDen; }, 0);
    T.dibuja($('tabla-facultad'), { columnas: cols, filas: filas,
      pie: ['Total', fmt.num(tn), fmt.num(td), fmt.pct(SAT.tasa(tn, td), td), ''],
      leyenda: 'Ordenada por tasa descendente. El conteo nunca va solo: al lado esta su base, porque ' +
        '308 ausentes en una facultad grande y 33 en una pequena no son comparables. ' +
        'La fila «' + SAT.ETIQUETA_NO_PUBLICABLE + '» recoge los grupos cuya facultad esta ' +
        'oculta: esta ahi para que el total cuadre, no porque falten datos.' });
    conectarCSV('csv-facultad', 'sat-itm_por-facultad', cols, vivos.map(function (s) {
      return [s.nombre, s.totalNum, s.totalDen, round(SAT.tasa(s.totalNum, s.totalDen)),
        round(SAT.margenError(s.totalNum, s.totalDen))];
    }));
  }

  function tablaJerarquica() {
    var rf = serie('facultad'), rp = serie('programa');
    var facDe = {}; est.meta.programas.forEach(function (p) { facDe[p.id] = p.facultad; });
    var fen = SAT.FENOMENOS[est.filtros.fenomeno];
    var cols = ['Facultad / programa', capital(fen.evento), 'Base', 'Tasa'];
    var filas = [], clases = [], crudas = [];
    var porTasa = function (a, b) {
      return (SAT.tasa(b.totalNum, b.totalDen) || 0) - (SAT.tasa(a.totalNum, a.totalDen) || 0);
    };
    rf.series.filter(function (s) { return s.totalDen > 0; }).sort(porTasa).forEach(function (fa) {
      filas.push([fa.nombre, fmt.num(fa.totalNum), fmt.num(fa.totalDen),
        fmt.pct(SAT.tasa(fa.totalNum, fa.totalDen), fa.totalDen)]);
      clases.push('fila-facultad');
      crudas.push([fa.nombre, fa.totalNum, fa.totalDen, round(SAT.tasa(fa.totalNum, fa.totalDen))]);
      rp.series.filter(function (s) { return facDe[s.clave] === fa.clave && s.totalDen > 0; })
        .sort(porTasa).forEach(function (pr) {
          var t = SAT.tasa(pr.totalNum, pr.totalDen);
          filas.push([{ texto: pr.nombre, clase: 'jerarquia-2' }, fmt.num(pr.totalNum), fmt.num(pr.totalDen),
            { texto: t === null ? '—' : fmt.pct(t, pr.totalDen),
              clase: pr.totalDen < UMBRAL_INESTABLE ? 'celda-suprimida' : '' }]);
          clases.push('');
          crudas.push(['  ' + pr.nombre, pr.totalNum, pr.totalDen, round(t)]);
        });
    });
    T.dibuja($('tabla-jerarquica'), { columnas: cols, filas: filas, clasesFila: clases,
      leyenda: 'Jerarquia facultad → programa, cada bloque ordenado por tasa descendente. ' +
        'En gris, las celdas con menos de 30 observaciones.' });
    conectarCSV('csv-jerarquica', 'sat-itm_facultad-programa', cols, crudas);
  }

  function tablaPorEstado() {
    var c = SAT.conteoPorEstado(est);
    var total = Array.prototype.reduce.call(c, function (a, b) { return a + b; }, 0);
    var pares = est.meta.estados.map(function (e, i) { return { e: e, n: c[i] }; })
      .filter(function (p) { return p.n > 0; }).sort(function (a, b) { return b.n - a.n; });
    var cols = ['Estado del estudiante', 'Estudiantes', '% del total'];
    T.dibuja($('tabla-estados'), {
      columnas: cols,
      filas: pares.map(function (p) {
        return [SAT.ETIQUETA_ESTADO[p.e] || p.e, fmt.num(p.n), fmt.pct(100 * p.n / total, total)];
      }),
      pie: ['Total', fmt.num(total), '100,0 %'],
      leyenda: 'Tabla de una entrada: reparto de la poblacion filtrada por estado, en la metodologia activa.'
    });
    conectarCSV('csv-estados', 'sat-itm_por-estado', cols,
      pares.map(function (p) { return [p.e, p.n, round(100 * p.n / total)]; }));
  }

  function tablaPorDimension() {
    var dim = $('sel-dimension-tabla').value;
    var r = SAT.rollupSocio(est, dim), cont = $('tabla-dimension');
    if (!r) { cont.innerHTML = '<p class="sin-dato">Dimension no disponible.</p>'; return; }
    if (r.sinCobertura) {
      cont.innerHTML = '<p class="sin-dato">Los cubos no cubren la metodologia activa.</p>'; return;
    }
    var fen = SAT.FENOMENOS[est.filtros.fenomeno];
    var sel = est.filtros.socioValores[dim] || [];
    var items = r.valores.map(function (v, i) { return { v: v, i: i }; })
      .filter(function (o) { return (sel.length === 0 || sel.indexOf(o.i) >= 0) && r.den[o.i] > 0; })
      .sort(function (a, b) { return (SAT.tasa(r.num[b.i], r.den[b.i]) || 0) - (SAT.tasa(r.num[a.i], r.den[a.i]) || 0); });
    var cols = [r.etiqueta, capital(fen.evento), 'Base', 'Tasa', 'IC 95 % (± pp)'];
    var tn = items.reduce(function (a, o) { return a + r.num[o.i]; }, 0);
    var td = items.reduce(function (a, o) { return a + r.den[o.i]; }, 0);
    T.dibuja(cont, {
      columnas: cols,
      filas: items.map(function (o) {
        var t = SAT.tasa(r.num[o.i], r.den[o.i]), me = SAT.margenError(r.num[o.i], r.den[o.i]);
        return [o.v, fmt.num(r.num[o.i]), fmt.num(r.den[o.i]),
          t === null ? '—' : fmt.pct(t, r.den[o.i]), me === null ? '—' : fmt.dec(me, 2)];
      }),
      pie: ['Total', fmt.num(tn), fmt.num(td), fmt.pct(SAT.tasa(tn, td), td), ''],
      leyenda: 'Ordenada por tasa descendente. Grano (periodo, facultad, valor, estado): los filtros ' +
        'de programa, modalidad y nivel no aplican aqui.'
    });
    conectarCSV('csv-dimension', 'sat-itm_' + dim, cols, items.map(function (o) {
      return [o.v, r.num[o.i], r.den[o.i], round(SAT.tasa(r.num[o.i], r.den[o.i])),
        round(SAT.margenError(r.num[o.i], r.den[o.i]))];
    }));
  }

  /* =====================================================================
     Descargas y controles globales
     ===================================================================== */
  function conectarCSV(idBoton, nombre, columnas, filas) {
    var b = $(idBoton); if (!b) return;
    b.onclick = function () {
      var idMet = SAT.particionPara(est.meta, est.filtros.fenomeno, est.filtros.metodologia);
      var t = SAT.TEXTOS_METODOLOGIA[idMet] || {};
      T.descargarCSV(nombre, columnas, filas, [
        'SAT-ITM · ' + nombre,
        'Filtros: ' + F.textoResumen(est.meta, est.filtros).replace(/<[^>]+>/g, ''),
        'Metodologia: ' + (t.titulo || idMet) + ' — ' + (t.corto || ''),
        'Version de datos: ' + (est.meta.version || 's/v') + ' · origen: ' + est.origen,
        'Celdas con menos de ' + est.meta.suprimido_umbral + ' estudiantes suprimidas por proteccion de datos.'
      ]);
    };
  }

  global.descargarGrafico = function (id, nombre) { G.descargarPNG(id, nombre); };
  global.cambiarModoG1 = function (modo, boton) {
    modoG1 = modo;
    Array.prototype.forEach.call(document.querySelectorAll('[data-g1]'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.g1 === modo));
    });
    refrescar();
  };

  function poblarSelectores() {
    var dims = (est.socio && est.socio.dimensiones) || {};
    ['sel-dimension', 'sel-dimension-tabla'].forEach(function (id) {
      var s = $(id); if (!s) return;
      s.innerHTML = '';
      Object.keys(dims).forEach(function (k) {
        s.appendChild(el('option', { value: k, texto: dims[k].etiqueta }));
      });
      s.addEventListener('change', refrescar);
    });
    var sv = $('sel-variable');
    if (sv) {
      sv.innerHTML = '';
      ((est.numericas && est.numericas.variables) || []).forEach(function (v) {
        sv.appendChild(el('option', { value: v, texto: etiquetaVariable(v) }));
      });
      sv.addEventListener('change', refrescar);
    }
    // La agrupacion por departamento solo se ofrece si los datos la traen.
    if (!est.meta.hayDepartamento) {
      Array.prototype.forEach.call(document.querySelectorAll('option[value="departamento"]'),
        function (o) { o.remove(); });
    }
    ['sel-agr-tendencia', 'sel-agr-comparacion'].forEach(function (id) {
      var s = $(id); if (s) s.addEventListener('change', refrescar);
    });
  }

  document.addEventListener('DOMContentLoaded', arrancar);

})(window);
