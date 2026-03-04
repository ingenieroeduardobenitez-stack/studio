
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
    icon: '/icon.png',
    apple: '/icon.png',
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
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
        
        <Script id="pwa-init" strategy="afterInteractive">
          {`
            // Registro de Service Worker
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(registration) {
                    console.log('SW Registrado correctamente');
                  },
                  function(err) {
                    console.log('Fallo registro SW:', err);
                  }
                );
              });
            }

            // Captura de interacción para instalación y permisos
            let hasTriggered = false;
            document.addEventListener('click', async () => {
              if (hasTriggered) return;
              hasTriggered = true;

              // Solicitar permisos de notificación
              if ('Notification' in window && Notification.permission === 'default') {
                try {
                  await Notification.requestPermission();
                } catch (e) {}
              }
            }, { once: true });
          `}
        </Script>
      </body>
    </html>
  );
}
