/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-cond-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MetaHandler
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const packageMapping = require('./packageMapping')

module.exports = MetaHandler = {
  labelRegex() {
    return /\\label{(.{0,80}?)}/g
  },

  usepackageRegex() {
    return /^\\usepackage(?:\[.{0,80}?])?{(.{0,80}?)}/g
  },

  ReqPackageRegex() {
    return /^\\RequirePackage(?:\[.{0,80}?])?{(.{0,80}?)}/g
  },

  getAllMetaForProject(projectId, callback) {
    if (callback == null) {
      callback = function(err, projectMeta) {}
    }
    return DocumentUpdaterHandler.flushProjectToMongo(projectId, function(err) {
      if (err != null) {
        return callback(err)
      }
      return ProjectEntityHandler.getAllDocs(projectId, function(err, docs) {
        if (err != null) {
          return callback(err)
        }
        const projectMeta = MetaHandler.extractMetaFromProjectDocs(docs)
        return callback(null, projectMeta)
      })
    })
  },

  getMetaForDoc(projectId, docId, callback) {
    if (callback == null) {
      callback = function(err, docMeta) {}
    }
    return DocumentUpdaterHandler.flushDocToMongo(projectId, docId, function(
      err
    ) {
      if (err != null) {
        return callback(err)
      }
      return ProjectEntityHandler.getDoc(projectId, docId, function(
        err,
        lines
      ) {
        if (err != null) {
          return callback(err)
        }
        const docMeta = MetaHandler.extractMetaFromDoc(lines)
        return callback(null, docMeta)
      })
    })
  },

  extractMetaFromDoc(lines) {
    let pkg
    const docMeta = { labels: [], packages: {} }
    const packages = []
    const label_re = MetaHandler.labelRegex()
    const package_re = MetaHandler.usepackageRegex()
    const req_package_re = MetaHandler.ReqPackageRegex()
    for (let line of Array.from(lines)) {
      var labelMatch
      var clean, messy, packageMatch
      while ((labelMatch = label_re.exec(line))) {
        var label
        if ((label = labelMatch[1])) {
          docMeta.labels.push(label)
        }
      }
      while ((packageMatch = package_re.exec(line))) {
        if ((messy = packageMatch[1])) {
          for (pkg of Array.from(messy.split(','))) {
            if ((clean = pkg.trim())) {
              packages.push(clean)
            }
          }
        }
      }
      while ((packageMatch = req_package_re.exec(line))) {
        if ((messy = packageMatch[1])) {
          for (pkg of Array.from(messy.split(','))) {
            if ((clean = pkg.trim())) {
              packages.push(clean)
            }
          }
        }
      }
    }
    for (pkg of Array.from(packages)) {
      if (packageMapping[pkg] != null) {
        docMeta.packages[pkg] = packageMapping[pkg]
      }
    }
    return docMeta
  },

  extractMetaFromProjectDocs(projectDocs) {
    const projectMeta = {}
    for (let _path in projectDocs) {
      const doc = projectDocs[_path]
      projectMeta[doc._id] = MetaHandler.extractMetaFromDoc(doc.lines)
    }
    return projectMeta
  }
}
