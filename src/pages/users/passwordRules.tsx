import Icon from '../../components/Icon';

/** Misma política que el servidor (routes/auth.ts passwordPolicy): el servidor es la autoridad; esto solo guía mientras se escribe. */
export function passwordChecks(next: string, current: string, email: string) {
  const local = email.split('@')[0].toLowerCase();
  return [
    { id: 'len', ok: next.length >= 12, label: 'Mínimo 12 caracteres' },
    { id: 'mix', ok: /[A-Za-z]/.test(next) && /[^A-Za-z]/.test(next), label: 'Letras y al menos un número o símbolo' },
    { id: 'diff', ok: next.length > 0 && next !== current, label: 'Distinta de la contraseña actual' },
    { id: 'user', ok: next.length > 0 && !(local.length >= 4 && next.toLowerCase().includes(local)), label: 'No contiene tu usuario del correo' },
  ];
}
export const REASON_ES: Record<string, string> = { min_length_12: 'Mínimo 12 caracteres.', needs_letters_and_numbers_or_symbols: 'Combina letras con números o símbolos.', same_as_current: 'Debe ser distinta de la actual.', contains_username: 'No debe contener tu usuario.' };

export function PasswordRules({ checks, id }: { checks: ReturnType<typeof passwordChecks>; id?: string }) {
  return <ul id={id} aria-label="Requisitos de la contraseña" className="mb-3 space-y-1 text-[12.5px]">
    {checks.map(c => <li key={c.id} className={c.ok ? 'flex items-center gap-1.5 text-good' : 'flex items-center gap-1.5 text-slate'}>
      <Icon n={c.ok ? 'check' : 'x'} s={13} /><span>{c.label}<span className="sr-only">{c.ok ? ' (cumple)' : ' (falta)'}</span></span></li>)}
  </ul>;
}
