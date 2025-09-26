import React from 'react';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';

export const ApiErrorDisplay: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-gray-800/50 rounded-2xl shadow-lg p-8 text-center">
        <ExclamationTriangleIcon className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-cyan-400 mb-2">Configuration Required</h1>
        <p className="text-gray-400 mb-6">
          The Gemini API key has not been configured. This application cannot function without it.
        </p>
        <div className="bg-gray-900/50 rounded-lg p-6 text-left space-y-4">
          <h2 className="text-xl font-semibold text-purple-400">How to Fix</h2>
          <p className="text-gray-300">
            Please add your Gemini API key as an environment variable in your deployment settings (e.g., Vercel, Netlify).
          </p>
          <ol className="list-decimal list-inside text-gray-400 space-y-2">
            <li>Go to your project's settings on your hosting provider.</li>
            <li>Find the "Environment Variables" section.</li>
            <li>
              Add a new variable with the name{' '}
              <code className="bg-gray-700 text-cyan-300 px-2 py-1 rounded-md text-sm">
                API_KEY
              </code>
            </li>
            <li>
              Paste your Gemini API key as the value.
            </li>
            <li>Redeploy your application for the changes to take effect.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
