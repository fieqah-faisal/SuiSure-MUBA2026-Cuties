import { ArrowUpRight } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { FaGithub, FaLinkedin, FaTwitter } from "react-icons/fa";

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const riseItem: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", duration: 0.6, bounce: 0 },
  },
};

const giantTextVariant: Variants = {
  hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", duration: 0.8, bounce: 0 },
  },
};

export interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

export interface Footer17Props {
  heading?: string;
  brandName?: string;
  navColumns?: FooterColumn[];
  socialLinks?: { label: string; href: string; icon?: "linkedin" | "twitter" | "github" }[];
  legalText?: string;
  bottomLinks?: { label: string; href: string }[];
}

const socialIconMap = {
  linkedin: FaLinkedin,
  twitter: FaTwitter,
  github: FaGithub,
};

export default function Footer17({
  heading = "Connect\nwith us.",
  brandName = "SuiSure",
  navColumns = [
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
  ],
  socialLinks = [
    { label: "LINKEDIN", href: "/coming-soon", icon: "linkedin" },
    { label: "TWITTER", href: "/coming-soon", icon: "twitter" },
    {
      label: "GITHUB",
      href: "https://github.com/fieqah-faisal/SuiSure-MUBA2026-Cuties.git",
      icon: "github",
    },
  ],
  legalText = "© 2026 SuiSure by Cuties - Build at MUBA Blockchain Hackathon 2026 on Sui. All rights reserved.",
  bottomLinks = [
    { label: "Terms of Service", href: "#" },
    { label: "Privacy Policy", href: "#" },
  ],
}: Footer17Props) {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-background text-foreground">
      {/* Noise Background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Vertical Floating Contact Text */}
      <div className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 -rotate-90 lg:block">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Contact
        </span>
      </div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={staggerContainer}
        className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20"
      >
        {/* Top Section */}
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <motion.div variants={riseItem} className="relative">
            <h2 className="max-w-md text-4xl font-bold uppercase leading-[0.95] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {heading.split(/\\n|\n/).map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </h2>

            {/* Corner Arrow SVG */}
            <div className="absolute -right-2 top-0 hidden h-10 w-10 items-center justify-center rounded-full border border-border lg:flex">
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </motion.div>

          <div className="grid gap-8 sm:grid-cols-2">
            {navColumns.map((col, idx) => (
              <motion.div key={col.title} variants={riseItem} custom={idx}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {col.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {col.links.map((link, lIdx) => (
                    <li key={lIdx}>
                      <a
                        href={link.href}
                        className="group inline-flex items-center gap-1 text-sm font-medium text-foreground transition-colors hover:text-primary"
                      >
                        {link.label}
                        <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </a>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Middle Section: Divider & Socials */}
        <motion.div
          variants={riseItem}
          className="my-12 flex flex-col items-start justify-between gap-6 border-y border-border py-6 sm:flex-row sm:items-center"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Follow us
          </span>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {socialLinks.map((link, idx) => {
              const Icon = link.icon ? socialIconMap[link.icon] : null;
              const isExternal = link.href.startsWith("http");
              return (
                <a
                  key={idx}
                  href={link.href}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className="group flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:text-primary"
                >
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  {link.label}
                  <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              );
            })}
          </div>
        </motion.div>

        {/* Lower Section: Giant Text & Legal */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          {/* Giant Brand Name */}
          <motion.div variants={giantTextVariant} className="overflow-hidden">
            <span className="block text-6xl font-bold uppercase leading-none tracking-tighter text-foreground sm:text-7xl md:text-8xl lg:text-9xl">
              {brandName}
            </span>
          </motion.div>

          <div className="flex max-w-md flex-col gap-4 text-left lg:text-right">
            <motion.p variants={riseItem} className="text-xs leading-relaxed text-muted-foreground">
              {legalText}
            </motion.p>

            {bottomLinks.length > 0 ? (
              <motion.div variants={riseItem} className="flex flex-wrap gap-4 lg:justify-end">
                {bottomLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.href}
                    className="text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  >
                    {link.label}
                  </a>
                ))}
              </motion.div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </footer>
  );
}
