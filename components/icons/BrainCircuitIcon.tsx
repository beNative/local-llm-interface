import React from 'react';

const BrainCircuitIcon = ({ className }: { className?: string }) => (
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
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 0 0 9 22a4 4 0 0 0 4-4 4 4 0 0 0-4-4" />
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 0 1 15 22a4 4 0 0 1-4-4 4 4 0 0 1 4-4" />
    <path d="M16 12a4 4 0 0 0-4-4" />
    <path d="M8 12a4 4 0 0 1 4-4" />
    <path d="M12 8V5" />
    <path d="M12 18v4" />
    <path d="M15 22v-4" />
    <path d="M9 22v-4" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="9" cy="12" r=".5" fill="currentColor"/>
    <circle cx="15" cy="12" r=".5" fill="currentColor"/>
  </svg>
);

export default BrainCircuitIcon;