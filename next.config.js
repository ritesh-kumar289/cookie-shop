/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode is intentionally disabled: React Three Fiber's useFrame hook
  // runs effects twice in strict mode (React 18 dev double-invoke), which
  // causes camera and animation state to desync on first render.
  reactStrictMode: false,
  // Allow large static files (GLB models)
  webpack(config) {
    config.module.rules.push({
      test: /\.(glb|gltf)$/,
      type: 'asset/resource',
    });
    return config;
  },
};

module.exports = nextConfig;
