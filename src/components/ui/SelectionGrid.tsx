interface SelectionGridProps {
  items: (string | number)[]
  onSelect: (item: string | number) => void
  columns?: number
  selectedItem?: string | number
}

export default function SelectionGrid({
  items,
  onSelect,
  columns = 3,
  selectedItem,
}: SelectionGridProps) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => onSelect(item)}
          className={`
            py-3 px-4 rounded-lg text-center font-medium transition-all
            ${selectedItem === item
              ? 'bg-gradient-to-r from-hatofes-accent-yellow to-hatofes-accent-orange text-white'
              : 'bg-hatofes-dark text-hatofes-white border border-hatofes-gray hover:border-hatofes-accent-yellow'
            }
          `}
        >
          {item}
        </button>
      ))}
    </div>
  )
}
