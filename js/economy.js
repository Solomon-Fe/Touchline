/* Touchline — economy module: contracts, wages, club finances, staff, training & development,
   scouting and the transfer market (including AI clubs buying and selling).
   Works for any number of human managers: money and messages go to whoever manages the club involved. */
(function () {
  const TL = window.TL, clamp = TL.clamp, Rng = TL.Rng;

  /* ---------- Tuning ---------- */
  TL.ECON = {
    tvMerit: 2.2,          // £m per league place above (size+1), scaled by league
    topFourPrize: 15,      // £m extra for a top-four finish in a top division (scaled by league)
    saleToBudget: 0.75,    // share of a sale fee the board adds to the transfer budget
    agentFeePct: 0.05,     // agent fee as a share of the transfer fee
    youthWeeklyGrowth: { 18: 0.16, 20: 0.12, 23: 0.07, 26: 0.025 }
  };

  const ROLES = { assistant: 'Assistant Manager', attCoach: 'Attacking Coach', defCoach: 'Defending Coach', gkCoach: 'Goalkeeping Coach', fitCoach: 'Fitness Coach', youthCoach: 'Head of Youth Development', scout: 'Chief Scout', physio: 'Head Physio' };
  TL.STAFF_ROLES = ROLES;
  TL.STAFF_EFFECT = {
    assistant: 'Match preparation and how fast the team learns a formation',
    attCoach: 'Development of attackers and midfielders',
    defCoach: 'Development of defenders and midfielders',
    gkCoach: 'Development of goalkeepers',
    fitCoach: 'Condition recovery and training injury risk',
    youthCoach: 'Quality of the yearly youth intake and academy development',
    scout: 'Accuracy and speed of scouting reports',
    physio: 'How quickly injured players recover'
  };
  TL.CONTRACT_ROLES = ['Star player', 'First team', 'Rotation', 'Backup', 'Youngster'];
  TL.TRAIN_FOCUS = { balanced: 'Balanced', attacking: 'Attacking', defending: 'Defending', tactical: 'Tactical', fitness: 'Fitness', setpieces: 'Set pieces' };

  const meId = s => s.manager.clubId;
  const mine = s => s.manager.clubId ? s.clubs[s.manager.clubId] : null;
  const econ = c => TL.econOf(c);
  const idHash = id => parseInt(TL.checksum(String(id)), 16) >>> 0;
  const isHuman = (s, clubId) => TL.ownerIndex(s, clubId) >= 0;
  // Currency display (stored values are £m / £k per week)
  TL.CURRENCIES = { GBP: { sym: '£', rate: 1 }, EUR: { sym: '€', rate: 1.17 }, USD: { sym: '$', rate: 1.27 }, NGN: { sym: '₦', rate: 2000 } };
  TL.currency = 'GBP';
  const cur = () => TL.CURRENCIES[TL.currency] || TL.CURRENCIES.GBP;
  TL.fmtM = v => {
    const c = cur(); v = v * c.rate;
    const a = Math.abs(v), sgn = v < 0 ? '-' : '';
    if (a >= 1000) return sgn + c.sym + (a / 1000).toFixed(a >= 10000 ? 0 : 1) + 'bn';
    if (a >= 1) return sgn + c.sym + (a >= 100 ? Math.round(a) : a >= 10 ? (Math.round(a * 10) / 10) : a.toFixed(2).replace(/0$/, '')) + 'm';
    return sgn + c.sym + Math.round(a * 1000) + 'k';
  };
  TL.fmtWage = k => { const c = cur(); const v = k * c.rate; return c.sym + (v >= 1000 ? (v / 1000).toFixed(2) + 'm' : v >= 10 ? Math.round(v) + 'k' : (Math.round(v * 10) / 10) + 'k') + '/wk'; };
  const roundFee = v => v >= 10 ? Math.round(v * 2) / 2 : v >= 1 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  TL.roundFee = roundFee;

  /* ---------- Contracts & wages ---------- */
  TL.wageFor = (p, rep, club) => {
    const base = 6.5 * Math.exp(0.105 * (p.ovr - 55));
    const ageF = p.age < 20 ? 0.45 : p.age < 22 ? 0.7 : p.age > 32 ? 0.85 : 1;
    const w = base * ageF * (0.75 + (rep || 70) / 200) * (club ? econ(club).wage : 1);
    return w >= 1 ? Math.round(w) : Math.max(0.1, Math.round(w * 10) / 10);
  };
  function makeContract(p, season, club, rng) {
    const yrs = p.age < 24 ? rng.int(2, 5) : p.age < 30 ? rng.int(1, 4) : rng.int(1, 2);
    return { wage: TL.wageFor(p, club.rep, club), end: season + yrs - 1, clause: rng.chance(0.18) ? roundFee(Math.max(0.2, p.value * econ(club).value) * rng.range(1.8, 3)) : null };
  }
  TL.makeContract = makeContract;
  TL.contractYearsLeft = (s, p) => p.contract ? p.contract.end - s.season + 1 : 0;
  TL.wageBill = (s, c) => c.players.reduce((t, id) => t + (s.players[id] && s.players[id].contract ? s.players[id].contract.wage : 0), 0);
  TL.staffBill = (s, c) => Object.values(c.staffIds || {}).reduce((t, id) => t + (id && s.staff[id] ? s.staff[id].wage : 0), 0) + (c.scoutTeam || []).reduce((t, a) => t + (s.staff[a.id] ? s.staff[a.id].wage : 0), 0);

  /* ---------- Staff ---------- */
  const STAFF_NATS = ['ENG', 'ENG', 'ESP', 'FRA', 'GER', 'ITA', 'NED', 'IRL', 'BRA', 'NGA', 'POR', 'ARG'];
  TL.staffWage = (r, club) => { const w = (2 + r * r * 0.16) * (club ? Math.max(0.05, econ(club).wage) : 1); return w >= 1 ? Math.round(w) : Math.round(w * 10) / 10; };
  function makeStaff(s, role, rating, rng, club) {
    const nat = club && rng.chance(0.6) ? club.country : rng.pick(STAFF_NATS);
    const st = { id: 'S' + (s.nextId++), role, name: TL.randomName(nat, rng), nat, age: rng.int(34, 66), rating: clamp(Math.round(rating), 1, 20), end: s.season + rng.int(1, 3) };
    st.wage = TL.staffWage(st.rating, club);
    s.staff[st.id] = st;
    return st;
  }
  TL.staffRating = (s, clubId, role) => { const c = s.clubs[clubId]; const id = c && c.staffIds && c.staffIds[role]; return id && s.staff[id] ? s.staff[id].rating : 3; };
  TL.physioFactor = (s, clubId) => 1.2 - TL.staffRating(s, clubId, 'physio') / 40;
  TL.hireStaff = function (s, staffId) {
    const st = s.staff[staffId], c = mine(s);
    const old = c.staffIds[st.role];
    if (old && s.staff[old]) { const o = s.staff[old]; TL.book(s, 'exp', 'staff', o.wage * 52 / 1000 * 0.5 * Math.max(1, o.end - s.season + 1)); delete s.staff[old]; }
    c.staffIds[st.role] = st.id; st.end = s.season + 2; st.wage = TL.staffWage(st.rating, c);
    s.staffPool = s.staffPool.filter(x => x !== staffId);
    TL.book(s, 'exp', 'staff', st.wage * 4 / 1000);
  };
  TL.fireStaff = function (s, role) {
    const c = mine(s), id = c.staffIds[role]; if (!id) return 0;
    const o = s.staff[id]; const comp = o.wage * 52 / 1000 * 0.5 * Math.max(1, o.end - s.season + 1);
    TL.book(s, 'exp', 'staff', comp);
    c.staffIds[role] = null; s.staffPool.push(id); o.wage = TL.staffWage(o.rating);
    return comp;
  };

  /* ---------- Finance ---------- */
  TL.revenueModel = c => { const e = econ(c), r = Math.max(0, c.rep - 45); return { tv: e.tv, sponsor: (3 + 0.03 * Math.pow(r, 2.1)) * e.sponsor, merch: (1 + 0.012 * Math.pow(r, 2.1)) * e.sponsor }; };
  TL.basePrice = c => Math.max(1, Math.round((25 + Math.max(0, c.rep - 55) * 1.3) * econ(c).ticket));
  TL.attendance = (s, c, rng) => {
    const base = TL.basePrice(c), price = c.ticketPrice || base;
    const demand = clamp(1 - (price / base - 1) * 0.55, 0.45, 1.12);
    const fill = clamp(0.84 + rng.range(0, 0.16) + (c.rep - 70) / 400 + ((c.fans ? c.fans.mood : 60) - 60) / 400, 0.4, 1);
    return Math.min(c.cap, Math.round(c.cap * fill * demand));
  };
  function ledgerMonth(s, m) {
    m = m || s.date.slice(0, 7);
    let L = s.ledger.find(x => x.m === m);
    if (!L) { L = { m, inc: {}, exp: {} }; s.ledger.push(L); s.ledger.sort((a, b) => a.m < b.m ? -1 : 1); if (s.ledger.length > 36) s.ledger.shift(); }
    return L;
  }
  // Book income/expense for the active manager's club (wrap in TL.asManager for other humans).
  TL.book = (s, kind, cat, amt, month) => {
    const c = mine(s);
    if (!amt || !c) return;
    const L = ledgerMonth(s, month);
    L[kind][cat] = Math.round(((L[kind][cat] || 0) + amt) * 1000) / 1000;
    c.finance.balance = Math.round((c.finance.balance + (kind === 'inc' ? amt : -amt)) * 1000) / 1000;
  };
  TL.setBudgets = (s, c, summer) => {
    const f = c.finance, e = econ(c);
    f.transferBudget = Math.max(0, roundFee(((10 + (c.rep - 55) * 3) * e.budget * (summer ? 1 : 0.4) + Math.max(0, f.balance) * (summer ? 0.25 : 0.1)) * ({ easy: 1.4, normal: 1, hard: 0.7 }[s.settings.difficulty] || 1)));
    f.wageBudget = Math.round((TL.wageBill(s, c) * 1.08 + 10 * e.wage) * 10) / 10;
  };
  TL.seasonFinance = (s, season) => {
    const out = { inc: {}, exp: {} };
    const from = `${season}-07`, to = `${season + 1}-06`;
    for (const L of s.ledger) if (L.m >= from && L.m <= to) for (const k of ['inc', 'exp']) for (const c in L[k]) out[k][c] = (out[k][c] || 0) + L[k][c];
    return out;
  };

  function monthTick(s, month) {
    const c = mine(s); if (!c) return;
    const e = econ(c);
    const days = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
    TL.book(s, 'exp', 'wages', TL.wageBill(s, c) * days / 7 / 1000, month);
    TL.book(s, 'exp', 'staff', TL.staffBill(s, c) * days / 7 / 1000, month);
    TL.book(s, 'exp', 'facilities', (0.15 + (c.facilities.training + c.facilities.youth) * 0.02 + ['medical', 'science', 'scouting', 'commercial', 'hospitality', 'pitch', 'fanzone'].reduce((a, k) => a + (c.facilities[k] || 0), 0) * 0.03) * Math.max(0.05, e.budget), month);
    TL.book(s, 'exp', 'operations', (1.5 + c.rep * 0.03 + c.cap / 60000) * Math.max(0.03, e.wage), month);
    const mm = +month.slice(5, 7), rm = TL.revenueModel(c);
    if (mm >= 8 || mm <= 5) TL.book(s, 'inc', 'tv', rm.tv / 10, month);
    TL.book(s, 'inc', 'sponsor', rm.sponsor / 12, month);
    const pos = TL.leaguePos(s, c.id) || 10;
    TL.book(s, 'inc', 'merch', rm.merch / 12 * (1.1 - pos / 100) * (1 + 0.07 * (c.facilities.commercial || 0)), month);
    for (const id of c.players) { const p = s.players[id]; p.hist = (p.hist || []).concat([[s.date, p.ovr]]).slice(-80); }
    const L = s.ledger.find(x => x.m === month);
    if (L) {
      const inc = Object.values(L.inc).reduce((a, b) => a + b, 0), exp = Object.values(L.exp).reduce((a, b) => a + b, 0);
      TL.addMail(s, 'finance', `Finance report: ${new Date(month + '-15T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
        `Income: ${TL.fmtM(inc)}\nExpenditure: ${TL.fmtM(exp)}\nResult: ${TL.fmtM(inc - exp)}\n\nBank balance: ${TL.fmtM(c.finance.balance)}\nTransfer budget: ${TL.fmtM(c.finance.transferBudget)}\n\nSee Finances for the full breakdown.`);
      s.inbox[0].read = true;
    }
    if (c.finance.balance < -30 * Math.max(0.05, e.budget) && !c._debtWarned) { c._debtWarned = true; TL.addMail(s, 'board', 'Club finances are in the red', `The club is ${TL.fmtM(-c.finance.balance)} in debt. Reduce the wage bill or sell players. If this continues the board will step in.`, true); }
    if (c.finance.balance > 0) c._debtWarned = false;
    if (mm === 1) {
      const exp = c.players.map(id => s.players[id]).filter(p => p.contract && p.contract.end <= s.season && !p.onLoan && !p.loan);
      if (exp.length) TL.addMail(s, 'assistant', 'Contracts expiring this summer', `These players will leave as free agents at the end of the season unless you offer new contracts:\n\n${exp.map(p => `• ${p.name} (${p.pos}, ${p.age}) – ${TL.fmtWage(p.contract.wage)}`).join('\n')}\n\nOpen a player's profile and choose Offer new contract.`, true);
    }
  }

  /* ---------- Scouting ---------- */
  TL.isKnown = (s, p) => p.clubId === meId(s) || !!s.scouted[p.id] || (s.manager.nationId && s.nations[s.manager.nationId] && s.nations[s.manager.nationId].code === p.nat);
  TL.abilityView = (s, p) => {
    if (TL.isKnown(s, p)) {
      const pw = p.age <= 21 ? 3 : p.age <= 24 ? 2 : 0;
      return { known: true, lo: p.ovr, hi: p.ovr, plo: Math.max(p.ovr, p.pot - pw), phi: Math.min(99, p.pot + pw) };
    }
    const sc = meId(s) ? TL.staffRating(s, meId(s), 'scout') : 8;
    const w = Math.max(1, Math.round(7 - sc / 3)), off = idHash(p.id) % 3 - 1;
    const pw = w + (p.age <= 21 ? 4 : p.age <= 24 ? 2 : 0);
    return { known: false, lo: p.ovr - w + off, hi: p.ovr + w + off, plo: Math.max(p.ovr - w, p.pot - pw), phi: Math.min(99, p.pot + pw) };
  };
  TL.requestScout = (s, pid) => {
    if (s.scouted[pid] || s.scoutQueue.some(q => q.id === pid)) return null;
    const sc = meId(s) ? TL.staffRating(s, meId(s), 'scout') : 8;
    const c0 = mine(s), net = c0 && c0.facilities ? c0.facilities.scouting || 0 : 0;
    const days = Math.max(1, Math.round(12 - sc * 0.5 - net * 0.8 - ((c0 && c0.scoutTeam) || []).length * 0.7));
    s.scoutQueue.push({ id: pid, due: TL.addDays(s.date, days) });
    return days;
  };
  function scoutReport(s, p) {
    const c = mine(s);
    const better = c ? c.players.map(id => s.players[id]).filter(x => TL.familiarity(x.pos, p.pos) >= 0.9 && x.ovr >= p.ovr).length : 3;
    const verdict = !c ? '' : better === 0 ? 'He would walk into our starting XI as a key player.' : better <= 1 ? 'He would be a regular starter for us.' : better <= 3 ? 'He would be a useful squad player.' : 'He would not improve our squad.';
    const v = TL.abilityView(s, p);
    const club = p.clubId ? s.clubs[p.clubId].name : p.abroad || 'Free agent';
    TL.addMail(s, 'scout', `Scout report: ${p.name}${TL.scoutGrade ? ' · grade ' + TL.scoutGrade(s, p).g : ''}`,`${p.name} (${p.pos}, ${p.age}, ${TL.NAT_NAMES[p.nat] || p.nat}) – ${club}\n\nCurrent ability: ${p.ovr}\nPotential: ${v.plo === v.phi ? v.phi : v.plo + '–' + v.phi}\nStrengths: ${topAttrs(p).join(', ')}\n\n${verdict}\n${p.clubId ? `Estimated asking price: ${TL.fmtM(TL.askingPrice(s, p))}` : p.abroad ? 'He plays outside the leagues we can trade in.' : 'Available on a free transfer.'}`);
    s.inbox[0].action = { kind: 'player', id: p.id };
  }
  const topAttrs = p => Object.keys(p.attrs).filter(k => p.pos === 'GK' || !TL.ATTRS.Goalkeeping.includes(k)).sort((a, b) => p.attrs[b] - p.attrs[a]).slice(0, 3).map(k => TL.ATTR_LABEL[k].toLowerCase());

  /* ---------- Transfer windows ---------- */
  TL.windowInfo = s => {
    const y = s.season, d = s.date;
    if (d <= `${y}-09-01`) return { open: true, name: 'Summer', closes: `${y}-09-01` };
    if (d >= `${y + 1}-01-01` && d <= `${y + 1}-02-02`) return { open: true, name: 'January', closes: `${y + 1}-02-02` };
    return { open: false, opens: d < `${y + 1}-01-01` ? `${y + 1}-01-01` : `${y + 1}-07-01` };
  };

  /* ---------- Valuation & AI decisions ---------- */
  TL.rankInClub = (s, p) => { if (!p.clubId) return 99; return s.clubs[p.clubId].players.filter(id => s.players[id] && s.players[id].ovr > p.ovr).length; };
  TL.askingPrice = (s, p) => {
    if (!p.clubId) return 0;
    const c = s.clubs[p.clubId];
    const yrs = TL.contractYearsLeft(s, p);
    let v = Math.max(0.05, p.value * econ(c).value) * (yrs <= 1 ? 0.6 : yrs === 2 ? 0.85 : 1.05);
    const rank = TL.rankInClub(s, p);
    v *= rank < 3 ? 1.6 : rank < 11 ? 1.3 : rank < 16 ? 1.05 : 0.85;
    if (p.age <= 23) v *= 1.1;
    v *= 0.9 + c.rep / 500;
    if (p.listed) v *= 0.8;
    if (!isHuman(s, c.id)) v *= s.settings.rules.transferDifficulty || 1;
    if (TL.feederDiscount) v *= TL.feederDiscount(s, p);
    return roundFee(v);
  };
  TL.expectedRole = (s, p) => {
    const c = mine(s); if (!c) return 2;
    const others = c.players.filter(id => id !== p.id).map(id => s.players[id]);
    const r = others.filter(x => x.ovr > p.ovr).length;
    if (r < 3) return 0; if (r < 11) return 1; if (p.age <= 20) return 4; if (r < 16) return 2; return 3;
  };
  TL.playerInterest = (s, p) => {
    const me = mine(s);
    if (!me || p.clubId === me.id || !p.clubId) return { ok: true };
    if (TL.isFeederOf && TL.isFeederOf(s, p.clubId, me.id)) return { ok: true };
    const curC = s.clubs[p.clubId];
    if (p.ovr >= 84 && me.rep < 72) return { ok: false, msg: `${p.name} wants to play for a club competing for major honours and won't discuss a move.` };
    if (curC.rep - me.rep > 12 && TL.rankInClub(s, p) < 14) return { ok: false, msg: `${p.name} is happy at ${curC.name} and isn't interested in joining a smaller club.` };
    return { ok: true };
  };
  TL.evaluateBid = (s, p, bid) => {
    const c = s.clubs[p.clubId];
    if (bid.loan) {
      const rank = TL.rankInClub(s, p);
      if (rank < 14 && p.age > 21) return { result: 'reject', msg: `${c.name} consider ${p.name} too important to loan out.` };
      if (p.age > 30) return { result: 'reject', msg: `${c.name} only loan out younger players.` };
      return { result: 'accept', msg: `${c.name} agree to a season-long loan. You will pay his full wages.` };
    }
    if (p.contract && p.contract.clause && bid.fee >= p.contract.clause) return { result: 'accept', msg: `You have met ${p.name}'s release clause of ${TL.fmtM(p.contract.clause)}. ${c.name} cannot refuse.` };
    const ask = TL.askingPrice(s, p);
    const instF = [1, 0.95, 0.9][(bid.instalments || 1) - 1];
    const sellOnF = instF + (bid.sellOn || 0) / 100 * 0.4;
    const eff = bid.fee * sellOnF;
    const need = ask * (1 - 0.025 * Math.min(bid.round || 0, 3));
    if (eff >= need - 0.001) return { result: 'accept', msg: `${c.name} have accepted your offer of ${TL.fmtM(bid.fee)} for ${p.name}.` };
    if (bid.round >= 4) return { result: 'reject', msg: `${c.name} have ended negotiations. They are tired of offers below their valuation.` };
    if (eff >= ask * 0.68) {
      const next = ask * (1 - 0.025 * Math.min((bid.round || 0) + 1, 3)) / sellOnF;
      const step = next >= 10 ? 0.5 : next >= 1 ? 0.1 : 0.01;
      const want = Math.round(Math.max(bid.fee + step, Math.ceil(next / step - 1e-9) * step) * 100) / 100;
      return { result: 'counter', fee: want, msg: `${c.name} reject the offer but would accept ${TL.fmtM(want)}${(bid.instalments || 1) > 1 ? ` paid over ${bid.instalments} years` : ''}.` };
    }
    return { result: 'reject', msg: `${c.name} reject the offer out of hand. They value ${p.name} far higher.` };
  };
  TL.wageDemand = (s, p, role, years, renewal) => {
    const me = mine(s);
    let w = TL.wageFor(p, me.rep, me);
    if (p.contract && p.contract.wage) w = Math.max(w, p.contract.wage * (renewal ? 1.08 : 1.2));
    const exp = TL.expectedRole(s, p);
    const ri = role === 4 ? 3 : role, ei = exp === 4 ? 3 : exp;
    const gap = ri - ei;
    w *= gap > 0 ? 1 + 0.15 * gap : 1 + 0.03 * gap;
    if (p.agentGreed) w *= 1 + p.agentGreed;
    const pref = p.age < 24 ? [3, 5] : p.age < 30 ? [2, 4] : [1, 2];
    const dist = years < pref[0] ? pref[0] - years : years > pref[1] ? years - pref[1] : 0;
    w *= 1 + 0.08 * dist;
    return { wage: w >= 1 ? Math.max(1, Math.round(w)) : Math.round(w * 10) / 10, refuse: gap >= 2, expected: exp, pref };
  };
  TL.evaluateContract = (s, p, offer, renewal) => {
    const d = TL.wageDemand(s, p, offer.role, offer.years, renewal);
    if (d.refuse) return { result: 'reject', msg: `${p.name} expects to be a ${TL.CONTRACT_ROLES[d.expected].toLowerCase()} player and won't accept a ${TL.CONTRACT_ROLES[offer.role].toLowerCase()} role.` };
    const r = offer.round || 0;
    if (offer.wage >= d.wage * (0.97 - 0.015 * Math.min(r, 3))) return { result: 'accept', msg: `${p.name} has agreed terms: ${TL.fmtWage(offer.wage)} for ${offer.years} year${offer.years > 1 ? 's' : ''}.` };
    if (r >= 4) return { result: 'reject', msg: `${p.name}'s agent has ended talks.` };
    const want = Math.max(offer.wage + (d.wage >= 10 ? 1 : 0.1), d.wage >= 10 ? Math.ceil(d.wage * (0.97 - 0.015 * Math.min(r + 1, 3))) : Math.ceil(d.wage * (0.97 - 0.015 * Math.min(r + 1, 3)) * 10) / 10);
    return { result: 'counter', wage: want, msg: `His agent wants ${TL.fmtWage(want)}${d.pref[0] !== d.pref[1] && (offer.years < d.pref[0] || offer.years > d.pref[1]) ? ` and would prefer a ${d.pref[0]}–${d.pref[1]} year deal` : ''}.` };
  };

  /* ---------- Completing deals ---------- */
  // News items can reference a player (pid) and a club so the UI can link them. kind: transfer | loan | rumour | release | award | club
  TL.news = (s, text, o) => { o = o || {}; s.news.unshift({ date: s.date, text, pid: o.pid || null, club: o.club || null, kind: o.kind || (/^Rumour/.test(text) ? 'rumour' : 'club') }); if (s.news.length > 160) s.news.length = 160; };
  TL.completeTransfer = function (s, pid, toId, fee, contract, opts) {
    opts = opts || {};
    const p = s.players[pid], fromId = p.clubId;
    const fromC = fromId && s.clubs[fromId], toC = toId && s.clubs[toId];
    const fromH = TL.ownerIndex(s, fromId), toH = TL.ownerIndex(s, toId);
    if (fromC) { fromC.players = fromC.players.filter(x => x !== pid); if (fromC.lineup) { fromC.lineup.xi = fromC.lineup.xi.map(x => x === pid ? null : x); fromC.lineup.bench = fromC.lineup.bench.filter(x => x !== pid); } if (fromC.captain === pid) fromC.captain = null; }
    else s.freeAgents = s.freeAgents.filter(x => x !== pid);
    if (toC) toC.players.push(pid); else s.freeAgents.push(pid);
    p.transfers = (p.transfers || []).concat([{ date: s.date, season: s.season, from: fromId, to: toId, fee, loan: !!opts.loan }]);
    if (p.sellOn && fee > p.sellOn.base) {
      const owed = (fee - p.sellOn.base) * p.sellOn.pct / 100;
      const onH = TL.ownerIndex(s, p.sellOn.club);
      if (onH >= 0) TL.asManager(s, onH, () => { TL.book(s, 'inc', 'sales', owed); TL.addMail(s, 'finance', 'Sell-on clause paid', `${TL.fmtM(owed)} sell-on payment received for ${p.name}.`); });
      if (fromH >= 0) TL.asManager(s, fromH, () => TL.book(s, 'exp', 'transfers', owed));
      p.sellOn = null;
    }
    if (opts.sellOn) p.sellOn = { club: fromId, pct: opts.sellOn, base: fee };
    if (opts.loan) p.loan = { parent: fromId, until: s.season, contract: p.contract };
    p.clubId = toId; p.contract = contract; p.listed = false; p.morale = Math.max(p.morale, 70); p.promise = null; p.requested = false;
    if (toH >= 0 && p.loanedBy !== toId) { p.hist = [[s.date, p.ovr]]; p.joined = s.date; } // returning loanees keep their history
    if (toH >= 0 && fee) TL.asManager(s, toH, () => {
      const n = opts.instalments || 1;
      TL.book(s, 'exp', 'transfers', fee / n);
      for (let i = 1; i < n; i++) s.payables.push({ season: s.season + i, amount: fee / n, desc: `${p.name} (instalment ${i + 1} of ${n})` });
      toC.finance.transferBudget = Math.max(0, roundFee(toC.finance.transferBudget - fee));
      if (opts.agentFee) TL.book(s, 'exp', 'agents', opts.agentFee);
    });
    if (fromH >= 0 && fee) TL.asManager(s, fromH, () => { TL.book(s, 'inc', 'sales', fee); fromC.finance.transferBudget = roundFee(fromC.finance.transferBudget + fee * TL.ECON.saleToBudget); });
    if (toC && toH < 0) toC.finance.transferBudget = Math.max(0, toC.finance.transferBudget - fee);
    if (fromC && fromH < 0) fromC.finance.transferBudget += fee * 0.6;
    const txt = opts.loan ? `${p.name} joins ${toC ? toC.name : '?'} on loan from ${fromC ? fromC.name : '?'}.` : !toId ? `${p.name} has been released by ${fromC ? fromC.name : 'his club'}.` : `${p.name} joins ${toC.name} from ${fromC ? fromC.name : 'free agency'}${fee ? ` for ${TL.fmtM(fee)}` : ' on a free transfer'}.`;
    TL.news(s, txt, { pid, club: toId || fromId, kind: opts.loan ? 'loan' : !toId ? 'release' : 'transfer' });
    return txt;
  };
  TL.releasePlayer = (s, pid) => {
    const p = s.players[pid];
    const pay = p.contract ? p.contract.wage * 52 / 1000 * TL.contractYearsLeft(s, p) * 0.5 : 0;
    if (pay) TL.book(s, 'exp', 'wages', pay);
    TL.completeTransfer(s, pid, null, 0, null, {});
    return pay;
  };
  TL.loanOut = (s, pid) => {
    const p = s.players[pid], c = s.clubs[p.clubId];
    const lower = { ENG: ['a Championship club', 'a League One club'], ESP: ['a Segunda División club'], ITA: ['a Serie B club'], GER: ['a 2. Bundesliga club'], FRA: ['a Ligue 2 club'], NGA: ['a Nigeria National League club'] }[c.country] || ['a lower-league club'];
    p.onLoan = { until: s.season, to: lower[idHash(pid) % lower.length] };
    if (c.lineup) { c.lineup.xi = c.lineup.xi.map(x => x === pid ? null : x); c.lineup.bench = c.lineup.bench.filter(x => x !== pid); }
    TL.news(s, `${p.name} has joined ${p.onLoan.to} on loan from ${c.name}.`, { pid, club: c.id, kind: 'loan' });
    return p.onLoan.to;
  };

  /* ---------- Offers to human clubs ---------- */
  function offerToHuman(s, buyer, p, rng) {
    if (s.offers.some(o => o.pid === p.id && o.status === 'open')) return;
    const prev = s.offers.filter(o => o.pid === p.id && o.club === buyer.id && o.status === 'rejected').pop();
    if (prev && TL.daysBetween(prev.date, s.date) < 21) return;
    const ask = TL.askingPrice(s, p);
    let fee = roundFee(ask * rng.range(0.72, 1.05) * (p.star && p.ovr >= 80 ? 1.3 : 1));
    if (prev) fee = Math.max(fee, roundFee(prev.fee * 1.12));
    if (fee > buyer.finance.transferBudget * 1.1) return;
    const o = { id: s.nextId++, pid: p.id, club: buyer.id, fee, max: roundFee(Math.min(ask * 1.3, buyer.finance.transferBudget * 1.2)), status: 'open', date: s.date };
    s.offers.push(o);
    const h = TL.ownerIndex(s, p.clubId);
    TL.asManager(s, h, () => {
      TL.addMail(s, 'transfers', `${buyer.name} bid ${TL.fmtM(fee)} for ${p.name}`, `${buyer.name} have made an offer of ${TL.fmtM(fee)} for ${p.name}.\n\nOur valuation is around ${TL.fmtM(ask)}. ${p.name} has ${TL.contractYearsLeft(s, p)} year(s) left on his contract.\n\nAccept, reject, or ask for more.`, true);
      s.inbox[0].action = { kind: 'offer', id: o.id };
    });
    if (rng.chance(0.6)) TL.news(s, `Rumour: ${buyer.name} have made an approach for ${p.name}.`, { pid: p.id, club: buyer.id, kind: 'rumour' });
  }
  TL.offerToHuman = offerToHuman;
  // Haggling over a bid for one of your players: you name a price, they move towards their (hidden) maximum,
  // and they lose patience if you ask for too much for too long.
  TL.haggle = (s, id, ask) => {
    const o = s.offers.find(x => x.id === id); if (!o || o.status !== 'open') return { result: 'closed', msg: 'This offer is no longer available.' };
    const p = s.players[o.pid], buyer = s.clubs[o.club];
    if (!TL.windowInfo(s).open) { o.status = 'expired'; return { result: 'closed', msg: 'The transfer window has closed.' }; }
    ask = roundFee(Math.max(0, ask));
    const rng = new Rng(idHash(o.id + ':' + (o.round || 0) + ':' + ask));
    o.round = (o.round || 0) + 1;
    if (o.patience == null) o.patience = 2 + (idHash(o.id) % 3); // 2–4 rounds before they give up
    if (ask <= o.fee) return { result: 'accept', fee: o.fee, msg: `That is below what we already offered. We will happily pay ${TL.fmtM(o.fee)}.` };
    if (ask <= o.max) { o.fee = ask; return { result: 'accept', fee: ask, msg: `${buyer.name} agree to pay ${TL.fmtM(ask)} for ${p.name}. Shake hands?` }; }
    // too greedy: lose patience faster
    const greed = ask / o.max;
    o.patience -= greed > 1.6 ? 2 : 1;
    if (o.patience < 0 || greed > 2.2) {
      o.status = 'rejected';
      if (p.requested) p.morale = clamp(p.morale - 8, 5, 100);
      TL.news(s, `${buyer.name} walk away from talks for ${p.name}.`, { pid: p.id, club: buyer.id, kind: 'rumour' });
      return { result: 'walk', msg: greed > 2.2 ? `${buyer.name} laugh at the price and end the talks. They are no longer interested.` : `${buyer.name} have lost patience. They withdraw their interest in ${p.name}.` };
    }
    // they climb towards their limit in steps, not all at once
    const step = rng.range(0.3, 0.5), gap = o.max - o.fee;
    let next = roundFee(Math.min(o.max, o.fee + gap * step));
    if (o.patience <= 0 || gap < Math.max(0.05, o.max * 0.03)) next = o.max;
    const final = next >= o.max - 0.001;
    o.fee = Math.max(o.fee, next);
    return { result: 'counter', fee: o.fee, final, msg: final ? `${buyer.name} say ${TL.fmtM(o.fee)} is their final offer. They will not go higher.` : `${buyer.name} cannot meet ${TL.fmtM(ask)}, but raise their bid to ${TL.fmtM(o.fee)}.` };
  };
  TL.respondOffer = (s, id, how) => {
    const o = s.offers.find(x => x.id === id); if (!o || o.status !== 'open') return 'This offer is no longer available.';
    const p = s.players[o.pid], buyer = s.clubs[o.club];
    if (!TL.windowInfo(s).open) { o.status = 'expired'; return 'The transfer window has closed.'; }
    if (how === 'reject') { o.status = 'rejected'; if (p.requested || p.star) p.morale = clamp(p.morale - 10, 5, 100); return `You rejected ${buyer.name}'s offer for ${p.name}.`; }
    if (how === 'counter') {
      const ask = roundFee(o.fee * 1.25);
      if (ask <= o.max) { o.fee = ask; how = 'accept'; }
      else { o.status = 'rejected'; return `${buyer.name} refuse to pay ${TL.fmtM(ask)} and withdraw their interest.`; }
    }
    if (how === 'accept') {
      o.status = 'accepted';
      TL.completeTransfer(s, p.id, buyer.id, o.fee, { wage: Math.round(Math.max(TL.wageFor(p, buyer.rep, buyer), p.contract ? p.contract.wage * 1.15 : 0)), end: s.season + 3, clause: null }, {});
      return `${p.name} has been sold to ${buyer.name} for ${TL.fmtM(o.fee)}.`;
    }
    return '';
  };

  /* ---------- AI transfer market ---------- */
  function aiTryBuy(s, c, rng) {
    const slots = TL.FORMATIONS[c.tactics.formation];
    const xi = TL.pickXI(s, c, c.tactics.formation, { ignoreCondition: true });
    let wv = 999, worst = 0;
    xi.forEach((id, i) => { const v = id ? s.players[id].ovr * TL.familiarity(s.players[id].pos, slots[i][0]) : 0; if (v < wv) { wv = v; worst = i; } });
    const pos = slots[worst][0], budget = c.finance.transferBudget;
    const cands = [];
    for (const id in s.players) {
      const p = s.players[id];
      if (p.clubId === c.id || p.onLoan || p.loan || p.abroad || p.trialist || p.academy || p.age > 31 || TL.familiarity(p.pos, pos) < 0.9) continue;
      const minOvr = p.listed ? wv : wv + 3;
      if (p.ovr < minOvr || p.ovr > wv + 14) continue;
      if (p.clubId) {
        const owner = s.clubs[p.clubId];
        if (owner.rep > c.rep + 8 && TL.rankInClub(s, p) < 14) continue;
        if (isHuman(s, p.clubId) && !p.listed && !p.requested && !rng.chance(0.35)) continue;
        if (TL.askingPrice(s, p) > budget) continue;
      } else if (TL.wageFor(p, c.rep, c) > Math.max(1, TL.wageBill(s, c) / 12)) continue;
      cands.push(p);
    }
    if (!cands.length) return;
    const t = rng.weighted(cands, p => (1 + p.ovr - wv) * (p.listed || p.requested ? 4 : 1) * (p.clubId ? 1 : 0.6));
    if (!t.clubId) TL.completeTransfer(s, t.id, c.id, 0, { wage: TL.wageFor(t, c.rep, c), end: s.season + rng.int(0, 2), clause: null }, {});
    else if (isHuman(s, t.clubId)) offerToHuman(s, c, t, rng);
    else if (rng.chance(0.6)) {
      const fee = roundFee(TL.askingPrice(s, t) * rng.range(0.95, 1.08));
      TL.completeTransfer(s, t.id, c.id, fee, { wage: Math.max(TL.wageFor(t, c.rep, c), t.contract ? Math.round(t.contract.wage * 1.1 * 10) / 10 : 0), end: s.season + rng.int(2, 4), clause: null }, {});
    }
    if (c.players.length > 27) {
      const out = c.players.map(id => s.players[id]).filter(p => p.age >= 24 && !p.wonderkid).sort((a, b) => a.ovr - b.ovr)[0];
      if (out) TL.completeTransfer(s, out.id, null, 0, null, {});
    }
  }
  function aiMarketWeek(s, rng, intensity) {
    for (const id in s.clubs) { if (isHuman(s, id)) continue; if (rng.chance(0.15 * intensity)) aiTryBuy(s, s.clubs[id], rng); }
  }
  function aiFreeAgentWeek(s, c, rng) {
    if (c.players.length >= 24) return;
    const fa = s.freeAgents.map(id => s.players[id]).filter(p => p && p.age <= 32).sort((a, b) => b.ovr - a.ovr)[0];
    if (fa && fa.ovr >= TL.squadStrength(s, c) - 10) TL.completeTransfer(s, fa.id, c.id, 0, { wage: TL.wageFor(fa, c.rep, c), end: s.season + 1, clause: null }, {});
  }

  /* ---------- Training & development ---------- */
  const coachFor = (s, c, p) => {
    if (p.academy || (p.youth && p.age <= 18)) return (TL.staffRating(s, c.id, 'youthCoach') * 2 + TL.staffRating(s, c.id, TL.POS_GROUP[p.pos] === 'DEF' ? 'defCoach' : 'attCoach')) / 3;
    const g = TL.POS_GROUP[p.pos];
    if (g === 'GK') return TL.staffRating(s, c.id, 'gkCoach');
    if (g === 'ATT') return TL.staffRating(s, c.id, 'attCoach');
    if (g === 'DEF') return TL.staffRating(s, c.id, 'defCoach');
    return (TL.staffRating(s, c.id, 'attCoach') + TL.staffRating(s, c.id, 'defCoach')) / 2;
  };
  TL.improvePlayer = (p, n, rng, bias) => {
    const old = p.ovr;
    p.ovr = Math.min(p.ovr + n, Math.max(p.pot, p.ovr));
    const gained = p.ovr - old; if (!gained) return 0;
    const pool = p.pos === 'GK' ? TL.ATTRS.Goalkeeping.concat(['composure', 'decisions', 'positioning', 'agility']) : TL.ATTRS.Technical.concat(TL.ATTRS.Mental, TL.ATTRS.Physical);
    let pts = 6 * gained;
    if (p.trainFocus && p.attrs[p.trainFocus] < 20) { p.attrs[p.trainFocus]++; pts--; if (rng.chance(0.4) && p.attrs[p.trainFocus] < 20) { p.attrs[p.trainFocus]++; pts--; } }
    if (bias && bias.length) for (let i = 0; i < 2 && pts > 1; i++) { const k = rng.pick(bias); if (p.attrs[k] != null && p.attrs[k] < 20) { p.attrs[k]++; pts--; } }
    if (p.style && TL.STYLE_ATTRS && TL.STYLE_ATTRS[p.style]) { const k = rng.pick(TL.STYLE_ATTRS[p.style]); if (p.attrs[k] < 20) { p.attrs[k]++; pts--; } }
    let guard = 40;
    while (pts > 0 && guard-- > 0) { const k = rng.pick(pool); if (p.attrs[k] < 20) { p.attrs[k]++; pts--; } }
    p.value = TL.marketValue(p);
    return gained;
  };
  const leagueGamesPlayed = (s, c) => Math.max(1, s.fixtures.filter(f => f.played && f.comp === c.leagueId && (f.home === c.id || f.away === c.id)).length);
  TL.weeklyGrowthRate = (s, c, p, rounds) => {
    if (p.pot <= p.ovr || p.age > 26) return 0;
    const G = TL.ECON.youthWeeklyGrowth;
    const ageRate = p.age <= 18 ? G[18] : p.age <= 20 ? G[20] : p.age <= 23 ? G[23] : G[26];
    const gapF = Math.min(1, (p.pot - p.ovr) / 8);
    const coach = 0.6 + coachFor(s, c, p) / 25;
    const prof = 0.7 + p.hidden.professionalism / 33;
    rounds = rounds || leagueGamesPlayed(s, c);
    const play = p.onLoan ? (p.onLoan.feeder ? 1.3 : 1.15) : p.academy ? 0.95 : 0.8 + 0.4 * Math.min(1, p.stats.apps / rounds);
    const inten = TL.trainGrowthMult ? TL.trainGrowthMult(s, c, p) : [0.75, 1, 1.25][c.training.intensity];
    const fac = 0.8 + (p.academy ? c.facilities.youth : c.facilities.training) / 50;
    const mentor = p.mentor && s.players[p.mentor] && s.players[p.mentor].clubId === c.id ? 1.08 : 1;
    return ageRate * gapF * coach * prof * play * inten * fac * mentor;
  };
  function trainingWeek(s, c, rng, gamesMap) {
    const tr = c.training;
    const assist = TL.staffRating(s, c.id, 'assistant');
    for (const f in c.fam) c.fam[f] = f === c.tactics.formation ? Math.min(100, c.fam[f] + (tr.focus === 'tactical' ? 9 : 4) + assist / 8) : Math.max(30, c.fam[f] - 1);
    const fit = TL.staffRating(s, c.id, 'fitCoach');
    const improved = [], human = isHuman(s, c.id);
    const rounds = gamesMap ? Math.max(1, gamesMap[c.id] || 0) : leagueGamesPlayed(s, c);
    for (const id of c.players) {
      const p = s.players[id];
      // mentoring: a veteran mentor slowly lifts a youngster's professionalism
      if (p.mentor && s.players[p.mentor] && s.players[p.mentor].clubId === c.id && rng.chance(0.06) && p.hidden.professionalism < 20) p.hidden.professionalism++;
      const g = TL.weeklyGrowthRate(s, c, p, rounds);
      if (g > 0) {
        p.prog = (p.prog || 0) + g * (0.8 + rng.next() * 0.4);
        if (p.prog >= 1) { p.prog -= 1; if (TL.improvePlayer(p, 1, rng, TL.attrBias ? TL.attrBias(s, c, p) : null) && human) improved.push(p); }
      }
    }
    if (improved.length) TL.mailClub(s, c.id, 'assistant', 'Training report', `Good progress on the training ground this week:\n\n${improved.map(p => `• ${p.name} improved to ${p.ovr}`).join('\n')}`);
  }

  /* ---------- Daily tick (called from TL.advanceDays) ---------- */
  TL.dayTick = function (s, prev, date, rng) {
    if (!s.staff) return;
    const newMonth = prev.slice(0, 7) !== date.slice(0, 7);
    s.managers.forEach((m, i) => TL.asManager(s, i, () => {
      if (newMonth) monthTick(s, prev.slice(0, 7));
      for (const q of s.scoutQueue.filter(q => q.due <= date)) { s.scouted[q.id] = date; if (s.players[q.id]) scoutReport(s, s.players[q.id]); }
      s.scoutQueue = s.scoutQueue.filter(q => q.due > date);
    }));
    const w = TL.windowInfo(s);
    if (w.open !== !!s._winOpen) {
      s._winOpen = w.open;
      if (w.open) {
        if (w.name === 'January') for (const id in s.clubs) if (!isHuman(s, id)) TL.setBudgets(s, s.clubs[id], false);
        s.managers.forEach((m, i) => TL.asManager(s, i, () => {
          const c = mine(s);
          if (c && w.name === 'January') c.finance.transferBudget = roundFee(c.finance.transferBudget + Math.max(0, c.finance.balance) * 0.05);
          if (c) TL.addMail(s, 'transfers', `The ${w.name.toLowerCase()} transfer window is open`, `You can now buy, sell and loan players until ${TL.fmtDate(w.closes, true)}.\n\nTransfer budget: ${TL.fmtM(c.finance.transferBudget)}`);
        }));
      } else {
        for (const o of s.offers) if (o.status === 'open') o.status = 'expired';
        s.managers.forEach((m, i) => { if (m.clubId) TL.asManager(s, i, () => TL.addMail(s, 'transfers', 'The transfer window has closed', `No more transfers until ${TL.fmtDate(w.opens, true)}. You can still sign free agents.`)); });
      }
    }
    if (w.open && date === w.closes) { s.managers.forEach((m, i) => { if (m.clubId) TL.asManager(s, i, () => TL.addMail(s, 'transfers', 'Deadline day!', 'The window closes at midnight. Clubs are scrambling to get deals done.', true)); }); aiMarketWeek(s, rng, 3); }
    if (new Date(date + 'T12:00:00Z').getUTCDay() === 1) {
      const games = {};
      for (const f of s.fixtures) if (f.played && s.clubs[f.home] && f.comp === s.clubs[f.home].leagueId) { games[f.home] = (games[f.home] || 0) + 1; games[f.away] = (games[f.away] || 0) + 1; }
      for (const id in s.clubs) trainingWeek(s, s.clubs[id], rng, games);
      if (w.open) aiMarketWeek(s, rng, 1);
      else if (rng.chance(0.4)) { const ids = Object.keys(s.clubs).filter(id => !isHuman(s, id)); aiFreeAgentWeek(s, s.clubs[rng.pick(ids)], rng); }
    }
  };

  /* ---------- Setup, migration, season hooks ---------- */
  function makeFreeAgent(s, rng) {
    const nat = rng.pick(['ENG', 'ENG', 'FRA', 'ESP', 'ITA', 'GER', 'BRA', 'ARG', 'NGA', 'NED', 'POR', 'SEN', 'GHA', 'SCO', 'IRL', 'USA', 'MAR', 'SRB']);
    const pos = rng.pick(TL.POSITIONS.concat(['CB', 'CM', 'ST']));
    const p = TL.generateYouth(s, null, rng, { nat, pos, age: rng.int(21, 34), ovr: rng.int(58, 76), youth: false, prefix: 'F' });
    p.contract = null;
    s.freeAgents.push(p.id);
    return p;
  }
  TL.initEconomy = function (s, rng) {
    s.staff = s.staff || {}; s.offers = s.offers || []; s.news = s.news || []; s.freeAgents = s.freeAgents || []; s.staffPool = s.staffPool || [];
    for (const id in s.clubs) {
      const c = s.clubs[id], e = econ(c);
      for (const pid of c.players) { const p = s.players[pid]; if (!p.contract) p.contract = makeContract(p, s.season, c, rng); p.hist = p.hist || [[s.date, p.ovr]]; p.transfers = p.transfers || []; p.prog = p.prog || 0; }
      c.finance = { balance: Math.round(Math.max(2, (c.rep - 40) * 3) * e.budget * 10) / 10, transferBudget: 0, wageBudget: 0 };
      c.facilities = c.facilities || { training: clamp(Math.round(6 + (c.rep - 55) / 3), 3, 19), youth: clamp(Math.round(5 + (c.rep - 55) / 3.5), 3, 18) };
      c.training = { focus: 'balanced', intensity: 1 };
      c.fam = {}; for (const f in TL.FORMATIONS) c.fam[f] = f === c.tactics.formation ? 80 : 45;
      c.ticketPrice = TL.basePrice(c);
      c.staffIds = {};
      const q = 6 + (c.rep - 55) / 3.2;
      for (const role in ROLES) c.staffIds[role] = makeStaff(s, role, q + rng.normal() * 2, rng, c).id;
      c.fans = c.fans || { mood: 60, size: Math.round(c.cap * (0.8 + c.rep / 100)) };
      TL.setBudgets(s, c, true);
    }
    for (let i = 0; i < 30; i++) makeFreeAgent(s, rng);
    const roles = Object.keys(ROLES);
    for (let i = 0; i < 28; i++) s.staffPool.push(makeStaff(s, roles[i % roles.length], rng.int(5, 17), rng).id);
    s._winOpen = TL.windowInfo(s).open;
  };
  TL.migrate = function (s) {
    if (!s.managers) return TL.migrateV2(s);
    TL.link(s);
    return s;
  };

  TL.econSeasonEnd = function (s, rng, report) {
    s.managers.forEach((m, i) => TL.asManager(s, i, () => {
      const r = report[i], c = mine(s); if (!r || !c) return;
      const e = TL.LEAGUE_ECON[r.league] || econ(c), size = (TL.leagueDef(s, r.league) || { size: 20 }).size;
      const prize = (TL.ECON.tvMerit * (size + 1 - r.pos) + (r.pos <= 4 && TL.leagueDef(s, r.league).tier === 1 ? TL.ECON.topFourPrize : 0)) * Math.max(0.02, e.tv / 95);
      TL.book(s, 'inc', 'prize', prize);
    }));
    const left = {};
    for (const id of Object.keys(s.players)) {
      const p = s.players[id]; if (!p) continue;
      if (p.onLoan && p.onLoan.until <= s.season) { if (p.clubId) TL.mailClub(s, p.clubId, 'assistant', `${p.name} returns from loan`, `${p.name} is back from his loan spell at ${p.onLoan.to}. Regular football has helped him: he is now rated ${p.ovr}.`); p.onLoan = null; }
      if (p.loan && p.loan.until <= s.season) { const back = p.loan; p.loan = null; if (s.clubs[back.parent]) TL.completeTransfer(s, id, back.parent, 0, back.contract, {}); }
    }
    for (const id of Object.keys(s.players)) {
      const p = s.players[id]; if (!p || !p.clubId || !p.contract || p.contract.end > s.season) continue;
      const c = s.clubs[p.clubId];
      if (isHuman(s, c.id)) { (left[c.id] = left[c.id] || []).push(p.name); TL.completeTransfer(s, id, null, 0, null, {}); }
      else if ((p.age >= 32 && rng.chance(0.5)) || (p.ovr < TL.squadStrength(s, c) - 8 && rng.chance(0.6))) TL.completeTransfer(s, id, null, 0, null, {});
      else p.contract = makeContract(p, s.season + 1, c, rng);
    }
    for (const cid in left) TL.mailClub(s, cid, 'assistant', 'Players leaving on free transfers', `These players' contracts have expired and they have left the club:\n\n${left[cid].map(n => '• ' + n).join('\n')}`);
    for (const id of s.freeAgents.slice()) {
      const p = s.players[id];
      if (!p || p.age >= 33 || (p.age >= 30 && rng.chance(0.4))) { s.freeAgents = s.freeAgents.filter(x => x !== id); delete s.players[id]; }
      else p.ovr = Math.max(45, p.ovr - 1);
    }
    while (s.freeAgents.length < 28) makeFreeAgent(s, rng);
    for (const cid of TL.humanClubIds(s)) { const c = s.clubs[cid]; for (const role in c.staffIds) { const st = s.staff[c.staffIds[role]]; if (st && st.end <= s.season) { st.end = s.season + 2; st.wage = Math.round(st.wage * 1.05 * 10) / 10; } } }
  };
  TL.econSeasonStart = function (s, rng) {
    for (const id in s.clubs) { const c = s.clubs[id]; c.ticketPrice = isHuman(s, id) ? c.ticketPrice : TL.basePrice(c); TL.setBudgets(s, c, true); }
    const roles = Object.keys(ROLES);
    s.staffPool = s.staffPool.filter((id, i) => i % 2 === 0 && s.staff[id]);
    while (s.staffPool.length < 28) s.staffPool.push(makeStaff(s, roles[s.staffPool.length % roles.length], rng.int(5, 18), rng).id);
    s.managers.forEach((m, i) => TL.asManager(s, i, () => {
      const c = mine(s); if (!c) return;
      const due = s.payables.filter(x => x.season <= s.season);
      for (const d of due) TL.book(s, 'exp', 'transfers', d.amount);
      s.payables = s.payables.filter(x => x.season > s.season);
      if (due.length) TL.addMail(s, 'finance', 'Transfer instalments paid', `${due.length} instalment payment(s) totalling ${TL.fmtM(due.reduce((a, d) => a + d.amount, 0))} have been paid.`);
      const f = c.finance;
      TL.addMail(s, 'board', 'Budgets for the new season', `The board has set your budgets for ${s.season}/${String(s.season + 1).slice(2)}:\n\nTransfer budget: ${TL.fmtM(f.transferBudget)}\nWage budget: ${TL.fmtWage(f.wageBudget)} (current bill ${TL.fmtWage(TL.wageBill(s, c))})\nBank balance: ${TL.fmtM(f.balance)}`, true);
    }));
    s._winOpen = TL.windowInfo(s).open;
  };
})();
