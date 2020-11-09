import React from 'react'
import { expect } from 'chai'
import { screen, render } from '@testing-library/react'

import PreviewDownloadButton, {
  topFileTypes
} from '../../../../../frontend/js/features/preview/components/preview-download-button'

describe('<PreviewDownloadButton />', function() {
  const projectId = 'projectId123'
  const pdfDownloadUrl = `/download/project/${projectId}/build/17523aaafdf-1ad9063af140f004/output/output.pdf?compileGroup=priority&popupDownload=true`

  function makeFile(fileName, main) {
    return {
      fileName,
      url: `/project/${projectId}/output/${fileName}`,
      type: fileName.split('.').pop(),
      main: main || false
    }
  }

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
  it('should list all output files and group them', function() {
    const isCompiling = false
    const outputFiles = [
      makeFile('output.ind'),
      makeFile('output.log'),
      makeFile('output.pdf', true),
      makeFile('alt.pdf'),
      makeFile('output.stderr'),
      makeFile('output.stdout'),
      makeFile('output.aux'),
      makeFile('output.bbl'),
      makeFile('output.blg')
    ]

    renderPreviewDownloadButton(isCompiling, outputFiles, pdfDownloadUrl)

    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems.length).to.equal(outputFiles.length - 1) // main PDF is listed separately

    const fileTypes = outputFiles.map(file => {
      return file.type
    })
    menuItems.forEach((item, index) => {
      // check displayed text
      const itemTextParts = item.textContent.split(' ')
      expect(itemTextParts[0]).to.equal('Download')
      const fileType = itemTextParts[1].split('.').pop()
      expect(fileTypes).to.include(fileType)
      expect(itemTextParts[2]).to.equal('file')
    })

    // check grouped correctly
    expect(topFileTypes).to.exist
    expect(topFileTypes.length).to.be.above(0)
    const outputTopFileTypes = outputFiles
      .filter(file => {
        if (topFileTypes.includes(file.type)) return file.type
      })
      .map(file => file.type)
    const topMenuItems = menuItems.slice(0, outputTopFileTypes.length)
    topMenuItems.forEach(item => {
      const fileType = item.textContent
        .split('.')
        .pop()
        .replace(' file', '')
      expect(topFileTypes.includes(fileType)).to.be.true
    })
  })
  it('should list all files when there are duplicate types', function() {
    const isCompiling = false
    const pdfFile = makeFile('output.pdf', true)
    const bblFile = makeFile('output.bbl')
    const outputFiles = [Object.assign({}, { ...bblFile }), bblFile, pdfFile]

    renderPreviewDownloadButton(isCompiling, outputFiles, pdfDownloadUrl)

    const bblMenuItems = screen.getAllByText((content, element) => {
      return (
        content !== '' && element.textContent === 'Download output.bbl file'
      )
    })
    expect(bblMenuItems.length).to.equal(2)
  })
  it('should list the non-main PDF in the dropdown', function() {
    const isCompiling = false
    const pdfFile = makeFile('output.pdf', true)
    const pdfAltFile = makeFile('alt.pdf')
    const outputFiles = [pdfFile, pdfAltFile]
    renderPreviewDownloadButton(isCompiling, outputFiles, pdfDownloadUrl)
    screen.getAllByRole('menuitem', { name: 'Download alt.pdf file' })
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
  describe('list divider and header', function() {
    it('should display when there are top files and other files', function() {
      const outputFiles = [
        makeFile('output.bbl'),
        makeFile('output.ind'),
        makeFile('output.gls'),
        makeFile('output.log')
      ]

      renderPreviewDownloadButton(false, outputFiles, pdfDownloadUrl, true)

      screen.getByText('Other output files')
      screen.getByRole('separator')
    })
    it('should not display when there are top files and no other files', function() {
      const outputFiles = [
        makeFile('output.bbl'),
        makeFile('output.ind'),
        makeFile('output.gls')
      ]

      renderPreviewDownloadButton(false, outputFiles, pdfDownloadUrl, true)

      expect(screen.queryByText('Other output files')).to.not.exist
      expect(screen.queryByRole('separator')).to.not.exist
    })
    it('should not display when there are other files and no top files', function() {
      const outputFiles = [makeFile('output.log')]

      renderPreviewDownloadButton(false, outputFiles, pdfDownloadUrl, true)

      expect(screen.queryByText('Other output files')).to.not.exist
      expect(screen.queryByRole('separator')).to.not.exist
    })
  })
})
