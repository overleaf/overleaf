import { render, screen } from '@testing-library/react'
import { ReactElement } from 'react'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import UnlinkUserModal from '@/features/group-management/components/members-table/unlink-user-modal'
import { GroupMembersProvider } from '@/features/group-management/context/group-members-context'

export function renderWithContext(component: ReactElement, props = {}) {
  const GroupMembersProviderWrapper = ({
    children,
  }: {
    children: ReactElement
  }) => <GroupMembersProvider {...props}>{children}</GroupMembersProvider>

  return render(component, { wrapper: GroupMembersProviderWrapper })
}

describe('<UnlinkUserModal />', function () {
  let defaultProps: any

  beforeEach(function () {
    defaultProps = {
      onClose: sinon.stub(),
      user: {},
      setGroupUserAlert: sinon.stub(),
    }
  })

  afterEach(function () {
    fetchMock.reset()
  })

  it('displays the modal', async function () {
    renderWithContext(<UnlinkUserModal {...defaultProps} />)
    await screen.findByRole('heading', {
      name: 'Unlink user',
    })
  })
})
