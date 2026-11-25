/** Telegram must call a public URL: swap the auth-gated editor preview host for the public dev host,
 * or use the production Vercel URL when running locally on localhost.
 */
export function publicOrigin(origin: string): string {
  if (!origin || origin.includes("localhost") || origin.includes("127.0.0.1") || origin.startsWith("http://")) {
    return process.env["PUBLIC_URL"] || "https://vigilia243.vercel.app";
  }
  const m = origin.match(/^https:\/\/id-preview--([a-z0-9-]+)\.(.+)$/i);
  return m ? `https://project--${m[1]}-dev.${m[2]}` : origin;
}
