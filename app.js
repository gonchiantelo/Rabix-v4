'use strict';

/* ============================================================
   RABIX V4 — Application Engine
   DB · UserSystem · Planner · Fatigue · Objectives · UI
   ============================================================ */

/* ══════════════════════════════════════════════════
   DB MODULE
══════════════════════════════════════════════════ */
const DB = (() => {
    let _prefix = 'rabix_default_';
    function setUser(userId) { _prefix = `rabix_${userId}_`; }
    function _key(k) { return _prefix + k; }
    const K = { REGISTRO: 'registro', OVERRIDES: 'overrides' };
    function _get(k) { try { return JSON.parse(localStorage.getItem(_key(k))) || []; } catch { return []; } }
    function _set(k, d) { localStorage.setItem(_key(k), JSON.stringify(d)); }
    function _getObj(k) { try { return JSON.parse(localStorage.getItem(_key(k))) || {}; } catch { return {}; } }
    function saveSet(entry) {
        const reg = _get(K.REGISTRO);
        reg.push({ ...entry, id: Date.now(), ts: new Date().toISOString() });
        _set(K.REGISTRO, reg);
    }
    function getRegistro() { return _get(K.REGISTRO); }
    function clearRegistro() { _set(K.REGISTRO, []); }
    function saveOverride(fecha, escenario) {
        const ov = _getObj(K.OVERRIDES);
        ov[fecha] = escenario;
        _set(K.OVERRIDES, ov);
    }
    function getOverride(fecha) { return _getObj(K.OVERRIDES)[fecha] || null; }
    function hasTodayEntries() {
        const hoy = new Date().toISOString().split('T')[0];
        return getRegistro().some(e => e.fecha === hoy);
    }
    return { setUser, saveSet, getRegistro, clearRegistro, saveOverride, getOverride, hasTodayEntries };
})();

/* ══════════════════════════════════════════════════
   USER SYSTEM
══════════════════════════════════════════════════ */
const UserSystem = (() => {
    const USERS_KEY = 'rabix_global_users';
    const SESSION_KEY = 'rabix_uid';
    function getAllUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch { return []; } }
    function saveUsers(list) { localStorage.setItem(USERS_KEY, JSON.stringify(list)); }
    function getCurrentUserId() { return sessionStorage.getItem(SESSION_KEY) || null; }
    function getCurrentUser() {
        const id = getCurrentUserId();
        return id ? getAllUsers().find(u => u.id === id) || null : null;
    }
    function setCurrentUser(id) { sessionStorage.setItem(SESSION_KEY, id); DB.setUser(id); }
    function hasUsers() { return getAllUsers().length > 0; }
    function createUser(name, emoji, objetivo) {
        const id = 'u' + Date.now();
        const user = { id, name: name.trim(), emoji: emoji || '⚡', objetivo: objetivo || 'ALTO_RENDIMIENTO', created: new Date().toISOString() };
        const list = getAllUsers();
        list.push(user);
        saveUsers(list);
        return user;
    }
    function updateUserObjetivo(userId, objetivo) {
        const list = getAllUsers();
        const u = list.find(u => u.id === userId);
        if (u) { u.objetivo = objetivo; saveUsers(list); }
    }
    function getCustomExercises() {
        const uid = getCurrentUserId();
        if (!uid) return [];
        try { return JSON.parse(localStorage.getItem(`rabix_${uid}_custom_ex`)) || []; } catch { return []; }
    }
    function addCustomExercise(ex) {
        const uid = getCurrentUserId();
        if (!uid) return null;
        const all = getCustomExercises();
        const newEx = { ...ex, cod: 100 + all.length + 1, custom: true };
        all.push(newEx);
        localStorage.setItem(`rabix_${uid}_custom_ex`, JSON.stringify(all));
        return newEx;
    }
    function getAllExercises() { return [...EJERCICIOS, ...getCustomExercises()]; }
    function getUserStats(userId) {
        try {
            const reg = JSON.parse(localStorage.getItem(`rabix_${userId}_registro`)) || [];
            const dates = [...new Set(reg.map(e => e.fecha))];
            return { sessions: dates.length };
        } catch { return { sessions: 0 }; }
    }
    function getCurrentObjetivo() {
        const u = getCurrentUser();
        return u ? u.objetivo || 'ALTO_RENDIMIENTO' : 'ALTO_RENDIMIENTO';
    }
    return {
        getAllUsers, getCurrentUser, getCurrentUserId, setCurrentUser, hasUsers, createUser,
        updateUserObjetivo, getCustomExercises, addCustomExercise, getAllExercises,
        getUserStats, getCurrentObjetivo
    };
})();

/* ══════════════════════════════════════════════════
   TRANSLATOR
══════════════════════════════════════════════════ */
const Translator = {
    getByCode(cod) { return UserSystem.getAllExercises().find(e => e.cod === cod) || null; },
    getName(cod) { const e = this.getByCode(cod); return e ? e.nombre : `Ejercicio #${cod}`; },
    getGroup(cod) { const e = this.getByCode(cod); return e ? e.grupo : '—'; },
    getFatiga(cod) { const e = this.getByCode(cod); return e ? e.fatiga : 1; },
};

