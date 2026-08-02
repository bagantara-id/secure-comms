import { db } from '../core/firebase-config.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export class SelfDestructProtocol {
    constructor() {
        // Mengambil ID sesi langsung dari URL murni tanpa dependensi otentikasi palsu
        this.roomId = new URLSearchParams(window.location.search).get('session');
        this.unsubscribe = null;
    }

    initializeObserver() {
        if (!this.roomId) return;

        const sessionRef = doc(db, 'access_keys', this.roomId);
        console.log("[SISTEM] Protokol Self-Destruct Aktif. Memantau sinyal Kill-Switch Admin...");
        
        this.unsubscribe = onSnapshot(sessionRef, (docSnap) => {
            // Jika dokumen tiba-tiba hilang (dihapus oleh Admin via Kill-Switch)
            if (!docSnap.exists()) {
                console.warn("[KEAMANAN MUTLAK] Sinyal terminasi diterima. Menghancurkan antarmuka...");
                this.executeTerminalWipe();
            }
        });
    }

    executeTerminalWipe() {
        if (this.unsubscribe) this.unsubscribe();
        
        // Pemusnahan visual instan
        document.body.innerHTML = '<div style="height:100vh; width:100vw; background:#000;"></div>';
        
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch(e) {}
        
        // Tendangan hantu untuk menghapus riwayat
        window.history.pushState(null, '', 'https://www.google.com');
        window.location.replace('https://www.google.com');
    }
}

export const selfDestruct = new SelfDestructProtocol();

// Inisiasi pemantauan otomatis saat kapsul dimuat
if (window.location.search.includes('session')) {
    selfDestruct.initializeObserver();
}
