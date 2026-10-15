import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  title: 'Orbit - Team Communication Platform',
  description: 'Self-hosted Slack alternative with channels, direct messages, huddle audio/video calls, and bot integrations.',
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
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&family=Kalam:wght@300;400;700&family=Patrick+Hand&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('orbit_theme_active');
                  if (saved) {
                    var t = JSON.parse(saved);
                    var r = document.documentElement;
                    if (t.sidebarColor) r.style.setProperty('--theme-bg-sidebar', t.sidebarColor);
                    if (t.workspaceColor) r.style.setProperty('--theme-bg-workspace', t.workspaceColor);
                    if (t.backgroundColor) r.style.setProperty('--theme-bg-app', t.backgroundColor);
                    if (t.surfaceColor) r.style.setProperty('--theme-bg-surface', t.surfaceColor);
                    if (t.surfaceHoverColor) r.style.setProperty('--theme-bg-surface-hover', t.surfaceHoverColor);
                    if (t.textColor) {
                      r.style.setProperty('--theme-text-primary', t.textColor);
                      r.style.setProperty('--theme-text', t.textColor);
                    }
                    if (t.textMutedColor) r.style.setProperty('--theme-text-muted', t.textMutedColor);
                    if (t.primaryColor) r.style.setProperty('--theme-primary', t.primaryColor);
                    if (t.primaryHoverColor) r.style.setProperty('--theme-primary-hover', t.primaryHoverColor);
                    if (t.primaryTextColor) r.style.setProperty('--theme-primary-text', t.primaryTextColor);
                    if (t.secondaryColor) r.style.setProperty('--theme-secondary', t.secondaryColor);
                    if (t.borderColor) r.style.setProperty('--theme-border', t.borderColor);

                    var bg = t.backgroundColor || '';
                    if (bg.startsWith('#') && bg.length === 7) {
                      var r_ = parseInt(bg.substring(1, 3), 16);
                      var g_ = parseInt(bg.substring(3, 5), 16);
                      var b_ = parseInt(bg.substring(5, 7), 16);
                      if ((r_*299 + g_*587 + b_*114)/1000 >= 160) {
                        r.classList.remove('dark');
                        r.classList.add('light');
                        r.dataset.themeMode = 'light';
                      } else {
                        r.classList.add('dark');
                        r.classList.remove('light');
                        r.dataset.themeMode = 'dark';
                      }
                    }
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-[var(--theme-bg-app)] text-[var(--theme-text-primary)] antialiased h-screen overflow-hidden flex flex-col">
        {children}
      </body>
    </html>
  );
}
