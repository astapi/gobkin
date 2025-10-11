import { useState, useMemo } from 'react'
import { JsonPartyRepositoryImpl } from '../../repositories/JsonPartyRepositoryImpl'
import { FirestorePartyRepositoryAdapter } from '../../repositories/FirestorePartyRepositoryImpl'
import type { PartyRepository } from '../../repositories/PartyRepository'

export function usePartyRepository() {
  const [repositoryInitialized, setRepositoryInitialized] = useState(false)

  const useFirestore = import.meta.env.VITE_USE_FIRESTORE === 'true'

  const partyRepository = useMemo(() => {
    const repo: PartyRepository = useFirestore
      ? new FirestorePartyRepositoryAdapter()
      : new JsonPartyRepositoryImpl()

    if (useFirestore && repo instanceof FirestorePartyRepositoryAdapter) {
      repo.setOnDataChange(() => {
        setRepositoryInitialized(true)
      })
    } else {
      setRepositoryInitialized(true)
    }

    return repo
  }, [useFirestore])

  return {
    partyRepository,
    repositoryInitialized,
    isLoading: useFirestore && !repositoryInitialized
  }
}