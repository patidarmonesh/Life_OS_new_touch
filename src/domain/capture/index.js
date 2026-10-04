export function parseMinorUnits(input) {
  const value = String(input ?? '').trim().replace(/^(?:₹|INR|Rs\.?)\s*/i, '')
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(value)) return null
  const [whole, decimal = ''] = value.replaceAll(',', '').split('.')
  const minor = Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
  return Number.isSafeInteger(minor) ? minor : null
}
export function canonicalCategories(categories = []) {
  return categories.map(c => typeof c === 'string' ? { id: c, label: c } : { id: c.id || c.name, label: c.name || c.label || c.id }).filter(c => c.id)
}
export function parseMoneyMessage(text, { captureDate, categories = [] } = {}) {
  const raw = String(text || '').trim(), warnings = []
  if (/\b(otp|one[- ]time password|verification code|failed|declined|unsuccessful)\b/i.test(raw)) return { status: 'excluded', warnings: ['This appears to be an OTP or failed payment. No transaction will be created.'] }
  let type = /refund|reversal|reversed/i.test(raw) ? 'refund' : /credit|received|deposited/i.test(raw) ? 'income' : /debited|debit|paid|spent|sent|purchase|withdraw/i.test(raw) ? 'expense' : null
  if (type !== 'refund' && /\b(?:investment|invested|mutual fund|sip installment)\b/i.test(raw)) type = 'investment'
  if (type !== 'refund' && /\b(?:fee|fees|bank charge|service charge)\b/i.test(raw)) type = 'fee'
  if (/own\s+account|self\s+transfer/i.test(raw)) type = 'transfer'
  const amounts = [...raw.matchAll(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi)]
  const candidates = amounts.filter(m => !/(?:bal(?:ance)?|available|avl)[\s.:-]*(?:INR|Rs\.?)?\s*$/i.test(raw.slice(Math.max(0, m.index - 35), m.index)))
  const selected = candidates[0]
  const amountMinor = selected ? parseMinorUnits(selected[1]) : null
  const ref = raw.match(/(?:UPI\s*(?:ref(?:erence)?|txn|transaction)|UTR|RRN|ref(?:erence)?(?:\s*(?:no|number))?|txn(?:\s*id)?)\s*[.:#-]?\s*([A-Za-z0-9-]{6,})/i)?.[1] || ''
  const account = raw.match(/(?:a\/?c|account)\s*(?:no\.?\s*)?([xX*\d-]{4,})/i)?.[1] || ''
  const provider = raw.match(/\b(?:HDFC|ICICI|SBI|AXIS|KOTAK|PNB|IDFC|CANARA|BOB|YES BANK)\b/i)?.[0]?.toUpperCase() || ''
  const merchant = raw.match(/(?:\bto\b|\bat\b|\bfrom\b)\s+([A-Za-z][A-Za-z0-9 &._-]{1,50}?)(?=\s+(?:on|via|ref|upi|using|avl|bal)|[.;]|$)/i)?.[1]?.trim() || ''
  const dateMatch = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  const date = dateMatch?.[1] || captureDate || ''
  if (!dateMatch) warnings.push('Date assumed from capture. Confirm or change it.')
  if (candidates.length > 1) warnings.push('Several amounts found. Check the transaction amount.')
  if (!amountMinor) warnings.push('Enter a positive transaction amount.')
  if (!type) warnings.push('Choose the transaction type.')
  const options = canonicalCategories(categories)
  const category = options.find(c => /misc|other/i.test(c.label)) || options[0] || { id: 'Miscellaneous', label: 'Miscellaneous' }
  return { status: amountMinor && type ? 'pending' : 'needs-review', amountMinor, amount: amountMinor == null ? null : amountMinor / 100, currency: 'INR', type: type || 'expense', date, dateAssumed: !dateMatch, reference: ref, account, provider, merchant, categoryId: category.id, category: category.label, warnings }
}
export function duplicateTransaction(candidate, records = []) {
  if (!candidate.reference) return { kind: 'none' }
  const identity = r => JSON.stringify([r.currency || 'INR', r.provider || r.bankId || r.institutionId || '', r.accountId || r.account || '', r.reference || r.transactionRef || r.upiRef])
  const same = records.find(r => !r.deletedAt && !['failed', 'rejected'].includes(r.status) && identity(r) === identity(candidate))
  if (!same) return { kind: 'none' }
  const amount = same.amountMinor ?? Math.round(Number(same.amount) * 100)
  return { kind: amount === candidate.amountMinor && (same.type || same.transactionType || 'expense') === candidate.type && (same.date || same.localDate) === (candidate.date || candidate.localDate) && (same.linkedTransactionId || null) === (candidate.linkedTransactionId || null) ? 'duplicate' : 'conflict', record: same }
}
