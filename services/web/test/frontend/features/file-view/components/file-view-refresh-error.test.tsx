import { render, screen } from '@testing-library/react'
import FileViewRefreshError from '@/features/file-view/components/file-view-refresh-error'
import { imageFile } from '../util/files'

describe('<FileViewRefreshError />', function () {
  it('shows correct error message', function () {
    render(
      <FileViewRefreshError file={imageFile} refreshError="An error message" />
    )

    screen.getByText('Access Denied: An error message')
  })
})
