import { FluidSpring, VelocityTracker, createSpringRunner, projectVelocity, rubberband } from './springs.js';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================================================
// DATA: CASA LUCERNA RESIDENTS
// ============================================================================
const CATS = {
  mikan: {
    name: 'Mikan',
    meta: 'Macho atigrado crema y naranja · 1 año y 4 meses',
    status: 'Disponible para adopción',
    img: 'assets/mikan-retrato.png',
    alt: 'Retrato ilustrado de Mikan mirando una luciérnaga bajo la farola',
    story:
      'Rescatado en febrero en la calle Tres Cruces. Al principio solo observaba desde la barda, pero en pocos días descubrió que el sonido de las tazas anuncia compañía serena. Cuando encendemos la farola se sienta en la piedra grande del jardín a seguir luciérnagas y mover su ovillo morado.',
    ritual: 'Al caer las 18:30 corre a saludar cerca de su plato azul de cerámica.',
    home: 'Departamento o casa con mallas en ventanas. Convive muy bien con otro gato tranquilo.',
    health: 'Esterilizado, triple felina y rabia al día, desparasitado, FeLV/FIV negativo.'
  },
  kuro: {
    name: 'Kuro',
    meta: 'Macho negro con mechón blanco · 3 años',
    status: 'Disponible para adopción',
    img: 'assets/kuro-retrato.png',
    alt: 'Retrato ilustrado de Kuro junto a una taza de té matcha en la ventana',
    story:
      'Kuro vivió dos años con una señora mayor que ya no pudo cuidarlo y su familia nos pidió encontrarle un hogar con calma. Es el anfitrión más educado del salón: se acuesta junto a los libros abiertos, ronronea hondo y disfruta mirar la lluvia tras el cristal.',
    ritual: 'Acompañar en silencio a quienes piden matcha o escriben en libreta cerca de la ventana.',
    home: 'Hogar sereno de rutinas estables; puede ser gato único o convivir con gatos adultos.',
    health: 'Esterilizado, vacunas completas, limpieza dental reciente, FeLV/FIV negativo.'
  },
  yuzu: {
    name: 'Yuzu',
    meta: 'Hembra calicó de pelo semilargo · 2 años',
    status: 'Disponible para adopción',
    img: 'assets/yuzu-retrato.png',
    alt: 'Retrato ilustrado de Yuzu descansando en un cojín índigo junto a una lámpara',
    story:
      'La encontramos refugiada en el patio trasero de una panadería en Coyoacán. Yuzu se toma unos quince minutos para observar a cada persona nueva, pero una vez que confía se acurruca hecha bolita sobre el cojín más cálido y pide cepillado suave.',
    ritual: 'Acomodarse junto a la lámpara de mesa mientras el salón huele a dorayaki recién hecho.',
    home: 'Casa tranquila sin ruidos fuertes; disfruta un rascador alto junto a una ventana soleada.',
    health: 'Esterilizada, esquema de vacunación completo, cepillado semanal, FeLV/FIV negativo.'
  },
  bochi: {
    name: 'Bochi',
    meta: 'Macho atigrado gris de guantes blancos · 7 meses',
    status: 'Disponible para adopción',
    img: 'assets/bochi-retrato.png',
    alt: 'Retrato ilustrado de Bochi asomándose desde una canasta de mimbre',
    story:
      'El más joven de la casa. Llegó siendo un cachorro flaco y algo cauteloso; hoy todavía comienza la tarde asomando solo las orejas desde su canasta de mimbre, hasta que la curiosidad le gana y sale a perseguir hojas secas y cintas de algodón.',
    ritual: 'Saltar suavemente detrás de cualquier sombra en movimiento cuando cae la noche.',
    home: 'Familia paciente con tiempo de juego diario; idealmente acompañado de otro gato juguetón.',
    health: 'Esterilizado, vacunas completas de cachorro, desparasitado, FeLV/FIV negativo.'
  }
};

