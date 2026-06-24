/** @type {import('next').NextConfig} */
// build: 2026-06-22
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "ui-avatars.com" },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
};

export default nextConfig;
