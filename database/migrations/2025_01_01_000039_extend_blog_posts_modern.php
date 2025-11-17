<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Extend posts table with modern blog features
        Schema::table('posts', function (Blueprint $table) {
            $table->string('cover_image')->nullable()->after('content');
            $table->integer('reading_minutes')->unsigned()->nullable()->after('cover_image');
            $table->integer('view_count')->unsigned()->default(0)->after('reading_minutes');
            $table->string('seo_title')->nullable()->after('view_count');
            $table->string('seo_description', 300)->nullable()->after('seo_title');
            
            $table->index('view_count');
        });

        // Tags table
        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60)->unique();
            $table->timestamps();
        });

        // Post Tags pivot table
        Schema::create('post_tags', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('post_id');
            $table->foreign('post_id')->references('id')->on('posts')->onDelete('cascade');
            $table->unsignedBigInteger('tag_id');
            $table->foreign('tag_id')->references('id')->on('tags')->onDelete('cascade');
            $table->timestamps();
            
            $table->unique(['post_id', 'tag_id']);
            $table->index('tag_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_tags');
        Schema::dropIfExists('tags');

        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndex(['view_count']);
            $table->dropColumn([
                'cover_image',
                'reading_minutes',
                'view_count',
                'seo_title',
                'seo_description'
            ]);
        });
    }
};
