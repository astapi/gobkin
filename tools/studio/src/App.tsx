import { Link, Route, Routes } from 'react-router-dom'

import { DungeonList } from './pages/DungeonList'
import { DungeonDetail } from './pages/DungeonDetail'
import { PartyPage } from './pages/PartyPage'
import { SimulatePage } from './pages/SimulatePage'
import { StoryListPage } from './pages/StoryListPage'
import { StoryDetailPage } from './pages/StoryDetailPage'
import { GoblinDataPage } from './pages/GoblinDataPage'
import { SkillCatalogPage } from './pages/SkillCatalogPage'
import { EquipmentPoolPage } from './pages/EquipmentPoolPage'
import { DungeonUnlockFlowPage } from './pages/DungeonUnlockFlowPage'
import { BalanceReferencePage } from './pages/BalanceReferencePage'
import { ProgressionReportsPage } from './pages/ProgressionReportsPage'
import { TipsPage } from './pages/TipsPage'
import { RareDropsPage } from './pages/RareDropsPage'
import { RareItemsPage } from './pages/RareItemsPage'
import { DropSimulationPage } from './pages/DropSimulationPage'
import { PartyStoreProvider } from './stores/partyStore'

export function App() {
  return (
    <PartyStoreProvider>
      <div className="app">
        <header className="app-header">
          <h1>
            <Link to="/">Goblin Studio</Link>
          </h1>
          <nav>
            <Link to="/">ダンジョン</Link>
            <Link to="/unlock-flow">解放図</Link>
            <Link to="/stories">ストーリー</Link>
            <Link to="/goblins">ゴブリン</Link>
            <Link to="/equipment">アイテム</Link>
            <Link to="/rare-items">レアアイテム</Link>
            <Link to="/rare-drops">レアドロップ</Link>
            <Link to="/tips">TIPS</Link>
            <Link to="/skills">Skill</Link>
            <Link to="/party">PT編成</Link>
            <Link to="/simulate">シミュレーション</Link>
            <Link to="/drop-simulation">ドロップ試算</Link>
            <Link to="/balance-reference">バランス基準</Link>
            <Link to="/progression-reports">進行レポート</Link>
          </nav>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<DungeonList />} />
            <Route path="/unlock-flow" element={<DungeonUnlockFlowPage />} />
            <Route path="/dungeons/:areaId" element={<DungeonDetail />} />
            <Route path="/stories" element={<StoryListPage />} />
            <Route path="/stories/new" element={<StoryDetailPage />} />
            <Route path="/stories/:storyId" element={<StoryDetailPage />} />
            <Route path="/goblins" element={<GoblinDataPage />} />
            <Route path="/equipment" element={<EquipmentPoolPage />} />
            <Route path="/rare-items" element={<RareItemsPage />} />
            <Route path="/rare-drops" element={<RareDropsPage />} />
            <Route path="/tips" element={<TipsPage />} />
            <Route path="/skills" element={<SkillCatalogPage />} />
            <Route path="/party" element={<PartyPage />} />
            <Route path="/simulate" element={<SimulatePage />} />
            <Route path="/drop-simulation" element={<DropSimulationPage />} />
            <Route path="/balance-reference" element={<BalanceReferencePage />} />
            <Route path="/progression-reports" element={<ProgressionReportsPage />} />
          </Routes>
        </main>
      </div>
    </PartyStoreProvider>
  )
}
