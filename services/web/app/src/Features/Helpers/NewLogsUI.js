const { ObjectId } = require('mongodb')
const Settings = require('@overleaf/settings')

const EXISTING_UI = { newLogsUI: false, subvariant: null }
const NEW_UI_WITH_POPUP = {
  newLogsUI: true,
  subvariant: 'new-logs-ui-with-popup',
}
const NEW_UI_WITHOUT_POPUP = {
  newLogsUI: true,
  subvariant: 'new-logs-ui-without-popup',
}

function _getVariantForPercentile(percentile) {
  // The current percentages are:
  // - 33% New UI with pop-up (originally, 5%)
  // - 33% New UI without pop-up (originally, 5%)
  // - 34% Existing UI
  // To ensure group stability, the implementation below respects the original partitions
  // for the new UI variants: [0, 5[ and [5,10[.
  // Two new partitions are added: [10, 38[ and [38, 66[. These represent an extra 28p.p.
  // which, with to the original 5%, add up to 33%.

  if (percentile < 5) {
    // This partition represents the "New UI with pop-up" group in the original roll-out (5%)
    return NEW_UI_WITH_POPUP
  } else if (percentile >= 5 && percentile < 10) {
    // This partition represents the "New UI without pop-up" group in the original roll-out (5%)
    return NEW_UI_WITHOUT_POPUP
  } else if (percentile >= 10 && percentile < 38) {
    // This partition represents an extra 28% of users getting the "New UI with pop-up"
    return NEW_UI_WITH_POPUP
  } else if (percentile >= 38 && percentile < 66) {
    // This partition represents an extra 28% of users getting the "New UI without pop-up"
    return NEW_UI_WITHOUT_POPUP
  } else {
    return EXISTING_UI
  }
}

// eslint-disable-next-line no-unused-vars
function getNewLogsUIVariantForUser(user) {
  const { _id: userId, alphaProgram: isAlphaUser } = user
  const isSaaS = Boolean(Settings.overleaf)

  if (!userId || !isSaaS) {
    return EXISTING_UI
  }

  const userIdAsPercentile = (ObjectId(userId).getTimestamp() / 1000) % 100

  if (isAlphaUser) {
    return NEW_UI_WITH_POPUP
  } else {
    return _getVariantForPercentile(userIdAsPercentile)
  }
}

module.exports = {
  // We're disabling the split tests while rolling out the PDF Preview
  // https://github.com/overleaf/internal/issues/5553
  getNewLogsUIVariantForUser: () => EXISTING_UI,
}
