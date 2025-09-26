import React from 'react';

export const MagicWandIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 10.5l-2.2-2.2m0 0L5.9 4.4a2 2 0 00-2.8 2.8l3.9 3.9m2.2-2.2l-2.2 2.2m0 0l-2.2 2.2m2.2-2.2l2.2-2.2M12 10.5l2.2-2.2m0 0l3.9-3.9a2 2 0 012.8 2.8l-3.9 3.9m-2.2-2.2l2.2 2.2M12 10.5l2.2 2.2M4 19l2.2-2.2m0 0l3.9-3.9a2 2 0 012.8 2.8l-3.9 3.9m-2.2-2.2l-2.2 2.2m0 0L4 19m2.2-2.2l2.2-2.2m0 0L12 10.5"
    />
  </svg>
);
