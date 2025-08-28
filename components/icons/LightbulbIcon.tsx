import React from 'react';

const LightbulbIcon = ({ className }: { className?: string }) => (
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
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5C17.1 10.9 18 9.9 18 8.5c0-1.4-1.1-2.5-2.5-2.5S13 7.1 13 8.5c0 1.4.9 2.4 1.5 3.1L15 14Z" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 18v-2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m5.64 17.66-1.41 1.41" />
    <path d="m18.36 5.64-1.41 1.41" />
  </svg>
);

export default LightbulbIcon;
