import type { NextConfig } from 'next'

/**
 * Content-Security-Policy.
 *
 * ⚠️ 'unsafe-inline' sur script-src est un COMPROMIS TEMPORAIRE : Next.js
 * injecte des scripts inline pour l'hydratation. La solution propre est un
 * nonce par requête généré dans le middleware. À resserrer à H20 — noté
 * dans SECURITY.md comme dette assumée, pas comme oubli.
 *
 * Tout le reste est déjà strict :
 *   - object-src 'none'     → pas de Flash/plugins, vecteur XSS historique
 *   - frame-ancestors 'none'→ anti-clickjacking (remplace X-Frame-Options)
 *   - base-uri 'self'       → empêche de détourner les URLs relatives
 *   - form-action 'self'    → un formulaire injecté ne peut pas exfiltrer ailleurs
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const nextConfig: NextConfig = {
  poweredByHeader: false, // retire X-Powered-By: Next.js → moins d'info à l'attaquant
  reactStrictMode: true,

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          // Empêche le navigateur de "deviner" un type MIME :
          // un .txt contenant du JS ne sera pas exécuté.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' }, // repli pour vieux navigateurs
        ],
      },
    ]
  },
}

export default nextConfig
