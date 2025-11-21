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
  // Optimize output
  output: 'standalone',
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
            value: "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: mediastream: filesystem: https://*.firebasedatabase.app https://*.firebaseapp.com https://*.googleapis.com https://*.firebasestorage.app https://placehold.co; img-src 'self' data: blob: https://*.firebasedatabase.app https://*.firebaseapp.com https://*.googleapis.com https://*.firebasestorage.app https://placehold.co https://api.mapbox.com; media-src 'self' mediastream: blob: data:; connect-src 'self' https://* wss://* http://*.local:* https://*.local:* https://*.firebasedatabase.app https://*.firebaseapp.com https://*.googleapis.com https://*.google.com https://*.firebasestorage.app https://a.tiles.mapbox.com https://b.tiles.mapbox.com https://api.mapbox.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebasedatabase.app https://*.firebaseapp.com https://*.googleapis.com https://*.google.com https://*.firebasestorage.app; worker-src 'self' blob:; child-src 'self' blob:; font-src 'self' data: https://fonts.gstatic.com;"
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
