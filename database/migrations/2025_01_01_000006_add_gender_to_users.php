<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('gender', ['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY'])->nullable()->after('dob');
        });

        Schema::table('pending_registrations', function (Blueprint $table) {
            $table->enum('gender', ['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY'])->nullable()->after('dob');
            $table->index('gender');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('gender');
        });

        Schema::table('pending_registrations', function (Blueprint $table) {
            $table->dropIndex(['gender']);
            $table->dropColumn('gender');
        });
    }
};
