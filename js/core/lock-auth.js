import { db } from '../core/firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export class LockAuthenticator {
    constructor() {
        this.fingerprint = this.getOrGenerateFingerprint();
    }

    getOrGenerateFingerprint() {
        // Fallback gabungan: localStorage dan sessionStorage untuk menangkal jebakan Incognito
        let fp = localStorage.getItem('secure_device_fp') || sessionStorage.getItem('secure_device_fp');
        if (!fp) {
            // Algoritma UUID Fallback jika crypto native diblokir browser
            fp = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'x-x-x'.replace(/x/g, () => (Math.random()*16|0).toString(16));
            try {
                localStorage.setItem('secure_device_fp', fp);
                sessionStorage.setItem('secure_device_fp', fp);
            } catch(e) {} // Abaikan jika penyimpanan diblokir total
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
            if (Date.now() > data.expiresAt) return this.triggerPhantomRedirect();

            if (!data.fingerprint) {
                await updateDoc(sessionRef, { fingerprint: this.fingerprint });
                console.log("[KEAMANAN] Perangkat dikunci ke sesi.");
            } else if (data.fingerprint !== this.fingerprint) {
                console.error("[KEAMANAN] Penyusup Terdeteksi.");
                return this.triggerPhantomRedirect();
            }

            // MENGHAPUS URL HANYA SETELAH VALIDASI SELESAI
            window.history.replaceState({}, document.title, window.location.pathname);
            return data;

        } catch (error) {
            return this.triggerPhantomRedirect();
        }
    }

    triggerPhantomRedirect() {
        try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
        window.history.replaceState(null, '', 'https://google.com');
        window.location.replace('https://google.com');
        return null;
    }
}

export const lockAuth = new LockAuthenticator();
