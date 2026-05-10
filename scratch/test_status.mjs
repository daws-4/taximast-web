async function test() {
    try {
        const res = await fetch('http://localhost:3000/api/status?line_id=69a7830cc01d88c3bf686d3e', {
            headers: { 'x-api-key': 'IZFSzJsqJsV1aTlag47JhKNCC9c00maarrULJ4un1Rmo=' }
        });
        console.log('Status:', res.status);
        console.log('Body:', await res.json());
    } catch (err) {
        console.error('Error:', err.message);
    }
}
test();
