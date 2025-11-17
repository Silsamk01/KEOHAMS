<?php

namespace App\Http\Controllers;

use App\Models\SupportTicket;
use App\Models\TicketMessage;
use App\Models\ActivityLog;
use App\Mail\TicketResponseEmail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class SupportController extends Controller
{
    /**
     * Get all tickets for authenticated user
     */
    public function index(Request $request)
    {
        $query = SupportTicket::with(['messages' => function($query) {
            $query->latest()->limit(1);
        }])
        ->where('user_id', $request->user()->id);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $tickets = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($tickets);
    }

    /**
     * Get single ticket
     */
    public function show(Request $request, $id)
    {
        $ticket = SupportTicket::with(['user', 'assignedTo', 'messages.user'])
            ->findOrFail($id);

        // Check if user owns ticket or is admin/support
        if ($ticket->user_id !== $request->user()->id && 
            !in_array($request->user()->role, ['ADMIN', 'SUPPORT', 'MANAGER'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return response()->json($ticket);
    }

    /**
     * Create support ticket
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'category' => 'required|in:TECHNICAL,BILLING,PRODUCT,SHIPPING,ACCOUNT,KYC,OTHER',
            'priority' => 'required|in:LOW,MEDIUM,HIGH,URGENT',
            'description' => 'required|string',
        ]);

        $ticket = SupportTicket::create([
            'user_id' => $request->user()->id,
            'ticket_number' => 'TKT-' . strtoupper(uniqid()),
            'subject' => $validated['subject'],
            'category' => $validated['category'],
            'priority' => $validated['priority'],
            'description' => $validated['description'],
            'status' => 'OPEN',
        ]);

        // Create initial message
        TicketMessage::create([
            'ticket_id' => $ticket->id,
            'user_id' => $request->user()->id,
            'message' => $validated['description'],
            'is_admin' => false,
        ]);

        ActivityLog::log('SUPPORT_TICKET_CREATED', $request->user()->id, 'Support ticket created', [
            'ticket_id' => $ticket->id,
            'ticket_number' => $ticket->ticket_number,
        ]);

        return response()->json([
            'message' => 'Support ticket created successfully.',
            'ticket' => $ticket
        ], 201);
    }

    /**
     * Add message to ticket
     */
    public function addMessage(Request $request, $id)
    {
        $validated = $request->validate([
            'message' => 'required|string',
        ]);

        $ticket = SupportTicket::findOrFail($id);

        // Check if user owns ticket or is admin/support
        if ($ticket->user_id !== $request->user()->id && 
            !in_array($request->user()->role, ['ADMIN', 'SUPPORT', 'MANAGER'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        // Check if ticket is closed
        if ($ticket->status === 'CLOSED') {
            return response()->json(['message' => 'Cannot add message to closed ticket.'], 400);
        }

        $isAdmin = in_array($request->user()->role, ['ADMIN', 'SUPPORT', 'MANAGER']);

        $message = TicketMessage::create([
            'ticket_id' => $ticket->id,
            'user_id' => $request->user()->id,
            'message' => $validated['message'],
            'is_admin' => $isAdmin,
        ]);

        // Update ticket status if customer replied
        if (!$isAdmin && $ticket->status === 'WAITING_CUSTOMER') {
            $ticket->update(['status' => 'WAITING_ADMIN']);
        }

        // Update ticket timestamp
        $ticket->touch();

        ActivityLog::log('SUPPORT_MESSAGE_ADDED', $request->user()->id, 'Message added to support ticket', [
            'ticket_id' => $ticket->id,
        ]);

        // Send email notification if message is from admin/support to customer
        if ($isAdmin) {
            Mail::to($ticket->user->email)->queue(new TicketResponseEmail($ticket, $message));
        }

        return response()->json([
            'message' => 'Message added successfully.',
            'data' => $message->load('user')
        ], 201);
    }

    /**
     * Close ticket
     */
    public function close(Request $request, $id)
    {
        $ticket = SupportTicket::findOrFail($id);

        // Check if user owns ticket or is admin/support
        if ($ticket->user_id !== $request->user()->id && 
            !in_array($request->user()->role, ['ADMIN', 'SUPPORT', 'MANAGER'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $ticket->update([
            'status' => 'CLOSED',
            'closed_at' => now(),
        ]);

        ActivityLog::log('SUPPORT_TICKET_CLOSED', $request->user()->id, 'Support ticket closed', [
            'ticket_id' => $ticket->id,
        ]);

        return response()->json([
            'message' => 'Ticket closed successfully.',
            'ticket' => $ticket
        ]);
    }

    /**
     * Reopen ticket
     */
    public function reopen(Request $request, $id)
    {
        $ticket = SupportTicket::findOrFail($id);

        // Check if user owns ticket or is admin/support
        if ($ticket->user_id !== $request->user()->id && 
            !in_array($request->user()->role, ['ADMIN', 'SUPPORT', 'MANAGER'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $ticket->update([
            'status' => 'OPEN',
            'closed_at' => null,
        ]);

        ActivityLog::log('SUPPORT_TICKET_REOPENED', $request->user()->id, 'Support ticket reopened', [
            'ticket_id' => $ticket->id,
        ]);

        return response()->json([
            'message' => 'Ticket reopened successfully.',
            'ticket' => $ticket
        ]);
    }

    /**
     * Get all tickets (Admin/Support)
     */
    public function adminIndex(Request $request)
    {
        $query = SupportTicket::with(['user', 'assignedTo']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by category
        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        // Filter by priority
        if ($request->has('priority')) {
            $query->where('priority', $request->priority);
        }

        // Filter by assigned user
        if ($request->has('assigned_to')) {
            $query->where('assigned_to', $request->assigned_to);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('ticket_number', 'LIKE', "%{$search}%")
                  ->orWhere('subject', 'LIKE', "%{$search}%")
                  ->orWhereHas('user', function($q2) use ($search) {
                      $q2->where('first_name', 'LIKE', "%{$search}%")
                         ->orWhere('last_name', 'LIKE', "%{$search}%")
                         ->orWhere('email', 'LIKE', "%{$search}%");
                  });
            });
        }

        $tickets = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($tickets);
    }

    /**
     * Assign ticket (Admin/Support)
     */
    public function assign(Request $request, $id)
    {
        $validated = $request->validate([
            'assigned_to' => 'required|exists:users,id',
        ]);

        $ticket = SupportTicket::findOrFail($id);

        $ticket->update([
            'assigned_to' => $validated['assigned_to'],
            'status' => 'IN_PROGRESS',
        ]);

        ActivityLog::log('SUPPORT_TICKET_ASSIGNED', $request->user()->id, 'Support ticket assigned', [
            'ticket_id' => $ticket->id,
            'assigned_to' => $validated['assigned_to'],
        ]);

        return response()->json([
            'message' => 'Ticket assigned successfully.',
            'ticket' => $ticket->load('assignedTo')
        ]);
    }

    /**
     * Update ticket status (Admin/Support)
     */
    public function updateStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => 'required|in:OPEN,IN_PROGRESS,WAITING_CUSTOMER,WAITING_ADMIN,RESOLVED,CLOSED',
        ]);

        $ticket = SupportTicket::findOrFail($id);

        $ticket->update(['status' => $validated['status']]);

        if ($validated['status'] === 'CLOSED') {
            $ticket->update(['closed_at' => now()]);
        }

        ActivityLog::log('SUPPORT_TICKET_STATUS_UPDATED', $request->user()->id, 'Support ticket status updated', [
            'ticket_id' => $ticket->id,
            'status' => $validated['status'],
        ]);

        return response()->json([
            'message' => 'Ticket status updated successfully.',
            'ticket' => $ticket
        ]);
    }

    /**
     * Get open ticket count (Admin/Support)
     */
    public function openCount()
    {
        $count = SupportTicket::whereIn('status', ['OPEN', 'IN_PROGRESS', 'WAITING_ADMIN'])->count();

        return response()->json(['count' => $count]);
    }
}
