/* Touchline — feeder clubs: big clubs negotiate partnerships with clubs in other countries
   (simulated clubs or overseas partners outside the simulated leagues).
   Terms: loan pathway (develop youngsters there), first option (scouted players, 20% discount) and a youth link
   (a prospect joins your academy every summer). Small clubs can also be approached by big clubs abroad.
   No DOM access. Also re-balances home/away on older saves. */
(function () {
  const TL = window.TL, clamp = TL.clamp, Rng = TL.Rng;
  const isHuman = (s, id) => TL.ownerIndex(s, id) >= 0;
  const mine = s => s.manager.clubId ? s.clubs[s.manager.clubId] : null;

  // Overseas partners outside the simulated leagues: [name, country, reputation]
  TL.EXT_FEEDERS = [
    ['Lommel SK', 'BEL', 55], ['KV Oostende', 'BEL', 52], ['Royal Antwerp', 'BEL', 64], ['FC Twente', 'NED', 66], ['NAC Breda', 'NED', 57],
    ['Estoril Praia', 'POR', 58], ['Famalicão', 'POR', 60], ['Vitória SC', 'POR', 63], ['Right to Dream', 'GHA', 45], ['Accra Hearts of Oak', 'GHA', 47],
    ['Génération Foot', 'SEN', 46], ['ASEC Mimosas', 'CIV', 50], ['Coton Sport', 'CMR', 44], ['Stade Malien', 'MLI', 43], ['New York City FC', 'USA', 62],
    ['Bahia', 'BRA', 64], ['Red Bull Bragantino', 'BRA', 63], ['Defensa y Justicia', 'ARG', 60], ['Montevideo Wanderers', 'URU', 52], ['Yokohama F. Marinos', 'JPN', 60],
    ['FC Nordsjælland', 'DEN', 60], ['FC Zürich', 'SUI', 61], ['Red Bull Salzburg', 'AUT', 70], ['Wydad AC', 'MAR', 58]
  ];
  TL.FEEDER_TERMS = {
    loans: ['Loan pathway', 'Send youngsters there on loan. They develop about 30% faster and you can recall them at any time.'],
    option: ['First option', 'Our scouts see their best young players every month and we pay 20% less for them.'],
    youth: ['Youth link', 'A promising prospect from their country joins our academy every summer.']
  };
  const MIN_REP = 70, MAX_FEEDERS = 3;

  /* ---------- Lookups ---------- */
  const extKey = e => 'X:' + e[0];
  TL.feederName = (s, f) => f.club ? (s.clubs[f.club] ? s.clubs[f.club].name : f.club) : f.ext.name;
  TL.feederCountry = (s, f) => f.club ? (s.clubs[f.club] ? s.clubs[f.club].country : '') : f.ext.country;
  TL.feederRep = (s, f) => f.club ? (s.clubs[f.club] ? s.clubs[f.club].rep : 50) : f.ext.rep;
  TL.feedersOf = (s, parentId) => (s.feeders || []).filter(f => f.parent === parentId);
  TL.parentOf = (s, clubId) => (s.feeders || []).find(f => f.club === clubId);
  TL.isFeederOf = (s, clubId, parentId) => (s.feeders || []).some(f => f.club === clubId && f.parent === parentId);
  const taken = s => new Set((s.feeders || []).map(f => f.club || extKey([f.ext.name])));
  // 20% off for a parent club buying from its feeder (first option)
  TL.feederDiscount = (s, p) => {
    const me = mine(s); if (!me || !p.clubId || !s.feeders) return 1;
    const f = s.feeders.find(x => x.club === p.clubId && x.parent === me.id);
    return f && f.terms.option ? 0.8 : 1;
  };

  /* ---------- Candidates & negotiation ---------- */
  TL.feederEligible = (s, c) => c.rep >= MIN_REP ? null : `Only clubs with a reputation of ${MIN_REP} or more can set up feeder clubs abroad (yours is ${c.rep}).`;
  TL.feederCandidates = (s, parent) => {
    const t = taken(s), out = [];
    for (const id in s.clubs) {
      const c = s.clubs[id];
      if (c.country === parent.country || c.rep > Math.min(parent.rep - 12, 74) || t.has(id) || TL.feedersOf(s, id).length) continue;
      out.push({ key: id, club: id, name: c.name, country: c.country, rep: c.rep, sim: true });
    }
    for (const e of TL.EXT_FEEDERS) if (!t.has(extKey(e)) && e[1] !== parent.country && e[2] <= Math.min(parent.rep - 8, 74)) out.push({ key: extKey(e), ext: { name: e[0], country: e[1], rep: e[2] }, name: e[0], country: e[1], rep: e[2], sim: false });
    return out.sort((a, b) => b.rep - a.rep);
  };
  // Annual fee the partner wants (£m), adjusted for the terms requested and the length of the deal
  TL.feederAsk = (s, parent, cand, terms, years) => {
    let ask = (0.4 + Math.max(0, cand.rep - 40) * 0.05) * (1 + (parent.rep - 75) / 60);
    if (terms.option) ask *= 1.25; if (terms.youth) ask *= 1.2; if (terms.loans) ask *= 0.9;
    ask *= 1 - 0.04 * (clamp(years, 1, 5) - 1);
    return Math.max(0.2, Math.round(ask * 20) / 20);
  };
  TL.evaluateFeeder = (s, parent, cand, offer) => {
    const ask = TL.feederAsk(s, parent, cand, offer.terms, offer.years);
    const need = ask * (1 - 0.03 * Math.min(offer.round || 0, 3));
    if (offer.fee >= need - 0.001) return { result: 'accept', msg: `${cand.name} accept: ${TL.fmtM(offer.fee)} a year for ${offer.years} year${offer.years > 1 ? 's' : ''}. The partnership is official.` };
    if ((offer.round || 0) >= 4) return { result: 'reject', msg: `${cand.name} have ended the talks.` };
    if (offer.fee >= ask * 0.65) { const want = Math.max(offer.fee + 0.05, Math.ceil(ask * (1 - 0.03 * Math.min((offer.round || 0) + 1, 3)) * 20) / 20); return { result: 'counter', fee: want, msg: `${cand.name} want ${TL.fmtM(want)} a year for those terms.` }; }
    return { result: 'reject', msg: `${cand.name} say the offer is far too low.` };
  };
  TL.createFeeder = (s, parentId, cand, fee, years, terms) => {
    s.feeders = s.feeders || [];
    const f = { id: s.nextId++, parent: parentId, club: cand.club || null, ext: cand.ext || null, fee, years, start: s.season, end: s.season + years - 1, terms: Object.assign({ loans: false, option: false, youth: false }, terms), since: s.date };
    s.feeders.push(f);
    const P = s.clubs[parentId];
    TL.news(s, `${P.name} agree a feeder-club partnership with ${TL.feederName(s, f)} (${TL.NAT_NAMES[TL.feederCountry(s, f)] || TL.feederCountry(s, f)}).`, { club: parentId });
    if (f.club && isHuman(s, f.club)) TL.mailClub(s, f.club, 'board', `Partnership with ${P.name}`, `We are now a feeder club of ${P.name}. They pay us ${TL.fmtM(fee)} a year until ${f.end + 1}.${f.terms.loans ? '\n\nThey will send us young players on loan.' : ''}${f.terms.option ? '\n\nThey can buy our players at a 20% discount.' : ''}`, true);
    return f;
  };
  TL.endFeeder = (s, id) => {
    const f = (s.feeders || []).find(x => x.id === id); if (!f) return 'Not found.';
    const left = Math.max(0, f.end - s.season + 1), comp = Math.round(f.fee * left * 0.5 * 100) / 100;
    if (isHuman(s, f.parent)) TL.asManager(s, TL.ownerIndex(s, f.parent), () => TL.book(s, 'exp', 'feeder', comp));
    for (const pid of s.clubs[f.parent].players) { const p = s.players[pid]; if (p.onLoan && p.onLoan.feeder === f.id) p.onLoan = null; }
    s.feeders = s.feeders.filter(x => x !== f);
    TL.news(s, `${s.clubs[f.parent].name} end their partnership with ${TL.feederName(s, f)}.`, { club: f.parent });
    return `Partnership ended. Compensation paid: ${TL.fmtM(comp)}. Your loanees there have returned.`;
  };

  /* ---------- Loans to a feeder ---------- */
  TL.loanToFeeder = (s, pid, fid) => {
    const p = s.players[pid], f = s.feeders.find(x => x.id === fid), c = s.clubs[p.clubId];
    if (!f || !f.terms.loans) return 'This partnership has no loan pathway.';
    if (p.age > 23) return 'Only players aged 23 or under can go to a feeder club.';
    p.onLoan = { until: s.season, to: TL.feederName(s, f), feeder: f.id };
    if (c.lineup) { c.lineup.xi = c.lineup.xi.map(x => x === pid ? null : x); c.lineup.bench = c.lineup.bench.filter(x => x !== pid); }
    TL.news(s, `${p.name} joins feeder club ${p.onLoan.to} on loan from ${c.name}.`, { pid, club: c.id, kind: 'loan' });
    return `${p.name} joins ${p.onLoan.to} on loan. You can recall him at any time.`;
  };
  TL.recallLoan = (s, pid) => { const p = s.players[pid]; if (!p.onLoan || !p.onLoan.feeder) return 'Only loans to feeder clubs can be cut short.'; const to = p.onLoan.to; p.onLoan = null; return `${p.name} is back from ${to}.`; };

  /* ---------- Offers from big clubs to human-managed small clubs ---------- */
  TL.respondFeederOffer = (s, id, how) => {
    const o = (s.feederOffers || []).find(x => x.id === id); if (!o || o.status !== 'open') return 'This offer is no longer available.';
    const P = s.clubs[o.parent], me = s.clubs[o.club];
    if (TL.parentOf(s, me.id)) { o.status = 'expired'; return 'You already have a parent club.'; }
    if (how === 'reject') { o.status = 'rejected'; return `You turned down ${P.name}.`; }
    if (how === 'counter') {
      const want = Math.round(o.fee * 1.2 * 20) / 20;
      if (want <= o.max) { o.fee = want; how = 'accept'; } else { o.status = 'rejected'; return `${P.name} won't pay ${TL.fmtM(want)} a year and walk away.`; }
    }
    o.status = 'accepted';
    TL.createFeeder(s, o.parent, { club: me.id, name: me.name, rep: me.rep }, o.fee, o.years, o.terms);
    if (o.terms.loans) parentLoans(s, s.feeders[s.feeders.length - 1], new Rng(o.id * 7919));
    return `${me.name} are now a feeder club of ${P.name} (${TL.fmtM(o.fee)} a year).`;
  };
  // An AI parent sends one or two youngsters to its feeder for the season (they pay most of the wages)
  function parentLoans(s, f, rng) {
    if (!f.club || !f.terms.loans || isHuman(s, f.parent)) return;
    const P = s.clubs[f.parent], F = s.clubs[f.club];
    const avg = F.players.reduce((a, id) => a + s.players[id].ovr, 0) / Math.max(1, F.players.length);
    const xi = new Set(TL.pickXI(s, P, P.tactics.formation, { ignoreCondition: true }));
    const cands = P.players.map(id => s.players[id]).filter(p => p.age <= 21 && !xi.has(p.id) && !p.loan && !p.onLoan && p.ovr >= avg - 6 && p.ovr <= avg + 20).sort((a, b) => a.ovr - b.ovr);
    for (const p of rng.shuffle(cands.slice(0, 5)).slice(0, rng.int(1, 2))) {
      if (F.players.length >= 30) break;
      const wage = Math.max(0.1, Math.round(p.contract.wage * 0.2 * 10) / 10);
      TL.completeTransfer(s, p.id, F.id, 0, { wage, end: s.season, clause: null }, { loan: true });
      TL.mailClub(s, F.id, 'transfers', `${p.name} arrives on loan from ${P.name}`, `As part of our partnership, ${P.name} have loaned us ${p.name} (${p.pos}, ${p.age}, rated ${p.ovr}) for the season. They pay 80% of his wages.`);
    }
  }

  /* ---------- Hooks ---------- */
  function aiPartnerships(s, rng) {
    s.feeders = s.feeders || []; s.feederOffers = s.feederOffers || [];
    const big = Object.values(s.clubs).filter(c => c.rep >= 82 && !isHuman(s, c.id)).sort((a, b) => b.rep - a.rep).slice(0, 14);
    for (const P of big) {
      if (!rng.chance(0.55) || TL.feedersOf(s, P.id).length) continue;
      const cands = TL.feederCandidates(s, P).filter(x => !x.club || !isHuman(s, x.club));
      if (!cands.length) continue;
      const cand = rng.pick(cands.slice(0, 25));
      const terms = { loans: true, option: rng.chance(0.6), youth: rng.chance(0.4) };
      const years = rng.int(2, 4);
      const f = { id: s.nextId++, parent: P.id, club: cand.club || null, ext: cand.ext || null, fee: TL.feederAsk(s, P, cand, terms, years), years, start: s.season, end: s.season + years - 1, terms, since: s.date };
      s.feeders.push(f);
    }
  }
  const prevInit = TL.initEconomy;
  TL.initEconomy = function (s, rng) { prevInit(s, rng); aiPartnerships(s, rng); s.feedersInit = true; };
  const prevMigrate = TL.migrate;
  TL.migrate = function (s) {
    const out = prevMigrate(s);
    if (out && out.clubs) {
      out.feeders = out.feeders || []; out.feederOffers = out.feederOffers || [];
      if (!out.fixturesBalanced && TL.rebalanceFixtures) TL.rebalanceFixtures(out);
      if (!out.roundsRestored && TL.restoreRoundOrder) TL.restoreRoundOrder(out);
      if (!out.feedersInit) { out.feedersInit = true; if (!out.feeders.length) aiPartnerships(out, new Rng(parseInt(TL.checksum(out.date + 'feeders'), 16))); }
    }
    return out;
  };

  const prevDay = TL.dayTick;
  TL.dayTick = function (s, prev, date, rng) {
    prevDay(s, prev, date, rng);
    if (!s.feeders) return;
    const newMonth = prev.slice(0, 7) !== date.slice(0, 7);
    if (!newMonth) return;
    // monthly fees
    for (const f of s.feeders) {
      const amt = f.fee / 12;
      if (isHuman(s, f.parent)) TL.asManager(s, TL.ownerIndex(s, f.parent), () => TL.book(s, 'exp', 'feeder', amt));
      if (f.club && isHuman(s, f.club)) TL.asManager(s, TL.ownerIndex(s, f.club), () => TL.book(s, 'inc', 'feeder', amt));
    }
    // first-option scouting reports for human parents
    for (const f of s.feeders) {
      if (!f.club || !f.terms.option || !isHuman(s, f.parent) || !s.clubs[f.club]) continue;
      TL.asManager(s, TL.ownerIndex(s, f.parent), () => {
        const P = s.clubs[f.parent], F = s.clubs[f.club];
        const avg = P.players.reduce((a, id) => a + s.players[id].ovr, 0) / Math.max(1, P.players.length);
        const best = F.players.map(id => s.players[id]).filter(p => !p.loan && (p.age <= 22 && p.pot >= avg - 2 || p.ovr >= avg)).sort((a, b) => (b.pot + b.ovr) - (a.pot + a.ovr)).slice(0, 3);
        if (!best.length) return;
        for (const p of best) s.scouted[p.id] = s.scouted[p.id] || date;
        TL.addMail(s, 'scout', `Feeder report: ${F.name}`, `The best prospects at our feeder club ${F.name} this month. Our first option means we would pay 20% less than other clubs.\n\n${best.map(p => `• ${p.name} (${p.pos}, ${p.age}) – rated ${p.ovr}, potential ${p.pot >= p.ovr + 3 ? 'high' : 'limited'} · about ${TL.fmtM(TL.askingPrice(s, p))}`).join('\n')}`);
        s.inbox[0].action = { kind: 'players', ids: best.map(p => p.id) };
        s.inbox[0].read = false;
      });
    }
    // big clubs abroad approach human-managed smaller clubs
    s.feederOffers = s.feederOffers || [];
    s.managers.forEach((m, i) => {
      const c = m.clubId && s.clubs[m.clubId];
      if (!c || c.rep > 74 || TL.parentOf(s, c.id) || s.feederOffers.some(o => o.club === c.id && o.status === 'open') || !rng.chance(0.2)) return;
      const bigs = Object.values(s.clubs).filter(P => P.rep >= 80 && P.country !== c.country && !isHuman(s, P.id) && TL.feedersOf(s, P.id).length < MAX_FEEDERS);
      if (!bigs.length) return;
      const P = rng.pick(bigs), terms = { loans: true, option: true, youth: false }, years = rng.int(2, 3);
      const ask = TL.feederAsk(s, P, { rep: c.rep }, terms, years);
      const o = { id: s.nextId++, parent: P.id, club: c.id, fee: Math.round(ask * rng.range(0.8, 1.05) * 20) / 20, max: Math.round(ask * 1.3 * 20) / 20, years, terms, status: 'open', date };
      s.feederOffers.push(o);
      TL.asManager(s, i, () => {
        TL.addMail(s, 'board', `${P.name} want us as a feeder club`, `${P.name} (${TL.NAT_NAMES[P.country] || P.country}) have proposed a ${years}-year partnership:\n\n• They pay us ${TL.fmtM(o.fee)} a year.\n• They send us young players on loan every season and pay most of their wages.\n• In return they can buy our players at a 20% discount.\n\nAccept, ask for more, or turn it down.`, true);
        s.inbox[0].action = { kind: 'feederOffer', id: o.id };
      });
    });
  };

  const prevSeasonStart = TL.econSeasonStart;
  TL.econSeasonStart = function (s, rng) {
    prevSeasonStart(s, rng);
    if (!s.feeders) return;
    // expiries: AI partnerships renew, human ones end with a message
    for (const f of s.feeders.slice()) {
      if (f.end >= s.season) continue;
      const humanSide = isHuman(s, f.parent) || (f.club && isHuman(s, f.club));
      if (!humanSide && rng.chance(0.7)) { f.end = s.season + rng.int(1, 3); continue; }
      s.feeders = s.feeders.filter(x => x !== f);
      if (isHuman(s, f.parent)) TL.mailClub(s, f.parent, 'board', `Partnership with ${TL.feederName(s, f)} has ended`, 'The agreement has run its course. You can negotiate a new deal from the Club screen.');
      if (f.club && isHuman(s, f.club)) TL.mailClub(s, f.club, 'board', `Partnership with ${s.clubs[f.parent].name} has ended`, 'Our feeder-club agreement has expired.');
    }
    for (const f of s.feeders) {
      // youth link: a prospect joins the human parent's academy
      if (f.terms.youth && isHuman(s, f.parent)) {
        const P = s.clubs[f.parent], nat = TL.feederCountry(s, f);
        const p = TL.generateYouth(s, null, rng, { nat, age: rng.int(16, 17), boost: 2 });
        p.pot = clamp(p.ovr + rng.int(14, 28), p.ovr + 8, 92); p.clubId = P.id; p.academy = true; p.homegrown = P.id;
        p.contract = { wage: Math.max(0.1, Math.round(TL.wageFor(p, P.rep, P) * 3) / 10), end: s.season + 3, clause: null };
        P.academy = P.academy || []; P.academy.push(p.id);
        TL.mailClub(s, P.id, 'academy', `${p.name} arrives from ${TL.feederName(s, f)}`, `Through our youth link with ${TL.feederName(s, f)}, ${p.name} (${p.pos}, ${p.age}, ${TL.NAT_NAMES[nat] || nat}) has joined our academy. Our coaches rate his potential highly.`);
        TL.asManager(s, TL.ownerIndex(s, P.id), () => { s.inbox[0].action = { kind: 'player', id: p.id }; });
      }
      parentLoans(s, f, rng);
    }
  };
})();
