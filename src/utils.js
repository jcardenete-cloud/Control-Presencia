import { format, differenceInMilliseconds, startOfWeek } from 'date-fns';

export const msToTime = (ms) => {
    const isNegative = ms < 0;
    const absMs = Math.abs(ms);
    const totalMinutes = Math.floor(absMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${isNegative ? '-' : ''}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const decimalToHHMM = (decimal) => {
    if (decimal === null || decimal === undefined || isNaN(decimal)) return "00:00";
    const absDecimal = Math.abs(decimal);
    const totalMinutes = Math.floor(absDecimal * 60 + 0.001);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const hhmmToDecimal = (hhmm) => {
    if (!hhmm) return 0;
    const parts = hhmm.split(':').map(Number);
    let h = 0, m = 0;
    if (parts.length >= 2) {
        [h, m] = parts;
    }
    return h + (m / 60);
};

export const isSummerDate = (date) => {
    const month = date.getMonth(); // 0-11
    const day = date.getDate();
    // June is 5, Sept is 8
    if (month > 5 && month < 8) return true; // July, August
    if (month === 5 && day >= 15) return true; // June 15+
    if (month === 8 && day <= 15) return true; // Sept 15-
    return false;
};

export const getDailyGoalForDate = (date, config) => {
    const summer = isSummerDate(date);
    const dailyHours = summer ? config.daily_hours_summer : config.daily_hours_winter;
    return dailyHours * 3600 * 1000;
};

export const getWeekDays = (baseDate) => {
    const start = startOfWeek(baseDate, { weekStartsOn: 1 });
    return Array.from({ length: 5 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
    });
};

export const calculateDayTotal = (dateStr, fichajes, currentTime = new Date()) => {
    const refDateStr = format(currentTime, 'yyyy-MM-dd');
    const dayFichajes = fichajes
        .filter(f => {
            const fDate = typeof f.date === 'string' ? f.date.split('T')[0] : format(new Date(f.date), 'yyyy-MM-dd');
            return fDate === dateStr;
        })
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    let total = 0;
    const completedFichajesForBonus = [];

    dayFichajes.forEach(f => {
        const start = new Date(f.start_time);
        if (f.end_time) {
            const end = new Date(f.end_time);
            total += differenceInMilliseconds(end, start);
            completedFichajesForBonus.push(f);
        } else if (dateStr === refDateStr) {
            // Live session: count from start_time to currentTime
            if (currentTime > start) {
                total += differenceInMilliseconds(currentTime, start);
            }
            // For breakfast gap we need to consider this session as "active"
            completedFichajesForBonus.push({ ...f, end_time: currentTime.toISOString() });
        }
    });

    // Bonificación desayuno: +15 min si hay una salida y entrada entre las 9:00 y las 13:00
    let hasBreakfastGap = false;
    for (let i = 0; i < completedFichajesForBonus.length - 1; i++) {
        const exitTime = new Date(completedFichajesForBonus[i].end_time);
        const entryTime = new Date(completedFichajesForBonus[i + 1].start_time);

        const isWindow = (date) => {
            const h = date.getHours();
            return h >= 9 && h < 13;
        };

        if (isWindow(exitTime) && isWindow(entryTime)) {
            hasBreakfastGap = true;
            break;
        }
    }

    if (hasBreakfastGap) {
        total += 15 * 60 * 1000;
    }

    return total > 0 ? total : 0;
};
