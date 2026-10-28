/* ==========================================================================
   SAT-ITM · filtros.js
   Barra lateral construida a partir de meta.json y socio.json (nada a mano).
   Cada metodologia y cada tratamiento muestran su descripcion VISIBLE y un
   enlace «por que» que despliega la justificacion completa.
   ========================================================================== */
(function (global) {
  'use strict';
  var SAT = global.SAT = global.SAT || {};
  var F = SAT.filtros = {};

  var est = null, alCambiar = null;

  function el(tag, attrs, hijos) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'texto') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'clase') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (hijos || []).forEach(function (h) { if (h) n.appendChild(h); });
    return n;
  }
  F.el = el;

  function bloque(titulo, contenido, descripcion) {
    var hijos = [el('div', { clase: 'filtro__etiqueta' }, [el('span', { texto: titulo })])];
    if (descripcion) hijos.push(el('p', { clase: 'control__descripcion', texto: descripcion }));
    hijos.push(contenido);
    return el('div', { clase: 'filtro' }, hijos);
  }

  /** Bloque desplegable «por que», visible y accesible con teclado. */
  function porQue(texto) {
    return el('details', { clase: 'porque' }, [
      el('summary', { texto: 'por qué' }),
      el('p', { clase: 'porque__texto', texto: texto })
    ]);
  }
  F.porQue = porQue;

  function grupoBotones(opciones, valorActual, onSel, deshabilitado) {
    var cont = el('div', { clase: 'grupo-botones', role: 'group' });
    opciones.forEach(function (o) {
      var attrs = { type: 'button', texto: o.etiqueta,
        'aria-pressed': String(o.id === valorActual), title: o.titulo || o.etiqueta };
      var b = el('button', attrs);
      if (deshabilitado) { b.disabled = true; }
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(cont.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        onSel(o.id);
      });
      cont.appendChild(b);
    });
    return cont;
  }
  F.grupoBotones = grupoBotones;

  /* =====================================================================
     Deslizador de dos extremos
     ===================================================================== */
  function deslizadorDoble(periodos, p0, p1, onCambio) {
    var max = periodos.length - 1;
    var cont = el('div', { clase: 'rango' });
    var pista = el('div', { clase: 'rango__pista' });
    var activo = el('div', { clase: 'rango__activo' });
    var a = el('input', { type: 'range', min: '0', max: String(max), value: String(p0),
      'aria-label': 'Semestre inicial de la ventana' });
    var b = el('input', { type: 'range', min: '0', max: String(max), value: String(p1),
      'aria-label': 'Semestre final de la ventana' });
    [pista, activo, a, b].forEach(function (x) { cont.appendChild(x); });

    var tIni = el('span'), tFin = el('span');
    var txt = el('div', { clase: 'rango__texto' }, [tIni, tFin]);

    function pinta() {
      var v0 = Math.min(+a.value, +b.value), v1 = Math.max(+a.value, +b.value);
      activo.style.left = (100 * v0 / max) + '%';
      activo.style.width = (100 * (v1 - v0) / max) + '%';
      tIni.textContent = periodos[v0]; tFin.textContent = periodos[v1];
      a.setAttribute('aria-valuetext', periodos[v0]);
      b.setAttribute('aria-valuetext', periodos[v1]);
      return [v0, v1];
    }
    function manejar() { var r = pinta(); onCambio(r[0], r[1]); }
    a.addEventListener('input', manejar);
    b.addEventListener('input', manejar);
    pinta();
    return { nodo: el('div', {}, [cont, txt]), a: a, b: b, pinta: pinta };
  }
  F.deslizadorDoble = deslizadorDoble;

  /* =====================================================================
     Estado derivado
     ===================================================================== */
  function recalcularDerivados(e) {
    var meta = e.meta, f = e.filtros;
    var progOk = new Uint8Array(meta.programas.length);
    var facOk = new Uint8Array(meta.facultades.length);
    var n = f.nivelAgregacion;

    meta.programas.forEach(function (p, i) {
      var ok = true;
      if (n === 'una_facultad' || n === 'por_programa_facultad') ok = p.facultad === f.facultadSel;
      else if (n === 'un_programa') ok = p.id === f.programaSel;
      progOk[i] = ok ? 1 : 0;
    });
    meta.facultades.forEach(function (fa, i) {
      if (n === 'una_facultad' || n === 'por_programa_facultad') facOk[i] = fa.id === f.facultadSel ? 1 : 0;
      else if (n === 'un_programa') {
        var pr = meta.programas.filter(function (p) { return p.id === f.programaSel; })[0];
        facOk[i] = (pr && pr.facultad === fa.id) ? 1 : 0;
      } else facOk[i] = 1;
    });

    var modOk = new Uint8Array(meta.modalidades.length);
    meta.modalidades.forEach(function (m, i) {
      modOk[i] = (f.modalidades.length === 0 || f.modalidades.indexOf(i) >= 0) ? 1 : 0;
    });
    var nivOk = new Uint8Array(meta.niveles.length);
    for (var k = 0; k < meta.niveles.length; k++) {
      nivOk[k] = (f.niveles.length === 0 || f.niveles.indexOf(k) >= 0) ? 1 : 0;
    }

    f.programasActivos = progOk;
    f.facultadesActivas = facOk;
    f.modalidadesActivas = modOk;
    f.nivelesActivos = nivOk;
    f.modalidadFiltrada = f.modalidades.length > 0 && f.modalidades.length < meta.modalidades.length;
    f.nivelFiltrado = f.niveles.length > 0 && f.niveles.length < meta.niveles.length;
    // El nivel de agregacion restringe la poblacion cuando se fija una facultad
    // o un programa concreto. Comparar facultades o programas no restringe nada.
    f.programaFiltrado = (n === 'una_facultad' || n === 'por_programa_facultad' || n === 'un_programa');
    // Con cualquiera de estos filtros activos, las celdas suprimidas no se pueden
    // atribuir a la categoria elegida y quedan fuera del calculo.
    f.dimensionFiltrada = f.programaFiltrado || f.modalidadFiltrada || f.nivelFiltrado;
    return f;
  }
  F.recalcularDerivados = recalcularDerivados;

  function filtrosIniciales(meta) {
    var trat = {};
    meta.tratamientos.forEach(function (t) { trat[t.id] = t.defecto || (t.opciones || [])[0]; });
    var nPer = meta.periodos.length;
    // Se excluye de la ventana inicial un eventual periodo "(sin dato)".
    var ultimo = nPer - 1;
    while (ultimo > 0 && String(meta.periodos[ultimo]).indexOf('sin dato') >= 0) ultimo--;
    var clas = SAT.clasificaMetodologias(meta);
    return {
      fenomeno: 'ausentismo',
      metodologia: clas.desercion[0] || (meta.metodologias[0] || {}).id,
      p0: Math.max(0, ultimo - 11), p1: ultimo,
      nivelAgregacion: 'institucional',
      facultadSel: (meta.facultades[0] || {}).id || null,
      programaSel: (meta.programas[0] || {}).id || null,
      modalidades: [], niveles: [], socioValores: {}, tratamientos: trat
    };
  }
  F.filtrosIniciales = filtrosIniciales;

  /** Indice del nivel 1 dentro de meta.niveles, sea cual sea su posicion. */
  function indiceNivel1(meta) {
    var i = meta.niveles.indexOf(1);
    return i >= 0 ? i : null;
  }
  F.indiceNivel1 = indiceNivel1;

  /* =====================================================================
     Construccion
     ===================================================================== */
  function construir(estado, contenedor, callback) {
    est = estado; alCambiar = callback;
    var meta = est.meta, f = est.filtros;
    contenedor.innerHTML = '';
    function emitir() { recalcularDerivados(est); alCambiar(); }

    /* --- Atajo nivel 1 -------------------------------------------------- */
    var i1 = indiceNivel1(meta);
    if (i1 !== null) {
      var atajo = el('button', { clase: 'boton boton--atajo', type: 'button' }, [
        el('span', { 'aria-hidden': 'true', texto: '▸' }),
        el('span', { texto: 'Ver solo el nivel 1 (primer semestre)' })
      ]);
      atajo.addEventListener('click', function () {
        f.niveles = [i1]; construir(est, contenedor, alCambiar); emitir();
      });
      contenedor.appendChild(atajo);
      contenedor.appendChild(el('p', { clase: 'control__descripcion',
        texto: 'Es donde se concentra el ausentismo. Un clic lo aisla en toda la aplicacion.' }));
    }

    /* --- Fenomeno -------------------------------------------------------- */
    var clas = SAT.clasificaMetodologias(meta);
    contenedor.appendChild(bloque('Fenomeno',
      grupoBotones([
        { id: 'ausentismo', etiqueta: 'Ausentismo' },
        { id: 'desercion', etiqueta: 'Desercion' },
        { id: 'permanencia', etiqueta: 'Permanencia' }
      ], f.fenomeno, function (v) {
        f.fenomeno = v; construir(est, contenedor, alCambiar); emitir();
      }),
      'Ausentismo: no vuelve a matricularse el semestre siguiente. Desercion: abandono ' +
      'confirmado. Permanencia: el complemento del ausentismo.'));

    /* --- Metodologia ----------------------------------------------------- */
    var esDesercion = f.fenomeno === 'desercion';
    var opcionesMet = esDesercion ? clas.desercion : clas.ausentismo;
    var idActivo = SAT.particionPara(meta, f.fenomeno, f.metodologia);

    var contMet = el('div');
    contMet.appendChild(grupoBotones(opcionesMet.map(function (id) {
      var t = SAT.TEXTOS_METODOLOGIA[id] || {};
      var m = SAT.metodologiaPorId(meta, id) || {};
      return { id: id, etiqueta: nombreCorto(id, m), titulo: t.titulo || m.nombre };
    }), idActivo, function (v) {
      f.metodologia = v; construir(est, contenedor, alCambiar); emitir();
    }, opcionesMet.length < 2));

    var tAct = SAT.TEXTOS_METODOLOGIA[idActivo] || {};
    var mAct = SAT.metodologiaPorId(meta, idActivo) || {};
    contMet.appendChild(el('p', { clase: 'control__descripcion control__descripcion--fuerte',
      texto: tAct.corto || mAct.descripcion || '' }));
    if (tAct.porque) contMet.appendChild(porQue(tAct.porque));
    if (mAct.cobertura) {
      contMet.appendChild(el('p', { clase: 'control__nota',
        texto: 'Cobertura de esta metodologia en los datos: ' + mAct.cobertura + '.' }));
    }
    if (!esDesercion) {
      contMet.appendChild(el('p', { clase: 'control__nota',
        texto: 'El ausentismo se calcula de una sola forma. Las dos metodologias se ofrecen ' +
               'al elegir el fenomeno «Desercion».' }));
    }
    contenedor.appendChild(bloque('Metodologia de calculo', contMet));

    /* --- Ventana de semestres -------------------------------------------- */
    var desl = deslizadorDoble(meta.periodos, f.p0, f.p1, function (v0, v1) {
      f.p0 = v0; f.p1 = v1; emitir();
    });
    contenedor.appendChild(bloque('Ventana de semestres', desl.nodo,
      'Arrastre los dos extremos, o use las flechas del teclado cuando esten enfocados.'));

    /* --- Nivel de agregacion --------------------------------------------- */
    var selAgr = el('select', { id: 'sel-agregacion', 'aria-label': 'Nivel de agregacion' });
    [['institucional', 'Institucional (todo el ITM)'],
     ['por_facultad', 'Comparar facultades'],
     ['una_facultad', 'Una facultad'],
     ['por_programa', 'Comparar programas (todo el ITM)'],
     ['por_programa_facultad', 'Comparar programas de una facultad'],
     ['un_programa', 'Un programa']].forEach(function (o) {
      selAgr.appendChild(el('option', { value: o[0], texto: o[1] }));
    });
    selAgr.value = f.nivelAgregacion;

    var selFac = el('select', { id: 'sel-facultad', 'aria-label': 'Facultad' });
    meta.facultades.forEach(function (fa) {
      selFac.appendChild(el('option', { value: fa.id, texto: fa.nombre }));
    });
    selFac.value = f.facultadSel || '';

    var selProg = el('select', { id: 'sel-programa', 'aria-label': 'Programa academico' });
    function llenarProgramas() {
      selProg.innerHTML = '';
      var lista = meta.programas.filter(function (p) {
        return String(p.id).indexOf('__suprimido__') < 0;
      });
      // Al elegir una facultad, el selector de programa se limita a sus programas.
      if (f.nivelAgregacion === 'un_programa' && selFac.value) {
        var deFac = lista.filter(function (p) { return p.facultad === selFac.value; });
        if (deFac.length) lista = deFac;
      }
      lista.sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre), 'es'); });
      lista.forEach(function (p) { selProg.appendChild(el('option', { value: p.id, texto: p.nombre })); });
      if (lista.length && lista.map(function (p) { return p.id; }).indexOf(f.programaSel) < 0) {
        f.programaSel = lista[0].id;
      }
      selProg.value = f.programaSel;
    }
    function sincronizar() {
      var n = f.nivelAgregacion;
      selFac.disabled = !(n === 'una_facultad' || n === 'por_programa_facultad' || n === 'un_programa');
      selProg.disabled = n !== 'un_programa';
      llenarProgramas();
    }
    selAgr.addEventListener('change', function () { f.nivelAgregacion = selAgr.value; sincronizar(); emitir(); });
    selFac.addEventListener('change', function () { f.facultadSel = selFac.value; llenarProgramas(); emitir(); });
    selProg.addEventListener('change', function () { f.programaSel = selProg.value; emitir(); });

    contenedor.appendChild(bloque('Nivel de agregacion', selAgr));
    contenedor.appendChild(bloque('Facultad', selFac,
      'Se habilita cuando el nivel de agregacion la necesita.'));
    contenedor.appendChild(bloque('Programa academico', selProg,
      'La lista se limita a los programas de la facultad seleccionada.'));
    sincronizar();

    /* --- Modalidad -------------------------------------------------------- */
    contenedor.appendChild(bloque('Modalidad del programa',
      casillas(meta.modalidades.map(function (m, i) { return { id: i, etiqueta: m }; }),
        f.modalidades, function (l) { f.modalidades = l; emitir(); }),
      'Sin ninguna marcada se incluyen todas.'));

    /* --- Nivel del estudiante --------------------------------------------- */
    var rej = el('div', { clase: 'rejilla-niveles', role: 'group', 'aria-label': 'Nivel del estudiante' });
    meta.niveles.forEach(function (nv, i) {
      var b = el('button', { type: 'button', texto: meta.etiquetasNivelCorta[i],
        'aria-pressed': String(f.niveles.indexOf(i) >= 0),
        'aria-label': meta.etiquetasNivel[i] });
      b.addEventListener('click', function () {
        var k = f.niveles.indexOf(i);
        if (k >= 0) f.niveles.splice(k, 1); else f.niveles.push(i);
        b.setAttribute('aria-pressed', String(f.niveles.indexOf(i) >= 0));
        emitir();
      });
      rej.appendChild(b);
    });
    contenedor.appendChild(bloque('Nivel del estudiante', rej,
      'Semestre dentro del plan de estudios. Sin ninguno marcado se incluyen todos.'));

    /* --- Dimensiones socioeconomicas -------------------------------------- */
    var dims = (est.socio && est.socio.dimensiones) || {};
    var claves = Object.keys(dims);
    if (claves.length) {
      var cuerpo = el('div', { clase: 'plegable__cuerpo' });
      cuerpo.appendChild(el('p', { clase: 'control__nota',
        texto: 'Los cubos socioeconomicos tienen grano (periodo, facultad, valor, estado). ' +
          'Estas casillas eligen que valores se muestran en las pestanas Bivariado y Tablas; ' +
          'no restringen la tabla de hechos.' }));
      claves.forEach(function (k) {
        var d = dims[k];
        if (!f.socioValores[k]) f.socioValores[k] = [];
        cuerpo.appendChild(bloque(d.etiqueta,
          casillas(d.valores.map(function (v, i) { return { id: i, etiqueta: v }; }),
            f.socioValores[k], function (l) { f.socioValores[k] = l; emitir(); })));
      });
      contenedor.appendChild(el('details', { clase: 'plegable' }, [
        el('summary', { texto: 'Dimensiones socioeconomicas (' + claves.length + ')' }), cuerpo
      ]));
    }

    /* --- Tratamiento de casos --------------------------------------------- */
    if (meta.tratamientos.length) {
      var ct = el('div', { clase: 'plegable__cuerpo' });
      ct.appendChild(el('div', { clase: 'aviso aviso--info' }, [
        el('span', { clase: 'aviso__icono', 'aria-hidden': 'true', texto: 'i' }),
        el('span', { texto: 'Las cifras de Permanencia y las de los decanos no coinciden. ' +
          'Estos conmutadores permiten ver cuanto de esa diferencia viene de cada criterio.' })
      ]));
      meta.tratamientos.forEach(function (t) {
        var txt = SAT.TEXTOS_TRATAMIENTO[t.id] || {};
        var etqOp = t.etiquetas_opciones || ETIQUETAS_OPCION;
        var impl = t.implementado || 'si';
        var notaImpl = SAT.ETIQUETA_IMPLEMENTADO[impl];
        var hijos = [el('div', { clase: 'tratamiento__nombre' }, [
          el('span', { texto: t.etiqueta }),
          impl !== 'si' ? el('span', { clase: 'etiqueta-estado', texto: impl === 'no' ? 'pendiente' : impl }) : null
        ])];
        hijos.push(el('p', { clase: 'control__descripcion control__descripcion--fuerte',
          texto: txt.corto || '' }));
        hijos.push(grupoBotones((t.opciones || []).map(function (o) {
          return { id: o, etiqueta: etqOp[o] || o.replace(/_/g, ' ') };
        }), est.filtros.tratamientos[t.id], function (v) {
          est.filtros.tratamientos[t.id] = v; emitir();
        }, impl === 'no'));
        if (txt.porque) hijos.push(porQue(txt.porque));
        if (t.nota) hijos.push(el('p', { clase: 'control__nota', texto: 'Nota tecnica: ' + t.nota }));
        if (notaImpl) hijos.push(el('p', { clase: 'control__nota control__nota--alerta', texto: notaImpl }));
        ct.appendChild(el('div', { clase: 'tratamiento' }, hijos));
      });
      contenedor.appendChild(el('details', { clase: 'plegable', open: 'open' }, [
        el('summary', { texto: 'Tratamiento de casos (' + meta.tratamientos.length + ')' }), ct
      ]));
    }

    /* --- Reinicio y resumen ------------------------------------------------ */
    var btn = el('button', { clase: 'boton boton--principal boton--bloque', type: 'button',
      texto: 'Reiniciar todos los filtros' });
    btn.addEventListener('click', function () {
      est.filtros = filtrosIniciales(meta);
      construir(est, contenedor, alCambiar);
      recalcularDerivados(est); alCambiar();
    });
    contenedor.appendChild(el('div', { clase: 'plegable' }, [btn]));
    contenedor.appendChild(el('div', { clase: 'resumen-filtros', id: 'resumen-filtros',
      role: 'status', 'aria-live': 'polite' }));

    recalcularDerivados(est);
    pintarResumen();
  }
  F.construir = construir;

  var ETIQUETAS_OPCION = {
    excluir: 'Excluir', incluir: 'Incluir',
    incluir_denominador: 'Solo en el denominador', incluir_ambos: 'Contarlos como evento',
    riesgo_competitivo: 'Evento aparte', contar_desertor: 'Contarlos como evento',
    permanece: 'Permanece'
  };

  function casillas(opciones, seleccion, onCambio) {
    var cont = el('div', { clase: 'casillas', role: 'group' });
    opciones.forEach(function (o) {
      var inp = el('input', { type: 'checkbox', value: String(o.id) });
      inp.checked = seleccion.indexOf(o.id) >= 0;
      inp.addEventListener('change', function () {
        var k = seleccion.indexOf(o.id);
        if (inp.checked && k < 0) seleccion.push(o.id);
        if (!inp.checked && k >= 0) seleccion.splice(k, 1);
        onCambio(seleccion);
      });
      cont.appendChild(el('label', { clase: 'casilla' }, [inp, el('span', { texto: o.etiqueta })]));
    });
    return cont;
  }
  F.casillas = casillas;

  function nombreCorto(id, m) {
    if (id === 'itm') return 'ITM';
    if (id === 'itm_desercion_anual') return 'Tabla ITM';
    if (id === 'spadies') return 'MEN / SPADIES';
    return (m && m.nombre) || id;
  }
  F.nombreCorto = nombreCorto;

  function metodologiaActual(meta, id) { return SAT.metodologiaPorId(meta, id); }
  F.metodologiaActual = metodologiaActual;

  /** Texto legible de los filtros activos. Funcion pura. */
  function textoResumen(meta, f) {
    var p = [];
    p.push('<b>' + (SAT.FENOMENOS[f.fenomeno] || {}).etiqueta + '</b>');
    var idMet = SAT.particionPara(meta, f.fenomeno, f.metodologia);
    var t = SAT.TEXTOS_METODOLOGIA[idMet] || {};
    var m = SAT.metodologiaPorId(meta, idMet) || {};
    p.push('metodologia <b>' + (t.titulo || m.nombre || idMet) + '</b>');
    p.push('semestres <b>' + meta.periodos[f.p0] + '</b> a <b>' + meta.periodos[f.p1] + '</b>');
    var n = f.nivelAgregacion;
    if (n === 'institucional') p.push('nivel <b>institucional</b>');
    else if (n === 'por_facultad') p.push('<b>comparando facultades</b>');
    else if (n === 'por_programa') p.push('<b>comparando programas</b>');
    else if (n === 'una_facultad' || n === 'por_programa_facultad') {
      var fa = meta.facultades.filter(function (x) { return x.id === f.facultadSel; })[0];
      p.push('facultad <b>' + (fa ? fa.nombre : f.facultadSel) + '</b>');
    } else if (n === 'un_programa') {
      var pr = meta.programas.filter(function (x) { return x.id === f.programaSel; })[0];
      p.push('programa <b>' + (pr ? pr.nombre : f.programaSel) + '</b>');
    }
    p.push(f.modalidades.length
      ? 'modalidad <b>' + f.modalidades.map(function (i) { return meta.modalidades[i]; }).join(', ') + '</b>'
      : 'todas las modalidades');
    p.push(f.niveles.length
      ? 'nivel <b>' + f.niveles.slice().sort(function (a, b) { return a - b; })
          .map(function (i) { return meta.etiquetasNivelCorta[i]; }).join(', ') + '</b>'
      : 'todos los niveles');
    var tr = meta.tratamientos.filter(function (x) { return f.tratamientos[x.id] !== x.defecto; });
    p.push(tr.length
      ? 'tratamientos cambiados: <b>' + tr.map(function (x) { return x.etiqueta; }).join(', ') + '</b>'
      : 'tratamientos por defecto');
    return p.join(' · ') + '.';
  }
  F.textoResumen = textoResumen;

  function pintarResumen() {
    var n = document.getElementById('resumen-filtros');
    if (n && est) n.innerHTML = textoResumen(est.meta, est.filtros);
  }
  F.pintarResumen = pintarResumen;

})(window);
