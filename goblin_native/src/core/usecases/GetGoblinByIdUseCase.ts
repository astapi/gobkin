import type { Goblin } from '../../shared/types'
import type { IGoblinRepository } from '../repositories'

export class GetGoblinByIdUseCase {
  private readonly goblinRepository: IGoblinRepository

  constructor(goblinRepository: IGoblinRepository) {
    this.goblinRepository = goblinRepository
  }

  public async execute(goblinId: number): Promise<Goblin> {
    const goblin = await this.goblinRepository.getGoblin(goblinId)
    if (!goblin) {
      throw new Error(`ID ${goblinId} のゴブリンが見つかりません`)
    }
    return goblin
  }
}
