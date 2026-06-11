/* 
    RAVIX V5 - CORE ARCHITECTURE
    Auth, Router Guard & Onboarding Logic
*/

// --- SUPABASE CONFIGURATION ---
window.SUPA_URL = 'https://rscdpwarzltozigfbmev.supabase.co';
window.SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzY2Rwd2Fyemx0b3ppZ2ZibWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjYyNjUsImV4cCI6MjA5MTg0MjI2NX0.WaKWoCxbaQ3VVDXLtfBvNyB9zywxZRHCwjzT-5gS-b0';
window.SUPABASE_URL = window.SUPA_URL;
window.SUPABASE_KEY = window.SUPA_KEY;

window.supabase = supabase.createClient(window.SUPA_URL, window.SUPA_KEY);


window.Wizard = {
    step: 1,
    path: 'create',
    mode: 'dt', // 'dt' | 'athlete'

    // Inicializar modo según el rol seleccionado en el portal
    startFor(role) {
        this.mode = role;
        this.step = 1;

        // ── ATOMIC VIEW SWAP ──────────────────────────────────────────────
        // Strategy: SHOW the target FIRST, then HIDE everything else.
        // This prevents any black-screen gap regardless of CSS transitions.

        if (role === 'athlete') {
            // ══ V2: Onboarding atleta vive en archivo físico separado ══
            console.log('[WIZARD] Redirigiendo al onboarding V2 del atleta...');
            window.location.href = './onboarding-athlete.html';
            return;

        } else {
            // ══ WIZARD DT (original) ══
            const onboarding = document.getElementById('view-onboarding');
            if (onboarding) onboarding.style.display = 'flex';

            // Hide others after showing DT wizard
            ['view-login', 'view-role-selector', 'app-shell'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.style.display = 'none'; el.style.opacity = ''; }
            });

            const wizDT = document.getElementById('wizard-dt');
            if (wizDT) wizDT.style.display = 'flex';
        }
    },

    // ── PATH DT (existente) ──
    setPath(p) {
        this.path = p;
        document.querySelectorAll('.path-card').forEach(c => c.classList.remove('active'));
        document.getElementById(`path-card-${p}`)?.classList.add('active');
        document.getElementById('ob-ui-create').style.display = p === 'create' ? 'block' : 'none';
        document.getElementById('ob-ui-join').style.display = p === 'join' ? 'block' : 'none';
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
        const uid = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');
        const name = document.getElementById('ob-name').value;
        const role = document.getElementById('ob-role').value;
        const license = document.getElementById('ob-license').value;
        if (!name) return alert('Por favor, ingresa tu nombre.');

        try {
            let teamId = null;
            if (this.path === 'create') {
                const tName = document.getElementById('ob-team-name').value || 'Mi Club';
                const tColor = document.getElementById('ob-team-color').value;
                const tMethodology = document.getElementById('ob-methodology').value;
                const tSystems = document.getElementById('ob-systems-input').value;
                const tCode = 'CU-' + Math.floor(1000 + Math.random() * 9000);

                // 1. Crear el equipo primero
                const { data: newTeam, error: teamError } = await window.supabase
                    .from('teams')
                    .insert([{ 
                        name: tName, 
                        owner_id: uid,
                        code: tCode 
                    }])
                    .select()
                    .single();

                if (teamError) {
                    console.error("❌ Error al crear el equipo:", teamError);
                    alert("Hubo un error al crear tu equipo.");
                    return;
                }

                console.log("✅ Equipo creado con ID:", newTeam.id);
                teamId = newTeam.id;

                const { error: tcErr } = await window.supabase.from('team_configs').insert([{ team_id: teamId, owner_id: uid, primary_color: tColor, methodology: tMethodology, base_systems: tSystems }]);
                if (tcErr) console.error(tcErr);
            } else {
                const code = document.getElementById('ob-invite-code').value;
                const { data: teamData, error: teamError } = await window.supabase.from('teams').select('*').eq('code', code).single();
                if (teamError || !teamData) throw new Error('Código inválido o equipo no encontrado.');
                teamId = teamData.id;
            }

            // 2. Actualizar el perfil del DT con ese ID exacto
            const { error: userError } = await window.supabase
                .from('users') 
                .update({ 
                    name: name,
                    staff_role: role,
                    license: license,
                    team_id: teamId,    // VINCULACIÓN FORZADA
                    is_profile_complete: true 
                })
                .eq('id', uid);

            if (userError) {
                console.error("❌ Error al actualizar el perfil:", userError);
                alert("Hubo un error al vincular tu perfil.");
                return;
            }

            console.log("✅ Perfil actualizado correctamente. Redirigiendo...");

            // 3. Forzar limpieza y redirección
            localStorage.setItem('dt_onboarding_complete', 'true');
            window.location.reload();
        } catch (err) { alert(err.message); }
    },

    // ── FINISH PATH ATLETA (legacy — invocado desde wizard-athlete) ──
    async finishAthlete() {
        const uid = localStorage.getItem('ravix_v5_uid');
        if (!uid) return alert('Sesión expirada. Por favor, iniciá sesión nuevamente.');

        // Scope al formulario activo del atleta para evitar colisiones de ID
        const form = document.getElementById('athlete-onboarding-form')
            || document.getElementById('view-onboarding-athlete');
        const qf = id => (form ? form.querySelector('#' + id) : null)
            || document.getElementById(id);

        const fullName = qf('ath-name')?.value?.trim() || 'Atleta Anónimo';
        const sport = qf('ath-sport')?.value;
        const position = qf('ath-pos')?.value;        // ← 'ath-pos', no 'ath-position'
        const birthDate = qf('ath-birth')?.value || null;
        const weight = parseFloat(qf('ath-weight')?.value) || null;
        const height = parseFloat(qf('ath-height')?.value) || null;
        const wingspan = parseFloat(qf('ath-wingspan')?.value) || null;
        const goal = qf('ath-goal')?.value || null;

        if (!sport) return alert('Por favor, selecciona tu deporte.');
        if (!position) return alert('Por favor, selecciona tu posición o especialidad.');

        try {
            const payload = {
                id: uid,
                full_name: document.getElementById('ath-name')?.value?.trim() || 'Atleta Anónimo',
                sport: document.getElementById('ath-sport')?.value || 'No especificado',
                position: document.getElementById('ath-pos')?.value || 'No especificada',
                height: parseFloat(document.getElementById('ath-height')?.value) || 0,
                weight: parseFloat(document.getElementById('ath-weight')?.value) || 0,
                goal: document.getElementById('ath-goal')?.value || 'Mejorar',
                commitment_level: document.getElementById('ath-commitment')?.value || null,
                training_years: parseInt(document.getElementById('ath-training-years')?.value) || 0,
                club_hours_week: parseFloat(document.getElementById('ath-club-hours')?.value) || 0,
                gym_hours_week: parseFloat(document.getElementById('ath-gym-hours')?.value) || 0,
                updated_at: new Date().toISOString()
            };

            console.log("📦 Payload blindado a punto de enviarse:", payload);

            const { error: resErr } = await window.supabase
                .from('profiles_athlete')
                .upsert(payload, { onConflict: 'id' });

            if (resErr) {
                const msg = resErr.message || JSON.stringify(resErr);
                console.error('[SUPABASE] finishAthlete error:', msg, resErr.hint);
                return alert('❌ Error al guardar:\n' + msg + (resErr.hint ? '\nHint: ' + resErr.hint : ''));
            }

            console.log('✅ Perfil atleta guardado.');
            location.reload();
        } catch (err) {
            alert('Error de red: ' + err.message);
        }
    }
};

