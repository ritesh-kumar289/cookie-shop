/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode is intentionally disabled: React Three Fiber's useFrame hook
  // runs effects twice in strict mode (React 18 dev double-invoke), which
  // causes camera and animation state to desync on first render.
  reactStrictMode: false,
};

module.exports = nextConfig;
