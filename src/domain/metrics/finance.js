/** Decimal conversion avoids binary multiplication errors and never treats balances as payments. */
export function toMinorUnits(value, decimals = 2) {
  const text = String(value ?? '').trim().replace(/,/g, '').replace(/^(?:₹|Rs\.?|INR|\$)\s*/i, '')
  const match = text.match(/^(-?)(\d+)(?:\.(\d+))?$/)
  if (!match || (match[3]?.length || 0) > decimals) return null
  const amount = Number(match[2]) * 10 ** decimals + Number((match[3] || '').padEnd(decimals, '0'))
  return Number.isSafeInteger(amount) ? (match[1] ? -amount : amount) : null
}

export function ledgerSummary(state, dates) {
  const records = [...(state.finance?.expenses || []), ...(state.finance?.transactions || [])]
  const byCurrency = {}, review = [], parents = new Map(), normalized = []
  let included = 0, excluded = 0
  const root = key => { if (!parents.has(key)) parents.set(key, key); if (parents.get(key) !== key) parents.set(key, root(parents.get(key))); return parents.get(key) }
  const supportedTypes = new Set(['expense', 'debit', 'fee', 'refund', 'income', 'credit', 'transfer', 'own-transfer', 'investment'])
  records.forEach((r, i) => {
    const inRange = dates.includes(r.date || r.localDate)
    if (r.deletedAt || ['failed', 'pending', 'proposed', 'rejected'].includes(r.status) || r.confirmed === false) { if (inRange) excluded++; return }
    const currency = r.currency || state.settings?.profile?.currency || 'INR'
    const amount = Number.isSafeInteger(r.amountMinor) ? r.amountMinor : toMinorUnits(r.amount, ['JPY', 'KRW'].includes(currency) ? 0 : 2)
    if (amount == null || amount < 0) { if (inRange) { review.push({ record: r, reason: 'Invalid non-negative amount' }); excluded++ } return }
    const type = r.type || r.transactionType || 'expense'
    if (!supportedTypes.has(type)) { if (inRange) { review.push({ record: r, reason: 'Unknown transaction type' }); excluded++ } return }
    const reference = r.reference || r.transactionRef || r.upiRef
    const key = r.id ? `id:${r.id}` : `unidentified:${i}`
    root(key)
    if (reference) {
      // The ingestion channel (SMS/CSV) is not a provider. Scope actual references
      // by bank/provider and account so two separate accounts keep their facts.
      const scope = JSON.stringify([currency, r.provider || r.bankId || r.institutionId || '', r.accountId || r.account || '', reference])
      parents.set(root(`reference:${scope}`), root(key))
    }
    normalized.push({ key, amount, type, currency, record: r, inRange })
  })
  const groups = new Map()
  normalized.forEach(r => { const key = root(r.key); groups.set(key, [...(groups.get(key) || []), r]) })
  const accepted = [], byId = new Map()
  groups.forEach(group => {
    const first = group[0]
    const conflict = group.some(r => r.amount !== first.amount || r.type !== first.type || r.currency !== first.currency || (r.record.date || r.record.localDate) !== (first.record.date || first.record.localDate) || (r.record.linkedTransactionId || null) !== (first.record.linkedTransactionId || null))
    if (conflict) {
      excluded += group.filter(r => r.inRange).length
      if (group.some(r => r.inRange)) review.push({ record: first.record, reason: 'Same transaction identity has conflicting details', originalIds: group.map(r => r.record.id).filter(Boolean) })
      return
    }
    excluded += Math.max(0, group.filter(r => r.inRange).length - Number(first.inRange))
    accepted.push(first)
    group.forEach(r => { if (r.record.id) byId.set(r.record.id, first) })
  })
  const refundsByOriginal = new Map()
  accepted.filter(r => r.type === 'refund').forEach(refund => {
    const original = byId.get(refund.record.linkedTransactionId)
    if (original && original.currency === refund.currency && ['expense', 'debit', 'fee'].includes(original.type)) refundsByOriginal.set(original, (refundsByOriginal.get(original) || 0) + refund.amount)
  })
  accepted.forEach(r => {
    if (!r.inRange) return
    if (r.type === 'refund') {
      const original = byId.get(r.record.linkedTransactionId)
      if (!original || !['expense', 'debit', 'fee'].includes(original.type) || original.currency !== r.currency || (original.record.date || original.record.localDate) > (r.record.date || r.record.localDate) || refundsByOriginal.get(original) > original.amount) {
        review.push({ record: r.record, reason: 'Refund needs a confirmed original expense in the same currency; total refunds must not exceed it' }); excluded++; return
      }
    }
    const totals = byCurrency[r.currency] ||= { expenseMinor: 0, feeMinor: 0, refundMinor: 0, incomeMinor: 0, transferMinor: 0, investmentMinor: 0, netSpendMinor: 0, count: 0 }
    if (['transfer', 'own-transfer'].includes(r.type)) totals.transferMinor += r.amount
    else if (r.type === 'investment') totals.investmentMinor += r.amount
    else if (r.type === 'fee') totals.feeMinor += r.amount
    else if (r.type === 'refund') totals.refundMinor += r.amount
    else if (['income', 'credit'].includes(r.type)) totals.incomeMinor += r.amount
    else if (['expense', 'debit'].includes(r.type)) totals.expenseMinor += r.amount
    totals.netSpendMinor = totals.expenseMinor + totals.feeMinor - totals.refundMinor
    totals.count++; included++
  })
  const confirmations = state.finance?.noSpendDates || []
  const confirmedZero = dates.every(date => confirmations.includes(date) || (state.finance?.confirmations || []).some(c => c.date === date && c.noSpend === true))
  return { byCurrency, included, excluded, review, confirmedZero }
}
