---
name: git-push
description: Commit and push the current asset inventory project only when the user explicitly requests it.
---

# Git Push

Use this workflow only when the user explicitly asks to commit, push, or commit and push the current changes.

## Preconditions

- Repository branch: `main`
- Remote: `origin` (`git@github.com:jerrywu001/assets-electron-demo.git`)
- Never stage `db.config.json`, exported data, `node_modules/`, `out/`, or `release/`.

## Workflow

1. Synchronize safely

Run `git fetch origin main`, inspect whether local `main` is behind, and run `git pull --ff-only origin main` when possible. If a merge or rebase is required, stop and report the divergence instead of rewriting history.

2. Review changes

Run `git status` and `git diff HEAD`. Confirm that only intended project files are included and that sensitive local configuration remains ignored.

3. Verify

Run:

```bash
pnpm run check
pnpm run build
```

If a database-backed behavior changed and local MySQL is configured, also run the relevant smoke or IPC check. Stop on failures.

4. Commit

Use Conventional Commit messages accepted by `commitlint.config.cjs`:

- `feat`: user-visible capability
- `fix`: defect correction
- `docs`: documentation-only change
- `style`: non-functional UI/style adjustment
- `refactor`, `test`, `build`, `ci`, `chore`, `revert`

Derive the commit message from the reviewed diff. Write the Conventional Commit subject and body in Chinese. Do not use generic subjects such as `更新项目` or `完善管理`.

- Use a specific Conventional Commit subject that states the dominant change.
- First derive a short one-line main summary from the current reviewed diff (normally about 20 Chinese characters, and no more than 40 unless a technical name requires it); use that exact summary as the commit subject after the Conventional Commit type prefix (`type: 摘要`). The subject is the headline shown by Git clients and must describe this change's actual dominant outcome.
- Never reuse the previous commit subject, branch name, task title, or a fixed phrase such as `fix: 完善资产分类管理体验`. Before committing, compare the proposed subject with `git log -1 --pretty=%s`; if it is unchanged or not supported by the staged diff, regenerate it.
- For changes spanning two or more functional areas, add a commit body with one `- ` bullet per area. Summarize user-visible behavior, data model, tooling, or documentation changes; do not list every file.
- Body bullets expand the headline and must not replace it; do not put the actual main summary only in the body.
- Re-read the staged diff immediately before committing and ensure every bullet is supported by it.

Stage intended files explicitly. Do not use force push unless the user explicitly requests a history rewrite.

5. Push

Push with:

```bash
git push origin main
```

Report the commit hash, commit subject, verification commands, and push result.

## Safety Constraints

- Do not commit or expose database credentials.
- Do not use `git reset --hard`, `git checkout --`, or force push without explicit user authorization.
- On conflicts, authentication errors, or a non-fast-forward push, stop and report the exact blocker.
