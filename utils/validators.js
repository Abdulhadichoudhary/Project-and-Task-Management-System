function requiredString(value, field, maxLength) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return `${field} is required.`;
  }

  if (maxLength && value.trim().length > maxLength) {
    return `${field} must be ${maxLength} characters or fewer.`;
  }

  return null;
}

function validateEmail(email) {
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "A valid email is required.";
  }

  return null;
}

function isUuid(value) {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

module.exports = { requiredString, validateEmail, isUuid };
