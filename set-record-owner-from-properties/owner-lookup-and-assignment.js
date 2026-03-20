/**
 * ============================================================================
 * HubSpot Custom Code Workflow Action
 * MODULAR OWNER LOOKUP & ASSIGNMENT
 * ============================================================================
 *
 * PURPOSE:
 * A reusable, modular custom code action that dynamically resolves a HubSpot
 * Owner ID from one or more user identifiers (User ID, Email, or Full Name),
 * then writes the resolved Owner ID to any specified HubSpot User/Owner-type
 * property on the enrolled record.
 *
 * ============================================================================
 * HOW TO USE:
 * ============================================================================
 *
 * 1. Assign up to to three optional identifier inputs via "Property to include code":
 *    - userIdInput:   A HubSpot User ID (Numeric, from fields like hs_created_by_user_id and hs_updated_by_user_id)
 *    - emailInput:    A user's email address (Must be the address they use to log into HubSpot)
 *    - fullNameInput: A user's full name (e.g., "Jane Smith". Must match exactly the user's full name in HubSpot User Table)
 *
 * 2. Update the Object (OBJECT_TYPE) and the TARGET_PROPERTY (the owner field to set) under "USER CONFIGURATION" (Lines 49-50)
 *   • OBJECT_TYPE → The object type of the enrolled record.
 *     Examples:
 *      - 'contacts'      (standard contacts)
 *      - 'companies'     (standard companies)
 *      - 'deals'         (standard deals)
 *      - 'tickets'       (standard tickets)
 *      - '2-8675309'     (custom object by ID)
 *
 *  • TARGET_PROPERTY → the owner field to set
 *     Examples:
 *       - 'hubspot_owner_id'    (Deal, Contact, and Company owner default field)
 *       - 'custom_owner_id'     (A custom owner field)
 *
 * 3. Update the SECRET_NAME by replacing 'Your_API_Key_Or_Secret' with your API key or Secret delcared in the custom code action above under "Secrets". 
 *
 * 4. Configure the output fields:
 * |  | ownerId       │ String │ The resolved Owner ID 
 * │  │ ownerName     │ String │ Full name of the matched owner
 * │  │ ownerEmail    │ String │ Email of the matched owner
 * │  │ matchMethod   │ String │ Which identifier matched ("userId", "email", or "fullName")
 * │  │ wasSuccessful │ String │ "yes" or "no"
 * │  │ message       │ String │ Human-readable status/error message
 *
 *
 * ============================================================================
 * HOW THE CODE WORKS:
 * ============================================================================
 * 1. It fetches all Owners from the Owners API (paginated) using the input fields selected, then attempts
 *    to match using a WATERFALL STRATEGY in this order:
 *
 *      Priority 1: User ID  → exact match on owner.userId (most reliable, from fields like hs_created_by_user_id and hs_updated_by_user_id)
 *      Priority 2: Email    → case-insensitive match on owner.email (Must be the address they use to log into HubSpot)
 *      Priority 3: Full Name → case-insensitive match on firstName + lastName (e.g., "Jane Smith". Must match exactly the user's full name in HubSpot User Table)
 *
 *    If Priority 1 finds a match, it stops. If not, it falls through to
 *    Priority 2, and so on. This means you can provide all three inputs for
 *    maximum resilience, or just one — whatever you have available. The code also handles NULL/Blank values as well.
 *
 * 3. Once matched, it writes the Owner ID to the configured target property
 *    on the enrolled record via a PATCH call.
 *
 * 4. Returns structured output fields for use in downstream workflow actions,
 *    including a clear success/fail indicator and human-readable message.
 */


const axios = require('axios');

// ═══════════════════════════════════════════════════════════════════════════════
// ██  USER CONFIGURATION — EDIT THESE THREE VALUES FOR YOUR USE CASE        ██
// ═══════════════════════════════════════════════════════════════════════════════

const OBJECT_TYPE     = 'deals';                         // The enrolled object type
const TARGET_PROPERTY = 'hubspot_owner_id';            // The Owner/User field to update
const SECRET_NAME     = 'Your_API_Key_Or_Secret';      // The name of your Secret

// ═══════════════════════════════════════════════════════════════════════════════
// ██  DO NOT EDIT BELOW THIS LINE (unless you know what you're doing!)      ██
// ═══════════════════════════════════════════════════════════════════════════════


/**
 * Fetches ALL owners from the HubSpot Owners API, handling pagination.
 * Returns the full array of owner objects.
 *
 * @param {string} accessToken - HubSpot Private App access token
 * @returns {Promise<Array>} - Array of owner objects
 */
