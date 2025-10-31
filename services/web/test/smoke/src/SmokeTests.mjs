import fs from 'fs'
import Path from 'path'
import Settings from '@overleaf/settings'
import { getCsrfTokenForFactory } from './support/Csrf.mjs'
import { SmokeTestFailure } from './support/Errors.mjs'
import {
  requestFactory,
  assertHasStatusCode,
} from './support/requestHelper.mjs'
import { processWithTimeout } from './support/timeoutHelper.mjs'

const STEP_TIMEOUT = Settings.smokeTest.stepTimeout

const PATH_STEPS = Path.join(import.meta.dirname, './steps')
const sortedSteps = fs.readdirSync(PATH_STEPS).sort()

const STEPS = []

for (const name of sortedSteps) {
  const step = (await import(Path.join(PATH_STEPS, name))).default
  step.name = Path.basename(name, '.mjs')
  STEPS.push(step)
}

async function runSmokeTests({ isAborted, stats }) {
  let lastStep = stats.start
  function completeStep(key) {
    const step = Date.now()
    stats.steps.push({ [key]: step - lastStep })
    lastStep = step
  }

  const request = requestFactory({ timeout: STEP_TIMEOUT })
  const getCsrfTokenFor = getCsrfTokenForFactory({ request })
  const ctx = {
    assertHasStatusCode,
    getCsrfTokenFor,
    processWithTimeout,
    request,
    stats,
    timeout: STEP_TIMEOUT,
  }
  const cleanupSteps = []

  async function runAndTrack(id, fn) {
    let result
    try {
      result = await fn(ctx)
    } catch (e) {
      throw new SmokeTestFailure(`${id} failed`, {}, e)
    } finally {
      completeStep(id)
    }
    Object.assign(ctx, result)
  }

  completeStep('init')

  let err
  try {
    for (const step of STEPS) {
      if (isAborted()) break

      const { name, run, cleanup } = step
      if (cleanup) cleanupSteps.unshift({ name, cleanup })

      await runAndTrack(`run.${name}`, run)
    }
  } catch (e) {
    err = e
  }

  const cleanupErrors = []
  for (const step of cleanupSteps) {
    const { name, cleanup } = step

    try {
      await runAndTrack(`cleanup.${name}`, cleanup)
    } catch (e) {
      // keep going with cleanup
      cleanupErrors.push(e)
    }
  }

  if (err) throw err
  if (cleanupErrors.length) {
    if (cleanupErrors.length === 1) throw cleanupErrors[0]
    throw new SmokeTestFailure('multiple cleanup steps failed', {
      stats,
      cleanupErrors,
    })
  }
}

export default { runSmokeTests, SmokeTestFailure }
