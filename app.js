'use strict';

/* ============================================================
   RABIX V4 — Application Engine
   DB · UserSystem · Planner · Fatigue · Objectives · UI
   ============================================================ */

/* ══════════════════════════════════════════════════
   SUPABASE CONFIG
══════════════════════════════════════════════════ */
const SUPA_URL = 'https://aancggpevlxvaevoerzb.supabase.co';
const SUPA_KEY = 'sb_publishable_4ASCJuvHJVAMjeJvcmrqvw_We2I1e9c';
const SUPA_HEADERS = {
    'Content-Type': 'application/json',
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Prefer': 'return=minimal'
};

const Supa = {
    async _req(method, path, body) {
        try {
            const opts = { method, headers: { ...SUPA_HEADERS } };
            if (body) opts.body = JSON.stringify(body);
            const r = await fetch(SUPA_URL + '/rest/v1/' + path, opts);
            if (!r.ok) {
                const err = await r.text();
                console.warn('Supa error:', r.status, err);
                return null;
            }
            const text = await r.text();
            return text ? JSON.parse(text) : true;
        } catch (e) {
            console.warn('Supa offline:', e.message);
            return null;
        }
    },
    get(path)         { return this._req('GET', path); },
    post(path, body)  { return this._req('POST', path, body); },
    patch(path, body) { return this._req('PATCH', path, body); },
    del(path)         { return this._req('DELETE', path); },

    // Upsert: insert or update on conflict
    async upsert(table, body, onConflict) {
        try {
            const opts = {
                method: 'POST',
                headers: {
                    ...SUPA_HEADERS,
                    'Prefer': `resolution=merge-duplicates,return=minimal`
                },
                body: JSON.stringify(body)
            };
            const url = SUPA_URL + '/rest/v1/' + table +
                (onConflict ? `?on_conflict=${onConflict}` : '');
            const r = await fetch(url, opts);
            if (!r.ok) { console.warn('Supa upsert error:', r.status, await r.text()); return null; }
            return true;
        } catch (e) {
            console.warn('Supa upsert offline:', e.message);
            return null;
        }
    }
};

/* ══════════════════════════════════════════════════
   DB MODULE  (localStorage primario + Supabase sync)
══════════════════════════════════════════════════ */
const DB = (() => {
    let _prefix = 'rabix_default_';
    let _userId = null;

    function setUser(userId) { _prefix = `rabix_${userId}_`; _userId = userId; }
    function resetUser()     { _prefix = 'rabix_default_'; _userId = null; }
    function _key(k)         { return _prefix + k; }

    const K = { REGISTRO: 'registro', OVERRIDES: 'overrides', PENDING: 'supa_pending' };

    function _get(k)    { try { return JSON.parse(localStorage.getItem(_key(k))) || []; }  catch { return []; } }
    function _set(k, d) { localStorage.setItem(_key(k), JSON.stringify(d)); }
    function _getObj(k) { try { return JSON.parse(localStorage.getItem(_key(k))) || {}; } catch { return {}; } }

    /* ── Cola offline ── */
    function _enqueuePending(op) {
        const q = _get(K.PENDING);
        q.push({ ...op, _ts: Date.now() });
        _set(K.PENDING, q);
    }

    /* ── Guardar serie ── */
    function saveSet(entry) {
        const reg  = _get(K.REGISTRO);
        const saved = { ...entry, id: Date.now(), ts: new Date().toISOString(), sync_status: 'pending' };
        reg.push(saved);
        _set(K.REGISTRO, reg);
        _enqueuePending({ type: 'log', data: saved });
        // Intentar sync inmediato (fire & forget)
        _syncLog(saved);
    }

    async function _syncLog(entry) {
        if (!_userId) return;
        const row = {
            user_id:       _userId,
            local_id:      String(entry.id),
            fecha:         entry.fecha,
            cod:           entry.cod ?? null,
            escenario:     entry.scenario || entry.escenario || null,
            peso:          entry.peso   ?? 0,
            series:        entry.series ?? 1,
            reps:          entry.reps   ?? 0,
            rpe:           entry.rpe    ?? 0,
            rir:           entry.rir    ?? null,
            dolor:         entry.dolor  ?? 0,
            vol_total:     entry.vol_total ?? 0,
            minutos:       entry.minutos   ?? null,
            hr_avg:        entry.hr_avg    ?? null,
            hr_max:        entry.hr_max    ?? null,
            zone:          entry.zone      ?? null,
            zone_pct:      entry.zone_pct  ?? null,
            pace:          entry.pace      ?? null,
            notes:         entry.notes     ?? null,
            session_rpe:   entry.session_rpe   ?? false,
            carga_interna: entry.carga_interna ?? null,
        };
        const ok = await Supa.upsert('training_logs', row, 'user_id,local_id');
        if (ok) {
            // Marcar como synced en local
            const reg = _get(K.REGISTRO);
            const idx = reg.findIndex(e => String(e.id) === String(entry.id));
            if (idx >= 0) { reg[idx].sync_status = 'synced'; _set(K.REGISTRO, reg); }
            // Limpiar de cola pending
            const q = _get(K.PENDING).filter(p => !(p.type === 'log' && p.data.id === entry.id));
            _set(K.PENDING, q);
        }
    }

    /* ── Guardar override ── */
    function saveOverride(fecha, escenario) {
        const ov = _getObj(K.OVERRIDES);
        ov[fecha] = escenario;
        _set(K.OVERRIDES, ov);
        _enqueuePending({ type: 'override', data: { fecha, escenario } });
        _syncOverride(fecha, escenario);
    }

    async function _syncOverride(fecha, escenario) {
        if (!_userId) return;
        await Supa.upsert('session_overrides',
            { user_id: _userId, fecha, escenario },
            'user_id,fecha'
        );
    }

    function getRegistro()  { return _get(K.REGISTRO); }
    function clearRegistro() {
        _set(K.REGISTRO, []);
        // Borrar en Supabase también
        if (_userId) Supa.del(`training_logs?user_id=eq.${_userId}`);
    }
    function getOverride(fecha) { return _getObj(K.OVERRIDES)[fecha] || null; }
    function hasTodayEntries() {
        const hoy = new Date().toISOString().split('T')[0];
        return getRegistro().some(e => e.fecha === hoy);
    }

    /* ── Flush: reintentar todo lo pendiente offline ── */
    async function flushPending() {
        const q = _get(K.PENDING);
        if (!q.length) return { ok: true, sent: 0 };
        let sent = 0;
        for (const op of q) {
            if (op.type === 'log')      await _syncLog(op.data)      && sent++;
            if (op.type === 'override') await _syncOverride(op.data.fecha, op.data.escenario) && sent++;
        }
        return { ok: true, sent };
    }

    /* ── Pull: cargar historial desde Supabase al iniciar sesión ── */
    async function pullFromCloud(userId) {
        if (!userId) return;
        try {
            // Logs
            const logs = await Supa.get(
                `training_logs?user_id=eq.${userId}&order=created_at.asc&limit=2000`
            );
            if (Array.isArray(logs) && logs.length) {
                const local = _get(K.REGISTRO);
                const localIds = new Set(local.map(e => String(e.id)));
                const newEntries = logs
                    .filter(r => !localIds.has(String(r.local_id)))
                    .map(r => ({
                        id:            parseInt(r.local_id) || r.id,
                        ts:            r.created_at,
                        fecha:         r.fecha,
                        cod:           r.cod,
                        scenario:      r.escenario,
                        escenario:     r.escenario,
                        peso:          r.peso,
                        series:        r.series,
                        reps:          r.reps,
                        rpe:           r.rpe,
                        rir:           r.rir,
                        dolor:         r.dolor,
                        vol_total:     r.vol_total,
                        minutos:       r.minutos,
                        notes:         r.notes,
                        session_rpe:   r.session_rpe,
                        carga_interna: r.carga_interna,
                        sync_status:   'synced'
                    }));
                if (newEntries.length) {
                    const merged = [...local, ...newEntries]
                        .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
                    _set(K.REGISTRO, merged);
                    console.log(`RABIX: ${newEntries.length} entradas sincronizadas desde la nube.`);
                }
            }
            // Overrides
            const overrides = await Supa.get(
                `session_overrides?user_id=eq.${userId}`
            );
            if (Array.isArray(overrides) && overrides.length) {
                const ov = _getObj(K.OVERRIDES);
                overrides.forEach(r => { ov[r.fecha] = r.escenario; });
                _set(K.OVERRIDES, ov);
            }
        } catch(e) {
            console.warn('RABIX: pull desde nube falló:', e.message);
        }
    }

    // Exponer flushSyncQueue como alias para compatibilidad
    async function flushSyncQueue() { return flushPending(); }

    return {
        setUser, resetUser, saveSet, getRegistro, clearRegistro,
        saveOverride, getOverride, hasTodayEntries,
        flushPending, flushSyncQueue, pullFromCloud
    };
})();

