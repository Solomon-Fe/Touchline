/* Touchline Management — cloud saves with your Google account.
   Careers are stored in the hidden app folder of your own Google Drive (only this game can see them),
   so you can continue on any device where you sign in with the same Gmail.
   Needs: an internet connection, the game opened from a web address (https:// or http://localhost),
   and a Google OAuth Client ID that you create once (see the setup guide). */
(function () {
  const TL = window.TL, U = TL.UI;
  const { esc, ui, toast, ICON } = U;
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email';
  const C = TL.Cloud = { token: null, exp: 0, files: null, busy: '', err: '' };
  try { const t = JSON.parse(sessionStorage.getItem('tm:gtok') || 'null'); if (t && t.e > Date.now()) { C.token = t.t; C.exp = t.e; } } catch (e) { /* storage blocked */ }

  C.supported = () => location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  C.clientId = () => (U.settings.googleClientId || '').trim();
  C.signedIn = () => !!(C.token && Date.now() < C.exp);
  C.loadGis = () => new Promise((res, rej) => {
    if (window.google && google.accounts && google.accounts.oauth2) return res();
    const sc = document.createElement('script');
    sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
    sc.onload = () => res(); sc.onerror = () => rej(new Error('Could not reach Google. Check your internet connection.'));
    document.head.appendChild(sc);
  });
  C.signIn = async silent => {
    if (!C.clientId()) throw new Error('Add your Google Client ID first (see the setup guide).');
    await C.loadGis();
    await new Promise((res, rej) => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: C.clientId(), scope: SCOPE,
        callback: r => { if (r.error) return rej(new Error(r.error_description || r.error)); C.token = r.access_token; C.exp = Date.now() + (r.expires_in - 60) * 1000; try { sessionStorage.setItem('tm:gtok', JSON.stringify({ t: C.token, e: C.exp })); } catch (e) { /* ignore */ } res(); },
        error_callback: e => rej(new Error(e && e.type === 'popup_closed' ? 'Sign-in window was closed.' : (e && e.message) || 'Sign-in failed.'))
      });
      tc.requestAccessToken({ prompt: silent ? '' : 'select_account' });
    });
  };
  C.api = async (url, opts, retried) => {
    if (!C.signedIn()) await C.signIn(true);
    opts = opts || {};
    const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({}, opts.headers || {}, { Authorization: 'Bearer ' + C.token }) }));
    if (r.status === 401 && !retried) { C.token = null; await C.signIn(true); return C.api(url, opts, true); }
    if (!r.ok) throw new Error(`Google Drive error ${r.status}`);
    return r;
  };
  C.whoami = async () => { const j = await (await C.api('https://www.googleapis.com/oauth2/v3/userinfo')).json(); U.settings.cloudEmail = j.email || ''; U.saveSettings(); };
  C.list = async () => { const j = await (await C.api('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=50&fields=files(id,name,modifiedTime,size,appProperties)')).json(); C.files = (j.files || []).sort((a, b) => a.modifiedTime < b.modifiedTime ? 1 : -1); return C.files; };
  C.upload = async (name, text, props) => {
    const existing = (C.files || await C.list()).find(f => f.name === name);
    const metaObj = existing ? { appProperties: props } : { name, parents: ['appDataFolder'], appProperties: props };
    const b = 'tm' + Date.now();
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metaObj)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${b}--`;
    await C.api(existing ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart` : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: existing ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body });
    await C.list();
  };
  C.download = async id => (await C.api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)).text();
  C.remove = async id => { await C.api(`https://www.googleapis.com/drive/v3/files/${id}`, { method: 'DELETE' }); await C.list(); };
  C.signOut = () => { try { if (C.token && window.google) google.accounts.oauth2.revoke(C.token, () => {}); } catch (e) { /* ignore */ } C.token = null; C.files = null; try { sessionStorage.removeItem('tm:gtok'); } catch (e) { /* ignore */ } U.settings.cloudEmail = ''; U.saveSettings(); };
  // Upload the career that is open now (each career has its own file in the cloud)
  C.uploadCurrent = async () => {
    const G = U.G; if (!G) throw new Error('Open a career first.');
    G.careerId = G.careerId || ('c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const club = U.me() || U.myNation();
    await C.upload(`tm-${G.careerId}.tlsave`, await U.saveFileText(), { club: club ? club.name : 'Unemployed', manager: G.manager.name, season: String(G.season), date: G.date, careerId: G.careerId });
    U.settings.cloudLast = new Date().toISOString(); U.saveSettings();
  };
  // After every save: upload too, if you turned that on and you are signed in
  U.afterSave = () => { if (U.settings.cloudAuto && C.supported() && C.signedIn()) C.uploadCurrent().then(() => toast('Saved to Google Drive')).catch(e => toast('Cloud upload failed: ' + e.message)); };

  /* ---------- UI ---------- */
  const fmtTime = iso => { try { return new Date(iso).toLocaleString(TL.locale || 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } };
  U.cloudSection = () => {
    const s = U.settings;
    const head = `<h3>Cloud save (Google Drive)</h3>`;
    if (!C.supported()) return `<section class="card card-b stack" style="gap:10px">${head}
      <p class="muted" style="margin:0;font-size:.88rem">Cloud saves work when the game is opened from its web address (for example <b>https://yourname.github.io/touchline/</b>), on your phone or on your PC. This copy runs from a file on this computer, so Google sign-in is not possible here.</p>
      <p class="muted" style="margin:0;font-size:.88rem">Until then, use <b>Export save file</b> and <b>Import save file</b> to move a career between devices.</p></section>`;
    if (!C.clientId()) return `<section class="card card-b stack" style="gap:10px">${head}
      <p class="muted" style="margin:0;font-size:.88rem">One-time setup: create a free Google Client ID (the setup guide explains how, about 10 minutes) and paste it here.</p>
      <div class="row" style="gap:8px"><input class="input" style="flex:1;min-width:200px" id="cloud-client" placeholder="1234567890-abc.apps.googleusercontent.com"><button class="btn primary" data-act="cloud-client-save">Save Client ID</button></div></section>`;
    if (!C.signedIn()) return `<section class="card card-b stack" style="gap:10px">${head}
      <p class="muted" style="margin:0;font-size:.88rem">${s.cloudEmail ? `Last signed in as <b>${esc(s.cloudEmail)}</b>. ` : ''}Sign in with your Google account to save careers to your Drive and continue on any device.</p>
      <div class="row"><button class="btn primary" data-act="cloud-signin" ${C.busy ? 'disabled' : ''}>${C.busy ? 'Connecting…' : 'Sign in with Google'}</button><button class="btn sm ghost" data-act="cloud-client-reset">Change Client ID</button></div>
      ${C.err ? `<div style="color:var(--loss);font-size:.85rem">${esc(C.err)}</div>` : ''}</section>`;
    const files = C.files || [];
    return `<section class="card stack" style="gap:0"><div class="card-h">${head}<div class="row"><span class="muted" style="font-size:.82rem">${esc(s.cloudEmail || 'Signed in')}</span><button class="btn sm ghost" data-act="cloud-signout">Sign out</button></div></div>
      <div class="card-b stack" style="gap:10px">
        <div class="row">${U.G ? `<button class="btn primary" data-act="cloud-upload" ${C.busy ? 'disabled' : ''}>${C.busy === 'up' ? 'Uploading…' : 'Upload this career'}</button>` : ''}<button class="btn" data-act="cloud-refresh" ${C.busy ? 'disabled' : ''}>Refresh</button>
          <label class="check"><input type="checkbox" data-change="cloud-auto" ${s.cloudAuto ? 'checked' : ''}> Upload automatically every time I save</label></div>
        ${s.cloudLast ? `<div class="muted" style="font-size:.8rem">Last upload from this device: ${fmtTime(s.cloudLast)}</div>` : ''}
        ${C.err ? `<div style="color:var(--loss);font-size:.85rem">${esc(C.err)}</div>` : ''}
      </div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Career in the cloud</th><th>Game date</th><th>Uploaded</th><th></th></tr></thead><tbody>
        ${files.map(f => { const p = f.appProperties || {}; const here = U.G && U.G.careerId && p.careerId === U.G.careerId; return `<tr><td><b>${esc(p.manager || '?')}</b> · ${esc(p.club || '')}${here ? ' <span class="tag yth">Open now</span>' : ''}</td><td class="muted">${p.season ? `${p.season}/${String(+p.season + 1).slice(2)} · ` : ''}${p.date ? TL.fmtDate(p.date, true) : ''}</td><td class="muted">${fmtTime(f.modifiedTime)}</td><td class="r"><div class="row" style="justify-content:flex-end"><button class="btn sm primary" data-act="cloud-continue" data-id="${f.id}">Continue here</button><button class="btn sm danger" data-act="cloud-delete" data-id="${f.id}">Delete</button></div></td></tr>`; }).join('') || `<tr><td colspan="4" class="empty">${C.files ? 'No careers in the cloud yet.' : 'Loading…'}</td></tr>`}
      </tbody></table></div></section>`;
  };
  const run = async (busy, fn, okMsg) => {
    C.busy = busy; C.err = ''; U.soft();
    try { await fn(); if (okMsg) toast(okMsg); } catch (e) { C.err = e.message; toast(e.message); }
    C.busy = ''; U.soft();
  };
  Object.assign(U.actions, {
    'cloud-client-save'() { const v = (document.getElementById('cloud-client') || {}).value || ''; if (!/apps\.googleusercontent\.com$/.test(v.trim())) { toast('That does not look like a Google Client ID. It ends with .apps.googleusercontent.com'); return; } U.settings.googleClientId = v.trim(); U.saveSettings(); U.soft(); },
    'cloud-client-reset'() { U.settings.googleClientId = ''; U.saveSettings(); C.signOut(); U.soft(); },
    'cloud-signin'() { run('in', async () => { await C.signIn(false); await C.whoami(); await C.list(); }, 'Signed in to Google'); },
    'cloud-signout'() { C.signOut(); toast('Signed out'); U.soft(); },
    'cloud-refresh'() { run('list', () => C.list()); },
    'cloud-upload'() { run('up', () => C.uploadCurrent(), 'Career uploaded to Google Drive'); },
    'cloud-delete'(d) { U.ask('Delete this cloud save?', 'It is removed from your Google Drive. Careers saved on your devices are not affected.', 'Delete', () => run('del', () => C.remove(d.id), 'Cloud save deleted'), true); },
    'cloud-continue'(d) {
      const m = U.meta(), slot = U.SLOTS.find(s => !m[s]);
      const go = sl => run('down', async () => { const text = await C.download(d.id); await U.loadSaveText(text, sl); }, `Career downloaded to slot ${slot || 1}. You can carry on.`);
      if (U.G && U.ui.unsaved) { U.ask('Leave your current career?', 'You have unsaved progress here. It will be lost.', 'Continue the cloud career', () => go(slot || 1), true); return; }
      if (slot) go(slot); else U.ask('All save slots are full', `The cloud career will replace slot 1 (${m[1] ? m[1].club : ''}) on this device.`, 'Replace slot 1', () => go(1), true);
    },
    'change:cloud-auto'(t) { U.settings.cloudAuto = t.checked; U.saveSettings(); }
  });
  // Refresh the list when the cloud section is first shown while signed in
  U.cloudRefreshIfNeeded = () => { if (C.supported() && C.signedIn() && !C.files && !C.busy) U.actions['cloud-refresh'](); };
})();
