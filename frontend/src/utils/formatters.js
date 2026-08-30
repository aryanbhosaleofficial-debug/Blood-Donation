/**
 * Human-friendly error and domain formatting helpers.
 */

export function formatDomainError(error) {
  if (!error) return 'An unexpected error occurred.';
  const code = typeof error === 'string' ? error : error.code;
  const message = typeof error === 'object' && error.message ? error.message : '';

  switch (code) {
    case 'INVENTORY_VERSION_CONFLICT':
      return 'Inventory changed in another session. Current values were reloaded.';
    case 'NO_STOCK':
      return 'No matching stock is currently available to fulfill this request.';
    case 'ALREADY_COVERED':
      return 'This request has already reached its coverage target.';
    case 'SLOTS_FULL':
      return 'Enough potential donors have already responded to this request.';
    case 'BANK_ALREADY_ALLOCATED':
      return 'Your blood bank has already allocated units for this request.';
    case 'INVALID_ALLOCATION_STATE':
      return 'This allocation cannot transition from its current state.';
    case 'REQUEST_NOT_COVERED':
      return 'This request has not yet reached its bank coverage target.';
    case 'INVALID_ORIGIN':
      return 'Request origin is not allowed.';
    case 'INVALID_CSRF_TOKEN':
      return 'Invalid or expired session security token. Please refresh.';
    case 'ACCOUNT_LOCKED':
      return 'Account temporarily locked due to consecutive failed attempts. Try again later.';
    case 'UNAUTHORIZED':
    case 'HTTP_401':
      return 'Please sign in to continue.';
    case 'FORBIDDEN':
    case 'HTTP_403':
      return 'You do not have permission to perform this action.';
    case 'NOT_FOUND':
    case 'HTTP_404':
      return 'The requested resource was not found.';
    case 'NETWORK_ERROR':
      return 'Unable to reach the server. Please check your connection.';
    default:
      return message || 'Request failed. Please try again.';
  }
}
