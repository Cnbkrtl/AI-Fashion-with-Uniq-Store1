import React, { useCallback, useState, useRef, useEffect } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { ClearIcon } from './icons/ClearIcon';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  imageUrl: string | null;
  onClear?: () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, imageUrl, onClear }) => {
  const [isDragging, setIsDragging] = useState(false);
  const uploaderRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    // On initial mount, if there's no image, focus the uploader to guide the user.
    if (!imageUrl && uploaderRef.current) {
      uploaderRef.current.focus();
    }
  }, [imageUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageUpload(e.dataTransfer.files[0]);
    }
  }, [onImageUpload]);

  const handleClearClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Prevent the label from triggering the file input
    e.stopPropagation();
    if (onClear) {
      onClear();
    }
  }

  const uploaderClass = `relative block w-full aspect-w-3 aspect-h-4 rounded-lg border-2 border-dashed
    ${isDragging ? 'border-cyan-400 bg-gray-700/50' : 'border-gray-600 hover:border-gray-500'}
    transition-colors duration-200 cursor-pointer flex items-center justify-center outline-none focus:ring-2 focus:ring-cyan-500`;

  return (
    <div>
      <input
        type="file"
        id="image-upload"
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleFileChange}
      />
      <label
        ref={uploaderRef}
        tabIndex={0}
        htmlFor="image-upload"
        className={uploaderClass}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="Uploaded preview" className="object-contain w-full h-full rounded-lg" />
            {onClear && (
              <button 
                onClick={handleClearClick} 
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 transition-all duration-200 z-10"
                aria-label="Clear image"
              >
                <ClearIcon className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <div className="text-center text-gray-400 p-4">
            <UploadIcon className="mx-auto h-12 w-12" />
            <span className="mt-2 block font-semibold">Click to upload</span>
            <span className="block text-sm text-gray-500">or drag and drop</span>
          </div>
        )}
      </label>
    </div>
  );
};
