import { render, screen } from '@testing-library/react'
import FileViewRefreshError from '@/features/file-view/components/file-view-refresh-error'
import type { BinaryFile } from '@/features/file-view/types/binary-file'

describe('<FileViewRefreshError />', function () {
  it('shows correct error message', function () {
    const anotherProjectFile: BinaryFile<'project_file'> = {
      id: '123abc',
      _id: '123abc',
      linkedFileData: {
        provider: 'project_file',
        source_project_id: 'some-id',
        source_entity_path: '/path/',
      },
      created: new Date(2023, 1, 17, 3, 24),
      name: 'frog.jpg',
      type: 'file',
      selected: true,
      hash: '42',
    }

    render(
      <FileViewRefreshError
        file={anotherProjectFile}
        refreshError="An error message"
      />
    )

    screen.getByText('Access Denied: An error message')
  })
})
