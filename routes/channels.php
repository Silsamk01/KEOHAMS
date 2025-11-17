<?php

use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Private user channel for notifications
Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});

// Private chat conversation channel
Broadcast::channel('chat.{conversationId}', function ($user, $conversationId) {
    // Check if user is participant in this conversation
    $conversation = \App\Models\ChatThread::find($conversationId);
    return $conversation && $conversation->participants->contains($user->id);
});

// Private order channel
Broadcast::channel('order.{orderId}', function ($user, $orderId) {
    // Check if user owns this order
    $order = \App\Models\Order::find($orderId);
    return $order && $order->user_id === $user->id;
});

// Public channel for online users
Broadcast::channel('online-users', function ($user) {
    if ($user) {
        return [
            'id' => $user->id,
            'name' => $user->first_name . ' ' . $user->last_name,
        ];
    }
});

// Admin channel for admin-only events
Broadcast::channel('admin', function ($user) {
    return $user->role === 'ADMIN' || $user->role === 'SUPER_ADMIN';
});

// Support channel for admin and support staff
Broadcast::channel('support', function ($user) {
    return in_array($user->role, ['ADMIN', 'SUPER_ADMIN', 'SUPPORT']);
});