window.App = {
    currentRole: 'dt', // 'dt' | 'athlete' — seteado por el Portal
    isProcessingAuth: false, // Candado anti-race-condition

    async init() {
        const uid = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');
        const role = localStorage.getItem('ravix_active_role') || 'dt';

        console.log(`[ROUTER] init() — uid=${uid ? uid.slice(0, 8) + '...' : 'null'} role=${role}`);

        if (uid && token) {
            // Sesión activa: ocultar TODO inmediatamente para evitar flash del portal
            this._hideAllViews();
            this.currentRole = role;

            // Mostrar un loader mínimo mientras se verifica
            const portal = document.getElementById('view-role-selector');
            if (portal) {
                portal.style.setProperty('display', 'flex', 'important');
                portal.style.opacity = '';
                portal.style.pointerEvents = '';
            }

            console.log('[ROUTER] Token encontrado. Verificando sesión...');
            await this.checkSession(uid, token);
            window.addEventListener('hashchange', () => this.handleRouting());
        } else {
            console.log('[ROUTER] Sin sesión. Mostrando portal de entrada.');
            const portal = document.getElementById('view-role-selector');
            if (portal) {
                portal.style.setProperty('display', 'flex', 'important');
            }
        }
    },

    // Oculta todas las vistas para evitar flash visual (Hard Reset Simple)
    _hideAllViews() {
        // Apagar todo
        document.querySelectorAll('.view-section, .login-view, #app-shell').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.style.opacity = '';
            el.style.pointerEvents = '';
        });
    },

    // ── ROUTER FAILSAFE ────────────────────────────────────────────
    // Muestra una vista SOLO si el elemento existe. Si no, aborta la
    // transición, mantiene al usuario donde estaba y lanza un error.
    _safeShowView(targetId, displayMode) {
        const el = document.getElementById(targetId);
        if (!el) {
            console.error('[ROUTER ERROR] No se encontró la vista: #' + targetId);
            alert(
                '[RAVIX ROUTER] Error de configuración:\n' +
                'La vista "#' + targetId + '" no existe en el DOM.\n' +
                'La pantalla no se ocultará para no dejar la interfaz en blanco.'
            );
            return false;
        }
        el.style.display = displayMode || 'flex';
        return true;
    },

    // Muestra el portal solo en caso de error catastrófico real
    _showPortalWithError(msg) {
        console.error('[ROUTER] ❌ Error catastrófico:', msg);
        this._hideAllViews();
        const portal = document.getElementById('view-role-selector');
        if (portal) {
            portal.style.setProperty('display', 'flex', 'important');
            portal.style.opacity = '';
            portal.style.pointerEvents = '';
        }
        if (msg) alert('Sesión interrumpida: ' + msg + '\nPor favor, inicia sesión nuevamente.');
    },

    selectRole: function (role) {
        this.currentRole = role;

        // ── PERSISTIR ROL EN LOCALSTORAGE ──────────────────────────
        // Crítico: sin esto, checkSession() no sabe qué rol usar
        // después del login/registro y se pierde el enrutamiento.
        localStorage.setItem('ravix_active_role', role);
        console.log('[ROUTER] Rol seleccionado y persistido:', role);

        const body = document.body;
        if (role === 'athlete') {
            body.classList.add('mode-athlete', 'testing-athlete');
            body.classList.remove('mode-dt');
        } else {
            body.classList.add('mode-dt');
            body.classList.remove('mode-athlete', 'testing-athlete');
        }

        // Update new split-panel login UI
        if (window.LoginUI) window.LoginUI.setRole(role);

        // Smooth portal → login transition
        const portal = document.getElementById('view-role-selector');
        const login = document.getElementById('view-login');

        // ── FAILSAFE: verificar que login existe antes de ocultar portal ──
        if (!login) {
            console.error('[ROUTER ERROR] No se encontró la vista: #view-login');
            return;
        }

        if (portal) {
            portal.style.opacity = '0';
            portal.style.pointerEvents = 'none';
            setTimeout(() => { portal.style.setProperty('display', 'none', 'important'); portal.style.opacity = ''; portal.style.pointerEvents = ''; }, 420);
        }
        if (login) {
            login.style.setProperty('display', 'flex', 'important');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => { login.style.opacity = '1'; });
            });
            // Start particle animation
            if (window.LoginUI) window.LoginUI.startParticles();
        }
    },

    goBackToPortal: function () {
        const portal = document.getElementById('view-role-selector');
        const login = document.getElementById('view-login');

        // Reset mode classes
        document.body.classList.remove('mode-athlete', 'mode-dt', 'testing-athlete');
        this.currentRole = 'dt';

        if (login) { login.style.opacity = '0'; setTimeout(() => { login.style.display = 'none'; login.style.opacity = ''; }, 360); }
        if (portal) { setTimeout(() => { portal.style.display = 'flex'; }, 200); }
    },

    handleRouting() {
        const hash = window.location.hash;
        console.log("📍 Router ejecutado, hash:", hash || '(vacío)');

        // ── FALLBACK ESTRICTO: hash vacío → forzar #portal ────────────────────
        // El DT ya no aterriza en #home directamente. El Hub es la puerta de entrada.
        if (!hash || hash === '' || hash === '#') {
            window.location.hash = '#portal';
            // El hashchange event disparará handleRouting de nuevo con '#portal'.
            // Salimos para evitar doble ejecución.
            return;
        }

        // ── ROUTING AL HUB DEL DT ───────────────────────────────────────────
        if (hash === '#portal') {
            this._hideAllViews();
            
            // Encender EXCLUSIVAMENTE el Hub del DT
            const hubView = document.getElementById('view-dt-hub');
            if (hubView) {
                hubView.style.setProperty('display', 'flex', 'important'); // Layout top-down
                // Inyectar CSS del DT para que el hub tenga el tema correcto
                if (!document.querySelector('link[href="css/styles-dt.css"]')) {
                    const dtLink = document.createElement('link');
                    dtLink.rel = 'stylesheet';
                    dtLink.href = 'css/styles-dt.css';
                    document.head.appendChild(dtLink);
                }
                if (window.PortalHub) window.PortalHub.init();
            } else {
                console.error("CRÍTICO: No se encontró el elemento #view-dt-hub en el DOM");
            }
            return;
        }

        // ── REGLA DE SEGURIDAD: Abortar si no hay club seleccionado ──────────
        const dtViews = ['#home', '#board', '#analytics', '#calendar', '#view-profile', '#view-board'];
        if (dtViews.includes(hash)) {
            if (!window.CurrentTeam || !localStorage.getItem('ravix_team_id')) {
                console.warn('⚠️ handleRouting: Intento de acceso a tablero sin club seleccionado. Redirigiendo a #portal.');
                window.location.hash = '#portal';
                return;
            }
        }

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
        } else if (hash === '#board' || hash === '#view-board') {
            window.DTEngine.toggleView('board');
        } else {
            // '#home' o cualquier hash desconocido → home
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

    saveProfile: async function (e) {
        if (e) e.preventDefault();
        const role = this.currentRole || 'dt';
        const uid = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');

        // Capturar botón para feedback visual
        const btn = e ? (e.currentTarget || e.target) : null;
        let originalText = "";
        if (btn) {
            originalText = btn.textContent;
            btn.textContent = "Cargando...";
            btn.style.opacity = "0.7";
            btn.disabled = true;
        }

        const restoreBtn = () => {
            if (btn) {
                btn.textContent = originalText;
                btn.style.opacity = "1";
                btn.disabled = false;
            }
        };

        // ══════════════════════════════════════════════════════════════
        //  BIFURCACIÓN ATLETA — Tabla: profiles_athlete
        //  Mapa DOM → Supabase verificado contra index.html líneas 954-1129
        // ══════════════════════════════════════════════════════════════
        if (role === 'athlete') {

            // ── Lectura directa con document.getElementById (sin scope)
            // Fuente única de verdad para validaciones Y payload.
            // IDs verificados contra index.html líneas 963-1118.
            const sport         = document.getElementById('ath-sport')?.value      || '';
            const position      = document.getElementById('ath-pos')?.value        || '';
            const goal          = document.getElementById('ath-goal')?.value        || '';
            const commitment_level = document.getElementById('ath-commitment')?.value || '';

            // ── Validación de campos obligatorios ──────────────────────────
            if (!sport) {
                restoreBtn();
                return alert('⚠️ Deporte requerido.\nVolvé al Paso 1 y seleccioná tu deporte.');
            }
            if (!position) {
                restoreBtn();
                return alert('⚠️ Posición requerida.\nVolvé al Paso 1 y seleccioná tu posición.');
            }
            if (!goal) {
                restoreBtn();
                return alert('⚠️ Objetivo neuromuscular requerido.\nSeleccioná un objetivo en el Paso 3.');
            }
            if (!commitment_level) {
                restoreBtn();
                return alert('⚠️ Nivel de compromiso requerido.\nSeleccioná tu nivel en el Paso 3.');
            }

            // ── Resto de los campos ─────────────────────────────────────────
            const full_name    = document.getElementById('ath-name')?.value?.trim() || 'Atleta Anónimo';
            const phone        = document.getElementById('ath-phone')?.value?.trim() || null;
            const dominant_side = document.getElementById('ath-side')?.value         || null;
            const birth_date   = document.getElementById('ath-birth')?.value         || null;
            const body_fat     = parseFloat(document.getElementById('ath-fat')?.value) || null;

            const _w = parseFloat(document.getElementById('ath-weight')?.value);
            const _h = parseFloat(document.getElementById('ath-height')?.value);
            const _ty = parseInt(document.getElementById('ath-training-years')?.value);
            const _ch = parseFloat(document.getElementById('ath-club-hours')?.value);
            const _gh = parseFloat(document.getElementById('ath-gym-hours')?.value);

            // ── Payload final — IDs verificados contra el DOM real ──────────
            const payload = {
                id: uid,
                full_name,
                sport,
                position,
                phone,
                dominant_side,
                birth_date,
                weight: isNaN(_w) ? null : _w,
                height: isNaN(_h) ? null : _h,
                body_fat: isNaN(body_fat) ? null : body_fat,
                goal,
                commitment_level,
                training_years:  isNaN(_ty) ? 0 : _ty,
                club_hours_week: isNaN(_ch) ? 0 : _ch,
                gym_hours_week:  isNaN(_gh) ? 0 : _gh,
                updated_at: new Date().toISOString()
            };

            console.log('📦 Payload blindado enviado a Supabase:');
            console.table(payload);

            // ── Upsert ─────────────────────────────────────────────────────
            try {
                const { error: upsertErr } = await window.supabase
                    .from('profiles_athlete')
                    .upsert(payload, { onConflict: 'id' });

                if (upsertErr) throw upsertErr;

                console.log('✅ profiles_athlete guardado. Recargando...');
                location.reload();

            } catch (err) {
                const msg = err.message || JSON.stringify(err);
                console.error('🔴 [UPSERT ERROR]', msg, err);
                alert(
                    '❌ Error al guardar el perfil.\n\nMensaje: ' + msg +
                    (err.hint    ? '\nHint: '    + err.hint    : '') +
                    (err.details ? '\nDetails: ' + err.details : '')
                );
            } finally {
                restoreBtn();
            }

        } else {
            // PATH DT: apunta exclusivamente a la tabla users histórica
            // Solo se envían columnas que existen en users
            const name = document.getElementById('ob-name')?.value || null;
            const staffRole = document.getElementById('ob-role')?.value || null;
            const license = document.getElementById('ob-license')?.value || null;

            if (!name) {
                restoreBtn();
                return alert('Por favor, ingresa tu nombre.');
            }

            try {
                const { error: updateErr } = await window.supabase.from('users').update({ name, staff_role: staffRole, license }).eq('id', uid);
                if (updateErr) {
                    console.error("Supa Error:", updateErr.message, updateErr.details, updateErr.hint);
                    restoreBtn();
                    return alert("Faltan datos requeridos o hubo un error al guardar.");
                }
                console.log('✅ Perfil de DT guardado en users.');
                location.reload();
            } catch (err) {
                console.error('🔴 Error de Sincronización DT:', err);
                restoreBtn();
                alert('Hubo un problema al guardar tus datos: ' + err.message);
            }
        }
    },

    async checkSession(uid, token) {
        const LOG = tag => s => console.log(`[ROUTER:${tag}] ${s}`);

        try {
            // ── 1. Recuperar rol persistido ──────────────────────────────
            const savedRole = localStorage.getItem('ravix_active_role');
            if (savedRole) { this.currentRole = savedRole; }
            const role = this.currentRole || 'dt';
            LOG('INIT')(`uid=${uid.slice(0, 8)}... | role="${role}"`);

            // ── 2. Verificar que el token sigue siendo válido ─────────────
            LOG('AUTH')('Verificando token con supabase.auth.getUser...');
            const { data: { user: authUser }, error: userErr } = await window.supabase.auth.getUser(token);
            if (userErr || !authUser) {
                console.warn('[ROUTER] Sesión terminada o token inválido. Limpiando...');
                localStorage.removeItem('ravix_token');
                localStorage.removeItem('ravix_v5_uid');
                localStorage.removeItem('ravix_active_role');
                this._hideAllViews();
                const login = document.getElementById('view-login');
                if (login) {
                    login.style.setProperty('display', 'flex', 'important');
                }
                return;
            }
            LOG('AUTH')(`Token válido. Email verificado: ${authUser.email}`);

            // ── 3. Bifurcación estricta por rol ──────────────────────────
            if (role === 'athlete') {
                document.body.classList.add('mode-athlete', 'testing-athlete');
                document.body.classList.remove('mode-dt');

                LOG('ATHLETE')(`Buscando perfil en profiles_athlete... id=${uid.slice(0, 8)}...`);
                const { data: athData, error: athErr } = await window.supabase.from('profiles_athlete').select('*').eq('id', uid);
                if (athErr) throw new Error(`Error al leer profiles_athlete: ${athErr.message}`);
                LOG('ATHLETE')(`Filas encontradas: ${athData.length}. nombre="${athData[0]?.nombre_completo || 'vacío'}"`);

                if (!athData.length || !athData[0].nombre_completo || athData[0].nombre_completo === 'vacío' || !athData[0].deporte || !athData[0].posicion) {
                    LOG('ATHLETE')('Perfil incompleto o inexistente → redirigiendo a onboarding-athlete.html (V2)');
                    // ── V2: Redirección dura al archivo físico de onboarding ──
                    window.location.href = './onboarding-athlete.html';
                    return;
                }

                LOG('ATHLETE')('✅ Perfil completo → redirigiendo a dashboard-athlete.html (V2)');
                window.CurrentUser = athData[0];
                // ── V2: Redirección dura al archivo físico del dashboard ──
                window.location.href = './dashboard-athlete.html';
                return;
            }

            // ── PATH DT ──────────────────────────────────────────────────
            document.body.classList.add('mode-dt');
            document.body.classList.remove('mode-athlete', 'testing-athlete');

            LOG('DT')(`Buscando perfil en profiles_dt... id=${uid.slice(0, 8)}...`);
            const { data: users, error: dtErr } = await window.supabase.from('profiles_dt').select('*').eq('id', uid);
            if (dtErr) throw new Error(`Error al leer tabla profiles_dt: ${dtErr.message}`);
            LOG('DT')(`Filas encontradas: ${users.length}. nombre="${users[0]?.nombre_completo || 'vacío'}" club_actual="${users[0]?.club_actual || 'null'}"`);

            if (!users.length) {
                // Inteligencia Multi-Rol: El usuario existe en auth pero no tiene visado DT. 
                // En lugar de bloquearlo, lo mandamos al Onboarding DT para crear su pasaporte táctico.
                LOG('DT')('❌ Sin fila en profiles_dt. Usuario híbrido. Redirigiendo a Wizard DT para crear visado.');
                this._hideAllViews();
                window.Wizard.startFor('dt');
                return;
            }

            const userData = users[0];

            const isLocalComplete = localStorage.getItem('dt_onboarding_complete') === 'true';
            if (userData.is_profile_complete === true || isLocalComplete) {
                LOG('DT')('Perfil completo validado. Pasando al dashboard...');
            } else if (!userData.nombre_completo || !userData.club_actual) {
                LOG('DT')('Perfil incompleto (sin nombre o equipo) → redirigiendo a Wizard DT');
                this._hideAllViews();
                window.Wizard.startFor('dt');
                return;
            }

            LOG('DT')('Perfil completo. Cargando config de equipo...');
            const [{ data: configs }, { data: teams }] = await Promise.all([
                window.supabase.from('team_configs').select('*').eq('team_id', userData.club_actual),
                window.supabase.from('teams').select('*').eq('id', userData.club_actual)
            ]);
            window.CurrentTeam = teams?.[0] || null;
            LOG('DT')(`Team: "${window.CurrentTeam?.name || 'N/A'}" | Config: ${configs.length} registros`);

            if (configs?.[0]) {
                const cfg = configs[0];
                if (cfg.primary_color) {
                    document.documentElement.style.setProperty('--primary', cfg.primary_color);
                    document.documentElement.style.setProperty('--primary-color', cfg.primary_color);
                    LOG('DT')(`🎨 Branding aplicado: ${cfg.primary_color}`);
                }
                if (window.CurrentTeam) {
                    Object.assign(window.CurrentTeam, {
                        match_dates: cfg.match_dates || [],
                        methodology: cfg.methodology || 'No definida',
                        primary_color: cfg.primary_color || null,
                        tactical_dna: cfg.tactical_dna || {},
                        periodization: cfg.periodization || null,
                    });
                }
            }

            // ── PERSISTIR team_id como fallback ironclad ──────────────────
            // Necesario porque window.CurrentTeam puede ser null si la fila
            // en 'teams' no existe aún, o si teams[0] no tiene campo 'id'.
            const resolvedTeamId = window.CurrentTeam?.id || userData.team_id;
            if (resolvedTeamId) {
                localStorage.setItem('ravix_team_id', resolvedTeamId);
                // Garantizar que CurrentTeam siempre tenga .id
                if (!window.CurrentTeam) {
                    window.CurrentTeam = { id: resolvedTeamId };
                } else if (!window.CurrentTeam.id) {
                    window.CurrentTeam.id = resolvedTeamId;
                }
            }
            LOG('DT')(`✅ teamId persistido: ${resolvedTeamId}`);

            await this.fetchExercisesLibrary();
            await this.fetchCustomExercises();

            window.CurrentUser = userData;
            LOG('DT')('✅ Estado global listo. Activando DT Hub (Portal del Manager)...');
            this._hideAllViews();

            // ── NUEVO PARADIGMA SAAS: DT va al HUB, no al dashboard directo ──
            if (window.location.hash === '#portal') {
                this.handleRouting();
            } else {
                window.location.hash = '#portal';
            }

        } catch (e) {
            console.error('[ROUTER] ❌ Error no manejado en checkSession:', e);
            // No logout silencioso: limpiar sesión y mostrar portal con explicación
            localStorage.removeItem('ravix_token');
            localStorage.removeItem('ravix_v5_uid');
            localStorage.removeItem('ravix_active_role');
            this._showPortalWithError(e.message);
        }
    },



    async fetchExercisesLibrary() {
        try {
            const token = localStorage.getItem('ravix_token');
            const { data, error } = await window.supabase.from('exercises_library').select('*');
            console.log("🔍 Respuesta de exercises_library:", { data, error });
            if (error) throw error;
            if (data) {
                window.ExercisesLibrary = data.map(ex => ({
                    ...ex,
                    numericId: parseInt(ex.id.replace(/\D/g, '')) || Date.now()
                }));
                console.log("📚 Biblioteca Táctica cargada globalmente:", window.ExercisesLibrary.length);
            }

            const { data: customTasks, error: customErr } = await window.supabase.from('custom_exercises').select('*');
            if (!customErr && customTasks) {
                window.CustomExercises = customTasks.map(ex => ({
                    ...ex,
                    numericId: ex.id,
                    isCustom: true
                }));
                console.log("🔒 Tareas personalizadas cargadas en memoria desde init:", window.CustomExercises.length);
            }

        } catch (e) { console.error("🔴 Error cargando biblioteca:", e); }
    },

    async fetchCustomExercises() {
        try {
            const uid = localStorage.getItem('ravix_v5_uid');
            const token = localStorage.getItem('ravix_token');
            const { data, error } = await window.supabase.from('custom_exercises').select('*').eq('user_id', uid).order('created_at', { ascending: false });
            if (error) throw error;
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
            // Guard: evitar doble inyección de CSS
            if (!document.querySelector('link[href="css/styles-player.css"]')) {
                const cssLink = document.createElement('link');
                cssLink.rel = 'stylesheet';
                cssLink.href = 'css/styles-player.css';
                document.head.appendChild(cssLink);
            }

            // Guard: evitar doble inyección de JS
            if (window.AthleteApp) {
                // Ya cargado — lanzar directamente
                window.AthleteApp.init();
                return;
            }

            const script = document.createElement('script');
            script.src = 'js/app-player.js';
            script.onload = () => {
                if (window.AthleteApp) {
                    window.AthleteApp.init();
                } else if (window.PlayerEngine) {
                    window.PlayerEngine.init();
                } else {
                    console.error('[ATHLETE] app-player.js cargó pero no expone AthleteApp ni PlayerEngine');
                    this._showPortalWithError('Error al iniciar el panel del atleta. Por favor recargá la página.');
                }
            };
            script.onerror = (err) => {
                console.error('[ATHLETE] Error cargando app-player.js:', err);
                this._showPortalWithError('No se pudo cargar el panel del atleta. Verificá tu conexión.');
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
                } else {
                    console.error('[DT] app-dt.js cargó pero no expone DTEngine');
                    this._showPortalWithError('Error al iniciar el panel de Staff. Por favor recargá la página.');
                }
            };
            script.onerror = (err) => {
                console.error('[DT] Error cargando app-dt.js:', err);
                this._showPortalWithError('No se pudo cargar el panel de Staff. Verificá tu conexión.');
            };
            document.body.appendChild(script);
        }
    },


    toggleAuth(mode) {
        const loginForm = document.getElementById('login-form');
        const regForm = document.getElementById('register-form');
        const tabLogin = document.getElementById('tab-login');
        const tabReg = document.getElementById('tab-register');
        const slider = document.getElementById('lv-tab-slider');
        const submitBtn = document.getElementById('login-submit-btn');
        const role = this.currentRole || 'dt';

        if (mode === 'register') {
            if (loginForm) loginForm.style.display = 'none';
            if (regForm) regForm.style.display = 'flex';
            if (tabLogin) { tabLogin.classList.remove('lv-tab--active'); tabLogin.setAttribute('aria-selected', 'false'); }
            if (tabReg) { tabReg.classList.add('lv-tab--active'); tabReg.setAttribute('aria-selected', 'true'); }
            if (slider) slider.classList.add('lv-tab-slider--right');
        } else {
            if (loginForm) loginForm.style.display = 'flex';
            if (regForm) regForm.style.display = 'none';
            if (tabLogin) { tabLogin.classList.add('lv-tab--active'); tabLogin.setAttribute('aria-selected', 'true'); }
            if (tabReg) { tabReg.classList.remove('lv-tab--active'); tabReg.setAttribute('aria-selected', 'false'); }
            if (slider) slider.classList.remove('lv-tab-slider--right');
            // Reset submit btn text
            const textSpan = submitBtn?.querySelector('.lv-btn-text');
            if (textSpan) textSpan.textContent = role === 'athlete' ? 'ACCEDER AL LABORATORIO' : 'ENTRAR AL SISTEMA';
        }

        // Clear banners on tab switch
        if (window.LoginUI) window.LoginUI.clearBanners();
    },

    // --- SIGNUP CON ENRUTAMIENTO MANUAL + CANDADO ANTI-DOBLE-ENVÍO ---
    signUp: async function (email, pass) {
        if (this.isProcessingAuth) {
            console.log('⏳ Autenticación en proceso, ignorando doble clic...');
            return;
        }

        this.isProcessingAuth = true;
        const role = this.currentRole || 'dt';
        console.log(`[RAVIX AUTH] Iniciando registro manual para: ${email} como ${role}`);

        try {
            const { data: authData, error: authError } = await window.supabase.auth.signUp({ email, password: pass });

            if (authError) {
                if (authError.message?.includes('already registered')) {
                    window.LoginUI?.showError('Este email ya está registrado. Iniciá sesión.');
                    window.App.toggleAuth('login');
                    return;
                }
                throw new Error(authError.message);
            }

            if (authData.session && authData.user) {
                const uid = authData.user.id;
                const token = authData.session.access_token;
                localStorage.setItem('ravix_token', token);
                localStorage.setItem('ravix_v5_uid', uid);
                // ── PERSISTIR ROL (crítico para checkSession tras reload) ──
                localStorage.setItem('ravix_active_role', role);

                const table = role === 'athlete' ? 'profiles_athlete' : 'users';
                // Para el atleta solo insertamos el ID mínimo — el resto lo
                // completa el Wizard mediante upsert. Evita columna-mismatch.
                const profilePayload = role === 'athlete'
                    ? { id: uid }
                    : { id: uid, name: 'Staff RAVIX', email, role: 'dt', objetivo: 'ALTO_RENDIMIENTO', dt_configured: false };

                const { error: insertErr } = await window.supabase.from(table).insert(profilePayload);
                if (insertErr) {
                    // Si el row ya existe (registro duplicado) lo ignoramos — el Wizard hará upsert
                    if (!insertErr.message?.includes('duplicate') && !insertErr.code?.includes('23505')) {
                        throw new Error('Error al crear perfil inicial: ' + insertErr.message);
                    }
                    console.warn('[SIGNUP] Fila ya existente en', table, '— continuando al Wizard.');
                }

                console.log(`✅ Perfil inicial en ${table}`);
                // ── V2: Router bifurcado — atleta va a su archivo físico ──
                if (role === 'athlete') {
                    window.location.href = './onboarding-athlete.html';
                } else {
                    window.Wizard.startFor(role);
                }
            } else {
                window.LoginUI?.showSuccess('¡Revisa tu correo para confirmar tu cuenta!');
            }
        } catch (err) {
            console.error('🔴 Error Crítico en Registro:', err);
            window.LoginUI?.showError('Error al crear cuenta: ' + err.message);
        } finally {
            this.isProcessingAuth = false;
        }
    },

    logout() { localStorage.clear(); location.reload(); }
};

