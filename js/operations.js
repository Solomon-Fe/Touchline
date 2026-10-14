/* Touchline — club operations: daily training schedules, backroom staff instructions, medical rehab programmes,
   detailed scouting & recommendations, transfer rumours, facility development and context-aware team talks.
   No DOM access. Loaded after career.js; wraps TL.dayTick and replaces the simple team talk. */
(function () {
  const TL = window.TL, clamp = TL.clamp, Rng = TL.Rng;
  const isHuman = (s, id) => TL.ownerIndex(s, id) >= 0;
  const mine = s => s.manager.clubId ? s.clubs[s.manager.clubId] : null;
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dowOf = iso => DOW[new Date(iso + 'T12:00:00Z').getUTCDay()];
  const A = TL.ATTRS;

  /* =========================================================
     TRAINING SESSIONS & WEEKLY PLAN
     ========================================================= */
  TL.SESSIONS = {
    rest: { name: 'Rest day', short: 'Rest', cond: 7, dev: 0, inj: 0, desc: 'Complete rest. Fastest recovery, no development.' },
    recovery: { name: 'Recovery', short: 'Recovery', cond: 4, dev: 0.3, inj: 0.2, desc: 'Pool, stretching and massage. Best the day after a match.' },
    fitness: { name: 'Fitness & conditioning', short: 'Fitness', cond: -5, dev: 1, inj: 1.5, group: ['stamina', 'strength', 'pace', 'acceleration'], desc: 'Players tire more slowly in matches. Highest injury risk.' },
    attacking: { name: 'Attacking movement', short: 'Attack', cond: -3, dev: 1, inj: 1, group: ['dribbling', 'firstTouch', 'vision', 'crossing'], desc: 'Sharper attacking play (+ attack strength).' },
    finishing: { name: 'Finishing', short: 'Finishing', cond: -2, dev: 1, inj: 0.8, group: ['finishing', 'composure', 'heading'], desc: 'Shooting drills (+ attack strength, finishing).' },
    defending: { name: 'Defensive shape', short: 'Defence', cond: -3, dev: 1, inj: 1, group: ['positioning', 'tackling', 'decisions', 'teamwork'], desc: 'Organisation at the back (+ defensive strength).' },
    pressing: { name: 'Pressing & intensity', short: 'Pressing', cond: -5, dev: 1, inj: 1.2, group: ['workRate', 'aggression', 'stamina'], desc: 'Win the ball higher (+ midfield and defence).' },
    possession: { name: 'Possession & passing', short: 'Possession', cond: -2, dev: 1, inj: 0.7, group: ['passing', 'vision', 'firstTouch', 'decisions'], desc: 'Keep the ball better (+ midfield strength).' },
    tactical: { name: 'Tactical drills', short: 'Tactics', cond: -1, dev: 0.5, inj: 0.4, group: ['decisions', 'positioning', 'teamwork'], desc: 'Learn your formation much faster.' },
    setpieces: { name: 'Set pieces', short: 'Set pieces', cond: -1, dev: 0.5, inj: 0.3, group: ['setPieces', 'heading', 'crossing'], desc: 'Corners and free kicks become more dangerous.' },
    matchprep: { name: 'Match preparation', short: 'Match prep', cond: 2, dev: 0.2, inj: 0.2, desc: 'Study the opponent. Small boost in the next match.' },
    bonding: { name: 'Team bonding', short: 'Bonding', cond: 3, dev: 0, inj: 0, desc: 'Team activity away from the pitch. Lifts morale.' }
  };
  TL.DEFAULT_WEEK = { mon: 'recovery', tue: 'attacking', wed: 'defending', thu: 'tactical', fri: 'matchprep', sat: 'possession', sun: 'rest' };
  TL.WEEK_PRESETS = {
    balanced: ['Balanced', { mon: 'recovery', tue: 'attacking', wed: 'defending', thu: 'tactical', fri: 'matchprep', sat: 'possession', sun: 'rest' }],
    attacking: ['Attacking', { mon: 'recovery', tue: 'attacking', wed: 'finishing', thu: 'possession', fri: 'matchprep', sat: 'finishing', sun: 'rest' }],
    defensive: ['Defensive', { mon: 'recovery', tue: 'defending', wed: 'pressing', thu: 'tactical', fri: 'matchprep', sat: 'defending', sun: 'rest' }],
    fitness: ['Fitness block', { mon: 'recovery', tue: 'fitness', wed: 'pressing', thu: 'fitness', fri: 'tactical', sat: 'possession', sun: 'rest' }],
    light: ['Light week', { mon: 'rest', tue: 'recovery', wed: 'tactical', thu: 'setpieces', fri: 'matchprep', sat: 'bonding', sun: 'rest' }]
  };
  TL.WORKLOADS = { rest: 'Rest (no training)', light: 'Light', normal: 'Normal', extra: 'Extra sessions' };

  /* ---------- Backroom instructions ---------- */
  TL.STAFF_ORDERS = {
    assistant: { balanced: ['All-round support', 'No special focus.'], opponent: ['Opposition analysis', 'Detailed reports on every opponent: about 1% stronger in matches.'], tactics: ['Tactical coaching', 'The team learns formations about 50% faster.'], morale: ['Man-management', 'Keeps the dressing room happy: morale rises a little each week.'] },
    attCoach: { balanced: ['All-round attacking', 'Spreads the work across attacking skills.'], finishing: ['Finishing', 'Extra work on finishing and composure.'], creativity: ['Creativity', 'Passing, vision and first touch.'], movement: ['Movement & pace', 'Dribbling, acceleration and agility.'] },
    defCoach: { balanced: ['All-round defending', 'Spreads the work across defensive skills.'], organisation: ['Organisation', 'Positioning, decisions and teamwork.'], tackling: ['Tackling & duels', 'Tackling, aggression and strength.'], aerial: ['Aerial duels', 'Heading, jumping and strength.'] },
    gkCoach: { balanced: ['All-round goalkeeping', 'Spreads the work across goalkeeping skills.'], shotstopping: ['Shot stopping', 'Reflexes and one-on-ones.'], handling: ['Handling & command', 'Handling and aerial reach.'], distribution: ['Distribution', 'Kicking, passing and composure.'] },
    fitCoach: { balanced: ['Balanced fitness', 'No special focus.'], conditioning: ['Match conditioning', 'Players tire about 4% more slowly in matches.'], prevention: ['Injury prevention', 'About 20% fewer injuries; recovery slightly slower.'], recovery: ['Recovery', 'Condition returns about 12% faster between matches.'] },
    physio: { balanced: ['Balanced', 'No special focus.'], rehab: ['Rehabilitation', 'Injured players recover about 15% faster.'], prevention: ['Prevention', 'About 15% fewer injuries in matches and training.'] },
    youthCoach: { balanced: ['Balanced', 'Academy players develop evenly.'], technical: ['Technical', 'Academy work on technique.'], physical: ['Physical', 'Academy work on athleticism.'], mental: ['Mental', 'Academy work on decision-making and attitude.'] }
  };
  const ORDER_ATTRS = {
    'attCoach:finishing': ['finishing', 'composure'], 'attCoach:creativity': ['passing', 'vision', 'firstTouch'], 'attCoach:movement': ['dribbling', 'acceleration', 'agility'],
    'defCoach:organisation': ['positioning', 'decisions', 'teamwork'], 'defCoach:tackling': ['tackling', 'aggression', 'strength'], 'defCoach:aerial': ['heading', 'jumping', 'strength'],
    'gkCoach:shotstopping': ['reflexes', 'oneOnOnes'], 'gkCoach:handling': ['handling', 'aerialReach'], 'gkCoach:distribution': ['kicking', 'passing', 'composure'],
    'youthCoach:technical': A.Technical, 'youthCoach:physical': A.Physical, 'youthCoach:mental': A.Mental
  };
  TL.SCOUT_REGIONS = { ALL: 'Everywhere', ENG: 'England', ESP: 'Spain', ITA: 'Italy', GER: 'Germany', FRA: 'France', NGA: 'Nigeria', FA: 'Free agents' };
  TL.SCOUT_FOCUS = { needs: 'Fill our weakest positions', youth: 'Young talents (21 and under)', bargains: 'Bargains (cheap or expiring contracts)', stars: 'Ready-made stars' };

  /* ---------- Facilities ---------- */
  TL.FACILITIES = {
    training: { name: 'Training ground', max: 20, step: 2, days: 150, base: 0, desc: 'Players develop faster.' },
    youth: { name: 'Youth academy', max: 20, step: 2, days: 150, base: 0, desc: 'Better youth intakes and academy growth.' },
    medical: { name: 'Medical centre', max: 5, step: 1, days: 120, base: 3, desc: 'Injuries heal faster (about 3% per level).' },
    science: { name: 'Sports science lab', max: 5, step: 1, days: 120, base: 3.5, desc: 'Fewer injuries and players tire more slowly.' },
    scouting: { name: 'Scouting network', max: 5, step: 1, days: 90, base: 2, desc: 'Faster scout reports and more recommendations.' },
    commercial: { name: 'Club megastore', max: 5, step: 1, days: 120, base: 4, desc: '+7% merchandise income per level.' },
    hospitality: { name: 'Corporate hospitality', max: 5, step: 1, days: 150, base: 5, desc: '+6% matchday income per level.' },
    pitch: { name: 'Hybrid pitch & drainage', max: 3, step: 1, days: 60, base: 2.5, desc: 'A slightly stronger home advantage.' },
    fanzone: { name: 'Fan zone', max: 3, step: 1, days: 90, base: 2, desc: 'Fans are happier: mood rises every month.' }
  };
  const FAC_KEYS = ['medical', 'science', 'scouting', 'commercial', 'hospitality', 'pitch', 'fanzone'];
  TL.PROJECTS = {};
  for (const k in TL.FACILITIES) {
    const F = TL.FACILITIES[k];
    TL.PROJECTS[k] = { name: `${F.name} upgrade`, days: F.days, effect: F.desc, facility: k, apply: c => { c.facilities[k] = Math.min(F.max, (c.facilities[k] || 0) + F.step); } };
  }
  TL.PROJECTS.stadium = { name: 'Stadium expansion', days: 270, effect: 'Capacity +15% (more matchday income).', apply: c => { c.cap = Math.round(c.cap * 1.15); } };
  TL.PROJECTS.newstadium = { name: 'Build a new stadium', days: 720, effect: 'A modern stadium with 60% more seats. Reputation +3.', apply: (c, s) => { c.cap = Math.max(c.cap + 15000, Math.round(c.cap * 1.6)); c.rep = Math.min(99, c.rep + 3); c.stadium = `${c.name} New Stadium`; if (s) TL.news(s, `${c.name} open their new ${c.cap.toLocaleString('en-GB')}-seat stadium.`, { club: c.id }); } };
  TL.projectCost = (s, c, type) => {
    const e = TL.econOf(c), scale = Math.max(0.03, e.budget);
    if (type === 'stadium') return Math.round((c.cap * 0.15 * 0.004 * Math.max(0.1, e.ticket) + 2 * scale) * 10) / 10;
    if (type === 'newstadium') return Math.round((40 + c.cap * 0.004) * scale * 10) / 10;
    if (type === 'training' || type === 'youth') return Math.round((4 + c.facilities[type] * 1.6) * scale * 10) / 10;
    return Math.round(TL.FACILITIES[type].base * ((c.facilities[type] || 0) + 1) * scale * 10) / 10;
  };
  TL.projectBlocked = (s, c, type) => {
    c.projects = c.projects || [];
    if (c.projects.some(p => p.type === type)) return 'Already under way.';
    if ((type === 'stadium' && c.projects.some(p => p.type === 'newstadium')) || (type === 'newstadium' && c.projects.some(p => p.type === 'stadium'))) return 'Another stadium project is under way.';
    const F = TL.FACILITIES[type];
    if (F && (c.facilities[type] || 0) >= F.max) return 'Already at the highest level.';
    if (c.projects.length >= 3) return 'The board allows three projects at a time.';
    return null;
  };
  TL.startProject = (s, type, share) => {
    const c = mine(s);
    const blocked = TL.projectBlocked(s, c, type); if (blocked) return blocked;
    const cost = TL.projectCost(s, c, type), pay = Math.round(cost * (1 - (share || 0)) * 10) / 10;
    if (c.finance.balance < pay) return `The board won't approve it: the club's share is ${TL.fmtM(pay)} and the bank balance is ${TL.fmtM(c.finance.balance)}. Ask the board for investment instead.`;
    TL.book(s, 'exp', 'facilities', pay);
    const def = TL.PROJECTS[type];
    c.projects.push({ type, start: s.date, end: TL.addDays(s.date, def.days), cost });
    return `${def.name} approved${share ? ` (the board is paying ${Math.round(share * 100)}%)` : ''}. Work finishes around ${TL.fmtDate(TL.addDays(s.date, def.days), true)}.`;
  };
  // Ask the board to fund part of a project. Answer depends on board confidence and finances; one request per 60 days.
  TL.requestInvestment = (s, type) => {
    const c = mine(s), m = s.manager;
    const blocked = TL.projectBlocked(s, c, type); if (blocked) return blocked;
    if (c.boardAsk && TL.daysBetween(c.boardAsk, s.date) < 60) return `The board will consider new requests after ${TL.fmtDate(TL.addDays(c.boardAsk, 60), true)}.`;
    c.boardAsk = s.date;
    const conf = m.board.confidence, healthy = c.finance.balance > 0;
    const roll = new Rng(parseInt(TL.checksum(s.date + type + c.id), 16)).next();
    let share = 0;
    if (conf >= 72 && healthy) share = 0.75;
    else if (conf >= 55 && roll < (healthy ? 0.65 : 0.35)) share = 0.5;
    else if (conf >= 40 && roll < 0.25) share = 0.3;
    if (!share) { TL.addMail(s, 'board', 'Investment request declined', `The board has declined to fund the ${TL.PROJECTS[type].name.toLowerCase()}. ${conf < 45 ? 'Results need to improve before they invest further.' : 'The timing is not right. Try again later.'}`); return 'The board said no this time. See your inbox.'; }
    const msg = TL.startProject(s, type, share);
    TL.addMail(s, 'board', 'Investment approved', `The board will pay ${Math.round(share * 100)}% of the ${TL.PROJECTS[type].name.toLowerCase()}.\n\n${msg}`, true);
    return msg;
  };

  /* ---------- Per-club setup / migration ---------- */
  TL.ensureOps = c => {
    if (!c || c.isNation) return;
    c.training = c.training || { focus: 'balanced', intensity: 1 };
    const t = c.training;
    if (!t.week) t.week = Object.assign({}, TL.DEFAULT_WEEK);
    if (t.autoRecovery == null) t.autoRecovery = true;
    if (t.autoPrep == null) t.autoPrep = true;
    if (t.intensity == null) t.intensity = 1;
    t.recent = t.recent || [];
    c.orders = Object.assign({ assistant: 'balanced', attCoach: 'balanced', defCoach: 'balanced', gkCoach: 'balanced', fitCoach: 'balanced', physio: 'balanced', youthCoach: 'balanced', scoutRegion: 'ALL', scoutFocus: 'needs' }, c.orders || {});
    if (c.fam) for (const f in TL.FORMATIONS) if (c.fam[f] == null) c.fam[f] = 40;
    if (c.facilities) for (const k of FAC_KEYS) if (c.facilities[k] == null) c.facilities[k] = k === 'pitch' || k === 'fanzone' ? (c.rep >= 80 ? 2 : c.rep >= 68 ? 1 : 0) : c.rep >= 86 ? 3 : c.rep >= 76 ? 2 : c.rep >= 64 ? 1 : 0;
  };
  const prevInitEconomy = TL.initEconomy;
  TL.initEconomy = function (s, rng) { prevInitEconomy(s, rng); for (const id in s.clubs) TL.ensureOps(s.clubs[id]); };
  const prevMigrate = TL.migrate;
  TL.migrate = function (s) { const out = prevMigrate(s); if (out && out.clubs) for (const id in out.clubs) TL.ensureOps(out.clubs[id]); return out; };

  /* ---------- Which session runs on a given day ---------- */
  const playsOn = (s, clubId, date) => s.fixtures.some(f => f.date === date && (f.home === clubId || f.away === clubId));
  TL.sessionFor = (s, c, date, lookup) => {
    TL.ensureOps(c);
    const t = c.training, plays = lookup || ((d) => playsOn(s, c.id, d));
    if (plays(date)) return 'match';
    if (t.autoRecovery && plays(TL.addDays(date, -1))) return 'recovery';
    if (t.autoPrep && plays(TL.addDays(date, 1))) return 'matchprep';
    return t.week[dowOf(date)] || 'rest';
  };

  /* ---------- Effects used by the match engine and development ---------- */
  const NEUTRAL = { att: 1, mid: 1, def: 1, fat: 1, sp: 1, prep: 1 };
  TL.trainBonus = (s, c) => {
    if (!c || c.isNation || !c.training || !c.training.recent) return NEUTRAL;
    if (c._tb && c._tb.d === s.date && c._tb.n === c.training.recent.length) return c._tb.v;
    const r = c.training.recent, n = k => r.filter(x => x === k).length, o = c.orders || {}, f = c.facilities || {};
    const v = {
      att: 1 + Math.min(0.025, 0.006 * (n('attacking') + n('finishing'))),
      def: 1 + Math.min(0.025, 0.006 * n('defending') + 0.003 * n('pressing')),
      mid: 1 + Math.min(0.02, 0.005 * n('possession') + 0.003 * n('pressing')),
      fat: Math.max(0.84, 1 - 0.02 * n('fitness') - (o.fitCoach === 'conditioning' ? 0.04 : 0) - 0.006 * (f.science || 0)),
      sp: 1 + Math.min(0.2, 0.06 * n('setpieces')),
      prep: 1 + (r[r.length - 1] === 'matchprep' ? 0.012 : 0) + (o.assistant === 'opponent' ? 0.008 : 0)
    };
    c._tb = { d: s.date, n: r.length, v };
    return v;
  };
  TL.trainGrowthMult = (s, c, p) => {
    const t = c.training || {};
    const intF = [0.8, 1, 1.2][t.intensity == null ? 1 : t.intensity];
    const r = t.recent || [];
    const devAvg = r.length ? r.reduce((a, k) => a + ((TL.SESSIONS[k] || {}).dev || 0), 0) / r.length : 0.57;
    const wl = { rest: 0.3, light: 0.8, normal: 1, extra: 1.25 }[p.workload || 'normal'];
    // matches themselves also develop players, so a congested fixture list only costs a little
    return clamp(0.7 + 0.3 * devAvg / 0.57, 0.7, 1.25) * intF * wl;
  };
  TL.attrBias = (s, c, p) => {
    const o = c.orders || {}, out = [];
    for (const k of (c.training && c.training.recent) || []) { const g = (TL.SESSIONS[k] || {}).group; if (g) out.push(...g); }
    const g = TL.POS_GROUP[p.pos];
    const roles = p.academy ? ['youthCoach'] : g === 'GK' ? ['gkCoach'] : g === 'DEF' ? ['defCoach'] : g === 'ATT' ? ['attCoach'] : ['attCoach', 'defCoach'];
    for (const r of roles) { const a = ORDER_ATTRS[r + ':' + o[r]]; if (a) out.push(...a, ...a); }
    return p.pos === 'GK' ? out.filter(k => A.Goalkeeping.includes(k) || ['composure', 'decisions', 'positioning', 'agility', 'passing'].includes(k)) : out.filter(k => !A.Goalkeeping.includes(k));
  };
  TL.injuryRisk = (s, c) => {
    if (!c || c.isNation || !c.orders) return 1;
    const o = c.orders, f = c.facilities || {};
    return (o.physio === 'prevention' ? 0.85 : 1) * (o.fitCoach === 'prevention' ? 0.8 : 1) * (1 - 0.03 * (f.science || 0));
  };
  TL.injuryDaysFactor = (s, c) => {
    if (!c || c.isNation || !c.staffIds) return 1;
    return (1.2 - TL.staffRating(s, c.id, 'physio') / 40) * (1 - 0.025 * ((c.facilities && c.facilities.medical) || 0));
  };
  TL.recoveryBonus = (s, c) => { const o = c.orders; if (!o) return 1; return o.fitCoach === 'recovery' ? 1.12 : o.fitCoach === 'prevention' ? 0.97 : 1; };

  /* =========================================================
     MEDICAL: rehab programmes
     ========================================================= */
  TL.REHAB = {
    standard: { name: 'Standard rehabilitation', desc: 'Normal recovery time. No extra cost.', speed: 1, setback: 0.03 },
    intensive: { name: 'Intensive programme', desc: 'About 35% faster, but a 12% risk of a setback near the end.', speed: 1.35, setback: 0.12, cost: 0.08 },
    cautious: { name: 'Cautious recovery', desc: 'About 20% slower, but he comes back fully fit with almost no risk of a setback.', speed: 0.8, setback: 0 },
    specialist: { name: 'See a specialist', desc: 'About 50% faster with little risk. Expensive; only for injuries of three weeks or more.', speed: 1.5, setback: 0.04, cost: 0.35, minDays: 21 },
    rush: { name: 'Rush him back (painkillers)', desc: 'Available right away at reduced fitness, but four times as likely to get injured again over the next three weeks.', maxDays: 14 }
  };
  TL.rehabCost = (s, c, kind) => { const r = TL.REHAB[kind]; return r && r.cost ? Math.round(Math.max(0.02, r.cost * Math.max(0.05, TL.econOf(c).budget)) * 100) / 100 : 0; };
  TL.rehabOptions = (s, p) => Object.keys(TL.REHAB).filter(k => { const r = TL.REHAB[k]; return (!r.minDays || p.injury >= r.minDays) && (!r.maxDays || p.injury <= r.maxDays); });
  TL.setRehab = (s, pid, kind) => {
    const p = s.players[pid], c = s.clubs[p.clubId];
    if (!p || p.injury <= 0) return 'He is not injured.';
    if (!TL.rehabOptions(s, p).includes(kind)) return 'That programme is not suitable for this injury.';
    if (p.rehab && p.rehab !== 'standard' && TL.REHAB[p.rehab].cost) return 'He is already on a paid programme.';
    const cost = TL.rehabCost(s, c, kind);
    if (cost) TL.book(s, 'exp', 'medical', cost);
    if (kind === 'rush') {
      p.injury = 0; p.injuryName = ''; p.cond = Math.min(p.cond, 62); p.rushed = TL.addDays(s.date, 21); p.rehab = null;
      return `${p.name} has been given painkillers and is available, but he is at real risk of breaking down again.`;
    }
    p.rehab = kind;
    return `${p.name} starts the ${TL.REHAB[kind].name.toLowerCase()}${cost ? ` (${TL.fmtM(cost)})` : ''}.`;
  };
  // Days of recovery for one calendar day. Handles setbacks and the cautious return.
  TL.rehabStep = (s, p, c, rng) => {
    const r = TL.REHAB[p.rehab || 'standard'] || TL.REHAB.standard;
    let rate = r.speed;
    if (c && c.orders && c.orders.physio === 'rehab') rate *= 1.15;
    if (c && c.facilities) rate *= 1 + 0.03 * (c.facilities.medical || 0);
    let step = Math.floor(rate) + (rng.chance(rate - Math.floor(rate)) ? 1 : 0);
    if (p.injury - step <= 0) {
      if (r.setback && p.rehab && p.rehab !== 'standard' && rng.chance(r.setback)) {
        const extra = rng.int(5, 14);
        p.injury += extra; p.rehab = 'standard';
        if (p.clubId) TL.mailClub(s, p.clubId, 'medical', `Setback for ${p.name}`, `${p.name} felt pain in his final rehab session. He needs about ${Math.ceil(extra / 7)} more week(s).`);
        return 0;
      }
      if (p.rehab === 'cautious') p.cond = 92;
      p.rehab = null;
    }
    return step;
  };
  TL.onInjury = (s, p) => {
    if (!p.clubId || !isHuman(s, p.clubId) || p.injury < 4) return;
    p._injMailed = true;
    const c = s.clubs[p.clubId];
    TL.mailClub(s, p.clubId, 'medical', `${p.name}: ${p.injuryName.toLowerCase()}`, `${p.name} has a ${p.injuryName.toLowerCase()}. Expected time out: about ${p.injury} days (${Math.max(1, Math.round(p.injury / 7))} week${p.injury > 10 ? 's' : ''}).\n\nHow should we handle his recovery? Choose a programme below, or leave it and he will follow standard rehabilitation.\n\nHead physio rating: ${TL.staffRating(s, c.id, 'physio')}/20 · Medical centre level ${c.facilities.medical || 0}.`, p.injury >= 14);
    const i = TL.ownerIndex(s, p.clubId);
    TL.asManager(s, i, () => { s.inbox[0].action = { kind: 'injury', id: p.id }; });
  };

  /* =========================================================
     DAILY OPERATIONS (wraps the economy's day tick)
     ========================================================= */
  const TRAIN_INJ = ['Hamstring strain', 'Twisted ankle', 'Calf strain', 'Groin strain', 'Back spasm', 'Bruised knee', 'Tight thigh'];
  const prevDayTick = TL.dayTick;
  TL.dayTick = function (s, prev, date, rng) {
    prevDayTick(s, prev, date, rng);
    if (!s.staff) return;
    // which clubs played yesterday / on the training day / the day after
    const before = TL.addDays(prev, -1), sets = { [before]: new Set(), [prev]: new Set(), [date]: new Set() };
    for (const f of s.fixtures) { const st = sets[f.date]; if (st) { st.add(f.home); st.add(f.away); } }
    const lookup = d => false;
    const dow = dowOf(prev), newMonth = prev.slice(0, 7) !== date.slice(0, 7);
    for (const id in s.clubs) {
      const c = s.clubs[id]; TL.ensureOps(c);
      const sess = TL.sessionFor(s, c, prev, d => sets[d] ? sets[d].has(id) : lookup(d));
      if (sess === 'match') continue;
      trainingDay(s, c, sess, rng);
    }
    for (const cid of TL.humanClubIds(s)) {
      const c = s.clubs[cid];
      for (const pid of c.players) { const p = s.players[pid]; if (p.rushed && p.rushed <= date) p.rushed = null; }
      // development history: note every rating change (squad and academy) for the progress charts
      for (const pid of c.players.concat(c.academy || [])) {
        const p = s.players[pid]; if (!p) continue;
        const h = p.hist = p.hist || [];
        if (!h.length || h[h.length - 1][1] !== p.ovr) { h.push([date, p.ovr]); if (h.length > 80) h.splice(0, h.length - 80); }
      }
      if (dow === 'mon') {
        if (c.orders.assistant === 'morale') for (const pid of c.players) s.players[pid].morale = clamp(s.players[pid].morale + 1, 5, 100);
        TL.asManager(s, TL.ownerIndex(s, cid), () => scoutRecommendations(s, c, rng));
      }
      if (newMonth && c.facilities.fanzone) c.fans.mood = clamp(c.fans.mood + c.facilities.fanzone * 0.8, 0, 100);
    }
    rumourDay(s, date, rng);
  };
  function trainingDay(s, c, sess, rng) {
    const S = TL.SESSIONS[sess] || TL.SESSIONS.rest, t = c.training, human = isHuman(s, c.id);
    const intF = [0.8, 1, 1.25][t.intensity];
    const risk = 0.00035 * S.inj * intF * intF * TL.injuryRisk(s, c);
    for (const pid of c.players) {
      const p = s.players[pid];
      if (!p || p.onLoan || p.injury > 0) continue;
      const wl = p.workload || 'normal';
      if (wl === 'rest') { p.cond = Math.min(100, p.cond + 5); continue; }
      const dc = S.cond < 0 ? S.cond * intF * (wl === 'extra' ? 1.3 : wl === 'light' ? 0.6 : 1) : S.cond;
      p.cond = clamp(Math.round(p.cond + dc * 0.6), 20, 100);
      if (sess === 'bonding') p.morale = clamp(p.morale + 2, 5, 100);
      const pr = risk * (wl === 'extra' ? 1.5 : wl === 'light' ? 0.6 : 1) * (p.hidden.injuryProne + 4) / 12 * (p.cond < 60 ? 1.6 : 1);
      if (pr && rng.chance(pr)) {
        p.injury = rng.int(3, 18); p.injuryName = rng.pick(TRAIN_INJ) + ' (training)'; p.rehab = null;
        if (human) TL.onInjury(s, p);
      }
    }
    if (c.fam) {
      const f = c.tactics.formation, tac = c.orders.assistant === 'tactics' ? 1.5 : 1;
      c.fam[f] = Math.min(100, (c.fam[f] || 45) + (sess === 'tactical' ? 3 : 0.4) * tac);
    }
    t.recent.push(sess); if (t.recent.length > 7) t.recent.shift();
  }

  /* =========================================================
     SCOUTING: detailed reports, grades and recommendations
     ========================================================= */
  const word = (v, hi, mid, lo, vlo) => v >= 16 ? hi : v >= 12 ? mid : v >= 8 ? lo : vlo;
  TL.scoutGrade = (s, p) => {
    const c = mine(s);
    const same = c ? c.players.map(id => s.players[id]).filter(x => x && x.id !== p.id && TL.familiarity(x.pos, p.pos) >= 0.9).sort((a, b) => b.ovr - a.ovr) : [];
    const best = same[0] ? same[0].ovr : 60, second = same[1] ? same[1].ovr : best - 4;
    let score = (p.ovr - second) + (p.age <= 23 ? Math.max(0, p.pot - p.ovr) * 0.35 : 0) - (p.age >= 31 ? (p.age - 30) * 1.5 : 0);
    const g = score >= 8 ? 'A' : score >= 3 ? 'B' : score >= -2 ? 'C' : score >= -7 ? 'D' : 'E';
    return { g, score, best: same[0] || null };
  };
  TL.scoutReportData = (s, p) => {
    const c = mine(s), v = TL.abilityView(s, p), gr = TL.scoutGrade(s, p);
    const relevant = Object.keys(p.attrs).filter(k => p.pos === 'GK' ? A.Goalkeeping.includes(k) || ['composure', 'decisions', 'positioning', 'agility', 'leadership'].includes(k) : !A.Goalkeeping.includes(k));
    const sorted = relevant.slice().sort((a, b) => p.attrs[b] - p.attrs[a]);
    const positions = TL.POSITIONS.filter(x => TL.familiarity(p.pos, x) >= 0.9);
    const h = p.hidden, a = p.attrs;
    const style = (() => {
      if (p.pos === 'GK') return a.kicking >= 14 ? 'A sweeper keeper who is comfortable with the ball at his feet.' : a.reflexes >= 15 ? 'A shot-stopper with sharp reflexes.' : 'A traditional goalkeeper.';
      const bits = [];
      if (a.pace >= 15) bits.push('quick'); if (a.strength >= 15) bits.push('physically strong'); if (a.dribbling >= 15) bits.push('skilful on the ball');
      if (a.passing >= 15 && a.vision >= 14) bits.push('a creative passer'); if (a.finishing >= 15) bits.push('a clinical finisher'); if (a.tackling >= 15) bits.push('a tough tackler');
      if (a.heading >= 15) bits.push('dominant in the air'); if (a.workRate >= 15) bits.push('tireless');
      return bits.length ? `He is ${bits.slice(0, 3).join(', ')}.` : 'A steady, all-round player without one standout quality.';
    })();
    const sc = c ? TL.staffRating(s, c.id, 'scout') : 8, clear = sc >= 9;
    const personality = clear ? [
      ['Professionalism', word(h.professionalism, 'Model professional', 'Dedicated', 'Inconsistent effort', 'Lazy')],
      ['Temperament', a.aggression >= 15 && a.composure < 10 ? 'Hot-headed' : a.composure >= 15 ? 'Ice-cool' : 'Even-tempered'],
      ['Big matches', word(h.bigMatch, 'Thrives on the big stage', 'Handles pressure well', 'Can go missing', 'Freezes under pressure')],
      ['Consistency', word(h.consistency, 'Very consistent', 'Reliable', 'Up and down', 'Very erratic')],
      ['Injury record', h.injuryProne >= 13 ? 'Injury-prone' : h.injuryProne >= 8 ? 'Average' : 'Rarely injured'],
      ['Leadership', word(a.leadership, 'Natural leader', 'Vocal', 'Quiet', 'Follower')]
    ] : [['Personality', 'Our scout could not form a clear view. A better chief scout would tell us more.']];
    const st = p.stats, avg = st.rated ? st.ratingSum / st.rated : 0;
    const ask = p.clubId ? TL.askingPrice(s, p) : 0;
    const wage = c ? TL.wageFor(p, c.rep, c) : null;
    const verdict = !c ? '' : gr.g === 'A' ? 'Sign him. He would be a big upgrade on what we have.' : gr.g === 'B' ? 'Recommended. He would improve our first team.' : gr.g === 'C' ? 'A useful squad option at the right price.' : gr.g === 'D' ? 'Not good enough for our first team right now.' : 'Not recommended.';
    return {
      grade: gr.g, verdict, style, positions, personality,
      strengths: sorted.slice(0, 4), weaknesses: sorted.slice(-3).reverse(),
      ability: v, compare: gr.best ? { name: gr.best.name, ovr: gr.best.ovr, id: gr.best.id } : null,
      season: { apps: st.apps, goals: st.goals, assists: st.assists, avg },
      price: ask, wage, contract: p.contract ? p.contract.end : null, clause: p.contract && p.contract.clause, scoutRating: sc,
      interest: TL.playerInterest(s, p)
    };
  };
  // Weekly report from the whole scouting department: the chief scout plus up to four assistant scouts,
  // each covering their own region and brief.
  function scoutRecommendations(s, c, rng) {
    const net = (c.facilities && c.facilities.scouting) || 0;
    if (c.orders.scoutPaused) return; // the whole department is on hold
    const team = (c.orders.chiefPaused ? [] : [{ name: s.staff[c.staffIds.scout] ? s.staff[c.staffIds.scout].name : 'Chief Scout', role: 'Chief Scout', region: c.orders.scoutRegion, focus: c.orders.scoutFocus, n: 2 + Math.floor(net / 2) }])
      .concat((c.scoutTeam || []).filter(a => !a.paused).map(a => { const st = s.staff[a.id]; return st ? { name: st.name, role: 'Assistant scout', region: a.region, focus: a.focus, n: 1 + Math.floor(st.rating / 7) } : null; }).filter(Boolean));
    const taken = new Set(), sections = [], all = [];
    for (const sc of team) {
      const picks = scoutSearch(s, c, sc.region, sc.focus, sc.n, taken, rng);
      if (!picks.length) continue;
      for (const p of picks) { taken.add(p.id); s.scouted[p.id] = s.date; all.push(p); }
      sections.push(`${sc.name} (${sc.role} · ${TL.SCOUT_REGIONS[sc.region]} · ${TL.SCOUT_FOCUS[sc.focus].toLowerCase()}):\n${picks.map(p => `• ${p.name} (${p.pos}, ${p.age}) – ${p.clubId ? s.clubs[p.clubId].name : 'free agent'} · grade ${TL.scoutGrade(s, p).g}${p.clubId ? ' · about ' + TL.fmtM(TL.askingPrice(s, p)) : ''}`).join('\n')}`);
    }
    if (!all.length) return;
    TL.addMail(s, 'scout', `Scouting department: ${all.length} player${all.length > 1 ? 's' : ''} watched`, `This week's recommendations. Full reports are on each player's profile.\n\n${sections.join('\n\n')}`);
    s.inbox[0].action = { kind: 'players', ids: all.map(p => p.id) };
  }
  function scoutSearch(s, c, region, focus, n, taken, rng) {
    const o = { scoutRegion: region, scoutFocus: focus };
    const budget = c.finance.transferBudget;
    const xi = TL.pickXI(s, c, c.tactics.formation, { ignoreCondition: true });
    const slots = TL.FORMATIONS[c.tactics.formation];
    const weak = xi.map((id, i) => ({ pos: slots[i][0], v: id ? s.players[id].ovr : 0 })).sort((a, b) => a.v - b.v).slice(0, 3);
    const avg = xi.reduce((a, id) => a + (id ? s.players[id].ovr : 0), 0) / Math.max(1, xi.length);
    const cands = [];
    for (const id in s.players) {
      const p = s.players[id];
      if (p.clubId === c.id || p.abroad || p.academy || p.onLoan || p.trialist || p.temp || s.scouted[id] || taken.has(id)) continue;
      if (o.scoutRegion === 'FA' ? p.clubId : o.scoutRegion !== 'ALL' && (!p.clubId || s.clubs[p.clubId].country !== o.scoutRegion)) continue;
      const price = p.clubId ? TL.askingPrice(s, p) : 0;
      if (price > budget * 1.25 + 0.5) continue;
      let w = 0;
      if (o.scoutFocus === 'youth') w = p.age <= 21 && p.pot >= avg + 2 ? (p.pot - avg) : 0;
      else if (o.scoutFocus === 'bargains') w = (p.listed || p.requested || !p.clubId || (p.contract && p.contract.end <= s.season)) && p.ovr >= avg - 6 ? p.ovr - avg + 8 : 0;
      else if (o.scoutFocus === 'stars') w = p.ovr >= avg + 3 && p.age <= 30 ? p.ovr - avg : 0;
      else { const wk = weak.find(x => TL.familiarity(p.pos, x.pos) >= 0.9); w = wk && p.ovr >= wk.v + 2 && p.age <= 31 ? p.ovr - wk.v : 0; }
      if (w > 0) cands.push({ p, w });
    }
    const picks = [];
    for (let i = 0; i < n && cands.length; i++) { const x = rng.weighted(cands, y => y.w); picks.push(x.p); cands.splice(cands.indexOf(x), 1); }
    return picks;
  }

  /* ---------- Assistant scouts (up to four, besides the chief scout) ---------- */
  TL.MAX_ASSIST_SCOUTS = 4;
  TL.scoutCandidates = (s, c) => {
    // a fresh shortlist of assistant scouts each month
    const key = s.date.slice(0, 7);
    if (!c.scoutCands || c.scoutCands.month !== key) {
      const rng = new Rng(parseInt(TL.checksum(c.id + key), 16));
      const nats = [c.country, c.country, 'ENG', 'ESP', 'FRA', 'GER', 'ITA', 'NGA', 'BRA', 'ARG', 'POR', 'NED', 'GHA'];
      c.scoutCands = { month: key, list: Array.from({ length: 5 }, () => { const nat = rng.pick(nats); const rating = rng.int(5, 17); return { name: TL.randomName(nat, rng), nat, age: rng.int(28, 62), rating, wage: Math.max(0.2, Math.round(TL.staffWage(rating, c) * 0.55 * 10) / 10), home: rng.pick(Object.keys(TL.SCOUT_REGIONS).filter(k => k !== 'ALL' && k !== 'FA')) }; }) };
    }
    return c.scoutCands.list;
  };
  TL.hireAssistantScout = (s, i) => {
    const c = mine(s); c.scoutTeam = c.scoutTeam || [];
    if (c.scoutTeam.length >= TL.MAX_ASSIST_SCOUTS) return `You already have ${TL.MAX_ASSIST_SCOUTS} assistant scouts.`;
    const cand = TL.scoutCandidates(s, c)[i]; if (!cand || cand.hired) return 'No longer available.';
    const st = { id: 'S' + (s.nextId++), role: 'asstScout', name: cand.name, nat: cand.nat, age: cand.age, rating: cand.rating, wage: cand.wage, end: s.season + 2 };
    s.staff[st.id] = st; cand.hired = true;
    c.scoutTeam.push({ id: st.id, region: cand.home, focus: 'needs' });
    TL.book(s, 'exp', 'staff', st.wage * 4 / 1000);
    return `${st.name} joins the scouting department, covering ${TL.SCOUT_REGIONS[cand.home]}.`;
  };
  TL.fireAssistantScout = (s, id) => {
    const c = mine(s), st = s.staff[id]; if (!st) return '';
    TL.book(s, 'exp', 'staff', st.wage * 52 / 1000 * 0.25);
    c.scoutTeam = (c.scoutTeam || []).filter(a => a.id !== id); delete s.staff[id];
    return `${st.name} has left the club.`;
  };

  /* =========================================================
     TRANSFER RUMOURS
     ========================================================= */
  function rumourDay(s, date, rng) {
    const w = TL.windowInfo(s);
    const days = w.open ? TL.daysBetween(date, w.closes) : 99;
    const chance = w.open ? (days <= 7 ? 1.8 : 0.9) : 0.45;
    let n = Math.floor(chance) + (rng.chance(chance - Math.floor(chance)) ? 1 : 0);
    while (n-- > 0) makeRumour(s, rng, w.open);
  }
  function makeRumour(s, rng, open) {
    const pool = [];
    for (const id in s.players) { const p = s.players[id]; if (p.clubId && !p.academy && !p.onLoan && p.ovr >= 70) pool.push(p); }
    if (!pool.length) return;
    const p = rng.weighted(pool, x => Math.pow(x.ovr - 68, 1.6) * (x.listed || x.requested ? 4 : 1) * (x.contract && x.contract.end <= s.season ? 2 : 1) * (x.age <= 21 && x.pot >= 82 ? 2 : 1) * (isHuman(s, x.clubId) ? 1.5 : 1));
    const owner = s.clubs[p.clubId];
    const suitors = Object.values(s.clubs).filter(c => c.id !== owner.id && c.rep >= owner.rep - 4 && c.rep >= p.ovr - 14);
    if (!suitors.length) return;
    const club = rng.weighted(suitors, c => c.rep - 50), club2 = rng.pick(suitors.filter(c => c !== club)) || club;
    const fee = TL.fmtM(TL.askingPrice(s, p)), big = TL.fmtM(TL.roundFee(TL.askingPrice(s, p) * 1.35));
    const T = [
      `${club.name} are monitoring ${p.name}'s situation at ${owner.name}.`,
      `${club.name} scouts watched ${p.name} closely this week.`,
      `${p.name}'s agent has held informal talks with ${club.name}.`,
      `${club.name} have asked ${owner.name} about ${p.name}'s availability.`,
      `${club.name} and ${club2.name} are both keen on ${p.name}.`
    ];
    if (open) T.push(`${club.name} are preparing a ${fee} bid for ${p.name}.`, `${owner.name} want at least ${big} for ${p.name} amid interest from ${club.name}.`, `${club.name} have made ${p.name} their top target this window.`);
    if (p.requested || p.listed) T.push(`${p.name} is unsettled at ${owner.name} and would welcome a move to ${club.name}.`);
    if (p.contract && p.contract.end <= s.season) T.push(`${p.name} could leave ${owner.name} on a free next summer. ${club.name} are interested.`, `${owner.name} are ready to offer ${p.name} a new deal to keep ${club.name} away.`);
    if (p.age <= 21 && p.pot >= 80) T.push(`Wonderkid alert: ${club.name} are tracking ${owner.name}'s teenage ${p.pos} ${p.name}.`);
    if (p.age >= 31) T.push(`${p.name} is weighing up a final big move. ${club.name} could offer him one.`);
    TL.news(s, 'Rumour: ' + rng.pick(T), { pid: p.id, club: club.id, kind: 'rumour' });
  }

  /* =========================================================
     TEAM TALKS & TOUCHLINE SHOUTS
     ========================================================= */
  // Live performance estimate during a match (final ratings are only calculated at full time)
  TL.liveRating = (match, id) => {
    const ps = match.ps[id]; if (!ps) return 6;
    const S = match.sides[ps.side], O = match.sides[match.other(ps.side)], g = TL.POS_GROUP[match.state.players[id].pos];
    let r = 6.4 + Math.sign(S.goals - O.goals) * 0.2 + ps.goals + ps.assists * 0.6 + ps.onT * 0.12 - (ps.shots - ps.onT) * 0.04 + ps.saves * 0.22 - (ps.yellow ? 0.3 : 0);
    if (g === 'DEF' || g === 'GK') r -= 0.22 * Math.min(4, O.goals);
    if (g === 'MID') r += (S.st.xg - O.st.xg) * 0.12;
    return clamp(Math.round(r * 10) / 10, 3.5, 10);
  };
  const teamStrength = (s, t) => t.isNation ? (TL.nationStrength ? TL.nationStrength(s, t) : t.rating) : TL.squadStrength(s, t);
  // Situation for the team talk: score, strength gap, morale and phase ('pre' | 'ht' | 'live')
  TL.talkContext = (s, team, opp, gf, ga, phase, home, match, side) => {
    const fav = teamStrength(s, team) - teamStrength(s, opp);
    const ids = match ? match.sides[side].xi : (team.lineup ? team.lineup.xi : team.players.slice(0, 11));
    const ps = ids.map(id => s.players[id]).filter(Boolean);
    // the scoreline changes the mood in the room during a match
    const morale = clamp((ps.length ? ps.reduce((a, p) => a + p.morale, 0) / ps.length : 60) + (phase === 'pre' ? 0 : clamp((gf - ga) * 8, -30, 15)), 5, 100);
    let best = null, worst = null;
    if (match && phase !== 'pre') {
      const rated = match.onPitch(side).map(o => ({ id: o.id, r: TL.liveRating(match, o.id) })).sort((a, b) => b.r - a.r);
      if (rated.length) { best = rated[0]; worst = rated[rated.length - 1]; }
    }
    return { team, opp, gf, ga, diff: gf - ga, fav, weaker: fav >= 3, stronger: fav <= -3, morale, phase, home, best, worst, angerCount: match ? (match.sides[side].anger || 0) : 0 };
  };
  TL.talkSituation = ctx => {
    const opp = ctx.opp.name;
    if (ctx.phase === 'pre') return ctx.weaker ? `${opp} are weaker on paper. Your players are expected to win.` : ctx.stronger ? `${opp} are stronger on paper. Nobody expects much from you.` : `An evenly matched game against ${opp}.`;
    const sc = `${ctx.gf}–${ctx.ga}`;
    if (ctx.diff < 0) return ctx.weaker ? `Losing ${sc} to ${opp}, a weaker side. The dressing room is silent and heads are down.` : `Losing ${sc} to ${opp}. The players need a reaction.`;
    if (ctx.diff === 0) return ctx.weaker ? `Only ${sc} against ${opp}. This should be a win.` : `Level at ${sc} with ${opp}. Everything to play for.`;
    return ctx.diff >= 2 ? `Cruising at ${sc}. The danger now is complacency.` : `Ahead ${sc}, but it is tight.`;
  };
  const opt = (id, label, tone, quote) => ({ id, label, tone, quote });
  TL.talkOptions = ctx => {
    const o = [], P = id => id && TL.app && TL.app.state ? TL.app.state.players[id] : null;
    if (ctx.phase === 'pre') {
      o.push(opt('calm', 'Relax them', 'calm', 'No pressure today. Go out and enjoy it.'));
      o.push(opt('motivate', 'Fire them up', 'passionate', 'Go out there and win this!'));
      o.push(opt('faith', 'Show faith', 'positive', 'I believe in every one of you.'));
      o.push(opt('plan', 'Stress the game plan', 'tactical', 'Stick to the plan and we win this.'));
      o.push(opt('demand', 'Demand a win', 'demanding', 'Anything less than a win is unacceptable.'));
      if (ctx.weaker) o.push(opt('complacency', 'Warn against complacency', 'demanding', "Don't you dare take this lot lightly."));
      if (ctx.stronger) o.push(opt('underdog', 'Play the underdog card', 'passionate', 'Nobody gives us a chance. Prove them all wrong!'));
      if (ctx.home) o.push(opt('fans', 'Do it for the fans', 'passionate', 'Give this crowd something to shout about!'));
      return o;
    }
    const live = ctx.phase === 'live';
    if (ctx.diff > 0) {
      o.push(opt('praise', live ? 'Applaud them' : 'Praise them', 'positive', 'Brilliant. Keep doing exactly that.'));
      o.push(opt('complacency', 'Stay switched on', 'demanding', "It's not over! Stay switched on!"));
      o.push(opt('more', 'Demand more goals', 'demanding', 'I want more. Kill this game off!'));
      o.push(opt('calm', 'Keep it calm', 'calm', 'Keep the ball, stay calm, see it out.'));
    } else if (ctx.diff === 0) {
      o.push(opt('motivate', 'Ask for more', 'passionate', "There's more in you. Go and win it!"));
      o.push(opt('faith', 'Show faith', 'positive', 'Keep going. The goal will come.'));
      o.push(opt('plan', 'Be patient', 'tactical', 'Be patient and stick to the plan.'));
      o.push(opt('demand', 'Criticise the performance', 'demanding', 'That was not good enough. I expect more.'));
      if (ctx.weaker) o.push(opt('angry', live ? 'Lose your temper' : 'Lose your temper', 'angry', live ? 'You storm to the edge of the technical area, yelling at your players.' : `Level with THIS lot? Wake up, all of you!`));
    } else {
      o.push(opt('angry', live ? 'Explode on the touchline' : 'Hairdryer treatment', 'angry', live ? 'You explode on the touchline, kicking a water bottle and screaming at your players.' : ctx.weaker ? `Losing to THIS lot? You're embarrassing yourselves and this club!` : 'That was a disgrace. Every single one of you!'));
      if (!live) o.push(opt('smash', 'Smash the tea cups', 'angry', 'You hurl a tray of tea cups against the wall. Nobody dares to look at you.'));
      o.push(opt('faith', 'Lift their heads', 'positive', live ? 'Heads up! Keep going!' : "Heads up. There's plenty of time to turn this around."));
      o.push(opt('calm', 'Calm them down', 'calm', 'Calm down. One goal changes everything.'));
      o.push(opt('allin', 'Go all out', 'tactical', 'We go for it now. Nothing to lose!'));
    }
    if (!live && ctx.best && P(ctx.best.id)) o.push(opt('star:' + ctx.best.id, `Praise ${P(ctx.best.id).name}`, 'individual', `${P(ctx.best.id).name}, that was outstanding. More of the same.`));
    if (!live && ctx.worst && P(ctx.worst.id) && ctx.worst.r < 6.6) o.push(opt('blast:' + ctx.worst.id, `Have a go at ${P(ctx.worst.id).name}`, 'individual', `${P(ctx.worst.id).name}, you've been invisible. Sort it out or you're coming off.`));
    return o;
  };
  TL.TONES = { calm: 'Calm', positive: 'Encouraging', passionate: 'Passionate', tactical: 'Tactical', demanding: 'Demanding', angry: 'Angry', individual: 'One-to-one' };
  TL.talkOptionsFor = (s, f, side) => {
    const team = TL.team(s, f[side]), opp = TL.team(s, f[side === 'home' ? 'away' : 'home']);
    const ctx = TL.talkContext(s, team, opp, 0, 0, 'pre', side === 'home' && !f.neutral);
    return { ctx, options: TL.talkOptions(ctx), situation: TL.talkSituation(ctx) };
  };
  TL.matchTalk = (s, match, side, phase) => {
    const S = match.sides[side], O = match.sides[match.other(side)];
    const ctx = TL.talkContext(s, S.club, O.club, S.goals, O.goals, phase, S.home, match, side);
    return { ctx, options: TL.talkOptions(ctx), situation: TL.talkSituation(ctx) };
  };
  // Apply a talk or shout. Returns the reaction line.
  TL.teamTalk = function (s, match, side, id, phase) {
    phase = phase || (match.minute === 0 ? 'pre' : 'ht');
    const S = match.sides[side], O = match.sides[match.other(side)];
    const ctx = TL.talkContext(s, S.club, O.club, S.goals, O.goals, phase, S.home, match, side);
    const options = TL.talkOptions(ctx);
    const chosen = options.find(x => x.id === id) || opt(id, id, 'calm', '');
    const rng = match.rng, m = ctx.morale, d = ctx.diff, rep = s.manager ? s.manager.rep : 50;
    let eff = 0, extra = '';
    const kind = id.split(':')[0];
    switch (kind) {
      case 'calm': eff = (d < 0 && d >= -1) || m < 45 || (phase !== 'pre' && d > 0) ? 0.018 : ctx.stronger ? 0.012 : 0.004; break;
      case 'motivate': eff = ctx.fav < 0 || d <= 0 ? 0.024 : 0.01; break;
      case 'faith': eff = m < 50 || d < 0 ? 0.022 : 0.008; break;
      case 'plan': eff = 0.01 + (S.club.fam && S.club.fam[S.tactics.formation] >= 85 ? 0.006 : 0); break;
      case 'demand': eff = ctx.fav > 3 && d <= 0 ? 0.03 : m < 45 ? -0.025 : 0.004; break;
      case 'complacency': eff = ctx.weaker && d >= 0 ? 0.026 : d > 0 ? 0.015 : -0.005; break;
      case 'underdog': eff = ctx.stronger ? 0.032 : -0.006; break;
      case 'fans': eff = ctx.home ? 0.018 + (S.club.fans ? S.club.fans.mood / 5000 : 0) : -0.005; break;
      case 'praise': eff = d > 0 ? 0.02 : -0.02; break;
      case 'more': eff = d > 0 && ctx.weaker ? 0.015 : 0.006; break;
      case 'allin': eff = 0.012; S.tactics.mentality = Math.min(2, S.tactics.mentality + 1); S.tactics.press = 2; extra = ' The team switches to all-out attack.'; break;
      case 'angry': case 'smash': {
        S.anger = (S.anger || 0) + 1;
        const base = d < 0 ? (ctx.weaker ? 0.048 : 0.03) : d === 0 && ctx.weaker ? 0.024 : -0.02;
        const backfire = (m < 38 ? 0.35 : 0.12) + (S.anger - 1) * 0.25 - (rep >= 70 ? 0.06 : 0);
        eff = rng.chance(Math.max(0.05, backfire)) ? -0.03 : base * (kind === 'smash' ? 1.15 : 1) / (S.anger > 1 ? 1.6 : 1);
        if (phase === 'live' && rng.chance(0.12)) { extra = ' The fourth official warns you to calm down.'; }
        if (eff > 0) for (const o2 of match.onPitch(side)) { const p = s.players[o2.id]; if (p && p.attrs.composure < 8) { extra += ` ${p.name} looks rattled by the outburst.`; break; } }
        break;
      }
      case 'star': { const p = s.players[id.split(':')[1]]; if (p) { p.morale = clamp(p.morale + 10, 5, 100); extra = ` ${p.name} grows another inch.`; } eff = 0.006; break; }
      case 'blast': {
        const p = s.players[id.split(':')[1]];
        if (p) { const tough = p.attrs.composure >= 13 || p.attrs.leadership >= 14 || p.hidden.professionalism >= 15; p.morale = clamp(p.morale + (tough ? 6 : -10), 5, 100); extra = tough ? ` ${p.name} nods. He wants to prove you wrong.` : ` ${p.name} sulks and stares at the floor.`; eff = tough ? 0.008 : -0.004; }
        break;
      }
      default: eff = 0.005;
    }
    eff += rng.normal() * 0.006;
    if (phase === 'live') S.talk = clamp((S.talk || 1) * (1 + eff * 0.5), 0.93, 1.07);
    else S.talk = clamp(1 + eff, 0.93, 1.07);
    match.dirty = true;
    const react = eff > 0.03 ? 'The players are fired up! They charge back out.' : eff > 0.015 ? 'The players look determined.' : eff > 0 ? 'The players seem focused.' : eff > -0.015 ? 'The message has little effect.' : 'That backfired. Some players look rattled.';
    S.mood = eff > 0.03 ? 'Fired up' : eff > 0.015 ? 'Determined' : eff > 0 ? 'Focused' : eff > -0.015 ? 'Flat' : 'Nervous';
    const who = phase === 'live' ? 'Touchline' : phase === 'pre' ? 'Team talk' : 'Dressing room';
    const line = match.say(match.minute, 'talk', `${who}: ${chosen.quote ? (/^You /.test(chosen.quote) ? chosen.quote : `"${chosen.quote}"`) : chosen.label} ${react}${extra}`, side);
    if (line) { line.tone = chosen.tone; if (phase === 'ht') line.disp = 'HT'; if (phase === 'pre') line.disp = 'KO'; }
    return react + extra;
  };
  TL.TALKS = { calm: 'Relax them', motivate: 'Fire them up', faith: 'Show faith', demand: 'Demand a win' };

  /* =========================================================
     POST-MATCH TEAM TALK (praise, blast, single players out)
     Changes morale now and gives a small lift (or dip) for the next match.
     ========================================================= */
  const postCtx = (s, f, teamId, match) => {
    const r = TL.userResult(s, f, teamId), team = TL.team(s, teamId);
    const side = f.home === teamId ? 'home' : 'away', other = side === 'home' ? 'away' : 'home';
    const fav = teamStrength(s, team) - teamStrength(s, r.opp);
    const xgDiff = f.stats ? f.stats[side].xg - f.stats[other].xg : 0;
    const rated = match ? Object.values(match.ps).filter(ps => ps.side === side && (ps.starter || ps.mins >= 20)).sort((a, b) => b.rating - a.rating) : [];
    const ids = rated.length ? rated.map(x => x.id) : (team.lineup ? team.lineup.xi : []).filter(Boolean);
    const ps = ids.map(id => s.players[id]).filter(Boolean);
    const morale = ps.length ? ps.reduce((a, p) => a + p.morale, 0) / ps.length : 60;
    return { r, team, side, fav, weaker: fav >= 3, stronger: fav <= -3, xgDiff, margin: r.gf - r.ga, best: rated[0], worst: rated[rated.length - 1], ids, morale, opp: r.opp };
  };
  TL.postTalkInfo = (s, f, teamId, match) => {
    const c = postCtx(s, f, teamId, match), o = [], res = c.r.res, P = id => s.players[id];
    if (res === 'W') {
      o.push(opt('praise', 'Outstanding, enjoy it', 'positive', 'Outstanding. Enjoy it tonight, you earned it.'));
      o.push(opt('more', 'Good, but I want more', 'demanding', 'Good win. But I know there is more in you.'));
      o.push(opt('grounded', 'Keep feet on the ground', 'calm', 'Well done. Now forget it and focus on the next one.'));
      if (c.margin === 1 && c.weaker) o.push(opt('lucky', 'We got away with one', 'demanding', 'We got away with one today. That was sloppy.'));
    } else if (res === 'D') {
      o.push(opt('point', 'A decent point', 'positive', 'A decent point. Well played.'));
      o.push(opt('dropped', 'Two points dropped', 'demanding', 'Two points dropped. That is not good enough.'));
      if (c.stronger) o.push(opt('fight', 'Proud of the fight', 'positive', 'I loved the fight out there. Proud of you.'));
      if (c.xgDiff > 0.4) o.push(opt('unlucky', 'We deserved more', 'calm', 'We deserved to win that. Keep playing like that.'));
      if (c.weaker) o.push(opt('furious', 'Lose your temper', 'angry', 'You slam the dressing-room door: "A draw against THEM? Pathetic!"'));
    } else {
      o.push(opt('headsup', 'Heads up, we go again', 'positive', 'Heads up. We learn from it and go again.'));
      o.push(opt('unlucky', 'We were unlucky', 'calm', 'We were unlucky today. Keep doing that and the results will come.'));
      o.push(opt('unacceptable', 'That was unacceptable', 'demanding', 'That was unacceptable. Every one of you let this club down.'));
      o.push(opt('furious', 'Blast them', 'angry', c.weaker ? 'You kick the kit basket across the room: "Beaten by THEM? You should be ashamed!"' : 'You tear into the players. Nobody dares to look up.'));
      o.push(opt('extra', 'Extra training this week', 'demanding', 'Extra training this week. Nobody goes home early.'));
    }
    if (c.best && c.best.rating >= 7 && P(c.best.id)) o.push(opt('star:' + c.best.id, `Praise ${P(c.best.id).name}`, 'individual', `${P(c.best.id).name}, you were magnificent today.`));
    if (c.worst && c.worst.rating < 6.3 && P(c.worst.id)) o.push(opt('blast:' + c.worst.id, `Blast ${P(c.worst.id).name}`, 'individual', `${P(c.worst.id).name}, that was nowhere near good enough.`));
    o.push(opt('none', 'Say nothing', 'calm', 'You leave without a word.'));
    const sit = res === 'W' ? (c.margin >= 3 ? `A ${c.r.gf}–${c.r.ga} thrashing of ${c.opp.name}. The dressing room is buzzing.` : `A ${c.r.gf}–${c.r.ga} win over ${c.opp.name}.`)
      : res === 'D' ? `${c.r.gf}–${c.r.ga} against ${c.opp.name}${c.weaker ? ', a side you should beat' : c.stronger ? ', a stronger side' : ''}.`
      : `Beaten ${c.r.ga}–${c.r.gf} by ${c.opp.name}${c.weaker ? ', a weaker side. Heads are down' : ''}.`;
    return { ctx: c, options: o, situation: sit };
  };
  TL.postTalk = (s, f, teamId, id, match) => {
    const c = postCtx(s, f, teamId, match), team = c.team, res = c.r.res;
    const rng = new Rng(parseInt(TL.checksum(f.id + id + s.date), 16));
    const kind = id.split(':')[0], lines = [];
    let mor = 0, lift = 1;
    const squad = team.isNation ? c.ids : team.players;
    const each = fn => { for (const pid of squad) { const p = s.players[pid]; if (p) fn(p); } };
    switch (kind) {
      case 'praise': mor = 5; lift = c.weaker && c.margin === 1 ? 0.996 : 1.008; if (lift < 1) lines.push('One or two players look a little too pleased with themselves.'); break;
      case 'more': mor = 1; lift = 1.012; each(p => { if (p.hidden.professionalism >= 14) p.morale = clamp(p.morale + 2, 5, 100); }); lines.push('The professionals in the squad nod in agreement.'); break;
      case 'grounded': mor = 2; lift = 1.008; break;
      case 'lucky': mor = -1; lift = 1.015; lines.push('The players know you are right.'); break;
      case 'point': mor = c.stronger ? 4 : c.weaker ? -1 : 2; lift = 1.004; break;
      case 'dropped': mor = c.weaker ? -2 : -4; lift = c.weaker ? 1.015 : 1.004; if (!c.weaker) lines.push('Some players feel that was harsh.'); break;
      case 'fight': mor = 5; lift = 1.01; break;
      case 'unlucky': mor = c.xgDiff > 0.4 ? 4 : -3; lift = c.xgDiff > 0.4 ? 1.006 : 0.997; if (c.xgDiff <= 0.4) lines.push('The players know they were second best. It rings hollow.'); break;
      case 'headsup': mor = c.morale < 50 ? 5 : 3; lift = 1.004; break;
      case 'unacceptable': mor = -4; lift = c.weaker ? 1.02 : 1.01; each(p => { if (p.attrs.composure < 9 && p.hidden.professionalism < 10) p.morale = clamp(p.morale - 4, 5, 100); }); break;
      case 'furious': {
        const recent = team.lastFurious && TL.daysBetween(team.lastFurious, s.date) < 30;
        team.lastFurious = s.date;
        const backfire = recent || (c.morale < 35 && rng.chance(0.5));
        if (backfire) { mor = -10; lift = 0.99; lines.push(recent ? 'Another outburst so soon. The players stop listening.' : 'The squad is already low. Some players turn against you.'); }
        else { mor = -6; lift = c.weaker || res === 'D' ? 1.03 : 1.018; lines.push('Nobody says a word. Next time out, they will want to prove you wrong.'); }
        break;
      }
      case 'extra': mor = -5; lift = 1.012; each(p => { p.cond = Math.max(40, p.cond - 5); if (p.hidden.professionalism >= 15) p.morale = clamp(p.morale + 3, 5, 100); }); lines.push('Tired legs, but the hard workers respect it.'); break;
      case 'star': { const p = s.players[id.split(':')[1]]; if (p) { p.morale = clamp(p.morale + 9, 5, 100); lines.push(`${p.name} is delighted.`); } mor = 1; break; }
      case 'blast': {
        const p = s.players[id.split(':')[1]];
        if (p) {
          const tough = p.attrs.composure >= 13 || p.attrs.leadership >= 14 || p.hidden.professionalism >= 15;
          if (tough) { p.morale = clamp(p.morale + 3, 5, 100); lines.push(`${p.name} takes it on the chin and promises a reaction.`); lift = 1.004; }
          else {
            p.morale = clamp(p.morale - 12, 5, 100); lines.push(`${p.name} storms off to the showers.`);
            const top = !team.isNation && team.players.map(x => s.players[x]).sort((a, b) => b.ovr - a.ovr).slice(0, 4).includes(p);
            if (top && !p.requested && rng.chance(0.15)) { p.requested = true; lines.push(`${p.name}'s agent is already making calls. He wants to leave.`); }
          }
        }
        break;
      }
      default: break;
    }
    if (mor) each(p => { p.morale = clamp(p.morale + mor, 5, 100); });
    // the captain's reaction
    const cap = !team.isNation && team.captain && s.players[team.captain];
    if (cap && kind !== 'none' && cap.attrs.leadership >= 14) lines.push(mor < 0 ? `Captain ${cap.name} backs you and gets the group together.` : `Captain ${cap.name} echoes your message.`);
    if (cap && mor < 0 && cap.attrs.leadership >= 14) each(p => { p.morale = clamp(p.morale + 2, 5, 100); });
    team.postLift = { mult: clamp(lift, 0.97, 1.035), date: s.date };
    f.postTalk = f.postTalk || {}; f.postTalk[teamId] = id;
    const react = mor >= 4 ? 'The players are lifted.' : mor > 0 ? 'The players take it well.' : mor === 0 ? (kind === 'none' ? 'The players are left to their own thoughts.' : 'The message sinks in.') : mor >= -5 ? 'The room goes quiet. The message has landed.' : 'The atmosphere is tense.';
    const next = lift > 1.015 ? 'They will be fired up for the next match.' : lift > 1.003 ? 'Expect a small lift in the next match.' : lift < 0.999 ? 'It could hurt the next performance.' : '';
    return { react, lines: lines.concat(next ? [next] : []) };
  };
  // A post-match lift lasts until the team's next match is over
  const clearLift = (s, f) => { for (const id of [f.home, f.away]) { const t = TL.team(s, id); if (t && t.postLift && t.postLift.date < f.date) delete t.postLift; } };
  const prevAfterClub = TL.afterClubMatch;
  TL.afterClubMatch = function (s, f) { clearLift(s, f); return prevAfterClub(s, f); };
  const prevAfterNation = TL.afterNationMatch;
  TL.afterNationMatch = function (s, f) { clearLift(s, f); return prevAfterNation ? prevAfterNation(s, f) : undefined; };
})();
