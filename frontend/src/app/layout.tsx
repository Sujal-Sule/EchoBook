import type { Metadata } from 'next'
import { Inter, Playfair_Display, Crimson_Pro, DM_Sans } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', style: ['normal', 'italic'] })
const crimson = Crimson_Pro({ subsets: ['latin'], variable: '--font-crimson', style: ['normal', 'italic'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', weight: ['300', '400', '500'] })

export const metadata: Metadata = {
  title: 'EchoBook - Living Memory',
  description: 'EchoBook listens to your stories and transforms them into a beautifully illustrated life memoir.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable} ${crimson.variable} ${dmSans.variable} font-sans`}>
        {children}
      </body>
    </html>
  )
}