/* ══════════════════════════════════════════════════
   USER SYSTEM
══════════════════════════════════════════════════ */
const UserSystem = (() => {
    const USERS_KEY = 'rabix_global_users';
    const SESSION_KEY = 'rabix_uid';
    function getAllUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch { return []; } }
    function saveUsers(list) {
        localStorage.setItem(USERS_KEY, JSON.stringify(list));
        // Sync cada usuario a Supabase (sin bloquear)
        list.forEach(u => _syncUser(u));
    }

    async function _syncUser(u) {
        await Supa.upsert('users', {
            id:        u.id,
            name:      u.name,
            full_name: u.fullName  || null,
            email:     u.email     || null,
            telefono:  u.telefono  || null,
            emoji:     u.emoji     || '⚡',
            objetivo:  u.objetivo  || 'ALTO_RENDIMIENTO',
            role:      u.role      || 'student',
            status:    u.status    || 'active',
            password:  u.password  || null,
            onboarding: u.onboarding || null,
        }, 'id');
    }
    function getCurrentUserId() { return localStorage.getItem(SESSION_KEY) || null; }
    function clearSession() { localStorage.removeItem(SESSION_KEY); }
    function getCurrentUser() {
        const id = getCurrentUserId();
        return id ? getAllUsers().find(u => u.id === id) || null : null;
    }
    function setCurrentUser(id) { localStorage.setItem(SESSION_KEY, id); DB.setUser(id); }
    function hasUsers() { return getAllUsers().length > 0; }

    function initAdmin() {
        const list = getAllUsers();
        const existing = list.find(u => u.name.toLowerCase() === 'goking');
        
        // Data Migration logic
        const oldId = 'admin_gantelo';
        const newId = 'admin_goking';
        const keysToMigrate = ['registro', 'overrides', 'custom_ex'];
        
        keysToMigrate.forEach(k => {
            const oldKey = `rabix_${oldId}_${k}`;
            const newKey = `rabix_${newId}_${k}`;
            if (localStorage.getItem(oldKey) && !localStorage.getItem(newKey)) {
                localStorage.setItem(newKey, localStorage.getItem(oldKey));
                console.log(`RABIX: Migración de datos (${k}) completada.`);
            }
        });

        if (!existing) {
            const cleaned = list.filter(u => u.id !== oldId);
            const admin = {
                id: newId,
                name: 'Goking',
                fullName: 'Gonzalo Antelo',
                email: 'gonchiantelo05@gmail.com',
                telefono: '098650964',
                password: 'G2026',
                emoji: '👨‍💼',
                objetivo: 'ALTO_RENDIMIENTO',
                role: 'admin',
                status: 'active',
                created: new Date().toISOString(),
                onboarding: { frecuencia: '5', dias: '5', nivel: 'avanzado', lugar: 'gimnasio', equipamiento: 'completo' }
            };
            cleaned.push(admin);
            saveUsers(cleaned);
        } else {
            // Update fields to ensure they match the plan
            let changed = false;
            const updates = {
                password: 'G2026',
                email: 'gonchiantelo05@gmail.com',
                telefono: '098650964',
                fullName: 'Gonzalo Antelo',
                status: 'active',
                role: 'admin',
                id: newId
            };
            for (const [k, v] of Object.entries(updates)) {
                if (existing[k] !== v) { existing[k] = v; changed = true; }
            }
            if (changed) saveUsers(list);
            
            // Inject History if missing (Registration until 17/03/2026)
            injectGokingHistory(newId);
        }
    }

    function injectGokingHistory(userId) {
        const key = `rabix_${userId}_registro`;
        if (localStorage.getItem(key)) return; // Only if empty
        
        const history = [
            // 15/03/2026 - PARTIDO
            { cod: 9, fecha: '2026-03-15', scenario: 'PARTIDO', peso: 0, series: 1, reps: 0, rpe: 9, vol_total: 0, ts: '2026-03-15T18:00:00.000Z' },
            // 16/03/2026 - RECUPERACION (Today in image logic)
            { cod: 28, fecha: '2026-03-16', scenario: 'RECUPERACION', peso: 0, series: 3, reps: 1, rpe: 4, vol_total: 0, ts: '2026-03-16T17:00:00.000Z' },
            { cod: 9, fecha: '2026-03-16', scenario: 'RECUPERACION', peso: 20, series: 2, reps: 10, rpe: 5, vol_total: 400, ts: '2026-03-16T17:15:00.000Z' },
            { cod: 7, fecha: '2026-03-16', scenario: 'RECUPERACION', peso: 15, series: 2, reps: 10, rpe: 5, vol_total: 300, ts: '2026-03-16T17:30:00.000Z' },
            { cod: 24, fecha: '2026-03-16', scenario: 'RECUPERACION', peso: 30, series: 2, reps: 15, rpe: 5, vol_total: 900, ts: '2026-03-16T17:45:00.000Z' },
            { cod: 34, fecha: '2026-03-16', scenario: 'RECUPERACION', peso: 0, series: 1, reps: 0, rpe: 5, vol_total: 0, notes: 'Cardio', ts: '2026-03-16T18:00:00.000Z' },
            // 17/03/2026 - FUERZA TREN SUP
            { cod: 1, fecha: '2026-03-17', scenario: 'FUERZA_TREN_SUP', peso: 65, series: 3, reps: 8, rpe: 8, vol_total: 1560, ts: '2026-03-17T17:00:00.000Z' },
            { cod: 14, fecha: '2026-03-17', scenario: 'FUERZA_TREN_SUP', peso: 35, series: 2, reps: 12, rpe: 6, vol_total: 840, ts: '2026-03-17T17:20:00.000Z' },
            { cod: 3, fecha: '2026-03-17', scenario: 'FUERZA_TREN_SUP', peso: 20, series: 2, reps: 12, rpe: 7, vol_total: 480, ts: '2026-03-17T17:40:00.000Z' },
            { cod: 19, fecha: '2026-03-17', scenario: 'FUERZA_TREN_SUP', peso: 0, series: 3, reps: 10, rpe: 8, vol_total: 0, ts: '2026-03-17T18:00:00.000Z' },
            // 18/03/2026 - HIPERTROFIA INF
            { cod: 9,  fecha: '2026-03-18', scenario: 'HIPERTROFIA_INF', peso: 20, series: 3, reps: 12, rpe: 7, vol_total: 720,  ts: '2026-03-18T17:00:00.000Z' },
            { cod: 10, fecha: '2026-03-18', scenario: 'HIPERTROFIA_INF', peso: 40, series: 3, reps: 10, rpe: 8, vol_total: 1200, ts: '2026-03-18T17:30:00.000Z' },
            // 19/03/2026 - JUEVES — HIPERTROFIA_SUP (Pectoral/Espalda)
            { cod: 13, fecha: '2026-03-19', scenario: 'HIPERTROFIA_SUP', peso: 50, series: 4, reps: 10, rpe: 7, vol_total: 2000, ts: '2026-03-19T17:00:00.000Z' },
            { cod: 5,  fecha: '2026-03-19', scenario: 'HIPERTROFIA_SUP', peso: 25, series: 3, reps: 12, rpe: 7, vol_total: 900,  ts: '2026-03-19T17:20:00.000Z' },
            { cod: 15, fecha: '2026-03-19', scenario: 'HIPERTROFIA_SUP', peso: 55, series: 3, reps: 10, rpe: 7, vol_total: 1650, ts: '2026-03-19T17:40:00.000Z' },
            { cod: 17, fecha: '2026-03-19', scenario: 'HIPERTROFIA_SUP', peso: 55, series: 3, reps: 12, rpe: 7, vol_total: 1980, ts: '2026-03-19T18:00:00.000Z' },
            { cod: 30, fecha: '2026-03-19', scenario: 'HIPERTROFIA_SUP', peso: 5,  series: 3, reps: 8,  rpe: 8, vol_total: 120,  ts: '2026-03-19T18:20:00.000Z' },
            { cod: 24, fecha: '2026-03-19', scenario: 'HIPERTROFIA_SUP', peso: 15, series: 3, reps: 15, rpe: 6, vol_total: 675,  ts: '2026-03-19T18:40:00.000Z' },
            // 20/03/2026 - VIERNES — PREVENCION
            { cod: 24, fecha: '2026-03-20', scenario: 'PREVENCION', peso: 15, series: 3, reps: 15, rpe: 6, vol_total: 675,  ts: '2026-03-20T17:00:00.000Z' },
            { cod: 22, fecha: '2026-03-20', scenario: 'PREVENCION', peso: 8,  series: 3, reps: 15, rpe: 5, vol_total: 360,  ts: '2026-03-20T17:20:00.000Z' },
            { cod: 28, fecha: '2026-03-20', scenario: 'PREVENCION', peso: 0,  series: 3, reps: 10, rpe: 5, vol_total: 0,    ts: '2026-03-20T17:40:00.000Z' },
            { cod: 27, fecha: '2026-03-20', scenario: 'PREVENCION', peso: 0,  series: 3, reps: 1,  rpe: 6, vol_total: 0,    ts: '2026-03-20T18:00:00.000Z' },
            { cod: 34, fecha: '2026-03-20', scenario: 'PREVENCION', peso: 0,  series: 1, reps: 1,  rpe: 5, vol_total: 0,    notes: 'Trote 20 min', ts: '2026-03-20T18:20:00.000Z' },
        ];
        
        localStorage.setItem(key, JSON.stringify(history.map(h => ({
            ...h,
            id: Date.now() + Math.random(),
            vol_total: (h.peso || 0) * (parseInt(h.series) || 1) * (parseInt(h.reps) || 1)
        }))));
        console.log('RABIX: Historial de Goking inyectado.');
    }

    function login(username, password) {
        const list = getAllUsers();
        const user = list.find(u => u.name.toLowerCase() === (username || '').toLowerCase().trim());
        if (user) {
            // If password is required and user has one, check it.
            // For now, if user doesn't have a password yet (legacy), we allow it.
            if (user.password && user.password !== password) return null;
            setCurrentUser(user.id);
            return user;
        }
        return null;
    }

    function createUser(name, password, emoji, objetivo, email, telefono) {
        try {
            const list = getAllUsers();
            // Validate uniqueness
            if (list.find(u => u.name.toLowerCase() === name.trim().toLowerCase())) {
                throw new Error('Ese nombre de usuario ya está registrado.');
            }
            // Email y teléfono son opcionales — solo validar duplicados si se proporcionan
            if (email && list.find(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
                throw new Error('Ese email ya está registrado.');
            }
            if (telefono && list.find(u => u.telefono && u.telefono === telefono.trim())) {
                throw new Error('Ese teléfono ya está registrado.');
            }
            const id = 'u' + Date.now();
            const user = {
                id,
                name: name.trim(),
                password: password || '',
                email: (email || '').trim(),
                telefono: (telefono || '').trim(),
                emoji: emoji || '⚡',
                objetivo: objetivo || 'ALTO_RENDIMIENTO',
                role: 'student',
                created: new Date().toISOString(),
                status: 'active',
                onboarding: null
            };
            list.push(user);
            saveUsers(list);
            console.log('RABIX: Usuario creado OK', user);
            return user;
        } catch (err) {
            console.error('RABIX ERROR EN CREATEUSER:', err);
            alert('Error: ' + err.message);
            throw err;
        }
    }
    function deleteUser(userId) {
        let list = getAllUsers();
        list = list.filter(u => u.id !== userId);
        saveUsers(list);
        if (getCurrentUserId() === userId) {
            localStorage.removeItem(SESSION_KEY);
        }
    }
    function updateUserObjetivo(userId, objetivo) {
        const list = getAllUsers();
        const u = list.find(u => u.id === userId);
        if (u) { u.objetivo = objetivo; saveUsers(list); }
    }
    function _generatePlan(objetivoId) {
        const user = UserSystem.getCurrentUser();
        const onboarding = user?.onboarding;

        const obj = OBJETIVOS_DISPONIBLES.find(o => o.id === objetivoId) || Translator.getObjetivoById(objetivoId);
        // Use the global generator from data.js
        let plan = window._generatePlan ? window._generatePlan(objetivoId) : [];
        if (!plan.length) return [];

        // Adaptación según onboarding (orientada a adherencia y carga sostenible)
        if (onboarding) {
            const lvl = onboarding.nivel || 'intermedio';
            const freq7d = parseInt(onboarding.frecuenciaUlt7d || onboarding.frecuencia || '3', 10);
            const preferredMatchDow = parseInt(onboarding.diaPartido || '-1', 10);
            const preferredRestDow = parseInt(onboarding.diaDescanso || '-1', 10);

            if (freq7d <= 1) {
                plan = plan.map(s => {
                    if (s.semana > 2 || !Array.isArray(s.ejs_cods)) return s;
                    const adjusted = s.ejs_cods.map(ex => {
                        if (typeof ex !== 'object') return ex;
                        const nSeries = Math.max(2, Math.round((parseInt(ex.series || '3', 10)) * 0.8));
                        return { ...ex, series: nSeries };
                    });
                    return { ...s, ejs_cods: adjusted };
                });
            }

            if (lvl === 'principiante') {
                plan = plan.map(s => {
                    if (!Array.isArray(s.ejs_cods)) return s;
                    const adjusted = s.ejs_cods.map(ex => {
                        if (typeof ex !== 'object') return ex;
                        const nSeries = Math.max(2, Math.round((parseInt(ex.series || '3', 10)) * 0.85));
                        return { ...ex, series: nSeries };
                    });
                    return { ...s, ejs_cods: adjusted };
                });
            }

            if (obj.moduloDeportivo === 'equipo') {
                plan = plan.map(s => {
                    const dow = new Date(s.fecha + 'T12:00:00').getDay();
                    let escenario = s.escenario;
                    if (preferredMatchDow >= 0 && dow === preferredMatchDow) escenario = 'PARTIDO';
                    if (preferredRestDow >= 0 && dow === preferredRestDow) escenario = 'DESCANSO';
                    if (escenario === s.escenario) return s;
                    const ejs = [...(ESCENARIOS[escenario]?.ejercicios || [])].map(c => ({ cod: c, series: 3, reps: '8-12' }));
                    return { ...s, escenario, ejs_cods: ejs };
                });
            }
        }

        return applyProMicrocycle(plan, objetivoId, user);
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
        localStorage.setItem('rabix_' + uid + '_custom_ex', JSON.stringify(all));
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
        const user = getCurrentUser();
        return user ? user.objetivo : 'ALTO_RENDIMIENTO';
    }
    function isProUser(user) {
        const u = user || getCurrentUser();
        if (!u) return false;
        return u.role === 'admin' || u.id === 'admin_goking' || (u.name || '').toLowerCase() === 'goking';
    }
    function applyProMicrocycle(plan, objetivoId, user) {
        if (!isProUser(user)) return plan;
        if (!['ALTO_RENDIMIENTO', 'FUTBOL_PRO', 'FUTBOL_SEMI', 'FUTBOL_AMATEUR'].includes(objetivoId)) return plan;
        return (plan || []).map(s => {
            const dow = new Date(s.fecha + 'T12:00:00').getDay();
            let escenario = s.escenario;
            if (dow === 1) escenario = 'RECUPERACION';
            if (dow === 2) escenario = 'FUERZA_PIERNA_B';
            if (dow === 3) escenario = 'HIPERTROFIA_INF';
            if (dow === 4) escenario = 'PREVENCION';
            if (dow === 5) escenario = 'TECNICA';
            if (dow === 6) escenario = 'DESCANSO';
            if (dow === 0) escenario = 'PARTIDO';
            return { ...s, escenario, ejs_cods: [...(ESCENARIOS[escenario]?.ejercicios || [])].map(c => ({ cod: c, series: 3, reps: dow === 5 ? '6-8' : '8-12' })) };
        });
    }

    window.UserSystem = {
        getAllUsers, getCurrentUser, getCurrentUserId, setCurrentUser, hasUsers, createUser,
        updateUserObjetivo, getCustomExercises, addCustomExercise, getAllExercises,
        getUserStats, getCurrentObjetivo, initAdmin, login, saveUsers, _generatePlan, isProUser, applyProMicrocycle, clearSession
    };
    return window.UserSystem;
})();

/* ══════════════════════════════════════════════════
   TRANSLATOR
══════════════════════════════════════════════════ */
window.Translator = {
    getByCode(cod) { return UserSystem.getAllExercises().find(e => e.cod === cod) || null; },
    getName(cod) { const e = this.getByCode(cod); return e ? e.nombre : `Ejercicio #${cod}`; },
    getGroup(cod) { const e = this.getByCode(cod); return e ? e.grupo : '—'; },
    getFatiga(cod) { const e = this.getByCode(cod); return e ? e.fatiga : 1; },
    getObjetivoById(id) { return OBJETIVOS_DISPONIBLES.find(o => o.id === id) || OBJETIVOS_DISPONIBLES[0]; },
    getSessionByDate(date, plan) { return plan.find(s => s.fecha === date); },
    getFaseForObjetivo(semana, objetivoId) {
        const obj = this.getObjetivoById(objetivoId);
        const fase = obj.fases.find(f => semana >= f.semanas[0] && semana <= f.semanas[1]);
        return fase ? fase.nombre : 'FASE DESCONOCIDA';
    },
    generatePlan(objetivoId) {
        // Use the context-aware generator from UserSystem
        return UserSystem._generatePlan ? UserSystem._generatePlan(objetivoId) : [];
    },
    getPlanRaw() {
        const objetivoId = UserSystem.getCurrentObjetivo();
        return this.generatePlan(objetivoId);
    },
    getMobility() { return MOVILIDAD_ARTICULAR; }
};

/* ══════════════════════════════════════════════════
   PLANNER — objective-aware
══════════════════════════════════════════════════ */
window.Planner = {
    _plan: null,
    _objetivoId: null,

    init(objetivoId) {
        this._objetivoId = objetivoId || 'ALTO_RENDIMIENTO';
        this._plan = Translator.generatePlan(this._objetivoId);
    },

    getPlan() {
        if (!this._plan) this.init(UserSystem.getCurrentObjetivo());
        return this._plan;
    },
    getPlanForCurrentObjetivo() {
        const obj = UserSystem.getCurrentObjetivo();
        return Translator.generatePlan(obj);
    },

    getTodaySession() {
        const hoy = this.todayStr();
        let session = Translator.getSessionByDate(hoy, this.getPlan())
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
        if (!this.getPlan()) return [];
        const startIdx = (semana - 1) * 7;
        return this.getPlan().slice(startIdx, startIdx + 7);
    },

    getFaseActual(semana) {
        return Translator.getFaseForObjetivo(semana, UserSystem.getCurrentObjetivo());
    },

    getTotalSemanas() {
        return Translator.getObjetivoById(UserSystem.getCurrentObjetivo()).duracionSemanas;
    },

    getSemanaActual() {
        const hoy = this.todayStr();
        const s = Translator.getSessionByDate(hoy, this.getPlan());
        return s ? s.semana : 1;
    },

    todayStr() { return new Date().toISOString().split('T')[0]; },
};

/* ══════════════════════════════════════════════════
   WEIGHT ENGINE
══════════════════════════════════════════════════ */
window.WeightEngine = {
    getLastWeight(cod) {
        const entries = DB.getRegistro().filter(e => e.cod === cod).sort((a, b) => b.ts.localeCompare(a.ts));
        return entries.length ? entries[0].peso : null;
    },
    getInitialWeight(cod) { return PESOS_INICIALES[cod] ?? 0; },
    getSuggestedWeight(cod) {
        const last = this.getLastWeight(cod);
        return last !== null ? last : this.getInitialWeight(cod);
    }
};

