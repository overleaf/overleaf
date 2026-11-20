import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import {
  KPSEWHICH_BIN,
  MKTEXLSR_BIN,
  PDFLATEX_BIN,
  TEXMFLOCAL,
  inspectAndExtractArchive,
  isProtectedPackage,
  resolveSafeTexmfPath,
  runCommandSafe,
  validatePackageName,
} from '../security-utils.mjs'
import { stateStore } from '../state-store.mjs'

export const ALLOWED_EXTENSIONS = [
  '.tar.gz',
  '.tgz',
  '.zip',
  '.sty',
  '.cls',
  '.bst',
  '.bib',
  '.def',
  '.fd',
  '.cfg',
]

export function hasAllowedExtension(filename) {
  const lower = String(filename || '').toLowerCase()
  return ALLOWED_EXTENSIONS.some(ext => lower.endsWith(ext))
}

export function derivePackageName(originalName, requestedName) {
  if (requestedName && String(requestedName).trim()) {
    const cleaned = String(requestedName).trim().replace(/\.(sty|cls|bst|bib|zip|tar\.gz|tgz)$/i, '')
    if (!validatePackageName(cleaned)) {
      const err = new Error(`Invalid package name: ${cleaned}`)
      err.statusCode = 400
      throw err
    }
    return cleaned
  }
  const base = path
    .basename(String(originalName || 'custom-package'))
    .replace(/\.(tar\.gz|tgz|zip|sty|cls|bst|bib|def|fd|cfg)$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const fallback = base || 'custom-pkg'
  if (!validatePackageName(fallback)) {
    const err = new Error(`Derived package name is invalid: ${fallback}`)
    err.statusCode = 400
    throw err
  }
  return fallback
}

function detectPackageArtifacts(files) {
  const styFiles = files.filter(f => f.toLowerCase().endsWith('.sty'))
  const clsFiles = files.filter(f => f.toLowerCase().endsWith('.cls'))
  const bstFiles = files.filter(f => f.toLowerCase().endsWith('.bst'))
  const bibFiles = files.filter(f => f.toLowerCase().endsWith('.bib'))

  let detectedType = 'style'
  let entryFile = styFiles[0] || clsFiles[0] || bstFiles[0] || bibFiles[0] || files[0] || null
  if (clsFiles.length > 0 && styFiles.length === 0) {
    detectedType = 'class'
    entryFile = clsFiles[0]
  } else if (bstFiles.length > 0 && styFiles.length === 0) {
    detectedType = 'bst'
    entryFile = bstFiles[0]
  } else if (bibFiles.length > 0 && styFiles.length === 0 && clsFiles.length === 0) {
    detectedType = 'bib'
    entryFile = bibFiles[0]
  }

  return { detectedType, entryFile, styFiles, clsFiles, bstFiles }
}

function toDto(rec) {
  return {
    id: `custom:${rec.name}`,
    name: rec.name,
    source: 'custom',
    category: 'Custom',
    version: rec.version || '1.0.0',
    installed_version: rec.version || '1.0.0',
    installed: true,
    update_available: false,
    protected: false,
    shortdesc: rec.description || `Custom ${rec.type || 'style'} package uploaded by ${rec.uploaded_by_email || rec.uploaded_by || 'user'}`,
    description: rec.description || `Custom ${rec.type || 'LaTeX'} package (${(rec.files || []).join(', ')})`,
    longdesc: `Uploaded by ${rec.uploaded_by_email || rec.uploaded_by || 'user'} on ${rec.installedAt}. Files: ${(rec.files || []).join(', ')}`,
    license: 'custom',
    author: rec.uploaded_by_email || rec.uploaded_by || 'User Upload',
    uploaded_by: rec.uploaded_by || null,
    uploaded_by_email: rec.uploaded_by_email || '',
    homepage: '',
    ctanPath: '',
    topics: ['custom', rec.type || 'latex'],
    size_kb: rec.size_kb || 1,
    dependencies: [],
    runfiles: rec.files || [],
    created_at: rec.installedAt,
    updated_at: rec.installedAt,
  }
}

export const customSource = {
  id: 'custom',
  name: 'Custom Uploads',

  async list() {
    const map = stateStore.getState().customPackages || {}
    return Object.values(map)
      .map(toDto)
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  async search(query) {
    const all = await this.list()
    const q = String(query || '').trim().toLowerCase()
    if (!q) return all
    return all.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    )
  },

  async getMetadata(name) {
    if (!validatePackageName(name)) return null
    const rec = stateStore.getState().customPackages?.[name]
    return rec ? toDto(rec) : null
  },

  /**
   * Dry-run validation: unpack safely into a temp sandbox and compile a minimal test .tex with pdflatex.
   */
  async validateUpload(tempFilePath, originalName, requestedPkgName) {
    if (!hasAllowedExtension(originalName)) {
      const err = new Error(
        `Unsupported file extension. Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}`
      )
      err.statusCode = 400
      throw err
    }

    const pkgName = derivePackageName(originalName, requestedPkgName)
    if (isProtectedPackage(pkgName)) {
      const err = new Error(`Cannot overwrite protected core package name "${pkgName}"`)
      err.statusCode = 409
      throw err
    }

    const sandboxDir = await fsp.mkdtemp(`/tmp/pkg-hub-validate-${pkgName}-`)
    const extractDir = path.join(sandboxDir, 'pkg')
    const compileDir = path.join(sandboxDir, 'compile')
    try {
      await fsp.mkdir(extractDir, { recursive: true })
      await fsp.mkdir(compileDir, { recursive: true })

      const files = await inspectAndExtractArchive(tempFilePath, originalName, extractDir)
      if (files.length === 0) {
        const err = new Error('Uploaded file or archive contained no files')
        err.statusCode = 400
        throw err
      }

      const { detectedType, entryFile, styFiles, clsFiles } = detectPackageArtifacts(files)
      const st = await fsp.stat(tempFilePath)
      const sizeKb = Math.max(1, Math.round(st.size / 1024))

      let compilePassed = true
      let compileLog = 'Verified archive structure and allowed TeX artifact extensions.'

      if (entryFile && (detectedType === 'style' || detectedType === 'class')) {
        const entryBase = path.basename(entryFile).replace(/\.(sty|cls)$/i, '')
        const texSource =
          detectedType === 'class'
            ? `\\documentclass{${entryBase}}\n\\begin{document}\nPackage Hub dry-run class validation succeeded.\n\\end{document}\n`
            : `\\documentclass{article}\n\\usepackage{${entryBase}}\n\\begin{document}\nPackage Hub dry-run style validation succeeded.\n\\end{document}\n`

        await fsp.writeFile(path.join(compileDir, 'dryrun.tex'), texSource, 'utf8')
        const compileRes = await runCommandSafe(
          PDFLATEX_BIN,
          ['-interaction=nonstopmode', '-no-shell-escape', '-halt-on-error', 'dryrun.tex'],
          {
            cwd: compileDir,
            env: {
              TEXINPUTS: `${extractDir}//:`,
            },
            timeoutMs: 30000,
          }
        )
        compilePassed = compileRes.code === 0
        compileLog =
          (compileRes.stdout || compileRes.stderr || '').trim().slice(-2500) ||
          (compilePassed ? 'pdflatex dry-run compile succeeded' : 'pdflatex dry-run compile failed')
      }

      const resolvedName =
        !requestedPkgName && (styFiles[0] || clsFiles[0])
          ? derivePackageName(styFiles[0] || clsFiles[0], null)
          : pkgName

      return {
        ok: true,
        valid: compilePassed,
        packageName: resolvedName,
        detectedType,
        entryFile,
        sizeKb,
        files,
        compileTest: {
          passed: compilePassed,
          log: compileLog,
        },
      }
    } finally {
      await fsp.rm(sandboxDir, { recursive: true, force: true })
    }
  },

  async installUpload(
    tempFilePath,
    originalName,
    { packageName, description, version, userId, userEmail },
    ctx
  ) {
    if (!hasAllowedExtension(originalName)) {
      const err = new Error(
        `Unsupported file extension. Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}`
      )
      err.statusCode = 400
      throw err
    }

    ctx.setProgress(15, 'Validating upload', `Inspecting ${originalName}...`)
    const dryRun = await this.validateUpload(tempFilePath, originalName, packageName)
    const finalName = dryRun.packageName

    const baseSubdirs =
      dryRun.detectedType === 'bst'
        ? ['bibtex', 'bst', 'custom', finalName]
        : dryRun.detectedType === 'bib'
          ? ['bibtex', 'bib', 'custom', finalName]
          : ['tex', 'latex', 'custom', finalName]

    const targetDir = resolveSafeTexmfPath(TEXMFLOCAL, ...baseSubdirs)
    ctx.setProgress(45, 'Installing to texmf-local', `Extracting into ${targetDir}...`)
    await fsp.rm(targetDir, { recursive: true, force: true })
    await fsp.mkdir(targetDir, { recursive: true, mode: 0o755 })

    const files = await inspectAndExtractArchive(tempFilePath, originalName, targetDir)

    ctx.setProgress(75, 'Updating TeX filename database', 'Running mktexlsr...')
    await ctx.withTlmgrLock(async () => {
      await runCommandSafe(MKTEXLSR_BIN, [], {
        timeoutMs: 60000,
        onLine: l => ctx.appendLog(l),
      })
    })

    // Verify discovery via kpsewhich if it has an entry file
    if (dryRun.entryFile) {
      const kpseRes = await runCommandSafe(
        KPSEWHICH_BIN,
        [path.basename(dryRun.entryFile)],
        { timeoutMs: 10000 }
      )
      if (kpseRes.code === 0 && kpseRes.stdout.trim()) {
        ctx.appendLog(`kpsewhich resolved: ${kpseRes.stdout.trim()}`)
      }
    }

    const st = await fsp.stat(tempFilePath)
    stateStore.getState().customPackages[finalName] = {
      name: finalName,
      version: version || '1.0.0',
      description:
        description ||
        `Custom ${dryRun.detectedType} package uploaded from ${path.basename(originalName)}`,
      type: dryRun.detectedType,
      size_kb: Math.max(1, Math.round(st.size / 1024)),
      files,
      targetSubdir: baseSubdirs.join('/'),
      uploaded_by: userId || 'system',
      uploaded_by_email: userEmail || '',
      compileValidated: dryRun.compileTest.passed,
      installedAt: new Date().toISOString(),
    }
    await stateStore.savePersistentState()

    try {
      await fsp.unlink(tempFilePath)
    } catch {}

    return {
      ok: true,
      packageName: finalName,
      detectedType: dryRun.detectedType,
      files,
      compileTest: dryRun.compileTest,
      message: `Custom package "${finalName}" installed successfully`,
    }
  },

  async remove(names, ctx) {
    const list = Array.isArray(names) ? names : [names]
    for (const pkg of list) {
      if (!validatePackageName(pkg)) {
        const err = new Error(`Invalid package name: ${pkg}`)
        err.statusCode = 400
        throw err
      }
      if (isProtectedPackage(pkg)) {
        const err = new Error(`Package "${pkg}" is protected and cannot be removed`)
        err.statusCode = 409
        throw err
      }

      const rec = stateStore.getState().customPackages[pkg]
      const dirsToTry = [
        resolveSafeTexmfPath(TEXMFLOCAL, 'tex', 'latex', 'custom', pkg),
        resolveSafeTexmfPath(TEXMFLOCAL, 'bibtex', 'bst', 'custom', pkg),
        resolveSafeTexmfPath(TEXMFLOCAL, 'bibtex', 'bib', 'custom', pkg),
      ]
      if (rec?.targetSubdir) {
        dirsToTry.unshift(resolveSafeTexmfPath(TEXMFLOCAL, ...rec.targetSubdir.split('/')))
      }
      for (const dir of dirsToTry) {
        await fsp.rm(dir, { recursive: true, force: true })
      }
      delete stateStore.getState().customPackages[pkg]
    }
    await stateStore.savePersistentState()
    await (ctx?.withTlmgrLock
      ? ctx.withTlmgrLock(() => runCommandSafe(MKTEXLSR_BIN, [], { timeoutMs: 60000 }))
      : runCommandSafe(MKTEXLSR_BIN, [], { timeoutMs: 60000 }))

    return {
      ok: true,
      removed: list,
      message: `Removed custom package(s): ${list.join(', ')}`,
    }
  },
}
