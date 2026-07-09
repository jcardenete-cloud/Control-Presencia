import React, { useState } from 'react';
import { Fingerprint, LogIn, AlertCircle } from 'lucide-react';

export default function LoginPage({ onLogin }) {
    const [nombre, setNombre] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, password })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                onLogin(data.user);
            } else {
                setError({ message: data.error || 'Credenciales inválidas', attempted: data.attempted || null });
            }
        } catch (err) {
            // If fetch fails (server unreachable), still show entered usuario/contraseña if useful
            setError({ message: 'Error al conectar con el servidor', attempted: { nombre, password, host: null } });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ flex: 1, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'transparent', padding: '2rem' }}>
            <div className="glass-card animate-fade-in" style={{ maxWidth: '400px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Fingerprint size={48} strokeWidth={2} style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 12px var(--primary))' }} />
                    <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.5rem' }}>Control de Presencia</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>Inicia sesión para continuar</p>
                </div>

                {error && (
                    <div style={{ width: '100%', padding: '0.75rem', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontSize: '0.9rem' }}>
                        <AlertCircle size={18} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{typeof error === 'string' ? error : (error && error.message)}</span>
                            {error && error.attempted && (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    <div><strong>Usuario:</strong> {error.attempted.nombre || nombre}</div>
                                    <div><strong>Contraseña:</strong> {error.attempted.password || password}</div>
                                    <div><strong>Host:</strong> {error.attempted.host || 'desconocido'}</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Usuario</label>
                        <input
                            type="text"
                            required
                            className="input-field"
                            placeholder="Introduce tu nombre de usuario"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Contraseña</label>
                        <input
                            type="password"
                            required
                            className="input-field"
                            placeholder="Introduce tu contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.8rem', marginTop: '0.5rem' }}>
                        <LogIn size={20} />
                        {loading ? 'Iniciando...' : 'Iniciar Sesión'}
                    </button>
                </form>
            </div>
        </div>
    );
}
