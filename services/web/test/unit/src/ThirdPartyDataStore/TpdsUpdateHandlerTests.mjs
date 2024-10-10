import esmock from 'esmock'
import sinon from 'sinon'
import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const ObjectId = mongodb.ObjectId

const MODULE_PATH =
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateHandler.mjs'

describe('TpdsUpdateHandler', function () {
  beforeEach(async function () {
    this.projectName = 'My recipes'
    this.projects = {
      active1: { _id: new ObjectId(), name: this.projectName },
      active2: { _id: new ObjectId(), name: this.projectName },
      archived1: {
        _id: new ObjectId(),
        name: this.projectName,
        archived: [this.userId],
      },
      archived2: {
        _id: new ObjectId(),
        name: this.projectName,
        archived: [this.userId],
      },
    }
    this.userId = new ObjectId()
    this.source = 'dropbox'
    this.path = `/some/file`
    this.update = {}
    this.folderPath = '/some/folder'
    this.folder = {
      _id: new ObjectId(),
      parentFolder_id: new ObjectId(),
    }

    this.CooldownManager = {
      promises: {
        isProjectOnCooldown: sinon.stub().resolves(false),
      },
    }
    this.FileTypeManager = {
      promises: {
        shouldIgnore: sinon.stub().resolves(false),
      },
    }
    this.Modules = {
      promises: {
        hooks: { fire: sinon.stub().resolves() },
      },
    }
    this.notification = {
      create: sinon.stub().resolves(),
    }
    this.NotificationsBuilder = {
      promises: {
        dropboxDuplicateProjectNames: sinon.stub().returns(this.notification),
      },
    }
    this.ProjectCreationHandler = {
      promises: {
        createBlankProject: sinon.stub().resolves(this.projects.active1),
      },
    }
    this.ProjectDeleter = {
      promises: {
        markAsDeletedByExternalSource: sinon.stub().resolves(),
      },
    }
    this.ProjectGetter = {
      promises: {
        findUsersProjectsByName: sinon.stub(),
        findAllUsersProjects: sinon
          .stub()
          .resolves({ owned: [this.projects.active1], readAndWrite: [] }),
      },
    }
    this.ProjectHelper = {
      isArchivedOrTrashed: sinon.stub().returns(false),
    }
    this.ProjectHelper.isArchivedOrTrashed
      .withArgs(this.projects.archived1, this.userId)
      .returns(true)
    this.ProjectHelper.isArchivedOrTrashed
      .withArgs(this.projects.archived2, this.userId)
      .returns(true)
    this.RootDocManager = {
      setRootDocAutomaticallyInBackground: sinon.stub(),
    }
    this.UpdateMerger = {
      promises: {
        deleteUpdate: sinon.stub().resolves(),
        mergeUpdate: sinon.stub().resolves(),
        createFolder: sinon.stub().resolves(this.folder),
      },
    }

    this.TpdsUpdateHandler = await esmock.strict(MODULE_PATH, {
      '.../../../../app/src/Features/Cooldown/CooldownManager':
        this.CooldownManager,
      '../../../../app/src/Features/Uploads/FileTypeManager':
        this.FileTypeManager,
      '../../../../app/src/infrastructure/Modules': this.Modules,
      '../../../../app/src/Features/Notifications/NotificationsBuilder':
        this.NotificationsBuilder,
      '../../../../app/src/Features/Project/ProjectCreationHandler':
        this.ProjectCreationHandler,
      '../../../../app/src/Features/Project/ProjectDeleter':
        this.ProjectDeleter,
      '../../../../app/src/Features/Project/ProjectGetter': this.ProjectGetter,
      '../../../../app/src/Features/Project/ProjectHelper': this.ProjectHelper,
      '../../../../app/src/Features/Project/ProjectRootDocManager':
        this.RootDocManager,
      '../../../../app/src/Features/ThirdPartyDataStore/UpdateMerger':
        this.UpdateMerger,
    })
  })

  describe('getting an update', function () {
    describe('byId', function () {
      describe('with no matching project', function () {
        beforeEach(function () {
          this.projectId = new ObjectId().toString()
        })
        receiveUpdateById()
        expectProjectNotCreated()
        expectUpdateNotProcessed()
      })

      describe('with one matching active project', function () {
        beforeEach(function () {
          this.projectId = this.projects.active1._id.toString()
        })
        receiveUpdateById()
        expectProjectNotCreated()
        expectUpdateProcessed()
      })
    })

    describe('with no matching project', function () {
      setupMatchingProjects([])
      receiveUpdate()
      expectProjectCreated()
      expectUpdateProcessed()
    })

    describe('with one matching active project', function () {
      setupMatchingProjects(['active1'])
      receiveUpdate()
      expectProjectNotCreated()
      expectUpdateProcessed()
    })

    describe('with one matching archived project', function () {
      setupMatchingProjects(['archived1'])
      receiveUpdate()
      expectProjectNotCreated()
      expectUpdateNotProcessed()
      expectDropboxNotUnlinked()
    })

    describe('with two matching active projects', function () {
      setupMatchingProjects(['active1', 'active2'])
      receiveUpdate()
      expectProjectNotCreated()
      expectUpdateNotProcessed()
      expectDropboxUnlinked()
    })

    describe('with two matching archived projects', function () {
      setupMatchingProjects(['archived1', 'archived2'])
      receiveUpdate()
      expectProjectNotCreated()
      expectUpdateNotProcessed()
      expectDropboxNotUnlinked()
    })

    describe('with one matching active and one matching archived project', function () {
      setupMatchingProjects(['active1', 'archived1'])
      receiveUpdate()
      expectProjectNotCreated()
      expectUpdateNotProcessed()
      expectDropboxUnlinked()
    })

    describe('update to a file that should be ignored', async function () {
      setupMatchingProjects(['active1'])
      beforeEach(function () {
        this.FileTypeManager.promises.shouldIgnore.resolves(true)
      })
      receiveUpdate()
      expectProjectNotCreated()
      expectUpdateNotProcessed()
      expectDropboxNotUnlinked()
    })

    describe('update to a project on cooldown', async function () {
      setupMatchingProjects(['active1'])
      setupProjectOnCooldown()
      beforeEach(async function () {
        await expect(
          this.TpdsUpdateHandler.promises.newUpdate(
            this.userId,
            '', // projectId
            this.projectName,
            this.path,
            this.update,
            this.source
          )
        ).to.be.rejectedWith(Errors.TooManyRequestsError)
      })
      expectUpdateNotProcessed()
    })
  })

  describe('getting a file delete', function () {
    describe('byId', function () {
      describe('with no matching project', function () {
        beforeEach(function () {
          this.projectId = new ObjectId().toString()
        })
        receiveFileDeleteById()
        expectDeleteNotProcessed()
        expectProjectNotDeleted()
      })

      describe('with one matching active project', function () {
        beforeEach(function () {
          this.projectId = this.projects.active1._id.toString()
        })
        receiveFileDeleteById()
        expectDeleteProcessed()
        expectProjectNotDeleted()
      })
    })

    describe('with no matching project', function () {
      setupMatchingProjects([])
      receiveFileDelete()
      expectDeleteNotProcessed()
      expectProjectNotDeleted()
    })

    describe('with one matching active project', function () {
      setupMatchingProjects(['active1'])
      receiveFileDelete()
      expectDeleteProcessed()
      expectProjectNotDeleted()
    })

    describe('with one matching archived project', function () {
      setupMatchingProjects(['archived1'])
      receiveFileDelete()
      expectDeleteNotProcessed()
      expectProjectNotDeleted()
    })

    describe('with two matching active projects', function () {
      setupMatchingProjects(['active1', 'active2'])
      receiveFileDelete()
      expectDeleteNotProcessed()
      expectProjectNotDeleted()
      expectDropboxUnlinked()
    })

    describe('with two matching archived projects', function () {
      setupMatchingProjects(['archived1', 'archived2'])
      receiveFileDelete()
      expectDeleteNotProcessed()
      expectProjectNotDeleted()
      expectDropboxNotUnlinked()
    })

    describe('with one matching active and one matching archived project', function () {
      setupMatchingProjects(['active1', 'archived1'])
      receiveFileDelete()
      expectDeleteNotProcessed()
      expectProjectNotDeleted()
      expectDropboxUnlinked()
    })
  })

  describe('getting a project delete', function () {
    describe('with no matching project', function () {
      setupMatchingProjects([])
      receiveProjectDelete()
      expectDeleteNotProcessed()
      expectProjectNotDeleted()
    })

    describe('with one matching active project', function () {
      setupMatchingProjects(['active1'])
      receiveProjectDelete()
      expectDeleteNotProcessed()
      expectProjectDeleted()
    })

    describe('with one matching archived project', function () {
      setupMatchingProjects(['archived1'])
      receiveProjectDelete()
      expectDeleteNotProcessed()
      expectProjectNotDeleted()
    })

    describe('with two matching active projects', function () {
      setupMatchingProjects(['active1', 'active2'])
      receiveProjectDelete()
      expectDeleteNotProcessed()
      expectProjectNotDeleted()
      expectDropboxUnlinked()
    })

    describe('with two matching archived projects', function () {
      setupMatchingProjects(['archived1', 'archived2'])
      receiveProjectDelete()
      expectDeleteNotProcessed()
      expectProjectNotDeleted()
      expectDropboxNotUnlinked()
    })

    describe('with one matching active and one matching archived project', function () {
      setupMatchingProjects(['active1', 'archived1'])
      receiveProjectDelete()
      expectDeleteNotProcessed()
      expectProjectNotDeleted()
      expectDropboxUnlinked()
    })
  })

  describe('getting a folder update', function () {
    describe('with no matching project', function () {
      setupMatchingProjects([])
      receiveFolderUpdate()
      expectProjectCreated()
      expectFolderUpdateProcessed()
    })

    describe('with one matching active project', function () {
      setupMatchingProjects(['active1'])
      receiveFolderUpdate()
      expectProjectNotCreated()
      expectFolderUpdateProcessed()
    })

    describe('with one matching archived project', function () {
      setupMatchingProjects(['archived1'])
      receiveFolderUpdate()
      expectProjectNotCreated()
      expectFolderUpdateNotProcessed()
      expectDropboxNotUnlinked()
    })

    describe('with two matching active projects', function () {
      setupMatchingProjects(['active1', 'active2'])
      receiveFolderUpdate()
      expectProjectNotCreated()
      expectFolderUpdateNotProcessed()
      expectDropboxUnlinked()
    })

    describe('with two matching archived projects', function () {
      setupMatchingProjects(['archived1', 'archived2'])
      receiveFolderUpdate()
      expectProjectNotCreated()
      expectFolderUpdateNotProcessed()
      expectDropboxNotUnlinked()
    })

    describe('with one matching active and one matching archived project', function () {
      setupMatchingProjects(['active1', 'archived1'])
      receiveFolderUpdate()
      expectProjectNotCreated()
      expectFolderUpdateNotProcessed()
      expectDropboxUnlinked()
    })

    describe('update to a project on cooldown', async function () {
      setupMatchingProjects(['active1'])
      setupProjectOnCooldown()
      beforeEach(async function () {
        await expect(
          this.TpdsUpdateHandler.promises.createFolder(
            this.userId,
            this.projectId,
            this.projectName,
            this.path
          )
        ).to.be.rejectedWith(Errors.TooManyRequestsError)
      })
      expectFolderUpdateNotProcessed()
    })
  })
})

