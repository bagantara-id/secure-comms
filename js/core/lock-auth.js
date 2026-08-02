import { db } from '../core/firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Penyimpanan darurat jika browser (Brave/Incognito) memblokir localStorage
let volatileFingerprint = null;

export class LockAuthenticator {
    constructor() {
        this.fingerprint = this.getOrGenerateFingerprint();
    }

    getOrGenerateFingerprint() {
        let fp = null;
        
        // 1. Operasi Baca Super Aman (Mencegah DOMException: SecurityError)
        try {
            fp = localStorage.getItem('secure_device_fp') || sessionStorage.getItem('secure_device_fp');
        } catch (e) {
            console.warn("[SISTEM] Akses memori diblokir oleh peramban. Mengalihkan ke memori volatil.");
        }

        // 2. Generate Kunci Baru Jika Tidak Ada
        if (!fp) {
            fp = volatileFingerprint || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'x-x-x'.replace(/x/g, () => (Math.random()*16|0).toString(16)));
            volatileFingerprint = fp; // Simpan di RAM sebagai cadangan mutlak
            
            // 3. Operasi Tulis Super Aman
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
        if (!roomId) return this.triggerPhantomRedirect();

        const sessionRef = doc(db, 'access_keys', roomId);
        
        try {
            const snap = await getDoc(sessionRef);
            if (!snap.exists()) return this.triggerPhantomRedirect();

            const data = snap.data();

            if (!data.fingerprint) {
                await updateDoc(sessionRef, { fingerprint: this.fingerprint });
            } else if (data.fingerprint !== this.fingerprint) {
                return this.triggerPhantomRedirect();
            }

            // Operasi manipulasi URL yang aman dari block peramban
            try {
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch(e) {}

            return data;

        } catch (error) {
            return this.triggerPhantomRedirect();
        }
    }

    triggerPhantomRedirect() {
        const bs = document.getElementById('burned-screen');
        if (bs) bs.style.display = 'flex';
        
        try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
        
        setTimeout(() => {
            window.location.replace('https://www.google.com');
        }, 2000);
        return null;
    }
}

export const lockAuth = new LockAuthenticator();
