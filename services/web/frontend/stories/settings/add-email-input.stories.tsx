import useFetchMock from './../hooks/use-fetch-mock'
import { AddEmailInput } from '../../js/features/settings/components/emails/add-email-input'

export const EmailInput = args => {
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
      <AddEmailInput {...args} />
      <br />
      <div>
        Use <code>autocomplete.edu</code> as domain to trigger an autocomplete
      </div>
    </>
  )
}

export default {
  title: 'Account Settings / Emails and Affiliations',
  component: AddEmailInput,
  argTypes: {
    onChange: { action: 'change' },
  },
}
