import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type IconMap = Record<string, LucideIcon>

/** Icons rendered at first, and added each time the list is scrolled to its end. */
const PAGE_SIZE = 120

type TagMap = Record<string, string>

interface IconSelectProps {
  /** The selected icon's Lucide component name, e.g. `"Utensils"`; empty for none. */
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder: string
  readonly disabled?: boolean
  readonly className?: string
}

/** `"ArrowRightLeft"` -> `"arrow right left"`, so searches match whole words. */
const words = (name: string) =>
  name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').toLowerCase()

/** The icon's key in Lucide's tag data: `"Gamepad2"` -> `"gamepad-2"`. */
const tagKey = (name: string) => words(name).replaceAll(' ', '-')

/**
 * Rank one search term against an icon, as lucide.dev does: by name and by tag.
 * Lower is better: 0 whole word in the name, 1 name prefix, 2 whole tag,
 * 3 tag prefix, 4 substring of the name. -1 means no match.
 */
function rankTerm(nameWords: string[], tags: string[], term: string): number {
  if (nameWords.includes(term)) return 0
  if (nameWords.some((w) => w.startsWith(term))) return 1
  if (tags.includes(term)) return 2
  if (tags.some((t) => t.startsWith(term) || t.split(' ').some((w) => w.startsWith(term)))) return 3
  if (nameWords.join('').includes(term)) return 4
  return -1
}

function rank(name: string, tagText: string | undefined, terms: string[]): number {
  const nameWords = words(name).split(' ')
  const tags = tagText ? tagText.split(',') : []
  let worst = 0
  for (const term of terms) {
    const score = rankTerm(nameWords, tags, term)
    if (score < 0) return -1
    worst = Math.max(worst, score)
  }
  return worst
}

/**
 * A dropdown of every Lucide icon with a search field over names and tags (the
 * same data lucide.dev searches). The icon set and tag data are large, so they
 * are loaded on first mount rather than shipped with the page bundle, and the
 * grid renders a page at a time.
 */
export function IconSelect({ value, onChange, placeholder, disabled = false, className = '' }: IconSelectProps) {
  const [icons, setIcons] = useState<IconMap | null>(null)
  const [tags, setTags] = useState<TagMap>({})
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    import('lucide-react').then((mod) => {
      if (!cancelled) setIcons(mod.icons as unknown as IconMap)
    })
    import('@/lib/lucide-icon-tags.json').then((mod) => {
      if (!cancelled) setTags(mod.default as TagMap)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const results = useMemo(() => {
    if (!icons) return []
    const names = Object.keys(icons)
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return names

    return names
      .map((name) => ({ name, score: rank(name, tags[tagKey(name)], terms) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score || a.name.length - b.name.length)
      .map((r) => r.name)
  }, [icons, tags, query])

  const SelectedIcon = icons && value ? icons[value] : undefined

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        className={`w-full px-4 py-3 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none text-base ${disabled ? 'opacity-50 cursor-not-allowed bg-muted' : 'cursor-pointer'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-1 min-w-0 items-center">
            {SelectedIcon && <SelectedIcon size={18} className="mr-3 text-muted-foreground flex-shrink-0" />}
            <span className={`truncate ${value ? '' : 'text-muted-foreground'}`}>{value || placeholder}</span>
          </div>
          <ChevronDown
            size={20}
            className={`ml-2 text-muted-foreground transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
          <div className="relative border-b border-gray-200 dark:border-gray-700">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setVisibleCount(PAGE_SIZE)
              }}
              placeholder="Search icons"
              aria-label="Search icons"
              className="w-full h-11 pl-9 pr-3 bg-transparent text-base focus:outline-none"
            />
          </div>

          <div
            className="max-h-60 overflow-auto p-2"
            onScroll={(e) => {
              const el = e.currentTarget
              if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
                setVisibleCount((n) => Math.min(n + PAGE_SIZE, results.length))
              }
            }}
          >
            {!icons ? (
              <p className="m-0 p-3 text-sm text-muted-foreground">Loading icons…</p>
            ) : results.length === 0 ? (
              <p className="m-0 p-3 text-sm text-muted-foreground">No icons match “{query}”.</p>
            ) : (
              <div className="grid grid-cols-6 gap-1">
                {results.slice(0, visibleCount).map((name) => {
                  const Icon = icons[name]
                  const isSelected = name === value
                  return (
                    <button
                      key={name}
                      type="button"
                      title={words(name)}
                      aria-label={words(name)}
                      onClick={() => {
                        onChange(name)
                        setIsOpen(false)
                        setQuery('')
                      }}
                      className={`flex h-10 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground ${isSelected ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                    >
                      <Icon size={20} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
