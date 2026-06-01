/*
    RAVIX V5 — ATHLETE DASHBOARD ENGINE (PREMIUM)
    Motor del Dashboard del Atleta - Laboratorio de Rendimiento
    Cometti Protocol × Foster Method × Hooper Scale
*/

/* ─────────────────────────────────────────
   PLAYER ENGINE (DT View — lista de atletas)
───────────────────────────────────────── */
window.PlayerEngine = {
    init: function() {
        if (window.App && window.App.currentRole === 'athlete') {
            // El path de atleta es manejado por AthleteApp, no PlayerEngine
            if (window.AthleteApp) window.AthleteApp.init();
            return;
        }
        // Ocultar solo las secciones que no son el destino
        const targetId = 'view-athletes';
        const target = document.getElementById(targetId);
        if (!target) {
            console.error('[ROUTER ERROR] No se encontró la vista: #' + targetId);
            alert('[RAVIX ROUTER] La vista #' + targetId + ' no existe en el DOM.');
            return;
        }
        document.querySelectorAll('.view-section').forEach(s => {
            if (s.id !== targetId) s.style.display = 'none';
        });
        target.style.display = 'block';
        this.loadAthletes();
    },

    saveReadiness: async function() {
        const sleep = parseInt(document.getElementById('input-sleep').value);
        const fatigue = parseInt(document.getElementById('input-fatigue').value);
        // Guardamos estado original del botón para restaurar después
        const originalText = btn ? btn.textContent : '';
        if (btn) {
            btn.textContent = "Registrando...";
            btn.style.opacity = "0.7";
            btn.disabled = true;
        }

        // Validación única
        if (!sleep || !fatigue) {
            alert("Por favor, completá ambos valores de la escala de Hooper.");
            // Restauramos botón antes de abortar
            if (btn) {
                btn.textContent = originalText;
                btn.style.opacity = "1";
                btn.disabled = false;
            }
            return;
        }

        // Feedback visual de carga (already set above, no need to repeat)
        // const originalText = btn.textContent; // removed duplicate
        // btn.textContent = "Registrando...";
        // btn.style.opacity = "0.7";

        // Obtenemos el ID del atleta logueado (Asegurate de que currentUser exista en tu app)
        const user = window.App.currentUser || (await window.supabase.auth.getUser()).data.user; 
        const userId = user ? user.id : null;

        if (!userId) {
            console.error("No hay usuario logueado");
            return;
        }

        // Usamos tu nuevo ORM súper estable para insertar los datos
        const { data, error } = await window.supabase
            .from('athlete_readiness') // Asegurate de que esta tabla exista en Supabase
            .insert([
                { 
                    athlete_id: userId, 
                    sleep_quality: sleep, 
                    fatigue_level: fatigue,
                    date: new Date().toISOString().split('T')[0] // Guarda la fecha "YYYY-MM-DD"
                }
            ]);

        if (error) {
            console.error("Supa Error:", error.message, error.details, error.hint);
            alert("Faltan datos requeridos o hubo un error al guardar.");
            if (btn) {
                btn.textContent = originalText;
                btn.style.opacity = "1";
                btn.disabled = false;
            }
            return;
        }

        // Éxito: Feedback visual premium
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = "#1a1a1e"; // Vuelve al oscuro
            btn.style.opacity = "1";
        }, 2500);
    },

    loadAthletes: async function() {
        const uid   = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');
        const grid  = document.getElementById('athlete-grid');
        if (!grid) return;

        grid.innerHTML = '<p class="aw-empty-state">Cargando atletas...</p>';
        try {
            const { data: athletes, error } = await window.supabase.from('profiles_athlete').select('*').eq('coach_id', uid).order('created_at', { ascending: false });
            if (error || !Array.isArray(athletes) || athletes.length === 0) {
                grid.innerHTML = `
                    <div class="aw-empty-state">
                        <div class="aw-empty-icon">🏅</div>
                        <h3>Sin atletas registrados</h3>
                        <p>Los atletas aparecerán aquí una vez que completen su registro.</p>
                    </div>`;
                return;
            }
            this.render(athletes);
        } catch (e) {
            console.error('🔴 PlayerEngine.loadAthletes:', e);
            grid.innerHTML = `<div class="aw-empty-state"><p>Error al cargar atletas.</p></div>`;
        }
    },

    render: function(athletes) {
        const grid = document.getElementById('athlete-grid');
        if (!grid) return;
        grid.innerHTML = athletes.map(a => `
            <div class="athlete-card">
                <h3 style="font-family:Outfit; margin:0; font-size:1.1rem;">${a.full_name || 'Atleta'}</h3>
                <p style="color:#bf953f; font-weight:900; font-size:11px; margin-top:4px; letter-spacing:1px;">
                    ${(a.sport || '—').toUpperCase()} ${a.position ? '| ' + a.position.toUpperCase() : ''}
                </p>
                <hr style="opacity:0.1; margin:12px 0;">
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; font-size:10px; font-weight:700; color:#999;">
                    <div>ESTRUCTURA<br><span style="color:#1a1a2e; font-size:13px; font-weight:800;">${a.weight_kg ? a.weight_kg + 'kg' : '—'} / ${a.height_cm ? a.height_cm + 'cm' : '—'}</span></div>
                    <div>OBJETIVO<br><span style="color:#1a1a2e; font-size:12px; font-weight:800;">${a.goal || '—'}</span></div>
                    <div>NACIMIENTO<br><span style="color:#1a1a2e; font-size:12px; font-weight:800;">${a.birth_date || '—'}</span></div>
                </div>
            </div>
        `).join('');
    }
};


