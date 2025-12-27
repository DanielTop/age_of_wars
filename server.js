const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8090;
const LIKES_FILE = path.join(__dirname, 'likes.json');

// MIME типы
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

// Загрузить лайки из файла
function loadLikes() {
    try {
        if (fs.existsSync(LIKES_FILE)) {
            return JSON.parse(fs.readFileSync(LIKES_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading likes:', e);
    }
    return {};
}

// Сохранить лайки в файл
function saveLikes(likes) {
    fs.writeFileSync(LIKES_FILE, JSON.stringify(likes, null, 2));
}

const server = http.createServer((req, res) => {
    // CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API для лайков
    if (req.url === '/api/likes') {
        if (req.method === 'GET') {
            const likes = loadLikes();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(likes));
            return;
        }

        if (req.method === 'POST' || req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const likes = loadLikes();

                    // Обновляем лайки для конкретной игры
                    if (data.gameId && typeof data.delta === 'number') {
                        likes[data.gameId] = Math.max(0, (likes[data.gameId] || 0) + data.delta);
                        saveLikes(likes);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(likes));
                } catch (e) {
                    res.writeHead(400);
                    res.end('Invalid JSON');
                }
            });
            return;
        }
    }

    // Статические файлы
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
            return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`🎮 Game Catalog running at http://localhost:${PORT}`);
});
