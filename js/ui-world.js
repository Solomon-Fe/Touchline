/* Touchline — world screens: new-career wizard (club, nation, both, unemployed, Create-a-Club, wonderkid, hot-seat),
   competitions (leagues, cups, Champions League, international tournaments, rankings, history),
   national team management, manager career & jobs, press conferences and the tutorial. */
(function () {
  const TL = window.TL, U = TL.UI;
  const { esc, crest, kitSvg, ICON, ui, toast } = U;
  const G = () => U.G;
  const P = id => U.G.players[id];

  /* =========================================================
     NEW CAREER WIZARD
     ========================================================= */
  const MODES = [['club', 'Club'], ['both', 'Club + country'], ['nation', 'Country only'], ['create', 'Create a club'], ['none', 'Unemployed']];
  const blankMgr = i => ({ name: i ? `Manager ${i + 1}` : '', mode: 'club', clubId: null, nationId: null });
  function nw() {
    if (!ui.nw) {
      ui.nw = {
        mgrs: [blankMgr(0)], cur: 0, league: 'ENG1', confed: 'UEFA', difficulty: 'normal', unsackable: false, transfer: 'normal', usePack: true,
        custom: { name: '', short: '', city: '', stadium: '', leagueId: 'ENG3', c1: '#0E7C66', c2: '#F2C94C', badge: { shape: 'shield', pattern: 'stripes', icon: 'star' }, kit: { pattern: 'stripes' }, cap: 8000 },
        wk: { on: false, name: '', nat: 'ENG', style: 'Playmaker', tier: 'World class', foot: 'Right' },
        slot: U.SLOTS.find(s => !U.meta()[s]) || 1
      };
    }
    return ui.nw;
  }
  const allClubs = () => TL.DATA.leagues.flatMap(l => l.clubs.map(c => Object.assign({ leagueId: l.id, leagueName: l.name }, c)));
  const clubData = id => allClubs().find(c => c.id === id);
  const stars = rep => { const n = Math.max(1, Math.min(5, Math.round((rep - 45) / 10))); return '<span class="stars" aria-label="' + n + ' of 5">' + '★'.repeat(n) + '<span class="faint">' + '★'.repeat(5 - n) + '</span></span>'; };

  function badgeDesigner(def, scope) {
    const opt = (k, list, cur) => `<div class="seg wrap">${list.map(v => `<button class="${cur === v ? 'on' : ''}" data-act="bd" data-scope="${scope}" data-k="${k}" data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div>`;
    return `<div class="designer">
      <div class="preview">${crest({ id: (def.short || def.id || 'NEW').toUpperCase().slice(0, 3), c1: def.c1, c2: def.c2, badge: def.badge }, 96)}${kitSvg(def.c1, def.c2, def.kit ? def.kit.pattern : 'plain', 96)}</div>
      <div class="stack" style="gap:12px;min-width:0">
        <div class="row" style="gap:16px"><label class="ctl"><span class="lbl">Primary colour</span><input type="color" value="${def.c1}" data-change="bd-color" data-scope="${scope}" data-k="c1"></label><label class="ctl"><span class="lbl">Secondary colour</span><input type="color" value="${def.c2}" data-change="bd-color" data-scope="${scope}" data-k="c2"></label></div>
        <div class="ctl"><span class="lbl">Badge shape</span>${opt('shape', TL.BADGE_SHAPES, def.badge.shape)}</div>
        <div class="ctl"><span class="lbl">Badge pattern</span>${opt('pattern', TL.BADGE_PATTERNS, def.badge.pattern)}</div>
        <div class="ctl"><span class="lbl">Badge emblem</span>${opt('icon', TL.BADGE_ICONS, def.badge.icon)}</div>
        <div class="ctl"><span class="lbl">Kit</span>${opt('kit', TL.KIT_PATTERNS, def.kit ? def.kit.pattern : 'plain')}</div>
      </div></div>`;
  }
  U.badgeDesigner = badgeDesigner;
  const designTarget = scope => scope === 'new' ? nw().custom : U.me();

  function viewNew() {
    const W = nw(), m = W.mgrs[W.cur];
    const multi = W.mgrs.length > 1;
    const needClub = ['club', 'both'].includes(m.mode), needNation = ['nation', 'both'].includes(m.mode);
    const takenClubs = W.mgrs.filter((x, i) => i !== W.cur).map(x => x.clubId), takenNations = W.mgrs.filter((x, i) => i !== W.cur).map(x => x.nationId);
    let picker = '';
    if (needClub) {
      const lg = TL.DATA.leagues.find(l => l.id === W.league) || TL.DATA.leagues[0];
      picker += `<section class="card"><div class="card-h"><h3>Choose a club</h3><span class="muted" style="font-size:.82rem">${allClubs().length} clubs</span></div>
        <div class="card-b"><div class="filters">${TL.DATA.leagues.map(l => `<button class="chip ${l.id === lg.id ? 'on' : ''}" data-act="nw-league" data-v="${l.id}">${esc(l.name)}</button>`).join('')}</div></div>
        <div class="club-pick">${lg.clubs.slice().sort((a, b) => b.rep - a.rep).map(c => `<button class="club-opt ${m.clubId === c.id ? 'on' : ''}" data-act="nw-club" data-id="${c.id}" ${takenClubs.includes(c.id) ? 'disabled title="Taken by another manager"' : ''}>${crest(c, 40)}<span><b>${esc(c.name)}</b><small>${esc(c.stadium)} · ${c.cap.toLocaleString('en-GB')}</small></span>${stars(c.rep)}</button>`).join('')}</div></section>`;
    }
    if (needNation) {
      const confeds = ['UEFA', 'CAF', 'CONMEBOL', 'CONCACAF', 'AFC', 'OFC'];
      const list = TL.NATIONS_DATA.filter(n => n.confed === W.confed && !TL.BANNED_NATIONS.includes(n.code)).sort((a, b) => b.rating - a.rating);
      picker += `<section class="card"><div class="card-h"><h3>Choose a country</h3><span class="muted" style="font-size:.82rem">${TL.NATIONS_DATA.length - TL.BANNED_NATIONS.length} nations</span></div>
        <div class="card-b"><div class="filters">${confeds.map(c => `<button class="chip ${W.confed === c ? 'on' : ''}" data-act="nw-confed" data-v="${c}">${c}</button>`).join('')}</div></div>
        <div class="club-pick">${list.map(n => { const id = TL.NID(n.code); return `<button class="club-opt ${m.nationId === id ? 'on' : ''}" data-act="nw-nation" data-id="${id}" ${takenNations.includes(id) ? 'disabled' : ''}>${crest({ isNation: true, code: n.code, c1: n.c1, c2: n.c2 }, 40)}<span><b>${esc(n.name)}</b><small>Rating ${n.rating}</small></span>${stars(n.rating)}</button>`; }).join('')}</div></section>`;
    }
    if (m.mode === 'create') {
      const C = W.custom;
      picker += `<section class="card card-b stack" style="gap:16px"><h3>Create your club</h3>
        <div class="grid g-3" style="gap:12px">
          <label class="ctl"><span class="lbl">Club name</span><input class="input" data-input="nw-custom" data-k="name" value="${esc(C.name)}" placeholder="e.g. Lagos Lions" maxlength="28"></label>
          <label class="ctl"><span class="lbl">Short name (3 letters)</span><input class="input" data-input="nw-custom" data-k="short" value="${esc(C.short)}" maxlength="3" placeholder="LAG"></label>
          <label class="ctl"><span class="lbl">City</span><input class="input" data-input="nw-custom" data-k="city" value="${esc(C.city)}" maxlength="24"></label>
          <label class="ctl"><span class="lbl">Stadium</span><input class="input" data-input="nw-custom" data-k="stadium" value="${esc(C.stadium)}" maxlength="32" placeholder="${esc((C.name || 'Club') + ' Park')}"></label>
          <label class="ctl"><span class="lbl">Starting league</span><select class="input" data-change="nw-custom-league">${TL.DATA.leagues.map(l => `<option value="${l.id}" ${C.leagueId === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
          <label class="ctl"><span class="lbl">Stadium capacity</span><select class="input" data-change="nw-custom-cap">${[3000, 8000, 15000, 25000, 40000].map(v => `<option value="${v}" ${C.cap === v ? 'selected' : ''}>${v.toLocaleString('en-GB')}</option>`).join('')}</select></label>
        </div>
        <div class="muted" style="font-size:.84rem">Your club replaces the lowest-rated club in that league. It starts as an underdog with a young squad and a budget set by the difficulty below.</div>
        ${badgeDesigner(C, 'new')}</section>`;
    }
    const W2 = W.wk;
    const natOpts = Object.keys(TL.NAT_NAMES).sort((a, b) => TL.NAT_NAMES[a].localeCompare(TL.NAT_NAMES[b]));
    const canWonder = W.mgrs[0].mode !== 'nation' && W.mgrs[0].mode !== 'none';
    const m0 = U.meta();
    return `<div class="newc" style="max-width:1100px;padding-bottom:60px">
      <div class="page-h"><div><div class="eyebrow">Season ${TL.DATA.season}/${String(TL.DATA.season + 1).slice(2)} · ${TL.DATA.leagues.length} leagues · ${TL.NATIONS_DATA.length} nations</div><h1 class="display" style="font-size:2rem;text-transform:uppercase">New career</h1></div><button class="btn ghost" data-act="title">Back</button></div>
      <section class="card card-b stack" style="gap:14px">
        <div class="row between"><h3>Managers</h3><div class="row"><span class="muted" style="font-size:.82rem">Hot-seat: take turns on one device</span><button class="btn sm" data-act="nw-add" ${W.mgrs.length >= 4 ? 'disabled' : ''}>+ Add manager</button></div></div>
        ${multi ? `<div class="seg">${W.mgrs.map((x, i) => `<button class="${i === W.cur ? 'on' : ''}" data-act="nw-cur" data-v="${i}">${esc(x.name || 'Manager ' + (i + 1))}</button>`).join('')}</div>` : ''}
        <div class="grid g-2" style="gap:14px">
          <label class="ctl"><span class="lbl">Manager name</span><input class="input" data-input="nw-name" value="${esc(m.name)}" placeholder="Your name" maxlength="24"></label>
          <div class="ctl"><span class="lbl">Job</span><div class="seg wrap">${MODES.filter(([k]) => k !== 'create' || W.cur === 0).map(([k, l]) => `<button class="${m.mode === k ? 'on' : ''}" data-act="nw-mode" data-v="${k}">${l}</button>`).join('')}</div></div>
        </div>
        ${multi && W.cur > 0 ? `<div><button class="btn sm danger" data-act="nw-remove">Remove this manager</button></div>` : ''}
        ${m.mode === 'none' ? '<div class="muted">You start without a job. Apply for vacancies on the Manager screen. Small clubs and low-ranked nations are hiring.</div>' : ''}
      </section>
      ${picker}
      <section class="card card-b stack" style="gap:16px"><h3>Game options</h3>
        <div class="grid g-3" style="gap:16px">
          <div class="ctl"><span class="lbl">Difficulty</span><div class="seg">${[['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']].map(([k, l]) => `<button class="${W.difficulty === k ? 'on' : ''}" data-act="nw-set" data-k="difficulty" data-v="${k}">${l}</button>`).join('')}</div><div class="muted" style="font-size:.8rem">${{ easy: 'Bigger budgets, patient board, cheaper transfers.', normal: 'The intended experience.', hard: 'Tight budgets, demanding board, tougher negotiations.' }[W.difficulty]}</div></div>
          <div class="ctl"><span class="lbl">Transfer market</span><div class="seg">${[['easy', 'Relaxed'], ['normal', 'Realistic'], ['hard', 'Tough']].map(([k, l]) => `<button class="${W.transfer === k ? 'on' : ''}" data-act="nw-set" data-k="transfer" data-v="${k}">${l}</button>`).join('')}</div></div>
          <div class="ctl"><span class="lbl">Job security</span><label class="check"><input type="checkbox" data-change="nw-unsackable" ${W.unsackable ? 'checked' : ''}> Can't be sacked (sandbox)</label></div>
        </div>
        <div class="ctl"><span class="lbl">Save slot</span><div class="seg">${U.SLOTS.map(s => `<button class="${W.slot === s ? 'on' : ''}" data-act="nw-set" data-k="slot" data-v="${s}">Slot ${s}${m0[s] ? ' (overwrite ' + esc(m0[s].club) + ')' : ' · empty'}</button>`).join('')}</div></div>
        ${U.pack ? `<label class="check"><input type="checkbox" data-change="nw-pack" ${W.usePack ? 'checked' : ''}> Use installed data pack "${esc(U.pack.name || 'custom')}"</label>` : ''}
      </section>
      ${canWonder ? `<section class="card card-b stack" style="gap:14px"><div class="row between"><div><h3>Create a wonderkid</h3><div class="muted" style="font-size:.84rem">A 16-year-old prodigy joins your academy. His story unfolds as you develop him.</div></div><label class="check"><input type="checkbox" data-change="nw-wk" ${W2.on ? 'checked' : ''}> Add wonderkid</label></div>
        ${W2.on ? `<div class="grid g-3" style="gap:12px">
          <label class="ctl"><span class="lbl">Name</span><input class="input" data-input="nw-wk" data-k="name" value="${esc(W2.name)}" placeholder="Leave blank for a random name" maxlength="26"></label>
          <label class="ctl"><span class="lbl">Nationality</span><select class="input" data-change="nw-wk" data-k="nat">${natOpts.map(c => `<option value="${c}" ${W2.nat === c ? 'selected' : ''}>${esc(TL.NAT_NAMES[c])}</option>`).join('')}</select></label>
          <label class="ctl"><span class="lbl">Play style</span><select class="input" data-change="nw-wk" data-k="style">${Object.keys(TL.PLAY_STYLES).map(k => `<option ${W2.style === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
          <label class="ctl"><span class="lbl">Potential</span><select class="input" data-change="nw-wk" data-k="tier">${Object.keys(TL.WONDER_TIERS).map(k => `<option ${W2.tier === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
          <label class="ctl"><span class="lbl">Stronger foot</span><select class="input" data-change="nw-wk" data-k="foot">${['Right', 'Left', 'Both'].map(k => `<option ${W2.foot === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
          <div class="ctl"><span class="lbl">Position</span><b>${TL.PLAY_STYLES[W2.style]}</b></div>
        </div>` : ''}</section>` : ''}
      <div class="row" style="justify-content:flex-end"><span class="muted" style="font-size:.85rem">${esc(summary())}</span><button class="btn primary big" data-act="nw-start">Start career ${ICON.play}</button></div>
    </div>`;
  }
  function summary() {
    return nw().mgrs.map((m, i) => {
      const n = m.name || `Manager ${i + 1}`;
      const c = m.mode === 'create' ? (nw().custom.name || 'your new club') : m.clubId ? clubData(m.clubId).name : null;
      const na = m.nationId ? TL.NATIONS_DATA.find(x => TL.NID(x.code) === m.nationId).name : null;
      return `${n}: ${[c, na].filter(Boolean).join(' + ') || (m.mode === 'none' ? 'unemployed' : 'choose a team')}`;
    }).join(' · ');
  }
  function startCareer() {
    const W = nw();
    for (const [i, m] of W.mgrs.entries()) {
      const label = m.name || `Manager ${i + 1}`;
      if (['club', 'both'].includes(m.mode) && !m.clubId) return toast(`${label}: choose a club.`);
      if (['nation', 'both'].includes(m.mode) && !m.nationId) return toast(`${label}: choose a country.`);
      if (m.mode === 'create' && W.custom.name.trim().length < 3) return toast('Give your club a name (at least 3 letters).');
    }
    const go = () => {
      $busy(true);
      setTimeout(() => {
        try {
          const opts = {
            managers: W.mgrs.map((m, i) => ({ name: m.name.trim() || (i ? `Manager ${i + 1}` : 'The Gaffer'), clubId: m.mode === 'create' ? 'CUSTOM' : ['club', 'both'].includes(m.mode) ? m.clubId : null, nationId: ['nation', 'both'].includes(m.mode) ? m.nationId : null })),
            difficulty: W.difficulty, rules: { unsackable: W.unsackable, transferDifficulty: { easy: 0.85, normal: 1, hard: 1.2 }[W.transfer] },
            pack: U.pack && W.usePack ? U.pack.data : null
          };
          if (W.mgrs[0].mode === 'create') opts.custom = Object.assign({}, W.custom, { name: W.custom.name.trim(), short: (W.custom.short || '').trim().toUpperCase(), difficulty: W.difficulty });
          if (W.wk.on && W.mgrs[0].mode !== 'nation' && W.mgrs[0].mode !== 'none') opts.wonderkid = { name: W.wk.name.trim() || null, nat: W.wk.nat, style: W.wk.style, tier: W.wk.tier, foot: W.wk.foot };
          const s = TL.newGame(opts);
          U.G = s; s.slot = W.slot;
          ui.nw = null; ui.tab = 'home'; ui.modal = null;
          ui.screen = s.managers.length > 1 ? 'handover' : 'game'; ui.handNext = 'game';
          U.saveGame(W.slot, true);
        } catch (e) { U.logError(e.stack || e.message, 'newGame'); toast('Could not start the career: ' + e.message); }
        $busy(false); U.render(); window.scrollTo(0, 0);
      }, 30);
    };
    if (U.meta()[W.slot]) U.ask('Overwrite slot ' + W.slot + '?', `The career in slot ${W.slot} (${U.meta()[W.slot].club}) will be replaced.`, 'Overwrite', go, true); else go();
  }
  function $busy(on) {
    let b = document.getElementById('busy');
    if (on && !b) { b = document.createElement('div'); b.id = 'busy'; b.className = 'busy'; b.innerHTML = '<div class="spinner"></div><div>Building the world…</div>'; document.body.appendChild(b); }
    if (!on && b) b.remove();
  }
  U.busy = $busy;

  Object.assign(U.actions, {
    new() { ui.nw = null; nw(); ui.screen = 'new'; U.render(); window.scrollTo(0, 0); },
    'nw-league'(d) { nw().league = d.v; U.soft(); },
    'nw-confed'(d) { nw().confed = d.v; U.soft(); },
    'nw-club'(d) { const W = nw(); W.mgrs[W.cur].clubId = d.id; U.soft(); },
    'nw-nation'(d) { const W = nw(); W.mgrs[W.cur].nationId = d.id; U.soft(); },
    'nw-mode'(d) { const W = nw(); W.mgrs[W.cur].mode = d.v; U.soft(); },
    'nw-add'() { const W = nw(); W.mgrs.push(blankMgr(W.mgrs.length)); W.cur = W.mgrs.length - 1; U.soft(); },
    'nw-remove'() { const W = nw(); W.mgrs.splice(W.cur, 1); W.cur = 0; U.soft(); },
    'nw-cur'(d) { nw().cur = +d.v; U.soft(); },
    'nw-set'(d) { nw()[d.k] = d.k === 'slot' ? +d.v : d.v; U.soft(); },
    'nw-start'() { startCareer(); },
    bd(d) {
      const t = designTarget(d.scope); if (!t) return;
      t.badge = t.badge || { shape: 'shield', pattern: 'plain', icon: 'none' };
      if (d.k === 'kit') { t.kit = t.kit || {}; t.kit.pattern = d.v; } else t.badge[d.k] = d.v;
      U.soft();
    },
    'input:nw-name'(t) { const W = nw(); W.mgrs[W.cur].name = t.value; },
    'input:nw-custom'(t) { nw().custom[t.dataset.k] = t.value; if (t.dataset.k === 'short' || t.dataset.k === 'name') { const pv = document.querySelector('.designer .preview'); if (pv) { const C = nw().custom; pv.innerHTML = crest({ id: (C.short || C.name.replace(/[^A-Za-z]/g, '').slice(0, 3) || 'NEW').toUpperCase().slice(0, 3), c1: C.c1, c2: C.c2, badge: C.badge }, 96) + kitSvg(C.c1, C.c2, C.kit.pattern, 96); } } },
    'input:nw-wk'(t) { nw().wk[t.dataset.k] = t.value; },
    'change:nw-custom-league'(t) { nw().custom.leagueId = t.value; },
    'change:nw-custom-cap'(t) { nw().custom.cap = +t.value; },
    'change:nw-unsackable'(t) { nw().unsackable = t.checked; },
    'change:nw-pack'(t) { nw().usePack = t.checked; },
    'change:nw-wk'(t) { if (t.type === 'checkbox') nw().wk.on = t.checked; else nw().wk[t.dataset.k] = t.value; U.soft(); },
    'change:bd-color'(t) { const x = designTarget(t.dataset.scope); if (x) { x[t.dataset.k] = t.value; U.soft(); } }
  });
  U.screens.new = viewNew;

  /* =========================================================
     COMPETITIONS
     ========================================================= */
  const compGroups = () => {
    const s = G(), C = s.comps;
    const by = t => Object.values(C).filter(c => t.includes(c.type));
    return [
      ['Leagues', s.leagueDefs.map(l => C[l.id]).filter(Boolean)],
      ['Cups & play-offs', by(['cup', 'playoff'])],
      ['Europe', by(['cl'])],
      ['International', by(['intl-t']).concat(by(['intl-q']))],
      ['More', [{ id: '_rank', name: 'World ranking' }, { id: '_hist', name: 'Roll of honour' }, { id: '_fri', name: 'International friendlies' }]]
    ];
  };
  function viewCompetitions() {
    const s = G();
    if (!ui.comp || (!s.comps[ui.comp] && ui.comp[0] !== '_')) ui.comp = (U.me() && U.me().leagueId) || s.leagueDefs[0].id;
    const id = ui.comp;
    const groups = compGroups();
    const nav = `<select class="input comp-select" data-change="comp" aria-label="Competition">${groups.map(([g, list]) => list.length ? `<optgroup label="${g}">${list.map(c => `<option value="${c.id}" ${c.id === id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>` : '').join('')}</select>`;
    let body;
    if (id === '_rank') body = viewRanking();
    else if (id === '_hist') body = viewHistory();
    else if (id === '_fri') body = fixtureList(s.fixtures.filter(f => f.comp === 'FRI' && (f.played || f.date >= s.date)).slice(-80), true);
    else {
      const c = s.comps[id];
      body = c.type === 'league' ? viewLeague(c) : c.type === 'cup' || c.type === 'playoff' ? viewCup(c) : viewGroupComp(c);
    }
    const name = id[0] === '_' ? groups[4][1].find(x => x.id === id).name : s.comps[id].name;
    return `<div class="page-h"><div><div class="eyebrow">${U.seasonLabel(s.season)}</div><h1>${esc(name)}</h1></div>${nav}</div>${body}`;
  }
  const teamCell = (id, size) => { const t = TL.team(G(), id); return `<span class="team">${crest(t, size || 20)}${esc(t ? t.name : id)}</span>`; };
  const isMine = id => { const m = G().manager; return id === m.clubId || id === m.nationId; };
  const openAct = id => TL.team(G(), id) && TL.team(G(), id).isNation ? 'nation-modal' : 'club-modal';

  function viewLeague(c) {
    const s = G(), lg = TL.leagueDef(s, c.id), tbl = TL.table(s, c.id);
    const n = tbl.length;
    const CL = { ENG1: 5, ESP1: 5, ITA1: 5, GER1: 4, FRA1: 3 }[c.id] || 0;
    const zone = pos => {
      if (lg.country === 'ENG' && lg.tier > 1 && pos <= 2) return 'promo';
      if (lg.country === 'ENG' && lg.tier > 1 && pos <= 6) return 'playoff';
      if (CL && pos <= CL) return 'cl';
      if (lg.country === 'ENG' && lg.tier < 3 && pos > n - 3) return 'releg';
      return '';
    };
    const rounds = [...new Set(s.fixtures.filter(f => f.comp === c.id).map(f => f.round))].sort((a, b) => a - b);
    if (ui.lround == null || ui.lroundComp !== c.id) { const next = s.fixtures.filter(f => f.comp === c.id && !f.played).sort((a, b) => a.round - b.round)[0]; ui.lround = next ? next.round : rounds[rounds.length - 1]; ui.lroundComp = c.id; }
    const fx = s.fixtures.filter(f => f.comp === c.id && f.round === ui.lround);
    const scorers = Object.values(s.players).filter(p => p.stats.byComp && p.stats.byComp[c.id]).sort((a, b) => b.stats.byComp[c.id] - a.stats.byComp[c.id]).slice(0, 10);
    return `<div class="grid g-home">
      <section class="card"><div class="tbl-wrap"><table class="tbl compact league">
        <thead><tr><th class="c">#</th><th>Club</th><th class="r">P</th><th class="r">W</th><th class="r">D</th><th class="r">L</th><th class="r hide-sm">GF</th><th class="r hide-sm">GA</th><th class="r">GD</th><th class="r">Pts</th><th class="hide-sm">Form</th></tr></thead>
        <tbody>${tbl.map(r => `<tr class="click ${isMine(r.id) ? 'me' : ''} z-${zone(r.pos)}" data-act="club-modal" data-id="${r.id}"><td class="c"><span class="zone"></span>${r.pos}</td><td>${teamCell(r.id)}</td><td class="r">${r.p}</td><td class="r">${r.w}</td><td class="r">${r.d}</td><td class="r">${r.l}</td><td class="r hide-sm">${r.gf}</td><td class="r hide-sm">${r.ga}</td><td class="r">${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="r"><b>${r.pts}</b></td><td class="hide-sm">${U.formPills(r.form)}</td></tr>`).join('')}</tbody></table></div>
        <div class="card-b legend">${CL ? '<span><i class="z cl"></i>Champions League</span>' : ''}${lg.country === 'ENG' && lg.tier > 1 ? '<span><i class="z promo"></i>Promotion</span><span><i class="z playoff"></i>Play-offs</span>' : ''}${lg.country === 'ENG' && lg.tier < 3 ? '<span><i class="z releg"></i>Relegation</span>' : ''}</div></section>
      <div class="stack">
        <section class="card"><div class="card-h"><h3>Matchday ${ui.lround + 1}</h3><div class="row"><button class="btn sm" data-act="lround" data-v="-1" ${ui.lround <= rounds[0] ? 'disabled' : ''} aria-label="Previous round">‹</button><button class="btn sm" data-act="lround" data-v="1" ${ui.lround >= rounds[rounds.length - 1] ? 'disabled' : ''} aria-label="Next round">›</button></div></div>${fixtureList(fx)}</section>
        <section class="card"><div class="card-h"><h3>Top scorers</h3></div>${scorers.length ? `<div class="tbl-wrap"><table class="tbl compact"><tbody>${scorers.map((p, i) => `<tr class="click" data-act="player" data-id="${p.id}"><td class="c muted">${i + 1}</td><td><b>${esc(p.name)}</b> <span class="muted">${esc(U.clubName(p.clubId))}</span></td><td class="r"><b>${p.stats.byComp[c.id]}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No goals yet.</div>'}</section>
      </div></div>`;
  }
  function fixtureList(fx, showDate) {
    if (!fx.length) return '<div class="empty">No matches.</div>';
    return `<div class="tbl-wrap"><table class="tbl compact fixtures"><tbody>${fx.map(f => `<tr class="${isMine(f.home) || isMine(f.away) ? 'me' : ''}"><td class="muted" style="width:62px">${TL.fmtDate(f.date)}</td><td class="r" style="width:40%"><a href="#" data-act="${openAct(f.home)}" data-id="${f.home}">${esc(U.teamName(f.home))}</a></td><td class="c" style="white-space:nowrap">${f.played ? `<b class="display">${f.hg} – ${f.ag}</b>${f.pens ? `<div class="faint" style="font-size:.7rem">${f.pens.home}–${f.pens.away} pens</div>` : f.et ? '<div class="faint" style="font-size:.7rem">aet</div>' : ''}` : '<span class="faint">v</span>'}</td><td style="width:40%"><a href="#" data-act="${openAct(f.away)}" data-id="${f.away}">${esc(U.teamName(f.away))}</a>${showDate && f.stage ? '' : ''}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function viewCup(c) {
    const s = G();
    const fx = s.fixtures.filter(f => f.comp === c.id);
    const stages = [];
    for (const f of fx) { const k = f.round + '|' + (f.stage || ''); let st = stages.find(x => x.k === k); if (!st) stages.push(st = { k, name: f.stage || 'Round ' + (f.round + 1), list: [] }); st.list.push(f); }
    return `${c.winner ? `<section class="card card-b winner-banner">${crest(TL.team(s, c.winner), 56)}<div><div class="eyebrow">Winners</div><h2>${esc(U.teamName(c.winner))}</h2></div></section>` : c.alive ? `<div class="muted" style="margin-bottom:10px">${c.alive.length} teams still in the competition${c.byes && c.byes.length ? ` · ${c.byes.length} with a bye this round` : ''}.</div>` : ''}
      ${stages.slice().reverse().map(st => `<section class="card"><div class="card-h"><h3>${esc(st.name)}</h3><span class="muted" style="font-size:.82rem">${TL.fmtDate(st.list[0].date, true)}${st.list[0].neutral && st.list[0].venue ? ' · ' + esc(st.list[0].venue) : ''}</span></div>${fixtureList(st.list)}</section>`).join('')}`;
  }
  function groupTable(c, g) {
    const s = G(), t = TL.table(s, c.id, { group: g });
    const qual = c.type === 'intl-q' ? 0 : 2;
    return `<section class="card"><div class="card-h"><h3>Group ${g}</h3></div><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th class="c">#</th><th>Team</th><th class="r">P</th><th class="r">GD</th><th class="r">Pts</th></tr></thead><tbody>
      ${t.map(r => `<tr class="click ${isMine(r.id) ? 'me' : ''} ${r.pos <= qual ? 'z-cl' : ''}" data-act="${openAct(r.id)}" data-id="${r.id}"><td class="c"><span class="zone"></span>${r.pos}</td><td>${teamCell(r.id, 18)}</td><td class="r">${r.p}</td><td class="r">${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="r"><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function viewGroupComp(c) {
    const s = G();
    const ko = s.fixtures.filter(f => f.comp === c.id && f.ko);
    const stages = [];
    for (const f of ko) { let st = stages.find(x => x.name === f.stage); if (!st) stages.push(st = { name: f.stage, list: [] }); st.list.push(f); }
    const mineG = Object.keys(c.groups || {}).find(g => c.groups[g].some(isMine));
    ui.cgroup = ui.cgroupComp === c.id && ui.cgroup ? ui.cgroup : (mineG || 'all'); ui.cgroupComp = c.id;
    const gs = Object.keys(c.groups || {});
    const shown = ui.cgroup === 'all' ? gs : [ui.cgroup];
    const groupFx = s.fixtures.filter(f => f.comp === c.id && !f.ko && (ui.cgroup === 'all' || f.group === ui.cgroup));
    const info = c.type === 'intl-q' ? `<div class="muted" style="margin-bottom:12px">${c.quota} of ${c.teams.length} teams qualify: the group winners first, then the best runners-up.</div>` : '';
    return `${c.winner ? `<section class="card card-b winner-banner">${crest(TL.team(s, c.winner), 56)}<div><div class="eyebrow">Winners</div><h2>${esc(U.teamName(c.winner))}</h2></div></section>` : ''}${info}
      ${stages.length ? stages.slice().reverse().map(st => `<section class="card"><div class="card-h"><h3>${esc(st.name)}</h3><span class="muted" style="font-size:.82rem">${TL.fmtDate(st.list[0].date, true)}</span></div>${fixtureList(st.list)}</section>`).join('') : ''}
      ${gs.length > 1 ? `<div class="filters" style="margin:6px 0 12px"><button class="chip ${ui.cgroup === 'all' ? 'on' : ''}" data-act="cgroup" data-v="all">All groups</button>${gs.map(g => `<button class="chip ${ui.cgroup === g ? 'on' : ''}" data-act="cgroup" data-v="${g}">Group ${g}</button>`).join('')}</div>` : ''}
      <div class="grid g-groups">${shown.map(g => groupTable(c, g)).join('')}</div>
      ${ui.cgroup !== 'all' ? `<section class="card"><div class="card-h"><h3>Group ${ui.cgroup} matches</h3></div>${fixtureList(groupFx)}</section>` : ''}`;
  }
  function viewRanking() {
    const s = G(), r = TL.ranking(s);
    ui.rankConf = ui.rankConf || 'ALL';
    const list = r.map((n, i) => ({ n, i })).filter(x => ui.rankConf === 'ALL' || x.n.confed === ui.rankConf);
    return `<div class="filters" style="margin-bottom:12px">${['ALL', 'UEFA', 'CONMEBOL', 'CAF', 'AFC', 'CONCACAF', 'OFC'].map(c => `<button class="chip ${ui.rankConf === c ? 'on' : ''}" data-act="rank-conf" data-v="${c}">${c === 'ALL' ? 'World' : c}</button>`).join('')}</div>
      <section class="card"><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th class="c">Rank</th><th>Nation</th><th>Confederation</th><th class="r">Points</th></tr></thead><tbody>
      ${list.map(({ n, i }) => `<tr class="click ${isMine(n.id) ? 'me' : ''}" data-act="nation-modal" data-id="${n.id}"><td class="c">${i + 1}</td><td>${teamCell(n.id, 18)}</td><td class="muted">${n.confed}</td><td class="r"><b>${n.elo}</b></td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function viewHistory() {
    const s = G();
    const h = s.history.filter(x => x.champion);
    if (!h.length) return `<section class="card"><div class="empty">The roll of honour fills up at the end of each season.</div></section>`;
    const seasons = [...new Set(h.map(x => x.season))].sort((a, b) => b - a);
    return seasons.map(se => `<section class="card"><div class="card-h"><h3>${U.seasonLabel(se)}</h3></div><div class="tbl-wrap"><table class="tbl compact"><tbody>${h.filter(x => x.season === se).map(x => { const aw = x.awards; return `<tr><td>${esc(x.name)}</td><td>${teamCell(x.champion, 18)}</td><td class="muted hide-sm">${aw && aw.goldenBoot ? `Golden Boot: ${esc(aw.goldenBoot.name)} (${aw.goldenBoot.goals})` : ''}</td></tr>`; }).join('')}</tbody></table></div></section>`).join('');
  }
  Object.assign(U.actions, {
    comp(d) { ui.comp = d.v; ui.screen = 'game'; ui.tab = 'competitions'; ui.modal = null; U.render(); },
    lround(d) { ui.lround += +d.v; U.soft(); },
    cgroup(d) { ui.cgroup = d.v; U.soft(); },
    'rank-conf'(d) { ui.rankConf = d.v; U.soft(); },
    'change:comp'(t) { ui.comp = t.value; U.soft(); }
  });
  U.views.competitions = viewCompetitions;

  /* =========================================================
     NATIONAL TEAM
     ========================================================= */
  function nextWindow(n) {
    const s = G();
    return (s.intlWindows || []).filter(w => w.end >= s.date && s.fixtures.some(f => f.kind === 'intl' && f.date >= w.start && f.date <= w.end && (f.home === n.id || f.away === n.id))).sort((a, b) => a.start < b.start ? -1 : 1)[0];
  }
  U.nationCard = function () {
    const s = G(), n = U.myNation(), m = s.manager;
    const rank = TL.ranking(s).findIndex(x => x.id === n.id) + 1;
    const w = nextWindow(n);
    const nf = TL.nextFixtureFor(s, n.id);
    const conf = Math.round(m.nboard.confidence);
    const cls = conf >= 60 ? 'good' : conf >= 35 ? 'warn' : 'bad';
    const set = w && n.squadSetFor === w.start;
    return `<section class="card card-b stack" style="gap:10px"><div class="row between"><span class="row" style="gap:10px">${crest(n, 34)}<b>${esc(n.name)}</b></span><span class="muted">World #${rank}</span></div>
      <div class="muted" style="font-size:.85rem">Objective: ${esc(m.nboard.target || '')}</div>
      <div class="meter ${cls}"><i style="width:${conf}%"></i></div>
      <div style="font-size:.88rem">${nf ? `Next: ${nf.home === n.id ? 'v' : 'at'} <b>${esc(U.teamName(nf.home === n.id ? nf.away : nf.home))}</b> · ${esc(TL.compName(s, nf))} · ${TL.fmtDate(nf.date)}` : '<span class="muted">No international matches scheduled.</span>'}</div>
      ${w ? `<div class="row between"><span class="${set ? '' : 'warn-text'}" style="font-size:.85rem">${set ? 'Squad named for the next window' : `Name your squad by ${TL.fmtDate(w.callup)}`}</span><button class="btn sm ${set ? '' : 'primary'}" data-act="tab" data-v="nation">Squad</button></div>` : ''}</section>`;
  };
  function viewNation() {
    const s = G(), n = U.myNation(); if (!n) return U.needClub();
    const m = s.manager;
    const w = nextWindow(n);
    const size = w && w.tournament ? 26 : 23;
    if (!ui.nsel || ui.nselFor !== n.id + (w ? w.start : '')) { ui.nsel = n.players.filter(id => P(id)).slice(); ui.nselFor = n.id + (w ? w.start : ''); }
    const sel = ui.nsel;
    if (TL.deepenNationPool && TL.deepenNationPool(s, n, 50)) U.autosave();
    const pool = TL.nationPool(s, n.code);
    ui.npos = ui.npos || 'ALL'; ui.nsort = ui.nsort || 'ovr'; ui.nq = ui.nq || '';
    const info = p => { const st = p.clubId ? { apps: p.stats.apps, goals: p.stats.goals, assists: p.stats.assists, avg: p.stats.rated ? p.stats.ratingSum / p.stats.rated : 0 } : TL.abroadStats(s, p); const form = p.clubId && p.form && p.form.length ? p.form.reduce((a, b) => a + b, 0) / p.form.length : st.avg; return Object.assign(st, { form }); };
    const SORT = { ovr: p => -p.ovr, form: p => -info(p).form, caps: p => -(p.intl ? p.intl.caps : 0), age: p => p.age, goals: p => -info(p).goals };
    const q = ui.nq.trim().toLowerCase();
    const list = pool.filter(p => (ui.npos === 'ALL' || TL.POS_GROUP[p.pos] === ui.npos) && (!q || p.name.toLowerCase().includes(q) || (p.abroad || U.clubName(p.clubId)).toLowerCase().includes(q)))
      .sort((a, b) => SORT[ui.nsort](a) - SORT[ui.nsort](b)).slice(0, 150);
    const counts = { GK: 0, DEF: 0, MID: 0, ATT: 0 }; sel.forEach(id => { const p = P(id); if (p) counts[TL.POS_GROUP[p.pos]]++; });
    const rank = TL.ranking(s).findIndex(x => x.id === n.id) + 1;
    const fx = s.fixtures.filter(f => f.home === n.id || f.away === n.id).sort((a, b) => a.date < b.date ? -1 : 1);
    return `<div class="page-h"><div><div class="eyebrow">${n.confed} · World ranking #${rank} · ${n.elo} pts</div><h1>${esc(n.name)}</h1></div>
      <div class="row"><button class="btn" data-act="n-use-rec">Use assistant's squad</button><button class="btn primary" data-act="n-confirm" ${sel.length < 16 ? 'disabled' : ''}>Confirm squad (${sel.length}/${size})</button></div></div>
      <div class="kpis"><div class="kpi"><span>Objective</span><b style="font-size:1rem">${esc(m.nboard.target || '–')}</b></div><div class="kpi"><span>Federation confidence</span><b>${Math.round(m.nboard.confidence)}%</b><div class="meter ${m.nboard.confidence >= 60 ? 'good' : m.nboard.confidence >= 35 ? 'warn' : 'bad'}"><i style="width:${m.nboard.confidence}%"></i></div></div><div class="kpi"><span>Record</span><b>${m.nrec.w}W ${m.nrec.d}D ${m.nrec.l}L</b></div><div class="kpi"><span>Next window</span><b style="font-size:1rem">${w ? `${TL.fmtDate(w.start)} – ${TL.fmtDate(w.end)}` : 'None scheduled'}</b><small>${w ? (n.squadSetFor === w.start ? 'Squad confirmed' : `Squad deadline ${TL.fmtDate(w.callup)}`) : ''}</small></div></div>
      <div class="grid g-home">
        <section class="card"><div class="card-h"><h3>Eligible players (${pool.length})</h3><div class="filters">${['ALL', 'GK', 'DEF', 'MID', 'ATT'].map(g => `<button class="chip ${ui.npos === g ? 'on' : ''}" data-act="n-pos" data-v="${g}">${g === 'ALL' ? 'All' : g} ${g !== 'ALL' ? `(${counts[g]})` : ''}</button>`).join('')}</div></div>
          <div class="card-b row" style="gap:10px;padding-top:0"><input class="input" style="flex:1;min-width:160px" data-input="nq" placeholder="Search name, club or league" value="${esc(ui.nq)}"><select class="input" style="width:auto" data-change="nsort" aria-label="Sort">${[['ovr', 'Best ability'], ['form', 'Best form'], ['goals', 'Most goals'], ['caps', 'Most caps'], ['age', 'Youngest']].map(([k, l]) => `<option value="${k}" ${ui.nsort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th></th><th>Pos</th><th>Name</th><th class="r">Age</th><th>Club · league</th><th class="c">Abl</th><th class="r">Apps</th><th class="r">Gls</th><th class="r">Ast</th><th class="r">Form</th><th class="r">Caps</th><th>Fitness</th><th></th></tr></thead><tbody>
          ${list.map(p => { const on = sel.includes(p.id), st = info(p), lg = p.clubId ? (TL.leagueDef(s, s.clubs[p.clubId].leagueId) || {}).name : ''; return `<tr class="click ${on ? 'sel' : ''}" data-act="n-toggle" data-id="${p.id}"><td><span class="checkbox ${on ? 'on' : ''}" aria-hidden="true">${on ? '✓' : ''}</span></td><td>${U.posTag(p.pos)}</td><td><b>${esc(p.name)}</b> ${p.injury > 0 ? `<span class="tag inj">Inj ${p.injury}d</span>` : ''}${n.players.includes(p.id) ? ' <span class="tag yth">Last squad</span>' : ''}</td><td class="r">${p.age}</td><td class="muted" style="white-space:normal;min-width:140px">${esc(p.abroad ? p.abroad : U.clubName(p.clubId))}${lg ? `<br><small>${esc(lg)}</small>` : ''}</td><td class="c">${U.ovrTag(p.ovr)}</td><td class="r">${st.apps}</td><td class="r">${st.goals}</td><td class="r">${st.assists}</td><td class="r">${st.form ? U.ratingTag(st.form) : '–'}${st.est ? '<sup class="faint" title="Estimated: plays outside the simulated leagues">*</sup>' : ''}</td><td class="r">${p.intl ? `${p.intl.caps}<small class="muted"> / ${p.intl.goals}g</small>` : 0}</td><td>${U.condBar(p.cond)}</td><td><button class="btn sm ghost" data-act="player" data-id="${p.id}" aria-label="Profile of ${esc(p.name)}">Info</button></td></tr>`; }).join('') || '<tr><td colspan="13" class="empty">No players match.</td></tr>'}
          </tbody></table></div><div class="card-b muted" style="font-size:.78rem">* Season numbers for players outside the simulated leagues are scouting estimates. Tap Info for a full profile.</div></section>
        <div class="stack">
          ${(() => {
            const rec = TL.recommendSquad(s, n, size), recIds = rec.picks.map(r => r.p.id);
            const add = rec.picks.filter(r => !sel.includes(r.p.id)), drop = sel.filter(id => !recIds.includes(id)).map(P).filter(Boolean);
            const row = (r, tag) => `<div class="rec-row"><span class="row" style="gap:6px">${U.posTag(r.p.pos)}<a href="#" data-act="player" data-id="${r.p.id}"><b>${esc(r.p.name)}</b></a> ${tag || ''}</span><small class="muted">${esc(r.why.join(' · '))}</small></div>`;
            return `<section class="card rec"><div class="card-h"><h3>Assistant's recommendation</h3><button class="btn sm primary" data-act="n-use-rec">Use all ${size}</button></div>
              <div class="card-b stack" style="gap:10px">
                <div class="muted" style="font-size:.84rem">Based on current form, goals, game time, fitness and experience, not only ability.</div>
                ${sel.length ? (add.length || drop.length ? `${add.length ? `<div><div class="eyebrow" style="margin-bottom:4px">Bring in</div>${add.slice(0, 6).map(r => row(r, `<button class="btn sm ghost" data-act="n-toggle" data-id="${r.p.id}">Add</button>`)).join('')}</div>` : ''}${drop.length ? `<div><div class="eyebrow" style="margin-bottom:4px">Consider leaving out</div>${drop.slice(0, 6).map(p => { const st = TL.playerSeason(s, p); return `<div class="rec-row"><span class="row" style="gap:6px">${U.posTag(p.pos)}<b>${esc(p.name)}</b> <button class="btn sm ghost" data-act="n-toggle" data-id="${p.id}">Drop</button></span><small class="muted">${p.injury > 0 ? 'Injured · ' : ''}${st.apps} apps, form ${st.form ? st.form.toFixed(1) : '–'}</small></div>`; }).join('')}</div>` : ''}` : '<div style="color:var(--win)">Your selection matches my recommendation.</div>') : `<div>${rec.picks.slice(0, 8).map(r => row(r)).join('')}<div class="muted" style="font-size:.8rem;margin-top:6px">…and ${rec.picks.length - 8} more. Press "Use all" to load the full squad.</div></div>`}
                ${rec.nextBest.length ? `<div class="muted" style="font-size:.8rem">Next in line: ${rec.nextBest.slice(0, 4).map(r => esc(r.p.name)).join(', ')}</div>` : ''}
              </div></section>`;
          })()}
          <section class="card"><div class="card-h"><h3>Selected (${sel.length})</h3><span class="muted" style="font-size:.8rem">GK ${counts.GK} · DEF ${counts.DEF} · MID ${counts.MID} · ATT ${counts.ATT}</span></div>
            <div class="tbl-wrap"><table class="tbl compact"><tbody>${sel.map(P).filter(Boolean).sort((a, b) => TL.POSITIONS.indexOf(a.pos) - TL.POSITIONS.indexOf(b.pos)).map(p => `<tr class="click" data-act="n-toggle" data-id="${p.id}"><td>${U.posTag(p.pos)}</td><td>${esc(p.name)}</td><td class="c">${U.ovrTag(p.ovr)}</td></tr>`).join('') || '<tr><td class="empty">No players selected.</td></tr>'}</tbody></table></div>
            <div class="card-b muted" style="font-size:.8rem">Pick ${size} players including at least 2 goalkeepers. Set the line-up on the Tactics screen.</div></section>
          <section class="card"><div class="card-h"><h3>Fixtures & results</h3><button class="btn sm ghost" data-act="tab" data-v="tactics">Tactics</button></div>${fixtureList(fx.slice(-14))}</section>
        </div></div>`;
  }
  Object.assign(U.actions, {
    'n-pos'(d) { ui.npos = d.v; U.soft(); },
    'change:nsort'(t) { ui.nsort = t.value; U.soft(); },
    'input:nq'(t) { ui.nq = t.value; clearTimeout(ui.nqT); ui.nqT = setTimeout(() => { U.soft(); const el = document.querySelector('[data-input="nq"]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 300); },
    'n-toggle'(d) { const n = U.myNation(), w = nextWindow(n), size = w && w.tournament ? 26 : 23; const i = ui.nsel.indexOf(d.id); if (i >= 0) ui.nsel.splice(i, 1); else if (ui.nsel.length >= size) toast(`The squad is full (${size}). Remove someone first.`); else ui.nsel.push(d.id); U.soft(); },
    'n-use-rec'() { const n = U.myNation(), w = nextWindow(n); ui.nsel = TL.recommendSquad(G(), n, w && w.tournament ? 26 : 23).picks.map(r => r.p.id); toast("Assistant's squad loaded. Press Confirm squad to name it."); U.soft(); },
    'n-auto'() { const n = U.myNation(), w = nextWindow(n); TL.ensureNationPlayers(G(), n, new TL.Rng(G().rngS), w && w.tournament ? 26 : 23); const prev = n.players; TL.callUp(G(), n, w && w.tournament ? 26 : 23); ui.nsel = n.players.slice(); n.players = prev; U.soft(); },
    'n-confirm'() {
      const n = U.myNation(), w = nextWindow(n);
      const gks = ui.nsel.filter(id => P(id) && P(id).pos === 'GK').length;
      if (gks < 2) return toast('Pick at least two goalkeepers.');
      n.players = ui.nsel.slice(); n.lineup = null; TL.autoLineup(G(), n);
      if (w) n.squadSetFor = w.start;
      toast(`${n.players.length}-man squad confirmed.`); U.autosave(); U.soft();
    }
  });
  U.views.nation = viewNation;

  function viewNationModal(md) {
    const s = G(), n = s.nations[md.id];
    const pool = TL.nationPool(s, n.code).slice(0, 18);
    const rank = TL.ranking(s).findIndex(x => x.id === n.id) + 1;
    const fx = s.fixtures.filter(f => (f.home === n.id || f.away === n.id) && f.played).slice(-6);
    return { html: `<div class="modal-h">${crest(n, 50)}<div><div class="eyebrow">${n.confed} · World #${rank} · ${n.elo} pts</div><h2 style="font-size:1.6rem;margin-top:3px">${esc(n.name)}</h2></div><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div>
      <div class="modal-b stack">
        ${n.history.length ? `<div class="muted">Titles: ${n.history.map(h => `${esc(h.won)}`).join(', ')}</div>` : ''}
        ${fx.length ? `<div><h4 class="eyebrow" style="margin:0 0 8px">Recent results</h4>${fixtureList(fx)}</div>` : ''}
        <div><h4 class="eyebrow" style="margin:0 0 8px">Leading players</h4><div class="tbl-wrap"><table class="tbl compact"><tbody>${pool.map(p => `<tr class="click" data-act="player" data-id="${p.id}"><td>${U.posTag(p.pos)}</td><td><b>${esc(p.name)}</b></td><td class="muted">${esc(p.abroad || U.clubName(p.clubId))}</td><td class="c">${U.ablTxt(p)}</td></tr>`).join('') || '<tr><td class="empty">No known players.</td></tr>'}</tbody></table></div></div>
      </div>` };
  }
  U.modals.nation = viewNationModal;
  U.actions['nation-modal'] = d => { ui.modal = { type: 'nation', id: d.id }; U.render(); };

  /* =========================================================
     MANAGER: profile, jobs, trophies, achievements
     ========================================================= */
  function viewManager() {
    const s = G(), m = s.manager;
    const c = U.me(), n = U.myNation();
    const total = m.wins + m.draws + m.losses;
    const vac = s.vacancies.slice().sort((a, b) => TL.jobRep(s, b) - TL.jobRep(s, a));
    const ach = Object.entries(TL.ACHIEVEMENTS);
    const got = ach.filter(([k]) => m.achievements[k]).length;
    return `<div class="page-h"><div><div class="eyebrow">Manager profile</div><h1>${esc(m.name)}</h1></div></div>
      <div class="kpis"><div class="kpi"><span>Reputation</span><b>${Math.round(m.rep)}</b><div class="meter"><i style="width:${m.rep}%"></i></div></div><div class="kpi"><span>Club record</span><b>${m.wins}W ${m.draws}D ${m.losses}L</b><small>${total ? Math.round(100 * m.wins / total) + '% wins' : 'No matches yet'}</small></div><div class="kpi"><span>International record</span><b>${m.nrec.w}W ${m.nrec.d}D ${m.nrec.l}L</b></div><div class="kpi"><span>Trophies</span><b>${m.trophies.length}</b><small>${got}/${ach.length} achievements</small></div></div>
      <div class="grid g-2">
        <section class="card card-b stack" style="gap:12px"><h3>Current jobs</h3>
          ${c ? `<div class="row between"><span class="row" style="gap:10px">${crest(c, 30)}<b>${esc(c.name)}</b></span><button class="btn sm danger" data-act="resign" data-v="club">Resign</button></div>` : ''}
          ${n ? `<div class="row between"><span class="row" style="gap:10px">${crest(n, 30)}<b>${esc(n.name)}</b></span><button class="btn sm danger" data-act="resign" data-v="nation">Resign</button></div>` : ''}
          ${!c && !n ? '<div class="muted">You are out of work. Apply for one of the vacancies.</div>' : ''}
          <div class="muted" style="font-size:.82rem">You can manage one club and one country at the same time.</div></section>
        <section class="card"><div class="card-h"><h3>Vacancies</h3><span class="muted" style="font-size:.82rem">${vac.length} open</span></div>
          ${vac.length ? `<div class="tbl-wrap"><table class="tbl compact"><tbody>${vac.map(v => { const t = TL.team(s, v.teamId), ch = TL.jobChance(s, v, m), applied = m.applied.some(a => a.vid === v.id); const mineNow = v.teamId === m.clubId || v.teamId === m.nationId; return mineNow ? '' : `<tr><td>${teamCell(v.teamId, 20)}</td><td class="muted">${v.type === 'club' ? esc((TL.leagueDef(s, t.leagueId) || {}).name || '') : 'National team'}</td><td class="r" style="color:${ch >= 0.6 ? 'var(--win)' : ch >= 0.3 ? 'var(--warn)' : 'var(--loss)'}">${ch >= 0.6 ? 'Good chance' : ch >= 0.3 ? 'Possible' : 'Unlikely'}</td><td class="r"><button class="btn sm ${applied ? '' : 'primary'}" data-act="apply-job" data-id="${v.id}" ${applied ? 'disabled' : ''}>${applied ? 'Applied' : 'Apply'}</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No vacancies right now. Check back later.</div>'}</section>
      </div>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h3>Trophy cabinet</h3></div>${m.trophies.length ? `<div class="tbl-wrap"><table class="tbl compact"><tbody>${m.trophies.slice().reverse().map(t => `<tr><td>${U.seasonLabel(t.season)}</td><td><b>${esc(t.name)}</b></td><td>${teamCell(t.team, 18)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No trophies yet.</div>'}</section>
        <section class="card"><div class="card-h"><h3>Career history</h3></div>${m.career.length ? `<div class="tbl-wrap"><table class="tbl compact"><tbody>${m.career.slice().reverse().map(x => `<tr><td>${U.seasonLabel(x.season)}</td><td>${teamCell(x.club, 18)}</td><td class="r">${x.sacked ? '<span class="tag inj">Sacked</span>' : x.resigned ? '<span class="tag sus">Resigned</span>' : `${TL.ordinal(x.pos)} <span class="muted">(target ${TL.ordinal(x.target)})</span>`}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Your first season is under way.</div>'}</section>
      </div>
      <section class="card" id="saved-mail"><div class="card-h"><h3>Saved messages</h3><span class="muted" style="font-size:.82rem">${(m.saved || []).length} saved</span></div>
        ${(m.saved || []).length ? (m.saved || []).map(x => `<div class="mail read ${ui.savedOpen === x.id ? 'sel' : ''}" data-act="saved-open" data-id="${x.id}" role="button" tabindex="0"><span class="dot"></span><span style="flex:1;min-width:0"><span class="who"><span>${esc(x.from)}</span><span>${TL.fmtDate(x.date, true)}</span></span><span class="subj">${esc(x.subject)}</span>${ui.savedOpen === x.id ? `<div class="mail-body" style="margin-top:10px">${esc(x.body)}</div><div class="row mail-tools"><button class="btn sm ghost" data-act="mail-del" data-id="${x.id}">Delete</button></div>` : ''}</span></div>`).join('') : '<div class="empty">Open a message in your inbox and choose "Save to folder" to keep it here.</div>'}</section>
      <section class="card"><div class="card-h"><h3>Achievements</h3><span class="muted" style="font-size:.82rem">${got} of ${ach.length}</span></div><div class="ach-grid">${ach.map(([k, [t, d]]) => `<div class="ach ${m.achievements[k] ? 'on' : ''}"><span class="ic">${m.achievements[k] ? ICON.starOn : ICON.star}</span><div><b>${esc(t)}</b><small>${esc(d)}${m.achievements[k] ? ' · ' + TL.fmtDate(m.achievements[k], true) : ''}</small></div></div>`).join('')}</div></section>`;
  }
  Object.assign(U.actions, {
    'apply-job'(d) { toast(TL.applyJob(G(), +d.id)); U.autosave(); U.soft(); },
    resign(d) { const t = d.v === 'club' ? U.me() : U.myNation(); U.ask(`Resign from ${t.name}?`, 'You will leave the job immediately. Your reputation takes no hit, but you will need to find a new job.', 'Resign', () => { TL.resign(G(), d.v); toast('You have resigned.'); U.autosave(); }, true); }
  });
  U.views.manager = viewManager;

  /* =========================================================
     PRESS CONFERENCE (modal after matches)
     ========================================================= */
  U.modals.press = md => {
    md.tags = md.tags || [];
    if (md.i >= md.qs.length) {
      if (md.headline === undefined) { const f = G().fixtures.find(x => x.id === md.fid); md.headline = f ? TL.pressHeadline(G(), f, md.tags, md.teamId) : null; U.autosave(); }
      return { cls: 'narrow', html: `<div class="modal-h"><h3>Press conference over</h3><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div><div class="modal-b stack" style="gap:14px">
        ${md.headline ? `<div class="headline"><div class="eyebrow">Tomorrow's papers</div><b>${esc(md.headline)}</b></div>` : '<p class="muted" style="margin:0">A quiet press conference. Nothing for the back pages.</p>'}
        <p class="muted" style="margin:0;font-size:.85rem">Players, the board and the fans have taken note of what you said.</p>
        <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">Done</button></div></div>` };
    }
    const q = md.qs[md.i];
    const head = `<div class="modal-h"><div><div class="eyebrow">Press conference · question ${md.i + 1} of ${md.qs.length}</div><div class="muted" style="font-size:.82rem;margin-top:4px">${esc(q.who || 'Reporter')}, ${esc(q.outlet || 'Press')}</div><h3 style="margin-top:4px">${ICON.mic} ${esc(q.q)}</h3></div><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div>`;
    if (md.reaction) return { cls: 'narrow', html: `${head}<div class="modal-b stack" style="gap:12px"><div class="talk-reaction"><span class="muted" style="font-weight:400">You: “${esc(md.answered)}”</span><br>${esc(md.reaction)}</div><div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="press-next">${md.i + 1 < md.qs.length ? 'Next question' : 'Finish'}</button></div></div>` };
    return { cls: 'narrow', html: `${head}
      <div class="modal-b stack" style="gap:8px">${q.a.map((a, i) => `<button class="btn answer" data-act="press-answer" data-v="${i}"><span class="tone-lbl">${esc(TL.PRESS_TONE ? (TL.PRESS_TONE[a[1].tag] || '') : '')}</span>${esc(a[0])}</button>`).join('')}<button class="btn ghost sm" data-act="press-answer" data-v="-1">No comment</button></div>` };
  };
  U.actions['press-answer'] = d => {
    const md = ui.modal, i = +d.v, q = md.qs[md.i];
    if (i >= 0) { const eff = q.a[i][1]; md.reaction = TL.pressAnswer(G(), eff) || 'The journalists move on.'; md.answered = q.a[i][0]; md.tags.push(eff); }
    else { md.reaction = 'A few groans. The journalists move on.'; md.answered = 'No comment.'; }
    if (ui.post) ui.post.pressDone = true;
    U.render();
  };
  U.actions['press-next'] = () => { const md = ui.modal; md.reaction = null; md.answered = null; md.i++; U.render(); };

  /* =========================================================
     UNVEILING: the new signing holds up his shirt with the manager
     ========================================================= */
  const SKINS = ['#f1c9a5', '#e0ac69', '#c68642', '#8d5524', '#5a3a22', '#f5d0b0'], HAIRS = ['#1b1410', '#2b1d14', '#3d2a1c', '#5b3a22', '#c8a15a', '#8a4b2a'];
  const pick = (arr, str) => arr[[...String(str)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % arr.length];
  const face = (x, y, r, skin, hair) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${skin}"/><path d="M${x - r * 1.02} ${y - r * 0.1} A ${r * 1.04} ${r * 1.04} 0 0 1 ${x + r * 1.02} ${y - r * 0.1} L ${x + r * 0.85} ${y - r * 0.35} Q ${x} ${y - r * 0.75} ${x - r * 0.85} ${y - r * 0.35} Z" fill="${hair}"/>
    <ellipse cx="${x - r * 0.36}" cy="${y + r * 0.02}" rx="${r * 0.17}" ry="${r * 0.12}" fill="#f4f1ea"/><ellipse cx="${x + r * 0.36}" cy="${y + r * 0.02}" rx="${r * 0.17}" ry="${r * 0.12}" fill="#f4f1ea"/><circle cx="${x - r * 0.34}" cy="${y + r * 0.03}" r="${r * 0.08}" fill="#16120f"/><circle cx="${x + r * 0.38}" cy="${y + r * 0.03}" r="${r * 0.08}" fill="#16120f"/>
    <path d="M${x - r * 0.52} ${y - r * 0.22} l ${r * 0.32} -${r * 0.05} M${x + r * 0.2} ${y - r * 0.27} l ${r * 0.32} ${r * 0.05}" stroke="${hair}" stroke-width="${r * 0.08}" stroke-linecap="round"/>
    <path d="M${x - r * 0.3} ${y + r * 0.4} Q ${x} ${y + r * 0.65} ${x + r * 0.3} ${y + r * 0.4}" stroke="#9b4a4a" stroke-width="${r * 0.09}" fill="none" stroke-linecap="round"/>`;
  U.unveilScene = (p, c, num, flashes) => {
    const ink = U.inkOn(c.c1, c.c2), mgr = G().manager, sur = U.surname(p.name).toUpperCase();
    const pSkin = pick(SKINS, p.id), pHair = pick(HAIRS, p.id + 'h'), mSkin = pick(SKINS, mgr.name), mHair = pick(HAIRS, mgr.name + 'x');
    let wall = '';
    for (let r = 0; r < 5; r++) for (let k = 0; k < 9; k++) wall += (r + k) % 2 ? `<text x="${20 + k * 72}" y="${40 + r * 38}" font-size="13" font-weight="700" fill="${ink}" opacity=".22" font-family="Bahnschrift, sans-serif">${esc(c.id)}</text>` : `<text x="${20 + k * 72}" y="${40 + r * 38}" font-size="9" font-weight="700" letter-spacing="1" fill="${ink}" opacity=".18" font-family="Bahnschrift, sans-serif">TOUCHLINE</text>`;
    const fl = flashes ? Array.from({ length: 9 }, (_, i) => `<circle class="flash" cx="${40 + (i * 73) % 580}" cy="${250 + (i * 37) % 50}" r="${6 + i % 3 * 3}" style="animation-delay:${(i * 0.37) % 2.2}s"/>`).join('') : '';
    return `<svg viewBox="0 0 640 320" class="unveil-scene" role="img" aria-label="${esc(p.name)} holds up his number ${num} shirt with ${esc(mgr.name)}">
      <defs><linearGradient id="uw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.c1}"/><stop offset="1" stop-color="${U.inkOn(c.c1) === '#fff' ? '#0b1120' : '#d9dee8'}"/></linearGradient>
      <radialGradient id="us" cx=".5" cy=".3" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
      <rect width="640" height="320" fill="url(#uw)"/>${wall}
      <ellipse cx="320" cy="120" rx="300" ry="160" fill="url(#us)"/>
      <rect y="268" width="640" height="52" fill="#141b2b"/><rect y="266" width="640" height="3" fill="${c.c2}" opacity=".7"/>
      <g transform="translate(0,0)">
        <!-- manager -->
        <path d="M168 300 L176 186 Q210 166 244 186 L252 300 Z" fill="#1f2633"/><path d="M200 182 L210 214 L220 182 Z" fill="#f4f4f4"/><path d="M207 190 L213 190 L215 230 L210 236 L205 230 Z" fill="${c.c1}"/>
        <rect x="203" y="160" width="14" height="16" fill="${mSkin}"/>${face(210, 146, 21, mSkin, mHair)}
        <path d="M240 196 Q262 196 268 160" stroke="#1f2633" stroke-width="13" fill="none" stroke-linecap="round"/><circle cx="268" cy="158" r="7" fill="${mSkin}"/>
        <!-- player -->
        <path d="M388 300 L396 186 Q430 166 464 186 L472 300 Z" fill="${U.inkOn(c.c1) === '#fff' ? '#1d2230' : '#2a3142'}"/><path d="M420 182 L430 200 L440 182" stroke="${c.c2}" stroke-width="3" fill="none"/>
        <rect x="423" y="160" width="14" height="16" fill="${pSkin}"/>${face(430, 146, 21, pSkin, pHair)}
        <path d="M400 196 Q378 196 372 160" stroke="${U.inkOn(c.c1) === '#fff' ? '#1d2230' : '#2a3142'}" stroke-width="13" fill="none" stroke-linecap="round"/><circle cx="372" cy="158" r="7" fill="${pSkin}"/>
        <!-- the shirt, held up between them (back view: name and number) -->
        <path d="M268 160 L292 150 L348 150 L372 160 L384 196 L362 202 L360 262 L280 262 L278 202 L256 196 Z" fill="${c.c1}" stroke="${c.c2}" stroke-width="3"/>
        <path d="M300 150 Q320 160 340 150" stroke="${c.c2}" stroke-width="3" fill="none"/>
        <text x="320" y="182" text-anchor="middle" font-family="Bahnschrift, 'Arial Narrow', sans-serif" font-weight="700" font-size="${sur.length > 9 ? 12 : 15}" letter-spacing="1" fill="${ink}">${esc(sur)}</text>
        <text x="320" y="246" text-anchor="middle" font-family="Bahnschrift, 'Arial Narrow', sans-serif" font-weight="700" font-size="58" fill="${ink}" stroke="${c.c2}" stroke-width="1.5" paint-order="stroke">${num}</text>
      </g>
      <text x="210" y="292" text-anchor="middle" font-size="12" font-weight="600" fill="#dfe6f2">${esc(mgr.name)}</text>
      <text x="430" y="292" text-anchor="middle" font-size="12" font-weight="600" fill="#dfe6f2">${esc(p.name)}</text>
      ${fl}
    </svg>`;
  };
  U.modals.unveil = md => {
    const s = G(), p = P(md.id), c = s.clubs[p.clubId];
    if (!p || !c) return { html: '<div class="modal-b">Player not found.</div>' };
    const close = `<button class="x" data-act="close" aria-label="Close">${ICON.close}</button>`;
    if (md.step === 'number') {
      const nums = TL.freeShirtNumbers(s, c, p);
      md.num = md.num || nums.pref[0] || nums.all[0];
      return { html: `<div class="modal-h"><div><div class="eyebrow">Unveiling · ${esc(c.stadium)}</div><h2 style="font-size:1.4rem;margin-top:3px">Pick ${esc(p.name)}'s shirt number</h2></div>${close}</div>
        <div class="modal-b stack" style="gap:14px">${U.unveilScene(p, c, md.num, false)}
          ${nums.pref.length ? `<div><div class="eyebrow" style="margin-bottom:6px">Suggested for a ${p.pos}</div><div class="num-grid">${nums.pref.map(n => `<button class="${md.num === n ? 'on' : ''}" data-act="uv-num" data-v="${n}">${n}</button>`).join('')}</div></div>` : ''}
          <div><div class="eyebrow" style="margin-bottom:6px">All free numbers</div><div class="num-grid small">${nums.all.map(n => `<button class="${md.num === n ? 'on' : ''}" data-act="uv-num" data-v="${n}">${n}</button>`).join('')}</div></div>
          <div class="row" style="justify-content:flex-end"><button class="btn primary big" data-act="uv-start">Walk out to the cameras ${ICON.play}</button></div></div>` };
    }
    if (md.step === 'qa') {
      const q = md.qs[md.i];
      const head = `<div class="modal-h"><div><div class="eyebrow">Unveiling press conference · question ${md.i + 1} of ${md.qs.length}</div><div class="muted" style="font-size:.82rem;margin-top:4px">${esc(q.who)} · to ${q.to === 'player' ? esc(p.name) : 'you'}</div><h3 style="margin-top:4px">${ICON.mic} ${esc(q.q)}</h3></div>${close}</div>`;
      const scene = `<div class="unveil-mini">${U.unveilScene(p, c, md.num, true)}</div>`;
      if (q.to === 'player') return { html: `${head}<div class="modal-b stack" style="gap:12px">${scene}<div class="talk-reaction"><span class="muted" style="font-weight:400">${esc(p.name)}:</span><br>“${esc(q.ans)}”</div><div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="uv-next">Next question</button></div></div>` };
      if (md.reaction) return { html: `${head}<div class="modal-b stack" style="gap:12px">${scene}<div class="talk-reaction"><span class="muted" style="font-weight:400">You: “${esc(md.answered)}”</span><br>${esc(md.reaction)}</div><div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="uv-next">${md.i + 1 < md.qs.length ? 'Next question' : 'Finish'}</button></div></div>` };
      return { html: `${head}<div class="modal-b stack" style="gap:8px">${scene}${q.a.map((a, i) => `<button class="btn answer" data-act="uv-answer" data-v="${i}"><span class="tone-lbl">${esc(TL.PRESS_TONE[a[1].tag] || '')}</span>${esc(a[0])}</button>`).join('')}</div>` };
    }
    const r = md.result;
    return { html: `<div class="modal-h"><div><div class="eyebrow">${r.crowd.toLocaleString('en-GB')} fans at ${esc(c.stadium)}</div><h2 style="font-size:1.4rem;margin-top:3px">${esc(p.name)} is unveiled</h2></div>${close}</div>
      <div class="modal-b stack" style="gap:14px">${U.unveilScene(p, c, md.num, true)}
        <div class="headline"><div class="eyebrow">Tomorrow's papers</div><b>${esc(r.headline)}</b></div>
        <div class="row" style="justify-content:flex-end">${TL.merchEligible(s, p) ? `<button class="btn" data-act="merch-open" data-id="${p.id}">${TL.merchFor(s, p.id) ? 'View merchandise' : 'Launch his merchandise'}</button>` : ''}<button class="btn primary" data-act="close">Done</button></div></div>` };
  };
  Object.assign(U.actions, {
    'uv-num'(d) { ui.modal.num = +d.v; U.render(); },
    'uv-start'() {
      const md = ui.modal, p = P(md.id), c = G().clubs[p.clubId];
      md.qs = TL.unveilQuestions(G(), p).map(q => Object.assign(q, { q: q.q.replace('{num}', md.num), ans: q.ans === '{numReason}' ? TL.numberReason(p, md.num, c) : q.ans }));
      md.i = 0; md.effects = []; md.step = 'qa'; U.render();
    },
    'uv-answer'(d) { const md = ui.modal, a = md.qs[md.i].a[+d.v]; md.reaction = TL.pressAnswer(G(), a[1]) || 'The journalists scribble.'; md.answered = a[0]; md.effects.push(a[1]); U.render(); },
    'uv-next'() {
      const md = ui.modal, q = md.qs[md.i];
      if (q.to === 'player') md.effects.push(q.eff);
      md.reaction = null; md.answered = null; md.i++;
      if (md.i >= md.qs.length) { md.result = TL.finishUnveil(G(), P(md.id), md.num, md.effects); md.step = 'done'; U.autosave(); }
      U.render();
    }
  });

  /* =========================================================
     TUTORIAL (first-time tips on the home screen)
     ========================================================= */
  const TIPS = [
    ['Welcome to Touchline', 'Next day (Space bar) moves time forward one day, so you have time to train, scout and do deals. Skip to next event (S key) moves on day by day until a match or something that needs you.'],
    ['Every day counts', 'The Today card shows the training session, matches, the transfer window countdown and the treatment room. Plan the training week on the Training screen.'],
    ['Your inbox', 'The board, your staff, agents and the media write to you here. Messages with buttons need a decision, for example a transfer offer or a job offer.'],
    ['Set up your team', 'Open Tactics to choose a formation and line-up. Tap one player and then another to swap them. Squad shows condition, morale and form.'],
    ['Transfers', 'Search for players on the Transfers screen. Ability shows as a range until your scouts report. Make an offer, then agree personal terms.'],
    ['Develop players', 'Training sets the weekly focus. Young players grow fastest with good coaches, facilities and playing time. The Academy holds your U18 and U21 prospects.'],
    ['Saving', 'The game autosaves after every matchday. Settings lets you export a save file to move your career to another device.']
  ];
  U.tutorialCard = function () {
    const m = G().manager;
    if (!U.settings.tutorial || m.tutorial >= TIPS.length) return '';
    const [t, b] = TIPS[m.tutorial];
    return `<section class="card card-b tip"><div class="row between"><div><div class="eyebrow">Tip ${m.tutorial + 1} of ${TIPS.length}</div><h3 style="margin:4px 0 6px">${esc(t)}</h3><p class="muted" style="margin:0">${esc(b)}</p></div><div class="row"><button class="btn sm ghost" data-act="tip-off">Hide tips</button><button class="btn sm primary" data-act="tip-next">${m.tutorial + 1 < TIPS.length ? 'Next tip' : 'Got it'}</button></div></div></section>`;
  };
  Object.assign(U.actions, {
    'tip-next'() { G().manager.tutorial++; U.soft(); },
    'tip-off'() { U.settings.tutorial = false; U.saveSettings(); U.soft(); }
  });
})();
