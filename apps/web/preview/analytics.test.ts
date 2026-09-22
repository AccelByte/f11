import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ init: vi.fn(), register: vi.fn(), capture: vi.fn() }));
vi.mock('posthog-js', () => ({ default: sdk }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

describe('Pages visit tracking', () => {
  const target = 'https://accelbyte.github.io/f11';

  it('does not initialize without configuration or outside the configured site', async () => {
    const { startPageviewTracking } = await import('./analytics');
    await startPageviewTracking('', target, `${target}/`);
    await startPageviewTracking('test-key', '', `${target}/`);
    await startPageviewTracking('test-key', target, 'http://127.0.0.1:4173/f11/');
    await startPageviewTracking('test-key', target, 'https://accelbyte.github.io/another-game/');
    await startPageviewTracking('test-key', target, 'https://accelbyte.github.io/f11-other/');
    expect(sdk.init).not.toHaveBeenCalled();
  });

  it('labels the first pageview and disables unrelated collection', async () => {
    sdk.init.mockImplementation((_key, config) => config.loaded(sdk));
    const { startPageviewTracking } = await import('./analytics');
    await startPageviewTracking('test-key', target, `${target}/?utm_source=test`);
    await startPageviewTracking('test-key', target, `${target}/`);
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init).toHaveBeenCalledWith(
      'test-key',
      expect.objectContaining({
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
      }),
    );
    expect(sdk.register).toHaveBeenCalledWith({ $lib: 'html-game', game: 'f11' });
    expect(sdk.capture).toHaveBeenCalledExactlyOnceWith('$pageview');
    expect(sdk.register.mock.invocationCallOrder[0]).toBeLessThan(
      sdk.capture.mock.invocationCallOrder[0],
    );
  });

  it('keeps analytics initialization failures out of gameplay', async () => {
    sdk.init.mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    const { startPageviewTracking } = await import('./analytics');
    await expect(startPageviewTracking('test-key', target, `${target}/`)).resolves.toBeUndefined();
  });
});
