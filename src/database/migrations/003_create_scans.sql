-- Create scans table
CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    qr_code_id UUID NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
    points_earned INTEGER NOT NULL DEFAULT 1,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for performance and prevent duplicate scans
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_qr_code_id ON scans(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON scans(scanned_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scans_user_qr_unique ON scans(user_id, qr_code_id);

-- Create composite index for user scan history queries
CREATE INDEX IF NOT EXISTS idx_scans_user_scanned_at ON scans(user_id, scanned_at DESC); 