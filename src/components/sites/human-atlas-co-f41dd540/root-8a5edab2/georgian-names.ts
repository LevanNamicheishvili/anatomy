import type { SystemKey } from "./atlas-data";

/**
 * Georgian names for BodyParts3D structures.
 * 1. Pattern rules for systematic names (vertebrae, ribs, finger/toe bones, teeth, heart valves…).
 * 2. A dictionary of confident Georgian anatomical terms.
 * 3. A Georgian category fallback ("არტერია", "კუნთი" …) so the UI never shows English.
 */

const ORDINAL: Record<string, string> = {
  first: "პირველი",
  second: "მეორე",
  third: "მესამე",
  fourth: "მეოთხე",
  fifth: "მეხუთე",
  sixth: "მეექვსე",
  seventh: "მეშვიდე",
  eighth: "მერვე",
  ninth: "მეცხრე",
  tenth: "მეათე",
  eleventh: "მეთერთმეტე",
  twelfth: "მეთორმეტე",
};

const VERTEBRA_REGION: Record<string, string> = { cervical: "კისრის", thoracic: "გულმკერდის", lumbar: "წელის" };

const FINGER: Record<string, string> = {
  thumb: "ცერის",
  "index finger": "საჩვენებელი თითის",
  "middle finger": "შუა თითის",
  "ring finger": "არათითის",
  "little finger": "ნეკის",
  "big toe": "ცერა თითის",
  "second toe": "მეორე თითის",
  "third toe": "მესამე თითის",
  "fourth toe": "მეოთხე თითის",
  "little toe": "ნეკა თითის",
};

const PHALANX: Record<string, string> = {
  distal: "დისტალური ფალანგა",
  middle: "შუა ფალანგა",
  proximal: "პროქსიმალური ფალანგა",
};

