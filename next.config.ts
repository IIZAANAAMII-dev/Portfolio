import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/Portfolio',
  trailingSlash: true,
  images: { unoptimized: true },
  // Le canvas est déjà chargé dynamiquement ; on garde le reste du bundle minimal.
  experimental: {
    optimizePackageImports: ['@react-three/drei'],
  },
  // Permet d'ouvrir l'aperçu de développement depuis 127.0.0.1 comme depuis localhost.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
