/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 静的エクスポートは行わず、Firebase Hosting + フレームワーク連携 or SSR を想定。
  // 画像は Firebase Storage / Google 認証アバターを許可。
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
};

export default nextConfig;
