import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { expect } from 'chai'
import logger from '@overleaf/logger'
import { filterOutput } from './helpers/settings.mjs'
import { db, ObjectId } from '../../../app/src/infrastructure/mongodb.js'

async function runScriptFind() {
  try {
    const result = await promisify(exec)(
      ['node', 'scripts/find_malformed_filetrees.mjs'].join(' ')
    )
    return result.stdout.split('\n').filter(filterOutput)
  } catch (error) {
    logger.error({ error }, 'script failed')
    throw error
  }
}

async function runScriptFix(instructions) {
  const adhocFile = instructions.map(entry => JSON.stringify(entry)).join('\n')
  try {
    return await promisify(exec)(
      [
        'node',
        'scripts/fix_malformed_filetree.mjs',
        `--logs=<(echo '${adhocFile}')`,
      ].join(' '),
      { shell: '/bin/bash' }
    )
  } catch (error) {
    logger.error({ error }, 'fix script failed unexpectedly')
    throw error
  }
}

const findProjects = () =>
  db.projects
    .find({}, { projection: { rootFolder: 1, _id: 1, version: 1 } })
    .toArray()

const projectId = new ObjectId()
const rootFolderId = new ObjectId()

const idDic = {}

const id = key => {
  if (!idDic[key]) {
    idDic[key] = new ObjectId()
  }
  return idDic[key]
}
const strId = key => {
  return idDic[key].toString()
}

const wellFormedFolder = name => ({
  _id: id(name),
  name,
  folders: [],
  docs: [],
  fileRefs: [],
})
const wellFormedDoc = name => ({ _id: id(name), name })
const wellFormedFileRef = name => ({ _id: id(name), name, hash: 'h' })

const wellFormedProject = {
  _id: projectId,
  rootFolder: [
    {
      _id: rootFolderId,
      name: 'rootFolder',
      folders: [wellFormedFolder('f00'), wellFormedFolder('f01')],
      docs: [wellFormedDoc('d00'), wellFormedDoc('d01')],
      fileRefs: [wellFormedFileRef('fr00'), wellFormedFileRef('fr01')],
    },
  ],
}

