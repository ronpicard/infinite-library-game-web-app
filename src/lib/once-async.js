/** Run `fn` once; concurrent callers share the same in-flight promise. */
export function onceAsync(fn) {
  let pending = null;
  return function run() {
    if (!pending) {
      pending = Promise.resolve()
        .then(fn)
        .catch((err) => {
          pending = null;
          throw err;
        });
    }
    return pending;
  };
}
