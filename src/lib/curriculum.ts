/**
 * Biology lessons of the school textbooks, grades VIII–XII (from docs/curriculum/biology-grade-*.md), each
 * linked to the place on the portal that teaches it. Lessons without a link are still being prepared.
 */

export interface Lesson {
  /** Number in the textbook (empty where the book doesn't number them). */
  n: string;
  title: string;
  page: string;
  href: string | null;
}
export interface Chapter {
  title: string;
  lessons: Lesson[];
}
export interface Grade {
  grade: number;
  roman: string;
  chapters: Chapter[];
}

export const BIOLOGY_GRADES: Grade[] = [
  {
    grade: 8,
    roman: "VIII",
    chapters: [
      {
        title: "თემა 1. სიცოცხლის ორგანიზაციის დონეები",
        lessons: [
          {
            n: "1.1",
            title: "უჯრედული თეორია",
            page: "10",
            href: "/biology/cell?s=cells",
          },
          {
            n: "1.2",
            title: "ცხოველური ქსოვილები",
            page: "12",
            href: null,
          },
          {
            n: "1.3",
            title: "მცენარეული ქსოვილები",
            page: "16",
            href: null,
          },
          {
            n: "1.4",
            title: "სიცოცხლის ორგანიზაციის დონეები",
            page: "19",
            href: null,
          },
        ],
      },
      {
        title: "თემა 2. საყრდენ-მამოძრავებელი სისტემა",
        lessons: [
          {
            n: "2.1",
            title: "საყრდენ-მამოძრავებელი სისტემის ფუნქციები",
            page: "28",
            href: "/topic/skeleton",
          },
          {
            n: "2.2",
            title: "ადამიანის ჩონჩხის აგებულება",
            page: "30",
            href: "/topic/skeleton",
          },
          {
            n: "2.3",
            title: "ძვლების აგებულება და ზრდა",
            page: "34",
            href: "/biology/journeys?j=bone",
          },
          {
            n: "2.4",
            title: "ძვლის ქიმიური შედგენილობა",
            page: "37",
            href: null,
          },
          {
            n: "2.5",
            title: "ძვალთა შეერთების ფორმები",
            page: "39",
            href: null,
          },
          {
            n: "2.6",
            title: "ჩონჩხის დაზიანების სახეები",
            page: "42",
            href: null,
          },
          {
            n: "2.7",
            title: "ჩონჩხის კუნთები",
            page: "45",
            href: "/topic/muscles",
          },
          {
            n: "2.8",
            title: "ჩონჩხის კუნთების მოქმედების მექანიზმი",
            page: "48",
            href: "/biology/journeys?j=muscle",
          },
          {
            n: "2.9",
            title: "ტანადობის დარღვევა",
            page: "52",
            href: null,
          },
        ],
      },
      {
        title: "თემა 3-1. სისხლის მიმოქცევის სისტემა",
        lessons: [
          {
            n: "3.1",
            title: "ორგანიზმის შინაგანი გარემო",
            page: "63",
            href: "/biology/blood?s=overview",
          },
          {
            n: "3.2",
            title: "სისხლის კომპონენტები და ფუნქციები",
            page: "66",
            href: "/biology/blood?s=rbc",
          },
          {
            n: "3.3",
            title: "შინაგანი გარემოს დამცველობითი ფუნქცია",
            page: "71",
            href: "/biology/blood?s=immunity",
          },
          {
            n: "3.4",
            title: "სისხლის ჯგუფები",
            page: "74",
            href: "/biology/blood?s=groups",
          },
          {
            n: "3.5",
            title: "გული",
            page: "77",
            href: "/biology/heart?s=structure",
          },
          {
            n: "3.6",
            title: "გულის მუშაობა",
            page: "80",
            href: "/biology/heart?s=cycle",
          },
          {
            n: "3.7",
            title: "სისხლძარღვები",
            page: "83",
            href: "/biology/heart?s=vessels",
          },
          {
            n: "3.8",
            title: "სისხლის მოძრაობა ორგანიზმში",
            page: "87",
            href: "/biology/heart?s=circulation",
          },
          {
            n: "3.9",
            title: "გულ-სისხლძარღვთა დაავადებები",
            page: "89",
            href: "/biology/heart?s=diseases",
          },
        ],
      },
      {
        title: "თემა 3-2. სასუნთქი სისტემა",
        lessons: [
          {
            n: "3.10",
            title: "სუნთქვა, მისი მნიშვნელობა",
            page: "102",
            href: "/topic/lungs",
          },
          {
            n: "3.11",
            title: "სუნთქვითი მოძრაობები",
            page: "105",
            href: "/topic/lungs",
          },
          {
            n: "3.12",
            title: "სუნთქვითი მოძრაობების რეგულაცია",
            page: "108",
            href: null,
          },
          {
            n: "3.13",
            title: "სასუნთქი ორგანოების დაავადებები",
            page: "112",
            href: null,
          },
        ],
      },
      {
        title: "თემა 3-3. საჭმლის მომნელებელი სისტემა",
        lessons: [
          {
            n: "3.14",
            title: "საკვები ნივთიერებები და საკვები პროდუქტები",
            page: "120",
            href: null,
          },
          {
            n: "3.15",
            title: "საკვები პროდუქტების კვებითი ღირებულება",
            page: "123",
            href: null,
          },
          {
            n: "3.16",
            title: "საჭმლის მომნელებელი სისტემის სტრუქტურა და ფუნქციები",
            page: "127",
            href: "/topic/digestion",
          },
          {
            n: "3.17",
            title: "საჭმლის მონელება პირის ღრუში",
            page: "130",
            href: "/topic/digestion",
          },
          {
            n: "3.18",
            title: "საჭმლის მონელება კუჭში",
            page: "134",
            href: "/topic/stomach",
          },
          {
            n: "3.19",
            title: "საჭმლის მონელება ნაწლავში",
            page: "136",
            href: "/topic/digestion",
          },
          {
            n: "3.20",
            title: "კუჭ-ნაწლავის დაავადებები და მათი თავიდან აცილება",
            page: "139",
            href: null,
          },
        ],
      },
      {
        title: "თემა 3-4. გამოყოფა",
        lessons: [
          {
            n: "3.21",
            title: "ნივთიერებათა ცვლა ორგანიზმსა და გარემოს შორის",
            page: "150",
            href: null,
          },
          {
            n: "3.22",
            title: "თირკმლები, როგორც გამომყოფი ორგანო",
            page: "153",
            href: "/topic/kidneys",
          },
          {
            n: "3.23",
            title: "წყლის ბალანსის რეგულაცია",
            page: "156",
            href: null,
          },
          {
            n: "3.24",
            title: "კანი, როგორც გამომყოფი ორგანო",
            page: "158",
            href: null,
          },
        ],
      },
      {
        title: "თემა 4. ჯანმრთელობა და მავნე ჩვევები",
        lessons: [
          {
            n: "4.1",
            title: "თამბაქოს მოხმარების გავლენა ჯანმრთელობაზე",
            page: "168",
            href: null,
          },
          {
            n: "4.2",
            title: "ალკოჰოლის მოხმარების გავლენა ჯანმრთელობაზე",
            page: "172",
            href: null,
          },
          {
            n: "4.3",
            title: "ჯანსაღი კვება და კვებითი დარღვევები",
            page: "174",
            href: null,
          },
          {
            n: "4.4",
            title: "ფიზიკური აქტივობის გავლენა ჯანმრთელობაზე",
            page: "178",
            href: null,
          },
        ],
      },
    ],
  },
  {
    grade: 9,
    roman: "IX",
    chapters: [
      {
        title: "თემა 1. ადამიანის მარეგულირებელი სისტემები",
        lessons: [
          {
            n: "1.1",
            title: "რეგულაციის მექანიზმები. ნერვული სისტემა",
            page: "12",
            href: "/topic/brain",
          },
          {
            n: "1.2",
            title: "ნეირონები და ნერვები",
            page: "14",
            href: null,
          },
          {
            n: "1.3",
            title: "ნერვული სისტემის მოქმედების მექანიზმი",
            page: "17",
            href: null,
          },
          {
            n: "1.4",
            title: "ზურგის ტვინის სტრუქტურა და ფუნქციები",
            page: "20",
            href: "/topic/spine",
          },
          {
            n: "1.5",
            title: "თავის ტვინის სტრუქტურა და ფუნქციები",
            page: "23",
            href: "/topic/brain",
          },
          {
            n: "1.6",
            title: "თავის ტვინის ჰემისფეროები",
            page: "27",
            href: "/topic/brain",
          },
          {
            n: "1.7",
            title: "პერიფერიული ნერვული სისტემა",
            page: "31",
            href: null,
          },
          {
            n: "1.8",
            title: "უპირობო და პირობითი რეფლექსები",
            page: "34",
            href: null,
          },
          {
            n: "1.9",
            title: "ფსიქოაქტიური ნივთიერებები და ადამიანის ჯანმრთელობა",
            page: "38",
            href: null,
          },
          {
            n: "1.10",
            title: "ენდოკრინული სისტემა და მისი მოქმედების მექანიზმი",
            page: "43",
            href: null,
          },
          {
            n: "1.11",
            title: "ჰიპოფიზის ჰორმონები და მათი ფუნქციები",
            page: "47",
            href: null,
          },
          {
            n: "1.12",
            title: "ფარისებრი ჯირკვლის ფუნქციები",
            page: "51",
            href: null,
          },
          {
            n: "1.13",
            title: "სისხლში გლუკოზის დონის რეგულაცია",
            page: "54",
            href: null,
          },
        ],
      },
      {
        title: "თემა 2. შეგრძნების ორგანოები",
        lessons: [
          {
            n: "2.1",
            title: "შეგრძნების ორგანოები და მათი მნიშვნელობა",
            page: "66",
            href: null,
          },
          {
            n: "2.2",
            title: "მხედველობის ორგანოს აგებულება და მნიშვნელობა",
            page: "68",
            href: "/topic/eye",
          },
          {
            n: "2.3",
            title: "მხედველობის დარღვევა",
            page: "72",
            href: null,
          },
          {
            n: "2.4",
            title: "მხედველობის დაქვეითების მიზეზები და მკურნალობის მეთოდები",
            page: "76",
            href: null,
          },
          {
            n: "2.5",
            title: "სმენის ორგანოს აგებულება და ფუნქციები",
            page: "79",
            href: null,
          },
          {
            n: "2.6",
            title: "სმენის დარღვევა",
            page: "82",
            href: null,
          },
        ],
      },
      {
        title: "თემა 3. რეპროდუქციული სისტემა და ჯანმრთელობა",
        lessons: [
          {
            n: "3.1",
            title: "გამრავლება ადამიანში. სქესობრივი მომწიფების პერიოდი",
            page: "91",
            href: null,
          },
          {
            n: "3.2",
            title: "ადამიანის რეპროდუქციული სისტემა",
            page: "93",
            href: null,
          },
          {
            n: "3.3",
            title: "მენსტრუალური ციკლი",
            page: "96",
            href: null,
          },
          {
            n: "3.4",
            title: "განაყოფიერება",
            page: "99",
            href: "/biology/cell?s=meiosis",
          },
          {
            n: "3.5",
            title: "ბავშვის განვითარება და დაბადება",
            page: "103",
            href: null,
          },
          {
            n: "3.6",
            title: "ნაყოფის განვითარებაზე მოქმედი ფაქტორები",
            page: "106",
            href: null,
          },
          {
            n: "3.7",
            title: "სქესობრივი გზით გადამდები ინფექციური დაავადებები",
            page: "109",
            href: null,
          },
          {
            n: "3.8",
            title: "ნაადრევი სქესობრივი კავშირი და მისი შედეგები",
            page: "114",
            href: null,
          },
        ],
      },
    ],
  },
  {
    grade: 10,
    roman: "X",
    chapters: [
      {
        title: "თავი I. უჯრედის ქიმიური შედგენილობა",
        lessons: [
          {
            n: "1.1.1",
            title: "უჯრედის ქიმიური შედგენილობა. წყალი და მისი მნიშვნელობა",
            page: "10",
            href: null,
          },
          {
            n: "1.1.2",
            title: "ცხოველურ ორგანიზმებში შემავალი მინერალური მარილები",
            page: "21",
            href: null,
          },
          {
            n: "1.1.3",
            title: "ბუფერული სისტემები",
            page: "27",
            href: null,
          },
          {
            n: "1.1.4",
            title: "მცენარისთვის აუცილებელი მინერალები",
            page: "31",
            href: null,
          },
          {
            n: "1.1.5",
            title: "ორგანული ნივთიერებები — ცილები",
            page: "37",
            href: null,
          },
          {
            n: "1.1.6",
            title: "ცილების ფუნქციები",
            page: "44",
            href: null,
          },
          {
            n: "1.1.7",
            title: "ნახშირწყლები",
            page: "49",
            href: null,
          },
          {
            n: "1.1.8",
            title: "ლიპიდები",
            page: "54",
            href: "/biology/cell?s=membrane",
          },
          {
            n: "1.1.9",
            title: "ნუკლეინის მჟავები",
            page: "61",
            href: "/biology/dna?s=helix",
          },
          {
            n: "1.1.10",
            title: "ატფ-ის აგებულება და ფუნქცია",
            page: "67",
            href: null,
          },
        ],
      },
      {
        title: "თავი II. უჯრედის სტრუქტურები",
        lessons: [
          {
            n: "1.2.1",
            title:
              "უჯრედი: აღმოჩენის ისტორია, უჯრედული თეორია, კვლევის მეთოდები",
            page: "74",
            href: "/biology/cell?s=cells",
          },
          {
            n: "1.2.2",
            title: "უჯრედის აგებულება",
            page: "85",
            href: "/biology/cell?s=animal",
          },
          {
            n: "1.2.3",
            title: "მცენარეული და ცხოველური ქსოვილები",
            page: "90",
            href: null,
          },
          {
            n: "1.2.4",
            title: "პლაზმური მემბრანა",
            page: "99",
            href: "/biology/cell?s=membrane",
          },
          {
            n: "1.2.5",
            title: "ბირთვი",
            page: "108",
            href: "/biology/cell?s=nucleus",
          },
          {
            n: "1.2.6",
            title: "რიბოსომა, ენდოპლაზმური ბადე",
            page: "112",
            href: "/biology/cell?s=animal",
          },
          {
            n: "1.2.7",
            title: "გოლჯის კომპლექსი, ლიზოსომები",
            page: "116",
            href: "/biology/cell?s=animal",
          },
          {
            n: "1.2.8",
            title: "ციტოპლაზმა, ვაკუოლი, უჯრედის ცენტრი",
            page: "119",
            href: "/biology/cell?s=plant",
          },
          {
            n: "1.2.9",
            title: "მიტოქონდრია, პლასტიდები",
            page: "124",
            href: "/biology/cell?s=energy",
          },
          {
            n: "1.2.10",
            title: "უჯრედზე ალკოჰოლისა და ნიკოტინის მოქმედება",
            page: "130",
            href: null,
          },
        ],
      },
      {
        title: "თავი III. უჯრედის მეტაბოლიზმი",
        lessons: [
          {
            n: "1.3.1",
            title: "ენერგეტიკული ცვლა. უჯრედის სუნთქვა",
            page: "138",
            href: "/biology/cell?s=energy",
          },
          {
            n: "1.3.2",
            title: "პლასტიკური ცვლა. ფოტოსინთეზი",
            page: "143",
            href: "/biology/cell?s=energy",
          },
          {
            n: "1.3.3",
            title: "(სქრინშოტზე მოჭრილია, გვ. 151)",
            page: "151",
            href: null,
          },
        ],
      },
      {
        title: "ნაწილი 2 — უჯრედის გამრავლება",
        lessons: [
          {
            n: "§1",
            title: "დნმ-ის რეპლიკაცია",
            page: "10",
            href: "/biology/dna?s=replication",
          },
          {
            n: "§2",
            title: "გენეტიკური კოდი",
            page: "16",
            href: "/biology/dna?s=translation",
          },
          {
            n: "§3",
            title: "მემკვიდრული ინფორმაციის რეალიზება უჯრედებში — ტრანსკრიფცია",
            page: "22",
            href: "/biology/dna?s=transcription",
          },
          {
            n: "§4",
            title: "მემკვიდრული ინფორმაციის რეალიზება უჯრედებში — ტრანსლაცია",
            page: "25",
            href: "/biology/dna?s=translation",
          },
          {
            n: "§5",
            title:
              "მემკვიდრული ინფორმაციის ორგანიზება პროკარიოტებსა და ეუკარიოტებში",
            page: "29",
            href: "/biology/dna?s=chromosome",
          },
          {
            n: "§6",
            title: "უჯრედული ციკლი. უჯრედის გამრავლება — მიტოზი",
            page: "34",
            href: "/biology/cell?s=mitosis",
          },
          {
            n: "§7",
            title:
              "მემკვიდრული ინფორმაციის გადაცემის გზები პროკარიოტებში — ტრანსდუქცია, ტრანსფორმაცია, კონიუგაცია",
            page: "40",
            href: null,
          },
          {
            n: "§8",
            title: "ორგანიზმთა სქესობრივი გამრავლება. გამეტოგენეზი",
            page: "52",
            href: null,
          },
          {
            n: "§9",
            title: "მეიოზი. განაყოფიერება",
            page: "57",
            href: "/biology/cell?s=meiosis",
          },
          {
            n: "§10",
            title:
              "ორგანიზმთა ინდივიდუალური განვითარება — ონტოგენეზი. უჯრედთა დიფერენცირება",
            page: "64",
            href: null,
          },
          {
            n: "§11",
            title: "ღეროვანი უჯრედები და მათი პრაქტიკული გამოყენება",
            page: "72",
            href: "/biology/blood?s=overview",
          },
        ],
      },
    ],
  },
  {
    grade: 11,
    roman: "XI",
    chapters: [
      {
        title: "თემა 1. გენეტიკა",
        lessons: [
          {
            n: "1.1",
            title: "მენდელის კვლევის მეთოდები",
            page: "10",
            href: null,
          },
          {
            n: "1.2",
            title: "მონოჰიბრიდული შეჯვარება",
            page: "14",
            href: null,
          },
          {
            n: "1.3",
            title:
              "მენდელის კანონების სტატისტიკური ხასიათი. ალბათობა გენეტიკაში",
            page: "20",
            href: null,
          },
          {
            n: "1.4",
            title: "დათიშვის კანონის ციტოგენეტიკური მექანიზმი",
            page: "25",
            href: "/biology/cell?s=meiosis",
          },
          {
            n: "1.5",
            title: "ალელურ გენთა ურთიერთქმედება",
            page: "31",
            href: "/biology/blood?s=groups",
          },
          {
            n: "1.6",
            title: "დიჰიბრიდული შეჯვარება",
            page: "36",
            href: null,
          },
          {
            n: "1.7",
            title: "გამაანალიზებელი შეჯვარება",
            page: "44",
            href: null,
          },
          {
            n: "1.8",
            title: "გენთა შეჭიდული მემკვიდრეობა",
            page: "48",
            href: "/biology/cell?s=meiosis",
          },
          {
            n: "1.9",
            title: "სქესის განსაზღვრის ქრომოსომული მექანიზმი",
            page: "55",
            href: null,
          },
          {
            n: "1.10",
            title: "სქესთან შეჭიდული მემკვიდრეობა",
            page: "59",
            href: null,
          },
          {
            n: "1.11",
            title: "გენების მრავლობითი მოქმედება და ურთიერთქმედება",
            page: "64",
            href: null,
          },
          {
            n: "1.12",
            title: "ცვალებადობა. მოდიფიკაციური ცვალებადობა",
            page: "74",
            href: null,
          },
          {
            n: "1.13",
            title: "მემკვიდრული ცვალებადობა",
            page: "79",
            href: "/biology/dna?s=mutation",
          },
          {
            n: "1.14",
            title: "ქრომოსომული და გენომური მუტაციები",
            page: "86",
            href: "/biology/dna?s=mutation",
          },
          {
            n: "1.15",
            title: "ბიოტექნოლოგია და მისი ძირითადი მიმართულებები",
            page: "94",
            href: null,
          },
          {
            n: "1.16",
            title: "გენური ინჟინერია. ტრანსგენური ორგანიზმები",
            page: "99",
            href: null,
          },
          {
            n: "1.17",
            title: "კლონირება",
            page: "105",
            href: null,
          },
          {
            n: "1.18",
            title: "ადამიანის გენეტიკის კვლევის მეთოდები",
            page: "109",
            href: null,
          },
          {
            n: "1.19",
            title: "სამედიცინო ბიოტექნოლოგია",
            page: "119",
            href: null,
          },
        ],
      },
      {
        title: "თემა 2. ევოლუცია",
        lessons: [
          {
            n: "2.1",
            title: "ორგანული სამყაროს კლასიფიკაცია",
            page: "138",
            href: null,
          },
          {
            n: "2.2",
            title: "პირველი ევოლუციური იდეები",
            page: "143",
            href: null,
          },
          {
            n: "2.3",
            title: "მიკროევოლუცია და მისი მამოძრავებელი ფაქტორები",
            page: "149",
            href: null,
          },
          {
            n: "2.4",
            title: "არსებობისათვის ბრძოლა",
            page: "157",
            href: null,
          },
          {
            n: "2.5",
            title: "ბუნებრივი გადარჩევა",
            page: "161",
            href: null,
          },
          {
            n: "2.6",
            title: "შეგუებულობა",
            page: "168",
            href: null,
          },
          {
            n: "2.7",
            title: "სახეობათწარმოქმნა",
            page: "175",
            href: null,
          },
          {
            n: "2.8",
            title: "ევოლუციის კანონზომიერებები და დამამტკიცებელი საბუთები",
            page: "181",
            href: null,
          },
        ],
      },
    ],
  },
  {
    grade: 12,
    roman: "XII",
    chapters: [
      {
        title: "ეკოსისტემის სტრუქტურა, ეკოლოგიური ფაქტორები",
        lessons: [
          {
            n: "",
            title: "ეკოსისტემა, როგორც ბიოლოგიური სისტემა",
            page: "6",
            href: null,
          },
          {
            n: "",
            title: "ეკოლოგიური ფაქტორები",
            page: "7",
            href: null,
          },
          {
            n: "",
            title: "ეკოსისტემის მდგრადობა, თვითრეგულაცია",
            page: "13",
            href: null,
          },
        ],
      },
      {
        title: "ენერგიის გადაცემა და ნივთიერებების წრებრუნვა ეკოსისტემაში",
        lessons: [
          {
            n: "",
            title: "კვებითი კავშირები და ფორმები",
            page: "14",
            href: null,
          },
          {
            n: "",
            title: "ეკოლოგიური პირამიდები",
            page: "16",
            href: null,
          },
        ],
      },
      {
        title: "ბიო-გეო-ქიმიური ციკლი",
        lessons: [
          {
            n: "",
            title: "ნივთიერებათა წრებრუნვა ბიოსფეროში",
            page: "21",
            href: null,
          },
        ],
      },
      {
        title: "ბიომრავალფეროვნება და მისი დაცვა",
        lessons: [
          {
            n: "",
            title: "ბიომრავალფეროვნების მნიშვნელობა",
            page: "28",
            href: null,
          },
          {
            n: "",
            title: "საქართველოს ბიომრავალფეროვნება",
            page: "29",
            href: null,
          },
          {
            n: "",
            title: "კონსერვაციული ბიოლოგია",
            page: "33",
            href: null,
          },
        ],
      },
      {
        title: "გარემო და ადამიანის ჯანმრთელობა",
        lessons: [
          {
            n: "",
            title: "წყლისა და ნიადაგის დაბინძურება",
            page: "40",
            href: null,
          },
          {
            n: "",
            title: "ჰაერის დაბინძურება",
            page: "40",
            href: null,
          },
          {
            n: "",
            title: '„სათბურის ეფექტი"',
            page: "40",
            href: null,
          },
        ],
      },
      {
        title: "მემკვიდრეობითობისა და ცვალებადობის როლი ადაპტაციისთვის",
        lessons: [
          {
            n: "",
            title:
              "მემკვიდრეობითობისა და ცვალებადობის მნიშვნელობა შეგუებულობების ჩამოყალიბებაში",
            page: "44",
            href: "/biology/dna?s=mutation",
          },
          {
            n: "",
            title:
              "ექსპერიმენტები, რომლებიც ადასტურებენ მემკვიდრული ცვალებადობისა და ბუნებრივი გადარჩევის როლს",
            page: "47",
            href: null,
          },
        ],
      },
      {
        title: "გამრავლების ევოლუცია",
        lessons: [
          {
            n: "",
            title: "უსქესო გამრავლება",
            page: "51",
            href: "/biology/cell?s=mitosis",
          },
          {
            n: "",
            title: "სქესობრივი გამრავლება ცხოველებში",
            page: "53",
            href: "/biology/cell?s=meiosis",
          },
          {
            n: "",
            title: "სქესობრივი გამრავლება ყვავილოვან მცენარეებში",
            page: "54",
            href: null,
          },
        ],
      },
      {
        title: "ნივთიერებათა ტრანსპორტი",
        lessons: [
          {
            n: "",
            title: "სისხლის მიმოქცევა",
            page: "58",
            href: "/biology/heart?s=circulation",
          },
          {
            n: "",
            title: "სუნთქვა",
            page: "60",
            href: "/topic/lungs",
          },
          {
            n: "",
            title: "საჭმლის მონელება",
            page: "61",
            href: "/topic/digestion",
          },
          {
            n: "",
            title: "ექსკრეცია",
            page: "63",
            href: "/topic/kidneys",
          },
          {
            n: "",
            title: "ექსკრეცია ცხოველებში",
            page: "65",
            href: null,
          },
          {
            n: "",
            title: "ნივთიერებათა ტრანსპორტი მცენარეებში",
            page: "69",
            href: null,
          },
        ],
      },
      {
        title: "მარეგულირებელი სისტემის ევოლუცია და ჰომეოსტაზი",
        lessons: [
          {
            n: "",
            title: "ნერვული სისტემის ევოლუცია",
            page: "73",
            href: null,
          },
          {
            n: "",
            title: "ნეირონის აგებულება და ნერვული იმპულსი",
            page: "75",
            href: null,
          },
          {
            n: "",
            title:
              "მცენარის გაღიზიანებადობა — ფოტოტროპიზმი (+ მაგალითი: ექსპერიმენტები ფოტოტროპიზმზე)",
            page: "77",
            href: null,
          },
          {
            n: "",
            title: "მცენარეული ჰორმონები",
            page: "79",
            href: null,
          },
        ],
      },
      {
        title: "აგებულებისა და მოძრაობის თავისებურება",
        lessons: [
          {
            n: "",
            title: "სიმეტრია ბიოლოგიაში",
            page: "83",
            href: null,
          },
          {
            n: "",
            title: "ორგანიზმების აგებულება და მოძრაობა",
            page: "84",
            href: null,
          },
          {
            n: "",
            title: "პროკარიოტები",
            page: "84",
            href: "/biology/cell?s=bacterium",
          },
          {
            n: "",
            title: "ეუკარიოტები",
            page: "85",
            href: "/biology/cell?s=animal",
          },
          {
            n: "",
            title: "შედარებითი ბიოლოგია და პალეონტოლოგია",
            page: "88",
            href: null,
          },
        ],
      },
    ],
  },
];

/** "9ა" → 9; null when the class label has no grade in VIII–XII. */
export function gradeFromClass(label: string | null | undefined) {
  const m = label?.match(/\d+/);
  const g = m ? Number(m[0]) : NaN;
  return g >= 8 && g <= 12 ? g : null;
}
