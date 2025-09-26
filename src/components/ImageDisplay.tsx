import React, { useState, useRef, useEffect } from 'react';
import { Spinner } from './Spinner';
import { PhotoIcon } from './icons/PhotoIcon';
import { ZoomInIcon } from './icons/ZoomInIcon';
import { ZoomOutIcon } from './icons/ZoomOutIcon';
import { RotateIcon } from './icons/RotateIcon';
import { ResetZoomIcon } from './icons/ResetZoomIcon';


interface ImageDisplayProps {
  title: string;
  imageUrl: string | null;
  isLoading?: boolean;
  isEnhancing?: boolean;
  onEnhanceClick?: () => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  rotation?: number;
  onRotationChange?: (rotation: number) => void;
  position?: { x: number; y: number };
  onPositionChange?: (position: { x: number; y: number }) => void;
}

const GENERATION_MESSAGES = [
  "Warming up the AI artist...",
  "Analyzing your model and scene...",
  "Sketching the new composition...",
  "Applying digital paints and textures...",
  "Rendering final details...",
  "Adding the finishing touches...",
];

const ENHANCEMENT_MESSAGES = [
  "Preparing image for enhancement...",
  "Analyzing pixel data and lighting...",
  "Applying advanced upscaling algorithms...",
  "Refining textures and sharpening details...",
  "Adjusting photorealistic lighting...",
  "Finalizing the high-resolution image...",
];


export const ImageDisplay: React.FC<ImageDisplayProps> = ({
  title,
  imageUrl,
  isLoading = false,
  isEnhancing = false,
  onEnhanceClick,
  zoom,
  onZoomChange,
  rotation,
  onRotationChange,
  position,
  onPositionChange,
}) => {
  const showLoading = isLoading || isEnhancing;

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const messageIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
      messageIntervalRef.current = null;
    }

    const currentShowLoading = isLoading || isEnhancing;

    if (currentShowLoading) {
      const messages = isEnhancing ? ENHANCEMENT_MESSAGES : GENERATION_MESSAGES;
      let messageIndex = 0;
      
      setLoadingMessage(messages[messageIndex]);

      messageIntervalRef.current = window.setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        setLoadingMessage(messages[messageIndex]);
      }, 3500);

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
    if (onPositionChange && zoom && zoom > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - (position?.x || 0),
        y: e.clientY - (position?.y || 0),
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && onPositionChange) {
      onPositionChange({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleRotate = () => {
    if (onRotationChange && typeof rotation === 'number') {
        onRotationChange((rotation + 90) % 360);
    }
  };

  const handleReset = () => {
    if (onZoomChange) onZoomChange(1);
    if (onRotationChange) onRotationChange(0);
    if (onPositionChange) onPositionChange({ x: 0, y: 0 });
  };


  return (
    <div className="bg-gray-800/50 rounded-2xl shadow-lg p-4 flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-purple-400 mb-0 text-center">{title}</h3>
      <div 
        className="aspect-w-3 aspect-h-4 bg-gray-900/50 rounded-lg flex-grow flex items-center justify-center overflow-hidden relative generated-image-container"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {showLoading && (
          <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center text-gray-400 z-10 p-4 text-center">
            <Spinner className="w-10 h-10" />
            <p className="mt-4 text-lg">{isEnhancing ? 'Enhancing your image...' : 'Generating your image...'}</p>
            <div className="h-5 mt-2">
              {loadingMessage && (
                <p className="text-sm text-gray-400">
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
                transform: `translate(${position?.x || 0}px, ${position?.y || 0}px) scale(${zoom || 1}) rotate(${rotation || 0}deg)`,
                cursor: (zoom && zoom > 1) ? (isDragging ? 'grabbing' : 'grab') : 'default',
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
      
      {/* --- START: FIX for Control Placement --- */}
      {/* The controls are now outside the image container, as a direct child of the flex-col layout. */}
      {imageUrl && !showLoading && onZoomChange && (
          <div className="self-center bg-gray-900/70 backdrop-blur-sm rounded-full p-1 flex items-center gap-1 shadow-lg">
              <button onClick={() => onZoomChange(Math.max(1, (zoom || 1) - 0.1))} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors" aria-label="Zoom out">
                  <ZoomOutIcon className="w-5 h-5" />
              </button>
              <input 
                  type="range" 
                  min="1" 
                  max="3" 
                  step="0.05" 
                  value={zoom} 
                  onChange={(e) => onZoomChange(parseFloat(e.target.value))}
                  className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm mx-1"
                  aria-label="Zoom level"
              />
              <button onClick={() => onZoomChange(Math.min(3, (zoom || 1) + 0.1))} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors" aria-label="Zoom in">
                  <ZoomInIcon className="w-5 h-5" />
              </button>
              <div className="w-px h-5 bg-gray-600 mx-1"></div>
              <button onClick={handleRotate} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors" aria-label="Rotate clockwise">
                  <RotateIcon className="w-5 h-5" />
              </button>
              <button onClick={handleReset} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors" aria-label="Reset transformations">
                  <ResetZoomIcon className="w-5 h-5" />
              </button>
          </div>
      )}
      {/* --- END: FIX for Control Placement --- */}

      {imageUrl && onEnhanceClick && (
        <button
          onClick={onEnhanceClick}
          disabled={isLoading || isEnhancing}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105"
        >
          {isEnhancing ? (
            <>
              <Spinner /> Enhancing...
            </>
          ) : (
            'Enhance & Download'
          )}
        </button>
      )}
    </div>
  );
};