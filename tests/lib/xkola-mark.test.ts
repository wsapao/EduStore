import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { XkolaMark } from '@/components/brand/XkolaMark'

describe('XkolaMark', () => {
  it('renderiza a marca da Xkola sem recipiente arredondado ou fundo proprio', () => {
    const markup = renderToStaticMarkup(createElement(XkolaMark))

    expect(markup).toContain('/xkola-mark.png')
    expect(markup).not.toContain('border-radius')
    expect(markup).not.toContain('background:')
  })
})
