import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Shield, ShieldOff, Check } from 'lucide-react';
import { createUsuario, deleteUsuario, getUsuarios, updateUsuario } from './lib/supabaseApi';

export default function UserManagement({ setGlobalError }) {
    const [usuarios, setUsuarios] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        nombre: '',
        apellido1: '',
        apellido2: '',
        password: '',
        is_admin: false
    });

    const fetchUsuarios = async () => {
        try {
            const data = await getUsuarios();
            setUsuarios(data);
        } catch (err) {
            setGlobalError(err.message);
        }
    };

    useEffect(() => {
        fetchUsuarios();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await updateUsuario(editingUser.id, formData);
            } else {
                await createUsuario(formData);
            }
            setShowModal(false);
            setEditingUser(null);
            fetchUsuarios();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDelete = async (id, nombre) => {
        if (nombre === 'admin') {
            alert("No se puede eliminar el usuario admin base.");
            return;
        }
        if (!confirm(`¿Estás seguro de que quieres eliminar a ${nombre}?`)) return;
        try {
            await deleteUsuario(id);
            fetchUsuarios();
        } catch (err) {
            alert(err.message);
        }
    };

    const openCreateModal = () => {
        setFormData({ nombre: '', apellido1: '', apellido2: '', password: '', is_admin: false });
        setEditingUser(null);
        setShowModal(true);
    };

    const openEditModal = (user) => {
        setFormData({
            nombre: user.nombre,
            apellido1: user.apellido1,
            apellido2: user.apellido2 || '',
            password: '', // Blank out password so we don't display it, backend handles partial updates
            is_admin: user.is_admin === 1 || user.is_admin === true
        });
        setEditingUser(user);
        setShowModal(true);
    };

    return (
        <div className="animate-fade-in">
            <div className="glass-card" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Gestión de Usuarios
                </h3>
                <button className="btn-primary" onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} /> Nuevo Usuario
                </button>
            </div>

            <div className="glass-card">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Primer Apellido</th>
                                <th>Segundo Apellido</th>
                                <th>Rol</th>
                                <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usuarios.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        No hay usuarios registrados.
                                    </td>
                                </tr>
                            ) : (
                                usuarios.map(user => (
                                    <tr key={user.id}>
                                        <td style={{ fontWeight: 500 }}>{user.nombre}</td>
                                        <td>{user.apellido1}</td>
                                        <td>{user.apellido2 || '-'}</td>
                                        <td>
                                            {user.is_admin ? (
                                                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                                    <Shield size={12} /> Admin
                                                </span>
                                            ) : (
                                                <span className="badge" style={{ background: 'rgba(156, 163, 175, 0.2)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                                    <ShieldOff size={12} /> Usuario
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                                            <button className="btn-icon" style={{ color: 'var(--primary)' }} onClick={() => openEditModal(user)}>
                                                <Edit2 size={18} />
                                            </button>
                                            <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(user.id, user.nombre)} disabled={user.nombre === 'admin'}>
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="glass-card modal-content" style={{ maxWidth: '400px', width: '90%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h3>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                            <button onClick={() => setShowModal(false)} className="btn-icon"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="stat-label">Nombre *</label>
                                <input required type="text" name="nombre" value={formData.nombre} onChange={handleChange} className="input-field" disabled={editingUser && editingUser.nombre === 'admin'} />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="stat-label">Primer Apellido *</label>
                                <input required type="text" name="apellido1" value={formData.apellido1} onChange={handleChange} className="input-field" />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="stat-label">Segundo Apellido</label>
                                <input type="text" name="apellido2" value={formData.apellido2} onChange={handleChange} className="input-field" />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="stat-label">{editingUser ? 'Nueva Contraseña (dejar en blanco para no cambiar)' : 'Contraseña *'}</label>
                                <input type="password" name="password" required={!editingUser} value={formData.password} onChange={handleChange} className="input-field" />
                            </div>
                            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input type="checkbox" id="is_admin" name="is_admin" checked={formData.is_admin} onChange={handleChange} disabled={editingUser && editingUser.nombre === 'admin'} />
                                <label htmlFor="is_admin" style={{ cursor: 'pointer' }}>Es Administrador</label>
                            </div>
                            <button type="submit" className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                <Check size={18} /> Guardar
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
