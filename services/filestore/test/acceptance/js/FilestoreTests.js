const chai = require('chai')
const { expect } = chai
const fs = require('fs')
const Settings = require('@overleaf/settings')
const Path = require('path')
const FilestoreApp = require('./FilestoreApp')
const TestHelper = require('./TestHelper')
const rp = require('request-promise-native').defaults({
  resolveWithFullResponse: true
})
const S3 = require('aws-sdk/clients/s3')
const Stream = require('stream')
const request = require('request')
const { promisify } = require('util')
const { Storage } = require('@google-cloud/storage')
const streamifier = require('streamifier')
chai.use(require('chai-as-promised'))
const { ObjectId } = require('mongodb')
const tk = require('timekeeper')
const ChildProcess = require('child_process')

const fsWriteFile = promisify(fs.writeFile)
const fsStat = promisify(fs.stat)
const pipeline = promisify(Stream.pipeline)
const exec = promisify(ChildProcess.exec)
const msleep = promisify(setTimeout)

if (!process.env.AWS_ACCESS_KEY_ID) {
  throw new Error('please provide credentials for the AWS S3 test server')
}

process.on('unhandledRejection', (e) => {
  // eslint-disable-next-line no-console
  console.log('** Unhandled Promise Rejection **\n', e)
  throw e
})

// store settings for multiple backends, so that we can test each one.
// fs will always be available - add others if they are configured
const BackendSettings = require('./TestConfig')

