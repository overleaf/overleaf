// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import crypto from 'node:crypto'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'

// The "state" of a project is a hash of the relevant attributes in the
// project object in this case we only need the rootFolder.
//
// The idea is that it will change if any doc or file is
// created/renamed/deleted, and also if the content of any file (not
// doc) changes.
//
// When the hash changes the full set of files on the CLSI will need to
// be updated.  If it doesn't change then we can overwrite changed docs
// in place on the clsi, getting them from the docupdater.
//
// The docupdater is responsible for setting the key in redis, and
// unsetting it if it removes any documents from the doc updater.

const buildState = s =>
  crypto.createHash('sha1').update(s, 'utf8').digest('hex')

export default {
  computeHash(project, options) {
    const { docs, files } =
      ProjectEntityHandler.getAllEntitiesFromProject(project)
    const fileList = Array.from(files || []).map(
      f => `${f.file._id}:${f.file.rev}:${f.file.created}:${f.path}`
    )
    const docList = Array.from(docs || []).map(d => `${d.doc._id}:${d.path}`)
    const sortedEntityList = [
      ...Array.from(docList),
      ...Array.from(fileList),
    ].sort()
    // ignore the isAutoCompile options as it doesn't affect the
    // output, but include all other options e.g. draft
    const optionsList = (() => {
      const result = []
      const object = options || {}
      for (const key in object) {
        const value = object[key]
        if (!['isAutoCompile', 'buildId'].includes(key)) {
          result.push(`option ${key}:${value}`)
        }
      }
      return result
    })()
    const sortedOptionsList = optionsList.sort()
    const hash = buildState(
      [...Array.from(sortedEntityList), ...Array.from(sortedOptionsList)].join(
        '\n'
      )
    )
    return hash
  },
}
