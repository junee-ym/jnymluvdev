import type { BudgetCard, BudgetCategory, BudgetTransaction, TxType } from '@/lib/types'

export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

// 금액 입력창은 콤마(1,000)를 표시해주므로 서버에서 숫자로 바꿀 때 콤마를 지운다.
export function parseAmount(value: FormDataEntryValue | null): number {
  return Number(String(value ?? '').replace(/,/g, ''))
}

export function calcSavings(totalIncome: number, totalExpense: number): { amount: number; rate: number } {
  const amount = totalIncome - totalExpense
  const rate = totalIncome > 0 ? (amount / totalIncome) * 100 : 0
  return { amount, rate }
}

export function calcBudgetUsage(spent: number, budget: number): number {
  if (budget <= 0) return 0
  return (spent / budget) * 100
}

export type CategoryNode = {
  id: string
  name: string
  txType: TxType
  children: CategoryNode[]
}

export function buildCategoryTree(categories: BudgetCategory[]): CategoryNode[] {
  const nodeById = new Map<string, CategoryNode>()
  for (const c of categories) {
    nodeById.set(c.id, { id: c.id, name: c.name, txType: c.txType, children: [] })
  }
  const roots: CategoryNode[] = []
  for (const c of categories) {
    const node = nodeById.get(c.id)!
    if (c.parentId && nodeById.has(c.parentId)) {
      nodeById.get(c.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export function flattenCategoryTree(
  nodes: CategoryNode[],
  depth = 0
): { id: string; name: string; depth: number }[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenCategoryTree(node.children, depth + 1),
  ])
}

export function collectSubtreeIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(collectSubtreeIds)]
}

// 서버(UTC)와 브라우저(로컬)가 각자 "이번 달"을 계산하면 자정 근처(KST 00~09시)에
// 서로 다른 달을 답할 수 있다 — 항상 KST 기준으로 통일해 하나의 함수로 판정한다.
export function currentYearMonthKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`
}

export function yearMonthRange(yearMonth: string): { start: string; end: string } {
  const [yearStr, monthStr] = yearMonth.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const lastDay = new Date(year, month, 0).getDate()
  return { start: `${yearMonth}-01`, end: `${yearMonth}-${String(lastDay).padStart(2, '0')}` }
}

// 최근 N개월 추이 차트용 — 거래를 월별로 묶어 수입/지출/저축 합계를 낸다. 거래가 없는
// 달도 0으로 채워야 라인이 끊기지 않는다.
export function monthlyTotals(
  transactions: Pick<BudgetTransaction, 'date' | 'txType' | 'amount'>[],
  months: string[]
): { month: string; income: number; expense: number; saving: number }[] {
  return months.map((month) => {
    const inMonth = transactions.filter((t) => t.date.startsWith(month))
    const sum = (type: TxType) => inMonth.filter((t) => t.txType === type).reduce((s, t) => s + t.amount, 0)
    return { month, income: sum('INCOME'), expense: sum('EXPENSE'), saving: sum('SAVING') }
  })
}

// 카테고리별 지출 비중 도넛용 — 'top'은 대분류 조상까지 올려서, 'leaf'는 거래에 찍힌
// 카테고리 그대로 묶는다. 금액 내림차순 정렬 후 limit을 넘는 나머지는 "기타"로 접는다.
export function expenseBreakdown(
  transactions: Pick<BudgetTransaction, 'txType' | 'categoryId' | 'amount'>[],
  categories: BudgetCategory[],
  level: 'top' | 'leaf',
  limit: number
): { id: string; name: string; amount: number }[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const topAncestorId = (id: string): string => {
    const category = byId.get(id)
    if (!category || !category.parentId) return id
    return topAncestorId(category.parentId)
  }

  const totals = new Map<string, number>()
  for (const t of transactions) {
    if (t.txType !== 'EXPENSE') continue
    const groupId = level === 'top' ? topAncestorId(t.categoryId) : t.categoryId
    totals.set(groupId, (totals.get(groupId) ?? 0) + t.amount)
  }

  const sorted = [...totals.entries()]
    .map(([id, amount]) => ({ id, name: byId.get(id)?.name ?? '(삭제됨)', amount }))
    .sort((a, b) => b.amount - a.amount)

  if (sorted.length <= limit) return sorted
  const head = sorted.slice(0, limit)
  const otherAmount = sorted.slice(limit).reduce((s, row) => s + row.amount, 0)
  return [...head, { id: '__other__', name: '기타', amount: otherAmount }]
}

// 사용자별 지출 도넛용 — 거래의 카드를 통해 소유자(가족 구성원 또는 자유 텍스트)를 찾아 합산한다.
// id는 "user:<userId>" / "text:<이름>" / "__unassigned__" 세 형태 중 하나로,
// 색 배정은 호출 측(컴포넌트)이 이 접두사로 구분해 처리한다.
export function expenseByOwner(
  transactions: Pick<BudgetTransaction, 'txType' | 'cardId' | 'amount'>[],
  cards: Pick<BudgetCard, 'id' | 'ownerId' | 'ownerName'>[],
  familyMembers: { userId: string; name: string }[]
): { id: string; name: string; amount: number }[] {
  const cardById = new Map(cards.map((c) => [c.id, c]))
  const memberNameById = new Map(familyMembers.map((m) => [m.userId, m.name]))

  const totals = new Map<string, { name: string; amount: number }>()
  for (const t of transactions) {
    if (t.txType !== 'EXPENSE') continue
    const card = t.cardId ? cardById.get(t.cardId) : undefined
    const key = card?.ownerId
      ? `user:${card.ownerId}`
      : card?.ownerName
        ? `text:${card.ownerName}`
        : '__unassigned__'
    const name = card?.ownerId
      ? (memberNameById.get(card.ownerId) ?? '(삭제됨)')
      : card?.ownerName ?? '미지정'
    const prev = totals.get(key)
    totals.set(key, { name, amount: (prev?.amount ?? 0) + t.amount })
  }

  return [...totals.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.amount - a.amount)
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [yearStr, monthStr] = yearMonth.split('-')
  const date = new Date(Number(yearStr), Number(monthStr) - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
