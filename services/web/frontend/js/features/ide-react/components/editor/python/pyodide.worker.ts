/// <reference lib="webworker" />
import path from 'path-browserify'
import type { PyodideInterface } from 'pyodide'
import type {
  ExecutionErrorType,
  OutputFileData,
  InitRequest,
  ProjectFileData,
  PyodideWorkerRequest,
  RunCodeRequest,
} from './pyodide-worker-messages'
import {
  checkOutputCount,
  checkOutputLimits,
} from './pyodide-worker-output-limits'

type PyodideFS = PyodideInterface['FS']
type PyodideModule = typeof import('pyodide')

const PROJECT_FS_ROOT = '/project'
const PROJECT_FS_PREFIX = `${PROJECT_FS_ROOT}/`
const PYODIDE_INDEX_PATH = 'js/libs/pyodide/'

function classifyErrorType(errorMessage: string): ExecutionErrorType {
  if (errorMessage.includes('ModuleNotFoundError')) {
    return 'ModuleNotFoundError'
  }
  if (errorMessage.includes('SyntaxError')) {
    return 'SyntaxError'
  }
  return 'generic'
}

function moduleNotFoundHelpMessage(): string {
  return (
    "Note: Only Pyodide's built-in packages are available in the browser. " +
    'Packages installed via pip cannot be used here. ' +
    'See https://pyodide.org/en/stable/usage/packages-in-pyodide.html ' +
    'for the list of supported packages.'
  )
}

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
let pyodideIndexUrl: string | undefined

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

async function handleInit(msg: InitRequest) {
  pyodideIndexUrl = new URL(PYODIDE_INDEX_PATH, msg.baseAssetPath).toString()

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
  const { fileId, executionId } = msg

  const writtenPaths = new Set<string>()
  const readPaths = new Set<string>()

  const computeImports = () =>
    [...readPaths].filter(path => !writtenPaths.has(path))

  const postFailure = (
    stream: 'stderr' | 'info',
    line: string,
    errorType: ExecutionErrorType = 'generic'
  ) => {
    self.postMessage({
      type: 'output-line',
      stream,
      line,
      fileId,
      executionId,
    })
    self.postMessage({
      type: 'run-code-result',
      fileId,
      executionId,
      success: false,
      outputs: [],
      outputFiles: [],
      imports: computeImports(),
      errorType,
    })
  }

  if (!pyodideModule || !pyodideIndexUrl) {
    postFailure('stderr', 'Pyodide is not initialized')
    return
  }

  const instance = await pyodideModule.loadPyodide({
    env: { MPLBACKEND: 'Agg' },
    packageBaseUrl: `${pyodideIndexUrl}${pyodideModule.version}/`,
  })

  instance.setStdout({
    batched: (line: string) => {
      self.postMessage({
        type: 'output-line',
        stream: 'stdout',
        line,
        fileId,
        executionId,
      })
    },
  })
  instance.setStderr({
    batched: (line: string) => {
      self.postMessage({
        type: 'output-line',
        stream: 'stderr',
        line,
        fileId,
        executionId,
      })
    },
  })

  const fs = instance.FS
  const originalWrite = fs.write as PyodideFS['write']
  const originalRead = fs.read as PyodideFS['read']
  let runError: unknown = null
  try {
    if (msg.files.length > 0) {
      syncProjectFiles(fs, msg.files)
    }

    fs.write = ((...args: Parameters<PyodideFS['write']>) => {
      const [stream] = args
      // Only surface writes to the synced project workspace, not Pyodide internals.
      if (
        typeof stream?.path === 'string' &&
        stream.path.startsWith(PROJECT_FS_PREFIX)
      ) {
        writtenPaths.add(stream.path)
      }

      return originalWrite.call(fs, ...args)
    }) as PyodideFS['write']

    fs.read = ((...args: Parameters<PyodideFS['read']>) => {
      const [stream] = args
      if (
        typeof stream?.path === 'string' &&
        stream.path.startsWith(PROJECT_FS_PREFIX)
      ) {
        readPaths.add(stream.path)
      }

      return originalRead.call(fs, ...args)
    }) as PyodideFS['read']

    await instance.loadPackagesFromImports(msg.code)
    const result = await instance.runPythonAsync(msg.code)
    if (result !== undefined) {
      self.postMessage({
        type: 'output-line',
        stream: 'stdout',
        line: String(result),
        fileId,
        executionId,
      })
    }
  } catch (e) {
    runError = e
  }
  fs.write = originalWrite
  fs.read = originalRead

  const paths = [...writtenPaths]

  if (runError) {
    const errorMessage =
      runError instanceof Error ? runError.message : String(runError)
    const errorType = classifyErrorType(errorMessage)
    const fullMessage =
      errorType === 'ModuleNotFoundError'
        ? `${errorMessage}\n${moduleNotFoundHelpMessage()}`
        : errorMessage
    postFailure('stderr', fullMessage, errorType)
    return
  }

  const countViolation = checkOutputCount(paths.length)
  if (countViolation) {
    postFailure('info', countViolation.message, 'OutputLimitExceeded')
    return
  }

  const filesWithSizes: { path: string; size: number }[] = []
  for (const writtenPath of paths) {
    try {
      filesWithSizes.push({
        path: writtenPath,
        size: fs.stat(writtenPath).size,
      })
    } catch {
      // A script can write a file and later delete or rename it before the run
      // finishes; fs.stat would then throw and we'd never post a
      // run-code-result, leaving the UI stuck. Skip paths we can't stat.
    }
  }

  const sizeViolation = checkOutputLimits(filesWithSizes)
  if (sizeViolation) {
    postFailure('info', sizeViolation.message, 'OutputLimitExceeded')
    return
  }

  const outputFiles: OutputFileData[] = []
  const transferables: Transferable[] = []
  for (const { path: writtenPath } of filesWithSizes) {
    const content = fs.readFile(writtenPath)
    const relativePath = writtenPath.slice(PROJECT_FS_PREFIX.length)
    outputFiles.push({ relativePath, content })
    if (content.buffer instanceof ArrayBuffer) {
      transferables.push(content.buffer)
    }
  }

  // The transferables moves ownership of each ArrayBuffer to the main thread
  // instead of structured-cloning it. The buffers are already referenced from
  // outputFiles.content; listing them here just swaps copy for move, so file
  // contents travel through once rather than being allocated on both sides.
  self.postMessage(
    {
      type: 'run-code-result',
      fileId,
      executionId,
      success: true,
      outputs: filesWithSizes.map(f => f.path),
      outputFiles,
      imports: computeImports(),
    },
    transferables
  )
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
