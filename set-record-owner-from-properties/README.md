# Owner Lookup & Assignment

Dynamically resolves a HubSpot Owner ID from one or more user identifiers (User ID, Email, or Full Name), then writes the resolved Owner ID to any specified HubSpot User/Owner-type property on the enrolled record.

---

## What It Does

HubSpot stores user identity across several different formats — numeric User IDs, email addresses, and display names — but Owner-type properties only accept an **Owner ID**. This action bridges that gap by accepting whichever identifier(s) you have available, looking up the corresponding Owner, and writing the resolved Owner ID to the property of your choice.

The action uses a **waterfall matching strategy**, attempting up to three match methods in order of reliability:

| Priority | Identifier | Match Method |
|---|---|---|
| 1 (Most Reliable) | User ID | Exact match on the owner's `userId` field |
| 2 | Email | Case-insensitive match on the owner's `email` field |
| 3 | Full Name | Case-insensitive match on the owner's `firstName` + `lastName` |

If Priority 1 finds a match, the action stops there. If not, it falls through to Priority 2, then Priority 3. You can provide all three inputs for maximum resilience, or just one — whatever you have available.

> [!IMPORTANT]
> The action also handles **"Last, First"** name formats automatically (e.g., "Smith, Jane" → "Jane Smith"). If the full name input contains a comma, the action will retry with the name parts reversed.

<details>
  <summary>Example Use Cases</summary>

| Scenario | Object Type | Target Property | Input Used |
|---|---|---|---|
| Flag users who manually created a custom object record | `2-8675309` (Custom Object) | `record_manually_created_by` | `userIdInput` → "Created by user ID" |
| Assign contact owner from a sales rep email field | `contacts` | `hubspot_owner_id` | `emailInput` → "assigned_rep_email" |
| Set deal owner from an imported full name column | `deals` | `hubspot_owner_id` | `fullNameInput` → "imported_rep_name" |
| Maximum resilience — provide all three identifiers | Any object | Any Owner field | All three inputs mapped |

</details>

---

#### Prerequisites

- HubSpot account with **Operations Hub Professional or Enterprise** (required for Custom Code Workflow Actions)
- A HubSpot **Private App access token** with the following scopes:
  - `crm.objects.owners.read`
  - Write access for the object type you're updating (e.g., `crm.objects.contacts.write`)

---

## Custom Code Action Setup

### Step 1: Add the Secret

In the custom code action's **Secrets** section, add your Private App access token:

1. Click **"Add Secret"**
2. Enter a **Secret name** (e.g., `Workflow_API_Requests`)
3. Paste your Private App access token as the **Value**

> [!IMPORTANT]
> Remember the exact secret name you enter here — you'll need it for the configuration step below.

---

### Step 2: Configure the Script

Three variables at the top of the script control all configuration. Update these to match your use case:

```js
const OBJECT_TYPE     = '0-1';                         // The enrolled object type
const TARGET_PROPERTY = 'hubspot_owner_id';            // The Owner/User field to update
const SECRET_NAME     = 'Your_API_Key_Or_Secret';      // The name of your Secret
```

| Variable | What to Enter | Examples |
|---|---|---|
| `OBJECT_TYPE` | The object type of the enrolled record | `'contacts'`, `'companies'`, `'deals'`, `'tickets'`, `'2-8675309'` (custom object) |
| `TARGET_PROPERTY` | The internal name of the Owner/User field you want to populate | `'hubspot_owner_id'`, `'custom_owner_field'` |
| `SECRET_NAME` | The exact secret name you created in Step 1 | `'Workflow_API_Requests'` |

> [!TIP]
> **Finding your Custom Object type ID:** In HubSpot, navigate to Settings → Objects → Custom Objects → select your object. The Object Type ID appears in the URL or in the object's details (formatted as `2-XXXXXXX`).
>
> **Finding internal property names:** In HubSpot, navigate to Settings → Properties → find your property → click it → the internal name is shown in the property details (or in the URL).

---

