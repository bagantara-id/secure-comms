import { db } from '../core/firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export class LockAuthenticator {
    constructor() {
        this.fingerprint = this.getOrGenerateFingerprint();
    }

    getOrGenerateFingerprint() {
        let fp = localStorage.getItem('secure_device_fp') || sessionStorage.getItem('secure_device_fp');
        if (!fp) {
            fp = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'x-x-x'.replace(/x/g, () => (Math.random()*16|0).toString(16));
            try {
                localStorage.setItem('secure_device_fp', fp);
                sessionStorage.setItem('secure_device_fp', fp);
            } catch(e) {}
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

            window.history.replaceState({}, document.title, window.location.pathname);
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
