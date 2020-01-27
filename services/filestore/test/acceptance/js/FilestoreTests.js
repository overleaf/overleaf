const chai = require('chai')
const { expect } = chai
const fs = require('fs')
const Settings = require('settings-sharelatex')
const Path = require('path')
const FilestoreApp = require('./FilestoreApp')
const rp = require('request-promise-native').defaults({
  resolveWithFullResponse: true
})
const S3 = require('aws-sdk/clients/s3')
const Stream = require('stream')
const request = require('request')
const { promisify } = require('util')
const streamifier = require('streamifier')
chai.use(require('chai-as-promised'))

const fsWriteFile = promisify(fs.writeFile)
const fsStat = promisify(fs.stat)
const pipeline = promisify(Stream.pipeline)

async function getMetric(filestoreUrl, metric) {
  const res = await rp.get(`${filestoreUrl}/metrics`)
  expect(res.statusCode).to.equal(200)
  const metricRegex = new RegExp(`^${metric}{[^}]+} ([0-9]+)$`, 'm')
  const found = metricRegex.exec(res.body)
  return parseInt(found ? found[1] : 0) || 0
}

if (!process.env.AWS_ACCESS_KEY_ID) {
  throw new Error('please provide credentials for the AWS S3 test server')
}

function streamToString(stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

// store settings for multiple backends, so that we can test each one.
// fs will always be available - add others if they are configured
const BackendSettings = {
  FSPersistor: {
    backend: 'fs',
    stores: {
      user_files: Path.resolve(__dirname, '../../../user_files'),
      public_files: Path.resolve(__dirname, '../../../public_files'),
      template_files: Path.resolve(__dirname, '../../../template_files')
    }
  },
  S3Persistor: {
    backend: 's3',
    s3: {
      key: process.env.AWS_ACCESS_KEY_ID,
      secret: process.env.AWS_SECRET_ACCESS_KEY,
      endpoint: process.env.AWS_S3_ENDPOINT,
      pathStyle: true
    },
    stores: {
      user_files: process.env.AWS_S3_USER_FILES_BUCKET_NAME,
      template_files: process.env.AWS_S3_TEMPLATE_FILES_BUCKET_NAME,
      public_files: process.env.AWS_S3_PUBLIC_FILES_BUCKET_NAME
    }
  },
  FallbackS3ToFSPersistor: {
    backend: 's3',
    s3: {
      key: process.env.AWS_ACCESS_KEY_ID,
      secret: process.env.AWS_SECRET_ACCESS_KEY,
      endpoint: process.env.AWS_S3_ENDPOINT,
      pathStyle: true
    },
    stores: {
      user_files: process.env.AWS_S3_USER_FILES_BUCKET_NAME,
      template_files: process.env.AWS_S3_TEMPLATE_FILES_BUCKET_NAME,
      public_files: process.env.AWS_S3_PUBLIC_FILES_BUCKET_NAME
    },
    fallback: {
      backend: 'fs',
      buckets: {
        [process.env.AWS_S3_USER_FILES_BUCKET_NAME]: Path.resolve(
          __dirname,
          '../../../user_files'
        ),
        [process.env.AWS_S3_PUBLIC_FILES_BUCKET_NAME]: Path.resolve(
          __dirname,
          '../../../public_files'
        ),
        [process.env.AWS_S3_TEMPLATE_FILES_BUCKET_NAME]: Path.resolve(
          __dirname,
          '../../../template_files'
        )
      }
    }
  },
  FallbackFSToS3Persistor: {
    backend: 'fs',
    s3: {
      key: process.env.AWS_ACCESS_KEY_ID,
      secret: process.env.AWS_SECRET_ACCESS_KEY,
      endpoint: process.env.AWS_S3_ENDPOINT,
      pathStyle: true
    },
    stores: {
      user_files: Path.resolve(__dirname, '../../../user_files'),
      public_files: Path.resolve(__dirname, '../../../public_files'),
      template_files: Path.resolve(__dirname, '../../../template_files')
    },
    fallback: {
      backend: 's3',
      buckets: {
        [Path.resolve(__dirname, '../../../user_files')]: process.env
          .AWS_S3_USER_FILES_BUCKET_NAME,
        [Path.resolve(__dirname, '../../../public_files')]: process.env
          .AWS_S3_PUBLIC_FILES_BUCKET_NAME,
        [Path.resolve(__dirname, '../../../template_files')]: process.env
          .AWS_S3_TEMPLATE_FILES_BUCKET_NAME
      }
    }
  }
}

describe('Filestore', function() {
  this.timeout(1000 * 10)
  const filestoreUrl = `http://localhost:${Settings.internal.filestore.port}`
  const directoryName = 'directory'

  // redefine the test suite for every available backend
  Object.keys(BackendSettings).forEach(backend => {
    describe(backend, function() {
      let app, previousEgress, previousIngress, projectId

      before(async function() {
        // create the app with the relevant filestore settings
        Settings.filestore = BackendSettings[backend]
        app = new FilestoreApp()
        await app.runServer()
      })

      after(async function() {
        return app.stop()
      })

      beforeEach(async function() {
        // retrieve previous metrics from the app
        if (Settings.filestore.backend === 's3') {
          ;[previousEgress, previousIngress] = await Promise.all([
            getMetric(filestoreUrl, 's3_egress'),
            getMetric(filestoreUrl, 's3_ingress')
          ])
        }
        projectId = `acceptance_tests_${Math.random()}`
      })

      it('should send a 200 for the status endpoint', async function() {
        const response = await rp(`${filestoreUrl}/status`)
        expect(response.statusCode).to.equal(200)
        expect(response.body).to.contain('filestore')
        expect(response.body).to.contain('up')
      })

      it('should send a 200 for the health-check endpoint', async function() {
        const response = await rp(`${filestoreUrl}/health_check`)
        expect(response.statusCode).to.equal(200)
        expect(response.body).to.equal('OK')
      })

      describe('with a file on the server', function() {
        let fileId, fileUrl, constantFileContent

        const localFileReadPath =
          '/tmp/filestore_acceptance_tests_file_read.txt'

        beforeEach(async function() {
          fileId = Math.random()
          fileUrl = `${filestoreUrl}/project/${projectId}/file/${directoryName}%2F${fileId}`
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

        it('should return 404 for a non-existant id', async function() {
          const options = { uri: fileUrl + '___this_is_clearly_wrong___' }
          await expect(
            rp.get(options)
          ).to.eventually.be.rejected.and.have.property('statusCode', 404)
        })

        it('should return the file size on a HEAD request', async function() {
          const expectedLength = Buffer.byteLength(constantFileContent)
          const res = await rp.head(fileUrl)
          expect(res.statusCode).to.equal(200)
          expect(res.headers['content-length']).to.equal(
            expectedLength.toString()
          )
        })

        it('should be able get the file back', async function() {
          const res = await rp.get(fileUrl)
          expect(res.body).to.equal(constantFileContent)
        })

        it('should be able to get back the first 9 bytes of the file', async function() {
          const options = {
            uri: fileUrl,
            headers: {
              Range: 'bytes=0-8'
            }
          }
          const res = await rp.get(options)
          expect(res.body).to.equal('hello wor')
        })

        it('should be able to get back bytes 4 through 10 of the file', async function() {
          const options = {
            uri: fileUrl,
            headers: {
              Range: 'bytes=4-10'
            }
          }
          const res = await rp.get(options)
          expect(res.body).to.equal('o world')
        })

        it('should be able to delete the file', async function() {
          const response = await rp.del(fileUrl)
          expect(response.statusCode).to.equal(204)
          await expect(
            rp.get(fileUrl)
          ).to.eventually.be.rejected.and.have.property('statusCode', 404)
        })

        it('should be able to copy files', async function() {
          const newProjectID = `acceptance_tests_copied_project_${Math.random()}`
          const newFileId = Math.random()
          const newFileUrl = `${filestoreUrl}/project/${newProjectID}/file/${directoryName}%2F${newFileId}`
          const opts = {
            method: 'put',
            uri: newFileUrl,
            json: {
              source: {
                project_id: projectId,
                file_id: `${directoryName}/${fileId}`
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

        it('should be able to overwrite the file', async function() {
          const newContent = `here is some different content, ${Math.random()}`
          const writeStream = request.post(fileUrl)
          const readStream = streamifier.createReadStream(newContent)
          // hack to consume the result to ensure the http request has been fully processed
          const resultStream = fs.createWriteStream('/dev/null')
          await pipeline(readStream, writeStream, resultStream)

          const response = await rp.get(fileUrl)
          expect(response.body).to.equal(newContent)
        })

        if (backend === 'S3Persistor') {
          it('should record an egress metric for the upload', async function() {
            const metric = await getMetric(filestoreUrl, 's3_egress')
            expect(metric - previousEgress).to.equal(constantFileContent.length)
          })

          it('should record an ingress metric when downloading the file', async function() {
            await rp.get(fileUrl)
            const metric = await getMetric(filestoreUrl, 's3_ingress')
            expect(metric - previousIngress).to.equal(
              constantFileContent.length
            )
          })

          it('should record an ingress metric for a partial download', async function() {
            const options = {
              uri: fileUrl,
              headers: {
                Range: 'bytes=0-8'
              }
            }
            await rp.get(options)
            const metric = await getMetric(filestoreUrl, 's3_ingress')
            expect(metric - previousIngress).to.equal(9)
          })
        }
      })

      describe('with multiple files', function() {
        let fileIds, fileUrls
        const directoryName = 'directory'
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

        before(async function() {
          return Promise.all([
            fsWriteFile(localFileReadPaths[0], constantFileContents[0]),
            fsWriteFile(localFileReadPaths[1], constantFileContents[1])
          ])
        })

        beforeEach(async function() {
          fileIds = [Math.random(), Math.random()]
          fileUrls = [
            `${filestoreUrl}/project/${projectId}/file/${directoryName}%2F${fileIds[0]}`,
            `${filestoreUrl}/project/${projectId}/file/${directoryName}%2F${fileIds[1]}`
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

        it('should get the directory size', async function() {
          const response = await rp.get(
            `${filestoreUrl}/project/${projectId}/size`
          )
          expect(parseInt(JSON.parse(response.body)['total bytes'])).to.equal(
            constantFileContents[0].length + constantFileContents[1].length
          )
        })
      })

      if (backend === 'S3Persistor') {
        describe('with a file in a specific bucket', function() {
          let constantFileContent, fileId, fileUrl, bucketName

          beforeEach(async function() {
            constantFileContent = `This is a file in a different S3 bucket ${Math.random()}`
            fileId = Math.random().toString()
            bucketName = Math.random().toString()
            fileUrl = `${filestoreUrl}/bucket/${bucketName}/key/${fileId}`

            const s3ClientSettings = {
              credentials: {
                accessKeyId: 'fake',
                secretAccessKey: 'fake'
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

          it('should get the file from the specified bucket', async function() {
            const response = await rp.get(fileUrl)
            expect(response.body).to.equal(constantFileContent)
          })
        })
      }

      if (BackendSettings[backend].fallback) {
        describe('with a fallback', function() {
          async function uploadStringToPersistor(
            persistor,
            bucket,
            key,
            content
          ) {
            const fileStream = streamifier.createReadStream(content)
            await persistor.promises.sendStream(bucket, key, fileStream)
          }

          async function getStringFromPersistor(persistor, bucket, key) {
            const stream = await persistor.promises.getFileStream(
              bucket,
              key,
              {}
            )
            return streamToString(stream)
          }

          async function expectPersistorToHaveFile(
            persistor,
            bucket,
            key,
            content
          ) {
            const foundContent = await getStringFromPersistor(
              persistor,
              bucket,
              key
            )
            expect(foundContent).to.equal(content)
          }

          async function expectPersistorNotToHaveFile(persistor, bucket, key) {
            await expect(
              getStringFromPersistor(persistor, bucket, key)
            ).to.eventually.have.been.rejected.with.property(
              'name',
              'NotFoundError'
            )
          }

          let constantFileContent,
            fileId,
            fileKey,
            fileUrl,
            bucket,
            fallbackBucket

          beforeEach(function() {
            constantFileContent = `This is yet more file content ${Math.random()}`
            fileId = Math.random().toString()
            fileKey = `${projectId}/${directoryName}/${fileId}`
            fileUrl = `${filestoreUrl}/project/${projectId}/file/${directoryName}%2F${fileId}`

            bucket = Settings.filestore.stores.user_files
            fallbackBucket = Settings.filestore.fallback.buckets[bucket]
          })

          describe('with a file in the fallback bucket', function() {
            beforeEach(async function() {
              await uploadStringToPersistor(
                app.persistor.fallbackPersistor,
                fallbackBucket,
                fileKey,
                constantFileContent
              )
            })

            it('should not find file in the primary', async function() {
              await expectPersistorNotToHaveFile(
                app.persistor.primaryPersistor,
                bucket,
                fileKey
              )
            })

            it('should find the file in the fallback', async function() {
              await expectPersistorToHaveFile(
                app.persistor.fallbackPersistor,
                fallbackBucket,
                fileKey,
                constantFileContent
              )
            })

            it('should fetch the file', async function() {
              const res = await rp.get(fileUrl)
              expect(res.body).to.equal(constantFileContent)
            })

            describe('when copyOnMiss is disabled', function() {
              beforeEach(function() {
                Settings.filestore.fallback.copyOnMiss = false
              })

              it('should not copy the file to the primary', async function() {
                await rp.get(fileUrl)

                await expectPersistorNotToHaveFile(
                  app.persistor.primaryPersistor,
                  bucket,
                  fileKey
                )
              })
            })

            describe('when copyOnMiss is enabled', function() {
              beforeEach(function() {
                Settings.filestore.fallback.copyOnMiss = true
              })

              it('copies the file to the primary', async function() {
                await rp.get(fileUrl)
                // wait for the file to copy in the background
                await promisify(setTimeout)(1000)

                await expectPersistorToHaveFile(
                  app.persistor.primaryPersistor,
                  bucket,
                  fileKey,
                  constantFileContent
                )
              })
            })

            describe('when copying a file', function() {
              let newFileId, newFileUrl, newFileKey

              beforeEach(async function() {
                const newProjectID = `acceptance_tests_copied_project_${Math.random()}`
                newFileId = Math.random()
                newFileUrl = `${filestoreUrl}/project/${newProjectID}/file/${directoryName}%2F${newFileId}`
                newFileKey = `${newProjectID}/${directoryName}/${newFileId}`

                const opts = {
                  method: 'put',
                  uri: newFileUrl,
                  json: {
                    source: {
                      project_id: projectId,
                      file_id: `${directoryName}/${fileId}`
                    }
                  }
                }

                const response = await rp(opts)
                expect(response.statusCode).to.equal(200)
              })

              it('should leave the old file in the old bucket', async function() {
                await expectPersistorToHaveFile(
                  app.persistor.fallbackPersistor,
                  fallbackBucket,
                  fileKey,
                  constantFileContent
                )
              })

              it('should not create a new file in the old bucket', async function() {
                await expectPersistorNotToHaveFile(
                  app.persistor.fallbackPersistor,
                  fallbackBucket,
                  newFileKey
                )
              })

              it('should not copy the old file to the new bucket', async function() {
                await expectPersistorNotToHaveFile(
                  app.persistor.primaryPersistor,
                  bucket,
                  fileKey
                )
              })

              it('should create a new file in the new bucket', async function() {
                await expectPersistorToHaveFile(
                  app.persistor.primaryPersistor,
                  bucket,
                  newFileKey,
                  constantFileContent
                )
              })
            })
          })

          describe('when sending a file', function() {
            beforeEach(async function() {
              const writeStream = request.post(fileUrl)
              const readStream = streamifier.createReadStream(
                constantFileContent
              )
              // hack to consume the result to ensure the http request has been fully processed
              const resultStream = fs.createWriteStream('/dev/null')
              await pipeline(readStream, writeStream, resultStream)
            })

            it('should store the file on the primary', async function() {
              await expectPersistorToHaveFile(
                app.persistor.primaryPersistor,
                bucket,
                fileKey,
                constantFileContent
              )
            })

            it('should not store the file on the fallback', async function() {
              await expectPersistorNotToHaveFile(
                app.persistor.fallbackPersistor,
                fallbackBucket,
                `${projectId}/${directoryName}/${fileId}`
              )
            })
          })

          describe('when deleting a file', function() {
            describe('when the file exists on the primary', function() {
              beforeEach(async function() {
                await uploadStringToPersistor(
                  app.persistor.primaryPersistor,
                  bucket,
                  fileKey,
                  constantFileContent
                )
              })

              it('should delete the file', async function() {
                const response = await rp.del(fileUrl)
                expect(response.statusCode).to.equal(204)
                await expect(
                  rp.get(fileUrl)
                ).to.eventually.be.rejected.and.have.property('statusCode', 404)
              })
            })

            describe('when the file exists on the fallback', function() {
              beforeEach(async function() {
                await uploadStringToPersistor(
                  app.persistor.fallbackPersistor,
                  fallbackBucket,
                  fileKey,
                  constantFileContent
                )
              })

              it('should delete the file', async function() {
                const response = await rp.del(fileUrl)
                expect(response.statusCode).to.equal(204)
                await expect(
                  rp.get(fileUrl)
                ).to.eventually.be.rejected.and.have.property('statusCode', 404)
              })
            })

            describe('when the file exists on both the primary and the fallback', function() {
              beforeEach(async function() {
                await uploadStringToPersistor(
                  app.persistor.primaryPersistor,
                  bucket,
                  fileKey,
                  constantFileContent
                )
                await uploadStringToPersistor(
                  app.persistor.fallbackPersistor,
                  fallbackBucket,
                  fileKey,
                  constantFileContent
                )
              })

              it('should delete the files', async function() {
                const response = await rp.del(fileUrl)
                expect(response.statusCode).to.equal(204)
                await expect(
                  rp.get(fileUrl)
                ).to.eventually.be.rejected.and.have.property('statusCode', 404)
              })
            })

            describe('when the file does not exist', function() {
              it('should return return 204', async function() {
                // S3 doesn't give us a 404 when the object doesn't exist, so to stay
                // consistent we merrily return 204 ourselves here as well
                const response = await rp.del(fileUrl)
                expect(response.statusCode).to.equal(204)
              })
            })
          })
        })
      }

      describe('with a pdf file', function() {
        let fileId, fileUrl, localFileSize
        const localFileReadPath = Path.resolve(
          __dirname,
          '../../fixtures/test.pdf'
        )

        beforeEach(async function() {
          fileId = Math.random()
          fileUrl = `${filestoreUrl}/project/${projectId}/file/${directoryName}%2F${fileId}`
          const stat = await fsStat(localFileReadPath)
          localFileSize = stat.size
          const writeStream = request.post(fileUrl)
          const endStream = fs.createWriteStream('/dev/null')
          const readStream = fs.createReadStream(localFileReadPath)
          await pipeline(readStream, writeStream, endStream)
        })

        it('should be able get the file back', async function() {
          const response = await rp.get(fileUrl)
          expect(response.body.substring(0, 8)).to.equal('%PDF-1.5')
        })

        if (backend === 'S3Persistor') {
          it('should record an egress metric for the upload', async function() {
            const metric = await getMetric(filestoreUrl, 's3_egress')
            expect(metric - previousEgress).to.equal(localFileSize)
          })
        }

        describe('getting the preview image', function() {
          this.timeout(1000 * 20)
          let previewFileUrl

          beforeEach(function() {
            previewFileUrl = `${fileUrl}?style=preview`
          })

          it('should not time out', async function() {
            const response = await rp.get(previewFileUrl)
            expect(response.statusCode).to.equal(200)
          })

          it('should respond with image data', async function() {
            // note: this test relies of the imagemagick conversion working
            const response = await rp.get(previewFileUrl)
            expect(response.body.length).to.be.greaterThan(400)
            expect(response.body.substr(1, 3)).to.equal('PNG')
          })
        })

        describe('warming the cache', function() {
          this.timeout(1000 * 20)
          let previewFileUrl

          beforeEach(function() {
            previewFileUrl = `${fileUrl}?style=preview&cacheWarm=true`
          })

          it('should not time out', async function() {
            const response = await rp.get(previewFileUrl)
            expect(response.statusCode).to.equal(200)
          })

          it("should respond with only an 'OK'", async function() {
            // note: this test relies of the imagemagick conversion working
            const response = await rp.get(previewFileUrl)
            expect(response.body).to.equal('OK')
          })
        })
      })
    })
  })
})
