import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "../components/Nav";
import { SessionProvider } from "../lib/store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Harborline · FDE Onboarding Accelerator",
  description:
    "A forward-deployed engineering demo: ingest messy client extracts, map them to a typed ontology, and ship an operational dashboard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <Nav />
          <main className="flex-1">
            <div className="max-w-6xl mx-auto px-6 py-10">{children}</div>
          </main>
          <footer className="border-t border-slate-200">
            <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-slate-500 flex justify-between">
              <span>Harborline Freight · simulated FDE engagement</span>
              <span>Built with Next.js + TypeScript</span>
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
