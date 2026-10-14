/* Touchline — live 3D match view. A self-contained perspective renderer on a 2D canvas (no libraries, works offline).
   22 players move in team shape around the ball; ambient passing runs continuously and every engine event
   (shots, goals, saves, misses, offsides, set pieces, cards, injuries, substitutions) is acted out.
   Several camera angles: broadcast, wide, behind the goal, tactical (top-down) and drone. */
(function () {
  const TL = window.TL;
  const L = 105, W = 68, GOAL_W = 7.32, GOAL_H = 2.44, Y1 = (W - GOAL_W) / 2, Y2 = (W + GOAL_W) / 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (a, b) => a + Math.random() * (b - a);
  const hexRgb = h => { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const colDist = (a, b) => { const x = hexRgb(a), y = hexRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  const shade = (h, f) => { const [r, g, b] = hexRgb(h); const k = v => clamp(Math.round(v * f), 0, 255); return `rgb(${k(r)},${k(g)},${k(b)})`; };
  const SKIN = ['#f1c9a5', '#e0ac69', '#c68642', '#8d5524', '#5a3a22', '#f5d0b0'];
  const HAIR = ['#1b1410', '#2b1d14', '#3d2a1c', '#5b3a22', '#1b1410', '#c8a15a', '#8a4b2a', '#101010'];
  TL.CAMERAS = { broadcast: 'Broadcast', closeup: 'Close-up', wide: 'Wide', behind: 'Behind goal', tactical: 'Tactical', drone: 'Drone' };

  class Pitch3D {
    constructor(match, userSide, camera) {
      this.m = match; this.user = userSide || 'home';
      this.camMode = TL.CAMERAS[camera] ? camera : 'broadcast';
      this.P = {}; this.ball = { x: L / 2, y: W / 2, z: 0 };
      this.owner = null; this.act = null; this.script = []; this.override = {}; this.banner = null; this.cards = {};
      this.poss = 'home'; this.kickoff = true; this.holdT = 0.8; this.time = 0; this.speed = 1; this.netBulge = 0; this.droneA = -1.2;
      this.cam = { x: L / 2, y: -40, z: 25 }; this.look = { x: L / 2, y: W / 2, z: 0 };
      // kit colours: avoid clashes
      const H = match.sides.home.club, A = match.sides.away.club;
      this.kit = { home: { shirt: H.c1, shorts: H.c2 }, away: { shirt: A.c1, shorts: A.c2 } };
      if (colDist(H.c1, A.c1) < 110) this.kit.away = colDist(H.c1, A.c2) >= 110 ? { shirt: A.c2, shorts: A.c1 } : { shirt: colDist(H.c1, '#ffffff') > 150 ? '#f4f4f4' : '#1d1d1d', shorts: A.c1 };
      this.gkKit = { home: colDist(H.c1, '#2fbf71') > 120 ? '#2fbf71' : '#f2c94c', away: colDist(A.c1, '#e056a0') > 120 && colDist(this.kit.home.shirt, '#e056a0') > 100 ? '#e056a0' : '#5aa9e6' };
      this.sync(true);
      this.resetKickoff('home');
      this.last = 0; this.raf = null; this.canvas = null;
    }

    /* ---------- players ---------- */
    slotOf(k, i) { const f = TL.FORMATIONS[this.m.sides[k].tactics.formation] || TL.FORMATIONS['4-4-2']; return f[i] || ['CM', 50, 50]; }
    sync(first) {
      const seen = {};
      for (const k of ['home', 'away']) {
        for (const o of this.m.onPitch(k)) {
          seen[o.id] = true;
          let p = this.P[o.id];
          if (!p) {
            const base = this.basePos(k, o.i, true);
            p = this.P[o.id] = { id: o.id, side: k, i: o.i, x: first ? base.x : L / 2 + rand(-3, 3), y: first ? base.y : -1.5, vx: 0, vy: 0, ph: Math.random() * 6, wph: Math.random() * 6, num: o.i + 1, gk: o.pos === 'GK', skin: SKIN[(o.id.length * 7 + o.id.charCodeAt(o.id.length - 1)) % SKIN.length], hair: HAIR[(o.id.charCodeAt(0) + o.id.charCodeAt(o.id.length - 1) * 3) % HAIR.length], hairStyle: o.id.charCodeAt(o.id.length - 1) % 3, face: 0, pose: null, poseT: 0 };
          }
          p.i = o.i; p.gk = o.pos === 'GK';
        }
      }
      for (const id in this.P) if (!seen[id]) { if (this.owner === id) this.owner = null; delete this.P[id]; }
    }
    dir(k) { return k === 'home' ? 1 : -1; }
    goalX(k) { return k === 'home' ? L : 0; } // goal that side k attacks
    basePos(k, i, kickoff) {
      const [pos, lat, dep] = this.slotOf(k, i);
      const d = this.dir(k), own = k === 'home' ? 0 : L;
      const b = this.ball, bx = k === 'home' ? b.x : L - b.x;
      const inPoss = this.poss === k;
      let depth = 4 + dep / 100 * 48;
      if (!kickoff) {
        const shift = inPoss ? clamp(bx - 38, -12, 42) * 0.78 : clamp(bx - 55, -28, 22) * 0.62;
        depth += pos === 'GK' ? shift * 0.12 : shift;
        if (pos === 'GK') depth = clamp(depth, 2, 17);
      } else depth = Math.min(depth, 50 - 1.5);
      depth = clamp(depth, pos === 'GK' ? 1 : 7, L - 4);
      let y = (k === 'home' ? lat : 100 - lat) / 100 * W;
      if (!kickoff && pos !== 'GK') y += (b.y - y) * (inPoss ? 0.18 : 0.32);
      return { x: own + d * depth, y: clamp(y, 1.5, W - 1.5) };
    }
    team(k) { return Object.values(this.P).filter(p => p.side === k); }
    nearest(k, pt, exclude) { let best = null, bd = 1e9; for (const p of this.team(k)) { if (p.id === exclude) continue; const d = dist(p, pt); if (d < bd) { bd = d; best = p; } } return best; }
    gkOf(k) { return this.team(k).find(p => p.gk) || this.team(k)[0]; }

    /* ---------- feeding engine events ---------- */
    // Returns extra milliseconds the match clock should wait so the move can be shown.
    feed(lines, speed, atk) {
      this.speed = speed === 3 ? 2.1 : speed === 2 ? 1.4 : 1;
      this.sync(false);
      const imp = lines.find(l => l.shot && l.shot.out) || lines.find(l => ['yellow', 'red', 'injury', 'ht', 'et', 'ft', 'pen'].includes(l.type));
      if (!this.script.length && !imp && atk && atk !== this.poss && Math.random() < 0.55) this.turnover(atk);
      if (!imp) return 0;
      this.script = []; this.act = null; this.override = {};
      let secs = 0;
      const add = (fn, dur) => { this.script.push({ fn, dur }); secs += dur; };
      const k = imp.side, opp = k === 'home' ? 'away' : 'home';
      const gx = this.goalX(k), d = this.dir(k);
      if (imp.type === 'ht' || imp.type === 'et' || imp.type === 'ft') {
        add(() => { this.banner = { text: imp.type === 'ft' ? 'FULL TIME' : imp.type === 'ht' ? 'HALF TIME' : 'EXTRA TIME', t: 1.6 }; this.owner = null; }, 1.2);
        add(() => this.resetKickoff(imp.type === 'ht' ? 'away' : 'home'), 0.2);
        return Math.round(secs / this.speed * 1000);
      }
      if (imp.type === 'yellow' || imp.type === 'red') {
        const pl = this.P[imp.pid] || this.team(k)[0];
        add(() => { this.owner = null; this.banner = { text: 'FOUL', t: 0.9 }; if (pl) { pl.pose = 'down'; pl.poseT = 0.8; } }, 0.8);
        add(() => { if (pl) this.cards[pl.id] = { c: imp.type === 'red' ? '#e5383b' : '#f5c518', t: 1.8 }; }, 1.4);
        add(() => { this.setOwner(this.nearest(opp, this.ball)); }, 0.1);
        return Math.round(secs / this.speed * 1000);
      }
      if (imp.type === 'injury') {
        const pl = this.nearest(k, this.ball);
        add(() => { this.owner = null; if (pl) { pl.pose = 'down'; pl.poseT = 2; } this.banner = { text: 'INJURY', t: 1 }; }, 1.8);
        return Math.round(secs / this.speed * 1000);
      }
      const sh = imp.shot; if (!sh) return 0;
      const shooter = this.P[sh.sid] || this.nearest(k, { x: gx - d * 12, y: W / 2 });
      const assister = sh.aid && this.P[sh.aid];
      this.poss = k;
      // where the chance happens
      const spot = {
        header: { x: gx - d * rand(7, 11), y: rand(29, 39) }, corner: { x: gx - d * rand(6, 10), y: rand(29, 39) },
        close: { x: gx - d * rand(8, 13), y: rand(26, 42) }, long: { x: gx - d * rand(21, 28), y: rand(18, 50) },
        oneonone: { x: gx - d * rand(11, 15), y: rand(30, 38) }, penalty: { x: gx - d * 11, y: W / 2 },
        freekick: { x: gx - d * rand(20, 26), y: rand(22, 46) }, offside: { x: gx - d * rand(12, 18), y: rand(24, 44) }
      }[sh.type] || { x: gx - d * 12, y: W / 2 };
      const near = (p, tgt, gap) => { if (p && dist(p, tgt) > gap) { const a = Math.atan2(p.y - tgt.y, p.x - tgt.x); p.x = tgt.x + Math.cos(a) * gap; p.y = tgt.y + Math.sin(a) * gap; } };
      const crowdBox = (n) => { // attackers & defenders into the box
        const att = this.team(k).filter(p => !p.gk && p !== shooter).sort((a, b) => dist(a, spot) - dist(b, spot)).slice(0, n);
        const def = this.team(opp).filter(p => !p.gk).sort((a, b) => dist(a, spot) - dist(b, spot)).slice(0, n + 1);
        att.forEach(p => { this.override[p.id] = { x: gx - d * rand(6, 15), y: rand(24, 44) }; near(p, this.override[p.id], 14); });
        def.forEach(p => { this.override[p.id] = { x: gx - d * rand(4, 12), y: rand(26, 42) }; near(p, this.override[p.id], 12); });
      };
      if (imp.type === 'pen' || sh.type === 'penalty') {
        add(() => { this.owner = null; this.banner = { text: 'PENALTY', t: 1.2 }; this.ball = { x: spot.x, y: spot.y, z: 0 }; for (const p of Object.values(this.P)) if (!p.gk && p !== shooter) this.override[p.id] = { x: gx - d * rand(19, 24), y: rand(16, 52) }; this.override[shooter.id] = { x: spot.x - d * 2.5, y: spot.y }; near(shooter, spot, 8); const g = this.gkOf(opp); if (g) this.override[g.id] = { x: gx - d * 0.4, y: W / 2 }; }, 1.6);
      } else if (sh.type === 'corner') {
        const cy = Math.random() < 0.5 ? 0.3 : W - 0.3, taker = assister || this.nearest(k, { x: gx, y: cy }, shooter.id);
        add(() => { this.owner = null; this.banner = { text: 'CORNER', t: 0.9 }; this.ball = { x: gx - d * 0.3, y: cy, z: 0 }; crowdBox(4); if (taker) { this.override[taker.id] = { x: gx - d * 0.8, y: cy + (cy < 1 ? -0.6 : 0.6) }; near(taker, this.override[taker.id], 12); } this.override[shooter.id] = spot; near(shooter, spot, 12); }, 1.4);
        add(() => this.kick(taker, spot, 0.9, 7, shooter), 0.9);
      } else if (sh.type === 'freekick') {
        add(() => { this.owner = null; this.banner = { text: 'FREE KICK', t: 0.9 }; this.ball = { x: spot.x, y: spot.y, z: 0 }; this.override[shooter.id] = { x: spot.x - d * 1.5, y: spot.y }; near(shooter, spot, 10); const wall = this.team(opp).filter(p => !p.gk).slice(0, 4); const toG = { x: gx - spot.x, y: W / 2 - spot.y }, n = Math.hypot(toG.x, toG.y); wall.forEach((p, j) => this.override[p.id] = { x: spot.x + toG.x / n * 9.15 + (j - 1.5) * 0.7 * (toG.y / n), y: spot.y + toG.y / n * 9.15 - (j - 1.5) * 0.7 * (toG.x / n) }); }, 1.4);
      } else {
        // open play build-up: ball into the final third, a pass from the assister, then the shot
        const mid = { x: gx - d * rand(26, 34), y: rand(15, 53) };
        const holder = assister || this.nearest(k, mid, shooter.id) || shooter;
        add(() => {
          // bring the key players into the move (they make up the last few metres on screen)
          near(shooter, spot, 12); if (holder !== shooter) near(holder, mid, 10);
          this.override[shooter.id] = spot; this.override[holder.id] = mid;
          this.kick(null, mid, Math.max(0.6, dist(this.ball, mid) / 22), dist(this.ball, mid) > 20 ? 3 : 0.5, holder);
        }, 1.2);
        if (sh.type === 'header' || sh.type === 'oneonone' || sh.type === 'close' || sh.type === 'offside') add(() => this.kick(holder, spot, sh.type === 'header' ? 1.0 : 0.75, sh.type === 'header' ? 5.5 : 0.4, shooter), sh.type === 'header' ? 1.0 : 0.8);
        else add(() => this.kick(holder, shooter, 0.6, 0.2, shooter), 0.6);
      }
      if (sh.out === 'offside') {
        add(() => { this.act = null; this.owner = null; this.banner = { text: 'OFFSIDE', t: 1.2 }; }, 1.0);
        add(() => { this.override = {}; this.setOwner(this.gkOf(opp)); this.ball = { x: this.P[this.owner.id].x, y: this.P[this.owner.id].y, z: 0 }; this.poss = opp; }, 0.2);
        return Math.round(secs / this.speed * 1000);
      }
      // the shot itself
      const out = sh.out;
      const ty = out === 'goal' ? rand(Y1 + 0.5, Y2 - 0.5) : out === 'save' ? rand(Y1 + 0.8, Y2 - 0.8) : (Math.random() < 0.5 ? rand(Y1 - 4, Y1 - 0.6) : rand(Y2 + 0.6, Y2 + 4));
      const tz = out === 'miss' && Math.random() < 0.4 ? rand(2.7, 4.5) : rand(0.2, sh.type === 'header' ? 1.9 : 2.2);
      const g = this.gkOf(opp);
      add(() => {
        this.override[shooter.id] = null;
        const target = { x: gx + d * (out === 'goal' ? 1.4 : out === 'miss' ? 6 : 0.5), y: ty, z: out === 'goal' ? Math.min(tz, 2.1) : tz };
        if (out === 'save' && g) target.x = gx - d * 0.6;
        this.kick(shooter, target, out === 'goal' || out === 'miss' ? 0.55 : 0.5, sh.type === 'long' ? 1.6 : 0.8, null, true);
        if (g) { this.override[g.id] = { x: gx - d * 0.8, y: clamp(ty, Y1 - 0.5, Y2 + 0.5) }; if (out !== 'miss' || Math.abs(ty - W / 2) < 6) { g.pose = 'dive'; g.poseT = 1.1; g.diveDir = ty > g.y ? 1 : -1; } }
      }, 0.65);
      if (out === 'goal') {
        add(() => { this.act = null; this.ball = { x: gx + d * 1.6, y: ty, z: 0.3 }; this.netBulge = 1; this.banner = { text: 'GOAL!', t: 2.2, big: true }; this.owner = null; this.override = {}; this.celebrate(shooter, k); }, 2.8);
        add(() => this.resetKickoff(opp), 0.4);
      } else if (out === 'save') {
        add(() => { this.act = null; if (g) { this.ball = { x: g.x, y: g.y, z: 0.6 }; this.setOwner(g); } this.banner = { text: 'SAVE!', t: 1 }; this.poss = opp; }, 1.1);
        add(() => { this.override = {}; }, 0.2);
      } else {
        add(() => { this.act = null; this.banner = { text: 'WIDE', t: 0.8 }; this.owner = null; }, 0.9);
        add(() => { this.override = {}; this.poss = opp; const gk = this.gkOf(opp); if (gk) { this.ball = { x: gk.x + this.dir(opp) * 5, y: W / 2 + rand(-6, 6), z: 0 }; this.setOwner(gk); this.holdT = 0.9; } }, 0.3);
      }
      return Math.round(secs / this.speed * 1000);
    }
    turnover(k) {
      this.poss = k;
      const p = this.nearest(k, this.ball);
      if (p) { this.act = null; this.kick(null, p, 0.35, 0.1, p); }
    }
    celebrate(scorer, k) {
      const corner = { x: this.goalX(k) - this.dir(k) * 3, y: scorer.y > W / 2 ? W - 2 : 2 };
      this.override[scorer.id] = corner; scorer.pose = 'celebrate'; scorer.poseT = 2.8;
      for (const p of this.team(k)) if (p !== scorer && !p.gk) this.override[p.id] = { x: corner.x - this.dir(k) * rand(1, 7), y: corner.y + (corner.y < W / 2 ? rand(1, 6) : -rand(1, 6)) };
    }
    resetKickoff(k) {
      this.override = {}; this.act = null; this.kickoff = true; this.poss = k;
      this.ball = { x: L / 2, y: W / 2, z: 0 };
      const taker = this.team(k).filter(p => !p.gk).sort((a, b) => (this.slotOf(k, b.i)[2]) - (this.slotOf(k, a.i)[2]))[0];
      if (taker) { this.override[taker.id] = { x: L / 2 - this.dir(k) * 0.6, y: W / 2 + 0.6 }; this.owner = taker.id; }
      this.holdT = 1.0;
    }
    setOwner(p) { this.owner = p ? p.id : null; if (p) this.poss = p.side; }
    // move the ball from a player (or its current spot) to a target point/player
    kick(from, to, dur, arc, receiver, shot) {
      const tgt = to.id ? { x: to.x, y: to.y, z: 0 } : { x: to.x, y: to.y, z: to.z || 0 };
      if (to.id) { const v = Math.hypot(to.vx, to.vy); tgt.x += to.vx * dur * 0.8; tgt.y += to.vy * dur * 0.8; if (v < 0.1 && !shot) { /* static receiver */ } }
      this.act = { from: { x: this.ball.x, y: this.ball.y, z: this.ball.z }, to: tgt, t: 0, dur: Math.max(0.15, dur), arc: arc || 0, recv: receiver ? receiver.id : null, shot: !!shot };
      if (receiver) this.override[receiver.id] = this.override[receiver.id] || { x: tgt.x, y: tgt.y, temp: true };
      this.owner = null; this.kickoff = false;
    }

    /* ---------- simulation ---------- */
    step(dt) {
      this.time += dt;
      const sdt = dt * this.speed;
      // scripted choreography
      if (this.script.length) {
        const s0 = this.script[0];
        if (!s0.started) { s0.started = true; s0.t = 0; try { s0.fn(); } catch (e) { /* keep going */ } }
        s0.t += sdt;
        if (s0.t >= s0.dur) this.script.shift();
      }
      // ball flight
      if (this.act) {
        const a = this.act; a.t += sdt;
        const u = clamp(a.t / a.dur, 0, 1);
        this.ball.x = lerp(a.from.x, a.to.x, u); this.ball.y = lerp(a.from.y, a.to.y, u);
        this.ball.z = lerp(a.from.z, a.to.z, u) + a.arc * 4 * u * (1 - u);
        if (u >= 1) {
          const r = a.recv && this.P[a.recv];
          this.act = null;
          if (r) { this.setOwner(r); if (this.override[r.id] && this.override[r.id].temp) delete this.override[r.id]; this.holdT = rand(0.6, 1.6); }
        }
      } else if (this.owner && this.P[this.owner]) {
        const o = this.P[this.owner], v = Math.hypot(o.vx, o.vy) || 1;
        this.ball.x = o.x + o.vx / v * 0.55; this.ball.y = o.y + o.vy / v * 0.55; this.ball.z = 0;
        if (!this.script.length) { this.holdT -= sdt; if (this.holdT <= 0) this.ambientPass(o); }
      } else if (!this.script.length) {
        const p = this.nearest(this.poss, this.ball); if (p && dist(p, this.ball) < 1.2) this.setOwner(p);
      }
      this.netBulge = Math.max(0, this.netBulge - dt * 0.6);
      if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
      for (const id in this.cards) { this.cards[id].t -= dt; if (this.cards[id].t <= 0) delete this.cards[id]; }
      // players
      for (const p of Object.values(this.P)) {
        if (p.poseT > 0) { p.poseT -= dt; if (p.poseT <= 0) p.pose = null; }
        let tg = this.override[p.id];
        if (!tg) {
          tg = this.basePos(p.side, p.i, this.kickoff);
          tg.x += Math.sin(this.time * 0.6 + p.wph) * 1.6; tg.y += Math.cos(this.time * 0.45 + p.ph) * 1.6;
          if (this.owner === p.id) tg = { x: p.x + this.dir(p.side) * 4, y: p.y + Math.sin(this.time + p.ph) * 2 };
          else if (!this.owner && !this.act && !this.script.length && this.nearest(this.poss, this.ball) === p) tg = { x: this.ball.x, y: this.ball.y };
          else if (p.side !== this.poss && this.nearest(p.side, this.ball) === p && !p.gk) tg = { x: lerp(p.x, this.ball.x, 0.6), y: lerp(p.y, this.ball.y, 0.6) };
        }
        const dx = tg.x - p.x, dy = tg.y - p.y, dd = Math.hypot(dx, dy);
        const vmax = (p.pose === 'down' ? 0 : this.override[p.id] ? 7.5 : this.owner === p.id ? 5.5 : 6.2) * this.speed * (this.script.length ? 1.9 : 1);
        const want = dd > 0.25 ? Math.min(vmax, dd * 2.2) : 0;
        const tvx = dd > 0 ? dx / dd * want : 0, tvy = dd > 0 ? dy / dd * want : 0;
        p.vx = lerp(p.vx, tvx, clamp(dt * 5, 0, 1)); p.vy = lerp(p.vy, tvy, clamp(dt * 5, 0, 1));
        p.x = clamp(p.x + p.vx * dt, -3, L + 3); p.y = clamp(p.y + p.vy * dt, -3, W + 3);
        p.ph += Math.hypot(p.vx, p.vy) * dt * 1.7;
        // which way he is looking: where he runs, or at the ball when standing
        const sp = Math.hypot(p.vx, p.vy), want2 = sp > 0.8 ? Math.atan2(p.vy, p.vx) : Math.atan2(this.ball.y - p.y, this.ball.x - p.x);
        let da = want2 - p.face; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; p.face += da * clamp(dt * 6, 0, 1);
      }
      // camera
      this.updateCamera(dt);
    }
    ambientPass(o) {
      const k = o.side, d = this.dir(k), gx = this.goalX(k);
      const mates = this.team(k).filter(p => p !== o && !(p.gk && Math.random() < 0.85));
      if (!mates.length) return;
      const deep = Math.abs(gx - o.x) < 26; // don't invent chances: recycle the ball near goal
      const scored = mates.map(p => {
        const fwd = (p.x - o.x) * d, dd = dist(p, o);
        let w = dd < 6 || dd > 38 ? 0.05 : 1;
        w *= deep ? (fwd < 2 ? 1.6 : 0.3) : (fwd > 0 ? 1.5 + fwd / 20 : 0.6);
        return { p, w };
      });
      const tot = scored.reduce((a, s) => a + s.w, 0); let r = Math.random() * tot, pick = scored[0].p;
      for (const s of scored) { r -= s.w; if (r <= 0) { pick = s.p; break; } }
      const dd = dist(pick, o);
      this.kick(o, pick, clamp(dd / 17, 0.35, 1.6), dd > 26 ? rand(3, 6) : dd > 16 ? 0.6 : 0.1, pick);
    }
    updateCamera(dt) {
      const b = this.ball, k = clamp(dt * 2.4, 0, 1), m = this.camMode;
      let cam, look, fov;
      if (m === 'tactical') { cam = { x: L / 2, y: W / 2 - 10, z: 84 }; look = { x: L / 2, y: W / 2 + 0.5, z: 0 }; fov = 50; }
      else if (m === 'wide') { cam = { x: L / 2 + (b.x - L / 2) * 0.25, y: -46, z: 34 }; look = { x: L / 2 + (b.x - L / 2) * 0.55, y: W / 2 - 4, z: 0 }; fov = 52; }
      else if (m === 'behind') { const d = this.dir(this.user), own = this.user === 'home' ? 0 : L; cam = { x: own - d * 16, y: W / 2 + (b.y - W / 2) * 0.3, z: 15 }; look = { x: b.x + d * 12, y: W / 2 + (b.y - W / 2) * 0.6, z: 0 }; fov = 48; }
      else if (m === 'closeup') { cam = { x: b.x - 7, y: Math.max(-4, b.y - 13), z: 4.2 }; look = { x: b.x + 1, y: b.y, z: 1.0 }; fov = 42; }
      else if (m === 'drone') { this.droneA += dt * 0.07; cam = { x: b.x + Math.cos(this.droneA) * 34, y: b.y + Math.sin(this.droneA) * 34, z: 20 }; look = { x: b.x, y: b.y, z: 0 }; fov = 46; }
      else { cam = { x: L / 2 + (b.x - L / 2) * 0.6, y: -21, z: 14 }; look = { x: b.x, y: lerp(W / 2, b.y, 0.7), z: 0 }; fov = 32; }
      for (const a of ['x', 'y', 'z']) { this.cam[a] = lerp(this.cam[a], cam[a], k); this.look[a] = lerp(this.look[a], look[a], k * 1.4); }
      this.fov = this.fov ? lerp(this.fov, fov, k) : fov;
    }

    /* ---------- projection ---------- */
    basis() {
      const c = this.cam, t = this.look;
      let fx = t.x - c.x, fy = t.y - c.y, fz = t.z - c.z; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
      let rx = fy * 1 - fz * 0, ry = fz * 0 - fx * 1, rz = 0; // cross(f, up=(0,0,1))
      const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
      const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
      this.B = { fx, fy, fz, rx, ry, rz, ux, uy, uz, focal: this.h / (2 * Math.tan(this.fov * Math.PI / 360)) };
    }
    toCam(x, y, z) { const B = this.B, c = this.cam, dx = x - c.x, dy = y - c.y, dz = z - c.z; return [dx * B.rx + dy * B.ry + dz * B.rz, dx * B.ux + dy * B.uy + dz * B.uz, dx * B.fx + dy * B.fy + dz * B.fz]; }
    proj(v) { const f = this.B.focal; return [this.w / 2 + v[0] / v[2] * f, this.h / 2 - v[1] / v[2] * f, v[2]]; }
    pt(x, y, z) { const v = this.toCam(x, y, z || 0); return v[2] > 0.3 ? this.proj(v) : null; }
    poly(pts3, fill, stroke, lw) {
      // clip against the near plane in camera space, then project
      const NEAR = 0.3, cam = pts3.map(p => this.toCam(p[0], p[1], p[2] || 0)), out = [];
      for (let i = 0; i < cam.length; i++) {
        const a = cam[i], b = cam[(i + 1) % cam.length], ain = a[2] > NEAR, bin = b[2] > NEAR;
        if (ain) out.push(a);
        if (ain !== bin) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
      }
      if (out.length < 3) return;
      const ctx = this.ctx; ctx.beginPath();
      out.forEach((v, i) => { const p = this.proj(v); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    }
    line3(a, b, color, widthM) {
      const n = 6, ctx = this.ctx; let prev = null;
      ctx.strokeStyle = color; ctx.lineCap = 'round';
      for (let i = 0; i <= n; i++) {
        const t = i / n, p = this.pt(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2] || 0, b[2] || 0, t));
        if (p && prev) { ctx.lineWidth = Math.max(0.8, widthM * this.B.focal / ((p[2] + prev[2]) / 2)); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
        prev = p;
      }
    }
    arc3(cx, cy, r, a0, a1, color) {
      const n = 28; let prev = null; const ctx = this.ctx; ctx.strokeStyle = color;
      for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n), p = this.pt(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0); if (p && prev) { ctx.lineWidth = Math.max(0.8, 0.12 * this.B.focal / p[2]); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); } prev = p; }
    }

    /* ---------- drawing ---------- */
    draw() {
      const ctx = this.ctx, w = this.w, h = this.h;
      this.basis();
      // sky & stands
      const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#0b1424'); sky.addColorStop(1, '#16233a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      const stand = (pts, c) => this.poly(pts, c);
      stand([[-12, W + 6, 0], [L + 12, W + 6, 0], [L + 12, W + 34, 18], [-12, W + 34, 18]], '#1c2a44');
      stand([[-12, -6, 0], [L + 12, -6, 0], [L + 12, -34, 18], [-12, -34, 18]], '#1c2a44');
      stand([[-6, -12, 0], [-6, W + 12, 0], [-34, W + 12, 16], [-34, -12, 16]], '#18253d');
      stand([[L + 6, -12, 0], [L + 6, W + 12, 0], [L + 34, W + 12, 16], [L + 34, -12, 16]], '#18253d');
      this.crowd();
      // grass
      this.poly([[-6, -6, 0], [L + 6, -6, 0], [L + 6, W + 6, 0], [-6, W + 6, 0]], '#1f6b3d');
      const N = 14;
      for (let i = 0; i < N; i++) this.poly([[i * L / N, 0, 0], [(i + 1) * L / N, 0, 0], [(i + 1) * L / N, W, 0], [i * L / N, W, 0]], i % 2 ? '#2c8a4f' : '#279049');
      // lines
      const lc = 'rgba(255,255,255,.88)', lw = 0.12;
      const seg = (a, b) => this.line3(a, b, lc, lw);
      seg([0, 0], [L, 0]); seg([L, 0], [L, W]); seg([L, W], [0, W]); seg([0, W], [0, 0]); seg([L / 2, 0], [L / 2, W]);
      this.arc3(L / 2, W / 2, 9.15, 0, Math.PI * 2, lc);
      for (const gx of [0, L]) {
        const d = gx === 0 ? 1 : -1;
        seg([gx, W / 2 - 20.16], [gx + d * 16.5, W / 2 - 20.16]); seg([gx + d * 16.5, W / 2 - 20.16], [gx + d * 16.5, W / 2 + 20.16]); seg([gx + d * 16.5, W / 2 + 20.16], [gx, W / 2 + 20.16]);
        seg([gx, W / 2 - 9.16], [gx + d * 5.5, W / 2 - 9.16]); seg([gx + d * 5.5, W / 2 - 9.16], [gx + d * 5.5, W / 2 + 9.16]); seg([gx + d * 5.5, W / 2 + 9.16], [gx, W / 2 + 9.16]);
        const a = Math.acos(5.5 / 9.15); gx === 0 ? this.arc3(11, W / 2, 9.15, -a, a, lc) : this.arc3(L - 11, W / 2, 9.15, Math.PI - a, Math.PI + a, lc);
        const sp = this.pt(gx + d * 11, W / 2, 0); if (sp) { ctx.fillStyle = lc; ctx.beginPath(); ctx.arc(sp[0], sp[1], Math.max(1, 0.2 * this.B.focal / sp[2]), 0, 7); ctx.fill(); }
      }
      // sort dynamic objects back-to-front
      const objs = Object.values(this.P).map(p => ({ kind: 'p', p, z: this.toCam(p.x, p.y, 0.9)[2] }));
      objs.push({ kind: 'b', z: this.toCam(this.ball.x, this.ball.y, this.ball.z)[2] });
      objs.push({ kind: 'g', gx: 0, z: this.toCam(-1, W / 2, 1)[2] }); objs.push({ kind: 'g', gx: L, z: this.toCam(L + 1, W / 2, 1)[2] });
      // shadows first (on the grass)
      for (const p of Object.values(this.P)) this.shadow(p.x, p.y, 0.45, 0.32);
      this.shadow(this.ball.x, this.ball.y, 0.22 + this.ball.z * 0.03, 0.4 / (1 + this.ball.z * 0.4));
      objs.sort((a, b) => b.z - a.z);
      for (const o of objs) { if (o.z <= 0.3) continue; if (o.kind === 'p') this.player(o.p); else if (o.kind === 'b') this.drawBall(); else this.goal(o.gx); }
      // banner
      if (this.banner) {
        const b = this.banner, a = clamp(b.t * 2, 0, 1);
        ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
        ctx.font = `700 ${b.big ? Math.round(h * 0.13) : Math.round(h * 0.075)}px Bahnschrift, 'Arial Narrow', sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(b.text, w / 2 + 2, h * 0.24 + 2);
        ctx.fillStyle = b.big ? '#f5c25e' : '#fff'; ctx.fillText(b.text, w / 2, h * 0.24);
        ctx.restore();
      }
    }
    crowd() {
      // a few rows of coloured dots in the stands
      const ctx = this.ctx;
      if (!this.crowdPts) { this.crowdPts = []; for (let i = 0; i < 520; i++) { const side = i % 4; const u = Math.random(), v = Math.random(); let p; if (side === 0) p = [lerp(-10, L + 10, u), W + 8 + v * 24, 1 + v * 16]; else if (side === 1) p = [lerp(-10, L + 10, u), -8 - v * 24, 1 + v * 16]; else if (side === 2) p = [-8 - v * 24, lerp(-10, W + 10, u), 1 + v * 14]; else p = [L + 8 + v * 24, lerp(-10, W + 10, u), 1 + v * 14]; this.crowdPts.push({ p, c: Math.random() < 0.5 ? this.kit.home.shirt : ['#c9d1e0', '#7f8aa3', '#2d3a55', this.kit.away.shirt][i % 4] }); } }
      for (const c of this.crowdPts) { const s = this.pt(c.p[0], c.p[1], c.p[2] + Math.sin(this.time * 3 + c.p[0]) * 0.08); if (!s) continue; const r = Math.max(0.7, 0.35 * this.B.focal / s[2]); ctx.fillStyle = c.c; ctx.globalAlpha = 0.7; ctx.fillRect(s[0] - r / 2, s[1] - r, r, r); }
      ctx.globalAlpha = 1;
    }
    shadow(x, y, rx, a) {
      const c = this.pt(x, y, 0), e = this.pt(x + rx, y, 0), f = this.pt(x, y + rx, 0); if (!c || !e || !f) return;
      const ctx = this.ctx; ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath();
      ctx.ellipse(c[0], c[1], Math.max(1, Math.hypot(e[0] - c[0], e[1] - c[1])), Math.max(0.6, Math.hypot(f[0] - c[0], f[1] - c[1])), Math.atan2(e[1] - c[1], e[0] - c[0]), 0, 7); ctx.fill();
    }
    goal(gx) {
      const d = gx === 0 ? -1 : 1, depth = 2 + this.netBulge * (gx === this.goalX(this.ball.x > L / 2 ? 'home' : 'away') ? 0.6 : 0);
      const post = (y) => this.line3([gx, y, 0], [gx, y, GOAL_H], '#ffffff', 0.12);
      const net = 'rgba(235,240,245,.35)';
      // net: back, sides, roof
      for (let i = 0; i <= 8; i++) { const y = lerp(Y1, Y2, i / 8); this.line3([gx + d * depth, y, 0], [gx + d * depth * 0.8, y, GOAL_H], net, 0.03); this.line3([gx, y, GOAL_H], [gx + d * depth * 0.8, y, GOAL_H], net, 0.03); }
      for (let i = 0; i <= 4; i++) { const z = lerp(0, GOAL_H, i / 4); this.line3([gx + d * lerp(depth, depth * 0.8, i / 4), Y1, z], [gx + d * lerp(depth, depth * 0.8, i / 4), Y2, z], net, 0.03); this.line3([gx, Y1, z], [gx + d * lerp(depth, depth * 0.8, i / 4), Y1, z], net, 0.03); this.line3([gx, Y2, z], [gx + d * lerp(depth, depth * 0.8, i / 4), Y2, z], net, 0.03); }
      post(Y1); post(Y2); this.line3([gx, Y1, GOAL_H], [gx, Y2, GOAL_H], '#ffffff', 0.12);
    }
    drawBall() {
      const b = this.ball, p = this.pt(b.x, b.y, b.z + 0.11); if (!p) return;
      const r = Math.max(2.2, 0.16 * this.B.focal / p[2]), ctx = this.ctx;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(0.6, r * 0.2);
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(p[0] - r * 0.2, p[1] - r * 0.15, r * 0.3, 0, 7); ctx.fill();
    }
    player(p) {
      const foot = this.pt(p.x, p.y, 0), head = this.pt(p.x, p.y, 1.8); if (!foot || !head) return;
      const ctx = this.ctx, hpx = foot[1] - head[1], s = Math.max(4, Math.abs(hpx));
      const kit = this.kit[p.side], shirt = p.gk ? this.gkKit[p.side] : kit.shirt, shorts = p.gk ? '#1d1d1d' : kit.shorts;
      if (this.camMode === 'tactical') { // top-down: numbered discs
        const r = Math.max(5, 1.05 * this.B.focal / foot[2]);
        ctx.fillStyle = shirt; ctx.strokeStyle = this.owner === p.id ? '#f5c25e' : shade(shirt, 0.55); ctx.lineWidth = this.owner === p.id ? 3 : 1.5;
        ctx.beginPath(); ctx.arc(foot[0], foot[1], r, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = TL.UI && TL.UI.inkOn ? TL.UI.inkOn(shirt) : '#fff'; ctx.font = `700 ${Math.round(r * 1.05)}px Bahnschrift, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(p.num), foot[0], foot[1] + 0.5); ctx.textBaseline = 'alphabetic';
        if (this.cards[p.id]) { ctx.fillStyle = this.cards[p.id].c; ctx.fillRect(foot[0] + r, foot[1] - r * 1.6, r * 0.7, r); }
        return;
      }
      const wd = s * 0.3, swing = Math.sin(p.ph) * Math.min(1, Math.hypot(p.vx, p.vy) / 3) * wd * 0.55;
      ctx.save();
      ctx.translate(foot[0], foot[1]);
      if (p.pose === 'down') ctx.rotate(Math.PI / 2 * 0.95);
      if (p.pose === 'dive') ctx.rotate((p.diveDir || 1) * 1.1 * Math.min(1, (1.1 - p.poseT) * 3));
      const y = v => -v * s; // height fraction to px
      // legs
      ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = Math.max(1.2, wd * 0.32); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-wd * 0.18, y(0.48)); ctx.lineTo(-wd * 0.18 + swing, 0); ctx.moveTo(wd * 0.18, y(0.48)); ctx.lineTo(wd * 0.18 - swing, 0); ctx.stroke();
      ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(1.2, wd * 0.34); ctx.beginPath(); ctx.moveTo(-wd * 0.18 + swing, -wd * 0.05); ctx.lineTo(-wd * 0.18 + swing * 1.1, 0); ctx.moveTo(wd * 0.18 - swing, -wd * 0.05); ctx.lineTo(wd * 0.18 - swing * 1.1, 0); ctx.stroke();
      // shorts
      ctx.fillStyle = shorts; ctx.fillRect(-wd * 0.45, y(0.56), wd * 0.9, s * 0.13);
      // torso
      ctx.fillStyle = shirt; ctx.strokeStyle = shade(shirt, 0.6); ctx.lineWidth = Math.max(0.6, s * 0.015);
      const tw = wd * 1.05, top = y(0.84), bot = y(0.52);
      ctx.beginPath(); ctx.moveTo(-tw / 2, bot); ctx.lineTo(-tw / 2 - wd * 0.05, top + s * 0.03); ctx.quadraticCurveTo(0, top - s * 0.025, tw / 2 + wd * 0.05, top + s * 0.03); ctx.lineTo(tw / 2, bot); ctx.closePath(); ctx.fill(); ctx.stroke();
      // arms
      ctx.strokeStyle = shirt; ctx.lineWidth = Math.max(1, wd * 0.24);
      const up = p.pose === 'celebrate';
      ctx.beginPath(); ctx.moveTo(-tw / 2, top + s * 0.05); ctx.lineTo(-tw / 2 - wd * (up ? 0.3 : 0.12) - swing * 0.3, up ? top - s * 0.18 : y(0.6)); ctx.moveTo(tw / 2, top + s * 0.05); ctx.lineTo(tw / 2 + wd * (up ? 0.3 : 0.12) + swing * 0.3, up ? top - s * 0.18 : y(0.6)); ctx.stroke();
      // head with a face that turns with the player
      this.head(ctx, p, 0, y(0.925), s * 0.092);
      // number
      if (s > 34) { ctx.fillStyle = TL.UI ? (TL.UI.inkOn ? TL.UI.inkOn(shirt) : '#fff') : '#fff'; ctx.font = `700 ${Math.round(s * 0.13)}px Bahnschrift, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(String(p.num), 0, y(0.62)); }
      ctx.restore();
      // ball carrier / user highlights and cards
      const isOwner = this.owner === p.id;
      if (isOwner || this.cards[p.id] || (p.pose === 'celebrate')) {
        const name = (this.m.state.players[p.id] || {}).name || '';
        const short = name.split(' ').slice(-1)[0];
        ctx.font = `600 ${Math.max(10, Math.min(14, s * 0.16))}px 'Segoe UI', sans-serif`; ctx.textAlign = 'center';
        const tx = head[0], ty = head[1] - s * 0.18;
        const tw2 = ctx.measureText(short).width + 10;
        ctx.fillStyle = p.side === this.user ? 'rgba(242,179,61,.92)' : 'rgba(15,22,38,.85)'; ctx.fillRect(tx - tw2 / 2, ty - 13, tw2, 17);
        ctx.fillStyle = p.side === this.user ? '#1b1303' : '#fff'; ctx.fillText(short, tx, ty);
      }
      if (this.cards[p.id]) { ctx.fillStyle = this.cards[p.id].c; const cx = head[0] + s * 0.25, cy = head[1] - s * 0.5; ctx.fillRect(cx, cy, s * 0.12, s * 0.17); }
    }

    head(ctx, p, hx, hy, r) {
      // direction he faces relative to the camera: front > 0, back < 0; side = which way the face points on screen
      const B = this.B, fx = Math.cos(p.face), fy = Math.sin(p.face);
      const front = -(fx * B.fx + fy * B.fy) / (Math.hypot(B.fx, B.fy) || 1);
      const side = fx * B.rx + fy * B.ry;
      ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7); ctx.fill();
      // hair
      ctx.fillStyle = p.hair; ctx.beginPath();
      if (front < -0.35) ctx.arc(hx, hy, r * 1.02, 0, 7); // back of the head
      else if (p.hairStyle === 2) ctx.arc(hx, hy - r * 0.15, r * 0.95, Math.PI * 1.05, Math.PI * 1.95); // short crop
      else ctx.arc(hx, hy - r * 0.08, r * 1.04, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
      if (r < 2.6 || front < -0.35) return;
      const ox = side * r * 0.45; // face shifts toward where he is looking
      ctx.fillStyle = '#1a1a1a';
      if (front > 0.35) {
        const ew = Math.max(0.7, r * 0.17);
        for (const ex of [-0.34, 0.34]) { ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.ellipse(hx + ox + ex * r, hy - r * 0.05, ew * 1.15, ew * 0.85, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#16120f'; ctx.beginPath(); ctx.arc(hx + ox + ex * r + side * ew * 0.35, hy - r * 0.05, ew * 0.55, 0, 7); ctx.fill(); }
        if (r > 5) { ctx.strokeStyle = p.hair; ctx.lineWidth = Math.max(0.6, r * 0.09); ctx.beginPath(); ctx.moveTo(hx + ox - r * 0.52, hy - r * 0.28); ctx.lineTo(hx + ox - r * 0.18, hy - r * 0.3); ctx.moveTo(hx + ox + r * 0.18, hy - r * 0.3); ctx.lineTo(hx + ox + r * 0.52, hy - r * 0.28); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(150,60,60,.9)'; ctx.lineWidth = Math.max(0.6, r * 0.1);
        ctx.beginPath(); ctx.arc(hx + ox, hy + r * 0.22, r * 0.25, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      } else {
        // profile: one eye and the nose on the side he faces
        const dir = side >= 0 ? 1 : -1;
        ctx.beginPath(); ctx.arc(hx + dir * r * 0.45, hy - r * 0.05, Math.max(0.6, r * 0.12), 0, 7); ctx.fill();
        ctx.fillStyle = p.skin; ctx.beginPath(); ctx.moveTo(hx + dir * r * 0.9, hy - r * 0.1); ctx.lineTo(hx + dir * r * 1.18, hy + r * 0.12); ctx.lineTo(hx + dir * r * 0.88, hy + r * 0.2); ctx.fill();
        ctx.strokeStyle = 'rgba(80,30,30,.8)'; ctx.lineWidth = Math.max(0.5, r * 0.08); ctx.beginPath(); ctx.moveTo(hx + dir * r * 0.55, hy + r * 0.4); ctx.lineTo(hx + dir * r * 0.82, hy + r * 0.38); ctx.stroke();
      }
    }

    /* ---------- lifecycle ---------- */
    attach(canvas) {
      if (!canvas) return;
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.resize();
      if (!this.raf) { this.last = performance.now(); const loop = now => { this.raf = requestAnimationFrame(loop); if (!this.canvas || !this.canvas.isConnected) return; const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; if (this.paused) { this.draw(); return; } this.step(dt); this.draw(); }; this.raf = requestAnimationFrame(loop); }
    }
    resize() {
      const c = this.canvas; if (!c) return;
      const r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      this.w = Math.max(200, r.width); this.h = Math.max(150, r.height);
      c.width = Math.round(this.w * dpr); c.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    setCamera(m) { if (TL.CAMERAS[m]) this.camMode = m; }
    destroy() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; this.canvas = null; }
  }
  TL.Pitch3D = Pitch3D;
})();
