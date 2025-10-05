interface FloorTargetSelectionModalProps {
  maxFloor: number
  onSelect: (floor: number | null) => void
  onClose: () => void
}

export const FloorTargetSelectionModal = ({ maxFloor, onSelect, onClose }: FloorTargetSelectionModalProps) => {
  const options = [
    { value: null, label: 'どこまでも進む', description: '全階層を探索します' },
    ...Array.from({ length: maxFloor }, (_, i) => ({
      value: i + 1,
      label: `${i + 1}階まで`,
      description: `${i + 1}階に到達したら帰還します`
    }))
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
            <h2 className="text-lg font-bold text-gray-800">目標階数を選択</h2>
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
            {options.map((option, index) => (
              <div
                key={index}
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
