/* Touchline — world module: managers, calendar, competitions (leagues, cups, Champions League, play-offs),
   day-by-day match processing, promotion/relegation and the season cycle. No DOM access. */
(function () {
  const TL = window.TL, Rng = TL.Rng, clamp = TL.clamp;

  /* ---------- Dates ---------- */
  TL.addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  TL.daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
  TL.fmtDate = (iso, long) => new Date(iso + 'T12:00:00Z').toLocaleDateString(TL.locale || 'en-GB', long ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const dow = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
  const nextDow = (iso, d) => { let x = iso; while (dow(x) !== d) x = TL.addDays(x, 1); return x; };

  /* ---------- Lookups ---------- */
  TL.team = (s, id) => (id && (s.clubs[id] || (s.nations && s.nations[id]))) || null;
  TL.econOf = c => (c && TL.LEAGUE_ECON[c.leagueId]) || TL.LEAGUE_ECON.ENG1;
  TL.leagueDef = (s, id) => s.leagueDefs.find(l => l.id === id);
  TL.leagueClubs = (s, leagueId) => Object.values(s.clubs).filter(c => c.leagueId === leagueId);

  /* ---------- Managers (hot-seat ready: each human has their own inbox, board, ledger, scouting) ---------- */
  const PER_MANAGER = ['inbox', 'board', 'nboard', 'ledger', 'payables', 'shortlist', 'scouted', 'scoutQueue'];
  TL.newManager = (name, o) => ({
    id: 'M' + Math.random().toString(36).slice(2, 8), name: name || 'The Gaffer', clubId: (o && o.clubId) || null, nationId: (o && o.nationId) || null,
    rep: (o && o.rep) || 40, wins: 0, draws: 0, losses: 0, nrec: { w: 0, d: 0, l: 0 }, trophies: [], career: [],
    inbox: [], board: { confidence: 62, target: 10 }, nboard: { confidence: 65, target: '' }, ledger: [], payables: [], shortlist: [], scouted: {}, scoutQueue: [],
    achievements: {}, applied: [], tutorial: 0, unemployedSince: null
  });
  TL.link = s => {
    Object.defineProperty(s, 'manager', { configurable: true, enumerable: false, get() { return this.managers[this.active || 0]; } });
    for (const k of PER_MANAGER) Object.defineProperty(s, k, { configurable: true, enumerable: false, get() { return this.managers[this.active || 0][k]; }, set(v) { this.managers[this.active || 0][k] = v; } });
    return s;
  };
  TL.asManager = (s, i, fn) => { const prev = s.active; s.active = i; try { return fn(); } finally { s.active = prev; } };
  TL.ownerIndex = (s, teamId) => teamId ? s.managers.findIndex(m => m.clubId === teamId || m.nationId === teamId) : -1;
  TL.isHumanTeam = (s, id) => TL.ownerIndex(s, id) >= 0;
  TL.mailClub = (s, teamId, from, subject, body, important) => { const i = TL.ownerIndex(s, teamId); if (i >= 0) TL.asManager(s, i, () => TL.addMail(s, from, subject, body, important)); };
  TL.mailAll = (s, from, subject, body, important) => s.managers.forEach((m, i) => TL.asManager(s, i, () => TL.addMail(s, from, subject, body, important)));
  TL.recordManagerResult = (s, teamId, res) => {
    for (const m of s.managers) {
      if (m.clubId === teamId) { if (res === 'W') m.wins++; else if (res === 'D') m.draws++; else m.losses++; }
      if (m.nationId === teamId) { m.nrec[res === 'W' ? 'w' : res === 'D' ? 'd' : 'l']++; }
    }
  };
  TL.humanClubIds = s => s.managers.map(m => m.clubId).filter(Boolean);

  /* ---------- Season calendar ---------- */
  TL.calendar = function (season) {
    const first = nextDow(`${season}-08-14`, 6), lastLimit = `${season + 1}-05-24`;
    const breaks = [`${season}-09-06`, `${season}-10-11`, `${season}-11-15`, `${season + 1}-03-28`].map(a => nextDow(TL.addDays(a, -3), 6));
    const weekends = [];
    for (let d = first; d <= lastLimit; d = TL.addDays(d, 7)) if (!breaks.includes(d)) weekends.push(d);
    const lastSat = weekends[weekends.length - 1];
    const weds = [];
    for (let d = nextDow(`${season}-09-08`, 3); d <= `${season + 1}-05-13`; d = TL.addDays(d, 7)) if (!breaks.some(b => Math.abs(TL.daysBetween(b, d)) <= 4)) weds.push(d);
    const pick = idx => idx.map(i => weds[Math.min(i, weds.length - 1)]);
    const clGroup = pick([1, 3, 5, 7, 9, 11]), clKO = pick([15, 16, 18, 19, 21, 22]), cup = pick([0, 2, 4, 6, 8, 12, 14, 17]);
    const used = new Set(clGroup.concat(clKO, cup));
    const festive = [`${season}-12-26`, `${season + 1}-01-01`].filter(d => dow(d) !== 6 && dow(d) !== 3);
    return {
      season, weekends, breaks, lastSat, clGroup, clKO, clFinal: TL.addDays(lastSat, 14), cup, cupFinal: TL.addDays(lastSat, 7),
      playoffSemi: TL.addDays(lastSat, 4), playoffFinal: TL.addDays(lastSat, 8),
      // midweek/festive league dates never sit right next to a weekend fixture
      extraLeague: festive.concat(weds.filter(w => !used.has(w)).map(w => TL.addDays(w, -1))).filter(d => !weekends.some(w => Math.abs(TL.daysBetween(w, d)) <= 1)).sort(),
      intl: breaks.map(b => [TL.addDays(b, -2), TL.addDays(b, 1)]),
      summer: [8, 11, 14, 17, 20, 23, 26, 29].map(d => `${season + 1}-06-${String(d).padStart(2, '0')}`)
    };
  };
  TL.leagueDates = (cal, n) => {
    const W = cal.weekends;
    if (n <= W.length) return Array.from({ length: n }, (_, i) => W[Math.round(i * (W.length - 1) / Math.max(1, n - 1))]);
    return W.concat(cal.extraLeague.slice(0, n - W.length)).sort();
  };

  /* ---------- Fixtures ---------- */
  const mkFx = (s, comp, round, date, home, away, extra) => { const f = Object.assign({ id: s.nextId++, comp, round, date, home, away, hg: null, ag: null, played: false, kind: 'club' }, extra || {}); s.fixtures.push(f); return f; };
  TL.mkFixture = mkFx;
  // Venue choice that keeps home and away alternating: home goes to the team that has been away longer,
  // then to the team with fewer home games. streak > 0 = consecutive homes, < 0 = consecutive aways.
  const pickHome = (a, b, st, tieBreak) => {
    const sa = st[a] || { streak: 0, homes: 0 }, sb = st[b] || { streak: 0, homes: 0 };
    if (sa.streak !== sb.streak) return sa.streak < sb.streak;
    if (sa.homes !== sb.homes) return sa.homes < sb.homes;
    return tieBreak;
  };
  const noteVenue = (st, h, a) => {
    const H = st[h] = st[h] || { streak: 0, homes: 0 }, A = st[a] = st[a] || { streak: 0, homes: 0 };
    H.homes++; H.streak = H.streak > 0 ? H.streak + 1 : 1; A.streak = A.streak < 0 ? A.streak - 1 : -1;
  };
  // Circle-method round robin. Returns rounds of [home, away] pairs (double = home and away legs).
  TL.roundRobin = (ids, rng, double) => {
    const arr = rng ? rng.shuffle(ids.slice()) : ids.slice();
    if (arr.length % 2) arr.push(null);
    const n = arr.length, rounds = [], st = {};
    for (let r = 0; r < n - 1; r++) {
      const games = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        if (!a || !b) continue;
        const [h, w] = pickHome(a, b, st, (i + r) % 2 === 0) ? [a, b] : [b, a];
        games.push([h, w]); noteVenue(st, h, w);
      }
      rounds.push(games);
      arr.splice(1, 0, arr.pop());
    }
    return double ? rounds.concat(rounds.map(g => g.map(([h, a]) => [a, h]))) : rounds;
  };
  // Re-balance home/away for league fixtures not yet played (used once on older saves).
  // Only pairs whose two meetings are both unplayed are swapped, so every club still plays each opponent home and away.
  TL.rebalanceFixtures = s => {
    for (const lg of s.leagueDefs) {
      const fx = s.fixtures.filter(f => f.comp === lg.id).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);
      const pairs = {}, key = f => [f.home, f.away].sort().join('|');
      for (const f of fx) (pairs[key(f)] = pairs[key(f)] || []).push(f);
      const st = {}, decided = new Set(), fixed = f => f.played || f.date <= s.date;
      for (const f of fx) {
        if (!fixed(f) && !decided.has(f.id)) {
          const g = pairs[key(f)].find(x => x !== f);
          if (g && !fixed(g)) {
            const a = f.home, b = f.away;
            const [h, w] = pickHome(a, b, st, true) ? [a, b] : [b, a];
            f.home = h; f.away = w; g.home = w; g.away = h;
            decided.add(g.id);
          }
        }
        noteVenue(st, f.home, f.away);
      }
    }
    s.fixturesBalanced = true;
  };
  // Put league rounds back in calendar order (round 1, 2, 3...) — repairs saves where an earlier version
  // re-ordered rounds, which could bring both meetings with the same opponent close together.
  TL.restoreRoundOrder = s => {
    for (const lg of s.leagueDefs) {
      const rest = s.fixtures.filter(f => f.comp === lg.id && !f.played && f.date > s.date);
      const byRound = {};
      for (const f of rest) (byRound[f.round] = byRound[f.round] || []).push(f);
      const keys = Object.keys(byRound).map(Number).sort((a, b) => a - b);
      const slots = keys.map(k => byRound[k][0].date).sort();
      keys.forEach((k, i) => { for (const f of byRound[k]) f.date = slots[i]; });
    }
    s.roundsRestored = true;
  };

  /* ---------- Tables ---------- */
  TL.table = function (s, compId, opts) {
    const comp = s.comps[compId];
    const teams = opts && opts.group ? comp.groups[opts.group] : comp ? comp.teams : [];
    const rows = {};
    for (const id of teams) rows[id] = { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
    const fx = s.fixtures.filter(f => f.comp === compId && f.played && rows[f.home] && rows[f.away] && (!opts || !opts.group || f.group === opts.group)).sort((a, b) => a.date < b.date ? -1 : 1);
    for (const f of fx) {
      const h = rows[f.home], a = rows[f.away];
      h.p++; a.p++; h.gf += f.hg; h.ga += f.ag; a.gf += f.ag; a.ga += f.hg;
      if (f.hg > f.ag) { h.w++; a.l++; h.pts += 3; h.form.push('W'); a.form.push('L'); }
      else if (f.hg < f.ag) { a.w++; h.l++; a.pts += 3; h.form.push('L'); a.form.push('W'); }
      else { h.d++; a.d++; h.pts++; a.pts++; h.form.push('D'); a.form.push('D'); }
    }
    const nm = id => (TL.team(s, id) || { name: id }).name;
    return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || nm(x.id).localeCompare(nm(y.id)))
      .map((r, i) => Object.assign(r, { pos: i + 1, gd: r.gf - r.ga, form: r.form.slice(-5) }));
  };
  TL.leagueOf = (s, clubId) => { const c = s.clubs[clubId]; return c && c.leagueId; };
  TL.leaguePos = (s, clubId) => { const lg = TL.leagueOf(s, clubId); if (!lg || !s.comps[lg]) return null; const r = TL.table(s, lg).find(x => x.id === clubId); return r ? r.pos : null; };

  /* ---------- New game ---------- */
  const TEMPLATE = ['GK', 'GK', 'GK', 'RB', 'RB', 'CB', 'CB', 'CB', 'CB', 'LB', 'LB', 'DM', 'DM', 'CM', 'CM', 'CM', 'AM', 'RW', 'RW', 'LW', 'LW', 'ST', 'ST', 'ST'];
  TL.fillSquad = function (s, club, rng, target, mean, sd) {
    const have = {}; for (const id of club.players) { const p = s.players[id]; have[p.pos] = (have[p.pos] || 0) + 1; }
    const need = []; const tmp = Object.assign({}, have);
    for (const pos of TEMPLATE) { if (tmp[pos] > 0) tmp[pos]--; else need.push(pos); }
    while (club.players.length < target && need.length) {
      const pos = need.shift();
      const age = clamp(Math.round(25 + rng.normal() * 4.5), 17, 35);
      const ovr = Math.round(clamp(mean + rng.normal() * sd - (age < 21 ? 4 : 0) - (age > 32 ? 2 : 0), 38, 88));
      TL.generateYouth(s, club.id, rng, { pos, age, ovr, youth: false, prefix: 'G', pot: clamp(ovr + (age <= 20 ? rng.int(6, 18) : age <= 23 ? rng.int(2, 9) : age <= 26 ? rng.int(0, 4) : 0), ovr, 94), years: rng.int(1, 4) });
    }
  };
  function addClub(s, lg, c, rng) {
    const club = { id: c.id, name: c.name, city: c.city, stadium: c.stadium, cap: c.cap, founded: c.founded, rep: c.rep, c1: c.c1, c2: c.c2, country: lg.country, leagueId: lg.id, players: [], tactics: { formation: '4-3-3', mentality: 0, press: 1, tempo: 1 }, lineup: null, badge: c.badge || null, kit: c.kit || null, custom: !!c.custom };
    s.clubs[c.id] = club;
    let sum = 0, n = 0;
    if (c.squad) c.squad.split(';').forEach((row, i) => {
      const [name, pos, age, nat, ovr] = row.split('|');
      const id = c.id + '-' + (i + 1);
      const pr = new Rng(parseInt(TL.checksum(id + name), 16));
      s.players[id] = TL.createPlayer({ id, name, pos, age: +age, nat: nat === 'GUF' ? 'FRA' : nat, ovr: +ovr, clubId: c.id }, pr);
      club.players.push(id); sum += +ovr; n++;
    });
    const avgRep = lg.clubs.reduce((a, x) => a + x.rep, 0) / lg.clubs.length;
    const mean = n ? sum / n - 5 : (lg.gen ? lg.gen.mean : 60) + (c.rep - avgRep) * 0.3;
    TL.fillSquad(s, club, rng, n ? Math.max(22, n) : 24, mean, lg.gen ? lg.gen.sd : 3.5);
    return club;
  }
  TL.addClub = addClub;

  TL.newGame = function (opts) {
    opts = opts || {};
    const rng = new Rng(opts.seed || (Date.now() & 0xffffffff));
    const D = opts.pack || TL.DATA;
    const s = {
      version: 3, dataVersion: D.version, created: Date.now(), season: D.season, date: `${D.season}-07-01`,
      players: {}, clubs: {}, nations: {}, comps: {}, fixtures: [], history: [], leagueDefs: [], lastTables: {}, expected: {},
      managers: [], active: 0, offers: [], news: [], freeAgents: [], staff: {}, staffPool: [], nextId: 1, rngS: 0,
      settings: { difficulty: opts.difficulty || 'normal', rules: Object.assign({ unsackable: false, transferDifficulty: 1, financialRealism: true }, opts.rules || {}) },
      records: {}, vacancies: [], awards: []
    };
    for (const lg of D.leagues) {
      s.leagueDefs.push({ id: lg.id, name: lg.name, fullName: lg.fullName || lg.name, country: lg.country, tier: lg.tier, size: lg.clubs.length });
      for (const c of lg.clubs) addClub(s, lg, c, rng);
    }
    if (opts.custom && TL.createCustomClub) TL.createCustomClub(s, opts.custom, rng);
    for (const row of (TL.ABROAD || '').split(';').filter(Boolean)) {
      const [name, pos, age, nat, ovr, club] = row.split('|');
      const id = 'A' + (s.nextId++);
      const p = TL.createPlayer({ id, name, pos, age: +age, nat, ovr: +ovr, clubId: null }, new Rng(parseInt(TL.checksum(id + name), 16)));
      p.abroad = club; p.contract = null; p.transfers = []; p.prog = 0;
      s.players[id] = p;
    }
    for (const id in s.clubs) s.clubs[id].tactics.formation = TL.bestFormation(s, s.clubs[id]);
    if (TL.initNations) TL.initNations(s, rng);
    const mgrs = (opts.managers && opts.managers.length ? opts.managers : [{ name: 'The Gaffer', clubId: Object.keys(s.clubs)[0] }]).map(m => Object.assign({}, m, { clubId: m.clubId === 'CUSTOM' ? s.customClubId : m.clubId && s.clubs[m.clubId] ? m.clubId : null }));
    s.managers = mgrs.map(m => TL.newManager(m.name, { clubId: m.clubId || null, nationId: m.nationId || null, rep: m.clubId ? Math.round(s.clubs[m.clubId].rep * 0.75) : m.nationId ? 55 : 38 }));
    TL.link(s);
    if (!opts.rules || opts.rules.transferDifficulty == null) s.settings.rules.transferDifficulty = { easy: 0.85, normal: 1, hard: 1.2 }[s.settings.difficulty] || 1;
    for (const id in s.clubs) { s.clubs[id].academy = s.clubs[id].academy || []; if (TL.pickCaptain) TL.pickCaptain(s, s.clubs[id]); }
    TL.setupSeason(s, rng);
    s.managers.forEach(m => { if (m.nationId && TL.nationTarget) m.nboard.target = TL.nationTarget(s, s.nations[m.nationId]); });
    if (TL.initEconomy) TL.initEconomy(s, rng);
    if (s.customClubId && TL.applyCustomBudget) TL.applyCustomBudget(s);
    if (opts.wonderkid && TL.createWonderkid && s.managers[0].clubId) TL.createWonderkid(s, s.managers[0].clubId, opts.wonderkid, rng);
    // Starting vacancies so an unemployed manager has somewhere to apply
    const taken = new Set(s.managers.flatMap(m => [m.clubId, m.nationId]));
    const openJob = (type, teamId) => { if (!taken.has(teamId)) { s.vacancies.push({ id: s.nextId++, type, teamId, since: s.date }); taken.add(teamId); } };
    if (s.managers.some(m => !m.clubId)) { const low = Object.values(s.clubs).filter(c => !taken.has(c.id)).sort((a, b) => a.rep - b.rep).slice(0, 24); rng.shuffle(low).slice(0, 4).forEach(c => openJob('club', c.id)); const mid = Object.values(s.clubs).filter(c => c.rep >= 60 && c.rep < 72); if (mid.length) openJob('club', rng.pick(mid).id); }
    if (s.managers.some(m => !m.nationId)) rng.shuffle(Object.values(s.nations).filter(n => !TL.BANNED_NATIONS.includes(n.code)).sort((a, b) => a.rating - b.rating).slice(0, 50)).slice(0, 4).forEach(n => openJob('nation', n.id));
    s.managers.forEach((m, i) => TL.asManager(s, i, () => TL.welcome(s)));
    s.rngS = rng.s;
    return s;
  };

  TL.welcome = function (s) {
    const m = s.manager;
    if (m.clubId) {
      const c = s.clubs[m.clubId];
      TL.autoLineup(s, c);
      TL.addMail(s, 'board', 'Welcome to ' + c.name, `The board is delighted to appoint you as manager of ${c.name}.\n\nOur objective this season: ${TL.targetText(s, c.id, m.board.target)}.\n\nYour first competitive match is ${TL.fixtureLine(s, TL.nextFixtureFor(s, c.id))}. Pre-season starts now: use the summer window to strengthen the squad.`, true);
      TL.addMail(s, 'assistant', 'Squad and tactics are ready', `I have picked a starting XI in a ${c.tactics.formation}. Check Tactics to change the shape, instructions or line-up.\n\nPress Continue to move through pre-season a week at a time.`);
    }
    if (m.nationId) {
      const n = s.nations[m.nationId];
      TL.addMail(s, 'federation', `Welcome, ${n.name} manager`, `The ${n.name} federation welcomes you as national team manager.\n\nObjective: ${m.nboard.target || 'qualify for the next major tournament'}.\n\nYou'll name your squad before each international break from the Nation screen.`, true);
    }
    if (!m.clubId && !m.nationId) TL.addMail(s, 'agent', 'Looking for work', 'You are currently without a job. Open the Jobs screen to apply for vacancies. Clubs and federations will also contact you directly as your reputation grows.', true);
  };

  /* ---------- Season setup ---------- */
  const CUPS = {
    ENG: { id: 'FAC', name: 'FA Cup', venue: 'Wembley Stadium' }, ESP: { id: 'CDR', name: 'Copa del Rey', venue: 'Estadio de La Cartuja' },
    ITA: { id: 'CIT', name: 'Coppa Italia', venue: 'Stadio Olimpico' }, GER: { id: 'DFB', name: 'DFB-Pokal', venue: 'Olympiastadion Berlin' },
    FRA: { id: 'CDF', name: 'Coupe de France', venue: 'Stade de France' }, NGA: { id: 'FED', name: 'President Federation Cup', venue: 'Moshood Abiola National Stadium' }
  };
  TL.CUPS = CUPS;
  TL.targetText = (s, clubId, target) => {
    const lg = TL.leagueDef(s, TL.leagueOf(s, clubId));
    if (!lg) return 'compete well';
    if (target === 1) return `win the ${lg.name}`;
    if (lg.tier > 1 && target <= 2) return `win promotion from the ${lg.name}`;
    if (lg.tier > 1 && target <= 6) return `reach the ${lg.name} play-offs (top 6)`;
    const releg = lg.tier < 3 && lg.country === 'ENG' ? lg.size - 3 : null;
    if (releg && target >= releg) return `avoid relegation (finish ${TL.ordinal(releg)} or better)`;
    return `finish ${TL.ordinal(target)} or better in the ${lg.name}`;
  };

  TL.setupSeason = function (s, rng) {
    s.date = `${s.season}-07-01`;
    s.cal = TL.calendar(s.season);
    s.fixtures = []; s.comps = {}; s.expected = {}; s.fixturesBalanced = true;
    const strength = c => TL.squadStrength(s, c);
    for (const lg of s.leagueDefs) {
      const clubs = TL.leagueClubs(s, lg.id);
      lg.size = clubs.length;
      const ids = clubs.map(c => c.id);
      s.comps[lg.id] = { id: lg.id, type: 'league', name: lg.name, country: lg.country, tier: lg.tier, teams: ids };
      const rounds = TL.roundRobin(ids, rng, true);
      const dates = TL.leagueDates(s.cal, rounds.length);
      rounds.forEach((games, r) => games.forEach(([h, a]) => mkFx(s, lg.id, r, dates[r], h, a)));
      clubs.slice().sort((a, b) => strength(b) - strength(a)).forEach((c, i) => s.expected[c.id] = i + 1);
    }
    // Domestic cups
    for (const country in CUPS) {
      const def = CUPS[country];
      const teams = Object.values(s.clubs).filter(c => c.country === country && s.leagueDefs.some(l => l.id === c.leagueId)).sort((a, b) => strength(b) - strength(a)).map(c => c.id);
      if (teams.length < 4) continue;
      const comp = { id: def.id, type: 'cup', name: def.name, country, venue: def.venue, teams, alive: teams.slice(), round: 0, winner: null };
      s.comps[def.id] = comp;
      drawCupRound(s, comp, rng);
    }
    setupCL(s, rng);
    if (TL.intlSetupSeason) TL.intlSetupSeason(s, rng);
    for (const id in s.players) { const p = s.players[id]; p.stats = TL.newStats(); p.yellowAcc = 0; p.seasonStartOvr = p.ovr; }
    s.managers.forEach(m => { if (m.clubId) m.board = Object.assign(m.board || {}, { target: boardTarget(s, m.clubId), confidence: m.board && m.board.confidence != null ? m.board.confidence : 62 }); });
  };
  function boardTarget(s, clubId) {
    const exp = s.expected[clubId], lg = TL.leagueDef(s, TL.leagueOf(s, clubId)), size = lg ? lg.size : 20;
    const t = exp <= 2 ? exp : exp <= 4 ? exp : exp <= 8 ? exp + 1 : exp + 2;
    const diff = { easy: 2, normal: 0, hard: -1 }[s.settings.difficulty] || 0;
    return clamp(t + diff, 1, size - (lg && lg.country === 'ENG' && lg.tier < 3 ? 3 : 1));
  }
  TL.boardTarget = boardTarget;

  /* ---------- Domestic cups ---------- */
  const roundName = n => ({ 2: 'Final', 4: 'Semi-finals', 8: 'Quarter-finals', 16: 'Round of 16', 32: 'Round of 32', 64: 'Round of 64', 128: 'Round of 128' }[n] || `Round of ${n}`);
  TL.roundName = roundName;
  function drawCupRound(s, comp, rng) {
    const alive = comp.alive.slice();
    let p = 1; while (p * 2 <= alive.length) p *= 2;
    let playing, byes = [];
    if (alive.length > p) { const prelim = alive.length - p; playing = alive.slice(alive.length - prelim * 2); byes = alive.slice(0, alive.length - prelim * 2); comp.stageName = 'First round'; }
    else { playing = alive; comp.stageName = roundName(alive.length); }
    comp.byes = byes;
    rng.shuffle(playing);
    const isFinal = playing.length === 2 && !byes.length;
    const date = isFinal ? s.cal.cupFinal : s.cal.cup[Math.min(comp.round, s.cal.cup.length - 1)];
    for (let i = 0; i < playing.length; i += 2) mkFx(s, comp.id, comp.round, date, playing[i], playing[i + 1], { ko: true, stage: comp.stageName, neutral: isFinal, venue: isFinal ? comp.venue : undefined });
  }
  function advanceCup(s, comp, rng) {
    const fx = s.fixtures.filter(f => f.comp === comp.id && f.round === comp.round);
    if (!fx.length || fx.some(f => !f.played)) return;
    const winners = fx.map(f => f.winner || (f.hg > f.ag ? f.home : f.away));
    comp.alive = comp.byes.concat(winners);
    if (comp.alive.length === 1) { comp.winner = comp.alive[0]; trophy(s, comp.winner, comp.name); TL.news(s, `${TL.team(s, comp.winner).name} win the ${comp.name}!`); return; }
    comp.round++;
    drawCupRound(s, comp, rng);
  }

  /* ---------- Champions League ---------- */
  const CL_SPOTS = { ENG1: 6, ESP1: 6, ITA1: 6, GER1: 6, FRA1: 5 }, CL_EXTRA = ['ENG1', 'ESP1', 'ITA1'];
  function clQualifiers(s) {
    const out = [];
    for (const lg in CL_SPOTS) {
      if (!s.leagueDefs.some(l => l.id === lg)) continue;
      const order = s.lastTables[lg] && s.lastTables[lg].length ? s.lastTables[lg] : TL.leagueClubs(s, lg).sort((a, b) => s.expected[a.id] - s.expected[b.id]).map(c => c.id);
      const n = CL_SPOTS[lg] + (CL_EXTRA.includes(lg) ? 1 : 0);
      out.push(...order.filter(id => s.clubs[id] && s.clubs[id].leagueId === lg).slice(0, n));
    }
    return out.slice(0, 32);
  }
  function setupCL(s, rng) {
    const q = clQualifiers(s);
    if (q.length < 32) return;
    const sorted = q.slice().sort((a, b) => TL.squadStrength(s, s.clubs[b]) - TL.squadStrength(s, s.clubs[a]));
    const pots = [0, 1, 2, 3].map(i => rng.shuffle(sorted.slice(i * 8, i * 8 + 8)));
    const G = 'ABCDEFGH'.split(''), groups = {};
    for (let attempt = 0; attempt < 40; attempt++) {
      G.forEach(g => groups[g] = []);
      let ok = true;
      for (const pot of pots) {
        const pool = rng.shuffle(pot.slice());
        for (const g of G) {
          const i = pool.findIndex(id => !groups[g].some(x => s.clubs[x].leagueId === s.clubs[id].leagueId));
          if (i < 0) { ok = false; groups[g].push(pool.shift()); } else groups[g].push(pool.splice(i, 1)[0]);
        }
      }
      if (ok) break;
    }
    const comp = { id: 'UCL', type: 'cl', name: 'Champions League', teams: q, groups, stage: 'group', ko: [], winner: null, venue: 'Puskás Aréna' };
    s.comps.UCL = comp;
    for (const g of G) {
      const t = groups[g];
      const rounds = [[[t[0], t[1]], [t[2], t[3]]], [[t[3], t[0]], [t[1], t[2]]], [[t[0], t[2]], [t[3], t[1]]]];
      const all = rounds.concat(rounds.map(r => r.map(([h, a]) => [a, h])));
      all.forEach((games, r) => games.forEach(([h, a]) => mkFx(s, 'UCL', r, s.cal.clGroup[r], h, a, { group: g, stage: `Group ${g}` })));
    }
  }
  function drawTwoLeg(s, comp, pairs, stageIdx, stageName) {
    const d1 = s.cal.clKO[stageIdx * 2], d2 = s.cal.clKO[stageIdx * 2 + 1];
    for (const [a, b] of pairs) {
      const tie = s.nextId++;
      mkFx(s, comp.id, 10 + stageIdx * 2, d1, a, b, { ko: true, leg: 1, tie, stage: stageName });
      mkFx(s, comp.id, 11 + stageIdx * 2, d2, b, a, { ko: true, leg: 2, tie, stage: stageName, aggHome: null, aggAway: null });
    }
    comp.koStage = stageIdx; comp.stage = stageName;
  }
  function advanceCL(s, comp, rng) {
    const fx = s.fixtures.filter(f => f.comp === 'UCL');
    // fill second-leg aggregates once first legs are in
    for (const f of fx) if (f.leg === 2 && f.aggHome == null) { const l1 = fx.find(x => x.tie === f.tie && x.leg === 1); if (l1 && l1.played) { f.aggHome = l1.ag; f.aggAway = l1.hg; } }
    if (comp.stage === 'group') {
      if (fx.some(f => f.group && !f.played)) return;
      const winners = [], runners = [];
      for (const g in comp.groups) { const t = TL.table(s, 'UCL', { group: g }); winners.push({ id: t[0].id, g }); runners.push({ id: t[1].id, g }); }
      rng.shuffle(runners);
      for (let i = 0; i < winners.length; i++) if (runners[i].g === winners[i].g) { const j = (i + 1) % runners.length; [runners[i], runners[j]] = [runners[j], runners[i]]; }
      drawTwoLeg(s, comp, winners.map((w, i) => [runners[i].id, w.id]), 0, 'Round of 16');
      return;
    }
    if (comp.stage === 'Final') {
      const fin = fx.find(f => f.stage === 'Final');
      if (fin && fin.played && !comp.winner) { comp.winner = fin.winner || (fin.hg > fin.ag ? fin.home : fin.away); trophy(s, comp.winner, comp.name); TL.news(s, `${s.clubs[comp.winner].name} are champions of Europe!`); clPrize(s, comp.winner, 5); }
      return;
    }
    const legs2 = fx.filter(f => f.stage === comp.stage && f.leg === 2);
    if (!legs2.length || legs2.some(f => !f.played)) return;
    const through = legs2.map(f => f.winner);
    through.forEach(id => clPrize(s, id, comp.koStage === 0 ? 10 : comp.koStage === 1 ? 12 : 15));
    rng.shuffle(through);
    if (through.length === 2) { mkFx(s, 'UCL', 20, s.cal.clFinal, through[0], through[1], { ko: true, neutral: true, venue: comp.venue, stage: 'Final' }); comp.stage = 'Final'; return; }
    const pairs = []; for (let i = 0; i < through.length; i += 2) pairs.push([through[i], through[i + 1]]);
    drawTwoLeg(s, comp, pairs, comp.koStage + 1, through.length === 8 ? 'Quarter-finals' : 'Semi-finals');
  }
  function clPrize(s, clubId, amt) { const i = TL.ownerIndex(s, clubId); if (i >= 0 && TL.book) TL.asManager(s, i, () => TL.book(s, 'inc', 'prize', amt)); }

  /* ---------- Promotion play-offs (English tiers 2 and 3) ---------- */
  function maybePlayoffs(s, lgId) {
    const lg = TL.leagueDef(s, lgId);
    if (!lg || lg.country !== 'ENG' || lg.tier < 2 || s.comps['PO-' + lgId]) return;
    if (s.fixtures.some(f => f.comp === lgId && !f.played)) return;
    const t = TL.table(s, lgId);
    const comp = { id: 'PO-' + lgId, type: 'playoff', name: `${lg.name} play-offs`, teams: t.slice(2, 6).map(r => r.id), stage: 'Semi-finals', winner: null };
    s.comps[comp.id] = comp;
    mkFx(s, comp.id, 0, s.cal.playoffSemi, t[2].id, t[5].id, { ko: true, stage: 'Semi-final' });
    mkFx(s, comp.id, 0, s.cal.playoffSemi, t[3].id, t[4].id, { ko: true, stage: 'Semi-final' });
  }
  function advancePlayoff(s, comp) {
    const fx = s.fixtures.filter(f => f.comp === comp.id);
    if (fx.some(f => !f.played)) return;
    if (comp.stage === 'Semi-finals') {
      const w = fx.map(f => f.winner);
      mkFx(s, comp.id, 1, s.cal.playoffFinal, w[0], w[1], { ko: true, neutral: true, venue: 'Wembley Stadium', stage: 'Final' });
      comp.stage = 'Final';
    } else if (!comp.winner) { const fin = fx.find(f => f.round === 1); comp.winner = fin.winner; TL.news(s, `${s.clubs[comp.winner].name} win the ${comp.name} and are promoted!`); }
  }

  /* ---------- Trophies ---------- */
  function trophy(s, teamId, name) {
    for (const m of s.managers) if (m.clubId === teamId || m.nationId === teamId) { m.trophies.push({ season: s.season, name, team: teamId }); m.rep = Math.min(100, m.rep + (/World Cup|Champions League/.test(name) ? 12 : 6)); }
    s.awards.push({ season: s.season, name, winner: teamId });
  }
  TL.trophy = trophy;

  /* ---------- Day processing ---------- */
  TL.fixturesOn = (s, date) => s.fixtures.filter(f => f.date === date);
  TL.humanFixturesToday = s => s.fixtures.filter(f => !f.played && f.date === s.date && (TL.isHumanTeam(s, f.home) || TL.isHumanTeam(s, f.away)));
  TL.nextFixtureFor = (s, teamId) => s.fixtures.filter(f => !f.played && (f.home === teamId || f.away === teamId)).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)[0];
  TL.nextUserFixture = s => { const m = s.manager; const fx = [m.clubId, m.nationId].filter(Boolean).map(id => TL.nextFixtureFor(s, id)).filter(Boolean); return fx.sort((a, b) => a.date < b.date ? -1 : 1)[0]; };
  TL.nextFixtureDate = s => { let best = null; for (const f of s.fixtures) if (!f.played && f.date >= s.date && (!best || f.date < best)) best = f.date; return best; };
  TL.compName = (s, f) => { const c = s.comps[f.comp]; const name = c ? c.name : f.comp; return f.stage && f.stage !== name ? `${name} · ${f.stage}` : name; };
  TL.fixtureLine = (s, f) => {
    if (!f) return 'not yet scheduled';
    const me = s.manager, mine = f.home === me.clubId || f.home === me.nationId;
    const opp = TL.team(s, mine ? f.away : f.home);
    return `${f.neutral ? 'against' : mine ? 'at home to' : 'away at'} ${opp.name} (${TL.compName(s, f)}) on ${TL.fmtDate(f.date, true)}`;
  };

  // Play every unplayed fixture today. `done` holds finished Match objects the humans played themselves.
  TL.playDay = function (s, done) {
    const rng = new Rng(s.rngS);
    const today = s.fixtures.filter(f => f.date === s.date && !f.played);
    const played = [];
    for (const f of today) {
      const m = (done || []).find(x => x.f === f);
      if (m) TL.applyMatch(s, m);
      else if (f.kind === 'intl' && !TL.isHumanTeam(s, f.home) && !TL.isHumanTeam(s, f.away) && TL.simAbstract) TL.simAbstract(s, f, rng);
      else { const mm = new TL.Match(s, f, rng, { fast: !TL.isHumanTeam(s, f.home) && !TL.isHumanTeam(s, f.away) }); mm.runToEnd(); TL.applyMatch(s, mm); }
      played.push(f);
    }
    // serve suspensions: a club match played today counts for every banned player of that club
    const clubsPlayed = new Set(); for (const f of played) if (f.kind !== 'intl') { clubsPlayed.add(f.home); clubsPlayed.add(f.away); }
    for (const cid of clubsPlayed) for (const id of s.clubs[cid].players) { const p = s.players[id]; if (p.ban > 0 && p.banDate !== s.date) p.ban--; }
    s.rngS = rng.s;
    TL.afterDay(s, played, rng);
    s.rngS = rng.s;
    s.lastDay = { date: s.date, ids: played.map(f => f.id) };
    return played;
  };

  TL.afterDay = function (s, played, rng) {
    // human manager follow-ups: board, injuries, suspensions
    s.managers.forEach((m, i) => TL.asManager(s, i, () => {
      for (const f of played) {
        if (m.clubId && (f.home === m.clubId || f.away === m.clubId)) { m.lastResult = f.id; TL.afterClubMatch(s, f); }
        if (m.nationId && (f.home === m.nationId || f.away === m.nationId)) { m.lastNResult = f.id; if (TL.afterNationMatch) TL.afterNationMatch(s, f); }
      }
      if (m.clubId) squadNotes(s, s.clubs[m.clubId]);
    }));
    for (const id in s.comps) {
      const c = s.comps[id];
      if (c.type === 'cup' && !c.winner) advanceCup(s, c, rng);
      if (c.type === 'cl' && !c.winner) advanceCL(s, c, rng);
      if (c.type === 'league') maybePlayoffs(s, id);
      if (c.type === 'playoff') advancePlayoff(s, c);
    }
    if (TL.intlAfterDay) TL.intlAfterDay(s, rng);
    if (TL.careerAfterDay) TL.careerAfterDay(s, played, rng);
  };

  function squadNotes(s, club) {
    for (const id of club.players) {
      const p = s.players[id];
      if (p.injury > 0 && !p._injMailed) { p._injMailed = true; TL.addMail(s, 'medical', `${p.name} injured`, `${p.name} has a ${p.injuryName.toLowerCase()} and will be out for around ${Math.max(1, Math.round(p.injury / 7))} week${p.injury > 10 ? 's' : ''}.`); }
      if (p.injury <= 0) p._injMailed = false;
      if (p.ban > 0 && !p._banMailed) { p._banMailed = true; TL.addMail(s, 'league', `${p.name} suspended`, `${p.name} is suspended for the next ${p.ban} match${p.ban > 1 ? 'es' : ''}.`); }
      if (p.ban <= 0) p._banMailed = false;
    }
  }

  TL.userResult = (s, f, teamId) => {
    teamId = teamId || (s.manager.clubId === f.home || s.manager.clubId === f.away ? s.manager.clubId : s.manager.nationId);
    const home = f.home === teamId;
    const gf = home ? f.hg : f.ag, ga = home ? f.ag : f.hg;
    const res = f.winner ? (f.winner === teamId ? 'W' : 'L') : gf > ga ? 'W' : gf < ga ? 'L' : 'D';
    return { gf, ga, res, home, opp: TL.team(s, home ? f.away : f.home) };
  };

  TL.afterClubMatch = function (s, f) {
    const m = s.manager, me = m.clubId, comp = s.comps[f.comp];
    const r = TL.userResult(s, f, me);
    const lgId = TL.leagueOf(s, me);
    const oppExp = s.expected[r.opp.id] || 10, myExp = s.expected[me] || 10;
    const sameLeague = TL.leagueOf(s, r.opp.id) === lgId;
    const diff = sameLeague ? (oppExp - myExp) / 19 : (s.clubs[r.opp.id].rep - s.clubs[me].rep) / -40;
    const weight = comp && comp.type === 'league' ? 1 : 0.6;
    let delta = (r.res === 'W' ? 2.5 - diff * 1.5 : r.res === 'D' ? 0.5 - diff * 2 : -2.5 - diff * 2) * weight;
    if (Math.abs(r.gf - r.ga) >= 3) delta *= 1.4;
    m.board.confidence = clamp(m.board.confidence + delta, 0, 100);
    m.rep = clamp(m.rep + (r.res === 'W' ? 0.25 : r.res === 'L' ? -0.2 : 0) * (1 + (s.clubs[r.opp.id].rep - 60) / 60), 0, 100);
    if (comp && comp.type === 'league') {
      const played = s.fixtures.filter(x => x.comp === lgId && x.played && (x.home === me || x.away === me)).length;
      const pos = TL.leaguePos(s, me);
      if (played % 5 === 0) {
        m.board.confidence = clamp(m.board.confidence + (m.board.target - pos) * 1.2, 0, 100);
        const c = m.board.confidence;
        TL.addMail(s, 'board', 'Board update', `After ${played} league matches we sit ${TL.ordinal(pos)}. Our target: ${TL.targetText(s, me, m.board.target)}.\n\n${c >= 75 ? 'The board is delighted with the direction of the club.' : c >= 50 ? 'The board is satisfied with progress so far.' : c >= 30 ? 'The board is concerned by recent results and expects an improvement.' : "The board's patience is running out. Results must improve immediately."}`, c < 30);
      }
      if (m.board.confidence < 12 && played >= 11 && !s.settings.rules.unsackable && TL.sackManager) TL.sackManager(s, 'club');
    }
  };

  // Advance the calendar up to `maxDays`, auto-playing AI-only matchdays. Stops on a human matchday.
  TL.advance = function (s, maxDays) {
    for (let moved = 0; moved < maxDays; moved++) {
      if (TL.humanFixturesToday(s).length) return 'matchday';
      if (s.fixtures.some(f => f.date === s.date && !f.played)) TL.playDay(s, []);
      if (TL.seasonOver(s)) return 'season';
      TL.advanceDays(s, 1);
      if (TL.humanFixturesToday(s).length) return 'matchday';
    }
    if (s.fixtures.some(f => f.date === s.date && !f.played) && !TL.humanFixturesToday(s).length) TL.playDay(s, []);
    return TL.seasonOver(s) ? 'season' : 'moved';
  };
  TL.seasonOver = s => !s.fixtures.some(f => !f.played) && s.date >= s.cal.clFinal && (!TL.intlPending || !TL.intlPending(s));

  /* ---------- Awards ---------- */
  const avgOf = p => p.stats.rated ? p.stats.ratingSum / p.stats.rated : 0;
  TL.seasonAwards = function (s, leagueId) {
    const ps = Object.values(s.players).filter(p => !leagueId || (p.clubId && s.clubs[p.clubId] && s.clubs[p.clubId].leagueId === leagueId));
    const lgGoals = p => leagueId && p.stats.byComp ? (p.stats.byComp[leagueId] || 0) : p.stats.goals;
    const by = (arr, fn) => arr.slice().sort((a, b) => fn(b) - fn(a))[0];
    const goals = by(ps, lgGoals);
    return {
      goldenBoot: goals && lgGoals(goals) > 0 ? goals.id : null,
      playerOfSeason: (by(ps.filter(p => p.stats.apps >= 20), avgOf) || {}).id || null,
      youngPlayer: (by(ps.filter(p => p.stats.apps >= 15 && p.age <= 21), avgOf) || {}).id || null,
      goldenGlove: (by(ps.filter(p => p.pos === 'GK'), p => p.stats.cleanSheets) || {}).id || null,
      playmaker: (by(ps, p => p.stats.assists) || {}).id || null,
      goalsOf: lgGoals
    };
  };

  /* ---------- End of season ---------- */
  TL.endSeason = function (s) {
    const rng = new Rng(s.rngS);
    const report = {};
    // League archives, promotion and relegation
    const tables = {};
    for (const lg of s.leagueDefs) { tables[lg.id] = TL.table(s, lg.id); s.lastTables[lg.id] = tables[lg.id].map(r => r.id); }
    for (const lg of s.leagueDefs) {
      const t = tables[lg.id]; if (!t.length) continue;
      const aw = TL.seasonAwards(s, lg.id);
      const snap = id => { if (!id) return null; const p = s.players[id]; return { id, name: p.name, club: p.clubId, goals: aw.goalsOf(p), assists: p.stats.assists, cs: p.stats.cleanSheets, avg: +avgOf(p).toFixed(2) }; };
      s.history.push({ season: s.season, comp: lg.id, name: lg.name, champion: t[0].id, table: t.map(r => ({ id: r.id, pts: r.pts, gd: r.gd, w: r.w, d: r.d, l: r.l })), awards: { goldenBoot: snap(aw.goldenBoot), playerOfSeason: snap(aw.playerOfSeason), youngPlayer: snap(aw.youngPlayer), goldenGlove: snap(aw.goldenGlove), playmaker: snap(aw.playmaker) } });
      trophy(s, t[0].id, lg.name);
    }
    for (const id in s.comps) { const c = s.comps[id]; if ((c.type === 'cup' || c.type === 'cl' || c.type === 'playoff') && c.winner) s.history.push({ season: s.season, comp: id, name: c.name, champion: c.winner }); }
    const moves = [];
    const move = (ids, to) => ids.forEach(id => { moves.push({ id, from: s.clubs[id].leagueId, to }); });
    const tierOf = (country, tier) => s.leagueDefs.find(l => l.country === country && l.tier === tier);
    for (const lg of s.leagueDefs) {
      const t = tables[lg.id], below = tierOf(lg.country, lg.tier + 1);
      if (!below || lg.country !== 'ENG') continue;
      const tb = tables[below.id], po = s.comps['PO-' + below.id];
      const down = t.slice(-3).map(r => r.id);
      const up = tb.slice(0, 2).map(r => r.id).concat(po && po.winner ? [po.winner] : [tb[2].id]);
      move(down, below.id); move(up, lg.id);
    }
    for (const mv of moves) {
      s.clubs[mv.id].leagueId = mv.to;
      const up = TL.leagueDef(s, mv.to).tier < TL.leagueDef(s, mv.from).tier;
      TL.news(s, `${s.clubs[mv.id].name} are ${up ? 'promoted to' : 'relegated to'} the ${TL.leagueDef(s, mv.to).name}.`);
      for (const m of s.managers) if (m.clubId === mv.id) { if (up) { m.trophies.push({ season: s.season, name: `Promotion to the ${TL.leagueDef(s, mv.to).name}`, team: mv.id }); m.rep = Math.min(100, m.rep + 5); } }
      s.clubs[mv.id].rep = clamp(s.clubs[mv.id].rep + (up ? 3 : -3), 30, 99);
    }
    // Human manager season summaries
    s.managers.forEach((m, i) => {
      if (!m.clubId) return;
      const lgId = moves.find(x => x.id === m.clubId) ? moves.find(x => x.id === m.clubId).from : s.clubs[m.clubId].leagueId;
      const pos = tables[lgId].findIndex(r => r.id === m.clubId) + 1;
      report[i] = { pos, league: lgId, target: m.board.target, moved: moves.find(x => x.id === m.clubId) || null };
      m.career.push({ season: s.season, club: m.clubId, league: lgId, pos, target: m.board.target });
      if (pos <= m.board.target) m.rep = Math.min(100, m.rep + 3); else if (pos > m.board.target + 4) m.rep = Math.max(0, m.rep - 3);
    });
    // Players: career archive, ageing, development, retirement
    const dev = { improved: {}, declined: {}, retired: {}, youth: {} };
    const humanClubs = new Set(TL.humanClubIds(s));
    for (const id of Object.keys(s.players)) {
      const p = s.players[id];
      if (TL.archivePlayerSeason) TL.archivePlayerSeason(s, p);
      if (p.stats.apps) p.career.push({ season: s.season, club: p.clubId, apps: p.stats.apps, goals: p.stats.goals, assists: p.stats.assists, avg: +avgOf(p).toFixed(2) });
      const old = p.ovr;
      let d = p.age <= 27 ? rng.int(-1, 1) : p.age <= 30 ? rng.int(-2, 1) : p.age <= 32 ? rng.int(-3, 0) : rng.int(-5, -1);
      if (p.hidden.professionalism >= 15 && d < 1) d += rng.chance(0.4) ? 1 : 0;
      p.ovr = clamp(d > 0 ? Math.min(p.ovr + d, Math.max(p.pot, p.ovr)) : p.ovr + d, 30, 96);
      const shift = (p.ovr - old) / 3.4;
      for (const k in p.attrs) {
        if (p.pos !== 'GK' && TL.ATTRS.Goalkeeping.includes(k)) continue;
        let sh = shift;
        if (p.age >= 30 && TL.ATTRS.Physical.includes(k)) sh -= rng.range(0.2, 0.9);
        if (p.age >= 30 && ['decisions', 'composure', 'leadership', 'vision'].includes(k)) sh += rng.range(0, 0.5);
        p.attrs[k] = clamp(Math.round(p.attrs[k] + sh + rng.normal() * 0.35), 1, 20);
      }
      p.age++;
      if (humanClubs.has(p.clubId)) {
        const base = p.seasonStartOvr != null ? p.seasonStartOvr : old;
        (dev.improved[p.clubId] = dev.improved[p.clubId] || []);
        (dev.declined[p.clubId] = dev.declined[p.clubId] || []);
        if (p.ovr - base >= 3) dev.improved[p.clubId].push({ id, d: p.ovr - base });
        if (p.ovr - base <= -3) dev.declined[p.clubId].push({ id, d: p.ovr - base });
      }
      const retire = (p.clubId || p.abroad) && !p.wonderkid && (p.age >= 38 || (p.age >= 35 && rng.chance(0.45)) || (p.age >= 33 && p.ovr < 68 && rng.chance(0.3)));
      if (retire) {
        if (p.clubId) { const club = s.clubs[p.clubId]; club.players = club.players.filter(x => x !== id); if (humanClubs.has(p.clubId)) (dev.retired[p.clubId] = dev.retired[p.clubId] || []).push(p.name); }
        delete s.players[id];
      } else { p.value = TL.marketValue(p); p.morale = 65; p.cond = 100; p.injury = Math.max(0, p.injury - 60); p.ban = 0; p.form = []; }
    }
    if (TL.econSeasonEnd) TL.econSeasonEnd(s, rng, report);
    // Youth intake and squad top-ups
    for (const cid in s.clubs) {
      const club = s.clubs[cid];
      const intake = TL.youthIntake ? TL.youthIntake(s, club, rng) : [];
      if (humanClubs.has(cid)) dev.youth[cid] = intake.map(p => p.id);
      if (club.players.filter(id => s.players[id].pos === 'GK').length < 2) { const y = TL.generateYouth(s, cid, rng, { pos: 'GK', age: 19, boost: 8 }); if (humanClubs.has(cid)) dev.youth[cid].push(y.id); }
      const lg = TL.DATA.leagues.find(l => l.id === club.leagueId);
      const mean = TL.squadStrength(s, club) - 4;
      if (club.players.length < 22) TL.fillSquad(s, club, rng, 22, mean, lg && lg.gen ? lg.gen.sd : 3.5);
      club.lineup = null;
      if (!humanClubs.has(cid)) club.tactics.formation = TL.bestFormation(s, club);
    }
    if (TL.intlSeasonEnd) TL.intlSeasonEnd(s, rng);
    if (TL.careerSeasonEnd) TL.careerSeasonEnd(s, rng, report);
    s.season++;
    s.rngS = rng.s;
    TL.setupSeason(s, rng);
    for (const id of TL.humanClubIds(s)) TL.autoLineup(s, s.clubs[id]);
    if (TL.econSeasonStart) TL.econSeasonStart(s, rng);
    s.managers.forEach((m, i) => TL.asManager(s, i, () => {
      if (!m.clubId) return;
      const r = report[i];
      m.board.confidence = clamp(55 + (r ? (r.target - r.pos) * 3 : 0), 30, 90);
      TL.addMail(s, 'board', `${s.season}/${String(s.season + 1).slice(2)} objectives`, `${r ? `Last season we finished ${TL.ordinal(r.pos)}${r.moved ? `, and we are now in the ${TL.leagueDef(s, r.moved.to).name}` : ''}.\n\n` : ''}This season the board expects you to ${TL.targetText(s, m.clubId, m.board.target)}.`, true);
      const yth = dev.youth[m.clubId] || [];
      if (yth.length) TL.addMail(s, 'academy', 'Youth intake has arrived', `This year's academy graduates have joined the club:\n\n${yth.filter(id => s.players[id]).map(id => `• ${s.players[id].name} (${s.players[id].pos}, ${s.players[id].age}) – potential ${s.players[id].pot >= 80 ? 'excellent' : s.players[id].pot >= 70 ? 'good' : 'modest'}`).join('\n')}`);
    }));
    s.rngS = rng.s;
    return { report, dev };
  };

  /* ---------- Save migration from Phase 1/2 single-league saves ---------- */
  TL.migrateV2 = function (old) {
    // Older careers can't be converted into the multi-league world faithfully; start a fresh world with the same club and manager.
    const m = old.manager || {};
    const s = TL.newGame({ managers: [{ name: m.name, clubId: m.clubId }], seed: old.rngS || 1 });
    TL.asManager(s, 0, () => TL.addMail(s, 'assistant', 'Welcome to the new world', 'Touchline has been upgraded with seven new leagues, cups, the Champions League and international football. Your previous career used the old single-league format, so a new career has started at the same club. Your old save file is untouched.', true));
    return s;
  };
})();
