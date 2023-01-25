import { Transaction } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { round } from 'lodash'
import grammarlyExtensionPresent from '../shared/utils/grammarly'
import getMeta from '../utils/meta'

const TIMER_START_NAME = 'CM6-BeforeUpdate'
const TIMER_END_NAME = 'CM6-AfterUpdate'
const TIMER_DOM_UPDATE_NAME = 'CM6-DomUpdate'
const TIMER_MEASURE_NAME = 'CM6-Update'
const TIMER_KEYPRESS_MEASURE_NAME = 'CM6-Keypress-Measure'

let latestDocLength = 0
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

let performanceLongtaskSupported = false
let longTaskSinceLastReportCount = 0

// Detect support for long task monitoring
try {
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    performanceLongtaskSupported = true

    // Register observer for long task notifications
    const observer = new PerformanceObserver(list => {
      longTaskSinceLastReportCount += list.getEntries().length
    })
    observer.observe({ entryTypes: ['longtask'] })
  }
} catch (e) {}

function isInputOrDelete(userEventType: string | undefined) {
  return (
    !!userEventType && ['input', 'delete'].includes(userEventType.split('.')[0])
  )
}

// "keypress" is not strictly accurate; what we really mean is a user-initiated
// event that either inserts or deletes exactly one character. This corresponds
// to CM6 user event types input.type, delete.forward or delete.backward
function isKeypress(userEventType: string | undefined) {
  return (
    !!userEventType &&
    ['input.type', 'delete.forward', 'delete.backward'].includes(userEventType)
  )
}

export function dispatchTimer(): {
  start: (tr: Transaction) => void
  end: (tr: Transaction, view: EditorView) => void
} {
  if (!performanceOptionsSupport) {
    return { start: () => {}, end: () => {} }
  }

  let userEventsSinceDomUpdateCount = 0
  let keypressesSinceDomUpdateCount = 0
  const unpaintedKeypressStartTimes: number[] = []

  const start = (tr: Transaction) => {
    const userEventType = tr.annotation(Transaction.userEvent)

    if (isKeypress(userEventType)) {
      unpaintedKeypressStartTimes.push(performance.now())
    }

    performance.mark(TIMER_START_NAME)
  }

  const end = (tr: Transaction, view: EditorView) => {
    performance.mark(TIMER_END_NAME)

    const userEventType = tr.annotation(Transaction.userEvent)

    if (isInputOrDelete(userEventType)) {
      ++userEventsSinceDomUpdateCount

      if (isKeypress(userEventType)) {
        ++keypressesSinceDomUpdateCount
      }

      performance.measure(TIMER_MEASURE_NAME, {
        start: TIMER_START_NAME,
        end: TIMER_END_NAME,
        detail: { userEventType, userEventsSinceDomUpdateCount },
      })

      // The `key` property ensures that the measurement task is only run once
      // per measure phase
      view.requestMeasure({
        key: 'inputEventCounter',
        read() {
          performance.mark(TIMER_DOM_UPDATE_NAME, {
            detail: { keypressesSinceDomUpdateCount },
          })
          userEventsSinceDomUpdateCount = 0
          keypressesSinceDomUpdateCount = 0

          const keypressEnd = performance.now()

          for (const keypressStart of unpaintedKeypressStartTimes) {
            performance.measure(TIMER_KEYPRESS_MEASURE_NAME, {
              start: keypressStart,
              end: keypressEnd,
            })
          }
          unpaintedKeypressStartTimes.length = 0
        },
      })
    }

    latestDocLength = tr.state.doc.length
  }

  return { start, end }
}

function calculateMean(durations: number[]) {
  if (durations.length === 0) return 0

  const sum = durations.reduce((acc, entry) => acc + entry, 0)
  return sum / durations.length
}

