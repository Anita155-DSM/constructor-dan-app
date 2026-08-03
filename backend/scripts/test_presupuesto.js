(async ()=>{
  try {
    const base = 'http://localhost:3000/api';
    const ts = Date.now();
    const nombre = 'Prueba ' + ts;
    const email = `test${ts}@example.com`;
    const pass = '123456';

    const headers = { 'Content-Type': 'application/json' };
    const reg = await fetch(base + '/auth/register', { method: 'POST', headers, body: JSON.stringify({ nombre, email, password: pass }) });
    console.log('register status', reg.status);
    const regBody = await reg.text();
    console.log('register body', regBody);

    const login = await fetch(base + '/auth/login', { method: 'POST', headers, body: JSON.stringify({ email, password: pass }) });
    console.log('login status', login.status);
    const loginJson = await login.json();
    console.log('login body', loginJson);
    const token = loginJson.token;
    if (!token) { console.error('No token, abort'); process.exit(1); }

    const auth = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    const obraRes = await fetch(base + '/obras', { method: 'POST', headers: auth, body: JSON.stringify({ nombre_cliente: 'Obra Test ' + ts, direccion: 'Calle 1' }) });
    console.log('crear obra status', obraRes.status);
    const obraJson = await obraRes.json();
    console.log('obra', obraJson);
    const obraId = obraJson.id;

    const presupuestoBody = {
      precio_ofertado: 1000,
      precio_m2: 0,
      pct_rebaja: 0,
      notas: 'prueba',
      items: [{ tipo_trabajo: 'carpeta', descripcion: 'Carpeta', cantidad: 10, unidad: 'm2', precio_unitario: 15000 }]
    };

    const presRes = await fetch(base + `/obras/${obraId}/presupuesto`, { method: 'POST', headers: auth, body: JSON.stringify(presupuestoBody) });
    console.log('crear presupuesto status', presRes.status);
    console.log('crear presupuesto body', await presRes.text());

    const aprRes = await fetch(base + `/obras/${obraId}/presupuesto/aprobar`, { method: 'PATCH', headers: auth });
    console.log('aprobar status', aprRes.status);
    console.log('aprobar body', await aprRes.text());
  } catch (e) {
    console.error('Script error', e);
    process.exit(1);
  }
})();
