import { describe, expect, it } from 'vitest'
import {
  buildTree,
  canonical,
  leafHash,
  sha256,
  verifyCard,
  verifyPath,
  type CardProof,
} from './proof.js'

describe('canonical', () => {
  it('не зависит от порядка ключей', () => {
    expect(canonical({ b: 1, a: { d: [2, 1], c: 'x' } })).toBe(
      canonical({ a: { c: 'x', d: [2, 1] }, b: 1 }),
    )
  })

  it('пропускает поля со значением undefined', () => {
    expect(canonical({ a: 1, b: undefined })).toBe('{"a":1}')
  })
})

describe('sha256', () => {
  it('совпадает с эталонным значением', async () => {
    expect(await sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('дерево Меркла', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, text: `карточка ${id}` }))

  it('путь каждого листа сходится к корню, в том числе у непарного', async () => {
    const leaves = await Promise.all(items.map(leafHash))
    const tree = await buildTree(leaves)
    for (const [index, leaf] of leaves.entries()) {
      expect(await verifyPath(leaf, tree.paths[index], tree.root)).toBe(true)
    }
  })

  it('чужой лист и чужой путь не сходятся', async () => {
    const leaves = await Promise.all(items.map(leafHash))
    const tree = await buildTree(leaves)
    expect(await verifyPath(leaves[0], tree.paths[1], tree.root)).toBe(false)
    expect(await verifyPath(await leafHash({ id: 'x' }), tree.paths[0], tree.root)).toBe(false)
  })

  it('одна карточка — сама себе корень', async () => {
    const leaf = await leafHash(items[0])
    const tree = await buildTree([leaf])
    expect(tree.root).toBe(leaf)
    expect(tree.paths[0]).toEqual([])
  })
})

describe('verifyCard', () => {
  const card = { id: 'job-star', text: 'STAR' }

  async function setup(check?: Partial<NonNullable<CardProof['check']>>) {
    const hash = await leafHash(card)
    const other = await leafHash({ id: 'other' })
    const tree = await buildTree([hash, other])
    const proof: CardProof = {
      hash,
      path: tree.paths[0],
      check: {
        kind: 'quote',
        ok: true,
        checkedAt: '2026-11-13',
        checkedHash: hash,
        detail: '',
        ...check,
      },
    }
    return { proof, root: tree.root }
  }

  it('подтверждает неизменённую проверенную карточку', async () => {
    const { proof, root } = await setup()
    expect((await verifyCard(card, proof, root)).verdict).toBe('verified')
  })

  it('замечает правку текста карточки', async () => {
    const { proof, root } = await setup()
    expect((await verifyCard({ ...card, text: 'STAR!' }, proof, root)).verdict).toBe('changed')
  })

  it('не засчитывает проверку, сделанную для другой версии', async () => {
    const { proof, root } = await setup({ checkedHash: 'старый' })
    expect((await verifyCard(card, proof, root)).verdict).toBe('unchecked')
  })

  it('замечает подменённый корень', async () => {
    const { proof } = await setup()
    expect((await verifyCard(card, proof, 'f'.repeat(64))).verdict).toBe('outside')
  })
})
