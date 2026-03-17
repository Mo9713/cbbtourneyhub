import { useState } from 'react'
import { Copy, Check, Link } from 'lucide-react'
import { useTheme } from '../../../shared/lib/theme'

interface Props {
  inviteCode: string
}

export function CopyInviteLink({ inviteCode }: Props) {
  const theme = useTheme()
  const [copied, setCopied] = useState(false)

  const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${inviteCode}`

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl)
    } else {
      const el = document.createElement('textarea')
      el.value = inviteUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${theme.borderBase} ${theme.bgMd} w-full max-w-lg`}>
      <Link size={13} className={`flex-shrink-0 ${theme.textMuted}`} />
      <span className={`text-xs font-mono truncate flex-1 text-left ${theme.textMuted} select-all`}>
        {inviteUrl}
      </span>
      <button
        onClick={handleCopyLink}
        className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
          copied
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : theme.btn
        }`}
      >
        {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy Link</>}
      </button>
    </div>
  )
}