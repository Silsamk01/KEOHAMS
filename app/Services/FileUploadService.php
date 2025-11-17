<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Facades\Image;

class FileUploadService
{
    /**
     * Allowed file types configuration
     */
    private const ALLOWED_TYPES = [
        'image' => ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        'document' => ['pdf', 'jpg', 'jpeg', 'png'],
        'avatar' => ['jpg', 'jpeg', 'png', 'webp'],
        'chat' => ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'txt'],
    ];

    /**
     * Maximum file sizes in bytes
     */
    private const MAX_SIZES = [
        'image' => 5 * 1024 * 1024,      // 5MB
        'document' => 10 * 1024 * 1024,  // 10MB
        'avatar' => 2 * 1024 * 1024,     // 2MB
        'chat' => 5 * 1024 * 1024,       // 5MB
    ];

    /**
     * Image dimensions configuration
     */
    private const IMAGE_SIZES = [
        'product' => [
            'thumbnail' => [200, 200],
            'medium' => [600, 600],
            'large' => [1200, 1200],
        ],
        'avatar' => [
            'small' => [50, 50],
            'medium' => [150, 150],
            'large' => [300, 300],
        ],
        'blog' => [
            'thumbnail' => [300, 200],
            'medium' => [800, 600],
            'large' => [1600, 1200],
        ],
    ];

    /**
     * Upload product image
     */
    public function uploadProductImage(UploadedFile $file, int $productId): array
    {
        $this->validateFile($file, 'image');

        $filename = $this->generateFilename($file);
        $path = "products/{$productId}";

        // Store original
        $originalPath = Storage::disk('products')->putFileAs($path, $file, $filename);

        // Generate thumbnails
        $thumbnails = $this->generateThumbnails(
            $file,
            'products',
            $path,
            $filename,
            'product'
        );

        return [
            'original' => Storage::disk('products')->url($originalPath),
            'thumbnails' => $thumbnails,
            'path' => $originalPath,
        ];
    }

    /**
     * Upload KYC document
     */
    public function uploadKycDocument(UploadedFile $file, int $userId, string $type): array
    {
        $this->validateFile($file, 'document');

        $filename = $this->generateFilename($file, $type);
        $path = "kyc/{$userId}";

        // Store in private storage
        $filePath = Storage::disk('kyc')->putFileAs($path, $file, $filename);

        return [
            'path' => $filePath,
            'filename' => $filename,
            'size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'extension' => $file->getClientOriginalExtension(),
        ];
    }

    /**
     * Upload user avatar
     */
    public function uploadAvatar(UploadedFile $file, int $userId): array
    {
        $this->validateFile($file, 'avatar');

        $filename = $this->generateFilename($file);
        $path = "avatars/{$userId}";

        // Delete old avatars
        Storage::disk('avatars')->deleteDirectory($path);

        // Store original
        $originalPath = Storage::disk('avatars')->putFileAs($path, $file, $filename);

        // Generate sizes
        $sizes = $this->generateThumbnails(
            $file,
            'avatars',
            $path,
            $filename,
            'avatar'
        );

        return [
            'original' => Storage::disk('avatars')->url($originalPath),
            'sizes' => $sizes,
            'path' => $originalPath,
        ];
    }

    /**
     * Upload blog image
     */
    public function uploadBlogImage(UploadedFile $file, ?int $postId = null): array
    {
        $this->validateFile($file, 'image');

        $filename = $this->generateFilename($file);
        $path = $postId ? "blog/{$postId}" : 'blog/temp';

        // Store original
        $originalPath = Storage::disk('blog')->putFileAs($path, $file, $filename);

        // Generate thumbnails
        $thumbnails = $this->generateThumbnails(
            $file,
            'blog',
            $path,
            $filename,
            'blog'
        );

        return [
            'original' => Storage::disk('blog')->url($originalPath),
            'thumbnails' => $thumbnails,
            'path' => $originalPath,
        ];
    }

    /**
     * Upload chat attachment
     */
    public function uploadChatAttachment(UploadedFile $file, int $threadId): array
    {
        $this->validateFile($file, 'chat');

        $filename = $this->generateFilename($file);
        $path = "chat/{$threadId}";

        $filePath = Storage::disk('chat')->putFileAs($path, $file, $filename);

        return [
            'path' => $filePath,
            'filename' => $file->getClientOriginalName(),
            'size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'extension' => $file->getClientOriginalExtension(),
        ];
    }

    /**
     * Validate uploaded file
     */
    private function validateFile(UploadedFile $file, string $type): void
    {
        // Check if file is valid
        if (!$file->isValid()) {
            throw new \InvalidArgumentException('Invalid file upload');
        }

        // Validate MIME type (not just extension)
        $allowedMimes = [
            'image' => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            'document' => ['application/pdf', 'image/jpeg', 'image/png'],
            'avatar' => ['image/jpeg', 'image/png', 'image/webp'],
            'chat' => [
                'image/jpeg', 'image/png', 'application/pdf', 
                'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain'
            ],
        ];

        $mime = $file->getMimeType();
        if (!in_array($mime, $allowedMimes[$type] ?? [])) {
            throw new \InvalidArgumentException("Invalid file MIME type: {$mime}");
        }

        // Check file extension
        $extension = strtolower($file->getClientOriginalExtension());
        if (!in_array($extension, self::ALLOWED_TYPES[$type] ?? [])) {
            throw new \InvalidArgumentException(
                "Invalid file type. Allowed types: " . implode(', ', self::ALLOWED_TYPES[$type] ?? [])
            );
        }

        // Check for double extensions (e.g., file.php.jpg)
        if (preg_match('/\.(php|phtml|php3|php4|php5|exe|sh|bat)\./', $file->getClientOriginalName())) {
            throw new \InvalidArgumentException('Suspicious file name detected');
        }

        // Check file size
        $maxSize = self::MAX_SIZES[$type] ?? 5 * 1024 * 1024;
        if ($file->getSize() > $maxSize) {
            $maxSizeMB = round($maxSize / 1024 / 1024, 2);
            throw new \InvalidArgumentException("File size exceeds maximum of {$maxSizeMB}MB");
        }

        // Validate image dimensions for image types
        if (in_array($type, ['image', 'avatar']) && $this->isImage($file)) {
            $dimensions = getimagesize($file->getRealPath());
            if (!$dimensions) {
                throw new \InvalidArgumentException('Invalid image file');
            }

            // Check minimum dimensions
            if ($dimensions[0] < 100 || $dimensions[1] < 100) {
                throw new \InvalidArgumentException('Image dimensions too small (minimum 100x100)');
            }

            // Check maximum dimensions
            if ($dimensions[0] > 4096 || $dimensions[1] > 4096) {
                throw new \InvalidArgumentException('Image dimensions too large (maximum 4096x4096)');
            }
        }
    }

    /**
     * Generate unique filename
     */
    private function generateFilename(UploadedFile $file, ?string $prefix = null): string
    {
        $extension = $file->getClientOriginalExtension();
        $hash = Str::random(32);
        
        if ($prefix) {
            return "{$prefix}_{$hash}.{$extension}";
        }

        return "{$hash}.{$extension}";
    }

    /**
     * Generate image thumbnails
     */
    private function generateThumbnails(
        UploadedFile $file,
        string $disk,
        string $path,
        string $filename,
        string $sizeType
    ): array {
        if (!$this->isImage($file)) {
            return [];
        }

        $sizes = self::IMAGE_SIZES[$sizeType] ?? [];
        $thumbnails = [];

        foreach ($sizes as $sizeName => [$width, $height]) {
            $thumbnailFilename = $this->getThumbnailFilename($filename, $sizeName);
            $thumbnailPath = "{$path}/{$thumbnailFilename}";

            // Create thumbnail
            $image = Image::make($file->getRealPath());
            $image->fit($width, $height, function ($constraint) {
                $constraint->aspectRatio();
                $constraint->upsize();
            });

            // Save thumbnail
            $thumbnailFullPath = Storage::disk($disk)->path($thumbnailPath);
            $this->ensureDirectoryExists(dirname($thumbnailFullPath));
            $image->save($thumbnailFullPath, 90);

            $thumbnails[$sizeName] = Storage::disk($disk)->url($thumbnailPath);
        }

        return $thumbnails;
    }

    /**
     * Get thumbnail filename
     */
    private function getThumbnailFilename(string $filename, string $size): string
    {
        $info = pathinfo($filename);
        return "{$info['filename']}_{$size}.{$info['extension']}";
    }

    /**
     * Check if file is an image
     */
    private function isImage(UploadedFile $file): bool
    {
        return strpos($file->getMimeType(), 'image/') === 0;
    }

    /**
     * Ensure directory exists
     */
    private function ensureDirectoryExists(string $directory): void
    {
        if (!is_dir($directory)) {
            mkdir($directory, 0755, true);
        }
    }

    /**
     * Delete file
     */
    public function deleteFile(string $path, string $disk = 'public'): bool
    {
        return Storage::disk($disk)->delete($path);
    }

    /**
     * Delete directory
     */
    public function deleteDirectory(string $path, string $disk = 'public'): bool
    {
        return Storage::disk($disk)->deleteDirectory($path);
    }

    /**
     * Get file URL
     */
    public function getUrl(string $path, string $disk = 'public'): string
    {
        return Storage::disk($disk)->url($path);
    }

    /**
     * Check if file exists
     */
    public function exists(string $path, string $disk = 'public'): bool
    {
        return Storage::disk($disk)->exists($path);
    }

    /**
     * Get file contents (for private files)
     */
    public function getContents(string $path, string $disk = 'private'): string
    {
        return Storage::disk($disk)->get($path);
    }

    /**
     * Move file from temp to permanent storage
     */
    public function moveFromTemp(string $tempPath, string $permanentPath, string $disk = 'public'): string
    {
        Storage::disk($disk)->move($tempPath, $permanentPath);
        return $permanentPath;
    }

    /**
     * Clean up old temporary files (older than 24 hours)
     */
    public function cleanupTempFiles(): int
    {
        $files = Storage::disk('temp')->allFiles();
        $deleted = 0;

        foreach ($files as $file) {
            $lastModified = Storage::disk('temp')->lastModified($file);
            if (time() - $lastModified > 86400) { // 24 hours
                Storage::disk('temp')->delete($file);
                $deleted++;
            }
        }

        return $deleted;
    }
}
