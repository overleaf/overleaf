// @ts-check
'use strict'

const assert = require('check-types').assert
const OError = require('@overleaf/o-error')

const FileMap = require('./file_map')
const V2DocVersions = require('./v2_doc_versions')

const FILE_LOAD_CONCURRENCY = 50

/**
 * @import { BlobStore, RawSnapshot, ReadonlyBlobStore } from "./types"
 * @import Change from "./change"
 * @import TextOperation from "./operation/text_operation"
 * @import File from "./file"
 */

class EditMissingFileError extends OError {}

/**
 * A Snapshot represents the state of a {@link Project} at a
 * particular version.
 */
class Snapshot {
  static PROJECT_VERSION_RX_STRING = '^[0-9]+\\.[0-9]+$'
  static PROJECT_VERSION_RX = new RegExp(Snapshot.PROJECT_VERSION_RX_STRING)
  static EditMissingFileError = EditMissingFileError

  /**
   * @param {RawSnapshot} raw
   * @return {Snapshot}
   */
  static fromRaw(raw) {
    assert.object(raw.files, 'bad raw.files')
    return new Snapshot(
      FileMap.fromRaw(raw.files),
      raw.projectVersion,
      V2DocVersions.fromRaw(raw.v2DocVersions),
      raw.timestamp ? new Date(raw.timestamp) : undefined
    )
  }

  toRaw() {
    /** @type RawSnapshot */
    const raw = {
      files: this.fileMap.toRaw(),
    }
    if (this.projectVersion) {
      raw.projectVersion = this.projectVersion
    }
    if (this.v2DocVersions) {
      raw.v2DocVersions = this.v2DocVersions.toRaw()
    }
    if (this.timestamp != null) {
      raw.timestamp = this.timestamp.toISOString()
    }
    return raw
  }

  /**
   * @param {FileMap} [fileMap]
   * @param {string} [projectVersion]
   * @param {V2DocVersions} [v2DocVersions]
   * @param {Date} [timestamp]
   */
  constructor(fileMap, projectVersion, v2DocVersions, timestamp) {
    assert.maybe.instance(fileMap, FileMap, 'bad fileMap')

    this.fileMap = fileMap || new FileMap({})
    this.projectVersion = projectVersion
    this.v2DocVersions = v2DocVersions
    this.timestamp = timestamp ?? null
  }

  /**
   * @return {string | null | undefined}
   */
  getProjectVersion() {
    return this.projectVersion
  }

  /**
   * @param {string} projectVersion
   */
  setProjectVersion(projectVersion) {
    assert.maybe.match(
      projectVersion,
      Snapshot.PROJECT_VERSION_RX,
      'Snapshot: bad projectVersion'
    )
    this.projectVersion = projectVersion
  }

  /**
   * @return {V2DocVersions | null | undefined}
   */
  getV2DocVersions() {
    return this.v2DocVersions
  }

  /**
   * @param {V2DocVersions} v2DocVersions
   */
  setV2DocVersions(v2DocVersions) {
    assert.maybe.instance(
      v2DocVersions,
      V2DocVersions,
      'Snapshot: bad v2DocVersions'
    )
    this.v2DocVersions = v2DocVersions
  }

  /**
   * @param {V2DocVersions} v2DocVersions
   */
  updateV2DocVersions(v2DocVersions) {
    // merge new v2DocVersions into this.v2DocVersions
    v2DocVersions.applyTo(this)
  }

  getTimestamp() {
    return this.timestamp
  }

  /**
   * @param {Date} timestamp
   */
  setTimestamp(timestamp) {
    this.timestamp = timestamp
  }

  /**
   * The underlying file map.
   * @return {FileMap}
   */
  getFileMap() {
    return this.fileMap
  }

  /**
   * The pathnames of all of the files.
   *
   * @return {Array.<string>} in no particular order
   */
  getFilePathnames() {
    return this.fileMap.getPathnames()
  }

  /**
   * Get a File by its pathname.
   * @see FileMap#getFile
   * @param {string} pathname
   */
  getFile(pathname) {
    return this.fileMap.getFile(pathname)
  }

