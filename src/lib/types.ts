export type Role = 'USER' | 'OPERATOR' | 'ADMIN'

export type Profile = {
  userId: string
  email: string
  name: string
  role: Role
  avatar: string | null
}

export type Tag = {
  id: string
  name: string
  color: string
}

export type CalendarEvent = {
  id: string
  date: string // YYYY-MM-DD
  time: string | null
  title: string
  category: string | null
  userId: string
  tags: Tag[]
}

export type Comment = {
  id: string
  content: string
  createdAt: string // ISO timestamp (created)
  userId: string
  userName: string
}

export type Photo = {
  id: string
  date: string // 촬영일 (taken_dt)
  registeredDate: string // 등록일 (created, 업로드된 날짜)
  location: string | null
  caption: string | null
  // strpath(스토리지 경로)는 클라이언트로 내려보내지 않는다. 삭제 시 서버가
  // photo_id로 DB에서 직접 읽는다 — 클라이언트가 보낸 경로를 믿으면 안 된다.
  userId: string
  signedUrl: string
  comments: Comment[]
}

export type TxType = 'INCOME' | 'EXPENSE' | 'SAVING'

export type BudgetCategory = {
  id: string
  txType: TxType
  parentId: string | null
  name: string
}

export type BudgetTransaction = {
  id: string
  date: string // YYYY-MM-DD
  txType: TxType
  fixed: boolean
  categoryId: string
  amount: number
  cardId: string | null
  evaluation: '소비' | '낭비' | '투자' | null
  memo: string | null
  userId: string
}

export type BudgetCard = {
  id: string
  name: string
  ownerId: string | null
  ownerName: string | null
}

export type Budget = {
  id: string
  categoryId: string
  yearMonth: string // YYYY-MM
  amount: number
}
