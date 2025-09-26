import React, { useState, useEffect } from 'react';
import { LockIcon } from './icons/LockIcon';
import type { AppSettings, ExportSettings, ColorGradingSettings, ResolutionSettings } from '../App';
import { getDefaultSettings } from '../App';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newSettings: AppSettings) => void;
  currentSettings: AppSettings;
}

const PRESET_VALUES: Record<Exclude<ColorGradingSettings['preset'], 'custom'>, Omit<ColorGradingSettings, 'preset'>> = {
  none: { saturation: 100, contrast: 100, brightness: 100, warmth: 0 },
  vintage: { saturation: 100, contrast: 100, brightness: 100, warmth: 40 },
  warm: { saturation: 110, contrast: 100, brightness: 100, warmth: 20 },
  cool: { saturation: 95, contrast: 100, brightness: 105, warmth: 0 },
  vivid: { saturation: 150, contrast: 110, brightness: 100, warmth: 5 },
  muted: { saturation: 50, contrast: 95, brightness: 100, warmth: 0 },
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSettings,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(currentSettings);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(currentSettings);
    }
  }, [isOpen, currentSettings]);

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

  const handleSave = () => {
    onSave(localSettings);
  };
  
  const handleReset = () => {
    setLocalSettings(getDefaultSettings());
  }

  const updateExportSetting = <K extends keyof ExportSettings>(key: K, value: ExportSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, exportSettings: { ...prev.exportSettings, [key]: value } }));
  };

  const updateResolution = <K extends keyof ResolutionSettings>(key: K, value: ResolutionSettings[K]) => {
    setLocalSettings(prev => {
      let newRes = { ...prev.exportSettings.resolution, [key]: value };
      if (key === 'preset' && value !== 'custom') {
        newRes.width = null;
        newRes.height = null;
      }
      return { ...prev, exportSettings: { ...prev.exportSettings, resolution: newRes } };
    });
  };

  const updateColorGrading = <K extends keyof ColorGradingSettings>(key: K, value: ColorGradingSettings[K]) => {
    setLocalSettings(prev => {
      let newExportSettings = { ...prev.exportSettings };
      if (key === 'preset' && value !== 'custom') {
        const presetKey = value as Exclude<ColorGradingSettings['preset'], 'custom'>;
        newExportSettings.colorGrading = { preset: presetKey, ...PRESET_VALUES[presetKey] };
      } else {
        newExportSettings.colorGrading = { ...prev.exportSettings.colorGrading, [key]: value, preset: 'custom' as const };
      }
      return { ...prev, exportSettings: newExportSettings };
    });
  };

  if (!isOpen) return null;

  const { exportSettings } = localSettings;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800/90 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-cyan-400">Application Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700 transition-colors">&times;</button>
        </header>

        <div className="flex-grow p-6 overflow-y-auto space-y-6">
          <div className="bg-gray-700/40 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-400 mb-3">Application Defaults</h3>
            <label htmlFor="default-prompt" className="block text-sm font-medium text-gray-300 mb-2">Default Scene Prompt</label>
            <textarea
              id="default-prompt"
              value={localSettings.defaultScenePrompt}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, defaultScenePrompt: e.target.value }))}
              rows={4}
              className="w-full p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-200"
            />
          </div>

          <h3 className="text-xl font-bold text-cyan-400 border-b border-gray-700 pb-2">Default Export Settings</h3>
          
          <div className="bg-gray-700/40 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-400 mb-3">Export Format</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => updateExportSetting('format', 'jpeg')} className={`p-2 rounded transition-colors text-sm font-semibold ${exportSettings.format === 'jpeg' ? 'bg-cyan-500 text-gray-900' : 'bg-gray-600 hover:bg-gray-500'}`}>JPEG</button>
              <button onClick={() => updateExportSetting('format', 'png')} className={`p-2 rounded transition-colors text-sm font-semibold ${exportSettings.format === 'png' ? 'bg-cyan-500 text-gray-900' : 'bg-gray-600 hover:bg-gray-500'}`}>PNG</button>
            </div>
            {exportSettings.format === 'jpeg' && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <label htmlFor="quality" className="font-medium text-gray-300">Quality</label>
                  <span className="px-2 py-1 text-xs rounded bg-gray-600">{exportSettings.quality}</span>
                </div>
                <input id="quality" type="range" min="10" max="100" value={exportSettings.quality} onChange={(e) => updateExportSetting('quality', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm"/>
              </div>
            )}
          </div>
          
          <div className="bg-gray-700/40 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-400 mb-3">Resolution</h3>
            <select value={exportSettings.resolution.preset} onChange={e => updateResolution('preset', e.target.value as ResolutionSettings['preset'])} className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-200">
              <option value="original">Original (from image)</option>
              <option value="hd">HD (1920px)</option>
              <option value="4k">4K (3840px)</option>
              <option value="square">Square (1:1)</option>
              <option value="portrait">Portrait (9:16)</option>
              <option value="landscape">Landscape (16:9)</option>
              <option value="custom">Custom</option>
            </select>
            {exportSettings.resolution.preset === 'custom' && (
              <div className="flex items-center gap-2 mt-3">
                <input type="number" value={exportSettings.resolution.width ?? ''} onChange={e => updateResolution('width', e.target.value ? parseInt(e.target.value, 10) : null)} placeholder="W" className="w-full p-2 bg-gray-600 border border-gray-500 rounded" />
                <button disabled className="p-2 flex-shrink-0 text-gray-500 cursor-not-allowed">
                  <LockIcon locked={exportSettings.resolution.aspectRatioLocked} className="w-5 h-5" />
                </button>
                <input type="number" value={exportSettings.resolution.height ?? ''} onChange={e => updateResolution('height', e.target.value ? parseInt(e.target.value, 10) : null)} placeholder="H" className="w-full p-2 bg-gray-600 border border-gray-500 rounded" />
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">Note: Aspect ratio lock is unavailable for default settings.</p>
          </div>
          
          <div className="bg-gray-700/40 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-400 mb-3">Color Grading</h3>
            <select value={exportSettings.colorGrading.preset} onChange={e => updateColorGrading('preset', e.target.value as ColorGradingSettings['preset'])} className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-200">
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
                <label className="text-sm flex justify-between"><span>Exposure</span> <span>{exportSettings.colorGrading.brightness - 100}</span></label>
                <input type="range" min="50" max="150" value={exportSettings.colorGrading.brightness} onChange={e => updateColorGrading('brightness', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"/>
              </div>
              <div>
                <label className="text-sm flex justify-between"><span>Warmth</span> <span>{exportSettings.colorGrading.warmth}</span></label>
                <input type="range" min="0" max="100" value={exportSettings.colorGrading.warmth} onChange={e => updateColorGrading('warmth', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"/>
              </div>
              <div>
                <label className="text-sm flex justify-between"><span>Saturation</span> <span>{exportSettings.colorGrading.saturation}%</span></label>
                <input type="range" min="0" max="200" value={exportSettings.colorGrading.saturation} onChange={e => updateColorGrading('saturation', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"/>
              </div>
              <div>
                <label className="text-sm flex justify-between"><span>Contrast</span> <span>{exportSettings.colorGrading.contrast}%</span></label>
                <input type="range" min="0" max="200" value={exportSettings.colorGrading.contrast} onChange={e => updateColorGrading('contrast', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"/>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-800 flex-shrink-0">
          <button onClick={handleReset} className="px-4 py-2 text-red-400 rounded hover:bg-red-500/10 transition-colors text-sm">Reset to Defaults</button>
          <div>
            <button onClick={onClose} className="px-4 py-2 text-gray-300 rounded hover:bg-gray-700 mr-2 transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2 bg-cyan-500 text-gray-900 font-bold rounded hover:bg-cyan-400 transition-transform transform hover:scale-105">Save Changes</button>
          </div>
        </footer>
      </div>
    </div>
  );
};