  /**
   * Add the given file to the snapshot.
   * @see FileMap#addFile
   * @param {string} pathname
   * @param {File} file
   */
  addFile(pathname, file) {
    this.fileMap.addFile(pathname, file)
  }

  /**
   * Move or remove a file.
   * @see FileMap#moveFile
   * @param {string} pathname
   * @param {string} newPathname
   */
  moveFile(pathname, newPathname) {
    this.fileMap.moveFile(pathname, newPathname)
    if (this.v2DocVersions) this.v2DocVersions.moveFile(pathname, newPathname)
  }

  /**
   * The number of files in the snapshot.
   *
   * @return {number}
   */
  countFiles() {
    return this.fileMap.countFiles()
  }

  /**
   * Edit the content of an editable file.
   *
   * Throws an error if no file with the given name exists.
   *
   * @param {string} pathname
   * @param {TextOperation} textOperation
   */
  editFile(pathname, textOperation) {
    const file = this.fileMap.getFile(pathname)
    if (!file) {
      throw new Snapshot.EditMissingFileError(
        `can't find file for editing: ${pathname}`
      )
    }
    file.edit(textOperation)
  }

  /**
   * Apply all changes in sequence. Modifies the snapshot in place.
   *
   * Ignore recoverable errors (caused by historical bad data) unless opts.strict is true
   *
   * @param {Change[]} changes
   * @param {object} [opts]
   * @param {boolean} opts.strict - do not ignore recoverable errors
   */
  applyAll(changes, opts) {
    for (const change of changes) {
      change.applyTo(this, opts)
    }
  }

  /**
   * If the Files in this Snapshot reference blob hashes, add them to the given
   * set.
   *
   * @param  {Set.<String>} blobHashes
   */
  findBlobHashes(blobHashes) {
    /**
     * @param {File} file
     */
    function find(file) {
      const hash = file.getHash()
      const rangeHash = file.getRangesHash()
      if (hash) blobHashes.add(hash)
      if (rangeHash) blobHashes.add(rangeHash)
    }
    // TODO(das7pad): refine types to enforce no nulls in FileMapData
    // @ts-ignore
    this.fileMap.map(find)
  }

  /**
   * Load all of the files in this snapshot.
   *
   * @param {string} kind see {File#load}
   * @param {ReadonlyBlobStore} blobStore
   * @return {Promise<Record<string, File>>} an object where keys are the pathnames and
   * values are the files in the snapshot
   */
  async loadFiles(kind, blobStore) {
    /**
     * @param {File} file
     */
    function load(file) {
      return file.load(kind, blobStore)
    }
    // TODO(das7pad): refine types to enforce no nulls in FileMapData
    // @ts-ignore
    return await this.fileMap.mapAsync(load, FILE_LOAD_CONCURRENCY)
  }

  /**
   * Store each of the files in this snapshot and return the raw snapshot for
   * long term storage.
   *
   * @param {BlobStore} blobStore
   * @param {number} [concurrency]
   * @return {Promise.<Object>}
   */
  async store(blobStore, concurrency) {
    assert.maybe.number(concurrency, 'bad concurrency')

    const projectVersion = this.projectVersion
    const rawV2DocVersions = this.v2DocVersions
      ? this.v2DocVersions.toRaw()
      : undefined

    /**
     * @param {File} file
     */
    function store(file) {
      return file.store(blobStore)
    }
    // TODO(das7pad): refine types to enforce no nulls in FileMapData
    // @ts-ignore
    const rawFiles = await this.fileMap.mapAsync(store, concurrency)
    return {
      files: rawFiles,
      projectVersion,
      v2DocVersions: rawV2DocVersions,
      timestamp: this.getTimestamp() ?? undefined,
    }
  }

  /**
   * Create a deep clone of this snapshot.
   *
   * @return {Snapshot}
   */
  clone() {
    return Snapshot.fromRaw(this.toRaw())
  }
}

module.exports = Snapshot
