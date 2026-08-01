import { db } from '../core/firebase-config.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export class RadarGeoService {
    constructor() {
        this.watchId = null;
        this.roomId = null;
    }

    startTransmitting(roomId) {
        this.roomId = roomId;

        if (!navigator.geolocation) {
            console.warn("[SISTEM] Perangkat tidak mendukung transmisi lokasi.");
            return;
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.transmitData(position),
            (error) => console.error("[SISTEM] Akses lokasi ditolak atau gagal.", error),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    }

    async transmitData(position) {
        if (!this.roomId) return;

        const telemetryRef = doc(db, `sessions/${this.roomId}`, "telemetry");
        try {
            await setDoc(telemetryRef, {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error("[SISTEM] Gagal mentransmisikan data telemetri.", error);
        }
    }

    terminate() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }
}

export const radarGeo = new RadarGeoService();
