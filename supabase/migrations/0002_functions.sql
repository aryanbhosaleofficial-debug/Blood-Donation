-- ===========================================================================
-- Migration 0002: transactional PL/pgSQL functions
--
-- Every critical multi-step business operation from the SQLite build
-- (previously `db.transaction(...).immediate(...)` with better-sqlite3) is
-- reproduced here as a single PL/pgSQL function. A function body runs in ONE
-- implicit transaction, so calling it once via `supabase.rpc('bd_...')` gives
-- the same all-or-nothing guarantee as `BEGIN IMMEDIATE ... COMMIT`.
--
-- Row-level locking:
--   * SELECT ... FOR UPDATE            -> serialize writers on a hot row
--                                        (requests, inventory, allocations)
--   * FOR UPDATE SKIP LOCKED           -> notification queue claim
--
-- Domain errors:
--   RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = '<DOMAIN_CODE>'
--   The Node repository layer maps MESSAGE -> HTTP status + error code and
--   never leaks the raw PostgreSQL error, query, or schema to the client.
--
-- Config values that live in backend/src/core/config.js (inventory ceiling,
-- backup-slot default, TTL) are passed in as parameters — the database keeps
-- no second copy of application configuration.
--
-- Security: all functions are SECURITY INVOKER with a pinned search_path.
-- Grants are applied in 0003_grants.sql (execute to the backend role only).
-- ===========================================================================

SET search_path = public;

