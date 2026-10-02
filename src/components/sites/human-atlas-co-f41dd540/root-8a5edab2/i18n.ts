import type { SystemKey } from "./atlas-data";
import type { PoseKey } from "./rig";

export type Locale = "ka";

export interface Strings {
  eyebrow: string;
  title: string;
  modeledPieces: string;
  findStructure: string;
  askAnatomy: string;
  about: string;
  systems: string;
  presets: { all: string; skeleton: string; organs: string };
  piecesVisible: (n: string) => string;
  hideAll: string;
  showAll: string;
  views: { threeQuarter: string; front: string; side: string; back: string; rotateRight: string; rotateLeft: string };
  caption: string;
  captionExploded: string;
  explode: string;
  assembled: string;
  everyPiece: string;
  reset: string;
  hints: [string, string, string];
  credits: string;
  searchPlaceholder: string;
  searchNote: string;
  noResults: string;
  askPlaceholder: string;
  ask: string;
  askNote: string;
  askNoMatch: string;
  close: string;
  systemOverview: string;
  atlasReference: string;
  selectedPieces: string;
  viewSource: string;
  isolate: string;
  showSurrounding: string;
  hideStructure: string;
  clearSelection: string;
  loading: string;
  loadingDetail: (done: number, total: number) => string;
  loadError: string;
  retry: string;
  aboutEyebrow: string;
  aboutTitle: string;
  aboutLead: string;
  aboutStats: string;
  aboutStatsDetail: string;
  aboutDisclaimer: string;
  aboutSourceHeading: string;
  aboutSource: string;
  datasetLicense: string;
  originalGeometry: string;
  publication: string;
  systemNames: Record<SystemKey, string>;
  systemDescriptions: Record<SystemKey, string>;
  language: string;
  animations: string;
  lessonsTitle: string;
  lessons: Record<"heart" | "breathing" | "circulation", { title: string; body: string }>;
  heartbeat: string;
  breathing: string;
  bloodFlow: string;
  heartRate: string;
  bpmUnit: string;
  phases: { atria: string; ventricles: string; relax: string; inhale: string; exhale: string };
  wholeBody: string;
  stopAll: string;
  controlsHint: string;
  topics: string;
  topicsTitle: string;
  topicFacts: string;
  topicHealth: string;
  printQr: string;
  qrPageTitle: string;
  qrPageLead: string;
  qrScan: string;
  downloadSvg: string;
  openTopic: string;
  collapse: string;
  expand: string;
  movement: string;
  posesTitle: string;
  movesTitle: string;
  poseNote: string;
  poses: Record<PoseKey, string>;
  deepDive: string;
  crossSection: string;
  microscope: string;
  outsideIn: string;
  cutDepth: string;
  visualGuide: string;
  tapHint: string;
  previous: string;
  next: string;
}

