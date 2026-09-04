import { useEffect, useRef, useState } from "react";

import type { PortfolioResearchModel } from "./usePortfolioResearch";

export type PortfolioAction = {
  kind: "save" | "saveAs" | "delete";
  trigger: HTMLButtonElement;
  initialName?: string;
};

function copyName(model: PortfolioResearchModel): string {
  const existingNames = new Set(model.baskets.map((basket) => basket.name.trim().toLocaleLowerCase()));
  const baseName = model.draft.name.trim() || "我的组合";
  for (let index = 1; ; index += 1) {
    const suffix = index === 1 ? "（副本）" : `（副本 ${index}）`;
    const candidate = `${baseName.slice(0, 40 - suffix.length)}${suffix}`;
    if (!existingNames.has(candidate.toLocaleLowerCase())) return candidate;
  }
}

export function PortfolioActionDialog({ action, model, onClose }: {
  action: PortfolioAction;
  model: PortfolioResearchModel;
  onClose(): void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(() => action.kind === "save" ? action.initialName ?? model.draft.name : copyName(model));
  const [attemptedSave, setAttemptedSave] = useState(false);
  const deleting = action.kind === "delete";
  const savedName = model.baskets.find((basket) => basket.id === model.activeBasketId)?.name ?? model.draft.name;

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => {
      if (action.trigger.isConnected && !action.trigger.disabled) action.trigger.focus();
      else document.getElementById("portfolio-edit-trigger")?.focus({ preventScroll: true });
    };
  }, [action]);

  return (
    <dialog ref={dialogRef} className="portfolio-action-dialog" role={deleting ? "alertdialog" : "dialog"} aria-labelledby="portfolio-action-title" aria-describedby="portfolio-action-description" onCancel={(event) => {
      event.preventDefault();
      onClose();
    }}>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (deleting) {
          if (model.activeBasketId) model.requestDelete(model.activeBasketId, action.trigger);
          onClose();
        } else {
          setAttemptedSave(true);
          if (model.saveAs(name)) onClose();
        }
      }}>
        <h3 id="portfolio-action-title">{deleting ? `删除“${savedName}”？` : action.kind === "save" ? "保存组合" : "另存为"}</h3>
        <p id="portfolio-action-description">{deleting
          ? `将从当前浏览器删除此组合${model.dirty ? "及当前未保存的更改" : ""}。此操作无法撤销。`
          : action.kind === "save" ? "保存在当前浏览器，下次可从“我的组合”打开。" : "保存为新组合，原组合不变。"}</p>
        {!deleting ? <label className="portfolio-copy-name">
          {action.kind === "save" ? "组合名称" : "副本名称"}
          <input autoFocus value={name} maxLength={40} onChange={(event) => { setName(event.target.value); setAttemptedSave(false); }} />
        </label> : null}
        {attemptedSave && model.saveError ? <p className="portfolio-action-error" role="alert">{model.saveError}</p> : null}
        <div className="portfolio-dialog-actions">
          <button type="submit" className={deleting ? "portfolio-danger" : "portfolio-primary"} disabled={!deleting && !name.trim()}>{deleting ? "确认删除" : action.kind === "save" ? "保存" : "保存副本"}</button>
          <button type="button" autoFocus={deleting} onClick={onClose}>取消</button>
        </div>
      </form>
    </dialog>
  );
}
