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
            if (window.AthleteApp) window.AthleteApp.init();
            return;
        }
        document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
        const view = document.getElementById('view-athletes');
        if (view) {
            view.style.display = 'block';
            this.loadAthletes();
        }
    },

    loadAthletes: async function() {
        const uid   = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');
        const grid  = document.getElementById('athlete-grid');
        if (!grid) return;

        grid.innerHTML = '<p class="aw-empty-state">Cargando atletas...</p>';
        try {
            const r = await fetch(
                `${window.SUPABASE_URL}/rest/v1/profiles_athlete?coach_id=eq.${uid}&order=created_at.desc`,
                { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` } }
            );
            const athletes = await r.json();
            if (!r.ok || !Array.isArray(athletes) || athletes.length === 0) {
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
        wellness: { sleep: 3, stress: 3, hooper: 2, submitted: false },
        load:     { duration: null, rpe: null, submitted: false },
        strength: { sets: [], totalTonnage: 0 },
        readiness: null,
        currentRegime: 'Concéntrico',
    },

    /* ════════════════════
       INICIALIZACIÓN
    ═══════════════════ */
    init: function() {
        document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
        const view = document.getElementById('view-athlete-dashboard');
        if (!view) return;
        view.style.display = 'flex'; // usa flex para el layout columna

        this.setupDate();
        this.setupUserProfile();
        this.setupWellnessInteractions();
        this.setupLoadInteractions();
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
       WELLNESS — SETUP
    ═══════════════════ */
    setupWellnessInteractions: function() {
        // Sleep buttons cluster
        const sleepBtns = document.querySelectorAll('#wellness-sleep .adp-cluster-btn');
        sleepBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                sleepBtns.forEach(b => b.classList.remove('adp-cluster-btn--active'));
                btn.classList.add('adp-cluster-btn--active');
                this.state.wellness.sleep = parseInt(btn.dataset.value);

                const labels = ['', 'Mala', 'Regular', 'Buena', 'Excelente'];
                const disp = document.getElementById('sleep-display');
                if (disp) disp.textContent = labels[this.state.wellness.sleep] || '';
            });
        });

        // Stress range
        const stressRange = document.getElementById('wellness-stress');
        if (stressRange) {
            stressRange.addEventListener('input', () => {
                const val = parseInt(stressRange.value);
                this.state.wellness.stress = val;
                this.updateRangeDisplay('wellness-stress', 'stress-display', val, '/ 10');
            });
        }

        // Hooper dots
        const hooperDots = document.querySelectorAll('#wellness-hooper-dots .adp-hooper-dot');
        hooperDots.forEach(dot => {
            dot.addEventListener('click', () => {
                hooperDots.forEach(d => d.classList.remove('adp-hooper-dot--active'));
                dot.classList.add('adp-hooper-dot--active');
                const val = parseInt(dot.dataset.val);
                this.state.wellness.hooper = val;
                const disp = document.getElementById('hooper-display');
                if (disp) disp.textContent = `${val} / 7`;
            });
        });
    },

    updateRangeDisplay: function(rangeId, displayId, value, suffix) {
        const disp = document.getElementById(displayId);
        if (disp) disp.textContent = `${value} ${suffix}`;
    },

    saveWellness: function() {
        const w = this.state.wellness;
        w.submitted = true;

        // Calcular readiness
        const readiness = this._calcReadiness();
        this.updateReadiness(readiness);

        // Actualizar badge
        const badge = document.getElementById('wellness-badge');
        if (badge) {
            badge.textContent = 'COMPLETADO ✓';
            badge.className = 'adp-badge adp-badge--done';
        }

        // Actualizar chip header
        this._updateChip('chip-wellness', 'chip-wellness-val', 'Readiness: ' + readiness, true);

        // Feedback visual en el card
        const card = document.getElementById('widget-wellness');
        if (card) {
            card.style.transition = 'transform 0.3s, box-shadow 0.3s';
            card.style.transform = 'scale(1.01)';
            card.style.boxShadow = '0 12px 40px rgba(16,185,129,0.12)';
            setTimeout(() => {
                card.style.transform = '';
                card.style.boxShadow = '';
            }, 500);
        }

        this._showToast('✅ Wellness registrado. Readiness calculado.');
    },

    /* ════════════════════
       CARGA — SETUP
    ═══════════════════ */
    setupLoadInteractions: function() {
        // RPE visual scale: click para sincronizar con input
        const rpeDots = document.querySelectorAll('#rpe-dots .adp-rpe-dot');
        const rpeInput = document.getElementById('load-rpe');

        rpeDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const val = parseInt(dot.dataset.rpe);
                if (rpeInput) {
                    rpeInput.value = val;
                    this.calculateLoad();
                }
                this._highlightRpeDots(val);
            });
        });

        // Sync rpe input → visual dots
        if (rpeInput) {
            rpeInput.addEventListener('input', () => {
                const val = parseInt(rpeInput.value);
                if (val >= 1 && val <= 10) this._highlightRpeDots(val);
                else this._highlightRpeDots(null);
            });
        }
    },

    _highlightRpeDots: function(activeVal) {
        document.querySelectorAll('#rpe-dots .adp-rpe-dot').forEach(dot => {
            const v = parseInt(dot.dataset.rpe);
            dot.className = 'adp-rpe-dot';
            if (activeVal !== null && v <= activeVal) {
                dot.classList.add(`rpe-${v}`);
            }
        });
    },

    calculateLoad: function() {
        const dur  = parseInt(document.getElementById('load-duration')?.value) || 0;
        const rpe  = parseInt(document.getElementById('load-rpe')?.value) || 0;
        const load = dur * rpe;

        // Actualizar previews de fórmula
        const durPrev = document.getElementById('load-dur-preview');
        const rpePrev = document.getElementById('load-rpe-preview');
        const result  = document.getElementById('load-result');

        if (durPrev) durPrev.textContent = dur || '—';
        if (rpePrev) rpePrev.textContent = rpe || '—';
        if (result) {
            result.textContent = load;
            // micro-bump animation
            result.style.transform = 'scale(1.1)';
            setTimeout(() => { result.style.transform = ''; }, 180);
        }

        this.state.load.duration = dur;
        this.state.load.rpe      = rpe;
    },

    saveLoad: function() {
        const dur  = this.state.load.duration || 0;
        const rpe  = this.state.load.rpe || 0;
        const load = dur * rpe;

        if (!dur || !rpe) {
            this._showToast('⚠️ Ingresa la duración y el RPE antes de registrar.', 'warn');
            return;
        }

        this.state.load.submitted = true;

        // Chip update
        this._updateChip('chip-load', 'chip-load-val', `${load} UA`, true);

        // Limpiar
        document.getElementById('load-duration').value = '';
        document.getElementById('load-rpe').value = '';
        this.calculateLoad();
        this._highlightRpeDots(null);

        this._showToast(`🔥 Sesión registrada · Carga: ${load} UA`);
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
