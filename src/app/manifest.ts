import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Santuario Nacional NSPS',
    short_name: 'Santuario NSPS',
    description: 'Sistema de Gestión de Sacramentos - Santuario Nacional Nuestra Señora del Perpetuo Socorro',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2e44a3',
    icons: [
      {
        src: '/icon.png',
        sizes: 'any',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
