import UserDashboard from "@/components/UserDashboard/UserDashboard";

// URL: /home. The per-user home dashboard (the page a logged-in user lands on).
// Fed by sample data via the shared store for now.
export default function HomePage() {
  return <UserDashboard />;
}
