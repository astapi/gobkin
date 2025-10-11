import type { ExpeditionRequest } from '../../shared/types'

interface ReturnPolicySelectionModalProps {
  onSelect: (policy: ExpeditionRequest["returnPolicy"]) => void
  onClose: () => void
}

export const ReturnPolicySelectionModal = ({ onSelect, onClose }: ReturnPolicySelectionModalProps) => {
  const options: Array<{
    value: ExpeditionRequest["returnPolicy"]
    label: string
    description: string
  }> = [
    {
      value: "never",
      label: "帰還しない",
      description: "全員が死亡するまで探索を続けます"
    },
    {
      value: "if_any_ko",
      label: "1人でも死亡したら帰還",
      description: "メンバーが1人でも倒れたら即座に帰還します"
    },
    {
      value: "if_two_ko",
      label: "2人が死亡したら帰還",
      description: "メンバーが2人倒れたら帰還します"
    },
    {
      value: "last_one",
      label: "最後の1人になったら帰還",
      description: "生存者が1人になったら帰還します"
    }
  ]

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-[414px] w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">帰還条件を選択</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-2">
            {options.map((option) => (
              <div
                key={option.value}
                className="bg-white border-2 border-gray-200 rounded-lg p-3 cursor-pointer hover:border-gray-400 hover:shadow-md transition-all"
                onClick={() => onSelect(option.value)}
              >
                <div className="font-semibold text-gray-800 text-sm mb-1">
                  {option.label}
                </div>
                <div className="text-xs text-gray-600">{option.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
