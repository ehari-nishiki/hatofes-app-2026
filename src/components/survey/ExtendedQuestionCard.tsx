import { useState } from 'react'
import type { ExtendedQuestion } from '@/types/firestore'

interface ExtendedQuestionCardProps {
  question: ExtendedQuestion
  index: number
  value: string | number | string[] | undefined
  onChange: (value: string | number | string[]) => void
}

export default function ExtendedQuestionCard({
  question,
  index,
  value,
  onChange,
}: ExtendedQuestionCardProps) {
  const [rankingItems, setRankingItems] = useState<string[]>(
    question.type === 'ranking' && question.rankingItems
      ? [...question.rankingItems]
      : []
  )

  // Dragging state for ranking
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleDragStart = (idx: number) => {
    setDraggedIndex(idx)
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === idx) return

    const newItems = [...rankingItems]
    const [removed] = newItems.splice(draggedIndex, 1)
    newItems.splice(idx, 0, removed)
    setRankingItems(newItems)
    setDraggedIndex(idx)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    onChange(rankingItems)
  }

  return (
    <div className="card">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-xs bg-hatofes-dark px-2 py-1 rounded text-hatofes-gray">
          Q{index + 1}
        </span>
        {question.required && <span className="text-xs text-red-400">必須</span>}
      </div>
      <h3 className="text-hatofes-white font-medium mb-4">{question.question}</h3>

      {question.imageUrl && (
        <img
          src={question.imageUrl}
          alt="質問画像"
          className="mb-4 w-full rounded-lg max-h-48 object-contain border border-hatofes-gray"
        />
      )}

      {/* Multiple Choice */}
      {question.type === 'multiple_choice' && question.options && (
        <div className="space-y-2">
          {question.options.map((option, i) => (
            <label
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                value === option
                  ? 'bg-hatofes-accent-yellow/20 border border-hatofes-accent-yellow'
                  : 'bg-hatofes-dark hover:bg-hatofes-gray/20'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  value === option ? 'border-hatofes-accent-yellow' : 'border-hatofes-gray'
                }`}
              >
                {value === option && (
                  <div className="w-2 h-2 rounded-full bg-hatofes-accent-yellow" />
                )}
              </div>
              <span className="text-hatofes-white text-sm">{option}</span>
            </label>
          ))}
        </div>
      )}

      {/* Text Input */}
      {question.type === 'text' && (
        <input
          type="text"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder || '回答を入力してください'}
          maxLength={question.maxLength}
          className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-3 text-hatofes-white placeholder-hatofes-gray focus:outline-none focus:border-hatofes-accent-yellow"
        />
      )}

      {/* Long Text */}
      {question.type === 'long_text' && (
        <textarea
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder || '回答を入力してください'}
          maxLength={question.maxLength}
          rows={5}
          className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-3 text-hatofes-white placeholder-hatofes-gray resize-none focus:outline-none focus:border-hatofes-accent-yellow"
        />
      )}

      {/* Rating */}
      {question.type === 'rating' && (
        <div className="flex justify-center gap-2">
          {Array.from(
            { length: (question.maxRating || 5) - (question.minRating || 1) + 1 },
            (_, i) => (question.minRating || 1) + i
          ).map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating)}
              className={`w-12 h-12 rounded-lg font-bold text-lg transition-colors ${
                value === rating
                  ? 'bg-hatofes-accent-yellow text-hatofes-dark'
                  : 'bg-hatofes-dark text-hatofes-white hover:bg-hatofes-gray/30'
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
      )}

      {/* Image Choice */}
      {question.type === 'image_choice' && question.imageOptions && (
        <div className="grid grid-cols-2 gap-3">
          {question.imageOptions.map((opt, i) => (
            <label
              key={i}
              className={`cursor-pointer rounded-lg overflow-hidden transition-all ${
                value === opt.label
                  ? 'ring-2 ring-hatofes-accent-yellow'
                  : 'hover:ring-1 hover:ring-hatofes-gray'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={opt.label}
                checked={value === opt.label}
                onChange={() => onChange(opt.label)}
                className="sr-only"
              />
              <img
                src={opt.url}
                alt={opt.label}
                className="w-full aspect-square object-cover"
              />
              <div
                className={`p-2 text-center text-sm ${
                  value === opt.label
                    ? 'bg-hatofes-accent-yellow/20 text-hatofes-accent-yellow'
                    : 'bg-hatofes-dark text-hatofes-white'
                }`}
              >
                {opt.label}
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Slider */}
      {question.type === 'slider' && (
        <div className="space-y-3">
          <input
            type="range"
            min={question.minValue || 0}
            max={question.maxValue || 100}
            step={question.step || 1}
            value={(value as number) || question.minValue || 0}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="w-full h-2 bg-hatofes-dark rounded-lg appearance-none cursor-pointer accent-hatofes-accent-yellow"
          />
          <div className="flex justify-between text-xs text-hatofes-gray">
            <span>{question.minValue || 0}</span>
            <span className="text-lg font-bold text-hatofes-accent-yellow">
              {(value as number) ?? question.minValue ?? 0}
            </span>
            <span>{question.maxValue || 100}</span>
          </div>
        </div>
      )}

      {/* Checkbox (Multiple Select) */}
      {question.type === 'checkbox' && question.options && (
        <div className="space-y-2">
          {question.options.map((option, i) => {
            const selectedValues = Array.isArray(value) ? value : []
            const isSelected = selectedValues.includes(option)

            return (
              <label
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-hatofes-accent-yellow/20 border border-hatofes-accent-yellow'
                    : 'bg-hatofes-dark hover:bg-hatofes-gray/20'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {
                    if (isSelected) {
                      onChange(selectedValues.filter((v) => v !== option))
                    } else {
                      onChange([...selectedValues, option])
                    }
                  }}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected ? 'border-hatofes-accent-yellow bg-hatofes-accent-yellow' : 'border-hatofes-gray'
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-hatofes-dark" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-hatofes-white text-sm">{option}</span>
              </label>
            )
          })}
        </div>
      )}

      {/* Ranking */}
      {question.type === 'ranking' && question.rankingItems && (
        <div className="space-y-2">
          <p className="text-xs text-hatofes-gray mb-2">ドラッグして順位を変更</p>
          {rankingItems.map((item, i) => (
            <div
              key={item}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 p-3 rounded-lg bg-hatofes-dark cursor-move transition-all ${
                draggedIndex === i ? 'opacity-50 scale-95' : ''
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-hatofes-accent-yellow text-hatofes-dark flex items-center justify-center text-sm font-bold">
                {i + 1}
              </span>
              <span className="text-hatofes-white text-sm flex-1">{item}</span>
              <svg
                className="w-5 h-5 text-hatofes-gray"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8h16M4 16h16"
                />
              </svg>
            </div>
          ))}
        </div>
      )}

      {/* Datetime */}
      {question.type === 'datetime' && (
        <input
          type="datetime-local"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-hatofes-dark border border-hatofes-gray rounded-lg px-4 py-3 text-hatofes-white focus:outline-none focus:border-hatofes-accent-yellow"
        />
      )}
    </div>
  )
}
