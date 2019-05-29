/* eslint-disable
    max-len,
*/
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
let ProjectEditorHandler
const _ = require('underscore')
const Path = require('path')

module.exports = ProjectEditorHandler = {
  trackChangesAvailable: false,

  buildProjectModelView(project, members, invites) {
    let owner, ownerFeatures
    const result = {
      _id: project._id,
      name: project.name,
      rootDoc_id: project.rootDoc_id,
      rootFolder: [this.buildFolderModelView(project.rootFolder[0])],
      publicAccesLevel: project.publicAccesLevel,
      dropboxEnabled: !!project.existsInDropbox,
      compiler: project.compiler,
      description: project.description,
      spellCheckLanguage: project.spellCheckLanguage,
      deletedByExternalDataSource: project.deletedByExternalDataSource || false,
      deletedDocs: project.deletedDocs,
      members: [],
      invites,
      tokens: project.tokens,
      imageName:
        project.imageName != null ? Path.basename(project.imageName) : undefined
    }

    if (result.invites == null) {
      result.invites = []
    }

    ;({ owner, ownerFeatures, members } = this.buildOwnerAndMembersViews(
      members
    ))
    result.owner = owner
    result.members = members

    result.features = _.defaults(ownerFeatures || {}, {
      collaborators: -1, // Infinite
      versioning: false,
      dropbox: false,
      compileTimeout: 60,
      compileGroup: 'standard',
      templates: false,
      references: false,
      referencesSearch: false,
      mendeley: false,
      trackChanges: false,
      trackChangesVisible: ProjectEditorHandler.trackChangesAvailable
    })

    // Originally these two feature flags were both signalled by the now-deprecated `references` flag.
    // For older users, the presence of the `references` feature flag should still turn on these features.
    result.features.referencesSearch =
      result.features.referencesSearch || result.features.references
    result.features.mendeley =
      result.features.mendeley || result.features.references

    return result
  },

  buildOwnerAndMembersViews(members) {
    let owner = null
    let ownerFeatures = null
    const filteredMembers = []
    for (let member of Array.from(members || [])) {
      if (member.privilegeLevel === 'owner') {
        ownerFeatures = member.user.features
        owner = this.buildUserModelView(member.user, 'owner')
      } else {
        filteredMembers.push(
          this.buildUserModelView(member.user, member.privilegeLevel)
        )
      }
    }
    return {
      owner,
      ownerFeatures,
      members: filteredMembers
    }
  },

  buildUserModelView(user, privileges) {
    return {
      _id: user._id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      privileges,
      signUpDate: user.signUpDate
    }
  },

  buildFolderModelView(folder) {
    let file
    const fileRefs = _.filter(folder.fileRefs || [], file => file != null)
    return {
      _id: folder._id,
      name: folder.name,
      folders: Array.from(folder.folders || []).map(childFolder =>
        this.buildFolderModelView(childFolder)
      ),
      fileRefs: (() => {
        const result = []
        for (file of Array.from(fileRefs)) {
          result.push(this.buildFileModelView(file))
        }
        return result
      })(),
      docs: Array.from(folder.docs || []).map(doc =>
        this.buildDocModelView(doc)
      )
    }
  },

  buildFileModelView(file) {
    return {
      _id: file._id,
      name: file.name,
      linkedFileData: file.linkedFileData,
      created: file.created
    }
  },

  buildDocModelView(doc) {
    return {
      _id: doc._id,
      name: doc.name
    }
  }
}
