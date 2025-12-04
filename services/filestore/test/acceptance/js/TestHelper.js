import streamifier from 'streamifier'
import fetch from 'node-fetch'
import ObjectPersistor from '@overleaf/object-persistor'
import { expect } from 'chai'

export default {
  uploadStringToPersistor,
  getStringFromPersistor,
  expectPersistorToHaveFile,
  expectPersistorToHaveSomeFile,
  expectPersistorNotToHaveFile,
  streamToString,
  getMetric,
}

async function getMetric(filestoreUrl, metric) {
  const res = await fetch(`${filestoreUrl}/metrics`)
  expect(res.status).to.equal(200)
  const metricRegex = new RegExp(`^${metric}{[^}]+} ([0-9]+)$`, 'gm')
  const body = await res.text()
  let v = 0
  // Sum up size="lt-128KiB" and size="gte-128KiB"
  for (const [, found] of body.matchAll(metricRegex)) {
    v += parseInt(found, 10) || 0
  }
  return v
}

function streamToString(stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    stream.resume()
  })
}

async function uploadStringToPersistor(persistor, bucket, key, content) {
  const fileStream = streamifier.createReadStream(content)
  await persistor.sendStream(bucket, key, fileStream)
}

async function getStringFromPersistor(persistor, bucket, key) {
  const stream = await persistor.getObjectStream(bucket, key, {})
  return await streamToString(stream)
}

async function expectPersistorToHaveFile(persistor, bucket, key, content) {
  const foundContent = await getStringFromPersistor(persistor, bucket, key)
  expect(foundContent).to.equal(content)
}

async function expectPersistorToHaveSomeFile(persistor, bucket, keys, content) {
  let foundContent
  for (const key of keys) {
    try {
      foundContent = await getStringFromPersistor(persistor, bucket, key)
      break
    } catch (err) {
      if (err instanceof ObjectPersistor.Errors.NotFoundError) {
        continue
      }
      throw err
    }
  }
  if (foundContent === undefined) {
    expect.fail(`Could not find any of the specified keys: ${keys}`)
  }
  expect(foundContent).to.equal(content)
}

async function expectPersistorNotToHaveFile(persistor, bucket, key) {
  await expect(
    getStringFromPersistor(persistor, bucket, key)
  ).to.eventually.have.been.rejected.with.property('name', 'NotFoundError')
}
