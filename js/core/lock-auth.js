// PERBAIKAN MUTLAK: Keduanya ada di folder core/, cukup gunakan './firebase-config.js'
import { db, networkTacticalTimeout } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Penyimpanan darurat jika browser (Brave/Incognito) memblokir localStorage
let volatileFingerprint = null;

export class LockAuthenticator {
    constructor() {
        this.fingerprint = this.getOrGenerateFingerprint();
    }

    getOrGenerateFingerprint() {
        let fp = null;
        
        try {
            fp = localStorage.getItem('secure_device_fp') || sessionStorage.getItem('secure_device_fp');
        } catch (e) {
            console.warn("[SISTEM] Akses memori diblokir oleh peramban. Mengalihkan ke memori volatil.");
        }

        if (!fp) {
            fp = volatileFingerprint || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'x-x-x'.replace(/x/g, () => (Math.random()*16|0).toString(16)));
            volatileFingerprint = fp; 
            
            try {
                localStorage.setItem('secure_device_fp', fp);
                sessionStorage.setItem('secure_device_fp', fp);
            } catch(e) {
                console.warn("[SISTEM] Peramban menolak penyimpanan permanen.");
            }
        }
        return fp;
    }

    async validateAndLock(roomId) {
        if (!roomId) return this.triggerPhantomRedirect("TAUTAN KOSONG ATAU RUSAK");

        const sessionRef = doc(db, 'access_keys', roomId);
        
        try {
            const snap = await networkTacticalTimeout(getDoc(sessionRef), 8000);

            if (!snap.exists()) return this.triggerPhantomRedirect("AKSES DITOLAK ATAU DIHANCURKAN");

            const data = snap.data();

            if (!data.fingerprint) {
                await networkTacticalTimeout(updateDoc(sessionRef, { fingerprint: this.fingerprint }), 5000);
            } else if (data.fingerprint !== this.fingerprint) {
                return this.triggerPhantomRedirect("PELANGGARAN IDENTITAS DIVAIS");
            }

            try {
                sessionStorage.setItem('active_tactical_room', roomId);
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch(e) {}

            return data;

        } catch (error) {
            let reason = "AKSES DITOLAK ATAU DIHANCURKAN";
            if (error.message === "NETWORK_BLOCKED_OR_TIMEOUT") {
                reason = "KONEKSI GAGAL ATAU DIBLOKIR";
            }
            return this.triggerPhantomRedirect(reason);
        }
    }

    triggerPhantomRedirect(reason) {
        const bs = document.getElementById('burned-screen');
        const lbl = document.getElementById('lblBurnReason');
        if (bs) bs.style.display = 'flex';
        if (lbl && reason) lbl.innerText = reason;
        
        try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
        
        setTimeout(() => {
            window.location.replace('https://www.google.com');
        }, 2000);
        return null;
    }
}

export const lockAuth = new LockAuthenticator();
