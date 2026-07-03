"use client";

import { useEffect, useState, useRef } from "react";
import { ShieldCheck, GitMerge, Fingerprint, Link2 } from "lucide-react";

const securityFeatures = [
  {
    icon: Fingerprint,
    title: "SHA-256 node hashing",
    description: "Every reasoning node gets a unique cryptographic fingerprint. Tampering is mathematically detectable.",
  },
  {
    icon: GitMerge,
    title: "Merkle-root integrity",
    description: "One root commits the entire DAG. Verify any node against the root without revealing the rest.",
  },
  {
    icon: Link2,
    title: "On-chain anchoring",
    description: "Roots are committed to the Arc blockchain, giving every workflow an immutable, timestamped receipt.",
  },
  {
    icon: ShieldCheck,
    title: "Trustless verification",
    description: "Buyers verify proofs independently. No need to trust TrustGraph, the agent, or the seller.",
  },
];

const certifications = ["Arc Anchored", "Merkle Proofs", "USDC Settled", "SOC 2 Type II", "Zero-Knowledge Ready"];

export function SecuritySection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.1 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="security" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden border-y border-border">
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          <div className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <span className="inline-flex items-center gap-3 text-sm font-mono text-primary mb-6">
              <span className="w-8 h-px bg-primary/40" />
              Cryptographic guarantees
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              Proof, not
              <br />
              promises.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12">
              TrustGraph replaces &quot;trust me&quot; with math. Every workflow is hashed, anchored, and
              independently verifiable — so intelligence can be bought and sold with confidence.
            </p>
            <div className="flex flex-wrap gap-3">
              {certifications.map((cert, index) => (
                <span
                  key={cert}
                  className={`px-4 py-2 rounded-full glass text-sm font-mono transition-all duration-500 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            {securityFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className={`p-6 rounded-xl glass hover:border-primary/40 transition-all duration-500 group ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-1 group-hover:translate-x-1 transition-transform duration-300">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
