import { useState, useMemo } from 'react'
import { JsonGoblinRepositoryImpl } from '../../infrastructure/repositories/JsonGoblinRepositoryImpl'
import { FirestoreGoblinRepositoryAdapter } from '../../infrastructure/repositories/FirestoreGoblinRepositoryImpl'
import type { IGoblinRepository } from '../../core/repositories'

export function useGoblinRepository() {
  const [repositoryInitialized, setRepositoryInitialized] = useState(false)

  const useFirestore = import.meta.env.VITE_USE_FIRESTORE === 'true'

  const goblinRepository = useMemo(() => {
    const repo: IGoblinRepository = useFirestore
      ? new FirestoreGoblinRepositoryAdapter()
      : new JsonGoblinRepositoryImpl()

    if (useFirestore && repo instanceof FirestoreGoblinRepositoryAdapter) {
      repo.setOnDataChange(() => {
        setRepositoryInitialized(true)
      })
    } else {
      setRepositoryInitialized(true)
    }

    return repo
  }, [useFirestore])

  return {
    goblinRepository,
    repositoryInitialized,
    isLoading: useFirestore && !repositoryInitialized
  }
}
