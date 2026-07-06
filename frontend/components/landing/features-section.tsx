"use client";

import { useEffect, useRef, useState } from "react";

const features = [
  {
    number: "01",
    title: "Reasoning captured as a DAG",
    description:
      "Every step an agent takes — retrieval, tool call, inference, decision — is recorded as a node in a Directed Acyclic Graph so the full chain of thought is auditable, not a black box.",
    visual: "graph",
  },
  {
    number: "02",
    title: "Every node cryptographically hashed",
    description:
      "Each reasoning node is hashed with SHA-256 and combined into a Merkle tree. A single Merkle root fingerprints the entire workflow — change one token and the proof breaks.",
    visual: "hash",
  },
  {
    number: "03",
    title: "Anchored on the Arc blockchain",
    description:
      "The Merkle root is committed on-chain to Arc, producing a tamper-evident, timestamped receipt that anyone can independently verify without trusting TrustGraph.",
    visual: "chain",
  },
  {
    number: "04",
    title: "Pay per node with USDC",
    description:
      "Unlock individual reasoning nodes with USDC micropayments through Circle Gateway. Verify the proof first, then pay only for the intelligence you actually need.",
    visual: "pay",
  },
];

function GraphVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {[
        [40, 40, 100, 80],
        [40, 120, 100, 80],
        [100, 80, 160, 50],
        [100, 80, 160, 110],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" opacity="0.35" className="animate-dash" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
      {[
        [40, 40], [40, 120], [100, 80], [160, 50], [160, 110],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i === 2 ? 10 : 7} fill="none" stroke="currentColor" strokeWidth="2">
          <animate attributeName="r" values={`${i === 2 ? 10 : 7};${i === 2 ? 12 : 9};${i === 2 ? 10 : 7}`} dur="2s" begin={`${i * 0.25}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

function HashVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {/* Merkle tree */}
      {[
        [100, 30, 60, 80], [100, 30, 140, 80],
        [60, 80, 35, 130], [60, 80, 85, 130],
        [140, 80, 115, 130], [140, 80, 165, 130],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      ))}
      <rect x="90" y="20" width="20" height="20" rx="3" fill="currentColor" />
      {[[50, 70], [130, 70]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="20" height="20" rx="3" fill="currentColor" opacity="0.7">
          <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
        </rect>
      ))}
      {[[25, 120], [75, 120], [105, 120], [155, 120]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="20" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      ))}
    </svg>
  );
}

function ChainVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {[30, 80, 130].map((x, i) => (
        <g key={i}>
          <rect x={x} y="55" width="40" height="50" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x={x + 6} y="63" width="28" height="4" rx="2" fill="currentColor" opacity="0.6" />
          <rect x={x + 6} y="72" width="20" height="4" rx="2" fill="currentColor" opacity="0.4" />
          {i < 2 && (
            <line x1={x + 40} y1="80" x2={x + 50} y2="80" stroke="currentColor" strokeWidth="2" className="animate-dash" />
          )}
        </g>
      ))}
      <circle cx="150" cy="80" r="3" fill="currentColor">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function PayVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <circle cx="100" cy="80" r="34" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="100" y="90" textAnchor="middle" fontSize="26" fontFamily="monospace" fill="currentColor">$</text>
      <circle cx="100" cy="80" r="44" fill="none" stroke="currentColor" strokeWidth="1" opacity="0">
        <animate attributeName="r" values="34;54" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
      </circle>
      {[0, 90, 180, 270].map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        return <circle key={i} cx={100 + Math.cos(a) * 60} cy={80 + Math.sin(a) * 60} r="4" fill="currentColor" opacity="0.6" />;
      })}
    </svg>
  );
}

function AnimatedVisual({ type }: { type: string }) {
  switch (type) {
    case "graph": return <GraphVisual />;
    case "hash": return <HashVisual />;
    case "chain": return <ChainVisual />;
    case "pay": return <PayVisual />;
    default: return <GraphVisual />;
  }
}

function FeatureCard({ feature, index }: { feature: (typeof features)[0]; index: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.2 });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className={`group relative transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 py-12 lg:py-16 border-b border-border">
        <div className="shrink-0">
          <span className="font-mono text-sm text-primary">{feature.number}</span>
        </div>
        <div className="flex-1 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-2xl lg:text-4xl font-display mb-4 group-hover:translate-x-2 transition-transform duration-500">
              {feature.title}
            </h3>
            <p className="text-base lg:text-lg text-muted-foreground leading-relaxed">{feature.description}</p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="w-48 h-40 text-primary">
              <AnimatedVisual type={feature.visual} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.1 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" ref={sectionRef} className="relative py-24 lg:py-32">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-16 lg:mb-20">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-primary mb-6">
            <span className="w-8 h-px bg-primary/40" />
            The verification pipeline
          </span>
          <h2 className={`text-4xl lg:text-6xl font-display tracking-tight transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            Every decision has proof.
            <br />
            <span className="text-muted-foreground">Nothing is taken on faith.</span>
          </h2>
        </div>
        <div>
          {features.map((feature, index) => (
            <FeatureCard key={feature.number} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
