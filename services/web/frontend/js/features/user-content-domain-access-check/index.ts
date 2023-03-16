import {
  checkChunkResponse,
  estimateSizeOfMultipartResponse,
  getMultipartBoundary,
  resolveMultiPartResponses,
} from '../pdf-preview/util/pdf-caching'
import getMeta from '../../utils/meta'
import OError from '@overleaf/o-error'
import { captureException } from '../../infrastructure/error-reporter'
import { postJSON } from '../../infrastructure/fetch-json'
import {
  isSplitTestEnabled,
  parseIntFromSplitTest,
} from '../../utils/splitTestUtils'

const MAX_CHECKS_PER_PAGE_LOAD = parseIntFromSplitTest(
  'user-content-domain-access-check-max-checks',
  3
)
const INITIAL_DELAY_MS = parseIntFromSplitTest(
  'user-content-domain-access-check-delay',
  30_000
)
const TIMEOUT_MS = 30_000
const FULL_SIZE = 739
const FULL_HASH =
  'b7d25591c18da373709d3d88ddf5eeab0b5089359e580f051314fd8935df0b73'
const CHUNKS = [
  {
    start: 0,
    end: 21,
    hash: 'd2ad9cbf1bc669646c0dfc43fa3167d30ab75077bb46bc9e3624b9e7e168abc2',
  },
  {
    start: 21,
    end: 42,
    hash: 'd6d110ec0f3f4e27a4050bc2be9c5552cc9092f86b74fec75072c2c9e8483454',
  },
  {
    start: 42,
    end: 64,
    hash: '8278914487a3a099c9af5aa22ed836d6587ca0beb7bf9a059fb0409667b3eb3d',
  },
]

function pickZone() {
  const x = Math.random()
  switch (true) {
    case x > 0.66:
      return 'b'
    case x > 0.33:
      return 'c'
    default:
      return 'd'
  }
}

function arrayLikeToHex(a: Uint8Array) {
  return Array.from(a)
    .map(i => i.toString(16).padStart(2, '0'))
    .join('')
}

async function hashBody(body: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', body)
  return arrayLikeToHex(new Uint8Array(digest))
}

async function checkHash(
  res: Response,
  data: ArrayBuffer,
  expectedHash: string
) {
  const actualHash = await hashBody(data)
  if (actualHash !== expectedHash) {
    throw new OError('content hash mismatch', {
      actualHash,
      expectedHash,
      headers: Object.fromEntries(res.headers.entries()),
    })
  }
}

function randomHex(bytes: number) {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return arrayLikeToHex(buf)
}

function genBuildId() {
  const date = Date.now().toString(16)
  const random = randomHex(8)
  return `${date}-${random}`
}

async function singleCheck(
  url: string,
  init: RequestInit,
  estimatedSize: number,
  expectedHash: string,
  chunks?: Array<any>
) {
  const ac = new AbortController()
  setTimeout(() => ac.abort(), TIMEOUT_MS)
  init.signal = ac.signal
  init.cache = 'no-store'

  const res = await fetch(url, init)
  checkChunkResponse(res, estimatedSize, init)

  const body = await res.arrayBuffer()
  if (chunks) {
    const boundary = getMultipartBoundary(res, chunks)
    const parts = resolveMultiPartResponses({
      file: { size: FULL_SIZE },
      chunks,
      data: new Uint8Array(body),
      boundary,
      metrics: {},
    })
    for (const part of parts) {
      await checkHash(res, part.data, part.chunk.hash)
    }
  } else {
    await checkHash(res, body, expectedHash)
  }
}

