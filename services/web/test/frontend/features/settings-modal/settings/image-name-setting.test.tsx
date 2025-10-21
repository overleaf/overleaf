import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import type { ImageName } from '../../../../../types/project-settings'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import { EditorProviders } from '../../../helpers/editor-providers'
import ImageNameSetting from '@/features/ide-redesign/components/settings/compiler-settings/image-name-setting'

describe('<ImageNameSetting />', function () {
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
        <SettingsModalProvider>
          <ImageNameSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('TeX Live version')

    for (const { imageName, imageDesc } of imageNames) {
      const option = within(select).getByText(imageDesc)
      expect(option.getAttribute('value')).to.equal(imageName)
    }
  })
})
