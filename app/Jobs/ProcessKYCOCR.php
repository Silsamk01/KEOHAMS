<?php

namespace App\Jobs;

use App\Models\KYCSubmission;
use App\Models\KYCOCRResult;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use thiagoalessio\TesseractOCR\TesseractOCR;

class ProcessKYCOCR implements ShouldQueue
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
            // Process ID card front
            if ($this->kycSubmission->id_card_front_path) {
                $frontText = $this->processImage($this->kycSubmission->id_card_front_path);
                $frontData = $this->extractIDData($frontText);
                
                $this->saveOCRResult('ID_CARD_FRONT', $frontText, $frontData);
            }

            // Process ID card back
            if ($this->kycSubmission->id_card_back_path) {
                $backText = $this->processImage($this->kycSubmission->id_card_back_path);
                $backData = $this->extractIDData($backText);
                
                $this->saveOCRResult('ID_CARD_BACK', $backText, $backData);
            }

            // Process utility bill if provided
            if ($this->kycSubmission->proof_of_address_path) {
                $utilityText = $this->processImage($this->kycSubmission->proof_of_address_path);
                $addressData = $this->extractAddressData($utilityText);
                
                $this->saveOCRResult('PROOF_OF_ADDRESS', $utilityText, $addressData);
            }

            // Update KYC submission status
            $this->kycSubmission->update([
                'ocr_processed' => true,
                'ocr_processed_at' => now(),
            ]);

            Log::info('KYC OCR processing completed', [
                'kyc_id' => $this->kycSubmission->id,
                'user_id' => $this->kycSubmission->user_id,
            ]);

        } catch (\Exception $e) {
            Log::error('KYC OCR processing failed', [
                'kyc_id' => $this->kycSubmission->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Mark as failed
            $this->kycSubmission->update([
                'ocr_processed' => false,
                'ocr_error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Process image with Tesseract OCR
     */
    protected function processImage(string $path): string
    {
        $fullPath = Storage::disk('public')->path($path);

        if (!file_exists($fullPath)) {
            throw new \Exception("File not found: {$path}");
        }

        try {
            $ocr = new TesseractOCR($fullPath);
            $ocr->lang('eng'); // English language
            $ocr->psm(3); // Fully automatic page segmentation
            
            // Improve accuracy with preprocessing
            $ocr->configFile('improve'); // Use improved settings
            
            $text = $ocr->run();

            return $text;

        } catch (\Exception $e) {
            Log::error('Tesseract OCR failed', [
                'path' => $path,
                'error' => $e->getMessage(),
            ]);
            throw new \Exception("OCR processing failed: {$e->getMessage()}");
        }
    }

    /**
     * Extract structured data from ID card text
     */
    protected function extractIDData(string $text): array
    {
        $data = [];

        // Extract common ID patterns (customize based on your country's ID format)
        
        // Name patterns
        if (preg_match('/(?:name|full name|surname)[\s:]+([A-Z\s]+)/i', $text, $matches)) {
            $data['name'] = trim($matches[1]);
        }

        // Date of birth patterns (various formats)
        if (preg_match('/(?:date of birth|dob|born)[\s:]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i', $text, $matches)) {
            $data['date_of_birth'] = trim($matches[1]);
        }

        // ID number patterns
        if (preg_match('/(?:id|id number|card number|identification)[\s:]+([A-Z0-9\-]+)/i', $text, $matches)) {
            $data['id_number'] = trim($matches[1]);
        }

        // Gender
        if (preg_match('/(?:gender|sex)[\s:]+([A-Z]+)/i', $text, $matches)) {
            $data['gender'] = trim($matches[1]);
        }

        // Nationality
        if (preg_match('/(?:nationality|citizen)[\s:]+([A-Z\s]+)/i', $text, $matches)) {
            $data['nationality'] = trim($matches[1]);
        }

        // Expiry date
        if (preg_match('/(?:expiry|expires|valid until)[\s:]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i', $text, $matches)) {
            $data['expiry_date'] = trim($matches[1]);
        }

        return $data;
    }

    /**
     * Extract address data from utility bill or proof of address
     */
    protected function extractAddressData(string $text): array
    {
        $data = [];

        // Extract address lines
        $lines = explode("\n", $text);
        $addressLines = [];
        
        foreach ($lines as $line) {
            $line = trim($line);
            if (!empty($line) && strlen($line) > 10) {
                $addressLines[] = $line;
            }
        }

        $data['full_text'] = implode("\n", $addressLines);

        // Extract postal code patterns
        if (preg_match('/\b\d{5,6}\b/', $text, $matches)) {
            $data['postal_code'] = trim($matches[0]);
        }

        // Extract account number from utility bill
        if (preg_match('/(?:account|acct|meter)[\s#:]+([A-Z0-9\-]+)/i', $text, $matches)) {
            $data['account_number'] = trim($matches[1]);
        }

        return $data;
    }

    /**
     * Save OCR result to database
     */
    protected function saveOCRResult(string $documentType, string $rawText, array $extractedData): void
    {
        KYCOCRResult::create([
            'kyc_submission_id' => $this->kycSubmission->id,
            'document_type' => $documentType,
            'raw_text' => $rawText,
            'extracted_data' => $extractedData,
            'confidence_score' => $this->calculateConfidence($extractedData),
            'processed_at' => now(),
        ]);
    }

    /**
     * Calculate confidence score based on extracted data completeness
     */
    protected function calculateConfidence(array $data): float
    {
        if (empty($data)) {
            return 0.0;
        }

        $expectedFields = ['name', 'date_of_birth', 'id_number'];
        $foundFields = 0;

        foreach ($expectedFields as $field) {
            if (!empty($data[$field])) {
                $foundFields++;
            }
        }

        return ($foundFields / count($expectedFields)) * 100;
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('KYC OCR job failed permanently', [
            'kyc_id' => $this->kycSubmission->id,
            'error' => $exception->getMessage(),
        ]);

        $this->kycSubmission->update([
            'ocr_processed' => false,
            'ocr_error' => $exception->getMessage(),
        ]);
    }
}