// ============================================================================
// 1. ADAPTIVE TRANSLUCENT NAV ISLAND + SPRING ACTIVE INDICATOR
// ============================================================================
const navIsland = document.getElementById('nav-island');
const navLinksWrap = document.getElementById('nav-links');
const navIndicator = document.getElementById('nav-pill-indicator');
const navMenuBtn = document.getElementById('nav-menu-btn');
const navLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
const lightSections = Array.from(document.querySelectorAll('.surface-shoji'));
const trackedSections = navLinks
  .map((a) => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

if (navMenuBtn && navLinksWrap) {
  const toggleMobileMenu = (open) => {
    navMenuBtn.setAttribute('aria-expanded', String(open));
    navLinksWrap.classList.toggle('is-open', open);
  };
  navMenuBtn.addEventListener('click', () => {
    toggleMobileMenu(navMenuBtn.getAttribute('aria-expanded') !== 'true');
  });
  navLinks.forEach((a) => a.addEventListener('click', () => toggleMobileMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navLinksWrap.classList.contains('is-open')) {
      toggleMobileMenu(false);
      navMenuBtn.focus();
    }
  });
}

// Critically damped springs for floating nav pill position & width
const navXSpring = new FluidSpring(0, { response: 0.34, dampingRatio: 1.0, precision: 0.1 });
const navWSpring = new FluidSpring(0, { response: 0.34, dampingRatio: 1.0, precision: 0.1 });
let navHasInit = false;

const navRunner = createSpringRunner((dt) => {
  const mx = navXSpring.step(dt);
  const mw = navWSpring.step(dt);
  if (navIndicator) {
    navIndicator.style.transform = `translate3d(${navXSpring.value}px, 0, 0)`;
    navIndicator.style.width = `${navWSpring.value}px`;
  }
  return mx || mw;
});

function moveNavIndicatorTo(linkEl) {
  if (!navIndicator || !navLinksWrap || !linkEl) {
    if (navIndicator) navIndicator.style.opacity = '0';
    return;
  }
  const wrapRect = navLinksWrap.getBoundingClientRect();
  const linkRect = linkEl.getBoundingClientRect();
  if (linkRect.width === 0) return;
  const x = linkRect.left - wrapRect.left;
  const w = linkRect.width;

  navIndicator.style.opacity = '1';
  if (!navHasInit || prefersReducedMotion()) {
    navXSpring.snap(x);
    navWSpring.snap(w);
    navIndicator.style.transform = `translate3d(${x}px, 0, 0)`;
    navIndicator.style.width = `${w}px`;
    navHasInit = true;
  } else {
    navXSpring.setTarget(x);
    navWSpring.setTarget(w);
    navRunner.start();
  }
}

function syncHeaderMaterialAndSection() {
  const probeY = 56;
  const overLight = lightSections.some((sec) => {
    const r = sec.getBoundingClientRect();
    return r.top <= probeY && r.bottom >= probeY;
  });
  if (navIsland) navIsland.classList.toggle('is-light', overLight);

  let currentLink = null;
  const viewProbe = window.innerHeight * 0.35;
  for (let i = 0; i < trackedSections.length; i++) {
    const r = trackedSections[i].getBoundingClientRect();
    if (r.top <= viewProbe && r.bottom > 100) {
      currentLink = navLinks[i];
    }
  }
  navLinks.forEach((a) => a.classList.toggle('is-current', a === currentLink));
  moveNavIndicatorTo(currentLink);
}

window.addEventListener('scroll', syncHeaderMaterialAndSection, { passive: true });
window.addEventListener('resize', () => {
  navHasInit = false;
  syncHeaderMaterialAndSection();
});
syncHeaderMaterialAndSection();

// ============================================================================
// 2. SPRING-PHYSICS SEGMENTED CONTROL FOR NOCTURNAL TEA MENU
// ============================================================================
const segControl = document.getElementById('menu-segmented');
const segThumb = document.getElementById('segmented-thumb');
const segButtons = Array.from(document.querySelectorAll('.seg-btn'));
const menuGroups = Array.from(document.querySelectorAll('.menu-group'));

