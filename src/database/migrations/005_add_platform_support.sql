-- Add platform support to users table
ALTER TABLE users 
ADD COLUMN platform VARCHAR(20) DEFAULT 'whatsapp',
ADD COLUMN platform_user_id VARCHAR(50),
ADD COLUMN username VARCHAR(100);

-- Update existing users to have platform info
UPDATE users SET platform = 'whatsapp', platform_user_id = whatsapp_phone WHERE whatsapp_phone IS NOT NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_users_platform ON users(platform);
CREATE INDEX IF NOT EXISTS idx_users_platform_user_id ON users(platform_user_id);
CREATE INDEX IF NOT EXISTS idx_users_platform_composite ON users(platform, platform_user_id);

-- Make whatsapp_phone nullable since we now support multiple platforms
ALTER TABLE users ALTER COLUMN whatsapp_phone DROP NOT NULL;

-- Add unique constraint for platform + user_id combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_platform_user_unique ON users(platform, platform_user_id) WHERE platform_user_id IS NOT NULL; 