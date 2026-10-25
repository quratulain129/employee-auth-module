// Maps short reason codes from the backend to friendly text. Codes carry no sensitive details by design.
export const LOGIN_ERRORS = {
  cancelled: 'Sign-in was cancelled. You can try again when you are ready.',
  provider_error: 'The sign-in provider reported a problem. Please try again.',
  provider_not_configured: 'This sign-in method is not configured yet. Contact the application administrator.',
  state_mismatch: 'The sign-in attempt could not be verified (it may have expired). Please start again.',
  callback_failed: 'Sign-in could not be completed. Please try again.',
  token_exchange_failed: 'Sign-in could not be completed. Please try again.',
  nonce_mismatch: 'Sign-in could not be verified. Please try again.',
  no_id_token: 'Sign-in could not be completed. Please try again.',
  session_error: 'Your session could not be created. Please try again.',
};
export const DENIED_REASONS = {
  domain_not_allowed: 'This Google account does not belong to an approved organization.',
  hosted_domain_mismatch: 'This Google account could not be confirmed as part of an approved organization.',
  email_unverified: 'The email address on this account is not verified.',
  tenant_mismatch: 'This Microsoft account does not belong to the approved organization.',
  google_policy_not_configured: 'Google sign-in has no approved organization configured yet.',
  missing_email: 'No email address was returned for this account.',
  missing_subject: 'The account could not be identified.',
};
