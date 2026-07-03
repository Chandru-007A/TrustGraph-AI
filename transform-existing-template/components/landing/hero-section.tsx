"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { DagVisual } from "./dag-visual";

const words = ["reasoning", "workflow", "decision", "agent"];

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden grid-bg">
      {/* DAG backdrop */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[620px] h-[440px] lg:w-[820px] lg:h-[560px] opacity-70 pointer-events-none">
        <DagVisual />
      </div>
      {/* Ambient glow */}
      <div className="absolute right-1/4 top-1/3 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--primary) 22%, transparent), transparent 70%)" }} />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-32 lg:py-40 w-full">
        <div
          className={`mb-8 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-sm font-mono text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Proof of Intelligence — anchored on the Arc blockchain
          </span>
        </div>

        <div className="mb-10">
          <h1
            className={`text-[clamp(2.75rem,10vw,8.5rem)] font-display leading-[0.92] tracking-tight transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="block">Don&apos;t trust AI.</span>
            <span className="block">
              Verify its{" "}
              <span className="relative inline-block text-gradient">
                <span key={wordIndex} className="inline-flex">
                  {words[wordIndex].split("").map((char, i) => (
                    <span key={`${wordIndex}-${i}`} className="inline-block animate-char-in" style={{ animationDelay: `${i * 50}ms` }}>
                      {char}
                    </span>
                  ))}
                </span>
              </span>
            </span>
          </h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-end">
          <p
            className={`text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            TrustGraph records every reasoning step an AI agent takes, hashes it into a
            Merkle-anchored Directed Acyclic Graph, and lets you cryptographically verify the
            proof before unlocking a single node with USDC.
          </p>

          <div
            className={`flex flex-col sm:flex-row items-start gap-4 transition-all duration-700 delay-300 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-14 text-base rounded-full group">
              <Link href="/dashboard">
                Open the platform
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 px-8 text-base rounded-full border-border hover:bg-secondary">
              <Link href="/workflow">Explore a live DAG</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Trust marquee */}
      <div className={`absolute bottom-16 left-0 right-0 transition-all duration-700 delay-500 ${isVisible ? "opacity-100" : "opacity-0"}`}>
        <div className="flex gap-16 marquee whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-16">
              {[
                { value: "2.4M+", label: "reasoning nodes hashed", tag: "MERKLE" },
                { value: "100%", label: "workflows anchored on-chain", tag: "ARC" },
                { value: "$1.9M", label: "settled in USDC micropayments", tag: "CIRCLE" },
                { value: "0", label: "tampered proofs accepted", tag: "SECURITY" },
              ].map((stat) => (
                <div key={`${stat.tag}-${i}`} className="flex items-baseline gap-4">
                  <span className="text-3xl lg:text-4xl font-display text-foreground">{stat.value}</span>
                  <span className="text-sm text-muted-foreground">
                    {stat.label}
                    <span className="block font-mono text-xs mt-1 text-primary">{stat.tag}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
