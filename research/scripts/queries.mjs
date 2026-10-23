// Each query costs one SerpAPI search. Free plan: 250 per month.
// region tags drive the filters on the site.

const reddit = (region, q) => ({ engine: "google", kind: "reddit", region, q: `site:reddit.com ${q}` });
const news = (region, q) => ({ engine: "google_news", kind: "news", region, q });
const web = (region, q) => ({ engine: "google", kind: "web", region, q });

export const QUERIES = [
  // Kozhikode / Calicut
  reddit("Kozhikode", "kozhikode parking"),
  reddit("Kozhikode", "calicut parking"),
  reddit("Kozhikode", "calicut traffic parking problem"),
  reddit("Kozhikode", "calicut beach parking"),
  reddit("Kozhikode", "kozhikode mall parking"),
  news("Kozhikode", "Kozhikode parking"),
  news("Kozhikode", "Kozhikode traffic congestion parking"),
  web("Kozhikode", "kozhikode parking problem"),

  // Kochi / Ernakulam
  reddit("Kochi", "kochi parking"),
  reddit("Kochi", "ernakulam parking"),
  reddit("Kochi", "kochi metro parking"),
  reddit("Kochi", "kakkanad infopark parking"),
  reddit("Kochi", "lulu mall kochi parking"),
  reddit("Kochi", "kochi apartment parking"),
  reddit("Kochi", "fort kochi parking"),
  reddit("Kochi", "edappally vyttila parking"),
  news("Kochi", "Kochi parking"),
  news("Kochi", "Kochi parking fee"),
  news("Kochi", "Ernakulam illegal parking"),
  web("Kochi", "kochi parking problem"),

  // Rest of Kerala
  reddit("Kerala", "kerala parking problem"),
  reddit("Kerala", "trivandrum parking"),
  reddit("Kerala", "thrissur parking"),
  reddit("Kerala", "kerala illegal parking"),
  reddit("Kerala", "kerala hospital parking"),
  reddit("Kerala", "kerala railway station parking"),
  reddit("Kerala", "kerala EV charging station"),
  reddit("Kerala", "kerala house no parking space car"),
  news("Kerala", "Kerala parking crisis"),
  news("Kerala", "Thiruvananthapuram parking"),
  news("Kerala", "Thrissur parking"),
  news("Kerala", "multi-level parking Kerala"),
  news("Kerala", "Kerala EV charging stations shortage"),
  news("Kerala", "Kerala no parking fine"),
  web("Kerala", "team-bhp kerala parking problem"),

  // Elsewhere in India
  reddit("India", "bangalore parking problem"),
  reddit("India", "mumbai parking nightmare"),
  reddit("India", "delhi parking fight"),
  reddit("India", "chennai parking problem"),
  reddit("India", "hyderabad parking problem"),
  reddit("India", "pune society parking dispute"),
  reddit("India", "india apartment EV charging parking"),
  reddit("India", "india no parking space bought car"),
  news("India", "India urban parking crisis"),
  news("India", "parking dispute killed India"),
  news("India", "Bengaluru parking policy"),
  news("India", "apartment EV charging parking dispute India"),
  web("India", "india parking problem forum"),

  // Round 2: EV charging
  reddit("Kerala", "kerala EV charging problem"),
  reddit("Kochi", "kochi EV charger apartment"),
  reddit("Kerala", "KSEB charging station not working"),
  reddit("India", "apartment association EV charger refuse"),
  reddit("India", "bangalore apartment EV charger association"),
  reddit("India", "society EV charger NOC denied"),
  reddit("India", "EV charging station not working india"),
  reddit("India", "EV charger blocked by petrol car india"),
  reddit("India", "EV charging queue wait highway india"),
  reddit("India", "pune society EV charging dispute"),
  news("Kerala", "Kerala EV charging station not working"),
  news("Kochi", "Kochi EV charging"),
  news("Kozhikode", "Kozhikode EV charging"),
  news("India", "housing society EV charger denied"),
  news("India", "EV owners charging problems apartment India"),
  news("Kerala", "KSEB EV charging station complaints"),
  web("India", "team-bhp EV charging apartment society problem"),
  web("Kerala", "EV charging issues kerala forum"),

  // Round 2: apartments, societies, homes
  reddit("Kochi", "kochi flat parking dispute"),
  reddit("Kerala", "kerala apartment visitor parking"),
  reddit("Kerala", "kerala house narrow road no car parking"),
  reddit("India", "bangalore apartment parking slot dispute"),
  reddit("India", "mumbai society parking dispute"),
  reddit("India", "builder sold parking slot apartment india"),
  reddit("India", "second car no parking society india"),
  reddit("India", "hyderabad gated community parking problem"),
  reddit("India", "chennai apartment parking problem"),
  reddit("India", "delhi colony parking fight neighbour"),
  news("Kerala", "apartment parking dispute Kerala"),
  news("Kochi", "Kochi flat parking"),
  news("India", "housing society parking dispute India"),
  news("India", "builder parking slot sale complaint consumer court"),
  news("India", "residential colony parking problem India"),
  web("India", "team-bhp apartment parking problem"),
  web("Kochi", "kochi flat parking problem"),
];
