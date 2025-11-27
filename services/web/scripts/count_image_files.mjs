import {
  db,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.mjs'
import { extname } from 'node:path'
import { scriptRunner } from './lib/ScriptRunner.mjs'

const FILE_TYPES = [
  '.jpg',
  '.jpeg',
  '.png',
  '.bmp',
  '.webp',
  '.svg',
  '.pdf',
  '.eps',
  '.gif',
  '.ico',
  '.tiff',
]

const longestFileType = Math.max(...FILE_TYPES.map(fileType => fileType.length))

async function main() {
  const projects = db.projects.find(
    {},
    {
      projection: { rootFolder: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )
  let projectsProcessed = 0
  const result = new Map(FILE_TYPES.map(fileType => [fileType, 0]))
  for await (const project of projects) {
    projectsProcessed += 1
    if (projectsProcessed % 100000 === 0) {
      console.log(projectsProcessed, 'projects processed')
    }
    countFiles(project.rootFolder[0], result)
  }

  const sortedResults = [...result.entries()].sort(
    ([, countA], [, countB]) => countB - countA
  )

  sortedResults.forEach(([fileType, count]) => {
    console.log(
      `${fileType.padStart(longestFileType, ' ')}: ${count
        .toString()
        .padStart(7, ' ')}`
    )
  })
}

function countFiles(folder, result) {
  if (folder.folders) {
    for (const subfolder of folder.folders) {
      countFiles(subfolder, result)
    }
  }

  if (folder.fileRefs) {
    for (const file of folder.fileRefs) {
      const fileType = extname(file.name).toLowerCase()
      const current = result.get(fileType)
      if (current !== undefined) {
        result.set(fileType, current + 1)
      }
    }
  }
  return result
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
