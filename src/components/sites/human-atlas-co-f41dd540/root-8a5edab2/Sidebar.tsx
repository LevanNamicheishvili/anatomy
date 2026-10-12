"use client";

import Link from "next/link";
import {
  Activity,
  BookOpen,
  ChevronRight,
  EyeOff,
  GalleryVerticalEnd,
  GraduationCap,
  HeartPulse,
  Layers,
  ListChecks,
  Pause,
  PenLine,
  PersonStanding,
  Play,
  Presentation,
  QrCode,
  Waves,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LabeledSlider, PillButton, SegmentedTabs } from "@/components/portal/controls";
import type { LessonKey } from "./anatomy-groups";
import type { AnimationSettings } from "./anatomy-viewer";
import { SYSTEMS, type PresetKey, type SystemKey } from "./atlas-data";
import type { Strings } from "./i18n";
import { SwitchRow, btnGhost, btnPrimary, btnSecondary, iconBtn, sectionLabel } from "./primitives";
import { ANIMATED_POSES, STATIC_POSES, type PoseKey } from "./rig";
import { LEVELS, topicFitsLevel, type Level } from "./learn-data";
import { TOPICS } from "./topics";

export type SidebarTab = "systems" | "animations" | "topics" | "learn";

const LESSON_ICONS: Record<LessonKey, LucideIcon> = {
  heart: HeartPulse,
  breathing: Wind,
  circulation: Waves,
};

const ACCENT = "#0f8a74";

/*
 * Every tab has the same rhythm: a padded scroll area, a small heading per block, and either rows grouped
 * in one rounded card (switches) or separate cards (things that open or start something).
 * Actions that end a state ("stop animations") sit in a footer that never scrolls away.
 */
const scrollArea = "atlas-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-5";
const blockTitle = cn(sectionLabel, "mt-5 mb-2");
const group = "divide-y divide-[#e2e7e5] overflow-hidden rounded-xl border border-[#e2e7e5] bg-white";
const footer = "flex shrink-0 flex-col gap-2 border-t border-[#e2e7e5] px-4 py-3";

/** Tinted square at the start of a card: an icon or a letter in the item's colour. */
function Tile({ color = ACCENT, children }: { color?: string; children: React.ReactNode }) {
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[15px] font-semibold"
      style={{ backgroundColor: `${color}1a`, color }}
      aria-hidden
    >
      {children}
    </span>
  );
}

/** A card that opens or starts something: tile, title, one line of explanation, optional chevron. */
function ActionCard({
  lead,
  title,
  body,
  active,
  chevron = false,
  onClick,
}: {
  lead: React.ReactNode;
  title: string;
  body?: string;
  /** Set for cards that show the current choice (lesson, topic); left out for plain actions. */
  active?: boolean;
  chevron?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-16 w-full items-center gap-3 rounded-xl border p-3 text-start transition-[background-color,border-color] outline-none focus-visible:ring-2 focus-visible:ring-[#0f8a74]/50",
        active ? "border-[#0f8a74]/45 bg-[#e6f3ef]" : "border-[#e2e7e5] bg-white hover:border-[#d5dcd9] hover:bg-[#f5f7f6]",
      )}
    >
      {lead}
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <span className={cn("block text-sm leading-5 font-semibold", active ? "text-[#0c5c4d]" : "text-[#111a18]")}>{title}</span>
        {body && <span className="mt-0.5 block text-[13px] leading-5 text-[#66736f]">{body}</span>}
      </span>
      {chevron && <ChevronRight className="size-4 shrink-0 text-[#97a29e]" aria-hidden />}
    </button>
  );
}

