# How to Revert Changes (via GitHub)

This is your safety net for the upcoming changes to the volunteer portal
(Admin page, registration role dropdown, "Karta ime" photo/field lock &
request system, zone-change requests). If any change ships and you don't
like it, use this guide to undo it — no coding knowledge required for the
web-UI method.

## Your current safe restore point

Right now (before any of the proposed changes are made), your `main` branch
is at this exact commit, and it matches what's on GitHub (`origin/main`):

```
daace50d9e93ff653bd784340d94273371e98e3e
```

Short form: `daace50`

**Keep this commit hash somewhere safe** (this file counts). No matter how
many commits get added after this, you can always get back to exactly this
state using the steps below.

> Note: at the time this file was created, `.github/workflows/deploy-supabase-schema.yml`
> had local uncommitted edits not yet pushed to GitHub. That's unrelated to
> the 5 proposed changes — check with `git diff` before reverting anything if
> you want to keep that edit.

---

## Option A (recommended): Ask for the changes to be made on a branch + Pull Request

The easiest revert is the one you never have to think about. If the 5
changes are made on a separate branch and opened as a Pull Request (PR)
instead of being pushed straight to `main`, then:

- **Don't like it before merging?** Just close the PR. `main` never changes.
- **Already merged and don't like it?** Open the PR on GitHub → click the
  **"Revert"** button in the top-right → this opens a new PR that undoes
  the merge → click **"Merge pull request"**. Done, no command line needed.

If you'd like, say so and future changes can be delivered this way by
default.

---

## Option B: Revert using the GitHub website only (no terminal)

If changes are pushed directly to `main` (as has been the pattern in this
repo so far — see `git log`), you can still undo them from github.com:

1. Go to `https://github.com/diasporaforalbania/ref-volunteer-portal/commits/main`
2. Find the commit **right before** the change you don't like (compare
   dates/messages, or use the restore point hash above).
3. Click that commit to open it, then click **"Browse repository at this
   point in history"** (the `<>` icon next to the commit hash).
4. Open the file you want to restore (e.g. `index.html`), click **"Raw"**,
   and copy its full contents.
5. Go back to `main`, open the same file, click the pencil (✏️) **Edit**
   icon, select all, paste the old content back in, and commit directly to
   `main` with a message like `Revert index.html to daace50`.

This works file-by-file. For a full multi-file revert, Option C below is
faster and safer.

---

## Option C: Revert using git (command line)

Run these from the project folder. All commands are safe to paste as-is.

### 1. See what happened
```bash
git log --oneline -20
```
This lists recent commits so you can identify the hash of the last commit
you were happy with (or use `daace50` from above).

### 2. Undo specific commit(s) — keeps history, safest
This creates a **new** commit that undoes the changes from a specific
commit, without deleting any history:
```bash
git revert <bad-commit-hash>
git push origin main
```
For a range of commits (e.g. everything after `daace50`):
```bash
git revert daace50d9e93ff653bd784340d94273371e98e3e..HEAD
git push origin main
```

### 3. Go back to an exact known-good state — rewrites history
Only do this if you're the only one working on the repo, or you've
coordinated with anyone else pushing to it. This throws away all commits
made after the restore point:
```bash
git reset --hard daace50d9e93ff653bd784340d94273371e98e3e
git push --force origin main
```
⚠️ `--force` overwrites what's on GitHub. Anyone else's unpushed work based
on the newer commits would be lost. Since you're currently the only
contributor here, this is low-risk, but it's still irreversible once pushed
— double-check the hash first.

### 4. Restore just one file to an old version (keep everything else)
```bash
git checkout daace50d9e93ff653bd784340d94273371e98e3e -- index.html
git commit -m "Revert index.html to pre-change version"
git push origin main
```
Swap `index.html` for `schema.sql`, or any other file.

---

## ⚠️ One extra step when reverting the team-shift change

The change that moved check-in inside planned shifts (August 2026) also
**removed** database privileges — `revoke all on public.checkins` and
`revoke all on public.shifts`. Reverting `schema.sql` in git and re-running it
does **not** put those privileges back, because the old file never granted
them explicitly. Check-in would stay broken.

So after reverting `schema.sql`, also run this once in Supabase → SQL Editor:

```sql
grant select, insert, update, delete on public.checkins      to authenticated;
grant select, insert, update, delete on public.shifts        to authenticated;
grant select, insert, update, delete on public.shift_signups to authenticated;
notify pgrst, 'reload schema';
```

Nothing is lost either way — the `shift_id` column on `checkins` and
`closed_at` on `shifts` simply sit unused, and every signature total keeps
working.

---

## Quick decision guide

| Situation | What to do |
|---|---|
| Haven't pushed yet, just don't like local edits | `git restore <file>` or `git reset --hard HEAD` (local only, nothing lost on GitHub) |
| Pushed, but only one thing is wrong | Option C.4 (restore a single file) |
| Pushed, and want to undo it but keep later good work | Option C.2 (`git revert`) |
| Pushed, and want everything back to exactly how it was today | Option C.3 (`git reset --hard` + force push) using `daace50d9e93ff653bd784340d94273371e98e3e` |
| Not comfortable with the terminal at all | Option B (GitHub website) |
| Want revert to always be a one-click button | Option A (branch + PR workflow going forward) |

If anything here is unclear when the moment comes, just ask — reverting to
`daace50` (today's state) can be done in one command at any time.
