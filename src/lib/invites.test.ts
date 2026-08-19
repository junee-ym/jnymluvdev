import { describe, expect, it } from 'vitest'
import { acceptInvite } from './invites'

describe('acceptInvite', () => {
  it('PENDING이면 ACCEPTED로 전이한다', () => {
    expect(acceptInvite('PENDING')).toBe('ACCEPTED')
  })
  it('이미 ACCEPTED면 에러를 던진다', () => {
    expect(() => acceptInvite('ACCEPTED')).toThrow('이미 처리된 초대입니다')
  })
})
