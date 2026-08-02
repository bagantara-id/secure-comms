export class GuestMediaService {
    constructor() {
        this.cloudName = "e0wmrkhy";
        this.uploadPreset = "secure_chat_media";
        this.uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`;
    }

    async uploadStandardMedia(file) {
        if (!file) return null;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', this.uploadPreset);

        console.log("[SISTEM] Memulai enkripsi dan transmisi media...");

        try {
            // Menggunakan AbortController untuk mencegah *hang* jika diblokir oleh Brave Shields / AdBlocker
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // Batas waktu 15 detik

            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error("Transmisi ditolak oleh Firewall/Cloudinary. (Error: " + response.status + ")");
            }

            const data = await response.json();
            return data.secure_url;

        } catch (error) {
            let errorMsg = error.message;
            if (error.name === 'AbortError') {
                errorMsg = "Koneksi terputus. Browser Anda mungkin memblokir transmisi jaringan.";
            } else if (error.message === "Failed to fetch") {
                errorMsg = "Koneksi diblokir (CORS/AdBlocker aktif). Matikan pelindung browser sesaat.";
            }
            console.error("[SISTEM] Transmisi gagal:", errorMsg);
            throw new Error(errorMsg);
        }
    }
}

export const guestMedia = new GuestMediaService();
