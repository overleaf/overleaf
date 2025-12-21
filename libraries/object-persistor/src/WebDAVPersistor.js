const fs = require("node:fs");
const { pipeline } = require("node:stream/promises");
const { PassThrough } = require("node:stream");
const { createClient } = require("webdav");
const AbstractPersistor = require("./AbstractPersistor");
const { ReadError, WriteError } = require("./Errors");
const PersistorHelper = require("./PersistorHelper");

module.exports = class WebDAVPersistor extends AbstractPersistor {
  constructor(settings = {}) {
    super();
    this.settings = settings;

    if (!settings.url) {
      throw new Error("WebDAV URL is required");
    }

    // Create WebDAV client
    this.client = createClient(settings.url, {
      username: settings.username,
      password: settings.password,
    });

    // Base path for all operations (e.g., '/overleaf')
    this.basePath = (settings.basePath || "/overleaf").replace(/\/$/, "");
  }

  /**
   * Build the full remote path for a given location and key
   * @param {string} location - The bucket/container name
   * @param {string} key - The file key/path
   * @returns {string} The full remote path
   */
  _buildRemotePath(location, key) {
    // Normalize key by removing trailing slashes
    const normalizedKey = key.replace(/\/$/, "");
    return `${this.basePath}/${location}/${normalizedKey}`;
  }

  async sendFile(location, target, source) {
    try {
      const sourceStream = fs.createReadStream(source);
      await this.sendStream(location, target, sourceStream);
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        "failed to upload file",
        { location, target, source },
        WriteError,
      );
    }
  }

  async sendStream(location, target, sourceStream, opts = {}) {
    const remotePath = this._buildRemotePath(location, target);

    try {
      // Ensure parent directory exists
      await this._ensureDirectoryExists(remotePath);

      const observerOptions = {
        metric: "webdav.egress", // egress from us to WebDAV
        bucket: location,
        // Always calculate MD5 for verification or storage consistency
        // Note: This adds overhead but ensures data integrity
        hash: "md5",
      };

      const observer = new PersistorHelper.ObserverStream(observerOptions);

      // For MD5 verification, we need to buffer the data
      // This is consistent with how other persistors handle MD5 verification
      // Note: This buffers the entire file in memory, which may not be suitable
      // for very large files, but is necessary for MD5 verification
      const chunks = [];
      const passThrough = new PassThrough();

      passThrough.on("data", (chunk) => {
        chunks.push(chunk);
      });

      // Pipeline the source through observer to passThrough
      await pipeline(sourceStream, observer, passThrough);

      // Combine chunks into a buffer
      const buffer = Buffer.concat(chunks);

      // Verify MD5 if provided
      if (opts.sourceMd5) {
        const actualMd5 = observer.getHash();
        if (actualMd5 !== opts.sourceMd5) {
          throw new WriteError("md5 hash mismatch", {
            expectedMd5: opts.sourceMd5,
            actualMd5,
          });
        }
      }

      // Upload to WebDAV
      // When ifNoneMatch === '*', set overwrite to false to prevent overwriting existing files
      await this.client.putFileContents(remotePath, buffer, {
        overwrite: opts.ifNoneMatch !== "*",
      });
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        "failed to upload stream",
        { location, target, ifNoneMatch: opts.ifNoneMatch },
        WriteError,
      );
    }
  }

  async getObjectStream(location, name, opts = {}) {
    const remotePath = this._buildRemotePath(location, name);

    try {
      const observer = new PersistorHelper.ObserverStream({
        metric: "webdav.ingress", // ingress to us from WebDAV
        bucket: location,
      });

      // Get the file content as a stream
      let contentStream;

      if (opts.start !== undefined || opts.end !== undefined) {
        // Range request
        const rangeHeader = this._buildRangeHeader(opts.start, opts.end);
        contentStream = this.client.createReadStream(remotePath, {
          headers: { Range: rangeHeader },
        });
      } else {
        // Full file request
        contentStream = this.client.createReadStream(remotePath);
      }

      // Return a PassThrough stream with minimal interface
      const pass = new PassThrough();
      // Pipeline errors are handled by the pass stream's error event
      // This is consistent with FSPersistor pattern
      pipeline(contentStream, observer, pass).catch(() => { });
      return pass;
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        "failed to get object stream",
        { location, name, opts },
        ReadError,
      );
    }
  }

  async getRedirectUrl() {
    // WebDAV does not support signed URLs
    return null;
  }

  async getObjectSize(location, filename) {
    const remotePath = this._buildRemotePath(location, filename);

    try {
      const stat = await this.client.stat(remotePath);
      return stat.size;
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        "failed to get object size",
        { location, filename },
        ReadError,
      );
    }
  }

  async getObjectMd5Hash(location, filename) {
    try {
      const stream = await this.getObjectStream(location, filename);
      const hash = await PersistorHelper.calculateStreamMd5(stream);
      return hash;
    } catch (err) {
      throw new ReadError(
        "unable to get md5 hash from file",
        { location, filename },
        err,
      );
    }
  }

  async copyObject(location, source, target) {
    const sourcePath = this._buildRemotePath(location, source);
    const targetPath = this._buildRemotePath(location, target);

    try {
      await this._ensureDirectoryExists(targetPath);
      await this.client.copyFile(sourcePath, targetPath);
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        "failed to copy object",
        { location, source, target },
        WriteError,
      );
    }
  }

  async deleteObject(location, name) {
    const remotePath = this._buildRemotePath(location, name);

    try {
      const exists = await this.client.exists(remotePath);
      if (exists) {
        await this.client.deleteFile(remotePath);
      }
      // Consistent with S3 - no error if file doesn't exist
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        "failed to delete object",
        { location, name },
        WriteError,
      );
    }
  }

  async deleteDirectory(location, name) {
    const remotePath = this._buildRemotePath(location, name);

    try {
      const exists = await this.client.exists(remotePath);
      if (exists) {
        // List all files in directory first
        const contents = await this.client.getDirectoryContents(remotePath, {
          deep: true,
        });

        // Delete files first (in reverse order to delete nested files before directories)
        for (let i = contents.length - 1; i >= 0; i--) {
          const item = contents[i];
          if (item.type === "file") {
            await this.client.deleteFile(item.filename);
          }
        }

        // Delete directories (in reverse order to delete nested directories first)
        for (let i = contents.length - 1; i >= 0; i--) {
          const item = contents[i];
          if (item.type === "directory") {
            await this.client.deleteFile(item.filename);
          }
        }

        // Finally delete the parent directory
        await this.client.deleteFile(remotePath);
      }
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        "failed to delete directory",
        { location, name },
        WriteError,
      );
    }
  }

  async checkIfObjectExists(location, name) {
    const remotePath = this._buildRemotePath(location, name);

    try {
      return await this.client.exists(remotePath);
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        "failed to check if object exists",
        { location, name },
        ReadError,
      );
    }
  }

  async directorySize(location, name) {
    const remotePath = this._buildRemotePath(location, name);

    try {
      const exists = await this.client.exists(remotePath);
      if (!exists) {
        return 0;
      }

      const contents = await this.client.getDirectoryContents(remotePath, {
        deep: true,
      });

      let size = 0;
      for (const item of contents) {
        if (item.type === "file") {
          size += item.size;
        }
      }

      return size;
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        "failed to get directory size",
        { location, name },
        ReadError,
      );
    }
  }

  async listDirectoryKeys(location, prefix) {
    const remotePath = this._buildRemotePath(location, prefix);

    try {
      const exists = await this.client.exists(remotePath);
      if (!exists) {
        return [];
      }

      const contents = await this.client.getDirectoryContents(remotePath, {
        deep: true,
      });

      const keys = [];
      for (const item of contents) {
        if (item.type === "file") {
          // Return relative path from the location
          const fullPath = item.filename;
          const relativePath = fullPath.replace(
            `${this.basePath}/${location}/`,
            "",
          );
          keys.push(relativePath);
        }
      }

      return keys;
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        "failed to list directory keys",
        { location, prefix },
        ReadError,
      );
    }
  }

  async listDirectoryStats(location, prefix) {
    const remotePath = this._buildRemotePath(location, prefix);

    try {
      const exists = await this.client.exists(remotePath);
      if (!exists) {
        return [];
      }

      const contents = await this.client.getDirectoryContents(remotePath, {
        deep: true,
      });

      const stats = [];
      for (const item of contents) {
        if (item.type === "file") {
          // Return relative path from the location
          const fullPath = item.filename;
          const relativePath = fullPath.replace(
            `${this.basePath}/${location}/`,
            "",
          );
          stats.push({ key: relativePath, size: item.size });
        }
      }

      return stats;
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        "failed to list directory stats",
        { location, prefix },
        ReadError,
      );
    }
  }

  /**
   * Ensure the parent directory of a path exists
   * @param {string} remotePath - The full remote path
   */
  async _ensureDirectoryExists(remotePath) {
    const dirPath = remotePath.substring(0, remotePath.lastIndexOf("/"));

    try {
      const exists = await this.client.exists(dirPath);
      if (!exists) {
        await this.client.createDirectory(dirPath, { recursive: true });
      }
    } catch (err) {
      // Ignore errors if directory already exists
      // 405 = Method Not Allowed (returned when directory already exists in some WebDAV implementations)
      if (err.status !== 405 && err.response?.status !== 405) {
        throw err;
      }
    }
  }

  /**
   * @param {string} location
   * @param {string} name
   * @return {Promise<{lastModified: Date, size: number}>}
   */
  async getObjectMetadata(location, name) {
    const remotePath = this._buildRemotePath(location, name)

    try {
      const stat = await this.client.stat(remotePath)
      return {
        lastModified: new Date(stat.lastmod),
        size: stat.size,
      }
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'failed to get object metadata',
        { location, name },
        ReadError
      )
    }
  }

  /**
   * Build a Range header for partial content requests
   * @param {number} start - Start byte position (0-indexed)
   * @param {number} end - End byte position (inclusive, 0-indexed)
   * @returns {string} Range header value
   */
  _buildRangeHeader(start, end) {
    if (start !== undefined && end !== undefined) {
      return `bytes=${start}-${end}`;
    } else if (start !== undefined) {
      return `bytes=${start}-`;
    } else if (end !== undefined) {
      // Note: This requests bytes from start to end, not the last 'end' bytes
      // In practice, start and end are typically provided together
      return `bytes=0-${end}`;
    }
    return "bytes=0-";
  }
};
