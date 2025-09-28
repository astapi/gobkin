interface TabMenuProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export const TabMenu = ({ activeTab, onTabChange }: TabMenuProps) => (
  <div className="bg-white border-t-2 border-gray-200 flex h-20 shadow-[0_-2px_8px_rgba(0,0,0,0.1)]">
    <button
      className={`flex-1 flex flex-col items-center justify-center p-2.5 transition-all relative border-t-[3px] ${
        activeTab === 'list' ? 'bg-gray-100 border-gray-600' : 'hover:bg-gray-50 border-transparent'
      }`}
      onClick={() => onTabChange('list')}
    >
      {activeTab !== 'list' && <div className="absolute right-0 top-[15%] h-[70%] w-px bg-gray-200" />}
      <svg className="w-8 h-8 mb-1 stroke-gray-600 fill-none stroke-2" viewBox="0 0 24 24">
        <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="3" cy="12" r="1" />
        <circle cx="3" cy="6" r="1" />
        <circle cx="3" cy="18" r="1" />
      </svg>
      <span className={`text-[11px] tracking-wider ${activeTab === 'list' ? 'text-gray-600 font-semibold' : 'text-gray-600 font-medium'}`}>
        リスト
      </span>
    </button>

    <button
      className={`flex-1 flex flex-col items-center justify-center p-2.5 transition-all relative border-t-[3px] ${
        activeTab === 'hensei' ? 'bg-gray-100 border-gray-600' : 'hover:bg-gray-50 border-transparent'
      }`}
      onClick={() => onTabChange('hensei')}
    >
      {activeTab !== 'hensei' && <div className="absolute right-0 top-[15%] h-[70%] w-px bg-gray-200" />}
      <svg className="w-8 h-8 mb-1 stroke-gray-600 fill-none stroke-2" viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="7" r="4" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75M8 3.13a4 4 0 0 0 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`text-[11px] tracking-wider ${activeTab === 'hensei' ? 'text-gray-600 font-semibold' : 'text-gray-600 font-medium'}`}>
        編成
      </span>
    </button>

    <button
      className={`flex-1 flex flex-col items-center justify-center p-2.5 transition-all border-t-[3px] ${
        activeTab === 'cave' ? 'bg-gray-100 border-gray-600' : 'hover:bg-gray-50 border-transparent'
      }`}
      onClick={() => onTabChange('cave')}
    >
      <svg className={`w-8 h-8 mb-1 stroke-2 ${activeTab === 'cave' ? 'fill-gray-600' : 'fill-gray-600'} stroke-gray-600`} viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        <circle cx="6" cy="18" r="2" className="stroke-none" />
        <circle cx="18" cy="6" r="2" className="stroke-none" />
      </svg>
      <span className={`text-[11px] tracking-wider ${activeTab === 'cave' ? 'text-gray-600 font-semibold' : 'text-gray-600 font-medium'}`}>
        ダンジョン
      </span>
    </button>
  </div>
)