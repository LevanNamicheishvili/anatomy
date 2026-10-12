"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Crown, MapPin, Plus, Minus, X, Headphones } from "lucide-react";
import { revealScene } from "@/components/portal/controls";
import { TopicHeader } from "@/components/portal/TopicHeader";
import { explorerGrid, explorerPage, explorerText } from "@/components/portal/ui";
import { JourneyScene } from "@/components/journeys/JourneyScene";
import { cn } from "@/lib/utils";
import { createDidgori, type BattleView } from "./didgori";
import { DIDGORI_LEARNING, DIDGORI_QUIZ } from "./didgori-learning";
import { DIDGORI_FORCES, DIDGORI_SOURCES, DIDGORI_STAGES } from "./didgori-data";
import { NARRATION_CUES, NarrationBar, NarrationSubtitles, NarrationTranscript, useNarration } from "./narration";

import { ARMY_TOTALS, COMMANDERS, DIDGORI_PLACE, type CommanderId } from "./battle/identity";

const ACCENT = "#a0662b";

/** The Didgori battle simulation: stages on the left, the 3D field in the middle, the story on the right. */
export function BattleExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<JourneyScene | null>(null);
  const viewRef = useRef<BattleView>({ camera: "cinematic" });
  const [selectedCommander, setSelectedCommander] = useState<CommanderId | null>(null);
  const [portrait, setPortrait] = useState(false);
  const [camera, setCamera] = useState<BattleView["camera"]>("cinematic");
  const [rate, setRate] = useState(1);
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState<Record<number, number>>({});
  const [retry, setRetry] = useState(0);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const current = DIDGORI_STAGES[stage];
  const commander = COMMANDERS.find((c) => c.id === selectedCommander);
  const last = stage === DIDGORI_STAGES.length - 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    let active = true;
    let scene: JourneyScene | null = null;
    const fail = () => { if (active) { setError(true); setLoading(false); } };
    try {
      scene = new JourneyScene(
        canvas,
        overlay,
        {
          onStage: setStage,
          onPlaying: setPlaying,
          onLoading: setLoading,
          onProgress: (f) => {
            if (barRef.current) barRef.current.style.width = `${f * 100}%`;
          },
        },
        { didgori: createDidgori(viewRef.current) },
      );
      sceneRef.current = scene;
      void scene.start("didgori").catch(fail);
    } catch { fail(); }
    return () => {
      active = false;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [retry]);

  // The spoken story drives the scene: each part of the narration shows its stage, stretched or quickened to
  // last as long as the voice tells about it.
  const narration = useNarration({
    onCue: (cue, seconds, restart) => {
      const s = sceneRef.current;
      if (!s) return;
      viewRef.current.commander = null;
      setSelectedCommander(null);
      if (restart || s.currentStage !== cue) s.goTo(cue);
      const d = s.stageDuration(cue);
      if (d) s.setPlaybackRate(Math.max(0.5, Math.min(2, d / seconds)));
      s.setPlaying(true);
    },
    onPlaying: (p) => sceneRef.current?.setPlaying(p),
    onEnd: () => sceneRef.current?.setPlaybackRate(rate),
  });

  const clearCommander = () => {
    viewRef.current.commander = null;
    setSelectedCommander(null);
    sceneRef.current?.refreshView();
  };
  const inspectCommander = (id: CommanderId) => {
    if (loading || error) return;
    narration.pause();
    viewRef.current.commander = id;
    viewRef.current.portrait = false;
    setSelectedCommander(id);
    setPortrait(false);
    sceneRef.current?.goTo(1);
    sceneRef.current?.setPlaying(false);
    sceneRef.current?.refreshView();
  };
  const go = (i: number) => {
    clearCommander();
    // While the story is told, choosing a stage moves the voice there too.
    const cue = narration.active ? NARRATION_CUES.find((c) => c.stage === i) : undefined;
    if (cue) {
      narration.seek(cue.time);
      return;
    }
    sceneRef.current?.goTo(i);
    sceneRef.current?.setPlaying(true);
  };
  const togglePlay = () => {
    if (commander) clearCommander();
    if (narration.active) {
      if (narration.playing) narration.pause();
      else narration.play();
      return;
    }
    sceneRef.current?.setPlaying(!playing);
  };

  return (
    <div className={explorerPage}>
      <TopicHeader subject={{ name: "ისტორია", href: "/history" }} topic="დიდგორის ბრძოლა, 1121" color={ACCENT} icon="battle" />
      <div className={cn(explorerGrid, "lg:grid-cols-[250px_minmax(0,1fr)_400px]")}>
        <nav aria-label="ბრძოლის ეტაპები" className="overflow-y-auto border-e border-line bg-card max-lg:border-e-0 max-lg:border-b">
          <ol className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0.5 lg:p-3">
            {DIDGORI_STAGES.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === stage ? "step" : undefined}
                  className={cn("flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors lg:whitespace-normal", i === stage ? "bg-[#f6efe6] font-semibold text-[#6b4218]" : "text-copy hover:bg-subtle")}
                >
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", i === stage ? "text-white" : "bg-chip text-mute")} style={i === stage ? { backgroundColor: ACCENT } : undefined}>
                    {i + 1}
                  </span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
          <section className="mx-3 mb-4 border-t border-line pt-4 max-lg:hidden" aria-label="მეთაურების ახლო ხედები">
            <h2 className="flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-[#8b6337]"><Crown className="size-4" />მეფე და მეთაურები</h2>
            <div className="mt-3 space-y-2">{COMMANDERS.map((c) => <button type="button" key={c.id} disabled={loading || error} aria-pressed={selectedCommander === c.id} onClick={() => inspectCommander(c.id)} className={cn("w-full rounded-lg border p-3 text-left transition-colors disabled:opacity-40", selectedCommander === c.id ? "border-[#b78c54] bg-[#f8f0e5]" : "border-[#e8ebe8] hover:bg-[#f8f7f3]")}>
              <span className="block text-sm font-semibold">{c.name}</span><span className="mt-1 block text-xs leading-5 text-mute">{c.role}</span><span className="mt-2 block text-xs font-medium text-[#986627]">ფიგურის დათვალიერება ↗</span>
            </button>)}</div>
          </section>
        </nav>

        <div className="relative isolate min-h-0 overflow-hidden bg-[#c8d4da]">
          <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label={`3D სიმულაცია: ${current.title}`} />
          <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-card/90 px-4 py-2 text-sm font-semibold text-copy shadow-sm">იტვირთება ბრძოლის ველი…</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
            <span className="rounded-full bg-deep/85 px-4 py-1.5 text-sm font-semibold text-white max-sm:text-xs">
              {commander ? commander.name : `${current.date} · ${current.title}`}
            </span>
          </div>
          {error && <div role="alert" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-chip p-6 text-center">
            <p className="font-semibold">3D სცენა ვერ ჩაიტვირთა</p>
            <p className="max-w-sm text-sm text-mute">შეამოწმე კავშირი და WebGL-ის მხარდაჭერა. ტექსტი და სასწავლო მასალა ხელმისაწვდომია.</p>
            <button type="button" className="min-h-11 rounded-lg bg-[#a0662b] px-5 py-2 text-sm font-semibold text-white" onClick={() => { setError(false); setLoading(true); setRate(1); setRetry((n) => n + 1); }}>ხელახლა ცდა</button>
          </div>}
          {/* Phones: the selects keep their own names and drop the visible words, so both fit on one row and the panel hides less of the field. */}
          <div className="absolute left-3 top-16 flex max-w-[calc(100%-4.5rem)] flex-wrap gap-x-3 gap-y-1.5 rounded-xl border border-line/80 bg-card/90 p-2 text-sm font-semibold shadow-panel backdrop-blur-sm max-sm:gap-x-2 max-sm:p-1.5">
            <label className="flex items-center gap-2">
              <span className="max-sm:sr-only">ხედი</span>
              <select aria-label="კამერის ხედი" value={camera} className="h-10 rounded-lg border border-line-strong bg-card px-2 text-sm font-medium" onChange={(e) => { const value = e.target.value as BattleView["camera"]; clearCommander(); viewRef.current.camera = value; setCamera(value); sceneRef.current?.refreshView(); }}>
                <option value="cinematic">კინემატოგრაფიული</option><option value="tactical">ტაქტიკური</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="max-sm:sr-only">სიჩქარე</span>
              <select aria-label="სიმულაციის სიჩქარე" value={rate} disabled={narration.active} title={narration.active ? "მოყოლისას სიჩქარეს ხმა განსაზღვრავს" : undefined} className="h-10 rounded-lg border border-line-strong bg-card px-2 text-sm font-medium disabled:opacity-50" onChange={(e) => { const value = Number(e.target.value); setRate(value); sceneRef.current?.setPlaybackRate(value); }}>
                {[0.5, 1, 1.5, 2].map((n) => <option key={n} value={n}>{n}×</option>)}
              </select>
            </label>
          </div>
          <div className="absolute right-3 top-16 flex flex-col gap-2">
            <button type="button" disabled={loading || error} aria-label="მიახლოება" onClick={() => sceneRef.current?.zoomBy(0.75)} className="flex size-10 items-center justify-center rounded-lg border border-line/80 bg-card/90 shadow-panel backdrop-blur-sm disabled:opacity-40"><Plus className="size-4" /></button>
            <button type="button" disabled={loading || error} aria-label="დაშორება" onClick={() => sceneRef.current?.zoomBy(1.33)} className="flex size-10 items-center justify-center rounded-lg border border-line/80 bg-card/90 shadow-panel backdrop-blur-sm disabled:opacity-40"><Minus className="size-4" /></button>
          </div>
          {commander && <div className="absolute inset-x-3 bottom-28 flex flex-wrap items-center justify-center gap-2 rounded-xl bg-[#17231f]/90 p-2 text-sm text-white">
            <button type="button" aria-pressed={!portrait} onClick={() => { setPortrait(false); viewRef.current.portrait = false; sceneRef.current?.refreshView(); }} className={cn("min-h-10 rounded-lg px-3 py-2 hover:bg-card/10", !portrait && "bg-card/20")}>მთელი ფიგურა</button>
            <button type="button" aria-pressed={portrait} onClick={() => { setPortrait(true); viewRef.current.portrait = true; sceneRef.current?.refreshView(); }} className={cn("min-h-10 rounded-lg px-3 py-2 hover:bg-card/10", portrait && "bg-card/20")}>სახის ახლო ხედი</button>
            <button type="button" onClick={clearCommander} className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 hover:bg-card/10"><X className="size-4" />ბრძოლაზე დაბრუნება</button>
          </div>}
          {!commander && stage !== 0 && stage !== 7 && <div className="pointer-events-none absolute right-3 top-40 space-y-1 rounded-lg bg-card/90 px-3 py-2 text-xs shadow-sm max-md:hidden">
            <p className="text-[#a92e26]">საქართველო · {ARMY_TOTALS.georgia.count}</p><p className="text-[#2b3a6b]">კოალიცია · {ARMY_TOTALS.coalition.count}*</p><p className="text-[10px] text-mute">*რაოდენობა სადავოა; საწყისი შეფასებები</p>
          </div>}
          {!narration.active && <div className="pointer-events-none absolute bottom-16 left-3 rounded-lg bg-card/90 px-3 py-2 text-xs text-copy max-md:hidden">
            <span className="text-[#a92e26]">● საქართველო</span> · <span className="text-[#2b3a6b]">● კოალიცია</span>
            <p className="mt-1">პაუზაზე: გადაათრიე ხედის მოსაბრუნებლად; გაადიდე ბორბლით.</p>
          </div>}
          {!commander && (
            <div className="absolute inset-x-0 bottom-[4.25rem] flex flex-col items-center gap-2">
              <NarrationBar n={narration} />
              <NarrationSubtitles n={narration} />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 px-3">
            {!narration.active && (
              <button type="button" onClick={narration.play} disabled={loading || error} aria-label="მოუსმინე ისტორიას" className="flex h-11 items-center justify-center gap-2 rounded-lg bg-deep/85 px-3 text-sm font-semibold text-white shadow-sm disabled:opacity-40">
                <Headphones className="size-4" />
                <span className="max-sm:hidden">მოსმენა</span>
              </button>
            )}
            <button type="button" onClick={() => go(stage - 1)} disabled={stage === 0} aria-label="წინა" className="flex size-11 items-center justify-center rounded-lg bg-card text-ink shadow-sm disabled:opacity-40">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={togglePlay} className="flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: ACCENT }}>
              {playing ? <Pause className="size-4" /> : last ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
              {playing ? "პაუზა" : "გაგრძელება"}
            </button>
            <button type="button" onClick={() => go(stage + 1)} disabled={last} aria-label="შემდეგი" className="flex size-11 items-center justify-center rounded-lg bg-card text-ink shadow-sm disabled:opacity-40">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <article className={cn(explorerText, "px-5 py-5")}>
          <NarrationTranscript n={narration} accent={ACCENT} />
          <section className="mb-5 rounded-xl border border-[#e5d9c8] bg-[#fbf7ef] p-4" aria-label="ბრძოლის ძველი და დღევანდელი მდებარეობა">
            <p className="flex items-center gap-2 text-xs font-semibold text-[#986627]"><MapPin className="size-4" />სად მოხდა ბრძოლა?</p>
            <dl className="mt-3 space-y-2 text-sm"><div><dt className="text-xs text-[#7b7b70]">1121 წელი</dt><dd className="font-semibold">{DIDGORI_PLACE.historic}</dd></div><div><dt className="text-xs text-[#7b7b70]">დღეს</dt><dd className="font-semibold">{DIDGORI_PLACE.modern}</dd><dd className="mt-1 text-xs leading-5 text-mute">{DIDGORI_PLACE.region}</dd></div></dl>
            <p className="mt-3 text-xs leading-5 text-mute">{DIDGORI_PLACE.description}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-[#8b6337]"><button type="button" disabled={loading || error} onClick={() => { go(0); revealScene(); }}>საქართველოს რუკიდან ნახვა ↗</button><a href={DIDGORI_PLACE.mapHref} target="_blank" rel="noreferrer">დღევანდელ რუკაზე ↗</a></div>
            {stage === 0 && <p className="mt-3 text-[11px] leading-5 text-[#7b7b70]">დღევანდელი საქართველოს კონტურები ორიენტირისთვისაა. წერტილი მემორიალს აღნიშნავს; ბრძოლის ზუსტი საზღვრები უცნობია.</p>}
          </section>
          <label className="mb-4 block text-xs font-semibold text-mute lg:hidden">მეთაურის დათვალიერება<select aria-label="მეთაურის არჩევა" disabled={loading || error} value={selectedCommander ?? ""} onChange={(e) => { if (e.target.value) { inspectCommander(e.target.value as CommanderId); revealScene(); } else clearCommander(); }} className="mt-2 block h-11 w-full rounded-lg border border-line-strong bg-card px-2 text-sm"><option value="">ბრძოლის საერთო ხედი</option>{COMMANDERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          {commander && <section className="mb-6 rounded-xl bg-[#192b27] p-4 text-white" aria-live="polite">
            <p className="text-xs text-[#d5b583]">მეთაურის 3D ფიგურა</p><h2 className="mt-2 text-xl">{commander.name}</h2><p className="mt-1 text-xs text-[#c4d0ca]">{commander.role}</p><p className="mt-3 text-sm leading-6">{commander.description}</p><p className="mt-3 text-sm leading-6 text-[#c4d0ca]">{commander.equipment}</p><p className="mt-3 border-t border-white/15 pt-3 text-xs leading-5 text-[#b5c1bc]">სახე და აღჭურვილობა მხატვრული რეკონსტრუქციაა; ავთენტურ პორტრეტად არ არის წარმოდგენილი. გადაათრიე ფიგურის გარშემო დასათვალიერებლად.</p>
          </section>}
          <p className="text-xs font-semibold" style={{ color: ACCENT }}>
            {current.date}
          </p>
          <h2 className="mt-1 text-2xl">{current.title}</h2>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-chip">
            <div ref={barRef} className="h-full w-0" style={{ backgroundColor: ACCENT }} />
          </div>
          <p className="mt-4 text-[15px] leading-7 text-copy">{current.text}</p>
          <section className="mt-5 rounded-xl border border-[#e8ddce] bg-[#fbf7f1] p-4" aria-label="მიზეზშედეგობრივი კავშირები">
            <h3 className="text-sm font-semibold text-[#6b4218]">რატომ იცვლება ბრძოლის მსვლელობა?</h3>
            <ol className="mt-3 space-y-3 text-sm leading-6">
              {([['მიზეზი', DIDGORI_LEARNING[stage].cause], ['მოქმედება', DIDGORI_LEARNING[stage].action], ['შედეგი', DIDGORI_LEARNING[stage].result]]).map(([label, text]) => <li key={label}><strong>{label} → </strong>{text}</li>)}
            </ol>
            <p className="mt-4 border-t border-[#e8ddce] pt-3 text-sm leading-6"><strong>დააკვირდი: </strong>{DIDGORI_LEARNING[stage].watch}</p>
          </section>
          <p className="mt-3 text-xs leading-6 text-mute"><strong>წყარო და მოდელი: </strong>{DIDGORI_LEARNING[stage].evidence}</p>
          <button type="button" onClick={() => { go(stage); revealScene(); }} disabled={loading || error} className="mt-3 flex min-h-10 items-center gap-2 rounded-lg border border-line-strong bg-card px-3 py-2 text-sm font-semibold hover:bg-subtle disabled:opacity-40"><RotateCcw className="size-4" />ეტაპის თავიდან ნახვა</button>

          <h3 className="mt-8 text-sm font-semibold text-mute">ძალები</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border-s-4 border-[#c0392b] bg-[#f8f4f2] p-3">
              <p className="text-sm font-semibold">საქართველო — დავით IV</p>
              <ul className="mt-1 text-sm text-copy">
                {DIDGORI_FORCES.georgia.map((f) => (
                  <li key={f.name} className="flex justify-between gap-2">
                    <span>{f.name}</span>
                    <span className="tabular-nums">{f.n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border-s-4 border-[#2b3a6b] bg-[#f1f3f8] p-3">
              <p className="text-sm font-semibold">სელჯუკთა კოალიცია</p>
              <ul className="mt-1 text-sm text-copy">
                {DIDGORI_FORCES.coalition.map((f) => (
                  <li key={f.name}>
                    <span className="text-mute">{f.name}: </span>
                    {f.n}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <section className="mt-8" aria-label="თვითშემოწმება">
            <h3 className="text-sm font-semibold text-mute">შეამოწმე ცოდნა</h3>
            {DIDGORI_QUIZ.map((q, qi) => <fieldset key={q.question} className="mt-4 rounded-lg border border-line p-3">
              <legend className="px-1 text-sm font-semibold">{q.question}</legend>
              <div className="space-y-2">{q.answers.map((answer, ai) => <label key={answer} className="flex cursor-pointer items-start gap-2 text-sm leading-6"><input type="radio" name={`question-${qi}`} checked={attempts[qi] === ai} onChange={() => setAttempts((a) => ({ ...a, [qi]: ai }))} className="mt-1.5 size-4 accent-[#a0662b]" />{answer}</label>)}</div>
              {attempts[qi] !== undefined && <p role="status" className={cn("mt-3 text-sm leading-6", attempts[qi] === q.correct ? "text-[#147354]" : "text-[#93541e]")}>{attempts[qi] === q.correct ? "სწორია. " : "კიდევ დაფიქრდი. "}{q.explanation}</p>}
            </fieldset>)}
          </section>
          <h3 className="mt-8 text-sm font-semibold text-mute">წყაროები</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-copy">
            {DIDGORI_SOURCES.map((s) => (
              <li key={s.label}>{"href" in s && s.href ? <a href={s.href} target="_blank" rel="noreferrer" className="underline decoration-line-strong underline-offset-2 hover:text-ink">{s.label}</a> : s.label}</li>
            ))}
          </ul>
          <p className="mt-6 text-xs leading-5 text-faint">
            რელიეფი: AWS Terrain Tiles; თანამგზავრული სურათი: EOxCloudless 2024 (CC BY-NC-SA 4.0), თანამედროვე გზები და სოფლები მოშორებულია. ცხენის მოდელი და მოძრაობა: Quaternius (CC0). ჯარების განლაგება და ბრძოლის მსვლელობა რეკონსტრუქციაა წყაროების აღწერით; ფიგურები რაზმების პირობითი წარმომადგენლებია და არა ზუსტი აღრიცხვა; სუსტ მოწყობილობაზე მათი რაოდენობა მცირდება. ეკრანის დრო, დანაკარგები და მოძრაობის სიჩქარე სასწავლო მოდელის პარამეტრებია. დახრილი რელიეფი გადაადგილებას ანელებს. აღჭურვილობა ეპოქის სტილიზებული რეკონსტრუქციაა.
          </p>
        </article>
      </div>
    </div>
  );
}
