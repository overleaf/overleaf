import path from 'path-browserify'
import type { PyodideInterface } from 'pyodide'
import type {
  ProjectFileData,
  PyodideWorkerRequest,
  RunCodeRequest,
} from './pyodide-worker-messages'

type PyodideFS = PyodideInterface['FS']
type PyodideModule = typeof import('pyodide')

const PROJECT_FS_ROOT = '/project'
const PYODIDE_INDEX_PATH = 'js/libs/pyodide/'

function ensureDirectoryExists(fs: PyodideFS, filePath: string) {
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

function syncProjectFiles(fs: PyodideFS, files: ProjectFileData[]) {
  for (const file of files) {
    const runtimePath = path.posix.join(
      PROJECT_FS_ROOT,
      path.posix.normalize(file.relativePath)
    )
    ensureDirectoryExists(fs, runtimePath)
    fs.writeFile(runtimePath, file.content)
  }

  fs.chdir(PROJECT_FS_ROOT)
}

let pyodideModule: PyodideModule | null = null

async function loadPyodideModule(pyodideIndexUrl: string) {
  const runtimeModuleUrl = `${pyodideIndexUrl}pyodide.mjs`

  try {
    return (await import(
      /* webpackIgnore: true */ runtimeModuleUrl
    )) as PyodideModule
  } catch (loadError) {
    const loadErrorMessage =
      loadError instanceof Error ? loadError.message : String(loadError)
    throw new Error(
      `Unable to load Pyodide module from ${runtimeModuleUrl}. Original error: ${loadErrorMessage}`
    )
  }
}

async function handleInit(msg: { baseAssetPath: string }) {
  const pyodideIndexUrl = new URL(
    PYODIDE_INDEX_PATH,
    msg.baseAssetPath
  ).toString()

  try {
    pyodideModule = await loadPyodideModule(pyodideIndexUrl)
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
  if (!pyodideModule) {
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

  const instance = await pyodideModule.loadPyodide({
    env: { MPLBACKEND: 'Agg' },
  })

  instance.setStdout({
    batched: (line: string) => {
      self.postMessage({
        type: 'output-line',
        stream: 'stdout',
        line,
        requestId: msg.id,
      })
    },
  })
  instance.setStderr({
    batched: (line: string) => {
      self.postMessage({
        type: 'output-line',
        stream: 'stderr',
        line,
        requestId: msg.id,
      })
    },
  })

  try {
    if (msg.files.length > 0) {
      const fs = instance.FS
      syncProjectFiles(fs, msg.files)
    }

    const result = await instance.runPythonAsync(msg.code)
    if (result !== undefined) {
      self.postMessage({
        type: 'output-line',
        stream: 'stdout',
        line: String(result),
        requestId: msg.id,
      })
    }
  } catch (runError) {
    const errorMessage =
      runError instanceof Error ? runError.message : String(runError)

    self.postMessage({
      type: 'output-line',
      stream: 'stderr',
      line: errorMessage,
      requestId: msg.id,
    })
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
