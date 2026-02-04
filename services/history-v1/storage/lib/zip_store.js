'use strict'

const BPromise = require('bluebird')
const config = require('config')
const fs = require('node:fs')
const path = require('node:path')

const OError = require('@overleaf/o-error')
const objectPersistor = require('@overleaf/object-persistor')

const assert = require('./assert')
const { BlobStore } = require('./blob_store')
const persistor = require('./persistor')
const ProjectArchive = require('./project_archive')
const projectKey = require('@overleaf/object-persistor/src/ProjectKey.js')
const temp = require('./temp')

const BUCKET = config.get('zipStore.bucket')

function getZipKey(projectId, version) {
  return path.join(
    projectKey.format(projectId),
    version.toString(),
    'project.zip'
  )
}

/**
 * Store a zip of a given version of a project in bucket.
 *
 * @class
 */
class ZipStore {
  /**
   * Generate signed link to access the zip file.
   *
   * @param {number | string} projectId
   * @param {number} version
   * @return {string}
   */
  async getSignedUrl(projectId, version) {
    assert.projectId(projectId, 'bad projectId')
    assert.integer(version, 'bad version')

    const key = getZipKey(projectId, version)
    return await persistor.getRedirectUrl(BUCKET, key)
  }

  /**
   * Generate a zip of the given snapshot.
   *
   * @param {number | string} projectId
   * @param {number} version
   * @param {Snapshot} snapshot
   */
  async storeZip(projectId, version, snapshot) {
    assert.projectId(projectId, 'bad projectId')
    assert.integer(version, 'bad version')
    assert.object(snapshot, 'bad snapshot')

    const zipKey = getZipKey(projectId, version)

    if (await isZipPresent()) return

    await BPromise.using(temp.open('zip'), async tempFileInfo => {
      await zipSnapshot(tempFileInfo.path, snapshot)
      await uploadZip(tempFileInfo.path)
    })

    // If the file is already there, we don't need to build the zip again. If we
    // just HEAD the file, there's a race condition, because the zip files
    // automatically expire. So, we try to copy the file from itself to itself,
    // and if it fails, we know the file didn't exist. If it succeeds, this has
    // the effect of re-extending its lifetime.
    async function isZipPresent() {
      try {
        await persistor.copyObject(BUCKET, zipKey, zipKey)
        return true
      } catch (error) {
        if (!(error instanceof objectPersistor.Errors.NotFoundError)) {
          console.error(
            'storeZip: isZipPresent: unexpected error (except in dev): %s',
            error
          )
        }
        return false
      }
    }

    async function zipSnapshot(tempPathname, snapshot) {
      const blobStore = new BlobStore(projectId)
      const zipTimeoutMs = parseInt(config.get('zipStore.zipTimeoutMs'), 10)
      const archive = new ProjectArchive(snapshot, zipTimeoutMs)
      try {
        await archive.writeZip(blobStore, tempPathname)
      } catch (err) {
        throw new ZipStore.CreationError(projectId, version).withCause(err)
      }
    }

    async function uploadZip(tempPathname, snapshot) {
      const stream = fs.createReadStream(tempPathname)
      try {
        await persistor.sendStream(BUCKET, zipKey, stream, {
          contentType: 'application/zip',
        })
      } catch (err) {
        throw new ZipStore.UploadError(projectId, version).withCause(err)
      }
    }
  }
}

class CreationError extends OError {
  constructor(projectId, version) {
    super(`Zip creation failed for ${projectId} version ${version}`, {
      projectId,
      version,
    })
  }
}
ZipStore.CreationError = CreationError

class UploadError extends OError {
  constructor(projectId, version) {
    super(`Zip upload failed for ${projectId} version ${version}`, {
      projectId,
      version,
    })
  }
}
ZipStore.UploadError = UploadError

module.exports = new ZipStore()
