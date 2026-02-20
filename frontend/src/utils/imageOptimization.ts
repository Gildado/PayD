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
        const canvas = document.createElement("canvas");
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
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(blob!);
        }, "image/jpeg", 0.8);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

export const uploadImage = async (
  file: File,
  endpoint: string
): Promise<string> => {
  const resizedBlob = await resizeImage(file);
  const formData = new FormData();
  formData.append("image", resizedBlob, "avatar.jpg");

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Upload failed");

  const raw = (await response.json()) as unknown;

  if (
    typeof raw !== "object" ||
    raw === null ||
    !("imageUrl" in raw) ||
    typeof (raw as { imageUrl: unknown }).imageUrl !== "string"
  ) {
    throw new Error("Invalid upload response");
  }

  return (raw as { imageUrl: string }).imageUrl;
};
