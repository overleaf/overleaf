// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
let commandRunnerPath

if ((Settings.clsi != null ? Settings.clsi.dockerRunner : undefined) === true) {
  commandRunnerPath = './DockerRunner.js'
} else {
  commandRunnerPath = './LocalCommandRunner.js'
}
logger.debug({ commandRunnerPath }, 'selecting command runner for clsi')
const CommandRunner = (await import(commandRunnerPath)).default

export default CommandRunner
