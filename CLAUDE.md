## ⚠️ Production Database Rule (STRICTEST — ABSOLUTELY NO EXCEPTIONS)

- NEVER run any write operation on the production DB (INSERT, UPDATE, DELETE, ALTER, DROP, TRUNCATE) without first:
  1. Stating the exact SQL query that will be executed
  2. Explaining what data will be affected and how many rows
  3. Waiting for the user to explicitly confirm ("yes", "go ahead", etc.)
  4. Only then executing
- This applies to ALL production DB changes — no matter how small or "safe" they seem.
- Read-only queries (SELECT) on production are allowed without asking.
- NEVER assume a production DB change is safe to auto-run. Always stop and confirm.
- If unsure whether a DB is production or local, treat it as production and ask first.
- Production DB credentials (host: 207.180.200.243) must NEVER be used for write operations without explicit user approval per query.

---

## Git Safety Rule (STRICT — NO EXCEPTIONS)

- NEVER run any git write command without asking the user first and getting explicit approval.
- This includes: git add, git commit, git push, git checkout, git switch, git branch (create/delete), git merge, git rebase, git reset, git stash, git cherry-pick, git tag, git restore.
- Before running any of the above, ALWAYS:
  1. State the exact command you want to run
  2. State which branch you are on
  3. Wait for the user to confirm ("yes", "go ahead", etc.)
  4. Only then execute
- Read-only commands are allowed without asking: git status, git log, git diff, git branch --show-current, git remote -v.
- NEVER assume which branch to commit/push to. Always confirm the branch with the user.
- NEVER stage files (git add) without listing them and getting approval.
