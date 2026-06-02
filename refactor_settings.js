const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js/app-dt.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Extraer "ADN TÁCTICO" y "11 IDEAL" de settings-tab-dt
const adnTacticoStart = '<div class="profile-card" style="margin-top: 20px;">\n                                        <h3 class="profile-section-title">⚙️ ADN TÁCTICO — MODELO DE JUEGO</h3>';
const ideal11Start = '<div class="profile-card" style="margin-top: 20px;">\n                                        <h3 class="profile-section-title">⚽ ESTRUCTURA Y PERFILES DEL 11 IDEAL</h3>';
const ideal11End = '</div>\n                                    <button class="btn-save-profile" onclick="DTEngine.saveDTProfile()" style="margin-top: 25px;">GUARDAR PERFIL DEL DT</button>\n                                </div>';

const adnIndex = code.indexOf(adnTacticoStart);
const idealEndIndex = code.indexOf(ideal11End);

if (adnIndex === -1 || idealEndIndex === -1) {
    console.error("No se pudo encontrar la sección ADN Táctico o 11 Ideal");
    process.exit(1);
}

const tacticsContent = code.substring(adnIndex, idealEndIndex + 6); // Hasta el cierre del div profile-card

// 2. Reemplazar settings-tab-dt
const dtTabStart = '<div id="settings-tab-dt" class="settings-tab-content" style="display: block;">';
const dtTabContentOld = code.substring(code.indexOf(dtTabStart), idealEndIndex + ideal11End.length);

const dtTabNew = `<div id="settings-tab-dt" class="settings-tab-content" style="display: block;">
                                    <div class="profile-card">
                                        <h3 class="profile-section-title">IDENTIDAD STAFF</h3>
                                        <div class="profile-form-grid" style="align-items: center;">
                                            <div class="profile-input-group" style="grid-column: span 2; display: flex; align-items: center; gap: 20px;">
                                                <div style="position: relative; width: 80px; height: 80px; border-radius: 50%; overflow: hidden; background: #1f2937; border: 2px solid #00F2FE;">
                                                    <img id="prof-avatar-preview" src="" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; display: none;">
                                                </div>
                                                <div>
                                                    <label>FOTO DE PERFIL</label>
                                                    <input type="file" id="prof-avatar-upload" accept="image/*" class="profile-input" style="padding: 8px;" onchange="window.DTEngine.handleImageUpload(event, 'prof-avatar-preview', 'avatar_url_base64')">
                                                    <input type="hidden" id="avatar_url_base64">
                                                </div>
                                            </div>
                                            <div class="profile-input-group">
                                                <label>NOMBRE COMPLETO</label>
                                                <input type="text" id="prof-name" class="profile-input" placeholder="Nombre del DT" autocomplete="name">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>EMAIL</label>
                                                <input type="email" id="prof-email" class="profile-input" readonly style="opacity: 0.7; cursor: not-allowed;" placeholder="dt@equipo.com">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>LICENCIA</label>
                                                <select id="prof-license" class="profile-input">
                                                    <option value="UEFA PRO">UEFA PRO</option>
                                                    <option value="CONMEBOL PRO">CONMEBOL PRO</option>
                                                    <option value="AFA / ATFA">AFA / ATFA</option>
                                                    <option value="AMATEUR">AMATEUR</option>
                                                </select>
                                            </div>
                                            <div class="profile-input-group" style="display: flex; flex-direction: column; justify-content: center;">
                                                <label>SUSCRIPCIÓN</label>
                                                <div style="display: inline-block; padding: 5px 12px; background: rgba(0,242,254,0.1); color: #00F2FE; border: 1px solid #00F2FE; border-radius: 20px; font-weight: bold; font-size: 12px; text-align: center; width: max-content;">
                                                    PRO / ELITE
                                                </div>
                                            </div>
                                            <div class="profile-input-group" style="grid-column: span 2;">
                                                <button type="button" class="btn-save-profile" style="background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); margin-top: 10px; width: auto; padding: 10px 20px;" onclick="alert('Funcionalidad de cambio de contraseña próximamente')">Cambiar Contraseña</button>
                                            </div>
                                        </div>
                                    </div>
                                    <button class="btn-save-profile" onclick="DTEngine.saveDTProfile()" style="margin-top: 25px;">GUARDAR PERFIL DEL DT</button>
                                </div>`;

code = code.replace(dtTabContentOld, dtTabNew);

