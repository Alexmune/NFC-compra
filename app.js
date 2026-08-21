import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://gqhprdaattnetouyqpbm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_s1xHQR2SgKq5Y14kU9Rs5A_Jvs0PAph";
const TABLE_NAME = "shopping_list_items";
const QUICK_PICKS_TABLE = "shopping_quick_picks";

// Ahora la lista empieza vacía y se llena desde Supabase
let commonItems = []; 

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const elements = {
  form: document.querySelector("#item-form"),
  input: document.querySelector("#item-input"),
  list: document.querySelector("#shopping-list"),
  quickPicks: document.querySelector("#quick-picks-list"),
  status: document.querySelector("#status"),
  clearButton: document.querySelector("#clear-button"),
  weekLabel: document.querySelector("#week-label"),
};

const nextWeekStart = getNextWeekStart();
elements.weekLabel.textContent = formatWeekLabel(nextWeekStart);

elements.form.addEventListener("submit", handleAddItem);
elements.clearButton.addEventListener("click", handleClearWeek);

// Iniciar la carga de datos
loadQuickPicks();
loadItems();

// --- NUEVAS FUNCIONES PARA FAVORITOS ---

async function loadQuickPicks() {
  const { data, error } = await supabase
    .from(QUICK_PICKS_TABLE)
    .select("*")
    .order("name", { ascending: true });

  if (!error) {
    commonItems = data ?? [];
    renderQuickPicks();
  }
}

async function handleAddQuickPick() {
  const name = prompt("Nombre del nuevo producto favorito:");
  if (!name) return;
  
  let emoji = prompt(`Emoji para ${name} (ej. 🛒, 🍺, 🥦):`, "🛒");
  if (!emoji) emoji = "🛒";
  
  // Generar un color pastel aleatorio para el fondo
  const hue = Math.floor(Math.random() * 360);
  const color = `hsl(${hue}, 70%, 90%)`;
  
  const { error } = await supabase.from(QUICK_PICKS_TABLE).insert({
    name: name.trim(),
    emoji: emoji.trim(),
    color: color
  });
  
  if (!error) await loadQuickPicks();
}

async function deleteQuickPick(id) {
   const { error } = await supabase.from(QUICK_PICKS_TABLE).delete().eq("id", id);
   if (!error) await loadQuickPicks();
}

// --- FUNCIONES ORIGINALES MODIFICADAS ---

async function loadItems() {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("id, name")
    .eq("week_start", nextWeekStart)
    .order("created_at", { ascending: true });

  if (error) {
    renderError(error);
    return;
  }

  renderList(data ?? []);
  setStatus("");
  elements.input.focus();
}

async function handleAddItem(event) {
  event.preventDefault();
  await addItem(elements.input.value.trim());
  elements.input.value = "";
}

async function addItem(name) {
  if (!name) return;
  setControlsDisabled(true);

  const { error } = await supabase.from(TABLE_NAME).insert({
    name,
    week_start: nextWeekStart,
  });

  if (error) renderError(error);
  setControlsDisabled(false);
  await loadItems();
}

async function handleDeleteItem(id) {
  const ids = Array.isArray(id) ? id : [id];
  const { error } = await supabase.from(TABLE_NAME).delete().in("id", ids);
  if (error) renderError(error);
  await loadItems();
}

async function handleDecreaseItem(id) {
  const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);
  if (error) renderError(error);
  await loadItems();
}

async function handleClearWeek() {
  const confirmed = window.confirm("Esto vaciará toda la lista de la compra de la semana que viene.");
  if (!confirmed) return;

  elements.clearButton.disabled = true;
  const { error } = await supabase.from(TABLE_NAME).delete().eq("week_start", nextWeekStart);
  elements.clearButton.disabled = false;

  if (error) renderError(error);
  await loadItems();
}

function renderList(items) {
  elements.list.innerHTML = "";

  if (items.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.className = "empty-state";
    emptyState.textContent = "La lista está vacía. Añade lo primero nada más entrar.";
    elements.list.append(emptyState);
    return;
  }

  const groupedItems = groupItems(items);

  for (const item of groupedItems) {
    const listItem = document.createElement("li");
    listItem.className = "shopping-item";

    const label = document.createElement("div");
    label.className = "shopping-item-label";
    label.textContent = `${getItemEmoji(item.name)} ${item.name}`;

    const actions = document.createElement("div");
    actions.className = "shopping-item-actions";

    const decreaseButton = document.createElement("button");
    decreaseButton.className = "item-stepper";
    decreaseButton.type = "button";
    decreaseButton.textContent = "−";
    decreaseButton.addEventListener("click", () => handleDecreaseItem(item.ids[item.ids.length - 1]));

    const increaseButton = document.createElement("button");
    increaseButton.className = "item-stepper item-stepper-add";
    increaseButton.type = "button";
    increaseButton.textContent = "+";
    increaseButton.addEventListener("click", () => addItem(item.name));

    const quantityBadge = document.createElement("span");
    quantityBadge.className = "item-quantity";
    quantityBadge.textContent = item.quantity;

    actions.append(decreaseButton, quantityBadge, increaseButton);

    const deleteButton = document.createElement("button");
    deleteButton.className = "item-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Eliminar";
    deleteButton.addEventListener("click", () => handleDeleteItem(item.ids));

    actions.append(deleteButton);
    listItem.append(label, actions);
    elements.list.append(listItem);
  }
}

