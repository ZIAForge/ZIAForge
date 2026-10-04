/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MarkdownMessage } from '../MarkdownMessage'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('assistant Markdown display', () => {
  it('renders report structure, nested lists, GFM tables/tasks and literal code', () => {
    const { container } = render(<MarkdownMessage text={'### Состояние MacBook\n\n**Модель:** `MacBookPro16,1`\n\n* Память: **64 GB**\n  * Доступна\n\n1. Проверить\n2. Продолжить\n\n> Только чтение\n\n---\n\n| Параметр | Значение |\n| --- | --- |\n| CPU | Intel |\n\n- [x] Проверено\n- [ ] ~~Устарело~~\n\n```sh\nprintf "<b>**literal**</b>"\n```'} />)
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Состояние MacBook')
    expect(container.querySelector('strong')?.textContent).toBe('Модель:')
    expect(container.querySelector('ul ul li')?.textContent).toBe('Доступна')
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
    expect(screen.getByRole('table').textContent).toContain('CPU')
    expect(container.querySelector('blockquote')?.textContent).toContain('Только чтение')
    expect(container.querySelector('hr')).not.toBeNull()
    expect(container.querySelector('del')?.textContent).toBe('Устарело')
    expect(screen.getAllByRole('checkbox').every(input => (input as HTMLInputElement).disabled)).toBe(true)
    expect(container.querySelector('pre code')?.textContent).toBe('printf "<b>**literal**</b>"\n')
    expect(container.querySelector('pre strong')).toBeNull()
  })

  it('keeps model HTML inert and never fetches images or creates unsafe links', () => {
    const { container } = render(<MarkdownMessage text={'<script>alert(1)</script>\n\n<iframe src="https://example.com"></iframe>\n\n<img src=x onerror=alert(1)>\n\n![private image](https://example.com/tracker.png)\n\n[script](javascript:alert%281%29) [file](file:///etc/passwd) [data](data:text/html,test) [credentials](https://user:pass@example.com) [relative](./README.md)'} />)
    expect(container.querySelector('script, iframe, img, a')).toBeNull()
    expect(container.textContent).toContain('<script>alert(1)</script>')
    expect(container.textContent).toContain('private image')
    expect(container.textContent).toContain('file')
  })

  it('opens valid links only through the existing external-link IPC and reports a failure', async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('ziafAPI', { openExternal })
    render(<MarkdownMessage text={'[Документация](https://example.com/docs)'} />)
    const link = screen.getByRole('link', { name: 'Документация' })
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    fireEvent(link, click)
    expect(click.defaultPrevented).toBe(true)
    expect(openExternal).toHaveBeenCalledExactlyOnceWith('https://example.com/docs')
    openExternal.mockRejectedValueOnce(new Error('Browser unavailable'))
    fireEvent.click(link)
    await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull())
    expect(link.getAttribute('href')).toBe('https://example.com/docs')
  })
})
