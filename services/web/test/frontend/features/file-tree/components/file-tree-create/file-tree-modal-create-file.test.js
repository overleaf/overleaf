import { expect } from 'chai'
import * as sinon from 'sinon'
import { useEffect } from 'react'
import {
  screen,
  render,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react'
import fetchMock from 'fetch-mock'
import PropTypes from 'prop-types'

import { contextProps } from './context-props'
import FileTreeModalCreateFile from '../../../../../../frontend/js/features/file-tree/components/modals/file-tree-modal-create-file'
import FileTreeContext from '../../../../../../frontend/js/features/file-tree/components/file-tree-context'
import { useFileTreeActionable } from '../../../../../../frontend/js/features/file-tree/contexts/file-tree-actionable'
import { useFileTreeMutable } from '../../../../../../frontend/js/features/file-tree/contexts/file-tree-mutable'

describe('<FileTreeModalCreateFile/>', function () {
  afterEach(function () {
    fetchMock.restore()
    cleanup()
  })

  it('handles invalid file names', async function () {
    render(
      <FileTreeContext {...contextProps}>
        <OpenWithMode mode="doc" />
      </FileTreeContext>
    )

    const submitButton = screen.getByRole('button', { name: 'Create' })

    const input = screen.getByLabelText('File Name')
    expect(input.value).to.equal('name.tex')
    expect(submitButton.disabled).to.be.false
    expect(screen.queryAllByRole('alert')).to.be.empty

    fireEvent.change(input, { target: { value: '' } })
    expect(submitButton.disabled).to.be.true
    screen.getByRole(
      (role, element) =>
        role === 'alert' && element.textContent.match(/File name is empty/)
    )

    await fireEvent.change(input, { target: { value: 'test.tex' } })
    expect(submitButton.disabled).to.be.false
    expect(screen.queryAllByRole('alert')).to.be.empty

    await fireEvent.change(input, { target: { value: 'oops/i/did/it/again' } })
    expect(submitButton.disabled).to.be.true
    screen.getByRole(
      (role, element) =>
        role === 'alert' &&
        element.textContent.match(/contains invalid characters/)
    )
  })

  it('displays an error when the file limit is reached', async function () {
    const rootFolder = [
      {
        docs: Array.from({ length: 10 }, (_, index) => ({
          _id: `entity-${index}`,
        })),
        fileRefs: [],
        folders: [],
      },
    ]

    render(
      <FileTreeContext
        {...contextProps}
        rootFolder={rootFolder}
        initialSelectedEntityId="entity-1"
      >
        <OpenWithMode mode="doc" />
      </FileTreeContext>
    )

    screen.getByRole(
      (role, element) =>
        role === 'alert' &&
        element.textContent.match(/This project has reached the \d+ file limit/)
    )
  })

  it('displays a warning when the file limit is nearly reached', async function () {
    const rootFolder = [
      {
        docs: Array.from({ length: 9 }, (_, index) => ({
          _id: `entity-${index}`,
        })),
        fileRefs: [],
        folders: [],
      },
    ]

    render(
      <FileTreeContext
        {...contextProps}
        rootFolder={rootFolder}
        initialSelectedEntityId="entity-1"
      >
        <OpenWithMode mode="doc" />
      </FileTreeContext>
    )

    screen.getByText(/This project is approaching the file limit \(\d+\/\d+\)/)
  })

  it('counts files in nested folders', async function () {
    const rootFolder = [
      {
        docs: [{ _id: 'entity-1' }],
        fileRefs: [],
        folders: [
          {
            docs: [{ _id: 'entity-1-2' }],
            fileRefs: [],
            folders: [
              {
                docs: [
                  { _id: 'entity-3' },
                  { _id: 'entity-4' },
                  { _id: 'entity-5' },
                  { _id: 'entity-6' },
                  { _id: 'entity-7' },
                  { _id: 'entity-8' },
                  { _id: 'entity-9' },
                ],
                fileRefs: [],
                folders: [],
              },
            ],
          },
        ],
      },
    ]

    render(
      <FileTreeContext
        {...contextProps}
        rootFolder={rootFolder}
        initialSelectedEntityId="entity-1"
      >
        <OpenWithMode mode="doc" />
      </FileTreeContext>
    )

    screen.getByText(/This project is approaching the file limit \(\d+\/\d+\)/)
  })

  it('creates a new file when the form is submitted', async function () {
    fetchMock.post('express:/project/:projectId/doc', () => 204)

    render(
      <FileTreeContext {...contextProps}>
        <OpenWithMode mode="doc" />
      </FileTreeContext>
    )

    const input = screen.getByLabelText('File Name')
    await fireEvent.change(input, { target: { value: 'test.tex' } })

    const submitButton = screen.getByRole('button', { name: 'Create' })

    await fireEvent.click(submitButton)

    expect(
      fetchMock.called('express:/project/:projectId/doc', {
        body: { name: 'test.tex' },
      })
    ).to.be.true
  })

  it('imports a new file from a project', async function () {
    fetchMock
      .get('path:/user/projects', {
        projects: [
          {
            _id: 'test-project',
            name: 'This Project',
          },
          {
            _id: 'project-1',
            name: 'Project One',
          },
          {
            _id: 'project-2',
            name: 'Project Two',
          },
        ],
      })
      .get('express:/project/:projectId/entities', {
        entities: [
          {
            path: '/foo.tex',
          },
          {
            path: '/bar.tex',
          },
        ],
      })
      .post('express:/project/:projectId/compile', {
        status: 'success',
        outputFiles: [
          {
            build: 'test',
            path: 'baz.jpg',
          },
          {
            build: 'test',
            path: 'ball.jpg',
          },
        ],
      })
      .post('express:/project/:projectId/linked_file', () => 204)

    render(
      <FileTreeContext {...contextProps}>
        <OpenWithMode mode="project" />
      </FileTreeContext>
    )

    // initial state, no project selected
    const projectInput = screen.getByLabelText('Select a Project')
    expect(projectInput.disabled).to.be.true
    await waitFor(() => {
      expect(projectInput.disabled).to.be.false
    })

    // the submit button should be disabled
    const submitButton = screen.getByRole('button', { name: 'Create' })
    expect(submitButton.disabled).to.be.true

    // the source file selector should be disabled
    const fileInput = screen.getByLabelText('Select a File')
    expect(fileInput.disabled).to.be.true
    // TODO: check for options length, excluding current project

    // select a project
    await fireEvent.change(projectInput, { target: { value: 'project-2' } }) // TODO: getByRole('option')?

    // wait for the source file selector to be enabled
    await waitFor(() => {
      expect(fileInput.disabled).to.be.false
    })
    expect(screen.queryByLabelText('Select a File')).not.to.be.null
    expect(screen.queryByLabelText('Select an Output File')).to.be.null
    expect(submitButton.disabled).to.be.true

    // TODO: check for fileInput options length, excluding current project

    // click on the button to toggle between source and output files
    const sourceTypeButton = screen.getByRole('button', {
      name: 'select from output files',
    })
    await fireEvent.click(sourceTypeButton)

    // wait for the output file selector to be enabled
    const entityInput = screen.getByLabelText('Select an Output File')
    await waitFor(() => {
      expect(entityInput.disabled).to.be.false
    })
    expect(screen.queryByLabelText('Select a File')).to.be.null
    expect(screen.queryByLabelText('Select an Output File')).not.to.be.null
    expect(submitButton.disabled).to.be.true

    // TODO: check for entityInput options length, excluding current project
    await fireEvent.change(entityInput, { target: { value: 'ball.jpg' } }) // TODO: getByRole('option')?

    await waitFor(() => {
      expect(submitButton.disabled).to.be.false
    })
    await fireEvent.click(submitButton)

    expect(
      fetchMock.called('express:/project/:projectId/linked_file', {
        body: {
          name: 'ball.jpg',
          provider: 'project_output_file',
          data: {
            source_project_id: 'project-2',
            source_output_file_path: 'ball.jpg',
            build_id: 'test',
          },
        },
      })
    ).to.be.true
  })

  it('import from a URL when the form is submitted', async function () {
    fetchMock.post('express:/project/:projectId/linked_file', () => 204)

    render(
      <FileTreeContext {...contextProps}>
        <OpenWithMode mode="url" />
      </FileTreeContext>
    )

    const urlInput = screen.getByLabelText('URL to fetch the file from')
    const nameInput = screen.getByLabelText('File Name In This Project')

    await fireEvent.change(urlInput, {
      target: { value: 'https://example.com/example.tex' },
    })

    // check that the name has updated automatically
    expect(nameInput.value).to.equal('example.tex')

    await fireEvent.change(nameInput, {
      target: { value: 'test.tex' },
    })

    // check that the name can still be edited manually
    expect(nameInput.value).to.equal('test.tex')

    const submitButton = screen.getByRole('button', { name: 'Create' })

    await fireEvent.click(submitButton)

    expect(
      fetchMock.called('express:/project/:projectId/linked_file', {
        body: {
          name: 'test.tex',
          provider: 'url',
          data: { url: 'https://example.com/example.tex' },
        },
      })
    ).to.be.true
  })

  it('uploads a dropped file', async function () {
    const xhr = sinon.useFakeXMLHttpRequest()
    const requests = []
    xhr.onCreate = request => {
      requests.push(request)
    }

    render(
      <FileTreeContext {...contextProps}>
        <OpenWithMode mode="upload" />
      </FileTreeContext>
    )

    // the submit button should not be present
    expect(screen.queryByRole('button', { name: 'Create' })).to.be.null

    const dropzone = screen.getByLabelText('File Uploader')

    expect(dropzone).not.to.be.null

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [new File(['test'], 'test.tex', { type: 'text/plain' })],
      },
    })

    await waitFor(() => expect(requests).to.have.length(1))

    const [request] = requests
    expect(request.url).to.equal('/project/test-project/upload')
    expect(request.method).to.equal('POST')

    xhr.restore()
  })

  it('uploads a pasted file', async function () {
    const xhr = sinon.useFakeXMLHttpRequest()
    const requests = []
    xhr.onCreate = request => {
      requests.push(request)
    }

    render(
      <FileTreeContext {...contextProps}>
        <OpenWithMode mode="upload" />
      </FileTreeContext>
    )

    // the submit button should not be present
    expect(screen.queryByRole('button', { name: 'Create' })).to.be.null

    const dropzone = screen.getByLabelText('File Uploader')

    expect(dropzone).not.to.be.null

    fireEvent.paste(dropzone, {
      clipboardData: {
        files: [new File(['test'], 'test.tex', { type: 'text/plain' })],
      },
    })

    await waitFor(() => expect(requests).to.have.length(1))

    const [request] = requests
    expect(request.url).to.equal('/project/test-project/upload')
    expect(request.method).to.equal('POST')

    xhr.restore()
  })
})

function OpenWithMode({ mode }) {
  const { newFileCreateMode, startCreatingFile } = useFileTreeActionable()

  const { fileCount } = useFileTreeMutable()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => startCreatingFile(mode), [])

  if (!fileCount || !newFileCreateMode) {
    return null
  }

  return <FileTreeModalCreateFile />
}
OpenWithMode.propTypes = {
  mode: PropTypes.string.isRequired,
}
