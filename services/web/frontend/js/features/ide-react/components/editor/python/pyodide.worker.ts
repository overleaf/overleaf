import path from 'path-browserify'
import type {
  ProjectFileData,
  PyodideWorkerRequest,
  RunCodeRequest,
} from './pyodide-worker-messages'

type PyodideRuntimeModule = {
  loadPyodide: (options: {
    indexURL: string
    packageBaseUrl?: string
    env?: Record<string, string>
    packages?: string[]
  }) => Promise<PyodideInstance>
}

type PyodideInstance = {
  FS: unknown
  runPythonAsync: (code: string) => Promise<unknown>
  setStdout: (options: { batched: (line: string) => void }) => void
  setStderr: (options: { batched: (line: string) => void }) => void
}

type PyodideFs = {
  analyzePath: (filePath: string) => { exists: boolean }
  mkdir: (filePath: string) => void
  writeFile: (
    filePath: string,
    content: string | ArrayBuffer | Uint8Array
  ) => void
  chdir: (filePath: string) => void
}

const PROJECT_FS_ROOT = '/project'
const PYODIDE_INDEX_PATH = 'js/libs/pyodide/'

function getPyodideIndexUrl(baseAssetPath: string): string {
  return new URL(PYODIDE_INDEX_PATH, baseAssetPath).toString()
}

function toRuntimeProjectPath(relativePath: string): string {
  return path.posix.join(PROJECT_FS_ROOT, path.posix.normalize(relativePath))
}

function ensureProjectRootExists(fs: PyodideFs) {
  try {
    const projectRootAnalysis = fs.analyzePath(PROJECT_FS_ROOT)
    if (!projectRootAnalysis.exists) {
      fs.mkdir(PROJECT_FS_ROOT)
    }
  } catch {
    fs.mkdir(PROJECT_FS_ROOT)
  }
}

function ensureDirectoryExists(fs: PyodideFs, filePath: string) {
  const directory = path.dirname(filePath)
  if (directory === '.' || directory === '/') {
    return
  }

  let currentPath = directory.startsWith('/') ? '/' : ''
  for (const part of directory.split('/').filter(Boolean)) {
    currentPath = path.posix.join(currentPath, part)
    try {
      const analysis = fs.analyzePath(currentPath)
      if (!analysis.exists) {
        fs.mkdir(currentPath)
      }
    } catch {
      // Ignore failures when a directory already exists.
    }
  }
}

function syncProjectFiles(fs: PyodideFs, files: ProjectFileData[]) {
  ensureProjectRootExists(fs)

  for (const file of files) {
    const runtimePath = toRuntimeProjectPath(file.relativePath)
    ensureDirectoryExists(fs, runtimePath)
    fs.writeFile(runtimePath, file.content)
  }

  fs.chdir(PROJECT_FS_ROOT)
}

let pyodideInstance: PyodideInstance | null = null
let activeRunRequestId: string | null = null

async function loadPyodideModule(
  pyodideIndexUrl: string
): Promise<PyodideRuntimeModule> {
  const runtimeModuleUrl = `${pyodideIndexUrl}pyodide.mjs`

  try {
    return (await import(
      /* webpackIgnore: true */ runtimeModuleUrl
    )) as PyodideRuntimeModule
  } catch (loadError) {
    const loadErrorMessage =
      loadError instanceof Error ? loadError.message : String(loadError)
    throw new Error(
      `Unable to load Pyodide module from ${runtimeModuleUrl}. Original error: ${loadErrorMessage}`
    )
  }
}

async function handleInit(msg: { baseAssetPath: string }) {
  const pyodideIndexUrl = getPyodideIndexUrl(msg.baseAssetPath)

  try {
    const pyodideModule = await loadPyodideModule(pyodideIndexUrl)
    const instance = await pyodideModule.loadPyodide({
      indexURL: pyodideIndexUrl,
      packageBaseUrl: pyodideIndexUrl,
      env: { MPLBACKEND: 'Agg' },
    })

    instance.setStdout({
      batched: (line: string) => {
        self.postMessage({
          type: 'output-line',
          stream: 'stdout',
          line,
          requestId: activeRunRequestId ?? undefined,
        })
      },
    })
    instance.setStderr({
      batched: (line: string) => {
        self.postMessage({
          type: 'output-line',
          stream: 'stderr',
          line,
          requestId: activeRunRequestId ?? undefined,
        })
      },
    })

    pyodideInstance = instance
    self.postMessage({ type: 'loaded' })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Pyodide initialization failed', error)
    self.postMessage({
      type: 'loading-failed',
      error: errorMessage,
    })
  }
}

async function handleRunCode(msg: RunCodeRequest) {
  if (!pyodideInstance) {
    const error = 'Pyodide is not initialized'
    self.postMessage({
      type: 'output-line',
      stream: 'stderr',
      line: error,
      requestId: msg.id,
    })
    self.postMessage({
      type: 'run-code-result',
      id: msg.id,
    })
    return
  }

  activeRunRequestId = msg.id
  try {
    if (msg.files.length > 0) {
      const fs = pyodideInstance.FS as PyodideFs
      syncProjectFiles(fs, msg.files)
    }

    const result = await pyodideInstance.runPythonAsync(msg.code)
    if (result !== undefined) {
      self.postMessage({
        type: 'output-line',
        stream: 'stdout',
        line: String(result),
        requestId: activeRunRequestId ?? undefined,
      })
    }
  } catch (runError) {
    const errorMessage =
      runError instanceof Error ? runError.message : String(runError)
    self.postMessage({
      type: 'output-line',
      stream: 'stderr',
      line: errorMessage,
      requestId: activeRunRequestId ?? undefined,
    })
  } finally {
    activeRunRequestId = null
  }

  self.postMessage({
    type: 'run-code-result',
    id: msg.id,
  })
}

self.addEventListener('message', async event => {
  const msg = event.data as PyodideWorkerRequest
  switch (msg.type) {
    case 'init':
      await handleInit(msg)
      break
    case 'run-code':
      await handleRunCode(msg)
      break
  }
})

self.postMessage({ type: 'listening' })
