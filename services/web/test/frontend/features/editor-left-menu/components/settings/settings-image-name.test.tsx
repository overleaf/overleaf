import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsImageName from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-image-name'
import type { AllowedImageName } from '../../../../../../types/project-settings'
import { EditorLeftMenuProvider } from '@/features/editor-left-menu/components/editor-left-menu-context'
import { EditorProviders } from '../../../../helpers/editor-providers'

describe('<SettingsImageName />', function () {
  const allowedImageNames: AllowedImageName[] = [
    {
      imageDesc: 'Image 1',
      imageName: 'img-1',
    },
    {
      imageDesc: 'Image 2',
      imageName: 'img-2',
    },
  ]

  beforeEach(function () {
    window.metaAttributesCache.set('ol-allowedImageNames', allowedImageNames)
  })

  afterEach(function () {
    fetchMock.reset()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <EditorLeftMenuProvider>
          <SettingsImageName />
        </EditorLeftMenuProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('TeX Live version')

    for (const { imageName, imageDesc } of allowedImageNames) {
      const option = within(select).getByText(imageDesc)
      expect(option.getAttribute('value')).to.equal(imageName)
    }
  })
})
