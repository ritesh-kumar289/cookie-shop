/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode is intentionally disabled: React Three Fiber's useFrame hook
  // runs effects twice in strict mode (React 18 dev double-invoke), which
  // causes camera and animation state to desync on first render.
  reactStrictMode: false,

  // Force Next.js/webpack to transpile pure-ESM packages that ship no CJS
  // fallback (lenis) or that declare "type":"module" (postprocessing).
  // Without this, webpack can fail to resolve these modules on Vercel's build
  // runner even though they work fine in local dev.
  transpilePackages: ['lenis', 'postprocessing'],
};

module.exports = nextConfig;