/* ══════════════════════════════════════════════════
   FATIGUE ENGINE
══════════════════════════════════════════════════ */
window.FatigueEngine = {
    _rpeYellow: 7.1,
    _rpeRed: 8.5,

    setThresholds(objetivoId) {
        const obj = Translator.getObjetivoById(objetivoId);
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

    /* ── 3-Day Carga Accumulation (God Mode) ── */
    getLast3DaysCarga() {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 3);
        const co = cutoff.toISOString().split('T')[0];
        const entries = DB.getRegistro().filter(e => e.fecha >= co);
        return entries.reduce((sum, e) => sum + SportModules.calcInternalLoadFromEntry(e), 0);
    },

    getFatigueLimit() {
        const obj = Translator.getObjetivoById(UserSystem.getCurrentObjetivo());
        const uid = UserSystem.getCurrentUserId();
        const stored = uid ? localStorage.getItem(`rabix_${uid}_fatigue_limit`) : null;
        if (stored) return parseFloat(stored);
        const onboarding = UserSystem.getCurrentUser()?.onboarding || {};
        const sessionMin = parseInt(onboarding.duracionSesion || '60', 10);
        const rec = onboarding.recuperacion || 'media';
        const recFactor = rec === 'alta' ? 1.1 : rec === 'baja' ? 0.85 : 1;
        return obj.rpeYellow * sessionMin * 3 * recFactor;
    },

    shouldAutoMutate() {
        const carga3d = this.getLast3DaysCarga();
        const limit = this.getFatigueLimit();
        return carga3d > limit;
    },
    getTrafficLightStatus() {
        const carga3d = this.getLast3DaysCarga();
        const limit = this.getFatigueLimit();
        const isYellow = carga3d > limit;
        return { color: isYellow ? 'yellow' : 'green', carga3d, limit, pct: limit > 0 ? Math.round((carga3d / limit) * 100) : 0 };
    },
    applyAutoRecoveryOverride() {
        if (!this.shouldAutoMutate()) return false;
        const tomorrow = new Date(Planner.todayStr() + 'T12:00:00');
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextDate = tomorrow.toISOString().split('T')[0];
        DB.saveOverride(nextDate, 'RECUPERACION_FACILITADA');
        return true;
    },

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
   SPORT MODULES ENGINE
══════════════════════════════════════════════════ */
window.SportModules = {
    calcInternalLoad(rpe, minutes) {
        const safeRpe = Number(rpe) || 0;
        const safeMin = Number(minutes) || 0;
        return Math.round(safeRpe * safeMin);
    },
    calcInternalLoadFromEntry(entry) {
        const minutes = entry?.minutos || ((Number(entry?.series) || 0) * 5);
        return this.calcInternalLoad(entry?.rpe || 0, minutes);
    },
    /* ── Team Sports (Equipo) ── */
    equipo: {
        calcCargaInterna(rpe, minutes) { return SportModules.calcInternalLoad(rpe, minutes); },
        getMorfocicloData(registro, plan) {
            const hoy = new Date();
            const result = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(hoy); d.setDate(d.getDate() - i);
                const str = d.toISOString().split('T')[0];
                const dow = d.getDay();
                const dayEntries = registro.filter(e => e.fecha === str);
                let carga = 0;
                dayEntries.forEach(e => { carga += SportModules.calcInternalLoadFromEntry(e); });
                const pattern = MORFOCICLO_PATTERNS[dow] || MORFOCICLO_PATTERNS[0];
                result.push({ fecha: str, dow, carga, label: pattern.label, intensidad: pattern.intensidad, color: pattern.color, isMax: false });
            }
            const maxCarga = Math.max(0, ...result.map(r => r.carga));
            result.forEach(r => { r.isMax = maxCarga > 0 && r.carga === maxCarga; });
            return result;
        },
    },
    /* ── Strength / Hypertrophy (Fuerza) ── */
    fuerza: {
        calcTonelaje(series, reps, peso) { return Math.round(series * reps * peso); },
        checkRIRProgression(cod, rir) {
            if (rir >= RIR_PROGRESSION_THRESHOLD) {
                const lastWeight = WeightEngine.getSuggestedWeight(cod);
                return { suggest: true, newWeight: lastWeight > 0 ? lastWeight + 2.5 : 0 };
            }
            return { suggest: false, newWeight: WeightEngine.getSuggestedWeight(cod) };
        },
        shouldIncreaseLoad(cod) {
            const entries = DB.getRegistro()
                .filter(e => e.cod === cod && e.rir !== undefined && e.rir !== null)
                .sort((a, b) => b.ts.localeCompare(a.ts));
            if (!entries.length) return false;
            return Number(entries[0].rir) >= RIR_PROGRESSION_THRESHOLD;
        },
    },
    /* ── Endurance (Resistencia) ── */
    resistencia: {
        calcZones(avgHR, fcMax) {
            if (!fcMax || !avgHR) return null;
            const pct = (avgHR / fcMax) * 100;
            const zone = ZONAS_ENTRENAMIENTO.find(z => pct >= z.min && pct < z.max) || ZONAS_ENTRENAMIENTO[ZONAS_ENTRENAMIENTO.length - 1];
            return { zone, pct: Math.round(pct) };
        },
        calcPace(distanceKm, timeMin) {
            if (!distanceKm || !timeMin) return null;
            const pace = timeMin / distanceKm;
            const mins = Math.floor(pace);
            const secs = Math.round((pace - mins) * 60);
            return `${mins}:${String(secs).padStart(2, '0')} /km`;
        },
    },
    /* ── Get current module type ── */
    getCurrentModule() {
        const obj = Translator.getObjetivoById(UserSystem.getCurrentObjetivo());
        return obj.moduloDeportivo || 'fuerza';
    },
};


