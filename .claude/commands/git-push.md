---
description: Verify, commit, and push intended changes to origin/main.
---

Follow the project Git push workflow exactly.

1. Inspect repository state with `git status`, `git diff HEAD`, and `git log`.
2. Fetch `origin/main`; use fast-forward-only pull when needed. Stop on divergence or conflicts.
3. Verify that `db.config.json`, exported data, `node_modules/`, `out/`, and `release/` are not staged.
4. Run `pnpm run check` and `pnpm run build`. If either fails, stop and report the failure.
5. Stage only intended files and create a Conventional Commit message accepted by `commitlint.config.cjs`. 先从当前已审阅的 diff 提炼一行简短的“实际主摘要”（通常约 20 个中文字，除非必须保留技术名词，否则不超过 40 字），再将它直接作为提交大标题（`type: 实际主摘要`）；标题必须概括本次改动的主要结果，不能沿用上一次提交标题、分支名、任务名或固定文案（例如 `fix: 完善资产分类管理体验`）。提交前用 `git log -1 --pretty=%s` 对比，若标题相同或无法由当前 diff 证明，必须重新生成。标题与正文必须使用中文。改动跨多个领域时，正文按领域使用 `- ` 逐行扩展标题，概括行为、数据、工具链和文档变化，不枚举文件；实际主摘要不能只放在正文里。
6. Push to `origin main`.

Do not force-push, reset history, or commit credentials unless the user explicitly authorizes that action. Report the commit hash, subject, verification result, and push result.
