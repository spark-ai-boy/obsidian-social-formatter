import { App, Modal } from "obsidian";
import { el } from "./dom";

export class ConfirmModal extends Modal {
  private readonly titleText: string;
  private readonly message: string;
  private readonly confirmLabel: string;
  private readonly onConfirm: () => void | Promise<void>;

  constructor(
    app: App,
    titleText: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmLabel = "确认",
  ) {
    super(app);
    this.titleText = titleText;
    this.message = message;
    this.confirmLabel = confirmLabel;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    this.modalEl.classList.add("sf-confirm-modal");
    this.contentEl.empty();
    this.contentEl.appendChild(el("h2", undefined, this.titleText));
    this.contentEl.appendChild(el("p", "sf-confirm-message", this.message));

    const actions = el("div", "sf-modal-actions");
    const cancel = el("button", "sf-button", "取消");
    cancel.type = "button";
    cancel.addEventListener("click", () => this.close());
    const confirm = el("button", "sf-button sf-button-danger", this.confirmLabel);
    confirm.type = "button";
    confirm.addEventListener("click", () => {
      confirm.disabled = true;
      void (async () => {
        await this.onConfirm();
        this.close();
      })();
    });
    actions.append(cancel, confirm);
    this.contentEl.appendChild(actions);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
