import type { HeroSource } from "./HeroScene";

/*
 * The geography 3D models (scripts/build-geo-heroes.py) and their Georgian texts. `fallback` stands in for the
 * model when it cannot be shown (no WebGL, the file did not load).
 */

export type HeroId = "kazbegi" | "javakheti" | "mudflow" | "avalanche";

export interface Hero extends HeroSource {
  name: string;
  caption: string;
  fallback: string;
  /** Small print under the model: what is real and what is made up, the data source. */
  note: string;
}

const DIR = "/models/geography/";
/** The attribution Copernicus DEM asks for, word for word. */
const COPERNICUS = "© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.";

export const HEROES: Record<HeroId, Hero> = {
  kazbegi: {
    src: `${DIR}volcanoes/kazbegi-relief.glb`,
    lod1: `${DIR}volcanoes/kazbegi-relief-lod1.glb`,
    sky: "#bcdcf0",
    name: "მყინვარწვერი (ყაზბეგი)",
    caption:
      "მყინვარწვერი (5047 მ) „მძინარე“ სტრატოვულკანია; ბოლოს დაახლოებით 3 ათასი წლის წინ ამოიფრქვა. მის კალთებს მყინვარები ფარავს, მაგალითად, გერგეტის მყინვარი. აღმოსავლეთით, ძირში, თერგის ხეობა და სტეფანწმინდაა.",
    fallback:
      "მყინვარწვერი თერგის ხეობიდან სამ კილომეტრზე მეტით მაღლა ამოდის. მისი კონუსი ვულკანური ლავისა და ფერფლის ფენებითაა აგებული, მწვერვალი კი მთელი წელი თოვლითა და მყინვარებითაა დაფარული.",
    note: `ნამდვილი რელიეფი; სიმაღლეები 1,5-ჯერაა გაზრდილი, რომ მთები უკეთ ჩანდეს. რელიეფი: Copernicus DEM GLO-30 ${COPERNICUS}`,
  },
  javakheti: {
    src: `${DIR}volcanoes/javakheti-relief.glb`,
    lod1: `${DIR}volcanoes/javakheti-relief-lod1.glb`,
    sky: "#bcdcf0",
    name: "ჯავახეთის ვულკანური ზეგანი",
    caption:
      "ჯავახეთის ზეგანი ლავის ნაკადებითაა აგებული. სამსარის ქედზე ჩამქრალი ვულკანები დგას: სამხრეთით აბული (3301 მ), ჩრდილოეთით სამსარი (3285 მ) თავისი კრატერით. აღმოსავლეთით ფარავნის ტბაა — საქართველოს უდიდესი ტბა.",
    fallback:
      "ჯავახეთი ზღვის დონიდან დაახლოებით 2000 მეტრზე მდებარე ვაკე ზეგანია, რომელიც ძველი ვულკანების ლავამ ამოავსო. მასზე ჯაჭვად ამოზიდულია ჩამქრალი ვულკანური მთები, აბული და სამსარი, ვაკეზე კი დიდი ტბები, მათ შორის ფარავანი, მდებარეობს.",
    note: `ნამდვილი რელიეფი; სიმაღლეები 2-ჯერაა გაზრდილი, რომ ვულკანები კარგად გამოჩნდეს. რელიეფი: Copernicus DEM GLO-90 ${COPERNICUS}`,
  },
  mudflow: {
    src: `${DIR}hazards/mudflow.glb`,
    lod1: `${DIR}hazards/mudflow-lod1.glb`,
    sky: "#c3d6e4",
    name: "ღვარცოფი",
    caption:
      "ძლიერი წვიმის ან თოვლის სწრაფი დნობის დროს ხევის ზედა, წყალშემკრებ ქვაბულში ტალახი და ქვა იძვრება. ნაკადი ვიწრო ხეობაში ჩქარდება, ლოდებს მიათრევს და ხეობის ფსკერზე გამოტანის კონუსად იშლება — აქ გზა, სახლები და მდინარის კალაპოტიც კი შეიძლება დაიფაროს.",
    fallback:
      "წარმოიდგინე მთის ხევი: ზემოთ, ქვაბულში, წვიმის წყალი ტალახს და ქვას აგროვებს; ვიწრო ხეობაში ტალახისა და ლოდების ნაკადი დიდი სიჩქარით ეშვება, ძირში კი ვრცელ კონუსად იშლება და გზას, სახლებსა და მდინარეს ფარავს.",
    note: "სქემატური მოდელი: ღვარცოფის ტიპური ფორმა და არა კონკრეტული ადგილი.",
  },
  avalanche: {
    src: `${DIR}hazards/avalanche.glb`,
    lod1: `${DIR}hazards/avalanche-lod1.glb`,
    sky: "#cad9e6",
    name: "ზვავი",
    caption:
      "მოდელზე ზვავის სამივე ზონა ჩანს. ზვავწარმოქმნის ზონაში, მწვერვალის ქვეშ ციცაბო ფერდზე, თოვლის ფენა ჩამოწყვეტის ხაზზე გასკდა. ტრანზიტის ზონაში, ტყეში გაკაფულ ღარში, თოვლი ეშვება და თოვლის მტვრის ღრუბელს აყენებს. დაგროვების ზონაში, ფერდის ძირში, თოვლის ბელტები და გადატეხილი ხეები გროვდება.",
    fallback:
      "ზვავი სამ ზონას გადის: ზვავწარმოქმნის ზონას ციცაბო ფერდზე, სადაც თოვლის ფენა წყდება; ტრანზიტის ღარს, სადაც ხშირი ზვავების გამო ტყეც კი ვერ იზრდება; და დაგროვების ზონას ფერდის ძირში, სადაც თოვლის მკვრივი, ბელტებიანი გროვა რჩება.",
    note: "სქემატური მოდელი: ზვავის ტიპური გზა და არა კონკრეტული ადგილი.",
  },
};
