(() => {
  // ============================================================
  // 0. MENÚ HAMBURGUESA MÓVIL
  // ============================================================
  const navToggle = document.getElementById("nav-toggle");
  const siteNav = document.getElementById("site-nav");

  if (navToggle && siteNav) {
    function setNavOpen(open) {
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Cerrar menú de navegación" : "Abrir menú de navegación");
      siteNav.classList.toggle("is-open", open);
    }

    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      setNavOpen(!isOpen);
    });

    siteNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setNavOpen(false));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
        setNavOpen(false);
        navToggle.focus();
      }
    });
  }

  const CATS = {
    mikan: {
      name: "Mikan",
      meta: "Macho atigrado crema y naranja, 1 año y 4 meses",
      status: "Disponible para adopción",
      img: "assets/mikan-retrato.png",
      alt: "Retrato ilustrado de Mikan bajo la farola nocturna",
      story:
        "Rescatado en febrero en la calle Tres Cruces. Al principio solo observaba desde la barda, pero en pocos días descubrió que el ruido de las tazas anuncia compañía tranquila. En las noches despejadas se sienta en la piedra grande del patio a seguir luciérnagas y jugar con su ovillo morado.",
      ritual: "Cuando encendemos la farola a las 18:30, corre a saludar cerca de su plato azul.",
      home: "Departamento o casa con mallas en ventanas. Convive muy bien con otro gato sereno.",
      health: "Esterilizado, triple felina y rabia al día, desparasitado, FeLV/FIV negativo."
    },
    kuro: {
      name: "Kuro",
      meta: "Macho negro con mechón blanco en el pecho, 3 años",
      status: "Disponible para adopción",
      img: "assets/kuro-retrato.png",
      alt: "Retrato ilustrado de Kuro junto a una taza de té matcha en la ventana",
      story:
        "Kuro vivió dos años con una señora mayor que ya no pudo cuidarlo y su familia nos pidió buscarle una casa con calma. Es el anfitrión más educado del salón: se acuesta junto a los libros abiertos, ronronea bajo y disfruta mirar la lluvia tras el cristal.",
      ritual: "Acompañar en silencio a quienes piden matcha o escriben en libreta cerca de la ventana.",
      home: "Hogar tranquilo de rutinas estables; puede ser gato único o convivir con gatos adultos.",
      health: "Esterilizado, vacunas completas, limpieza dental reciente, FeLV/FIV negativo."
    },
    yuzu: {
      name: "Yuzu",
      meta: "Hembra calicó de pelo semilargo, 2 años",
      status: "Disponible para adopción",
      img: "assets/yuzu-retrato.png",
      alt: "Retrato ilustrado de Yuzu descansando en un cojín índigo junto a una lámpara",
      story:
        "La encontramos refugiada en el patio trasero de una panadería en Coyoacán. Yuzu se toma unos quince minutos para medir a cada persona nueva, pero una vez que confía se acurruca hecha bolita sobre el cojín más cálido y pide cepillado suave.",
      ritual: "Acomodarse junto a la lámpara de mesa mientras el salón huele a dorayaki recién hecho.",
      home: "Casa serena sin ruidos fuertes; disfruta tener un rascador alto junto a una ventana soleada.",
      health: "Esterilizada, esquema de vacunación completo, cepillado semanal, FeLV/FIV negativo."
    },
    bochi: {
      name: "Bochi",
      meta: "Macho atigrado gris con guantes blancos, 7 meses",
      status: "Disponible para adopción",
      img: "assets/bochi-retrato.png",
      alt: "Retrato ilustrado de Bochi asomándose desde una canasta de mimbre",
      story:
        "El más joven de la casa. Llegó siendo un cachorro flaco y algo asustadizo; hoy todavía comienza la tarde asomando solo las orejas desde su canasta de mimbre, hasta que la curiosidad le gana y sale a perseguir hojas secas y cintas de algodón.",
      ritual: "Saltar suavemente detrás de cualquier sombra en movimiento cuando cae la noche.",
      home: "Familia paciente con tiempo de juego diario; idealmente acompañado de otro gato juguetón.",
      health: "Esterilizado, vacunas completas de cachorro, desparasitado, FeLV/FIV negativo."
    }
  };

  // ============================================================
  // 1. FILTRO DE LA CARTA NOCTURNA
  // ============================================================
  const filterBtns = document.querySelectorAll(".filter-btn");
  const menuGroups = document.querySelectorAll(".menu-group");

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.filter;
      filterBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", String(active));
      });
      menuGroups.forEach((group) => {
        group.hidden = target !== "all" && group.dataset.group !== target;
      });
    });
  });

  // ============================================================
  // 2. DIALOG / FICHA DE RESIDENTES Y SOLICITUD DE ADOPCIÓN
  // ============================================================
  const dialog = document.getElementById("cat-dialog");
  const dialogClose = document.getElementById("dialog-close");
  const dialogImg = document.getElementById("dialog-img");
  const dialogName = document.getElementById("dialog-cat-name");
  const dialogMeta = document.getElementById("dialog-meta");
  const dialogStatus = document.getElementById("dialog-status");
  const dialogStory = document.getElementById("dialog-story");
  const dialogRitual = document.getElementById("dialog-ritual");
  const dialogHome = document.getElementById("dialog-home");
  const dialogHealth = document.getElementById("dialog-health");
  const adoptHeading = document.getElementById("adopt-heading");
  const adoptForm = document.getElementById("adopt-form");
  const adoptError = document.getElementById("adopt-error");
  const adoptSent = document.getElementById("adopt-sent");
  const adoptSentMsg = document.getElementById("adopt-sent-msg");
  const adoptDone = document.getElementById("adopt-done");
  const dialogBookVisit = document.getElementById("dialog-book-visit");
  const catInterestSelect = document.getElementById("cat-interest");

  let activeCatKey = "mikan";

  function openCatDialog(key) {
    const cat = CATS[key];
    if (!cat || !dialog) return;
    activeCatKey = key;
    dialogImg.src = cat.img;
    dialogImg.alt = cat.alt;
    dialogName.textContent = cat.name;
    dialogMeta.textContent = cat.meta;
    dialogStatus.textContent = cat.status;
    dialogStory.textContent = cat.story;
    dialogRitual.textContent = cat.ritual;
    dialogHome.textContent = cat.home;
    dialogHealth.textContent = cat.health;
    adoptHeading.textContent = `Pedir charla para conocer a ${cat.name}`;
    adoptForm.reset();
    adoptForm.hidden = false;
    adoptSent.hidden = true;
    adoptError.hidden = true;
    dialog.showModal();
  }

  document.querySelectorAll("[data-open-cat]").forEach((el) => {
    el.addEventListener("click", () => openCatDialog(el.dataset.openCat));
  });

  document.querySelectorAll("[data-pick-cat]").forEach((el) => {
    el.addEventListener("click", () => {
      if (catInterestSelect) catInterestSelect.value = el.dataset.pickCat;
    });
  });

  dialogClose.addEventListener("click", () => dialog.close());
  adoptDone.addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  dialogBookVisit.addEventListener("click", () => {
    const cat = CATS[activeCatKey];
    if (cat && catInterestSelect) catInterestSelect.value = cat.name;
    dialog.close();
    document.getElementById("reservar").scrollIntoView({ behavior: "smooth" });
  });

  adoptForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("adopt-name").value.trim();
    const contact = document.getElementById("adopt-contact").value.trim();
    if (!name || !contact) {
      adoptError.textContent = "Escribe tu nombre y un medio de contacto para poder responderte.";
      adoptError.hidden = false;
      return;
    }
    adoptError.hidden = true;
    adoptForm.hidden = true;
    const cat = CATS[activeCatKey];
    adoptSentMsg.textContent = `Recibimos tu interés por ${cat.name}, ${name}. Te escribiremos a ${contact} en menos de 24 horas para acordar la charla en el salón.`;
    adoptSent.hidden = false;
  });

  // ============================================================
  // 3. RESERVA DE MESA INTERACTIVA (Fechas reales de apertura Mié–Dom)
  // ============================================================
  const dateContainer = document.getElementById("date-choices");
  const slotContainer = document.getElementById("slot-choices");
  const dateHidden = document.getElementById("booking-date");
  const slotHidden = document.getElementById("booking-slot");
  const guestOutput = document.getElementById("guest-count");
  const guestMinus = document.getElementById("guest-minus");
  const guestPlus = document.getElementById("guest-plus");
  const totalEl = document.getElementById("booking-total");
  const bookingForm = document.getElementById("booking-form");
  const bookingError = document.getElementById("booking-error");
  const bookingConfirmed = document.getElementById("booking-confirmed");
  const bookingReset = document.getElementById("booking-reset");

  const ENTRY_FEE = 140;
  let guestCount = 2;

  // Próximos 5 días abiertos (miércoles=3 a domingo=0)
  const openDays = [];
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const cursor = new Date();
  while (openDays.length < 5) {
    const dow = cursor.getDay();
    if (dow === 0 || dow >= 3) {
      const label = openDays.length === 0 && cursor.toDateString() === new Date().toDateString()
        ? `Hoy, ${cursor.getDate()} ${monthNames[cursor.getMonth()]}`
        : `${dayNames[dow]} ${cursor.getDate()} ${monthNames[cursor.getMonth()]}`;
      openDays.push({
        iso: cursor.toISOString().slice(0, 10),
        label,
        slots: [
          { time: "17:00", seats: dow === 6 ? 3 : 6 },
          { time: "19:00", seats: dow === 5 || dow === 6 ? 4 : 5 },
          { time: "21:00", seats: 7 }
        ]
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  let selectedDayIdx = 0;
  let selectedSlotTime = openDays[0].slots[1].time;

  function renderDates() {
    dateContainer.innerHTML = "";
    openDays.forEach((d, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "choice-pill";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(idx === selectedDayIdx));
      b.textContent = d.label;
      b.addEventListener("click", () => {
        selectedDayIdx = idx;
        renderDates();
        renderSlots();
      });
      dateContainer.appendChild(b);
    });
    dateHidden.value = openDays[selectedDayIdx].label;
  }

  function renderSlots() {
    slotContainer.innerHTML = "";
    const slots = openDays[selectedDayIdx].slots;
    if (!slots.some((s) => s.time === selectedSlotTime && s.seats >= guestCount)) {
      const firstValid = slots.find((s) => s.seats >= guestCount) || slots[0];
      selectedSlotTime = firstValid.time;
    }
    slots.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "choice-pill";
      b.setAttribute("role", "radio");
      const enough = s.seats >= guestCount;
      b.disabled = !enough;
      b.setAttribute("aria-checked", String(s.time === selectedSlotTime));
      b.innerHTML = `${s.time} h<small>${enough ? `${s.seats} lugares libres` : "Sin cupo suficiente"}</small>`;
      b.addEventListener("click", () => {
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

  guestMinus.addEventListener("click", () => {
    if (guestCount > 1) {
      guestCount -= 1;
      updateGuestUI();
    }
  });

  guestPlus.addEventListener("click", () => {
    if (guestCount < 4) {
      guestCount += 1;
      updateGuestUI();
    }
  });

  bookingForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("guest-name").value.trim();
    const email = document.getElementById("guest-email").value.trim();
    const cat = catInterestSelect.value;

    if (!name) {
      bookingError.textContent = "Escribe tu nombre para registrar la mesa.";
      bookingError.hidden = false;
      document.getElementById("guest-name").focus();
      return;
    }
    if (!email || !email.includes("@")) {
      bookingError.textContent = "Necesitamos un correo válido para enviarte la confirmación.";
      bookingError.hidden = false;
      document.getElementById("guest-email").focus();
      return;
    }

    bookingError.hidden = true;
    const code = `CL-${openDays[selectedDayIdx].iso.slice(5).replace("-", "")}-${Math.floor(200 + Math.random() * 700)}`;
    const personWord = guestCount === 1 ? "1 persona" : `${guestCount} personas`;
    const catNote = cat ? ` Dejamos nota para presentarte a ${cat} con calma.` : "";

    document.getElementById("confirmed-code").textContent = `Reserva ${code}`;
    document.getElementById("confirmed-details").textContent =
      `Te esperamos ${openDays[selectedDayIdx].label.toLowerCase()} a las ${selectedSlotTime} h para ${personWord} (${name}).${catNote}`;
    document.getElementById("confirmed-email").textContent = email;

    bookingForm.hidden = true;
    bookingConfirmed.hidden = false;
    bookingConfirmed.focus();
  });

  bookingReset.addEventListener("click", () => {
    bookingConfirmed.hidden = true;
    bookingForm.hidden = false;
  });

  renderDates();
  updateGuestUI();
})();
