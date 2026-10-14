/* Touchline — post-match press conferences. A large bank of questions chosen from what actually happened
   (red cards, penalties, injuries, comebacks, late goals, hat-tricks, debuts, form, league position,
   job pressure, derbies, transfers, contracts, fans...). Recently asked questions are avoided, every
   question has several wordings, and the papers print a headline based on your answers. No DOM access. */
(function () {
  const TL = window.TL, clamp = TL.clamp, Rng = TL.Rng;
  const OUTLETS = {
    ENG: ['Sky Sports', 'BBC Sport', 'The Athletic', 'The Guardian', 'Daily Mail', 'The Times', 'talkSPORT'],
    ESP: ['Marca', 'AS', 'Mundo Deportivo', 'Sport'], ITA: ['La Gazzetta dello Sport', 'Corriere dello Sport', 'Tuttosport'],
    GER: ['Kicker', 'Bild', 'Sport1'], FRA: ["L'Équipe", 'RMC Sport', 'Le Parisien'],
    NGA: ['Complete Sports', 'Punch', 'Brila FM', 'SuperSport'], X: ['ESPN', 'Reuters', 'AFP', 'The Athletic']
  };
  const FIRST = ['James', 'Sarah', 'Tom', 'Laura', 'Dave', 'Marco', 'Elena', 'Kofi', 'Ngozi', 'Pierre', 'Sofia', 'Jon', 'Amaka', 'Lukas', 'Ruth'];
  const LAST = ['Reed', 'Okafor', 'Bianchi', 'Moreau', 'Walsh', 'Schmidt', 'García', 'Hughes', 'Adeyemi', 'Rossi', 'Martin', 'Brennan', 'Eze', 'Klein'];

  /* ---------- What happened? ---------- */
  function context(s, f, teamId, match) {
    const m = s.manager, team = TL.team(s, teamId), r = TL.userResult(s, f, teamId);
    const side = f.home === teamId ? 'home' : 'away', other = side === 'home' ? 'away' : 'home';
    const comp = s.comps[f.comp] || { type: 'friendly', name: '' };
    const P = id => s.players[id];
    const ev = match ? match.events : [];
    // goal timeline: comeback / blown lead / late decisive goals
    let gh = 0, ga = 0, trailed = false, led = false, lateFor = false, lateAgainst = false;
    for (const e of ev) if (e.type === 'goal') {
      const mine = e.side === side; if (mine) gh++; else ga++;
      const min = parseInt(e.disp, 10) || 0;
      if (gh < ga) trailed = true; if (gh > ga) led = true;
      if (min >= 85 && mine && gh >= ga && gh - ga <= 1) lateFor = true;
      if (min >= 85 && !mine && ga >= gh && ga - gh <= 1) lateAgainst = true;
    }
    const ps = match ? Object.values(match.ps).filter(x => x.side === side) : [];
    const opsAll = match ? Object.values(match.ps).filter(x => x.side === other) : [];
    const red = ps.find(x => x.red), oppRed = opsAll.some(x => x.red);
    const injured = ps.find(x => x.injured);
    const penFor = ev.some(e => e.type === 'pen' && e.side === side), penAgainst = ev.some(e => e.type === 'pen' && e.side === other);
    const hat = ps.find(x => x.goals >= 3);
    const young = ps.filter(x => x.goals && P(x.id) && P(x.id).age <= 20).map(x => x.id)[0];
    const debut = !team.isNation && ps.find(x => P(x.id) && P(x.id).stats.apps === 1 && P(x.id).age <= 24);
    const keeper = ps.find(x => P(x.id) && P(x.id).pos === 'GK');
    const motm = f.motm && ps.some(x => x.id === f.motm) ? f.motm : null;
    const worst = ps.filter(x => x.starter).sort((a, b) => a.rating - b.rating)[0];
    const xgFor = f.stats ? f.stats[side].xg : 0, xgAg = f.stats ? f.stats[other].xg : 0;
    const fav = (team.isNation ? (TL.nationStrength ? TL.nationStrength(s, team) : 70) : TL.squadStrength(s, team)) - (r.opp.isNation ? (TL.nationStrength ? TL.nationStrength(s, r.opp) : 70) : TL.squadStrength(s, r.opp));
    let lg = null, form = [];
    if (!team.isNation && team.leagueId && s.comps[team.leagueId]) {
      const tbl = TL.table(s, team.leagueId), row = tbl.find(x => x.id === teamId);
      if (row) { lg = { pos: row.pos, size: tbl.length, played: row.p, pts: row.pts, gap: tbl[0].pts - row.pts, def: TL.leagueDef(s, team.leagueId) }; form = row.form; }
    }
    const next = TL.nextFixtureFor(s, teamId);
    const nextOpp = next ? TL.team(s, next.home === teamId ? next.away : next.home) : null;
    const derby = !team.isNation && !r.opp.isNation && team.city && team.city === r.opp.city;
    const nextBig = nextOpp && !nextOpp.isNation && !team.isNation && nextOpp.rep >= team.rep + 3;
    const unsettled = !team.isNation ? team.players.map(P).filter(p => p && p.requested).sort((a, b) => b.ovr - a.ovr)[0] : null;
    const expiring = !team.isNation ? team.players.map(P).filter(p => p && p.contract && p.contract.end <= s.season && p.ovr >= TL.squadStrength(s, team)).sort((a, b) => b.ovr - a.ovr)[0] : null;
    const wonder = !team.isNation ? team.players.concat(team.academy || []).map(P).find(p => p && p.wonderkid) : null;
    const cap = !team.isNation && team.captain ? P(team.captain) : null;
    return {
      s, f, m, team, r, side, comp, fav, weaker: fav >= 3, stronger: fav <= -3, margin: r.gf - r.ga, res: r.res, opp: r.opp,
      trailed: trailed && r.res !== 'L', blew: led && r.res !== 'W', lateFor: lateFor && r.res === 'W', lateAgainst: lateAgainst && r.res !== 'W',
      red: red && P(red.id), oppRed, injured: injured && P(injured.id), injuredDays: injured && injured.injured ? injured.injured.days : 0, penFor, penAgainst,
      hat: hat && P(hat.id), young: young && P(young), debut: debut && P(debut.id), saves: keeper ? keeper.saves : 0, keeper: keeper && P(keeper.id),
      motm: motm && P(motm), worst: worst && worst.rating < 6.2 && P(worst.id), xgFor, xgAg, cleanSheet: r.ga === 0, lg, form,
      wins5: form.filter(x => x === 'W').length, losses5: form.filter(x => x === 'L').length,
      next, nextOpp, nextBig, derby, unsettled, expiring, wonder, cap, conf: team.isNation ? m.nboard.confidence : m.board.confidence,
      fans: team.fans ? team.fans.mood : 60, window: !team.isNation && TL.windowInfo(s).open, ko: f.ko, stage: f.stage, isNation: !!team.isNation
    };
  }

  /* ---------- Question bank ---------- */
  // Each entry: id, kind ('result' or 'topic'), weight, when(c), q(c) → array of wordings, a(c) → [[answer, effects, tag]]
  const n = p => p ? p.name : '';
  const sc = c => `${c.r.gf}–${c.r.ga}`;
  const BANK = [
    // ----- results -----
    { id: 'win', kind: 'result', when: c => c.res === 'W' && c.margin < 3, q: c => [`A ${sc(c)} win over ${c.opp.name}. How pleased are you?`, `Three points against ${c.opp.name}. What made the difference?`, `A good afternoon's work. Was that the performance you wanted?`],
      a: c => [['The players were outstanding from start to finish.', { morale: 4, fans: 2 }, 'praise'], ['A good result, but we can improve a lot.', { morale: 1, board: 1 }, 'demanding'], ['That is what we expect. Nothing special.', { morale: -2, rep: 1 }, 'arrogant'], [`Credit to ${c.opp.name}. They made it really hard.`, { rep: 1 }, 'humble']] },
    { id: 'bigwin', kind: 'result', when: c => c.res === 'W' && c.margin >= 3, q: c => [`${sc(c)}! Is that the best your team has played this season?`, `A statement win. Should the rest of the league be worried?`, `That was a thrashing. Did even you expect that?`],
      a: c => [['Yes. When we play like that, nobody can live with us.', { morale: 5, fans: 4, rep: -1 }, 'bold'], ['It is just three points. We stay humble.', { morale: 2, board: 1 }, 'humble'], ['Enjoy it tonight. Tomorrow we work again.', { morale: 3 }, 'calm'], [`${c.opp.name} were poor today, to be honest.`, { morale: 1, rep: -1 }, 'arrogant']] },
    { id: 'draw', kind: 'result', when: c => c.res === 'D', q: c => [`A ${sc(c)} draw with ${c.opp.name}. A point gained or two dropped?`, `Honours even. Are you satisfied?`, `You'll be leaving with a point. Fair result?`],
      a: c => [[c.stronger ? 'A good point against a top side.' : 'A point gained. We stay unbeaten.', { morale: 2 }, 'positive'], ['Two points dropped. We should have won.', { morale: -1, board: 1 }, 'demanding'], ['It is a marathon, not a sprint.', { fans: 1 }, 'calm'], ['The pitch and the conditions did not help either side.', { rep: -1 }, 'excuse']] },
    { id: 'loss', kind: 'result', when: c => c.res === 'L' && c.margin > -3, q: c => [`A ${sc(c)} defeat to ${c.opp.name}. What went wrong?`, `A disappointing result. How do you explain it?`, `Your side never really got going. Why?`],
      a: c => [['I take full responsibility.', { morale: 3, board: -1 }, 'humble'], ['Some players need to look at themselves.', { morale: -5, board: 1 }, 'blast'], ['We were unlucky. On another day we win that.', { morale: 1, rep: -1 }, 'excuse'], [`${c.opp.name} were better. We have to accept that.`, { rep: 1 }, 'honest']] },
    { id: 'thrashed', kind: 'result', when: c => c.res === 'L' && c.margin <= -3, q: c => [`That was a humiliation. Do you owe the fans an apology?`, `${sc(c)}. Is this the lowest point of your time in charge?`],
      a: c => [['Yes. I apologise to every supporter. That was not acceptable.', { fans: 3, morale: -1, board: 1 }, 'apology'], ['I am not blaming the players. This is on me.', { morale: 3, board: -2 }, 'humble'], ['Ask me after the next game.', { rep: -1 }, 'deflect'], ['Some of them did not deserve the shirt today.', { morale: -6, fans: 2 }, 'blast']] },
    { id: 'comeback', kind: 'result', weight: 3, when: c => c.trailed, q: c => [`You came from behind today. What did you say at half-time?`, `What a reaction from your team. Where does that spirit come from?`],
      a: c => [['I told them the truth. They responded like men.', { morale: 4 }, 'praise'], ['I did not need to say much. This group has character.', { morale: 5, fans: 2 }, 'praise'], ['A tactical change made the difference.', { rep: 2 }, 'tactical'], ['We should never have been behind in the first place.', { morale: -2, board: 1 }, 'demanding']] },
    { id: 'blew', kind: 'result', weight: 3, when: c => c.blew, q: c => [`You were ahead and let it slip. What happened?`, `Another lead thrown away. Is it a mentality problem?`],
      a: c => [['We stopped playing. That is on all of us.', { morale: 1 }, 'honest'], ['Concentration. We will work on it all week.', { board: 1 }, 'calm'], ['Some players switched off. They know who they are.', { morale: -4 }, 'blast'], ['It is not a mentality problem. Just a bad moment.', { morale: 2 }, 'defend']] },
    { id: 'latewin', kind: 'result', weight: 3, when: c => c.lateFor, q: c => [`A late winner! Did you believe until the very end?`, `That last-minute goal sent the fans wild. Your feelings?`],
      a: c => [['Always. This team never gives up.', { morale: 4, fans: 3 }, 'praise'], ['I was nervous, I am not going to lie.', { fans: 2, rep: 1 }, 'honest'], ['We should have killed the game much earlier.', { morale: -1, board: 1 }, 'demanding']] },
    { id: 'lateloss', kind: 'result', weight: 3, when: c => c.lateAgainst, q: c => [`Conceding so late must hurt. How do you pick the players up?`, `A sucker punch at the death. Was it a lack of concentration?`],
      a: c => [['It hurts, but we stick together.', { morale: 3 }, 'positive'], ['It was a lack of concentration, simple as that.', { morale: -2, board: 1 }, 'demanding'], ['Football can be cruel sometimes.', {}, 'calm']] },
    // ----- incidents -----
    { id: 'red', weight: 4, when: c => c.red, q: c => [`${n(c.red)} was sent off. Was it the right decision?`, `The red card for ${n(c.red)} changed the game. Your view?`],
      a: c => [[`Yes. ${n(c.red)} let the team down.`, { player: [c.red.id, -7] }, 'blastPlayer'], ['It looked harsh, but we accept it.', {}, 'calm'], ['The referee got it badly wrong. Again.', { fans: 3, fine: 1 }, 'ref'], ['I will speak to him privately.', { player: [c.red.id, 2] }, 'protect']] },
    { id: 'oppred', weight: 2, when: c => c.oppRed, q: c => [`${c.opp.name} finished with ten men. Did that decide it?`],
      a: c => [['It helped, of course, but we were the better side.', { morale: 1 }, 'confident'], ['The decision was correct. We used the extra man well.', { rep: 1 }, 'calm'], ['We should have punished them even more.', { morale: -1 }, 'demanding']] },
    { id: 'penagainst', weight: 3, when: c => c.penAgainst, q: c => [`What did you make of the penalty awarded against you?`, `Was there enough contact for that penalty?`],
      a: c => [['Never a penalty. VAR should have overturned it.', { fans: 3, fine: 1 }, 'ref'], ['I have not seen it again yet.', {}, 'deflect'], ['Clear penalty. We were naive.', { rep: 1, morale: -1 }, 'honest']] },
    { id: 'penfor', weight: 2, when: c => c.penFor, q: c => [`${c.opp.name} were furious about the penalty. Was it a clear one?`],
      a: c => [['A clear penalty. They should look at themselves.', { fans: 2 }, 'confident'], ['Maybe soft, but these things even out over a season.', { rep: 1 }, 'honest'], ['I was too far away to judge.', {}, 'deflect']] },
    { id: 'injury', weight: 4, when: c => c.injured, q: c => [`${n(c.injured)} went off injured. How serious is it?`, `Any news on ${n(c.injured)}?`],
      a: c => [['Too early to say. The medical team will assess him.', {}, 'calm'], [c.injuredDays > 20 ? 'It does not look good, I am afraid.' : 'Hopefully just a knock.', { morale: -1 }, 'honest'], ['He is tough. He will be back stronger.', { player: [c.injured.id, 4] }, 'protect']] },
    { id: 'hat', weight: 5, when: c => c.hat, q: c => [`A hat-trick for ${n(c.hat)}! Is he the best striker in the league?`, `${n(c.hat)} took the match ball home. How good can he be?`],
      a: c => [['For me he is the best. No question.', { player: [c.hat.id, 7], fans: 2 }, 'praisePlayer'], ['He is in great form. Let us keep him grounded.', { player: [c.hat.id, 3] }, 'calm'], ['The whole team created those chances.', { morale: 2 }, 'team']] },
    { id: 'motm', weight: 2, when: c => c.motm && !c.hat, q: c => [`${n(c.motm)} was outstanding today. Where does he rank in your squad?`, `What makes ${n(c.motm)} so important to you?`],
      a: c => [['He is world class and he knows it.', { player: [c.motm.id, 6] }, 'praisePlayer'], ['He is one of many important players.', { morale: 1 }, 'team'], ['He can still do much better.', { player: [c.motm.id, -4] }, 'demanding']] },
    { id: 'worst', weight: 2, when: c => c.worst && c.res !== 'W', q: c => [`${n(c.worst)} struggled today. Will he keep his place?`, `Is ${n(c.worst)} out of form?`],
      a: c => [['Everyone has a bad day. He has my full support.', { player: [c.worst.id, 5] }, 'protect'], ['Nobody is guaranteed a place in this team.', { player: [c.worst.id, -5], board: 1 }, 'blastPlayer'], ['I do not discuss individuals in public.', {}, 'deflect']] },
    { id: 'young', weight: 3, when: c => c.young && !c.hat, q: c => [`${n(c.young)} is only ${c.young.age} and he scored today. Should we expect more?`, `Is ${n(c.young)} ready to be a regular?`],
      a: c => [['He will be a superstar. Remember his name.', { player: [c.young.id, 6], rep: 1 }, 'praisePlayer'], ['Let us not put pressure on the boy.', { player: [c.young.id, 2] }, 'protect'], ['He has a long way to go.', { player: [c.young.id, -3] }, 'demanding']] },
    { id: 'debut', weight: 2, when: c => c.debut, q: c => [`${n(c.debut)} made his debut. How did he get on?`],
      a: c => [['Very proud of him. A big future.', { player: [c.debut.id, 6] }, 'praisePlayer'], ['Solid. He will learn a lot from today.', { player: [c.debut.id, 2] }, 'calm'], ['It was a tough first game for him.', { player: [c.debut.id, -2] }, 'honest']] },
    { id: 'keeper', weight: 3, when: c => c.saves >= 5 && c.keeper, q: c => [`${n(c.keeper)} made ${c.saves} saves. Did he win you the game?`, `Your goalkeeper was busy today. How good was he?`],
      a: c => [['He was magnificent. That is why he is our number one.', { player: [c.keeper.id, 6] }, 'praisePlayer'], ['He did his job. The defence should protect him better.', { morale: -1, board: 1 }, 'demanding'], ['That is what goalkeepers are for.', {}, 'calm']] },
    { id: 'cleansheet', weight: 1, when: c => c.cleanSheet && c.res !== 'L', q: c => [`Another clean sheet. Is the defence the foundation of this team?`],
      a: c => [['Everything starts from a solid defence.', { morale: 2 }, 'praise'], ['It is the whole team defending, not just the back four.', { morale: 2 }, 'team'], ['I would rather win 4–3 to be honest.', { fans: 2, rep: -1 }, 'bold']] },
    { id: 'xg', weight: 2, when: c => c.xgFor > c.xgAg + 0.8 && c.res !== 'W', q: c => [`You created far more chances. Frustrated not to win?`, `The numbers say you should have won comfortably. Do you agree?`],
      a: c => [['Very. We must be more clinical.', { board: 1 }, 'demanding'], ['If we keep creating like that, the goals will come.', { morale: 2 }, 'positive'], ['Their goalkeeper had the game of his life.', { rep: 1 }, 'honest']] },
    // ----- season context -----
    { id: 'title', weight: 3, when: c => c.lg && c.lg.played >= 8 && c.lg.pos <= 3 && c.lg.gap <= 6, q: c => [`You are ${TL.ordinal(c.lg.pos)}, ${c.lg.gap ? c.lg.gap + ' points off the top' : 'top of the league'}. Can you win the title?`, `Is this the year you win the ${c.lg.def ? c.lg.def.name : 'league'}?`],
      a: c => [['Yes. We believe, and we are going for it.', { morale: 3, fans: 4, board: 2 }, 'title'], ['One game at a time. It is a long season.', { board: 1 }, 'calm'], ['Others are favourites. We just try to stay close.', { morale: -1, rep: 1 }, 'humble']] },
    { id: 'relegation', weight: 3, when: c => c.lg && c.lg.played >= 6 && c.lg.pos > c.lg.size - 4, q: c => [`You are ${TL.ordinal(c.lg.pos)}. Are you worried about relegation?`, `The bottom of the table looks tight. Can you stay up?`],
      a: c => [['We are too good to go down. I am sure of it.', { morale: 3, fans: 2 }, 'bold'], ['It is a fight and we are ready for it.', { morale: 2 }, 'positive'], ['Of course I am worried. Everyone at the club should be.', { morale: -3, board: 1 }, 'honest']] },
    { id: 'pressure', weight: 4, when: c => c.conf < 32, q: c => [`There are reports the ${c.isNation ? 'federation' : 'board'} is losing patience. Is your job safe?`, `Do you still have the support of the ${c.isNation ? 'federation' : 'board'}?`, `Some fans are calling for a change. How do you respond?`],
      a: c => [['I have full support. We speak every day.', { board: -1 }, 'deflect'], ['Judge me at the end of the season.', { rep: 1 }, 'calm'], ['If they want to sack me, that is their decision. I will keep working.', { board: -3, fans: 2 }, 'defiant'], ['I understand the frustration. Results will come.', { fans: 2 }, 'humble']] },
    { id: 'formgood', weight: 2, when: c => c.form.length >= 5 && c.wins5 >= 4, q: c => [`${c.wins5} wins in your last five. What is the secret?`, `The team is flying. Can you keep this run going?`],
      a: c => [['Hard work on the training ground, nothing more.', { morale: 2 }, 'humble'], ['This group is special. I trust them completely.', { morale: 4 }, 'praise'], ['The run means nothing if we stop now.', { board: 1 }, 'demanding']] },
    { id: 'formbad', weight: 3, when: c => c.form.length >= 5 && c.losses5 >= 3, q: c => [`${c.losses5} defeats in five. Is this a crisis?`, `Results have dried up. What has changed?`],
      a: c => [['No crisis. We are close to turning it around.', { morale: 2 }, 'defend'], ['It is not good enough and I am angry.', { morale: -2, board: 1 }, 'demanding'], ['Injuries and bad luck have hurt us.', { rep: -1 }, 'excuse']] },
    { id: 'next', weight: 2, when: c => c.nextOpp && c.next.date > c.s.date, q: c => [`Next up is ${c.nextOpp.name}. How do you approach that one?`, `Are you already thinking about ${c.nextOpp.name}?`],
      a: c => [[c.nextBig ? 'We fear nobody. We go there to win.' : 'We expect to win. Simple as that.', { morale: 2, rep: c.nextBig ? 1 : 0 }, 'bold'], [c.nextBig ? 'They are favourites, but we have a plan.' : 'Every game is difficult in this league.', { board: 1 }, 'calm'], ['Tonight we enjoy this. Tomorrow we think about them.', { morale: 1 }, 'calm']] },
    { id: 'derby', weight: 4, when: c => c.derby, q: c => [`Derby day. What does this result mean to the fans?`, `Bragging rights in the city. Your feelings?`],
      a: c => [[c.res === 'W' ? 'This one is for the supporters. The city is ours.' : 'We let the fans down today. We know it.', { fans: c.res === 'W' ? 5 : 2, morale: c.res === 'W' ? 2 : -1 }, 'fans'], ['It is just three points like any other game.', { fans: -3 }, 'calm'], ['Derbies are about passion. I loved the atmosphere.', { fans: 2 }, 'fans']] },
    { id: 'fansangry', weight: 3, when: c => c.fans < 35, q: c => [`Some fans booed at full time. What is your message to them?`, `The supporters are restless. Do you understand them?`],
      a: c => [['I understand them completely. We will fix it.', { fans: 4 }, 'humble'], ['Booing your own players never helps.', { fans: -4, morale: 3 }, 'defiant'], ['Keep supporting us. We need you.', { fans: 2 }, 'fans']] },
    { id: 'fanshappy', weight: 1, when: c => c.fans > 80, q: c => [`The fans were singing your name. How does that feel?`],
      a: c => [['Special. They are the heart of this club.', { fans: 3 }, 'fans'], ['The praise should go to the players.', { morale: 2 }, 'team'], ['Nice, but in football things change quickly.', { rep: 1 }, 'calm']] },
    { id: 'cupwin', weight: 3, when: c => c.ko && c.res === 'W' && c.comp.type !== 'league', q: c => [`You are into the next round of the ${c.comp.name}. Can you go all the way?`, `How seriously do you take the ${c.comp.name}?`],
      a: c => [['Absolutely. We want to win this trophy.', { fans: 3, board: 1, morale: 2 }, 'title'], ['We take it one round at a time.', { board: 1 }, 'calm'], ['The league is the priority, but we will see.', { fans: -2 }, 'honest']] },
    { id: 'cupout', weight: 3, when: c => c.ko && c.res === 'L' && c.comp.type !== 'league', q: c => [`Out of the ${c.comp.name}. How disappointed are you?`],
      a: c => [['Very. We wanted to go far in this competition.', { fans: 2 }, 'honest'], ['Now we can focus on the league.', { fans: -3, board: 1 }, 'deflect'], ['We go out with our heads held high.', { morale: 2 }, 'positive']] },
    // ----- squad & transfers -----
    { id: 'window', weight: 2, when: c => c.window, q: c => [`Will there be new arrivals before the window closes?`, `Are you looking to strengthen the squad this window?`, `Any players leaving before the deadline?`],
      a: c => [['We are working on something big.', { fans: 4, board: -1 }, 'transfer'], ['I am happy with this squad.', { morale: 3 }, 'team'], ['No comment. You will find out.', {}, 'deflect']] },
    { id: 'unsettled', weight: 4, when: c => c.unsettled, q: c => [`${n(c.unsettled)} has asked to leave. Will you sell him?`, `Is ${n(c.unsettled)} still committed to this club?`],
      a: c => [['He is going nowhere. He has a contract.', { player: [c.unsettled.id, -5], fans: 2 }, 'defiant'], ['Everyone has a price, but nobody has met it.', { player: [c.unsettled.id, 4] }, 'transfer'], ['That is a private matter between us.', {}, 'deflect']] },
    { id: 'expiring', weight: 2, when: c => c.expiring, q: c => [`${n(c.expiring)}'s contract is running down. Will he sign a new deal?`],
      a: c => [['We are confident. Talks are going well.', { player: [c.expiring.id, 3], fans: 1 }, 'positive'], ['That is up to him and his agent.', { player: [c.expiring.id, -2] }, 'deflect'], ['Nobody is bigger than the club.', { player: [c.expiring.id, -4], board: 1 }, 'defiant']] },
    { id: 'wonder', weight: 2, when: c => c.wonder, q: c => [`Everyone is talking about ${n(c.wonder)}. Are big clubs calling?`, `How do you protect ${n(c.wonder)} from the hype?`],
      a: c => [['He is not for sale at any price.', { player: [c.wonder.id, 5], fans: 3 }, 'defiant'], ['We keep him grounded. He works hard every day.', { player: [c.wonder.id, 3] }, 'protect'], ['If the offer is crazy enough, we will listen.', { player: [c.wonder.id, -3], board: 2 }, 'transfer']] },
    { id: 'captain', weight: 1, when: c => c.cap, q: c => [`How important is ${n(c.cap)} as your captain?`],
      a: c => [['He is my voice in the dressing room.', { player: [c.cap.id, 5], morale: 1 }, 'praisePlayer'], ['We have many leaders in this team.', { morale: 2 }, 'team'], ['Every captain must earn the armband every week.', { player: [c.cap.id, -3] }, 'demanding']] },
    { id: 'tactics', weight: 1, when: c => true, q: c => [`Your ${c.team.tactics.formation} ${c.res === 'L' ? "didn't seem to work" : 'worked well'} today. Will you stick with it?`, `What was your game plan against ${c.opp.name}?`],
      a: c => [['The system is not the problem. It is about the players.', {}, 'calm'], [c.res === 'L' ? 'I will think about changes this week.' : 'Yes. The players understand it perfectly.', { morale: 1 }, 'tactical'], ['I never give away my tactics, sorry.', { rep: -1 }, 'deflect']] },
    { id: 'nation', weight: 3, when: c => c.isNation, q: c => [`Will you bring new faces into the squad for the next window?`, `How do you assess the squad's progress?`],
      a: c => [['The door is open for everyone in form.', { morale: -1, rep: 1 }, 'calm'], ['This group has earned my trust.', { morale: 3 }, 'team'], ['There will be changes. Some players must improve.', { morale: -3 }, 'blast']] }
  ];
  const BY_ID = Object.fromEntries(BANK.map(b => [b.id, b]));

  /* ---------- Build a conference ---------- */
  TL.pressConference = function (s, f, match) {
    const m = s.manager, teamId = (f.home === m.clubId || f.away === m.clubId) ? m.clubId : m.nationId;
    const c = context(s, f, teamId, match);
    const rng = new Rng(parseInt(TL.checksum(f.id + ':' + s.date + ':' + (m.pressCount || 0)), 16));
    m.pressSeen = m.pressSeen || []; m.pressCount = (m.pressCount || 0) + 1;
    const ok = b => { try { return !!b.when(c); } catch (e) { return false; } };
    const results = BANK.filter(b => b.kind === 'result' && ok(b));
    const special = results.filter(b => (b.weight || 1) >= 3), plain = results.filter(b => (b.weight || 1) < 3);
    const first = special.length ? rng.pick(special) : rng.pick(plain.length ? plain : [BY_ID.draw]);
    const recent = new Set(m.pressSeen.slice(-12));
    let topics = BANK.filter(b => b.kind !== 'result' && ok(b));
    const fresh = topics.filter(b => !recent.has(b.id));
    if (fresh.length >= 3) topics = fresh;
    const chosen = [first], want = clamp(3 + rng.int(1, 3), 4, 6);
    while (chosen.length < want && topics.length) { const b = rng.weighted(topics, x => (x.weight || 1) + 0.5); chosen.push(b); topics = topics.filter(x => x !== b); }
    m.pressSeen = m.pressSeen.concat(chosen.map(b => b.id)).slice(-30);
    const country = c.team.isNation ? 'X' : (OUTLETS[c.team.country] ? c.team.country : 'X');
    return chosen.map(b => ({
      id: b.id, q: rng.pick(b.q(c)), who: `${rng.pick(FIRST)} ${rng.pick(LAST)}`, outlet: rng.pick(OUTLETS[country].concat(OUTLETS.X.slice(0, 1))),
      a: b.a(c).map(([text, eff, tag]) => [text, Object.assign({}, eff, { tag })])
    }));
  };
  TL.PRESS_TONE = { praise: 'Positive', praisePlayer: 'Praise', bold: 'Bold', title: 'Ambitious', demanding: 'Demanding', blast: 'Critical', blastPlayer: 'Critical', ref: 'Referee', humble: 'Humble', honest: 'Honest', calm: 'Measured', deflect: 'Evasive', excuse: 'Excuses', arrogant: 'Arrogant', defiant: 'Defiant', protect: 'Protective', team: 'Team first', tactical: 'Tactical', positive: 'Positive', apology: 'Apology', fans: 'For the fans', transfer: 'Transfers', confident: 'Confident', defend: 'Defensive' };
  const REACT = { ref: 'Pens race across notebooks. That will be a headline.', blast: 'The room goes quiet. The players will read this.', blastPlayer: 'A sharp intake of breath in the room.', arrogant: 'A few journalists exchange looks.', bold: 'The reporters love it.', title: 'That will be on the back pages tomorrow.', transfer: 'Phones come out. The rumour mill is turning.', apology: 'A rare moment of honesty. It goes down well.', excuse: 'Some eyebrows are raised.', defiant: 'Strong words. The room buzzes.', deflect: 'The journalists move on.', praisePlayer: 'That will mean a lot to him.' };

  // Apply an answer (extends the original press effects with fines)
  const prevAnswer = TL.pressAnswer;
  TL.pressAnswer = function (s, eff) {
    prevAnswer(s, eff);
    if (eff.fine && s.manager.clubId) {
      const amt = Math.round(Math.max(0.01, 0.04 * Math.max(0.1, TL.econOf(s.clubs[s.manager.clubId]).budget)) * 100) / 100;
      TL.book(s, 'exp', 'fines', amt);
      TL.addMail(s, 'league', 'Fined for comments about the referee', `The league has fined you ${TL.fmtM(amt)} for your post-match comments about the match officials.`);
    }
    return REACT[eff.tag] || (eff.morale > 0 ? 'The players will appreciate that.' : 'The journalists nod and move on.');
  };
  /* =========================================================
     UNVEILING A BIG SIGNING
     The player holds up his shirt with the manager; the press questions both of them.
     ========================================================= */
  const lastFee = p => { const t = (p.transfers || []).slice(-1)[0]; return t && !t.loan ? t.fee || 0 : 0; };
  TL.unveilEligible = (s, p) => {
    const c = s.manager.clubId && s.clubs[s.manager.clubId];
    return !!(c && p.clubId === c.id && !p.unveiled && p.joined && TL.daysBetween(p.joined, s.date) <= 60 && (p.ovr >= 78 || p.star || lastFee(p) >= 20));
  };
  const SHIRT_PREF = { GK: [1, 13, 25], CB: [5, 4, 6, 15, 3], LB: [3, 12, 23], RB: [2, 22, 24], DM: [6, 4, 16], CM: [8, 14, 18], AM: [10, 20, 17], LW: [11, 7, 19], RW: [7, 11, 17], ST: [9, 19, 21, 99] };
  TL.freeShirtNumbers = (s, c, p) => {
    const used = new Set(c.players.filter(id => id !== p.id).map(id => s.players[id] && s.players[id].shirtNo).filter(Boolean));
    const pref = (SHIRT_PREF[p.pos] || []).filter(n => !used.has(n));
    const all = []; for (let n = 1; n <= 99; n++) if (!used.has(n)) all.push(n);
    return { pref, all, used };
  };
  TL.unveilQuestions = function (s, p) {
    const c = s.clubs[p.clubId], m = s.manager, fee = lastFee(p);
    const rng = new Rng(parseInt(TL.checksum(p.id + s.date), 16));
    const home = p.nat === c.country, h = p.hidden || {};
    const who = () => `${rng.pick(FIRST)} ${rng.pick(LAST)}, ${rng.pick((OUTLETS[c.country] || OUTLETS.X).concat(OUTLETS.X))}`;
    const qs = [];
    qs.push({ to: 'manager', who: who(), q: `What does ${p.name} bring to ${c.name}?`, a: [['He is world class. He will make us champions.', { fans: 5, morale: 1, hype: 0.2, tag: 'title' }], ['Quality and experience. He completes the squad.', { fans: 2, board: 1, tag: 'calm' }], ['A fantastic talent with plenty still to learn.', { player: [p.id, -2], fans: 1, tag: 'honest' }]] });
    qs.push({ to: 'player', who: who(), q: `${p.name}, why did you choose ${c.name}?`, ans: home && rng.chance(0.6) ? `It has been my dream since I was a kid. Wearing this shirt means everything to me and my family.` : h.professionalism >= 14 ? `Because of the manager. He told me exactly how he sees me in the team, and I believe in the project.` : rng.pick([`It is a huge club with huge history. When ${c.name} call, you do not say no.`, `I want to win trophies, and I think this is the place to do it.`, `The fans. I have played here as an opponent and the atmosphere was incredible.`]), eff: { fans: 3 } });
    qs.push({ to: 'manager', who: who(), q: rng.pick([`How long have you been tracking him?`, `Was ${p.name} always your first choice?`]), a: [['For years. He was always my number one target.', { player: [p.id, 5], fans: 2, tag: 'praisePlayer' }], ['When the chance came, we moved fast.', { board: 1, tag: 'calm' }], ['I never discuss how we work in the market.', { tag: 'deflect' }]] });
    if (fee >= 1) qs.push({ to: 'manager', who: who(), q: `${TL.fmtM(fee)} is a lot of money. Is he worth it?`, a: [['Every penny. Watch him play and you will see.', { fans: 2, player: [p.id, 3], hype: 0.1, tag: 'bold' }], ['Time will tell, but I am convinced.', { tag: 'calm' }], ['Ask the board about money. I just coach.', { board: -2, tag: 'deflect' }]] });
    qs.push({ to: 'player', who: who(), q: `You will wear number ${'{num}'}. Any special reason?`, ans: '{numReason}', eff: { fans: 1 } });
    qs.push({ to: 'manager', who: who(), q: rng.pick([`Does this signing make you title contenders?`, `What are the targets now, with ${p.name} on board?`]), a: [['Yes. This signing shows our ambition to everyone.', { fans: 5, board: 2, morale: 2, tag: 'title' }], ['We take it step by step. Nothing is won in the summer.', { board: 1, tag: 'humble' }], ['Expectations are high. That is how it should be.', { fans: 2, tag: 'bold' }]] });
    qs.push({ to: 'player', who: who(), q: `What can the fans expect from you?`, ans: ({ ATT: 'Goals, energy and a lot of passion. I want to score in every game.', MID: 'Hard work, creativity and leadership in the middle of the park.', DEF: 'Total commitment. Nobody will get past me easily.', GK: 'Clean sheets and a lot of confidence at the back.' })[TL.POS_GROUP[p.pos]], eff: { fans: 2 } });
    qs.push({ to: 'player', who: who(), q: `Did other clubs want you?`, ans: rng.chance(0.5) ? `There were offers, of course, but my heart was set on ${c.name}.` : `My agent handled that. As soon as I heard about ${c.name}, I only wanted to come here.`, eff: { fans: 2 } });
    qs.push({ to: 'player', who: who(), q: `Your message to the supporters?`, ans: `Thank you for this welcome. I will give everything for this shirt, in every training session and every game.`, eff: { fans: 3 } });
    return qs;
  };
  TL.numberReason = (p, num, c) => num === 9 ? 'The number nine has always been special for me. Strikers live and die by it.' : num === 10 ? 'Number ten. It is the number of the playmakers I grew up watching.' : num === 7 ? 'Number seven carries a lot of history. I want to add to it.' : num === 1 ? 'Number one, the goalkeeper\'s shirt. It is where I belong.' : num >= 30 ? `${num} is a family thing. It reminds me where I come from.` : `I wore ${num} when I started playing football. It brought me luck then.`;
  TL.finishUnveil = function (s, p, num, effects) {
    const c = s.clubs[p.clubId], m = s.manager;
    p.unveiled = true; p.shirtNo = num;
    const fans = effects.reduce((a, e) => a + (e.fans || 0), 0), hype = effects.reduce((a, e) => a + (e.hype || 0), 0);
    c.fans.mood = clamp(c.fans.mood + Math.min(10, 2 + fans / 3), 0, 100);
    p.morale = clamp(p.morale + 6, 5, 100);
    const crowd = Math.round(Math.min(c.cap, c.cap * clamp(0.08 + TL.merchPopularity(s, p) * 0.22, 0.05, 0.45)) / 50) * 50;
    const live = TL.merchFor && TL.merchFor(s, p.id); if (live) live.hype = clamp(live.hype + 0.25 + hype, 0.35, 1.8);
    const tag = effects.find(e => e.tag === 'title') ? 'title' : effects.find(e => e.tag === 'bold') ? 'bold' : 'calm';
    const headline = tag === 'title' ? `"He will make us champions": ${m.name} unveils ${p.name} in front of ${crowd.toLocaleString('en-GB')} fans` : tag === 'bold' ? `${p.name} takes the number ${num} shirt as ${c.name} fans roar` : `${c.name} unveil new number ${num}, ${p.name}`;
    TL.news(s, headline, { pid: p.id, club: c.id });
    TL.addMail(s, 'media', `${p.name} unveiled`, `${crowd.toLocaleString('en-GB')} supporters came to see ${p.name} hold up the number ${num} shirt.\n\nTomorrow's papers: "${headline}"`);
    return { headline, crowd };
  };

  // The next day's headline, based on the most newsworthy answer
  TL.pressHeadline = function (s, f, tags, teamId) {
    const team = TL.team(s, teamId), r = TL.userResult(s, f, teamId), mgr = s.manager.name;
    const order = ['ref', 'blast', 'blastPlayer', 'arrogant', 'title', 'transfer', 'defiant', 'apology', 'bold', 'praisePlayer', 'excuse', 'humble', 'praise'];
    const tag = order.find(t => tags.some(x => x.tag === t)); if (!tag) return null;
    const pl = (tags.find(x => x.tag === tag && x.player) || {}).player;
    const pn = pl && s.players[pl[0]] ? s.players[pl[0]].name : '';
    const H = {
      ref: `${mgr} slams the referee after ${team.name}'s ${r.gf}–${r.ga} with ${r.opp.name}`, blast: `${mgr} turns on his own players: "Some need to look at themselves"`,
      blastPlayer: `${mgr} hangs ${pn || 'a star player'} out to dry`, arrogant: `${mgr}'s swagger raises eyebrows after ${r.opp.name} game`,
      title: `"We are going for it": ${mgr} declares ${team.name} contenders`, transfer: `${mgr} hints at big signing for ${team.name}`,
      defiant: `Defiant ${mgr} hits back at critics`, apology: `${mgr} apologises to ${team.name} fans after ${r.gf}–${r.ga} humiliation`,
      bold: r.res === 'W' ? `${mgr}: "Nobody can live with us"` : `Bullish ${mgr} talks up ${team.name} despite ${r.opp.name} ${r.res === 'D' ? 'draw' : 'defeat'}`, praisePlayer: `${mgr} hails "world-class" ${pn || 'star'}`, excuse: `${mgr} blames bad luck after ${r.opp.name} setback`,
      humble: `Humble ${mgr} keeps ${team.name} grounded`, praise: `${mgr} lauds outstanding ${team.name}`
    };
    const text = H[tag];
    TL.news(s, text, { club: team.isNation ? null : team.id, kind: 'club', pid: pl ? pl[0] : null });
    return text;
  };
})();
