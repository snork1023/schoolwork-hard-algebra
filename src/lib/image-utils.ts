export const compressImageFile = async (
  file: File,
  { maxWidth = 1200, quality = 0.8, maxSizeMB = 1 }: {
    maxWidth?: number;
    quality?: number;
    maxSizeMB?: number;
  } = {}
): Promise<File> => {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });

  const mimeType = file.type === "image/png" ? "image/webp" : "image/jpeg";
  const maxBytes = maxSizeMB * 1024 * 1024;
  const baseScale = Math.min(1, maxWidth / Math.max(image.width, 1));
  let scale = baseScale;
  let currentQuality = quality;
  let smallestBlob: Blob | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
            return;
          }
          reject(new Error("Failed to compress image"));
        },
        mimeType,
        currentQuality
      );
    });

    if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
    if (blob.size <= maxBytes) {
      if (blob.size >= file.size) return file;
      const baseName = file.name.replace(/\.[^/.]+$/, "") || "image";
      const extension = mimeType === "image/jpeg" ? "jpg" : "webp";
      return new File([blob], `${baseName}.${extension}`, { type: mimeType, lastModified: Date.now() });
    }

    scale *= 0.75;
    currentQuality = Math.max(0.45, currentQuality * 0.9);
  }

  if (smallestBlob && smallestBlob.size < file.size) {
    const baseName = file.name.replace(/\.[^/.]+$/, "") || "image";
    const extension = mimeType === "image/jpeg" ? "jpg" : "webp";
    return new File([smallestBlob], `${baseName}.${extension}`, { type: mimeType, lastModified: Date.now() });
  }

  return file;
};
