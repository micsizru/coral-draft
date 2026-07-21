let idCounter = 0;

export function getUniqueId() {
  return "id_" + Date.now() + "_" + idCounter++;
}

export function adjustHeight(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

export function getLineClass(type) {
  return `editor-line-${type}`;
}

export function getDropdownBtnClass(type, types) {
  const found = types.find((t) => t.value === type);
  return found
    ? found.btnClass
    : "bg-slate-100 text-slate-700 border-slate-300";
}
