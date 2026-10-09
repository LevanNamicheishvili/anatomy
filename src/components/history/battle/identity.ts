/** One geographic reference shared by the overview, labels and external map link.
 * This is the present-day memorial, a reference for the battle AREA, not an exact battle coordinate.
 * https://georgiantravelguide.com/en/didgori-monument
 * https://www.georgianencyclopedia.ge/ka/form/27161
 */
export const DIDGORI_PLACE = {
  historic: "დიდგორის ველი",
  modern: "დიდგორის ველი · დიდგორის მემორიალი",
  region: "ქვემო ქართლი · თეთრიწყაროს მუნიციპალიტეტი",
  lon: 44.508121,
  lat: 41.760839,
  description: "თრიალეთის ქედის აღმოსავლეთი ნაწილი, მანგლისის ჩრდილო-აღმოსავლეთით. სახელწოდება „დიდგორი“ დღესაც გამოიყენება.",
  mapHref: "https://www.openstreetmap.org/?mlat=41.760839&mlon=44.508121#map=13/41.7608/44.5081",
} as const;

export const ARMY_TOTALS = {
  georgia: { name: "დავით IV-ის ლაშქარი", count: "≈ 56 000", note: "გავრცელებული შეფასება" },
  coalition: { name: "ილღაზის კოალიცია", count: "30 000–250 000+", note: "წყაროები განსხვავდება" },
} as const;

export const COMMANDERS = [
  { id: "david", name: "დავით IV აღმაშენებელი", role: "საქართველოს მეფე · მთავარსარდალი", regiment: "david", offset: 0, side: 0, color: "#821e2a", trim: "#d7af57", beard: "#35231d", age: 48, equipment: "ჯაჭვის პერანგი, კონუსური მუზარადი, წითელი მოსასხამი და ოქროსფერი მორთულობა.", description: "ერთიანი ლაშქრის სარდალი. მის მოდელს სამეფო მოსასხამი და მორთული აღჭურვილობა გამოყოფს." },
  { id: "demetre", name: "დემეტრე უფლისწული", role: "დავითის ძე · მომავალი დემეტრე I", regiment: "demetre", offset: 0, side: 0, color: "#b8492e", trim: "#d8c29a", beard: "#30211b", age: 28, equipment: "ჯაჭვის აბჯარი, ცხვირსაცავიანი მუზარადი, შუბი და წაგრძელებული ფარი.", description: "ბრძოლის მონაწილე უფლისწული. მოდელში ახალგაზრდა სახე და განსხვავებული სამოსი აქვს; 1121 წელს ჯერ მეფე არ ყოფილა." },
  { id: "ilghazi", name: "ილღაზი", role: "არტუკიდი ამირა · კოალიციის სარდალი", regiment: "cCmd", offset: 0, side: 1, color: "#203b56", trim: "#cfac66", beard: "#77716b", age: 60, equipment: "ფირფიტოვანი აბჯარი, მორთული მუზარადი, მრგვალი ფარი და ლურჯი მოსასხამი.", description: "კოალიციის მთავარსარდალი. მეთაურის აღჭურვილობა და ჭაღარა წვერი ვიზუალურად განასხვავებს." },
  { id: "dubays", name: "დუბაის II", role: "ჰილის ამირა · კოალიციის მოკავშირე", regiment: "cCmd", offset: 1, side: 1, color: "#bca47a", trim: "#b98638", beard: "#30251e", age: 50, equipment: "ქსოვილის თავსაბურავი, გრძელი კაფტანი, მრგვალი ფარი და მორთული ქამარი.", description: "ილღაზის მოკავშირე მეთაური. ღია სამოსითა და თავსაბურავით ადვილად ამოიცნობ." },
] as const;
export type CommanderId = (typeof COMMANDERS)[number]["id"];
