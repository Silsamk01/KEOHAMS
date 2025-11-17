@extends('emails.layout')

@section('content')
    <h2>{{ $newsletter->subject }}</h2>

    @if($newsletter->featured_image)
    <div style="margin-bottom: 30px;">
        <img src="{{ $newsletter->featured_image }}" alt="{{ $newsletter->subject }}" style="max-width: 100%; height: auto; border-radius: 8px;">
    </div>
    @endif

    <p>Hi {{ $subscriber->name ?? 'Valued Customer' }},</p>

    <div style="margin: 30px 0;">
        {!! $newsletter->content !!}
    </div>

    @if(isset($newsletter->cta_text) && isset($newsletter->cta_url))
    <div style="text-align: center; margin: 30px 0;">
        <a href="{{ $newsletter->cta_url }}" class="button">{{ $newsletter->cta_text }}</a>
    </div>
    @endif

    <div class="divider"></div>

    @if(isset($featuredProducts) && count($featuredProducts) > 0)
    <h3 style="margin-bottom: 20px;">Featured Products</h3>
    
    <table style="width: 100%; margin-bottom: 30px;">
        <tr>
            @foreach($featuredProducts as $index => $product)
            @if($index % 2 === 0 && $index > 0)
        </tr>
        <tr>
            @endif
            <td style="width: 50%; padding: 10px; vertical-align: top;">
                <div style="border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden;">
                    @if($product->images && count(json_decode($product->images)) > 0)
                    <img src="{{ json_decode($product->images)[0] }}" alt="{{ $product->name }}" style="width: 100%; height: 200px; object-fit: cover;">
                    @endif
                    <div style="padding: 15px;">
                        <h4 style="margin: 0 0 10px 0; font-size: 16px;">{{ $product->name }}</h4>
                        <p style="margin: 0 0 10px 0; font-size: 18px; color: #667eea; font-weight: bold;">
                            ₦{{ number_format($product->price, 2) }}
                        </p>
                        <a href="{{ config('app.url') }}/products/{{ $product->id }}" style="color: #667eea; text-decoration: none; font-size: 14px;">
                            View Product →
                        </a>
                    </div>
                </div>
            </td>
            @endforeach
        </tr>
    </table>
    @endif

    <div class="info-box">
        <p style="text-align: center; margin: 0;">
            You're receiving this newsletter because you subscribed to updates from {{ config('app.name') }}.
            <br>
            <a href="{{ config('app.url') }}/newsletter/unsubscribe/{{ $subscriber->token ?? '' }}" style="color: #667eea; text-decoration: none;">
                Unsubscribe from newsletters
            </a>
        </p>
    </div>

    <p>
        Best regards,<br>
        <strong>The {{ config('app.name') }} Team</strong>
    </p>
@endsection
