"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  lessonFocusParts,
  lessonParts,
  type LessonKey,
} from "./anatomy-groups";
import {
  AnatomyViewer,
  type AnimationSettings,
  type BreathPhase,
  type HeartPhase,
  type ViewName,
} from "./anatomy-viewer";
import {
  DEFAULT_SYSTEMS,
  isSensitive,
  MODEL_BASE,
  PRESETS,
  SYSTEMS,
  titleCase,
  type AtlasManifest,
  type AtlasPart,
  type PresetKey,
  type SystemKey,
} from "./atlas-data";
import { BottomDock } from "./BottomDock";
import { STRINGS, formatNumber } from "./i18n";
import {
  answerQuestion,
  buildSearchIndex,
  searchIndex,
  type SearchEntry,
} from "./search-index";
import {
  AboutSheet,
  AskPanel,
  DetailSheet,
  SearchPanel,
  type Selection,
} from "./Sheets";
import { Sidebar, type SidebarTab } from "./Sidebar";
import { AppBar, LoadingCard, PhaseIndicator } from "./StudioChrome";
import type { PoseKey } from "./rig";
import { DIVE_TEMPLATES, TOPIC_TEMPLATE, templateFor, type DiveTemplate } from "./deep-dive-data";
import { DeepDivePanel } from "./DeepDivePanel";
import { HoverLayer, type HoverState } from "./HoverCallout";
import { AtlasLabels, type LabelFrame } from "./AtlasLabels";
import { createChannel } from "./channel";
import { georgianName } from "./georgian-names";
import { TOPIC_BY_SLUG, type Topic } from "./topics";
import { TopicSheet } from "./TopicSheet";
import { ViewControls } from "./ViewControls";
import { DrawLayer } from "./DrawLayer";
import { PracticeSheet, type PracticeHost, type PracticeMode } from "./Practice";
import { loadLevel, saveLevel, type Level } from "./learn-data";

type Popover = "search" | "ask" | null;

const INITIAL_SYSTEMS = new Set<SystemKey>(DEFAULT_SYSTEMS);
const NO_ANIMATION: AnimationSettings = {
  heartbeat: false,
  breathing: false,
  bloodFlow: false,
  bpm: 72,
};

const LESSON_ANIMATION: Record<LessonKey, Omit<AnimationSettings, "bpm">> = {
  heart: { heartbeat: true, breathing: false, bloodFlow: true },
  breathing: { heartbeat: false, breathing: true, bloodFlow: false },
  circulation: { heartbeat: true, breathing: false, bloodFlow: true },
};

/** Label text for the always-on labels: textbook names only, without left/right. */
function labelName(part: AtlasPart): string | null {
  const g = georgianName(part.name, part.system, part.bounds);
  return g.exact ? g.name.replace(/^(მარცხენა|მარჯვენა) /, "") : null;
}

function sameSet<T>(a: Set<T>, b: T[]) {
  return a.size === b.length && b.every((x) => a.has(x));
}

function useViewportWidth() {
  const [width, setWidth] = useState(1440);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}

