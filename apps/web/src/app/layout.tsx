// Fonts are self-hosted (served from our own origin, no request to Google), under the same family names the app uses.
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/400-italic.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/bricolage-grotesque/400.css';
import '@fontsource/bricolage-grotesque/500.css';
import '@fontsource/bricolage-grotesque/600.css';
import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/600.css';
import '@fontsource/caveat/700.css';
import '@fontsource/kalam/300.css';
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import '@fontsource/patrick-hand/400.css';
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
