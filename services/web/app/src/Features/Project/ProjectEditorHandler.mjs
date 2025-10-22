import _ from 'lodash'
import Path from 'node:path'
let ProjectEditorHandler

export default ProjectEditorHandler = {
  trackChangesAvailable: false,

  buildProjectModelView(
    project,
    ownerMember,
    members,
    invites,
    isRestrictedUser
  ) {
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
      imageName:
        project.imageName != null
          ? Path.basename(project.imageName)
          : undefined,
    }

    if (isRestrictedUser) {
      result.owner = { _id: project.owner_ref }
      result.members = []
      result.invites = []
    } else {
      result.owner = this.buildUserModelView(ownerMember)
      result.members = members.map(this.buildUserModelView)
      result.invites = this.buildInvitesView(invites)
    }

    result.features = _.defaults(ownerMember?.user?.features || {}, {
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
      pendingReviewer: member.pendingReviewer,
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
    return {
      _id: file._id,
      name: file.name,
      linkedFileData: file.linkedFileData,
      created: file.created,
      hash: file.hash,
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
