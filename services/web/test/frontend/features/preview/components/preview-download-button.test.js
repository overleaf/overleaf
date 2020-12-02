import React from 'react'
import { expect } from 'chai'
import { screen, render } from '@testing-library/react'

import PreviewDownloadButton from '../../../../../frontend/js/features/preview/components/preview-download-button'

describe('<PreviewDownloadButton />', function() {
  const projectId = 'projectId123'
  const pdfDownloadUrl = `/download/project/${projectId}/build/17523aaafdf-1ad9063af140f004/output/output.pdf?compileGroup=priority&popupDownload=true`

  function renderPreviewDownloadButton(
    isCompiling,
    outputFiles,
    pdfDownloadUrl,
    showText
  ) {
    if (isCompiling === undefined) isCompiling = false
    if (showText === undefined) showText = true
    render(
      <PreviewDownloadButton
        isCompiling={isCompiling}
        outputFiles={outputFiles || []}
        pdfDownloadUrl={pdfDownloadUrl}
        showText={showText}
      />
    )
  }

  it('should disable the button and dropdown toggle when compiling', function() {
    const isCompiling = true
    const outputFiles = undefined

    renderPreviewDownloadButton(isCompiling, outputFiles)

    expect(
      screen
        .getByText('Download PDF')
        .closest('a')
        .getAttribute('disabled')
    ).to.exist
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).to.equal(1) // the dropdown toggle
    expect(buttons[0].getAttribute('disabled')).to.exist
    expect(buttons[0].getAttribute('aria-label')).to.equal(
      'Toggle output files list'
    )
  })
  it('should disable the PDF button when there is no PDF', function() {
    const isCompiling = false
    const outputFiles = []
    renderPreviewDownloadButton(isCompiling, outputFiles)
    expect(
      screen
        .getByText('Download PDF')
        .closest('a')
        .getAttribute('disabled')
    ).to.exist
  })
  it('should enable the PDF button when there is a main PDF', function() {
    const isCompiling = false
    const outputFiles = []
    renderPreviewDownloadButton(isCompiling, outputFiles, pdfDownloadUrl)
    expect(
      screen
        .getByText('Download PDF')
        .closest('a')
        .getAttribute('href')
    ).to.equal(pdfDownloadUrl)
    expect(
      screen
        .getByText('Download PDF')
        .closest('a')
        .getAttribute('disabled')
    ).to.not.exist
  })
  it('should enable the dropdown when not compiling', function() {
    const isCompiling = false
    const outputFiles = []
    renderPreviewDownloadButton(isCompiling, outputFiles, pdfDownloadUrl)
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).to.exist
    expect(buttons[0].getAttribute('disabled')).to.not.exist
  })

  it('should show the button text when prop showText=true', function() {
    const isCompiling = false
    const showText = true
    renderPreviewDownloadButton(isCompiling, [], pdfDownloadUrl, showText)
    expect(screen.getByText('Download PDF').getAttribute('style')).to.be.null
  })
  it('should not show the button text when prop showText=false', function() {
    const isCompiling = false
    const showText = false
    renderPreviewDownloadButton(isCompiling, [], pdfDownloadUrl, showText)
    expect(screen.getByText('Download PDF').getAttribute('style')).to.equal(
      'position: absolute; right: -100vw;'
    )
  })
})
