import { BIOLOGY_GRADES, type Lesson } from "@/lib/curriculum";
import { lessonHref, lessonKey } from "@/lib/lessons";
import type { TopicIcon } from "@/lib/subjects";

/*
 * Biology by topic, not by grade: the textbooks for different grades cover much of the same material, so
 * each topic gathers its lessons from every grade (VIII–XII) plus the 3D models and journeys about it.
 * Lessons are referenced by grade and textbook key (grade XII: a prefix of the title).
 */

export interface BioTool {
  label: string;
  href: string;
  kind: "3d" | "journey" | "atlas";
}

interface TopicDef {
  slug: string;
  title: string;
  description: string;
  icon: TopicIcon;
  tools: BioTool[];
  lessons: [number, string][];
}

export interface BioLesson {
  title: string;
  href: string;
  grade: number;
  key: string;
  /** Titles of other lessons that open the same place (shown under the title, found by search). */
  aka: string[];
}

export interface BioTopic extends Omit<TopicDef, "lessons"> {
  lessons: BioLesson[];
}

const DEFS: TopicDef[] = [
  {
    slug: "cell",
    title: "უჯრედი",
    description: "უჯრედული თეორია, მემბრანა, ბირთვი, ორგანოიდები, პრო- და ეუკარიოტები.",
    icon: "cell",
    tools: [
      { label: "უჯრედი 3D-ში", href: "/biology/cell", kind: "3d" },
      { label: "მოგზაურობა: სხეულიდან დნმ-მდე", href: "/biology/journeys?j=zoom", kind: "journey" },
    ],
    lessons: [[8, "1.1"], [10, "1.2.1"], [10, "1.2.2"], [10, "1.2.4"], [10, "1.2.5"], [10, "1.2.6"], [10, "1.2.7"], [10, "1.2.8"], [10, "1.2.9"], [12, "პროკარიოტები"], [12, "ეუკარიოტები"], [10, "1.2.10"]],
  },
  {
    slug: "chemistry",
    title: "უჯრედის ქიმია და ენერგია",
    description: "წყალი, მარილები, ცილები, ნახშირწყლები, ლიპიდები, ატფ, სუნთქვა და ფოტოსინთეზი.",
    icon: "atom",
    tools: [{ label: "მიტოქონდრია და ქლოროპლასტი 3D-ში", href: "/biology/cell?s=energy", kind: "3d" }],
    lessons: [[10, "1.1.1"], [10, "1.1.2"], [10, "1.1.3"], [10, "1.1.5"], [10, "1.1.6"], [10, "1.1.7"], [10, "1.1.8"], [10, "1.1.9"], [10, "1.1.10"], [10, "1.3.1"], [10, "1.3.2"]],
  },
  {
    slug: "tissues",
    title: "ქსოვილები და ორგანიზაციის დონეები",
    description: "ცხოველური და მცენარეული ქსოვილები; უჯრედიდან ორგანიზმამდე.",
    icon: "tissue",
    tools: [{ label: "მოგზაურობა: სხეული → ორგანო → ქსოვილი → უჯრედი", href: "/biology/journeys?j=zoom", kind: "journey" }],
    lessons: [[8, "1.2"], [8, "1.3"], [10, "1.2.3"], [8, "1.4"], [12, "სიმეტრია"]],
  },
  {
    slug: "movement",
    title: "ჩონჩხი და კუნთები",
    description: "ძვლის აგებულება და ზრდა, სახსრები, კუნთები და მოძრაობა, ტანადობა.",
    icon: "bone",
    tools: [
      { label: "მოგზაურობა ძვლის შიგნით", href: "/biology/journeys?j=bone", kind: "journey" },
      { label: "კუნთის მუშაობა", href: "/biology/journeys?j=muscle", kind: "journey" },
      { label: "ჩონჩხი ატლასში", href: "/topic/skeleton", kind: "atlas" },
      { label: "კუნთები ატლასში", href: "/topic/muscles", kind: "atlas" },
    ],
    lessons: [[8, "2.1"], [8, "2.2"], [8, "2.3"], [8, "2.4"], [8, "2.5"], [8, "2.6"], [8, "2.7"], [8, "2.8"], [8, "2.9"], [12, "ორგანიზმების აგებულება"]],
  },
  {
    slug: "blood",
    title: "სისხლი და იმუნიტეტი",
    description: "შინაგანი გარემო, სისხლის უჯრედები, შედედება, ჯგუფები, იმუნიტეტი.",
    icon: "blood",
    tools: [{ label: "სისხლი 3D-ში", href: "/biology/blood", kind: "3d" }],
    lessons: [[8, "3.1"], [8, "3.2"], [8, "3.3"], [8, "3.4"], [10, "§11"]],
  },
  {
    slug: "circulation",
    title: "გული და სისხლის მიმოქცევა",
    description: "გულის აგებულება და ციკლი, სისხლძარღვები, დიდი და მცირე წრე, დაავადებები.",
    icon: "heart",
    tools: [
      { label: "გული 3D-ში", href: "/biology/heart", kind: "3d" },
      { label: "სისხლის მოგზაურობა", href: "/biology/journeys?j=blood", kind: "journey" },
    ],
    lessons: [[8, "3.5"], [8, "3.6"], [8, "3.7"], [8, "3.8"], [12, "სისხლის მიმოქცევა"], [8, "3.9"]],
  },
  {
    slug: "breathing",
    title: "სუნთქვა",
    description: "სასუნთქი ორგანოები, სუნთქვითი მოძრაობები და მათი რეგულაცია, დაავადებები.",
    icon: "lungs",
    tools: [
      { label: "ფილტვები ატლასში", href: "/topic/lungs", kind: "atlas" },
      { label: "გაზთა ცვლა ალვეოლში", href: "/biology/journeys?j=blood", kind: "journey" },
    ],
    lessons: [[8, "3.10"], [8, "3.11"], [8, "3.12"], [12, "სუნთქვა"], [8, "3.13"]],
  },
  {
    slug: "digestion",
    title: "კვება და მონელება",
    description: "საკვები ნივთიერებები, მონელება პირში, კუჭსა და ნაწლავში, ჯანსაღი კვება.",
    icon: "digest",
    tools: [{ label: "საჭმლის მომნელებელი სისტემა ატლასში", href: "/topic/digestion", kind: "atlas" }],
    lessons: [[8, "3.14"], [8, "3.15"], [8, "3.16"], [8, "3.17"], [8, "3.18"], [8, "3.19"], [12, "საჭმლის მონელება"], [8, "3.20"], [8, "4.3"]],
  },
  {
    slug: "excretion",
    title: "გამოყოფა და კანი",
    description: "ნივთიერებათა ცვლა, თირკმელი, წყლის ბალანსი, კანი, ექსკრეცია ცხოველებში.",
    icon: "kidney",
    tools: [{ label: "თირკმლები ატლასში", href: "/topic/kidneys", kind: "atlas" }],
    lessons: [[8, "3.21"], [8, "3.22"], [12, "ექსკრეცია"], [8, "3.23"], [8, "3.24"], [12, "ექსკრეცია ცხოველებში"]],
  },
  {
    slug: "nervous",
    title: "ნერვული სისტემა",
    description: "ნეირონი და იმპულსი, ზურგის და თავის ტვინი, რეფლექსები, ნერვული სისტემის ევოლუცია.",
    icon: "nerve",
    tools: [
      { label: "ნერვული სისტემა 3D-ში", href: "/biology/nervous", kind: "3d" },
      { label: "იმპულსის გზა ტვინიდან კუნთამდე", href: "/biology/journeys?j=impulse", kind: "journey" },
      { label: "თავის ტვინი ატლასში", href: "/topic/brain", kind: "atlas" },
    ],
    lessons: [[9, "1.1"], [9, "1.2"], [12, "ნეირონის აგებულება"], [9, "1.3"], [9, "1.4"], [9, "1.5"], [9, "1.6"], [9, "1.7"], [9, "1.8"], [12, "ნერვული სისტემის ევოლუცია"]],
  },
  {
    slug: "senses",
    title: "შეგრძნების ორგანოები",
    description: "თვალი და მხედველობა, ყური და სმენა, მათი დარღვევები.",
    icon: "eye",
    tools: [{ label: "თვალი ატლასში", href: "/topic/eye", kind: "atlas" }],
    lessons: [[9, "2.1"], [9, "2.2"], [9, "2.3"], [9, "2.4"], [9, "2.5"], [9, "2.6"]],
  },
  {
    slug: "hormones",
    title: "ჰორმონები",
    description: "ენდოკრინული ჯირკვლები, ჰიპოფიზი, ფარისებრი ჯირკვალი, გლუკოზის რეგულაცია.",
    icon: "hormone",
    tools: [],
    lessons: [[9, "1.10"], [9, "1.11"], [9, "1.12"], [9, "1.13"]],
  },
  {
    slug: "health",
    title: "ჯანმრთელობა",
    description: "თამბაქო, ალკოჰოლი, ფსიქოაქტიური ნივთიერებები, ფიზიკური აქტივობა.",
    icon: "health",
    tools: [],
    lessons: [[8, "4.1"], [8, "4.2"], [9, "1.9"], [8, "4.4"]],
  },
  {
    slug: "reproduction",
    title: "გამრავლება და განვითარება",
    description: "უსქესო და სქესობრივი გამრავლება, მეიოზი, განაყოფიერება, ჩანასახის განვითარება.",
    icon: "baby",
    tools: [{ label: "მიტოზი და მეიოზი 3D-ში", href: "/biology/cell?s=meiosis", kind: "3d" }],
    lessons: [[12, "უსქესო გამრავლება"], [12, "სქესობრივი გამრავლება ცხოველებში"], [10, "§8"], [10, "§9"], [10, "§10"], [9, "3.1"], [9, "3.2"], [9, "3.3"], [9, "3.4"], [9, "3.5"], [9, "3.6"], [9, "3.7"], [9, "3.8"]],
  },
  {
    slug: "dna",
    title: "დნმ და ცილის სინთეზი",
    description: "დნმ-ის რეპლიკაცია, გენეტიკური კოდი, ტრანსკრიფცია, ტრანსლაცია, მიტოზი.",
    icon: "dna",
    tools: [{ label: "დნმ 3D-ში", href: "/biology/dna", kind: "3d" }],
    lessons: [[10, "§1"], [10, "§2"], [10, "§3"], [10, "§4"], [10, "§5"], [10, "§6"], [10, "§7"]],
  },
  {
    slug: "genetics",
    title: "გენეტიკა",
    description: "მენდელის კანონები, შეჯვარებები, სქესთან შეჭიდული მემკვიდრეობა, ცვალებადობა, ბიოტექნოლოგია.",
    icon: "genetics",
    tools: [{ label: "მუტაციები 3D-ში", href: "/biology/dna?s=mutation", kind: "3d" }],
    lessons: [[11, "1.1"], [11, "1.2"], [11, "1.3"], [11, "1.4"], [11, "1.5"], [11, "1.6"], [11, "1.7"], [11, "1.8"], [11, "1.9"], [11, "1.10"], [11, "1.11"], [11, "1.12"], [11, "1.13"], [11, "1.14"], [11, "1.15"], [11, "1.16"], [11, "1.17"], [11, "1.18"], [11, "1.19"]],
  },
  {
    slug: "evolution",
    title: "ევოლუცია",
    description: "კლასიფიკაცია, ბუნებრივი გადარჩევა, შეგუებულობა, სახეობათწარმოქმნა, საბუთები.",
    icon: "evolution",
    tools: [],
    lessons: [[11, "2.1"], [11, "2.2"], [11, "2.3"], [11, "2.4"], [11, "2.5"], [11, "2.6"], [12, "მემკვიდრეობითობისა და ცვალებადობის"], [12, "ექსპერიმენტები"], [11, "2.7"], [11, "2.8"], [12, "შედარებითი ბიოლოგია"]],
  },
  {
    slug: "plants",
    title: "მცენარეები",
    description: "მინერალური კვება, ნივთიერებათა ტრანსპორტი, გამრავლება, ტროპიზმები და ჰორმონები.",
    icon: "plant",
    tools: [{ label: "მცენარეული უჯრედი 3D-ში", href: "/biology/cell?s=plant", kind: "3d" }],
    lessons: [[10, "1.1.4"], [12, "ნივთიერებათა ტრანსპორტი მცენარეებში"], [12, "სქესობრივი გამრავლება ყვავილოვან"], [12, "მცენარის გაღიზიანებადობა"], [12, "მცენარეული ჰორმონები"]],
  },
  {
    slug: "ecology",
    title: "ეკოლოგია და გარემო",
    description: "ეკოსისტემა, კვებითი ჯაჭვები, წრებრუნვა, ბიომრავალფეროვნება, დაბინძურება.",
    icon: "eco",
    tools: [],
    lessons: [[12, "ეკოსისტემა, როგორც"], [12, "ეკოლოგიური ფაქტორები"], [12, "ეკოსისტემის მდგრადობა"], [12, "კვებითი კავშირები"], [12, "ეკოლოგიური პირამიდები"], [12, "ნივთიერებათა წრებრუნვა"], [12, "ბიომრავალფეროვნების მნიშვნელობა"], [12, "საქართველოს ბიომრავალფეროვნება"], [12, "კონსერვაციული"], [12, "წყლისა და ნიადაგის"], [12, "ჰაერის დაბინძურება"], [12, "„სათბურის"]],
  },
];

