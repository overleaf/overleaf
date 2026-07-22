import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  EditorView,
  keymap,
  tooltips,
  drawSelection,
  placeholder as placeholderExt,
} from '@codemirror/view'
import { Compartment, EditorSelection } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { autocompletion, completionStatus } from '@codemirror/autocomplete'
import classNames from 'classnames'
import mentions, {
  mentionCompletions,
  mentionAutocompleteTheme,
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
  // (the chat composer and the review-panel reply box).
  clear: () => void
}

type MentionsInputProps = {
  onSubmit: (value: string) => void
  onChange?: (value: string) => void
  onBlur?: (value: string) => void
  // Called on Escape (when the autocomplete popup is not open). Used by the
  // edit flows to cancel without saving.
  onCancel?: () => void
  onFocus?: () => void
  placeholder?: string
  label?: string
  disabled?: boolean
  initialValue?: string
  autoFocus?: boolean
  selectOnFocus?: boolean
  className?: string
}

// Shared editor styling for the mentions input.
const mentionsInputTheme = EditorView.theme({
  // reset variables to override visual mode's .cm-content rules
  '&.cm-editor': {
    '--visual-font-family': 'var(--bs-body-font-family)',
    '--visual-font-size': 'var(--font-size)',
  },
  // double the specificity to override the base font family used by theme.ts regardless of extension load order
  '.cm-content.cm-content': {
    fontFamily: 'var(--bs-body-font-family)',
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

// A small CodeMirror 6 input that supports `@mention` autocompletion. Shared by
// the chat composer/edit field and the review panel's add-comment, reply, and
// edit fields so all of them get the same mention behaviour.
export const MentionsInput = forwardRef<
  MentionsInputHandle,
  MentionsInputProps
>(function MentionsInput(
  {
    onChange,
    onSubmit,
    onBlur,
    onCancel,
    onFocus,
    placeholder = '',
    label,
    disabled = false,
    initialValue = '',
    autoFocus = false,
    selectOnFocus = false,
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
  const onCancelRef = useRef(onCancel)
  const onFocusRef = useRef(onFocus)
  const disabledRef = useRef(disabled)
  onChangeRef.current = onChange
  onSubmitRef.current = onSubmit
  onBlurRef.current = onBlur
  onCancelRef.current = onCancel
  onFocusRef.current = onFocus
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

    const view = new EditorView({
      doc: initialValue,
      parent: containerRef.current,
      extensions: [
        projectMembersInfo,
        EditorView.lineWrapping,
        drawSelection(),
        mentionsInputTheme,
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
              mentionAutocompleteTheme,
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
          focus: () => {
            onFocusRef.current?.()
            return false
          },
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
          {
            key: 'Escape',
            run: view => {
              // Let the autocomplete popup handle Escape when it's open.
              if (completionStatus(view.state) === 'active') {
                return false
              }
              if (onCancelRef.current) {
                onCancelRef.current()
                return true
              }
              return false
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        history(),
      ],
    })
    viewRef.current = view
    if (autoFocus) {
      view.focus()
      if (selectOnFocus) {
        view.dispatch({
          selection: EditorSelection.range(0, view.state.doc.length),
        })
      }
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
