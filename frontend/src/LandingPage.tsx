import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring } from "framer-motion";
import {
  Zap, Eye, Globe, Layers, SlidersHorizontal, Code2,
  Users, BarChart3, Sparkles, ArrowRight, Check, Brain,
  ShieldCheck, Cpu
} from "lucide-react";

// ─── SVG gradient defs (for icon coloring) ───────────────────────────────────
function GradientDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="icon-grad-purple" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <linearGradient id="icon-grad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id="icon-grad-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Amőba glow blobs ────────────────────────────────────────────────────────
function GlowBlobs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="blob-1 absolute"
        style={{
          width: "800px", height: "800px",
          borderRadius: "40% 60% 55% 45% / 55% 40% 60% 45%",
          background: "radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, rgba(99,102,241,0.02) 50%, transparent 70%)",
          top: "-200px", left: "-200px",
          filter: "blur(80px)",
        }}
      />
      <div
        className="blob-2 absolute"
        style={{
          width: "700px", height: "700px",
          borderRadius: "55% 45% 40% 60% / 45% 55% 45% 55%",
          background: "radial-gradient(ellipse, rgba(139,92,246,0.07) 0%, rgba(139,92,246,0.015) 50%, transparent 70%)",
          top: "30%", right: "-250px",
          filter: "blur(90px)",
        }}
      />
      <div
        className="blob-3 absolute"
        style={{
          width: "600px", height: "600px",
          borderRadius: "45% 55% 60% 40% / 50% 60% 40% 50%",
          background: "radial-gradient(ellipse, rgba(59,130,246,0.06) 0%, transparent 65%)",
          bottom: "10%", left: "20%",
          filter: "blur(70px)",
        }}
      />
      <div
        className="blob-4 absolute"
        style={{
          width: "500px", height: "500px",
          borderRadius: "60% 40% 45% 55% / 40% 55% 45% 60%",
          background: "radial-gradient(ellipse, rgba(168,85,247,0.05) 0%, transparent 65%)",
          top: "60%", right: "10%",
          filter: "blur(60px)",
        }}
      />
    </div>
  );
}

// ─── Scroll-reveal wrapper ───────────────────────────────────────────────────
function Reveal({
  children,
  direction = "up",
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  direction?: "up" | "down" | "left" | "right";
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const offsets = {
    up: { y: 60, x: 0 },
    down: { y: -60, x: 0 },
    left: { y: 0, x: -80 },
    right: { y: 0, x: 80 },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, x: offsets[direction].x, y: offsets[direction].y }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

// ─── Shimmer button ──────────────────────────────────────────────────────────
function ShimmerButton({
  children,
  href,
  variant = "primary",
}: {
  children: React.ReactNode;
  href: string;
  variant?: "primary" | "ghost";
}) {
  const base = variant === "primary"
    ? "shimmer-btn inline-flex items-center gap-2 px-7 py-3.5 font-semibold text-white"
    : "inline-flex items-center gap-2 px-7 py-3.5 font-semibold glass";

  return (
    <a
      href={href}
      className={`${base} rounded-2xl transition-all duration-300`}
      style={
        variant === "primary"
          ? {
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #7c3aed 100%)",
              boxShadow: "0 0 40px rgba(99,102,241,0.25), 0 4px 20px rgba(0,0,0,0.3)",
              color: "white",
            }
          : { color: "#cbd5e1" }
      }
    >
      {children}
    </a>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      style={{
        background: scrolled ? "rgba(5,5,9,0.8)" : "transparent",
        backdropFilter: scrolled ? "blur(24px)" : "none",
        borderBottom: scrolled ? "0.5px solid rgba(255,255,255,0.06)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2.5 group">
          <div
            className="rounded-xl p-1.5 transition-shadow duration-300 group-hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              boxShadow: "0 0 20px rgba(99,102,241,0.2)",
            }}
          >
            <Sparkles size={18} color="white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">mitvegyek.ai</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Funkciók", href: "#funkciok" },
            { label: "Működés", href: "#mukodes" },
            { label: "Kapcsolat", href: "#cta" },
          ].map(item => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-medium transition-colors duration-200 hover:text-white"
              style={{ color: "#64748b" }}
            >
              {item.label}
            </a>
          ))}
        </div>

        <ShimmerButton href="#cta" variant="primary">
          Demo kérése
        </ShimmerButton>
      </div>
    </motion.nav>
  );
}

