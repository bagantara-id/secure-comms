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
        if (!roomId) return this.triggerPhantomRedirect("TAUTAN KOSONG ATAU RUSAK");

        const sessionRef = doc(db, 'access_keys', roomId);
        
        try {
            // PERBAIKAN MUTLAK: Promise.race sebagai Bom Waktu 8 Detik
            // Mencegah status 'pending' abadi jika koneksi Firebase dicegat
            const fetchPromise = getDoc(sessionRef);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("TIMEOUT_8S")), 8000);
            });

            const snap = await Promise.race([fetchPromise, timeoutPromise]);

            if (!snap.exists()) return this.triggerPhantomRedirect("AKSES DITOLAK ATAU DIHANCURKAN");

            const data = snap.data();

            if (!data.fingerprint) {
                await updateDoc(sessionRef, { fingerprint: this.fingerprint });
            } else if (data.fingerprint !== this.fingerprint) {
                return this.triggerPhantomRedirect("PELANGGARAN IDENTITAS DIVAIS");
            }

            // Operasi manipulasi URL yang aman dari block peramban
            try {
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch(e) {}

            return data;

        } catch (error) {
            // Semua error, termasuk Timeout 8 detik dari Promise.race, akan ditangkap di sini
            let reason = "AKSES DITOLAK ATAU DIHANCURKAN";
            if (error.message === "TIMEOUT_8S") {
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
