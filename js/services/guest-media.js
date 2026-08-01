export class GuestMediaService {
    constructor() {
        // Menggunakan kredensial infrastruktur yang telah diamankan
        this.cloudName = "e0wmrkhy";
        this.uploadPreset = "secure_chat_media";
        this.uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`;
    }

    async uploadStandardMedia(file) {
        if (!file) return null;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', this.uploadPreset);

        console.log("[SISTEM] Memulai transmisi media klien...");

        try {
            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error("Koneksi transmisi terputus.");
            }

            const data = await response.json();
            console.log("[SISTEM] Media berhasil ditransmisikan secara aman.");
            return data.secure_url;

        } catch (error) {
            console.error("[SISTEM] Transmisi gagal:", error.message);
            throw error;
        }
    }
}

export const guestMedia = new GuestMediaService();
