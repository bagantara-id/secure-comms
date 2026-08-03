import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAW-ovOKFFk2ovFMxzL-2lv0xHxAQTUr0k",
    authDomain: "the-voidforger.firebaseapp.com",
    databaseURL: "https://the-voidforger-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "the-voidforger",
    storageBucket: "the-voidforger.firebasestorage.app",
    messagingSenderId: "90281363893",
    appId: "1:90281363893:web:375db286f77332acdc31fc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// UTILITAS ANTI-FREEZE MUTLAK (Wajib ada agar guest-app.js tidak crash)
const networkTacticalTimeout = (promise, ms = 8000) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("NETWORK_BLOCKED_OR_TIMEOUT")), ms);
    });
    return Promise.race([
        promise.finally(() => clearTimeout(timeoutId)), 
        timeoutPromise
    ]);
};

export { db, networkTacticalTimeout };
