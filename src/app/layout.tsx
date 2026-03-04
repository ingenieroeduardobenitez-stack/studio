
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
  icons: {
    icon: [
      { url: '/icon.png' },
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
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
        
        {/* Sistema de Instalación Silenciosa y Automática */}
        <Script id="pwa-auto-install" strategy="afterInteractive">
          {`
            let deferredPrompt;
            let interactionHappened = false;

            window.addEventListener('beforeinstallprompt', (e) => {
              // Prevenir el banner predeterminado
              e.preventDefault();
              deferredPrompt = e;
              
              // Intentar instalar automáticamente al primer toque en la pantalla
              document.addEventListener('click', function autoInstall() {
                if (deferredPrompt && !interactionHappened) {
                  interactionHappened = true;
                  deferredPrompt.prompt();
                  deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                      console.log('Usuario aceptó la instalación');
                    }
                    deferredPrompt = null;
                  });
                  document.removeEventListener('click', autoInstall);
                }
              }, { once: true });
            });

            // Registro de Service Worker inmediato
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(registration) {
                    console.log('ServiceWorker activo');
                  },
                  function(err) {
                    console.error('Error SW:', err);
                  }
                );
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
