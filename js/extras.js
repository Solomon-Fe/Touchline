/* Touchline — extras: loans to real clubs (first team and academy), creating academy players (3 a season),
   the U21 league & cup, youth trials (twice a season), player merchandise lines, inbox folders and
   richer national-team player information. No DOM access. */
(function () {
  const TL = window.TL, clamp = TL.clamp, Rng = TL.Rng;
  const isHuman = (s, id) => TL.ownerIndex(s, id) >= 0;
  const mine = s => s.manager.clubId ? s.clubs[s.manager.clubId] : null;
  const avgOvr = (s, ids) => { const ps = ids.map(id => s.players[id]).filter(Boolean); return ps.length ? ps.reduce((a, p) => a + p.ovr, 0) / ps.length : 55; };
  const hash = str => parseInt(TL.checksum(String(str)), 16) >>> 0;

  /* =========================================================
     LOANS TO REAL CLUBS
     ========================================================= */
  TL.loanDestinations = (s, pid) => {
    const p = s.players[pid], parent = s.clubs[p.clubId], out = [];
    for (const id in s.clubs) {
      const c = s.clubs[id];
      if (id === parent.id || isHuman(s, id) || c.players.length >= 30) continue;
      const xi = c.players.map(x => s.players[x]).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
      const starterBar = xi[10] ? xi[10].ovr : 50, avg = avgOvr(s, c.players);
      if (p.ovr < avg - 9) continue;
      const role = p.ovr >= starterBar ? 'Regular starter' : p.ovr >= avg - 2 ? 'Rotation' : 'Squad player';
      const score = (role === 'Regular starter' ? 3 : role === 'Rotation' ? 2 : 1) * 100 + c.rep;
      out.push({ id, name: c.name, league: (TL.leagueDef(s, c.leagueId) || {}).name || '', country: c.country, rep: c.rep, role, score });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 14);
  };
  TL.loanToClub = (s, pid, clubId) => {
    const p = s.players[pid], parent = s.clubs[p.clubId], to = s.clubs[clubId];
    if (!TL.windowInfo(s).open) return 'Loans to other clubs can only be agreed while a transfer window is open. Feeder-club loans are allowed at any time.';
    if (p.academy) { parent.academy = parent.academy.filter(x => x !== pid); p.academy = false; p.fromAcademy = true; parent.players.push(pid); }
    const contract = p.contract || { wage: 0.2, end: s.season + 2, clause: null };
    p.contract = contract;
    TL.completeTransfer(s, pid, clubId, 0, { wage: contract.wage, end: s.season, clause: null }, { loan: true });
    p.loanedBy = parent.id;
    return `${p.name} joins ${to.name} on loan until the end of the season. You will get monthly reports on how he is doing.`;
  };
  TL.recallFromClub = (s, pid) => {
    const p = s.players[pid]; if (!p.loan) return 'He is not on loan.';
    if (!TL.windowInfo(s).open) return 'You can only recall him while a transfer window is open.';
    const back = p.loan; p.loan = null;
    TL.completeTransfer(s, pid, back.parent, 0, back.contract, {});
    returnToAcademy(s, p);
    return `${p.name} has been recalled.`;
  };
  const returnToAcademy = (s, p) => {
    if (!p.fromAcademy) return;
    const c = s.clubs[p.clubId]; p.fromAcademy = false;
    if (c && p.age <= 21 && c.players.includes(p.id)) { c.players = c.players.filter(x => x !== p.id); c.academy = c.academy || []; c.academy.push(p.id); p.academy = true; }
  };
  TL.loanedOut = (s, clubId) => Object.values(s.players).filter(p => p.loan && p.loan.parent === clubId);

  /* =========================================================
     CREATE ACADEMY PLAYERS (3 a season)
     ========================================================= */
  TL.CREATE_LIMIT = 3;
  TL.createdThisSeason = (s, c) => c.created && c.created.season === s.season ? c.created.n : 0;
  TL.ACADEMY_TIERS = { Prospect: [72, 79], Talented: [80, 86], 'World class': [87, 91], Generational: [92, 95] };
  TL.createAcademyPlayer = (s, clubId, def) => {
    const c = s.clubs[clubId];
    if (TL.createdThisSeason(s, c) >= TL.CREATE_LIMIT) return { error: `You have already created ${TL.CREATE_LIMIT} players this season. The limit resets next season.` };
    const rng = new Rng(hash(s.date + clubId + (def.name || '') + s.nextId));
    const tier = TL.ACADEMY_TIERS[def.tier] || TL.ACADEMY_TIERS.Talented;
    const pos = def.pos || TL.PLAY_STYLES[def.style] || 'CM';
    const age = clamp(+def.age || 16, 15, 18);
    const p = TL.generateYouth(s, null, rng, { nat: def.nat || c.country, pos, age, ovr: rng.int(48, 56) + (age - 16) * 2, name: def.name || null, pot: rng.int(tier[0], tier[1]), prefix: 'C' });
    p.clubId = clubId; p.academy = true; p.homegrown = clubId; p.style = def.style || null; p.foot = def.foot || p.foot; p.created = true;
    for (const k of (TL.STYLE_ATTRS && TL.STYLE_ATTRS[p.style]) || []) p.attrs[k] = clamp(p.attrs[k] + 3, 1, 20);
    p.contract = { wage: Math.max(0.1, Math.round(TL.wageFor(p, c.rep, c) * 3) / 10), end: s.season + 3, clause: null };
    c.academy = c.academy || []; c.academy.push(p.id);
    c.created = { season: s.season, n: TL.createdThisSeason(s, c) + 1 };
    return { p };
  };

  /* =========================================================
     U21 LEAGUE & CUP
     ========================================================= */
  const dowOf = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
  const nextDow = (iso, d) => { let x = iso; while (dowOf(x) !== d) x = TL.addDays(x, 1); return x; };
  // U21 team strength: academy plus first-team players aged 21 or under who are not regular starters
  TL.u21Strength = (s, c) => {
    if (isHuman(s, c.id)) {
      const xi = new Set(c.lineup ? c.lineup.xi : []);
      const ps = (c.academy || []).concat(c.players.filter(id => !xi.has(id))).map(id => s.players[id]).filter(p => p && p.age <= 21 && !p.onLoan && p.injury <= 0).sort((a, b) => b.ovr - a.ovr).slice(0, 11);
      const sum = ps.reduce((a, p) => a + p.ovr, 0) + (11 - ps.length) * 46;
      return sum / 11;
    }
    // computer clubs: academy quality follows reputation (youth facilities) with a little variation each season
    return 47 + (c.rep - 55) * 0.28 + ((c.facilities ? c.facilities.youth : 8) - 8) * 0.3 + ((hash(c.id + s.season) % 7) - 3);
  };
  TL.u21Squad = (s, c) => { const xi = new Set(c.lineup ? c.lineup.xi : []); return (c.academy || []).concat(c.players.filter(id => !xi.has(id))).map(id => s.players[id]).filter(p => p && p.age <= 21 && !p.onLoan && p.injury <= 0); };
  function setupYouth(s) {
    if (!s.youth || s.youth.season !== s.season) s.youth = { season: s.season, leagues: {} };
    const lgs = new Set(TL.humanClubIds(s).map(id => s.clubs[id].leagueId));
    for (const lgId of lgs) {
      if (s.youth.leagues[lgId]) continue;
      const lg = TL.leagueDef(s, lgId), ids = TL.leagueClubs(s, lgId).map(c => c.id);
      const rng = new Rng(hash(lgId + s.season));
      const rounds = TL.roundRobin(ids, rng, false);
      // dates: Mondays from September (or from now, mid-season), adding Thursdays if the calendar is short
      let start = `${s.season}-09-01`; if (s.date >= start) start = TL.addDays(s.date, 1);
      const end = `${s.season + 1}-05-18`, mons = [], thus = [];
      for (let d = start; d <= end; d = TL.addDays(d, 1)) { const w = dowOf(d); if (w === 1) mons.push(d); else if (w === 4) thus.push(d); }
      const slots = mons.length >= rounds.length ? mons : mons.concat(thus).sort();
      const n = rounds.length, pick = i => slots[Math.min(slots.length - 1, Math.round(i * (slots.length - 1) / Math.max(1, n - 1)))];
      const fixtures = [];
      rounds.forEach((games, r) => { const date = pick(r); for (const [h, a] of games) fixtures.push({ r, date, home: h, away: a, hg: null, ag: null }); });
      // cup: knockout between the league's clubs (preliminary round if needed), Thursdays
      const cupDates = ['10-16', '11-20', '01-22', '02-26', '04-09', '05-07'].map((md, i) => nextDow(`${i < 2 ? s.season : s.season + 1}-${md}`, 4));
      s.youth.leagues[lgId] = { name: `${lg.name} U21`, fixtures, cup: { name: `${lg.name} U21 Cup`, alive: rng.shuffle(ids.slice()), round: 0, dates: cupDates, ties: [], winner: null } };
    }
  }
  // Simulate a U21 game (when nobody watches it). Human clubs get their stats and a Head of Youth report.
  function playYouthGame(s, home, away, rng, cup, label) {
    const H = s.clubs[home], A = s.clubs[away];
    const sh = TL.u21Strength(s, H) + 1.5, sa = TL.u21Strength(s, A);
    const lam = d => clamp(1.35 * Math.exp(d / 10), 0.2, 4);
    const poisson = l => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= rng.next(); } while (p > L); return k - 1; };
    const hg = poisson(lam(sh - sa)), ag = poisson(lam(sa - sh));
    let pens = null;
    if (cup && hg === ag) pens = rng.chance(clamp(0.5 + (sh - sa) / 60, 0.3, 0.7)) ? 'home' : 'away';
    return applyYouthResult(s, { home, away, cup, label }, hg, ag, pens, null, rng);
  }
  // Record a U21 result for the human side(s): appearances, goals, results list and the report.
  // watched = { goals: {id: n}, ratings: {id: r}, ids: [...] } when the manager watched the game live.
  function applyYouthResult(s, g, hg, ag, pens, watched, rng) {
    const { home, away, cup } = g, H = s.clubs[home], A = s.clubs[away];
    for (const [cid, gf, ga, opp, side] of [[home, hg, ag, A, 'home'], [away, ag, hg, H, 'away']]) {
      const c = s.clubs[cid]; if (!isHuman(s, cid)) continue;
      const squad = watched ? watched.ids.map(id => s.players[id]).filter(Boolean) : TL.u21Squad(s, c).sort((a, b) => b.ovr - a.ovr).slice(0, 14);
      const goals = {};
      if (watched) Object.assign(goals, watched.goals);
      else for (let k = 0; k < gf && squad.length; k++) { const sc = rng.weighted(squad, p => (({ ST: 3, LW: 2, RW: 2, AM: 1.6, CM: 0.8, DM: 0.4 })[p.pos] || 0.25) * (4 + p.attrs.finishing)); goals[sc.id] = (goals[sc.id] || 0) + 1; }
      for (const p of squad) { p.youthStats = p.youthStats || { apps: 0, goals: 0 }; p.youthStats.apps++; p.youthStats.goals += goals[p.id] || 0; }
      const pr = pens ? (pens === side ? 'W' : 'L') : null;
      c.youthResults = c.youthResults || [];
      c.youthResults.unshift({ date: s.date, team: cup ? 'U21 Cup' : 'U21', opp: opp.name, gf, ga, pens: pr });
      c.youthResults = c.youthResults.slice(0, 16);
      youthReport(s, c, opp, gf, ga, pr, squad, goals, watched, g.label || (cup ? 'U21 Cup' : 'U21 league'), rng);
    }
    return { hg, ag, pens, winner: hg > ag ? home : hg < ag ? away : pens === 'home' ? home : pens === 'away' ? away : null };
  }
  const ovrAt = (p, date) => { const h = p.hist || []; let v = null; for (const [d, o] of h) { if (d <= date) v = o; else break; } return v != null ? v : (h.length ? h[0][1] : p.ovr); };
  // The Head of Youth Development's match report
  function youthReport(s, c, opp, gf, ga, pens, squad, goals, watched, comp, rng) {
    rng = rng || new Rng(hash(s.date + c.id + opp.id));
    const yc = TL.staffRating(s, c.id, 'youthCoach');
    const res = gf > ga || pens === 'W' ? 'W' : gf < ga || pens === 'L' ? 'L' : 'D';
    const rows = squad.map(p => {
      const r = watched && watched.ratings[p.id] != null ? watched.ratings[p.id] : clamp(Math.round((6.3 + (gf - ga) * 0.15 + (p.ovr - 56) / 14 + (goals[p.id] || 0) * 0.8 + rng.normal() * 0.45) * 10) / 10, 4.5, 9.6);
      return { id: p.id, r, g: goals[p.id] || 0 };
    }).sort((a, b) => b.r - a.r);
    const motm = rows[0];
    const month = TL.addDays(s.date, -45);
    const improved = squad.map(p => ({ p, d: p.ovr - ovrAt(p, month) })).filter(x => x.d > 0).sort((a, b) => b.d - a.d)[0];
    const young = squad.filter(p => p.age <= 19 && !p.temp), pool = young.length > 1 && improved ? young.filter(p => p !== improved.p) : young;
    const watch = pool.map(p => ({ p, v: (p.pot - p.ovr) * 0.6 + ((rows.find(x => x.id === p.id) || {}).r || 6) * 4 + p.pot * 0.3 })).sort((a, b) => b.v - a.v)[0];
    const struggled = rows.length > 3 ? rows[rows.length - 1] : null;
    const notes = [];
    notes.push(res === 'W' ? (gf - ga >= 3 ? 'A dominant display from start to finish.' : 'A hard-earned win. The boys stuck to the plan.') : res === 'D' ? 'A fair result. We had spells on top but lacked the final pass.' : (ga - gf >= 3 ? 'A tough afternoon. They were bigger and quicker than us.' : 'We competed well but made costly mistakes.'));
    if (motm) notes.push(`${s.players[motm.id].name} was our best player (${motm.r.toFixed(1)}).`);
    if (improved) notes.push(`${improved.p.name} has improved the most recently (+${improved.d} in six weeks). ${yc >= 14 ? 'His decision-making is much sharper.' : 'He is training well.'}`);
    if (watch && watch.p !== (improved && improved.p)) notes.push(`One to watch: ${watch.p.name} (${watch.p.age}). ${watch.p.pot >= 85 ? 'I believe he can play at the very top.' : 'He has a real chance of a first-team future.'}`);
    if (struggled && struggled.r < 6.1) notes.push(`${s.players[struggled.id].name} struggled today and needs more time.`);
    const rep = { id: s.nextId++, date: s.date, comp, opp: opp.name, oppId: opp.id, gf, ga, pens, res, watched: !!watched, rows, motm: motm && motm.id, improved: improved && { id: improved.p.id, d: improved.d }, watch: watch && watch.p.id, notes, coach: yc };
    c.u21Reports = c.u21Reports || []; c.u21Reports.unshift(rep); c.u21Reports = c.u21Reports.slice(0, 14);
    TL.mailClub(s, c.id, 'academy', `${comp}: ${c.name} ${gf}–${ga} ${opp.name}${pens ? ' (pens)' : ''}`, `Report from the Head of Youth Development${watched ? ' (you watched this one)' : ''}:\n\n${notes.join('\n\n')}`);
    TL.asManager(s, TL.ownerIndex(s, c.id), () => { s.inbox[0].action = { kind: 'u21report', id: rep.id }; });
    return rep;
  }
  TL.u21Report = (s, c, id) => (c.u21Reports || []).find(r => r.id === id);

  /* ---------- Watch or skip: pending U21 games involving a human club ---------- */
  const askMode = (s, id) => isHuman(s, id) && (s.clubs[id].u21Mode || 'ask') === 'ask';
  function pend(s, g) {
    s.youthPending = s.youthPending || [];
    g.key = s.nextId++; s.youthPending.push(g);
    const hc = isHuman(s, g.home) ? g.home : g.away, opp = s.clubs[hc === g.home ? g.away : g.home];
    TL.mailClub(s, hc, 'academy', `U21 match today: ${opp.name} (${g.label})`, `Our U21s play ${opp.name} today${g.cup ? ' in the cup' : ''}. Do you want to watch the game, or skip it and I will send you a full report?`, true);
    TL.asManager(s, TL.ownerIndex(s, hc), () => { s.inbox[0].action = { kind: 'u21match', key: g.key }; });
  }
  TL.youthPendingFor = (s, clubId) => (s.youthPending || []).filter(g => g.home === clubId || g.away === clubId);
  // Apply the result of a pending game and continue the league/cup bookkeeping
  TL.resolveYouthPending = (s, key, result) => {
    const i = (s.youthPending || []).findIndex(g => g.key === key); if (i < 0) return null;
    const g = s.youthPending.splice(i, 1)[0];
    const rng = new Rng(hash(key + s.date));
    const r = result ? applyYouthResult(s, g, result.hg, result.ag, result.pens, result.watched, rng) : playYouthGame(s, g.home, g.away, rng, g.cup, g.label);
    const Y = s.youth && s.youth.leagues[g.lgId]; if (!Y) return r;
    if (!g.cup) { const f = Y.fixtures[g.fi]; if (f) { f.hg = r.hg; f.ag = r.ag; } }
    else {
      const w = Y.cup.waiting; if (w) { w.ties.push({ home: g.home, away: g.away, hg: r.hg, ag: r.ag, pens: r.pens, winner: r.winner }); w.winners.push(r.winner); w.left--; if (w.left <= 0) finishCupRound(s, Y.cup); }
    }
    return Object.assign({ g }, r);
  };
  function finishCupRound(s, cup) {
    const w = cup.waiting; cup.waiting = null;
    cup.ties.push({ round: cup.round, date: w.date, name: w.name, ties: w.ties });
    cup.alive = w.byes.concat(w.winners); cup.round++;
    if (cup.alive.length === 1) {
      cup.winner = cup.alive[0];
      if (isHuman(s, cup.winner)) TL.mailClub(s, cup.winner, 'academy', `${cup.name} winners!`, `Our U21s have won the ${cup.name}. A proud day for the academy.`, true);
    }
  }
  // Watching live: the two U21 sides are added for the duration of the match (removed afterwards)
  TL.youthMatchSetup = (s, key) => {
    const g = (s.youthPending || []).find(x => x.key === key); if (!g) return null;
    const rng = new Rng(hash(key + 'squad'));
    const mk = (cid) => {
      const c = s.clubs[cid], vid = cid + '~U21';
      const POS = ['GK', 'GK', 'RB', 'CB', 'CB', 'LB', 'CB', 'DM', 'CM', 'CM', 'AM', 'RW', 'LW', 'ST', 'ST', 'CM', 'RB', 'LW'];
      const gen = (i, pos, base, tag) => {
        const id = `${vid}-${tag}${i}`, pr = new Rng(hash(id + s.season));
        const p = TL.createPlayer({ id, name: TL.randomName(c.country, pr), pos, age: pr.int(17, 21), nat: c.country, ovr: Math.round(clamp(base + pr.normal() * 3.5, 38, 80)), clubId: vid }, pr);
        p.temp = true; if (tag === 't') p.name += ' (trialist)'; s.players[id] = p; return id;
      };
      let ids;
      if (isHuman(s, cid)) {
        ids = TL.u21Squad(s, c).sort((a, b) => b.ovr - a.ovr).slice(0, 18).map(p => p.id);
        // a thin U21 squad is topped up with trialists so a full team can play
        const have = {}; ids.forEach(id => { const g = TL.POS_GROUP[s.players[id].pos]; have[g] = (have[g] || 0) + 1; });
        const need = POS.filter(pos => { const g = TL.POS_GROUP[pos]; if (have[g] > 0) { have[g]--; return false; } return true; });
        need.slice(0, Math.max(0, 16 - ids.length)).forEach((pos, i) => ids.push(gen(i, pos, 47, 't')));
        for (let i = 0; ids.length < 16; i++) ids.push(gen(50 + i, POS[(i * 5) % POS.length], 47, 't'));
      } else {
        const base = TL.u21Strength(s, c);
        ids = POS.map((pos, i) => gen(i, pos, base - (i > 13 ? 3 : 0), ''));
      }
      s.clubs[vid] = { id: vid, short: cid, name: `${c.name} U21`, city: c.city, stadium: `${c.name} Academy ground`, cap: 1200 + (c.rep - 50) * 40, rep: c.rep, c1: c.c1, c2: c.c2, badge: c.badge, players: ids, tactics: { formation: isHuman(s, cid) ? c.tactics.formation : '4-3-3', mentality: 0, press: 1, tempo: 1 }, lineup: null, temp: true, isYouth: true, fam: c.fam, staffIds: c.staffIds, country: c.country };
      return vid;
    };
    const home = mk(g.home), away = mk(g.away);
    const userSide = isHuman(s, g.home) ? 'home' : 'away';
    return { g, fixture: { id: 'U21-' + key, comp: 'U21', home, away, date: s.date, kind: 'club', ko: !!g.cup, stage: g.label, youth: true }, userSide };
  };
  TL.youthMatchCleanup = s => {
    for (const id in s.clubs) if (s.clubs[id].temp) delete s.clubs[id];
    for (const id in s.players) if (s.players[id].temp) delete s.players[id];
  };
  // After watching: turn the live match into a result + report
  TL.finishYouthWatch = (s, key, match) => {
    const side = match.userSide, other = side === 'home' ? 'away' : 'home';
    const goals = {}, ratings = {}, ids = [];
    for (const id in match.ps) { const ps = match.ps[id]; if (ps.side !== side) continue; ids.push(id); ratings[id] = ps.rating; if (ps.goals) goals[id] = ps.goals; }
    const hg = match.sides.home.goals, ag = match.sides.away.goals;
    const pens = match.pens ? (match.pens.home > match.pens.away ? 'home' : 'away') : null;
    TL.youthMatchCleanup(s);
    return TL.resolveYouthPending(s, key, { hg, ag, pens, watched: { goals, ratings, ids } });
  };
  TL.youthTable = (s, lgId) => {
    const Y = s.youth && s.youth.leagues[lgId]; if (!Y) return [];
    const rows = {};
    for (const f of Y.fixtures) for (const id of [f.home, f.away]) rows[id] = rows[id] || { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
    for (const f of Y.fixtures) {
      if (f.hg == null) continue;
      const h = rows[f.home], a = rows[f.away]; h.p++; a.p++; h.gf += f.hg; h.ga += f.ag; a.gf += f.ag; a.ga += f.hg;
      if (f.hg > f.ag) { h.w++; a.l++; h.pts += 3; } else if (f.hg < f.ag) { a.w++; h.l++; a.pts += 3; } else { h.d++; a.d++; h.pts++; a.pts++; }
    }
    return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf).map((r, i) => Object.assign(r, { pos: i + 1, gd: r.gf - r.ga }));
  };
  function youthDay(s, date, rng) {
    if (!s.youth || s.youth.season !== s.season || TL.humanClubIds(s).some(id => !s.youth.leagues[s.clubs[id].leagueId])) setupYouth(s);
    // games you did not decide on by the next day are played without you (and reported)
    for (const g of (s.youthPending || []).slice()) if (g.date < date) TL.resolveYouthPending(s, g.key, null);
    for (const lgId in s.youth.leagues) {
      const Y = s.youth.leagues[lgId];
      Y.fixtures.forEach((f, fi) => {
        if (f.date !== date || f.hg != null || (s.youthPending || []).some(g => !g.cup && g.lgId === lgId && g.fi === fi)) return;
        if (askMode(s, f.home) || askMode(s, f.away)) { pend(s, { lgId, fi, home: f.home, away: f.away, cup: false, date, label: Y.name }); return; }
        const r = playYouthGame(s, f.home, f.away, rng, false, Y.name); f.hg = r.hg; f.ag = r.ag;
      });
      const cup = Y.cup;
      if (!cup.winner && !cup.waiting && cup.dates[cup.round] === date && cup.alive.length > 1) {
        let p = 1; while (p * 2 <= cup.alive.length) p *= 2;
        const extra = cup.alive.length - p, playing = extra ? cup.alive.slice(cup.alive.length - extra * 2) : cup.alive.slice(), byes = extra ? cup.alive.slice(0, cup.alive.length - extra * 2) : [];
        cup.waiting = { byes, winners: [], ties: [], date, name: TL.roundName(playing.length === 2 && !byes.length ? 2 : p * (extra ? 2 : 1)), left: 0 };
        for (let i = 0; i + 1 < playing.length; i += 2) {
          const h = playing[i], a = playing[i + 1];
          if (askMode(s, h) || askMode(s, a)) { cup.waiting.left++; pend(s, { lgId, home: h, away: a, cup: true, date, label: `${cup.name} · ${cup.waiting.name}` }); continue; }
          const r = playYouthGame(s, h, a, rng, true, cup.name);
          cup.waiting.ties.push({ home: h, away: a, hg: r.hg, ag: r.ag, pens: r.pens, winner: r.winner }); cup.waiting.winners.push(r.winner);
        }
        if (!cup.waiting.left) finishCupRound(s, cup);
      }
      // end of the U21 season
      if (!Y.done && Y.fixtures.every(f => f.hg != null)) {
        Y.done = true;
        const t = TL.youthTable(s, lgId);
        for (const cid of TL.humanClubIds(s)) { const row = t.find(r => r.id === cid); if (row) TL.mailClub(s, cid, 'academy', `${Y.name}: we finished ${TL.ordinal(row.pos)}`, `Our U21s finished ${TL.ordinal(row.pos)} with ${row.pts} points. Champions: ${s.clubs[t[0].id].name}.`); }
      }
    }
  }

  /* =========================================================
     YOUTH TRIALS (twice a season)
     ========================================================= */
  const TRIAL_DATES = s => [`${s.season}-08-10`, `${s.season + 1}-01-15`];
  TL.TRIAL_SIGN_MAX = 3;
  function openTrials(s, c, rng) {
    const fac = c.facilities.youth || 8, yc = TL.staffRating(s, c.id, 'youthCoach'), net = c.facilities.scouting || 0;
    const n = 6 + Math.round(fac / 6) + net;
    const ids = [];
    const feederNats = (TL.feedersOf ? TL.feedersOf(s, c.id) : []).map(f => TL.feederCountry(s, f));
    for (let i = 0; i < n; i++) {
      const nat = rng.chance(0.68) ? c.country : rng.chance(0.5) && feederNats.length ? rng.pick(feederNats) : rng.pick(['NGA', 'GHA', 'SEN', 'CIV', 'BRA', 'ARG', 'FRA', 'ESP', 'POR', 'NED', 'BEL', 'ENG', 'IRL']);
      const p = TL.generateYouth(s, null, rng, { nat, age: rng.int(15, 17), boost: Math.round((fac - 8) / 3), prefix: 'T' });
      p.pot = clamp(p.ovr + rng.int(6, 26) + Math.round((fac + yc) / 8), p.ovr + 4, 93);
      p.trialist = c.id; p.contract = null;
      // how he did in the trial game (noisy, a good youth coach reads it better)
      p.trialScore = clamp(Math.round(5 + (p.pot - 75) / 3.5 + rng.normal() * (2.4 - yc / 12)), 1, 10);
      ids.push(p.id);
    }
    c.trials = { opens: s.date, closes: TL.addDays(s.date, 14), ids, signed: [] };
    TL.mailClub(s, c.id, 'academy', 'Youth trials are open', `${n} youngsters are on trial at the academy this fortnight. Watch them on the Academy screen and offer youth contracts to up to ${TL.TRIAL_SIGN_MAX} of them before ${TL.fmtDate(c.trials.closes, true)}.`, true);
    TL.asManager(s, TL.ownerIndex(s, c.id), () => { s.inbox[0].action = { kind: 'trials' }; });
  }
  function closeTrials(s, c) {
    const t = c.trials; if (!t) return;
    for (const id of t.ids) if (!t.signed.includes(id) && s.players[id] && s.players[id].trialist) delete s.players[id];
    c.trials = null;
  }
  TL.trialView = (s, p) => {
    const c = s.clubs[p.trialist], yc = TL.staffRating(s, c.id, 'youthCoach');
    const w = Math.max(1, Math.round(6 - yc / 4)), off = hash(p.id) % 3 - 1;
    return { lo: p.ovr - w + off, hi: p.ovr + w + off, plo: Math.max(p.ovr, p.pot - w - 3), phi: Math.min(99, p.pot + w + 1), score: p.trialScore };
  };
  TL.signTrialist = (s, pid) => {
    const c = mine(s), t = c && c.trials, p = s.players[pid];
    if (!t || !t.ids.includes(pid)) return 'The trial is over.';
    if (t.signed.includes(pid)) return 'Already signed.';
    if (t.signed.length >= TL.TRIAL_SIGN_MAX) return `You can sign at most ${TL.TRIAL_SIGN_MAX} trialists.`;
    t.signed.push(pid);
    p.trialist = null; p.clubId = c.id; p.academy = true; p.homegrown = c.id;
    p.contract = { wage: Math.max(0.1, Math.round(TL.wageFor(p, c.rep, c) * 3) / 10), end: s.season + 3, clause: null };
    c.academy = c.academy || []; c.academy.push(pid);
    return `${p.name} signs a youth contract and joins the academy.`;
  };

  /* =========================================================
     PLAYER MERCHANDISE
     ========================================================= */
  TL.MERCH_PRODUCTS = {
    shirts: { name: 'Replica shirts with his name', setup: 0.3, base: 0.3 },
    boots: { name: 'Signature boots', setup: 0.25, base: 0.15 },
    caps: { name: 'Caps & scarves', setup: 0.06, base: 0.08 },
    cups: { name: 'Mugs & cups', setup: 0.04, base: 0.05 },
    umbrellas: { name: 'Umbrellas', setup: 0.03, base: 0.035 },
    posters: { name: 'Posters & cards', setup: 0.02, base: 0.03 }
  };
  TL.merchPopularity = (s, p) => clamp((p.ovr - 68) / 18, 0.12, 1.4) * (p.star || p.wonderkid ? 1.25 : 1) * (p.age <= 23 ? 1.1 : 1) * (1 + (p.intl ? Math.min(p.intl.caps, 60) / 200 : 0));
  const merchScale = c => Math.sqrt(((c.fans && c.fans.size) || c.cap) / 40000) * Math.max(0.04, TL.econOf(c).sponsor);
  TL.merchEligible = (s, p) => p.ovr >= 78 || p.star || p.wonderkid;
  TL.merchFor = (s, pid) => (s.merch || []).find(x => x.pid === pid && x.active);
  TL.merchEstimate = (s, p, c, key) => { const P = TL.MERCH_PRODUCTS[key]; return { setup: Math.round(P.setup * Math.max(0.05, TL.econOf(c).sponsor) * (0.5 + merchScale(c) / 2) * 100) / 100, monthly: Math.round(P.base * TL.merchPopularity(s, p) * merchScale(c) * 1.35 * 1000) / 1000 }; };
  TL.launchMerch = (s, pid, products) => {
    const p = s.players[pid], c = mine(s);
    if (!c || p.clubId !== c.id) return 'He is not your player.';
    if (TL.merchFor(s, pid)) return 'A merchandise line is already running.';
    if (!products.length) return 'Pick at least one product.';
    const setup = products.reduce((a, k) => a + TL.merchEstimate(s, p, c, k).setup, 0);
    if (c.finance.balance < setup) return `Not enough money: setting up costs ${TL.fmtM(setup)}.`;
    TL.book(s, 'exp', 'merchSetup', setup);
    s.merch = s.merch || [];
    s.merch.push({ id: s.nextId++, pid, clubId: c.id, products, start: s.date, hype: 1.4, earned: 0, last: 0, goalsSeen: p.stats.goals, active: true });
    TL.news(s, `${c.name} launch a ${p.name} merchandise range.`, { pid, club: c.id });
    return `The ${p.name} range is in the club shop. Setup cost ${TL.fmtM(setup)}. Sales are paid monthly.`;
  };
  TL.endMerch = (s, id) => { const m = (s.merch || []).find(x => x.id === id); if (m) { m.active = false; m.ended = s.date; } return 'Merchandise line ended.'; };
  function merchMonth(s) {
    for (const m of (s.merch || []).filter(x => x.active)) {
      const p = s.players[m.pid], c = s.clubs[m.clubId];
      if (!p || !c || !isHuman(s, c.id)) { m.active = false; continue; }
      const i = TL.ownerIndex(s, c.id);
      if (p.clubId !== c.id) { // he left: clearance sale, then the line closes
        const clear = m.last * 0.5; m.active = false; m.ended = s.date;
        TL.asManager(s, i, () => { if (clear > 0) TL.book(s, 'inc', 'playerMerch', clear); TL.addMail(s, 'finance', `${p.name} merchandise: clearance sale`, `${p.name} has left, so his merchandise line has closed. A clearance sale raised ${TL.fmtM(clear)}. Total earned: ${TL.fmtM(m.earned + clear)}.`); });
        continue;
      }
      const goals = p.stats.goals >= m.goalsSeen ? p.stats.goals - m.goalsSeen : p.stats.goals;
      m.goalsSeen = p.stats.goals;
      m.hype = clamp(m.hype * 0.94 + goals * 0.04 + (p.form && p.form.length ? (p.form.reduce((a, b) => a + b, 0) / p.form.length - 6.8) * 0.06 : 0), 0.35, 1.8);
      const inc = m.products.reduce((a, k) => a + TL.MERCH_PRODUCTS[k].base, 0) * TL.merchPopularity(s, p) * merchScale(c) * m.hype;
      m.last = Math.round(inc * 1000) / 1000; m.earned += m.last;
      TL.asManager(s, i, () => TL.book(s, 'inc', 'playerMerch', m.last));
    }
  }
  TL.offerMerch = (s, p) => {
    const c = mine(s); if (!c || !TL.merchEligible(s, p) || TL.merchFor(s, p.id)) return;
    TL.addMail(s, 'finance', `Commercial opportunity: ${p.name} merchandise`, `${p.name}'s arrival has fans queuing at the club shop. We could launch a range with his name: replica shirts, boots, caps, mugs, umbrellas and posters.\n\nOpen his profile and choose Merchandise to see costs and expected income.`, true);
    s.inbox[0].action = { kind: 'merch', id: p.id };
  };

  /* =========================================================
     INBOX FOLDERS
     ========================================================= */
  TL.saveMail = (s, id) => { const m = s.manager, i = m.inbox.findIndex(x => x.id === id); if (i < 0) return; const [x] = m.inbox.splice(i, 1); x.read = true; m.saved = m.saved || []; m.saved.unshift(x); };
  TL.deleteMail = (s, id) => { const m = s.manager; m.inbox = m.inbox.filter(x => x.id !== id); m.saved = (m.saved || []).filter(x => x.id !== id); };
  TL.deleteReadMail = s => { const m = s.manager, n = m.inbox.filter(x => x.read).length; m.inbox = m.inbox.filter(x => !x.read); return n; };

  /* =========================================================
     NATIONAL TEAM: deeper pools and season info for players abroad
     ========================================================= */
  TL.ABROAD_LEAGUES = { top: ['Saudi Pro League', 'Süper Lig', 'Eredivisie', 'Primeira Liga', 'MLS', 'Belgian Pro League'], mid: ['Scottish Premiership', 'Danish Superliga', 'Greek Super League', 'Swiss Super League', 'Austrian Bundesliga', 'Qatar Stars League', 'Chinese Super League', 'Ligue 2', 'Serie B', '2. Bundesliga', 'Championship'] };
  TL.deepenNationPool = (s, n, target) => {
    const pool = TL.nationPool(s, n.code);
    if (pool.length >= target) return 0;
    const rng = new Rng(hash(n.code + s.season + pool.length));
    const POS = ['GK', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'AM', 'LW', 'RW', 'ST', 'ST'];
    const k = target - pool.length;
    for (let i = 0; i < k; i++) {
      const ovr = Math.round(clamp(n.base - 2 - i * 0.35 + rng.normal() * 3, 42, 86));
      const p = TL.generateYouth(s, null, rng, { nat: n.code, pos: POS[i % POS.length], age: clamp(Math.round(25 + rng.normal() * 4), 18, 35), ovr, youth: false, prefix: 'N', pot: ovr + rng.int(0, 5) });
      p.abroad = ovr >= 72 ? rng.pick(TL.ABROAD_LEAGUES.top) : rng.chance(0.4) ? `${n.name} Premier League` : rng.pick(TL.ABROAD_LEAGUES.mid);
      p.filler = true; p.contract = null;
    }
    return k;
  };
  // Season numbers for players outside the simulated leagues (deterministic estimate, refreshed as the season goes)
  TL.abroadStats = (s, p) => {
    const weeks = clamp(TL.daysBetween(`${s.season}-08-10`, s.date) / 7, 0, 40), h = hash(p.id + s.season);
    const share = 0.55 + (h % 40) / 100 + (p.ovr >= 75 ? 0.05 : 0);
    const apps = Math.round(weeks * share);
    const rate = ({ ST: 0.45, LW: 0.28, RW: 0.28, AM: 0.24, CM: 0.1, DM: 0.04, CB: 0.04, LB: 0.03, RB: 0.03, GK: 0 })[p.pos] * (0.6 + p.ovr / 160);
    const goals = Math.round(apps * rate * (0.7 + ((h >> 8) % 60) / 100));
    const assists = Math.round(apps * rate * 0.6 * (0.6 + ((h >> 4) % 70) / 100));
    const avg = clamp(6.35 + (p.ovr - 66) / 45 + (((h >> 12) % 60) - 30) / 100, 5.8, 8.2);
    return { apps, goals, assists, avg, est: true };
  };

  // The assistant's squad: ability blended with current form, goals, game time, fitness and experience
  TL.playerSeason = (s, p) => {
    const st = p.clubId && !p.abroad ? { apps: p.stats.apps, goals: p.stats.goals, assists: p.stats.assists, avg: p.stats.rated ? p.stats.ratingSum / p.stats.rated : 0, est: false } : TL.abroadStats(s, p);
    st.form = p.clubId && !p.abroad && p.form && p.form.length ? p.form.reduce((a, b) => a + b, 0) / p.form.length : st.avg;
    return st;
  };
  TL.recommendSquad = (s, n, size) => {
    size = size || 23;
    const pool = TL.nationPool(s, n.code).filter(p => !p.temp && !(p.injury > 12));
    const early = TL.daysBetween(`${s.season}-08-10`, s.date) < 35;
    const best = pool.slice(0, 3).map(p => p.ovr);
    const rated = pool.map(p => {
      const st = TL.playerSeason(s, p), g = TL.POS_GROUP[p.pos], caps = p.intl ? p.intl.caps : 0;
      let score = p.ovr;
      if (st.apps >= 3) score += (st.form - 6.7) * 5;
      if (!early && st.apps < 4) score -= 3;
      if (g === 'ATT' || g === 'MID') score += Math.min(4, st.goals * (g === 'ATT' ? 0.35 : 0.5));
      score += Math.min(2, caps / 30);
      if (p.cond < 70) score -= 2;
      if (p.injury > 0) score -= 4;
      const why = [];
      if (st.apps >= 3 && st.form >= 7.1) why.push([3, `In form: ${st.form.toFixed(1)} average`]);
      if (st.goals >= 3 && st.goals >= st.apps * 0.35) why.push([3, `${st.goals} goals in ${st.apps} games`]);
      if (p.ovr >= best[2]) why.push([2, `One of our best players (${p.ovr})`]);
      if (caps >= 40) why.push([1, `Experienced: ${caps} caps`]);
      if (p.age <= 21 && p.pot >= 80) why.push([1, 'Exciting young talent']);
      if (st.apps >= 3 && st.form < 6.4) why.push([2, `Out of form (${st.form.toFixed(1)})`]);
      if (!early && st.apps < 4) why.push([2, 'Short of game time']);
      if (p.injury > 0) why.push([3, `Carrying a knock (${p.injury} days)`]);
      if (!why.length) why.push([0, `Reliable option (${p.ovr})`]);
      return { p, score, why: why.sort((a, b) => b[0] - a[0]).slice(0, 2).map(x => x[1]) };
    }).sort((a, b) => b.score - a.score);
    const quota = size >= 26 ? { GK: 3, DEF: 9, MID: 8, ATT: 6 } : { GK: 3, DEF: 8, MID: 7, ATT: 5 };
    const picks = [];
    for (const g in quota) picks.push(...rated.filter(r => TL.POS_GROUP[r.p.pos] === g).slice(0, quota[g]));
    for (const r of rated) { if (picks.length >= size) break; if (!picks.includes(r)) picks.push(r); }
    const chosen = picks.slice(0, size);
    return { picks: chosen, nextBest: rated.filter(r => !chosen.includes(r)).slice(0, 6) };
  };

  /* =========================================================
     BIDS FOR ANY OF YOUR PLAYERS (not only listed ones)
     ========================================================= */
  function bidsForHumanPlayers(s, date, rng) {
    const w = TL.windowInfo(s); if (!w.open || !TL.offerToHuman) return;
    const daysLeft = TL.daysBetween(date, w.closes);
    for (const cid of TL.humanClubIds(s)) {
      const c = s.clubs[cid];
      const open = (s.offers || []).filter(o => o.status === 'open' && s.players[o.pid] && s.players[o.pid].clubId === cid).length;
      if (open >= 3 || !rng.chance(daysLeft <= 7 ? 0.3 : 0.14)) continue;
      const squad = c.players.map(id => s.players[id]).filter(p => p && !p.loan && !p.onLoan);
      if (squad.length < 16) continue;
      const avg = squad.reduce((a, p) => a + p.ovr, 0) / squad.length;
      const cands = squad.map(p => {
        const form = p.form && p.form.length ? p.form.reduce((a, b) => a + b, 0) / p.form.length : 6.6;
        let wgt = Math.pow(Math.max(0.5, p.ovr - avg + 6), 1.5) * (1 + Math.max(0, form - 6.8)) * (p.age <= 23 && p.pot >= p.ovr + 5 ? 1.5 : 1) * (p.listed ? 2 : 1) * (p.requested ? 2.5 : 1) * (p.age >= 32 ? 0.5 : 1);
        return { p, wgt };
      });
      const pick = rng.weighted(cands, x => x.wgt).p;
      // a club that can afford him and would actually play him
      const ask = TL.askingPrice(s, pick);
      const suitors = Object.values(s.clubs).filter(b => b.id !== cid && !isHuman(s, b.id) && b.rep >= c.rep - 8 && b.finance && b.finance.transferBudget >= ask * 0.7 && b.players.length < 30 && (() => { const top = b.players.map(id => s.players[id]).filter(Boolean).sort((x, y) => y.ovr - x.ovr); return pick.ovr >= (top[10] ? top[10].ovr : 50) - 2; })());
      if (!suitors.length) continue;
      const buyer = rng.weighted(suitors, b => Math.max(1, b.rep - 50) * (b.country === c.country ? 1.3 : 1));
      TL.offerToHuman(s, buyer, pick, rng);
    }
  }

  /* =========================================================
     HOOKS
     ========================================================= */
  const prevDay = TL.dayTick;
  TL.dayTick = function (s, prev, date, rng) {
    prevDay(s, prev, date, rng);
    if (!s.staff) return;
    // youth football on Mondays (league) and Thursdays (cup)
    const dw = dowOf(date);
    for (const g of (s.youthPending || []).slice()) if (g.date < date) TL.resolveYouthPending(s, g.key, null);
    bidsForHumanPlayers(s, date, rng);
    if ((dw === 1 || dw === 4) && TL.humanClubIds(s).length) youthDay(s, date, rng);
    for (const cid of TL.humanClubIds(s)) {
      const c = s.clubs[cid];
      if (TRIAL_DATES(s).includes(date) && !c.trials) openTrials(s, c, rng);
      if (c.trials && date >= c.trials.closes) closeTrials(s, c);
    }
    if (prev.slice(0, 7) !== date.slice(0, 7)) {
      merchMonth(s);
      // monthly loan reports
      for (const cid of TL.humanClubIds(s)) {
        const loans = TL.loanedOut(s, cid); if (!loans.length) continue;
        TL.mailClub(s, cid, 'assistant', 'Monthly loan report', `How our players out on loan are doing:\n\n${loans.map(p => { const avg = p.stats.rated ? (p.stats.ratingSum / p.stats.rated).toFixed(2) : '–'; return `• ${p.name} at ${s.clubs[p.clubId].name}: ${p.stats.apps} apps, ${p.stats.goals} goals, avg ${avg}, rated ${p.ovr}`; }).join('\n')}`);
      }
    }
  };
  const prevSeasonEnd = TL.econSeasonEnd;
  TL.econSeasonEnd = function (s, rng, report) {
    prevSeasonEnd(s, rng, report);
    for (const id in s.players) { const p = s.players[id]; if (!p) continue; if (p.fromAcademy && !p.loan) returnToAcademy(s, p); if (p.youthStats) p.youthStats = { apps: 0, goals: 0 }; }
    for (const cid in s.clubs) if (s.clubs[cid].trials) closeTrials(s, s.clubs[cid]);
  };
  const prevMigrate = TL.migrate;
  TL.migrate = function (s) { const out = prevMigrate(s); if (out && out.managers) { TL.youthMatchCleanup(out); out.merch = out.merch || []; for (const m of out.managers) m.saved = m.saved || []; } return out; };
})();
