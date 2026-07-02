(function(){
  // A single branch grows DOWN the method-section gutter as you scroll, replacing the
  // old taproot. Same engine as before: a tapered silhouette (thick woody base -> fine
  // living tip) is used as a CLIP; a stroke is "drawn on" along the centerline via
  // stroke-dashoffset, scrub-linked to scroll, so the growing tip is always POINTED and
  // there is no perpetual canvas loop (scrolling stays smooth). NEW: one leaf per step
  // (5), anchored to each <li>, that unfurls (scale + rotate from its petiole) as the
  // growing tip passes it — so reaching a step visibly sprouts its leaf.
  // Requires gsap + ScrollTrigger. Exposes window.mountBranchSpine(loopEl, { reduced }).
  var SVGNS = 'http://www.w3.org/2000/svg';

  window.mountBranchSpine = function(loop, opts){
    opts = opts || {};
    var reduced = !!opts.reduced;
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (!gsap) throw new Error('branch-spine: GSAP not loaded.');
    if (ST && gsap.registerPlugin) gsap.registerPlugin(ST);

    function el(name, attrs){
      var n = document.createElementNS(SVGNS, name);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    }

    // ---- svg overlay, sized to the loop in CSS px ----
    var svg = el('svg', { 'class': 'branch-spine', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
    var defs = el('defs', {});

    // soft glow / drop-shadow — lifts the branch off the deep-green bg with crisp edges
    // plus a low, cool pine halo. Padded so the blur isn't clipped.
    var filt = el('filter', { id: 'branchGlow', x: '-60%', y: '-8%', width: '220%', height: '116%',
                              filterUnits: 'objectBoundingBox', 'color-interpolation-filters': 'sRGB' });
    filt.appendChild(el('feGaussianBlur', { 'in': 'SourceAlpha', stdDeviation: '3.0', result: 'blur' }));
    filt.appendChild(el('feColorMatrix', { 'in': 'blur', type: 'matrix', result: 'halo',
      // faint living-pine shadow instead of pure black, ~32% alpha
      values: '0 0 0 0 0.24  0 0 0 0 0.40  0 0 0 0 0.28  0 0 0 0.32 0' }));
    var merge = el('feMerge', {});
    merge.appendChild(el('feMergeNode', { 'in': 'halo' }));
    merge.appendChild(el('feMergeNode', { 'in': 'SourceGraphic' }));
    filt.appendChild(merge);
    defs.appendChild(filt);

    var clip = el('clipPath', { id: 'branchShape', clipPathUnits: 'userSpaceOnUse' });
    var silhouette = el('path', { d: '' });               // tapered outline -> defines the taper
    clip.appendChild(silhouette);

    // stem gradient: woody pine at the base -> leaf-green shaft -> luminous moss tip
    var grad = el('linearGradient', { id: 'branchGrad', x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(el('stop', { offset: '0',    'stop-color': '#24402B', 'stop-opacity': '0.97' }));
    grad.appendChild(el('stop', { offset: '0.5',  'stop-color': '#37623F', 'stop-opacity': '0.92' }));
    grad.appendChild(el('stop', { offset: '0.82', 'stop-color': '#5C8150', 'stop-opacity': '0.86' }));
    grad.appendChild(el('stop', { offset: '1',    'stop-color': '#86A566', 'stop-opacity': '0.78' }));
    defs.appendChild(clip); defs.appendChild(grad);

    // blade gradient: shaded near the petiole -> lit toward the tip (petiole=left, tip=right)
    var leafGrad = el('linearGradient', { id: 'leafGrad', x1: 0, y1: 0, x2: 1, y2: 0 });
    leafGrad.appendChild(el('stop', { offset: '0',   'stop-color': '#2F5537', 'stop-opacity': '0.96' }));
    leafGrad.appendChild(el('stop', { offset: '0.5', 'stop-color': '#4C7A50', 'stop-opacity': '0.94' }));
    leafGrad.appendChild(el('stop', { offset: '1',   'stop-color': '#77974F', 'stop-opacity': '0.9'  }));
    defs.appendChild(leafGrad);

    // faint radial for the luminous leading tip
    var tipGrad = el('radialGradient', { id: 'branchTip', cx: '0.5', cy: '0.5', r: '0.5' });
    tipGrad.appendChild(el('stop', { offset: '0',   'stop-color': '#F1E7B0', 'stop-opacity': '0.9' }));
    tipGrad.appendChild(el('stop', { offset: '0.5', 'stop-color': '#B7CF8F', 'stop-opacity': '0.42' }));
    tipGrad.appendChild(el('stop', { offset: '1',   'stop-color': '#B7CF8F', 'stop-opacity': '0' }));
    defs.appendChild(tipGrad);

    svg.appendChild(defs);

    // group everything drawable so the glow wraps the whole form as one
    var g = el('g', { filter: 'url(#branchGlow)' });

    var spine = el('path', {                               // stroke drawn along the centerline
      d: '', fill: 'none', stroke: 'url(#branchGrad)',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      pathLength: 1000, 'stroke-dasharray': '1000 1000', 'stroke-dashoffset': 1000,
      'clip-path': 'url(#branchShape)'
    });
    g.appendChild(spine);

    // one leaf per step, revealed as the growth passes it (built in build())
    var leaves = el('g', {});
    g.appendChild(leaves);

    // luminous leading tip that rides the growing end
    var tip = el('circle', { r: 0, fill: 'url(#branchTip)', opacity: 0 });
    g.appendChild(tip);

    svg.appendChild(g);
    loop.insertBefore(svg, loop.firstChild);

    var W = 0, H = 0, st = null, pts = [];
    var leafDefs = [];   // { t, side, ox, oy, angle, g }

    // gently-bending centerline from the top edge to the bottom of the list: plumb +
    // attached at the base, one soft lean through the upper-middle, then settles back
    // near-plumb so the fine tip drops straight down.
    function centerline(gutter, amp){
      var N = 160, p = [];
      for (var i = 0; i <= N; i++){
        var t = i / N, y = t * H;
        var w = Math.sin(Math.pow(t, 0.82) * Math.PI);   // 0..1..0, biased earlier
        var bend = w * w * (0.6 + 0.4 * (1 - t));         // squared -> soft shoulders
        p.push([gutter + bend * amp, y, t]);
      }
      return p;
    }

    // half-width profile of a woody branch: broad base, then a long, gradually narrowing
    // shaft to a fine growing point. Stays thick up top, tapers late.
    function halfWidth(t, wTop){
      var base = 1 + 0.5 * Math.exp(-t * 14);                        // broader woody base flare
      var taper = Math.pow(1 - t, 1.35) * (0.55 + 0.45 * (1 - t));   // long fine point
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

    // Catmull-Rom -> cubic bezier for a rail (assumes starts at rail[0], already moved-to)
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

    // interpolate a centerline point + local normal at parametric t (0..1)
    function pointAt(t){
      var x = t * (pts.length - 1), i = Math.max(0, Math.min(pts.length - 2, Math.floor(x)));
      var fr = x - i, a = pts[i], b = pts[i + 1];
      return {
        x: a[0] + (b[0] - a[0]) * fr,
        y: a[1] + (b[1] - a[1]) * fr,
        nx: -(b[1] - a[1]), ny: (b[0] - a[0])   // normal (perp to tangent)
      };
    }

    // a plump ovate leaf in local space: petiole at (0,0), pointing along +x, length L
    function leafPathD(L){
      var hw = 0.36 * L;   // fuller blade so the veined detail reads at section scale
      return 'M0 0'
        + ' C' + f(.10*L) + ' ' + f(-.55*hw) + ' ' + f(.32*L) + ' ' + f(-1.0*hw) + ' ' + f(.56*L) + ' ' + f(-.95*hw)
        + ' C' + f(.80*L) + ' ' + f(-.90*hw) + ' ' + f(.93*L) + ' ' + f(-.50*hw) + ' ' + f(L) + ' 0'
        + ' C' + f(.93*L) + ' ' + f(.50*hw)  + ' ' + f(.80*L) + ' ' + f(.90*hw)  + ' ' + f(.56*L) + ' ' + f(.95*hw)
        + ' C' + f(.32*L) + ' ' + f(1.0*hw)  + ' ' + f(.10*L) + ' ' + f(.55*hw)  + ' 0 0 Z';
    }

    // side veins branching off the midrib toward the tip
    function leafVeinsD(L){
      var hw = 0.36 * L, d = '', xs = [0.26, 0.48, 0.68];
      for (var i = 0; i < xs.length; i++){
        var x = xs[i] * L, ex = x + 0.16 * L;
        d += 'M' + f(x) + ' 0 L' + f(ex) + ' ' + f(-0.62*hw)
           + ' M' + f(x) + ' 0 L' + f(ex) + ' ' + f(0.62*hw);
      }
      return d;
    }

    // build the five leaves, one anchored at each step's <li> center, alternating sides
    function buildLeaves(wTop, mobile){
      leaves.innerHTML = '';
      leafDefs = [];
      var lis = loop.querySelectorAll('li');
      var loopTop = loop.getBoundingClientRect().top;
      var L = mobile ? 16 : 31;
      for (var i = 0; i < lis.length; i++){
        var r = lis[i].getBoundingClientRect();
        var cy = (r.top - loopTop) + r.height / 2;
        var t = Math.max(0.03, Math.min(0.985, cy / H));
        var side = mobile ? 1 : (i % 2 === 0 ? 1 : -1);   // mobile: all right, inside the indent
        var P = pointAt(t);
        var len = Math.hypot(P.nx, P.ny) || 1, ux = P.nx / len, uy = P.ny / len;
        var hw = halfWidth(t, wTop);
        // seat the petiole just clear of the shaft edge so the blade never sits under the title
        var ox = P.x + ux * (hw + 2.5) * side, oy = P.y + uy * (hw + 2.5) * side;
        // outward angle along the normal, then a gentle lean toward the light (up)
        var angle = Math.atan2(uy * side, ux * side) * 180 / Math.PI - 12 * side;

        var leaf = el('g', { opacity: 0 });
        leaf.appendChild(el('path', { d: leafPathD(L), fill: 'url(#leafGrad)',
          stroke: '#6E8C52', 'stroke-width': 0.7, 'stroke-opacity': 0.9, 'stroke-linejoin': 'round' }));
        leaf.appendChild(el('path', { d: 'M0 0 L' + f(L) + ' 0', fill: 'none',
          stroke: '#B9CE93', 'stroke-width': 0.75, 'stroke-opacity': 0.6, 'stroke-linecap': 'round' }));
        leaf.appendChild(el('path', { d: leafVeinsD(L), fill: 'none',
          stroke: '#9FB87A', 'stroke-width': 0.55, 'stroke-opacity': 0.5, 'stroke-linecap': 'round' }));
        // reserved sun sparkle: a short warm accent along the midrib base
        leaf.appendChild(el('path', { d: 'M' + f(0.04*L) + ' 0 L' + f(0.36*L) + ' 0', fill: 'none',
          stroke: '#EDD98C', 'stroke-width': 0.8, 'stroke-opacity': 0.26, 'stroke-linecap': 'round' }));
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
      var gutter = mobile ? 10 : 108;   // mobile: inside the 28px content indent, clear of text
      var amp = mobile ? 4 : 9;
      var wTop = mobile ? 5.5 : 9.5;    // woodier shaft so it reads as a branch, not a vine

      pts = centerline(gutter, amp);
      silhouette.setAttribute('d', silhouetteD(pts, wTop));
      spine.setAttribute('d', centerlineD(pts));
      spine.setAttribute('stroke-width', wTop + 2);       // wider than silhouette; clip trims it

      buildLeaves(wTop, mobile);
      tip.setAttribute('r', mobile ? 5 : 7);
    }

    function ease(x){ return x * x * (3 - 2 * x); }       // smoothstep

    // reflect current growth (offset 0..1000) onto tip position + leaf unfurl
    function renderProgress(off){
      var prog = Math.max(0, Math.min(1, 1 - (off / 1000)));  // 0 = ungrown, 1 = full
      if (prog <= 0.001){
        tip.setAttribute('opacity', 0);
      } else {
        var P = pointAt(prog);
        tip.setAttribute('cx', f(P.x));
        tip.setAttribute('cy', f(P.y));
        var vis = Math.min(1, prog / 0.06) * (prog > 0.985 ? Math.max(0, (1 - prog) / 0.015) : 1);
        tip.setAttribute('opacity', 0.85 * vis);
      }
      for (var i = 0; i < leafDefs.length; i++){
        var lf = leafDefs[i];
        var local = ease(Math.max(0, Math.min(1, (prog - lf.t) / 0.10)));  // unfurl after passing
        if (local <= 0){ lf.g.setAttribute('opacity', 0); continue; }
        var s = 0.06 + 0.94 * local;
        var ang = lf.angle + (1 - local) * 16 * lf.side;    // folded -> open
        lf.g.setAttribute('transform',
          'translate(' + f(lf.ox) + ' ' + f(lf.oy) + ') rotate(' + f(ang) + ') scale(' + f(s) + ')');
        lf.g.setAttribute('opacity', f(0.92 * local));
      }
    }

    function wire(){
      if (st){ st.kill(); st = null; }
      if (reduced || !ST){
        spine.setAttribute('stroke-dashoffset', 0);       // fully grown, static, all leaves open
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

    // test hook: lets a headless harness drive growth faithfully (tip + leaves),
    // matching what scroll produces. no effect on normal use.
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
