import React from 'react'
import { render, screen } from '@testing-library/react'

import BinaryFileImage from '../../../../../frontend/js/features/binary-file/components/binary-file-image.js'

describe('<BinaryFileImage />', function () {
  const file = {
    id: '60097ca20454610027c442a8',
    name: 'file.jpg',
    linkedFileData: {
      source_entity_path: '/source-entity-path',
      provider: 'project_file',
    },
  }

  it('renders an image', function () {
    render(
      <BinaryFileImage
        fileName={file.name}
        fileId={file.id}
        onError={() => {}}
        onLoad={() => {}}
      />
    )
    screen.getByRole('img')
  })
})
