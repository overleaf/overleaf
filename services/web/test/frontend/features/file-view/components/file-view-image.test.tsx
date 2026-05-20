import { expect } from 'chai'
import { screen, waitFor } from '@testing-library/react'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'

import { renderWithEditorContext } from '../../../helpers/render-with-context'
import FileViewImage from '../../../../../frontend/js/features/file-view/components/file-view-image'
import { imageFile } from '../util/files'
import type { BinaryFile } from '@/features/file-view/types/binary-file'

const svgFile: BinaryFile<'project_file'> = {
  ...imageFile,
  name: 'diagram.svg',
}

const svgContent =
  '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>'

describe('<FileViewImage />', function () {
  beforeEach(function () {
    URL.createObjectURL = sinon.stub().returns('blob:fake-url')
    URL.revokeObjectURL = sinon.stub()
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('renders a non-SVG img', function () {
    renderWithEditorContext(
      <FileViewImage file={imageFile} onError={() => {}} onLoad={() => {}} />
    )
    screen.getByRole('img')
  })

  it('fetches and renders SVG in an img tag via blob URL', async function () {
    fetchMock.get('express:/project/:project_id/blob/:hash', svgContent)

    renderWithEditorContext(
      <FileViewImage file={svgFile} onError={() => {}} onLoad={() => {}} />
    )

    await waitFor(() => {
      const img = screen.getByRole('img')
      expect(img.getAttribute('src')).to.equal('blob:fake-url')
    })
    const createObjectURLStub = URL.createObjectURL as sinon.SinonStub
    expect(createObjectURLStub.calledOnce).to.be.true
    const blob = createObjectURLStub.firstCall.args[0]
    expect(blob).to.be.instanceOf(Blob)
    expect(blob.type).to.equal('image/svg+xml')
  })

  it('calls onError when SVG fetch fails', async function () {
    fetchMock.get('express:/project/:project_id/blob/:hash', {
      throws: new Error('Network error'),
    })
    const onError = sinon.stub()

    renderWithEditorContext(
      <FileViewImage file={svgFile} onLoad={() => {}} onError={onError} />
    )

    await waitFor(() => {
      sinon.assert.calledOnce(onError)
    })

    expect(screen.queryByRole('img')).to.not.exist
  })
})
