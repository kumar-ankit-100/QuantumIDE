# 🧪 AI Copilot Testing Guide

## ✅ Quick Test Checklist

### Pre-Test Setup
- [x] Gemini API key is set in `.env.local`
- [ ] Dev server is running (`npm run dev`)
- [ ] You have a project created in QuantumIDE
- [ ] You've opened a file in the Monaco editor

---

## 🎯 Test Scenarios

### Test 1: Basic Code Addition
**Goal:** Verify AI can add new code

**Steps:**
1. Open any React component (e.g., `src/app/page.tsx`)
2. Click **AI Copilot** tab (purple magic wand)
3. Type: **"Add a useState hook for counter"**
4. Click Send

**Expected Result:**
- ✅ Diff viewer appears
- ✅ Shows green lines with `+ import { useState }`
- ✅ Shows new state declaration
- ✅ Accept button is clickable

**Action:** Click **Accept Changes**

**Expected Result:**
- ✅ Success message appears
- ✅ Monaco editor updates with new code
- ✅ Changes are persisted to file

---

### Test 2: Code Refactoring
**Goal:** Verify AI can modify existing code

**Steps:**
1. Create a file with this code:
```javascript
function getData() {
  return fetch('/api/data').then(res => res.json());
}
```
2. Click AI Copilot tab
3. Type: **"Make getData async with try-catch error handling"**
4. Click Send

**Expected Result:**
- ✅ Diff shows red lines (removing old code)
- ✅ Diff shows green lines (adding async/await)
- ✅ Shows try-catch blocks
- ✅ Explanation describes the changes

**Action:** Click **Accept Changes**

**Expected Result:**
- ✅ Function is now async
- ✅ Uses await instead of .then()
- ✅ Has try-catch block

---

### Test 3: Reject Changes
**Goal:** Verify reject workflow works

**Steps:**
1. Open any file
2. Type: **"Add a dark mode toggle"**
3. Click Send
4. Wait for diff to appear
5. Click **Reject**

**Expected Result:**
- ✅ Rejection message appears
- ✅ No files are modified
- ✅ Can send new request immediately

---

### Test 4: Multiple File Selection
**Goal:** Test selective file application

**Steps:**
1. Request changes that affect multiple files
2. Wait for diff viewer
3. Uncheck one file's checkbox
4. Click **Accept Changes**

**Expected Result:**
- ✅ Only checked files are updated
- ✅ Unchecked files remain unchanged
- ✅ Success message shows correct count

---

### Test 5: Creating New Files
**Goal:** Verify AI can create new components

**Steps:**
1. Type: **"Create a LoadingSpinner component in components/LoadingSpinner.tsx"**
2. Click Send

**Expected Result:**
- ✅ Shows "New" badge on file
- ✅ File path is correct
- ✅ Complete component code is shown

**Action:** Click **Accept Changes**

**Expected Result:**
- ✅ New file appears in file tree
- ✅ Can click to open the file
- ✅ Code is valid TypeScript/React

---

### Test 6: Context Awareness
**Goal:** Verify AI understands current file

**Steps:**
1. Open `src/app/page.tsx`
2. Type: **"Add a title to this page"**
3. Click Send

**Expected Result:**
- ✅ AI modifies the correct file (page.tsx)
- ✅ Changes are relevant to current file
- ✅ Respects existing structure

---

### Test 7: Error Handling
**Goal:** Test error scenarios

**Scenario A: Invalid API Key**
1. Temporarily corrupt API key in `.env.local`
2. Send a request
3. **Expected:** Error message displayed

**Scenario B: Network Error**
1. Stop dev server
2. Send a request
3. **Expected:** Network error message

**Scenario C: Invalid File Path**
1. Request changes to non-existent file
2. **Expected:** File write fails gracefully

---

### Test 8: Loading States
**Goal:** Verify UI feedback during operations

**Steps:**
1. Send a complex request
2. Observe loading states

