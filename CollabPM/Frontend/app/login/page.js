import AuthForm from "@/components/AuthForm/AuthForm";

// This page is a Server Component (no "use client"), and that's fine: it just
// renders the AuthForm client component. The URL is /login because the folder
// is app/login and the file is page.js.
export default function LoginPage() {
  return <AuthForm mode="login" />;
}
