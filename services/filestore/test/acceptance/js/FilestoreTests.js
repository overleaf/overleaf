import chai from 'chai'
import fs from 'node:fs'
import Stream from 'node:stream'
import Settings from '@overleaf/settings'
import Path from 'node:path'
import FilestoreApp from './FilestoreApp.js'
import TestHelper from './TestHelper.js'
import fetch from 'node-fetch'
import { promisify } from 'node:util'
import { Storage } from '@google-cloud/storage'
import streamifier from 'streamifier'
import { ObjectId } from 'mongodb'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import ChildProcess from 'node:child_process'
import chaiAsPromised from 'chai-as-promised'

// store settings for multiple backends, so that we can test each one.
// fs will always be available - add others if they are configured
import TestConfig from './TestConfig.js'

import {
  AlreadyWrittenError,
  NotFoundError,
  NotImplementedError,
  NoKEKMatchedError,
} from '@overleaf/object-persistor/src/Errors.js'
import {
  PerProjectEncryptedS3Persistor,
  RootKeyEncryptionKey,
} from '@overleaf/object-persistor/src/PerProjectEncryptedS3Persistor.js'
import { S3Persistor } from '@overleaf/object-persistor/src/S3Persistor.js'
import crypto from 'node:crypto'
import { WritableBuffer } from '@overleaf/stream-utils'
import { gzipSync } from 'node:zlib'

const { expect } = chai

chai.use(chaiAsPromised)

const {
  BackendSettings,
  s3Config,
  s3SSECConfig,
  AWS_S3_USER_FILES_STORAGE_CLASS,
} = TestConfig

const fsWriteFile = promisify(fs.writeFile)
const fsStat = promisify(fs.stat)
const exec = promisify(ChildProcess.exec)
const msleep = promisify(setTimeout)

if (!process.env.AWS_ACCESS_KEY_ID) {
  throw new Error('please provide credentials for the AWS S3 test server')
}

process.on('unhandledRejection', e => {
  // eslint-disable-next-line no-console
  console.log('** Unhandled Promise Rejection **\n', e)
  throw e
})

