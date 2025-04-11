// Import the script runner utility (adjust the path as needed)
import { scriptRunner } from '../lib/ScriptRunner.mjs'

const subJobs = 30

/**
 * Your script's main work goes here.
 * It must be an async function and accept `trackProgress`.
 * @param {(message: string) => Promise<void>} trackProgress - Call this to log progress.
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
