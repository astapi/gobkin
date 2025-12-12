import { useState } from 'react'
import { GoblinListScreen } from './presentation/components/GoblinListScreen.tsx'
import { FormationTabScreen } from './presentation/components/FormationTabScreen.tsx'
import { BaseManagementScreen } from './presentation/components/BaseManagementScreen.tsx'
import { TabMenu } from './presentation/components/TabMenu.tsx'
import { AuthProvider } from './presentation/contexts/AuthContext.tsx'
import { useAuth } from './presentation/contexts/AuthContextValue.ts'
import { ExpeditionStateProvider } from './presentation/contexts/ExpeditionStateContext.tsx'

function AppContent() {
  const { loading } = useAuth()
  const [activeTab, setActiveTab] = useState<'list' | 'formation' | 'base'>('list')

  if (loading) {
    return (
      <div className="h-screen flex flex-col max-w-[414px] mx-auto border-2 border-gray-300 overflow-hidden bg-gray-50 relative">
        <div className="p-5 text-center text-white bg-gray-800 shadow-lg">
          <h1 className="text-lg font-bold tracking-wide">ゴブリン王国</h1>
        </div>
        <div className="flex flex-1 justify-center items-center">
          <div className="text-center">
            <div className="text-gray-600">認証中...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col max-w-[414px] mx-auto border-2 border-gray-300 overflow-hidden bg-gray-50 relative">
      {/* Header */}
      <div className="p-5 text-center text-white bg-gray-800 shadow-lg">
        <h1 className="text-lg font-bold tracking-wide">ゴブリン王国</h1>
      </div>

      {/* Main Content */}
      <div className="overflow-hidden flex-1 p-4 bg-gray-50">
        {activeTab === 'list' && (
          <GoblinListScreen />
        )}
        {activeTab === 'formation' && (
          <FormationTabScreen />
        )}
        {activeTab === 'base' && (
          <BaseManagementScreen />
        )}
      </div>

      {/* Tab Menu */}
      <TabMenu activeTab={activeTab} onTabChange={setActiveTab} />


    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ExpeditionStateProvider>
        <AppContent />
      </ExpeditionStateProvider>
    </AuthProvider>
  )
}

export default App
