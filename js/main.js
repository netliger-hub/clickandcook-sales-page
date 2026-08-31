/* ============================================================
   Click & Cook — All Access Sales Page
   Interactions: sticky bar visibility, review rail paging,
   course detail toggles. Tracking: Meta Pixel + Conversions API —
   PageView, ViewContent, scroll depth 50/95%, Lead + ButtonClick.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- In-app browser (Facebook/Instagram/LINE) ----------
     เดิมพยายาม "พาออก" อัตโนมัติ (iOS: x-web-search:// → กลายเป็นเปิด
     Google ค้นหา URL ของหน้าเอง, Android: intent:// เปิด Chrome) —
     เจอ dialog ขออนุญาตเปิดแอปอื่นแล้วพาผู้ใช้หลุดออกจากหน้าขาย
     จึงตัดออกทั้งหมด → เหลือแค่แจ้งเตือนให้เปิดเองใน Safari/Chrome
     (แสดงครั้งเดียว ปิดแล้วจำด้วย sessionStorage) */
  var UA = navigator.userAgent || '';
  var IN_APP = /FBAN|FBAV|FB_IAB|FB4A|Instagram|Line\/|EABK|Snapchat/i.test(UA);
  if (IN_APP && /Android|iPhone|iPad|iPod/i.test(UA)) {
    var showIabBanner = function () {
      if (document.getElementById('iab-banner')) return;
      try { if (sessionStorage.getItem('ccIabBanner')) return; } catch (e) {}
      var b = document.createElement('div');
      b.id = 'iab-banner';
      b.setAttribute('role', 'alert');
      b.innerHTML =
        '<span>คุณกำลังเปิดผ่านเบราว์เซอร์ในแอป — แตะไอคอน <strong>⋯ หรือ ⋮</strong> แล้วเลือก <strong>"เปิดใน Safari / Chrome"</strong> เพื่อใช้งานและแชทได้ปกติค่ะ</span>' +
        '<button type="button" aria-label="ปิด">&times;</button>';
      b.querySelector('button').addEventListener('click', function () {
        b.remove();
        try { sessionStorage.setItem('ccIabBanner', '1'); } catch (e) {}
      });
      (document.body || document.documentElement).appendChild(b);
    };
    if (document.body) showIabBanner();
    else document.addEventListener('DOMContentLoaded', showIabBanner);
  }

  /* ---------- Tracking layer: Meta Pixel + Conversions API ----------
     ทุก event ยิงไปทั้ง Browser Pixel และ CAPI relay (capi.php) ด้วย
     event_id เดียวกัน เพื่อให้ Meta de-duplicate เป็น event เดียว
     (iOS/adblock บล็อกฝั่ง browser ก็ยังได้ยอดจากฝั่ง server).
     Tracking failures ต้องไม่ทำหน้าเว็บพัง จึง try/catch ทุกจุด. */
  // deploy บน Netlify/Vercel → /api/capi | host PHP (cPanel) → capi.php
  var CAPI_ENDPOINT = '/api/capi';
  var STANDARD_EVENTS = ['PageView', 'ViewContent', 'Lead'];

  function uid() {
    return 'cc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  // ส่ง event ไป CAPI relay — sendBeacon ก่อน (ไฟไล่หน้าได้), fetch สำรอง
  function capiSend(payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon &&
          navigator.sendBeacon(CAPI_ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
      fetch(CAPI_ENDPOINT, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: body
      }).catch(function () {});
    } catch (e) { /* relay unreachable — no-op */ }
  }

  function track(eventName, params) {
    var eventId = uid();
    var p = params || {};
    try {
      if (typeof window.fbq === 'function') {
        if (STANDARD_EVENTS.indexOf(eventName) >= 0) {
          window.fbq('track', eventName, p, { eventID: eventId });
        } else {
          window.fbq('trackCustom', eventName, p, { eventID: eventId });
        }
      }
    } catch (e) { /* pixel blocked — server side ยังยิงอยู่ */ }
    capiSend({
      event_name: eventName,
      event_id: eventId,
      event_params: p,
      fbp: getCookie('_fbp'),
      fbc: getCookie('_fbc'),
      page_url: window.location.href,
      page_referrer: document.referrer || ''
    });
  }

  function fireLead(ref, value) {
    track('Lead', { content_name: ref, value: value, currency: 'THB' });
  }

  // ผู้ใช้เปิดหน้าและเริ่มอ่าน → PageView + ViewContent หนึ่งครั้ง
  track('PageView');
  track('ViewContent', {
    content_type: 'product',
    content_ids: ['clickandcook-all-access'],
    content_name: 'All Access Sale Page',
    value: 1490,
    currency: 'THB'
  });

  /* ---------- Scroll depth 50/95% — วัดว่าอ่านถึงตรงไหน ---------- */
  var SCROLL_MARKS = [50, 95];
  var marksFired = {};

  function scrollPercent() {
    var doc = document.documentElement;
    var pageH = doc.scrollHeight || document.body.scrollHeight;
    var max = pageH - window.innerHeight;
    if (max <= 0) return 100;
    var scrolled = window.scrollY || doc.scrollTop || document.body.scrollTop || 0;
    return Math.min(100, (scrolled / max) * 100);
  }

  function checkScrollMarks() {
    var current = scrollPercent();
    SCROLL_MARKS.forEach(function (m) {
      if (!marksFired[m] && current >= m) {
        marksFired[m] = true;
        track('ViewContent_' + m, { content_name: 'scroll_' + m + 'pct' });
      }
    });
  }

  var scrollTick = false;
  window.addEventListener('scroll', function () {
    if (scrollTick) return;
    scrollTick = true;
    setTimeout(function () { scrollTick = false; checkScrollMarks(); }, 200);
  }, { passive: true });
  checkScrollMarks();

  /* ---------- Lucide icons ---------- */
  function renderIcons() {
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }
  renderIcons();
  window.addEventListener('load', renderIcons);

  /* ---------- Sticky CTA bar ----------
     Hidden while the hero, pricing, or final section is in view —
     same rule as the design prototype. Also hidden for a moment when
     the user just clicked it so the Messenger tab isn't doubled. */
  var stickyBar = document.getElementById('sticky-bar');
  var heroEl = document.getElementById('hero-section');
  var pricingEl = document.getElementById('pricing-section');
  var finalEl = document.getElementById('final-section');

  var heroVisible = true;
  var pricingVisible = false;
  var finalVisible = false;

  function updateSticky() {
    if (!stickyBar) return;
    var hide = heroVisible || pricingVisible || finalVisible;
    stickyBar.classList.toggle('hidden', hide);
  }

  if ('IntersectionObserver' in window) {
    if (heroEl) {
      var obsHero = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          heroVisible = e.isIntersecting;
          updateSticky();
        });
      }, { threshold: 0.2 });
      obsHero.observe(heroEl);
    }

    if (pricingEl) {
      var obsPricing = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          pricingVisible = e.isIntersecting;
          updateSticky();
        });
      }, { threshold: 0.4 });
      obsPricing.observe(pricingEl);
    }

    if (finalEl) {
      var obsFinal = new IntersectionObserver(function (obsEntries) {
        obsEntries.forEach(function (e) {
          finalVisible = e.isIntersecting;
          updateSticky();
        });
      }, { threshold: 0.15 });
      obsFinal.observe(finalEl);
    }
  } else {
    // Very old browsers: never show the bar rather than double-cover CTAs.
    stickyBar.classList.add('hidden');
  }

  /* ---------- Lead events on every Messenger CTA ----------
     ใน in-app browser ของ Facebook/Instagram การเปิด _blank จะซ้อน
     browser ใหม่แล้วโผล่ interstitial "เบราว์เซอร์ไม่ปลอดภัย" ทั้งที่
     เว็บปกติ — เปิด tab เดิมแทน (m.me จะ hand-off เข้าแอป Messenger
     โดยตรง) ส่วน browser ปกติคง _blank เดิมไว้ */
  document.querySelectorAll('.pixel-lead').forEach(function (a) {
    a.addEventListener('click', function () {
      fireLead(a.getAttribute('data-ref'), parseInt(a.getAttribute('data-value'), 10) || 0);
      if (IN_APP) a.removeAttribute('target');
    });
  });

  /* ---------- ButtonClick — ทุกปุ่ม/ลิงก์บนหน้า ---------- */
  function buttonLabel(el) {
    var t = el.getAttribute('data-ref') ||
            el.getAttribute('aria-label') ||
            (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t.slice(0, 60);
  }
  document.querySelectorAll('a, button, [data-course-toggle]').forEach(function (el) {
    el.addEventListener('click', function () {
      track('ButtonClick', { button_label: buttonLabel(el) });
    });
  });

  /* ---------- Review slider (Instagram-style) ---------- */
  var rail = document.getElementById('review-rail');
  var reviewIndex = 0;

  function reviewCards() {
    return rail ? Array.prototype.slice.call(rail.children) : [];
  }

  function syncReviewUI() {
    var kids = reviewCards();
    var dotsWrap = document.getElementById('review-dots');
    if (dotsWrap) {
      Array.prototype.forEach.call(dotsWrap.children, function (dot, i) {
        dot.classList.toggle('active', i === reviewIndex);
      });
    }
    if (prevBtn) prevBtn.disabled = reviewIndex === 0;
    if (nextBtn) nextBtn.disabled = reviewIndex === kids.length - 1;
  }

  function goToReview(i) {
    var kids = reviewCards();
    if (!kids.length) return;
    reviewIndex = Math.max(0, Math.min(kids.length - 1, i));
    var target = kids[reviewIndex];
    rail.scrollTo({ left: target.offsetLeft - rail.offsetLeft, behavior: 'smooth' });
    syncReviewUI();
  }

  function scrollReviews(dir) { goToReview(reviewIndex + dir); }

  var prevBtn = document.getElementById('review-prev');
  var nextBtn = document.getElementById('review-next');
  if (prevBtn) prevBtn.addEventListener('click', function () { scrollReviews(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { scrollReviews(1); });

  // Build the clickable position dots.
  var dotsWrap = document.getElementById('review-dots');
  if (dotsWrap && rail) {
    reviewCards().forEach(function (_, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', 'รีวิวที่ ' + (i + 1));
      dot.addEventListener('click', function () { goToReview(i); });
      dotsWrap.appendChild(dot);
    });
  }

  // Keep the index honest when the user swipes the slider manually.
  if (rail) {
    var scrollTimer = null;
    rail.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        var kids = reviewCards();
        if (!kids.length) return;
        var railLeft = rail.getBoundingClientRect().left;
        var best = 0;
        var bestDist = Infinity;
        kids.forEach(function (kid, i) {
          var d = Math.abs(kid.getBoundingClientRect().left - railLeft);
          if (d < bestDist) { bestDist = d; best = i; }
        });
        reviewIndex = best;
        syncReviewUI();
      }, 120);
    }, { passive: true });
  }
  syncReviewUI();

  /* ---------- Course detail accordions ----------
     One card open at a time — matches the prototype's openCourse state.
     The toggle label flips between "ดูเมนูทั้งหมด …" and "ย่อรายละเอียด". */
  var cards = document.querySelectorAll('[data-course]');
  var DEFAULT_LABELS = {};
  cards.forEach(function (card) {
    var btn = card.querySelector('[data-course-toggle]');
    var labelEl = card.querySelector('[data-course-togglelabel]');
    var caretEl = card.querySelector('[data-course-caret]');
    if (!btn || !labelEl) return;
    DEFAULT_LABELS[cardIndex(card)] = labelEl.textContent;

    btn.addEventListener('click', function () {
      var isOpen = card.classList.contains('open');

      // close any other open card
      cards.forEach(function (other) {
        if (other !== card) setCardOpen(other, false);
      });
      setCardOpen(card, !isOpen);
    });

    function setCardOpen(c, open) {
      c.classList.toggle('open', open);
      var b = c.querySelector('[data-course-toggle]');
      var l = c.querySelector('[data-course-togglelabel]');
      var caret = c.querySelector('[data-course-caret]');
      if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (l) l.textContent = open ? 'ย่อรายละเอียด' : DEFAULT_LABELS[cardIndex(c)];
      if (caret) caret.textContent = open ? '▴' : '▾';
    }
  });

  function cardIndex(card) {
    return Array.prototype.indexOf.call(cards, card);
  }
})();