### Step 3: Add Input Fields

Configure one or more of the following input fields in the Custom Code action's **"Properties to include in code"** section. All are optional, but **at least one must have a value at runtime**.

| Input Field Name | What to Map It To | Notes |
|---|---|---|
| `userIdInput` | A User ID field (e.g., "Created by user ID", "Updated by user ID") | Most reliable match method. These are numeric HubSpot User IDs. |
| `emailInput` | An email field containing a HubSpot user's email address | Must be the email address the user logs into HubSpot with. |
| `fullNameInput` | A text field containing a user's full name (e.g., "Jane Smith") | Must match the user's first + last name as shown in HubSpot's user table. Also handles "Last, First" format. |

You do **not** need to add all three — just the ones relevant to your use case. The waterfall logic will use whatever is available and skip any that are blank or null.

> [!IMPORTANT]
> For each input field you add:
> - Set the input type to **"Property value"** (not "Static value")
> - Map it to the appropriate property on the enrolled record

---

### Step 4: Add Output Fields

Register the following output fields so downstream workflow actions can reference them:

| Output Field Name | Data Type | Description |
|---|---|---|
| `ownerId` | String | The resolved Owner ID (empty string if no match) |
| `ownerName` | String | Full name of the matched owner |
| `ownerEmail` | String | Email address of the matched owner |
| `matchMethod` | String | Which identifier was used to match: `userId`, `email`, or `fullName` |
| `wasSuccessful` | String | `yes` if an owner was found and assigned; `no` otherwise |
| `message` | String | Human-readable status message (success confirmation or error details) |

---

## Workflow Setup Tips

- **Enrollment trigger:** Enroll records when the relevant identifier property is known or updated (e.g., "Created by user ID is known").
- **This custom code action:** Add the custom code action as configured above.
- **Error handling branching:**
  - Add a branching action after the custom code action
  - Select **"Based on one property or action output"**
  - For the "Property or value to branch on", select your custom code action → `wasSuccessful`
  - Create branches for `yes` (success) and `no` (failure)
- **After branching:**
  - **`yes` branch:** The owner has already been written to the target property — no further action is needed unless you want to trigger additional downstream steps (e.g., send an internal notification including `ownerName` and `ownerEmail`).
  - **`no` branch:** The owner could not be resolved. Consider using an **internal notification email** that includes the `message` output for debugging context, or routing to a static list for manual review.

<details>
  <summary>Tips for Using Output Fields in Downstream Actions</summary>

| Output Field | Suggested Use |
|---|---|
| `wasSuccessful` | If/Then branch to handle success vs. failure paths |
| `message` | Include in internal notification emails for debugging context |
| `ownerName` / `ownerEmail` | Personalize internal alerts (e.g., "Record assigned to Jane Smith") |
| `matchMethod` | Auditing — track which identifier type resolved the match |
| `ownerId` | Use in subsequent custom code actions if additional logic is needed |

</details>

---

## How It Works (Technical Details)

<details>
  <summary>Click to expand</summary>

1. **Fetches all Owners** from the HubSpot Owners API with automatic pagination (up to 2,000 owners across 20 pages).
2. **Runs the waterfall lookup** against the fetched owners using whichever identifiers were provided as inputs.
3. **Writes the resolved Owner ID** to the configured target property on the enrolled record via a PATCH API call.
4. **Returns structured output fields** for use in downstream workflow actions.

The action includes comprehensive error handling with human-readable messages for common failure scenarios (authentication errors, permission issues, missing records, and rate limiting). If HubSpot returns a 429 rate limit response, the action allows HubSpot's built-in retry mechanism to handle it automatically.

</details>

---

## Compatibility Notes

- Tested on HubSpot's **Node.js 18** runtime
- Uses **axios** (included in HubSpot's runtime environment by default)
- Compatible with **any object type** — Contacts, Companies, Deals, Tickets, and Custom Objects
- Supports portals with up to **2,000 owners** (configurable via `MAX_PAGES` constant if needed)
