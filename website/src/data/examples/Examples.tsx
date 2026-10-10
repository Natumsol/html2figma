import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
const Dot = ({ color = "" }: { color?: string }) => (
  <i className={`dot ${color}`} />
);
const Tag = ({ children }: { children: ReactNode }) => (
  <Badge variant="secondary" className="badge">
    {children}
  </Badge>
);
function Frame({ name, children }: { name: string; children: ReactNode }) {
  return (
    <Card className={`example ${name}`}>
      <CardContent className="example-core">{children}</CardContent>
    </Card>
  );
}
function Action({ children }: { children: ReactNode }) {
  return (
    <Button className="action">
      <span>{children}</span>
      <span className="action-icon">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M4 12 12 4M4 4h8v8" stroke="white" strokeWidth="1.2" />
        </svg>
      </span>
    </Button>
  );
}
function Check() {
  return (
    <svg viewBox="0 0 16 16" fill="none">
      <path
        d="m3 8 3 3 7-7"
        stroke="#874fff"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
function Hero() {
  return (
    <Frame name="h2f-hero">
      <div className="row spread">
        <p className="kicker">A NEW STARTING POINT</p>
        <div className="h2f-hero-mark">
          <Dot color="orange" />
          <Dot />
          <Dot color="blue" />
        </div>
      </div>
      <h1>
        Design stays
        <br />
        <span>editable.</span>
      </h1>
      <p className="copy">From the browser to your next idea.</p>
      <div className="row spread h2f-hero-footer">
        <Action>Make it yours</Action>
        <Tag>TEXT · SHAPES · LAYOUT</Tag>
      </div>
    </Frame>
  );
}
function Feature() {
  return (
    <Frame name="h2f-feature">
      <div className="row spread">
        <div className="h2f-feature-icon">
          <svg viewBox="0 0 36 36" fill="none">
            <rect
              x="4.5"
              y="4.5"
              width="11"
              height="11"
              rx="3"
              stroke="#874fff"
              strokeWidth="1.4"
            />
            <rect
              x="20.5"
              y="4.5"
              width="11"
              height="11"
              rx="3"
              stroke="#874fff"
              strokeWidth="1.4"
            />
            <rect
              x="4.5"
              y="20.5"
              width="11"
              height="11"
              rx="3"
              stroke="#874fff"
              strokeWidth="1.4"
            />
            <path
              d="M20.5 26h11M26 20.5v11"
              stroke="#ff7237"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <Tag>01 / CAPTURE</Tag>
      </div>
      <p className="kicker">SMALL PARTS. NEW POSSIBILITIES.</p>
      <h2>Made to stay editable.</h2>
      <p className="copy">
        Bring text, shapes and vector details into a canvas you can keep working
        on.
      </p>
      <div className="tags">
        <Tag>Text</Tag>
        <Tag>Shapes</Tag>
        <Tag>SVG</Tag>
      </div>
      <div className="divider" />
      <div className="h2f-feature-foot">
        <Dot color="green" />
        <span>A starting point for your next idea</span>
      </div>
    </Frame>
  );
}
function Pricing() {
  return (
    <Frame name="h2f-pricing">
      <div className="row spread">
        <p className="kicker">THE STUDIO PLAN</p>
        <Tag>Sample pricing</Tag>
      </div>
      <h2>A space for your ideas.</h2>
      <div className="h2f-pricing-price">
        <strong>$29</strong>
        <span>/ month</span>
      </div>
      <p className="copy">An illustrative plan for a creative workspace.</p>
      <div className="h2f-pricing-list">
        {[
          "Personal canvas",
          "Reusable building blocks",
          "Shared project library",
        ].map((text) => (
          <p key={text}>
            <Check />
            <span>{text}</span>
          </p>
        ))}
      </div>
      <Action>Choose your workspace</Action>
    </Frame>
  );
}
function Profile() {
  return (
    <Frame name="h2f-profile">
      <div className="row spread">
        <p className="kicker">MEET THE MAKER</p>
        <Tag>Sample profile</Tag>
      </div>
      <div className="h2f-profile-intro">
        <img
          className="h2f-profile-avatar"
          src="case-asset:portrait.png"
          alt="Abstract violet portrait illustration"
        />
        <div>
          <h2>Alex Morgan</h2>
          <p className="h2f-profile-role">Product designer</p>
          <div className="h2f-profile-status">
            <svg viewBox="0 0 16 16" fill="none">
              <circle
                cx="8"
                cy="8"
                r="5.5"
                stroke="#24cb71"
                strokeWidth="1.2"
              />
              <path
                d="m5.5 8 1.7 1.7 3.3-3.3"
                stroke="#24cb71"
                strokeWidth="1.2"
              />
            </svg>
            <span>Open to new ideas</span>
          </div>
        </div>
      </div>
      <p className="copy">
        Finding the details that make everyday experiences feel a little more
        considered.
      </p>
      <div className="h2f-profile-foot">
        <span>Design systems & interfaces</span>
        <Dot color="orange" />
      </div>
    </Frame>
  );
}
function ImageCard() {
  return (
    <Frame name="h2f-image-card">
      <img
        className="h2f-image-card-preview"
        src="case-asset:canvas.png"
        alt="A violet and ivory composition of editable interface cards"
      />
      <div className="h2f-image-card-body">
        <p className="kicker">CANVAS STUDY / 01</p>
        <h2>A little room to create.</h2>
        <p className="copy">
          A collection of shapes, quiet colors and possibilities.
        </p>
        <div className="tags">
          <Tag>Composition</Tag>
          <Tag>Color</Tag>
          <Tag>Space</Tag>
        </div>
      </div>
    </Frame>
  );
}
function Statistics() {
  return (
    <Frame name="h2f-stats">
      <div className="row spread">
        <p className="kicker">PROJECT SNAPSHOT</p>
        <Tag>Sample data</Tag>
      </div>
      <h2>A week in the studio.</h2>
      <p className="copy">Small explorations. A few ideas worth keeping.</p>
      <div className="h2f-stats-metrics">
        {[
          { color: "", value: "12", label: "Explorations" },
          { color: "orange", value: "04", label: "Components" },
          { color: "blue", value: "02", label: "Collections" },
        ].map((metric) => (
          <div key={metric.label} className="h2f-stats-metric">
            <Dot color={metric.color} />
            <strong>{metric.value}</strong>
            <p>{metric.label}</p>
          </div>
        ))}
      </div>
      <div className="h2f-stats-foot">
        <Dot color="green" />
        <span>Illustrative values for this example</span>
      </div>
    </Frame>
  );
}
export function renderExamples() {
  return Object.fromEntries(
    Object.entries({
      "hero-section": <Hero />,
      "icon-feature-card": <Feature />,
      "pricing-card": <Pricing />,
      "profile-media-card": <Profile />,
      "image-product-card": <ImageCard />,
      "stats-panel": <Statistics />,
    }).map(([id, component]) => {
      const semantic = new Set([
        "example",
        "example-core",
        "row",
        "spread",
        "kicker",
        "copy",
        "badge",
        "action",
        "action-icon",
        "dot",
        "orange",
        "blue",
        "green",
        "divider",
        "tags",
      ]);
      const html = renderToStaticMarkup(component)
        .replace(/\sdata-(slot|variant|size)="[^"]*"/g, "")
        .replace(
          /class="([^"]*)"/g,
          (_, classes: string) =>
            `class="${classes
              .split(/\s+/)
              .filter((name) => semantic.has(name) || name.startsWith("h2f-"))
              .join(" ")}"`,
        );
      return [id, html];
    }),
  );
}
