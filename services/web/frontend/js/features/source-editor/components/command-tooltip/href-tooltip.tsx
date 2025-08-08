import { FC, FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '../codemirror-context'
import {
  closeCommandTooltip,
  resolveCommandNode,
} from '../../extensions/command-tooltip'
import {
  LiteralArgContent,
  ShortArg,
  ShortTextArgument,
  UrlArgument,
} from '../../lezer-latex/latex.terms.mjs'
import { EditorState } from '@codemirror/state'
import { openURL } from '@/features/source-editor/utils/url'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLForm from '@/shared/components/ol/ol-form'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'

export const HrefTooltipContent: FC = () => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()
  const [url, setUrl] = useState<string>(() => readUrl(state) ?? '')
  const { t } = useTranslation()

  const inputRef = useRef<HTMLInputElement | null>(null)

  // Update the URL if the argument value changes while not editing
  // TODO: on input blur, update the input value with this URL or read from the syntax tree?
  useEffect(() => {
    if (inputRef.current) {
      const controller = new AbortController()

      // update the input URL when it changes in the doc
      inputRef.current.addEventListener(
        'value-update',
        event => {
          setUrl((event as CustomEvent<string>).detail)
        },
        { signal: controller.signal }
      )

      // focus the URL input element when the tooltip opens, if the view is focused,
      // there is content selected in the doc, and no URL has been entered
      if (view.hasFocus && !view.state.selection.main.empty) {
        const currentUrl = readUrl(view.state)
        if (!currentUrl) {
          inputRef.current.focus()
        }
      }

      inputRef.current?.addEventListener(
        'blur',
        () => {
          const currentUrl = readUrl(view.state)
          if (currentUrl) {
            setUrl(currentUrl)
          }
        },
        { signal: controller.signal }
      )

      return () => controller.abort()
    }
  }, [view])

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      view.dispatch(closeCommandTooltip())
      view.focus()
    },
    [view]
  )

  return (
    <div className="ol-cm-command-tooltip-content">
      <OLForm className="ol-cm-command-tooltip-form" onSubmit={handleSubmit}>
        <OLFormGroup controlId="link-tooltip-url-input">
          <OLFormLabel>URL</OLFormLabel>
          <OLFormControl
            type="url"
            size="sm"
            htmlSize={50}
            placeholder="https://…"
            value={url}
            ref={(element: HTMLInputElement) => {
              inputRef.current = element
            }}
            autoComplete="off"
            onChange={event => {
              const url = (event.target as HTMLInputElement).value
              setUrl(url)
              const spec = replaceUrl(state, url)
              if (spec) {
                view.dispatch(spec)
              }
            }}
            disabled={state.readOnly}
          />
        </OLFormGroup>
      </OLForm>

      <OLButton
        variant="link"
        type="button"
        className="ol-cm-command-tooltip-link justify-content-start"
        onClick={() => {
          // TODO: unescape content
          openURL(url)
        }}
      >
        <MaterialIcon type="open_in_new" />

        {t('open_link')}
      </OLButton>

      {!state.readOnly && (
        <OLButton
          variant="link"
          type="button"
          className="ol-cm-command-tooltip-link justify-content-start"
          onClick={() => {
            const spec = removeLink(state)
            if (spec) {
              view.dispatch(spec)
              view.focus()
            }
          }}
        >
          <MaterialIcon type="link_off" />

          {t('remove_link')}
        </OLButton>
      )}
    </div>
  )
}

const readUrl = (state: EditorState) => {
  const commandNode = resolveCommandNode(state)
  const argumentNode = commandNode
    ?.getChild(UrlArgument)
    ?.getChild(LiteralArgContent)

  if (argumentNode) {
    return state.sliceDoc(argumentNode.from, argumentNode.to)
  }
}

const replaceUrl = (state: EditorState, url: string) => {
  const commandNode = resolveCommandNode(state)
  const argumentNode = commandNode
    ?.getChild(UrlArgument)
    ?.getChild(LiteralArgContent)

  if (argumentNode) {
    return {
      changes: {
        from: argumentNode.from,
        to: argumentNode.to,
        insert: url,
      },
    }
  }
}

const removeLink = (state: EditorState) => {
  const commandNode = resolveCommandNode(state)
  const contentNode = commandNode
    ?.getChild(ShortTextArgument)
    ?.getChild(ShortArg)

  if (commandNode && contentNode) {
    const content = state.sliceDoc(contentNode.from, contentNode.to)
    return {
      changes: {
        from: commandNode.from,
        to: commandNode.to,
        insert: content,
      },
    }
  }
}
