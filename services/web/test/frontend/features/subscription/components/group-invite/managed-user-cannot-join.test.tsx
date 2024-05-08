import { render, screen } from '@testing-library/react'
import ManagedUserCannotJoin from '../../../../../../frontend/js/features/subscription/components/group-invite/managed-user-cannot-join'

describe('ManagedUserCannotJoin', function () {
  beforeEach(function () {
    window.metaAttributesCache.set(
      'ol-currentManagedUserAdminEmail',
      'example@overleaf.com'
    )
    window.metaAttributesCache.set('ol-cannot-join-subscription', true)
  })

  it('renders the component', async function () {
    render(<ManagedUserCannotJoin />)
    await screen.findByText(
      'Your Overleaf account is managed by your current group admin (example@overleaf.com). This means you can’t join additional group subscriptions',
      { exact: false }
    )
    screen.getByRole('link', { name: 'Read more about Managed Users.' })
  })
})
