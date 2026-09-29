"use client";

import Link from "next/link";
import { ChevronRight, HeartPulse, Pause, PersonStanding, Play, QrCode, Waves, Wind, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LessonKey } from "./anatomy-groups";
import type { AnimationSettings } from "./anatomy-viewer";
import { SYSTEMS, type PresetKey, type SystemKey } from "./atlas-data";
import type { Strings } from "./i18n";
import { Slider, Switch, btnGhost, btnPrimary, btnSecondary, iconBtn, sectionLabel } from "./primitives";
import { ANIMATED_POSES, STATIC_POSES, type PoseKey } from "./rig";
import { TOPICS } from "./topics";

export type SidebarTab = "systems" | "animations" | "topics";

const LESSON_ICONS: Record<LessonKey, typeof HeartPulse> = {
  heart: HeartPulse,
  breathing: Wind,
  circulation: Waves,
};

// Shared row grid so every list in the sidebar has the same left/right edges.
const row = "grid min-h-10 grid-cols-[10px_minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-1.5";

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
}: {
  t: Strings;
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
      <div className="px-4 pt-4 pb-3">
        <div className="grid grid-cols-3 overflow-hidden rounded-md border border-[#d5dcd9]">
          {(["all", "skeleton", "organs"] as const).map((key, i) => (
            <button
              key={key}
              type="button"
              aria-pressed={activePreset === key}
              onClick={() => onPreset(key)}
              className={cn(
                "h-8 px-1 text-[13px] transition-colors max-md:h-11",
                i > 0 && "border-s border-[#d5dcd9]",
                activePreset === key ? "bg-[#eef2f0] font-semibold text-[#111a18]" : "text-[#33413e] hover:bg-[#f5f7f6]",
              )}
            >
              {t.presets[key]}
            </button>
          ))}
        </div>
      </div>

      <ul className="atlas-scroll min-h-0 flex-1 overflow-y-auto border-t border-[#e2e7e5] py-1">
        {SYSTEMS.map((s) => {
          const on = enabled.has(s.key);
          return (
            <li key={s.key} className={cn(row, "hover:bg-[#f5f7f6]")}>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: s.dot, opacity: on ? 1 : 0.4 }} />
              <button
                type="button"
                onClick={() => onToggle(s.key, !on)}
                className={cn("py-1 text-start text-sm leading-5", on ? "text-[#111a18]" : "text-[#97a29e]")}
              >
                {t.systemNames[s.key]}
              </button>
              <span className="w-8 text-end text-xs text-[#97a29e] tabular-nums">{counts[s.key]}</span>
              <Switch checked={on} onChange={(v) => onToggle(s.key, v)} label={t.systemNames[s.key]} />
            </li>
          );
        })}
      </ul>

      <div className="flex h-12 shrink-0 items-center justify-between border-t border-[#e2e7e5] ps-4 pe-2">
        <span className="text-xs text-[#66736f] tabular-nums">{visibleLabel}</span>
        <button type="button" onClick={onToggleAll} className={btnGhost}>
          {anyVisible ? t.hideAll : t.showAll}
        </button>
      </div>
    </>
  );
}

