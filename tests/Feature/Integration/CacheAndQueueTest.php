<?php

namespace Tests\Feature\Integration;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Mail;

class CacheAndQueueTest extends TestCase
{
    /** @test */
    public function cache_stores_and_retrieves_data()
    {
        $key = 'test_cache_key';
        $value = ['data' => 'test_value'];

        // Store in cache
        Cache::put($key, $value, 60);

        // Retrieve from cache
        $cached = Cache::get($key);

        $this->assertEquals($value, $cached);

        // Delete from cache
        Cache::forget($key);
        $this->assertNull(Cache::get($key));
    }

    /** @test */
    public function cache_remember_works_correctly()
    {
        $key = 'test_remember_key';
        $calls = 0;

        // First call - executes closure
        $result1 = Cache::remember($key, 60, function () use (&$calls) {
            $calls++;
            return 'cached_value';
        });

        // Second call - uses cached value
        $result2 = Cache::remember($key, 60, function () use (&$calls) {
            $calls++;
            return 'cached_value';
        });

        $this->assertEquals('cached_value', $result1);
        $this->assertEquals('cached_value', $result2);
        $this->assertEquals(1, $calls); // Closure only called once
    }

    /** @test */
    public function database_transactions_rollback_on_error()
    {
        $initialCount = User::count();

        try {
            DB::transaction(function () {
                User::factory()->create(['email' => 'test@example.com']);
                
                // Force an error
                throw new \Exception('Test error');
            });
        } catch (\Exception $e) {
            // Expected exception
        }

        // Verify user was not created
        $this->assertEquals($initialCount, User::count());
        $this->assertDatabaseMissing('users', [
            'email' => 'test@example.com',
        ]);
    }

    /** @test */
    public function database_transactions_commit_on_success()
    {
        $result = DB::transaction(function () {
            $user = User::factory()->create(['email' => 'success@example.com']);
            return $user;
        });

        $this->assertDatabaseHas('users', [
            'email' => 'success@example.com',
        ]);
    }

    /** @test */
    public function queue_can_dispatch_jobs()
    {
        Queue::fake();

        // Dispatch a job
        \App\Jobs\SendEmailJob::dispatch('test@example.com', 'Test Subject', 'Test Body');

        // Assert job was pushed
        Queue::assertPushed(\App\Jobs\SendEmailJob::class);
    }

    /** @test */
    public function mail_can_be_queued()
    {
        Mail::fake();
        Queue::fake();

        $user = User::factory()->create();

        // Send mail (should be queued)
        Mail::to($user->email)->queue(new \App\Mail\WelcomeEmail($user));

        // Assert mail was queued
        Queue::assertPushed(function ($job) {
            return $job instanceof \Illuminate\Mail\SendQueuedMailable;
        });
    }

    /** @test */
    public function cache_tags_work_correctly()
    {
        if (!config('cache.default') === 'redis') {
            $this->markTestSkipped('Cache tags require Redis');
        }

        Cache::tags(['users', 'products'])->put('user_1', 'John Doe', 60);
        Cache::tags(['products'])->put('product_1', 'Widget', 60);

        $this->assertEquals('John Doe', Cache::tags(['users', 'products'])->get('user_1'));
        $this->assertEquals('Widget', Cache::tags(['products'])->get('product_1'));

        // Flush specific tag
        Cache::tags(['users'])->flush();

        $this->assertNull(Cache::tags(['users', 'products'])->get('user_1'));
        $this->assertEquals('Widget', Cache::tags(['products'])->get('product_1'));
    }

    /** @test */
    public function cache_increment_and_decrement_work()
    {
        $key = 'counter';
        Cache::put($key, 0);

        Cache::increment($key);
        $this->assertEquals(1, Cache::get($key));

        Cache::increment($key, 5);
        $this->assertEquals(6, Cache::get($key));

        Cache::decrement($key, 2);
        $this->assertEquals(4, Cache::get($key));
    }

    /** @test */
    public function cache_can_store_complex_objects()
    {
        $user = User::factory()->create();
        $key = 'user_' . $user->id;

        Cache::put($key, $user, 60);

        $cached = Cache::get($key);

        $this->assertInstanceOf(User::class, $cached);
        $this->assertEquals($user->id, $cached->id);
        $this->assertEquals($user->email, $cached->email);
    }
}
