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

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); 

            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error("Transmisi ditolak. Status: " + response.status);
            }

            const data = await response.json();
            return data.secure_url;

        } catch (error) {
            throw new Error(error.message);
        }
    }
}

export const guestMedia = new GuestMediaService();
