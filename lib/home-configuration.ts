export const HOME_SECTION_DEFAULTS = [
  {
    id: 'hero',
    label: 'Hero banner',
    title: 'Featured lens collections',
    description: 'Lead with the shared, editable banner slider.',
  },
  {
    id: 'showcase',
    label: 'Showcase',
    title: 'Made to be seen',
    description: 'Big, image-led highlights from the featured catalog.',
  },
  {
    id: 'bloom',
    label: 'Categories',
    title: 'Browse collections',
    description: 'Shop active product categories from the catalog.',
  },
  {
    id: 'shades',
    label: 'Lens shades',
    title: 'Shop by shade',
    description: 'Browse available lens colors and active listings.',
  },
  {
    id: 'trending',
    label: 'Catalog',
    title: 'Browse the catalog',
    description: 'Product details and prices come from active listings.',
  },
  {
    id: 'brands',
    label: 'Brands',
    title: 'Shop by brand',
    description: 'Explore a selection from the full brand directory.',
  },
  {
    id: 'types',
    label: 'Lens types',
    title: 'Shop by lens type',
    description: 'Browse the lens types linked to active listings.',
  },
  {
    id: 'why-us',
    label: 'Shopping guidance',
    title: 'Browse with confidence',
    description:
      'Review listing details and consult your eye-care professional about suitability.',
  },
  {
    id: 'reviews',
    label: 'Product reviews',
    title: 'Product reviews',
    description: 'Approved reviews linked to active products.',
  },
  {
    id: 'contact',
    label: 'Contact and footer',
    title: 'Questions about a listing or an order?',
    description:
      'Contact the store about catalog or order questions. Follow professional guidance for lens suitability.',
  },
] as const

export type HomeSectionId = (typeof HOME_SECTION_DEFAULTS)[number]['id']

export interface HomeSectionConfiguration {
  id: HomeSectionId
  enabled: boolean
  order: number
  title: string
  description: string
}

export interface HomeConfiguration {
  sections: HomeSectionConfiguration[]
  heroAutoplayMs: number
  heroLayout: 'full-bleed' | 'centered' | 'split' | 'editorial'
}

export const DEFAULT_HOME_CONFIGURATION: HomeConfiguration = {
  sections: HOME_SECTION_DEFAULTS.map((section, order) => ({
    ...section,
    enabled: true,
    order,
  })),
  heroAutoplayMs: 5500,
  heroLayout: 'full-bleed',
}

export const APP_PALETTES = {
  sky: {
    label: 'Sky blue',
    ink: '#15384d',
    sky: '#087ba5',
    primary: '#006f9b',
    light: '#b8e8f5',
    surface: '#e8f6fb',
    paper: '#f7fcff',
    muted: '#526b7b',
    rule: '#cfe2eb',
  },
  clear: {
    label: 'Clear sky',
    ink: '#15384d',
    sky: '#1686ad',
    primary: '#087ba5',
    light: '#c3eff8',
    surface: '#eaf8fc',
    paper: '#fbfeff',
    muted: '#526b7b',
    rule: '#c6e4ed',
  },
  lagoon: {
    label: 'Lagoon',
    ink: '#123d4c',
    sky: '#087e8b',
    primary: '#08727c',
    light: '#b7eee8',
    surface: '#e5f7f5',
    paper: '#f7fdfc',
    muted: '#4d6d73',
    rule: '#c6e4e0',
  },
  ocean: {
    label: 'Deep ocean',
    ink: '#14364f',
    sky: '#237da6',
    primary: '#12658d',
    light: '#c1e6f4',
    surface: '#e9f4f9',
    paper: '#f8fcff',
    muted: '#526b7b',
    rule: '#c8dfe9',
  },
} as const

export type PaletteId = keyof typeof APP_PALETTES
export type ButtonStyle = 'pill' | 'rounded' | 'square' | 'outline' | 'soft'
export type TextboxStyle = 'rounded' | 'pill' | 'underline' | 'filled' | 'square'
export type MenuStyle = 'panel' | 'compact' | 'underline' | 'segmented' | 'floating'
export type NavigationStyle =
  | 'classic'
  | 'underline'
  | 'capsule'
  | 'boxed'
  | 'minimal'

export interface AppearanceConfiguration {
  palette: PaletteId
  button: ButtonStyle
  textbox: TextboxStyle
  menu: MenuStyle
  navigation: NavigationStyle
}