// 3. Reemplazar settings-tab-club
const clubTabStart = '<div id="settings-tab-club" class="settings-tab-content" style="display: none;">';
const clubTabEnd = '</div>\n                                    <button class="btn-save-profile" onclick="DTEngine.saveClubSettings()" style="margin-top: 25px;">GUARDAR CLUB Y PLANTEL</button>\n                                </div>';
const clubTabContentOld = code.substring(code.indexOf(clubTabStart), code.indexOf(clubTabEnd) + clubTabEnd.length);

const clubTabNew = `<div id="settings-tab-club" class="settings-tab-content" style="display: none;">
                                    <div class="profile-card">
                                        <h3 class="profile-section-title">🛡️ CONFIGURACIÓN DEL CLUB</h3>
                                        <div class="profile-form-grid" style="align-items: center;">
                                            <div class="profile-input-group" style="grid-column: span 2; display: flex; align-items: center; gap: 20px;">
                                                <div style="position: relative; width: 80px; height: 80px; border-radius: 12px; overflow: hidden; background: #1f2937; border: 2px solid #374151;">
                                                    <img id="prof-shield-preview" src="" alt="Escudo" style="width: 100%; height: 100%; object-fit: contain; display: none;">
                                                </div>
                                                <div>
                                                    <label>ESCUDO DEL CLUB</label>
                                                    <input type="file" id="prof-shield-upload" accept="image/*" class="profile-input" style="padding: 8px;" onchange="window.DTEngine.handleImageUpload(event, 'prof-shield-preview', 'shield_url_base64')">
                                                    <input type="hidden" id="shield_url_base64">
                                                </div>
                                            </div>
                                            <div class="profile-input-group">
                                                <label>NOMBRE DEL EQUIPO</label>
                                                <input type="text" id="prof-team-name" class="profile-input" placeholder="Nombre del Club">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>CATEGORÍA</label>
                                                <input type="text" id="prof-team-category" class="profile-input" placeholder="Ej. Primera División">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>LIGA</label>
                                                <input type="text" id="prof-team-liga" class="profile-input" placeholder="Ej. La Liga">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>COLOR PRINCIPAL</label>
                                                <input type="color" id="prof-team-color" class="profile-input" style="height: 48px; padding: 5px;">
                                            </div>
                                            <div class="profile-input-group" style="grid-column: span 2;">
                                                <label>METODOLOGÍA</label>
                                                <select id="prof-methodology" class="profile-input">
                                                    <option value="Periodización Táctica">Periodización Táctica</option>
                                                    <option value="Microciclo Estructurado">Microciclo Estructurado</option>
                                                    <option value="Entrenamiento Integrado">Entrenamiento Integrado</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
${tacticsContent}
                                    <button class="btn-save-profile" onclick="DTEngine.saveClubSettings()" style="margin-top: 25px;">GUARDAR CLUB Y PLANTEL</button>
                                </div>`;

code = code.replace(clubTabContentOld, clubTabNew);


// 4. Update handleImageUpload function
const handleImgFunc = `
    handleImageUpload(event, previewId, hiddenId) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const base64Str = e.target.result;
                document.getElementById(hiddenId).value = base64Str;
                const preview = document.getElementById(previewId);
                preview.src = base64Str;
                preview.style.display = 'block';
            }
            reader.readAsDataURL(file);
        }
    },
`;

code = code.replace('switchSettingsTab(tabId) {', handleImgFunc + '\n    switchSettingsTab(tabId) {');


