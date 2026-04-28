'use strict';

window.SUPA_URL = 'https://rscdpwarzltozigfbmev.supabase.co';
window.SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzY2Rwd2Fyemx0b3ppZ2ZibWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjYyNjUsImV4cCI6MjA5MTg0MjI2NX0.WaKWoCxbaQ3VVDXLtfBvNyB9zywxZRHCwjzT-5gS-b0';
window.SUPABASE_URL = window.SUPA_URL;
window.SUPABASE_KEY = window.SUPA_KEY;

// Exponer Supa globalmente para los mundos DT/Player
window.Supa = {
    async _req(method, path, body) {
        try {
            const token = localStorage.getItem('ravix_token');
            const apiKey = window.SUPA_KEY;
            const authHeader = token ? `Bearer ${token}` : `Bearer ${apiKey}`;
            
            const opts = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': apiKey,
                    'Authorization': authHeader,
                    'Prefer': 'return=minimal'
                }
            };
            if (body) opts.body = JSON.stringify(body);
            const r = await fetch(`${window.SUPA_URL}/rest/v1/${path}`, opts);
            if (!r.ok) return null;
            const text = await r.text();
            return text ? JSON.parse(text) : true;
        } catch (e) { return null; }
    }
};

window.App = {
    async init() {
        const uid = localStorage.getItem('ravix_v5_uid');
        if (uid) this.checkSession(uid);
    },

    async checkSession(uid) {
        try {
            const r = await fetch(`${window.SUPA_URL}/rest/v1/users?id=eq.${uid}`, {
                headers: { 'apikey': window.SUPA_KEY, 'Authorization': `Bearer ${localStorage.getItem('ravix_token')}` }
            });
            const users = await r.json();
            if (users && users[0]) {
                const user = users[0];
                let teamData = null;
                if (user.team_id) {
                    teamData = await window.Supa._req('GET', `teams?id=eq.${user.team_id}`);
                    if (teamData) teamData = teamData[0];
                }
                window.CurrentTeam = teamData;
                this.injectRoleAssets(user.role);
            } else {
                console.error("🔴 Usuario no encontrado en la base de datos.");
                alert("Tu cuenta no tiene un perfil vinculado en Ravix.");
                this.logout();
            }
        } catch (e) { this.logout(); }
    },

    async login(email, password) {
        try {
            const r = await fetch(`${window.SUPA_URL}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': window.SUPA_KEY },
                body: JSON.stringify({ email, password })
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error_description || data.message);
            
            localStorage.setItem('ravix_token', data.access_token);
            localStorage.setItem('ravix_v5_uid', data.user.id);
            this.checkSession(data.user.id);
        } catch (err) { alert('Error: ' + err.message); }
    },

    toggleAuth(mode) {
        const login = document.getElementById('login-form');
        const register = document.getElementById('register-form');
        if (mode === 'register') {
            login.style.display = 'none';
            register.style.display = 'block';
        } else {
            login.style.display = 'block';
            register.style.display = 'none';
        }
    },

    injectRoleAssets(role) {
        if (role === 'dt' || role === 'admin') {
            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = 'css/styles-dt.css';
            document.head.appendChild(link);

            const script = document.createElement('script');
            script.src = 'js/app-dt.js';
            script.onload = () => {
                document.getElementById('view-login').style.display = 'none';
                console.log('✅ Entorno DT Cargado y Ruteo Exitoso');
                if (window.DTEngine) window.DTEngine.renderDashboard();
            };
            document.body.appendChild(script);
        }
    },

    logout() {
        localStorage.clear();
        location.reload();
    }
};

window.Wizard = {
    step: 1,
    path: 'create',
    
    selectPath(p) {
        this.path = p;
        document.getElementById('path-create')?.classList.toggle('active', p === 'create');
        document.getElementById('path-join')?.classList.toggle('active', p === 'join');
        
        // Sincronizar visibilidad del Paso 3 preventivamente
        const createEl = document.getElementById('ob-final-create');
        const joinEl = document.getElementById('ob-final-join');
        if (createEl) createEl.style.display = p === 'create' ? 'block' : 'none';
        if (joinEl) joinEl.style.display = p === 'join' ? 'block' : 'none';
    },

    nextStep() {
        if (this.step < 3) {
            document.getElementById(`step-${this.step}`).style.display = 'none';
            this.step++;
            document.getElementById(`step-${this.step}`).style.display = 'block';
            this.updateStepper();
        }
    },

    prevStep() {
        if (this.step > 1) {
            document.getElementById(`step-${this.step}`).style.display = 'none';
            this.step--;
            document.getElementById(`step-${this.step}`).style.display = 'block';
            this.updateStepper();
        }
    },

    updateStepper() {
        for (let i = 1; i <= 3; i++) {
            const ball = document.getElementById(`ball-${i}`);
            if (ball) ball.classList.toggle('active', i <= this.step);
        }
    },

    async finish() {
        const uid = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');
        
        const name = document.getElementById('ob-name').value;
        const role = document.getElementById('ob-role').value;
        const license = document.getElementById('ob-license').value;
        
        if (!name) return alert("Por favor, ingresa tu nombre.");

        try {
            console.log(`🚀 Iniciando flujo Onboarding V2 (${this.path})...`);
            let teamId = null;

            if (this.path === 'create') {
                const teamName = document.getElementById('ob-team').value || "Mi Equipo";
                const teamColor = document.getElementById('ob-color').value;
                const teamCode = 'CU-' + Math.floor(1000 + Math.random() * 9000);

                // 1. Crear Equipo (Insert + Select)
                const tRes = await fetch(`${window.SUPABASE_URL}/rest/v1/teams`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 
                        'Authorization': `Bearer ${token}`, 'Prefer': 'return=representation' 
                    },
                    body: JSON.stringify({ name: teamName, primary_color: teamColor, team_code: teamCode })
                });
                
                const teams = await tRes.json();
                if (!tRes.ok || !teams[0]) throw new Error("Error al crear el equipo.");
                teamId = teams[0].id;

                // 2. Crear Config Táctica
                const activePills = Array.from(document.querySelectorAll('#pills-systems .pill.active')).map(p => p.getAttribute('data-val'));
                await fetch(`${window.SUPABASE_URL}/rest/v1/team_configs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ 
                        team_id: teamId, 
                        owner_id: uid, 
                        methodology: document.getElementById('ob-methodology').value,
                        base_system: activePills.join(', '),
                        preferred_matchday: document.getElementById('ob-matchday').value
                    })
                });
            } else {
                // RUTA JOIN
                const code = document.getElementById('ob-team-code').value;
                const tRes = await fetch(`${window.SUPABASE_URL}/rest/v1/teams?team_code=eq.${code}`, {
                    headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
                });
                const teams = await tRes.json();
                if (!teams || !teams[0]) throw new Error("Código de invitación inválido.");
                teamId = teams[0].id;
            }

            // 3. Actualizar Perfil de Usuario
            const uRes = await fetch(`${window.SUPABASE_URL}/rest/v1/users?id=eq.${uid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ full_name: name, role: role, license: license, team_id: teamId })
            });

            if (!uRes.ok) throw new Error("Error al vincular el perfil.");

            console.log("✅ Ciclo de acceso completado. Redirigiendo...");
            
            // Forzar recarga de estado y assets
            document.getElementById('view-onboarding').style.display = 'none';
            document.getElementById('app-shell').style.display = 'block';
            window.App.injectRoleAssets('dt');

        } catch (err) {
            console.error("🔴 Error Onboarding:", err);
            alert("Error: " + err.message);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.onsubmit = async function(e) {
                e.preventDefault();
                console.log("🟢 EVENTO CAPTURADO: Iniciando secuencia de Login...");
                const email = document.getElementById('login-username').value;
                const pass = document.getElementById('login-password').value;
                
                try {
                    // 1. Golpear la puerta de Supabase para validar usuario
                    const authRes = await fetch(`${window.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': window.SUPABASE_KEY
                        },
                        body: JSON.stringify({ email: email, password: pass })
                    });
                    
                    const authData = await authRes.json();
                    
                    if (!authRes.ok) {
                        throw new Error(authData.error_description || 'Error de credenciales');
                    }
                    
                    console.log("🟢 Token recibido. ¡Bienvenido DT!");
                    
                    if (authData.access_token && authData.user) {
                        // 2. Guardar el token de acceso
                        localStorage.setItem('ravix_token', authData.access_token);
                        localStorage.setItem('ravix_v5_uid', authData.user.id);
                        
                        // --- FASE 4: INYECCIÓN DE IDENTIDAD POST-LOGIN ---
                        // a. Obtener perfil de usuario (rol y equipo)
                        const userRes = await fetch(`${window.SUPABASE_URL}/rest/v1/users?id=eq.${authData.user.id}`, {
                            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${authData.access_token}` }
                        });
                        const users = await userRes.json();
                        
                        if (users && users[0]) {
                            const user = users[0];
                            // b. Obtener datos del equipo
                            if (user.team_id) {
                                const teamData = await window.Supa._req('GET', `teams?id=eq.${user.team_id}`);
                                if (teamData && teamData[0]) window.CurrentTeam = teamData[0];
                            }
                            
                            // 3. Transición de UI o Onboarding
                            if (!user.full_name) {
                                document.getElementById('view-login').style.display = 'none';
                                document.getElementById('view-onboarding').style.display = 'flex';
                            } else {
                                document.getElementById('view-login').style.display = 'none';
                                const appShell = document.getElementById('app-shell');
                                if (appShell) appShell.style.display = 'block';
                                window.App.injectRoleAssets(user.role);
                            }
                        } else {
                            throw new Error("No se encontró perfil de usuario vinculado.");
                        }
                    } else {
                        throw new Error("Respuesta de autenticación incompleta.");
                    }
                    
                } catch (error) {
                    console.error("🔴 Error en login:", error);
                    alert("Error al iniciar: " + error.message);
                }
            };
        }
    }, 500);

    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.onsubmit = async function(e) {
            e.preventDefault();
            const email = document.getElementById('register-email').value;
            const pass = document.getElementById('register-password').value;
            const conf = document.getElementById('register-confirm-password').value;

            if (pass !== conf) return alert("Las contraseñas no coinciden");
            if (pass.length < 6) return alert("La contraseña debe tener al menos 6 caracteres");

            try {
                console.log("🚀 Iniciando registro en Supabase...");
                const res = await fetch(`${window.SUPABASE_URL}/auth/v1/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY },
                    body: JSON.stringify({ email, password: pass })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.msg || data.message || "Error al crear cuenta");

                console.log("🟢 Registro exitoso. Iniciando sesión automática...");
                
                if (data.access_token) {
                    localStorage.setItem('ravix_token', data.access_token);
                    localStorage.setItem('ravix_v5_uid', data.user.id);
                    
                    document.getElementById('view-login').style.display = 'none';
                    document.getElementById('view-onboarding').style.display = 'flex';
                } else {
                    alert("Cuenta creada. Por favor, verifica tu email para activar tu cuenta e inicia sesión.");
                    window.App.toggleAuth('login');
                }

            } catch (err) {
                console.error("🔴 Error en Registro:", err);
                alert("Error: " + err.message);
            }
        };
    }
});

window.onload = () => App.init();
