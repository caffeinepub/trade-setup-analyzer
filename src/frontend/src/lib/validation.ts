export function validateRequired(value: string): boolean {
  return value.trim().length > 0;
}

export function validateNumericInput(
  value: string,
  fieldName: string,
  mustBePositive: boolean = false
): string | null {
  if (!validateRequired(value)) {
    return `${fieldName} is required`;
  }

  const num = parseFloat(value);
  if (isNaN(num)) {
    return `${fieldName} must be a valid number`;
  }

  if (mustBePositive && num <= 0) {
    return `${fieldName} must be greater than zero`;
  }

  return null;
}