/* ══════════════════════════════════════════════════
   PLANNER — objective-aware
══════════════════════════════════════════════════ */
const Planner = {
    _plan: null,
    _objetivoId: null,

    init(objetivoId) {
        this._objetivoId = objetivoId || 'ALTO_RENDIMIENTO';
        this._plan = _generatePlan(this._objetivoId);
    },

    todayStr() { return new Date().toISOString().split('T')[0]; },

    getTodaySession() {
        const hoy = this.todayStr();
        let session = getSessionByDate(hoy, this._plan)
            || { fecha: hoy, semana: 1, fase: 'FASE 1', escenario: 'DESCANSO', ejs_cods: [] };
        const override = DB.getOverride(hoy);
        if (override) {
            const key = override === 'REPETIR' ? session.escenario : override;
            session = { ...session, escenario: key, ejs_cods: [...(ESCENARIOS[key]?.ejercicios || session.ejs_cods)] };
        }
        return session;
    },

    getScenarioData(escenario) { return ESCENARIOS[escenario] || ESCENARIOS.DESCANSO; },

    fmtDate(d) {
        return new Date(d + 'T12:00:00').toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' });
    },

    getWeekDays(semana) {
        if (!this._plan) return [];
        const startIdx = (semana - 1) * 7;
        return this._plan.slice(startIdx, startIdx + 7);
    },

    getFaseActual(semana) {
        return getFaseForObjetivo(semana, this._objetivoId);
    },

    getTotalSemanas() {
        return getObjetivoById(this._objetivoId).duracionSemanas;
    },

    getSemanaActual() {
        const hoy = this.todayStr();
        const s = getSessionByDate(hoy, this._plan);
        return s ? s.semana : 1;
    },
};

/* ══════════════════════════════════════════════════
   WEIGHT ENGINE
══════════════════════════════════════════════════ */
const WeightEngine = {
    getLastWeight(cod) {
        const entries = DB.getRegistro().filter(e => e.cod === cod).sort((a, b) => b.ts.localeCompare(a.ts));
        return entries.length ? entries[0].peso : null;
    },
    getInitialWeight(cod) { return PESOS_INICIALES[cod] ?? 0; },
    getSuggestedWeight(cod) {
        const last = this.getLastWeight(cod);
        return last !== null ? last : this.getInitialWeight(cod);
    },
};

/* ══════════════════════════════════════════════════
   FATIGUE ENGINE
══════════════════════════════════════════════════ */
const FatigueEngine = {
    _rpeYellow: 7.1,
    _rpeRed: 8.5,

    setThresholds(objetivoId) {
        const obj = getObjetivoById(objetivoId);
        this._rpeYellow = obj.rpeYellow;
        this._rpeRed = obj.rpeRed;
    },

    getLast7Days() {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
        const co = cutoff.toISOString().split('T')[0];
        return DB.getRegistro().filter(e => e.fecha >= co);
    },

    calcStats(entries) {
        if (!entries.length) return { rpe: null, vol: 0, sessions: 0 };
        const rpeVals = entries.filter(e => e.rpe > 0).map(e => e.rpe);
        const rpe = rpeVals.length ? rpeVals.reduce((s, v) => s + v, 0) / rpeVals.length : null;
        const vol = Math.round(entries.reduce((s, e) => s + (e.peso * e.series * e.reps || 0), 0));
        const sessions = [...new Set(entries.map(e => e.fecha))].length;
        return { rpe, vol, sessions };
    },

    getStatus() {
        const stats = this.calcStats(this.getLast7Days());
        const rpe = stats.rpe;
        let level = 'green';
        if (rpe !== null && rpe > this._rpeRed) level = 'red';
        else if (rpe !== null && rpe > this._rpeYellow) level = 'yellow';
        let reco = 'Sin datos suficientes. Completá sesiones para activar el motor.';
        if (rpe !== null) {
            if (level === 'green') reco = '✅ Fatiga óptima. Mantener carga y seguir el plan.';
            if (level === 'yellow') reco = '🟡 Carga moderada-alta. Monitorear sensaciones.';
            if (level === 'red') reco = '🔴 Fatiga ALTA. Considerar sesión de descarga.';
        }
        return { ...stats, level, reco };
    },

    isHighFatigue() { return this.getStatus().level === 'red'; },

    getProgressionSuggestion(cod) {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
        const co = cutoff.toISOString().split('T')[0];
        const entries = DB.getRegistro().filter(e => e.cod === cod && e.fecha >= co && e.rpe > 0);
        if (!entries.length) return null;
        const avgRpe = entries.reduce((s, e) => s + e.rpe, 0) / entries.length;
        return { suggest: avgRpe < 7, avgRpe: +avgRpe.toFixed(1) };
    },
};

/* ══════════════════════════════════════════════════
   AMISTOSO LOGIC
══════════════════════════════════════════════════ */
const AmistosoLogic = {
    applyFriendlyMatch(fecha) {
        const next = new Date(fecha + 'T12:00:00');
        next.setDate(next.getDate() + 1);
        DB.saveOverride(next.toISOString().split('T')[0], 'RECUPERACION');
    },
};

