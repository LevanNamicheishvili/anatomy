"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Crown, MapPin, Plus, Minus, X } from "lucide-react";
import { TopicHeader } from "@/components/portal/TopicHeader";
import { JourneyScene } from "@/components/journeys/JourneyScene";
import { cn } from "@/lib/utils";
import { createDidgori, type BattleView } from "./didgori";
import { DIDGORI_LEARNING, DIDGORI_QUIZ } from "./didgori-learning";
import { DIDGORI_FORCES, DIDGORI_SOURCES, DIDGORI_STAGES } from "./didgori-data";

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

  const clearCommander = () => {
    viewRef.current.commander = null;
    setSelectedCommander(null);
    sceneRef.current?.refreshView();
  };
  const inspectCommander = (id: CommanderId) => {
    if (loading || error) return;
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
    sceneRef.current?.goTo(i);
    sceneRef.current?.setPlaying(true);
  };

  return (
    <div className="flex h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <TopicHeader subject={{ name: "ისტორია", href: "/history" }} topic="დიდგორის ბრძოლა, 1121" color={ACCENT} icon="battle" />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_52dvh_minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)_400px] lg:grid-rows-1">
        <nav aria-label="ბრძოლის ეტაპები" className="overflow-y-auto border-e border-[#e2e7e5] bg-white max-lg:border-e-0 max-lg:border-b">
          <ol className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0.5 lg:p-3">
            {DIDGORI_STAGES.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === stage ? "step" : undefined}
                  className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors lg:whitespace-normal", i === stage ? "bg-[#f6efe6] font-semibold text-[#6b4218]" : "text-[#33413e] hover:bg-[#f5f7f6]")}
                >
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", i === stage ? "text-white" : "bg-[#eef2f0] text-[#66736f]")} style={i === stage ? { backgroundColor: ACCENT } : undefined}>
                    {i + 1}
                  </span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
          <section className="mx-3 mb-4 border-t border-[#e2e7e5] pt-4 max-lg:hidden" aria-label="მეთაურების ახლო ხედები">
            <h2 className="flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-[#8b6337]"><Crown className="size-4" />მეფე და მეთაურები</h2>
            <div className="mt-3 space-y-2">{COMMANDERS.map((c) => <button type="button" key={c.id} disabled={loading || error} aria-pressed={selectedCommander === c.id} onClick={() => inspectCommander(c.id)} className={cn("w-full rounded-lg border p-3 text-left transition-colors disabled:opacity-40", selectedCommander === c.id ? "border-[#b78c54] bg-[#f8f0e5]" : "border-[#e8ebe8] hover:bg-[#f8f7f3]")}>
              <span className="block text-sm font-semibold">{c.name}</span><span className="mt-1 block text-xs leading-5 text-[#66736f]">{c.role}</span><span className="mt-2 block text-xs font-medium text-[#986627]">ფიგურის დათვალიერება ↗</span>
            </button>)}</div>
          </section>
        </nav>

        <div className="relative min-h-0 overflow-hidden bg-[#c8d4da]">
          <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label={`3D სიმულაცია: ${current.title}`} />
          <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[#33413e] shadow-sm">იტვირთება ბრძოლის ველი…</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
            <span className="rounded-full bg-[#111a18]/85 px-4 py-1.5 text-sm font-semibold text-white max-sm:text-xs">
              {commander ? commander.name : `${current.date} · ${current.title}`}
            </span>
          </div>
          {error && <div role="alert" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#eef2f0] p-6 text-center">
            <p className="font-semibold">3D სცენა ვერ ჩაიტვირთა</p>
            <p className="max-w-sm text-sm text-[#66736f]">შეამოწმე კავშირი და WebGL-ის მხარდაჭერა. ტექსტი და სასწავლო მასალა ხელმისაწვდომია.</p>
            <button type="button" className="rounded-lg bg-[#a0662b] px-4 py-2 text-white" onClick={() => { setError(false); setLoading(true); setRate(1); setRetry((n) => n + 1); }}>ხელახლა ცდა</button>
          </div>}
          <div className="absolute left-3 top-16 flex flex-wrap gap-2 rounded-lg bg-white/95 p-2 text-xs shadow-sm">
            <label className="flex items-center gap-1">ხედი
              <select aria-label="კამერის ხედი" value={camera} className="rounded border border-[#d9dfdb] p-1" onChange={(e) => { const value = e.target.value as BattleView["camera"]; clearCommander(); viewRef.current.camera = value; setCamera(value); sceneRef.current?.refreshView(); }}>
                <option value="cinematic">კინემატოგრაფიული</option><option value="tactical">ტაქტიკური</option>
              </select>
            </label>
            <label className="flex items-center gap-1">სიჩქარე
              <select aria-label="სიმულაციის სიჩქარე" value={rate} className="rounded border border-[#d9dfdb] p-1" onChange={(e) => { const value = Number(e.target.value); setRate(value); sceneRef.current?.setPlaybackRate(value); }}>
                {[0.5, 1, 1.5, 2].map((n) => <option key={n} value={n}>{n}×</option>)}
              </select>
            </label>
          </div>
          <div className="absolute right-3 top-16 flex flex-col gap-2">
            <button type="button" disabled={loading || error} aria-label="მიახლოება" onClick={() => sceneRef.current?.zoomBy(0.75)} className="flex size-9 items-center justify-center rounded-lg bg-white/95 shadow-sm disabled:opacity-40"><Plus className="size-4" /></button>
            <button type="button" disabled={loading || error} aria-label="დაშორება" onClick={() => sceneRef.current?.zoomBy(1.33)} className="flex size-9 items-center justify-center rounded-lg bg-white/95 shadow-sm disabled:opacity-40"><Minus className="size-4" /></button>
          </div>
          {commander && <div className="absolute inset-x-3 bottom-28 flex flex-wrap items-center justify-center gap-2 rounded-lg bg-[#17231f]/90 p-2 text-xs text-white">
            <button type="button" aria-pressed={!portrait} onClick={() => { setPortrait(false); viewRef.current.portrait = false; sceneRef.current?.refreshView(); }} className={cn("rounded px-3 py-2", !portrait && "bg-white/20")}>მთელი ფიგურა</button>
            <button type="button" aria-pressed={portrait} onClick={() => { setPortrait(true); viewRef.current.portrait = true; sceneRef.current?.refreshView(); }} className={cn("rounded px-3 py-2", portrait && "bg-white/20")}>სახის ახლო ხედი</button>
            <button type="button" onClick={clearCommander} className="flex items-center gap-1 rounded px-3 py-2"><X className="size-3" />ბრძოლაზე დაბრუნება</button>
          </div>}
          {!commander && stage !== 0 && stage !== 7 && <div className="pointer-events-none absolute right-3 top-40 space-y-1 rounded-lg bg-white/90 px-3 py-2 text-xs shadow-sm max-md:hidden">
            <p className="text-[#a92e26]">საქართველო · {ARMY_TOTALS.georgia.count}</p><p className="text-[#2b3a6b]">კოალიცია · {ARMY_TOTALS.coalition.count}*</p><p className="text-[10px] text-[#66736f]">*რაოდენობა სადავოა; საწყისი შეფასებები</p>
          </div>}
          <div className="pointer-events-none absolute bottom-16 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs text-[#33413e] max-md:hidden">
            <span className="text-[#a92e26]">● საქართველო</span> · <span className="text-[#2b3a6b]">● კოალიცია</span>
            <p className="mt-1">პაუზაზე: გადაათრიე ხედის მოსაბრუნებლად; გაადიდე ბორბლით.</p>
          </div>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 px-3">
            <button type="button" onClick={() => go(stage - 1)} disabled={stage === 0} aria-label="წინა" className="flex size-11 items-center justify-center rounded-lg bg-white text-[#111a18] shadow-sm disabled:opacity-40">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => { if (commander) clearCommander(); sceneRef.current?.setPlaying(!playing); }} className="flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: ACCENT }}>
              {playing ? <Pause className="size-4" /> : last ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
              {playing ? "პაუზა" : "გაგრძელება"}
            </button>
            <button type="button" onClick={() => go(stage + 1)} disabled={last} aria-label="შემდეგი" className="flex size-11 items-center justify-center rounded-lg bg-white text-[#111a18] shadow-sm disabled:opacity-40">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <article className="atlas-scroll min-h-0 overflow-y-auto border-s border-[#e2e7e5] bg-white px-5 py-5 max-lg:border-s-0 max-lg:border-t">
          <section className="mb-5 rounded-xl border border-[#e5d9c8] bg-[#fbf7ef] p-4" aria-label="ბრძოლის ძველი და დღევანდელი მდებარეობა">
            <p className="flex items-center gap-2 text-xs font-semibold text-[#986627]"><MapPin className="size-4" />სად მოხდა ბრძოლა?</p>
            <dl className="mt-3 space-y-2 text-sm"><div><dt className="text-xs text-[#7b7b70]">1121 წელი</dt><dd className="font-semibold">{DIDGORI_PLACE.historic}</dd></div><div><dt className="text-xs text-[#7b7b70]">დღეს</dt><dd className="font-semibold">{DIDGORI_PLACE.modern}</dd><dd className="mt-1 text-xs leading-5 text-[#66736f]">{DIDGORI_PLACE.region}</dd></div></dl>
            <p className="mt-3 text-xs leading-5 text-[#66736f]">{DIDGORI_PLACE.description}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-[#8b6337]"><button type="button" disabled={loading || error} onClick={() => go(0)}>საქართველოს რუკიდან ნახვა ↗</button><a href={DIDGORI_PLACE.mapHref} target="_blank" rel="noreferrer">დღევანდელ რუკაზე ↗</a></div>
            {stage === 0 && <p className="mt-3 text-[11px] leading-5 text-[#7b7b70]">დღევანდელი საქართველოს კონტურები ორიენტირისთვისაა. წერტილი მემორიალს აღნიშნავს; ბრძოლის ზუსტი საზღვრები უცნობია.</p>}
          </section>
          <label className="mb-4 block text-xs font-semibold text-[#66736f] lg:hidden">მეთაურის დათვალიერება<select aria-label="მეთაურის არჩევა" disabled={loading || error} value={selectedCommander ?? ""} onChange={(e) => e.target.value ? inspectCommander(e.target.value as CommanderId) : clearCommander()} className="mt-2 block w-full rounded-lg border border-[#e2e7e5] p-2 text-sm"><option value="">ბრძოლის საერთო ხედი</option>{COMMANDERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          {commander && <section className="mb-6 rounded-xl bg-[#192b27] p-4 text-white" aria-live="polite">
            <p className="text-xs text-[#d5b583]">მეთაურის 3D ფიგურა</p><h2 className="mt-2 text-xl">{commander.name}</h2><p className="mt-1 text-xs text-[#c4d0ca]">{commander.role}</p><p className="mt-3 text-sm leading-6">{commander.description}</p><p className="mt-3 text-sm leading-6 text-[#c4d0ca]">{commander.equipment}</p><p className="mt-3 border-t border-white/15 pt-3 text-xs leading-5 text-[#b5c1bc]">სახე და აღჭურვილობა მხატვრული რეკონსტრუქციაა; ავთენტურ პორტრეტად არ არის წარმოდგენილი. გადაათრიე ფიგურის გარშემო დასათვალიერებლად.</p>
          </section>}
          <p className="text-xs font-semibold" style={{ color: ACCENT }}>
            {current.date}
          </p>
          <h2 className="mt-1 text-2xl">{current.title}</h2>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#eef2f0]">
            <div ref={barRef} className="h-full w-0" style={{ backgroundColor: ACCENT }} />
          </div>
          <p className="mt-4 text-[15px] leading-7 text-[#33413e]">{current.text}</p>
          <section className="mt-5 rounded-xl border border-[#e8ddce] bg-[#fbf7f1] p-4" aria-label="მიზეზშედეგობრივი კავშირები">
            <h3 className="text-sm font-semibold text-[#6b4218]">რატომ იცვლება ბრძოლის მსვლელობა?</h3>
            <ol className="mt-3 space-y-3 text-sm leading-6">
              {([['მიზეზი', DIDGORI_LEARNING[stage].cause], ['მოქმედება', DIDGORI_LEARNING[stage].action], ['შედეგი', DIDGORI_LEARNING[stage].result]]).map(([label, text]) => <li key={label}><strong>{label} → </strong>{text}</li>)}
            </ol>
            <p className="mt-4 border-t border-[#e8ddce] pt-3 text-sm leading-6"><strong>დააკვირდი: </strong>{DIDGORI_LEARNING[stage].watch}</p>
          </section>
          <p className="mt-3 text-xs leading-6 text-[#66736f]"><strong>წყარო და მოდელი: </strong>{DIDGORI_LEARNING[stage].evidence}</p>
          <button type="button" onClick={() => go(stage)} disabled={loading || error} className="mt-3 flex items-center gap-2 rounded-lg border border-[#d9dfdb] px-3 py-2 text-sm disabled:opacity-40"><RotateCcw className="size-4" />ეტაპის თავიდან ნახვა</button>

          <h3 className="mt-8 text-sm font-semibold text-[#66736f]">ძალები</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border-s-4 border-[#c0392b] bg-[#f8f4f2] p-3">
              <p className="text-sm font-semibold">საქართველო — დავით IV</p>
              <ul className="mt-1 text-sm text-[#33413e]">
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
              <ul className="mt-1 text-sm text-[#33413e]">
                {DIDGORI_FORCES.coalition.map((f) => (
                  <li key={f.name}>
                    <span className="text-[#66736f]">{f.name}: </span>
                    {f.n}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <section className="mt-8" aria-label="თვითშემოწმება">
            <h3 className="text-sm font-semibold text-[#66736f]">შეამოწმე ცოდნა</h3>
            {DIDGORI_QUIZ.map((q, qi) => <fieldset key={q.question} className="mt-4 rounded-lg border border-[#e2e7e5] p-3">
              <legend className="px-1 text-sm font-semibold">{q.question}</legend>
              <div className="space-y-2">{q.answers.map((answer, ai) => <label key={answer} className="flex cursor-pointer items-start gap-2 text-sm leading-6"><input type="radio" name={`question-${qi}`} checked={attempts[qi] === ai} onChange={() => setAttempts((a) => ({ ...a, [qi]: ai }))} className="mt-1.5 accent-[#a0662b]" />{answer}</label>)}</div>
              {attempts[qi] !== undefined && <p role="status" className={cn("mt-3 text-sm leading-6", attempts[qi] === q.correct ? "text-[#147354]" : "text-[#93541e]")}>{attempts[qi] === q.correct ? "სწორია. " : "კიდევ დაფიქრდი. "}{q.explanation}</p>}
            </fieldset>)}
          </section>
          <h3 className="mt-8 text-sm font-semibold text-[#66736f]">წყაროები</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-[#33413e]">
            {DIDGORI_SOURCES.map((s) => (
              <li key={s.label}>{"href" in s && s.href ? <a href={s.href} target="_blank" rel="noreferrer" className="underline decoration-[#c3ccc9] underline-offset-2 hover:text-[#111a18]">{s.label}</a> : s.label}</li>
            ))}
          </ul>
          <p className="mt-6 text-xs leading-5 text-[#97a29e]">
            რელიეფი: AWS Terrain Tiles; თანამგზავრული სურათი: EOxCloudless 2024 (CC BY-NC-SA 4.0), თანამედროვე გზები და სოფლები მოშორებულია. ცხენის მოდელი და მოძრაობა: Quaternius (CC0). ჯარების განლაგება და ბრძოლის მსვლელობა რეკონსტრუქციაა წყაროების აღწერით; ფიგურები რაზმების პირობითი წარმომადგენლებია და არა ზუსტი აღრიცხვა; სუსტ მოწყობილობაზე მათი რაოდენობა მცირდება. ეკრანის დრო, დანაკარგები და მოძრაობის სიჩქარე სასწავლო მოდელის პარამეტრებია. დახრილი რელიეფი გადაადგილებას ანელებს. აღჭურვილობა ეპოქის სტილიზებული რეკონსტრუქციაა.
          </p>
        </article>
      </div>
    </div>
  );
}
