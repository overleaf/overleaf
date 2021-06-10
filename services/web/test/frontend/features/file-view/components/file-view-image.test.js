import React from 'react'
import { screen } from '@testing-library/react'

import { renderWithEditorContext } from '../../../helpers/render-with-context'
import FileViewImage from '../../../../../frontend/js/features/file-view/components/file-view-image.js'

describe('<FileViewImage />', function () {
  const file = {
    id: '60097ca20454610027c442a8',
    name: 'file.jpg',
    linkedFileData: {
      source_entity_path: '/source-entity-path',
      provider: 'project_file',
    },
  }

  it('renders an image', function () {
    renderWithEditorContext(
      <FileViewImage
        fileName={file.name}
        fileId={file.id}
        onError={() => {}}
        onLoad={() => {}}
      />
    )
    screen.getByRole('img')
  })
})
