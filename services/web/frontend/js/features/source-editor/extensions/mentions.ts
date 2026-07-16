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
// `document.body`, so the source editor's global autocomplete base theme
// (auto-complete.ts) also lands on it. Scoping every rule under this class
// both isolates the mentions styling from the LaTeX autocomplete and raises
// specificity enough to win over those global `li[role="option"]` /
// `.cm-completionDetail` rules. The `li[role="option"]` selector is used for
// the same reason.
export const MENTIONS_TOOLTIP_CLASS = 'ol-cm-mentions-autocomplete'

export const mentionAutocompleteTheme = EditorView.baseTheme({
  '.cm-tooltip.cm-tooltip-autocomplete.ol-cm-mentions-autocomplete': {
    marginLeft: '0',
    border: 'none',
    background: 'transparent',
    borderRadius: 'var(--border-radius-large)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete.ol-cm-mentions-autocomplete > ul': {
    maxWidth: 'min(360px, 90vw)',
    whiteSpace: 'normal',
    padding: 'var(--spacing-02)',
    border: '1px solid var(--border-divider)',
    borderRadius: 'var(--border-radius-large)',
    background: 'var(--bg-light-primary)',
    // Matches the `shadow-md` elevation mixin (tooltips/dropdowns).
    boxShadow: '0 4px 12px 0 rgb(30 37 48 / 12%), 0 2px 4px rgb(30 37 48 / 8%)',
    fontFamily: 'var(--font-sans)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete.ol-cm-mentions-autocomplete > ul > li[role="option"]':
    {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gridTemplateRows: 'auto auto',
      alignItems: 'center',
      columnGap: 'var(--spacing-04)',
      padding: 'var(--spacing-03) var(--spacing-04)',
      overflowWrap: 'anywhere',
      borderRadius: 'var(--border-radius-medium)',
      lineHeight: '1.3',
    },
  '.cm-tooltip.cm-tooltip-autocomplete.ol-cm-mentions-autocomplete > ul > li[role="option"][aria-selected]':
    {
      background: 'var(--bg-light-secondary)',
    },

  '.cm-tooltip.cm-tooltip-autocomplete.ol-cm-mentions-autocomplete .ol-cm-mention-avatar':
    {
      gridColumn: '1',
      gridRow: '1 / span 2',
      alignSelf: 'center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      borderRadius: 'var(--border-radius-full)',
      color: 'var(--white)',
      fontSize: 'var(--font-size-02)',
      fontWeight: '600',
      textTransform: 'uppercase',
      boxSizing: 'border-box',
    },
  '.cm-tooltip.cm-tooltip-autocomplete.ol-cm-mentions-autocomplete .cm-completionLabel':
    {
      gridColumn: '2',
      gridRow: '1',
      fontSize: 'var(--font-size-03)',
      color: 'var(--content-primary)',
    },
  // The portion of the label matching what the user has typed.
  '.cm-tooltip.cm-tooltip-autocomplete.ol-cm-mentions-autocomplete .cm-completionMatchedText':
    {
      fontWeight: '700',
      textDecoration: 'none',
    },
  // details
  '.cm-tooltip.cm-tooltip-autocomplete.ol-cm-mentions-autocomplete .cm-completionDetail':
    {
      gridColumn: '2',
      gridRow: '2',
      margin: '0',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--font-size-02)',
      fontStyle: 'normal',
      color: 'var(--content-secondary)',
    },
})

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
