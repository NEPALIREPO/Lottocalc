/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use project root so Next doesn't pick up parent lockfiles
  turbopack: { root: __dirname },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
