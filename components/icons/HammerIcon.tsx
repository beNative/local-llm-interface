import React from 'react';

const HammerIcon = ({ className }: { className?: string }) => (
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
    <path d="m15 12-8.373 8.373a1 1 0 1 1-1.414-1.414L12.586 12l-2.829-2.828a1 1 0 0 1 0-1.414l4.243-4.243a1 1 0 0 1 1.414 0l2.828 2.828a1 1 0 0 1 0 1.414L15 12Z" />
    <path d="m21.5 21.5-1.414-1.414" />
  </svg>
);

export default HammerIcon;
