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
