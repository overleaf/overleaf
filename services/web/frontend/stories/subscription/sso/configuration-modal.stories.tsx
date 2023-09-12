import useFetchMock from '../../hooks/use-fetch-mock'
import { useMeta } from '../../hooks/use-meta'
import SSOConfigurationModal, {
  SSOConfigurationModalProps,
} from '../../../../modules/managed-users/frontend/js/components/modals/sso-configuration-modal'

const config = {
  entryPoint: 'http://idp.example.com/entry_point',
  certificate:
    'MIIDXTCCAkWgAwIBAgIJAOvOeQ4xFTzsMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNVBAYTAkdCMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwHhcNMTYxMTE1MTQxMjU5WhcNMjYxMTE1MTQxMjU5WjBFMQswCQYDVQQGEwJHQjETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxCT6MBe5G9VoLU8MfztOEbUhnwLp17ak8eFUqxqeXkkqtWB0b/cmIBU3xoQoO3dIF8PBzfqehqfYVhrNt/TFgcmDfmJnPJRL1RJWMW3VmiP5odJ3LwlkKbZpkeT3wZ8HEJIR1+zbpxiBNkbd2GbdR1iumcsHzMYX1A2CBj+ZMV5VijC+K4P0e9c05VsDEUtLmfeAasJAiumQoVVgAe/BpiXjICGGewa6EPFI7mKkifIRKOGxdRESwZZjxP30bI31oDN0cgKqIgSJtJ9nfCn9jgBMBkQHu42WMuaWD4jrGd7+vYdX+oIfArs9aKgAH5kUGhGdew2R9SpBefrhbNxG8QIDAQABo1AwTjAdBgNVHQ4EFgQU+aSojSyyLChP/IpZcafvSdhj7KkwHwYDVR0jBBgwFoAU+aSojSyyLChP/IpZcafvSdhj7KkwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEABl3+OOVLBWMKs6PjA8lPuloWDNzSr3v76oUcHqAb+cfbucjXrOVsS9RJ0X9yxvCQyfM9FfY43DbspnN3izYhdvbJD8kKLNf0LA5st+ZxLfy0ACyL2iyAwICaqndqxAjQYplFAHmpUiu1DiHckyBPekokDJd+ze95urHMOsaGS5RWPoKJVE0bkaAeZCmEu0NNpXRSBiuxXSTeSAJfv6kyE/rkdhzUKyUl/cGQFrsVYfAFQVA+W6CKOh74ErSEzSHQQYndl7nD33snD/YqdU1ROxV6aJzLKCg+sdj+wRXSP2u/UHnM4jW9TGJfhO42jzL6WVuEvr9q4l7zWzUQKKKhtQ==',
  signatureAlgorithm: 'sha256',
  userIdAttribute: 'email',
}

export const ConfigurationModalLoadingError = (
  args: SSOConfigurationModalProps
) => {
  useMeta({ 'ol-groupId': '123' })
  useFetchMock(fetchMock => {
    fetchMock.get(
      'express:/manage/groups/:id/settings/sso',
      { status: 500 },
      {
        delay: 1000,
      }
    )
    fetchMock.post('express:/manage/groups/:id/settings/sso', 200, {
      delay: 500,
    })
  })
  return <SSOConfigurationModal {...args} />
}

export const ConfigurationModal = (args: SSOConfigurationModalProps) => {
  useMeta({ 'ol-groupId': '123' })
  useFetchMock(fetchMock => {
    fetchMock.get('express:/manage/groups/:id/settings/sso', config, {
      delay: 500,
    })
    fetchMock.post('express:/manage/groups/:id/settings/sso', 200, {
      delay: 500,
    })
  })
  return <SSOConfigurationModal {...args} />
}

export const ConfigurationModalEmpty = (args: SSOConfigurationModalProps) => {
  useMeta({ 'ol-groupId': '123' })
  useFetchMock(fetchMock => {
    fetchMock.get(
      'express:/manage/groups/:id/settings/sso',
      {},
      {
        delay: 500,
      }
    )
    fetchMock.post('express:/manage/groups/:id/settings/sso', 200, {
      delay: 500,
    })
  })
  return <SSOConfigurationModal {...args} />
}

export const ConfigurationModalSaveError = (
  args: SSOConfigurationModalProps
) => {
  useMeta({ 'ol-groupId': '123' })
  useFetchMock(fetchMock => {
    fetchMock.get('express:/manage/groups/:id/settings/sso', config, {
      delay: 500,
    })
    fetchMock.post('express:/manage/groups/:id/settings/sso', 500, {
      delay: 1000,
    })
  })
  return <SSOConfigurationModal {...args} />
}

export default {
  title: 'Subscription / SSO',
  component: SSOConfigurationModal,
  args: {
    show: true,
  },
  argTypes: {
    handleHide: { action: 'close modal' },
  },
}