async function fetchAllOwners(accessToken) {
  const allOwners = [];
  let after = undefined;
  let pageCount = 0;
  const MAX_PAGES = 20; // Safety cap: 20 × 100 = 2,000 owners

  while (pageCount < MAX_PAGES) {
    pageCount++;

    const params = { limit: 100 };
    if (after) params.after = after;

    const response = await axios.get('https://api.hubapi.com/crm/v3/owners', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      params
    });

    const owners = response.data.results || [];
    allOwners.push(...owners);
    console.log(`[Owners API] Page ${pageCount}: Retrieved ${owners.length} owners (Total: ${allOwners.length})`);

    // Check for next page
    if (response.data.paging && response.data.paging.next && response.data.paging.next.after) {
      after = response.data.paging.next.after;
    } else {
      break; // No more pages
    }
  }

  console.log(`[Owners API] Fetch complete. Total owners retrieved: ${allOwners.length}`);
  return allOwners;
}


/**
 * Attempts to find an owner using the WATERFALL STRATEGY:
 *   Priority 1: User ID (exact match)
 *   Priority 2: Email (case-insensitive)
 *   Priority 3: Full Name (case-insensitive, trimmed)
 *
 * Returns the matched owner object and the method used, or null if no match.
 *
 * @param {Array}  owners        - Array of owner objects from the Owners API
 * @param {string} userId        - User ID to match (may be empty/null)
 * @param {string} email         - Email to match (may be empty/null)
 * @param {string} fullName      - Full name to match (may be empty/null)
 * @returns {{ owner: Object, method: string } | null}
 */
function findOwnerByWaterfall(owners, userId, email, fullName) {

  // ── Priority 1: Match by User ID ─────────────────────────────────────────
  if (userId) {
    console.log(`[Lookup] Attempting match by User ID: "${userId}"`);
    const match = owners.find(owner => String(owner.userId) === String(userId));
    if (match) {
      console.log(`[Lookup] ✓ MATCHED by User ID`);
      return { owner: match, method: 'userId' };
    }
    console.log(`[Lookup] ✗ No match by User ID — falling through to email`);
  }

  // ── Priority 2: Match by Email ────────────────────────────────────────────
  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    console.log(`[Lookup] Attempting match by Email: "${normalizedEmail}"`);
    const match = owners.find(
      owner => owner.email && owner.email.trim().toLowerCase() === normalizedEmail
    );
    if (match) {
      console.log(`[Lookup] ✓ MATCHED by Email`);
      return { owner: match, method: 'email' };
    }
    console.log(`[Lookup] ✗ No match by Email — falling through to Full Name`);
  }

  // ── Priority 3: Match by Full Name ────────────────────────────────────────
  if (fullName) {
    const normalizedInput = fullName.trim().toLowerCase();
    console.log(`[Lookup] Attempting match by Full Name: "${normalizedInput}"`);
    const match = owners.find(owner => {
      const ownerFullName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim().toLowerCase();
      return ownerFullName === normalizedInput;
    });
    if (match) {
      console.log(`[Lookup] ✓ MATCHED by Full Name`);
      return { owner: match, method: 'fullName' };
    }

    // ── Full Name Fuzzy Fallback: Last, First format ──────────────────────
    // Some systems export names as "Smith, Jane" — try reversing
    if (normalizedInput.includes(',')) {
      const parts = normalizedInput.split(',').map(p => p.trim());
      if (parts.length === 2) {
        const reversed = `${parts[1]} ${parts[0]}`;
        console.log(`[Lookup] Retrying Full Name in reversed format: "${reversed}"`);
        const reversedMatch = owners.find(owner => {
          const ownerFullName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim().toLowerCase();
          return ownerFullName === reversed;
        });
        if (reversedMatch) {
          console.log(`[Lookup] ✓ MATCHED by Full Name (reversed "Last, First" format)`);
          return { owner: reversedMatch, method: 'fullName' };
        }
      }
    }

    console.log(`[Lookup] ✗ No match by Full Name`);
  }

  // ── No match found ────────────────────────────────────────────────────────
  return null;
}


/**
 * Builds a human-readable summary of which identifiers were provided and tried.
 * Used in error messages to help with debugging.
 *
 * @param {string} userId
 * @param {string} email
 * @param {string} fullName
 * @returns {string}
 */
function buildIdentifierSummary(userId, email, fullName) {
  const parts = [];
  if (userId)   parts.push(`User ID: "${userId}"`);
  if (email)    parts.push(`Email: "${email}"`);
  if (fullName) parts.push(`Full Name: "${fullName}"`);
  return parts.length > 0 ? parts.join(', ') : 'None provided';
}


/**
 * Returns a consistent failure response object.
 *
 * @param {string} message - Human-readable error message
 * @returns {Object}
 */