/* Setup helpers */

function setupMatchingProjects(projectKeys) {
  beforeEach(function () {
    const projects = projectKeys.map(key => this.projects[key])
    this.ProjectGetter.promises.findUsersProjectsByName
      .withArgs(this.userId, this.projectName)
      .resolves(projects)
  })
}

function setupProjectOnCooldown() {
  beforeEach(function () {
    this.CooldownManager.promises.isProjectOnCooldown
      .withArgs(this.projects.active1._id)
      .resolves(true)
  })
}

/* Test helpers */

function receiveUpdate() {
  beforeEach(async function () {
    await this.TpdsUpdateHandler.promises.newUpdate(
      this.userId,
      '', // projectId
      this.projectName,
      this.path,
      this.update,
      this.source
    )
  })
}

function receiveUpdateById() {
  beforeEach(function (done) {
    this.TpdsUpdateHandler.newUpdate(
      this.userId,
      this.projectId,
      '', // projectName
      this.path,
      this.update,
      this.source,
      done
    )
  })
}

function receiveFileDelete() {
  beforeEach(async function () {
    await this.TpdsUpdateHandler.promises.deleteUpdate(
      this.userId,
      '', // projectId
      this.projectName,
      this.path,
      this.source
    )
  })
}

function receiveFileDeleteById() {
  beforeEach(function (done) {
    this.TpdsUpdateHandler.deleteUpdate(
      this.userId,
      this.projectId,
      '', // projectName
      this.path,
      this.source,
      done
    )
  })
}

