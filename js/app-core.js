/* 
    RAVIX V5 - CORE ARCHITECTURE
    Auth, Router Guard & Onboarding Logic
*/

// --- SUPABASE CONFIGURATION ---
window.SUPA_URL = 'https://rscdpwarzltozigfbmev.supabase.co';
window.SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzY2Rwd2Fyemx0b3ppZ2ZibWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjYyNjUsImV4cCI6MjA5MTg0MjI2NX0.WaKWoCxbaQ3VVDXLtfBvNyB9zywxZRHCwjzT-5gS-b0';
window.SUPABASE_URL = window.SUPA_URL;
window.SUPABASE_KEY = window.SUPA_KEY;

window.Wizard = {
    step: 1,
    path: 'create',
    mode: 'dt', // 'dt' | 'athlete'

    // Inicializar modo según el rol seleccionado en el portal
    startFor(role) {
        this.mode = role;
        this.step = 1;

        if (role === 'athlete') {
            // ── NUEVO ONBOARDING ATLETA ──
            // Ocultamos todo lo demás
            document.getElementById('view-login').style.display = 'none';
            document.getElementById('view-portal').style.display = 'none';
            const shell = document.getElementById('app-shell');
            if (shell) shell.style.display = 'none';

            // Mostramos la nueva pantalla premium con fade-in
            const oaView = document.getElementById('view-onboarding-athlete');
            if (oaView) {
                oaView.style.display = 'flex';
                // Doble rAF: primero el display, luego la transición de opacidad
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        oaView.classList.add('oa-visible');
                        // Init del wizard DESPUÉS de que el DOM sea visible
                        if (window.AthWizard) window.AthWizard.init();
                    });
                });
            }
        } else {
            // ── WIZARD DT (original) ──
            const onboarding = document.getElementById('view-onboarding');
            if (onboarding) onboarding.style.display = 'flex';
            document.getElementById('wizard-dt').style.display  = 'block';
            document.getElementById('wizard-athlete').style.display = 'none';
        }
    },

    // ── PATH DT (existente) ──
    setPath(p) {
        this.path = p;
        document.querySelectorAll('.path-card').forEach(c => c.classList.remove('active'));
        document.getElementById(`path-card-${p}`)?.classList.add('active');
        document.getElementById('ob-ui-create').style.display = p === 'create' ? 'block' : 'none';
        document.getElementById('ob-ui-join').style.display   = p === 'join'   ? 'block' : 'none';
    },

    nextStep() {
        const maxStep = this.mode === 'athlete' ? 3 : 3;
        if (this.step < maxStep) {
            const prefix = this.mode === 'athlete' ? 'ath' : 'ob';
            document.getElementById(`${prefix}-step-${this.step}`).style.display = 'none';
            this.step++;
            document.getElementById(`${prefix}-step-${this.step}`).style.display = 'block';
            this.updateStepper();
        }
    },

    prevStep() {
        if (this.step > 1) {
            const prefix = this.mode === 'athlete' ? 'ath' : 'ob';
            document.getElementById(`${prefix}-step-${this.step}`).style.display = 'none';
            this.step--;
            document.getElementById(`${prefix}-step-${this.step}`).style.display = 'block';
            this.updateStepper();
        }
    },

    updateStepper() {
        const prefix = this.mode === 'athlete' ? 'ath-ball' : 'ob-ball';
        for (let i = 1; i <= 3; i++) {
            const ball = document.getElementById(`${prefix}-${i}`);
            if (ball) ball.classList.toggle('active', i <= this.step);
        }
    },

    // ── FINISH PATH DT ──
    async finish() {
        const uid   = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');
        const name  = document.getElementById('ob-name').value;
        const role  = document.getElementById('ob-role').value;
        const license = document.getElementById('ob-license').value;
        if (!name) return alert('Por favor, ingresa tu nombre.');

        try {
            let teamId = null;
            if (this.path === 'create') {
                const tName  = document.getElementById('ob-team-name').value || 'Mi Club';
                const tColor = document.getElementById('ob-team-color').value;
                const tMethodology = document.getElementById('ob-methodology').value;
                const tSystems = document.getElementById('ob-systems-input').value;
                const tCode  = 'CU-' + Math.floor(1000 + Math.random() * 9000);

                const tRes = await fetch(`${window.SUPABASE_URL}/rest/v1/teams`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}`, 'Prefer': 'return=representation' },
                    body: JSON.stringify({ name: tName, code: tCode, owner_id: uid })
                });
                const teams = await tRes.json();
                if (!tRes.ok || !teams[0]) throw new Error('Error al fundar equipo.');
                teamId = teams[0].id;

                await fetch(`${window.SUPABASE_URL}/rest/v1/team_configs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ team_id: teamId, owner_id: uid, primary_color: tColor, methodology: tMethodology, base_systems: tSystems })
                });
            } else {
                const code = document.getElementById('ob-invite-code').value;
                const tRes = await fetch(`${window.SUPABASE_URL}/rest/v1/teams?code=eq.${code}`, {
                    headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
                });
                const teams = await tRes.json();
                if (!teams || !teams[0]) throw new Error('Código inválido o equipo no encontrado.');
                teamId = teams[0].id;
            }

            const uRes = await fetch(`${window.SUPABASE_URL}/rest/v1/users?id=eq.${uid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, staff_role: role, license, team_id: teamId })
            });
            if (!uRes.ok) throw new Error('Error al actualizar perfil.');
            location.reload();
        } catch (err) { alert(err.message); }
    },

    // ── FINISH PATH ATLETA ──
    async finishAthlete() {
        const uid   = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');

        const fullName  = document.getElementById('ath-name').value;
        const sport     = document.getElementById('ath-sport').value;
        const position  = document.getElementById('ath-position').value;
        const birthDate = document.getElementById('ath-birth').value;
        const weight    = document.getElementById('ath-weight').value;
        const height    = document.getElementById('ath-height').value;
        const wingspan  = document.getElementById('ath-wingspan').value;
        const goal      = document.getElementById('ath-goal').value;

        if (!fullName || !sport) return alert('Por favor, completa los campos obligatorios.');

        try {
            // Verificar si ya existe un perfil atleta para este uid
            const check = await fetch(
                `${window.SUPABASE_URL}/rest/v1/profiles_athlete?user_id=eq.${uid}`,
                { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` } }
            );
            const existing = await check.json();

            let res;
            if (existing && existing.length > 0) {
                // Ya existe — actualizar
                res = await fetch(`${window.SUPABASE_URL}/rest/v1/profiles_athlete?user_id=eq.${uid}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ full_name: fullName, sport, position, birth_date: birthDate, weight_kg: weight, height_cm: height, wingspan_cm: wingspan, goal })
                });
            } else {
                // Crear nuevo perfil atleta
                res = await fetch(`${window.SUPABASE_URL}/rest/v1/profiles_athlete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ user_id: uid, full_name: fullName, sport, position, birth_date: birthDate, weight_kg: weight, height_cm: height, wingspan_cm: wingspan, goal })
                });
            }

            if (!res.ok) throw new Error('Error al guardar perfil de atleta.');
            console.log('✅ Perfil atleta guardado.');
            location.reload();
        } catch (err) { alert(err.message); }
    }
};

