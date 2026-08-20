// src/notifications/templates/email.templates.ts
/**
 * Email template registry for the email job queue.
 *
 * Templates live in this module (not loose `.html` files) so they survive
 * the Nest build — `nest build` emits only TS; loose files in `src/` would
 * not reach `dist/`. Resolution rules:
 *
 * - Template name (the `template` field of `EmailJobData`) selects an entry
 *   in `EMAIL_TEMPLATES`, e.g. `welcome` → `welcome.html` content.
 * - Unknown names fall back to `GENERIC_TEMPLATE`, so a job with an
 *   unrecognized template still produces a usable email instead of failing.
 * - Placeholders use the same `{{key}}` syntax as the i18n notification
 *   templates under `src/notifications/templates/i18n/`.
 */

interface TemplateContext {
  [key: string]: unknown;
}

const escapeHtml = (value: unknown): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Interpolate `{{key}}` placeholders from `context`. Unknown keys render as
 * empty strings; values are HTML-escaped to avoid template injection.
 */
export function interpolateTemplate(
  source: string,
  context?: TemplateContext,
): string {
  return source.replace(
    /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
    (match, key: string) => {
      const value = context?.[key];
      return value === undefined || value === null ? '' : escapeHtml(value);
    },
  );
}

export const GENERIC_TEMPLATE = `<!DOCTYPE html>
<html>
  <body>
    <h1>PeerX Notification</h1>
    <p>You have a new message from PeerX.</p>
  </body>
</html>`;

export const EMAIL_TEMPLATES: Record<string, string> = {
  welcome: `<!DOCTYPE html>
<html>
  <body>
    <h1>Welcome to PeerX, {{name}}!</h1>
    <p>Your account is ready. Start trading instantly with insured, peer-to-peer swaps.</p>
    <p>If you have any questions, just reply to this email.</p>
    <p>— The PeerX Team</p>
  </body>
</html>`,

  'trade-completed': `<!DOCTYPE html>
<html>
  <body>
    <h1>Trade Completed</h1>
    <p>Your trade has been executed successfully.</p>
    <ul>
      <li>Trade ID: {{tradeId}}</li>
      <li>Amount: {{amount}}</li>
      <li>Asset: {{asset}}</li>
      <li>Price: {{price}}</li>
    </ul>
    <p>— The PeerX Team</p>
  </body>
</html>`,

  test: `<!DOCTYPE html>
<html>
  <body>
    <h1>Test Email</h1>
    <p>This is a test email sent by PeerX.</p>
  </body>
</html>`,
};

/**
 * Resolve and render an email template by name.
 */
export function renderEmailTemplate(
  template: string,
  context?: TemplateContext,
): string {
  const source = EMAIL_TEMPLATES[template] ?? GENERIC_TEMPLATE;
  return interpolateTemplate(source, context);
}
