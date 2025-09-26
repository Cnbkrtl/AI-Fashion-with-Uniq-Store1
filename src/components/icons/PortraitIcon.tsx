import React from 'react';

export const PortraitIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor" 
    strokeWidth={2}
  >
    <rect x="6" y="3" width="12" height="18" rx="1" ry="1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);