<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Add composite indexes for performance optimizations
        // Note: Many indexes were already added in previous migrations
        // This migration adds any remaining performance indexes
        
        // Additional index on quotations for admin status filtering
        DB::statement('CREATE INDEX IF NOT EXISTS idx_quotations_status_user ON quotations(status, user_id)');
        
        // Additional index on KYC for status and creation date
        DB::statement('CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status_created ON kyc_submissions(status, created_at)');
        
        // Additional index on chat messages for thread chronological queries
        DB::statement('CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created ON chat_messages(thread_id, created_at)');
        
        // Additional index on notifications for user timeline
        DB::statement('CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at)');
        
        // Additional index on notification_reads for user filtering
        DB::statement('CREATE INDEX IF NOT EXISTS idx_notification_reads_user_read ON notification_reads(user_id, read_at)');
        
        // Additional index on posts for published content queries
        DB::statement('CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at)');
        
        // Additional index on user_verification_state for status queries
        DB::statement('CREATE INDEX IF NOT EXISTS idx_verification_state_status ON user_verification_state(status)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_verification_state_risk_level ON user_verification_state(risk_level)');
        
        // Additional index on risk_events for user timeline
        DB::statement('CREATE INDEX IF NOT EXISTS idx_risk_events_user_created ON risk_events(user_id, created_at)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_quotations_status_user ON quotations');
        DB::statement('DROP INDEX IF EXISTS idx_kyc_submissions_status_created ON kyc_submissions');
        DB::statement('DROP INDEX IF EXISTS idx_chat_messages_thread_created ON chat_messages');
        DB::statement('DROP INDEX IF EXISTS idx_notifications_user_created ON notifications');
        DB::statement('DROP INDEX IF EXISTS idx_notification_reads_user_read ON notification_reads');
        DB::statement('DROP INDEX IF EXISTS idx_posts_published_at ON posts');
        DB::statement('DROP INDEX IF EXISTS idx_verification_state_status ON user_verification_state');
        DB::statement('DROP INDEX IF EXISTS idx_verification_state_risk_level ON user_verification_state');
        DB::statement('DROP INDEX IF EXISTS idx_risk_events_user_created ON risk_events');
    }
};
