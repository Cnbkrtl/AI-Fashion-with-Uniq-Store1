import React from 'react';

export const RotateIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor" 
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12a7.5 7.5 0 11-7.5-7.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5V1.5l3 3" />
  </svg>
);