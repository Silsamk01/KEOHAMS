<?php

namespace App\Jobs;

use App\Models\KYCSubmission;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class ProcessDocumentQuality implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 180; // 3 minutes
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
            $qualityResults = [];

            // Check ID card front quality
            if ($this->kycSubmission->id_card_front_path) {
                $qualityResults['id_card_front'] = $this->checkImageQuality(
                    $this->kycSubmission->id_card_front_path,
                    'ID_CARD_FRONT'
                );
            }

            // Check ID card back quality
            if ($this->kycSubmission->id_card_back_path) {
                $qualityResults['id_card_back'] = $this->checkImageQuality(
                    $this->kycSubmission->id_card_back_path,
                    'ID_CARD_BACK'
                );
            }

            // Check selfie quality
            if ($this->kycSubmission->selfie_path) {
                $qualityResults['selfie'] = $this->checkImageQuality(
                    $this->kycSubmission->selfie_path,
                    'SELFIE'
                );
            }

            // Check proof of address quality
            if ($this->kycSubmission->proof_of_address_path) {
                $qualityResults['proof_of_address'] = $this->checkImageQuality(
                    $this->kycSubmission->proof_of_address_path,
                    'PROOF_OF_ADDRESS'
                );
            }

            // Calculate overall quality score
            $overallScore = $this->calculateOverallQuality($qualityResults);

            // Update KYC submission
            $this->kycSubmission->update([
                'quality_check_processed' => true,
                'quality_check_score' => $overallScore,
                'quality_check_results' => $qualityResults,
                'quality_check_processed_at' => now(),
            ]);

            Log::info('Document quality check completed', [
                'kyc_id' => $this->kycSubmission->id,
                'overall_score' => $overallScore,
            ]);

        } catch (\Exception $e) {
            Log::error('Document quality check failed', [
                'kyc_id' => $this->kycSubmission->id,
                'error' => $e->getMessage(),
            ]);

            $this->kycSubmission->update([
                'quality_check_processed' => false,
                'quality_check_error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Check image quality
     */
    protected function checkImageQuality(string $path, string $documentType): array
    {
        $fullPath = Storage::disk('public')->path($path);

        if (!file_exists($fullPath)) {
            throw new \Exception("File not found: {$path}");
        }

        $quality = [
            'document_type' => $documentType,
            'checks' => [],
            'overall_score' => 0,
            'passed' => false,
        ];

        // Check 1: File size (should be reasonable)
        $fileSize = filesize($fullPath);
        $fileSizeCheck = $this->checkFileSize($fileSize);
        $quality['checks']['file_size'] = $fileSizeCheck;

        // Check 2: Image dimensions
        $imageInfo = getimagesize($fullPath);
        if ($imageInfo) {
            $dimensionsCheck = $this->checkDimensions($imageInfo[0], $imageInfo[1]);
            $quality['checks']['dimensions'] = $dimensionsCheck;

            // Load image for further checks
            $image = $this->loadImage($fullPath, $imageInfo['mime']);

            if ($image) {
                // Check 3: Brightness
                $brightnessCheck = $this->checkBrightness($image);
                $quality['checks']['brightness'] = $brightnessCheck;

                // Check 4: Sharpness/Blur detection
                $sharpnessCheck = $this->checkSharpness($image);
                $quality['checks']['sharpness'] = $sharpnessCheck;

                // Check 5: Color distribution
                $colorCheck = $this->checkColorDistribution($image);
                $quality['checks']['color_distribution'] = $colorCheck;

                imagedestroy($image);
            }
        }

        // Calculate overall score
        $totalScore = 0;
        $checkCount = count($quality['checks']);

        foreach ($quality['checks'] as $check) {
            $totalScore += $check['score'];
        }

        $quality['overall_score'] = $checkCount > 0 ? $totalScore / $checkCount : 0;
        $quality['passed'] = $quality['overall_score'] >= 70; // 70% threshold

        return $quality;
    }

    /**
     * Check file size
     */
    protected function checkFileSize(int $size): array
    {
        $minSize = 50 * 1024; // 50 KB
        $maxSize = 10 * 1024 * 1024; // 10 MB
        
        $score = 100;
        $status = 'GOOD';
        $message = 'File size is appropriate';

        if ($size < $minSize) {
            $score = 40;
            $status = 'POOR';
            $message = 'File size too small - image quality may be insufficient';
        } elseif ($size > $maxSize) {
            $score = 60;
            $status = 'WARNING';
            $message = 'File size very large - may indicate unoptimized image';
        }

        return [
            'score' => $score,
            'status' => $status,
            'message' => $message,
            'value' => round($size / 1024, 2) . ' KB',
        ];
    }

    /**
     * Check image dimensions
     */
    protected function checkDimensions(int $width, int $height): array
    {
        $minWidth = 600;
        $minHeight = 400;
        $maxWidth = 5000;
        $maxHeight = 5000;

        $score = 100;
        $status = 'GOOD';
        $message = 'Image dimensions are appropriate';

        if ($width < $minWidth || $height < $minHeight) {
            $score = 50;
            $status = 'POOR';
            $message = 'Image resolution too low';
        } elseif ($width > $maxWidth || $height > $maxHeight) {
            $score = 80;
            $status = 'WARNING';
            $message = 'Image resolution very high - may slow processing';
        }

        return [
            'score' => $score,
            'status' => $status,
            'message' => $message,
            'value' => "{$width}x{$height}",
        ];
    }

    /**
     * Check image brightness
     */
    protected function checkBrightness($image): array
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $totalBrightness = 0;
        $pixelCount = 0;

        // Sample pixels (not every pixel for performance)
        $step = 10;
        for ($x = 0; $x < $width; $x += $step) {
            for ($y = 0; $y < $height; $y += $step) {
                $rgb = imagecolorat($image, $x, $y);
                $r = ($rgb >> 16) & 0xFF;
                $g = ($rgb >> 8) & 0xFF;
                $b = $rgb & 0xFF;
                
                $brightness = ($r + $g + $b) / 3;
                $totalBrightness += $brightness;
                $pixelCount++;
            }
        }

        $avgBrightness = $pixelCount > 0 ? $totalBrightness / $pixelCount : 0;

        $score = 100;
        $status = 'GOOD';
        $message = 'Image brightness is appropriate';

        if ($avgBrightness < 50) {
            $score = 60;
            $status = 'WARNING';
            $message = 'Image is too dark';
        } elseif ($avgBrightness > 200) {
            $score = 60;
            $status = 'WARNING';
            $message = 'Image is too bright (overexposed)';
        }

        return [
            'score' => $score,
            'status' => $status,
            'message' => $message,
            'value' => round($avgBrightness, 2),
        ];
    }

    /**
     * Check image sharpness (blur detection)
     */
    protected function checkSharpness($image): array
    {
        // Use Laplacian variance method for blur detection
        $width = imagesx($image);
        $height = imagesy($image);
        
        $laplacianSum = 0;
        $pixelCount = 0;

        // Laplacian kernel
        $kernel = [
            [0, 1, 0],
            [1, -4, 1],
            [0, 1, 0]
        ];

        // Sample area (center of image)
        $startX = (int)($width * 0.25);
        $endX = (int)($width * 0.75);
        $startY = (int)($height * 0.25);
        $endY = (int)($height * 0.75);

        for ($x = $startX; $x < $endX - 1; $x++) {
            for ($y = $startY; $y < $endY - 1; $y++) {
                $value = 0;
                for ($kx = 0; $kx < 3; $kx++) {
                    for ($ky = 0; $ky < 3; $ky++) {
                        $px = $x + $kx - 1;
                        $py = $y + $ky - 1;
                        
                        if ($px >= 0 && $px < $width && $py >= 0 && $py < $height) {
                            $rgb = imagecolorat($image, $px, $py);
                            $gray = (($rgb >> 16) & 0xFF) + (($rgb >> 8) & 0xFF) + ($rgb & 0xFF);
                            $gray = $gray / 3;
                            $value += $gray * $kernel[$kx][$ky];
                        }
                    }
                }
                $laplacianSum += abs($value);
                $pixelCount++;
            }
        }

        $variance = $pixelCount > 0 ? $laplacianSum / $pixelCount : 0;

        $score = 100;
        $status = 'GOOD';
        $message = 'Image is sharp and clear';

        if ($variance < 10) {
            $score = 40;
            $status = 'POOR';
            $message = 'Image is blurry';
        } elseif ($variance < 20) {
            $score = 70;
            $status = 'WARNING';
            $message = 'Image sharpness is acceptable but could be better';
        }

        return [
            'score' => $score,
            'status' => $status,
            'message' => $message,
            'value' => round($variance, 2),
        ];
    }

    /**
     * Check color distribution
     */
    protected function checkColorDistribution($image): array
    {
        $width = imagesx($image);
        $height = imagesy($image);
        
        $colorCount = [];
        $step = 10;

        for ($x = 0; $x < $width; $x += $step) {
            for ($y = 0; $y < $height; $y += $step) {
                $rgb = imagecolorat($image, $x, $y);
                $colorKey = ($rgb >> 20) & 0xFF; // Simplified color key
                
                if (!isset($colorCount[$colorKey])) {
                    $colorCount[$colorKey] = 0;
                }
                $colorCount[$colorKey]++;
            }
        }

        $uniqueColors = count($colorCount);
        
        $score = 100;
        $status = 'GOOD';
        $message = 'Color distribution is good';

        if ($uniqueColors < 10) {
            $score = 60;
            $status = 'WARNING';
            $message = 'Limited color range - may indicate poor lighting or image quality';
        }

        return [
            'score' => $score,
            'status' => $status,
            'message' => $message,
            'value' => $uniqueColors,
        ];
    }

    /**
     * Load image from file
     */
    protected function loadImage(string $path, string $mime)
    {
        switch ($mime) {
            case 'image/jpeg':
                return @imagecreatefromjpeg($path);
            case 'image/png':
                return @imagecreatefrompng($path);
            case 'image/gif':
                return @imagecreatefromgif($path);
            default:
                return false;
        }
    }

    /**
     * Calculate overall quality from all checks
     */
    protected function calculateOverallQuality(array $results): float
    {
        if (empty($results)) {
            return 0;
        }

        $totalScore = 0;
        $count = 0;

        foreach ($results as $result) {
            $totalScore += $result['overall_score'];
            $count++;
        }

        return $count > 0 ? $totalScore / $count : 0;
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('Document quality check job failed permanently', [
            'kyc_id' => $this->kycSubmission->id,
            'error' => $exception->getMessage(),
        ]);

        $this->kycSubmission->update([
            'quality_check_processed' => false,
            'quality_check_error' => $exception->getMessage(),
        ]);
    }
}
