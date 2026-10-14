/* Touchline — career module: jobs and sackings, dressing room (captains, promises, transfer requests, team talks),
   press conferences, fans, monthly awards, records and hall of fame, achievements, Create-a-Club, the wonderkid
   story, the academy (U18/U21) and facility projects. No DOM access. */
(function () {
  const TL = window.TL, Rng = TL.Rng, clamp = TL.clamp;
  const mine = s => s.manager.clubId ? s.clubs[s.manager.clubId] : null;

  /* =========================================================
     JOBS
     ========================================================= */
  TL.sackManager = function (s, kind) {
    const m = s.manager;
    if (kind === 'club' && m.clubId) {
      const c = s.clubs[m.clubId];
      TL.addMail(s, 'board', 'You have been relieved of your duties', `Following a run of poor results, the board of ${c.name} has decided to end your time as manager.\n\nOpen the Jobs screen to find your next role.`, true);
      m.career.push({ season: s.season, club: c.id, sacked: true, date: s.date });
      TL.news(s, `${c.name} have sacked ${m.name}.`);
      m.rep = Math.max(0, m.rep - 8);
      m.clubId = null; m.unemployedSince = s.date;
      openVacancy(s, 'club', c.id);
    }
    if (kind === 'nation' && m.nationId) {
      const n = s.nations[m.nationId];
      TL.addMail(s, 'federation', 'The federation has dismissed you', `The ${n.name} federation has decided to make a change. Thank you for your work.`, true);
      TL.news(s, `${n.name} have dismissed ${m.name}.`);
      m.rep = Math.max(0, m.rep - 5);
      m.nationId = null;
      openVacancy(s, 'nation', n.id);
    }
  };
  TL.resign = function (s, kind) {
    const m = s.manager;
    const id = kind === 'club' ? m.clubId : m.nationId; if (!id) return;
    const t = TL.team(s, id);
    TL.news(s, `${m.name} has resigned as ${t.name} manager.`);
    if (kind === 'club') { m.career.push({ season: s.season, club: id, resigned: true, date: s.date }); m.clubId = null; if (!m.nationId) m.unemployedSince = s.date; }
    else m.nationId = null;
    openVacancy(s, kind, id);
  };
  function openVacancy(s, type, teamId) {
    if (s.vacancies.some(v => v.teamId === teamId)) return;
    s.vacancies.push({ id: s.nextId++, type, teamId, since: s.date });
  }
  TL.jobRep = (s, v) => v.type === 'club' ? s.clubs[v.teamId].rep : s.nations[v.teamId].rating;
  // Chance a club/federation accepts the manager, based on reputation.
  TL.jobChance = (s, v, m) => clamp(0.5 + (m.rep - (TL.jobRep(s, v) - 22)) / 25, 0.02, 0.97);
  TL.applyJob = function (s, vid) {
    const m = s.manager, v = s.vacancies.find(x => x.id === vid); if (!v) return 'That job has been filled.';
    if (m.applied.some(a => a.vid === vid)) return 'You have already applied.';
    m.applied.push({ vid, due: TL.addDays(s.date, 5) });
    return `Application sent to ${TL.team(s, v.teamId).name}. Expect a reply within a week.`;
  };
  function offerJob(s, i, v) {
    TL.asManager(s, i, () => {
      const t = TL.team(s, v.teamId);
      TL.addMail(s, v.type === 'club' ? 'board' : 'federation', `Job offer: ${t.name}`, `${t.name} would like you to become their ${v.type === 'club' ? 'manager' : 'national team manager'}.${v.type === 'club' && s.manager.clubId ? `\n\nAccepting means leaving ${s.clubs[s.manager.clubId].name}.` : ''}${v.type === 'nation' && s.manager.nationId ? `\n\nAccepting means leaving ${s.nations[s.manager.nationId].name}.` : ''}${v.type === 'nation' && s.manager.clubId ? '\n\nYou can manage a club and a country at the same time.' : ''}`, true);
      s.inbox[0].action = { kind: 'job', vid: v.id };
    });
  }
  TL.takeJob = function (s, vid) {
    const m = s.manager, v = s.vacancies.find(x => x.id === vid); if (!v) return 'That job is no longer available.';
    if (s.managers.some(x => x !== m && (x.clubId === v.teamId || x.nationId === v.teamId))) return 'Another manager already has that job.';
    if (v.type === 'club') {
      if (m.clubId) { TL.news(s, `${m.name} leaves ${s.clubs[m.clubId].name}.`); openVacancy(s, 'club', m.clubId); }
      m.clubId = v.teamId; m.unemployedSince = null;
      const c = s.clubs[v.teamId];
      m.board = { confidence: 60, target: TL.boardTarget(s, c.id) };
      m.ledger = []; m.payables = [];
      TL.autoLineup(s, c);
      TL.addMail(s, 'board', `Welcome to ${c.name}`, `The board welcomes you as manager of ${c.name}.\n\nObjective: ${TL.targetText(s, c.id, m.board.target)}.\nTransfer budget: ${TL.fmtM(c.finance.transferBudget)}.`, true);
    } else {
      if (m.nationId) openVacancy(s, 'nation', m.nationId);
      m.nationId = v.teamId;
      const n = s.nations[v.teamId];
      m.nboard = { confidence: 62, target: nationTarget(s, n) };
      TL.addMail(s, 'federation', `Welcome, ${n.name} manager`, `Objective: ${m.nboard.target}.\n\nName your squad before each international window from the Nation screen.`, true);
    }
    TL.news(s, `${m.name} is the new ${TL.team(s, v.teamId).name} manager.`);
    s.vacancies = s.vacancies.filter(x => x.id !== vid);
    if (m.clubId && m.nationId) unlock(s, 'dual');
    return `You are the new manager of ${TL.team(s, v.teamId).name}.`;
  };
  function nationTarget(s, n) {
    const rank = TL.ranking(s).filter(x => x.confed === n.confed).findIndex(x => x.id === n.id) + 1;
    const plan = s.intlPlan && s.intlPlan.tourneys.find(p => (TL.TOURNEYS.find(t => t.id === p.id).quotas || {})[n.confed] || (p.id === 'COPA' && ['CONMEBOL', 'CONCACAF'].includes(n.confed)) || (p.id === 'GOLD' && n.confed === 'CONCACAF'));
    const tname = plan ? plan.name : 'next major tournament';
    return rank <= 2 ? `Reach the semi-finals of the ${tname}` : rank <= 6 ? `Reach the knockout stage of the ${tname}` : `Qualify for the ${tname}`;
  }
  TL.nationTarget = nationTarget;

  /* =========================================================
     DRESSING ROOM
     ========================================================= */
  TL.pickCaptain = (s, club) => {
    const ps = club.players.map(id => s.players[id]).filter(p => p && !p.onLoan).sort((a, b) => (b.attrs.leadership * 2 + b.age / 3 + b.ovr / 10) - (a.attrs.leadership * 2 + a.age / 3 + a.ovr / 10));
    club.captain = ps[0] ? ps[0].id : null; club.vice = ps[1] ? ps[1].id : null;
  };
  // Team talks: returns a multiplier for the side's strength and a reaction line.
  TL.TALKS = { calm: 'Stay calm and play your game', motivate: 'Go out there and win this', demand: 'Anything less than a win is unacceptable', praise: 'Brilliant so far, keep it going' };
  TL.teamTalk = function (s, match, side, kind) {
    const S = match.sides[side], O = match.sides[match.other(side)];
    const diff = S.goals - O.goals, half = match.half > 1;
    const fav = (TL.squadStrength(s, S.club) - TL.squadStrength(s, O.club));
    const morale = S.xi.reduce((a, id) => a + (s.players[id] ? s.players[id].morale : 60), 0) / S.xi.length;
    let eff = 0;
    if (kind === 'calm') eff = morale < 50 || (half && diff > 0) ? 0.02 : fav < -3 ? 0.015 : -0.005;
    if (kind === 'motivate') eff = fav < 0 || (half && diff <= 0) ? 0.025 : 0.01;
    if (kind === 'demand') eff = fav > 4 && diff <= 0 ? 0.03 : morale < 45 ? -0.03 : -0.01;
    if (kind === 'praise') eff = diff > 0 ? 0.015 : -0.02;
    eff += match.rng.normal() * 0.008;
    S.talk = clamp(1 + eff, 0.96, 1.04);
    match.dirty = true;
    const react = eff > 0.015 ? 'The players look fired up.' : eff > 0 ? 'The players seem focused.' : eff > -0.015 ? 'The message has little effect.' : 'Some players look nervous after that.';
    match.say(match.minute, 'flavour', `Team talk: "${TL.TALKS[kind]}" ${react}`, side);
    return react;
  };

  /* =========================================================
     PRESS CONFERENCES
     ========================================================= */
  TL.pressConference = function (s, f) {
    const m = s.manager, teamId = (f.home === m.clubId || f.away === m.clubId) ? m.clubId : m.nationId;
    const r = TL.userResult(s, f, teamId), opp = r.opp.name;
    const qs = [];
    if (r.res === 'W') qs.push({ q: `A ${r.gf}–${r.ga} win over ${opp}. How pleased are you?`, a: [['Delighted, the players were outstanding.', { morale: 4, fans: 2 }], ['Good, but we can still improve.', { morale: 1, board: 1 }], ['We expected to win. Nothing special.', { morale: -3, rep: 1 }]] });
    else if (r.res === 'L') qs.push({ q: `A disappointing ${r.gf}–${r.ga} defeat to ${opp}. What went wrong?`, a: [['I take full responsibility.', { morale: 3, board: -1 }], ['Some players need to look at themselves.', { morale: -5, board: 1 }], ['The referee cost us today.', { fans: 3, rep: -1 }]] });
    else qs.push({ q: `A ${r.gf}–${r.ga} draw with ${opp}. A point gained or two dropped?`, a: [['A good point against a tough side.', { morale: 2 }], ['Two points dropped, we should have won.', { morale: -1, board: 1 }], ['It is a marathon, not a sprint.', { fans: 1 }]] });
    const mf = s.fixtures.find(x => x.id === f.id);
    const star = mf && mf.motm && s.players[mf.motm];
    if (star && (star.clubId === m.clubId || (m.nationId && s.nations[m.nationId].code === star.nat))) qs.push({ q: `${star.name} was man of the match. Is he the key to your team?`, a: [['He is world class and he knows it.', { player: [star.id, 6] }], ['He is one of many important players.', { morale: 1 }], ['He can still do much better.', { player: [star.id, -4] }]] });
    else if (m.clubId && TL.windowInfo(s).open) qs.push({ q: 'Will there be new signings before the window closes?', a: [['We are working on something big.', { fans: 4, board: -1 }], ['I am happy with this squad.', { morale: 3 }], ['No comment.', {}]] });
    else qs.push({ q: 'How is the mood in the dressing room?', a: [['Excellent. Everyone is pulling together.', { morale: 2 }], ['There is healthy competition for places.', { morale: 0, board: 1 }], ['Some players are not happy, and that is fine.', { morale: -3 }]] });
    return qs;
  };
  TL.pressAnswer = function (s, eff) {
    const m = s.manager, c = mine(s);
    if (eff.morale && c) for (const id of c.players) { const p = s.players[id]; p.morale = clamp(p.morale + eff.morale, 5, 100); }
    if (eff.player) { const p = s.players[eff.player[0]]; if (p) p.morale = clamp(p.morale + eff.player[1], 5, 100); }
    if (eff.board && c) m.board.confidence = clamp(m.board.confidence + eff.board, 0, 100);
    if (eff.fans && c) c.fans.mood = clamp(c.fans.mood + eff.fans, 0, 100);
    if (eff.rep) m.rep = clamp(m.rep + eff.rep, 0, 100);
  };

  /* =========================================================
     ACHIEVEMENTS
     ========================================================= */
  TL.ACHIEVEMENTS = {
    firstWin: ['First victory', 'Win your first competitive match'],
    century: ['Centurion', 'Manage 100 matches'],
    unbeaten10: ['Unbeatable', 'Go 10 league matches unbeaten'],
    giantKiller: ['Giant killer', 'Beat a club with a reputation 20 points higher'],
    league: ['Champions', 'Win a league title'],
    cup: ['Cup winners', 'Win a domestic cup'],
    double: ['The double', 'Win the league and a domestic cup in the same season'],
    europe: ['Kings of Europe', 'Win the Champions League'],
    promotion: ['Going up', 'Win promotion'],
    bigSpender: ['Big spender', 'Sign a player for £50m or more'],
    academy: ['Academy pride', 'Develop an academy graduate to 80 ability'],
    wonderkid: ['Dream come true', 'Your wonderkid reaches 85 ability'],
    worldCup: ['World champions', 'Win the World Cup'],
    continental: ['Continental champions', 'Win a continental nations tournament'],
    dual: ['Two jobs', 'Manage a club and a country at the same time'],
    createdClub: ['From nothing', 'Win promotion with a club you created']
  };
  function unlock(s, key) {
    const m = s.manager;
    if (m.achievements[key]) return;
    m.achievements[key] = s.date;
    const a = TL.ACHIEVEMENTS[key];
    TL.addMail(s, 'achievements', `Achievement unlocked: ${a[0]}`, a[1] + '.');
    s.inbox[0].read = false;
  }
  TL.unlock = unlock;

  /* =========================================================
     CREATE-A-CLUB
     ========================================================= */
  TL.BADGE_SHAPES = ['shield', 'round', 'crest', 'diamond'];
  TL.BADGE_PATTERNS = ['plain', 'stripes', 'hoops', 'sash', 'halves', 'quarters', 'chevron'];
  TL.BADGE_ICONS = ['none', 'star', 'ball', 'crown', 'lion', 'eagle', 'bolt', 'tree', 'anchor', 'castle'];
  TL.KIT_PATTERNS = ['plain', 'stripes', 'hoops', 'sash', 'halves', 'pinstripes'];
  TL.createCustomClub = function (s, def, rng) {
    const lg = s.leagueDefs.find(l => l.id === def.leagueId) || s.leagueDefs.find(l => l.id === 'ENG3');
    const existing = TL.leagueClubs(s, lg.id).sort((a, b) => a.rep - b.rep);
    const out = existing[0];
    if (out) { // the weakest club drops out of the simulated pyramid; its players become free agents
      for (const pid of out.players) { const p = s.players[pid]; p.clubId = null; p.contract = null; s.freeAgents = s.freeAgents || []; s.freeAgents.push(pid); }
      delete s.clubs[out.id];
    }
    let id = (def.short || def.name.replace(/[^A-Za-z]/g, '').slice(0, 3)).toUpperCase().slice(0, 3);
    while (s.clubs[id]) id = id.slice(0, 2) + String.fromCharCode(65 + rng.int(0, 25));
    const reps = existing.map(c => c.rep);
    const club = {
      id, name: def.name, city: def.city || def.name, stadium: def.stadium || `${def.name} Park`, cap: clamp(+def.cap || 6000, 1000, 90000), founded: s.season, rep: Math.max(30, Math.min(...reps) - 2),
      c1: def.c1 || '#1F6FEB', c2: def.c2 || '#FFFFFF', country: lg.country, leagueId: lg.id, players: [], tactics: { formation: '4-3-3', mentality: 0, press: 1, tempo: 1 }, lineup: null,
      badge: def.badge || { shape: 'shield', pattern: 'plain', icon: 'star' }, kit: def.kit || { pattern: 'plain' }, custom: true, academy: []
    };
    s.clubs[id] = club;
    const lgData = TL.DATA.leagues.find(l => l.id === lg.id);
    const mean = lgData && lgData.gen ? lgData.gen.mean - 3 : (existing.length ? existing.reduce((a, c) => a + TL.squadStrength(s, c), 0) / existing.length - 9 : 60);
    TL.fillSquad(s, club, rng, 24, mean, 4);
    for (const pid of club.players) { const p = s.players[pid]; if (p.age <= 24) p.pot = clamp(p.pot + rng.int(2, 8), p.ovr, 92); }
    s.customClubId = id;
    s.customBudget = { easy: 3, normal: 1, hard: 0.4 }[def.difficulty || 'normal'];
    return club;
  };
  TL.applyCustomBudget = function (s) {
    const c = s.clubs[s.customClubId]; if (!c || !c.finance) return;
    const e = TL.econOf(c);
    c.finance.balance = Math.round(Math.max(0.5, 25 * e.budget * 4) * s.customBudget * 10) / 10;
    TL.setBudgets(s, c, true);
  };

  /* =========================================================
     WONDERKID (create your own star)
     ========================================================= */
  TL.PLAY_STYLES = {
    Poacher: 'ST', 'Target man': 'ST', Playmaker: 'AM', 'Box-to-box': 'CM', 'Ball-winner': 'DM', Speedster: 'RW', Dribbler: 'LW',
    'Ball-playing defender': 'CB', 'Overlapping full-back': 'LB', 'Sweeper keeper': 'GK'
  };
  TL.STYLE_ATTRS = {
    Poacher: ['finishing', 'composure', 'acceleration'], 'Target man': ['heading', 'strength', 'jumping'], Playmaker: ['vision', 'passing', 'firstTouch'],
    'Box-to-box': ['stamina', 'workRate', 'passing'], 'Ball-winner': ['tackling', 'aggression', 'positioning'], Speedster: ['pace', 'acceleration', 'dribbling'],
    Dribbler: ['dribbling', 'agility', 'firstTouch'], 'Ball-playing defender': ['passing', 'composure', 'tackling'], 'Overlapping full-back': ['pace', 'crossing', 'stamina'],
    'Sweeper keeper': ['reflexes', 'kicking', 'oneOnOnes']
  };
  TL.WONDER_TIERS = { Generational: [92, 96], 'World class': [87, 91], Talented: [80, 86] };
  TL.createWonderkid = function (s, clubId, def, rng) {
    const club = s.clubs[clubId];
    const tier = TL.WONDER_TIERS[def.tier] || TL.WONDER_TIERS['World class'];
    const pos = def.pos || TL.PLAY_STYLES[def.style] || 'ST';
    const p = TL.generateYouth(s, null, rng, { nat: def.nat || club.country, pos, age: 16, ovr: rng.int(52, 56), name: def.name, pot: rng.int(tier[0], tier[1]), prefix: 'W' });
    p.clubId = clubId; p.academy = true; p.wonderkid = true; p.star = true; p.style = def.style || null; p.foot = def.foot || p.foot;
    p.hidden.professionalism = clamp(p.hidden.professionalism + 4, 10, 20); p.hidden.injuryProne = clamp(p.hidden.injuryProne, 3, 12);
    p.contract = { wage: Math.max(0.2, Math.round(TL.wageFor(p, club.rep, club) * 10) / 10), end: s.season + 3, clause: null };
    for (const k of TL.STYLE_ATTRS[p.style] || []) p.attrs[k] = clamp(p.attrs[k] + 3, 1, 20);
    p.homegrown = clubId;
    club.academy = club.academy || [];
    club.academy.push(p.id);
    p.story = { milestones: {}, homesick: p.nat !== club.country };
    TL.asManager(s, Math.max(0, TL.ownerIndex(s, clubId)), () => TL.addMail(s, 'academy', `${p.name} joins the academy`, `${p.name}, a 16-year-old ${p.pos} from ${TL.NAT_NAMES[p.nat] || p.nat}, has signed his first contract and joined the U18 squad.\n\nEveryone at the club says he could be special. Coaching, playing time, a good mentor and strong facilities will decide how far he goes.`, true));
    return p;
  };
  function wonderkidMonthly(s, rng) {
    for (const id in s.players) {
      const p = s.players[id];
      if (!p.wonderkid || !p.clubId) continue;
      const club = s.clubs[p.clubId], h = TL.ownerIndex(s, p.clubId);
      if (h < 0) continue;
      const ms = p.story.milestones;
      TL.asManager(s, h, () => {
        for (const level of [65, 70, 75, 80, 85, 90]) if (p.ovr >= level && !ms['ovr' + level]) { ms['ovr' + level] = s.date; TL.addMail(s, 'academy', `${p.name} reaches ${level}`, level >= 80 ? `${p.name} is now one of the best young players in the world. Expect the biggest clubs to come calling.` : `${p.name} keeps improving. He is now rated ${level}.`); if (level >= 85) unlock(s, 'wonderkid'); }
        if (p.stats.apps && !ms.debut) { ms.debut = s.date; TL.addMail(s, 'media', `${p.name} makes his debut`, `The academy prodigy made his first-team debut this month.`); }
        if (p.stats.goals && !ms.firstGoal) { ms.firstGoal = s.date; TL.addMail(s, 'media', `${p.name} scores his first goal`, `A first senior goal for the wonderkid. The fans are already singing his name.`); club.fans.mood = clamp(club.fans.mood + 4, 0, 100); }
        if (p.story.homesick && !ms.homesick && rng.chance(0.25)) { ms.homesick = s.date; p.morale = clamp(p.morale - 15, 5, 100); TL.addMail(s, 'assistant', `${p.name} is homesick`, `${p.name} is struggling to settle so far from home. Playing time and a good mentor will help him.`); }
        if (p.ovr >= 76 && !ms.agent && rng.chance(0.35)) { ms.agent = s.date; p.agentGreed = 0.25; TL.addMail(s, 'agent', `${p.name}'s agent wants a new deal`, `${p.name}'s agent says his client is underpaid for a player of his talent and wants a new contract. Ignore him and he may push for a move.`, true); s.inbox[0].action = { kind: 'player', id: p.id }; }
        if (ms.agent && !ms.agentResolved && p.contract && p.contract.wage >= TL.wageFor(p, club.rep, club) * 1.1) ms.agentResolved = s.date;
        if (ms.agent && !ms.agentResolved && TL.daysBetween(ms.agent, s.date) > 90 && !p.requested) { p.requested = true; p.morale = clamp(p.morale - 10, 5, 100); TL.addMail(s, 'assistant', `${p.name} hands in a transfer request`, `With no new contract offered, ${p.name} has asked to leave. Big clubs will now circle. Offer him a new contract to calm things down.`, true); s.inbox[0].action = { kind: 'player', id: p.id }; }
        if (p.ovr >= 79 && TL.windowInfo(s).open && rng.chance(0.4)) {
          const big = Object.values(s.clubs).filter(c => c.rep >= 85 && !TL.isHumanTeam(s, c.id) && c.id !== club.id);
          if (big.length && !s.offers.some(o => o.pid === p.id && o.status === 'open')) {
            const buyer = rng.pick(big);
            const fee = TL.roundFee(TL.askingPrice(s, p) * rng.range(1.0, 1.5));
            const o = { id: s.nextId++, pid: p.id, club: buyer.id, fee, max: TL.roundFee(fee * 1.3), status: 'open', date: s.date };
            s.offers.push(o);
            TL.addMail(s, 'transfers', `${buyer.name} bid ${TL.fmtM(fee)} for ${p.name}`, `${buyer.name} want your wonderkid. Sell and cash in, or keep him and build around him? If you keep him, expect him and his agent to want a contract that reflects his status.`, true);
            s.inbox[0].action = { kind: 'offer', id: o.id };
            TL.news(s, `Rumour: ${buyer.name} have bid ${TL.fmtM(fee)} for ${p.name}.`, { pid: p.id, club: buyer.id, kind: 'rumour' });
          }
        }
      });
    }
  }

  /* =========================================================
     ACADEMY
     ========================================================= */
  TL.youthIntake = function (s, club, rng) {
    const human = TL.isHumanTeam(s, club.id);
    const fac = club.facilities ? club.facilities.youth : 8, yc = TL.staffRating(s, club.id, 'youthCoach');
    const n = human ? clamp(3 + Math.round(fac / 5) + rng.int(0, 2), 3, 8) : rng.int(0, 2);
    const out = [];
    for (let i = 0; i < n; i++) {
      const boost = Math.round((fac - 8) / 2 + (yc - 8) / 3);
      const p = TL.generateYouth(s, human ? null : club.id, rng, { age: rng.int(15, 17), boost });
      p.pot = clamp(p.ovr + rng.int(8, 24) + Math.round((fac + yc) / 6) + (rng.chance(0.05 + fac / 400) ? rng.int(5, 12) : 0), p.ovr + 5, 95);
      p.homegrown = club.id;
      if (human) { p.clubId = club.id; p.academy = true; p.contract = { wage: Math.max(0.1, Math.round(TL.wageFor(p, club.rep, club) * 3) / 10), end: s.season + 3, clause: null }; club.academy = club.academy || []; club.academy.push(p.id); }
      out.push(p);
    }
    return out;
  };
  TL.promoteYouth = (s, pid) => {
    const p = s.players[pid], c = s.clubs[p.clubId];
    c.academy = c.academy.filter(x => x !== pid); c.players.push(pid); p.academy = false;
    p.contract = { wage: Math.max(p.contract ? p.contract.wage : 0.5, TL.wageFor(p, c.rep, c)), end: s.season + 3, clause: null };
    p.hist = p.hist && p.hist.length ? p.hist : [[s.date, p.ovr]];
  };
  TL.releaseYouth = (s, pid) => { const p = s.players[pid], c = s.clubs[p.clubId]; c.academy = c.academy.filter(x => x !== pid); p.academy = false; p.clubId = null; p.contract = null; s.freeAgents.push(pid); };
  function youthWeek(s, club, rng) {
    if (!club.academy || !club.academy.length) return;
    // academy development
    for (const id of club.academy) {
      const p = s.players[id]; if (!p) continue;
      const g = TL.weeklyGrowthRate(s, club, p);
      if (g > 0) { p.prog = (p.prog || 0) + g * (0.8 + rng.next() * 0.4); if (p.prog >= 1) { p.prog -= 1; TL.improvePlayer(p, 1, rng, TL.attrBias ? TL.attrBias(s, club, p) : null); } }
      if (!p.onLoan) p.cond = 100;
    }
    // U18 friendlies (abstract). The U21s play in a proper league and cup (see extras.js).
    club.youthResults = club.youthResults || [];
    const others = TL.leagueClubs(s, club.leagueId).filter(c => c.id !== club.id);
    for (const team of ['U18']) {
      const squad = club.academy.map(id => s.players[id]).filter(p => p && !p.onLoan && p.age <= 18);
      if (squad.length < 3 || !others.length) continue;
      const opp = rng.pick(others);
      const avg = squad.reduce((a, p) => a + p.ovr, 0) / squad.length;
      const gf = Math.max(0, Math.round(rng.normal() * 1.1 + 1.4 + (avg - 55) / 12)), ga = Math.max(0, Math.round(rng.normal() * 1.1 + 1.3));
      for (let g = 0; g < gf; g++) { const sc = rng.weighted(squad, p => ({ ST: 3, LW: 2, RW: 2, AM: 1.5, CM: 0.8 })[p.pos] || 0.3); sc.youthStats = sc.youthStats || { apps: 0, goals: 0 }; sc.youthStats.goals++; }
      for (const p of squad) { p.youthStats = p.youthStats || { apps: 0, goals: 0 }; p.youthStats.apps++; }
      club.youthResults.unshift({ date: s.date, team, opp: opp.name, gf, ga });
    }
    club.youthResults = club.youthResults.slice(0, 12);
  }

  /* =========================================================
     FACILITIES & STADIUM PROJECTS
     ========================================================= */
  TL.PROJECTS = {
    training: { name: 'Training ground upgrade', days: 150, effect: 'Training facilities +2 (faster development)' },
    youth: { name: 'Youth academy upgrade', days: 150, effect: 'Academy facilities +2 (better intakes and youth growth)' },
    stadium: { name: 'Stadium expansion', days: 270, effect: 'Capacity +15% (more matchday income)' }
  };
  TL.projectCost = (s, c, type) => {
    const e = TL.econOf(c), scale = Math.max(0.03, e.budget);
    if (type === 'stadium') return Math.round(c.cap * 0.15 * 0.004 * Math.max(0.1, e.ticket) * 10) / 10 + 2 * scale;
    const lvl = type === 'training' ? c.facilities.training : c.facilities.youth;
    return Math.round((4 + lvl * 1.6) * scale * 10) / 10;
  };
  TL.startProject = (s, type) => {
    const c = mine(s); c.projects = c.projects || [];
    if (c.projects.some(p => p.type === type)) return 'That project is already under way.';
    if (type !== 'stadium' && (type === 'training' ? c.facilities.training : c.facilities.youth) >= 20) return 'Those facilities are already the best they can be.';
    const cost = TL.projectCost(s, c, type);
    if (c.finance.balance < cost) return `The board won't approve it: the project costs ${TL.fmtM(cost)} and the bank balance is ${TL.fmtM(c.finance.balance)}.`;
    TL.book(s, 'exp', 'facilities', cost);
    c.projects.push({ type, start: s.date, end: TL.addDays(s.date, TL.PROJECTS[type].days), cost });
    return `${TL.PROJECTS[type].name} approved. Work finishes around ${TL.fmtDate(TL.addDays(s.date, TL.PROJECTS[type].days), true)}.`;
  };
  function projectsTick(s, rng) {
    s.managers.forEach((m, i) => TL.asManager(s, i, () => {
      const c = mine(s); if (!c || !c.projects) return;
      for (const p of c.projects.slice()) {
        if (!p.delayed && rng.chance(0.004)) { p.delayed = true; p.end = TL.addDays(p.end, 30); TL.addMail(s, 'board', `${TL.PROJECTS[p.type].name} delayed`, 'Construction problems mean the work will take about a month longer than planned.'); }
        if (s.date >= p.end) {
          const def = TL.PROJECTS[p.type];
          if (def && def.apply) def.apply(c, s);
          else if (p.type === 'training') c.facilities.training = Math.min(20, c.facilities.training + 2);
          else if (p.type === 'youth') c.facilities.youth = Math.min(20, c.facilities.youth + 2);
          else if (p.type === 'stadium') c.cap = Math.round(c.cap * 1.15);
          c.projects = c.projects.filter(x => x !== p);
          TL.addMail(s, 'board', `${TL.PROJECTS[p.type].name} complete`, TL.PROJECTS[p.type].effect + '.', true);
        }
      }
    }));
  }

  /* =========================================================
     DAILY & MATCH HOOKS
     ========================================================= */
  TL.careerDayTick = function (s, prev, date, rng) {
    if (!s.managers) return;
    const newMonth = prev.slice(0, 7) !== date.slice(0, 7);
    // job applications answered
    s.managers.forEach((m, i) => {
      for (const a of m.applied.filter(a => a.due <= date)) {
        const v = s.vacancies.find(x => x.id === a.vid);
        if (v && new Rng(parseInt(TL.checksum(m.id + a.vid), 16)).next() < TL.jobChance(s, v, m)) offerJob(s, i, v);
        else if (v) TL.asManager(s, i, () => TL.addMail(s, v.type === 'club' ? 'board' : 'federation', `${TL.team(s, v.teamId).name}: application unsuccessful`, 'Thank you for your interest. We have decided to look elsewhere.'));
      }
      m.applied = m.applied.filter(a => a.due > date);
    });
    if (new Date(date + 'T12:00:00Z').getUTCDay() === 1) {
      for (const cid of TL.humanClubIds(s)) youthWeek(s, s.clubs[cid], rng);
      projectsTick(s, rng);
      // AI vacancies fill after three weeks
      s.vacancies = s.vacancies.filter(v => TL.daysBetween(v.since, date) < 21 || s.managers.some(m => m.applied.some(a => a.vid === v.id)));
      // keep a few jobs on the market while someone is out of work
      if (s.managers.some(m => !m.clubId) && s.vacancies.filter(v => v.type === 'club').length < 3) {
        const pool = Object.values(s.clubs).filter(c => !TL.isHumanTeam(s, c.id) && !s.vacancies.some(v => v.teamId === c.id) && c.rep < Math.max(60, s.manager.rep + 25));
        if (pool.length) openVacancy(s, 'club', rng.pick(pool).id);
      }
      if (s.managers.some(m => !m.nationId) && s.vacancies.filter(v => v.type === 'nation').length < 2) {
        const pool = Object.values(s.nations).filter(n => !TL.isHumanTeam(s, n.id) && !s.vacancies.some(v => v.teamId === n.id) && !TL.BANNED_NATIONS.includes(n.code));
        if (pool.length) openVacancy(s, 'nation', rng.pick(pool).id);
      }
    }
    if (newMonth) {
      monthlyAwards(s, prev.slice(0, 7));
      wonderkidMonthly(s, rng);
      // unsolicited offers for unemployed or highly rated managers
      s.managers.forEach((m, i) => {
        const pool = s.vacancies.filter(v => (v.type === 'club' ? !m.clubId || TL.jobRep(s, v) > s.clubs[m.clubId].rep + 6 : !m.nationId) && TL.jobChance(s, v, m) > 0.55);
        if (pool.length && rng.chance(m.clubId ? 0.25 : 0.6)) offerJob(s, i, rng.pick(pool));
      });
      // fan protests
      s.managers.forEach((m, i) => { const c = m.clubId && s.clubs[m.clubId]; if (c && c.fans.mood < 25 && rng.chance(0.5)) TL.asManager(s, i, () => { m.board.confidence = clamp(m.board.confidence - 3, 0, 100); TL.addMail(s, 'media', 'Fans protest outside the stadium', `Hundreds of ${c.name} supporters gathered before the last home game to protest about recent performances. The board has noticed.`, true); }); });
    }
  };

  function monthlyAwards(s, month) {
    for (const lg of s.leagueDefs) {
      const fx = s.fixtures.filter(f => f.comp === lg.id && f.played && f.date.slice(0, 7) === month);
      if (fx.length < lg.size) continue;
      const score = {};
      for (const f of fx) { for (const g of f.scorers || []) if (g.id) score[g.id] = (score[g.id] || 0) + 2; if (f.motm) score[f.motm] = (score[f.motm] || 0) + 3; }
      const best = Object.keys(score).filter(id => s.players[id]).sort((a, b) => score[b] - score[a])[0];
      const pts = {};
      for (const f of fx) { const h = f.hg > f.ag ? 3 : f.hg === f.ag ? 1 : 0, a = f.ag > f.hg ? 3 : f.hg === f.ag ? 1 : 0; pts[f.home] = (pts[f.home] || 0) + h; pts[f.away] = (pts[f.away] || 0) + a; }
      const motm = Object.keys(pts).sort((a, b) => pts[b] - pts[a])[0];
      const label = new Date(month + '-15T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
      if (best) { const p = s.players[best]; s.awards.push({ season: s.season, name: `${lg.name} Player of the Month (${label})`, player: best, winner: p.clubId }); TL.news(s, `${p.name} (${TL.team(s, p.clubId) ? TL.team(s, p.clubId).name : ''}) is the ${lg.name} Player of the Month for ${label}.`, { pid: best, club: p.clubId, kind: 'award' }); if (p.clubId) TL.mailClub(s, p.clubId, 'league', `${p.name}: Player of the Month`, `${p.name} has been named ${lg.name} Player of the Month for ${label}.`); }
      if (motm) { s.awards.push({ season: s.season, name: `${lg.name} Manager of the Month (${label})`, winner: motm }); const i = TL.ownerIndex(s, motm); if (i >= 0) TL.asManager(s, i, () => { s.manager.rep = Math.min(100, s.manager.rep + 1); TL.addMail(s, 'league', 'Manager of the Month!', `You are the ${lg.name} Manager of the Month for ${label} after taking ${pts[motm]} points.`); }); }
    }
  }

  TL.careerAfterDay = function (s, played, rng) {
    for (const f of played) {
      if (f.kind === 'intl') continue;
      for (const [id, gf, ga] of [[f.home, f.hg, f.ag], [f.away, f.ag, f.hg]]) {
        const c = s.clubs[id]; if (!c || !c.fans) continue;
        const res = f.winner ? (f.winner === id ? 1 : -1) : gf > ga ? 1 : gf < ga ? -1 : 0;
        c.fans.mood = clamp(c.fans.mood + (res > 0 ? 2.5 : res < 0 ? -3 : 0) + (c.ticketPrice > TL.basePrice(c) * 1.25 ? -0.5 : 0), 0, 100);
      }
    }
    s.managers.forEach((m, i) => TL.asManager(s, i, () => {
      const total = m.wins + m.draws + m.losses + m.nrec.w + m.nrec.d + m.nrec.l;
      if (m.wins + m.nrec.w >= 1) unlock(s, 'firstWin');
      if (total >= 100) unlock(s, 'century');
      const c = mine(s); if (!c) return;
      for (const f of played.filter(f => f.home === c.id || f.away === c.id)) {
        const r = TL.userResult(s, f, c.id);
        if (r.res === 'W' && s.clubs[r.opp.id] && s.clubs[r.opp.id].rep >= c.rep + 20) unlock(s, 'giantKiller');
        // records
        const rec = s.records[c.id] = s.records[c.id] || { bigWin: null, bigLoss: null, attendance: null, apps: {} };
        const margin = r.gf - r.ga;
        if (margin > 0 && (!rec.bigWin || margin > rec.bigWin.m)) rec.bigWin = { m: margin, score: `${r.gf}–${r.ga}`, opp: r.opp.name, season: s.season };
        if (margin < 0 && (!rec.bigLoss || -margin > rec.bigLoss.m)) rec.bigLoss = { m: -margin, score: `${r.gf}–${r.ga}`, opp: r.opp.name, season: s.season };
        if (f.home === c.id && f.att && (!rec.attendance || f.att > rec.attendance.n)) rec.attendance = { n: f.att, opp: r.opp.name, season: s.season };
        // unbeaten league run
        if (f.comp === c.leagueId) { m.unbeaten = r.res === 'L' ? 0 : (m.unbeaten || 0) + 1; if (m.unbeaten >= 10) unlock(s, 'unbeaten10'); }
        // promises: Star / First team players expect to start
        for (const id of c.players) {
          const p = s.players[id];
          if (p.role == null || p.role > 1 || !TL.available(p)) continue;
          const started = p.stats.starts > (p._starts || 0);
          p._starts = p.stats.starts;
          p.benchRun = started ? 0 : (p.benchRun || 0) + 1;
          if (p.benchRun === 4) { p.morale = clamp(p.morale - 8, 5, 100); TL.addMail(s, 'assistant', `${p.name} is unhappy`, `${p.name} was promised a ${TL.CONTRACT_ROLES[p.role].toLowerCase()} role but hasn't started for four matches.`); }
          if (p.benchRun === 7 && !p.requested) { p.requested = true; TL.addMail(s, 'assistant', `${p.name} hands in a transfer request`, `${p.name} feels the club has broken its promise of playing time and wants to leave. Start him regularly, or sell him while his value is high.`, true); s.inbox[0].action = { kind: 'player', id: p.id }; }
          if (p.requested && p.benchRun === 0 && p.stats.starts % 5 === 0) { p.requested = false; TL.addMail(s, 'assistant', `${p.name} withdraws his request`, `Regular football has changed his mind. ${p.name} is happy again.`); }
        }
        // captain steadies the dressing room after defeats
        if (r.res === 'L' && c.captain && s.players[c.captain] && s.players[c.captain].attrs.leadership >= 14) for (const id of c.players) s.players[id].morale = clamp(s.players[id].morale + 2, 5, 100);
      }
      // academy graduate milestone
      for (const id of c.players) { const p = s.players[id]; if (p.homegrown === c.id && p.ovr >= 80 && !p.wonderkid) unlock(s, 'academy'); }
    }));
    // AI clubs sack managers when far below expectation (creates vacancies)
    if (played.some(f => s.comps[f.comp] && s.comps[f.comp].type === 'league')) {
      for (const lg of s.leagueDefs) {
        const games = s.fixtures.filter(f => f.comp === lg.id && f.played).length / (lg.size / 2);
        if (games < 10) continue;
        for (const r of TL.table(s, lg.id)) {
          if (TL.isHumanTeam(s, r.id) || s.vacancies.some(v => v.teamId === r.id)) continue;
          if (r.pos >= (s.expected[r.id] || 10) + 7 && rng.chance(0.02)) { openVacancy(s, 'club', r.id); TL.news(s, `${s.clubs[r.id].name} have sacked their manager after a poor run.`); }
        }
      }
    }
  };

  // Archive club appearance totals for the hall of fame before stats reset (called from the season loop).
  TL.archivePlayerSeason = (s, p) => {
    if (!p.clubId || !TL.isHumanTeam(s, p.clubId) || !p.stats.apps) return;
    const rec = s.records[p.clubId] = s.records[p.clubId] || { apps: {} };
    rec.apps = rec.apps || {};
    const a = rec.apps[p.id] = rec.apps[p.id] || { name: p.name, apps: 0, goals: 0 };
    a.apps += p.stats.apps; a.goals += p.stats.goals;
  };

  TL.careerSeasonEnd = function (s, rng, report) {
    s.managers.forEach((m, i) => TL.asManager(s, i, () => {
      const won = m.trophies.filter(t => t.season === s.season);
      if (won.some(t => s.leagueDefs.some(l => l.name === t.name))) unlock(s, 'league');
      const cupNames = Object.values(TL.CUPS).map(c => c.name);
      if (won.some(t => cupNames.includes(t.name))) unlock(s, 'cup');
      if (won.some(t => s.leagueDefs.some(l => l.name === t.name)) && won.some(t => cupNames.includes(t.name))) unlock(s, 'double');
      if (won.some(t => t.name === 'Champions League')) unlock(s, 'europe');
      if (won.some(t => /^Promotion/.test(t.name))) { unlock(s, 'promotion'); if (m.clubId && s.clubs[m.clubId] && s.clubs[m.clubId].custom) unlock(s, 'createdClub'); }
      if (won.some(t => /World Cup/.test(t.name))) unlock(s, 'worldCup');
      if (won.some(t => /European Championship|Copa América|Africa Cup|Asian Cup|Gold Cup/.test(t.name))) unlock(s, 'continental');
    }));
    for (const cid in s.clubs) {
      const c = s.clubs[cid];
      if (c.fans) c.fans.mood = clamp(60 + (c.fans.mood - 60) * 0.5, 0, 100);
      // academy graduates over 21 must move up or out
      if (c.academy) for (const id of c.academy.slice()) { const p = s.players[id]; if (!p) { c.academy = c.academy.filter(x => x !== id); continue; } if (p.age >= 22) TL.promoteYouth(s, id); }
      if (!TL.isHumanTeam(s, cid)) TL.pickCaptain(s, c);
    }
    // Team of the season per league
    for (const lg of s.leagueDefs) s.history.push({ season: s.season, comp: lg.id, totS: TL.teamOfSeason(s, lg.id) });
  };
  TL.teamOfSeason = function (s, leagueId) {
    const ps = Object.values(s.players).filter(p => p.clubId && s.clubs[p.clubId] && s.clubs[p.clubId].leagueId === leagueId && p.stats.apps >= 12);
    const avg = p => p.stats.ratingSum / Math.max(1, p.stats.rated);
    const slots = TL.FORMATIONS['4-3-3'], used = new Set(), xi = [];
    for (const [pos] of slots) {
      const best = ps.filter(p => !used.has(p.id) && TL.familiarity(p.pos, pos) >= 0.9).sort((a, b) => avg(b) - avg(a))[0];
      if (best) { used.add(best.id); xi.push({ id: best.id, name: best.name, pos, club: best.clubId, avg: +avg(best).toFixed(2) }); }
    }
    return xi;
  };
})();
