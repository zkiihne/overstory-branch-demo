(function(){
  // ELEVATED branch-spine — same procedural-SVG + GSAP ScrollTrigger engine as the
  // current one (so leaves stay ANCHORED to the real <li> steps and it reflows to any
  // height), but the motion is designed up to "signature":
  //   1. springy leaf unfurl (back-out overshoot) so reaching a step POPS its leaf.
  //   2. luminous leading tip with a soft double trail that rides the growing end.
  //   3. all leaves seated on the RIGHT of the shaft (toward the content).
  // No idle loop and no sway; the growth itself is scroll-scrubbed (linear), so there is
  // nothing to pause off-screen. Exposes window.mountBranchSpineElevated(loop,{reduced}).
  var SVGNS = 'http://www.w3.org/2000/svg';

  window.mountBranchSpineElevated = function(loop, opts){
    opts = opts || {};
    var reduced = !!opts.reduced;
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (!gsap) throw new Error('branch-elevated: GSAP not loaded.');
    if (ST && gsap.registerPlugin) gsap.registerPlugin(ST);

    function el(name, attrs){
      var n = document.createElementNS(SVGNS, name);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    }

    var svg = el('svg', { 'class': 'branch-spine', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
    var defs = el('defs', {});

    var filt = el('filter', { id: 'branchGlowE', x: '-60%', y: '-8%', width: '220%', height: '116%',
                              filterUnits: 'objectBoundingBox', 'color-interpolation-filters': 'sRGB' });
    filt.appendChild(el('feGaussianBlur', { 'in': 'SourceAlpha', stdDeviation: '3.0', result: 'blur' }));
    filt.appendChild(el('feColorMatrix', { 'in': 'blur', type: 'matrix', result: 'halo',
      values: '0 0 0 0 0.24  0 0 0 0 0.40  0 0 0 0 0.28  0 0 0 0.32 0' }));
    var merge = el('feMerge', {});
    merge.appendChild(el('feMergeNode', { 'in': 'halo' }));
    merge.appendChild(el('feMergeNode', { 'in': 'SourceGraphic' }));
    filt.appendChild(merge);
    defs.appendChild(filt);

    var clip = el('clipPath', { id: 'branchShapeE', clipPathUnits: 'userSpaceOnUse' });
    var silhouette = el('path', { d: '' });
    clip.appendChild(silhouette);

    var grad = el('linearGradient', { id: 'branchGradE', x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(el('stop', { offset: '0',    'stop-color': '#24402B', 'stop-opacity': '0.97' }));
    grad.appendChild(el('stop', { offset: '0.5',  'stop-color': '#37623F', 'stop-opacity': '0.92' }));
    grad.appendChild(el('stop', { offset: '0.82', 'stop-color': '#5C8150', 'stop-opacity': '0.86' }));
    grad.appendChild(el('stop', { offset: '1',    'stop-color': '#86A566', 'stop-opacity': '0.78' }));
    defs.appendChild(clip); defs.appendChild(grad);

    var leafGrad = el('linearGradient', { id: 'leafGradE', x1: 0, y1: 0, x2: 1, y2: 0 });
    leafGrad.appendChild(el('stop', { offset: '0',   'stop-color': '#2F5537', 'stop-opacity': '0.96' }));
    leafGrad.appendChild(el('stop', { offset: '0.5', 'stop-color': '#4C7A50', 'stop-opacity': '0.94' }));
    leafGrad.appendChild(el('stop', { offset: '1',   'stop-color': '#77974F', 'stop-opacity': '0.9'  }));
    defs.appendChild(leafGrad);

    var tipGrad = el('radialGradient', { id: 'branchTipE', cx: '0.5', cy: '0.5', r: '0.5' });
    tipGrad.appendChild(el('stop', { offset: '0',   'stop-color': '#F6EFC0', 'stop-opacity': '0.98' }));
    tipGrad.appendChild(el('stop', { offset: '0.5', 'stop-color': '#C4D89A', 'stop-opacity': '0.48' }));
    tipGrad.appendChild(el('stop', { offset: '1',   'stop-color': '#C4D89A', 'stop-opacity': '0' }));
    defs.appendChild(tipGrad);

    svg.appendChild(defs);

    var g = el('g', { filter: 'url(#branchGlowE)' });

    var spine = el('path', {
      d: '', fill: 'none', stroke: 'url(#branchGradE)',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      pathLength: 1000, 'stroke-dasharray': '1000 1000', 'stroke-dashoffset': 1000,
      'clip-path': 'url(#branchShapeE)'
    });
    g.appendChild(spine);

    var leaves = el('g', {});
    g.appendChild(leaves);

    // luminous tip + two fading trail echoes behind it
    var trail2 = el('circle', { r: 0, fill: 'url(#branchTipE)', opacity: 0 });
    var trail1 = el('circle', { r: 0, fill: 'url(#branchTipE)', opacity: 0 });
    var tip    = el('circle', { r: 0, fill: 'url(#branchTipE)', opacity: 0 });
    g.appendChild(trail2); g.appendChild(trail1); g.appendChild(tip);

    svg.appendChild(g);
    // idempotent: never stack a second branch if this mounts more than once
    loop.querySelectorAll('svg.branch-spine').forEach(function(n){ n.remove(); });
    loop.insertBefore(svg, loop.firstChild);

    var W = 0, H = 0, st = null, pts = [];
    var leafDefs = [];

    function centerline(gutter, amp){
      var N = 160, p = [];
      for (var i = 0; i <= N; i++){
        var t = i / N, y = t * H;
        var w = Math.sin(Math.pow(t, 0.82) * Math.PI);
        var bend = w * w * (0.6 + 0.4 * (1 - t));
        p.push([gutter + bend * amp, y, t]);
      }
      return p;
    }
    function halfWidth(t, wTop){
      var base = 1 + 0.5 * Math.exp(-t * 14);
      var taper = Math.pow(1 - t, 1.35) * (0.55 + 0.45 * (1 - t));
      return wTop * base * Math.max(0, taper) / 2;
    }
    function silhouetteD(p, wTop){
      var n = p.length - 1, Lp = [], Rp = [];
      for (var i = 0; i <= n; i++){
        var a = p[Math.max(0, i - 1)], b = p[Math.min(n, i + 1)];
        var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
        var nx = -dy / len, ny = dx / len, hw = halfWidth(p[i][2], wTop);
        Lp.push([p[i][0] + nx * hw, p[i][1] + ny * hw]);
        Rp.push([p[i][0] - nx * hw, p[i][1] - ny * hw]);
      }
      return smoothClosed(Lp, Rp);
    }
    function smoothClosed(Lp, Rp){
      var d = 'M' + f(Lp[0][0]) + ' ' + f(Lp[0][1]);
      d += smoothOpen(Lp);
      d += ' L' + f(Rp[Rp.length-1][0]) + ' ' + f(Rp[Rp.length-1][1]);
      d += smoothOpen(Rp.slice().reverse());
      return d + ' Z';
    }
    function smoothOpen(r){
      var out = '', n = r.length;
      for (var i = 0; i < n - 1; i++){
        var p0 = r[Math.max(0, i - 1)], p1 = r[i], p2 = r[i + 1], p3 = r[Math.min(n - 1, i + 2)];
        var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
        var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
        out += ' C' + f(c1x) + ' ' + f(c1y) + ' ' + f(c2x) + ' ' + f(c2y) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
      }
      return out;
    }
    function f(v){ return v.toFixed(2); }
    function centerlineD(p){ return 'M' + f(p[0][0]) + ' ' + f(p[0][1]) + smoothOpen(p); }
    function pointAt(t){
      var x = t * (pts.length - 1), i = Math.max(0, Math.min(pts.length - 2, Math.floor(x)));
      var fr = x - i, a = pts[i], b = pts[i + 1];
      return { x: a[0] + (b[0] - a[0]) * fr, y: a[1] + (b[1] - a[1]) * fr,
               nx: -(b[1] - a[1]), ny: (b[0] - a[0]) };
    }
    function leafPathD(L){
      var hw = 0.36 * L;
      return 'M0 0'
        + ' C' + f(.10*L) + ' ' + f(-.55*hw) + ' ' + f(.32*L) + ' ' + f(-1.0*hw) + ' ' + f(.56*L) + ' ' + f(-.95*hw)
        + ' C' + f(.80*L) + ' ' + f(-.90*hw) + ' ' + f(.93*L) + ' ' + f(-.50*hw) + ' ' + f(L) + ' 0'
        + ' C' + f(.93*L) + ' ' + f(.50*hw)  + ' ' + f(.80*L) + ' ' + f(.90*hw)  + ' ' + f(.56*L) + ' ' + f(.95*hw)
        + ' C' + f(.32*L) + ' ' + f(1.0*hw)  + ' ' + f(.10*L) + ' ' + f(.55*hw)  + ' 0 0 Z';
    }
    function leafVeinsD(L){
      var hw = 0.36 * L, d = '', xs = [0.26, 0.48, 0.68];
      for (var i = 0; i < xs.length; i++){
        var x = xs[i] * L, ex = x + 0.16 * L;
        d += 'M' + f(x) + ' 0 L' + f(ex) + ' ' + f(-0.62*hw) + ' M' + f(x) + ' 0 L' + f(ex) + ' ' + f(0.62*hw);
      }
      return d;
    }
    function buildLeaves(wTop, mobile){
      leaves.innerHTML = ''; leafDefs = [];
      var lis = loop.querySelectorAll('li');
      var loopTop = loop.getBoundingClientRect().top;
      var L = mobile ? 16 : 31;
      for (var i = 0; i < lis.length; i++){
        var r = lis[i].getBoundingClientRect();
        var cy = (r.top - loopTop) + r.height / 2;
        var t = Math.max(0.03, Math.min(0.985, cy / H));
        var P = pointAt(t);
        var len = Math.hypot(P.nx, P.ny) || 1, ux = P.nx / len, uy = P.ny / len;
        var side = (ux < 0) ? -1 : 1;   // always seat the leaf on the RIGHT of the shaft
        var hw = halfWidth(t, wTop);
        var ox = P.x + ux * (hw + 2.5) * side, oy = P.y + uy * (hw + 2.5) * side;
        var angle = Math.atan2(uy * side, ux * side) * 180 / Math.PI - 12 * side;
        var leaf = el('g', { opacity: 0 });
        leaf.appendChild(el('path', { d: leafPathD(L), fill: 'url(#leafGradE)',
          stroke: '#6E8C52', 'stroke-width': 0.7, 'stroke-opacity': 0.9, 'stroke-linejoin': 'round' }));
        leaf.appendChild(el('path', { d: 'M0 0 L' + f(L) + ' 0', fill: 'none',
          stroke: '#B9CE93', 'stroke-width': 0.75, 'stroke-opacity': 0.6, 'stroke-linecap': 'round' }));
        leaf.appendChild(el('path', { d: leafVeinsD(L), fill: 'none',
          stroke: '#9FB87A', 'stroke-width': 0.55, 'stroke-opacity': 0.5, 'stroke-linecap': 'round' }));
        leaves.appendChild(leaf);
        leafDefs.push({ t: t, side: side, ox: ox, oy: oy, angle: angle, g: leaf });
      }
    }
    function build(){
      var rect = loop.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var mobile = W < 560;
      var gutter = mobile ? 10 : 108;
      var amp = mobile ? 4 : 9;
      var wTop = mobile ? 5.5 : 9.5;
      pts = centerline(gutter, amp);
      silhouette.setAttribute('d', silhouetteD(pts, wTop));
      spine.setAttribute('d', centerlineD(pts));
      spine.setAttribute('stroke-width', wTop + 2);
      buildLeaves(wTop, mobile);
      var tr = mobile ? 5 : 7;
      tip.setAttribute('r', tr);
      trail1.setAttribute('r', tr * 0.82);
      trail2.setAttribute('r', tr * 0.62);
    }

    function smooth(x){ return x * x * (3 - 2 * x); }
    // overshoot for the leaf POP (back-out), clamped so it settles cleanly
    function backOut(x){ var c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }

    function tipAt(prog){ var P = pointAt(Math.max(0, Math.min(1, prog))); return P; }

    function renderProgress(off){
      var prog = Math.max(0, Math.min(1, 1 - (off / 1000)));
      if (prog <= 0.001){
        tip.setAttribute('opacity', 0); trail1.setAttribute('opacity', 0); trail2.setAttribute('opacity', 0);
      } else {
        var P = tipAt(prog);
        var vis = Math.min(1, prog / 0.06) * (prog > 0.985 ? Math.max(0, (1 - prog) / 0.015) : 1);
        tip.setAttribute('cx', f(P.x)); tip.setAttribute('cy', f(P.y));
        tip.setAttribute('opacity', 0.9 * vis);
        var T1 = tipAt(prog - 0.02), T2 = tipAt(prog - 0.045);
        trail1.setAttribute('cx', f(T1.x)); trail1.setAttribute('cy', f(T1.y));
        trail1.setAttribute('opacity', 0.45 * vis);
        trail2.setAttribute('cx', f(T2.x)); trail2.setAttribute('cy', f(T2.y));
        trail2.setAttribute('opacity', 0.22 * vis);
      }
      for (var i = 0; i < leafDefs.length; i++){
        var lf = leafDefs[i];
        var raw = Math.max(0, Math.min(1, (prog - lf.t) / 0.10));
        if (raw <= 0){ lf.g.setAttribute('opacity', 0); continue; }
        var op = smooth(raw);                 // opacity eases in cleanly
        var s = 0.06 + 0.94 * backOut(raw);   // scale POPS with a slight overshoot
        var ang = lf.angle + (1 - op) * 16 * lf.side;
        lf.g.setAttribute('transform',
          'translate(' + f(lf.ox) + ' ' + f(lf.oy) + ') rotate(' + f(ang) + ') scale(' + f(s) + ')');
        lf.g.setAttribute('opacity', f(0.92 * op));
      }
    }

    function wire(){
      if (st){ st.kill(); st = null; }
      if (reduced || !ST){
        spine.setAttribute('stroke-dashoffset', 0);
        renderProgress(0);
        return;
      }
      spine.setAttribute('stroke-dashoffset', 1000);
      renderProgress(1000);
      var proxy = { off: 1000 };
      var tween = gsap.to(proxy, {
        off: 0, ease: 'none',
        onUpdate: function(){
          spine.setAttribute('stroke-dashoffset', proxy.off);
          renderProgress(proxy.off);
        },
        scrollTrigger: { trigger: loop, start: 'top 82%', end: 'bottom 62%', scrub: 0.6 }
      });
      st = tween.scrollTrigger;
    }

    build(); wire();

    svg.__setProgress = function(off){
      spine.setAttribute('stroke-dashoffset', off);
      renderProgress(off);
    };

    var t = null;
    function onResize(){
      if (t) clearTimeout(t);
      t = setTimeout(function(){ build(); wire(); if (ST) ST.refresh(); }, 150);
    }
    window.addEventListener('resize', onResize);
  };
})();
