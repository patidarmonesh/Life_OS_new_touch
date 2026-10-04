import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
export default function Modal({ isOpen, onClose, title, children }) {
  const dialog = useRef(null), closeRef = useRef(onClose), titleId = useId()
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement, previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const panel = dialog.current
    const controls = () => [...panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(el => el.getClientRects().length)
    ;(controls()[0] || panel).focus()
    function handleKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current?.() }
      if (e.key !== 'Tab') return
      const elements = controls(), first = elements[0], last = elements.at(-1)
      if (!first) { e.preventDefault(); panel.focus() }
      else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    panel.addEventListener('keydown', handleKey)
    return () => { panel.removeEventListener('keydown', handleKey); document.body.style.overflow = previousOverflow; previous?.focus() }
  }, [isOpen])
  if (!isOpen) return null
  return createPortal(<div className="life-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose?.() }}><section className="life-modal" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}><header className="section-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></header>{children}</section></div>, document.body)
}
