/* Touchline — club screens: academy, club (facilities, projects, records, badge & kit), settings & saves. */
(function () {
  const TL = window.TL, U = TL.UI;
  const { esc, crest, ICON, ui, toast } = U;
  const G = () => U.G;
  const P = id => U.G.players[id];
  U.pack = U.readJSON(U.KEY + 'pack', null);

  /* ---------- Academy ---------- */
  function viewAcademy() {
    const s = G(), c = U.me(); if (!c) return U.needClub();
    const all = (c.academy || []).map(P).filter(Boolean).sort((a, b) => b.pot - a.pot);
    const list = all.filter(p => !p.onLoan);
    const away = all.filter(p => p.onLoan).concat(TL.loanedOut(s, c.id).filter(p => p.fromAcademy));
    const team = t => list.filter(p => t === 'U18' ? p.age <= 18 : p.age >= 19);
    const used = TL.createdThisSeason(s, c);
    // youth trials
    const tr = c.trials;
    const trials = tr ? `<section class="card trials"><div class="card-h"><h3>Youth trials</h3><span class="muted" style="font-size:.82rem">Closes ${TL.fmtDate(tr.closes, true)} · signed ${tr.signed.length}/${TL.TRIAL_SIGN_MAX}</span></div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Pos</th><th>Name</th><th class="r">Age</th><th>Nat</th><th class="c">Ability</th><th class="c">Potential</th><th>Trial game</th><th></th></tr></thead><tbody>
      ${tr.ids.map(P).filter(Boolean).map(p => { const v = p.trialist ? TL.trialView(s, p) : null; const signed = tr.signed.includes(p.id); return `<tr><td>${U.posTag(p.pos)}</td><td><b>${esc(p.name)}</b></td><td class="r">${p.age}</td><td class="muted">${esc(TL.NAT_NAMES[p.nat] || p.nat)}</td><td class="c">${v ? `<span class="ovr t4 range">${v.lo}–${v.hi}</span>` : U.ovrTag(p.ovr)}</td><td class="c muted">${v ? v.plo + '–' + v.phi : p.pot}</td><td><span class="stars">${'★'.repeat(Math.round((v ? v.score : p.trialScore) / 2))}<span class="faint">${'★'.repeat(5 - Math.round((v ? v.score : p.trialScore) / 2))}</span></span></td><td class="r">${signed ? '<span class="tag yth">Signed</span>' : `<button class="btn sm primary" data-act="sign-trialist" data-id="${p.id}" ${tr.signed.length >= TL.TRIAL_SIGN_MAX ? 'disabled' : ''}>Offer contract</button>`}</td></tr>`; }).join('')}
      </tbody></table></div><div class="card-b muted" style="font-size:.8rem">Ability and potential are estimates from your Head of Youth Development. The better he is, the narrower the ranges. Trials run every August and January.</div></section>` : '';
    // U21 competitions
    const Y = s.youth && s.youth.season === s.season && s.youth.leagues[c.leagueId];
    let u21 = '<section class="card"><div class="card-h"><h3>U21 league & cup</h3></div><div class="empty">The U21 season starts in September.</div></section>';
    if (Y) {
      const tbl = TL.youthTable(s, c.leagueId);
      const mineFx = Y.fixtures.filter(f => f.home === c.id || f.away === c.id).sort((a, b) => a.date < b.date ? -1 : 1);
      const recent = mineFx.filter(f => f.hg != null).slice(-4), upcoming = mineFx.filter(f => f.hg == null).slice(0, 3);
      const cup = Y.cup, lastRound = cup.ties[cup.ties.length - 1];
      const myTie = cup.ties.map(r => ({ r, t: r.ties.find(t => t.home === c.id || t.away === c.id) })).filter(x => x.t).pop();
      const inCup = cup.alive.includes(c.id);
      const fxRow = f => { const home = f.home === c.id, opp = s.clubs[home ? f.away : f.home]; const gf = home ? f.hg : f.ag, ga = home ? f.ag : f.hg; return `<tr><td class="muted">${TL.fmtDate(f.date)}</td><td><span class="venue-tag ${home ? 'mine' : ''}">${home ? 'H' : 'A'}</span></td><td>${esc(opp.name)} U21</td><td class="r">${f.hg == null ? '<span class="faint">–</span>' : `<b style="color:${gf > ga ? 'var(--win)' : gf < ga ? 'var(--loss)' : 'var(--muted)'}">${gf}–${ga}</b>`}</td></tr>`; };
      u21 = `<div class="grid g-2">
        <section class="card"><div class="card-h"><h3>${esc(Y.name)}</h3><span class="muted" style="font-size:.8rem">${tbl[0] && tbl[0].p ? 'Matchday ' + tbl[0].p : 'Starts soon'}</span></div><div class="tbl-wrap" style="max-height:380px;overflow:auto"><table class="tbl compact"><thead><tr><th class="c">#</th><th>Club</th><th class="r">P</th><th class="r">GD</th><th class="r">Pts</th></tr></thead><tbody>
          ${tbl.map(r => `<tr class="${r.id === c.id ? 'me' : ''}"><td class="c">${r.pos}</td><td><span class="team">${crest(s.clubs[r.id], 18)}${esc(s.clubs[r.id].name)}</span></td><td class="r">${r.p}</td><td class="r">${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="r"><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div></section>
        <div class="stack">
          <section class="card"><div class="card-h"><h3>Our U21 fixtures</h3></div><div class="tbl-wrap"><table class="tbl compact"><tbody>${recent.concat(upcoming).map(fxRow).join('') || '<tr><td class="empty">No fixtures yet.</td></tr>'}</tbody></table></div></section>
          <section class="card card-b"><h3 style="margin-bottom:8px">${esc(cup.name)}</h3>${cup.winner ? `<div>Winners: <b>${esc(s.clubs[cup.winner].name)}</b>${cup.winner === c.id ? ' 🏆' : ''}</div>` : `<div class="muted">${inCup ? `Still in it. ${cup.ties.length ? 'Next round' : 'First round'}: ${TL.fmtDate(cup.dates[cup.round] || cup.dates[cup.dates.length - 1], true)}.` : 'We are out of the cup.'}</div>`}
            ${myTie ? `<div style="margin-top:8px;font-size:.88rem">${esc(myTie.r.name)}: ${esc(s.clubs[myTie.t.home].name)} ${myTie.t.hg}–${myTie.t.ag} ${esc(s.clubs[myTie.t.away].name)}${myTie.t.pens ? ' (pens)' : ''}</div>` : ''}
            ${lastRound && !cup.winner ? `<div class="muted" style="font-size:.8rem;margin-top:6px">${cup.alive.length} teams left</div>` : ''}</section>
        </div></div>`;
    }
    const scorers = all.concat(TL.u21Squad(s, c)).filter((p, i, a) => a.indexOf(p) === i && p.youthStats && p.youthStats.goals).sort((a, b) => b.youthStats.goals - a.youthStats.goals).slice(0, 5);
    const header = `<div class="page-h"><div><div class="eyebrow">Academy facilities ${c.facilities.youth}/20 · Head of youth ${TL.staffRating(s, c.id, 'youthCoach')}/20 · intake every summer · trials every August and January</div><h1>Academy</h1></div>
      <div class="row">${tr ? '<a class="btn" href="#trials" onclick="document.querySelector(\'.trials\').scrollIntoView();return false;">Youth trials open</a>' : ''}<button class="btn primary" data-act="create-open" ${used >= TL.CREATE_LIMIT ? 'disabled' : ''}>Create a player (${TL.CREATE_LIMIT - used} left this season)</button></div></div>`;
    const awayCard = away.length ? `<section class="card"><div class="card-h"><h3>Out on loan</h3></div><div class="tbl-wrap"><table class="tbl compact"><tbody>${away.map(p => `<tr class="click" data-act="player" data-id="${p.id}"><td>${U.posTag(p.pos)}</td><td><b>${esc(p.name)}</b></td><td class="muted">${esc(p.onLoan ? p.onLoan.to : U.clubName(p.clubId))}</td><td class="c">${U.ovrTag(p.ovr)}</td><td class="r muted">${p.loan ? `${p.stats.apps} apps · ${p.stats.goals} goals` : ''}</td></tr>`).join('')}</tbody></table></div></section>` : '';
    const scorerCard = scorers.length ? `<section class="card"><div class="card-h"><h3>Youth top scorers</h3></div><div class="tbl-wrap"><table class="tbl compact"><tbody>${scorers.map(p => `<tr class="click" data-act="player" data-id="${p.id}"><td>${U.posTag(p.pos)}</td><td><b>${esc(p.name)}</b></td><td class="r">${p.youthStats.apps} apps</td><td class="r"><b>${p.youthStats.goals}</b> goals</td></tr>`).join('')}</tbody></table></div></section>` : '';
    const pending = TL.youthPendingFor ? TL.youthPendingFor(s, c.id) : [];
    const pendCard = pending.map(g => { const opp = s.clubs[g.home === c.id ? g.away : g.home]; return `<section class="card card-b u21-pend"><div class="row between"><div><div class="eyebrow">U21 match today · ${esc(g.label)}</div><b>${esc(c.name)} U21 ${g.home === c.id ? 'v' : 'at'} ${esc(opp.name)} U21</b></div><div class="row"><button class="btn" data-act="u21-skip" data-key="${g.key}">Skip – get the report</button><button class="btn primary" data-act="u21-watch" data-key="${g.key}">Watch live ${ICON.play}</button></div></div></section>`; }).join('');
    const reps = (c.u21Reports || []).slice(0, 8);
    const repCard = `<section class="card"><div class="card-h"><h3>Head of Youth match reports</h3><label class="row" style="gap:8px;font-size:.84rem"><span class="muted">U21 matches</span><select class="input sm-input" data-change="u21mode"><option value="ask" ${(c.u21Mode || 'ask') === 'ask' ? 'selected' : ''}>Ask me each match</option><option value="auto" ${c.u21Mode === 'auto' ? 'selected' : ''}>Always skip (reports only)</option></select></label></div>
      ${reps.length ? `<div class="tbl-wrap"><table class="tbl compact"><tbody>${reps.map(r => `<tr class="click" data-act="u21-report" data-id="${r.id}"><td class="muted">${TL.fmtDate(r.date)}</td><td>${esc(r.comp)}</td><td>v ${esc(r.opp)}</td><td class="r"><b>${r.gf}–${r.ga}</b>${r.pens ? ' <span class="faint">p</span>' : ''}</td><td class="c"><span class="res ${r.res}">${r.res}</span></td><td class="muted">${r.watched ? 'Watched' : 'Report'}</td><td class="muted hide-sm">MOTM: ${esc(r.motm && P(r.motm) ? P(r.motm).name : '–')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Reports arrive after every U21 match.</div>'}</section>`;
    return header + pendCard + trials + u21 + repCard + oldAcademy(c, list, team) + `<div class="grid g-2">${awayCard}${scorerCard}</div>`;
  }
  U.modals.u21report = md => {
    const s = G(), c = U.me(), r = c && TL.u21Report(s, c, md.id);
    if (!r) return { html: '<div class="modal-b">Report not found.</div>' };
    const name = id => P(id) ? P(id).name : 'a former player';
    return { html: `<div class="modal-h"><div><div class="eyebrow">${esc(r.comp)} · ${TL.fmtDate(r.date, true)} · ${r.watched ? 'you watched this match' : 'report from your Head of Youth (' + r.coach + '/20)'}</div><h2 style="font-size:1.4rem;margin-top:3px">${esc(c.name)} U21 ${r.gf}–${r.ga} ${esc(r.opp)} U21${r.pens ? ` <small class="muted">(${r.pens === 'W' ? 'won' : 'lost'} on pens)</small>` : ''}</h2></div><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div>
      <div class="modal-b stack" style="gap:14px">
        <div class="facts">
          <div class="fact"><span>Player of the match</span><b>${r.motm ? esc(name(r.motm)) : '–'}</b></div>
          <div class="fact"><span>Most improved</span><b>${r.improved ? `${esc(name(r.improved.id))} <small style="color:var(--win)">+${r.improved.d}</small>` : '–'}</b></div>
          <div class="fact"><span>One to watch</span><b>${r.watch ? esc(name(r.watch)) : '–'}</b></div>
        </div>
        <div class="talk-reaction" style="font-weight:400">${r.notes.map(esc).join('<br><br>')}</div>
        <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Pos</th><th>Player</th><th class="r">Age</th><th class="c">Abl</th><th class="c">Pot</th><th class="r">Goals</th><th class="r">Rating</th></tr></thead><tbody>
        ${r.rows.map(x => { const p = P(x.id); return p ? `<tr class="click" data-act="player" data-id="${p.id}"><td>${U.posTag(p.pos)}</td><td><b>${esc(p.name)}</b>${x.id === r.motm ? ' <span class="tag star">MOTM</span>' : ''}${r.watch === x.id ? ' <span class="tag yth">One to watch</span>' : ''}</td><td class="r">${p.age}</td><td class="c">${U.ovrTag(p.ovr)}</td><td class="c muted">${U.potTxt(p)}</td><td class="r">${x.g || ''}</td><td class="r">${U.ratingTag(x.r)}</td></tr>` : ''; }).join('')}
        </tbody></table></div>
      </div>` };
  };
  U.actions['change:u21mode'] = t => { U.me().u21Mode = t.value; toast(t.value === 'ask' ? 'You will be asked before every U21 match.' : 'U21 matches will be played without you. Reports come to your inbox.'); U.autosave(); };
  function oldAcademy(c, list, team) {
    const table = arr => arr.length ? `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Pos</th><th>Name</th><th class="r">Age</th><th class="c">Abl</th><th class="c">Pot</th><th class="r">Apps</th><th class="r">Gls</th><th></th></tr></thead><tbody>${arr.map(p => `<tr class="click" data-act="player" data-id="${p.id}"><td>${U.posTag(p.pos)}</td><td><b>${esc(p.name)}</b> ${p.wonderkid ? '<span class="tag star">★</span>' : ''}${p.mentor ? ' <span class="tag">Mentored</span>' : ''}</td><td class="r">${p.age}</td><td class="c">${U.ovrTag(p.ovr)}</td><td class="c muted">${U.potTxt(p)}</td><td class="r">${p.youthStats ? p.youthStats.apps : 0}</td><td class="r">${p.youthStats ? p.youthStats.goals : 0}</td><td class="r"><button class="btn sm" data-act="promote" data-id="${p.id}">Promote</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No players in this age group.</div>';
    const res = (c.youthResults || []).slice(0, 8);
    return `<section class="card"><div class="card-h"><h3>U18 squad</h3></div>${table(team('U18'))}</section>
      <section class="card"><div class="card-h"><h3>U19–U21 squad</h3><span class="muted" style="font-size:.8rem">The U21 team also uses first-team players aged 21 or under who are not starting</span></div>${table(team('U21'))}</section>
      <section class="card"><div class="card-h"><h3>Youth results</h3></div>${res.length ? `<div class="tbl-wrap"><table class="tbl compact"><tbody>${res.map(r => `<tr><td class="muted">${TL.fmtDate(r.date)}</td><td>${r.team}</td><td>v ${esc(r.opp)}</td><td class="r"><b style="color:${r.gf > r.ga || r.pens === 'W' ? 'var(--win)' : r.gf < r.ga || r.pens === 'L' ? 'var(--loss)' : 'inherit'}">${r.gf}–${r.ga}${r.pens ? ' (pens)' : ''}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Youth teams play every week.</div>'}</section>`;
  }
  U.modals['create-player'] = md => {
    const s = G(), c = U.me(), d = md.def;
    const nats = Object.keys(TL.NAT_NAMES).sort((a, b) => TL.NAT_NAMES[a].localeCompare(TL.NAT_NAMES[b]));
    const sel = (k, opts) => `<select class="input" data-change="cp" data-k="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(d[k]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    return { html: `<div class="modal-h"><div><div class="eyebrow">${TL.CREATE_LIMIT - TL.createdThisSeason(s, c)} of ${TL.CREATE_LIMIT} left this season</div><h2 style="font-size:1.4rem;margin-top:3px">Create an academy player</h2></div><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div>
      <div class="modal-b stack" style="gap:14px">
        <div class="grid g-2" style="gap:12px">
          <label class="ctl"><span class="lbl">Name</span><input class="input" data-input="cp" data-k="name" value="${esc(d.name)}" placeholder="Leave blank for a random name" maxlength="26"></label>
          <label class="ctl"><span class="lbl">Nationality</span>${sel('nat', nats.map(k => [k, TL.NAT_NAMES[k]]))}</label>
          <label class="ctl"><span class="lbl">Play style</span>${sel('style', Object.keys(TL.PLAY_STYLES).map(k => [k, `${k} (${TL.PLAY_STYLES[k]})`]))}</label>
          <label class="ctl"><span class="lbl">Potential</span>${sel('tier', Object.entries(TL.ACADEMY_TIERS).map(([k, r]) => [k, `${k} (${r[0]}–${r[1]})`]))}</label>
          <label class="ctl"><span class="lbl">Age</span>${sel('age', [15, 16, 17, 18].map(v => [v, v]))}</label>
          <label class="ctl"><span class="lbl">Stronger foot</span>${sel('foot', [['Right', 'Right'], ['Left', 'Left'], ['Both', 'Both']])}</label>
        </div>
        <div class="muted" style="font-size:.84rem">He joins the academy straight away. How good he becomes depends on coaching, facilities, game time and his attitude.</div>
        <div class="row" style="justify-content:flex-end"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="create-go">Create player</button></div>
      </div>` };
  };
  Object.assign(U.actions, {
    'create-open'() { const c = U.me(); ui.modal = { type: 'create-player', def: { name: '', nat: c.country, style: 'Playmaker', tier: 'Talented', age: 16, foot: 'Right' } }; U.render(); },
    'change:cp'(t) { ui.modal.def[t.dataset.k] = t.value; },
    'input:cp'(t) { ui.modal.def[t.dataset.k] = t.value; },
    'create-go'() { const r = TL.createAcademyPlayer(G(), U.me().id, Object.assign({}, ui.modal.def, { name: ui.modal.def.name.trim() || null })); if (r.error) { toast(r.error); return; } ui.modal = { type: 'player', id: r.p.id }; toast(`${r.p.name} joins the academy.`); U.autosave(); U.render(); },
    'sign-trialist'(d) { toast(TL.signTrialist(G(), d.id)); U.autosave(); U.soft(); },
    promote(d) { const p = P(d.id); TL.promoteYouth(G(), d.id); toast(`${p.name} joins the first-team squad.`); ui.modal = null; U.autosave(); U.soft(); },
    'release-youth'(d) { const p = P(d.id); U.ask(`Release ${p.name}?`, 'He leaves the academy as a free agent.', 'Release', () => { TL.releaseYouth(G(), d.id); toast(`${p.name} released.`); }, true); }
  });
  U.views.academy = viewAcademy;

  /* ---------- Haggling over a bid for one of your players ---------- */
  U.modals.haggle = md => {
    const s = G(), o = s.offers.find(x => x.id === md.id), p = o && P(o.pid), buyer = o && s.clubs[o.club];
    if (!o || !p) return { cls: 'narrow', html: '<div class="modal-b">Offer not found.</div>' };
    const val = TL.askingPrice(s, p), open = o.status === 'open';
    md.log = md.log || [{ who: 'them', text: `${buyer.name} offer ${U.fm(o.fee)} for ${p.name}.` }];
    md.price = md.price != null ? md.price : TL.roundFee(Math.max(val, o.fee * 1.3));
    const yrs = TL.contractYearsLeft(s, p);
    const mood = p.requested ? 'He has asked to leave and wants this move.' : p.listed ? 'He is on the transfer list.' : p.morale >= 70 ? 'He is happy here.' : 'He might be tempted by a move.';
    const quick = [['+20% on their bid', o.fee * 1.2], ['Our valuation', val], ['Valuation +25%', val * 1.25], ['Valuation +50%', val * 1.5]];
    return { html: `<div class="modal-h">${crest(buyer, 40)}<div style="min-width:0"><div class="eyebrow">Negotiation · round ${(o.round || 0) + 1}</div><h2 style="font-size:1.4rem;margin-top:3px">${esc(buyer.name)} want ${esc(p.name)}</h2><div class="muted" style="font-size:.85rem;margin-top:3px">${p.pos} · ${p.age} · rated ${p.ovr} · contract ${yrs} year${yrs === 1 ? '' : 's'} left</div></div><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div>
      <div class="modal-b stack" style="gap:14px">
        <div class="facts"><div class="fact"><span>Their offer</span><b>${U.fm(o.fee)}</b></div><div class="fact"><span>Our valuation</span><b>${U.fm(val)}</b></div><div class="fact"><span>Market value</span><b>${U.fm(p.value * TL.econOf(U.me()).value)}</b></div><div class="fact"><span>The player</span><b style="font-size:.85rem;font-weight:600">${esc(mood)}</b></div></div>
        <div class="chatlog" aria-live="polite">${md.log.map(l => `<div class="msg ${l.who}">${esc(l.text)}</div>`).join('')}</div>
        ${open && !md.deal ? `<div class="stack" style="gap:10px">
          <div class="row" style="gap:6px">${quick.map(([l, v]) => `<button class="chip" data-act="haggle-quick" data-v="${TL.roundFee(v)}">${l} · ${U.fm(TL.roundFee(v))}</button>`).join('')}</div>
          <div class="row" style="gap:10px;align-items:flex-end"><label class="ctl" style="flex:1;min-width:160px"><span class="lbl">Your price (£m)</span><input id="haggle-price" class="input" type="number" min="0" step="${md.price >= 10 ? 0.5 : 0.1}" value="${md.price}"></label><button class="btn primary" data-act="haggle-ask">Name your price</button></div>
          <div class="row" style="justify-content:space-between"><button class="btn danger sm" data-act="haggle-reject">Reject and end talks</button><button class="btn sm" data-act="haggle-accept">Accept ${U.fm(o.fee)}</button></div>
          <div class="muted" style="font-size:.8rem">Every club has a limit it will not go past. Push too hard or for too long and they walk away.</div></div>`
        : md.deal ? `<div class="row" style="justify-content:flex-end"><button class="btn" data-act="close">Not now</button><button class="btn primary" data-act="haggle-accept">Sell for ${U.fm(o.fee)}</button></div>`
        : `<div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">Done</button></div>`}
      </div>` };
  };
  Object.assign(U.actions, {
    'haggle-open'(d) { ui.modal = { type: 'haggle', id: +d.id }; U.render(); },
    'haggle-quick'(d) { ui.modal.price = +d.v; U.render(); },
    'haggle-ask'() {
      const md = ui.modal, s = G(), v = parseFloat(document.getElementById('haggle-price').value);
      if (!(v > 0)) { toast('Enter a price in £m.'); return; }
      md.price = v;
      md.log.push({ who: 'you', text: `We want ${U.fm(v)}.` });
      const r = TL.haggle(s, md.id, v);
      md.log.push({ who: 'them', text: r.msg });
      if (r.result === 'accept') md.deal = true;
      if (r.result === 'counter' && r.final) md.price = r.fee;
      U.autosave(); U.render();
    },
    'haggle-accept'() { const md = ui.modal, s = G(), msg = TL.respondOffer(s, md.id, 'accept'); md.log.push({ who: 'them', text: msg }); md.deal = false; toast(msg); U.autosave(); U.render(); },
    'haggle-reject'() { const md = ui.modal, s = G(), msg = TL.respondOffer(s, md.id, 'reject'); md.log.push({ who: 'you', text: 'No deal. He is not for sale at that price.' }); toast(msg); U.autosave(); U.render(); }
  });

  /* ---------- Loan picker ---------- */
  U.modals['loan-pick'] = md => {
    const s = G(), p = P(md.id), c = U.me(), win = TL.windowInfo(s);
    const feeders = TL.feedersOf(s, c.id).filter(f => f.terms.loans);
    const dests = TL.loanDestinations(s, p.id);
    const RC = { 'Regular starter': 'var(--win)', Rotation: 'var(--accent-text)', 'Squad player': 'var(--muted)' };
    return { html: `<div class="modal-h"><div><div class="eyebrow">${U.posTag(p.pos)} ${p.age} · rated ${p.ovr}${p.academy ? ' · academy' : ''}</div><h2 style="font-size:1.4rem;margin-top:3px">Loan ${esc(p.name)}</h2></div><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div>
      <div class="modal-b stack" style="gap:16px">
        ${feeders.length ? `<div><h4 class="eyebrow" style="margin:0 0 8px">Feeder clubs · any time, recall whenever you want, about 30% faster development</h4>${feeders.map(f => `<div class="row between loan-opt"><span><b>${esc(TL.feederName(s, f))}</b> <span class="muted">${esc(TL.NAT_NAMES[TL.feederCountry(s, f)] || '')}</span></span><button class="btn sm primary" data-act="loan-feeder" data-id="${p.id}" data-f="${f.id}">Send</button></div>`).join('')}</div>` : ''}
        <div><h4 class="eyebrow" style="margin:0 0 8px">Other clubs · plays real matches · monthly reports${win.open ? '' : ' · <span style="color:var(--warn)">window closed</span>'}</h4>
          ${dests.length ? `<div class="tbl-wrap"><table class="tbl compact"><tbody>${dests.map(d => `<tr><td><span class="team">${crest(s.clubs[d.id], 20)}${esc(d.name)}</span></td><td class="muted">${esc(d.league)}</td><td style="color:${RC[d.role]};font-weight:600">${d.role}</td><td class="r"><button class="btn sm" data-act="loan-to-club" data-id="${p.id}" data-club="${d.id}" ${win.open ? '' : 'disabled'}>Loan</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">No club in the simulated leagues would give him a place in their squad yet.</div>'}</div>
        <div class="row between loan-opt"><span><b>Lower-league club</b> <span class="muted">· guaranteed football outside the simulated leagues</span></span><button class="btn sm" data-act="loan-generic" data-id="${p.id}" ${win.open ? '' : 'disabled'}>Loan</button></div>
        <div class="muted" style="font-size:.8rem">"Squad player" means little game time. Young players develop fastest where they play every week.</div>
      </div>` };
  };

  /* ---------- Merchandise ---------- */
  U.modals.merch = md => {
    const s = G(), p = P(md.id), c = U.me(), live = TL.merchFor(s, p.id);
    if (live) return { cls: 'narrow', html: `<div class="modal-h"><div><div class="eyebrow">Merchandise on sale since ${TL.fmtDate(live.start, true)}</div><h2 style="font-size:1.4rem;margin-top:3px">${esc(p.name)} range</h2></div><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div>
      <div class="modal-b stack" style="gap:12px"><dl class="kv"><dt>Products</dt><dd>${live.products.map(k => TL.MERCH_PRODUCTS[k].name).join(', ')}</dd><dt>Last month</dt><dd>${U.fm(live.last)}</dd><dt>Earned so far</dt><dd>${U.fm(live.earned)}</dd><dt>Hype</dt><dd>${Math.round(live.hype * 100)}%</dd></dl>
      <div class="muted" style="font-size:.84rem">Sales rise when he scores and plays well, and slowly fade otherwise.</div>
      <div class="row" style="justify-content:flex-end"><button class="btn danger sm" data-act="merch-end" data-id="${live.id}">End line</button><button class="btn primary" data-act="close">Done</button></div></div>` };
    const rows = Object.entries(TL.MERCH_PRODUCTS).map(([k, pr]) => { const e = TL.merchEstimate(s, p, c, k), on = md.pick.includes(k); return { k, pr, e, on }; });
    const setup = rows.filter(r => r.on).reduce((a, r) => a + r.e.setup, 0), monthly = rows.filter(r => r.on).reduce((a, r) => a + r.e.monthly, 0);
    return { html: `<div class="modal-h"><div><div class="eyebrow">Popularity ${Math.round(TL.merchPopularity(s, p) * 100)} · ${esc(c.name)} club shop</div><h2 style="font-size:1.4rem;margin-top:3px">Launch a ${esc(p.name)} range</h2></div><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div>
      <div class="modal-b stack" style="gap:12px">
        <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th></th><th>Product</th><th class="r">Setup</th><th class="r">Expected per month</th></tr></thead><tbody>
        ${rows.map(r => `<tr class="click ${r.on ? 'sel' : ''}" data-act="merch-toggle" data-v="${r.k}"><td><span class="checkbox ${r.on ? 'on' : ''}">${r.on ? '✓' : ''}</span></td><td><b>${esc(r.pr.name)}</b></td><td class="r">${U.fm(r.e.setup)}</td><td class="r" style="color:var(--win)">${U.fm(r.e.monthly)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="row between"><span class="muted" style="font-size:.85rem">Setup <b style="color:var(--text)">${U.fm(setup)}</b> · first month about <b style="color:var(--win)">${U.fm(monthly)}</b>, then it depends on his form · bank ${U.fm(c.finance.balance)}</span><button class="btn primary" data-act="merch-launch" ${md.pick.length ? '' : 'disabled'}>Launch range</button></div>
        <div class="muted" style="font-size:.8rem">New signings sell best in their first months. If he leaves, the line closes with a clearance sale.</div>
      </div>` };
  };

  /* ---------- Development: progress charts for every player ---------- */
  const PAL = ['#f2b33d', '#5d9ef5', '#35c27e', '#ef5f5f', '#b98cf5', '#3fd0d4', '#f58ac0', '#c7d36f', '#f39a4a', '#8fa3c7'];
  const ovrAt = (p, date) => { const h = p.hist || []; let v = null; for (const [d, o] of h) { if (d <= date) v = o; else break; } return v != null ? v : (h.length ? h[0][1] : p.ovr); };
  function devFrom(s) { return ui.devRange === 'all' ? '0000-00-00' : ui.devRange === 'year' ? TL.addDays(s.date, -365) : `${s.season}-07-01`; }
  function viewDevelopment() {
    const s = G(), c = U.me(); if (!c) return U.needClub();
    ui.devRange = ui.devRange || 'season'; ui.devAcad = !!ui.devAcad;
    const from = devFrom(s), month = TL.addDays(s.date, -30);
    const ids = c.players.concat(ui.devAcad ? (c.academy || []) : []);
    const rows = ids.map(P).filter(Boolean).map(p => {
      const start = ovrAt(p, from), now = p.ovr, d30 = now - ovrAt(p, month);
      const trend = p.ovr >= p.pot && p.age >= 24 ? (now < start ? 'Declining' : 'Peaked') : now > start ? 'Rising' : now < start ? 'Falling' : 'Stable';
      return { p, start, now, ch: now - start, d30, trend };
    }).sort((a, b) => b.ch - a.ch || b.now - a.now);
    if (!ui.devSel) ui.devSel = rows.slice().sort((a, b) => Math.abs(b.ch) - Math.abs(a.ch)).slice(0, 5).map(r => r.p.id);
    ui.devSel = ui.devSel.filter(id => ids.includes(id));
    const up = rows.filter(r => r.ch > 0), down = rows.filter(r => r.ch < 0);
    const avg = rows.length ? rows.reduce((a, r) => a + r.ch, 0) / rows.length : 0;
    const best = up[0], worst = down.slice().sort((a, b) => a.ch - b.ch)[0];
    // multi-line chart
    const sel = ui.devSel.map(P).filter(Boolean);
    const series = sel.map((p, i) => {
      const pts = (p.hist || []).filter(h => h[0] >= from).map(h => [h[0], h[1]]);
      const startV = ovrAt(p, from);
      const first = p.hist && p.hist[0] ? p.hist[0][0] : TL.addDays(s.date, -30), begin = from > first ? from : first;
      if (!pts.length || pts[0][0] > begin) pts.unshift([begin, startV]);
      pts.push([s.date, p.ovr]);
      return { p, pts, col: PAL[i % PAL.length] };
    });
    const allPts = series.flatMap(x => x.pts);
    let chart = '<div class="empty">Tick players in the table below to plot their progress.</div>';
    if (allPts.length) {
      const W = 720, H = 260, padL = 34, padR = 110, padT = 12, padB = 26;
      const t = d => new Date(d + 'T12:00:00Z').getTime();
      const t0 = Math.min(...allPts.map(x => t(x[0]))), t1 = Math.max(t(s.date), t0 + 86400000 * 7);
      let lo = Math.min(...allPts.map(x => x[1])) - 1, hi = Math.max(...allPts.map(x => x[1])) + 1; if (hi - lo < 6) { const m = (hi + lo) / 2; lo = m - 3; hi = m + 3; }
      const X = d => padL + (t(d) - t0) / (t1 - t0) * (W - padL - padR), Y = v => padT + (hi - v) / (hi - lo) * (H - padT - padB);
      const ticks = []; for (let v = Math.ceil(lo); v <= Math.floor(hi); v += Math.max(1, Math.round((hi - lo) / 6))) ticks.push(v);
      const months = []; { const d0 = new Date(t0), d1 = new Date(t1); const d = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1)); const step = (t1 - t0) > 86400000 * 400 ? 3 : 1; while (d <= d1) { months.push(d.toISOString().slice(0, 10)); d.setUTCMonth(d.getUTCMonth() + step); } }
      chart = `<svg viewBox="0 0 ${W} ${H}" class="chart dev-chart" role="img" aria-label="Ability over time">
        ${ticks.map(v => `<line x1="${padL}" x2="${W - padR}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line-soft)"/><text x="${padL - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="var(--faint)">${v}</text>`).join('')}
        ${months.map(d => `<text x="${X(d)}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${new Date(d + 'T12:00:00Z').toLocaleDateString(TL.locale || 'en-GB', { month: 'short', timeZone: 'UTC' })}</text>`).join('')}
        ${series.map(x => { const path = x.pts.map((q, i) => `${i ? 'L' : 'M'}${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(' '); const last = x.pts[x.pts.length - 1]; return `<path d="${path}" fill="none" stroke="${x.col}" stroke-width="2.4" stroke-linejoin="round"/>${x.pts.map(q => `<circle cx="${X(q[0]).toFixed(1)}" cy="${Y(q[1]).toFixed(1)}" r="2.6" fill="${x.col}"><title>${esc(x.p.name)}: ${q[1]} (${TL.fmtDate(q[0])})</title></circle>`).join('')}<text x="${X(last[0]) + 6}" y="${Y(last[1]) + 4}" font-size="11.5" font-weight="600" fill="${x.col}">${esc(U.surname(x.p.name))} ${last[1]}</text>`; }).join('')}
      </svg>`;
    }
    const spark = p => {
      const h = (p.hist || []).filter(x => x[0] >= from); const pts = h.length ? h.map(x => x[1]) : [ovrAt(p, from)]; pts.push(p.ovr);
      const lo = Math.min(...pts), hi = Math.max(...pts), w = 70, hh = 20;
      const col = p.ovr > pts[0] ? 'var(--win)' : p.ovr < pts[0] ? 'var(--loss)' : 'var(--muted)';
      return `<svg width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}" aria-hidden="true"><polyline fill="none" stroke="${col}" stroke-width="1.8" points="${pts.map((v, i) => `${(i / Math.max(1, pts.length - 1) * (w - 2) + 1).toFixed(1)},${(hh - 2 - (hi > lo ? (v - lo) / (hi - lo) : 0.5) * (hh - 4)).toFixed(1)}`).join(' ')}"/></svg>`;
    };
    const chg = v => `<b style="color:${v > 0 ? 'var(--win)' : v < 0 ? 'var(--loss)' : 'var(--muted)'}">${v > 0 ? '▲ +' + v : v < 0 ? '▼ ' + v : '–'}</b>`;
    const TC = { Rising: 'var(--win)', Falling: 'var(--loss)', Declining: 'var(--loss)', Peaked: 'var(--muted)', Stable: 'var(--muted)' };
    return `<div class="page-h"><div><div class="eyebrow">${rows.length} players · ${ui.devRange === 'season' ? 'since the start of the season' : ui.devRange === 'year' ? 'last 12 months' : 'all recorded history'}</div><h1>Development</h1></div>
      <div class="row"><div class="seg">${[['season', 'This season'], ['year', '12 months'], ['all', 'All time']].map(([k, l]) => `<button class="${ui.devRange === k ? 'on' : ''}" data-act="dev-range" data-v="${k}">${l}</button>`).join('')}</div><label class="check"><input type="checkbox" data-change="dev-acad" ${ui.devAcad ? 'checked' : ''}> Include academy</label></div></div>
      <div class="kpis">
        <div class="kpi"><span>Improved</span><b style="color:var(--win)">${up.length}</b><small>${best ? `Best: ${esc(best.p.name)} +${best.ch}` : '–'}</small></div>
        <div class="kpi"><span>Declined</span><b style="color:var(--loss)">${down.length}</b><small>${worst ? `Biggest drop: ${esc(worst.p.name)} ${worst.ch}` : 'Nobody has dropped'}</small></div>
        <div class="kpi"><span>Unchanged</span><b>${rows.length - up.length - down.length}</b></div>
        <div class="kpi"><span>Average change</span><b>${avg > 0 ? '+' : ''}${avg.toFixed(1)}</b></div>
      </div>
      <section class="card"><div class="card-h"><h3>Ability over time</h3><div class="row"><button class="btn sm ghost" data-act="dev-pick" data-v="risers">Top risers</button><button class="btn sm ghost" data-act="dev-pick" data-v="fallers">Biggest drops</button><button class="btn sm ghost" data-act="dev-pick" data-v="young">Youngsters</button><button class="btn sm ghost" data-act="dev-pick" data-v="clear">Clear</button></div></div>
        <div class="card-b" style="overflow-x:auto">${chart}</div>
        ${sel.length ? `<div class="card-b legend" style="padding-top:0">${series.map(x => `<span><i class="z" style="background:${x.col}"></i>${esc(x.p.name)}</span>`).join('')}</div>` : ''}</section>
      <section class="card"><div class="card-h"><h3>Every player</h3><span class="muted" style="font-size:.8rem">Tick up to 10 players to compare them on the chart</span></div>
        <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th></th><th>Pos</th><th>Name</th><th class="r">Age</th><th>Trend</th><th class="c">Start</th><th class="c">Now</th><th class="r">Change</th><th class="r">Last 30 days</th><th class="c">Pot</th><th></th></tr></thead><tbody>
        ${rows.map(r => { const on = ui.devSel.includes(r.p.id); return `<tr class="click ${on ? 'sel' : ''}" data-act="dev-toggle" data-id="${r.p.id}"><td><span class="checkbox ${on ? 'on' : ''}" aria-hidden="true">${on ? '✓' : ''}</span></td><td>${U.posTag(r.p.pos)}</td><td><b>${esc(r.p.name)}</b>${r.p.academy ? ' <span class="tag yth">Academy</span>' : ''}</td><td class="r">${r.p.age}</td><td style="color:${TC[r.trend]};font-weight:600">${r.trend}</td><td class="c muted">${r.start}</td><td class="c">${U.ovrTag(r.now)}</td><td class="r">${chg(r.ch)}</td><td class="r">${chg(r.d30)}</td><td class="c muted">${U.potTxt(r.p)}</td><td>${spark(r.p)}</td></tr>`; }).join('')}
        </tbody></table></div></section>`;
  }
  Object.assign(U.actions, {
    'dev-range'(d) { ui.devRange = d.v; U.soft(); },
    'change:dev-acad'(t) { ui.devAcad = t.checked; U.soft(); },
    'dev-toggle'(d) { const i = ui.devSel.indexOf(d.id); if (i >= 0) ui.devSel.splice(i, 1); else if (ui.devSel.length >= 10) toast('Up to 10 players on the chart.'); else ui.devSel.push(d.id); U.soft(); },
    'dev-pick'(d) {
      const s = G(), c = U.me(), from = devFrom(s);
      const ps = c.players.concat(ui.devAcad ? (c.academy || []) : []).map(P).filter(Boolean).map(p => ({ p, ch: p.ovr - ovrAt(p, from) }));
      ui.devSel = d.v === 'clear' ? [] : (d.v === 'risers' ? ps.sort((a, b) => b.ch - a.ch) : d.v === 'fallers' ? ps.sort((a, b) => a.ch - b.ch) : ps.filter(x => x.p.age <= 21).sort((a, b) => b.p.pot - a.p.pot)).slice(0, 6).map(x => x.p.id);
      U.soft();
    }
  });
  U.views.development = viewDevelopment;

  /* ---------- Club ---------- */
  // Every fixture and result of the season, all competitions
  function clubFixtures(s, c) {
    ui.cfx = ui.cfx || 'all';
    const kind = f => { const t = (s.comps[f.comp] || {}).type; return t === 'league' ? 'league' : t === 'cl' ? 'europe' : 'cup'; };
    const all = s.fixtures.filter(f => f.home === c.id || f.away === c.id).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    const list = all.filter(f => ui.cfx === 'all' || kind(f) === ui.cfx);
    const next = all.find(f => !f.played);
    const played = all.filter(f => f.played), rec = { W: 0, D: 0, L: 0 };
    for (const f of played) rec[TL.userResult(s, f, c.id).res]++;
    return `<section class="card"><div class="card-h"><h3>Fixtures & results</h3><div class="row"><span class="muted" style="font-size:.8rem">${rec.W}W ${rec.D}D ${rec.L}L</span><div class="seg">${[['all', 'All'], ['league', 'League'], ['cup', 'Cups'], ['europe', 'Europe']].map(([k, l]) => `<button class="${ui.cfx === k ? 'on' : ''}" data-act="cfx" data-v="${k}">${l}</button>`).join('')}</div></div></div>
      <div class="tbl-wrap club-fx" id="club-fx"><table class="tbl compact"><tbody>
      ${list.map(f => {
        const home = f.home === c.id, opp = TL.team(s, home ? f.away : f.home), r = f.played ? TL.userResult(s, f, c.id) : null;
        return `<tr class="${f === next ? 'me next-fx' : ''}"><td class="muted" style="width:70px">${TL.fmtDate(f.date)}</td><td class="muted hide-sm">${esc(TL.compName(s, f))}</td><td><span class="venue-tag ${home ? 'mine' : ''}">${f.neutral ? 'N' : home ? 'H' : 'A'}</span></td><td><span class="team">${crest(opp, 20)}${esc(opp.name)}</span></td>
          <td class="r">${r ? `<b>${home ? f.hg : f.ag}–${home ? f.ag : f.hg}</b>${f.pens ? ' <span class="faint">p</span>' : f.et ? ' <span class="faint">aet</span>' : ''}` : f === next ? '<span class="tag yth">Next</span>' : '<span class="faint">–</span>'}</td>
          <td class="c">${r ? `<span class="res ${r.res}">${r.res}</span>` : ''}</td></tr>`;
      }).join('') || '<tr><td class="empty">No fixtures.</td></tr>'}
      </tbody></table></div></section>`;
  }
  function commercialSection(s, c) {
    const lines = (s.merch || []).filter(m => m.clubId === c.id && m.active);
    const cands = c.players.map(P).filter(p => p && TL.merchEligible(s, p) && !TL.merchFor(s, p.id)).sort((a, b) => b.ovr - a.ovr).slice(0, 4);
    return `<section class="card"><div class="card-h"><h3>Player merchandise</h3><span class="muted" style="font-size:.8rem">Earned so far: ${U.fm(lines.reduce((a, m) => a + m.earned, 0))}</span></div>
      ${lines.length ? `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Player</th><th>Products</th><th class="r">Last month</th><th class="r">Total</th><th>Hype</th></tr></thead><tbody>${lines.map(m => { const p = P(m.pid); return `<tr class="click" data-act="merch-open" data-id="${m.pid}"><td><b>${esc(p.name)}</b></td><td class="muted">${m.products.length} products</td><td class="r">${U.fm(m.last)}</td><td class="r"><b>${U.fm(m.earned)}</b></td><td><div class="meter" style="width:80px"><i style="width:${Math.min(100, m.hype / 1.8 * 100)}%"></i></div></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="card-b muted">No merchandise lines yet. Star players and big signings can sell shirts, boots, caps, mugs, umbrellas and posters with their name.</div>'}
      ${cands.length ? `<div class="card-b row" style="gap:8px;border-top:1px solid var(--line-soft)"><span class="muted" style="font-size:.85rem">Could sell well:</span>${cands.map(p => `<button class="btn sm" data-act="merch-open" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>` : ''}</section>`;
  }
  U.actions.cfx = d => { ui.cfx = d.v; U.soft(); };

  function viewClub() {
    const s = G(), c = U.me(); if (!c) return U.needClub();
    TL.ensureOps(c);
    const rec = s.records[c.id] || {};
    const hof = Object.values(rec.apps || {}).sort((a, b) => b.apps - a.apps).slice(0, 10);
    const trophies = s.awards.filter(a => a.winner === c.id && !/of the Month/.test(a.name));
    const proj = c.projects || [];
    return `<div class="page-h"><div><div class="eyebrow">${esc(c.city)} · founded ${c.founded} · ${esc(c.stadium)} (${c.cap.toLocaleString('en-GB')})</div><h1>${esc(c.name)}</h1></div></div>
      <div class="kpis"><div class="kpi"><span>Training ground</span><b>${c.facilities.training}/20</b></div><div class="kpi"><span>Academy</span><b>${c.facilities.youth}/20</b></div><div class="kpi"><span>Fans</span><b>${U.fanWord(c.fans.mood)}</b><div class="meter"><i style="width:${c.fans.mood}%"></i></div></div><div class="kpi"><span>Reputation</span><b>${c.rep}</b></div></div>
      ${clubFixtures(s, c)}
      <section class="card"><div class="card-h"><h3>Club development</h3><span class="muted" style="font-size:.82rem">Bank balance ${U.fm(c.finance.balance)} · ${proj.length}/3 projects under way${c.boardAsk ? ` · last board request ${TL.fmtDate(c.boardAsk)}` : ''}</span></div>
        <div class="fac-grid">${Object.entries(TL.PROJECTS).map(([k, p]) => {
          const run = proj.find(x => x.type === k), F = TL.FACILITIES[k];
          const lvl = F ? (c.facilities[k] || 0) : null, blocked = TL.projectBlocked(s, c, k);
          const cost = TL.projectCost(s, c, k);
          const pctDone = run ? Math.min(100, Math.round(100 * TL.daysBetween(run.start, s.date) / Math.max(1, TL.daysBetween(run.start, run.end)))) : 0;
          return `<div class="fac ${run ? 'running' : ''}"><div class="row between"><b>${esc(F ? F.name : p.name)}</b>${F ? `<span class="muted num">Level ${lvl}/${F.max}</span>` : k === 'stadium' || k === 'newstadium' ? `<span class="muted num">${c.cap.toLocaleString('en-GB')} seats</span>` : ''}</div>
            ${F ? `<div class="meter"><i style="width:${100 * lvl / F.max}%"></i></div>` : ''}
            <small class="muted">${esc(p.effect)}</small>
            ${run ? `<div><div class="meter good"><i style="width:${pctDone}%"></i></div><small class="muted">Under construction · ready ${TL.fmtDate(run.end, true)}${run.delayed ? ' (delayed)' : ''}</small></div>`
              : blocked ? `<small class="muted">${esc(blocked)}</small>`
              : `<div class="row between"><span class="num"><b>${U.fm(cost)}</b> <span class="muted">· ${Math.round(p.days / 30)} months</span></span><div class="row"><button class="btn sm" data-act="invest" data-v="${k}" title="Ask the board to pay part of it">Ask board</button><button class="btn sm primary" data-act="project" data-v="${k}">Fund it</button></div></div>`}
          </div>`; }).join('')}</div>
        <div class="card-b muted" style="font-size:.8rem;border-top:1px solid var(--line-soft)">The board considers one investment request every 60 days. Their answer depends on their confidence in you and the club's finances. Each facility adds a small monthly running cost.</div></section>
      <div class="grid g-2">
        <section class="card card-b"><h3 style="margin-bottom:8px">Club records</h3><dl class="kv"><dt>Biggest win</dt><dd>${rec.bigWin ? `${rec.bigWin.score} v ${esc(rec.bigWin.opp)}` : '–'}</dd><dt>Heaviest defeat</dt><dd>${rec.bigLoss ? `${rec.bigLoss.score} v ${esc(rec.bigLoss.opp)}` : '–'}</dd><dt>Record crowd</dt><dd>${rec.attendance ? rec.attendance.n.toLocaleString('en-GB') : '–'}</dd></dl>
          <h3 style="margin:14px 0 8px">Trophies</h3>${trophies.length ? trophies.map(t => `<div>${U.seasonLabel(t.season)} · ${esc(t.name)}</div>`).join('') : '<div class="muted">None yet.</div>'}</section>
        <section class="card"><div class="card-h"><h3>Hall of fame</h3></div>${hof.length ? `<div class="tbl-wrap"><table class="tbl compact"><tbody>${hof.map(h => `<tr><td>${esc(h.name)}</td><td class="r">${h.apps} apps</td><td class="r">${h.goals} goals</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Appearances are counted at the end of each season.</div>'}</section>
      </div>
      ${commercialSection(s, c)}
      ${feederSection(s, c)}
      <section class="card card-b stack"><h3>Badge &amp; kit</h3>${U.badgeDesigner(Object.assign(c, { badge: c.badge || { shape: 'shield', pattern: 'plain', icon: 'none' }, kit: c.kit || { pattern: 'plain' } }), 'club')}</section>`;
  }
  /* ---------- Feeder clubs ---------- */
  const hashHue = str => { let h = 0; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const partnerCrest = (s, f, size) => {
    if (f.club && s.clubs[f.club]) return crest(s.clubs[f.club], size);
    const name = f.ext ? f.ext.name : f.name, h = hashHue(name);
    const pal = ['#B71C1C', '#0D47A1', '#1B5E20', '#4A148C', '#E65100', '#006064', '#212121', '#880E4F'];
    return crest({ id: name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(), c1: pal[h % pal.length], c2: h % 3 ? '#FFFFFF' : '#F2C94C' }, size);
  };
  const termTags = t => Object.keys(TL.FEEDER_TERMS).filter(k => t[k]).map(k => `<span class="tag yth">${TL.FEEDER_TERMS[k][0]}</span>`).join(' ');
  const natName = c => TL.NAT_NAMES[c] || c;
  function feederSection(s, c) {
    const list = TL.feedersOf(s, c.id), parent = TL.parentOf(s, c.id), elig = TL.feederEligible(s, c);
    const rows = list.map(f => {
      const loanees = c.players.map(P).filter(p => p.onLoan && p.onLoan.feeder === f.id);
      return `<div class="feeder"><div class="row" style="gap:12px;min-width:0">${partnerCrest(s, f, 40)}<div style="min-width:0"><b>${esc(TL.feederName(s, f))}</b><div class="muted" style="font-size:.82rem">${esc(natName(TL.feederCountry(s, f)))} · ${U.fm(f.fee)}/yr until ${f.end + 1}</div><div style="margin-top:4px">${termTags(f.terms)}</div></div></div>
        <div class="muted" style="font-size:.84rem">${f.terms.loans ? (loanees.length ? 'On loan there: ' + loanees.map(p => `<a href="#" data-act="player" data-id="${p.id}">${esc(p.name)}</a>`).join(', ') : 'No players on loan there. Open a young player (23 or under) and choose "Loan to…".') : 'No loan pathway in this deal.'}</div>
        <div class="row">${f.club ? `<button class="btn sm" data-act="club-modal" data-id="${f.club}">View club</button>` : ''}<button class="btn sm danger" data-act="feeder-end" data-id="${f.id}">End partnership</button></div></div>`;
    }).join('');
    return `<section class="card"><div class="card-h"><h3>Feeder clubs</h3>${!elig && list.length < 3 ? '<button class="btn sm primary" data-act="feeder-search">Find a feeder club</button>' : ''}</div>
      <div class="card-b stack" style="gap:12px">
        ${parent ? `<div class="feeder parent"><div class="row" style="gap:12px">${crest(s.clubs[parent.parent], 40)}<div><div class="eyebrow">Our parent club</div><b>${esc(s.clubs[parent.parent].name)}</b><div class="muted" style="font-size:.82rem">They pay us ${U.fm(parent.fee)}/yr until ${parent.end + 1} · ${termTags(parent.terms)}</div></div></div></div>` : ''}
        ${rows || (elig ? `<div class="muted">${esc(elig)}${!parent ? ' Bigger clubs abroad may approach you to become their feeder club, which brings income and loan players.' : ''}</div>` : '<div class="muted">No feeder clubs yet. Partner with clubs abroad to develop youngsters on loan, get first option on their talents and bring prospects into your academy. Up to three partnerships.</div>')}
        <div class="muted" style="font-size:.8rem">${Object.values(TL.FEEDER_TERMS).map(([n, d]) => `<b style="color:var(--text)">${n}:</b> ${d}`).join('<br>')}</div>
      </div></section>`;
  }
  U.modals['feeder-search'] = () => {
    const s = G(), c = U.me();
    const all = TL.feederCandidates(s, c);
    const countries = [...new Set(all.map(x => x.country))].sort((a, b) => natName(a).localeCompare(natName(b)));
    ui.fsCountry = ui.fsCountry && countries.includes(ui.fsCountry) ? ui.fsCountry : 'ALL';
    const list = all.filter(x => ui.fsCountry === 'ALL' || x.country === ui.fsCountry).slice(0, 60);
    const defTerms = { loans: true, option: true, youth: false };
    return { html: `<div class="modal-h"><div><div class="eyebrow">${list.length} possible partners</div><h2 style="font-size:1.4rem;margin-top:3px">Find a feeder club</h2></div><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div>
      <div class="modal-b stack" style="gap:12px">
        <select class="input" data-change="fs-country" aria-label="Country"><option value="ALL">All countries</option>${countries.map(k => `<option value="${k}" ${ui.fsCountry === k ? 'selected' : ''}>${esc(natName(k))}</option>`).join('')}</select>
        <div class="tbl-wrap"><table class="tbl compact"><tbody>${list.map(x => `<tr><td><span class="team">${partnerCrest(s, x, 22)}${esc(x.name)}</span></td><td class="muted">${esc(natName(x.country))}${x.sim ? '' : ' · overseas partner'}</td><td class="r muted">Rep ${x.rep}</td><td class="r">from ${U.fm(TL.feederAsk(s, c, x, defTerms, 3))}/yr</td><td class="r"><button class="btn sm primary" data-act="feeder-neg" data-key="${esc(x.key)}">Negotiate</button></td></tr>`).join('') || '<tr><td class="empty">No clubs available.</td></tr>'}</tbody></table></div>
      </div>` };
  };
  U.modals['feeder-deal'] = () => {
    const s = G(), c = U.me(), d = ui.fdeal, x = d.cand;
    const ask = TL.feederAsk(s, c, x, d.terms, d.years);
    return { cls: '', html: `<div class="modal-h">${partnerCrest(s, x, 40)}<div><div class="eyebrow">Feeder partnership · ${esc(natName(x.country))}</div><h2 style="font-size:1.4rem;margin-top:3px">${esc(x.name)}</h2></div><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div>
      <div class="modal-b stack" style="gap:14px">
        ${d.log.length ? `<div class="chatlog" aria-live="polite">${d.log.map(l => `<div class="msg ${l.who}">${esc(l.text)}</div>`).join('')}</div>` : ''}
        ${d.done ? `<div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">Done</button></div>` : `
        <div class="stack" style="gap:8px">${Object.entries(TL.FEEDER_TERMS).map(([k, [n, desc]]) => `<label class="check" style="white-space:normal;align-items:flex-start"><input type="checkbox" data-change="fd-term" data-k="${k}" ${d.terms[k] ? 'checked' : ''}> <span><b style="color:var(--text)">${n}</b><br><small>${esc(desc)}</small></span></label>`).join('')}</div>
        <div class="grid g-2" style="gap:12px">
          <label class="ctl"><span class="lbl">Annual fee (£m)</span><input id="fd-fee" class="input" type="number" min="0" step="0.05" value="${d.fee}"></label>
          <label class="ctl"><span class="lbl">Length</span><select class="input" data-change="fd-years">${[1, 2, 3, 4, 5].map(v => `<option value="${v}" ${d.years === v ? 'selected' : ''}>${v} year${v > 1 ? 's' : ''}</option>`).join('')}</select></label>
        </div>
        <div class="row between"><span class="muted" style="font-size:.85rem">They are likely to want about ${U.fm(ask)} a year for these terms. Paid monthly from your bank balance (${U.fm(c.finance.balance)}).</span><button class="btn primary" data-act="fd-submit">Make proposal</button></div>`}
      </div>` };
  };
  Object.assign(U.actions, {
    'feeder-search'() { ui.modal = { type: 'feeder-search' }; U.render(); },
    'change:fs-country'(t) { ui.fsCountry = t.value; U.render(); },
    'feeder-neg'(d) {
      const s = G(), c = U.me(), x = TL.feederCandidates(s, c).find(y => y.key === d.key); if (!x) return;
      const terms = { loans: true, option: true, youth: false };
      ui.fdeal = { cand: x, terms, years: 3, fee: Math.round(TL.feederAsk(s, c, x, terms, 3) * 0.8 * 20) / 20, round: 0, log: [], done: false };
      ui.modal = { type: 'feeder-deal' }; U.render();
    },
    'change:fd-term'(t) { ui.fdeal.terms[t.dataset.k] = t.checked; keepFee(); U.render(); },
    'change:fd-years'(t) { ui.fdeal.years = +t.value; keepFee(); U.render(); },
    'fd-submit'() {
      const s = G(), c = U.me(), d = ui.fdeal;
      d.fee = Math.max(0, Math.round((parseFloat(document.getElementById('fd-fee').value) || 0) * 100) / 100);
      d.log.push({ who: 'you', text: `We offer ${U.fm(d.fee)} a year for ${d.years} year${d.years > 1 ? 's' : ''} with: ${Object.keys(TL.FEEDER_TERMS).filter(k => d.terms[k]).map(k => TL.FEEDER_TERMS[k][0].toLowerCase()).join(', ') || 'no special terms'}.` });
      if (d.cand.club && TL.ownerIndex(s, d.cand.club) >= 0) { d.log.push({ who: 'them', text: 'Another manager runs that club. They would need to agree in person.' }); d.done = true; return U.render(); }
      if (TL.feedersOf(s, c.id).length >= 3) { d.log.push({ who: 'them', text: 'The board only allows three feeder partnerships.' }); d.done = true; return U.render(); }
      const r = TL.evaluateFeeder(s, c, d.cand, { fee: d.fee, years: d.years, terms: d.terms, round: d.round });
      d.round++;
      d.log.push({ who: 'them', text: r.msg });
      if (r.result === 'accept') { TL.createFeeder(s, c.id, d.cand, d.fee, d.years, d.terms); d.done = true; TL.addMail(s, 'board', `New feeder club: ${d.cand.name}`, r.msg); s.inbox[0].read = true; U.autosave(); }
      else if (r.result === 'counter') d.fee = r.fee;
      else if (d.round >= 4 || r.result === 'reject' && /ended/.test(r.msg)) d.done = true;
      U.render();
    },
    'feeder-end'(d) { const s = G(), f = s.feeders.find(x => x.id === +d.id); const left = Math.max(0, f.end - s.season + 1); U.ask(`End the partnership with ${TL.feederName(s, f)}?`, `You pay half of the remaining fees as compensation (${U.fm(f.fee * left * 0.5)}). Any players on loan there come back.`, 'End partnership', () => { toast(TL.endFeeder(s, f.id)); U.autosave(); }, true); }
  });
  // keep the typed fee when terms change
  function keepFee() { const el = document.getElementById('fd-fee'); if (el) ui.fdeal.fee = parseFloat(el.value) || ui.fdeal.fee; }

  U.actions.project = d => { const c = U.me(); U.ask(`Fund the ${TL.PROJECTS[d.v].name.toLowerCase()}?`, `It costs ${U.fm(TL.projectCost(G(), c, d.v))} from the club's bank balance (${U.fm(c.finance.balance)}) and takes about ${Math.round(TL.PROJECTS[d.v].days / 30)} months.`, 'Fund it', () => { toast(TL.startProject(G(), d.v)); U.autosave(); }); };
  U.actions.invest = d => { toast(TL.requestInvestment(G(), d.v)); U.autosave(); U.soft(); };
  U.views.club = viewClub;

  /* ---------- Settings & saves ---------- */
  function viewSettings() {
    const st = U.settings;
    const seg = (k, opts) => `<div class="seg wrap">${opts.map(([v, l]) => `<button class="${String(st[k]) === String(v) ? 'on' : ''}" data-act="set" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const tog = (k, l) => `<label class="check"><input type="checkbox" data-change="set-bool" data-k="${k}" ${st[k] ? 'checked' : ''}> ${l}</label>`;
    const errs = U.readJSON(U.KEY + 'errors', []);
    return `<div class="page-h"><div><div class="eyebrow">Stored only on this device</div><h1>Settings</h1></div></div>
      <div class="grid g-2">
        <section class="card card-b stack" style="gap:14px"><h3>Display</h3>
          <div class="ctl"><span class="lbl">Theme</span>${seg('theme', [['system', 'System'], ['dark', 'Dark'], ['light', 'Light']])}</div>
          <div class="ctl"><span class="lbl">Text size</span>${seg('size', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large'], ['xl', 'Extra large']])}</div>
          <div class="ctl"><span class="lbl">Currency</span>${seg('currency', Object.keys(TL.CURRENCIES).map(k => [k, k]))}</div>
          <div class="ctl"><span class="lbl">Date format</span>${seg('locale', [['en-GB', 'UK'], ['en-US', 'US'], ['en-NG', 'Nigeria']])}</div>
          <div class="ctl"><span class="lbl">Default match speed</span>${seg('speed', [[1, '1×'], [2, '2×'], [3, '4×']])}</div>
          ${tog('cb', 'Colour-blind friendly colours')}${tog('hc', 'High contrast')}${tog('tutorial', 'Show tips on the home screen')}</section>
        <section class="card card-b stack" style="gap:12px"><h3>Career</h3>
          <div class="row"><button class="btn primary" data-act="save">Save now</button><span class="muted" style="font-size:.82rem">${ui.unsaved ? 'You have unsaved progress.' : 'Everything is saved.'} Saving is permanent: you cannot go back to an earlier point.</span></div>
          <div class="ctl"><span class="lbl">Autosave</span>${seg('autosaveMonths', [[1, 'Every month'], [2, 'Every 2 months'], [6, 'Every 6 months'], [0, 'Off']])}<small class="muted">Counted in game time. Press Save (or Ctrl+S) any time.</small></div>
          <div class="row">${U.SLOTS.map(s => `<button class="btn" data-act="save-slot" data-v="${s}">Save to slot ${s}</button>`).join('')}</div>
          <div class="row"><button class="btn" data-act="export">Export save file</button><label class="btn" for="imp-file">Import save file</label><input type="file" id="imp-file" accept=".tlsave,application/json" class="hidden"></div>
          <div class="muted" style="font-size:.82rem">Export a save to move your career between your PC and phone.</div>
          <button class="btn danger" data-act="quit">Save and quit to title</button>
          <h3 style="margin-top:8px">Error log</h3>${errs.length ? `<div class="muted" style="font-size:.78rem;max-height:160px;overflow:auto">${errs.map(e => `<div>${esc(e.t.slice(0, 16))} · ${esc(e.msg)}</div>`).join('')}</div><button class="btn sm" data-act="clear-errors">Clear log</button>` : '<div class="muted">No errors recorded.</div>'}
          <h3 style="margin-top:8px">About</h3><div class="muted" style="font-size:.82rem">Touchline Management, developed by Investo Deokii · data ${esc(TL.DATA.version)}. A personal, non-commercial project. Works fully offline. Nothing is sent anywhere, except saves you choose to upload to your own Google Drive.</div></section>
      </div>
      ${U.cloudSection ? (setTimeout(() => U.cloudRefreshIfNeeded && U.cloudRefreshIfNeeded(), 0), U.cloudSection()) : ''}`;
  }
  Object.assign(U.actions, {
    set(d) { U.settings[d.k] = d.k === 'speed' || d.k === 'autosaveMonths' ? +d.v : d.v; U.saveSettings(); U.soft(); },
    'change:set-bool'(t) { U.settings[t.dataset.k] = t.checked; U.saveSettings(); U.soft(); },
    'save-slot'(d) { U.saveGame(+d.v); },
    export() { U.exportSave(); },
    quit() { U.saveGame(G().slot, true).then(() => { U.G = null; ui.screen = 'title'; U.render(); }); },
    'clear-errors'() { U.store.del(U.KEY + 'errors'); U.soft(); }
  });
  U.views.settings = viewSettings;
})();
