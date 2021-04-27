const { ObjectId } = require('mongodb')
const Settings = require('settings-sharelatex')

const EXISTING_UI = { newLogsUI: false, subvariant: null }
const NEW_UI_WITH_POPUP = {
  newLogsUI: true,
  subvariant: 'new-logs-ui-with-popup',
}
const NEW_UI_WITHOUT_POPUP = {
  newLogsUI: true,
  subvariant: 'new-logs-ui-without-popup',
}

function _getVariantForPercentile(
  percentile,
  newLogsUIWithPopupPercentage,
  newLogsUIWithoutPopupPercentage
) {
  // The thresholds below are upper thresholds
  const newLogsUIThreshold = newLogsUIWithPopupPercentage
  const newLogsUIWithoutPopupThreshold =
    newLogsUIWithPopupPercentage + newLogsUIWithoutPopupPercentage

  // The partitions for each of the variants (range is 0 to 99) are defined as:
  // * New UI with pop-up: 0 to newLogsUIThreshold (exc)
  // * New UI without pop-up: newLogsUIThreshold (inc) to newLogsUIWithoutPopupThreshold (exc)
  // * Existing UI: newLogsUIWithoutPopupThreshold (inc) to 99
  if (percentile < newLogsUIThreshold) {
    return NEW_UI_WITH_POPUP
  } else if (
    percentile >= newLogsUIThreshold &&
    percentile < newLogsUIWithoutPopupThreshold
  ) {
    return NEW_UI_WITHOUT_POPUP
  } else {
    return EXISTING_UI
  }
}

function getNewLogsUIVariantForUser(user) {
  const {
    _id: userId,
    alphaProgram: isAlphaUser,
    betaProgram: isBetaUser,
  } = user
  if (!userId) {
    return EXISTING_UI
  }

  const userIdAsPercentile = (ObjectId(userId).getTimestamp() / 1000) % 100

  if (isAlphaUser) {
    return NEW_UI_WITH_POPUP
  } else if (isBetaUser) {
    return _getVariantForPercentile(
      userIdAsPercentile,
      Settings.logsUIPercentageBeta,
      Settings.logsUIPercentageWithoutPopupBeta
    )
  } else {
    return _getVariantForPercentile(
      userIdAsPercentile,
      Settings.logsUIPercentage,
      Settings.logsUIPercentageWithoutPopup
    )
  }
}

module.exports = {
  getNewLogsUIVariantForUser,
}
