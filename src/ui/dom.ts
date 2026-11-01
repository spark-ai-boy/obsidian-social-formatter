import { setIcon } from "obsidian";

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = createEl(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function iconButton(
  parent: HTMLElement,
  icon: string,
  label: string,
  onClick: (event: MouseEvent) => void,
  className?: string,
): HTMLButtonElement {
  const button = el("button", `sf-icon-button${className ? ` ${className}` : ""}`);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  const iconEl = el("span", "sf-icon");
  setIcon(iconEl, icon);
  button.appendChild(iconEl);
  button.addEventListener("click", onClick);
  parent.appendChild(button);
  return button;
}

export function sectionTitle(parent: HTMLElement, title: string, description?: string): void {
  const header = el("div", "sf-section-header");
  header.appendChild(el("h3", undefined, title));
  if (description) header.appendChild(el("p", undefined, description));
  parent.appendChild(header);
}

export function labeledField(
  parent: HTMLElement,
  label: string,
  control: HTMLElement,
  hint?: string,
): HTMLElement {
  const field = el("label", "sf-field");
  const top = el("span", "sf-field-label", label);
  field.appendChild(top);
  field.appendChild(control);
  if (hint) field.appendChild(el("small", "sf-field-hint", hint));
  parent.appendChild(field);
  return field;
}
