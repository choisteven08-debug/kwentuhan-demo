/* Coke Tapestries: working prototype. Vanilla JS, no build step.
   Data lives on this device (IndexedDB). The only network call is translation, and only when the user taps Translate. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const screen = $("#screen"), layer = $("#layer");
  const PHOTO = "assets/img/migs-and-lola.jpg";
  const DAY = 864e5;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const fmtDate = (d, o = { month: "short", day: "numeric" }) => new Date(d).toLocaleDateString("en-CA", o);

  /* ---------------- storage (IndexedDB, with in-memory fallback) ---------------- */
  const DB = (() => {
    const mem = { kv: new Map(), blobs: new Map() };
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res) => {
      try {
        const r = indexedDB.open("coke-tapestries", 1);
        r.onupgradeneeded = () => { r.result.createObjectStore("kv"); r.result.createObjectStore("blobs"); };
        r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
      } catch { res(null); }
    }));
    const op = async (store, mode, fn, memFn) => {
      const db = await open();
      if (!db) return memFn(mem[store]);
      return new Promise((res, rej) => {
        const t = db.transaction(store, mode); const req = fn(t.objectStore(store));
        t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
    };
    return {
      get: (k, s = "kv") => op(s, "readonly", (st) => st.get(k), (m) => m.get(k)),
      set: (k, v, s = "kv") => op(s, "readwrite", (st) => st.put(v, k), (m) => { m.set(k, v); }),
      del: (k, s = "kv") => op(s, "readwrite", (st) => st.delete(k), (m) => { m.delete(k); }),
      clear: async () => { await op("kv", "readwrite", (st) => st.clear(), (m) => m.clear()); await op("blobs", "readwrite", (st) => st.clear(), (m) => m.clear()); },
    };
  })();
  const URLS = {};
  async function putBlob(key, blob) { await DB.set(key, blob, "blobs"); if (URLS[key]) URL.revokeObjectURL(URLS[key]); URLS[key] = URL.createObjectURL(blob); }
  async function dropBlob(key) { await DB.del(key, "blobs"); if (URLS[key]) { URL.revokeObjectURL(URLS[key]); delete URLS[key]; } }
  async function loadURL(key) { if (!key || URLS[key]) return; const b = await DB.get(key, "blobs"); if (b) URLS[key] = URL.createObjectURL(b); }
  const photoURL = (p) => (p === "sample" ? PHOTO : p && p !== "none" ? URLS[p] : null);

  /* ---------------- content ---------------- */
  const QUESTIONS = [
    { tl: "Saan ka lumaki, at ano ang naaalala mo sa bahay ninyo?", en: "Where did you grow up, and what do you remember about your home?", short: "Where she grew up" },
    { tl: "Ano ang naaalala mo sa unang araw mo sa Canada?", en: "What do you remember about your first day in Canada?", short: "First day in Canada" },
    { tl: "Ano ang una mong trabaho?", en: "What was your first job?", short: "Her first job" },
    { tl: "Ano ang mga patakaran sa kusina mo?", en: "What are the rules in your kitchen?", short: "Kitchen rules" },
    { tl: "Ano ang naaalala mo sa una mong biyahe sa Maynila?", en: "What do you remember about your first trip to Manila?", short: "First trip to Manila" },
    { tl: "Ano ang kinakain mo tuwing fiesta noong bata ka?", en: "What did you eat at fiestas when you were a kid?", short: "Fiesta food" },
    { tl: "Paano kayo nagkakilala ni Lolo?", en: "How did you and Lolo meet?", short: "How they met" },
    { tl: "Ano ang pinakamasayang Pasko mo?", en: "What was your happiest Christmas?", short: "Happiest Christmas" },
    { tl: "Sino ang matalik mong kaibigan noong bata ka?", en: "Who was your best friend growing up?", short: "Best friend" },
    { tl: "Anong kanta ang lagi mong kinakanta?", en: "What song do you always sing?", short: "Her song" },
    { tl: "Ano ang pinakamahirap na desisyon mo?", en: "What was the hardest decision you ever made?", short: "Hardest decision" },
    { tl: "Ano ang gusto mong hindi namin makalimutan?", en: "What do you want us never to forget?", short: "Never forget" },
  ];
  const svgData = (svg) => `data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27")}`;
  const PAT_SVG = {
    banig: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16' fill='#E6D3AA'/><path d='M0 0h8v8H0zM8 8h8v8H8z' fill='#CDAA6E'/><path d='M0 3h8v2H0zM8 11h8v2H8z' fill='#A9563F'/><path d='M11 0h2v8h-2zM3 8h2v8H3z' fill='#A9563F'/></svg>",
    parol: "<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><rect width='22' height='22' fill='#741E22'/><path d='M11 6.5l1.1 3.4 3.4 1.1-3.4 1.1L11 15.5l-1.1-3.4L6.5 11l3.4-1.1z' fill='#D3A24A'/></svg>",
    capiz: "<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><rect width='12' height='12' fill='#F1ECDF'/><path d='M0 .5H12M.5 0V12' stroke='#CDBE9C' stroke-width='1'/></svg>",
    inabel: "<svg xmlns='http://www.w3.org/2000/svg' width='17' height='17'><rect width='17' height='17' fill='#EFEAE0'/><rect width='3' height='17' fill='#2E3B61'/><rect x='7' width='1' height='17' fill='#2E3B61'/><rect x='12' width='1' height='17' fill='#963A2B'/></svg>",
  };
  /* Folk-art scenes, one per question. Stand-ins for the artist-drawn scenes a story gets when there's no photo. */
  const C = "#F3E7CF", SAND = "#E6D3AA", T = "#B5523B", R = "#8E2A22", M = "#D9A441", G = "#3F7A55", LG = "#7FA65E", DG = "#2C5A3F", N = "#2E3B61", SKY = "#A9CADB", B = "#6B4A2F", INK = "#2A2420", W = "#FFFFFF", BLUSH = "#F3D9CF";
  const svgScene = (body, bg) => `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 100 100'><rect width='100' height='100' fill='${bg}'/>${body}</svg>`;
  const person = (x, y, s, head, body) => `<circle cx='${x}' cy='${y}' r='${4.2 * s}' fill='${head}'/><path d='M${x - 6 * s} ${y + 19 * s} Q${x - 6 * s} ${y + 5 * s} ${x} ${y + 5 * s} Q${x + 6 * s} ${y + 5 * s} ${x + 6 * s} ${y + 19 * s}Z' fill='${body}'/>`;
  const SCENES = [
    // 1 where she grew up: house and mango tree
    svgScene(`<circle cx='80' cy='20' r='9' fill='${M}'/><rect y='72' width='100' height='28' fill='${LG}'/><rect x='12' y='50' width='30' height='24' fill='${T}'/><path d='M8 52 L27 35 L46 52Z' fill='${R}'/><rect x='23' y='60' width='8' height='14' fill='${B}'/><rect x='63' y='46' width='6' height='28' fill='${B}'/><circle cx='66' cy='38' r='17' fill='${G}'/><circle cx='54' cy='45' r='10' fill='${DG}'/><circle cx='78' cy='46' r='10' fill='${DG}'/><ellipse cx='58' cy='40' rx='2.6' ry='3.6' fill='${M}'/><ellipse cx='70' cy='32' rx='2.6' ry='3.6' fill='${M}'/><ellipse cx='75' cy='45' rx='2.6' ry='3.6' fill='${M}'/>`, C),
    // 2 first day in Canada: snow at night
    svgScene(`<circle cx='79' cy='18' r='7' fill='${C}'/><ellipse cx='28' cy='102' rx='62' ry='32' fill='${W}'/><ellipse cx='86' cy='106' rx='48' ry='30' fill='#E3EAF0'/><rect x='40' y='56' width='22' height='18' fill='${T}'/><path d='M36 58 L51 45 L66 58Z' fill='${W}'/><rect x='47' y='61' width='7' height='6' fill='${M}'/>${[[12,14],[30,26],[20,44],[52,20],[64,34],[88,40],[8,60],[76,58],[40,36],[94,24]].map(([x,y])=>`<circle cx='${x}' cy='${y}' r='1.5' fill='${W}'/>`).join("")}`, N),
    // 3 first job: pandesal basket
    svgScene(`<rect y='70' width='100' height='30' fill='${SAND}'/><path d='M38 22 q4 -6 0 -12 M50 18 q4 -6 0 -12 M62 22 q4 -6 0 -12' stroke='#CDBE9C' stroke-width='2' fill='none' stroke-linecap='round'/><ellipse cx='33' cy='53' rx='11' ry='8' fill='${M}' stroke='#B9842F' stroke-width='1.5'/><ellipse cx='50' cy='48' rx='12' ry='9' fill='${M}' stroke='#B9842F' stroke-width='1.5'/><ellipse cx='67' cy='53' rx='11' ry='8' fill='${M}' stroke='#B9842F' stroke-width='1.5'/><rect x='18' y='56' width='64' height='22' rx='6' fill='${B}'/><path d='M22 63h56M22 70h56' stroke='#8A6A48' stroke-width='2'/><path d='M30 56v22M42 56v22M54 56v22M66 56v22' stroke='#8A6A48' stroke-width='1.5'/>`, C),
    // 4 kitchen rules: palayok and rice bowl
    svgScene(`<rect y='70' width='100' height='30' fill='${SAND}'/><ellipse cx='30' cy='58' rx='19' ry='15' fill='${T}'/><rect x='15' y='40' width='30' height='7' rx='3' fill='${R}'/><path d='M22 40 q8 -8 16 0' stroke='${R}' stroke-width='2.5' fill='none'/><ellipse cx='69' cy='54' rx='15' ry='8' fill='${W}'/><path d='M53 56 A16 14 0 0 0 85 56Z' fill='${W}' stroke='${N}' stroke-width='2'/><path d='M57 62h24' stroke='${N}' stroke-width='2'/><path d='M80 30 L66 52 M86 32 L70 53' stroke='${B}' stroke-width='2.2' stroke-linecap='round'/>`, C),
    // 5 first trip to Manila: jeepney
    svgScene(`<circle cx='18' cy='18' r='8' fill='${M}'/><rect y='70' width='100' height='30' fill='#5E5A55'/><path d='M0 85h100' stroke='${W}' stroke-width='2' stroke-dasharray='8 6'/><path d='M14 70 Q12 50 18 36' stroke='${B}' stroke-width='3' fill='none'/><path d='M18 36 q-12 -2 -16 6 M18 36 q10 -6 16 0 M18 36 q-4 -10 -12 -10 M18 36 q8 -12 16 -8' stroke='${G}' stroke-width='3' fill='none' stroke-linecap='round'/><rect x='34' y='44' width='54' height='6' rx='2' fill='${M}'/><rect x='32' y='50' width='58' height='20' rx='4' fill='${R}'/><rect x='38' y='53' width='10' height='7' fill='${C}'/><rect x='51' y='53' width='10' height='7' fill='${C}'/><rect x='64' y='53' width='10' height='7' fill='${C}'/><path d='M32 64h58' stroke='${M}' stroke-width='2'/><circle cx='44' cy='71' r='6' fill='${INK}'/><circle cx='78' cy='71' r='6' fill='${INK}'/><circle cx='44' cy='71' r='2' fill='#BDBDBD'/><circle cx='78' cy='71' r='2' fill='#BDBDBD'/>`, SKY),
    // 6 fiesta food: banderitas, bottles and a plate
    svgScene(`<path d='M0 12 Q50 26 100 12' stroke='${B}' stroke-width='1' fill='none'/>${[[6,T],[20,M],[34,G],[48,N],[62,T],[76,M],[90,G]].map(([x,c])=>`<path d='M${x} ${14+Math.sin(x/32)*4} l10 1 l-5 10Z' fill='${c}'/>`).join("")}<rect y='68' width='100' height='32' fill='${SAND}'/><rect x='24' y='36' width='5' height='10' fill='#5A1A16'/><rect x='21' y='46' width='11' height='24' rx='4' fill='#5A1A16'/><rect x='38' y='38' width='5' height='10' fill='#5A1A16'/><rect x='35' y='48' width='11' height='22' rx='4' fill='#5A1A16'/><ellipse cx='72' cy='66' rx='20' ry='5' fill='${W}'/><path d='M58 64 q14 -16 28 0Z' fill='${T}'/><path d='M62 60 q10 -6 20 0' stroke='${R}' stroke-width='1.5' fill='none'/>`, C),
    // 7 how they met: two people and a heart
    svgScene(`<rect y='76' width='100' height='24' fill='${SAND}'/><path d='M50 30 c-6 -9 -18 -2 -10 7 l10 9 l10 -9 c8 -9 -4 -16 -10 -7Z' fill='${R}'/>${person(36, 46, 1.4, B, T)}${person(64, 46, 1.4, B, N)}`, BLUSH),
    // 8 happiest Christmas: parol
    svgScene(`${[[12,16],[86,14],[20,70],[90,64],[70,88],[30,90]].map(([x,y])=>`<circle cx='${x}' cy='${y}' r='1.4' fill='${C}'/>`).join("")}<path d='M50 18 L56 36 L75 36 L60 47 L66 66 L50 54 L34 66 L40 47 L25 36 L44 36Z' fill='${M}'/><path d='M50 30 L53 39 L62 39 L55 44 L58 53 L50 47 L42 53 L45 44 L38 39 L47 39Z' fill='${T}'/><path d='M44 62 L38 90 M50 58 L50 92 M56 62 L62 90' stroke='${M}' stroke-width='2' stroke-linecap='round'/>`, N),
    // 9 best friend: kite and two kids
    svgScene(`<rect y='72' width='100' height='28' fill='${LG}'/><path d='M68 12 L80 28 L68 44 L56 28Z' fill='${T}'/><path d='M68 12 V44 M56 28 H80' stroke='${C}' stroke-width='1.2'/><path d='M68 44 Q60 60 46 62' stroke='${INK}' stroke-width='1' fill='none'/>${person(34, 54, 1.0, B, M)}${person(48, 56, 0.95, B, G)}`, SKY),
    // 10 her song: guitar and notes
    svgScene(`<rect x='45' y='10' width='6' height='34' fill='${B}'/><rect x='43' y='6' width='10' height='7' rx='2' fill='${INK}'/><circle cx='48' cy='50' r='13' fill='#C98A3A'/><circle cx='48' cy='68' r='17' fill='#C98A3A'/><circle cx='48' cy='58' r='5' fill='${INK}'/><rect x='41' y='74' width='14' height='3' fill='${INK}'/><g fill='${N}'><ellipse cx='76' cy='40' rx='4' ry='3'/><rect x='79' y='22' width='1.6' height='18'/><ellipse cx='86' cy='34' rx='4' ry='3'/><rect x='89' y='16' width='1.6' height='18'/><rect x='79' y='16' width='11.6' height='3'/><ellipse cx='20' cy='30' rx='4' ry='3'/><rect x='23' y='14' width='1.6' height='16'/></g>`, C),
    // 11 hardest decision: suitcase and plane
    svgScene(`<rect y='76' width='100' height='24' fill='${SAND}'/><path d='M12 30 Q40 6 74 20' stroke='${N}' stroke-width='1.2' stroke-dasharray='3 3' fill='none'/><path d='M74 20 l12 -4 l-2 4 l4 2 l-4 1 l-1 4 l-3 -4 l-6 1Z' fill='${N}'/><rect x='26' y='44' width='48' height='34' rx='4' fill='${T}'/><path d='M42 44 v-6 h16 v6' stroke='${INK}' stroke-width='3' fill='none'/><rect x='36' y='44' width='5' height='34' fill='${M}'/><rect x='59' y='44' width='5' height='34' fill='${M}'/>`, C),
    // 12 never forget: three generations
    svgScene(`<path d='M10 76 A40 40 0 0 1 90 76Z' fill='${M}' opacity='.55'/><rect y='76' width='100' height='24' fill='${SAND}'/>${person(32, 42, 1.5, B, R)}${person(54, 50, 1.2, B, N)}${person(72, 58, 0.85, B, G)}`, BLUSH),
  ];
  const sceneURL = (w) => svgData(SCENES[(w - 1) % 12]);
  const pic = (story) => photoURL(story.photo) || sceneURL(story.week);
  const PAT = Object.fromEntries(Object.entries(PAT_SVG).map(([k, v]) => [k, `url('${svgData(v)}')`]));
  const FRAMES = [
    { id: "banig", name: "Banig", note: "Woven mat pattern, Samar" },
    { id: "parol", name: "Parol", note: "Christmas lantern star, Pampanga" },
    { id: "capiz", name: "Capiz", note: "Shell window grid, Iloilo" },
    { id: "inabel", name: "Inabel", note: "Handloom stripes, Ilocos" },
  ];
  const LANGS = { fil: "Tagalog", en: "English", other: "Another Filipino language" };
  const SR_LANG = { fil: "fil-PH", en: "en-CA" };
  const CALLED = ["Lola", "Lolo", "Nanay", "Tatay", "Tita", "Tito", "Ate", "Kuya", ""];

  /* ---------------- icons ---------------- */
  const P = {
    back: '<path d="M15 5l-7 7 7 7"/>', chev: '<path d="M9.5 5.5l6.5 6.5-6.5 6.5"/>',
    share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M6.5 11H5v9.5h14V11h-1.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M7 7l10 10M17 7L7 17"/>', minus: '<path d="M6 12h12"/>',
    pin: '<path d="M12 21s6.5-5.8 6.5-11a6.5 6.5 0 0 0-13 0c0 5.2 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    house: '<path d="M3.5 11.5L12 4l8.5 7.5"/><path d="M6 10v10h12V10"/>',
    book: '<path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z"/><path d="M12 6.5v13"/>',
    people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.4.2 4 1.8 4.5 4.4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
    film: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M10 9.5v5l4-2.5z"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l4.5-4.5 3 3 2.5-2.5 4 4"/>',
  };
  const ic = (n, size = 22, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
  const PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
  const PAUSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="3.6" height="14" rx="1"/><rect x="13.9" y="5" width="3.6" height="14" rx="1"/></svg>';

  /* ---------------- state ---------------- */
  let D = null;              // persisted family data
  let U = { view: "week" };  // UI-only state
  const cleanups = [];
  const save = () => DB.set("data", D).catch(() => toast("Couldn't save on this device"));
  const member = (id) => D.members.find((m) => m.id === id);
  const display = (m) => (m ? (m.called ? `${m.called} ${m.name}` : m.name) : "");
  const you = () => D.members.find((m) => m.role === "you") || { name: "Me" };
  const tellers = () => D.members.filter((m) => m.role === "teller");
  const initials = (m) => (m.name || "?").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const uid = () => Math.random().toString(36).slice(2, 9);

  function mondayOf(t) { const x = new Date(t); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  const weekNow = () => Math.max(1, Math.round((mondayOf(Date.now()) - new Date(D.family.seasonStart)) / (7 * DAY)) + 1 + (D.family.offset || 0));
  const mondayFor = (w) => { const s = new Date(D.family.seasonStart); s.setDate(s.getDate() + (w - 1) * 7); return s; };
  const qFor = (w) => QUESTIONS[(w - 1) % 12];
  const seasonOf = (w) => Math.ceil(w / 12);
  const wis = (w) => ((w - 1) % 12) + 1;
  const monthKey = (w) => { const d = mondayFor(w); return `${d.getFullYear()}-${d.getMonth() + 1}`; };
  const freeLeft = (w) => !D.free[monthKey(w)];
  const qPair = (q) => (D.settings.qFirst === "en" ? [q.en, q.tl] : [q.tl, q.en]);

  /* ---------------- sample family ---------------- */
  const SAMPLE_STORIES = [
    { title: "Where she grew up", frame: "capiz", duration: 241, q: 2,
      text: "Lumaki ako sa San Fernando, Pampanga. May malaking puno ng mangga sa bahay namin. Tuwing hapon, nagkukuwentuhan ang mga kapitbahay sa ilalim nito.",
      translation: "I grew up in San Fernando, Pampanga. There was a big mango tree at our house. Every afternoon, the neighbours would sit under it and talk." },
    { title: "First day in Canada", frame: "banig", duration: 362, q: 1,
      text: "Dumating kami sa Winnipeg noong Enero 1998. Hindi pa ako nakakita ng niyebe. Tumawa ang Tito mo kasi tatlong sweater ang suot ko pero nanginginig pa rin ako.",
      translation: "We landed in Winnipeg in January 1998. I had never seen snow. Your Tito laughed because I wore three sweaters and was still shaking." },
    { title: "Her first job", frame: "inabel", duration: 305, q: 2,
      text: "Ang una kong trabaho ay sa isang panaderya sa Maynila. Gumigising ako ng alas-kuwatro para gumawa ng pandesal. Puwede kong kainin ang mga sira.",
      translation: "My first job was at a bakery in Manila. I woke up at four to make pandesal. I was allowed to eat the broken ones." },
    { title: "Lola's kitchen rules", frame: "banig", duration: 188, q: 1,
      text: "Unang patakaran: hindi ka nagsasayang ng kanin. Pangalawa: sabay-sabay kumain ang lahat, kahit gabi na ang hapunan.",
      translation: "Rule one: you never waste rice. Rule two: everyone eats together, even if dinner is late." },
    { title: "First trip to Manila", frame: "capiz", duration: 254, q: 1,
      text: "Noong una akong pumunta sa Maynila, anim na oras akong nasa bus. Hawak ko ang kamay ng nanay ko buong biyahe.",
      translation: "The first time I went to Manila, I was on the bus for six hours. I held my mother's hand the whole way." },
  ];
  function newData({ youName, fam, tellerName, called, lang, sample }) {
    const start = mondayOf(Date.now()); if (sample) start.setDate(start.getDate() - 35);
    const tellerId = uid();
    const d = {
      v: 1, family: { name: fam, seasonStart: start.toISOString(), offset: 0, created: new Date().toISOString() },
      members: [
        { id: uid(), name: youName, called: "", role: "you" },
        { id: tellerId, name: tellerName, called, role: "teller", lang, consent: sample ? new Date(start).toISOString() : null },
      ],
      unlocks: {}, receipts: [], free: {}, stories: {}, draft: null,
      settings: { qFirst: "tl", subs: "both", live: !IOS },
    };
    if (sample) {
      d.members.push({ id: uid(), name: "Marites", called: "Tita", role: "listener" }, { id: uid(), name: "Ana", called: "", role: "listener" });
      SAMPLE_STORIES.forEach((s, i) => {
        const w = i + 1, en = sentences(s.translation), tl = sentences(s.text);
        d.unlocks[w] = { how: "receipt", at: new Date(start.getTime() + (i * 7 + 5) * DAY).toISOString() };
        d.stories[w] = { week: w, teller: tellerId, title: s.title, text: s.text, translation: s.translation, quote: en[s.q], quoteTl: tl[s.q] || "",
          frame: s.frame, photo: null, audio: null, duration: s.duration, at: d.unlocks[w].at, sample: true };
      });
    }
    return d;
  }

  /* ---------------- text helpers ---------------- */
  function sentences(t) { return (String(t || "").replace(/\s+/g, " ").match(/[^.!?]+[.!?]*["”']?/g) || []).map((s) => s.trim()).filter((s) => s.length > 2); }
  function suggestQuote(list) {
    if (!list.length) return 0;
    const KEYS = [[/(coke|coca|bottle|bote|glass)/i, 5], [/(always|never|remember|laging|hindi ko)/i, 3], [/(fiesta|christmas|pasko|mother|nanay|lolo|lola|rice|kanin|home|bahay)/i, 2]];
    const score = (s) => KEYS.reduce((n, [re, w]) => n + (re.test(s) ? w : 0), 0) + (s.length < 120 ? 1 : -3) + Math.min(s.length, 90) / 90;
    return list.reduce((best, s, i) => (score(s) > score(list[best]) ? i : best), 0);
  }

  /* ---------------- chrome ---------------- */
  const nav = (backLabel, backTo, title, right = "") => `<div class="nav">
    ${backTo ? `<button class="tap" data-go="${backTo}">${ic("back", 24, 2.3)}<span>${backLabel}</span></button>` : '<span style="width:44px"></span>'}
    <span class="t">${title}</span>${right || '<span style="width:44px"></span>'}</div>`;
  const TABS = [["week", "house", "This Week"], ["tapestry", "book", "Tapestry"], ["family", "people", "Family"], ["settings", "gear", "Settings"]];
  const tabbar = (active) => `<nav class="tabbar" aria-label="App sections">${TABS.map(([v, i, l]) => `<button class="tab" data-go="${v}" ${active === v ? 'aria-current="page"' : ""}>${ic(i, 24, 1.8)}<span>${l}</span></button>`).join("")}</nav>`;
  const framed = (f, inner) => `<div class="framed" style="background:${PAT[f]}"><div class="inner">${inner}</div></div>`;
  const checkRow = (ok, text, cls = "") => `<div class="check ${cls}"><span class="tick">${ic(ok && cls !== "warn" ? "check" : cls === "warn" ? "minus" : "x", 14, 3)}</span><span>${text}</span></div>`;
  const tick = `<span style="color:var(--accent)">${ic("check", 22, 2.4)}</span>`;

  /* ---------------- views ---------------- */
  const V = {};

  V.welcome = () => `<div class="welcome">
      <img src="assets/img/coca-cola-script-white.png" alt="Coca-Cola" width="148" height="48">
      <h1 tabindex="-1">Every Coke opens a story.</h1>
      <p>One question a week for your family. Share a glass Coke 2-pack with Lola, ask her, and keep her answer.</p>
      <div class="acts"><button class="btn-white" data-go="setup">Start our family</button><button class="btn-outline-white" data-act="sample-family">Try a sample family</button></div>
      <p class="fine">Student prototype for a BU111 live case. Not affiliated with The Coca-Cola Company. Your stories stay on this phone.</p>
    </div>`;

  V.setup = () => {
    const f = U.form;
    const opt = (v, cur, label) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(label)}</option>`;
    return `${nav("Back", "welcome", "New family")}
    <div class="view"><form id="setup" novalidate>
      <div class="page"><h2 class="title" tabindex="-1">Set up your family</h2><p class="caption mt1">You can change all of this later.</p></div>
      <label class="field"><span>Your first name</span><input class="input" name="youName" autocomplete="given-name" value="${esc(f.youName)}" required><em class="err" data-err="youName"></em></label>
      <label class="field"><span>Family name</span><input class="input" name="fam" autocomplete="family-name" value="${esc(f.fam)}" required><em class="hint">Shown as "the ${esc(f.fam || "Santos")} family"</em><em class="err" data-err="fam"></em></label>
      <div class="group-label">Who tells the stories?</div>
      <div class="row-2">
        <label class="field"><span>You call them</span><select name="called">${CALLED.map((c) => opt(c, f.called, c || "No title")).join("")}</select></label>
        <label class="field"><span>Their first name</span><input class="input" name="tellerName" value="${esc(f.tellerName)}" required><em class="err" data-err="tellerName"></em></label>
      </div>
      <label class="field"><span>They answer in</span><select name="lang">${Object.entries(LANGS).map(([k, l]) => opt(k, f.lang, l)).join("")}</select><em class="hint">Used for the live transcript. Other languages can be typed in.</em></label>
      <div class="footer-actions mt4"><button class="primary" type="submit">Create our tapestry</button></div>
    </form></div>`;
  };

  V.week = () => {
    const w = weekNow(), q = qFor(w), story = D.stories[w], unlocked = D.unlocks[w];
    const [q1, q2] = qPair(q);
    const head = `<div class="page"><div class="eyebrow">Week ${wis(w)} · Season ${seasonOf(w)} · ${fmtDate(mondayFor(w), { weekday: "long", month: "long", day: "numeric" })}</div><h2 class="title" tabindex="-1">This week's question</h2></div>`;
    let body;
    if (story) {
      const ph = pic(story);
      body = `${head}<div class="page mt4"><div class="q-tl">${esc(q1)}</div><div class="q-en">${esc(q2)}</div></div>
        <div style="padding:var(--s5) var(--s4) 0"><button style="display:block;width:100%;text-align:left" data-go="story" data-week="${w}" aria-label="Open ${esc(story.title)}">
          ${framed(story.frame, `${ph ? `<div class="story-photo" style="background-image:url('${ph}')"></div>` : ""}<div style="padding:12px 14px 14px"><div class="quote" style="font-size:1.0625rem">“${esc(story.quote)}”</div><div class="caption mt1">${esc(display(member(story.teller)))} · saved ${fmtDate(story.at)}</div></div>`)}
        </button></div>
        <p class="caption page mt4">Next question arrives ${fmtDate(mondayFor(w + 1), { weekday: "long", month: "long", day: "numeric" })}.</p>`;
    } else if (!unlocked) {
      const free = freeLeft(w);
      body = `${head}
        <div class="lockcard"><div class="lockline"><span style="color:var(--accent)">${ic("lock", 22)}</span><div><div class="heading" style="font-size:1.0625rem">Unlocks with a glass Coke 2-pack</div><div class="caption">One for you, one for ${esc(display(tellers()[0]) || "Lola")}</div></div></div>
          <div class="mt5 qblur" aria-hidden="true"><div class="q-tl">${esc(q1)}</div><div class="q-en">${esc(q2)}</div></div></div>
        <div class="footer-actions mt2"><button class="primary" data-go="code">${ic("receipt", 20)} Enter receipt code</button><button class="secondary" data-go="stores">${ic("pin", 20)} Find a glass 2-pack</button></div>
        <div class="list mt5">${free
          ? `<button class="row" data-act="free"><span class="grow"><span class="r1" style="display:block">Use this month's free question</span><span class="r2" style="display:block">One a month, no purchase needed</span></span><span class="chev">${ic("chev", 18)}</span></button>`
          : `<div class="row"><span class="grow"><span class="r1" style="display:block">Free question used for ${fmtDate(mondayFor(w), { month: "long" })}</span><span class="r2" style="display:block">A new one comes next month</span></span></div>`}</div>`;
    } else {
      const ts = tellers();
      if (!ts.length) return `${nav("", "", "This Week")}<div class="view">${head}<div class="empty"><div class="heading">Add someone to ask</div><p>Add a storyteller in Family first.</p><div class="footer-actions" style="padding:var(--s4) 0 0"><button class="primary" data-go="family">Go to Family</button></div></div></div>${tabbar("week")}`;
      if (!U.teller || !member(U.teller) || member(U.teller).role !== "teller") U.teller = ts[0].id;
      const t = member(U.teller), dr = D.draft && D.draft.week === w ? D.draft : null, n = esc(display(t));
      body = `${head}
        <div class="seg" role="group" aria-label="Question language"><button data-qfirst="tl" aria-pressed="${D.settings.qFirst !== "en"}">Tagalog</button><button data-qfirst="en" aria-pressed="${D.settings.qFirst === "en"}">English</button></div>
        <div class="page mt5"><div class="q-tl">${esc(q1)}</div><div class="q-en">${esc(q2)}</div></div>
        <div class="group-label">Asking</div>
        <div class="list" role="radiogroup" aria-label="Who you're asking">${ts.map((m) => `<button class="row opt" role="radio" aria-checked="${m.id === t.id}" data-act="pick-teller" data-id="${m.id}"><span class="avatar">${esc(initials(m))}</span><span class="grow"><span class="r1" style="display:block">${esc(display(m))}</span><span class="r2" style="display:block">${esc(LANGS[m.lang] || "")}${m.consent ? "" : " · asks for consent first"}</span></span>${m.id === t.id && ts.length > 1 ? tick : ""}</button>`).join("")}</div>
        <div class="footer-actions mt2">
          ${dr ? `<button class="primary" data-act="resume">Continue your draft</button>` : `<button class="primary" data-act="ask">${ic("mic", 20)} Ask ${n} now</button>`}
          <button class="secondary" data-act="send-link">${ic("link", 20)} Send to ${n}'s phone</button>
          <span class="secondary filebtn">${ic("download", 20)} Import ${n}'s recording<input type="file" accept="audio/*,video/*,.m4a,.mp3,.webm,.ogg,.wav,.opus" data-file="import" aria-label="Import ${n}'s recording"></span>
        </div>
        <p class="caption page mt3">Pour two glasses and sit together. If you're apart, send the question to their phone and import the recording they send back.</p>`;
    }
    return `${nav("", "", "This Week")}<div class="view">${body}</div>${tabbar("week")}`;
  };

  V.stores = () => {
    const chains = [["Walmart", "Walmart"], ["Real Canadian Superstore", "Real Canadian Superstore"], ["No Frills", "No Frills"], ["Any store nearby", "grocery store"]];
    return `${nav("This Week", "week", "Find a 2-pack")}
    <div class="view"><div class="page"><h2 class="title" tabindex="-1">Where to buy</h2><p class="caption mt1">Glass Coke 2-packs at the big chains. Opens your maps app.</p></div>
    <div class="list mt4">${chains.map(([n, qy]) => `<a class="row" style="color:inherit;text-decoration:none" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(qy + " near me")}"><span class="muted">${ic("pin", 22, 1.8)}</span><span class="grow r1">${n}</span><span class="chev">${ic("chev", 18)}</span></a>`).join("")}</div>
    <div class="group-label">Look for this card beside the glass Coke</div>
    <div style="margin:0 var(--s4);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;display:flex">
      <div style="background:#E1000A;color:#fff;padding:14px;flex:1"><div style="font:var(--caption);opacity:.9">Week ${wis(weekNow())} · Family question</div><div style="font:750 1.25rem/1.15 var(--font);font-stretch:85%;margin-top:4px">This week's question is waiting.</div></div>
      <div style="padding:14px;font:var(--caption);color:var(--text-secondary);width:44%">Buy a glass Coke 2-pack. Your receipt prints a code for the Coca-Cola app.</div>
    </div>
    <div class="footer-actions mt2"><button class="primary" data-go="code">${ic("receipt", 20)} I have my receipt code</button></div></div>`;
  };

  V.code = () => {
    const c = U.code || (U.code = { value: "", err: "", result: null, sample: null });
    const r = c.result;
    if (r && r.pass) return `${nav("Back", "week", "Receipt code")}
      <div class="view"><div class="page"><h2 class="title" tabindex="-1">Code accepted</h2><p class="caption mt1">${esc(fmtCode(r.code))}</p></div>
      <div class="page mt3" aria-live="polite">${r.checks.map((k) => checkRow(k.ok, esc(k.text))).join("")}</div>
      <div class="footer-actions mt2"><button class="primary" data-act="open-week">Open this week's question</button></div></div>`;
    return `${nav("Back", "week", "Receipt code")}
      <div class="view"><form id="codeform" novalidate>
      <div class="page"><h2 class="title" tabindex="-1">Enter your receipt code</h2><p class="caption mt1">Printed at the bottom of your receipt when you buy a glass Coke 2-pack.</p></div>
      <label class="field"><span>Receipt code</span>
        <input class="input codeinput" id="codein" name="code" value="${esc(c.value)}" inputmode="text" autocomplete="one-time-code" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="14" placeholder="XXXX-XXXX-XXXX" aria-describedby="codehint codeerr" ${c.err ? 'aria-invalid="true"' : ""}>
        <em class="hint" id="codehint">12 letters and numbers. Dashes are added for you.</em><em class="err" id="codeerr" role="alert">${esc(c.err)}</em></label>
      ${r && !r.pass ? `<div class="page mt3" aria-live="polite">${r.checks.map((k) => checkRow(k.ok, esc(k.text), k.ok ? "" : "fail")).join("")}</div>` : ""}
      <div class="footer-actions mt2"><button class="primary" type="submit">Unlock this week's question</button></div>
      </form>
      ${c.sample ? `<div class="group-label">Sample receipt</div>${receiptHTML(c.sample)}<div class="footer-actions" style="padding-top:var(--s3)"><button class="secondary" data-act="fill-code">Fill in this code</button><button class="secondary" data-act="sample-receipt">Print another receipt</button></div>`
        : `<div class="group-label">No receipt with you?</div><div class="list"><button class="row" data-act="sample-receipt"><span class="muted">${ic("receipt", 22, 1.8)}</span><span class="grow"><span class="r1" style="display:block">Show a sample receipt</span><span class="r2" style="display:block">A checkout receipt with a working code</span></span><span class="chev">${ic("chev", 18)}</span></button></div>`}
      <p class="caption page mt4">Each code works once, for 7 days after purchase. In this prototype codes are checked on this phone; in the real app the checkout system and the Coca-Cola app check them together.</p></div>`;
  };
  function receiptHTML(r) {
    const d = new Date(r.at), pad = (n) => String(n).padStart(2, "0");
    const lines = [["BANANAS", "1.29"], ["JASMINE RICE 8KG", "21.97"], ["COKE GLASS 2PK 237ML", "2.79"], ["PANDESAL 12CT", "4.49"]];
    return `<div class="receiptcard" aria-label="Sample receipt">
      <div class="c"><b>${esc(STORES[r.store])}</b><br>WINNIPEG MB<br>${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}</div><hr>
      ${lines.map(([a, b]) => `<div class="ln ${/COKE/.test(a) ? "hit" : ""}"><span>${a}</span><span>${b}</span></div>`).join("")}<hr>
      <div class="ln"><span>SUBTOTAL</span><span>30.54</span></div><div class="ln"><span>GST 5%</span><span>1.53</span></div><div class="ln"><b>TOTAL</b><b>32.07</b></div><hr>
      <div class="codebox"><div>FAMILY QUESTION CODE</div><div class="code">${esc(fmtCode(r.code))}</div><div>Enter in the Coca-Cola app by ${esc(fmtDate(d.getTime() + 7 * DAY, { month: "short", day: "numeric" }).toUpperCase())}</div></div></div>`;
  }
  V.consent = () => {
    const t = member(U.teller), y = you();
    return `${nav("Back", "week", "Consent")}
      <div class="view"><div class="page"><div class="eyebrow">Before the first recording · please hand the phone to ${esc(display(t))}</div>
      <h2 class="title mt2" tabindex="-1">${esc(display(t))}, payag ka ba?</h2>
      <p class="mt4" style="font-size:1.125rem">Ire-record ni ${esc(y.name)} ang sagot mo. Para lang ito sa pamilya ninyo at hindi gagamitin sa ads. Puwede mong ipabura anumang oras.</p>
      <p class="mt3 muted">${esc(y.name)} will record your answer. It's only for your family and never used in ads. You can ask for it to be deleted at any time.</p></div>
      <div class="footer-actions mt4"><button class="primary" data-act="consent-yes">Oo, payag ako · Yes, I agree</button><button class="secondary" data-go="week">Hindi muna · Not now</button></div></div>`;
  };

  V.record = () => {
    const w = weekNow(), q = qFor(w), t = member(D.draft.teller), dr = D.draft, has = !!URLS.da;
    const tl = t.lang !== "en", liveOK = !!SR && !!SR_LANG[t.lang];
    return `${nav("Cancel", "week", `Ask ${esc(display(t))}`)}
      <div class="view"><div class="page"><div class="eyebrow">Week ${wis(w)} · asking ${esc(display(t))}</div><h2 class="title" tabindex="-1">${esc(tl ? q.tl : q.en)}</h2><div class="muted mt1">${esc(tl ? q.en : q.tl)}</div></div>
      <div class="rec" id="recroot">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="timer">${has ? fmt(dr.duration || 0) : "0:00"}</span><span class="caption recstate">${has ? "Saved on this phone" : "Tap to start"}</span></div>
        <div class="bars mt4" aria-hidden="true">${"<i></i>".repeat(32)}</div>
        <button class="recbtn" aria-pressed="false" aria-label="${has ? "Record again" : "Start recording"}"><span></span></button>
        ${liveOK && D.settings.live ? `<div class="live" id="live" aria-live="polite">${has && dr.transcript ? esc(dr.transcript) : '<span class="interim">Her words show up here as she talks.</span>'}</div>` : ""}
        ${has ? `<audio class="mt4" controls src="${URLS.da}" style="width:100%"></audio>` : ""}
      </div>
      ${liveOK ? `<div class="list mt4"><div class="row"><div class="grow"><div class="r1" id="lt">Live transcript</div><div class="r2">${IOS ? "May stop the recording on iPhone. Turn off if it does." : `Your browser's speech service, in ${LANGS[t.lang]}`}</div></div><button class="toggle" role="switch" aria-labelledby="lt" aria-checked="${!!D.settings.live}" data-act="toggle-live"></button></div></div>` : ""}
      <div class="footer-actions">${has ? `<button class="primary" data-go="review">Use this answer</button>` : ""}</div>
      <p class="caption page mt3">${has ? "Tap the red button to record again. " : ""}The recording stays on this phone.</p></div>`;
  };

  V.review = () => {
    const dr = D.draft, t = member(dr.teller), needsTr = t.lang !== "en";
    return `${nav("Back", dr.source === "import" ? "week" : "record", "Her answer")}
      <div class="view"><div class="page"><h2 class="title" tabindex="-1">Check what ${esc(t.called || t.name)} said</h2><p class="caption mt1">${dr.transcript ? "Fix any words the transcript got wrong." : "Type or paste what she said. You can replay the recording here."}</p></div>
      ${URLS.da ? `<div class="page mt3"><audio controls src="${URLS.da}" style="width:100%"></audio></div>` : ""}
      <label class="field"><span>In ${esc(LANGS[t.lang] || "her words")}</span><textarea data-field="transcript" rows="5" placeholder="${needsTr ? "Hal. Tuwing fiesta…" : "e.g. Every fiesta…"}">${esc(dr.transcript || "")}</textarea></label>
      ${needsTr ? `<label class="field"><span>English</span><textarea data-field="translation" rows="5">${esc(dr.translation || "")}</textarea>
        <em class="hint">Translate sends only this text to the free MyMemory service. You can also type it yourself.</em></label>
        <div class="footer-actions" style="padding-top:var(--s3)"><button class="secondary" data-act="translate" ${dr.transcript ? "" : "disabled"}>Translate to English</button></div>` : ""}
      <div class="group-label">Line for the card</div><div id="quotes">${quotesHTML()}</div>
      <label class="field"><span>Story title</span><input class="input" data-field="title" value="${esc(dr.title || "")}"></label>
      <div class="footer-actions mt2"><button class="primary" data-act="to-photo">Next: add a photo</button></div></div>`;
  };
  function quotesHTML() {
    const dr = D.draft, list = sentences(dr.translation || dr.transcript);
    if (!list.length) return `<p class="caption page">Lines from her answer show up here once it's written down.</p>`;
    if (dr.quoteIdx == null || dr.quoteIdx >= list.length) dr.quoteIdx = suggestQuote(list);
    return `<div class="list" role="radiogroup" aria-label="Line for the card">${list.map((s, i) => `<button class="row opt" role="radio" aria-checked="${i === dr.quoteIdx}" data-act="pick-quote" data-i="${i}"><span class="grow r1" style="font-size:1rem">${esc(s)}</span>${i === dr.quoteIdx ? tick : ""}</button>`).join("")}</div>
      <p class="caption page mt2">The suggested line is selected. Tap another to change it.</p>`;
  }
  function draftQuote() {
    const dr = D.draft, en = sentences(dr.translation || dr.transcript), orig = sentences(dr.transcript);
    const i = Math.min(dr.quoteIdx || 0, Math.max(0, en.length - 1));
    return { en: en[i] || "", tl: dr.translation && orig.length === en.length ? orig[i] : "" };
  }

  V.photo = () => {
    const dr = D.draft, ph = photoURL(dr.photo), chosen = ph || dr.photo === "none";
    return `${nav("Back", "review", "Photo")}
      <div class="view"><div class="page"><h2 class="title" tabindex="-1">Add a photo of you two</h2><p class="caption mt1">Best with both glasses in the shot.</p></div>
      <div style="padding:var(--s4) var(--s4) 0">${ph ? `<div class="story-photo" style="border-radius:var(--radius);background-image:url('${ph}')" role="img" aria-label="Chosen photo"></div>`
        : dr.photo === "none" ? `<div class="story-photo" style="border-radius:var(--radius);background-image:url('${sceneURL(dr.week)}')" role="img" aria-label="Illustrated scene for this week's question"></div>`
        : `<div class="viewfinder" style="margin:0;aspect-ratio:16/10;background:var(--surface-sunken)"><div class="placeholder" style="color:var(--text-secondary)">${ic("camera", 36, 1.4)}<div class="mt2">No photo yet</div></div></div>`}</div>
      <div class="footer-actions">
        <span class="${chosen ? "secondary" : "primary"} filebtn">${ic("camera", 20)} ${ph ? "Change photo" : "Take or choose a photo"}<input type="file" accept="image/*" data-file="photo" aria-label="Take or choose a photo"></span>
        ${dr.photo === "sample" ? "" : `<button class="secondary" data-act="sample-photo">Use the sample photo</button>`}
        ${chosen ? `<button class="primary" data-go="frame">Next: choose a frame</button>` : `<button class="secondary" data-act="no-photo">Use an illustrated scene instead</button>`}
      </div></div>`;
  };

  V.frame = () => {
    const dr = D.draft, ph = photoURL(dr.photo) || sceneURL(dr.week), quote = draftQuote();
    return `${nav("Photo", "photo", "Frame")}
      <div class="view"><h2 class="sr-only" tabindex="-1">Choose a frame</h2>
      <div style="padding:var(--s2) var(--s4) 0">${framed(dr.frame, `${ph ? `<div class="story-photo" style="background-image:url('${ph}')"></div>` : ""}<div style="padding:12px 14px 14px"><div class="quote" style="font-size:1.0625rem">“${esc(quote.en)}”</div></div>`)}</div>
      <div class="group-label">Season ${seasonOf(dr.week)} frames by Filipino artists</div>
      <div class="list" role="radiogroup" aria-label="Frames">${FRAMES.map((f) => `<button class="row opt" role="radio" aria-checked="${dr.frame === f.id}" data-act="pick-frame" data-id="${f.id}"><span class="swatch" style="background:${PAT[f.id]}"></span><span class="grow"><span class="r1" style="display:block">${f.name}</span><span class="r2" style="display:block">${f.note}</span></span>${dr.frame === f.id ? tick : ""}</button>`).join("")}</div>
      <div class="footer-actions mt2"><button class="primary" data-act="save-story">Add to tapestry</button></div></div>`;
  };

  V.story = () => {
    const w = U.week, s = D.stories[w]; if (!s) { U.view = "tapestry"; return V.tapestry(); }
    const t = member(s.teller), ph = pic(s), from = U.from === "week" ? "week" : "tapestry";
    return `${nav(from === "week" ? "This Week" : "Tapestry", from, `Week ${wis(w)}`, `<button class="tap" data-go="clip" aria-label="Make a clip to share">${ic("share", 23)}</button>`)}
      <div class="view"><div class="page"><div class="eyebrow">Season ${seasonOf(w)}, week ${wis(w)} · ${fmtDate(mondayFor(w), { month: "long", day: "numeric" })}${s.sample ? " · sample story" : ""}</div><h2 class="title" tabindex="-1">${esc(s.title)}</h2><div class="caption" style="font-size:.9375rem">${esc(display(t) || "Former member")} · ${esc(qFor(w).en)}</div></div>
      <div style="padding:var(--s4) var(--s5) 0">${framed(s.frame, `<div class="story-photo" role="img" aria-label="${photoURL(s.photo) ? "Family photo" : "Illustrated scene for this question"}" style="background-image:url('${ph}')"></div>`)}</div>
      ${ph ? `<div class="page mt3"><div class="quote">“${esc(s.quote)}”</div>${s.quoteTl ? `<div class="muted mt2" style="font-size:.9375rem">“${esc(s.quoteTl)}”</div>` : ""}</div>` : s.quoteTl ? `<div class="page mt3 muted">“${esc(s.quoteTl)}”</div>` : ""}
      ${s.audio && URLS[s.audio] ? `<div class="player page mt4"><button class="play" id="play" aria-label="Play the recording">${PLAY}</button><div style="flex:1"><div class="track"><i id="prog"></i></div><div class="times"><span id="tcur">0:00</span><span id="trem">-${fmt(s.duration || 0)}</span></div></div></div>`
        : `<p class="caption page mt4">${s.sample ? "Sample story: no recording attached." : "No recording saved with this story."}</p>`}
      <details class="more"><summary>Full answer</summary><p>${esc(s.text)}</p>${s.translation ? `<p class="muted">${esc(s.translation)}</p>` : ""}</details>
      <div class="footer-actions mt2"><button class="primary" data-go="clip">${ic("film", 20)} Make a clip to share</button><button class="secondary" data-act="save-card">${ic("download", 20)} Save card as image</button></div>
      <div class="list mt5"><button class="row" data-act="delete-story"><span class="grow r1 danger">Delete this story</span></button></div></div>${tabbar(from)}`;
  };

  V.clip = () => {
    const c = U.clip || {};
    return `${nav("Story", "story", "Clip")}
      <div class="view"><div class="page"><h2 class="title" tabindex="-1">${c.url ? "Your clip is ready" : c.error ? "Couldn't make the clip" : "Making your clip"}</h2><p class="caption mt1">${c.url ? `${c.ext.toUpperCase()} · ${fmt(c.duration)} · vertical, sized for TikTok and Reels` : c.error ? esc(c.error) : "It plays through once while it records. Keep this screen open."}</p></div>
      ${c.error ? "" : `<div class="videobox">${c.url ? `<video src="${c.url}" controls playsinline></video>` : `<canvas id="cliprender" width="720" height="1280" aria-label="Clip preview"></canvas>`}</div>`}
      ${c.url || c.error ? "" : `<div class="page mt3"><div class="progress"><i id="clipbar"></i></div></div>`}
      <div class="footer-actions">${c.url ? `<button class="primary" data-act="share-clip">${ic("share", 20)} Share to TikTok, Reels…</button><button class="secondary" data-act="save-clip">${ic("download", 20)} Save video</button>` : c.error ? `<button class="primary" data-act="retry-clip">Try again</button><button class="secondary" data-act="save-card">Save the card as an image</button>` : ""}</div>
      <p class="caption page mt3">Subtitles: ${{ en: "English", tl: "Tagalog", both: "English and Tagalog" }[D.settings.subs]}. Change in Settings.</p></div>`;
  };

  V.tapestry = () => {
    const w = weekNow(), season = seasonOf(U.season || w), base = (season - 1) * 12;
    const stories = Object.values(D.stories).sort((a, b) => b.week - a.week);
    const inSeason = stories.filter((s) => seasonOf(s.week) === season);
    const squares = Array.from({ length: 12 }, (_, i) => {
      const wk = base + i + 1, s = D.stories[wk];
      if (s) return `<button class="tile ${U.justAdded === wk ? "new" : ""}" style="background:${PAT[s.frame]}" data-go="story" data-week="${wk}" aria-label="Week ${i + 1}: ${esc(s.title)}"><span class="art" style="background-image:url('${pic(s)}')"></span><span class="wk">${i + 1}</span></button>`;
      if (wk === w) return `<button class="slot now" data-go="week" aria-label="Week ${i + 1}: this week, not saved yet"><span>${i + 1}</span></button>`;
      return `<button class="slot" disabled aria-label="Week ${i + 1}: ${wk < w ? "missed" : "coming"}"><span>${i + 1}</span></button>`;
    }).join("");
    U.justAdded = null;
    const seasons = [...new Set([...stories.map((s) => seasonOf(s.week)), seasonOf(w)])].sort((a, b) => a - b);
    return `${nav("", "", "", `<button class="tap" data-act="save-tapestry" aria-label="Save tapestry image">${ic("download", 23)}</button>`)}
      <div class="view"><div class="page"><h2 class="title" style="font-size:2.125rem" tabindex="-1">Tapestry</h2><div class="caption" style="font-size:.9375rem">The ${esc(D.family.name)} family · Season ${season} · ${inSeason.length} of 12 weeks</div></div>
      ${seasons.length > 1 ? `<div class="seg" role="group" aria-label="Season">${seasons.map((n) => `<button data-act="season" data-n="${n}" aria-pressed="${n === season}">Season ${n}</button>`).join("")}</div>` : ""}
      <div class="quilt" role="group" aria-label="${inSeason.length} of 12 squares woven">${squares}</div>
      <div class="group-label">Stories</div>
      ${stories.length ? `<div class="list">${stories.map((s) => `<button class="row" data-go="story" data-week="${s.week}"><span class="swatch framed-sw" style="background:${PAT[s.frame]}"><span style="background-image:url('${pic(s)}')"></span></span><span class="grow"><span class="r1" style="display:block">${esc(s.title)}</span><span class="r2" style="display:block">Season ${seasonOf(s.week)}, week ${wis(s.week)} · ${esc(display(member(s.teller)))}${s.duration ? ` · ${Math.max(1, Math.round(s.duration / 60))} min` : ""}</span></span><span class="chev">${ic("chev", 18)}</span></button>`).join("")}</div>`
        : `<div class="empty"><div class="heading">No squares yet</div><p>Your first square is woven in when you save this week's answer.</p><div class="footer-actions" style="padding:var(--s4) 0 0"><button class="primary" data-go="week">Go to this week</button></div></div>`}
      </div>${tabbar("tapestry")}`;
  };

  V.family = () => {
    const roleText = (m) => m.role === "you" ? "You · asks the questions" : m.role === "teller" ? `Storyteller · ${LANGS[m.lang] || ""} · ${m.consent ? `consent given ${fmtDate(m.consent)}` : "consent not given yet"}` : "Listener";
    return `${nav("", "", "Family")}
      <div class="view"><div class="page"><h2 class="title" style="font-size:2.125rem" tabindex="-1">Family</h2><div class="caption" style="font-size:.9375rem">The ${esc(D.family.name)} family · ${D.members.length} ${D.members.length === 1 ? "person" : "people"}</div></div>
      <div class="list mt4">${D.members.map((m) => `<button class="row" data-act="edit-member" data-id="${m.id}"><span class="avatar">${esc(initials(m))}</span><span class="grow"><span class="r1" style="display:block">${esc(display(m))}</span><span class="r2" style="display:block">${esc(roleText(m))}</span></span><span class="chev">${ic("chev", 18)}</span></button>`).join("")}</div>
      <div class="footer-actions mt2"><button class="secondary" data-act="add-member">${ic("plus", 20)} Add family member</button></div>
      <div class="group-label">Answering from another phone</div>
      <div class="list"><button class="row" data-act="send-link"><span class="muted">${ic("link", 22, 1.8)}</span><span class="grow"><span class="r1" style="display:block">Send this week's question</span><span class="r2" style="display:block">They record on their phone and send it back. No app needed.</span></span><span class="chev">${ic("chev", 18)}</span></button></div></div>${tabbar("family")}`;
  };

  V.settings = () => {
    const w = weekNow(), seg = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${D.settings[key] === v}">${l}</button>`).join("")}</div>`;
    return `${nav("", "", "Settings")}
      <div class="view"><div class="page"><h2 class="title" style="font-size:2.125rem" tabindex="-1">Settings</h2></div>
      <div class="group-label">Show the question first in</div>${seg("qFirst", [["tl", "Tagalog"], ["en", "English"]])}
      <div class="group-label">Clip subtitles</div>${seg("subs", [["en", "English"], ["tl", "Tagalog"], ["both", "Both"]])}
      <div class="group-label">Reminders and app</div>
      <div class="list">
        <button class="row" data-act="ics"><span class="muted">${ic("cal", 22, 1.8)}</span><span class="grow"><span class="r1" style="display:block">Add Monday reminder to calendar</span><span class="r2" style="display:block">Every Monday at 9 am, when the new question arrives</span></span></button>
        <button class="row" data-act="install"><span class="muted">${ic("download", 22, 1.8)}</span><span class="grow"><span class="r1" style="display:block">Add to home screen</span><span class="r2" style="display:block">${installHint()}</span></span></button>
      </div>
      <div class="group-label">Prototype controls</div>
      <div class="list">
        <button class="row" data-act="week+"><span class="grow"><span class="r1" style="display:block">Skip to next Monday</span><span class="r2" style="display:block">Now: season ${seasonOf(w)}, week ${wis(w)}</span></span></button>
        <button class="row" data-act="week-" ${w <= 1 ? "disabled" : ""}><span class="grow r1">Go back a week</span></button>
        <button class="row" data-act="relock" ${D.unlocks[w] && !D.stories[w] ? "" : "disabled"}><span class="grow r1">Lock this week again</span></button>
      </div>
      <div class="group-label">Your family's archive</div>
      <div class="list"><button class="row" data-act="save-tapestry"><span class="grow r1">Save tapestry image</span></button><button class="row" data-act="wipe"><span class="grow r1 danger">Delete our family's archive</span></button></div>
      <p class="caption page mt4">Everything is stored on this phone only. Translation sends text to MyMemory only when you tap Translate. Student prototype for a BU111 live case at Wilfrid Laurier University; not affiliated with, or endorsed by, The Coca-Cola Company. Type: Archivo (SIL Open Font License).</p></div>${tabbar("settings")}`;
  };
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
  const installHint = () => (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone ? "Already on your home screen" : installEvt ? "Install as an app" : IOS ? "In Safari: Share, then Add to Home Screen" : "In your browser menu: Install app");

  /* ---------------- render ---------------- */
  function render(focus = true) {
    cleanups.splice(0).forEach((f) => { try { f(); } catch { /* ignore */ } });
    closeSheet(true);
    screen.innerHTML = V[U.view]();
    const v = $(".view", screen);
    if (v) { v.scrollTop = U.keepScroll != null ? U.keepScroll : 0; U.keepScroll = null; }
    if (focus) { const h = $("[tabindex='-1']", screen); if (h) h.focus({ preventScroll: true }); }
    if (MOUNT[U.view]) MOUNT[U.view]();
  }
  function go(view, extra = {}) { Object.assign(U, extra); U.view = view; render(); }
  function rerender() { const v = $(".view", screen); U.keepScroll = v ? v.scrollTop : null; render(false); }
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2600); }

  const MOUNT = {};
  MOUNT.record = () => {
    const root = $("#recroot"), t = member(D.draft.teller), live = $("#live");
    const r = makeRecorder({
      root, lang: D.settings.live && SR_LANG[t.lang],
      onLive: live ? (fin, interim, note) => { live.innerHTML = note ? `${esc(fin)} <span class="interim">${esc(note)}</span>` : `${esc(fin)} <span class="interim">${esc(interim)}</span>`; } : null,
      onDone: async (blob, secs, text) => {
        await putBlob("da", blob);
        Object.assign(D.draft, { duration: secs, mime: blob.type, transcript: text || "", translation: "", quoteIdx: null, source: "record" });
        await save(); if (U.view === "record") rerender();
      },
    });
    cleanups.push(r.kill);
  };
  MOUNT.story = () => bindPlayer();
  MOUNT.code = () => {
    const form = $("#codeform"); if (!form) return;
    const inp = $("#codein"), err = $("#codeerr");
    inp.addEventListener("input", () => {
      const raw = inp.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 12);
      inp.value = raw.replace(/(.{4})(?=.)/g, "$1-"); U.code.value = inp.value;
      if (U.code.err) { U.code.err = ""; err.textContent = ""; inp.removeAttribute("aria-invalid"); }
    });
    inp.addEventListener("blur", () => { const n = normCode(inp.value); if (n && n.length < 12) { U.code.err = `Codes have 12 characters. This one has ${n.length}.`; err.textContent = U.code.err; inp.setAttribute("aria-invalid", "true"); } });
    form.addEventListener("submit", (e) => {
      e.preventDefault(); const res = checkCode(inp.value);
      if (res.err) { U.code.err = res.err; U.code.result = null; err.textContent = res.err; inp.setAttribute("aria-invalid", "true"); return inp.focus(); }
      U.code.result = res; U.code.value = fmtCode(res.code); rerender();
      if (res.pass) { const b = $("[data-act=open-week]"); if (b) b.focus(); }
    });
  };
  MOUNT.clip = () => { if (!U.clip) startClip(); else if (U.clip.busy) attachClipCanvas(); };
  MOUNT.setup = () => {
    const form = $("#setup");
    form.addEventListener("input", (e) => {
      U.form[e.target.name] = e.target.value;
      if (e.target.name === "fam") $(".hint", e.target.parentNode).textContent = `Shown as "the ${e.target.value || "Santos"} family"`;
      const err = $(`[data-err="${e.target.name}"]`); if (err && e.target.value.trim()) err.textContent = "";
    });
    form.addEventListener("focusout", (e) => { if (e.target.required && !e.target.value.trim()) $(`[data-err="${e.target.name}"]`).textContent = "Add a name to continue"; });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let first = null;
      ["youName", "fam", "tellerName"].forEach((n) => { const el = form.elements[n]; if (!el.value.trim()) { $(`[data-err="${n}"]`).textContent = "Add a name to continue"; first = first || el; } });
      if (first) return first.focus();
      const f = U.form; D = newData({ youName: f.youName.trim(), fam: f.fam.trim(), tellerName: f.tellerName.trim(), called: f.called, lang: f.lang });
      await save(); go("week"); toast(`Welcome, the ${D.family.name} family`);
    });
  };

  /* ---------------- recorder ---------------- */
  const AUDIO_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  const pickMime = (list) => (window.MediaRecorder && MediaRecorder.isTypeSupported ? list.find((t) => MediaRecorder.isTypeSupported(t)) : "") || "";
  const extOf = (mime) => (/mp4|m4a|aac/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : /mpeg|mp3/.test(mime) ? "mp3" : /wav/.test(mime) ? "wav" : "webm");
  function makeRecorder({ root, lang, onLive, onDone }) {
    let rec = null, stream = null, actx = null, raf = 0, t0 = 0, t1 = 0, sr = null, running = false, discard = false, finals = [], timer = 0;
    const bars = $$(".bars i", root), timeEl = $(".timer", root), state = $(".recstate", root), btn = $(".recbtn", root);
    btn.addEventListener("click", () => (running ? stop() : start()));
    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { state.textContent = "Recording isn't supported in this browser."; return; }
      btn.disabled = true;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch { btn.disabled = false; state.textContent = "Microphone is blocked. Allow it in your browser settings and try again."; return; }
      btn.disabled = false;
      const mime = pickMime(AUDIO_TYPES), chunks = [];
      try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); } catch { rec = new MediaRecorder(stream); }
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => { if (discard) return; const blob = new Blob(chunks, { type: (rec.mimeType || mime || "audio/webm").split(";")[0] }); onDone(blob, ((t1 || performance.now()) - t0) / 1000, finals.join(" ").trim()); };
      rec.start(250); running = true; finals = []; t0 = performance.now(); t1 = 0;
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)(); const an = actx.createAnalyser(); an.fftSize = 64;
        actx.createMediaStreamSource(stream).connect(an); const data = new Uint8Array(an.frequencyBinCount);
        const step = () => { an.getByteFrequencyData(data); bars.forEach((b, i) => { b.style.height = `${8 + (data[(i * 2) % data.length] / 255) * 92}%`; }); raf = requestAnimationFrame(step); }; step();
      } catch { /* level meter is optional */ }
      timer = setInterval(() => { timeEl.textContent = fmt((performance.now() - t0) / 1000); }, 250);
      btn.setAttribute("aria-pressed", "true"); btn.setAttribute("aria-label", "Stop recording"); $(".bars", root).classList.add("live"); state.textContent = "Recording · tap to stop";
      if (lang && SR && onLive) startSR();
    }
    function startSR() {
      sr = new SR(); sr.lang = lang; sr.continuous = true; sr.interimResults = true;
      sr.onresult = (e) => { let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finals.push(r[0].transcript.trim()); else interim += r[0].transcript; } onLive(finals.join(" "), interim); };
      sr.onerror = (e) => { if (["not-allowed", "service-not-allowed", "language-not-supported", "network"].includes(e.error)) { onLive(finals.join(" "), "", "Live transcript isn't available here. You can type it on the next screen."); sr = null; } };
      sr.onend = () => { if (running && sr) { try { sr.start(); } catch { /* already running */ } } };
      try { sr.start(); } catch { sr = null; }
    }
    function release() { cancelAnimationFrame(raf); clearInterval(timer); stream && stream.getTracks().forEach((t) => t.stop()); if (actx && actx.state !== "closed") actx.close().catch(() => {}); }
    function stop() {
      running = false; t1 = performance.now(); btn.setAttribute("aria-pressed", "false"); btn.disabled = true; state.textContent = "Saving…";
      cancelAnimationFrame(raf); clearInterval(timer);
      const hadSR = !!sr; try { sr && sr.stop(); } catch { /* */ }
      setTimeout(() => { if (rec && rec.state !== "inactive") rec.stop(); release(); }, hadSR ? 600 : 0);
    }
    return { kill: () => { discard = true; running = false; try { sr && sr.abort(); } catch { /* */ } sr = null; if (rec && rec.state !== "inactive") rec.stop(); release(); } };
  }

  /* ---------------- player ---------------- */
  function bindPlayer() {
    const btn = $("#play"); if (!btn) return;
    const s = D.stories[U.week], a = new Audio(URLS[s.audio]); let dur = s.duration || 0;
    const set = (on) => { btn.innerHTML = on ? PAUSE : PLAY; btn.setAttribute("aria-label", on ? "Pause" : "Play the recording"); };
    a.addEventListener("loadedmetadata", () => { if (isFinite(a.duration) && a.duration > 0) dur = a.duration; });
    a.addEventListener("timeupdate", () => { const d = dur || 1, p = $("#prog"); if (!p) return; p.style.width = `${Math.min(100, (100 * a.currentTime) / d)}%`; $("#tcur").textContent = fmt(a.currentTime); $("#trem").textContent = `-${fmt(Math.max(0, d - a.currentTime))}`; });
    a.addEventListener("ended", () => set(false));
    btn.addEventListener("click", () => { if (a.paused) { a.play().then(() => set(true)).catch(() => toast("Couldn't play this recording")); } else { a.pause(); set(false); } });
    cleanups.push(() => a.pause());
  }

  /* ---------------- receipt codes ----------------
     Format: 12 Crockford base-32 characters, shown as XXXX-XXXX-XXXX.
     [2 purchase day][2 store][6 random][2 check]. The day lets the app enforce the 7-day window,
     the check characters catch typos and made-up codes, and used codes are remembered. */
  const ALPH = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const CODE_EPOCH = Date.UTC(2026, 0, 1), SALT = "coke-tapestries-prototype";
  const STORES = { 101: "WALMART SUPERCENTRE GARDEN CITY", 102: "REAL CANADIAN SUPERSTORE MCPHILLIPS", 103: "NO FRILLS WEST END", 104: "WALMART SUPERCENTRE KENASTON" };
  const STORE_NAMES = { 101: "Walmart, Garden City", 102: "Real Canadian Superstore, McPhillips", 103: "No Frills, West End", 104: "Walmart, Kenaston" };
  const enc = (n, len) => { let out = ""; for (let i = 0; i < len; i++) { out = ALPH[n % 32] + out; n = Math.floor(n / 32); } return out; };
  const dec = (str) => [...str].reduce((n, ch) => n * 32 + ALPH.indexOf(ch), 0);
  const dayNum = (t) => { const d = new Date(t); return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - CODE_EPOCH) / DAY); };
  const dayDate = (n) => { const u = new Date(CODE_EPOCH + n * DAY); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); };
  function check2(body) { let h = 0x811c9dc5; for (const ch of body + SALT) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return enc(h % 1024, 2); }
  const normCode = (s) => String(s).toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  const fmtCode = (s) => normCode(s).replace(/(.{4})(?=.)/g, "$1-");
  function makeCode(at, store) {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPH[b % 32]).join("");
    const body = enc(dayNum(at), 2) + enc(store, 2) + rand; return body + check2(body);
  }
  function checkCode(raw) {
    const code = normCode(raw);
    if (!code) return { err: "Enter the code from your receipt" };
    if ([...code].some((ch) => !ALPH.includes(ch))) return { err: `"${[...code].find((ch) => !ALPH.includes(ch))}" isn't used in codes. Check the receipt again.` };
    if (code.length !== 12) return { err: `Codes have 12 characters. This one has ${code.length}.` };
    const body = code.slice(0, 10);
    if (check2(body) !== code.slice(10)) return { code, pass: false, checks: [{ ok: false, text: "This code doesn't match a receipt. Check for a typo." }] };
    const day = dec(code.slice(0, 2)), store = dec(code.slice(2, 4)), age = dayNum(Date.now()) - day;
    const used = D.receipts.includes(code), fresh = age >= 0 && age <= 7, when = fmtDate(dayDate(day), { month: "short", day: "numeric" });
    const checks = [
      { ok: true, text: `Glass Coke 2-pack bought at ${STORE_NAMES[store] || "a participating store"}` },
      { ok: fresh, text: fresh ? `Bought ${age === 0 ? "today" : when}, within 7 days` : age < 0 ? "This code's date is in the future" : `Bought ${when}. Codes work for 7 days.` },
      { ok: !used, text: used ? "This code was already used" : "Not used before" },
    ];
    return { code, pass: checks.every((c) => c.ok), checks };
  }
  /* ---------------- canvas: card, clip, tapestry image ---------------- */
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const patImgs = {};
  async function pattern(ctx, id, scale) {
    patImgs[id] = patImgs[id] || await loadImg(svgData(PAT_SVG[id]));
    const p = ctx.createPattern(patImgs[id], "repeat"); if (p.setTransform && window.DOMMatrix) p.setTransform(new DOMMatrix().scale(scale)); return p;
  }
  function cover(ctx, img, x, y, w, h, fy = 0.35) { const k = Math.max(w / img.width, h / img.height), sw = w / k, sh = h / k; ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) * fy, sw, sh, x, y, w, h); }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function wrap(ctx, text, maxW) { const lines = []; let line = ""; String(text).split(/\s+/).forEach((w) => { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }); if (line) lines.push(line); return lines; }
  const FONT = "Archivo, 'Helvetica Neue', Arial, sans-serif";
  async function fontsReady() { try { await Promise.all(["800 40px Archivo", "700 40px Archivo", "400 40px Archivo"].map((f) => document.fonts.load(f))); } catch { /* system fallback */ } }

  async function drawCard(s) {
    await fontsReady();
    const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, W, H);
    const logo = await loadImg("assets/img/coca-cola-script-red.png"); x.drawImage(logo, 72, 64, 190, 190 * logo.height / logo.width);
    x.fillStyle = "#5E5E5E"; x.font = `400 28px ${FONT}`; x.textAlign = "right"; x.fillText(`Week ${wis(s.week)} · ${fmtDate(mondayFor(s.week), { month: "long", day: "numeric", year: "numeric" })}`, W - 72, 106); x.textAlign = "left";
    const ph = pic(s), fx = 72, fy = 170, fw = W - 144;
    x.fillStyle = await pattern(x, s.frame, 3);
    if (ph) {
      const img = await loadImg(ph), ih = Math.round((fw - 56) * 0.68);
      rr(x, fx, fy, fw, ih + 56, 20); x.fill(); x.save(); rr(x, fx + 28, fy + 28, fw - 56, ih, 8); x.clip(); cover(x, img, fx + 28, fy + 28, fw - 56, ih); x.restore();
      let y = fy + ih + 56 + 80; x.fillStyle = "#141414"; x.font = `700 56px ${FONT}`;
      wrap(x, `“${s.quote}”`, W - 144).slice(0, 4).forEach((l) => { x.fillText(l, 72, y); y += 66; });
      if (s.quoteTl) { y += 6; x.fillStyle = "#5E5E5E"; x.font = `400 34px ${FONT}`; wrap(x, `“${s.quoteTl}”`, W - 144).slice(0, 2).forEach((l) => { x.fillText(l, 72, y); y += 44; }); }
    } else {
      const bh = 760; rr(x, fx, fy, fw, bh, 20); x.fill(); x.fillStyle = "#FFFFFF"; rr(x, fx + 28, fy + 28, fw - 56, bh - 56, 8); x.fill();
      x.fillStyle = "#141414"; x.font = `700 64px ${FONT}`; const ls = wrap(x, `“${s.quote}”`, fw - 160).slice(0, 7);
      let y = fy + bh / 2 - (ls.length * 76) / 2 + 50; ls.forEach((l) => { x.fillText(l, fx + 80, y); y += 76; });
      if (s.quoteTl) { x.fillStyle = "#5E5E5E"; x.font = `400 34px ${FONT}`; wrap(x, `“${s.quoteTl}”`, fw).slice(0, 2).forEach((l, i) => x.fillText(l, fx, fy + bh + 70 + i * 44)); }
    }
    x.fillStyle = "#141414"; x.font = `700 30px ${FONT}`; x.fillText(display(member(s.teller)), 72, H - 92);
    x.fillStyle = "#5E5E5E"; x.font = `400 28px ${FONT}`; x.fillText(`${s.title} · the ${D.family.name} family tapestry`, 72, H - 52);
    return c;
  }

  async function drawTapestry() {
    await fontsReady();
    const season = seasonOf(U.season || weekNow()), base = (season - 1) * 12;
    const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    x.fillStyle = "#F4EDDD"; x.fillRect(0, 0, W, H);
    const logo = await loadImg("assets/img/coca-cola-script-red.png"); x.drawImage(logo, 72, 64, 170, 170 * logo.height / logo.width);
    x.fillStyle = "#141414"; x.font = `800 76px ${FONT}`; x.fillText(`The ${D.family.name} family`, 72, 230);
    x.fillStyle = "#5E5E5E"; x.font = `400 32px ${FONT}`; x.fillText(`Tapestry · Season ${season}`, 72, 280);
    const g = 12, cols = 4, size = (W - 144 - g * (cols - 1)) / cols;
    for (let i = 0; i < 12; i++) {
      const s = D.stories[base + i + 1], cx = 72 + (i % cols) * (size + g), cy = 330 + Math.floor(i / cols) * (size + g);
      if (!s) { x.strokeStyle = "#CDBE9C"; x.setLineDash([8, 6]); x.lineWidth = 2; rr(x, cx + 2, cy + 2, size - 4, size - 4, 6); x.stroke(); x.setLineDash([]);
        x.fillStyle = "#B8A98A"; x.font = `600 28px ${FONT}`; x.textAlign = "center"; x.fillText(String(i + 1), cx + size / 2, cy + size / 2 + 10); x.textAlign = "left"; continue; }
      x.fillStyle = await pattern(x, s.frame, 4); rr(x, cx, cy, size, size, 6); x.fill();
      const art = await loadImg(pic(s)); x.save(); rr(x, cx + 14, cy + 14, size - 28, size - 28, 3); x.clip(); cover(x, art, cx + 14, cy + 14, size - 28, size - 28, 0.4); x.restore();
      x.fillStyle = "rgba(255,255,255,.92)"; rr(x, cx + 22, cy + size - 62, size - 44, 38, 5); x.fill(); x.fillStyle = "#141414"; let fs = 20; x.font = `600 ${fs}px ${FONT}`;
      while (x.measureText(s.title).width > size - 64 && fs > 14) { fs--; x.font = `600 ${fs}px ${FONT}`; }
      let label = s.title; while (x.measureText(label).width > size - 64 && label.length > 4) label = label.slice(0, -2) + "…";
      x.fillText(label, cx + 32, cy + size - 37);
    }
    const n = Object.values(D.stories).filter((s) => seasonOf(s.week) === season).length;
    x.font = `400 28px ${FONT}`; x.fillStyle = "#5E5E5E"; x.fillText(`${n} of 12 weeks woven · ${tellers().map(display).join(", ")}`, 72, 330 + 3 * (size + g) + 60);
    return c;
  }

  /* clip: plays through in real time while MediaRecorder captures the canvas and the saved audio */
  const VIDEO_TYPES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4;codecs=avc1", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  let clipCanvasSrc = null;
  function attachClipCanvas() {
    const cv = $("#cliprender"); if (!cv || !clipCanvasSrc) return; const ctx = cv.getContext("2d");
    const loop = () => { if (!document.contains(cv) || !clipCanvasSrc) return; ctx.drawImage(clipCanvasSrc, 0, 0); requestAnimationFrame(loop); }; loop();
  }
  async function startClip() {
    const s = D.stories[U.week]; U.clip = { busy: true, week: U.week };
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { U.clip = { error: "This browser can't make video. Try Chrome or Safari on your phone, or save the card as an image.", week: s.week }; return rerender(); }
    let actx = null;
    try {
      await fontsReady();
      const W = 720, H = 1280, cv = document.createElement("canvas"); cv.width = W; cv.height = H; clipCanvasSrc = cv;
      const x = cv.getContext("2d"), bg = document.createElement("canvas"); bg.width = W; bg.height = H; const b = bg.getContext("2d");
      const ph = pic(s), img = ph ? await loadImg(ph) : null, logo = await loadImg("assets/img/coca-cola-script-white.png");
      b.fillStyle = "#111"; b.fillRect(0, 0, W, H);
      if (img) { const t = document.createElement("canvas"); t.width = 24; t.height = 42; cover(t.getContext("2d"), img, 0, 0, 24, 42, 0.4); b.imageSmoothingQuality = "high"; b.drawImage(t, 0, 0, W, H); b.fillStyle = "rgba(0,0,0,.55)"; b.fillRect(0, 0, W, H); }
      b.drawImage(logo, 40, 64, 150, 150 * logo.height / logo.width);
      b.fillStyle = "#fff"; b.font = `700 30px ${FONT}`; b.fillText(s.title, 40, 176);
      b.font = `400 22px ${FONT}`; b.fillStyle = "rgba(255,255,255,.82)"; const ql = wrap(b, qFor(s.week).en, W - 80).slice(0, 2); ql.forEach((l, i) => b.fillText(l, 40, 210 + i * 28));
      const fx = 40, fy = 236 + ql.length * 28, fw = W - 80; b.fillStyle = await pattern(b, s.frame, 2);
      let capY;
      if (img) { const ih = Math.round((fw - 32) * 0.8); rr(b, fx, fy, fw, ih + 32, 14); b.fill(); b.save(); rr(b, fx + 16, fy + 16, fw - 32, ih, 6); b.clip(); cover(b, img, fx + 16, fy + 16, fw - 32, ih); b.restore(); capY = fy + ih + 100; }
      else { rr(b, fx, fy, fw, 420, 14); b.fill(); b.fillStyle = "#fff"; rr(b, fx + 16, fy + 16, fw - 32, 388, 6); b.fill(); b.fillStyle = "#141414"; b.font = `700 40px ${FONT}`; let yy = fy + 110; wrap(b, `“${s.quote}”`, fw - 96).slice(0, 6).forEach((l) => { b.fillText(l, fx + 48, yy); yy += 50; }); capY = fy + 510; }
      b.fillStyle = "rgba(255,255,255,.82)"; b.font = `400 22px ${FONT}`; b.fillText(`${display(member(s.teller))} · the ${D.family.name} family`, 40, H - 60);
      const en = sentences(s.translation || s.text), tl = s.translation ? sentences(s.text) : [], mode = D.settings.subs;
      const caps = en.map((e, i) => ({ en: mode === "tl" && tl.length ? "" : e, tl: mode !== "en" && tl.length ? tl[Math.min(tl.length - 1, Math.round((i * tl.length) / en.length))] : "" }));
      if (!caps.length) caps.push({ en: s.quote, tl: s.quoteTl || "" });
      let buf = null;
      if (s.audio) { try { const blob = await DB.get(s.audio, "blobs"); actx = new (window.AudioContext || window.webkitAudioContext)(); buf = await actx.decodeAudioData(await blob.arrayBuffer()); } catch { buf = null; toast("Couldn't read the audio, so the clip is silent"); } }
      const duration = Math.min(90, buf ? buf.duration : Math.max(6, caps.length * 3.2));
      const weights = caps.map((c) => Math.max(12, (c.en || c.tl).length)), total = weights.reduce((a, v) => a + v, 0), ends = [];
      weights.reduce((acc, wt, i) => (ends[i] = acc + (wt / total) * duration), 0);
      const draw = (t) => {
        x.drawImage(bg, 0, 0); const i = ends.findIndex((e) => t < e), c = caps[i < 0 ? caps.length - 1 : i]; let y = capY; x.textAlign = "center";
        if (c.en) { x.font = `700 36px ${FONT}`; wrap(x, c.en, W - 120).slice(0, 3).forEach((l) => { const mw = x.measureText(l).width + 28; x.fillStyle = "rgba(0,0,0,.62)"; rr(x, (W - mw) / 2, y - 36, mw, 50, 8); x.fill(); x.fillStyle = "#fff"; x.fillText(l, W / 2, y); y += 56; }); }
        if (c.tl) { y += 6; x.font = `400 26px ${FONT}`; wrap(x, c.tl, W - 140).slice(0, 2).forEach((l) => { const mw = x.measureText(l).width + 22; x.fillStyle = "rgba(0,0,0,.5)"; rr(x, (W - mw) / 2, y - 27, mw, 38, 6); x.fill(); x.fillStyle = "#fff"; x.fillText(l, W / 2, y); y += 44; }); }
        x.textAlign = "left"; x.fillStyle = "rgba(255,255,255,.3)"; x.fillRect(0, H - 6, W, 6); x.fillStyle = "#fff"; x.fillRect(0, H - 6, W * Math.min(1, t / duration), 6);
      };
      draw(0); if (U.view === "clip") rerender();
      const tracks = [...cv.captureStream(30).getVideoTracks()]; let src = null;
      if (buf) { const dest = actx.createMediaStreamDestination(); src = actx.createBufferSource(); src.buffer = buf; src.connect(dest); tracks.push(...dest.stream.getAudioTracks()); }
      const mime = pickMime(VIDEO_TYPES), chunks = [];
      let mr; try { mr = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime, videoBitsPerSecond: 3000000 } : undefined); } catch { mr = new MediaRecorder(new MediaStream(tracks)); }
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const done = new Promise((res) => { mr.onstop = res; });
      mr.start(500); if (src) src.start(); const t0 = performance.now(); let raf = 0;
      const frame = () => { const t = (performance.now() - t0) / 1000; draw(t); const bar = $("#clipbar"); if (bar) bar.style.width = `${Math.min(100, (t / duration) * 100)}%`; if (t >= duration) { if (mr.state === "recording") mr.stop(); } else raf = requestAnimationFrame(frame); };
      const bgTick = setInterval(() => { if (document.hidden) frame(); }, 100);
      frame(); await done; clearInterval(bgTick); cancelAnimationFrame(raf);
      const type = (mr.mimeType || mime || "video/webm").split(";")[0], blob = new Blob(chunks, { type });
      U.clip = { url: URL.createObjectURL(blob), blob, ext: /mp4/.test(type) ? "mp4" : "webm", duration, week: s.week };
    } catch { U.clip = { error: "Something went wrong making the clip. Try again, or save the card as an image.", week: s.week }; }
    if (actx && actx.state !== "closed") actx.close().catch(() => {});
    clipCanvasSrc = null; if (U.view === "clip") rerender();
  }

  async function shareOrDownload(blob, name, { title, text } = {}) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title, text }); return "shared"; } catch (e) { if (e.name === "AbortError") return "cancelled"; }
    }
    download(blob, name); return "downloaded";
  }
  function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  const canvasBlob = (c, type = "image/png") => new Promise((res) => c.toBlob(res, type, 0.92));
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "story";

  /* ---------------- sheets and dialogs ---------------- */
  let sheetResolve = null, lastFocus = null;
  function openSheet(html, mount) {
    lastFocus = document.activeElement;
    layer.innerHTML = `<div class="scrim" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    void layer.offsetHeight; layer.classList.add("open");
    if (mount) mount($(".sheet", layer));
    setTimeout(() => { const f = $(".sheet input, .sheet select, .sheet textarea", layer) || $(".sheet .primary", layer); if (f) f.focus(); }, 60);
  }
  function closeSheet(silent) {
    if (!layer.classList.contains("open")) return;
    layer.classList.remove("open"); if (sheetResolve) { const r = sheetResolve; sheetResolve = null; r(false); }
    setTimeout(() => { if (!layer.classList.contains("open")) layer.innerHTML = ""; }, 340);
    if (!silent && lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  const sheetHead = (title) => `<div class="sheet-head"><div style="flex:1"><div class="heading">${esc(title)}</div></div><button class="tap" data-act="close-sheet" aria-label="Close" style="color:var(--text-secondary)">${ic("x", 20, 2.2)}</button></div>`;
  function confirmSheet({ title, body, confirm, typed }) {
    return new Promise((res) => {
      openSheet(`${sheetHead(title)}<p class="page mt3">${esc(body)}</p>
        ${typed ? `<label class="field"><span>Type "${esc(typed)}" to confirm</span><input class="input" id="typed" autocomplete="off" autocapitalize="off"></label>` : ""}
        <div class="footer-actions mt2"><button class="primary" id="ok" ${typed ? "disabled" : ""}>${esc(confirm)}</button><button class="secondary" data-act="close-sheet">Cancel</button></div>`, (sh) => {
        const ok = $("#ok", sh), inp = $("#typed", sh);
        if (inp) inp.addEventListener("input", () => { ok.disabled = inp.value.trim().toLowerCase() !== typed.toLowerCase(); });
        ok.addEventListener("click", () => { sheetResolve = null; closeSheet(true); res(true); });
      });
      sheetResolve = res;
    });
  }
  function memberSheet(m) {
    const isNew = !m; m = m || { id: uid(), name: "", called: "", role: "listener", lang: "fil" };
    const opt = (v, cur, l) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
    openSheet(`${sheetHead(isNew ? "Add family member" : display(m))}
      <form id="mform" novalidate>
      <div class="row-2"><label class="field"><span>Title</span><select name="called">${CALLED.map((c) => opt(c, m.called, c || "None")).join("")}</select></label>
      <label class="field"><span>First name</span><input class="input" name="name" value="${esc(m.name)}" required><em class="err" data-err="name"></em></label></div>
      ${m.role === "you" ? "" : `<label class="field"><span>Role</span><select name="role">${opt("teller", m.role, "Storyteller (answers questions)")}${opt("listener", m.role, "Listener")}</select></label>
      <label class="field"><span>Answers in</span><select name="lang">${Object.entries(LANGS).map(([k, l]) => opt(k, m.lang || "fil", l)).join("")}</select></label>`}
      ${!isNew && m.role === "teller" ? `<div class="list mt4"><div class="row"><div class="grow"><div class="r1">${m.consent ? `Consent given ${fmtDate(m.consent, { month: "long", day: "numeric", year: "numeric" })}` : "Consent not given yet"}</div><div class="r2">${m.consent ? "They can withdraw it at any time" : "Asked before their first recording"}</div></div>${m.consent ? `<button type="button" class="linkish" data-act="withdraw" data-id="${m.id}">Withdraw</button>` : ""}</div></div>` : ""}
      <div class="footer-actions mt4"><button class="primary" type="submit">${isNew ? "Add to family" : "Save changes"}</button>${!isNew && m.role !== "you" ? `<button type="button" class="secondary danger" data-act="remove-member" data-id="${m.id}">Remove from family</button>` : ""}</div>
      </form>`, (sh) => {
      $("#mform", sh).addEventListener("submit", async (e) => {
        e.preventDefault(); const f = e.target;
        if (!f.elements.name.value.trim()) { $("[data-err=name]", sh).textContent = "Add a name to continue"; return f.elements.name.focus(); }
        m.name = f.elements.name.value.trim(); m.called = f.elements.called.value;
        if (f.elements.role) { m.role = f.elements.role.value; m.lang = f.elements.lang.value; if (m.role === "teller" && m.consent === undefined) m.consent = null; }
        if (isNew) D.members.push(m);
        await save(); closeSheet(true); rerender(); toast(isNew ? `${display(m)} added` : "Saved");
      });
    });
  }

  /* ---------------- family link (answer from another phone) ---------------- */
  const b64u = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64u = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
  async function sendLink() {
    const w = weekNow(); if (!D.unlocks[w]) { toast("Unlock this week's question first"); return go("week"); }
    const t = member(U.teller) && member(U.teller).role === "teller" ? member(U.teller) : tellers()[0]; if (!t) return toast("Add a storyteller first");
    const q = qFor(w), payload = { w: wis(w), tl: q.tl, en: q.en, to: display(t), from: you().name, lang: t.lang };
    const url = `${location.origin}${location.pathname}#ask=${b64u(JSON.stringify(payload))}`;
    const text = `${display(t)}, may tanong ako sa iyo ngayong linggo: ${t.lang === "en" ? q.en : q.tl}`;
    if (navigator.share) { try { await navigator.share({ title: "This week's question", text, url }); return; } catch (e) { if (e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); toast("Link copied. Paste it in Messenger or WhatsApp."); }
    catch { openSheet(`${sheetHead("Copy this link")}<label class="field"><span>Link for ${esc(display(t))}</span><textarea rows="4" readonly>${esc(url)}</textarea></label><div class="footer-actions"><button class="secondary" data-act="close-sheet">Done</button></div>`); }
  }
  function lolaView(p) {
    document.title = `${p.from} is asking you · Coca-Cola`;
    const first = p.lang === "en" ? p.en : p.tl, second = p.lang === "en" ? p.tl : p.en;
    screen.innerHTML = `<div class="lola">
      <img class="logo-light" src="assets/img/coca-cola-script-red.png" alt="Coca-Cola" width="112" height="36"><img class="logo-dark" src="assets/img/coca-cola-script-white.png" alt="Coca-Cola" width="112" height="36">
      <div class="hi" tabindex="-1">Hi ${esc(p.to)}! ${esc(p.from)} is asking you:</div>
      <div class="ask">${esc(first)}</div><div class="ask-en">${esc(second)}</div>
      <div id="lrec"><div class="timer">0:00</div><div class="state recstate">Tap the red button and answer. Tap it again when you're done.</div>
        <div class="bars mt4" aria-hidden="true">${"<i></i>".repeat(24)}</div>
        <button class="recbtn" aria-pressed="false" aria-label="Start recording"><span></span></button></div>
      <div id="lafter"></div>
      <p class="caption mt8">Your answer only goes to ${esc(p.from)}, from your phone. This page doesn't upload anything.</p></div>`;
    $(".hi", screen).focus();
    makeRecorder({ root: $("#lrec"), onDone: (blob, secs) => {
      const url = URL.createObjectURL(blob), btn = $("#lrec .recbtn");
      btn.disabled = false; btn.setAttribute("aria-label", "Record again");
      $(".recstate").textContent = `Recorded ${fmt(secs)}. Listen, then send it.`;
      $("#lafter").innerHTML = `<audio controls src="${url}" style="width:100%;margin-top:var(--s5)"></audio>
        <div class="footer-actions" style="padding:var(--s5) 0 0"><button class="primary big" id="lsend">Send to ${esc(p.from)}</button></div>
        <p class="caption mt3">Want to try again? Tap the red button.</p>`;
      $("#lsend").addEventListener("click", async () => {
        const res = await shareOrDownload(blob, `${slug(p.to)}-answer-week-${p.w}.${extOf(blob.type)}`, { title: `Answer for ${p.from}`, text: `Sagot ko para kay ${p.from}` });
        if (res === "downloaded") $(".recstate").textContent = `Saved to your phone. Send the file to ${p.from} in Messenger or WhatsApp.`;
        if (res === "shared") $(".recstate").textContent = `Sent. Salamat, ${p.to}!`;
      });
    } });
  }

  /* ---------------- calendar reminder ---------------- */
  function icsFile() {
    const d = mondayOf(Date.now() + 7 * DAY), pad = (n) => String(n).padStart(2, "0");
    const dt = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T090000`;
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""), url = `${location.origin}${location.pathname}`;
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Coke Tapestries prototype//EN", "BEGIN:VEVENT", `UID:coke-tapestries-${uid()}@prototype`, `DTSTAMP:${stamp}`, `DTSTART:${dt}`, "DURATION:PT15M", "RRULE:FREQ=WEEKLY;BYDAY=MO",
      `SUMMARY:New family question for ${tellers()[0] ? display(tellers()[0]) : "Lola"}`, `DESCRIPTION:This week's question is ready. ${url}`, `URL:${url}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  }

  /* ---------------- draft ---------------- */
  async function startDraft(source) {
    const w = weekNow();
    if (D.draft && D.draft.week !== w) await clearDraft();
    if (!D.draft) D.draft = { week: w, teller: U.teller, frame: "parol", photo: null, transcript: "", translation: "", title: qFor(w).short, quoteIdx: null, source };
    D.draft.teller = U.teller; D.draft.source = source; await save();
  }
  async function clearDraft() { await dropBlob("da"); await dropBlob("dp"); D.draft = null; await save(); }
  function needConsent(next) { const t = member(U.teller); if (t && !t.consent) { U.after = next; go("consent"); return true; } return false; }
  async function saveStory() {
    const dr = D.draft, w = dr.week, q = draftQuote();
    if (!q.en) { toast("Add what she said first"); return go("review"); }
    const s = { week: w, teller: dr.teller, title: (dr.title || qFor(w).short).trim(), text: dr.transcript.trim(), translation: (dr.translation || "").trim(),
      quote: q.en, quoteTl: q.tl || "", frame: dr.frame, photo: null, audio: null, duration: dr.duration || 0, at: new Date().toISOString() };
    const ab = await DB.get("da", "blobs"); if (ab) { await putBlob(`a${w}`, ab); s.audio = `a${w}`; }
    if (dr.photo === "dp") { const pb = await DB.get("dp", "blobs"); if (pb) { await putBlob(`p${w}`, pb); s.photo = `p${w}`; } } else if (dr.photo === "sample") s.photo = "sample";
    D.stories[w] = s; await clearDraft();
    U.justAdded = w; U.season = w; go("tapestry"); toast("Woven into your tapestry");
  }

  /* ---------------- events ---------------- */
  const app = $("#app");
  app.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-go],[data-act],[data-qfirst],[data-set]"); if (!el || el.disabled) return;
    if (el.dataset.go) {
      const to = el.dataset.go, extra = {};
      if (el.dataset.week) extra.week = +el.dataset.week;
      if (to === "story" && U.view !== "clip" && U.view !== "story") extra.from = U.view === "week" ? "week" : "tapestry";
      if (to === "code") U.code = null;
      if (to === "clip" && U.clip && !U.clip.busy && (U.clip.week !== (extra.week || U.week) || U.clip.error)) U.clip = null;
      if (to === "tapestry" && U.view !== "story") U.season = null;
      if (to === "week" && U.view === "record" && !URLS.da) await clearDraft();
      return go(to, extra);
    }
    if (el.dataset.qfirst) { D.settings.qFirst = el.dataset.qfirst; await save(); return rerender(); }
    if (el.dataset.set) { D.settings[el.dataset.set] = el.dataset.v; await save(); return rerender(); }
    const id = el.dataset.id, w = D ? weekNow() : 0;
    switch (el.dataset.act) {
      case "close-sheet": return closeSheet();
      case "sample-family": D = newData({ youName: "Migs", fam: "Rosa", tellerName: "Rosa", called: "Lola", lang: "fil", sample: true }); await save(); go("week"); return toast("Sample family loaded: the Rosas");
      case "free": D.free[monthKey(w)] = w; D.unlocks[w] = { how: "free", at: new Date().toISOString() }; await save(); rerender(); return toast("This week's question is open");
      case "sample-receipt": { const at = Date.now(), store = 101 + Math.floor(Math.random() * 4); U.code.sample = { at, store, code: makeCode(at, store) }; U.code.result = null; U.code.err = ""; await rerender(); const rc = $(".receiptcard"); if (rc) rc.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
      case "fill-code": U.code.value = fmtCode(U.code.sample.code); U.code.err = ""; U.code.result = null; rerender(); { const ci = $("#codein"); if (ci) { ci.focus({ preventScroll: true }); ci.scrollIntoView({ block: "center" }); } } return;
      case "open-week": D.receipts.push(U.code.result.code); D.unlocks[w] = { how: "code", code: U.code.result.code, at: new Date().toISOString() }; U.code = null; await save(); go("week"); return toast("Unlocked. Time to ask.");
      case "pick-teller": U.teller = id; return rerender();
      case "ask": if (needConsent("record")) return; await startDraft("record"); return go("record");
      case "resume": U.teller = D.draft.teller; return go(URLS.da || D.draft.transcript ? "review" : "record");
      case "consent-yes": { member(U.teller).consent = new Date().toISOString(); await save(); toast("Consent saved"); if (U.after === "record") { await startDraft("record"); return go("record"); } return go("week"); }
      case "send-link": return sendLink();
      case "toggle-live": D.settings.live = !D.settings.live; await save(); return rerender();
      case "translate": return translate(el);
      case "pick-quote": { D.draft.quoteIdx = +el.dataset.i; await save(); $("#quotes").innerHTML = quotesHTML(); const b = $(`#quotes [data-i="${el.dataset.i}"]`); return b && b.focus(); }
      case "to-photo": if (!sentences(D.draft.transcript).length) { toast("Add what she said first"); const ta = $("textarea[data-field=transcript]"); return ta && ta.focus(); } return go("photo");
      case "sample-photo": D.draft.photo = "sample"; await save(); return rerender();
      case "no-photo": D.draft.photo = "none"; await save(); return rerender();
      case "pick-frame": D.draft.frame = id; await save(); return rerender();
      case "save-story": return saveStory();
      case "save-card": { const s = D.stories[U.week]; toast("Making the card…"); const r = await shareOrDownload(await canvasBlob(await drawCard(s)), `${slug(s.title)}.png`, { title: s.title }); return r === "downloaded" && toast("Card saved"); }
      case "save-clip": { const c = U.clip; download(c.blob, `${slug(D.stories[c.week].title)}.${c.ext}`); return toast("Video saved"); }
      case "share-clip": { const c = U.clip, s = D.stories[c.week]; const r = await shareOrDownload(c.blob, `${slug(s.title)}.${c.ext}`, { title: s.title, text: "#cocacola #lola #coketapestries" }); return r === "downloaded" && toast("Sharing isn't available here, so the video was saved"); }
      case "retry-clip": U.clip = null; return rerender();
      case "delete-story": {
        const s = D.stories[U.week]; if (!(await confirmSheet({ title: `Delete "${s.title}"?`, body: "The recording, photo and words for this week are removed from this phone. This can't be undone.", confirm: "Delete story" }))) return;
        if (s.audio) await dropBlob(s.audio); if (s.photo && s.photo.startsWith("p")) await dropBlob(s.photo); delete D.stories[U.week]; await save(); go("tapestry"); return toast("Story deleted");
      }
      case "season": U.season = (+el.dataset.n - 1) * 12 + 1; return rerender();
      case "save-tapestry": { toast("Making the image…"); const r = await shareOrDownload(await canvasBlob(await drawTapestry()), `${slug(D.family.name)}-tapestry.png`, { title: `The ${D.family.name} family tapestry` }); return r === "downloaded" && toast("Tapestry image saved"); }
      case "edit-member": return memberSheet(member(id));
      case "add-member": return memberSheet(null);
      case "withdraw": { const m = member(id); m.consent = null; await save(); closeSheet(true); rerender(); return toast(`Consent withdrawn for ${display(m)}`); }
      case "remove-member": {
        const m = member(id); closeSheet(true);
        if (!(await confirmSheet({ title: `Remove ${display(m)}?`, body: "Their saved stories stay in the tapestry. You can add them back later.", confirm: "Remove from family" }))) return;
        D.members = D.members.filter((x) => x.id !== id); await save(); rerender(); return toast("Removed");
      }
      case "ics": download(new Blob([icsFile()], { type: "text/calendar" }), "coke-tapestries-monday.ics"); return toast("Open the file to add it to your calendar");
      case "install": if (installEvt) { installEvt.prompt(); installEvt = null; return; } return toast(installHint());
      case "week+": D.family.offset = (D.family.offset || 0) + 1; await save(); go("week"); return toast(`It's Monday of week ${wis(weekNow())}`);
      case "week-": D.family.offset = (D.family.offset || 0) - 1; await save(); return rerender();
      case "relock": delete D.unlocks[w]; Object.keys(D.free).forEach((k) => { if (D.free[k] === w) delete D.free[k]; }); await save(); return rerender();
      case "wipe": {
        if (!(await confirmSheet({ title: "Delete your family's archive?", body: "Every story, recording and photo is removed from this phone. This can't be undone.", confirm: "Delete everything", typed: D.family.name }))) return;
        await DB.clear(); Object.keys(URLS).forEach((k) => { URL.revokeObjectURL(URLS[k]); delete URLS[k]; }); D = null; U = { view: "welcome", form: blankForm() }; render(); return toast("Archive deleted");
      }
    }
  });
  app.addEventListener("change", async (e) => {
    const inp = e.target; if (!inp.dataset || !inp.dataset.file || !inp.files || !inp.files[0]) return;
    const file = inp.files[0]; inp.value = "";
    if (inp.dataset.file === "photo") {
      try {
        const img = await loadImg(URL.createObjectURL(file)), k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src);
        await putBlob("dp", await canvasBlob(c, "image/jpeg")); D.draft.photo = "dp"; await save(); return rerender();
      } catch { return toast("Couldn't open that photo. Try another."); }
    }
    if (inp.dataset.file === "import") {
      if (needConsent("import")) return toast("Consent first, then import the recording again");
      await startDraft("import"); await putBlob("da", file);
      Object.assign(D.draft, { mime: file.type, duration: 0, quoteIdx: null }); await save();
      const a = new Audio(URLS.da); a.addEventListener("loadedmetadata", () => { if (isFinite(a.duration) && D.draft) { D.draft.duration = a.duration; save(); } });
      go("review"); return toast("Recording imported");
    }
  });
  app.addEventListener("input", (e) => {
    const f = e.target.dataset && e.target.dataset.field; if (!f || !D || !D.draft) return;
    D.draft[f] = e.target.value; clearTimeout(app.st); app.st = setTimeout(save, 300);
    if (f === "transcript") { const b = $("[data-act=translate]"); if (b) b.disabled = !e.target.value.trim(); }
  });
  app.addEventListener("focusout", (e) => {
    const f = e.target.dataset && e.target.dataset.field;
    if ((f === "transcript" || f === "translation") && $("#quotes")) { D.draft.quoteIdx = null; $("#quotes").innerHTML = quotesHTML(); save(); }
  });
  document.addEventListener("keydown", (e) => {
    if (!layer.classList.contains("open")) return;
    if (e.key === "Escape") return closeSheet();
    if (e.key === "Tab") {
      const f = $$(".sheet button, .sheet input, .sheet select, .sheet textarea", layer).filter((x) => !x.disabled); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  async function translate(btn) {
    const text = (D.draft.transcript || "").trim(); if (!text) return;
    btn.disabled = true; btn.textContent = "Translating…";
    try {
      const chunks = []; let cur = "";
      sentences(text).forEach((s) => { if (cur && (cur + " " + s).length > 450) { chunks.push(cur); cur = s; } else cur = cur ? `${cur} ${s}` : s; }); if (cur) chunks.push(cur);
      const out = [];
      for (const c of chunks) {
        const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(c)}&langpair=tl|en`), j = await r.json();
        if (!r.ok || !j.responseData || Number(j.responseStatus) !== 200) throw new Error("translate");
        const tmp = document.createElement("textarea"); tmp.innerHTML = j.responseData.translatedText; out.push(tmp.value);
      }
      D.draft.translation = out.join(" "); D.draft.quoteIdx = null; await save(); rerender(); toast("Translated. Check that it reads right.");
    } catch { btn.disabled = false; btn.textContent = "Translate to English"; toast("Translation isn't available right now. You can type it instead."); }
  }

  /* ---------------- boot ---------------- */
  const blankForm = () => ({ youName: "", fam: "", tellerName: "", called: "Lola", lang: "fil" });
  function desktopAside() {
    // Always advertise the public link, even when the page is opened at an older address.
    const PUBLIC_URL = "https://coke-tapestries.vercel.app/";
    const url = /\.vercel\.app$/.test(location.hostname) ? PUBLIC_URL : `${location.origin}${location.pathname}`;
    const el = $("#qr"); if (el && window.qrcode) { const q = window.qrcode(0, "M"); q.addData(url); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
    const u = $("#url"); if (u && !/^(localhost|127\.)/.test(location.hostname)) u.textContent = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const clock = () => { const c = $("#clock"); if (c) c.textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M/i, ""); };
    clock(); setInterval(clock, 30000);
  }
  async function boot() {
    desktopAside();
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
    const m = location.hash.match(/^#ask=(.+)$/);
    if (m) { try { return lolaView(JSON.parse(unb64u(m[1]))); } catch { /* not a valid link: open the app */ } }
    try { D = await DB.get("data"); } catch { D = null; }
    if (D) {
      await Promise.all(Object.values(D.stories).flatMap((s) => [loadURL(s.audio), s.photo && s.photo !== "sample" ? loadURL(s.photo) : null]));
      if (D.draft) { if (D.draft.week !== weekNow()) await clearDraft(); else { await loadURL("da"); await loadURL("dp"); } }
      U = { view: "week" };
    } else U = { view: "welcome", form: blankForm() };
    render(false);
  }
  window.addEventListener("hashchange", () => location.reload());
  boot();
})();
