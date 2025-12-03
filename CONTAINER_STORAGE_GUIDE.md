# Container-Only Storage & Auto-Save Implementation

## Overview
This update ensures that **NO project files are stored on your local PC**. Everything is managed in Docker containers and automatically synced to GitHub.

## Key Changes

### 1. ✅ No Local File Storage
- **Removed**: Local `projects/` folder creation
- **Removed**: Bind mounts to host filesystem  
- **Result**: All project files exist ONLY inside Docker containers

**Updated Files:**
- `src/app/api/projects/create/route.ts` - Removed local folder creation
- `src/lib/containerManager.ts` - Stores metadata inside container at `/app/.quantumide-metadata.json`

### 2. ✅ Auto-Create GitHub Repository
When creating a new project, you can now:
- Provide a GitHub token
- Auto-create a private repository
- Automatically push initial commit to GitHub

**New Files:**
- `src/lib/githubAPI.ts` - GitHub API integration with Octokit

**Updated API:**
```typescript
POST /api/projects/create
{
  "template": "react-vite",
  "name": "My Project",
  "githubToken": "ghp_...",
  "createGithubRepo": true,
  "privateRepo": true
}
```

### 3. ✅ Auto-Save Feature
Projects auto-save to GitHub every 30 seconds (configurable).

**New Files:**
- `src/hooks/useAutoSave.ts` - Custom hook for periodic auto-save
- `src/app/api/projects/autosave/route.ts` - Auto-save endpoint

**How it works:**
1. Every 30s, commits changes locally in container
2. Pushes to GitHub if token is provided
3. Silent operation, no user interruption

### 4. ✅ Save on Exit
When user leaves the page or closes browser:
- Automatically commits and pushes to GitHub
- Shows confirmation dialog

**New Files:**
- `src/hooks/useBeforeUnload.ts` - Browser exit handler

### 5. ✅ Pause & Resume Projects

**Pause (Go Home):**
- Commits and pushes all changes to GitHub
- **Deletes the Docker container**
- Keeps project in dashboard with "Resume" option

**Resume:**
- Shows beautiful loading animation
- Creates new container
- Clones from GitHub
- Installs dependencies
- Starts dev server

**New Files:**
- `src/app/api/projects/pause/route.ts` - Pause endpoint
- `src/app/api/projects/resume/route.ts` - Resume endpoint
- `src/components/editor/ProjectLoading.tsx` - Loading animation

**New Endpoints:**
```typescript
// Pause project and delete container
POST /api/projects/pause
{
  "projectId": "uuid",
  "githubToken": "ghp_...",
  "message": "Save before pause"
}

// Resume project from GitHub
POST /api/projects/resume
{
  "projectId": "uuid",
  "githubRepo": "https://github.com/user/repo",
  "githubToken": "ghp_..."
}
```

### 6. ✅ Home Button & Logo Navigation
- **QuantumIDE Logo**: Clickable, redirects to homepage
- **Auto-pause**: Clicking home automatically pauses project and removes container
- **Dashboard**: Shows all projects with "Resume" buttons

**Updated:**
- `src/components/dashboard/Dashboard.tsx` - Added logo click handler

## How To Use

### Create New Project with GitHub
1. Click "Create New Project"
2. Choose template
3. Enter project name
4. **Optional**: Provide GitHub token
5. **Optional**: Check "Create GitHub Repo"
6. Project is created → automatically pushed to GitHub
7. **No files on your PC!**

### Work on Project
1. Edit files in Monaco editor
2. Changes auto-save every 30 seconds
3. Changes pushed to GitHub automatically
4. See save status indicator

### Go Home (Pause Project)
1. Click QuantumIDE logo or Home button
2. System automatically:
   - Saves all changes
   - Commits to Git
   - Pushes to GitHub
   - **Deletes the container**
   - Shows project as "Paused" in dashboard

### Resume Project
1. Click "Resume" on project card
2. Beautiful loading animation shows:
   - ✅ Cloning from GitHub
   - ✅ Installing dependencies
   - ✅ Starting dev server
   - ✅ Ready to code
3. New container created with latest code from GitHub
4. Continue working

