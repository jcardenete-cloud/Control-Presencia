import React, { useState, useEffect } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  History,
  Calendar,
  Settings,
  Sun,
  Moon,
  Trash2,
  AlertCircle,
  X,
  Save,
  Download,
  Fingerprint,
  Edit2,
  Plus,
  User,
  Users,
  ExternalLink,
  Palette
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, differenceInMilliseconds, addDays, subDays, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import ProjectionPage from './ProjectionPage';
import LoginPage from './LoginPage';
import {
  msToTime,
  decimalToHHMM,
  hhmmToDecimal,
  getWeekDays,
  calculateDayTotal,
  getDailyGoalForDate,
  isSummerDate
} from './utils';
import {
  createFichaje,
  deleteFichaje,
  getConfig,
  getFichajes,
  getWeeklyLeftovers,
  saveConfig,
  saveWeeklyLeftover,
  updateFichaje,
  logoutUser,
  supabase
} from './lib/supabaseApi';

// Isolated clock component — updates every 1s without re-rendering the entire App
function LiveClock({ activeFichaje }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
      <div style={{
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        background: 'var(--glass-bg)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        border: activeFichaje ? '3px solid var(--success)' : '3px solid var(--primary)',
        transition: 'var(--transition)'
      }}>
        <Clock size={32} color={activeFichaje ? '#22c55e' : '#6366f1'} />
        <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '0.5rem' }}>
          {format(time, 'HH:mm')}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [loggedInUser, setLoggedInUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [fichajes, setFichajes] = useState([]);
  const [config, setConfig] = useState({
    hours_per_week: 38.5,
    hours_per_week_summer: 35.0,
    daily_hours_winter: 7.7,
    daily_hours_summer: 7.0,
    hours_leftover: 0
  });
  const [weeklyLeftovers, setWeeklyLeftovers] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [activeTab, setActiveTab] = useState('today'); // 'today', 'weekly', 'projection'
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date());
  const [manualTime, setManualTime] = useState(format(new Date(), 'HH:mm'));
  const [manualDate, setManualDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [activeFichaje, setActiveFichaje] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState('outlook');
  const [editingFichaje, setEditingFichaje] = useState(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [selectedDateForTodayTab, setSelectedDateForTodayTab] = useState(new Date());
  const [isForcingNewEntry, setIsForcingNewEntry] = useState(false);
  const [showCloseWeekModal, setShowCloseWeekModal] = useState(false);
  const [closeWeekDate, setCloseWeekDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Apply theme to body
  useEffect(() => {
    // Remove all theme classes first
    document.body.classList.remove('theme-solarized', 'theme-onenote', 'theme-outlook');

    // Add current theme class if not dark
    if (theme === 'solarized') document.body.classList.add('theme-solarized');
    if (theme === 'onenote') document.body.classList.add('theme-onenote');
    if (theme === 'outlook') document.body.classList.add('theme-outlook');

    localStorage.setItem('theme', theme);
  }, [theme]);

  // handleLogout function to clean Supabase session and state
  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
    setLoggedInUser(null);
  };

  // Sync Supabase Auth session with loggedInUser
  useEffect(() => {
    if (!supabase) return;

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setLoggedInUser({
          id: session.user.id,
          nombre: session.user.email,
          is_admin: true
        });
      } else {
        setLoggedInUser(null);
      }
    });

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setLoggedInUser({
          id: session.user.id,
          nombre: session.user.email,
          is_admin: true
        });
      } else {
        setLoggedInUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Persist loggedInUser state
  useEffect(() => {
    if (loggedInUser) {
      localStorage.setItem('user', JSON.stringify(loggedInUser));
    } else {
      localStorage.removeItem('user');
      setActiveTab('today');
    }
  }, [loggedInUser]);

  // Inactivity timeout of 60 minutes
  useEffect(() => {
    if (!loggedInUser) return;

    let timeoutId;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
      }, 60 * 60 * 1000); // 60 minutes
    };

    // Listen to user interaction events to reset the timer
    const events = ['mousemove', 'mousedown', 'keypress', 'touchmove', 'scroll', 'click'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer(); // Initial call to start the timer

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [loggedInUser]);

  // Data Fetching
  const fetchData = async () => {
    try {
      setError(null);
      const [fichajesData, configData, weeklyLeftoversData] = await Promise.all([
        getFichajes(),
        getConfig(),
        getWeeklyLeftovers()
      ]);

      setFichajes(Array.isArray(fichajesData) ? fichajesData : []);
      setWeeklyLeftovers(Array.isArray(weeklyLeftoversData) ? weeklyLeftoversData : []);

      const defaultConfig = {
        hours_per_week: 38.5,
        hours_per_week_summer: 35.0,
        daily_hours_winter: 7.7,
        daily_hours_summer: 7.0,
        hours_leftover: 0
      };
      const mergedConfig = { ...defaultConfig, ...configData };
      setConfig(mergedConfig);

      const active = Array.isArray(fichajesData) ? fichajesData.find(f => !f.end_time) : null;
      setActiveFichaje(active);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('No se pudo conectar con Supabase. Revisa las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
    }
  };

  useEffect(() => {
    if (loggedInUser) {
      fetchData();
    }
  }, [loggedInUser]);

  useEffect(() => {
    // Update calculation time every 30s (display clock is handled by LiveClock component)
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const handleAction = async (isExit = false) => {
    const [h, m] = manualTime.split(':');
    const selectedDate = new Date(manualDate);
    selectedDate.setHours(parseInt(h), parseInt(m), 0, 0);

    const localIsoString = format(selectedDate, "yyyy-MM-dd'T'HH:mm:ss");
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    if (isExit && activeFichaje) {
      try {
        await updateFichaje(activeFichaje.id, { end_time: localIsoString });
        await fetchData();
        setShowManualEntry(false);
      } catch (err) {
        setError('Error al finalizar fichaje: ' + err.message);
      }
    } else if (!isExit) {
      try {
        await createFichaje({
          date: dateStr,
          start_time: localIsoString,
          end_time: null,
          manual: true
        });
        await fetchData();
        setShowManualEntry(false);
      } catch (err) {
        setError('Error al registrar entrada: ' + err.message);
      }
    }
  };


  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este registro?')) return;
    try {
      await deleteFichaje(id);
      await fetchData();
    } catch (err) {
      console.error('Error deleting fichaje:', err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingFichaje) return;

    try {
      // Reconstruct full ISO string from existing date and new HH:mm
      const datePart = editingFichaje.date;
      const startDateTime = `${datePart}T${editStartTime}:00`;
      const endDateTime = editEndTime ? `${datePart}T${editEndTime}:00` : null;

      await updateFichaje(editingFichaje.id, {
        start_time: startDateTime,
        end_time: endDateTime
      });

      await fetchData();
      setEditingFichaje(null);
    } catch (err) {
      setError("Error al editar: " + err.message);
    }
  };

  const updateConfig = async (newConfig) => {
    try {
      await saveConfig(newConfig);
      await fetchData();
      setShowSettings(false);
      alert('Configuración guardada correctamente');
    } catch (err) {
      setError('No se pudo guardar la configuración: ' + err.message);
    }
  };

  const todayDate = new Date();
  const todayStr = format(todayDate, 'yyyy-MM-dd');
  const currentDayTotal = calculateDayTotal(todayStr, fichajes, currentTime);
  const dailyGoal = getDailyGoalForDate(todayDate, config);
  const isSummerMode = isSummerDate(todayDate);

  // Helper: get leftover for a specific week (by its Monday date string)
  const getLeftoverForWeek = (mondayStr) => {
    const entry = weeklyLeftovers.find(w => w.week_start === mondayStr);
    return entry ? parseFloat(entry.leftover) : 0;
  };

  const daysOfThisWeek = getWeekDays(new Date());
  const thisWeekMonday = format(daysOfThisWeek[0], 'yyyy-MM-dd');
  // Previous week's Monday
  const prevWeekMonday = format(subDays(daysOfThisWeek[0], 7), 'yyyy-MM-dd');
  const prevWeekLeftover = getLeftoverForWeek(prevWeekMonday);
  const prevWeekLeftoverMs = prevWeekLeftover * 3600 * 1000;

  let weekTotalSoFar = 0;
  let previousDaysBalanceThisWeek = 0;

  daysOfThisWeek.forEach(d => {
    const dStr = format(d, 'yyyy-MM-dd');
    const dayTotal = calculateDayTotal(dStr, fichajes, currentTime);
    weekTotalSoFar += dayTotal;

    if (dStr < todayStr && dStr >= format(daysOfThisWeek[0], 'yyyy-MM-dd')) {
      if (dayTotal > 0 || [1, 2, 3, 4, 5].includes(d.getDay())) {
        const goalForThatDay = getDailyGoalForDate(d, config);
        previousDaysBalanceThisWeek += (dayTotal - goalForThatDay);
      }
    }
  });

  const totalCarryover = prevWeekLeftoverMs + previousDaysBalanceThisWeek;
  const cumulativeBalance = (dailyGoal - totalCarryover) - currentDayTotal;

  // Function to close a specific week: calculate balance, clamp, and save per-week
  const closeWeek = async (targetDate) => {
    const targetWeekDays = getWeekDays(new Date(targetDate));
    const weekMondayStr = format(targetWeekDays[0], 'yyyy-MM-dd');
    const prevWeekMondayStr = format(subDays(targetWeekDays[0], 7), 'yyyy-MM-dd');
    const prevLeftover = getLeftoverForWeek(prevWeekMondayStr);
    const prevLeftoverMs = prevLeftover * 3600 * 1000;

    let weekTotal = 0;
    let weekGoal = 0;
    targetWeekDays.forEach(d => {
      const dStr = format(d, 'yyyy-MM-dd');
      const dayTotal = calculateDayTotal(dStr, fichajes, currentTime);
      weekTotal += dayTotal;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (!isWeekend) {
        weekGoal += getDailyGoalForDate(d, config);
      }
    });

    // Balance = realizado - meta + sobrante semana anterior
    const weekBalanceMs = weekTotal - weekGoal + prevLeftoverMs;
    let weekBalanceHours = weekBalanceMs / (3600 * 1000);

    const isSummerWeek = isSummerDate(targetWeekDays[2]);
    const maxHours = isSummerWeek ? 2 : 5;

    // Clamping: <1h → 0, >maxHours → maxHours
    if (weekBalanceHours < 1 && weekBalanceHours >= 0) {
      weekBalanceHours = 0;
    } else if (weekBalanceHours > maxHours) {
      weekBalanceHours = maxHours;
    } else if (weekBalanceHours < 0 && weekBalanceHours > -1) {
      weekBalanceHours = 0;
    }

    const roundedHours = Math.round(weekBalanceHours * 100) / 100;

    if (!confirm(
      `¿Cerrar la semana del ${format(targetWeekDays[0], 'dd/MM/yyyy')}?\n\n` +
      `Realizado: ${msToTime(weekTotal)}\n` +
      `Meta: ${msToTime(weekGoal)}\n` +
      `Sobrante sem. anterior: ${decimalToHHMM(prevLeftover)}h\n` +
      `Balance bruto: ${(weekBalanceMs / (3600 * 1000)).toFixed(2)}h\n\n` +
      `Sobrante guardado para esta semana (con ajuste): ${roundedHours.toFixed(2)}h\n` +
      `(< 1h → 0h, > ${maxHours}h → ${maxHours}h)`
    )) return;

    try {
      await saveWeeklyLeftover({ week_start: weekMondayStr, leftover: roundedHours });

      // Also update global accumulator for reference
      const rawBalance = (weekBalanceMs / (3600 * 1000));
      const newConfig = {
        ...config,
        hours_leftover: Math.round((config.hours_leftover + rawBalance) * 100) / 100
      };
      await updateConfig(newConfig);

      await fetchData();
      setShowCloseWeekModal(false);
      alert('Semana cerrada correctamente.');
    } catch (err) {
      setError('Error al cerrar la semana: ' + err.message);
    }
  };

  const selectedDateTodayStr = format(selectedDateForTodayTab, 'yyyy-MM-dd');
  const todayFichajes = fichajes
    .filter(f => {
      const fDate = typeof f.date === 'string' ? f.date.split('T')[0] : format(new Date(f.date), 'yyyy-MM-dd');
      return fDate === selectedDateTodayStr;
    })
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const weeklyHistoryDays = getWeekDays(selectedWeekDate);
  const weekRangeLabel = `${format(weeklyHistoryDays[0], "d 'de' MMMM", { locale: es })} - ${format(weeklyHistoryDays[4], "d 'de' MMMM", { locale: es })}`;

  const weeklyHistoryTotal = weeklyHistoryDays.reduce((acc, d) => acc + calculateDayTotal(format(d, "yyyy-MM-dd"), fichajes, currentTime), 0);
  const weeklyHistoryGoal = weeklyHistoryDays.reduce((acc, d) => {
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    return acc + (isWeekend ? 0 : getDailyGoalForDate(d, config));
  }, 0);
  const weeklyHistoryDiff = weeklyHistoryTotal - weeklyHistoryGoal;

  const exportToExcel = () => {
    const data = weeklyHistoryDays.map(day => {
      const dStr = format(day, "yyyy-MM-dd");
      const total = calculateDayTotal(dStr, fichajes, currentTime);
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      const goalForDay = getDailyGoalForDate(day, config);
      const dayBalance = total > 0 || !isWeekend ? total - goalForDay : 0;

      const dayFichajes = fichajes
        .filter(f => {
          const fDate = typeof f.date === 'string' ? f.date.split('T')[0] : format(new Date(f.date), 'yyyy-MM-dd');
          return fDate === dStr;
        })
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

      const shiftsStr = dayFichajes.map(f =>
        `${format(new Date(f.start_time), 'HH:mm')} - ${f.end_time ? format(new Date(f.end_time), 'HH:mm') : '...'}`
      ).join(', ');

      return {
        'Día': format(day, 'EEEE', { locale: es }).toUpperCase(),
        'Fecha': format(day, 'dd/MM/yyyy'),
        'Fichajes': shiftsStr,
        'Total (Horas)': total > 0 ? (total / (3600 * 1000)).toFixed(2) : '0.00',
        'Total (HH:mm)': total > 0 ? msToTime(total) : '--:--',
        'Balance (Horas)': (dayBalance / (3600 * 1000)).toFixed(2),
        'Balance (HH:mm)': (dayBalance !== 0 ? (dayBalance > 0 ? '+' : '') + msToTime(dayBalance) : '00:00'),
        'Estado': total >= goalForDay ? 'Hecho' : (total > 0 ? 'Parcial' : (isWeekend ? 'Off' : 'Pendiente'))
      };
    });

    // Add totals row
    data.push({
      'Día': 'TOTAL SEMANA',
      'Fecha': '',
      'Fichajes': '',
      'Total (Horas)': (weeklyHistoryTotal / (3600 * 1000)).toFixed(2),
      'Total (HH:mm)': msToTime(weeklyHistoryTotal),
      'Balance (Horas)': (weeklyHistoryDiff / (3600 * 1000)).toFixed(2),
      'Balance (HH:mm)': (weeklyHistoryDiff !== 0 ? (weeklyHistoryDiff > 0 ? '+' : '') + msToTime(weeklyHistoryDiff) : '00:00'),
      'Estado': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Semana");

    // Adjust column widths
    const wscols = [
      { wch: 15 }, // Día
      { wch: 12 }, // Fecha
      { wch: 30 }, // Fichajes
      { wch: 12 }, // Total (H)
      { wch: 12 }, // Total (HH:mm)
      { wch: 15 }, // Balance (H)
      { wch: 15 }, // Balance (HH:mm)
      { wch: 12 }  // Estado
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `Horario_${format(weeklyHistoryDays[0], 'yyyyMMdd')}_${format(weeklyHistoryDays[6], 'yyyyMMdd')}.xlsx`);
  };

  if (!loggedInUser) {
    return <LoginPage onLogin={setLoggedInUser} />;
  }

  return (
    <>
      <nav className="sidebar">
        <div className="sidebar-header">
          <Fingerprint size={32} strokeWidth={2.5} style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 8px var(--primary))' }} />
          <span className="sidebar-logo-text">Control de Presencia</span>
        </div>

        <div className="sidebar-nav">
          <button
            className={`sidebar-item ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveTab('today')}
          >
            <Clock size={20} />
            <span>Fichajes de hoy</span>
          </button>
          <button
            className={`sidebar-item ${activeTab === 'projection' ? 'active' : ''}`}
            onClick={() => setActiveTab('projection')}
          >
            <History size={20} />
            <span>Proyección</span>
          </button>
          <button
            className={`sidebar-item ${activeTab === 'weekly' ? 'active' : ''}`}
            onClick={() => setActiveTab('weekly')}
          >
            <Calendar size={20} />
            <span>Historial Semanal</span>
          </button>
          <button
            className={`sidebar-item ${activeTab === 'tragsanet' ? 'active' : ''}`}
            onClick={() => setActiveTab('tragsanet')}
          >
            <User size={20} />
            <span>Mis Datos Tragsanet</span>
          </button>

        </div>

        <div className="sidebar-footer">

          <button className="sidebar-action-btn" onClick={() => setShowSettings(true)}>
            <Settings size={18} />
            <span>Configuración</span>
          </button>
          <button className="sidebar-action-btn" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </nav>

      <main className="main-content animate-fade-in" style={{ paddingBottom: '5rem' }}>
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem' }}>
              {activeTab === 'today' && 'Panel de Hoy'}
              {activeTab === 'projection' && 'Proyección de Jornada'}
              {activeTab === 'weekly' && 'Historial de Trabajo'}
              {activeTab === 'tragsanet' && 'Datos Tragsanet'}
              {activeTab === 'users' && 'Administración'}
            </h1>
            <p className="subtitle" style={{ margin: 0 }}>
              {activeTab === 'today' && `Bienvenido ${loggedInUser?.nombre || ''}, hoy es ${format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}`}
              {activeTab === 'projection' && 'Analiza tu progreso y estima el fin de tu jornada'}
              {activeTab === 'weekly' && 'Revisa tus registros de las últimas semanas'}
              {activeTab === 'tragsanet' && 'Consulta tu información oficial en la intranet'}
              {activeTab === 'users' && 'Gestión de usuarios de la aplicación'}
            </p>
          </div>
        </header>

        {error && (
          <div className="glass-card" style={{ marginBottom: '2rem', borderColor: 'var(--danger)', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <AlertCircle color="var(--danger)" />
            <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>
          </div>
        )}

        {activeTab === 'today' && (
          <div className="animate-fade-in">
            <div className="dashboard-grid">
              <div className="glass-card stat-card" style={{ gridColumn: 'span 2' }}>
                <LiveClock activeFichaje={activeFichaje} />

                <h2 style={{ marginBottom: '1rem' }}>{activeFichaje ? 'Sesión Iniciada' : 'Fuera de Jornada'}</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                  {activeFichaje
                    ? `Iniciaste a las ${format(new Date(activeFichaje.start_time), 'HH:mm')}`
                    : 'Registra tu entrada manualmente'
                  }
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setManualTime(format(new Date(), 'HH:mm'));
                      setManualDate(format(new Date(), 'yyyy-MM-dd'));
                      setShowManualEntry(true);
                    }}
                    style={{ padding: '1rem 3rem', fontSize: '1.1rem', background: activeFichaje ? 'var(--danger)' : 'linear-gradient(135deg, var(--success), #16a34a)' }}
                  >
                    {activeFichaje ? <LogOut size={20} /> : <LogIn size={20} />}
                    {activeFichaje ? 'Finalizar Fichaje' : 'Registrar Entrada'}
                  </button>
                </div>
              </div>

              <div className="glass-card stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2rem' }}>
                <div>
                  <div className="stat-label" style={{ marginBottom: '0.5rem' }}>Realizado Hoy</div>
                  <div className="stat-value">{msToTime(currentDayTotal)}</div>
                </div>

                <div>
                  <div className="stat-label" style={{ marginBottom: '0.5rem' }}>Balance Acumulado</div>
                  <div className="stat-value" style={{
                    fontSize: '1.5rem',
                    color: cumulativeBalance <= 0 ? 'var(--success)' : '#f59e0b',
                    marginBottom: '0.25rem'
                  }}>
                    {msToTime(cumulativeBalance)}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                    {cumulativeBalance <= 0 ? '¡Jornada de hoy completada!' : `Jornada - Sobrante Semanal - Realizado Hoy`}
                  </p>
                </div>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="glass-card" style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <History size={18} /> Registros {selectedDateTodayStr === todayStr ? 'de Hoy' : `del ${format(selectedDateForTodayTab, 'dd/MM/yyyy')}`}
                    <span style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.7, marginLeft: '0.5rem' }}>
                      ({msToTime(calculateDayTotal(selectedDateTodayStr, fichajes, currentTime))})
                    </span>
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      className="btn-icon"
                      title="Añadir registro manual"
                      style={{ color: 'var(--success)', marginRight: '0.5rem' }}
                      onClick={() => {
                        setManualTime(format(new Date(), 'HH:mm'));
                        setManualDate(selectedDateTodayStr);
                        setIsForcingNewEntry(true);
                        setShowManualEntry(true);
                      }}
                    >
                      <Plus size={20} />
                    </button>
                    <button
                      className="btn-icon"
                      style={{ padding: '0.2rem' }}
                      onClick={() => setSelectedDateForTodayTab(subDays(selectedDateForTodayTab, 1))}
                    >
                      &larr;
                    </button>
                    <input
                      type="date"
                      className="input-field"
                      style={{ width: 'auto', marginTop: 0, padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                      value={selectedDateTodayStr}
                      onChange={(e) => setSelectedDateForTodayTab(new Date(e.target.value))}
                    />
                    <button
                      className="btn-icon"
                      style={{ padding: '0.2rem' }}
                      onClick={() => setSelectedDateForTodayTab(addDays(selectedDateForTodayTab, 1))}
                      disabled={selectedDateTodayStr === todayStr}
                    >
                      &rarr;
                    </button>
                    {selectedDateTodayStr !== todayStr && (
                      <button
                        className="btn-icon"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                        onClick={() => setSelectedDateForTodayTab(new Date())}
                      >
                        Hoy
                      </button>
                    )}
                  </div>
                </div>
                <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Entrada</th>
                        <th>Salida</th>
                        <th>Duración</th>
                        <th style={{ textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayFichajes.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            No hay registros para hoy.
                          </td>
                        </tr>
                      ) : (
                        todayFichajes.map(f => (
                          <tr key={f.id}>
                            <td>{format(new Date(f.start_time), 'HH:mm')}</td>
                            <td>{f.end_time ? format(new Date(f.end_time), 'HH:mm') : 'En curso...'}</td>
                            <td>
                              {f.end_time
                                ? msToTime(differenceInMilliseconds(new Date(f.end_time), new Date(f.start_time)))
                                : '--:--'
                              }
                            </td>
                            <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                              <button
                                onClick={() => {
                                  setEditingFichaje(f);
                                  setEditStartTime(format(new Date(f.start_time), 'HH:mm'));
                                  setEditEndTime(f.end_time ? format(new Date(f.end_time), 'HH:mm') : '');
                                }}
                                style={{ background: 'none', color: 'var(--primary)', opacity: 0.7 }}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(f.id)}
                                style={{ background: 'none', color: 'var(--danger)', opacity: 0.7 }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass-card">
                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={18} /> Resumen Semanal
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: 'var(--glass-bg)', padding: '1rem', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="stat-label">Meta Semanal</span>
                      <span style={{ fontWeight: 600 }}>
                        {decimalToHHMM((isSummerMode ? config.daily_hours_summer : config.daily_hours_winter) * 5)}h
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                      <span className="stat-label">Sobrante Semana Ant.</span>
                      <span style={{ fontWeight: 600, color: prevWeekLeftover >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {decimalToHHMM(prevWeekLeftover)}h
                      </span>
                    </div>
                    {getLeftoverForWeek(thisWeekMonday) !== 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                        <span className="stat-label">Sobrante Esta Semana</span>
                        <span style={{ fontWeight: 600, color: getLeftoverForWeek(thisWeekMonday) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {decimalToHHMM(getLeftoverForWeek(thisWeekMonday))}h
                        </span>
                      </div>
                    )}

                  </div>

                  <div style={{ background: 'var(--primary-bg)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div className="stat-label">Realizado esta semana</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                      {msToTime(weekTotalSoFar)}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowCloseWeekModal(true)}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      marginTop: '0.5rem',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      fontSize: '0.85rem',
                      padding: '0.75rem'
                    }}
                  >
                    <Save size={16} /> Cerrar Semana
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'weekly' && (
          <div className="animate-fade-in">
            <div className="glass-card" style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ marginBottom: '0.25rem' }}>Histórico por Semanas</h3>
                  <p className="subtitle" style={{ margin: 0 }}>{weekRangeLabel}</p>
                </div>
                <button className="btn-icon" onClick={exportToExcel} style={{ color: 'var(--success)', display: 'flex', gap: '0.4rem', padding: '0.5rem 1rem' }}>
                  <Download size={18} />
                  <span>Exportar Excel</span>
                </button>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className="btn-icon"
                    onClick={() => {
                      const d = new Date(selectedWeekDate);
                      d.setDate(d.getDate() - 7);
                      setSelectedWeekDate(d);
                    }}
                  >
                    &larr; Anterior
                  </button>
                  <input
                    type="date"
                    className="input-field"
                    style={{ width: 'auto', marginTop: 0 }}
                    value={format(selectedWeekDate, 'yyyy-MM-dd')}
                    onChange={(e) => setSelectedWeekDate(new Date(e.target.value))}
                  />
                  <button
                    className="btn-icon"
                    onClick={() => {
                      const d = new Date(selectedWeekDate);
                      d.setDate(d.getDate() + 7);
                      setSelectedWeekDate(d);
                    }}
                  >
                    Siguiente &rarr;
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Día</th>
                      <th>Fecha</th>
                      <th>Fichajes</th>
                      <th>Total (Neto)</th>
                      <th>Balance</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyHistoryDays.map(day => {
                      const dStr = format(day, "yyyy-MM-dd");
                      const total = calculateDayTotal(dStr, fichajes, currentTime);
                      const isToday = dStr === todayStr;
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      const goalForDay = getDailyGoalForDate(day, config);
                      const dayBalance = total > 0 || !isWeekend ? total - goalForDay : 0;

                      const dayFichajes = fichajes
                        .filter(f => {
                          const fDate = typeof f.date === 'string' ? f.date.split('T')[0] : format(new Date(f.date), 'yyyy-MM-dd');
                          return fDate === dStr;
                        })
                        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

                      return (
                        <tr key={dStr} style={isToday ? { background: 'rgba(99, 102, 241, 0.05)' } : {}}>
                          <td style={{ fontWeight: 600 }}>{format(day, 'EEEE', { locale: es }).toUpperCase()}</td>
                          <td>{format(day, 'dd/MM/yyyy')}</td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                              {dayFichajes.map((f, idx) => (
                                <span key={idx} className="badge" style={{ background: 'var(--glass-bg)', fontSize: '0.7rem' }}>
                                  {format(new Date(f.start_time), 'HH:mm')} - {f.end_time ? format(new Date(f.end_time), 'HH:mm') : '...'}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700 }}>{total > 0 ? msToTime(total) : '--:--'}</td>
                          <td style={{ color: dayBalance >= 0 ? (dayBalance === 0 && isWeekend ? 'inherit' : 'var(--success)') : 'var(--danger)' }}>
                            {dayBalance !== 0 ? (dayBalance > 0 ? '+' : '') + msToTime(dayBalance) : '00:00'}
                          </td>
                          <td>
                            {total >= goalForDay ? (
                              <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>Hecho</span>
                            ) : (
                              total > 0 ? <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>Parcial</span> :
                                (isWeekend ? <span className="badge" style={{ opacity: 0.3 }}>Off</span> : <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>Pend.</span>)
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'right', fontWeight: 700 }}>TOTAL SEMANA:</td>
                      <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{msToTime(weeklyHistoryTotal)}</td>
                      <td style={{ fontWeight: 700, color: weeklyHistoryDiff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {weeklyHistoryDiff !== 0 ? (weeklyHistoryDiff > 0 ? '+' : '') + msToTime(weeklyHistoryDiff) : '00:00'}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'projection' && (
          <ProjectionPage
            fichajes={fichajes}
            config={config}
            currentTime={currentTime}
            weeklyLeftovers={weeklyLeftovers}
          />
        )}

        {activeTab === 'tragsanet' && (
          <div className="animate-fade-in" style={{ width: '88%', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <a
                href="https://extranet.tragsa.es/TRAGSANET/SistemasInformacion/Aplicacion/Utilidades/DatosUsuario.aspx?Tab=4"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-icon"
                style={{ textDecoration: 'none', fontSize: '0.8rem', gap: '0.4rem', padding: '0.5rem 1rem' }}
              >
                <ExternalLink size={16} />
                <span>Abrir en nueva pestaña</span>
              </a>
            </div>
            <div className="glass-card" style={{ width: '100%', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '718px', maxHeight: '840px' }}>
              <iframe
                src="https://extranet.tragsa.es/TRAGSANET/SistemasInformacion/Aplicacion/Utilidades/DatosUsuario.aspx?Tab=4"
                style={{ flex: 1, width: '100%', height: '100%', border: 'none', background: 'white' }}
                title="Tragsanet Datos Usuario"
              />
            </div>
          </div>
        )}


        {/* Modals */}
        {showManualEntry && (
          <div className="modal-overlay">
            <div className="glass-card modal-content" style={{ maxWidth: '400px', width: '90%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3>{(activeFichaje && !isForcingNewEntry) ? 'Finalizar Fichaje' : 'Registrar Entrada'}</h3>
                <button onClick={() => { setShowManualEntry(false); setIsForcingNewEntry(false); }} className="btn-icon"><X size={20} /></button>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="stat-label">Fecha</label>
                <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="input-field" />
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <label className="stat-label">Hora</label>
                <input type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} className="input-field" />
              </div>
              <button
                className="btn-primary"
                style={{ width: '100%', background: (activeFichaje && !isForcingNewEntry) ? 'var(--danger)' : 'var(--success)' }}
                onClick={() => {
                  handleAction(!!activeFichaje && !isForcingNewEntry);
                  setIsForcingNewEntry(false);
                }}
              >
                Confirmar {(activeFichaje && !isForcingNewEntry) ? 'Salida' : 'Entrada'}
              </button>
            </div>
          </div>
        )}

        {editingFichaje && (
          <div className="modal-overlay">
            <div className="glass-card modal-content" style={{ maxWidth: '400px', width: '90%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3>Editar Registro</h3>
                <button onClick={() => setEditingFichaje(null)} className="btn-icon"><X size={20} /></button>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Fecha: {format(new Date(editingFichaje.date), 'dd/MM/yyyy')}
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <label className="stat-label">Hora Entrada</label>
                <input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="input-field"
                />
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <label className="stat-label">Hora Salida</label>
                <input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="input-field"
                  placeholder="En curso..."
                />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  Deja el campo de salida vacío si aún está en curso.
                </p>
              </div>
              <button
                className="btn-primary"
                style={{ width: '100%' }}
                onClick={handleSaveEdit}
              >
                <Save size={18} /> Guardar Cambios
              </button>
            </div>
          </div>
        )}

        {showSettings && (
          <div className="modal-overlay">
            <div className="glass-card modal-content" style={{ maxWidth: '500px', width: '90%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Settings size={20} /> Parámetros
                </h3>
                <button onClick={() => setShowSettings(false)} className="btn-icon"><X size={20} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ background: 'var(--primary-bg)', padding: '1rem', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Moon size={18} className="text-winter" />
                    <span style={{ fontWeight: 600 }}>Invierno</span>
                  </div>
                  <label className="stat-label">Horas diarias</label>
                  <input
                    type="time"
                    value={decimalToHHMM(config.daily_hours_winter)}
                    onChange={(e) => {
                      const daily = hhmmToDecimal(e.target.value);
                      setConfig({ ...config, daily_hours_winter: daily, hours_per_week: daily * 5 });
                    }}
                    className="input-field"
                  />
                </div>
                <div style={{ background: 'var(--warning-bg)', padding: '1rem', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Sun size={18} className="text-summer" />
                    <span style={{ fontWeight: 600 }}>Verano</span>
                  </div>
                  <label className="stat-label">Horas diarias</label>
                  <input
                    type="time"
                    value={decimalToHHMM(config.daily_hours_summer)}
                    onChange={(e) => {
                      const daily = hhmmToDecimal(e.target.value);
                      setConfig({ ...config, daily_hours_summer: daily, hours_per_week_summer: daily * 5 });
                    }}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="stat-label">Acumulado global (referencia)</label>
                  <input
                    type="time"
                    value={decimalToHHMM(config.hours_leftover)}
                    onChange={(e) => setConfig({ ...config, hours_leftover: hhmmToDecimal(e.target.value) })}
                    className="input-field"
                  />
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Total histórico acumulado (solo informativo).
                  </p>
                </div>
                <button className="btn-primary" onClick={() => updateConfig(config)}>
                  <Save size={18} /> Guardar
                </button>
              </div>
            </div>
          </div>
        )}
        {showCloseWeekModal && (
          <div className="modal-overlay">
            <div className="glass-card modal-content" style={{ maxWidth: '400px', width: '90%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3>Cerrar Semana</h3>
                <button onClick={() => setShowCloseWeekModal(false)} className="btn-icon"><X size={20} /></button>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Selecciona un día de la semana que deseas cerrar. Se calculará el balance de lunes a viernes de esa semana.
              </p>
              <div style={{ marginBottom: '2rem' }}>
                <label className="stat-label">Día de la semana</label>
                <input
                  type="date"
                  value={closeWeekDate}
                  onChange={(e) => setCloseWeekDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <button
                className="btn-primary"
                style={{ width: '100%', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                onClick={() => closeWeek(closeWeekDate)}
              >
                Calcular y Cerrar Semana
              </button>
            </div>
          </div>
        )}

        <footer style={{ marginTop: '4rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
          <p>© 2026 Control de Presencia. Datos en MariaDB.</p>
        </footer>
      </main>
    </>
  );
}

export default App;
