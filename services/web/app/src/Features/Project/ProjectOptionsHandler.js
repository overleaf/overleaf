const { Project } = require('../../models/Project')
const settings = require('@overleaf/settings')
const { callbackify } = require('util')
const { db, ObjectId } = require('../../infrastructure/mongodb')
const safeCompilers = ['xelatex', 'pdflatex', 'latex', 'lualatex']

const ProjectOptionsHandler = {
  async setCompiler(projectId, compiler) {
    if (!compiler) {
      return
    }
    compiler = compiler.toLowerCase()
    if (!safeCompilers.includes(compiler)) {
      throw new Error(`invalid compiler: ${compiler}`)
    }
    const conditions = { _id: projectId }
    const update = { compiler }
    return Project.updateOne(conditions, update, {})
  },

  async setImageName(projectId, imageName) {
    if (!imageName || !Array.isArray(settings.allowedImageNames)) {
      return
    }
    imageName = imageName.toLowerCase()
    const isAllowed = settings.allowedImageNames.find(
      allowed => imageName === allowed.imageName
    )
    if (!isAllowed) {
      throw new Error(`invalid imageName: ${imageName}`)
    }
    const conditions = { _id: projectId }
    const update = { imageName: settings.imageRoot + '/' + imageName }
    return Project.updateOne(conditions, update, {})
  },

  async setSpellCheckLanguage(projectId, languageCode) {
    if (!Array.isArray(settings.languages)) {
      return
    }
    const language = settings.languages.find(
      language => language.code === languageCode
    )
    if (languageCode && !language) {
      throw new Error(`invalid languageCode: ${languageCode}`)
    }
    const conditions = { _id: projectId }
    const update = { spellCheckLanguage: languageCode }
    return Project.updateOne(conditions, update, {})
  },

  async setBrandVariationId(projectId, brandVariationId) {
    if (!brandVariationId) {
      return
    }
    const conditions = { _id: projectId }
    const update = { brandVariationId }
    return Project.updateOne(conditions, update, {})
  },

  async unsetBrandVariationId(projectId) {
    const conditions = { _id: projectId }
    const update = { $unset: { brandVariationId: 1 } }
    return Project.updateOne(conditions, update, {})
  },

  async setHistoryRangesSupport(projectId, enabled) {
    const conditions = { _id: new ObjectId(projectId) }
    const update = {
      $set: { 'overleaf.history.rangesSupportEnabled': enabled },
    }
    // NOTE: Updating the Mongoose model with the same query doesn't work. Maybe
    // because rangesSupportEnabled is not part of the schema?
    return db.projects.updateOne(conditions, update)
  },
}

module.exports = {
  setCompiler: callbackify(ProjectOptionsHandler.setCompiler),
  setImageName: callbackify(ProjectOptionsHandler.setImageName),
  setSpellCheckLanguage: callbackify(
    ProjectOptionsHandler.setSpellCheckLanguage
  ),
  setBrandVariationId: callbackify(ProjectOptionsHandler.setBrandVariationId),
  unsetBrandVariationId: callbackify(
    ProjectOptionsHandler.unsetBrandVariationId
  ),
  setHistoryRangesSupport: callbackify(
    ProjectOptionsHandler.setHistoryRangesSupport
  ),
  promises: ProjectOptionsHandler,
}
