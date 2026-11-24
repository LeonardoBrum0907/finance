/**
 * Regra do cadastro aberto. Em produção o app fica na internet e qualquer
 * pessoa que achasse o endereço poderia criar conta e usar o chat de IA com a
 * chave do dono; ALLOW_REGISTRATION=false fecha o cadastro depois que as
 * contas da casa existem.
 */

const CLOSED_VALUES = new Set(["false", "0", "no", "nao", "não", "off"]);

/**
 * Lê ALLOW_REGISTRATION. Vazio ou ausente mantém o cadastro aberto (como no
 * desenvolvimento); "false", "0", "no", "não" ou "off" fecham.
 *
 * @example parseAllowRegistration(process.env.ALLOW_REGISTRATION) // true
 */
export function parseAllowRegistration(raw: string | undefined): boolean {
  if (raw === undefined) return true;
  const value = raw.trim().toLowerCase();
  if (value === "") return true;
  return !CLOSED_VALUES.has(value);
}

/** Resposta de GET /api/auth/registration, usada pela tela de login. */
export interface RegistrationStatusDTO {
  open: boolean;
}
