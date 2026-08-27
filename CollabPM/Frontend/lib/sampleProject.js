// Sample data so the dashboards are viewable before the backend exists. Every
// field maps to something we'll fetch from the API later. Swap this module for
// real fetches (via the store in projectStore.js) once the endpoints land.

// "who am I" for the per-user views.
export const CURRENT_USER = "Ronak";

export const SAMPLE_PROJECTS = [
  {
    id: "demo",
    name: "Website Revamp",
    leader: "Ronak",
    members: ["Ronak", "Sam", "Aisha"],
    sections: [
      {
        id: "s1",
        title: "Discovery",
        status: "done",
        assignees: ["Ronak"],
        children: [
          { id: "s1a", title: "Gather requirements", status: "done", assignees: ["Ronak"], durationHours: 24, startedAt: "2026-08-20T09:00:00Z" },
          { id: "s1b", title: "Competitor research", status: "done", assignees: ["Aisha"], durationHours: 24, startedAt: "2026-08-20T09:00:00Z" },
        ],
      },
      {
        id: "s2",
        title: "Design",
        status: "in_progress",
        assignees: ["Aisha"],
        children: [
          { id: "s2a", title: "Wireframes", status: "done", assignees: ["Aisha"], durationHours: 48, startedAt: "2026-08-22T09:00:00Z" },
          { id: "s2b", title: "Visual design", status: "in_progress", assignees: ["Aisha"], durationHours: 72, startedAt: "2026-08-25T09:00:00Z" },
          { id: "s2c", title: "Design review", status: "not_started", assignees: ["Ronak"], durationHours: 12, startedAt: "2026-08-28T09:00:00Z" },
        ],
      },
      {
        id: "s3",
        title: "Build",
        status: "in_progress",
        assignees: ["Ronak", "Sam"],
        children: [
          {
            id: "s3a",
            title: "Backend",
            status: "in_progress",
            assignees: ["Ronak"],
            children: [
              { id: "s3a1", title: "Auth", status: "done", assignees: ["Ronak"], durationHours: 36, startedAt: "2026-08-24T09:00:00Z" },
              { id: "s3a2", title: "Projects API", status: "in_progress", assignees: ["Ronak"], durationHours: 48, startedAt: "2026-08-26T09:00:00Z" },
              { id: "s3a3", title: "Voting API", status: "not_started", assignees: ["Ronak"], durationHours: 48, startedAt: "2026-08-29T09:00:00Z" },
            ],
          },
          {
            id: "s3b",
            title: "Frontend",
            status: "in_progress",
            assignees: ["Sam"],
            children: [
              { id: "s3b1", title: "Auth pages", status: "done", assignees: ["Sam"], durationHours: 24, startedAt: "2026-08-25T09:00:00Z" },
              { id: "s3b2", title: "Dashboard", status: "in_progress", assignees: ["Sam"], durationHours: 36, startedAt: "2026-08-27T09:00:00Z" },
            ],
          },
        ],
      },
      {
        id: "s4",
        title: "Launch",
        status: "not_started",
        assignees: ["Sam"],
        children: [
          { id: "s4a", title: "QA pass", status: "not_started", assignees: ["Aisha"], durationHours: 24, startedAt: "2026-09-02T09:00:00Z" },
          { id: "s4b", title: "Deploy", status: "not_started", assignees: ["Ronak"], durationHours: 8, startedAt: "2026-09-03T09:00:00Z" },
        ],
      },
    ],
    votes: [
      {
        id: "v1",
        title: "Which homepage hero direction?",
        description: "Pick the visual direction for the landing hero.",
        calledBy: "Aisha",
        targetSection: "Visual design",
        anonymous: false,
        closesAt: "2026-08-27T17:00:00Z",
        options: [
          { id: "o1", text: "Bold typographic", votes: 3 },
          { id: "o2", text: "Product screenshot", votes: 5 },
          { id: "o3", text: "Illustration", votes: 1 },
        ],
      },
      {
        id: "v2",
        title: "Move Sam to backend for the sprint?",
        description: "We are behind on the Voting API.",
        calledBy: "Ronak",
        targetSection: "Build",
        anonymous: true,
        closesAt: "2026-08-26T12:00:00Z",
        options: [
          { id: "o1", text: "Yes", votes: 2 },
          { id: "o2", text: "No", votes: 2 },
        ],
      },
    ],
  },
  {
    id: "mobile",
    name: "Mobile App",
    leader: "Sam",
    members: ["Ronak", "Sam"],
    sections: [
      {
        id: "m1",
        title: "Setup",
        status: "in_progress",
        assignees: ["Ronak"],
        children: [
          { id: "m1a", title: "Init repo", status: "done", assignees: ["Ronak"], durationHours: 4, startedAt: "2026-08-23T09:00:00Z" },
          { id: "m1b", title: "CI pipeline", status: "not_started", assignees: ["Ronak"], durationHours: 16, startedAt: "2026-08-26T09:00:00Z" },
        ],
      },
      {
        id: "m2",
        title: "Features",
        status: "not_started",
        assignees: ["Sam"],
        children: [
          { id: "m2a", title: "Login screen", status: "not_started", assignees: ["Sam"], durationHours: 24, startedAt: "2026-08-30T09:00:00Z" },
          { id: "m2b", title: "Push notifications", status: "not_started", assignees: ["Ronak"], durationHours: 40, startedAt: "2026-09-01T09:00:00Z" },
        ],
      },
    ],
    votes: [],
  },
];
