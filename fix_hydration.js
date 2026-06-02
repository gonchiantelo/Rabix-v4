const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js/app-dt.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Usar maybeSingle() en vez de single() para evitar que lance error si no hay row (que salta al catch y omite el resto)
code = code.replace(
    `const { data: pData } = await window.supabase.from('profiles_dt').select('*').eq('id', userData.id).single();`,
    `const { data: pData } = await window.supabase.from('profiles_dt').select('*').eq('id', userData.id).maybeSingle();`
);

code = code.replace(
    `const { data: tData } = await window.supabase.from('teams').select('*').eq('id', teamData.id).single();`,
    `const { data: tData } = await window.supabase.from('teams').select('*').eq('id', teamData.id).maybeSingle();`
);

// 2. Pre-hidratar valores obligatorios antes del await para que no haya placeholders visuales
const prefillSearchStr = `            const emailEl = document.getElementById('prof-email');
            if (emailEl) emailEl.value = userData.email || '';`;

const prefillNewStr = `            const emailEl = document.getElementById('prof-email');
            if (emailEl) emailEl.value = userData.email || '';
            
            // Pre-hidratación estricta desde variables globales para evitar vacíos visuales (Fallback)
            const teamNameEl = document.getElementById('prof-team-name');
            const teamColorEl = document.getElementById('prof-team-color');
            if (teamNameEl) teamNameEl.value = teamData.name || '';
            if (teamColorEl) teamColorEl.value = teamData.primary_color || '#079FA0';
            `;

code = code.replace(prefillSearchStr, prefillNewStr);

// 3. Validar estrictamente en saveClubSettings
code = code.replace(
    `if (!teamName) return alert('El nombre del equipo es obligatorio.');`,
    `if (!teamName || teamName.trim() === '') {
            alert('⚠️ El nombre del equipo es obligatorio. Por favor, completa este campo para evitar sobreescrituras.');
            return;
        }`
);

fs.writeFileSync(filePath, code);
console.log('Hydration check applied');
