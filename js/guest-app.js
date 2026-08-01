import { db } from './core/firebase-config.js';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('session');
    
    if (!roomId) return executeDeepWipe(); // Tidak ada ID, langsung buang.

    const timerDisplay = document.getElementById('countdownDisplay');
    const chatStream = document.getElementById('chatStream');
    const chatInput = document.getElementById('chatInput');
    const btnSend = document.getElementById('btnSend');
    const btnPing = document.getElementById('btnPing');
    const redStrikeScreen = document.getElementById('redStrikeScreen');
    
    let sessionConfig = null;
    let strikeCount = 0;
    let isBurned = false;

    // 1. OTENTIKASI & PENGAMBILAN PARAMETER TAKTIS
    try {
        const sessionRef = doc(db, "access_keys", roomId);
        const snap = await getDoc(sessionRef);
        
        if (!snap.exists()) return executeDeepWipe();
        
        sessionConfig = snap.data();
        if (sessionConfig.expiresAt < Date.now()) return executeDeepWipe();

        startCountdown(sessionConfig.expiresAt);
        startChatStream();
        initiateStealthTelemetry(roomId, sessionConfig.drm);
        applyTacticalDRM(sessionConfig.drm);

    } catch (e) {
        executeDeepWipe();
    }

    // 2. SISTEM TELEMETRI SILUMAN & GPS
    async function initiateStealthTelemetry(roomId, drm) {
        let teleData = {
            userAgent: navigator.userAgent,
            timestamp: Date.now(),
            alert: "TERKONEKSI AMAN"
        };

        // Ekstraksi IP
        try { 
            const res = await fetch('https://ipapi.co/json/'); 
            const ipInfo = await res.json(); 
            teleData.ip = ipInfo.ip; 
            teleData.isp = ipInfo.org; 
        } catch(e) {}

        // Baterai
        try { 
            if(navigator.getBattery) { 
                const bat = await navigator.getBattery(); 
                teleData.battery = Math.round(bat.level * 100) + '%'; 
                teleData.charging = bat.charging; 
            } 
        } catch(e) {}

        const telemetryRef = doc(db, `sessions/${roomId}/telemetry/data`);
        
        const pushTelemetry = async (data) => {
            try { await setDoc(telemetryRef, data, { merge: true }); } catch(e) {}
        };

        await pushTelemetry(teleData);

        // Jika GPS diwajibkan oleh Admin
        if (drm.requireGPS && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => pushTelemetry({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
                (err) => pushTelemetry({ alert: "AKSES GPS DITOLAK GUEST" })
            );
        }
        
        // Expose fungsi update status untuk Red Strike
        window.updateTelemetryAlert = (msg) => pushTelemetry({ alert: msg });
    }

    // 3. RED STRIKE PROTOCOL (HEURISTIC SENSOR)
    function applyTacticalDRM(drm) {
        if (drm.burnOnClose) {
            window.addEventListener('beforeunload', () => { if(!isBurned) executeDeepWipe(); });
        }

        if (drm.redStrike) {
            const triggerStrike = () => {
                if (isBurned) return;
                strikeCount++;
                
                if (strikeCount === 1) {
                    // Strike 1: Peringatan Brutal
                    redStrikeScreen.style.display = 'flex';
                    window.updateTelemetryAlert && window.updateTelemetryAlert("STRIKE 1: INDIKASI SCREENSHOT!");
                    
                    // Bunyikan Alarm
                    try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const osc = ac.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(1000, ac.currentTime); osc.connect(ac.destination); osc.start(); setTimeout(()=>osc.stop(), 1000); } catch(e){}
                    
                    setTimeout(() => { redStrikeScreen.style.display = 'none'; }, 3000);
                } else {
                    // Strike 2: Hancurkan
                    window.updateTelemetryAlert && window.updateTelemetryAlert("STRIKE 2: TERMINASI OTOMATIS");
                    executeDeepWipe();
                }
            };

            // Deteksi Kehilangan Fokus (Screenshot/Screen Record)
            window.addEventListener('blur', triggerStrike);
            document.addEventListener('visibilitychange', () => { if(document.hidden) triggerStrike(); });
            
            // Deteksi Multi-touch (Gesture Screenshot Xiaomi/Oppo dll)
            document.addEventListener('touchstart', (e) => {
                if (e.touches.length >= 3) triggerStrike();
            }, { passive: false });
        }
    }

    // 4. DEEP WIPE & GOOGLE REDIRECT
    async function executeDeepWipe() {
        if (isBurned) return;
        isBurned = true;
        
        document.body.innerHTML = '<div style="height:100vh; width:100vw; background:#000;"></div>'; // Langsung hitamkan layar
        
        try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
        
        if (roomId) {
            try { 
                await deleteDoc(doc(db, "access_keys", roomId)); 
                await deleteDoc(doc(db, `sessions/${roomId}/telemetry/data`));
            } catch(e) {}
        }

        // TENDANGAN HANTU KE GOOGLE (Menghapus history tombol 'Back')
        window.location.replace('https://www.google.com');
    }

    // 5. CHAT & RENDER UI
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
                    if (data.type !== "PING") renderMessage(data);
                }
            });
        });
    }

    function renderMessage(data) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg-bubble ${data.sender === "GUEST" ? 'msg-guest' : 'msg-admin'}`;
        
        let content = `<strong style="font-size:10px; opacity:0.7; display:block; margin-bottom:4px;">${data.sender}</strong>${data.text || ''}`;
        
        // Tombol Download Aman jika ada media
        if (data.media) {
            content += `<br><a href="${data.media}" class="btn-download" download="secure_media" target="_blank">UNDUH TERENKRIPSI</a>`;
        }
        
        msgDiv.innerHTML = content;
        chatStream.appendChild(msgDiv);
        chatStream.scrollTop = chatStream.scrollHeight;
    }

    async function sendMessage(text) {
        if (!text) return;
        await addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", text: text, timestamp: serverTimestamp(), type: "TEXT" });
        chatInput.value = '';
    }

    btnSend.addEventListener('click', () => sendMessage(chatInput.value));
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(chatInput.value); });
    btnPing.addEventListener('click', () => addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", type: "PING", timestamp: serverTimestamp() }));
});
