/* Kwentuhan concept demo. Vanilla JS, no build step. Everything runs in the browser; nothing is uploaded. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const app = $("#app");
  const PHOTO = "assets/img/migs-and-lola.jpg";
  const DEFAULTS = { view: "week", unlocked: false, scanned: false, recorded: false, frame: "parol", added: false, lang: "en", lolaLink: true, reminder: true, back: "week" };
  const store = {
    get() { try { return JSON.parse(localStorage.getItem("kwentuhan-demo") || "{}"); } catch { return {}; } },
    set(v) { try { localStorage.setItem("kwentuhan-demo", JSON.stringify(v)); } catch { /* storage unavailable */ } },
    clear() { try { localStorage.removeItem("kwentuhan-demo"); } catch { /* ignore */ } },
  };
  let S = Object.assign({}, DEFAULTS, store.get());
  const save = () => store.set(S);

  /* ---------- data ---------- */
  const svgUri = (svg) => `url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27")}')`;
  const PAT = {
    banig: svgUri("<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16' fill='#E6D3AA'/><path d='M0 0h8v8H0zM8 8h8v8H8z' fill='#CDAA6E'/><path d='M0 3h8v2H0zM8 11h8v2H8z' fill='#A9563F'/><path d='M11 0h2v8h-2zM3 8h2v8H3z' fill='#A9563F'/></svg>"),
    parol: svgUri("<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><rect width='22' height='22' fill='#741E22'/><path d='M11 6.5l1.1 3.4 3.4 1.1-3.4 1.1L11 15.5l-1.1-3.4L6.5 11l3.4-1.1z' fill='#D3A24A'/></svg>"),
    capiz: svgUri("<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><rect width='12' height='12' fill='#F1ECDF'/><path d='M0 .5H12M.5 0V12' stroke='#CDBE9C' stroke-width='1'/></svg>"),
    inabel: "repeating-linear-gradient(90deg,#2E3B61 0 3px,#EFEAE0 3px 7px,#2E3B61 7px 8px,#EFEAE0 8px 12px,#963A2B 12px 13px,#EFEAE0 13px 17px)",
  };
  const FRAMES = [
    { id: "banig", name: "Banig", place: "Samar" },
    { id: "parol", name: "Parol", place: "Pampanga" },
    { id: "capiz", name: "Capiz", place: "Iloilo" },
    { id: "inabel", name: "Inabel", place: "Ilocos" },
  ];
  const PAST = [
    { w: 5, t: "Trip to Manila", d: "Nov 17", m: "4 min", f: "capiz" },
    { w: 4, t: "Lola's kitchen rules", d: "Nov 10", m: "3 min", f: "banig" },
    { w: 3, t: "Her first job", d: "Nov 3", m: "5 min", f: "inabel" },
    { w: 2, t: "First day in Canada", d: "Oct 27", m: "6 min", f: "banig" },
    { w: 1, t: "Her hometown", d: "Oct 20", m: "4 min", f: "capiz" },
  ];
  const Q = { tl: "Ano ang kinakain mo tuwing fiesta noong bata ka?", en: "What did you eat at fiestas when you were a kid?" };
  const QUOTE = { en: "There was always cold Coke in glass bottles for the kids.", tl: "Laging may malamig na Coke sa bote para sa mga bata." };
  const TRANSCRIPT = [
    { t: "0:00", en: "Every fiesta in Pampanga, the whole barrio cooked together. Kare-kare, tocino del cielo, everything.", tl: "Tuwing fiesta sa Pampanga, sama-samang nagluluto ang buong baryo. Kare-kare, tocino del cielo, lahat." },
    { t: "0:41", en: `<mark>${QUOTE.en}</mark> We kept them in a basin of ice under the table.`, tl: `<mark>${QUOTE.tl}</mark> Nakalagay sa batya ng yelo sa ilalim ng mesa.` },
    { t: "1:15", en: "Your Lolo would open them with his teeth, and your Tita would get so mad.", tl: "Binubuksan ng Lolo mo gamit ang ngipin niya, at galit na galit ang Tita mo." },
  ];
  const STEPS = {
    week0: [1, "The App", "Monday: a new question arrives", "Every Monday the same question goes to every family. It stays locked until someone buys a glass Coke 2-pack."],
    stores: [2, "The Pack", "Find a glass 2-pack", "The app lists nearby stores that carry the glass 2-pack, starting with big chains in Filipino neighbourhoods. A shelf card sits beside it."],
    scan: [3, "The Pack", "Scan the receipt", "Any receipt from any store. The app checks for a glass Coke 2-pack, that it's from this week, and that it hasn't been used before."],
    week1: [4, "The App", "Ask Lola", "The question unlocks for the weekend meal. Two glasses, one question, and Lola answers by voice, at the table or from her own phone."],
    record: [4, "The App", "Ask Lola", "Record her answer. This demo uses your real microphone if you allow it; the recording never leaves your browser."],
    transcript: [5, "The App", "AI does the busywork", "Her answer is transcribed and translated, and a quote is suggested. The family can fix any line. AI never makes the art."],
    frame: [6, "The App", "Pick an artist's frame", "Each season, Filipino artists are paid to draw the frames: banig, parol, capiz and inabel."],
    story: [7, "The App", "The story card", "Lola's words, her voice and the family's photo, kept together in the frame they chose."],
    tapestry: [8, "The App", "It joins the tapestry", "Every week adds a square. At week 12 the season is complete, and the family can print it."],
    share: [9, "The Community", "Share the clip", "Stories become short subtitled clips that families post on TikTok and Reels. Every family that joins brings in the next one."],
    family: [8, "The App", "Family and consent", "Lola gives consent herself, and the family owns its archive."],
    settings: [8, "The App", "Privacy", "Stories are stored in Canada and never used in ads. One free question a month, even without a 2-pack."],
  };

  /* ---------- icons ---------- */
  const P = {
    back: '<path d="M15 5l-7 7 7 7"/>', chev: '<path d="M9.5 5.5l6.5 6.5-6.5 6.5"/>',
    share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M6.5 11H5v9.5h14V11h-1.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M7 7l10 10M17 7L7 17"/>',
    pin: '<path d="M12 21s6.5-5.8 6.5-11a6.5 6.5 0 0 0-13 0c0 5.2 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    house: '<path d="M3.5 11.5L12 4l8.5 7.5"/><path d="M6 10v10h12V10"/>',
    book: '<path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z"/><path d="M12 6.5v13"/>',
    people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.4.2 4 1.8 4.5 4.4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  };
  const ic = (n, size = 22, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
  const PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
  const PAUSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="3.6" height="14" rx="1"/><rect x="13.9" y="5" width="3.6" height="14" rx="1"/></svg>';
  const GLYPH = {
    airdrop: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"><path d="M7.5 16.5a6.4 6.4 0 1 1 9 0"/><path d="M9.6 14.4a3.4 3.4 0 1 1 4.8 0"/><circle cx="12" cy="12" r="1" fill="#fff"/></svg>',
    messages: '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M12 4.5c4.7 0 8.5 3 8.5 6.8s-3.8 6.8-8.5 6.8c-.9 0-1.8-.1-2.6-.3L5.5 19.5l1-3.2C4.6 15 3.5 13.3 3.5 11.3 3.5 7.5 7.3 4.5 12 4.5z" fill="#fff"/></svg>',
    tiktok: '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M13.5 4h2.6c.3 2 1.6 3.4 3.4 3.6v2.6c-1.3 0-2.5-.4-3.4-1.1v5.7a4.8 4.8 0 1 1-4.8-4.8h.4v2.7h-.4a2.1 2.1 0 1 0 2.2 2.1z" fill="#fff"/></svg>',
    instagram: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="4.5" y="4.5" width="15" height="15" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.6" cy="7.4" r=".9" fill="#fff" stroke="none"/></svg>',
    whatsapp: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7"><path d="M5 19l1-3.4A7.5 7.5 0 1 1 8.6 18z" stroke-linejoin="round"/></svg>',
  };

  /* ---------- shared pieces ---------- */
  const statusbar = () => `<div class="statusbar" aria-hidden="true"><span>9:41</span><span class="icons">
    <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx=".8"/><rect x="4.6" y="5" width="3" height="6" rx=".8"/><rect x="9.2" y="2.6" width="3" height="8.4" rx=".8"/><rect x="13.8" y="0" width="3" height="11" rx=".8"/></svg>
    <svg width="25" height="12" viewBox="0 0 25 12"><rect x=".5" y=".5" width="21" height="11" rx="3" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="16" height="8" rx="1.6" fill="currentColor"/></svg></span></div>`;
  const nav = (backLabel, backTo, title, right = "") => `<div class="nav">
    ${backTo ? `<button class="tap" data-go="${backTo}">${ic("back", 24, 2.3)}<span>${backLabel}</span></button>` : '<span style="width:44px"></span>'}
    <span class="t">${title}</span>${right || '<span style="width:44px"></span>'}</div>`;
  const tabbar = () => {
    const tabs = [["week", "house", "This Week"], ["tapestry", "book", "Tapestry"], ["family", "people", "Family"], ["settings", "gear", "Settings"]];
    const active = { week: "week", stores: "week", scan: "week", record: "week", transcript: "week", frame: "week", story: S.back === "tapestry" ? "tapestry" : "week", tapestry: "tapestry", family: "family", settings: "settings" }[S.view];
    return `<nav class="tabbar" aria-label="App sections">${tabs.map(([v, i, l]) => `<button class="tab" data-go="${v}" ${active === v ? 'aria-current="page"' : ""}>${ic(i, 24, 1.8)}<span>${l}</span></button>`).join("")}</nav>`;
  };
  const framed = (f, inner) => `<div class="framed" style="background:${PAT[f]}"><div class="inner">${inner}</div></div>`;
  const frameOf = (id) => FRAMES.find((x) => x.id === id);

  /* ---------- views ---------- */
  const V = {};
  V.week = () => {
    if (!S.unlocked) return `${nav("", "", "This Week")}
      <div class="page"><div class="eyebrow">Week 6 · Monday, November 24</div><h2 class="title" tabindex="-1">This week's question</h2></div>
      <div class="lockcard">
        <div class="lockline"><span style="color:var(--accent)">${ic("lock", 22)}</span><div><div class="heading" style="font-size:1.0625rem">Unlocks with a glass Coke 2-pack</div><div class="caption">One for you, one for Lola</div></div></div>
        <div class="mt5 qblur" aria-hidden="true"><div class="q-tl">${Q.tl}</div><div class="q-en">${Q.en}</div></div>
      </div>
      <p class="caption page mt4">Everyone gets the same question, every Monday. It was written by Filipino advisors.</p>
      <div class="footer-actions"><button class="primary" data-go="stores">${ic("pin", 20)} Find a 2-pack near you</button><button class="secondary" data-go="scan">I already have a receipt</button></div>`;
    return `${nav("", "", "This Week")}
      <div class="page"><div class="eyebrow">Week 6 · Monday, November 24</div><h2 class="title" tabindex="-1">This week's question</h2></div>
      <div class="seg" role="group" aria-label="Question language"><button data-lang="tl" aria-pressed="${S.lang === "tl"}">Tagalog</button><button data-lang="en" aria-pressed="${S.lang === "en"}">English</button></div>
      <div class="page mt5"><div class="q-tl">${S.lang === "tl" ? Q.tl : Q.en}</div><div class="q-en">${S.lang === "tl" ? Q.en : Q.tl}</div></div>
      <div class="group-label">Asking</div>
      <div class="list"><div class="row"><div class="swatch" style="border-radius:50%;background:var(--fill);display:flex;align-items:center;justify-content:center;font-weight:650">LR</div><div class="grow"><div class="r1">Lola Rosa</div><div class="r2">Tagalog, Kapampangan</div></div></div></div>
      <p class="caption page mt3">Pour two glasses and sit together. Start recording when she begins her answer.</p>
      <div class="footer-actions">${S.added ? `<button class="secondary" data-go="story" data-from="week">Open Lola's answer</button>` : `<button class="primary" data-go="record">Ask Lola</button>`}</div>`;
  };
  V.stores = () => `${nav("This Week", "week", "Nearby")}
    <div class="page"><h2 class="title" tabindex="-1">Glass 2-packs nearby</h2><div class="caption mt1">Winnipeg · sample stores for this demo</div></div>
    <div class="list mt4">
      ${[["Walmart Supercentre", "Garden City · 1.2 km", "In stock"], ["Real Canadian Superstore", "McPhillips St · 2.0 km", "In stock"], ["No Frills", "West End · 2.6 km", "A few left"], ["Walmart Supercentre", "Kenaston Blvd · 7.9 km", "In stock"]]
        .map(([n, w, s]) => `<div class="row"><span class="muted">${ic("pin", 22, 1.8)}</span><div class="grow"><div class="r1">${n}</div><div class="r2">${w}</div></div><span class="caption">${s}</span></div>`).join("")}
    </div>
    <div class="group-label">Look for this beside the glass Coke</div>
    <div style="margin:0 var(--s4);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;display:flex">
      <div style="background:#E1000A;color:#fff;padding:14px;flex:1"><div style="font:var(--caption);opacity:.85">Week 6 · Family question</div><div style="font:750 1.25rem/1.15 var(--font);font-stretch:85%;margin-top:4px">This week's question is waiting.</div></div>
      <div style="padding:14px;font:var(--caption);color:var(--text-secondary);width:42%">Buy a glass Coke 2-pack, scan the receipt in the Coca-Cola app, ask Lola at your next meal.</div>
    </div>
    <div class="footer-actions mt2"><button class="primary" data-go="scan">${ic("receipt", 20)} Scan my receipt</button></div>`;
  V.scan = () => `${nav("Back", S.unlocked ? "week" : "stores", "Scan receipt")}
    <div class="page"><h2 class="title" tabindex="-1">Scan your receipt</h2><div class="caption mt1">Any store, any receipt. In this demo the camera is simulated.</div></div>
    <div class="viewfinder" id="vf"><div class="receipt" aria-label="Sample receipt">
      <div class="c"><b>WALMART SUPERCENTRE</b><br>Garden City, Winnipeg MB<br>11/24/26 18:42</div><hr>
      <div class="ln"><span>BANANAS</span><span>1.29</span></div><div class="ln"><span>JASMINE RICE 8KG</span><span>21.97</span></div>
      <div class="ln hit"><span>COKE GLASS 2PK 237ML</span><span>2.79</span></div><div class="ln"><span>PANDESAL 12CT</span><span>4.49</span></div><hr>
      <div class="ln"><span>SUBTOTAL</span><span>30.54</span></div><div class="ln"><span>GST 5%</span><span>1.53</span></div><div class="ln"><b>TOTAL</b><b>32.07</b></div></div>
      <div class="corners" aria-hidden="true"></div><div class="scanline" aria-hidden="true"></div></div>
    <div id="scanresult" class="page" aria-live="polite">${S.scanned ? scanChecks() : ""}</div>
    <div class="footer-actions">${S.scanned ? `<button class="primary" data-act="openq">Open this week's question</button>` : `<button class="primary" data-act="scan">Scan sample receipt</button>`}</div>`;
  const scanChecks = () => ["Glass Coke 2-pack found", "Dated this week", "Not used before"].map((t) => `<div class="check"><span class="tick">${ic("check", 14, 3)}</span><span>${t}</span></div>`).join("");
  V.record = () => `${nav("This Week", "week", "Ask Lola")}
    <div class="page"><div class="eyebrow">Week 6 · asking Lola Rosa</div><h2 class="title" tabindex="-1">${Q.en}</h2><div class="muted mt1">${Q.tl}</div></div>
    <div class="rec">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="timer" id="timer">0:00</span><span class="caption" id="recstate">${S.recorded ? "Answer saved on this device" : "Tap to start"}</span></div>
      <div class="bars mt4" id="bars" aria-hidden="true">${"<i></i>".repeat(32)}</div>
      <button class="recbtn" id="recbtn" aria-pressed="false" aria-label="Start recording"><span></span></button>
      ${audioURL ? `<audio class="mt4" controls src="${audioURL}" style="width:100%"></audio>` : ""}
    </div>
    <div class="footer-actions">
      ${S.recorded ? `<button class="primary" data-go="transcript">Transcribe and translate</button>` : `<button class="secondary" data-act="sample">Use a sample answer</button>`}
    </div>
    <p class="caption page mt3">Your recording stays in this browser. Nothing is uploaded.</p>`;
  V.transcript = () => `${nav("Ask Lola", "record", "Transcript")}
    <div class="seg mt2" role="group" aria-label="Transcript language"><button data-lang="tl" aria-pressed="${S.lang === "tl"}">Original</button><button data-lang="en" aria-pressed="${S.lang === "en"}">English</button></div>
    <h2 class="sr-only" tabindex="-1">Transcript</h2>
    <div class="transcript">${TRANSCRIPT.map((l) => `<div class="who">Lola Rosa · ${l.t}</div><p contenteditable="true" spellcheck="false" aria-label="Transcript line at ${l.t}, editable">${S.lang === "tl" ? l.tl : l.en}</p>`).join("")}</div>
    <p class="caption page mt4">Highlighted line is the suggested quote. Tap any line to fix it. Transcription is simulated in this demo.</p>
    <div class="footer-actions"><button class="primary" data-go="frame">Choose a frame</button></div>`;
  V.frame = () => `${nav("Transcript", "transcript", "Frame")}
    <h2 class="sr-only" tabindex="-1">Choose a frame</h2>
    <div style="padding:var(--s2) var(--s4) 0">${framed(S.frame, `<div class="story-photo" style="background-image:url(${PHOTO})"></div><div style="padding:12px 14px 14px"><div class="quote" style="font-size:1.0625rem">“${QUOTE.en}”</div></div>`)}</div>
    <div class="group-label">Season 1 frames</div>
    <div class="list" role="radiogroup" aria-label="Frames">${FRAMES.map((f) => `<button class="row" role="radio" aria-checked="${S.frame === f.id}" data-frame="${f.id}"><span class="swatch" style="background:${PAT[f.id]}"></span><span class="grow"><span class="r1" style="display:block">${f.name}</span><span class="r2" style="display:block">Drawn by an artist from ${f.place}</span></span>${S.frame === f.id ? `<span style="color:var(--accent)">${ic("check", 22, 2.4)}</span>` : ""}</button>`).join("")}</div>
    <p class="caption page mt3">Each artist is paid for their frame. Frames are drawn by hand, not generated.</p>
    <div class="footer-actions"><button class="primary" data-go="story" data-from="frame">Use ${frameOf(S.frame).name}</button></div>`;
  V.story = () => {
    const f = frameOf(S.frame);
    const backTo = S.back === "tapestry" ? "tapestry" : S.added ? "week" : "frame";
    const backLabel = { tapestry: "Tapestry", week: "This Week", frame: "Frame" }[backTo];
    return `${nav(backLabel, backTo, "Week 6", S.added ? `<button class="tap" data-act="sheet" aria-label="Share">${ic("share", 23)}</button>` : "")}
      <div class="page"><div class="eyebrow">Week 6 · November 24</div><h2 class="title" tabindex="-1">Fiesta in Pampanga</h2><div class="caption" style="font-size:.9375rem">Lola Rosa · Kapampangan, translated</div></div>
      <div style="padding:var(--s4) var(--s5) 0">${framed(S.frame, `<div class="story-photo" role="img" aria-label="Migs and Lola Rosa on the couch, each holding a glass Coke" style="background-image:url(${PHOTO})"></div>`)}</div>
      <div class="page mt3"><div class="quote">“${QUOTE.en}”</div><div class="muted mt2" style="font-size:.9375rem">“${QUOTE.tl}”</div></div>
      <div class="player page mt4"><button class="play" id="play" aria-label="Play Lola's answer">${PLAY}</button>
        <div style="flex:1"><div class="track"><i id="prog"></i></div><div class="times"><span id="tcur">0:00</span><span id="trem">-3:12</span></div></div></div>
      <p class="caption page mt3">Frame: ${f.name}, by an artist from ${f.place}</p>
      <div class="footer-actions">${S.added ? `<button class="secondary" data-act="sheet">${ic("share", 20)} Share clip</button>` : `<button class="primary" data-act="add">Add to Tapestry</button>`}</div>`;
  };
  V.tapestry = () => {
    const n = S.added ? 6 : 5;
    const quilt = Array.from({ length: 12 }, (_, i) => {
      if (i < 5) return `<span style="background:${PAT[PAST[4 - i].f]}"></span>`;
      if (i === 5 && S.added) return `<span class="${S.justAdded ? "new" : ""}" style="background:${PAT[S.frame]}"></span>`;
      return "<span></span>";
    }).join("");
    const rows = (S.added ? [`<button class="row" data-go="story" data-from="tapestry"><span class="swatch" style="background:${PAT[S.frame]}"></span><span class="grow"><span class="r1" style="display:block">Fiesta in Pampanga</span><span class="r2" style="display:block">Week 6 · Nov 24 · 3 min</span></span><span class="chev">${ic("chev", 18)}</span></button>`] : [])
      .concat(PAST.map((p) => `<button class="row" data-act="sample-story"><span class="swatch" style="background:${PAT[p.f]}"></span><span class="grow"><span class="r1" style="display:block">${p.t}</span><span class="r2" style="display:block">Week ${p.w} · ${p.d} · ${p.m}</span></span><span class="chev">${ic("chev", 18)}</span></button>`)).join("");
    S.justAdded = false;
    return `${nav("", "", "", `<button class="tap" data-act="${S.added ? "sheet" : "need-story"}" aria-label="Share">${ic("share", 23)}</button>`)}
      <div class="page"><h2 class="title" style="font-size:2.125rem" tabindex="-1">Tapestry</h2><div class="caption" style="font-size:.9375rem">Rosa family · Season 1 · ${n} of 12 weeks</div></div>
      <div class="quilt" role="img" aria-label="${n} of 12 squares woven">${quilt}</div>
      <div class="group-label">Stories</div><div class="list">${rows}</div>`;
  };
  V.family = () => `${nav("", "", "Family")}
    <div class="page"><h2 class="title" style="font-size:2.125rem" tabindex="-1">Family</h2><div class="caption" style="font-size:.9375rem">Rosa family · 4 people</div></div>
    <div class="list mt4">${[["LR", "Lola Rosa", "Storyteller · consent given Nov 2"], ["M", "Migs (you)", "Asks the questions"], ["TM", "Tita Marites", "Listener · Winnipeg"], ["A", "Ana", "Listener · Manila"]]
      .map(([i, n, r]) => `<div class="row"><span class="swatch" style="border-radius:50%;background:var(--fill);display:flex;align-items:center;justify-content:center;font-weight:650;font-size:.875rem">${i}</span><div class="grow"><div class="r1">${n}</div><div class="r2">${r}</div></div></div>`).join("")}</div>
    <div class="group-label">Lola's answers</div>
    <div class="list"><div class="row"><div class="grow"><div class="r1" id="ll">Answer from her own phone</div><div class="r2">She gets a link by text. No app needed.</div></div><button class="toggle" role="switch" aria-labelledby="ll" aria-checked="${S.lolaLink}" data-act="toggle" data-key="lolaLink"></button></div></div>
    <div class="footer-actions mt2"><button class="secondary" data-act="invite">Invite family</button></div>`;
  V.settings = () => `${nav("", "", "Settings")}
    <div class="page"><h2 class="title" style="font-size:2.125rem" tabindex="-1">Settings</h2></div>
    <div class="group-label">Reminders</div>
    <div class="list"><div class="row"><div class="grow"><div class="r1" id="rm">Monday question</div><div class="r2">A reminder when the new question arrives</div></div><button class="toggle" role="switch" aria-labelledby="rm" aria-checked="${S.reminder}" data-act="toggle" data-key="reminder"></button></div></div>
    <div class="group-label">Your family's archive</div>
    <div class="list"><button class="row" data-act="toast" data-msg="In the real app this downloads a printable PDF."><span class="grow r1">Download our tapestry</span><span class="chev">${ic("chev", 18)}</span></button><button class="row" data-act="wipe"><span class="grow r1" style="color:var(--accent)">Delete our family's archive</span></button></div>
    <p class="caption page mt3">Stories are stored in Canada and never used in ads. The family owns its archive. One question a month is free, even without a 2-pack.</p>
    <div class="footer-actions mt2"><button class="secondary" data-act="reset">Restart the demo</button></div>`;

  const sheet = () => `<div class="scrim" data-act="close-sheet"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Share Fiesta in Pampanga">
      <div class="sheet-head"><div class="sheet-thumb" style="background-image:url(${PHOTO})"></div><div class="grow" style="flex:1"><div style="font-weight:650">Fiesta in Pampanga</div><div class="caption">Video clip with subtitles · 0:42</div></div><button class="tap" data-act="close-sheet" aria-label="Close" style="color:var(--text-secondary)">${ic("x", 20, 2.2)}</button></div>
      <div class="apps">${[["airdrop", "#1A8CFF", "AirDrop"], ["messages", "#34C759", "Messages"], ["tiktok", "#000", "TikTok"], ["instagram", "#D62976", "Instagram"], ["whatsapp", "#25D366", "WhatsApp"]]
        .map(([k, bg, l]) => `<button class="appbtn" data-act="app" data-app="${k}"><span class="appicon" style="background:${bg}">${GLYPH[k]}</span>${l}</button>`).join("")}</div>
      <div class="list"><button class="row" data-act="copy" style="min-height:48px"><span class="grow r1">Copy link to this demo</span>${ic("copy", 20, 1.7)}</button><button class="row" data-act="native-share" style="min-height:48px"><span class="grow r1">Share this demo…</span>${ic("share", 20, 1.7)}</button></div>
    </div>`;
  const CAPS = [[QUOTE.en.slice(0, 26), "Laging may malamig na Coke"], ["in glass bottles for the kids.", "sa bote para sa mga bata."], ["We kept them in a basin of ice", "Nakalagay sa batya ng yelo"], ["under the table.", "sa ilalim ng mesa."]];
  const tiktok = () => `<div class="tiktok" id="tt" role="dialog" aria-modal="true" aria-label="TikTok post preview">
    <div class="tt-bg" style="background-image:url(${PHOTO})"></div>
    <button class="tap tt-close" data-act="close-tt" aria-label="Back to Coca-Cola app">${ic("back", 24, 2.3)}</button>
    <div class="tt-top" aria-hidden="true"><span>Following</span><span class="on">For You</span></div>
    <div class="tt-stage"><img src="${PHOTO}" alt="Migs and Lola Rosa on the couch, each holding a glass Coke"><div class="tt-cc" aria-live="off"><span class="en" id="cc-en">${CAPS[0][0]}</span><br><span class="tl" id="cc-tl">${CAPS[0][1]}</span></div></div>
    <div class="tt-rail" aria-hidden="true"><div class="tt-av"><img src="assets/img/coca-cola-script-white.png" alt="" style="width:36px"></div>
      <div><svg width="32" height="32" viewBox="0 0 24 24" fill="#fff"><path d="M12 20.3l-1.2-1.1C6.2 15.1 3.2 12.4 3.2 9A4.6 4.6 0 0 1 7.8 4.4c1.6 0 3.1.7 4.2 1.9 1.1-1.2 2.6-1.9 4.2-1.9A4.6 4.6 0 0 1 20.8 9c0 3.4-3 6.1-7.6 10.2z"/></svg>48.2K</div>
      <div><svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M12 3.5c5 0 9 3.3 9 7.6s-4 7.6-9 7.6c-.9 0-1.8-.1-2.7-.3L4.5 20.5l1.3-3.6C4 15.5 3 13.4 3 11.1 3 6.8 7 3.5 12 3.5z"/></svg>1,204</div>
      <div><svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M13.5 4.5l7.5 7-7.5 7v-4.3c-4.8 0-7.9 1.5-10.5 5 .9-5.4 3.9-9.6 10.5-10.4z"/></svg>2,876</div></div>
    <div class="tt-meta"><b>cocacola <svg width="14" height="14" viewBox="0 0 24 24" aria-label="verified"><circle cx="12" cy="12" r="11" fill="#20D5EC"/><path d="M7 12.5l3.2 3.2L17 8.8" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></b>
      <div class="mt1">Migs asked his lola this week's question and she went straight to fiesta stories #cocacola #bu111 #lola</div></div>
    <div class="tt-prog"><i id="tt-prog"></i></div></div>`;

  /* ---------- render ---------- */
  let ttTimer = 0, playTimer = 0, playing = false, playPos = 0, curAudio = null;
  function narrate(key) {
    const st = STEPS[key]; if (!st) return;
    $("#n-step").textContent = `Step ${st[0]} of 9`; $("#n-prong").textContent = st[1]; $("#n-title").textContent = st[2]; $("#n-body").textContent = st[3];
    [...$("#n-steps").children].forEach((li, i) => { li.className = i + 1 < st[0] ? "done" : i + 1 === st[0] ? "now" : ""; });
  }
  function render(focus = false) {
    stopPlay();
    const body = V[S.view]();
    app.innerHTML = `${statusbar()}<div class="view" id="view">${body}</div>${tabbar()}${sheet()}${tiktok()}<div class="toast" id="toast" role="status"></div>`;
    narrate(S.view === "week" ? (S.unlocked ? "week1" : "week0") : S.view);
    if (S.view === "record") bindRecorder();
    if (S.view === "story") bindPlayer();
    if (focus) { const h = app.querySelector("[tabindex='-1']"); if (h) h.focus({ preventScroll: true }); }
    save();
  }
  function go(view, from) {
    if (view === "story" && from) S.back = from;
    if (view !== "story" && ["week", "tapestry", "family", "settings"].includes(view)) S.back = view === "tapestry" ? "tapestry" : "week";
    S.view = view; render(true);
    const v = $("#view"); if (v) v.scrollTop = 0;
    keepInView();
  }
  /* On phones the app is full-screen below the intro; keep it pinned in view while using it. */
  function keepInView() {
    if (window.matchMedia("(max-width: 899px)").matches) {
      const top = $("#device").getBoundingClientRect().top;
      if (Math.abs(top) > 2) window.scrollTo({ top: window.scrollY + top, behavior: "auto" });
    }
  }
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200); }

  /* ---------- recorder (real mic, local only) ---------- */
  let rec = null, stream = null, raf = 0, startAt = 0, actx = null, chunks = [];
  let audioURL = null;
  function bindRecorder() {
    $("#recbtn").addEventListener("click", () => (rec && rec.state === "recording" ? stopRec() : startRec()));
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  async function startRec() {
    const btn = $("#recbtn"), state = $("#recstate"), bars = [...$("#bars").children];
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      state.textContent = "Microphone is off. Use the sample answer instead."; return;
    }
    chunks = []; rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => { audioURL && URL.revokeObjectURL(audioURL); audioURL = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })); S.recorded = true; render(); };
    rec.start();
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const an = actx.createAnalyser(); an.fftSize = 64; actx.createMediaStreamSource(stream).connect(an);
    const data = new Uint8Array(an.frequencyBinCount);
    btn.setAttribute("aria-pressed", "true"); btn.setAttribute("aria-label", "Stop recording"); $("#bars").classList.add("live");
    state.textContent = "Recording… tap to stop"; startAt = performance.now();
    const tick = () => {
      an.getByteFrequencyData(data);
      bars.forEach((b, i) => { b.style.height = `${8 + (data[i % data.length] / 255) * 92}%`; });
      $("#timer").textContent = fmt((performance.now() - startAt) / 1000);
      raf = requestAnimationFrame(tick);
    };
    tick();
  }
  function stopRec() {
    cancelAnimationFrame(raf);
    rec && rec.state === "recording" && rec.stop();
    stream && stream.getTracks().forEach((t) => t.stop());
    actx && actx.close();
  }
  function sampleAnswer() {
    const bars = [...$("#bars").children]; $("#bars").classList.add("live"); $("#recstate").textContent = "Playing a sample answer…";
    let k = 0; const id = setInterval(() => {
      bars.forEach((b) => { b.style.height = `${10 + Math.random() * 85}%`; });
      $("#timer").textContent = fmt(k * 0.25 * 16); k++;
      if (k > 12) { clearInterval(id); S.recorded = true; render(); }
    }, 120);
  }

  /* ---------- player ---------- */
  function bindPlayer() {
    const btn = $("#play"); if (!btn) return;
    let audio = null; const total = 192;
    if (audioURL) { audio = curAudio = new Audio(audioURL); audio.addEventListener("timeupdate", () => paint(audio.currentTime, audio.duration || total)); audio.addEventListener("ended", () => setBtn(false)); }
    const setBtn = (on) => { playing = on; btn.innerHTML = on ? PAUSE : PLAY; btn.setAttribute("aria-label", on ? "Pause" : "Play Lola's answer"); };
    const paint = (cur, dur) => { if (!$("#prog")) return; $("#prog").style.width = `${(100 * cur) / dur}%`; $("#tcur").textContent = fmt(cur); $("#trem").textContent = `-${fmt(Math.max(0, dur - cur))}`; };
    btn.addEventListener("click", () => {
      if (audio) { if (audio.paused) { audio.play(); setBtn(true); } else { audio.pause(); setBtn(false); } return; }
      if (playing) { clearInterval(playTimer); setBtn(false); return; }
      setBtn(true); playTimer = setInterval(() => { playPos = Math.min(total, playPos + 1); paint(playPos, total); if (playPos >= total) { clearInterval(playTimer); setBtn(false); playPos = 0; } }, 250);
    });
  }
  function stopPlay() { clearInterval(playTimer); playing = false; if (curAudio) { curAudio.pause(); curAudio = null; } }

  /* ---------- overlays ---------- */
  function openSheet() { app.classList.add("open"); narrate("share"); setTimeout(() => app.querySelector(".sheet .appbtn")?.focus(), 50); }
  function closeSheet() { app.classList.remove("open"); }
  function openTikTok() {
    closeSheet(); const tt = $("#tt"); tt.classList.add("on"); tt.querySelector(".tt-close").focus();
    let t = 0; clearInterval(ttTimer);
    ttTimer = setInterval(() => {
      t = (t + 1) % 80; const i = Math.min(3, Math.floor(t / 20));
      $("#cc-en").textContent = CAPS[i][0]; $("#cc-tl").textContent = CAPS[i][1]; $("#tt-prog").style.width = `${(t / 80) * 100}%`;
    }, 100);
  }
  function closeTikTok() { clearInterval(ttTimer); $("#tt").classList.remove("on"); }

  /* ---------- events ---------- */
  app.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-go],[data-act],[data-lang],[data-frame]"); if (!el) return;
    if (el.dataset.go) return go(el.dataset.go, el.dataset.from);
    if (el.dataset.lang) { S.lang = el.dataset.lang; return render(); }
    if (el.dataset.frame) { S.frame = el.dataset.frame; return render(); }
    switch (el.dataset.act) {
      case "scan": {
        const vf = $("#vf"); vf.classList.add("scanning"); el.disabled = true; el.textContent = "Scanning…";
        setTimeout(() => { S.scanned = true; render(); $("#scanresult")?.focus?.(); }, 1600); break;
      }
      case "openq": S.unlocked = true; go("week"); break;
      case "sample": sampleAnswer(); break;
      case "add": S.added = true; S.justAdded = true; S.back = "tapestry"; go("tapestry"); toast("Woven into your tapestry"); break;
      case "sheet": keepInView(); openSheet(); break;
      case "close-sheet": closeSheet(); break;
      case "app": if (el.dataset.app === "tiktok") openTikTok(); else toast("Only TikTok is wired up in this demo"); break;
      case "close-tt": closeTikTok(); narrate("story"); break;
      case "copy": try { await navigator.clipboard.writeText(location.href.split("#")[0]); toast("Link copied"); } catch { toast("Copy isn't available here"); } break;
      case "native-share":
        if (navigator.share) { try { await navigator.share({ title: "Kwentuhan concept demo", text: "Every Coke opens a story.", url: location.href.split("#")[0] }); } catch { /* cancelled */ } }
        else toast("Sharing isn't available in this browser"); break;
      case "invite":
        if (navigator.share) { try { await navigator.share({ title: "Join our family tapestry", url: location.href.split("#")[0] }); } catch { /* cancelled */ } }
        else toast("In the real app this sends an invite link"); break;
      case "toggle": S[el.dataset.key] = !S[el.dataset.key]; render(); break;
      case "toast": toast(el.dataset.msg); break;
      case "sample-story": toast("Only Week 6 is playable in this demo"); break;
      case "need-story": toast("Add this week's story first"); break;
      case "wipe": if (confirm("Delete the Rosa family's archive? This removes every story, photo and recording.")) { reset(); toast("Archive deleted"); } break;
      case "reset": reset(); break;
    }
  });
  app.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeSheet(); closeTikTok(); } });
  function reset() { stopRec(); closeTikTok(); store.clear(); audioURL = null; S = Object.assign({}, DEFAULTS); render(true); }
  $("#reset").addEventListener("click", () => { reset(); $("#device").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("#start").addEventListener("click", () => { $("#device").scrollIntoView({ behavior: "smooth", block: "start" }); app.querySelector("button.primary, .view button")?.focus({ preventScroll: true }); });

  render();
})();
