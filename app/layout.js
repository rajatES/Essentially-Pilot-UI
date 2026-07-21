import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "EssentiallySports Scheduler",
  description: "Schedule and publish posts to your Facebook Pages"
};

// Apply the saved theme before first paint so dark mode never flashes light.
const noFlashTheme = `(function(){try{var s=JSON.parse(localStorage.getItem("app-settings")||"{}");if(s&&s.darkMode){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
