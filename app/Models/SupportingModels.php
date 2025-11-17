<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    protected $fillable = [
        'user_id', 'action', 'entity_type', 'entity_id', 'description', 'metadata', 'ip_address', 'user_agent'
    ];

    protected $casts = ['metadata' => 'array'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public static function log($action, $userId = null, $entityType = null, $entityId = null, $description = null, $metadata = [])
    {
        return static::create([
            'user_id' => $userId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'description' => $description,
            'metadata' => $metadata,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }
}

class NotificationRead extends Model
{
    protected $fillable = ['notification_id', 'user_id', 'read_at'];
    protected $casts = ['read_at' => 'datetime'];
    public $timestamps = false;

    public function notification()
    {
        return $this->belongsTo(Notification::class);
    }
}

class ChatThreadHide extends Model
{
    protected $fillable = ['thread_id', 'user_id'];
    public $timestamps = false;
}

class ChatMessageHide extends Model
{
    protected $fillable = ['message_id', 'user_id'];
    public $timestamps = false;
}

class ReviewImage extends Model
{
    protected $fillable = ['review_id', 'image_url', 'display_order'];
}

class ReviewVote extends Model
{
    protected $fillable = ['review_id', 'user_id', 'vote_type'];
}

class KYCAuditLog extends Model
{
    protected $table = 'kyc_audit_log';
    protected $fillable = ['kyc_submission_id', 'action', 'performed_by', 'details', 'ip_address', 'user_agent'];
    protected $casts = ['details' => 'array'];
}

class KYCFaceMatch extends Model
{
    protected $table = 'kyc_face_matches';
    protected $fillable = ['kyc_submission_id', 'id_photo_path', 'live_photo_path', 'similarity_score', 'match_result', 'landmarks', 'liveness_result'];
    protected $casts = ['similarity_score' => 'decimal:2', 'landmarks' => 'array', 'liveness_result' => 'array'];
}

class KYCOCRResult extends Model
{
    protected $table = 'kyc_ocr_results';
    protected $fillable = ['kyc_submission_id', 'document_path', 'extracted_text', 'parsed_fields', 'confidence_score', 'ocr_engine'];
    protected $casts = ['parsed_fields' => 'array', 'confidence_score' => 'decimal:2'];
}

class RiskEvent extends Model
{
    protected $fillable = ['user_id', 'event_type', 'delta', 'resulting_score', 'resulting_level', 'metadata', 'detected_at'];
    protected $casts = ['delta' => 'integer', 'resulting_score' => 'integer', 'metadata' => 'array', 'detected_at' => 'datetime'];
}

class OrderStatusHistory extends Model
{
    protected $table = 'order_status_history';
    protected $fillable = ['order_id', 'from_status', 'to_status', 'changed_by', 'changed_by_type', 'notes', 'metadata'];
    protected $casts = ['metadata' => 'array'];
}

class OrderShipment extends Model
{
    protected $fillable = ['order_id', 'shipment_reference', 'status', 'tracking_number', 'carrier', 'weight', 'dimensions', 'items', 'shipped_at', 'delivered_at', 'notes'];
    protected $casts = ['weight' => 'decimal:2', 'dimensions' => 'array', 'items' => 'array', 'shipped_at' => 'datetime', 'delivered_at' => 'datetime'];
}

class OrderReturn extends Model
{
    protected $fillable = ['order_id', 'user_id', 'return_reference', 'type', 'reason', 'description', 'items', 'status', 'refund_amount', 'images', 'admin_notes', 'rejection_reason', 'processed_by', 'approved_at', 'completed_at'];
    protected $casts = ['items' => 'array', 'refund_amount' => 'decimal:2', 'images' => 'array', 'approved_at' => 'datetime', 'completed_at' => 'datetime'];
}

class OrderInvoice extends Model
{
    protected $fillable = ['order_id', 'invoice_number', 'type', 'subtotal', 'tax', 'shipping', 'discount', 'total', 'currency', 'items', 'pdf_url', 'status', 'due_date', 'sent_at', 'paid_at'];
    protected $casts = ['subtotal' => 'decimal:2', 'tax' => 'decimal:2', 'shipping' => 'decimal:2', 'discount' => 'decimal:2', 'total' => 'decimal:2', 'items' => 'array', 'due_date' => 'datetime', 'sent_at' => 'datetime', 'paid_at' => 'datetime'];
}

class OrderNote extends Model
{
    protected $fillable = ['order_id', 'created_by', 'note', 'customer_visible'];
    protected $casts = ['customer_visible' => 'boolean'];
}

class PaymentRefund extends Model
{
    protected $fillable = ['transaction_id', 'initiated_by', 'refund_reference', 'amount', 'currency', 'status', 'reason', 'notes', 'paystack_refund_id', 'paystack_response', 'processed_at'];
    protected $casts = ['amount' => 'decimal:2', 'paystack_response' => 'array', 'processed_at' => 'datetime'];
}

class AffiliateClick extends Model
{
    protected $fillable = ['affiliate_id', 'affiliate_account_id', 'referral_code', 'ip_address', 'user_agent', 'referrer_url', 'landing_page', 'referred_user_id', 'session_id'];
}

class AffiliateConversion extends Model
{
    protected $fillable = ['affiliate_id', 'affiliate_account_id', 'click_id', 'order_id', 'user_id', 'order_amount', 'commission_amount', 'commission_rate', 'status', 'rejection_reason', 'approved_at', 'paid_at'];
    protected $casts = ['order_amount' => 'decimal:2', 'commission_amount' => 'decimal:2', 'commission_rate' => 'decimal:2', 'approved_at' => 'datetime', 'paid_at' => 'datetime'];
}

class CustomCommissionRate extends Model
{
    protected $fillable = ['affiliate_id', 'affiliate_account_id', 'rate_type', 'product_id', 'category_id', 'commission_rate', 'is_active', 'valid_from', 'valid_until', 'created_by'];
    protected $casts = ['commission_rate' => 'decimal:2', 'is_active' => 'boolean', 'valid_from' => 'date', 'valid_until' => 'date'];
}

class AffiliateVerificationToken extends Model
{
    protected $fillable = ['affiliate_account_id', 'token', 'type', 'expires_at', 'used'];
    protected $casts = ['expires_at' => 'datetime', 'used' => 'boolean'];
}

class InventoryMovement extends Model
{
    protected $fillable = ['product_id', 'movement_type', 'quantity', 'previous_quantity', 'new_quantity', 'reference_type', 'reference_id', 'notes', 'performed_by'];
    protected $casts = ['quantity' => 'integer', 'previous_quantity' => 'integer', 'new_quantity' => 'integer'];
}

class StockAlert extends Model
{
    protected $fillable = ['product_id', 'threshold', 'alert_type', 'is_active', 'last_triggered_at', 'trigger_count'];
    protected $casts = ['threshold' => 'integer', 'is_active' => 'boolean', 'last_triggered_at' => 'datetime', 'trigger_count' => 'integer'];
}

class PlatformSetting extends Model
{
    protected $fillable = ['setting_key', 'setting_value', 'value_type', 'category', 'description', 'is_public', 'is_editable'];
    protected $casts = ['is_public' => 'boolean', 'is_editable' => 'boolean'];

    public static function get($key, $default = null)
    {
        $setting = static::where('setting_key', $key)->first();
        return $setting ? $setting->getValue() : $default;
    }

    public function getValue()
    {
        return match ($this->value_type) {
            'BOOLEAN' => filter_var($this->setting_value, FILTER_VALIDATE_BOOLEAN),
            'NUMBER' => (float) $this->setting_value,
            'JSON' => json_decode($this->setting_value, true),
            default => $this->setting_value,
        };
    }
}
