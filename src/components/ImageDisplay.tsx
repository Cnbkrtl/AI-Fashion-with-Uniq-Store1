import React, { useState, useRef, useEffect } from 'react';
import { Spinner } from './Spinner';
import { PhotoIcon } from './icons/PhotoIcon';
import { ZoomInIcon } from './icons/ZoomInIcon';
import { ZoomOutIcon } from './icons/ZoomOutIcon';
import { RotateIcon } from './icons/RotateIcon';
import { ResetZoomIcon } from './icons/ResetZoomIcon';
import { UndoIcon } from './icons/UndoIcon';
import { RedoIcon } from './icons/RedoIcon';
import { TransformationState } from '../App';
import { DownloadIcon } from './icons/DownloadIcon';
import { ClearIcon } from './icons/ClearIcon';


interface ImageDisplayProps {
  id?: string;
  title: string;
  imageUrl: string | null;
  isLoading?: boolean;
  isEnhancing?: boolean;
  onEnhanceClick?: () => void;
  transform?: TransformationState;
  onTransformChange?: (newTransform: TransformationState) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onReset?: () => void;
  // FIX: Make finalizedImage and onClearFinalizedImage optional to support components that don't need them.
  finalizedImage?: { url: string; filename: string } | null;
  onClearFinalizedImage?: () => void;
}

const FASHION_GENERATION_MESSAGES = [
  "Sketching the digital fabric...",
  "Consulting with the style-bots...",
  "Scouting virtual photoshoot locations...",
  "Teaching the AI to smize...",
  "Adjusting the cyber-lighting rig...",
  "Painting pixels with panache...",
  "Dreaming up a new reality...",
  "Tailoring the final look...",
];

const FASHION_ENHANCEMENT_MESSAGES = [
  "Adding a touch of digital glamour...",
  "Sharpening the look, pixel by pixel...",
  "Giving it the high-fashion treatment...",
  "Making it magazine-ready...",
  "Polishing the masterpiece...",
  "Boosting photorealistic details...",
  "Finalizing the couture render...",
];


