# Project Workflow Rules (`VR-Ikea`)

## Always Push Completed Changes to GitHub

After completing and verifying any task that modifies files in this repository:

1. **Verify before committing**: Confirm relevant checks (`npm run lint`, tests, and build as applicable) pass cleanly after the final edit.
2. **Protect secrets and ignored artifacts**: Check `git status` and ensure sensitive or generated paths (such as `.env*`, `node_modules/`, `dist/`, `*.log`, `.antigravity/`) remain untracked and excluded by `.gitignore`.
3. **Commit and push to `origin/main`**:
   - Ensure the `origin` remote points to `https://github.com/JakoubekYT/VR-Ikea` (`git@github.com:JakoubekYT/VR-Ikea.git`).
   - Stage the project changes cleanly, create a concise descriptive commit, and push to `origin main` at the end of the task.
