'use client'

import { formatWon } from '@/lib/budget/calc'

const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)',
]
export const OTHER_COLOR = 'var(--ink-soft)'

// 지출 비중 도넛 — SVG <circle>에 stroke-dasharray로 부채꼴을 그린다(라이브러리 없음).
// 조각별 <title>이 네이티브 호버 툴팁 역할(별도 JS 상태 없이 저비용 접근성 확보).
// colorFor를 넘기면 기본 팔레트 대신 그 색을 쓴다 — 예: 사용자별 차트에서 지출자 배지와 색을 통일.
export function DonutChart({
  data,
  colorFor,
  ariaLabel = '카테고리별 지출 비중 도넛 차트',
}: {
  data: { id: string; name: string; amount: number }[]
  colorFor?: (id: string, index: number) => string
  ariaLabel?: string
}) {
  const total = data.reduce((s, d) => s + d.amount, 0)
  if (total === 0) return <p className="budget-chart-empty">지출 내역이 없어요.</p>

  const color = (id: string, i: number) => colorFor?.(id, i) ?? (id === '__other__' ? OTHER_COLOR : CHART_COLORS[i % CHART_COLORS.length])
  const radius = 60
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg viewBox="0 0 140 140" width={140} height={140} role="img" aria-label={ariaLabel}>
        <circle cx={70} cy={70} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={20} />
        {data.map((d, i) => {
          const fraction = d.amount / total
          const dash = fraction * circumference
          const el = (
            <circle
              key={d.id}
              cx={70}
              cy={70}
              r={radius}
              fill="none"
              stroke={color(d.id, i)}
              strokeWidth={20}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            >
              <title>{d.name} {formatWon(d.amount)} ({(fraction * 100).toFixed(1)}%)</title>
            </circle>
          )
          offset += dash
          return el
        })}
      </svg>
      <ul className="budget-chart-legend" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {data.map((d, i) => (
          <li key={d.id}>
            <span className="swatch" style={{ background: color(d.id, i) }} />
            {d.name} {formatWon(d.amount)} ({((d.amount / total) * 100).toFixed(1)}%)
          </li>
        ))}
      </ul>
    </div>
  )
}

// 월별 수입/지출/저축 추이 라인 차트 — 3개 시리즈를 하나의 y축(공용 스케일)에 그린다.
export function TrendChart({
  data,
  colors,
}: {
  data: { month: string; income: number; expense: number; saving: number }[]
  colors: Record<'income' | 'expense' | 'saving', string>
}) {
  const width = 560
  const height = 160
  const padX = 8
  const padY = 12
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense, d.saving]))
  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0
  const y = (v: number) => height - padY - (v / max) * (height - padY * 2)
  const x = (i: number) => padX + i * stepX

  const line = (key: 'income' | 'expense' | 'saving') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d[key])}`).join(' ')

  const series: { key: 'income' | 'expense' | 'saving'; label: string }[] = [
    { key: 'income', label: '수입' },
    { key: 'expense', label: '지출' },
    { key: 'saving', label: '저축' },
  ]

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="월별 수입·지출·저축 추이 라인 차트">
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="var(--line)" strokeWidth={1} />
        {series.map(({ key }) => (
          <path key={key} d={line(key)} fill="none" stroke={colors[key]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {series.map(({ key }) =>
          data.map((d, i) => (
            <circle key={`${key}-${d.month}`} cx={x(i)} cy={y(d[key])} r={3} fill={colors[key]}>
              <title>{d.month} {key === 'income' ? '수입' : key === 'expense' ? '지출' : '저축'} {formatWon(d[key])}</title>
            </circle>
          ))
        )}
      </svg>
      <div className="budget-chart-legend">
        {series.map(({ key, label }) => (
          <span key={key}><span className="swatch" style={{ background: colors[key] }} />{label}</span>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
        {data.map((d) => <span key={d.month}>{d.month.slice(5)}월</span>)}
      </div>
    </div>
  )
}

// 예산 대비 실적 막대 — 카테고리별로 예산(연한 트랙)과 실제 지출(진한 막대)을 겹쳐 그린다.
export function BudgetBarChart({
  rows,
}: {
  rows: { id: string; name: string; spent: number; budgetAmount: number }[]
}) {
  if (rows.length === 0) return <p className="budget-chart-empty">예산이 설정된 카테고리가 없어요.</p>
  const max = Math.max(1, ...rows.map((r) => Math.max(r.spent, r.budgetAmount)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <div key={r.id}>
          <div className="budget-row" style={{ fontSize: 12.5 }}>
            <span>{r.name}</span>
            <span>{formatWon(r.spent)} / {formatWon(r.budgetAmount)}</span>
          </div>
          <svg viewBox="0 0 300 14" width="100%" height={14} role="img" aria-label={`${r.name} 예산 대비 지출`}>
            <rect x={0} y={2} width={300} height={10} rx={4} fill="var(--surface-2)" />
            <rect x={0} y={2} width={Math.min(1, r.budgetAmount / max) * 300} height={10} rx={4} fill="none" stroke="var(--ink-soft)" strokeWidth={1} />
            <rect x={0} y={2} width={Math.min(1, r.spent / max) * 300} height={10} rx={4} fill={r.spent > r.budgetAmount ? 'var(--danger)' : 'var(--burgundy)'}>
              <title>{r.name} 지출 {formatWon(r.spent)} / 예산 {formatWon(r.budgetAmount)}</title>
            </rect>
          </svg>
        </div>
      ))}
    </div>
  )
}
