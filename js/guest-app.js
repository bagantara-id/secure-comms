window.guestAppAlive = true;

// GHOST PROTOCOL TAHAP 2: Penanganan Lembut Anti-Cache (Tanpa Spam History)
window.addEventListener('pageshow', function(event) {
    if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
        window.location.replace('https://www.google.com');
    }
});

import { db, networkTacticalTimeout } from './core/firebase-config.js';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { guestMedia } from './services/guest-media.js';
import { lockAuth } from './core/lock-auth.js';
import { selfDestruct } from './services/self-destruct.js';

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

function showToast(msg, isError = false) {
    const toast = document.getElementById('tactical-toast');
    if(!toast) return;
    toast.innerHTML = isError ? msg : `<svg style="width:12px;height:12px;stroke:currentColor;fill:none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ${msg}`;
    if(isError) toast.classList.add('toast-error'); else toast.classList.remove('toast-error');
    toast.classList.add('toast-show');
    setTimeout(() => toast.classList.remove('toast-show'), 3500);
}

// Global Unsubscribe Handlers
let unsubAccess = null;
let unsubSession = null;
let unsubChat = null;
let devToolsInterval = null;

async function initializeSystem() {
    try {
        // PERBAIKAN TAHAP 2: EKSPLORASI URL PARAMETER & MEMORI
        const urlParams = new URLSearchParams(window.location.search);
        let roomId = urlParams.get('session') || urlParams.get('room') || window.TACTICAL_SESSION_ID;

        if (!roomId || roomId.trim() === '') {
            try { roomId = sessionStorage.getItem('active_tactical_room'); } catch(e) {}
        }

        // Jika ID ditemukan, simpan ke memori lokal & bersihkan URL tanpa rekaman histori
        if (roomId && roomId.trim() !== '') {
            window.TACTICAL_SESSION_ID = roomId;
            try { 
                sessionStorage.setItem('active_tactical_room', roomId);
                if (window.history && window.history.replaceState) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch(e) {}
        } else {
            // Sesi tidak ditemukan di mana pun, eksekusi pemusnahan
            return executeDeepWipe(); 
        }

        let currentDRM = {}; 
        let strikeCount = 0;
        let isBurned = false;

        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('copy', (e) => { e.clipboardData.setData('text/plain', '[ ENCRYPTED BY AEGIS ]'); e.preventDefault(); });

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
        const btnVoiceNote = document.getElementById('btnVoiceNote');
        const guestCameraUpload = document.getElementById('guestCameraUpload');
        const guestGalleryUpload = document.getElementById('guestGalleryUpload');

        // Validasi identitas perangkat
        const validatedData = await lockAuth.validateAndLock(roomId);
        if (!validatedData) return; 

        currentDRM = validatedData.drm || {};

        selfDestruct.initializeObserver(roomId, executeDeepWipe);
        
        unsubAccess = onSnapshot(doc(db, "access_keys", roomId), (snap) => {
            if(!snap.exists()) return executeDeepWipe();
            currentDRM = snap.data().drm || {};
            if(btnGeo) btnGeo.style.display = currentDRM.allowManualGPS ? 'flex' : 'none';
        });

        unsubSession = onSnapshot(doc(db, "sessions", roomId), (snap) => {
            if (snap.exists() && snap.data().isLocked) {
                if(chatInput) { chatInput.disabled = true; chatInput.placeholder = "[ TERMINAL TERKUNCI ]"; }
                if(btnSend) btnSend.disabled = true; 
                qAudio.playAlarm();
            } else {
                if(chatInput) { chatInput.disabled = false; chatInput.placeholder = "Ketik transmisi..."; }
                if(btnSend) btnSend.disabled = false;
            }
        });

        startCountdown(validatedData.expiresAt);
        startChatStream(roomId);
        initiateStealthTelemetry(roomId);

        // HILANGKAN SPLASH SCREEN DENGAN AMAN
        const splashOverlay = document.getElementById('aegisSplash') || document.getElementById('splashScreen') || document.getElementById('authSplash');
        if (splashOverlay) {
            splashOverlay.style.opacity = '0';
            setTimeout(() => { splashOverlay.style.display = 'none'; }, 500);
        }

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
                networkTacticalTimeout(setDoc(doc(db, `sessions/${roomId}/telemetry/data`), { alert: "STRIKE 1: INDIKASI SCREEN RECORD!" }, { merge: true }), 5000).catch(()=>{});
                
                if(chatStream) { chatStream.style.filter = "blur(15px) contrast(300%) hue-rotate(180deg) sepia(100%)"; chatStream.style.opacity = "0.2"; }
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

        devToolsInterval = setInterval(() => {
            if (!currentDRM.devToolsExecutioner || isBurned) return;
            const start = Date.now();
            debugger;
            if (Date.now() - start > 100) { executeDeepWipe(); }
        }, 1500);

        async function executeDeepWipe() {
            if (isBurned) return;
            isBurned = true;
            
            if(devToolsInterval) clearInterval(devToolsInterval);

            if(typeof unsubAccess === 'function') unsubAccess();
            if(typeof unsubSession === 'function') unsubSession();
            if(typeof unsubChat === 'function') unsubChat();

            try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
            
            if (roomId) { 
                try { 
                    await networkTacticalTimeout(setDoc(doc(db, `sessions/${roomId}/telemetry/data`), { alert: "[ TARGET DIHANCURKAN ]" }, { merge: true }), 1500); 
                } catch(e) {} 
            }
            
            if (typeof window.triggerHellfireKick === 'function') {
                window.triggerHellfireKick("AKSES DITOLAK ATAU DIHANCURKAN");
            } else {
                window.location.replace('https://www.google.com');
            }
        }

        async function initiateStealthTelemetry(rId) {
            let teleData = { userAgent: navigator.userAgent, timestamp: Date.now(), alert: "TERKONEKSI AMAN" };
            try { 
                const res = await fetch('https://ipapi.co/json/'); 
                const ipInfo = await res.json(); 
                teleData.ip = ipInfo.ip; 
                teleData.isp = ipInfo.org; 
                
                const mockIpEl = document.getElementById('mockIp');
                if (mockIpEl && teleData.ip) mockIpEl.innerText = teleData.ip;
            } catch(e) {}
            try { await networkTacticalTimeout(setDoc(doc(db, `sessions/${rId}/telemetry/data`), teleData, { merge: true }), 5000); } catch(e){}
        }

        if(btnGeo) {
            let isLocating = false;
            btnGeo.addEventListener('click', () => {
                if (isLocating) return; 
                if (!navigator.geolocation) { showToast("Sistem GPS tidak didukung perangkat.", true); return; }
                
                isLocating = true;
                const originalIcon = btnGeo.innerHTML;
                
                btnGeo.innerHTML = `<svg viewBox="0 0 24 24" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke="var(--cyan-glow)" stroke-width="2" fill="none" stroke-dasharray="31 31" stroke-linecap="round"></circle></svg>`;
                btnGeo.style.borderColor = "var(--cyan-glow)";
                btnGeo.style.background = "rgba(0,229,255,0.1)";
                btnGeo.style.cursor = "not-allowed";

                qAudio.playMechClick();
                showToast("[ MENGUNCI KOORDINAT SATELIT... ]");

                const resetGeoBtn = () => {
                    isLocating = false;
                    btnGeo.innerHTML = originalIcon;
                    btnGeo.style.borderColor = "";
                    btnGeo.style.background = "";
                    btnGeo.style.cursor = "pointer";
                };

                const sendGeoData = async (pos, typeStr) => {
                    try {
                        await networkTacticalTimeout(setDoc(doc(db, `sessions/${roomId}/telemetry/data`), { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, alert: `LOKASI ${typeStr}` }, { merge: true }), 8000);
                        await networkTacticalTimeout(addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", type: "GPS_BEACON", text: `[KOORDINAT ${typeStr} DIKIRIM]`, timestamp: serverTimestamp() }), 8000);
                        showToast(`[ KOORDINAT ${typeStr} TERKIRIM ]`);
                    } catch(e) {
                        showToast("KONEKSI GAGAL SAAT MENGIRIM KOORDINAT.", true);
                    } finally {
                        resetGeoBtn();
                    }
                };

                navigator.geolocation.getCurrentPosition(
                    (pos) => { sendGeoData(pos, "SATELIT"); },
                    (err) => {
                        showToast("[ SATELIT TERHALANG. BERALIH KE BTS... ]", true);
                        navigator.geolocation.getCurrentPosition(
                            (posFallback) => { sendGeoData(posFallback, "BTS / JARINGAN"); },
                            (errFallback) => {
                                showToast("IZIN LOKASI DITOLAK ATAU GPS DIMATIKAN.", true);
                                resetGeoBtn();
                            },
                            { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
                        );
                    },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            });
        }

        async function sendMessage(text) {
            if (!text || text.trim() === '') return;
            try {
                await networkTacticalTimeout(addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", text: text.trim(), timestamp: serverTimestamp(), type: "TEXT" }), 8000);
                if(chatInput) chatInput.value = ''; qAudio.playMechClick();
            } catch(e) {
                showToast("Jaringan terhambat. Gagal mengirim pesan.", true);
            }
        }

        if(btnSend) btnSend.addEventListener('click', () => sendMessage(chatInput ? chatInput.value : ''));
        if(chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(chatInput.value); });
        
        const btnPing = document.getElementById('btnPing');
        if(btnPing) btnPing.addEventListener('click', () => { 
            qAudio.playMechClick(); 
            showToast("[ PING DIKIRIM ]");
            networkTacticalTimeout(addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", type: "PING", timestamp: serverTimestamp() }), 5000).catch(()=>{}); 
        });

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
                if (secureMediaUrl) {
                    await networkTacticalTimeout(addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", text: "[MEDIA DIKIRIM]", media: secureMediaUrl, timestamp: serverTimestamp(), type: "TEXT" }), 10000);
                }
            } catch (error) { showToast("GAGAL UNGGAH: " + error.message, true); } 
            finally { if(uploadOverlay) uploadOverlay.style.display = 'none'; e.target.value = ''; }
        };
        
        if(guestCameraUpload) guestCameraUpload.addEventListener('change', handleMediaUpload);
        if(guestGalleryUpload) guestGalleryUpload.addEventListener('change', handleMediaUpload);

        let mediaRecorder;
        let audioChunks = [];
        let isRecording = false;
        let recordStartTime = 0;

        const startRecording = async () => {
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
                    
                    if (duration < 800) { showToast("Rekaman terlalu singkat.", true); return; }
                    
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const audioFile = new File([audioBlob], `VN_${Date.now()}.webm`, { type: 'audio/webm' });
                    
                    if(uploadOverlay) uploadOverlay.style.display = 'flex';
                    try {
                        const secureUrl = await guestMedia.uploadStandardMedia(audioFile);
                        if (secureUrl) {
                            await networkTacticalTimeout(addDoc(collection(db, `sessions/${roomId}/messages`), { sender: "GUEST", text: "[VOICE NOTE]", media: secureUrl, timestamp: serverTimestamp(), type: "AUDIO" }), 10000);
                        }
                    } catch (err) { showToast("Gagal mengirim suara.", true); } 
                    finally { if(uploadOverlay) uploadOverlay.style.display = 'none'; }
                };
                
                mediaRecorder.start();
                qAudio.playMechClick();
                if(btnVoiceNote) btnVoiceNote.classList.add('recording-pulse');
            } catch (err) {
                isRecording = false;
                showToast("Izin mikrofon ditolak atau tidak tersedia.", true);
            }
        };

        const stopRecording = () => {
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
                if(timerDisplay) timerDisplay.innerHTML = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:<span>${s.toString().padStart(2,'0')}</span>`;
            }, 1000);
        }

        function startChatStream(rId) {
            const q = query(collection(db, `sessions/${rId}/messages`), orderBy("timestamp", "asc"));
            unsubChat = onSnapshot(q, (snapshot) => {
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
                            msgEl.innerHTML = `<strong style="font-size: 10px; opacity: 0.5; color:var(--text-muted); font-family:'JetBrains Mono', monospace;">[ TRANSMISI DITARIK ]</strong>`;
                            msgEl.style.background = "transparent";
                            msgEl.style.border = "1px dashed rgba(255,255,255,0.1)";
                            msgEl.style.borderRight = "none";
                            msgEl.style.borderLeft = "none";
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
            
            if (data.sender === "GUEST") {
                msgDiv.style.alignSelf = "flex-end"; 
            } else {
                msgDiv.style.alignSelf = "flex-start"; 
            }
            
            const accentColor = data.sender === "GUEST" ? "var(--green-guest)" : "var(--red-alert)";
            let content = `<strong style="font-size: 11px; color: ${accentColor}; display: block; margin-bottom: 8px; letter-spacing: 2px; font-family: 'JetBrains Mono', monospace; text-shadow: 0 0 8px ${accentColor};">${data.sender}</strong>`;
            
            if (data.text && data.text !== "[MEDIA DIKIRIM]" && data.text !== "[VOICE NOTE]") {
                const safeText = data.text.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
                content += `<span style="font-size: 16px; line-height: 1.6; font-weight: 600; color: #FFF;">${safeText}</span>`;
            }

            if (data.media) {
                if (data.type === "AUDIO") {
                    content += `<div style="margin-top: 10px;"><audio controls style="height: 40px; width: 240px; border-radius: 6px; outline: none;"><source src="${data.media}" type="audio/webm"></audio></div>`;
                } else {
                    const containerId = `media-box-${msgId}`;
                    content += `<div id="${containerId}" class="media-container" style="max-height: 800px;">`;
                    content += `<img src="${data.media}" class="media-image" alt="Media Secure">`;
                    
                    if (data.sender === "ADMIN") {
                        content += `<button class="btn-dl-media" onclick="forceDownload('${data.media}', this)">
                            <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            UNDUH
                        </button>`;
                    }
                    
                    content += `<div class="media-overlay-fold" onclick="toggleMediaFold('${containerId}')">
                        <div class="btn-expand-media">
                            <svg style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            LIHAT GAMBAR
                        </div>
                    </div>`;
                    
                    content += `</div>`;
                    
                    setTimeout(() => {
                        const box = document.getElementById(containerId);
                        if (box) {
                            box.classList.add('is-folded');
                            box.style.maxHeight = '150px'; 
                        }
                    }, 5000); 
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSystem);
} else {
    initializeSystem();
}
