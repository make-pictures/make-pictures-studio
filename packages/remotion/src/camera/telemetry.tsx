import React, { useContext, useEffect, useState } from 'react';
import { useCurrentFrame } from 'remotion';
import {
  DEFAULT_CAMERA_TELEMETRY,
  type DirectorCameraTelemetry,
  DirectorCameraTelemetryContext,
  readFrameCameraTelemetry,
  subscribeFrameCameraTelemetry,
} from './shotTypes';

const ExplicitTelemetryProviderContext = React.createContext<boolean>(false);

export interface DirectorCameraTelemetryProviderProps {
  telemetry: DirectorCameraTelemetry;
  children: React.ReactNode;
}

export const DirectorCameraTelemetryProvider: React.FC<
  DirectorCameraTelemetryProviderProps
> = ({ telemetry, children }) => (
  <ExplicitTelemetryProviderContext.Provider value={true}>
    <DirectorCameraTelemetryContext.Provider value={telemetry}>
      {children}
    </DirectorCameraTelemetryContext.Provider>
  </ExplicitTelemetryProviderContext.Provider>
);

/**
 * Reads live camera telemetry (`velocity`, `focusDistance`, `activeShotIndex`)
 * from either an enclosing `<DirectorCamera2D>` / `<DirectorCameraTelemetryProvider>`
 * OR a sibling `<DirectorCamera3D>` inside `<ThreeCanvas>` at the exact current `frame`.
 */
export function useDirectorCameraTelemetry(): DirectorCameraTelemetry {
  const frame = useCurrentFrame();
  const hasExplicitProvider = useContext(ExplicitTelemetryProviderContext);
  const ctxTelemetry = useContext(DirectorCameraTelemetryContext);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (hasExplicitProvider) return;
    return subscribeFrameCameraTelemetry((updatedFrame) => {
      if (updatedFrame === frame) {
        setTick((n) => n + 1);
      }
    });
  }, [frame, hasExplicitProvider]);

  if (hasExplicitProvider) {
    return ctxTelemetry;
  }

  return readFrameCameraTelemetry(frame) ?? DEFAULT_CAMERA_TELEMETRY;
}
