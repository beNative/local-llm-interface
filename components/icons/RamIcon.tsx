import React from 'react';

const RamIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
    <line x1="6" y1="5" x2="6" y2="19" />
    <line x1="10" y1="5" x2="10" y2="19" />
    <line x1="14" y1="5" x2="14" y2="19" />
    <line x1="18" y1="5" x2="18" y2="19" />
  </svg>
);

export default RamIcon;
