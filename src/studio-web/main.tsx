import React from 'react';
import { createRoot } from 'react-dom/client';
import '@make-pictures/studio/styles.css';
import { StudioApp } from './StudioApp';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root container in index.html');
}

createRoot(container).render(<StudioApp />);
