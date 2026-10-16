import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AnalyticsIdentity } from "@/components/analytics-identity";
import { getCurrentUser } from "@/lib/session";

// Plus Jakarta Sans for headings and buttons, Inter for reading text.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const SITE = process.env.APP_URL || "https://careerninja.app";
const TITLE = "Career Ninja, your own AI headhunter";
const DESCRIPTION = "It finds real, open jobs you'd get, writes each application from your resume, and fills in the form. You read it and press Submit.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: SITE, siteName: "Career Ninja", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser().catch(() => null);
  return (
    // The Career Ninja extension marks <html> before React loads, so attributes there differ.
    <html lang="en" className={`${jakarta.variable} ${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {user && <AnalyticsIdentity id={user.id} username={user.username} />}
        {children}
      </body>
    </html>
  );
}
