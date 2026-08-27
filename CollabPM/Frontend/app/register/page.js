import AuthForm from "@/components/AuthForm/AuthForm";

// URL: /register. Same reusable form, different mode.
export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