/* ══════════════════════════════════════════════════
   CANVAS CHART
══════════════════════════════════════════════════ */
const Chart = {
    draw(id) {
        const canvas = document.getElementById(id);
        if (!canvas || !canvas.offsetWidth) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth, H = canvas.offsetHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.scale(dpr, dpr);
        const days = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const str = d.toISOString().split('T')[0];
            const entries = DB.getRegistro().filter(e => e.fecha === str && e.rpe > 0);
            const avg = entries.length ? entries.reduce((s, e) => s + e.rpe, 0) / entries.length : null;
            days.push({ rpe: avg, label: d.toLocaleDateString('es-UY', { day: 'numeric', month: 'short' }) });
        }
        ctx.clearRect(0, 0, W, H);
        const pad = { top: 16, right: 8, bottom: 28, left: 8 };
        const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
        const lineY = (rpe) => pad.top + ch - (rpe / 10) * ch;
        const pts = days.map((d, i) => ({ x: pad.left + (i / (days.length - 1)) * cw, y: d.rpe !== null ? lineY(Math.min(10, Math.max(0, d.rpe))) : null, rpe: d.rpe }));
        [{ v: 7, c: 'rgba(34,197,94,0.3)' }, { v: 8.5, c: 'rgba(244,63,94,0.3)' }].forEach(({ v, c }) => {
            ctx.setLineDash([4, 4]); ctx.strokeStyle = c; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(pad.left, lineY(v)); ctx.lineTo(W - pad.right, lineY(v)); ctx.stroke();
        });
        ctx.setLineDash([]);
        const valid = pts.filter(p => p.y !== null);
        if (valid.length > 1) {
            const gr = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
            gr.addColorStop(0, 'rgba(0,200,255,0.2)'); gr.addColorStop(1, 'rgba(0,200,255,0)');
            ctx.beginPath(); ctx.moveTo(valid[0].x, valid[0].y);
            valid.forEach((p, i) => { if (i) { const cpx = (valid[i-1].x + p.x) / 2; ctx.bezierCurveTo(cpx, valid[i-1].y, cpx, p.y, p.x, p.y); } });
            ctx.lineTo(valid[valid.length - 1].x, H - pad.bottom); ctx.lineTo(valid[0].x, H - pad.bottom);
            ctx.closePath(); ctx.fillStyle = gr; ctx.fill();
            ctx.beginPath(); ctx.moveTo(valid[0].x, valid[0].y);
            valid.forEach((p, i) => { if (i) { const cpx = (valid[i-1].x + p.x) / 2; ctx.bezierCurveTo(cpx, valid[i-1].y, cpx, p.y, p.x, p.y); } });
            ctx.strokeStyle = 'rgba(0,200,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
        }
        pts.forEach(p => {
            if (!p.y) return;
            const color = p.rpe > 8.5 ? '#f43f5e' : p.rpe > 7 ? '#facc15' : '#22c55e';
            ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = color; ctx.fill();
            ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.stroke();
        });
        ctx.fillStyle = 'rgba(148,163,184,0.7)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
        days.forEach((d, i) => { if (i % 3 === 0) ctx.fillText(d.label, pts[i].x, H - 6); });
    },
};

/* ══════════════════════════════════════════════════
   MOBILITY MODULE
══════════════════════════════════════════════════ */
const Mobility = {
    _collapsed: false,
    _skipped: false,
    render() {
        const container = document.getElementById('mobility-exercises');
        if (!container) return;
        container.innerHTML = MOVILIDAD_ARTICULAR.map(ex => `
      <div class="mobility-card">
        <span class="mobility-emoji">${ex.emoji}</span>
        <div class="mobility-info">
          <p class="mobility-name">${ex.nombre}</p>
          <p class="mobility-desc">${ex.descripcion}</p>
        </div>
        <span class="mobility-time">${ex.duracion}s</span>
      </div>
    `).join('');
    },
    skip() {
        this._skipped = true;
        const el = document.getElementById('mobility-section');
        if (el) { el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; el.style.transition = '0.3s'; setTimeout(() => el.classList.add('hidden'), 300); }
    },
    toggle() {
        this._collapsed = !this._collapsed;
        const sec = document.getElementById('mobility-section');
        const btn = document.getElementById('btn-toggle-mobility');
        if (sec) sec.classList.toggle('collapsed', this._collapsed);
        if (btn) btn.classList.toggle('collapsed', this._collapsed);
    },
    reset() { this._skipped = false; this._collapsed = false; },
};

