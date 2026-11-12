import React, { createContext, useContext, useMemo } from 'react';
import { BUILT_IN_STYLES } from './presets';
import { resolveStudioStyle } from './registry';
import type { StylePreset } from './schema';
import { useStyleFontsReady } from './fontLoader';
import { StyleBackdrop } from './StyleBackdrop';

const StudioStyleContext = createContext<StylePreset>(
  BUILT_IN_STYLES['minimal-product']
);

export interface StyleProviderProps {
  style?: string | StylePreset;
  renderBackdrop?: boolean;
  children?: React.ReactNode;
}

export const StyleProvider: React.FC<StyleProviderProps> = ({
  style,
  renderBackdrop = false,
  children,
}) => {
  const resolved = useMemo(() => resolveStudioStyle(style), [style]);
  useStyleFontsReady(resolved);

  return (
    <StudioStyleContext.Provider value={resolved}>
      {renderBackdrop ? <StyleBackdrop style={resolved} /> : null}
      {children}
    </StudioStyleContext.Provider>
  );
};

export function useStudioStyle(): StylePreset {
  return useContext(StudioStyleContext);
}
