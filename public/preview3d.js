/* 3D preview for the online estimate — the same scene the Measure App draws.

   A customer-facing picture: the window as entered, set in a piece of wall under
   an eave and seen from slightly to one side.

   No 3D library. The browser already does perspective on flat elements, so the
   scene is plain boxes: every visible face is one element placed with a 3D
   transform, and the wall is a photo tiled at its real size. All of it is laid
   out in millimetres, so the window is to scale against the wall — a 4" siding
   board is 4" next to it.

   Exposes window.Preview3D.render(host, win, opt, waitText)
     win: { W, H, units:[{ x, w, kind:'sash' | 'picture' | 'fixed' }], joints:[x, ...] }   — millimetres over the frames;
          a unit is its own frame, x from the left frame edge; joints are the centres between frames
     opt: { wall:'brick1' | ... | 'stucco', stucco:'#rrggbb', color:'#rrggbb', roof:'rooftan' | ... } */
(function () {
  'use strict';

  var TEX_BASE = '/tex/';

  /* Real size of one repeat of each wall photo, in mm. Change a photo and this
     has to change. Stucco is the relief only, in greys around mid-grey; the
     chosen colour is lit through it. */
  var V3_TEX = {
    brick1: { w: 1378, h: 1378 }, brick2: { w: 1071, h: 1071 }, brick3: { w: 902, h: 480 },
    rooftan: { w: 447, h: 305 }, roofbrown: { w: 462, h: 305 }, roofgrey: { w: 642, h: 508 }, roofcharcoal: { w: 441, h: 305 },
    siding1: { w: 676, h: 610 }, siding2: { w: 676, h: 610 }, siding3: { w: 681, h: 610 }, siding4: { w: 676, h: 610 },
    siding5: { w: 676, h: 610 }, siding7: { w: 681, h: 610 }, siding8: { w: 553, h: 406 },
    stucco: { w: 800, h: 800 }
  };
  /* each roof photo's average colour — what the roof fades to in the distance */
  var V3_ROOF_RGB = { rooftan: '124,101,78', roofbrown: '75,66,58', roofgrey: '120,124,121', roofcharcoal: '43,46,49' };

  /* The GP363 reno brickmould stands 41.7 mm past the frame edge, outside the size entered.
     The face of its cap is the front-most surface, this far proud of the wall. */
  var V3_BM = 41.7;
  var V3_PROUD = 30;

  /* The eave over the window, mm: soffit 15" above the window, 12" overhang,
     4" fascia with an eavestrough, roof at a 6/12 pitch. */
  var V3_EAVE_ABOVE = 381, V3_OVERHANG = 305, V3_FASCIA = 102;
  var V3_GUTTER_H = 88, V3_GUTTER_D = 115;
  var V3_ROOF_PITCH = 26.57;
  var V3_TRIM = '#f4f5f3';
  var V3_ROOF = '#4b4e53';
  /* the eye is low, as for someone standing in the yard looking up */
  var V3_EYE = '50% 92%';
  /* how much of the picture the window takes up */
  var V3_FILL = { w: 0.74, h: 0.57 };
  var V3_ROOF_SHOW = 150;      // mm of height kept clear above the fascia, so the roof is in view
  var V3_STAGE = 0.8;          // the picture's height as a share of its width

  function hex2rgb(h) {
    return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  }
  function shade(hex, f) {
    return 'rgb(' + hex2rgb(hex).map(function (v) { return Math.max(0, Math.min(255, Math.round(v * f))); }).join(',') + ')';
  }

  function eave(face, roofFace, n, x0, len, out, opt) {
    var yS = -V3_EAVE_ABOVE, yF = yS - V3_FASCIA;
    /* soffit, seen from underneath: in shade, darkest against the wall */
    face(x0, yS, 0, len, out, ' rotateX(90deg)',
      'linear-gradient(180deg,' + shade(V3_TRIM, 0.80) + ',' + shade(V3_TRIM, 0.93) + ')');
    face(x0, yF, out, len, V3_FASCIA, '', shade(V3_TRIM, 0.90));
    /* eavestrough: its underside, then its face with the rolled lip catching the light */
    var gy = yF + 5;
    face(x0, gy + V3_GUTTER_H, out, len, V3_GUTTER_D, ' rotateX(90deg)', shade(V3_TRIM, 0.70));
    face(x0, gy, out + V3_GUTTER_D, len, V3_GUTTER_H, '',
      'linear-gradient(180deg,' + shade(V3_TRIM, 1.04) + ' 0%,' + shade(V3_TRIM, 0.99) + ' 16%,' + shade(V3_TRIM, 0.90) + ' 24%,' +
      shade(V3_TRIM, 0.97) + ' 62%,' + shade(V3_TRIM, 0.86) + ' 100%)');
    /* The roof: one plane, its bottom edge on the top of the fascia, laid back
       at the pitch. The shingle photo is only shown near the eave and fades
       into the roof's own colour above that — further up, the rows get closer
       together than screen pixels and a repeating photo draws rings. */
    var R = V3_TEX[opt.roof], L = opt.roofLen || 9000, s = V3_ROOF_PITCH * Math.PI / 180;
    var rc = V3_ROOF_RGB[opt.roof] || '75,75,78';
    var fade = 'linear-gradient(0deg,rgba(' + rc + ',0) 0,rgba(' + rc + ',0) ' + n(700) + 'px,rgba(' + rc + ',.94) ' + n(3200) + 'px,rgba(' + rc + ',.94) 100%)';
    var bg = R ? fade + ',url(' + (opt.roofURL || (TEX_BASE + opt.roof + '.webp')) + ') left bottom/' + n(R.w) + 'px ' + n(R.h) + 'px,rgb(' + rc + ')'
               : V3_ROOF;
    var ext = L * 0.7;   // wider than the wall on both sides, so its far end never stops short of the picture's edge
    roofFace(x0 - ext, yF - L * Math.sin(s), out + V3_GUTTER_D * 0.45 - L * Math.cos(s), len + 2 * ext, L,
      ' rotateX(' + (90 - V3_ROOF_PITCH) + 'deg)', bg);
  }

  function scale(win, SW, SH) {
    /* also far enough back that the eave, and a strip of roof over it, stay in
       the picture: the window's centre sits 58% of the way down, and everything
       from there up to the roof has to fit above it */
    var up = win.H / 2 + V3_BM + V3_EAVE_ABOVE + V3_FASCIA + V3_ROOF_SHOW;
    return Math.min(SW * V3_FILL.w / (win.W + 2 * V3_BM), SH * V3_FILL.h / (win.H + 2 * V3_BM), SH * 0.58 / up);   // px per mm
  }

  function build(win, opt, SW, SH) {
    var B = V3_BM, W = win.W + 2 * B, H = win.H + 2 * B;   // overall, brickmould included
    var stucco = (opt.wall === 'stucco');
    var k = scale(win, SW, SH);
    var P = SW * 2.3;                                                   // viewing distance
    var zB = V3_PROUD;                                                  // cap face, in front of the wall
    var col = opt.color || '#f4f5f3';
    /* light from the upper left, viewer to the right: faces turned toward the
       viewer's side are in shade, which is what makes the depth read */
    var L = { up: 1.05, down: 0.60, left: 0.93, right: 0.72 };

    var out = [], roofOut = [];
    function n(v) { return Math.round(v * k * 100) / 100; }
    function el(x, y, z, wd, ht, rot, bg, extra) {
      return '<i style="width:' + n(wd) + 'px;height:' + n(ht) + 'px;transform:translate3d(' + n(x) + 'px,' + n(y) + 'px,' + n(z) + 'px)' +
        (rot || '') + ';background:' + bg + (extra ? ';' + extra : '') + '"></i>';
    }
    function face(x, y, z, wd, ht, rot, bg, extra) {
      if (wd <= 0 || ht <= 0) return;
      out.push(el(x, y, z, wd, ht, rot, bg, extra));
    }
    /* The roof goes in a world of its own, drawn first. It is behind everything
       else from this viewpoint, and it cuts through the planes of the wall and
       the fascia: Chrome has to split it to sort it against them, and drops it
       instead. On its own it needs no sorting. */
    function roofFace(x, y, z, wd, ht, rot, bg) { roofOut.push(el(x, y, z, wd, ht, rot, bg)); }
    var RY = ' rotateY(-90deg)', RX = ' rotateX(90deg)';
    /* a rectangular ring of solid: the front, the four faces looking in at the
       hole and the four looking out */
    function ring(x, y, wd, ht, tT, tS, tB, z0, z1, c) {
      var d = z1 - z0, ih = ht - tT - tB, iw = wd - 2 * tS;
      /* the front is one element with the middle clipped out — four butted
         pieces leave hairline gaps at the corners */
      face(x, y, z1, wd, ht, '',
        'linear-gradient(180deg,' + shade(c, 1.02) + ',' + shade(c, 0.955) + ')',
        'clip-path:polygon(evenodd,0 0,' + n(wd) + 'px 0,' + n(wd) + 'px ' + n(ht) + 'px,0 ' + n(ht) + 'px,0 0,' +
        n(tS) + 'px ' + n(tT) + 'px,' + n(tS) + 'px ' + n(ht - tB) + 'px,' + n(wd - tS) + 'px ' + n(ht - tB) + 'px,' + n(wd - tS) + 'px ' + n(tT) + 'px,' + n(tS) + 'px ' + n(tT) + 'px)');
      if (d <= 0) return;
      face(x + tS, y + tT, z0, d, ih, RY, shade(c, L.right));       // inner, left member
      face(x + wd - tS, y + tT, z0, d, ih, RY, shade(c, L.left));   // inner, right member
      face(x + tS, y + tT, z0, iw, d, RX, shade(c, L.down));        // inner, head
      face(x + tS, y + ht - tB, z0, iw, d, RX, shade(c, L.up));     // inner, sill
      face(x, y, z0, d, ht, RY, shade(c, L.left));                  // outer left
      face(x + wd, y, z0, d, ht, RY, shade(c, L.right));            // outer right
      face(x, y, z0, wd, d, RX, shade(c, L.up));                    // outer top
      face(x, y + ht, z0, wd, d, RX, shade(c, L.down));             // outer bottom
    }

    /* --- wall: one element with the opening clipped out, so the courses line
       up all the way round; it stops at the soffit --- */
    var Mx = SW * 1.9 / k, My = SH * 1.7 / k, MyT = V3_EAVE_ABOVE;
    var T = V3_TEX[opt.wall] || V3_TEX.brick1;
    /* the photo, with a plain colour under it in case the photo is not there.
       For stucco that colour is the point: hard-light lets the grey relief
       darken and lighten it, so one photo serves every stucco colour. */
    var wallCss = 'url(' + (opt.texURL || (TEX_BASE + opt.wall + '.webp')) + ') 0 0/' + n(T.w) + 'px ' + n(T.h) + 'px,' +
      (stucco ? (opt.stucco || '#d4c4a8') : '#8d8a86');
    var ww = W + 2 * Mx, wh = H + MyT + My;
    function pt(x, y) { return n(x + Mx) + 'px ' + n(y + MyT) + 'px'; }
    face(-Mx, -MyT, 0, ww, wh, '', wallCss,
      (stucco ? 'background-blend-mode:hard-light;' : '') + 'clip-path:polygon(evenodd,0 0,' + n(ww) + 'px 0,' + n(ww) + 'px ' + n(wh) + 'px,0 ' + n(wh) + 'px,0 0,' +
      pt(B / 2, B / 2) + ',' + pt(B / 2, H - B / 2) + ',' + pt(W - B / 2, H - B / 2) + ',' + pt(W - B / 2, B / 2) + ',' + pt(B / 2, B / 2) + ')');
    /* the shade the eave throws down the wall, laid just proud of it */
    face(-Mx, -V3_EAVE_ABOVE, 0.4 / k, ww, 430, '', 'linear-gradient(180deg,rgba(0,0,0,.46),rgba(0,0,0,.20) 45%,rgba(0,0,0,0))');
    eave(face, roofFace, n, -Mx, ww, V3_OVERHANG, opt);

    /* ===== The window itself, from the real Praxis profiles =====
       R8543 casement frame with the GP333 sash, R8544 picture frame, a TSL08 cover over each
       joint between frames, and the GP363 reno brickmould with its GP364 cap all round.
       Numbers are millimetres off the profile drawings: "across" is measured from the outer edge
       of a unit's frame toward its glass, "back" from the front-most surface (the cap face). */
    var SEAL = '#17191b';
    function Z(back) { return zB - back; }
    var FX = B, FY = B, FW = W - 2 * B, FH = H - 2 * B;      // the coupled frames: the size entered
    /* what the brickmould throws on the wall */
    var sh = Math.max(1.5, zB * k);
    face(0, 0, 0.05 / k, W, H, '', 'transparent',
      'box-shadow:' + (sh * 0.9).toFixed(1) + 'px ' + (sh * 1.2).toFixed(1) + 'px ' + (sh * 1.4 + 3).toFixed(1) + 'px rgba(0,0,0,.42),0 0 ' +
      (sh * 0.8 + 4).toFixed(1) + 'px rgba(0,0,0,.28)');
    face(FX, FY, Z(70), FW, FH, '', '#15181b');             // the dark behind everything

    win.units.forEach(function (u) {
      var x = FX + u.x, y = FY, uw = u.w, uh = FH, g, zG;
      /* a very small unit cannot hold full-size members: shrink them together rather than overlap */
      var f = Math.min(1, Math.min(uw, uh) / 200);
      function a(v) { return v * f; }
      var groove = 'box-shadow:inset 0 0 0 ' + Math.max(0.7, n(0.8)) + 'px rgba(0,0,0,.13)';
      if (u.kind === 'sash') {
        ring(x, y, uw, uh, a(14), a(14), a(14), Z(45.2), Z(32.9), col);                                   // R8543: only a sliver shows
        ring(x + a(14), y + a(14), uw - a(28), uh - a(28), a(7), a(7), a(7), Z(45.4), Z(44.9), SEAL);     // black seal round the sash
        ring(x + a(19.4), y + a(19.4), uw - a(38.8), uh - a(38.8), a(57.5), a(57.5), a(57.5), Z(53.3), Z(37.5), col);   // GP333 sash
        face(x + a(55.2), y + a(55.2), Z(37.45), uw - a(110.4), uh - a(110.4), '', 'transparent', groove);              // the V-groove on its face
        g = a(78.9); zG = Z(54.8);
      } else if (u.kind === 'fixed') {
        /* R8545: the fixed frame. Its wide face is flush with the frame face and matches a casement's
           sightline; a narrow sealed channel runs where a casement has the gap round its sash. */
        ring(x, y, uw, uh, a(14.1), a(14.1), a(14.1), Z(41.9), Z(32.9), col);
        ring(x + a(14.1), y + a(14.1), uw - a(28.2), uh - a(28.2), a(6.1), a(6.1), a(6.1), Z(42.1), Z(41.7), SEAL);
        ring(x + a(20.2), y + a(20.2), uw - a(40.4), uh - a(40.4), a(56.5), a(56.5), a(56.5), Z(48.7), Z(32.9), col);
        face(x + a(55), y + a(55), Z(32.85), uw - a(110), uh - a(110), '', 'transparent', groove);
        g = a(78.7); zG = Z(51.4);
      } else {
        ring(x, y, uw, uh, a(17.2), a(17.2), a(17.2), Z(37.4), Z(32.9), col);                             // R8544, outer face
        ring(x + a(17.2), y + a(17.2), uw - a(34.4), uh - a(34.4), a(23.4), a(23.4), a(23.4), Z(53.2), Z(37.4), col);   // its glazing leg
        face(x + a(20.6), y + a(20.6), Z(37.35), uw - a(41.2), uh - a(41.2), '', 'transparent', groove);
        g = a(42.7); zG = Z(54.7);
      }
      face(x + g - 1.1, y + g - 1.1, zG + 0.6, uw - 2 * g + 2.2, uh - 2 * g + 2.2, '', SEAL);              // seal lip against the glass
      /* glass: sky up top, the dark of the room below, one streak of reflection,
         and the shadow the head and jamb drop onto it */
      face(x + g, y + g, zG + 0.8, uw - 2 * g, uh - 2 * g, '',
        'linear-gradient(118deg, rgba(255,255,255,0) 30%, rgba(255,255,255,.20) 41%, rgba(255,255,255,.05) 52%, rgba(255,255,255,0) 60%),' +
        'linear-gradient(172deg, #a7bfd1 0%, #7391a7 34%, #3d5266 78%, #2c3c4c 100%)',
        'box-shadow:inset ' + n(7) + 'px ' + n(11) + 'px ' + n(14) + 'px rgba(0,0,0,.40)');
    });

    /* TSL08 joint covers: there is no mullion, each unit is its own frame */
    (win.joints || []).forEach(function (jc) {
      var x = FX + jc - 8.4;
      face(x, FY, Z(32.9), 2.4, FH, RY, shade(col, L.left));
      face(x + 16.8, FY, Z(32.9), 2.4, FH, RY, shade(col, L.right));
      face(x, FY, Z(30.5), 16.8, FH, '', 'linear-gradient(90deg,' + shade(col, 0.97) + ',' + shade(col, 1.02) + ' 30%,' + shade(col, 0.95) + ')');
    });

    /* shadow of the brickmould on the frames, then the brickmould and its cap */
    face(FX + 8.8, FY + 8.8, Z(32.9) + 0.3, FW - 17.6, FH - 17.6, '', 'transparent',
      'box-shadow:inset ' + Math.max(1.2, n(10)).toFixed(1) + 'px ' + Math.max(1.6, n(14)).toFixed(1) + 'px ' + Math.max(2, n(16)).toFixed(1) +
      'px rgba(0,0,0,.30)');
    ring(0, 0, W, H, 50.5, 50.5, 50.5, Z(32.9), Z(4.6), col);     // GP363
    ring(0, 0, W, H, 25, 25, 25, Z(4.6), Z(0), col);              // GP364 cap
    face(25, 25, Z(4.6) + 0.2, W - 50, H - 50, '', 'transparent', 'box-shadow:inset ' + n(2) + 'px ' + n(3) + 'px ' + n(4) + 'px rgba(0,0,0,.22)');

    var world = '<div class="v3-world" style="top:58%;transform:rotateY(-24deg) translate3d(' + n(-W / 2) + 'px,' + n(-H / 2) + 'px,0)">';
    return '<div class="v3-stage" style="height:' + SH + 'px;perspective:' + Math.round(P) + 'px;perspective-origin:' + V3_EYE + '">' +
      world + roofOut.join('') + '</div>' + world + out.join('') + '</div>' +
      '<div class="v3-light"></div></div>';
  }

  /* The wall photo, resampled to the size it will actually be shown at.

     A thin dark line in the photo — the shadow under a siding board, a mortar
     joint — can end up narrower than a screen pixel once the wall is drawn
     small. The browser scales a background by sampling, not averaging, so that
     line comes out dashed and crawls as the wall recedes. Shrinking the tile
     properly first, in steps, averages it instead. */
  var texCache = {}, texCount = 0, imgCache = {};
  function loadImg(name, done) {
    var e = imgCache[name];
    if (e && e.img) return done(e.img);
    if (e) { e.q.push(done); return; }
    e = imgCache[name] = { q: [done], img: null };
    var img = new Image();
    img.onload = function () { e.img = img; e.q.splice(0).forEach(function (f) { f(img); }); };
    img.onerror = function () { delete imgCache[name]; e.q.splice(0).forEach(function (f) { f(null); }); };
    img.src = TEX_BASE + name + '.webp';
  }
  function tex(name, pxW, pxH, done) {
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var tw = Math.max(8, Math.round(pxW * dpr)), th = Math.max(8, Math.round(pxH * dpr));
    var key = name + '|' + tw + '|' + th;
    if (texCache[key]) return done(texCache[key]);
    loadImg(name, function (img) {
      if (!img) return done(null);
      if (texCount > 60) { texCache = {}; texCount = 0; }   // sizes change as the customer types; do not hoard them
      texCount++;
      if (tw >= img.naturalWidth && th >= img.naturalHeight) return done(texCache[key] = img.src);
      var src = img, sw = img.naturalWidth, sh = img.naturalHeight;
      try {
        for (;;) {
          var nw = Math.max(tw, Math.ceil(sw / 2)), nh = Math.max(th, Math.ceil(sh / 2));
          var c = document.createElement('canvas'); c.width = nw; c.height = nh;
          var x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
          x.drawImage(src, 0, 0, sw, sh, 0, 0, nw, nh);
          src = c; sw = nw; sh = nh;
          if (nw === tw && nh === th) break;
        }
        done(texCache[key] = src.toDataURL('image/jpeg', 0.9));
      } catch (err) { done(img.src); }
    });
  }

  /* Draws the view into host. Safe to call again before the last call has
     finished: only the newest one lands. */
  function render(host, win, opt, waitText) {
    var SW = host.clientWidth;
    if (!SW || !(win.W > 0) || !(win.H > 0)) return;
    var SH = Math.round(SW * V3_STAGE);
    var token = host._v3 = (host._v3 || 0) + 1;
    var o = { wall: opt.wall, stucco: opt.stucco, color: opt.color, roof: opt.roof };
    var T = V3_TEX[o.wall] || V3_TEX.brick1, R = V3_TEX[o.roof] || V3_TEX.rooftan, k = scale(win, SW, SH);
    if (!host.firstElementChild) host.innerHTML = '<div class="v3-wait" style="height:' + SH + 'px">' + (waitText || '') + '</div>';
    tex(o.wall, T.w * k, T.h * k, function (url) {
      /* The roof is seen at a shallow angle, which squeezes its rows together
         on screen, so its photo is shrunk further top to bottom than its size
         in the scene would call for — otherwise the rows shimmer. */
      tex(o.roof, R.w * k * 0.7, R.h * k * 0.28, function (roofURL) {
        if (host._v3 !== token) return;
        o.texURL = url;
        o.roofURL = roofURL;
        o.roofLen = SH * 6 / k;     // long enough, in mm, to run off the top of the picture at any scale
        host.innerHTML = build(win, o, SW, SH);
      });
    });
  }

  window.Preview3D = { render: render };
})();
