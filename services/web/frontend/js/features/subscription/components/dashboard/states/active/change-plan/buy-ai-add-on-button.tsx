import { Button } from 'react-bootstrap'
import { postJSON } from '@/infrastructure/fetch-json'
import { AI_ADD_ON_CODE } from '../../../../../data/add-on-codes'

export function BuyAiAddOnButton() {
  const addAiAddon = async () => {
    await postJSON(`/user/subscription/addon/${AI_ADD_ON_CODE}/add`)
    location.reload()
  }

  return <Button onClick={addAiAddon}>Purchase AI subscription </Button>
}
