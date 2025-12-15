const logger = require('@overleaf/logger')
const { expressify } = require('@overleaf/promise-utils')
const { mongodb } = require('../../storage')

async function status(req, res) {
  try {
    await mongodb.db.command({ ping: 1 })
  } catch (err) {
    logger.warn({ err }, 'Lost connection with MongoDB')
    res.status(500).send('Lost connection with MongoDB')
    return
  }
  res.send('history-v1 is up')
}

function healthCheck(req, res) {
  res.send('OK')
}

module.exports = {
  status: expressify(status),
  healthCheck,
}
