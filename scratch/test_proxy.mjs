async function test() {
    try {
        const res = await fetch('http://localhost:3000/api/status', {
            redirect: 'manual'
        });
        console.log('Status:', res.status);
        if (res.status === 307 || res.status === 302) {
            console.log('Redirect detected to:', res.headers.get('location'));
        } else {
            console.log('Body:', await res.json());
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}
test();
