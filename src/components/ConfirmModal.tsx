import { Trash2, X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white w-full max-w-[400px] rounded-2xl shadow-xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {danger && (
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
            )}
            <h3 className="text-[17px] font-semibold text-zinc-900">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        <p className="text-sm text-zinc-600 leading-relaxed">{description}</p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-zinc-200 bg-white font-medium text-zinc-700 hover:bg-zinc-50 transition"
          >
            {cancelLabel || 'Отмена'}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl font-medium text-white transition ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#7c5cff] hover:bg-[#6b4de6]'
            }`}
          >
            {confirmLabel || 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  )
}
