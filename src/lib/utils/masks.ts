export function maskCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function maskCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}
