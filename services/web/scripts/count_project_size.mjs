import readline from 'node:readline'
import { ObjectId, db } from '../app/src/infrastructure/mongodb.mjs'
import ProjectEntityHandler from '../app/src/Features/Project/ProjectEntityHandler.mjs'
import ProjectGetter from '../app/src/Features/Project/ProjectGetter.mjs'
import Errors from '../app/src/Features/Errors/Errors.js'
import HistoryManager from '../app/src/Features/History/HistoryManager.mjs'

// Handles a list of project IDs from stdin, one per line, and outputs the count of files and docs
// in the project, along with the aggregated size in bytes for all files and docs.
//
// It outputs to stderr, so that the logging junk can be piped elsewhere - e.g., running like:
//      node scripts/count_project_size.mjs < /tmp/project_ids.txt /dev/null 2> /tmp/output.txt
//
// The output format is line-per-project with data separated by a single space, containing:
//     - projectId
//     - file count
//     - deleted files count
//     - doc count
//     - deleted docs count
//     - total size in bytes of (non deleted) files
//     - total size in bytes of (non deleted) docs

async function countProjectFiles() {
  const rl = readline.createInterface({
    input: process.stdin,
  })

  for await (const projectId of rl) {
    try {
      const project = await ProjectGetter.promises.getProject(projectId)
      if (!project) {
        throw new Errors.NotFoundError('project not found')
      }

      const { files, docs } =
        ProjectEntityHandler.getAllEntitiesFromProject(project)

      const [fileSize, docSize] = await Promise.all([
        countFilesSize(files, projectId),
        countDocsSizes(docs),
      ])

      console.error(
        projectId,
        files.length,
        docs.length,
        (project.deletedDocs && project.deletedDocs.length) || 0,
        fileSize,
        docSize
      )
    } catch (err) {
      if (err instanceof Errors.NotFoundError) {
        console.error(projectId, 'NOTFOUND')
      } else {
        console.log(projectId, 'ERROR', err.name, err.message)
      }
    }
  }
}

async function countFilesSize(files, projectId) {
  if (!files?.length > 0) {
    return 0
  }

  let totalFileSize = 0

  for (const { file } of files) {
    const { contentLength } =
      await HistoryManager.promises.requestBlobWithProjectId(
        projectId,
        file.hash,
        'HEAD'
      )
    totalFileSize += contentLength
  }

  return totalFileSize
}

async function countDocsSizes(docs) {
  if (!docs?.length > 0) {
    return 0
  }
  const ids = docs.map(docObject => docObject.doc._id)

  let totalDocSize = 0

  for (const docId of ids) {
    const result = await db.docs.aggregate([
      {
        $match: { _id: new ObjectId(docId) },
      },
      {
        $project: {
          lineSizeInBytes: {
            $reduce: {
              input: { $ifNull: ['$lines', []] },
              initialValue: 0,
              in: {
                $add: ['$$value', { $strLenBytes: '$$this' }],
              },
            },
          },
        },
      },
    ])

    const { lineSizeInBytes } = await result.next()

    if (isNaN(lineSizeInBytes)) {
      throw new Error(`Unable to fetch 'lineSizeInBytes' for docId=${docId}`)
    }

    totalDocSize += lineSizeInBytes
  }
  return totalDocSize
}

try {
  await countProjectFiles()
  process.exit(0)
} catch (error) {
  console.log('Aiee, something went wrong!', error)
  process.exit(1)
}
