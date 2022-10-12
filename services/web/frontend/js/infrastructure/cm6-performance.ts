import { Transaction } from '@codemirror/state'

const TIMER_START_NAME = 'CM6-BeforeUpdate'
const TIMER_END_NAME = 'CM6-AfterUpdate'
const TIMER_MEASURE_NAME = 'CM6-Update'

let latestDocLength = 0

export function timedDispatch(dispatchFn: (tr: Transaction) => void) {
  return (tr: Transaction) => {
    performance.mark(TIMER_START_NAME)

    dispatchFn(tr)

    performance.mark(TIMER_END_NAME)

    if (tr.isUserEvent('input')) {
      performance.measure(TIMER_MEASURE_NAME, TIMER_START_NAME, TIMER_END_NAME)
    }

    latestDocLength = tr.state.doc.length
  }
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

export function reportCM6Perf() {
  // Get entries triggered by keystrokes
  const cm6Entries = performance.getEntriesByName(
    TIMER_MEASURE_NAME,
    'measure'
  ) as PerformanceMeasure[]

  const inputDurations = cm6Entries
    .map(({ duration }) => duration)
    .sort((a, b) => a - b)

  const max = inputDurations.reduce((a, b) => Math.max(a, b), 0)
  const mean = calculateMean(inputDurations)
  const median = calculateMedian(inputDurations)
  const ninetyFifthPercentile = calculate95thPercentile(inputDurations)

  performance.clearMeasures(TIMER_MEASURE_NAME)

  return {
    max,
    mean,
    median,
    ninetyFifthPercentile,
    docLength: latestDocLength,
    numberOfEntries: inputDurations.length,
  }
}

window._reportCM6Perf = () => {
  console.log(reportCM6Perf())
}