const en: Strings = {
  eyebrow: "Interactive anatomy",
  title: "Human Atlas",
  modeledPieces: "modeled pieces",
  findStructure: "Find a structure",
  askAnatomy: "Ask anatomy",
  about: "About this atlas",
  systems: "Systems",
  presets: { all: "All", skeleton: "Skeleton", organs: "Organs" },
  piecesVisible: (n) => `${n}  pieces visible`,
  hideAll: "Hide all",
  showAll: "Show all",
  views: {
    threeQuarter: "Three-quarter view",
    front: "Front view",
    side: "Side view",
    back: "Back view",
    rotateRight: "Rotate right",
    rotateLeft: "Rotate left",
  },
  caption: "Adult human · male",
  captionExploded: "Separated structures",
  explode: "Explode anatomy",
  assembled: "Assembled",
  everyPiece: "Every piece",
  reset: "Reset",
  hints: ["Drag to rotate", "Scroll to zoom", "Double-click to focus"],
  credits: "Source & credits",
  searchPlaceholder: "Search 3,432 structures",
  searchNote: "Try a bone, muscle, vessel or organ — results select every matching piece.",
  noResults: "No matching structure",
  askPlaceholder: "What is the role of the liver?",
  ask: "Ask",
  askNote: "Answers are limited to structures in this atlas and are not medical advice.",
  askNoMatch: "No structure in this atlas matches that question yet.",
  close: "Close",
  systemOverview: "System overview · structure identified from source anatomy",
  atlasReference: "Atlas reference",
  selectedPieces: "Selected pieces",
  viewSource: "View anatomical source",
  isolate: "Isolate structure",
  showSurrounding: "Show surrounding anatomy",
  hideStructure: "Hide structure",
  clearSelection: "Clear selection",
  loading: "Preparing the atlas",
  loadingDetail: (d, t) => `Streaming anatomy · ${d} of ${t}`,
  loadError: "The anatomy data could not be loaded.",
  retry: "Try again",
  aboutEyebrow: "Source & scope",
  aboutTitle: "A Body, Revealed.",
  aboutLead: "A free, browser-based walk through a complete adult male reference model.",
  aboutStats: "Adult human · male · BodyParts3D",
  aboutStatsDetail: "2,234 modeled pieces · 3,432 named concepts",
  aboutDisclaimer: "For learning and orientation only — never a substitute for clinical judgement.",
  aboutSourceHeading: "Source",
  aboutSource: "BodyParts3D, © The Database Center for Life Science · CC Attribution 4.0 International. Lung lobes: Z-Anatomy (Lluís Vinent), CC BY-SA 4.0.",
  datasetLicense: "Dataset license",
  originalGeometry: "Original geometry & metadata",
  publication: "Read the source publication",
  language: "Language",
  animations: "Animations",
  lessonsTitle: "How the body works",
  lessons: {
    heart: { title: "Heart at work", body: "Watch the atria and then the ventricles contract as the heart pumps blood." },
    breathing: { title: "Breathing", body: "With every breath the airways widen, the diaphragm lowers and the ribs lift." },
    circulation: { title: "Circulation", body: "Pulses leave the heart through the arteries and return through the veins." },
  },
  heartbeat: "Heartbeat",
  breathing: "Breathing",
  bloodFlow: "Blood flow",
  heartRate: "Heart rate",
  bpmUnit: "bpm",
  phases: {
    atria: "Atria contract",
    ventricles: "Ventricles contract (systole)",
    relax: "Heart relaxes and fills (diastole)",
    inhale: "Inhale",
    exhale: "Exhale",
  },
  wholeBody: "Show whole body",
  stopAll: "Stop animations",
  controlsHint: "Left drag: rotate · Right drag: move · Scroll: zoom",
  topics: "Topics",
  topicsTitle: "Topics for lessons",
  topicFacts: "Interesting facts",
  topicHealth: "Stay healthy",
  printQr: "QR codes for printing",
  qrPageTitle: "QR codes for textbooks",
  qrPageLead: "Print a code next to a topic in the textbook. Scanning it opens the 3D atlas on that topic.",
  qrScan: "Scan with a phone camera",
  downloadSvg: "Download SVG",
  openTopic: "Open",
  collapse: "Collapse",
  expand: "Read more",
  movement: "Movement & poses",
  posesTitle: "Poses",
  movesTitle: "Movements",
  poseNote: "Skin, muscles and organs move together with the skeleton.",
  poses: {
    standing: "Standing",
    armsUp: "Arms up",
    tPose: "Arms out",
    sitting: "Sitting",
    squat: "Squat",
    bendForward: "Bend forward",
    walk: "Walking",
    wave: "Waving",
    jumpingJack: "Jumping jacks",
    squatExercise: "Squats",
  },
  deepDive: "Look inside",
  crossSection: "Cross-section",
  microscope: "Micro-structure",
  outsideIn: "Layers from outside to inside",
  cutDepth: "3D cut depth",
  visualGuide: "Appearance",
  tapHint: "Tap a layer or number to learn more.",
  previous: "Previous",
  next: "Next",
  systemNames: {
    skeletal: "Skeleton",
    muscular: "Muscles",
    cardiac: "Heart",
    sensory: "Sensory organs",
    arterial: "Arteries",
    venous: "Veins",
    nervous: "Nervous system",
    respiratory: "Respiratory system",
    digestive: "Digestive system",
    urinary: "Urinary system",
    lymphatic: "Lymphatic system",
    endocrine: "Endocrine system",
    reproductive: "Reproductive system",
    integumentary: "Body surface",
    connective: "Connective tissue",
  },
  systemDescriptions: {
    skeletal: "Bones form the rigid frame of the body. They anchor muscles, shield delicate organs and store minerals, while marrow inside many of them produces blood cells.",
    muscular: "Skeletal muscles pull on bones across joints to create movement and hold posture. Working in opposing groups, they also generate much of the body's heat.",
    cardiac: "The heart is a four-chambered muscular pump. Its right side sends blood through the lungs; its left side drives oxygenated blood out to every tissue.",
    sensory: "Sensory organs translate light, sound, balance and other signals into nerve impulses so the brain can build a picture of the outside world.",
    arterial: "Arteries carry blood away from the heart under pressure. Their thick, elastic walls branch progressively smaller until they feed capillary beds.",
    venous: "Veins return blood to the heart at low pressure. Valves in many of them keep flow moving in one direction, helped along by surrounding muscle.",
    nervous: "The brain, spinal cord and peripheral nerves gather information, make decisions and send commands, coordinating nearly everything the body does.",
    respiratory: "Airways conduct air into the lungs, where thin-walled alveoli let oxygen enter the blood and carbon dioxide leave it.",
    digestive: "The digestive tract breaks food into absorbable nutrients and moves the remainder along. The liver, pancreas and gallbladder add the secretions it depends on.",
    urinary: "The kidneys filter blood to remove waste and balance water and salts. Urine then passes through the ureters to the bladder for storage.",
    lymphatic: "Lymphatic vessels and tissues return excess fluid to the bloodstream and host immune cells that watch for infection.",
    endocrine: "Endocrine glands release hormones into the blood, regulating growth, metabolism, stress responses and many slower body processes.",
    reproductive: "Reproductive organs produce gametes and hormones. In this male reference they include the testes, ducts, accessory glands and external genitalia.",
    integumentary: "The body surface — skin, hair and related structures — forms a protective barrier, helps regulate temperature and carries touch receptors.",
    connective: "Ligaments, cartilage and other connective tissues bind structures together, cushion joints and transmit forces between parts of the body.",
  },
};