export const DEFAULT_APPEARANCE: AppearanceConfiguration = {
  palette: 'sky',
  button: 'pill',
  textbox: 'rounded',
  menu: 'panel',
  navigation: 'underline',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isChoice = <T extends string>(
  value: unknown,
  choices: readonly T[],
): value is T => typeof value === 'string' && choices.includes(value as T)

const BUTTON_STYLES = ['pill', 'rounded', 'square', 'outline', 'soft'] as const
const TEXTBOX_STYLES = ['rounded', 'pill', 'underline', 'filled', 'square'] as const
const MENU_STYLES = ['panel', 'compact', 'underline', 'segmented', 'floating'] as const
const NAVIGATION_STYLES = ['classic', 'underline', 'capsule', 'boxed', 'minimal'] as const
const HERO_LAYOUTS = ['full-bleed', 'centered', 'split', 'editorial'] as const

export function normalizeAppearance(value: unknown): AppearanceConfiguration {
  if (!isRecord(value)) return DEFAULT_APPEARANCE
  return {
    palette: isChoice(value.palette, Object.keys(APP_PALETTES) as PaletteId[])
      ? value.palette
      : DEFAULT_APPEARANCE.palette,
    button: isChoice(value.button, BUTTON_STYLES) ? value.button : DEFAULT_APPEARANCE.button,
    textbox: isChoice(value.textbox, TEXTBOX_STYLES) ? value.textbox : DEFAULT_APPEARANCE.textbox,
    menu: isChoice(value.menu, MENU_STYLES) ? value.menu : DEFAULT_APPEARANCE.menu,
    navigation: isChoice(value.navigation, NAVIGATION_STYLES)
      ? value.navigation
      : DEFAULT_APPEARANCE.navigation,
  }
}

export function normalizeHomeConfiguration(value: unknown): HomeConfiguration {
  if (!isRecord(value)) return DEFAULT_HOME_CONFIGURATION
  const hasSavedSections = Array.isArray(value.sections)
  const configuredSections: unknown[] = Array.isArray(value.sections) ? value.sections : []
  const sections = HOME_SECTION_DEFAULTS.flatMap((defaults, fallbackOrder) => {
    const saved = configuredSections.find(
      (section) => isRecord(section) && section.id === defaults.id,
    )
    if (!isRecord(saved)) {
      return hasSavedSections ? [] : [{ ...defaults, enabled: true, order: fallbackOrder }]
    }
    return [{
      ...defaults,
      enabled: saved.enabled !== false,
      order:
        typeof saved.order === 'number' && Number.isInteger(saved.order)
          ? saved.order
          : fallbackOrder,
      title:
        typeof saved.title === 'string' && saved.title.length <= 200
          ? saved.title
          : defaults.title,
      description:
        typeof saved.description === 'string' && saved.description.length <= 500
          ? saved.description
          : defaults.description,
    }]
  })
  return {
    sections,
    heroAutoplayMs:
      typeof value.heroAutoplayMs === 'number' &&
      Number.isInteger(value.heroAutoplayMs) &&
      value.heroAutoplayMs >= 3000 &&
      value.heroAutoplayMs <= 15000
        ? value.heroAutoplayMs
        : DEFAULT_HOME_CONFIGURATION.heroAutoplayMs,
    heroLayout: isChoice(value.heroLayout, HERO_LAYOUTS)
      ? value.heroLayout
      : DEFAULT_HOME_CONFIGURATION.heroLayout,
  }
}

export function validateAppearance(value: unknown): AppearanceConfiguration {
  if (!isRecord(value)) throw new Error('Appearance must be a configuration object.')
  const normalized = normalizeAppearance(value)
  const keys: Array<keyof AppearanceConfiguration> = [
    'palette',
    'button',
    'textbox',
    'menu',
    'navigation',
  ]
  for (const key of keys) {
    if (value[key] !== normalized[key]) {
      throw new Error(`Choose a supported ${key} design.`)
    }
  }
  return normalized
}

export function validateHomeConfiguration(value: unknown): HomeConfiguration {
  if (!isRecord(value) || !Array.isArray(value.sections)) {
    throw new Error('Homepage configuration must include its sections.')
  }
  const allowedIds = new Set(HOME_SECTION_DEFAULTS.map(({ id }) => id))
  const seen = new Set<string>()
  for (const section of value.sections) {
    if (!isRecord(section) || typeof section.id !== 'string' || !allowedIds.has(section.id as HomeSectionId)) {
      throw new Error('Homepage configuration contains an unsupported section.')
    }
    if (seen.has(section.id)) throw new Error('Homepage sections cannot be repeated.')
    seen.add(section.id)
    if (
      typeof section.enabled !== 'boolean' ||
      typeof section.order !== 'number' ||
      !Number.isInteger(section.order) ||
      section.order < 0 ||
      section.order > 1000 ||
      typeof section.title !== 'string' ||
      section.title.length > 200 ||
      typeof section.description !== 'string' ||
      section.description.length > 500
    ) {
      throw new Error(`Homepage section "${section.id}" has invalid settings.`)
    }
  }
  if (typeof value.heroAutoplayMs !== 'number' || value.heroAutoplayMs < 3000 || value.heroAutoplayMs > 15000) {
    throw new Error('Hero autoplay must be between 3000 and 15000 milliseconds.')
  }
  if (!isChoice(value.heroLayout, HERO_LAYOUTS)) {
    throw new Error('Choose a supported hero layout.')
  }
  return normalizeHomeConfiguration(value)
}

export const APPEARANCE_CHOICES = {
  button: BUTTON_STYLES,
  textbox: TEXTBOX_STYLES,
  menu: MENU_STYLES,
  navigation: NAVIGATION_STYLES,
  heroLayout: HERO_LAYOUTS,
} as const
