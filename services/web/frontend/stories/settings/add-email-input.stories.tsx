import useFetchMock from './../hooks/use-fetch-mock'
import Input from '../../js/features/settings/components/emails/add-email/input'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'

export const EmailInput = (args: any) => {
  useFetchMock(fetchMock =>
    fetchMock.get(/\/institutions\/domains/, [
      {
        hostname: 'autocomplete.edu',
        university: { id: 123, name: 'Auto Complete University' },
      },
    ])
  )
  return (
    <>
      <Input {...args} />
      <br />
      <div>
        Use <code>autocomplete.edu</code> as domain to trigger an autocomplete
      </div>
    </>
  )
}

export default {
  title: 'Account Settings / Emails and Affiliations',
  component: Input,
  argTypes: {
    onChange: { action: 'change' },
    ...bsVersionDecorator.argTypes,
  },
}
