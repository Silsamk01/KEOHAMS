const db = require('../config/db');
const crypto = require('crypto');

// Simple encryption for API keys (AES-256-GCM)
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.KYC_ENCRYPTION_KEY || process.env.JWT_SECRET;

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Get all platform settings (admin only)
exports.getAllSettings = async (req, res) => {
  try {
    const settings = await db('platform_settings')
      .select('id', 'setting_key', 'setting_value', 'is_encrypted', 'category', 'description', 'updated_at')
      .orderBy('category', 'asc')
      .orderBy('setting_key', 'asc');
    
    // Decrypt encrypted values for admin viewing
    const decryptedSettings = settings.map(s => {
      if (s.is_encrypted && s.setting_value) {
        try {
          return { ...s, setting_value: decrypt(s.setting_value) };
        } catch (e) {
          console.error(`Failed to decrypt ${s.setting_key}:`, e.message);
          return { ...s, setting_value: '[DECRYPTION ERROR]' };
        }
      }
      return s;
    });
    
    res.json({ settings: decryptedSettings });
  } catch (error) {
    console.error('Get all settings error:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
};

// Get specific setting by key
exports.getSetting = async (req, res) => {
  const { key } = req.params;
  
  try {
    const setting = await db('platform_settings')
      .where({ setting_key: key })
      .first();
    
    if (!setting) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    
    // Decrypt if encrypted
    if (setting.is_encrypted && setting.setting_value) {
      try {
        setting.setting_value = decrypt(setting.setting_value);
      } catch (e) {
        console.error(`Failed to decrypt ${key}:`, e.message);
        return res.status(500).json({ message: 'Decryption failed' });
      }
    }
    
    res.json({ setting });
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ message: 'Failed to fetch setting' });
  }
};

// Update setting (admin only)
exports.updateSetting = async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  
  try {
    const setting = await db('platform_settings')
      .where({ setting_key: key })
      .first();
    
    if (!setting) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    
    // Encrypt if needed
    let finalValue = value;
    if (setting.is_encrypted && value) {
      finalValue = encrypt(value);
    }
    
    await db('platform_settings')
      .where({ setting_key: key })
      .update({
        setting_value: finalValue,
        updated_at: db.fn.now()
      });
    
    // Audit log
    try {
      await db('admin_audit_events').insert({
        admin_id: req.user.sub,
        action: 'UPDATE_SETTING',
        metadata: JSON.stringify({
          setting_key: key,
          timestamp: new Date().toISOString()
        })
      });
    } catch (_) {}
    
    res.json({ message: 'Setting updated successfully' });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ message: 'Failed to update setting' });
  }
};

// Batch update multiple settings
exports.batchUpdateSettings = async (req, res) => {
  const { settings } = req.body; // Array of { key, value }
  
  if (!Array.isArray(settings)) {
    return res.status(400).json({ message: 'Settings must be an array' });
  }
  
  try {
    const updates = [];
    
    for (const { key, value } of settings) {
      const setting = await db('platform_settings')
        .where({ setting_key: key })
        .first();
      
      if (!setting) continue;
      
      let finalValue = value;
      if (setting.is_encrypted && value) {
        finalValue = encrypt(value);
      }
      
      updates.push(
        db('platform_settings')
          .where({ setting_key: key })
          .update({
            setting_value: finalValue,
            updated_at: db.fn.now()
          })
      );
    }
    
    await Promise.all(updates);
    
    // Audit log
    try {
      await db('admin_audit_events').insert({
        admin_id: req.user.sub,
        action: 'BATCH_UPDATE_SETTINGS',
        metadata: JSON.stringify({
          count: settings.length,
          keys: settings.map(s => s.key),
          timestamp: new Date().toISOString()
        })
      });
    } catch (_) {}
    
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Batch update settings error:', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
};

// Get public settings (for frontend without auth)
exports.getPublicSettings = async (req, res) => {
  try {
    // Only return non-encrypted, safe settings
    const settings = await db('platform_settings')
      .where({ is_encrypted: false })
      .whereIn('setting_key', ['paystack_public_key', 'paystack_enabled'])
      .select('setting_key', 'setting_value');
    
    const settingsMap = settings.reduce((acc, s) => {
      acc[s.setting_key] = s.setting_value;
      return acc;
    }, {});
    
    res.json({ settings: settingsMap });
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ message: 'Failed to fetch public settings' });
  }
};

// Helper function to get setting value directly (for internal use)
async function getSettingValue(key) {
  try {
    const setting = await db('platform_settings')
      .where({ setting_key: key })
      .first();
    
    if (!setting || !setting.setting_value) return null;
    
    if (setting.is_encrypted) {
      return decrypt(setting.setting_value);
    }
    
    return setting.setting_value;
  } catch (error) {
    console.error(`Get setting value ${key} error:`, error);
    return null;
  }
}

module.exports.getSettingValue = getSettingValue;