export function HumanAtlasApp({
  initialTopic,
  canShowSensitive = false,
}: {
  initialTopic?: string;
  /** Teachers and admins may turn the reproductive organs on; students never see them. */
  canShowSensitive?: boolean;
}) {
  const t = STRINGS.ka;
  const fmt = useMemo(
    () => ({ format: (n: number) => formatNumber(n, "ka") }),
    [],
  );
  const width = useViewportWidth();
  const mobile = width < 768;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<AnatomyViewer | null>(null);

  const [manifest, setManifest] = useState<AtlasManifest | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 15 });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [loadKey, setLoadKey] = useState(0);

  const [enabled, setEnabled] = useState<Set<SystemKey>>(INITIAL_SYSTEMS);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [isolated, setIsolated] = useState<string[] | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [lesson, setLesson] = useState<LessonKey | null>(null);
  const [anim, setAnim] = useState<AnimationSettings>(NO_ANIMATION);
  const [phase, setPhase] = useState<{
    heart: HeartPhase | null;
    breath: BreathPhase | null;
  }>({ heart: null, breath: null });
  const [explode, setExplode] = useState(0);
  const [view, setView] = useState<ViewName | null>("threeQuarter");
  const [popover, setPopover] = useState<Popover>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<SidebarTab>("systems");
  const [hoverChannel] = useState(createChannel<HoverState>);
  const [labelChannel] = useState(createChannel<LabelFrame>);
  // Always-on labels: school smart boards are touch screens, so hover never happens there.
  const [labelsOn, setLabelsOn] = useState(true);
  const [showSensitive, setShowSensitive] = useState(false);
  // Learning: school stage, quiz/flashcards, and the teacher's board mode with a drawing layer.
  const [level, setLevel] = useState<Level>(() => (typeof window === "undefined" ? "basic" : loadLevel()));
  const [practice, setPractice] = useState<PracticeMode | null>(null);
  const [practiceIds, setPracticeIds] = useState<string[]>([]);
  const [board, setBoard] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const pickHandlerRef = useRef<((part: AtlasPart) => void) | null>(null);
  // Read by the 3D view's hover callback (set up once), so hover labels can't give quiz answers away.
  const practiceRef = useRef(false);
  useEffect(() => {
    practiceRef.current = !!practice;
    if (practice) hoverChannel.set(null);
  }, [practice, hoverChannel]);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [pose, setPose] = useState<PoseKey>("standing");
  const [dive, setDive] = useState<{ template: DiveTemplate; title: string; ids: string[]; restoreIsolated: string[] | null } | null>(null);
  const [cutDepth, setCutDepth] = useState(0.55);
  const topicApplied = useRef(false);

  const partsById = useMemo(
    () => new Map((manifest?.parts ?? []).map((p) => [p.id, p])),
    [manifest],
  );
  const index = useMemo(
    () =>
      manifest
        ? buildSearchIndex(showSensitive ? manifest : { ...manifest, parts: manifest.parts.filter((p) => !isSensitive(p)) })
        : [],
    [manifest, showSensitive],
  );

  const counts = useMemo(() => {
    const c = Object.fromEntries(SYSTEMS.map((s) => [s.key, 0])) as Record<
      SystemKey,
      number
    >;
    for (const p of manifest?.parts ?? []) c[p.system] += 1;
    return Object.fromEntries(
      Object.entries(c).map(([k, v]) => [k, fmt.format(v)]),
    ) as Record<SystemKey, string>;
  }, [manifest, fmt]);

  const sensitiveIds = useMemo(() => new Set((manifest?.parts ?? []).filter(isSensitive).map((p) => p.id)), [manifest]);
  const visible = useMemo(() => {
    const ids = new Set<string>();
    if (isolated) for (const id of isolated) ids.add(id);
    else for (const p of manifest?.parts ?? []) if (enabled.has(p.system) && !hidden.has(p.id)) ids.add(p.id);
    // Hidden whatever else is switched on, isolated or searched, until the teacher turns them on.
    if (!showSensitive) for (const id of sensitiveIds) ids.delete(id);
    return ids;
  }, [manifest, enabled, hidden, isolated, showSensitive, sensitiveIds]);

  // --- Engine lifecycle -------------------------------------------------------------------------
  const pickRef = useRef<(part: AtlasPart | null, focus: boolean) => void>(
    () => {},
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewer = new AnatomyViewer(canvas, {
      onHover: (part, x, y) =>
        hoverChannel.set(
          part && !practiceRef.current
            ? {
                name: georgianName(part.name, part.system, part.bounds).name,
                system: part.system,
                x,
                y,
                w: canvas.clientWidth,
                h: canvas.clientHeight,
              }
            : null,
        ),
      onPick: (part) => pickRef.current(part, false),
      onFocus: (part) => pickRef.current(part, true),
      onPhase: (heart, breath) => setPhase({ heart, breath }),
      onLabels: (anchors, free) =>
        labelChannel.set(
          anchors && free ? { anchors, free, w: canvas.clientWidth, h: canvas.clientHeight } : null,
        ),
    });
    viewerRef.current = viewer;
    let cancelled = false;

    fetch(`${MODEL_BASE}/atlas.json`)
      .then((r) => {
        if (!r.ok) throw new Error("manifest");
        return r.json() as Promise<AtlasManifest>;
      })
      .then(async (m) => {
        if (cancelled) return;
        setManifest(m);
        await viewer.load(
          m,
          (done, total) => !cancelled && setProgress({ done, total }),
        );
        if (!cancelled) setLoaded(true);
      })
      .catch(() => !cancelled && setError(true));

    return () => {
      cancelled = true;
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [loadKey, hoverChannel, labelChannel]);

  useEffect(() => {
    viewerRef.current?.setVisible(visible);
  }, [visible, progress.done]);

  useEffect(() => {
    viewerRef.current?.setSelected(practice ? practiceIds : (selection?.ids ?? []));
  }, [selection, progress.done, practice, practiceIds]);

  useEffect(() => {
    viewerRef.current?.setAnimation(anim);
  }, [anim, loadKey]);

  useEffect(() => {
    // Labels would give quiz answers away.
    viewerRef.current?.setLabels(labelsOn && !practice, labelName);
  }, [labelsOn, loadKey, practice]);

  // Keep the model centred in the space the panels leave free.
  const sidebarVisible = !mobile;
  useEffect(() => {
    // Must match the docked regions: bar 56 · sidebar 320/288 · rail 56 · bottom bar 64 · sheet 400/340.
    const compact = width <= 1100;
    const sheetOpen = !!topic || !!selection || !!dive || !!practice;
    const sheetHeight = Math.round(window.innerHeight * 0.6);
    viewerRef.current?.setInsets(
      mobile
        ? {
            top: 56 + 52,
            right: 0,
            left: 0,
            bottom: sheetOpen || sidebarOpen ? sheetHeight + (sidebarOpen ? 64 : 0) : 64,
          }
        : {
            top: 56,
            left: sidebarVisible ? (compact ? 288 : 320) : 0,
            right: 56 + (sheetOpen ? (compact ? 340 : 400) : 0),
            bottom: 64,
          },
    );
    if (view && !selection && !lesson) viewerRef.current?.setView(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the layout changes
  }, [mobile, sidebarVisible, sidebarOpen, selection, topic, dive, practice, width, loadKey]);

  // --- Actions ----------------------------------------------------------------------------------
  const revealSelection = useCallback(
    (sel: Selection, frame: boolean) => {
      setSelection(sel);
      setTopic(null);
      setPopover(null);
      if (mobile) setSidebarOpen(false);
      // Make sure the chosen pieces are actually on screen.
      const systems = new Set(
        sel.ids
          .map((id) => partsById.get(id)?.system)
          .filter(Boolean) as SystemKey[],
      );
      setEnabled((prev) =>
        [...systems].every((s) => prev.has(s))
          ? prev
          : new Set([...prev, ...systems]),
      );
      setHidden((prev) => {
        if (!sel.ids.some((id) => prev.has(id))) return prev;
        const next = new Set(prev);
        sel.ids.forEach((id) => next.delete(id));
        return next;
      });
      setIsolated((prev) =>
        prev && !sel.ids.every((id) => prev.includes(id)) ? sel.ids : prev,
      );
      if (frame) {
        setView(null);
        viewerRef.current?.frameParts(sel.ids);
      }
    },
    [partsById, mobile],
  );

  useEffect(() => {
    pickRef.current = (part, focus) => {
      if (!part) return;
      if (pickHandlerRef.current) {
        pickHandlerRef.current(part);
        return;
      }
      revealSelection(
        {
          name: georgianName(part.name, part.system, part.bounds).name,
          conceptId: part.conceptId,
          system: part.system,
          ids: [part.id],
        },
        focus,
      );
    };
  }, [revealSelection]);

  const chooseEntry = useCallback(
    (entry: SearchEntry) => {
      const first = partsById.get(entry.ids[0]);
      if (!first) return;
      setLesson(null);
      revealSelection(
        {
          name: entry.name,
          conceptId: entry.conceptId,
          system: first.system,
          ids: entry.ids,
        },
        true,
      );
    },
    [partsById, revealSelection],
  );

  const goHome = () => {
    setView("threeQuarter");
    viewerRef.current?.reset();
  };

  const clearSelection = () => {
    setSelection(null);
    if (isolated && !lesson) {
      setIsolated(null);
      goHome();
    }
  };

  const toggleIsolate = () => {
    if (!selection) return;
    setLesson(null);
    if (isolated) {
      setIsolated(null);
    } else {
      setIsolated(selection.ids);
      viewerRef.current?.frameParts(selection.ids);
    }
  };

  const hideSelection = () => {
    if (!selection) return;
    setHidden((prev) => new Set([...prev, ...selection.ids]));
    setIsolated(null);
    setLesson(null);
    setSelection(null);
  };

  const startLesson = (key: LessonKey) => {
    if (!manifest) return;
    const ids = lessonParts(manifest, key);
    setLesson(key);
    setSelection(null);
    setExplode(0);
    viewerRef.current?.setExplode(0);
    setIsolated(ids);
    setAnim((a) => ({ ...a, ...LESSON_ANIMATION[key] }));
    setView(null);
    if (mobile) setSidebarOpen(false);
    // Give React a frame to apply visibility before framing.
    viewerRef.current?.frameParts(lessonFocusParts(manifest, key));
  };

  const openTopic = useCallback(
    (slug: string, updateUrl = true) => {
      const next = TOPIC_BY_SLUG[slug];
      if (!next || !manifest) return;
      if (updateUrl) window.history.replaceState(null, "", `/topic/${slug}`);
      setSelection(null);
      setPopover(null);
      if (mobile) setSidebarOpen(false);
      const view = next.view;
      if (view.kind === "lesson") {
        startLesson(view.lesson);
      } else {
        setLesson(null);
        setAnim((a) => ({ ...NO_ANIMATION, bpm: a.bpm }));
        setExplode(0);
        viewerRef.current?.setExplode(0);
        if (view.kind === "systems") {
          setIsolated(null);
          setEnabled(new Set(view.systems));
          goHome();
        } else {
          const entry =
            view.terms
              .map((term) => index.find((e) => e.key === term))
              .find(Boolean) ??
            view.terms
              .map((term) => searchIndex(index, term, 1)[0])
              .find(Boolean);
          if (entry) {
            setIsolated(entry.ids);
            setView(null);
            viewerRef.current?.frameParts(entry.ids);
          }
        }
      }
      setTopic(next);
    },
    // startLesson/goHome only touch state setters and the viewer ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manifest, index, mobile],
  );

  // Whole organs with a written topic open the full Georgian explanation; other results select parts.
  const pickEntry = (entry: SearchEntry) => {
    if (entry.topic) openTopic(entry.topic);
    else chooseEntry(entry);
  };

  // --- Deep dive ("შიგნით ჩახედვა") --------------------------------------------------------------
  const openDive = (template: DiveTemplate, title: string, ids: string[]) => {
    setDive({ template, title, ids, restoreIsolated: isolated });
    setPopover(null);
    if (ids.length) {
      setIsolated(ids);
      setExplode(0);
      viewerRef.current?.setExplode(0);
      setView(null);
      viewerRef.current?.frameParts(ids);
      viewerRef.current?.setCut(ids, cutDepth, template.cutColor);
    }
  };

  const diveFromSelection = () => {
    if (!selection) return;
    const first = partsById.get(selection.ids[0]);
    if (!first) return;
    openDive(templateFor(first.system, first.name), selection.name, selection.ids);
  };

  const diveFromTopic = () => {
    if (!topic) return;
    const template = DIVE_TEMPLATES[TOPIC_TEMPLATE[topic.slug] ?? "osteon"];
    // Cut through what the topic shows when it is a single organ; whole systems only get the diagrams.
    const ids = isolated && isolated.length < 400 ? isolated : [];
    openDive(template, topic.title, ids);
  };

  const closeDive = () => {
    viewerRef.current?.setCut(null);
    if (dive) setIsolated(dive.restoreIsolated);
    setDive(null);
  };

  const closeTopic = () => {
    setTopic(null);
    window.history.replaceState(null, "", "/anatomy");
  };

  // A QR code opens /topic/<slug>: apply it once the model has loaded.
  useEffect(() => {
    if (!loaded || !initialTopic || topicApplied.current) return;
    topicApplied.current = true;
    openTopic(initialTopic, false);
  }, [loaded, initialTopic, openTopic]);

  // --- Learning: quiz and flashcards ------------------------------------------------------------
  const practiceHost = useMemo<PracticeHost>(
    () => ({
      resolve: (name) => index.find((e) => e.key === name.toLowerCase())?.ids ?? null,
      present: (item) => {
        setSelection(null);
        setTopic(null);
        setLesson(null);
        setIsolated(null);
        setHidden(new Set());
        setEnabled(new Set(item.show));
        setExplode(0);
        viewerRef.current?.setExplode(0);
        setPracticeIds([]);
        setView("front");
        viewerRef.current?.setView("front");
      },
      highlight: (ids, frame) => {
        setPracticeIds(ids ?? []);
        if (ids && frame) {
          // Only the structure and the skeleton around it, so nothing in front can hide it.
          const bones = (manifest?.parts ?? []).filter((p) => p.system === "skeletal").map((p) => p.id);
          setIsolated([...new Set([...ids, ...bones])]);
          setView(null);
          viewerRef.current?.frameParts(ids);
        }
      },
      setPickHandler: (fn) => {
        pickHandlerRef.current = fn;
      },
    }),
    [index, manifest],
  );

  const openPractice = (mode: PracticeMode) => {
    if (dive) closeDive();
    if (topic) closeTopic();
    setSelection(null);
    setPopover(null);
    setPractice(mode);
    if (mobile) setSidebarOpen(false);
  };

  const closePractice = () => {
    setPractice(null);
    setPracticeIds([]);
    pickHandlerRef.current = null;
    setEnabled(new Set(DEFAULT_SYSTEMS));
    goHome();
  };

  const showWholeBody = () => {
    setLesson(null);
    setIsolated(null);
    goHome();
  };

  const applyPreset = (key: PresetKey) => {
    setEnabled(new Set(PRESETS[key]));
    setIsolated(null);
    setLesson(null);
  };

  const toggleSystem = (key: SystemKey, on: boolean) => {
    setIsolated(null);
    setLesson(null);
    setEnabled((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const changeView = (v: ViewName) => {
    setView(v);
    viewerRef.current?.setView(v);
  };

  const onExplode = (v: number) => {
    setExplode(v);
    viewerRef.current?.setExplode(v / 100);
    if (!selection && !lesson) {
      viewerRef.current?.setView(view ?? "threeQuarter");
      if (!view) setView("threeQuarter");
    }
  };

  const choosePose = (key: PoseKey) => {
    setPose(key);
    viewerRef.current?.setPose(key);
    // Skin, muscles and organs are skinned to the skeleton, so the current view is kept.
    setExplode(0);
    viewerRef.current?.setExplode(0);
    setView("threeQuarter");
    viewerRef.current?.setView("threeQuarter");
  };

  const reset = () => {
    setPose("standing");
    viewerRef.current?.setPose("standing");
    setExplode(0);
    viewerRef.current?.setExplode(0);
    setIsolated(null);
    setHidden(new Set());
    setSelection(null);
    setLesson(null);
    goHome();
  };

  const ask = (q: string) => {
    const hit = answerQuestion(index, q);
    if (hit) pickEntry(hit);
    return !!hit;
  };

  // Keyboard: "/" search · arrows rotate · +/- zoom · Escape closes the top-most layer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement;
      const onControl = target?.getAttribute("role") === "slider";
      if (e.key === "Escape") {
        if (aboutOpen) setAboutOpen(false);
        else if (popover) setPopover(null);
        else if (sidebarOpen) setSidebarOpen(false);
        else if (drawing) setDrawing(false);
        else if (practice) setPractice(null);
        else if (selection) setSelection(null);
        return;
      }
      if (typing || onControl || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setPopover("search");
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        viewerRef.current?.rotate(e.key === "ArrowRight" ? 1 : -1, 20);
        setView(null);
      } else if (e.key === "+" || e.key === "=") {
        viewerRef.current?.zoom(0.8);
      } else if (e.key === "-") {
        viewerRef.current?.zoom(1.25);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aboutOpen, popover, sidebarOpen, selection, drawing, practice]);

  const caption = topic
    ? topic.title
    : lesson
      ? t.lessons[lesson].title
      : isolated && selection
        ? titleCase(selection.name)
        : explode > 0
          ? t.captionExploded
          : t.caption;
  const activePreset =
    (Object.keys(PRESETS) as PresetKey[]).find((k) =>
      sameSet(enabled, PRESETS[k]),
    ) ?? null;
  const totalPieces = manifest?.parts.length ?? 2234;

  // The 3D view's free area: between sidebar, rail/sheet, header and bottom bar.
  const sheetOpen = !!topic || !!selection || !!dive || !!practice;
  const canvasArea = `pointer-events-none absolute top-14 bottom-16 start-[320px] max-[1100px]:start-[288px] max-md:inset-x-0 max-md:top-[108px] ${
    sheetOpen ? "end-[456px] max-[1100px]:end-[396px]" : "end-14"
  }`;

  return (
    <main
      lang="ka"
      className={`${board ? "atlas-board " : ""}relative isolate h-dvh min-h-[480px] w-full overflow-hidden bg-[#f4f6f5] font-sans text-[#111a18]`}
    >
      <div className="absolute inset-0">
        <canvas
          ref={canvasRef}
          aria-label="3D ანატომიის ხედი"
          className="block size-full cursor-grab touch-none active:cursor-grabbing"
        />
        <AtlasLabels channel={labelChannel} large={board} onPick={(part) => pickRef.current(part, false)} />
        <HoverLayer t={t} channel={hoverChannel} />
      </div>

      <AppBar
        t={t}
        pieces={fmt.format(totalPieces)}
        searchOpen={popover === "search"}
        askOpen={popover === "ask"}
        onSearch={() => setPopover((p) => (p === "search" ? null : "search"))}
        onAsk={() => setPopover((p) => (p === "ask" ? null : "ask"))}
        onAbout={() => setAboutOpen(true)}
      />

      <Sidebar
        t={t}
        tab={tab}
        onTab={setTab}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        systems={{
          t,
          hiddenSystems: showSensitive ? [] : ["reproductive"],
          enabled,
          counts,
          activePreset,
          visibleLabel: t.piecesVisible(fmt.format(visible.size)),
          anyVisible: visible.size > 0,
          onToggle: toggleSystem,
          onPreset: applyPreset,
          onToggleAll: () => {
            setIsolated(null);
            setLesson(null);
            if (visible.size > 0) setEnabled(new Set());
            else {
              setEnabled(new Set(DEFAULT_SYSTEMS));
              setHidden(new Set());
            }
          },
        }}
        animations={{
          t,
          lesson,
          anim,
          onLesson: startLesson,
          onAnim: setAnim,
          pose,
          onPose: choosePose,
          onWholeBody: showWholeBody,
          onStop: () => setAnim((a) => ({ ...NO_ANIMATION, bpm: a.bpm })),
        }}
        topics={{
          t,
          active: topic?.slug ?? null,
          level,
          onOpen: (slug) => {
            setPractice(null);
            openTopic(slug);
          },
        }}
        learn={{
          level,
          onLevel: (l) => {
            setLevel(l);
            saveLevel(l);
          },
          onQuiz: () => openPractice("quiz"),
          onCards: () => openPractice("cards"),
          board,
          onBoard: () => setBoard((b) => !b),
          drawing,
          onDraw: () => setDrawing((d) => !d),
          sensitive: canShowSensitive ? { on: showSensitive, onToggle: () => setShowSensitive((v) => !v) } : undefined,
        }}
      />

      <ViewControls
        t={t}
        active={view}
        onView={changeView}
        onRotate={(d) => {
          viewerRef.current?.rotate(d);
          setView(null);
        }}
        onZoom={(d) => viewerRef.current?.zoom(d > 0 ? 0.8 : 1.25)}
        labelsOn={labelsOn}
        onLabels={() => setLabelsOn((v) => !v)}
      />

      <div className={`${canvasArea} z-10`}>
        <p className="absolute start-4 top-3 text-xs text-[#66736f]">{caption}</p>
        <div className="absolute inset-x-0 top-3 flex justify-center max-md:top-9">
          <PhaseIndicator t={t} heart={phase.heart} breath={phase.breath} bpm={anim.bpm} />
        </div>
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingCard
              t={t}
              done={progress.done}
              total={progress.total}
              error={error}
              onRetry={() => {
                setError(false);
                setProgress((p) => ({ ...p, done: 0 }));
                setLoadKey((k) => k + 1);
              }}
            />
          </div>
        )}
      </div>

      <BottomDock
        t={t}
        explode={explode}
        onExplode={onExplode}
        onReset={reset}
        layersOpen={sidebarOpen}
        sheetOpen={sheetOpen}
        onLayers={() => {
          setSidebarOpen((o) => !o);
          setSelection(null);
          setTopic(null);
        }}
      />

      {popover === "search" && (
        <SearchPanel
          t={t}
          index={index}
          onChoose={pickEntry}
          onClose={() => setPopover(null)}
        />
      )}
      {popover === "ask" && (
        <AskPanel t={t} onAsk={ask} onClose={() => setPopover(null)} />
      )}
      {dive && (
        <DeepDivePanel
          t={t}
          template={dive.template}
          structure={dive.title}
          canCut={dive.ids.length > 0}
          cutDepth={cutDepth}
          onCutDepth={(v) => {
            setCutDepth(v);
            viewerRef.current?.setCut(dive.ids, v, dive.template.cutColor);
          }}
          onClose={closeDive}
        />
      )}
      {!dive && !practice && topic && !selection && (
        <TopicSheet t={t} topic={topic} onClose={closeTopic} onDeepDive={diveFromTopic} steps={board} />
      )}
      {!dive && !practice && selection && (
        <DetailSheet
          t={t}
          selection={selection}
          isolated={!!isolated && !lesson}
          onIsolate={toggleIsolate}
          onHide={hideSelection}
          onClear={clearSelection}
          onDeepDive={diveFromSelection}
        />
      )}
      {practice && !dive && (
        <PracticeSheet key={`${practice}-${level}`} mode={practice} level={level} host={practiceHost} onClose={closePractice} />
      )}
      {drawing && (
        <div className={`${canvasArea.replace("pointer-events-none ", "")} z-[42]`}>
          <DrawLayer board={board} onClose={() => setDrawing(false)} />
        </div>
      )}
      {aboutOpen && <AboutSheet t={t} onClose={() => setAboutOpen(false)} />}
    </main>
  );
}
