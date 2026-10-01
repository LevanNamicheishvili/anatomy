/**
 * Subjects shown on the portal home page. To add a subject, add an entry here; while it has no
 * `href` it is shown as "coming soon".
 */
export type SubjectIcon = "biology" | "geography" | "history";

export interface SubjectTool {
  name: string;
  description: string;
  href: string;
}

export interface Subject {
  slug: string;
  name: string;
  description: string;
  icon: SubjectIcon;
  /** Accent color of the subject's card. */
  color: string;
  /** Main page of the subject; missing while the subject is still being prepared. */
  href?: string;
  /** Preview image (in /public). */
  image?: string;
  /** Short facts shown on the card. */
  facts?: string[];
  /** Further entry points, e.g. printable materials for teachers. */
  tools?: SubjectTool[];
}

export const SUBJECTS: Subject[] = [
  {
    slug: "biology",
    name: "ბიოლოგია",
    description: "ადამიანის 3D ატლასი: ორგანოები, ძვლები და კუნთები, გულისა და სუნთქვის ანიმაციები, ქვიზი და ბარათები.",
    icon: "biology",
    color: "#0f8a74",
    href: "/anatomy",
    image: "/images/portal/anatomy.jpg",
    facts: ["2 239 სტრუქტურა", "12 თემა", "ქვიზი და ბარათები"],
    tools: [
      { name: "QR კოდები სახელმძღვანელოსთვის", description: "დასაბეჭდი კოდები თემებისთვის", href: "/qr" },
    ],
  },
  {
    slug: "geography",
    name: "გეოგრაფია",
    description: "დედამიწა, კონტინენტები, რელიეფი და საქართველოს გეოგრაფია.",
    icon: "geography",
    color: "#2f6fb0",
  },
  {
    slug: "history",
    name: "ისტორია",
    description: "საქართველოსა და მსოფლიოს ისტორია — მოვლენები, რუკები და ქრონოლოგია.",
    icon: "history",
    color: "#a0662b",
  },
];