/** Exact (side-less, lower-case) names → Georgian. */
const DICT: Record<string, string> = {
  // Skeleton
  femur: "ბარძაყის ძვალი",
  tibia: "დიდი წვივის ძვალი",
  fibula: "მცირე წვივის ძვალი",
  patella: "კვირისთავი",
  humerus: "მხრის ძვალი",
  radius: "სხივის ძვალი",
  ulna: "იდაყვის ძვალი",
  clavicle: "ლავიწი",
  scapula: "ბეჭი",
  "body of sternum": "მკერდის ძვლის სხეული",
  manubrium: "მკერდის ძვლის სახელური",
  "xiphoid process": "მახვილისებრი მორჩი",
  sacrum: "გავა",
  coccyx: "კუდუსუნი",
  "hip bone": "მენჯის ძვალი",
  "frontal bone": "შუბლის ძვალი",
  "parietal bone": "თხემის ძვალი",
  "occipital bone": "კეფის ძვალი",
  "temporal bone": "საფეთქლის ძვალი",
  "sphenoid bone": "სოლისებრი ძვალი",
  ethmoid: "ცხავისებრი ძვალი",
  "nasal bone": "ცხვირის ძვალი",
  maxilla: "ზედა ყბა",
  mandible: "ქვედა ყბა",
  "zygomatic bone": "ყვრიმალის ძვალი",
  vomer: "სახნისი",
  "palatine bone": "სასის ძვალი",
  "lacrimal bone": "ცრემლის ძვალი",
  "hyoid bone": "ინის ძვალი",
  atlas: "ატლანტი (I კისრის მალა)",
  axis: "ღერძი (II კისრის მალა)",
  calcaneus: "ქუსლის ძვალი",
  talus: "კოჭი",
  "cuboid bone": "კუბისებრი ძვალი",
  "medial cuneiform bone": "შიგნითა სოლისებრი ძვალი",
  "intermediate cuneiform bone": "შუა სოლისებრი ძვალი",
  "lateral cuneiform bone": "გარეთა სოლისებრი ძვალი",
  "navicular bone of foot": "ტერფის ნავისებრი ძვალი",
  scaphoid: "ნავისებრი ძვალი",
  lunate: "მთვარისებრი ძვალი",
  triquetral: "სამწახნაგა ძვალი",
  pisiform: "მუხუდოსებრი ძვალი",
  trapezium: "ტრაპეციის ძვალი",
  trapezoid: "ტრაპეციისებრი ძვალი",
  capitate: "თავიანი ძვალი",
  hamate: "კაუჭიანი ძვალი",
  "sesamoid bone of foot": "ტერფის სეზამისებრი ძვალი",
  "intervertebral disk": "მალთაშუა დისკო",
  "thyroid cartilage": "ფარისებრი ხრტილი",
  "cricoid cartilage": "ბეჭდისებრი ხრტილი",
  "arytenoid cartilage": "ციცხვისებრი ხრტილი",
  "gingiva of upper jaw": "ზედა ყბის ღრძილი",
  "gingiva of lower jaw": "ქვედა ყბის ღრძილი",
  // Organs
  heart: "გული",
  liver: "ღვიძლი",
  stomach: "კუჭი",
  spleen: "ელენთა",
  pancreas: "კუჭქვეშა ჯირკვალი",
  gallbladder: "ნაღვლის ბუშტი",
  kidney: "თირკმელი",
  "urinary bladder": "შარდის ბუშტი",
  ureter: "შარდსაწვეთი",
  urethra: "შარდსადენი",
  esophagus: "საყლაპავი",
  trachea: "ტრაქეა (სასულე)",
  larynx: "ხორხი",
  pharynx: "ხახა",
  epiglottis: "ხორხსარქველი",
  tongue: "ენა",
  brain: "თავის ტვინი",
  cerebrum: "დიდი ტვინი",
  cerebellum: "ნათხემი",
  "spinal cord": "ზურგის ტვინი",
  eyeball: "თვალის კაკალი",
  lens: "ბროლი",
  cornea: "რქოვანა",
  "thyroid gland": "ფარისებრი ჯირკვალი",
  thymus: "მკერდუკანა ჯირკვალი (თიმუსი)",
  "adrenal gland": "თირკმელზედა ჯირკვალი",
  testis: "სათესლე ჯირკვალი",
  prostate: "წინამდებარე ჯირკვალი",
  duodenum: "თორმეტგოჯა ნაწლავი",
  jejunum: "მლივი ნაწლავი",
  ileum: "თეძოს ნაწლავი",
  colon: "კოლინჯი",
  cecum: "ბრმა ნაწლავი",
  "vermiform appendix": "ჭიანაწლავი",
  rectum: "სწორი ნაწლავი",
  diaphragm: "დიაფრაგმა",
  "main bronchus": "მთავარი ბრონქი",
  skin: "კანი",
  "hair of head": "თავის თმა",
  eyebrow: "წარბი",
  lip: "ტუჩი",
  "pubic hair": "ბოქვენის თმა",
  // Heart
  "cavity of right atrium": "მარჯვენა წინაგულის ღრუ",
  "cavity of left atrium": "მარცხენა წინაგულის ღრუ",
  "wall of right atrium": "მარჯვენა წინაგულის კედელი",
  "wall of left atrium": "მარცხენა წინაგულის კედელი",
  "cavity of right ventricle": "მარჯვენა პარკუჭის ღრუ",
  "cavity of left ventricle": "მარცხენა პარკუჭის ღრუ",
  "wall of ventricle": "პარკუჭის კედელი",
  "third ventricle": "ტვინის მესამე პარკუჭი",
  "fourth ventricle": "ტვინის მეოთხე პარკუჭი",
  "lateral ventricle": "ტვინის გვერდითი პარკუჭი",
  // Vessels
  aorta: "აორტა",
  "ascending aorta": "აღმავალი აორტა",
  "arch of aorta": "აორტის რკალი",
  "descending aorta": "დაღმავალი აორტა",
  "descending thoracic aorta": "გულმკერდის დაღმავალი აორტა",
  "abdominal aorta": "მუცლის აორტა",
  "superior vena cava": "ზედა ღრუ ვენა",
  "inferior vena cava": "ქვედა ღრუ ვენა",
  "pulmonary trunk": "ფილტვის ღერო",
  "common carotid artery": "საერთო საძილე არტერია",
  "internal carotid artery": "შიგნითა საძილე არტერია",
  "external carotid artery": "გარეთა საძილე არტერია",
  "internal jugular vein": "შიგნითა საუღლე ვენა",
  "external jugular vein": "გარეთა საუღლე ვენა",
  "subclavian artery": "ლავიწქვეშა არტერია",
  "subclavian vein": "ლავიწქვეშა ვენა",
  "femoral artery": "ბარძაყის არტერია",
  "femoral vein": "ბარძაყის ვენა",
  "brachial artery": "მხრის არტერია",
  "radial artery": "სხივის არტერია",
  "ulnar artery": "იდაყვის არტერია",
  "renal artery": "თირკმლის არტერია",
  "renal vein": "თირკმლის ვენა",
  "common iliac artery": "საერთო თეძოს არტერია",
  "internal iliac artery": "შიგნითა თეძოს არტერია",
  "external iliac artery": "გარეთა თეძოს არტერია",
  "popliteal artery": "მუხლქვეშა არტერია",
  "great saphenous vein": "დიდი კანქვეშა ვენა",
  "portal vein": "კარის ვენა",
  // Muscles
  "biceps brachii": "მხრის ორთავა კუნთი",
  "triceps brachii": "მხრის სამთავა კუნთი",
  deltoid: "დელტისებრი კუნთი",
  trapezius: "ტრაპეციული კუნთი",
  "latissimus dorsi": "ზურგის უგანიერესი კუნთი",
  "pectoralis major": "დიდი გულმკერდის კუნთი",
  "pectoralis minor": "მცირე გულმკერდის კუნთი",
  "rectus abdominis": "მუცლის სწორი კუნთი",
  "external oblique": "მუცლის გარეთა ირიბი კუნთი",
  "internal oblique": "მუცლის შიგნითა ირიბი კუნთი",
  "transversus abdominis": "მუცლის განივი კუნთი",
  "serratus anterior": "წინა დაკბილული კუნთი",
  "gluteus maximus": "დუნდულოს დიდი კუნთი",
  "gluteus medius": "დუნდულოს შუა კუნთი",
  "gluteus minimus": "დუნდულოს მცირე კუნთი",
  sartorius: "თერძის კუნთი",
  "rectus femoris": "ბარძაყის სწორი კუნთი",
  "vastus lateralis": "ბარძაყის გარეთა განიერი კუნთი",
  "vastus medialis": "ბარძაყის შიგნითა განიერი კუნთი",
  "biceps femoris": "ბარძაყის ორთავა კუნთი",
  gastrocnemius: "წვივის ტყუპი კუნთი",
  "tibialis anterior": "დიდი წვივის წინა კუნთი",
  "adductor longus": "გრძელი მომზიდველი კუნთი",
  "adductor magnus": "დიდი მომზიდველი კუნთი",
  brachialis: "მხრის კუნთი",
  masseter: "საღეჭი კუნთი",
  temporalis: "საფეთქლის კუნთი",
  "orbicularis oculi": "თვალის წრიული კუნთი",
  "orbicularis oris": "პირის წრიული კუნთი",
  // Nerves
  "sciatic nerve": "საჯდომი ნერვი",
  "femoral nerve": "ბარძაყის ნერვი",
  "median nerve": "შუა ნერვი",
  "ulnar nerve": "იდაყვის ნერვი",
  "radial nerve": "სხივის ნერვი",
  "vagus nerve": "ცდომილი ნერვი",
  "optic nerve": "მხედველობის ნერვი",
  "facial nerve": "სახის ნერვი",
};

