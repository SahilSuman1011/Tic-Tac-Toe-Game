const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Hello World\n');
        return;
    }

    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
            // try to respond with JSON echo if possible
            try {
                const json = JSON.parse(body || '{}');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ received: json }));
            } catch {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Received POST\n');
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n');
});

server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}/`);
});