/**
 * Airport ICAO Code to City Name Lookup
 * Compact database covering major airports worldwide
 */
const AIRPORTS = {
  // Australia
  YSSY: 'Sydney', YMML: 'Melbourne', YBBN: 'Brisbane', YPPH: 'Perth',
  YPAD: 'Adelaide', YSCB: 'Canberra', YBTL: 'Townsville', YBCG: 'Gold Coast',
  YBCS: 'Cairns', YMEN: 'Melbourne Essendon', YSBK: 'Sydney Bankstown',
  YWLM: 'Newcastle', YMHB: 'Hobart', YPDN: 'Darwin', YAMB: 'Amberley',
  YSWG: 'Wagga Wagga', YBAS: 'Alice Springs', YAYE: 'Ayers Rock',
  YMAY: 'Avalon', YBMC: 'Maroochydore',

  // New Zealand
  NZAA: 'Auckland', NZWN: 'Wellington', NZCH: 'Christchurch', NZQN: 'Queenstown',

  // Southeast Asia
  WSSS: 'Singapore', WMKK: 'Kuala Lumpur', VTBS: 'Bangkok Suvarnabhumi',
  VTBD: 'Bangkok Don Mueang', VVNB: 'Hanoi', VVTS: 'Ho Chi Minh City',
  WIII: 'Jakarta', WADD: 'Bali', RPLL: 'Manila', VDPP: 'Phnom Penh',

  // East Asia
  RJTT: 'Tokyo Haneda', RJAA: 'Tokyo Narita', RJBB: 'Osaka Kansai',
  RJCC: 'Sapporo', RJFF: 'Fukuoka', RKSI: 'Seoul Incheon',
  VHHH: 'Hong Kong', RCTP: 'Taipei', VMMC: 'Macau',
  ZSPD: 'Shanghai Pudong', ZSSS: 'Shanghai Hongqiao', ZBAA: 'Beijing',
  ZGGG: 'Guangzhou', ZGSZ: 'Shenzhen', ZUUU: 'Chengdu',

  // South Asia
  VIDP: 'New Delhi', VABB: 'Mumbai', VOBL: 'Bangalore',
  VOMM: 'Chennai', VECC: 'Kolkata', VCBI: 'Colombo',

  // Middle East
  OMDB: 'Dubai', OMAA: 'Abu Dhabi', OTHH: 'Doha',
  OEJN: 'Jeddah', OERK: 'Riyadh', OBBI: 'Bahrain',
  OKBK: 'Kuwait', OIIE: 'Tehran', OLBA: 'Beirut',
  LLBG: 'Tel Aviv',

  // Europe
  EGLL: 'London Heathrow', EGKK: 'London Gatwick', EGLC: 'London City',
  EGSS: 'London Stansted', EGCC: 'Manchester', EGBB: 'Birmingham',
  LFPG: 'Paris CDG', LFPO: 'Paris Orly', LFMN: 'Nice',
  EDDF: 'Frankfurt', EDDM: 'Munich', EDDB: 'Berlin',
  EHAM: 'Amsterdam', EBBR: 'Brussels', ELLX: 'Luxembourg',
  LSZH: 'Zurich', LSGG: 'Geneva', LOWW: 'Vienna',
  LEMD: 'Madrid', LEBL: 'Barcelona', LPPT: 'Lisbon',
  LIRF: 'Rome Fiumicino', LIMC: 'Milan Malpensa', LIPZ: 'Venice',
  LGAV: 'Athens', LTFM: 'Istanbul', LKPR: 'Prague',
  EPWA: 'Warsaw', LHBP: 'Budapest', LROP: 'Bucharest',
  EKCH: 'Copenhagen', ENGM: 'Oslo', ESSA: 'Stockholm',
  EFHK: 'Helsinki', EIDW: 'Dublin', BIKF: 'Reykjavik',
  UUEE: 'Moscow Sheremetyevo', UUDD: 'Moscow Domodedovo',

  // Africa
  FACT: 'Cape Town', FAOR: 'Johannesburg', HKJK: 'Nairobi',
  HAAB: 'Addis Ababa', GMMN: 'Casablanca', HECA: 'Cairo',
  DNMM: 'Lagos', FMEE: 'Mauritius',

  // North America
  KJFK: 'New York JFK', KLGA: 'New York LaGuardia', KEWR: 'Newark',
  KLAX: 'Los Angeles', KSFO: 'San Francisco', KORD: 'Chicago O\'Hare',
  KATL: 'Atlanta', KDFW: 'Dallas/Fort Worth', KDEN: 'Denver',
  KMIA: 'Miami', KBOS: 'Boston', KSEA: 'Seattle',
  KPHX: 'Phoenix', KLAS: 'Las Vegas', KIAH: 'Houston',
  KMSP: 'Minneapolis', KDTW: 'Detroit', KPHL: 'Philadelphia',
  KMCO: 'Orlando', KFLL: 'Fort Lauderdale', KCLT: 'Charlotte',
  KDCA: 'Washington Reagan', KIAD: 'Washington Dulles',
  CYYZ: 'Toronto', CYVR: 'Vancouver', CYUL: 'Montreal',
  CYOW: 'Ottawa', CYWG: 'Winnipeg', CYEG: 'Edmonton',
  CYYC: 'Calgary', CYQB: 'Quebec City',
  MMMX: 'Mexico City', MMUN: 'Cancun',

  // South America
  SBGR: 'Sao Paulo', SCEL: 'Santiago', SAEZ: 'Buenos Aires',
  SKBO: 'Bogota', SEQM: 'Quito', SPJC: 'Lima',

  // Pacific
  PHNL: 'Honolulu', NFFN: 'Fiji Nadi', NTAA: 'Tahiti',
  PGUM: 'Guam',
};

/**
 * Look up city name for an ICAO airport code
 * @param {string} icao - 4-letter ICAO code
 * @returns {string} City name or the ICAO code if not found
 */
function getAirportCity(icao) {
  if (!icao) return null;
  return AIRPORTS[icao.toUpperCase()] || icao;
}

module.exports = { AIRPORTS, getAirportCity };
