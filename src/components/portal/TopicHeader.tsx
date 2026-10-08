import Link from "next/link";
import { Swords, Atom, Baby, Bone, Droplets, Eye, Fish, FlaskConical, Layers, ShieldPlus, Shuffle, Sprout, Trees, Utensils, Wind, Brain, ChevronRight, Dna, Heart, Droplet, Globe2, HeartPulse, Landmark, Map, Microscope, Mountain, PersonStanding, QrCode, Route, Sun, type LucideIcon } from "lucide-react";
import type { SubjectIcon, TopicIcon } from "@/lib/subjects";
import { Logo } from "./ui";

export const SUBJECT_ICONS: Record<SubjectIcon, LucideIcon> = { biology: HeartPulse, geography: Globe2, history: Landmark };

export const TOPIC_ICONS: Record<TopicIcon, LucideIcon> = {
  body: PersonStanding,
  heart: Heart,
  nerve: Brain,
  journey: Route,
  atom: Atom,
  tissue: Layers,
  bone: Bone,
  lungs: Wind,
  digest: Utensils,
  kidney: Droplets,
  eye: Eye,
  hormone: FlaskConical,
  health: ShieldPlus,
  baby: Baby,
  genetics: Shuffle,
  evolution: Fish,
  plant: Sprout,
  eco: Trees,
  battle: Swords,
  blood: Droplet,
  dna: Dna,
  cell: Microscope,
  map: Map,
  mountain: Mountain,
  climate: Sun,
  qr: QrCode,
};

/**
 * The same top bar on every topic page: portal mark, the path (Subjects › Biology › Blood) and
 * room for the topic's own buttons on the right.
 */
export function TopicHeader({
  subject,
  topic,
  color,
  icon,
  children,
}: {
  subject: { name: string; href: string };
  topic: string;
  color: string;
  icon: TopicIcon;
  children?: React.ReactNode;
}) {
  const Icon = TOPIC_ICONS[icon];
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#e2e7e5] bg-white px-4 [view-transition-name:site-header]">
      <Link href="/dashboard" aria-label="მთავარი" title="მთავარი" className="shrink-0">
        <Logo className="size-8" />
      </Link>
      <nav aria-label="გზა" className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="shrink-0 text-[#66736f] hover:text-[#111a18] max-sm:hidden">
          საგნები
        </Link>
        <ChevronRight className="size-4 shrink-0 text-[#c3ccc9] max-sm:hidden" />
        <Link href={subject.href} className="shrink-0 text-[#66736f] hover:text-[#111a18]">
          {subject.name}
        </Link>
        <ChevronRight className="size-4 shrink-0 text-[#c3ccc9]" />
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: color }}>
            <Icon className="size-3.5" />
          </span>
          <span className="truncate">{topic}</span>
        </span>
      </nav>
      <div className="ms-auto flex items-center gap-1">{children}</div>
    </header>
  );
}
