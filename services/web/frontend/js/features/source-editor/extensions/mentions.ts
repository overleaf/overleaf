import {
  Decoration,
  DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view'
import { Completion, CompletionContext } from '@codemirror/autocomplete'
import { projectMembersInfo } from './project-members-info'
import { MENTION_REGEX } from '@/shared/utils/parse-mentions'
import { getBackgroundColorForUserId } from '@/shared/utils/colors'

class MentionsWidget extends WidgetType {
  constructor(
    readonly userId: string,
    readonly name: string
  ) {
    super()
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'ol-cm-mention'
    span.textContent = '@' + this.name
    return span
  }

  eq(other: MentionsWidget) {
    return other.userId === this.userId && other.name === this.name
  }
}

const matchDecorator = new MatchDecorator({
  regexp: MENTION_REGEX,
  decoration: (match, view) => {
    const id = match[1]
    const name =
      view.state.field(projectMembersInfo).get(id)?.name ??
      view.state.phrase('unknown')
    return Decoration.replace({ widget: new MentionsWidget(id, name) })
  },
})

// Autocompletion source for `@mention`s. Offers the project members and, on
// selection, inserts `[id]` right after the `@` so the stored text is `@[id]`.
export function mentionCompletions(context: CompletionContext) {
  const before = context.matchBefore(/@\w*/)
  if (!context.explicit && !before) {
    return null
  }
  const members = context.state.field(projectMembersInfo)
  const options = Array.from(members.entries()).map(([id, info]) => ({
    label: info.name,
    detail: info.email,
    apply: `[${id}]`,
    // Carried through to renderMentionAvatar, which colours the avatar circle
    // by user id.
    mentionId: id,
  }))
  return {
    from: before ? before.from + 1 : context.pos,
    options,
    validFor: /^\w*$/,
  }
}

// Marker class added to the mentions autocomplete tooltip (via the
// `tooltipClass` option in mentions-input.tsx). The tooltip is parented to
// `document.body`, so it lives in the light DOM even when the editor is mounted
// in a shadow root. Its styling therefore lives in document-level SCSS
// (stylesheets/pages/editor/mentions-autocomplete.scss), scoped under this
// class so it can reach the body-parented tooltip regardless of where the
// editor is mounted.
export const MENTIONS_TOOLTIP_CLASS = 'ol-cm-mentions-autocomplete'

// Renders a project member's avatar circle for the autocomplete option. The
// background uses the same per-user hue as the rest of the editor's
// collaborator colours (via getHueForUserId), so a user looks consistent
// across mentions, cursors, and the review panel. The colour is set inline
// per-user rather than generated as a theme, keeping the styling static (see
// `no-generated-editor-themes`). Wired in via the `addToOptions` option in
// mentions-input.tsx;
export function renderMentionAvatar(completion: Completion) {
  const id = (completion as Completion & { mentionId?: string }).mentionId
  const avatar = document.createElement('span')
  avatar.className = 'ol-cm-mention-avatar'
  avatar.style.backgroundColor = getBackgroundColorForUserId(id)
  const label = completion.displayLabel ?? completion.label
  avatar.textContent = label.trim().charAt(0)
  return avatar
}

/**
 * Editor extension that renders stored `@[<id>]` mention tokens as `@name`
 * chips, resolving ids to names via the projectMembersInfo state field.
 */
export const mentions = () => {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet

        constructor(view: EditorView) {
          this.decorations = matchDecorator.createDeco(view)
        }

        update(update: ViewUpdate) {
          const namesChanged =
            update.startState.field(projectMembersInfo) !==
            update.state.field(projectMembersInfo)

          if (update.docChanged || update.viewportChanged) {
            this.decorations = matchDecorator.updateDeco(
              update,
              this.decorations
            )
          }
          if (namesChanged) {
            // full rebuild re-runs the `decoration` callback, re-resolving names
            this.decorations = matchDecorator.createDeco(update.view)
          }
        }
      },
      {
        decorations(value) {
          return value.decorations
        },
        provide: value => {
          return EditorView.atomicRanges.of(view => {
            return view.plugin(value)?.decorations || Decoration.none
          })
        },
      }
    ),
    emptyLineFillerTheme,
    mentionTheme,
  ]
}

// single atomicRange.
const mentionTheme = EditorView.baseTheme({
  '.ol-cm-mention': {
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontWeight: '500',
    color: 'var(--link-ui-themed)',
    whiteSpace: 'nowrap',
    cursor: 'default',
  },
  '.ol-cm-mention::selection': {
    color: 'var(--white)',
  },
})

const emptyLineFillerTheme = EditorView.baseTheme({
  '.ol-cm-filler': {
    padding: '0 2px',
  },
})

export default mentions
