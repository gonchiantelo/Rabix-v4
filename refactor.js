const fs = require('fs');

function refactorFile(path) {
    let content = fs.readFileSync(path, 'utf8');

    // 1. Wizard finish (POST teams)
    content = content.replace(
/const tRes = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/teams`, \{\n\s*method: 'POST',\n\s*headers: \{ 'Content-Type': 'application\/json', 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}`, 'Prefer': 'return=representation' \},\n\s*body: JSON\.stringify\(\{ name: tName, code: tCode, owner_id: uid \}\)\n\s*\}\);\n\s*const teams = await tRes\.json\(\);\n\s*if \(!tRes\.ok \|\| !teams\[0\]\) throw new Error\('Error al fundar equipo\.'\);/g,
`const { data: teams, error: tErr } = await window.supabase.from('teams').insert({ name: tName, code: tCode, owner_id: uid }).select();
                if (tErr || !teams || !teams[0]) throw new Error('Error al fundar equipo: ' + (tErr?.message || ''));`
    );

    // 2. Wizard finish (POST team_configs)
    content = content.replace(
/await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/team_configs`, \{\n\s*method: 'POST',\n\s*headers: \{ 'Content-Type': 'application\/json', 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \},\n\s*body: JSON\.stringify\(\{ team_id: teamId, owner_id: uid, primary_color: tColor, methodology: tMethodology, base_systems: tSystems \}\)\n\s*\}\);/g,
`const { error: tcErr } = await window.supabase.from('team_configs').insert({ team_id: teamId, owner_id: uid, primary_color: tColor, methodology: tMethodology, base_systems: tSystems });
                if (tcErr) console.error(tcErr);`
    );

    // 3. Wizard finish (GET teams code)
    content = content.replace(
/const tRes = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/teams\?code=eq\.\$\{code\}`\, \{\n\s*headers: \{ 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \}\n\s*\}\);\n\s*const teams = await tRes\.json\(\);\n\s*if \(!teams \|\| !teams\[0\]\) throw new Error\('Código inválido o equipo no encontrado\.'\);/g,
`const { data: teams, error: tErr } = await window.supabase.from('teams').select('*').eq('code', code);
                if (tErr || !teams || !teams[0]) throw new Error('Código inválido o equipo no encontrado.');`
    );

    // 4. Wizard finish (PATCH users)
    content = content.replace(
/const uRes = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/users\?id=eq\.\$\{uid\}`\, \{\n\s*method: 'PATCH',\n\s*headers: \{ 'Content-Type': 'application\/json', 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \},\n\s*body: JSON\.stringify\(\{ name, staff_role: role, license, team_id: teamId \}\)\n\s*\}\);\n\s*if \(!uRes\.ok\) throw new Error\('Error al actualizar perfil\.'\);/g,
`const { error: uErr } = await window.supabase.from('users').update({ name, staff_role: role, license, team_id: teamId }).eq('id', uid);
            if (uErr) throw new Error('Error al actualizar perfil: ' + uErr.message);`
    );

    // 5. finishAthlete (GET profiles_athlete)
    content = content.replace(
/const check = await fetch\(\n\s*`\$\{window\.SUPABASE_URL\}\/rest\/v1\/profiles_athlete\?id=eq\.\$\{uid\}`,\n\s*\{ headers: \{ 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \} \}\n\s*\);\n\s*const existing = await check\.json\(\);/g,
`const { data: existing, error: checkErr } = await window.supabase.from('profiles_athlete').select('*').eq('id', uid);
            if (checkErr) throw new Error(checkErr.message);`
    );

    // 6. finishAthlete (PATCH profiles_athlete)
    content = content.replace(
/res = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/profiles_athlete\?id=eq\.\$\{uid\}`\, \{\n\s*method: 'PATCH',\n\s*headers: \{ 'Content-Type': 'application\/json', 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \},\n\s*body: JSON\.stringify\(\{ full_name: fullName, sport, position, birth_date: birthDate, weight_kg: weight, height_cm: height, wingspan_cm: wingspan, goal \}\)\n\s*\}\);\n\s*\} else \{\n\s*\/\/ Crear nuevo perfil atleta\n\s*res = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/profiles_athlete`\, \{\n\s*method: 'POST',\n\s*headers: \{ 'Content-Type': 'application\/json', 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \},\n\s*body: JSON\.stringify\(\{ user_id: uid, full_name: fullName, sport, position, birth_date: birthDate, weight_kg: weight, height_cm: height, wingspan_cm: wingspan, goal \}\)\n\s*\}\);\n\s*\}/g,
`const { error: resErr } = await window.supabase.from('profiles_athlete').update({ full_name: fullName, sport, position, birth_date: birthDate, weight_kg: weight, height_cm: height, wingspan_cm: wingspan, goal }).eq('id', uid);
                if (resErr) throw new Error(resErr.message);
            } else {
                // Crear nuevo perfil atleta
                const { error: resErr } = await window.supabase.from('profiles_athlete').insert({ user_id: uid, full_name: fullName, sport, position, birth_date: birthDate, weight_kg: weight, height_cm: height, wingspan_cm: wingspan, goal });
                if (resErr) throw new Error(resErr.message);
            }`
    );

    // 7. finishAthlete (throw if error)
    content = content.replace(
/if \(!res\.ok\) throw new Error\('Error al guardar perfil de atleta\.'\);/g,
`// Error checks already handled`
    );

    // 8. saveProfile (Athlete)
    content = content.replace(
/const r = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/profiles_athlete`, \{\n\s*method: 'POST',\n\s*headers: \{\n\s*'apikey': window\.SUPABASE_KEY,\n\s*'Authorization': `Bearer \$\{token\}`,\n\s*'Content-Type': 'application\/json',\n\s*'Prefer': 'resolution=merge-duplicates'\n\s*\},\n\s*body: JSON\.stringify\(payload\)\n\s*\}\);\n\s*if \(!r\.ok\) \{\n\s*const err = await r\.json\(\)\.catch\(\(\) => \(\{\}\)\);\n\s*throw new Error\(err\.message \|\| 'Error al guardar perfil de atleta\.'\);\n\s*\}/g,
`const { error: upsertErr } = await window.supabase.from('profiles_athlete').upsert(payload, { onConflict: 'user_id' });
                if (upsertErr) {
                    throw new Error(upsertErr.message || 'Error al guardar perfil de atleta.');
                }`
    );

    // 9. saveProfile (DT)
    content = content.replace(
/const r = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/users\?id=eq\.\$\{uid\}`\, \{\n\s*method: 'PATCH',\n\s*headers: \{\n\s*'apikey': window\.SUPABASE_KEY,\n\s*'Authorization': `Bearer \$\{token\}`,\n\s*'Content-Type': 'application\/json'\n\s*\},\n\s*body: JSON\.stringify\(\{ name, staff_role: staffRole, license \}\)\n\s*\}\);\n\s*if \(!r\.ok\) throw new Error\('Error al actualizar perfil de staff\.'\);/g,
`const { error: updateErr } = await window.supabase.from('users').update({ name, staff_role: staffRole, license }).eq('id', uid);
                if (updateErr) throw new Error('Error al actualizar perfil de staff: ' + updateErr.message);`
    );

    // 10. checkSession (auth/v1/user)
    content = content.replace(
/LOG\('AUTH'\)\('Verificando token con \/auth\/v1\/user\.\.\.'\);\n\s*const userRes = await fetch\(`\$\{window\.SUPA_URL\}\/auth\/v1\/user`, \{\n\s*headers: \{ 'apikey': window\.SUPA_KEY, 'Authorization': `Bearer \$\{token\}` \}\n\s*\}\);\n\s*if \(!userRes\.ok\) \{\n\s*const errData = await userRes\.json\(\)\.catch\(\(\) => \(\{\}\)\);\n\s*throw new Error\(`Token inválido o expirado \(\$\{userRes\.status\}\): \$\{errData\.message \|\| 'unauthorized'\}`\);\n\s*\}\n\s*const authUser = await userRes\.json\(\);\n\s*LOG\('AUTH'\)\(`Token válido\. Email verificado: \$\{authUser\.email\}`\);/g,
`LOG('AUTH')('Verificando token con supabase.auth.getUser...');
            const { data: { user: authUser }, error: userErr } = await window.supabase.auth.getUser(token);
            if (userErr || !authUser) {
                throw new Error(\`Token inválido o expirado: \${userErr?.message || 'unauthorized'}\`);
            }
            LOG('AUTH')(\`Token válido. Email verificado: \${authUser.email}\`);`
    );

    // 11. checkSession (profiles_athlete)
    content = content.replace(
/const athRes = await fetch\(\n\s*`\$\{window\.SUPA_URL\}\/rest\/v1\/profiles_athlete\?id=eq\.\$\{uid\}&select=\*`,\n\s*\{ headers: \{ 'apikey': window\.SUPA_KEY, 'Authorization': `Bearer \$\{token\}` \} \}\n\s*\);\n\s*if \(!athRes\.ok\) throw new Error\(`Error HTTP \$\{athRes\.status\} al leer profiles_athlete`\);\n\s*const athData = await athRes\.json\(\);/g,
`const { data: athData, error: athErr } = await window.supabase.from('profiles_athlete').select('*').eq('id', uid);
                if (athErr) throw new Error(\`Error al leer profiles_athlete: \${athErr.message}\`);`
    );

    // 12. checkSession (users)
    content = content.replace(
/const dtRes = await fetch\(\n\s*`\$\{window\.SUPA_URL\}\/rest\/v1\/users\?id=eq\.\$\{uid\}&select=\*`,\n\s*\{ headers: \{ 'apikey': window\.SUPA_KEY, 'Authorization': `Bearer \$\{token\}` \} \}\n\s*\);\n\s*if \(!dtRes\.ok\) throw new Error\(`Error HTTP \$\{dtRes\.status\} al leer tabla users`\);\n\s*const users = await dtRes\.json\(\);/g,
`const { data: users, error: dtErr } = await window.supabase.from('users').select('*').eq('id', uid);
            if (dtErr) throw new Error(\`Error al leer tabla users: \${dtErr.message}\`);`
    );

    // 13. checkSession (team_configs & teams)
    content = content.replace(
/const \[cRes, tRes\] = await Promise\.all\(\[\n\s*fetch\(`\$\{window\.SUPA_URL\}\/rest\/v1\/team_configs\?team_id=eq\.\$\{userData\.team_id\}`,\n\s*\{ headers: \{ 'apikey': window\.SUPA_KEY, 'Authorization': `Bearer \$\{token\}` \} \}\),\n\s*fetch\(`\$\{window\.SUPA_URL\}\/rest\/v1\/teams\?id=eq\.\$\{userData\.team_id\}`,\n\s*\{ headers: \{ 'apikey': window\.SUPA_KEY, 'Authorization': `Bearer \$\{token\}` \} \}\)\n\s*\]\);\n\s*const configs = await cRes\.json\(\);\n\s*const teams   = await tRes\.json\(\);/g,
`const [ { data: configs }, { data: teams } ] = await Promise.all([
                window.supabase.from('team_configs').select('*').eq('team_id', userData.team_id),
                window.supabase.from('teams').select('*').eq('id', userData.team_id)
            ]);`
    );

    // 14. fetchExercisesLibrary
    content = content.replace(
/const r = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/exercises_library`, \{\n\s*headers: \{ 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \}\n\s*\}\);\n\s*const data = await r\.json\(\);/g,
`const { data, error } = await window.supabase.from('exercises_library').select('*');
            if (error) throw error;`
    );

    // 15. fetchCustomExercises
    content = content.replace(
/const r = await fetch\(`\$\{window\.SUPABASE_URL\}\/rest\/v1\/custom_exercises\?user_id=eq\.\$\{uid\}&order=created_at\.desc`, \{\n\s*headers: \{ 'apikey': window\.SUPABASE_KEY, 'Authorization': `Bearer \$\{token\}` \}\n\s*\}\);\n\s*const data = await r\.json\(\);/g,
`const { data, error } = await window.supabase.from('custom_exercises').select('*').eq('user_id', uid).order('created_at', { ascending: false });
            if (error) throw error;`
    );

    // 16. signUp
    content = content.replace(
/const rAuth = await fetch\(`\$\{window\.SUPA_URL\}\/auth\/v1\/signup`, \{\n\s*method: 'POST',\n\s*headers: \{ 'apikey': window\.SUPA_KEY, 'Content-Type': 'application\/json' \},\n\s*body: JSON\.stringify\(\{ email: email, password: pass \}\)\n\s*\}\);\n\s*const authData = await rAuth\.json\(\);\n\s*if \(rAuth\.status === 400 && \(authData\.msg\?\.includes\('already registered'\) \|\| authData\.message\?\.includes\('already registered'\) \|\| authData\.error_description\?\.includes\('already registered'\)\)\) \{\n\s*alert\("El email ya existe\. Por favor, inicia sesión\."\);\n\s*window\.App\.toggleAuth\('login'\);\n\s*return;\n\s*\}\n\s*if \(!rAuth\.ok\) throw new Error\(authData\.msg \|\| authData\.message \|\| authData\.error_description \|\| "Error de Auth"\);\n\s*\/\/ 2\. Si el registro fue exitoso y nos devolvió token\n\s*if \(authData\.access_token && authData\.user\) \{\n\s*const uid = authData\.user\.id;\n\s*const token = authData\.access_token;/g,
`const { data: authData, error: authError } = await window.supabase.auth.signUp({
                email: email,
                password: pass
            });

            if (authError) {
                if (authError.message?.includes('already registered')) {
                    alert("El email ya existe. Por favor, inicia sesión.");
                    window.App.toggleAuth('login');
                    return;
                }
                throw new Error(authError.message);
            }

            // 2. Si el registro fue exitoso y nos devolvió token
            if (authData.session && authData.user) {
                const uid = authData.user.id;
                const token = authData.session.access_token;`
    );

    // 17. signUp (profile injection)
    content = content.replace(
/await fetch\(`\$\{window\.SUPA_URL\}\/rest\/v1\/\$\{table\}`\, \{\n\s*method: 'POST',\n\s*headers: \{\n\s*'apikey': window\.SUPA_KEY,\n\s*'Authorization': `Bearer \$\{token\}`,\n\s*'Content-Type': 'application\/json'\n\s*\},\n\s*body: JSON\.stringify\(profilePayload\)\n\s*\}\);/g,
`const { error: insertErr } = await window.supabase.from(table).insert(profilePayload);
                if (insertErr) throw new Error(insertErr.message);`
    );

    // 18. loginForm.onsubmit
    content = content.replace(
/const r = await fetch\(`\$\{window\.SUPA_URL\}\/auth\/v1\/token\?grant_type=password`, \{\n\s*method: 'POST',\n\s*headers: \{ 'apikey': window\.SUPA_KEY, 'Content-Type': 'application\/json' \},\n\s*body: JSON\.stringify\(\{ email, password: pass \}\)\n\s*\}\);\n\s*const data = await r\.json\(\);\n\s*if \(!r\.ok\) \{\n\s*throw new Error\(data\.error_description \|\| data\.msg \|\| data\.message \|\| 'Credenciales incorrectas\.'\);\n\s*\}\n\s*if \(data\.access_token && data\.user\) \{\n\s*console\.log\('✅ Token recibido\. Guardando sesión\.\.\.'\);\n\s*localStorage\.setItem\('ravix_token', data\.access_token\);\n\s*localStorage\.setItem\('ravix_v5_uid', data\.user\.id\);\n\s*\/\/ Persistir el rol elegido en el portal para que checkSession lo use\n\s*localStorage\.setItem\('ravix_active_role', role\);\n\s*window\.App\.currentRole = role;\n\s*await window\.App\.checkSession\(data\.user\.id, data\.access_token\);\n\s*\} else \{\n\s*throw new Error\('No se recibió el token de autorización\.'\);\n\s*\}/g,
`const { data, error } = await window.supabase.auth.signInWithPassword({
                    email,
                    password: pass
                });

                if (error) {
                    throw new Error(error.message || 'Credenciales incorrectas.');
                }

                if (data.session && data.user) {
                    console.log('✅ Token recibido. Guardando sesión...');
                    localStorage.setItem('ravix_token', data.session.access_token);
                    localStorage.setItem('ravix_v5_uid', data.user.id);
                    // Persistir el rol elegido en el portal para que checkSession lo use
                    localStorage.setItem('ravix_active_role', role);
                    window.App.currentRole = role;

                    await window.App.checkSession(data.user.id, data.session.access_token);
                } else {
                    throw new Error('No se recibió el token de autorización.');
                }`
    );

    fs.writeFileSync(path, content, 'utf8');
    console.log('Refactored ' + path);
}

refactorFile('js/app-core.js');

