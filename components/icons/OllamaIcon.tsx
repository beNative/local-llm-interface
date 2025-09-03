import React from 'react';

const OllamaIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 1024 1024"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
  >
    <circle cx="512" cy="512" r="512" fill="#2d3748" />
    <circle cx="512" cy="512" r="448" fill="#e2e8f0" />
    <circle cx="512" cy="512" r="320" fill="#2d3748" />
    <circle cx="512" cy="512" r="256" fill="#e2e8f0" />
    <circle cx="512" cy="512" r="128" fill="#2d3748" />
  </svg>
);

export default OllamaIcon;