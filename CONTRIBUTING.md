# EXMOCHEX Contribution & Branching Workflow

This document defines the branching, development, and delivery standards for **EXMOCHEX**.

---

## 1. Branching Requirement

All new features, implementation phases, bug fixes, performance optimizations, and updates **MUST** be developed on dedicated branches branched off `master`.

> **Rule:** Never commit directly to `master` or `main` for new features, phases, or non-trivial updates.

---

## 2. Branch Naming Standards

Branches must use conventional category prefixes followed by a short, descriptive hyphen-separated name:

| Prefix | Usage | Example |
|---|---|---|
| `feat/` | New features or functional capabilities | `feat/trailing-stop-loss` |
| `phase/` | Multi-step milestone or roadmap phase | `phase/2-order-book-depth` |
| `fix/` | Bug fixes and defect corrections | `fix/google-oauth-redirect` |
| `perf/` | Speed, latency, and performance improvements | `perf/mexc-ws-reconnect` |
| `refactor/`| Code refactoring without behavior change | `refactor/trade-alert-engine` |
| `chore/` | Tooling, dependencies, or documentation updates | `chore/branching-workflow-docs` |

---

## 3. Standard Development Lifecycle

### Step 1: Create a Feature Branch
Ensure `master` is clean and up to date, then create your branch:
```bash
git checkout master
git pull origin master
git checkout -b feat/your-feature-name
```

### Step 2: Develop and Test Locally
Implement your changes on the branch. Before committing or merging, verify all quality gates:
```bash
# 1. Run offline unit tests
npm test

# 2. Run TypeScript typecheck
npx tsc --noEmit

# 3. Verify production build
npm run build
```

### Step 3: Commit Changes
Commit with conventional commit messages:
```bash
git add .
git commit -m "feat(trades): add trailing stop loss execution"
```

### Step 4: Local Merge & Dual-Branch Synchronization
Merge the verified branch locally into `master` and keep `main` synchronized:
```bash
# Merge into master
git checkout master
git merge feat/your-feature-name --ff-only

# Synchronize main
git checkout main
git merge master --ff-only

# Switch back to master
git checkout master
```

### Step 5: Push to Origin (Triggers Automated CI/CD)
Push both branches to GitHub:
```bash
git push origin master
git push origin main
```
*The GitHub Actions runner on the Proxmox LXC will automatically validate builds/tests and deploy the updated Docker containers to staging (`https://staging.ymatt.online`).*

### Step 6: Prune Merged Branch
Delete the completed feature branch locally and remotely:
```bash
# Delete local branch
git branch -d feat/your-feature-name

# Delete remote branch (if pushed)
git push origin --delete feat/your-feature-name
```
