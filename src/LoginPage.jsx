import React, { useState } from 'react';
import { Fingerprint, LogIn, AlertCircle } from 'lucide-react';
import { loginUser } from './lib/supabaseApi';

export default function LoginPage({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const data = await loginUser(email, password);
            if (data.success) {
                onLogin(data.user);
            } else {
                setError(data.error || 'Credenciales inválidas');
            }
        } catch (err) {
            setError(err.message || 'Error al conectar con Supabase');
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
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Email</label>
                        <input
                            type="email"
                            required
                            className="input-field"
                            placeholder="Introduce tu email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
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
