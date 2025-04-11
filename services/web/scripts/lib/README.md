# Script Runner

## Overview

The Script Runner wraps your script's main logic to automatically handle logging, status tracking (success/error), and progress updates. Script execution status can be viewed from "Script Logs" portal page.

## Features

- Automatically logs the start and end of your script.
- Records the final status ('success' or 'error').
- Provides a simple function (`trackProgress`) to your script for logging custom progress steps.
- Captures script parameters and basic environment details.

## Usage

1.  **Import `scriptRunner`**.
2.  **Define your script's main logic** as an `async` function that accepts `trackProgress` as its argument (can ignore `trackProgress` if you don't need to track progress).
3.  **Call `scriptRunner`**, passing your function and any variables it needs.
4.  **Check script execution status** by visiting the "Script Logs" portal page using the URL printed in the console output.

**Example:**

```javascript
// Import the script runner utility (adjust the path as needed)
import { scriptRunner } from './lib/ScriptRunner.mjs'

const subJobs = 30

/**
 * Your script's main work goes here.
 * It must be an async function and accept `trackProgress`.
 * @param {(message: string) => void} trackProgress - Call this to log progress.
 */
async function main(trackProgress) {
  for (let i = 0; i < subJobs; i++) {
    await new Promise(resolve => setTimeout(() => resolve(), 1000))
    await trackProgress(`Job in progress ${i + 1}/${subJobs}`)
  }
  await trackProgress('Job finished')
}

// Define any variables your script needs (optional)
const scriptVariables = {
  subJobs,
}

// --- Execute the script using the runner with async/await ---
try {
  await scriptRunner(main, scriptVariables)
  process.exit()
} catch (error) {
  console.error(error)
  process.exit(1)
}
```
