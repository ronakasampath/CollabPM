import ProjectWorkspace from "@/components/ProjectWorkspace/ProjectWorkspace";

// URL: /project?project=<id>. The project workspace: the section tree (with
// "Call a vote" + "Mark complete" on each section) plus the right-side rail of
// members and the votes the current user is invited to.
export default function ProjectPage() {
  return <ProjectWorkspace />;
}
