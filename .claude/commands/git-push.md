---
description: Verify, commit, and push intended changes to origin/main.
---

Follow the project Git push workflow exactly.

1. Inspect repository state with `git status`, `git diff HEAD`, and `git log`.
2. Fetch `origin/main`; use fast-forward-only pull when needed. Stop on divergence or conflicts.
3. Verify that `db.config.json`, exported data, `node_modules/`, `out/`, and `release/` are not staged.
4. Run `pnpm run check` and `pnpm run build`. If either fails, stop and report the failure.
5. Stage only intended files and create a Conventional Commit message accepted by `commitlint.config.cjs`. 标题与正文必须使用中文，并根据主要改动生成具体标题。改动跨多个领域时，正文按领域使用 `- ` 逐行概括行为、数据、工具链和文档变化，不枚举文件，不使用泛化描述。
6. Push to `origin main`.

Do not force-push, reset history, or commit credentials unless the user explicitly authorizes that action. Report the commit hash, subject, verification result, and push result.