function receiveProjectDelete() {
  beforeEach(async function () {
    await this.TpdsUpdateHandler.promises.deleteUpdate(
      this.userId,
      '', // projectId
      this.projectName,
      '/',
      this.source
    )
  })
}

function receiveFolderUpdate() {
  beforeEach(async function () {
    await this.TpdsUpdateHandler.promises.createFolder(
      this.userId,
      this.projectId,
      this.projectName,
      this.folderPath
    )
  })
}

/* Expectations */

function expectProjectCreated() {
  it('creates a project', function () {
    expect(
      this.ProjectCreationHandler.promises.createBlankProject
    ).to.have.been.calledWith(this.userId, this.projectName)
  })

  it('sets the root doc', function () {
    expect(
      this.RootDocManager.setRootDocAutomaticallyInBackground
    ).to.have.been.calledWith(this.projects.active1._id)
  })
}

function expectProjectNotCreated() {
  it('does not create a project', function () {
    expect(this.ProjectCreationHandler.promises.createBlankProject).not.to.have
      .been.called
  })

  it('does not set the root doc', function () {
    expect(this.RootDocManager.setRootDocAutomaticallyInBackground).not.to.have
      .been.called
  })
}

function expectUpdateProcessed() {
  it('processes the update', function () {
    expect(this.UpdateMerger.promises.mergeUpdate).to.have.been.calledWith(
      this.userId,
      this.projects.active1._id,
      this.path,
      this.update,
      this.source
    )
  })
}

