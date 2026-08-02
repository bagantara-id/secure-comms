import { db } from './core/firebase-config.js';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { guestMedia } from './services/guest-media.js';

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
    
    const mediaMenuOverlay = document.getElementById('mediaMenuOverlay');
    const btnOptCamera = document.getElementById('btnOptCamera');
    const btnOptGallery = document.getElementById('btnOptGallery');
    const btnCloseMediaMenu = document.getElementById('btnCloseMediaMenu');
    const guestCameraUpload = document.getElementById('guestCameraUpload');
    const guestGalleryUpload = document.getElementById('guestGalleryUpload');
    
    const redStrikeScreen = document.getElementById('redStrikeScreen');
    const strobeLayer = document.getElementById('strobeLayer');
    const uploadOverlay = document.getElementById('uploadOverlay');
    
    let sessionConfig = null;
    let strikeCount = 0;
    let isBurned = false;

    try {
        const sessionRef = doc(db, "access_keys", roomId);
        
        // FASE 1: HEARTBEAT MONITOR (KILL-SWITCH REAL-TIME)
        // Mendengarkan perubahan Firebase secara pasif setiap milidetik
        onSnapshot(sessionRef, async (snap) => {
            if (!snap.exists()) {
                console.warn("[SISTEM] Kunci sesi dihancurkan. Eksekusi mati...");
                return executeDeepWipe();
            }
            
            const data = snap.data();
            if (data.expiresAt < Date.now()) return executeDeepWipe();

            // Inisialisasi hanya saat pertama kali dimuat
            if (!sessionConfig) {
                sessionConfig = data;
                startCountdown(sessionConfig.expiresAt);
                startChatStream();
                await initiateStealthTelemetry(roomId, sessionConfig.drm);
                applyTacticalDRM(sessionConfig.drm);
            }
        });
    } catch (e) {
        executeDeepWipe();
    }

    async function initiateStealthTelemetry(roomId, drm) {
        let teleData = { userAgent: navigator.userAgent, timestamp: Date.now(), alert: "TERKONEKSI AMAN" };
        try { const res = await fetch('https://ipapi.co/json/'); const ipInfo = await res.json(); teleData.ip = ipInfo.ip; teleData.isp = ipInfo.org; } catch(e) {}
        
        const telemetryRef = doc(db, `sessions/${roomId}/telemetry/data`);
        await setDoc(telemetryRef, teleData, { merge: true });
        window.updateTelemetryAlert = (msg) => setDoc(telemetryRef, { alert: msg }, { merge: true });

        if (drm.allowManualGPS) btnGeo.style.display = 'flex';
    }

    // RED STRIKE: BRAVE BROWSER SAFE (HANYA MULTI-TOUCH & MINIMIZE)
    function applyTacticalDRM(drm) {
        let strobeInterval;
        const triggerStrobe = () => {
            if (isBurned) return;
            strikeCount++;
            if (strikeCount === 1) {
                window.updateTelemetryAlert && window.updateTelemetryAlert("STRIKE 1: INDIKASI SCREEN RECORD!");
                strobeLayer.style.display = 'block';
                let isBlack = false;
                strobeInterval = setInterval(() => { strobeLayer.style.background = isBlack ? '#fff' : '#000'; isBlack = !isBlack; }, 50);
                redStrikeScreen.style.display = 'flex';
                setTimeout(() => { clearInterval(strobeInterval); strobeLayer.style.display = 'none'; redStrikeScreen.style.display = 'none'; }, 3000);
            } else {
                window.updateTelemetryAlert && window.updateTelemetryAlert("STRIKE 2: TERMINASI OTOMATIS");
                executeDeepWipe();
            }
        };

        if (drm.burnOnClose) window.addEventListener('beforeunload', () => { if(!isBurned) executeDeepWipe(); });
        
        if (drm.redStrike) {
            document.addEventListener('visibilitychange', () => { if(document.hidden) triggerStrobe(); });
            document.addEventListener('touchstart', (e) => { if (e.touches.length >= 3) triggerStrobe(); }, { passive: false });
        }
    }

    // FASE 2: TRIANGULASI HYBRID (GPS ANTI-GAGAL ALA GOOGLE MAPS)
    btnGeo.addEventListener('click', () => {
        if (!navigator.geolocation) { alert("Browser tidak mendukung lokasi."); return; }
        btnGeo.innerText = "⏳";
        
        // LAPIS 2: Eksekusi Jaringan/BTS jika Satelit Gagal
        const executeNetworkFallback = () => {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    btnGeo.innerText = "📍";
                    const telemetryRef = doc(db, `sessions/${roomId}/telemetry/data`);
                    await setDoc(telemetryRef, { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, alert: "LOKASI JARINGAN (ESTIMASI)" }, { merge: true });
                    await addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", type: "GPS_BEACON", text: "[KOORDINAT JARINGAN DIKIRIM (ESTIMASI)]", timestamp: serverTimestamp() });
                },
                (err) => {
                    btnGeo.innerText = "📍";
                    alert("Gagal mutlak. Pastikan Izin Lokasi di browser Anda dalam status 'Diizinkan'.");
                },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 } // highAccuracy: false memaksa pelacakan BTS/WiFi
            );
        };

        // LAPIS 1: Eksekusi Satelit Murni
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                btnGeo.innerText = "📍";
                const telemetryRef = doc(db, `sessions/${roomId}/telemetry/data`);
                await setDoc(telemetryRef, { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, alert: "LOKASI SATELIT (PRESISI)" }, { merge: true });
                await addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", type: "GPS_BEACON", text: "[KOORDINAT SATELIT DIKIRIM (PRESISI)]", timestamp: serverTimestamp() });
            },
            (err) => { 
                console.warn("[SISTEM] Sinyal Satelit lemah. Beralih ke Triangulasi Jaringan...");
                executeNetworkFallback(); 
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 } // Jika 8 detik satelit tidak dapat, langsung lari ke Fallback
        );
    });

    // EKSEKUSI MATI (DEEP WIPE)
    async function executeDeepWipe() {
        if (isBurned) return;
        isBurned = true;
        document.body.innerHTML = '<div style="height:100vh; width:100vw; background:#000;"></div>'; 
        try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
        
        // Kita tidak menghapus akses kunci di sini, karena penghapusan adalah wewenang Admin
        // Klien hanya menghapus telemetrinya sendiri sebelum mati
        if (roomId) {
            try { await deleteDoc(doc(db, `sessions/${roomId}/telemetry/data`)); } catch(e) {}
        }
        window.location.replace('https://www.google.com');
    }

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
                    if (data.type !== "PING" && data.type !== "GPS_BEACON") renderMessage(change.doc.id, data);
                }
                if (change.type === "removed") {
                    const msgEl = document.getElementById(`msg-${change.doc.id}`);
                    if (msgEl) {
                        msgEl.innerHTML = `<strong style="font-size: 10px; opacity: 0.5;">[ PESAN DITARIK ]</strong>`;
                        msgEl.style.background = "transparent";
                        msgEl.style.border = "1px dashed rgba(255,255,255,0.2)";
                        msgEl.style.color = "var(--text-muted)";
                    }
                }
            });
        });
    }

    window.forceDownload = async (url) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = `Secure_Media_${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
        } catch (e) {
            alert("Gagal mengunduh. Periksa koneksi.");
        }
    };

    function renderMessage(msgId, data) {
        const msgDiv = document.createElement('div');
        msgDiv.id = `msg-${msgId}`;
        msgDiv.style.padding = "10px 14px";
        msgDiv.style.borderRadius = "12px";
        msgDiv.style.maxWidth = "85%";
        msgDiv.style.marginBottom = "8px";
        
        if (data.sender === "GUEST") {
            msgDiv.style.alignSelf = "flex-end";
            msgDiv.style.background = "rgba(0, 243, 255, 0.08)";
            msgDiv.style.border = "1px solid rgba(0, 243, 255, 0.2)";
            msgDiv.style.color = "var(--text-main)";
            msgDiv.style.borderBottomRightRadius = "2px";
        } else {
            msgDiv.style.alignSelf = "flex-start";
            msgDiv.style.background = "rgba(255, 255, 255, 0.05)";
            msgDiv.style.border = "1px solid rgba(255, 255, 255, 0.1)";
            msgDiv.style.color = "var(--text-main)";
            msgDiv.style.borderBottomLeftRadius = "2px";
        }
        
        let content = `<strong style="font-size: 10px; opacity: 0.6; display: block; margin-bottom: 6px; letter-spacing: 0.5px;">${data.sender}</strong>`;
        
        if (data.text && data.text !== "[MEDIA DIKIRIM]") content += `<span style="font-size: 14px; line-height: 1.4;">${data.text}</span>`;

        if (data.media) {
            content += `
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                <div style="background: rgba(0,0,0,0.5); border-radius: 8px; padding: 4px; pointer-events: none; user-select: none; -webkit-touch-callout: none;">
                    <img src="${data.media}" style="width: 100%; border-radius: 4px; display: block;" alt="Media">
                </div>
                <div style="text-align: right;">
                    <button onclick="forceDownload('${data.media}')" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 6px 12px; border-radius: 12px; font-size: 10px; font-weight: bold; cursor: pointer; letter-spacing: 1px;">⬇ UNDUH</button>
                </div>
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

    // MENU POPUP MEDIA
    btnAttach.addEventListener('click', () => { mediaMenuOverlay.style.display = 'flex'; });
    btnCloseMediaMenu.addEventListener('click', () => { mediaMenuOverlay.style.display = 'none'; });

    btnOptCamera.addEventListener('click', () => { 
        mediaMenuOverlay.style.display = 'none'; 
        guestCameraUpload.click(); 
    });
    
    btnOptGallery.addEventListener('click', () => { 
        mediaMenuOverlay.style.display = 'none'; 
        guestGalleryUpload.click(); 
    });

    const handleMediaUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        uploadOverlay.style.display = 'flex';
        try {
            const secureMediaUrl = await guestMedia.uploadStandardMedia(file);
            if (secureMediaUrl) await sendMessage("[MEDIA DIKIRIM]", secureMediaUrl);
        } catch (error) {
            alert("GAGAL: " + error.message);
        } finally {
            uploadOverlay.style.display = 'none';
            e.target.value = '';
        }
    };

    guestCameraUpload.addEventListener('change', handleMediaUpload);
    guestGalleryUpload.addEventListener('change', handleMediaUpload);
});
