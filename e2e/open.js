/** First paint only — don't wait on Google Fonts or the WebGL init. */
export function open(page, path = '/') {
  return page.goto(path, { waitUntil: 'domcontentloaded' });
}
