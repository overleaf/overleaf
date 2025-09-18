import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsImageName from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-image-name'
import type { ImageName } from '../../../../../../types/project-settings'
import { EditorLeftMenuProvider } from '@/features/editor-left-menu/components/editor-left-menu-context'
import { EditorProviders } from '../../../../helpers/editor-providers'

describe('<SettingsImageName />', function () {
  const imageNames: ImageName[] = [
    {
      imageDesc: 'Image 1',
      imageName: 'img-1',
      allowed: true,
    },
    {
      imageDesc: 'Image 2',
      imageName: 'img-2',
      allowed: true,
    },
  ]

  beforeEach(function () {
    window.metaAttributesCache.set('ol-imageNames', imageNames)
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
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

    for (const { imageName, imageDesc } of imageNames) {
      const option = within(select).getByText(imageDesc)
      expect(option.getAttribute('value')).to.equal(imageName)
    }
  })
})
