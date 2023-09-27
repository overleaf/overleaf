import { round } from 'lodash'
import grammarlyExtensionPresent from '../../shared/utils/grammarly'
import getMeta from '../../utils/meta'
import { debugConsole } from '@/utils/debugging'

const TIMER_DOM_UPDATE_NAME = 'Ace-DomUpdate'
const TIMER_MEASURE_NAME = 'Ace-Keypress-Measure'

const sessionStart = Date.now()

let performanceOptionsSupport = false

// Check that performance.mark and performance.measure accept an options object
try {
  const testMarkName = 'featureTestMark'
  performance.mark(testMarkName, {
    startTime: performance.now(),
    detail: { test: 1 },
  })
  performance.clearMarks(testMarkName)

  const testMeasureName = 'featureTestMeasure'
  performance.measure(testMeasureName, {
    start: performance.now(),
    detail: { test: 1 },
  })
  performance.clearMeasures(testMeasureName)

  performanceOptionsSupport = true
} catch (e) {}

let performanceMemorySupport = false

function measureMemoryUsage() {
  // @ts-ignore
  return performance.memory.usedJSHeapSize
}

try {
  if ('memory' in window.performance) {
    measureMemoryUsage()
    performanceMemorySupport = true
  }
} catch (e) {}

let keypressesSinceDomUpdateCount = 0
const unpaintedKeypressStartTimes: number[] = []
let animationFrameRequest: number | null = null

function timeInputToRender() {
  if (!performanceOptionsSupport) return

  ++keypressesSinceDomUpdateCount

  unpaintedKeypressStartTimes.push(performance.now())

  if (!animationFrameRequest) {
    animationFrameRequest = window.requestAnimationFrame(() => {
      animationFrameRequest = null

      performance.mark(TIMER_DOM_UPDATE_NAME, {
        detail: { keypressesSinceDomUpdateCount },
      })
      keypressesSinceDomUpdateCount = 0

      const keypressEnd = performance.now()

      for (const keypressStart of unpaintedKeypressStartTimes) {
        performance.measure(TIMER_MEASURE_NAME, {
          start: keypressStart,
          end: keypressEnd,
        })
      }
      unpaintedKeypressStartTimes.length = 0
    })
  }
}

export function initAcePerfListener(textareaEl: HTMLTextAreaElement) {
  textareaEl?.addEventListener('beforeinput', timeInputToRender)
}

export function tearDownAcePerfListener(textareaEl: HTMLTextAreaElement) {
  textareaEl?.removeEventListener('beforeinput', timeInputToRender)
}

function calculateMean(durations: number[]) {
  if (durations.length === 0) return 0

  const sum = durations.reduce((acc, entry) => acc + entry, 0)
  return sum / durations.length
}

export function reportAcePerf() {
  const durations = performance
    .getEntriesByName(TIMER_MEASURE_NAME, 'measure')
    .map(({ duration }) => duration)

  performance.clearMeasures(TIMER_MEASURE_NAME)

  const meanKeypressPaint = round(calculateMean(durations), 2)

  const grammarly = grammarlyExtensionPresent()
  const sessionLength = Math.floor((Date.now() - sessionStart) / 1000) // In seconds

  const memory = performanceMemorySupport ? measureMemoryUsage() : null

  // Get entries for keypress counts between DOM updates
  const domUpdateEntries = performance.getEntriesByName(
    TIMER_DOM_UPDATE_NAME,
    'mark'
  ) as PerformanceMark[]

  performance.clearMarks(TIMER_DOM_UPDATE_NAME)

  let lags = 0
  let nonLags = 0
  let longestLag = 0
  let totalKeypressCount = 0

  for (const entry of domUpdateEntries) {
    const keypressCount = entry.detail.keypressesSinceDomUpdateCount
    if (keypressCount === 1) {
      ++nonLags
    } else if (keypressCount > 1) {
      ++lags
    }
    if (keypressCount > longestLag) {
      longestLag = keypressCount
    }
    totalKeypressCount += keypressCount
  }

  const meanLagsPerMeasure = round(lags / (lags + nonLags), 4)
  const meanKeypressesPerMeasure = round(
    totalKeypressCount / (lags + nonLags),
    4
  )

  const release = getMeta('ol-ExposedSettings')?.sentryRelease || null

  return {
    numberOfEntries: durations.length,
    meanKeypressPaint,
    grammarly,
    sessionLength,
    memory,
    lags,
    nonLags,
    longestLag,
    meanLagsPerMeasure,
    meanKeypressesPerMeasure,
    release,
  }
}

window._reportAcePerf = () => {
  debugConsole.warn(reportAcePerf())
}
