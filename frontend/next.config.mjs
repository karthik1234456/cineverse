import { execSync } from 'child_process';

let commitHash = 'dev';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  commitHash = process.env.NEXT_PUBLIC_GIT_COMMIT_SHA || 'unknown';
}
const buildTime = new Date().toISOString();

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_GIT_COMMIT_SHA: commitHash,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com https://www.youtube.com https://s.ytimg.com",
              "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 ws://localhost:8000 ws://127.0.0.1:8000 http://localhost:8002 http://127.0.0.1:8002 ws://localhost:8002 ws://127.0.0.1:8002 https://api.razorpay.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://www.youtube.com https://*.googlevideo.com blob: data:",
              "img-src 'self' data: blob: https://image.tmdb.org https://* https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://i.ytimg.com https://*.ytimg.com",
              "style-src 'self' 'unsafe-inline' https://unpkg.com",
              "font-src 'self' data:",
              "frame-src 'self' https://api.razorpay.com https://www.youtube.com https://www.youtube-nocookie.com",
              "media-src 'self' blob: data: https://commondatastorage.googleapis.com https://*.storage.googleapis.com https://*.googlevideo.com https://www.youtube.com https://youtube.com",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
