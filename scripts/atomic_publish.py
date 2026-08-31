from __future__ import annotations

import shutil
import time
import uuid
from pathlib import Path
from typing import Iterable


_REPLACE_RETRY_DELAYS_SECONDS = (0.1, 0.25, 0.5, 1.0, 2.0)


def replace_staged_file(staged: Path, target: Path) -> None:
    """Atomically replace a target, tolerating short-lived Windows file locks."""
    for attempt, delay in enumerate(_REPLACE_RETRY_DELAYS_SECONDS, start=1):
        try:
            staged.replace(target)
            return
        except PermissionError:
            if attempt == len(_REPLACE_RETRY_DELAYS_SECONDS):
                raise
            time.sleep(delay)


def publish_staged_files(replacements: Iterable[tuple[Path, Path]]) -> None:
    """Publish a file group and roll back already-replaced targets on ordinary failures."""
    entries = [(Path(staged), Path(target)) for staged, target in replacements]
    targets = [target for _, target in entries]
    if len(set(targets)) != len(targets):
        raise ValueError("同一发布事务不能包含重复目标文件")
    for staged, _ in entries:
        if not staged.is_file():
            raise FileNotFoundError(f"待发布文件不存在：{staged}")

    token = uuid.uuid4().hex
    backups: dict[Path, Path | None] = {}
    published_targets: list[Path] = []
    preserve_backups = False
    try:
        for _, target in entries:
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                backups[target] = None
                continue
            backup = target.with_name(f".{target.name}.rollback-{token}")
            shutil.copy2(target, backup)
            backups[target] = backup

        try:
            for staged, target in entries:
                replace_staged_file(staged, target)
                published_targets.append(target)
        except Exception as publish_error:
            rollback_errors: list[str] = []
            for target in reversed(published_targets):
                backup = backups[target]
                try:
                    if backup is None:
                        if target.exists():
                            target.unlink()
                    else:
                        backup.replace(target)
                except Exception as rollback_error:
                    rollback_errors.append(
                        f"{target}: {rollback_error}; backup={backups[target]}"
                    )
            if rollback_errors:
                preserve_backups = True
                raise RuntimeError(
                    "发布失败且部分目标无法回滚：" + "；".join(rollback_errors)
                ) from publish_error
            raise
    finally:
        for backup in backups.values():
            if backup is not None and backup.exists() and not preserve_backups:
                backup.unlink()