const ka: Strings = {
  ...en,
  eyebrow: "ინტერაქტიული ანატომია",
  title: "ადამიანის ატლასი",
  modeledPieces: "მოდელირებული ნაწილი",
  findStructure: "სტრუქტურის ძიება",
  askAnatomy: "ჰკითხე ანატომიას",
  about: "ატლასის შესახებ",
  systems: "სისტემები",
  presets: { all: "ყველა", skeleton: "ჩონჩხი", organs: "ორგანოები" },
  piecesVisible: (n) => `${n} ნაწილი ჩანს`,
  hideAll: "ყველას დამალვა",
  showAll: "ყველას ჩვენება",
  views: {
    threeQuarter: "სამი მეოთხედის ხედი",
    front: "წინა ხედი",
    side: "გვერდითი ხედი",
    back: "უკანა ხედი",
    rotateRight: "მარჯვნივ მობრუნება",
    rotateLeft: "მარცხნივ მობრუნება",
  },
  caption: "ზრდასრული ადამიანი · მამრობითი",
  captionExploded: "დაშლილი სტრუქტურები",
  explode: "ანატომიის დაშლა",
  assembled: "აწყობილი",
  everyPiece: "ყველა ნაწილი",
  reset: "საწყისი",
  hints: ["გადაათრიე მოსაბრუნებლად", "ბორბლით გაადიდე", "ორჯერ დააწკაპე მისაახლოებლად"],
  credits: "წყარო და ავტორები",
  searchPlaceholder: "მოძებნე: გული, ღვიძლი, ბარძაყის ძვალი…",
  searchNote: "ჩაწერე ორგანოს ან ძვლის სახელი ქართულად ან ინგლისურად — მაგალითად: გული, ღვიძლი, ბარძაყის ძვალი.",
  noResults: "შესაბამისი სტრუქტურა ვერ მოიძებნა",
  askPlaceholder: "რა ფუნქცია აქვს ღვიძლს?",
  ask: "კითხვა",
  askNote: "პასუხები მხოლოდ ამ ატლასის სტრუქტურებს ეხება და სამედიცინო რჩევა არ არის.",
  askNoMatch: "ამ კითხვისთვის ატლასში შესაბამისი სტრუქტურა ვერ მოიძებნა.",
  close: "დახურვა",
  systemOverview: "სისტემის მიმოხილვა · სტრუქტურა განსაზღვრულია წყაროს მონაცემებით",
  atlasReference: "ატლასის კოდი",
  selectedPieces: "არჩეული ნაწილები",
  viewSource: "ანატომიური წყაროს ნახვა",
  isolate: "მხოლოდ ამ სტრუქტურის ჩვენება",
  showSurrounding: "მიმდებარე ანატომიის ჩვენება",
  hideStructure: "სტრუქტურის დამალვა",
  clearSelection: "არჩევის გაუქმება",
  loading: "ატლასი მზადდება",
  loadingDetail: (d, t) => `ანატომია იტვირთება · ${d} / ${t}`,
  loadError: "ანატომიური მონაცემები ვერ ჩაიტვირთა.",
  retry: "თავიდან ცდა",
  aboutEyebrow: "წყარო და მასშტაბი",
  aboutTitle: "ადამიანის სხეული — ახლოდან.",
  aboutLead: "უფასო სასწავლო ატლასი ბრაუზერში — ზრდასრული მამაკაცის სრული საცნობარო მოდელი საქართველოს სკოლებისთვის.",
  aboutStats: "ზრდასრული ადამიანი · მამრობითი · BodyParts3D",
  aboutStatsDetail: "2 234 მოდელირებული ნაწილი · 3 432 დასახელებული ცნება",
  aboutDisclaimer: "მხოლოდ სასწავლო მიზნებისთვის — არ ცვლის ექიმის შეფასებას.",
  aboutSourceHeading: "წყარო",
  aboutSource: "BodyParts3D, © The Database Center for Life Science · CC BY 4.0. ფილტვის წილები: Z-Anatomy (Lluís Vinent), CC BY-SA 4.0.",
  datasetLicense: "მონაცემთა ლიცენზია",
  originalGeometry: "ორიგინალი გეომეტრია და მეტამონაცემები",
  publication: "სამეცნიერო პუბლიკაციის წაკითხვა",
  language: "ენა",
  animations: "ანიმაციები",
  lessonsTitle: "როგორ მუშაობს სხეული",
  lessons: {
    heart: { title: "გულის მუშაობა", body: "უყურე, როგორ იკუმშება ჯერ წინაგულები, შემდეგ პარკუჭები და როგორ ტუმბავს გული სისხლს." },
    breathing: { title: "სუნთქვა", body: "ყოველ ჩასუნთქვაზე სასუნთქი გზები ფართოვდება, დიაფრაგმა ქვემოთ ეშვება და ნეკნები მაღლა იწევს." },
    circulation: { title: "სისხლის მიმოქცევა", body: "სისხლის ტალღა გულიდან არტერიებით გადის და ვენებით ბრუნდება უკან." },
  },
  heartbeat: "გულისცემა",
  breathing: "სუნთქვა",
  bloodFlow: "სისხლის ნაკადი",
  heartRate: "გულისცემის სიხშირე",
  bpmUnit: "დარტყმა/წთ",
  phases: {
    atria: "წინაგულები იკუმშება",
    ventricles: "პარკუჭები იკუმშება (სისტოლა)",
    relax: "გული მოდუნდება და ივსება (დიასტოლა)",
    inhale: "ჩასუნთქვა",
    exhale: "ამოსუნთქვა",
  },
  wholeBody: "მთელი სხეულის ჩვენება",
  stopAll: "ანიმაციების გაჩერება",
  controlsHint: "მარცხენა ღილაკი: მობრუნება · მარჯვენა: გადაადგილება · ბორბალი: გადიდება",
  topics: "თემები",
  topicsTitle: "თემები გაკვეთილებისთვის",
  topicFacts: "საინტერესო ფაქტები",
  topicHealth: "ჯანმრთელობისთვის",
  printQr: "QR კოდები დასაბეჭდად",
  qrPageTitle: "QR კოდები სახელმძღვანელოებისთვის",
  qrPageLead: "დაბეჭდე კოდი სახელმძღვანელოში შესაბამის თემასთან. მოსწავლე მას ტელეფონის კამერით დაასკანერებს და 3D ატლასი პირდაპირ ამ თემაზე გაიხსნება.",
  qrScan: "დაასკანერე ტელეფონის კამერით",
  downloadSvg: "SVG-ის ჩამოტვირთვა",
  openTopic: "გახსნა",
  collapse: "აკეცვა",
  expand: "მეტის წაკითხვა",
  movement: "მოძრაობა და პოზები",
  posesTitle: "პოზები",
  movesTitle: "მოძრაობები",
  poseNote: "კანი, კუნთები და ორგანოები ჩონჩხთან ერთად მოძრაობს.",
  poses: {
    standing: "დგომა",
    armsUp: "ხელები მაღლა",
    tPose: "ხელები გვერდზე",
    sitting: "ჯდომა",
    squat: "ჩაცუცქვა",
    bendForward: "წინ დახრა",
    walk: "სიარული",
    wave: "ხელის დაქნევა",
    jumpingJack: "ხტუნვა",
    squatExercise: "ჩაჯდომა-ადგომა",
  },
  deepDive: "შიგნით ჩახედვა",
  crossSection: "განივი ჭრილი",
  microscope: "მიკროსტრუქტურა",
  outsideIn: "შრეები გარედან შიგნით",
  cutDepth: "3D ჭრილის სიღრმე",
  visualGuide: "გარეგნობა",
  tapHint: "შეეხე შრეს ან ნომერს, რომ მეტი გაიგო.",
  previous: "წინა",
  next: "შემდეგი",
  systemNames: {
    skeletal: "ჩონჩხი",
    muscular: "კუნთები",
    cardiac: "გული",
    sensory: "გრძნობის ორგანოები",
    arterial: "არტერიები",
    venous: "ვენები",
    nervous: "ნერვული სისტემა",
    respiratory: "სასუნთქი სისტემა",
    digestive: "საჭმლის მომნელებელი სისტემა",
    urinary: "შარდგამომყოფი სისტემა",
    lymphatic: "ლიმფური სისტემა",
    endocrine: "ენდოკრინული სისტემა",
    reproductive: "რეპროდუქციული სისტემა",
    integumentary: "სხეულის ზედაპირი",
    connective: "შემაერთებელი ქსოვილი",
  },
  systemDescriptions: {
    skeletal: "ძვლები სხეულის მყარ ჩარჩოს ქმნის. მათზე კუნთები მაგრდება, ისინი იცავს შინაგან ორგანოებს და ინახავს მინერალებს, ხოლო ძვლის ტვინი სისხლის უჯრედებს წარმოქმნის.",
    muscular: "ჩონჩხის კუნთები სახსრების გავლით ძვლებს ამოძრავებს და სხეულის პოზას ინარჩუნებს. ისინი წყვილ-წყვილად, საპირისპიროდ მუშაობს და სხეულის სითბოს დიდ ნაწილს გამოიმუშავებს.",
    cardiac: "გული ოთხკამერიანი კუნთოვანი ტუმბოა. მისი მარჯვენა ნახევარი სისხლს ფილტვებში აგზავნის, მარცხენა კი ჟანგბადით მდიდარ სისხლს მთელ სხეულს უგზავნის.",
    sensory: "გრძნობის ორგანოები სინათლეს, ხმას, წონასწორობას და სხვა სიგნალებს ნერვულ იმპულსებად გარდაქმნის, რათა ტვინმა გარემო აღიქვას.",
    arterial: "არტერიებს გულიდან სისხლი წნევით გამოაქვს. მათი სქელი, ელასტიკური კედლები თანდათან წვრილ ტოტებად იყოფა და კაპილარებამდე აღწევს.",
    venous: "ვენები სისხლს გულს დაბალი წნევით უბრუნებს. ბევრ მათგანში სარქველებია, რომლებიც სისხლს მხოლოდ ერთი მიმართულებით ატარებს.",
    nervous: "თავის ტვინი, ზურგის ტვინი და პერიფერიული ნერვები ინფორმაციას აგროვებს, გადაწყვეტილებებს იღებს და ბრძანებებს გადასცემს — ისინი სხეულის თითქმის ყველა ფუნქციას მართავს.",
    respiratory: "სასუნთქი გზები ჰაერს ფილტვებამდე ატარებს, სადაც თხელკედლიანი ალვეოლები ჟანგბადს სისხლში გადასცემს და ნახშირორჟანგს გამოყოფს.",
    digestive: "საჭმლის მომნელებელი ტრაქტი საკვებს შესაწოვ ნივთიერებებად შლის. ღვიძლი, კუჭქვეშა ჯირკვალი და ნაღვლის ბუშტი მისთვის აუცილებელ სეკრეტს გამოყოფს.",
    urinary: "თირკმელები სისხლს ფილტრავს, აშორებს ნარჩენებს და არეგულირებს წყლისა და მარილების ბალანსს. შარდი შარდსაწვეთებით შარდის ბუშტში გროვდება.",
    lymphatic: "ლიმფური ძარღვები და ქსოვილები ზედმეტ სითხეს სისხლში აბრუნებს და იმუნურ უჯრედებს იტევს, რომლებიც ინფექციას ებრძვის.",
    endocrine: "ენდოკრინული ჯირკვლები სისხლში ჰორმონებს გამოყოფს და არეგულირებს ზრდას, ნივთიერებათა ცვლას და სტრესზე რეაქციას.",
    reproductive: "რეპროდუქციული ორგანოები სასქესო უჯრედებს და ჰორმონებს წარმოქმნის. ამ მამრობით მოდელში ისინი მოიცავს სათესლე ჯირკვლებს, სადინრებს და დამხმარე ჯირკვლებს.",
    integumentary: "სხეულის ზედაპირი — კანი, თმა და მსგავსი სტრუქტურები — დამცავ ბარიერს ქმნის, ტემპერატურას არეგულირებს და შეხების რეცეპტორებს შეიცავს.",
    connective: "იოგები, ხრტილი და სხვა შემაერთებელი ქსოვილები სტრუქტურებს ერთმანეთთან აკავშირებს, სახსრებს იცავს და ძალას გადასცემს.",
  },
};

export const STRINGS: Record<Locale, Strings> = { ka };

const GROUP_SEPARATOR: Record<Locale, string> = { ka: "\u00a0" };

/** Deterministic number formatting (Intl output differs between Node and browsers for some locales). */
export function formatNumber(n: number, locale: Locale): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR[locale]);
}
