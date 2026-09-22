import type { NextConfig } from 'next';

// Phase 2C adds a narrow server route for authenticated replay and AGS
// settlement. Vinext therefore emits a Cloudflare Worker rather than a static
// export; the browser game remains the root route of the same deployment.
const nextConfig: NextConfig = {};

export default nextConfig;