-- ---------------------------------------------------------------------------
-- Notification outbox insert — always called INSIDE a business transaction.
-- ON CONFLICT DO NOTHING reproduces the SQLite "UNIQUE -> return null" dedupe.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_enqueue_notification(
  p_recipient_user_id BIGINT,
  p_event_type        TEXT,
  p_entity_type       TEXT,
  p_entity_id         BIGINT,
  p_dedupe_key        TEXT,
  p_title             TEXT,
  p_message           TEXT,
  p_payload           JSONB DEFAULT '{}'::jsonb,
  p_channel           TEXT  DEFAULT 'IN_APP',
  p_max_attempts      INTEGER DEFAULT 3
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  IF p_recipient_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO notifications
    (recipient_user_id, channel, event_type, entity_type, entity_id,
     dedupe_key, title, message, payload_json, status,
     attempt_count, max_attempts, queued_at)
  VALUES
    (p_recipient_user_id, p_channel, p_event_type, p_entity_type, p_entity_id,
     p_dedupe_key, p_title, p_message, COALESCE(p_payload, '{}'::jsonb), 'QUEUED',
     0, p_max_attempts, now())
  ON CONFLICT (recipient_user_id, channel, dedupe_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 02 — version-checked inventory update (+ adjustment + audit).
-- Mirrors inventory.service.update().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_update_inventory_versioned(
  p_user_id          BIGINT,
  p_inventory_id     BIGINT,
  p_expected_version INTEGER,
  p_new_units        INTEGER,
  p_reason           TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bank_id      BIGINT;
  v_inv          inventory%ROWTYPE;
BEGIN
  -- Ownership: the acting user must own the bank that owns this inventory row.
  SELECT b.id INTO v_bank_id
    FROM blood_banks b
    JOIN users u ON u.id = b.user_id
   WHERE b.user_id = p_user_id AND u.role = 'BLOOD_BANK';
  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_inv
    FROM inventory
   WHERE id = p_inventory_id AND bank_id = v_bank_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.version <> p_expected_version THEN
    RAISE EXCEPTION 'INVENTORY_VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  UPDATE inventory
     SET units_available    = p_new_units,
         version            = version + 1,
         updated_by_user_id = p_user_id
   WHERE id = p_inventory_id
     AND bank_id = v_bank_id
     AND version = p_expected_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO inventory_adjustments
    (inventory_id, bank_id, actor_user_id, previous_units, new_units,
     previous_version, new_version, reason)
  VALUES
    (p_inventory_id, v_bank_id, p_user_id, v_inv.units_available, p_new_units,
     v_inv.version, v_inv.version + 1, p_reason);

  INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata_json)
  VALUES (p_user_id, 'INVENTORY_UPDATED', 'INVENTORY', p_inventory_id,
          jsonb_build_object(
            'bloodGroup', v_inv.blood_group,
            'component', v_inv.component,
            'previousUnits', v_inv.units_available,
            'newUnits', p_new_units,
            'previousVersion', v_inv.version,
            'newVersion', v_inv.version + 1));

  RETURN (SELECT to_jsonb(i) FROM inventory i WHERE i.id = p_inventory_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 03 — idempotent request creation + transactional broadcast fan-out.
-- Mirrors requests.service.create().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_create_request_with_broadcasts(
  p_hospital_user_id  BIGINT,
  p_client_request_id TEXT,
  p_blood_group       TEXT,
  p_component         TEXT,
  p_units_needed      INTEGER,
  p_backup_slots      INTEGER,
  p_urgency           TEXT,
  p_note              TEXT,
  p_expires_at        TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hospital     hospitals%ROWTYPE;
  v_row          requests%ROWTYPE;
  v_existing     requests%ROWTYPE;
  v_bank         RECORD;
  v_count        INTEGER := 0;
BEGIN
  SELECT * INTO v_hospital FROM hospitals WHERE user_id = p_hospital_user_id;
  IF v_hospital.id IS NULL THEN
    RAISE EXCEPTION 'HOSPITAL_PROFILE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_hospital.verified_at IS NULL THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_VERIFIED' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency replay: matching payload -> return existing; conflict -> 409.
  SELECT * INTO v_existing
    FROM requests
   WHERE hospital_id = v_hospital.id AND client_request_id = p_client_request_id
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing.blood_group = p_blood_group
       AND v_existing.component = p_component
       AND v_existing.units_needed = p_units_needed
       AND v_existing.urgency = p_urgency THEN
      RETURN jsonb_build_object(
        'request', to_jsonb(v_existing),
        'broadcastCount', (SELECT count(*) FROM request_broadcasts WHERE request_id = v_existing.id),
        'idempotentReplay', true);
    END IF;
    RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO requests
      (client_request_id, hospital_id, blood_group, component, units_needed,
       backup_slots, urgency, status, note, is_synthetic, scenario_id, expires_at)
    VALUES
      (p_client_request_id, v_hospital.id, p_blood_group, p_component, p_units_needed,
       p_backup_slots, p_urgency, 'OPEN', p_note, false, NULL, p_expires_at)
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing
      FROM requests
     WHERE hospital_id = v_hospital.id AND client_request_id = p_client_request_id;
    IF FOUND AND v_existing.blood_group = p_blood_group
       AND v_existing.component = p_component
       AND v_existing.units_needed = p_units_needed
       AND v_existing.urgency = p_urgency THEN
      RETURN jsonb_build_object(
        'request', to_jsonb(v_existing),
        'broadcastCount', (SELECT count(*) FROM request_broadcasts WHERE request_id = v_existing.id),
        'idempotentReplay', true);
    END IF;
    RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END;

  FOR v_bank IN
    SELECT b.id, b.user_id, b.name, b.city
      FROM blood_banks b
      JOIN users u ON u.id = b.user_id
     WHERE u.role = 'BLOOD_BANK' AND u.is_active AND u.is_verified
     ORDER BY b.id
  LOOP
    INSERT INTO request_broadcasts (request_id, bank_id) VALUES (v_row.id, v_bank.id);
    v_count := v_count + 1;
    PERFORM bd_enqueue_notification(
      v_bank.user_id,
      'REQUEST_BROADCAST_RECEIVED', 'REQUEST', v_row.id,
      format('REQUEST_BROADCAST_RECEIVED:req=%s:bank=%s', v_row.id, v_bank.user_id),
      'New Emergency Request Received',
      format('%s (%s) — %s urgency — from %s, %s.',
             v_row.blood_group, v_row.component, v_row.urgency, v_hospital.name, v_hospital.city),
      jsonb_build_object('requestId', v_row.id, 'bloodGroup', v_row.blood_group,
                         'component', v_row.component, 'urgency', v_row.urgency,
                         'hospitalName', v_hospital.name, 'city', v_hospital.city));
  END LOOP;

  RETURN jsonb_build_object(
    'request', to_jsonb(v_row),
    'broadcastCount', v_count,
    'idempotentReplay', false);
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 04 — reserve a blood-bank allocation (the core race path).
-- Mirrors allocations.transaction.reserveTransaction().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_reserve_allocation(
  p_user_id            BIGINT,
  p_request_id         BIGINT,
  p_inventory_max_units INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bank        RECORD;
  v_request     requests%ROWTYPE;
  v_inv         inventory%ROWTYPE;
  v_before_total INTEGER;
  v_remaining   INTEGER;
  v_quantity    INTEGER;
  v_active      INTEGER;
  v_alloc       request_allocations%ROWTYPE;
  v_covered     BOOLEAN := false;
  v_hospital_user_id BIGINT;
  v_donor_user  BIGINT;
BEGIN
  SELECT b.id, b.user_id, b.name INTO v_bank
    FROM blood_banks b
    JOIN users u ON u.id = b.user_id
   WHERE b.user_id = p_user_id AND u.role = 'BLOOD_BANK' AND u.is_active AND u.is_verified;
  IF v_bank.id IS NULL THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_VERIFIED' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the request row first: all writers for this request serialize here.
  SELECT * INTO v_request FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM request_broadcasts WHERE request_id = p_request_id AND bank_id = v_bank.id) THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM request_allocations WHERE request_id = p_request_id AND bank_id = v_bank.id) THEN
    RAISE EXCEPTION 'BANK_ALREADY_ALLOCATED' USING ERRCODE = 'P0001';
  END IF;
  IF v_request.status = 'COVERED' THEN
    RAISE EXCEPTION 'ALREADY_COVERED' USING ERRCODE = 'P0001';
  END IF;
  IF v_request.status <> 'OPEN' THEN
    RAISE EXCEPTION 'REQUEST_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(units_reserved), 0) INTO v_before_total
    FROM request_allocations
   WHERE request_id = p_request_id AND status IN ('RESERVED', 'COMPLETED');
  v_remaining := GREATEST(v_request.units_needed - v_before_total, 0);
  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'ALREADY_COVERED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_inv
    FROM inventory
   WHERE bank_id = v_bank.id AND blood_group = v_request.blood_group AND component = 'RED_CELLS'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_NOT_CONFIGURED' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.units_available <= 0 THEN
    RAISE EXCEPTION 'NO_STOCK' USING ERRCODE = 'P0001';
  END IF;

  v_quantity := GREATEST(LEAST(v_remaining, v_inv.units_available), 0);
  IF v_quantity <= 0 THEN
    RAISE EXCEPTION 'NO_STOCK' USING ERRCODE = 'P0001';
  END IF;

  UPDATE inventory
     SET units_available    = units_available - v_quantity,
         version            = version + 1,
         updated_by_user_id  = p_user_id
   WHERE id = v_inv.id AND bank_id = v_bank.id AND units_available >= v_quantity;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO inventory_adjustments
    (inventory_id, bank_id, actor_user_id, previous_units, new_units,
     previous_version, new_version, reason)
  VALUES
    (v_inv.id, v_bank.id, p_user_id, v_inv.units_available, v_inv.units_available - v_quantity,
     v_inv.version, v_inv.version + 1, 'REQUEST_ALLOCATION:' || p_request_id);

  BEGIN
    INSERT INTO request_allocations (request_id, bank_id, units_reserved, status)
    VALUES (p_request_id, v_bank.id, v_quantity, 'RESERVED')
    RETURNING * INTO v_alloc;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'BANK_ALREADY_ALLOCATED' USING ERRCODE = 'P0001';
  END;

  SELECT COALESCE(SUM(units_reserved), 0) INTO v_active
    FROM request_allocations
   WHERE request_id = p_request_id AND status IN ('RESERVED', 'COMPLETED');
  v_covered := v_active >= v_request.units_needed;

  IF v_covered THEN
    UPDATE requests SET status = 'COVERED' WHERE id = p_request_id;
    UPDATE donor_alerts SET status = 'CLOSED', closed_at = now()
     WHERE request_id = p_request_id AND status IN ('ACTIVE', 'VIEWED');

    FOR v_donor_user IN
      SELECT DISTINCT u.id
        FROM donor_pledges p
        JOIN donors d ON d.id = p.donor_id
        JOIN users u ON u.id = d.user_id
       WHERE p.request_id = p_request_id AND p.status = 'PLEDGED'
    LOOP
      PERFORM bd_enqueue_notification(
        v_donor_user, 'DONOR_PLEDGE_DEFERRED', 'PLEDGE', NULL,
        format('DONOR_PLEDGE_DEFERRED:req=%s:donorUser=%s', p_request_id, v_donor_user),
        'Pledge Deferred — No Longer Required',
        format('Blood-bank coverage was found for Request #%s. Your response is no longer required for this request.', p_request_id),
        jsonb_build_object('requestId', p_request_id, 'pledgeId', NULL));
    END LOOP;

    UPDATE donor_pledges SET status = 'DEFERRED', closed_at = now()
     WHERE request_id = p_request_id AND status = 'PLEDGED';
    UPDATE donor_pledges SET status = 'CLOSED', closed_at = now()
     WHERE request_id = p_request_id AND status = 'ARRIVED';
    DELETE FROM donor_location_sessions WHERE request_id = p_request_id;
  END IF;

  SELECT h.user_id INTO v_hospital_user_id
    FROM requests r JOIN hospitals h ON h.id = r.hospital_id WHERE r.id = p_request_id;
  IF v_hospital_user_id IS NOT NULL THEN
    PERFORM bd_enqueue_notification(
      v_hospital_user_id, 'BANK_ALLOCATION_RESERVED', 'ALLOCATION', v_alloc.id,
      format('BANK_ALLOCATION_RESERVED:alloc=%s', v_alloc.id),
      'Blood Bank Reservation Confirmed',
      format('%s reserved %s unit(s) for Request #%s.', v_bank.name, v_quantity, p_request_id),
      jsonb_build_object('requestId', p_request_id, 'allocationId', v_alloc.id,
                         'unitsReserved', v_quantity, 'bankName', v_bank.name));
    IF v_covered THEN
      PERFORM bd_enqueue_notification(
        v_hospital_user_id, 'REQUEST_COVERED', 'REQUEST', p_request_id,
        format('REQUEST_COVERED:req=%s', p_request_id),
        'Request Coverage Target Reached',
        format('Coverage target reached through recorded blood-bank allocations for Request #%s. Medical professionals determine clinical suitability.', p_request_id),
        jsonb_build_object('requestId', p_request_id));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allocation', to_jsonb(v_alloc),
    'request', (SELECT to_jsonb(r) FROM requests r WHERE r.id = p_request_id),
    'inventory', (SELECT to_jsonb(i) FROM inventory i WHERE i.id = v_inv.id),
    'activeAllocated', v_active,
    'covered', v_covered);
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 04 — release a RESERVED allocation (restore inventory, maybe reopen).
-- Mirrors allocations.transaction.releaseTransaction().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_release_allocation(
  p_user_id             BIGINT,
  p_allocation_id       BIGINT,
  p_inventory_max_units INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bank      RECORD;
  v_alloc     RECORD;
  v_inv       inventory%ROWTYPE;
  v_request   requests%ROWTYPE;
  v_active    INTEGER;
  v_reopened  BOOLEAN := false;
  v_hospital_user_id BIGINT;
BEGIN
  SELECT b.id, b.user_id, b.name INTO v_bank
    FROM blood_banks b JOIN users u ON u.id = b.user_id
   WHERE b.user_id = p_user_id AND u.role = 'BLOOD_BANK' AND u.is_active AND u.is_verified;
  IF v_bank.id IS NULL THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_VERIFIED' USING ERRCODE = 'P0001';
  END IF;

  SELECT a.*, r.blood_group, r.component, r.units_needed, r.status AS request_status
    INTO v_alloc
    FROM request_allocations a JOIN requests r ON r.id = a.request_id
   WHERE a.id = p_allocation_id AND a.bank_id = v_bank.id
   FOR UPDATE OF a;
  IF v_alloc.id IS NULL THEN
    RAISE EXCEPTION 'ALLOCATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_alloc.status <> 'RESERVED' THEN
    RAISE EXCEPTION 'INVALID_ALLOCATION_STATE' USING ERRCODE = 'P0001';
  END IF;

  -- Lock request row to serialize the covered/open transition.
  SELECT * INTO v_request FROM requests WHERE id = v_alloc.request_id FOR UPDATE;

  SELECT * INTO v_inv
    FROM inventory
   WHERE bank_id = v_bank.id AND blood_group = v_alloc.blood_group AND component = v_alloc.component
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_NOT_CONFIGURED' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.units_available + v_alloc.units_reserved > p_inventory_max_units THEN
    RAISE EXCEPTION 'INVENTORY_LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE inventory
     SET units_available    = units_available + v_alloc.units_reserved,
         version            = version + 1,
         updated_by_user_id  = p_user_id
   WHERE id = v_inv.id AND bank_id = v_bank.id
     AND units_available + v_alloc.units_reserved <= p_inventory_max_units;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO inventory_adjustments
    (inventory_id, bank_id, actor_user_id, previous_units, new_units,
     previous_version, new_version, reason)
  VALUES
    (v_inv.id, v_bank.id, p_user_id, v_inv.units_available,
     v_inv.units_available + v_alloc.units_reserved,
     v_inv.version, v_inv.version + 1, 'REQUEST_ALLOCATION_RELEASE:' || v_alloc.request_id);

  UPDATE request_allocations
     SET status = 'RELEASED', released_at = now()
   WHERE id = p_allocation_id AND status = 'RESERVED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_ALLOCATION_STATE' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(units_reserved), 0) INTO v_active
    FROM request_allocations
   WHERE request_id = v_alloc.request_id AND status IN ('RESERVED', 'COMPLETED');
  IF v_request.status = 'COVERED' AND v_active < v_request.units_needed THEN
    UPDATE requests SET status = 'OPEN' WHERE id = v_alloc.request_id;
    v_reopened := true;
  END IF;

  SELECT h.user_id INTO v_hospital_user_id
    FROM requests r JOIN hospitals h ON h.id = r.hospital_id WHERE r.id = v_alloc.request_id;
  IF v_hospital_user_id IS NOT NULL THEN
    PERFORM bd_enqueue_notification(
      v_hospital_user_id, 'BANK_ALLOCATION_RELEASED', 'ALLOCATION', p_allocation_id,
      format('BANK_ALLOCATION_RELEASED:alloc=%s:hospitalUser', p_allocation_id),
      'Bank Reservation Released',
      format('%s released %s unit(s) previously reserved for Request #%s.',
             v_bank.name, v_alloc.units_reserved, v_alloc.request_id),
      jsonb_build_object('requestId', v_alloc.request_id, 'allocationId', p_allocation_id,
                         'unitsReserved', v_alloc.units_reserved, 'bankName', v_bank.name));
    IF v_reopened THEN
      PERFORM bd_enqueue_notification(
        v_hospital_user_id, 'REQUEST_REOPENED', 'REQUEST', v_alloc.request_id,
        format('REQUEST_REOPENED:req=%s:released=%s', v_alloc.request_id, p_allocation_id),
        'Request Requires Additional Sourcing',
        format('A previous reservation was released. Additional sourcing is required for Request #%s.', v_alloc.request_id),
        jsonb_build_object('requestId', v_alloc.request_id, 'allocationId', p_allocation_id));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allocation', (SELECT to_jsonb(a) FROM request_allocations a WHERE a.id = p_allocation_id),
    'request', (SELECT to_jsonb(r) FROM requests r WHERE r.id = v_alloc.request_id),
    'activeAllocated', v_active,
    'reopened', v_reopened);
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 04 — complete a RESERVED allocation.
-- Mirrors allocations.transaction.completeTransaction().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_complete_allocation(
  p_user_id       BIGINT,
  p_allocation_id BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bank    RECORD;
  v_alloc   RECORD;
  v_hospital_user_id BIGINT;
BEGIN
  SELECT b.id, b.user_id, b.name INTO v_bank
    FROM blood_banks b JOIN users u ON u.id = b.user_id
   WHERE b.user_id = p_user_id AND u.role = 'BLOOD_BANK' AND u.is_active AND u.is_verified;
  IF v_bank.id IS NULL THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_VERIFIED' USING ERRCODE = 'P0001';
  END IF;

  SELECT a.*, r.units_needed INTO v_alloc
    FROM request_allocations a JOIN requests r ON r.id = a.request_id
   WHERE a.id = p_allocation_id AND a.bank_id = v_bank.id
   FOR UPDATE OF a;
  IF v_alloc.id IS NULL THEN
    RAISE EXCEPTION 'ALLOCATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_alloc.status <> 'RESERVED' THEN
    RAISE EXCEPTION 'INVALID_ALLOCATION_STATE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE request_allocations
     SET status = 'COMPLETED', completed_at = now()
   WHERE id = p_allocation_id AND status = 'RESERVED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_ALLOCATION_STATE' USING ERRCODE = 'P0001';
  END IF;

  SELECT h.user_id INTO v_hospital_user_id
    FROM requests r JOIN hospitals h ON h.id = r.hospital_id WHERE r.id = v_alloc.request_id;
  IF v_hospital_user_id IS NOT NULL THEN
    PERFORM bd_enqueue_notification(
      v_hospital_user_id, 'BANK_ALLOCATION_COMPLETED', 'ALLOCATION', p_allocation_id,
      format('BANK_ALLOCATION_COMPLETED:alloc=%s', p_allocation_id),
      'Bank Allocation Marked Complete',
      format('%s marked their allocation of %s unit(s) as complete for Request #%s. Medical professionals determine clinical suitability.',
             v_bank.name, v_alloc.units_reserved, v_alloc.request_id),
      jsonb_build_object('requestId', v_alloc.request_id, 'allocationId', p_allocation_id,
                         'unitsReserved', v_alloc.units_reserved, 'bankName', v_bank.name));
  END IF;

  RETURN (SELECT to_jsonb(a) FROM request_allocations a WHERE a.id = p_allocation_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 03/04 — cancel a request, releasing every RESERVED allocation.
-- Mirrors allocations.transaction.cancelRequestTransaction().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_cancel_request_with_allocations(
  p_hospital_user_id    BIGINT,
  p_request_id          BIGINT,
  p_actor_user_id       BIGINT,
  p_inventory_max_units INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hospital_id BIGINT;
  v_request     requests%ROWTYPE;
  v_alloc       RECORD;
  v_inv         inventory%ROWTYPE;
  v_uid         BIGINT;
BEGIN
  SELECT id INTO v_hospital_id FROM hospitals WHERE user_id = p_hospital_user_id;
  SELECT * INTO v_request
    FROM requests WHERE id = p_request_id AND hospital_id = v_hospital_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_request.status NOT IN ('OPEN', 'COVERED') THEN
    RAISE EXCEPTION 'INVALID_REQUEST_STATE' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM request_allocations WHERE request_id = p_request_id AND status = 'COMPLETED') THEN
    RAISE EXCEPTION 'COMPLETED_ALLOCATION_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  FOR v_alloc IN
    SELECT a.*, r.blood_group, r.component
      FROM request_allocations a JOIN requests r ON r.id = a.request_id
     WHERE a.request_id = p_request_id AND a.status = 'RESERVED'
     FOR UPDATE OF a
  LOOP
    SELECT * INTO v_inv
      FROM inventory
     WHERE bank_id = v_alloc.bank_id AND blood_group = v_alloc.blood_group AND component = v_alloc.component
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVENTORY_NOT_CONFIGURED' USING ERRCODE = 'P0001';
    END IF;
    IF v_inv.units_available + v_alloc.units_reserved > p_inventory_max_units THEN
      RAISE EXCEPTION 'INVENTORY_LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
    END IF;
    UPDATE inventory
       SET units_available = units_available + v_alloc.units_reserved,
           version = version + 1,
           updated_by_user_id = p_actor_user_id
     WHERE id = v_inv.id AND bank_id = v_alloc.bank_id
       AND units_available + v_alloc.units_reserved <= p_inventory_max_units;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVENTORY_CHANGED' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO inventory_adjustments
      (inventory_id, bank_id, actor_user_id, previous_units, new_units,
       previous_version, new_version, reason)
    VALUES
      (v_inv.id, v_alloc.bank_id, p_actor_user_id, v_inv.units_available,
       v_inv.units_available + v_alloc.units_reserved,
       v_inv.version, v_inv.version + 1, 'REQUEST_ALLOCATION_RELEASE:' || p_request_id);
    UPDATE request_allocations SET status = 'RELEASED', released_at = now()
     WHERE id = v_alloc.id AND status = 'RESERVED';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_ALLOCATION_STATE' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  UPDATE requests SET status = 'CANCELLED', closed_at = now() WHERE id = p_request_id;
  UPDATE request_broadcasts SET status = 'CLOSED', responded_at = now()
   WHERE request_id = p_request_id AND status <> 'CLOSED';
  UPDATE donor_alerts SET status = 'CLOSED', closed_at = now()
   WHERE request_id = p_request_id AND status IN ('ACTIVE', 'VIEWED');
  UPDATE donor_pledges SET status = 'CLOSED', closed_at = now()
   WHERE request_id = p_request_id AND status IN ('PLEDGED', 'ARRIVED', 'DEFERRED');
  DELETE FROM donor_location_sessions WHERE request_id = p_request_id;

  FOR v_uid IN
    SELECT DISTINCT u.id FROM request_broadcasts rb
      JOIN blood_banks bb ON bb.id = rb.bank_id
      JOIN users u ON u.id = bb.user_id
     WHERE rb.request_id = p_request_id
  LOOP
    PERFORM bd_enqueue_notification(
      v_uid, 'REQUEST_CANCELLED', 'REQUEST', p_request_id,
      format('REQUEST_CANCELLED:req=%s:user=%s', p_request_id, v_uid),
      'Emergency Request Cancelled',
      format('Emergency Request #%s has been cancelled.', p_request_id),
      jsonb_build_object('requestId', p_request_id));
  END LOOP;
  FOR v_uid IN
    SELECT DISTINCT u.id FROM donor_pledges p
      JOIN donors d ON d.id = p.donor_id
      JOIN users u ON u.id = d.user_id
     WHERE p.request_id = p_request_id
  LOOP
    PERFORM bd_enqueue_notification(
      v_uid, 'REQUEST_CANCELLED', 'REQUEST', p_request_id,
      format('REQUEST_CANCELLED:req=%s:user=%s', p_request_id, v_uid),
      'Emergency Request Cancelled',
      format('Emergency Request #%s has been cancelled.', p_request_id),
      jsonb_build_object('requestId', p_request_id));
  END LOOP;

  RETURN (SELECT to_jsonb(r) FROM requests r WHERE r.id = p_request_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 03 — complete a COVERED/COMPLETED-eligible request.
-- Mirrors requests.service.transition(..., COMPLETED).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_complete_request(
  p_user_id    BIGINT,
  p_request_id BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request requests%ROWTYPE;
  v_uid     BIGINT;
BEGIN
  SELECT r.* INTO v_request
    FROM requests r JOIN hospitals h ON h.id = r.hospital_id
   WHERE r.id = p_request_id AND h.user_id = p_user_id
   FOR UPDATE OF r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_request.status = 'OPEN' THEN
    RAISE EXCEPTION 'NOT_COVERED' USING ERRCODE = 'P0001';
  END IF;
  IF v_request.status NOT IN ('COVERED', 'COMPLETED') THEN
    RAISE EXCEPTION 'INVALID_REQUEST_STATE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE requests SET status = 'COMPLETED', closed_at = now() WHERE id = p_request_id;
  UPDATE request_broadcasts SET status = 'CLOSED', responded_at = now()
   WHERE request_id = p_request_id AND status <> 'CLOSED';
  UPDATE donor_alerts SET status = 'CLOSED', closed_at = now()
   WHERE request_id = p_request_id AND status IN ('ACTIVE', 'VIEWED');
  UPDATE donor_pledges SET status = 'CLOSED', closed_at = now()
   WHERE request_id = p_request_id AND status IN ('PLEDGED', 'ARRIVED', 'DEFERRED');
  DELETE FROM donor_location_sessions WHERE request_id = p_request_id;

  PERFORM bd_enqueue_notification(
    p_user_id, 'REQUEST_COMPLETED', 'REQUEST', p_request_id,
    format('REQUEST_COMPLETED:req=%s:user=%s', p_request_id, p_user_id),
    'Emergency Request Completed',
    format('Emergency Request #%s has been marked as completed.', p_request_id),
    jsonb_build_object('requestId', p_request_id));

  FOR v_uid IN
    SELECT DISTINCT u.id FROM request_broadcasts rb
      JOIN blood_banks bb ON bb.id = rb.bank_id
      JOIN users u ON u.id = bb.user_id
     WHERE rb.request_id = p_request_id AND u.id <> p_user_id
    UNION
    SELECT DISTINCT u.id FROM donor_pledges p
      JOIN donors d ON d.id = p.donor_id
      JOIN users u ON u.id = d.user_id
     WHERE p.request_id = p_request_id AND u.id <> p_user_id
  LOOP
    PERFORM bd_enqueue_notification(
      v_uid, 'REQUEST_COMPLETED', 'REQUEST', p_request_id,
      format('REQUEST_COMPLETED:req=%s:user=%s', p_request_id, v_uid),
      'Emergency Request Completed',
      format('Emergency Request #%s has been marked as completed.', p_request_id),
      jsonb_build_object('requestId', p_request_id));
  END LOOP;

  RETURN (SELECT to_jsonb(r) FROM requests r WHERE r.id = p_request_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 06 — donor pledge creation (slot-limit enforcement — race path).
-- Mirrors pledges.transaction.pledgeTransaction().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_create_donor_pledge(
  p_user_id          BIGINT,
  p_alert_id         BIGINT,
  p_public_reference TEXT,
  p_now              TIMESTAMPTZ DEFAULT now()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_donor_id  BIGINT;
  v_alert     RECORD;
  v_capacity  INTEGER;
  v_active    INTEGER;
  v_pledge    donor_pledges%ROWTYPE;
  v_hosp      RECORD;
BEGIN
  SELECT d.id INTO v_donor_id
    FROM donors d JOIN users u ON u.id = d.user_id
   WHERE d.user_id = p_user_id AND u.role = 'DONOR' AND u.is_active;
  IF v_donor_id IS NULL THEN
    RAISE EXCEPTION 'DONOR_PROFILE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the parent request so concurrent pledges serialize on capacity.
  SELECT da.id, da.status, da.request_id, r.status AS request_status,
         r.units_needed, r.backup_slots, r.expires_at
    INTO v_alert
    FROM donor_alerts da
    JOIN donors d ON d.id = da.donor_id
    JOIN requests r ON r.id = da.request_id
   WHERE da.id = p_alert_id AND d.user_id = p_user_id
   FOR UPDATE OF r, da;
  IF v_alert.id IS NULL THEN
    RAISE EXCEPTION 'DONOR_ALERT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM donor_pledges WHERE request_id = v_alert.request_id AND donor_id = v_donor_id) THEN
    RAISE EXCEPTION 'ALREADY_PLEDGED' USING ERRCODE = 'P0001';
  END IF;
  IF v_alert.status NOT IN ('ACTIVE', 'VIEWED') THEN
    RAISE EXCEPTION 'DONOR_ALERT_NOT_ACTIONABLE' USING ERRCODE = 'P0001';
  END IF;
  IF v_alert.request_status <> 'OPEN' THEN
    RAISE EXCEPTION 'REQUEST_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;
  IF v_alert.expires_at <= p_now THEN
    RAISE EXCEPTION 'REQUEST_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  v_capacity := v_alert.units_needed + COALESCE(v_alert.backup_slots, 0);
  SELECT count(*) INTO v_active
    FROM donor_pledges
   WHERE request_id = v_alert.request_id AND status IN ('PLEDGED', 'ARRIVED');
  IF v_active >= v_capacity THEN
    RAISE EXCEPTION 'SLOTS_FULL' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO donor_pledges (request_id, donor_id, alert_id, public_reference, status)
    VALUES (v_alert.request_id, v_donor_id, p_alert_id, p_public_reference, 'PLEDGED')
    RETURNING * INTO v_pledge;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ALREADY_PLEDGED' USING ERRCODE = 'P0001';
  END;

  UPDATE donor_alerts SET status = 'CLOSED', closed_at = now()
   WHERE id = p_alert_id AND status IN ('ACTIVE', 'VIEWED');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DONOR_ALERT_NOT_ACTIONABLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT h.user_id, h.name, h.city INTO v_hosp
    FROM requests r JOIN hospitals h ON h.id = r.hospital_id WHERE r.id = v_alert.request_id;

  PERFORM bd_enqueue_notification(
    p_user_id, 'DONOR_PLEDGE_CONFIRMED', 'PLEDGE', v_pledge.id,
    format('DONOR_PLEDGE_CONFIRMED:pledge=%s', v_pledge.id),
    'Pledge Recorded',
    format('Your potential donor pledge for %s, %s (Request #%s) was recorded. Medical professionals determine eligibility.',
           COALESCE(v_hosp.name, 'the hospital'), COALESCE(v_hosp.city, ''), v_alert.request_id),
    jsonb_build_object('requestId', v_alert.request_id, 'pledgeId', v_pledge.id,
                       'hospitalName', v_hosp.name, 'city', v_hosp.city));

  IF v_hosp.user_id IS NOT NULL THEN
    PERFORM bd_enqueue_notification(
      v_hosp.user_id, 'DONOR_PLEDGE_CREATED', 'PLEDGE', v_pledge.id,
      format('DONOR_PLEDGE_CREATED:pledge=%s', v_pledge.id),
      'Potential Donor Pledged',
      format('Potential donor %s has pledged to respond for Request #%s.', v_pledge.public_reference, v_alert.request_id),
      jsonb_build_object('requestId', v_alert.request_id, 'pledgeId', v_pledge.id,
                         'publicReference', v_pledge.public_reference));
  END IF;

  RETURN to_jsonb(v_pledge);
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 06 — cancel a PLEDGED pledge.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_cancel_donor_pledge(
  p_user_id   BIGINT,
  p_pledge_id BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pledge  RECORD;
  v_hospital_user_id BIGINT;
BEGIN
  SELECT p.*, r.id AS req_id INTO v_pledge
    FROM donor_pledges p
    JOIN donors d ON d.id = p.donor_id
    JOIN users u ON u.id = d.user_id
    JOIN requests r ON r.id = p.request_id
   WHERE p.id = p_pledge_id AND d.user_id = p_user_id AND u.is_active
   FOR UPDATE OF p;
  IF v_pledge.id IS NULL THEN
    RAISE EXCEPTION 'PLEDGE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_pledge.status <> 'PLEDGED' THEN
    RAISE EXCEPTION 'INVALID_PLEDGE_STATE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE donor_pledges SET status = 'CANCELLED', cancelled_at = now(), closed_at = now()
   WHERE id = p_pledge_id AND status = 'PLEDGED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PLEDGE_STATE' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM donor_location_sessions WHERE pledge_id = p_pledge_id;

  SELECT h.user_id INTO v_hospital_user_id
    FROM requests r JOIN hospitals h ON h.id = r.hospital_id WHERE r.id = v_pledge.request_id;
  IF v_hospital_user_id IS NOT NULL THEN
    PERFORM bd_enqueue_notification(
      v_hospital_user_id, 'DONOR_PLEDGE_CANCELLED', 'PLEDGE', p_pledge_id,
      format('DONOR_PLEDGE_CANCELLED:pledge=%s', p_pledge_id),
      'Potential Donor Cancelled Pledge',
      format('Potential donor %s cancelled their pledge for Request #%s.',
             v_pledge.public_reference, v_pledge.request_id),
      jsonb_build_object('requestId', v_pledge.request_id, 'pledgeId', p_pledge_id,
                         'publicReference', v_pledge.public_reference));
  END IF;

  RETURN jsonb_build_object('pledgeId', p_pledge_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 06 — mark a PLEDGED pledge as ARRIVED.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_arrive_donor_pledge(
  p_user_id   BIGINT,
  p_pledge_id BIGINT,
  p_now       TIMESTAMPTZ DEFAULT now()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pledge  RECORD;
  v_hospital_user_id BIGINT;
BEGIN
  SELECT p.*, r.status AS request_status, r.expires_at INTO v_pledge
    FROM donor_pledges p
    JOIN donors d ON d.id = p.donor_id
    JOIN users u ON u.id = d.user_id
    JOIN requests r ON r.id = p.request_id
   WHERE p.id = p_pledge_id AND d.user_id = p_user_id AND u.is_active
   FOR UPDATE OF p;
  IF v_pledge.id IS NULL THEN
    RAISE EXCEPTION 'PLEDGE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_pledge.status <> 'PLEDGED' THEN
    RAISE EXCEPTION 'INVALID_PLEDGE_STATE' USING ERRCODE = 'P0001';
  END IF;
  IF v_pledge.request_status <> 'OPEN' THEN
    RAISE EXCEPTION 'REQUEST_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;
  IF v_pledge.expires_at <= p_now THEN
    RAISE EXCEPTION 'REQUEST_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE donor_pledges SET status = 'ARRIVED', arrived_at = now()
   WHERE id = p_pledge_id AND status = 'PLEDGED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PLEDGE_STATE' USING ERRCODE = 'P0001';
  END IF;

  SELECT h.user_id INTO v_hospital_user_id
    FROM requests r JOIN hospitals h ON h.id = r.hospital_id WHERE r.id = v_pledge.request_id;
  IF v_hospital_user_id IS NOT NULL THEN
    PERFORM bd_enqueue_notification(
      v_hospital_user_id, 'DONOR_PLEDGE_ARRIVED', 'PLEDGE', p_pledge_id,
      format('DONOR_PLEDGE_ARRIVED:pledge=%s', p_pledge_id),
      'Potential Donor Reported Arrival',
      format('Potential donor %s reported arrival for Request #%s. Medical professionals determine eligibility and suitability.',
             v_pledge.public_reference, v_pledge.request_id),
      jsonb_build_object('requestId', v_pledge.request_id, 'pledgeId', p_pledge_id,
                         'publicReference', v_pledge.public_reference));
  END IF;

  RETURN jsonb_build_object('pledgeId', p_pledge_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 08 — expire ONE request (idempotent, restore reserved inventory once).
-- Mirrors cleanup/request-expiry.transaction.js.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_expire_request(
  p_request_id          BIGINT,
  p_now                 TIMESTAMPTZ,
  p_inventory_max_units INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request   requests%ROWTYPE;
  v_prev      TEXT;
  v_alloc     RECORD;
  v_inv       inventory%ROWTYPE;
  v_released  INTEGER := 0;
  v_expired_pledges INTEGER := 0;
  v_pledge    RECORD;
  v_uid       BIGINT;
  v_notified  BIGINT[] := ARRAY[]::BIGINT[];
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'null'::jsonb; END IF;
  IF v_request.status NOT IN ('OPEN', 'COVERED') THEN RETURN 'null'::jsonb; END IF;
  IF v_request.expires_at > p_now THEN RETURN 'null'::jsonb; END IF;

  v_prev := v_request.status;

  FOR v_alloc IN
    SELECT a.*, r.blood_group, r.component
      FROM request_allocations a JOIN requests r ON r.id = a.request_id
     WHERE a.request_id = p_request_id AND a.status = 'RESERVED'
     FOR UPDATE OF a
  LOOP
    SELECT * INTO v_inv
      FROM inventory
     WHERE bank_id = v_alloc.bank_id AND blood_group = v_alloc.blood_group AND component = v_alloc.component
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'EXPIRY_INVENTORY_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_inv.units_available + v_alloc.units_reserved > p_inventory_max_units THEN
      RAISE EXCEPTION 'EXPIRY_INVENTORY_LIMIT' USING ERRCODE = 'P0001';
    END IF;
    UPDATE inventory
       SET units_available = units_available + v_alloc.units_reserved,
           version = version + 1,
           updated_by_user_id = NULL
     WHERE id = v_inv.id AND bank_id = v_alloc.bank_id
       AND units_available + v_alloc.units_reserved <= p_inventory_max_units;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'EXPIRY_INVENTORY_CHANGED' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO inventory_adjustments
      (inventory_id, bank_id, actor_user_id, previous_units, new_units,
       previous_version, new_version, reason)
    VALUES
      (v_inv.id, v_alloc.bank_id, NULL, v_inv.units_available,
       v_inv.units_available + v_alloc.units_reserved,
       v_inv.version, v_inv.version + 1, 'REQUEST_EXPIRY_RESTORE:req=' || p_request_id);
    UPDATE request_allocations SET status = 'RELEASED', released_at = now()
     WHERE id = v_alloc.id AND status = 'RESERVED';
    v_released := v_released + 1;
  END LOOP;

  -- Per-pledge audit rows before mutating status (idempotent on re-run).
  FOR v_pledge IN
    SELECT id, CASE WHEN status = 'PLEDGED' THEN 'EXPIRED' ELSE 'CLOSED' END AS status_to
      FROM donor_pledges
     WHERE request_id = p_request_id AND status IN ('PLEDGED', 'ARRIVED')
  LOOP
    INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata_json)
    VALUES (NULL, 'DONOR_PLEDGE_EXPIRED', 'PLEDGE', v_pledge.id,
            jsonb_build_object('requestId', p_request_id, 'statusTo', v_pledge.status_to, 'viaRequestExpiry', true));
    v_expired_pledges := v_expired_pledges + 1;
  END LOOP;

  UPDATE donor_pledges SET status = 'EXPIRED', closed_at = now()
   WHERE request_id = p_request_id AND status = 'PLEDGED';
  UPDATE donor_pledges SET status = 'CLOSED', closed_at = now()
   WHERE request_id = p_request_id AND status = 'ARRIVED';
  UPDATE donor_alerts SET status = 'CLOSED', closed_at = now()
   WHERE request_id = p_request_id AND status IN ('ACTIVE', 'VIEWED');
  DELETE FROM donor_location_sessions WHERE request_id = p_request_id;
  UPDATE request_broadcasts SET status = 'CLOSED', responded_at = now()
   WHERE request_id = p_request_id AND status <> 'CLOSED';
  UPDATE requests SET status = 'EXPIRED', closed_at = now()
   WHERE id = p_request_id AND status IN ('OPEN', 'COVERED');

  FOR v_uid IN
    SELECT h.user_id FROM requests r JOIN hospitals h ON h.id = r.hospital_id WHERE r.id = p_request_id
    UNION
    SELECT DISTINCT u.id FROM request_broadcasts rb
      JOIN blood_banks bb ON bb.id = rb.bank_id
      JOIN users u ON u.id = bb.user_id
     WHERE rb.request_id = p_request_id
  LOOP
    IF v_uid IS NULL OR v_uid = ANY(v_notified) THEN CONTINUE; END IF;
    v_notified := array_append(v_notified, v_uid);
    PERFORM bd_enqueue_notification(
      v_uid, 'REQUEST_EXPIRED', 'REQUEST', p_request_id,
      format('REQUEST_EXPIRED:req=%s:user=%s', p_request_id, v_uid),
      'Emergency Request Expired',
      format('Emergency Request #%s has expired and was closed automatically.', p_request_id),
      jsonb_build_object('requestId', p_request_id));
  END LOOP;

  INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata_json)
  VALUES (NULL, 'REQUEST_EXPIRED', 'REQUEST', p_request_id,
          jsonb_build_object('previousStatus', v_prev,
                             'releasedAllocationCount', v_released,
                             'expiredPledgeCount', v_expired_pledges));

  RETURN jsonb_build_object(
    'requestId', p_request_id,
    'previousStatus', v_prev,
    'releasedAllocationCount', v_released,
    'expiredPledgeCount', v_expired_pledges);
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 08 — batch: expire every due request (each in its own subtransaction
-- via the per-row function). Idempotent: a second call returns 0 expired.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_expire_due_requests(
  p_now                 TIMESTAMPTZ,
  p_limit               INTEGER,
  p_inventory_max_units INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id      BIGINT;
  v_result  JSONB;
  v_expired INTEGER := 0;
  v_ids     JSONB := '[]'::jsonb;
BEGIN
  FOR v_id IN
    SELECT id FROM requests
     WHERE status IN ('OPEN', 'COVERED') AND expires_at <= p_now
     ORDER BY expires_at ASC
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  LOOP
    v_result := bd_expire_request(v_id, p_now, p_inventory_max_units);
    IF v_result <> 'null'::jsonb THEN
      v_expired := v_expired + 1;
      v_ids := v_ids || to_jsonb(v_id);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('expiredCount', v_expired, 'requestIds', v_ids);
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 09 — ADMIN confirm a surge candidate (PENDING -> CONFIRMED + event).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_confirm_surge_candidate(
  p_admin_id     BIGINT,
  p_candidate_id BIGINT,
  p_note         TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_c        surge_candidates%ROWTYPE;
  v_summary  TEXT;
  v_event    surge_events%ROWTYPE;
  v_admin    BIGINT;
BEGIN
  SELECT * INTO v_c FROM surge_candidates WHERE id = p_candidate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SURGE_CANDIDATE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_c.status <> 'PENDING' THEN
    RAISE EXCEPTION 'INVALID_SURGE_STATE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE surge_candidates
     SET status = 'CONFIRMED', reviewed_by_user_id = p_admin_id,
         reviewed_at = now(), review_note = p_note
   WHERE id = p_candidate_id AND status = 'PENDING';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_SURGE_STATE' USING ERRCODE = 'P0001';
  END IF;

  v_summary := format(
    'Unusual %s %s demand in %s: %s requests observed vs ~%s expected (p=%s).',
    v_c.blood_group, v_c.component, v_c.city, v_c.observed_request_count,
    to_char(v_c.expected_lambda, 'FM999999990.00'), v_c.poisson_tail_probability);

  INSERT INTO surge_events
    (candidate_id, city, blood_group, component, status,
     confirmed_by_user_id, confirmed_at, summary, admin_note, is_synthetic)
  VALUES
    (p_candidate_id, v_c.city, v_c.blood_group, v_c.component, 'ACTIVE',
     p_admin_id, now(), v_summary, p_note, v_c.is_synthetic)
  RETURNING * INTO v_event;

  FOR v_admin IN SELECT id FROM users WHERE role = 'ADMIN' AND is_active
  LOOP
    PERFORM bd_enqueue_notification(
      v_admin, 'SURGE_CONFIRMED', 'SURGE_EVENT', v_event.id,
      format('SURGE_CONFIRMED:cand=%s:user=%s', p_candidate_id, v_admin),
      'Operational Blood-Demand Surge Confirmed',
      format('An operational blood-demand surge has been confirmed for %s / %s / %s. This confirms the internal demand state only, not an external cause.',
             v_c.city, v_c.blood_group, v_c.component),
      jsonb_build_object('candidateId', p_candidate_id, 'eventId', v_event.id,
                         'city', v_c.city, 'bloodGroup', v_c.blood_group, 'component', v_c.component));
  END LOOP;

  INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata_json)
  VALUES (p_admin_id, 'SURGE_CANDIDATE_CONFIRMED', 'SURGE_CANDIDATE', p_candidate_id,
          jsonb_build_object('eventId', v_event.id, 'city', v_c.city,
                             'bloodGroup', v_c.blood_group, 'component', v_c.component,
                             'observed', v_c.observed_request_count,
                             'expectedLambda', v_c.expected_lambda,
                             'poissonTailProbability', v_c.poisson_tail_probability,
                             'signalScore', v_c.signal_score,
                             'statusFrom', 'PENDING', 'statusTo', 'CONFIRMED'));

  RETURN jsonb_build_object(
    'candidate', (SELECT to_jsonb(c) FROM surge_candidates c WHERE c.id = p_candidate_id),
    'event', to_jsonb(v_event));
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 09 — ADMIN reject a surge candidate (PENDING -> REJECTED).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_reject_surge_candidate(
  p_admin_id     BIGINT,
  p_candidate_id BIGINT,
  p_note         TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_c     surge_candidates%ROWTYPE;
  v_admin BIGINT;
BEGIN
  SELECT * INTO v_c FROM surge_candidates WHERE id = p_candidate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SURGE_CANDIDATE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_c.status <> 'PENDING' THEN
    RAISE EXCEPTION 'INVALID_SURGE_STATE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE surge_candidates
     SET status = 'REJECTED', reviewed_by_user_id = p_admin_id,
         reviewed_at = now(), review_note = p_note
   WHERE id = p_candidate_id AND status = 'PENDING';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_SURGE_STATE' USING ERRCODE = 'P0001';
  END IF;

  FOR v_admin IN SELECT id FROM users WHERE role = 'ADMIN' AND is_active
  LOOP
    PERFORM bd_enqueue_notification(
      v_admin, 'SURGE_REJECTED', 'SURGE_CANDIDATE', p_candidate_id,
      format('SURGE_REJECTED:cand=%s:user=%s', p_candidate_id, v_admin),
      'Surge Candidate Rejected',
      format('The surge candidate for %s / %s / %s was reviewed and rejected by an administrator.',
             v_c.city, v_c.blood_group, v_c.component),
      jsonb_build_object('candidateId', p_candidate_id, 'city', v_c.city,
                         'bloodGroup', v_c.blood_group, 'component', v_c.component));
  END LOOP;

  INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata_json)
  VALUES (p_admin_id, 'SURGE_CANDIDATE_REJECTED', 'SURGE_CANDIDATE', p_candidate_id,
          jsonb_build_object('city', v_c.city, 'bloodGroup', v_c.blood_group,
                             'component', v_c.component,
                             'statusFrom', 'PENDING', 'statusTo', 'REJECTED'));

  RETURN jsonb_build_object(
    'candidate', (SELECT to_jsonb(c) FROM surge_candidates c WHERE c.id = p_candidate_id));
END;
$$;

-- ---------------------------------------------------------------------------
-- Module 07 — claim due notifications with a visibility lease.
-- FOR UPDATE SKIP LOCKED guarantees two concurrent workers never take the
-- same row; the lease push (next_attempt_at) keeps a claimed row invisible
-- to the next poll until the worker reports the outcome.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bd_claim_due_notifications(
  p_limit         INTEGER,
  p_lease_seconds INTEGER DEFAULT 60
) RETURNS SETOF notifications
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT id
      FROM notifications
     WHERE status = 'QUEUED'
       AND (next_attempt_at IS NULL OR next_attempt_at <= now())
     ORDER BY queued_at ASC, id ASC
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  )
  UPDATE notifications n
     SET next_attempt_at = now() + make_interval(secs => p_lease_seconds)
    FROM due
   WHERE n.id = due.id
  RETURNING n.*;
END;
$$;

-- Outcome reporters for the worker (each a single-row update, no cross-call state).
CREATE OR REPLACE FUNCTION bd_notification_mark_sent(p_id BIGINT)
RETURNS VOID LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp AS $$
  UPDATE notifications
     SET status = 'SENT', sent_at = now(), attempt_count = attempt_count + 1,
         last_error = NULL, next_attempt_at = NULL
   WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION bd_notification_mark_retry(p_id BIGINT, p_next_attempt_at TIMESTAMPTZ, p_error TEXT)
RETURNS VOID LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp AS $$
  UPDATE notifications
     SET status = 'QUEUED', attempt_count = attempt_count + 1,
         next_attempt_at = p_next_attempt_at, last_error = p_error
   WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION bd_notification_mark_failed(p_id BIGINT, p_error TEXT)
RETURNS VOID LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp AS $$
  UPDATE notifications
     SET status = 'FAILED', attempt_count = attempt_count + 1,
         failed_at = now(), next_attempt_at = NULL, last_error = p_error
   WHERE id = p_id;
$$;
