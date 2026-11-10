import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://orbit.chat'),
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  title: {
    default: 'Orbit - All-in-One Team Collaboration Workspace',
    template: '%s | Orbit',
  },
  description:
    'The unified team collaboration workspace. Chat channels, interactive canvas whiteboard, agile ticket boards, rich collaborative docs, team availability, and calling.',
  keywords: [
    'team collaboration',
    'workspace',
    'whiteboard canvas',
    'project management',
    'ticket board',
    'team documents',
    'employee availability',
    'team chat',
    'voice and video calling',
  ],
  authors: [{ name: 'Orbit Core Team' }],
  openGraph: {
    title: 'Orbit - All-in-One Team Collaboration Workspace',
    description:
      'All-in-one team workspace: channels, interactive whiteboard canvas, project tickets, collaborative documents, team availability, and calling.',
    url: 'https://orbit.chat',
    siteName: 'Orbit',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Orbit - All-in-One Team Collaboration Workspace',
    description:
      'All-in-one team workspace: channels, interactive whiteboard canvas, project tickets, collaborative documents, team availability, and calling.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@300;400;500;600;700;800&family=Lato:ital,wght@0,400;0,700;0,900;1,400&family=Space+Grotesk:wght@400;500;600;700&family=Caveat:wght@400..700&family=Kalam:wght@300;400;700&family=Patrick+Hand&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('orbit_theme') || localStorage.getItem('orbit_marketing_theme');
                  var r = document.documentElement;
                  if (savedTheme === 'light') {
                    r.classList.remove('dark');
                    r.classList.add('light');
                    r.style.colorScheme = 'light';
                  } else {
                    r.classList.add('dark');
                    r.classList.remove('light');
                    r.style.colorScheme = 'dark';
                  }

                  var saved = localStorage.getItem('orbit_theme_active');
                  if (saved) {
                    var t = JSON.parse(saved);
                    if (t.sidebarColor) r.style.setProperty('--theme-bg-sidebar', t.sidebarColor);
                    if (t.workspaceColor) r.style.setProperty('--theme-bg-workspace', t.workspaceColor);
                    if (t.backgroundColor) r.style.setProperty('--theme-bg-app', t.backgroundColor);
                    if (t.surfaceColor) r.style.setProperty('--theme-bg-surface', t.surfaceColor);
                    if (t.textColor) r.style.setProperty('--theme-text-primary', t.textColor);
                    if (t.fontFamily) r.style.setProperty('--theme-font', t.fontFamily);
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen selection:bg-indigo-500 selection:text-white bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
