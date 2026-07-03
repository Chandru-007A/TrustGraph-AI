"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  {
    number: "I",
    title: "Record the reasoning",
    description: "Wrap your agent with the TrustGraph SDK. Every step is captured as a node in a Directed Acyclic Graph.",
    code: `import { TrustGraph } from '@trustgraph/sdk'

const tg = new TrustGraph({ apiKey })

const session = tg.record(agent, {
  captureTools: true,
  captureReasoning: true,
})`,
  },
  {
    number: "II",
    title: "Hash & build the Merkle root",
    description: "Each node is hashed and folded into a Merkle tree, producing one root that fingerprints the whole workflow.",
    code: `const graph = await session.finalize()

// SHA-256 per node -> Merkle root
const proof = graph.merkelize()

console.log(proof.root)
// 0x9f2c...a41b`,
  },
  {
    number: "III",
    title: "Anchor & unlock with USDC",
    description: "Commit the root to the Arc blockchain, then let buyers verify the proof and unlock nodes with USDC.",
    code: `await proof.anchor({ chain: 'arc' })

// buyer verifies, then pays per node
await proof.unlock('node_7', {
  pay: { amount: '0.25', token: 'USDC' },
})`,
  },
];

export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.1 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setActiveStep((prev) => (prev + 1) % steps.length), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="how-it-works" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden border-y border-border">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-16 lg:mb-20">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-primary mb-6">
            <span className="w-8 h-px bg-primary/40" />
            Verify before you pay
          </span>
          <h2 className={`text-4xl lg:text-6xl font-display tracking-tight transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            Three steps to
            <br />
            <span className="text-muted-foreground">provable intelligence.</span>
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          <div className="space-y-0">
            {steps.map((step, index) => (
              <button
                key={step.number}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`w-full text-left py-8 border-b border-border transition-all duration-500 group ${activeStep === index ? "opacity-100" : "opacity-40 hover:opacity-70"}`}
              >
                <div className="flex items-start gap-6">
                  <span className="font-display text-3xl text-primary">{step.number}</span>
                  <div className="flex-1">
                    <h3 className="text-2xl lg:text-3xl font-display mb-3 group-hover:translate-x-2 transition-transform duration-300">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                    {activeStep === index && (
                      <div className="mt-4 h-px bg-border overflow-hidden">
                        <div className="h-full bg-primary w-0" style={{ animation: "progress 5s linear forwards" }} />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="lg:sticky lg:top-32 self-start">
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-primary/60" />
                </div>
                <span className="text-xs font-mono text-muted-foreground">verify.ts</span>
              </div>
              <div className="p-8 font-mono text-sm min-h-[280px]">
                <pre className="text-foreground/80">
                  {steps[activeStep].code.split("\n").map((line, lineIndex) => (
                    <div key={`${activeStep}-${lineIndex}`} className="leading-loose code-line-reveal" style={{ animationDelay: `${lineIndex * 80}ms` }}>
                      <span className="text-muted-foreground/40 select-none w-8 inline-block">{lineIndex + 1}</span>
                      <span className="inline-flex">
                        {line.split("").map((char, charIndex) => (
                          <span key={`${activeStep}-${lineIndex}-${charIndex}`} className="code-char-reveal" style={{ animationDelay: `${lineIndex * 80 + charIndex * 15}ms` }}>
                            {char === " " ? "\u00A0" : char}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </pre>
              </div>
              <div className="px-6 py-4 border-t border-border flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-mono text-muted-foreground">Proof verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress { from { width: 0%; } to { width: 100%; } }
        .code-line-reveal { opacity: 0; transform: translateX(-8px); animation: lineReveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        @keyframes lineReveal { to { opacity: 1; transform: translateX(0); } }
        .code-char-reveal { opacity: 0; filter: blur(8px); animation: charReveal 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        @keyframes charReveal { to { opacity: 1; filter: blur(0); } }
      `}</style>
    </section>
  );
}
