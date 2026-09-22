import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import Page from '../app/page';
import '../app/globals.css';
import { startPageviewTracking } from './analytics';

void startPageviewTracking(
  process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '',
  process.env.NEXT_PUBLIC_POSTHOG_PAGES_URL ?? '',
);

const root = document.getElementById('root');
if (!root) throw new Error('Local preview root is missing.');

createRoot(root).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
