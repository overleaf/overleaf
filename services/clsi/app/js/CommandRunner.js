// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let commandRunnerPath
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')

if ((Settings.clsi != null ? Settings.clsi.dockerRunner : undefined) === true) {
  commandRunnerPath = './DockerRunner'
} else {
  commandRunnerPath = './LocalCommandRunner'
}
logger.debug({ commandRunnerPath }, 'selecting command runner for clsi')
const CommandRunner = require(commandRunnerPath)

module.exports = CommandRunner
