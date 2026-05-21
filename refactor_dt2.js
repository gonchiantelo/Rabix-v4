const fs = require('fs');

function refactorFile(path) {
    let content = fs.readFileSync(path, 'utf8');

    // saveMatchDays (team_configs)
    content = content.replace(
/await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/team_configs`, \{\n\s*method: 'POST',\n\s*headers: \{\n\s*'Content-Type': 'application\/json',\n\s*'apikey': window\.SUPABASE_KEY,\n\s*'Authorization': `Bearer \$\{token\}`,\n\s*'Prefer': 'resolution=merge-duplicates'\n\s*\},\n\s*body: JSON\.stringify\(payload\)\n\s*\}\);/g,
`const { error: upsertErr } = await window.supabase.from('team_configs').upsert(payload, { onConflict: 'team_id' });
            if (upsertErr) throw upsertErr;`
    );

    // saveDayConfig -> rpc/guardar_tarea_calendario
    content = content.replace(
/await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/rpc\/guardar_tarea_calendario`, \{\n\s*method: 'POST',\n\s*headers: \{\n\s*'Content-Type': 'application\/json',\n\s*'apikey': window\.SUPABASE_KEY,\n\s*'Authorization': `Bearer \$\{token\}`\n\s*\},\n\s*body: JSON\.stringify\(payload\)\n\s*\}\);/g,
`const { error } = await window.supabase.rpc('guardar_tarea_calendario', payload);
                    if (error) throw error;`
    );

    fs.writeFileSync(path, content, 'utf8');
    console.log('Refactored dt2 ' + path);
}

refactorFile('js/app-dt.js');
