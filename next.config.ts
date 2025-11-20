import type {NextConfig} from 'next';
import fs from 'fs';
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increase from default 1MB to 10MB for image processing
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=*, geolocation=*'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: mediastream: filesystem: https://*.firebasedatabase.app https://*.firebaseapp.com https://*.googleapis.com https://*.firebasestorage.app; media-src 'self' mediastream: blob:; connect-src 'self' https://* wss://* https://*.firebasedatabase.app https://*.firebaseapp.com https://*.googleapis.com https://*.google.com https://*.firebasestorage.app; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebasedatabase.app https://*.firebaseapp.com https://*.googleapis.com https://*.google.com https://*.firebasestorage.app; font-src 'self' https://fonts.gstatic.com;"
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
        ]
      }
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.mapbox.com',
      }
    ],
  },

};

export default nextConfig;
