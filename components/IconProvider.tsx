import React, { createContext, useContext } from 'react';
import type { IconSet } from '../types';

interface IconContextType {
    iconSet: IconSet;
}

const IconContext = createContext<IconContextType>({ iconSet: 'default' });

export const useIconSet = () => useContext(IconContext);

export const IconProvider: React.FC<{ children: React.ReactNode; iconSet: IconSet }> = ({ children, iconSet }) => {
    return (
        <IconContext.Provider value={{ iconSet }}>
            {children}
        </IconContext.Provider>
    );
};