/* ═══════════════════════════════════════════════════════════
   LOGIN UI — Premium UI Controller
   Manages: particles, role theming, inline errors, password
   strength, tab slider, show-password toggle
═══════════════════════════════════════════════════════════ */
window.LoginUI = (() => {
    let particleCtx, particleCanvas, animId;
    const particles = [];

    // ── PARTICLE SYSTEM ──────────────────────────────────────────
    function makeParticle(canvas, isAthlete) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.15 + Math.random() * 0.25;
        const alpha = 0.1 + Math.random() * 0.35;
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 0.8 + Math.random() * 1.8,
            alpha,
            color: isAthlete
                ? `rgba(191,149,63,${alpha})`
                : (Math.random() > 0.5 ? `rgba(0,242,254,${alpha})` : `rgba(0,114,255,${alpha})`)
        };
    }

    function startParticles() {
        const canvas = document.getElementById('login-particles');
        if (!canvas) return;
        const isAthlete = document.body.classList.contains('mode-athlete');
        particleCanvas = canvas;
        const panel = document.querySelector('.lv-panel--left');
        if (panel) {
            canvas.width = panel.offsetWidth;
            canvas.height = panel.offsetHeight;
        }
        particleCtx = canvas.getContext('2d');
        particles.length = 0;
        for (let i = 0; i < 55; i++) particles.push(makeParticle(canvas, isAthlete));
        if (animId) cancelAnimationFrame(animId);
        (function tick() {
            particleCtx.clearRect(0, 0, canvas.width, canvas.height);
            const a = isAthlete;
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;
                particleCtx.beginPath();
                particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                particleCtx.fillStyle = p.color;
                particleCtx.fill();
            });
            animId = requestAnimationFrame(tick);
        })();
    }

    // ── PORTAL PARTICLES ──────────────────────────────────────────
    function startPortalParticles() {
        const canvas = document.getElementById('portal-particles');
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');
        const pts = [];
        for (let i = 0; i < 80; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 0.12 + Math.random() * 0.22;
            const al = 0.06 + Math.random() * 0.25;
            pts.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                size: 0.6 + Math.random() * 1.5,
                color: Math.random() > 0.5 ? `rgba(0,242,254,${al})` : `rgba(0,114,255,${al})`
            });
        }
        (function tick() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            pts.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
            });
            requestAnimationFrame(tick);
        })();
    }

    // ── ROLE THEME ────────────────────────────────────────────────
    function setRole(role) {
        const isAthlete = role === 'athlete';
        // Left panel text
        const eyebrow = document.getElementById('lv-eyebrow');
        const headline = document.getElementById('lv-headline');
        const sub = document.getElementById('lv-subheadline');
        const stat1 = document.getElementById('lv-stat-1');
        const stat2 = document.getElementById('lv-stat-2');
        const stat3 = document.getElementById('lv-stat-3');
        const rolePill = document.getElementById('lv-role-label');
        const submitText = document.querySelector('#login-submit-btn .lv-btn-text');

        if (eyebrow) eyebrow.textContent = isAthlete ? 'PORTAL ATLETA' : 'PORTAL STAFF';
        if (headline) headline.innerHTML = isAthlete ? 'Laboratorio<br>de Elite' : 'Sistema Táctico<br>de Elite';
        if (sub) sub.textContent = isAthlete
            ? 'Monitorea tu rendimiento, analiza tu progreso y accede a tus planes de entrenamiento personalizados.'
            : 'El ecosistema de rendimiento deportivo más avanzado. Análisis, planificación y control en tiempo real.';
        if (stat1) stat1.textContent = isAthlete ? '12K+' : '48K+';
        if (stat2) stat2.textContent = isAthlete ? '850+' : '320+';
        if (stat3) stat3.textContent = isAthlete ? '4.9★' : '99.9%';
        if (rolePill) rolePill.textContent = isAthlete ? 'Modo Atleta' : 'Modo Staff';
        if (submitText) submitText.textContent = isAthlete ? 'ACCEDER AL LABORATORIO' : 'ENTRAR AL SISTEMA';

        // Register btn text
        const regText = document.querySelector('#register-submit-btn .lv-btn-text');
        if (regText) regText.textContent = isAthlete ? 'CREAR PERFIL DE ATLETA' : 'CREAR CUENTA ELITE';
    }

    // ── BANNERS ───────────────────────────────────────────────────
    function showError(msg) {
        const el = document.getElementById('lv-error');
        const txt = document.getElementById('lv-error-msg');
        const ok = document.getElementById('lv-success');
        if (ok) ok.style.display = 'none';
        if (txt) txt.textContent = msg;
        if (el) { el.style.display = 'flex'; el.style.animation = 'none'; requestAnimationFrame(() => { el.style.animation = ''; }); }
    }

    function showSuccess(msg) {
        const el = document.getElementById('lv-success');
        const txt = document.getElementById('lv-success-msg');
        const err = document.getElementById('lv-error');
        if (err) err.style.display = 'none';
        if (txt) txt.textContent = msg;
        if (el) { el.style.display = 'flex'; el.style.animation = 'none'; requestAnimationFrame(() => { el.style.animation = ''; }); }
    }

    function clearBanners() {
        const err = document.getElementById('lv-error');
        const ok = document.getElementById('lv-success');
        if (err) err.style.display = 'none';
        if (ok) ok.style.display = 'none';
    }

    // ── PASSWORD TOGGLE ───────────────────────────────────────────
    function togglePass(inputId, btnId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        if (!input) return;
        const isText = input.type === 'text';
        input.type = isText ? 'password' : 'text';
        // Swap icon
        const icon = btn?.querySelector('svg');
        if (icon) {
            icon.innerHTML = isText
                ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
                : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
        }
    }

    // ── PASSWORD STRENGTH ─────────────────────────────────────────
    function checkStrength(pass) {
        let score = 0;
        if (pass.length >= 8) score++;
        if (pass.length >= 12) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;
        return score;
    }

    function updateStrength(pass) {
        const fill = document.getElementById('lv-strength-fill');
        const label = document.getElementById('lv-strength-label');
        if (!fill || !label) return;
        if (!pass) { fill.style.width = '0%'; label.textContent = ''; return; }
        const score = checkStrength(pass);
        const levels = [
            { pct: 15, color: '#ef4444', text: 'Muy débil' },
            { pct: 35, color: '#f97316', text: 'Débil' },
            { pct: 58, color: '#eab308', text: 'Regular' },
            { pct: 80, color: '#22c55e', text: 'Fuerte' },
            { pct: 100, color: '#10b981', text: 'Muy fuerte' },
        ];
        const lvl = levels[Math.min(score, levels.length - 1)];
        fill.style.width = lvl.pct + '%';
        fill.style.background = lvl.color;
        label.textContent = lvl.text;
        label.style.color = lvl.color;
    }

    // ── LOADING STATE ─────────────────────────────────────────────
    function setLoading(formType, loading) {
        const btn = document.getElementById(formType === 'login' ? 'login-submit-btn' : 'register-submit-btn');
        const spinner = document.getElementById(formType === 'login' ? 'login-spinner' : 'register-spinner');
        const text = btn?.querySelector('.lv-btn-text');
        if (btn) btn.disabled = loading;
        if (spinner) spinner.style.display = loading ? 'block' : 'none';
        if (text && loading) text.style.opacity = '0.7';
        if (text && !loading) text.style.opacity = '';
    }

    return { startParticles, startPortalParticles, setRole, showError, showSuccess, clearBanners, togglePass, updateStrength, setLoading };
})();

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
        'Voleibol': ['Armador', 'Punta / Receptor', 'Opuesto', 'Central', 'Líbero'],
        'Otro': ['General / Polideportivo', 'Rehabilitacion Deportiva', 'Preparacion Fisica Base']
    };

    function getForm() { return document.getElementById('athlete-onboarding-form'); }
    function q(id) { const f = getForm(); return f ? f.querySelector('#' + id) : document.getElementById(id); }

    function updatePositions(sport) {
        const posSelect = q('ath-pos');
        if (!posSelect) return;
        const positions = POSITIONS[sport] || null;
        if (!positions) {
            posSelect.innerHTML = '<option value="" disabled selected>Primero elige un deporte</option>';
            posSelect.disabled = true;
            posSelect.style.opacity = '0.45';
            posSelect.style.cursor = 'not-allowed';
            return;
        }
        posSelect.style.transition = 'opacity 0.18s ease';
        posSelect.style.opacity = '0';
        setTimeout(() => {
            posSelect.innerHTML = '<option value="" disabled selected>Selecciona posicion...</option>'
                + positions.map(p => `<option value="${p}">${p}</option>`).join('');
            posSelect.disabled = false;
            posSelect.style.cursor = '';
            posSelect.value = '';
            requestAnimationFrame(() => { posSelect.style.opacity = '1'; });
        }, 180);
    }

    let currentStep = 1;
    const TOTAL = 3;

    function updateUI() {
        const form = getForm();
        if (!form) return;
        for (let i = 1; i <= TOTAL; i++) {
            const fs = form.querySelector('#oa-step-' + i);
            const snav = document.getElementById('snav-' + i);
            if (fs) { fs.classList.toggle('active', i === currentStep); }
            if (snav) {
                snav.classList.toggle('active', i === currentStep);
                snav.classList.toggle('done', i < currentStep);
            }
        }
        const pct = Math.round((currentStep / TOTAL) * 100);
        const bar = document.getElementById('oa-progress');
        if (bar) bar.style.width = pct + '%';
        const lbl = document.getElementById('oa-step-label');
        if (lbl) lbl.textContent = `Paso ${currentStep} de ${TOTAL}`;
    }

    function validateStep(step) {
        if (step === 1) {
            const name = q('ath-name')?.value?.trim();
            const sport = q('ath-sport')?.value;
            const pos = q('ath-pos')?.value;
            if (!name) { q('ath-name')?.focus(); alert('Ingresa tu nombre completo.'); return false; }
            if (!sport) { q('ath-sport')?.focus(); alert('Selecciona tu deporte.'); return false; }
            if (!pos) { q('ath-pos')?.focus(); alert('Selecciona tu posicion o especialidad.'); return false; }
        }
        if (step === 2) {
            // Paso 2: biometría — sin campos obligatorios, pero validamos rangos si se ingresaron
            const weight = parseFloat(q('ath-weight')?.value);
            const height = parseFloat(q('ath-height')?.value);
            if (!isNaN(weight) && (weight < 20 || weight > 300)) {
                alert('El peso ingresado parece incorrecto. Verifica el valor (kg).');
                return false;
            }
            if (!isNaN(height) && (height < 100 || height > 250)) {
                alert('La altura ingresada parece incorrecta. Verifica el valor (cm).');
                return false;
            }
        }
        if (step === 3) {
            // Paso 3: goal y commitment son obligatorios para poder guardar
            const goal = q('ath-goal')?.value;
            const commitment = q('ath-commitment')?.value;
            if (!goal) { q('ath-goal')?.focus(); alert('Selecciona tu objetivo neuromuscular.'); return false; }
            if (!commitment) { q('ath-commitment')?.focus(); alert('Selecciona tu nivel de compromiso.'); return false; }
        }
        return true;
    }

    function init() {
        const sportSel = q('ath-sport');
        const posSel = q('ath-pos');
        if (!sportSel || !posSel) return;
        posSel.innerHTML = '<option value="" disabled selected>Primero elige un deporte</option>';
        posSel.disabled = true;
        posSel.style.opacity = '0.45';
        posSel.style.cursor = 'not-allowed';
        sportSel.addEventListener('change', function () { updatePositions(this.value); });
        currentStep = 1;
        updateUI();
    }

    return {
        init,
        onSportChange() { const sport = q('ath-sport')?.value; if (sport) updatePositions(sport); },
        next() { if (!validateStep(currentStep)) return; if (currentStep < TOTAL) { currentStep++; updateUI(); } },
        prev() { if (currentStep > 1) { currentStep--; updateUI(); } }
    };

})();

