export type Role = 'USER' | 'OPERATOR' | 'ADMIN'

export type Profile = {
  userId: string
  email: string
  name: string
  role: Role
  avatar: string | null
}

export type CalendarEvent = {
  id: string
  date: string // YYYY-MM-DD
  time: string | null
  title: string
  category: string | null
  userId: string
}

export type Photo = {
  id: string
  date: string
  location: string | null
  caption: string | null
  path: string
  userId: string
  signedUrl: string
}
