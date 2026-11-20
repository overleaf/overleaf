import assert from 'node:assert/strict'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import {
  PDFLATEX_BIN,
  TEXMFLOCAL,
  inspectAndExtractArchive,
  isProtectedPackage,
  resolveSafeTexmfPath,
  runCommandSafe,
  validatePackageName,
} from '../security-utils.mjs'

const SOCKET_PATH =
  process.env.PACKAGE_HUB_SOCKET_PATH || '/run/overleaf-package-hub/hub.sock'

function callHub(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body != null ? JSON.stringify(body) : null
    const headers = {}
    if (payload != null) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(payload)
    }
    const req = http.request(
      {
        socketPath: SOCKET_PATH,
        path: endpoint,
        method,
        headers,
        timeout: 60000,
      },
      res => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          resolve({
            statusCode: res.statusCode,
            data: text ? JSON.parse(text) : {},
          })
        })
      }
    )
    req.on('error', reject)
    if (payload != null) req.write(payload)
    req.end()
  })
}

async function waitForJobViaSseOrPoll(jobId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Job ${jobId} timed out`)), 180000)
    const req = http.request(
      {
        socketPath: SOCKET_PATH,
        path: `/jobs/${encodeURIComponent(jobId)}/stream`,
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
      },
      res => {
        let buf = ''
        let lastEvent = null
        res.on('data', chunk => {
          buf += chunk.toString('utf8')
          let idx
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const frame = buf.slice(0, idx)
            buf = buf.slice(idx + 2)
            for (const line of frame.split('\n')) {
              if (line.startsWith('data: ')) {
                try {
                  const ev = JSON.parse(line.slice(6))
                  lastEvent = ev
                  if (ev.status === 'success' || ev.status === 'failed') {
                    clearTimeout(timer)
                    resolve(ev)
                    req.destroy()
                    return
                  }
                } catch {}
              }
            }
          }
        })
        res.on('end', () => {
          clearTimeout(timer)
          if (lastEvent) resolve(lastEvent)
          else reject(new Error(`SSE ended without terminal event for ${jobId}`))
        })
      }
    )
    req.on('error', err => {
      clearTimeout(timer)
      reject(err)
    })
    req.end()
  })
}

async function runUnitTests() {
  // 1. Package name validation
  assert.equal(validatePackageName('enumitem'), true)
  assert.equal(validatePackageName('tikz-cd'), true)
  assert.equal(validatePackageName('texlive.infra'), true)
  assert.equal(validatePackageName('amsmath; rm -rf /'), false)
  assert.equal(validatePackageName('../evil'), false)
  assert.equal(validatePackageName('foo bar'), false)
  assert.equal(validatePackageName('pkg$(whoami)'), false)
  assert.equal(validatePackageName(''), false)

  // 2. Protected core packages denylist
  assert.equal(isProtectedPackage('amsmath'), true)
  assert.equal(isProtectedPackage('latex-base'), true)
  assert.equal(isProtectedPackage('hyperref'), true)
  assert.equal(isProtectedPackage('collection-latex'), true)
  assert.equal(isProtectedPackage('enumitem'), false)

  // 3. Path traversal rejection
  assert.throws(() => resolveSafeTexmfPath(TEXMFLOCAL, '..', '..', 'etc', 'passwd'))
  assert.throws(() => resolveSafeTexmfPath(TEXMFLOCAL, 'tex', '../escape'))
  const safePath = resolveSafeTexmfPath(TEXMFLOCAL, 'tex', 'latex', 'custom', 'demo')
  assert.equal(safePath.startsWith(TEXMFLOCAL), true)

  // 4. Archive extraction sandboxing (reject symlinks & path traversal)
  const tmpDir = await fsp.mkdtemp('/tmp/pkg-hub-unit-')
  try {
    // Valid .zip extraction
    const srcGood = path.join(tmpDir, 'src-good')
    await fsp.mkdir(srcGood)
    await fsp.writeFile(path.join(srcGood, 'goodpkg.sty'), '\\ProvidesPackage{goodpkg}\\endinput\n')
    const goodZip = path.join(tmpDir, 'good.zip')
    const zipPyRes = await runCommandSafe('/usr/bin/python3', [
      '-c',
      `import zipfile; zf=zipfile.ZipFile("${goodZip}","w"); zf.write("${path.join(srcGood, 'goodpkg.sty')}", arcname="goodpkg.sty"); zf.close()`,
    ])
    assert.equal(zipPyRes.code, 0, `python3 zipfile creation failed: ${zipPyRes.stderr}`)
    const outGood = path.join(tmpDir, 'out-good')
    const extracted = await inspectAndExtractArchive(goodZip, 'good.zip', outGood)
    assert.deepEqual(extracted, ['goodpkg.sty'])

    // Symlink in tar.gz rejected
    const srcSym = path.join(tmpDir, 'src-sym')
    await fsp.mkdir(srcSym)
    await fsp.symlink('/etc/passwd', path.join(srcSym, 'evil.sty'))
    const evilTar = path.join(tmpDir, 'evil.tar.gz')
    await runCommandSafe('/usr/bin/tar', ['-czf', evilTar, 'evil.sty'], { cwd: srcSym })
    const outEvil = path.join(tmpDir, 'out-evil')
    await assert.rejects(() => inspectAndExtractArchive(evilTar, 'evil.tar.gz', outEvil), /Symlink/i)

    // Path traversal in tar.gz rejected
    const outTrav = path.join(tmpDir, 'out-trav')
    const travTar = path.join(tmpDir, 'trav.tar.gz')
    await fsp.writeFile(path.join(tmpDir, 'pwn.sty'), 'test')
    const pythonRes = await runCommandSafe('/usr/bin/python3', [
      '-c',
      `import tarfile, sys; tf=tarfile.open("${travTar}","w:gz"); tf.add("${path.join(tmpDir, 'pwn.sty')}", arcname="../../etc/pwn.sty"); tf.close()`,
    ])
    if (pythonRes.code === 0) {
      await assert.rejects(() => inspectAndExtractArchive(travTar, 'trav.tar.gz', outTrav), /traversal/i)
    }
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true })
  }

  console.log('[pass] unit tests (validation, protected list, path security, archive sandbox) passed')
}

async function runIntegrationTests() {
  if (!fs.existsSync(SOCKET_PATH)) {
    throw new Error(`Package Hub socket not running at ${SOCKET_PATH}`)
  }

  // 1. Health & OpenAPI check
  const health = await callHub('GET', '/health')
  assert.equal(health.statusCode, 200)
  assert.equal(health.data.ok, true)
  assert.ok(health.data.installedCount > 100)

  const docs = await callHub('GET', '/docs')
  assert.equal(docs.statusCode, 200)
  assert.equal(docs.data.openapi, '3.0.3')
  assert.ok(docs.data.paths['/api/packages/install'])

  // 2. Load test: 100 concurrent GET /packages requests
  const t0 = Date.now()
  const loadResults = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      callHub('GET', `/packages?source=all&page=${(i % 3) + 1}&limit=24`)
    )
  )
  const elapsed = Date.now() - t0
  for (const r of loadResults) {
    assert.equal(r.statusCode, 200)
    assert.ok(Array.isArray(r.data.items))
  }
  console.log(`[pass] 100 concurrent package-list requests completed in ${elapsed}ms`)

  // 3. Protected package removal blocked with HTTP 409
  const blocked = await callHub('POST', '/packages/remove', {
    names: ['amsmath'],
    _userId: 'test',
    _userEmail: 'test@overleaf.local',
  })
  assert.equal(blocked.statusCode, 409)
  assert.equal(blocked.data.code, 'PROTECTED_PACKAGE')
  console.log('[pass] protected package removal blocked with HTTP 409')

  // 4. Custom .sty upload: dry-run validate -> install -> compile LaTeX -> remove
  const customTmp = await fsp.mkdtemp('/var/lib/overleaf/tmp/uploads/test-hub-')
  const customStyPath = path.join(customTmp, 'coslhubtest.sty')
  await fsp.writeFile(
    customStyPath,
    '\\NeedsTeXFormat{LaTeX2e}\n\\ProvidesPackage{coslhubtest}[2026/11/19 COSL Hub Test]\n\\newcommand{\\coslHello}{Hello from COSL Custom Style}\n',
    'utf8'
  )

  const dryRun = await callHub('POST', '/packages/upload/validate', {
    tempFilePath: customStyPath,
    originalName: 'coslhubtest.sty',
  })
  assert.equal(dryRun.statusCode, 200)
  assert.equal(dryRun.data.valid, true)
  assert.equal(dryRun.data.compileTest.passed, true)

  const uploadRes = await callHub('POST', '/packages/upload', {
    tempFilePath: customStyPath,
    originalName: 'coslhubtest.sty',
    description: 'Integration test style file',
    _userId: 'test',
    _userEmail: 'test@overleaf.local',
  })
  assert.equal(uploadRes.statusCode, 202)
  const uploadJob = await waitForJobViaSseOrPoll(uploadRes.data.jobId)
  assert.equal(uploadJob.status, 'success')

  // Compile test document using \usepackage{coslhubtest}
  const compileDir1 = await fsp.mkdtemp('/tmp/pkg-hub-compile-custom-')
  try {
    await fsp.writeFile(
      path.join(compileDir1, 'main.tex'),
      '\\documentclass{article}\n\\usepackage{coslhubtest}\n\\begin{document}\n\\coslHello\n\\end{document}\n',
      'utf8'
    )
    const comp1 = await runCommandSafe(
      PDFLATEX_BIN,
      ['-interaction=nonstopmode', '-no-shell-escape', '-halt-on-error', 'main.tex'],
      { cwd: compileDir1, timeoutMs: 30000 }
    )
    assert.equal(comp1.code, 0, `pdflatex with coslhubtest failed: ${comp1.stdout}`)
    assert.ok(fs.existsSync(path.join(compileDir1, 'main.pdf')))
  } finally {
    await fsp.rm(compileDir1, { recursive: true, force: true })
    await fsp.rm(customTmp, { recursive: true, force: true })
  }

  const delCustom = await callHub('DELETE', '/packages/custom/coslhubtest')
  assert.equal(delCustom.statusCode, 200)
  assert.equal(delCustom.data.ok, true)
  console.log('[pass] custom .sty dry-run validation, upload, pdflatex compile, and deletion passed')

  // 5. Real TeX Live install (enumitem) -> SSE progress -> pdflatex compile -> uninstall
  const instRes = await callHub('POST', '/packages/install', {
    names: ['enumitem'],
    source: 'texlive',
    _userId: 'test',
    _userEmail: 'test@overleaf.local',
  })
  assert.equal(instRes.statusCode, 202)
  const instJob = await waitForJobViaSseOrPoll(instRes.data.jobId)
  assert.equal(instJob.status, 'success', `enumitem install failed: ${instJob.error}`)

  const metaEnum = await callHub('GET', '/packages/enumitem')
  assert.equal(metaEnum.statusCode, 200)
  assert.equal(metaEnum.data.installed, true)

  const compileDir2 = await fsp.mkdtemp('/tmp/pkg-hub-compile-enum-')
  try {
    await fsp.writeFile(
      path.join(compileDir2, 'main.tex'),
      '\\documentclass{article}\n\\usepackage{enumitem}\n\\begin{document}\n\\begin{enumerate}[label=\\alph*)]\n\\item Verified enumitem integration\n\\end{enumerate}\n\\end{document}\n',
      'utf8'
    )
    const comp2 = await runCommandSafe(
      PDFLATEX_BIN,
      ['-interaction=nonstopmode', '-no-shell-escape', '-halt-on-error', 'main.tex'],
      { cwd: compileDir2, timeoutMs: 30000 }
    )
    assert.equal(comp2.code, 0, `pdflatex with enumitem failed: ${comp2.stdout}`)
    assert.ok(fs.existsSync(path.join(compileDir2, 'main.pdf')))
  } finally {
    await fsp.rm(compileDir2, { recursive: true, force: true })
  }

  const rmRes = await callHub('POST', '/packages/remove', {
    names: ['enumitem'],
    source: 'texlive',
    _userId: 'test',
    _userEmail: 'test@overleaf.local',
  })
  assert.equal(rmRes.statusCode, 202)
  const rmJob = await waitForJobViaSseOrPoll(rmRes.data.jobId)
  assert.equal(rmJob.status, 'success')

  const metaAfterRm = await callHub('GET', '/packages/enumitem')
  assert.equal(metaAfterRm.data.installed, false)
  console.log('[pass] live TeX Live install (enumitem), SSE stream, pdflatex compile, and removal passed')

  // 5b. Live TeX Live install -> update -> remove (12many)
  const inst12Res = await callHub('POST', '/packages/install', {
    names: ['12many'],
    source: 'texlive',
    _userId: 'test',
    _userEmail: 'test@overleaf.local',
  })
  assert.equal(inst12Res.statusCode, 202)
  const inst12Job = await waitForJobViaSseOrPoll(inst12Res.data.jobId)
  assert.equal(inst12Job.status, 'success', `12many install failed: ${inst12Job.error}`)

  const meta12Inst = await callHub('GET', '/packages/12many')
  assert.equal(meta12Inst.statusCode, 200)
  assert.equal(meta12Inst.data.installed, true)

  const upd12Res = await callHub('POST', '/packages/update', {
    names: ['12many'],
    _userId: 'test',
    _userEmail: 'test@overleaf.local',
  })
  assert.equal(upd12Res.statusCode, 202)
  const upd12Job = await waitForJobViaSseOrPoll(upd12Res.data.jobId)
  assert.equal(upd12Job.status, 'success', `12many update failed: ${upd12Job.error}`)

  const rm12Res = await callHub('POST', '/packages/remove', {
    names: ['12many'],
    source: 'texlive',
    _userId: 'test',
    _userEmail: 'test@overleaf.local',
  })
  assert.equal(rm12Res.statusCode, 202)
  const rm12Job = await waitForJobViaSseOrPoll(rm12Res.data.jobId)
  assert.equal(rm12Job.status, 'success', `12many remove failed: ${rm12Job.error}`)

  const meta12AfterRm = await callHub('GET', '/packages/12many')
  assert.equal(meta12AfterRm.statusCode, 200)
  assert.equal(meta12AfterRm.data.installed, false)
  console.log('[pass] live TeX Live install, update, and removal (12many) passed')

  // 5c. Live CTAN install -> update -> remove (tikz-cd)
  const instCtanRes = await callHub('POST', '/packages/install', {
    names: ['tikz-cd'],
    source: 'ctan',
    _userId: 'test',
    _userEmail: 'test@overleaf.local',
  })
  assert.equal(instCtanRes.statusCode, 202)
  const instCtanJob = await waitForJobViaSseOrPoll(instCtanRes.data.jobId)
  assert.equal(instCtanJob.status, 'success', `tikz-cd CTAN install failed: ${instCtanJob.error}`)

  const metaCtanInst = await callHub('GET', '/packages/tikz-cd')
  assert.equal(metaCtanInst.statusCode, 200)
  assert.equal(metaCtanInst.data.installed, true)

  const updCtanRes = await callHub('POST', '/packages/update', {
    names: ['tikz-cd'],
    _userId: 'test',
    _userEmail: 'test@overleaf.local',
  })
  assert.equal(updCtanRes.statusCode, 202)
  const updCtanJob = await waitForJobViaSseOrPoll(updCtanRes.data.jobId)
  assert.equal(updCtanJob.status, 'success', `tikz-cd CTAN update failed: ${updCtanJob.error}`)

  const rmCtanRes = await callHub('POST', '/packages/remove', {
    names: ['tikz-cd'],
    source: 'ctan',
    _userId: 'test',
    _userEmail: 'test@overleaf.local',
  })
  assert.equal(rmCtanRes.statusCode, 202)
  const rmCtanJob = await waitForJobViaSseOrPoll(rmCtanRes.data.jobId)
  assert.equal(rmCtanJob.status, 'success', `tikz-cd CTAN remove failed: ${rmCtanJob.error}`)

  const metaCtanAfterRm = await callHub('GET', '/packages/tikz-cd')
  assert.equal(metaCtanAfterRm.statusCode, 200)
  assert.equal(metaCtanAfterRm.data.installed, false)
  console.log('[pass] live CTAN install, update, and removal (tikz-cd) passed')

  // 6. Community manifest registration & listing
  const regComm = await callHub('POST', '/sources/community', {
    manifest: {
      name: 'cosl-ci-sample-pack',
      version: '1.0.0',
      description: 'CI verified community manifest',
      author: 'COSL',
      packages: ['amsmath', 'hyperref'],
    },
    _userId: 'test',
    _userEmail: 'test@overleaf.local',
  })
  assert.equal(regComm.statusCode, 200)
  assert.equal(regComm.data.manifest.name, 'cosl-ci-sample-pack')

  const commInstall = await callHub('POST', '/packages/install', {
    names: ['cosl-ci-sample-pack'],
    source: 'community',
    _userId: 'test',
    _userEmail: 'test@overleaf.local',
  })
  assert.equal(commInstall.statusCode, 202)
  const commJob = await waitForJobViaSseOrPoll(commInstall.data.jobId)
  assert.equal(commJob.status, 'success')
  console.log('[pass] community pack manifest registration and install passed')

  // 7. Audit log verification
  const audit = await callHub('GET', '/audit?limit=20')
  assert.equal(audit.statusCode, 200)
  assert.ok(audit.data.items.some(e => e.package_name === 'amsmath' && e.result === 'blocked'))
  assert.ok(audit.data.items.some(e => e.package_name === 'enumitem' && e.action === 'install'))
  console.log('[pass] audit log verification passed')

  // 8. Clear activity & audit history verification
  const jobsBeforeClear = await callHub('GET', '/jobs?limit=10')
  assert.equal(jobsBeforeClear.statusCode, 200)
  assert.ok(jobsBeforeClear.data.items.length > 0)

  const clearRes = await callHub('POST', '/history/clear', {
    scope: 'all',
    _userId: 'test',
    _userEmail: 'test@overleaf.local',
  })
  assert.equal(clearRes.statusCode, 200)
  assert.equal(clearRes.data.ok, true)
  assert.equal(clearRes.data.remainingAuditCount, 0)

  const jobsAfterClear = await callHub('GET', '/jobs?limit=10')
  assert.equal(jobsAfterClear.statusCode, 200)
  assert.ok(
    jobsAfterClear.data.items.every(
      j => j.status === 'running' || j.status === 'queued'
    )
  )

  const auditAfterClear = await callHub('GET', '/audit?limit=10')
  assert.equal(auditAfterClear.statusCode, 200)
  assert.equal(auditAfterClear.data.items.length, 0)
  console.log('[pass] activity and audit history clear endpoint passed')
}

async function main() {
  await runUnitTests()
  if (fs.existsSync(SOCKET_PATH)) {
    await runIntegrationTests()
  } else {
    console.log('[skip] daemon socket not present, skipped integration checks')
  }
  console.log('ALL PACKAGE HUB TESTS PASSED')
}

main().catch(err => {
  console.error('TEST FAILED:', err)
  process.exit(1)
})
