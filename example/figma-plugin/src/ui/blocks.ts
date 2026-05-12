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
  },
  {
    id: "icon-feature-card",
    title: "Icon Feature Card",
    description: "A feature card with an inline SVG icon rendered as vector content.",
    path: "/icon-feature-card.html"
  },
  {
    id: "image-product-card",
    title: "Image Product Card",
    description: "A product card that exercises local image element rendering.",
    path: "/image-product-card.html"
  },
  {
    id: "profile-media-card",
    title: "Profile Media Card",
    description: "A flex card combining a local image asset and inline SVG status icon.",
    path: "/profile-media-card.html"
  }
];
