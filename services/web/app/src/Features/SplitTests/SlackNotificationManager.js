const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const { IncomingWebhook } = require('@slack/webhook')
const moment = require('moment')
const SplitTestUtils = require('./SplitTestUtils')

async function sendNotification(splitTest, action, user) {
  const lastVersion = SplitTestUtils.getCurrentVersion(splitTest)
  const url = lastVersion.analyticsEnabled
    ? Settings.splitTest.notification.splitTestSlackWebhookUrl
    : Settings.splitTest.notification.gradualRolloutSlackWebhookUrl
  if (!url) {
    logger.info('Skipping slack notification as webhook URL is not configured')
    return
  }

  const webhook = new IncomingWebhook(url)

  const defaultRolloutPercent =
    100 -
    lastVersion.variants.reduce(
      (total, variant) => total + variant.rolloutPercent,
      0
    )
  const variantsConfig = [
    `- default: ${defaultRolloutPercent}%`,
    ...lastVersion.variants.map(
      variant => `- ${variant.name}: ${variant.rolloutPercent}%`
    ),
  ].join('\n')

  const date = splitTest.archived ? splitTest.archivedAt : lastVersion.createdAt
  const comment =
    action !== 'archived' && lastVersion.comment
      ? `with comment: ${lastVersion.comment}`
      : ''

  const payload = {
    name: splitTest.name,
    action,
    phase: lastVersion.phase,
    description: splitTest.description,
    ticketURL: splitTest.ticketUrl,
    variantsConfig,
    active: lastVersion.active.toString(),
    author: user.email,
    date: moment(date).utc().format('Do MMM YYYY, h:mm a') + ' UTC',
    comment,
    versionNumber: `${lastVersion.versionNumber}`,
    url: `${Settings.siteUrl}/admin/split-test/edit/${splitTest.name}`,
  }
  try {
    const { send: sendPayload } = webhook // workaround for the lint_flag_res_send_usage rule false-positive
    await sendPayload.call(webhook, payload)
  } catch (err) {
    logger.error(
      { err },
      'Failed to notify split test notifications Slack webhook'
    )
  }
}

module.exports = {
  sendNotification,
}