const VALVE: Record<string, string> = {
  "mitral valve": "ორკარედი სარქველის",
  "tricuspid valve": "სამკარედი სარქველის",
  "aortic valve": "აორტის სარქველის",
  "pulmonary valve": "ფილტვის ღეროს სარქველის",
};
const LEAF_POS: Record<string, string> = {
  anterior: "წინა",
  posterior: "უკანა",
  septal: "ძგიდის",
  "left posterior": "მარცხენა უკანა",
  "right posterior": "მარჯვენა უკანა",
  "left anterior": "მარცხენა წინა",
  "right anterior": "მარჯვენა წინა",
};

/** Georgian category word used when a structure has no confident Georgian name. */
const CATEGORY: [RegExp, string][] = [
  [/artery|arterial|aorta/, "არტერია"],
  [/vein|venous|sinus/, "ვენა"],
  [/nerve|ganglion|plexus/, "ნერვი"],
  [/ligament/, "იოგი"],
  [/tendon|aponeurosis/, "მყესი"],
  [/cartilage/, "ხრტილი"],
  [/membrane|fascia/, "გარსი"],
  [/lymph/, "ლიმფური კვანძი"],
  [/bronch/, "ბრონქული ხე"],
  [/tooth/, "კბილი"],
  [/bone|vertebra|phalanx/, "ძვალი"],
  [/gland/, "ჯირკვალი"],
  [/muscle|muscul|constrictor|rectus|oblique|levator|depressor|flexor|extensor|adductor|abductor|tensor|sphincter|pharyngeus|glossus/, "კუნთი"],
];

