import { describe, expect, it } from 'vitest'
import { canModify, isOperatorOrAdmin } from './permissions'

describe('isOperatorOrAdmin', () => {
  it('USER는 false', () => {
    expect(isOperatorOrAdmin('USER')).toBe(false)
  })
  it('OPERATOR는 true', () => {
    expect(isOperatorOrAdmin('OPERATOR')).toBe(true)
  })
  it('ADMIN은 true', () => {
    expect(isOperatorOrAdmin('ADMIN')).toBe(true)
  })
})

describe('canModify', () => {
  it('본인 소유 데이터는 USER도 수정 가능', () => {
    expect(canModify('u1', 'u1', 'USER')).toBe(true)
  })
  it('타인 소유 데이터는 USER가 수정 불가', () => {
    expect(canModify('u1', 'u2', 'USER')).toBe(false)
  })
  it('타인 소유 데이터도 OPERATOR는 수정 가능', () => {
    expect(canModify('u1', 'u2', 'OPERATOR')).toBe(true)
  })
})
