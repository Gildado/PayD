import React, { useState } from "react";
import { Avatar } from "./Avatar";
import { uploadImage } from "../utils/imageOptimization";

interface AvatarUploadProps {
  email: string;
  name: string;
  currentImageUrl?: string;
  onImageUpload: (imageUrl: string) => void;
  endpoint: string;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  email,
  name,
  currentImageUrl,
  onImageUpload,
  endpoint,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const imageUrl = await uploadImage(file, endpoint);
      onImageUpload(imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Avatar email={email} name={name} imageUrl={currentImageUrl} size="lg" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleFileSelect(event);
        }}
        disabled={isLoading}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {isLoading ? "Uploading..." : "Upload Avatar"}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
};
