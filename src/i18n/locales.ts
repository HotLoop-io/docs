// The fourteen languages docs.hotloop.io serves: English plus the thirteen the HotLoop products ship in
// (the term base is CODEX work/notes/i18n/glossary in the codex, the product catalogs are
// hotloop-flow web/src/i18n/ui.<code>.json). `path` is the URL folder, `tag` is the BCP 47 tag
// that goes in <html lang> and hreflang, `og` is the Open Graph locale. English has no folder, so
// every existing English URL stays exactly where it was.
export type Locale = {
  code: string;
  path: string;
  tag: string;
  og: string;
  name: string; // the language's own name, shown in the switcher
  dir: 'ltr' | 'rtl';
};

export const LOCALES: Locale[] = [
  { code: 'en', path: '', tag: 'en', og: 'en_US', name: 'English', dir: 'ltr' },
  { code: 'es', path: 'es', tag: 'es', og: 'es_ES', name: 'Español', dir: 'ltr' },
  { code: 'fr', path: 'fr', tag: 'fr', og: 'fr_FR', name: 'Français', dir: 'ltr' },
  { code: 'it', path: 'it', tag: 'it', og: 'it_IT', name: 'Italiano', dir: 'ltr' },
  { code: 'de', path: 'de', tag: 'de', og: 'de_DE', name: 'Deutsch', dir: 'ltr' },
  { code: 'nb', path: 'nb', tag: 'nb', og: 'nb_NO', name: 'Norsk bokmål', dir: 'ltr' },
  { code: 'bg', path: 'bg', tag: 'bg', og: 'bg_BG', name: 'Български', dir: 'ltr' },
  { code: 'el', path: 'el', tag: 'el', og: 'el_GR', name: 'Ελληνικά', dir: 'ltr' },
  { code: 'ko', path: 'ko', tag: 'ko', og: 'ko_KR', name: '한국어', dir: 'ltr' },
  { code: 'ja', path: 'ja', tag: 'ja', og: 'ja_JP', name: '日本語', dir: 'ltr' },
  { code: 'vi', path: 'vi', tag: 'vi', og: 'vi_VN', name: 'Tiếng Việt', dir: 'ltr' },
  { code: 'hi', path: 'hi', tag: 'hi', og: 'hi_IN', name: 'हिन्दी', dir: 'ltr' },
  { code: 'zh-Hans', path: 'zh-hans', tag: 'zh-Hans', og: 'zh_CN', name: '简体中文', dir: 'ltr' },
  { code: 'ar', path: 'ar', tag: 'ar', og: 'ar_AR', name: 'العربية', dir: 'rtl' },
];

export const DEFAULT = LOCALES[0];
export const OTHERS = LOCALES.slice(1);
export const byCode = (code: string) => LOCALES.find((l) => l.code === code) ?? DEFAULT;

/** Which language a pathname is in, and the same path with the language folder taken off. */
export function split(pathname: string): { locale: Locale; rest: string } {
  const m = /^\/([^/]+)(\/.*)?$/.exec(pathname);
  const hit = m && OTHERS.find((l) => l.path === m[1]);
  return hit ? { locale: hit, rest: m![2] ?? '/' } : { locale: DEFAULT, rest: pathname };
}

// Every docs page has a URL in every language: Starlight serves the English page under the language folder,
// with a notice, until the page is translated. So a link in any language can always take the language folder.
export function href(route: string, locale: Locale): string {
  if (locale === DEFAULT || /^(https?:|mailto:|#)/.test(route)) return route;
  return route === '/' ? `/${locale.path}/` : `/${locale.path}${route}`;
}
