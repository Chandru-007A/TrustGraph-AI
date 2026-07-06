"use client";

// Animated reasoning DAG that resolves into a Merkle root — used as hero backdrop.
const nodes = [
  { id: "n1", x: 60, y: 60, r: 7 },
  { id: "n2", x: 60, y: 150, r: 7 },
  { id: "n3", x: 60, y: 240, r: 7 },
  { id: "n4", x: 200, y: 100, r: 9 },
  { id: "n5", x: 200, y: 210, r: 9 },
  { id: "n6", x: 340, y: 155, r: 11 },
  { id: "root", x: 470, y: 155, r: 16 },
];

const edges = [
  ["n1", "n4"],
  ["n2", "n4"],
  ["n2", "n5"],
  ["n3", "n5"],
  ["n4", "n6"],
  ["n5", "n6"],
  ["n6", "root"],
];

function nodeById(id: string) {
  return nodes.find((n) => n.id === id)!;
}

export function DagVisual() {
  return (
    <svg viewBox="0 0 520 320" className="w-full h-full" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="dag-edge" x1="0" y1="0" x2="520" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary)" stopOpacity="0.2" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id="dag-root" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--accent)" />
        </radialGradient>
      </defs>

      {edges.map(([a, b], i) => {
        const from = nodeById(a);
        const to = nodeById(b);
        return (
          <line
            key={`${a}-${b}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="url(#dag-edge)"
            strokeWidth="1.5"
            className="animate-dash"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        );
      })}

      {nodes.map((n, i) => (
        <g key={n.id}>
          {n.id === "root" && (
            <circle cx={n.x} cy={n.y} r={n.r + 10} fill="none" stroke="var(--primary)" strokeWidth="1" opacity="0.3">
              <animate attributeName="r" values={`${n.r + 6};${n.r + 18}`} dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0" dur="2.4s" repeatCount="indefinite" />
            </circle>
          )}
          <circle
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.id === "root" ? "url(#dag-root)" : "var(--card)"}
            stroke={n.id === "root" ? "var(--primary)" : "var(--primary)"}
            strokeWidth="1.5"
            className="animate-pulse-node"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        </g>
      ))}
    </svg>
  );
}
