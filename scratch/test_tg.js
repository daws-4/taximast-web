const axios = require('axios');

async function test() {
    try {
        console.log('Testing reload endpoint...');
        const res = await axios.post('http://localhost:3000/internal/telegram/reload', {
            line_id: '69a7830cc01d88c3bf686d3e'
        });
        console.log('Reload response:', res.data);

        console.log('Waiting 5 seconds for reload to complete...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('\nTesting send endpoint (expecting detailed error)...');
        try {
            await axios.post('http://localhost:3000/internal/telegram/send', {
                line_id: '69a7830cc01d88c3bf686d3e',
                phone: '123',
                message: 'test'
            });
        } catch (err) {
            console.log('Send error response:', err.response.data);
        }
    } catch (err) {
        console.error('Test failed:', err.message);
    }
}

test();
