"use client";

import { useEffect, useState } from "react";

const testimonials = [
  {
    quote: "We stopped taking our vendors' AI on faith. Now every agent output ships with a Merkle proof our auditors can verify.",
    author: "Sarah Chen",
    role: "Head of AI Risk",
    company: "Meridian Bank",
    metric: "100% of decisions audited",
  },
  {
    quote: "Pay-per-node with USDC changed our economics. We only unlock the reasoning we actually need to review.",
    author: "Marcus Webb",
    role: "VP Engineering",
    company: "Flux Systems",
    metric: "63% lower review cost",
  },
  {
    quote: "Anchoring proofs on Arc gave our compliance team the immutable trail they'd been asking for.",
    author: "Elena Rodriguez",
    role: "Chief Compliance Officer",
    company: "Beacon AI",
    metric: "Zero disputed outputs",
  },
  {
    quote: "The DAG viewer turned an opaque model into something my whole team can actually inspect and trust.",
    author: "James Liu",
    role: "Founder",
    company: "Prism Analytics",
    metric: "4x faster verification",
  },
];

export function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % testimonials.length);
        setIsAnimating(false);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeTestimonial = testimonials[activeIndex];

  return (
    <section className="relative py-32 lg:py-40 border-t border-border lg:pb-14">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex items-center gap-4 mb-16">
          <span className="font-mono text-xs tracking-widest text-primary uppercase">Verified by teams that can&apos;t guess</span>
          <div className="flex-1 h-px bg-border" />
          <span className="font-mono text-xs text-muted-foreground">
            {String(activeIndex + 1).padStart(2, "0")} / {String(testimonials.length).padStart(2, "0")}
          </span>
        </div>

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-20">
          <div className="lg:col-span-8">
            <blockquote className={`transition-all duration-300 ${isAnimating ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}`}>
              <p className="font-display text-3xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight text-foreground text-balance">
                &ldquo;{activeTestimonial.quote}&rdquo;
              </p>
            </blockquote>
            <div className={`mt-12 flex items-center gap-6 transition-all duration-300 delay-100 ${isAnimating ? "opacity-0" : "opacity-100"}`}>
              <div className="w-16 h-16 rounded-full glass flex items-center justify-center">
                <span className="font-display text-2xl text-primary">{activeTestimonial.author.charAt(0)}</span>
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">{activeTestimonial.author}</p>
                <p className="text-muted-foreground">{activeTestimonial.role}, {activeTestimonial.company}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col justify-center">
            <div className={`p-8 rounded-xl glass transition-all duration-300 ${isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}>
              <span className="font-mono text-xs tracking-widest text-primary uppercase block mb-4">Key result</span>
              <p className="font-display text-3xl md:text-4xl text-foreground">{activeTestimonial.metric}</p>
            </div>
            <div className="flex gap-2 mt-8">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  aria-label={`Show testimonial ${idx + 1}`}
                  onClick={() => {
                    setIsAnimating(true);
                    setTimeout(() => { setActiveIndex(idx); setIsAnimating(false); }, 300);
                  }}
                  className={`h-2 rounded-full transition-all duration-300 ${idx === activeIndex ? "w-8 bg-primary" : "w-2 bg-border hover:bg-muted-foreground"}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-24 pt-12 border-t border-border">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-8 text-center">Trusted across finance, healthcare, and AI marketplaces</p>
        </div>
      </div>

      <div className="w-full">
        <div className="flex gap-16 items-center marquee">
          {[...Array(2)].map((_, setIdx) => (
            <div key={setIdx} className="flex gap-16 items-center shrink-0">
              {["Meridian Bank", "Flux Systems", "Beacon AI", "Prism Analytics", "Nova Health", "Quantum Capital", "Atlas Legal", "Vertex Labs"].map((company) => (
                <span key={`${setIdx}-${company}`} className="font-display text-xl md:text-2xl text-foreground/30 whitespace-nowrap hover:text-foreground transition-colors duration-300">
                  {company}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
