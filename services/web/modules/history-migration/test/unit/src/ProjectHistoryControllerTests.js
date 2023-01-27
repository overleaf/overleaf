const sinon = require('sinon')
const nock = require('nock')
const { expect } = require('chai')
const fs = require('fs')
const path = require('path')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb')
const unzipper = require('unzipper')

const modulePath = '../../../app/src/ProjectHistoryController'

describe('ProjectHistoryController', function () {
  const projectId = ObjectId('611bd20c5d76a3c1bd0c7c13')
  const deletedFileId = ObjectId('60f6e92c6c14d84fb7a71ae1')
  const historyId = 123

  let clock
  const now = new Date(Date.UTC(2021, 1, 1, 0, 0)).getTime()

  before(async function () {
    clock = sinon.useFakeTimers({
      now,
      shouldAdvanceTime: true,
    })
  })

  after(function () {
    // clock.runAll()
    clock.restore()
  })

  beforeEach(function () {
    this.db = {
      users: {
        countDocuments: sinon.stub().yields(),
      },
    }

    this.project = {
      _id: ObjectId('611bd20c5d76a3c1bd0c7c13'),
      name: 'My Test Project',
      rootDoc_id: ObjectId('611bd20c5d76a3c1bd0c7c15'),
      rootFolder: [
        {
          _id: ObjectId('611bd20c5d76a3c1bd0c7c12'),
          name: 'rootFolder',
          folders: [
            {
              _id: ObjectId('611bd242e64281c13303d6b5'),
              name: 'a folder',
              folders: [
                {
                  _id: ObjectId('611bd247e64281c13303d6b7'),
                  name: 'a subfolder',
                  folders: [],
                  fileRefs: [],
                  docs: [
                    {
                      _id: ObjectId('611bd24ee64281c13303d6b9'),
                      name: 'a renamed file in a subfolder.tex',
                    },
                  ],
                },
              ],
              fileRefs: [],
              docs: [],
            },
            {
              _id: ObjectId('611bd34ee64281c13303d6be'),
              name: 'images',
              folders: [],
              fileRefs: [
                {
                  _id: ObjectId('611bd2bce64281c13303d6bb'),
                  name: 'overleaf-white.svg',
                  linkedFileData: {
                    provider: 'url',
                    url: 'https://cdn.overleaf.com/img/ol-brand/overleaf-white.svg',
                  },
                  created: '2021-08-17T15:16:12.753Z',
                },
              ],
              docs: [],
            },
          ],
          fileRefs: [
            {
              _id: ObjectId('611bd20c5d76a3c1bd0c7c19'),
              name: 'universe.jpg',
              linkedFileData: null,
              created: '2021-08-17T15:13:16.400Z',
            },
          ],
          docs: [
            {
              _id: ObjectId('611bd20c5d76a3c1bd0c7c15'),
              name: 'main.tex',
            },
            {
              _id: ObjectId('611bd20c5d76a3c1bd0c7c17'),
              name: 'references.bib',
            },
          ],
        },
      ],
      compiler: 'pdflatex',
      description: '',
      deletedDocs: [],
      members: [],
      invites: [],
      owner: {
        _id: ObjectId('611572e24bff88527f61dccd'),
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        privileges: 'owner',
        signUpDate: '2021-08-12T19:13:38.462Z',
      },
      features: {},
    }

    this.multi = {
      del: sinon.stub(),
      rpush: sinon.stub(),
      exec: sinon.stub().yields(null, 1),
    }

    const { docs, folders } = this.project.rootFolder[0]

    const allDocs = [...docs]

    const processFolders = folders => {
      for (const folder of folders) {
        for (const doc of folder.docs) {
          allDocs.push(doc)
        }

        if (folder.folders) {
          processFolders(folder.folders)
        }
      }
    }

    processFolders(folders)

    allDocs.forEach(doc => {
      doc.lines = [`this is the contents of ${doc.name}`]
    })

    // handle Doc.find().lean().cursor()
    this.findDocs = sinon.stub().returns({
      lean: sinon.stub().returns({
        cursor: sinon.stub().returns(allDocs),
      }),
    })

    // handle await Doc.findOne().lean() - single result, no cursor required
    this.findOneDoc = sinon.stub().callsFake(id => {
      const result = allDocs.find(doc => {
        return doc._id.toString() === id.toString()
      })
      return { lean: sinon.stub().resolves(result) }
    })

    this.deletedFiles = [
      {
        _id: deletedFileId,
        name: 'testing.tex',
        deletedAt: new Date(),
      },
    ]

    // handle DeletedFile.find().lean().cursor()
    this.findDeletedFiles = sinon.stub().returns({
      lean: sinon
        .stub()
        .returns({ cursor: sinon.stub().returns(this.deletedFiles) }),
    })

    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(this.project),
      },
    }

    this.FileStoreHandler = {
      _buildUrl: (projectId, fileId) =>
        `http://filestore.test/${projectId}/${fileId}`,
    }

    this.ProjectHistoryHandler = {
      promises: {
        setHistoryId: sinon.stub(),
        upgradeHistory: sinon.stub(),
      },
    }

    this.ProjectEntityUpdateHandler = {
      promises: {
        resyncProjectHistory: sinon.stub(),
      },
    }

    this.DocumentUpdaterHandler = {
      promises: {
        flushProjectToMongoAndDelete: sinon.stub(),
      },
    }

    this.HistoryManager = {
      promises: {
        resyncProject: sinon.stub(),
        flushProject: sinon.stub(),
        initializeProject: sinon.stub().resolves(historyId),
      },
    }

    this.settings = {
      redis: {
        project_history_migration: {
          key_schema: {
            projectHistoryOps({ projectId }) {
              return `ProjectHistory:Ops:{${projectId}}` // NOTE: the extra braces are intentional
            },
          },
        },
      },
      apis: {
        documentupdater: {
          url: 'http://document-updater',
        },
        trackchanges: {
          url: 'http://track-changes',
        },
        project_history: {
          url: 'http://project-history',
        },
      },
      path: {
        projectHistories: 'data/projectHistories',
      },
    }

    this.ProjectHistoryController = SandboxedModule.require(modulePath, {
      requires: {
        '../../../../app/src/Features/Project/ProjectGetter':
          this.ProjectGetter,
        '../../../../app/src/Features/FileStore/FileStoreHandler':
          this.FileStoreHandler,
        '../../../../app/src/Features/Project/ProjectHistoryHandler':
          this.ProjectHistoryHandler,
        '../../../../app/src/Features/Project/ProjectUpdateHandler':
          this.ProjectUpdateHandler,
        '../../../../app/src/Features/Project/ProjectEntityUpdateHandler':
          this.ProjectEntityUpdateHandler,
        '../../../../app/src/Features/History/HistoryManager':
          this.HistoryManager,
        '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler':
          this.DocumentUpdaterHandler,
        '../../../../app/src/models/Doc': {
          Doc: {
            find: this.findDocs,
            findOne: this.findOneDoc,
          },
        },
        '../../../../app/src/models/DeletedFile': {
          DeletedFile: {
            find: this.findDeletedFiles,
          },
        },
        '../../../../app/src/infrastructure/mongodb': {
          db: this.db,
        },
        '../../../../app/src/infrastructure/Mongoose': {
          Schema: {
            ObjectId: sinon.stub(),
            Types: {
              Mixed: sinon.stub(),
            },
          },
        },
        '../../../../app/src/infrastructure/RedisWrapper': {
          client: () => ({
            multi: () => this.multi,
            llen: sinon.stub().resolves(0),
          }),
        },
        unzipper: {
          Open: {
            file: () =>
              unzipper.Open.file(
                path.join(__dirname, 'data/track-changes-project.zip')
              ),
          },
        },
        '@overleaf/settings': this.settings,
      },
    })
  })

  afterEach(function () {
    nock.cleanAll()
  })

  it('migrates a project history', async function () {
    const readStream = fs.createReadStream(
      path.join(__dirname, 'data/track-changes-project.zip')
    )

    nock(this.settings.apis.trackchanges.url)
      .get(`/project/${projectId}/zip`)
      .reply(200, readStream)

    nock(this.settings.apis.project_history.url)
      .post(`/project`)
      .reply(200, { project: { id: historyId } })

    await this.ProjectHistoryController.migrateProjectHistory(
      projectId.toString(),
      5
    )

    expect(this.multi.exec).to.have.been.calledOnce
    expect(this.ProjectHistoryHandler.promises.setHistoryId).to.have.been
      .calledOnce
    // expect(this.ProjectEntityUpdateHandler.promises.resyncProjectHistory).to
    //   .have.been.calledOnce
    expect(this.HistoryManager.promises.flushProject).to.have.been.calledTwice
    expect(this.multi.rpush).to.have.callCount(12)

    const args = this.multi.rpush.args

    const snapshotPath = path.join(
      __dirname,
      'data/migrate-project-history.snapshot.json'
    )

    // const snapshot = JSON.stringify(args, null, 2)
    // await fs.promises.writeFile(snapshotPath, snapshot)

    const json = await fs.promises.readFile(snapshotPath, 'utf-8')
    const expected = JSON.parse(json)

    expect(args).to.deep.equal(expected)
  })
})
