const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const Errors = require('../../../../app/src/Features/Errors/Errors')

const MODULE_PATH =
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateHandler.js'

describe('TpdsUpdateHandler', function () {
  beforeEach(function () {
    this.clock = sinon.useFakeTimers()
  })

  afterEach(function () {
    this.clock.restore()
  })

  beforeEach(function () {
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

    this.CooldownManager = {
      isProjectOnCooldown: sinon.stub().yields(null, false),
    }
    this.FileTypeManager = {
      shouldIgnore: sinon.stub().yields(null, false),
    }
    this.Modules = {
      hooks: { fire: sinon.stub().yields() },
    }
    this.notification = {
      create: sinon.stub().yields(),
    }
    this.NotificationsBuilder = {
      dropboxDuplicateProjectNames: sinon.stub().returns(this.notification),
    }
    this.ProjectCreationHandler = {
      createBlankProject: sinon.stub().yields(null, this.projects.active1),
    }
    this.ProjectDeleter = {
      markAsDeletedByExternalSource: sinon.stub().yields(),
    }
    this.ProjectGetter = {
      findUsersProjectsByName: sinon.stub(),
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
    this.RootDocManager = { setRootDocAutomatically: sinon.stub() }
    this.UpdateMerger = {
      deleteUpdate: sinon.stub().yields(),
      mergeUpdate: sinon.stub().yields(),
    }

    this.TpdsUpdateHandler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../Cooldown/CooldownManager': this.CooldownManager,
        '../Uploads/FileTypeManager': this.FileTypeManager,
        '../../infrastructure/Modules': this.Modules,
        '../Notifications/NotificationsBuilder': this.NotificationsBuilder,
        '../Project/ProjectCreationHandler': this.ProjectCreationHandler,
        '../Project/ProjectDeleter': this.ProjectDeleter,
        '../Project/ProjectGetter': this.ProjectGetter,
        '../Project/ProjectHelper': this.ProjectHelper,
        '../Project/ProjectRootDocManager': this.RootDocManager,
        './UpdateMerger': this.UpdateMerger,
      },
    })
  })

  describe('getting an update', function () {
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

    describe('update to a file that should be ignored', function (done) {
      setupMatchingProjects(['active1'])
      beforeEach(function () {
        this.FileTypeManager.shouldIgnore.yields(null, true)
      })
      receiveUpdate()
      expectProjectNotCreated()
      expectUpdateNotProcessed()
      expectDropboxNotUnlinked()
    })

    describe('update to a project on cooldown', function (done) {
      setupMatchingProjects(['active1'])
      setupProjectOnCooldown()
      beforeEach(function (done) {
        this.TpdsUpdateHandler.newUpdate(
          this.userId,
          this.projectName,
          this.path,
          this.update,
          this.source,
          err => {
            expect(err).to.be.instanceof(Errors.TooManyRequestsError)
            done()
          }
        )
      })
      expectUpdateNotProcessed()
    })
  })

  describe('getting a file delete', function () {
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
})

/* Setup helpers */

function setupMatchingProjects(projectKeys) {
  beforeEach(function () {
    const projects = projectKeys.map(key => this.projects[key])
    this.ProjectGetter.findUsersProjectsByName
      .withArgs(this.userId, this.projectName)
      .yields(null, projects)
  })
}

function setupProjectOnCooldown() {
  beforeEach(function () {
    this.CooldownManager.isProjectOnCooldown
      .withArgs(this.projects.active1._id)
      .yields(null, true)
  })
}

/* Test helpers */

function receiveUpdate() {
  beforeEach(function (done) {
    this.TpdsUpdateHandler.newUpdate(
      this.userId,
      this.projectName,
      this.path,
      this.update,
      this.source,
      done
    )
  })
}

function receiveFileDelete() {
  beforeEach(function (done) {
    this.TpdsUpdateHandler.deleteUpdate(
      this.userId,
      this.projectName,
      this.path,
      this.source,
      done
    )
  })
}

function receiveProjectDelete() {
  beforeEach(function (done) {
    this.TpdsUpdateHandler.deleteUpdate(
      this.userId,
      this.projectName,
      '/',
      this.source,
      done
    )
  })
}

/* Expectations */

function expectProjectCreated() {
  it('creates a project', function () {
    expect(
      this.ProjectCreationHandler.createBlankProject
    ).to.have.been.calledWith(this.userId, this.projectName)
  })

  it('sets the root doc', function () {
    // Fire pending timers
    this.clock.runAll()
    expect(this.RootDocManager.setRootDocAutomatically).to.have.been.calledWith(
      this.projects.active1._id
    )
  })
}

function expectProjectNotCreated() {
  it('does not create a project', function () {
    expect(this.ProjectCreationHandler.createBlankProject).not.to.have.been
      .called
  })

  it('does not set the root doc', function () {
    // Fire pending timers
    this.clock.runAll()
    expect(this.RootDocManager.setRootDocAutomatically).not.to.have.been.called
  })
}

function expectUpdateProcessed() {
  it('processes the update', function () {
    expect(this.UpdateMerger.mergeUpdate).to.have.been.calledWith(
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
    expect(this.UpdateMerger.mergeUpdate).not.to.have.been.called
  })
}

function expectDropboxUnlinked() {
  it('unlinks Dropbox', function () {
    expect(this.Modules.hooks.fire).to.have.been.calledWith(
      'removeDropbox',
      this.userId,
      'duplicate-projects'
    )
  })

  it('creates a notification that dropbox was unlinked', function () {
    expect(
      this.NotificationsBuilder.dropboxDuplicateProjectNames
    ).to.have.been.calledWith(this.userId)
    expect(this.notification.create).to.have.been.calledWith(this.projectName)
  })
}

function expectDropboxNotUnlinked() {
  it('does not unlink Dropbox', function () {
    expect(this.Modules.hooks.fire).not.to.have.been.called
  })

  it('does not create a notification that dropbox was unlinked', function () {
    expect(this.NotificationsBuilder.dropboxDuplicateProjectNames).not.to.have
      .been.called
  })
}

function expectDeleteProcessed() {
  it('processes the delete', function () {
    expect(this.UpdateMerger.deleteUpdate).to.have.been.calledWith(
      this.userId,
      this.projects.active1._id,
      this.path,
      this.source
    )
  })
}

function expectDeleteNotProcessed() {
  it('does not process the delete', function () {
    expect(this.UpdateMerger.deleteUpdate).not.to.have.been.called
  })
}

function expectProjectDeleted() {
  it('deletes the project', function () {
    expect(
      this.ProjectDeleter.markAsDeletedByExternalSource
    ).to.have.been.calledWith(this.projects.active1._id)
  })
}

function expectProjectNotDeleted() {
  it('does not delete the project', function () {
    expect(this.ProjectDeleter.markAsDeletedByExternalSource).not.to.have.been
      .called
  })
}