const segX = new FluidSpring(0, { response: 0.32, dampingRatio: 1.0, precision: 0.1 });
const segW = new FluidSpring(0, { response: 0.32, dampingRatio: 1.0, precision: 0.1 });
let segInit = false;

const segRunner = createSpringRunner((dt) => {
  const m1 = segX.step(dt);
  const m2 = segW.step(dt);
  if (segThumb) {
    segThumb.style.transform = `translate3d(${segX.value}px, 0, 0)`;
    segThumb.style.width = `${segW.value}px`;
  }
  return m1 || m2;
});

function positionSegThumb(btn, immediate = false) {
  if (!segControl || !segThumb || !btn) return;
  const cRect = segControl.getBoundingClientRect();
  const bRect = btn.getBoundingClientRect();
  const x = bRect.left - cRect.left;
  const w = bRect.width;

  if (immediate || !segInit || prefersReducedMotion()) {
    segX.snap(x);
    segW.snap(w);
    segThumb.style.transform = `translate3d(${x}px, 0, 0)`;
    segThumb.style.width = `${w}px`;
    segInit = true;
  } else {
    segX.setTarget(x);
    segW.setTarget(w);
    segRunner.start();
  }
}

segButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const filter = btn.dataset.filter;
    segButtons.forEach((b) => {
      const active = b === btn;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', String(active));
    });
    positionSegThumb(btn);
    menuGroups.forEach((g) => {
      g.hidden = filter !== 'all' && g.dataset.group !== filter;
    });
  });
});

window.addEventListener('resize', () => {
  const active = segButtons.find((b) => b.classList.contains('is-active'));
  if (active) positionSegThumb(active, true);
});
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    const active = segButtons.find((b) => b.classList.contains('is-active'));
    if (active) positionSegThumb(active, true);
  });
} else {
  const active = segButtons.find((b) => b.classList.contains('is-active'));
  if (active) positionSegThumb(active, true);
}

// ============================================================================
// 3. APPLE-STYLE GESTURE-DRAGGABLE RESIDENT SHEET
//    - 1:1 Pointer Capture Drag with Rubber-Banding Upward
//    - Exponential Momentum Projection & Velocity Handoff
//    - Fully Interruptible Mid-Flight (catch it while closing!)
//    - Scales & pushes back the background page shell smoothly
// ============================================================================
const pageShell = document.getElementById('page-shell');
const sheetBackdrop = document.getElementById('resident-sheet-backdrop');
const sheetEl = document.getElementById('resident-sheet');
const sheetGrabBar = document.getElementById('sheet-grab-bar');
const sheetCloseBtn = document.getElementById('sheet-close-btn');
const sheetImg = document.getElementById('sheet-img');
const sheetName = document.getElementById('sheet-cat-name');
const sheetMeta = document.getElementById('sheet-cat-meta');
const sheetStatus = document.getElementById('sheet-cat-status');
const sheetStory = document.getElementById('sheet-cat-story');
const sheetRitual = document.getElementById('sheet-cat-ritual');
const sheetHome = document.getElementById('sheet-cat-home');
const sheetHealth = document.getElementById('sheet-cat-health');
const adoptHeading = document.getElementById('adopt-heading');
const adoptForm = document.getElementById('adopt-form');
const adoptError = document.getElementById('adopt-error');
const adoptSent = document.getElementById('adopt-sent');
const adoptSentMsg = document.getElementById('adopt-sent-msg');
const adoptDone = document.getElementById('adopt-done');
const sheetBookBtn = document.getElementById('sheet-book-visit');
const catInterestSelect = document.getElementById('cat-interest');

let activeCatKey = 'mikan';
let sheetOpen = false;
let sheetDragging = false;
let dragStartY = 0;
let sheetStartOffset = 0;
let closedOffsetY = window.innerHeight;
let lastTriggerEl = null;

const tracker = new VelocityTracker(90);
const sheetY = new FluidSpring(window.innerHeight, { response: 0.36, dampingRatio: 1.0, precision: 0.35 });