document.addEventListener('DOMContentLoaded', () => {
    // Init portal particles
    if (window.LoginUI) window.LoginUI.startPortalParticles();

    // Keyboard nav on portal cards
    document.querySelectorAll('.portal-card').forEach(card => {
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
    });

    // If onboarding athlete already visible at load (edge case)
    if (document.getElementById('athlete-onboarding-form')) {
        const oaView = document.getElementById('view-onboarding-athlete');
        if (oaView && oaView.style.display !== 'none' && oaView.style.display !== '') {
            if (window.AthWizard) window.AthWizard.init();
        }
    }

    // Password strength watcher
    const regPass = document.getElementById('register-password');
    if (regPass) {
        regPass.addEventListener('input', () => window.LoginUI?.updateStrength(regPass.value));
    }

    // ── LOGIN FORM ──────────────────────────────────────────────
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.style.display = 'flex'; // ensure flex layout
        loginForm.onsubmit = async function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();

            window.LoginUI?.clearBanners();

            const email = document.getElementById('login-username').value.trim();
            const pass = document.getElementById('login-password').value;
            const role = window.App.currentRole || 'dt';

            if (!email || !pass) {
                window.LoginUI?.showError('Por favor, completá todos los campos.');
                return;
            }

            await window.App.login(email, pass, e);
        };
    }

    // ── REGISTER FORM ───────────────────────────────────────────
    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.onsubmit = async function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();

            window.LoginUI?.clearBanners();

            const email = document.getElementById('register-email').value.trim();
            const pass = document.getElementById('register-password').value;
            const conf = document.getElementById('register-confirm-password').value;

            if (!email || !pass || !conf) {
                window.LoginUI?.showError('Por favor, completá todos los campos.');
                return;
            }
            if (pass !== conf) {
                window.LoginUI?.showError('Las contraseñas no coinciden. Verificalas.');
                return;
            }
            if (pass.length < 6) {
                window.LoginUI?.showError('La contraseña debe tener al menos 6 caracteres.');
                return;
            }

            await window.App.signUp(email, pass, e);
        };
    }

    // ── PROFILE FORM ────────────────────────────────────────────
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.onsubmit = (e) => window.App.saveProfile(e);
    }
});

