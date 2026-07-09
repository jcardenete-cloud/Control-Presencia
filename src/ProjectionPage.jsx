import React, { useState, useEffect } from 'react';
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    Play,
    CheckCircle2,
    Clock,
    Trash2,
    History,
    ChevronDown,
    ChevronUp,
    Plus,
    X as CloseIcon,
    Copy
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    msToTime,
    getWeekDays,
    calculateDayTotal,
    getDailyGoalForDate,
    hhmmToDecimal,
    decimalToHHMM
} from './utils';

const ProjectionPage = ({ fichajes, config, currentTime = new Date(), weeklyLeftovers = [] }) => {
    const [selectedWeek, setSelectedWeek] = useState(new Date());
    const [projections, setProjections] = useState({}); // Total hours per day: { 'yyyy-MM-dd': 'HH:mm' }
    const [plannedShifts, setPlannedShifts] = useState([]); // Array of { id, date, start_time, end_time }
    const [expandedDays, setExpandedDays] = useState({});
    const [loading, setLoading] = useState(true);

    const [newShift, setNewShift] = useState({ date: '', start: '08:00', end: '15:00' });

    const API_URL = '/api';

    // Load data from MariaDB
    useEffect(() => {
        const loadData = async () => {
            try {
                const [projRes, shiftsRes] = await Promise.all([
                    fetch(`${API_URL}/projection_days`),
                    fetch(`${API_URL}/planned_shifts`)
                ]);

                if (projRes.ok && shiftsRes.ok) {
                    const projData = await projRes.json();
                    const shiftsData = await shiftsRes.json();
                    setProjections(projData);
                    setPlannedShifts(shiftsData);
                }
            } catch (e) {
                console.error("Error loading data from DB", e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [API_URL]);

    const handleProjectionChange = async (dateStr, value) => {
        const newProjections = { ...projections, [dateStr]: value };
        setProjections(newProjections);

        try {
            await fetch(`${API_URL}/projection_days`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: dateStr, hours: value })
            });
        } catch (e) {
            console.error("Error saving projection day to DB", e);
        }
    };

    const addPlannedShift = async (e) => {
        if (e) e.preventDefault();
        if (!newShift.date) return;

        try {
            const res = await fetch(`${API_URL}/planned_shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: newShift.date,
                    start_time: newShift.start,
                    end_time: newShift.end
                })
            });
            if (res.ok) {
                const { id } = await res.json();
                const shiftToAdd = {
                    id,
                    date: newShift.date,
                    start_time: newShift.start,
                    end_time: newShift.end
                };
                setPlannedShifts([...plannedShifts, shiftToAdd]);
                // Automatically expand the day to show the new shift
                setExpandedDays(prev => ({ ...prev, [newShift.date]: true }));
            }
        } catch (e) {
            console.error("Error adding shift", e);
        }
    };

    const deletePlannedShift = async (id) => {
        try {
            const res = await fetch(`${API_URL}/planned_shifts/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setPlannedShifts(plannedShifts.filter(s => s.id !== id));
            }
        } catch (e) {
            console.error("Error deleting shift", e);
        }
    };

    const toggleExpand = (dateStr) => {
        setExpandedDays(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
    };

    const clearAll = async () => {
        if (!confirm('¿Borrar todas las proyecciones y turnos previstos?')) return;

        setProjections({});
        setPlannedShifts([]);
        try {
            await Promise.all([
                fetch(`${API_URL}/projection_days`, { method: 'DELETE' }),
                fetch(`${API_URL}/planned_shifts_all`, { method: 'DELETE' })
            ]);
        } catch (e) {
            console.error("Error clearing data", e);
        }
    };

    const copyPreviousWeekShifts = async () => {
        const prevWeek = addDays(selectedWeek, -7);
        const prevWeekDays = getWeekDays(prevWeek);
        const prevWeekDates = prevWeekDays.map(d => format(d, 'yyyy-MM-dd'));

        const shiftsToCopy = plannedShifts.filter(s => prevWeekDates.includes(s.date));

        if (shiftsToCopy.length === 0) {
            alert("No hay turnos planificados en la semana anterior.");
            return;
        }

        if (!confirm(`¿Copiar ${shiftsToCopy.length} turnos de la semana anterior a la actual?`)) return;

        const currentWeekDays = getWeekDays(selectedWeek);

        try {
            const promises = shiftsToCopy.map(shift => {
                // Find day of week (0-6)
                const dayIndex = new Date(shift.date).getDay();
                // Map to corresponding day in current week
                const targetDay = currentWeekDays.find(d => d.getDay() === dayIndex);
                const targetDateStr = format(targetDay, 'yyyy-MM-dd');

                return fetch(`${API_URL}/planned_shifts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: targetDateStr,
                        start_time: shift.start_time,
                        end_time: shift.end_time
                    })
                });
            });

            await Promise.all(promises);

            // Reload shifts
            const res = await fetch(`${API_URL}/planned_shifts`);
            if (res.ok) {
                const data = await res.json();
                setPlannedShifts(data);
                alert("Turnos copiados correctamente.");
            }
        } catch (e) {
            console.error("Error copying shifts", e);
            alert("Error al copiar los turnos.");
        }
    };

    const weekDays = getWeekDays(selectedWeek);
    const weekRangeLabel = `${format(weekDays[0], "d 'de' MMMM", { locale: es })} - ${format(weekDays[4], "d 'de' MMMM", { locale: es })}`;

    // Helper: get leftover for a specific week (by its Monday date string)
    const getLeftoverForWeek = (mondayStr) => {
        const entry = weeklyLeftovers.find(w => w.week_start === mondayStr);
        return entry ? parseFloat(entry.leftover) : 0;
    };

    const prevWeekMonday = format(addDays(weekDays[0], -7), 'yyyy-MM-dd');
    const prevWeekLeftover = getLeftoverForWeek(prevWeekMonday);

    let totalActual = 0;
    let totalProjected = 0;
    let totalGoal = 0;

    const weekData = weekDays.map(day => {
        const dStr = format(day, 'yyyy-MM-dd');

        // Actual real fichajes
        const dayFichajes = fichajes
            .filter(f => {
                const fDate = typeof f.date === 'string' ? f.date.split('T')[0] : format(new Date(f.date), 'yyyy-MM-dd');
                return fDate === dStr;
            })
            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        const actual = calculateDayTotal(dStr, fichajes, currentTime);
        const goal = (day.getDay() === 0 || day.getDay() === 6) ? 0 : getDailyGoalForDate(day, config);

        // Planned shifts for this day
        const dayPlannedShifts = plannedShifts
            .filter(s => s.date === dStr)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));

        // Calculate total hours from planned shifts if any
        let plannedShiftsMs = 0;
        let previousEndDec = null;
        let breakfastAdded = false;

        dayPlannedShifts.forEach((s, index) => {
            let startDec = hhmmToDecimal(s.start_time);
            let endDec = hhmmToDecimal(s.end_time);

            // Ajustar con fichajes reales si el turno ha comenzado o terminado
            if (dayFichajes[index]) {
                const realStart = dayFichajes[index].start_time;
                const realEnd = dayFichajes[index].end_time;

                if (realStart) {
                    const dStart = new Date(realStart);
                    startDec = dStart.getHours() + (dStart.getMinutes() / 60);
                }
                if (realEnd) {
                    const dEnd = new Date(realEnd);
                    endDec = dEnd.getHours() + (dEnd.getMinutes() / 60);
                }
            }

            // Sumar 15 min de desayuno si hay una salida y entrada entre las 9:00 y las 13:00
            if (previousEndDec !== null && !breakfastAdded) {
                if (previousEndDec >= 9 && previousEndDec <= 13 && startDec >= 9 && startDec <= 13) {
                    if (startDec >= previousEndDec) {
                        plannedShiftsMs += 15 * 60 * 1000; // 15 minutos en ms
                        breakfastAdded = true;
                    }
                }
            }

            let diff = endDec - startDec;
            if (diff < 0) diff += 24; // Handle overnight if needed
            plannedShiftsMs += diff * 3600 * 1000;

            previousEndDec = endDec;
        });

        // Use planned shifts total if > 0, otherwise use manual projection input
        const projectionStr = dayPlannedShifts.length > 0
            ? msToTime(plannedShiftsMs)
            : (projections[dStr] || "00:00");

        const projectedMs = dayPlannedShifts.length > 0
            ? plannedShiftsMs
            : (hhmmToDecimal(projectionStr) * 3600 * 1000);

        const isTodayOngoing = dStr === format(new Date(), 'yyyy-MM-dd') && dayFichajes.some(f => !f.end_time);

        totalActual += actual;
        totalProjected += ((actual > 0 && !isTodayOngoing) ? actual : Math.max(actual, projectedMs));
        totalGoal += goal;

        return {
            date: day,
            dateStr: dStr,
            actual,
            goal,
            projectionStr,
            projectedMs,
            dayFichajes,
            dayPlannedShifts,
            isTodayOngoing
        };
    });

    const totalDiff = totalProjected - totalGoal;
    const carryoverMs = prevWeekLeftover * 3600 * 1000;
    const finalBalance = totalDiff + carryoverMs;

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>Cargando planificación...</div>;
    }

    return (
        <div className="animate-fade-in">
            {/* Header / Week Selection */}
            <div className="glass-card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Play size={20} className="text-summer" /> Planificación Semanal
                        </h3>
                        <p className="subtitle" style={{ margin: 0 }}>Crea turnos previstos para calcular tu saldo</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button className="btn-icon" onClick={() => setSelectedWeek(addDays(selectedWeek, -7))}>
                            <ChevronLeft size={20} />
                        </button>
                        <input
                            type="date"
                            className="input-field"
                            style={{ width: 'auto', marginTop: 0 }}
                            value={format(selectedWeek, 'yyyy-MM-dd')}
                            onChange={(e) => setSelectedWeek(new Date(e.target.value))}
                        />
                        <button className="btn-icon" onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}>
                            <ChevronRight size={20} />
                        </button>
                        <button className="btn-icon" onClick={copyPreviousWeekShifts} title="Copiar turnos de la semana anterior" style={{ color: 'var(--primary)' }}>
                            <Copy size={18} />
                        </button>
                        <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={clearAll} title="Limpiar todo">
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Shift Creator */}
            <div className="glass-card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Añadir Turno Previsto
                </h4>
                <form onSubmit={addPlannedShift} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1', minWidth: '150px' }}>
                        <label className="stat-label">Día</label>
                        <select
                            className="input-field"
                            style={{
                                marginTop: '0.4rem',
                                backgroundColor: 'var(--bg-main)',
                                color: 'var(--text-main)'
                            }}
                            value={newShift.date}
                            onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
                            required
                        >
                            <option value="" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}>Selecciona un día...</option>
                            {weekDays.map(d => (
                                <option
                                    key={format(d, 'yyyy-MM-dd')}
                                    value={format(d, 'yyyy-MM-dd')}
                                    style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                                >
                                    {format(d, 'EEEE d (MMM)', { locale: es })}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{ width: '120px' }}>
                        <label className="stat-label">Inicio</label>
                        <input
                            type="time"
                            className="input-field"
                            style={{ marginTop: '0.4rem' }}
                            value={newShift.start}
                            onChange={(e) => setNewShift({ ...newShift, start: e.target.value })}
                        />
                    </div>
                    <div style={{ width: '120px' }}>
                        <label className="stat-label">Fin</label>
                        <input
                            type="time"
                            className="input-field"
                            style={{ marginTop: '0.4rem' }}
                            value={newShift.end}
                            onChange={(e) => setNewShift({ ...newShift, end: e.target.value })}
                        />
                    </div>
                    <button type="submit" className="btn-primary" style={{ height: '45px', padding: '0 1.5rem' }}>
                        <Plus size={18} /> Añadir Turno
                    </button>
                </form>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start' }}>
                {/* Daily List */}
                <div className="glass-card" style={{ flex: '1.6 1 500px' }}>
                    <h4 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={18} /> Planning Semanal
                    </h4>
                    <div className="table-container" style={{ marginTop: 0 }}>
                        <table style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}></th>
                                    <th>Día</th>
                                    <th>Realizado</th>
                                    <th>Previsto</th>
                                    <th>Meta</th>
                                </tr>
                            </thead>
                            <tbody>
                                {weekData.map((day) => (
                                    <React.Fragment key={day.dateStr}>
                                        <tr style={{ background: 'var(--glass-bg)' }}>
                                            <td>
                                                {(day.dayFichajes.length > 0 || day.dayPlannedShifts.length > 0) && (
                                                    <button onClick={() => toggleExpand(day.dateStr)} className="btn-icon" style={{ padding: '2px', background: 'none' }}>
                                                        {expandedDays[day.dateStr] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </button>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ color: day.dateStr === format(new Date(), 'yyyy-MM-dd') ? 'var(--primary)' : 'inherit' }}>
                                                        {format(day.date, 'EEEE', { locale: es }).toUpperCase()}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{format(day.date, 'dd/MM')}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{
                                                    color: day.actual > 0 ? 'var(--success)' : 'var(--text-muted)',
                                                    fontWeight: day.actual > 0 ? 700 : 400
                                                }}>
                                                    {day.actual > 0 ? msToTime(day.actual) : '--:--'}
                                                </span>
                                            </td>
                                            <td>
                                                {(day.actual > 0 && !day.isTodayOngoing) ? (
                                                    <div style={{ opacity: 0.5, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        <CheckCircle2 size={14} color="var(--success)" />
                                                        Hecho
                                                    </div>
                                                ) : (
                                                    day.dayPlannedShifts.length > 0 ? (
                                                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{day.projectionStr}</span>
                                                    ) : (
                                                        <input
                                                            type="time"
                                                            className="input-field"
                                                            style={{ margin: 0, padding: '4px 12px', width: '110px', fontSize: '0.9rem' }}
                                                            value={day.projectionStr}
                                                            onChange={(e) => handleProjectionChange(day.dateStr, e.target.value)}
                                                        />
                                                    )
                                                )}
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                {day.goal > 0 ? msToTime(day.goal) : 'Off'}
                                            </td>
                                        </tr>
                                        {expandedDays[day.dateStr] && (day.dayFichajes.length > 0 || day.dayPlannedShifts.length > 0) && (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '0 0 10px 40px', border: 'none' }}>
                                                    <div style={{
                                                        background: 'var(--glass-bg)',
                                                        borderRadius: '0 0 12px 12px',
                                                        padding: '12px',
                                                        borderLeft: '2px solid var(--primary)',
                                                        fontSize: '0.85rem'
                                                    }}>
                                                        {/* Real Shifts Section */}
                                                        {day.dayFichajes.length > 0 && (
                                                            <div style={{ marginBottom: '1rem' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', opacity: 0.6 }}>
                                                                    <History size={14} /> Fichajes Reales
                                                                </div>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                                    {day.dayFichajes.map((f, idx) => (
                                                                        <div key={idx} style={{ background: 'var(--success-bg)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                                                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>{format(new Date(f.start_time), 'HH:mm')}</span>
                                                                            <span style={{ opacity: 0.3, margin: '0 4px' }}>→</span>
                                                                            <span>{f.end_time ? format(new Date(f.end_time), 'HH:mm') : '...'}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Planned Shifts Section */}
                                                        {day.dayPlannedShifts.length > 0 && (
                                                            <div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', opacity: 0.6 }}>
                                                                    <Clock size={14} /> Turnos Previstos
                                                                </div>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                                    {day.dayPlannedShifts.map((s) => (
                                                                        <div key={s.id} style={{
                                                                            background: 'var(--primary-bg)',
                                                                            padding: '4px 8px',
                                                                            borderRadius: '8px',
                                                                            border: '1px solid var(--glass-border)',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '6px'
                                                                        }}>
                                                                            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{s.start_time}</span>
                                                                            <span style={{ opacity: 0.3 }}>→</span>
                                                                            <span style={{ fontWeight: 600 }}>{s.end_time}</span>
                                                                            <button
                                                                                onClick={() => deletePlannedShift(s.id)}
                                                                                style={{ background: 'none', marginLeft: '4px', opacity: 0.5, color: 'var(--danger)', display: 'flex' }}
                                                                            >
                                                                                <CloseIcon size={12} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Summary View */}
                <div className="glass-card" style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={18} /> Resumen de Proyección
                    </h4>

                    <div style={{ background: 'var(--glass-bg)', padding: '1.2rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                            <span className="stat-label">Realizado real</span>
                            <span style={{ fontWeight: 600 }}>{msToTime(totalActual)} / {msToTime(totalGoal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                            <span className="stat-label">Planificado extra</span>
                            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                +{msToTime(totalProjected - totalActual)}
                            </span>
                        </div>
                        <div style={{ width: '100%', height: '1px', background: 'var(--glass-border)', margin: '1rem 0' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="stat-label" style={{ color: 'var(--text-main)' }}>Total Proyectado</span>
                            <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>{msToTime(totalProjected)}</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{ background: 'var(--primary-bg)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                            <div className="stat-label">Semana</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: totalDiff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {totalDiff > 0 ? '+' : ''}{msToTime(totalDiff)}
                            </div>
                        </div>
                        <div style={{ background: 'var(--glass-bg)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                            <div className="stat-label">Sobrante Sem. Ant.</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{decimalToHHMM(prevWeekLeftover)}h</div>
                        </div>
                    </div>

                    <div style={{
                        background: finalBalance >= 0 ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.05))' : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))',
                        padding: '1.5rem',
                        borderRadius: '20px',
                        textAlign: 'center',
                        border: finalBalance >= 0 ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
                        <div className="stat-label" style={{ color: 'var(--text-main)', opacity: 0.8, marginBottom: '0.5rem' }}>SALDO FINAL ESTIMADO</div>
                        <div style={{
                            fontSize: '2.5rem',
                            fontWeight: 800,
                            color: finalBalance >= 0 ? 'var(--success)' : 'var(--danger)',
                            textShadow: '0 0 20px rgba(0,0,0,0.1)'
                        }}>
                            {finalBalance > 0 ? '+' : ''}{msToTime(finalBalance)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectionPage;
