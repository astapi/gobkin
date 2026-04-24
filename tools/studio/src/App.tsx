import { Link, Route, Routes } from 'react-router-dom'

import { DungeonList } from './pages/DungeonList'
import { DungeonDetail } from './pages/DungeonDetail'
import { PartyPage } from './pages/PartyPage'
import { SimulatePage } from './pages/SimulatePage'
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
            <Link to="/party">PT編成</Link>
            <Link to="/simulate">シミュレーション</Link>
          </nav>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<DungeonList />} />
            <Route path="/dungeons/:areaId" element={<DungeonDetail />} />
            <Route path="/party" element={<PartyPage />} />
            <Route path="/simulate" element={<SimulatePage />} />
          </Routes>
        </main>
      </div>
    </PartyStoreProvider>
  )
}
