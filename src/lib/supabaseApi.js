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
  try {
    const { data, error } = await ensureSupabase()
      .from('app_usuarios')
      .select('email, presencia')
      .eq('email', email)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error('Error consultando jcf.app_usuarios:', error);
      return false;
    }

    return data.presencia === true || String(data.presencia).toLowerCase() === 'true';
  } catch (err) {
    console.error('Excepción consultando jcf.app_usuarios:', err);
    return false;
  }
}

export async function loginUser(email, password) {
  console.log('Intentando login para:', email);
  const { data, error } = await ensureSupabase().auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('Error en Supabase auth.signInWithPassword:', error);
    throw new Error('No tiene acceso a esta aplicación');
  }

  try {
    const hasAccess = await checkUserPresencia(email);
    if (!hasAccess) {
      console.error('Acceso denegado en app_usuarios: email no existe o presencia no es true');
      await ensureSupabase().auth.signOut();
      throw new Error('No tiene acceso a esta aplicación');
    }
  } catch (err) {
    await ensureSupabase().auth.signOut();
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
  const { error } = await ensureSupabase().auth.signOut();
  if (error) throw error;
}

