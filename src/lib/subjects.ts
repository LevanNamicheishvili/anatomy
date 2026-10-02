/**
 * The portal's structure: subjects → topics. Every subject has its own page (/biology, /geography …)
 * listing its topics; a topic without `href` is shown as "coming soon".
 */
export type SubjectIcon = "biology" | "geography" | "history";
export type TopicIcon = "body" | "blood" | "dna" | "cell" | "map" | "mountain" | "climate" | "qr";

export interface Topic {
  slug: string;
  name: string;
  description: string;
  icon: TopicIcon;
  /** School grades the topic belongs to, e.g. "VIII–IX". */
  grades?: string;
  href?: string;
  /** Preview image (in /public). */
  image?: string;
  /** Teachers' and admins' tools are hidden from students. */
  staffOnly?: boolean;
}

export interface Subject {
  slug: string;
  name: string;
  description: string;
  icon: SubjectIcon;
  /** Accent colour of the subject. */
  color: string;
  /** The subject's page; missing while the whole subject is still being prepared. */
  href?: string;
  /** Preview image for the subject's card. */
  image?: string;
  /** Short facts shown on cards. */
  facts?: string[];
  topics: Topic[];
}

export const SUBJECTS: Subject[] = [
  {
    slug: "biology",
    name: "ბიოლოგია",
    description: "ადამიანის 3D ატლასი, სისხლი და სხვა თემები — ანიმაციებით, ქვიზებითა და ბარათებით.",
    icon: "biology",
    color: "#0f8a74",
    href: "/biology",
    image: "/images/portal/anatomy.jpg",
    facts: ["2 239 სტრუქტურა", "3D მოდელები", "ქვიზი და ბარათები"],
    topics: [
      {
        slug: "anatomy",
        name: "ადამიანის ატლასი",
        description: "ორგანოები, ძვლები, კუნთები და სისხლძარღვები 3D-ში; გულისცემა, სუნთქვა, პოზები, ქვიზი.",
        icon: "body",
        grades: "VIII–XII",
        href: "/anatomy",
        image: "/images/portal/anatomy.jpg",
      },
      {
        slug: "blood",
        name: "სისხლი",
        description: "პლაზმა, ერითროციტები, ლეიკოციტები, თრომბოციტები, შედედება, ჯგუფები, იმუნიტეტი.",
        icon: "blood",
        grades: "VIII–XII",
        href: "/biology/blood",
      },
      { slug: "dna", name: "დნმ და მემკვიდრეობა", description: "დნმ-ის აგებულება, რეპლიკაცია, ცილის სინთეზი, ქრომოსომები.", icon: "dna", grades: "X–XII" },
      { slug: "cell", name: "უჯრედი", description: "ორგანოიდები, მემბრანა, უჯრედის გაყოფა — მიტოზი და მეიოზი.", icon: "cell", grades: "VII–XII" },
      {
        slug: "qr",
        name: "QR კოდები სახელმძღვანელოსთვის",
        description: "დასაბეჭდი კოდები, რომლებიც წიგნიდან პირდაპირ თემას ხსნის.",
        icon: "qr",
        href: "/qr",
        staffOnly: true,
      },
    ],
  },
  {
    slug: "geography",
    name: "გეოგრაფია",
    description: "საქართველოს 3D რელიეფური რუკა: მხარეები, ქალაქები, მდინარეები და მწვერვალები.",
    icon: "geography",
    color: "#2f6fb0",
    href: "/geography",
    image: "/images/portal/georgia.jpg",
    facts: ["3D რელიეფი", "12 ადმინისტრაციული ერთეული", "ქალაქები და მწვერვალები"],
    topics: [
      {
        slug: "georgia",
        name: "საქართველოს რუკა",
        description: "მხარეები, ქალაქები, მდინარეები და მწვერვალები ნამდვილ რელიეფზე.",
        icon: "map",
        grades: "VII–XII",
        href: "/geography/georgia",
        image: "/images/portal/georgia.jpg",
      },
      { slug: "relief", name: "რელიეფი და მთები", description: "კავკასიონი, დაბლობები, ზეგნები — როგორ ჩამოყალიბდა.", icon: "mountain", grades: "VII–IX" },
      { slug: "climate", name: "ჰავა და ბუნებრივი ზონები", description: "ნალექები, ტემპერატურა, ჰავის ტიპები საქართველოში.", icon: "climate", grades: "VII–IX" },
    ],
  },
  {
    slug: "history",
    name: "ისტორია",
    description: "საქართველოსა და მსოფლიოს ისტორია — მოვლენები, რუკები და ქრონოლოგია.",
    icon: "history",
    color: "#a0662b",
    topics: [],
  },
];

export const SUBJECT_BY_SLUG = Object.fromEntries(SUBJECTS.map((s) => [s.slug, s])) as Record<string, Subject>;
