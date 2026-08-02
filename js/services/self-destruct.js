import { db } from '../core/firebase-config.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export class SelfDestructProtocol {
    constructor() {
        this.unsubscribe = null;
    }

    initializeObserver(roomId, executeWipeCallback) {
        if (!roomId) return;
        const sessionRef = doc(db, 'access_keys', roomId);
        
        this.unsubscribe = onSnapshot(sessionRef, (docSnap) => {
            // Jika dokumen hilang (Dihapus Admin) atau Sakelar "burnOnClose" aktif namun klien mencoba relogin
            if (!docSnap.exists()) {
                console.warn("[KEAMANAN MUTLAK] Terminasi diperintahkan dari Node Pusat.");
                if(this.unsubscribe) this.unsubscribe();
                executeWipeCallback();
            }
        });
    }
}

export const selfDestruct = new SelfDestructProtocol();