const SYSTEM_FALLBACK: Record<SystemKey, string> = {
  skeletal: "ძვალი",
  muscular: "კუნთი",
  cardiac: "გულის ნაწილი",
  sensory: "გრძნობის ორგანოს ნაწილი",
  arterial: "არტერია",
  venous: "ვენა",
  nervous: "ნერვული ქსოვილი",
  respiratory: "სასუნთქი გზა",
  digestive: "საჭმლის მომნელებელი ორგანო",
  urinary: "შარდგამომყოფი ორგანო",
  lymphatic: "ლიმფური ორგანო",
  endocrine: "ენდოკრინული ჯირკვალი",
  reproductive: "რეპროდუქციული ორგანო",
  integumentary: "სხეულის ზედაპირი",
  connective: "შემაერთებელი ქსოვილი",
};

// ---- Descriptive composition (position + region + action + category) ----------------------------

const POSITION: Record<string, string> = {
  anterior: "წინა",
  posterior: "უკანა",
  superior: "ზედა",
  inferior: "ქვედა",
  medial: "შიგნითა",
  lateral: "გარეთა",
  middle: "შუა",
  deep: "ღრმა",
  superficial: "ზედაპირული",
  superficialis: "ზედაპირული",
  profundus: "ღრმა",
  common: "საერთო",
  internal: "შიგნითა",
  internus: "შიგნითა",
  external: "გარეთა",
  externus: "გარეთა",
  great: "დიდი",
  small: "მცირე",
  major: "დიდი",
  minor: "მცირე",
  magnus: "დიდი",
  longus: "გრძელი",
  brevis: "მოკლე",
  long: "გრძელი",
  short: "მოკლე",
  apical: "მწვერვალის",
  basal: "ბაზალური",
  distal: "დისტალური",
  proximal: "პროქსიმალური",
  ascending: "აღმავალი",
  descending: "დაღმავალი",
  transverse: "განივი",
  transversus: "განივი",
  oblique: "ირიბი",
  obliquus: "ირიბი",
  rectus: "სწორი",
  perforating: "გამჭოლი",
  accessory: "დამატებითი",
  circumflex: "მომვლები",
  diagonal: "დიაგონალური",
  marginal: "კიდის",
  segmental: "სეგმენტური",
  lingular: "ენისებრი",
  teres: "მრგვალი",
  quadratus: "კვადრატული",
};