function renderSheetVisuals(y) {
  if (!sheetEl || !sheetBackdrop) return;
  const maxY = Math.max(closedOffsetY, 320);
  const progress = Math.max(0, Math.min(1, 1 - y / maxY));

  sheetEl.style.transform = `translate3d(0, ${y}px, 0)`;
  sheetBackdrop.style.opacity = String(progress);

  if (pageShell && !prefersReducedMotion()) {
    const scale = 1 - progress * 0.026;
    const radius = progress * 20;
    pageShell.style.transform = progress > 0.002 ? `scale(${scale.toFixed(4)})` : '';
    pageShell.style.borderRadius = progress > 0.002 ? `${radius.toFixed(1)}px` : '';
  }
}

const sheetRunner = createSpringRunner((dt) => {
  const moving = sheetY.step(dt);
  renderSheetVisuals(sheetY.value);
  if (!moving && !sheetOpen) {
    sheetBackdrop.hidden = true;
    sheetBackdrop.classList.remove('is-open');
    document.body.style.overflow = '';
    if (pageShell) {
      pageShell.style.transform = '';
      pageShell.style.borderRadius = '';
    }
    if (lastTriggerEl && typeof lastTriggerEl.focus === 'function') {
      lastTriggerEl.focus();
    }
  }
  return moving;
});

function openResidentSheet(key, triggerEl) {
  const cat = CATS[key];
  if (!cat || !sheetBackdrop || !sheetEl) return;

  activeCatKey = key;
  lastTriggerEl = triggerEl || document.activeElement;

  sheetImg.src = cat.img;
  sheetImg.alt = cat.alt;
  sheetName.textContent = cat.name;
  sheetMeta.textContent = cat.meta;
  sheetStatus.textContent = cat.status;
  sheetStory.textContent = cat.story;
  sheetRitual.textContent = cat.ritual;
  sheetHome.textContent = cat.home;
  sheetHealth.textContent = cat.health;
  adoptHeading.textContent = `Pedir charla para conocer a ${cat.name}`;
  adoptForm.reset();
  adoptForm.hidden = false;
  adoptSent.hidden = true;
  adoptError.hidden = true;

  sheetBackdrop.hidden = false;
  sheetBackdrop.classList.add('is-open');
  document.body.style.overflow = 'hidden';

  closedOffsetY = Math.max(sheetEl.offsetHeight + 48, window.innerHeight * 0.85);
  sheetOpen = true;

  if (prefersReducedMotion()) {
    sheetY.snap(0);
    renderSheetVisuals(0);
  } else {
    if (sheetY.value >= closedOffsetY * 0.9) {
      sheetY.snap(closedOffsetY);
    }
    sheetY.setConfig({ response: 0.36, dampingRatio: 1.0 });
    sheetY.setTarget(0);
    sheetRunner.start();
  }

  sheetCloseBtn.focus();
}

function closeResidentSheet(releaseVelocity = 0) {
  if (!sheetBackdrop) return;
  sheetOpen = false;
  closedOffsetY = Math.max(sheetEl.offsetHeight + 48, window.innerHeight * 0.85);

  if (prefersReducedMotion()) {
    sheetY.snap(closedOffsetY);
    renderSheetVisuals(closedOffsetY);
    sheetBackdrop.hidden = true;
    sheetBackdrop.classList.remove('is-open');
    document.body.style.overflow = '';
    return;
  }

  sheetY.setConfig({ response: 0.32, dampingRatio: 1.0 });
  sheetY.setTarget(closedOffsetY, releaseVelocity > 0 ? releaseVelocity : null);
  sheetRunner.start();
}

