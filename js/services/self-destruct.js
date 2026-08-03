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
            // PROTOKOL BUMI HANGUS: Hancur jika dokumen ditarik ATAU sinyal 'detonated' ditekan Admin
            if (!docSnap.exists() || (docSnap.data() && docSnap.data().detonated === true)) {
                if(this.unsubscribe) this.unsubscribe();
                
                // Kirim parameter 'true' = Hapus visual tanpa peringatan (Siluman Mutlak)
                executeWipeCallback(true); 
            }
        });
    }
}

export const selfDestruct = new SelfDestructProtocol();
