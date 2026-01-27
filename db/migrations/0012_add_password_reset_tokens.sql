-- Password reset tokens table
-- Stores tokens for password reset requests with expiration

CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast token lookups
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);

-- Index for finding tokens by user (e.g., to invalidate old tokens)
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- Comment for documentation
COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens with 1-hour expiration. Tokens are single-use.';
