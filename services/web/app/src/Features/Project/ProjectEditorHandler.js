let ProjectEditorHandler
const _ = require('lodash')
const Path = require('path')
const Features = require('../../infrastructure/Features')

function mergeDeletedDocs(a, b) {
  const docIdsInA = new Set(a.map(doc => doc._id.toString()))
  return a.concat(b.filter(doc => !docIdsInA.has(doc._id.toString())))
}

module.exports = ProjectEditorHandler = {
  trackChangesAvailable: false,

  buildProjectModelView(project, members, invites, deletedDocsFromDocstore) {
    let owner, ownerFeatures
    if (!Array.isArray(project.deletedDocs)) {
      project.deletedDocs = []
    }
    project.deletedDocs.forEach(doc => {
      // The frontend does not use this field.
      delete doc.deletedAt
    })
    const result = {
      _id: project._id,
      name: project.name,
      rootDoc_id: project.rootDoc_id,
      mainBibliographyDoc_id: project.mainBibliographyDoc_id,
      rootFolder: [this.buildFolderModelView(project.rootFolder[0])],
      publicAccesLevel: project.publicAccesLevel,
      dropboxEnabled: !!project.existsInDropbox,
      compiler: project.compiler,
      description: project.description,
      spellCheckLanguage: project.spellCheckLanguage,
      deletedByExternalDataSource: project.deletedByExternalDataSource || false,
      deletedDocs: mergeDeletedDocs(
        project.deletedDocs,
        deletedDocsFromDocstore
      ),
      members: [],
      invites: this.buildInvitesView(invites),
      imageName:
        project.imageName != null
          ? Path.basename(project.imageName)
          : undefined,
    }

    ;({ owner, ownerFeatures, members } =
      this.buildOwnerAndMembersViews(members))
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
      trackChangesVisible: ProjectEditorHandler.trackChangesAvailable,
      symbolPalette: false,
    })

    if (result.features.trackChanges) {
      result.trackChangesState = project.track_changes || false
    }

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
    for (const member of members || []) {
      if (member.privilegeLevel === 'owner') {
        ownerFeatures = member.user.features
        owner = this.buildUserModelView(member)
      } else {
        filteredMembers.push(this.buildUserModelView(member))
      }
    }
    return {
      owner,
      ownerFeatures,
      members: filteredMembers,
    }
  },

  buildUserModelView(member) {
    const user = member.user
    return {
      _id: user._id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      privileges: member.privilegeLevel,
      signUpDate: user.signUpDate,
      pendingEditor: member.pendingEditor,
    }
  },

  buildFolderModelView(folder) {
    const fileRefs = _.filter(folder.fileRefs || [], file => file != null)
    return {
      _id: folder._id,
      name: folder.name,
      folders: (folder.folders || []).map(childFolder =>
        this.buildFolderModelView(childFolder)
      ),
      fileRefs: fileRefs.map(file => this.buildFileModelView(file)),
      docs: (folder.docs || []).map(doc => this.buildDocModelView(doc)),
    }
  },

  buildFileModelView(file) {
    const additionalFileProperties = {}

    if (Features.hasFeature('project-history-blobs')) {
      additionalFileProperties.hash = file.hash
    }

    return {
      _id: file._id,
      name: file.name,
      linkedFileData: file.linkedFileData,
      created: file.created,
      ...additionalFileProperties,
    }
  },

  buildDocModelView(doc) {
    return {
      _id: doc._id,
      name: doc.name,
    }
  },

  buildInvitesView(invites) {
    if (invites == null) {
      return []
    }
    return invites.map(invite => _.pick(invite, ['_id', 'email', 'privileges']))
  },
}
