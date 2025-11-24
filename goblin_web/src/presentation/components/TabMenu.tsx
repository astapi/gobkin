interface TabMenuProps {
  activeTab: 'list' | 'formation' | 'base'
  onTabChange: (tab: 'list' | 'formation' | 'base') => void
}

export const TabMenu = ({ activeTab, onTabChange }: TabMenuProps) => (
  <div className="bg-white border-t-2 border-gray-200 flex h-20 shadow-[0_-2px_8px_rgba(0,0,0,0.1)]">
    <button
      className={`flex-1 flex flex-col items-center justify-center p-2.5 transition-all relative border-t-[3px] ${
        activeTab === 'list' ? 'bg-gray-100 border-gray-600' : 'hover:bg-gray-50 border-transparent'
      }`}
      onClick={() => onTabChange('list')}
    >
      <div className="absolute right-0 top-[15%] h-[70%] w-px bg-gray-200" />
      <img src="/src/assets/list.svg" alt="リスト" className="w-8 h-8 mb-1" />
      <span className={`text-[11px] tracking-wider ${activeTab === 'list' ? 'text-gray-600 font-semibold' : 'text-gray-600 font-medium'}`}>
        リスト
      </span>
    </button>

    <button
      className={`flex-1 flex flex-col items-center justify-center p-2.5 transition-all relative border-t-[3px] ${
        activeTab === 'formation' ? 'bg-gray-100 border-gray-600' : 'hover:bg-gray-50 border-transparent'
      }`}
      onClick={() => onTabChange('formation')}
    >
      <img src="/src/assets/hensei.svg" alt="編成" className="w-8 h-8 mb-1" />
      <span className={`text-[11px] tracking-wider ${activeTab === 'formation' ? 'text-gray-600 font-semibold' : 'text-gray-600 font-medium'}`}>
        編成
      </span>
    </button>

    <button
      className={`flex-1 flex flex-col items-center justify-center p-2.5 transition-all relative border-t-[3px] ${
        activeTab === 'base' ? 'bg-gray-100 border-gray-600' : 'hover:bg-gray-50 border-transparent'
      }`}
      onClick={() => onTabChange('base')}
    >
      <img src="/src/assets/base.svg" alt="拠点" className="w-8 h-8 mb-1" />
      <span className={`text-[11px] tracking-wider ${activeTab === 'base' ? 'text-gray-600 font-semibold' : 'text-gray-600 font-medium'}`}>
        拠点
      </span>
    </button>
  </div>
)
