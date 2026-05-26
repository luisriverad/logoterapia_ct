import { supabase } from '../supabaseClient.js';
import {
  isUuid,
  consultanteFromRow,
  consultanteToRow,
  notaFromRow,
  notaToRow,
  reporteFromRow,
  reporteToRow,
  citaFromRow,
  citaToRow,
  ayudaFromRow,
  ayudaToRow,
  bibliotecaFromRow,
  bibliotecaToRow,
} from './mappers.js';

const MIGRATION_FLAG_PREFIX = 'platform_migrated_v1_';

function migrationFlagKey(userId) {
  return `${MIGRATION_FLAG_PREFIX}${userId}`;
}

function readLocalJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hasLocalPlatformData() {
  const keys = ['consultantes', 'sesiones', 'notas', 'citas', 'ayuda_conversaciones', 'biblioteca'];
  return keys.some((k) => {
    const v = readLocalJson(k);
    return Array.isArray(v) && v.length > 0;
  });
}

/** @param {string} legacyOrUuid @param {Record<string, string>} idMap */
function resolveConsultanteId(legacyOrUuid, idMap) {
  if (!legacyOrUuid) return null;
  if (isUuid(legacyOrUuid)) return legacyOrUuid;
  return idMap[legacyOrUuid] || null;
}

async function countUserRows(table, userId) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}

export async function loadAllData(userId) {
  const [
    { data: consultantesRows, error: e1 },
    { data: notasRows, error: e2 },
    { data: reportesRows, error: e3 },
    { data: citasRows, error: e4 },
    { data: ayudaRows, error: e5 },
    { data: bibRows, error: e6 },
  ] = await Promise.all([
    supabase.from('consultantes').select('*').eq('user_id', userId).order('nombre'),
    supabase.from('notas_sesion').select('*').eq('user_id', userId).order('fecha', { ascending: false }),
    supabase.from('reportes_sesion').select('*').eq('user_id', userId).order('fecha', { ascending: false }),
    supabase.from('citas').select('*').eq('user_id', userId).order('fecha'),
    supabase.from('ayuda_conversaciones').select('*').eq('user_id', userId).order('actualizada', { ascending: false }),
    supabase.from('biblioteca').select('*').eq('user_id', userId).order('fecha', { ascending: false }),
  ]);

  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  if (e4) throw e4;
  if (e5) throw e5;
  if (e6) throw e6;

  const consultantes = (consultantesRows || []).map((r) => consultanteFromRow(r));
  const notas = (notasRows || []).map((r) => notaFromRow(r, consultantes));
  const sesiones = (reportesRows || []).map((r) => reporteFromRow(r, consultantes));
  const citas = (citasRows || []).map((r) => citaFromRow(r, consultantes));
  const ayudaConversaciones = (ayudaRows || []).map((r) => ayudaFromRow(r));
  const biblioteca = (bibRows || []).map((r) => bibliotecaFromRow(r));

  return { consultantes, notas, sesiones, citas, ayudaConversaciones, biblioteca };
}

export async function migrateFromLocalStorage(userId) {
  if (localStorage.getItem(migrationFlagKey(userId))) return false;
  if (!hasLocalPlatformData()) return false;

  const existing = await countUserRows('consultantes', userId);
  if (existing > 0) {
    localStorage.setItem(migrationFlagKey(userId), '1');
    return false;
  }

  const localConsultantes = readLocalJson('consultantes') || [];
  const localNotas = readLocalJson('notas') || [];
  const localSesiones = readLocalJson('sesiones') || [];
  const localCitas = readLocalJson('citas') || [];
  const localAyuda = readLocalJson('ayuda_conversaciones') || [];
  const localBib = readLocalJson('biblioteca') || [];

  const idMap = {};

  for (const c of localConsultantes) {
    const legacyId = c.id;
    const row = consultanteToRow(userId, c, { legacyId });
    const { data, error } = await supabase.from('consultantes').insert(row).select().single();
    if (error) throw error;
    if (legacyId) idMap[legacyId] = data.id;
    idMap[data.id] = data.id;
  }

  for (const n of localNotas) {
    const cid = resolveConsultanteId(n.consultanteId, idMap);
    if (!cid) continue;
    const row = { ...notaToRow(userId, n, cid), legacy_id: n.id };
    const { error } = await supabase.from('notas_sesion').insert(row);
    if (error) throw error;
  }

  for (const r of localSesiones) {
    const cid = resolveConsultanteId(r.consultanteId, idMap);
    if (!cid) continue;
    const row = { ...reporteToRow(userId, r, cid), legacy_id: r.id };
    const { error } = await supabase.from('reportes_sesion').insert(row);
    if (error) throw error;
  }

  for (const cita of localCitas) {
    const cid = resolveConsultanteId(cita.consultanteId, idMap);
    if (!cid) continue;
    const row = { ...citaToRow(userId, cita, cid), legacy_id: cita.id };
    const { error } = await supabase.from('citas').insert(row);
    if (error) throw error;
  }

  const ayudaIdMap = {};
  for (const conv of localAyuda) {
    const legacyId = conv.id;
    const row = ayudaToRow(userId, conv);
    row.legacy_id = legacyId;
    const { data, error } = await supabase.from('ayuda_conversaciones').insert(row).select().single();
    if (error) throw error;
    if (legacyId) ayudaIdMap[legacyId] = data.id;
  }

  for (const b of localBib) {
    const origen = b.origen
      ? {
          convId: ayudaIdMap[b.origen.convId] || b.origen.convId,
          idx: b.origen.idx,
        }
      : null;
    const row = {
      ...bibliotecaToRow(userId, b),
      legacy_id: b.id,
      origen,
    };
    const { error } = await supabase.from('biblioteca').insert(row);
    if (error) throw error;
  }

  localStorage.setItem(migrationFlagKey(userId), '1');
  return true;
}

