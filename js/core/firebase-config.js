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

export { db };
