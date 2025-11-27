export function csvAttachment(res, body, filename) {
  if (!filename || !filename.endsWith('.csv')) {
    throw new Error('filename must end with .csv')
  }
  // res.attachment sets both content-type and content-disposition headers.
  res.attachment(filename)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.send(body)
}

export function preparePlainTextResponse(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.contentType('text/plain; charset=utf-8')
}

export function plainTextResponse(res, body) {
  preparePlainTextResponse(res)
  res.send(body)
}

export function xmlResponse(res, body) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.contentType('application/xml; charset=utf-8')
  res.send(body)
}

export function prepareZipAttachment(res, filename) {
  if (!filename || !filename.endsWith('.zip')) {
    throw new Error('filename must end with .zip')
  }
  // res.attachment sets both content-type and content-disposition headers.
  res.attachment(filename)
  res.setHeader('X-Content-Type-Options', 'nosniff')
}

export function zipAttachment(res, body, filename) {
  prepareZipAttachment(res, filename)
  res.send(body)
}

export default {
  csvAttachment,
  plainTextResponse,
  preparePlainTextResponse,
  prepareZipAttachment,
  xmlResponse,
  zipAttachment,
}
