import './phone.css'

/** Button that shows or hides the driver phone. The parent owns the open state. */
export function PhoneToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="ph-toggle" aria-pressed={open} onClick={onToggle}>
      {open ? 'Hide driver phone' : 'Driver phone'}
    </button>
  )
}
