/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { Project } = require('../../models/Project')
const logger = require('logger-sharelatex')
const _ = require('underscore')
const settings = require('settings-sharelatex')

const safeCompilers = ['xelatex', 'pdflatex', 'latex', 'lualatex']

module.exports = {
  setCompiler(project_id, compiler, callback) {
    if (callback == null) {
      callback = function() {}
    }
    logger.log({ project_id, compiler }, 'setting the compiler')
    compiler = compiler.toLowerCase()
    if (!_.contains(safeCompilers, compiler)) {
      return callback()
    }
    const conditions = { _id: project_id }
    const update = { compiler }
    return Project.update(conditions, update, {}, function(err) {
      if (callback != null) {
        return callback()
      }
    })
  },

  setImageName(project_id, imageName, callback) {
    if (callback == null) {
      callback = function() {}
    }
    logger.log({ project_id, imageName }, 'setting the imageName')
    imageName = imageName.toLowerCase()
    if (
      !_.some(
        settings.allowedImageNames,
        allowed => imageName === allowed.imageName
      )
    ) {
      return callback()
    }
    const conditions = { _id: project_id }
    const update = { imageName: settings.imageRoot + '/' + imageName }
    return Project.update(conditions, update, {}, function(err) {
      if (callback != null) {
        return callback()
      }
    })
  },

  setSpellCheckLanguage(project_id, languageCode, callback) {
    if (callback == null) {
      callback = function() {}
    }
    logger.log({ project_id, languageCode }, 'setting the spell check language')
    let languageIsSafe = false
    settings.languages.forEach(function(safeLang) {
      if (safeLang.code === languageCode) {
        return (languageIsSafe = true)
      }
    })

    if (languageCode === '') {
      languageIsSafe = true
    }

    if (languageIsSafe) {
      const conditions = { _id: project_id }
      const update = { spellCheckLanguage: languageCode }
      return Project.update(conditions, update, {}, err => callback())
    } else {
      logger.err({ project_id, languageCode }, 'tryed to set unsafe language')
      return callback()
    }
  },

  setBrandVariationId(project_id, brandVariationId, callback) {
    if (callback == null) {
      callback = function() {}
    }
    logger.log(
      { project_id, brandVariationId },
      'setting the brand variation id'
    )
    if (brandVariationId == null || brandVariationId === '') {
      return callback()
    }
    const conditions = { _id: project_id }
    const update = { brandVariationId }
    return Project.update(conditions, update, {}, function(err) {
      if (err != null) {
        logger.err({ err }, 'error setting brandVariationId')
      }
      return callback()
    })
  },

  unsetBrandVariationId(project_id, callback) {
    if (callback == null) {
      callback = function() {}
    }
    logger.log({ project_id }, 'unsetting the brand variation id')
    const conditions = { _id: project_id }
    const update = { $unset: { brandVariationId: 1 } }
    return Project.update(conditions, update, {}, function(err) {
      if (err != null) {
        logger.warn({ err }, 'error unsetting brandVariationId')
        return callback(err)
      }
      return callback()
    })
  }
}
