import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  EditorView,
  keymap,
  tooltips,
  drawSelection,
  placeholder as placeholderExt,
} from '@codemirror/view'
import { Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import {
  acceptCompletion,
  autocompletion,
  completionStatus,
} from '@codemirror/autocomplete'
import classNames from 'classnames'
import mentions, {
  mentionCompletions,
  renderMentionAvatar,
  MENTIONS_TOOLTIP_CLASS,
} from '@/features/source-editor/extensions/mentions'
import {
  projectMembersInfo,
  setProjectMembersInfo,
} from '@/features/source-editor/extensions/project-members-info'
import { useProjectContext } from '@/shared/context/project-context'
import { membersToIdMap, mentionsFeatureEnabled } from '@/shared/utils/mentions'

export type MentionsInputHandle = {
  // Returns true if the editor was focused, false if the view isn't ready yet.
  focus: () => boolean
  // Empties the editor. Used by inputs that stay mounted between submissions
  // (the review-panel reply box).
  clear: () => void
}

type MentionsInputProps = {
  onSubmit: (value: string) => void
  onChange?: (value: string) => void
  onBlur?: (value: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  initialValue?: string
  autoFocus?: boolean
  className?: string
}

// Styling for the mentions input's own CodeMirror instance. Mounted in a shadow
// root, so the document editor's selector-based CSS cannot reach it; only
// inherited custom properties cross the boundary. These rules override CM's
// built-in base theme, injected into the shadow root alongside the view.
const mentionsInputTheme = EditorView.theme({
  // Match the surrounding UI's body font rather than CM6's inherited defaults.
  '&.cm-editor .cm-content': {
    fontFamily: 'var(--bs-body-font-family)',
    fontSize: 'inherit',
    lineHeight: 'inherit',
  },
  // suppress CM6's default focus outline; the consumer's border/parent conveys focus
  '&.cm-editor.cm-focused': {
    outline: 'none',
  },
  // when range in editor is focused and selected
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'var(--bg-info-01)',
  },
  '&.cm-focused .cm-content ::selection': {
    color: 'var(--white)',
  },
  // when range in editor is exists but focus is outside editor, so ::selection is not applied
  '.cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--bg-info-01) 24%, transparent)',
  },
})

// Appearance for the review-panel inputs. These are mounted in a shadow root,
// so the light-DOM SCSS in review-panel.scss that used to style
// the inner CodeMirror via descendant selectors can no longer reach it. That
// styling lives here instead. The host <div> still gets its box styling
// (background/border/padding) from review-panel.scss, and CSS custom properties
// (e.g. --review-panel-color, --rp-input-min-height) cross the shadow boundary,
// so those rules resolve against the review-panel context as before.
const reviewPanelInputTheme = EditorView.theme({
  '&.cm-editor': {
    background: 'transparent',
    color: 'inherit',
    maxHeight: '200px',
  },
  '.cm-scroller': {
    lineHeight: 'var(--line-height-02)',
    scrollbarWidth: 'none',
  },
  '.cm-content': {
    // --rp-input-min-height is set per-variant on the host in review-panel.scss.
    minHeight: 'var(--rp-input-min-height, 44px)',
    padding: 'var(--spacing-01) var(--spacing-03)',
  },
  '.cm-cursor, .cm-cursor-primary': {
    borderLeftColor: 'var(--review-panel-color)',
  },
  '.cm-placeholder': {
    color: 'var(--content-placeholder-themed)',
  },
})

// A small CodeMirror 6 input that supports `@mention` autocompletion. Shared by
// the review panel's add-comment, reply, and edit fields so all of them get the
// same mention behaviour.
export const MentionsInput = forwardRef<
  MentionsInputHandle,
  MentionsInputProps
>(function MentionsInput(
  {
    onChange,
    onSubmit,
    onBlur,
    placeholder = '',
    label,
    disabled = false,
    initialValue = '',
    autoFocus = false,
    className,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editableConf = useRef(new Compartment())

  const { project } = useProjectContext()
  const { members, owner } = project || { members: [] }

  // The keymap, update listener and event handlers are wired once on mount,
  // so route them through refs to always call the latest props rather than
  // stale closures.
  const onChangeRef = useRef(onChange)
  const onSubmitRef = useRef(onSubmit)
  const onBlurRef = useRef(onBlur)
  const disabledRef = useRef(disabled)
  onChangeRef.current = onChange
  onSubmitRef.current = onSubmit
  onBlurRef.current = onBlur
  disabledRef.current = disabled

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (viewRef.current) {
          // Ensure that the input can be scrolled into view
          viewRef.current.contentDOM.focus({ preventScroll: false })
          return true
        }
        return false
      },
      clear: () => {
        const view = viewRef.current
        if (view) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: '' },
          })
        }
      },
    }),
    []
  )

  const ariaLabel = label ?? placeholder
  const mentionsEnabled = mentionsFeatureEnabled()

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    // Review-panel inputs are portaled inside the document editor's DOM, so
    // mount inside a shadow root to keep the editor's selector-based CSS out.
    // attachShadow throws if a root already exists (e.g. StrictMode remount),
    // so reuse the existing one.
    const parent =
      containerRef.current.shadowRoot ??
      containerRef.current.attachShadow({ mode: 'open' })

    const view = new EditorView({
      doc: initialValue,
      parent,
      extensions: [
        projectMembersInfo,
        EditorView.lineWrapping,
        drawSelection(),
        mentionsInputTheme,
        reviewPanelInputTheme,
        placeholderExt(placeholder),
        ...(mentionsEnabled
          ? [
              tooltips({ parent: document.body }),
              mentions(),
              autocompletion({
                override: [mentionCompletions],
                tooltipClass: () => MENTIONS_TOOLTIP_CLASS,
                // Replace the default icon with our coloured avatar circle.
                icons: false,
                addToOptions: [{ render: renderMentionAvatar, position: 20 }],
              }),
            ]
          : []),
        editableConf.current.of(EditorView.editable.of(!disabled)),
        ...(ariaLabel
          ? [EditorView.contentAttributes.of({ 'aria-label': ariaLabel })]
          : []),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString())
          }
        }),
        EditorView.domEventHandlers({
          blur: (_event, view) => {
            if (completionStatus(view.state) === 'active') {
              return false
            }
            onBlurRef.current?.(view.state.doc.toString())
            return false
          },
        }),
        keymap.of([
          {
            key: 'Enter',
            run: view => {
              if (disabledRef.current) {
                return true
              }
              onSubmitRef.current(view.state.doc.toString())
              return true
            },
          },
          // Accept the highlighted suggestion on Tab, as in the main editor's autocomplete.
          { key: 'Tab', run: acceptCompletion },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        history(),
      ],
    })
    viewRef.current = view
    if (autoFocus) {
      view.focus()
    }

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Set the mentionable members on mount and keep them in sync. This effect
  // runs right after the view is created above, so it also seeds the names.
  useEffect(() => {
    viewRef.current?.dispatch(
      setProjectMembersInfo(membersToIdMap(members, owner))
    )
  }, [members, owner])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: editableConf.current.reconfigure(
        EditorView.editable.of(!disabled)
      ),
    })
  }, [disabled])

  return <div ref={containerRef} className={classNames(className)} />
})

export default MentionsInput
