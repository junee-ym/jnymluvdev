export type DayCell = {
  date: Date
  dateKey: string
  inCurrentMonth: boolean
}

export function formatDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function buildMonthGrid(year: number, month: number): DayCell[] {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const cells: DayCell[] = []

  for (let i = firstDow - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, daysInPrevMonth - i)
    cells.push({ date, dateKey: formatDateKey(date), inCurrentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    cells.push({ date, dateKey: formatDateKey(date), inCurrentMonth: true })
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date
    const date = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
    cells.push({ date, dateKey: formatDateKey(date), inCurrentMonth: false })
  }

  return cells
}

export function buildWeekGrid(referenceDate: Date): Date[] {
  const start = new Date(referenceDate)
  start.setDate(referenceDate.getDate() - referenceDate.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}
