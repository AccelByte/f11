let started = false;

/** Only the configured Pages site sends analytics; failures never block gameplay. */
export async function startPageviewTracking(
  projectKey: string,
  pagesUrl: string,
  currentUrl: string = window.location.href,
): Promise<void> {
  if (started || !projectKey || !pagesUrl) return;

  try {
    const current = new URL(currentUrl);
    const target = new URL(pagesUrl);
    const path = target.pathname.replace(/\/$/, '');
    if (
      current.origin !== target.origin ||
      (current.pathname !== path && !current.pathname.startsWith(`${path}/`))
    ) {
      return;
    }

    started = true;
    const { default: posthog } = await import('posthog-js');
    posthog.init(projectKey, {
      api_host: 'https://e.accelbyte.io',
      ui_host: 'https://us.posthog.com',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_exceptions: false,
      capture_performance: false,
      capture_dead_clicks: false,
      enable_heatmaps: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      person_profiles: 'never',
      loaded: (client) => {
        client.register({ $lib: 'html-game', game: 'f11' });
        client.capture('$pageview');
      },
    });
  } catch {
    // Analytics is optional, including when a browser blocks its script or storage.
  }
}