function renderQuickPicks() {
  elements.quickPicks.innerHTML = "";
  
  // Pequeño texto de ayuda visual
  if(!document.getElementById('quick-picks-help')) {
    const helpText = document.createElement("p");
    helpText.id = "quick-picks-help";
    helpText.style.fontSize = "0.75rem";
    helpText.style.color = "#666";
    helpText.style.margin = "0 0 10px 0";
    helpText.textContent = "💡 Mantén pulsado un favorito para borrarlo.";
    elements.quickPicks.parentNode.insertBefore(helpText, elements.quickPicks);
  }

  for (const item of commonItems) {
    const button = document.createElement("button");
    button.className = "quick-pick";
    button.type = "button";

    const image = document.createElement("img");
    image.className = "quick-pick-image";
    image.src = createItemImage(item);
    image.alt = item.name;

    const name = document.createElement("span");
    name.className = "quick-pick-name";
    name.textContent = item.name;

    const addBadge = document.createElement("span");
    addBadge.className = "quick-pick-add";
    addBadge.textContent = "+";

    button.append(image, name, addBadge);
    
    // Al hacer clic normal, añade a la compra
    button.addEventListener("click", () => addItem(item.name));
    
    // Al mantener pulsado (contextmenu), borra el favorito
    button.addEventListener("contextmenu", async (e) => {
      e.preventDefault();
      if(confirm(`¿Quieres borrar "${item.name}" de tus favoritos rápidos?`)) {
         await deleteQuickPick(item.id);
      }
    });
    
    elements.quickPicks.append(button);
  }
  
  // Crear el botón extra para añadir nuevos favoritos
  const addNewBtn = document.createElement("button");
  addNewBtn.className = "quick-pick";
  addNewBtn.style.border = "2px dashed #ccc";
  addNewBtn.style.background = "transparent";
  
  const plusIcon = document.createElement("span");
  plusIcon.textContent = "➕";
  plusIcon.style.fontSize = "24px";
  plusIcon.style.marginBottom = "5px";
  
  const newText = document.createElement("span");
  newText.className = "quick-pick-name";
  newText.textContent = "Nuevo";
  
  addNewBtn.append(plusIcon, newText);
  addNewBtn.addEventListener("click", handleAddQuickPick);
  
  elements.quickPicks.append(addNewBtn);
}

function setControlsDisabled(disabled) {
  elements.input.disabled = disabled;
  elements.form.querySelector("button").disabled = disabled;
  for (const button of elements.quickPicks.querySelectorAll("button")) {
    button.disabled = disabled;
  }
}

function setStatus(message) {
  elements.status.textContent = message;
}

function renderError(error) {
  console.error(error);
  setStatus("No se pudo conectar con Supabase. Revisa la tabla y las políticas del proyecto.");
}

function getNextWeekStart() {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? 1 : 8 - day;

  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + mondayOffset);
  nextMonday.setHours(0, 0, 0, 0);

  const year = nextMonday.getFullYear();
  const month = String(nextMonday.getMonth() + 1).padStart(2, "0");
  const date = String(nextMonday.getDate()).padStart(2, "0");

  return `${year}-${month}-${date}`;
}

function formatWeekLabel(weekStart) {
  const [year, month, day] = weekStart.split("-").map(Number);
  const start = new Date(year, month - 1, day, 12);
  const end = new Date(year, month - 1, day + 6, 12);

  const formatter = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
  });

  return `Semana del ${formatter.format(start)} al ${formatter.format(end)}`;
}

function createItemImage(item) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="24" fill="${item.color}" />
      <text x="48" y="58" text-anchor="middle" font-size="40">${item.emoji}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function groupItems(items) {
  const grouped = new Map();

  for (const item of items) {
    const key = normalizeItemName(item.name);

    if (!grouped.has(key)) {
      grouped.set(key, { name: item.name, ids: [item.id], quantity: 1 });
      continue;
    }

    const existing = grouped.get(key);
    existing.ids.push(item.id);
    existing.quantity += 1;
  }
  return Array.from(grouped.values());
}

function normalizeItemName(name) {
  return name.trim().toLowerCase();
}

function getItemEmoji(name) {
  const key = normalizeItemName(name);
  const found = commonItems.find((item) => normalizeItemName(item.name) === key);
  return found?.emoji ?? "🛒";
}
