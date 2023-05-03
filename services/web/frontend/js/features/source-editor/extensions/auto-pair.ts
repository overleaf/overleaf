import { keymap } from '@codemirror/view'
import { Compartment, Prec, TransactionSpec } from '@codemirror/state'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'

const autoPairConf = new Compartment()

export const autoPair = ({
  autoPairDelimiters,
}: {
  autoPairDelimiters: boolean
}) => autoPairConf.of(autoPairDelimiters ? extension : [])

export const setAutoPair = (autoPairDelimiters: boolean): TransactionSpec => {
  return {
    effects: autoPairConf.reconfigure(autoPairDelimiters ? extension : []),
  }
}

const extension = [
  closeBrackets(),
  // NOTE: using Prec.highest as this needs to run before the default Backspace handler
  Prec.highest(keymap.of(closeBracketsKeymap)),
]
