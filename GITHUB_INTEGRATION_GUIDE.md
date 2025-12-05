# GitHub Integration Guide for QuantumIDE

## Overview
Your code is automatically backed up to GitHub! Here's how it works:

## ✅ How It Works

### 1. **Project Creation with GitHub**
When you create a new project:
- Check the **"Create GitHub Repository"** checkbox in the project creation modal
- The system automatically:
  - Creates a private GitHub repository
  - Initializes git in the container
  - Makes an initial commit with all project files
  - Pushes everything to GitHub

### 2. **Where to Find Your GitHub Token**
Your GitHub Personal Access Token is stored in:
- **File**: `.env.local` in the project root
- **Variable**: `GITHUB_TOKEN=github_pat_11BA2CYAI0...`

This token is already configured and working!

### 3. **Manual Save to GitHub**
In the IDE header, you'll now see:
- **GitHub Status Indicator**: Shows your repo name and link
- **Last Saved**: Displays how long ago the last save was
- **"Save to GitHub" Button**: Manually commits and pushes your changes

Click "Save to GitHub" whenever you want to push your changes!

### 4. **What Gets Saved**
When you click "Save to GitHub":
1. Saves the currently open file
2. Commits ALL changes in the container with message: "Auto-save from QuantumIDE"
3. Pushes to the `main` branch on GitHub
4. Updates the "Last Saved" timestamp

### 5. **Check Your GitHub Repository**
1. Go to https://github.com/kumar-ankit-100
2. Look for repositories created with your project names
3. All your code, files, and changes are there!

## 🔍 Current Status

### What's Working:
- ✅ GitHub repo creation during project setup
- ✅ Initial commit and push
- ✅ Manual save to GitHub button in IDE
- ✅ GitHub status indicator showing repo link
- ✅ Last saved timestamp display
- ✅ Save status indicators (saving/success/error)

### What's NOT Enabled Yet:
- ⏸️ **Auto-save every 30 seconds** - Code exists but not wired up
- ⏸️ **Save on browser close** - Hook exists but not connected
- ⏸️ **Pull from GitHub** - Function exists but no UI button

## 🚀 To See Your Code on GitHub Right Now:

1. **Create a new project** with the GitHub checkbox checked
2. **Open the IDE** for that project
3. **Make some changes** to a file and save
4. **Click "Save to GitHub"** button in the header
5. **Click the GitHub repo badge** to open your repository
6. **See your code!** All files are there

## 📋 Example Flow:

```
1. Dashboard → Create Project → ✓ Create GitHub Repository
2. Wait for loading screen (Installing dependencies 60%...)
3. IDE Opens → See GitHub badge in header showing repo name
4. Edit some files
5. Click "Save to GitHub" button
6. See "Saved 3s ago" → Changes are on GitHub!
7. Click GitHub badge → Opens your repo in a new tab
```

## 🔧 Technical Details

### Files Involved:
- `/api/projects/create/route.ts` - Creates GitHub repo on project creation
- `/api/projects/autosave/route.ts` - Commits and pushes changes
- `/lib/github.ts` - Git operations (commit, push, pull)
- `/lib/githubAPI.ts` - GitHub API integration (create repo)
- `/hooks/useAutoSave.ts` - Auto-save hook (not yet active)
- `/components/editor/GitHubStatus.tsx` - Status indicator UI

### GitHub Token Permissions:
Your token needs these scopes:
- `repo` - Full control of private repositories
- `workflow` - Update GitHub Action workflows

## 💡 Tips:

1. **Always save important work**: Click "Save to GitHub" before closing
2. **Check the status**: Green checkmark = successfully saved
3. **View your repos**: Click the GitHub badge to see your code online
4. **Private by default**: All repos are created as private

## 🐛 Troubleshooting:

### "No GitHub repo connected" warning:
- You didn't check the GitHub checkbox when creating the project
- Solution: Create a new project with the checkbox enabled

### "Save failed" error:
- Check that your GitHub token is valid in `.env.local`
- Check the terminal logs for detailed error messages

### Can't find my repo on GitHub:
- Go to https://github.com/kumar-ankit-100?tab=repositories
- Look for repo names matching your project names
- They may be private - make sure you're logged in

## 🎯 Next Steps to Enable Auto-Save:

To enable automatic saves every 30 seconds, we need to:
1. Import and use `useAutoSave` hook in IDE page
2. Pass GitHub token from environment or local storage
3. Wire up `useBeforeUnload` for save-on-exit

Would you like me to enable this automatic saving feature?