// ——— Consultantes ———

export async function insertConsultante(userId, data) {
  const row = consultanteToRow(userId, { ...data, fechaAlta: new Date().toISOString() });
  const { data: inserted, error } = await supabase.from('consultantes').insert(row).select().single();
  if (error) throw error;
  return consultanteFromRow(inserted);
}

export async function updateConsultante(userId, id, data) {
  const patch = consultanteToRow(userId, { ...data, id });
  delete patch.user_id;
  delete patch.legacy_id;
  const { data: updated, error } = await supabase
    .from('consultantes')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return consultanteFromRow(updated);
}

export async function deleteConsultante(userId, id) {
  const { error } = await supabase.from('consultantes').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ——— Notas ———

export async function insertNota(userId, nota, consultanteId) {
  const row = notaToRow(userId, nota, consultanteId);
  const { data, error } = await supabase.from('notas_sesion').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateNota(userId, id, nota, consultanteId) {
  const patch = notaToRow(userId, nota, consultanteId);
  delete patch.user_id;
  delete patch.legacy_id;
  const { data, error } = await supabase
    .from('notas_sesion')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNota(userId, id) {
  const { error } = await supabase.from('notas_sesion').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ——— Reportes (sesiones) ———

export async function insertReporte(userId, reporte, consultanteId) {
  const row = reporteToRow(userId, reporte, consultanteId);
  const { data, error } = await supabase.from('reportes_sesion').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateReporte(userId, id, reporte, consultanteId) {
  const patch = reporteToRow(userId, reporte, consultanteId);
  delete patch.user_id;
  delete patch.legacy_id;
  const { data, error } = await supabase
    .from('reportes_sesion')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteReporte(userId, id) {
  const { error } = await supabase.from('reportes_sesion').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ——— Citas ———

export async function insertCita(userId, cita, consultanteId) {
  const row = citaToRow(userId, cita, consultanteId);
  const { data, error } = await supabase.from('citas').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateCita(userId, id, cita, consultanteId) {
  const patch = citaToRow(userId, cita, consultanteId);
  delete patch.user_id;
  delete patch.legacy_id;
  const { data, error } = await supabase
    .from('citas')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCita(userId, id) {
  const { error } = await supabase.from('citas').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ——— Ayuda ———

export async function upsertAyudaConversacion(userId, conv) {
  const base = ayudaToRow(userId, conv);
  if (isUuid(conv.id)) {
    const { data, error } = await supabase
      .from('ayuda_conversaciones')
      .update({
        titulo: base.titulo,
        mensajes: base.mensajes,
        actualizada: base.actualizada,
      })
      .eq('id', conv.id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return ayudaFromRow(data);
  }
  const { data, error } = await supabase
    .from('ayuda_conversaciones')
    .insert({ ...base, legacy_id: conv.id })
    .select()
    .single();
  if (error) throw error;
  return ayudaFromRow(data);
}

export async function deleteAyudaConversacion(userId, id) {
  const { error } = await supabase.from('ayuda_conversaciones').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ——— Biblioteca ———

export async function insertBiblioteca(userId, entrada) {
  const row = bibliotecaToRow(userId, entrada);
  const { data, error } = await supabase.from('biblioteca').insert(row).select().single();
  if (error) throw error;
  return bibliotecaFromRow(data);
}

export async function updateBibliotecaTitulo(userId, id, titulo) {
  const { data, error } = await supabase
    .from('biblioteca')
    .update({ titulo })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return bibliotecaFromRow(data);
}

export async function deleteBiblioteca(userId, id) {
  const { error } = await supabase.from('biblioteca').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export function loadApiKeyFromLocal() {
  const k = localStorage.getItem('anthropic_api_key');
  if (k) return k;
  return import.meta.env.VITE_ANTHROPIC_API_KEY || '';
}
