import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Party } from '../../shared/types'
import { SQLitePartyRepository } from '../../infrastructure/repositories/SQLitePartyRepository'
import type { IPartyRepository } from '../../core/repositories'
import {
  ConfigurePartyUseCase,
  CreatePartyUseCase,
  GetPartyByIdUseCase,
  GetPartyListUseCase,
  ManagePartyUseCase,
  UpdatePartyMembersUseCase,
} from '../../core/usecases'

type ListenerCapablePartyRepository = IPartyRepository & {
  initialize?: () => Promise<void>
  reload?: () => Promise<void>
  setOnDataChange?: (callback: () => void) => void
}

export const usePartyService = () => {
  const [repositoryInitialized, setRepositoryInitialized] = useState(false)
  const [parties, setParties] = useState<Party[]>([])

  const partyRepository = useMemo<ListenerCapablePartyRepository>(() => {
    return SQLitePartyRepository.getInstance()
  }, [])

  const getPartyListUseCase = useMemo(
    () => new GetPartyListUseCase(partyRepository),
    [partyRepository],
  )
  const getPartyByIdUseCase = useMemo(
    () => new GetPartyByIdUseCase(partyRepository),
    [partyRepository],
  )
  const managePartyUseCase = useMemo(
    () => new ManagePartyUseCase(partyRepository),
    [partyRepository],
  )
  const createPartyUseCase = useMemo(
    () => new CreatePartyUseCase(partyRepository),
    [partyRepository],
  )
  const updatePartyMembersUseCase = useMemo(
    () => new UpdatePartyMembersUseCase(partyRepository),
    [partyRepository],
  )
  const configurePartyUseCase = useMemo(
    () => new ConfigurePartyUseCase(partyRepository),
    [partyRepository],
  )

  const refreshParties = useCallback(async () => {
    // DBから再読み込み
    if (partyRepository.reload) {
      await partyRepository.reload()
    }
    const currentParties = getPartyListUseCase.execute()
    setParties(currentParties)
  }, [partyRepository, getPartyListUseCase])

  useEffect(() => {
    const initRepository = async () => {
      if (partyRepository.initialize) {
        await partyRepository.initialize()
      }
      const currentParties = getPartyListUseCase.execute()
      setParties(currentParties)
      setRepositoryInitialized(true)
    }
    initRepository()
  }, [partyRepository, getPartyListUseCase])

  const getPartyById = useCallback(
    (partyId: number) => getPartyByIdUseCase.execute(partyId),
    [getPartyByIdUseCase],
  )

  const addMember = useCallback(
    (partyId: number, goblinId: number) => {
      const updated = managePartyUseCase.addMember(partyId, goblinId.toString())
      refreshParties()
      return updated
    },
    [managePartyUseCase, refreshParties],
  )

  const removeMember = useCallback(
    (partyId: number, goblinId: number) => {
      const updated = managePartyUseCase.removeMember(partyId, goblinId.toString())
      refreshParties()
      return updated
    },
    [managePartyUseCase, refreshParties],
  )

  const updateMembers = useCallback(
    (partyId: number, memberIds: number[]) => {
      const updated = updatePartyMembersUseCase.execute(partyId, memberIds)
      refreshParties()
      return updated
    },
    [updatePartyMembersUseCase, refreshParties],
  )

  const createParty = useCallback(
    (input: Parameters<CreatePartyUseCase['execute']>[0]) => {
      const created = createPartyUseCase.execute(input)
      refreshParties()
      return created
    },
    [createPartyUseCase, refreshParties],
  )

  const markExpedition = useCallback(
    (partyId: number) => {
      managePartyUseCase.markExpedition(partyId)
      refreshParties()
    },
    [managePartyUseCase, refreshParties],
  )

  const markIdle = useCallback(
    (partyId: number) => {
      managePartyUseCase.markIdle(partyId)
      refreshParties()
    },
    [managePartyUseCase, refreshParties],
  )

  const setDungeon = useCallback(
    (partyId: number, dungeonId: string) => {
      const updated = configurePartyUseCase.setDungeon(partyId, dungeonId)
      refreshParties()
      return updated
    },
    [configurePartyUseCase, refreshParties],
  )

  const setTargetFloor = useCallback(
    (partyId: number, targetFloor: number | null) => {
      const updated = configurePartyUseCase.setTargetFloor(partyId, targetFloor)
      refreshParties()
      return updated
    },
    [configurePartyUseCase, refreshParties],
  )

  const setReturnPolicy = useCallback(
    (partyId: number, returnPolicy: Parameters<ConfigurePartyUseCase['setReturnPolicy']>[1]) => {
      const updated = configurePartyUseCase.setReturnPolicy(partyId, returnPolicy)
      refreshParties()
      return updated
    },
    [configurePartyUseCase, refreshParties],
  )

  return {
    partyRepository,
    parties,
    isLoading: !repositoryInitialized,
    refreshParties,
    getPartyById,
    createParty,
    updateMembers,
    addMember,
    removeMember,
    markExpedition,
    markIdle,
    setDungeon,
    setTargetFloor,
    setReturnPolicy,
  }
}
