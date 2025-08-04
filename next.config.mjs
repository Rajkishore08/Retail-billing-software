/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Minimal configuration to avoid build issues
  images: {
    unoptimized: true,
  },
};

export default nextConfig
