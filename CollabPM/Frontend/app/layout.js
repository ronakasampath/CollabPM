import "./globals.css";
import AppChrome from "@/components/Shell/AppChrome";

// In the App Router, this is the ROOT layout. It wraps every page. We put the
// app chrome (top bar + search + account + notifications) here so it appears on
// every app page; AppChrome hides itself on the marketing/auth routes.
export const metadata = {
  title: "CollabPM",
  description: "Collaborative project management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