window.onload = () => App.init();

window.App.login = async function (email, pass, event) {
    if (event) event.preventDefault();
    const btn = event?.target ? event.target.querySelector('button[type="submit"]') : document.getElementById('login-btn-submit');
    const originalText = btn ? btn.textContent : 'Ingresar';
    if (btn) { btn.textContent = 'Iniciando...'; btn.disabled = true; }

    try {
        const { data, error } = await window.supabase.auth.signInWithPassword({
            email: email,
            password: pass,
        });

        if (error) throw error;

        if (data.session && data.user) {
            console.log("✅ Login exitoso.");
            localStorage.setItem('ravix_token', data.session.access_token);
            localStorage.setItem('ravix_v5_uid', data.user.id);
            await window.App.checkSession(data.user.id, data.session.access_token);
        } else {
            throw new Error("No se recibió sesión válida.");
        }
    } catch (err) {
        console.error("🔴 Error en Login:", err);
        alert("Error al iniciar sesión: " + (err.message || "Verifica tus credenciales."));
    } finally {
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
    }
};

window.App.signUp = async function (email, pass, event) {
    if (event) event.preventDefault();
    const btn = event?.target ? event.target.querySelector('button[type="submit"]') : document.getElementById('signup-btn-submit');
    const originalText = btn ? btn.textContent : 'Crear Cuenta';
    if (btn) { btn.textContent = 'Procesando...'; btn.disabled = true; }

    try {
        const { data, error } = await window.supabase.auth.signUp({
            email: email,
            password: pass,
        });

        // Supabase v2 devuelve error 422 como un objeto de error
        if (error) {
            if (error.message.toLowerCase().includes('already registered')) {
                // Definir mensaje premium según el rol actual
                const isAthlete = window.App.currentRole === 'athlete';
                const msg = isAthlete
                    ? "Este email ya se encuentra registrado. Si eres usuario DT, ingresa directo a iniciar sesión para activar tu cuenta de Atleta."
                    : "Este email ya se encuentra registrado. Si eres usuario Atleta, ingresa directo a iniciar sesión para activar tu cuenta de DT.";

                // Inteligencia Multi-Rol: Cambio automático de vista
                window.App.toggleAuth('login');
                const emailInput = document.getElementById('login-username');
                if (emailInput) emailInput.value = email;
                
                // Mostrar notificación al usuario
                if (window.LoginUI && typeof window.LoginUI.showSuccess === 'function') {
                    window.LoginUI.showSuccess(msg);
                } else {
                    alert(msg);
                }
                return;
            }
            throw error;
        }

        const uid = data.user?.id;
        const role = window.App.currentRole || 'dt';

        if (!uid) {
            // Supabase requiere confirmación por email
            window.LoginUI?.showSuccess('¡Revisa tu correo para confirmar tu cuenta!');
            return;
        }

        // ── PERSISTIR ROL (crítico para enrutamiento post-wizard) ──
        localStorage.setItem('ravix_active_role', role);
        if (data.session) {
            localStorage.setItem('ravix_token', data.session.access_token);
            localStorage.setItem('ravix_v5_uid', uid);
        }

        // Inserción mínima en tabla correspondiente
        if (role === 'dt') {
            const profilePayload = { id: uid, nombre_completo: 'Staff RAVIX', is_profile_complete: false };
            const { error: dbError } = await window.supabase.from('profiles_dt').insert([profilePayload]);
            if (dbError) {
                // Duplicate key = el DT ya existe, ignorar y avanzar al Wizard
                if (!dbError.message?.includes('duplicate') && !dbError.code?.includes('23505')) {
                    throw dbError;
                }
                console.warn('[SIGNUP] Perfil ya existente en profiles_dt — redirigiendo al Wizard.');
            }
        }
        // Nota: La creación de la fila en profiles_athlete ocurre en el Onboarding (Paso 1).

        // Transición al Wizard
        if (window.Wizard) window.Wizard.startFor(role);
        else console.error('Wizard no definido');

    } catch (err) {
        console.error("🔴 Error en Registro:", err);
        alert("Error al registrar: " + (err.message || "Intenta nuevamente."));
    } finally {
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
    }
};

