
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import Script from 'next/script';

export const viewport: Viewport = {
  themeColor: '#2e44a3',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Santuario Nacional NSPS - Sistema de Gestión',
  description: 'Sistema de Gestión de Sacramentos - Santuario Nacional Nuestra Señora del Perpetuo Socorro',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.png', sizes: 'any' },
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: ['/icon.png'],
    apple: [
      { url: '/icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Santuario NSPS',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/icon.png" />
        <link rel="shortcut icon" href="/icon.png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
        
        <Script id="pwa-init" strategy="afterInteractive">
          {`
            // 1. Registro de Service Worker para Instalación y Notificaciones
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(registration) {
                    console.log('SW registrado');
                  },
                  function(err) {
                    console.log('SW falló:', err);
                  }
                );
              });
            }

            // 2. Solicitud automática de Notificaciones
            async function requestNotify() {
              if ('Notification' in window && Notification.permission === 'default') {
                try {
                  await Notification.requestPermission();
                } catch (e) {}
              }
            }

            // 3. Captura de instalación y activación de permisos por interacción
            let deferredPrompt;
            window.addEventListener('beforeinstallprompt', (e) => {
              e.preventDefault();
              deferredPrompt = e;
              
              // Al primer clic en cualquier lugar, pedimos instalar y notificar
              document.addEventListener('click', async () => {
                if (deferredPrompt) {
                  deferredPrompt.prompt();
                  deferredPrompt = null;
                }
                await requestNotify();
              }, { once: true });
            });

            // Si no hay prompt de instalación (ya instalada), igual pedir notificación al hacer clic
            document.addEventListener('click', requestNotify, { once: true });
          `}
        </Script>
      </body>
    </html>
  );
}