// 5. Update loadProfile
const loadProfileOld = `
            if (nameEl) nameEl.value = userData.name || '';
            if (dtNameInputEl) dtNameInputEl.value = userData.name || '';
            if (teamNameEl) teamNameEl.value = teamData.name || '';
            if (teamColorEl) teamColorEl.value = teamData.primary_color || '#079FA0';

            try {
                // Cargar datos planos desde profiles_dt
                const { data: pData, error } = await window.supabase
                    .from('profiles_dt')
                    .select('*')
                    .eq('id', userData.id)
                    .single();

                if (pData) {
                    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== null && val !== undefined) el.value = val; };
                    
                    setVal('prof-license', pData.licencia);
                    setVal('prof-methodology', pData.metodologia);
                    setVal('dna-esquema', pData.esquema_base);
                    setVal('dna-ataque', pData.organizacion_ofensiva);
                    setVal('altura_bloque_ofensivo', pData.altura_bloque_ofensivo);
                    setVal('dna-defensa', pData.organizacion_defensiva);
                    setVal('dna-bloque', pData.altura_bloque_defensivo);
                    setVal('dna-trans-def', pData.transicion_ata_def);
                    setVal('dna-trans-of', pData.transicion_def_ata);
                    
                    // Manejo de reglas de acción y provocación (Sincronizado con esquema BD)
                    const reglasVal = pData.reglas_accion_provocacion || pData.reglas_accion || pData.reglas_propension || '';
                    setVal('reglas_propension', reglasVal);
                    if (reglasVal && document.getElementById('rules-tag-input-wrapper')) {
                        DTEngine.RulesTagInput.load(reglasVal.split('|').map(s => s.trim()));
                    }

                    // Inputs del 11 ideal
                    setVal('ideal_arquero', pData.ideal_arquero);
                    setVal('ideal_lateral_derecho', pData.ideal_lateral_derecho);
                    setVal('ideal_central_derecho', pData.ideal_central_derecho);
                    setVal('ideal_central_izquierdo', pData.ideal_central_izquierdo);
                    setVal('ideal_lateral_izquierdo', pData.ideal_lateral_izquierdo);
                    setVal('ideal_pivote', pData.ideal_pivote);
                    setVal('ideal_interior_derecho', pData.ideal_interior_derecho);
                    setVal('ideal_interior_izquierdo', pData.ideal_interior_izquierdo);
                    setVal('ideal_extremo_derecho', pData.ideal_extremo_derecho);
                    setVal('ideal_extremo_izquierdo', pData.ideal_extremo_izquierdo);
                    setVal('ideal_delantero', pData.ideal_delantero);

                    // Reflejar cambios visuales en caso de usar el canvas antiguo temporalmente
                    if (teamData.tactical_dna?.ideal_11) {
                        DTEngine.PitchEngine.load(teamData.tactical_dna.ideal_11);
                    }
                }
`;

const loadProfileNew = `
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== null && val !== undefined) el.value = val; };

            if (nameEl) nameEl.value = userData.name || '';
            if (dtNameInputEl) dtNameInputEl.value = userData.name || '';
            
            const emailEl = document.getElementById('prof-email');
            if (emailEl) emailEl.value = userData.email || '';

            try {
                // Cargar datos del DT
                const { data: pData } = await window.supabase.from('profiles_dt').select('*').eq('id', userData.id).single();

                if (pData) {
                    setVal('prof-license', pData.licencia);
                    if (pData.avatar_url) {
                        const avatarPreview = document.getElementById('prof-avatar-preview');
                        if (avatarPreview) {
                            avatarPreview.src = pData.avatar_url;
                            avatarPreview.style.display = 'block';
                        }
                        const avatarHidden = document.getElementById('avatar_url_base64');
                        if (avatarHidden) avatarHidden.value = pData.avatar_url;
                        
                        const innerAvatar = document.querySelector('.dt-avatar-inner');
                        if(innerAvatar) {
                            innerAvatar.style.backgroundImage = 'url(' + pData.avatar_url + ')';
                            innerAvatar.style.backgroundSize = 'cover';
                        }
                    }
                }
                
                // Cargar datos del Club y Táctica (de la tabla teams)
                const { data: tData } = await window.supabase.from('teams').select('*').eq('id', teamData.id).single();
                if (tData) {
                    setVal('prof-team-name', tData.name || '');
                    setVal('prof-team-category', tData.category || tData.categoria || '');
                    setVal('prof-team-liga', tData.liga || '');
                    
                    if (tData.logo_url) {
                        const shieldPreview = document.getElementById('prof-shield-preview');
                        if (shieldPreview) {
                            shieldPreview.src = tData.logo_url;
                            shieldPreview.style.display = 'block';
                        }
                        const shieldHidden = document.getElementById('shield_url_base64');
                        if (shieldHidden) shieldHidden.value = tData.logo_url;
                    }

                    // Táctica y 11 Ideal
                    setVal('dna-esquema', tData.esquema_base);
                    setVal('dna-ataque', tData.organizacion_ofensiva);
                    setVal('altura_bloque_ofensivo', tData.altura_bloque_ofensivo);
                    setVal('dna-defensa', tData.organizacion_defensiva);
                    setVal('dna-bloque', tData.altura_bloque_defensivo);
                    setVal('dna-trans-def', tData.transicion_ata_def);
                    setVal('dna-trans-of', tData.transicion_def_ata);
                    
                    const reglasVal = tData.reglas_accion_provocacion || tData.reglas_accion || tData.reglas_propension || '';
                    setVal('reglas_propension', reglasVal);
                    if (reglasVal && document.getElementById('rules-tag-input-wrapper')) {
                        DTEngine.RulesTagInput.load(reglasVal.split('|').map(s => s.trim()));
                    }

                    setVal('ideal_arquero', tData.ideal_arquero);
                    setVal('ideal_lateral_derecho', tData.ideal_lateral_derecho);
                    setVal('ideal_central_derecho', tData.ideal_central_derecho);
                    setVal('ideal_central_izquierdo', tData.ideal_central_izquierdo);
                    setVal('ideal_lateral_izquierdo', tData.ideal_lateral_izquierdo);
                    setVal('ideal_pivote', tData.ideal_pivote);
                    setVal('ideal_interior_derecho', tData.ideal_interior_derecho);
                    setVal('ideal_interior_izquierdo', tData.ideal_interior_izquierdo);
                    setVal('ideal_extremo_derecho', tData.ideal_extremo_derecho);
                    setVal('ideal_extremo_izquierdo', tData.ideal_extremo_izquierdo);
                    setVal('ideal_delantero', tData.ideal_delantero);

                    if (tData.tactical_dna?.ideal_11) {
                        DTEngine.PitchEngine.load(tData.tactical_dna.ideal_11);
                    }
                }

                // Color y Metodologia (siguen en team_configs por ahora)
                const { data: cData } = await window.supabase.from('team_configs').select('*').eq('team_id', teamData.id).maybeSingle();
                if (cData) {
                    setVal('prof-team-color', cData.primary_color || '#079FA0');
                    setVal('prof-methodology', cData.methodology || cData.metodologia);
                }
`;
code = code.replace(loadProfileOld, loadProfileNew);