window.App = {
    currentRole: 'dt', // 'dt' | 'athlete' — seteado por el Portal
    isProcessingAuth: false, // Candado anti-race-condition

    async init() {
        const uid = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');
        if (uid && token) {
            // Sesion activa: saltar el portal y restaurar directo
            this.checkSession(uid, token);
            window.addEventListener('hashchange', () => this.handleRouting());
        } else {
            // Sin sesión: mostrar Portal de Entrada
            document.getElementById('view-portal').style.display = 'flex';
        }
    },

    selectRole: function(role) {
        this.currentRole = role;

        const body = document.body;
        const subtitle = document.getElementById('login-subtitle');
        const emailInput = document.getElementById('login-username');
        const submitBtn = document.getElementById('login-submit-btn');

        if (role === 'athlete') {
            body.classList.add('mode-athlete', 'testing-athlete');
            body.classList.remove('mode-dt');
            if (subtitle) subtitle.textContent = 'LABORATORIO DE RENDIMIENTO';
            if (emailInput) emailInput.placeholder = 'ID de Atleta o Email';
            if (submitBtn) submitBtn.textContent = 'ACCEDER AL LABORATORIO';
        } else {
            body.classList.add('mode-dt');
            body.classList.remove('mode-athlete', 'testing-athlete');
            if (subtitle) subtitle.textContent = 'ALTO RENDIMIENTO — STAFF';
            if (emailInput) emailInput.placeholder = 'Email de Staff';
            if (submitBtn) submitBtn.textContent = 'ENTRAR AL SISTEMA';
        }

        // Transición suave portal → login
        const portal = document.getElementById('view-portal');
        const login  = document.getElementById('view-login');
        if (portal) { portal.style.opacity = '0'; portal.style.pointerEvents = 'none'; setTimeout(() => { portal.style.display = 'none'; portal.style.opacity = ''; portal.style.pointerEvents = ''; }, 380); }
        if (login)  { login.style.display = 'flex'; requestAnimationFrame(() => { login.style.opacity = '1'; }); }
    },

    goBackToPortal: function() {
        const portal = document.getElementById('view-portal');
        const login  = document.getElementById('view-login');

        // Resetear clases de modo
        document.body.classList.remove('mode-athlete', 'mode-dt', 'testing-athlete');
        this.currentRole = 'dt';

        if (login)  { login.style.display = 'none'; }
        if (portal) { portal.style.display = 'flex'; }
    },

    handleRouting() {
        const hash = window.location.hash;
        console.log("📍 Router ejecutado, hash:", hash || '(vacío)');

        // El routing interno de las vistas del DT es manejado por DTEngine.toggleView.
        // Solo actuamos si DTEngine ya está disponible en el DOM.
        if (!window.DTEngine) {
            console.warn('⚠️ handleRouting: DTEngine aún no disponible, encolado para después.');
            return;
        }

        if (hash === '#view-profile') {
            window.DTEngine.toggleView('profile');
        } else if (hash === '#calendar') {
            window.DTEngine.toggleView('calendar');
        } else if (hash === '#analytics') {
            window.DTEngine.toggleView('analytics');
        } else {
            // '#home' o cualquier hash vacío/desconocido → home
            window.DTEngine.toggleView('home');
        }
    },

    loadProfile() {
        if (!window.CurrentUser || !window.CurrentTeam) return;
        
        document.getElementById('prof-name').value = window.CurrentUser.name || '';
        document.getElementById('prof-license').value = window.CurrentUser.license || 'UEFA PRO';
        document.getElementById('prof-team-name').value = window.CurrentTeam.name || '';
        document.getElementById('prof-team-color').value = window.CurrentTeam.primary_color || '#079FA0';
        document.getElementById('prof-methodology').value = window.CurrentTeam.methodology || 'Periodización Táctica';
    },

    saveProfile: async function(e) {
        if(e) e.preventDefault();
        const role = this.currentRole || 'dt';
        const uid   = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');

        // BIFURCACIÓN ESTRICTA: el Atleta jamás toca la tabla users
        if (role === 'athlete') {
            const g = id => document.getElementById(id)?.value?.trim() || null;
            const gn = id => parseFloat(document.getElementById(id)?.value) || null;

            const fullName   = g('ath-name');
            const sport      = g('ath-sport');
            const position   = document.getElementById('ath-pos')?.value || null;

            if (!fullName || !sport || !position) {
                return alert('Por favor, completa los campos obligatorios (Nombre, Deporte y Posicion).');
            }

            const payload = {
                user_id:                    uid,
                full_name:                  fullName,
                sport:                      sport,
                position:                   position,
                phone:                      g('ath-phone'),
                dominant_side:              document.getElementById('ath-side')?.value || null,
                birth_date:                 document.getElementById('ath-birth')?.value || null,
                weight_kg:                  gn('ath-weight'),
                height_cm:                  gn('ath-height'),
                body_fat:                   gn('ath-fat'),
                training_experience_years:  gn('ath-exp'),
                days_per_week:              gn('ath-days'),
                hours_per_day:              gn('ath-hours'),
                commitment_level:           document.getElementById('ath-commitment')?.value || null,
            };

            try {
                const r = await fetch(`${window.SUPABASE_URL}/rest/v1/profiles_athlete`, {
                    method: 'POST',
                    headers: {
                        'apikey': window.SUPABASE_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify(payload)
                });
                if (!r.ok) {
                    const err = await r.json().catch(() => ({}));
                    throw new Error(err.message || 'Error al guardar perfil de atleta.');
                }
                console.log('✅ Perfil de atleta guardado en profiles_athlete.');
                location.reload();
            } catch (err) {
                console.error('🔴 Error de Sincronización Atleta:', err);
                alert('Hubo un problema al guardar tus datos: ' + err.message);
            }

        } else {
            // PATH DT: apunta exclusivamente a la tabla users histórica
            // Solo se envían columnas que existen en users
            const name     = document.getElementById('ob-name')?.value   || null;
            const staffRole = document.getElementById('ob-role')?.value  || null;
            const license  = document.getElementById('ob-license')?.value || null;

            if (!name) return alert('Por favor, ingresa tu nombre.');

            try {
                const r = await fetch(`${window.SUPABASE_URL}/rest/v1/users?id=eq.${uid}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': window.SUPABASE_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name, staff_role: staffRole, license })
                });
                if (!r.ok) throw new Error('Error al actualizar perfil de staff.');
                console.log('✅ Perfil de DT guardado en users.');
                location.reload();
            } catch (err) {
                console.error('🔴 Error de Sincronización DT:', err);
                alert('Hubo un problema al guardar tus datos: ' + err.message);
            }
        }
    },

    async checkSession(uid, token) {
        try {
            // Restaurar el rol del portal (persiste incluso tras reload)
            const savedRole = localStorage.getItem('ravix_active_role');
            if (savedRole) {
                this.currentRole = savedRole;
                window.App.currentRole = savedRole;
            }
            const activeRole = this.currentRole || 'dt';

            console.log(`[RAVIX checkSession] uid=${uid} role=${activeRole}`);

            // ── BIFURCACIÓN POR ROL ────────────────────────────────────
            if (activeRole === 'athlete') {
                document.body.classList.add('testing-athlete', 'mode-athlete');
                document.body.classList.remove('mode-dt');

                const athRes = await fetch(
                    `${window.SUPABASE_URL}/rest/v1/profiles_athlete?user_id=eq.${uid}`,
                    { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` } }
                );
                const athData = await athRes.json();

                if (!athData || athData.length === 0 || !athData[0].full_name) {
                    // Atleta sin perfil → Onboarding
                    console.log('[RAVIX] Atleta sin perfil → Wizard');
                    document.getElementById('view-login').style.display  = 'none';
                    document.getElementById('view-portal').style.display = 'none';
                    const shell = document.getElementById('app-shell');
                    if (shell) shell.style.display = 'none';
                    window.Wizard.startFor('athlete');
                    return;
                }

                // Atleta con perfil → Mundo Atleta
                console.log('✅ Atleta con perfil. Cargando Mundo Atleta...');
                window.CurrentUser = athData[0];
                document.getElementById('view-login').style.display  = 'none';
                document.getElementById('view-portal').style.display = 'none';
                document.getElementById('app-shell').style.display   = 'block';
                this.injectRoleAssets('athlete');
                this.handleRouting();
                return;
            }

            // ── PATH DT ───────────────────────────────────────────────
            document.body.classList.add('mode-dt');
            document.body.classList.remove('mode-athlete', 'testing-athlete');

            const r = await fetch(`${window.SUPABASE_URL}/rest/v1/users?id=eq.${uid}`, {
                headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
            });
            const users = await r.json();

            if (users && users[0]) {
                const userData = users[0];

                if (!userData.name || !userData.team_id) {
                    // DT sin perfil completo → Wizard DT
                    console.log('[RAVIX] DT sin perfil → Wizard');
                    document.getElementById('view-login').style.display  = 'none';
                    document.getElementById('app-shell').style.display   = 'none';
                    window.Wizard.startFor('dt');
                    return;
                }

                // Cargar config del equipo
                const [cRes, tRes] = await Promise.all([
                    fetch(`${window.SUPABASE_URL}/rest/v1/team_configs?team_id=eq.${userData.team_id}`, {
                        headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${window.SUPABASE_URL}/rest/v1/teams?id=eq.${userData.team_id}`, {
                        headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
                    })
                ]);
                const configs = await cRes.json();
                const teams   = await tRes.json();
                window.CurrentTeam = teams ? teams[0] : null;

                if (configs && configs[0]) {
                    const cfg = configs[0];
                    if (cfg.primary_color) {
                        document.documentElement.style.setProperty('--primary', cfg.primary_color);
                        document.documentElement.style.setProperty('--primary-color', cfg.primary_color);
                    }
                    if (window.CurrentTeam) {
                        window.CurrentTeam.match_dates  = cfg.match_dates  || [];
                        window.CurrentTeam.methodology  = cfg.methodology  || 'No definida';
                        window.CurrentTeam.primary_color = cfg.primary_color || null;
                        window.CurrentTeam.tactical_dna  = cfg.tactical_dna  || {};
                        window.CurrentTeam.periodization = cfg.periodization || null;
                    }
                }

                await this.fetchExercisesLibrary();
                await this.fetchCustomExercises();

                window.CurrentUser = userData;
                document.getElementById('view-login').style.display  = 'none';
                document.getElementById('view-portal').style.display = 'none';
                document.getElementById('app-shell').style.display   = 'block';
                this.injectRoleAssets('dt');
                this.handleRouting();

            } else {
                // No hay fila en users para este uid — podría ser un atleta logueado como DT
                console.warn('[RAVIX] No se encontró fila en users para este UID. ¿Rol incorrecto seleccionado?');
                alert('No se encontró tu perfil en el sistema. Verifica que seleccionaste el rol correcto al ingresar.');
                this.logout();
            }

        } catch (e) {
            console.error('🔴 Error checkSession:', e);
            this.logout();
        }
    },


    async fetchExercisesLibrary() {
        try {
            const token = localStorage.getItem('ravix_token');
            const r = await fetch(`${window.SUPABASE_URL}/rest/v1/exercises_library`, {
                headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
            });
            const data = await r.json();
            if (data) {
                window.ExercisesLibrary = data.map(ex => ({
                    ...ex,
                    numericId: parseInt(ex.id.replace(/\D/g, '')) || Date.now()
                }));
                console.log("📚 Biblioteca Táctica cargada globalmente:", window.ExercisesLibrary.length);
            }
        } catch (e) { console.error("🔴 Error cargando biblioteca:", e); }
    },

    async fetchCustomExercises() {
        try {
            const uid   = localStorage.getItem('ravix_v5_uid');
            const token = localStorage.getItem('ravix_token');
            const r = await fetch(`${window.SUPABASE_URL}/rest/v1/custom_exercises?user_id=eq.${uid}&order=created_at.desc`, {
                headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
            });
            const data = await r.json();
            if (Array.isArray(data)) {
                window.CustomExercises = data.map(ex => ({
                    ...ex,
                    numericId: ex.id,
                    isCustom: true
                }));
                console.log('🗃️ Bóveda Privada cargada:', window.CustomExercises.length, 'tareas.');
            }
        } catch (e) { console.error('🔴 Error cargando bóveda privada:', e); }
    },

    injectRoleAssets(role) {
        const isAthlete = role === 'player' || role === 'athlete' || role === 'jugador';

        if (isAthlete) {
            // ── MUNDO ATLETA ──
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = 'css/styles-athletes.css';
            document.head.appendChild(cssLink);

            const script = document.createElement('script');
            script.src = 'js/app-player.js';
            script.onload = () => {
                if (window.PlayerEngine) {
                    window.PlayerEngine.init();
                }
            };
            document.body.appendChild(script);
        } else {
            // ── MUNDO DT (default) ──
            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = 'css/styles-dt.css';
            document.head.appendChild(link);

            const script = document.createElement('script');
            script.src = 'js/app-dt.js';
            script.onload = () => {
                if (window.DTEngine) {
                    window.DTEngine.renderDashboard().then(() => {
                        const initialHash = window.location.hash;
                        if (initialHash && initialHash !== '#home') {
                            window.App.handleRouting();
                        }
                    });
                }
            };
            document.body.appendChild(script);
        }
    },


    toggleAuth(mode) {
        document.getElementById('login-form').style.display = mode === 'login' ? 'block' : 'none';
        document.getElementById('register-form').style.display = mode === 'register' ? 'block' : 'none';
    },

    // --- SIGNUP CON ENRUTAMIENTO MANUAL + CANDADO ANTI-DOBLE-ENVÍO ---
    signUp: async function(email, pass) {
        if (this.isProcessingAuth) {
            console.log("⏳ Autenticación en proceso, ignorando doble clic...");
            return;
        }

        this.isProcessingAuth = true;
        const role = this.currentRole || 'dt';
        console.log(`[RAVIX AUTH] Iniciando registro manual para: ${email} como ${role}`);

        try {
            // 1. Crear el usuario en el sistema de Auth
            const rAuth = await fetch(`${window.SUPA_URL}/auth/v1/signup`, {
                method: 'POST',
                headers: { 'apikey': window.SUPA_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: pass })
            });

            const authData = await rAuth.json();

            if (rAuth.status === 400 && (authData.msg?.includes('already registered') || authData.message?.includes('already registered') || authData.error_description?.includes('already registered'))) {
                alert("El email ya existe. Por favor, inicia sesión.");
                window.App.toggleAuth('login');
                return;
            }
            if (!rAuth.ok) throw new Error(authData.msg || authData.message || authData.error_description || "Error de Auth");

            // 2. Si el registro fue exitoso y nos devolvió token
            if (authData.access_token && authData.user) {
                const uid = authData.user.id;
                const token = authData.access_token;

                // Guardamos la sesión
                localStorage.setItem('ravix_token', token);
                localStorage.setItem('ravix_v5_uid', uid);

                // 3. ENRUTAMIENTO MANUAL HACIA LA TABLA CORRECTA
                const table = role === 'athlete' ? 'profiles_athlete' : 'users';

                // Preparamos el esqueleto inicial según el rol
                let profilePayload = { id: uid };
                if (role === 'athlete') {
                    profilePayload = { id: uid, email: email }; // email explícito para profiles_athlete
                } else if (role === 'dt') {
                    profilePayload = {
                        id: uid,
                        name: 'Staff RAVIX',
                        email: email,
                        role: 'dt',
                        objetivo: 'ALTO_RENDIMIENTO',
                        dt_configured: false
                    };
                }

                // Inyectamos el esqueleto en la base de datos
                await fetch(`${window.SUPA_URL}/rest/v1/${table}`, {
                    method: 'POST',
                    headers: {
                        'apikey': window.SUPA_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(profilePayload)
                });

                console.log(`✅ Perfil inyectado exitosamente en ${table}`);

                // 4. Lanzamos el Wizard correspondiente para rellenar los datos
                window.Wizard.startFor(role);
            } else {
                throw new Error("No se pudo iniciar sesión automáticamente tras el registro.");
            }

        } catch (err) {
            console.error("🔴 Error Crítico en Registro:", err);
            alert("Hubo un error: " + err.message);
        } finally {
            // SIEMPRE liberar el candado al terminar, haya éxito o error
            this.isProcessingAuth = false;
        }
    },

    logout() { localStorage.clear(); location.reload(); }
};

/* ═══════════════════════════════════════════════
   ATHLETE WIZARD — Dependent Dropdowns + Multi-Step
   Scope: #athlete-onboarding-form (avoids ID collisions
   with legacy DT wizard that shares ath-sport / ath-pos)
═══════════════════════════════════════════════ */
window.AthWizard = (function () {

    // ── Diccionario de posiciones por deporte ──────────────────────────
    const POSITIONS = {
        'Futbol': [
            'Arquero', 'Defensor Central', 'Defensor Lateral Derecho',
            'Defensor Lateral Izquierdo', 'Pivote / MCD', 'Volante Mixto',
            'Volante Ofensivo / Mediapunta', 'Extremo Derecho',
            'Extremo Izquierdo', 'Delantero Centro', 'Segundo Delantero'
        ],
        'Basquetbol': ['Base (Point Guard)', 'Escolta (Shooting Guard)', 'Alero (Small Forward)', 'Ala-Pivot (Power Forward)', 'Pivot (Center)'],
        'Rugby': [
            'Pilar Izquierdo (1)', 'Hooker (2)', 'Pilar Derecho (3)',
            'Segunda Linea (4)', 'Segunda Linea (5)', 'Ala Flanker (6)',
            'Ala Flanker N8 (7-8)', 'Medio Scrum (9)', 'Apertura (10)',
            'Centro Izquierdo (12)', 'Centro Derecho (13)',
            'Wing Izquierdo (11)', 'Wing Derecho (14)', 'Fullback (15)'
        ],
        'Natacion': [
            '50m Libre', '100m Libre', '200m Libre', '400m Libre', '800m Libre', '1500m Libre',
            '100m Espalda', '200m Espalda',
            '100m Pecho', '200m Pecho',
            '100m Mariposa', '200m Mariposa',
            '200m Combinado Individual', '400m Combinado Individual',
            'Relevos 4x100m', 'Aguas Abiertas'
        ],
        'Atletismo': [
            'Velocidad 100m', 'Velocidad 200m', 'Velocidad 400m',
            'Medio Fondo 800m', 'Medio Fondo 1500m',
            'Fondo 5000m', 'Fondo 10000m', 'Maraton',
            'Marcha 20km', 'Marcha 50km',
            'Salto en Alto', 'Salto con Garrocha', 'Salto en Largo', 'Triple Salto',
            'Lanzamiento de Peso', 'Lanzamiento de Disco',
            'Lanzamiento de Martillo', 'Lanzamiento de Jabalina',
            'Decatlon / Heptatlon'
        ],
        'Judo': [
            '-48kg (F)', '-52kg (F)', '-57kg (F)', '-63kg (F)', '-70kg (F)', '-78kg (F)', '+78kg (F)',
            '-60kg (M)', '-66kg (M)', '-73kg (M)', '-81kg (M)', '-90kg (M)', '-100kg (M)', '+100kg (M)'
        ],
        'Tenis': ['Singles', 'Dobles', 'Singles + Dobles', 'Tenis de Mesa — Singles', 'Tenis de Mesa — Dobles'],
        'Fitness': [
            'Powerlifting', 'Halterofilia', 'CrossFit / Functional Fitness',
            'Culturismo / Bodybuilding', 'Fitness Estetico',
            'Perdida de Peso / Recomposicion', 'Rendimiento General'
        ],
        'Otro': ['General / Polideportivo', 'Rehabilitacion Deportiva', 'Preparacion Fisica Base']
    };

    // ── Helpers de DOM scoped al formulario ───────────────────────────
    function getForm()  { return document.getElementById('athlete-onboarding-form'); }
    function q(id)      { const f = getForm(); return f ? f.querySelector('#' + id) : document.getElementById(id); }

    // ── Actualiza el select de posición con micro-animación ───────────
    function updatePositions(sport) {
        const posSelect = q('ath-pos');
        if (!posSelect) return;

        const positions = POSITIONS[sport] || null;

        if (!positions) {
            // Sin deporte seleccionado: deshabilitar y dejar placeholder
            posSelect.innerHTML = '<option value="" disabled selected>Primero elige un deporte</option>';
            posSelect.disabled = true;
            posSelect.style.opacity = '0.45';
            posSelect.style.cursor  = 'not-allowed';
            return;
        }

        // Fade out → actualizar → fade in
        posSelect.style.transition = 'opacity 0.18s ease';
        posSelect.style.opacity = '0';

        setTimeout(() => {
            posSelect.innerHTML = '<option value="" disabled selected>Selecciona posicion...</option>'
                + positions.map(p => `<option value="${p}">${p}</option>`).join('');
            posSelect.disabled = false;
            posSelect.style.cursor  = '';
            posSelect.value = ''; // reset selección anterior
            // Fade in
            requestAnimationFrame(() => { posSelect.style.opacity = '1'; });
        }, 180);
    }

    // ── Actualiza UI del stepper y barra de progreso ──────────────────
    let currentStep = 1;
    const TOTAL = 3;

    function updateUI() {
        const form = getForm();
        if (!form) return;

        for (let i = 1; i <= TOTAL; i++) {
            const fs   = form.querySelector('#oa-step-' + i);
            const snav = document.getElementById('snav-' + i);
            if (fs)   { fs.classList.toggle('active', i === currentStep); }
            if (snav) {
                snav.classList.toggle('active', i === currentStep);
                snav.classList.toggle('done',   i < currentStep);
            }
        }

        const pct = Math.round((currentStep / TOTAL) * 100);
        const bar = document.getElementById('oa-progress');
        if (bar) bar.style.width = pct + '%';

        const lbl = document.getElementById('oa-step-label');
        if (lbl) lbl.textContent = `Paso ${currentStep} de ${TOTAL}`;
    }

    // ── Validación por paso ────────────────────────────────────────────
    function validateStep(step) {
        if (step === 1) {
            const name  = q('ath-name')?.value?.trim();
            const sport = q('ath-sport')?.value;
            const pos   = q('ath-pos')?.value;
            if (!name)  { q('ath-name')?.focus();  alert('Ingresa tu nombre completo.'); return false; }
            if (!sport) { q('ath-sport')?.focus(); alert('Selecciona tu deporte.'); return false; }
            if (!pos)   { q('ath-pos')?.focus();   alert('Selecciona tu posicion o especialidad.'); return false; }
        }
        return true;
    }

    // ── Init: bind eventos una sola vez ───────────────────────────────
    function init() {
        const sportSel = q('ath-sport');
        const posSel   = q('ath-pos');

        if (!sportSel || !posSel) return; // form no está en DOM todavía

        // Estado inicial: posición deshabilitada
        posSel.innerHTML = '<option value="" disabled selected>Primero elige un deporte</option>';
        posSel.disabled = true;
        posSel.style.opacity = '0.45';
        posSel.style.cursor  = 'not-allowed';

        // Evento deporte → posiciones
        sportSel.addEventListener('change', function () {
            updatePositions(this.value);
        });

        // Reset step
        currentStep = 1;
        updateUI();
    }

    // ── API pública ────────────────────────────────────────────────────
    return {
        init,
        onSportChange() { // compatibilidad con cualquier onchange inline residual
            const sport = q('ath-sport')?.value;
            if (sport) updatePositions(sport);
        },
        next() {
            if (!validateStep(currentStep)) return;
            if (currentStep < TOTAL) { currentStep++; updateUI(); }
        },
        prev() {
            if (currentStep > 1) { currentStep--; updateUI(); }
        }
    };

})();

document.addEventListener('DOMContentLoaded', () => {
    // Si el onboarding atleta ya estuviera visible al cargar (edge case), iniciarlo
    if (document.getElementById('athlete-onboarding-form')) {
        const oaView = document.getElementById('view-onboarding-athlete');
        if (oaView && oaView.style.display !== 'none' && oaView.style.display !== '') {
            if (window.AthWizard) window.AthWizard.init();
        }
    }

    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = async function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();

            const email = document.getElementById('login-username').value.trim();
            const pass  = document.getElementById('login-password').value;
            const role  = window.App.currentRole || 'dt';

            console.log(`[RAVIX AUTH] Login: ${email} como ${role}`);

            const btn = document.getElementById('login-submit-btn');
            if (btn) { btn.disabled = true; btn.textContent = 'Ingresando...'; }

            try {
                const r = await fetch(`${window.SUPA_URL}/auth/v1/token?grant_type=password`, {
                    method: 'POST',
                    headers: { 'apikey': window.SUPA_KEY, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password: pass })
                });

                const data = await r.json();

                if (!r.ok) {
                    throw new Error(data.error_description || data.msg || data.message || 'Credenciales incorrectas.');
                }

                if (data.access_token && data.user) {
                    console.log('✅ Token recibido. Guardando sesión...');
                    localStorage.setItem('ravix_token', data.access_token);
                    localStorage.setItem('ravix_v5_uid', data.user.id);
                    // Persistir el rol elegido en el portal para que checkSession lo use
                    localStorage.setItem('ravix_active_role', role);
                    window.App.currentRole = role;

                    await window.App.checkSession(data.user.id, data.access_token);
                } else {
                    throw new Error('No se recibió el token de autorización.');
                }
            } catch (err) {
                console.error('🔴 Login Error:', err);
                alert('Error al iniciar sesión: ' + err.message);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = role === 'athlete' ? 'ACCEDER AL LABORATORIO' : 'ENTRAR AL SISTEMA';
                }
            }
        };
    }

    // Register Form — único punto de disparo, e.preventDefault() bloquea doble submit
    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.onsubmit = async function(e) {
            e.preventDefault();
            e.stopImmediatePropagation(); // Previene cualquier otro listener encadenado
            const email = document.getElementById('register-email').value;
            const pass  = document.getElementById('register-password').value;
            const conf  = document.getElementById('register-confirm-password').value;
            if (pass !== conf) return alert('Las contraseñas no coinciden');

            await window.App.signUp(email, pass);
        };
    }

    // Listener para el formulario de perfil
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.onsubmit = (e) => window.App.saveProfile(e);
    }
});

window.onload = () => App.init();
