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
      {
        slug: "dna",
        name: "დნმ და მემკვიდრეობა",
        description: "ნამდვილი ატომური მოდელი: ორმაგი სპირალი, რეპლიკაცია, ცილის სინთეზი, ქრომოსომა, მუტაციები.",
        icon: "dna",
        grades: "X–XII",
        href: "/biology/dna",
      },
      {
        slug: "cell",
        name: "უჯრედი",
        description: "ჭრილში ნაჩვენები 3D უჯრედები: მემბრანა, ორგანოიდები, მცენარეული და ბაქტერიული უჯრედი, მიტოზი და მეიოზი.",
        icon: "cell",
        grades: "VII–XII",
        href: "/biology/cell",
      },
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
    description: "საქართველოს 3D რელიეფური რუკა: მთები, მდინარეები, ტბები, ბუნებრივი ზონები, ჰავა, მხარეები და ქალაქები.",
    icon: "geography",
    color: "#2f6fb0",
    href: "/geography",
    image: "/images/portal/georgia.jpg",
    facts: ["3D რელიეფი", "4 შრე", "18 მდინარე"],
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
      {
        slug: "relief",
        name: "რელიეფი, მდინარეები და ტბები",
        description: "კავკასიონი, ლიხის ქედი, დაბლობები და ზეგნები; შავი და კასპიის ზღვების აუზის მდინარეები, ტბები და წყალსაცავები.",
        icon: "mountain",
        grades: "VII–IX",
        href: "/geography/georgia?layer=physical",
      },
      {
        slug: "zones",
        name: "ბუნებრივი ზონები",
        description: "ვერტიკალური ზონალობა: კოლხური ტყიდან ალპურ მდელოებამდე და მყინვარებამდე.",
        icon: "mountain",
        grades: "VII–IX",
        href: "/geography/georgia?layer=zones",
      },
      {
        slug: "climate",
        name: "ჰავა",
        description: "ჰავის ტიპები: ნოტიო სუბტროპიკულიდან მარადიული თოვლის ჰავამდე — და რატომ.",
        icon: "climate",
        grades: "VII–IX",
        href: "/geography/georgia?layer=climate",
      },
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
