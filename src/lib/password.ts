export type PasswordScore = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  tone: "danger" | "warn" | "info" | "accent";
};

export function passwordScore(password: string): PasswordScore {
  if (!password) return { score: 0, label: "至少 8 位字符", tone: "danger" };
  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;

  if (password.length < 8) return { score: 1, label: "太短了", tone: "danger" };
  if (points <= 2) return { score: 2, label: "强度一般", tone: "warn" };
  if (points === 3) return { score: 3, label: "强度不错", tone: "info" };
  return { score: 4, label: "非常强", tone: "accent" };
}
