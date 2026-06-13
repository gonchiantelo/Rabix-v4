'use strict';

/* ============================================================
   RAVIX V5 — APP-DT-MEDICAL.JS
   La Clínica — Vista Médica del DT
   ============================================================
   Tabla de origen: player_wellness, team_roster
   Arquitectura: Módulo aislado. Solo inyecta en #view-dt-medical.
   Jamás toca el #player-shell ni lógica del jugador.
   ============================================================ */

window.DTMedical = {

    /* ── Estado interno ── */
    _data: [],     // Array combinado: roster + último wellness del día
    _loading: false,

    /* ═══════════════════════════════════════════════
       INIT — punto de entrada llamado por toggleView
    ═══════════════════════════════════════════════ */
    init: async function () {
        const section = document.getElementById('view-dt-medical');
        if (!section) return;

        if (this._loading) return;
        this._loading = true;

        this._renderSkeleton(section);
        await this._fetchData();
        this._renderTable(section);
        this._loading = false;
    },

    /* ═══════════════════════════════════════════════
       FETCH — Lee roster y wellness de Supabase
    ═══════════════════════════════════════════════ */
    _fetchData: async function () {
        const teamId = window.CurrentTeam?.id || localStorage.getItem('ravix_team_id');
        if (!teamId) {
            this._data = [];
            return;
        }

        try {
            const today = new Date().toISOString().split('T')[0];

            const [rosterRes, wellnessRes] = await Promise.all([
                window.supabase
                    .from('team_roster')
                    .select('*')
                    .eq('team_id', teamId)
                    .order('full_name', { ascending: true }),
                window.supabase
                    .from('player_wellness')
                    .select('*')
                    .eq('team_id', teamId)
                    .eq('fecha', today)
            ]);

            const roster   = rosterRes.data  || [];
            const wellness = wellnessRes.data || [];

            // Indexar wellness por player_id para O(1) lookup
            const wellnessMap = {};
            wellness.forEach(w => { wellnessMap[w.player_id] = w; });

            // Combinar
            this._data = roster.map(player => ({
                ...player,
                wellness: wellnessMap[player.user_id] || null
            }));

        } catch (err) {
            console.error('[DT MEDICAL] Error fetching data:', err);
            this._data = [];
        }
    },

    /* ═══════════════════════════════════════════════
       LÓGICA DE SEMÁFORO HOOPER
       Suma de sueño + estrés + fatiga.
       Escala 1-5 cada uno. Total max = 15.
       ≤ 8 → ÓPTIMO (verde)
       9-11 → PRECAUCIÓN (ámbar)
       ≥ 12 → CRÍTICO (rojo)
    ═══════════════════════════════════════════════ */
    _hooperStatus: function (w) {
        if (!w) return { label: 'SIN DATO', color: '#555', level: 'none' };

        const suma = (w.sleep_quality || 0) + (w.stress_level || 0) + (w.fatigue || 0);

        if (suma <= 8)       return { label: 'ÓPTIMO',    color: '#10B981', level: 'ok',     suma };
        else if (suma <= 11) return { label: 'PRECAUCIÓN', color: '#F59E0B', level: 'warn',   suma };
        else                 return { label: 'CRÍTICO',    color: '#EF4444', level: 'danger', suma };
    },

    /* ═══════════════════════════════════════════════
       LÓGICA DE STATUS MÉDICO
    ═══════════════════════════════════════════════ */
    _statusBadge: function (status) {
        const map = {
            'Activo':    { icon: '🟢', color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
            'Lesionado': { icon: '🔴', color: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
            'Duda':      { icon: '🟡', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)'  },
            'Baja':      { icon: '⛔', color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
        };
        return map[status] || map['Activo'];
    },

    /* ═══════════════════════════════════════════════
       RENDER — Skeleton de carga
    ═══════════════════════════════════════════════ */
    _renderSkeleton: function (section) {
        section.innerHTML = `
            <div class="dtm-header">
                <div class="dtm-header-left">
                    <span class="dtm-eyebrow">LA CLÍNICA</span>
                    <h2 class="dtm-title">Estado del Plantel <span class="dtm-title-accent">HOY</span></h2>
                </div>
                <button class="dtm-refresh-btn" onclick="window.DTMedical.init()" title="Actualizar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.76"/>
                    </svg>
                    Actualizar
                </button>
            </div>
            <div class="dtm-skeleton-rows">
                ${[1,2,3,4,5].map(() => `
                    <div class="dtm-skeleton-row">
                        <div class="dtm-skel dtm-skel--name"></div>
                        <div class="dtm-skel dtm-skel--badge"></div>
                        <div class="dtm-skel dtm-skel--val"></div>
                        <div class="dtm-skel dtm-skel--val"></div>
                        <div class="dtm-skel dtm-skel--val"></div>
                        <div class="dtm-skel dtm-skel--val"></div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /* ═══════════════════════════════════════════════
       RENDER — Tabla principal de datos
    ═══════════════════════════════════════════════ */
    _renderTable: function (section) {
        const players = this._data;

        if (players.length === 0) {
            section.innerHTML = `
                <div class="dtm-header">
                    <div class="dtm-header-left">
                        <span class="dtm-eyebrow">LA CLÍNICA</span>
                        <h2 class="dtm-title">Estado del Plantel <span class="dtm-title-accent">0 JUGADORES</span></h2>
                    </div>
                    <button class="dtm-refresh-btn" onclick="window.DTMedical.init()" title="Actualizar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.76"/>
                        </svg>
                        Actualizar
                    </button>
                </div>
                <div class="dtm-empty-state-premium" style="display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; min-height: 400px; background: linear-gradient(180deg, rgba(20,24,35,0.8) 0%, rgba(10,12,16,0.9) 100%); border: 1px solid rgba(0,242,254,0.1); border-radius: 16px; text-align: center; padding: 40px; margin-top: 20px;">
                    <div style="font-size: 4rem; margin-bottom: 20px; filter: drop-shadow(0 0 10px rgba(0,242,254,0.5));">👥</div>
                    <h3 style="font-size: 1.8rem; font-weight: 900; color: #FFF; letter-spacing: 1px; margin: 0 0 10px 0;">TU PLANTEL ESTÁ VACÍO</h3>
                    <p style="font-size: 0.9rem; color: #9CA3AF; max-width: 400px; line-height: 1.5; margin: 0 0 30px 0;">Para recibir métricas de Wellness y RPE, tus atletas deben unirse al equipo.</p>
                    
                    <button onclick="window.DTMedical.revealInviteCode()" style="background: linear-gradient(90deg, #00F2FE 0%, #4FACFE 100%); color: #000; border: none; padding: 16px 32px; border-radius: 12px; font-weight: 900; font-size: 1rem; cursor: pointer; letter-spacing: 1px; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 15px rgba(0,242,254,0.3);">
                        🔑 REVELAR CÓDIGO DE INVITACIÓN
                    </button>
                    
                    <div id="invite-code-container" style="display:none; margin-top: 30px; animation: dtm-fade-in 0.5s ease-out;">
                        <div style="font-family: 'Outfit', monospace; font-size: 2.8rem; font-weight: 900; color: #00F2FE; letter-spacing: 6px; text-shadow: 0 0 20px rgba(0,242,254,0.4);" id="the-invite-code"></div>
                        <button onclick="window.DTMedical.copyInviteCode()" style="margin-top: 15px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #FFF; padding: 8px 16px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">📋 Copiar al portapapeles</button>
                    </div>
                </div>
            `;
            return;
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long'
        }).toUpperCase();

        const activos   = players.filter(p => (p.medical_status || 'Activo') === 'Activo').length;
        const lesionados = players.filter(p => p.medical_status === 'Lesionado').length;
        const dudas      = players.filter(p => p.medical_status === 'Duda').length;
        const sinDato    = players.filter(p => !p.wellness).length;

        section.innerHTML = `
            <!-- ── HEADER ── -->
            <div class="dtm-header">
                <div class="dtm-header-left">
                    <span class="dtm-eyebrow">LA CLÍNICA · ${dateStr}</span>
                    <h2 class="dtm-title">Estado del Plantel <span class="dtm-title-accent">${players.length} JUGADORES</span></h2>
                </div>
                <button class="dtm-refresh-btn" onclick="window.DTMedical.init()" title="Actualizar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.76"/>
                    </svg>
                    Actualizar
                </button>
            </div>

            <!-- ── KPI ROW ── -->
            <div class="dtm-kpi-row">
                <div class="dtm-kpi dtm-kpi--green">
                    <span class="dtm-kpi-num">${activos}</span>
                    <span class="dtm-kpi-label">APTOS</span>
                </div>
                <div class="dtm-kpi dtm-kpi--red">
                    <span class="dtm-kpi-num">${lesionados}</span>
                    <span class="dtm-kpi-label">LESIONADOS</span>
                </div>
                <div class="dtm-kpi dtm-kpi--amber">
                    <span class="dtm-kpi-num">${dudas}</span>
                    <span class="dtm-kpi-label">EN DUDA</span>
                </div>
                <div class="dtm-kpi dtm-kpi--muted">
                    <span class="dtm-kpi-num">${sinDato}</span>
                    <span class="dtm-kpi-label">SIN REPORTE</span>
                </div>
            </div>

            <!-- ── TABLE ── -->
            <div class="dtm-table-wrap">
                <div class="dtm-table">

                    <!-- TABLE HEADER -->
                    <div class="dtm-thead">
                        <div class="dtm-th dtm-col-player">JUGADOR</div>
                        <div class="dtm-th dtm-col-status">STATUS</div>
                        <div class="dtm-th dtm-col-metric">SUEÑO</div>
                        <div class="dtm-th dtm-col-metric">ESTRÉS</div>
                        <div class="dtm-th dtm-col-metric">FATIGA</div>
                        <div class="dtm-th dtm-col-rpe">RPE SESIÓN</div>
                        <div class="dtm-th dtm-col-hooper">HOOPER</div>
                    </div>

                    <!-- TABLE BODY -->
                    <div class="dtm-tbody" id="dtm-tbody">
                        ${players.map(p => this._renderRow(p)).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    revealInviteCode: async function() {
        const teamId = window.CurrentTeam?.id || localStorage.getItem('ravix_team_id');
        if (!teamId) {
            alert("No hay un equipo activo seleccionado.");
            return;
        }
        
        try {
            const { data, error } = await window.supabase.from('teams').select('invite_code').eq('id', teamId).single();
            let code = data?.invite_code;
            
            if (!code) {
                const teamName = window.CurrentTeam?.name || 'CLUB';
                const prefix = teamName.substring(0,4).toUpperCase().replace(/[^A-Z0-9]/g, '');
                const randomNum = Math.floor(1000 + Math.random() * 9000);
                code = `${prefix}-${randomNum}`;
                
                await window.supabase.from('teams').update({ invite_code: code }).eq('id', teamId);
            }
            
            const container = document.getElementById('invite-code-container');
            const codeEl = document.getElementById('the-invite-code');
            if(container && codeEl) {
                codeEl.innerText = code;
                container.style.display = 'block';
            }
        } catch(e) {
            console.error("Error revelando código:", e);
        }
    },
    
    copyInviteCode: function() {
        const codeEl = document.getElementById('the-invite-code');
        if (codeEl) {
            navigator.clipboard.writeText(codeEl.innerText).then(() => {
                const btn = event.currentTarget;
                const originalText = btn.innerText;
                btn.innerText = "✅ ¡Copiado!";
                setTimeout(() => btn.innerText = originalText, 2000);
            });
        }
    },

    /* ═══════════════════════════════════════════════
       RENDER — Fila individual
    ═══════════════════════════════════════════════ */
    _renderRow: function (player) {
        const status    = player.medical_status || 'Activo';
        const badge     = this._statusBadge(status);
        const w         = player.wellness;
        const hooper    = this._hooperStatus(w);
        const isInjured = status === 'Lesionado';

        const rowClass = isInjured
            ? 'dtm-row dtm-row--injured'
            : (hooper.level === 'danger' ? 'dtm-row dtm-row--critical' : 'dtm-row');

        const metricCell = (val, hooперLevel) => {
            if (!w || val == null) {
                return `<div class="dtm-td dtm-col-metric"><span class="dtm-cell-muted">—</span></div>`;
            }
            const isWarn   = hooперLevel === 'warn'   && val >= 4;
            const isDanger = hooперLevel === 'danger'  && val >= 4;
            const cellMod  = isDanger ? 'dtm-metric--danger' : (isWarn ? 'dtm-metric--warn' : '');
            return `<div class="dtm-td dtm-col-metric"><span class="dtm-metric-val ${cellMod}">${val}</span></div>`;
        };

        const name = player.full_name || player.nombre_completo || 'Atleta';
        const pos  = player.position || player.posicion || '';
        const sport = player.sport || player.deporte || '';

        return `
            <div class="${rowClass}">
                <!-- JUGADOR -->
                <div class="dtm-td dtm-col-player">
                    <div class="dtm-player-wrap">
                        <div class="dtm-player-avatar">${name.charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="dtm-player-name">${name}</div>
                            <div class="dtm-player-sub">${[sport, pos].filter(Boolean).join(' · ').toUpperCase() || 'SIN POSICIÓN'}</div>
                        </div>
                    </div>
                </div>

                <!-- STATUS -->
                <div class="dtm-td dtm-col-status">
                    <span class="dtm-status-badge" style="color:${badge.color}; background:${badge.bg};">
                        ${badge.icon} ${status.toUpperCase()}
                    </span>
                </div>

                <!-- SUEÑO -->
                ${metricCell(w?.sleep_quality, hooper.level)}

                <!-- ESTRÉS -->
                ${metricCell(w?.stress_level, hooper.level)}

                <!-- FATIGA -->
                ${metricCell(w?.fatigue, hooper.level)}

                <!-- RPE -->
                <div class="dtm-td dtm-col-rpe">
                    ${w?.rpe_score != null
                        ? `<span class="dtm-rpe-badge" style="${w.rpe_score >= 8 ? 'color:#EF4444' : w.rpe_score >= 5 ? 'color:#F59E0B' : 'color:#10B981'}">${w.rpe_score}/10</span>`
                        : `<span class="dtm-cell-muted">—</span>`
                    }
                </div>

                <!-- HOOPER TOTAL -->
                <div class="dtm-td dtm-col-hooper">
                    <span class="dtm-hooper-pill" style="color:${hooper.color}; border-color:${hooper.color}; background: ${hooper.color}15;">
                        ${hooper.suma != null ? hooper.suma + '/15 ' : ''}${hooper.label}
                    </span>
                </div>
            </div>
        `;
    },

};

/* ═══════════════════════════════════════════════
   CSS — Inyectado una sola vez en el <head>
═══════════════════════════════════════════════ */
(function injectDTMedicalCSS() {
    if (document.getElementById('dtm-styles')) return;

    const style = document.createElement('style');
    style.id = 'dtm-styles';
    style.textContent = `

    /* ── Sección contenedora ─────────────────────── */
    #view-dt-medical {
        display: none;
        flex-direction: column;
        gap: 20px;
        padding: 24px 28px;
        overflow-y: auto;
        font-family: 'Outfit', 'Inter', sans-serif;
        background: transparent;
        animation: dtm-fade-in 0.35s cubic-bezier(0.16,1,0.3,1) both;
    }

    @keyframes dtm-fade-in {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Header ─────────────────────────────────── */
    .dtm-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
    }

    .dtm-header-left { display: flex; flex-direction: column; gap: 4px; }

    .dtm-eyebrow {
        font-size: 0.6rem;
        font-weight: 800;
        letter-spacing: 3px;
        color: rgba(0,242,254,0.6);
        text-transform: uppercase;
    }

    .dtm-title {
        font-size: 1.4rem;
        font-weight: 900;
        color: #E5E7EB;
        letter-spacing: -0.5px;
        margin: 0;
    }

    .dtm-title-accent {
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 2px;
        color: #00F2FE;
        background: rgba(0,242,254,0.08);
        border: 1px solid rgba(0,242,254,0.15);
        border-radius: 6px;
        padding: 3px 10px;
        vertical-align: middle;
        margin-left: 8px;
    }

    .dtm-refresh-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        color: rgba(255,255,255,0.5);
        font-family: 'Outfit', sans-serif;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.5px;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
    }

    .dtm-refresh-btn:hover {
        background: rgba(0,242,254,0.06);
        border-color: rgba(0,242,254,0.25);
        color: #00F2FE;
    }

    /* ── KPI Row ─────────────────────────────────── */
    .dtm-kpi-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
    }

    .dtm-kpi {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px 20px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
    }

    .dtm-kpi-num {
        font-size: 2rem;
        font-weight: 900;
        line-height: 1;
        letter-spacing: -1px;
    }

    .dtm-kpi-label {
        font-size: 0.58rem;
        font-weight: 800;
        letter-spacing: 2px;
        opacity: 0.5;
    }

    .dtm-kpi--green .dtm-kpi-num { color: #10B981; }
    .dtm-kpi--green              { border-color: rgba(16,185,129,0.15); background: rgba(16,185,129,0.04); }
    .dtm-kpi--red   .dtm-kpi-num { color: #EF4444; }
    .dtm-kpi--red                { border-color: rgba(239,68,68,0.15); background: rgba(239,68,68,0.04); }
    .dtm-kpi--amber .dtm-kpi-num { color: #F59E0B; }
    .dtm-kpi--amber              { border-color: rgba(245,158,11,0.15); background: rgba(245,158,11,0.04); }
    .dtm-kpi--muted .dtm-kpi-num { color: #6B7280; }

    /* ── Table ───────────────────────────────────── */
    .dtm-table-wrap {
        background: #0d1117;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 14px;
        overflow: hidden;
    }

    .dtm-table {
        display: flex;
        flex-direction: column;
        width: 100%;
    }

    /* Column widths via CSS Grid */
    .dtm-thead,
    .dtm-row {
        display: grid;
        grid-template-columns: 2.5fr 1.2fr 0.7fr 0.7fr 0.7fr 0.9fr 1.3fr;
        align-items: center;
        gap: 0;
    }

    .dtm-thead {
        background: rgba(0,0,0,0.3);
        border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .dtm-th {
        padding: 12px 16px;
        font-size: 0.58rem;
        font-weight: 800;
        letter-spacing: 2px;
        color: rgba(255,255,255,0.3);
        text-transform: uppercase;
    }

    .dtm-row {
        border-bottom: 1px solid rgba(255,255,255,0.04);
        transition: background 0.15s;
    }

    .dtm-row:last-child { border-bottom: none; }
    .dtm-row:hover { background: rgba(255,255,255,0.02); }

    /* ── Row accent modifiers ─────────────────────── */
    .dtm-row--injured {
        background: rgba(239, 68, 68, 0.04);
        border-left: 3px solid rgba(239, 68, 68, 0.5);
    }

    .dtm-row--injured:hover {
        background: rgba(239, 68, 68, 0.07);
    }

    .dtm-row--critical {
        background: rgba(245, 158, 11, 0.03);
        border-left: 3px solid rgba(245,158,11, 0.3);
    }

    .dtm-td {
        padding: 14px 16px;
        font-size: 0.82rem;
    }

    /* ── Player cell ──────────────────────────────── */
    .dtm-player-wrap {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .dtm-player-avatar {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(0,242,254,0.15), rgba(0,242,254,0.05));
        border: 1px solid rgba(0,242,254,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        font-weight: 800;
        color: #00F2FE;
        flex-shrink: 0;
    }

    .dtm-player-name {
        font-size: 0.88rem;
        font-weight: 700;
        color: #E5E7EB;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .dtm-player-sub {
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 1px;
        color: rgba(255,255,255,0.3);
        margin-top: 2px;
    }

    /* ── Status badge ─────────────────────────────── */
    .dtm-status-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.6rem;
        font-weight: 800;
        letter-spacing: 1px;
        white-space: nowrap;
    }

    /* ── Metric cells ─────────────────────────────── */
    .dtm-metric-val {
        font-size: 1rem;
        font-weight: 800;
        color: #C8C8C8;
    }

    .dtm-metric-val.dtm-metric--warn   { color: #F59E0B; }
    .dtm-metric-val.dtm-metric--danger { color: #EF4444; }

    .dtm-cell-muted {
        font-size: 0.85rem;
        color: rgba(255,255,255,0.2);
        font-weight: 600;
    }

    /* ── RPE badge ────────────────────────────────── */
    .dtm-rpe-badge {
        font-size: 0.9rem;
        font-weight: 800;
    }

    /* ── Hooper pill ──────────────────────────────── */
    .dtm-hooper-pill {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid;
        font-size: 0.6rem;
        font-weight: 800;
        letter-spacing: 1px;
        white-space: nowrap;
    }

    /* ── Skeleton ─────────────────────────────────── */
    .dtm-skeleton-rows { display: flex; flex-direction: column; gap: 2px; }

    .dtm-skeleton-row {
        display: grid;
        grid-template-columns: 2.5fr 1.2fr 0.7fr 0.7fr 0.7fr 0.9fr;
        gap: 12px;
        padding: 14px 16px;
        border-radius: 8px;
        background: rgba(255,255,255,0.02);
    }

    .dtm-skel {
        height: 16px;
        border-radius: 4px;
        background: rgba(255,255,255,0.06);
        animation: dtm-pulse 1.4s ease-in-out infinite;
    }

    .dtm-skel--name  { width: 80%; height: 18px; }
    .dtm-skel--badge { width: 70%; }
    .dtm-skel--val   { width: 50%; }

    @keyframes dtm-pulse {
        0%, 100% { opacity: 0.5; }
        50%       { opacity: 1;   }
    }

    /* ── Empty state ──────────────────────────────── */
    .dtm-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
        gap: 12px;
    }

    .dtm-empty-icon { font-size: 2.5rem; }
    .dtm-empty h3 { font-size: 1rem; font-weight: 700; color: #E5E7EB; }
    .dtm-empty p  { font-size: 0.82rem; color: rgba(255,255,255,0.4); }

    `;
    document.head.appendChild(style);
})();