// ─── Hero Section ────────────────────────────────────────────────────────────
function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const videoY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);

  // Mouse tilt on video
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-300, 300], [6, -2]), { stiffness: 100, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-400, 400], [-4, 4]), { stiffness: 100, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  return (
    <section ref={sectionRef} className="relative flex flex-col items-center overflow-hidden px-6 pt-32 pb-16" style={{ minHeight: "100vh" }}>
      {/* Asymmetric accent line */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: "60%", height: "1px",
          background: "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.25) 30%, rgba(139,92,246,0.15) 70%, transparent 100%)",
          top: "38%", left: "25%",
          transform: "rotate(-3deg)",
        }}
      />

      {/* Badge */}
      <Reveal delay={0.3}>
        <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full glass text-sm mb-8" style={{ color: "#a5b4fc" }}>
          <Sparkles size={14} style={{ stroke: "url(#icon-grad-purple)" }} />
          <span>AI-alapú termékajánló motor streetwear webshopokhoz</span>
        </div>
      </Reveal>

      {/* Headline — Geist-inspired huge type */}
      <Reveal delay={0.4}>
        <h1
          className="text-center font-black leading-[0.92] mb-8"
          style={{ fontSize: "clamp(3rem, 8vw, 6.5rem)", letterSpacing: "-0.05em" }}
        >
          <span className="gradient-text">Okosabb ajánlás.</span>
          <br />
          <span className="text-white">Több konverzió.</span>
        </h1>
      </Reveal>

      {/* Subtitle — offset to the right for asymmetry */}
      <Reveal delay={0.5}>
        <p
          className="text-center mb-12 max-w-lg leading-relaxed"
          style={{ fontSize: "1.15rem", color: "#64748b", marginLeft: "auto", marginRight: "auto", paddingLeft: "2rem" }}
        >
          Magyar nyelvű, vizuális AI ajánlómotor — képelemzéssel, instant válaszidővel
          és beépíthető widgettel.
        </p>
      </Reveal>

      {/* CTA buttons */}
      <Reveal delay={0.6}>
        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <ShimmerButton href="#cta" variant="primary">
            Demo kérése <ArrowRight size={16} />
          </ShimmerButton>
          <ShimmerButton href="#mukodes" variant="ghost">
            Hogyan működik? <ArrowRight size={16} />
          </ShimmerButton>
        </div>
      </Reveal>

      {/* Video — 3D tilt + floating + mask fade */}
      <Reveal delay={0.7} className="w-full flex justify-center">
        <motion.div
          className="relative w-full max-w-5xl cursor-default"
          style={{ y: videoY, scale: videoScale }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { mouseX.set(0); mouseY.set(0); }}
        >
          <motion.div
            className="video-mask rounded-3xl overflow-hidden"
            style={{
              rotateX,
              rotateY,
              transformPerspective: 1200,
              boxShadow: "0 0 0 0.5px rgba(99,102,241,0.3), 0 0 60px rgba(99,102,241,0.15), 0 0 140px rgba(139,92,246,0.08)",
            }}
          >
            <video
              autoPlay muted loop playsInline
              className="w-full block"
              src="/demo.mp4"
            />
          </motion.div>
          {/* Floating glow beneath video */}
          <div
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              width: "70%", height: "80px",
              background: "radial-gradient(ellipse, rgba(99,102,241,0.2) 0%, transparent 70%)",
              filter: "blur(30px)",
            }}
          />
        </motion.div>
      </Reveal>

      {/* Stats — staggered, not centered */}
      <div className="relative z-10 mt-24 w-full max-w-4xl">
        <div className="flex flex-wrap justify-between gap-8">
          {[
            { value: "<1s", label: "válaszidő", sub: "INSTANT PATH" },
            { value: "1600+", label: "termék", sub: "egy katalógusban" },
            { value: "$0.002", label: "per keresés", sub: "átlagos költség" },
            { value: "20+", label: "szűrő", sub: "szín · típus · anyag" },
          ].map((s, i) => (
            <Reveal key={s.label} delay={0.8 + i * 0.1} direction={i % 2 === 0 ? "up" : "down"}>
              <div className="text-center">
                <div className="text-4xl font-black mb-1 gradient-text-blue tracking-tight">{s.value}</div>
                <div className="text-sm font-medium text-white">{s.label}</div>
                <div className="text-xs" style={{ color: "#475569" }}>{s.sub}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Feature card (asymmetric, floating content) ─────────────────────────────
interface FeatureCardProps {
  icon: React.ReactNode;
  label: string;
  title: string;
  desc: string;
  accent?: string;
  size?: "sm" | "md" | "lg" | "wide";
  extra?: React.ReactNode;
  delay?: number;
  direction?: "up" | "left" | "right";
}

function FeatureCard({ icon, label, title, desc, accent = "#6366f1", size = "sm", extra, delay = 0, direction = "up" }: FeatureCardProps) {
  const sizeClasses: Record<string, string> = {
    sm: "col-span-12 md:col-span-4",
    md: "col-span-12 md:col-span-6",
    lg: "col-span-12 md:col-span-8",
    wide: "col-span-12",
  };

  return (
    <Reveal direction={direction} delay={delay} className={sizeClasses[size]}>
      <div
        className="glass rounded-3xl p-7 h-full relative overflow-hidden group"
        style={{ borderWidth: "0.5px" }}
      >
        {/* Corner glow */}
        <div
          className="absolute -top-20 -right-20 w-60 h-60 pointer-events-none transition-opacity duration-500 opacity-40 group-hover:opacity-70"
          style={{ background: `radial-gradient(circle, ${accent}15 0%, transparent 70%)`, filter: "blur(40px)" }}
        />

        <div className="relative z-10 flex flex-col gap-4 h-full">
          {/* Icon + label */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${accent}12`, border: `0.5px solid ${accent}30` }}
            >
              <span style={{ color: accent }}>{icon}</span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>{label}</span>
          </div>

          {/* Content */}
          <div>
            <h3 className="font-bold text-white mb-2" style={{ fontSize: size === "lg" || size === "wide" ? "1.4rem" : "1.1rem", letterSpacing: "-0.02em" }}>
              {title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "#7c8ba1" }}>{desc}</p>
          </div>

          {/* Extra content floats at bottom */}
          {extra && <div className="mt-auto pt-2">{extra}</div>}
        </div>
      </div>
    </Reveal>
  );
}

// ─── Features section ────────────────────────────────────────────────────────
function Features() {
  const visionTags = ["logo nélküli", "oversized fit", "nyomott grafika", "teli nyomott", "kis logó", "felirattal"];
  const filterTags = ["szín", "típus", "anyag", "méret", "ár"];

  return (
    <section id="funkciok" className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header — left-aligned for asymmetry */}
        <Reveal direction="left">
          <div className="mb-20 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-xs font-bold uppercase tracking-[0.2em] mb-6" style={{ color: "#818cf8" }}>
              <Sparkles size={13} /> Képességek
            </div>
            <h2 className="font-black mb-5 leading-[0.95]" style={{ color: "white", fontSize: "clamp(2.2rem, 5vw, 3.5rem)", letterSpacing: "-0.04em" }}>
              Mindent tud, amit egy modern{" "}
              <span className="gradient-text">ajánlómotornak kell.</span>
            </h2>
            <p className="text-base" style={{ color: "#64748b" }}>Production-kész AI engine, nem prototípus.</p>
          </div>
        </Reveal>

        {/* Cards grid — 12-col, varied sizes */}
        <div className="grid grid-cols-12 gap-4">

          {/* INSTANT PATH — large */}
          <FeatureCard
            size="lg" delay={0.1} direction="left"
            icon={<Zap size={20} />} label="Instant PATH" accent="#6366f1"
            title="Sub-second válaszidő"
            desc="Import-kori AI leírás → kihagyja az LLM hívást. Embedding ranking + tárolt leírás = ~500ms. Nulla per-request LLM költség."
            extra={
              <div className="rounded-2xl p-4 flex flex-col gap-2.5 text-xs font-mono"
                style={{ background: "rgba(99,102,241,0.04)", border: "0.5px solid rgba(99,102,241,0.15)" }}>
                {[
                  ["hybridSearch()", "~12ms", "#4ade80"],
                  ["applyHardFilters()", "~3ms", "#4ade80"],
                  ["embedding rank", "~8ms", "#4ade80"],
                ].map(([k, v, c]) => (
                  <div key={k} className="flex justify-between items-center">
                    <span style={{ color: "#475569" }}>{k}</span>
                    <span style={{ color: c, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2.5" style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-white font-bold">TOTAL</span>
                  <span className="font-black" style={{ color: "#818cf8", fontSize: "1rem" }}>~500ms</span>
                </div>
              </div>
            }
          />

          {/* Vision AI — medium */}
          <FeatureCard
            size="sm" delay={0.2} direction="right"
            icon={<Eye size={20} />} label="Vision AI" accent="#a855f7"
            title="Képelemzés import-kor"
            desc="GPT-4o-mini elemzi a termékképet: logo, fit, grafika, szín. Keresés: 'logo nélküli oversized póló'."
            extra={
              <div className="flex flex-wrap gap-1.5">
                {visionTags.map(t => (
                  <span key={t} className="text-[11px] px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(168,85,247,0.1)", color: "#c4b5fd", border: "0.5px solid rgba(168,85,247,0.2)" }}>
                    {t}
                  </span>
                ))}
              </div>
            }
          />

          {/* HU Language — small */}
          <FeatureCard
            size="sm" delay={0.15}
            icon={<Globe size={20} />} label="Magyar nyelv" accent="#3b82f6"
            title="Natív HU + EN"
            desc="Ékezet nélkül is működik. Szín-szinonimák, ruházati szótár, cross-lingual embedding."
          />

          {/* Hard Filters — medium */}
          <FeatureCard
            size="md" delay={0.2} direction="left"
            icon={<SlidersHorizontal size={20} />} label="Hard filterek" accent="#3b82f6"
            title="Precíz szűrők, az AI előtt"
            desc="Szín, típus, anyag, méret, ár — szűrés az AI rangsorolás előtt fut. Nincs 'AI hallucináció': nem ajánl piros cipőt, ha kéket kértél."
            extra={
              <div className="flex flex-wrap gap-1.5">
                {filterTags.map(t => (
                  <span key={t} className="text-[11px] px-3 py-1 rounded-full inline-flex items-center gap-1.5"
                    style={{ background: "rgba(59,130,246,0.08)", color: "#93c5fd", border: "0.5px solid rgba(59,130,246,0.15)" }}>
                    <Check size={10} /> {t}
                  </span>
                ))}
              </div>
            }
          />

          {/* Embed Widget — small */}
          <FeatureCard
            size="sm" delay={0.25} direction="right"
            icon={<Code2 size={20} />} label="Widget" accent="#6366f1"
            title="1 script tag"
            desc="JS widget bármely webshopba. Buborék vagy panel mód, testreszabható dizájn. Zero dependency."
          />

          {/* Pipeline — wide */}
          <FeatureCard
            size="md" delay={0.3} direction="left"
            icon={<Layers size={20} />} label="Pipeline" accent="#06b6d4"
            title="3 szintű útvonalválasztás"
            desc="INSTANT → FAST → LLM PATH. Mindig a legolcsóbb és leggyorsabb utat választja. LLM hívás csak ha nincs import-kori leírás."
            extra={
              <div className="flex gap-2 text-xs font-mono">
                {[
                  { path: "INSTANT", time: "~0.5s", color: "#4ade80" },
                  { path: "FAST", time: "~8s", color: "#facc15" },
                  { path: "LLM", time: "~10s", color: "#f87171" },
                ].map(p => (
                  <div key={p.path} className="flex-1 rounded-xl px-3 py-2 text-center"
                    style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ color: p.color, fontWeight: 700 }}>{p.path}</div>
                    <div style={{ color: "#475569" }}>{p.time}</div>
                  </div>
                ))}
              </div>
            }
          />

          {/* Multi-partner */}
          <FeatureCard
            size="sm" delay={0.3} direction="right"
            icon={<Users size={20} />} label="Multi-partner" accent="#8b5cf6"
            title="Több shop, egy engine"
            desc="Partnerenkénti API kulcs, izolált katalógus, egyedi widget konfig."
          />

          {/* Analytics */}
          <FeatureCard
            size="sm" delay={0.35}
            icon={<BarChart3 size={20} />} label="Analitika" accent="#6366f1"
            title="Admin dashboard"
            desc="Keresési statisztikák, feedback-gyűjtés, katalógus-kezelés — böngészőből."
          />
        </div>
      </div>
    </section>
  );
}

// ─── How it works ────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: <Cpu size={24} />,
      title: "Katalógus import",
      desc: "CSV vagy JSON feltöltés. Az engine automatikusan generál embedding vektort és AI leírást minden termékhez — képelemzéssel, importkor.",
      accent: "#6366f1",
    },
    {
      num: "02",
      icon: <Code2 size={24} />,
      title: "Widget beillesztés",
      desc: "Egy script tag a webshopba. A widget testreszabható: szín, szövegek, pozíció — mindent a widget editorból.",
      accent: "#8b5cf6",
    },
    {
      num: "03",
      icon: <Brain size={24} />,
      title: "AI ajánl, vásárló konvertál",
      desc: "A vásárló leírja, mit keres — magyarul, ékezet nélkül, szlenggel is. Hybrid search + hard filter + embedding ranking = releváns termékek.",
      accent: "#3b82f6",
    },
  ];

  return (
    <section id="mukodes" className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header — right-aligned for asymmetric contrast with Features */}
        <Reveal direction="right">
          <div className="mb-20 max-w-2xl ml-auto text-right">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-xs font-bold uppercase tracking-[0.2em] mb-6" style={{ color: "#818cf8" }}>
              <Layers size={13} /> Működés
            </div>
            <h2 className="font-black mb-5 leading-[0.95]" style={{ color: "white", fontSize: "clamp(2.2rem, 5vw, 3.5rem)", letterSpacing: "-0.04em" }}>
              Három lépés az első{" "}
              <span className="gradient-text">AI ajánlásig.</span>
            </h2>
          </div>
        </Reveal>

        {/* Steps — overlapping, staggered layout */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Connecting line */}
          <div
            className="hidden md:block absolute top-1/2 left-0 right-0 pointer-events-none"
            style={{
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.2) 20%, rgba(139,92,246,0.2) 80%, transparent)",
            }}
          />

          {steps.map((step, i) => (
            <Reveal key={step.num} delay={0.15 * i} direction={i === 0 ? "left" : i === 2 ? "right" : "up"}>
              <div
                className="glass rounded-3xl p-8 relative overflow-hidden group"
                style={{
                  marginTop: i === 1 ? "-20px" : i === 2 ? "20px" : "0",
                  borderWidth: "0.5px",
                }}
              >
                {/* Top accent bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] rounded-t-3xl opacity-60 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(90deg, ${step.accent}, transparent)` }}
                />

                {/* Big watermark number */}
                <div
                  className="absolute -top-4 -right-2 text-8xl font-black select-none pointer-events-none"
                  style={{ color: `${step.accent}08`, lineHeight: 1 }}
                >
                  {step.num}
                </div>

                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: `${step.accent}10`, border: `0.5px solid ${step.accent}25` }}
                >
                  <span style={{ color: step.accent }}>{step.icon}</span>
                </div>

                <h3 className="font-bold text-xl mb-3 text-white tracking-tight">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#7c8ba1" }}>{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ─────────────────────────────────────────────────────────────────────
function CTA() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch("https://formspree.io/f/mwvwvjbk", {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        setSubmitted(true);
        form.reset();
      }
    } catch {}
    setSending(false);
  };

  return (
    <section id="cta" className="relative py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <Reveal>
          <div className="glass rounded-[2rem] p-14 relative overflow-hidden text-center" style={{ borderWidth: "0.5px" }}>
            {/* Background glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(99,102,241,0.06) 0%, transparent 70%)",
              }}
            />

            <div className="relative z-10">
              <div
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-[0.2em] mb-8"
                style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "0.5px solid rgba(99,102,241,0.2)" }}
              >
                <ShieldCheck size={14} /> Kockázatmentes demo
              </div>

              <h2
                className="font-black mb-5 leading-[0.95]"
                style={{ color: "white", fontSize: "clamp(2rem, 5vw, 3.2rem)", letterSpacing: "-0.04em" }}
              >
                Integráld a webshopodba
                <br />
                <span className="gradient-text">már ma.</span>
              </h2>

              <p className="mb-10 max-w-md mx-auto text-base leading-relaxed" style={{ color: "#64748b" }}>
                Mutasd meg a katalógusodat és megnézzük, hogyan működne nálad.
                Az első integráció általában 1-2 nap.
              </p>

              {submitted ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(74,222,128,0.1)", border: "0.5px solid rgba(74,222,128,0.3)" }}>
                    <Check size={28} style={{ color: "#4ade80" }} />
                  </div>
                  <p className="text-lg font-semibold text-white">Köszönjük! Hamarosan jelentkezünk.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="max-w-md mx-auto flex flex-col gap-4">
                  <input
                    type="text" name="name" required placeholder="Neved"
                    className="w-full px-5 py-3.5 rounded-2xl text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200 focus:ring-2 focus:ring-indigo-500/40"
                    style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)" }}
                  />
                  <input
                    type="email" name="email" required placeholder="E-mail címed"
                    className="w-full px-5 py-3.5 rounded-2xl text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200 focus:ring-2 focus:ring-indigo-500/40"
                    style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)" }}
                  />
                  <input
                    type="text" name="shop_url" placeholder="Webshop URL (opcionális)"
                    className="w-full px-5 py-3.5 rounded-2xl text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200 focus:ring-2 focus:ring-indigo-500/40"
                    style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)" }}
                  />
                  <textarea
                    name="message" rows={3} placeholder="Üzenet (opcionális)"
                    className="w-full px-5 py-3.5 rounded-2xl text-sm text-white placeholder:text-slate-500 outline-none resize-none transition-all duration-200 focus:ring-2 focus:ring-indigo-500/40"
                    style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)" }}
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="shimmer-btn inline-flex items-center justify-center gap-2 px-7 py-3.5 font-semibold text-white rounded-2xl transition-all duration-300 disabled:opacity-60"
                    style={{
                      background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #7c3aed 100%)",
                      boxShadow: "0 0 40px rgba(99,102,241,0.25), 0 4px 20px rgba(0,0,0,0.3)",
                    }}
                  >
                    {sending ? "Küldés..." : <>Demo kérése <ArrowRight size={16} /></>}
                  </button>
                </form>
              )}

              <div className="flex flex-wrap justify-center gap-8 mt-10">
                {[
                  "Magyar webshopokra optimalizált",
                  "Import 5 perc alatt",
                  "Sub-second válaszidő",
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm" style={{ color: "#64748b" }}>
                    <Check size={13} style={{ color: "#4ade80" }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="py-10 px-6" style={{ borderTop: "0.5px solid rgba(255,255,255,0.04)" }}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <a href="#" className="flex items-center gap-2">
          <div className="rounded-lg p-1.5" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            <Sparkles size={14} color="white" />
          </div>
          <span className="font-bold text-white">mitvegyek.ai</span>
        </a>
        <p className="text-sm" style={{ color: "#1e293b" }}>2025 mitvegyek.ai — AI termékajánló motor</p>
      </div>
    </footer>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div style={{ background: "#050509", minHeight: "100vh", position: "relative" }}>
      <GradientDefs />
      <GlowBlobs />
      <div style={{ position: "relative", zIndex: 1 }}>
        <Navbar />
        <Hero />
        <Features />
        <HowItWorks />
        <CTA />
        <Footer />
      </div>
    </div>
  );
}
