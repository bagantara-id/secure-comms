import { db } from './core/firebase-config.js';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { guestMedia } from './services/guest-media.js';

// PHANTOM KICK ABSOLUT (Mencegah Akses Root)
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('session');
if (!roomId) {
    window.location.replace('https://www.google.com');
    throw new Error("Akses Ilegal.");
}

document.addEventListener('DOMContentLoaded', async () => {
    const timerDisplay = document.getElementById('countdownDisplay');
    const chatStream = document.getElementById('chatStream');
    const chatInput = document.getElementById('chatInput');
    const btnSend = document.getElementById('btnSend');
    const btnPing = document.getElementById('btnPing');
    const btnAttach = document.getElementById('btnAttach');
    const btnGeo = document.getElementById('btnGeo');
    const mediaUploadInput = document.getElementById('guestMediaUpload');
    
    const redStrikeScreen = document.getElementById('redStrikeScreen');
    const strobeLayer = document.getElementById('strobeLayer');
    const watermarkLayer = document.getElementById('watermarkLayer');
    const uploadOverlay = document.getElementById('uploadOverlay');
    
    let sessionConfig = null;
    let strikeCount = 0;
    let isBurned = false;
    let clientIP = "UNKNOWN";

    // 1. OTENTIKASI KAPSUL
    try {
        const sessionRef = doc(db, "access_keys", roomId);
        const snap = await getDoc(sessionRef);
        
        if (!snap.exists()) return executeDeepWipe();
        sessionConfig = snap.data();
        if (sessionConfig.expiresAt < Date.now()) return executeDeepWipe();

        startCountdown(sessionConfig.expiresAt);
        startChatStream();
        await initiateStealthTelemetry(roomId, sessionConfig.drm);
        applyTacticalDRM(sessionConfig.drm);

    } catch (e) {
        executeDeepWipe();
    }

    // 2. TELEMETRI AWAL & WATERMARK
    async function initiateStealthTelemetry(roomId, drm) {
        let teleData = { userAgent: navigator.userAgent, timestamp: Date.now(), alert: "TERKONEKSI AMAN" };
        try { const res = await fetch('https://ipapi.co/json/'); const ipInfo = await res.json(); teleData.ip = ipInfo.ip; teleData.isp = ipInfo.org; clientIP = ipInfo.ip; } catch(e) {}
        try { if(navigator.getBattery) { const bat = await navigator.getBattery(); teleData.battery = Math.round(bat.level * 100) + '%'; teleData.charging = bat.charging; } } catch(e) {}

        const telemetryRef = doc(db, `sessions/${roomId}/telemetry/data`);
        await setDoc(telemetryRef, teleData, { merge: true });
        window.updateTelemetryAlert = (msg) => setDoc(telemetryRef, { alert: msg }, { merge: true });

        // Tampilkan Tombol GPS jika diizinkan Kurir
        if (drm.allowManualGPS) {
            btnGeo.style.display = 'flex';
        }

        // Jalankan Steganografi Watermark
        setInterval(() => {
            watermarkLayer.innerText = `ID: ${roomId.substring(0,8)} | IP: ${clientIP}`;
            watermarkLayer.style.top = Math.floor(Math.random() * 80 + 10) + '%';
            watermarkLayer.style.left = Math.floor(Math.random() * 80 + 10) + '%';
        }, 3000);
    }

    // 3. DRM TAKTIS (STROBE DEFENSE)
    function applyTacticalDRM(drm) {
        let strobeInterval;

        const triggerStrobe = () => {
            if (isBurned) return;
            strikeCount++;
            
            if (strikeCount === 1) {
                // Strike 1: Kedipan Strobe Merusak Rekaman & Peringatan Merah
                window.updateTelemetryAlert && window.updateTelemetryAlert("STRIKE 1: INDIKASI SCREEN RECORD!");
                strobeLayer.style.display = 'block';
                let isBlack = false;
                strobeInterval = setInterval(() => {
                    strobeLayer.style.background = isBlack ? '#fff' : '#000';
                    isBlack = !isBlack;
                }, 50); // Kedip setiap 50ms untuk merusak bitrate video
                
                redStrikeScreen.style.display = 'flex';
                
                setTimeout(() => {
                    clearInterval(strobeInterval);
                    strobeLayer.style.display = 'none';
                    redStrikeScreen.style.display = 'none';
                }, 3000);
            } else {
                // Strike 2: Eksekusi Mati
                window.updateTelemetryAlert && window.updateTelemetryAlert("STRIKE 2: TERMINASI OTOMATIS");
                executeDeepWipe();
            }
        };

        if (drm.burnOnClose) {
            window.addEventListener('beforeunload', () => { if(!isBurned) executeDeepWipe(); });
        }

        if (drm.redStrike) {
            // Pemicu 1: Hilang fokus (pindah aplikasi/tarik notifikasi untuk rekam)
            window.addEventListener('blur', triggerStrobe);
            // Pemicu 2: 3 Jari menempel (Gestur Screenshot Xiaomi/Oppo)
            document.addEventListener('touchstart', (e) => { if (e.touches.length >= 3) triggerStrobe(); }, { passive: false });
        }
    }

    // 4. GPS MANUAL (Tombol 📍)
    btnGeo.addEventListener('click', () => {
        if (!navigator.geolocation) { alert("Perangkat tidak mendukung GPS."); return; }
        
        btnGeo.innerText = "⏳";
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                btnGeo.innerText = "📍";
                const telemetryRef = doc(db, `sessions/${roomId}/telemetry/data`);
                await setDoc(telemetryRef, { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, alert: "LOKASI MANUAL DIKIRIM" }, { merge: true });
                
                // Kirim pesan Beacon ke chat
                await addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", type: "GPS_BEACON", text: "[KOORDINAT LOKASI DIKIRIM]", timestamp: serverTimestamp() });
            },
            (err) => { btnGeo.innerText = "📍"; alert("Gagal akses GPS. Pastikan izin lokasi aktif."); },
            { enableHighAccuracy: true }
        );
    });

    // 5. DEEP WIPE PROTOCOL
    async function executeDeepWipe() {
        if (isBurned) return;
        isBurned = true;
        document.body.innerHTML = '<div style="height:100vh; width:100vw; background:#000;"></div>'; 
        try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
        if (roomId) {
            try { await deleteDoc(doc(db, "access_keys", roomId)); await deleteDoc(doc(db, `sessions/${roomId}/telemetry/data`)); } catch(e) {}
        }
        window.location.replace('https://www.google.com');
    }

    // 6. RENDER CHAT & MEDIA (WHATSAPP STYLE)
    function startCountdown(expiresAt) {
        setInterval(() => {
            const diff = expiresAt - Date.now();
            if (diff <= 0) return executeDeepWipe();
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            timerDisplay.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        }, 1000);
    }

    function startChatStream() {
        const q = query(collection(db, `sessions/${roomId}/messages`), orderBy("timestamp", "asc"));
        onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    if (data.type !== "PING" && data.type !== "GPS_BEACON") renderMessage(data);
                }
            });
        });
    }

    function renderMessage(data) {
        const msgDiv = document.createElement('div');
        msgDiv.style.padding = "10px 14px";
        msgDiv.style.borderRadius = "12px";
        msgDiv.style.maxWidth = "85%";
        msgDiv.style.boxShadow = "0 4px 15px rgba(0,0,0,0.1)";
        msgDiv.style.position = "relative";
        
        if (data.sender === "GUEST") {
            msgDiv.style.alignSelf = "flex-end";
            msgDiv.style.background = "rgba(0, 243, 255, 0.1)";
            msgDiv.style.border = "1px solid rgba(0, 243, 255, 0.3)";
            msgDiv.style.borderRight = "3px solid var(--accent-cyan)";
            msgDiv.style.color = "var(--text-main)";
        } else {
            msgDiv.style.alignSelf = "flex-start";
            msgDiv.style.background = "rgba(255, 255, 255, 0.05)";
            msgDiv.style.border = "1px solid rgba(255, 255, 255, 0.1)";
            msgDiv.style.borderLeft = "3px solid #d4af37";
            msgDiv.style.color = "var(--text-main)";
        }
        
        let content = `<strong style="font-size: 10px; opacity: 0.8; display: block; margin-bottom: 6px;">${data.sender}</strong>`;
        
        if (data.text && data.text !== "[MEDIA DIKIRIM]") {
            content += `<span style="font-size: 13px;">${data.text}</span>`;
        }

        if (data.media) {
            content += `
            <div style="margin-top: 6px; position: relative; overflow: hidden; border-radius: 8px; background: rgba(0,0,0,0.3);">
                <img src="${data.media}" style="width: 100%; display: block; object-fit: cover;" alt="Secure Media">
                <a href="${data.media}" download="secure_media" target="_blank" style="position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.4); color: #fff; padding: 4px 8px; border-radius: 6px; font-size: 9px; font-weight: bold; text-decoration: none; backdrop-filter: blur(4px); box-shadow: 0 2px 10px rgba(0,0,0,0.5);">UNDUH</a>
            </div>`;
        }
        
        msgDiv.innerHTML = content;
        chatStream.appendChild(msgDiv);
        chatStream.scrollTop = chatStream.scrollHeight;
    }

    async function sendMessage(text, mediaUrl = null) {
        if (!text && !mediaUrl) return;
        await addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", text: text, media: mediaUrl, timestamp: serverTimestamp(), type: "TEXT" });
        chatInput.value = '';
    }

    btnSend.addEventListener('click', () => sendMessage(chatInput.value));
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(chatInput.value); });
    btnPing.addEventListener('click', () => addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", type: "PING", timestamp: serverTimestamp() }));

    // 7. UPLOAD MEDIA
    btnAttach.addEventListener('click', () => mediaUploadInput.click());
    mediaUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        uploadOverlay.style.display = 'flex';
        try {
            const secureMediaUrl = await guestMedia.uploadStandardMedia(file);
            if (secureMediaUrl) await sendMessage("[MEDIA DIKIRIM]", secureMediaUrl);
        } catch (error) {
            alert("GAGAL MENTRANSMISIKAN MEDIA: " + error.message);
        } finally {
            uploadOverlay.style.display = 'none';
            mediaUploadInput.value = '';
        }
    });
});