/* ══════════════════════════════════════════════════
   PAIN ENGINE — Motor de dolor global
══════════════════════════════════════════════════ */
window.PainEngine = {
    /*
     * PAIN ENGINE v2 — Lógica clínica con decay temporal
     *
     * Principios:
     * 1. DECAY: el dolor de hoy pesa más que el de hace 5 días.
     *    Hoy=1.0 · Ayer=0.85 · 2d=0.70 · 3d=0.55 · 4d=0.40 · 5-7d=0.20
     *
     * 2. FUENTES COMBINADAS: series de ejercicio (campo dolor) +
     *    reportes manuales (dolor_grupo explícito). Los manuales tienen
     *    prioridad porque son más específicos.
     *
     * 3. NIVEL EFECTIVO = nivel_raw × decay_factor
     *    Si hay múltiples entradas del mismo grupo, se toma el máximo efectivo.
     *
     * 4. UMBRALES DE DECISIÓN:
     *    efectivo < 2  → Sin restricción
     *    efectivo 2-3  → Monitorear (sin ajuste de carga)
     *    efectivo 4-5  → Moderado → −20% de carga
     *    efectivo 6-7  → Alto     → −40% de carga
     *    efectivo ≥ 8  → Agudo    → No realizar / sustituir
     */

    _DECAY: [1.0, 0.85, 0.70, 0.55, 0.40, 0.20, 0.20],

    _grupoMap: {
        'Piernas':         ['Piernas', 'Core'],
        'Pectoral':        ['Pectoral', 'Brazos'],
        'Espalda':         ['Espalda', 'Brazos'],
        'Brazos':          ['Brazos'],
        'Hombros':         ['Brazos', 'Hombros'],
        'Espalda/Hombro':  ['Espalda', 'Brazos'],
        'Core':            ['Core'],
        'Global':          [],
        'Aeróbico':        [],
        'Campo':           ['Piernas'],
        'Rodilla':         ['Piernas'],
        'Tobillo':         ['Piernas'],
        'Cuello':          ['Espalda'],
    },

    _diasDesde(fecha) {
        const hoy = new Date(Planner.todayStr() + 'T12:00:00');
        const d   = new Date(fecha + 'T12:00:00');
        return Math.max(0, Math.round((hoy - d) / 86400000));
    },

    // Mapa de dolor efectivo por grupo (con decay aplicado)
    getDolorPorGrupo() {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
        const co = cutoff.toISOString().split('T')[0];
        const entries = DB.getRegistro().filter(e => e.fecha >= co && (e.dolor > 0 || e.dolor_grupo));
        const dolorMap = {};

        entries.forEach(e => {
            const dias   = this._diasDesde(e.fecha);
            const decay  = this._DECAY[Math.min(dias, this._DECAY.length - 1)];
            const nivel  = e.dolor || 0;
            const efectivo = +(nivel * decay).toFixed(1);
            if (efectivo < 2) return; // umbral mínimo — ruido

            // Fuente 1: reporte manual (dolor_grupo explícito)
            if (e.dolor_grupo) {
                const g = e.dolor_grupo;
                if (!dolorMap[g] || dolorMap[g].efectivo < efectivo) {
                    dolorMap[g] = { efectivo, raw: nivel, dias, manual: true };
                }
                return;
            }

            // Fuente 2: dolor registrado en una serie de ejercicio
            const ej = Translator.getByCode(e.cod);
            if (!ej || !ej.grupo) return;
            const grupo = ej.grupo;
            if (!dolorMap[grupo] || dolorMap[grupo].efectivo < efectivo) {
                dolorMap[grupo] = { efectivo, raw: nivel, dias, manual: false };
            }
        });

        return dolorMap;
    },

    getMaxDolor() {
        const map = this.getDolorPorGrupo();
        const vals = Object.values(map).map(v => v.efectivo);
        return vals.length ? Math.max(...vals) : 0;
    },

    getDolorParaEjercicio(cod) {
        const ej = Translator.getByCode(cod);
        if (!ej) return 0;
        const map    = this.getDolorPorGrupo();
        const grupos = this._grupoMap[ej.grupo] || [ej.grupo];
        return Math.max(0, ...grupos.map(g => map[g]?.efectivo || 0));
    },

    getAjusteCarga(dolorEfectivo) {
        if (dolorEfectivo >= 8) return { factor: 0,   label: '🚫 No realizar — sustituir por movilidad', color: 'var(--red)',    skip: true };
        if (dolorEfectivo >= 6) return { factor: 0.6, label: '⚠️ −40% de carga recomendado',            color: 'var(--red)',    skip: false };
        if (dolorEfectivo >= 4) return { factor: 0.8, label: '🟡 −20% de carga recomendado',            color: 'var(--yellow)', skip: false };
        if (dolorEfectivo >= 2) return { factor: 1.0, label: '👁 Monitorear — sin ajuste de carga',     color: 'var(--text-3)', skip: false, monitorOnly: true };
        return null;
    },

    getSummary() {
        const map    = this.getDolorPorGrupo();
        const alerts = Object.entries(map)
            .map(([grupo, data]) => ({ grupo, ...data }))
            .filter(d => d.efectivo >= 2)
            .sort((a, b) => b.efectivo - a.efectivo);
        return { max: this.getMaxDolor(), alerts, hasAlert: alerts.length > 0 };
    },

    // Guardar reporte — funciona desde cualquier contexto
    reportarDolor(grupo, nivel, notas = '', ejercicioCod = null) {
        const entry = {
            cod:        ejercicioCod || 0,
            fecha:      Planner.todayStr(),
            peso: 0, series: 1, reps: 1, rpe: 0,
            dolor:      nivel,
            dolor_grupo: grupo,
            notes:      notas || ('🩺 Dolor ' + grupo + ': ' + nivel + '/10'),
            vol_total:  0,
            sesion_num: 0,
            ts:         new Date().toISOString(),
        };
        DB.saveSet(entry);
    },

    // Etiqueta de antigüedad para mostrar en UI
    getEdadLabel(dias) {
        if (dias === 0) return 'Hoy';
        if (dias === 1) return 'Ayer';
        return 'Hace ' + dias + ' días';
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
            valid.forEach((p, i) => { if (i) { const cpx = (valid[i - 1].x + p.x) / 2; ctx.bezierCurveTo(cpx, valid[i - 1].y, cpx, p.y, p.x, p.y); } });
            ctx.lineTo(valid[valid.length - 1].x, H - pad.bottom); ctx.lineTo(valid[0].x, H - pad.bottom);
            ctx.closePath(); ctx.fillStyle = gr; ctx.fill();
            ctx.beginPath(); ctx.moveTo(valid[0].x, valid[0].y);
            valid.forEach((p, i) => { if (i) { const cpx = (valid[i - 1].x + p.x) / 2; ctx.bezierCurveTo(cpx, valid[i - 1].y, cpx, p.y, p.x, p.y); } });
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

    drawMorfociclo(id) {
        const canvas = document.getElementById(id);
        if (!canvas || !canvas.offsetWidth) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth, H = canvas.offsetHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.scale(dpr, dpr);
        
        const data = SportModules.equipo.getMorfocicloData(DB.getRegistro());
        const maxCarga = Math.max(1, ...data.map(d => d.carga || 0));
        const pad = { top: 20, right: 10, bottom: 25, left: 10 };
        const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
        const barW = cw / data.length * 0.7;

        ctx.clearRect(0, 0, W, H);
        data.forEach((d, i) => {
            const x = pad.left + (i * (cw / data.length)) + (cw / data.length - barW) / 2;
            const barH = (d.carga / maxCarga) * ch;
            ctx.fillStyle = d.carga === maxCarga && maxCarga > 0 ? '#ef4444' : d.color;
            ctx.beginPath();
            ctx.roundRect(x, pad.top + ch - Math.min(ch, barH), barW, Math.min(ch, barH), 4);
            ctx.fill();
            
            ctx.fillStyle = 'var(--text-2)';
            ctx.font = '10px var(--f-body)';
            ctx.textAlign = 'center';
            ctx.fillText(['D','L','M','M','J','V','S'][d.dow], x + barW / 2, H - 5);
        });
    }
};

/* ══════════════════════════════════════════════════
   MOBILITY MODULE
══════════════════════════════════════════════════ */
window.Mobility = {
    _hidden: false,
    init() {
        this.render();
    },
    skip() {
        document.getElementById('mobility-section').classList.add('hidden');
    },
    toggle() {
        document.getElementById('mobility-exercises').classList.toggle('hidden');
    },
    render() {
        const container = document.getElementById('mobility-exercises');
        if (!container) return;
        const list = Translator.getMobility();
        container.innerHTML = list.map(m => `
            <div class="mobility-card">
                <div class="mobility-card-info">
                    <span class="m-emoji">${m.emoji}</span>
                    <span class="m-name">${m.nombre}</span>
                    <span class="m-dur">${m.duracion}s</span>
                </div>
            </div>
        `).join('');
    }
};

/* ══════════════════════════════════════════════════
   UI MODULE
══════════════════════════════════════════════════ */
const UI = (() => {
    let currentSession = null;
    let activeLogCod = null;
    let activeEditIndex = null;
    const loggedSets = {};
    const loggedDone = {};

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
        if (viewId === 'plan') renderPlanningTable();
        if (viewId === 'fatigue') renderFatigueAnalysis();
        if (viewId === 'weekly') renderWeeklySummary();
    }

    function renderDashboard() {
        const user = UserSystem.getCurrentUser();
        const objetivoId = UserSystem.getCurrentObjetivo();
        const obj = Translator.getObjetivoById(objetivoId);
        const semana = Planner.getSemanaActual();
        const fatigue = FatigueEngine.getStatus();
        const traffic = FatigueEngine.getTrafficLightStatus();
        currentSession = Planner.getTodaySession();
        const sd = Planner.getScenarioData(currentSession.escenario);

        const objBadge = document.getElementById('objetivo-badge');
        if (objBadge) { objBadge.textContent = `${obj.emoji} ${obj.label}`; objBadge.style.color = obj.color; objBadge.style.borderColor = obj.color + '40'; objBadge.style.background = obj.color + '12'; }

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
            preview.innerHTML = currentSession.ejs_cods.slice(0, 5).map(obj => {
                const cod = (obj && typeof obj === 'object') ? obj.cod : obj;
                return `<span class="exercise-chip">${Translator.getName(cod)}</span>`;
            }).join('') + (currentSession.ejs_cods.length > 5 ? `<span class="exercise-chip">+${currentSession.ejs_cods.length - 5} más</span>` : '');
        }

        const diaDobleBtn = document.getElementById('btn-dia-doble');
        if (diaDobleBtn) {
            // Mostrar siempre — primer click abre modal de dia doble o inicia segunda sesión
            diaDobleBtn.classList.remove('hidden');
            // Si ya hay entradas hoy, cambiar label a "2ª SESIÓN"
            const ddbLabel = diaDobleBtn.querySelector('span') || diaDobleBtn;
            if (DB.hasTodayEntries()) {
                diaDobleBtn.setAttribute('data-second', 'true');
            }
        }

        const mrpe = document.getElementById('metric-rpe');
        if (mrpe) mrpe.textContent = fatigue.rpe !== null ? fatigue.rpe.toFixed(1) : '—';
        const mvolEl = document.getElementById('metric-vol');
        if (mvolEl) mvolEl.textContent = fatigue.vol > 0 ? `${(fatigue.vol / 1000).toFixed(1)}t` : '—';
        const mses = document.getElementById('metric-sessions');
        if (mses) mses.textContent = fatigue.sessions || '—';
        const mrecoEl = document.getElementById('fatigue-reco');
        if (mrecoEl) {
            const proHint = traffic.color === 'yellow'
                ? ` Carga 3d: ${traffic.carga3d} (${traffic.pct}%).`
                : '';
            mrecoEl.textContent = proHint ? `${fatigue.reco}${proHint}` : fatigue.reco;
        }

        // Panel de dolor
        const painSummary = PainEngine.getSummary();
        const painEl = document.getElementById('pain-summary');
        const painPanel = document.getElementById('pain-panel');
        if (painPanel) {
            if (painSummary.hasAlert) {
                painPanel.classList.remove('hidden');
                if (painEl) {
                    painEl.innerHTML = painSummary.alerts.map(d => {
                        const ajuste = PainEngine.getAjusteCarga(d.efectivo);
                        const edadLbl = PainEngine.getEdadLabel(d.dias);
                        const srcIcon = d.manual ? '🩺' : '💪';
                        return `<div class="pain-row">
                            <div style="display:flex;flex-direction:column;gap:2px;flex:1;">
                                <div style="display:flex;align-items:center;gap:6px;">
                                    <span class="pain-grupo">${d.grupo}</span>
                                    <span style="font-size:10px;color:var(--text-3);">${srcIcon} ${edadLbl}</span>
                                </div>
                                <span class="pain-nivel" style="color:${ajuste?.color || 'var(--text-3)'}">
                                    ${d.efectivo.toFixed(1)}/10 efectivo · ${ajuste?.label || '👁 Monitorear'}
                                </span>
                            </div>
                        </div>`;
                    }).join('');
                }
            } else {
                painPanel.classList.add('hidden');
            }
        }
        const bar = document.getElementById('fatigue-bar');
        if (bar) {
            bar.style.width = `${Math.min(100, ((fatigue.rpe || 0) / 10) * 100)}%`;
            bar.style.background = fatigue.level === 'green' ? 'var(--green)' : fatigue.level === 'yellow' ? 'var(--yellow)' : 'var(--red)';
        }
        const sem = document.getElementById('semaphore');
        if (sem) {
            // Semáforo refleja el nivel MÁS ALTO entre carga 3d y RPE 7d
            const semLevel = fatigue.level === 'red' || traffic.color === 'red' ? 'red'
                           : fatigue.level === 'yellow' || traffic.color === 'yellow' ? 'yellow'
                           : 'green';
            const semColor = semLevel === 'red' ? 'var(--red)'
                           : semLevel === 'yellow' ? 'var(--yellow)'
                           : 'var(--green)';
            const semGlow  = semLevel === 'red' ? 'var(--red-glow)'
                           : semLevel === 'yellow' ? 'var(--yellow-glow)'
                           : 'var(--green-glow)';
            sem.style.background = semColor;
            sem.style.boxShadow  = `0 0 10px ${semGlow}`;
            // Animación pulsante si está en rojo
            sem.className = semLevel === 'red' ? 'semaphore red' : 'semaphore';
            sem.title = `Fatiga: ${fatigue.level.toUpperCase()} · Carga 3d: ${traffic.pct}%`;
        }

        renderWeekDays(semana);
        renderPhaseTimeline(semana);
        
        const mod = SportModules.getCurrentModule();
        const morfPanel = document.getElementById('morfociclo-panel');
        if (morfPanel) {
            morfPanel.classList.toggle('hidden', mod !== 'equipo');
            if (mod === 'equipo') Chart.drawMorfociclo('morfociclo-chart');
        }

        const wbEl = document.getElementById('week-badge');
        if (wbEl) wbEl.textContent = `Sem. ${semana} / ${Planner.getTotalSemanas()}`;

        const pbEl = document.getElementById('phase-badge');
        if (pbEl) pbEl.textContent = Planner.getFaseActual(semana);
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
        const obj = Translator.getObjetivoById(UserSystem.getCurrentObjetivo());
        container.innerHTML = obj.fases.map(f => {
            const totalSems = f.semanas[1] - f.semanas[0] + 1;
            const done = Math.max(0, Math.min(totalSems, semanaActual - f.semanas[0] + 1));
            const pct = Math.round((done / totalSems) * 100);
            return `<div class="phase-row"><span class="phase-row-label">MES ${f.num}</span><div class="phase-row-bar-wrap"><div class="phase-row-bar" style="width:${pct}%;background:${f.color}"></div></div><span class="phase-row-pct">${pct}%</span></div>`;
        }).join('');
    }

    let _sesionNumHoy = 1; // Contador de sesiones del día

    function startTraining(overrideEscenario) {
        if (!currentSession) currentSession = Planner.getTodaySession();
        const session = overrideEscenario
            ? { ...currentSession, escenario: overrideEscenario, ejs_cods: overrideEscenario === 'REPETIR' ? currentSession.ejs_cods : [...(ESCENARIOS[overrideEscenario]?.ejercicios || [])].map(c => ({cod: c, series: null, reps: null})) }
            : currentSession;
        // Detectar si es segunda sesión del día
        const hoy = Planner.todayStr();
        const entradasHoy = DB.getRegistro().filter(e => e.fecha === hoy);
        const sesionesHoy = new Set(entradasHoy.map(e => e.sesion_num || 1)).size;
        _sesionNumHoy = DB.hasTodayEntries() ? sesionesHoy + 1 : 1;
        startTrainingForSession(session);
    }

    function startTrainingForSession(session) {
        currentSession = session;
        if (!session.ejs_cods.length) { alert('No hay ejercicios para esta sesión. Cambiá el escenario.'); return; }
        Object.keys(loggedSets).forEach(k => delete loggedSets[k]);
        Object.keys(loggedDone).forEach(k => delete loggedDone[k]);
        const sd = Planner.getScenarioData(session.escenario);
        const trainLabel = document.getElementById('train-scenario-label');
        if (trainLabel) trainLabel.textContent = `${sd.emoji} ${sd.label}`;
        const trainDate = document.getElementById('train-date-label');
        if (trainDate) trainDate.textContent = _cap(Planner.fmtDate(session.fecha));
        if (FatigueEngine.isHighFatigue()) {
            const alertEl = document.getElementById('fatigue-alert-banner');
            if (alertEl) alertEl.classList.remove('hidden');
        }
        Mobility.init(); // Initialize Mobility
        const mobilitySection = document.getElementById('mobility-section');
        if (mobilitySection) { mobilitySection.classList.remove('hidden'); mobilitySection.style.opacity = ''; mobilitySection.style.transform = ''; }
        renderExerciseList();
        switchView('train');
    }

    function renderExerciseList() {
        const sess = currentSession || Planner.getTodaySession();
        if (!sess) return;

        const container = document.getElementById('exercise-list');
        if (!container) return;
        container.innerHTML = '';

        const ejs = sess.ejs_cods || [];
        if (!ejs.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">😴</div><p>Sin ejercicios para este escenario.</p></div>`;
            return;
        }
        ejs.forEach(exData => container.appendChild(buildExerciseCard(exData)));

        // Footer "¿Hiciste algo más?"
        const footer = document.createElement('div');
        footer.className = 'ex-session-footer';
        footer.innerHTML = `
            <p class="ex-footer-label">¿Hiciste algo más?</p>
            <div class="ex-footer-options">
                <button class="ex-footer-btn" onclick="UI.openLogExtraExercise()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregar ejercicio extra
                </button>
                <button class="ex-footer-btn" onclick="UI.openLogExtraCardio()">
                    🏃 Cardio / Trote
                </button>
                <button class="ex-footer-btn" onclick="UI.openLogExtraNotas()">
                    📝 Solo una nota
                </button>
            </div>`;
        container.appendChild(footer);
    }

    function buildExerciseCard(exData) {
        const cod = (exData && typeof exData === 'object') ? exData.cod : exData;
        const ej  = Translator.getByCode(cod);
        if (!ej) return document.createElement('div');

        const recoSets  = (exData && typeof exData === 'object' && exData.series) ? exData.series
                        : (ej.fatiga === 3 ? 4 : 4);
        const recoReps  = (exData && typeof exData === 'object' && exData.reps) ? exData.reps
                        : (ej.fatiga === 3 ? '6-8' : ej.fatiga === 2 ? '10-12' : '15');
        const recoPause = (exData && typeof exData === 'object' && exData.pause) ? exData.pause
                        : (ej.fatiga === 3 ? '3 min' : ej.fatiga === 2 ? '90 s' : '60 s');

        const lastWeight      = WeightEngine.getSuggestedWeight(cod);
        const prog            = FatigueEngine.getProgressionSuggestion(cod);
        const suggestedWeight = (prog && prog.suggest && lastWeight > 0) ? lastWeight + 2.5 : lastWeight;
        const hasRirBadge     = SportModules.fuerza.shouldIncreaseLoad(cod);
        const isProgressed    = (prog && prog.suggest && lastWeight > 0) || hasRirBadge;
        const sets            = loggedSets[cod] || [];
        const hasLogs         = sets.length > 0;
        const isDone          = loggedDone[cod] === true;

        const card = document.createElement('div');
        card.className = `ex-card${hasLogs ? ' has-logs' : ''}${isDone ? ' is-done' : ''}`;
        card.id = `ex-card-${cod}`;

        const dolorEj    = typeof PainEngine !== 'undefined' ? PainEngine.getDolorParaEjercicio(cod) : 0;
        const ajusteDolor = typeof PainEngine !== 'undefined' ? PainEngine.getAjusteCarga(dolorEj) : null;
        const pesoAjustado = ajusteDolor && ajusteDolor.factor > 0
            ? Math.round(suggestedWeight * ajusteDolor.factor * 2) / 2
            : suggestedWeight;
        const weightStr = (ej.fatiga === 1 && pesoAjustado === 0) ? 'Peso corporal'
                        : `${pesoAjustado} kg${isProgressed ? ' ▲' : ''}`;
        const customBadge = ej.custom ? ' ★' : '';
        const fatigueCls  = `fbadge f${ej.fatiga}`;

        // Sets logged summary
        const setsHtml = hasLogs ? `
            <div class="ex-sets-log">
                ${sets.map((s, i) => `
                <div class="ex-set-row">
                    <span class="ex-set-num">S${i+1}</span>
                    <span class="ex-set-detail">${s.peso > 0 ? s.peso + ' kg' : 'Corporal'} · ${s.series}×${s.reps}</span>
                    <span class="ex-set-rpe rpe-${s.rpe <= 7 ? 'low' : s.rpe <= 8.5 ? 'mid' : 'high'}">RPE ${s.rpe}</span>
                    <button class="ex-set-edit" onclick="UI.editSet(${cod},${i})" title="Editar">✏️</button>
                </div>`).join('')}
                <button class="ex-btn-add-set" onclick="UI.openLogModal(${cod})">＋ Agregar serie</button>
            </div>` : '';

        const progressionHint = hasRirBadge
            ? `<div class="ex-hint">🟢 RIR ≥ ${RIR_PROGRESSION_THRESHOLD} — podés subir carga esta sesión</div>` : '';
        const painHint = ajusteDolor
            ? `<div class="ex-hint-pain" style="background:rgba(244,63,94,0.07);border-top:1px solid rgba(244,63,94,0.15);">
                <span>${ajusteDolor.label}</span>
                ${ajusteDolor.skip ? '<span style="font-size:11px;color:var(--text-3);">Considerá sustituir por movilidad</span>' : ''}
               </div>` : '';

        card.innerHTML = `
        <div class="ex-card-top">
            <span class="${fatigueCls}">${ej.fatiga}</span>
            <div class="ex-card-info">
                <p class="ex-card-name">${ej.nombre}${customBadge}</p>
                <p class="ex-card-meta">${ej.grupo} · ${ej.patron || ''}</p>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                <button class="ex-btn-pain${dolorEj >= 4 ? ' has-pain' : ''}"
                        onclick="App.openPainReport(${cod})"
                        title="Reportar dolor en este ejercicio">
                    🩺
                </button>
                <button class="ex-btn-done${isDone ? ' done' : ''}"
                        onclick="UI.toggleDone(${cod})"
                        title="${isDone ? 'Marcar como pendiente' : 'Hecho a rajatabla'}">
                    ${isDone ? '✅' : '○'}
                </button>
            </div>
        </div>
        <div class="ex-card-params">
            <div class="ex-param">
                <span class="ex-param-val">${recoSets}</span>
                <span class="ex-param-lbl">Series</span>
            </div>
            <div class="ex-param-sep"></div>
            <div class="ex-param">
                <span class="ex-param-val">${recoReps}</span>
                <span class="ex-param-lbl">Reps</span>
            </div>
            <div class="ex-param-sep"></div>
            <div class="ex-param">
                <span class="ex-param-val">${recoPause}</span>
                <span class="ex-param-lbl">Pausa</span>
            </div>
            <div class="ex-param-sep"></div>
            <div class="ex-param">
                <span class="ex-param-val${isProgressed ? ' prog' : ''}">${weightStr}</span>
                <span class="ex-param-lbl">Peso sug.</span>
            </div>
        </div>
        ${progressionHint}
        ${painHint}
        ${setsHtml}
        ${!hasLogs && !isDone ? `<button class="ex-btn-log" onclick="UI.openLogModal(${cod})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Registrar serie
        </button>` : ''}`;

        return card;
    }


    function openLogModal(cod) {
        activeLogCod = cod;
        const ej = Translator.getByCode(cod);
        if (!ej) return;
        const user = UserSystem.getCurrentUser();
        const onboarding = user?.onboarding;
        // Usar la sesión activa (puede ser ayer) en vez de siempre hoy
        const activeSess = currentSession || Planner.getTodaySession();
        const currentSem = activeSess?.semana || 1;

        const lastWeight = WeightEngine.getSuggestedWeight(cod);
        const prog = FatigueEngine.getProgressionSuggestion(cod);
        const sw = (prog && prog.suggest && lastWeight > 0) ? lastWeight + 2.5 : lastWeight;
        document.getElementById('log-modal-title').textContent = ej.nombre;
        document.getElementById('log-modal-group').textContent = ej.grupo;
        document.getElementById('log-cod').value = cod;
        document.getElementById('log-peso').value = sw > 0 ? sw : '';

        let defSeries = 4;
        let defRpe = 7;
        if (onboarding) {
            const freq = parseInt(onboarding.frecuenciaUlt7d || onboarding.frecuencia || '3', 10);
            if (freq === 0 && currentSem === 1) defSeries = 2;
            if (onboarding.nivel === 'principiante') defRpe = 6;
        }

        document.getElementById('log-series').value = defSeries;
        document.getElementById('log-reps').value = 10;
        document.getElementById('log-rir').value = 3;
        document.getElementById('log-rir-display').textContent = 3;
        document.getElementById('rir-badge').classList.remove('hidden');
        document.getElementById('log-rpe').value = defRpe;
        document.getElementById('log-rpe-display').textContent = defRpe;
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
            const rir = parseInt(document.getElementById('log-rir').value || '0', 10);
            const dolor = parseFloat(document.getElementById('log-dolor').value);
            const notes = document.getElementById('log-notes').value.trim();
            const dolor_alert = dolor > 7;
            const tonelaje = SportModules.fuerza.calcTonelaje(series, reps, peso);
            // Usar la fecha de la sesión activa (puede ser ayer u otro día)
            const fechaRegistro = currentSession?.fecha || Planner.todayStr();
            if (activeEditIndex !== null) {
                // Modo edición — actualizar la entrada en loggedSets (no duplicar en DB)
                if (loggedSets[cod] && loggedSets[cod][activeEditIndex]) {
                    loggedSets[cod][activeEditIndex] = { peso, series, reps, rpe, rir, dolor, notes };
                }
                activeEditIndex = null;
                const btn = document.getElementById('btn-log-submit');
                if (btn) btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> GUARDAR SERIE';
            } else {
                DB.saveSet({ cod, fecha: fechaRegistro, peso, series, reps, rpe, rir, dolor, notes, vol_total: tonelaje, tonelaje, dolor_alert, sesion_num: _sesionNumHoy || 1 });
                if (!loggedSets[cod]) loggedSets[cod] = [];
                loggedSets[cod].push({ peso, series, reps, rpe, rir, dolor });
            }
            closeLogModal();
            refreshExerciseCard(cod);
            const ddb = document.getElementById('btn-dia-doble');
            if (ddb) ddb.classList.remove('hidden');
            Timer.autoRestartAfterSet();
            if (dolor_alert) {
                setTimeout(() => alert(`⚠️ Dolor > 7. Siguiente serie sugerida: ${+(peso * 0.8).toFixed(1)} kg (-20%).`), 300);
            }
        });
        document.getElementById('btn-close-log-modal').addEventListener('click', closeLogModal);
        document.getElementById('log-modal-overlay').addEventListener('click', e => { if (e.target.id === 'log-modal-overlay') closeLogModal(); });
    }

    function refreshExerciseCard(cod) {
        const old = document.getElementById('ex-card-' + cod);
        if (old) old.replaceWith(buildExerciseCard(cod));
    }

    function toggleDone(cod) {
        const ej = Translator.getByCode(cod);
        if (!ej) return;
        if (loggedDone[cod]) {
            // Desmarcar — quitar done
            delete loggedDone[cod];
            refreshExerciseCard(cod);
            return;
        }
        // Marcar como hecho a rajatabla — guardar con valores recomendados
        loggedDone[cod] = true;
        const sess = currentSession || Planner.getTodaySession();
        const exData = sess.ejs_cods.find(e => (typeof e === 'object' ? e.cod : e) === cod) || {};
        const recoSets  = (typeof exData === 'object' && exData.series) ? exData.series
                        : (ej.fatiga === 3 ? 4 : 4);
        const recoReps  = (typeof exData === 'object' && exData.reps) ? parseInt(exData.reps) || 10 : 10;
        const peso      = WeightEngine.getSuggestedWeight(cod);
        const tonelaje  = SportModules.fuerza.calcTonelaje(recoSets, recoReps, peso);
        const fechaReg  = currentSession?.fecha || Planner.todayStr();
        DB.saveSet({ cod, fecha: fechaReg, peso, series: recoSets, reps: recoReps, rpe: 7, rir: 3,
                     dolor: 0, notes: 'A rajatabla', vol_total: tonelaje, sesion_num: _sesionNumHoy || 1 });
        if (!loggedSets[cod]) loggedSets[cod] = [];
        loggedSets[cod].push({ peso, series: recoSets, reps: recoReps, rpe: 7, rir: 3, dolor: 0 });
        refreshExerciseCard(cod);
        Timer.autoRestartAfterSet();
        document.getElementById('btn-dia-doble')?.classList.remove('hidden');
    }

    function editSet(cod, idx) {
        // Pre-fill log modal con los datos de esa serie para editarla
        const s = (loggedSets[cod] || [])[idx];
        if (!s) return;
        activeLogCod = cod;
        activeEditIndex = idx;
        const ej = Translator.getByCode(cod);
        document.getElementById('log-modal-title').textContent = ej ? ej.nombre : 'Editar';
        document.getElementById('log-modal-group').textContent = '✏️ Editando serie ' + (idx + 1);
        document.getElementById('log-cod').value    = cod;
        document.getElementById('log-peso').value   = s.peso;
        document.getElementById('log-series').value = s.series;
        document.getElementById('log-reps').value   = s.reps;
        document.getElementById('log-rpe').value    = s.rpe;
        document.getElementById('log-rpe-display').textContent = s.rpe;
        document.getElementById('log-rir').value    = s.rir ?? 3;
        document.getElementById('log-rir-display').textContent = s.rir ?? 3;
        document.getElementById('log-dolor').value  = s.dolor ?? 0;
        document.getElementById('log-dolor-display').textContent = s.dolor ?? 0;
        document.getElementById('log-notes').value  = s.notes || '';
        document.getElementById('suggestion-text').textContent = '✏️ Editando — guardá para actualizar';
        document.getElementById('log-modal-overlay').classList.remove('hidden');
        const btn = document.getElementById('btn-log-submit');
        if (btn) btn.textContent = 'ACTUALIZAR SERIE';
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

    function renderPlanningTable() {
        const container = document.getElementById('planning-table-body');
        if (!container) return;
        const plan = Planner.getPlan();
        const hoy = Planner.todayStr();
        const registro = DB.getRegistro();

        container.innerHTML = plan.map(s => {
            const isToday = s.fecha === hoy;
            const isDone = registro.some(e => e.fecha === s.fecha);
            const codes = s.ejs_cods.map(e => (typeof e === 'object' ? e.cod : e)).join(', ');
            const sets = s.ejs_cods.length > 0 ? (s.ejs_cods[0].series || '—') : '—';
            const reps = s.ejs_cods.length > 0 ? (s.ejs_cods[0].reps || '—') : '—';
            const sd = Planner.getScenarioData(s.escenario);
            const isDeload = s.fase.includes('ACUMULACIÓN') && s.semana === 4 && s.escenario !== 'DESCANSO';

            return `
                <tr class="${isToday ? 'row-today' : ''} ${isDone ? 'row-done' : ''}">
                    <td class="td-center">${String(s.id).padStart(4, '0')}</td>
                    <td class="td-center">${_fmtVeryShort(s.fecha)}</td>
                    <td>${s.fase}</td>
                    <td style="color:${sd.color}">${sd.emoji} ${sd.label}</td>
                    <td class="td-codes">${codes}</td>
                    <td class="td-center">${sets}</td>
                    <td class="td-center">${reps}</td>
                    <td class="td-center">${isDone ? '✓' : 'Plan.'}</td>
                    <td class="td-center">${isDeload ? 'SI' : 'NO'}</td>
                </tr>
            `;
        }).join('');
    }

    function renderFatigueAnalysis() {
        const container = document.getElementById('fatigue-analysis-body');
        if (!container) return;
        const totalWeeks = Planner.getTotalSemanas();
        const plan = Planner.getPlan();
        const registro = DB.getRegistro();
        
        let html = '';
        for (let w = 1; w <= totalWeeks; w++) {
            const weekDays = Planner.getWeekDays(w);
            const startStr = weekDays[0]?.fecha || '—';
            const weekEntries = registro.filter(e => weekDays.some(d => d.fecha === e.fecha));
            const stats = FatigueEngine.calcStats(weekEntries);
            
            const rpeStr = stats.rpe !== null ? stats.rpe.toFixed(1) : '—';
            const volStr = stats.vol > 0 ? (stats.vol / 1000).toFixed(1) : '—';
            
            let status = '⚪ Sin datos';
            let reco = 'Seguir plan base';
            if (stats.sessions > 0) {
                if (stats.rpe > 8.5) { status = '<span style="color:#ef4444">🔴 CRÍTICA</span>'; reco = 'Descarga + Contraste'; }
                else if (stats.rpe > 7.1) { status = '<span style="color:#facc15">🟡 ELEVADA</span>'; reco = 'Gestión de carga'; }
                else { status = '<span style="color:#22c55e">🟢 ÓPTIMA</span>'; reco = 'Prog. Intensidad'; }
            }
            
            html += `
                <tr>
                    <td class="td-center">${w}</td>
                    <td class="td-center">${_fmtVeryShort(startStr)}</td>
                    <td class="td-center">${volStr}</td>
                    <td class="td-center">${rpeStr}</td>
                    <td class="td-center">${stats.sessions}</td>
                    <td>${status}</td>
                    <td>${reco}</td>
                </tr>
            `;
        }
        container.innerHTML = html;
        renderScenariosLegend();
    }

    function renderScenariosLegend() {
        const container = document.getElementById('scenarios-legend');
        if (!container) return;
        container.innerHTML = Object.entries(ESCENARIOS).map(([key, s]) => `
            <div class="library-row" style="border-left: 4px solid ${s.color}">
                <span class="library-name" style="font-weight:700">${s.emoji} ${s.label}</span>
                <span class="library-grupo">${s.ejercicios.map(c => Translator.getName(c)).join(', ')}</span>
            </div>
        `).join('');
    }

    function renderWeeklySummary() {
        const container = document.getElementById('weekly-summary-body');
        if (!container) return;
        const totalWeeks = Planner.getTotalSemanas();
        const registro = DB.getRegistro();
        
        let html = '';
        for (let w = 1; w <= totalWeeks; w++) {
            const weekDays = Planner.getWeekDays(w);
            const targetSessions = weekDays.filter(d => d.escenario !== 'DESCANSO').length;
            const fase = weekDays[0]?.fase || '—';
            const weekEntries = registro.filter(e => weekDays.some(d => d.fecha === e.fecha));
            const actualSessions = [...new Set(weekEntries.map(e => e.fecha))].length;
            const stats = FatigueEngine.calcStats(weekEntries);
            
            const maxPain = weekEntries.length ? Math.max(...weekEntries.map(e => e.dolor || 0)) : 0;
            const rpeStr = stats.rpe !== null ? stats.rpe.toFixed(1) : '—';
            const volStr = stats.vol > 0 ? (stats.vol / 1000).toFixed(1) : '—';
            
            const compliance = `${actualSessions}/${targetSessions}`;
            const compColor = actualSessions >= targetSessions ? '#22c55e' : actualSessions > 0 ? '#facc15' : '#64748b';

            let matchAlert = '—';
            if (weekDays.some(d => d.escenario === 'PARTIDO')) {
                matchAlert = maxPain > 4 ? '<span style="color:#ef4444;font-weight:700">❌ Riesgo</span>' : '<span style="color:#22c55e;font-weight:700">✅ APTO</span>';
            }

            html += `
                <tr>
                    <td class="td-center">${w}</td>
                    <td>${fase}</td>
                    <td class="td-center" style="color:${compColor};font-weight:700">${compliance}</td>
                    <td class="td-center">${volStr}</td>
                    <td class="td-center">${rpeStr}</td>
                    <td class="td-center">${maxPain > 0 ? maxPain : '—'}</td>
                    <td>${matchAlert}</td>
                </tr>
            `;
        }
        container.innerHTML = html;
    }

    function _fmtVeryShort(str) {
        const d = new Date(str + 'T12:00:00');
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return d.getDate() + '/' + (d.getMonth() + 1);
    }

    function openDiaDobleModal() {
        const container = document.getElementById('dia-doble-options');
        const hoy = Planner.todayStr();
        const entradasHoy = DB.getRegistro().filter(e => e.fecha === hoy);
        const sesionesHoy = [...new Set(entradasHoy.map(e => e.sesion_num || 1))].length;
        const headerEl = document.querySelector('#dia-doble-modal-overlay .modal-title');
        const subEl    = document.querySelector('#dia-doble-modal-overlay .modal-subtitle');
        if (headerEl) headerEl.textContent = sesionesHoy >= 1 ? `Sesión ${sesionesHoy + 1} del día` : 'Día Doble';
        if (subEl) subEl.textContent = sesionesHoy >= 1
            ? `Ya registraste ${sesionesHoy} sesión${sesionesHoy > 1 ? 'es' : ''} hoy. ¿Qué tipo de segunda sesión?`
            : 'Planificá tu segunda sesión de hoy.';
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
            const session = Translator.getSessionByDate(fecha, Planner.getPlan());
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

    let _initialized = false;

    function init() {
        if (!_initialized) {
            _initialized = true;
            initNav();
            initLogForm();
            initGlobalListeners();
        }
        switchView('dashboard');
        renderDashboard();
    }


    function initGlobalListeners() {
        document.getElementById('btn-start-training').addEventListener('click', () => {
            const sess = currentSession || Planner.getTodaySession();
            if (sess.escenario === 'PARTIDO' || sess.escenario === 'AMISTOSO') {
                App.openPartidoModal(sess);
            } else if (sess.escenario === 'DESCANSO') {
                App.openDescansoModal();
            } else {
                startTraining();
            }
        });
        document.getElementById('btn-dia-doble').addEventListener('click', openDiaDobleModal);
        document.getElementById('btn-back-dashboard').addEventListener('click', () => { switchView('dashboard'); renderDashboard(); });
        // Scenario override y objetivo están en Configuración (more menu → advanced settings)
        // El badge del header es solo informativo — no abre modal
        ['fuerza', 'resistencia'].forEach(k => {
            const el = document.getElementById(`survey-${k}`);
            if (el) el.addEventListener('input', () => {
                const display = document.getElementById(`survey-${k}-display`);
                if (display) display.textContent = el.value;
            });
        });
        document.getElementById('scenario-modal-overlay').addEventListener('click', e => { if (e.target.id === 'scenario-modal-overlay') closeScenarioModal(); });
        document.getElementById('dia-doble-modal-overlay').addEventListener('click', e => { if (e.target.id === 'dia-doble-modal-overlay') closeDiaDobleModal(); });
        const descansoOverlay = document.getElementById('descanso-modal-overlay');
        if (descansoOverlay) descansoOverlay.addEventListener('click', e => { if (e.target.id === 'descanso-modal-overlay') App.dismissDescanso(); });
        const partidoOverlay = document.getElementById('partido-modal-overlay');
        if (partidoOverlay) partidoOverlay.addEventListener('click', e => { if (e.target.id === 'partido-modal-overlay') App.dismissPartido(); });
        const painOverlay = document.getElementById('pain-report-overlay');
        if (painOverlay) painOverlay.addEventListener('click', e => { if (e.target.id === 'pain-report-overlay') App.closePainReport(); });
        document.getElementById('library-search').addEventListener('input', e => renderLibrary(e.target.value));
        document.getElementById('btn-clear-history').addEventListener('click', () => {
            if (confirm('¿Borrar todo el historial? Esta acción no se puede deshacer.')) { DB.clearRegistro(); renderHistory(); renderDashboard(); }
        });
        document.getElementById('btn-add-exercise').addEventListener('click', () => {
            const mod = SportModules.getCurrentModule();
            if (mod === 'resistencia') {
                document.getElementById('log-modal-resistencia-overlay').classList.remove('hidden');
            } else {
                document.getElementById('custom-ex-modal-overlay').classList.remove('hidden');
            }
        });

        const resForm = document.getElementById('log-resistencia-form');
        if (resForm) {
            const updateZoneFeedback = () => {
                const hr = parseInt(document.getElementById('log-res-hr').value || '0', 10);
                const hrMax = parseInt(document.getElementById('log-res-hrmax').value || '0', 10);
                const zr = document.getElementById('zone-result');
                const zt = document.getElementById('zone-text');
                const zi = document.getElementById('zone-icon');
                const z = SportModules.resistencia.calcZones(hr, hrMax);
                if (!zr || !zt || !zi) return;
                if (!z) {
                    zr.classList.add('hidden');
                    return;
                }
                zr.classList.remove('hidden');
                zi.textContent = '🌊';
                zt.textContent = `${z.zone.label} (${z.pct}% FCmax)`;
            };
            ['log-res-hr', 'log-res-hrmax'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', updateZoneFeedback);
            });
            const rr = document.getElementById('log-res-rpe');
            if (rr) rr.addEventListener('input', function () {
                document.getElementById('log-res-rpe-display').textContent = this.value;
            });
            resForm.addEventListener('submit', e => {
                e.preventDefault();
                const dist = parseFloat(document.getElementById('log-res-dist').value || '0');
                const time = parseFloat(document.getElementById('log-res-time').value || '0');
                const hr = parseInt(document.getElementById('log-res-hr').value || '0');
                const hrMax = parseInt(document.getElementById('log-res-hrmax').value || '0');
                const rpe = parseFloat(document.getElementById('log-res-rpe').value || '6');
                const zones = SportModules.resistencia.calcZones(hr, hrMax);
                const pace = SportModules.resistencia.calcPace(dist, time);
                DB.saveSet({
                    cod: 0, fecha: Planner.todayStr(), peso: dist, series: 1, reps: time, rpe, minutos: time,
                    hr_avg: hr, hr_max: hrMax, zone: zones?.zone?.id || null, zone_pct: zones?.pct || null, pace,
                    notes: `Endurance: ${dist}km in ${time}min`,
                });
                document.getElementById('log-modal-resistencia-overlay').classList.add('hidden');
                renderDashboard();
            });
        }
        document.getElementById('btn-finish-session').addEventListener('click', () => {
            if (!Object.keys(loggedSets).length && !confirm('No registraste ejercicios. ¿Finalizar igual?')) return;
            // Show mandatory RPE modal 
            document.getElementById('end-session-rpe-overlay').classList.remove('hidden');
            const rpeSlider = document.getElementById('end-session-rpe');
            if (rpeSlider) rpeSlider.addEventListener('input', function() {
                document.getElementById('end-session-rpe-display').textContent = this.value;
            });
        });
        document.getElementById('btn-skip-mobility').addEventListener('click', () => Mobility.skip());
        document.getElementById('btn-toggle-mobility').addEventListener('click', () => Mobility.toggle());
        document.getElementById('header-user-btn').addEventListener('click', () => {
            App.logout();
        });
        const btnReOnboarding = document.getElementById('btn-reonboarding');
        if (btnReOnboarding) {
            btnReOnboarding.addEventListener('click', () => {
                const uid = UserSystem.getCurrentUserId();
                if (!uid) return;
                if (!confirm('Esto recalibra tu planificación según tus respuestas actuales. ¿Continuar?')) return;
                LoginUI.showOnboarding(uid);
            });
        }

        document.getElementById('custom-ex-form').addEventListener('submit', e => {
            e.preventDefault();
            const nombre = document.getElementById('cex-nombre').value.trim();
            const grupo  = document.getElementById('cex-grupo').value || 'General';
            const patron = document.getElementById('cex-patron').value || 'Libre';
            const peso   = parseFloat(document.getElementById('cex-peso').value || '0');
            const series = parseInt(document.getElementById('cex-series').value || '3', 10);
            const reps   = parseInt(document.getElementById('cex-reps').value || '10', 10);
            const fatiga = UI._calcAutoFatiga ? UI._calcAutoFatiga(grupo, patron, series, reps) : parseInt(document.getElementById('cex-fatiga').value || '2', 10);
            if (!nombre) return;
            const newEx = UserSystem.addCustomExercise({ nombre, grupo, fatiga, patron, peso_inicial: peso, series_recomendadas: series, reps_recomendadas: reps, activo: true });
            // Guardar peso inicial en PESOS_INICIALES en memoria
            if (newEx && peso > 0) PESOS_INICIALES[newEx.cod] = peso;
            UI._renderCustomExList ? UI._renderCustomExList() : null;
            UI._resetCustomExForm ? UI._resetCustomExForm() : document.getElementById('custom-ex-form').reset();
            renderLibrary('');
        });

        // Auto-calcular fatiga mientras el usuario completa el form
        ['cex-grupo','cex-patron','cex-series','cex-reps'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => {
                const grupo  = document.getElementById('cex-grupo').value || '';
                const patron = document.getElementById('cex-patron').value || '';
                const series = parseInt(document.getElementById('cex-series').value || '3', 10);
                const reps   = parseInt(document.getElementById('cex-reps').value || '10', 10);
                if (!grupo && !patron) return;
                const f = UI._calcAutoFatiga ? UI._calcAutoFatiga(grupo, patron, series, reps) : 2;
                document.getElementById('cex-fatiga').value = f;
                const preview = document.getElementById('cex-fatiga-preview');
                const icon    = document.getElementById('cex-fatiga-icon');
                const text    = document.getElementById('cex-fatiga-text');
                if (preview) preview.classList.remove('hidden');
                if (icon) icon.textContent = f === 3 ? '🔴' : f === 2 ? '🟡' : '🟢';
                if (text) text.textContent = f === 3
                    ? 'Fatiga ALTA — ejercicio compuesto exigente'
                    : f === 2 ? 'Fatiga MEDIA — ejercicio moderado'
                    : 'Fatiga BAJA — ejercicio de aislamiento o cardio';
            });
        });
        document.getElementById('custom-ex-modal-overlay').addEventListener('click', e => {
            if (e.target.id === 'custom-ex-modal-overlay') document.getElementById('custom-ex-modal-overlay').classList.add('hidden');
        });
    }

    function stepRIR(delta) {
        const el = document.getElementById('log-rir');
        const display = document.getElementById('log-rir-display');
        let val = parseInt(el.value || '3') + delta;
        val = Math.max(0, Math.min(5, val));
        el.value = val;
        display.textContent = val;
        const badge = document.getElementById('rir-badge');
        if (badge) badge.classList.toggle('hidden', val < RIR_PROGRESSION_THRESHOLD);
    }

    function stepEndMin(delta) {
        const el = document.getElementById('end-session-min');
        const display = document.getElementById('end-session-min-display');
        let val = parseInt(el.value || '60') + delta;
        val = Math.max(5, Math.min(300, val));
        el.value = val;
        display.textContent = val;
    }

    function openLogExtraExercise() {
        // Abrir biblioteca para elegir ejercicio extra
        const cod = prompt('Código del ejercicio (ver Historial → Biblioteca):');
        if (!cod || isNaN(parseInt(cod))) return;
        openLogModal(parseInt(cod));
    }

    function openLogExtraCardio() {
        // Pre-fill log modal con ejercicio de cardio (cod 34 = Caminata/Trote)
        openLogModal(34);
    }

    function openLogExtraNotas() {
        // Abrir log modal para cod 0 (nota libre)
        activeLogCod = 0;
        document.getElementById('log-modal-title').textContent = 'Nota de sesión';
        document.getElementById('log-modal-group').textContent = 'Registro libre';
        document.getElementById('log-cod').value = 0;
        document.getElementById('log-peso').value = 0;
        document.getElementById('log-series').value = 1;
        document.getElementById('log-reps').value = 1;
        document.getElementById('log-rpe').value = 6;
        document.getElementById('log-rpe-display').textContent = 6;
        document.getElementById('log-dolor').value = 0;
        document.getElementById('log-dolor-display').textContent = 0;
        document.getElementById('log-notes').value = '';
        document.getElementById('suggestion-text').textContent = '📝 Anotá lo que hiciste';
        document.getElementById('log-modal-overlay').classList.remove('hidden');
        setTimeout(() => document.getElementById('log-notes').focus(), 100);
    }

        function toggleMoreMenu() {
        const m = document.getElementById('more-menu');
        if (m) m.classList.toggle('hidden');
        const navBtn = document.getElementById('nav-btn-more');
        if (navBtn) navBtn.classList.toggle('active', !m.classList.contains('hidden'));
    }

    function openAdvancedSettings() {
        document.getElementById('advanced-settings-overlay')?.classList.remove('hidden');
    }

    function closeAdvancedSettings() {
        document.getElementById('advanced-settings-overlay')?.classList.add('hidden');
    }

    function openCustomExModal() {
        _renderCustomExList();
        _resetCustomExForm();
        document.getElementById('custom-ex-modal-overlay')?.classList.remove('hidden');
    }

    function _renderCustomExList() {
        const container = document.getElementById('custom-ex-list');
        if (!container) return;
        const list = UserSystem.getCustomExercises();
        if (!list.length) {
            container.innerHTML = '<p style="font-size:13px;color:var(--text-3);text-align:center;padding:8px 0;">Aún no tenés ejercicios personalizados.</p>';
            return;
        }
        container.innerHTML = list.map(e => `
            <div style="display:flex;align-items:center;gap:10px;background:var(--surface);border-radius:var(--radius-sm);padding:10px 12px;border:1px solid var(--border);">
                <div style="flex:1;">
                    <p style="font-weight:700;font-size:14px;">${e.nombre} <span class="custom-ex-badge">★</span></p>
                    <p style="font-size:11px;color:var(--text-3);">${e.grupo} · ${e.patron} · Fatiga ${e.fatiga}</p>
                </div>
                <button onclick="UI.deleteCustomEx(${e.cod})" style="color:var(--red);font-size:18px;padding:4px 8px;-webkit-tap-highlight-color:transparent;">✕</button>
            </div>`).join('');
    }

    function deleteCustomEx(cod) {
        if (!confirm('¿Eliminar este ejercicio de tu biblioteca?')) return;
        const uid = UserSystem.getCurrentUserId();
        if (!uid) return;
        const all = UserSystem.getCustomExercises().filter(e => e.cod !== cod);
        localStorage.setItem('rabix_' + uid + '_custom_ex', JSON.stringify(all));
        _renderCustomExList();
        renderLibrary('');
    }

    function _resetCustomExForm() {
        const form = document.getElementById('custom-ex-form');
        if (form) form.reset();
        document.getElementById('cex-fatiga-preview')?.classList.add('hidden');
        document.getElementById('cex-fatiga').value = '2';
    }

    function _calcAutoFatiga(grupo, patron, series, reps) {
        // Fatiga alta (3): movimientos compuestos de piernas/espalda, series altas o muchas reps
        const esCompuestoPiernas = ['Dominante Rodilla','Dominante Cadera'].includes(patron);
        const esCompuestoEspalda = patron.includes('Tracción');
        const volumen = (series || 3) * (reps || 10);
        if (esCompuestoPiernas || (esCompuestoEspalda && volumen > 30)) return 3;
        // Fatiga baja (1): cardio, core, aislamiento liviano
        if (['Cardio','Core'].includes(patron) || ['Aeróbico','Core'].includes(grupo)) return 1;
        if (['HIIT','Potencia'].includes(patron)) return 2;
        // Empuje/tracción horizontal/vertical → media
        return 2;
    }

    window.UI = {
        init, switchView, renderDashboard, renderExerciseList,
        openLogModal, closeLogModal, renderHistory,
        openScenarioModal, closeScenarioModal, selectScenario,
        openDiaDobleModal, closeDiaDobleModal, startDiaDoble,
        openObjetivoModal, closeObjetivoModal, selectObjetivo,
        openAdvancedSettings, closeAdvancedSettings,
        toggleDone, editSet,
        openLogExtraExercise, openLogExtraCardio, openLogExtraNotas,
        toggleMoreMenu,
        openCustomExModal, deleteCustomEx,
        stepRIR, stepEndMin,
        startTrainingForSession,
        _renderCustomExList,
        _resetCustomExForm,
        _calcAutoFatiga,
        closeSurveyModal: () => document.getElementById('cycle-modal-overlay').classList.add('hidden')
    };
    return window.UI;
})();

