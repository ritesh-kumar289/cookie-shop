/** @type {import('next').NextConfig} */
const nextConfig = {
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
