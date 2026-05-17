---
name: taking-screenshots
description: >-
  Takes screenshots of the web app running on port 3000 to verify visual
  changes and show the user what the app looks like. Use after making
  visual changes, when the user asks to see the app, or when you need
  to verify your work looks correct.
---

# Taking Screenshots

Use the `screenshot` tool to capture the app at http://localhost:3000.

## When to Screenshot
- After creating or significantly changing the UI
- When the user asks "what does it look like?" or "show me"
- To verify your CSS/layout changes look correct
- After fixing visual bugs

## Usage
Just call the `screenshot` tool. It will:
1. Open Chromium headlessly
2. Navigate to http://localhost:3000
3. Wait for the page to fully load
4. Capture a 1280x800 screenshot
5. Return the image so you can see it

## Tips
- Make sure something is serving on port 3000 first
- If the screenshot is blank, the app might not have started yet
- Wait a moment after starting a server before screenshotting
- The screenshot is also automatically sent to the user
