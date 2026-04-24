'use strict';

const SUPA_URL = 'https://rscdpwarzltozigfbmev.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzY2Rwd2Fyemx0b3ppZ2ZibWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjYyNjUsImV4cCI6MjA5MTg0MjI2NX0.WaKWoCxbaQ3VVDXLtfBvNyB9zywxZRHCwjzT-5gS-b0';

window.App = {
    async init() {
        const uid = localStorage.getItem('ravix_v5_uid');
        if (uid) this.checkSession(uid);
    },

    async checkSession(uid) {
        try {
            const r = await fetch(`${SUPA_URL}/rest/v1/users?id=eq.${uid}`, {
                headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${localStorage.getItem('ravix_token')}` }
            });
            const users = await r.json();
            if (users && users[0]) this.injectRoleAssets(users[0].role);
        } catch (e) { this.logout(); }
    },

    async login(email, password) {
        try {
            const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
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
            // Inyectar CSS
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/styles-dt.css';
            document.head.appendChild(link);

            // Inyectar JS
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

document.getElementById('login-form').onsubmit = (e) => {
    e.preventDefault();
    App.login(document.getElementById('login-username').value, document.getElementById('login-password').value);
};

window.onload = () => App.init();