describe('Filestore', function () {
  this.timeout(1000 * 10)
  const filestoreUrl = `http://localhost:${Settings.internal.filestore.port}`

  const seenSockets = []
  async function expectNoSockets() {
    try {
      await msleep(1000)
      const { stdout } = await exec('ss -tnH')

      const badSockets = []
      for (const socket of stdout.split('\n')) {
        const fields = socket.split(' ').filter((part) => part !== '')
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
  Object.keys(BackendSettings).forEach((backend) => {
    describe(backend, function () {
      let app, previousEgress, previousIngress, metricPrefix, projectId

      before(async function () {
        // create the app with the relevant filestore settings
        Settings.filestore = BackendSettings[backend]
        app = new FilestoreApp()
        await app.runServer()
      })

      if (BackendSettings[backend].gcs) {
        before(async function () {
          const storage = new Storage(Settings.filestore.gcs.endpoint)
          await storage.createBucket(process.env.GCS_USER_FILES_BUCKET_NAME)
          await storage.createBucket(process.env.GCS_PUBLIC_FILES_BUCKET_NAME)
          await storage.createBucket(process.env.GCS_TEMPLATE_FILES_BUCKET_NAME)
          await storage.createBucket(
            `${process.env.GCS_USER_FILES_BUCKET_NAME}-deleted`
          )
          await storage.createBucket(
            `${process.env.GCS_PUBLIC_FILES_BUCKET_NAME}-deleted`
          )
          await storage.createBucket(
            `${process.env.GCS_TEMPLATE_FILES_BUCKET_NAME}-deleted`
          )
        })
      }

      after(async function () {
        await msleep(3000)
        await app.stop()
      })

      beforeEach(async function () {
        // retrieve previous metrics from the app
        if (['s3', 'gcs'].includes(Settings.filestore.backend)) {
          metricPrefix = Settings.filestore.backend
          previousEgress = await TestHelper.getMetric(
            filestoreUrl,
            `${metricPrefix}_egress`
          )
        }
        projectId = ObjectId().toString()
      })

      it('should send a 200 for the status endpoint', async function () {
        const response = await rp(`${filestoreUrl}/status`)
        expect(response.statusCode).to.equal(200)
        expect(response.body).to.contain('filestore')
        expect(response.body).to.contain('up')
      })

      it('should send a 200 for the health-check endpoint', async function () {
        const response = await rp(`${filestoreUrl}/health_check`)
        expect(response.statusCode).to.equal(200)
        expect(response.body).to.equal('OK')
      })

      describe('with a file on the server', function () {
        let fileId, fileUrl, constantFileContent

        const localFileReadPath =
          '/tmp/filestore_acceptance_tests_file_read.txt'

        beforeEach(async function () {
          fileId = ObjectId().toString()
          fileUrl = `${filestoreUrl}/project/${projectId}/file/${fileId}`
          constantFileContent = [
            'hello world',
            `line 2 goes here ${Math.random()}`,
            'there are 3 lines in all'
          ].join('\n')

          await fsWriteFile(localFileReadPath, constantFileContent)

          const writeStream = request.post(fileUrl)
          const readStream = fs.createReadStream(localFileReadPath)
          // hack to consume the result to ensure the http request has been fully processed
          const resultStream = fs.createWriteStream('/dev/null')
          await pipeline(readStream, writeStream, resultStream)
        })

        beforeEach(async function retrievePreviousIngressMetrics() {
          // The upload request can bump the ingress metric.
          // The content hash validation might require a full download
          //  in case the ETag field of the upload response is not a md5 sum.
          if (['s3', 'gcs'].includes(Settings.filestore.backend)) {
            previousIngress = await TestHelper.getMetric(
              filestoreUrl,
              `${metricPrefix}_ingress`
            )
          }
        })

        it('should return 404 for a non-existant id', async function () {
          const options = { uri: fileUrl + '___this_is_clearly_wrong___' }
          await expect(
            rp.get(options)
          ).to.eventually.be.rejected.and.have.property('statusCode', 404)
        })

        it('should return the file size on a HEAD request', async function () {
          const expectedLength = Buffer.byteLength(constantFileContent)
          const res = await rp.head(fileUrl)
          expect(res.statusCode).to.equal(200)
          expect(res.headers['content-length']).to.equal(
            expectedLength.toString()
          )
        })

        it('should be able get the file back', async function () {
          const res = await rp.get(fileUrl)
          expect(res.body).to.equal(constantFileContent)
        })

        it('should not leak a socket', async function () {
          await rp.get(fileUrl)
          await expectNoSockets()
        })

        it('should be able to get back the first 9 bytes of the file', async function () {
          const options = {
            uri: fileUrl,
            headers: {
              Range: 'bytes=0-8'
            }
          }
          const res = await rp.get(options)
          expect(res.body).to.equal('hello wor')
        })

        it('should be able to get back bytes 4 through 10 of the file', async function () {
          const options = {
            uri: fileUrl,
            headers: {
              Range: 'bytes=4-10'
            }
          }
          const res = await rp.get(options)
          expect(res.body).to.equal('o world')
        })

        it('should be able to delete the file', async function () {
          const response = await rp.del(fileUrl)
          expect(response.statusCode).to.equal(204)
          await expect(
            rp.get(fileUrl)
          ).to.eventually.be.rejected.and.have.property('statusCode', 404)
        })

        it('should be able to copy files', async function () {
          const newProjectID = ObjectId().toString()
          const newFileId = ObjectId().toString()
          const newFileUrl = `${filestoreUrl}/project/${newProjectID}/file/${newFileId}`
          const opts = {
            method: 'put',
            uri: newFileUrl,
            json: {
              source: {
                project_id: projectId,
                file_id: fileId
              }
            }
          }
          let response = await rp(opts)
          expect(response.statusCode).to.equal(200)
          response = await rp.del(fileUrl)
          expect(response.statusCode).to.equal(204)
          response = await rp.get(newFileUrl)
          expect(response.body).to.equal(constantFileContent)
        })

        it('should be able to overwrite the file', async function () {
          const newContent = `here is some different content, ${Math.random()}`
          const writeStream = request.post(fileUrl)
          const readStream = streamifier.createReadStream(newContent)
          // hack to consume the result to ensure the http request has been fully processed
          const resultStream = fs.createWriteStream('/dev/null')
          await pipeline(readStream, writeStream, resultStream)

          const response = await rp.get(fileUrl)
          expect(response.body).to.equal(newContent)
        })

        if (['S3Persistor', 'GcsPersistor'].includes(backend)) {
          it('should record an egress metric for the upload', async function () {
            const metric = await TestHelper.getMetric(
              filestoreUrl,
              `${metricPrefix}_egress`
            )
            expect(metric - previousEgress).to.equal(constantFileContent.length)
          })

          it('should record an ingress metric when downloading the file', async function () {
            await rp.get(fileUrl)
            const metric = await TestHelper.getMetric(
              filestoreUrl,
              `${metricPrefix}_ingress`
            )
            expect(metric - previousIngress).to.equal(
              constantFileContent.length
            )
          })

          it('should record an ingress metric for a partial download', async function () {
            const options = {
              uri: fileUrl,
              headers: {
                Range: 'bytes=0-8'
              }
            }
            await rp.get(options)
            const metric = await TestHelper.getMetric(
              filestoreUrl,
              `${metricPrefix}_ingress`
            )
            expect(metric - previousIngress).to.equal(9)
          })
        }
      })

      describe('with multiple files', function () {
        let fileIds, fileUrls, projectUrl
        const localFileReadPaths = [
          '/tmp/filestore_acceptance_tests_file_read_1.txt',
          '/tmp/filestore_acceptance_tests_file_read_2.txt'
        ]
        const constantFileContents = [
          [
            'hello world',
            `line 2 goes here ${Math.random()}`,
            'there are 3 lines in all'
          ].join('\n'),
          [
            `for reference: ${Math.random()}`,
            'cats are the best animals',
            'wombats are a close second'
          ].join('\n')
        ]

        before(async function () {
          return Promise.all([
            fsWriteFile(localFileReadPaths[0], constantFileContents[0]),
            fsWriteFile(localFileReadPaths[1], constantFileContents[1])
          ])
        })

        beforeEach(async function () {
          projectUrl = `${filestoreUrl}/project/${projectId}`
          fileIds = [ObjectId().toString(), ObjectId().toString()]
          fileUrls = [
            `${projectUrl}/file/${fileIds[0]}`,
            `${projectUrl}/file/${fileIds[1]}`
          ]

          const writeStreams = [
            request.post(fileUrls[0]),
            request.post(fileUrls[1])
          ]
          const readStreams = [
            fs.createReadStream(localFileReadPaths[0]),
            fs.createReadStream(localFileReadPaths[1])
          ]
          // hack to consume the result to ensure the http request has been fully processed
          const resultStreams = [
            fs.createWriteStream('/dev/null'),
            fs.createWriteStream('/dev/null')
          ]
          return Promise.all([
            pipeline(readStreams[0], writeStreams[0], resultStreams[0]),
            pipeline(readStreams[1], writeStreams[1], resultStreams[1])
          ])
        })

        it('should get the directory size', async function () {
          const response = await rp.get(
            `${filestoreUrl}/project/${projectId}/size`
          )
          expect(parseInt(JSON.parse(response.body)['total bytes'])).to.equal(
            constantFileContents[0].length + constantFileContents[1].length
          )
        })

        it('should store the files', async function () {
          for (const index in fileUrls) {
            await expect(rp.get(fileUrls[index])).to.eventually.have.property(
              'body',
              constantFileContents[index]
            )
          }
        })

        it('should be able to delete the project', async function () {
          await expect(rp.delete(projectUrl)).to.eventually.have.property(
            'statusCode',
            204
          )

          for (const index in fileUrls) {
            await expect(
              rp.get(fileUrls[index])
            ).to.eventually.be.rejected.and.have.property('statusCode', 404)
          }
        })

        it('should not delete a partial project id', async function () {
          await expect(
            rp.delete(`${filestoreUrl}/project/5`)
          ).to.eventually.be.rejected.and.have.property('statusCode', 400)
        })
      })

      describe('with a large file', function () {
        let fileId, fileUrl, largeFileContent, error

        beforeEach(async function () {
          fileId = ObjectId().toString()
          fileUrl = `${filestoreUrl}/project/${projectId}/file/${fileId}`

          largeFileContent = '_wombat_'.repeat(1024 * 1024) // 8 megabytes
          largeFileContent += Math.random()

          const writeStream = request.post(fileUrl)
          const readStream = streamifier.createReadStream(largeFileContent)
          // hack to consume the result to ensure the http request has been fully processed
          const resultStream = fs.createWriteStream('/dev/null')

          try {
            await pipeline(readStream, writeStream, resultStream)
          } catch (err) {
            error = err
          }
        })

        it('should be able to get the file back', async function () {
          const response = await rp.get(fileUrl)
          expect(response.body).to.equal(largeFileContent)
        })

        it('should not throw an error', function () {
          expect(error).not.to.exist
        })

        it('should not leak a socket', async function () {
          await rp.get(fileUrl)
          await expectNoSockets()
        })

        it('should not leak a socket if the connection is aborted', async function () {
          this.timeout(20000)
          for (let i = 0; i < 5; i++) {
            // test is not 100% reliable, so repeat
            // create a new connection and have it time out before reading any data
            await new Promise((resolve) => {
              const streamThatHangs = new Stream.PassThrough()
              const stream = request({ url: fileUrl, timeout: 1000 })
              stream.pipe(streamThatHangs)
              stream.on('error', () => {
                stream.destroy()
                streamThatHangs.destroy()
                resolve()
              })
            })
            await expectNoSockets()
          }
        })
      })

      if (backend === 'S3Persistor' || backend === 'FallbackGcsToS3Persistor') {
        describe('with a file in a specific bucket', function () {
          let constantFileContent, fileId, fileUrl, bucketName

          beforeEach(async function () {
            constantFileContent = `This is a file in a different S3 bucket ${Math.random()}`
            fileId = ObjectId().toString()
            bucketName = ObjectId().toString()
            fileUrl = `${filestoreUrl}/bucket/${bucketName}/key/${fileId}`

            const s3ClientSettings = {
              credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
              },
              endpoint: process.env.AWS_S3_ENDPOINT,
              sslEnabled: false,
              s3ForcePathStyle: true
            }

            const s3 = new S3(s3ClientSettings)
            await s3
              .createBucket({
                Bucket: bucketName
              })
              .promise()
            await s3
              .upload({
                Bucket: bucketName,
                Key: fileId,
                Body: constantFileContent
              })
              .promise()
          })

          it('should get the file from the specified bucket', async function () {
            const response = await rp.get(fileUrl)
            expect(response.body).to.equal(constantFileContent)
          })
        })
      }

      if (backend === 'GcsPersistor') {
        describe('when deleting a file in GCS', function () {
          let fileId, fileUrl, content, error, date

          beforeEach(async function () {
            date = new Date()
            tk.freeze(date)
            fileId = ObjectId()
            fileUrl = `${filestoreUrl}/project/${projectId}/file/${fileId}`

            content = '_wombat_' + Math.random()

            const writeStream = request.post(fileUrl)
            const readStream = streamifier.createReadStream(content)
            // hack to consume the result to ensure the http request has been fully processed
            const resultStream = fs.createWriteStream('/dev/null')

            try {
              await pipeline(readStream, writeStream, resultStream)
              await rp.delete(fileUrl)
            } catch (err) {
              error = err
            }
          })

          afterEach(function () {
            tk.reset()
          })

          it('should not throw an error', function () {
            expect(error).not.to.exist
          })

          it('should copy the file to the deleted-files bucket', async function () {
            await TestHelper.expectPersistorToHaveFile(
              app.persistor,
              `${Settings.filestore.stores.user_files}-deleted`,
              `${projectId}/${fileId}-${date.toISOString()}`,
              content
            )
          })

          it('should remove the file from the original bucket', async function () {
            await TestHelper.expectPersistorNotToHaveFile(
              app.persistor,
              Settings.filestore.stores.user_files,
              `${projectId}/${fileId}`
            )
          })
        })
      }

      if (BackendSettings[backend].fallback) {
        describe('with a fallback', function () {
          let constantFileContent,
            fileId,
            fileKey,
            fileUrl,
            bucket,
            fallbackBucket

          beforeEach(function () {
            constantFileContent = `This is yet more file content ${Math.random()}`
            fileId = ObjectId().toString()
            fileKey = `${projectId}/${fileId}`
            fileUrl = `${filestoreUrl}/project/${projectId}/file/${fileId}`

            bucket = Settings.filestore.stores.user_files
            fallbackBucket = Settings.filestore.fallback.buckets[bucket]
          })

          describe('with a file in the fallback bucket', function () {
            beforeEach(async function () {
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
              beforeEach(function () {
                app.persistor.settings.copyOnMiss = false
              })

              it('should fetch the file', async function () {
                const res = await rp.get(fileUrl)
                expect(res.body).to.equal(constantFileContent)
              })

              it('should not copy the file to the primary', async function () {
                await rp.get(fileUrl)

                await TestHelper.expectPersistorNotToHaveFile(
                  app.persistor.primaryPersistor,
                  bucket,
                  fileKey
                )
              })
            })

            describe('when copyOnMiss is enabled', function () {
              beforeEach(function () {
                app.persistor.settings.copyOnMiss = true
              })

              it('should fetch the file', async function () {
                const res = await rp.get(fileUrl)
                expect(res.body).to.equal(constantFileContent)
              })

              it('copies the file to the primary', async function () {
                await rp.get(fileUrl)
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
              let newFileId, newFileUrl, newFileKey, opts

              beforeEach(function () {
                const newProjectID = ObjectId().toString()
                newFileId = ObjectId().toString()
                newFileUrl = `${filestoreUrl}/project/${newProjectID}/file/${newFileId}`
                newFileKey = `${newProjectID}/${newFileId}`

                opts = {
                  method: 'put',
                  uri: newFileUrl,
                  json: {
                    source: {
                      project_id: projectId,
                      file_id: fileId
                    }
                  }
                }
              })

              describe('when copyOnMiss is false', function () {
                beforeEach(async function () {
                  app.persistor.settings.copyOnMiss = false

                  const response = await rp(opts)
                  expect(response.statusCode).to.equal(200)
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
                beforeEach(async function () {
                  app.persistor.settings.copyOnMiss = true

                  const response = await rp(opts)
                  expect(response.statusCode).to.equal(200)
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
            beforeEach(async function () {
              const writeStream = request.post(fileUrl)
              const readStream = streamifier.createReadStream(
                constantFileContent
              )
              // hack to consume the result to ensure the http request has been fully processed
              const resultStream = fs.createWriteStream('/dev/null')
              await pipeline(readStream, writeStream, resultStream)
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
                `${projectId}/${fileId}`
              )
            })
          })

          describe('when deleting a file', function () {
            describe('when the file exists on the primary', function () {
              beforeEach(async function () {
                await TestHelper.uploadStringToPersistor(
                  app.persistor.primaryPersistor,
                  bucket,
                  fileKey,
                  constantFileContent
                )
              })

              it('should delete the file', async function () {
                const response = await rp.del(fileUrl)
                expect(response.statusCode).to.equal(204)
                await expect(
                  rp.get(fileUrl)
                ).to.eventually.be.rejected.and.have.property('statusCode', 404)
              })
            })

            describe('when the file exists on the fallback', function () {
              beforeEach(async function () {
                await TestHelper.uploadStringToPersistor(
                  app.persistor.fallbackPersistor,
                  fallbackBucket,
                  fileKey,
                  constantFileContent
                )
              })

              it('should delete the file', async function () {
                const response = await rp.del(fileUrl)
                expect(response.statusCode).to.equal(204)
                await expect(
                  rp.get(fileUrl)
                ).to.eventually.be.rejected.and.have.property('statusCode', 404)
              })
            })

            describe('when the file exists on both the primary and the fallback', function () {
              beforeEach(async function () {
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
              })

              it('should delete the files', async function () {
                const response = await rp.del(fileUrl)
                expect(response.statusCode).to.equal(204)
                await expect(
                  rp.get(fileUrl)
                ).to.eventually.be.rejected.and.have.property('statusCode', 404)
              })
            })

            describe('when the file does not exist', function () {
              it('should return return 204', async function () {
                // S3 doesn't give us a 404 when the object doesn't exist, so to stay
                // consistent we merrily return 204 ourselves here as well
                const response = await rp.del(fileUrl)
                expect(response.statusCode).to.equal(204)
              })
            })
          })
        })
      }

      describe('with a pdf file', function () {
        let fileId, fileUrl, localFileSize
        const localFileReadPath = Path.resolve(
          __dirname,
          '../../fixtures/test.pdf'
        )

        beforeEach(async function () {
          fileId = ObjectId().toString()
          fileUrl = `${filestoreUrl}/project/${projectId}/file/${fileId}`
          const stat = await fsStat(localFileReadPath)
          localFileSize = stat.size
          const writeStream = request.post(fileUrl)
          const endStream = fs.createWriteStream('/dev/null')
          const readStream = fs.createReadStream(localFileReadPath)
          await pipeline(readStream, writeStream, endStream)
        })

        it('should be able get the file back', async function () {
          const response = await rp.get(fileUrl)
          expect(response.body.substring(0, 8)).to.equal('%PDF-1.5')
        })

        if (['S3Persistor', 'GcsPersistor'].includes(backend)) {
          it('should record an egress metric for the upload', async function () {
            const metric = await TestHelper.getMetric(
              filestoreUrl,
              `${metricPrefix}_egress`
            )
            expect(metric - previousEgress).to.equal(localFileSize)
          })
        }

        describe('getting the preview image', function () {
          this.timeout(1000 * 20)
          let previewFileUrl

          beforeEach(function () {
            previewFileUrl = `${fileUrl}?style=preview`
          })

          it('should not time out', async function () {
            const response = await rp.get(previewFileUrl)
            expect(response.statusCode).to.equal(200)
          })

          it('should respond with image data', async function () {
            // note: this test relies of the imagemagick conversion working
            const response = await rp.get(previewFileUrl)
            expect(response.body.length).to.be.greaterThan(400)
            expect(response.body.substr(1, 3)).to.equal('PNG')
          })
        })

        describe('warming the cache', function () {
          this.timeout(1000 * 20)
          let previewFileUrl

          beforeEach(function () {
            previewFileUrl = `${fileUrl}?style=preview&cacheWarm=true`
          })

          it('should not time out', async function () {
            const response = await rp.get(previewFileUrl)
            expect(response.statusCode).to.equal(200)
          })

          it("should respond with only an 'OK'", async function () {
            // note: this test relies of the imagemagick conversion working
            const response = await rp.get(previewFileUrl)
            expect(response.body).to.equal('OK')
          })
        })
      })
    })
  })
})
