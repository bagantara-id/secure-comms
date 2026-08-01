import { db } from '../core/firebase-config.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { lockAuth } from '../core/lock-auth.js';

export class SelfDestructProtocol {
    constructor() {
        this.roomId = new URLSearchParams(window.location.search).get('session') || lockAuth.roomId;
        this.unsubscribe = null;
    }

    initializeObserver() {
        if (!this.roomId) return;

        const sessionRef = doc(db, 'access_keys', this.roomId);
        
        console.log("[SISTEM] Protokol pemantauan keamanan aktif.");
        
        this.unsubscribe = onSnapshot(sessionRef, (docSnap) => {
            // Jika dokumen tidak ada (dihapus oleh Admin / Kill-Switch ditekan)
            if (!docSnap.exists()) {
                console.warn("[KEAMANAN MUTLAK] Perintah terminasi diterima. Menghancurkan antarmuka...");
                this.executeTerminalWipe();
            }
        });
    }

    executeTerminalWipe() {
        if (this.unsubscribe) this.unsubscribe();
        
        // Membersihkan memori browser klien
        localStorage.clear();
        sessionStorage.clear();
        
        // Memanipulasi riwayat agar tidak bisa menggunakan tombol 'Back'
        window.history.pushState(null, '', 'https://google.com');
        window.history.replaceState(null, '', 'https://google.com');
        
        // Pengalihan paksa
        window.location.replace('https://google.com');
    }
}

export const selfDestruct = new SelfDestructProtocol();

// Inisiasi pemantauan secara otomatis saat modul dimuat
if (window.location.search.includes('session')) {
    selfDestruct.initializeObserver();
}