// 6. Update saveDTProfile
const saveDTOldStart = '    async saveDTProfile() {';
const saveDTOldEnd = "alert('Error al guardar Perfil.');\n        }\n    },";

const saveDTOldFull = code.substring(code.indexOf(saveDTOldStart), code.indexOf(saveDTOldEnd) + saveDTOldEnd.length);

const saveDTNewFull = `    async saveDTProfile() {
        const uid = window.CurrentUser?.id || localStorage.getItem('ravix_v5_uid');
        if (!uid) return alert('Error: Usuario no identificado.');

        const name = document.getElementById('prof-name')?.value;
        const valLicencia = document.getElementById('prof-license')?.value || null;
        const valAvatar = document.getElementById('avatar_url_base64')?.value || null;

        if (!name) return alert('El nombre es obligatorio.');

        try {
            console.log('💾 Guardando Perfil DT...');
            const profilePayload = {
                id: uid,
                licencia: valLicencia,
                avatar_url: valAvatar
            };

            const { error: pErr } = await window.supabase.from('profiles_dt').upsert(profilePayload);
            if (pErr) throw pErr;

            const { error: uErr } = await window.supabase.from('users').update({ name, license: valLicencia }).eq('id', uid);
            if (uErr) throw uErr;

            if (window.CurrentUser) {
                window.CurrentUser.name = name;
                window.CurrentUser.license = valLicencia;
                if (valAvatar) {
                    const innerAvatar = document.querySelector('.dt-avatar-inner');
                    if(innerAvatar) {
                        innerAvatar.style.backgroundImage = 'url(' + valAvatar + ')';
                        innerAvatar.style.backgroundSize = 'cover';
                    }
                }
            }

            alert('✅ Perfil guardado.');
        } catch (error) {
            console.error('🔴 ERROR SUPABASE:', error.message);
            alert('Error al guardar Perfil.');
        }
    },`;

code = code.replace(saveDTOldFull, saveDTNewFull);


// 7. Update saveClubSettings
const saveClubOldStart = '    async saveClubSettings() {';
const saveClubOldEnd = "alert('Error al guardar Club.');\n        }\n    },";
const saveClubOldFull = code.substring(code.indexOf(saveClubOldStart), code.indexOf(saveClubOldEnd) + saveClubOldEnd.length);

