var RefererParser = require('referer-parser')
const { URL } = require('url')
const AnalyticsManager = require('./AnalyticsManager')

function clearSource(session) {
  if (session) {
    delete session.required_login_for
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
  var utmValues = {}
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
      detail: 'none',
    }
  }

  const parsedReferrer = new RefererParser(referrer, url)

  const referrerValues = {
    medium: parsedReferrer.medium,
    detail: parsedReferrer.referer,
  }

  if (referrerValues.medium === 'unknown') {
    try {
      const referrerHostname = new URL(referrer).hostname
      if (referrerHostname) {
        referrerValues.medium = 'link'
        referrerValues.detail = referrerHostname
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

  if (session.referal_id) {
    AnalyticsManager.setUserPropertyForUser(
      userId,
      `registered-from-bonus-scheme`,
      true
    )
  }

  if (session.required_login_for) {
    AnalyticsManager.setUserPropertyForUser(
      userId,
      `registered-from-${session.required_login_for}`,
      true
    )
  }

  if (session.inbound) {
    if (session.inbound.referrer) {
      AnalyticsManager.setUserPropertyForUser(
        userId,
        `registered-from-referrer-${session.inbound.referrer.medium}`,
        session.inbound.referrer.detail || 'other'
      )
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
