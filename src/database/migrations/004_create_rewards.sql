-- Create rewards table
CREATE TABLE IF NOT EXISTS rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_code VARCHAR(20) UNIQUE NOT NULL,
    points_used INTEGER NOT NULL DEFAULT 10,
    is_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    bar_name VARCHAR(100),
    bar_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rewards_user_id ON rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_reward_code ON rewards(reward_code);
CREATE INDEX IF NOT EXISTS idx_rewards_is_redeemed ON rewards(is_redeemed);
CREATE INDEX IF NOT EXISTS idx_rewards_expires_at ON rewards(expires_at);
CREATE INDEX IF NOT EXISTS idx_rewards_created_at ON rewards(created_at);

-- Create trigger to update updated_at
CREATE TRIGGER update_rewards_updated_at BEFORE UPDATE ON rewards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 