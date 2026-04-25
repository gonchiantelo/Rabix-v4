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

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.onsubmit = async function(e) {
                e.preventDefault();
                console.log("🟢 EVENTO CAPTURADO: Iniciando secuencia de Login...");
                const email = document.getElementById('login-username').value;
                const pass = document.getElementById('login-password').value;
                
                if (window.App && window.App.login) {
                    window.App.login(email, pass);
                } else {
                    console.error("🔴 APP ERROR: window.App.login no definida.");
                }
            };
        } else {
            console.error("🔴 DOM ERROR: No se encontró el formulario #login-form");
        }
    }, 500); // Retraso para asegurar que el DOM esté listo
});

window.onload = () => App.init();