describe('Filestore', function () {
  this.timeout(1000 * 10)
  const filestoreUrl = `http://127.0.0.1:${Settings.internal.filestore.port}`

  const seenSockets = []
  async function expectNoSockets() {
    try {
      await msleep(1000)
      const { stdout } = await exec('ss -tn')
      const lines = stdout.split('\n')
      const header = lines.shift()

      const badSockets = []
      for (const socket of lines) {
        const fields = socket.split(' ').filter(part => part !== '')
        if (
          fields.length > 2 &&
          parseInt(fields[1]) &&
          !seenSockets.includes(socket)
        ) {
          badSockets.push(socket)
          seenSockets.push(socket)
        }
      }

      if (badSockets.length) {
        // eslint-disable-next-line no-console
        console.error(
          'ERR: Sockets still have receive buffer after connection closed'
        )
        console.error(header)
        for (const socket of badSockets) {
          // eslint-disable-next-line no-console
          console.error(socket)
        }
        throw new Error('Sockets still open after connection closed')
      }
    } catch (err) {
      expect(err).not.to.exist
    }
  }

  // redefine the test suite for every available backend
  for (const [backendVariantWithShardNumber, backendSettings] of Object.entries(
    BackendSettings
  )) {
    describe(backendVariantWithShardNumber, function () {
      let app,
        previousEgress,
        previousIngress,
        metricPrefix,
        templateId,
        otherProjectId,
        templateUrl,
        fileId,
        fileKey,
        fileUrl

      const dataEncryptionKeySize =
        backendSettings.backend === 's3SSEC' ? 32 : 0

      const BUCKET_NAMES = [
        process.env.GCS_TEMPLATE_FILES_BUCKET_NAME,
        `${process.env.GCS_TEMPLATE_FILES_BUCKET_NAME}-deleted`,
      ]

      before('start filestore with new settings', async function () {
        // create the app with the relevant filestore settings
        Settings.filestore = backendSettings
        app = new FilestoreApp()
        await app.runServer()
      })

      if (backendSettings.gcs) {
        before('create gcs buckets', async function () {
          // create test buckets for gcs
          const storage = new Storage(Settings.filestore.gcs.endpoint)
          for (const bucketName of BUCKET_NAMES) {
            await storage.createBucket(bucketName)
          }
        })

        after('delete gcs buckets', async function () {
          // tear down all the gcs buckets
          const storage = new Storage(Settings.filestore.gcs.endpoint)
          for (const bucketName of BUCKET_NAMES) {
            const bucket = storage.bucket(bucketName)
            await bucket.deleteFiles()
            await bucket.delete()
          }
        })
      }

      after('stop filestore app', async function () {
        await app.stop()
      })

      beforeEach('fetch previous egress metric', async function () {
        // retrieve previous metrics from the app
        if (['s3', 's3SSEC', 'gcs'].includes(Settings.filestore.backend)) {
          metricPrefix = Settings.filestore.backend.replace('SSEC', '')
          previousEgress = await TestHelper.getMetric(
            filestoreUrl,
            `${metricPrefix}_egress`
          )
        }
        templateId = new ObjectId().toString()
        otherProjectId = new ObjectId().toString()
        templateUrl = `${filestoreUrl}/template/${templateId}/v/0`
        fileId = new ObjectId().toString()
        fileUrl = `${templateUrl}/${fileId}`
        fileKey = `${templateId}/v/0/${fileId}`
      })

      it('should send a 200 for the status endpoint', async function () {
        const response = await fetch(`${filestoreUrl}/status`)
        expect(response.status).to.equal(200)
        const body = await response.text()
        expect(body).to.contain('filestore')
        expect(body).to.contain('up')
      })

      describe('with a file on the server', function () {
        let constantFileContent

        const localFileReadPath =
          '/tmp/filestore_acceptance_tests_file_read.txt'

        beforeEach('upload file', async function () {
          constantFileContent = [
            'hello world',
            `line 2 goes here ${Math.random()}`,
            'there are 3 lines in all',
          ].join('\n')

          await fsWriteFile(localFileReadPath, constantFileContent)

          const readStream = fs.createReadStream(localFileReadPath)
          const res = await fetch(fileUrl, { method: 'POST', body: readStream })
          if (!res.ok) throw new Error(res.statusText)
        })

        beforeEach('retrieve previous ingress metric', async function () {
          // The upload request can bump the ingress metric.
          // The content hash validation might require a full download
          //  in case the ETag field of the upload response is not a md5 sum.
          if (['s3', 's3SSEC', 'gcs'].includes(Settings.filestore.backend)) {
            previousIngress = await TestHelper.getMetric(
              filestoreUrl,
              `${metricPrefix}_ingress`
            )
          }
        })

        it('should return 404 for a non-existant id', async function () {
          const url = fileUrl + '___this_is_clearly_wrong___'
          const response = await fetch(url)
          expect(response.status).to.equal(404)
        })

        it('should return the file size on a HEAD request', async function () {
          const expectedLength = Buffer.byteLength(constantFileContent)
          const res = await fetch(fileUrl, { method: 'HEAD' })
          expect(res.status).to.equal(200)
          expect(res.headers.get('Content-Length')).to.equal(
            expectedLength.toString()
          )
        })

        it('should be able get the file back', async function () {
          const res = await fetch(fileUrl)
          const body = await res.text()
          expect(body).to.equal(constantFileContent)
        })

        it('should send a 200 for the health-check endpoint using the file', async function () {
          const response = await fetch(`${filestoreUrl}/health_check`)
          expect(response.status).to.equal(200)
          const body = await response.text()
          expect(body).to.equal('OK')
        })

        it('should not leak a socket', async function () {
          const res = await fetch(fileUrl)
          if (!res.ok) throw new Error(res.statusText)
          await res.text()
          await expectNoSockets()
        })

        it('should be able to get back the first 9 bytes of the file', async function () {
          const res = await fetch(fileUrl, { headers: { Range: 'bytes=0-8' } })
          const body = await res.text()
          expect(body).to.equal('hello wor')
        })

        it('should be able to get back bytes 4 through 10 of the file', async function () {
          const res = await fetch(fileUrl, { headers: { Range: 'bytes=4-10' } })
          const body = await res.text()
          expect(body).to.equal('o world')
        })

        it('should be able to delete the file', async function () {
          await app.persistor.deleteObject(
            Settings.filestore.stores.template_files,
            fileKey
          )
          const response2 = await fetch(fileUrl)
          expect(response2.status).to.equal(404)
        })

        it('should be able to copy files', async function () {
          const newProjectID = new ObjectId().toString()
          const newFileId = new ObjectId().toString()
          const newFileUrl = `${filestoreUrl}/template/${newProjectID}/v/0/${newFileId}`
          const newFileKey = `${newProjectID}/v/0/${newFileId}`
          await app.persistor.copyObject(
            Settings.filestore.stores.template_files,
            fileKey,
            newFileKey
          )
          await app.persistor.deleteObject(
            Settings.filestore.stores.template_files,
            fileKey
          )
          const response = await fetch(newFileUrl)
          const body = await response.text()
          expect(body).to.equal(constantFileContent)
        })

        it('should be able to overwrite the file', async function () {
          const newContent = `here is some different content, ${Math.random()}`
          const readStream = streamifier.createReadStream(newContent)
          await fetch(fileUrl, { method: 'POST', body: readStream })

          const response = await fetch(fileUrl)
          const body = await response.text()
          expect(body).to.equal(newContent)
        })

        describe('IfNoneMatch', function () {
          if (backendSettings.backend === 'fs') {
            it('should refuse to handle IfNoneMatch', async function () {
              await expect(
                app.persistor.sendStream(
                  Settings.filestore.stores.template_files,
                  fileKey,
                  fs.createReadStream(localFileReadPath),
                  { ifNoneMatch: '*' }
                )
              ).to.be.rejectedWith(NotImplementedError)
            })
          } else {
            it('should reject sendStream on the same key with IfNoneMatch', async function () {
              await expect(
                app.persistor.sendStream(
                  Settings.filestore.stores.template_files,
                  fileKey,
                  fs.createReadStream(localFileReadPath),
                  { ifNoneMatch: '*' }
                )
              ).to.be.rejectedWith(AlreadyWrittenError)
            })
            it('should allow sendStream on a different key with IfNoneMatch', async function () {
              await app.persistor.sendStream(
                Settings.filestore.stores.template_files,
                `${templateId}/v/0/${fileId}-other`,
                fs.createReadStream(localFileReadPath),
                { ifNoneMatch: '*' }
              )
            })
          }
        })

        if (backendSettings.backend !== 'fs') {
          it('should record an egress metric for the upload', async function () {
            const metric = await TestHelper.getMetric(
              filestoreUrl,
              `${metricPrefix}_egress`
            )
            expect(metric - previousEgress).to.equal(
              constantFileContent.length + dataEncryptionKeySize
            )
          })

          it('should record an ingress metric when downloading the file', async function () {
            const response = await fetch(fileUrl)
            expect(response.ok).to.be.true
            await response.text()
            const metric = await TestHelper.getMetric(
              filestoreUrl,
              `${metricPrefix}_ingress`
            )
            expect(metric - previousIngress).to.equal(
              constantFileContent.length + dataEncryptionKeySize
            )
          })

          it('should record an ingress metric for a partial download', async function () {
            const response = await fetch(fileUrl, {
              headers: { Range: 'bytes=0-8' },
            })
            expect(response.ok).to.be.true
            await response.text()
            const metric = await TestHelper.getMetric(
              filestoreUrl,
              `${metricPrefix}_ingress`
            )
            expect(metric - previousIngress).to.equal(9 + dataEncryptionKeySize)
          })
        }
      })

      describe('with multiple files', function () {
        let fileIds, fileUrls, otherFileUrls, otherProjectUrl
        const localFileReadPaths = [
          '/tmp/filestore_acceptance_tests_file_read_1.txt',
          '/tmp/filestore_acceptance_tests_file_read_2.txt',
          '/tmp/filestore_acceptance_tests_file_read_3.txt',
        ]
        const constantFileContents = [
          [
            'hello world',
            `line 2 goes here ${Math.random()}`,
            'there are 3 lines in all',
          ].join('\n'),
          [
            `for reference: ${Math.random()}`,
            'cats are the best animals',
            'wombats are a close second',
          ].join('\n'),
          [
            `another file: ${Math.random()}`,
            'with multiple lines',
            'the end',
          ].join('\n'),
        ]

        before('create local files', async function () {
          return await Promise.all([
            fsWriteFile(localFileReadPaths[0], constantFileContents[0]),
            fsWriteFile(localFileReadPaths[1], constantFileContents[1]),
            fsWriteFile(localFileReadPaths[2], constantFileContents[2]),
          ])
        })

        beforeEach('upload two files', async function () {
          otherProjectUrl = `${filestoreUrl}/template/${otherProjectId}/v/0`
          fileIds = [
            new ObjectId().toString(),
            new ObjectId().toString(),
            new ObjectId().toString(),
          ]
          fileUrls = [
            `${templateUrl}/${fileIds[0]}`,
            `${templateUrl}/${fileIds[1]}`,
          ]
          otherFileUrls = [`${otherProjectUrl}/${fileIds[2]}`]

          await Promise.all([
            fetch(fileUrls[0], {
              method: 'POST',
              body: fs.createReadStream(localFileReadPaths[0]),
            }),
            fetch(fileUrls[1], {
              method: 'POST',
              body: fs.createReadStream(localFileReadPaths[1]),
            }),
            fetch(otherFileUrls[0], {
              method: 'POST',
              body: fs.createReadStream(localFileReadPaths[2]),
            }),
          ])
        })

        it('should get the directory size', async function () {
          expect(
            await app.persistor.directorySize(
              Settings.filestore.stores.template_files,
              templateId
            )
          ).to.equal(
            constantFileContents[0].length + constantFileContents[1].length
          )
        })

        it('should store the files', async function () {
          for (const index in fileUrls) {
            const response = await fetch(fileUrls[index])
            const body = await response.text()
            expect(body).to.equal(constantFileContents[index])
          }
        })

        it('should be able to delete a folder', async function () {
          await app.persistor.deleteDirectory(
            Settings.filestore.stores.template_files,
            templateId + '/'
          )

          for (const index in fileUrls) {
            const response = await fetch(fileUrls[index])
            expect(response.status).to.equal(404)
          }
        })

        it('should not delete files in other projects', async function () {
          for (const index in otherFileUrls) {
            const response = await fetch(otherFileUrls[index])
            expect(response.status).to.equal(200)
          }
        })
      })

      describe('with a large file', function () {
        this.timeout(1000 * 20)
        let largeFileContent

        beforeEach('upload large file', async function () {
          largeFileContent = '_wombat_'.repeat(1024 * 1024) // 8 megabytes
          largeFileContent += Math.random()

          const readStream = streamifier.createReadStream(largeFileContent)
          const res = await fetch(fileUrl, { method: 'POST', body: readStream })
          if (!res.ok) throw new Error(res.statusText)
        })

        it('should be able to get the file back', async function () {
          const response = await fetch(fileUrl)
          const body = await response.text()
          expect(body).to.equal(largeFileContent)
        })

        it('should not leak a socket', async function () {
          const response = await fetch(fileUrl)
          await response.text()
          await expectNoSockets()
        })

        it('should not leak a socket if the connection is aborted', async function () {
          const controller = new AbortController()
          const response = await fetch(fileUrl, { signal: controller.signal })
          expect(response.ok).to.be.true
          controller.abort()
          await expectNoSockets()
        })
      })

      if (
        (backendSettings.backend === 's3' && !backendSettings.fallback) ||
        (backendSettings.backend === 'gcs' &&
          backendSettings.fallback?.backend === 's3')
      ) {
        describe('with a file in a specific bucket', function () {
          let constantFileContent, fileId, fileUrl, bucketName

          beforeEach('upload file into random bucket', async function () {
            constantFileContent = `This is a file in a different S3 bucket ${Math.random()}`
            fileId = new ObjectId().toString()
            bucketName = `random-bucket-${new ObjectId().toString()}`
            fileUrl = `${filestoreUrl}/bucket/${bucketName}/key/${fileId}`

            const s3 = new S3Persistor({
              ...s3Config(),
              key: process.env.MINIO_ROOT_USER,
              secret: process.env.MINIO_ROOT_PASSWORD,
            })
            await s3._createBucket(bucketName)
            await s3._upload(bucketName, {
              Bucket: bucketName,
              Key: fileId,
              Body: constantFileContent,
            })
          })

          it('should get the file from the specified bucket', async function () {
            const response = await fetch(fileUrl)
            const body = await response.text()
            expect(body).to.equal(constantFileContent)
          })
        })
      }

      if (backendSettings.backend === 'gcs') {
        describe('when deleting a file in GCS', function () {
          let content, error, dateBefore, dateAfter

          beforeEach('upload and delete file', async function () {
            content = '_wombat_' + Math.random()

            const readStream = streamifier.createReadStream(content)
            const res = await fetch(fileUrl, {
              method: 'POST',
              body: readStream,
            })
            if (!res.ok) throw new Error(res.statusText)
            dateBefore = new Date()
            await app.persistor.deleteObject(
              Settings.filestore.stores.template_files,
              fileKey
            )
            dateAfter = new Date()
          })

          it('should not throw an error', function () {
            expect(error).not.to.exist
          })

          it('should copy the file to the deleted-files bucket', async function () {
            let date = dateBefore
            const keys = []
            while (date <= dateAfter) {
              keys.push(`${templateId}/v/0/${fileId}-${date.toISOString()}`)
              date = new Date(date.getTime() + 1)
            }
            await TestHelper.expectPersistorToHaveSomeFile(
              app.persistor,
              `${Settings.filestore.stores.template_files}-deleted`,
              keys,
              content
            )
          })

          it('should remove the file from the original bucket', async function () {
            await TestHelper.expectPersistorNotToHaveFile(
              app.persistor,
              Settings.filestore.stores.template_files,
              fileKey
            )
          })
        })
      }

      if (backendSettings.fallback) {
        describe('with a fallback', function () {
          let constantFileContent, bucket, fallbackBucket

          beforeEach('prepare fallback', function () {
            constantFileContent = `This is yet more file content ${Math.random()}`
            bucket = Settings.filestore.stores.template_files
            fallbackBucket = Settings.filestore.fallback.buckets[bucket]
          })

          describe('with a file in the fallback bucket', function () {
            beforeEach('upload into fallback', async function () {
              await TestHelper.uploadStringToPersistor(
                app.persistor.fallbackPersistor,
                fallbackBucket,
                fileKey,
                constantFileContent
              )
            })

            it('should not find file in the primary', async function () {
              await TestHelper.expectPersistorNotToHaveFile(
                app.persistor.primaryPersistor,
                bucket,
                fileKey
              )
            })

            it('should find the file in the fallback', async function () {
              await TestHelper.expectPersistorToHaveFile(
                app.persistor.fallbackPersistor,
                fallbackBucket,
                fileKey,
                constantFileContent
              )
            })

            describe('when copyOnMiss is disabled', function () {
              beforeEach('swap copyOnMiss=false', function () {
                app.persistor.settings.copyOnMiss = false
              })

              it('should fetch the file', async function () {
                const res = await fetch(fileUrl)
                const body = await res.text()
                expect(body).to.equal(constantFileContent)
              })

              it('should not copy the file to the primary', async function () {
                const response = await fetch(fileUrl)
                expect(response.ok).to.be.true
                await response.text()

                await TestHelper.expectPersistorNotToHaveFile(
                  app.persistor.primaryPersistor,
                  bucket,
                  fileKey
                )
              })
            })

            describe('when copyOnMiss is enabled', function () {
              beforeEach('swap copyOnMiss=true', function () {
                app.persistor.settings.copyOnMiss = true
              })

              it('should fetch the file', async function () {
                const res = await fetch(fileUrl)
                const body = await res.text()
                expect(body).to.equal(constantFileContent)
              })

              it('copies the file to the primary', async function () {
                const response = await fetch(fileUrl)
                expect(response.ok).to.be.true
                await response.text()
                // wait for the file to copy in the background
                await msleep(1000)

                await TestHelper.expectPersistorToHaveFile(
                  app.persistor.primaryPersistor,
                  bucket,
                  fileKey,
                  constantFileContent
                )
              })
            })

            describe('when copying a file', function () {
              let newFileKey

              beforeEach('prepare to copy file', function () {
                const newProjectID = new ObjectId().toString()
                const newFileId = new ObjectId().toString()
                newFileKey = `${newProjectID}/v/0/${newFileId}`
              })

              describe('when copyOnMiss is false', function () {
                beforeEach('copy with copyOnMiss=false', async function () {
                  app.persistor.settings.copyOnMiss = false

                  await app.persistor.copyObject(
                    Settings.filestore.stores.template_files,
                    fileKey,
                    newFileKey
                  )
                })

                it('should leave the old file in the old bucket', async function () {
                  await TestHelper.expectPersistorToHaveFile(
                    app.persistor.fallbackPersistor,
                    fallbackBucket,
                    fileKey,
                    constantFileContent
                  )
                })

                it('should not create a new file in the old bucket', async function () {
                  await TestHelper.expectPersistorNotToHaveFile(
                    app.persistor.fallbackPersistor,
                    fallbackBucket,
                    newFileKey
                  )
                })

                it('should create a new file in the new bucket', async function () {
                  await TestHelper.expectPersistorToHaveFile(
                    app.persistor.primaryPersistor,
                    bucket,
                    newFileKey,
                    constantFileContent
                  )
                })

                it('should not copy the old file to the primary with the old key', async function () {
                  // wait for the file to copy in the background
                  await msleep(1000)

                  await TestHelper.expectPersistorNotToHaveFile(
                    app.persistor.primaryPersistor,
                    bucket,
                    fileKey
                  )
                })
              })

              describe('when copyOnMiss is true', function () {
                beforeEach('copy with copyOnMiss=false', async function () {
                  app.persistor.settings.copyOnMiss = true

                  await app.persistor.copyObject(
                    Settings.filestore.stores.template_files,
                    fileKey,
                    newFileKey
                  )
                })

                it('should leave the old file in the old bucket', async function () {
                  await TestHelper.expectPersistorToHaveFile(
                    app.persistor.fallbackPersistor,
                    fallbackBucket,
                    fileKey,
                    constantFileContent
                  )
                })

                it('should not create a new file in the old bucket', async function () {
                  await TestHelper.expectPersistorNotToHaveFile(
                    app.persistor.fallbackPersistor,
                    fallbackBucket,
                    newFileKey
                  )
                })

                it('should create a new file in the new bucket', async function () {
                  await TestHelper.expectPersistorToHaveFile(
                    app.persistor.primaryPersistor,
                    bucket,
                    newFileKey,
                    constantFileContent
                  )
                })

                it('should copy the old file to the primary with the old key', async function () {
                  // wait for the file to copy in the background
                  await msleep(1000)

                  await TestHelper.expectPersistorToHaveFile(
                    app.persistor.primaryPersistor,
                    bucket,
                    fileKey,
                    constantFileContent
                  )
                })
              })
            })
          })

          describe('when sending a file', function () {
            beforeEach('upload file', async function () {
              const readStream =
                streamifier.createReadStream(constantFileContent)
              const res = await fetch(fileUrl, {
                method: 'POST',
                body: readStream,
              })
              if (!res.ok) throw new Error(res.statusText)
            })

            it('should store the file on the primary', async function () {
              await TestHelper.expectPersistorToHaveFile(
                app.persistor.primaryPersistor,
                bucket,
                fileKey,
                constantFileContent
              )
            })

            it('should not store the file on the fallback', async function () {
              await TestHelper.expectPersistorNotToHaveFile(
                app.persistor.fallbackPersistor,
                fallbackBucket,
                fileKey
              )
            })
          })

          describe('when deleting a file', function () {
            describe('when the file exists on the primary', function () {
              beforeEach('upload into primary', async function () {
                await TestHelper.uploadStringToPersistor(
                  app.persistor.primaryPersistor,
                  bucket,
                  fileKey,
                  constantFileContent
                )
              })

              it('should delete the file', async function () {
                await app.persistor.deleteObject(
                  Settings.filestore.stores.template_files,
                  fileKey
                )
                const response2 = await fetch(fileUrl)
                expect(response2.status).to.equal(404)
              })
            })

            describe('when the file exists on the fallback', function () {
              beforeEach('upload into fallback', async function () {
                await TestHelper.uploadStringToPersistor(
                  app.persistor.fallbackPersistor,
                  fallbackBucket,
                  fileKey,
                  constantFileContent
                )
              })

              it('should delete the file', async function () {
                await app.persistor.deleteObject(
                  Settings.filestore.stores.template_files,
                  fileKey
                )
                const response2 = await fetch(fileUrl)
                expect(response2.status).to.equal(404)
              })
            })

            describe('when the file exists on both the primary and the fallback', function () {
              beforeEach(
                'upload into both primary and fallback',
                async function () {
                  await TestHelper.uploadStringToPersistor(
                    app.persistor.primaryPersistor,
                    bucket,
                    fileKey,
                    constantFileContent
                  )
                  await TestHelper.uploadStringToPersistor(
                    app.persistor.fallbackPersistor,
                    fallbackBucket,
                    fileKey,
                    constantFileContent
                  )
                }
              )

              it('should delete the files', async function () {
                await app.persistor.deleteObject(
                  Settings.filestore.stores.template_files,
                  fileKey
                )
                const response2 = await fetch(fileUrl)
                expect(response2.status).to.equal(404)
              })
            })

            describe('when the file does not exist', function () {
              it('should return success', async function () {
                // S3 doesn't give us a 404 when the object doesn't exist, so to stay
                // consistent we merrily return success ourselves here as well
                await app.persistor.deleteObject(
                  Settings.filestore.stores.template_files,
                  fileKey
                )
              })
            })
          })
        })
      }

      describe('with a pdf file', function () {
        let localFileSize
        const localFileReadPath = Path.resolve(
          import.meta.dirname,
          '../../fixtures/test.pdf'
        )

        beforeEach('upload test.pdf', async function () {
          const stat = await fsStat(localFileReadPath)
          localFileSize = stat.size
          const readStream = fs.createReadStream(localFileReadPath)
          const res = await fetch(fileUrl, { method: 'POST', body: readStream })
          if (!res.ok) throw new Error(res.statusText)
        })

        it('should be able get the file back', async function () {
          const response = await fetch(fileUrl)
          const body = await response.text()
          expect(body.substring(0, 8)).to.equal('%PDF-1.5')
        })

        if (backendSettings.backend !== 'fs') {
          it('should record an egress metric for the upload', async function () {
            const metric = await TestHelper.getMetric(
              filestoreUrl,
              `${metricPrefix}_egress`
            )
            expect(metric - previousEgress).to.equal(
              localFileSize + dataEncryptionKeySize
            )
          })
        }

        describe('getting the preview image', function () {
          this.timeout(1000 * 20)
          let previewFileUrl

          beforeEach('prepare previewFileUrl for preview', function () {
            previewFileUrl = `${fileUrl}?style=preview`
          })

          it('should not time out', async function () {
            const response = await fetch(previewFileUrl)
            expect(response.status).to.equal(200)
            await response.arrayBuffer()
          })

          it('should respond with image data', async function () {
            // note: this test relies of the imagemagick conversion working
            const response = await fetch(previewFileUrl)
            expect(response.status).to.equal(200)
            const body = await response.text()
            expect(body.length).to.be.greaterThan(400)
            expect(body.substr(1, 3)).to.equal('PNG')
          })
        })

        describe('warming the cache', function () {
          this.timeout(1000 * 20)
          let previewFileUrl

          beforeEach('prepare previewFileUrl for cacheWarn', function () {
            previewFileUrl = `${fileUrl}?style=preview&cacheWarm=true`
          })

          it('should not time out', async function () {
            const response = await fetch(previewFileUrl)
            expect(response.status).to.equal(200)
            await response.arrayBuffer()
          })

          it('should not leak sockets', async function () {
            const response1 = await fetch(previewFileUrl)
            expect(response1.status).to.equal(200)
            // do not read the response body, should be destroyed immediately
            const response2 = await fetch(previewFileUrl)
            expect(response2.status).to.equal(200)
            // do not read the response body, should be destroyed immediately
            await expectNoSockets()
          })

          it("should respond with only an 'OK'", async function () {
            // note: this test relies of the imagemagick conversion working
            const response = await fetch(previewFileUrl)
            const body = await response.text()
            expect(body).to.equal('OK')
          })
        })
      })

      describe('with server side encryption', function () {
        if (backendSettings.backend !== 's3SSEC') return

        before('sanity check top-level variable', function () {
          expect(dataEncryptionKeySize).to.equal(32)
        })

        let fileId1,
          fileId2,
          fileKey1,
          fileKey2,
          fileKeyOtherProject,
          fileUrl1,
          fileUrl2
        beforeEach('prepare ids', function () {
          fileId1 = new ObjectId().toString()
          fileId2 = new ObjectId().toString()
          fileKey1 = `${templateId}/v/0/${fileId1}`
          fileKey2 = `${templateId}/v/0/${fileId2}`
          fileKeyOtherProject = `${new ObjectId().toString()}/v/0/${new ObjectId().toString()}`
          fileUrl1 = `${templateUrl}/${fileId1}`
          fileUrl2 = `${templateUrl}/${fileId2}`
        })

        beforeEach('ensure DEK is missing', async function () {
          // Cannot use test helper expectPersistorNotToHaveFile here, we need to use the KEK.
          await expect(
            app.persistor.getDataEncryptionKeySize(
              backendSettings.stores.template_files,
              fileKey1
            )
          ).to.rejectedWith(NotFoundError)
        })

        async function createRandomContent(url, suffix = '') {
          const content = Math.random().toString() + suffix
          const res = await fetch(url, {
            method: 'POST',
            body: Stream.Readable.from([content]),
          })
          if (!res.ok) throw new Error(res.statusText)
          return async () => {
            const res = await fetch(url, { method: 'GET' })
            if (!res.ok) throw new Error(res.statusText)
            expect(await res.text()).to.equal(content)
          }
        }

        it('should create a DEK when asked explicitly', async function () {
          await app.persistor.generateDataEncryptionKey(
            backendSettings.stores.template_files,
            fileKey1
          )
          expect(
            await app.persistor.getDataEncryptionKeySize(
              backendSettings.stores.template_files,
              fileKey1
            )
          ).to.equal(32)
        })

        it('should create a DEK from writes', async function () {
          await createRandomContent(fileUrl1)
          expect(
            await app.persistor.getDataEncryptionKeySize(
              backendSettings.stores.template_files,
              fileKey1
            )
          ).to.equal(32)
        })

        it('should not create a DEK from reads', async function () {
          const res = await fetch(fileUrl1, {
            method: 'GET',
          })
          if (res.status !== 404) throw new Error(`${res.status} should be 404`)

          // Cannot use test helper expectPersistorNotToHaveFile here, we need to use the KEK.
          await expect(
            app.persistor.getDataEncryptionKeySize(
              backendSettings.stores.template_files,
              fileKey1
            )
          ).to.rejectedWith(NotFoundError)
        })

        it('should never overwrite a data encryption key', async function () {
          const checkGET = await createRandomContent(fileUrl1)

          await expect(
            app.persistor.generateDataEncryptionKey(
              backendSettings.stores.template_files,
              fileKey1
            )
          ).to.rejectedWith(AlreadyWrittenError)

          await checkGET()
        })

        it('should re-use the data encryption key after a write', async function () {
          const checkGET1 = await createRandomContent(fileUrl1, '1')
          const checkGET2 = await createRandomContent(fileUrl2, '2')
          await checkGET1()
          await checkGET2()
        })

        describe('kek rotation', function () {
          const newKEK = new RootKeyEncryptionKey(
            crypto.generateKeySync('aes', { length: 256 }).export(),
            Buffer.alloc(32)
          )
          const oldKEK = new RootKeyEncryptionKey(
            crypto.generateKeySync('aes', { length: 256 }).export(),
            Buffer.alloc(32)
          )
          const migrationStep0 = new PerProjectEncryptedS3Persistor({
            ...s3SSECConfig(),
            automaticallyRotateDEKEncryption: false,
            async getRootKeyEncryptionKeys() {
              return [oldKEK] // only old key
            },
          })
          const migrationStep1 = new PerProjectEncryptedS3Persistor({
            ...s3SSECConfig(),
            automaticallyRotateDEKEncryption: false,
            async getRootKeyEncryptionKeys() {
              return [oldKEK, newKEK] // new key as fallback
            },
          })
          const migrationStep2 = new PerProjectEncryptedS3Persistor({
            ...s3SSECConfig(),
            automaticallyRotateDEKEncryption: true, // <- different compared to partiallyRotated
            async getRootKeyEncryptionKeys() {
              return [newKEK, oldKEK] // old keys as fallback
            },
          })
          const migrationStep3 = new PerProjectEncryptedS3Persistor({
            ...s3SSECConfig(),
            automaticallyRotateDEKEncryption: true,
            async getRootKeyEncryptionKeys() {
              return [newKEK] // only new key
            },
          })

          async function checkWrites(
            fileKey,
            writer,
            readersSuccess,
            readersFailed
          ) {
            const content = Math.random().toString()
            await writer.sendStream(
              Settings.filestore.stores.template_files,
              fileKey,
              Stream.Readable.from([content])
            )

            for (const persistor of readersSuccess) {
              await TestHelper.expectPersistorToHaveFile(
                persistor,
                backendSettings.stores.template_files,
                fileKey,
                content
              )
            }

            for (const persistor of readersFailed) {
              await expect(
                TestHelper.expectPersistorToHaveFile(
                  persistor,
                  backendSettings.stores.template_files,
                  fileKey,
                  content
                )
              ).to.be.rejectedWith(NoKEKMatchedError)
            }
          }

          const stages = [
            {
              name: 'stage 0 - [old]',
              prev: migrationStep0,
              cur: migrationStep0,
              fail: [migrationStep3],
            },
            {
              name: 'stage 1 - [old,new]',
              prev: migrationStep0,
              cur: migrationStep1,
              fail: [],
            },
            {
              name: 'stage 2 - [new,old]',
              prev: migrationStep1,
              cur: migrationStep2,
              fail: [],
            },
            {
              name: 'stage 3 - [new]',
              prev: migrationStep2,
              cur: migrationStep3,
              fail: [migrationStep0],
            },
          ]

          for (const { name, prev, cur, fail } of stages) {
            describe(name, function () {
              this.timeout(1000 * 30)

              it('can read old writes', async function () {
                await checkWrites(fileKey1, prev, [prev, cur], fail)
                await checkWrites(fileKey2, prev, [prev, cur], fail) // check again after access
                await checkWrites(fileKeyOtherProject, prev, [prev, cur], fail)
              })
              it('can read new writes', async function () {
                await checkWrites(fileKey1, prev, [prev, cur], fail)
                await checkWrites(fileKey2, cur, [prev, cur], fail) // check again after access
                await checkWrites(fileKeyOtherProject, cur, [prev, cur], fail)
              })
            })
          }

          describe('full migration', function () {
            it('can read old writes if rotated in sequence', async function () {
              await checkWrites(
                fileKey1,
                migrationStep0,
                [
                  migrationStep0,
                  migrationStep1,
                  migrationStep2, // migrates
                  migrationStep3,
                ],
                []
              )
            })
            it('cannot read/write if not rotated', async function () {
              await checkWrites(
                fileKey1,
                migrationStep0,
                [migrationStep0],
                [migrationStep3]
              )
            })
          })
        })

        /** @type {import('aws-sdk/clients/s3')} */
        let s3Client
        before('create s3 client', function () {
          s3Client = new S3Persistor(s3Config())._getClientForBucket('')
        })

        async function checkDEKStorage({
          dekBucketKeys = [],
          userFilesBucketKeys = [],
        }) {
          await createRandomContent(fileUrl1)

          const { Contents: dekEntries } = await s3Client.send(
            new ListObjectsV2Command({
              Bucket: process.env.AWS_S3_USER_FILES_DEK_BUCKET_NAME,
              Prefix: `${templateId}/`,
            })
          )
          expect(dekEntries).to.have.length(dekBucketKeys.length)
          // Order is not predictable, use members
          expect(dekEntries.map(o => o.Key)).to.have.members(dekBucketKeys)

          const { Contents: userFilesEntries } = await s3Client.send(
            new ListObjectsV2Command({
              Bucket: backendSettings.stores.template_files,
              Prefix: `${templateId}/`,
            })
          )
          expect(userFilesEntries).to.have.length(userFilesBucketKeys.length)
          // Order is not predictable, use members
          expect(userFilesEntries.map(o => o.Key)).to.have.members(
            userFilesBucketKeys
          )
        }

        it('should use a custom bucket for DEKs', async function () {
          await checkDEKStorage({
            dekBucketKeys: [`${templateId}/dek`],
            userFilesBucketKeys: [fileKey1],
          })
        })

        describe('deleteDirectory', function () {
          let checkGET1, checkGET2
          beforeEach('create files', async function () {
            checkGET1 = await createRandomContent(fileUrl1, '1')
            checkGET2 = await createRandomContent(fileUrl2, '2')
          })
          it('should refuse to delete top-level prefix', async function () {
            await expect(
              app.persistor.deleteDirectory(
                Settings.filestore.stores.template_files,
                templateId.slice(0, 3)
              )
            ).to.be.rejectedWith('not a project-folder')
            expect(
              await app.persistor.checkIfObjectExists(
                Settings.filestore.stores.template_files,
                fileKey1
              )
            ).to.equal(true)
            await checkGET1()
            expect(
              await app.persistor.checkIfObjectExists(
                Settings.filestore.stores.template_files,
                fileKey2
              )
            ).to.equal(true)
            expect(
              await app.persistor.getDataEncryptionKeySize(
                Settings.filestore.stores.template_files,
                fileKey2
              )
            ).to.equal(32)
            await checkGET2()
          })
          it('should delete sub-folder and keep DEK', async function () {
            await app.persistor.deleteDirectory(
              Settings.filestore.stores.template_files,
              fileKey1 // not really a sub-folder, but it will do for this test.
            )
            expect(
              await app.persistor.checkIfObjectExists(
                Settings.filestore.stores.template_files,
                fileKey1
              )
            ).to.equal(false)
            expect(
              await app.persistor.checkIfObjectExists(
                Settings.filestore.stores.template_files,
                fileKey2
              )
            ).to.equal(true)
            expect(
              await app.persistor.getDataEncryptionKeySize(
                Settings.filestore.stores.template_files,
                fileKey2
              )
            ).to.equal(32)
            await checkGET2()
          })
          it('should delete project folder and DEK', async function () {
            await app.persistor.deleteDirectory(
              Settings.filestore.stores.template_files,
              `${templateId}/`
            )
            expect(
              await app.persistor.checkIfObjectExists(
                Settings.filestore.stores.template_files,
                fileKey1
              )
            ).to.equal(false)
            expect(
              await app.persistor.checkIfObjectExists(
                Settings.filestore.stores.template_files,
                fileKey2
              )
            ).to.equal(false)
            await expect(
              app.persistor.getDataEncryptionKeySize(
                Settings.filestore.stores.template_files,
                fileKey2
              )
            ).to.rejectedWith(NotFoundError)
          })
        })
      })

      describe('getObjectSize', function () {
        it('should return a number', async function () {
          const buf = Buffer.from('hello')
          const res = await fetch(fileUrl, {
            method: 'POST',
            body: Stream.Readable.from([buf]),
          })
          if (!res.ok) throw new Error(res.statusText)
          expect(
            await app.persistor.getObjectSize(
              Settings.filestore.stores.template_files,
              fileKey
            )
          ).to.equal(buf.byteLength)
        })
      })

      describe('checkIfObjectExists', function () {
        it('should return false when the object does not exist', async function () {
          expect(
            await app.persistor.checkIfObjectExists(
              Settings.filestore.stores.template_files,
              fileKey
            )
          ).to.equal(false)
        })
        it('should return true when the object exists', async function () {
          const res = await fetch(fileUrl, {
            method: 'POST',
            body: Stream.Readable.from(['hello']),
          })
          if (!res.ok) throw new Error(res.statusText)
          expect(
            await app.persistor.checkIfObjectExists(
              Settings.filestore.stores.template_files,
              fileKey
            )
          ).to.equal(true)
        })
      })

      if (backendSettings.backend === 's3SSEC') {
        describe('storageClass', function () {
          it('should use the default storage class for dek', async function () {
            const dekBucket = process.env.AWS_S3_USER_FILES_DEK_BUCKET_NAME
            await app.persistor.sendStream(
              dekBucket,
              fileKey,
              Stream.Readable.from(['hello'])
            )
            expect(
              await app.persistor.getObjectStorageClass(dekBucket, fileKey)
            ).to.equal(undefined)
          })

          it('should use the custom storage class for user files', async function () {
            await app.persistor.sendStream(
              Settings.filestore.stores.template_files,
              fileKey,
              Stream.Readable.from(['hello'])
            )
            const sc = AWS_S3_USER_FILES_STORAGE_CLASS
            expect(sc).to.exist
            expect(
              await app.persistor.getObjectStorageClass(
                Settings.filestore.stores.template_files,
                fileKey
              )
            ).to.equal(sc)
          })
        })
      }

      describe('autoGunzip', function () {
        this.timeout(60 * 1000)
        const body = Buffer.alloc(10 * 1024 * 1024, 'hello')
        const gzippedBody = gzipSync(body)

        /**
         * @param {string} key
         * @param {Buffer} wantBody
         * @param {boolean} autoGunzip
         * @return {Promise<void>}
         */
        async function checkBodyIsTheSame(key, wantBody, autoGunzip) {
          const s = await app.persistor.getObjectStream(
            Settings.filestore.stores.template_files,
            key,
            { autoGunzip }
          )
          const buf = new WritableBuffer()
          await Stream.promises.pipeline(s, buf)
          expect(buf.getContents()).to.deep.equal(wantBody)
        }

        if (backendSettings.backend === 'fs') {
          it('should refuse to handle autoGunzip', async function () {
            await expect(
              app.persistor.getObjectStream(
                Settings.filestore.stores.template_files,
                fileKey,
                { autoGunzip: true }
              )
            ).to.be.rejectedWith(NotImplementedError)
          })
        } else {
          it('should return the raw body with gzip', async function () {
            await app.persistor.sendStream(
              Settings.filestore.stores.template_files,
              fileKey,
              Stream.Readable.from([gzippedBody]),
              { contentEncoding: 'gzip' }
            )
            expect(
              await app.persistor.getObjectSize(
                Settings.filestore.stores.template_files,
                fileKey
              )
            ).to.equal(gzippedBody.byteLength)
            // raw body with autoGunzip=true
            await checkBodyIsTheSame(fileKey, body, true)
            // gzip body without autoGunzip=false
            await checkBodyIsTheSame(fileKey, gzippedBody, false)
          })
          it('should return the raw body without gzip compression', async function () {
            await app.persistor.sendStream(
              Settings.filestore.stores.template_files,
              fileKey,
              Stream.Readable.from([body])
            )
            expect(
              await app.persistor.getObjectSize(
                Settings.filestore.stores.template_files,
                fileKey
              )
            ).to.equal(body.byteLength)
            // raw body with both autoGunzip options
            await checkBodyIsTheSame(fileKey, body, true)
            await checkBodyIsTheSame(fileKey, body, false)
          })

          it('should return the gzip body without gzip header', async function () {
            await app.persistor.sendStream(
              Settings.filestore.stores.template_files,
              fileKey,
              Stream.Readable.from([gzippedBody])
            )
            expect(
              await app.persistor.getObjectSize(
                Settings.filestore.stores.template_files,
                fileKey
              )
            ).to.equal(gzippedBody.byteLength)
            // gzip body with both autoGunzip options
            await checkBodyIsTheSame(fileKey, gzippedBody, true)
            await checkBodyIsTheSame(fileKey, gzippedBody, false)
          })
        }
      })
    })
  }
})
