/* Touchline — user interface core: storage & saves, settings, shared helpers, the app shell, the matchday flow
   and the club screens. Extra screens register themselves through TL.UI (see ui-world.js and ui-club.js). */
(function () {
  const TL = window.TL;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'touchline:';
  const SLOTS = [1, 2, 3];

  /* ---------- Storage (all wrapped: storage can be unavailable) ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  const readJSON = (k, d) => { try { return JSON.parse(store.get(k)) || d; } catch (e) { return d; } };

  /* ---------- Local error log (never sent anywhere) ---------- */
  const logError = (msg, src) => { const list = readJSON(KEY + 'errors', []); list.unshift({ t: new Date().toISOString(), msg: String(msg).slice(0, 300), src: String(src || '').slice(0, 120) }); store.set(KEY + 'errors', JSON.stringify(list.slice(0, 25))); };
  window.addEventListener('error', e => logError(e.message, (e.filename || '') + ':' + (e.lineno || '')));
  window.addEventListener('unhandledrejection', e => logError(e.reason && e.reason.message || e.reason, 'promise'));

  /* ---------- Settings ---------- */
  const settings = Object.assign({ theme: 'system', size: 'm', speed: 2, currency: 'GBP', locale: 'en-GB', cb: false, hc: false, dev: false, tutorial: true, autosaveMonths: 2 }, readJSON(KEY + 'settings', {}));
  function saveSettings() { store.set(KEY + 'settings', JSON.stringify(settings)); }
  function applySettings() {
    let dark = settings.theme === 'dark';
    if (settings.theme === 'system') { try { dark = matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { dark = true; } }
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.setProperty('--fs', { s: '14px', m: '15px', l: '16.5px', xl: '18px' }[settings.size] || '15px');
    root.classList.toggle('cb', !!settings.cb);
    root.classList.toggle('hc', !!settings.hc);
    TL.currency = settings.currency; TL.locale = settings.locale;
  }

  let G = null;
  const ui = { screen: 'splash', tab: 'home', mailOpen: null, mailAll: false, squadFilter: 'ALL', sort: { k: 'pos', d: 1 }, tactSel: null, modal: null, m: null, post: null, seasonRes: null, comp: null, tteam: 'club', mq: null };

  /* ---------- Small helpers ---------- */
  const me = () => G && G.manager.clubId ? G.clubs[G.manager.clubId] : null;
  const myNation = () => G && G.manager.nationId ? G.nations[G.manager.nationId] : null;
  const P = id => G.players[id];
  const T = id => TL.team(G, id);
  const hexLum = hex => { const h = String(hex || '#888').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const inkOn = (bg, alt) => { const lb = hexLum(bg); if (alt && Math.abs(hexLum(alt) - lb) > 0.4) return alt; return lb > 0.6 ? '#111' : '#fff'; };
  const surname = n => { const p = n.split(' '); return p.length > 1 ? p.slice(1).join(' ') : n; };
  const tier = o => o >= 85 ? 't1' : o >= 78 ? 't2' : o >= 70 ? 't3' : 't4';
  const aCls = v => v <= 5 ? 'a1' : v <= 10 ? 'a2' : v <= 14 ? 'a3' : v <= 17 ? 'a4' : 'a5';
  const avgR = p => p.stats.rated ? p.stats.ratingSum / p.stats.rated : 0;
  const formAvg = p => p.form && p.form.length ? p.form.reduce((a, b) => a + b, 0) / p.form.length : 0;
  const moraleWord = m => m >= 85 ? ['Superb', 'var(--win)'] : m >= 65 ? ['Good', 'var(--win)'] : m >= 45 ? ['Okay', 'var(--muted)'] : m >= 25 ? ['Poor', 'var(--warn)'] : ['Very poor', 'var(--loss)'];
  const seasonLabel = s => `${s}/${String(s + 1).slice(2)}`;
  const posTag = pos => `<span class="pos ${TL.POS_GROUP[pos]}">${pos}</span>`;
  const ovrTag = o => `<span class="ovr ${tier(o)}">${o}</span>`;
  const ratingTag = r => r ? `<span class="rating ${r >= 7.5 ? 'hi' : r < 6 ? 'lo' : ''}">${r.toFixed(1)}</span>` : '<span class="faint">–</span>';
  const condBar = c => `<span class="cond"><span class="meter ${c >= 85 ? 'good' : c >= 70 ? 'warn' : 'bad'}"><i style="width:${c}%"></i></span><span class="muted">${Math.round(c)}%</span></span>`;
  const statusTags = p => (p.onLoan ? '<span class="tag yth">On loan</span> ' : '') + (p.injury > 0 ? `<span class="tag inj" title="${esc(p.injuryName)}">Inj ${p.injury}d</span> ` : '') + (p.ban > 0 ? `<span class="tag sus">Ban ${p.ban}</span> ` : '') + (p.academy ? '<span class="tag yth">Academy</span> ' : '') + (p.wonderkid ? '<span class="tag star">★ Wonderkid</span> ' : '') + (p.requested ? '<span class="tag sus">Wants out</span> ' : '');
  const formPills = arr => `<span class="form">${(arr && arr.length ? arr : []).map(r => `<i class="${r}">${r}</i>`).join('') || '<i class="E"></i><i class="E"></i><i class="E"></i>'}</span>`;
  const fm = v => TL.fmtM(v);
  const wageTxt = k => TL.fmtWage(k);
  const contractTxt = p => p.contract ? `Jun ${p.contract.end + 1}` : '–';
  const clubName = id => id && G.clubs[id] ? G.clubs[id].name : 'Free agent';
  const teamName = id => (T(id) || { name: id }).name;
  const ablTxt = p => { const v = TL.abilityView(G, p); return v.known ? ovrTag(p.ovr) : `<span class="ovr t4 range">${v.lo}–${v.hi}</span>`; };
  const potTxt = p => { const v = TL.abilityView(G, p); return v.plo >= v.phi ? String(v.phi) : `${v.plo}–${v.phi}`; };
  const windowPill = () => { const w = TL.windowInfo(G); return w.open ? `<span class="pill good">${w.name} window open · closes ${TL.fmtDate(w.closes)}</span>` : `<span class="pill">Window closed · opens ${TL.fmtDate(w.opens)}</span>`; };
  const isShort = id => G.shortlist.includes(id);
  const money = fm;

  /* ---------- Crests, badges and kits ---------- */
  let svgId = 0;
  const ICONS_SVG = {
    star: '<path d="m20 9 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    ball: '<circle cx="20" cy="17" r="7.5"/><path d="m20 12.5 3.6 2.6-1.4 4.2h-4.4l-1.4-4.2z" fill-opacity=".35"/>',
    crown: '<path d="M11 21h18l1.5-10-5.5 4.5L20 9l-5 6.5L9.5 11z"/>',
    lion: '<path d="M14 23c0-5 2-9 6-9.5 2.2-.3 4 1 5 3l2.5-.5-1.5 3 1.5 2.5-3.5 1.5h-3l-1 3h-3z"/>',
    eagle: '<path d="M8 13c4 1 7 3 9 6l3-3 3 3c2-3 5-5 9-6-2 4-5 7-9 8l-3 3-3-3c-4-1-7-4-9-8z"/>',
    bolt: '<path d="M22 8 13 19h6l-2 9 9-12h-6z"/>',
    tree: '<path d="M20 8c4 0 7 3 7 7 0 3-2 5-5 6v4h-4v-4c-3-1-5-3-5-6 0-4 3-7 7-7z"/>',
    anchor: '<path d="M19 9h2v3h3v2h-3v9c3-.3 5-2 6-4l2 1c-1.5 3.5-5 5.5-9 5.5S12.5 23.5 11 20l2-1c1 2 3 3.7 6 4v-9h-3v-2h3z"/>',
    castle: '<path d="M11 25V13h3v3h3v-3h6v3h3v-3h3v12h-6v-4h-6v4z"/>'
  };
  const SHAPES = {
    shield: 'M20 1.6 37.6 7.2v14.6c0 11.2-7.5 18.6-17.6 22.6C9.9 40.4 2.4 33 2.4 21.8V7.2z',
    round: 'M20 2a21 21 0 1 1 0 42 21 21 0 0 1 0-42z',
    crest: 'M4 3h32v17c0 12-8 19-16 23C12 39 4 32 4 20z',
    diamond: 'M20 1 39 23 20 45 1 23z'
  };
  function patternSvg(pat, c2, clip) {
    const g = `<g clip-path="url(#${clip})" fill="${c2}">`;
    if (pat === 'stripes') return g + [6, 16, 26].map(x => `<rect x="${x}" y="0" width="5" height="46"/>`).join('') + '</g>';
    if (pat === 'hoops') return g + [8, 20, 32].map(y => `<rect x="0" y="${y}" width="40" height="5"/>`).join('') + '</g>';
    if (pat === 'sash') return g + '<path d="M-2 10 8 0 44 36 34 46z"/></g>';
    if (pat === 'halves') return g + '<rect x="20" y="0" width="20" height="46"/></g>';
    if (pat === 'quarters') return g + '<rect x="20" y="0" width="20" height="23"/><rect x="0" y="23" width="20" height="23"/></g>';
    if (pat === 'chevron') return g + '<path d="M0 14 20 26 40 14v7L20 33 0 21z"/></g>';
    return '';
  }
  function crest(team, size) {
    size = size || 36;
    if (!team) return `<span class="crest" style="width:${size}px;height:${Math.round(size * 1.15)}px"></span>`;
    const id = team.code || team.id;
    if (team.isNation) {
      const txt = inkOn(team.c1, team.c2);
      return `<span class="crest" style="width:${size}px;height:${Math.round(size * 1.15)}px" aria-hidden="true"><svg viewBox="0 0 40 46"><rect x="2" y="7" width="36" height="32" rx="5" fill="${team.c1}" stroke="var(--line)" stroke-width="1"/><rect x="2" y="27" width="36" height="12" rx="0" fill="${team.c2}"/><rect x="2" y="7" width="36" height="32" rx="5" fill="none" stroke="var(--line)"/><text x="20" y="23.5" text-anchor="middle" font-family="Bahnschrift, 'Arial Narrow', sans-serif" font-weight="700" font-size="11" fill="${txt}">${esc(id)}</text></svg></span>`;
    }
    const b = team.badge;
    const txt = inkOn(team.c1, team.c2);
    if (b) {
      const clip = 'cl' + (++svgId);
      const shape = SHAPES[b.shape] || SHAPES.shield;
      const icon = ICONS_SVG[b.icon];
      return `<span class="crest" style="width:${size}px;height:${Math.round(size * 1.15)}px" aria-hidden="true"><svg viewBox="0 0 40 46"><defs><clipPath id="${clip}"><path d="${shape}"/></clipPath></defs><path d="${shape}" fill="${team.c1}"/>${patternSvg(b.pattern, team.c2, clip)}${icon ? `<g fill="${inkOn(b.pattern && b.pattern !== 'plain' ? team.c2 : team.c1, team.c2)}" stroke="${team.c1}" stroke-width=".6">${icon}</g>` : ''}<path d="${shape}" fill="none" stroke="${team.c2}" stroke-width="2"/><text x="20" y="${icon ? 37 : 28}" text-anchor="middle" font-family="Bahnschrift, 'Arial Narrow', sans-serif" font-weight="700" font-size="${icon ? 8 : 11}" fill="${txt}" stroke="${team.c1}" stroke-width=".4" paint-order="stroke">${esc(team.short || team.id)}</text></svg></span>`;
    }
    return `<span class="crest" style="width:${size}px;height:${Math.round(size * 1.15)}px" aria-hidden="true"><svg viewBox="0 0 40 46"><path d="${SHAPES.shield}" fill="${team.c1}" stroke="${team.c2}" stroke-width="2.2"/><path d="M5.2 11.2h29.6v3.2H5.2z" fill="${team.c2}" opacity=".9"/><text x="20" y="30.5" text-anchor="middle" font-family="Bahnschrift, 'Arial Narrow', sans-serif" font-weight="700" font-size="11" letter-spacing=".4" fill="${txt}">${esc(team.short || team.id)}</text></svg></span>`;
  }
  function kitSvg(c1, c2, pattern, size) {
    size = size || 80;
    const clip = 'kc' + (++svgId);
    const body = 'M14 6 20 3h10l6 3 10 6-5 9-5-3v26H14V18l-5 3-5-9z';
    const pat = pattern === 'pinstripes' ? `<g clip-path="url(#${clip})" fill="${c2}">${[16, 20, 24, 28, 32, 36].map(x => `<rect x="${x}" y="0" width="1" height="50"/>`).join('')}</g>` : patternSvg(pattern, c2, clip).replace(/height="46"/g, 'height="50"').replace(/width="40"/g, 'width="50"');
    return `<svg width="${size}" height="${size}" viewBox="0 0 50 50" aria-hidden="true"><defs><clipPath id="${clip}"><path d="${body}"/></clipPath></defs><path d="${body}" fill="${c1}"/>${pat}<path d="${body}" fill="none" stroke="var(--line)" stroke-width="1"/><path d="M20 3c1 3 9 3 10 0" fill="none" stroke="${c2}" stroke-width="1.5"/></svg>`;
  }

  const ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    squad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.4.2 4.2 1.9 4.9 4.6"/></svg>',
    tactics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3" width="17" height="18" rx="2"/><path d="M3.5 12h17"/><circle cx="12" cy="12" r="2.6"/><circle cx="8" cy="7" r="1"/><circle cx="16" cy="7" r="1"/><circle cx="12" cy="17.5" r="1"/></svg>',
    development: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M4 16l5-5 4 3 7-8"/><path d="M15 6h5v5"/></svg>',
    competitions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20.5h7M9.5 17h5"/></svg>',
    club: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 20 5.5v6c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10v-6z"/><path d="M8.5 11.5l2.5 2.5 4.5-5"/></svg>',
    training: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 9 9l4 6 3-5 4 10"/><circle cx="16" cy="5" r="2"/></svg>',
    transfers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14l-4-4M20 16H6l4 4"/></svg>',
    finances: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    staff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></svg>',
    academy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-9M12 12C12 7 8 5 4 5c0 4 3 7 8 7zM12 14c0-4 3-6 7-6 0 3.5-2.5 6-7 6z"/></svg>',
    nation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    manager: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg>',
    boot: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h6l1.5 4.5 7 1.5c1.5.3 2.5 1.5 2.5 3V17H4z"/><path d="M4 17v2.5h17"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>',
    starOn: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>',
    glove: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21v-3L4.5 13V8.5a1.5 1.5 0 0 1 3 0V11V5.5a1.5 1.5 0 0 1 3 0V10V4.5a1.5 1.5 0 0 1 3 0V10V6a1.5 1.5 0 0 1 3 0v7c0 3-1.5 5-3.5 5v3"/></svg>',
    sprout: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-9M12 12C12 7 8 5 4 5c0 4 3 7 8 7zM12 14c0-4 3-6 7-6 0 3.5-2.5 6-7 6z"/></svg>',
    pass: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 16.5C10 9 14 7.5 17 7"/></svg>',
    mic: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'
  };

  /* ---------- Navigation: tabs depend on the manager's jobs ---------- */
  function tabsFor() {
    const m = G.manager, t = [['home', 'Home']];
    if (m.clubId) t.push(['squad', 'Squad'], ['development', 'Development'], ['academy', 'Academy'], ['training', 'Training'], ['tactics', 'Tactics'], ['transfers', 'Transfers']);
    t.push(['competitions', 'Competitions']);
    if (m.nationId) t.push(['nation', 'Nation']);
    if (m.clubId) t.push(['finances', 'Finances'], ['staff', 'Staff'], ['club', 'Club']);
    t.push(['manager', 'Manager'], ['settings', 'Settings']);
    return t;
  }
  function mobileTabs() {
    const m = G.manager;
    return m.clubId ? [['home', 'Home'], ['squad', 'Squad'], ['tactics', 'Tactics'], ['competitions', 'Comps'], ['more', 'More']]
      : [['home', 'Home'], m.nationId ? ['nation', 'Nation'] : ['manager', 'Jobs'], ['competitions', 'Comps'], ['settings', 'Settings'], ['more', 'More']];
  }

  /* ---------- Saves: gzip-compressed, IndexedDB with localStorage fallback, checksummed ---------- */
  const idb = (() => {
    let dbp = null, broken = false;
    const timed = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => { broken = true; rej(new Error('IndexedDB timeout')); }, ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
    const open = () => dbp || (dbp = timed(new Promise((res, rej) => {
      try { const r = indexedDB.open('touchline', 1); r.onupgradeneeded = () => r.result.createObjectStore('saves'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
      catch (e) { rej(e); }
    }), 2500));
    const run = (mode, fn) => broken ? Promise.reject(new Error('IndexedDB unavailable')) : open().then(db => timed(new Promise((res, rej) => { const tx = db.transaction('saves', mode); const q = fn(tx.objectStore('saves')); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }), 8000));
    return { get: k => run('readonly', s => s.get(k)), set: (k, v) => run('readwrite', s => s.put(v, k)), del: k => run('readwrite', s => s.delete(k)) };
  })();
  const putData = (k, v) => idb.set(k, v).then(() => true).catch(() => store.set(k, v));
  const getData = k => idb.get(k).then(v => v != null ? v : store.get(k)).catch(() => store.get(k));
  const delData = k => { store.del(k); return idb.del(k).catch(() => {}); };
  const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = str => { const s = atob(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const pack = async str => { if (typeof CompressionStream === 'undefined') return 'J' + str; const buf = await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer(); return 'Z' + b64(buf); };
  const unpack = async s => { if (!s) return null; if (s[0] === 'Z') return await new Response(new Blob([unb64(s.slice(1))]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); if (s[0] === 'J') return s.slice(1); return s; };

  const meta = () => readJSON(KEY + 'meta', {});
  // Saves run one at a time; while one is writing, further requests collapse into a single follow-up save
  // of the latest state, so an older snapshot can never land after a newer one.
  let saveChain = Promise.resolve(true), queued = null;
  function saveGame(slot, quiet) {
    if (!G) return Promise.resolve(false);
    slot = slot || G.slot || 1;
    G.slot = slot;
    if (queued && queued.slot === slot) { queued.quiet = queued.quiet && quiet; return queued.p; }
    const q = { slot, quiet };
    q.p = saveChain = saveChain.then(() => { if (queued === q) queued = null; return G ? writeSave(q.slot, q.quiet) : false; });
    queued = q;
    return q.p;
  }
  function writeSave(slot, quiet) {
    G.lastSaved = G.date;
    const json = JSON.stringify(G);
    const k = KEY + 'slot' + slot;
    const m = meta();
    const club = me(), nat = myNation();
    m[slot] = { manager: G.managers.map(x => x.name).join(' & '), club: club ? club.name : nat ? nat.name : 'Unemployed', id: club ? club.id : nat ? nat.code : '', c1: (club || nat || {}).c1 || '#555', c2: (club || nat || {}).c2 || '#ccc', season: G.season, date: G.date, saved: Date.now(), sum: TL.checksum(json), v: 3 };
    return pack(json)
      .then(packed => getData(k).then(prev => prev ? putData(k + ':bak', prev) : true).then(() => putData(k, packed)))
      .then(ok => {
        if (!ok) { toast('Could not save: storage is full or blocked. Use Export save in Settings.'); return false; }
        store.set(KEY + 'meta', JSON.stringify(m));
        store.set(KEY + 'last', String(slot));
        ui.unsaved = false; refreshSaveBtn();
        if (!quiet) toast('Game saved');
        if (U.afterSave) U.afterSave(slot, json);
        return true;
      }).catch(e => { logError(e.message, 'save'); toast('Saving failed. Use Export save in Settings as a backup.'); return false; });
  }
  // Progress is saved when you press Save (or Ctrl+S) and automatically every few months of game time
  // (Settings: every month, 2 months by default, 6 months, or never).
  function autosave() {
    if (!G) return;
    ui.unsaved = true; refreshSaveBtn();
    const months = settings.autosaveMonths == null ? 2 : +settings.autosaveMonths;
    if (!months) return;
    const last = G.lastSaved || G.date;
    if (!G.lastSaved) { G.lastSaved = G.date; return; }
    if (TL.daysBetween(last, G.date) >= months * 30) saveGame(G.slot, true).then(ok => { if (ok) toast(`Autosaved (${TL.fmtDate(G.date, true)})`); });
  }
  const manualSave = () => { if (!G) return; if (ui.screen === 'match') { toast('Finish the match first, then save.'); return; } saveGame(G.slot, false); };
  function refreshSaveBtn() { const b = document.getElementById('save-btn'); if (b) { b.classList.toggle('unsaved', !!ui.unsaved); b.title = ui.unsaved ? 'Unsaved progress. Click to save (Ctrl+S).' : 'All progress saved'; } }
  // Shared save-file format (used by Export, Import and the cloud)
  async function saveFileText() { const json = JSON.stringify(G); return JSON.stringify({ app: 'touchline', v: 3, sum: TL.checksum(json), data: await pack(json), meta: { club: (me() || myNation() || { name: 'Unemployed' }).name, season: G.season, date: G.date, manager: G.manager.name } }); }
  async function loadSaveText(text, slot) {
    const wrap = JSON.parse(text);
    if (wrap.app !== 'touchline') throw new Error('not a save');
    const txt = await unpack(wrap.data);
    const data = JSON.parse(txt);
    if (!data || !data.clubs || !data.players) throw new Error('bad save');
    G = TL.migrate(data); G.slot = slot; G.tampered = TL.checksum(txt) !== wrap.sum;
    await saveGame(slot, true);
    ui.screen = 'game'; ui.tab = 'home'; ui.modal = null; ui.unsaved = false;
    render();
    return G.tampered;
  }
  async function loadSlot(slot) {
    const parse = async raw => { try { const txt = await unpack(raw); const d = JSON.parse(txt); return d && d.clubs ? { d, txt } : null; } catch (e) { return null; } };
    let r = await parse(await getData(KEY + 'slot' + slot));
    if (!r) { r = await parse(await getData(KEY + 'slot' + slot + ':bak')); if (r) toast('Main save was damaged. Loaded the backup.'); }
    if (!r) { toast('That save could not be read.'); return; }
    const mm = meta()[slot];
    G = TL.migrate(r.d); G.slot = slot; ui.unsaved = false; if (!G.lastSaved) G.lastSaved = G.date;
    G.tampered = !!(mm && mm.sum && mm.sum !== TL.checksum(r.txt));
    if (G.tampered) toast('Note: this save was modified outside the game.');
    ui.screen = 'game'; ui.tab = 'home'; ui.mailOpen = null; ui.modal = null;
    store.set(KEY + 'last', String(slot));
    if (G.managers.length > 1) { ui.screen = 'handover'; ui.handNext = 'game'; }
    render();
  }
  async function exportSave() {
    const blob = new Blob([await saveFileText()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `touchline-${(me() || myNation() || { id: 'career' }).id.toLowerCase().replace(/[^a-z0-9]/g, '')}-${G.season}-${G.date}.tlsave`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Save file exported');
  }
  function importSave(file) {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const m = meta();
        const slot = SLOTS.find(s => !m[s]) || (G && G.slot) || 1;
        const tampered = await loadSaveText(r.result, slot);
        toast(tampered ? `Imported into slot ${slot}. Note: this file was edited outside the game.` : `Imported into slot ${slot}`);
      } catch (e) { toast('That file is not a Touchline save.'); }
    };
    r.readAsText(file);
  }

  /* ---------- Toast & modal ---------- */
  let toastTimer;
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }
  let confirmFn = null;
  function ask(title, text, yesLabel, fn, danger) { confirmFn = fn; ui.modal = { type: 'confirm', title, text, yes: yesLabel, danger }; render(); }
  const needClub = () => `<section class="card"><div class="empty"><h3 style="margin-bottom:8px">You're not managing a club</h3><p class="muted">Apply for jobs on the Manager screen, or wait for offers in your inbox.</p><button class="btn primary" data-act="tab" data-v="manager">Find a job</button></div></section>`;

  /* =========================================================
     TITLE & LOAD
     ========================================================= */
  function viewTitle() {
    const m = meta(); const last = store.get(KEY + 'last'); const lm = last && m[last];
    return `<div class="title-screen">
      <svg class="bgpitch" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="var(--line)" stroke-width="2"><rect x="60" y="60" width="1080" height="680" rx="4"/><path d="M600 60v680"/><circle cx="600" cy="400" r="95"/><rect x="60" y="230" width="170" height="340"/><rect x="970" y="230" width="170" height="340"/><rect x="60" y="320" width="60" height="160"/><rect x="1080" y="320" width="60" height="160"/><path d="M230 330a90 90 0 0 1 0 140M970 330a90 90 0 0 0 0 140"/></g></svg>
      <div class="title-card">
        <div><div class="wordmark">Touch<span>line</span></div><div class="wordmark-sub">Management</div><div class="tag-line">Football management, fully offline.</div></div>
        <div class="menu">
          ${lm ? `<button class="btn primary" data-act="load" data-slot="${last}"><span>Continue career</span><small>${esc(lm.club)} · ${seasonLabel(lm.season)} · ${TL.fmtDate(lm.date)}</small></button>` : ''}
          <button class="btn ${lm ? '' : 'primary'}" data-act="new"><span>New career</span><small>8 leagues · ${TL.NATIONS_DATA.length} nations</small></button>
          <button class="btn" data-act="go-load"><span>Load career</span><small>${Object.keys(m).length} saved</small></button>
        </div>
        <div class="row between faint" style="font-size:.8rem"><span>Developed by Investo Deokii · data ${TL.DATA.version}</span>
          <div class="seg" role="group" aria-label="Theme">${['system', 'dark', 'light'].map(t => `<button class="${settings.theme === t ? 'on' : ''}" data-act="theme" data-v="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
      </div></div>`;
  }
  // Opening screen: studio credit, then the title screen (tap or press any key to skip)
  let splashTimer = null;
  function viewSplash() {
    clearTimeout(splashTimer);
    splashTimer = setTimeout(() => { if (ui.screen === 'splash') { ui.screen = 'title'; render(); } }, 3400);
    return `<div class="splash" data-act="splash-skip" role="button" tabindex="0" aria-label="Skip intro">
      <div class="splash-inner">
        <svg class="splash-mark" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="none" stroke="var(--accent)" stroke-width="3"/><path d="M60 6v108M6 60h108" stroke="var(--accent)" stroke-width="1.5" opacity=".35"/><circle cx="60" cy="60" r="16" fill="none" stroke="var(--accent)" stroke-width="3"/><circle cx="60" cy="60" r="4" fill="var(--accent)"/></svg>
        <div class="splash-by">Developed by</div>
        <div class="splash-dev">Investo Deokii</div>
        <div class="splash-game">Touch<span>line</span> Management</div>
      </div>
      <div class="splash-skip">Tap to continue</div>
    </div>`;
  }
  function viewLoad() {
    const m = meta();
    return `<div class="newc" style="max-width:720px">
      <div class="page-h"><div><div class="eyebrow">Careers on this device</div><h1 class="display" style="font-size:2rem;text-transform:uppercase">Load career</h1></div><button class="btn ghost" data-act="title">Back</button></div>
      ${SLOTS.map(s => { const x = m[s]; return `<div class="card card-b row between"><div class="row">${x ? crest({ id: x.id || '?', c1: x.c1 || '#555', c2: x.c2 || '#ccc' }, 36) : '<span class="ovr t4">' + s + '</span>'}<div><b>${x ? esc(x.manager) + ' · ' + esc(x.club) : 'Empty slot ' + s}</b><div class="muted" style="font-size:.82rem">${x ? `${seasonLabel(x.season)} · ${TL.fmtDate(x.date, true)} · saved ${new Date(x.saved).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}${x.v !== 3 ? ' · older version' : ''}` : 'No career saved here'}</div></div></div>
        ${x ? `<div class="row"><button class="btn danger sm" data-act="del-slot" data-slot="${s}">Delete</button><button class="btn primary" data-act="load" data-slot="${s}">Load</button></div>` : ''}</div>`; }).join('')}
      <div class="card card-b row between"><div><b>Import a save file</b><div class="muted" style="font-size:.82rem">Move a career from another device (.tlsave)</div></div><label class="btn" for="imp-file">Choose file</label><input type="file" id="imp-file" accept=".tlsave,application/json" class="hidden"></div>
      ${U.cloudSection ? (setTimeout(() => U.cloudRefreshIfNeeded && U.cloudRefreshIfNeeded(), 0), U.cloudSection()) : ''}
    </div>`;
  }

  /* =========================================================
     SHELL
     ========================================================= */
  function viewShell() {
    const m = G.manager;
    const unread = G.inbox.filter(x => !x.read).length;
    const c = me(), n = myNation(), head = c || n;
    const tabs = tabsFor();
    if (!tabs.some(t => t[0] === ui.tab) && ui.tab !== 'more') ui.tab = 'home';
    const openOffers = c ? G.offers.filter(o => o.status === 'open' && P(o.pid) && P(o.pid).clubId === c.id).length : 0;
    const nav = tabs.map(([k, l]) => `<button class="navbtn ${ui.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${ICON[k]}<span>${l}</span>${k === 'home' && unread ? `<span class="badge">${unread}</span>` : ''}${k === 'transfers' && openOffers ? `<span class="badge">${openOffers}</span>` : ''}</button>`).join('');
    const fn = U.views[ui.tab] || viewHome;
    const body = fn();
    const ci = continueInfo();
    const nf = TL.nextUserFixture(G);
    const multi = G.managers.length > 1;
    return `<div class="shell">
      <nav class="rail" aria-label="Main">
        <div class="club">${head ? crest(head, 38) : `<span class="ovr t4">${esc(m.name[0] || '?')}</span>`}<div><b>${esc(head ? head.name : 'Unemployed')}</b><span class="muted" style="font-size:.8rem">${esc(m.name)}${c && n ? ` · ${esc(n.name)}` : ''}</span></div></div>
        ${nav}
        <div class="foot">${seasonLabel(G.season)} · Offline${multi ? `<br>Hot-seat: ${G.managers.length} managers` : ''}${G.tampered ? '<br><span style="color:var(--warn)">Modified save</span>' : ''}</div>
      </nav>
      <div class="main">
        <header class="topbar">
          <span class="mobile-only">${head ? crest(head, 28) : ''}</span>
          <div class="date">${TL.fmtDate(G.date, true)}<small>${multi ? `<b style="color:var(--accent-text)">${esc(m.name)}</b> · ` : ''}${nf ? (nf.date === G.date ? 'Matchday · ' + esc(TL.compName(G, nf)) : `Next: ${esc(TL.compName(G, nf))} · ${TL.fmtDate(nf.date)}`) : seasonLabel(G.season)}</small></div>
          <div class="spacer"></div>
          <button class="btn big save-btn ${ui.unsaved ? 'unsaved' : ''}" id="save-btn" data-act="save" title="${ui.unsaved ? 'Unsaved progress. Click to save (Ctrl+S).' : 'All progress saved'}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M7 21v-7h10v7"/></svg><span class="hide-sm">Save</span></button>
          ${ci === 'Next day' ? `<button class="btn big skip-btn" data-act="skip" title="Move on day by day until the next match or important news (shortcut: S)"><span class="hide-sm">Skip to next event</span><span class="mobile-only">Skip</span> ⏭</button>` : ''}
          <button class="btn primary big" data-act="continue" title="Shortcut: Space">${ci} ${ICON.play}</button>
        </header>
        <main class="content" id="content"><div class="content-inner">${body}</div></main>
      </div>
      <nav class="tabbar" aria-label="Main">${mobileTabs().map(([k, l]) => `<button class="${ui.tab === k || (k === 'more' && !mobileTabs().some(t => t[0] === ui.tab)) ? 'on' : ''}" data-act="tab" data-v="${k}">${ICON[k]}<span>${l}${k === 'home' && unread ? ' •' : ''}</span></button>`).join('')}</nav>
    </div>`;
  }
  function viewMore() {
    const mob = mobileTabs().map(t => t[0]);
    const rest = tabsFor().filter(t => !mob.includes(t[0]));
    return `<div class="page-h"><div><div class="eyebrow">${esc(G.manager.name)}</div><h1>More</h1></div></div>
      <div class="more-grid">${rest.map(([k, l]) => `<button class="more-btn" data-act="tab" data-v="${k}">${ICON[k]}<span>${l}</span></button>`).join('')}</div>`;
  }

  function continueInfo() {
    if (TL.seasonOver(G)) return 'Season review';
    if (G.managers.length > 1 && G.active < G.managers.length - 1 && !TL.humanFixturesToday(G).length) return 'End turn';
    if (TL.humanFixturesToday(G).length) return 'Go to match';
    return 'Next day';
  }

  /* =========================================================
     HOME
     ========================================================= */
  function viewHome() {
    const m = G.manager, c = me(), n = myNation();
    const f = TL.nextUserFixture(G);
    const mails = ui.mailAll ? G.inbox : G.inbox.slice(0, 8);
    const lastF = m.lastResult && G.fixtures.find(x => x.id === m.lastResult);
    const lastNF = m.lastNResult && G.fixtures.find(x => x.id === m.lastNResult);
    let right = todayCard();
    if (c) {
      const tbl = TL.table(G, c.leagueId);
      const row = tbl.find(r => r.id === c.id) || { pos: 1 };
      const idx = row.pos - 1, from = Math.max(0, Math.min(idx - 2, tbl.length - 5));
      const conf = Math.round(m.board.confidence);
      const confCls = conf >= 60 ? 'good' : conf >= 35 ? 'warn' : 'bad';
      const confWord = conf >= 80 ? 'Delighted' : conf >= 60 ? 'Pleased' : conf >= 40 ? 'Satisfied' : conf >= 25 ? 'Concerned' : 'Under threat';
      const unavailable = c.players.map(P).filter(p => p.injury > 0 || p.ban > 0);
      right += `<section class="card"><div class="card-h"><h3>${esc(TL.leagueDef(G, c.leagueId).name)}</h3><button class="btn sm ghost" data-act="comp" data-v="${c.leagueId}">Full table</button></div>
          <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th class="c">#</th><th>Club</th><th class="r">P</th><th class="r">GD</th><th class="r">Pts</th></tr></thead><tbody>
          ${tbl.slice(from, from + 5).map(r => `<tr class="${r.id === c.id ? 'me' : ''} click" data-act="club-modal" data-id="${r.id}"><td class="c">${r.pos}</td><td><span class="team">${crest(G.clubs[r.id], 20)}${esc(G.clubs[r.id].name)}</span></td><td class="r">${r.p}</td><td class="r">${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="r"><b>${r.pts}</b></td></tr>`).join('')}
          </tbody></table></div></section>
        <section class="card card-b"><div class="row between"><h3>Board confidence</h3><b style="color:var(--${confCls === 'good' ? 'win' : confCls === 'warn' ? 'warn' : 'loss'})">${confWord}</b></div>
          <div class="meter ${confCls}" style="margin:12px 0 10px"><i style="width:${conf}%"></i></div>
          <div class="muted" style="font-size:.85rem">Objective: ${esc(TL.targetText(G, c.id, m.board.target))}. Now ${TL.ordinal(row.pos)}.</div>
          <div class="row between muted" style="font-size:.8rem;margin-top:8px"><span>Fans: ${fanWord(c.fans.mood)}</span><span>Reputation ${Math.round(m.rep)}</span></div></section>
        ${transfersCard()}`;
      if (lastF) right += lastResultCard(lastF, c.id);
      right += `<section class="card"><div class="card-h"><h3>Unavailable</h3><span class="muted" style="font-size:.82rem">${unavailable.length} player${unavailable.length === 1 ? '' : 's'}</span></div>
          ${unavailable.length ? `<div class="tbl-wrap"><table class="tbl compact"><tbody>${unavailable.map(p => `<tr class="click" data-act="player" data-id="${p.id}"><td>${posTag(p.pos)}</td><td><b>${esc(p.name)}</b></td><td class="r">${p.injury > 0 ? `<span class="tag inj">${esc(p.injuryName)} · ${p.injury}d</span>` : `<span class="tag sus">Suspended · ${p.ban}</span>`}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty" style="padding:18px">Everyone is fit and available.</div>'}
        </section>`;
    }
    if (n) right += U.nationCard ? U.nationCard() : '';
    if (lastNF) right += lastResultCard(lastNF, n && n.id);
    if (!c && !n) right += `<section class="card card-b stack" style="gap:10px"><h3>Out of work</h3><p class="muted" style="margin:0">Reputation ${Math.round(m.rep)}/100. ${G.vacancies.length} job${G.vacancies.length === 1 ? '' : 's'} open.</p><button class="btn primary" data-act="tab" data-v="manager">Browse jobs</button></section>`;
    return `${U.tutorialCard ? U.tutorialCard() : ''}<div class="grid g-home">
      <div class="stack">
        ${f ? nextMatchCard(f) : `<div class="card card-b"><div class="eyebrow">${TL.seasonOver(G) ? 'Season complete' : 'No fixtures scheduled'}</div><h2 style="margin-top:6px">${TL.seasonOver(G) ? 'All competitions are finished' : 'Nothing on the calendar yet'}</h2><p class="muted">${TL.seasonOver(G) ? 'Press Season review for the final tables, awards and your verdict.' : 'Press Continue to move time forward.'}</p></div>`}
        <section class="card" aria-label="Inbox">
          <div class="card-h"><h3>Inbox</h3><div class="row"><span class="muted" style="font-size:.82rem">${G.inbox.filter(x => !x.read).length} unread${(G.manager.saved || []).length ? ` · ${(G.manager.saved || []).length} saved` : ''}</span>${G.inbox.some(x => x.read) ? `<button class="btn sm ghost" data-act="mail-del-read">Delete read (${G.inbox.filter(x => x.read).length})</button>` : ''}</div></div>
          ${mails.map(x => `<div class="mail ${x.read ? 'read' : ''} ${ui.mailOpen === x.id ? 'sel' : ''}" data-act="mail" data-id="${x.id}" role="button" tabindex="0" aria-expanded="${ui.mailOpen === x.id}"><span class="dot"></span><span style="flex:1;min-width:0"><span class="who"><span>${esc(x.from)} ${x.important ? '<span class="imp">· Important</span>' : ''}</span><span>${TL.fmtDate(x.date)}</span></span><span class="subj">${esc(x.subject)}</span>${ui.mailOpen === x.id ? `<div class="mail-body" style="margin-top:10px">${esc(x.body)}</div>${mailActions(x)}<div class="row mail-tools"><button class="btn sm ghost" data-act="mail-save" data-id="${x.id}">Save to folder</button><button class="btn sm ghost" data-act="mail-del" data-id="${x.id}">Delete</button></div>` : ''}</span></div>`).join('') || '<div class="empty">No messages.</div>'}
          ${G.inbox.length > 8 ? `<div class="card-b" style="padding-top:10px;padding-bottom:12px"><button class="btn sm ghost" data-act="mail-all">${ui.mailAll ? 'Show fewer' : 'Show all ' + G.inbox.length}</button></div>` : ''}
        </section>
      </div>
      <div class="stack">${right}</div></div>`;
  }
  // What is happening today: training session, world fixtures, window countdown, scouting, treatment room
  function todayCard() {
    const c = me(), items = [];
    const sessName = k => k === 'match' ? 'Match day' : (TL.SESSIONS[k] || {}).name || k;
    if (c) {
      const today = TL.sessionFor(G, c, G.date), tom = TL.sessionFor(G, c, TL.addDays(G.date, 1));
      items.push(['Training today', `<b>${esc(sessName(today))}</b>`, 'training']);
      items.push(['Tomorrow', esc(sessName(tom)), 'training']);
      if (TL.youthPendingFor && TL.youthPendingFor(G, c.id).length) items.push(['U21 match today', '<b style="color:var(--accent-text)">Watch or skip</b>', 'academy']);
    }
    const fx = TL.fixturesOn(G, G.date);
    const comps = [...new Set(fx.map(f => G.comps[f.comp] ? G.comps[f.comp].name : ''))].filter(Boolean);
    items.push(['Matches today', fx.length ? `${fx.length} · ${esc(comps.slice(0, 2).join(', '))}${comps.length > 2 ? '…' : ''}` : 'None', 'competitions']);
    const w = TL.windowInfo(G);
    items.push(['Transfer window', w.open ? `<b style="color:var(--win)">Open</b> · ${TL.daysBetween(G.date, w.closes)} days left` : `Opens in ${TL.daysBetween(G.date, w.opens)} days`, 'transfers']);
    if (c) {
      if (G.scoutQueue.length) items.push(['Scouting', `${G.scoutQueue.length} report${G.scoutQueue.length > 1 ? 's' : ''} due`, 'transfers']);
      const inj = c.players.map(P).filter(p => p.injury > 0);
      items.push(['Treatment room', inj.length ? `${inj.length} injured${inj.some(p => !p.rehab) ? ' · choose rehab' : ''}` : 'Empty', 'squad']);
      const pr = c.projects || [];
      if (pr.length) items.push(['Projects', `${pr.length} under way`, 'club']);
      const tired = (c.lineup ? c.lineup.xi : []).map(P).filter(p => p && p.cond < 75).length;
      if (tired) items.push(['Fitness', `<span style="color:var(--warn)">${tired} starter${tired > 1 ? 's' : ''} below 75%</span>`, 'training']);
    }
    return `<section class="card today"><div class="card-h"><h3>Today</h3><span class="muted" style="font-size:.82rem">${TL.fmtDate(G.date, true)}</span></div>
      <div class="today-grid">${items.map(([k, v, tab]) => `<button class="today-item" data-act="tab" data-v="${me() || tab === 'competitions' || tab === 'transfers' ? tab : 'home'}"><span>${k}</span><span>${v}</span></button>`).join('')}</div></section>`;
  }
  const fanWord = v => v >= 80 ? 'ecstatic' : v >= 65 ? 'happy' : v >= 45 ? 'content' : v >= 25 ? 'restless' : 'angry';

  function mailActions(m) {
    const a = m.action; if (!a) return '';
    if (a.kind === 'player' && P(a.id)) return `<div class="row" style="margin-top:12px"><button class="btn sm" data-act="player" data-id="${a.id}">View ${esc(P(a.id).name)}</button></div>`;
    if (a.kind === 'offer') {
      const o = G.offers.find(x => x.id === a.id);
      if (!o || o.status !== 'open') return `<div class="muted" style="margin-top:10px;font-size:.85rem">This offer is ${o ? o.status : 'closed'}.</div>`;
      return `<div class="row" style="margin-top:12px"><button class="btn sm" data-act="offer-resp" data-id="${o.id}" data-how="reject">Reject</button><button class="btn sm" data-act="haggle-open" data-id="${o.id}">Negotiate</button><button class="btn sm primary" data-act="offer-resp" data-id="${o.id}" data-how="accept">Accept ${fm(o.fee)}</button></div>`;
    }
    if (a.kind === 'feederOffer') {
      const o = (G.feederOffers || []).find(x => x.id === a.id);
      if (!o || o.status !== 'open') return `<div class="muted" style="margin-top:10px;font-size:.85rem">This proposal is ${o ? o.status : 'closed'}.</div>`;
      return `<div class="row" style="margin-top:12px"><button class="btn sm" data-act="feeder-offer" data-id="${o.id}" data-how="reject">Turn down</button><button class="btn sm" data-act="feeder-offer" data-id="${o.id}" data-how="counter">Ask for more</button><button class="btn sm primary" data-act="feeder-offer" data-id="${o.id}" data-how="accept">Accept ${fm(o.fee)}/yr</button></div>`;
    }
    if (a.kind === 'u21match') {
      const g = (G.youthPending || []).find(x => x.key === a.key);
      return g ? `<div class="row" style="margin-top:12px"><button class="btn sm" data-act="u21-skip" data-key="${g.key}">Skip – send me the report</button><button class="btn sm primary" data-act="u21-watch" data-key="${g.key}">Watch the match</button></div>` : '<div class="muted" style="margin-top:10px;font-size:.85rem">This match has been played. The report is in your inbox.</div>';
    }
    if (a.kind === 'u21report') return `<div class="row" style="margin-top:12px"><button class="btn sm primary" data-act="u21-report" data-id="${a.id}">Open full report</button></div>`;
    if (a.kind === 'unveil') { const p = P(a.id); return p && TL.unveilEligible(G, p) ? `<div class="row" style="margin-top:12px"><button class="btn sm primary" data-act="unveil" data-id="${p.id}">Hold the unveiling</button></div>` : '<div class="muted" style="margin-top:10px;font-size:.85rem">The unveiling has taken place.</div>'; }
    if (a.kind === 'trials') return me() && me().trials ? `<div class="row" style="margin-top:12px"><button class="btn sm primary" data-act="tab" data-v="academy">See the trialists</button></div>` : '<div class="muted" style="margin-top:10px;font-size:.85rem">The trials have finished.</div>';
    if (a.kind === 'merch') { const p = P(a.id); return p && me() && p.clubId === me().id ? `<div class="row" style="margin-top:12px"><button class="btn sm primary" data-act="merch-open" data-id="${p.id}">${TL.merchFor(G, p.id) ? 'View the range' : 'Plan merchandise'}</button></div>` : ''; }
    if (a.kind === 'players') return `<div class="row" style="margin-top:12px;gap:8px">${a.ids.map(P).filter(Boolean).map(p => `<button class="btn sm" data-act="player" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>`;
    if (a.kind === 'injury') {
      const p = P(a.id);
      if (!p || p.injury <= 0) return '<div class="muted" style="margin-top:10px;font-size:.85rem">He has recovered.</div>';
      return rehabPicker(p);
    }
    if (a.kind === 'job') {
      const v = G.vacancies.find(x => x.id === a.vid);
      if (!v) return '<div class="muted" style="margin-top:10px;font-size:.85rem">This job has been filled.</div>';
      return `<div class="row" style="margin-top:12px"><button class="btn sm primary" data-act="take-job" data-id="${v.id}">Accept the job</button></div>`;
    }
    return '';
  }

  function rehabPicker(p) {
    const c = me(); if (!c || p.clubId !== c.id) return '';
    const cur = p.rehab || 'standard';
    return `<div class="rehab">${TL.rehabOptions(G, p).map(k => { const r = TL.REHAB[k], cost = TL.rehabCost(G, c, k); return `<button class="rehab-opt ${cur === k ? 'on' : ''} ${k === 'rush' ? 'risky' : ''}" data-act="rehab" data-id="${p.id}" data-v="${k}"><b>${esc(r.name)}${cost ? ` · ${fm(cost)}` : ''}</b><small>${esc(r.desc)}</small></button>`; }).join('')}</div>`;
  }
  function transfersCard() {
    const c = me(), f = c.finance, bill = TL.wageBill(G, c);
    return `<section class="card card-b"><div class="row between"><h3>Club business</h3><button class="btn sm ghost" data-act="tab" data-v="transfers">Transfers</button></div>
      <div style="margin:10px 0 12px">${windowPill()}</div>
      <dl class="kv"><dt>Transfer budget</dt><dd>${fm(f.transferBudget)}</dd><dt>Wage bill</dt><dd style="color:${bill > f.wageBudget ? 'var(--loss)' : 'inherit'}">${wageTxt(bill)} of ${wageTxt(f.wageBudget)}</dd><dt>Bank balance</dt><dd style="color:${f.balance < 0 ? 'var(--loss)' : 'inherit'}">${fm(f.balance)}</dd></dl></section>`;
  }

  const teamSub = (f, id) => {
    const t = T(id);
    if (t.isNation) return `World rank ${TL.ranking(G).findIndex(x => x.id === id) + 1}`;
    const comp = G.comps[f.comp];
    if (comp && comp.type === 'league') { const r = TL.table(G, f.comp).find(x => x.id === id); return r && r.p ? `${TL.ordinal(r.pos)} · ${r.pts} pts` : 'Pre-season'; }
    return TL.leagueDef(G, t.leagueId) ? TL.leagueDef(G, t.leagueId).name : '';
  };
  const teamForm = (f, id) => { const comp = G.comps[f.comp]; if (comp && comp.type === 'league') { const r = TL.table(G, f.comp).find(x => x.id === id); return r ? r.form : []; } return []; };
  // HOME / AWAY marker; your own team is highlighted
  const venueTag = (f, id) => { const m = G.manager, mine = id === m.clubId || id === m.nationId; return `<span class="venue-tag ${mine ? 'mine' : ''}">${f.neutral ? 'Neutral' : id === f.home ? 'Home' : 'Away'}${mine ? ' · You' : ''}</span>`; };
  function nextMatchCard(f) {
    const H = T(f.home), A = T(f.away), m = G.manager;
    const mine = [m.clubId, m.nationId].find(id => id === f.home || id === f.away);
    const opp = f.home === mine ? A : H;
    const isToday = f.date === G.date;
    return `<section class="card fixture-hero"><span class="stripe" style="background:${T(mine).c1}"></span>
      <div class="card-h"><div><div class="eyebrow">${isToday ? 'Matchday · today' : 'Next match'}</div></div><span class="muted" style="font-size:.82rem">${esc(TL.compName(G, f))}</span></div>
      <div class="fx-teams">
        <div class="fx-team">${crest(H, 64)}<b>${esc(H.name)}</b>${venueTag(f, H.id)}<small>${esc(teamSub(f, H.id))}</small>${formPills(teamForm(f, H.id))}</div>
        <div class="fx-mid"><div class="vs">VS</div><div class="when">${TL.fmtDate(f.date, true)}<br>${f.neutral ? esc(f.venue || 'Neutral venue') : esc(H.stadium)}</div>${f.leg === 2 && f.aggHome != null ? `<div class="when">First leg ${f.aggAway}–${f.aggHome}</div>` : ''}</div>
        <div class="fx-team">${crest(A, 64)}<b>${esc(A.name)}</b>${venueTag(f, A.id)}<small>${esc(teamSub(f, A.id))}</small>${formPills(teamForm(f, A.id))}</div>
      </div>
      <div class="fx-foot"><span class="muted" style="font-size:.85rem">${isToday ? `Your line-up is set in a ${T(mine).tactics.formation}.` : `${TL.daysBetween(G.date, f.date)} days to go`}</span>
        <div class="row">${opp.isNation ? `<button class="btn sm" data-act="nation-modal" data-id="${opp.id}">Scout ${esc(opp.name)}</button>` : `<button class="btn sm" data-act="club-modal" data-id="${opp.id}">Scout ${esc(opp.name)}</button>`}${isToday ? `<button class="btn sm primary" data-act="continue">Go to match</button>` : ''}</div></div>
    </section>`;
  }
  function lastResultCard(f, teamId) {
    const r = TL.userResult(G, f, teamId);
    const H = T(f.home), A = T(f.away);
    const col = r.res === 'W' ? 'var(--win)' : r.res === 'L' ? 'var(--loss)' : 'var(--muted)';
    return `<section class="card card-b"><div class="row between"><h3>Last result · ${esc(T(teamId).name)}</h3><b style="color:${col}">${{ W: 'Win', D: 'Draw', L: 'Defeat' }[r.res]}</b></div>
      <div class="muted" style="font-size:.78rem;margin-top:4px">${esc(TL.compName(G, f))}</div>
      <div class="row between" style="margin-top:10px"><span class="row" style="gap:8px">${crest(H, 24)}<b>${esc(H.name)}</b></span><b class="display" style="font-size:1.5rem">${f.hg}–${f.ag}</b><span class="row" style="gap:8px"><b>${esc(A.name)}</b>${crest(A, 24)}</span></div>
      ${f.pens ? `<div class="muted" style="font-size:.82rem;margin-top:6px">Penalties ${f.pens.home}–${f.pens.away}</div>` : f.et ? '<div class="muted" style="font-size:.82rem;margin-top:6px">After extra time</div>' : ''}
      ${f.motm && P(f.motm) ? `<div class="muted" style="font-size:.82rem;margin-top:8px">Player of the match: ${esc(P(f.motm).name)}</div>` : ''}</section>`;
  }

  /* =========================================================
     SQUAD & PLAYER
     ========================================================= */
  const SORTS = {
    pos: p => TL.POSITIONS.indexOf(p.pos) * 1000 - p.ovr, name: p => surname(p.name), age: p => p.age, nat: p => p.nat, ovr: p => -p.ovr, cond: p => -p.cond,
    morale: p => -p.morale, form: p => -formAvg(p), apps: p => -p.stats.apps, goals: p => -p.stats.goals, assists: p => -p.stats.assists, avg: p => -avgR(p), value: p => -p.value,
    wage: p => -(p.contract ? p.contract.wage : 0), contract: p => p.contract ? p.contract.end : 0
  };
  function viewSquad() {
    const c = me(); if (!c) return needClub();
    let list = c.players.map(P);
    if (ui.squadFilter !== 'ALL') list = list.filter(p => TL.POS_GROUP[p.pos] === ui.squadFilter);
    const fn = SORTS[ui.sort.k];
    list.sort((a, b) => { const x = fn(a), y = fn(b); return (x < y ? -1 : x > y ? 1 : 0) * ui.sort.d; });
    const th = (k, l, cls) => `<th class="sortable ${cls || ''} ${ui.sort.k === k ? 'sorted' : ''}" data-act="sort" data-k="${k}">${l}${ui.sort.k === k ? (ui.sort.d > 0 ? ' ▾' : ' ▴') : ''}</th>`;
    const total = c.players.reduce((s, id) => s + P(id).value, 0);
    const seniors = c.players.filter(id => P(id).age > 21).length, home = c.players.filter(id => P(id).homegrown === c.id || P(id).nat === c.country).length;
    return `<div class="page-h"><div><div class="eyebrow">${c.players.length} players · ${seniors} over 21 · ${home} home-grown/local · value ${fm(total)} · wages ${wageTxt(TL.wageBill(G, c))}</div><h1>Squad</h1></div>
      <div class="filters">${['ALL', 'GK', 'DEF', 'MID', 'ATT'].map(f => `<button class="chip ${ui.squadFilter === f ? 'on' : ''}" data-act="sq-filter" data-v="${f}">${f === 'ALL' ? 'All' : f === 'GK' ? 'Goalkeepers' : f === 'DEF' ? 'Defenders' : f === 'MID' ? 'Midfielders' : 'Attackers'}</button>`).join('')}<button class="chip" data-act="tab" data-v="academy">Academy (${(c.academy || []).length})</button></div></div>
      ${seniors > 25 ? `<div class="card card-b" style="border-color:var(--warn)"><b style="color:var(--warn)">Registration:</b> ${seniors} senior players. League rules allow 25 over-21s plus any number of under-21s; sell, loan or release ${seniors - 25}.</div>` : ''}
      <section class="card"><div class="tbl-wrap"><table class="tbl">
        <thead><tr>${th('pos', 'Pos')}${th('name', 'Name')}${th('age', 'Age', 'r')}${th('nat', 'Nat')}${th('ovr', 'Abl', 'c')}${th('cond', 'Condition')}${th('morale', 'Morale')}${th('form', 'Form', 'r')}${th('apps', 'Apps', 'r')}${th('goals', 'Gls', 'r')}${th('assists', 'Ast', 'r')}${th('avg', 'Avg', 'r')}${th('value', 'Value', 'r')}${th('wage', 'Wage', 'r')}${th('contract', 'Contract', 'r')}</tr></thead>
        <tbody>${list.map(p => { const mw = moraleWord(p.morale); const role = c.lineup && c.lineup.xi.includes(p.id) ? '<span class="tag" style="background:var(--accent-soft);color:var(--accent-text)">XI</span>' : ''; const cap = c.captain === p.id ? ' <span class="tag cap">C</span>' : c.vice === p.id ? ' <span class="tag cap">VC</span>' : ''; return `<tr class="click" data-act="player" data-id="${p.id}">
          <td>${posTag(p.pos)}</td><td><b>${esc(p.name)}</b>${cap} ${role} ${statusTags(p)}</td><td class="r">${p.age}</td><td class="muted" title="${esc(TL.NAT_NAMES[p.nat] || p.nat)}">${p.nat}</td><td class="c">${ovrTag(p.ovr)}</td>
          <td>${condBar(p.cond)}</td><td style="color:${mw[1]};font-weight:600">${mw[0]}</td><td class="r">${p.form.length ? ratingTag(formAvg(p)) : '<span class="faint">–</span>'}</td>
          <td class="r">${p.stats.apps}</td><td class="r">${p.stats.goals}</td><td class="r">${p.stats.assists}</td><td class="r">${ratingTag(avgR(p))}</td><td class="r">${fm(p.value)}</td><td class="r muted">${p.contract ? wageTxt(p.contract.wage) : '–'}</td><td class="r" style="color:${p.contract && p.contract.end <= G.season ? 'var(--warn)' : 'var(--muted)'}">${contractTxt(p)}</td></tr>`; }).join('')}</tbody>
      </table></div></section>`;
  }

  function viewPlayerModal(id) {
    const p = P(id);
    if (!p) return '<div class="modal-b">Player not found.</div>';
    const club = p.clubId && G.clubs[p.clubId];
    const isGK = p.pos === 'GK';
    const groups = isGK ? ['Goalkeeping', 'Mental', 'Physical'] : ['Technical', 'Mental', 'Physical'];
    const mine = !!(me() && p.clubId === me().id);
    const view = TL.abilityView(G, p);
    const aw = view.known ? 0 : Math.max(1, Math.round((7 - (me() ? TL.staffRating(G, me().id, 'scout') : 8) / 3) / 2));
    const attrTxt = k => { const v = p.attrs[k]; if (!aw) return `<b class="${aCls(v)}">${v}</b>`; const o = (v + k.length) % 2; return `<b class="faint">${Math.max(1, v - aw + o)}–${Math.min(20, v + aw - (1 - o))}</b>`; };
    const mw = moraleWord(p.morale);
    const win = TL.windowInfo(G);
    const scouting = G.scoutQueue.find(q => q.id === p.id);
    let actions = '';
    const loanBtns = p.age <= 23 && !p.onLoan && !p.loan ? `<button class="btn sm" data-act="loan-pick" data-id="${p.id}">Loan out</button>` : p.onLoan && p.onLoan.feeder ? `<button class="btn sm" data-act="recall" data-id="${p.id}">Recall from ${esc(p.onLoan.to)}</button>` : '';
    const unveilBtn = mine && TL.unveilEligible && TL.unveilEligible(G, p) ? `<button class="btn sm primary" data-act="unveil" data-id="${p.id}">Unveil</button>` : '';
    const merchBtn = unveilBtn + (mine && TL.merchEligible(G, p) ? `<button class="btn sm" data-act="merch-open" data-id="${p.id}">${TL.merchFor(G, p.id) ? 'Merchandise (on sale)' : 'Merchandise'}</button>` : '');
    if (mine && p.academy) {
      const seniors = me().players.map(P).filter(x => x.age >= 27 && x.attrs.leadership >= 12).sort((a, b) => b.attrs.leadership - a.attrs.leadership);
      actions = `<button class="btn sm primary" data-act="promote" data-id="${p.id}">Promote to first team</button>${loanBtns}<button class="btn sm danger" data-act="release-youth" data-id="${p.id}">Release</button>${merchBtn}
        <label class="muted" for="mentor" style="font-size:.85rem">Mentor</label><select id="mentor" class="input sm-input" data-change="mentor" data-id="${p.id}"><option value="">None</option>${seniors.map(s => `<option value="${s.id}" ${p.mentor === s.id ? 'selected' : ''}>${esc(s.name)} (leadership ${s.attrs.leadership})</option>`).join('')}</select>`;
    } else if (mine) {
      actions = `<button class="btn sm" data-act="deal-open" data-mode="renew" data-id="${p.id}" ${p.loan || p.onLoan ? 'disabled' : ''}>Offer new contract</button>
        <button class="btn sm" data-act="list-toggle" data-id="${p.id}" ${p.loan ? 'disabled' : ''}>${p.listed ? 'Remove from transfer list' : 'Transfer list'}</button>
        ${loanBtns}
        <button class="btn sm" data-act="captain" data-id="${p.id}">${me().captain === p.id ? 'Captain' : 'Make captain'}</button>
        ${merchBtn}
        ${p.requested ? `<button class="btn sm" data-act="promise" data-id="${p.id}">Promise more football</button>` : ''}
        ${!p.loan ? `<button class="btn sm danger" data-act="release" data-id="${p.id}">Release</button>` : ''}`;
    } else if (me() && p.loan && p.loan.parent === me().id) {
      actions = `<span class="muted" style="font-size:.85rem">Our player, on loan at ${esc(clubName(p.clubId))} until the summer: ${p.stats.apps} apps, ${p.stats.goals} goals.</span><button class="btn sm" data-act="recall-club" data-id="${p.id}" ${win.open ? '' : 'disabled title="Only while a transfer window is open"'}>Recall</button>`;
    } else if (p.trialist) {
      actions = `<span class="muted" style="font-size:.85rem">On trial at our academy.</span>`;
    } else if (p.abroad) {
      actions = `<span class="muted" style="font-size:.85rem">Plays for ${esc(p.abroad)}, outside the leagues you can trade with.</span>`;
    } else if (me()) {
      actions = `<button class="btn sm" data-act="shortlist" data-id="${p.id}">${isShort(p.id) ? '★ Shortlisted' : '☆ Shortlist'}</button>
        ${!view.known ? `<button class="btn sm" data-act="scout" data-id="${p.id}" ${scouting ? 'disabled' : ''}>${scouting ? 'Report due ' + TL.fmtDate(scouting.due) : 'Scout player'}</button>` : ''}
        ${p.clubId ? `<button class="btn sm primary" data-act="deal-open" data-mode="buy" data-id="${p.id}" ${win.open && !p.loan && !p.academy ? '' : 'disabled'}>Make offer</button><button class="btn sm" data-act="deal-open" data-mode="loan" data-id="${p.id}" ${win.open && !p.loan && !p.academy ? '' : 'disabled'}>Ask to loan</button>` : `<button class="btn sm primary" data-act="deal-open" data-mode="free" data-id="${p.id}">Offer contract</button>`}`;
    }
    const histChart = (() => {
      const h = (p.hist || []).filter(x => x && x[1] != null);
      if (!mine || h.length < 2) return '';
      const w = 300, hh = 70, lo = Math.min(...h.map(x => x[1])) - 1, hi = Math.max(...h.map(x => x[1]), p.pot) + 1;
      const pts = h.map((x, i) => [i * (w / (h.length - 1)), hh - (x[1] - lo) / (hi - lo) * hh]);
      const potY = hh - (p.pot - lo) / (hi - lo) * hh;
      return `<div><h4 class="eyebrow" style="margin:0 0 8px">Development</h4><svg width="100%" viewBox="-4 -6 ${w + 40} ${hh + 24}" style="max-width:420px"><line x1="0" x2="${w}" y1="${potY}" y2="${potY}" stroke="var(--faint)" stroke-dasharray="4 4"/><text x="${w + 4}" y="${potY + 4}" font-size="11" fill="var(--faint)">Pot</text><polyline fill="none" stroke="var(--accent)" stroke-width="2.5" points="${pts.map(q => q.map(v => v.toFixed(1)).join(',')).join(' ')}"/><circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="4" fill="var(--accent)"/><text x="${w + 4}" y="${pts[pts.length - 1][1] + 4}" font-size="12" font-weight="700" fill="var(--text)">${p.ovr}</text><text x="0" y="${hh + 16}" font-size="11" fill="var(--muted)">${TL.fmtDate(h[0][0])}</text><text x="${w}" y="${hh + 16}" font-size="11" fill="var(--muted)" text-anchor="end">${TL.fmtDate(h[h.length - 1][0])}</text></svg></div>`;
    })();
    const moves = (p.transfers || []).slice().reverse();
    const spark = (() => {
      if (p.form.length < 2) return '<span class="faint">Not enough matches yet</span>';
      const w = 160, h = 40, pts = p.form.map((r, i) => [i * (w / (p.form.length - 1)), h - ((r - 5) / 4.5) * h]);
      return `<svg class="spark" width="${w}" height="${h + 6}" viewBox="0 -3 ${w} ${h + 6}"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts.map(q => q.map(v => v.toFixed(1)).join(',')).join(' ')}"/>${pts.map(q => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3" fill="var(--accent)"/>`).join('')}</svg>`;
    })();
    return `<div class="modal-h">${club ? crest(club, 44) : '<span class="ovr t4">' + (p.abroad ? 'INT' : 'FA') + '</span>'}<div style="min-width:0"><div class="eyebrow">${esc(p.abroad || clubName(p.clubId))} · ${esc(TL.NAT_NAMES[p.nat] || p.nat)}</div><h2 style="font-size:1.55rem;margin-top:3px">${esc(p.name)}</h2><div class="row" style="gap:8px;margin-top:6px">${posTag(p.pos)} ${statusTags(p)}${p.style ? `<span class="tag" style="background:var(--surface-3)">${esc(p.style)}</span>` : ''}${p.listed ? '<span class="tag sus">Transfer listed</span>' : ''}${p.onLoan ? `<span class="tag yth">At ${esc(p.onLoan.to)}</span>` : ''}${p.loan ? `<span class="tag yth">On loan from ${esc(clubName(p.loan.parent))}</span>` : ''}${mine && p.role != null ? `<span class="tag" style="background:var(--surface-3)">${TL.CONTRACT_ROLES[p.role]}</span>` : ''}</div></div><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div>
      <div class="modal-b stack">
        <div class="facts">
          <div class="fact"><span>Ability</span><b>${view.known ? p.ovr : view.lo + '–' + view.hi}</b></div>
          <div class="fact"><span>Potential</span><b>${view.plo >= view.phi ? view.phi : view.plo + '–' + view.phi}</b></div>
          <div class="fact"><span>Age</span><b>${p.age}</b></div>
          <div class="fact"><span>Value</span><b>${fm(p.value * TL.econOf(club).value)}</b></div>
          <div class="fact"><span>Wage</span><b>${p.contract ? wageTxt(p.contract.wage) : '–'}</b></div>
          <div class="fact"><span>Contract</span><b>${p.contract ? contractTxt(p) : p.abroad ? '–' : 'Free agent'}</b></div>
          ${p.clubId && !mine && !p.academy ? `<div class="fact"><span>Asking price</span><b>${fm(TL.askingPrice(G, p))}</b></div>` : ''}
          ${p.contract && p.contract.clause ? `<div class="fact"><span>Release clause</span><b>${fm(p.contract.clause)}</b></div>` : ''}
          <div class="fact"><span>Caps · goals</span><b>${p.intl ? p.intl.caps + ' · ' + p.intl.goals : '0 · 0'}</b></div>
          <div class="fact"><span>Foot · height</span><b>${p.foot} · ${p.height}cm</b></div>
        </div>
        <div class="row" style="gap:8px">${actions}</div>
        ${mine && p.injury > 0 ? `<div class="card card-b" style="background:var(--surface-2)"><h4 class="eyebrow" style="margin:0 0 10px">Treatment · ${esc(p.injuryName)} · about ${p.injury} days${p.rehab ? ' · ' + esc(TL.REHAB[p.rehab].name) : ''}</h4>${rehabPicker(p)}</div>` : ''}
        ${mine && p.rushed ? `<div class="card card-b" style="border-color:var(--warn)"><b style="color:var(--warn)">Playing through pain</b> <span class="muted">until ${TL.fmtDate(p.rushed)}: high risk of another injury.</span></div>` : ''}
        ${mine && !p.onLoan ? `<div class="row" style="gap:10px"><label class="muted" for="pfocus" style="font-size:.85rem">Individual training focus</label><select id="pfocus" class="input sm-input" data-change="tfocus" data-id="${p.id}"><option value="">None</option>${(isGK ? TL.ATTRS.Goalkeeping : TL.ATTRS.Technical.concat(TL.ATTRS.Mental, TL.ATTRS.Physical)).map(k => `<option value="${k}" ${p.trainFocus === k ? 'selected' : ''}>${TL.ATTR_LABEL[k]}</option>`).join('')}</select>
          <label class="muted" for="pwl" style="font-size:.85rem">Workload</label><select id="pwl" class="input sm-input" data-change="workload" data-id="${p.id}">${Object.entries(TL.WORKLOADS).map(([k, l]) => `<option value="${k}" ${(p.workload || 'normal') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}
        ${!mine && G.scouted[p.id] && me() ? scoutReportHTML(p) : ''}
        ${!view.known ? `<div class="muted" style="font-size:.84rem">Attributes are estimates until your chief scout files a report.</div>` : ''}
        <div class="attrs">${groups.map(g => `<div><h4>${g}</h4>${TL.ATTRS[g].map(k => `<div class="attr"><span>${TL.ATTR_LABEL[k]}</span>${attrTxt(k)}</div>`).join('')}</div>`).join('')}</div>
        ${histChart}
        <div class="grid g-2">
          <div class="card card-b" style="background:var(--surface-2)"><h4 class="eyebrow" style="margin:0 0 10px">Status</h4>
            <dl class="kv"><dt>Condition</dt><dd>${Math.round(p.cond)}%</dd><dt>Morale</dt><dd style="color:${mw[1]}">${mw[0]}</dd><dt>Injury</dt><dd>${p.injury > 0 ? esc(p.injuryName) + ' · ' + p.injury + ' days' : 'None'}</dd><dt>Yellow cards</dt><dd>${p.yellowAcc} (ban at ${TL.TUNING.yellowBanThreshold})</dd>${p.youthStats ? `<dt>Youth team</dt><dd>${p.youthStats.apps} apps · ${p.youthStats.goals} goals</dd>` : ''}${p.mentor && P(p.mentor) ? `<dt>Mentor</dt><dd>${esc(P(p.mentor).name)}</dd>` : ''}</dl>
            <div style="margin-top:12px"><div class="muted" style="font-size:.78rem;margin-bottom:4px">${p.form.length ? `Last ${p.form.length} match ratings` : 'Match ratings'}</div>${spark}</div></div>
          <div class="card card-b" style="background:var(--surface-2)"><h4 class="eyebrow" style="margin:0 0 10px">${seasonLabel(G.season)} season</h4>
            <dl class="kv"><dt>Appearances</dt><dd>${p.stats.apps} (${p.stats.starts} starts)</dd><dt>Goals</dt><dd>${p.stats.goals}</dd><dt>Assists</dt><dd>${p.stats.assists}</dd>${isGK ? `<dt>Clean sheets</dt><dd>${p.stats.cleanSheets}</dd>` : ''}<dt>Average rating</dt><dd>${avgR(p) ? avgR(p).toFixed(2) : '–'}</dd><dt>Player of the match</dt><dd>${p.stats.motm}</dd><dt>Cards</dt><dd>${p.stats.yellows} yellow · ${p.stats.reds} red</dd></dl></div>
        </div>
        ${p.career.length ? `<div><h4 class="eyebrow" style="margin:0 0 8px">Career</h4><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Season</th><th>Club</th><th class="r">Apps</th><th class="r">Gls</th><th class="r">Ast</th><th class="r">Avg</th></tr></thead><tbody>${p.career.map(c => `<tr><td>${seasonLabel(c.season)}</td><td>${esc(G.clubs[c.club] ? G.clubs[c.club].name : c.club || '—')}</td><td class="r">${c.apps}</td><td class="r">${c.goals}</td><td class="r">${c.assists}</td><td class="r">${c.avg.toFixed(2)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
        ${moves.length ? `<div><h4 class="eyebrow" style="margin:0 0 8px">Transfer history</h4><div class="tbl-wrap"><table class="tbl compact"><tbody>${moves.map(t => `<tr><td>${TL.fmtDate(t.date, true)}</td><td>${esc(clubName(t.from))} → ${esc(clubName(t.to))}</td><td class="r">${t.loan ? 'Loan' : t.fee ? fm(t.fee) : 'Free'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      </div>`;
  }

  function scoutReportHTML(p) {
    const r = TL.scoutReportData(G, p);
    const gcol = { A: 'var(--win)', B: 'var(--win)', C: 'var(--accent-text)', D: 'var(--warn)', E: 'var(--loss)' }[r.grade];
    const lbl = k => TL.ATTR_LABEL[k];
    return `<section class="card scout-report"><div class="card-h"><h3>Scout report</h3><span class="muted" style="font-size:.8rem">Filed ${TL.fmtDate(G.scouted[p.id])} · chief scout ${r.scoutRating}/20</span></div>
      <div class="card-b stack" style="gap:14px">
        <div class="row" style="gap:16px;align-items:flex-start"><div class="grade" style="color:${gcol};border-color:${gcol}">${r.grade}</div><div style="flex:1;min-width:200px"><b>${esc(r.verdict)}</b><div class="muted" style="margin-top:4px">${esc(r.style)}</div>${!r.interest.ok ? `<div style="color:var(--warn);margin-top:6px;font-size:.88rem">${esc(r.interest.msg)}</div>` : ''}</div></div>
        <div class="grid g-3" style="gap:12px">
          <div><div class="eyebrow">Strengths</div>${r.strengths.map(k => `<div class="row between"><span>${lbl(k)}</span><b class="${aCls(p.attrs[k])}">${p.attrs[k]}</b></div>`).join('')}</div>
          <div><div class="eyebrow">Weaknesses</div>${r.weaknesses.map(k => `<div class="row between"><span>${lbl(k)}</span><b class="${aCls(p.attrs[k])}">${p.attrs[k]}</b></div>`).join('')}</div>
          <div><div class="eyebrow">Can play</div><div class="row" style="gap:4px;flex-wrap:wrap">${r.positions.map(posTag).join('')}</div>${r.compare ? `<div class="muted" style="font-size:.84rem;margin-top:8px">Our best there: <b style="color:var(--text)">${esc(r.compare.name)}</b> (${r.compare.ovr})</div>` : '<div class="muted" style="font-size:.84rem;margin-top:8px">We have nobody in this position.</div>'}</div>
        </div>
        <dl class="kv">${r.personality.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        <dl class="kv"><dt>This season</dt><dd>${r.season.apps} apps · ${r.season.goals} goals · ${r.season.assists} assists${r.season.avg ? ' · avg ' + r.season.avg.toFixed(2) : ''}</dd>
          <dt>Estimated fee</dt><dd>${p.clubId ? fm(r.price) : 'Free transfer'}${r.clause ? ` (release clause ${fm(r.clause)})` : ''}</dd>
          <dt>Likely wage demand</dt><dd>${r.wage != null ? wageTxt(r.wage) : '–'}</dd><dt>Contract</dt><dd>${r.contract ? 'Until Jun ' + (r.contract + 1) : 'None'}</dd></dl>
      </div></section>`;
  }
  function viewClubModal(id) {
    const c = G.clubs[id];
    const tbl = G.comps[c.leagueId] ? TL.table(G, c.leagueId) : []; const row = tbl.find(r => r.id === id) || { pos: '–', pts: 0, form: [], gf: 0, ga: 0 };
    const list = c.players.map(P).sort((a, b) => TL.POSITIONS.indexOf(a.pos) - TL.POSITIONS.indexOf(b.pos) || b.ovr - a.ovr);
    const top = list.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    return `<div class="modal-h">${crest(c, 50)}<div><div class="eyebrow">${esc(c.city)} · Founded ${c.founded} · ${esc((TL.leagueDef(G, c.leagueId) || {}).name || '')}</div><h2 style="font-size:1.6rem;margin-top:3px">${esc(c.name)}</h2><div class="muted" style="font-size:.85rem;margin-top:4px">${esc(c.stadium)} · ${c.cap.toLocaleString('en-GB')} · ${typeof row.pos === 'number' ? TL.ordinal(row.pos) : row.pos} with ${row.pts} pts</div></div><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div>
      <div class="modal-b stack">
        <div class="facts"><div class="fact"><span>Formation</span><b>${c.tactics.formation}</b></div><div class="fact"><span>Form</span><b>${formPills(row.form)}</b></div><div class="fact"><span>Goals for</span><b>${row.gf}</b></div><div class="fact"><span>Goals against</span><b>${row.ga}</b></div></div>
        ${(() => { const fs = TL.feedersOf(G, id), par = TL.parentOf(G, id); const bits = []; if (fs.length) bits.push('Feeder clubs: ' + fs.map(f => `<b style="color:var(--text)">${esc(TL.feederName(G, f))}</b> (${esc(TL.NAT_NAMES[TL.feederCountry(G, f)] || TL.feederCountry(G, f))})`).join(', ')); if (par) bits.push(`Feeder club of <b style="color:var(--text)">${esc(G.clubs[par.parent].name)}</b>`); return bits.length ? `<div class="muted" style="font-size:.88rem">${bits.join(' · ')}</div>` : ''; })()}
        ${!me() || id !== me().id ? `<div class="muted" style="font-size:.88rem">Key players: ${top.map(p => `<b style="color:var(--text)">${esc(p.name)}</b> (${p.pos})`).join(', ')}.</div>` : ''}
        <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Pos</th><th>Name</th><th class="r">Age</th><th class="c">Abl</th><th class="r">Apps</th><th class="r">Gls</th><th class="r">Avg</th></tr></thead><tbody>
        ${list.map(p => `<tr class="click" data-act="player" data-id="${p.id}"><td>${posTag(p.pos)}</td><td><b>${esc(p.name)}</b> ${statusTags(p)}</td><td class="r">${p.age}</td><td class="c">${ablTxt(p)}</td><td class="r">${p.stats.apps}</td><td class="r">${p.stats.goals}</td><td class="r">${ratingTag(avgR(p))}</td></tr>`).join('')}
        </tbody></table></div></div>`;
  }

  /* =========================================================
     TACTICS (club or national team)
     ========================================================= */
  const tacticsTeam = () => { const c = me(), n = myNation(); if (c && n) return ui.tteam === 'nation' ? n : c; return c || n; };
  function viewTactics() {
    const c = tacticsTeam(); if (!c) return needClub();
    if (c.isNation && c.players.length < 11) { TL.ensureSquad(G, c); }
    if (!c.lineup) TL.autoLineup(G, c);
    TL.validateLineup(G, c);
    const slots = TL.FORMATIONS[c.tactics.formation];
    const t = c.tactics;
    const s = TL.lineupStrength(G, c);
    const ink = inkOn(c.c1, c.c2);
    const sel = ui.tactSel;
    const pitch = slots.map((sl, i) => {
      const id = c.lineup.xi[i], p = id && P(id);
      const fam = p ? TL.familiarity(p.pos, sl[0]) : 0;
      const isSel = sel && sel.kind === 'slot' && sel.i === i;
      const ring = p ? (p.cond >= 85 ? 'var(--win)' : p.cond >= 70 ? 'var(--warn)' : 'var(--loss)') : 'rgba(255,255,255,.6)';
      return `<button class="slot ${isSel ? 'sel' : ''} ${p ? '' : 'empty'}" style="left:${sl[1]}%;top:${100 - sl[2]}%" data-act="slot" data-i="${i}" aria-label="${sl[0]}: ${p ? esc(p.name) : 'empty'}">
        <span class="shirt" style="background:${c.c1};color:${ink};border-color:${ring};border-width:3px">${p ? p.ovr : '+'}</span>
        <span class="nm">${p ? esc(surname(p.name)) + (c.captain === id ? ' (C)' : '') : 'Empty'}</span><span class="ps">${sl[0]}${p && fam < 0.9 ? ' <span class="warn">⚠</span>' : ''}</span></button>`;
    }).join('');
    const role = id => { const i = c.lineup.xi.indexOf(id); if (i >= 0) return slots[i][0]; const b = c.lineup.bench.indexOf(id); return b >= 0 ? 'SUB' : ''; };
    const players = c.players.map(P).filter(p => p && !p.onLoan).sort((a, b) => { const ra = role(a.id), rb = role(b.id); const w = r => r && r !== 'SUB' ? 0 : r === 'SUB' ? 1 : 2; return w(ra) - w(rb) || TL.POSITIONS.indexOf(a.pos) - TL.POSITIONS.indexOf(b.pos) || b.ovr - a.ovr; });
    const bar = (k, v) => `<div class="strength"><b>${k}</b><div class="meter"><i style="width:${TL.clamp((v - 50) / 42 * 100, 4, 100)}%"></i></div><span class="num" style="text-align:right;font-weight:700">${Math.round(v)}</span></div>`;
    const segs = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${t[key] === v ? 'on' : ''}" data-act="tact" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const matchToday = TL.humanFixturesToday(G).length > 0;
    const both = me() && myNation();
    return `<div class="page-h"><div><div class="eyebrow">${esc(c.name)} · tap a player, then another player or position to swap</div><h1>Tactics</h1></div>
      <div class="row">${both ? `<div class="seg">${[['club', me().name], ['nation', myNation().name]].map(([k, l]) => `<button class="${(ui.tteam || 'club') === k ? 'on' : ''}" data-act="tteam" data-v="${k}">${esc(l)}</button>`).join('')}</div>` : ''}<button class="btn" data-act="auto-pick">Pick best XI</button>${matchToday ? '<button class="btn primary" data-act="continue">Go to match</button>' : ''}</div></div>
      <div class="tact-grid">
        <section class="card card-b"><div class="pitch">
          <span class="ln edge"></span><span class="ln half"></span><span class="ln circle"></span><span class="ln box-t"></span><span class="ln box-b"></span><span class="ln six-t"></span><span class="ln six-b"></span>
          ${pitch}</div>
          <div class="muted" style="font-size:.78rem;margin-top:10px">Shirt outline shows condition: green fresh, amber tired, red exhausted. ⚠ = playing out of position.</div></section>
        <div class="stack">
          <section class="card card-b stack" style="gap:16px">
            <div class="grid g-2" style="gap:16px">
              <div class="ctl"><label for="formation">Formation</label><select id="formation" class="input" data-change="formation">${TL.formationOptions(t.formation)}</select>${c.fam ? `<div class="muted" style="font-size:.78rem">Familiarity ${Math.round(c.fam[t.formation] || 0)}%</div>` : ''}</div>
              <div class="ctl"><label>Team strength</label>${bar('ATT', s.att)}${bar('MID', s.mid)}${bar('DEF', s.def)}</div>
            </div>
            <div class="ctl"><label>Mentality</label>${segs('mentality', [[-2, 'Very defensive'], [-1, 'Defensive'], [0, 'Balanced'], [1, 'Attacking'], [2, 'Very attacking']])}</div>
            <div class="grid g-2" style="gap:16px">
              <div class="ctl"><label>Pressing</label>${segs('press', [[0, 'Low block'], [1, 'Mid'], [2, 'High press']])}</div>
              <div class="ctl"><label>Tempo</label>${segs('tempo', [[0, 'Patient'], [1, 'Normal'], [2, 'Direct']])}</div>
            </div>
            ${!c.isNation ? `<div class="grid g-2" style="gap:16px"><div class="ctl"><label for="cap-sel">Captain</label><select id="cap-sel" class="input" data-change="captain">${players.slice().sort((a, b) => b.attrs.leadership - a.attrs.leadership).map(p => `<option value="${p.id}" ${c.captain === p.id ? 'selected' : ''}>${esc(p.name)} (leadership ${p.attrs.leadership})</option>`).join('')}</select></div><div class="ctl"><label for="vice-sel">Vice-captain</label><select id="vice-sel" class="input" data-change="vice">${players.slice().sort((a, b) => b.attrs.leadership - a.attrs.leadership).map(p => `<option value="${p.id}" ${c.vice === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div></div>` : ''}
            <div class="muted" style="font-size:.8rem">High press wins the ball higher but tires players faster. Attacking mentality creates more chances at both ends. A captain with high leadership steadies the dressing room after defeats.</div>
          </section>
          <section class="card plist"><div class="card-h"><h3>${c.isNation ? 'Called-up squad' : 'Squad selection'}</h3><span class="muted" style="font-size:.8rem">${c.lineup.bench.length} substitutes</span></div><div class="tbl-wrap"><table class="tbl compact">
            <thead><tr><th>Role</th><th>Pos</th><th>Name</th><th class="c">Abl</th><th>Condition</th><th class="r">Form</th></tr></thead><tbody>
            ${players.map(p => { const r = role(p.id); const isSel = sel && sel.kind === 'player' && sel.id === p.id; return `<tr class="click ${isSel ? 'sel' : ''}" data-act="pl-pick" data-id="${p.id}"><td>${r ? `<span class="pos ${r === 'SUB' ? 'GK' : TL.POS_GROUP[r]}" style="${r === 'SUB' ? 'background:var(--surface-3);color:var(--muted)' : ''}">${r}</span>` : '<span class="faint">–</span>'}</td><td>${posTag(p.pos)}</td><td><b>${esc(p.name)}</b> ${statusTags(p)}</td><td class="c">${ovrTag(p.ovr)}</td><td>${condBar(p.cond)}</td><td class="r">${p.form.length ? ratingTag(formAvg(p)) : '<span class="faint">–</span>'}</td></tr>`; }).join('')}
            </tbody></table></div></section>
        </div>
      </div>`;
  }
  function lineupAssign(a, b) {
    const L = tacticsTeam().lineup;
    const loc = s => {
      if (s.kind === 'slot') return { arr: L.xi, i: s.i };
      let i = L.xi.indexOf(s.id); if (i >= 0) return { arr: L.xi, i };
      i = L.bench.indexOf(s.id); if (i >= 0) return { arr: L.bench, i };
      return { arr: null, id: s.id };
    };
    const la = loc(a), lb = loc(b);
    const va = la.arr ? la.arr[la.i] : la.id, vb = lb.arr ? lb.arr[lb.i] : lb.id;
    for (const [l, v] of [[la, vb], [lb, va]]) if (l.arr === L.xi && v && !TL.available(P(v))) { toast(`${P(v).name} is ${P(v).onLoan ? 'out on loan' : P(v).injury > 0 ? 'injured' : 'suspended'}.`); return; }
    if (la.arr) la.arr[la.i] = vb;
    if (lb.arr) lb.arr[lb.i] = va;
    L.bench = L.bench.filter(Boolean);
  }
  function changeFormation(f) {
    const c = tacticsTeam();
    const cur = c.lineup.xi.filter(Boolean).map(P);
    const slots = TL.FORMATIONS[f];
    const xi = new Array(slots.length).fill(null), used = new Set();
    slots.map((s, i) => i).sort((a, b) => (slots[a][0] === 'GK' ? -1 : 0) - (slots[b][0] === 'GK' ? -1 : 0)).forEach(i => {
      let best = null, bv = -1;
      for (const p of cur) { if (used.has(p.id)) continue; const v = p.ovr * TL.familiarity(p.pos, slots[i][0]); if (v > bv) { bv = v; best = p; } }
      if (best) { xi[i] = best.id; used.add(best.id); }
    });
    c.tactics.formation = f; c.lineup.xi = xi;
    TL.validateLineup(G, c);
  }

  /* =========================================================
     TRANSFERS · FINANCES · STAFF · TRAINING
     ========================================================= */
  ui.tf = { q: '', pos: 'ALL', age: 99, abl: 0, price: 0, fa: false, league: 'ALL' };
  ui.tsub = 'search'; ui.staffRole = 'all';
  function transferRow(p) {
    const club = p.clubId && G.clubs[p.clubId];
    return `<tr class="click" data-act="player" data-id="${p.id}">
      <td><button class="star ${isShort(p.id) ? 'on' : ''}" data-act="shortlist" data-id="${p.id}" aria-label="${isShort(p.id) ? 'Remove from' : 'Add to'} shortlist">${isShort(p.id) ? ICON.starOn : ICON.star}</button></td>
      <td><b>${esc(p.name)}</b> ${p.listed ? '<span class="tag sus">Listed</span>' : ''}${p.requested ? '<span class="tag sus">Wants out</span>' : ''}${G.scouted[p.id] ? ' <span class="tag yth">Scouted</span>' : ''}</td>
      <td><span class="team">${club ? crest(club, 18) + esc(club.name) : '<span class="muted">Free agent</span>'}</span></td>
      <td>${posTag(p.pos)}</td><td class="r">${p.age}</td><td class="muted">${p.nat}</td><td class="c">${ablTxt(p)}</td><td class="c muted">${potTxt(p)}</td>
      <td class="r"><b>${p.clubId ? fm(TL.askingPrice(G, p)) : 'Free'}</b></td>
      <td class="r muted">${p.contract ? wageTxt(p.contract.wage) : '–'}</td><td class="r muted">${contractTxt(p)}</td></tr>`;
  }
  // News & rumours: every story about a player opens his profile
  ui.newsF = 'all';
  function newsList() {
    const c = me();
    const kindOf = n => n.kind || (/^Rumour/.test(n.text) ? 'rumour' : 'club');
    const F = { all: () => true, rumour: n => kindOf(n) === 'rumour', transfer: n => ['transfer', 'loan', 'release'].includes(kindOf(n)), mine: n => c && (n.club === c.id || (n.pid && P(n.pid) && P(n.pid).clubId === c.id) || n.text.includes(c.name)), short: n => n.pid && isShort(n.pid) };
    const list = G.news.filter(F[ui.newsF] || F.all).slice(0, 100);
    const TAG = { rumour: '<span class="tag sus">Rumour</span>', transfer: '<span class="tag yth">Done deal</span>', loan: '<span class="tag yth">Loan</span>', release: '<span class="tag">Released</span>', award: '<span class="tag star">Award</span>' };
    return `<div class="filters" style="margin-bottom:12px">${[['all', 'Everything'], ['rumour', 'Rumours'], ['transfer', 'Done deals'], ['mine', 'My club'], ['short', 'Shortlisted players']].map(([k, l]) => `<button class="chip ${ui.newsF === k ? 'on' : ''}" data-act="news-f" data-v="${k}">${l}</button>`).join('')}</div>
      <section class="card">${list.length ? list.map(n => { const p = n.pid && P(n.pid), club = n.club && G.clubs[n.club]; return `<div class="news ${p ? 'click' : ''}" ${p ? `data-act="player" data-id="${p.id}" role="button" tabindex="0"` : ''}><span class="muted">${TL.fmtDate(n.date)}</span><span class="news-body">${club ? crest(club, 22) : ''}<span>${TAG[kindOf(n)] || ''} ${esc(n.text.replace(/^Rumour: /, ''))}${p ? `<span class="news-p">${posTag(p.pos)} ${p.age} · ${ablTxt(p)}${isShort(p.id) ? ' ★' : ''}</span>` : ''}</span></span></div>`; }).join('') : '<div class="empty">Nothing here yet. News and rumours appear as days go by.</div>'}</section>`;
  }
  const transferHead =`<thead><tr><th></th><th>Name</th><th>Club</th><th>Pos</th><th class="r">Age</th><th>Nat</th><th class="c">Abl</th><th class="c">Pot</th><th class="r">Asking</th><th class="r">Wage</th><th class="r">Contract</th></tr></thead>`;
  function viewTransfers() {
    const c = me(); if (!c) return needClub();
    const f = c.finance, bill = TL.wageBill(G, c);
    const open = G.offers.filter(o => o.status === 'open' && P(o.pid) && P(o.pid).clubId === c.id);
    const sub = ui.tsub;
    const tabs = `<div class="seg" role="tablist">${[['search', 'Search'], ['shortlist', `Shortlist (${G.shortlist.length})`], ['offers', `Offers${open.length ? ' (' + open.length + ')' : ''}`], ['mine', 'My players'], ['news', 'News & rumours']].map(([k, l]) => `<button class="${sub === k ? 'on' : ''}" data-act="tsub" data-v="${k}">${l}</button>`).join('')}</div>`;
    let body = '';
    if (sub === 'search') {
      const tf = ui.tf, q = tf.q.trim().toLowerCase();
      const list = Object.values(G.players).filter(p => p.clubId !== c.id && !p.onLoan && !p.abroad && !p.academy && !p.trialist && !(p.loan && p.loan.parent === c.id) && (tf.fa ? !p.clubId : true)
        && (tf.league === 'ALL' || (p.clubId && G.clubs[p.clubId].leagueId === tf.league))
        && (!q || p.name.toLowerCase().includes(q) || clubName(p.clubId).toLowerCase().includes(q))
        && (tf.pos === 'ALL' || p.pos === tf.pos || TL.POS_GROUP[p.pos] === tf.pos) && p.age <= tf.age)
        .map(p => { const v = TL.abilityView(G, p); return { p, est: (v.lo + v.hi) / 2 }; })
        .filter(x => x.est >= tf.abl && (!tf.price || (x.p.clubId ? TL.askingPrice(G, x.p) : 0) <= (tf.price < 0 ? f.transferBudget : tf.price)))
        .sort((a, b) => b.est - a.est).slice(0, 80).map(x => x.p);
      const sel = (k, opts) => `<select class="input" data-tf="${k}" aria-label="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(tf[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      body = `<section class="card"><div class="card-b filters-row">
          <input class="input" id="tf-q" data-tf="q" placeholder="Search player or club" value="${esc(tf.q)}" autocomplete="off">
          ${sel('league', [['ALL', 'All leagues']].concat(G.leagueDefs.map(l => [l.id, l.name])))}
          ${sel('pos', [['ALL', 'Any position'], ['GK', 'Goalkeepers'], ['DEF', 'Defenders'], ['MID', 'Midfielders'], ['ATT', 'Attackers']].concat(TL.POSITIONS.filter(x => x !== 'GK').map(x => [x, x])))}
          ${sel('age', [[99, 'Any age'], [21, 'Age 21 or under'], [25, '25 or under'], [29, '29 or under']])}
          ${sel('abl', [[0, 'Any ability'], [60, 'Ability 60+'], [70, '70+'], [75, '75+'], [80, '80+'], [85, '85+']])}
          ${sel('price', [[0, 'Any price'], [-1, 'Within my budget'], [1, 'Up to ' + fm(1)], [5, 'Up to ' + fm(5)], [15, 'Up to ' + fm(15)], [40, 'Up to ' + fm(40)], [80, 'Up to ' + fm(80)]])}
          <label class="check"><input type="checkbox" data-tf="fa" ${tf.fa ? 'checked' : ''}> Free agents only</label>
        </div>
        <div class="tbl-wrap"><table class="tbl compact">${transferHead}<tbody>${list.map(transferRow).join('') || '<tr><td colspan="11" class="empty">No players match these filters.</td></tr>'}</tbody></table></div>
        <div class="card-b muted" style="font-size:.8rem">Ability shows as a range until your scouts report on a player. Showing the top ${list.length} matches.</div></section>`;
    } else if (sub === 'shortlist') {
      const list = G.shortlist.map(P).filter(Boolean);
      body = `<section class="card"><div class="tbl-wrap"><table class="tbl compact">${transferHead}<tbody>${list.map(transferRow).join('') || '<tr><td colspan="11" class="empty">Tap the star next to any player to shortlist him.</td></tr>'}</tbody></table></div></section>`;
    } else if (sub === 'offers') {
      const past = G.offers.filter(o => o.status !== 'open' && P(o.pid) && (P(o.pid).clubId === c.id || o.club === c.id)).slice(-10).reverse();
      body = `<section class="card"><div class="card-h"><h3>Offers for your players</h3></div>
        ${open.length ? open.map(o => { const p = P(o.pid), b = G.clubs[o.club]; return `<div class="offer">${crest(b, 30)}<div style="flex:1;min-width:0"><b>${esc(b.name)}</b> bid <b>${fm(o.fee)}</b> for <a href="#" data-act="player" data-id="${p.id}">${esc(p.name)}</a><div class="muted" style="font-size:.8rem">Our valuation ${fm(TL.askingPrice(G, p))} · contract ${contractTxt(p)}</div></div><div class="row"><button class="btn sm" data-act="offer-resp" data-id="${o.id}" data-how="reject">Reject</button><button class="btn sm" data-act="haggle-open" data-id="${o.id}">Negotiate</button><button class="btn sm primary" data-act="offer-resp" data-id="${o.id}" data-how="accept">Accept</button></div></div>`; }).join('') : '<div class="empty">No open offers. Transfer-list a player to attract bids.</div>'}
        ${past.length ? `<div class="card-h" style="border-top:1px solid var(--line-soft)"><h3>Recent</h3></div><div class="tbl-wrap"><table class="tbl compact"><tbody>${past.map(o => `<tr><td>${esc(P(o.pid).name)}</td><td>${esc(clubName(o.club))}</td><td class="r">${fm(o.fee)}</td><td class="r"><span class="tag ${o.status === 'accepted' ? 'yth' : 'sus'}">${o.status}</span></td></tr>`).join('')}</tbody></table></div>` : ''}</section>`;
    } else if (sub === 'mine') {
      const ps = c.players.map(P);
      const listed = ps.filter(p => p.listed || p.requested), loaned = ps.filter(p => p.onLoan).concat(TL.loanedOut ? TL.loanedOut(G, c.id) : []), inLoan = ps.filter(p => p.loan), expiring = ps.filter(p => p.contract && p.contract.end <= G.season && !p.onLoan);
      const block = (title, arr, extra, empty) => `<section class="card"><div class="card-h"><h3>${title}</h3><span class="muted" style="font-size:.8rem">${arr.length}</span></div>${arr.length ? `<div class="tbl-wrap"><table class="tbl compact"><tbody>${arr.map(p => `<tr class="click" data-act="player" data-id="${p.id}"><td>${posTag(p.pos)}</td><td><b>${esc(p.name)}</b></td><td class="c">${ovrTag(p.ovr)}</td><td class="r muted">${extra(p)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty" style="padding:16px">${empty}</div>`}</section>`;
      body = `<div class="grid g-2">${block('Transfer listed or unsettled', listed, p => 'Asking ' + fm(TL.askingPrice(G, p)), 'Nobody is listed. Open a player and choose Transfer list.')}${block('Contracts expiring this season', expiring, p => wageTxt(p.contract.wage), 'No contracts expire this season.')}${block('Loaned out', loaned, p => esc(p.onLoan ? p.onLoan.to : clubName(p.clubId) + ' · ' + p.stats.apps + ' apps'), 'No players out on loan.')}${block('On loan here', inLoan, p => 'from ' + esc(clubName(p.loan.parent)), 'No loan signings.')}</div>`;
    } else {
      body = newsList();
    }
    return `<div class="page-h"><div><div class="eyebrow">${windowPill()}</div><h1>Transfers</h1></div>${tabs}</div>
      <div class="kpis"><div class="kpi"><span>Transfer budget</span><b>${fm(f.transferBudget)}</b></div><div class="kpi"><span>Wage bill</span><b>${wageTxt(bill)}</b><small>Budget ${wageTxt(f.wageBudget)}</small><div class="meter ${bill > f.wageBudget ? 'bad' : bill > f.wageBudget * 0.95 ? 'warn' : 'good'}"><i style="width:${Math.min(100, 100 * bill / Math.max(0.1, f.wageBudget))}%"></i></div></div><div class="kpi"><span>Squad size</span><b>${c.players.filter(id => !P(id).onLoan).length}</b><small>${c.players.filter(id => P(id).age > 21).length} over 21</small></div><div class="kpi"><span>Scouting</span><b>${G.scoutQueue.length} pending</b><small>${Object.keys(G.scouted).length} players scouted</small></div></div>
      ${body}`;
  }

  /* ---------- Negotiation ---------- */
  function initContract(d) {
    const p = P(d.pid);
    d.role = TL.expectedRole(G, p);
    const dem = TL.wageDemand(G, p, d.role, 3, d.mode === 'renew');
    d.years = Math.round((dem.pref[0] + dem.pref[1]) / 2);
    const w = TL.wageDemand(G, p, d.role, d.years, d.mode === 'renew').wage * 0.88;
    d.wage = w >= 10 ? Math.round(w) : Math.max(0.1, Math.round(w * 10) / 10);
  }
  function openDeal(pid, mode) {
    const p = P(pid), c = me();
    const d = { pid, mode, log: [], round: 0, cround: 0, stage: mode === 'free' || mode === 'renew' ? 'contract' : 'bid', fee: 0, instalments: 1, sellOn: 0 };
    if (mode === 'buy' || mode === 'loan') {
      if (!TL.windowInfo(G).open) { toast('The transfer window is closed. You can still sign free agents.'); return; }
      const intr = TL.playerInterest(G, p);
      if (!intr.ok) { d.stage = 'done'; d.log.push({ who: 'them', text: intr.msg }); }
      d.fee = mode === 'loan' ? 0 : TL.roundFee(TL.askingPrice(G, p) * 0.85);
    }
    if (mode !== 'renew' && c.players.length >= 32) { toast('Your squad is full (32 players). Sell or release someone first.'); return; }
    if (d.stage === 'contract') initContract(d);
    if (mode === 'renew') d.log.push({ who: 'them', text: `${p.name} is open to talks. He currently earns ${wageTxt(p.contract.wage)} until ${contractTxt(p)}.${p.agentGreed ? ' His agent is pushing for a big raise.' : ''}` });
    if (mode === 'free') d.log.push({ who: 'them', text: `${p.name} is a free agent, so there is no transfer fee. He will want a signing-on bonus.` });
    ui.deal = d; ui.modal = { type: 'deal' }; render();
  }
  function viewDealModal() {
    const d = ui.deal, p = P(d.pid), c = me();
    const club = p.clubId && G.clubs[p.clubId];
    const title = { buy: 'Transfer offer', loan: 'Loan offer', free: 'Sign free agent', renew: 'New contract' }[d.mode];
    const log = d.log.map(l => `<div class="msg ${l.who}">${esc(l.text)}</div>`).join('');
    const cs = TL.CURRENCIES[TL.currency].sym;
    let form = '';
    if (d.stage === 'bid') {
      form = d.mode === 'loan'
        ? `<p class="muted" style="margin:0">Ask ${esc(club.name)} to loan ${esc(p.name)} until the end of the season. You pay his wages of ${wageTxt(p.contract.wage)}.</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="deal-bid">Request loan</button></div>`
        : `<div class="grid g-3" style="gap:12px">
            <div class="ctl"><label for="deal-fee">Fee (£m)</label><input id="deal-fee" class="input" type="number" min="0" step="${d.fee >= 10 ? 0.5 : d.fee >= 1 ? 0.1 : 0.01}" value="${d.fee}"></div>
            <div class="ctl"><label for="deal-inst">Payment</label><select id="deal-inst" class="input">${[[1, 'All up front'], [2, 'Over 2 years'], [3, 'Over 3 years']].map(([v, l]) => `<option value="${v}" ${d.instalments === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="ctl"><label for="deal-sellon">Sell-on clause</label><select id="deal-sellon" class="input">${[0, 10, 15, 20, 25].map(v => `<option value="${v}" ${d.sellOn === v ? 'selected' : ''}>${v ? v + '% of profit' : 'None'}</option>`).join('')}</select></div>
          </div>
          <div class="row between"><span class="muted" style="font-size:.85rem">Budget ${fm(c.finance.transferBudget)} · ${fm(d.fee)} entered${cs !== '£' ? ' (fees are entered in £m)' : ''}${p.contract && p.contract.clause ? ` · release clause ${fm(p.contract.clause)}` : ''}</span>
          <div class="row">${p.contract && p.contract.clause ? `<button class="btn" data-act="deal-clause">Pay release clause</button>` : ''}<button class="btn primary" data-act="deal-bid">Submit offer</button></div></div>`;
    } else if (d.stage === 'contract') {
      const dem = TL.wageDemand(G, p, d.role, d.years, d.mode === 'renew');
      const bill = TL.wageBill(G, c) - (d.mode === 'renew' && p.contract ? p.contract.wage : 0);
      form = `<div class="grid g-3" style="gap:12px">
          <div class="ctl"><label for="deal-wage">Wage (£k per week)</label><input id="deal-wage" class="input" type="number" min="0.1" step="${d.wage >= 10 ? 1 : 0.1}" value="${d.wage}"></div>
          <div class="ctl"><label for="deal-years">Length</label><select id="deal-years" class="input">${[1, 2, 3, 4, 5].map(v => `<option value="${v}" ${d.years === v ? 'selected' : ''}>${v} year${v > 1 ? 's' : ''}</option>`).join('')}</select></div>
          <div class="ctl"><label for="deal-role">Squad role</label><select id="deal-role" class="input">${TL.CONTRACT_ROLES.map((r, i) => `<option value="${i}" ${d.role === i ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        </div>
        <div class="row between"><span class="muted" style="font-size:.85rem">He expects to be a <b>${TL.CONTRACT_ROLES[dem.expected].toLowerCase()}</b> player and prefers ${dem.pref[0]}–${dem.pref[1]} years. Wage room: ${wageTxt(Math.max(0, c.finance.wageBudget - bill))}. Promising a Star or First-team role means he expects to start.${d.mode === 'buy' ? ` Agent fee ${fm(Math.max(0.01, d.agreedFee * TL.ECON.agentFeePct))}.` : d.mode === 'free' ? ' Signing bonus = 3 months wages.' : ''}</span>
        <button class="btn primary" data-act="deal-contract">Offer contract</button></div>`;
    } else {
      form = `<div class="row" style="justify-content:flex-end">${d.success ? '<button class="btn" data-act="tab" data-v="squad">View squad</button>' : ''}${d.unveil && TL.unveilEligible(G, p) ? `<button class="btn primary" data-act="unveil" data-id="${p.id}">Unveil him now</button>` : ''}<button class="btn ${d.unveil ? '' : 'primary'}" data-act="close">Done</button></div>`;
    }
    return `<div class="modal-h">${club ? crest(club, 40) : `<span class="ovr t4">FA</span>`}<div style="min-width:0"><div class="eyebrow">${title}${d.stage === 'contract' ? ' · personal terms' : ''}</div><h2 style="font-size:1.4rem;margin-top:3px">${esc(p.name)}</h2><div class="muted" style="font-size:.85rem;margin-top:3px">${p.pos} · ${p.age} · ${esc(clubName(p.clubId))}</div></div><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div>
      <div class="modal-b stack" style="gap:16px">${log ? `<div class="chatlog" aria-live="polite">${log}</div>` : ''}${form}</div>`;
  }
  function dealBid(useClause) {
    const d = ui.deal, p = P(d.pid), c = me();
    if (d.mode === 'buy') {
      d.fee = useClause ? p.contract.clause : Math.max(0, parseFloat($('#deal-fee').value) || 0);
      d.instalments = useClause ? 1 : +$('#deal-inst').value; d.sellOn = useClause ? 0 : +$('#deal-sellon').value;
      if (d.fee > c.finance.transferBudget) { d.log.push({ who: 'them', text: `The board won't allow it: ${fm(d.fee)} is more than your transfer budget of ${fm(c.finance.transferBudget)}.` }); return render(); }
      d.log.push({ who: 'you', text: `We offer ${fm(d.fee)}${d.instalments > 1 ? ` paid over ${d.instalments} years` : ''}${d.sellOn ? ` plus a ${d.sellOn}% sell-on clause` : ''}.` });
    } else d.log.push({ who: 'you', text: `We'd like to take ${p.name} on loan until the end of the season.` });
    const r = TL.evaluateBid(G, p, { fee: d.fee, instalments: d.instalments, sellOn: d.sellOn, loan: d.mode === 'loan', round: d.round });
    d.round++;
    d.log.push({ who: 'them', text: r.msg });
    if (r.result === 'accept') {
      d.agreedFee = d.fee;
      if (d.mode === 'loan') {
        const bill = TL.wageBill(G, c) + p.contract.wage;
        if (bill > c.finance.wageBudget) { d.log.push({ who: 'them', text: 'The board blocks the loan: his wages would take you over the wage budget.' }); d.stage = 'done'; return render(); }
        TL.completeTransfer(G, p.id, c.id, 0, { wage: p.contract.wage, end: G.season, clause: null }, { loan: true });
        d.log.push({ who: 'them', text: `${p.name} has joined on loan until the end of the season.` }); d.stage = 'done'; d.success = true; autosave();
      } else { d.stage = 'contract'; initContract(d); d.log.push({ who: 'them', text: `${p.name}'s agent is ready to discuss personal terms.` }); }
    } else if (r.result === 'counter') d.fee = r.fee;
    else if (d.round >= 4) d.stage = 'done';
    render();
  }
  function dealContract() {
    const d = ui.deal, p = P(d.pid), c = me();
    const raw = +$('#deal-wage').value || 0.1;
    d.wage = raw >= 10 ? Math.round(raw) : Math.max(0.1, Math.round(raw * 10) / 10); d.years = +$('#deal-years').value; d.role = +$('#deal-role').value;
    const bill = TL.wageBill(G, c) - (d.mode === 'renew' && p.contract ? p.contract.wage : 0) + d.wage;
    d.log.push({ who: 'you', text: `We offer ${wageTxt(d.wage)} for ${d.years} year${d.years > 1 ? 's' : ''} as a ${TL.CONTRACT_ROLES[d.role].toLowerCase()} player.` });
    if (bill > c.finance.wageBudget) { d.log.push({ who: 'them', text: `The board won't approve this: the wage bill would be ${wageTxt(bill)}, over the budget of ${wageTxt(c.finance.wageBudget)}.` }); return render(); }
    const r = TL.evaluateContract(G, p, { wage: d.wage, years: d.years, role: d.role, round: d.cround }, d.mode === 'renew');
    d.cround++;
    d.log.push({ who: 'them', text: r.msg });
    if (r.result === 'accept') {
      const contract = { wage: d.wage, end: d.mode === 'renew' ? G.season + d.years : G.season + d.years - 1, clause: null };
      if (d.mode === 'buy') {
        if (d.agreedFee > c.finance.transferBudget) { d.log.push({ who: 'them', text: 'Your transfer budget has changed and no longer covers the fee.' }); d.stage = 'done'; return render(); }
        TL.completeTransfer(G, p.id, c.id, d.agreedFee, contract, { instalments: d.instalments, sellOn: d.sellOn, agentFee: Math.max(0.01, d.agreedFee * TL.ECON.agentFeePct) });
        d.log.push({ who: 'them', text: `Done deal! ${p.name} joins for ${fm(d.agreedFee)}.` });
        if (d.agreedFee >= 50) TL.unlock(G, 'bigSpender');
        c.fans.mood = TL.clamp(c.fans.mood + Math.min(6, d.agreedFee / 10), 0, 100);
      } else if (d.mode === 'free') {
        TL.book(G, 'exp', 'agents', d.wage * 13 / 1000);
        TL.completeTransfer(G, p.id, c.id, 0, contract, {});
        d.log.push({ who: 'them', text: `${p.name} signs on a free transfer.` });
      } else { p.contract = contract; p.morale = Math.min(100, p.morale + 8); p.agentGreed = 0; if (p.requested) { p.requested = false; d.log.push({ who: 'them', text: `${p.name} withdraws his transfer request.` }); } d.log.push({ who: 'them', text: `${p.name} signs a new deal until ${contractTxt(p)}.` }); }
      p.role = d.role; p.benchRun = 0;
      TL.addMail(G, 'transfers', d.mode === 'renew' ? `${p.name} signs new contract` : `${p.name} signs for ${c.name}`, d.log[d.log.length - 1].text + `\n\nWage: ${wageTxt(d.wage)} · Role: ${TL.CONTRACT_ROLES[d.role]}`);
      G.inbox[0].read = true;
      if (d.mode !== 'renew' && TL.offerMerch && (p.ovr >= 80 || (d.agreedFee || 0) >= 30)) { TL.offerMerch(G, p); d.log.push({ who: 'them', text: 'The commercial team says fans are already asking for his shirt. See your inbox.' }); }
      if (d.mode !== 'renew' && TL.unveilEligible && TL.unveilEligible(G, p)) {
        TL.addMail(G, 'media', `Unveiling ${p.name}`, `The media and the fans want to see ${p.name} in our colours. Hold the unveiling: pick his shirt number, pose with him for the cameras and take questions together.`, true);
        G.inbox[0].action = { kind: 'unveil', id: p.id };
        d.unveil = true;
      }
      d.stage = 'done'; d.success = true; autosave();
    } else if (r.result === 'counter') d.wage = r.wage;
    else d.stage = 'done';
    render();
  }

  /* ---------- Finances ---------- */
  const CAT = { playerMerch: 'Player merchandise', merchSetup: 'Merchandise setup', fines: 'Fines', medical: 'Medical & rehab', feeder: 'Feeder partnerships', matchday: 'Matchday', tv: 'TV rights', sponsor: 'Sponsorship', merch: 'Merchandise', prize: 'Prize money', sales: 'Player sales', wages: 'Player wages', staff: 'Staff', transfers: 'Transfer fees', agents: 'Agents & bonuses', facilities: 'Facilities & projects', operations: 'Stadium & operations' };
  function viewFinances() {
    const c = me(); if (!c) return needClub();
    const f = c.finance, bill = TL.wageBill(G, c), sbill = TL.staffBill(G, c);
    const sf = TL.seasonFinance(G, G.season);
    const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
    const inc = sum(sf.inc), exp = sum(sf.exp);
    const months = G.ledger.slice(-12);
    const max = Math.max(0.01, ...months.map(m => Math.max(sum(m.inc), sum(m.exp))));
    const W = 640, H = 200, GL = 58, bw = (W - GL) / 12;
    const chart = months.length ? `<svg viewBox="0 0 ${W} ${H + 28}" class="chart" role="img" aria-label="Monthly income and expenditure">
        ${[0, 0.25, 0.5, 0.75, 1].map(t => `<line x1="${GL}" x2="${W}" y1="${H - H * t}" y2="${H - H * t}" stroke="var(--line-soft)"/><text x="${GL - 8}" y="${H - H * t + 4}" text-anchor="end" font-size="11" fill="var(--faint)">${t ? fm(max * t) : '0'}</text>`).join('')}
        ${months.map((m, i) => { const a = sum(m.inc), b = sum(m.exp), x = GL + i * bw; return `<rect x="${x + bw * 0.14}" y="${H - H * a / max}" width="${bw * 0.34}" height="${H * a / max}" rx="3" fill="var(--accent)"><title>Income ${fm(a)}</title></rect><rect x="${x + bw * 0.52}" y="${H - H * b / max}" width="${bw * 0.34}" height="${H * b / max}" rx="3" fill="var(--info)"><title>Expenditure ${fm(b)}</title></rect><text x="${x + bw / 2}" y="${H + 18}" text-anchor="middle" font-size="11" fill="var(--muted)">${new Date(m.m + '-15T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</text>`; }).join('')}
      </svg>` : '<div class="empty">The first monthly report arrives at the end of the month.</div>';
    const rows = o => Object.keys(o).sort((a, b) => o[b] - o[a]).map(k => `<tr><td>${CAT[k] || k}</td><td class="r">${fm(o[k])}</td></tr>`).join('') || '<tr><td class="muted">Nothing yet</td><td></td></tr>';
    const base = TL.basePrice(c), price = c.ticketPrice || base;
    const demand = TL.clamp(1 - (price / base - 1) * 0.55, 0.45, 1.12);
    const estAtt = Math.min(c.cap, Math.round(c.cap * TL.clamp(0.92 + (c.rep - 70) / 400, 0.6, 1) * demand));
    const cs = TL.CURRENCIES[TL.currency];
    const step = Math.max(1, Math.round(base / 10));
    return `<div class="page-h"><div><div class="eyebrow">${seasonLabel(G.season)} season to date</div><h1>Finances</h1></div></div>
      <div class="kpis"><div class="kpi"><span>Bank balance</span><b style="color:${f.balance < 0 ? 'var(--loss)' : 'inherit'}">${fm(f.balance)}</b></div><div class="kpi"><span>Season result</span><b style="color:${inc - exp >= 0 ? 'var(--win)' : 'var(--loss)'}">${inc - exp >= 0 ? '+' : ''}${fm(inc - exp)}</b><small>${fm(inc)} in · ${fm(exp)} out</small></div><div class="kpi"><span>Transfer budget</span><b>${fm(f.transferBudget)}</b><small>${Math.round(TL.ECON.saleToBudget * 100)}% of sales are added</small></div><div class="kpi"><span>Wages</span><b>${wageTxt(bill + sbill)}</b><small>Players ${wageTxt(bill)} · staff ${wageTxt(sbill)}</small><div class="meter ${bill > f.wageBudget ? 'bad' : 'good'}"><i style="width:${Math.min(100, 100 * bill / Math.max(0.1, f.wageBudget))}%"></i></div></div></div>
      ${bill > f.wageBudget * 1.05 || inc && exp > inc * 1.3 ? `<div class="card card-b" style="border-color:var(--warn)"><b style="color:var(--warn)">Financial fair play:</b> spending is well above income. Persistent losses will worry the board and could limit your budgets.</div>` : ''}
      <section class="card"><div class="card-h"><h3>Monthly income and expenditure</h3><span class="row muted" style="font-size:.8rem;gap:14px"><span><i class="key" style="background:var(--accent)"></i>Income</span><span><i class="key" style="background:var(--info)"></i>Expenditure</span></span></div><div class="card-b" style="overflow-x:auto">${chart}</div></section>
      <div class="grid g-3">
        <section class="card"><div class="card-h"><h3>Income</h3><b>${fm(inc)}</b></div><div class="tbl-wrap"><table class="tbl compact"><tbody>${rows(sf.inc)}</tbody></table></div></section>
        <section class="card"><div class="card-h"><h3>Expenditure</h3><b>${fm(exp)}</b></div><div class="tbl-wrap"><table class="tbl compact"><tbody>${rows(sf.exp)}</tbody></table></div></section>
        <section class="card card-b stack" style="gap:12px"><h3>Ticket prices</h3>
          <div class="row between"><button class="btn" data-act="ticket" data-v="-${step}" aria-label="Lower price">−</button><b class="display" style="font-size:2rem">${cs.sym}${Math.round(price * cs.rate)}</b><button class="btn" data-act="ticket" data-v="${step}" aria-label="Raise price">+</button></div>
          <dl class="kv"><dt>Typical price at this level</dt><dd>${cs.sym}${Math.round(base * cs.rate)}</dd><dt>Expected crowd</dt><dd>${estAtt.toLocaleString('en-GB')} / ${c.cap.toLocaleString('en-GB')}</dd><dt>Matchday income</dt><dd>${fm(estAtt * price * 1.3 / 1e6)} per game</dd><dt>Fan mood</dt><dd>${fanWord(c.fans.mood)}</dd></dl>
          <div class="muted" style="font-size:.8rem">Higher prices bring in more per fan but empty seats, and annoy supporters.</div>
          ${G.payables.length ? `<h3 style="margin-top:6px">Instalments owed</h3>${G.payables.map(x => `<div class="row between" style="font-size:.88rem"><span>${esc(x.desc)}</span><span>${fm(x.amount)} · summer ${x.season}</span></div>`).join('')}` : ''}
        </section>
      </div>`;
  }

  /* ---------- Staff ---------- */
  // Scouting department: the chief scout plus up to four assistant scouts, each with a region and a brief
  function scoutDept(c) {
    const team = c.scoutTeam || [], cands = TL.scoutCandidates(G, c).filter(x => !x.hired);
    const chief = G.staff[c.staffIds.scout];
    const sel = (k, id, cur, opts) => `<select class="input sm-input" data-change="${k}" data-id="${id}">${Object.entries(opts).map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const allOff = !!c.orders.scoutPaused;
    const pauseBtn = (paused, act, id) => `<button class="btn sm ${paused ? 'primary' : ''}" data-act="${act}" ${id ? `data-id="${id}"` : ''} ${allOff ? 'disabled' : ''}>${paused ? 'Resume' : 'Pause'}</button>`;
    const status = paused => allOff || paused ? '<span class="tag sus">Paused</span>' : '<span class="tag yth">Scouting</span>';
    return `<section class="card"><div class="card-h"><h3>Scouting department</h3><div class="row"><span class="muted" style="font-size:.82rem">${team.length}/${TL.MAX_ASSIST_SCOUTS} assistant scouts · reports every Monday</span><button class="btn sm ${allOff ? 'primary' : ''}" data-act="scout-pause-all">${allOff ? 'Resume all scouting' : 'Pause all scouting'}</button></div></div>
      ${allOff ? '<div class="card-b" style="color:var(--warn);font-size:.86rem;padding-bottom:0">The scouting department is on hold. No weekly reports until you resume. Wages are still paid, and you can still ask for reports on individual players.</div>' : ''}
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Scout</th><th>Status</th><th class="c">Rating</th><th class="r">Wage</th><th>Region</th><th>Looking for</th><th></th></tr></thead><tbody>
        <tr><td><b>${esc(chief ? chief.name : 'Vacant')}</b> <span class="tag yth">Chief Scout</span></td><td>${status(c.orders.chiefPaused)}</td><td class="c">${chief ? chief.rating : '–'}</td><td class="r muted">${chief ? wageTxt(chief.wage) : '–'}</td><td>${sel('order', 'x', c.orders.scoutRegion, TL.SCOUT_REGIONS).replace('data-id="x"', 'data-k="scoutRegion"')}</td><td>${sel('order', 'x', c.orders.scoutFocus, TL.SCOUT_FOCUS).replace('data-id="x"', 'data-k="scoutFocus"')}</td><td class="r">${pauseBtn(c.orders.chiefPaused, 'scout-pause-chief')}</td></tr>
        ${team.map(a => { const st = G.staff[a.id]; return st ? `<tr><td><b>${esc(st.name)}</b> <span class="muted">${st.nat}</span></td><td>${status(a.paused)}</td><td class="c"><span class="ovr ${st.rating >= 14 ? 't2' : 't3'}">${st.rating}</span></td><td class="r muted">${wageTxt(st.wage)}</td><td>${sel('scout-region', a.id, a.region, TL.SCOUT_REGIONS)}</td><td>${sel('scout-focus', a.id, a.focus, TL.SCOUT_FOCUS)}</td><td class="r"><div class="row" style="justify-content:flex-end">${pauseBtn(a.paused, 'scout-pause', a.id)}<button class="btn sm danger" data-act="fire-ascout" data-id="${a.id}">Dismiss</button></div></td></tr>` : ''; }).join('')}
      </tbody></table></div>
      ${team.length < TL.MAX_ASSIST_SCOUTS ? `<div class="card-h" style="border-top:1px solid var(--line-soft)"><h3 style="font-size:.95rem">Available assistant scouts</h3><span class="muted" style="font-size:.8rem">New names every month</span></div>
        <div class="tbl-wrap"><table class="tbl compact"><tbody>${cands.map(x => { const i = TL.scoutCandidates(G, c).indexOf(x); return `<tr><td><b>${esc(x.name)}</b> <span class="muted">${x.nat} · ${x.age}</span></td><td class="c"><span class="ovr ${x.rating >= 14 ? 't2' : 't3'}">${x.rating}</span></td><td class="muted">Knows ${TL.SCOUT_REGIONS[x.home]}</td><td class="r">${wageTxt(x.wage)}</td><td class="r"><button class="btn sm primary" data-act="hire-ascout" data-v="${i}">Hire</button></td></tr>`; }).join('') || '<tr><td class="empty">Nobody available this month.</td></tr>'}</tbody></table></div>` : ''}
      <div class="card-b muted" style="font-size:.8rem">Each assistant watches 1–3 players a week in his region (more with a higher rating) and speeds up your scout reports. Better scouts find better players.</div></section>`;
  }
  function viewStaff() {
    const c = me(); if (!c) return needClub();
    TL.ensureOps(c);
    const roles = Object.keys(TL.STAFF_ROLES);
    const pool = G.staffPool.map(id => G.staff[id]).filter(Boolean).filter(s => ui.staffRole === 'all' || s.role === ui.staffRole).sort((a, b) => b.rating - a.rating);
    const bar = r => `<div class="meter ${r >= 15 ? 'good' : r >= 10 ? '' : r >= 6 ? 'warn' : 'bad'}" style="flex:1"><i style="width:${r * 5}%"></i></div>`;
    return `<div class="page-h"><div><div class="eyebrow">Staff wages ${wageTxt(TL.staffBill(G, c))}</div><h1>Staff</h1></div></div>
      <div class="staff-grid">${roles.map(role => { const s = G.staff[c.staffIds[role]]; return `<section class="card card-b staff-card">
        <div class="eyebrow">${TL.STAFF_ROLES[role]}</div>
        ${s ? `<b class="display" style="font-size:1.15rem">${esc(s.name)}</b><div class="row" style="gap:10px"><b class="display" style="font-size:1.4rem;min-width:28px">${s.rating}</b>${bar(s.rating)}</div><div class="muted" style="font-size:.8rem">${s.age} · ${esc(TL.NAT_NAMES[s.nat] || s.nat)} · ${wageTxt(s.wage)} · until Jun ${s.end + 1}</div>` : '<b class="display" style="font-size:1.15rem;color:var(--loss)">Vacant</b><div class="muted" style="font-size:.8rem">Hire someone from the market below.</div>'}
        <div class="muted" style="font-size:.8rem">${TL.STAFF_EFFECT[role]}</div>
        ${s && TL.STAFF_ORDERS[role] ? orderSelect(role, 'Instructions') : ''}
        ${s && role === 'scout' ? `<label class="ctl"><span class="lbl">Scouting region</span><select class="input" data-change="order" data-k="scoutRegion">${Object.entries(TL.SCOUT_REGIONS).map(([k, l]) => `<option value="${k}" ${c.orders.scoutRegion === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="ctl"><span class="lbl">Looking for</span><select class="input" data-change="order" data-k="scoutFocus">${Object.entries(TL.SCOUT_FOCUS).map(([k, l]) => `<option value="${k}" ${c.orders.scoutFocus === k ? 'selected' : ''}>${l}</option>`).join('')}</select><small class="muted">${2 + Math.floor((c.facilities.scouting || 0) / 2)} recommendations every Monday, with full reports.</small></label>` : ''}
        <div class="row">${s ? `<button class="btn sm danger" data-act="fire-staff" data-role="${role}">Dismiss</button>` : ''}<button class="btn sm" data-act="staff-role" data-v="${role}">Find ${s ? 'better' : 'someone'}</button></div></section>`; }).join('')}</div>
      ${scoutDept(c)}
      <section class="card"><div class="card-h"><h3>Staff market</h3><select class="input" style="width:auto" data-change="staff-role" aria-label="Filter by role">${[['all', 'All roles']].concat(roles.map(r => [r, TL.STAFF_ROLES[r]])).map(([v, l]) => `<option value="${v}" ${ui.staffRole === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Name</th><th>Role</th><th class="r">Age</th><th class="c">Rating</th><th class="r">Wage</th><th class="r">vs current</th><th></th></tr></thead><tbody>
        ${pool.map(s => { const cur = TL.staffRating(G, c.id, s.role); const diff = s.rating - cur; return `<tr><td><b>${esc(s.name)}</b> <span class="muted">${s.nat}</span></td><td>${TL.STAFF_ROLES[s.role]}</td><td class="r">${s.age}</td><td class="c"><span class="ovr ${s.rating >= 15 ? 't2' : 't3'}">${s.rating}</span></td><td class="r">${wageTxt(TL.staffWage(s.rating, c))}</td><td class="r" style="color:${diff > 0 ? 'var(--win)' : diff < 0 ? 'var(--loss)' : 'var(--muted)'}">${diff > 0 ? '+' : ''}${diff}</td><td class="r"><button class="btn sm ${diff > 0 ? 'primary' : ''}" data-act="hire-staff" data-id="${s.id}">Hire</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">Nobody available for this role right now.</td></tr>'}
        </tbody></table></div></section>`;
  }

  /* ---------- Training: weekly planner, unit coaching, individual work ---------- */
  const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
  function orderSelect(role, label) {
    const c = me(), opts = TL.STAFF_ORDERS[role];
    return `<label class="ctl"><span class="lbl">${label || TL.STAFF_ROLES[role]}</span><select class="input" data-change="order" data-k="${role}">${Object.entries(opts).map(([k, [l]]) => `<option value="${k}" ${c.orders[role] === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><small class="muted">${esc(opts[c.orders[role]][1])}</small></label>`;
  }
  function viewTraining() {
    const c = me(); if (!c) return needClub();
    TL.ensureOps(c);
    const tr = c.training, tb = TL.trainBonus(G, c);
    const pct = v => { const x = Math.round((v - 1) * 1000) / 10; return (x > 0 ? '+' : '') + x + '%'; };
    const sessOpts = cur => Object.entries(TL.SESSIONS).map(([k, S]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(S.name)}</option>`).join('');
    const upcoming = Array.from({ length: 7 }, (_, i) => TL.addDays(G.date, i)).map(d => {
      const k = TL.sessionFor(G, c, d);
      const f = k === 'match' ? G.fixtures.find(x => x.date === d && (x.home === c.id || x.away === c.id)) : null;
      const opp = f ? teamName(f.home === c.id ? f.away : f.home) : '';
      const S = TL.SESSIONS[k];
      return `<div class="day ${k === 'match' ? 'match' : ''} ${d === G.date ? 'today' : ''}"><span class="d">${d === G.date ? 'Today' : new Date(d + 'T12:00:00Z').toLocaleDateString(TL.locale || 'en-GB', { weekday: 'short', timeZone: 'UTC' })}</span><b>${k === 'match' ? 'Match' : esc(S.short)}</b><small>${k === 'match' ? 'v ' + esc(opp) : S.cond >= 4 ? 'Recovery' : S.cond <= -4 ? 'Heavy load' : S.cond <= -2 ? 'Normal load' : 'Light'}</small></div>`;
    }).join('');
    const rate = p => TL.weeklyGrowthRate(G, c, p);
    const ps = c.players.map(P).map(p => ({ p, g: rate(p) })).sort((a, b) => b.g - a.g || b.p.ovr - a.p.ovr);
    const speed = g => g >= 0.12 ? ['Very fast', 'var(--win)'] : g >= 0.07 ? ['Fast', 'var(--win)'] : g >= 0.03 ? ['Steady', 'var(--text)'] : g > 0 ? ['Slow', 'var(--muted)'] : ['Peaked', 'var(--faint)'];
    const focusOpts = p => `<select class="input sm-input" data-change="tfocus" data-id="${p.id}" aria-label="Individual focus for ${esc(p.name)}"><option value="">None</option>${(p.pos === 'GK' ? TL.ATTRS.Goalkeeping : TL.ATTRS.Technical.concat(TL.ATTRS.Mental, TL.ATTRS.Physical)).map(k => `<option value="${k}" ${p.trainFocus === k ? 'selected' : ''}>${TL.ATTR_LABEL[k]} (${p.attrs[k]})</option>`).join('')}</select>`;
    const wlOpts = p => `<select class="input sm-input" data-change="workload" data-id="${p.id}" aria-label="Workload for ${esc(p.name)}">${Object.entries(TL.WORKLOADS).map(([k, l]) => `<option value="${k}" ${(p.workload || 'normal') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const fams = Object.keys(TL.FORMATIONS).sort((a, b) => (c.fam[b] || 0) - (c.fam[a] || 0));
    const devPace = Math.round(TL.trainGrowthMult(G, c, {}) * 100);
    const inj = Math.round(TL.injuryRisk(G, c) * [0.64, 1, 1.56][tr.intensity] * 100);
    return `<div class="page-h"><div><div class="eyebrow">Training ground ${c.facilities.training}/20 · sports science ${c.facilities.science || 0}/5 · academy ${c.facilities.youth}/20</div><h1>Training</h1></div>
      <div class="row"><span class="muted" style="font-size:.85rem">Presets</span>${Object.entries(TL.WEEK_PRESETS).map(([k, [l]]) => `<button class="btn sm" data-act="week-preset" data-v="${k}">${l}</button>`).join('')}</div></div>
      <div class="kpis">
        <div class="kpi"><span>Attack</span><b>${pct(tb.att)}</b><small>Midfield ${pct(tb.mid)}</small></div>
        <div class="kpi"><span>Defence</span><b>${pct(tb.def)}</b><small>Set pieces ${pct(tb.sp)}</small></div>
        <div class="kpi"><span>Match fatigue</span><b>${pct(tb.fat)}</b><small>Next-match prep ${pct(tb.prep)}</small></div>
        <div class="kpi"><span>Development pace</span><b>${devPace}%</b><small>Injury risk ${inj}% of normal</small></div>
      </div>
      <section class="card"><div class="card-h"><h3>Next 7 days</h3><span class="muted" style="font-size:.8rem">Bonuses come from the last 7 sessions</span></div><div class="week-strip">${upcoming}</div></section>
      <div class="grid g-2">
        <section class="card card-b stack" style="gap:14px"><h3>Weekly plan</h3>
          <div class="week-plan">${DAYS.map(([k, l]) => `<label class="ctl"><span class="lbl">${l}</span><select class="input" data-change="week" data-k="${k}">${sessOpts(tr.week[k])}</select></label>`).join('')}</div>
          <label class="check"><input type="checkbox" data-change="train-auto" data-k="autoRecovery" ${tr.autoRecovery ? 'checked' : ''}> Recovery session the day after a match</label>
          <label class="check"><input type="checkbox" data-change="train-auto" data-k="autoPrep" ${tr.autoPrep ? 'checked' : ''}> Match preparation the day before a match</label>
          <div class="ctl"><span class="lbl">Intensity</span><div class="seg">${[[0, 'Light'], [1, 'Normal'], [2, 'Intense']].map(([v, l]) => `<button class="${tr.intensity === v ? 'on' : ''}" data-act="train" data-k="intensity" data-v="${v}">${l}</button>`).join('')}</div><small class="muted">${['Players stay fresh and rarely get hurt, but develop about 20% slower.', 'Normal development and recovery.', 'About 20% faster development, more fatigue and noticeably more training injuries.'][tr.intensity]}</small></div>
        </section>
        <section class="card card-b stack" style="gap:14px"><h3>Unit coaching</h3>
          <div class="grid g-2" style="gap:14px">${orderSelect('attCoach', 'Attacking coach')}${orderSelect('defCoach', 'Defending coach')}${orderSelect('gkCoach', 'Goalkeeping coach')}${orderSelect('fitCoach', 'Fitness coach')}</div>
          <h3 style="margin-top:4px">Tactical familiarity</h3>
          ${fams.slice(0, 3).map(f => `<div class="strength" style="grid-template-columns:150px 1fr 40px"><span class="${f === c.tactics.formation ? '' : 'muted'}">${f}${f === c.tactics.formation ? ' (current)' : ''}</span><div class="meter"><i style="width:${c.fam[f]}%"></i></div><b class="num" style="text-align:right">${Math.round(c.fam[f])}%</b></div>`).join('')}
        </section>
      </div>
      <section class="card"><div class="card-h"><h3>Session guide</h3></div><div class="tbl-wrap"><table class="tbl compact"><tbody>${Object.values(TL.SESSIONS).map(S => `<tr><td><b>${esc(S.name)}</b></td><td class="muted" style="white-space:normal">${esc(S.desc)}</td><td class="r">${S.cond >= 4 ? '<span style="color:var(--win)">Recovery</span>' : S.cond <= -4 ? '<span style="color:var(--warn)">Heavy</span>' : S.cond <= -2 ? 'Normal' : 'Light'}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><div class="card-h"><h3>Player development</h3><span class="muted" style="font-size:.8rem">Workload: rest tired or injury-prone players, give extra work to young talents</span></div>
        <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Pos</th><th>Name</th><th class="r">Age</th><th class="c">Abl</th><th class="c">Pot</th><th>Condition</th><th>Growth</th><th>Progress</th><th class="r">Season</th><th>Workload</th><th>Individual focus</th></tr></thead><tbody>
        ${ps.map(({ p, g }) => { const sp = speed(g), delta = p.ovr - (p.seasonStartOvr != null ? p.seasonStartOvr : p.ovr); return `<tr><td>${posTag(p.pos)}</td><td><a href="#" data-act="player" data-id="${p.id}"><b>${esc(p.name)}</b></a> ${p.onLoan ? '<span class="tag yth">On loan</span>' : ''}${p.injury > 0 ? ' <span class="tag inj">Inj</span>' : ''}${p.mentor ? ' <span class="tag" style="background:var(--surface-3)">Mentored</span>' : ''}</td><td class="r">${p.age}</td><td class="c">${ovrTag(p.ovr)}</td><td class="c muted">${potTxt(p)}</td><td>${condBar(p.cond)}</td><td style="color:${sp[1]};font-weight:600">${sp[0]}</td><td><div class="meter" style="width:90px"><i style="width:${Math.min(100, (p.prog || 0) * 100)}%"></i></div></td><td class="r" style="color:${delta > 0 ? 'var(--win)' : delta < 0 ? 'var(--loss)' : 'var(--muted)'}">${delta > 0 ? '+' : ''}${delta}</td><td>${wlOpts(p)}</td><td>${focusOpts(p)}</td></tr>`; }).join('')}
        </tbody></table></div></section>`;
  }

  /* =========================================================
     MATCHDAY FLOW (handles club & national matches, hot-seat queues)
     ========================================================= */
  // Build today's queue of human fixtures; each is played by the manager who owns the home side (or away side).
  function startMatchday() {
    const list = [];
    for (const f of TL.humanFixturesToday(G)) {
      const owner = TL.ownerIndex(G, f.home) >= 0 ? TL.ownerIndex(G, f.home) : TL.ownerIndex(G, f.away);
      list.push({ f: f.id, owner });
    }
    ui.mq = { list, i: 0, done: [] };
    nextInQueue();
  }
  function nextInQueue() {
    const q = ui.mq;
    if (q.i >= q.list.length) return finishDay();
    const item = q.list[q.i];
    const changed = G.active !== item.owner;
    G.active = item.owner;
    ui.handNext = 'prematch';
    ui.screen = G.managers.length > 1 && changed ? 'handover' : 'prematch';
    render(); window.scrollTo(0, 0);
  }
  const currentFixture = () => ui.mq && ui.mq.list[ui.mq.i] ? G.fixtures.find(f => f.id === ui.mq.list[ui.mq.i].f) : null;
  const sideOf = f => { const m = G.manager; return [m.clubId, m.nationId].includes(f.home) ? 'home' : 'away'; };

  function talkCards(info, act, sel) {
    const morale = moraleWord(info.ctx.morale);
    return `<div class="talk-sit"><span>${esc(info.situation)}</span><span class="muted">Team morale: <b style="color:${morale[1]}">${morale[0]}</b></span></div>
      <div class="talk-grid">${info.options.map(o => `<button class="talk-opt tone-${o.tone} ${sel === o.id ? 'on' : ''}" data-act="${act}" data-v="${esc(o.id)}"><span class="tone">${TL.TONES[o.tone]}</span><b>${esc(o.label)}</b><small>${o.tone === 'angry' && /^You /.test(o.quote) ? esc(o.quote) : `“${esc(o.quote)}”`}</small></button>`).join('')}</div>`;
  }
  function viewPrematch() {
    const f = currentFixture(); if (!f) { ui.screen = 'game'; return viewShell(); }
    const side = sideOf(f), myId = f[side], opp = T(f[side === 'home' ? 'away' : 'home']);
    const H = T(f.home), A = T(f.away), c = T(myId);
    if (c.isNation) TL.ensureSquad(G, c);
    TL.validateLineup(G, c);
    const slots = TL.FORMATIONS[c.tactics.formation];
    const oppPlayers = opp.isNation ? (opp.players.length ? opp.players : TL.nationPool(G, opp.code).slice(0, 23).map(p => p.id)) : opp.players;
    const oppTop = oppPlayers.map(P).filter(p => p && TL.available(p)).sort((a, b) => b.ovr - a.ovr).slice(0, 5);
    const tired = c.lineup.xi.map(P).filter(p => p && p.cond < 75);
    const talk = ui.preTalk || '';
    return `<div class="newc" style="max-width:1040px;padding-bottom:40px">
      <div class="page-h"><div><div class="eyebrow">${esc(TL.compName(G, f))} · ${TL.fmtDate(f.date, true)}${G.managers.length > 1 ? ' · ' + esc(G.manager.name) : ''}</div><h1 class="display" style="font-size:2rem;text-transform:uppercase">Matchday</h1></div><button class="btn ghost" data-act="back-game">Back</button></div>
      <section class="card fixture-hero"><span class="stripe" style="background:${c.c1}"></span>
        <div class="fx-teams"><div class="fx-team">${crest(H, 70)}<b>${esc(H.name)}</b>${venueTag(f, H.id)}<small>${esc(teamSub(f, H.id))}</small></div><div class="fx-mid"><div class="vs">VS</div><div class="when">${f.neutral ? esc(f.venue || 'Neutral venue') : esc(H.stadium)}</div>${f.leg === 2 && f.aggHome != null ? `<div class="when">Aggregate going in: ${esc(H.name)} ${f.aggHome}–${f.aggAway}</div>` : ''}${f.ko && f.leg !== 1 ? '<div class="when">Knockout: extra time and penalties if level</div>' : ''}</div><div class="fx-team">${crest(A, 70)}<b>${esc(A.name)}</b>${venueTag(f, A.id)}<small>${esc(teamSub(f, A.id))}</small></div></div>
        <div class="fx-foot"><span class="muted" style="font-size:.88rem">${c.tactics.formation} · ${['Very defensive', 'Defensive', 'Balanced', 'Attacking', 'Very attacking'][c.tactics.mentality + 2]} · ${['Low block', 'Mid press', 'High press'][c.tactics.press]}</span>
          <div class="row"><button class="btn" data-act="edit-tactics">Edit tactics</button><button class="btn" data-act="instant">Instant result</button><button class="btn primary big" data-act="kickoff">Kick off ${ICON.play}</button></div></div></section>
      <section class="card card-b stack" style="gap:12px"><div class="row between"><h3>Pre-match team talk</h3><span class="muted" style="font-size:.8rem">Pick one, or none</span></div>${talkCards(TL.talkOptionsFor(G, f, side), 'pre-talk', talk)}</section>
      ${tired.length ? `<div class="card card-b" style="border-color:var(--warn)"><b style="color:var(--warn)">Assistant:</b> ${tired.map(p => esc(p.name)).join(', ')} ${tired.length > 1 ? 'are' : 'is'} short of match fitness. Consider resting ${tired.length > 1 ? 'them' : 'him'}.</div>` : ''}
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h3>Your starting XI</h3><span class="muted" style="font-size:.82rem">${c.tactics.formation}</span></div><div class="tbl-wrap"><table class="tbl compact"><tbody>
          ${c.lineup.xi.map((id, i) => { const p = P(id); return p ? `<tr class="click" data-act="player" data-id="${id}"><td>${posTag(slots[i][0])}</td><td><b>${esc(p.name)}</b>${c.captain === id ? ' <span class="tag cap">C</span>' : ''}</td><td class="c">${ovrTag(p.ovr)}</td><td>${condBar(p.cond)}</td></tr>` : ''; }).join('')}
        </tbody></table></div></section>
        <section class="card"><div class="card-h"><h3>Opposition report</h3><span class="muted" style="font-size:.82rem">${esc(opp.name)} · usually ${opp.tactics.formation}</span></div><div class="card-b stack" style="gap:12px">
          ${!opp.isNation ? `<div><div class="eyebrow" style="margin-bottom:6px">Recent league form</div>${formPills(G.comps[opp.leagueId] ? (TL.table(G, opp.leagueId).find(r => r.id === opp.id) || {}).form : [])}</div>` : `<div class="muted">World ranking ${TL.ranking(G).findIndex(x => x.id === opp.id) + 1} · Elo ${opp.elo}</div>`}
          <div><div class="eyebrow" style="margin-bottom:6px">Players to watch</div>${oppTop.map(p => `<div class="row between" style="padding:5px 0;border-bottom:1px solid var(--line-soft)"><span class="row" style="gap:8px">${posTag(p.pos)}<b>${esc(p.name)}</b></span>${ablTxt(p)}</div>`).join('')}</div>
        </div></section>
      </div></div>`;
  }

  /* ---------- Live match ---------- */
  function viewMatch() {
    const M = ui.m, m = M.match;
    const last = m.lines[m.lines.length - 1];
    return `<div class="newc" style="max-width:1080px;padding-bottom:40px">
      <section class="card" id="sb">${sbHTML()}</section>
      ${M.p3d ? `<div class="p3d-wrap"><canvas id="p3d-c" aria-label="3D match view"></canvas><div class="p3d-cams">${Object.entries(TL.CAMERAS).map(([k, l]) => `<button class="${M.p3d.camMode === k ? 'on' : ''}" data-act="m-cam" data-v="${k}">${l}</button>`).join('')}</div></div>` : ''}
      <div class="controls" id="ctl">${ctlHTML()}</div>
      ${M.panel ? subPanelHTML() : ''}
      <div class="sr-only" aria-live="polite" id="live-line">${last ? esc(last.text) : ''}</div>
      <div class="grid g-home">
        <section class="card"><div class="card-h"><h3>Commentary</h3><span class="muted" style="font-size:.8rem">Newest first</span></div><div class="feed" id="feed">${feedHTML()}</div></section>
        <div class="stack"><section class="card"><div class="card-h"><h3>Match stats</h3></div><div class="card-b" id="mstats">${statsHTML(m)}</div></section>
          <section class="card"><div class="card-h"><h3>On the pitch</h3><span class="muted" style="font-size:.8rem">Condition</span></div><div id="lineup">${lineupHTML()}</div></section></div>
      </div></div>`;
  }
  function sbHTML() {
    const m = ui.m.match, H = m.sides.home, A = m.sides.away;
    const goals = k => m.events.filter(e => e.type === 'goal' && e.side === k && e.scorer).map(e => `${esc(surname(P(e.scorer).name))} ${e.disp}'`).join(', ');
    const reds = k => m.events.filter(e => e.type === 'red' && e.side === k).length;
    const last = m.lines[m.lines.length - 1];
    const clock = m.done ? (m.pens ? 'PENS' : m.et ? 'AET' : 'FT') : m.minute === 0 ? 'KO' : last.type === 'ht' ? 'HT' : last.type === 'et' ? 'ET' : m.clock() + "'";
    const agg = m.f.leg === 2 ? `<div class="muted" style="font-size:.78rem;margin-top:4px">Agg ${H.goals + (m.f.aggHome || 0)}–${A.goals + (m.f.aggAway || 0)}</div>` : '';
    return `<div class="scoreboard">
      <div class="sb-team">${crest(H.club, 52)}<div><b>${esc(H.club.name)}</b>${venueTag(m.f, H.club.id)}${reds('home') ? `<div style="color:var(--loss);font-size:.78rem;font-weight:700">${reds('home')} red</div>` : ''}</div></div>
      <div class="sb-score"><div class="sc">${H.goals}<span class="faint"> – </span>${A.goals}</div><span class="min ${m.done ? 'ft' : ''}">${clock}</span>${m.pens ? `<div class="muted" style="font-size:.8rem;margin-top:4px">Pens ${m.pens.home}–${m.pens.away}</div>` : ''}${agg}</div>
      <div class="sb-team away">${crest(A.club, 52)}<div><b>${esc(A.club.name)}</b>${venueTag(m.f, A.club.id)}${reds('away') ? `<div style="color:var(--loss);font-size:.78rem;font-weight:700">${reds('away')} red</div>` : ''}</div></div>
    </div>
    <div class="scorers"><div>${goals('home')}</div><div>${goals('away')}</div></div>
    ${ui.m.p3d ? '' : `<div class="momentum" aria-hidden="true"><span class="gl"></span><span class="gr"></span><span class="ball" id="ball" style="left:${ui.m.ball}%;top:${ui.m.ballY}%"></span></div>`}`;
  }
  function ctlHTML() {
    const M = ui.m, m = M.match;
    if (m.done) return `<div class="spacer" style="flex:1"></div><button class="btn primary big" data-act="match-done">Full-time · Continue ${ICON.play}</button>`;
    const subs = m.sides[m.userSide].subsLeft;
    return `<button class="btn" data-act="m-pause" aria-label="${M.paused ? 'Play' : 'Pause'}">${M.paused ? ICON.play + ' Play' : ICON.pause + ' Pause'}</button>
      <div class="seg" role="group" aria-label="Speed">${[[1, '1×'], [2, '2×'], [3, '4×']].map(([k, l]) => `<button class="${M.speed === k ? 'on' : ''}" data-act="m-speed" data-v="${k}">${l}</button>`).join('')}</div>
      <div style="flex:1"></div>
      <button class="btn" data-act="m-panel" data-v="subs">Substitutions (${subs} left)</button>
      <button class="btn" data-act="m-panel" data-v="tactics">Tactics</button>
      <button class="btn" data-act="m-panel" data-v="talk">Shout / team talk</button>
      <button class="btn" data-act="m-3d">${M.p3d ? 'Hide 3D' : '3D view'}</button>
      <button class="btn ghost" data-act="m-skip">Skip to result</button>`;
  }
  function feedHTML() { return ui.m.match.lines.slice().reverse().map(e => `<div class="ev ${e.type} ${e.tone || ''}"><span class="m">${e.type === 'ko' ? '' : esc(e.disp) + (e.type === 'pens' || /\D/.test(e.disp) && !/\+/.test(e.disp) ? '' : "'")}</span><span>${esc(e.text)}</span></div>`).join(''); }
  function statsHTML(m) {
    const H = m.sides.home.st, A = m.sides.away.st;
    const tot = H.poss + A.poss || 1;
    const hp = m.done ? H.possPct : Math.round(100 * H.poss / tot);
    const row = (lbl, h, a, fmt) => { const s = (h + a) || 1; return `<div class="statrow"><div class="lbl">${lbl}</div><div class="v">${fmt ? fmt(h) : h}</div><div class="bars"><span><i class="h" style="width:${100 * h / s}%"></i></span><span><i class="a" style="width:${100 * a / s}%"></i></span></div><div class="v r">${fmt ? fmt(a) : a}</div></div>`; };
    return row('Possession', hp, 100 - hp, v => v + '%') + row('Expected goals', +H.xg.toFixed(2), +A.xg.toFixed(2), v => v.toFixed(2)) + row('Shots', H.shots, A.shots) + row('On target', H.onTarget, A.onTarget) + row('Corners', H.corners, A.corners) + row('Fouls', H.fouls, A.fouls) + row('Yellow cards', H.yellows, A.yellows) + row('Offsides', H.offsides, A.offsides);
  }
  function lineupHTML() {
    const m = ui.m.match, k = m.userSide;
    return `<div class="tbl-wrap"><table class="tbl compact"><tbody>${m.onPitch(k).map(o => { const ps = m.ps[o.id], p = P(o.id); return `<tr><td>${posTag(o.pos)}</td><td><b>${esc(surname(p.name))}</b>${ps.yellow ? ' <span class="tag sus">Y</span>' : ''}${ps.goals ? ' ⚽'.repeat(ps.goals) : ''}</td><td>${condBar(ps.cond)}</td><td class="r">${ratingTag(TL.liveRating(m, o.id))}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function subPanelHTML() {
    const M = ui.m, m = M.match, k = m.userSide, S = m.sides[k];
    if (M.panel === 'talk') {
      const lt = M.atBreak || 'live', phase = lt === 'live' ? 'live' : 'ht';
      const info = TL.matchTalk(G, m, k, phase);
      const title = lt === 'ht' ? 'Half-time team talk' : lt === 'et' ? 'Before extra time' : 'Shout from the touchline';
      return `<section class="card card-b stack" style="gap:14px"><div class="row between"><h3>${title}</h3><div class="row">${S.mood ? `<span class="pill">Team mood: ${esc(S.mood)}</span>` : ''}<button class="btn sm ${M.talkReaction ? 'primary' : ''}" data-act="m-panel" data-v="">${M.talkReaction ? 'Back to the match' : 'Close'}</button></div></div>
        ${M.talkReaction ? `<div class="talk-reaction">${esc(M.talkReaction)}</div>` : talkCards(info, 'm-talk', null).replace(/data-act="m-talk"/g, `data-act="m-talk" data-phase="${phase}"`)}</section>`;
    }
    if (M.panel === 'tactics') {
      const t = S.tactics;
      const segs = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${t[key] === v ? 'on' : ''}" data-act="m-tact" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
      const slots = TL.FORMATIONS[t.formation] || [];
      const ink = inkOn(S.club.c1, S.club.c2);
      const pitch = slots.map((sl, i) => {
        const id = S.xi[i], p = id && P(id), ps = id && m.ps[id], off = !p || !ps || ps.red || ps.off != null;
        const fam = p ? TL.familiarity(p.pos, sl[0]) : 1, isSel = M.swapSel === i;
        return `<button class="slot ${isSel ? 'sel' : ''} ${off ? 'empty' : ''}" style="left:${sl[1]}%;top:${100 - sl[2]}%" data-act="m-swap" data-v="${i}" ${off ? 'disabled' : ''} aria-label="${sl[0]}: ${off ? 'empty' : esc(p.name)}">
          <span class="shirt" style="background:${S.club.c1};color:${ink};border-color:${ps ? (ps.cond >= 75 ? 'var(--win)' : ps.cond >= 60 ? 'var(--warn)' : 'var(--loss)') : '#fff'};border-width:3px">${off ? '–' : p.ovr}</span>
          <span class="nm">${off ? (ps && ps.red ? 'Sent off' : 'Empty') : esc(surname(p.name))}</span><span class="ps">${sl[0]}${p && !off && fam < 0.9 ? ' <span class="warn">⚠</span>' : ''}</span></button>`;
      }).join('');
      return `<section class="card card-b stack" style="gap:14px"><div class="row between"><h3>Change tactics</h3><button class="btn sm" data-act="m-panel" data-v="">Done</button></div>
        <div class="grid g-2" style="gap:16px;align-items:start">
          <div class="stack" style="gap:12px">
            <div class="ctl"><label for="m-formation">Formation</label><select id="m-formation" class="input" data-change="m-formation">${TL.formationOptions(t.formation)}</select><small class="muted">Players move to the best-fitting positions. Tap two players on the pitch to swap them.</small></div>
            <div class="ctl"><label>Mentality</label>${segs('mentality', [[-2, 'Very defensive'], [-1, 'Defensive'], [0, 'Balanced'], [1, 'Attacking'], [2, 'Very attacking']])}</div>
            <div class="ctl"><label>Pressing</label>${segs('press', [[0, 'Low block'], [1, 'Mid'], [2, 'High press']])}</div>
            <div class="ctl"><label>Tempo</label>${segs('tempo', [[0, 'Patient'], [1, 'Normal'], [2, 'Direct']])}</div>
          </div>
          <div class="pitch match-pitch"><span class="ln edge"></span><span class="ln half"></span><span class="ln circle"></span><span class="ln box-t"></span><span class="ln box-b"></span><span class="ln six-t"></span><span class="ln six-b"></span>${pitch}</div>
        </div></section>`;
    }
    const on = m.onPitch(k);
    const bench = S.bench.filter(id => !m.ps[id]);
    return `<section class="card card-b stack" style="gap:14px"><div class="row between"><h3>Substitution · ${S.subsLeft} left</h3><div class="row"><button class="btn sm" data-act="m-panel" data-v="">Cancel</button><button class="btn sm primary" data-act="m-dosub" ${M.subOut && M.subIn && S.subsLeft > 0 ? '' : 'disabled'}>Make substitution</button></div></div>
      <div class="sub-panel"><div><div class="eyebrow" style="margin-bottom:8px">Take off</div><div class="pick">${on.map(o => { const p = P(o.id), ps = m.ps[o.id]; return `<button class="${M.subOut === o.id ? 'on' : ''}" data-act="m-out" data-id="${o.id}">${posTag(o.pos)}<span class="grow">${esc(p.name)}</span><span class="muted num">${Math.round(ps.cond)}%</span></button>`; }).join('')}</div></div>
      <div><div class="eyebrow" style="margin-bottom:8px">Bring on</div><div class="pick">${bench.length ? bench.map(id => { const p = P(id); return `<button class="${M.subIn === id ? 'on' : ''}" data-act="m-in" data-id="${id}">${posTag(p.pos)}<span class="grow">${esc(p.name)}</span>${ovrTag(p.ovr)}</button>`; }).join('') : '<div class="muted">No substitutes left on the bench.</div>'}</div></div></div></section>`;
  }
  function updateMatch() {
    const M = ui.m; if (!M) return;
    const sb = $('#sb'); if (!sb) return;
    const ball = $('#ball');
    sb.innerHTML = sbHTML();
    const nb = $('#ball'); if (ball && nb) { nb.style.left = ball.style.left; nb.style.top = ball.style.top; requestAnimationFrame(() => { nb.style.left = M.ball + '%'; nb.style.top = M.ballY + '%'; }); }
    $('#feed').innerHTML = feedHTML();
    $('#mstats').innerHTML = statsHTML(M.match);
    $('#lineup').innerHTML = lineupHTML();
    const last = M.match.lines[M.match.lines.length - 1]; if (last && last.type !== 'flavour') $('#live-line').textContent = last.text;
    if (M.match.done) $('#ctl').innerHTML = ctlHTML();
  }
  const DELAY = { 1: 650, 2: 260, 3: 90 };
  function schedule(extra) {
    clearTimeout(ui.timer);
    const M = ui.m; if (!M || M.paused || M.match.done || ui.screen !== 'match') return;
    ui.timer = setTimeout(tick, DELAY[M.speed] + (extra || 0));
  }
  function tick() {
    const M = ui.m; if (!M || M.paused) return;
    const m = M.match;
    const evs = m.step();
    const big = evs.find(e => ['goal', 'save', 'miss', 'pen'].includes(e.type));
    if (evs.some(e => e.type === 'ht' || e.type === 'et')) { M.ball = 50; M.ballY = 50; }
    else if (big) { const side = big.side === 'home'; M.ball = big.type === 'goal' ? (side ? 97 : 3) : (side ? 88 : 12); M.ballY = 50 + (Math.random() - 0.5) * 30; }
    else { M.ball = m.lastAtk === 'home' ? 50 + Math.random() * 35 : 50 - Math.random() * 35; M.ballY = 20 + Math.random() * 60; }
    if (evs.some(e => e.type === 'ht' || e.type === 'et') && !m.done) { M.paused = true; M.panel = 'talk'; M.talkReaction = ''; M.atBreak = evs.some(e => e.type === 'et') ? 'et' : 'ht'; render(); return; }
    updateMatch();
    const pause = evs.some(e => e.type === 'goal') ? 1400 / M.speed : evs.some(e => ['red', 'pen', 'injury', 'pens'].includes(e.type)) ? 700 / M.speed : 0;
    const extra = M.p3d ? M.p3d.feed(evs, M.speed, m.lastAtk) : 0;
    if (!m.done) schedule(Math.max(pause, extra));
  }
  function startMatch(instant) {
    const f = currentFixture();
    const rng = new TL.Rng(G.rngS);
    const match = new TL.Match(G, f, rng, { userSide: sideOf(f) });
    if (ui.preTalk) TL.teamTalk(G, match, match.userSide, ui.preTalk, 'pre');
    ui.preTalk = '';
    ui.m = { match, rng, speed: settings.speed, paused: false, panel: null, subOut: null, subIn: null, ball: 50, ballY: 50 };
    if (!instant && settings.view3d !== false && TL.Pitch3D) ui.m.p3d = new TL.Pitch3D(match, match.userSide, settings.camera);
    if (instant) { match.runToEnd(); finishMatch(); return; }
    ui.screen = 'match'; render(); window.scrollTo(0, 0); schedule(400);
  }
  // Watch a U21 game live (same match screen; the result goes to the youth league/cup and a report)
  function startYouthWatch(key) {
    const set = TL.youthMatchSetup(G, key);
    if (!set) { toast('That U21 match has already been played.'); return; }
    const rng = new TL.Rng((G.rngS ^ (key * 2654435761)) >>> 0);
    const match = new TL.Match(G, set.fixture, rng, { userSide: set.userSide });
    ui.m = { match, rng, speed: settings.speed, paused: false, panel: null, subOut: null, subIn: null, ball: 50, ballY: 50, youth: key };
    if (settings.view3d !== false && TL.Pitch3D) ui.m.p3d = new TL.Pitch3D(match, set.userSide, settings.camera);
    ui.modal = null; ui.screen = 'match'; render(); window.scrollTo(0, 0); schedule(400);
  }
  function finishMatch() {
    const M = ui.m; clearTimeout(ui.timer); if (M.p3d) M.p3d.destroy();
    if (M.youth) {
      TL.finishYouthWatch(G, M.youth, M.match);
      ui.m = null; ui.screen = 'game'; ui.tab = 'academy';
      const c = me(), rep = c && c.u21Reports && c.u21Reports[0];
      ui.modal = rep ? { type: 'u21report', id: rep.id } : null;
      autosave(); render(); window.scrollTo(0, 0); return;
    }
    G.rngS = M.rng.s;
    ui.mq.done.push(M.match);
    ui.lastMatch = M.match;
    ui.m = null;
    ui.mq.i++;
    if (ui.mq.i < ui.mq.list.length) return nextInQueue();
    finishDay();
  }
  function finishDay() {
    const done = ui.mq ? ui.mq.done : [];
    const fixtures = done.map(m => m.f);
    TL.playDay(G, done);
    // match report mails for each human involved
    for (const f of fixtures) for (const id of [f.home, f.away]) {
      const i = TL.ownerIndex(G, id); if (i < 0) continue;
      TL.asManager(G, i, () => {
        const r = TL.userResult(G, f, id), mom = f.motm && P(f.motm);
        TL.addMail(G, 'assistant', `${{ W: 'Win', D: 'Draw', L: 'Defeat' }[r.res]}: ${T(f.home).name} ${f.hg}–${f.ag} ${T(f.away).name}${f.pens ? ` (${f.pens.home}–${f.pens.away} pens)` : ''}`,
          `${TL.compName(G, f)}. ${r.res === 'W' ? 'A good result.' : r.res === 'D' ? 'A point gained.' : 'A disappointing day.'} Expected goals: ${(f.stats[r.home ? 'home' : 'away'].xg).toFixed(2)} to ${(f.stats[r.home ? 'away' : 'home'].xg).toFixed(2)}.${mom ? `\n\nPlayer of the match: ${mom.name}.` : ''}`);
        G.inbox[0].read = true;
      });
    }
    const last = ui.lastMatch;
    ui.post = last ? { fid: last.f.id, match: last, owner: G.active } : null;
    ui.mq = null;
    autosave();
    ui.screen = ui.post ? 'post' : 'game';
    render(); window.scrollTo(0, 0);
  }

  /* ---------- Post-match ---------- */
  function postTalkSection(f, teamId, m) {
    const done = ui.post.talk;
    if (done) return `<section class="card card-b stack" style="gap:10px"><h3>Dressing room</h3>
      <div class="talk-reaction"><span class="muted" style="font-weight:400">${/^You /.test(done.opt.quote) ? esc(done.opt.quote) : `“${esc(done.opt.quote)}”`}</span><br>${esc(done.out.react)}</div>
      ${done.out.lines.length ? `<ul class="react-list">${done.out.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}</section>`;
    const info = TL.postTalkInfo(G, f, teamId, m);
    ui.post.info = info;
    return `<section class="card card-b stack" style="gap:12px"><div class="row between"><h3>Dressing room: post-match talk</h3><span class="muted" style="font-size:.8rem">Praise, blast or single players out</span></div>${talkCards(info, 'post-talk', null)}</section>`;
  }
  function viewPost() {
    const f = G.fixtures.find(x => x.id === ui.post.fid), m = ui.post.match;
    const H = T(f.home), A = T(f.away);
    const teamId = sideOf(f) === 'home' ? f.home : f.away;
    const r = TL.userResult(G, f, teamId);
    const others = G.fixtures.filter(x => x.comp === f.comp && x.date === f.date && x !== f && x.played);
    const ratingsTable = k => {
      const rows = Object.values(m.ps).filter(ps => ps.side === k).sort((a, b) => (b.starter - a.starter) || (b.rating - a.rating));
      return `<div class="tbl-wrap"><table class="tbl compact"><tbody>${rows.map(ps => { const p = P(ps.id); return p ? `<tr class="click" data-act="player" data-id="${ps.id}"><td>${posTag(p.pos)}</td><td><b>${esc(p.name)}</b>${ps.id === m.motm ? ' <span class="tag" style="background:var(--accent);color:var(--accent-ink)">MOTM</span>' : ''}${ps.goals ? ' ⚽'.repeat(ps.goals) : ''}${ps.assists ? ` <span class="muted" style="font-size:.78rem">${ps.assists}A</span>` : ''}${ps.injured ? ' <span class="tag inj">Inj</span>' : ''}${ps.red ? ' <span class="tag inj">Red</span>' : ps.yellow ? ' <span class="tag sus">Y</span>' : ''}${!ps.starter ? ` <span class="faint" style="font-size:.78rem">${ps.on}'</span>` : ''}</td><td class="r">${ratingTag(ps.rating)}</td></tr>` : ''; }).join('')}</tbody></table></div>`;
    };
    const goals = k => m.events.filter(e => e.type === 'goal' && e.side === k && e.scorer).map(e => `${esc(P(e.scorer) ? surname(P(e.scorer).name) : '')} ${e.disp}'`).join(', ');
    const col = r.res === 'W' ? 'var(--win)' : r.res === 'L' ? 'var(--loss)' : 'var(--muted)';
    const word = f.winner && f.leg === 2 ? (r.res === 'W' ? 'Through!' : 'Knocked out') : f.winner && f.ko ? (r.res === 'W' ? 'Through!' : 'Knocked out') : { W: 'Victory', D: 'Draw', L: 'Defeat' }[r.res];
    return `<div class="newc" style="max-width:1080px;padding-bottom:40px">
      <div class="page-h"><div><div class="eyebrow">${esc(TL.compName(G, f))} · Attendance ${(f.att || 0).toLocaleString('en-GB')}</div><h1 class="display" style="font-size:2rem;text-transform:uppercase;color:${col}">${word}</h1></div><div class="row">${ui.post.pressDone ? '' : `<button class="btn" data-act="press">${ICON.mic} Press conference</button>`}<button class="btn primary big" data-act="post-done">Continue ${ICON.play}</button></div></div>
      <section class="card"><div class="scoreboard"><div class="sb-team">${crest(H, 56)}<div><b>${esc(H.name)}</b>${venueTag(f, H.id)}</div></div><div class="sb-score"><div class="sc">${f.hg}<span class="faint"> – </span>${f.ag}</div><span class="min ft">${f.pens ? 'PENS' : f.et ? 'AET' : 'FT'}</span>${f.pens ? `<div class="muted" style="font-size:.8rem;margin-top:4px">Penalties ${f.pens.home}–${f.pens.away}</div>` : ''}${f.leg === 2 ? `<div class="muted" style="font-size:.8rem;margin-top:4px">Aggregate ${f.hg + (f.aggHome || 0)}–${f.ag + (f.aggAway || 0)}</div>` : ''}</div><div class="sb-team away">${crest(A, 56)}<div><b>${esc(A.name)}</b>${venueTag(f, A.id)}</div></div></div>
        <div class="scorers"><div>${goals('home')}</div><div>${goals('away')}</div></div></section>
      ${postTalkSection(f, teamId, m)}
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h3>Match stats</h3></div><div class="card-b">${statsHTML(m)}</div></section>
        <section class="card"><div class="card-h"><h3>Other results</h3></div>${others.length ? `<div class="tbl-wrap"><table class="tbl compact"><tbody>${others.map(x => `<tr><td class="r" style="width:42%">${esc(teamName(x.home))}</td><td class="c"><b class="display">${x.hg} – ${x.ag}</b>${x.pens ? '<div class="faint" style="font-size:.7rem">pens</div>' : ''}</td><td style="width:42%">${esc(teamName(x.away))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No other matches in this competition today.</div>'}</section>
      </div>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h3>${esc(H.name)} ratings</h3></div>${ratingsTable('home')}</section>
        <section class="card"><div class="card-h"><h3>${esc(A.name)} ratings</h3></div>${ratingsTable('away')}</section>
      </div></div>`;
  }

  /* ---------- Season review ---------- */
  function viewSeason() {
    if (ui.seasonRes) return viewSeasonReport();
    const m = G.manager, c = me();
    const lgId = c ? c.leagueId : (G.leagueDefs[0] || {}).id;
    const lg = TL.leagueDef(G, lgId);
    const tbl = TL.table(G, lgId);
    const row = c ? tbl.find(r => r.id === c.id) : null;
    const target = m.board.target;
    const champs = Object.values(G.comps).filter(x => x.winner && x.type !== 'league').map(x => `<div class="row between" style="padding:5px 0;border-bottom:1px solid var(--line-soft)"><span>${esc(x.name)}</span><span class="team">${crest(T(x.winner), 18)}<b>${esc(teamName(x.winner))}</b></span></div>`).join('');
    const leagues = G.leagueDefs.map(l => { const t = TL.table(G, l.id); return `<div class="row between" style="padding:5px 0;border-bottom:1px solid var(--line-soft)"><span>${esc(l.name)}</span><span class="team">${crest(G.clubs[t[0].id], 18)}<b>${esc(G.clubs[t[0].id].name)}</b></span></div>`; }).join('');
    const a = TL.seasonAwards(G, lgId);
    const award = (ic, title, id, val) => { const p = id && P(id); return p ? `<div class="award"><span class="ic">${ICON[ic]}</span><div style="flex:1;min-width:0"><div class="eyebrow">${title}</div><b>${esc(p.name)}</b> <span class="muted">· ${esc(clubName(p.clubId))}</span></div><b class="display" style="font-size:1.2rem">${val(p)}</b></div>` : ''; };
    const tos = TL.teamOfSeason(G, lgId);
    let verdict = '';
    if (row) {
      const promo = lg.tier > 1 && lg.country === 'ENG' && row.pos <= 2, releg = lg.country === 'ENG' && lg.tier < 3 && row.pos > tbl.length - 3;
      const cls = row.pos <= target ? 'good' : row.pos <= target + 3 && !releg ? 'ok' : 'bad';
      verdict = `<div class="verdict ${cls}"><div class="big-num">${TL.ordinal(row.pos)}</div><div style="flex:1;min-width:220px"><b class="display" style="font-size:1.25rem">${tbl[0].id === c.id ? 'Champions! You won the league.' : promo ? 'Promoted!' : releg ? 'Relegated. The board is furious.' : cls === 'good' ? 'Target achieved. The board is delighted.' : cls === 'ok' ? 'Just short of the target.' : 'A disappointing season.'}</b><div class="muted">Objective: ${esc(TL.targetText(G, c.id, target))} · ${row.pts} points · ${row.w}W ${row.d}D ${row.l}L</div></div></div>`;
    }
    return `<div class="newc" style="max-width:1080px;padding-bottom:40px">
      <div class="page-h"><div><div class="eyebrow">${esc(lg ? lg.name : '')} · ${seasonLabel(G.season)}</div><h1 class="display" style="font-size:2rem;text-transform:uppercase">Season review</h1></div><button class="btn primary big" data-act="next-season">Start ${seasonLabel(G.season + 1)} ${ICON.play}</button></div>
      ${verdict}
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h3>Awards · ${esc(lg ? lg.name : '')}</h3></div><div class="card-b" style="padding-top:4px;padding-bottom:4px">
          ${award('boot', 'Golden Boot', a.goldenBoot, p => a.goalsOf(p) + ' goals')}${award('star', 'Player of the Season', a.playerOfSeason, p => avgR(p).toFixed(2))}${award('pass', 'Playmaker', a.playmaker, p => p.stats.assists + ' assists')}${award('glove', 'Golden Glove', a.goldenGlove, p => p.stats.cleanSheets + ' clean sheets')}${award('sprout', 'Young Player', a.youngPlayer, p => avgR(p).toFixed(2))}
        </div></section>
        <section class="card"><div class="card-h"><h3>Team of the Season</h3></div><div class="tbl-wrap"><table class="tbl compact"><tbody>${tos.map(x => `<tr class="click" data-act="player" data-id="${x.id}"><td>${posTag(x.pos)}</td><td><b>${esc(x.name)}</b> <span class="muted">${esc(clubName(x.club))}</span></td><td class="r">${x.avg.toFixed(2)}</td></tr>`).join('')}</tbody></table></div></section>
      </div>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h3>League champions</h3></div><div class="card-b">${leagues}</div></section>
        <section class="card"><div class="card-h"><h3>Cup &amp; international winners</h3></div><div class="card-b">${champs || '<div class="muted">No finals played.</div>'}</div></section>
      </div>
      <section class="card"><div class="card-h"><h3>Final table · ${esc(lg ? lg.name : '')}</h3></div><div class="tbl-wrap"><table class="tbl compact"><tbody>${tbl.map(r => `<tr class="${c && r.id === c.id ? 'me' : ''}"><td class="c">${r.pos}</td><td><span class="team">${crest(G.clubs[r.id], 18)}${esc(G.clubs[r.id].name)}</span></td><td class="r">${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="r"><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div></section>
    </div>`;
  }
  function viewSeasonReport() {
    const c = me();
    const dev = ui.seasonRes.dev;
    const key = c ? c.id : null;
    const li = (arr, fn) => { const out = (arr || []).map(fn).join(''); return out || '<div class="muted">None</div>'; };
    return `<div class="newc" style="max-width:860px;padding-bottom:40px">
      <div class="page-h"><div><div class="eyebrow">Close season</div><h1 class="display" style="font-size:2rem;text-transform:uppercase">Squad development</h1></div><button class="btn primary big" data-act="season-go">Go to ${seasonLabel(G.season)} ${ICON.play}</button></div>
      ${!c ? '<section class="card"><div class="empty">You are not managing a club, so there is no squad report.</div></section>' : `<div class="grid g-2">
        <section class="card card-b"><h3 style="margin-bottom:10px">Most improved</h3>${li((dev.improved[key] || []).sort((a, b) => b.d - a.d), x => P(x.id) ? `<div class="row between" style="padding:5px 0"><span>${esc(P(x.id).name)}</span><b style="color:var(--win)">+${x.d} → ${P(x.id).ovr}</b></div>` : '')}</section>
        <section class="card card-b"><h3 style="margin-bottom:10px">Declined</h3>${li(dev.declined[key], x => P(x.id) ? `<div class="row between" style="padding:5px 0"><span>${esc(P(x.id).name)}</span><b style="color:var(--loss)">${x.d} → ${P(x.id).ovr}</b></div>` : '')}</section>
        <section class="card card-b"><h3 style="margin-bottom:10px">Youth intake</h3>${li(dev.youth[key], id => P(id) ? `<div class="row between click" style="padding:5px 0;cursor:pointer" data-act="player" data-id="${id}"><span class="row" style="gap:8px">${posTag(P(id).pos)}${esc(P(id).name)} <span class="muted">${P(id).age}</span></span>${ovrTag(P(id).ovr)}</div>` : '')}</section>
        <section class="card card-b"><h3 style="margin-bottom:10px">Retired</h3>${li(dev.retired[key], n => `<div style="padding:5px 0">${esc(n)}</div>`)}</section>
      </div>`}</div>`;
  }

  /* ---------- Hot-seat handover ---------- */
  function viewHandover() {
    const m = G.manager;
    const t = me() || myNation();
    return `<div class="title-screen"><div class="title-card" style="text-align:center;align-items:center">
      <div class="eyebrow">Pass the device to</div>
      ${t ? crest(t, 80) : ''}
      <div class="wordmark" style="font-size:2.4rem">${esc(m.name)}</div>
      <div class="muted">${esc(t ? t.name : 'Unemployed')} · ${TL.fmtDate(G.date, true)}</div>
      <button class="btn primary big" data-act="handover-go">I'm ${esc(m.name)}, continue ${ICON.play}</button>
    </div></div>`;
  }

  /* ---------- Modal ---------- */
  function viewModal() {
    const md = ui.modal;
    let inner = '', cls = '';
    if (md.type === 'player') inner = viewPlayerModal(md.id);
    else if (md.type === 'club') inner = viewClubModal(md.id);
    else if (md.type === 'deal') inner = viewDealModal();
    else if (md.type === 'confirm') { cls = 'narrow'; inner = `<div class="modal-h"><h3>${esc(md.title)}</h3><button class="x" data-act="close" aria-label="Close">${ICON.close}</button></div><div class="modal-b stack" style="gap:18px"><p style="margin:0" class="muted">${esc(md.text)}</p><div class="row" style="justify-content:flex-end"><button class="btn" data-act="close">Cancel</button><button class="btn ${md.danger ? 'danger' : 'primary'}" data-act="confirm-yes">${esc(md.yes)}</button></div></div>`; }
    else if (U.modals[md.type]) { const r = U.modals[md.type](md); inner = r.html; cls = r.cls || ''; }
    return `<div class="modal-bg" data-act="bg-close"><div class="modal ${cls}" role="dialog" aria-modal="true">${inner}</div></div>`;
  }

  /* =========================================================
     RENDER, CONTINUE & EVENTS
     ========================================================= */
  const U = TL.UI = { views: {}, screens: {}, actions: {}, modals: {} };
  Object.assign(U.views, { home: viewHome, squad: viewSquad, tactics: viewTactics, transfers: viewTransfers, finances: viewFinances, staff: viewStaff, training: viewTraining, more: viewMore });
  Object.assign(U.screens, { splash: viewSplash, title: viewTitle, load: viewLoad, game: viewShell, prematch: viewPrematch, match: viewMatch, post: viewPost, season: viewSeason, handover: viewHandover });

  function render() {
    applySettings();
    const keepScroll = $('#content') ? $('#content').scrollTop : 0;
    const fn = U.screens[ui.screen] || viewTitle;
    let html;
    try { html = fn(); }
    catch (e) { logError(e.stack || e.message, 'render:' + ui.screen + '/' + ui.tab); html = `<div class="newc"><section class="card card-b"><h3>Something went wrong on this screen</h3><p class="muted">The error was saved to the local error log (Settings). Your career is safe.</p><button class="btn primary" data-act="tab" data-v="home">Back to home</button></section></div>`; }
    $('#app').innerHTML = html + (ui.modal ? viewModal() : '');
    if (ui.screen === 'match' && ui.m && ui.m.p3d) ui.m.p3d.attach($('#p3d-c'));
    if (ui.keepScroll && $('#content')) $('#content').scrollTop = keepScroll;
    ui.keepScroll = false;
  }
  const soft = () => { ui.keepScroll = true; render(); };

  // Time moves one day per press. "Skip" keeps going day by day until a match, important news or a decision.
  function doContinue(skip) {
    if (TL.seasonOver(G)) { ui.screen = 'season'; ui.seasonRes = null; render(); window.scrollTo(0, 0); return; }
    if (TL.humanFixturesToday(G).length) return startMatchday();
    // Hot-seat: each manager ends their turn before the calendar moves
    if (G.managers.length > 1 && G.active < G.managers.length - 1) { G.active++; ui.screen = 'handover'; ui.handNext = 'game'; ui.tab = 'home'; render(); return; }
    const marks = G.managers.map(m => m.inbox[0] ? m.inbox[0].id : 0);
    const needsYou = () => G.managers.some((m, i) => m.inbox.some(x => x.id > marks[i] && (x.important || x.action)));
    let r = 'moved', days = 0;
    do { r = TL.advance(G, 1); days++; } while (skip && r === 'moved' && days < 30 && !needsYou());
    if (G.managers.length > 1) { G.active = 0; ui.screen = 'handover'; ui.handNext = 'game'; } else ui.screen = 'game';
    if (r !== 'moved' || (skip && needsYou())) ui.tab = 'home';
    ui.mailOpen = null;
    autosave();
    render();
    if (r === 'matchday') toast('Matchday! Press Go to match when you are ready.');
    else if (r === 'season') toast('The season is over. Press Season review.');
    else if (skip) toast(needsYou() ? 'Stopped: something needs your attention.' : `Moved on ${days} day${days > 1 ? 's' : ''}.`);
    else if (needsYou()) toast('New message needs your attention.');
  }

  const actions = {
    title() { const go = () => { G = null; ui.unsaved = false; ui.screen = 'title'; ui.modal = null; render(); }; if (G && ui.unsaved) ask('Leave without saving?', 'You have unsaved progress since your last save. It will be lost.', 'Leave without saving', go, true); else go(); },
    'go-load'() { ui.screen = 'load'; render(); },
    load(d) { loadSlot(+d.slot); },
    'del-slot'(d) { ask('Delete this career?', 'The save in slot ' + d.slot + ' will be removed from this device. This cannot be undone.', 'Delete', () => { delData(KEY + 'slot' + d.slot); delData(KEY + 'slot' + d.slot + ':bak'); const m = meta(); delete m[d.slot]; store.set(KEY + 'meta', JSON.stringify(m)); if (store.get(KEY + 'last') === d.slot) store.del(KEY + 'last'); toast('Career deleted'); }, true); },
    tab(d) { if (ui.screen !== 'game') ui.screen = 'game'; ui.tab = d.v; ui.modal = null; ui.tactSel = null; render(); const c = $('#content'); if (c) c.scrollTop = 0; },
    continue() { doContinue(false); },
    skip() { doContinue(true); },
    'news-f'(d) { ui.newsF = d.v; soft(); },
    'u21-watch'(d) { startYouthWatch(+d.key); },
    'splash-skip'() { clearTimeout(splashTimer); ui.screen = 'title'; render(); },
    save() { manualSave(); },
    'scout-pause-all'() { const o = me().orders; o.scoutPaused = !o.scoutPaused; toast(o.scoutPaused ? 'Scouting paused until you resume it.' : 'Scouting resumed. Reports arrive next Monday.'); autosave(); soft(); },
    'scout-pause-chief'() { const o = me().orders; o.chiefPaused = !o.chiefPaused; toast(o.chiefPaused ? 'Chief scout paused.' : 'Chief scout back at work.'); autosave(); soft(); },
    'scout-pause'(d) { const a = (me().scoutTeam || []).find(x => x.id === d.id); if (a) { a.paused = !a.paused; toast(a.paused ? `${G.staff[a.id].name} paused.` : `${G.staff[a.id].name} back at work.`); autosave(); } soft(); },
    'm-swap'(d) { const M = ui.m, i = +d.v; if (M.swapSel == null) M.swapSel = i; else { if (M.swapSel !== i) M.match.userSwap(M.swapSel, i); M.swapSel = null; } render(); },
    'hire-ascout'(d) { const x = TL.scoutCandidates(G, me())[+d.v]; ask(`Hire ${x.name}?`, `Assistant scout rated ${x.rating}/20 on ${wageTxt(x.wage)}, starting in ${TL.SCOUT_REGIONS[x.home]}. You can change his region and brief at any time.`, 'Hire', () => { toast(TL.hireAssistantScout(G, +d.v)); autosave(); }); },
    'fire-ascout'(d) { const st = G.staff[d.id]; ask(`Dismiss ${st.name}?`, `He leaves the scouting department. Compensation: ${fm(st.wage * 52 / 1000 * 0.25)}.`, 'Dismiss', () => { toast(TL.fireAssistantScout(G, d.id)); autosave(); }, true); },
    'u21-skip'(d) { const r = TL.resolveYouthPending(G, +d.key, null); if (!r) { toast('Already played.'); return; } const c = me(), rep = c.u21Reports && c.u21Reports[0]; autosave(); ui.modal = rep ? { type: 'u21report', id: rep.id } : null; render(); },
    'u21-report'(d) { ui.modal = { type: 'u21report', id: +d.id }; render(); },
    'unveil'(d) { ui.modal = { type: 'unveil', id: d.id, step: 'number' }; render(); },
    'mail-save'(d) { TL.saveMail(G, +d.id); ui.mailOpen = null; toast('Saved. Find it on the Manager screen.'); autosave(); soft(); },
    'mail-del'(d) { TL.deleteMail(G, +d.id); ui.mailOpen = null; ui.savedOpen = null; autosave(); soft(); },
    'mail-del-read'() { const n = G.inbox.filter(x => x.read).length; ask(`Delete ${n} read message${n > 1 ? 's' : ''}?`, 'Unread messages are kept. Save anything you want to keep first.', 'Delete', () => { TL.deleteReadMail(G); toast(`${n} message${n > 1 ? 's' : ''} deleted.`); autosave(); }, true); },
    'saved-open'(d) { ui.savedOpen = ui.savedOpen === +d.id ? null : +d.id; soft(); },
    'feeder-offer'(d) { toast(TL.respondFeederOffer(G, +d.id, d.how)); autosave(); soft(); },
    'loan-feeder'(d) { const p = P(d.id); ask(`Loan ${p.name} to ${TL.feederName(G, G.feeders.find(f => f.id === +d.f))}?`, 'He will play regular football at our feeder club and develop about 30% faster. You can recall him at any time.', 'Send on loan', () => { toast(TL.loanToFeeder(G, d.id, +d.f)); autosave(); }); },
    'recall'(d) { toast(TL.recallLoan(G, d.id)); autosave(); soft(); },
    'recall-club'(d) { const p = P(d.id); ask(`Recall ${p.name}?`, 'He comes straight back to your club.', 'Recall', () => { toast(TL.recallFromClub(G, d.id)); autosave(); }); },
    'loan-pick'(d) { ui.modal = { type: 'loan-pick', id: d.id }; render(); },
    'loan-to-club'(d) { const p = P(d.id), c = G.clubs[d.club]; ask(`Loan ${p.name} to ${c.name}?`, 'He spends the rest of the season there and plays real matches. You will get a report every month.', 'Agree loan', () => { toast(TL.loanToClub(G, d.id, d.club)); autosave(); }); },
    'loan-generic'(d) { const p = P(d.id); if (!TL.windowInfo(G).open) { toast('Loans to other clubs need an open transfer window. Feeder-club loans are allowed any time.'); return; } ask(`Loan ${p.name} to a lower-league club?`, 'He gets guaranteed football in a lower division, which speeds up his development. He returns in the summer.', 'Loan out', () => { const to = TL.loanOut(G, d.id); toast(`${p.name} joins ${to} on loan.`); autosave(); }); },
    'merch-open'(d) { ui.modal = { type: 'merch', id: d.id, pick: ['shirts', 'caps', 'cups'] }; render(); },
    'merch-toggle'(d) { const md = ui.modal, i = md.pick.indexOf(d.v); if (i >= 0) md.pick.splice(i, 1); else md.pick.push(d.v); soft(); },
    'merch-launch'() { const md = ui.modal; toast(TL.launchMerch(G, md.id, md.pick)); autosave(); render(); },
    'merch-end'(d) { ask('End this merchandise line?', 'The products are taken off sale.', 'End line', () => { toast(TL.endMerch(G, +d.id)); autosave(); }, true); },
    'post-talk'(d) {
      if (!ui.post || ui.post.talk) return;
      const f = G.fixtures.find(x => x.id === ui.post.fid), teamId = sideOf(f) === 'home' ? f.home : f.away;
      const o = (ui.post.info ? ui.post.info.options : []).find(x => x.id === d.v); if (!o) return;
      ui.post.talk = { opt: o, out: TL.postTalk(G, f, teamId, d.v, ui.post.match) };
      autosave(); soft();
    },
    'week-preset'(d) { me().training.week = Object.assign({}, TL.WEEK_PRESETS[d.v][1]); toast(`${TL.WEEK_PRESETS[d.v][0]} week plan set.`); soft(); },
    rehab(d) { const p = P(d.id); if ((p.rehab || 'standard') === d.v) return; const go = () => { toast(TL.setRehab(G, d.id, d.v)); autosave(); }; if (d.v === 'rush') ask(`Rush ${p.name} back?`, TL.REHAB.rush.desc, 'Give him painkillers', go, true); else { go(); soft(); } },
    'handover-go'() { ui.screen = ui.handNext || 'game'; render(); window.scrollTo(0, 0); },
    mail(d) { const id = +d.id; ui.mailOpen = ui.mailOpen === id ? null : id; const m = G.inbox.find(x => x.id === id); if (m) m.read = true; soft(); },
    'mail-all'() { ui.mailAll = !ui.mailAll; soft(); },
    player(d) { ui.modal = { type: 'player', id: d.id }; render(); },
    'club-modal'(d) { ui.modal = { type: 'club', id: d.id }; render(); },
    close() { ui.modal = null; confirmFn = null; soft(); },
    'bg-close'(d, el, e) { if (e.target === el) { ui.modal = null; soft(); } },
    'confirm-yes'() { const fn = confirmFn; ui.modal = null; confirmFn = null; if (fn) fn(); render(); },
    'sq-filter'(d) { ui.squadFilter = d.v; soft(); },
    sort(d) { if (ui.sort.k === d.k) ui.sort.d *= -1; else ui.sort = { k: d.k, d: 1 }; soft(); },
    slot(d) { const s = { kind: 'slot', i: +d.i }; if (!ui.tactSel) ui.tactSel = s; else if (ui.tactSel.kind === 'slot' && ui.tactSel.i === s.i) ui.tactSel = null; else { lineupAssign(ui.tactSel, s); ui.tactSel = null; } soft(); },
    'pl-pick'(d) { const s = { kind: 'player', id: d.id }; if (!ui.tactSel) ui.tactSel = s; else if (ui.tactSel.kind === 'player' && ui.tactSel.id === d.id) ui.tactSel = null; else { lineupAssign(ui.tactSel, s); ui.tactSel = null; } soft(); },
    'auto-pick'() { TL.autoLineup(G, tacticsTeam()); ui.tactSel = null; toast('Best available XI selected'); soft(); },
    tact(d) { tacticsTeam().tactics[d.k] = +d.v; soft(); },
    tteam(d) { ui.tteam = d.v; ui.tactSel = null; soft(); },
    captain(d) { const c = me(); if (c.captain !== d.id) { c.vice = c.captain; c.captain = d.id; toast(`${P(d.id).name} is the new captain.`); } soft(); },
    promise(d) { const p = P(d.id); p.requested = false; p.benchRun = 0; p.morale = Math.min(100, p.morale + 10); p.promiseBy = TL.addDays(G.date, 45); toast(`You promised ${p.name} more football. Keep your word or he will ask to leave again.`); soft(); },
    'back-game'() { ui.screen = 'game'; render(); },
    'edit-tactics'() { ui.screen = 'game'; ui.tab = 'tactics'; const f = currentFixture(); if (f && myNation() && (f.home === myNation().id || f.away === myNation().id)) ui.tteam = 'nation'; else ui.tteam = 'club'; render(); },
    'pre-talk'(d) { ui.preTalk = ui.preTalk === d.v ? '' : d.v; soft(); },
    kickoff() { startMatch(false); },
    instant() { startMatch(true); },
    'm-pause'() { ui.m.paused = !ui.m.paused; if (!ui.m.paused) { ui.m.panel = null; ui.m.atBreak = null; } render(); if (!ui.m.paused) schedule(); },
    'm-speed'(d) { ui.m.speed = +d.v; render(); schedule(); },
    'm-panel'(d) { if (!d.v) ui.m.atBreak = null; ui.m.panel = d.v || null; ui.m.subOut = null; ui.m.subIn = null; ui.m.talkReaction = ''; ui.m.paused = !!ui.m.panel; render(); schedule(); },
    'm-out'(d) { ui.m.subOut = d.id; render(); },
    'm-in'(d) { ui.m.subIn = d.id; render(); },
    'm-dosub'() { const M = ui.m; if (M.match.userSub(M.subOut, M.subIn)) { M.subOut = null; M.subIn = null; if (M.match.sides[M.match.userSide].subsLeft <= 0) { M.panel = null; M.paused = false; } } render(); schedule(); },
    'm-tact'(d) { const t = {}; t[d.k] = +d.v; ui.m.match.userTactics(t); render(); },
    'm-talk'(d) {
      const M = ui.m, min = M.match.minute;
      if (d.phase === 'live' && M.lastShout != null && min - M.lastShout < 10) { toast(`The players can't keep hearing you. Wait ${10 - (min - M.lastShout)} more minutes.`); return; }
      if (d.phase === 'ht' && M.htTalk === min) { toast("You've already had your say. Let them get back out there."); return; }
      if (d.phase === 'live') M.lastShout = min; else M.htTalk = min;
      M.talkReaction = TL.teamTalk(G, M.match, M.match.userSide, d.v, d.phase); render();
    },
    'm-3d'() { const M = ui.m; if (M.p3d) { M.p3d.destroy(); M.p3d = null; settings.view3d = false; } else { M.p3d = new TL.Pitch3D(M.match, M.match.userSide, settings.camera); settings.view3d = true; } saveSettings(); render(); },
    'm-cam'(d) { const M = ui.m; if (M.p3d) { M.p3d.setCamera(d.v); settings.camera = d.v; saveSettings(); document.querySelectorAll('.p3d-cams button').forEach(b => b.classList.toggle('on', b.dataset.v === d.v)); } },
    'm-skip'() { const M = ui.m; clearTimeout(ui.timer); M.match.runToEnd(); M.paused = true; M.panel = null; render(); },
    'match-done'() { finishMatch(); },
    'post-done'() { ui.post = null; if (G.managers.length > 1) { ui.screen = 'handover'; ui.handNext = 'game'; } else ui.screen = 'game'; ui.tab = 'home'; render(); },
    press() {
      if (ui.post.pressQs) { ui.modal = ui.post.pressQs; render(); return; } // reopen where you left off
      const f = G.fixtures.find(x => x.id === ui.post.fid), teamId = sideOf(f) === 'home' ? f.home : f.away;
      ui.modal = ui.post.pressQs = { type: 'press', qs: TL.pressConference(G, f, ui.post.match), i: 0, fid: f.id, teamId };
      render();
    },
    'next-season'() { ui.seasonRes = TL.endSeason(G); autosave(); render(); window.scrollTo(0, 0); },
    'season-go'() { ui.seasonRes = null; ui.screen = G.managers.length > 1 ? 'handover' : 'game'; ui.handNext = 'game'; G.active = 0; ui.tab = 'home'; render(); },
    // transfers, finances, staff, training
    tsub(d) { ui.tsub = d.v; soft(); },
    shortlist(d) { const i = G.shortlist.indexOf(d.id); if (i >= 0) G.shortlist.splice(i, 1); else G.shortlist.push(d.id); toast(i >= 0 ? 'Removed from shortlist' : 'Added to shortlist'); soft(); },
    scout(d) { const days = TL.requestScout(G, d.id); if (days) toast(`Your chief scout will report back in ${days} days.`); soft(); },
    'deal-open'(d) { openDeal(d.id, d.mode); },
    'deal-bid'() { dealBid(false); },
    'deal-clause'() { dealBid(true); },
    'deal-contract'() { dealContract(); },
    'list-toggle'(d) { const p = P(d.id); p.listed = !p.listed; if (p.listed) p.morale = Math.max(5, p.morale - 5); toast(p.listed ? `${p.name} is on the transfer list. Clubs will be told he is available.` : `${p.name} removed from the transfer list.`); soft(); },
    'loan-out'(d) { const p = P(d.id); ask('Loan out ' + p.name + '?', 'He will spend the rest of the season away getting regular football, which speeds up his development. He returns in the summer.', 'Loan out', () => { const to = TL.loanOut(G, d.id); toast(`${p.name} joins ${to} on loan.`); autosave(); }); },
    release(d) { const p = P(d.id); const pay = p.contract ? p.contract.wage * 52 / 1000 * TL.contractYearsLeft(G, p) * 0.5 : 0; ask('Release ' + p.name + '?', `He leaves as a free agent. You pay ${fm(pay)} in compensation (half his remaining contract).`, 'Release', () => { TL.releasePlayer(G, d.id); toast(`${p.name} has been released.`); autosave(); }, true); },
    'offer-resp'(d) { const msg = TL.respondOffer(G, +d.id, d.how); toast(msg); autosave(); soft(); },
    ticket(d) { const c = me(); c.ticketPrice = Math.max(1, (c.ticketPrice || TL.basePrice(c)) + (+d.v)); soft(); },
    train(d) { me().training[d.k] = d.k === 'intensity' ? +d.v : d.v; soft(); },
    'staff-role'(d) { ui.staffRole = d.v; ui.tab = 'staff'; soft(); },
    'fire-staff'(d) { const s = G.staff[me().staffIds[d.role]]; const comp = s.wage * 52 / 1000 * 0.5 * Math.max(1, s.end - G.season + 1); ask(`Dismiss ${s.name}?`, `The ${TL.STAFF_ROLES[d.role].toLowerCase()} role will be vacant until you hire someone. Compensation: ${fm(comp)}.`, 'Dismiss', () => { TL.fireStaff(G, d.role); toast(`${s.name} has left the club.`); autosave(); }, true); },
    'hire-staff'(d) { const s = G.staff[d.id]; const cur = G.staff[me().staffIds[s.role]]; ask(`Hire ${s.name}?`, `${TL.STAFF_ROLES[s.role]}, rated ${s.rating}/20, on ${wageTxt(TL.staffWage(s.rating, me()))} for two years.${cur ? ` ${cur.name} (rated ${cur.rating}) will be paid off with ${fm(cur.wage * 52 / 1000 * 0.5 * Math.max(1, cur.end - G.season + 1))}.` : ''}`, 'Hire', () => { TL.hireStaff(G, d.id); toast(`${s.name} joins as ${TL.STAFF_ROLES[s.role].toLowerCase()}.`); autosave(); }); },
    'take-job'(d) { ask('Accept this job?', 'You will start immediately.', 'Accept', () => { const msg = TL.takeJob(G, +d.id); toast(msg); ui.tab = 'home'; autosave(); }); },
    theme(d) { settings.theme = d.v; saveSettings(); soft(); }
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.tagName === 'A') e.preventDefault();
    const fn = actions[el.dataset.act] || U.actions[el.dataset.act];
    if (fn) { if (el.dataset.act !== 'bg-close') e.stopPropagation(); try { fn(el.dataset, el, e); } catch (err) { logError(err.stack || err.message, 'action:' + el.dataset.act); toast('Something went wrong. The error was logged.'); } }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'imp-file' && t.files && t.files[0]) { importSave(t.files[0]); t.value = ''; return; }
    const ch = t.dataset.change;
    if (ch === 'formation') { changeFormation(t.value); soft(); }
    else if (ch === 'tfocus') { const p = P(t.dataset.id); p.trainFocus = t.value || null; toast(t.value ? `${p.name} will focus on ${TL.ATTR_LABEL[t.value].toLowerCase()}.` : `${p.name} has no individual focus.`); }
    else if (ch === 'staff-role') { ui.staffRole = t.value; soft(); }
    else if (ch === 'workload') { const p = P(t.dataset.id); p.workload = t.value === 'normal' ? null : t.value; toast(`${p.name}: ${TL.WORKLOADS[t.value].toLowerCase()} workload.`); }
    else if (ch === 'order') { me().orders[t.dataset.k] = t.value; me()._tb = null; toast('Instruction given.'); soft(); }
    else if (ch === 'week') { const c = me(); c.training.week[t.dataset.k] = t.value; soft(); }
    else if (ch === 'scout-region' || ch === 'scout-focus') { const a = (me().scoutTeam || []).find(x => x.id === t.dataset.id); if (a) { a[ch === 'scout-region' ? 'region' : 'focus'] = t.value; toast('Instructions given.'); } }
    else if (ch === 'm-formation' && ui.m) { ui.m.match.userFormation(t.value); ui.m.swapSel = null; toast(`Switched to ${t.value}.`); render(); }
    else if (ch === 'train-auto') { me().training[t.dataset.k] = t.checked; soft(); }
    else if (ch === 'captain') { me().captain = t.value; toast(`${P(t.value).name} is the new captain.`); soft(); }
    else if (ch === 'vice') { me().vice = t.value; soft(); }
    else if (ch === 'mentor') { const p = P(t.dataset.id); p.mentor = t.value || null; toast(t.value ? `${P(t.value).name} will mentor ${p.name}.` : 'Mentor removed.'); }
    else if (ch && U.actions['change:' + ch]) U.actions['change:' + ch](t);
    if (t.dataset.tf) { const k = t.dataset.tf; ui.tf[k] = t.type === 'checkbox' ? t.checked : (k === 'q' || k === 'pos' || k === 'league') ? t.value : +t.value; soft(); }
  });
  document.addEventListener('input', e => { const t = e.target; if (t.dataset.input && U.actions['input:' + t.dataset.input]) U.actions['input:' + t.dataset.input](t); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && ui.modal) { ui.modal = null; soft(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); manualSave(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.dataset.act) { e.preventDefault(); e.target.click(); return; }
    const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
    if (typing) return;
    if (ui.screen === 'splash') { actions['splash-skip'](); return; }
    if (e.code === 'Space' && ui.screen === 'game' && !ui.modal) { e.preventDefault(); doContinue(false); }
    if (e.code === 'KeyS' && ui.screen === 'game' && !ui.modal && !e.ctrlKey && !e.metaKey) { e.preventDefault(); doContinue(true); }
    if (e.code === 'Space' && ui.screen === 'match' && ui.m && !ui.m.match.done) { e.preventDefault(); actions['m-pause'](); }
  });
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (settings.theme === 'system') applySettings(); }); } catch (e) { /* older engines */ }
  window.addEventListener('resize', () => { if (ui.m && ui.m.p3d) ui.m.p3d.resize(); });
  // warn before closing with unsaved progress (nothing is saved automatically on exit)
  window.addEventListener('beforeunload', e => { if (G && ui.unsaved) { e.preventDefault(); e.returnValue = ''; } });
  if ('serviceWorker' in navigator && location.protocol === 'https:') { navigator.serviceWorker.register('sw.js').catch(() => {}); }

  // Shared toolkit for the other UI modules
  Object.defineProperty(U, 'G', { get() { return G; }, set(v) { G = v; } });
  Object.assign(U, {
    core: actions, doContinue, ui, saveFileText, loadSaveText, manualSave, settings, saveSettings, applySettings, render, soft, toast, ask, esc, $, me, myNation, P, T, crest, kitSvg, ICON, ICONS_SVG,
    fm, wageTxt, seasonLabel, posTag, ovrTag, ratingTag, condBar, statusTags, formPills, ablTxt, potTxt, clubName, teamName, avgR, surname, moraleWord, fanWord,
    meta, saveGame, autosave, exportSave, importSave, loadSlot, store, readJSON, KEY, SLOTS, needClub, logError, tabsFor, inkOn, lastResultCard
  });
  TL.app = { get state() { return G; }, ui };
  document.addEventListener('DOMContentLoaded', render);
  if (document.readyState !== 'loading') setTimeout(render, 0);
})();
