import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { motion, type Variants } from "motion/react";

import { SuiSureLogo } from "@/components/brand/Logo";
import CosmicDust from "@/components/lightswind/cosmic-dust";
import ParticleGlobe from "@/components/lightswind/particle-globe";
import GrainCarousel, { type GrainCarouselItem } from "@/components/lightswind/grain-carousel";
import ScrollList from "@/components/lightswind/scroll-list";
import Footer17 from "@/components/ui/footer";

import qrAsset from "@/assets/image-5.png.asset.json";
import payAsset from "@/assets/image-6.png.asset.json";
import controlAsset from "@/assets/image-7.png.asset.json";

import { SUI_CONFIG } from "@/config/sui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SuiSure — Understand it. Verify it. Pay safely." },
      {
        name: "description",
        content:
          "SuiSure is an AI-assisted payment app on Sui. Pay verified merchants by QR or plain language, and stay in control of every transaction.",
      },
      { property: "og:title", content: "SuiSure — Understand it. Verify it. Pay safely." },
      {
        property: "og:description",
        content:
          "Pay verified merchants by QR or plain language on Sui Testnet. You review and approve every payment.",
      },
    ],
  }),
  component: Landing,
});

const carouselItems: GrainCarouselItem[] = [
  {
    id: "qr",
    badge: "Start",
    title: "Pay by QR or plain language",
    subtitle: "Scan, upload a screenshot, or simply tell SuiSure what you want to pay.",
    imageA: qrAsset.url,
    imageB: payAsset.url,
    accentColor: "#7CE0FF",
  },
  {
    id: "verify",
    badge: "Verify",
    title: "Verify merchants first",
    subtitle: "Every merchant and payment request is checked against Sui before you pay.",
    imageA: payAsset.url,
    imageB: controlAsset.url,
    accentColor: "#7CE0FF",
  },
  {
    id: "control",
    badge: "Control",
    title: "You stay in control",
    subtitle: "The assistant explains the payment. Only your signature can send it.",
    imageA: controlAsset.url,
    imageB: qrAsset.url,
    accentColor: "#7CE0FF",
  },
];


const sectionVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const softReveal: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", mass: 0.9, stiffness: 90, damping: 18 },
  },
};

const navLinks = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Verification", href: "#steps" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 w-full border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <SuiSureLogo />
            <nav className="hidden items-center gap-1 sm:flex">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-3 py-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <Button asChild size="sm">
            <Link to="/login">Get Started</Link>
          </Button>
        </div>
      </header>

      <div className="hero-aurora relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(100%_80%_at_50%_10%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_50%),radial-gradient(80%_70%_at_15%_80%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_45%),radial-gradient(70%_60%_at_90%_70%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_40%),linear-gradient(to_bottom,transparent,oklch(0.09_0.006_260))]" />
        <div className="pointer-events-none absolute inset-0 z-0">
          <CosmicDust particleCount={90} speedMultiplier={1.0} particleSize={1.8} theme="dark" />
        </div>
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(55%_40%_at_50%_20%,oklch(0.09_0.006_260/0.75),transparent_75%)]" />

        <section className="relative z-10">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-20 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]"
          >
            <div className="text-left">
              <motion.span
                variants={softReveal}
                className="glass-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-primary"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Powered by {SUI_CONFIG.networkLabel}
              </motion.span>

              <motion.h1
                variants={softReveal}
                className="mt-6 text-5xl font-bold uppercase leading-[0.95] tracking-tight text-foreground sm:text-7xl"
              >
                You Sure
                <br />
                <span className="bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent">
                  or Not???
                </span>
              </motion.h1>

              <motion.p
                variants={softReveal}
                className="mt-5 max-w-md text-base text-muted-foreground sm:text-lg"
              >
                Before you pay, WE understand, WE verify, WE asks, &ldquo;You Sure or Not?&rdquo;
              </motion.p>

              <motion.div
                variants={softReveal}
                className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
              >
                <Button asChild size="lg" className="w-full rounded-full sm:w-auto">
                  <Link to="/login">
                    Start Journey <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full border-border bg-transparent sm:w-auto"
                >
                  <a href="#how-it-works">Explore More</a>
                </Button>
              </motion.div>
            </div>

            <motion.div
              variants={softReveal}
              className="relative hidden h-[420px] items-center justify-center lg:flex"
            >
              <div className="pointer-events-none absolute right-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_70%)] blur-3xl" />
              <ParticleGlobe className="relative h-full w-full" />
            </motion.div>
          </motion.div>
        </section>


        <main className="relative z-10 mx-auto max-w-5xl px-5 pb-20">
          <section id="how-it-works" className="scroll-mt-24 py-16 sm:py-20">
            <h2 className="text-center text-3xl font-bold uppercase tracking-tight text-foreground sm:text-4xl">
              Built So You Always Know What You Are Paying
            </h2>
            <GrainCarousel
              items={carouselItems}
              cardWidth={280}
              maxTilt={14}
              lift={36}
              foilVariant="cosmic-cyan"
              grainAmount={0.3}
              autoplay
              autoplayInterval={5000}
            />
          </section>


          <section id="steps" className="scroll-mt-24 py-16 sm:py-20">
            <h2 className="text-center text-3xl font-bold uppercase tracking-tight text-foreground sm:text-4xl">
              Three Steps. Every Time.
            </h2>
            <ScrollList
              className="mx-auto mt-3 h-[460px] max-w-2xl"
              itemHeight={185}
              data={[
                {
                  title: "Start a payment",
                  description: "Scan a merchant QR, upload an image, or just ask SuiSure.",
                },
                {
                  title: "Review the details",
                  description: "Merchant, amount, recipient and expiry are checked on Sui.",
                },
                {
                  title: "Approve it yourself",
                  description: "Confirm and Pay signs the transaction. Decline stops it.",
                },
              ]}
              renderItem={(item, index) => (
                <div className="surface-card flex h-full items-center gap-6 p-7 sm:gap-8 sm:p-9">
                  <span className="bg-gradient-to-b from-primary to-foreground bg-clip-text text-7xl font-bold leading-none text-transparent sm:text-8xl">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xl font-semibold text-foreground sm:text-2xl">{item.title}</p>
                    <p className="mt-1 text-base text-muted-foreground sm:text-lg">
                      {item.description}
                    </p>
                  </div>
                </div>
              )}
            />
          </section>

        </main>
      </div>

      <Footer17
        heading="Connect\nwith us."
        brandName="SuiSure"
        navColumns={[
          {
            title: "Menu",
            links: [
              { label: "How it works", href: "#how-it-works" },
              { label: "Verification", href: "#steps" },
              { label: "Get started", href: "/login" },
            ],
          },
          {
            title: "Office",
            links: [
              { label: "Asia Pacific University of Technology and Innovation", href: "#" },
              { label: "Bukit Jalil, Kuala Lumpur", href: "#" },
              { label: "Malaysia", href: "#" },
            ],
          },
        ]}
        socialLinks={[
          { label: "LINKEDIN", href: "/coming-soon", icon: "linkedin" },
          { label: "TWITTER", href: "/coming-soon", icon: "twitter" },
          { label: "GITHUB", href: "https://github.com/fieqah-faisal/SuiSure-MUBA2026-Cuties.git", icon: "github" },
        ]}
        legalText="© 2026 SuiSure by Cuties - Build at MUBA Blockchain Hackathon 2026 on Sui. All rights reserved."
        bottomLinks={[
          { label: "Terms of Service", href: "#" },
          { label: "Privacy Policy", href: "#" },
        ]}
      />
    </div>
  );
}

