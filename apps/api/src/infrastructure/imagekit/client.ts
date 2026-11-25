
import ImageKit from "@imagekit/nodejs";

let imageKitClient: ImageKit | null = null;

export const getImageKitClient = () => {
    if (imageKitClient) {
        return imageKitClient;
    }

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

    if (!privateKey) {
        throw new Error("IMAGEKIT_PRIVATE_KEY is not configured");
    }

    imageKitClient = new ImageKit({
        privateKey,
    });

    return imageKitClient;
};
