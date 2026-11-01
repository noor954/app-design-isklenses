'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, RotateCcw, Save } from 'lucide-react'
import { getContentAdmin, saveSetting } from '@/app/actions/content'
import { ContentManager } from '@/components/admin/content-manager'
import {
  APPEARANCE_CHOICES,
  APP_PALETTES,
  DEFAULT_APPEARANCE,
  DEFAULT_HOME_CONFIGURATION,
  HOME_SECTION_DEFAULTS,
  normalizeAppearance,
  normalizeHomeConfiguration,
  type AppearanceConfiguration,
  type HomeConfiguration,
  type HomeSectionConfiguration,
  type HomeSectionId,
} from '@/lib/home-configuration'
import { reportError } from '@/lib/ui/notifications'

type DesignKey = keyof AppearanceConfiguration

const fieldClass =
  'mt-1 w-full rounded-xl border border-[#cfe2eb] bg-white px-3 py-2.5 text-sm text-[#15384d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5] disabled:opacity-60'

const appearanceFieldLabels: Record<DesignKey, string> = {
  palette: 'Color palette',
  button: 'Buttons',
  textbox: 'Text fields',
  menu: 'Menus and dropdowns',
  navigation: 'Navigation',
}

const appearanceSuggestions = {
  button: ['Rounded pill', 'Soft corners', 'Square', 'Outlined', 'Soft fill'],
  textbox: ['Rounded', 'Pill', 'Underline', 'Filled', 'Square'],
  menu: ['Panel', 'Compact', 'Underline', 'Segmented', 'Floating'],
  navigation: ['Classic', 'Underline', 'Capsule', 'Boxed', 'Minimal'],
} satisfies Record<Exclude<DesignKey, 'palette'>, string[]>