**Expected Behaviors:**
- ✅ Send button shows spinner
- ✅ Input is disabled during loading
- ✅ "Applying..." shows when accepting changes
- ✅ Accept button is disabled during application

---

### Test 9: UI/UX Quality
**Goal:** Verify smooth user experience

**Checklist:**
- [ ] Animations are smooth (no jank)
- [ ] Colors are consistent
- [ ] Text is readable
- [ ] Buttons have hover effects
- [ ] Diff lines up correctly
- [ ] Scrolling works smoothly
- [ ] Tab switching is instant
- [ ] Icons render correctly

---

### Test 10: Complex Requests
**Goal:** Test AI's capability limits

**Try these prompts:**
1. "Add authentication with NextAuth"
2. "Refactor this to use TypeScript generics"
3. "Implement pagination with React Query"
4. "Add Zod validation to this form"
5. "Create a custom hook for data fetching"

**Expected:**
- ✅ AI provides reasonable suggestions
- ✅ Code is syntactically valid
- ✅ Explanations are helpful
- ⚠️ Some complex features may need iteration

---

## 🐛 Common Issues & Solutions

### Issue: Diff looks messy
**Solution:** Ensure file content hasn't changed since request was made

### Issue: Changes not applying
**Solution:** Check browser console for errors, verify file path

### Issue: JSON parse error
**Solution:** AI returned invalid JSON - try rephrasing request

### Issue: Too many changes
**Solution:** Break request into smaller, focused tasks

---

## 📊 Success Metrics

### Functionality (Must Pass)
- ✅ Can send requests
- ✅ Diff viewer renders
- ✅ Accept applies changes
- ✅ Reject dismisses changes
- ✅ Files update in Monaco
- ✅ Error messages show

### Performance (Should Pass)
- ✅ Response < 5 seconds
- ✅ Diff renders < 500ms
- ✅ File write < 1 second
- ✅ UI never freezes

### UX Quality (Nice to Have)
- ✅ Animations smooth
- ✅ Colors beautiful
- ✅ Layout responsive
- ✅ Keyboard shortcuts work

---

## 🎬 Demo Script

**For showcasing the feature:**

### Step 1: Introduction (30 seconds)
"I'm going to show you our AI Copilot feature, which lets you modify code using natural language - just like GitHub Copilot!"

### Step 2: Simple Example (1 minute)
1. Open Counter.tsx
2. "Watch me add a counter with one sentence"
3. Type: "Add a counter button"
4. Show diff with red/green highlights
5. Click Accept
6. "And it's done!"

### Step 3: Complex Example (2 minutes)
1. Open API route
2. "Now let's add error handling"
3. Type: "Add try-catch with proper error logging"
4. Explain the diff
5. Show accept/reject buttons
6. Accept changes

### Step 4: Show Features (1 minute)
1. Point out file selection
2. Show change descriptions
3. Demonstrate reject
4. Show success message

### Step 5: Conclusion (30 seconds)
"This is powered by Google Gemini, integrated with our Monaco editor, and uses the Model Context Protocol pattern for AI-assisted development!"

---

## 🚀 Next Steps After Testing

### If Everything Works:
1. ✅ Mark todo as complete
2. 📝 Document any issues found
3. 🎥 Record a demo video
4. 📊 Prepare presentation slides

### If Issues Found:
1. 🐛 Log each issue with details
2. 🔧 Prioritize by severity
3. 💻 Fix critical bugs
4. 📈 Plan improvements

---

## 📸 Screenshot Checklist

**Capture these for documentation:**
- [ ] Empty state (first time view)
- [ ] User typing a request
- [ ] Diff viewer with changes
- [ ] Accept/Reject buttons
- [ ] Success message
- [ ] Monaco editor updated
- [ ] Multiple files in diff
- [ ] Error state

---

**Happy Testing! 🎉**

Remember: This is an MVP. Some edge cases may not work perfectly, but the core functionality should be solid!
