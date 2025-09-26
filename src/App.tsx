import React, { useState, useCallback, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { TextInput } from './components/TextInput';
import { Spinner } from './components/Spinner';
import { generateFashionImage, enhanceImage, removeBackground } from './services/geminiService';
import { Header } from './components/Header';
import { ImageDisplay } from './components/ImageDisplay';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { MagicWandIcon } from './components/icons/MagicWandIcon';
import { PortraitIcon } from './components/icons/PortraitIcon';
import { LandscapeIcon } from './components/icons/LandscapeIcon';
import { useHistory } from './hooks/useHistory';
import { LightbulbIcon } from './components/icons/LightbulbIcon';

// Centralized type definitions for settings
export interface ColorGradingSettings {
  preset: 'none' | 'vintage' | 'warm' | 'cool' | 'vivid' | 'muted' | 'custom';
  saturation: number;
  contrast: number;
  brightness: number;
  warmth: number;
}

export interface EnhancementSettings {
  denoise: boolean;
  textureBoost: number;
  clarity: number;
}

export interface TransformationState {
  zoom: number;
  rotation: number;
  position: { x: number; y: number };
}

export interface ResolutionSettings {
  preset: 'original' | 'hd' | '4k' | 'square' | 'portrait' | 'landscape' | 'custom';
  width: number | null;
  height: number | null;
  aspectRatioLocked: boolean;
}

export interface ExportSettings {
  format: 'png' | 'jpeg';
  quality: number;
  colorGrading: ColorGradingSettings;
  resolution: ResolutionSettings;
  enhancement: EnhancementSettings;
}

export interface AppSettings {
  defaultScenePrompt: string;
  exportSettings: ExportSettings;
}

const SETTINGS_STORAGE_KEY = 'aiFashionStudioAppSettings';

const PROMPT_IDEAS = [
    "A model wearing a flowing red dress, standing on a black sand beach at dusk, moody lighting.",
    "Close-up portrait of a person with intricate face paint, wearing futuristic neon-lit clothing in a cyberpunk city alley.",
    "A person in a vintage 1920s suit, leaning against a classic car on a misty cobblestone street at night.",
    "A model in a high-fashion, avant-garde outfit made of recycled materials, posing in a minimalist concrete skatepark.",
    "A full-body shot of a dancer in mid-air, wearing a vibrant, multi-layered tulle dress in a grand, sunlit ballroom.",
    "A person wearing rugged hiking gear, looking out over a dramatic mountain vista at sunrise, lens flare.",
    "A whimsical scene of a model in a pastel-colored gown, having a tea party with a robot in an overgrown garden.",
    "A powerful shot of a model in a sharp, tailored business suit, walking through a bustling financial district, motion blur.",
    "A surreal image of a person whose clothing appears to be made of water, standing in a shallow, reflective pool inside a cave.",
    "A model wearing a bohemian-style outfit, playing a guitar in a field of wildflowers during the golden hour.",
];


export const getDefaultSettings = (): AppSettings => ({
  defaultScenePrompt: 'A woman standing confidently on a balcony overlooking the sea at sunset.',
  exportSettings: {
    format: 'jpeg',
    quality: 92,
    colorGrading: {
      preset: 'none',
      saturation: 100,
      contrast: 100,
      brightness: 100,
      warmth: 0,
    },
    resolution: {
      preset: 'original',
      width: null,
      height: null,
      aspectRatioLocked: true,
    },
    enhancement: {
      denoise: true,
      textureBoost: 50,
      clarity: 50,
    }
  }
});

const loadInitialSettings = (): AppSettings => {
  const defaultSettings = getDefaultSettings();
  try {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!savedSettings) return defaultSettings;
    
    const parsed = JSON.parse(savedSettings);

    // Deep merge saved settings with defaults to ensure all keys exist
    const mergedSettings: AppSettings = {
      ...defaultSettings,
      ...parsed,
      exportSettings: {
        ...defaultSettings.exportSettings,
        ...(parsed.exportSettings || {}),
        colorGrading: {
          ...defaultSettings.exportSettings.colorGrading,
          ...(parsed.exportSettings?.colorGrading || {}),
        },
        resolution: {
          ...defaultSettings.exportSettings.resolution,
          ...(parsed.exportSettings?.resolution || {}),
        },
        enhancement: {
          ...defaultSettings.exportSettings.enhancement,
          ...(parsed.exportSettings?.enhancement || {}),
        }
      }
    };
    return mergedSettings;

  } catch (error) {
    console.error("Could not load settings, using defaults:", error);
  }
  return defaultSettings;
};

