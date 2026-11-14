import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./landscape.css";
import "./lite.css";
import OrientationGate from "@/components/OrientationGate";

export const metadata: Metadata = {
  title: "GSM | Global Soccer Manager",
  description:
    "Choose your league, take charge of a club and build a managerial legacy.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05070d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* decide graphics mode before first paint so weak phones never render the heavy effects */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=JSON.parse(localStorage.getItem("gsm-settings")||"{}"),n=navigator,p=matchMedia("(pointer:coarse)").matches&&Math.min(screen.width,screen.height)<=900,w=p||(n.deviceMemory||8)<=4||(n.hardwareConcurrency||8)<=4;document.documentElement.dataset.perf=(s.perf==="lite"||((!s.perf||s.perf==="auto")&&w))?"lite":"full"}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;800;900&family=Cairo:wght@400;600;700&family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <OrientationGate />
      </body>
    </html>
  );
}