function find(grade: number, key: string): Lesson | null {
  const g = BIOLOGY_GRADES.find((x) => x.grade === grade);
  const all = g?.chapters.flatMap((c) => c.lessons) ?? [];
  return all.find((l) => lessonKey(l) === key) ?? all.find((l) => l.title.startsWith(key)) ?? null;
}

/** Topics with their ready lessons; lessons that open the same place are merged into one row. */
export const BIO_TOPICS: BioTopic[] = DEFS.map(({ lessons, ...t }) => {
  const list: BioLesson[] = [];
  for (const [grade, key] of lessons) {
    const l = find(grade, key);
    const href = l && lessonHref(grade, l);
    if (!l || !href) continue;
    const title = l.title.replace(/\s*\(\+.*\)$/, "");
    const same = list.find((x) => x.href === href);
    if (same) {
      if (!same.aka.includes(title) && same.title !== title) same.aka.push(title);
      continue;
    }
    list.push({ title, href, grade, key: lessonKey(l), aka: [] });
  }
  return { ...t, lessons: list };
});

export const BIO_TOPIC_BY_SLUG = Object.fromEntries(BIO_TOPICS.map((t) => [t.slug, t])) as Record<string, BioTopic>;

/** The topic a written lesson page belongs to, with its neighbours there. */
export function lessonPlace(grade: number, key: string) {
  for (const topic of BIO_TOPICS) {
    const i = topic.lessons.findIndex((l) => l.grade === grade && l.key === key);
    if (i >= 0) return { topic, prev: topic.lessons[i - 1] ?? null, next: topic.lessons[i + 1] ?? null };
  }
  return null;
}
