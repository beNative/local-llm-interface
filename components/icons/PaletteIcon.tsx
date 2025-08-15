import React from 'react';

const PaletteIcon = ({ className }: { className?: string }) => (
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
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.47-1.125-.29-.289-.47-.652-.47-1.027 0-.928.746-1.688 1.688-1.688H19c2.21 0 4-1.79 4-4s-1.79-4-4-4h-1.164A1.688 1.688 0 0 0 16.32 5.25c-.29-.29-.47-.688-.47-1.125C15.85 2.746 15.082 2 14.25 2H12Z"/>
  </svg>
);

export default PaletteIcon;
