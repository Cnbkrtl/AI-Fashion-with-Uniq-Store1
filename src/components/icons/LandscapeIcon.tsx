import React from 'react';

export const LandscapeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor" 
    strokeWidth={2}
  >
    <rect x="3" y="6" width="18" height="12" rx="1" ry="1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