function failureResponse(message) {
  console.error(`[FAILURE] ${message}`);
  return {
    outputFields: {
      ownerId: '',
      ownerName: '',
      ownerEmail: '',
      matchMethod: '',
      wasSuccessful: 'no',
      message: message,
      hs_execution_state: 'FAIL_CONTINUE'
    }
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

exports.main = async (event, callback) => {

  const ACCESS_TOKEN = process.env[SECRET_NAME];
  const recordId = event.object.objectId;

  // ── Read all input fields (all optional — gracefully handle missing) ─────
  // Using logical OR with empty string to prevent undefined errors downstream
  const userIdInput   = (event.inputFields['userIdInput']   || '').trim();
  const emailInput    = (event.inputFields['emailInput']    || '').trim();
  const fullNameInput = (event.inputFields['fullNameInput'] || '').trim();

  const identifierSummary = buildIdentifierSummary(userIdInput, emailInput, fullNameInput);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`OWNER LOOKUP & ASSIGNMENT`);
  console.log(`Record ID:        ${recordId}`);
  console.log(`Object Type:      ${OBJECT_TYPE}`);
  console.log(`Target Property:  ${TARGET_PROPERTY}`);
  console.log(`Identifiers:      ${identifierSummary}`);
  console.log(`${'='.repeat(70)}\n`);

  // ── Validate: at least one identifier must be provided ────────────────────
  if (!userIdInput && !emailInput && !fullNameInput) {
    return callback(failureResponse(
      `No identifiers provided. At least one input field (userIdInput, emailInput, ` +
      `or fullNameInput) must contain a value. All three were empty for record ${recordId}.`
    ));
  }

  try {
    // ── Fetch all owners ──────────────────────────────────────────────────
    const owners = await fetchAllOwners(ACCESS_TOKEN);

    if (owners.length === 0) {
      return callback(failureResponse(
        `The Owners API returned zero owners. This is unexpected — verify the ` +
        `Private App token has the "crm.objects.owners.read" scope.`
      ));
    }

    // ── Run waterfall lookup ──────────────────────────────────────────────
    const result = findOwnerByWaterfall(owners, userIdInput, emailInput, fullNameInput);

    if (!result) {
      return callback(failureResponse(
        `No matching owner found. Tried: ${identifierSummary}. ` +
        `Searched ${owners.length} owners across all pages. ` +
        `Verify the input values are correct and the user exists as an Owner in HubSpot.`
      ));
    }

    const { owner, method } = result;
    const ownerId   = owner.id;
    const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim();
    const ownerEmail = owner.email || '';

    console.log(`\n[Result] Owner ID: ${ownerId}  Name: ${ownerName}  Email: ${ownerEmail}  Matched via: ${method}`);

    // ── Update the record ─────────────────────────────────────────────────
    await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/${OBJECT_TYPE}/${recordId}`,
      {
        properties: {
          [TARGET_PROPERTY]: ownerId
        }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const successMsg =
      `Owner resolved and assigned. ${ownerName} (${ownerEmail}) → ` +
      `Owner ID ${ownerId} written to "${TARGET_PROPERTY}" on record ${recordId}. ` +
      `Matched via: ${method}.`;

    console.log(`[SUCCESS] ${successMsg}`);

    return callback({
      outputFields: {
        ownerId:       String(ownerId),
        ownerName:     ownerName,
        ownerEmail:    ownerEmail,
        matchMethod:   method,
        wasSuccessful: 'yes',
        message:       successMsg,
        hs_execution_state: 'SUCCESS'
      }
    });

  } catch (error) {
    // ── Structured error handling ─────────────────────────────────────────
    const status  = error.response ? error.response.status : 'N/A';
    const detail  = error.response ? JSON.stringify(error.response.data) : error.message;

    let friendlyMsg = '';

    if (status === 401) {
      friendlyMsg =
        `Authentication failed (HTTP 401). The Private App token in the ` +
        `"${SECRET_NAME}" secret may be invalid, expired, or missing ` +
        `required scopes (crm.objects.owners.read, crm.objects.${OBJECT_TYPE}.write).`;
    } else if (status === 403) {
      friendlyMsg =
        `Permission denied (HTTP 403). The Private App token does not have ` +
        `sufficient permissions. Ensure it has read access to Owners and ` +
        `write access to the "${OBJECT_TYPE}" object type.`;
    } else if (status === 404) {
      friendlyMsg =
        `Record not found (HTTP 404). Record ID ${recordId} may have been ` +
        `deleted, or the OBJECT_TYPE "${OBJECT_TYPE}" is incorrect.`;
    } else if (status === 429) {
      friendlyMsg =
        `Rate limited (HTTP 429). HubSpot will automatically retry this action. ` +
        `No manual intervention needed.`;
    } else {
      friendlyMsg =
        `Unexpected error (HTTP ${status}). Detail: ${detail}. ` +
        `Identifiers tried: ${identifierSummary}.`;
    }

    return callback(failureResponse(friendlyMsg));
  }
};
