import useFetchMock from '../hooks/use-fetch-mock'
import PasswordSection from '../../js/features/settings/components/password-section'
import { setDefaultMeta, defaultSetupMocks } from './helpers/password'
import getMeta from '@/utils/meta'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'

export const Success = args => {
  setDefaultMeta()
  useFetchMock(defaultSetupMocks)

  return <PasswordSection {...args} />
}

export const ManagedExternally = args => {
  setDefaultMeta()
  Object.assign(getMeta('ol-ExposedSettings'), {
    isOverleaf: false,
  })
  window.metaAttributesCache.set('ol-isExternalAuthenticationSystemUsed', true)
  useFetchMock(defaultSetupMocks)

  return <PasswordSection {...args} />
}

export const NoExistingPassword = args => {
  setDefaultMeta()
  window.metaAttributesCache.set('ol-hasPassword', false)
  useFetchMock(defaultSetupMocks)

  return <PasswordSection {...args} />
}

export const Error = args => {
  setDefaultMeta()
  useFetchMock(fetchMock =>
    fetchMock.post(/\/user\/password\/update/, {
      status: 400,
      body: {
        message: 'Your old password is wrong',
      },
    })
  )

  return <PasswordSection {...args} />
}

export default {
  title: 'Account Settings / Password',
  component: PasswordSection,
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
