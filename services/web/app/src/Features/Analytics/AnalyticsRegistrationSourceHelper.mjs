import AnalyticsManager from './AnalyticsManager.mjs'
import RequestHelper from './RequestHelper.mjs'

function clearSource(session) {
  if (session) {
    delete session.required_login_from_product_medium
    delete session.required_login_from_product_source
  }
}

function setInbound(session, url, query, referrer) {
  const inboundSession = {
    referrer: RequestHelper.parseReferrer(referrer, url),
    utm: RequestHelper.parseUtm(query),
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

function addUserProperties(user, session) {
  if (!session) {
    return
  }

  if (session.required_login_from_product_medium) {
    AnalyticsManager.setUserPropertyForMongoUserInBackground(
      user,
      `registered-from-product-medium`,
      session.required_login_from_product_medium
    )
    if (session.required_login_from_product_source) {
      AnalyticsManager.setUserPropertyForMongoUserInBackground(
        user,
        `registered-from-product-source`,
        session.required_login_from_product_source
      )
    }
  } else if (session.referal_id) {
    AnalyticsManager.setUserPropertyForMongoUserInBackground(
      user,
      `registered-from-bonus-scheme`,
      true
    )
    AnalyticsManager.setUserPropertyForMongoUserInBackground(
      user,
      `registered-from-product-medium`,
      'bonus-scheme'
    )
  }

  if (session.inbound) {
    if (session.inbound.referrer && session.inbound.referrer.medium) {
      AnalyticsManager.setUserPropertyForMongoUserInBackground(
        user,
        `registered-from-referrer-medium`,
        `${session.inbound.referrer.medium
          .charAt(0)
          .toUpperCase()}${session.inbound.referrer.medium.slice(1)}`
      )
      if (session.inbound.referrer.source) {
        AnalyticsManager.setUserPropertyForMongoUserInBackground(
          user,
          `registered-from-referrer-source`,
          session.inbound.referrer.source
        )
      }
    }

    if (session.inbound.utm) {
      for (const utmKey of RequestHelper.REGISTRATION_UTM_KEYS) {
        if (session.inbound.utm[utmKey]) {
          AnalyticsManager.setUserPropertyForMongoUserInBackground(
            user,
            `registered-from-${utmKey.replace('_', '-')}`,
            session.inbound.utm[utmKey]
          )
        }
      }
    }
  }
}

export default {
  clearSource,
  setInbound,
  clearInbound,
  addUserProperties,
}