/* ══════════════════════════════════════════════════
   UI MODULE
══════════════════════════════════════════════════ */
const UI = (() => {
    let currentSession = null;
    let activeLogCod = null;
    const loggedSets = {};

    function initNav() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => switchView(btn.dataset.view));
        });
    }

    function switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const view = document.getElementById(`view-${viewId}`);
        if (view) view.classList.add('active');
        const btn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
        if (btn) btn.classList.add('active');
        if (viewId === 'history') renderHistory();
        if (viewId === 'train') Timer.show();
        else Timer.hide();
    }

    function renderDashboard() {
        currentSession = Planner.getTodaySession();
        const sd = Planner.getScenarioData(currentSession.escenario);
        const fatigue = FatigueEngine.getStatus();
        const semana = currentSession.semana;
        const fase = Planner.getFaseActual(semana);
        const obj = getObjetivoById(UserSystem.getCurrentObjetivo());

        const phaseBadge = document.getElementById('phase-badge');
        if (phaseBadge) phaseBadge.textContent = fase ? `MES ${fase.num}` : '—';
        const sem = document.getElementById('semaphore');
        if (sem) sem.className = `semaphore ${fatigue.level}`;

        // Objetivo badge en header
        const objBadge = document.getElementById('objetivo-badge');
        if (objBadge) { objBadge.textContent = `${obj.emoji} ${obj.label}`; objBadge.style.color = obj.color; objBadge.style.borderColor = obj.color + '40'; objBadge.style.background = obj.color + '12'; }

        const user = UserSystem.getCurrentUser();
        const ue = document.getElementById('header-user-emoji');
        if (ue && user) ue.textContent = user.emoji;

        const tdEl = document.getElementById('today-date');
        if (tdEl) tdEl.textContent = _cap(Planner.fmtDate(currentSession.fecha));
        const seEl = document.getElementById('scenario-emoji');
        if (seEl) seEl.textContent = sd.emoji;
        const slEl = document.getElementById('scenario-label');
        if (slEl) { slEl.textContent = sd.label; slEl.style.color = sd.color; }

        const preview = document.getElementById('today-preview');
        if (preview) {
            preview.innerHTML = currentSession.ejs_cods.slice(0, 5).map(c =>
                `<span class="exercise-chip">${Translator.getName(c)}</span>`
            ).join('') + (currentSession.ejs_cods.length > 5 ? `<span class="exercise-chip">+${currentSession.ejs_cods.length - 5} más</span>` : '');
        }

        const diaDobleBtn = document.getElementById('btn-dia-doble');
        if (diaDobleBtn) diaDobleBtn.classList.toggle('hidden', !DB.hasTodayEntries());

        const mrpe = document.getElementById('metric-rpe');
        if (mrpe) mrpe.textContent = fatigue.rpe !== null ? fatigue.rpe.toFixed(1) : '—';
        const mvolEl = document.getElementById('metric-vol');
        if (mvolEl) mvolEl.textContent = fatigue.vol > 0 ? `${(fatigue.vol / 1000).toFixed(1)}t` : '—';
        const mses = document.getElementById('metric-sessions');
        if (mses) mses.textContent = fatigue.sessions || '—';
        const mrecoEl = document.getElementById('fatigue-reco');
        if (mrecoEl) mrecoEl.textContent = fatigue.reco;
        const bar = document.getElementById('fatigue-bar');
        if (bar) {
            bar.style.width = `${Math.min(100, ((fatigue.rpe || 0) / 10) * 100)}%`;
            bar.style.background = fatigue.level === 'green' ? 'var(--green)' : fatigue.level === 'yellow' ? 'var(--yellow)' : 'var(--red)';
        }

        renderWeekDays(semana);
        renderPhaseTimeline(semana);
        const wbEl = document.getElementById('week-badge');
        if (wbEl) wbEl.textContent = `Sem. ${semana} / ${Planner.getTotalSemanas()}`;
    }

    function renderWeekDays(semana) {
        const days = Planner.getWeekDays(semana);
        const hoy = Planner.todayStr();
        const container = document.getElementById('week-days');
        if (!container) return;
        const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
        const SCENARIO_EMOJI = {};
        Object.entries(ESCENARIOS).forEach(([k, v]) => { SCENARIO_EMOJI[k] = v.emoji; });
        const registro = DB.getRegistro();
        container.innerHTML = days.map(s => {
            const dow = new Date(s.fecha + 'T12:00:00').getDay();
            const isToday = s.fecha === hoy;
            const isDone = registro.some(e => e.fecha === s.fecha);
            const isPast = s.fecha < hoy;
            const isRest = s.escenario === 'DESCANSO' || s.escenario === 'PARTIDO';
            let cls = '';
            if (isToday) cls = 'today';
            else if (isDone) cls = 'done';
            else if (isPast && !isRest) cls = 'skipped';
            else if (isRest) cls = 'rest';
            return `<div class="day-dot ${cls}"><span>${DAY_LABELS[dow]}</span><div class="dot">${isDone ? '✓' : isToday ? '•' : (SCENARIO_EMOJI[s.escenario] || '—')}</div></div>`;
        }).join('');
    }

    function renderPhaseTimeline(semanaActual) {
        const container = document.getElementById('phase-timeline');
        if (!container) return;
        const obj = getObjetivoById(UserSystem.getCurrentObjetivo());
        container.innerHTML = obj.fases.map(f => {
            const totalSems = f.semanas[1] - f.semanas[0] + 1;
            const done = Math.max(0, Math.min(totalSems, semanaActual - f.semanas[0] + 1));
            const pct = Math.round((done / totalSems) * 100);
            return `<div class="phase-row"><span class="phase-row-label">MES ${f.num}</span><div class="phase-row-bar-wrap"><div class="phase-row-bar" style="width:${pct}%;background:${f.color}"></div></div><span class="phase-row-pct">${pct}%</span></div>`;
        }).join('');
    }

    function startTraining(overrideEscenario) {
        if (!currentSession) currentSession = Planner.getTodaySession();
        const session = overrideEscenario
            ? { ...currentSession, escenario: overrideEscenario, ejs_cods: overrideEscenario === 'REPETIR' ? currentSession.ejs_cods : [...(ESCENARIOS[overrideEscenario]?.ejercicios || [])] }
            : currentSession;
        if (!session.ejs_cods.length) { alert('No hay ejercicios para esta sesión. Cambiá el escenario.'); return; }
        if (overrideEscenario) currentSession = session;
        Object.keys(loggedSets).forEach(k => delete loggedSets[k]);
        const sd = Planner.getScenarioData(session.escenario);
        const trainLabel = document.getElementById('train-scenario-label');
        if (trainLabel) trainLabel.textContent = `${sd.emoji} ${sd.label}`;
        const trainDate = document.getElementById('train-date-label');
        if (trainDate) trainDate.textContent = _cap(Planner.fmtDate(session.fecha));
        if (FatigueEngine.isHighFatigue()) {
            const alertEl = document.getElementById('fatigue-alert-banner');
            if (alertEl) alertEl.classList.remove('hidden');
        }
        Mobility.reset();
        const mobilitySection = document.getElementById('mobility-section');
        if (mobilitySection) { mobilitySection.classList.remove('hidden'); mobilitySection.style.opacity = ''; mobilitySection.style.transform = ''; }
        Mobility.render();
        renderExerciseList();
        switchView('train');
    }

    function renderExerciseList() {
        if (!currentSession) return;
        const container = document.getElementById('exercise-list');
        if (!container) return;
        container.innerHTML = '';
        if (!currentSession.ejs_cods.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">😴</div><p>Sin ejercicios para este escenario.</p></div>`;
            return;
        }
        currentSession.ejs_cods.forEach(cod => container.appendChild(buildExerciseCard(cod)));
    }

    function buildExerciseCard(cod) {
        const ej = Translator.getByCode(cod);
        if (!ej) return document.createElement('div');
        const lastWeight = WeightEngine.getSuggestedWeight(cod);
        const prog = FatigueEngine.getProgressionSuggestion(cod);
        const suggestedWeight = (prog && prog.suggest && lastWeight > 0) ? lastWeight + 2.5 : lastWeight;
        const isProgressed = prog && prog.suggest && lastWeight > 0;
        const sets = loggedSets[cod] || [];
        const hasLogs = sets.length > 0;
        const card = document.createElement('div');
        card.className = `exercise-card${hasLogs ? ' logged' : ''}`;
        card.id = `ex-card-${cod}`;
        const weightLabel = (ej.fatiga === 1 && suggestedWeight === 0) ? 'Corporal' : `${suggestedWeight} kg${isProgressed ? ' ▲' : ''}`;
        const customBadge = ej.custom ? `<span class="custom-ex-badge">★ Personal</span>` : '';
        card.innerHTML = `
      <div class="exercise-card-header" onclick="UI.openLogModal(${cod})">
        <div class="ex-fatigue-badge f${ej.fatiga}">${ej.fatiga}</div>
        <div class="exercise-card-info">
          <p class="ex-name">${ej.nombre}${customBadge}</p>
          <p class="ex-group">${ej.grupo} · ${ej.patron || '—'}</p>
        </div>
        <span class="ex-weight-pill${isProgressed ? ' progressed' : ''}">${weightLabel}</span>
        <span class="ex-log-indicator">${hasLogs ? '✅' : '+'}</span>
      </div>
      ${hasLogs ? `<div class="ex-logged-sets">
        ${sets.map((s, i) => `<div class="logged-set-row"><span class="set-num">S${i+1}</span><span class="set-data">${s.peso}kg × ${s.series}×${s.reps}</span><span class="set-rpe ${s.rpe <= 7 ? 'low' : s.rpe <= 8.5 ? 'mid' : 'high'}">RPE ${s.rpe}</span></div>`).join('')}
        <button class="btn-add-set" onclick="UI.openLogModal(${cod})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Agregar serie
        </button>
      </div>` : ''}`;
        return card;
    }

    function openLogModal(cod) {
        activeLogCod = cod;
        const ej = Translator.getByCode(cod);
        if (!ej) return;
        const lastWeight = WeightEngine.getSuggestedWeight(cod);
        const prog = FatigueEngine.getProgressionSuggestion(cod);
        const sw = (prog && prog.suggest && lastWeight > 0) ? lastWeight + 2.5 : lastWeight;
        document.getElementById('log-modal-title').textContent = ej.nombre;
        document.getElementById('log-modal-group').textContent = ej.grupo;
        document.getElementById('log-cod').value = cod;
        document.getElementById('log-peso').value = sw > 0 ? sw : '';
        document.getElementById('log-series').value = 4;
        document.getElementById('log-reps').value = 10;
        document.getElementById('log-rpe').value = 7;
        document.getElementById('log-rpe-display').textContent = 7;
        document.getElementById('log-dolor').value = 0;
        document.getElementById('log-dolor-display').textContent = 0;
        document.getElementById('log-notes').value = '';
        document.getElementById('pain-alert').classList.add('hidden');
        let suggText = '';
        if (prog && prog.suggest) suggText = `💡 RPE prom. ${prog.avgRpe} → +2.5kg sugerido (${sw} kg)`;
        else if (prog && !prog.suggest) suggText = `✅ Mantener carga actual: ${lastWeight} kg`;
        else suggText = lastWeight > 0 ? `📋 Último registro: ${lastWeight} kg` : `📋 Sin historial — usar peso inicial`;
        document.getElementById('suggestion-text').textContent = suggText;
        document.getElementById('log-modal-overlay').classList.remove('hidden');
        setTimeout(() => document.getElementById('log-peso').focus(), 100);
    }

    function closeLogModal() {
        document.getElementById('log-modal-overlay').classList.add('hidden');
        activeLogCod = null;
    }

    function initLogForm() {
        document.getElementById('log-rpe').addEventListener('input', function () {
            document.getElementById('log-rpe-display').textContent = this.value;
        });
        document.getElementById('log-dolor').addEventListener('input', function () {
            document.getElementById('log-dolor-display').textContent = this.value;
            document.getElementById('pain-alert').classList.toggle('hidden', parseFloat(this.value) <= 7);
        });
        document.getElementById('log-form').addEventListener('submit', e => {
            e.preventDefault();
            if (!activeLogCod) return;
            const cod = parseInt(document.getElementById('log-cod').value, 10);
            const peso = parseFloat(document.getElementById('log-peso').value || 0);
            const series = parseInt(document.getElementById('log-series').value || 1, 10);
            const reps = parseInt(document.getElementById('log-reps').value || 1, 10);
            const rpe = parseFloat(document.getElementById('log-rpe').value);
            const dolor = parseFloat(document.getElementById('log-dolor').value);
            const notes = document.getElementById('log-notes').value.trim();
            const dolor_alert = dolor > 7;
            DB.saveSet({ cod, fecha: Planner.todayStr(), peso, series, reps, rpe, dolor, notes, vol_total: peso * series * reps, dolor_alert });
            if (!loggedSets[cod]) loggedSets[cod] = [];
            loggedSets[cod].push({ peso, series, reps, rpe, dolor });
            closeLogModal();
            refreshExerciseCard(cod);
            const ddb = document.getElementById('btn-dia-doble');
            if (ddb) ddb.classList.toggle('hidden', !DB.hasTodayEntries());
            Timer.autoRestartAfterSet();
            if (dolor_alert) {
                setTimeout(() => alert(`⚠️ Dolor > 7. Siguiente serie sugerida: ${+(peso * 0.8).toFixed(1)} kg (-20%).`), 300);
            }
        });
        document.getElementById('btn-close-log-modal').addEventListener('click', closeLogModal);
        document.getElementById('log-modal-overlay').addEventListener('click', e => { if (e.target.id === 'log-modal-overlay') closeLogModal(); });
    }

    function refreshExerciseCard(cod) {
        const old = document.getElementById(`ex-card-${cod}`);
        if (old) old.replaceWith(buildExerciseCard(cod));
    }

    function openScenarioModal() {
        const container = document.getElementById('scenario-options');
        container.innerHTML = Object.entries(ESCENARIOS).map(([key, s]) => `
      <button class="scenario-option-btn${currentSession?.escenario === key ? ' selected' : ''}" onclick="UI.selectScenario('${key}')">
        <span class="scenario-option-emoji">${s.emoji}</span>
        <span class="scenario-option-label">${s.label}</span>
      </button>`).join('');
        document.getElementById('scenario-modal-overlay').classList.remove('hidden');
    }

    function closeScenarioModal() { document.getElementById('scenario-modal-overlay').classList.add('hidden'); }

    function selectScenario(escenario) {
        DB.saveOverride(Planner.todayStr(), escenario);
        if (escenario === 'AMISTOSO') AmistosoLogic.applyFriendlyMatch(Planner.todayStr());
        closeScenarioModal();
        renderDashboard();
    }

    function openDiaDobleModal() {
        const container = document.getElementById('dia-doble-options');
        container.innerHTML = DIA_DOBLE_OPTIONS.map(opt => `
      <button class="dia-doble-option-btn" onclick="UI.startDiaDoble('${opt.key}')">
        <span class="dd-emoji">${opt.emoji}</span>
        <div class="dd-info">
          <p class="dd-label">${opt.label}</p>
          <p class="dd-desc">${opt.desc}</p>
        </div>
      </button>`).join('');
        document.getElementById('dia-doble-modal-overlay').classList.remove('hidden');
    }

    function closeDiaDobleModal() { document.getElementById('dia-doble-modal-overlay').classList.add('hidden'); }
    function startDiaDoble(key) { closeDiaDobleModal(); startTraining(key); }

    function renderHistory() {
        setTimeout(() => Chart.draw('rpe-chart'), 60);
        renderLibrary('');
        renderSessionLog();
    }

    function renderLibrary(query) {
        const list = document.getElementById('library-list');
        const countEl = document.getElementById('library-count');
        const all = UserSystem.getAllExercises();
        const filtered = all.filter(e => !query || e.nombre.toLowerCase().includes(query.toLowerCase()) || (e.grupo || '').toLowerCase().includes(query.toLowerCase()));
        if (countEl) countEl.textContent = all.length;
        if (!filtered.length) { list.innerHTML = `<div class="empty-state"><p>Sin resultados.</p></div>`; return; }
        list.innerHTML = filtered.map(e => `
      <div class="library-row">
        <span class="library-cod">${e.cod}</span>
        <span class="library-name">${e.nombre}${e.custom ? ' <span class="custom-ex-badge">★</span>' : ''}</span>
        <span class="library-grupo">${e.grupo || ''}</span>
        <span class="library-fatiga f${e.fatiga}"></span>
      </div>`).join('');
    }

    function renderSessionLog() {
        const log = document.getElementById('session-log');
        const registro = DB.getRegistro();
        if (!registro.length) { log.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><p>Sin sesiones registradas todavía.</p></div>`; return; }
        const byDate = {};
        registro.forEach(e => { if (!byDate[e.fecha]) byDate[e.fecha] = []; byDate[e.fecha].push(e); });
        const sorted = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
        log.innerHTML = sorted.slice(0, 20).map(fecha => {
            const entries = byDate[fecha];
            const session = getSessionByDate(fecha, Planner._plan);
            const label = session ? (ESCENARIOS[session.escenario]?.label || session.escenario) : 'Sesión';
            const vol = entries.reduce((s, e) => s + (e.vol_total || 0), 0);
            const rpeVals = entries.filter(e => e.rpe > 0);
            const avgRpe = rpeVals.length ? rpeVals.reduce((s, e) => s + e.rpe, 0) / rpeVals.length : 0;
            const cls = avgRpe > 8.5 ? 'high' : avgRpe > 7 ? 'mid' : 'low';
            return `<div class="session-row"><span class="session-row-date">${_fmtShort(fecha)}</span><div class="session-row-info"><p class="session-row-scenario">${label}</p><p class="session-row-stats">${entries.length} series · ${Math.round(vol)} kg</p></div><span class="session-row-rpe ${cls}">${avgRpe > 0 ? avgRpe.toFixed(1) : '—'}</span></div>`;
        }).join('');
    }

    /* ── Objetivo Modal ── */
    function openObjetivoModal() {
        const container = document.getElementById('objetivo-options');
        const current = UserSystem.getCurrentObjetivo();
        container.innerHTML = OBJETIVOS_DISPONIBLES.map(obj => `
      <button class="objetivo-option-btn${obj.id === current ? ' selected' : ''}" onclick="UI.selectObjetivo('${obj.id}')" style="--obj-color:${obj.color}">
        <span class="obj-emoji">${obj.emoji}</span>
        <div class="obj-info">
          <p class="obj-label">${obj.label}</p>
          <p class="obj-desc">${obj.desc}</p>
        </div>
        ${obj.id === current ? '<span class="obj-check">✓</span>' : ''}
      </button>`).join('');
        document.getElementById('objetivo-modal-overlay').classList.remove('hidden');
    }

    function closeObjetivoModal() { document.getElementById('objetivo-modal-overlay').classList.add('hidden'); }

    function selectObjetivo(objetivoId) {
        const userId = UserSystem.getCurrentUserId();
        if (userId) UserSystem.updateUserObjetivo(userId, objetivoId);
        closeObjetivoModal();
        App.reinitWithObjetivo(objetivoId);
    }

    function _cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function _fmtShort(str) { return new Date(str + 'T12:00:00').toLocaleDateString('es-UY', { day: 'numeric', month: 'short' }); }

    function init() {
        initNav();
        initLogForm();
        document.getElementById('btn-start-training').addEventListener('click', () => startTraining());
        document.getElementById('btn-dia-doble').addEventListener('click', openDiaDobleModal);
        document.getElementById('btn-back-dashboard').addEventListener('click', () => { switchView('dashboard'); renderDashboard(); });
        document.getElementById('btn-scenario-override').addEventListener('click', openScenarioModal);
        document.getElementById('scenario-modal-overlay').addEventListener('click', e => { if (e.target.id === 'scenario-modal-overlay') closeScenarioModal(); });
        document.getElementById('dia-doble-modal-overlay').addEventListener('click', e => { if (e.target.id === 'dia-doble-modal-overlay') closeDiaDobleModal(); });
        document.getElementById('library-search').addEventListener('input', e => renderLibrary(e.target.value));
        document.getElementById('btn-clear-history').addEventListener('click', () => {
            if (confirm('¿Borrar todo el historial? Esta acción no se puede deshacer.')) { DB.clearRegistro(); renderHistory(); renderDashboard(); }
        });
        document.getElementById('btn-add-exercise').addEventListener('click', () => {
            document.getElementById('custom-ex-modal-overlay').classList.remove('hidden');
        });
        document.getElementById('btn-finish-session').addEventListener('click', () => {
            if (!Object.keys(loggedSets).length && !confirm('No registraste ejercicios. ¿Finalizar igual?')) return;
            switchView('dashboard');
            renderDashboard();
        });
        document.getElementById('btn-skip-mobility').addEventListener('click', () => Mobility.skip());
        document.getElementById('btn-toggle-mobility').addEventListener('click', () => Mobility.toggle());
        document.getElementById('header-user-btn').addEventListener('click', () => {
            if (confirm('¿Cambiar de perfil?')) { sessionStorage.removeItem('rabix_uid'); location.reload(); }
        });
        // Objetivo btn
        const btnObj = document.getElementById('btn-objetivo');
        if (btnObj) btnObj.addEventListener('click', openObjetivoModal);
        const objOverlay = document.getElementById('objetivo-modal-overlay');
        if (objOverlay) objOverlay.addEventListener('click', e => { if (e.target.id === 'objetivo-modal-overlay') closeObjetivoModal(); });

        document.getElementById('custom-ex-form').addEventListener('submit', e => {
            e.preventDefault();
            const nombre = document.getElementById('cex-nombre').value.trim();
            const grupo = document.getElementById('cex-grupo').value.trim();
            const fatiga = parseInt(document.getElementById('cex-fatiga').value || '2', 10);
            const patron = document.getElementById('cex-patron').value.trim();
            if (!nombre) return;
            UserSystem.addCustomExercise({ nombre, grupo: grupo || 'General', fatiga, patron: patron || 'Libre', activo: true });
            document.getElementById('custom-ex-modal-overlay').classList.add('hidden');
            document.getElementById('custom-ex-form').reset();
            renderLibrary('');
        });
        document.getElementById('custom-ex-modal-overlay').addEventListener('click', e => {
            if (e.target.id === 'custom-ex-modal-overlay') document.getElementById('custom-ex-modal-overlay').classList.add('hidden');
        });

        renderDashboard();
    }

    return {
        init, openLogModal, closeLogModal, openScenarioModal, closeScenarioModal, selectScenario,
        startTraining, openDiaDobleModal, closeDiaDobleModal, startDiaDoble,
        openObjetivoModal, closeObjetivoModal, selectObjetivo
    };
})();

/* ══════════════════════════════════════════════════
   LOGIN UI
══════════════════════════════════════════════════ */
const LoginUI = {
    selectedEmoji: '⚡',
    selectedObjetivo: 'ALTO_RENDIMIENTO',
    _initialized: false,

    show() {
        document.getElementById('view-login')?.classList.remove('hidden');
        document.getElementById('app-header')?.classList.add('hidden');
        document.querySelector('.bottom-nav')?.classList.add('hidden');
        document.querySelector('.app-main')?.classList.add('hidden');
        this.renderUserList();
        this.initOnce();
    },

    hide() {
        document.getElementById('view-login')?.classList.add('hidden');
        document.getElementById('app-header')?.classList.remove('hidden');
        document.querySelector('.bottom-nav')?.classList.remove('hidden');
        document.querySelector('.app-main')?.classList.remove('hidden');
    },

    renderUserList() {
        const list = document.getElementById('user-list');
        if (!list) return;
        const users = UserSystem.getAllUsers();
        if (!users.length) {
            list.innerHTML = `<div class="empty-state" style="padding:16px 0"><p>Aún no hay perfiles. ¡Creá el tuyo!</p></div>`;
            return;
        }
        list.innerHTML = users.map(u => {
            const stats = UserSystem.getUserStats(u.id);
            const obj = getObjetivoById(u.objetivo || 'ALTO_RENDIMIENTO');
            return `<div class="user-card" onclick="LoginUI.selectUser('${u.id}')">
        <div class="user-card-emoji">${u.emoji}</div>
        <div class="user-card-info">
          <p class="user-card-name">${u.name}</p>
          <p class="user-card-meta">${obj.emoji} ${obj.label} · ${stats.sessions} sesiones</p>
        </div>
        <span class="user-card-arrow">›</span>
      </div>`;
        }).join('');
    },

    selectUser(id) {
        UserSystem.setCurrentUser(id);
        this.hide();
        const user = UserSystem.getCurrentUser();
        App.reinitWithObjetivo(user?.objetivo || 'ALTO_RENDIMIENTO');
    },

    initOnce() {
        if (this._initialized) return;
        this._initialized = true;

        const btnNew = document.getElementById('btn-new-user');
        if (btnNew) btnNew.addEventListener('click', () => {
            document.getElementById('new-user-modal-overlay').classList.remove('hidden');
            this.renderEmojiPicker();
            this.renderObjetivoPicker();
        });

        const form = document.getElementById('new-user-form');
        if (form) form.addEventListener('submit', e => {
            e.preventDefault();
            const name = document.getElementById('new-user-name').value.trim();
            if (!name) return;
            const user = UserSystem.createUser(name, this.selectedEmoji, this.selectedObjetivo);
            document.getElementById('new-user-modal-overlay').classList.add('hidden');
            this.selectUser(user.id);
        });

        const overlay = document.getElementById('new-user-modal-overlay');
        if (overlay) overlay.addEventListener('click', e => {
            if (e.target.id === 'new-user-modal-overlay') overlay.classList.add('hidden');
        });
    },

    renderEmojiPicker() {
        const picker = document.getElementById('emoji-picker');
        if (!picker) return;
        picker.innerHTML = USER_EMOJIS.map(em => `
      <button type="button" class="emoji-option${this.selectedEmoji === em ? ' selected' : ''}" onclick="LoginUI.pickEmoji('${em}')">${em}</button>
    `).join('');
    },

    pickEmoji(em) { this.selectedEmoji = em; this.renderEmojiPicker(); },

    renderObjetivoPicker() {
        const picker = document.getElementById('objetivo-picker');
        if (!picker) return;
        picker.innerHTML = OBJETIVOS_DISPONIBLES.map(obj => `
      <button type="button" class="objetivo-pick-btn${this.selectedObjetivo === obj.id ? ' selected' : ''}" 
        onclick="LoginUI.pickObjetivo('${obj.id}')" style="--obj-color:${obj.color}">
        <span>${obj.emoji}</span>
        <span class="obj-pick-label">${obj.label}</span>
      </button>`).join('');
    },

    pickObjetivo(id) { this.selectedObjetivo = id; this.renderObjetivoPicker(); },
};

/* ══════════════════════════════════════════════════
   TIMER MODULE
══════════════════════════════════════════════════ */
const Timer = (() => {
    let _interval = null, _seconds = 0, _running = false;
    let _mode = 'stopwatch', _target = 0, _lastPreset = 0;
    function _el(id) { return document.getElementById(id); }
    function _render() {
        const mins = Math.floor(Math.abs(_seconds) / 60);
        const secs = Math.abs(_seconds) % 60;
        const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        const timeEl = _el('timer-time'); if (timeEl) timeEl.textContent = timeStr;
        const modeEl = _el('timer-mode-icon'); if (modeEl) modeEl.textContent = _mode === 'stopwatch' ? '⏱' : '⏳';
        const display = _el('timer-display');
        if (display) {
            display.className = 'timer-display';
            if (_running) display.classList.add('running');
            if (_mode === 'countdown' && _seconds <= 10 && _seconds > 0) display.classList.add('warning');
            if (_mode === 'countdown' && _seconds <= 0 && !_running) display.classList.add('done');
        }
    }
    function _tick() {
        if (_mode === 'stopwatch') _seconds++;
        else {
            _seconds--;
            if (_seconds <= 0) { _seconds = 0; _render(); _stop(); _onFinish(); return; }
        }
        _render();
    }
    function _start() { if (_running) return; _running = true; _interval = setInterval(_tick, 1000); _render(); }
    function _stop() { _running = false; clearInterval(_interval); _render(); }
    function _onFinish() {
        const bar = _el('timer-bar');
        if (bar) { bar.classList.add('timer-done-flash'); setTimeout(() => bar.classList.remove('timer-done-flash'), 1500); }
        if (navigator.vibrate) navigator.vibrate([150, 80, 150, 80, 400]);
        const modeEl = _el('timer-mode-icon'); if (modeEl) modeEl.textContent = '✅';
    }
    function toggle() { if (_running) _stop(); else _start(); }
    function reset() {
        _stop(); _mode = 'stopwatch'; _seconds = 0; _lastPreset = 0;
        document.querySelectorAll('.timer-preset').forEach(b => b.classList.remove('active'));
        _render();
    }
    function setCountdown(secs, btnEl) {
        _stop(); _mode = 'countdown'; _target = secs; _lastPreset = secs; _seconds = secs;
        document.querySelectorAll('.timer-preset').forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');
        _render(); _start();
    }
    function autoRestartAfterSet() {
        if (_lastPreset > 0) { _stop(); _mode = 'countdown'; _seconds = _lastPreset; _render(); setTimeout(() => _start(), 300); }
    }
    function show() { const bar = _el('timer-bar'); if (bar) bar.classList.remove('hidden'); }
    function hide() { const bar = _el('timer-bar'); if (bar) bar.classList.add('hidden'); reset(); }
    return { toggle, reset, setCountdown, autoRestartAfterSet, show, hide };
})();

/* ══════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════ */
const App = {
    init() {
        const uid = UserSystem.getCurrentUserId();
        if (uid) {
            DB.setUser(uid);
            const user = UserSystem.getCurrentUser();
            this.reinitWithObjetivo(user?.objetivo || 'ALTO_RENDIMIENTO');
        } else {
            LoginUI.show();
        }
    },

    reinitWithObjetivo(objetivoId) {
        Planner.init(objetivoId);
        FatigueEngine.setThresholds(objetivoId);
        const last = Planner._plan[Planner._plan.length - 1];
        if (last && Planner.todayStr() > last.fecha) {
            document.getElementById('cycle-modal-overlay').classList.remove('hidden');
        }
        ['fuerza', 'resistencia'].forEach(k => {
            const el = document.getElementById(`survey-${k}`);
            if (el) el.addEventListener('input', () => {
                document.getElementById(`survey-${k}-display`).textContent = el.value;
            });
        });
        UI.init();
    },

    startNewCycle() {
        document.getElementById('cycle-modal-overlay').classList.add('hidden');
        location.reload();
    },
};

/* ── Expose globals ── */
window.UI = UI;
window.App = App;
window.LoginUI = LoginUI;
window.Mobility = Mobility;
window.Timer = Timer;

document.addEventListener('DOMContentLoaded', () => App.init());