function PoseList({ t, pose, keys, onPose }: { t: Strings; pose: PoseKey; keys: PoseKey[]; onPose: (key: PoseKey) => void }) {
  return (
    <ul className="border-y border-[#e2e7e5]">
      {keys.map((key, i) => {
        const active = pose === key;
        const Icon = ANIMATED_POSES.includes(key) ? Play : PersonStanding;
        return (
          <li key={key} className={cn(i > 0 && "border-t border-[#e2e7e5]")}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onPose(key)}
              className={cn(
                "relative flex h-10 w-full items-center gap-3 px-4 text-start text-sm transition-colors max-md:h-12",
                active ? "bg-[#e6f3ef] font-medium text-[#0c7563]" : "text-[#111a18] hover:bg-[#f5f7f6]",
              )}
            >
              {active && <span className="absolute inset-y-0 start-0 w-0.5 bg-[#0f8a74]" />}
              <Icon className={cn("size-4 shrink-0", active ? "text-[#0f8a74]" : "text-[#66736f]")} strokeWidth={2} />
              <span className="truncate">{t.poses[key]}</span>
            </button>
          </li>
        );
      })}
    </ul>
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
    <div className="atlas-scroll min-h-0 flex-1 overflow-y-auto">
      <h3 className={cn(sectionLabel, "px-4 pt-4 pb-2")}>{t.lessonsTitle}</h3>
      <ul className="border-y border-[#e2e7e5]">
        {(["heart", "breathing", "circulation"] as const).map((key, i) => {
          const Icon = LESSON_ICONS[key];
          const active = lesson === key;
          return (
            <li key={key} className={cn(i > 0 && "border-t border-[#e2e7e5]")}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onLesson(key)}
                className={cn(
                  "relative flex w-full items-start gap-3 px-4 py-3 text-start transition-colors",
                  active ? "bg-[#e6f3ef]" : "hover:bg-[#f5f7f6]",
                )}
              >
                {active && <span className="absolute inset-y-0 start-0 w-0.5 bg-[#0f8a74]" />}
                <Icon className={cn("mt-0.5 size-[18px] shrink-0", active ? "text-[#0f8a74]" : "text-[#66736f]")} strokeWidth={2} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[#111a18]">{t.lessons[key].title}</span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-[#66736f]">{t.lessons[key].body}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <h3 className={cn(sectionLabel, "px-4 pt-5 pb-2")}>{t.animations}</h3>
      <ul className="border-y border-[#e2e7e5]">
        {toggles.map(({ key, icon: Icon }, i) => (
          <li key={key} className={cn("flex h-11 items-center gap-3 px-4", i > 0 && "border-t border-[#e2e7e5]")}>
            <Icon className="size-[18px] text-[#66736f]" strokeWidth={2} />
            <span className="flex-1 text-sm text-[#111a18]">{t[key]}</span>
            <Switch checked={anim[key]} onChange={(v) => onAnim({ ...anim, [key]: v })} label={t[key]} />
          </li>
        ))}
        <li className="border-t border-[#e2e7e5] px-4 pt-3 pb-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#111a18]">{t.heartRate}</span>
            <span className="text-[13px] text-[#66736f] tabular-nums">
              {anim.bpm} {t.bpmUnit}
            </span>
          </div>
          <div className="-mx-2">
            <Slider value={anim.bpm} min={40} max={160} onChange={(bpm) => onAnim({ ...anim, bpm })} label={t.heartRate} />
          </div>
        </li>
      </ul>

      <h3 className={cn(sectionLabel, "px-4 pt-5 pb-2")}>{t.posesTitle}</h3>
      <PoseList t={t} pose={pose} keys={STATIC_POSES} onPose={onPose} />
      <h3 className={cn(sectionLabel, "px-4 pt-5 pb-2")}>{t.movesTitle}</h3>
      <PoseList t={t} pose={pose} keys={ANIMATED_POSES} onPose={onPose} />

      {(lesson || animating) && (
        <div className="flex flex-col gap-2 p-4">
          {lesson && (
            <button type="button" onClick={onWholeBody} className={cn(btnSecondary, "w-full")}>
              {t.wholeBody}
            </button>
          )}
          {animating && (
            <button type="button" onClick={onStop} className={cn(btnPrimary, "w-full")}>
              <Pause className="size-4" />
              {t.stopAll}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TopicsTab({ t, active, onOpen }: { t: Strings; active: string | null; onOpen: (slug: string) => void }) {
  return (
    <>
      <div className="atlas-scroll min-h-0 flex-1 overflow-y-auto">
        <h3 className={cn(sectionLabel, "px-4 pt-4 pb-2")}>{t.topicsTitle}</h3>
        <ul className="border-t border-[#e2e7e5]">
          {TOPICS.map((topic) => {
            const isActive = active === topic.slug;
            return (
              <li key={topic.slug} className="border-b border-[#e2e7e5]">
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onOpen(topic.slug)}
                  className={cn(
                    "relative flex min-h-14 w-full items-center gap-3 px-4 text-start transition-colors",
                    isActive ? "bg-[#e6f3ef]" : "hover:bg-[#f5f7f6]",
                  )}
                >
                  {isActive && <span className="absolute inset-y-0 start-0 w-0.5 bg-[#0f8a74]" />}
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: topic.color }} />
                  <span className="min-w-0 flex-1 py-2">
                    <span className="block text-sm font-medium text-[#111a18]">{topic.title}</span>
                    <span className="block text-[13px] leading-5 text-[#66736f]">{topic.subtitle}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-[#97a29e]" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="shrink-0 border-t border-[#e2e7e5] p-4">
        <Link href="/qr" className={cn(btnSecondary, "w-full")}>
          <QrCode className="size-4" />
          {t.printQr}
        </Link>
      </div>
    </>
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
}: {
  t: Strings;
  tab: SidebarTab;
  onTab: (tab: SidebarTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  systems: Parameters<typeof SystemsTab>[0];
  animations: Parameters<typeof AnimationsTab>[0];
  topics: Parameters<typeof TopicsTab>[0];
}) {
  const tabs: [SidebarTab, string][] = [
    ["systems", t.systems],
    ["animations", t.animations],
    ["topics", t.topics],
  ];

  return (
    <section
      aria-label={t.systems}
      className={cn(
        "absolute start-0 top-14 bottom-0 z-20 flex w-[320px] flex-col border-e border-[#e2e7e5] bg-white max-[1100px]:w-[288px]",
        mobileOpen
          ? "max-md:inset-x-0 max-md:top-auto max-md:bottom-16 max-md:h-[60dvh] max-md:w-auto max-md:rounded-t-xl max-md:border-e-0 max-md:border-t max-md:shadow-[0_-8px_24px_rgba(17,26,24,0.1)]"
          : "max-md:hidden",
      )}
    >
      <div className="flex shrink-0 items-stretch border-b border-[#e2e7e5]">
        <div role="tablist" className="grid flex-1 grid-cols-3">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => onTab(key)}
              className={cn(
                "relative h-11 px-1 text-[13px] transition-colors",
                tab === key ? "font-semibold text-[#111a18]" : "text-[#66736f] hover:text-[#111a18]",
              )}
            >
              {label}
              {tab === key && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-[#0f8a74]" />}
            </button>
          ))}
        </div>
        <button type="button" onClick={onCloseMobile} aria-label={t.close} className={cn(iconBtn, "m-0 hidden self-center max-md:inline-flex")}>
          <X className="size-5" />
        </button>
      </div>
      {tab === "systems" ? (
        <SystemsTab {...systems} />
      ) : tab === "animations" ? (
        <AnimationsTab {...animations} />
      ) : (
        <TopicsTab {...topics} />
      )}
    </section>
  );
}
