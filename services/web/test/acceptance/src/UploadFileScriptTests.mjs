import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'
import logger from '@overleaf/logger'
import { expect } from 'chai'
import Errors from '../../../app/src/Features/Errors/Errors.js'
import ProjectLocator from '../../../app/src/Features/Project/ProjectLocator.mjs'
import UserHelper from './helpers/User.mjs'

const User = UserHelper.promises
const TEST_FILE_PATH = '/tmp/upload-file-script-test.txt'
const TEST_FILE_OVERWRITE_PATH = '/tmp/upload-file-script-overwrite-test.txt'

describe('UploadFileScriptTests', function () {
  let user
  let projectId

  beforeEach('create user and project', async function () {
    user = new User()
    await user.login()
    projectId = await user.createProject('upload-file-script-project')
  })

  afterEach('cleanup temporary files', async function () {
    for (const filePath of [TEST_FILE_PATH, TEST_FILE_OVERWRITE_PATH]) {
      try {
        await fs.unlink(filePath)
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error
        }
      }
    }
  })

  async function runScript(args) {
    let result
    try {
      result = await promisify(exec)(
        ['node', 'scripts/upload_file.mjs'].concat(args).join(' ')
      )
    } catch (error) {
      logger.error({ error }, 'script failed')
      throw error
    }
    return result
  }

  describe('create file', function () {
    it('should upload a local file into a project path', async function () {
      await fs.writeFile(TEST_FILE_PATH, 'upload-file-script-created-content')

      const destinationPath = '/uploads/created-by-script.txt'
      const { stdout } = await runScript([
        TEST_FILE_PATH,
        `--project-id=${projectId}`,
        `--user-id=${user._id.toString()}`,
        `--dest=${destinationPath}`,
        '-y',
      ])

      expect(stdout).to.include(
        `Applying: will create file at ${destinationPath}`
      )
      expect(stdout).to.match(
        new RegExp(
          `Success: created file\\. fileId=.* fileName=created-by-script\\.txt projectId=${projectId} path=${destinationPath}`
        )
      )
      expect(stdout).to.include('Done.')

      const { type, element } = await ProjectLocator.promises.findElementByPath(
        {
          project_id: projectId,
          path: destinationPath,
          exactCaseMatch: true,
        }
      )
      expect(type).to.equal('file')
      expect(element.name).to.equal('created-by-script.txt')
    })
  })

  describe('overwrite existing file', function () {
    it('should overwrite an existing destination when --force is provided', async function () {
      const project = await user.getProject(projectId)
      const rootFolderId = project.rootFolder[0]._id.toString()

      await user.uploadFileInProject(
        projectId,
        rootFolderId,
        '1pixel.png',
        'existing.png',
        'image/png'
      )

      await fs.writeFile(TEST_FILE_OVERWRITE_PATH, 'new-overwritten-content')

      const destinationPath = '/existing.png'
      const { stdout } = await runScript([
        TEST_FILE_OVERWRITE_PATH,
        `--project-id=${projectId}`,
        `--user-id=${user._id.toString()}`,
        `--dest=${destinationPath}`,
        '--force',
        '-y',
      ])

      expect(stdout).to.include(
        `Applying: will overwrite file at ${destinationPath}`
      )
      expect(stdout).to.include('Success: overwrote existing file.')

      const { type, element } = await ProjectLocator.promises.findElementByPath(
        {
          project_id: projectId,
          path: destinationPath,
          exactCaseMatch: true,
        }
      )
      expect(type).to.equal('file')
      expect(element.name).to.equal('existing.png')
    })
  })

  describe('dry run', function () {
    it('should show intended action without mutating the project', async function () {
      await fs.writeFile(TEST_FILE_PATH, 'dry-run-content')

      const destinationPath = '/dry-run-file.txt'
      const { stdout } = await runScript([
        TEST_FILE_PATH,
        `--project-id=${projectId}`,
        `--user-id=${user._id.toString()}`,
        `--dest=${destinationPath}`,
        '--dry-run',
        '-y',
      ])

      expect(stdout).to.include(
        `DRY RUN: would create file at ${destinationPath}`
      )
      expect(stdout).to.include('Done.')
      expect(stdout).to.not.include('Success:')

      try {
        await ProjectLocator.promises.findElementByPath({
          project_id: projectId,
          path: destinationPath,
          exactCaseMatch: true,
        })
        expect.fail('Expected destination path to not exist after dry run')
      } catch (error) {
        expect(error).to.be.instanceOf(Errors.NotFoundError)
      }
    })
  })

  describe('missing --force for existing destination', function () {
    it('should fail when destination exists and --force is not provided', async function () {
      const project = await user.getProject(projectId)
      const rootFolderId = project.rootFolder[0]._id.toString()

      await user.uploadFileInProject(
        projectId,
        rootFolderId,
        '1pixel.png',
        'existing-without-force.png',
        'image/png'
      )
      await fs.writeFile(TEST_FILE_OVERWRITE_PATH, 'content-not-used')

      const destinationPath = '/existing-without-force.png'
      try {
        await runScript([
          TEST_FILE_OVERWRITE_PATH,
          `--project-id=${projectId}`,
          `--user-id=${user._id.toString()}`,
          `--dest=${destinationPath}`,
          '-y',
        ])
        expect.fail('Expected upload_file script to fail without --force')
      } catch (error) {
        expect(error.stderr).to.include(
          `destination already exists at ${destinationPath} (type=file). Re-run with --force to overwrite.`
        )
      }

      const { type, element } = await ProjectLocator.promises.findElementByPath(
        {
          project_id: projectId,
          path: destinationPath,
          exactCaseMatch: true,
        }
      )
      expect(type).to.equal('file')
      expect(element.name).to.equal('existing-without-force.png')
    })
  })

  describe('destination is a folder', function () {
    it('should fail when destination path points to an existing folder', async function () {
      const project = await user.getProject(projectId)
      const rootFolderId = project.rootFolder[0]._id.toString()

      const folderName = 'uploads'
      const destinationPath = `/${folderName}`

      await new Promise((resolve, reject) => {
        user.request.post(
          {
            uri: `/project/${projectId}/folder`,
            json: {
              name: folderName,
              parent_folder_id: rootFolderId,
            },
          },
          (error, response, body) => {
            if (error) {
              return reject(error)
            }
            if (response.statusCode !== 200 || !body?._id) {
              return reject(
                new Error(
                  `folder creation failed: status=${response.statusCode} body=${JSON.stringify(body)}`
                )
              )
            }
            resolve()
          }
        )
      })

      await fs.writeFile(TEST_FILE_PATH, 'folder-destination-content')

      try {
        await runScript([
          TEST_FILE_PATH,
          `--project-id=${projectId}`,
          `--user-id=${user._id.toString()}`,
          `--dest=${destinationPath}`,
          '-y',
        ])
        expect.fail(
          'Expected upload_file script to fail for folder destination'
        )
      } catch (error) {
        expect(error.stderr).to.include(
          `destination is a folder at ${destinationPath}. Choose a file path within that folder.`
        )
      }

      const { type, element } = await ProjectLocator.promises.findElementByPath(
        {
          project_id: projectId,
          path: destinationPath,
          exactCaseMatch: true,
        }
      )
      expect(type).to.equal('folder')
      expect(element.name).to.equal(folderName)
    })
  })
})