/* ─────────────────────────────────────────
   ATHLETE APP — MOTOR PRINCIPAL DEL DASHBOARD
───────────────────────────────────────── */
window.AthleteApp = {

    /* ── Estado interno del día ── */
    state: {
        dailyLog: {
            session_type: 'Entrenamiento Club',
            duration_min: 90,
            rpe_score: 5,
            sleep_quality: 3,
            stress_level: 3,
            fatigue: 3,
            muscle_soreness: 3,
            mood: 3
        },
        strength: { sets: [], totalTonnage: 0 },
        readiness: null,
        currentRegime: 'Concéntrico',
    },

    /* ════════════════════
       INICIALIZACIÓN
    ═══════════════════ */
    init: function() {
        // ── FAILSAFE: verificar vista destino ANTES de ocultar nada ──
        const targetId = 'view-athlete-dashboard';
        const view = document.getElementById(targetId);
        if (!view) {
            console.error('[ROUTER ERROR] No se encontró la vista: #' + targetId);
            alert(
                '[RAVIX ROUTER] La vista #' + targetId + ' no existe en el DOM.\n' +
                'La transición fue abortada para no dejar pantalla en blanco.'
            );
            return;
        }

        // Ocultar el resto de secciones (sin tocar la destino)
        document.querySelectorAll('.view-section').forEach(s => {
            if (s.id !== targetId) s.style.display = 'none';
        });

        // Mostrar dashboard del atleta
        view.style.display = 'flex'; // usa flex para el layout columna

        this.setupDate();
        this.setupUserProfile();
        this.setupDailyLogInteractions();
        this.setupStrengthInteractions();

        // Readiness inicial animado con delay
        setTimeout(() => this.updateReadiness(null), 400);
    },

    /* ─── Fecha y saludo ─── */
    setupDate: function() {
        const el = document.getElementById('ad-date');
        if (!el) return;
        const now = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        el.textContent = now.toLocaleDateString('es-ES', options).toUpperCase();
    },

    /* ─── Perfil de usuario ─── */
    setupUserProfile: function() {
        const user = window.CurrentUser;
        if (!user) return;

        const nameEl = document.getElementById('ad-user-name');
        if (nameEl && user.full_name) {
            nameEl.textContent = user.full_name.split(' ')[0];
        }

        const sportEl = document.getElementById('ad-sport-tag');
        if (sportEl && user.sport) {
            sportEl.textContent = `${user.sport.toUpperCase()}${user.position ? ' · ' + user.position.toUpperCase() : ''}`;
        }
    },

    /* ════════════════════
       READINESS RING
    ═══════════════════ */
    updateReadiness: function(score) {
        const scoreEl  = document.getElementById('ad-readiness-score');
        const statusEl = document.getElementById('adp-ring-status');
        const ring     = document.getElementById('adp-ring-fill');

        if (!ring) return;

        // Circunferencia: 2π × r = 2π × 42 ≈ 263.9
        const CIRC = 2 * Math.PI * 42; // 263.9

        if (score === null) {
            if (scoreEl)  scoreEl.textContent = '—';
            if (statusEl) statusEl.textContent = 'SIN DATOS';
            ring.style.strokeDashoffset = CIRC; // vacío
            return;
        }

        this.state.readiness = score;
        const clamped = Math.max(0, Math.min(100, score));
        const offset  = CIRC - (clamped / 100) * CIRC;

        ring.style.strokeDashoffset = offset;

        if (scoreEl) {
            // Animación numérica tipo contador
            let current = parseInt(scoreEl.textContent) || 0;
            const step = Math.ceil(Math.abs(clamped - current) / 20);
            const timer = setInterval(() => {
                if (current < clamped) {
                    current = Math.min(current + step, clamped);
                } else if (current > clamped) {
                    current = Math.max(current - step, clamped);
                } else {
                    clearInterval(timer);
                }
                scoreEl.textContent = current;
            }, 30);
        }

        if (statusEl) {
            if (score >= 80) {
                statusEl.textContent = 'ÓPTIMO';
                statusEl.style.color = 'rgba(16,185,129,0.9)';
            } else if (score >= 60) {
                statusEl.textContent = 'MODERADO';
                statusEl.style.color = 'rgba(245,158,11,0.9)';
            } else {
                statusEl.textContent = 'PRECAUCIÓN';
                statusEl.style.color = 'rgba(239,68,68,0.9)';
            }
        }
    },

    /* ─── Calcula el Readiness a partir del estado ─── */
    _calcReadiness: function() {
        const w = this.state.wellness;
        if (!w.submitted) return null;

        // Sleep (1–4): 1=Mala→40pts, 4=Excelente→100pts
        const sleepScore = [0, 40, 65, 82, 100][w.sleep] || 65;

        // Stress invertido (1=Bajo→100, 10=Extremo→10)
        const stressScore = Math.round(110 - (w.stress * 10));

        // Hooper invertido (1=Sin dolor→100, 7=Extremo→10)
        const hooperScore = Math.round(100 - ((w.hooper - 1) * 15));

        const avg = Math.round((sleepScore + stressScore + hooperScore) / 3);
        return Math.max(10, Math.min(100, avg));
    },

    /* ════════════════════
       DAILY LOG — SETUP & SUBMIT
    ═══════════════════ */
    setupDailyLogInteractions: function() {
        // Segmented Control (Tipo de Sesión)
        const segBtns = document.querySelectorAll('#session-type-group .adp-seg-btn');
        segBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                segBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.dailyLog.session_type = btn.dataset.type;
            });
        });

        // Hooper Blocks
        const hooperRows = document.querySelectorAll('.adp-hooper-row');
        hooperRows.forEach(row => {
            const metric = row.dataset.metric;
            const btns = row.querySelectorAll('.adp-h-btn');
            btns.forEach(btn => {
                btn.addEventListener('click', () => {
                    btns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.state.dailyLog[metric] = parseInt(btn.dataset.val);
                });
            });
        });
        
        // Duration Input Sync
        const durationInput = document.getElementById('input-duration');
        if (durationInput) {
            durationInput.addEventListener('input', () => {
                this.state.dailyLog.duration_min = parseInt(durationInput.value) || 0;
            });
        }
    },

    adjustDuration: function(diff) {
        const input = document.getElementById('input-duration');
        if (input) {
            let current = parseInt(input.value) || 0;
            current = Math.max(0, current + diff);
            input.value = current;
            this.state.dailyLog.duration_min = current;
        }
    },

    updateRangeDisplay: function(rangeId, displayId, value, suffix) {
        const disp = document.getElementById(displayId);
        if (disp) disp.textContent = `${value} ${suffix}`;
        if (rangeId === 'input-rpe') {
            this.state.dailyLog.rpe_score = parseInt(value);
        }
    },

    submitDailyLog: async function() {
        const btn = document.getElementById('btn-submit-daily');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Enviando...`;
            btn.style.opacity = '0.7';
        }

        try {
            // Get from window.CurrentUser or window.App.currentUser
            const user = window.CurrentUser || window.App?.currentUser;
            if (!user) throw new Error("No hay usuario logueado.");

            const teamId = user.team_id || window.CurrentTeam?.id; 

            const payload = {
                player_id: user.id,
                team_id: teamId,
                fecha: new Date().toISOString().split('T')[0], // YYYY-MM-DD
                session_type: this.state.dailyLog.session_type,
                duration_min: this.state.dailyLog.duration_min,
                rpe_score: this.state.dailyLog.rpe_score,
                sleep_quality: this.state.dailyLog.sleep_quality,
                stress_level: this.state.dailyLog.stress_level,
                fatigue: this.state.dailyLog.fatigue,
                muscle_soreness: this.state.dailyLog.muscle_soreness,
                mood: this.state.dailyLog.mood
            };

            const { error } = await window.supabase
                .from('player_daily_logs')
                .insert([payload]);

            if (error) throw error;

            this._showToast('✅ ¡Reporte enviado con éxito!');
            
            // Update chip manually as feedback
            this._updateChip('chip-load', 'chip-load-val', `${payload.duration_min * payload.rpe_score} UA`, true);
            this._updateChip('chip-wellness', 'chip-wellness-val', 'Completado', true);

            if (btn) {
                btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Reporte Enviado ✓`;
                btn.style.opacity = '1';
                btn.style.background = '#10B981';
            }

        } catch (err) {
            console.error("Error submitDailyLog:", err);
            this._showToast('⚠️ Hubo un error al enviar el reporte.', 'warn');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Reintentar Envío`;
                btn.style.opacity = '1';
            }
        }
    },

    /* ════════════════════
       FUERZA — SETUP
    ═══════════════════ */
    setupStrengthInteractions: function() {
        const regimeBtns = document.querySelectorAll('#strength-regime .adp-regime-btn');
        regimeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                regimeBtns.forEach(b => b.classList.remove('adp-regime-btn--active'));
                btn.classList.add('adp-regime-btn--active');
                this.state.currentRegime = btn.dataset.regime;
            });
        });
    },

    calculateTonnage: function() {
        const sets   = parseInt(document.getElementById('strength-sets')?.value) || 0;
        const reps   = parseInt(document.getElementById('strength-reps')?.value) || 0;
        const weight = parseFloat(document.getElementById('strength-weight')?.value) || 0;
        const ton    = sets * reps * weight;

        // Formula previews
        const setsP   = document.getElementById('str-sets-preview');
        const repsP   = document.getElementById('str-reps-preview');
        const weightP = document.getElementById('str-weight-preview');
        const result  = document.getElementById('strength-result');

        if (setsP)   setsP.textContent   = sets   || '—';
        if (repsP)   repsP.textContent   = reps   || '—';
        if (weightP) weightP.textContent = weight ? `${weight}kg` : '—';

        if (result) {
            result.textContent = ton;
            result.style.transform = 'scale(1.1)';
            setTimeout(() => { result.style.transform = ''; }, 180);
        }
    },

    saveStrength: function() {
        const sets   = parseInt(document.getElementById('strength-sets')?.value) || 0;
        const reps   = parseInt(document.getElementById('strength-reps')?.value) || 0;
        const weight = parseFloat(document.getElementById('strength-weight')?.value) || 0;

        if (!sets || !reps || !weight) {
            this._showToast('⚠️ Completa Series, Reps y Carga antes de añadir.', 'warn');
            return;
        }

        const tonnage = sets * reps * weight;
        const regime  = this.state.currentRegime;

        // Agregar al log
        const entry = { sets, reps, weight, tonnage, regime };
        this.state.strength.sets.push(entry);
        this.state.strength.totalTonnage += tonnage;

        this._renderSetsLog();
        this._updateChip('chip-strength', 'chip-strength-val', `${this.state.strength.totalTonnage} kg`, true);

        // Limpiar inputs
        document.getElementById('strength-sets').value   = '';
        document.getElementById('strength-reps').value   = '';
        document.getElementById('strength-weight').value = '';
        this.calculateTonnage();

        this._showToast(`🏋️ Serie añadida · Tonelaje: ${tonnage} kg`);
    },

    _renderSetsLog: function() {
        const empty   = document.getElementById('sets-log-empty');
        const list    = document.getElementById('sets-log-list');
        const total   = document.getElementById('sets-total-row');
        const accum   = document.getElementById('sets-accumulated');

        if (!list) return;

        const sets = this.state.strength.sets;

        if (sets.length === 0) {
            if (empty) empty.style.display = 'flex';
            if (total) total.style.display = 'none';
            list.innerHTML = '';
            return;
        }

        if (empty) empty.style.display = 'none';
        if (total) total.style.display = 'flex';
        if (accum) accum.textContent = `${this.state.strength.totalTonnage} kg`;

        list.innerHTML = sets.map((s, i) => `
            <div class="adp-set-row">
                <span class="adp-set-regime">${s.regime}</span>
                <span class="adp-set-formula">${s.sets}×${s.reps} · ${s.weight}kg</span>
                <span class="adp-set-tonnage">${s.tonnage} kg</span>
            </div>
        `).join('');
    },

    /* ════════════════════
       NAVEGACIÓN
    ═══════════════════ */
    switchTab: function(tabId, btnEl) {
        // Actualizar estado activo en navbar
        document.querySelectorAll('.adp-nav-item').forEach(n => n.classList.remove('adp-nav-item--active'));
        if (btnEl) btnEl.classList.add('adp-nav-item--active');

        if (tabId === 'dashboard') {
            // Ya estamos aquí
        } else {
            this._showToast('📊 Módulo en construcción. Próximamente.');
        }
    },

    /* ════════════════════
       HELPERS
    ═══════════════════ */
    _updateChip: function(chipId, valId, text, done) {
        const chip = document.getElementById(chipId);
        const val  = document.getElementById(valId);
        if (val) val.textContent = text;
        if (chip && done) {
            chip.classList.add('adp-chip--done');
            const dot = chip.querySelector('.adp-chip-dot');
            if (dot) {
                dot.classList.remove('adp-chip-dot--pending');
                dot.classList.add('adp-chip-dot--done');
            }
        }
    },

    _showToast: function(message, type = 'success') {
        // Eliminar toast anterior si existe
        const prev = document.getElementById('adp-toast');
        if (prev) prev.remove();

        const toast = document.createElement('div');
        toast.id = 'adp-toast';
        toast.textContent = message;
        Object.assign(toast.style, {
            position:     'fixed',
            bottom:       '90px',
            left:         '50%',
            transform:    'translateX(-50%) translateY(10px)',
            background:   type === 'warn' ? '#1C1C1E' : 'linear-gradient(135deg, #1C1C1E, #2a2a2e)',
            color:        '#fff',
            padding:      '12px 20px',
            borderRadius: '28px',
            fontSize:     '13px',
            fontWeight:   '700',
            fontFamily:   "'Inter', sans-serif",
            boxShadow:    '0 8px 24px rgba(0,0,0,0.3)',
            zIndex:       '10000',
            opacity:      '0',
            transition:   'all 0.3s cubic-bezier(0.16,1,0.3,1)',
            whiteSpace:   'nowrap',
            border:       type === 'warn' ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(191,149,63,0.3)',
        });

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(8px)';
            setTimeout(() => toast.remove(), 350);
        }, 3000);
    }
};
