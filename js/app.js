/* ========================================
   Aura Seoul — Scroll-Driven App
   ======================================== */

(function () {
  "use strict";

  const FRAME_COUNT = 121;
  const FRAME_SPEED = 2.0;
  const IMAGE_SCALE = 0.62;

  // Product horizontal offset: 0 = center, positive = right, negative = left
  var productOffsetX = 0.25; // start in right third (25% of viewport width rightward)

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const scrollContainer = document.getElementById("scroll-container");
  const heroSection = document.querySelector(".hero-standalone");
  const canvasWrap = document.querySelector(".canvas-wrap");
  const loaderEl = document.getElementById("loader");
  const loaderBar = document.getElementById("loader-bar");
  const loaderPercent = document.getElementById("loader-percent");

  const frames = [];
  let currentFrame = -1;
  let bgColor = "#000000";

  /* ---- Resize canvas for retina ---- */
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.scale(dpr, dpr);
    // Redraw after resize
    if (currentFrame >= 0) drawFrame(currentFrame);
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  /* ---- Sample background color from frame edges ---- */
  function sampleBgColor(img) {
    const sampleCanvas = document.createElement("canvas");
    const sampleCtx = sampleCanvas.getContext("2d");
    sampleCanvas.width = img.naturalWidth;
    sampleCanvas.height = img.naturalHeight;
    sampleCtx.drawImage(img, 0, 0);
    const pixel = sampleCtx.getImageData(2, 2, 1, 1).data;
    bgColor = "rgb(" + pixel[0] + "," + pixel[1] + "," + pixel[2] + ")";
  }

  /* ---- Draw frame (padded cover mode with horizontal offset) ---- */
  function drawFrame(index) {
    const img = frames[index];
    if (!img) return;

    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2 + (productOffsetX * cw);
    const dy = (ch - dh) / 2;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ---- Frame Preloader ---- */
  function framePath(i) {
    const num = String(i + 1).padStart(4, "0");
    return "frames/frame_" + num + ".jpg";
  }

  function loadFrame(index) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        frames[index] = img;
        // Sample bg color every 20 frames
        if (index % 20 === 0) sampleBgColor(img);
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = framePath(index);
    });
  }

  async function preloadFrames() {
    let loaded = 0;

    // Phase 1: Load first 10 frames fast
    const firstBatch = [];
    for (let i = 0; i < Math.min(10, FRAME_COUNT); i++) {
      firstBatch.push(loadFrame(i));
    }
    const firstResults = await Promise.all(firstBatch);
    loaded = firstResults.length;
    updateLoader(loaded);

    // Draw first frame immediately
    if (frames[0]) {
      currentFrame = 0;
      drawFrame(0);
    }

    // Phase 2: Load remaining in batches of 10
    for (let i = 10; i < FRAME_COUNT; i += 10) {
      const batch = [];
      for (let j = i; j < Math.min(i + 10, FRAME_COUNT); j++) {
        batch.push(loadFrame(j));
      }
      await Promise.all(batch);
      loaded += batch.length;
      updateLoader(loaded);
    }

    // Done
    loaderEl.classList.add("loaded");
    initSite();
  }

  function updateLoader(loaded) {
    const pct = Math.round((loaded / FRAME_COUNT) * 100);
    loaderBar.style.width = pct + "%";
    loaderPercent.textContent = pct + "%";
  }

  /* ---- Lenis Smooth Scroll ---- */
  let lenis;

  function initLenis() {
    lenis = new Lenis({
      duration: 1.2,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t));
      },
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---- Hero Animations ---- */
  function initHeroAnimations() {
    const label = heroSection.querySelector(".section-label");
    const words = heroSection.querySelectorAll(".hero-heading span");
    const tagline = heroSection.querySelector(".hero-tagline");
    const scrollInd = heroSection.querySelector(".scroll-indicator");

    const tl = gsap.timeline({ delay: 0.3 });

    tl.to(label, { opacity: 1, duration: 0.8, ease: "power2.out" })
      .to(words, {
        opacity: 1,
        y: 0,
        stagger: 0.06,
        duration: 0.7,
        ease: "power3.out",
      }, "-=0.4")
      .to(tagline, { opacity: 1, duration: 0.9, ease: "power2.out" }, "-=0.3")
      .to(scrollInd, { opacity: 1, duration: 0.6, ease: "power2.out" }, "-=0.3");

    // Set initial state for words
    gsap.set(words, { y: 40, opacity: 0 });
  }

  /* ---- Circle-Wipe Hero → Canvas Transition ---- */
  function initHeroTransition() {
    ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: function (self) {
        var p = self.progress;
        // Hero fades out quickly
        heroSection.style.opacity = Math.max(0, 1 - p * 15);
        // Canvas reveals via circle wipe
        var wipeProgress = Math.min(1, Math.max(0, (p - 0.01) / 0.06));
        var radius = wipeProgress * 75;
        canvasWrap.style.clipPath = "circle(" + radius + "% at 50% 50%)";
      },
    });
  }

  /* ---- Frame-to-Scroll Binding ---- */
  function initFrameScroll() {
    ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: function (self) {
        var accelerated = Math.min(self.progress * FRAME_SPEED, 1);
        var index = Math.min(
          Math.floor(accelerated * FRAME_COUNT),
          FRAME_COUNT - 1
        );
        if (index !== currentFrame) {
          currentFrame = index;
          requestAnimationFrame(function () {
            drawFrame(currentFrame);
          });
        }
      },
    });
  }

  /* ---- Section Positioning ---- */
  function positionSections() {
    var sections = document.querySelectorAll(".scroll-section");
    var containerH = scrollContainer.offsetHeight;

    sections.forEach(function (section) {
      var enter = parseFloat(section.dataset.enter) / 100;
      var leave = parseFloat(section.dataset.leave) / 100;
      var midpoint = (enter + leave) / 2;
      var topPx = midpoint * containerH;
      section.style.top = topPx + "px";
      section.style.transform = "translateY(-50%)";
    });
  }

  /* ---- Section Animation System ---- */
  function setupSectionAnimation(section) {
    var type = section.dataset.animation;
    var persist = section.dataset.persist === "true";
    var enter = parseFloat(section.dataset.enter) / 100;
    var leave = parseFloat(section.dataset.leave) / 100;
    var children = section.querySelectorAll(
      ".section-label, .section-heading, .section-body, .section-note, .cta-button, .stat"
    );

    var tl = gsap.timeline({ paused: true });

    switch (type) {
      case "fade-up":
        tl.from(children, {
          y: 50, opacity: 0, stagger: 0.12, duration: 0.9, ease: "power3.out",
        });
        break;
      case "slide-left":
        tl.from(children, {
          x: -80, opacity: 0, stagger: 0.14, duration: 0.9, ease: "power3.out",
        });
        break;
      case "slide-right":
        tl.from(children, {
          x: 80, opacity: 0, stagger: 0.14, duration: 0.9, ease: "power3.out",
        });
        break;
      case "scale-up":
        tl.from(children, {
          scale: 0.85, opacity: 0, stagger: 0.12, duration: 1.0, ease: "power2.out",
        });
        break;
      case "rotate-in":
        tl.from(children, {
          y: 40, rotation: 3, opacity: 0, stagger: 0.1, duration: 0.9, ease: "power3.out",
        });
        break;
      case "stagger-up":
        tl.from(children, {
          y: 60, opacity: 0, stagger: 0.15, duration: 0.8, ease: "power3.out",
        });
        break;
      case "clip-reveal":
        tl.from(children, {
          clipPath: "inset(100% 0 0 0)", opacity: 0, stagger: 0.15, duration: 1.2, ease: "power4.inOut",
        });
        break;
    }

    var played = false;
    var fadeIn = enter - 0.02;
    var fadeOut = leave;

    ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: function (self) {
        var p = self.progress;

        if (p >= enter && p <= leave) {
          section.style.opacity = "1";
          if (!played) {
            tl.play();
            played = true;
          }
        } else if (p < fadeIn) {
          section.style.opacity = "0";
          if (played && !persist) {
            tl.reverse();
            played = false;
          }
        } else if (p > fadeOut) {
          if (persist) {
            section.style.opacity = "1";
          } else {
            // Fade out over small range
            var fadeProgress = Math.min(1, (p - fadeOut) / 0.03);
            section.style.opacity = String(1 - fadeProgress);
            if (fadeProgress >= 1 && played) {
              tl.reverse();
              played = false;
            }
          }
        } else if (p >= fadeIn && p < enter) {
          // Fade in
          var inProgress = (p - fadeIn) / (enter - fadeIn);
          section.style.opacity = String(inProgress);
        }
      },
    });
  }

  /* ---- Counter Animations ---- */
  function initCounters() {
    document.querySelectorAll(".stat-number").forEach(function (el) {
      var target = parseFloat(el.dataset.value);
      var decimals = parseInt(el.dataset.decimals || "0", 10);

      // We need a proxy object for GSAP to animate
      var obj = { val: 0 };

      ScrollTrigger.create({
        trigger: scrollContainer,
        start: "top top",
        end: "bottom bottom",
        scrub: false,
        onUpdate: function (self) {
          var statsSection = el.closest(".scroll-section");
          var enter = parseFloat(statsSection.dataset.enter) / 100;
          var leave = parseFloat(statsSection.dataset.leave) / 100;

          if (self.progress >= enter && self.progress <= leave && !el._counted) {
            el._counted = true;
            gsap.to(obj, {
              val: target,
              duration: 2,
              ease: "power1.out",
              onUpdate: function () {
                el.textContent = obj.val.toFixed(decimals);
              },
            });
          }
        },
      });
    });
  }

  /* ---- Horizontal Text Marquee ---- */
  function initMarquee() {
    document.querySelectorAll(".marquee-wrap").forEach(function (el) {
      var speed = parseFloat(el.dataset.scrollSpeed) || -25;
      var enterPct = parseFloat(el.dataset.enter) / 100 || 0.15;
      var leavePct = parseFloat(el.dataset.leave) / 100 || 0.85;

      gsap.to(el.querySelector(".marquee-text"), {
        xPercent: speed,
        ease: "none",
        scrollTrigger: {
          trigger: scrollContainer,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        },
      });

      // Fade marquee in/out
      ScrollTrigger.create({
        trigger: scrollContainer,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: function (self) {
          var p = self.progress;
          if (p >= enterPct && p <= leavePct) {
            el.style.opacity = "1";
          } else {
            el.style.opacity = "0";
          }
        },
      });
    });
  }

  /* ---- Dark Overlay ---- */
  function initDarkOverlay() {
    var overlay = document.getElementById("dark-overlay");
    // Stats section range
    var enter = 0.56;
    var leave = 0.74;
    var fadeRange = 0.04;

    ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: function (self) {
        var p = self.progress;
        var opacity = 0;
        if (p >= enter - fadeRange && p <= enter) {
          opacity = (p - (enter - fadeRange)) / fadeRange;
        } else if (p > enter && p < leave) {
          opacity = 0.9;
        } else if (p >= leave && p <= leave + fadeRange) {
          opacity = 0.9 * (1 - (p - leave) / fadeRange);
        }
        overlay.style.opacity = opacity;
      },
    });
  }

  /* ---- Product Position Shifting ---- */
  function initProductShift() {
    // Defines where the product sits for each scroll range
    // right-aligned text → product shifts LEFT, left-aligned text → product shifts RIGHT
    var zones = [];
    document.querySelectorAll(".scroll-section").forEach(function (s) {
      var enter = parseFloat(s.dataset.enter) / 100;
      var leave = parseFloat(s.dataset.leave) / 100;
      var isRight = s.classList.contains("align-right");
      var isStats = s.classList.contains("section-stats");
      // right-aligned text = product goes left (-0.20), left-aligned = product goes right (0.25), stats = center (0)
      var target = isStats ? 0 : (isRight ? -0.20 : 0.25);
      zones.push({ enter: enter, leave: leave, offset: target });
    });

    // Ease function for buttery transitions
    function easeInOut(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: function (self) {
        var p = self.progress;
        var targetOffset = 0.25; // default: right third

        // Find which zone we're in or between
        for (var i = 0; i < zones.length; i++) {
          var z = zones[i];
          var prevOffset = i > 0 ? zones[i - 1].offset : 0.25;

          // Inside a zone — hold position
          if (p >= z.enter && p <= z.leave) {
            targetOffset = z.offset;
            break;
          }

          // In the gap BETWEEN two zones — drift smoothly across the entire gap
          if (i > 0 && p > zones[i - 1].leave && p < z.enter) {
            var t = (p - zones[i - 1].leave) / (z.enter - zones[i - 1].leave);
            targetOffset = prevOffset + (z.offset - prevOffset) * easeInOut(t);
            break;
          }

          // Before the very first zone — drift from default into first zone
          if (i === 0 && p < z.enter) {
            var leadIn = Math.min(z.enter, 0.08); // use up to 8% scroll for lead-in
            if (p >= z.enter - leadIn) {
              var t2 = (p - (z.enter - leadIn)) / leadIn;
              targetOffset = 0.25 + (z.offset - 0.25) * easeInOut(t2);
            }
            break;
          }
        }

        // Gentle lerp for frame-level smoothness (lower = smoother drift)
        productOffsetX += (targetOffset - productOffsetX) * 0.06;

        if (currentFrame >= 0) {
          requestAnimationFrame(function () { drawFrame(currentFrame); });
        }
      },
    });
  }

  /* ---- Init Everything ---- */
  function initSite() {
    gsap.registerPlugin(ScrollTrigger);
    initLenis();
    initHeroAnimations();
    initHeroTransition();
    initFrameScroll();
    positionSections();
    initDarkOverlay();
    initMarquee();
    initCounters();

    initProductShift();
    document.querySelectorAll(".scroll-section").forEach(setupSectionAnimation);

    // Recalculate on resize
    window.addEventListener("resize", function () {
      positionSections();
    });
  }

  /* ---- Start ---- */
  gsap.registerPlugin(ScrollTrigger);
  preloadFrames();
})();
