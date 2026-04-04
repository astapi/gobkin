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

export const usePartyService = () => {
  const [parties, setParties] = useState<Party[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const partyRepository = useMemo<IPartyRepository>(() => {
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
    const currentParties = await getPartyListUseCase.execute()
    setParties(currentParties)
  }, [getPartyListUseCase])

  useEffect(() => {
    void refreshParties().then(() => setIsLoading(false))
  }, [refreshParties])

  const getPartyById = useCallback(
    (partyId: number) => getPartyByIdUseCase.execute(partyId),
    [getPartyByIdUseCase],
  )

  const addMember = useCallback(
    async (partyId: number, goblinId: number) => {
      const updated = await managePartyUseCase.addMember(partyId, goblinId.toString())
      await refreshParties()
      return updated
    },
    [managePartyUseCase, refreshParties],
  )

  const removeMember = useCallback(
    async (partyId: number, goblinId: number) => {
      const updated = await managePartyUseCase.removeMember(partyId, goblinId.toString())
      await refreshParties()
      return updated
    },
    [managePartyUseCase, refreshParties],
  )

  const updateMembers = useCallback(
    async (partyId: number, memberIds: number[]) => {
      const updated = await updatePartyMembersUseCase.execute(partyId, memberIds)
      await refreshParties()
      return updated
    },
    [updatePartyMembersUseCase, refreshParties],
  )

  const createParty = useCallback(
    async (input: Parameters<CreatePartyUseCase['execute']>[0]) => {
      const created = await createPartyUseCase.execute(input)
      await refreshParties()
      return created
    },
    [createPartyUseCase, refreshParties],
  )

  const markExpedition = useCallback(
    async (partyId: number) => {
      await managePartyUseCase.markExpedition(partyId)
      await refreshParties()
    },
    [managePartyUseCase, refreshParties],
  )

  const markIdle = useCallback(
    async (partyId: number) => {
      await managePartyUseCase.markIdle(partyId)
      await refreshParties()
    },
    [managePartyUseCase, refreshParties],
  )

  const setDungeon = useCallback(
    async (partyId: number, dungeonId: string) => {
      const updated = await configurePartyUseCase.setDungeon(partyId, dungeonId)
      await refreshParties()
      return updated
    },
    [configurePartyUseCase, refreshParties],
  )

  const setTargetFloor = useCallback(
    async (partyId: number, targetFloor: number | null) => {
      const updated = await configurePartyUseCase.setTargetFloor(partyId, targetFloor)
      await refreshParties()
      return updated
    },
    [configurePartyUseCase, refreshParties],
  )

  const setReturnPolicy = useCallback(
    async (partyId: number, returnPolicy: Parameters<ConfigurePartyUseCase['setReturnPolicy']>[1]) => {
      const updated = await configurePartyUseCase.setReturnPolicy(partyId, returnPolicy)
      await refreshParties()
      return updated
    },
    [configurePartyUseCase, refreshParties],
  )

  return {
    partyRepository,
    parties,
    isLoading,
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
