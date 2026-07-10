import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let client;

export const dbConfig = {
    supabaseUrl: process.env.SUPABASE_URL,
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
};

export function getSupabaseClient() {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY.');
    }
    if (!client) {
        client = createClient(supabaseUrl, supabaseKey, {
            db: { schema: 'jcf' },
            auth: { persistSession: false, autoRefreshToken: false }
        });
    }
    return client;
}

export async function getConnection() {
    const supabase = getSupabaseClient();
    return {
        async query(sql, params = []) {
            const upperSql = sql.trim().toUpperCase();
            if (upperSql.startsWith('SELECT') && upperSql.includes('FROM FICHAJES')) {
                const { data, error } = await supabase.from('fichajes').select('id,date,start_time,end_time,manual').order('date', { ascending: false }).order('start_time', { ascending: true });
                if (error) throw error;
                return data.map(row => ({ ...row, date: row.date ? String(row.date).slice(0, 10) : row.date }));
            }
            if (upperSql.startsWith('SELECT') && upperSql.includes('FROM CONFIG')) {
                const { data, error } = await supabase.from('config').select('*').eq('id', params[0] || 1);
                if (error) throw error;
                return data || [];
            }
            if (upperSql.startsWith('SELECT') && upperSql.includes('FROM USUARIOS')) {
                let query = supabase.from('usuarios').select('*');
                if (upperSql.includes('WHERE NOMBRE')) query = query.eq('nombre', params[0]);
                if (upperSql.includes('ORDER BY ID')) query = query.order('id', { ascending: true });
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            }
            if (upperSql.startsWith('SELECT') && upperSql.includes('FROM PROJECTION_DAYS')) {
                const { data, error } = await supabase.from('projection_days').select('date,hours');
                if (error) throw error;
                return data || [];
            }
            if (upperSql.startsWith('SELECT') && upperSql.includes('FROM PLANNED_SHIFTS')) {
                const { data, error } = await supabase.from('planned_shifts').select('id,date,start_time,end_time');
                if (error) throw error;
                return data || [];
            }
            if (upperSql.startsWith('SELECT') && upperSql.includes('FROM WEEKLY_LEFTOVERS')) {
                const { data, error } = await supabase.from('weekly_leftovers').select('id,week_start,leftover').order('week_start', { ascending: false });
                if (error) throw error;
                return data || [];
            }
            if (upperSql.startsWith('INSERT') && upperSql.includes('INTO FICHAJES')) {
                const [date, startTime, endTime, manual] = params;
                const { data, error } = await supabase.from('fichajes').insert({ date, start_time: startTime, end_time: endTime, manual: Boolean(manual) }).select('id');
                if (error) throw error;
                return { insertId: data?.[0]?.id ?? 0 };
            }
            if (upperSql.startsWith('INSERT') && upperSql.includes('INTO PROJECTION_DAYS')) {
                const [date, hours] = params;
                const { error } = await supabase.from('projection_days').upsert({ date, hours }, { onConflict: 'date' });
                if (error) throw error;
                return { success: true };
            }
            if (upperSql.startsWith('INSERT') && upperSql.includes('INTO PLANNED_SHIFTS')) {
                const [date, startTime, endTime] = params;
                const { data, error } = await supabase.from('planned_shifts').insert({ date, start_time: startTime, end_time: endTime }).select('id');
                if (error) throw error;
                return { insertId: data?.[0]?.id ?? 0 };
            }
            if (upperSql.startsWith('INSERT') && upperSql.includes('INTO WEEKLY_LEFTOVERS')) {
                const [weekStart, leftover] = params;
                const { error } = await supabase.from('weekly_leftovers').upsert({ week_start: weekStart, leftover }, { onConflict: 'week_start' });
                if (error) throw error;
                return { success: true };
            }
            if (upperSql.startsWith('INSERT') && upperSql.includes('INTO USUARIOS')) {
                const [nombre, apellido1, apellido2, password, isAdmin] = params;
                const { data, error } = await supabase.from('usuarios').insert({ nombre, apellido1, apellido2, password, is_admin: Boolean(isAdmin) }).select('id');
                if (error) throw error;
                return { insertId: data?.[0]?.id ?? 0 };
            }
            if (upperSql.startsWith('UPDATE') && upperSql.includes('UPDATE FICHAJES')) {
                const [startTime, endTime, id] = params;
                const payload = {};
                if (startTime !== undefined) payload.start_time = startTime;
                if (endTime !== undefined) payload.end_time = endTime;
                const { error } = await supabase.from('fichajes').update(payload).eq('id', id);
                if (error) throw error;
                return { success: true };
            }
            if (upperSql.startsWith('UPDATE') && upperSql.includes('UPDATE CONFIG')) {
                const [hoursPerWeek, hoursPerWeekSummer, dailyHoursWinter, dailyHoursSummer, hoursLeftover] = params;
                const { error } = await supabase.from('config').update({ hours_per_week: hoursPerWeek, hours_per_week_summer: hoursPerWeekSummer, daily_hours_winter: dailyHoursWinter, daily_hours_summer: dailyHoursSummer, hours_leftover: hoursLeftover }).eq('id', 1);
                if (error) throw error;
                return { success: true };
            }
            if (upperSql.startsWith('UPDATE') && upperSql.includes('UPDATE USUARIOS')) {
                const [nombre, apellido1, apellido2, password, isAdmin, id] = params;
                const payload = { nombre, apellido1, apellido2, is_admin: Boolean(isAdmin) };
                if (password) payload.password = password;
                const { error } = await supabase.from('usuarios').update(payload).eq('id', id);
                if (error) throw error;
                return { success: true };
            }
            if (upperSql.startsWith('DELETE') && upperSql.includes('FROM FICHAJES')) {
                const { error } = await supabase.from('fichajes').delete().eq('id', params[0]);
                if (error) throw error;
                return { success: true };
            }
            if (upperSql.startsWith('DELETE') && upperSql.includes('FROM PROJECTION_DAYS')) {
                const { error } = await supabase.from('projection_days').delete().neq('date', '');
                if (error) throw error;
                return { success: true };
            }
            if (upperSql.startsWith('DELETE') && upperSql.includes('FROM PLANNED_SHIFTS')) {
                const { error } = await supabase.from('planned_shifts').delete().neq('date', '');
                if (error) throw error;
                return { success: true };
            }
            if (upperSql.startsWith('DELETE') && upperSql.includes('FROM WEEKLY_LEFTOVERS')) {
                const { error } = await supabase.from('weekly_leftovers').delete().neq('week_start', '');
                if (error) throw error;
                return { success: true };
            }
            if (upperSql.startsWith('DELETE') && upperSql.includes('FROM USUARIOS')) {
                const { error } = await supabase.from('usuarios').delete().eq('id', params[0]);
                if (error) throw error;
                return { success: true };
            }
            throw new Error(`Unsupported query: ${sql}`);
        },
        async release() {},
        async end() {}
    };
}

export async function initDb() {
    try {
        const supabase = getSupabaseClient();
        const { data: existingConfig, error: configError } = await supabase.from('config').select('*').eq('id', 1).maybeSingle();
        if (configError && !configError.message?.includes('relation')) {
            console.warn('Supabase config seed skipped:', configError.message);
            return;
        }
        if (!existingConfig) {
            await supabase.from('config').upsert({ id: 1, hours_per_week: 38.5, hours_per_week_summer: 35.0, daily_hours_winter: 7.7, daily_hours_summer: 7.0, hours_leftover: 0.0 }, { onConflict: 'id' });
        }
        const { data: adminRows, error: adminError } = await supabase.from('usuarios').select('*').eq('nombre', 'admin').limit(1);
        if (adminError) {
            console.warn('Supabase admin seed skipped:', adminError.message);
            return;
        }
        if (!adminRows || adminRows.length === 0) {
            const hashedAdminPassword = await bcrypt.hash('admin', 12);
            await supabase.from('usuarios').insert({ nombre: 'admin', apellido1: '', apellido2: '', password: hashedAdminPassword, is_admin: true });
        }
        console.log('Supabase database initialized successfully');
    } catch (err) {
        console.warn('Supabase initialization could not be completed:', err.message || err);
    }
}
