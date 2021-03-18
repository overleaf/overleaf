import React from 'react'
import sinon from 'sinon'
import { expect } from 'chai'
import { screen, render, fireEvent } from '@testing-library/react'
import PreviewToolbar from '../../../../../frontend/js/features/preview/components/preview-toolbar'

describe('<PreviewToolbar />', function() {
  const onRecompile = sinon.stub()
  const onRecompileFromScratch = sinon.stub()
  const onRunSyntaxCheckNow = sinon.stub()
  const onSetAutoCompile = sinon.stub()
  const onSetDraftMode = sinon.stub()
  const onSetSyntaxCheck = sinon.stub()
  const onToggleLogs = sinon.stub()
  const onSetSplitLayout = sinon.stub()
  const onSetFullLayout = sinon.stub()
  const onStopCompilation = sinon.stub()

  function renderPreviewToolbar(
    compilerState = {},
    logState = {},
    showLogs = false,
    splitLayout = true
  ) {
    render(
      <PreviewToolbar
        compilerState={{
          autoCompileHasChanges: true,
          isAutoCompileOn: true,
          isClearingCache: false,
          isCompiling: false,
          isDraftModeOn: false,
          isSyntaxCheckOn: false,
          logEntries: {},
          ...compilerState
        }}
        logsState={{ nErrors: 0, nWarnings: 0, ...logState }}
        onRecompile={onRecompile}
        onRecompileFromScratch={onRecompileFromScratch}
        onRunSyntaxCheckNow={onRunSyntaxCheckNow}
        onSetAutoCompile={onSetAutoCompile}
        onSetDraftMode={onSetDraftMode}
        onSetSyntaxCheck={onSetSyntaxCheck}
        onToggleLogs={onToggleLogs}
        outputFiles={[]}
        pdfDownloadUrl="/download-pdf-url"
        showLogs={showLogs}
        splitLayout={splitLayout}
        onSetSplitLayout={onSetSplitLayout}
        onSetFullLayout={onSetFullLayout}
        onStopCompilation={onStopCompilation}
      />
    )
  }

  it('renders the toolbar', function() {
    renderPreviewToolbar()
    screen.getByText('Recompile')
    screen.getByText('Download PDF')
    screen.getByText('View logs')
  })

  it('all toolbar items have "toolbar-item" class and text has "toolbar-text"', function() {
    renderPreviewToolbar()
    const toolbar = screen.getByTestId('toolbar-preview')
    for (const toolbarSection of toolbar.children) {
      for (const toolbarItem of toolbarSection.children) {
        expect(toolbarItem.className).to.contain('toolbar-item')
        for (const parts of toolbarItem.children) {
          for (const part of parts.children) {
            if (part.nodeName !== 'LI' && part.textContent) {
              expect(part.className).to.contain('toolbar-text')
            }
          }
        }
      }
    }
  })

  it('renders a full-screen button with a tooltip when when in split-screen mode', function() {
    renderPreviewToolbar()
    const btn = screen.getByLabelText('Full screen')
    fireEvent.click(btn)
    expect(onSetFullLayout).to.have.been.calledOnce
    fireEvent.mouseOver(btn)
    screen.getByRole('tooltip', { name: 'Full screen' })
  })

  it('renders a split-screen button with a tooltip when when in full-screen mode', function() {
    renderPreviewToolbar({}, {}, false, false)
    const btn = screen.getByLabelText('Split screen')
    fireEvent.click(btn)
    expect(onSetSplitLayout).to.have.been.calledOnce
    fireEvent.mouseOver(btn)
    screen.getByRole('tooltip', { name: 'Split screen' })
  })
})
