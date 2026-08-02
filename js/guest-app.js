import { db } from './core/firebase-config.js';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { guestMedia } from './services/guest-media.js';

// SYNTHETIC AUDIO ENGINE
class QuantumAudio {
    constructor() { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    _playTone(freq1, freq2, type, duration, vol) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq1, this.ctx.currentTime);
        if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    playChime() { this._playTone(1200, 2000, 'sine', 0.8, 0.3); setTimeout(() => this._playTone(1600, 2400, 'sine', 1.2, 0.3), 150); }
    playDroplet() { this._playTone(800, 1200, 'sine', 0.3, 0.2); }
    playSonar() { this._playTone(2000, 2000, 'sine', 0.1, 0.1); setTimeout(()=>this._playTone(600, 400, 'triangle', 0.6, 0.2), 150); }
    playMechClick() { this._playTone(800, 100, 'square', 0.1, 0.1); }
    playAlarm() { this._playTone(200, 50, 'sawtooth', 0.5, 0.5); }
}
const qAudio = new QuantumAudio();

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('session');
if (!roomId) window.location.replace('https://www.google.com');

document.addEventListener('DOMContentLoaded', async () => {
    // PROTEKSI
    document.addEventListener('copy', (e) => { e.clipboardData.setData('text/plain', '[ DATA TERENKRIPSI ]'); e.preventDefault(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J'))) { e.preventDefault(); executeDeepWipe(); } });

    // SPLASH SCREEN
    const splash = document.getElementById('quantumSplashScreen');
    const initSplash = () => {
        qAudio.playChime(); 
        setTimeout(() => { splash.style.opacity = '0'; setTimeout(() => { splash.style.display = 'none'; }, 600); }, 3500);
    };
    document.body.addEventListener('click', () => { if(qAudio.ctx.state === 'suspended') qAudio.ctx.resume(); }, {once: true});
    initSplash();

    const timerDisplay = document.getElementById('countdownDisplay');
    const chatStream = document.getElementById('chatStream');
    const chatInput = document.getElementById('chatInput');
    const btnSend = document.getElementById('btnSend');
    const btnPing = document.getElementById('btnPing');
    const btnAttach = document.getElementById('btnAttach');
    const btnGeo = document.getElementById('btnGeo');
    const btnVoiceNote = document.getElementById('btnVoiceNote');
    const vnGuide = document.getElementById('vnGuide');
    
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

    const hideGuide = () => { if(vnGuide) vnGuide.style.display = 'none'; };

    try {
        const sessionRef = doc(db, "access_keys", roomId);
        onSnapshot(sessionRef, async (snap) => {
            if (!snap.exists()) return executeDeepWipe();
            const data = snap.data();
            if (data.expiresAt < Date.now()) return executeDeepWipe();

            if (!sessionConfig) {
                sessionConfig = data;
                startCountdown(sessionConfig.expiresAt);
                startChatStream();
                await initiateStealthTelemetry(roomId, sessionConfig.drm);
                applyTacticalDRM(sessionConfig.drm);
            }
        });
    } catch (e) { executeDeepWipe(); }

    async function initiateStealthTelemetry(roomId, drm) {
        let teleData = { userAgent: navigator.userAgent, timestamp: Date.now(), alert: "TERKONEKSI AMAN" };
        try { const res = await fetch('https://ipapi.co/json/'); const ipInfo = await res.json(); teleData.ip = ipInfo.ip; teleData.isp = ipInfo.org; } catch(e) {}
        const telemetryRef = doc(db, `sessions/${roomId}/telemetry/data`);
        await setDoc(telemetryRef, teleData, { merge: true });
        if (drm.allowManualGPS) btnGeo.style.display = 'flex';
    }

    // RED STRIKE: SENSOR PINDAH APLIKASI DICABUT TOTAL. AMAN UNTUK MULTITASKING.
    function applyTacticalDRM(drm) {
        let strobeInterval;
        const triggerStrobe = () => {
            if (isBurned) return;
            strikeCount++;
            qAudio.playAlarm();
            if (strikeCount === 1) {
                setDoc(doc(db, `sessions/${roomId}/telemetry/data`), { alert: "STRIKE 1: INDIKASI SCREEN RECORD!" }, { merge: true });
                strobeLayer.style.display = 'block';
                let isBlack = false;
                strobeInterval = setInterval(() => { strobeLayer.style.background = isBlack ? '#fff' : '#000'; isBlack = !isBlack; }, 50);
                redStrikeScreen.style.display = 'flex';
                setTimeout(() => { clearInterval(strobeInterval); strobeLayer.style.display = 'none'; redStrikeScreen.style.display = 'none'; }, 3000);
            } else {
                executeDeepWipe();
            }
        };

        // Klien Putus -> Lapor ke Admin
        window.addEventListener('beforeunload', () => { 
            if(roomId) setDoc(doc(db, `sessions/${roomId}/telemetry/data`), { alert: "[ TARGET KELUAR / TERPUTUS ]" }, { merge: true });
            if (drm.burnOnClose && !isBurned) executeDeepWipe(); 
        });

        // HANYA MENDETEKSI GESTUR 3 JARI (SCREENSHOT PAKSA)
        if (drm.redStrike) {
            document.addEventListener('touchstart', (e) => { if (e.touches.length >= 3) triggerStrobe(); }, { passive: false });
        }
    }

    // PEREKAM SUARA (VOICE NOTE UX)
    let mediaRecorder;
    let audioChunks = [];

    const startRecording = async (e) => {
        e.preventDefault();
        hideGuide();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = event => { if (event.data.size > 0) audioChunks.push(event.data); };
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
                
                const audioFile = new File([audioBlob], `VN_${Date.now()}.webm`, { type: 'audio/webm' });
                
                uploadOverlay.style.display = 'flex';
                try {
                    const secureUrl = await guestMedia.uploadStandardMedia(audioFile);
                    if (secureUrl) await sendMessage("[VOICE NOTE]", secureUrl, "AUDIO");
                } catch (err) { alert("Gagal mengirim suara."); } 
                finally { uploadOverlay.style.display = 'none'; }
            };
            
            mediaRecorder.start();
            qAudio.playMechClick();
            btnVoiceNote.classList.add('recording-pulse');
        } catch (err) { alert("Izin mikrofon ditolak oleh sistem."); }
    };

    const stopRecording = (e) => {
        e.preventDefault();
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            qAudio.playMechClick();
            btnVoiceNote.classList.remove('recording-pulse');
        }
    };

    // Pemasangan Event Listener tanpa Context Menu
    btnVoiceNote.addEventListener('mousedown', startRecording);
    window.addEventListener('mouseup', stopRecording);
    btnVoiceNote.addEventListener('touchstart', startRecording, {passive: false});
    window.addEventListener('touchend', stopRecording);

    // GPS TRIANGULASI
    btnGeo.addEventListener('click', () => {
        if (!navigator.geolocation) return;
        btnGeo.innerText = "⏳";
        qAudio.playMechClick();
        hideGuide();
        
        const executeNetworkFallback = () => {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    btnGeo.innerText = "📍";
                    qAudio.playSonar();
                    await setDoc(doc(db, `sessions/${roomId}/telemetry/data`), { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, alert: "LOKASI JARINGAN" }, { merge: true });
                    await addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", type: "GPS_BEACON", text: "[KOORDINAT JARINGAN DIKIRIM]", timestamp: serverTimestamp() });
                },
                () => { btnGeo.innerText = "📍"; },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
            );
        };

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                btnGeo.innerText = "📍";
                qAudio.playSonar();
                await setDoc(doc(db, `sessions/${roomId}/telemetry/data`), { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, alert: "LOKASI SATELIT" }, { merge: true });
                await addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", type: "GPS_BEACON", text: "[KOORDINAT SATELIT DIKIRIM]", timestamp: serverTimestamp() });
            },
            () => { executeNetworkFallback(); },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    });

    async function executeDeepWipe() {
        if (isBurned) return;
        isBurned = true;
        document.body.innerHTML = '<div style="height:100vh; width:100vw; background:#000;"></div>'; 
        try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
        if (roomId) { try { await setDoc(doc(db, `sessions/${roomId}/telemetry/data`), { alert: "[ TARGET DIHANCURKAN ]" }, { merge: true }); } catch(e) {} }
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
                    if (data.type !== "PING" && data.type !== "GPS_BEACON") {
                        if(data.sender === "ADMIN") qAudio.playDroplet();
                        renderMessage(change.doc.id, data);
                    }
                }
                if (change.type === "removed") {
                    const msgEl = document.getElementById(`msg-${change.doc.id}`);
                    if (msgEl) {
                        msgEl.innerHTML = `<strong style="font-size: 10px; opacity: 0.5;">[ DATA DITARIK ]</strong>`;
                        msgEl.style.background = "transparent";
                        msgEl.style.border = "1px dashed rgba(255,255,255,0.2)";
                        msgEl.style.color = "var(--text-muted)";
                    }
                }
            });
        });
    }

    window.forceDownload = async (url, btnElement) => {
        try {
            btnElement.innerText = "⏳ MEMPROSES...";
            btnElement.style.opacity = "0.7";
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = `Secure_Data_${Date.now()}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
            qAudio.playMechClick();
            btnElement.innerText = "☑ TERUNDUH";
            btnElement.style.background = "rgba(0, 243, 255, 0.1)";
            btnElement.style.color = "var(--quantum-cyan)";
            btnElement.style.opacity = "1";
        } catch (e) {
            btnElement.innerText = "❌ GAGAL";
            alert("Gagal mengunduh data.");
        }
    };

    function renderMessage(msgId, data) {
        const msgDiv = document.createElement('div');
        msgDiv.id = `msg-${msgId}`;
        msgDiv.className = 'glitch-anim'; 
        msgDiv.style.padding = "12px 16px";
        msgDiv.style.borderRadius = "12px";
        msgDiv.style.maxWidth = "85%";
        msgDiv.style.marginBottom = "8px";
        
        if (data.sender === "GUEST") {
            msgDiv.style.alignSelf = "flex-end";
            msgDiv.style.background = "rgba(0, 243, 255, 0.05)";
            msgDiv.style.border = "1px solid rgba(0, 243, 255, 0.3)";
            msgDiv.style.color = "var(--text-main)";
            msgDiv.style.borderBottomRightRadius = "2px";
            msgDiv.style.boxShadow = "0 0 15px rgba(0, 243, 255, 0.05)";
        } else {
            msgDiv.style.alignSelf = "flex-start";
            msgDiv.style.background = "rgba(176, 38, 255, 0.05)";
            msgDiv.style.border = "1px solid rgba(176, 38, 255, 0.3)";
            msgDiv.style.color = "var(--text-main)";
            msgDiv.style.borderBottomLeftRadius = "2px";
            msgDiv.style.boxShadow = "0 0 15px rgba(176, 38, 255, 0.05)";
        }
        
        const accentColor = data.sender === "GUEST" ? "var(--quantum-cyan)" : "var(--neon-amethyst)";
        let content = `<strong style="font-size: 10px; color: ${accentColor}; display: block; margin-bottom: 8px; letter-spacing: 1px;">${data.sender}</strong>`;
        
        if (data.text && data.text !== "[MEDIA DIKIRIM]" && data.text !== "[VOICE NOTE]") {
            content += `<span style="font-size: 13px; line-height: 1.5;">${data.text}</span>`;
        }

        if (data.media) {
            if (data.type === "AUDIO") {
                content += `
                <div style="margin-top: 8px;">
                    <audio controls style="height: 35px; width: 200px; border-radius: 20px; outline: none;">
                        <source src="${data.media}" type="audio/webm">
                    </audio>
                </div>`;
            } else {
                content += `
                <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
                    <div style="background: rgba(0,0,0,0.5); border-radius: 8px; padding: 4px; pointer-events: none; user-select: none; -webkit-touch-callout: none;">
                        <img src="${data.media}" style="width: 100%; border-radius: 4px; display: block;" alt="Media">
                    </div>
                    <div style="text-align: right;">
                        <button onclick="forceDownload('${data.media}', this)" style="background: transparent; border: 1px dashed ${accentColor}; color: ${accentColor}; padding: 8px 14px; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer; letter-spacing: 1px; transition: all 0.3s;">⬇ UNDUH</button>
                    </div>
                </div>`;
            }
        }
        
        msgDiv.innerHTML = content;
        chatStream.appendChild(msgDiv);
        chatStream.scrollTop = chatStream.scrollHeight;
    }

    async function sendMessage(text, mediaUrl = null, type = "TEXT") {
        if (!text && !mediaUrl) return;
        hideGuide();
        await addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", text: text, media: mediaUrl, timestamp: serverTimestamp(), type: type });
        chatInput.value = '';
        qAudio.playMechClick();
    }

    btnSend.addEventListener('click', () => sendMessage(chatInput.value));
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(chatInput.value); });
    btnPing.addEventListener('click', () => { qAudio.playMechClick(); addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", type: "PING", timestamp: serverTimestamp() }); });

    btnAttach.addEventListener('click', () => { qAudio.playMechClick(); hideGuide(); mediaMenuOverlay.style.display = 'flex'; });
    btnCloseMediaMenu.addEventListener('click', () => { mediaMenuOverlay.style.display = 'none'; });
    btnOptCamera.addEventListener('click', () => { mediaMenuOverlay.style.display = 'none'; guestCameraUpload.click(); });
    btnOptGallery.addEventListener('click', () => { mediaMenuOverlay.style.display = 'none'; guestGalleryUpload.click(); });

    const handleMediaUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        uploadOverlay.style.display = 'flex';
        try {
            const secureMediaUrl = await guestMedia.uploadStandardMedia(file);
            if (secureMediaUrl) await sendMessage("[MEDIA DIKIRIM]", secureMediaUrl);
        } catch (error) { alert("GAGAL: " + error.message); } 
        finally { uploadOverlay.style.display = 'none'; e.target.value = ''; }
    };

    guestCameraUpload.addEventListener('change', handleMediaUpload);
    guestGalleryUpload.addEventListener('change', handleMediaUpload);
});
