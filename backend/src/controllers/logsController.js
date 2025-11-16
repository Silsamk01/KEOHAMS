const fs = require('fs').promises;
const path = require('path');

/**
 * Get system logs with filtering
 */
exports.getLogs = async (req, res) => {
  try {
    const { level, hours = 24, page = 1, pageSize = 50, search } = req.query;
    
    const logsDir = path.join(__dirname, '../../logs');
    const errorLogPath = path.join(logsDir, 'error.log');
    const appLogPath = path.join(logsDir, 'app.log');
    
    const logs = [];
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Parse error logs
    try {
      const errorContent = await fs.readFile(errorLogPath, 'utf8');
      const errorLines = errorContent.split('\n').filter(line => line.trim());
      
      for (const line of errorLines) {
        try {
          const parsed = JSON.parse(line);
          const logDate = new Date(parsed.time || parsed.timestamp);
          
          if (logDate >= hoursAgo) {
            logs.push({
              timestamp: logDate,
              level: parsed.level || 'error',
              message: parsed.msg || parsed.message || line.substring(0, 200),
              stack: parsed.stack || parsed.err?.stack,
              source: 'error.log'
            });
          }
        } catch {
          // Plain text log line
          if (line.includes('Error') || line.includes('ERROR')) {
            logs.push({
              timestamp: new Date(),
              level: 'error',
              message: line.substring(0, 200),
              source: 'error.log'
            });
          }
        }
      }
    } catch (err) {
      console.log('No error log file found');
    }
    
    // Parse app logs
    try {
      const appContent = await fs.readFile(appLogPath, 'utf8');
      const appLines = appContent.split('\n').filter(line => line.trim());
      
      for (const line of appLines) {
        try {
          const parsed = JSON.parse(line);
          const logDate = new Date(parsed.time || parsed.timestamp);
          
          if (logDate >= hoursAgo) {
            logs.push({
              timestamp: logDate,
              level: parsed.level || 'info',
              message: parsed.msg || parsed.message || line.substring(0, 200),
              stack: parsed.stack,
              source: 'app.log'
            });
          }
        } catch {
          // Plain text log line
          logs.push({
            timestamp: new Date(),
            level: 'info',
            message: line.substring(0, 200),
            source: 'app.log'
          });
        }
      }
    } catch (err) {
      console.log('No app log file found');
    }
    
    // Filter by level
    let filtered = logs;
    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }
    
    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        (log.stack && log.stack.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort by timestamp desc
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    
    // Calculate stats
    const stats = {
      total: filtered.length,
      errors: filtered.filter(l => l.level === 'error').length,
      warnings: filtered.filter(l => l.level === 'warn' || l.level === 'warning').length,
      info: filtered.filter(l => l.level === 'info').length
    };
    
    // Deduplicate similar errors
    const deduplicated = [];
    const seen = new Map();
    
    for (const log of filtered) {
      const key = `${log.level}:${log.message.substring(0, 100)}`;
      if (seen.has(key)) {
        seen.get(key).count++;
      } else {
        const entry = { ...log, count: 1 };
        seen.set(key, entry);
        deduplicated.push(entry);
      }
    }
    
    // Paginate
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const paginated = deduplicated.slice(offset, offset + parseInt(pageSize));
    
    res.json({
      logs: paginated,
      total: deduplicated.length,
      stats,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ message: 'Failed to retrieve logs', error: error.message });
  }
};

/**
 * Download logs as CSV
 */
exports.downloadLogs = async (req, res) => {
  try {
    const { level, hours = 24, format = 'csv' } = req.query;
    
    const logsDir = path.join(__dirname, '../../logs');
    const errorLogPath = path.join(logsDir, 'error.log');
    const appLogPath = path.join(logsDir, 'app.log');
    
    const logs = [];
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Collect all logs
    for (const logPath of [errorLogPath, appLogPath]) {
      try {
        const content = await fs.readFile(logPath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const logDate = new Date(parsed.time || parsed.timestamp);
            
            if (logDate >= hoursAgo) {
              logs.push({
                timestamp: logDate.toISOString(),
                level: parsed.level || 'info',
                message: parsed.msg || parsed.message || line,
                source: path.basename(logPath)
              });
            }
          } catch {
            logs.push({
              timestamp: new Date().toISOString(),
              level: 'info',
              message: line,
              source: path.basename(logPath)
            });
          }
        }
      } catch (err) {
        // Skip if file doesn't exist
      }
    }
    
    // Filter by level
    let filtered = logs;
    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }
    
    // Sort by timestamp
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (format === 'csv') {
      // Generate CSV
      const csv = [
        'Timestamp,Level,Source,Message',
        ...filtered.map(log => 
          `"${log.timestamp}","${log.level}","${log.source}","${log.message.replace(/"/g, '""')}"`
        )
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="keohams-logs-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="keohams-logs-${Date.now()}.json"`);
      res.json(filtered);
    }
  } catch (error) {
    console.error('Download logs error:', error);
    res.status(500).json({ message: 'Failed to download logs', error: error.message });
  }
};

/**
 * Clear old logs
 */
exports.clearOldLogs = async (req, res) => {
  try {
    const { days = 30 } = req.body;
    
    const logsDir = path.join(__dirname, '../../logs');
    
    // Check if logs directory exists
    try {
      await fs.access(logsDir);
    } catch {
      return res.json({ 
        message: 'No logs directory found',
        cleared: 0 
      });
    }
    
    const files = await fs.readdir(logsDir);
    
    let cleared = 0;
    
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(logsDir, file);
        const stats = await fs.stat(filePath);
        const daysOld = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysOld > days) {
          await fs.unlink(filePath);
          cleared++;
        }
      }
    }
    
    res.json({ 
      message: `Cleared ${cleared} old log files`,
      cleared 
    });
  } catch (error) {
    console.error('Clear logs error:', error);
    res.status(500).json({ message: 'Failed to clear logs', error: error.message });
  }
};

module.exports = exports;
