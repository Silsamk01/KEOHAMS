<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class CaptchaController extends Controller
{
    /**
     * Generate a new CAPTCHA
     */
    public function generate(Request $request)
    {
        // Generate a random 6-character alphanumeric code
        $code = strtoupper(Str::random(6));
        
        // Generate a unique token for this CAPTCHA
        $token = Str::uuid()->toString();
        
        // Store the code in cache for 10 minutes
        Cache::put("captcha:{$token}", $code, now()->addMinutes(10));
        
        // Generate base64 image
        $image = $this->generateCaptchaImage($code);
        
        return response()->json([
            'token' => $token,
            'image' => $image,
            'expires_at' => now()->addMinutes(10)->toISOString(),
        ]);
    }
    
    /**
     * Verify CAPTCHA code
     */
    public function verify(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'answer' => 'required|string|size:6',
        ]);
        
        $storedCode = Cache::get("captcha:{$validated['token']}");
        
        if (!$storedCode) {
            return response()->json([
                'valid' => false,
                'message' => 'CAPTCHA has expired. Please request a new one.',
            ], 400);
        }
        
        $isValid = strtoupper($validated['answer']) === $storedCode;
        
        if ($isValid) {
            // Delete the CAPTCHA after successful verification
            Cache::forget("captcha:{$validated['token']}");
        }
        
        return response()->json([
            'valid' => $isValid,
            'message' => $isValid ? 'CAPTCHA verified successfully.' : 'Invalid CAPTCHA code.',
        ]);
    }
    
    /**
     * Generate CAPTCHA image as base64
     */
    private function generateCaptchaImage(string $code): string
    {
        // Create image (200x60)
        $width = 200;
        $height = 60;
        $image = imagecreatetruecolor($width, $height);
        
        // Colors
        $bgColor = imagecolorallocate($image, 255, 255, 255); // White background
        $textColor = imagecolorallocate($image, 0, 0, 0); // Black text
        $lineColor = imagecolorallocate($image, 200, 200, 200); // Gray lines
        
        // Fill background
        imagefilledrectangle($image, 0, 0, $width, $height, $bgColor);
        
        // Add noise lines
        for ($i = 0; $i < 5; $i++) {
            imageline(
                $image,
                rand(0, $width),
                rand(0, $height),
                rand(0, $width),
                rand(0, $height),
                $lineColor
            );
        }
        
        // Add text
        $fontSize = 20;
        $textWidth = imagefontwidth($fontSize) * strlen($code);
        $x = ($width - $textWidth) / 2;
        $y = ($height - $fontSize) / 2 + 10;
        
        // Add each character with slight variation
        $charSpacing = 25;
        for ($i = 0; $i < strlen($code); $i++) {
            $angle = rand(-15, 15);
            $char_x = 20 + ($i * $charSpacing);
            $char_y = rand(35, 45);
            
            imagestring($image, 5, $char_x, $char_y, $code[$i], $textColor);
        }
        
        // Convert to base64
        ob_start();
        imagepng($image);
        $imageData = ob_get_clean();
        imagedestroy($image);
        
        return 'data:image/png;base64,' . base64_encode($imageData);
    }
}
