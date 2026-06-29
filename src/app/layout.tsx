import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HabitFlow — Rastreador de Hábitos',
  description: 'Crie, acompanhe e celebre seus hábitos com gamificação, streaks e metas personalizadas.',
  keywords: 'hábitos, rastreador, produtividade, streaks, metas, gamificação',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeScript />
        {children}
      </body>
    </html>
  )
}

// Inline script to prevent flash of wrong theme
function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              var stored = localStorage.getItem('habitflow-theme');
              if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              }
            } catch(e) {}
          })();
        `,
      }}
    />
  )
}