export async function checkUserContentDomainAccess(
  compileDomainOrigin: string
) {
  // Note: The ids are zero prefixed. No actual user/project uses these ids.
  // mongo-id 000000000000000000000000 -> 1970-01-01T00:00:00.000Z
  // mongo-id 000000010000000000000000 -> 1970-01-01T00:00:01.000Z
  // mongo-id 100000000000000000000000 -> 1978-07-04T21:24:16.000Z
  // This allows us to distinguish between check-traffic and regular output
  //  traffic.
  const projectId = `0${randomHex(12).slice(1)}`
  const userId = `0${randomHex(12).slice(1)}`
  const buildId = genBuildId()
  const zone = pickZone()
  const urls = []
  if (getMeta('ol-user_id')) {
    // Logged-in user
    urls.push(
      `${compileDomainOrigin}/zone/${zone}/project/${projectId}/user/${userId}/build/${buildId}/output/output.pdf`
    )
  } else {
    // Anonymous user
    urls.push(
      `${compileDomainOrigin}/zone/${zone}/project/${projectId}/build/${buildId}/output/output.pdf`
    )
  }

  const cases = []
  for (const url of urls) {
    // full download
    cases.push({
      url,
      init: {},
      estimatedSize: FULL_SIZE,
      hash: FULL_HASH,
    })

    // range request
    const chunk = CHUNKS[0]
    cases.push({
      url,
      init: {
        headers: {
          Range: `bytes=${chunk.start}-${chunk.end - 1}`,
        },
      },
      estimatedSize: chunk.end - chunk.start,
      hash: chunk.hash,
    })

    // multipart request
    cases.push({
      url,
      init: {
        headers: {
          Range: `bytes=${CHUNKS.map(c => `${c.start}-${c.end - 1}`).join(
            ','
          )}`,
        },
      },
      estimatedSize: estimateSizeOfMultipartResponse(CHUNKS),
      hash: chunk.hash,
      chunks: CHUNKS,
    })
  }

  let failed = 0
  let ignoreResult = false
  const epochBeforeCheck = networkEpoch
  await Promise.all(
    cases.map(async ({ url, init, estimatedSize, hash, chunks }) => {
      try {
        await singleCheck(url, init, estimatedSize, hash, chunks)
      } catch (err: any) {
        if (!navigator.onLine || epochBeforeCheck !== networkEpoch) {
          // It is very likely that the request failed because we are offline or
          //  the network connection changed just now.
          ignoreResult = true
        }
        if (ignoreResult) return

        failed++
        OError.tag(err, 'user-content-domain-access-check failed', {
          url,
          init,
        })
        if (
          isSplitTestEnabled('report-user-content-domain-access-check-error')
        ) {
          captureException(err, {
            tags: { compileDomain: new URL(compileDomainOrigin).hostname },
          })
        } else {
          console.error(OError.getFullStack(err), OError.getFullInfo(err))
        }
      }
    })
  )
  if (ignoreResult) return false

  try {
    await postJSON('/record-user-content-domain-access-check-result', {
      body: {
        failed,
        succeeded: cases.length - failed,
        isOldDomain:
          compileDomainOrigin === getMeta('ol-fallbackCompileDomain'),
      },
    })
  } catch (e) {}

  return failed === 0
}

const ACCESS_CHECK_PASSED = 'passed'
const ACCESS_CHECK_PENDING = 'pending'
const ACCESS_CHECK_FAILED = 'failed'
let accessCheckStatus = ACCESS_CHECK_PENDING

export function userContentDomainAccessCheckPassed() {
  return accessCheckStatus === ACCESS_CHECK_PASSED
}
export function userContentDomainAccessCheckFailed() {
  return accessCheckStatus === ACCESS_CHECK_FAILED
}

let networkEpoch = performance.now()
window.addEventListener('offline', () => {
  // We are offline. Abort any scheduled check.
  clearTimeout(lastScheduledCheck)
  accessCheckStatus = ACCESS_CHECK_PENDING
  networkEpoch = performance.now()
})
window.addEventListener('online', () => {
  // We are online again. Schedule another check for this network.
  accessCheckStatus = ACCESS_CHECK_PENDING
  networkEpoch = performance.now()
  scheduleUserContentDomainAccessCheck()
})
try {
  // Note: navigator.connection is not available on Firefox and Safari.
  // Docs: https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation
  navigator.connection.addEventListener('change', () => {
    // The network changed. Schedule another check for it.
    accessCheckStatus = ACCESS_CHECK_PENDING
    networkEpoch = performance.now()
    scheduleUserContentDomainAccessCheck()
  })
} catch (e) {}

let lastScheduledCheck: number
let remainingChecks = MAX_CHECKS_PER_PAGE_LOAD
export function scheduleUserContentDomainAccessCheck() {
  if (!isSplitTestEnabled('user-content-domain-access-check')) return
  clearTimeout(lastScheduledCheck)
  const networkEpochBeforeDelay = networkEpoch
  lastScheduledCheck = window.setTimeout(() => {
    if (!window.navigator.onLine || networkEpochBeforeDelay !== networkEpoch) {
      // Must be online for more than INITIAL_DELAY_MS before we check.
      // We want to avoid false-positives from flaky network connections.
      // Try again in INITIAL_DELAY_MS.
      return scheduleUserContentDomainAccessCheck()
    }
    if (userContentDomainAccessCheckPassed()) return
    if (remainingChecks === 0) {
      recordMaxAccessChecksHit()
    }
    if (remainingChecks-- <= 0) return
    if (isSplitTestEnabled('access-check-for-old-compile-domain')) {
      checkUserContentDomainAccess(getMeta('ol-fallbackCompileDomain')).catch(
        () => {}
      )
    }
    checkUserContentDomainAccess(getMeta('ol-compilesUserContentDomain'))
      .then(ok => {
        accessCheckStatus = ok ? ACCESS_CHECK_PASSED : ACCESS_CHECK_FAILED
      })
      .catch(err => {
        captureException(err)
      })
  }, INITIAL_DELAY_MS)
}

function recordMaxAccessChecksHit() {
  postJSON('/record-user-content-domain-max-access-checks-hit').catch(() => {})
}