const saveClubNewFull = `    async saveClubSettings() {
        const teamId = window.CurrentTeam?.id;
        if (!teamId) return alert('Error: Equipo no identificado.');

        const teamName = document.getElementById('prof-team-name')?.value;
        const valCategory = document.getElementById('prof-team-category')?.value || null;
        const valLiga = document.getElementById('prof-team-liga')?.value || null;
        const valLogo = document.getElementById('shield_url_base64')?.value || null;
        const color = document.getElementById('prof-team-color')?.value;
        const valMetodologia = document.getElementById('prof-methodology')?.value || null;

        const valEsquemaBase = document.getElementById('dna-esquema')?.value || null;
        const valOrgOfensiva = document.getElementById('dna-ataque')?.value || null;
        const valAlturaOfensiva = document.getElementById('altura_bloque_ofensivo')?.value || null;
        const valOrgDefensiva = document.getElementById('dna-defensa')?.value || null;
        const valAlturaDefensiva = document.getElementById('dna-bloque')?.value || null;
        const valTransAtaDef = document.getElementById('dna-trans-def')?.value || null;
        const valTransDefAta = document.getElementById('dna-trans-of')?.value || null;
        
        const rulesInputEl = document.getElementById('reglas_propension');
        const valReglasPropension = rulesInputEl ? rulesInputEl.value : (DTEngine.RulesTagInput.getTags().join(' | ') || null);
        const valPrincipiosOperativos = DTEngine.TagInput.getTags().join(' | ') || null;
        const valReglasAccion = document.getElementById('reglas_accion')?.value || null;

        const valArquero = document.getElementById('ideal_arquero')?.value || null;
        const valLateralDerecho = document.getElementById('ideal_lateral_derecho')?.value || null;
        const valCentralDerecho = document.getElementById('ideal_central_derecho')?.value || null;
        const valCentralIzquierdo = document.getElementById('ideal_central_izquierdo')?.value || null;
        const valLateralIzquierdo = document.getElementById('ideal_lateral_izquierdo')?.value || null;
        const valPivote = document.getElementById('ideal_pivote')?.value || null;
        const valInteriorDerecho = document.getElementById('ideal_interior_derecho')?.value || null;
        const valInteriorIzquierdo = document.getElementById('ideal_interior_izquierdo')?.value || null;
        const valExtremoDerecho = document.getElementById('ideal_extremo_derecho')?.value || null;
        const valExtremoIzquierdo = document.getElementById('ideal_extremo_izquierdo')?.value || null;
        const valDelantero = document.getElementById('ideal_delantero')?.value || null;

        if (!teamName) return alert('El nombre del equipo es obligatorio.');

        try {
            console.log('💾 Guardando Ajustes del Club y Táctica...');
            const teamPayload = {
                name: teamName,
                categoria: valCategory,
                liga: valLiga,
                logo_url: valLogo,
                esquema_base: valEsquemaBase,
                organizacion_ofensiva: valOrgOfensiva,
                altura_bloque_ofensivo: valAlturaOfensiva,
                organizacion_defensiva: valOrgDefensiva,
                altura_bloque_defensivo: valAlturaDefensiva,
                transicion_ata_def: valTransAtaDef,
                transicion_def_ata: valTransDefAta,
                principios_operativos: valPrincipiosOperativos,
                reglas_accion: valReglasAccion,
                reglas_accion_provocacion: valReglasPropension,
                ideal_arquero: valArquero,
                ideal_lateral_derecho: valLateralDerecho,
                ideal_central_derecho: valCentralDerecho,
                ideal_central_izquierdo: valCentralIzquierdo,
                ideal_lateral_izquierdo: valLateralIzquierdo,
                ideal_pivote: valPivote,
                ideal_interior_derecho: valInteriorDerecho,
                ideal_interior_izquierdo: valInteriorIzquierdo,
                ideal_extremo_derecho: valExtremoDerecho,
                ideal_extremo_izquierdo: valExtremoIzquierdo,
                ideal_delantero: valDelantero
            };

            const { error: tErr } = await window.supabase.from('teams').update(teamPayload).eq('id', teamId);
            if (tErr) throw tErr;

            if (color || valMetodologia) {
                const { error: cErr } = await window.supabase.from('team_configs').update({ primary_color: color, methodology: valMetodologia }).eq('team_id', teamId);
                if (!cErr && color) {
                    document.documentElement.style.setProperty('--primary-color', color);
                    document.documentElement.style.setProperty('--primary', color);
                }
            }

            if (window.CurrentTeam) {
                window.CurrentTeam.name = teamName;
                window.CurrentTeam.primary_color = color;
                window.CurrentTeam.methodology = valMetodologia;
                if(valLogo) window.CurrentTeam.logo_url = valLogo;
            }

            alert('✅ Configuración del Club y Táctica guardadas en la tabla teams.');
            this.renderDashboard();
        } catch (error) {
            console.error('🔴 ERROR SUPABASE:', error.message);
            alert('Error al guardar Club.');
        }
    },`;

code = code.replace(saveClubOldFull, saveClubNewFull);

fs.writeFileSync(filePath, code);
console.log('Refactorización completada correctamente.');