function calculateMedian(sortedDurations: number[]) {
  if (sortedDurations.length === 0) return 0

  const middle = Math.floor(sortedDurations.length / 2)

  if (sortedDurations.length % 2 === 0) {
    return (sortedDurations[middle - 1] + sortedDurations[middle]) / 2
  }
  return sortedDurations[middle]
}

function calculate95thPercentile(sortedDurations: number[]) {
  if (sortedDurations.length === 0) return 0

  const index = Math.round((sortedDurations.length - 1) * 0.95)
  return sortedDurations[index]
}

function calculateMax(numbers: number[]) {
  return numbers.reduce((a, b) => Math.max(a, b), 0)
}

function clearCM6Perf(type: string) {
  switch (type) {
    case 'measure':
      performance.clearMeasures(TIMER_MEASURE_NAME)
      performance.clearMarks(TIMER_START_NAME)
      performance.clearMarks(TIMER_END_NAME)
      break

    case 'dom':
      performance.clearMarks(TIMER_DOM_UPDATE_NAME)
      break

    case 'keypress':
      performance.clearMeasures(TIMER_KEYPRESS_MEASURE_NAME)
      break
  }
}

// clear performance measures and marks when switching between Source and Rich Text
window.addEventListener('editor:visual-switch', () => {
  clearCM6Perf('measure')
  clearCM6Perf('dom')
  clearCM6Perf('keypress')
})

export function reportCM6Perf() {
  // Get entries triggered by keystrokes
  const cm6Entries = performance.getEntriesByName(
    TIMER_MEASURE_NAME,
    'measure'
  ) as PerformanceMeasure[]

  clearCM6Perf('measure')

  const inputEvents = cm6Entries.filter(({ detail }) =>
    isInputOrDelete(detail.userEventType)
  )

  const inputDurations = inputEvents
    .map(({ duration }) => duration)
    .sort((a, b) => a - b)

  const max = round(calculateMax(inputDurations), 2)
  const mean = round(calculateMean(inputDurations), 2)
  const median = round(calculateMedian(inputDurations), 2)
  const ninetyFifthPercentile = round(
    calculate95thPercentile(inputDurations),
    2
  )
  const maxUserEventsBetweenDomUpdates = calculateMax(
    inputEvents.map(e => e.detail.userEventsSinceDomUpdateCount)
  )
  const grammarly = grammarlyExtensionPresent()
  const sessionLength = Math.floor((Date.now() - sessionStart) / 1000) // In seconds

  const memory = performanceMemorySupport ? measureMemoryUsage() : null

  // Get entries for keypress counts between DOM updates
  const domUpdateEntries = performance.getEntriesByName(
    TIMER_DOM_UPDATE_NAME,
    'mark'
  ) as PerformanceMark[]

  clearCM6Perf('dom')

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

  // Get entries triggered by keystrokes
  const keypressPaintEntries = performance.getEntriesByName(
    TIMER_KEYPRESS_MEASURE_NAME,
    'measure'
  ) as PerformanceMeasure[]

  const keypressPaintDurations = keypressPaintEntries.map(
    ({ duration }) => duration
  )

  const meanKeypressPaint = round(calculateMean(keypressPaintDurations), 2)

  clearCM6Perf('keypress')

  let longTasks = null

  // Get long task entries (Chromium-based browsers only at time of writing)
  if (performanceLongtaskSupported) {
    longTasks = longTaskSinceLastReportCount
    longTaskSinceLastReportCount = 0
  }

  const release = getMeta('ol-ExposedSettings')?.sentryRelease || null

  return {
    max,
    mean,
    median,
    ninetyFifthPercentile,
    maxUserEventsBetweenDomUpdates,
    docLength: latestDocLength,
    numberOfEntries: inputDurations.length,
    grammarly,
    sessionLength,
    memory,
    lags,
    nonLags,
    longestLag,
    meanLagsPerMeasure,
    meanKeypressesPerMeasure,
    meanKeypressPaint,
    longTasks,
    release,
  }
}

window._reportCM6Perf = () => {
  console.log(reportCM6Perf())
}
