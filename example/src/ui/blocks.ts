export interface ExampleBlock {
  id: string;
  title: string;
  description: string;
  path: string;
}

export const blocks: ExampleBlock[] = [
  {
    id: "hero-section",
    title: "Hero Section",
    description: "A compact marketing hero with a dark background and call to action.",
    path: "/hero-section.html"
  },
  {
    id: "pricing-card",
    title: "Pricing Card",
    description: "A subscription card with badges, feature rows, and a CTA button.",
    path: "/pricing-card.html"
  },
  {
    id: "stats-panel",
    title: "Stats Panel",
    description: "A dashboard-style KPI block with multiple metric tiles.",
    path: "/stats-panel.html"
  }
];
