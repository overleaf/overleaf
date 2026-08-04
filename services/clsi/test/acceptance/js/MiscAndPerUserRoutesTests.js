import Path from 'node:path'
import fs from 'node:fs'
import Client from './helpers/Client.js'
import ClsiApp from './helpers/ClsiApp.js'
import { expect } from 'chai'
import {
  fetchNothing,
  fetchString,
  fetchJson,
  fetchStream,
} from '@overleaf/fetch-utils'
import Settings from '@overleaf/settings'
import FormData from 'form-data'
import { buffer } from 'node:stream/consumers'
import { expectValidationError } from '@overleaf/validation-tools/testUtils.js'

const host = Settings.apis.clsi.url

// A syntactically valid Mongo ObjectId used for the per-user route tests
// below (CompileManager only uses it to namespace the compile/output
// directories, so any well-formed id works).
const userId = '0123456789abcdef01234567'

function simpleProjectRequest() {
  return {
    resources: [
      {
        path: 'main.tex',
        content: `\
\\documentclass{article}
\\begin{document}
Hello world
\\end{document}\
`,
      },
    ],
  }
}

describe('Misc and per-user routes', function () {
  before(async function () {
    await ClsiApp.ensureRunning()
  })

  describe('status endpoint', function () {
    it('GET /project/:project_id/status should say OK', async function () {
      const projectId = Client.randomId()
      const body = await fetchString(`${host}/project/${projectId}/status`)
      expect(body).to.equal('OK')
    })

    it('POST /project/:project_id/status should say OK', async function () {
      const projectId = Client.randomId()
      const body = await fetchString(`${host}/project/${projectId}/status`, {
        method: 'POST',
      })
      expect(body).to.equal('OK')
    })
  })

  describe('per-user compile routes', function () {
    let projectId, body

    before(async function () {
      projectId = Client.randomId()
      body = await fetchJson(
        `${host}/project/${projectId}/user/${userId}/compile`,
        {
          method: 'POST',
          json: { compile: simpleProjectRequest() },
        }
      )
    })

    it('should compile successfully', function () {
      expect(body.compile.status).to.equal('success')
    })

    it('should include the per-user build URL in the output files', function () {
      const pdf = body.compile.outputFiles.find(f => f.type === 'pdf')
      expect(pdf.url).to.include(`/project/${projectId}/user/${userId}/build/`)
    })

    it('should download the output.zip archive via the per-user route', async function () {
      const buildId = body.compile.outputFiles[0].build
      const res = await fetchNothing(
        `${host}/project/${projectId}/user/${userId}/build/${buildId}/output/output.zip`
      )
      expect(res.status).to.equal(200)
    })

    it('should return a wordcount via the per-user route', async function () {
      const wc = await fetchJson(
        `${host}/project/${projectId}/user/${userId}/wordcount?file=main.tex`
      )
      expect(wc.texcount).to.exist
    })

    it('should sync from code via the per-user route', async function () {
      const positions = await fetchJson(
        `${host}/project/${projectId}/user/${userId}/sync/code?file=main.tex&line=3&column=5`
      )
      expect(positions.pdf).to.exist
    })

    it('should stop the compile via the per-user route', async function () {
      const res = await fetchNothing(
        `${host}/project/${projectId}/user/${userId}/compile/stop`,
        { method: 'POST' }
      )
      expect(res.status).to.equal(204)
    })

    it('should clear the cache via the per-user route', async function () {
      const res = await fetchNothing(
        `${host}/project/${projectId}/user/${userId}`,
        { method: 'DELETE' }
      )
      expect(res.status).to.equal(204)
    })
  })

  describe('output.zip download (project-only route)', function () {
    it('should download the archive for a project-only compile', async function () {
      const projectId = Client.randomId()
      const compileBody = await Client.compile(
        projectId,
        simpleProjectRequest()
      )
      const buildId = compileBody.compile.outputFiles[0].build
      const res = await fetchNothing(
        `${host}/project/${projectId}/build/${buildId}/output/output.zip`
      )
      expect(res.status).to.equal(200)
    })
  })

  describe('legacy /convert/docx-to-latex route', function () {
    it('should convert a docx file without an explicit type query param', async function () {
      const sourcePath = Path.join(
        import.meta.dirname,
        '../fixtures/conversion-source.docx'
      )
      const formData = new FormData()
      formData.append('qqfile', fs.createReadStream(sourcePath))
      const stream = await fetchStream(`${host}/convert/docx-to-latex`, {
        method: 'POST',
        body: formData,
      })
      const body = await buffer(stream)
      expect(body.length).to.be.greaterThan(0)
      // .zip archive — verify the PK\x03\x04 magic bytes
      expect(body[0]).to.equal(0x50)
      expect(body[1]).to.equal(0x4b)
    })
  })

  describe('negative validation', function () {
    it('should reject a path-traversal rootResourcePath with 400', async function () {
      const projectId = Client.randomId()
      let error
      try {
        await Client.compile(projectId, {
          ...simpleProjectRequest(),
          rootResourcePath: '../evil.tex',
        })
        expect.fail('should have thrown')
      } catch (err) {
        error = err
      }
      expectValidationError(error, 400, 'rootResourcePath')
    })

    it('should reject a malformed user_id with 404', async function () {
      const projectId = Client.randomId()
      let error
      try {
        await fetchJson(
          `${host}/project/${projectId}/user/not-a-valid-user-id/wordcount?file=main.tex`
        )
        expect.fail('should have thrown')
      } catch (err) {
        error = err
      }
      expectValidationError(error, 404, 'user_id')
    })
  })
})
