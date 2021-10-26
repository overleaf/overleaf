const RefererParser = require('referer-parser')
const { URL } = require('url')
const AnalyticsManager = require('./AnalyticsManager')

function clearSource(session) {
  if (session) {
    delete session.required_login_from_product_medium
    delete session.required_login_from_product_source
  }
}

const UTM_KEYS = [
  'utm_campaign',
  'utm_source',
  'utm_term',
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

function setInbound(session, url, query, referrer) {
  const inboundSession = {
    referrer: parseReferrer(referrer, url),
    utm: parseUtm(query),
  }

  if (inboundSession.referrer || inboundSession.utm) {
    session.inbound = inboundSession
  }
}

function clearInbound(session) {
  if (session) {
    delete session.inbound
  }
}

function addUserProperties(userId, session) {
  if (!session) {
    return
  }

  if (session.required_login_from_product_medium) {
    AnalyticsManager.setUserPropertyForUser(
      userId,
      `registered-from-product-medium`,
      session.required_login_from_product_medium
    )
    if (session.required_login_from_product_source) {
      AnalyticsManager.setUserPropertyForUser(
        userId,
        `registered-from-product-source`,
        session.required_login_from_product_source
      )
    }
  } else if (session.referal_id) {
    AnalyticsManager.setUserPropertyForUser(
      userId,
      `registered-from-bonus-scheme`,
      true
    )
    AnalyticsManager.setUserPropertyForUser(
      userId,
      `registered-from-product-medium`,
      'bonus-scheme'
    )
  }

  if (session.inbound) {
    if (session.inbound.referrer && session.inbound.referrer.medium) {
      AnalyticsManager.setUserPropertyForUser(
        userId,
        `registered-from-referrer-medium`,
        `${session.inbound.referrer.medium
          .charAt(0)
          .toUpperCase()}${session.inbound.referrer.medium.slice(1)}`
      )
      if (session.inbound.referrer.source) {
        AnalyticsManager.setUserPropertyForUser(
          userId,
          `registered-from-referrer-source`,
          session.inbound.referrer.source
        )
      }
    }

    if (session.inbound.utm) {
      for (const utmKey of UTM_KEYS) {
        if (session.inbound.utm[utmKey]) {
          AnalyticsManager.setUserPropertyForUser(
            userId,
            `registered-from-${utmKey.replace('_', '-')}`,
            session.inbound.utm[utmKey]
          )
        }
      }
    }
  }
}

module.exports = {
  clearSource,
  setInbound,
  clearInbound,
  addUserProperties,
}
