/* ==========================================================================
   Свадьба Камала и Алины — 22.10.2026
   Логика приглашения. Без сборки и зависимостей.
   ========================================================================== */

(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');

  /** Русское склонение по числу: 1 год / 2 года / 5 лет. */
  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    if (b >= 11 && b <= 14) return many;
    if (a === 1) return one;
    if (a >= 2 && a <= 4) return few;
    return many;
  };

  const WEDDING = new Date('2026-10-22T16:00:00+06:00').getTime();
  const MET     = new Date('2023-06-12T00:00:00+06:00').getTime();
  const STORE   = 'ka-wishes-v2';

  const frame = $('frame');

  const state = {
    step: 'idle',        // idle → form → done
    coming: 'yes',
    guests: 1,
    scrolled: false,
    storyProg: 0,
    userWishes: [],
    pos: {},
  };

  /* ------------------------------------------------------- приветствие --- */

  // Обращение: ?guest=Имя[&s=ж|м|мн]. Форму рода лучше задавать в ссылке явно —
  // догадка по окончанию промахивается и на женских именах без «-а/-я»
  // (Айгерим, Жанар, Гүлнар), и на мужских с ними (Никита, Илья, Мустафа).
  const GREETINGS = {};
  const alias = (word, keys) => keys.forEach(k => { GREETINGS[k] = word; });
  alias('Дорогая', ['ж', 'жен', 'женский', 'женская', 'женщина', 'f', 'female']);
  alias('Дорогой', ['м', 'муж', 'мужской', 'мужская', 'мужчина', 'm', 'male']);
  alias('Дорогие', ['мн', 'мно', 'множественное', 'пара', 'семья', 'все', 'p', 'plural']);

  let invitedAs = '';                 // имя из персональной ссылки, уходит с ответом

  (function greeting() {
    let name = '', form = '';
    try {
      const u = new URL(location.href);
      name = (u.searchParams.get('guest') || u.searchParams.get('g') ||
              decodeURIComponent(u.hash.replace(/^#/, '')) || '').trim();
      form = (u.searchParams.get('s') || u.searchParams.get('sex') || '').trim().toLowerCase();
    } catch (e) { /* некорректный URL — оставляем общее приветствие */ }
    if (!name) return;

    invitedAs = name;
    const word = GREETINGS[form] || (/[ая]$/i.test(name) ? 'Дорогая' : 'Дорогой');
    $('greeting').textContent = `${word} ${name}, приглашаем вас на свадьбу`;
  })();

  /* -------------------------------------------------- отправка ответов --- */

  // Адрес берём из разметки, а не из константы здесь: так его можно поменять,
  // не трогая код, и подменить в тестах.
  const endpoint = () => {
    const m = document.querySelector('meta[name="rsvp-endpoint"]');
    return (m && m.content || '').trim();
  };

  async function send(payload) {
    const url = endpoint();
    if (!url) {
      console.warn('[приглашение] meta[name="rsvp-endpoint"] пуст — ответ никуда ' +
                   'не отправлен. Заполните его, иначе ответы гостей теряются.', payload);
      return;
    }
    // text/plain — простой запрос: браузер не шлёт предварительный OPTIONS,
    // который Apps Script не умеет обрабатывать.
    //
    // no-cors обязателен: Apps Script записывает данные и отвечает 302 на
    // script.googleusercontent.com, а тот на повторный POST отдаёт 405. Читая
    // ответ, мы принимали этот 405 за провал и пугали гостя, хотя строка в
    // таблице уже стояла. Теперь ответ не читаем вовсе.
    //
    // Что ловим: fetch отклоняется, только если запрос физически не ушёл —
    // нет сети, нет DNS, адрес недостижим. Это и есть случай «связь пропала».
    // Чего не увидим: сбой уже внутри скрипта. Ценой этого — отсутствие
    // ложных ошибок на ровном месте.
    // Сети нет — это видно сразу, гостя ждать не заставляем.
    if (navigator.onLine === false) throw new Error('нет сети');

    const запрос = fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ at: new Date().toISOString(), ...payload }),
    });

    // Скрипт записывает строку и тут же отвечает редиректом, по которому
    // браузер ходит ещё пару секунд впустую. Дожидаться этого незачем:
    // отказ по связи прилетает в первые миллисекунды, а всё, что дольше, —
    // это уже дорога туда-обратно по успешному запросу.
    const отказ = запрос.then(() => null, err => err);
    const ждём = new Promise(r => setTimeout(() => r(null), 1500));
    const err = await Promise.race([отказ, ждём]);
    if (err) throw err;
  }

  /* ------------------------------------------------ календарь октября --- */

  (function calendar() {
    const box = $('cal-cells');
    const cells = [];
    for (let i = 0; i < 3; i++) cells.push({ n: '' });               // 1 окт. — четверг
    for (let d = 1; d <= 31; d++) cells.push({ n: String(d), day: d });
    while (cells.length % 7) cells.push({ n: '' });

    box.innerHTML = cells.map(c => {
      if (!c.day) return '<div class="cell"></div>';
      const today = c.day === 22;
      const color = today ? 'var(--cream)' : c.day < 22 ? 'var(--mute-2)' : 'var(--mute)';
      const bg = today ? 'background:var(--red);' : '';
      const fs = today ? 'font-style:italic;' : '';
      return `<div class="cell" style="color:${color};${bg}${fs}">${c.n}</div>`;
    }).join('');
  })();

  /* ---------------------------------------------- деления циферблата --- */

  (function ticks() {
    const g = $('ticks');
    let out = '';
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      out += `<line x1="0" y1="-186" x2="0" y2="${major ? -170 : -178}" ` +
             `stroke="#F2ECE4" stroke-width="${major ? 2 : 1}" stroke-opacity=".5" ` +
             `transform="rotate(${i * 6})"></line>`;
    }
    g.innerHTML = out;
  })();

  /* --------------------------------------------- отсчёт и «вместе уже» --- */

  function tick() {
    const now = Date.now();
    const left = Math.max(0, WEDDING - now);

    const days = Math.floor(left / 864e5);
    const word = plural(days, 'день', 'дня', 'дней');
    $('cd-days').textContent = String(days);
    $('cd-days-big').textContent = String(days);
    $('days-word').textContent = word;
    $('days-word-2').textContent = word;
    $('cd-hours').textContent = pad(Math.floor(left / 36e5) % 24);
    $('cd-min').textContent = pad(Math.floor(left / 6e4) % 60);
    $('cd-sec').textContent = pad(Math.floor(left / 1e3) % 60);

    $('sec-ring').setAttribute('stroke-dashoffset', String(1030.4 * (1 - (Math.floor(left / 1e3) % 60) / 60)));
    $('min-ring').setAttribute('stroke-dashoffset', String(929.9 * (1 - (Math.floor(left / 6e4) % 60) / 60)));
    $('sec-hand').style.transform = `rotate(${-Math.floor(left / 1e3) * 6}deg)`;

    // «вместе уже»: календарная разница плюс бегущие часы/минуты/секунды
    const since = now - MET;
    const from = new Date(MET), nowD = new Date(now);
    let y = nowD.getFullYear() - from.getFullYear();
    let m = nowD.getMonth() - from.getMonth();
    let d = nowD.getDate() - from.getDate();
    if (d < 0) { m--; d += new Date(nowD.getFullYear(), nowD.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }

    $('since-years').textContent = String(y);
    $('since-years-word').textContent = plural(y, 'год', 'года', 'лет');
    $('since-months').textContent = String(m);
    $('since-months-word').textContent = plural(m, 'месяц', 'месяца', 'месяцев');
    $('since-days').textContent = String(d);
    $('since-days-word').textContent = plural(d, 'день', 'дня', 'дней');
    $('since-hours').textContent = pad(Math.floor(since / 36e5) % 24);
    $('since-min').textContent = pad(Math.floor(since / 6e4) % 60);
    $('since-sec').textContent = pad(Math.floor(since / 1e3) % 60);
  }
  tick();
  setInterval(tick, 1000);

  /* --------------------------------------------------------- погода --- */

  (async function weather() {
    const text = $('weather-text'), temp = $('weather-temp');
    const days = (WEDDING - Date.now()) / 864e5;

    if (days > 15 || days < -1) {
      text.textContent = 'Прогноз появится за две недели до свадьбы';
      return;
    }
    try {
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=42.87&longitude=74.59' +
        '&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia%2FBishkek' +
        '&start_date=2026-10-22&end_date=2026-10-22');
      const j = await r.json();
      const c = j.daily.weathercode[0];
      const desc = c === 0 ? 'Ясно' : c <= 2 ? 'Малооблачно' : c === 3 ? 'Облачно'
        : c <= 48 ? 'Туман' : c <= 67 ? 'Дождь' : c <= 77 ? 'Снег' : c <= 82 ? 'Ливень' : 'Гроза';
      text.textContent = `${desc}, ночью до ${Math.round(j.daily.temperature_2m_min[0])}°`;
      temp.textContent = Math.round(j.daily.temperature_2m_max[0]) + '°';
      temp.style.color = 'var(--cream)';
    } catch (e) {
      text.textContent = 'Прогноз пока недоступен';
    }
  })();

  /* ------------------------------------------- угольки в шапке + парал --- */

  const mouse = { x: -9999, y: -9999 };

  (function embers() {
    const c = $('hero-canvas');
    const ctx = c.getContext('2d');
    const ghost = $('ghost'), glyphs = $('glyphs');
    const rnd = (u, v) => u + Math.random() * (v - u);

    let W = 0, H = 0, P = [];
    let px = 0, py = 0;              // сглаженное смещение параллакса
    const spawn = () => ({
      x: Math.random() * W, y: H + rnd(0, H), vy: rnd(.25, .9), sw: rnd(.2, .8),
      ph: rnd(0, 6.28), sz: rnd(.8, 3), al: rnd(.18, .6), dx: 0, dy: 0,
    });

    const fit = () => {
      const r = c.getBoundingClientRect();
      if (r.width === W && r.height === H) return;
      W = r.width; H = r.height;
      c.width = W * devicePixelRatio;
      c.height = H * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      if (!P.length) P = Array.from({ length: 260 }, spawn);
    };

    const step = t => {
      fit();
      ctx.clearRect(0, 0, W, H);

      // Курсор ушёл за окно — цель ноль, а не мусорные -9999, иначе «22»
      // уезжает на сотни пикселей и пропадает с экрана. Догоняем цель
      // плавно: и слежение мягче, и возврат без рывка.
      const inside = mouse.x > -999;
      px += ((inside ? mouse.x / W - .5 : 0) - px) * .08;
      py += ((inside ? mouse.y / H - .5 : 0) - py) * .08;

      if (ghost) ghost.style.translate = `${px * -40}px ${py * -30}px`;
      if (glyphs) {
        [...glyphs.children].forEach((el, i) => {
          const depth = 12 + (i % 4) * 14;
          el.style.translate = `${px * -depth}px ${py * -depth * .7}px`;
        });
      }

      for (const q of P) {
        q.y -= q.vy;
        q.x += Math.sin(t / 1400 + q.ph) * q.sw * .4;
        const mx = q.x - mouse.x, my = q.y - mouse.y, md = Math.hypot(mx, my) || 1;
        if (md < 160) { const f = (1 - md / 160) * 3; q.dx += (mx / md) * f; q.dy += (my / md) * f; }
        q.dx *= .9; q.dy *= .9;
        if (q.y < -10) { Object.assign(q, spawn()); q.y = H + 10; }
        ctx.globalAlpha = q.al * Math.min(1, (H - q.y) / (H * .15) + .2) * Math.min(1, q.y / (H * .12));
        ctx.fillStyle = Math.random() < .12 ? '#F2ECE4' : '#8C1130';
        ctx.beginPath();
        ctx.arc(q.x + q.dx, q.y + q.dy, q.sz, 0, 6.283);
        ctx.fill();
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  })();

  window.addEventListener('mousemove', e => {
    const r = $('hero-canvas').getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  window.addEventListener('mouseout', () => { mouse.x = -9999; mouse.y = -9999; });

  /* ----------------------------------------------------------- скролл --- */

  // Подсказка о прокрутке одноразовая: спрятали — и больше не возвращаем,
  // даже если гость отлистал обратно наверх. Флаг state.scrolled для этого
  // не годится, он ходит в обе стороны вместе с плавающей кнопкой.
  let hintShown = true;

  function onScroll() {
    const st = frame.scrollTop, vh = frame.clientHeight;

    if (hintShown && st > 24) { hintShown = false; $('stage').classList.add('scrolled'); }

    const sr = $('story-scroll');
    if (sr) {
      const r = sr.getBoundingClientRect(), fr = frame.getBoundingClientRect();
      const seen = Math.max(0, Math.min(1, (fr.top + vh * .85 - r.top) / (vh * .5)));
      const p = Math.min(1, (sr.scrollLeft + sr.clientWidth * seen) / Math.max(1, sr.scrollWidth));
      if (Math.abs(p - state.storyProg) > .01) {
        state.storyProg = p;
        $('story-prog').style.width = Math.round(p * 100) + '%';
      }
    }

    const sc = st > vh * .6;
    if (sc !== state.scrolled) { state.scrolled = sc; syncSticky(); }
  }
  frame.addEventListener('scroll', onScroll, { passive: true });
  $('story-scroll').addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function syncSticky() {
    $('sticky').hidden = !(state.step === 'idle' && state.scrolled);
  }

  $('sticky').addEventListener('click', () => {
    const el = $('rsvp');
    const top = el.getBoundingClientRect().top + frame.scrollTop - frame.getBoundingClientRect().top;
    frame.scrollTo({ top, behavior: 'smooth' });
    state.step = 'form';
    syncSticky();
  });

  /* ------------------------------------------------ появление секций --- */

  const reveal = (entries, observer) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.style.opacity = 1;
      en.target.style.transform = 'none';
      observer.unobserve(en.target);
    });
  };

  const io = new IntersectionObserver(reveal, { threshold: .15 });

  // Карточки таймлайна листаются вбок, и последняя из них упирается в конец
  // ленты, показавшись примерно на 15%. С порогом .15 она так и осталась бы
  // пустой у тех, кто пролистал историю одним быстрым движением.
  const ioEdge = new IntersectionObserver(reveal, { threshold: 0 });

  const prime = (sel, transform, transition, observer = io) => {
    document.querySelectorAll(sel).forEach(el => {
      el.style.opacity = 0;
      el.style.transform = transform;
      el.style.transition = transition;
      observer.observe(el);
    });
  };
  const REVEAL_UP = 'opacity 1s cubic-bezier(.2,.7,.2,1), transform 1s cubic-bezier(.2,.7,.2,1)';
  prime('.story-item[data-reveal]', 'translateY(48px)', REVEAL_UP, ioEdge);
  prime('[data-reveal]:not(.story-item)', 'translateY(48px)', REVEAL_UP);
  prime('[data-reveal-left]', 'translateX(-60%)',
    'opacity 1.4s ease, transform 1.4s cubic-bezier(.2,.7,.2,1)');
  prime('[data-reveal-right]', 'translateX(60%)',
    'opacity 1.4s ease, transform 1.4s cubic-bezier(.2,.7,.2,1)');

  /* --------------------------------------------- цитата по словам --- */

  (function splitQuote() {
    const q = $('quote');

    const wrapTextNode = node => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(w => {
        if (!w) return;
        if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
        const s = document.createElement('span');
        s.textContent = w;
        s.dataset.w = '1';
        s.style.cssText = 'display:inline-block;opacity:0;transform:translateY(.35em) rotate(1.5deg);' +
          'filter:blur(4px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),' +
          'transform .9s cubic-bezier(.2,.7,.2,1),filter .9s';
        frag.appendChild(s);
      });
      node.parentNode.replaceChild(frag, node);
    };

    [...q.childNodes].forEach(n => {
      if (n.nodeType === 3) wrapTextNode(n);
      else [...n.childNodes].forEach(c => { if (c.nodeType === 3) wrapTextNode(c); });
    });

    const words = q.querySelectorAll('[data-w]');
    const qo = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        words.forEach((s, i) => {
          s.style.transitionDelay = (i * 70) + 'ms';
          s.style.opacity = 1;
          s.style.transform = 'none';
          s.style.filter = 'none';
        });
        const em = q.querySelector('em');
        if (em) em.style.backgroundSize = '100% 1px';
        qo.disconnect();
      });
    }, { threshold: .4 });
    qo.observe(q);
  })();

  /* ------------------------------------------------- наклон карточек --- */

  [['date-card'], ['place-card']].forEach(([id]) => {
    const el = $(id);
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(1200px) rotateY(${x * 8}deg) rotateX(${y * -8}deg) translateY(-4px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = 'none'; });
  });

  /* -------------------------------------------------------------- RSVP --- */

  const nameInput = $('name'), nameError = $('name-error');

  nameInput.addEventListener('input', () => {
    nameError.hidden = true;
    nameInput.classList.remove('invalid');
  });

  $('inc').addEventListener('click', () => { state.guests = Math.min(10, state.guests + 1); $('guests').textContent = state.guests; });
  $('dec').addEventListener('click', () => { state.guests = Math.max(1, state.guests - 1); $('guests').textContent = state.guests; });

  const setComing = v => {
    state.coming = v;
    $('btn-yes').setAttribute('aria-pressed', String(v === 'yes'));
    $('btn-no').setAttribute('aria-pressed', String(v === 'no'));
  };
  $('btn-yes').addEventListener('click', () => setComing('yes'));
  $('btn-no').addEventListener('click', () => setComing('no'));

  const submitBtn = $('submit'), sendError = $('send-error');

  function setSending(on) {
    submitBtn.disabled = on;
    submitBtn.firstElementChild.textContent = on ? 'Отправляем…' : 'Отправить ответ';
  }

  $('retry').addEventListener('click', () => $('rsvp-form').requestSubmit());

  $('rsvp-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameError.hidden = false;
      nameInput.classList.add('invalid');
      nameInput.focus();
      return;
    }

    const ticket = $('ticket');
    const yes = state.coming === 'yes';

    // Праздничный экран показываем только после того, как ответ реально ушёл:
    // иначе гость уйдёт довольным, а за столом его никто не ждёт.
    sendError.hidden = true;
    setSending(true);
    try {
      await send({ kind: 'rsvp', name, coming: state.coming, guests: state.guests, invitedAs });
    } catch (err) {
      setSending(false);
      sendError.hidden = false;
      return;
    }
    setSending(false);

    ticket.style.animation = 'flipOut .45s cubic-bezier(.7,0,.84,0) forwards';
    setTimeout(() => {
      state.step = 'done';
      syncSticky();

      $('rsvp-form').hidden = true;
      $('rsvp-done').hidden = false;
      $('done-kicker').textContent = yes ? 'Ждём вас' : 'Спасибо за ответ';
      $('done-name').firstElementChild.textContent = name.replace(/[.,!;:]+$/, '');
      $('done-text').textContent = yes
        ? '22 октября, 16:00, ресторан Versal. Ваше место за столом уже ждёт.'
        : 'Нам будет вас не хватать. Мы обязательно поднимем бокал и за вас.';
      $('done-count').textContent =
        `Ответ принят · ${state.guests} ${plural(state.guests, 'гость', 'гостя', 'гостей')}`;

      ticket.style.animation = 'flipIn .6s cubic-bezier(.16,1,.3,1) both';
      if (yes) petals();
    }, 450);
  });

  /* ------------------------------------------------- билет в картинку --- */

  function drawTicket() {
    const W = 1080, H = 1920;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const name = nameInput.value.trim();

    x.fillStyle = '#0B0B0B'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#8C1130'; x.fillRect(0, 0, W, 620);

    x.fillStyle = '#0B0B0B'; x.font = 'italic 520px "Playfair Display", Georgia, serif';
    x.globalAlpha = .12; x.fillText('&', 560, 560); x.globalAlpha = 1;

    x.fillStyle = '#0B0B0B'; x.font = '500 28px Jost, sans-serif'; x.letterSpacing = '10px';
    x.fillText('ПРИГЛАСИТЕЛЬНЫЙ', 80, 120);
    x.textAlign = 'right'; x.fillText('22 · 10 · 2026', W - 80, 120); x.textAlign = 'left';

    x.font = '400 190px "Playfair Display", Georgia, serif'; x.letterSpacing = '-8px';
    x.fillText('КАМАЛ', 80, 380); x.fillText('АЛИНА', 80, 560);

    x.fillStyle = '#F2ECE4'; x.font = 'italic 120px "Playfair Display", Georgia, serif';
    x.letterSpacing = '0px'; x.fillText('и', 760, 470);

    x.fillStyle = '#A9A29A'; x.font = '500 26px Jost, sans-serif'; x.letterSpacing = '9px';
    x.fillText('ГОСТЬ', 80, 780);
    x.fillStyle = '#F2ECE4'; x.font = 'italic 96px "Playfair Display", Georgia, serif';
    x.letterSpacing = '-2px'; x.fillText(name.slice(0, 22), 80, 890);

    x.fillStyle = '#A9A29A'; x.font = '500 26px Jost, sans-serif'; x.letterSpacing = '9px';
    x.fillText('ОТВЕТ', 80, 1010);
    x.fillStyle = '#8C1130'; x.font = 'italic 84px "Playfair Display", Georgia, serif';
    x.letterSpacing = '0px';
    x.fillText(state.coming === 'yes' ? 'Приду с радостью' : 'К сожалению, не смогу', 80, 1110);

    x.strokeStyle = 'rgba(242,236,228,.25)'; x.lineWidth = 2; x.setLineDash([12, 14]);
    x.beginPath(); x.moveTo(80, 1240); x.lineTo(W - 80, 1240); x.stroke(); x.setLineDash([]);

    x.fillStyle = '#A9A29A'; x.font = '500 26px Jost, sans-serif'; x.letterSpacing = '9px';
    x.fillText('КОГДА', 80, 1340); x.fillText('ГДЕ', 560, 1340);
    x.fillStyle = '#F2ECE4'; x.font = '400 72px "Playfair Display", Georgia, serif';
    x.letterSpacing = '-2px'; x.fillText('22 октября', 80, 1430); x.fillText('Versal', 560, 1430);
    x.fillStyle = '#A9A29A'; x.font = 'italic 40px "Cormorant Garamond", Georgia, serif';
    x.letterSpacing = '0px'; x.fillText('2026, четверг, 16:00', 80, 1490); x.fillText('ресторан, Бишкек', 560, 1490);

    x.beginPath(); x.arc(W - 200, 1720, 110, 0, 6.283); x.fillStyle = '#8C1130'; x.fill();
    x.fillStyle = '#F2ECE4'; x.font = 'italic 78px "Playfair Display", Georgia, serif';
    x.textAlign = 'center'; x.fillText('К&А', W - 200, 1748); x.textAlign = 'left';

    x.fillStyle = '#A9A29A'; x.font = '500 24px Jost, sans-serif'; x.letterSpacing = '9px';
    x.fillText('С ЛЮБОВЬЮ, КАМАЛ И АЛИНА', 80, 1760);

    return c;
  }

  async function ticketBlob() {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    return new Promise(res => drawTicket().toBlob(res, 'image/png'));
  }

  const download = (blob, filename) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  $('save-ticket').addEventListener('click', async () => {
    download(await ticketBlob(), 'Kamal-Alina-22-10-2026.png');
  });

  /* ------------------------------------------------------ лепестки --- */

  // soft — лепестки на входе: реже, мельче и короче, чтобы финальный залп
  // после «Приду» остался кульминацией, а не повтором уже виденного.
  function petals(soft) {
    const c = $('petals');
    const ctx = c.getContext('2d');
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * devicePixelRatio;
    c.height = h * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    const count = soft ? 42 : 90;
    const span = soft ? 4000 : 7000;

    const P = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: -40 - Math.random() * h,
      s: (soft ? 4 : 6) + Math.random() * (soft ? 6 : 10),
      vy: (soft ? .8 : 1.2) + Math.random() * (soft ? 1.2 : 2),
      vx: -.6 + Math.random() * 1.2,
      r: Math.random() * Math.PI, vr: -.03 + Math.random() * .06,
      col: Math.random() < .8 ? '#8C1130' : '#0B0B0B',
    }));

    const t0 = performance.now();
    const step = t => {
      ctx.clearRect(0, 0, w, h);
      const life = (t - t0) / span;
      ctx.globalAlpha = life > .8 ? Math.max(0, 1 - (life - .8) / .2) : 1;
      P.forEach(p => {
        p.y += p.vy;
        p.x += p.vx + Math.sin(t / 900 + p.r) * .6;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.s, p.s * .55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      if (life < 1) requestAnimationFrame(step);
      else ctx.clearRect(0, 0, w, h);
    };
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------- пожелания --- */

  const WISH_TEXTS = [
    'Пусть ваш дом всегда будет полон смеха, а в холодильнике — бешбармака.',
    'Любите друг друга так же, как в первый день. И даже больше.',
    'Счастья, терпения и много совместных путешествий!',
    'Совет да любовь!',
    'Пусть каждое утро начинается с поцелуя.',
    'Крепкой семьи и долгих лет вместе.',
    'Берегите друг друга.',
    'Чтобы ссоры заканчивались смехом.',
    'Полный дом детей и гостей!',
    'Пусть любовь только растёт.',
    'Живите долго и счастливо, как в сказке.',
    'Здоровья, любви и тепла вашему дому.',
    'Пусть мечты сбываются вдвоём.',
    'Держитесь за руки всю жизнь.',
    'Самая красивая пара!',
    'Чтобы каждый день был как медовый месяц.',
    'Верности, нежности и понимания.',
    'Пусть дорога жизни будет светлой.',
    'Рады за вас безмерно!',
    'Будьте счастливы, ребята!',
    'Любви без конца и края.',
    'Ждём приглашения на юбилей — 50 лет!',
    'Никогда не забывайте этот день.',
    'Пусть в доме всегда пахнет пирогами.',
    'Спорьте только о том, кто больше любит.',
    'Много путешествий и ноль сожалений.',
    'Пусть каждое «доброе утро» будет искренним.',
    'Так держать!',
    'Слёзы только от счастья.',
    'Уважения и доверия друг к другу.',
  ];

  const WISH_NAMES = [
    'Айгерим', 'Данияр и Мадина', 'Тётя Гуля', 'Бекзат', 'Асель', 'Нурлан',
    'Дядя Марат', 'Жанар', 'Айдана и Ерлан', 'Бабушка Роза', 'Эльдар', 'Айым',
    'Тимур', 'Алия', 'Сания', 'Руслан', 'Камила', 'Дастан', 'Малика', 'Азамат',
    'Динара', 'Ислам', 'Аружан', 'Санжар', 'Дана', 'Бахыт', 'Лейла', 'Мирас',
    'Томирис', 'Арман',
  ];

  // Детерминированная раскладка: у всех гостей стикеры лежат одинаково.
  const DEFAULT_WISHES = (() => {
    let seed = 7;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: 30 }, (_, i) => ({
      text: WISH_TEXTS[i % WISH_TEXTS.length],
      name: WISH_NAMES[(i * 7) % WISH_NAMES.length],
      t: i,
      x: 2 + r() * 76,
      y: 5 + r() * 68,
      z: i + 1,
    }));
  })();

  const board = $('board');
  let topZ = 200;

  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) { state.userWishes = saved.added || []; state.pos = saved.pos || {}; }
  } catch (e) { /* localStorage недоступен — показываем только пожелания по умолчанию */ }

  const persist = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ added: state.userWishes, pos: state.pos }));
    } catch (e) { /* приватный режим — сохранять некуда */ }
  };

  const allWishes = () =>
    [...DEFAULT_WISHES, ...state.userWishes].map(w => state.pos[w.t] ? { ...w, ...state.pos[w.t] } : w);

  function updateCount() {
    const n = allWishes().length;
    $('wish-count').textContent =
      `${n} ${plural(n, 'пожелание', 'пожелания', 'пожеланий')} · стикеры можно двигать`;
  }

  function makeSticker(w, i) {
    const el = document.createElement('div');
    el.className = 'sticker';
    el.style.left = w.x + '%';
    el.style.top = w.y + '%';
    el.style.transform = `rotate(${(i % 2 ? 1 : -1) * (1.2 + (i % 4) * 0.9)}deg)`;
    el.style.background = i % 3 === 0 ? 'var(--red)' : i % 3 === 1 ? 'var(--cream)' : 'var(--yellow)';
    el.style.color = i % 3 === 0 ? 'var(--cream)' : 'var(--ink)';
    el.style.zIndex = String(w.z || i + 1);
    el.style.animation = `stamp .55s ${Math.min(i, 30) * 60 + 300}ms cubic-bezier(.2,1.2,.4,1) both`;

    const tape = document.createElement('div');
    tape.className = 'tape';
    tape.style.transform = `translateX(-50%) rotate(${(i % 2 ? -1 : 1) * (3 + (i % 3) * 2)}deg)`;

    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = w.text;

    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = w.name;

    el.append(tape, text, who);
    el.addEventListener('pointerdown', e => grab(w, el, e));
    return el;
  }

  function grab(wish, card, e) {
    e.preventDefault();
    card.setPointerCapture(e.pointerId);
    card.style.cursor = 'grabbing';

    const br = board.getBoundingClientRect(), cr = card.getBoundingClientRect();
    const ox = e.clientX - cr.left, oy = e.clientY - cr.top;
    const cw = cr.width, ch = cr.height;

    topZ += 1;
    const z = topZ;
    card.style.zIndex = String(z);

    let last = null;

    const move = ev => {
      const x = Math.max(0, Math.min(br.width - cw, ev.clientX - br.left - ox)) / br.width * 100;
      const y = Math.max(0, Math.min(br.height - ch, ev.clientY - br.top - oy)) / br.height * 100;
      card.style.left = x + '%';
      card.style.top = y + '%';
      last = { x, y, z };
    };

    const up = () => {
      card.releasePointerCapture(e.pointerId);
      card.style.cursor = 'grab';
      card.removeEventListener('pointermove', move);
      card.removeEventListener('pointerup', up);
      card.removeEventListener('pointercancel', up);
      if (last) { state.pos[wish.t] = last; persist(); }
    };

    card.addEventListener('pointermove', move);
    card.addEventListener('pointerup', up);
    card.addEventListener('pointercancel', up);
  }

  allWishes().forEach((w, i) => board.appendChild(makeSticker(w, i)));
  updateCount();

  $('wish-form').addEventListener('submit', async e => {
    e.preventDefault();
    const text = $('wish-text').value.trim();
    if (!text) return;

    const who = $('wish-name').value.trim() || 'Гость';
    const btn = $('wish-form').querySelector('button[type="submit"]');
    const wishError = $('wish-error');

    // Стикер вешаем на доску только после отправки — иначе гость решит,
    // что пожелание дошло, а оно осталось в его браузере.
    wishError.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Отправляем…';
    try {
      await send({ kind: 'wish', name: who, text });
    } catch (err) {
      wishError.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Оставить';
      return;
    }
    btn.disabled = false;
    btn.textContent = 'Оставить';

    topZ += 1;
    const wish = {
      text,
      name: who,
      t: Date.now(),
      x: 4 + Math.random() * 72,
      y: 6 + Math.random() * 64,
      z: topZ,
    };

    state.userWishes = [...state.userWishes, wish].slice(-30);
    persist();

    board.appendChild(makeSticker(wish, allWishes().length - 1));
    updateCount();

    $('wish-text').value = '';
    $('wish-name').value = '';
  });

  /* ---------------------------------------------------------- музыка --- */

  const audio = $('audio'), musicBtn = $('music-btn'), musicLabel = $('music-label');
  let mutedByUser = false;   // гость выключил сам — больше не навязываемся

  // Состояние кнопки ведём от самого <audio>: пока трек играет немым,
  // звука нет — и подпись «Звук» врала бы.
  const syncMusic = () => {
    const on = !audio.paused && !audio.muted;
    musicBtn.classList.toggle('playing', on);
    musicLabel.textContent = on ? 'Звук' : 'Музыка';
  };
  ['play', 'pause', 'volumechange', 'error'].forEach(e => audio.addEventListener(e, syncMusic));

  const FADE_IN = 1600, FADE_OUT = 700;   // мс
  const START_AT = 75;                    // 1:15 — вступление пропускаем

  // Перематываем только если трек ещё не дошёл до этой точки: после паузы
  // гость продолжает с места, где остановился, а не слушает одно и то же.
  function seekToStart() {
    if (audio.currentTime >= START_AT) return;
    if (isFinite(audio.duration) && audio.duration <= START_AT) return;
    if (audio.readyState >= 1) { audio.currentTime = START_AT; return; }
    audio.addEventListener('loadedmetadata', () => {
      if (audio.currentTime < START_AT) audio.currentTime = START_AT;
    }, { once: true });
  }

  // Штатный loop возвращал бы на 0, то есть ровно на пропущенное вступление,
  // поэтому крутим круг вручную.
  audio.addEventListener('ended', () => {
    audio.currentTime = START_AT;
    audio.play().catch(() => {});
  });

  // iOS игнорирует программную установку volume — громкость там отдана только
  // аппаратной кнопке, и затухание через неё не сработало бы. Проверяем один
  // раз и, если так, ведём громкость через Web Audio: gain слушается везде.
  const volumeWorks = (() => {
    try {
      const was = audio.volume;
      audio.volume = .123;
      const ok = Math.abs(audio.volume - .123) < 1e-6;
      audio.volume = was;
      return ok;
    } catch (e) { return false; }
  })();

  let actx = null, gainNode = null;
  function gain() {
    if (gainNode || volumeWorks) return gainNode;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      actx = new AC();
      const src = actx.createMediaElementSource(audio);
      gainNode = actx.createGain();
      gainNode.gain.value = 0;
      src.connect(gainNode).connect(actx.destination);
    } catch (e) { actx = null; gainNode = null; }
    return gainNode;
  }

  let fadeRaf = 0, fadeDone = 0;

  function setVolumeNow(v) {
    const g = gain();
    if (g && actx) {
      g.gain.cancelScheduledValues(actx.currentTime);
      g.gain.setValueAtTime(v, actx.currentTime);
    } else if (volumeWorks) {
      audio.volume = v;
    }
  }

  function fadeTo(target, ms, then) {
    cancelAnimationFrame(fadeRaf);
    clearTimeout(fadeDone);

    const g = gain();
    if (g && actx) {
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(target, t + ms / 1000);
    } else if (volumeWorks) {
      const from = audio.volume, t0 = performance.now();
      const step = now => {
        // Метка кадра отсчитывается от его начала и бывает раньше t0, взятого
        // уже внутри кадра. Без зажима доля уходит в минус, громкость
        // выпадает из [0,1], браузер бросает исключение и обрывает анимацию.
        const k = Math.max(0, Math.min(1, (now - t0) / ms));
        audio.volume = Math.max(0, Math.min(1, from + (target - from) * k));
        if (k < 1) fadeRaf = requestAnimationFrame(step);
      };
      fadeRaf = requestAnimationFrame(step);
    }

    if (then) fadeDone = setTimeout(then, ms);
  }

  // Вызывать строго синхронно из обработчика настоящего клика — иначе
  // браузер не засчитает активацию и откажет.
  function startMusic() {
    mutedByUser = false;
    audio.muted = false;
    seekToStart();
    setVolumeNow(0);                  // с тишины, чтобы нарастание было слышно
    const p = audio.play();
    fadeTo(1, FADE_IN);
    return p || Promise.resolve();
  }

  function stopMusic() {
    mutedByUser = true;
    // Кнопку гасим сразу: ждать конца затухания — значит не отвечать на нажатие.
    musicBtn.classList.remove('playing');
    musicLabel.textContent = 'Музыка';
    fadeTo(0, FADE_OUT, () => audio.pause());
  }

  musicBtn.addEventListener('click', () => {
    if (!audio.paused && !audio.muted) { stopMusic(); return; }
    startMusic().catch(() => {});
  });

  // Автозапуск со звуком браузеру не продать: нужно настоящее действие гостя,
  // а синтетический клик не засчитывается — у событий из скрипта isTrusted
  // равен false, защита сделана ровно против такого обхода. Немой автозапуск
  // тоже не выручает: послабление «muted можно» действует только для <video>,
  // к <audio> политика применяется независимо от громкости.
  // Поэтому: пробуем со звуком (некоторым браузер разрешает сразу), а иначе
  // включаем на первом же настоящем касании, клике или клавише.
  (function autoplayMusic() {
    // Активацию дают только эти события. Ни wheel, ни scroll её не дают —
    // прокрутка колесом музыку не включит. На iOS звук разрешается
    // на touchend/click, но не на touchstart, поэтому нужны оба конца жеста.
    const EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];

    function start(e) {
      EVENTS.forEach(ev => window.removeEventListener(ev, start));
      // Нажали саму кнопку или печать — пусть их обработчики и решают, без гонки.
      if (e && e.target && e.target.closest &&
          e.target.closest('#music-btn, #op-btn')) return;
      if (mutedByUser || !audio.paused) return;
      startMusic().catch(() => {});
    }

    startMusic().catch(() => EVENTS.forEach(ev => window.addEventListener(ev, start)));
  })();

  /* -------------------------------------------------------- заставка --- */

  (function opening() {
    const box = $('opening'), btn = $('op-btn'), stage = $('stage');
    const row = document.querySelector('.names .amp-row');
    let opened = false;

    // Точка, нить и полоса должны стоять ровно на строке с «и»: тогда полоса,
    // похудев до линии, садится точно туда, где её подхватят штатные линии.
    // Меряем без анимации — иначе поймали бы сдвинутую позицию кадра.
    function placeOnAmpRow() {
      if (!row) return;
      const was = row.style.animation;
      row.style.animation = 'none';
      const r = row.getBoundingClientRect(), s = stage.getBoundingClientRect();
      row.style.animation = was;
      if (r.height) stage.style.setProperty('--op-y', (r.top - s.top + r.height / 2) + 'px');
    }
    placeOnAmpRow();
    window.addEventListener('resize', () => { if (!opened) placeOnAmpRow(); });

    function open() {
      if (opened) return;
      opened = true;

      // Ради этого касания экран и существует: настоящий клик — та самая
      // активация, после которой браузер наконец пускает звук.
      startMusic().catch(() => {});

      stage.classList.add('opening');
      stage.classList.remove('sealed');   // вступление шапки стартует сейчас

      // Убираем совсем, когда полоса уже передала эстафету линиям у «и».
      setTimeout(() => { box.hidden = true; }, 2800);
    }

    btn.addEventListener('click', open);
  })();

})();
