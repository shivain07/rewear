
export const buildImageVariantUrl = (
    imageUrl: string,
    transformation: string,
) => {
    const url = new URL(imageUrl);

    url.searchParams.set("tr", transformation);

    return url.toString();
};

export const getProductImageVariants = (imageUrl: string) => {
    return {
        original: imageUrl,

        thumbnail: buildImageVariantUrl(
            imageUrl,
            "w-400,q-80,f-auto",
        ),

        detail: buildImageVariantUrl(
            imageUrl,
            "w-1200,q-85,f-auto",
        ),
    };
};
