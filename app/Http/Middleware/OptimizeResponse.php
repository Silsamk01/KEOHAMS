<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class OptimizeResponse
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Add performance headers
        $response->headers->set('X-Response-Time', $this->getResponseTime());
        
        // Enable compression if supported
        if ($this->shouldCompress($request, $response)) {
            $this->compressResponse($response);
        }

        // Set cache headers for static assets
        if ($this->isStaticAsset($request)) {
            $response->headers->set('Cache-Control', 'public, max-age=31536000, immutable');
        }

        // Add security headers
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        return $response;
    }

    /**
     * Get response time in milliseconds
     */
    private function getResponseTime(): string
    {
        if (defined('LARAVEL_START')) {
            $time = round((microtime(true) - LARAVEL_START) * 1000, 2);
            return $time . 'ms';
        }

        return '0ms';
    }

    /**
     * Check if response should be compressed
     */
    private function shouldCompress(Request $request, Response $response): bool
    {
        // Check if compression is enabled
        if (!config('performance.compression.enabled', true)) {
            return false;
        }

        // Check if client accepts compression
        $acceptEncoding = $request->header('Accept-Encoding', '');
        if (!str_contains($acceptEncoding, 'gzip')) {
            return false;
        }

        // Check content type
        $contentType = $response->headers->get('Content-Type', '');
        $compressibleTypes = [
            'text/html',
            'text/plain',
            'text/css',
            'text/javascript',
            'application/javascript',
            'application/json',
            'application/xml',
        ];

        foreach ($compressibleTypes as $type) {
            if (str_contains($contentType, $type)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Compress response content
     */
    private function compressResponse(Response $response): void
    {
        $content = $response->getContent();
        
        if (empty($content)) {
            return;
        }

        // Only compress if content is larger than minimum size
        $minSize = config('performance.compression.min_size', 1024);
        if (strlen($content) < $minSize) {
            return;
        }

        $compressed = gzencode($content, config('performance.compression.level', 6));
        
        if ($compressed !== false) {
            $response->setContent($compressed);
            $response->headers->set('Content-Encoding', 'gzip');
            $response->headers->set('Content-Length', strlen($compressed));
        }
    }

    /**
     * Check if request is for static asset
     */
    private function isStaticAsset(Request $request): bool
    {
        $path = $request->path();
        $extensions = ['css', 'js', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'woff', 'woff2', 'ttf', 'otf'];
        
        foreach ($extensions as $ext) {
            if (str_ends_with($path, '.' . $ext)) {
                return true;
            }
        }

        return false;
    }
}