export function HomeDesignManager({ canEdit }: { canEdit: boolean }) {
  const [appearance, setAppearance] =
    useState<AppearanceConfiguration>(DEFAULT_APPEARANCE)
  const [home, setHome] = useState<HomeConfiguration>(
    DEFAULT_HOME_CONFIGURATION,
  )
  const [newSection, setNewSection] = useState<HomeSectionId | ''>('')
  const [savingAppearance, setSavingAppearance] = useState(false)
  const [savingHome, setSavingHome] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  const load = useCallback(async () => {
    try {
      const content = await getContentAdmin()
      setAppearance(normalizeAppearance(content.settings.appearance))
      setHome(normalizeHomeConfiguration(content.settings.home_configuration))
      setError('')
    } catch (loadError) {
      setError(reportError(loadError, 'Homepage settings could not be loaded.'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function updateSection(id: HomeSectionId, patch: Partial<HomeSectionConfiguration>) {
    setHome((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === id ? { ...section, ...patch } : section,
      ),
    }))
  }

  function moveSection(id: HomeSectionId, offset: -1 | 1) {
    setHome((current) => {
      const sections = [...current.sections].sort((a, b) => a.order - b.order)
      const index = sections.findIndex((section) => section.id === id)
      const target = index + offset
      if (index < 0 || target < 0 || target >= sections.length) return current
      ;[sections[index], sections[target]] = [sections[target], sections[index]]
      return {
        ...current,
        sections: sections.map((section, order) => ({ ...section, order })),
      }
    })
  }

  function addSection() {
    if (!newSection) return
    const defaults = HOME_SECTION_DEFAULTS.find(
      (section) => section.id === newSection,
    )
    if (!defaults) return
    setHome((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          ...defaults,
          enabled: true,
          order: current.sections.length,
        },
      ],
    }))
    setNewSection('')
  }

  function removeSection(id: HomeSectionId) {
    setHome((current) => ({
      ...current,
      sections: current.sections
        .filter((section) => section.id !== id)
        .map((section, order) => ({ ...section, order })),
    }))
  }

  async function saveAppearance() {
    setSavingAppearance(true)
    setError('')
    setSaved('')
    try {
      await saveSetting('appearance', appearance)
      setSaved('Theme and control styles saved for web, Android, and iOS.')
    } catch (saveError) {
      setError(reportError(saveError, 'Appearance could not be saved.'))
    } finally {
      setSavingAppearance(false)
    }
  }

  async function saveHome() {
    setSavingHome(true)
    setError('')
    setSaved('')
    try {
      await saveSetting('home_configuration', home)
      setSaved('Homepage order and content saved for web, Android, and iOS.')
    } catch (saveError) {
      setError(reportError(saveError, 'Homepage configuration could not be saved.'))
    } finally {
      setSavingHome(false)
    }
  }

  const configuredIds = new Set(home.sections.map((section) => section.id))
  const availableSections = HOME_SECTION_DEFAULTS.filter(
    (section) => !configuredIds.has(section.id),
  )

  return (
    <section className="min-w-0 flex-1 space-y-8" aria-labelledby="home-design-heading">
      <header>
        <h1 id="home-design-heading" className="text-2xl font-semibold tracking-tight">
          Home and design
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526b7b]">
          Edit hero slides, homepage sections, and the shared visual system here.
          Saved changes are read by the website and mobile apps from the same API.
        </p>
      </header>

      {!canEdit && (
        <p role="status" className="rounded-xl border border-[#cfe2eb] bg-[#e8f6fb] p-3 text-sm">
          Staff accounts can view these settings but cannot change them.
        </p>
      )}
      {error && <p role="alert" className="rounded-xl bg-[#fff1f0] p-3 text-sm text-[#9f1d2c]">{error}</p>}
      {saved && <p role="status" className="rounded-xl bg-[#e8f6fb] p-3 text-sm text-[#15384d]">{saved}</p>}

      <section aria-labelledby="hero-slides-heading" className="space-y-4">
        <div>
          <h2 id="hero-slides-heading" className="text-lg font-semibold">Hero banner slider</h2>
          <p className="mt-1 text-sm text-[#526b7b]">
            These slides are the canonical set for both the website and mobile apps.
          </p>
        </div>
        <ContentManager heroOnly canEdit={canEdit} />
      </section>

      <section aria-labelledby="appearance-heading" className="space-y-5">
        <header>
          <h2 id="appearance-heading" className="text-lg font-semibold">Shared theme and controls</h2>
          <p className="mt-1 text-sm text-[#526b7b]">
            Four sky-family palettes and five design treatments for each shared control group.
          </p>
        </header>
        <fieldset disabled={!canEdit || savingAppearance} className="space-y-5 disabled:opacity-70">
          <legend className="sr-only">Application appearance</legend>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(APP_PALETTES).map(([id, palette]) => (
              <button
                key={id}
                type="button"
                aria-pressed={appearance.palette === id}
                onClick={() => setAppearance((current) => ({
                  ...current,
                  palette: id as AppearanceConfiguration['palette'],
                }))}
                className={`rounded-2xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5] ${appearance.palette === id ? 'border-[#006f9b] ring-2 ring-[#087ba5]/20' : 'border-[#cfe2eb]'}`}
              >
                <span className="mb-3 flex gap-2" aria-hidden="true">
                  {[palette.ink, palette.sky, palette.primary, palette.light, palette.paper].map((color) => (
                    <span key={color} className="size-7 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                  ))}
                </span>
                <span className="font-semibold">{palette.label}</span>
                {appearance.palette === id && <span className="ml-2 text-xs text-[#006f9b]">Active everywhere</span>}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(Object.keys(appearanceFieldLabels) as DesignKey[])
              .filter((key) => key !== 'palette')
              .map((key) => (
                <label key={key} className="text-sm font-medium">
                  {appearanceFieldLabels[key]}
                  <select
                    className={fieldClass}
                    value={appearance[key]}
                    onChange={(event) => setAppearance((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))}
                  >
                    {APPEARANCE_CHOICES[key].map((value, index) => (
                      <option key={value} value={value}>
                        {appearanceSuggestions[key][index]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            <label className="text-sm font-medium">
              Hero layout
              <select
                className={fieldClass}
                value={home.heroLayout}
                onChange={(event) => setHome((current) => ({
                  ...current,
                  heroLayout: event.target.value as HomeConfiguration['heroLayout'],
                }))}
              >
                <option value="full-bleed">Full-bleed image</option>
                <option value="centered">Centered message</option>
                <option value="split">Split image and copy</option>
                <option value="editorial">Editorial copy-led</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={!canEdit || savingAppearance} onClick={() => void saveAppearance()} className="inline-flex items-center gap-2 rounded-full bg-[#006f9b] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              <Save size={16} aria-hidden="true" />{savingAppearance ? 'Saving…' : 'Save theme and controls'}
            </button>
            <button type="button" disabled={!canEdit || savingAppearance} onClick={() => setAppearance(DEFAULT_APPEARANCE)} className="inline-flex items-center gap-2 rounded-full border border-[#cfe2eb] px-4 py-2.5 text-sm font-medium">
              <RotateCcw size={15} aria-hidden="true" />Use sky-blue defaults
            </button>
          </div>
        </fieldset>
      </section>

      <section aria-labelledby="home-sections-heading" className="space-y-5">
        <header>
          <h2 id="home-sections-heading" className="text-lg font-semibold">Homepage sections</h2>
          <p className="mt-1 text-sm text-[#526b7b]">
            Reorder, hide, add back, or edit the content of each supported homepage section.
          </p>
        </header>
        <div className="space-y-3">
          {[...home.sections].sort((a, b) => a.order - b.order).map((section, index, sections) => {
            const suggestion = HOME_SECTION_DEFAULTS.find(({ id }) => id === section.id)!
            return (
              <article key={section.id} className="grid gap-4 rounded-2xl border border-[#cfe2eb] bg-white p-4 lg:grid-cols-[minmax(150px,0.5fr)_minmax(0,1.5fr)_auto]">
                <div>
                  <h3 className="font-semibold">{suggestion.label}</h3>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" disabled={!canEdit} checked={section.enabled} onChange={(event) => updateSection(section.id, { enabled: event.target.checked })} />
                    Show on homepage
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-[#526b7b]">
                    Heading
                    <input disabled={!canEdit} maxLength={200} value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} className={fieldClass} />
                  </label>
                  <label className="text-xs font-medium text-[#526b7b]">
                    Supporting text
                    <textarea disabled={!canEdit} maxLength={500} rows={2} value={section.description} onChange={(event) => updateSection(section.id, { description: event.target.value })} className={fieldClass} />
                  </label>
                </div>
                <div className="flex items-start gap-2 lg:flex-col">
                  <button type="button" disabled={!canEdit || index === 0} onClick={() => moveSection(section.id, -1)} aria-label={`Move ${suggestion.label} up`} className="rounded-lg border border-[#cfe2eb] p-2 disabled:opacity-40"><ArrowUp size={16} /></button>
                  <button type="button" disabled={!canEdit || index === sections.length - 1} onClick={() => moveSection(section.id, 1)} aria-label={`Move ${suggestion.label} down`} className="rounded-lg border border-[#cfe2eb] p-2 disabled:opacity-40"><ArrowDown size={16} /></button>
                  <button type="button" disabled={!canEdit} onClick={() => updateSection(section.id, { title: suggestion.title, description: suggestion.description, enabled: true })} className="rounded-lg border border-[#cfe2eb] px-2 py-2 text-xs">Suggestion</button>
                  <button type="button" disabled={!canEdit} onClick={() => removeSection(section.id)} className="rounded-lg border border-[#cfe2eb] px-2 py-2 text-xs text-[#9f1d2c]">Remove</button>
                </div>
              </article>
            )
          })}
          {availableSections.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="add-home-section">Add homepage section</label>
              <select id="add-home-section" value={newSection} onChange={(event) => setNewSection(event.target.value as HomeSectionId | '')} className={fieldClass}>
                <option value="">Add a homepage section…</option>
                {availableSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
              </select>
              <button type="button" disabled={!canEdit || !newSection} onClick={addSection} className="rounded-full border border-[#cfe2eb] px-4 py-2 text-sm font-semibold disabled:opacity-50">Add section</button>
            </div>
          )}
        </div>

        <label className="block max-w-sm text-sm font-medium">
          Hero auto-advance (milliseconds)
          <input
            disabled={!canEdit}
            type="number"
            min={3000}
            max={15000}
            step={500}
            value={home.heroAutoplayMs}
            onChange={(event) => setHome((current) => ({
              ...current,
              heroAutoplayMs: Number(event.target.value),
            }))}
            className={fieldClass}
          />
        </label>
        <button type="button" disabled={!canEdit || savingHome} onClick={() => void saveHome()} className="inline-flex items-center gap-2 rounded-full bg-[#006f9b] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          <Save size={16} aria-hidden="true" />{savingHome ? 'Saving…' : 'Save homepage configuration'}
        </button>
      </section>
    </section>
  )
}
