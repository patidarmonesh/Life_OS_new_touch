import { useId } from 'react'
export default function Input({ label, prefix, error, hint, id: providedId, ...props }) {
  const generatedId = useId(), id = providedId || generatedId
  return <div className="field">{label && <label htmlFor={id}>{label}</label>}<div className="input-wrap">{prefix && <span className="input-prefix">{prefix}</span>}<input id={id} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${id}-hint` : undefined} {...props}/></div>{(error || hint) && <p id={`${id}-hint`} className={error ? 'field-error' : 'muted'}>{error || hint}</p>}</div>
}
