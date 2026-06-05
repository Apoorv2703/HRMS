export const validatePassword = (password, policy) => {
  const { minLength = 8, requireSpecial = true, requireNumbers = true, requireUppercase = true } = policy;

  if (password.length < minLength) {
    return {
      isValid: false,
      error: `Password must be at least ${minLength} characters long.`
    };
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one uppercase letter.'
    };
  }

  if (requireNumbers && !/\d/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one number.'
    };
  }

  if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one special character (e.g. !, @, #, $, %, etc.).'
    };
  }

  return { isValid: true };
};
