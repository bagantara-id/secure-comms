import { lockAuth } from './core/lock-auth.js';
import { db } from './core/firebase-config.js';
import { radarGeo } from './services/radar-geo.js';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const briefingModal = document.getElementById('briefingModal');
    const btnProceed = document.getElementById('btnProceed');
    const timerDisplay = document.getElementById('countdownDisplay');
    const chatStream = document.getElementById('chatStream');
    const chatInput = document.getElementById('chatInput');
    const btnSend = document.getElementById('btnSend');
    const btnPing = document.getElementById('btnPing');
    const btnTheme = document.getElementById('btnTheme');
    const drmOverlay = document.getElementById('drmOverlay');
    
    let currentSessionData = null;
    let timerInterval = null;
    let unsubscribeChat = null;

    // Sistem Tema
    btnTheme.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        if (currentTheme === 'light') {
            document.body.removeAttribute('data-theme'); // Kembali ke dark/default
        } else {
            document.body.setAttribute('data-theme', 'light');
        }
    });

    // 1. Inisialisasi Akses
    btnProceed.addEventListener('click', async () => {
        btnProceed.disabled = true;
        btnProceed.innerText = "OTENTIKASI...";
        
        currentSessionData = await lockAuth.validateAndLock();
        
        if (currentSessionData) {
            // Transisi GPU 60fps (Mencegah jank layout)
            briefingModal.classList.add('fade-out');
            setTimeout(() => {
                briefingModal.style.display = 'none';
            }, 500); // Menunggu CSS transition selesai
            
            document.getElementById('sfxAccept').play().catch(()=>{}).catch(()=>{});
            
            startCountdown(currentSessionData.expiresAt);
            startChatStream();
            radarGeo.startTransmitting(lockAuth.roomId);
            applyDRM(currentSessionData.drm);
        } else {
            btnProceed.innerText = "AKSES DITOLAK";
        }
    });

    // 2. Sistem Hitung Mundur
    function startCountdown(expiresAt) {
        timerInterval = setInterval(() => {
            const now = Date.now();
            const diff = expiresAt - now;

            if (diff <= 0) {
                clearInterval(timerInterval);
                timerDisplay.innerText = "00:00:00";
                executeTerminalWipe();
                return;
            }

            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            timerDisplay.innerText = 
                `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }, 1000);
    }

    // 3. Aliran Komunikasi
    function startChatStream() {
        const messagesRef = collection(db, `sessions/${lockAuth.roomId}/messages`);
        const q = query(messagesRef, orderBy("timestamp", "asc"));

        unsubscribeChat = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    if (data.type !== "PING") {
                        renderMessage(data);
                    }
                }
            });
        });
    }

    async function sendMessage(text, type = "TEXT") {
        if (!text && type !== "PING") return;
        const messagesRef = collection(db, `sessions/${lockAuth.roomId}/messages`);
        
        await addDoc(messagesRef, {
            sender: "GUEST",
            text: text,
            timestamp: serverTimestamp(),
            type: type
        });

        if (type === "TEXT") chatInput.value = '';
    }

    btnSend.addEventListener('click', () => sendMessage(chatInput.value));
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage(chatInput.value);
    });

    // 4. Sinyal Prioritas
    btnPing.addEventListener('click', () => {
        sendMessage("[SINYAL PRIORITAS DIKIRIM]", "PING");
    });

    // 5. Rendering UI Chat (Adaptif dengan Tema)
    function renderMessage(data) {
        const msgDiv = document.createElement('div');
        msgDiv.style.padding = "12px 16px";
        msgDiv.style.borderRadius = "12px";
        msgDiv.style.maxWidth = "85%";
        
        if (data.sender === "GUEST") {
            msgDiv.style.alignSelf = "flex-end";
            msgDiv.style.background = "var(--accent)";
            msgDiv.style.color = "#fff";
            msgDiv.style.boxShadow = "0 4px 15px rgba(0,0,0,0.1)";
        } else {
            msgDiv.style.alignSelf = "flex-start";
            msgDiv.style.background = "var(--surface)";
            msgDiv.style.border = "1px solid var(--border-color)";
            msgDiv.style.color = "var(--text-main)";
        }
        
        msgDiv.innerHTML = `<strong style="font-size: 11px; opacity: 0.8; display: block; margin-bottom: 4px;">${data.sender}</strong>${data.text || ''}`;
        chatStream.appendChild(msgDiv);
        chatStream.scrollTop = chatStream.scrollHeight;
    }

    // 6. Proteksi Data (DRM)
    function applyDRM(drmSettings) {
        if (drmSettings.antiBlur) {
            document.addEventListener('visibilitychange', () => {
                drmOverlay.style.display = document.hidden ? 'block' : 'none';
            });
            window.addEventListener('blur', () => drmOverlay.style.display = 'block');
            window.addEventListener('focus', () => drmOverlay.style.display = 'none');
        }

        if (drmSettings.antiSave) {
            document.addEventListener('contextmenu', e => e.preventDefault());
            document.addEventListener('dragstart', e => e.preventDefault());
        }
    }

    // 7. Terminasi
    function executeTerminalWipe() {
        if (unsubscribeChat) unsubscribeChat();
        if (radarGeo) radarGeo.terminate();
        lockAuth.triggerPhantomRedirect(); 
    }
});
