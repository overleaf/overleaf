import React, { FC, PropsWithChildren } from 'react'
import PythonOutputPane from '@/features/ide-react/components/editor/python/python-output-pane'
import {
  EditorProviders,
  projectDefaults,
} from '../../../helpers/editor-providers'
import { FileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { ProjectContext } from '@/shared/context/project-context'
import { ProjectSnapshot } from '@/infrastructure/project-snapshot'
import { PythonExecutionProvider } from '@/features/ide-react/context/python-execution-context'

const pythonExecutableScript: Record<string, string> = {
  file_id: 'test-py-doc-id',
  filename: 'test.py',
}

const FileTreePathProvider: FC<PropsWithChildren> = ({ children }) => {
  return (
    <FileTreePathContext.Provider
      value={{
        pathInFolder: () => pythonExecutableScript.filename,
        findEntityByPath: () => null,
        previewByPath: () => null,
        dirname: () => null,
      }}
    >
      {children}
    </FileTreePathContext.Provider>
  )
}

function makeProjectProvider(fileContents: Record<string, string>) {
  const ProjectProvider: FC<PropsWithChildren> = ({ children }) => {
    const projectSnapshot = {
      refresh: async () => {},
      getDocPaths: () => Object.keys(fileContents),
      getDocContents: (path: string) => fileContents[path] ?? null,
    } as unknown as ProjectSnapshot

    return (
      <ProjectContext.Provider
        value={{
          projectId: projectDefaults._id,
          project: projectDefaults,
          joinProject: () => {},
          updateProject: () => {},
          joinedOnce: true,
          projectSnapshot,
          tags: [],
          features: projectDefaults.features,
          name: projectDefaults.name,
        }}
      >
        {children}
      </ProjectContext.Provider>
    )
  }
  return ProjectProvider
}

describe('<PythonOutputPane />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-baseAssetPath', '/__cypress/src/')
  })

  it('executes a Python script and displays its output', function () {
    const executablePythonFileContents = "print('hello!')"
    const projectFiles = {
      [pythonExecutableScript.filename]: executablePythonFileContents,
    }
    const ProjectProvider = makeProjectProvider(projectFiles)

    cy.mount(
      <EditorProviders
        scope={{
          editor: {
            sharejs_doc: {
              doc_id: pythonExecutableScript.file_id,
              getSnapshot: () => executablePythonFileContents,
            },
            currentDocumentId: pythonExecutableScript.file_id,
            openDocName: pythonExecutableScript.filename,
          },
        }}
        providers={{ FileTreePathProvider, ProjectProvider }}
      >
        <PythonExecutionProvider>
          <PythonOutputPane />
        </PythonExecutionProvider>
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Run Python code' })
      .should('not.be.disabled')
      .click()
    cy.findByText('hello!').should('exist')
  })

  it('can import and use values from other project Python files', function () {
    const executablePythonFileContents =
      'from message import message\nprint(message)'

    const importedPythonFile = {
      filename: 'message.py',
      file_contents: "message = 'hello!'",
    }

    const projectFiles = {
      [pythonExecutableScript.filename]: executablePythonFileContents,
      [importedPythonFile.filename]: importedPythonFile.file_contents,
    }
    const ProjectProvider = makeProjectProvider(projectFiles)

    cy.mount(
      <EditorProviders
        scope={{
          editor: {
            sharejs_doc: {
              doc_id: pythonExecutableScript.file_id,
              getSnapshot: () => executablePythonFileContents,
            },
            currentDocumentId: pythonExecutableScript.file_id,
            openDocName: pythonExecutableScript.filename,
          },
        }}
        providers={{ FileTreePathProvider, ProjectProvider }}
      >
        <PythonExecutionProvider>
          <PythonOutputPane />
        </PythonExecutionProvider>
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Run Python code' })
      .should('not.be.disabled')
      .click()
    cy.findByText('hello!').should('exist')
  })

  it('can import files from different directories relative to the executable script', function () {
    const executablePythonFileContents = [
      'from scripts.data_importers.csv_importer import print_data',
      'print_data()',
    ].join('\n')

    const csvImporterFile = {
      filename: 'scripts/data_importers/csv_importer.py',
      file_contents: [
        'import csv',
        '',
        'def print_data():',
        '    with open("food_items.csv", "r") as f:',
        '        reader = csv.reader(f)',
        '        for row in reader:',
        '            print(",".join(row))',
      ].join('\n'),
    }

    const csvDataFile = {
      filename: 'food_items.csv',
      file_contents: 'name,type\nPizza,Italian\nSushi,Japanese\nTacos,Mexican',
    }

    const projectFiles = {
      'scripts/test.py': executablePythonFileContents,
      [csvImporterFile.filename]: csvImporterFile.file_contents,
      [csvDataFile.filename]: csvDataFile.file_contents,
    }
    const ProjectProvider = makeProjectProvider(projectFiles)

    const NestedFileTreePathProvider: FC<PropsWithChildren> = ({
      children,
    }) => (
      <FileTreePathContext.Provider
        value={{
          pathInFolder: () => 'scripts/test.py',
          findEntityByPath: () => null,
          previewByPath: () => null,
          dirname: () => null,
        }}
      >
        {children}
      </FileTreePathContext.Provider>
    )

    cy.mount(
      <EditorProviders
        scope={{
          editor: {
            sharejs_doc: {
              doc_id: pythonExecutableScript.file_id,
              getSnapshot: () => executablePythonFileContents,
            },
            currentDocumentId: pythonExecutableScript.file_id,
            openDocName: 'test.py',
          },
        }}
        providers={{
          FileTreePathProvider: NestedFileTreePathProvider,
          ProjectProvider,
        }}
      >
        <PythonExecutionProvider>
          <PythonOutputPane />
        </PythonExecutionProvider>
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Run Python code' })
      .should('not.be.disabled')
      .click()
    cy.findByText('name,type').should('exist')
    cy.findByText('Pizza,Italian').should('exist')
    cy.findByText('Sushi,Japanese').should('exist')
    cy.findByText('Tacos,Mexican').should('exist')
  })

  it('renders stderr output with the stderr line class', function () {
    const executablePythonFileContents = [
      'import sys',
      "print('hello!')",
      "sys.stderr.write('boom\\n')",
    ].join('\n')
    const projectFiles = {
      [pythonExecutableScript.filename]: executablePythonFileContents,
    }
    const ProjectProvider = makeProjectProvider(projectFiles)

    cy.mount(
      <EditorProviders
        scope={{
          editor: {
            sharejs_doc: {
              doc_id: pythonExecutableScript.file_id,
              getSnapshot: () => executablePythonFileContents,
            },
            currentDocumentId: pythonExecutableScript.file_id,
            openDocName: pythonExecutableScript.filename,
          },
        }}
        providers={{ FileTreePathProvider, ProjectProvider }}
      >
        <PythonExecutionProvider>
          <PythonOutputPane />
        </PythonExecutionProvider>
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Run Python code' })
      .should('not.be.disabled')
      .click()

    cy.findByText('hello!')
      .should('have.class', 'ide-redesign-python-output-pane-line-stdout')
      .and('not.have.class', 'ide-redesign-python-output-pane-line-stderr')
    cy.findByText('boom').should(
      'have.class',
      'ide-redesign-python-output-pane-line-stderr'
    )
    cy.findByText("Only Pyodide's built-in packages", { exact: false }).should(
      'not.exist'
    )
  })

  it('renders the interrupt message as an info line', function () {
    const executablePythonFileContents = 'while True:\n    pass\n'
    const projectFiles = {
      [pythonExecutableScript.filename]: executablePythonFileContents,
    }
    const ProjectProvider = makeProjectProvider(projectFiles)

    cy.mount(
      <EditorProviders
        scope={{
          editor: {
            sharejs_doc: {
              doc_id: pythonExecutableScript.file_id,
              getSnapshot: () => executablePythonFileContents,
            },
            currentDocumentId: pythonExecutableScript.file_id,
            openDocName: pythonExecutableScript.filename,
          },
        }}
        providers={{ FileTreePathProvider, ProjectProvider }}
      >
        <PythonExecutionProvider>
          <PythonOutputPane />
        </PythonExecutionProvider>
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Run Python code' })
      .should('not.be.disabled')
      .click()
    cy.findByRole('button', { name: 'Stop Python execution' })
      .should('not.be.disabled')
      .click()

    cy.findByText('Execution interrupted').should(
      'have.class',
      'ide-redesign-python-output-pane-line-info'
    )
  })

  it('can load common python data analysis packages on code execution', function () {
    const executablePythonFileContents = [
      'import tomli',
      '',
      "print(tomli.loads('greeting = \"hello from tomli\"')['greeting'])",
    ].join('\n')

    const projectFiles = {
      [pythonExecutableScript.filename]: executablePythonFileContents,
    }
    const ProjectProvider = makeProjectProvider(projectFiles)

    cy.mount(
      <EditorProviders
        scope={{
          editor: {
            sharejs_doc: {
              doc_id: pythonExecutableScript.file_id,
              getSnapshot: () => executablePythonFileContents,
            },
            currentDocumentId: pythonExecutableScript.file_id,
            openDocName: pythonExecutableScript.filename,
          },
        }}
        providers={{ FileTreePathProvider, ProjectProvider }}
      >
        <PythonExecutionProvider>
          <PythonOutputPane />
        </PythonExecutionProvider>
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Run Python code' })
      .should('not.be.disabled')
      .click()
    cy.findByText("ModuleNotFoundError: No module named 'tomli'").should(
      'not.exist'
    )
    cy.findByText('hello from tomli').should('exist')
  })

  it('auto-installs python packages imported by the executing script', function () {
    const executablePythonFileContents = [
      'import tomli',
      '',
      "print(tomli.loads('greeting = \"hello from tomli\"')['greeting'])",
    ].join('\n')

    const projectFiles = {
      [pythonExecutableScript.filename]: executablePythonFileContents,
    }
    const ProjectProvider = makeProjectProvider(projectFiles)

    cy.mount(
      <EditorProviders
        scope={{
          editor: {
            sharejs_doc: {
              doc_id: pythonExecutableScript.file_id,
              getSnapshot: () => executablePythonFileContents,
            },
            currentDocumentId: pythonExecutableScript.file_id,
            openDocName: pythonExecutableScript.filename,
          },
        }}
        providers={{ FileTreePathProvider, ProjectProvider }}
      >
        <PythonExecutionProvider>
          <PythonOutputPane />
        </PythonExecutionProvider>
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Run Python code' })
      .should('not.be.disabled')
      .click()
    cy.findByText("ModuleNotFoundError: No module named 'tomli'").should(
      'not.exist'
    )
    cy.findByText('hello from tomli').should('exist')
  })

  it('augments ModuleNotFoundError output with help text about supported Pyodide packages', function () {
    const executablePythonFileContents =
      'import this_module_does_not_exist_in_pyodide\n'
    const projectFiles = {
      [pythonExecutableScript.filename]: executablePythonFileContents,
    }
    const ProjectProvider = makeProjectProvider(projectFiles)

    cy.mount(
      <EditorProviders
        scope={{
          editor: {
            sharejs_doc: {
              doc_id: pythonExecutableScript.file_id,
              getSnapshot: () => executablePythonFileContents,
            },
            currentDocumentId: pythonExecutableScript.file_id,
            openDocName: pythonExecutableScript.filename,
          },
        }}
        providers={{ FileTreePathProvider, ProjectProvider }}
      >
        <PythonExecutionProvider>
          <PythonOutputPane />
        </PythonExecutionProvider>
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Run Python code' })
      .should('not.be.disabled')
      .click()

    cy.findByText('ModuleNotFoundError', { exact: false }).should('exist')
    cy.findByText("Only Pyodide's built-in packages", { exact: false }).should(
      'have.class',
      'ide-redesign-python-output-pane-line-stderr'
    )
  })
})
