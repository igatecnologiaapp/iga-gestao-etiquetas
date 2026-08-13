export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
    test: (v) => v.length >= PASSWORD_MIN_LENGTH,
  },
  { id: "letter", label: "Ao menos uma letra", test: (v) => /\p{L}/u.test(v) },
  { id: "number", label: "Ao menos um número", test: (v) => /\d/.test(v) },
  { id: "no-space", label: "Sem espaços em branco", test: (v) => v.length > 0 && !/\s/.test(v) },
];

/** Retorna a primeira mensagem de erro da senha, ou null quando válida. */
export function validatePassword(password: string): string | null {
  if (!password) return "Informe a nova senha.";
  const failed = PASSWORD_RULES.find((r) => !r.test(password));
  if (!failed) return null;
  switch (failed.id) {
    case "length":
      return `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`;
    case "letter":
      return "A senha deve conter ao menos uma letra.";
    case "number":
      return "A senha deve conter ao menos um número.";
    default:
      return "A senha não pode conter espaços em branco.";
  }
}

export function validateConfirmation(password: string, confirm: string): string | null {
  if (!confirm) return "Confirme a nova senha.";
  if (password !== confirm) return "As senhas não coincidem.";
  return null;
}

/** Traduz erros do serviço de autenticação para mensagens claras em português. */
export function translateAuthError(message?: string | null): string {
  const m = (message ?? "").toLowerCase();
  if (!m) return "Não foi possível concluir a operação. Tente novamente.";
  if (m.includes("expired") || m.includes("invalid or has expired") || m.includes("otp_expired"))
    return "O link de redefinição expirou. Solicite um novo link para continuar.";
  if (m.includes("token") && (m.includes("invalid") || m.includes("not found")))
    return "Link inválido ou já utilizado. Solicite um novo link de redefinição.";
  if (m.includes("same password") || m.includes("should be different"))
    return "A nova senha deve ser diferente da senha atual.";
  if (m.includes("weak") || m.includes("pwned") || m.includes("compromised"))
    return "Esta senha é muito comum ou foi vazada em incidentes públicos. Escolha outra.";
  if (m.includes("password should be at least") || m.includes("password is too short"))
    return `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (m.includes("session") || m.includes("jwt") || m.includes("auth session missing"))
    return "Sua sessão de redefinição expirou. Solicite um novo link.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  return message ?? "Não foi possível concluir a operação. Tente novamente.";
}

/** Erros que indicam que o link/sessão não é mais válido. */
export function isExpiredLinkError(message?: string | null): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("expired") ||
    m.includes("otp_expired") ||
    m.includes("auth session missing") ||
    m.includes("jwt") ||
    (m.includes("token") && m.includes("invalid"))
  );
}
