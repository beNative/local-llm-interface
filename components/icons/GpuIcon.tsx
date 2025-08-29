import React from 'react';

const GpuIcon = ({ className }: { className?: string }) => (
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
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <path d="M7 7h4v4H7z" />
    <path d="M13 13h4v4h-4z" />
    <path d="M7 13h10" />
    <path d="M13 7h4" />
    <path d="M7 17v-4" />
    <path d="M17 7v10" />
  </svg>
);

export default GpuIcon;
