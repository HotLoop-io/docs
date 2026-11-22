import { split, type Locale } from './locales';
import { useT } from './t';

/** Everything a component needs to render in the language of the page it sits on. */
export function forPage(pathname: string): { locale: Locale; route: string; t: ReturnType<typeof useT>['t']; rich: ReturnType<typeof useT>['rich']; to: ReturnType<typeof useT>['to'] } {
  const { locale, rest } = split(pathname);
  return { locale, route: rest, ...useT(locale) };
}
