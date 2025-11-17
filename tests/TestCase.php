<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Run migrations for each test
        Artisan::call('migrate:fresh');
        
        // Seed if needed
        // $this->seed();
    }

    /**
     * Create an authenticated user and return the token
     */
    protected function authenticateUser($role = 'CUSTOMER', $attributes = [])
    {
        $user = \App\Models\User::factory()->create(array_merge([
            'role' => $role,
            'email_verified_at' => now(),
            'is_active' => true,
        ], $attributes));

        $token = $user->createToken('test-token')->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Accept' => 'application/json',
            ],
        ];
    }

    /**
     * Create an admin user and return the token
     */
    protected function authenticateAdmin($attributes = [])
    {
        return $this->authenticateUser('ADMIN', $attributes);
    }

    /**
     * Assert JSON structure matches expected format
     */
    protected function assertJsonStructure(array $structure, $json)
    {
        foreach ($structure as $key => $value) {
            if (is_array($value)) {
                $this->assertArrayHasKey($key, $json);
                $this->assertJsonStructure($value, $json[$key]);
            } else {
                $this->assertArrayHasKey($value, $json);
            }
        }
    }
}
