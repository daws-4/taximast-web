import http from 'http';

const req = http.request('http://localhost:3000/api/admin/lineas', {
    method: 'GET'
}, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        const response = JSON.parse(data);
        if(!response.data || response.data.length === 0) {
            console.log("No hay lineas.");
            return;
        }
        const lineaId = response.data[0]._id;
        console.log("Editando linea:", lineaId);
        
        // Simular petición PATCH desde el frontend
        const patchData = JSON.stringify({
            telegram_api_id: "34091426",
            telegram_api_hash: "30113306f9edfb0af1b029176627f7d1",
            telegram_phone: "584120691296",
            telegram_session: "mi_session_de_prueba"
        });
        
        const patchReq = http.request(`http://localhost:3000/api/admin/lineas/${lineaId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': patchData.length
            }
        }, (patchRes) => {
            let pData = '';
            patchRes.on('data', d => pData += d);
            patchRes.on('end', () => {
                console.log("Respuesta PATCH:", patchRes.statusCode, pData);
            });
        });
        patchReq.write(patchData);
        patchReq.end();
    });
});
req.end();