/** Region adjectives/Latin genitives → Georgian genitive. */
const REGION: Record<string, string> = {
  cerebellar: "ნათხემის",
  cerebral: "ტვინის",
  coronary: "კორონარული",
  cardiac: "გულის",
  phrenic: "დიაფრაგმის",
  renal: "თირკმლის",
  suprarenal: "თირკმელზედა ჯირკვლის",
  gastric: "კუჭის",
  hepatic: "ღვიძლის",
  splenic: "ელენთის",
  pancreatic: "კუჭქვეშა ჯირკვლის",
  pulmonary: "ფილტვის",
  bronchial: "ბრონქული",
  esophageal: "საყლაპავის",
  facial: "სახის",
  lingual: "ენის",
  labial: "ტუჩის",
  nasal: "ცხვირის",
  thyroid: "ფარისებრი ჯირკვლის",
  iliac: "თეძოს",
  femoral: "ბარძაყის",
  tibial: "წვივის",
  fibular: "მცირე წვივის",
  brachial: "მხრის",
  radial: "სხივის",
  ulnar: "იდაყვის",
  digital: "თითის",
  palmar: "ხელისგულის",
  plantar: "ტერფისგულის",
  dorsal: "ზურგის",
  intercostal: "ნეკნთაშუა",
  lumbar: "წელის",
  sacral: "გავის",
  cervical: "კისრის",
  thoracic: "გულმკერდის",
  vertebral: "ხერხემლის",
  spinal: "ზურგის ტვინის",
  ophthalmic: "თვალის",
  temporal: "საფეთქლის",
  occipital: "კეფის",
  mesenteric: "ჯორჯლის",
  gluteal: "დუნდულოს",
  popliteal: "მუხლქვეშა",
  axillary: "იღლიის",
  subclavian: "ლავიწქვეშა",
  jugular: "საუღლე",
  carotid: "საძილე",
  saphenous: "კანქვეშა",
  genicular: "მუხლის",
  metacarpal: "ნების",
  metatarsal: "წინატერფის",
  testicular: "სათესლე ჯირკვლის",
  colic: "კოლინჯის",
  rectal: "სწორი ნაწლავის",
  vesical: "შარდის ბუშტის",
  interventricular: "პარკუჭთაშუა",
  ventricular: "პარკუჭის",
  atrial: "წინაგულის",
  digitorum: "თითების",
  pollicis: "ცერის",
  hallucis: "ფეხის ცერის",
  carpi: "მაჯის",
  brachii: "მხრის",
  femoris: "ბარძაყის",
  capitis: "თავის",
  colli: "კისრის",
  oris: "პირის",
  oculi: "თვალის",
  abdominis: "მუცლის",
  dorsi: "ზურგის",
  radialis: "სხივის",
  ulnaris: "იდაყვის",
  ileum: "თეძოს ნაწლავის",
  jejunum: "მლივი ნაწლავის",
  colon: "კოლინჯის",
  ventricle: "პარკუჭის",
};

const ACTION: Record<string, string> = {
  flexor: "მომხრელი",
  extensor: "გამშლელი",
  adductor: "მომზიდველი",
  abductor: "განმზიდველი",
  levator: "ამწევი",
  depressor: "დამწევი",
  constrictor: "შემკუმშველი",
  rotator: "მბრუნავი",
  tensor: "დამჭიმი",
  sphincter: "სფინქტერი",
};

const GENITIVE: Record<string, string> = { არტერია: "არტერიის", ვენა: "ვენის", ნერვი: "ნერვის", კუნთი: "კუნთის" };

function compose(n: string, side: string, category: string): GeorgianName | null {
  const words = n.split(/[^a-z]+/).filter(Boolean);
  const pos: string[] = [];
  const reg: string[] = [];
  const act: string[] = [];
  const push = (arr: string[], w?: string) => w && !arr.includes(w) && arr.push(w);
  let innerSide = "";
  for (const w of words) {
    if (w === "left") innerSide = "მარცხენა ";
    else if (w === "right") innerSide = "მარჯვენა ";
    push(pos, POSITION[w]);
    push(reg, REGION[w]);
    push(act, ACTION[w]);
  }
  if (!reg.length && !act.length) return null;
  const partOf = /^(distal|middle|proximal) part of /.test(n);
  const branch = /\bbranch|division\b/.test(n);
  let tail = category;
  if (partOf) tail = "ნაწილი";
  else if (branch) tail = `${GENITIVE[category] ?? category} ტოტი`;
  const s = side || innerSide;
  // "distal part of ileum" reads organ-first in Georgian: "თეძოს ნაწლავის დისტალური ნაწილი".
  const order = partOf ? [...reg, ...pos, ...act, tail] : [...pos, ...reg, ...act, tail];
  return { name: `${s}${order.join(" ")}`.replace(/\s+/g, " ").trim(), exact: true };
}

function toothName(n: string): string | null {
  const m = n.match(/^(upper|lower) (central |lateral |first |second )?(secondary )?(incisor|canine|premolar|molar) tooth$/);
  if (!m) return null;
  const jaw = m[1] === "upper" ? "ზედა" : "ქვედა";
  const pos = { "central ": "ცენტრალური ", "lateral ": "გვერდითი ", "first ": "პირველი ", "second ": "მეორე " }[m[2] ?? ""] ?? "";
  const type = { incisor: "საჭრელი", canine: "ეშვი", premolar: "წინა ძირითადი", molar: "ძირითადი" }[m[4]];
  return `${jaw} ${pos}${type} კბილი`.replace(/ეშვი კბილი$/, "ეშვი");
}

