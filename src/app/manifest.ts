
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Santuario Nacional Nuestra Señora del Perpetuo Socorro',
    short_name: 'Santuario NSPS',
    description: 'Sistema de Gestión de Sacramentos - Santuario Nacional Nuestra Señora del Perpetuo Socorro',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2e44a3',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
