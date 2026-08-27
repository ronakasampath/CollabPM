import ProjectDashboard from "@/components/Dashboard/ProjectDashboard";

// URL: /dashboard. Shows the project dashboard. Currently fed by sample data
// (lib/sampleProject.js); we swap that for real API calls as the projects,
// sections, and votes endpoints come online.
export default function DashboardPage() {
  return <ProjectDashboard />;
}
