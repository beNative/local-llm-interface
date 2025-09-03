import React from 'react';
import type { Theme } from '../types';
import Icon from './Icon';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';

interface ThemeSwitcherProps {
  theme: Theme;
  onToggle: () => void;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ theme, onToggle }) => {
  const tooltipProps = useTooltipTrigger(`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`);
  
  return (
    <button
      {...tooltipProps}
      onClick={onToggle}
      className="p-2 rounded-full text-[--text-muted] hover:bg-[--bg-hover] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-primary] focus:ring-[--border-focus]"
    >
      {theme === 'light' ? (
        <Icon name="moon" className="w-5 h-5" />
      ) : (
        <Icon name="sun" className="w-5 h-5" />
      )}
    </button>
  );
};

export default ThemeSwitcher;
