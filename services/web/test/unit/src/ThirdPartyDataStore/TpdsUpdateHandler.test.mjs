import { expect, vi } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const ObjectId = mongodb.ObjectId

const MODULE_PATH =
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateHandler.mjs'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('TpdsUpdateHandler', function () {
  beforeEach(async function (ctx) {
    ctx.projectName = 'My recipes'
    ctx.userId = new ObjectId()
    ctx.projects = {
      active1: { _id: new ObjectId(), name: ctx.projectName },
      active2: { _id: new ObjectId(), name: ctx.projectName },
      archived1: {
        _id: new ObjectId(),
        name: ctx.projectName,
        archived: [ctx.userId],
      },
      archived2: {
        _id: new ObjectId(),
        name: ctx.projectName,
        archived: [ctx.userId],
      },
      trashed: {
        _id: new ObjectId(),
        name: ctx.projectName,
        trashed: [ctx.userId],
      },
    }
    ctx.source = 'dropbox'
    ctx.path = `/some/file`
    ctx.update = {}
    ctx.folderPath = '/some/folder'
    ctx.folder = {
      _id: new ObjectId(),
      parentFolder_id: new ObjectId(),
    }

    ctx.CooldownManager = {
      isProjectOnCooldown: sinon.stub().resolves(false),
    }
    ctx.FileTypeManager = {
      shouldIgnore: sinon.stub().returns(false),
    }
    ctx.Modules = {
      promises: {
        hooks: { fire: sinon.stub().resolves() },
      },
    }
    ctx.notification = {
      create: sinon.stub().resolves(),
    }
    ctx.NotificationsBuilder = {
      promises: {
        dropboxDuplicateProjectNames: sinon.stub().returns(ctx.notification),
      },
    }
    ctx.ProjectCreationHandler = {
      promises: {
        createBlankProject: sinon.stub().resolves(ctx.projects.active1),
      },
    }
    ctx.ProjectDeleter = {
      promises: {
        markAsDeletedByExternalSource: sinon.stub().resolves(),
      },
    }
    ctx.ProjectGetter = {
      promises: {
        findUsersProjectsByName: sinon.stub(),
        findAllUsersProjects: sinon.stub().resolves({
          owned: Object.values(ctx.projects),
          readAndWrite: [],
        }),
      },
    }
    ctx.ProjectHelper = {
      isArchivedOrTrashed: sinon.stub().returns(false),
    }
    ctx.ProjectHelper.isArchivedOrTrashed
      .withArgs(ctx.projects.archived1, ctx.userId)
      .returns(true)
    ctx.ProjectHelper.isArchivedOrTrashed
      .withArgs(ctx.projects.archived2, ctx.userId)
      .returns(true)
    ctx.ProjectHelper.isArchivedOrTrashed
      .withArgs(ctx.projects.trashed, ctx.userId)
      .returns(true)
    ctx.RootDocManager = {
      setRootDocAutomaticallyInBackground: sinon.stub(),
    }
    ctx.UpdateMerger = {
      promises: {
        deleteUpdate: sinon.stub().resolves(),
        mergeUpdate: sinon.stub().resolves(),
        createFolder: sinon.stub().resolves(ctx.folder),
      },
    }

    vi.doMock('../../../../app/src/Features/Cooldown/CooldownManager', () => ({
      default: ctx.CooldownManager,
    }))

    vi.doMock('../../../../app/src/Features/Uploads/FileTypeManager', () => ({
      default: ctx.FileTypeManager,
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    vi.doMock(
      '../../../../app/src/Features/Notifications/NotificationsBuilder',
      () => ({
        default: ctx.NotificationsBuilder,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectCreationHandler',
      () => ({
        default: ctx.ProjectCreationHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectDeleter', () => ({
      default: ctx.ProjectDeleter,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectHelper', () => ({
      default: ctx.ProjectHelper,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectRootDocManager',
      () => ({
        default: ctx.RootDocManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/UpdateMerger',
      () => ({
        default: ctx.UpdateMerger,
      })
    )

    ctx.TpdsUpdateHandler = (await import(MODULE_PATH)).default
  })

  describe('getting an update', function () {
    describe('byId', function () {
      describe('with no matching project', function () {
        beforeEach(function (ctx) {
          ctx.projectId = new ObjectId().toString()
        })
        receiveUpdateById()
        expectProjectNotCreated()
        expectUpdateNotProcessed()
      })

      describe('with one matching active project', function () {
        beforeEach(function (ctx) {
          ctx.projectId = ctx.projects.active1._id.toString()
        })
        receiveUpdateById()
        expectProjectNotCreated()
        expectUpdateProcessed()
      })

      describe('with one matching archived project', function () {
        beforeEach(function (ctx) {
          ctx.projectId = ctx.projects.archived1._id.toString()
        })
        receiveUpdateById()
        expectProjectNotCreated()
        expectUpdateNotProcessed()
      })

      describe('with one matching trashed project', function () {
        beforeEach(function (ctx) {
          ctx.projectId = ctx.projects.trashed._id.toString()
        })
        receiveUpdateById()
        expectProjectNotCreated()
        expectUpdateNotProcessed()
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
      beforeEach(function (ctx) {
        ctx.FileTypeManager.shouldIgnore.returns(true)
      })
      receiveUpdate()
      expectProjectNotCreated()
      expectUpdateNotProcessed()
      expectDropboxNotUnlinked()
    })

    describe('update to a project on cooldown', async function () {
      setupMatchingProjects(['active1'])
      setupProjectOnCooldown()
      beforeEach(async function (ctx) {
        await expect(
          ctx.TpdsUpdateHandler.promises.newUpdate(
            ctx.userId,
            '', // projectId
            ctx.projectName,
            ctx.path,
            ctx.update,
            ctx.source
          )
        ).to.be.rejectedWith(Errors.TooManyRequestsError)
      })
      expectUpdateNotProcessed()
    })
  })

  describe('getting a file delete', function () {
    describe('byId', function () {
      describe('with no matching project', function () {
        beforeEach(function (ctx) {
          ctx.projectId = new ObjectId().toString()
        })
        receiveFileDeleteById()
        expectDeleteNotProcessed()
        expectProjectNotDeleted()
      })

      describe('with one matching active project', function () {
        beforeEach(function (ctx) {
          ctx.projectId = ctx.projects.active1._id.toString()
        })
        receiveFileDeleteById()
        expectDeleteProcessed()
        expectProjectNotDeleted()
      })

      describe('with one matching archived project', function () {
        beforeEach(function (ctx) {
          ctx.projectId = ctx.projects.archived1._id.toString()
        })
        receiveFileDeleteById()
        expectDeleteNotProcessed()
        expectProjectNotDeleted()
      })

      describe('with one matching trashed project', function () {
        beforeEach(function (ctx) {
          ctx.projectId = ctx.projects.trashed._id.toString()
        })
        receiveFileDeleteById()
        expectDeleteNotProcessed()
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
      beforeEach(async function (ctx) {
        await expect(
          ctx.TpdsUpdateHandler.promises.createFolder(
            ctx.userId,
            ctx.projectId,
            ctx.projectName,
            ctx.path
          )
        ).to.be.rejectedWith(Errors.TooManyRequestsError)
      })
      expectFolderUpdateNotProcessed()
    })
  })
})

/* Setup helpers */

function setupMatchingProjects(projectKeys) {
  beforeEach(function (ctx) {
    const projects = projectKeys.map(key => ctx.projects[key])
    ctx.ProjectGetter.promises.findUsersProjectsByName
      .withArgs(ctx.userId, ctx.projectName)
      .resolves(projects)
  })
}

function setupProjectOnCooldown() {
  beforeEach(function (ctx) {
    ctx.CooldownManager.isProjectOnCooldown
      .withArgs(ctx.projects.active1._id)
      .resolves(true)
  })
}

/* Test helpers */

function receiveUpdate() {
  beforeEach(async function (ctx) {
    await ctx.TpdsUpdateHandler.promises.newUpdate(
      ctx.userId,
      '', // projectId
      ctx.projectName,
      ctx.path,
      ctx.update,
      ctx.source
    )
  })
}

function receiveUpdateById() {
  beforeEach(async function (ctx) {
    await ctx.TpdsUpdateHandler.promises.newUpdate(
      ctx.userId,
      ctx.projectId,
      '', // projectName
      ctx.path,
      ctx.update,
      ctx.source
    )
  })
}

function receiveFileDelete() {
  beforeEach(async function (ctx) {
    await ctx.TpdsUpdateHandler.promises.deleteUpdate(
      ctx.userId,
      '', // projectId
      ctx.projectName,
      ctx.path,
      ctx.source
    )
  })
}

function receiveFileDeleteById() {
  beforeEach(async function (ctx) {
    await ctx.TpdsUpdateHandler.promises.deleteUpdate(
      ctx.userId,
      ctx.projectId,
      '', // projectName
      ctx.path,
      ctx.source
    )
  })
}

function receiveProjectDelete() {
  beforeEach(async function (ctx) {
    await ctx.TpdsUpdateHandler.promises.deleteUpdate(
      ctx.userId,
      '', // projectId
      ctx.projectName,
      '/',
      ctx.source
    )
  })
}

function receiveFolderUpdate() {
  beforeEach(async function (ctx) {
    await ctx.TpdsUpdateHandler.promises.createFolder(
      ctx.userId,
      ctx.projectId,
      ctx.projectName,
      ctx.folderPath
    )
  })
}

/* Expectations */

function expectProjectCreated() {
  it('creates a project', function (ctx) {
    expect(
      ctx.ProjectCreationHandler.promises.createBlankProject
    ).to.have.been.calledWith(ctx.userId, ctx.projectName)
  })

  it('sets the root doc', function (ctx) {
    expect(
      ctx.RootDocManager.setRootDocAutomaticallyInBackground
    ).to.have.been.calledWith(ctx.projects.active1._id)
  })
}

function expectProjectNotCreated() {
  it('does not create a project', function (ctx) {
    expect(ctx.ProjectCreationHandler.promises.createBlankProject).not.to.have
      .been.called
  })

  it('does not set the root doc', function (ctx) {
    expect(ctx.RootDocManager.setRootDocAutomaticallyInBackground).not.to.have
      .been.called
  })
}

function expectUpdateProcessed() {
  it('processes the update', function (ctx) {
    expect(ctx.UpdateMerger.promises.mergeUpdate).to.have.been.calledWith(
      ctx.userId,
      ctx.projects.active1._id,
      ctx.path,
      ctx.update,
      ctx.source
    )
  })
}

function expectUpdateNotProcessed() {
  it('does not process the update', function (ctx) {
    expect(ctx.UpdateMerger.promises.mergeUpdate).not.to.have.been.called
  })
}

function expectFolderUpdateProcessed() {
  it('processes the folder update', function (ctx) {
    expect(ctx.UpdateMerger.promises.createFolder).to.have.been.calledWith(
      ctx.projects.active1._id,
      ctx.folderPath,
      ctx.userId
    )
  })
}

function expectFolderUpdateNotProcessed() {
  it("doesn't process the folder update", function (ctx) {
    expect(ctx.UpdateMerger.promises.createFolder).not.to.have.been.called
  })
}

function expectDropboxUnlinked() {
  it('unlinks Dropbox', function (ctx) {
    expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
      'removeDropbox',
      ctx.userId,
      'duplicate-projects'
    )
  })

  it('creates a notification that dropbox was unlinked', function (ctx) {
    expect(
      ctx.NotificationsBuilder.promises.dropboxDuplicateProjectNames
    ).to.have.been.calledWith(ctx.userId)
    expect(ctx.notification.create).to.have.been.calledWith(ctx.projectName)
  })
}

function expectDropboxNotUnlinked() {
  it('does not unlink Dropbox', function (ctx) {
    expect(ctx.Modules.promises.hooks.fire).not.to.have.been.called
  })

  it('does not create a notification that dropbox was unlinked', function (ctx) {
    expect(ctx.NotificationsBuilder.promises.dropboxDuplicateProjectNames).not
      .to.have.been.called
  })
}

function expectDeleteProcessed() {
  it('processes the delete', function (ctx) {
    expect(ctx.UpdateMerger.promises.deleteUpdate).to.have.been.calledWith(
      ctx.userId,
      ctx.projects.active1._id,
      ctx.path,
      ctx.source
    )
  })
}

function expectDeleteNotProcessed() {
  it('does not process the delete', function (ctx) {
    expect(ctx.UpdateMerger.promises.deleteUpdate).not.to.have.been.called
  })
}

function expectProjectDeleted() {
  it('deletes the project', function (ctx) {
    expect(
      ctx.ProjectDeleter.promises.markAsDeletedByExternalSource
    ).to.have.been.calledWith(ctx.projects.active1._id)
  })
}

function expectProjectNotDeleted() {
  it('does not delete the project', function (ctx) {
    expect(ctx.ProjectDeleter.promises.markAsDeletedByExternalSource).not.to
      .have.been.called
  })
}
