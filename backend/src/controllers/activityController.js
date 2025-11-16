const { getActivities, getActivityStats, getActivityCount } = require('../services/activityLogger');

// Get recent activities with filters
exports.getRecentActivities = async (req, res) => {
  try {
    const {
      user_type,
      action,
      entity_type,
      user_id,
      limit = 100,
      offset = 0,
      start_date,
      end_date
    } = req.query;
    
    const activities = await getActivities({
      user_type,
      action,
      entity_type,
      user_id: user_id ? parseInt(user_id) : null,
      limit: Math.min(parseInt(limit) || 100, 500), // Max 500
      offset: parseInt(offset) || 0,
      start_date,
      end_date
    });
    
    const total = await getActivityCount({
      user_type,
      action,
      entity_type,
      user_id: user_id ? parseInt(user_id) : null,
      start_date,
      end_date
    });
    
    res.json({
      activities,
      pagination: {
        total,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0
      }
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ message: 'Failed to fetch activities' });
  }
};

// Get activity statistics
exports.getStats = async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const stats = await getActivityStats({ hours: parseInt(hours) });
    res.json(stats);
  } catch (error) {
    console.error('Get activity stats error:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
};

// Get user's own activity history
exports.getMyActivities = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { limit = 50, offset = 0 } = req.query;
    
    const activities = await getActivities({
      user_id: userId,
      limit: Math.min(parseInt(limit) || 50, 200),
      offset: parseInt(offset) || 0
    });
    
    const total = await getActivityCount({ user_id: userId });
    
    res.json({
      activities,
      pagination: {
        total,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      }
    });
  } catch (error) {
    console.error('Get my activities error:', error);
    res.status(500).json({ message: 'Failed to fetch activities' });
  }
};

module.exports = exports;
