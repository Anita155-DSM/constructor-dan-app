(async ()=>{
  const base = 'http://localhost:3000/api';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibm9tYnJlIjoiRnJhbmNpc2NvIERhbmllbCBQZXJleiIsImVtYWlsIjoiZGFuaWVscGVyZXoyOTExODNAZ21haWwuY29tIiwiaWF0IjoxNzg1Njk2NDU1LCJleHAiOjE3ODYzMDEyNTV9.OMwEQEEIjKyeHe47bcUVCrpW300HC7WPy4Pu64gfLbk';
  const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
  try {
    const res = await fetch(base + '/obras', { headers });
    console.log('GET /obras status', res.status);
    const text = await res.text();
    console.log('GET /obras body', text);
    let obras;
    try { obras = JSON.parse(text); } catch(e) { obras = null; }
    if (!obras || obras.length === 0) { console.log('No obras'); return; }
    const id = obras[0].id;
    console.log('using obra id', id);

    // GET presupuesto
    try {
      const pre = await fetch(`${base}/obras/${id}/presupuesto`, { headers });
      console.log('GET presupuesto status', pre.status);
      const preBody = await pre.text();
      console.log('GET presupuesto body', preBody);
    } catch(e) { console.error('GET presupuesto error', e); }

    // PATCH aprobar
    try {
      const apr = await fetch(`${base}/obras/${id}/presupuesto/aprobar`, { method: 'PATCH', headers });
      console.log('PATCH aprobar status', apr.status);
      const aprBody = await apr.text();
      console.log('PATCH aprobar body', aprBody);
    } catch(e) { console.error('PATCH aprobar error', e); }

    // GET presupuesto again
    try {
      const post = await fetch(`${base}/obras/${id}/presupuesto`, { headers });
      console.log('GET presupuesto (after) status', post.status);
      const postBody = await post.text();
      console.log('GET presupuesto (after) body', postBody);
    } catch(e) { console.error('GET presupuesto (after) error', e); }

  } catch (e) {
    console.error('main error', e);
  }
})();
