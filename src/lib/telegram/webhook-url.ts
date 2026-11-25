/** Telegram must call a public URL: swap the auth-gated editor preview host for the public dev host. */
export function publicOrigin(origin: string): string {
  const m = origin.match(/^https:\/\/id-preview--([a-z0-9-]+)\.(.+)$/i);
  return m ? `https://project--${m[1]}-dev.${m[2]}` : origin;
}
