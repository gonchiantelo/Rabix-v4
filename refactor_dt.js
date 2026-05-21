const fs = require('fs');

function refactorFile(path) {
    let content = fs.readFileSync(path, 'utf8');

    // 1. fetchTeamConfig (broken window.Supa._req)
    content = content.replace(
/const data = await window\.Supa\._req\('GET', `team_configs\?team_id=eq\.\$\{teamId\}`\);/g,
`const { data, error } = await window.supabase.from('team_configs').select('*').eq('team_id', teamId);
            if (error) throw error;`
    );

    // 2. renderDashboard (training_logs)
    content = content.replace(
/const path = `training_logs\?team_id=eq\.\$\{teamId\}&fecha=gte\.\$\{year\}-\$\{monthStr\}-01&fecha=lte\.\$\{year\}-\$\{monthStr\}-\$\{lastDayStr\}`;/g,
`const startDate = \`\${year}-\${monthStr}-01\`;
            const endDate = \`\${year}-\${monthStr}-\${lastDayStr}\`;`
    );

    content = content.replace(
/const res = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/\$\{path\}`\, \{\n\s*headers: \{\n\s*'apikey': window\.SUPABASE_KEY,\n\s*'Authorization': `Bearer \$\{token\}`\n\s*\}\n\s*\}\);\n\s*const data = await res\.json\(\);/g,
`const { data, error } = await window.supabase.from('training_logs')
                .select('*')
                .eq('team_id', teamId)
                .gte('fecha', startDate)
                .lte('fecha', endDate);
            if (error) throw error;`
    );

    // 3. openMatchDayModal (POST team_configs / RPC maybe?)
    content = content.replace(
/await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/team_configs`\, \{\n\s*method: 'PATCH',\n\s*headers: \{\n\s*'Content-Type': 'application\/json',\n\s*'apikey': window\.SUPABASE_KEY,\n\s*'Authorization': `Bearer \$\{token\}`\n\s*\},\n\s*body: JSON\.stringify\(\{ match_dates: newDates \}\)\n\s*\}\);/g,
`const { error } = await window.supabase.from('team_configs')
                .update({ match_dates: newDates })
                .eq('team_id', window.CurrentTeam.id);
            if (error) throw error;`
    );

    // 4. guardar_tarea_calendario (RPC)
    content = content.replace(
/await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/rpc\/guardar_tarea_calendario`\, \{\n\s*method: 'POST',\n\s*headers: \{\n\s*'Content-Type': 'application\/json',\n\s*'apikey': window\.SUPABASE_KEY,\n\s*'Authorization': `Bearer \$\{token\}`\n\s*\},\n\s*body: JSON\.stringify\(\{\n\s*p_team_id: parseInt\(window\.CurrentTeam\.id\),\n\s*p_fecha: isoDate,\n\s*p_ej_cods: \[ejId\],\n\s*p_scenario: blockNum\n\s*\}\)\n\s*\}\);/g,
`const { error } = await window.supabase.rpc('guardar_tarea_calendario', {
                        p_team_id: parseInt(window.CurrentTeam.id),
                        p_fecha: isoDate,
                        p_ej_cods: [ejId],
                        p_scenario: blockNum
                    });
                    if (error) throw error;`
    );

    // 5. borrar_tarea_calendario (RPC)
    content = content.replace(
/const response = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/rpc\/borrar_tarea_calendario`\, \{\n\s*method: 'POST',\n\s*headers: \{\n\s*'Content-Type': 'application\/json',\n\s*'apikey': window\.SUPABASE_KEY,\n\s*'Authorization': `Bearer \$\{token\}`\n\s*\},\n\s*body: JSON\.stringify\(\{\n\s*p_team_id: parseInt\(window\.CurrentTeam\.id\),\n\s*p_log_id: parseInt\(logId\)\n\s*\}\)\n\s*\}\);/g,
`const { error: responseErr } = await window.supabase.rpc('borrar_tarea_calendario', {
                p_team_id: parseInt(window.CurrentTeam.id),
                p_log_id: parseInt(logId)
            });
            if (responseErr) throw responseErr;`
    );

    content = content.replace(
/if \(!response\.ok\) \{\n\s*const errData = await response\.json\(\)\.catch\(\(\) => \(\{\}\)\);\n\s*console\.error\('\[Calendar\] Error borrando en DB:', errData\);\n\s*alert\('Error al borrar la tarea\.'\);\n\s*\}\n\s*else/g,
`// Error handled via try/catch`
    );


    // 6. initPortal -> fetching users
    content = content.replace(
/const uRes = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/users\?id=eq\.\$\{uid\}`\, \{\n\s*headers: \{ 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \}\n\s*\}\);\n\s*const users = await uRes\.json\(\);/g,
`const { data: users, error: uErr } = await window.supabase.from('users').select('*').eq('id', uid);
            if (uErr) throw uErr;`
    );

    // 7. initPortal -> fetching teams
    content = content.replace(
/const tRes = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/teams\?id=eq\.\$\{teamId\}`\, \{\n\s*headers: \{ 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \}\n\s*\}\);\n\s*const teams = await tRes\.json\(\);/g,
`const { data: teams, error: tErr } = await window.supabase.from('teams').select('*').eq('id', teamId);
            if (tErr) throw tErr;`
    );

    // 8. initPortal -> fetching team_configs
    content = content.replace(
/const cRes = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/team_configs\?team_id=eq\.\$\{teamId\}`\, \{\n\s*headers: \{ 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \}\n\s*\}\);\n\s*const configs = await cRes\.json\(\);/g,
`const { data: configs, error: cErr } = await window.supabase.from('team_configs').select('*').eq('team_id', teamId);
            if (cErr) throw cErr;`
    );

    // 9. uploadCustomExercise -> custom_exercises
    content = content.replace(
/const res = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/custom_exercises`\, \{\n\s*method: 'POST',\n\s*headers: \{\n\s*'Content-Type': 'application\/json',\n\s*'apikey': window\.SUPABASE_KEY,\n\s*'Authorization': `Bearer \$\{token\}`,\n\s*'Prefer': 'return=representation'\n\s*\},\n\s*body: JSON\.stringify\(payload\)\n\s*\}\);\n\s*if \(!res\.ok\) throw new Error\('Error al guardar en Supabase\.'\);\n\s*const data = await res\.json\(\);/g,
`const { data, error } = await window.supabase.from('custom_exercises').insert(payload).select();
            if (error) throw new Error('Error al guardar en Supabase: ' + error.message);`
    );

    // 10. savePeriodization -> team_configs
    content = content.replace(
/fetch\(window\.SUPABASE_URL \+ '\/rest\/v1\/team_configs\?team_id=eq\.' \+ teamId, \{\n\s*method: 'PATCH',\n\s*headers: \{\n\s*'Content-Type': 'application\/json',\n\s*'apikey': window\.SUPABASE_KEY,\n\s*'Authorization': 'Bearer ' \+ token\n\s*\},\n\s*body: JSON\.stringify\(\{ \n\s*periodization: periodizationData \n\s*\}\)\n\s*\}\)/g,
`window.supabase.from('team_configs').update({ periodization: periodizationData }).eq('team_id', teamId)`
    );

    content = content.replace(
/\.then\(res => \{\n\s*if \(!res\.ok\) throw new Error\('Failed PATCH periodization'\);\n\s*console\.log\('✅ Periodización guardada en Supabase\.'\);\n\s*\}\)/g,
`.then(({error}) => {
                if (error) throw new Error('Failed PATCH periodization: ' + error.message);
                console.log('✅ Periodización guardada en Supabase.');
            })`
    );


    fs.writeFileSync(path, content, 'utf8');
    console.log('Refactored ' + path);
}

refactorFile('js/app-dt.js');
