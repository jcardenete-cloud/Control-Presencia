import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, getConnection, dbConfig } from './db.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// Wildcard route to serve index.html for SPA
app.get('*any', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method === 'POST' || req.method === 'PUT') {
        console.log('Body:', JSON.stringify(req.body));
    }
    next();
});

// Initialize DB
initDb().catch(err => {
    console.error("FATAL: Failed to initialize database:", err);
});

// Helper to format ISO to MySQL/MariaDB format (preserving local time)
const toMariaDbDateTime = (dateStr) => {
    if (!dateStr) return null;
    // If it's already YYYY-MM-DDTHH:mm:ss, just replace T
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
        return dateStr.replace('T', ' ').slice(0, 19);
    }
    return dateStr;
};

// Test Endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Fichajes Endpoints
app.get('/api/fichajes', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        // Return results as simple objects with formatted dates to avoid timezone shifts
        const rows = await conn.query(`
            SELECT 
                id, 
                DATE_FORMAT(date, '%Y-%m-%d') as date, 
                DATE_FORMAT(start_time, '%Y-%m-%dT%H:%i:%s') as start_time, 
                DATE_FORMAT(end_time, '%Y-%m-%dT%H:%i:%s') as end_time, 
                manual 
            FROM fichajes 
            ORDER BY date DESC, start_time ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error("GET /api/fichajes Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.post('/api/fichajes', async (req, res) => {
    const { date, start_time, end_time, manual } = req.body;
    let conn;
    try {
        conn = await getConnection();

        const formattedStart = toMariaDbDateTime(start_time);
        const formattedEnd = toMariaDbDateTime(end_time);

        console.log(`Inserting: Date=${date}, Start=${formattedStart}, End=${formattedEnd}`);

        const result = await conn.query(
            "INSERT INTO fichajes (date, start_time, end_time, manual) VALUES (?, ?, ?, ?)",
            [date, formattedStart, formattedEnd, manual || false]
        );

        res.json({ id: Number(result.insertId) });
    } catch (err) {
        console.error("POST /api/fichajes Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.put('/api/fichajes/:id', async (req, res) => {
    const { id } = req.params;
    const { start_time, end_time } = req.body;
    let conn;
    try {
        conn = await getConnection();
        const formattedStart = toMariaDbDateTime(start_time);
        const formattedEnd = toMariaDbDateTime(end_time);

        console.log(`Updating ID=${id}: Start=${formattedStart}, End=${formattedEnd}`);

        if (start_time && end_time) {
            await conn.query("UPDATE fichajes SET start_time = ?, end_time = ? WHERE id = ?", [formattedStart, formattedEnd, id]);
        } else if (start_time) {
            await conn.query("UPDATE fichajes SET start_time = ? WHERE id = ?", [formattedStart, id]);
        } else if (end_time) {
            await conn.query("UPDATE fichajes SET end_time = ? WHERE id = ?", [formattedEnd, id]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error("PUT /api/fichajes/:id Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.delete('/api/fichajes/:id', async (req, res) => {
    const { id } = req.params;
    let conn;
    try {
        conn = await getConnection();
        await conn.query("DELETE FROM fichajes WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/fichajes/:id Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// Config Endpoints
app.get('/api/config', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const rows = await conn.query("SELECT * FROM config WHERE id = 1");
        res.json(rows[0] || {});
    } catch (err) {
        console.error("GET /api/config Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.put('/api/config', async (req, res) => {
    const { hours_per_week, hours_per_week_summer, daily_hours_winter, daily_hours_summer, hours_leftover } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.query(
            "UPDATE config SET hours_per_week = ?, hours_per_week_summer = ?, daily_hours_winter = ?, daily_hours_summer = ?, hours_leftover = ? WHERE id = 1",
            [hours_per_week, hours_per_week_summer, daily_hours_winter, daily_hours_summer, hours_leftover]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("PUT /api/config Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// Weekly Leftovers Endpoints
app.get('/api/weekly_leftovers', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const rows = await conn.query("SELECT id, DATE_FORMAT(week_start, '%Y-%m-%d') as week_start, leftover FROM weekly_leftovers ORDER BY week_start DESC");
        res.json(rows);
    } catch (err) {
        console.error("GET /api/weekly_leftovers Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.post('/api/weekly_leftovers', async (req, res) => {
    const { week_start, leftover } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.query(
            "INSERT INTO weekly_leftovers (week_start, leftover) VALUES (?, ?) ON DUPLICATE KEY UPDATE leftover = ?",
            [week_start, leftover, leftover]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("POST /api/weekly_leftovers Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// Projections Endpoints
// Projection Days Endpoints
app.get('/api/projection_days', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const rows = await conn.query("SELECT DATE_FORMAT(date, '%Y-%m-%d') as date, hours FROM projection_days");
        const projectionDays = rows.reduce((acc, row) => {
            acc[row.date] = row.hours;
            return acc;
        }, {});
        res.json(projectionDays);
    } catch (err) {
        console.error("GET /api/projection_days Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.post('/api/projection_days', async (req, res) => {
    const { date, hours } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.query(
            "INSERT INTO projection_days (date, hours) VALUES (?, ?) ON DUPLICATE KEY UPDATE hours = ?",
            [date, hours, hours]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("POST /api/projection_days Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.delete('/api/projection_days', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.query("DELETE FROM projection_days");
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/projection_days Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// Planned Shifts Endpoints
app.get('/api/planned_shifts', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const rows = await conn.query("SELECT id, DATE_FORMAT(date, '%Y-%m-%d') as date, start_time, end_time FROM planned_shifts");
        res.json(rows);
    } catch (err) {
        console.error("GET /api/planned_shifts Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.post('/api/planned_shifts', async (req, res) => {
    const { date, start_time, end_time } = req.body;
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.query(
            "INSERT INTO planned_shifts (date, start_time, end_time) VALUES (?, ?, ?)",
            [date, start_time, end_time]
        );
        res.json({ id: Number(result.insertId) });
    } catch (err) {
        console.error("POST /api/planned_shifts Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.delete('/api/planned_shifts/:id', async (req, res) => {
    const { id } = req.params;
    let conn;
    try {
        conn = await getConnection();
        await conn.query("DELETE FROM planned_shifts WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/planned_shifts Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.delete('/api/planned_shifts_all', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.query("DELETE FROM planned_shifts");
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/planned_shifts_all Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// Authentication Endpoint
app.post('/api/login', async (req, res) => {
    const { nombre, password } = req.body;
    let conn;
    try {
        conn = await getConnection();
        const rows = await conn.query("SELECT * FROM usuarios WHERE nombre = ?", [nombre]);
        if (rows.length > 0) {
            const user = rows[0];
            let passwordValid = false;

            // Check if stored password is a bcrypt hash (starts with $2)
            if (user.password.startsWith('$2')) {
                passwordValid = await bcrypt.compare(password, user.password);
            } else {
                // Legacy plaintext password - validate and auto-migrate to bcrypt
                passwordValid = (password === user.password);
                if (passwordValid) {
                    const hashedPassword = await bcrypt.hash(password, 12);
                    await conn.query("UPDATE usuarios SET password = ? WHERE id = ?", [hashedPassword, user.id]);
                    console.log(`Auto-migrated password to bcrypt for user: ${user.nombre}`);
                }
            }

            if (passwordValid) {
                res.json({ success: true, user: { id: user.id, nombre: user.nombre, is_admin: user.is_admin } });
            } else {
                res.status(401).json({ error: "Credenciales inválidas" });
            }
        } else {
            res.status(401).json({ error: "Credenciales inválidas" });
        }
    } catch (err) {
        console.error("POST /api/login Error:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    } finally {
        if (conn) conn.release();
    }
});

// DB info endpoint disabled for security
app.get('/api/dbinfo', (req, res) => {
    res.status(403).json({ error: "Acceso denegado por políticas de seguridad" });
});

// User Management Endpoints
app.get('/api/usuarios', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const rows = await conn.query("SELECT id, nombre, apellido1, apellido2, is_admin FROM usuarios ORDER BY id");
        res.json(rows);
    } catch (err) {
        console.error("GET /api/usuarios Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.post('/api/usuarios', async (req, res) => {
    const { nombre, apellido1, apellido2, password, is_admin } = req.body;
    let conn;
    try {
        conn = await getConnection();
        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await conn.query(
            "INSERT INTO usuarios (nombre, apellido1, apellido2, password, is_admin) VALUES (?, ?, ?, ?, ?)",
            [nombre, apellido1, apellido2, hashedPassword, is_admin ? true : false]
        );
        res.json({ id: Number(result.insertId) });
    } catch (err) {
        console.error("POST /api/usuarios Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.put('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido1, apellido2, password, is_admin } = req.body;
    let conn;
    try {
        conn = await getConnection();
        // If password is provided, hash it and update, otherwise keep current
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 12);
            await conn.query(
                "UPDATE usuarios SET nombre = ?, apellido1 = ?, apellido2 = ?, password = ?, is_admin = ? WHERE id = ?",
                [nombre, apellido1, apellido2, hashedPassword, is_admin ? true : false, id]
            );
        } else {
            await conn.query(
                "UPDATE usuarios SET nombre = ?, apellido1 = ?, apellido2 = ?, is_admin = ? WHERE id = ?",
                [nombre, apellido1, apellido2, is_admin ? true : false, id]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error("PUT /api/usuarios/:id Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    let conn;
    try {
        conn = await getConnection();
        // Optional: prevent deleting the 'admin' user
        const userRows = await conn.query("SELECT nombre FROM usuarios WHERE id = ?", [id]);
        if (userRows.length > 0 && userRows[0].nombre === 'admin') {
            return res.status(403).json({ error: "No se puede eliminar el usuario admin" });
        }
        await conn.query("DELETE FROM usuarios WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/usuarios/:id Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running and accessible on network at port ${port}`);
});
