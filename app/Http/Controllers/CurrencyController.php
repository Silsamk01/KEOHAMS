<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class CurrencyController extends Controller
{
    /**
     * Get exchange rates
     * Returns rates relative to USD as base currency
     */
    public function getRates(Request $request)
    {
        $base = $request->input('base', 'USD');
        
        // Try to get rates from cache (1 hour)
        $cacheKey = "currency_rates:{$base}";
        $rates = Cache::remember($cacheKey, 3600, function () use ($base) {
            return $this->fetchExchangeRates($base);
        });
        
        if (!$rates) {
            return response()->json([
                'message' => 'Unable to fetch exchange rates.',
                'rates' => $this->getDefaultRates(),
            ], 500);
        }
        
        return response()->json([
            'base' => $base,
            'rates' => $rates,
            'timestamp' => now()->toISOString(),
        ]);
    }
    
    /**
     * Convert amount from one currency to another
     */
    public function convert(Request $request)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0',
            'from' => 'required|string|size:3',
            'to' => 'required|string|size:3',
        ]);
        
        $amount = $validated['amount'];
        $from = strtoupper($validated['from']);
        $to = strtoupper($validated['to']);
        
        // If same currency, no conversion needed
        if ($from === $to) {
            return response()->json([
                'amount' => $amount,
                'from' => $from,
                'to' => $to,
                'converted' => $amount,
                'rate' => 1,
            ]);
        }
        
        // Get rates from USD
        $rates = Cache::remember('currency_rates:USD', 3600, function () {
            return $this->fetchExchangeRates('USD');
        });
        
        if (!$rates || !isset($rates[$from]) || !isset($rates[$to])) {
            return response()->json([
                'message' => 'Currency conversion not available for the selected currencies.',
            ], 400);
        }
        
        // Convert from -> USD -> to
        $amountInUSD = $amount / $rates[$from];
        $converted = $amountInUSD * $rates[$to];
        $rate = $rates[$to] / $rates[$from];
        
        return response()->json([
            'amount' => $amount,
            'from' => $from,
            'to' => $to,
            'converted' => round($converted, 2),
            'rate' => round($rate, 6),
            'timestamp' => now()->toISOString(),
        ]);
    }
    
    /**
     * Fetch exchange rates from API
     */
    private function fetchExchangeRates(string $base): ?array
    {
        try {
            // Using exchangerate-api.com (free tier)
            $apiKey = env('EXCHANGE_RATE_API_KEY', '');
            
            if ($apiKey) {
                $response = Http::timeout(10)->get("https://v6.exchangerate-api.com/v6/{$apiKey}/latest/{$base}");
                
                if ($response->successful()) {
                    $data = $response->json();
                    if (isset($data['conversion_rates'])) {
                        return $data['conversion_rates'];
                    }
                }
            }
            
            // Fallback to default rates if API fails
            return $this->getDefaultRates();
            
        } catch (\Exception $e) {
            \Log::error('Currency API error: ' . $e->getMessage());
            return $this->getDefaultRates();
        }
    }
    
    /**
     * Get default hardcoded exchange rates (fallback)
     * Rates relative to 1 USD
     */
    private function getDefaultRates(): array
    {
        return [
            'USD' => 1.00,
            'EUR' => 0.92,
            'GBP' => 0.79,
            'JPY' => 149.50,
            'AUD' => 1.53,
            'CAD' => 1.36,
            'CHF' => 0.88,
            'CNY' => 7.24,
            'INR' => 83.12,
            'NGN' => 1575.00,
            'ZAR' => 18.50,
            'BRL' => 4.95,
            'MXN' => 17.10,
            'RUB' => 92.50,
            'KRW' => 1320.00,
            'SGD' => 1.34,
            'HKD' => 7.82,
            'NOK' => 10.75,
            'SEK' => 10.85,
            'DKK' => 6.87,
        ];
    }
}
