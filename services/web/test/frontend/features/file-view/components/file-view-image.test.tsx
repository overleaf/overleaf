import { screen } from '@testing-library/react'

import { renderWithEditorContext } from '../../../helpers/render-with-context'
import FileViewImage from '../../../../../frontend/js/features/file-view/components/file-view-image'
import { imageFile } from '../util/files'

describe('<FileViewImage />', function () {
  it('renders an image', function () {
    renderWithEditorContext(
      <FileViewImage file={imageFile} onError={() => {}} onLoad={() => {}} />
    )
    screen.getByRole('img')
  })
})