### Close Browser Tab
1. Browser shows confirmation: "Leave site?"
2. If confirmed:
   - Auto-saves to GitHub
   - Container removed
   - Safe to close

## Loading Animation
Beautiful modern animation with:
- Animated QuantumIDE logo
- Step-by-step progress indicators
- Color-coded status (blue → purple → yellow → green)
- Smooth transitions
- Estimated time remaining

## Storage Flow

```
┌─────────────────────────────────────────────┐
│  User Creates Project                       │
│  ↓                                          │
│  Docker Container Created                   │
│  - Files stored at /app/ (inside)          │
│  - NO local PC files                        │
│  - Metadata at /app/.quantumide-metadata   │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│  Auto-Save (Every 30s)                      │
│  - git add .                                │
│  - git commit                               │
│  - git push to GitHub                       │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│  User Clicks Home / Closes Tab             │
│  - Save all changes                         │
│  - Push to GitHub                           │
│  - DELETE CONTAINER                         │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│  User Clicks Resume                         │
│  - Create new container                     │
│  - Clone from GitHub                        │
│  - Install dependencies                     │
│  - Start dev server                         │
└─────────────────────────────────────────────┘
```

## Configuration

### Auto-Save Interval
```typescript
// In editor page
useAutoSave({
  projectId,
  enabled: true,
  interval: 30000, // 30 seconds (changeable)
  githubToken,
});
```

### Container Resource Limits
```typescript
// src/lib/containerManager.ts
HostConfig: {
  Memory: 1024 * 1024 * 1024, // 1GB RAM
  NanoCpus: 1000000000,        // 1 CPU core
  // NO Binds - container-only storage
}
```

## Benefits

### 1. **No Local Storage Pollution**
- Your PC stays clean
- No stray project folders
- Everything in containers

### 2. **Automatic Backup**
- Never lose work
- Every change saved to GitHub
- Version history preserved

### 3. **Resource Efficient**
- Containers removed when not in use
- Only active projects consume resources
- Resume instantly when needed

### 4. **Collaborative**
- Share GitHub repo with team
- Everyone can resume the same project
- True cloud IDE experience

### 5. **Portable**
- Work from any machine
- Just login and resume
- No setup required

## Required Dependencies

Add to `package.json`:
```json
{
  "dependencies": {
    "@octokit/rest": "^20.0.0"
  }
}
```

Install:
```bash
npm install @octokit/rest
```

## Environment Variables

Optional but recommended:
```bash
# .env.local
GITHUB_TOKEN=ghp_your_personal_access_token
```

## Testing

### 1. Test No Local Files
```bash
# Before creating project
ls projects/
# (should be empty or not exist)

# After creating project
ls projects/
# (should still be empty - no folders created!)
```

### 2. Test Auto-Save
1. Create project with GitHub token
2. Edit a file
3. Wait 30 seconds
4. Check GitHub - commit should appear

### 3. Test Pause/Resume
1. Create project
2. Make changes
3. Click Home button
4. Container should be removed: `docker ps` (project not listed)
5. Click "Resume" on dashboard
6. Watch loading animation
7. Container recreated with changes from GitHub

### 4. Test Exit Save
1. Work on project
2. Close browser tab
3. Confirm leave
4. Check GitHub - changes committed

## Troubleshooting

### "No GitHub repository connected"
- Add GitHub token when creating project
- Or connect repo later via settings

### "Container already removed"
- This is normal - containers auto-delete on pause
- Click "Resume" to recreate

### "Clone failed"
- Check GitHub token has repo access
- Ensure repository exists
- Check network connection

## Next Steps

To use this feature:

1. **Install dependencies:**
   ```bash
   npm install @octokit/rest
   ```

2. **Restart dev server:**
   ```bash
   npm run dev
   ```

3. **Get GitHub Token:**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate new token with `repo` scope
   - Save securely

4. **Create project with GitHub:**
   - Paste token in project creation
   - Check "Auto-create repository"
   - Watch it push automatically!

---

**Result:** Your PC never stores project files. Everything lives in Docker and GitHub. Clean, efficient, and truly cloud-based! 🚀
