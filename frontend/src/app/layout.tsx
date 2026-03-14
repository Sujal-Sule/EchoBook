import type { Metadata } from 'next'
import { Inter, Playfair_Display, Crimson_Pro } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', style: ['normal', 'italic'] })
const crimson = Crimson_Pro({ subsets: ['latin'], variable: '--font-crimson', style: ['normal', 'italic'] })

export const metadata: Metadata = {
  title: 'EchoBook - Living Memory',
  description: 'Every story deserves to live forever.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable} ${crimson.variable} font-sans`}>
        {children}
      </body>
    </html>
  )
}
