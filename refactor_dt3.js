const fs = require('fs');

function refactorFile(path) {
    let content = fs.readFileSync(path, 'utf8');

    // borrar_tarea_calendario
    content = content.replace(
/const response = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/rpc\/borrar_tarea_calendario`, \{\n\s*method: 'POST',\n\s*headers: \{\n\s*'Content-Type': 'application\/json',\n\s*'apikey': window\.SUPABASE_KEY,\n\s*'Authorization': `Bearer \$\{token\}`\n\s*\},\n\s*body: JSON\.stringify\(\{\n\s*p_user_id: userId,\n\s*p_team_id: teamId,\n\s*p_fecha: date,\n\s*p_scenario: task\.block,\n\s*p_task_id: task\.id\.toString\(\)\n\s*\}\)\n\s*\}\);/g,
`const { error } = await window.supabase.rpc('borrar_tarea_calendario', {
                    p_user_id: userId,
                    p_team_id: teamId,
                    p_fecha: date,
                    p_scenario: task.block,
                    p_task_id: task.id.toString()
                });
                if (error) throw error;`
    );

    // saveSettings users PATCH
    content = content.replace(
/const uRes = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/users\?id=eq\.\$\{uid\}`\, \{\n\s*method: 'PATCH',\n\s*headers: \{ 'Content-Type': 'application\/json', 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \},\n\s*body: JSON\.stringify\(\{ name, license \}\)\n\s*\}\);/g,
`const { error: uErr } = await window.supabase.from('users').update({ name, license }).eq('id', uid);
            const uRes = { ok: !uErr };`
    );

    // saveSettings teams PATCH
    content = content.replace(
/const tRes = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/teams\?id=eq\.\$\{teamId\}`\, \{\n\s*method: 'PATCH',\n\s*headers: \{ 'Content-Type': 'application\/json', 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \},\n\s*body: JSON\.stringify\(\{ name: teamName \}\)\n\s*\}\);/g,
`const { error: tErr } = await window.supabase.from('teams').update({ name: teamName }).eq('id', teamId);
            const tRes = { ok: !tErr };`
    );

    // saveSettings team_configs PATCH
    content = content.replace(
/const cRes = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/team_configs\?team_id=eq\.\$\{teamId\}`\, \{\n\s*method: 'PATCH',\n\s*headers: \{ 'Content-Type': 'application\/json', 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \},\n\s*body: JSON\.stringify\(\{ primary_color: color, methodology, tactical_dna \}\)\n\s*\}\);/g,
`const { error: cErr } = await window.supabase.from('team_configs').update({ primary_color: color, methodology, tactical_dna }).eq('team_id', teamId);
            const cRes = { ok: !cErr };`
    );

    // uploadCustomExercise POST custom_exercises
    content = content.replace(
/const res = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/custom_exercises`\, \{\n\s*method: 'POST',\n\s*headers: \{\n\s*'Content-Type': 'application\/json',\n\s*'apikey': window\.SUPABASE_KEY,\n\s*'Authorization': `Bearer \$\{token\}`,\n\s*'Prefer': 'return=representation'\n\s*\},\n\s*body: JSON\.stringify\(payload\)\n\s*\}\);/g,
`const { data, error } = await window.supabase.from('custom_exercises').insert(payload).select();
            if (error) throw new Error('Error al guardar en Supabase');
            const res = { ok: true };`
    );

    content = content.replace(
/if \(!res\.ok\) throw new Error\('Error al guardar en Supabase\.'\);\n\s*const data = await res\.json\(\);/g,
`// handled above`
    );


    fs.writeFileSync(path, content, 'utf8');
    console.log('Refactored dt3 ' + path);
}

refactorFile('js/app-dt.js');
