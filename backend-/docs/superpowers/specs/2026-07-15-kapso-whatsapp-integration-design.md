# Kapso AI WhatsApp Integration Design

**Date:** 2026-07-15  
**Status:** Approved  
**Priority:** High (primary messaging provider)  

---

## Overview

Integrate Kapso AI as the primary WhatsApp messaging provider while maintaining Twilio as a fallback. This allows migrating away from Twilio gradually while maintaining reliability.

---

## Current State

- **Provider:** Twilio (exclusive)
- **Location:** `src/services/whatsapp.service.js`
- **Functions:** 7 exported notification functions
  - `enviarNotificacionInicioServicio`
  - `enviarNotificacionOrdenListaSinRifa`
  - `enviarNotificacionOrdenListaConRifa`
  - `enviarNotificacionOrdenTerminada`
  - `enviarNotificacionSimple`
  - `enviarNotificacionModificacion`
  - `enviarReciboMostrador`

---

## Architecture

### New Internal Functions

#### `sendViaKapso(phoneNumber, mensaje)`
- **Purpose:** Send message via Kapso AI API
- **Input:** Phone number (raw, any format), message text
- **Phone Normalization:** 
  - Remove all non-digits
  - If doesn't start with '57', prepend '57'
  - Result format: `57XXXXXXXXXX` (Colombian country code)
- **HTTP:** POST to `${KAPSO_API_URL}/${KAPSO_PHONE_ID}/messages`
- **Headers:** `Content-Type: application/json`, `X-API-Key: ${KAPSO_API_KEY}`
- **Payload Example:**
  ```json
  {
    "messaging_product": "whatsapp",
    "to": "+573108030240",
    "type": "text",
    "text": { "body": "Tu mensaje aquí" }
  }
  ```
  *(Note: `to` field is normalized phone with + prefix, `text.body` contains the message)*
- **Returns:** `{success: true, messageId}` or `{success: false, error}`
- **Logs:** `[KAPSO]` prefixed messages

#### `sendViaTwilio(phoneNumber, mensaje)`
- **Purpose:** Send message via existing Twilio SDK
- **Input:** Phone number (normalized), message text
- **Uses:** Existing `client.messages.create()` logic
- **Returns:** `{success: true, messageId}` or `{success: false, error}`
- **Logs:** `[TWILIO]` prefixed messages

#### `sendMessageWithFallback(phoneNumber, mensaje)`
- **Purpose:** Orchestrate retry logic: Kapso → Twilio
- **Flow:**
  1. Attempt Kapso via `sendViaKapso()`
  2. On failure, attempt Twilio via `sendViaTwilio()`
  3. On both failure, log error and return `false`
  4. On any success, return `true`
- **Logs:** `[FALLBACK]` when switching providers
- **Error Handling:** Catches network errors, auth errors, rate limits separately

---

## Changes to Existing Functions

All `enviarNotificacion*` functions are refactored to:
1. Normalize phone number (existing logic, unchanged)
2. Prepare message text (existing logic, unchanged)
3. Call `sendMessageWithFallback(phoneNumber, mensaje)` instead of direct `client.messages.create()`
4. Return result as before (`true`/`false`)

**Interface unchanged:** Callers in `orden.controller.js`, `rifa.controller.js` etc. require no changes.

---

## Environment Variables

Required additions to `.env`:

```env
# Kapso AI Configuration
KAPSO_API_URL=https://api.kapso.ai/meta/whatsapp/v24.0
KAPSO_PHONE_ID=1183799051484040
KAPSO_API_KEY=KybJ4FnmNGAyNgjFwLZCHZNiWuOYF8a0ezTi

# Existing Twilio (unchanged)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=...
```

---

## Message Format Strategy

- **Kapso:** Uses plain text messages (`.type: "text"`) — no templates until approved by Meta
- **Twilio:** Continues using existing mixed approach (contentSid with fallback to plain text)
- **Future:** Once Kapso templates are approved, can update payload to `.type: "template"`

---

## Error Handling

### Kapso-Specific Errors
- Network/connection errors → fallback to Twilio
- Invalid API key → fallback to Twilio
- Rate limiting (429) → fallback to Twilio
- Invalid phone format → fail fast, don't retry

### Twilio Fallback Errors
- If both fail → log full error stack, return `false`

### Logging Pattern
```
[KAPSO] Enviando a +57XXXXXXXXXX...
[KAPSO] ✓ Enviado (messageId: xxx)

OR

[KAPSO] ✗ Error: connection timeout
[FALLBACK] Reintentando con Twilio...
[TWILIO] ✓ Enviado (sid: yyy)
```

---

## Testing Strategy

- Manual: Send test messages via both providers
- Verify: Check delivery via Kapso dashboard + Twilio console
- Fallback: Test Kapso failure → Twilio success path
- Coverage: All 7 notification types use the new flow

---

## File Changes

| File | Change |
|------|--------|
| `src/services/whatsapp.service.js` | Add `sendViaKapso()`, `sendViaTwilio()`, `sendMessageWithFallback()` + refactor 7 functions |
| `.env` (or `.env.example`) | Add KAPSO_* variables |
| No others | Controllers/routes unchanged |

---

## Rollback Plan

If Kapso fails in production:
1. Set `KAPSO_API_KEY=""` (empty) in env
2. `sendViaKapso()` will fail immediately, fallback to Twilio
3. Restart app (or code will auto-fallback on next message)
4. All messages route through Twilio until fixed

---

## Future Work

- [ ] Approve Kapso templates for each notification type
- [ ] Migrate to template-based messages in Kapso (after approval)
- [ ] Deprecate Twilio (once confident in Kapso reliability)
- [ ] Add Kapso webhook support for delivery receipts/read status

---

## Acceptance Criteria

- ✅ Kapso integration sends messages successfully
- ✅ Fallback to Twilio works when Kapso fails
- ✅ All 7 notification types use new flow
- ✅ Logs clearly distinguish provider and success/failure
- ✅ No breaking changes to controller interfaces
- ✅ Environment variables documented
