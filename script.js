(function () {
  const docEl = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Low-end device detection ──
     Disable the heaviest visual effects (Spline WebGL, starfield, blobs,
     ScrollAura) on devices that are likely to struggle. Saves 60fps of
     paint cost on integrated GPUs / older mobile chips. */
  const lowEnd =
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
  if (lowEnd) docEl.classList.add("low-end");
  const heavyOK = !reduce && !lowEnd;
  const header = document.querySelector(".site-header");
  const intro = document.getElementById("intro");
  const site = document.getElementById("site");
  const skipIntro = document.getElementById("skipIntro");
  // cursorGlow / cursorDot removed — no custom cursor anymore.
  const heroLead = document.getElementById("heroLead");
  const heroCta = document.getElementById("heroCta");
  let introFinished = false;
  const introTimers = [];
  let introLogoRaf = 0;

  function armIntro(fn, ms) {
    introTimers.push(setTimeout(fn, ms));
  }

  function clearIntroTimers() {
    if (introLogoRaf) {
      cancelAnimationFrame(introLogoRaf);
      introLogoRaf = 0;
    }
    while (introTimers.length) clearTimeout(introTimers.pop());
  }

  function heroFadeIn() {
    if (!heroLead || !heroCta) return;
    setTimeout(() => heroLead.classList.add("is-in"), reduce ? 0 : 220);
    setTimeout(() => heroCta.classList.add("is-in"), reduce ? 0 : 480);
  }

  /* Spline 3D supprimé — plus de WebGL en fond. */
  function bootSpline() {}

  function finishIntro(immediate) {
    if (introFinished) return;
    introFinished = true;
    clearIntroTimers();
    bootSpline();

    if (intro) {
      intro.classList.add("intro--stage-logo", "intro--stage-line", "intro--stage-hint");
      intro.setAttribute("aria-busy", "false");
      if (immediate) intro.classList.add("intro--instant");
      intro.classList.add("intro--hide");
    }
    if (site) site.classList.add("is-ready");
    docEl.classList.remove("intro-lock");
    docEl.classList.add("intro-done");
    if (intro) {
      intro.setAttribute("aria-hidden", "true");
      intro.setAttribute("inert", "");
    }
    if (skipIntro) skipIntro.hidden = true;
    heroFadeIn();
  }

  if (reduce) {
    finishIntro(true);
  } else if (intro) {
    introLogoRaf = requestAnimationFrame(() => {
      introLogoRaf = 0;
      intro.classList.add("intro--stage-logo");
    });
    armIntro(() => intro.classList.add("intro--stage-line"), 980);
    armIntro(() => intro.classList.add("intro--stage-hint"), 2080);
    armIntro(() => {
      if (site) site.classList.add("is-ready");
    }, 3400);
    armIntro(() => intro.classList.add("intro--hide"), 3800);
    armIntro(() => finishIntro(false), 5400);
  } else {
    finishIntro(true);
  }

  if (skipIntro) {
    skipIntro.addEventListener("click", () => finishIntro(true));
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && docEl.classList.contains("intro-lock") && !introFinished) {
      finishIntro(true);
    }
  });

  /* Starfield */
  const canvas = document.getElementById("starfield");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    let stars = [];
    let w = 0;
    let h = 0;
    let raf = 0;

    function resize() {
      cancelAnimationFrame(raf);
      w = canvas.width = Math.floor(window.innerWidth * window.devicePixelRatio);
      h = canvas.height = Math.floor(window.innerHeight * window.devicePixelRatio);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      // Le sprite est recalculé sur la prochaine frame
      brightSprite = null;
      /* 140 étoiles max. ~8 % d'étoiles "phares" (bright=true) plus
         grosses, plus brillantes, avec pic de scintillement marqué. */
      const count = lowEnd ? 0 : Math.min(140, Math.floor((window.innerWidth * window.innerHeight) / 14000));
      stars = Array.from({ length: count }, () => {
        const bright = Math.random() < 0.08;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: bright ? Math.random() * 1.4 + 1.1 : Math.random() * 1.0 + 0.2,
          tw: Math.random() * Math.PI * 2,
          sp: bright ? 0.020 + Math.random() * 0.025 : 0.008 + Math.random() * 0.018,
          bright,
        };
      });
      draw();
      if (!reduce) loop();
    }

    /* Sprite cache : on dessine UNE FOIS le halo+cœur d'une étoile phare
       dans un offscreen canvas et on le blit ensuite chaque frame avec
       `globalAlpha`. Économie : ~10 createRadialGradient + ~20 fill/path
       par frame. */
    let brightSprite = null;
    let brightSpriteSize = 0;
    function buildBrightSprite(maxRadius) {
      const size = Math.ceil(maxRadius * 10) + 4;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const cx = size / 2;
      const cctx = c.getContext("2d");
      const grad = cctx.createRadialGradient(cx, cx, 0, cx, cx, maxRadius * 5);
      grad.addColorStop(0,   "rgba(255,255,255,1)");
      grad.addColorStop(0.4, "rgba(196,181,253,0.35)");
      grad.addColorStop(1,   "rgba(124,58,237,0)");
      cctx.fillStyle = grad;
      cctx.beginPath();
      cctx.arc(cx, cx, maxRadius * 5, 0, Math.PI * 2);
      cctx.fill();
      // Cœur lumineux blanc dur par-dessus
      cctx.fillStyle = "rgba(255,255,255,1)";
      cctx.beginPath();
      cctx.arc(cx, cx, maxRadius, 0, Math.PI * 2);
      cctx.fill();
      brightSprite = c;
      brightSpriteSize = size;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const dpr = window.devicePixelRatio;
      if (!brightSprite) buildBrightSprite(2.5 * dpr);
      for (const s of stars) {
        if (!reduce) s.tw += s.sp;
        const sin = Math.sin(s.tw);
        if (s.bright) {
          const a = 0.55 + sin * 0.4;
          const radius = s.r * dpr;
          const drawSize = brightSpriteSize * (radius / (2.5 * dpr));
          ctx.globalAlpha = a;
          ctx.drawImage(brightSprite, s.x - drawSize / 2, s.y - drawSize / 2, drawSize, drawSize);
          ctx.globalAlpha = 1;
        } else {
          const a = 0.18 + sin * 0.18;
          ctx.fillStyle = "rgba(255,255,255," + a.toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
        if (!reduce) {
          s.y += 0.026 * dpr;
          if (s.y > h) s.y = 0;
        }
      }
    }

    let starfieldPaused = false;
    function loop() {
      if (starfieldPaused) {
        raf = 0;
        return;
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    // expose pause/resume so the hero observer can cut the RAF entirely
    window.__agiStarfield = {
      pause() {
        starfieldPaused = true;
      },
      resume() {
        if (starfieldPaused) {
          starfieldPaused = false;
          if (!raf && !reduce) {
            raf = requestAnimationFrame(loop);
          }
        }
      },
    };

    resize();
    window.addEventListener("resize", resize);
  }

  /* Mouse parallax (hero blobs) and cursor halo removed for performance.
     They both wrote CSS variables on every mousemove which triggered
     full-viewport paints. */

  /* ── Brouillard interactif (hero) ──
     Très peu coûteux : un seul rAF coalescé, 2 CSS vars écrites sur
     l'élément .hero-fog (pas sur <html>), donc le repaint est strictement
     scopé à cet élément (1 seul layer compositor). Désactivé sur
     low-end / reduced-motion / pointer coarse. */
  const heroFog = document.getElementById("heroFog");
  const heroForFog = document.getElementById("hero");
  if (heroFog && heroForFog && heavyOK && window.matchMedia("(pointer: fine)").matches) {
    let fogRaf = 0;
    let fx = 50, fy = 40;
    heroForFog.addEventListener("mousemove", (e) => {
      const r = heroForFog.getBoundingClientRect();
      fx = ((e.clientX - r.left) / r.width)  * 100;
      fy = ((e.clientY - r.top)  / r.height) * 100;
      if (fogRaf) return;
      fogRaf = requestAnimationFrame(() => {
        fogRaf = 0;
        heroFog.style.setProperty("--fx", fx.toFixed(1) + "%");
        heroFog.style.setProperty("--fy", fy.toFixed(1) + "%");
      });
    }, { passive: true });
    heroForFog.addEventListener("mouseenter", () => heroFog.classList.add("is-on"));
    heroForFog.addEventListener("mouseleave", () => heroFog.classList.remove("is-on"));
    // Visible d'entrée (drift permanent même sans souris)
    heroFog.classList.add("is-on");
  }

  /* Boutons magnétiques — listeners DÉLÉGUÉS au document.
     Un seul mousemove document (au lieu de N par bouton) coalescé en rAF.
     Le rect du bouton actif est mis en cache à l'entrée. */
  if (heavyOK && window.matchMedia("(pointer: fine)").matches) {
    let magActive = null;
    let magRect = null;
    let magRaf = 0;
    let magX = 0, magY = 0;
    let magForce = 8, magForceY = 6;

    function magFlush() {
      magRaf = 0;
      if (!magActive || !magRect) return;
      const dx = magX - (magRect.left + magRect.width / 2);
      const dy = magY - (magRect.top + magRect.height / 2);
      const mx = Math.max(-1, Math.min(1, dx / (magRect.width / 2))) * magForce;
      const my = Math.max(-1, Math.min(1, dy / (magRect.height / 2))) * magForceY;
      magActive.style.transform = "translate(" + mx + "px," + my + "px)";
    }

    document.addEventListener("mouseover", (e) => {
      const t = e.target.closest && e.target.closest(".magnetic");
      if (!t || t === magActive) return;
      if (magActive) magActive.style.transform = "";
      magActive = t;
      magRect = t.getBoundingClientRect();
      // Force plus douce pour nav-pill / social-link (petits éléments)
      if (t.matches(".nav-pill a, .social-link")) { magForce = 5; magForceY = 4; }
      else { magForce = 8; magForceY = 6; }
    }, { passive: true });

    document.addEventListener("mouseout", (e) => {
      const t = e.target.closest && e.target.closest(".magnetic");
      if (!t || t !== magActive) return;
      // mouseout firea aussi quand on entre dans un enfant — vérifier
      // que relatedTarget est hors de l'élément actif
      if (magActive.contains(e.relatedTarget)) return;
      magActive.style.transform = "";
      magActive = null;
      magRect = null;
    }, { passive: true });

    document.addEventListener("mousemove", (e) => {
      if (!magActive) return;
      magX = e.clientX;
      magY = e.clientY;
      if (magRaf) return;
      magRaf = requestAnimationFrame(magFlush);
    }, { passive: true });

    // Re-cacher rect au scroll/resize (le bouton actif peut avoir bougé)
    window.addEventListener("scroll", () => {
      if (magActive) magRect = magActive.getBoundingClientRect();
    }, { passive: true });
  }

  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 16);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const burger = document.getElementById("burger");
  const drawer = document.getElementById("drawer");
  if (burger && drawer) {
    burger.addEventListener("click", () => {
      const open = drawer.hasAttribute("hidden");
      drawer.toggleAttribute("hidden", !open);
      burger.setAttribute("aria-expanded", String(open));
      burger.classList.toggle("is-open", open);
    });
    drawer.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        drawer.setAttribute("hidden", "");
        burger.setAttribute("aria-expanded", "false");
        burger.classList.remove("is-open");
      });
    });
  }

  /* Reveal on enter AND exit — bidirectional, scoped per element. */
  const revealTimers = new WeakMap();
  // Heuristic: which cards swap to .is-revealed (no transform transition) so
  // that GSAP tilt can take over without fighting CSS. Match the same set the
  // CSS targets in `html.tilt-js .card-bento[data-reveal].is-revealed`...
  const tiltCardSelector = ".card-bento, .svc-card, .founder-card, .contact-cta";

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const el = e.target;
        if (e.isIntersecting) {
          el.classList.add("is-in");

          // For tilt-cards: after the reveal transition completes, mark as
          // .is-revealed so the transform transition is dropped (avoids
          // conflict with GSAP tilt on subsequent hover).
          if (el.matches && el.matches(tiltCardSelector)) {
            const prev = revealTimers.get(el);
            if (prev) clearTimeout(prev);
            const delay = parseFloat(el.dataset.stagger || 0) * 80 + 1500;
            revealTimers.set(el, setTimeout(() => {
              el.classList.add("is-revealed");
            }, delay));
          }
        } else {
          el.style.transitionDelay = "0s";
          el.classList.remove("is-in");
          // Drop is-revealed so the transform transition is re-enabled for the
          // reverse animation (smooth fade-out).
          if (el.matches && el.matches(tiltCardSelector)) {
            el.classList.remove("is-revealed");
            const prev = revealTimers.get(el);
            if (prev) { clearTimeout(prev); revealTimers.delete(el); }
          }
        }
      });
    },
    /* Trigger équilibré :
       - threshold 0.1 → dès que 10% de l'élément est visible, on l'anime in
       - rootMargin top 0 / bottom -8% → légèrement retardé en entrée pour
         que l'élément soit bien dans le viewport, MAIS reste révélé tant
         qu'il dépasse encore (au lieu de re-faire la sortie trop tôt).
       Avec threshold 0.25 + rootMargin -14% (config précédente), les cartes
       restaient bloquées en position initiale beaucoup trop longtemps. */
    { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
  );
  /* Pré-calcule en UNE PASSE l'index stagger de chaque [data-reveal]
     dans son parent direct. Évite un scan O(N) à chaque entrée IO. */
  const revealParents = new Map();
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    const parent = el.parentElement;
    if (parent) {
      const counter = revealParents.get(parent) || 0;
      el.dataset.stagger = counter;
      el.style.transitionDelay = (Math.min(counter, 4) * 0.08).toFixed(2) + "s";
      revealParents.set(parent, counter + 1);
    } else {
      el.dataset.stagger = "0";
    }
    io.observe(el);
  });

  const meters = document.querySelector("[data-meters]");
  if (meters) {
    const mio = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          mio.unobserve(e.target);
        });
      },
      { threshold: 0.35 }
    );
    mio.observe(meters);
  }

  const headH = () => (header ? header.offsetHeight : 72);

  /* ── Awwwards-tier : Lenis + GSAP ──
     Lenis adds smooth scroll but also adds ~1 raf/frame cost. On low-end
     devices, native scroll is snappier than smoothed scroll. */
  let lenis = null;
  const hasLibs = window.Lenis && window.gsap && window.ScrollTrigger;

  if (hasLibs && !reduce) {
    gsap.registerPlugin(ScrollTrigger);
  }

  if (hasLibs && heavyOK) {
    lenis = new Lenis({
      /* Config un peu plus lente / cinématique : lerp 0.075 + duration 1.6
         → l'inertie est plus longue, l'utilisateur a le temps de voir les
         animations scroll-driven (dividers, reveals) se dérouler. */
      lerp: 0.075,
      duration: 1.6,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
      syncTouch: true,
      touchMultiplier: 1.4,
      wheelMultiplier: 0.95,
      normalizeWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    /* content-visibility:auto peut faire bouger les hauteurs des sections
       quand elles entrent/sortent du viewport. On rafraîchit ScrollTrigger
       au resize observer pour rester synchronisé. */
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => ScrollTrigger.refresh());
      ro.observe(document.body);
    }

    // Pause Lenis pendant l'intro, reprend une fois finie
    if (docEl.classList.contains("intro-lock")) {
      lenis.stop();
      const lenisObserver = new MutationObserver(() => {
        if (docEl.classList.contains("intro-done")) {
          lenis.start();
          ScrollTrigger.refresh();
          lenisObserver.disconnect();
        }
      });
      lenisObserver.observe(docEl, { attributes: true, attributeFilter: ["class"] });
    }
  }

  /* Anchor click handler — utilise Lenis quand dispo */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      const offset = -(headH() + 8);
      if (lenis) {
        lenis.scrollTo(el, { offset, duration: 0.8 });
      } else {
        const y = el.getBoundingClientRect().top + window.scrollY - headH() - 8;
        window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
      }
      if (drawer && !drawer.hasAttribute("hidden")) {
        drawer.setAttribute("hidden", "");
        if (burger) {
          burger.setAttribute("aria-expanded", "false");
          burger.classList.remove("is-open");
        }
      }
    });
  });

  /* ── 3D Tilt sur cartes — réécrit avec gsap.quickTo pour éviter le tween
     stacking qui causait la "grignote" sur survol. quickTo applique une seule
     interpolation continue par propriété au lieu d'empiler des tweens. ── */
  if (hasLibs && heavyOK && window.matchMedia("(pointer: fine)").matches) {
    // Marker sur <html> pour que le CSS retire les transforms hover concurrents
    docEl.classList.add("tilt-js");
    const tiltConfigs = [
      { sel: ".card-bento",   max: 4, lift: 6 },
      { sel: ".svc-card",     max: 4, lift: 6 },
      { sel: ".founder-card", max: 2, lift: 3 },
      { sel: ".contact-cta",  max: 2, lift: 3 },
    ];

    tiltConfigs.forEach(({ sel, max, lift }) => {
      document.querySelectorAll(sel).forEach((el) => {
        // NOTE: pas de gsap.set(el, ...) ici — ça écrirait un transform inline
        // dès le chargement qui ÉCRASE les transforms CSS du reveal directionnel.
        // La perspective vient de la grille parente via CSS (.bento, .svc-grid…).
        // quickTo n'écrit l'inline transform qu'à la PREMIÈRE invocation (au
        // premier mousemove), donc le reveal CSS a tout le temps de s'exécuter.
        const qX  = gsap.quickTo(el, "rotateX", { duration: 0.45, ease: "power2.out" });
        const qY  = gsap.quickTo(el, "rotateY", { duration: 0.45, ease: "power2.out" });
        const qT  = gsap.quickTo(el, "y",       { duration: 0.45, ease: "power2.out" });
        const qS  = gsap.quickTo(el, "scale",   { duration: 0.45, ease: "power2.out" });

        let bounds = null;
        let raf = 0;
        let px = 0, py = 0;

        el.addEventListener("mouseenter", () => {
          bounds = el.getBoundingClientRect();
        });
        el.addEventListener("mousemove", (e) => {
          if (!bounds) bounds = el.getBoundingClientRect();
          px = ((e.clientX - bounds.left) / bounds.width  - 0.5) * 2;
          py = ((e.clientY - bounds.top)  / bounds.height - 0.5) * 2;
          if (raf) return;
          raf = requestAnimationFrame(() => {
            raf = 0;
            qX(-py * max);
            qY( px * max);
            qT(-lift);
            qS(1.01);
          });
        }, { passive: true });
        el.addEventListener("mouseleave", () => {
          bounds = null;
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
          qX(0); qY(0); qT(0); qS(1);
          // Après que GSAP soit revenu à l'identité (~500ms), on EFFACE l'inline
          // transform pour que le CSS puisse reprendre la main lors d'un scroll
          // ultérieur (sinon inline=identity bloque les reveals directionnels).
          setTimeout(() => {
            if (!el.matches(":hover")) el.style.transform = "";
          }, 550);
        });
      });
    });
  }

  /* ── Compteurs animés ── */
  if (hasLibs && !reduce) {
    document.querySelectorAll("[data-counter]").forEach((el) => {
      const target = parseInt(el.dataset.counter, 10);
      if (isNaN(target)) return;
      const obj = { val: 0 };
      el.textContent = "0";
      gsap.to(obj, {
        val: target,
        duration: 1.6,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate() {
          el.textContent = Math.round(obj.val);
        },
      });
    });
  }

  /* splitIntoWords function removed — split-text reveal was disabled because
     it created a synchronization "dead zone" where words stayed hidden while
     the parent was already revealed. */

  /* Split-text reveal removed — it was hiding words with inline GSAP styles
     until a separate ScrollTrigger fired, creating a "dead zone" where the
     parent was visible (via data-reveal IO) but the words remained hidden.
     The data-reveal CSS already does a clean opacity/blur/translateY reveal,
     which is enough. */

  /* Étend la classe .magnetic aux nav-pill et social-link.
     Plus besoin d'attacher des listeners ici : le handler délégué
     plus haut s'en occupe via event.target.closest(".magnetic"). */
  if (heavyOK && window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".nav-pill a, .social-link").forEach((el) => {
      el.classList.add("magnetic");
    });
  }

  /* Cursor hover state listeners removed (cursorGlow no longer rendered).
     Block kept as a no-op so the original closing brace on the next line
     still matches a valid expression below. */
  {
  }

  // (legacy lead-form removed — replaced by Telegram/WhatsApp/Call CTAs)

  /* Fallback robuste pour TOUTES les icônes simpleicons.org (marquee +
     social-link + founder-social). Si le CDN principal échoue → on tente
     iconify.design. Si ça échoue aussi → badge lettre. */
  document.querySelectorAll('.glass-tool img, .social-link img, .founder-social img').forEach(function(img) {
    img.addEventListener('error', function() {
      var tried = parseInt(this.dataset.fallback || '0');
      if (tried === 0) {
        var m = this.src.match(/simpleicons\.org\/([^/?#]+)(?:\/([^/?#]+))?/);
        if (m) {
          this.dataset.fallback = '1';
          this.src = 'https://api.iconify.design/simple-icons/' + m[1] + '.svg?color=%23' + (m[2] || 'ffffff');
          return;
        }
      }
      var fb = document.createElement('span');
      fb.className = 'logo-fallback';
      fb.textContent = (this.alt || '?').charAt(0).toUpperCase();
      this.parentNode.insertBefore(fb, this);
      this.remove();
    });
    // Image déjà cassée avant que le listener ne soit attaché
    if (img.complete && img.naturalWidth === 0) {
      img.dispatchEvent(new Event('error'));
    }
  });

  /* ── Logo fallback: clearbit → icon.horse → google favicon → styled badge.
     Network requests routinely fail on file:// because of CORS / no network.
     The inline onerror="this.style.display='none'" in the HTML also fires
     before our JS loads, so we explicitly UN-hide and convert any failed
     logo to a violet letter badge. */
  function buildLogoBadge(img) {
    if (img.dataset.badged === "1") return;
    img.dataset.badged = "1";
    var initial = ((img.alt || "?").trim().charAt(0) || "?").toUpperCase();
    var badge = document.createElement("span");
    badge.className = img.classList.contains("proj-visual-logo")
      ? "logo-badge logo-badge--lg"
      : "logo-badge";
    badge.textContent = initial;
    badge.setAttribute("aria-hidden", "true");
    if (img.parentNode) img.parentNode.insertBefore(badge, img);
    img.remove();
  }

  document.querySelectorAll("img.proj-logo, img.proj-visual-logo").forEach(function (img) {
    img.removeAttribute("onerror");
    img.style.display = "";
    var m = img.src.match(/logo\.clearbit\.com\/([^/?#]+)/);
    var domain = m ? m[1] : null;
    img.onerror = function () {
      var step = +this.dataset.logoStep || 0;
      this.dataset.logoStep = step + 1;
      if (domain && step === 0) {
        this.src = "https://icon.horse/icon/" + domain;
      } else if (domain && step === 1) {
        this.src = "https://www.google.com/s2/favicons?domain=" + domain + "&sz=128";
      } else {
        this.onerror = null;
        buildLogoBadge(this);
      }
    };
    // Image already failed before JS loaded (inline onerror cleared the src)
    if (img.complete && img.naturalWidth === 0) {
      buildLogoBadge(img);
    }
  });

  /* ── Project Accordion ── */
  const projList = document.getElementById("projList");
  if (projList) {
    const items = projList.querySelectorAll(".proj-item");
    const visuals = document.querySelectorAll(".proj-visual");

    function activateVisual(index) {
      visuals.forEach((v) => {
        v.classList.toggle("proj-visual--active", +v.dataset.visual === index);
      });
    }

    items.forEach((item) => {
      const btn = item.querySelector(".proj-row");
      if (!btn) return;

      btn.addEventListener("click", () => {
        const isOpen = item.classList.contains("is-open");
        items.forEach((i) => {
          i.classList.remove("is-open");
          const b = i.querySelector(".proj-row");
          if (b) b.setAttribute("aria-expanded", "false");
        });
        if (!isOpen) {
          item.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
          activateVisual(+item.dataset.index);
        }
      });

      item.addEventListener("mouseenter", () => {
        activateVisual(+item.dataset.index);
      });
    });

    activateVisual(0);
  }

  /* ── Chat Panel ──
     Le webhook est branché par config window.AGI_CHAT_WEBHOOK_URL (à
     définir dans index.html avant ce script). Si non défini ou invalide,
     le bouton "Posez-nous votre question" REDIRIGE vers WhatsApp au
     lieu d'ouvrir un chat cassé. */
  const CHAT_WEBHOOK_URL = (typeof window.AGI_CHAT_WEBHOOK_URL === "string" &&
                            window.AGI_CHAT_WEBHOOK_URL.indexOf("http") === 0)
    ? window.AGI_CHAT_WEBHOOK_URL
    : null;
  const CHAT_FALLBACK_URL = "https://wa.me/237659245589?text=" +
    encodeURIComponent("Bonjour AGI, je souhaite échanger sur un projet.");

  const chatPanel   = document.getElementById("chatPanel");
  const chatCard    = chatPanel && chatPanel.querySelector(".chat-card");
  const chatInput   = document.getElementById("chatInput");
  const chatSend    = document.getElementById("chatSend");
  const chatMsgs    = document.getElementById("chatMessages");
  const chatClose   = document.getElementById("chatClose");
  const heroChatBtn = document.getElementById("heroChat");

  if (chatPanel && heroChatBtn) {
    // ID de session unique par visite
    const sessionId = "agi-" + Math.random().toString(36).slice(2, 11);

    function openChat() {
      chatPanel.classList.add("is-open");
      chatPanel.setAttribute("aria-hidden", "false");
      setTimeout(() => chatInput && chatInput.focus(), 350);
    }

    function closeChat() {
      chatPanel.classList.remove("is-open");
      chatPanel.setAttribute("aria-hidden", "true");
    }

    heroChatBtn.addEventListener("click", (e) => {
      // Pas de webhook configuré → on redirige vers WhatsApp plutôt que
      // d'ouvrir un chat qui afficherait une erreur réseau.
      if (!CHAT_WEBHOOK_URL) {
        e.preventDefault();
        window.open(CHAT_FALLBACK_URL, "_blank", "noopener,noreferrer");
        return;
      }
      openChat();
    });
    chatClose && chatClose.addEventListener("click", closeChat);

    // Fermer en cliquant sur l'overlay (pas sur la card)
    chatPanel.addEventListener("click", (e) => {
      if (e.target === chatPanel) closeChat();
    });

    // Fermer avec Echap
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && chatPanel.classList.contains("is-open")) closeChat();
    });

    function appendMsg(text, sender) {
      const wrap = document.createElement("div");
      wrap.className = "chat-msg chat-msg--" + sender;
      const bubble = document.createElement("div");
      bubble.className = "chat-msg-bubble";
      bubble.textContent = text;
      wrap.appendChild(bubble);
      chatMsgs.appendChild(wrap);
      chatMsgs.scrollTop = chatMsgs.scrollHeight;
      return wrap;
    }

    function showTyping() {
      const wrap = document.createElement("div");
      wrap.className = "chat-msg chat-msg--bot chat-msg--typing";
      wrap.id = "chatTyping";
      wrap.innerHTML = '<div class="chat-msg-bubble"><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span></div>';
      chatMsgs.appendChild(wrap);
      chatMsgs.scrollTop = chatMsgs.scrollHeight;
    }

    function hideTyping() {
      const t = document.getElementById("chatTyping");
      if (t) t.remove();
    }

    async function sendMessage() {
      const text = chatInput.value.trim();
      if (!text || chatSend.disabled) return;

      chatInput.value = "";
      chatSend.disabled = true;

      appendMsg(text, "user");
      showTyping();

      try {
        const res = await fetch(CHAT_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, sessionId })
        });

        if (!res.ok) throw new Error("HTTP " + res.status);

        // Le webhook n8n renvoie du texte brut (pas de JSON).
        // On lit la réponse telle quelle et on l'affiche directement.
        const reply = (await res.text()).trim() ||
          "Message reçu — nous vous recontactons rapidement.";

        hideTyping();
        appendMsg(reply, "bot");
      } catch {
        hideTyping();
        appendMsg(
          "Une erreur est survenue. Contactez-nous directement sur Telegram ou WhatsApp — nous répondons vite.",
          "bot"
        );
      } finally {
        chatSend.disabled = false;
        chatInput.focus();
      }
    }

    chatSend && chatSend.addEventListener("click", sendMessage);
    chatInput && chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  }

  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());

  /* ── Email obfusqué anti-scraper ──
     Tout lien avec [data-mailto="user|domaine"] reconstruit l'adresse
     côté client au clic et lance le mailto. L'adresse complète n'apparaît
     jamais dans le HTML servi (ni en attribut, ni en contenu visible),
     ce qui bloque la majorité des scrapers d'email. */
  document.addEventListener("click", function (e) {
    const link = e.target.closest && e.target.closest("[data-mailto]");
    if (!link) return;
    e.preventDefault();
    const parts = (link.dataset.mailto || "").split("|");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return;
    const addr = parts[0] + "@" + parts[1];
    const subject = link.dataset.mailtoSubject || "Contact via le site AGI";
    window.location.href =
      "mailto:" + addr + "?subject=" + encodeURIComponent(subject);
  });

  /* Horloges du footer : 3 fuseaux (Yaoundé / Paris / Washington DC).
     Chaque <span data-tz="…"> contient un IANA timezone, on met à jour
     toutes les minutes. Les villes correspondent à nos 3 marchés. */
  const clockNodes = document.querySelectorAll(".footer-clock-time[data-tz]");
  function tickClock() {
    if (!clockNodes.length) return;
    const now = new Date();
    clockNodes.forEach((node) => {
      const tz = node.dataset.tz;
      try {
        node.textContent = new Intl.DateTimeFormat("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: tz,
        }).format(now);
      } catch (e) {
        node.textContent = "--:--";
      }
    });
  }
  tickClock();
  // Mise à jour minute (pas seconde) : 3 villes = 3 reflows par tick, pas la peine
  let clockInterval = setInterval(tickClock, 30000);
  /* Pause l'horloge quand l'onglet est inactif — économise un wakeup/sec
     et empêche le navigateur de garder la tab "vivante" inutilement. */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearInterval(clockInterval);
      clockInterval = 0;
    } else if (!clockInterval) {
      tickClock();
      clockInterval = setInterval(tickClock, 30000);
    }
  });

  /* ── Neon section dividers — TIGHT SCROLL COUPLING ──
     Behavior:
       1. Trace progress is a clean LINEAR function of scroll position.
          • 0 when the divider's TOP edge is at the bottom of the viewport
            (i.e. divider just entering from below)
          • 1 when the divider's TOP edge has reached 30% from the top
            (well in view — line fully drawn)
       2. Active divider = whichever has its centre closest to viewport centre,
          but only while it's actually inside the viewport.
       3. Active line is fully visible; previous one fades out.
       4. Stroke-dashoffset has minimal CSS transition (60ms) so the trace
          tracks scroll position almost frame-perfectly.
  */
  const dividers = Array.from(document.querySelectorAll(".section-divider"));
  if (dividers.length) {
    let dRaf = 0;
    function updateDividers() {
      dRaf = 0;
      const vh = window.innerHeight;
      const midY = vh * 0.5;

      let bestIdx = -1;
      let bestDist = Infinity;

      const rects = dividers.map((d) => d.getBoundingClientRect());

      // First pass: find the divider whose centre is closest to viewport mid,
      // restricted to dividers that are at least partly in the viewport.
      rects.forEach((r, i) => {
        const cy = r.top + r.height * 0.5;
        const inViewport = r.top < vh && r.top + r.height > 0;
        if (!inViewport) return;
        const dist = Math.abs(cy - midY);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });

      // Second pass: trace progress.
      // Le TRAIT visible se trouve au centre vertical du divider (y≈height/2).
      // On veut :
      //   - progress 0 quand le trait vient JUSTE d'apparaître au bas du viewport
      //   - progress 1 quand le trait atteint le CENTRE du viewport
      // Comme ça l'utilisateur voit toute l'évolution du dessin pendant qu'il
      // scrolle au lieu d'arriver sur une ligne déjà à moitié dessinée.
      dividers.forEach((d, i) => {
        const r = rects[i];
        const lineY = r.top + r.height * 0.5;   // position absolue du trait dans l'écran
        // lineY = vh   → progress 0 (trait juste en bas du viewport)
        // lineY = vh/2 → progress 1 (trait au milieu)
        const raw = (vh - lineY) / (vh * 0.5);
        const traceP = Math.max(0, Math.min(1, raw));
        d.style.setProperty("--trace-progress", traceP.toFixed(3));
        d.classList.toggle("is-active-divider", i === bestIdx);
      });
    }

    function scheduleDividerUpdate() {
      if (dRaf) return;
      dRaf = requestAnimationFrame(updateDividers);
    }
    window.addEventListener("scroll", scheduleDividerUpdate, { passive: true });
    window.addEventListener("resize", scheduleDividerUpdate, { passive: true });
    // initial paint
    scheduleDividerUpdate();

    /* Section-divider mouse parallax removed for performance — it wrote
       CSS vars on <html> on every mousemove which forced a paint pass
       across every divider SVG. The dividers still animate on scroll. */
  }

  /* ── Scene activation: TOGGLE (animate only when on-screen, freeze when away) ── */
  const scenes = document.querySelectorAll(".scene");
  if (scenes.length && window.IntersectionObserver) {
    const sio = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          e.target.classList.toggle("is-active", e.isIntersecting);
        });
      },
      { threshold: 0.12, rootMargin: "100px 0px 100px 0px" }
    );
    scenes.forEach((s) => sio.observe(s));
  } else {
    scenes.forEach((s) => s.classList.add("is-active"));
  }

  /* ── Pause heavy background visuals when scrolled past the hero ── */
  const heroEl = document.getElementById("hero");
  const starfieldEl = document.getElementById("starfield");
  const heroBlobsEl = document.getElementById("heroBlobs");
  if (heroEl && window.IntersectionObserver) {
    const hio = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        if (starfieldEl) starfieldEl.classList.toggle("is-out", !visible);
        if (heroBlobsEl) heroBlobsEl.classList.toggle("is-out", !visible);
        if (window.__agiStarfield) {
          if (visible) window.__agiStarfield.resume();
          else window.__agiStarfield.pause();
        }
      },
      { threshold: 0, rootMargin: "100px 0px 0px 0px" }
    );
    hio.observe(heroEl);
  }

  /* (Inner-scene tilt removed — it conflicted with the GSAP tilt on the
     parent card and caused the "grignote" flicker reported by user) */

  /* ═══════════════════════════════════════════════════════════════
     AWWWARDS UPGRADE LAYER (JS)
     - Scroll progress bar (top edge, gradient violet→cream)
     - Custom cursor with dynamic label ("Voir" / "Lire" / "Ouvrir")
     - Magnetic on bento/svc cards + project rows
     ═══════════════════════════════════════════════════════════════ */

  /* ── Scroll progress bar ── */
  (function () {
    let spRaf = 0;
    function paintProgress() {
      spRaf = 0;
      const h = document.documentElement;
      const scrollTop = window.scrollY || h.scrollTop;
      const max = Math.max(1, (h.scrollHeight || 0) - (h.clientHeight || 0));
      const p = Math.max(0, Math.min(1, scrollTop / max));
      h.style.setProperty("--scroll-progress", p.toFixed(4));
    }
    window.addEventListener("scroll", () => {
      if (spRaf) return;
      spRaf = requestAnimationFrame(paintProgress);
    }, { passive: true });
    window.addEventListener("resize", paintProgress);
    paintProgress();
  })();

  /* Custom cursor + hero-button mousemove-glow removed for performance.
     They forced layout reads (getBoundingClientRect) + style writes on
     every frame, with no proportional visual benefit. */
})();