const testCases = [
  ...[{}, { rootFolder: undefined }, { rootFolder: '1234' }].map(
    (project, idx) => ({
      name: `bad rootFolder ${idx + 1}`,
      project: { _id: projectId, ...project },
      expectFind: [
        {
          _id: null,
          projectId: projectId.toString(),
          msg: 'bad file-tree path',
          reason: 'bad rootFolder',
          path: 'rootFolder',
        },
      ],
      // FIXME: This is a bug in the script.
      expectFixError: 'Unexpected mongo path: rootFolder',
    })
  ),

  {
    name: `missing rootFolder`,
    project: { _id: projectId, rootFolder: [] },
    expectFind: [
      {
        _id: null,
        projectId: projectId.toString(),
        msg: 'bad file-tree path',
        reason: 'missing rootFolder',
        path: 'rootFolder.0',
      },
    ],
    expectFixStdout:
      '"gracefulShutdownInitiated":false,"processedLines":1,"success":1,"alreadyProcessed":0,"hash":0,"failed":0,"unmatched":0',
    expectProject: updatedProject => {
      expect(updatedProject.rootFolder[0]._id).to.be.an.instanceOf(ObjectId)
      expect(updatedProject).to.deep.equal({
        _id: projectId,
        rootFolder: [
          {
            _id: updatedProject.rootFolder[0]._id,
            name: 'rootFolder',
            folders: [],
            fileRefs: [],
            docs: [],
          },
        ],
      })
    },
  },

  {
    name: 'empty folder',
    project: {
      _id: projectId,
      rootFolder: [{ _id: '1234' }],
    },
    expectFind: [
      { reason: 'bad folder id', path: 'rootFolder.0._id' },
      { reason: 'bad folder name', path: 'rootFolder.0.name' },
      { reason: 'missing .folders', path: 'rootFolder.0.folders' },
      { reason: 'missing .docs', path: 'rootFolder.0.docs' },
      { reason: 'missing .fileRefs', path: 'rootFolder.0.fileRefs' },
    ].map(entry => ({
      ...entry,
      _id: '1234',
      msg: 'bad file-tree path',
      projectId: String(projectId),
    })),
    // FIXME: This is a bug in the script.
    expectFixError: 'Unexpected mongo path: rootFolder.0._id',
  },

  {
    name: 'missing fields',
    project: {
      _id: projectId,
      rootFolder: [{ _id: rootFolderId }],
    },
    expectFind: [
      { reason: 'bad folder name', path: 'rootFolder.0.name' },
      { reason: 'missing .folders', path: 'rootFolder.0.folders' },
      { reason: 'missing .docs', path: 'rootFolder.0.docs' },
      { reason: 'missing .fileRefs', path: 'rootFolder.0.fileRefs' },
    ].map(entry => ({
      ...entry,
      _id: rootFolderId.toString(),
      msg: 'bad file-tree path',
      projectId: String(projectId),
    })),
    expectFixStdout:
      '"gracefulShutdownInitiated":false,"processedLines":4,"success":4,"alreadyProcessed":0,"hash":0,"failed":0,"unmatched":0',
    expectProject: updatedProject => {
      expect(updatedProject).to.deep.equal({
        _id: projectId,
        rootFolder: [
          {
            _id: rootFolderId,
            docs: [],
            fileRefs: [],
            folders: [],
            name: 'rootFolder',
          },
        ],
      })
    },
  },

  {
    name: 'bad folder, bad doc, bad fileRef',
    project: {
      _id: projectId,
      rootFolder: [
        {
          _id: rootFolderId,
          name: 'rootFolder',
          folders: [null],
          docs: [null],
          fileRefs: [null, null],
        },
      ],
    },
    expectFind: [
      {
        path: 'rootFolder.0.folders.0',
        reason: 'bad folder',
      },
      {
        path: 'rootFolder.0.docs.0',
        reason: 'bad doc',
      },
      {
        path: 'rootFolder.0.fileRefs.0',
        reason: 'bad file',
      },
      {
        path: 'rootFolder.0.fileRefs.1',
        reason: 'bad file',
      },
    ].map(entry => ({
      ...entry,
      _id: rootFolderId.toString(),
      projectId: projectId.toString(),
      msg: 'bad file-tree path',
    })),
    expectFixStdout:
      '"gracefulShutdownInitiated":false,"processedLines":4,"success":3,"alreadyProcessed":1,"hash":0,"failed":0,"unmatched":0',
    expectProject: updatedProject => {
      expect(updatedProject).to.deep.equal({
        _id: projectId,
        rootFolder: [
          {
            _id: rootFolderId,
            name: 'rootFolder',
            docs: [],
            fileRefs: [],
            folders: [],
          },
        ],
      })
    },
  },

  {
    name: 'bad [folder|doc|fileRef] id',
    project: {
      _id: projectId,
      rootFolder: [
        {
          _id: rootFolderId,
          name: 'rootFolder',
          folders: [
            { _id: 123, name: 'file-a', folders: [], docs: [], fileRefs: [] },
            { name: 'file-b', folders: [], docs: [], fileRefs: [] },
          ],
          docs: [{ _id: '456', name: 'doc-a' }, { name: 'doc-b' }],
          fileRefs: [{ _id: null, name: 'ref-a' }, { name: 'ref-b' }],
        },
      ],
    },
    expectFind: [
      { reason: 'bad folder id', path: 'rootFolder.0.folders.0._id', _id: 123 },
      { reason: 'bad folder id', path: 'rootFolder.0.folders.1._id' },
      { reason: 'bad doc id', path: 'rootFolder.0.docs.0._id', _id: '456' },
      { reason: 'bad doc id', path: 'rootFolder.0.docs.1._id' },
      { reason: 'bad file id', path: 'rootFolder.0.fileRefs.0._id', _id: null },
      { reason: 'bad file id', path: 'rootFolder.0.fileRefs.1._id' },
    ].map(entry => ({
      ...entry,
      projectId: projectId.toString(),
      msg: 'bad file-tree path',
    })),
    expectFixStdout:
      '"gracefulShutdownInitiated":false,"processedLines":6,"success":3,"alreadyProcessed":3,"hash":0,"failed":0,"unmatched":0',
    expectProject: updatedProject => {
      expect(updatedProject).to.deep.equal({
        _id: projectId,
        rootFolder: [
          {
            _id: rootFolderId,
            name: 'rootFolder',
            folders: [
              { _id: 123, name: 'file-a', folders: [], docs: [], fileRefs: [] },
              {
                _id: updatedProject.rootFolder[0].folders[1]._id,
                name: 'file-b',
                folders: [],
                docs: [],
                fileRefs: [],
              },
            ],
            docs: [{ _id: '456', name: 'doc-a' }],
            fileRefs: [],
          },
        ],
      })
    },
  },

  {
    name: 'bad [folder|doc|fileRef] name',
    project: {
      _id: projectId,
      rootFolder: [
        {
          _id: rootFolderId,
          name: 'rootFolder',
          folders: [
            { _id: id('f00'), folders: [], docs: [], fileRefs: [] },
            { _id: id('f01'), name: 8, folders: [], docs: [], fileRefs: [] },
          ],
          docs: [{ _id: id('d00') }, { _id: id('d01'), name: null }],
          fileRefs: [
            { _id: id('fr00'), hash: 'h' },
            { _id: id('fr01'), hash: 'h', name: [] },
          ],
        },
      ],
    },
    expectFind: [
      {
        reason: 'bad folder name',
        path: 'rootFolder.0.folders.0.name',
        _id: strId('f00'),
      },
      {
        reason: 'bad folder name',
        path: 'rootFolder.0.folders.1.name',
        _id: strId('f01'),
      },
      {
        reason: 'bad doc name',
        path: 'rootFolder.0.docs.0.name',
        _id: strId('d00'),
      },
      {
        reason: 'bad doc name',
        path: 'rootFolder.0.docs.1.name',
        _id: strId('d01'),
      },
      {
        reason: 'bad file name',
        path: 'rootFolder.0.fileRefs.0.name',
        _id: strId('fr00'),
      },
      {
        reason: 'bad file name',
        path: 'rootFolder.0.fileRefs.1.name',
        _id: strId('fr01'),
      },
    ].map(entry => ({
      ...entry,
      projectId: projectId.toString(),
      msg: 'bad file-tree path',
    })),
    expectFixStdout:
      '"gracefulShutdownInitiated":false,"processedLines":6,"success":6,"alreadyProcessed":0,"hash":0,"failed":0,"unmatched":0',
    expectProject: updatedProject => {
      expect(updatedProject).to.deep.equal({
        _id: projectId,
        rootFolder: [
          {
            _id: rootFolderId,
            name: 'rootFolder',
            folders: [
              {
                _id: id('f00'),
                name: 'untitled',
                folders: [],
                docs: [],
                fileRefs: [],
              },
              {
                _id: id('f01'),
                name: 'untitled-1',
                folders: [],
                docs: [],
                fileRefs: [],
              },
            ],
            docs: [
              { _id: id('d00'), name: 'untitled' },
              { _id: id('d01'), name: 'untitled-1' },
            ],
            fileRefs: [
              { _id: id('fr00'), hash: 'h', name: 'untitled' },
              { _id: id('fr01'), hash: 'h', name: 'untitled-1' },
            ],
          },
        ],
      })
    },
  },

  {
    name: 'bad file hash',
    project: {
      ...wellFormedProject,
      rootFolder: [
        {
          ...wellFormedProject.rootFolder[0],
          fileRefs: [
            { _id: id('fa'), name: 'ref-a', hash: null },
            { _id: id('fb'), name: 'ref-b', hash: {} },
          ],
        },
      ],
    },
    expectFind: [
      { path: 'rootFolder.0.fileRefs.0.hash', _id: strId('fa') },
      { path: 'rootFolder.0.fileRefs.1.hash', _id: strId('fb') },
    ].map(entry => ({
      ...entry,
      projectId: projectId.toString(),
      reason: 'bad file hash',
      msg: 'bad file-tree path',
    })),
    expectFixError: new RegExp(
      `Missing file hash: ${projectId.toString()}/${id('fa').toString()}`
    ),
  },

  {
    name: 'well formed filetrees',
    project: wellFormedProject,
    expectFind: [],
    expectFixStdout:
      '"gracefulShutdownInitiated":false,"processedLines":1,"success":0,"alreadyProcessed":0,"hash":0,"failed":0,"unmatched":0',
    expectProject: updatedProject => {
      expect(updatedProject).to.deep.equal(wellFormedProject)
    },
  },

  {
    name: 'bug: shifted arrays in filetree',
    project: {
      _id: projectId,
      rootFolder: [
        {
          _id: rootFolderId,
          name: 'rootFolder',
          folders: [null, null, { ...wellFormedFolder('f02'), name: null }],
          docs: [null, null, { ...wellFormedDoc('d02'), name: null }],
          fileRefs: [null, null, { ...wellFormedFileRef('fr02'), name: null }],
        },
      ],
    },
    expectFind: [
      {
        _id: rootFolderId.toString(),
        path: 'rootFolder.0.folders.0',
        reason: 'bad folder',
      },
      {
        _id: rootFolderId.toString(),
        path: 'rootFolder.0.folders.1',
        reason: 'bad folder',
      },
      {
        _id: strId('f02'),
        path: 'rootFolder.0.folders.2.name',
        reason: 'bad folder name',
      },
      {
        _id: rootFolderId.toString(),
        path: 'rootFolder.0.docs.0',
        reason: 'bad doc',
      },
      {
        _id: rootFolderId.toString(),
        path: 'rootFolder.0.docs.1',
        reason: 'bad doc',
      },
      {
        _id: strId('d02'),
        path: 'rootFolder.0.docs.2.name',
        reason: 'bad doc name',
      },
      {
        _id: rootFolderId.toString(),
        path: 'rootFolder.0.fileRefs.0',
        reason: 'bad file',
      },
      {
        _id: rootFolderId.toString(),
        path: 'rootFolder.0.fileRefs.1',
        reason: 'bad file',
      },
      {
        _id: strId('fr02'),
        path: 'rootFolder.0.fileRefs.2.name',
        reason: 'bad file name',
      },
    ].map(entry => ({
      ...entry,
      projectId: projectId.toString(),
      msg: 'bad file-tree path',
    })),
    expectFixStdout:
      '"gracefulShutdownInitiated":false,"processedLines":9,"success":6,"alreadyProcessed":3,"hash":0,"failed":0,"unmatched":0',
    expectProject: updatedProject => {
      expect(updatedProject).to.deep.equal({
        _id: projectId,
        rootFolder: [
          {
            _id: rootFolderId,
            name: 'rootFolder',
            // FIXME: The 3 arrays should only contain 1 item: the well-formed item with the name 'untitled'.
            folders: [
              { ...wellFormedFolder('f02'), name: null },
              null,
              { name: 'untitled' },
            ],
            docs: [
              { ...wellFormedDoc('d02'), name: null },
              null,
              { name: 'untitled' },
            ],
            fileRefs: [
              { ...wellFormedFileRef('fr02'), name: null },
              null,
              { name: 'untitled' },
            ],
          },
        ],
      })
    },
  },
]

describe('find_malformed_filetrees and fix_malformed_filetree scripts', function () {
  testCases.forEach(
    ({
      name,
      project,
      expectFind,
      expectFixStdout,
      expectFixError,
      expectProject,
    }) => {
      describe(name, function () {
        beforeEach(async function () {
          await db.projects.insertOne(project)
        })

        it('finds malformed filetree', async function () {
          const stdout = await runScriptFind()
          expect(stdout.map(line => JSON.parse(line))).to.deep.equal(expectFind)
        })

        if (expectFixError) {
          it('fails to fix malformed filetrees', async function () {
            await expect(runScriptFix(expectFind)).to.be.rejectedWith(
              expectFixError
            )
          })
        } else {
          it('fixes malformed filetrees', async function () {
            const { stdout } = await runScriptFix(expectFind)
            expect(expectFixStdout).to.be.a('string')
            expect(stdout).to.include(expectFixStdout)
            const [updatedProject] = await findProjects()
            expectProject(updatedProject)
          })
        }
      })
    }
  )
})
