<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('email_2fa_enabled')->default(false)->after('twofa_secret');
            $table->string('email_2fa_method', 20)->nullable()->after('email_2fa_enabled');
        });

        Schema::create('email_2fa_codes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->string('code', 10);
            $table->string('purpose', 20);
            $table->boolean('used')->default(false);
            $table->timestamp('expires_at');
            $table->timestamps();
            
            $table->index(['user_id', 'code']);
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_2fa_codes');
        
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['email_2fa_enabled', 'email_2fa_method']);
        });
    }
};
