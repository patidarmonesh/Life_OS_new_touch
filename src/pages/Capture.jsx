import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, Mic, MicOff, Image, ArrowRight, Plus, Check } from 'lucide-react'
import { useAppActions, useAppState } from '../context/appHooks'
import { canonicalCategories, duplicateTransaction, parseMinorUnits, parseMoneyMessage } from '../domain/capture/index'
import { ownerDate, parseDiary, uid } from '../domain/planning/index'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'

export default function Capture() {
  const state = useAppState(), { updateModule, updateModules } = useAppActions(), navigate = useNavigate()
  const captures = state.captures || { items: [], draftText: '', retainRaw: false }
  const [kind, setKind] = useState('note'), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [review, setReview] = useState(null), [form, setForm] = useState(null), [listening, setListening] = useState(false), [language, setLanguage] = useState('en-IN')
  const speech = useRef(null), fileInput = useRef(null), reviewError = useRef(null)
  const timezone = state.settings?.profile?.timezone || 'Asia/Kolkata', today = ownerDate(new Date(), timezone)
  const categories = canonicalCategories(state.finance?.categories?.length ? state.finance.categories : state.settings?.preferences?.expenseCategories || ['Miscellaneous'])
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  useEffect(() => () => { speech.current?.abort() }, [])
  useEffect(() => { if (error) reviewError.current?.scrollIntoView({ block: 'nearest' }) }, [error])
  function changeText(value) { updateModule('captures', c => ({ ...c, draftText: value })); setError('') }
  function add() {
    try {
      if (!captures.draftText.trim()) throw new Error('Type, paste or dictate something first.')
      const item = { id: uid('capture'), kind, text: captures.draftText.trim(), status: 'pending', localDate: today, createdAt: new Date().toISOString(), source: 'intentional-text' }
      if (kind === 'money') {
        item.proposal = parseMoneyMessage(item.text, { captureDate: today, categories: categories.map(c => ({ id: c.id, name: c.label })) })
        if (item.proposal.status === 'excluded') throw new Error(item.proposal.warnings.join(' '))
      }
      updateModule('captures', c => ({ ...c, draftText: '', items: [item, ...(c.items || [])] }))
      setMessage('Capture saved to your inbox. Nothing has been added to your plan or ledger yet.')
      if (kind === 'money') openReview(item)
    } catch (e) { setError(e.message) }
  }
  function openReview(item) {
    setReview(item); setError('')
    if (item.kind === 'money') { const proposal = item.proposal || parseMoneyMessage(item.text, { captureDate: item.localDate, categories }); setForm({ ...proposal, amountText: proposal.amountMinor == null ? '' : (proposal.amountMinor / 100).toFixed(2) }) }
  }
  function archive(item) { updateModule('captures', c => ({ ...c, items: c.items.map(i => i.id === item.id ? { ...i, status: 'archived' } : i) })); setMessage('Capture archived. It remains available in your export.') }
  function sendToPlan(item) {
    const text = item.text?.trim()
    if (!text) { setError('Add a transcription before creating a plan. Image interpretation is unavailable.'); return }
    const blocks = parseDiary(text)
    updateModules({ planning: p => ({ ...p, drafts: { ...p.drafts, [item.localDate]: { ...p.drafts?.[item.localDate], text: [p.drafts?.[item.localDate]?.text, text].filter(Boolean).join('\n'), blocks: [...(p.drafts?.[item.localDate]?.blocks || []), ...blocks] } } }), captures: c => ({ ...c, items: c.items.map(i => i.id === item.id ? { ...i, status: 'confirmed', destination: 'plan', ...(c.retainRaw ? {} : { text: '', photo: undefined }) } : i) }) })
    navigate(`/plan?date=${item.localDate}`)
  }
  function saveNote(item) {
    if (!item.text?.trim()) { setError('Add note text before saving.'); return }
    updateModules({ secondBrain: b => ({ ...b, notes: [...(b.notes || []).filter(n => n.id !== `capture_${item.id}`), { id: `capture_${item.id}`, title: item.text.split('\n')[0].slice(0, 100), content: item.text, tags: [], createdAt: item.createdAt, source: 'capture', sourceCaptureId: item.id }] }), captures: c => ({ ...c, items: c.items.map(i => i.id === item.id ? { ...i, status: 'confirmed', destination: 'notes', ...(c.retainRaw ? {} : { text: '', photo: undefined }) } : i) }) })
    setReview(null); setMessage('Saved to Notes.')
  }
  function confirmMoney() {
    try {
      const amountMinor = parseMinorUnits(form.amountText)
      if (!(amountMinor > 0)) throw new Error('Enter an exact positive amount with up to two decimal places.')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) throw new Error('Choose the transaction date.')
      if (form.type === 'refund' && !form.linkedTransactionId) throw new Error('Link the original confirmed expense before confirming a refund.')
      const category = categories.find(c => c.id === form.categoryId)
      if (!category) throw new Error('Choose a configured category.')
      const transaction = { ...form, amountMinor, amount: amountMinor / 100, categoryId: category.id, category: category.label, id: `capture_${review.id}`, currency: 'INR', description: form.merchant || 'Reviewed capture', status: 'confirmed', confirmed: true, confirmedAt: new Date().toISOString(), source: 'confirmed-capture', sourceCaptureId: review.id, createdAt: review.createdAt, dateAssumed: false }
      delete transaction.amountText; delete transaction.warnings
      const existing = (state.finance?.expenses || []).filter(e => e.id !== transaction.id)
      const duplicate = duplicateTransaction(transaction, existing)
      if (duplicate.kind === 'duplicate') throw new Error('This reference and account already exist in Money. Archive this duplicate capture; no transaction was added.')
      if (duplicate.kind === 'conflict') throw new Error('This reference conflicts with an existing transaction. Correct the source or existing record in Money before confirming.')
      updateModules({ finance: f => ({ ...f, expenses: [...(f.expenses || []).filter(e => e.id !== transaction.id), transaction] }), captures: c => ({ ...c, items: c.items.map(i => i.id === review.id ? { ...i, status: 'confirmed', destination: 'money', transactionId: transaction.id, ...(c.retainRaw ? {} : { text: '', proposal: undefined, photo: undefined }) } : i) }) })
      setReview(null); setMessage('Transaction confirmed in Money. Repeated confirmation cannot create a second record.')
    } catch (e) { setError(e.message) }
  }
  function toggleVoice() {
    if (listening) { speech.current?.stop(); return }
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition(); recognition.lang = language; recognition.interimResults = false; recognition.continuous = false
    speech.current = recognition
    recognition.onresult = e => { const transcript = Array.from(e.results).map(r => r[0].transcript).join(' '); updateModule('captures', c => ({ ...c, draftText: `${c.draftText || ''}${c.draftText ? '\n' : ''}${transcript}` })) }
    recognition.onend = () => setListening(false)
    recognition.onerror = e => { setListening(false); setError(`Voice capture failed (${e.error}). Your draft is retained; you can type or paste it.`) }
    try { recognition.start(); setListening(true) } catch (e) { setError(e.message) }
  }
  async function attachPhoto(event) {
    const file = event.target.files?.[0]; if (!file) return
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) { setError('Choose an image no larger than 2 MB. Larger originals can be kept outside the app.'); return }
    try {
      const photo = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })
      const item = { id: uid('capture'), kind: 'photo', text: captures.draftText || '', photo, filename: file.name, status: 'needs-transcription', localDate: today, createdAt: new Date().toISOString(), source: 'photo' }
      updateModule('captures', c => ({ ...c, draftText: '', items: [item, ...(c.items || [])] }))
      setMessage('Image saved for review. Automatic handwriting and bill recognition are unavailable; add your transcription before using it.')
    } catch { setError('The image could not be saved. Keep your original file and retry.') }
    event.target.value = ''
  }
  const inbox = (captures.items || []).filter(i => !['confirmed', 'archived'].includes(i.status))
  return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">GET IT OUT OF YOUR HEAD</p><h1>Capture now. Decide later.</h1><p>A thought, a diary plan or a payment. Everything starts in your inbox.</p></div><span className="badge">{inbox.length} pending</span></header>
    <div className="capture-layout"><section className="section-card"><div className="field"><label htmlFor="capture-kind">What are you capturing?</label><select id="capture-kind" value={kind} onChange={e => setKind(e.target.value)}><option value="note">Thought or note</option><option value="plan">Tentative diary plan</option><option value="money">Bank / UPI message</option></select></div><div className="field" style={{ marginTop: '1rem' }}><label htmlFor="capture-text">Text or intentional paste</label><textarea id="capture-text" className="draft-textarea" value={captures.draftText || ''} onChange={e => changeText(e.target.value)} placeholder={kind === 'money' ? 'Paste a transaction message here. Review the amount, date and category before confirming.' : 'Type in Hindi, English or Hinglish…'}/></div><div className="row-actions" style={{ marginTop: '1rem' }}><Button onClick={add}><Plus size={17}/>Save to inbox</Button><Button variant="secondary" onClick={() => fileInput.current?.click()}><Image size={17}/>Photo</Button><input type="file" accept="image/*" capture="environment" ref={fileInput} onChange={attachPhoto} hidden style={{ display: 'none' }}/></div><details style={{ marginTop: '.75rem' }}><summary>Voice & capture options</summary><div className="page-stack"><p className="caption">{SpeechRecognition ? 'Voice transcription uses your browser’s speech service and may send audio to its provider. Only start it when you are ready.' : 'Voice transcription is unavailable in this browser. Use your keyboard’s dictation or paste text.'}</p>{SpeechRecognition && <div className="row-actions"><select aria-label="Dictation language" value={language} onChange={e => setLanguage(e.target.value)} style={{ width: 'auto' }}><option value="en-IN">English (India)</option><option value="hi-IN">Hindi / Hinglish</option></select><Button variant="secondary" onClick={toggleVoice}>{listening ? <MicOff size={17}/> : <Mic size={17}/>} {listening ? 'Stop dictation' : 'Start dictation'}</Button></div>}<p className="caption">This web app cannot read your SMS inbox. Photos remain in review until you transcribe them. No automatic OCR success is assumed.</p><label className="row-actions caption"><input type="checkbox" checked={Boolean(captures.retainRaw)} onChange={e => updateModule('captures', c => ({ ...c, retainRaw: e.target.checked }))}/>Keep original messages/photos after confirmation</label><p className="caption">Pending captures retain their source for review. With retention off, confirmation removes the raw source from the capture.</p></div></details></section>
    <section className="section-card"><div className="section-heading"><h2>Your inbox</h2><Inbox size={20}/></div>{inbox.length === 0 ? <div className="empty-state"><Inbox size={30}/><h3>A clear inbox.</h3><p>New captures stay here until you review them. Offline entries stay on this device for sync later.</p></div> : inbox.map(item => <div key={item.id} className="capture-item"><div className="row-actions"><span className="badge">{item.kind}</span><span className="caption">{item.localDate} · {item.status}</span></div><h3>{item.text?.slice(0, 140) || item.filename || 'Capture awaiting review'}</h3>{item.kind === 'photo' && <p className="caption">Needs your transcription</p>}<div className="row-actions"><Button variant="secondary" onClick={() => openReview(item)}>Review <ArrowRight size={15}/></Button><Button variant="ghost" onClick={() => archive(item)}>Archive</Button></div></div>)}</section></div>
    {message && <p className="notice" role="status">{message}</p>}{error && !review && <p className="notice error" role="alert">{error}</p>}
    <Modal isOpen={Boolean(review)} title={review?.kind === 'money' ? 'Review this transaction' : 'Review capture'} onClose={() => { setReview(null); setError('') }}>{review && <div className="page-stack">{review.photo && <img src={review.photo} alt="Your captured source" style={{ maxWidth: '100%', maxHeight: '18rem', objectFit: 'contain', borderRadius: '.5rem' }}/>}<p className="notice" style={{ whiteSpace: 'pre-wrap' }}>{review.text || 'No transcription yet.'}</p>{review.kind === 'money' && form ? <><div className="form-grid"><Input label="Amount (INR)" inputMode="decimal" value={form.amountText} onChange={e => setForm({ ...form, amountText: e.target.value })}/><Input label="Transaction date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}/><div className="field"><label htmlFor="money-type">Type</label><select id="money-type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="expense">Expense / debit</option><option value="income">Income / credit</option><option value="refund">Refund</option><option value="transfer">Own-account transfer</option><option value="fee">Fee / bank charge</option><option value="investment">Investment</option></select></div><div className="field"><label htmlFor="money-category">Category</label><select id="money-category" value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>{categories.map(c => <option value={c.id} key={c.id}>{c.label}</option>)}</select></div><Input label="Merchant / description" value={form.merchant} onChange={e => setForm({ ...form, merchant: e.target.value })}/><Input label="Bank / UPI reference" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })}/><Input label="Bank / provider" value={form.provider || ''} onChange={e => setForm({ ...form, provider: e.target.value })}/>{form.type === 'refund' && <div className="field"><label htmlFor="refund-original">Original expense to refund</label><select id="refund-original" value={form.linkedTransactionId || ''} onChange={e => setForm({ ...form, linkedTransactionId: e.target.value })}><option value="">Choose a confirmed expense</option>{(state.finance?.expenses || []).filter(e => (!e.type || ['expense', 'fee', 'debit'].includes(e.type)) && e.status !== 'pending' && (e.currency || 'INR') === 'INR').map(e => <option value={e.id} key={e.id}>{e.date} · {e.description || e.merchant || e.category} · ₹{((e.amountMinor ?? Math.round(e.amount * 100)) / 100).toFixed(2)}</option>)}</select></div>}<Input label="Account identifier (masked)" value={form.account} onChange={e => setForm({ ...form, account: e.target.value })}/></div>{form.warnings?.length > 0 && <div className="notice warning">{form.warnings.map(w => <p key={w}>{w}</p>)}</div>}<p className="caption">Equal amounts close together are not automatically removed. Exact references are checked. Transfers are excluded from spending.</p><Button onClick={confirmMoney}><Check size={17}/>Confirm transaction</Button></> : <><div className="field"><label htmlFor="capture-edit">Review / transcribe the source</label><textarea id="capture-edit" rows={5} value={review.text || ''} onChange={e => { const text = e.target.value; setReview({ ...review, text }); updateModule('captures', c => ({ ...c, items: c.items.map(i => i.id === review.id ? { ...i, text } : i) })) }}/></div><div className="row-actions"><Button onClick={() => sendToPlan(review)}>Use as an editable plan</Button><Button variant="secondary" onClick={() => saveNote(review)}>Save to Notes</Button></div></>}{error && <p ref={reviewError} className="notice error" role="alert">{error}</p>}</div>}</Modal>
  </div>
}
