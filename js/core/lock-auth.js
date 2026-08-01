import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export class LockAuthenticator {
    constructor() {
        this.roomId = new URLSearchParams(window.location.search).get('session');
        this.fingerprint = this.getOrGenerateFingerprint();
    }

    getOrGenerateFingerprint() {
        let fp = localStorage.getItem('secure_device_fp');
        if (!fp) {
            fp = crypto.randomUUID();
            localStorage.setItem('secure_device_fp', fp);
        }
        return fp;
    }

    async validateAndLock() {
        if (!this.roomId) this.triggerPhantomRedirect();

        const sessionRef = doc(db, 'access_keys', this.roomId);
        
        try {
            const snap = await getDoc(sessionRef);
            
            if (!snap.exists()) {
                console.warn("[KEAMANAN] Sesi tidak ditemukan atau telah dihancurkan.");
                this.triggerPhantomRedirect();
                return null;
            }

            const data = snap.data();

            // Cek apakah waktu sudah kedaluwarsa
            if (Date.now() > data.expiresAt) {
                this.triggerPhantomRedirect();
                return null;
            }

            // Cek Kunci Perangkat
            if (!data.fingerprint) {
                // Perangkat pertama, kunci sesi ini dengan fingerprint saat ini
                await updateDoc(sessionRef, { fingerprint: this.fingerprint });
                console.log("[KEAMANAN] Identitas perangkat berhasil dikunci.");
                return data;
            } else if (data.fingerprint !== this.fingerprint) {
                // Perangkat asing mencoba mengakses
                console.error("[KEAMANAN] Pelanggaran Akses. Fingerprint tidak cocok.");
                this.triggerPhantomRedirect();
                return null;
            }

            // Manipulasi URL untuk menyembunyikan parameter session dari riwayat pengguna
            window.history.replaceState({}, document.title, window.location.pathname);
            
            return data;

        } catch (error) {
            console.error("[KEAMANAN] Kegagalan validasi infrastruktur.", error);
            this.triggerPhantomRedirect();
        }
    }

    triggerPhantomRedirect() {
        // Membersihkan jejak lokal dan melempar target keluar
        localStorage.clear();
        sessionStorage.clear();
        window.history.replaceState(null, '', 'https://google.com');
        window.location.replace('https://google.com');
    }
}

export const lockAuth = new LockAuthenticator();
