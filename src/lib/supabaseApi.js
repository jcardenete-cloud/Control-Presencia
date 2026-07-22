import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '').trim();
const supabaseSecretKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_SECRET_KEY || import.meta.env.SUPABASE_ANON_KEY || import.meta.env.SUPABASE_SECRET_KEY || '').trim();

const normalizedSecretKey = supabaseSecretKey.replace(/^['"]|['"]$/g, '').trim();

export const supabase = supabaseUrl && normalizedSecretKey && normalizedSecretKey !== 'your_supabase_secret_key'
  ? createClient(supabaseUrl, normalizedSecretKey, {
      db: { schema: 'jcf' },
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;

export const isSupabaseConfigured = Boolean(supabase);

function ensureSupabase() {
  if (!supabase) {
    throw new Error('No se ha configurado Supabase. Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en GitHub Actions y en la build.');
  }
  return supabase;
}

async function readRows(table, options = {}) {
  const client = ensureSupabase();
  let query = client.from(table).select(options.select || '*');

  if (options.eq) {
    query = query.eq(options.eq.column, options.eq.value);
  }

  if (options.orderBy) {
    query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function readSingleRow(table, options = {}) {
  const client = ensureSupabase();
  let query = client.from(table).select(options.select || '*');

  if (options.eq) {
    query = query.eq(options.eq.column, options.eq.value);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

async function insertRow(table, payload) {
  const { data, error } = await ensureSupabase().from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function updateRow(table, id, payload) {
  const { data, error } = await ensureSupabase().from(table).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteRows(table, options = {}) {
  let query = ensureSupabase().from(table).delete();
  if (options.eq) {
    query = query.eq(options.eq.column, options.eq.value);
  }
  const { error } = await query;
  if (error) throw error;
}

export async function getFichajes() {
  return readRows('fichajes', {
    orderBy: { column: 'date', ascending: false },
    select: 'id,date,start_time,end_time,manual'
  });
}

export async function createFichaje(payload) {
  return insertRow('fichajes', payload);
}

export async function updateFichaje(id, payload) {
  return updateRow('fichajes', id, payload);
}

export async function deleteFichaje(id) {
  return deleteRows('fichajes', { eq: { column: 'id', value: id } });
}

export async function getConfig() {
  const data = await readSingleRow('config', { eq: { column: 'id', value: 1 } });
  return data || {};
}

export async function saveConfig(payload) {
  const { data, error } = await ensureSupabase()
    .from('config')
    .upsert({ id: 1, ...payload })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getWeeklyLeftovers() {
  return readRows('weekly_leftovers', {
    orderBy: { column: 'week_start', ascending: false },
    select: 'id,week_start,leftover'
  });
}

export async function saveWeeklyLeftover(payload) {
  const { data, error } = await ensureSupabase()
    .from('weekly_leftovers')
    .upsert(payload, { onConflict: 'week_start' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProjectionDays() {
  const rows = await readRows('projection_days', {
    select: 'date,hours'
  });
  return rows.reduce((acc, row) => {
    acc[row.date] = row.hours;
    return acc;
  }, {});
}

export async function saveProjectionDay(payload) {
  const { data, error } = await ensureSupabase()
    .from('projection_days')
    .upsert(payload, { onConflict: 'date' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProjectionDays() {
  return deleteRows('projection_days');
}

export async function getPlannedShifts() {
  return readRows('planned_shifts', {
    orderBy: { column: 'date', ascending: true },
    select: 'id,date,start_time,end_time'
  });
}

export async function createPlannedShift(payload) {
  return insertRow('planned_shifts', payload);
}

export async function deletePlannedShift(id) {
  return deleteRows('planned_shifts', { eq: { column: 'id', value: id } });
}

export async function clearPlannedShifts() {
  return deleteRows('planned_shifts');
}

export async function checkUserPresencia(email) {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  console.log('[checkUserPresencia] Verificando acceso para email:', cleanEmail);

  try {
    const client = ensureSupabase();
    
    // Intento 1: Consultar especificando esquema 'jcf' si está disponible
    let query = client.schema ? client.schema('jcf').from('app_usuarios') : client.from('app_usuarios');
    let { data, error } = await query.select('*');

    if (error) {
      console.warn('[checkUserPresencia] Error al consultar con .schema("jcf"), reintentando cliente directo:', error);
      const fallback = await client.from('app_usuarios').select('*');
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('[checkUserPresencia] Error final consultando la tabla app_usuarios:', error);
      return false;
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn('[checkUserPresencia] La tabla app_usuarios no devolvió registros o está vacía.');
      return false;
    }

    console.log(`[checkUserPresencia] Se obtuvieron ${data.length} registros de app_usuarios:`, data);

    // Buscar coincidencia de email ignorando mayúsculas/minúsculas y espacios
    const userRow = data.find(row => {
      const rowEmail = String(row.email || row.mail || row.usuario || row.user_email || '').trim().toLowerCase();
      return rowEmail === cleanEmail;
    });

    if (!userRow) {
      console.warn(`[checkUserPresencia] No se encontró ningún usuario coincidente con email: "${cleanEmail}"`);
      return false;
    }

    console.log('[checkUserPresencia] Usuario encontrado en app_usuarios:', userRow);

    // Comprobar presencia (boolean true, string 'true'/'t'/'1'/'si'/'yes', número 1, etc.)
    const rawPresencia = userRow.presencia ?? userRow.Presencia;
    const isTrue = 
      rawPresencia === true ||
      rawPresencia === 1 ||
      ['true', 't', '1', 'si', 'sí', 'yes'].includes(String(rawPresencia).trim().toLowerCase());

    if (!isTrue) {
      console.warn(`[checkUserPresencia] El usuario "${cleanEmail}" existe pero su campo presencia no es true (valor actual:`, rawPresencia, `)`);
      return false;
    }

    console.log(`[checkUserPresencia] ¡Acceso AUTORIZADO para ${cleanEmail}!`);
    return true;
  } catch (err) {
    console.error('[checkUserPresencia] Excepción inesperada:', err);
    return false;
  }
}

export async function loginUser(email, password) {
  const cleanEmail = (email || '').trim();
  console.log('Intentando login para:', cleanEmail);

  // Asegurar que limpiamos cualquier sesión residual anterior de un intento previo
  try {
    await ensureSupabase().auth.signOut();
  } catch (e) {
    // ignorar error de signOut previo
  }

  const { data, error } = await ensureSupabase().auth.signInWithPassword({
    email: cleanEmail,
    password
  });

  if (error) {
    console.error('Error en Supabase auth.signInWithPassword:', error);
    throw new Error('No tiene acceso a esta aplicación');
  }

  const hasAccess = await checkUserPresencia(cleanEmail);
  if (!hasAccess) {
    console.error('Acceso denegado en app_usuarios: email no existe o presencia no es true');
    try {
      await ensureSupabase().auth.signOut();
    } catch (e) {}
    throw new Error('No tiene acceso a esta aplicación');
  }

  return {
    success: true,
    user: {
      id: data.user.id,
      nombre: data.user.email,
      is_admin: true
    }
  };
}

export async function logoutUser() {
  try {
    const { error } = await ensureSupabase().auth.signOut();
    if (error) console.warn('Error en auth.signOut:', error);
  } catch (err) {
    console.warn('Excepción en logoutUser:', err);
  }
}

