import React, { useState, useCallback } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { TextInput } from './components/TextInput';
import { Spinner } from './components/Spinner';
import { generateFashionImage, enhanceImage, removeBackground, isApiKeyAvailable, analyzeImageForPrompt } from './services/geminiService';
import { Header } from './components/Header';
import { ImageDisplay } from './components/ImageDisplay';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { MagicWandIcon } from './components/icons/MagicWandIcon';
import { ApiErrorDisplay } from './components/ApiErrorDisplay';
import { LightbulbIcon } from './components/icons/LightbulbIcon';
import { useHistory } from './hooks/useHistory';
import { PortraitIcon } from './components/icons/PortraitIcon';
import { LandscapeIcon } from './components/icons/LandscapeIcon';

// Centralized type definitions for settings
export interface ColorGradingSettings {
  preset: 'none' | 'vintage' | 'warm' | 'cool' | 'vivid' | 'muted' | 'custom';
  saturation: number;
  contrast: number;
  brightness: number;
  warmth: number;
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
}

export interface AppSettings {
  defaultScenePrompt: string;
  exportSettings: ExportSettings;
}

// Transformation state for image editing
export interface TransformationState {
  zoom: number;
  rotation: number;
  position: { x: number; y: number };
}

const initialTransformationState: TransformationState = {
  zoom: 1,
  rotation: 0,
  position: { x: 0, y: 0 },
};

const SETTINGS_STORAGE_KEY = 'aiFashionStudioAppSettings';

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

const ART_STYLES = [
  "Photorealistic", "Cinematic", "Vintage Film", "Anime", 
  "Fantasy Art", "Watercolor", "Impressionistic", "Art Deco", "Minimalist",
  "Cyberpunk", "Surrealist", "Gothic"
];

