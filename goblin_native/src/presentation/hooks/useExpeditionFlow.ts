import { useCallback, useState } from 'react'
import type {
  Dungeon,
  ExpeditionReplay,
  ExpeditionRequest,
  PartyStatus,
} from '../../shared/types'
import type { StartExpeditionUseCase } from '../../core/usecases'

interface UseExpeditionFlowParams {
  startExpeditionUseCase: StartExpeditionUseCase
  expeditionRepository: unknown
  setPartyExpeditionStatus: (partyId: number, status: PartyStatus) => void
  clearExpedition: (partyId: number) => void
  getPartyById: (partyId: number) => { id: number; name: string }
  markPartyAsOnExpedition: (partyId: number) => void
  markPartyAsIdle: (partyId: number) => void
}

interface StartExpeditionResult {
  replay: ExpeditionReplay
  partyId: number
}

export const useExpeditionFlow = ({
  startExpeditionUseCase,
  setPartyExpeditionStatus,
  clearExpedition,
  getPartyById,
  markPartyAsOnExpedition,
  markPartyAsIdle,
}: UseExpeditionFlowParams) => {
  const [isProcessing, setIsProcessing] = useState(false)

  const estimateExplorationTime = useCallback((
    dungeon: Dungeon,
    returnPolicy: ExpeditionRequest['returnPolicy'],
  ): number => {
    const baseTime = dungeon.exploration_time_sec_first ?? dungeon.exploration_time_sec

    const multiplierMap: Record<ExpeditionRequest['returnPolicy'], number> = {
      never: 1.0,
      until_floor2: 0.4,
      until_floor3: 0.6,
      if_any_ko: 0.7,
      if_two_ko: 0.75,
      last_one: 0.9,
    }

    const multiplier = multiplierMap[returnPolicy] ?? 1.0
    return Math.floor(baseTime * multiplier)
  }, [])

  const startExpedition = useCallback(
    async (request: ExpeditionRequest, _dungeon: Dungeon): Promise<StartExpeditionResult> => {
      const partyId = Number.parseInt(request.partyId, 10)
      if (Number.isNaN(partyId)) {
        throw new Error('Invalid party ID')
      }

      getPartyById(partyId)

      setIsProcessing(true)
      try {
        const replay = await startExpeditionUseCase.execute(request)

        setPartyExpeditionStatus(partyId, 'expedition')
        markPartyAsOnExpedition(partyId)

        return { replay, partyId }
      } finally {
        setIsProcessing(false)
      }
    },
    [
      getPartyById,
      markPartyAsOnExpedition,
      setPartyExpeditionStatus,
      startExpeditionUseCase,
    ],
  )

  const completeExpedition = useCallback((partyId: number) => {
    clearExpedition(partyId)
    markPartyAsIdle(partyId)
  }, [clearExpedition, markPartyAsIdle])

  return {
    isProcessing,
    startExpedition,
    completeExpedition,
    estimateExplorationTime,
  }
}