/* ══════════════════════════════════════════════════
   LOGIN UI
══════════════════════════════════════════════════ */
const LoginUI = {
    selectedEmoji: '⚡',
    selectedObjetivo: 'ALTO_RENDIMIENTO',
    _initialized: false,

    show() {
        try {
            document.querySelectorAll('.view').forEach(v => { v.classList.add('hidden'); v.classList.remove('active'); });
            const vl = document.getElementById('view-login');
            if (vl) { vl.classList.remove('hidden'); vl.classList.add('active'); }

            document.getElementById('app-header')?.classList.add('hidden');
            document.querySelector('.bottom-nav')?.classList.add('hidden');
            document.querySelector('.app-main')?.classList.add('hidden');
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
            const lf = document.getElementById('login-form');
            if (lf) lf.reset();

            // Pre-rellenar usuario si hay sesión recordada
            const rememberedUser = localStorage.getItem('rabix_remember_user');
            if (rememberedUser) {
                const unEl = document.getElementById('login-username');
                if (unEl) unEl.value = rememberedUser;
                const remCb = document.getElementById('login-remember');
                if (remCb) remCb.checked = true;
            }

            LoginUI.initOnce();
            document.getElementById('login-username')?.focus();
        } catch (err) {
            console.error('RABIX ERROR EN LOGINUI.SHOW:', err);
        }
    },

    hide() {
        try {
            // Ocultar login y onboarding
            document.getElementById('view-login')?.classList.add('hidden');
            document.getElementById('view-login')?.classList.remove('active');
            document.getElementById('view-onboarding')?.classList.add('hidden');
            document.getElementById('view-onboarding')?.classList.remove('active');

            // Restaurar shell de la app
            document.getElementById('app-header')?.classList.remove('hidden');
            document.querySelector('.bottom-nav')?.classList.remove('hidden');
            document.querySelector('.app-main')?.classList.remove('hidden');
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));

            // Quitar 'hidden' de todas las views de la app para que switchView funcione
            document.querySelectorAll('.app-main .view').forEach(v => v.classList.remove('hidden'));
        } catch (err) {
            console.error('ERROR EN LOGINUI.HIDE:', err);
        }
    },

    renderUserList() {
        // Lista de usuarios eliminada del login — formulario estándar con contraseña
        const list = document.getElementById('user-list');
        if (list) list.innerHTML = '';
    },

    deleteUser(userId) {
        if (confirm('¿Estás seguro de que deseas eliminar este perfil?')) {
            UserSystem.deleteUser(userId);
            App.logout();
        }
    },

    selectUser(id) {
        // No permitir acceso directo sin contraseña — ignorar llamadas legacy
        console.warn('RABIX: selectUser deshabilitado, usar formulario de login.');
    },

    initOnce() {
        if (this._initialized) return;
        this._initialized = true;

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', e => {
                e.preventDefault();
                const u = (document.getElementById('login-username').value || '').trim();
                const p = (document.getElementById('login-password').value || '').trim();
                const remember = document.getElementById('login-remember')?.checked;
                const user = UserSystem.login(u, p);
                if (user) {
                    if (remember) {
                        localStorage.setItem('rabix_remember_user', u);
                    } else {
                        localStorage.removeItem('rabix_remember_user');
                    }
                    App.initForUser(user.id);
                } else {
                    alert('Usuario o contraseña incorrectos.');
                }
            });
        }

        const newUserForm = document.getElementById('new-user-form');
        if (newUserForm) {
            newUserForm.addEventListener('submit', e => {
                e.preventDefault();
                const n   = (document.getElementById('new-user-name').value || '').trim();
                const p   = (document.getElementById('new-user-pass').value || '').trim();
                const em  = (document.getElementById('new-user-email').value || '').trim();
                const tel = (document.getElementById('new-user-tel').value || '').trim();
                const obj = LoginUI.selectedObjetivo || 'ALTO_RENDIMIENTO';
                const errEl = document.getElementById('register-error');

                // Validaciones mínimas
                if (!n) { if (errEl) { errEl.textContent = 'El nombre de usuario es obligatorio.'; errEl.classList.remove('hidden'); } return; }
                if (p.length < 4) { if (errEl) { errEl.textContent = 'La contraseña debe tener al menos 4 caracteres.'; errEl.classList.remove('hidden'); } return; }
                if (errEl) errEl.classList.add('hidden');

                try {
                    const u = UserSystem.createUser(n, p, LoginUI.selectedEmoji, obj, em, tel);
                    document.getElementById('new-user-modal-overlay').classList.add('hidden');
                    UserSystem.setCurrentUser(u.id);
                    LoginUI.showOnboarding(u.id);
                } catch (err) {
                    if (errEl) { errEl.textContent = err.message || 'Error al crear el perfil.'; errEl.classList.remove('hidden'); }
                }
            });
        }

        // btn-show-register handled in initOnce above

        const btnReset = document.getElementById('btn-emergency-reset-login');
        if (btnReset) btnReset.addEventListener('click', () => App.emergencyReset());

        // Multi-step register — open modal
        const btnShowReg2 = document.getElementById('btn-show-register');
        if (btnShowReg2 && !btnShowReg2._bound) {
            btnShowReg2._bound = true;
            btnShowReg2.addEventListener('click', () => {
                LoginUI.renderEmojiPicker();
                LoginUI.renderObjetivoPicker();
                LoginUI._regGoTo(1);
                document.getElementById('new-user-modal-overlay').classList.remove('hidden');
            });
        }

        const btnNext = document.getElementById('btn-onboarding-next');
        if (btnNext) btnNext.addEventListener('click', () => LoginUI.nextOnboardingStep());
    },

    currentOnboardingUser: null,
    onboardingStep: 0,
    onboardingData: {},
    onboardingSteps: [
        {
            id: 'frecuenciaUlt7d',
            title: '¿Cuántas sesiones reales completaste en los últimos 7 días?',
            options: [
                { label: '0 (vengo de parón)', val: '0' },
                { label: '1-2 sesiones', val: '1' },
                { label: '3-4 sesiones', val: '3' },
                { label: '5 o más sesiones', val: '5' }
            ]
        },
        {
            id: 'disponibilidadDias',
            title: '¿Cuántos días por semana podés sostener de forma realista?',
            options: [
                { label: '2 días', val: '2' },
                { label: '3 días', val: '3' },
                { label: '4 días', val: '4' },
                { label: '5+ días', val: '5' }
            ]
        },
        {
            id: 'nivel',
            title: '¿Cómo calificarías tu nivel actual?',
            options: [
                { label: 'Principiante ( < 6 meses)', val: 'principiante' },
                { label: 'Intermedio (1 - 2 años)', val: 'intermedio' },
                { label: 'Avanzado ( > 3 años)', val: 'avanzado' }
            ]
        },
        {
            id: 'duracionSesion',
            title: 'Duración media por sesión (minutos efectivos)',
            options: [
                { label: '30-45 min', val: '45' },
                { label: '60 min', val: '60' },
                { label: '75 min', val: '75' },
                { label: '90+ min', val: '90' }
            ]
        },
        {
            id: 'diaPartido',
            title: 'Si competís, ¿qué día suele ser tu partido principal?',
            options: [
                { label: 'Domingo', val: '0' },
                { label: 'Sábado', val: '6' },
                { label: 'Viernes', val: '5' },
                { label: 'No compito fijo', val: '-1' }
            ]
        },
        {
            id: 'diaDescanso',
            title: '¿Qué día querés reservar como descanso principal?',
            options: [
                { label: 'Sábado', val: '6' },
                { label: 'Domingo', val: '0' },
                { label: 'Lunes', val: '1' },
                { label: 'Flexible', val: '-1' }
            ]
        },
        {
            id: 'recuperacion',
            title: '¿Cómo venís recuperando (sueño/estrés) esta semana?',
            options: [
                { label: 'Alta (duermo bien, bajo estrés)', val: 'alta' },
                { label: 'Media', val: 'media' },
                { label: 'Baja (fatigado/estresado)', val: 'baja' }
            ]
        }
    ],

    showOnboarding(userId) {
        this.currentOnboardingUser = userId;
        this.onboardingStep = 0;
        this.onboardingData = {};

        this.initOnce();
        document.querySelectorAll('.view').forEach(v => { v.classList.add('hidden'); v.classList.remove('active'); });
        
        // Hide main app UI during onboarding for a cleaner look
        document.getElementById('app-header')?.classList.add('hidden');
        document.querySelector('.bottom-nav')?.classList.add('hidden');
        document.querySelector('.app-main')?.classList.add('hidden');

        const ov = document.getElementById('view-onboarding');
        if (ov) {
            ov.classList.remove('hidden');
            ov.classList.add('active');
        }
        this.renderOnboardingStep();
    },

    renderOnboardingStep() {
        const step = this.onboardingSteps[this.onboardingStep];
        const container = document.getElementById('onboarding-step-container');
        if (!container) return;

        container.innerHTML = `
            <div class="onboarding-step-card">
                <p class="onboarding-step-title">${step.title}</p>
                <div class="onboarding-options">
                    ${step.options.map(opt => {
            const isSelected = this.onboardingData[step.id] === opt.val || this.onboardingData[step.id] === String(opt.val);
            return `
                        <button class="onboarding-opt-btn ${isSelected ? 'selected' : ''}" 
                                onclick="LoginUI.selectOnboardingOption('${step.id}', '${opt.val}')">
                            ${opt.label}
                        </button>`;
        }).join('')}
                </div>
            </div>
        `;
    },

    selectOnboardingOption(stepId, val) {
        this.onboardingData[stepId] = val;
        this.renderOnboardingStep();
    },

    nextOnboardingStep() {
        const step = this.onboardingSteps[this.onboardingStep];
        if (this.onboardingData[step.id] === undefined) {
            alert('Por favor selecciona una opción antes de continuar');
            return;
        }

        if (this.onboardingStep < this.onboardingSteps.length - 1) {
            this.onboardingStep++;
            this.renderOnboardingStep();
        } else {
            this.finishOnboarding();
        }
    },

    finishOnboarding() {
        const userId = this.currentOnboardingUser || UserSystem.getCurrentUserId();
        const users = UserSystem.getAllUsers();
        const user = users.find(u => u.id === userId);
        if (user) {
            user.onboarding = this.onboardingData;
            user.status = 'active';
            UserSystem.saveUsers(users);
        }
        // Go directly to the dashboard
        App.initForUser(userId || UserSystem.getCurrentUserId());
    },

    _regPage: 1,

    _regGoTo(page) {
        this._regPage = page;
        [1,2,3].forEach(n => {
            const p = document.getElementById('register-page-' + n);
            const s = document.getElementById('rstep-' + n);
            if (p) p.classList.toggle('hidden', n !== page);
            if (s) s.classList.toggle('active', n === page);
        });
        const back   = document.getElementById('register-btn-back');
        const next   = document.getElementById('register-btn-next');
        const submit = document.getElementById('register-btn-submit');
        const errEl  = document.getElementById('register-error');
        if (errEl) errEl.classList.add('hidden');
        if (back)   back.classList.toggle('hidden', page === 1);
        if (next)   next.classList.toggle('hidden', page === 3);
        if (submit) submit.classList.toggle('hidden', page !== 3);
    },

    regNext() {
        const errEl = document.getElementById('register-error');
        if (this._regPage === 1) {
            const n = (document.getElementById('new-user-name').value || '').trim();
            const p = (document.getElementById('new-user-pass').value || '').trim();
            if (!n) { if (errEl) { errEl.textContent = 'El nombre de usuario es obligatorio.'; errEl.classList.remove('hidden'); } return; }
            if (p.length < 4) { if (errEl) { errEl.textContent = 'La contraseña debe tener al menos 4 caracteres.'; errEl.classList.remove('hidden'); } return; }
            if (errEl) errEl.classList.add('hidden');
        }
        if (this._regPage < 3) this._regGoTo(this._regPage + 1);
    },

    regPrev() {
        if (this._regPage > 1) this._regGoTo(this._regPage - 1);
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
        let html = '';
        CATEGORIAS_ENTRENAMIENTO.forEach(cat => {
            html += `<div class="cat-group-label">${cat.emoji} ${cat.label}</div>`;
            if (cat.id === 'GIMNASIO') {
                cat.subcategorias.forEach(sub => {
                    const obj = OBJETIVOS_DISPONIBLES.find(o => o.selectorId === sub.id);
                    const objId = obj ? obj.id : sub.id;
                    const isSelected = this.selectedObjetivo === objId;
                    html += `<button type="button" class="objetivo-pick-btn${isSelected ? ' selected' : ''}" 
                        onclick="LoginUI.pickObjetivo('${objId}')" style="--obj-color:${obj?.color || '#666'}">
                        <span>${sub.emoji}</span><span class="obj-pick-label">${sub.label}</span>
                    </button>`;
                });
            } else {
                cat.subcategorias.forEach(sub => {
                    if (sub.niveles && sub.niveles.length > 1) {
                        html += `<div class="cat-sub-label">${sub.emoji} ${sub.label}</div>`;
                        sub.niveles.forEach(niv => {
                            const obj = OBJETIVOS_DISPONIBLES.find(o => o.id === niv.id);
                            const isSelected = this.selectedObjetivo === niv.id;
                            html += `<button type="button" class="objetivo-pick-btn sub-level${isSelected ? ' selected' : ''}" 
                                onclick="LoginUI.pickObjetivo('${niv.id}')" style="--obj-color:${obj?.color || '#666'}">
                                <span class="obj-pick-label">${niv.label}</span>
                            </button>`;
                        });
                    } else {
                        const niv = sub.niveles[0];
                        const obj = OBJETIVOS_DISPONIBLES.find(o => o.id === niv.id);
                        const isSelected = this.selectedObjetivo === niv.id;
                        html += `<button type="button" class="objetivo-pick-btn${isSelected ? ' selected' : ''}" 
                            onclick="LoginUI.pickObjetivo('${niv.id}')" style="--obj-color:${obj?.color || '#666'}">
                            <span>${sub.emoji}</span><span class="obj-pick-label">${sub.label}</span>
                        </button>`;
                    }
                });
            }
        });
        picker.innerHTML = html;
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
        try {
            console.log('RABIX: Inicializando motor...');
            const uSys = window.UserSystem;
            if (!uSys) throw new Error('UserSystem not defined');
            window.addEventListener('online', () => {
                DB.flushPending().catch(() => {});
            });
            window.addEventListener('focus', () => {
                if (navigator.onLine) DB.flushPending().catch(() => {});
            });
            if (navigator.serviceWorker) {
                navigator.serviceWorker.addEventListener('message', e => {
                    if (e.data?.type === 'SYNC_NOW') {
                        DB.flushPending().catch(() => {});
                    }
                });
            }

            // Ensure admin exists
            uSys.initAdmin();

            const uid = uSys.getCurrentUserId();
            if (uid) {
                DB.setUser(uid);
                const user = uSys.getCurrentUser();

                if (!user) {
                    // User was deleted, clear session
                    localStorage.removeItem('rabix_uid');
                    window.LoginUI.show();
                    return;
                }

                // Check if onboarding incomplete
                if (!user.onboarding && user.role !== 'admin') {
                    window.LoginUI.showOnboarding(uid);
                    return;
                }

                this.reinitWithObjetivo(user?.objetivo || 'ALTO_RENDIMIENTO');
                this.checkYesterday();
                // Sincronizar datos de la nube en background
                DB.pullFromCloud(uid).then(() => {
                    UI.renderDashboard();
                }).catch(() => {});
            } else {
                window.LoginUI.show();
            }
        } catch (err) {
            console.error('RABIX CRITICAL ERROR:', err);
            alert('Error crítico de carga. Revisa la consola para más detalles.');
        }
    },

    emergencyReset() {
        localStorage.removeItem('rabix_uid');
        localStorage.clear();
        window.LoginUI.show();
    },

    logout() {
        UserSystem.clearSession();
        DB.resetUser();
        Timer.hide();
        window.LoginUI.show();
    },

    initForUser(userId) {
        DB.setUser(userId);
        UserSystem.setCurrentUser(userId);
        const user = UserSystem.getCurrentUser();
        if (!user) { this.logout(); return; }
        if (!user.onboarding && user.role !== 'admin') {
            window.LoginUI.showOnboarding(userId);
            return;
        }
        window.LoginUI.hide();
        this.reinitWithObjetivo(user.objetivo || 'ALTO_RENDIMIENTO');
        this.checkYesterday();
        // Sincronizar datos de la nube en background
        DB.pullFromCloud(userId).then(() => {
            UI.renderDashboard();
        }).catch(() => {});
    },

    confirmEndSession() {
        const rpe = parseFloat(document.getElementById('end-session-rpe').value);
        const minutos = parseInt(document.getElementById('end-session-min').value || '60');
        const cargaInterna = SportModules.calcInternalLoad(rpe, minutos);
        // Save session-level RPE entry
        DB.saveSet({
            cod: 0, fecha: Planner.todayStr(), peso: 0, series: 1, reps: 1, rpe, minutos, dolor: 0,
            notes: 'Sesión RPE global', vol_total: 0, session_rpe: true, carga_interna: cargaInterna,
        });
        const autoMutated = FatigueEngine.applyAutoRecoveryOverride();
        document.getElementById('end-session-rpe-overlay').classList.add('hidden');
        if (autoMutated) {
            alert('Semáforo amarillo activado. La sesión de mañana pasó a Recuperación Facilitada.');
        }
        if (navigator.onLine) {
            DB.flushPending().catch(() => {});
        }
        UI.switchView('dashboard');
        UI.renderDashboard();
    },

    reinitWithObjetivo(objetivoId) {
        Planner.init(objetivoId);
        FatigueEngine.setThresholds(objetivoId);
        UI.init();
        const last = Planner._plan[Planner._plan.length - 1];
        if (last && Planner.todayStr() > last.fecha) {
            document.getElementById('cycle-modal-overlay').classList.remove('hidden');
        }
    },

    startNewCycle() {
        document.getElementById('cycle-modal-overlay').classList.add('hidden');
        this.reinitWithObjetivo(UserSystem.getCurrentObjetivo());
    },

    checkYesterday() {
        const uid = UserSystem.getCurrentUserId();
        if (!uid) return;
        const lastCheckedToday = localStorage.getItem(`rabix_${uid}_yest_checked`) === this.todayStr();
        if (lastCheckedToday) return;

        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];
        const registro = DB.getRegistro();
        const hadTraining = registro.some(e => e.fecha === yStr);

        if (!hadTraining) {
            document.getElementById('yesterday-modal-overlay').classList.remove('hidden');
        }
        localStorage.setItem(`rabix_${uid}_yest_checked`, this.todayStr());
    },

    dismissYesterday() {
        document.getElementById('yesterday-modal-overlay').classList.add('hidden');
    },

    confirmYesterday() {
        this.dismissYesterday();
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];
        const session = Translator.getSessionByDate(yStr, Planner.getPlan());
        if (session) {
            UI.startTrainingForSession(session);
        } else {
            alert('No se encontró planificación para ayer.');
        }
    },

    todayStr() { return new Date().toISOString().split('T')[0]; },

    /* ══════════════════════════════════════════════════
       PAIN REPORT
    ══════════════════════════════════════════════════ */
    _painContextCod: null,

    openPainReport(ejercicioCod = null) {
        this._painContextCod = ejercicioCod || null;
        const slider = document.getElementById('pain-nivel');
        if (slider) {
            slider.value = 3;
            document.getElementById('pain-nivel-display').textContent = 3;
            this._updatePainHint(3);
            slider.oninput = (e) => {
                document.getElementById('pain-nivel-display').textContent = e.target.value;
                this._updatePainHint(parseInt(e.target.value));
            };
        }
        // Pre-seleccionar grupo si viene de un ejercicio específico
        if (ejercicioCod) {
            const ej = Translator.getByCode(ejercicioCod);
            if (ej) {
                const sel = document.getElementById('pain-grupo');
                // Intentar hacer match con el grupo del ejercicio
                const grupos = ['Piernas','Espalda','Pectoral','Brazos','Hombros','Core','Rodilla','Tobillo','Cuello'];
                const match = grupos.find(g => ej.grupo && ej.grupo.includes(g));
                if (sel && match) sel.value = match;
                // Mostrar contexto
                const ctxEl = document.getElementById('pain-context');
                const ctxTextEl = document.getElementById('pain-context-text');
                if (ctxEl) {
                    if (ctxTextEl) ctxTextEl.textContent = 'Ejercicio: ' + ej.nombre;
                    ctxEl.classList.remove('hidden');
                }
            }
        } else {
            const ctxEl = document.getElementById('pain-context');
                const ctxTextEl = document.getElementById('pain-context-text');
            if (ctxEl) ctxEl.classList.add('hidden');
        }
        document.getElementById('pain-notas').value = '';
        document.getElementById('pain-report-overlay').classList.remove('hidden');
    },

    _updatePainHint(nivel) {
        const icon = document.getElementById('pain-hint-icon');
        const text = document.getElementById('pain-hint-text');
        const hint = document.getElementById('pain-nivel-hint');
        if (!icon || !text) return;
        if (nivel === 0) {
            hint.classList.add('hidden'); return;
        }
        hint.classList.remove('hidden');
        if (nivel >= 8) { icon.textContent = '🚫'; text.textContent = 'Dolor severo — ejercicios afectados serán omitidos'; }
        else if (nivel >= 6) { icon.textContent = '🔴'; text.textContent = 'Dolor alto — −40% de carga en músculos afectados'; }
        else if (nivel >= 4) { icon.textContent = '🟡'; text.textContent = 'Dolor moderado — −20% de carga en músculos afectados'; }
        else { icon.textContent = '🟢'; text.textContent = 'Dolor leve — sin ajuste, solo monitoreo'; }
    },

    closePainReport() {
        document.getElementById('pain-report-overlay').classList.add('hidden');
    },

    confirmPainReport() {
        const grupo = document.getElementById('pain-grupo').value;
        const nivel = parseInt(document.getElementById('pain-nivel').value || '3');
        const notas = document.getElementById('pain-notas').value.trim();
        PainEngine.reportarDolor(grupo, nivel, notas, this._painContextCod);
        this._painContextCod = null;
        this.closePainReport();
        // Refrescar donde corresponda
        const trainView = document.getElementById('view-train');
        if (trainView && trainView.classList.contains('active')) {
            UI.renderExerciseList(); // Re-render tarjetas con nuevos ajustes
        }
        UI.renderDashboard();
    },

    /* ══════════════════════════════════════════════════
       PARTIDO MODAL LOGIC
    ══════════════════════════════════════════════════ */
    _partidoParticipacion: 'completo',
    _partidoMinutos: 90,

    openPartidoModal(session) {
        const sd = Planner.getScenarioData(session.escenario);
        const emojiEl = document.getElementById('partido-modal-emoji');
        const titleEl = document.getElementById('partido-modal-title');
        if (emojiEl) emojiEl.textContent = sd.emoji;
        if (titleEl) titleEl.textContent = sd.label;
        // Reset to step 1
        document.getElementById('partido-step-1').classList.remove('hidden');
        document.getElementById('partido-step-2').classList.add('hidden');
        document.getElementById('partido-step-3').classList.add('hidden');
        // Init RPE slider listener
        const rpeEl = document.getElementById('partido-rpe');
        if (rpeEl) rpeEl.oninput = function() {
            document.getElementById('partido-rpe-display').textContent = this.value;
        };
        document.getElementById('partido-modal-overlay').classList.remove('hidden');
    },

    partidoJugaste(tipo) {
        this._partidoParticipacion = tipo;
        document.getElementById('partido-step-1').classList.add('hidden');
        if (tipo === 'no') {
            // Sin minutos → mostrar sugerencias de fuga
            const mins = 0;
            this._mostrarFuga(mins);
        } else {
            // Jugó algo → pedir minutos y RPE
            const defMin = tipo === 'completo' ? 90 : 45;
            this._partidoMinutos = defMin;
            document.getElementById('partido-min').value = defMin;
            document.getElementById('partido-min-display').textContent = defMin;
            document.getElementById('partido-step-2').classList.remove('hidden');
        }
    },

    stepPartidoMin(delta) {
        let val = parseInt(document.getElementById('partido-min').value || '90') + delta;
        val = Math.max(0, Math.min(120, val));
        document.getElementById('partido-min').value = val;
        document.getElementById('partido-min-display').textContent = val;
        this._partidoMinutos = val;
    },

    confirmPartido() {
        const minutos = parseInt(document.getElementById('partido-min').value || '90');
        const rpe     = parseFloat(document.getElementById('partido-rpe').value || '8');
        const carga   = SportModules.calcInternalLoad(rpe, minutos);
        DB.saveSet({
            cod: 0,
            fecha: Planner.todayStr(),
            peso: 0, series: 1, reps: minutos,
            rpe, minutos,
            vol_total: 0,
            carga_interna: carga,
            escenario: 'PARTIDO',
            notes: `Partido: ${minutos} min — RPE ${rpe}`,
            sesion_num: 1,
            session_rpe: true,
        });
        document.getElementById('partido-modal-overlay').classList.add('hidden');
        // Si jugó poco → ofrecer fuga de todas formas
        if (minutos < 45) {
            setTimeout(() => this._mostrarFuga(minutos, true), 400);
        } else {
            UI.renderDashboard();
        }
    },

    _mostrarFuga(minutos, afterSave = false) {
        const fugas = typeof getFugaEjercicios === 'function'
            ? getFugaEjercicios(minutos)
            : [];
        const container = document.getElementById('partido-fuga-list');
        if (container) {
            container.innerHTML = fugas.map(e => `
                <div style="background:var(--surface);border-radius:var(--radius-sm);padding:12px 14px;border:1px solid var(--border);text-align:left;">
                    <p style="font-weight:700;font-size:14px;">${e.nombre}</p>
                    <p style="font-size:12px;color:var(--text-3);">${e.series} × ${e.reps} · ${e.desc}</p>
                </div>`).join('');
        }
        this._fugaEjercicios = fugas;
        if (!afterSave) document.getElementById('partido-modal-overlay').classList.remove('hidden');
        document.getElementById('partido-step-2').classList.add('hidden');
        document.getElementById('partido-step-1').classList.add('hidden');
        document.getElementById('partido-step-3').classList.remove('hidden');
        if (afterSave) document.getElementById('partido-modal-overlay').classList.remove('hidden');
    },

    startFugaSession() {
        document.getElementById('partido-modal-overlay').classList.add('hidden');
        const fugas = this._fugaEjercicios || [];
        if (!fugas.length) return;
        const sess = {
            ...Planner.getTodaySession(),
            escenario: 'RECUPERACION',
            ejs_cods: fugas.map(e => ({ cod: e.cod, series: e.series, reps: e.reps }))
        };
        UI.startTrainingForSession(sess);
    },

    dismissPartido() {
        document.getElementById('partido-modal-overlay').classList.add('hidden');
        UI.renderDashboard();
    },

    /* ══════════════════════════════════════════════════
       DESCANSO INTELIGENTE
    ══════════════════════════════════════════════════ */
    openDescansoModal() {
        // Analizar carga de los últimos 5 días
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 5);
        const co = cutoff.toISOString().split('T')[0];
        const entries = DB.getRegistro().filter(e => e.fecha >= co && e.fecha < Planner.todayStr());
        const stats   = FatigueEngine.calcStats(entries);

        const iconEl = document.getElementById('descanso-icon');
        const textEl = document.getElementById('descanso-text');
        const optsEl = document.getElementById('descanso-options');

        const cargaAlta = stats.rpe !== null && (stats.rpe > 7.5 || stats.sessions >= 4);
        const sinDatos  = stats.sessions === 0;

        if (sinDatos) {
            if (iconEl) iconEl.textContent = '📊';
            if (textEl) textEl.textContent = 'Sin datos de la semana previa. Podés entrenar si te sentís bien.';
        } else if (cargaAlta) {
            if (iconEl) iconEl.textContent = '🔴';
            if (textEl) textEl.textContent = `Semana exigente — RPE prom. ${stats.rpe.toFixed(1)}, ${stats.sessions} sesiones. Tu cuerpo necesita este descanso.`;
        } else {
            if (iconEl) iconEl.textContent = '🟢';
            if (textEl) textEl.textContent = `Carga moderada — RPE prom. ${stats.rpe !== null ? stats.rpe.toFixed(1) : '—'}, ${stats.sessions} sesiones. Podés sumar una sesión extra si querés.`;
        }

        if (optsEl) {
            if (cargaAlta) {
                optsEl.innerHTML = `
                    <button class="btn-primary" style="min-height:48px;" onclick="App.dismissDescanso()">😴 Respetar descanso (recomendado)</button>
                    <button class="btn-secondary" style="min-height:44px;color:var(--text-3);" onclick="App.descansoEntrenarIgual()">Entrenar igual →</button>`;
            } else {
                optsEl.innerHTML = `
                    <button class="btn-primary" style="min-height:48px;" onclick="App.descansoEntrenarExtra('MOVILIDAD_FULL')">🧘 Movilidad completa</button>
                    <button class="btn-secondary" style="min-height:44px;" onclick="App.descansoEntrenarExtra('CARDIO_LARGO')">🌊 Cardio suave</button>
                    <button class="btn-secondary" style="min-height:44px;" onclick="App.descansoEntrenarExtra('RECUPERACION')">💚 Recuperación activa</button>
                    <button class="btn-secondary" style="min-height:44px;color:var(--text-3);" onclick="App.dismissDescanso()">😴 Descansar igual</button>`;
            }
        }
        document.getElementById('descanso-modal-overlay').classList.remove('hidden');
    },

    dismissDescanso() {
        document.getElementById('descanso-modal-overlay').classList.add('hidden');
    },

    descansoEntrenarIgual() {
        document.getElementById('descanso-modal-overlay').classList.add('hidden');
        UI.startTrainingForSession({ ...Planner.getTodaySession(), escenario: 'RECUPERACION', ejs_cods: [...(ESCENARIOS['RECUPERACION']?.ejercicios || [])].map(c => ({cod:c,series:3,reps:'15'})) });
    },

    descansoEntrenarExtra(escenario) {
        document.getElementById('descanso-modal-overlay').classList.add('hidden');
        const ejs = [...(ESCENARIOS[escenario]?.ejercicios || [])].map(c => ({cod:c,series:3,reps:'12'}));
        UI.startTrainingForSession({ ...Planner.getTodaySession(), escenario, ejs_cods: ejs });
    },
};

/* ── Expose globals ── */
window.UI = UI;
window.App = App;
window.LoginUI = LoginUI;
window.Mobility = Mobility;
window.Timer = Timer;
window.DB = DB;

document.addEventListener('DOMContentLoaded', () => App.init());
