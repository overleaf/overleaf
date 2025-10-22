import RefererParser from 'referer-parser'
import { URL } from 'node:url'

const UTM_KEYS = [
  'utm_campaign',
  'utm_source',
  'utm_term',
  'utm_content',
  'utm_medium',
  'utm_count',
]

function parseUtm(query) {
  const utmValues = {}
  for (const utmKey of UTM_KEYS) {
    if (query[utmKey]) {
      utmValues[utmKey] = query[utmKey]
    }
  }
  return Object.keys(utmValues).length > 0 ? utmValues : null
}

function parseReferrer(referrer, url) {
  if (!referrer) {
    return {
      medium: 'direct',
    }
  }

  const parsedReferrer = new RefererParser(referrer, url)

  const referrerValues = {
    medium: parsedReferrer.medium,
    source: parsedReferrer.referer || 'other',
  }

  if (referrerValues.medium === 'unknown') {
    try {
      const referrerHostname = new URL(referrer).hostname
      if (referrerHostname) {
        referrerValues.medium = 'link'
        referrerValues.source = referrerHostname
      }
    } catch (error) {
      // ignore referrer parsing errors
    }
  }

  return referrerValues
}

export default {
  UTM_KEYS,
  parseUtm,
  parseReferrer,
}