// 1:1 Direct Manipulation Drag on Sheet Grab Bar (interruptible mid-animation!)
if (sheetGrabBar) {
  sheetGrabBar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    sheetDragging = true;
    sheetRunner.stop(); // Interrupt live spring from current visual position!
    dragStartY = e.clientY;
    sheetStartOffset = sheetY.value;
    tracker.reset();
    tracker.add(sheetY.value);
    sheetGrabBar.setPointerCapture(e.pointerId);
  });

  sheetGrabBar.addEventListener('pointermove', (e) => {
    if (!sheetDragging) return;
    const rawY = sheetStartOffset + (e.clientY - dragStartY);
    // Progressive rubber-banding when pulling upward past y = 0
    const nextY = rawY < 0 ? rubberband(rawY, 180, 0.38) : rawY;
    sheetY.snap(nextY);
    tracker.add(nextY);
    renderSheetVisuals(nextY);
  });

  const endSheetDrag = () => {
    if (!sheetDragging) return;
    sheetDragging = false;
    const velocity = tracker.getVelocity();
    const projectedY = sheetY.value + projectVelocity(velocity, 0.996);
    const dismissThreshold = Math.min(260, (sheetEl.offsetHeight || 500) * 0.34);

    if (projectedY > dismissThreshold) {
      closeResidentSheet(Math.max(velocity, 220));
    } else {
      sheetOpen = true;
      // Add subtle bounce ONLY because a physical drag/flick preceded it
      sheetY.setConfig({ response: 0.34, dampingRatio: 0.84 });
      sheetY.setTarget(0, velocity);
      sheetRunner.start();
    }
  };

  sheetGrabBar.addEventListener('pointerup', endSheetDrag);
  sheetGrabBar.addEventListener('pointercancel', endSheetDrag);
}

document.querySelectorAll('[data-open-cat]').forEach((el) => {
  el.addEventListener('click', () => openResidentSheet(el.dataset.openCat, el));
});

document.querySelectorAll('[data-pick-cat]').forEach((el) => {
  el.addEventListener('click', () => {
    if (catInterestSelect) catInterestSelect.value = el.dataset.pickCat;
  });
});

sheetCloseBtn?.addEventListener('click', () => closeResidentSheet());
adoptDone?.addEventListener('click', () => closeResidentSheet());
sheetBackdrop?.addEventListener('click', (e) => {
  if (e.target === sheetBackdrop) closeResidentSheet();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheetOpen) {
    closeResidentSheet();
  }
});

sheetBookBtn?.addEventListener('click', () => {
  const cat = CATS[activeCatKey];
  if (cat && catInterestSelect) catInterestSelect.value = cat.name;
  closeResidentSheet();
  document.getElementById('reservar')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
});

adoptForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('adopt-name').value.trim();
  const contact = document.getElementById('adopt-contact').value.trim();
  if (!name || !contact) {
    adoptError.textContent = 'Escribe tu nombre y un medio de contacto para poder responderte.';
    adoptError.hidden = false;
    return;
  }
  adoptError.hidden = true;
  adoptForm.hidden = true;
  const cat = CATS[activeCatKey];
  adoptSentMsg.textContent = `Recibimos tu interés por ${cat.name}, ${name}. Te escribiremos a ${contact} en menos de 24 horas para acordar una charla tranquila en el salón.`;
  adoptSent.hidden = false;
});

// ============================================================================
// 4. INTERACTIVE NOCTURNAL TABLE RESERVATION DESK (Wed–Sun real dates)
// ============================================================================
const dateContainer = document.getElementById('date-choices');
const slotContainer = document.getElementById('slot-choices');
const dateHidden = document.getElementById('booking-date');
const slotHidden = document.getElementById('booking-slot');
const guestOutput = document.getElementById('guest-count');
const guestMinus = document.getElementById('guest-minus');
const guestPlus = document.getElementById('guest-plus');
const totalEl = document.getElementById('booking-total');
const bookingForm = document.getElementById('booking-form');
const bookingError = document.getElementById('booking-error');
const bookingConfirmed = document.getElementById('booking-confirmed');
const bookingReset = document.getElementById('booking-reset');

const ENTRY_FEE = 140;
let guestCount = 2;

const openDays = [];
const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const cursor = new Date();
const todayStr = new Date().toDateString();

