/* ==========================================================================
   SAT-ITM · datos.js
   Carga, normalizacion e indexado de los JSON, y el motor de calculo de tasas.
   Salvo `cargar`, todo lo de aqui son funciones puras: se prueban en
   pruebas/pruebas.html sin navegador real ni datos reales.
   ========================================================================== */
(function (global) {
  'use strict';

  var SAT = global.SAT = global.SAT || {};

  /* ---------------------------------------------------------------------
     Paletas. La categorica es Okabe-Ito, disenada para daltonismo.
     La secuencial son tonos del azul institucional #0C215B.
     --------------------------------------------------------------------- */
  var PALETA = {
    categorica: ['#0C215B', '#E69F00', '#009E73', '#CC79A7', '#0072B2',
                 '#D55E00', '#56B4E9', '#5A6472', '#7E5A9B', '#8C6D31'],
    secuencial: [[0, '#F2F5FA'], [0.2, '#DDE3EF'], [0.4, '#B6C2D9'],
                 [0.6, '#5E77A8'], [0.8, '#214282'], [1, '#0C215B']],
    azul: '#0C215B', gris: '#5A6472', alerta: '#D55E00', favorable: '#006B4F'
  };
  SAT.PALETA = PALETA;

  var ESTADOS_CANONICOS = ['MATRICULADO', 'AUSENTE', 'DESERTOR', 'REINGRESO', 'GRADUADO',
    'EGRESADO_NO_GRADUADO', 'RIESGO_COMPETITIVO', 'SALIDA_INSTITUCIONAL',
    'CENSURADO', 'NO_ETIQUETABLE'];

  var ETIQUETA_ESTADO = {
    MATRICULADO: 'Matriculado', AUSENTE: 'Ausente', DESERTOR: 'Desertor',
    REINGRESO: 'Reingreso', GRADUADO: 'Graduado',
    EGRESADO_NO_GRADUADO: 'Fin de pensum', RIESGO_COMPETITIVO: 'Excluido por bajo rendimiento',
    SALIDA_INSTITUCIONAL: 'Salida institucional', CENSURADO: 'Sin confirmar (censurado)',
    NO_ETIQUETABLE: 'No etiquetable'
  };
  SAT.ETIQUETA_ESTADO = ETIQUETA_ESTADO;

  var FENOMENOS = {
    ausentismo: { etiqueta: 'Ausentismo', evento: 'ausentes',
      descripcion: 'Matriculado en t que no registra matricula en t+1.' },
    desercion: { etiqueta: 'Desercion', evento: 'desertores',
      descripcion: 'Abandono confirmado del programa.' },
    permanencia: { etiqueta: 'Permanencia', evento: 'permanecen',
      descripcion: 'Continua matriculado en el periodo siguiente.' }
  };
  SAT.FENOMENOS = FENOMENOS;

  /* =====================================================================
     Textos verificados de metodologias y tratamientos.
     Se muestran SIEMPRE junto al control, no escondidos en un icono.
     Fuente: revision de la presentacion de Permanencia y Fase 2.
     ===================================================================== */
  var TEXTOS_METODOLOGIA = {
    itm: {
      titulo: 'ITM · ausentismo intersemestral',
      corto: 'Ausentes del semestre ÷ matriculados de ese mismo semestre.',
      porque: 'Es la forma en que Permanencia Estudiantil calcula el ausentismo intersemestral. ' +
        'Responde a: de los que estaban matriculados, ¿que proporcion no volvio al semestre ' +
        'siguiente? Es la serie que reproduce exactamente las doce cifras que ellos publican.'
    },
    itm_desercion_anual: {
      titulo: 'ITM · tabla institucional de desercion anual',
      corto: 'Desertores del semestre ÷ matriculados de ese mismo semestre.',
      porque: 'Es la tabla institucional de desercion anual. Usa el mismo denominador que el ' +
        'ausentismo, pero el evento es el abandono registrado como desercion, no la sola ' +
        'inasistencia de un semestre. Su cobertura empieza en 2022-01 porque antes no hay archivo.'
    },
    spadies: {
      titulo: 'MEN / SPADIES',
      corto: 'Estudiantes sin matricula durante dos periodos consecutivos ÷ matriculados dos periodos antes.',
      porque: 'Es la definicion del Ministerio de Educacion, la que produce cifras comparables entre ' +
        'universidades. Al exigir dos semestres de ausencia, no cuenta como desercion a quien se toma ' +
        'un semestre y regresa. Da una cifra menor que la del ausentismo, y eso no es un error: ' +
        'miden cosas distintas. Los dos ultimos semestres quedan sin confirmar porque aun no se ' +
        'puede observar la segunda ausencia.'
    }
  };
  SAT.TEXTOS_METODOLOGIA = TEXTOS_METODOLOGIA;

  var TEXTOS_TRATAMIENTO = {
    fin_pensum: {
      corto: 'Excluir del denominador a quienes terminaron su plan de estudios.',
      porque: 'Quien ya aprobo todas sus asignaturas no tiene nada que matricular, asi que su ausencia ' +
        'no es abandono sino espera del grado. Permanencia ya los excluye. Verificado: de los marcados, ' +
        'solo el 13-16 % vuelve a matricularse.'
    },
    graduados: {
      corto: 'Excluir del denominador a quienes se graduaron en el semestre.',
      porque: 'Terminaron sus estudios con exito; contarlos como poblacion en riesgo diluye la tasa. ' +
        'Permanencia ya los excluye.'
    },
    bajo_rendimiento: {
      corto: 'Tratar la sancion academica como una salida distinta de la desercion voluntaria.',
      porque: 'De las 45.451 ausencias registradas entre 2020 y 2025, 21.746 (47,8 %) corresponden a ' +
        'estudiantes con sancion academica. No son decisiones del estudiante sino del reglamento, y la ' +
        'intervencion que requieren es otra. Al contarlos como evento, la tasa sube; al dejarlos aparte, ' +
        'la desercion voluntaria queda limpia.'
    },
    suspension: {
      corto: 'Tratar la suspension como pausa autorizada, no como salida.',
      porque: 'Solo el 23,9 % de quienes suspenden queda ausente, frente al 83,8 % de quienes cancelan, ' +
        'lo que sugiere reserva de cupo con derecho a regresar. Esta pendiente de confirmar con el ' +
        'reglamento del ITM.'
    },
    sillas_vacias: {
      corto: 'Criterio de exclusion que usa Permanencia y cuyo alcance exacto esta pendiente de confirmar con ellos.',
      porque: 'Permanencia declara excluir del denominador a los de «sillas vacias». No existe ninguna ' +
        'columna ni documento en el acervo que permita identificarlos, asi que el conmutador queda ' +
        'visible y marcado como pendiente. Conviene preguntarlo en la reunion.'
    }
  };
  SAT.TEXTOS_TRATAMIENTO = TEXTOS_TRATAMIENTO;

  var ETIQUETA_NO_PUBLICABLE = 'No publicable (grupos menores de 5 estudiantes)';
  SAT.ETIQUETA_NO_PUBLICABLE = ETIQUETA_NO_PUBLICABLE;

  /**
   * Anomalias conocidas del archivo de origen que conviene anotar en la serie.
   * No son errores del calculo, y callarlas llevaria a leer mal el grafico.
   */
  var ANOMALIAS_PERIODO = [{
    periodo: '2022-02', metodologias: ['spadies'],
    nota: 'Anomalia conocida del archivo de origen: 2.650 registros marcados como ausentes si ' +
      'tienen matricula en el periodo siguiente, cuando en los otros once periodos ese numero es ' +
      '0, 1 o 2. Si la serie de SPADIES se hunde en 2022-02, es por esto. Ya esta reportada.'
  }];
  SAT.ANOMALIAS_PERIODO = ANOMALIAS_PERIODO;

  /** Anomalias que aplican a la ventana y la metodologia activas. Funcion pura. */
  function anomaliasAplicables(periodos, idMetodologia) {
    var out = [];
    ANOMALIAS_PERIODO.forEach(function (a) {
      var i = periodos.indexOf(a.periodo);
      if (i < 0) return;
      if (a.metodologias && a.metodologias.indexOf(idMetodologia) < 0) return;
      out.push({ indice: i, periodo: a.periodo, nota: a.nota });
    });
    return out;
  }
  SAT.anomaliasAplicables = anomaliasAplicables;

  var ETIQUETA_IMPLEMENTADO = {
    si: null,
    parcial: 'Implementado parcialmente: la identificacion del estado es incompleta en la fuente.',
    solo_en_socio: 'Solo disponible en los cubos socioeconomicos, no en la tabla de hechos.',
    no: 'Declarado pero NO implementado: la fuente no permite identificar los casos. Pendiente institucional.'
  };
  SAT.ETIQUETA_IMPLEMENTADO = ETIQUETA_IMPLEMENTADO;

  /* =====================================================================
     1. Que particion de la tabla de hechos corresponde a cada fenomeno
     ===================================================================== */

  /**
   * Clasifica las metodologias que el selector debe ofrecer, segun el evento
   * que miden. `meta.metodologias_en_filtro` manda: una metodologia publicada
   * para trazabilidad (la desercion anual oficial) no es una variante de
   * denominador y no debe aparecer como opcion, aunque si en la comparacion.
   */
  function clasificaMetodologias(meta) {
    var permitidas = Array.isArray(meta.metodologias_en_filtro) && meta.metodologias_en_filtro.length
      ? meta.metodologias_en_filtro : null;
    var ausentismo = [], desercion = [];
    (meta.metodologias || []).forEach(function (m) {
      if (permitidas && permitidas.indexOf(m.id) < 0) return;
      var ev = m.estados_evento || [];
      if (ev.indexOf('AUSENTE') >= 0) ausentismo.push(m.id);
      else desercion.push(m.id);
    });
    if (!ausentismo.length && desercion.length) ausentismo = [desercion[0]];
    if (!desercion.length && ausentismo.length) desercion = [ausentismo[0]];
    return { ausentismo: ausentismo, desercion: desercion };
  }

  /** Todas las metodologias publicadas, para la tabla de comparacion. */
  function todasLasMetodologias(meta) {
    return (meta.metodologias || []).map(function (m) {
      var ev = m.estados_evento || [];
      return { id: m.id, fenomeno: ev.indexOf('AUSENTE') >= 0 ? 'ausentismo' : 'desercion',
        enFiltro: !Array.isArray(meta.metodologias_en_filtro) ||
          meta.metodologias_en_filtro.indexOf(m.id) >= 0 };
    });
  }
  SAT.todasLasMetodologias = todasLasMetodologias;
  SAT.clasificaMetodologias = clasificaMetodologias;

  /**
   * Particion de hechos que hay que leer. El ausentismo (y su complemento, la
   * permanencia) tiene una sola forma de calcularse; la desercion tiene dos.
   */
  function particionPara(meta, fenomeno, metodologiaDesercion, forzada) {
    // `forzada` permite leer una particion que no esta en el selector, como la
    // desercion anual oficial, para la tabla de comparacion de metodologias.
    if (forzada && metodologiaPorId(meta, forzada)) return forzada;
    var c = clasificaMetodologias(meta);
    if (fenomeno === 'desercion') {
      return c.desercion.indexOf(metodologiaDesercion) >= 0 ? metodologiaDesercion : c.desercion[0];
    }
    return c.ausentismo[0];
  }
  SAT.particionPara = particionPara;

  function metodologiaPorId(meta, id) {
    return (meta.metodologias || []).filter(function (m) { return m.id === id; })[0] || null;
  }
  SAT.metodologiaPorId = metodologiaPorId;

  /* =====================================================================
     2. Motor de calculo: estados que cuentan como evento y como denominador
     ===================================================================== */

  /**
   * Rol de cada estado dado el fenomeno, los tratamientos y la metodologia.
   * Si la metodologia declara `estados_evento`, esa declaracion manda y los
   * tratamientos solo pueden anadir estados al evento.
   * Funcion pura.
   */
  function rolesEstados(fenomeno, trat, metodologia) {
    trat = trat || {};
    var finPensum = trat.fin_pensum || 'excluir';
    var bajo = trat.bajo_rendimiento || 'riesgo_competitivo';
    var susp = trat.suspension || 'permanece';
    var grad = trat.graduados || 'excluir';
    var esPermanencia = fenomeno === 'permanencia';

    var r = {};
    function set(n, ev, den) { r[n] = { evento: !!ev, denominador: !!den }; }

    // Denominador: poblacion en riesgo en el periodo.
    set('MATRICULADO', false, true);
    set('REINGRESO', false, true);
    set('AUSENTE', false, true);
    set('DESERTOR', false, true);
    set('GRADUADO', false, grad === 'incluir');
    set('EGRESADO_NO_GRADUADO', false, finPensum !== 'excluir');
    set('RIESGO_COMPETITIVO', false, true);
    set('SALIDA_INSTITUCIONAL', false, true);
    // Censurado: todavia no se puede confirmar el desenlace. Fuera de ambos, y
    // la tasa se devuelve como dato faltante en vez de como un cero enganoso.
    set('CENSURADO', false, false);
    // No etiquetable: estuvo matriculado y estaba en riesgo, aunque su desenlace
    // no se pudo clasificar. Se conserva en el denominador, como en la fuente.
    set('NO_ETIQUETABLE', false, true);

    // Evento declarado por la metodologia, o deducido del fenomeno.
    var declarados = (metodologia && metodologia.estados_evento) || null;
    if (!declarados) {
      declarados = fenomeno === 'ausentismo' ? ['AUSENTE', 'DESERTOR']
        : fenomeno === 'desercion' ? ['DESERTOR'] : [];
    }
    declarados.forEach(function (e) { if (r[e]) r[e].evento = true; });

    // Los tratamientos solo pueden anadir estados al evento.
    if (bajo === 'contar_desertor') r.RIESGO_COMPETITIVO.evento = true;
    if (susp === 'contar_desertor') r.SALIDA_INSTITUCIONAL.evento = true;
    if (finPensum === 'incluir_ambos') r.EGRESADO_NO_GRADUADO.evento = true;

    // Permanencia: es el complemento del evento dentro del denominador.
    if (esPermanencia) {
      Object.keys(r).forEach(function (k) {
        var era = r[k].evento;
        r[k].evento = r[k].denominador && !era;
      });
    }
    return r;
  }
  SAT.rolesEstados = rolesEstados;

  /** Roles convertidos a dos mascaras indexadas por indice de estado. */
  function mascarasEstados(meta, fenomeno, trat, metodologiaId) {
    var m = metodologiaPorId(meta, metodologiaId);
    var roles = rolesEstados(fenomeno, trat, m);
    var estados = meta.estados;
    var ev = new Uint8Array(estados.length), de = new Uint8Array(estados.length);
    for (var i = 0; i < estados.length; i++) {
      var r = roles[estados[i]] || { evento: false, denominador: false };
      ev[i] = r.evento ? 1 : 0;
      de[i] = r.denominador ? 1 : 0;
    }
    return { evento: ev, denominador: de, roles: roles };
  }
  SAT.mascarasEstados = mascarasEstados;

  function desplazamiento(meta, id) {
    var m = metodologiaPorId(meta, id);
    return (m && typeof m.desplazamiento_denominador === 'number') ? m.desplazamiento_denominador : 0;
  }
  SAT.desplazamiento = desplazamiento;

  /** Tasa en porcentaje. Devuelve null si no hay base: cero no es lo mismo que faltante. */
  function tasa(numerador, denominador) {
    if (!denominador || denominador <= 0) return null;
    return 100 * numerador / denominador;
  }
  SAT.tasa = tasa;

  /** Margen de error de una proporcion al 95 %, en puntos porcentuales. */
  function margenError(numerador, denominador) {
    if (!denominador || denominador < 1) return null;
    var p = numerador / denominador;
    return 100 * 1.96 * Math.sqrt(Math.max(p * (1 - p), 0) / denominador);
  }
  SAT.margenError = margenError;

  /** Decimales que sostiene una n dada. Evita el falso detalle de dos decimales. */
  function decimalesSegunN(n) {
    if (!n || n < 30) return 0;
    if (n >= 20000) return 2;
    return 1;
  }
  SAT.decimalesSegunN = decimalesSegunN;

  /**
   * Deteccion robusta de valores atipicos en una serie (z con mediana y MAD).
   * Se usa solo si meta.json no declara los atipicos. Funcion pura.
   */
  function atipicosRobustos(valores, umbral) {
    umbral = umbral || 3;
    var v = valores.filter(function (x) { return x !== null && !isNaN(x); });
    if (v.length < 6) return [];
    var ord = v.slice().sort(function (a, b) { return a - b; });
    var med = mediana(ord);
    var desv = ord.map(function (x) { return Math.abs(x - med); }).sort(function (a, b) { return a - b; });
    var mad = mediana(desv) * 1.4826;
    if (!mad) return [];
    var out = [];
    valores.forEach(function (x, i) {
      if (x === null || isNaN(x)) return;
      var z = (x - med) / mad;
      if (Math.abs(z) > umbral) out.push({ indice: i, z: z, valor: x, mediana: med });
    });
    return out;
  }
  function mediana(ord) {
    var n = ord.length;
    if (!n) return null;
    return n % 2 ? ord[(n - 1) / 2] : (ord[n / 2 - 1] + ord[n / 2]) / 2;
  }
  SAT.atipicosRobustos = atipicosRobustos;
  SAT.mediana = mediana;

  /* =====================================================================
     3. Normalizacion
     ===================================================================== */

  function normalizaMeta(meta) {
    meta = meta || {};
    if (!Array.isArray(meta.estados) || !meta.estados.length) meta.estados = ESTADOS_CANONICOS.slice();
    ['periodos', 'facultades', 'programas', 'modalidades', 'niveles',
     'metodologias', 'tratamientos'].forEach(function (k) {
      if (!Array.isArray(meta[k])) meta[k] = [];
    });
    if (!meta.niveles.length) meta.niveles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    if (typeof meta.suprimido_umbral !== 'number') meta.suprimido_umbral = 5;
    ['fuentes_serie', 'periodos_provisionales', 'periodos_atipicos'].forEach(function (k) {
      if (!Array.isArray(meta[k])) meta[k] = [];
    });
    if (!meta.indices) meta.indices = {};

    // `programas[].facultad` puede venir como indice o como id. Se normaliza a id.
    meta.programas.forEach(function (p) {
      if (typeof p.facultad === 'number') {
        var f = meta.facultades[p.facultad];
        p.facultad_idx = p.facultad;
        p.facultad = f ? f.id : '(sin dato)';
      }
    });
    meta.facultades.forEach(function (f, i) { f.idx = i; });

    // Etiquetas legibles de los niveles, que pueden traer un "(sin dato)".
    meta.etiquetasNivel = meta.niveles.map(function (v) {
      return typeof v === 'number' ? 'Nivel ' + v : String(v);
    });
    meta.etiquetasNivelCorta = meta.niveles.map(function (v) {
      return typeof v === 'number' ? String(v) : 's/d';
    });
    meta.hayDepartamento = meta.programas.some(function (p) { return !!p.departamento; });
    return meta;
  }
  SAT.normalizaMeta = normalizaMeta;

  /** Construye los arrays tipados que recorre el rollup. */
  function indexa(meta, hechos) {
    var idx = {};
    var cols = hechos.columnas || [];
    var tiene = {}; cols.forEach(function (c) { tiene[c] = true; });

    idx.nFilas = hechos.n ? hechos.n.length : 0;
    idx.periodo = Int16Array.from(hechos.periodo || []);
    idx.programa = Int16Array.from(hechos.programa || []);
    idx.modalidad = Int16Array.from(hechos.modalidad || []);
    idx.nivel = Int16Array.from(hechos.nivel || []);
    idx.estado = Int8Array.from(hechos.estado || []);
    idx.n = Float64Array.from(hechos.n || []);
    idx.tieneMetodologia = !!tiene.metodologia;
    idx.metodologia = Int8Array.from(hechos.metodologia || new Array(idx.nFilas).fill(0));

    // Facultad: viene en la tabla o se deduce del programa.
    idx.progFac = new Int16Array(meta.programas.length);
    idx.progDepto = new Int16Array(meta.programas.length);
    idx.progNivForm = new Int8Array(meta.programas.length);
    idx.progSuprimido = new Uint8Array(meta.programas.length);
    idx.departamentos = [];
    var facPorId = {}; meta.facultades.forEach(function (f, i) { facPorId[f.id] = i; });
    var deptoPorNombre = {};
    meta.programas.forEach(function (p, i) {
      idx.progFac[i] = facPorId[p.facultad] !== undefined ? facPorId[p.facultad] : -1;
      idx.progSuprimido[i] = (p.suprimido || String(p.id).indexOf('__suprimido__') >= 0) ? 1 : 0;
      idx.progNivForm[i] = p.nivel_formacion === 'Tecnologia' ||
        p.nivel_formacion === 'Tecnología' ? 0 : (p.nivel_formacion ? 1 : -1);
      if (p.departamento) {
        if (deptoPorNombre[p.departamento] === undefined) {
          deptoPorNombre[p.departamento] = idx.departamentos.length;
          idx.departamentos.push(p.departamento);
        }
        idx.progDepto[i] = deptoPorNombre[p.departamento];
      } else idx.progDepto[i] = -1;
    });
    // El indice 46 (o el que diga meta.indices) es el programa de celdas suprimidas.
    if (meta.indices && typeof meta.indices.suprimido_programa === 'number'
        && idx.progSuprimido[meta.indices.suprimido_programa] !== undefined) {
      idx.progSuprimido[meta.indices.suprimido_programa] = 1;
    }

    idx.filaFac = new Int16Array(idx.nFilas);
    if (tiene.facultad && hechos.facultad) {
      for (var i = 0; i < idx.nFilas; i++) idx.filaFac[i] = hechos.facultad[i];
    } else {
      for (i = 0; i < idx.nFilas; i++) idx.filaFac[i] = idx.progFac[idx.programa[i]];
    }
    return idx;
  }
  SAT.indexa = indexa;

  /* =====================================================================
     4. Rollup
     ===================================================================== */

  /**
   * Agrega numerador, denominador y censurados por (categoria, periodo).
   * @returns {{categorias, claves, num, den, cen, suprimidas, metodologia}}
   */
  function rollup(est, agrupacion) {
    var idx = est.idx, meta = est.meta, f = est.filtros;
    var idMet = particionPara(meta, f.fenomeno, f.metodologia, f.metodologiaForzada);
    var iMet = (meta.metodologias || []).map(function (m) { return m.id; }).indexOf(idMet);
    var m = mascarasEstados(meta, f.fenomeno, f.tratamientos, idMet);
    var desp = desplazamiento(meta, idMet);
    var nPer = meta.periodos.length;
    var iCensurado = meta.estados.indexOf('CENSURADO');

    var cats = categoriasDe(est, agrupacion);
    var nCat = cats.claves.length;
    var num = [], den = [], cen = [];
    for (var c = 0; c < nCat; c++) {
      num.push(new Float64Array(nPer)); den.push(new Float64Array(nPer)); cen.push(new Float64Array(nPer));
    }
    var suprimidas = 0, suprimidasFuera = 0;

    for (var i = 0; i < idx.nFilas; i++) {
      if (idx.tieneMetodologia && iMet >= 0 && idx.metodologia[i] !== iMet) continue;
      var prog = idx.programa[i];
      var mod = idx.modalidad[i], niv = idx.nivel[i];
      var esSuprimida = idx.progSuprimido[prog] || mod < 0 || niv < 0 || idx.filaFac[i] < 0;
      if (esSuprimida) {
        // Sin filtro de dimension cuentan, porque son estudiantes reales y el
        // total tiene que cuadrar. Con un filtro activo NO cuentan: su facultad,
        // programa, modalidad o nivel estan ocultos y atribuirlos a la categoria
        // elegida inflaria esa categoria con estudiantes de cualquier otra.
        if (f.dimensionFiltrada) { suprimidasFuera += idx.n[i]; continue; }
        suprimidas += idx.n[i];
      } else {
        if (!f.programasActivos[prog]) continue;
        if (f.modalidadFiltrada && !f.modalidadesActivas[mod]) continue;
        if (f.nivelFiltrado && !f.nivelesActivos[niv]) continue;
      }
      var ci = cats.indiceFila(i);
      if (ci < 0) continue;
      var p = idx.periodo[i], e = idx.estado[i], v = idx.n[i];
      if (m.evento[e]) num[ci][p] += v;
      if (e === iCensurado) cen[ci][p] += v;
      if (m.denominador[e]) {
        var destino = p - desp;
        if (destino >= 0 && destino < nPer) den[ci][destino] += v;
      }
    }
    return { categorias: cats.etiquetas, claves: cats.claves, num: num, den: den, cen: cen,
      suprimidas: suprimidas, suprimidasFuera: suprimidasFuera,
      desplazamiento: desp, metodologia: idMet, mascaras: m };
  }
  SAT.rollup = rollup;

  /**
   * Tasa que respeta la censura: si no hubo ningun evento pero hay casos
   * censurados, el dato todavia no se puede confirmar y se devuelve null.
   * Funcion pura.
   */
  function tasaConCensura(numerador, denominador, censurados) {
    if (numerador === 0 && censurados > 0) return null;
    return tasa(numerador, denominador);
  }
  SAT.tasaConCensura = tasaConCensura;

  function categoriasDe(est, agrupacion) {
    var idx = est.idx, meta = est.meta, f = est.filtros;

    if (agrupacion === 'facultad') {
      var fVis = [], fMapa = {};
      meta.facultades.forEach(function (fa, i) {
        if (f.facultadesActivas[i]) { fMapa[i] = fVis.length; fVis.push(i); }
      });
      // Las celdas suprimidas (facultad -1) se muestran como una categoria
      // etiquetada, nunca como una facultad llamada «-1», y asi los totales cuadran.
      var claves = fVis.map(function (i) { return meta.facultades[i].id; });
      var etiquetas = fVis.map(function (i) { return meta.facultades[i].nombre; });
      var iNoPub = claves.length;
      claves.push('__no_publicable__');
      etiquetas.push(ETIQUETA_NO_PUBLICABLE);
      return {
        claves: claves, etiquetas: etiquetas,
        indiceFila: function (r) {
          // Las filas del programa centinela y las de facultad -1 van juntas a
          // la categoria etiquetada, para que los totales sigan cuadrando.
          if (idx.progSuprimido[idx.programa[r]]) return iNoPub;
          var fa = idx.filaFac[r];
          if (fa < 0) return iNoPub;
          var k = fMapa[fa];
          return k === undefined ? -1 : k;
        }
      };
    }
    if (agrupacion === 'departamento') {
      var dVis = [], dMapa = {};
      idx.departamentos.forEach(function (d, i) { dMapa[i] = dVis.length; dVis.push(i); });
      return {
        claves: dVis.map(function (d) { return idx.departamentos[d]; }),
        etiquetas: dVis.map(function (d) { return idx.departamentos[d]; }),
        indiceFila: function (r) {
          var d = idx.progDepto[idx.programa[r]];
          return d < 0 ? -1 : (dMapa[d] === undefined ? -1 : dMapa[d]);
        }
      };
    }
    if (agrupacion === 'programa') {
      var pVis = [], pMapa = {};
      meta.programas.forEach(function (p, i) {
        if (f.programasActivos[i] && !idx.progSuprimido[i]) { pMapa[i] = pVis.length; pVis.push(i); }
      });
      return {
        claves: pVis.map(function (i) { return meta.programas[i].id; }),
        etiquetas: pVis.map(function (i) { return meta.programas[i].nombre; }),
        indiceFila: function (r) { var k = pMapa[idx.programa[r]]; return k === undefined ? -1 : k; }
      };
    }
    if (agrupacion === 'modalidad') {
      return {
        claves: meta.modalidades.slice(), etiquetas: meta.modalidades.slice(),
        indiceFila: function (r) { var m = idx.modalidad[r]; return m >= 0 ? m : -1; }
      };
    }
    if (agrupacion === 'nivel') {
      return {
        claves: meta.niveles.map(String), etiquetas: meta.etiquetasNivel.slice(),
        indiceFila: function (r) {
          var n = idx.nivel[r];
          return (n >= 0 && n < meta.niveles.length) ? n : -1;
        }
      };
    }
    if (agrupacion === 'nivel_formacion') {
      var etq = ['Tecnologia', 'Programa profesional'];
      return {
        claves: etq, etiquetas: etq,
        indiceFila: function (r) { return idx.progNivForm[idx.programa[r]]; }
      };
    }
    return { claves: ['total'], etiquetas: ['Institucional'], indiceFila: function () { return 0; } };
  }
  SAT.categoriasDe = categoriasDe;

  /** Conteo por estado dentro de la ventana, los filtros y la particion activa. */
  function conteoPorEstado(est) {
    var idx = est.idx, meta = est.meta, f = est.filtros;
    var idMet = particionPara(meta, f.fenomeno, f.metodologia, f.metodologiaForzada);
    var iMet = (meta.metodologias || []).map(function (m) { return m.id; }).indexOf(idMet);
    var out = new Float64Array(meta.estados.length);
    for (var i = 0; i < idx.nFilas; i++) {
      if (idx.tieneMetodologia && iMet >= 0 && idx.metodologia[i] !== iMet) continue;
      var p = idx.periodo[i];
      if (p < f.p0 || p > f.p1) continue;
      var prog = idx.programa[i];
      var mod = idx.modalidad[i], niv = idx.nivel[i];
      var sup = idx.progSuprimido[prog] || mod < 0 || niv < 0 || idx.filaFac[i] < 0;
      if (sup) {
        if (f.dimensionFiltrada) continue;   // misma regla que en el rollup
      } else {
        if (!f.programasActivos[prog]) continue;
        if (f.modalidadFiltrada && !f.modalidadesActivas[mod]) continue;
        if (f.nivelFiltrado && !f.nivelesActivos[niv]) continue;
      }
      out[idx.estado[i]] += idx.n[i];
    }
    return out;
  }
  SAT.conteoPorEstado = conteoPorEstado;

  /* =====================================================================
     5. Cubos socioeconomicos
     ===================================================================== */

  /**
   * Agrega un cubo de socio.json. Los cubos tienen grano
   * (metodologia, periodo, facultad, valor, estado): los filtros de programa,
   * modalidad y nivel NO aplican aqui y la interfaz lo avisa.
   * Devuelve null si la dimension no existe para la metodologia activa.
   */
  function rollupSocio(est, dimension) {
    var meta = est.meta, f = est.filtros;
    var socio = est.socio || {};
    var cubo = socio.cubos && socio.cubos[dimension];
    var dim = socio.dimensiones && socio.dimensiones[dimension];
    if (!cubo || !dim) return null;

    var idMet = particionPara(meta, f.fenomeno, f.metodologia, f.metodologiaForzada);
    var iMet = null;
    if (cubo.metodologia) {
      // El mapa de socio.json manda: no todas las metodologias tienen cubos.
      if (socio.metodologias) iMet = socio.metodologias[idMet];
      else iMet = (meta.metodologias || []).map(function (m) { return m.id; }).indexOf(idMet);
      if (iMet === undefined || iMet === null || iMet < 0) {
        return { sinCobertura: true, metodologia: idMet, etiqueta: dim.etiqueta };
      }
    }
    var m = mascarasEstados(meta, f.fenomeno, f.tratamientos, idMet);
    var nVal = dim.valores.length;
    var num = new Float64Array(nVal), den = new Float64Array(nVal);
    var porPeriodo = [], suprimidas = 0;
    for (var v = 0; v < nVal; v++) {
      porPeriodo.push({ num: new Float64Array(meta.periodos.length),
        den: new Float64Array(meta.periodos.length) });
    }
    for (var i = 0; i < cubo.n.length; i++) {
      if (iMet !== null && cubo.metodologia && cubo.metodologia[i] !== iMet) continue;
      // Celdas suprimidas: el centinela puede estar en la facultad o en el valor.
      if (cubo.facultad[i] < 0) { suprimidas += cubo.n[i]; continue; }
      if (!f.facultadesActivas[cubo.facultad[i]]) continue;
      var val = cubo.valor[i];
      if (val < 0) { suprimidas += cubo.n[i]; continue; }
      var p = cubo.periodo[i], e = cubo.estado[i], x = cubo.n[i];
      if (p >= f.p0 && p <= f.p1) {
        if (m.evento[e]) num[val] += x;
        if (m.denominador[e]) den[val] += x;
      }
      if (m.evento[e]) porPeriodo[val].num[p] += x;
      if (m.denominador[e]) porPeriodo[val].den[p] += x;
    }
    return { etiqueta: dim.etiqueta, valores: dim.valores.slice(), num: num, den: den,
      porPeriodo: porPeriodo, suprimidas: suprimidas, metodologia: idMet };
  }
  SAT.rollupSocio = rollupSocio;

  /* =====================================================================
     5-bis. Combinacion de resumenes numericos publicados
     ===================================================================== */

  /** Combina resumenes: media y varianza exactas, cuantiles ponderados. Funcion pura. */
  function combinarResumenes(filas, ci) {
    var N = 0, sx = 0, sxx = 0;
    var q = { min: 0, q1: 0, mediana: 0, q3: 0, max: 0, p05: 0, p95: 0 };
    filas.forEach(function (r) {
      var n = r[ci.n], mu = r[ci.media], de = r[ci.de];
      N += n; sx += n * mu; sxx += n * (de * de + mu * mu);
      Object.keys(q).forEach(function (k) { q[k] += n * r[ci[k]]; });
    });
    if (!N) return { n: 0 };
    var media = sx / N, varianza = Math.max(sxx / N - media * media, 0);
    var o = { n: N, media: media, de: Math.sqrt(varianza) };
    Object.keys(q).forEach(function (k) { o[k] = q[k] / N; });
    return o;
  }
  SAT.combinarResumenes = combinarResumenes;

  /** Reagrupa varios histogramas a una rejilla comun de 16 clases. Funcion pura. */
  function combinarHistogramas(filas, ci) {
    if (!filas.length) return null;
    var lo = Infinity, hi = -Infinity;
    filas.forEach(function (r) {
      var b = r[ci.bordes];
      lo = Math.min(lo, b[0]); hi = Math.max(hi, b[b.length - 1]);
    });
    if (!isFinite(lo) || !isFinite(hi) || hi <= lo) return null;
    var K = 16, paso = (hi - lo) / K, bordes = [], conteos = new Array(K).fill(0);
    for (var i = 0; i <= K; i++) bordes.push(lo + i * paso);
    filas.forEach(function (r) {
      var b = r[ci.bordes], c = r[ci.conteos];
      for (var j = 0; j < c.length; j++) {
        if (!c[j]) continue;
        var a0 = b[j], a1 = b[j + 1], ancho = a1 - a0;
        if (ancho <= 0) continue;
        for (var k = 0; k < K; k++) {
          var s0 = Math.max(a0, bordes[k]), s1 = Math.min(a1, bordes[k + 1]);
          if (s1 > s0) conteos[k] += c[j] * (s1 - s0) / ancho;
        }
      }
    });
    return { bordes: bordes, conteos: conteos };
  }
  SAT.combinarHistogramas = combinarHistogramas;

  /* =====================================================================
     6. Carga
     ===================================================================== */
  var ARCHIVOS = ['meta.json', 'hechos.json', 'socio.json', 'flujos.json', 'numericas.json'];

  function traer(ruta) {
    return fetch(ruta, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + ruta);
      return r.json();
    });
  }

  /** Carga desde `datos/`; si no existe, cae a `datos-demo/`. Rutas relativas siempre. */
  function cargar() {
    return traer('datos/meta.json')
      .then(function () { return 'datos/'; })
      .catch(function () { return 'datos-demo/'; })
      .then(function (base) {
        return Promise.all(ARCHIVOS.map(function (a) { return traer(base + a); }))
          .then(function (r) {
            return { origen: base, meta: normalizaMeta(r[0]), hechos: r[1],
              socio: r[2], flujos: r[3], numericas: r[4] };
          });
      });
  }
  SAT.cargar = cargar;

  /* =====================================================================
     7. Formato
     ===================================================================== */
  var fNum = new Intl.NumberFormat('es-CO');
  SAT.fmt = {
    num: function (v) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      return fNum.format(Math.round(v));
    },
    pct: function (v, n) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      return v.toFixed(decimalesSegunN(n)).replace('.', ',') + ' %';
    },
    dec: function (v, d) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      return v.toFixed(d === undefined ? 2 : d).replace('.', ',');
    }
  };

})(window);
