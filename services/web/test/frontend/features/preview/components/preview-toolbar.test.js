import React from 'react'
import sinon from 'sinon'
import { expect } from 'chai'
import { screen, render } from '@testing-library/react'
import PreviewToolbar from '../../../../../frontend/js/features/preview/components/preview-toolbar'

describe('<PreviewToolbar />', function() {
  const onClearCache = sinon.stub()
  const onRecompile = sinon.stub()
  const onRunSyntaxCheckNow = sinon.stub()
  const onSetAutoCompile = sinon.stub()
  const onSetDraftMode = sinon.stub()
  const onSetSyntaxCheck = sinon.stub()
  const onToggleLogs = sinon.stub()

  function renderPreviewToolbar(compilerState = {}, logState = {}, showLogs) {
    render(
      <PreviewToolbar
        compilerState={{
          isAutoCompileOn: true,
          isClearingCache: false,
          isCompiling: false,
          isDraftModeOn: false,
          isSyntaxCheckOn: false,
          logEntries: {},
          ...compilerState
        }}
        logsState={{ nErrors: 0, nWarnings: 0, nLogEntries: 0, ...logState }}
        onClearCache={onClearCache}
        onRecompile={onRecompile}
        onRunSyntaxCheckNow={onRunSyntaxCheckNow}
        onSetAutoCompile={onSetAutoCompile}
        onSetDraftMode={onSetDraftMode}
        onSetSyntaxCheck={onSetSyntaxCheck}
        onToggleLogs={onToggleLogs}
        outputFiles={[]}
        pdfDownloadUrl="/download-pdf-url"
        showLogs={showLogs || false}
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
})