const App: React.FC = () => {
  const [isApiConfigured] = useState<boolean>(isApiKeyAvailable());
  const [appSettings, setAppSettings] = useState<AppSettings>(loadInitialSettings);
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [sceneImage, setSceneImage] = useState<File | null>(null);
  const [sceneImageUrl, setSceneImageUrl] = useState<string | null>(null);
  const [scenePrompt, setScenePrompt] = useState<string>(appSettings.defaultScenePrompt);
  const [style, setStyle] = useState<string>(ART_STYLES[0]);
  const [aspectRatio, setAspectRatio] = useState<'portrait' | 'landscape'>('portrait');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [isRemovingBackground, setIsRemovingBackground] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // State for image editing tools with undo/redo history
  const {
    state: transform,
    setState: setTransform,
    undo: undoTransform,
    redo: redoTransform,
    reset: resetTransform,
    canUndo: canUndoTransform,
    canRedo: canRedoTransform,
  } = useHistory<TransformationState>(initialTransformationState);
  
  const setExportSettings = (updater: React.SetStateAction<ExportSettings>) => {
    setAppSettings(prev => {
        const newExportSettings = typeof updater === 'function' ? updater(prev.exportSettings) : updater;
        return { ...prev, exportSettings: newExportSettings };
    });
  };

  const handleImageUpload = (file: File) => {
    setSourceImage(file);
    setSourceImageUrl(URL.createObjectURL(file));
    setGeneratedImage(null); // Clear previous generation on new upload
  };

  const handleSceneImageUpload = (file: File) => {
    setSceneImage(file);
    setSceneImageUrl(URL.createObjectURL(file));
  };
  
  const handleClearSceneImage = () => {
    setSceneImage(null);
    if (sceneImageUrl) {
      URL.revokeObjectURL(sceneImageUrl);
    }
    setSceneImageUrl(null);
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

  const handleAnalyzeImage = useCallback(async () => {
    if (!sourceImage) {
      setError('Please upload a source image to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const description = await analyzeImageForPrompt(sourceImage);
      setScenePrompt(prev => `${description}. ${prev}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to analyze image.');
    } finally {
      setIsAnalyzing(false);
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
      const imageUrl = await generateFashionImage({
        imageFile: sourceImage,
        sceneImage,
        scenePrompt,
        style,
        aspectRatio,
      });
      setGeneratedImage(imageUrl);
      // Reset editing transformations for the new image
      resetTransform(initialTransformationState);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [sourceImage, sceneImage, scenePrompt, style, aspectRatio, resetTransform]);

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEnhance = useCallback(async () => {
    if (!generatedImage) {
      setError('No generated image to enhance.');
      return;
    }
  
    setIsEnhancing(true);
    setError(null);
  
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = generatedImage;
    img.onload = async () => {
      try {
        const container = document.querySelector('.generated-image-container');
        if (!container) {
          throw new Error("Could not find image container for processing.");
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error("Could not get canvas context.");
        }

        const containerAspect = container.clientWidth / container.clientHeight;
        const imageAspect = img.naturalWidth / img.naturalHeight;
        let renderedWidth;
        if (imageAspect > containerAspect) {
          renderedWidth = container.clientWidth;
        } else {
          renderedWidth = container.clientHeight * imageAspect;
        }

        const scaleFactor = img.naturalWidth / renderedWidth;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.translate(transform.position.x * scaleFactor, transform.position.y * scaleFactor);
        ctx.rotate((transform.rotation * Math.PI) / 180);
        ctx.scale(transform.zoom, transform.zoom);
        
        ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        
        const editedImageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
  
        const enhancedImageUrl = await enhanceImage(editedImageDataUrl);
        setEnhancedImage(enhancedImageUrl);
        setShowExportModal(true);
      } catch (err) {
        console.error("Enhancement failed:", err);
        setError(err instanceof Error ? err.message : 'Failed to enhance image.');
      } finally {
        setIsEnhancing(false);
      }
    };
    img.onerror = () => {
      setError('Failed to load generated image for enhancement.');
      setIsEnhancing(false);
    };
  }, [generatedImage, transform]);
  
  const handleFinalDownload = () => {
    if (!enhancedImage) {
      setError('No enhanced image available to download.');
      return;
    }
    
    try {
      const allSettings = loadInitialSettings();
      allSettings.exportSettings = appSettings.exportSettings;
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(allSettings));
    } catch (error) {
      console.error("Could not save settings:", error);
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Could not process image for download.');
        setShowExportModal(false);
        return;
      }
      
      const originalWidth = img.width;
      const originalHeight = img.height;
      let targetWidth = originalWidth;
      let targetHeight = originalHeight;
      const originalAspectRatio = originalWidth / originalHeight;
      let requiresCropping = false;

      switch (appSettings.exportSettings.resolution.preset) {
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
          targetWidth = appSettings.exportSettings.resolution.width || originalWidth;
          targetHeight = appSettings.exportSettings.resolution.height || originalHeight;
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
      
      ctx.filter = getCanvasFilter(appSettings.exportSettings.colorGrading);

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

      if (appSettings.exportSettings.format === 'png') {
        dataUrl = canvas.toDataURL('image/png');
        filename = 'ai-fashion-photoshoot-enhanced.png';
      } else {
        const qualityValue = appSettings.exportSettings.quality / 100;
        dataUrl = canvas.toDataURL('image/jpeg', qualityValue);
        filename = 'ai-fashion-photoshoot-enhanced.jpeg';
      }
      
      downloadImage(dataUrl, filename);
      setShowExportModal(false);
    };
    img.onerror = () => {
        setError('Failed to load enhanced image for conversion.');
        setShowExportModal(false);
    }
    img.src = enhancedImage;
  };

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

  const anyLoading = isLoading || isEnhancing || isRemovingBackground || isAnalyzing;

  if (!isApiConfigured) {
    return <ApiErrorDisplay />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      <Header onSettingsClick={() => setShowSettingsModal(true)} />
      <main className="container mx-auto p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Column */}
          <div className="lg:col-span-4 bg-gray-800/50 rounded-2xl shadow-lg p-6 flex flex-col gap-6 h-fit">
            <h2 className="text-xl font-bold text-cyan-400 border-b border-gray-700 pb-3">1. Upload Your Model</h2>
            <ImageUploader id="model-uploader" onImageUpload={handleImageUpload} imageUrl={sourceImageUrl} />
            
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
            
            <div className="border-b border-gray-700 pb-3 mt-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-cyan-400">2. Describe the New Scene</h2>
              <button
                onClick={handleAnalyzeImage}
                disabled={!sourceImage || anyLoading || !!sceneImage}
                className="flex items-center gap-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600/50 disabled:cursor-not-allowed disabled:text-gray-500 text-cyan-300 font-semibold py-1 px-3 rounded-full transition-all duration-300"
                title={!!sceneImage ? "Analysis is disabled when a scene image is used." : "Analyze uploaded image to improve the prompt"}
              >
                {isAnalyzing ? (
                  <>
                    <Spinner className="w-4 h-4" /> Analyzing...
                  </>
                ) : (
                  <>
                    <LightbulbIcon className="w-4 h-4" /> Analyze & Suggest
                  </>
                )}
              </button>
            </div>
            <TextInput
              label="Describe the entire scene..."
              value={scenePrompt}
              onChange={(e) => setScenePrompt(e.target.value)}
              placeholder="e.g., A woman standing confidently on a balcony overlooking the sea at sunset."
              rows={4}
            />
             <div>
              <label htmlFor="style-select" className="block text-sm font-medium text-gray-300 mb-2">Artistic Style</label>
              <select 
                id="style-select"
                value={style}
                onChange={e => setStyle(e.target.value)}
                className="w-full p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-200"
              >
                {ART_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
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
                  <span>Dikey (9:16)</span>
                </button>
                <button
                  onClick={() => setAspectRatio('landscape')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg transition-colors text-sm font-semibold ${aspectRatio === 'landscape' ? 'bg-cyan-500 text-gray-900' : 'bg-gray-700/50 hover:bg-gray-600/50'}`}
                >
                  <LandscapeIcon className="w-4 h-4" />
                  <span>Yatay (16:9)</span>
                </button>
              </div>
            </div>

            <h2 className="text-xl font-bold text-cyan-400 border-b border-gray-700 pb-3 mt-4">3. (Optional) Upload a Scene</h2>
            <ImageUploader id="scene-uploader" onImageUpload={handleSceneImageUpload} imageUrl={sceneImageUrl} onClear={handleClearSceneImage} />


            <h2 className="text-xl font-bold text-cyan-400 border-b border-gray-700 pb-3 mt-4">4. Generate</h2>
            <button
              onClick={handleGenerate}
              disabled={anyLoading || !sourceImage}
              className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105"
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
              title="AI Generated Image" 
              imageUrl={generatedImage} 
              isLoading={isLoading}
              isEnhancing={isEnhancing}
              onEnhanceClick={handleEnhance}
              transform={transform}
              onTransformChange={setTransform}
              onUndo={undoTransform}
              onRedo={redoTransform}
              canUndo={canUndoTransform}
              canRedo={canRedoTransform}
              onReset={() => resetTransform(initialTransformationState)}
            />
          </div>
        </div>
      </main>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onDownload={handleFinalDownload}
        baseImageUrl={enhancedImage}
        settings={appSettings.exportSettings}
        setSettings={setExportSettings}
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
