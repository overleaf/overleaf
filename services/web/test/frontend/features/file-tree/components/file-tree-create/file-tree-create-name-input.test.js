import { expect } from 'chai'
import { screen, render, waitFor, cleanup } from '@testing-library/react'
import sinon from 'sinon'

import { contextProps } from './context-props'

import FileTreeCreateNameInput from '../../../../../../frontend/js/features/file-tree/components/file-tree-create/file-tree-create-name-input'
import FileTreeContext from '../../../../../../frontend/js/features/file-tree/components/file-tree-context'
import FileTreeCreateNameProvider from '../../../../../../frontend/js/features/file-tree/contexts/file-tree-create-name'

describe('<FileTreeCreateNameInput/>', function () {
  const sandbox = sinon.createSandbox()

  beforeEach(function () {
    sandbox.spy(window, 'requestAnimationFrame')
  })

  afterEach(function () {
    sandbox.restore()
    cleanup()
  })

  it('renders an empty input', async function () {
    render(
      <FileTreeContext {...contextProps}>
        <FileTreeCreateNameProvider>
          <FileTreeCreateNameInput />
        </FileTreeCreateNameProvider>
      </FileTreeContext>
    )

    await screen.getByLabelText('File Name')
    await screen.getByPlaceholderText('File Name')
  })

  it('renders a custom label and placeholder', async function () {
    render(
      <FileTreeContext {...contextProps}>
        <FileTreeCreateNameProvider>
          <FileTreeCreateNameInput
            label="File name in this project"
            placeholder="Enter a file name…"
          />
        </FileTreeCreateNameProvider>
      </FileTreeContext>
    )

    await screen.getByLabelText('File name in this project')
    await screen.getByPlaceholderText('Enter a file name…')
  })

  it('uses an initial name', async function () {
    render(
      <FileTreeContext {...contextProps}>
        <FileTreeCreateNameProvider initialName="test.tex">
          <FileTreeCreateNameInput />
        </FileTreeCreateNameProvider>
      </FileTreeContext>
    )

    const input = await screen.getByLabelText('File Name')
    expect(input.value).to.equal('test.tex')
  })

  it('focuses the name', async function () {
    render(
      <FileTreeContext {...contextProps}>
        <FileTreeCreateNameProvider initialName="test.tex">
          <FileTreeCreateNameInput focusName />
        </FileTreeCreateNameProvider>
      </FileTreeContext>
    )

    const input = await screen.getByLabelText('File Name')
    expect(input.value).to.equal('test.tex')

    await waitFor(
      () => expect(window.requestAnimationFrame).to.have.been.calledOnce
    )

    // https://github.com/jsdom/jsdom/issues/2995
    // "window.getSelection doesn't work with selection of <input> element"
    // const selection = window.getSelection().toString()
    // expect(selection).to.equal('test')

    // wait for the selection to update
    await new Promise(resolve => window.setTimeout(resolve, 100))

    expect(input.selectionStart).to.equal(0)
    expect(input.selectionEnd).to.equal(4)
  })
})
