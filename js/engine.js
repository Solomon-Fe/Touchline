/* Touchline — simulation engine.
   Pure game logic: no DOM access. All randomness flows through TL.Rng so a saved
   seed reproduces the same results. Tuning numbers live in TL.TUNING. */
(function () {
  const TL = window.TL;

  /* ---------- Tuning (edit to rebalance; no logic changes needed) ---------- */
  TL.TUNING = {
    chancePerMinute: 0.245,     // base chance an attacking minute produces a shot
    strengthExponent: 1.7,      // how strongly attack/defence ratio shifts shot volume
    possessionExponent: 2.5,    // how strongly midfield strength decides possession
    finishBase: 0.6,          // shot conversion = xG × (finishBase + finishing skill / finishScale)
    finishScale: 55,
    homeAdvantage: 1.04,
    offsideShare: 0.10,
    penaltyShare: 0.022,
    onTargetShare: 0.25,       // chance a non-scoring shot still hits the target
    foulPerMinute: 0.22,
    yellowPerFoul: 0.11,
    redPerFoul: 0.0022,
    secondYellowCaution: 0.55,  // booked players commit fewer bookable fouls
    injuryPerMinute: 0.0035,
    fatigueBase: 0.18,
    fatigueStamina: 0.012,
    dailyRecovery: 7,
    yellowBanThreshold: 5
  };

  /* ---------- Seeded RNG (mulberry32) ---------- */
  class Rng {
    constructor(seed) { this.s = seed >>> 0; }
    next() {
      let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    range(a, b) { return a + this.next() * (b - a); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    normal() { let u = 0, v = 0; while (!u) u = this.next(); while (!v) v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    weighted(items, wfn) {
      let total = 0; const ws = items.map(i => { const w = Math.max(0, wfn(i)); total += w; return w; });
      if (total <= 0) return items[0];
      let r = this.next() * total;
      for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
      return items[items.length - 1];
    }
    shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  }
  TL.Rng = Rng;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  TL.clamp = clamp;
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---------- Positions, formations, familiarity ---------- */
  TL.POSITIONS = ['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'];
  TL.POS_GROUP = { GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', DM: 'MID', CM: 'MID', AM: 'MID', LW: 'ATT', RW: 'ATT', ST: 'ATT' };
  const FAM = {
    GK: { GK: 1 },
    CB: { CB: 1, RB: .8, LB: .8, DM: .82 },
    LB: { LB: 1, RB: .85, CB: .8, LW: .82, DM: .7, CM: .65 },
    RB: { RB: 1, LB: .85, CB: .8, RW: .82, DM: .7, CM: .65 },
    DM: { DM: 1, CM: .93, CB: .82, AM: .75, RB: .65, LB: .65 },
    CM: { CM: 1, DM: .9, AM: .9, LW: .72, RW: .72 },
    AM: { AM: 1, CM: .88, LW: .86, RW: .86, ST: .82, DM: .7 },
    LW: { LW: 1, RW: .9, AM: .85, ST: .8, LB: .66, CM: .7 },
    RW: { RW: 1, LW: .9, AM: .85, ST: .8, RB: .66, CM: .7 },
    ST: { ST: 1, AM: .8, LW: .78, RW: .78, CM: .6 }
  };
  TL.familiarity = (playerPos, slotPos) => {
    if (playerPos === slotPos) return 1;
    if (playerPos === 'GK' || slotPos === 'GK') return 0.2;
    return (FAM[playerPos] && FAM[playerPos][slotPos]) || 0.5;
  };

  // x: 0 (left touchline) – 100 (right); y: 0 (own goal) – 100 (opposition goal)
  TL.FORMATIONS = {
    '4-4-2':   [['GK',50,5],['RB',87,25],['CB',63,20],['CB',37,20],['LB',13,25],['RW',87,55],['CM',62,48],['CM',38,48],['LW',13,55],['ST',62,80],['ST',38,80]],
    '4-3-3':   [['GK',50,5],['RB',87,25],['CB',63,20],['CB',37,20],['LB',13,25],['DM',50,38],['CM',70,53],['CM',30,53],['RW',85,78],['ST',50,85],['LW',15,78]],
    '4-2-3-1': [['GK',50,5],['RB',87,25],['CB',63,20],['CB',37,20],['LB',13,25],['DM',64,40],['DM',36,40],['RW',85,66],['AM',50,63],['LW',15,66],['ST',50,86]],
    '4-1-4-1': [['GK',50,5],['RB',87,25],['CB',63,20],['CB',37,20],['LB',13,25],['DM',50,37],['RW',87,60],['CM',63,55],['CM',37,55],['LW',13,60],['ST',50,85]],
    '3-5-2':   [['GK',50,5],['CB',72,21],['CB',50,18],['CB',28,21],['RB',90,50],['DM',50,40],['CM',68,56],['CM',32,56],['LB',10,50],['ST',62,82],['ST',38,82]],
    '5-3-2':   [['GK',50,5],['RB',90,32],['CB',70,20],['CB',50,17],['CB',30,20],['LB',10,32],['CM',70,50],['DM',50,44],['CM',30,50],['ST',62,80],['ST',38,80]],
    // back four
    '4-4-1-1': [['GK',50,5],['RB',87,25],['CB',63,20],['CB',37,20],['LB',13,25],['RW',87,55],['CM',62,47],['CM',38,47],['LW',13,55],['AM',50,68],['ST',50,85]],
    '4-4-2 diamond': [['GK',50,5],['RB',87,25],['CB',63,20],['CB',37,20],['LB',13,25],['DM',50,38],['CM',70,52],['CM',30,52],['AM',50,66],['ST',62,83],['ST',38,83]],
    '4-3-1-2': [['GK',50,5],['RB',87,25],['CB',63,20],['CB',37,20],['LB',13,25],['CM',70,48],['DM',50,42],['CM',30,48],['AM',50,65],['ST',62,83],['ST',38,83]],
    '4-3-2-1': [['GK',50,5],['RB',87,25],['CB',63,20],['CB',37,20],['LB',13,25],['CM',70,46],['DM',50,40],['CM',30,46],['AM',66,66],['AM',34,66],['ST',50,85]],
    '4-2-2-2': [['GK',50,5],['RB',87,25],['CB',63,20],['CB',37,20],['LB',13,25],['DM',64,40],['DM',36,40],['AM',78,64],['AM',22,64],['ST',62,84],['ST',38,84]],
    '4-2-4':   [['GK',50,5],['RB',87,25],['CB',63,20],['CB',37,20],['LB',13,25],['CM',62,46],['CM',38,46],['RW',86,74],['ST',60,84],['ST',40,84],['LW',14,74]],
    '4-5-1':   [['GK',50,5],['RB',87,25],['CB',63,20],['CB',37,20],['LB',13,25],['RW',87,55],['CM',68,50],['DM',50,42],['CM',32,50],['LW',13,55],['ST',50,84]],
    '4-1-2-1-2 narrow': [['GK',50,5],['RB',85,26],['CB',63,20],['CB',37,20],['LB',15,26],['DM',50,37],['CM',66,52],['CM',34,52],['AM',50,67],['ST',60,84],['ST',40,84]],
    '4-2-1-3': [['GK',50,5],['RB',87,25],['CB',63,20],['CB',37,20],['LB',13,25],['DM',64,39],['DM',36,39],['AM',50,60],['RW',85,78],['ST',50,86],['LW',15,78]],
    '4-3-3 attacking': [['GK',50,5],['RB',87,27],['CB',63,20],['CB',37,20],['LB',13,27],['CM',50,46],['AM',68,62],['AM',32,62],['RW',86,78],['ST',50,86],['LW',14,78]],
    '4-1-3-2': [['GK',50,5],['RB',87,25],['CB',63,20],['CB',37,20],['LB',13,25],['DM',50,38],['RW',84,58],['CM',50,54],['LW',16,58],['ST',62,83],['ST',38,83]],
    // back three
    '3-4-3':   [['GK',50,5],['CB',72,21],['CB',50,18],['CB',28,21],['RB',89,48],['CM',62,47],['CM',38,47],['LB',11,48],['RW',82,78],['ST',50,86],['LW',18,78]],
    '3-4-2-1': [['GK',50,5],['CB',72,21],['CB',50,18],['CB',28,21],['RB',89,48],['CM',62,46],['CM',38,46],['LB',11,48],['AM',66,66],['AM',34,66],['ST',50,86]],
    '3-4-1-2': [['GK',50,5],['CB',72,21],['CB',50,18],['CB',28,21],['RB',89,48],['CM',62,46],['CM',38,46],['LB',11,48],['AM',50,64],['ST',62,84],['ST',38,84]],
    '3-5-1-1': [['GK',50,5],['CB',72,21],['CB',50,18],['CB',28,21],['RB',90,50],['CM',68,52],['DM',50,40],['CM',32,52],['LB',10,50],['AM',50,68],['ST',50,86]],
    '3-1-4-2': [['GK',50,5],['CB',72,21],['CB',50,18],['CB',28,21],['DM',50,34],['RW',88,56],['CM',62,52],['CM',38,52],['LW',12,56],['ST',62,83],['ST',38,83]],
    '3-3-3-1': [['GK',50,5],['CB',72,21],['CB',50,18],['CB',28,21],['DM',72,40],['DM',50,38],['DM',28,40],['RW',82,66],['AM',50,64],['LW',18,66],['ST',50,86]],
    // back five
    '5-4-1':   [['GK',50,5],['RB',90,32],['CB',70,20],['CB',50,17],['CB',30,20],['LB',10,32],['RW',84,54],['CM',62,48],['CM',38,48],['LW',16,54],['ST',50,82]],
    '5-2-3':   [['GK',50,5],['RB',90,33],['CB',70,20],['CB',50,17],['CB',30,20],['LB',10,33],['CM',62,48],['CM',38,48],['RW',82,74],['ST',50,84],['LW',18,74]],
    '5-2-1-2': [['GK',50,5],['RB',90,33],['CB',70,20],['CB',50,17],['CB',30,20],['LB',10,33],['CM',62,47],['CM',38,47],['AM',50,63],['ST',62,83],['ST',38,83]]
  };
  // computer-managed teams choose from the common shapes (keeps team selection fast)
  TL.AI_FORMATIONS = ['4-4-2', '4-3-3', '4-2-3-1', '4-1-4-1', '3-5-2', '5-3-2', '4-4-1-1', '3-4-3', '4-3-1-2', '5-4-1'];
  // grouped for menus
  TL.FORMATION_GROUPS = { 'Back four': ['4-4-2', '4-3-3', '4-2-3-1', '4-1-4-1', '4-4-1-1', '4-4-2 diamond', '4-3-1-2', '4-3-2-1', '4-2-2-2', '4-2-4', '4-5-1', '4-1-2-1-2 narrow', '4-2-1-3', '4-3-3 attacking', '4-1-3-2'], 'Back three': ['3-5-2', '3-4-3', '3-4-2-1', '3-4-1-2', '3-5-1-1', '3-1-4-2', '3-3-3-1'], 'Back five': ['5-3-2', '5-4-1', '5-2-3', '5-2-1-2'] };
  TL.formationOptions = cur => Object.entries(TL.FORMATION_GROUPS).map(([g, list]) => `<optgroup label="${g}">${list.map(f => `<option ${f === cur ? 'selected' : ''}>${f}</option>`).join('')}</optgroup>`).join('');

  /* ---------- Attributes ---------- */
  TL.ATTRS = {
    Technical: ['finishing', 'passing', 'dribbling', 'crossing', 'firstTouch', 'heading', 'tackling', 'setPieces'],
    Mental: ['vision', 'composure', 'decisions', 'positioning', 'workRate', 'leadership', 'aggression', 'teamwork'],
    Physical: ['pace', 'acceleration', 'stamina', 'strength', 'agility', 'jumping'],
    Goalkeeping: ['reflexes', 'handling', 'oneOnOnes', 'aerialReach', 'kicking']
  };
  TL.ATTR_LABEL = { finishing: 'Finishing', passing: 'Passing', dribbling: 'Dribbling', crossing: 'Crossing', firstTouch: 'First touch', heading: 'Heading', tackling: 'Tackling', setPieces: 'Set pieces', vision: 'Vision', composure: 'Composure', decisions: 'Decisions', positioning: 'Positioning', workRate: 'Work rate', leadership: 'Leadership', aggression: 'Aggression', teamwork: 'Teamwork', pace: 'Pace', acceleration: 'Acceleration', stamina: 'Stamina', strength: 'Strength', agility: 'Agility', jumping: 'Jumping', reflexes: 'Reflexes', handling: 'Handling', oneOnOnes: 'One on ones', aerialReach: 'Aerial reach', kicking: 'Kicking' };
  const PROFILE = {
    ST: { finishing: 3, heading: 1, firstTouch: 1, composure: 1, pace: 1, tackling: -6, positioning: -3, crossing: -1, vision: -1 },
    LW: { dribbling: 3, pace: 3, acceleration: 3, crossing: 2, agility: 2, tackling: -5, heading: -3, strength: -2, positioning: -3 },
    RW: { dribbling: 3, pace: 3, acceleration: 3, crossing: 2, agility: 2, tackling: -5, heading: -3, strength: -2, positioning: -3 },
    AM: { vision: 3, passing: 2, dribbling: 2, firstTouch: 2, tackling: -4, heading: -3, strength: -2, positioning: -2 },
    CM: { passing: 2, vision: 1, stamina: 2, workRate: 2, teamwork: 1, decisions: 1, finishing: -2, crossing: -1 },
    DM: { tackling: 2, positioning: 2, passing: 1, strength: 1, decisions: 1, finishing: -4, dribbling: -2, pace: -1, crossing: -2 },
    CB: { tackling: 3, heading: 3, positioning: 3, strength: 2, jumping: 2, finishing: -6, dribbling: -4, crossing: -4, vision: -3, pace: -1, agility: -1 },
    LB: { pace: 2, stamina: 2, crossing: 1, tackling: 1, finishing: -5, heading: -1, vision: -2 },
    RB: { pace: 2, stamina: 2, crossing: 1, tackling: 1, finishing: -5, heading: -1, vision: -2 },
    GK: { reflexes: 3, handling: 2, oneOnOnes: 2, aerialReach: 2, kicking: 0, composure: 1, positioning: 2 }
  };

  function makeAttrs(pos, ovr, rng) {
    const base = (ovr - 30) / 3.4;
    const prof = PROFILE[pos] || {};
    const a = {};
    for (const group in TL.ATTRS) {
      for (const k of TL.ATTRS[group]) {
        let v;
        if (group === 'Goalkeeping') v = pos === 'GK' ? base + (prof[k] || 0) + rng.normal() * 1.1 : rng.int(1, 4);
        else if (pos === 'GK' && !['composure', 'decisions', 'positioning', 'leadership', 'teamwork', 'agility', 'jumping', 'strength', 'stamina'].includes(k)) v = base - 7 + rng.normal() * 1.5;
        else v = base + (prof[k] || 0) + rng.normal() * 1.4;
        a[k] = clamp(Math.round(v), 1, 20);
      }
    }
    return a;
  }

  function potentialFor(age, ovr, rng) {
    let add = 0;
    if (age <= 18) add = rng.int(6, 18);
    else if (age <= 20) add = rng.int(4, 13);
    else if (age <= 23) add = rng.int(2, 8);
    else if (age <= 26) add = rng.int(0, 4);
    return clamp(ovr + add, ovr, 96);
  }

  TL.marketValue = p => {
    let v = 0.15 * Math.exp(0.19 * (p.ovr - 55));
    const a = p.age;
    v *= a < 21 ? 1.6 : a < 25 ? 1.4 : a < 29 ? 1.0 : a < 31 ? 0.7 : a < 33 ? 0.45 : 0.25;
    v *= 1 + Math.max(0, p.pot - p.ovr) * 0.03;
    if (v >= 10) return Math.round(v);
    return Math.round(v * 10) / 10;
  };

  function newStats() { return { apps: 0, starts: 0, goals: 0, assists: 0, ratingSum: 0, rated: 0, motm: 0, yellows: 0, reds: 0, cleanSheets: 0 }; }
  TL.newStats = newStats;

  TL.createPlayer = function (o, rng) {
    const p = {
      id: o.id, name: o.name, pos: o.pos, age: o.age, nat: o.nat, ovr: o.ovr, clubId: o.clubId,
      pot: o.pot || potentialFor(o.age, o.ovr, rng),
      foot: rng.chance(0.24) ? 'Left' : (rng.chance(0.05) ? 'Both' : 'Right'),
      height: o.pos === 'GK' || o.pos === 'CB' ? rng.int(184, 198) : rng.int(168, 188),
      attrs: makeAttrs(o.pos, o.ovr, rng),
      hidden: { consistency: rng.int(6, 20), bigMatch: rng.int(5, 20), professionalism: rng.int(5, 20), injuryProne: rng.int(1, 16) },
      morale: 65, cond: 100, form: [], injury: 0, injuryName: '', ban: 0, yellowAcc: 0,
      stats: newStats(), career: [], youth: !!o.youth
    };
    if (p.foot === 'Left' && (p.pos === 'RB' || p.pos === 'RW')) p.foot = rng.chance(0.5) ? 'Right' : 'Left';
    if (p.pos === 'LB' && rng.chance(0.7)) p.foot = 'Left';
    p.weight = Math.round(p.height - 105 + rng.int(-4, 6));
    p.value = TL.marketValue(p);
    return p;
  };

  // Nationality mix for a club's generated players: mostly local, some foreign.
  TL.localNat = (state, club, rng) => {
    const lg = club && TL.DATA.leagues.find(l => l.id === club.leagueId);
    if (lg && lg.gen) return rng.weighted(Object.keys(lg.gen.nats), k => lg.gen.nats[k]);
    const home = club ? club.country : 'ENG';
    return rng.chance(0.72) ? home : rng.pick(['FRA', 'BRA', 'ESP', 'NED', 'NGA', 'GER', 'POR', 'ARG', 'SEN', 'CIV', 'BEL', 'DEN']);
  };
  TL.randomName = (nat, rng) => { const n = TL.namePoolFor ? TL.namePoolFor(nat) : (TL.NAMES[nat] || TL.NAMES.ENG); return rng.pick(n.f) + ' ' + rng.pick(n.l); };

  TL.generateYouth = function (state, clubId, rng, opts) {
    opts = opts || {};
    const club = clubId && state.clubs[clubId];
    const nat = opts.nat || TL.localNat(state, club, rng);
    const pos = opts.pos || rng.pick(['GK', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'AM', 'LW', 'RW', 'ST', 'ST']);
    const age = opts.age || rng.int(16, 18);
    const ovr = opts.ovr != null ? opts.ovr : rng.int(44, 60) + (opts.boost || 0);
    const id = (opts.prefix || 'Y') + (state.nextId++);
    const p = TL.createPlayer({ id, name: opts.name || TL.randomName(nat, rng), pos, age, nat, ovr: clamp(ovr, 30, 95), clubId: clubId || null, youth: opts.youth !== false, pot: opts.pot || clamp(ovr + rng.int(age <= 19 ? 10 : 2, age <= 19 ? 34 : 10), 50, 94) }, rng);
    p.contract = club ? { wage: TL.wageFor ? Math.max(1, TL.wageFor(p, club.rep, club)) : 1, end: state.season + (opts.years || 3), clause: null } : null;
    p.transfers = []; p.prog = 0; p.hist = [[state.date, p.ovr]];
    state.players[id] = p;
    if (club) club.players.push(id);
    return p;
  };

  TL.ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));

  TL.squadStrength = (state, club) => {
    const ovrs = club.players.map(id => state.players[id].ovr).sort((a, b) => b - a).slice(0, 15);
    return ovrs.reduce((s, v) => s + v, 0) / ovrs.length;
  };

  TL.bestFormation = (state, club) => {
    let best = '4-3-3', bestScore = -1;
    for (const f of TL.AI_FORMATIONS) {
      const xi = TL.pickXI(state, club, f);
      const score = xi.reduce((s, id, i) => s + (id ? state.players[id].ovr * TL.familiarity(state.players[id].pos, TL.FORMATIONS[f][i][0]) : 0), 0);
      if (score > bestScore + 2) { bestScore = score; best = f; }
    }
    return best;
  };

  TL.available = p => p && p.injury <= 0 && p.ban <= 0 && !p.onLoan;

  // Greedy XI selection: fill the hardest-to-cover slots first.
  TL.pickXI = function (state, club, formation, opts) {
    const slots = TL.FORMATIONS[formation];
    const pool = club.players.map(id => state.players[id]).filter(TL.available);
    const used = new Set();
    const xi = new Array(slots.length).fill(null);
    const order = slots.map((s, i) => i).sort((a, b) => (slots[a][0] === 'GK' ? -1 : 0) - (slots[b][0] === 'GK' ? -1 : 0));
    const condWeight = opts && opts.ignoreCondition ? 0 : 1;
    for (const i of order) {
      let best = null, bestV = -1;
      for (const p of pool) {
        if (used.has(p.id)) continue;
        const v = p.ovr * TL.familiarity(p.pos, slots[i][0]) * (1 - condWeight * Math.max(0, 75 - p.cond) / 100);
        if (v > bestV) { bestV = v; best = p; }
      }
      if (best) { xi[i] = best.id; used.add(best.id); }
    }
    return xi;
  };

  TL.pickBench = function (state, club, xi) {
    const used = new Set(xi);
    const rest = club.players.map(id => state.players[id]).filter(p => TL.available(p) && !used.has(p.id)).sort((a, b) => b.ovr - a.ovr);
    const bench = [];
    const gk = rest.find(p => p.pos === 'GK');
    if (gk) bench.push(gk.id);
    for (const p of rest) { if (bench.length >= 9) break; if (!bench.includes(p.id)) bench.push(p.id); }
    return bench;
  };

  TL.autoLineup = function (state, club) {
    const xi = TL.pickXI(state, club, club.tactics.formation);
    club.lineup = { xi, bench: TL.pickBench(state, club, xi) };
  };

  // Keep the user's chosen XI but replace anyone injured or suspended.
  TL.validateLineup = function (state, club) {
    const changes = [];
    if (!club.lineup || club.lineup.xi.length !== TL.FORMATIONS[club.tactics.formation].length) { TL.autoLineup(state, club); return changes; }
    const slots = TL.FORMATIONS[club.tactics.formation];
    const used = new Set(club.lineup.xi.filter(id => id && TL.available(state.players[id])));
    club.lineup.xi = club.lineup.xi.map((id, i) => {
      if (id && TL.available(state.players[id])) return id;
      let best = null, bestV = -1;
      for (const pid of club.players) {
        const p = state.players[pid];
        if (used.has(pid) || !TL.available(p)) continue;
        const v = p.ovr * TL.familiarity(p.pos, slots[i][0]);
        if (v > bestV) { bestV = v; best = p; }
      }
      if (best) { used.add(best.id); changes.push({ out: id, in: best.id }); return best.id; }
      return null;
    });
    club.lineup.bench = (club.lineup.bench || []).filter(id => TL.available(state.players[id]) && !used.has(id));
    if (club.lineup.bench.length < 7) {
      for (const id of TL.pickBench(state, club, club.lineup.xi)) { if (club.lineup.bench.length >= 9) break; if (!club.lineup.bench.includes(id)) club.lineup.bench.push(id); }
    }
    return changes;
  };

  /* ---------- Match engine ---------- */
  const SHOT_W = { ST: 2.5, LW: 1.9, RW: 1.9, AM: 1.6, CM: .95, DM: .4, LB: .35, RB: .35, CB: .3, GK: 0 };
  const HEAD_W = { ST: 3, CB: 1.6, LW: .6, RW: .6, AM: .6, CM: .8, DM: .8, LB: .4, RB: .4, GK: 0 };
  const ASSIST_W = { AM: 2.6, LW: 2.2, RW: 2.2, CM: 1.7, ST: 1.2, LB: 1.1, RB: 1.1, DM: .7, CB: .3, GK: .05 };
  const ATT_W = { ST: 1, LW: .9, RW: .9, AM: .85, CM: .45, DM: .2, LB: .25, RB: .25, CB: .05, GK: 0 };
  const MID_W = { DM: 1, CM: 1, AM: .8, LW: .4, RW: .4, LB: .3, RB: .3, ST: .25, CB: .2, GK: 0 };
  const DEF_W = { CB: 1, LB: .8, RB: .8, DM: .7, CM: .35, AM: .1, LW: .1, RW: .1, ST: .05, GK: 0 };
  const FOUL_W = { CB: 1.4, DM: 1.6, CM: 1.1, LB: 1.1, RB: 1.1, AM: .6, LW: .5, RW: .5, ST: .7, GK: .1 };

  const INJURIES = [['Twisted ankle', 4, 12], ['Hamstring strain', 10, 28], ['Calf strain', 7, 20], ['Knee ligament damage', 30, 70], ['Bruised thigh', 2, 6], ['Groin strain', 8, 21], ['Concussion', 6, 12], ['Broken toe', 20, 40]];

  class Match {
    constructor(state, fixture, rng, opts) {
      this.state = state; this.f = fixture; this.rng = rng; this.T = TL.TUNING;
      this.userSide = opts && opts.userSide; // 'home' | 'away' | null
      this.fast = !!(opts && opts.fast);      // background matches skip commentary-only work
      this.minute = 0; this.half = 1; this.done = false;
      this.firstHalfEnd = 45 + rng.int(1, 4); this.secondHalfEnd = 90 + rng.int(2, 6);
      this.events = []; this.lines = [];
      this.sides = { home: this.makeSide(fixture.home, true), away: this.makeSide(fixture.away, false) };
      this.ps = {};
      for (const k of ['home', 'away']) for (const id of this.sides[k].xi) this.ps[id] = this.pstate(id, k, true);
      this.ref = rng.range(0.8, 1.25);
      this.dirty = true;
      const H = TL.team(state, fixture.home);
      if (fixture.neutral) {
        this.attendance = Math.round(clamp(45000 + rng.range(-8000, 25000), 20000, 90000));
        this.say(0, 'ko', `Kick-off at ${fixture.venue || 'a neutral venue'}. ${this.attendance.toLocaleString('en-GB')} in attendance.`);
      } else {
        this.attendance = TL.attendance && H.finance ? TL.attendance(state, H, rng) : Math.round(H.cap * clamp(0.82 + rng.range(0, 0.18) + (H.rep - 70) / 400, 0.6, 1));
        this.say(0, 'ko', `Kick-off at ${H.stadium}. ${this.attendance.toLocaleString('en-GB')} in attendance.`);
      }
      if (fixture.leg === 2) this.say(0, 'flavour', `Second leg. First leg: ${H.name} ${fixture.aggHome}–${fixture.aggAway} on aggregate going in.`);
    }
    makeSide(clubId, home) {
      const club = TL.team(this.state, clubId);
      if (club.isNation && TL.ensureSquad) TL.ensureSquad(this.state, club, this.rng);
      if (!club.lineup || !TL.isHumanTeam(this.state, clubId)) { club.tactics.formation = club.tactics.formation || '4-3-3'; TL.autoLineup(this.state, club); }
      else TL.validateLineup(this.state, club);
      if (this.f.neutral) home = false;
      const slots = TL.FORMATIONS[club.tactics.formation];
      return {
        club, home, tactics: Object.assign({}, club.tactics),
        xi: club.lineup.xi.slice(), slotPos: slots.map(s => s[0]), bench: club.lineup.bench.slice(),
        subsLeft: 5, goals: 0,
        st: { shots: 0, onTarget: 0, xg: 0, poss: 0, fouls: 0, yellows: 0, reds: 0, corners: 0, offsides: 0, saves: 0 }
      };
    }
    pstate(id, side, starter) { return { id, side, rating: 0, goals: 0, assists: 0, shots: 0, onT: 0, saves: 0, yellow: false, red: false, injured: false, on: this.minute, off: null, starter, cond: this.state.players[id].cond }; }
    P(id) { return this.state.players[id]; }
    other(k) { return k === 'home' ? 'away' : 'home'; }
    onPitch(k) { return this.sides[k].xi.map((id, i) => ({ id, i, pos: this.sides[k].slotPos[i] })).filter(o => o.id && !this.ps[o.id].red && this.ps[o.id].off == null); }
    clock() { return this.half === 1 && this.minute > 45 ? `45+${this.minute - 45}` : this.half === 2 && this.minute > 90 ? `90+${this.minute - 90}` : this.half === 3 && this.minute > 120 ? `120+${this.minute - 120}` : String(this.minute); }
    say(min, type, text, side) { if (this.fast && type === 'flavour') return {}; const e = { min, disp: type === 'ht' ? '45' : type === 'ft' ? (this.et ? '120' : '90') : type === 'pens' ? 'Pens' : this.clock(), type, text, side }; this.lines.push(e); if (type !== 'flavour') this.events.push(e); return e; }

    strength(k) {
      const s = this.sides[k];
      const on = this.onPitch(k);
      let a = 0, aw = 0, m = 0, mw = 0, d = 0, dw = 0, gk = 50;
      for (const o of on) {
        const p = this.P(o.id), ps = this.ps[o.id];
        const eff = p.ovr * TL.familiarity(p.pos, o.pos) * (0.72 + 0.28 * ps.cond / 100) * (0.95 + p.morale / 1000);
        if (o.pos === 'GK') { gk = eff; continue; }
        a += eff * ATT_W[o.pos]; aw += ATT_W[o.pos];
        m += eff * MID_W[o.pos]; mw += MID_W[o.pos];
        d += eff * DEF_W[o.pos]; dw += DEF_W[o.pos];
      }
      const ref = { a: 3.75, m: 4.2, d: 4.25 }; // weight sums of a balanced XI
      const t = s.tactics, men = t.mentality, home = s.home ? this.T.homeAdvantage * (s.club.facilities && s.club.facilities.pitch ? 1 + 0.004 * s.club.facilities.pitch : 1) : 1;
      const num = Math.pow(on.length / 11, 1.3);
      // Preparation: tactical familiarity with the formation, assistant manager quality, training focus
      const club = s.club;
      const fam = club.fam && club.fam[t.formation] != null ? club.fam[t.formation] : 70;
      const prep = (0.95 + 0.05 * fam / 100) * (1 + (TL.staffRating && club.staffIds ? (TL.staffRating(this.state, club.id, 'assistant') - 10) * 0.002 : 0));
      const crowd = s.home && club.fans ? 0.985 + club.fans.mood / 2000 : 1; // a happy home crowd lifts the team slightly
      const tb = TL.trainBonus ? TL.trainBonus(this.state, club) : { att: 1, mid: 1, def: 1, prep: 1 };
      const mult = home * num * prep * tb.prep * (s.talk || 1) * crowd * (club.postLift ? club.postLift.mult : 1);
      return {
        att: (aw ? a / aw : 40) * Math.pow(aw / ref.a, 0.25) * (1 + 0.035 * men) * mult * tb.att,
        mid: (mw ? m / mw : 40) * Math.pow(mw / ref.m, 0.2) * (1 + 0.02 * (t.press - 1)) * mult * tb.mid,
        def: (dw ? d / dw : 40) * Math.pow(dw / ref.d, 0.25) * (1 - 0.03 * men) * mult * tb.def,
        gk
      };
    }
    refresh() { if (this.dirty) { this.S = { home: this.strength('home'), away: this.strength('away') }; this.dirty = false; } }

    step() {
      if (this.done) return [];
      const before = this.lines.length;
      this.minute++;
      const rng = this.rng, T = this.T;
      if (this.half === 1 && this.minute > this.firstHalfEnd) {
        this.half = 2; this.minute = 46;
        this.say(45, 'ht', `Half-time: ${this.sides.home.club.name} ${this.sides.home.goals}–${this.sides.away.goals} ${this.sides.away.club.name}.`);
        for (const k of ['home', 'away']) for (const o of this.onPitch(k)) this.ps[o.id].cond = Math.min(100, this.ps[o.id].cond + 4);
        this.dirty = true;
        return this.lines.slice(before);
      }
      if (this.half === 2 && this.minute > this.secondHalfEnd) {
        if (this.levelForKnockout()) {
          this.half = 3; this.minute = 90; this.et = true; this.etEnd = 120 + rng.int(0, 2);
          this.say(90, 'et', `Full-time and still level${this.f.leg === 2 ? ' on aggregate' : ''}. We go to extra time.`);
          for (const k of ['home', 'away']) for (const o of this.onPitch(k)) this.ps[o.id].cond = Math.min(100, this.ps[o.id].cond + 2);
          this.dirty = true;
        } else this.finish();
        return this.lines.slice(before);
      }
      if (this.half === 3 && this.minute > this.etEnd) {
        if (this.levelForKnockout()) this.penalties();
        this.finish();
        return this.lines.slice(before);
      }
      // fatigue
      if (this.minute % 3 === 0) {
        for (const k of ['home', 'away']) {
          const press = this.sides[k].tactics.press;
          const fitF = TL.trainBonus ? TL.trainBonus(this.state, this.sides[k].club).fat : 1;
          for (const o of this.onPitch(k)) {
            const p = this.P(o.id);
            const r = (T.fatigueBase + (20 - p.attrs.stamina) * T.fatigueStamina) * (1 + 0.22 * (press - 1)) * (o.pos === 'GK' ? 0.3 : 1) * fitF;
            this.ps[o.id].cond = Math.max(20, this.ps[o.id].cond - r * 3);
          }
        }
        this.dirty = true;
      }
      if ([60, 70, 80].includes(this.minute)) for (const k of ['home', 'away']) if (k !== this.userSide) this.aiSubs(k);
      this.refresh();
      const S = this.S;
      const mh = Math.pow(S.home.mid, T.possessionExponent), ma = Math.pow(S.away.mid, T.possessionExponent);
      const pHome = mh / (mh + ma);
      const atk = rng.chance(pHome) ? 'home' : 'away', def = this.other(atk);
      this.lastAtk = atk;
      this.sides[atk].st.poss++;
      const A = this.sides[atk], ratio = S[atk].att / S[def].def;
      const tempo = A.tactics.tempo;
      const pShot = T.chancePerMinute * Math.pow(ratio, T.strengthExponent) * (1 + 0.1 * (tempo - 1)) * (1 + 0.06 * A.tactics.mentality);
      if (rng.chance(pShot)) this.chance(atk, def, ratio);
      else if (rng.chance(0.045)) { A.st.corners++; if (rng.chance(0.25)) this.setPiece(atk, def, 'corner'); }
      else if (rng.chance(0.06) && !this.fast) this.flavour(atk);
      if (rng.chance(T.foulPerMinute)) this.foul(rng.chance(0.58) ? def : atk);
      { const ik = rng.chance(0.5) ? 'home' : 'away'; if (rng.chance(T.injuryPerMinute * (TL.injuryRisk ? TL.injuryRisk(this.state, this.sides[ik].club) : 1))) this.injury(ik); }
      return this.lines.slice(before);
    }

    pickPlayer(k, wmap, attr, exclude) {
      const on = this.onPitch(k).filter(o => o.id !== exclude);
      return this.rng.weighted(on, o => (wmap[o.pos] || 0.1) * (attr ? (4 + this.P(o.id).attrs[attr]) / 14 : 1));
    }

    chance(atk, def, ratio) {
      const rng = this.rng, T = this.T, A = this.sides[atk];
      if (rng.chance(T.offsideShare)) {
        const o = this.pickPlayer(atk, SHOT_W, 'pace');
        A.st.offsides++;
        this.say(this.minute, 'offside', `${this.short(o.id)} is flagged offside.`, atk).shot = { sid: o.id, type: 'offside', out: 'offside' };
        return;
      }
      if (rng.chance(T.penaltyShare)) return this.penalty(atk, def);
      const roll = rng.next();
      let type, base, shooter;
      if (roll < 0.17) { type = 'header'; base = 0.09; shooter = this.pickPlayer(atk, HEAD_W, 'heading'); }
      else if (roll < 0.47) { type = 'close'; base = 0.2; shooter = this.pickPlayer(atk, SHOT_W, 'finishing'); }
      else if (roll < 0.9) { type = 'long'; base = 0.045; shooter = this.pickPlayer(atk, SHOT_W, 'finishing'); }
      else { type = 'oneonone'; base = 0.36; shooter = this.pickPlayer(atk, SHOT_W, 'finishing'); }
      const xg = clamp(0.86 * base * (0.6 + 0.8 * rng.next()) * clamp(Math.pow(ratio, 0.5), 0.75, 1.3), 0.01, 0.75);
      const assister = rng.chance(0.78) ? this.pickPlayer(atk, ASSIST_W, 'passing', shooter.id) : null;
      this.shot(atk, def, shooter.id, assister && assister.id, xg, type);
    }

    shot(atk, def, sid, aid, xg, type) {
      const rng = this.rng, A = this.sides[atk], D = this.sides[def];
      const p = this.P(sid), ps = this.ps[sid];
      const skill = type === 'header' ? p.attrs.heading : p.attrs.finishing;
      const finish = this.T.finishBase + (skill + p.attrs.composure * 0.5) / this.T.finishScale;
      const gkId = this.onPitch(def).find(o => o.pos === 'GK');
      const gk = gkId ? this.P(gkId.id) : null;
      const gkEff = gk ? (gk.attrs.reflexes + gk.attrs.handling + gk.attrs.oneOnOnes) / 3 : 4;
      const gkMod = 1 + (14 - gkEff) / 30;
      const pGoal = clamp(xg * finish * gkMod, 0.005, 0.92);
      A.st.shots++; A.st.xg += xg; ps.shots++;
      const desc = { header: 'heads', close: 'shoots from close range', long: 'tries his luck from distance', oneonone: 'is through one on one', penalty: 'steps up to take the penalty', freekick: 'curls the free kick', corner: 'meets the corner' }[type];
      if (rng.chance(pGoal)) {
        A.st.onTarget++; ps.onT++; A.goals++; ps.goals++;
        if (aid) this.ps[aid].assists++;
        if (gkId) this.ps[gkId.id].conceded = (this.ps[gkId.id].conceded || 0) + 1;
        const how = { header: 'powers a header into the net', close: 'finishes from close range', long: 'unleashes a stunning strike from distance', oneonone: 'slots it past the keeper', penalty: 'sends the keeper the wrong way', freekick: 'curls the free kick into the top corner', corner: 'heads home from the corner' }[type];
        this.say(this.minute, 'goal', `GOAL! ${p.name} ${how}${aid ? ` (assist: ${this.short(aid)})` : ''}. ${this.scoreLine()}`, atk);
        Object.assign(this.lines[this.lines.length - 1], { scorer: sid, shot: { sid, aid, type, out: 'goal' } });
        this.dirty = true;
        return;
      }
      const onT = rng.chance(this.T.onTargetShare + xg * 0.3);
      if (onT && gkId) {
        A.st.onTarget++; ps.onT++; D.st.saves++; this.ps[gkId.id].saves++;
        this.say(this.minute, 'save', type === 'penalty' ? `${p.name} ${desc}... SAVED! ${this.P(gkId.id).name} guesses right.` : `${p.name} ${desc}... saved by ${this.short(gkId.id)}${xg > 0.3 ? '. Huge chance!' : '.'}`, atk).shot = { sid, aid, type, out: 'save', gk: gkId.id };
        if (rng.chance(0.3)) A.st.corners++;
      } else {
        const miss = type === 'penalty' ? rng.pick(['hits the post', 'blazes it over the bar', 'drags it wide']) : rng.pick(['fires wide', 'blazes over the bar', 'is blocked', 'drags it wide of the post', 'hits the side netting']);
        this.say(this.minute, xg > 0.25 ? 'miss' : 'flavour', `${p.name} ${desc} but ${miss}.`, atk).shot = { sid, aid, type, out: 'miss' };
        if (rng.chance(0.25)) A.st.corners++;
      }
    }

    penalty(atk, def) {
      const taker = this.onPitch(atk).slice().sort((a, b) => (this.P(b.id).attrs.finishing + this.P(b.id).attrs.composure) - (this.P(a.id).attrs.finishing + this.P(a.id).attrs.composure))[0];
      const fouler = this.pickPlayer(def, FOUL_W, 'aggression');
      const var_ = this.rng.chance(0.25);
      this.say(this.minute, 'pen', `PENALTY to ${this.sides[atk].club.name}! ${this.short(fouler.id)} brings down his man in the box.${var_ ? ' VAR checks... and the decision stands.' : ''}`, atk);
      this.shot(atk, def, taker.id, null, 0.78, 'penalty');
    }

    setPiece(atk, def, kind) {
      const rng = this.rng;
      const spF = TL.trainBonus ? TL.trainBonus(this.state, this.sides[atk].club).sp : 1;
      if (kind === 'corner') {
        const s = this.pickPlayer(atk, HEAD_W, 'heading');
        this.shot(atk, def, s.id, this.pickPlayer(atk, ASSIST_W, 'setPieces', s.id).id, rng.range(0.03, 0.12) * spF, 'corner');
      } else {
        const taker = this.onPitch(atk).slice().sort((a, b) => this.P(b.id).attrs.setPieces - this.P(a.id).attrs.setPieces)[0];
        this.shot(atk, def, taker.id, null, rng.range(0.04, 0.09) * spF, 'freekick');
      }
    }

    foul(k) {
      const rng = this.rng, T = this.T, S = this.sides[k];
      const o = this.pickPlayer(k, FOUL_W, 'aggression'); if (!o) return;
      const ps = this.ps[o.id], p = this.P(o.id);
      S.st.fouls++;
      const agg = p.attrs.aggression / 11;
      if (rng.chance(T.redPerFoul * this.ref * agg)) return this.sendOff(k, o.id, 'straight');
      if (rng.chance(T.yellowPerFoul * this.ref * agg * (ps.yellow ? T.secondYellowCaution : 1))) {
        if (ps.yellow) return this.sendOff(k, o.id, 'second');
        ps.yellow = true; S.st.yellows++;
        this.say(this.minute, 'yellow', `Yellow card for ${p.name} (${S.club.name}).`, k).pid = o.id;
      } else if (rng.chance(0.12)) {
        this.say(this.minute, 'flavour', `${p.name} gives away a free kick in a dangerous position.`, k);
        if (rng.chance(0.45)) this.setPiece(this.other(k), k, 'freekick');
      }
    }

    sendOff(k, id, kind) {
      const S = this.sides[k], ps = this.ps[id];
      ps.red = true; ps.redKind = kind; ps.off = this.minute; S.st.reds++;
      if (kind === 'second') S.st.yellows++;
      this.say(this.minute, 'red', kind === 'second' ? `Second yellow! ${this.P(id).name} is sent off. ${S.club.name} down to ${this.onPitch(k).length}.` : `RED CARD! ${this.P(id).name} is shown a straight red. ${S.club.name} down to ${this.onPitch(k).length}.`, k);
      this.dirty = true;
      if (this.onPitch(k).every(o => o.pos !== 'GK') && this.sides[k].slotPos[this.sides[k].xi.indexOf(id)] === 'GK') {
        const sub = this.sides[k].bench.find(b => this.P(b).pos === 'GK');
        const victim = this.onPitch(k).filter(o => o.pos !== 'GK').sort((a, b) => this.P(a.id).ovr - this.P(b.id).ovr)[0];
        if (sub && victim && this.sides[k].subsLeft > 0) this.substitute(k, victim.id, sub, 'Emergency change: the substitute keeper comes on.');
      }
    }

    injury(k) {
      const rng = this.rng;
      const on = this.onPitch(k); if (!on.length) return;
      const o = rng.weighted(on, x => (this.P(x.id).hidden.injuryProne + 4) * (1.4 - this.ps[x.id].cond / 100) * (this.P(x.id).rushed ? 4 : 1));
      const inj = rng.pick(INJURIES);
      const days = rng.int(inj[1], inj[2]);
      const ps = this.ps[o.id];
      ps.injured = { name: inj[0], days };
      this.say(this.minute, 'injury', `${this.P(o.id).name} goes down injured (${inj[0].toLowerCase()}).`, k);
      this.replace(k, o.id, 'injury');
    }

    replace(k, outId, why) {
      const S = this.sides[k]; if (S.subsLeft <= 0) return false;
      const pos = S.slotPos[S.xi.indexOf(outId)];
      const cands = S.bench.filter(id => !this.ps[id] || this.ps[id].off == null);
      if (!cands.length) return false;
      const best = cands.map(id => this.P(id)).sort((a, b) => b.ovr * TL.familiarity(b.pos, pos) - a.ovr * TL.familiarity(a.pos, pos))[0];
      this.substitute(k, outId, best.id, why === 'injury' ? 'Forced change.' : '');
      return true;
    }

    substitute(k, outId, inId, note) {
      const S = this.sides[k];
      const i = S.xi.indexOf(outId);
      if (i < 0 || S.subsLeft <= 0) return false;
      S.xi[i] = inId; S.bench = S.bench.filter(b => b !== inId);
      S.subsLeft--;
      this.ps[outId].off = this.minute;
      this.ps[inId] = this.pstate(inId, k, false);
      this.say(this.minute, 'sub', `Substitution, ${S.club.name}: ${this.P(inId).name} replaces ${this.P(outId).name}.${note ? ' ' + note : ''}`, k);
      this.dirty = true;
      return true;
    }

    aiSubs(k) {
      const S = this.sides[k];
      if (S.subsLeft <= 0) return;
      const tired = this.onPitch(k).filter(o => o.pos !== 'GK' && (this.ps[o.id].cond < 68 || (this.minute >= 70 && this.ps[o.id].cond < 75))).sort((a, b) => this.ps[a.id].cond - this.ps[b.id].cond);
      const n = Math.min(this.minute === 60 ? 2 : 2, tired.length, S.subsLeft - (this.minute < 80 ? 1 : 0));
      for (let i = 0; i < n; i++) this.replace(k, tired[i].id, 'tired');
    }

    flavour(k) {
      const S = this.sides[k];
      const o = this.pickPlayer(k, ASSIST_W, 'passing'); if (!o) return;
      const n = this.P(o.id).name;
      this.say(this.minute, 'flavour', this.rng.pick([
        `${S.club.name} are stringing passes together in midfield.`,
        `${n} looks for an opening but the defence holds firm.`,
        `${n} switches play with a lovely long ball.`,
        `Patient build-up from ${S.club.name}.`,
        `${n} drives forward, only to be crowded out.`,
        `${S.club.name} win the ball back high up the pitch.`,
        `${n} whips in a cross that is cleared.`
      ]), k);
    }

    short(id) { const n = this.P(id).name.split(' '); return n.length > 1 ? n.slice(1).join(' ') : n[0]; }
    scoreLine() { return `${this.sides.home.club.name} ${this.sides.home.goals}–${this.sides.away.goals} ${this.sides.away.club.name}`; }

    // User actions during a live match
    userSub(outId, inId) { const k = this.userSide; if (!k) return false; return this.substitute(k, outId, inId, ''); }
    userTactics(t) { const k = this.userSide; Object.assign(this.sides[k].tactics, t); this.dirty = true; this.say(this.minute, 'flavour', `${this.sides[k].club.name} make a tactical change.`, k); }

    // Change formation during the match: players on the pitch are re-assigned to the new positions by best fit
    userFormation(f) {
      const k = this.userSide, slots = TL.FORMATIONS[f]; if (!k || !slots) return false;
      const S = this.sides[k], on = this.onPitch(k).map(o => o.id), gone = S.xi.filter(id => id && !on.includes(id));
      const xi = new Array(slots.length).fill(null), used = new Set();
      const order = slots.map((s, i) => i).sort((a, b) => (slots[a][0] === 'GK' ? -1 : 0) - (slots[b][0] === 'GK' ? -1 : 0));
      for (const i of order) {
        let best = null, bv = -1;
        for (const id of on) { if (used.has(id)) continue; const p = this.P(id), v = p.ovr * TL.familiarity(p.pos, slots[i][0]) * (slots[i][0] === 'GK' ? (p.pos === 'GK' ? 3 : 0.1) : (p.pos === 'GK' ? 0.1 : 1)); if (v > bv) { bv = v; best = id; } }
        if (best) { xi[i] = best; used.add(best); }
      }
      for (let i = 0; i < xi.length; i++) if (!xi[i] && gone.length) xi[i] = gone.shift(); // sent-off players keep an (empty) slot
      S.xi = xi; S.slotPos = slots.map(s => s[0]); S.tactics.formation = f; this.dirty = true;
      this.say(this.minute, 'flavour', `${S.club.name} switch to a ${f}.`, k);
      return true;
    }
    // Swap two players' positions (slot indexes)
    userSwap(i, j) {
      const S = this.sides[this.userSide]; if (!S || i === j) return false;
      [S.xi[i], S.xi[j]] = [S.xi[j], S.xi[i]]; this.dirty = true;
      const a = S.xi[i] && this.P(S.xi[i]), b = S.xi[j] && this.P(S.xi[j]);
      if (a && b) this.say(this.minute, 'flavour', `${this.short(a.id)} and ${this.short(b.id)} swap positions.`, this.userSide);
      return true;
    }
    runToEnd() { while (!this.done) this.step(); }

    // Knockout ties: level after 90 (or on aggregate in a second leg) means extra time, then penalties.
    totals() { return { home: this.sides.home.goals + (this.f.aggHome || 0), away: this.sides.away.goals + (this.f.aggAway || 0) }; }
    levelForKnockout() { if (!this.f.ko || this.f.leg === 1) return false; const t = this.totals(); return t.home === t.away; }
    penalties() {
      const rng = this.rng, score = { home: 0, away: 0 }, taken = { home: 0, away: 0 };
      const order = k => this.onPitch(k).filter(o => o.pos !== 'GK').sort((a, b) => (this.P(b.id).attrs.finishing + this.P(b.id).attrs.composure) - (this.P(a.id).attrs.finishing + this.P(a.id).attrs.composure)).concat(this.onPitch(k).filter(o => o.pos === 'GK'));
      const takers = { home: order('home'), away: order('away') };
      const keeper = k => this.onPitch(k).find(o => o.pos === 'GK');
      this.say(this.etEnd, 'pens', 'Penalty shoot-out!');
      const kick = k => {
        const list = takers[k];
        const t = list[taken[k] % list.length], p = this.P(t.id), gk = keeper(this.other(k));
        const gkv = gk ? (this.P(gk.id).attrs.reflexes + this.P(gk.id).attrs.oneOnOnes) / 2 : 5;
        const ok = rng.chance(clamp(0.76 + (p.attrs.finishing + p.attrs.composure) / 160 - gkv / 120 + (p.hidden.bigMatch - 12) / 200, 0.55, 0.92));
        taken[k]++; if (ok) score[k]++;
        this.say(this.etEnd, 'pens', `${p.name} ${ok ? 'scores' : rng.pick(['misses', 'sees it saved', 'hits the post'])}. (${score.home}–${score.away})`, k);
      };
      // Best of five, stopping early once one side can't catch up; then sudden death.
      const decidedEarly = () => score.home + (5 - taken.home) < score.away || score.away + (5 - taken.away) < score.home;
      shootout: for (let round = 0; round < 30; round++) {
        for (const k of ['home', 'away']) {
          if (!takers[k].length) continue;
          kick(k);
          if (round < 5 && decidedEarly()) break shootout;
        }
        if (round >= 4 && score.home !== score.away) break;
      }
      if (score.home === score.away) score[rng.chance(0.5) ? 'home' : 'away']++; // safety net, practically unreachable
      this.pens = score;
      const w = score.home > score.away ? 'home' : 'away';
      this.say(this.etEnd, 'pens', `${this.sides[w].club.name} win ${Math.max(score.home, score.away)}–${Math.min(score.home, score.away)} on penalties!`, w);
    }
    finish() {
      this.done = true;
      const H = this.sides.home, A = this.sides.away;
      const tot = H.st.poss + A.st.poss || 1;
      H.st.possPct = Math.round(100 * H.st.poss / tot); A.st.possPct = 100 - H.st.possPct;
      const endMin = this.et ? this.etEnd : this.secondHalfEnd;
      this.say(endMin, 'ft', `Full-time${this.et ? ' after extra time' : ''}: ${this.scoreLine()}.`);
      if (this.f.ko && this.f.leg !== 1) {
        const t = this.totals();
        this.winner = this.pens ? (this.pens.home > this.pens.away ? 'home' : 'away') : t.home > t.away ? 'home' : 'away';
        if (this.f.leg === 2) this.say(endMin, 'ft', `${this.sides[this.winner].club.name} go through ${Math.max(t.home, t.away)}–${Math.min(t.home, t.away)} on aggregate${this.pens ? ' (won on penalties)' : ''}.`);
      }
      // Ratings
      for (const id in this.ps) {
        const ps = this.ps[id], p = this.P(id), S = this.sides[ps.side], O = this.sides[this.other(ps.side)];
        const mins = (ps.off == null ? endMin : ps.off) - ps.on;
        const res = S.goals > O.goals ? 1 : S.goals < O.goals ? -1 : 0;
        let r = 6.3 + res * 0.3 + ps.goals * 1.0 + ps.assists * 0.6 + ps.onT * 0.12 - (ps.shots - ps.onT) * 0.04 + ps.saves * 0.22;
        const g = TL.POS_GROUP[p.pos];
        if (g === 'DEF' || g === 'GK') { r += O.goals === 0 && mins >= 60 ? 0.6 : -0.22 * Math.min(4, O.goals); }
        if (g === 'MID') r += (S.st.xg - O.st.xg) * 0.15;
        if (ps.yellow) r -= 0.3; if (ps.red) r -= 1.5;
        r += this.rng.normal() * 0.35 * (1.3 - p.hidden.consistency / 20);
        if (mins < 20 && !ps.starter) r = 6.0 + ps.goals * 0.8 + res * 0.1;
        ps.rating = clamp(Math.round(r * 10) / 10, 3.5, 10);
        ps.mins = mins;
      }
      const all = Object.values(this.ps).sort((a, b) => b.rating - a.rating);
      this.motm = all[0] && all[0].id;
    }
  }
  TL.Match = Match;

  /* ---------- Applying a result to the world ---------- */
  TL.applyMatch = function (state, m) {
    const f = m.f;
    f.hg = m.sides.home.goals; f.ag = m.sides.away.goals; f.played = true;
    f.stats = { home: m.sides.home.st, away: m.sides.away.st };
    f.scorers = m.events.filter(e => e.type === 'goal').map(e => ({ min: e.disp, side: e.side, id: e.scorer }));
    f.motm = m.motm;
    f.att = m.attendance;
    f.et = !!m.et;
    if (m.pens) f.pens = m.pens;
    if (m.winner) f.winner = m.sides[m.winner].club.id;
    const intl = f.kind === 'intl';
    const H = TL.team(state, f.home);
    if (!intl && !f.neutral && TL.book) {
      const oi = TL.ownerIndex(state, f.home);
      if (oi >= 0) TL.asManager(state, oi, () => TL.book(state, 'inc', 'matchday', m.attendance * (H.ticketPrice || 40) * 1.3 / 1e6 * (H.facilities && H.facilities.hospitality ? 1 + 0.06 * H.facilities.hospitality : 1)));
    }
    for (const cid of [f.home, f.away]) { const c = TL.team(state, cid); if (c.fam && c.fam[c.tactics.formation] != null) c.fam[c.tactics.formation] = Math.min(100, c.fam[c.tactics.formation] + 2); }
    for (const k of ['home', 'away']) {
      const S = m.sides[k], O = m.sides[m.other(k)];
      const res = S.goals > O.goals ? 'W' : S.goals < O.goals ? 'L' : 'D';
      TL.recordManagerResult(state, S.club.id, res);
      const played = new Set();
      for (const id in m.ps) {
        const ps = m.ps[id]; if (ps.side !== k) continue;
        const p = state.players[id]; played.add(id);
        if (intl) {
          // International caps: no club stats, cards or bans carry over
          p.intl = p.intl || { caps: 0, goals: 0 };
          p.intl.caps++; p.intl.goals += ps.goals;
          if (ps.injured) { p.injury = ps.injured.days; p.injuryName = ps.injured.name + ' (on international duty)'; }
          p.cond = Math.round(ps.cond);
          p.morale = clamp(p.morale + (res === 'W' ? 3 : res === 'L' ? -2 : 0) + (ps.goals ? 3 : 0), 5, 100);
          continue;
        }
        const st = p.stats;
        st.apps++; if (ps.starter) st.starts++;
        st.goals += ps.goals; st.assists += ps.assists; st.ratingSum += ps.rating; st.rated++;
        if (id === m.motm) st.motm++;
        if (ps.yellow && !ps.red) { st.yellows++; p.yellowAcc++; if (p.yellowAcc >= TL.TUNING.yellowBanThreshold) { p.ban = 1; p.banDate = state.date; p.yellowAcc = 0; } }
        if (ps.red) { st.reds++; p.ban = ps.redKind === 'straight' ? 3 : 1; p.banDate = state.date; }
        if (ps.goals && f.comp) { st.byComp = st.byComp || {}; st.byComp[f.comp] = (st.byComp[f.comp] || 0) + ps.goals; }
        if (p.pos === 'GK' && O.goals === 0 && ps.mins >= 60) st.cleanSheets++;
        if (ps.injured) { p.injury = Math.max(1, Math.round(ps.injured.days * (TL.injuryDaysFactor ? TL.injuryDaysFactor(state, S.club) : 1))); p.injuryName = ps.injured.name; p.rushed = null; p.rehab = null; if (TL.onInjury) TL.onInjury(state, p); }
        p.cond = Math.round(ps.cond);
        p.form = (p.form || []).concat(ps.rating).slice(-5);
        p.morale = clamp(p.morale + (res === 'W' ? 6 : res === 'D' ? 1 : -5) + (ps.rating >= 7.5 ? 3 : ps.rating < 6 ? -2 : 0), 5, 100);
      }
      if (intl) continue;
      const regular = TL.squadStrength(state, S.club) - 2;
      for (const id of S.club.players) {
        if (played.has(id)) continue;
        const p = state.players[id];
        if (TL.available(p) && p.ovr >= regular) p.morale = clamp(p.morale - 2, 5, 100);
        else p.morale = clamp(p.morale + (res === 'W' ? 1 : 0), 5, 100);
      }
    }
  };

  // Advance the calendar one day at a time: recovery, injuries, then the economy's daily tick
  // (training weeks, month-end finances, transfer windows, scouting, AI transfer activity).
  TL.advanceDays = function (state, days) {
    const rng = new Rng(state.rngS);
    for (let d = 0; d < days; d++) {
      for (const id in state.players) {
        const p = state.players[id];
        const c = p.clubId && state.clubs[p.clubId];
        const intensity = c && c.training ? [1.15, 1, 0.85][c.training.intensity] : 1;
        const fit = c && c.staffIds && TL.staffRating ? 0.9 + TL.staffRating(state, c.id, 'fitCoach') / 100 : 1;
        const rec = TL.TUNING.dailyRecovery * (0.8 + p.attrs.stamina / 50) * intensity * fit * (TL.recoveryBonus && c ? TL.recoveryBonus(state, c) : 1);
        p.cond = Math.min(100, Math.round(p.cond + rec));
        if (p.injury > 0) {
          p.injury -= TL.rehabStep ? TL.rehabStep(state, p, c, rng) : 1;
          if (p.injury <= 0) {
            p.injury = 0;
            if (p.clubId) TL.mailClub(state, p.clubId, 'medical', `${p.name} is fit again`, `${p.name} has recovered from his ${p.injuryName.toLowerCase()} and is available for selection.`);
            p.injuryName = '';
          } else p.cond = Math.min(p.cond, 70);
        }
      }
      const prev = state.date;
      state.date = TL.addDays(prev, 1);
      if (TL.dayTick) TL.dayTick(state, prev, state.date, rng);
      if (TL.intlDayTick) TL.intlDayTick(state, rng);
      if (TL.careerDayTick) TL.careerDayTick(state, prev, state.date, rng);
    }
    state.rngS = rng.s;
  };

  TL.addMail = function (state, from, subject, body, important) {
    const FROM = { board: 'The Board', assistant: 'Assistant Manager', medical: 'Head Physio', league: 'League Office', scout: 'Chief Scout', academy: 'Academy Director', media: 'Press Office', finance: 'Finance Director', transfers: 'Director of Football', federation: 'National Federation', agent: 'Your Agent', achievements: 'Achievements' };
    state.inbox.unshift({ id: state.nextId++, from: FROM[from] || from, kind: from, subject, body, date: state.date, read: false, important: !!important });
    if (state.inbox.length > 120) state.inbox.length = 120;
  };

  // Line strengths for the tactics screen, without home advantage.
  TL.lineupStrength = function (state, club) {
    const other = Object.keys(state.clubs).find(id => id !== club.id);
    const m = new Match(state, { home: club.id, away: other, kind: club.isNation ? 'intl' : 'club' }, new Rng(1), {});
    const s = m.strength('home'), h = TL.TUNING.homeAdvantage;
    return { att: s.att / h, mid: s.mid / h, def: s.def / h, gk: s.gk };
  };

  /* ---------- Save / load (pure data) ---------- */
  TL.serialize = state => JSON.stringify(state);
  TL.checksum = str => hash(str).toString(16);
})();
