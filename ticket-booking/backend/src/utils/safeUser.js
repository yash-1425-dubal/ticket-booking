function safeUser(user) {
  if (!user) return null;
  const { passwordHash, refreshToken, resetToken, resetTokenExpiry, ...safe } = user;
  return safe;
}

module.exports = safeUser;
