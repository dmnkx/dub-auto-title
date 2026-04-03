/**
 * @returns {{ send: (message: string) => Promise<void> }}
 */
export function createNoopNotifier() {
  return {
    async send() {
      /* no-op */
    },
  };
}
