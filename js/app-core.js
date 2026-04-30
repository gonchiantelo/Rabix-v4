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
    
    setPath(p) {
        this.path = p;
        document.querySelectorAll('.path-card').forEach(c => c.classList.remove('active'));
        document.getElementById(`path-card-${p}`)?.classList.add('active');
        
        document.getElementById('ob-ui-create').style.display = p === 'create' ? 'block' : 'none';
        document.getElementById('ob-ui-join').style.display = p === 'join' ? 'block' : 'none';
    },

    nextStep() {
        if (this.step < 3) {
            document.getElementById(`ob-step-${this.step}`).style.display = 'none';
            this.step++;
            document.getElementById(`ob-step-${this.step}`).style.display = 'block';
            this.updateStepper();
        }
    },

    prevStep() {
        if (this.step > 1) {
            document.getElementById(`ob-step-${this.step}`).style.display = 'none';
            this.step--;
            document.getElementById(`ob-step-${this.step}`).style.display = 'block';
            this.updateStepper();
        }
    },

    updateStepper() {
        for (let i = 1; i <= 3; i++) {
            const ball = document.getElementById(`ob-ball-${i}`);
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
            console.log(`🚀 Finalizando Onboarding (${this.path})...`);
            let teamId = null;

            if (this.path === 'create') {
                const tName = document.getElementById('ob-team-name').value || "Mi Club";
                const tColor = document.getElementById('ob-team-color').value;
                const tMethodology = document.getElementById('ob-methodology').value;
                const tSystems = document.getElementById('ob-systems-input').value;
                const tCode = 'CU-' + Math.floor(1000 + Math.random() * 9000);

                // 1. Crear Equipo (Insert + Select) -> Columnas: name, code, owner_id
                const tRes = await fetch(`${window.SUPABASE_URL}/rest/v1/teams`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}`, 'Prefer': 'return=representation' },
                    body: JSON.stringify({ name: tName, code: tCode, owner_id: uid })
                });
                const teams = await tRes.json();
                if (!tRes.ok || !teams[0]) throw new Error("Error al fundar equipo.");
                teamId = teams[0].id;

                // 2. Crear Config Táctica -> Columnas: team_id, owner_id, primary_color, methodology, base_systems
                await fetch(`${window.SUPABASE_URL}/rest/v1/team_configs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ 
                        team_id: teamId, 
                        owner_id: uid, 
                        primary_color: tColor,
                        methodology: tMethodology,
                        base_systems: tSystems 
                    })
                });
            } else {
                const code = document.getElementById('ob-invite-code').value;
                const tRes = await fetch(`${window.SUPABASE_URL}/rest/v1/teams?code=eq.${code}`, {
                    headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
                });
                const teams = await tRes.json();
                if (!teams || !teams[0]) throw new Error("Código inválido o equipo no encontrado.");
                teamId = teams[0].id;
            }

            // 3. Actualizar Usuario -> Columnas: name, staff_role, license, team_id
            console.log("📝 Actualizando perfil usuario:", { name, staff_role: role, license, teamId });
            const uRes = await fetch(`${window.SUPABASE_URL}/rest/v1/users?id=eq.${uid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: name, staff_role: role, license: license, team_id: teamId })
            });

            if (!uRes.ok) throw new Error("Error al actualizar perfil.");

            console.log("✅ Onboarding completado.");
            location.reload(); 

        } catch (err) { alert(err.message); }
    }
};

window.App = {
    async init() {
        const uid = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');
        if (uid && token) {
            this.checkSession(uid, token);
        } else {
            document.getElementById('view-login').style.display = 'flex';
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

                // --- STRICT ROUTER GUARD ---
                if (!userData.name || !userData.team_id) {
                    document.getElementById('view-login').style.display = 'none';
                    document.getElementById('app-shell').style.display = 'none';
                    document.getElementById('view-onboarding').style.display = 'flex';
                    return;
                }

                // --- RE-BRANDING DINÁMICO & MEMORIA TÁCTICA ---
                const cRes = await fetch(`${window.SUPABASE_URL}/rest/v1/team_configs?team_id=eq.${userData.team_id}`, {
                    headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
                });
                const configs = await cRes.json();
                
                // Cargar Equipo y Entorno
                const tRes = await fetch(`${window.SUPABASE_URL}/rest/v1/teams?id=eq.${userData.team_id}`, {
                    headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
                });
                const teams = await tRes.json();
                window.CurrentTeam = teams ? teams[0] : null;

                if (configs && configs[0]) {
                    const configData = configs[0];
                    if (configData.primary_color) {
                        document.documentElement.style.setProperty('--primary', configData.primary_color);
                        console.log("🎨 Branding inyectado:", configData.primary_color);
                    }
                    if (window.CurrentTeam) {
                        window.CurrentTeam.match_dates = configData.match_dates || [];
                        window.CurrentTeam.methodology = configData.methodology || "No definida";
                        console.log("🧠 Memoria táctica recuperada:", window.CurrentTeam.match_dates);
                    }
                }
                
                // --- CARGA GLOBAL DE BIBLIOTECA ---
                await this.fetchExercisesLibrary();

                // --- PERSISTENCIA DE USUARIO PARA UI ---
                window.CurrentUser = userData;

                document.getElementById('view-login').style.display = 'none';
                document.getElementById('app-shell').style.display = 'block';
                this.injectRoleAssets(userData.role);
            } else { this.logout(); }
        } catch (e) { console.error("Error checkSession:", e); this.logout(); }
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

    injectRoleAssets(role) {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = 'css/styles-dt.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'js/app-dt.js';
        script.onload = () => { if (window.DTEngine) window.DTEngine.renderDashboard(); };
        document.body.appendChild(script);
    },

    toggleAuth(mode) {
        document.getElementById('login-form').style.display = mode === 'login' ? 'block' : 'none';
        document.getElementById('register-form').style.display = mode === 'register' ? 'block' : 'none';
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
                window.App.checkSession(data.user.id, data.access_token);
            } catch (err) { 
                console.error("🔴 Login Fail:", err);
                alert(err.message); 
            }
        };
    }

    // Register Form
    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.onsubmit = async function(e) {
            e.preventDefault();
            const email = document.getElementById('register-email').value;
            const pass = document.getElementById('register-password').value;
            const conf = document.getElementById('register-confirm-password').value;
            if (pass !== conf) return alert("Las contraseñas no coinciden");

            try {
                if (!window.SUPABASE_URL || window.SUPABASE_URL.includes('undefined')) {
                    throw new Error("Error de configuración: URL de Supabase no definida.");
                }

                const r = await fetch(`${window.SUPABASE_URL}/auth/v1/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY },
                    body: JSON.stringify({ email, password: pass })
                });

                const contentType = r.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    const errorText = await r.text();
                    console.error("🔴 Error de servidor (No JSON):", errorText);
                    throw new Error("Error en el registro. Contacta al administrador.");
                }

                const data = await r.json();
                if (!r.ok) throw new Error(data.msg || data.message || "Error al crear cuenta");
                
                if (data.access_token) {
                    localStorage.setItem('ravix_token', data.access_token);
                    localStorage.setItem('ravix_v5_uid', data.user.id);
                    window.App.checkSession(data.user.id, data.access_token);
                } else { 
                    alert("Verifica tu email para activar la cuenta."); 
                    window.App.toggleAuth('login'); 
                }
            } catch (err) { 
                console.error("🔴 Signup Fail:", err);
                alert(err.message); 
            }
        };
    }
});

window.onload = () => App.init();
