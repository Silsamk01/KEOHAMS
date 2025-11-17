<?php

namespace App\Http\Controllers;

use App\Services\FileUploadService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class UploadController extends Controller
{
    protected $fileUploadService;

    public function __construct(FileUploadService $fileUploadService)
    {
        $this->fileUploadService = $fileUploadService;
    }

    /**
     * Upload product image (Admin only)
     */
    public function uploadProductImage(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
            'product_id' => 'required|integer|exists:products,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $result = $this->fileUploadService->uploadProductImage(
                $request->file('image'),
                $request->product_id
            );

            return response()->json([
                'message' => 'Image uploaded successfully',
                'data' => $result
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Upload failed: ' . $e->getMessage()
            ], 400);
        }
    }

    /**
     * Upload user avatar
     */
    public function uploadAvatar(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'avatar' => 'required|image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $result = $this->fileUploadService->uploadAvatar(
                $request->file('avatar'),
                auth()->id()
            );

            // Update user avatar in database
            auth()->user()->update([
                'avatar' => $result['original']
            ]);

            return response()->json([
                'message' => 'Avatar uploaded successfully',
                'data' => $result
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Upload failed: ' . $e->getMessage()
            ], 400);
        }
    }

    /**
     * Upload blog image (Admin/Editor only)
     */
    public function uploadBlogImage(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
            'post_id' => 'nullable|integer|exists:blog_posts,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $result = $this->fileUploadService->uploadBlogImage(
                $request->file('image'),
                $request->post_id
            );

            return response()->json([
                'message' => 'Image uploaded successfully',
                'data' => $result
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Upload failed: ' . $e->getMessage()
            ], 400);
        }
    }

    /**
     * Upload chat attachment
     */
    public function uploadChatAttachment(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:jpg,jpeg,png,pdf,doc,docx,txt|max:5120',
            'thread_id' => 'required|integer|exists:chat_threads,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Verify user is participant of the thread
        $thread = \App\Models\ChatThread::findOrFail($request->thread_id);
        $isParticipant = $thread->participants()
            ->where('user_id', auth()->id())
            ->exists();

        if (!$isParticipant) {
            return response()->json([
                'message' => 'Unauthorized'
            ], 403);
        }

        try {
            $result = $this->fileUploadService->uploadChatAttachment(
                $request->file('file'),
                $request->thread_id
            );

            return response()->json([
                'message' => 'File uploaded successfully',
                'data' => $result
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Upload failed: ' . $e->getMessage()
            ], 400);
        }
    }

    /**
     * Download KYC document (User can only download their own, Admin can download any)
     */
    public function downloadKycDocument($userId, $filename)
    {
        // Sanitize filename to prevent path traversal
        $filename = basename($filename);
        $filename = preg_replace('/[^a-zA-Z0-9._-]/', '', $filename);
        
        if (empty($filename) || strpos($filename, '..') !== false) {
            return response()->json(['message' => 'Invalid filename'], 400);
        }

        // Check authorization
        if (auth()->id() != $userId && !in_array(auth()->user()->role, ['ADMIN', 'SUPER_ADMIN'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $path = "kyc/{$userId}/{$filename}";

        if (!Storage::disk('kyc')->exists($path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        return Storage::disk('kyc')->download($path);
    }

    /**
     * Download chat attachment (Only thread participants)
     */
    public function downloadChatAttachment($threadId, $filename)
    {
        // Sanitize filename to prevent path traversal
        $filename = basename($filename);
        $filename = preg_replace('/[^a-zA-Z0-9._-]/', '', $filename);
        
        if (empty($filename) || strpos($filename, '..') !== false) {
            return response()->json(['message' => 'Invalid filename'], 400);
        }

        // Verify user is participant
        $thread = \App\Models\ChatThread::findOrFail($threadId);
        $isParticipant = $thread->participants()
            ->where('user_id', auth()->id())
            ->exists();

        if (!$isParticipant && !in_array(auth()->user()->role, ['ADMIN', 'SUPER_ADMIN'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $path = "chat/{$threadId}/{$filename}";

        if (!Storage::disk('chat')->exists($path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        return Storage::disk('chat')->download($path);
    }

    /**
     * Delete uploaded file (Admin only, or user's own avatar)
     */
    public function deleteFile(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'path' => 'required|string',
            'disk' => 'required|string|in:products,avatars,blog,chat',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Authorization check
        $isAdmin = in_array(auth()->user()->role, ['ADMIN', 'SUPER_ADMIN']);
        $isOwnAvatar = $request->disk === 'avatars' && strpos($request->path, 'avatars/' . auth()->id()) === 0;

        if (!$isAdmin && !$isOwnAvatar) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $this->fileUploadService->deleteFile($request->path, $request->disk);

            return response()->json([
                'message' => 'File deleted successfully'
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Delete failed: ' . $e->getMessage()
            ], 400);
        }
    }

    /**
     * Get file information
     */
    public function getFileInfo(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'path' => 'required|string',
            'disk' => 'required|string|in:products,avatars,blog,kyc,chat,public',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        if (!$this->fileUploadService->exists($request->path, $request->disk)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        $disk = Storage::disk($request->disk);

        return response()->json([
            'exists' => true,
            'size' => $disk->size($request->path),
            'last_modified' => $disk->lastModified($request->path),
            'mime_type' => $disk->mimeType($request->path),
            'url' => in_array($request->disk, ['products', 'avatars', 'blog', 'public']) 
                ? $disk->url($request->path) 
                : null,
        ], 200);
    }
}
