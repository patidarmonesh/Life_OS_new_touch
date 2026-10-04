import { formatDuration } from '../../domain/metrics/index.js'
export const numberOf = metric => typeof metric === 'object' && metric !== null ? metric.value : metric
export function duration(metric) { const value = numberOf(metric); return value == null ? 'Not recorded' : formatDuration(value) }
export function percentage(metric) { const value = numberOf(metric); return value == null ? 'Unavailable' : `${Math.round(value * 10) / 10}%` }
export function money(metric, currency = 'INR') { const value = numberOf(metric); return value == null ? 'Not recorded' : new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(value / (['JPY', 'KRW'].includes(currency) ? 1 : 100)) }
