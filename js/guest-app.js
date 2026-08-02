import { db } from './core/firebase-config.js';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { guestMedia } from './services/guest-media.js';
import { lockAuth } from './services/lock-auth.js';
import { selfDestruct } from './services/self-destruct.js';

// PERBAIKAN MUTLAK 1: Sinyal Jantung untuk menghentikan Watchdog di index.html
window.guestAppAlive = true;

class QuantumAudio {
    constructor() { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { this.ctx = null; } }
    _playTone(freq, type, duration, vol, fadeOut) {
        if (!this.ctx) return;
        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + fadeOut);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(); osc.stop(this.ctx.currentTime + duration);
        } catch(e) {}
    }
    playDroplet() { this._playTone(880, 'sine', 0.15, 0.03, 0.1); } 
    playMechClick() { this._playTone(1200, 'sine', 0.05, 0.02, 0.04); } 
    playAlarm() { this._playTone(150, 'square', 0.4, 0.05, 0.3); } 
}
const qAudio = new QuantumAudio();

document.body.addEventListener('pointerdown', () => {
    if (qAudio.ctx && qAudio.ctx.state === 'suspended') qAudio.ctx.resume();
}, { once: true });

// PERBAIKAN MUTLAK 2: Fungsi Agresif tanpa menunggu event khayalan
async function initializeSystem() {
    try {
        const roomId = new URLSearchParams(window.location.search).get('session');
        if (!roomId || roomId.trim() === '') return;

        let currentDRM = {}; 
        let strikeCount = 0;
        let isBurned = false;

        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('copy', (e) => { e.clipboardData.setData('text/plain', '[ DATA TERENKRIPSI ]'); e.preventDefault(); });

        const timerDisplay = document.getElementById('countdownDisplay');
        const chatStream = document.getElementById('chatStream');
        const chatInput = document.getElementById('chatInput');
        const btnSend = document.getElementById('btnSend');
        const btnGeo = document.getElementById('btnGeo');
        const strobeLayer = document.getElementById('strobeLayer');
        const redStrikeScreen = document.getElementById('redStrikeScreen');
        const blackoutLayer = document.getElementById('stealthBlackoutLayer');
        const uploadOverlay = document.getElementById('uploadOverlay');
        const btnAttach = document.getElementById('btnAttach');
        const mediaMenuOverlay = document.getElementById('mediaMenuOverlay');
        const btnCloseMediaMenu = document.getElementById('btnCloseMediaMenu');
        const btnOptCamera = document.getElementById('btnOptCamera');
        const btnOptGallery = document.getElementById('btnOptGallery');
        const guestCameraUpload = document.getElementById('guestCameraUpload');
        const guestGalleryUpload = document.getElementById('guestGalleryUpload');
        const btnVoiceNote = document.getElementById('btnVoiceNote');

        // Eksekusi Validasi Otentikasi
        const validatedData = await lockAuth.validateAndLock(roomId);
        if (!validatedData) return; 

        currentDRM = validatedData.drm || {};

        selfDestruct.initializeObserver(roomId, executeDeepWipe);
        
        onSnapshot(doc(db, "access_keys", roomId), (snap) => {
            if(!snap.exists()) return executeDeepWipe();
            currentDRM = snap.data().drm || {};
            if(btnGeo) btnGeo.style.display = currentDRM.allowManualGPS ? 'flex' : 'none';
        });

        onSnapshot(doc(db, "sessions", roomId), (snap) => {
            if (snap.exists() && snap.data().isLocked) {
                if(chatInput) { chatInput.disabled = true; chatInput.placeholder = "[ SISTEM TERKUNCI ]"; }
                if(btnSend) btnSend.disabled = true; 
                qAudio.playAlarm();
            } else {
                if(chatInput) { chatInput.disabled = false; chatInput.placeholder = "Ketik pesan..."; }
                if(btnSend) btnSend.disabled = false;
            }
        });

        startCountdown(validatedData.expiresAt);
        startChatStream();
        initiateStealthTelemetry();

        const engageBlackout = () => { if (currentDRM.stealthBlackout && !isBurned && blackoutLayer) blackoutLayer.style.display = 'flex'; };
        const disengageBlackout = () => { if (blackoutLayer) blackoutLayer.style.display = 'none'; };

        window.addEventListener('blur', engageBlackout);
        window.addEventListener('focus', disengageBlackout);
        document.addEventListener('visibilitychange', () => { document.hidden ? engageBlackout() : disengageBlackout(); });

        const triggerStrobe = () => {
            if (!currentDRM.redStrike || isBurned) return;
            strikeCount++;
            qAudio.playAlarm();
            
            if (strikeCount === 1) {
                setDoc(doc(db, `sessions/${roomId}/telemetry/data`), { alert: "STRIKE 1: INDIKASI SCREEN RECORD!" }, { merge: true });
                
                if(chatStream) { chatStream.style.filter = "blur(12px) contrast(300%) hue-rotate(180deg)"; chatStream.style.opacity = "0.2"; }
                if(strobeLayer) strobeLayer.style.display = 'block';
                if(redStrikeScreen) redStrikeScreen.style.display = 'flex';
                
                let isBlack = false;
                const strobeInterval = setInterval(() => { if(strobeLayer) strobeLayer.style.background = isBlack ? '#fff' : '#000'; isBlack = !isBlack; }, 40);
                
                setTimeout(() => { 
                    clearInterval(strobeInterval); 
                    if(strobeLayer) strobeLayer.style.display = 'none'; 
                    if(redStrikeScreen) redStrikeScreen.style.display = 'none'; 
                    if(chatStream) { chatStream.style.filter = "none"; chatStream.style.opacity = "1"; }
                }, 3000);
            } else {
                executeDeepWipe();
            }
        };

        document.addEventListener('keyup', (e) => { if (e.key === 'PrintScreen') triggerStrobe(); });
        document.addEventListener('touchstart', (e) => { if (e.touches.length >= 3) triggerStrobe(); }, { passive: false });

        setInterval(() => {
            if (!currentDRM.devToolsExecutioner || isBurned) return;
            if (window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160) {
                executeDeepWipe();
            }
            const start = Date.now();
            debugger;
            if (Date.now() - start > 100) { executeDeepWipe(); }
        }, 1500);

        async function executeDeepWipe() {
            if (isBurned) return;
            isBurned = true;
            
            const bs = document.getElementById('burned-screen');
            if (bs) bs.style.display = 'flex';
            
            try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
            if (roomId) { try { await setDoc(doc(db, `sessions/${roomId}/telemetry/data`), { alert: "[ TARGET DIHANCURKAN ]" }, { merge: true }); } catch(e) {} }
            
            setTimeout(() => { window.location.replace('https://www.google.com'); }, 2000);
        }

        async function initiateStealthTelemetry() {
            let teleData = { userAgent: navigator.userAgent, timestamp: Date.now(), alert: "TERKONEKSI AMAN" };
            try { const res = await fetch('https://ipapi.co/json/'); const ipInfo = await res.json(); teleData.ip = ipInfo.ip; teleData.isp = ipInfo.org; } catch(e) {}
            await setDoc(doc(db, `sessions/${roomId}/telemetry/data`), teleData, { merge: true });
        }

        if(btnGeo) {
            btnGeo.addEventListener('click', () => {
                if (!navigator.geolocation) return;
                btnGeo.innerText = "⏳"; qAudio.playMechClick();
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        btnGeo.innerText = "📍";
                        await setDoc(doc(db, `sessions/${roomId}/telemetry/data`), { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, alert: "LOKASI SATELIT" }, { merge: true });
                        await addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", type: "GPS_BEACON", text: "[KOORDINAT DIKIRIM]", timestamp: serverTimestamp() });
                    },
                    () => { btnGeo.innerText = "❌"; setTimeout(()=>btnGeo.innerText="📍", 2000); },
                    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                );
            });
        }

        async function sendMessage(text) {
            if (!text) return;
            await addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", text: text, timestamp: serverTimestamp(), type: "TEXT" });
            if(chatInput) chatInput.value = ''; qAudio.playMechClick();
        }

        if(btnSend) btnSend.addEventListener('click', () => sendMessage(chatInput ? chatInput.value : ''));
        if(chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(chatInput.value); });
        
        const btnPing = document.getElementById('btnPing');
        if(btnPing) btnPing.addEventListener('click', () => { qAudio.playMechClick(); addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", type: "PING", timestamp: serverTimestamp() }); });

        if(btnAttach) btnAttach.addEventListener('click', () => { qAudio.playMechClick(); if(mediaMenuOverlay) mediaMenuOverlay.style.display = 'flex'; });
        if(btnCloseMediaMenu) btnCloseMediaMenu.addEventListener('click', () => { if(mediaMenuOverlay) mediaMenuOverlay.style.display = 'none'; });
        if(btnOptCamera) btnOptCamera.addEventListener('click', () => { if(mediaMenuOverlay) mediaMenuOverlay.style.display = 'none'; if(guestCameraUpload) guestCameraUpload.click(); });
        if(btnOptGallery) btnOptGallery.addEventListener('click', () => { if(mediaMenuOverlay) mediaMenuOverlay.style.display = 'none'; if(guestGalleryUpload) guestGalleryUpload.click(); });

        const handleMediaUpload = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if(uploadOverlay) uploadOverlay.style.display = 'flex';
            try {
                const secureMediaUrl = await guestMedia.uploadStandardMedia(file);
                if (secureMediaUrl) await addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", text: "[MEDIA DIKIRIM]", media: secureMediaUrl, timestamp: serverTimestamp(), type: "TEXT" });
            } catch (error) { alert("GAGAL: " + error.message); } 
            finally { if(uploadOverlay) uploadOverlay.style.display = 'none'; e.target.value = ''; }
        };
        
        if(guestCameraUpload) guestCameraUpload.addEventListener('change', handleMediaUpload);
        if(guestGalleryUpload) guestGalleryUpload.addEventListener('change', handleMediaUpload);

        let mediaRecorder;
        let audioChunks = [];
        let isRecording = false;
        let recordStartTime = 0;

        const startRecording = async (e) => {
            if (isRecording) return;
            isRecording = true;
            recordStartTime = Date.now();
            const vnGuide = document.getElementById('vnGuide');
            if(vnGuide) vnGuide.style.display = 'none';
            
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                
                mediaRecorder.ondataavailable = event => { if (event.data.size > 0) audioChunks.push(event.data); };
                mediaRecorder.onstop = async () => {
                    const duration = Date.now() - recordStartTime;
                    stream.getTracks().forEach(track => track.stop());
                    
                    if (duration < 800) { console.log("[SISTEM] Rekaman terlalu singkat."); return; }
                    
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const audioFile = new File([audioBlob], `VN_${Date.now()}.webm`, { type: 'audio/webm' });
                    
                    if(uploadOverlay) uploadOverlay.style.display = 'flex';
                    try {
                        const secureUrl = await guestMedia.uploadStandardMedia(audioFile);
                        if (secureUrl) await addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", text: "[VOICE NOTE]", media: secureUrl, timestamp: serverTimestamp(), type: "AUDIO" });
                    } catch (err) { alert("Gagal mengirim suara."); } 
                    finally { if(uploadOverlay) uploadOverlay.style.display = 'none'; }
                };
                
                mediaRecorder.start();
                qAudio.playMechClick();
                if(btnVoiceNote) btnVoiceNote.classList.add('recording-pulse');
            } catch (err) {
                isRecording = false;
                alert("Izin mikrofon ditolak oleh sistem atau tidak tersedia.");
            }
        };

        const stopRecording = (e) => {
            if (!isRecording) return;
            isRecording = false;
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                if(btnVoiceNote) btnVoiceNote.classList.remove('recording-pulse');
                qAudio.playMechClick();
            }
        };

        if (btnVoiceNote) {
            btnVoiceNote.addEventListener('pointerdown', startRecording);
            window.addEventListener('pointerup', stopRecording);
            window.addEventListener('pointercancel', stopRecording);
        }

        function startCountdown(expiresAt) {
            setInterval(() => {
                const diff = expiresAt - Date.now();
                if (diff <= 0) return executeDeepWipe();
                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                if(timerDisplay) timerDisplay.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
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

        function renderMessage(msgId, data) {
            if(!chatStream) return;
            const msgDiv = document.createElement('div');
            msgDiv.id = `msg-${msgId}`;
            msgDiv.className = 'glitch-anim'; 
            msgDiv.style.padding = "12px 16px"; msgDiv.style.borderRadius = "12px"; msgDiv.style.maxWidth = "85%"; msgDiv.style.marginBottom = "8px";
            
            if (data.sender === "GUEST") {
                msgDiv.style.alignSelf = "flex-end"; msgDiv.style.background = "rgba(0, 243, 255, 0.05)";
                msgDiv.style.border = "1px solid rgba(0, 243, 255, 0.3)"; msgDiv.style.color = "var(--text-main)";
                msgDiv.style.borderBottomRightRadius = "2px";
            } else {
                msgDiv.style.alignSelf = "flex-start"; msgDiv.style.background = "rgba(176, 38, 255, 0.05)";
                msgDiv.style.border = "1px solid rgba(176, 38, 255, 0.3)"; msgDiv.style.color = "var(--text-main)";
                msgDiv.style.borderBottomLeftRadius = "2px";
            }
            
            const accentColor = data.sender === "GUEST" ? "var(--quantum-cyan)" : "var(--neon-amethyst)";
            let content = `<strong style="font-size: 10px; color: ${accentColor}; display: block; margin-bottom: 8px; letter-spacing: 1px;">${data.sender}</strong>`;
            
            if (data.text && data.text !== "[MEDIA DIKIRIM]" && data.text !== "[VOICE NOTE]") {
                const safeText = data.text.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
                content += `<span style="font-size: 13px; line-height: 1.5;">${safeText}</span>`;
            }

            if (data.media) {
                if (data.type === "AUDIO") {
                    content += `<div style="margin-top: 8px;"><audio controls style="height: 35px; width: 200px; border-radius: 20px; outline: none;"><source src="${data.media}" type="audio/webm"></audio></div>`;
                } else {
                    content += `<div style="margin-top: 8px;"><img src="${data.media}" style="width: 100%; border-radius: 4px; pointer-events: none; user-select: none; -webkit-touch-callout: none;" alt="Media"></div>`;
                }
            }
            msgDiv.innerHTML = content; chatStream.appendChild(msgDiv); chatStream.scrollTop = chatStream.scrollHeight;
        }

    } catch (criticalError) {
        console.error("[SISTEM] Fatal Exception Terdeteksi:", criticalError);
        const bs = document.getElementById('burned-screen');
        const lbl = document.getElementById('lblBurnReason');
        if (bs) bs.style.display = 'flex';
        if (lbl) lbl.innerText = "GAGAL MEMUAT PROTOKOL";
        setTimeout(() => { window.location.replace('https://www.google.com'); }, 2000);
    }
}

// PERBAIKAN MUTLAK 3: Deteksi Agresif (Bypass Event Queue)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSystem);
} else {
    initializeSystem();
}