function SystemsTab({
  t,
  enabled,
  counts,
  activePreset,
  visibleLabel,
  anyVisible,
  onToggle,
  onPreset,
  onToggleAll,
  hiddenSystems = [],
}: {
  t: Strings;
  /** Systems left out of the list entirely (the reproductive system unless a teacher shows it). */
  hiddenSystems?: SystemKey[];
  enabled: Set<SystemKey>;
  counts: Record<SystemKey, string>;
  activePreset: PresetKey | null;
  visibleLabel: string;
  anyVisible: boolean;
  onToggle: (key: SystemKey, on: boolean) => void;
  onPreset: (key: PresetKey) => void;
  onToggleAll: () => void;
}) {
  return (
    <>
      <div className="shrink-0 px-4 pt-4 pb-3">
        <SegmentedTabs<PresetKey>
          equal
          label={t.systems}
          options={(["all", "skeleton", "organs"] as const).map((key) => ({ id: key, label: t.presets[key] }))}
          value={activePreset}
          onChange={onPreset}
        />
      </div>

      <div className={scrollArea}>
        <ul className={group}>
          {SYSTEMS.filter((s) => !hiddenSystems.includes(s.key)).map((s) => {
            const on = enabled.has(s.key);
            return (
              <li key={s.key}>
                <SwitchRow
                  checked={on}
                  onChange={(v) => onToggle(s.key, v)}
                  label={t.systemNames[s.key]}
                  meta={counts[s.key]}
                  lead={<span className="size-3 shrink-0 rounded-full transition-opacity" style={{ backgroundColor: s.dot, opacity: on ? 1 : 0.35 }} aria-hidden />}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-t border-[#e2e7e5] ps-4 pe-2">
        <span className="min-w-0 truncate text-[13px] text-[#66736f] tabular-nums" title={visibleLabel}>
          {visibleLabel}
        </span>
        <button type="button" onClick={onToggleAll} className={btnGhost}>
          {anyVisible ? t.hideAll : t.showAll}
        </button>
      </div>
    </>
  );
}

function PoseGrid({ t, pose, keys, onPose }: { t: Strings; pose: PoseKey; keys: PoseKey[]; onPose: (key: PoseKey) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {keys.map((key) => (
        <PillButton
          key={key}
          icon={ANIMATED_POSES.includes(key) ? Play : PersonStanding}
          pressed={pose === key}
          onClick={() => onPose(key)}
          className="min-h-11 min-w-0 justify-start rounded-lg px-3 py-2 text-start leading-5 whitespace-normal [overflow-wrap:anywhere]"
        >
          {t.poses[key]}
        </PillButton>
      ))}
    </div>
  );
}

function AnimationsTab({
  t,
  lesson,
  anim,
  pose,
  onLesson,
  onAnim,
  onPose,
  onWholeBody,
  onStop,
}: {
  t: Strings;
  lesson: LessonKey | null;
  anim: AnimationSettings;
  pose: PoseKey;
  onLesson: (key: LessonKey) => void;
  onAnim: (next: AnimationSettings) => void;
  onPose: (key: PoseKey) => void;
  onWholeBody: () => void;
  onStop: () => void;
}) {
  const animating = anim.heartbeat || anim.breathing || anim.bloodFlow;
  const toggles = [
    { key: "heartbeat", icon: HeartPulse },
    { key: "breathing", icon: Wind },
    { key: "bloodFlow", icon: Waves },
  ] as const;

  return (
    <>
      <div className={scrollArea}>
        <h3 className={blockTitle}>{t.lessonsTitle}</h3>
        <div className="flex flex-col gap-2">
          {(["heart", "breathing", "circulation"] as const).map((key) => {
            const Icon = LESSON_ICONS[key];
            return (
              <ActionCard
                key={key}
                lead={
                  <Tile>
                    <Icon className="size-5" strokeWidth={2} />
                  </Tile>
                }
                title={t.lessons[key].title}
                body={t.lessons[key].body}
                active={lesson === key}
                onClick={() => onLesson(key)}
              />
            );
          })}
        </div>

        <h3 className={blockTitle}>{t.animations}</h3>
        <ul className={group}>
          {toggles.map(({ key, icon: Icon }) => (
            <li key={key}>
              <SwitchRow
                checked={anim[key]}
                onChange={(v) => onAnim({ ...anim, [key]: v })}
                label={t[key]}
                lead={<Icon className={cn("size-[18px] shrink-0", anim[key] ? "text-[#0f8a74]" : "text-[#66736f]")} strokeWidth={2} aria-hidden />}
              />
            </li>
          ))}
          <li className="px-3 pt-3 pb-2">
            <LabeledSlider
              label={t.heartRate}
              value={anim.bpm}
              display={`${anim.bpm} ${t.bpmUnit}`}
              min={40}
              max={160}
              onChange={(bpm) => onAnim({ ...anim, bpm })}
            />
          </li>
        </ul>

        <h3 className={blockTitle}>{t.posesTitle}</h3>
        <PoseGrid t={t} pose={pose} keys={STATIC_POSES} onPose={onPose} />
        <h3 className={blockTitle}>{t.movesTitle}</h3>
        <PoseGrid t={t} pose={pose} keys={ANIMATED_POSES} onPose={onPose} />
      </div>

      {(lesson || animating) && (
        <div className={footer}>
          {animating && (
            <button type="button" onClick={onStop} className={cn(btnPrimary, "w-full")}>
              <Pause className="size-4" />
              {t.stopAll}
            </button>
          )}
          {lesson && (
            <button type="button" onClick={onWholeBody} className={cn(btnSecondary, "w-full")}>
              {t.wholeBody}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function TopicsTab({ t, active, level, onOpen }: { t: Strings; active: string | null; level: Level; onOpen: (slug: string) => void }) {
  return (
    <>
      <div className={scrollArea}>
        <h3 className={blockTitle}>{t.topicsTitle}</h3>
        <ul className="flex flex-col gap-2">
          {TOPICS.filter((topic) => topicFitsLevel(topic.slug, level)).map((topic) => (
            <li key={topic.slug}>
              <ActionCard
                lead={<Tile color={topic.color}>{topic.title.charAt(0)}</Tile>}
                title={topic.title}
                body={topic.subtitle}
                active={active === topic.slug}
                chevron
                onClick={() => onOpen(topic.slug)}
              />
            </li>
          ))}
        </ul>
      </div>
      <div className={footer}>
        <Link href="/qr" className={cn(btnSecondary, "w-full")}>
          <QrCode className="size-4" />
          {t.printQr}
        </Link>
      </div>
    </>
  );
}

function LearnTab({
  level,
  onLevel,
  onQuiz,
  onCards,
  board,
  onBoard,
  drawing,
  onDraw,
  sensitive,
}: {
  level: Level;
  onLevel: (level: Level) => void;
  onQuiz: () => void;
  onCards: () => void;
  board: boolean;
  onBoard: () => void;
  drawing: boolean;
  onDraw: () => void;
  /** Only for teachers and admins: whether the reproductive organs are shown. */
  sensitive?: { on: boolean; onToggle: () => void };
}) {
  const lead = (Icon: LucideIcon, on: boolean) => (
    <Icon className={cn("size-[18px] shrink-0", on ? "text-[#0f8a74]" : "text-[#66736f]")} strokeWidth={2} aria-hidden />
  );
  return (
    <div className={scrollArea}>
      <h3 className={blockTitle}>საფეხური</h3>
      <SegmentedTabs<Level>
        equal
        label="საფეხური"
        options={LEVELS.map((l) => ({ id: l.key, label: l.name, hint: l.grades }))}
        value={level}
        onChange={onLevel}
      />

      <h3 className={blockTitle}>ვარჯიში</h3>
      <div className="flex flex-col gap-2">
        <ActionCard
          lead={
            <Tile>
              <ListChecks className="size-5" />
            </Tile>
          }
          title="ქვიზი"
          body="10 კითხვა: იპოვე მოდელზე და დაასახელე"
          chevron
          onClick={onQuiz}
        />
        <ActionCard
          lead={
            <Tile>
              <GalleryVerticalEnd className="size-5" />
            </Tile>
          }
          title="ბარათები"
          body="ტერმინების დამახსოვრება გამეორებით"
          chevron
          onClick={onCards}
        />
      </div>

      <h3 className={blockTitle}>მასწავლებლისთვის</h3>
      <ul className={group}>
        <li>
          <SwitchRow checked={board} onChange={onBoard} label="დაფის რეჟიმი" lead={lead(Presentation, board)} />
        </li>
        <li>
          <SwitchRow checked={drawing} onChange={onDraw} label="ეკრანზე ხატვა" lead={lead(PenLine, drawing)} />
        </li>
        {sensitive && (
          <li>
            <SwitchRow checked={sensitive.on} onChange={sensitive.onToggle} label="რეპროდუქციული ორგანოები" lead={lead(EyeOff, sensitive.on)} />
          </li>
        )}
      </ul>
      <p className="mt-2 px-1 text-xs leading-5 text-[#66736f]">დაფის რეჟიმში ტექსტი და წარწერები დიდდება, თემები კი ნაბიჯ-ნაბიჯ ჩანს.</p>
    </div>
  );
}

export function Sidebar({
  t,
  tab,
  onTab,
  mobileOpen,
  onCloseMobile,
  systems,
  animations,
  topics,
  learn,
}: {
  t: Strings;
  tab: SidebarTab;
  onTab: (tab: SidebarTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  systems: Parameters<typeof SystemsTab>[0];
  animations: Parameters<typeof AnimationsTab>[0];
  topics: Parameters<typeof TopicsTab>[0];
  learn: Parameters<typeof LearnTab>[0];
}) {
  const tabs: { key: SidebarTab; label: string; icon: LucideIcon }[] = [
    { key: "systems", label: t.systems, icon: Layers },
    { key: "animations", label: t.animations, icon: Activity },
    { key: "topics", label: t.topics, icon: BookOpen },
    { key: "learn", label: "სწავლა", icon: GraduationCap },
  ];

  return (
    <section
      aria-label={t.systems}
      className={cn(
        "absolute start-0 top-14 bottom-0 z-20 flex w-[320px] flex-col border-e border-[#e2e7e5] bg-[#fbfcfc] max-[1100px]:w-[288px]",
        mobileOpen
          ? "max-md:inset-x-0 max-md:top-auto max-md:bottom-16 max-md:h-[60dvh] max-md:w-auto max-md:rounded-t-2xl max-md:border-e-0 max-md:border-t max-md:shadow-[0_-8px_24px_rgba(17,26,24,0.1)]"
          : "max-md:hidden",
      )}
    >
      <div className="flex shrink-0 items-stretch border-b border-[#e2e7e5] bg-white max-md:rounded-t-2xl">
        {/* Tabs share the width by their label length, so "ანიმაციები" gets the room "თემები" doesn't need in the 288px sidebar. */}
        <div role="tablist" aria-label={t.systems} className="flex min-w-0 flex-1">
          {tabs.map(({ key, label, icon: Icon }) => {
            const on = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onTab(key)}
                className={cn(
                  "relative flex min-h-14 min-w-0 flex-auto flex-col items-center justify-center gap-1 px-1.5 text-xs transition-colors",
                  on ? "font-semibold text-[#111a18]" : "text-[#66736f] hover:text-[#111a18]",
                )}
              >
                <Icon className={cn("size-[18px] shrink-0", on ? "text-[#0f8a74]" : "text-[#97a29e]")} strokeWidth={2} aria-hidden />
                {/* The hidden bold copy reserves the selected width, so tabs don't shift when the selection moves. */}
                <span data-label={label} className="max-w-full truncate after:invisible after:block after:h-0 after:font-semibold after:content-[attr(data-label)]">
                  {label}
                </span>
                {on && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#0f8a74]" />}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onCloseMobile} aria-label={t.close} className={cn(iconBtn, "me-1 hidden self-center max-md:inline-flex")}>
          <X className="size-5" />
        </button>
      </div>
      {tab === "systems" ? (
        <SystemsTab {...systems} />
      ) : tab === "animations" ? (
        <AnimationsTab {...animations} />
      ) : tab === "topics" ? (
        <TopicsTab {...topics} />
      ) : (
        <LearnTab {...learn} />
      )}
    </section>
  );
}
