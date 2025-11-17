<?php

namespace App\Jobs;

use App\Models\KYCSubmission;
use App\Models\KYCFaceMatch;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class ProcessFaceMatch implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300; // 5 minutes
    public $tries = 2;

    protected KYCSubmission $kycSubmission;

    /**
     * Create a new job instance.
     */
    public function __construct(KYCSubmission $kycSubmission)
    {
        $this->kycSubmission = $kycSubmission;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            // Ensure both selfie and ID card front are present
            if (!$this->kycSubmission->selfie_path || !$this->kycSubmission->id_card_front_path) {
                Log::warning('Face matching skipped - missing required images', [
                    'kyc_id' => $this->kycSubmission->id,
                ]);
                return;
            }

            // Get full paths
            $selfiePath = Storage::disk('public')->path($this->kycSubmission->selfie_path);
            $idCardPath = Storage::disk('public')->path($this->kycSubmission->id_card_front_path);

            // Verify files exist
            if (!file_exists($selfiePath) || !file_exists($idCardPath)) {
                throw new \Exception('Required image files not found');
            }

            // Perform face matching
            $matchResult = $this->performFaceMatch($selfiePath, $idCardPath);

            // Save result
            KYCFaceMatch::create([
                'kyc_submission_id' => $this->kycSubmission->id,
                'selfie_path' => $this->kycSubmission->selfie_path,
                'id_photo_path' => $this->kycSubmission->id_card_front_path,
                'match_score' => $matchResult['score'],
                'is_match' => $matchResult['is_match'],
                'confidence' => $matchResult['confidence'],
                'algorithm_used' => $matchResult['algorithm'],
                'processing_time' => $matchResult['processing_time'],
                'matched_at' => now(),
            ]);

            // Update KYC submission
            $this->kycSubmission->update([
                'face_match_processed' => true,
                'face_match_score' => $matchResult['score'],
                'face_match_processed_at' => now(),
            ]);

            Log::info('Face matching completed', [
                'kyc_id' => $this->kycSubmission->id,
                'score' => $matchResult['score'],
                'is_match' => $matchResult['is_match'],
            ]);

        } catch (\Exception $e) {
            Log::error('Face matching failed', [
                'kyc_id' => $this->kycSubmission->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Mark as failed
            $this->kycSubmission->update([
                'face_match_processed' => false,
                'face_match_error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Perform face matching using various methods
     */
    protected function performFaceMatch(string $selfiePath, string $idCardPath): array
    {
        $startTime = microtime(true);

        try {
            // Method 1: Use external API (AWS Rekognition, Azure Face API, or similar)
            if (config('services.face_api.enabled')) {
                $result = $this->matchViaAPI($selfiePath, $idCardPath);
                $result['algorithm'] = 'API';
                $result['processing_time'] = microtime(true) - $startTime;
                return $result;
            }

            // Method 2: Use local Python face_recognition library via HTTP call
            if (config('services.face_recognition.enabled')) {
                $result = $this->matchViaPython($selfiePath, $idCardPath);
                $result['algorithm'] = 'face_recognition';
                $result['processing_time'] = microtime(true) - $startTime;
                return $result;
            }

            // Method 3: Basic similarity check (fallback)
            $result = $this->matchViaBasicComparison($selfiePath, $idCardPath);
            $result['algorithm'] = 'basic_similarity';
            $result['processing_time'] = microtime(true) - $startTime;
            return $result;

        } catch (\Exception $e) {
            Log::error('All face matching methods failed', [
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Match faces using external API (AWS Rekognition, Azure Face API, etc.)
     */
    protected function matchViaAPI(string $selfiePath, string $idCardPath): array
    {
        // Example using a generic face matching API
        $apiUrl = config('services.face_api.url');
        $apiKey = config('services.face_api.key');

        $response = Http::timeout(30)
            ->withHeaders(['Authorization' => "Bearer {$apiKey}"])
            ->attach('source_image', file_get_contents($selfiePath), 'selfie.jpg')
            ->attach('target_image', file_get_contents($idCardPath), 'id_card.jpg')
            ->post($apiUrl);

        if (!$response->successful()) {
            throw new \Exception('Face API request failed: ' . $response->body());
        }

        $data = $response->json();

        // Parse API response (adjust based on your API)
        return [
            'score' => $data['similarity'] ?? 0,
            'is_match' => ($data['similarity'] ?? 0) >= 70, // 70% threshold
            'confidence' => $data['confidence'] ?? 0,
        ];
    }

    /**
     * Match faces using Python face_recognition library
     */
    protected function matchViaPython(string $selfiePath, string $idCardPath): array
    {
        // Call a local Python service (you'd need to set this up separately)
        $pythonServiceUrl = config('services.face_recognition.url', 'http://localhost:5000/match');

        $response = Http::timeout(30)
            ->attach('selfie', file_get_contents($selfiePath), 'selfie.jpg')
            ->attach('id_card', file_get_contents($idCardPath), 'id_card.jpg')
            ->post($pythonServiceUrl);

        if (!$response->successful()) {
            throw new \Exception('Python face recognition service failed: ' . $response->body());
        }

        $data = $response->json();

        return [
            'score' => $data['distance'] ? (1 - $data['distance']) * 100 : 0,
            'is_match' => $data['is_match'] ?? false,
            'confidence' => $data['confidence'] ?? 0,
        ];
    }

    /**
     * Basic image similarity comparison (fallback method)
     */
    protected function matchViaBasicComparison(string $selfiePath, string $idCardPath): array
    {
        // Load images
        $selfie = $this->loadImage($selfiePath);
        $idCard = $this->loadImage($idCardPath);

        if (!$selfie || !$idCard) {
            throw new \Exception('Failed to load images for comparison');
        }

        // Resize to same dimensions for comparison
        $width = 200;
        $height = 200;
        $selfie = imagescale($selfie, $width, $height);
        $idCard = imagescale($idCard, $width, $height);

        // Calculate histogram similarity
        $similarity = $this->calculateHistogramSimilarity($selfie, $idCard);

        // Clean up
        imagedestroy($selfie);
        imagedestroy($idCard);

        return [
            'score' => $similarity,
            'is_match' => $similarity >= 60, // 60% threshold for basic method
            'confidence' => $similarity >= 60 ? 70 : 50, // Lower confidence for basic method
        ];
    }

    /**
     * Load image from file
     */
    protected function loadImage(string $path)
    {
        $imageInfo = getimagesize($path);
        
        if (!$imageInfo) {
            return false;
        }

        switch ($imageInfo['mime']) {
            case 'image/jpeg':
                return imagecreatefromjpeg($path);
            case 'image/png':
                return imagecreatefrompng($path);
            case 'image/gif':
                return imagecreatefromgif($path);
            default:
                return false;
        }
    }

    /**
     * Calculate histogram similarity between two images
     */
    protected function calculateHistogramSimilarity($img1, $img2): float
    {
        $histogram1 = $this->getHistogram($img1);
        $histogram2 = $this->getHistogram($img2);

        // Calculate correlation coefficient
        $similarity = 0;
        $maxSimilarity = 0;

        foreach ($histogram1 as $i => $value1) {
            $value2 = $histogram2[$i];
            $similarity += min($value1, $value2);
            $maxSimilarity += max($value1, $value2);
        }

        return $maxSimilarity > 0 ? ($similarity / $maxSimilarity) * 100 : 0;
    }

    /**
     * Get color histogram of image
     */
    protected function getHistogram($image): array
    {
        $histogram = array_fill(0, 256, 0);
        $width = imagesx($image);
        $height = imagesy($image);

        for ($x = 0; $x < $width; $x++) {
            for ($y = 0; $y < $height; $y++) {
                $rgb = imagecolorat($image, $x, $y);
                $r = ($rgb >> 16) & 0xFF;
                $g = ($rgb >> 8) & 0xFF;
                $b = $rgb & 0xFF;
                
                // Convert to grayscale
                $gray = (int)(($r + $g + $b) / 3);
                $histogram[$gray]++;
            }
        }

        return $histogram;
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('Face matching job failed permanently', [
            'kyc_id' => $this->kycSubmission->id,
            'error' => $exception->getMessage(),
        ]);

        $this->kycSubmission->update([
            'face_match_processed' => false,
            'face_match_error' => $exception->getMessage(),
        ]);
    }
}
