import { expect } from 'chai'
import { render, screen } from '@testing-library/react'
import { MentionBadge } from '@/features/review-panel/components/mention-badge'
import {
  ChangesUsersContext,
  ChangesUsers,
} from '@/features/review-panel/context/changes-users-context'
import { UserId } from '@ol-types/user'

const userId = 'aabbccddeeff00112233aabb' as UserId

function renderMentionBadge(changesUsers?: ChangesUsers) {
  return render(
    <ChangesUsersContext.Provider value={changesUsers}>
      <MentionBadge userId={userId} />
    </ChangesUsersContext.Provider>
  )
}

describe('<MentionBadge />', function () {
  it('renders @Unknown when user is not in context', function () {
    renderMentionBadge(new Map())
    expect(screen.getByText('@Unknown')).to.exist
  })

  it('renders @Unknown when context is undefined', function () {
    renderMentionBadge(undefined)
    expect(screen.getByText('@Unknown')).to.exist
  })

  it('renders the display name when user is found', function () {
    const users: ChangesUsers = new Map([
      [
        userId,
        {
          id: userId,
          email: 'jane@example.com',
          first_name: 'Jane',
          last_name: 'Doe',
        },
      ],
    ])
    renderMentionBadge(users)
    expect(screen.getByText('@Jane Doe')).to.exist
  })

  it('falls back to email prefix when user has no name', function () {
    const users: ChangesUsers = new Map([
      [
        userId,
        {
          id: userId,
          email: 'jane@example.com',
        },
      ],
    ])
    renderMentionBadge(users)
    expect(screen.getByText('@jane')).to.exist
  })

  it('renders as a text mention when user is found', function () {
    const users: ChangesUsers = new Map([
      [
        userId,
        {
          id: userId,
          email: 'jane@example.com',
          first_name: 'Jane',
          last_name: 'Doe',
        },
      ],
    ])
    renderMentionBadge(users)
    const badge = screen.getByText('@Jane Doe')
    expect(badge.tagName).to.equal('SPAN')
    expect(badge.classList.contains('review-panel-mention')).to.be.true
  })
})
