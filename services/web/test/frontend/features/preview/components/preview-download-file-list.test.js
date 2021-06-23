import { expect } from 'chai'
import { screen, render } from '@testing-library/react'

import PreviewDownloadFileList, {
  topFileTypes,
} from '../../../../../frontend/js/features/preview/components/preview-download-file-list'

describe('<PreviewDownloadFileList />', function () {
  const projectId = 'projectId123'

  function makeFile(fileName, main) {
    return {
      fileName,
      url: `/project/${projectId}/output/${fileName}`,
      type: fileName.split('.').pop(),
      main: main || false,
    }
  }

  it('should list all output files and group them', function () {
    const outputFiles = [
      makeFile('output.ind'),
      makeFile('output.log'),
      makeFile('output.pdf', true),
      makeFile('alt.pdf'),
      makeFile('output.stderr'),
      makeFile('output.stdout'),
      makeFile('output.aux'),
      makeFile('output.bbl'),
      makeFile('output.blg'),
    ]

    render(<PreviewDownloadFileList fileList={outputFiles} />)

    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems.length).to.equal(outputFiles.length - 1) // main PDF is listed separately

    const fileTypes = outputFiles.map(file => {
      return file.type
    })
    menuItems.forEach((item, index) => {
      // check displayed text
      const fileType = item.textContent.split('.').pop()
      expect(fileTypes).to.include(fileType)
    })

    // check grouped correctly
    expect(topFileTypes).to.exist
    expect(topFileTypes.length).to.be.above(0)
    const outputTopFileTypes = outputFiles
      .filter(file => {
        return topFileTypes.includes(file.type)
      })
      .map(file => file.type)
    const topMenuItems = menuItems.slice(0, outputTopFileTypes.length)
    topMenuItems.forEach(item => {
      const fileType = item.textContent.split('.').pop().replace(' file', '')
      expect(topFileTypes.includes(fileType)).to.be.true
    })
  })

  it('should list all files when there are duplicate types', function () {
    const pdfFile = makeFile('output.pdf', true)
    const bblFile = makeFile('output.bbl')
    const outputFiles = [Object.assign({}, { ...bblFile }), bblFile, pdfFile]

    render(<PreviewDownloadFileList fileList={outputFiles} />)

    const bblMenuItems = screen.getAllByText((content, element) => {
      return content !== '' && element.textContent === 'output.bbl'
    })
    expect(bblMenuItems.length).to.equal(2)
  })

  it('should list the non-main PDF in the dropdown', function () {
    const pdfFile = makeFile('output.pdf', true)
    const pdfAltFile = makeFile('alt.pdf')
    const outputFiles = [pdfFile, pdfAltFile]
    render(<PreviewDownloadFileList fileList={outputFiles} />)
    screen.getAllByRole('menuitem', { name: 'alt.pdf' })
  })

  describe('list divider and header', function () {
    it('should display when there are top files and other files', function () {
      const outputFiles = [
        makeFile('output.bbl'),
        makeFile('output.ind'),
        makeFile('output.gls'),
        makeFile('output.log'),
      ]

      render(<PreviewDownloadFileList fileList={outputFiles} />)

      screen.getByText('Download other output files')
      screen.getByRole('separator')
    })

    it('should not display when there are top files and no other files', function () {
      const outputFiles = [
        makeFile('output.bbl'),
        makeFile('output.ind'),
        makeFile('output.gls'),
      ]

      render(<PreviewDownloadFileList fileList={outputFiles} />)

      expect(screen.queryByText('Other output files')).to.not.exist
      expect(screen.queryByRole('separator')).to.not.exist
    })

    it('should not display when there are other files and no top files', function () {
      const outputFiles = [makeFile('output.log')]

      render(<PreviewDownloadFileList fileList={outputFiles} />)

      expect(screen.queryByText('Other output files')).to.not.exist
      expect(screen.queryByRole('separator')).to.not.exist
    })
  })
})
