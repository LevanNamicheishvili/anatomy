/*
 * The main boundaries of the lithosphere's plates, simplified (after P. Bird, 2003): mid-ocean ridges where plates
 * move apart, trenches and mountain belts where they meet. [latitude, longitude] in degrees.
 */
export const PLATE_BOUNDARIES: [number, number][][] = [
  // Mid-Atlantic Ridge, Iceland to the Bouvet triple junction.
  [[66, -18], [60, -29], [52, -31], [45, -28], [38, -30], [30, -42], [22, -45], [15, -46], [8, -38], [1, -28], [-1, -15], [-8, -13], [-16, -14], [-25, -13], [-33, -14], [-42, -16], [-50, -8], [-54, 0]],
  // Arctic (Gakkel) Ridge.
  [[66, -18], [71, -8], [79, 3], [85, 40], [87, 100], [78, 125]],
  // Southwest Indian Ridge.
  [[-54, 0], [-52, 15], [-45, 35], [-38, 52], [-26, 69]],
  // Central Indian and Carlsberg ridges, the Gulf of Aden, the Red Sea.
  [[-26, 69], [-15, 66], [-5, 68], [3, 63], [10, 57], [13, 50], [12, 44], [20, 38], [28, 34]],
  // Southeast Indian Ridge and the Pacific-Antarctic Ridge.
  [[-26, 69], [-38, 78], [-45, 95], [-50, 115], [-50, 140], [-56, 152], [-61, 161], [-65, 180], [-62, -155], [-56, -125], [-50, -115]],
  // East Pacific Rise, the Gulf of California, the San Andreas Fault, Juan de Fuca.
  [[-50, -115], [-36, -110], [-20, -113], [0, -103], [10, -104], [20, -108], [23, -109], [31, -114], [37, -122], [40, -125], [44, -129], [50, -130]],
  // Chile Rise to the Peru-Chile and Middle America trenches.
  [[-46, -76], [-40, -75], [-30, -72], [-18, -71], [-10, -80], [-3, -82], [5, -79], [12, -90], [16, -99], [20, -106]],
  // Aleutians, Kamchatka, Kurils, Japan, Izu-Bonin and Mariana trenches.
  [[50, -130], [55, -135], [59, -145], [57, -155], [53, -165], [51, -180], [52, 170], [55, 163], [50, 157], [44, 149], [40, 144], [34, 142], [27, 143], [20, 146], [13, 145], [11, 140]],
  // Nankai, Ryukyu, Philippines.
  [[35, 138], [31, 131], [25, 124], [20, 121], [13, 125], [5, 127]],
  // Sunda Trench (Indonesia) to New Guinea.
  [[15, 94], [5, 94], [-3, 100], [-8, 108], [-10, 118], [-10, 125], [-6, 131], [-4, 138], [-3, 145]],
  // Solomons, Vanuatu, Tonga, Kermadec, New Zealand to the Macquarie triple junction.
  [[-3, 145], [-6, 155], [-10, 162], [-15, 168], [-20, 171], [-17, -178], [-15, -173], [-22, -175], [-30, -177], [-38, 178], [-42, 174], [-46, 167], [-53, 159], [-61, 161]],
  // Alps to the Himalaya: Azores, Gibraltar, the Mediterranean, Anatolia, the Caucasus, Zagros, Makran, Himalaya.
  [[38, -30], [37, -15], [36, -6], [37, 5], [38, 15], [40, 20], [37, 28], [38, 36], [41, 43], [38, 47], [33, 49], [27, 57], [25, 63], [30, 67], [35, 73], [30, 82], [27, 92], [22, 94], [15, 94]],
  // Caribbean.
  [[20, -86], [19, -78], [19, -66], [16, -61], [12, -61], [11, -66], [11, -75], [9, -79]],
  // Scotia Arc.
  [[-54, -64], [-53, -45], [-57, -26], [-60, -33], [-61, -55], [-62, -62]],
  // East African Rift.
  [[12, 42], [8, 39], [0, 36], [-6, 35], [-12, 34], [-17, 35]],
];