function expectUpdateNotProcessed() {
  it('does not process the update', function () {
    expect(this.UpdateMerger.promises.mergeUpdate).not.to.have.been.called
  })
}

function expectFolderUpdateProcessed() {
  it('processes the folder update', function () {
    expect(this.UpdateMerger.promises.createFolder).to.have.been.calledWith(
      this.projects.active1._id,
      this.folderPath
    )
  })
}

function expectFolderUpdateNotProcessed() {
  it("doesn't process the folder update", function () {
    expect(this.UpdateMerger.promises.createFolder).not.to.have.been.called
  })
}

function expectDropboxUnlinked() {
  it('unlinks Dropbox', function () {
    expect(this.Modules.promises.hooks.fire).to.have.been.calledWith(
      'removeDropbox',
      this.userId,
      'duplicate-projects'
    )
  })

  it('creates a notification that dropbox was unlinked', function () {
    expect(
      this.NotificationsBuilder.promises.dropboxDuplicateProjectNames
    ).to.have.been.calledWith(this.userId)
    expect(this.notification.create).to.have.been.calledWith(this.projectName)
  })
}

function expectDropboxNotUnlinked() {
  it('does not unlink Dropbox', function () {
    expect(this.Modules.promises.hooks.fire).not.to.have.been.called
  })

  it('does not create a notification that dropbox was unlinked', function () {
    expect(this.NotificationsBuilder.promises.dropboxDuplicateProjectNames).not
      .to.have.been.called
  })
}

function expectDeleteProcessed() {
  it('processes the delete', function () {
    expect(this.UpdateMerger.promises.deleteUpdate).to.have.been.calledWith(
      this.userId,
      this.projects.active1._id,
      this.path,
      this.source
    )
  })
}

function expectDeleteNotProcessed() {
  it('does not process the delete', function () {
    expect(this.UpdateMerger.promises.deleteUpdate).not.to.have.been.called
  })
}

function expectProjectDeleted() {
  it('deletes the project', function () {
    expect(
      this.ProjectDeleter.promises.markAsDeletedByExternalSource
    ).to.have.been.calledWith(this.projects.active1._id)
  })
}

function expectProjectNotDeleted() {
  it('does not delete the project', function () {
    expect(this.ProjectDeleter.promises.markAsDeletedByExternalSource).not.to
      .have.been.called
  })
}
