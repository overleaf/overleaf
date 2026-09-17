import { expect } from 'chai'
import { render, screen } from '@testing-library/react'
import { ReviewPanelMessage } from '@/features/review-panel/components/review-panel-message'
import { UserContext } from '@/shared/context/user-context'
import { PermissionsContext } from '@/features/ide-react/context/permissions-context'
import { User, UserId } from '@ol-types/user'
import {
  CommentId,
  ReviewPanelCommentThreadMessage,
  ReviewPanelUser,
} from '@ol-types/review-panel/review-panel'
import { formatTimeBasedOnYear } from '@/features/utils/format-date'

const userId = 'aabbccddeeff00112233aabb' as UserId

const currentUser: User = {
  id: userId,
  email: 'jane@example.com',
  first_name: 'Jane',
}

const messageUser: ReviewPanelUser = {
  avatar_text: 'J',
  email: 'jane@example.com',
  hue: 180,
  id: userId,
  isSelf: true,
  name: 'Jane',
}

const permissions = {
  read: true,
  comment: false,
  resolveOwnComments: false,
  resolveAllComments: false,
  trackedWrite: false,
  write: false,
  admin: false,
  labelVersion: false,
}

function renderMessage(message: ReviewPanelCommentThreadMessage) {
  return render(
    <UserContext.Provider value={currentUser}>
      <PermissionsContext.Provider value={permissions}>
        <ReviewPanelMessage
          message={message}
          hasReplies={false}
          isReply={false}
          isThreadResolved={false}
        />
      </PermissionsContext.Provider>
    </UserContext.Provider>
  )
}

describe('<ReviewPanelMessage />', function () {
  it('uses edited_at for the header time after a comment is edited', function () {
    const originalTimestamp = new Date('2020-03-15T10:00:00.000Z')
    const editedAt = new Date('2024-11-20T16:45:00.000Z')

    const message: ReviewPanelCommentThreadMessage = {
      content: 'updated comment text',
      id: 'comment-1' as CommentId,
      timestamp: originalTimestamp,
      edited_at: editedAt,
      user: messageUser,
      user_id: userId,
    }

    renderMessage(message)

    const headerTime = document.querySelector('.review-panel-entry-time')
    expect(headerTime).to.exist
    expect(headerTime?.textContent).to.include(formatTimeBasedOnYear(editedAt))
    expect(headerTime?.textContent).to.not.include(
      formatTimeBasedOnYear(originalTimestamp)
    )
    expect(screen.getByText('(edited)')).to.exist
  })

  it('uses the original timestamp when a comment has not been edited', function () {
    const originalTimestamp = new Date('2020-03-15T10:00:00.000Z')

    const message: ReviewPanelCommentThreadMessage = {
      content: 'original comment text',
      id: 'comment-2' as CommentId,
      timestamp: originalTimestamp,
      user: messageUser,
      user_id: userId,
    }

    renderMessage(message)

    const headerTime = document.querySelector('.review-panel-entry-time')
    expect(headerTime).to.exist
    expect(headerTime?.textContent).to.include(
      formatTimeBasedOnYear(originalTimestamp)
    )
    expect(screen.queryByText('(edited)')).to.not.exist
  })
})
