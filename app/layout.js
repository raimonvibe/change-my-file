import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'FileConvert Hub - Advanced Document Conversion',
  description: 'Convert your documents, images, and files with our advanced conversion engine. Fast, secure, and powered by cutting-edge technology.',
  keywords: 'file conversion, document converter, PDF converter, DOCX converter, online file converter',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster 
          position="top-right"
          richColors
          toastOptions={{
            duration: 3000,
          }}
        />
      </body>
    </html>
  )
}