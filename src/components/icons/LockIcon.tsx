import React from 'react';

interface LockIconProps {
  locked: boolean;
  className?: string;
}

export const LockIcon: React.FC<LockIconProps> = ({ locked, className }) => {
  if (locked) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2a5 5 0 00-5 5v1h1a1 1 0 011 1v3a1 1 0 01-1 1H5v1a2 2 0 002 2h6a2 2 0 002-2v-1h-1a1 1 0 01-1-1V9a1 1 0 011-1h1V7a5 5 0 00-5-5zm-3 5a3 3 0 116 0v1H7V7z" />
    </svg>
  );
};
