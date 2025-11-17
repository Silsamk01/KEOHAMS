<?php

namespace Tests\Feature\Controllers;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;
use App\Mail\VerificationEmail;
use App\Mail\ResetPasswordEmail;
use PragmaRX\Google2FA\Google2FA;

class AuthControllerTest extends TestCase
{
    /** @test */
    public function user_can_register_with_valid_data()
    {
        Mail::fake();

        $response = $this->postJson('/api/v1/auth/register', [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'phone' => '1234567890',
        ]);

        $response->assertStatus(201)
                 ->assertJsonStructure([
                     'success',
                     'message',
                     'user' => ['id', 'email', 'first_name', 'last_name'],
                 ]);

        $this->assertDatabaseHas('users', [
            'email' => 'john@example.com',
            'first_name' => 'John',
            'last_name' => 'Doe',
        ]);

        Mail::assertSent(VerificationEmail::class);
    }

    /** @test */
    public function registration_fails_with_invalid_email()
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'invalid-email',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors('email');
    }

    /** @test */
    public function registration_fails_with_duplicate_email()
    {
        User::factory()->create(['email' => 'john@example.com']);

        $response = $this->postJson('/api/v1/auth/register', [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors('email');
    }

    /** @test */
    public function user_can_login_with_valid_credentials()
    {
        $user = User::factory()->create([
            'email' => 'john@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'john@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'success',
                     'token',
                     'user' => ['id', 'email', 'role'],
                 ]);
    }

    /** @test */
    public function login_fails_with_invalid_credentials()
    {
        User::factory()->create([
            'email' => 'john@example.com',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'john@example.com',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(401)
                 ->assertJson(['success' => false]);
    }

    /** @test */
    public function login_requires_email_verification()
    {
        $user = User::factory()->unverified()->create([
            'email' => 'john@example.com',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'john@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(403)
                 ->assertJson([
                     'success' => false,
                     'message' => 'Please verify your email address first.',
                 ]);
    }

    /** @test */
    public function login_checks_if_user_is_active()
    {
        $user = User::factory()->inactive()->create([
            'email' => 'john@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'john@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(403)
                 ->assertJson([
                     'success' => false,
                     'message' => 'Your account has been deactivated.',
                 ]);
    }

    /** @test */
    public function user_can_logout()
    {
        $auth = $this->authenticateUser();

        $response = $this->postJson('/api/v1/auth/logout', [], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);
    }

    /** @test */
    public function user_can_get_their_profile()
    {
        $auth = $this->authenticateUser();

        $response = $this->getJson('/api/v1/auth/me', $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'user' => [
                         'id' => $auth['user']->id,
                         'email' => $auth['user']->email,
                     ],
                 ]);
    }

    /** @test */
    public function user_can_update_their_profile()
    {
        $auth = $this->authenticateUser();

        $response = $this->putJson('/api/v1/auth/profile', [
            'first_name' => 'Updated',
            'last_name' => 'Name',
            'phone' => '9876543210',
        ], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertDatabaseHas('users', [
            'id' => $auth['user']->id,
            'first_name' => 'Updated',
            'last_name' => 'Name',
        ]);
    }

    /** @test */
    public function user_can_change_password()
    {
        $auth = $this->authenticateUser();

        $response = $this->postJson('/api/v1/auth/change-password', [
            'current_password' => 'password123',
            'new_password' => 'NewPassword123!',
            'new_password_confirmation' => 'NewPassword123!',
        ], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        // Verify new password works
        $this->assertTrue(Hash::check('NewPassword123!', $auth['user']->fresh()->password));
    }

    /** @test */
    public function password_change_requires_correct_current_password()
    {
        $auth = $this->authenticateUser();

        $response = $this->postJson('/api/v1/auth/change-password', [
            'current_password' => 'wrongpassword',
            'new_password' => 'NewPassword123!',
            'new_password_confirmation' => 'NewPassword123!',
        ], $auth['headers']);

        $response->assertStatus(422);
    }

    /** @test */
    public function user_can_request_password_reset()
    {
        Mail::fake();
        $user = User::factory()->create(['email' => 'john@example.com']);

        $response = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'john@example.com',
        ]);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        Mail::assertSent(ResetPasswordEmail::class);
    }

    /** @test */
    public function user_can_reset_password_with_valid_token()
    {
        $user = User::factory()->create(['email' => 'john@example.com']);
        $token = bin2hex(random_bytes(32));
        
        Cache::put('password_reset:' . $token, $user->id, 3600);

        $response = $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ]);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertTrue(Hash::check('NewPassword123!', $user->fresh()->password));
    }

    /** @test */
    public function password_reset_fails_with_invalid_token()
    {
        $response = $this->postJson('/api/v1/auth/reset-password', [
            'token' => 'invalid-token',
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ]);

        $response->assertStatus(400)
                 ->assertJson(['success' => false]);
    }

    /** @test */
    public function user_can_verify_email()
    {
        $user = User::factory()->unverified()->create();
        $token = bin2hex(random_bytes(32));
        
        Cache::put('email_verification:' . $token, $user->id, 3600);

        $response = $this->postJson('/api/v1/auth/verify-email', [
            'token' => $token,
        ]);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    /** @test */
    public function user_can_enable_two_factor_authentication()
    {
        $auth = $this->authenticateUser();

        $response = $this->postJson('/api/v1/auth/2fa/enable', [], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'success',
                     'secret',
                     'qr_code',
                 ]);

        $this->assertTrue($auth['user']->fresh()->two_factor_enabled);
    }

    /** @test */
    public function user_can_disable_two_factor_authentication()
    {
        $auth = $this->authenticateUser();
        $auth['user']->update(['two_factor_enabled' => true]);

        $response = $this->postJson('/api/v1/auth/2fa/disable', [], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertFalse($auth['user']->fresh()->two_factor_enabled);
    }

    /** @test */
    public function two_factor_authentication_is_required_when_enabled()
    {
        $user = User::factory()->withTwoFactor()->create([
            'email' => 'john@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'john@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'requires_2fa' => true,
                 ])
                 ->assertJsonMissing(['token']);
    }
}
