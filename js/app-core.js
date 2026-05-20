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
        const onboarding = document.getElementById('view-onboarding');
        if (onboarding) onboarding.style.display = 'flex';
        // Mostrar el wizard correcto
        document.getElementById('wizard-dt').style.display  = role === 'dt' ? 'block' : 'none';
        document.getElementById('wizard-athlete').style.display = role === 'athlete' ? 'block' : 'none';
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
            const profileData = {
                user_id:   uid,          // FK correcta en profiles_athlete
                full_name: document.getElementById('ath-name')?.value  || null,
                sport:     document.getElementById('ath-sport')?.value || null,
                position:  document.getElementById('ath-pos')?.value   || null,
                height:    parseFloat(document.getElementById('ath-height')?.value) || null,
                weight:    parseFloat(document.getElementById('ath-weight')?.value) || null,
                goal:      document.getElementById('ath-goal')?.value  || null
            };

            if (!profileData.full_name || !profileData.sport) {
                return alert('Por favor, completa los campos obligatorios.');
            }

            try {
                // Upsert en profiles_athlete según user_id
                const r = await fetch(`${window.SUPABASE_URL}/rest/v1/profiles_athlete`, {
                    method: 'POST',
                    headers: {
                        'apikey': window.SUPABASE_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify(profileData)
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
            const r = await fetch(`${window.SUPABASE_URL}/rest/v1/users?id=eq.${uid}`, {
                headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
            });
            const users = await r.json();
            if (users && users[0]) {
                const userData = users[0];

                // Restaurar rol guardado desde la metadata del usuario
                const activeRole = this.currentRole || userData.app_role || 'dt';
                this.currentRole = activeRole;
                if (activeRole === 'athlete') {
                    document.body.classList.add('testing-athlete', 'mode-athlete');
                }

                if (activeRole === 'athlete') {
                    // --- GUARDIA ATLETA ---
                    const athRes = await fetch(`${window.SUPABASE_URL}/rest/v1/profiles_athlete?user_id=eq.${uid}`, {
                        headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
                    });
                    const athData = await athRes.json();
                    
                    if (!athData || athData.length === 0 || !athData[0].full_name) {
                        // Usuario existe en Auth pero NO tiene perfil de atleta
                        document.getElementById('view-login').style.display = 'none';
                        document.getElementById('app-shell').style.display = 'none';
                        window.Wizard.startFor('athlete');
                        return;
                    }
                } else {
                    // --- GUARDIA DT ---
                    if (!userData.name || !userData.team_id) {
                        // Usuario existe en Auth pero NO tiene perfil de DT (team_id, nombre)
                        document.getElementById('view-login').style.display = 'none';
                        document.getElementById('app-shell').style.display = 'none';
                        window.Wizard.startFor('dt');
                        return;
                    }
                }

                // --- RE-BRANDING DINÁMICO & MEMORIA TÁCTICA ---
                const cRes = await fetch(`${window.SUPABASE_URL}/rest/v1/team_configs?team_id=eq.${userData.team_id}`, {
                    headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
                });
                const configs = await cRes.json();
                
                const tRes = await fetch(`${window.SUPABASE_URL}/rest/v1/teams?id=eq.${userData.team_id}`, {
                    headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
                });
                const teams = await tRes.json();
                window.CurrentTeam = teams ? teams[0] : null;

                if (configs && configs[0]) {
                    const configData = configs[0];
                    if (configData.primary_color) {
                        document.documentElement.style.setProperty('--primary', configData.primary_color);
                        document.documentElement.style.setProperty('--primary-color', configData.primary_color);
                        console.log('🎨 Branding del Club inyectado:', configData.primary_color);
                    }
                    if (window.CurrentTeam) {
                        window.CurrentTeam.match_dates = configData.match_dates || [];
                        window.CurrentTeam.methodology = configData.methodology || 'No definida';
                        window.CurrentTeam.primary_color = configData.primary_color || null;
                        window.CurrentTeam.tactical_dna = configData.tactical_dna || {};
                        window.CurrentTeam.periodization = configData.periodization || null;
                        console.log('🧠 Memoria táctica recuperada:', window.CurrentTeam.match_dates);
                    }
                }
                
                await this.fetchExercisesLibrary();
                await this.fetchCustomExercises();

                window.CurrentUser = userData;

                document.getElementById('view-login').style.display = 'none';
                document.getElementById('view-portal').style.display = 'none';
                document.getElementById('app-shell').style.display = 'block';

                // Redirigir según rol
                this.injectRoleAssets(activeRole);
                
                this.handleRouting();
            } else { this.logout(); }
        } catch (e) { console.error('Error checkSession:', e); this.logout(); }
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
                if (role === 'dt') {
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

document.addEventListener('DOMContentLoaded', () => {
    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = async function(e) {
            e.preventDefault();
            const email = document.getElementById('login-username').value;
            const pass = document.getElementById('login-password').value;
            try {
                if (!window.SUPABASE_URL || window.SUPABASE_URL.includes('undefined')) {
                    throw new Error("Error de configuración: URL de Supabase no definida.");
                }

                const r = await fetch(`${window.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY },
                    body: JSON.stringify({ email, password: pass })
                });

                const contentType = r.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    const errorText = await r.text();
                    console.error("🔴 Error de servidor (No JSON):", errorText);
                    throw new Error("El servidor de autenticación no respondió correctamente.");
                }

                const data = await r.json();
                if (!r.ok) throw new Error(data.error_description || 'Credenciales inválidas');
                
                localStorage.setItem('ravix_token', data.access_token);
                localStorage.setItem('ravix_v5_uid', data.user.id);

                // Leer rol desde Supabase user_metadata y sincronizar
                const metaRole = data.user?.user_metadata?.role;
                if (metaRole) window.App.currentRole = metaRole;

                window.App.checkSession(data.user.id, data.access_token);
            } catch (err) { 
                console.error("🔴 Login Fail:", err);
                alert(err.message); 
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
