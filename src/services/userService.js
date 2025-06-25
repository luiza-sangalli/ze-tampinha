class UserService {
  constructor(db, redis) {
    this.db = db;
    this.redis = redis;
  }

  // Create or get user by WhatsApp phone
  async findOrCreateUser(whatsappPhone, name = null) {
    // First try to get from cache
    const cacheKey = `user:whatsapp:${whatsappPhone}`;
    const cachedUser = await this.redis.get(cacheKey);
    
    if (cachedUser) {
      return JSON.parse(cachedUser);
    }

    try {
      let user = await this.db.query(
        'SELECT * FROM users WHERE whatsapp_phone = $1',
        [whatsappPhone]
      );

      if (user.rows.length === 0) {
        // Create new user
        const insertResult = await this.db.query(
          `INSERT INTO users (whatsapp_phone, name, points, total_scans, platform, platform_user_id) 
           VALUES ($1, $2, 0, 0, 'whatsapp', $1) 
           RETURNING *`,
          [whatsappPhone, name]
        );
        user = insertResult;
      }

      const userData = user.rows[0];
      
      // Cache user data for 10 minutes
      await this.redis.setex(cacheKey, 600, JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error('Error finding/creating user:', error);
      throw error;
    }
  }

  // New method: Find or create user by platform
  async findOrCreateUserByPlatform(platform, platformUserId, name = null, username = null) {
    // First try to get from cache
    const cacheKey = `user:${platform}:${platformUserId}`;
    const cachedUser = await this.redis.get(cacheKey);
    
    if (cachedUser) {
      return JSON.parse(cachedUser);
    }

    try {
      let user = await this.db.query(
        'SELECT * FROM users WHERE platform = $1 AND platform_user_id = $2',
        [platform, platformUserId]
      );

      if (user.rows.length === 0) {
        // Create new user
        const insertQuery = platform === 'whatsapp' 
          ? `INSERT INTO users (whatsapp_phone, name, points, total_scans, platform, platform_user_id) 
             VALUES ($3, $4, 0, 0, $1, $2) 
             RETURNING *`
          : `INSERT INTO users (name, username, points, total_scans, platform, platform_user_id) 
             VALUES ($3, $4, 0, 0, $1, $2) 
             RETURNING *`;
        
        const insertParams = platform === 'whatsapp' 
          ? [platform, platformUserId, platformUserId, name]
          : [platform, platformUserId, name, username];

        const insertResult = await this.db.query(insertQuery, insertParams);
        user = insertResult;
      }

      const userData = user.rows[0];
      
      // Cache user data for 10 minutes
      await this.redis.setex(cacheKey, 600, JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error('Error finding/creating user by platform:', error);
      throw error;
    }
  }

  // New method: Find user by platform
  async findUserByPlatform(platform, platformUserId) {
    const cacheKey = `user:${platform}:${platformUserId}`;
    const cachedUser = await this.redis.get(cacheKey);
    
    if (cachedUser) {
      return JSON.parse(cachedUser);
    }

    try {
      const result = await this.db.query(
        'SELECT * FROM users WHERE platform = $1 AND platform_user_id = $2',
        [platform, platformUserId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const userData = result.rows[0];
      
      // Cache user data for 10 minutes
      await this.redis.setex(cacheKey, 600, JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error('Error finding user by platform:', error);
      throw error;
    }
  }

  // Find user by WhatsApp phone
  async findUserByPhone(whatsappPhone) {
    try {
      // Try Redis cache first
      const cachedUser = await this.redis.get(`user:phone:${whatsappPhone}`);
      if (cachedUser) {
        return JSON.parse(cachedUser);
      }

      // Query database
      const query = `
        SELECT * FROM users 
        WHERE whatsapp_phone = $1 AND is_active = true
      `;
      
      const result = await this.db.query(query, [whatsappPhone]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      
      // Cache user data
      await this.cacheUser(user);

      return user;
    } catch (error) {
      console.error('Error finding user by phone:', error);
      throw error;
    }
  }

  // Get user by ID
  async getUserById(userId) {
    try {
      // Try Redis cache first
      const cachedUser = await this.redis.get(`user:id:${userId}`);
      if (cachedUser) {
        return JSON.parse(cachedUser);
      }

      const query = `
        SELECT * FROM users 
        WHERE id = $1 AND is_active = true
      `;
      
      const result = await this.db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      
      // Cache user data
      await this.cacheUser(user);

      return user;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  // Update user information
  async updateUser(userId, updates) {
    try {
      const allowedUpdates = ['name', 'points'];
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedUpdates.includes(key)) {
          updateFields.push(`${key} = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateValues.push(userId); // Add userId as last parameter

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex} AND is_active = true
        RETURNING *
      `;

      const result = await this.db.query(query, updateValues);
      
      if (result.rows.length === 0) {
        throw new Error('User not found or inactive');
      }

      const updatedUser = result.rows[0];
      
      // Update cache
      await this.cacheUser(updatedUser);

      return updatedUser;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Get user scan history
  async getUserScanHistory(userId, limit = 50, offset = 0) {
    try {
      const query = `
        SELECT s.*, qr.bar_name, qr.bar_id
        FROM scans s
        JOIN qr_codes qr ON s.qr_code_id = qr.id
        WHERE s.user_id = $1
        ORDER BY s.scanned_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.db.query(query, [userId, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error getting user scan history:', error);
      throw error;
    }
  }

  // Get user rewards
  async getUserRewards(userId, includeRedeemed = false) {
    try {
      let query = `
        SELECT * FROM rewards 
        WHERE user_id = $1
      `;
      
      if (!includeRedeemed) {
        query += ' AND is_redeemed = false';
      }
      
      query += ' ORDER BY created_at DESC';

      const result = await this.db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting user rewards:', error);
      throw error;
    }
  }

  // Get user statistics
  async getUserStats(userId) {
    try {
      const statsQuery = `
        SELECT 
          u.points,
          u.total_scans,
          COUNT(DISTINCT s.qr_code_id) as unique_qr_codes_scanned,
          COUNT(DISTINCT CASE WHEN r.is_redeemed = false THEN r.id END) as active_rewards,
          COUNT(DISTINCT CASE WHEN r.is_redeemed = true THEN r.id END) as redeemed_rewards,
          COALESCE(SUM(s.points_earned), 0) as total_points_earned
        FROM users u
        LEFT JOIN scans s ON u.id = s.user_id
        LEFT JOIN rewards r ON u.id = r.user_id
        WHERE u.id = $1
        GROUP BY u.id, u.points, u.total_scans
      `;

      const result = await this.db.query(statsQuery, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const stats = result.rows[0];
      
      // Convert bigint to number for JSON serialization
      Object.keys(stats).forEach(key => {
        if (typeof stats[key] === 'bigint') {
          stats[key] = Number(stats[key]);
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  // Deactivate user
  async deactivateUser(userId) {
    try {
      const query = `
        UPDATE users 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await this.db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      // Remove from cache
      const user = result.rows[0];
      await this.redis.del(`user:id:${userId}`);
      await this.redis.del(`user:phone:${user.whatsapp_phone}`);

      return user;
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
    }
  }

  // Get leaderboard
  async getLeaderboard(limit = 100) {
    try {
      const query = `
        SELECT 
          whatsapp_phone,
          name,
          points,
          total_scans,
          created_at
        FROM users 
        WHERE is_active = true
        ORDER BY points DESC, total_scans DESC
        LIMIT $1
      `;

      const result = await this.db.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  // Cache user data in Redis
  async cacheUser(user) {
    try {
      const userJson = JSON.stringify(user);
      const ttl = 3600; // 1 hour

      await Promise.all([
        this.redis.setEx(`user:id:${user.id}`, ttl, userJson),
        this.redis.setEx(`user:phone:${user.whatsapp_phone}`, ttl, userJson)
      ]);
    } catch (error) {
      console.error('Error caching user:', error);
      // Don't throw error for cache failures
    }
  }

  // Clear user cache
  async clearUserCache(user) {
    try {
      await Promise.all([
        this.redis.del(`user:id:${user.id}`),
        this.redis.del(`user:phone:${user.whatsapp_phone}`)
      ]);
    } catch (error) {
      console.error('Error clearing user cache:', error);
      // Don't throw error for cache failures
    }
  }
}

module.exports = UserService; 