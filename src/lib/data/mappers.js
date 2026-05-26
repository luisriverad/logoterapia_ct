function dateOnly(value) {
  if (!value) return '';
  const s = String(value);
  return s.includes('T') ? s.slice(0, 10) : s.slice(0, 10);
}

/** @param {string|null|undefined} id */
export function isUuid(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function consultanteFromRow(row, nombreCache) {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    nombre: row.nombre,
    edad: row.edad != null ? String(row.edad) : '',
    telefono: row.telefono || '',
    motivoConsulta: row.motivo_consulta || '',
    quienRefiere: row.quien_refiere || '',
    fechaAlta: row.fecha_alta || row.created_at,
  };
}

export function consultanteToRow(userId, c, { legacyId } = {}) {
  return {
    user_id: userId,
    legacy_id: legacyId ?? c.legacyId ?? (isUuid(c.id) ? null : c.id),
    nombre: c.nombre,
    edad: c.edad ? parseInt(String(c.edad), 10) : null,
    telefono: c.telefono || null,
    motivo_consulta: c.motivoConsulta || null,
    quien_refiere: c.quienRefiere || null,
    fecha_alta: c.fechaAlta || new Date().toISOString(),
  };
}

export function notaFromRow(row, consultantes) {
  const c = consultantes.find((x) => x.id === row.consultante_id);
  return {
    id: row.id,
    legacyId: row.legacy_id,
    consultanteId: row.consultante_id,
    sesionNum: row.sesion_num || '',
    consultaDe: row.consulta_de || '',
    fecha: dateOnly(row.fecha),
    motivoConsulta: row.motivo_consulta || '',
    temaConsulta: row.tema_consulta || '',
    contenido: row.contenido || '',
    consultanteNombre: c?.nombre,
    edad: c?.edad,
    fechaCreacion: row.created_at,
  };
}

export function notaToRow(userId, n, consultanteId) {
  return {
    user_id: userId,
    consultante_id: consultanteId,
    legacy_id: isUuid(n.id) ? null : n.id,
    sesion_num: n.sesionNum || null,
    consulta_de: n.consultaDe || null,
    fecha: n.fecha,
    motivo_consulta: n.motivoConsulta || null,
    tema_consulta: n.temaConsulta || null,
    contenido: n.contenido || null,
  };
}

export function reporteFromRow(row, consultantes) {
  const c = consultantes.find((x) => x.id === row.consultante_id);
  return {
    id: row.id,
    legacyId: row.legacy_id,
    orientador: row.orientador || '',
    consultanteId: row.consultante_id,
    sesionNum: row.sesion_num || '',
    consultaDe: row.consulta_de || '',
    totalSesiones: row.total_sesiones || '',
    fecha: dateOnly(row.fecha),
    motivoConsulta: row.motivo_consulta || '',
    temaConsulta: row.tema_consulta || '',
    intervencion: row.intervencion || '',
    autoObservacion: row.auto_observacion || '',
    tiempoSesion: row.tiempo_sesion || '',
    consultanteNombre: c?.nombre,
    edad: c?.edad,
    fechaCreacion: row.created_at,
  };
}

export function reporteToRow(userId, r, consultanteId) {
  return {
    user_id: userId,
    consultante_id: consultanteId,
    legacy_id: isUuid(r.id) ? null : r.id,
    orientador: r.orientador || null,
    sesion_num: r.sesionNum || null,
    consulta_de: r.consultaDe || null,
    total_sesiones: r.totalSesiones || null,
    fecha: r.fecha,
    motivo_consulta: r.motivoConsulta || null,
    tema_consulta: r.temaConsulta || null,
    intervencion: r.intervencion || null,
    auto_observacion: r.autoObservacion || null,
    tiempo_sesion: r.tiempoSesion || null,
  };
}

export function citaFromRow(row, consultantes) {
  const c = consultantes.find((x) => x.id === row.consultante_id);
  const hora = row.hora ? String(row.hora).slice(0, 5) : '';
  const horaFin = row.hora_fin ? String(row.hora_fin).slice(0, 5) : '';
  return {
    id: row.id,
    legacyId: row.legacy_id,
    consultanteId: row.consultante_id,
    fecha: dateOnly(row.fecha),
    hora,
    horaFin,
    duracion: row.duracion_min ?? 60,
    notas: row.notas || '',
    consultanteNombre: c?.nombre,
  };
}

export function citaToRow(userId, cita, consultanteId) {
  return {
    user_id: userId,
    consultante_id: consultanteId,
    legacy_id: isUuid(cita.id) ? null : cita.id,
    fecha: cita.fecha,
    hora: cita.hora || null,
    hora_fin: cita.horaFin || null,
    duracion_min: cita.duracion ?? null,
    notas: cita.notas || null,
  };
}

export function ayudaFromRow(row) {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    titulo: row.titulo || '',
    mensajes: Array.isArray(row.mensajes) ? row.mensajes : [],
    creada: row.creada,
    actualizada: row.actualizada,
  };
}

export function ayudaToRow(userId, conv) {
  return {
    user_id: userId,
    legacy_id: isUuid(conv.id) ? null : conv.id,
    titulo: conv.titulo || '',
    mensajes: conv.mensajes || [],
    creada: conv.creada || new Date().toISOString(),
    actualizada: conv.actualizada || new Date().toISOString(),
  };
}

export function bibliotecaFromRow(row) {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    titulo: row.titulo || '',
    pregunta: row.pregunta || '',
    respuesta: row.respuesta || '',
    fecha: row.fecha,
    origen: row.origen || null,
  };
}

export function bibliotecaToRow(userId, b) {
  return {
    user_id: userId,
    legacy_id: isUuid(b.id) ? null : b.id,
    titulo: b.titulo || '',
    pregunta: b.pregunta || null,
    respuesta: b.respuesta || '',
    fecha: b.fecha || new Date().toISOString(),
    origen: b.origen || null,
  };
}
