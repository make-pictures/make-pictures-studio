import React from 'react';
import {
  StudioApp as BaseStudioApp,
  type StudioAppProps,
} from '@make-pictures/studio/client';
import { STUDIO_COMPOSITIONS } from '../compositions/registry';

export type { StudioAppProps };

export const StudioApp: React.FC<StudioAppProps> = ({ compositions }) => (
  <BaseStudioApp compositions={compositions ?? STUDIO_COMPOSITIONS} />
);
