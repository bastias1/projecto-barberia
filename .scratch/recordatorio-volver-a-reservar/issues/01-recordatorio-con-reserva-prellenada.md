# Recordatorio para volver a reservar, con link prellenado

Status: needs-info

## Idea

Some time after a client's last booking, send them a reminder email with a link that opens `/<slug>/agendar` already filled with the same branch, barber and service as that booking. The client can change any of them before confirming. The reminder itself can be modified (for example when it is sent).

## Context

- Came up while reworking `/cuenta` (grilling session, 2026-11-26). There, "Reservar de nuevo" on a past booking is only a plain link to `/<slug>/agendar?sucursal=<slug>`, with no prefilling.
- Prefilling needs new query params in the booking flow (`app/[slug]/(publico)/agendar`): barber and service, validated against what is still active.
- It is not the same thing as the existing reminders: `/api/recordatorios` (pg_cron, hourly, `notificarRecordatorios`) reminds clients of a booking they **already have**. This one invites them to make a **new** one.

## Open questions

- Who can modify the reminder: the client (how long after the last cut), the barbería (a default per service), or both?
- Guests (no account) too, or only accounts?
- Opt-out and consent: is this a marketing email under the privacy policy?
- Which plan or module includes it?
