import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip, cardLink } from "./ui";

/*
 * Cards for hubs: one shape for every topic (number, icon, title, one-line description, grade chip),
 * a wide one for the big 3D experiences, and a quiet one for topics that are still being prepared.
 */

interface CardBase {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Subject accent colour. */
  color: string;
  grades?: string;
}

/** The standard topic card; all cards in a grid have the same height. */
export function TopicCard({ href, title, description, icon: Icon, color, grades, number, meta }: CardBase & { number?: number; /** Replaces the grade chip, e.g. "12 გაკვეთილი · 3 3D". */ meta?: string }) {
  return (
    <Link href={href} className={cn(cardLink, "h-full p-5")}>
      <span className="flex items-start justify-between gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1a`, color }}>
          <Icon className="size-6" aria-hidden />
        </span>
        {number !== undefined && (
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-chip px-2 text-xs font-semibold text-mute tabular-nums" aria-label={`№ ${number}`}>
            {number}
          </span>
        )}
      </span>
      <span className="mt-4 text-base leading-snug font-semibold text-ink">{title}</span>
      <span className="mt-1.5 line-clamp-2 text-sm leading-6 text-mute">{description}</span>
      <span className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-2 pt-4">
        {meta ? <Chip className="max-w-full">{meta}</Chip> : grades ? <Chip>{grades} კლასი</Chip> : <span />}
        <span className="ms-auto flex shrink-0 items-center gap-1.5 text-sm font-semibold whitespace-nowrap" style={{ color }}>
          გახსნა
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </span>
    </Link>
  );
}

/** A big 3D experience: preview on the left (or a tinted panel with the icon), text and call to action on the right. */
export function FeaturedCard({ href, title, description, icon: Icon, color, grades, image, label = "3D" }: CardBase & { image?: string; label?: string }) {
  return (
    <Link href={href} className={cn(cardLink, "h-full md:flex-row")}>
      {image ? (
        <span className="relative block aspect-[16/9] border-b border-line bg-chip md:aspect-auto md:min-h-48 md:w-[44%] md:shrink-0 md:border-r md:border-b-0">
          <Image src={image} alt="" fill sizes="(min-width: 768px) 28vw, 100vw" className="object-cover object-top" />
        </span>
      ) : (
        <span
          className="flex aspect-[16/9] items-center justify-center border-b border-line md:aspect-auto md:min-h-48 md:w-[44%] md:shrink-0 md:border-r md:border-b-0"
          style={{ background: `linear-gradient(135deg, ${color}14, ${color}38)` }}
        >
          <Icon className="size-16" style={{ color }} strokeWidth={1.4} aria-hidden />
        </span>
      )}
      <span className="flex flex-1 flex-col p-5 sm:p-6">
        <span className="flex flex-wrap items-center gap-2">
          <Chip tone="dark">
            <Box className="size-3" aria-hidden />
            {label}
          </Chip>
          {grades && <Chip>{grades} კლასი</Chip>}
        </span>
        <span className="mt-3 text-xl leading-snug font-heading text-ink">{title}</span>
        <span className="mt-2 line-clamp-4 text-[15px] leading-7 text-copy">{description}</span>
        <span className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold" style={{ color }}>
          გახსნა
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </span>
    </Link>
  );
}

/** Dark shortcut into a 3D model or journey: icon tile, name, one muted line, arrow. */
export function ToolCard({ href, title, sub, icon: Icon }: { href: string; title: string; sub: string; icon: LucideIcon }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl bg-ink p-4 text-white outline-none transition-colors hover:bg-[#2a3532] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/10">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block leading-6 font-semibold [overflow-wrap:anywhere]">{title}</span>
        <span className="block truncate text-xs text-white/70">{sub}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-white/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** A topic that is not ready yet: same footprint as a topic card, visibly inactive. */
export function SoonCard({ title, description, icon: Icon }: Pick<CardBase, "title" | "description" | "icon">) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-dashed border-line-strong bg-white/60 p-5">
      <span className="flex items-start justify-between gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-chip text-faint">
          <Icon className="size-6" aria-hidden />
        </span>
        <Chip>მალე</Chip>
      </span>
      <span className="mt-4 text-base leading-snug font-semibold text-copy">{title}</span>
      <span className="mt-1.5 line-clamp-2 text-sm leading-6 text-faint">{description}</span>
    </div>
  );
}
