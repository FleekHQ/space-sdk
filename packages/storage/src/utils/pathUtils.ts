/**
 * Cleans up the path input to ensure it confirms
 * to what textile buckets is expecting.
 *
 * @param path
 */
export const sanitizePath = (path: string): string => {
  // replace all windows path separator '\' with '/'
  const replacedSeparators = path.replace('\\', '/');
  // trim '/' at prefix
  const prefixTrimmed = replacedSeparators.replace(/^\/+/, '');
  // trim '\' or '/' at suffix
  const suffixTrimmed = prefixTrimmed.replace(/[/\\]+$/, '');

  return `/${suffixTrimmed}`;
};
