import path from 'node:path'
import type { NextConfig } from 'next'

const scriptSource = ["script-src 'self' 'unsafe-inline'", ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : [])].join(' ')

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "style-src 'self' 'unsafe-inline'",
              scriptSource,
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              'upgrade-insecure-requests',
            ].join('; '),
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
}

export default nextConfig
