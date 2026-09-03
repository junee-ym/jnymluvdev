import type { BudgetCategory, TxType } from '@/lib/types'

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

export function yearMonthRange(yearMonth: string): { start: string; end: string } {
  const [yearStr, monthStr] = yearMonth.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const lastDay = new Date(year, month, 0).getDate()
  return { start: `${yearMonth}-01`, end: `${yearMonth}-${String(lastDay).padStart(2, '0')}` }
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [yearStr, monthStr] = yearMonth.split('-')
  const date = new Date(Number(yearStr), Number(monthStr) - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
