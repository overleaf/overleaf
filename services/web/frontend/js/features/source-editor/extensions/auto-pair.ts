import { keymap } from '@codemirror/view'
import { Compartment, Prec, TransactionSpec } from '@codemirror/state'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { closePrefixedBrackets } from './close-prefixed-brackets'

const autoPairConf = new Compartment()

export const autoPair = ({
  autoPairDelimiters,
}: {
  autoPairDelimiters: boolean
}) => autoPairConf.of(createAutoPair(autoPairDelimiters))

export const setAutoPair = (autoPairDelimiters: boolean): TransactionSpec => {
  return {
    effects: autoPairConf.reconfigure(createAutoPair(autoPairDelimiters)),
  }
}

const createAutoPair = (enabled: boolean) => {
  if (!enabled) {
    return []
  }

  return [
    closePrefixedBrackets(),
    closeBrackets(),
    // NOTE: using Prec.highest as this needs to run before the default Backspace handler
    Prec.highest(keymap.of(closeBracketsKeymap)),
  ]
}
