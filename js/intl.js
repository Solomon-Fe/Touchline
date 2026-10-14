/* Touchline — international football: nations, call-ups, rankings, qualifiers, tournaments.
   Matches between AI nations use a fast strength-based simulation; any match involving a human-managed
   nation uses the full match engine with real squads (topped up with generated players where needed). */
(function () {
  const TL = window.TL, Rng = TL.Rng, clamp = TL.clamp;
  const NID = code => 'N:' + code;
  TL.NID = NID;

  /* ---------- Tournament definitions ---------- */
  const HOSTS = { WC: { 2026: ['USA', 'MEX', 'CAN'], 2030: ['ESP', 'POR', 'MAR'], 2034: ['KSA'] }, EURO: { 2028: ['ENG', 'SCO', 'WAL', 'IRL'], 2032: ['ITA', 'TUR'] }, AFCON: { 2027: ['KEN', 'UGA', 'TAN'] }, ASIAN: { 2027: ['KSA'] }, GOLD: {}, COPA: {} };
  const TOURNEYS = [
    { id: 'WC', name: 'World Cup', every: y => y % 4 === 2, size: 48, quotas: { UEFA: 16, CAF: 10, AFC: 9, CONMEBOL: 6, CONCACAF: 6, OFC: 1 } },
    { id: 'EURO', name: 'European Championship', every: y => y % 4 === 0, size: 24, quotas: { UEFA: 24 } },
    { id: 'COPA', name: 'Copa América', every: y => y % 4 === 0, size: 16, direct: s => byRating(s, 'CONMEBOL').concat(byRating(s, 'CONCACAF').slice(0, 6)) },
    { id: 'AFCON', name: 'Africa Cup of Nations', every: y => y % 2 === 1, size: 24, quotas: { CAF: 24 } },
    { id: 'ASIAN', name: 'Asian Cup', every: y => y % 4 === 3, size: 24, quotas: { AFC: 24 } },
    { id: 'GOLD', name: 'Gold Cup', every: y => y % 2 === 1, size: 16, direct: s => byRating(s, 'CONCACAF').slice(0, 16) }
  ];
  TL.TOURNEYS = TOURNEYS;
  const eligible = (s, confed) => Object.values(s.nations).filter(n => (!confed || n.confed === confed) && !TL.BANNED_NATIONS.includes(n.code));
  const byRating = (s, confed) => eligible(s, confed).sort((a, b) => b.rating - a.rating).map(n => n.id);

  /* ---------- Nations ---------- */
  TL.initNations = function (s) {
    s.nations = {};
    for (const n of TL.NATIONS_DATA) {
      s.nations[NID(n.code)] = {
        id: NID(n.code), code: n.code, name: n.name, confed: n.confed, rating: n.rating, base: n.rating, elo: Math.round(1000 + (n.rating - 60) * 25),
        c1: n.c1, c2: n.c2, isNation: true, players: [], tactics: { formation: '4-3-3', mentality: 0, press: 1, tempo: 1 }, lineup: null,
        stadium: `${n.name} National Stadium`, cap: 50000, rep: n.rating, squadSetFor: null, history: []
      };
    }
  };
  // Players eligible for a nation, best first. Cached per game day (rebuilt when the date or player count changes).
  let poolCache = { key: '', map: null };
  TL.nationPool = (s, code) => {
    const key = s.date + ':' + s.nextId;
    if (poolCache.key !== key || poolCache.state !== s) {
      const map = {};
      for (const id in s.players) { const p = s.players[id]; if (p.trialist) continue; (map[p.nat] = map[p.nat] || []).push(p); }
      for (const k in map) map[k].sort((a, b) => b.ovr - a.ovr);
      poolCache = { key, map, state: s };
    }
    return (poolCache.map[code] || []).filter(p => s.players[p.id]);
  };
  // Fill a nation's pool with generated players when it is short (only needed for full-engine matches).
  TL.ensureNationPlayers = function (s, nation, rng, size) {
    const pool = TL.nationPool(s, nation.code);
    const need = (size || 23) - pool.length;
    if (need <= 0) return;
    const POS = ['GK', 'GK', 'GK', 'CB', 'CB', 'CB', 'CB', 'RB', 'LB', 'RB', 'LB', 'DM', 'CM', 'CM', 'CM', 'AM', 'AM', 'RW', 'LW', 'RW', 'ST', 'ST', 'ST'];
    const have = {}; pool.forEach(p => have[p.pos] = (have[p.pos] || 0) + 1);
    const missing = []; const tmp = Object.assign({}, have);
    for (const pos of POS) { if (tmp[pos] > 0) tmp[pos]--; else missing.push(pos); }
    for (let i = 0; i < need; i++) {
      const pos = missing[i % missing.length] || rng.pick(POS);
      const ovr = Math.round(clamp(nation.base + 1 - i * 0.45 + rng.normal() * 2.5, 40, 90));
      const p = TL.generateYouth(s, null, rng, { nat: nation.code, pos, age: clamp(Math.round(26 + rng.normal() * 3.5), 19, 34), ovr, youth: false, prefix: 'N', pot: ovr + rng.int(0, 3) });
      p.abroad = `${nation.name} league`; p.filler = true;
    }
  };
  TL.ensureSquad = function (s, nation, rng) {
    if (nation.players.filter(id => s.players[id]).length >= 16) return;
    TL.ensureNationPlayers(s, nation, rng || new Rng(7), 23);
    TL.callUp(s, nation, 23);
  };
  // AI squad selection: best available by position quotas.
  TL.callUp = function (s, nation, size) {
    size = size || 23;
    const pool = TL.nationPool(s, nation.code).filter(p => p.injury <= 7);
    const quota = size >= 26 ? { GK: 3, DEF: 9, MID: 8, ATT: 6 } : { GK: 3, DEF: 8, MID: 7, ATT: 5 };
    const pick = [];
    for (const g in quota) pick.push(...pool.filter(p => TL.POS_GROUP[p.pos] === g).slice(0, quota[g]));
    for (const p of pool) { if (pick.length >= size) break; if (!pick.includes(p)) pick.push(p); }
    nation.players = pick.slice(0, size).map(p => p.id);
    nation.lineup = null;
    nation.tactics.formation = nation.players.length >= 11 ? TL.bestFormation(s, nation) : '4-3-3';
    return nation.players;
  };
  TL.ranking = s => Object.values(s.nations).filter(n => !TL.BANNED_NATIONS.includes(n.code)).sort((a, b) => b.elo - a.elo);
  const eloUpdate = (s, f, k) => {
    const H = s.nations[f.home], A = s.nations[f.away];
    const dr = H.elo - A.elo + (f.neutral ? 0 : 60);
    const exp = 1 / (1 + Math.pow(10, -dr / 400));
    const res = f.winner ? (f.winner === f.home ? 1 : 0) : f.hg > f.ag ? 1 : f.hg < f.ag ? 0 : 0.5;
    const gd = Math.abs(f.hg - f.ag), mult = gd <= 1 ? 1 : gd === 2 ? 1.5 : 1.75 + (gd - 3) / 8;
    const delta = Math.round(k * mult * (res - exp));
    H.elo += delta; A.elo -= delta;
  };

  /* ---------- Fast simulation for AI-vs-AI internationals ---------- */
  const poisson = (l, rng) => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= rng.next(); } while (p > L); return k - 1; };
  TL.simAbstract = function (s, f, rng) {
    const H = s.nations[f.home], A = s.nations[f.away];
    const sh = strength(s, H), sa = strength(s, A);
    const home = f.neutral ? 1 : 1.15;
    const lh = clamp(1.3 * Math.exp((sh - sa) / 9) * home, 0.12, 4.5), la = clamp(1.15 * Math.exp((sa - sh) / 9) / home, 0.12, 4.5);
    f.hg = poisson(lh, rng); f.ag = poisson(la, rng);
    if (f.ko && f.hg === f.ag) {
      f.et = true; f.hg += poisson(lh / 3, rng); f.ag += poisson(la / 3, rng);
      if (f.hg === f.ag) { const ph = clamp(0.5 + (sh - sa) / 100, 0.35, 0.65); const w = rng.chance(ph); f.pens = { home: w ? 5 : 4, away: w ? 4 : 5 }; f.winner = w ? f.home : f.away; }
    }
    if (f.ko && !f.winner) f.winner = f.hg > f.ag ? f.home : f.away;
    f.played = true;
    f.scorers = [];
    for (const [side, nat, goals] of [['home', H, f.hg], ['away', A, f.ag]]) {
      const squad = (nat.players.length ? nat.players : TL.nationPool(s, nat.code).slice(0, 23).map(p => p.id)).map(id => s.players[id]).filter(Boolean);
      const xi = squad.slice(0, 14);
      for (const p of xi) {
        p.intl = p.intl || { caps: 0, goals: 0 }; p.intl.caps++;
        p.cond = Math.max(40, p.cond - 12);
        if (rng.chance(0.012)) { p.injury = rng.int(5, 25); p.injuryName = 'Knock on international duty'; if (p.clubId) TL.mailClub(s, p.clubId, 'medical', `${p.name} injured on international duty`, `${p.name} picked up an injury playing for ${nat.name} and will be out for about ${Math.ceil(p.injury / 7)} week(s).`); }
      }
      for (let g = 0; g < goals; g++) {
        const sc = xi.length ? rng.weighted(xi, p => ({ ST: 3, LW: 2, RW: 2, AM: 1.6, CM: 0.8, DM: 0.3, CB: 0.3, LB: 0.2, RB: 0.2, GK: 0 })[p.pos] * (4 + p.attrs.finishing)) : null;
        if (sc) { sc.intl.goals++; f.scorers.push({ side, id: sc.id, min: rng.int(1, 90) }); }
      }
    }
    TL.recordManagerResult(s, f.home, f.winner ? (f.winner === f.home ? 'W' : 'L') : f.hg > f.ag ? 'W' : f.hg < f.ag ? 'L' : 'D');
    TL.recordManagerResult(s, f.away, f.winner ? (f.winner === f.away ? 'W' : 'L') : f.ag > f.hg ? 'W' : f.ag < f.hg ? 'L' : 'D');
  };
  const strength = (s, n) => {
    const pool = TL.nationPool(s, n.code).filter(p => p.injury <= 0);
    const top = pool.slice(0, 11), k = top.length;
    if (!k) return n.base;
    const avg = (top.reduce((a, p) => a + p.ovr, 0) + n.base * (11 - k)) / 11;
    return k >= 11 ? avg * 0.7 + n.base * 0.3 : avg;
  };
  TL.nationStrength = strength;

  /* ---------- Season set-up: qualifiers, friendlies, direct tournaments ---------- */
  TL.intlSetupSeason = function (s, rng) {
    const Y = s.season + 1;
    const dates = s.cal.intl.flat(); // 8 match dates across the four breaks
    const busy = new Set();
    s.intlPlan = { year: Y, tourneys: [] };
    for (const T of TOURNEYS.filter(t => t.every(Y))) {
      const hosts = ((HOSTS[T.id] || {})[Y] || []).map(NID).filter(id => s.nations[id]);
      const plan = { id: T.id, name: T.name, size: T.size, hosts, quals: [], ready: false };
      s.intlPlan.tourneys.push(plan);
      if (T.direct) { setupTournament(s, plan, T.direct(s).slice(0, T.size), rng); continue; }
      for (const confed in T.quotas) {
        const quota = T.quotas[confed] - hosts.filter(h => s.nations[h].confed === confed).length;
        const teams = byRating(s, confed).filter(id => !hosts.includes(id));
        if (teams.length <= quota) { plan.quals.push({ direct: teams }); continue; }
        const qid = `Q-${T.id}-${confed}`;
        const nGroups = Math.max(1, Math.ceil(teams.length / 4)); // groups of 3–4: six matchdays, fits the eight window dates
        const groups = {};
        const letters = 'ABCDEFGHIJKLMNOP'.split('').slice(0, nGroups);
        letters.forEach(g => groups[g] = []);
        teams.forEach((id, i) => { const row = Math.floor(i / nGroups); const g = letters[row % 2 === 0 ? i % nGroups : nGroups - 1 - (i % nGroups)]; groups[g].push(id); });
        s.comps[qid] = { id: qid, type: 'intl-q', name: `${T.name} qualifying (${confed})`, short: `${T.id} qualifying`, teams, groups, quota, tour: T.id, confed };
        plan.quals.push({ comp: qid, quota });
        for (const g of letters) {
          const rr = TL.roundRobin(groups[g], rng, true);
          rr.slice(0, dates.length).forEach((games, r) => games.forEach(([h, a]) => { TL.mkFixture(s, qid, r, dates[r], h, a, { kind: 'intl', group: g, stage: `Group ${g}` }); busy.add(h + dates[r]); busy.add(a + dates[r]); }));
        }
      }
    }
    // Friendlies for everyone not busy on a window date
    s.comps.FRI = { id: 'FRI', type: 'friendly', name: 'International friendly', teams: [] };
    dates.forEach((d, r) => {
      const free = rng.shuffle(eligible(s).map(n => n.id).filter(id => !busy.has(id + d)));
      for (let i = 0; i + 1 < free.length; i += 2) { if (rng.chance(0.75)) TL.mkFixture(s, 'FRI', r, d, free[i], free[i + 1], { kind: 'intl' }); }
    });
    s.intlWindows = s.cal.intl.map(w => ({ start: w[0], end: w[1], callup: TL.addDays(w[0], -5), done: false }));
    if (s.intlPlan.tourneys.some(p => p.ready)) s.intlWindows.push({ start: s.cal.summer[0], end: s.cal.summer[7], callup: TL.addDays(s.cal.summer[0], -9), tournament: true, done: false });
  };

  function setupTournament(s, plan, teams, rng) {
    teams = plan.hosts.concat(teams.filter(id => !plan.hosts.includes(id) && s.nations[id])).slice(0, plan.size);
    teams = teams.slice(0, Math.floor(teams.length / 4) * 4); // groups of four
    if (teams.length < 8) return;
    const T = TOURNEYS.find(t => t.id === plan.id);
    const nG = teams.length / 4, letters = 'ABCDEFGHIJKL'.split('').slice(0, nG);
    const sorted = plan.hosts.concat(teams.filter(id => !plan.hosts.includes(id)).sort((a, b) => s.nations[b].elo - s.nations[a].elo));
    const groups = {}; letters.forEach(g => groups[g] = []);
    for (let pot = 0; pot < 4; pot++) { const potTeams = rng.shuffle(sorted.slice(pot * nG, pot * nG + nG)); if (pot === 0) potTeams.sort((a, b) => plan.hosts.includes(b) - plan.hosts.includes(a)); letters.forEach((g, i) => potTeams[i] && groups[g].push(potTeams[i])); }
    const comp = { id: plan.id, type: 'intl-t', name: `${T.name} ${s.season + 1}`, teams, groups, hosts: plan.hosts, stage: 'group', winner: null, venue: plan.hosts.length ? `${s.nations[plan.hosts[0]].name}` : 'Host city' };
    s.comps[plan.id] = comp;
    for (const g of letters) {
      const t = groups[g];
      const rounds = [[[t[0], t[1]], [t[2], t[3]]], [[t[0], t[2]], [t[3], t[1]]], [[t[3], t[0]], [t[1], t[2]]]];
      rounds.forEach((games, r) => games.forEach(([h, a]) => {
        const hostHome = plan.hosts.includes(h) || plan.hosts.includes(a);
        const [hh, aa] = plan.hosts.includes(a) ? [a, h] : [h, a];
        TL.mkFixture(s, comp.id, r, s.cal.summer[r], hh, aa, { kind: 'intl', group: g, stage: `Group ${g}`, neutral: !hostHome, venue: comp.venue });
      }));
    }
    plan.ready = true;
    if (s.intlWindows && !s.intlWindows.some(w => w.tournament)) s.intlWindows.push({ start: s.cal.summer[0], end: s.cal.summer[7], callup: TL.addDays(s.cal.summer[0], -9), tournament: true, done: false });
    TL.news(s, `The ${comp.name} line-up is complete: ${teams.length} nations will compete this summer.`);
  }

  function advanceTournament(s, comp, rng) {
    const fx = s.fixtures.filter(f => f.comp === comp.id);
    if (fx.some(f => !f.played)) return;
    if (comp.stage === 'group') {
      const tables = Object.keys(comp.groups).map(g => ({ g, t: TL.table(s, comp.id, { group: g }) }));
      // knockout size: the power of two between 2 and 3 qualifiers per group (12→8, 16→8, 24→16, 32→16, 48→32)
      const nG = tables.length; let P = 2; while (P < 2 * nG) P *= 2;
      const firsts = tables.map(x => x.t[0].id), seconds = tables.map(x => x.t[1].id);
      const thirds = tables.map(x => x.t[2]).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf).map(r => r.id);
      const q = firsts.concat(seconds, thirds.slice(0, Math.max(0, P - 2 * nG))).slice(0, P);
      comp.ko = 0; drawKO(s, comp, q, rng);
      return;
    }
    const last = fx.filter(f => f.round === comp.koRound);
    const winners = last.map(f => f.winner);
    if (winners.length === 1) {
      comp.winner = winners[0]; comp.stage = 'done';
      TL.trophy(s, comp.winner, comp.name);
      s.nations[comp.winner].history.push({ season: s.season, won: comp.name });
      TL.news(s, `${s.nations[comp.winner].name} win the ${comp.name}!`);
      TL.mailAll(s, 'media', `${s.nations[comp.winner].name} win the ${comp.name}`, `${s.nations[comp.winner].name} are champions after beating ${TL.team(s, last[0].home === comp.winner ? last[0].away : last[0].home).name} in the final.`);
      return;
    }
    drawKO(s, comp, winners, rng, true);
  }
  function drawKO(s, comp, teams, rng, keepOrder) {
    const n = teams.length;
    const pairs = [];
    if (keepOrder) for (let i = 0; i < n; i += 2) pairs.push([teams[i], teams[i + 1]]);
    else for (let i = 0; i < n / 2; i++) pairs.push([teams[i], teams[n - 1 - i]]);
    comp.koRound = 10 + (comp.ko || 0); comp.ko = (comp.ko || 0) + 1;
    comp.stage = TL.roundName(n);
    const date = s.cal.summer[Math.min(2 + comp.ko, 7)];
    for (const [a, b] of pairs) {
      const hostIn = comp.hosts.includes(a) || comp.hosts.includes(b);
      const [h, aw] = comp.hosts.includes(b) ? [b, a] : [a, b];
      TL.mkFixture(s, comp.id, comp.koRound, date, h, aw, { kind: 'intl', ko: true, stage: comp.stage, neutral: !hostIn, venue: comp.venue });
    }
  }

  function qualifiersDone(s, plan, rng) {
    if (plan.ready) return;
    const comps = plan.quals.filter(q => q.comp);
    if (comps.some(q => s.fixtures.some(f => f.comp === q.comp && !f.played))) return;
    const teams = [];
    for (const q of plan.quals) {
      if (q.direct) { teams.push(...q.direct); continue; }
      const comp = s.comps[q.comp];
      const rows = [];
      for (const g in comp.groups) TL.table(s, q.comp, { group: g }).forEach(r => rows.push(Object.assign({ g }, r)));
      rows.sort((a, b) => a.pos - b.pos || b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
      const qual = rows.slice(0, q.quota).map(r => r.id);
      teams.push(...qual);
      for (const r of rows) {
        const ok = qual.includes(r.id);
        s.managers.forEach((m, i) => { if (m.nationId === r.id) TL.asManager(s, i, () => TL.addMail(s, 'federation', ok ? `${plan.name}: we have qualified!` : `${plan.name}: we failed to qualify`, ok ? `${s.nations[r.id].name} finished ${TL.ordinal(r.pos)} in Group ${r.g} and will play at the ${plan.name}.` : `${s.nations[r.id].name} finished ${TL.ordinal(r.pos)} in Group ${r.g} and will not be at the ${plan.name}.`, true)); });
      }
    }
    setupTournament(s, plan, teams, rng);
  }

  /* ---------- Daily hooks ---------- */
  TL.intlDayTick = function (s, rng) {
    if (!s.intlWindows) return;
    for (const w of s.intlWindows) {
      if (w.done || s.date !== w.callup) continue;
      w.done = true;
      const playing = new Set(s.fixtures.filter(f => f.kind === 'intl' && f.date >= w.start && f.date <= w.end).flatMap(f => [f.home, f.away]));
      for (const id of playing) {
        const n = s.nations[id]; if (!n) continue;
        const human = TL.ownerIndex(s, id);
        if (human >= 0 && n.squadSetFor === w.start) continue;
        if (human >= 0) {
          TL.ensureNationPlayers(s, n, rng, w.tournament ? 26 : 23);
          TL.callUp(s, n, w.tournament ? 26 : 23);
          TL.asManager(s, human, () => TL.addMail(s, 'federation', 'Squad named by your assistant', `You didn't name a squad in time for the ${w.tournament ? 'tournament' : 'international break'}, so your assistant picked the strongest available ${n.players.length} players. You can still change it on the Nation screen until the first match.`, true));
        } else TL.callUp(s, n, w.tournament ? 26 : 23);
      }
      // tell human club managers which of their players were called up
      s.managers.forEach((m, i) => {
        if (!m.clubId) return;
        const called = s.clubs[m.clubId].players.map(id => s.players[id]).filter(p => [...playing].some(nid => s.nations[nid] && s.nations[nid].players.includes(p.id)));
        if (called.length) TL.asManager(s, i, () => TL.addMail(s, 'assistant', `${called.length} player${called.length > 1 ? 's' : ''} called up for international duty`, `${called.map(p => `• ${p.name} (${TL.NAT_NAMES[p.nat] || p.nat})`).join('\n')}\n\nThey will return tired, and there is always a risk of injury.`));
      });
      // remind human national managers ahead of the next window
    }
    for (const w of s.intlWindows) if (!w.reminded && TL.daysBetween(s.date, w.callup) === 10) {
      w.reminded = true;
      s.managers.forEach((m, i) => { if (m.nationId && s.fixtures.some(f => f.kind === 'intl' && f.date >= w.start && f.date <= w.end && (f.home === m.nationId || f.away === m.nationId))) TL.asManager(s, i, () => TL.addMail(s, 'federation', 'Name your squad', `Please name your ${w.tournament ? '26' : '23'}-man squad on the Nation screen before ${TL.fmtDate(w.callup, true)}.`, true)); });
    }
  };
  TL.intlAfterDay = function (s, rng) {
    if (!s.intlPlan) return;
    for (const f of s.fixtures) if (f.kind === 'intl' && f.played && !f.eloDone) { f.eloDone = true; eloUpdate(s, f, f.comp === 'FRI' ? 20 : /^Q-/.test(f.comp) ? 35 : 50); }
    for (const plan of s.intlPlan.tourneys) {
      if (!plan.ready) qualifiersDone(s, plan, rng);
      const comp = s.comps[plan.id];
      if (comp && !comp.winner) advanceTournament(s, comp, rng);
    }
  };
  TL.intlPending = s => !!s.intlPlan && s.intlPlan.tourneys.some(p => { const c = s.comps[p.id]; return (c && !c.winner) || (!p.ready && p.quals.some(q => q.comp && s.fixtures.some(f => f.comp === q.comp && !f.played))); });
  TL.intlSeasonEnd = function (s) {
    for (const plan of (s.intlPlan ? s.intlPlan.tourneys : [])) { const c = s.comps[plan.id]; if (c && c.winner) s.history.push({ season: s.season, comp: plan.id, name: c.name, champion: c.winner, intl: true }); }
    for (const id in s.nations) { const n = s.nations[id]; n.rating = Math.round(clamp(strength(s, n), 40, 95)); }
  };

  // Federation follow-up after a human-managed nation plays
  TL.afterNationMatch = function (s, f) {
    const m = s.manager, r = TL.userResult(s, f, m.nationId);
    const opp = s.nations[r.opp.id], me = s.nations[m.nationId];
    const exp = 1 / (1 + Math.pow(10, -(me.elo - opp.elo) / 400));
    const score = r.res === 'W' ? 1 : r.res === 'D' ? 0.5 : 0;
    const k = f.comp === 'FRI' ? 4 : 10;
    m.nboard.confidence = clamp(m.nboard.confidence + (score - exp) * k * 2, 0, 100);
    m.rep = clamp(m.rep + (score - exp) * 1.5, 0, 100);
    if (m.nboard.confidence < 10 && !s.settings.rules.unsackable && TL.sackManager) TL.sackManager(s, 'nation');
  };
})();
