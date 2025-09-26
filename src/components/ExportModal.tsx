import React, { useState, useEffect } from 'react';
import { LockIcon } from './icons/LockIcon';
import type { ExportSettings, ColorGradingSettings, ResolutionSettings } from '../App';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
  baseImageUrl: string | null;
  settings: ExportSettings;
  setSettings: React.Dispatch<React.SetStateAction<ExportSettings>>;
}

const getCanvasFilter = (settings: ColorGradingSettings): string => {
  const { saturation, contrast, brightness, warmth } = settings;
  let filterString = '';
  
  filterString += `saturate(${saturation}%) `;
  filterString += `contrast(${contrast}%) `;
  filterString += `brightness(${brightness}%) `;
  filterString += `sepia(${warmth}%)`;

  return filterString.trim();
};

const PRESET_VALUES: Record<Exclude<ColorGradingSettings['preset'], 'custom'>, Omit<ColorGradingSettings, 'preset'>> = {
  none: { saturation: 100, contrast: 100, brightness: 100, warmth: 0 },
  vintage: { saturation: 100, contrast: 100, brightness: 100, warmth: 40 },
  warm: { saturation: 110, contrast: 100, brightness: 100, warmth: 20 },
  cool: { saturation: 95, contrast: 100, brightness: 105, warmth: 0 },
  vivid: { saturation: 150, contrast: 110, brightness: 100, warmth: 5 },
  muted: { saturation: 50, contrast: 95, brightness: 100, warmth: 0 },
};

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onDownload,
  baseImageUrl,
  settings,
  setSettings,
}) => {
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);

  const updateSetting = <K extends keyof ExportSettings>(key: K, value: ExportSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateResolution = <K extends keyof ResolutionSettings>(key: K, value: ResolutionSettings[K]) => {
    setSettings(prev => {
      let newRes = { ...prev.resolution, [key]: value };

      if (key === 'preset' && value !== 'custom') {
        newRes.width = null;
        newRes.height = null;
      }
      
      if (originalDimensions) {
        const aspectRatio = originalDimensions.width / originalDimensions.height;
        if (key === 'width' && newRes.aspectRatioLocked) {
          newRes.height = value ? Math.round(Number(value) / aspectRatio) : null;
        } else if (key === 'height' && newRes.aspectRatioLocked) {
          newRes.width = value ? Math.round(Number(value) * aspectRatio) : null;
        }
      }

      return { ...prev, resolution: newRes };
    });
  };

  const updateColorGrading = <K extends keyof ColorGradingSettings>(key: K, value: ColorGradingSettings[K]) => {
    setSettings(prev => {
      // If a preset is selected, apply its values
      if (key === 'preset' && value !== 'custom') {
        const presetKey = value as Exclude<ColorGradingSettings['preset'], 'custom'>;
        const presetValues = PRESET_VALUES[presetKey];
        return {
          ...prev,
          colorGrading: {
            preset: presetKey,
            ...presetValues,
          },
        };
      }
      
      // If a slider is moved, update its value and set the preset to 'custom'
      const newColorGrading = { 
          ...prev.colorGrading, 
          [key]: value,
          preset: 'custom' as const,
      };
      
      return {
        ...prev,
        colorGrading: newColorGrading,
      };
    });
  };

  useEffect(() => {
    if (baseImageUrl) {
      const img = new Image();
      img.onload = () => setOriginalDimensions({ width: img.width, height: img.height });
      img.src = baseImageUrl;
    }
  }, [baseImageUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800/90 rounded-2xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-cyan-400">Enhance & Export Image</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700 transition-colors">&times;</button>
        </header>

        <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 overflow-hidden">
          {/* Preview Column */}
          <div className="lg:col-span-2 bg-gray-900/50 rounded-lg flex items-center justify-center p-4 relative overflow-hidden">
            {baseImageUrl ? (
                <img
                    src={baseImageUrl}
                    alt="Enhanced Preview"
                    className="max-w-full max-h-full object-contain transition-all duration-300"
                    style={{ filter: getCanvasFilter(settings.colorGrading) }}
                />
            ) : (
                <div className="text-gray-500">Loading preview...</div>
            )}
          </div>
          
          {/* Settings Column */}
          <div className="flex flex-col gap-4 overflow-y-auto pr-2">
            <div className="bg-gray-700/40 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-400 mb-3">Export Format</h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                 <button onClick={() => updateSetting('format', 'jpeg')} className={`p-2 rounded transition-colors text-sm font-semibold ${settings.format === 'jpeg' ? 'bg-cyan-500 text-gray-900' : 'bg-gray-600 hover:bg-gray-500'}`}>JPEG</button>
                 <button onClick={() => updateSetting('format', 'png')} className={`p-2 rounded transition-colors text-sm font-semibold ${settings.format === 'png' ? 'bg-cyan-500 text-gray-900' : 'bg-gray-600 hover:bg-gray-500'}`}>PNG</button>
              </div>
              {settings.format === 'jpeg' && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-sm">
                    <label htmlFor="quality" className="font-medium text-gray-300">Quality</label>
                    <span className="px-2 py-1 text-xs rounded bg-gray-600">{settings.quality}</span>
                  </div>
                  <input id="quality" type="range" min="10" max="100" value={settings.quality} onChange={(e) => updateSetting('quality', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm"/>
                </div>
              )}
            </div>
            
            <div className="bg-gray-700/40 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-400 mb-3">Resolution</h3>
                <select value={settings.resolution.preset} onChange={e => updateResolution('preset', e.target.value as ResolutionSettings['preset'])} className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-200">
                    <option value="original">Original ({originalDimensions ? `${originalDimensions.width} × ${originalDimensions.height}` : '...'})</option>
                    <option value="hd">HD (1920px)</option>
                    <option value="4k">4K (3840px)</option>
                    <option value="square">Square (1:1)</option>
                    <option value="portrait">Portrait (9:16)</option>
                    <option value="landscape">Landscape (16:9)</option>
                    <option value="custom">Custom</option>
                </select>
                {settings.resolution.preset === 'custom' && (
                    <div className="flex items-center gap-2 mt-3">
                        <input type="number" value={settings.resolution.width ?? ''} onChange={e => updateResolution('width', e.target.value ? parseInt(e.target.value, 10) : null)} placeholder="W" className="w-full p-2 bg-gray-600 border border-gray-500 rounded" />
                        <button onClick={() => updateResolution('aspectRatioLocked', !settings.resolution.aspectRatioLocked)} className="p-2 flex-shrink-0 text-gray-400 hover:text-white transition-colors">
                            <LockIcon locked={settings.resolution.aspectRatioLocked} className="w-5 h-5" />
                        </button>
                        <input type="number" value={settings.resolution.height ?? ''} onChange={e => updateResolution('height', e.target.value ? parseInt(e.target.value, 10) : null)} placeholder="H" className="w-full p-2 bg-gray-600 border border-gray-500 rounded" />
                    </div>
                )}
            </div>
            
            <div className="bg-gray-700/40 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-400 mb-3">Color Grading</h3>
                <select value={settings.colorGrading.preset} onChange={e => updateColorGrading('preset', e.target.value as ColorGradingSettings['preset'])} className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-200">
                    <option value="custom" disabled hidden>Custom</option>
                    <option value="none">None</option>
                    <option value="vintage">Vintage</option>
                    <option value="warm">Warm</option>
                    <option value="cool">Cool</option>
                    <option value="vivid">Vivid</option>
                    <option value="muted">Muted</option>
                </select>
                <div className="flex flex-col gap-3 mt-4">
                  <div>
                    <label htmlFor="exposure" className="text-sm flex justify-between"><span>Exposure</span> <span>{settings.colorGrading.brightness - 100}</span></label>
                    <input id="exposure" type="range" min="50" max="150" value={settings.colorGrading.brightness} onChange={e => updateColorGrading('brightness', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"/>
                  </div>
                  <div>
                    <label htmlFor="warmth" className="text-sm flex justify-between"><span>Warmth</span> <span>{settings.colorGrading.warmth}</span></label>
                    <input id="warmth" type="range" min="0" max="100" value={settings.colorGrading.warmth} onChange={e => updateColorGrading('warmth', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"/>
                  </div>
                  <div>
                    <label htmlFor="saturation" className="text-sm flex justify-between"><span>Saturation</span> <span>{settings.colorGrading.saturation}%</span></label>
                    <input id="saturation" type="range" min="0" max="200" value={settings.colorGrading.saturation} onChange={e => updateColorGrading('saturation', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"/>
                  </div>
                  <div>
                    <label htmlFor="contrast" className="text-sm flex justify-between"><span>Contrast</span> <span>{settings.colorGrading.contrast}%</span></label>
                    <input id="contrast" type="range" min="0" max="200" value={settings.colorGrading.contrast} onChange={e => updateColorGrading('contrast', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"/>
                  </div>
                </div>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end p-4 border-t border-gray-700 bg-gray-800 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-gray-300 rounded hover:bg-gray-700 mr-2 transition-colors">Cancel</button>
            <button onClick={onDownload} className="px-6 py-2 bg-cyan-500 text-gray-900 font-bold rounded hover:bg-cyan-400 transition-transform transform hover:scale-105">Download Image</button>
        </footer>
      </div>
    </div>
  );
};