import React from 'react';
import { CogIcon } from './icons/CogIcon';

interface HeaderProps {
  onSettingsClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSettingsClick }) => {
  return (
    <header className="py-4 px-4 border-b border-gray-700/50 shadow-xl bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-left">
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
              One-Prompt AI Fashion Studio
            </span>
          </h1>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm max-w-2xl">
            Upload a model, describe a new scene, and let AI create a stunning editorial image.
          </p>
        </div>
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          aria-label="Open settings"
        >
          <CogIcon className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
};
