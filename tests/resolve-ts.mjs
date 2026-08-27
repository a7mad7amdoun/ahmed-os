/* Node's ESM resolver requires explicit file extensions; the Next
   bundler does not. Rather than litter the source with `.ts` suffixes
   to suit the test runner, this hook fills them in for tests only. */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
    try {
      return await next(specifier + ".ts", context);
    } catch {
      return await next(specifier + "/index.ts", context).catch(() => next(specifier, context));
    }
  }
  return next(specifier, context);
}
