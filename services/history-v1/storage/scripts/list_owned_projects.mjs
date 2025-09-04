import mongodb from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'
import { getProjectBlobsBatch } from '../lib/blob_store/index.js'

const ONE_MIB = 1024 * 1024

const userId = new ObjectId(process.argv.pop())

const ownedProjects = await mongodb.projects
  .find({ owner_ref: userId }, { projection: { _id: 1, overleaf: 1 } })
  .toArray()
const { blobs } = await getProjectBlobsBatch(
  ownedProjects.map(p => p.overleaf.history.id)
)

console.log(
  'link,id,historyId,size,avgSize,sizeBytes,nBlobs,nTextBlobs,nBinaryBlobs'
)
for (const project of ownedProjects) {
  const historyId = project.overleaf.history.id.toString()
  const projectBlobs = blobs.get(historyId) || []
  const sum = projectBlobs.reduce((sum, blob) => sum + blob.getByteLength(), 0)
  console.log(
    [
      `https://admin.overleaf.com/admin/project/${project._id}`,
      project._id,
      historyId,
      (sum / ONE_MIB).toFixed(1) + 'MiB',
      sum && (sum / projectBlobs.length / ONE_MIB).toFixed(1) + 'MiB',
      sum,
      projectBlobs.length,
      projectBlobs.filter(b => b.getStringLength() !== null).length,
      projectBlobs.filter(b => b.getStringLength() === null).length,
    ].join(',')
  )
}

process.exit(0)