window.ejecutarOnboardingFinal = async function() {
    console.log("🚀 INICIANDO GUARDADO DE ONBOARDING FORZADO...");
    
    // Reemplaza los IDs con los de tus inputs HTML
    const inputNombre = document.getElementById('ob-name');
    const inputEquipo = document.getElementById('ob-club-name');
    const inputLicencia = document.getElementById('ob-license');
    
    const nombreDT = inputNombre ? inputNombre.value : 'DT';
    const nombreEquipo = inputEquipo ? inputEquipo.value : 'Mi Equipo';
    const licenciaVal = inputLicencia ? inputLicencia.value : 'AFA / ATFA';
    const userId = localStorage.getItem('ravix_v5_uid') || (await window.supabase.auth.getUser()).data.user?.id; 

    try {
        // PASO 1: Crear Equipo con código aleatorio
        console.log("⏳ Creando equipo...");
        const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase(); 
        
        const { data: newTeam, error: teamError } = await window.supabase
            .from('teams')
            .insert([{ name: nombreEquipo, owner_id: userId, code: generatedCode }])
            .select()
            .single();

        if (teamError) throw new Error("Fallo en teams: " + teamError.message);
        console.log("✅ Equipo creado con ID:", newTeam.id);

        // PASO 2: Actualizar/Crear Perfil (Blindaje UPSERT)
        console.log("⏳ Vinculando perfil al equipo...");
        const { error: userError } = await window.supabase
            .from('profiles_dt') 
            .upsert({ 
                id: userId,
                nombre_completo: nombreDT,
                club_actual: newTeam.id,
                licencia: licenciaVal,
                experiencia_anios: 0,
                is_profile_complete: true
            });

        if (userError) throw new Error("Fallo en tabla perfiles: " + userError.message);
        console.log("✅ Perfil vinculado. Saliendo del Wizard...");

        // PASO 3: Redirección forzada al Dashboard
        localStorage.setItem('dt_onboarding_complete', 'true');
        window.location.reload();
        
    } catch (error) {
        console.error("❌ ERROR CRÍTICO:", error);
        alert("Error al guardar: " + error.message);
    }
};
