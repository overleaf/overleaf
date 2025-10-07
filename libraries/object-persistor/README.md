# @overleaf/object-persistor

Stores arbitrary objects in multiple backends, with support for falling back to a secondary backend if the object can't be found in the primary.

Contains a workaround within the GCS backend to allow lifecycle rules to keep objects for a set period of time from deletion, which can't currently be accomplished with GCS's own rules. (See configuration-specific notes later)

## Backends available

- S3
- GCS
- Filesystem (FS)

## Getting started

```JavaScript
// import the module
const ObjectPersistor = require('object-persistor')

const config = {
  // see 'Configuration' section below
}
// create a new persistor
const Persistor = ObjectPersistor(config)
```

### Errors

Errors returned by persistor methods are all derived from `OError` (`@overleaf/o-error`.) To perform `instanceof` checks, you can use the `Errors` object from the persistor module:

```JavaScript
const ObjectPersistor = require('object-persistor')
const { Errors } = ObjectPersistor
```

### Methods

#### sendStream

```JavaScript
async function sendStream(bucketName, key, readStream, opts = {})
```

Uploads a stream to the backend.

- `bucketName`: The name of the bucket to upload to
- `key`: The key for the uploaded object
- `readStream`: The data stream to upload
- `opts` (optional):
    - `sourceMd5`: The md5 hash of the source data, if known. The uploaded data will be compared against this and the operation will fail if it does not match. If omitted, the md5 is calculated as the data is uploaded instead, and verified against the backend. This is not supported in `S3Persistor` as it performs [its own integrity protections](https://aws.amazon.com/blogs/aws/introducing-default-data-integrity-protections-for-new-objects-in-amazon-s3/). Setting `sourceMd5` with `S3Persistor` will result in an error being thrown.
    - `contentType`: The content type to write in the object metadata
    - `contentEncoding`: The content encoding to write in the object metadata

##### Notes

When using a secondary persistor, this method uploads only to the primary.

If an object already exists at the specified key, it will be overwritten.

#### getObjectStream

```JavaScript
async function getObjectStream(bucketName, key, opts = {})
```

Retrieves a stream from the backend, for reading

- `bucketName`: The name of the bucket to download from
- `key`: The key for the object
- `opts` (optional):
  - `start`, `end`: Downloads a byte range from the object. Specify both `start` and `end`. `end` is inclusive.

##### Returns

A `stream.Readable` to read the data.

##### Notes

When using a secondary persistor, this method will fall back to retrieving the object from the secondary if it does not exist on the primary.

#### getRedirectUrl

```JavaScript
async function getRedirectUrl(bucketName, key)
```

Gets a signed link directly to the backend, if possible. This can be used to download the data directly, instead of proxying it.

- `bucketName`: The name of the bucket to download from
- `key`: The key for the object

##### Returns

A `string` containing the signed link, or `null` if a link cannot be generated.

##### Notes

In the case of `null`, you should fall back to `getObjectStream` as sometimes signed links cannot be generated.

Do not use this method if you are using a secondary persistor, as this mechanism does not check to see if the object actually exists - so cannot provide a fallback.

#### getObjectSize

```JavaScript
async function getObjectSize(bucketName, key)
```

Returns the size of the stored data

- `bucketName`: The name of the bucket to download from
- `key`: The key for the object

##### Returns

An integer containing the size, in bytes.

##### Notes

When using a secondary persistor this method returns the size from the secondary persistor, if not found on the primary.

#### getObjectMd5Hash

```JavaScript
async function getObjectMd5Hash(bucketName, key)
```

Returns the MD5 hash of the stored data

- `bucketName`: The name of the bucket to download from
- `key`: The key for the object

##### Returns

A string containing the hex representation of the MD5 hash

##### Notes

When using a secondary persistor this method returns the hash from the secondary persistor, if not found on the primary.

#### deleteFile

```JavaScript
async function deleteFile(bucketName, key)
```

Deletes an object

- `bucketName`: The name of the bucket to delete from
- `key`: The key for the object

##### Notes

When using a secondary persistor, this deletes the object from _both_ persistors.

#### deleteDirectory

```JavaScript
async function deleteDirectory(bucketName, key)
```

Deletes a directory (all object whose keys start with the supplied `key`)

- `bucketName`: The name of the bucket to delete from
- `key`: The key prefix for the objects

##### Notes

When using a secondary persistor, this deletes the objects from _both_ persistors.

#### directorySize

```JavaScript
async function directorySize(bucketName, key)
```

Returns the size of a directory (all objects whose keys start with the supplied `key`)

- `bucketName`: The name of the bucket to examine
- `key`: The key prefix for the objects

##### Returns

An integer containing the size, in bytes

##### Notes

When using a secondary persistor, this returns the value from the secondary persistor if no objects are found on the primary.

#### checkIfObjectExists

```JavaScript
async function checkIfObjectExists(bucketName, key)
```

Returns whether an object exists

- `bucketName`: The name of the bucket to examine
- `key`: The key for the object

##### Returns

A boolean representing whether the object exists

##### Notes

When using a secondary persistor, returns true if the object exists on either the primary or secondary.

#### copyObject

```JavaScript
async function copyObject(bucketName, sourceKey, destKey)
```

Copies a object to another key, within a bucket.

- `bucketName`: The name of the bucket in which to copy the object
- `sourceKey`: The key for the object to be copied
- `destKey`: The key to which the object should be copied

##### Notes

Can only copy objects within a single bucket. To copy objects in any other way, pass the stream returned from `getObjectStream` to `sendStream`

If an object already exists at the specified key, it will be overwritten.

#### sendFile

```JavaScript
async function sendFile(bucketName, key, fsPath)
```

Uploads a file from the local disk.

- `bucketName`: The name of the bucket to upload to
- `key`: The key for the uploaded object
- `fsPath`: The path on disk to the file for uploading

##### Notes

When using a secondary persistor, this method uploads only to the primary.

If an object already exists at the specified key, it will be overwritten.

This method is designed for applications which may write temporary data out to the disk before uploading.

## Configuration

An object with the relevant configuration should be passed to the main function returned from the module. The object contains both common and backend-specific parameters.

### Common parameters

- `backend` (required): String specifying the primary persistor to use as the storage backend. Must be one of `s3`, `gcs` or `fs`.
- `signedUrlExpiryInMs`: Time before expiry (in milliseconds) of signed URLs

### FS-specific parameters

- `useSubdirectories`: If true, files will be stored in subdirectories on the filesystem. By default, the directory structure is flattened and slashes in the object keys are replaced with underscores.

#### Notes

For the `FS` persistor, the `bucketName` should be the full path to the folder on disk where the files are stored.

### S3-specific parameters

- `s3.key` (required): The AWS access key ID
- `s3.secret` (required): The AWS secret access key
- `s3.partSize`: The part size for S3 uploads. Defaults to 100 megabytes.
- `s3.httpOptions`: HTTP Options passed to the [`NodeHttpHandler` constructor](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-smithy-node-http-handler/Class/NodeHttpHandler/)
  - For backwards compatibility reasons, the `timeout` property that was passed to the [S3 constructor](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property) before migrating to AWS SDK v3 is now passed to the `NodeHttpHandler` constructor as `connectionTimeout`.
- `s3.maxRetries` (legacy): The number of times the S3 client will retry in case of an error
- `s3.maxAttempts`: The number of times the S3 client will attempt to perform the operation in case there are errors. Default value is 3.
- `s3.endpoint`: For testing - overrides the S3 endpoint to use a different service (e.g. a fake S3 server)
- `s3.pathStyle`: For testing - use old path-style URLs, for services that do not support subdomain-based access

- `s3BucketCreds`: A JSON-encoded string specifying different S3 credentials for accessing different buckets, in the following format. These credentials override the default ones configured in the main `s3` settings:

```json
{
  "bucketName": {
    "auth_key": "your aws access key ID",
    "auth_secret": "your aws secret access key"
  }
}
```

### GCS-specific parameters

GCS authentication is configured automatically via the local service account, or the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

- `gcs.unlockBeforeDelete`: unlock an event-based hold before deleting. default false (see notes)
- `gcs.deletedBucketSuffix`: if present, copy the object to a bucket with this suffix before deletion (see notes)
- `gcs.deleteConcurrency`: when recursively deleting a directory, the maximum number of delete requests that will be used at once (default 50)
- `gcs.unsignedUrls`: For testing - do not sign GCS download URLs
- `gcs.endpoint.apiEndpoint`: For testing - specify a different GCS endpoint to use
- `gcs.endpoint.projectId`: For testing - the GCS project ID to supply to the overridden backend

#### Notes

In order to support deletion after a period, the GCS persistor allows usage of a two-bucket system. The main bucket contains the live objects, and on delete the objects are first copied to a 'deleted' bucket, and then deleted from the main one. The 'deleted' bucket is then expected to have a lifecycle policy applied to delete objects after a set period.

In order to prevent accidental deletion from outside this mechanism, an event-based-hold can be applied by default on the main bucket. This will be unlocked _after_ the object has been copied to the 'deleted' bucket so that the object can then be deleted from the main bucket.

## Contributing

Contributions should pass lint, formatting and unit test checks. To run these, use

```
npm run test
```

There are no acceptance tests in this module, but https://github.com/overleaf/filestore/ contains a comprehensive set of acceptance tests that use this module. These should also pass, with the changes.
