import "./globals.css";
import { Header } from "@/components/Header";
import { ModalProvider } from "@/components/AddSkyModal";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";

const title = "Sky Palette";
const description = "To play with the skies I've seen";

export const metadata: Metadata = {
  metadataBase: new URL("https://sky-palette-three.vercel.app"),
  title,
  description,
  openGraph: {
    title,
    description,
    images: ["/opengraph-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/opengraph-image.png"],
  },
};
const themeScript = `try{let t=localStorage.getItem('sky-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ModalProvider>
          <Header />
          {children}
        </ModalProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
