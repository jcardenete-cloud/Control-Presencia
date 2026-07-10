import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '').trim();
const supabaseSecretKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_SECRET_KEY || import.meta.env.SUPABASE_ANON_KEY || import.meta.env.SUPABASE_SECRET_KEY || '').trim();

const normalizedSecretKey = supabaseSecretKey.replace(/^['"]|['"]$/g, '').trim();

export const supabase = supabaseUrl && normalizedSecretKey && normalizedSecretKey !== 'your_supabase_secret_key'
  ? createClient(supabaseUrl, normalizedSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
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

export async function loginUser(nombre, password) {
  const user = await readSingleRow('usuarios', {
    eq: { column: 'nombre', value: nombre }
  });

  if (!user) {
    throw new Error('Credenciales inválidas');
  }

  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    throw new Error('Credenciales inválidas');
  }

  return {
    success: true,
    user: {
      id: user.id,
      nombre: user.nombre,
      is_admin: user.is_admin
    }
  };
}

export async function getUsuarios() {
  return readRows('usuarios', {
    select: 'id,nombre,apellido1,apellido2,is_admin',
    orderBy: { column: 'id', ascending: true }
  });
}

export async function createUsuario(payload) {
  const hashedPassword = await bcrypt.hash(payload.password, 12);
  return insertRow('usuarios', {
    ...payload,
    password: hashedPassword,
    is_admin: Boolean(payload.is_admin)
  });
}

export async function updateUsuario(id, payload) {
  const updates = { ...payload, is_admin: Boolean(payload.is_admin) };
  if (payload.password) {
    updates.password = await bcrypt.hash(payload.password, 12);
  }

  return updateRow('usuarios', id, updates);
}

export async function deleteUsuario(id) {
  return deleteRows('usuarios', { eq: { column: 'id', value: id } });
}
