import { useExpeditionFlow } from '../hooks/useExpeditionFlow'
import { usePartyStore } from '../stores/usePartyStore'

/** 画面に依存せず、帰還処理と自動周回を進める常駐ホスト。 */
export function ExpeditionAutomationHost() {
  const parties = usePartyStore(state => state.parties)
  useExpeditionFlow({ parties, enableAutoCompletion: true })
  return null
}
