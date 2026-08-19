export type InviteStatus = 'PENDING' | 'ACCEPTED'

export function acceptInvite(status: InviteStatus): InviteStatus {
  if (status !== 'PENDING') {
    throw new Error('이미 처리된 초대입니다')
  }
  return 'ACCEPTED'
}