const getCanvasFilter = (settings: ColorGradingSettings): string => {
  const { saturation, contrast, brightness, warmth } = settings;
  let filterString = '';
  
  filterString += `saturate(${saturation}%) `;
  filterString += `contrast(${contrast}%) `;
  filterString += `brightness(${brightness}%) `;
  filterString += `sepia(${warmth}%)`;

  return filterString.trim();
};

const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
      throw new Error('Could not parse mime type from data URL');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

const initialTransformState: TransformationState = {
  zoom: 1,
  rotation: 0,
  position: { x: 0, y: 0 },
};

const App: React.FC = () => {
  const [appSettings, setAppSettings] = useState<AppSettings>(loadInitialSettings);
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [backgroundRefImage, setBackgroundRefImage] = useState<File | null>(null);
  const [backgroundRefImageUrl, setBackgroundRefImageUrl] = useState<string | null>(null);
  const [scenePrompt, setScenePrompt] = useState<string>(appSettings.defaultScenePrompt);
  const [style, setStyle] = useState<string>('Photorealistic');
  const [aspectRatio, setAspectRatio] = useState<'portrait' | 'landscape'>('portrait');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [isRemovingBackground, setIsRemovingBackground] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [promptIdeaIndex, setPromptIdeaIndex] = useState(0);

  const {
    state: transform,
    setState: setTransform,
    undo: undoTransform,
    redo: redoTransform,
    reset: resetTransform,
    canUndo: canUndoTransform,
    canRedo: canRedoTransform,
  } = useHistory<TransformationState>(initialTransformState);
  
  // Memory management for object URLs
  useEffect(() => {
    // This is a cleanup function that will be called when the component unmounts.
    return () => {
      if (sourceImageUrl) {
        URL.revokeObjectURL(sourceImageUrl);
      }
      if (backgroundRefImageUrl) {
        URL.revokeObjectURL(backgroundRefImageUrl);
      }
    };
  }, [sourceImageUrl, backgroundRefImageUrl]);

  const setExportSettings = (updater: React.SetStateAction<ExportSettings>) => {
    setAppSettings(prev => {
        const newExportSettings = typeof updater === 'function' ? updater(prev.exportSettings) : updater;
        return { ...prev, exportSettings: newExportSettings };
    });
  };
  
  const handleImageUpload = (file: File) => {
    if (sourceImageUrl) {
        URL.revokeObjectURL(sourceImageUrl);
    }
    setSourceImage(file);
    setSourceImageUrl(URL.createObjectURL(file));
    setGeneratedImage(null); // Clear previous generation on new upload
  };

  const handleClearSourceImage = () => {
    if (sourceImageUrl) {
      URL.revokeObjectURL(sourceImageUrl);
    }
    setSourceImage(null);
    setSourceImageUrl(null);
    setGeneratedImage(null);
  }

  const handleBackgroundRefUpload = (file: File) => {
    if (backgroundRefImageUrl) {
        URL.revokeObjectURL(backgroundRefImageUrl);
    }
    setBackgroundRefImage(file);
    setBackgroundRefImageUrl(URL.createObjectURL(file));
  };

  const handleClearBackgroundRef = () => {
    if (backgroundRefImageUrl) {
      URL.revokeObjectURL(backgroundRefImageUrl);
    }
    setBackgroundRefImage(null);
    setBackgroundRefImageUrl(null);
  };

  const handleGetPromptIdea = () => {
    setScenePrompt(PROMPT_IDEAS[promptIdeaIndex]);
    setPromptIdeaIndex((prevIndex) => (prevIndex + 1) % PROMPT_IDEAS.length);
  };

  const handleRemoveBackground = useCallback(async () => {
    if (!sourceImage) {
      setError('Please upload an image first to remove the background.');
      return;
    }

    setIsRemovingBackground(true);
    setError(null);

    try {
      const resultDataUrl = await removeBackground(sourceImage);
      const resultFile = dataURLtoFile(resultDataUrl, `bg_removed_${sourceImage.name}.png`);
      setSourceImage(resultFile);
      setSourceImageUrl(resultDataUrl);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to remove background.');
    } finally {
      setIsRemovingBackground(false);
    }
  }, [sourceImage]);

  const handleGenerate = useCallback(async () => {
    if (!sourceImage) {
      setError('Please upload a source image first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const imageUrl = await generateFashionImage(sourceImage, scenePrompt, aspectRatio, backgroundRefImage, style);
      setGeneratedImage(imageUrl);
      resetTransform(initialTransformState);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [sourceImage, scenePrompt, aspectRatio, backgroundRefImage, style, resetTransform]);

  const downloadImage = useCallback((dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const applyTransformationsToImage = useCallback((
    baseImageUrl: string,
    transformState: TransformationState,
    containerSize: { width: number; height: number }
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Robust check for valid container size at the beginning
      if (!containerSize || containerSize.width <= 0 || containerSize.height <= 0) {
        return reject(new Error('Invalid container dimensions for transformation. Please ensure the image display is visible.'));
      }
  
      const img = new Image();
      img.onload = () => {
        try { // Wrap the entire canvas logic in a try/catch block for safety
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Could not get canvas context for transformation.'));
          }
          
          const { naturalWidth: w, naturalHeight: h } = img;
          const { zoom, rotation, position } = transformState;
  
          const containerAspect = containerSize.width / containerSize.height;
          const imageAspect = w / h;
          
          let renderedWidth;
          if (imageAspect > containerAspect) {
              renderedWidth = containerSize.width;
          } else {
              const renderedHeight = containerSize.height;
              renderedWidth = renderedHeight * imageAspect;
          }
  
          // Add a guard against division by zero or invalid calculations
          if (renderedWidth <= 0 || !isFinite(renderedWidth)) {
              return reject(new Error(`Calculated an invalid rendered width: ${renderedWidth}. Cannot apply transformations.`));
          }
  
          const scaleFactor = w / renderedWidth;
  
          canvas.width = w;
          canvas.height = h;
  
          ctx.translate(w / 2, h / 2);
          ctx.translate(position.x * scaleFactor, position.y * scaleFactor);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.scale(zoom, zoom);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          
          const dataUrl = canvas.toDataURL('image/png');
  
          // Final check to ensure the canvas didn't produce an empty image
          if (!dataUrl || dataUrl === 'data:,') {
              return reject(new Error('Image transformation resulted in an empty image.'));
          }
          
          resolve(dataUrl);
        } catch (e) {
            reject(e instanceof Error ? e : new Error('An unknown error occurred during image transformation.'));
        }
      };
      img.onerror = () => reject(new Error('Failed to load the generated image for applying transformations. It might be corrupt.'));
      img.src = baseImageUrl;
    });
  }, []);

  const handleFinalizeAndDownload = useCallback(async () => {
    if (!generatedImage) {
      setError('No generated image to finalize.');
      return;
    }
    
    const container = document.querySelector<HTMLDivElement>('#ai-generated-image-display .generated-image-container');
    if (!container) {
        setError("Could not find the image display area to process edits. Please try again.");
        return;
    }
    
    const rect = container.getBoundingClientRect();
    const containerSize = { width: rect.width, height: rect.height };
    
    // Explicitly check for zero dimensions which can cause calculation errors
    if (containerSize.width === 0 || containerSize.height === 0) {
      setError("Image display area has zero dimensions, cannot process edits. Please wait for the UI to fully load and try again.");
      return;
    }
  
    setIsEnhancing(true);
    setError(null);
    setShowExportModal(false);
  
    try {
      const latestSettings = { ...appSettings };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(latestSettings));

      // Step 1: Apply user edits (zoom, rotate, pan) before enhancement
      const editedImageDataUrl = await applyTransformationsToImage(generatedImage, transform, containerSize);
  
      // Step 2: Enhance the edited image
      const enhancedImageUrl = await enhanceImage(editedImageDataUrl, latestSettings.exportSettings.enhancement);
  
      // Step 3: Apply final processing and trigger download in a robust promise
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Image loading timed out. The enhancement API may have returned an invalid image."));
        }, 15000); // 15s timeout

        const img = new Image();
        img.onload = () => {
          clearTimeout(timeout);
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              return reject(new Error('Could not get canvas context for download.'));
            }
            
            const originalWidth = img.width;
            const originalHeight = img.height;
            let targetWidth = originalWidth;
            let targetHeight = originalHeight;
            const originalAspectRatio = originalWidth / originalHeight;
            let requiresCropping = false;
      
            switch (latestSettings.exportSettings.resolution.preset) {
              case 'hd':
                if (originalAspectRatio >= 1) { // Landscape or square
                  targetWidth = 1920;
                  targetHeight = 1920 / originalAspectRatio;
                } else { // Portrait
                  targetHeight = 1920;
                  targetWidth = 1920 * originalAspectRatio;
                }
                break;
              case '4k':
                if (originalAspectRatio >= 1) { // Landscape or square
                  targetWidth = 3840;
                  targetHeight = 3840 / originalAspectRatio;
                } else { // Portrait
                  targetHeight = 3840;
                  targetWidth = 3840 * originalAspectRatio;
                }
                break;
              case 'square':
                targetWidth = 1080;
                targetHeight = 1080;
                requiresCropping = true;
                break;
              case 'portrait':
                targetWidth = 1080;
                targetHeight = 1920;
                requiresCropping = true;
                break;
              case 'landscape':
                targetWidth = 1920;
                targetHeight = 1080;
                requiresCropping = true;
                break;
              case 'custom':
                targetWidth = latestSettings.exportSettings.resolution.width || originalWidth;
                targetHeight = latestSettings.exportSettings.resolution.height || originalHeight;
                if (Math.abs((targetWidth / targetHeight) - originalAspectRatio) > 0.01) {
                  requiresCropping = true;
                }
                break;
              case 'original':
              default:
                break;
            }
      
            canvas.width = Math.round(targetWidth);
            canvas.height = Math.round(targetHeight);
            
            ctx.filter = getCanvasFilter(latestSettings.exportSettings.colorGrading);
      
            if (requiresCropping) {
              const canvasAspectRatio = canvas.width / canvas.height;
              let sx = 0, sy = 0, sWidth = originalWidth, sHeight = originalHeight;
      
              if (originalAspectRatio > canvasAspectRatio) {
                sWidth = originalHeight * canvasAspectRatio;
                sx = (originalWidth - sWidth) / 2;
              } else if (originalAspectRatio < canvasAspectRatio) {
                sHeight = originalWidth / canvasAspectRatio;
                sy = (originalHeight - sHeight) / 2;
              }
              ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
            } else {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
      
            let dataUrl: string;
            let filename: string;
      
            if (latestSettings.exportSettings.format === 'png') {
              dataUrl = canvas.toDataURL('image/png');
              filename = 'ai-fashion-photoshoot-final.png';
            } else {
              const qualityValue = latestSettings.exportSettings.quality / 100;
              dataUrl = canvas.toDataURL('image/jpeg', qualityValue);
              filename = 'ai-fashion-photoshoot-final.jpeg';
            }
            
            if (!dataUrl || dataUrl === 'data:,') {
              return reject(new Error("Final processing failed: generated empty image data."));
            }

            downloadImage(dataUrl, filename);
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load the enhanced image for final processing. It might be corrupt.'));
        };
        img.src = enhancedImageUrl;
      });
  
    } catch (err) {
      console.error("Finalization failed:", err);
      setError(err instanceof Error ? err.message : 'Failed to finalize and download image.');
    } finally {
      setIsEnhancing(false);
    }
  }, [generatedImage, appSettings, transform, applyTransformationsToImage, downloadImage]);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    setScenePrompt(newSettings.defaultScenePrompt);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error("Could not save settings:", error);
    }
    setShowSettingsModal(false);
  };

  const anyLoading = isLoading || isEnhancing || isRemovingBackground;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      <Header onSettingsClick={() => setShowSettingsModal(true)} />
      <main className="container mx-auto p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Column */}
          <div className="lg:col-span-4 bg-gray-800/50 rounded-2xl shadow-lg p-6 flex flex-col gap-6 h-fit">
            <h2 className="text-xl font-bold text-cyan-400 border-b border-gray-700 pb-3">1. Upload Your Model</h2>
            <ImageUploader id="source-image-uploader" onImageUpload={handleImageUpload} imageUrl={sourceImageUrl} onClear={handleClearSourceImage} />
            
            <button
              onClick={handleRemoveBackground}
              disabled={!sourceImage || anyLoading}
              className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              {isRemovingBackground ? (
                <>
                  <Spinner /> Removing Background...
                </>
              ) : (
                <>
                  <MagicWandIcon className="w-5 h-5" /> Remove Background
                </>
              )}
            </button>
            
            <h2 className="text-xl font-bold text-cyan-400 border-b border-gray-700 pb-3 mt-4">2. Design the Photoshoot</h2>
            <div className="relative">
              <TextInput
                label="Describe the scene and pose"
                value={scenePrompt}
                onChange={(e) => setScenePrompt(e.target.value)}
                placeholder="e.g., A woman standing confidently on a balcony overlooking the sea at sunset."
                rows={4}
              />
              <button
                onClick={handleGetPromptIdea}
                className="absolute top-0 right-0 p-2 text-gray-400 hover:text-cyan-400 transition-colors"
                aria-label="Get a prompt idea"
                title="Get a prompt idea"
              >
                <LightbulbIcon className="w-5 h-5" />
              </button>
            </div>


            <div>
              <label htmlFor="style-selector" className="block text-sm font-medium text-gray-300 mb-2">Artistic Style</label>
              <select
                id="style-selector"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-200"
              >
                <option>Photorealistic</option>
                <option>Cinematic</option>
                <option>Vintage Film</option>
                <option>Minimalist</option>
                <option>Futuristic</option>
                <option>Fantasy Art</option>
                <option>Watercolor</option>
                <option>Noir</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAspectRatio('portrait')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg transition-colors text-sm font-semibold ${aspectRatio === 'portrait' ? 'bg-cyan-500 text-gray-900' : 'bg-gray-700/50 hover:bg-gray-600/50'}`}
                >
                  <PortraitIcon className="w-4 h-4" />
                  <span>Portrait (9:16)</span>
                </button>
                <button
                  onClick={() => setAspectRatio('landscape')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg transition-colors text-sm font-semibold ${aspectRatio === 'landscape' ? 'bg-cyan-500 text-gray-900' : 'bg-gray-700/50 hover:bg-gray-600/50'}`}
                >
                  <LandscapeIcon className="w-4 h-4" />
                  <span>Landscape (16:9)</span>
                </button>
              </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Background Reference (Optional)</label>
                <ImageUploader
                    id="background-ref-uploader"
                    onImageUpload={handleBackgroundRefUpload}
                    imageUrl={backgroundRefImageUrl}
                    onClear={handleClearBackgroundRef}
                />
                <p className="text-xs text-gray-500 text-center mt-2">Use an image for background style inspiration.</p>
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={anyLoading || !sourceImage}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              {isLoading ? (
                <>
                  <Spinner /> Generating...
                </>
              ) : (
                'Generate Image'
              )}
            </button>
            {error && <p className="text-red-400 text-sm mt-2 text-center">{error}</p>}
          </div>

          {/* Display Column */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <ImageDisplay title="Original Image" imageUrl={sourceImageUrl} />
            <ImageDisplay 
              id="ai-generated-image-display"
              title="AI Generated Image" 
              imageUrl={generatedImage} 
              isLoading={isLoading}
              isEnhancing={isEnhancing}
              onEnhanceClick={() => setShowExportModal(true)}
              transform={transform}
              onTransformChange={setTransform}
              onUndo={undoTransform}
              onRedo={redoTransform}
              canUndo={canUndoTransform}
              canRedo={canRedoTransform}
              onReset={() => resetTransform(initialTransformState)}
            />
          </div>
        </div>
      </main>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onDownload={handleFinalizeAndDownload}
        baseImageUrl={generatedImage}
        settings={appSettings.exportSettings}
        setSettings={setExportSettings}
        isProcessing={isEnhancing}
      />
      
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleSaveSettings}
        currentSettings={appSettings}
      />
    </div>
  );
};

export default App;