export const ImageDisplay: React.FC<ImageDisplayProps> = ({
  id,
  title,
  imageUrl,
  isLoading = false,
  isEnhancing = false,
  onEnhanceClick,
  transform: transformProp,
  onTransformChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onReset,
  finalizedImage,
  onClearFinalizedImage
}) => {
  const showLoading = isLoading || isEnhancing;

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const messageIntervalRef = useRef<number | null>(null);

  const transform = transformProp ?? { zoom: 1, rotation: 0, position: { x: 0, y: 0 } };
  const { zoom, rotation, position } = transform;
  
  // Local state for smooth dragging without flooding history
  const [transientPosition, setTransientPosition] = useState(position);

  // Sync transient position when history changes (undo/redo)
  useEffect(() => {
    setTransientPosition(position);
  }, [position]);

  useEffect(() => {
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
      messageIntervalRef.current = null;
    }

    const currentShowLoading = isLoading || isEnhancing;

    if (currentShowLoading) {
      const messages = isEnhancing ? FASHION_ENHANCEMENT_MESSAGES : FASHION_GENERATION_MESSAGES;
      let messageIndex = 0;
      
      setLoadingMessage(messages[messageIndex]);

      messageIntervalRef.current = window.setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        setLoadingMessage(messages[messageIndex]);
      }, 2800); // Shortened interval for a more dynamic feel

    } else {
      setLoadingMessage('');
    }

    return () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
    };
  }, [isLoading, isEnhancing]);


  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (onTransformChange && zoom > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - transientPosition.x,
        y: e.clientY - transientPosition.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      setTransientPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (isDragging && onTransformChange) {
      // Commit the final position to the history
      onTransformChange({ ...transform, position: transientPosition });
    }
    setIsDragging(false);
  };
  
  const handleRotate = () => {
    if (onTransformChange) {
        onTransformChange({ ...transform, rotation: (rotation + 90) % 360 });
    }
  };
  
  const handleZoomChange = (newZoom: number) => {
    if (onTransformChange) {
        onTransformChange({ ...transform, zoom: newZoom });
    }
  };


  const displayPosition = isDragging ? transientPosition : position;

  return (
    <div id={id} className="bg-gray-800/50 rounded-2xl shadow-lg p-4 flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-purple-400 mb-0 text-center">{title}</h3>
      <div 
        className="aspect-w-3 aspect-h-4 bg-gray-900/50 rounded-lg flex-grow flex items-center justify-center overflow-hidden relative generated-image-container"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {showLoading && (
          <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center text-gray-400 z-10 p-4 text-center animate-pulse-bg">
            <Spinner className="w-10 h-10" />
            <p className="mt-4 text-lg">{isEnhancing ? 'Finalizing your image...' : 'Generating your image...'}</p>
            <div className="h-5 mt-2 overflow-hidden">
              {loadingMessage && (
                <p key={loadingMessage} className="text-sm text-gray-400 animate-fade-in-out">
                  {loadingMessage}
                </p>
              )}
            </div>
          </div>
        )}
        
        {imageUrl && !showLoading ? (
          <img 
            src={imageUrl} 
            alt={title} 
            className="object-contain w-full h-full transition-transform duration-200"
            style={{
                transform: `translate(${displayPosition.x}px, ${displayPosition.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                cursor: zoom > 1 && onTransformChange ? (isDragging ? 'grabbing' : 'grab') : 'default',
                maxWidth: '100%',
                maxHeight: '100%',
            }}
            onMouseDown={handleMouseDown}
            draggable="false"
          />
        ) : !showLoading ? (
          <div className="text-gray-600 flex flex-col items-center">
            <PhotoIcon className="w-16 h-16" />
            <p className="mt-2">{title} will appear here.</p>
          </div>
        ) : null}
      </div>
      
      {/* The controls are now outside the image container, as a direct child of the flex-col layout. */}
      {imageUrl && !showLoading && onTransformChange && onUndo && onRedo && onReset && (
          <div className="self-center bg-gray-900/70 backdrop-blur-sm rounded-full p-1 flex items-center gap-1 shadow-lg">
              <button onClick={onUndo} disabled={!canUndo} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors disabled:text-gray-600 disabled:hover:bg-transparent disabled:cursor-not-allowed" aria-label="Undo">
                  <UndoIcon className="w-5 h-5" />
              </button>
              <button onClick={onRedo} disabled={!canRedo} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors disabled:text-gray-600 disabled:hover:bg-transparent disabled:cursor-not-allowed" aria-label="Redo">
                  <RedoIcon className="w-5 h-5" />
              </button>
              <div className="w-px h-5 bg-gray-600 mx-1"></div>
              <button onClick={() => handleZoomChange(Math.max(1, zoom - 0.1))} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors" aria-label="Zoom out">
                  <ZoomOutIcon className="w-5 h-5" />
              </button>
              <input 
                  type="range" 
                  min="1" 
                  max="3" 
                  step="0.05" 
                  value={zoom} 
                  onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm mx-1"
                  aria-label="Zoom level"
              />
              <button onClick={() => handleZoomChange(Math.min(3, zoom + 0.1))} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors" aria-label="Zoom in">
                  <ZoomInIcon className="w-5 h-5" />
              </button>
              <div className="w-px h-5 bg-gray-600 mx-1"></div>
              <button onClick={handleRotate} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors" aria-label="Rotate clockwise">
                  <RotateIcon className="w-5 h-5" />
              </button>
              <button onClick={onReset} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors" aria-label="Reset transformations">
                  <ResetZoomIcon className="w-5 h-5" />
              </button>
          </div>
      )}

      {imageUrl && onEnhanceClick && (
        <button
          onClick={onEnhanceClick}
          disabled={isLoading || isEnhancing}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105"
        >
          {isEnhancing ? (
            <>
              <Spinner /> Finalizing...
            </>
          ) : (
            'Finalize & Export'
          )}
        </button>
      )}
      
      {/* FIX: Check for onClearFinalizedImage to ensure type safety, as it's now optional. */}
      {finalizedImage && onClearFinalizedImage && (
        <div className="relative mt-2">
            <a
                href={finalizedImage.url}
                download={finalizedImage.filename}
                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-gray-900 font-bold py-3 pl-4 pr-10 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
                <DownloadIcon className="w-5 h-5" />
                Download Final Image
            </a>
            <button
                onClick={onClearFinalizedImage}
                className="absolute top-1/2 right-2 -translate-y-1/2 p-1.5 text-gray-800 hover:text-black rounded-full"
                aria-label="Clear download link"
            >
                <ClearIcon className="w-4 h-4" />
            </button>
        </div>
      )}
    </div>
  );
};