export interface GeorgianName {
  name: string;
  /** false when only a category word could be produced */
  exact: boolean;
}

export function georgianName(english: string, system: SystemKey): GeorgianName {
  let n = english.toLowerCase().trim();
  let side = "";
  const leading = n.match(/^(left|right) /);
  if (leading) {
    side = leading[1] === "left" ? "მარცხენა " : "მარჯვენა ";
    n = n.slice(leading[0].length);
  }

  // Finger and toe bones: "distal phalanx of left index finger".
  const phal = n.match(/^(distal|middle|proximal) phalanx of (left|right) (.+)$/);
  if (phal && FINGER[phal[3]]) {
    const s = phal[2] === "left" ? "მარცხენა" : "მარჯვენა";
    const limb = /toe/.test(phal[3]) ? "ფეხის" : "ხელის";
    return { name: `${s} ${limb} ${FINGER[phal[3]]} ${PHALANX[phal[1]]}`, exact: true };
  }
  const vert = n.match(/^(\w+) (cervical|thoracic|lumbar) vertebra$/);
  if (vert && ORDINAL[vert[1]]) return { name: `${ORDINAL[vert[1]]} ${VERTEBRA_REGION[vert[2]]} მალა`, exact: true };
  const disk = n.match(/^intervertebral disk of (\w+) (cervical|thoracic|lumbar) vertebra$/);
  if (disk && ORDINAL[disk[1]])
    return { name: `${ORDINAL[disk[1]]} ${VERTEBRA_REGION[disk[2]]} მალის მალთაშუა დისკო`, exact: true };
  const rib = n.match(/^(\w+) rib$/);
  if (rib && ORDINAL[rib[1]]) return { name: `${side}${ORDINAL[rib[1]]} ნეკნი`, exact: true };
  const costal = n.match(/^(\w+) costal cartilage$/);
  if (costal && ORDINAL[costal[1]]) return { name: `${side}${ORDINAL[costal[1]]} ნეკნის ხრტილი`, exact: true };
  const meta = n.match(/^(\w+) (metacarpal|metatarsal) bone$/);
  if (meta && ORDINAL[meta[1]])
    return { name: `${side}${ORDINAL[meta[1]]} ${meta[2] === "metacarpal" ? "ნების" : "წინატერფის"} ძვალი`, exact: true };
  const tooth = toothName(n);
  if (tooth) return { name: tooth, exact: true };
  const valve = n.match(/^(.+?) (leaflet|cusp) of (mitral|tricuspid|aortic|pulmonary) valve$/);
  if (valve) {
    const pos = LEAF_POS[valve[1]] ?? "";
    return { name: `${VALVE[`${valve[3]} valve`]} ${pos ? `${pos} ` : ""}კარი`, exact: true };
  }

  const direct = DICT[n] ?? DICT[n.replace(/ of (left|right) (foot|hand)$/, " of $2")];
  if (direct) return { name: `${side}${direct}`, exact: true };

  const bronchi = n.match(/^(.*)segmental bronchial tree$/);
  if (bronchi) {
    const pos = bronchi[1].split(/\s+/).filter(Boolean).map((w) => POSITION[w]).filter(Boolean).join(" ");
    return { name: `${side}${pos ? `${pos} ` : ""}სეგმენტური ბრონქული ხე`, exact: true };
  }
  if (/lingular bronchial tree$/.test(n)) {
    return { name: `${side}${n.startsWith("superior") ? "ზედა" : "ქვედა"} ენისებრი ბრონქული ხე`, exact: true };
  }
  if (n === "digastric") return { name: `${side}ორმუცელა კუნთი`, exact: true };
  if (n === "platysma") return { name: `${side}კანქვეშა კუნთი`, exact: true };

  let category = SYSTEM_FALLBACK[system];
  let matched = false;
  for (const [re, word] of CATEGORY)
    if (re.test(n)) {
      category = word;
      matched = true;
      break;
    }
  if (!matched && system === "muscular") category = "კუნთი";
  const composed = compose(n, side, category);
  if (composed) return composed;
  return { name: `${side}${category}`, exact: false };
}

/** All Georgian search terms (term → English atlas words) derived from the dictionary. */
export function dictionaryEntries(): [string, string][] {
  return Object.entries(DICT).map(([en, ka]) => [ka, en]);
}
