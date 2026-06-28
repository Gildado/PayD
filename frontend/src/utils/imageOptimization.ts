/**
 * Resize an image `File` to fit within the provided max dimensions while
 * preserving aspect ratio. Returns a JPEG `Blob` at quality 0.8.
 *
 * @param file - The input image file selected by the user
 * @param maxWidth - Maximum width in pixels (default 400)
 * @param maxHeight - Maximum height in pixels (default 400)
 * @returns Promise resolving to an optimized image `Blob`
 */
export const resizeImage = (
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to optimize image'));
              return;
            }

            resolve(blob);
          },
          'image/jpeg',
          0.8
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Resize and upload an image file to the provided endpoint. Returns the
 * `imageUrl` returned by the server on success.
 *
 * @param file - Original image file to upload
 * @param endpoint - Upload endpoint URL accepting a multipart `image` field
 * @returns Promise resolving to the uploaded image URL
 */
export const uploadImage = async (file: File, endpoint: string): Promise<string> => {
  const resizedBlob = await resizeImage(file);
  const formData = new FormData();
  formData.append('image', resizedBlob, 'avatar.jpg');

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('Upload failed');

  const raw = (await response.json()) as unknown;

  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('imageUrl' in raw) ||
    typeof (raw as { imageUrl: unknown }).imageUrl !== 'string'
  ) {
    throw new Error('Invalid upload response');
  }

  return (raw as { imageUrl: string }).imageUrl;
};

/**
 * Convert a `Blob` into a `data:` URL string.
 *
 * @param blob - Binary image blob
 * @returns Promise resolving to a `data:` URL string suitable for `img.src`
 */
export const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Failed to read optimized image'));
    };
    reader.onerror = () => reject(new Error('Failed to read optimized image'));
    reader.readAsDataURL(blob);
  });
};

export interface ProcessImageUploadOptions {
  endpoint?: string;
  maxWidth?: number;
  maxHeight?: number;
  maxFileSizeMb?: number;
}

/**
 * Process an image for upload: validate type & size, resize, and either
 * return a data URL (when no endpoint provided) or upload to a server.
 *
 * @param file - Image file provided by the user
 * @param options - Processing options (endpoint, max sizes, max file size)
 * @returns Promise resolving to either a data URL or uploaded image URL
 */
export const processImageUpload = async (
  file: File,
  options: ProcessImageUploadOptions = {}
): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file');
  }

  const maxFileSizeMb = options.maxFileSizeMb ?? 10;
  if (file.size > maxFileSizeMb * 1024 * 1024) {
    throw new Error(`Image must be smaller than ${maxFileSizeMb}MB`);
  }

  const optimizedBlob = await resizeImage(file, options.maxWidth ?? 400, options.maxHeight ?? 400);

  if (options.endpoint) {
    const formData = new FormData();
    formData.append('image', optimizedBlob, 'avatar.jpg');

    const response = await fetch(options.endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Upload failed');

    const raw = (await response.json()) as unknown;
    if (
      typeof raw !== 'object' ||
      raw === null ||
      !('imageUrl' in raw) ||
      typeof (raw as { imageUrl: unknown }).imageUrl !== 'string'
    ) {
      throw new Error('Invalid upload response');
    }

    return (raw as { imageUrl: string }).imageUrl;
  }

  return blobToDataUrl(optimizedBlob);
};