while (openDays.length < 5) {
  const dow = cursor.getDay();
  if (dow === 0 || dow >= 3) {
    const label =
      openDays.length === 0 && cursor.toDateString() === todayStr
        ? `Hoy, ${cursor.getDate()} ${monthNames[cursor.getMonth()]}`
        : `${dayNames[dow]} ${cursor.getDate()} ${monthNames[cursor.getMonth()]}`;
    openDays.push({
      iso: cursor.toISOString().slice(0, 10),
      label,
      slots: [
        { time: '17:00', seats: dow === 6 ? 3 : 6 },
        { time: '19:00', seats: dow === 5 || dow === 6 ? 4 : 5 },
        { time: '21:00', seats: 7 }
      ]
    });
  }
  cursor.setDate(cursor.getDate() + 1);
}

let selectedDayIdx = 0;
let selectedSlotTime = openDays[0].slots[1].time;

function renderDates() {
  if (!dateContainer) return;
  dateContainer.innerHTML = '';
  openDays.forEach((d, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice-chip';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(idx === selectedDayIdx));
    b.textContent = d.label;
    b.addEventListener('click', () => {
      selectedDayIdx = idx;
      renderDates();
      renderSlots();
    });
    dateContainer.appendChild(b);
  });
  dateHidden.value = openDays[selectedDayIdx].label;
}

function renderSlots() {
  if (!slotContainer) return;
  slotContainer.innerHTML = '';
  const slots = openDays[selectedDayIdx].slots;
  if (!slots.some((s) => s.time === selectedSlotTime && s.seats >= guestCount)) {
    const firstValid = slots.find((s) => s.seats >= guestCount) || slots[0];
    selectedSlotTime = firstValid.time;
  }
  slots.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice-chip';
    b.setAttribute('role', 'radio');
    const enough = s.seats >= guestCount;
    b.disabled = !enough;
    b.setAttribute('aria-checked', String(s.time === selectedSlotTime));
    b.innerHTML = `${s.time} h<small>${enough ? `${s.seats} lugares libres` : 'Sin cupo suficiente'}</small>`;
    b.addEventListener('click', () => {
      selectedSlotTime = s.time;
      renderSlots();
    });
    slotContainer.appendChild(b);
  });
  slotHidden.value = selectedSlotTime;
}

function updateGuestUI() {
  guestOutput.textContent = String(guestCount);
  totalEl.textContent = `$${guestCount * ENTRY_FEE} MXN`;
  guestMinus.disabled = guestCount <= 1;
  guestPlus.disabled = guestCount >= 4;
  renderSlots();
}

guestMinus?.addEventListener('click', () => {
  if (guestCount > 1) {
    guestCount -= 1;
    updateGuestUI();
  }
});

guestPlus?.addEventListener('click', () => {
  if (guestCount < 4) {
    guestCount += 1;
    updateGuestUI();
  }
});

bookingForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('guest-name').value.trim();
  const email = document.getElementById('guest-email').value.trim();
  const cat = catInterestSelect.value;

  if (!name) {
    bookingError.textContent = 'Escribe tu nombre para registrar la mesa.';
    bookingError.hidden = false;
    document.getElementById('guest-name').focus();
    return;
  }
  if (!email || !email.includes('@')) {
    bookingError.textContent = 'Necesitamos un correo válido para enviarte la confirmación.';
    bookingError.hidden = false;
    document.getElementById('guest-email').focus();
    return;
  }

  bookingError.hidden = true;
  const code = `CL-${openDays[selectedDayIdx].iso.slice(5).replace('-', '')}-${Math.floor(200 + Math.random() * 700)}`;
  const personWord = guestCount === 1 ? '1 persona' : `${guestCount} personas`;
  const catNote = cat ? ` Dejamos nota para presentarte a ${cat} con calma.` : '';

  document.getElementById('confirmed-code').textContent = `Reserva ${code}`;
  document.getElementById('confirmed-details').textContent =
    `Te esperamos ${openDays[selectedDayIdx].label.toLowerCase()} a las ${selectedSlotTime} h para ${personWord} (${name}).${catNote}`;
  document.getElementById('confirmed-email').textContent = email;

  bookingForm.hidden = true;
  bookingConfirmed.hidden = false;
  bookingConfirmed.focus();
});

bookingReset?.addEventListener('click', () => {
  bookingConfirmed.hidden = true;
  bookingForm.hidden = false;
});

renderDates();
updateGuestUI();
