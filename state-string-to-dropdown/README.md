# State & Territory Normalization

Normalizes a freeform state/region text field into a standardized US state or territory name suitable for writing to a HubSpot enumeration (dropdown) property.

Accepts **State/Region** and/or **IP State/Region** as input sources, with configurable preference and automatic fallback logic.

---


## What It Does

HubSpot contacts frequently have inconsistent state data — abbreviations, misspellings, mixed case, and nicknames accumulated from form fills, imports, and integrations. This action maps all common variations many common typos to the corrected official state name so your state data can be stored cleanly as a dropdown value.

> [!IMPORTANT]
> By default, this action checks the **State/Region** field first. If **State/Region** is NULL, the fallback is **IP State/Region** with special handling for **Virginia** values, which are often the result of a known bug. Rreconfiguring this fallback functionality is described in detail in later sections below.

<details>
  <summary>
    Examples of Normalization:
    
  </summary>
  
| Input | Output |
|---|---|
| `CA` | `California` |
| `new york` | `New York` |
| `Massachusettes` | `Massachusetts` |
| `N. Carolina` | `North Carolina` |
| `D.C.` | `Washington D.C.` |
| `USVI` | `U.S. Virgin Islands` |

 </details>
---


#### Coverage

- All **50 US states** with abbreviations, common misspellings, and regional nicknames
- **Washington D.C.**
- **US Territories:** Puerto Rico, U.S. Virgin Islands, Guam, American Samoa, Northern Mariana Islands

---


#### Prerequisites

- HubSpot account with **Operations Hub Professional or Enterprise** (required for Custom Code Workflow Actions)
- A custom HubSpot enumeration property to write the output to (see [Property Setup](#property-setup) below)

---


## Property Setup

You will need to create a custom enumeration (dropdown) property to store the output. This action is designed for a **single combined property** that holds both states and territories.

- **Suggested property label:** `State/Territory Normalized`
- **Suggested internal name:** `state_and_territory_normalized`
- **Suggested property type:** Dropdown select (enumeration)


> [!IMPORTANT]
> - The dropdown property you create must have option values that **exactly match** the code output. 
> - The code output options are listed below to ensure alignment and ease-of-creation. 
> - When creating the dropdown property, select "Load options" > "Paste your own".
> - Copy and paste the options listed below to quickly populate the matching values.



**State & Territory Options:**
<details>
  <summary> Click to Expand List</summary>
  
```
Alabama
Alaska
Arizona
Arkansas
California
Colorado
Connecticut
Delaware
Florida
Georgia
Hawaii
Idaho
Illinois
Indiana
Iowa
Kansas
Kentucky
Louisiana
Maine
Maryland
Massachusetts
Michigan
Minnesota
Mississippi
Missouri
Montana
Nebraska
Nevada
New Hampshire
New Jersey
New Mexico
New York
North Carolina
North Dakota
Ohio
Oklahoma
Oregon
Pennsylvania
Rhode Island
South Carolina
South Dakota
Tennessee
Texas
Utah
Vermont
Virginia
Washington
West Virginia
Wisconsin
Wyoming
Washington D.C.
Puerto Rico
U.S. Virgin Islands
Guam
American Samoa
Northern Mariana Islands
```
</details>

---
## Custom Code Action Setup

### Input Fields

Configure these in the Custom Code action's **Input fields** section in your workflow:

| Input Field Name | Map To |
|---|---|
| `state` | `State/Region` |
| `ip_state` | `IP State/Region` |

Both fields are optional — the script handles null values gracefully. You can map just one if needed. You can also map any other string-type custom state fields you may have as well. 
However, do note the special fallback and exclusion rules for **IP State/Region**, listed below. 

### Configuration

The `PREFER` variable at the top of the script can be changed without touching any other logic. This setting denotes whether **State/Region** or **IP State/Region** values should be preferred/checked first. The property NOT selected will be the fallback option.

```js
const PREFER = 'state';
```

| Value | Behavior |
|---|---|
| `'state'` *(default)* | Check State/Region first. Fall back to IP State/Region if null. |
| `'ip_state'` | Check IP State/Region first. Fall back to State/Region if null. |

---

### Using IP State/Region as a Source

HubSpot's **IP State/Region** field can be used alongside (or instead of) **State/Region**. By default, the action first checks **State/Region**, and uses **IP State/Region** for fallback. However, be aware of a known reliability issue:

> [!Important] 
> **Virginia IP Attribution Warning**
>
> IP State/Region disproportionately returns "Virginia" for contacts who are not actually in Virginia. This occurs because a large volume of US internet traffic routes through Northern Virginia data centers (primarily AWS us-east-1), causing many contacts to be incorrectly attributed.
>
> This script automatically handles this case — see [Virginia Fallback Logic](#virginia-fallback-logic) below.

---




### Virginia Fallback Logic

Regardless of the `PREFER` setting, IP State/Region is ***never trusted*** when it returns Virginia. The script handles this as follows:

| IP State | State/Region | Result |
|---|---|---|
| Virginia / VA | Has a value | Falls back to State/Region; outputs that value (including "Virginia" if State/Region also says Virginia — manual data is trusted) |
| Virginia / VA | Null | `match_found: false`, `error_message` populated explaining the IP attribution issue |

---



### Output Field Setup

| Output Field | Data Type | Description | Configuration Value |
|---|---|---|---|
| `normalized_state_and_territory` | Enumeration | Matched official name, or `null` if no match | Copy-paste the "Normalized_State_and_Territory" semicolon separated options listed below in the [State & Territory Enumeration Output Options](#State-and-Territory-Enumeration-Output-Options) |
| `unmatched_value` | String | The original input value if no match was found, or `null` | N/A |
| `match_found` | Enumeration | `true` if a match was found | Copy-paste the following: `true;false`|
| `error_message` | String | Populated only on a caught error or Virginia IP issue | Confirguration: N/A|

#### State & Territory Enumeration Output Options
Copy-paste the following values exactly as shown into the custom code output section after selecting "Enumeration" and naming the output field "normalized_state_and_territory".
<details>
  <Summary>State and Territory Enumeration Output Options </Summary>
  Alabama;Alaska;Arizona;Arkansas;California;Colorado;Connecticut;Delaware;Florida;Georgia;Hawaii;Idaho;Illinois;Indiana;Iowa;Kansas;Kentucky;Louisiana;Maine;Maryland;Massachusetts;Michigan;Minnesota;Mississippi;Missouri;Montana;Nebraska;Nevada;New Hampshire;New Jersey;New Mexico;New York;North Carolina;North Dakota;Ohio;Oklahoma;Oregon;Pennsylvania;Rhode Island;South Carolina;South Dakota;Tennessee;Texas;Utah;Vermont;Virginia;Washington;West Virginia;Wisconsin;Wyoming;Washington D.C.;Puerto Rico;U.S. Virgin Islands;Guam;American Samoa;Northern Mariana Islands

</details>

---






## Workflow Setup Tips

- **Enrollment trigger:** Enroll contacts when `State/Region` is known, or if `IP State/Region` is known.
  - **Re-enrollment:** Enable re-enrollment if you want the action to re-run when State/Region and/or IP State/Region is updated. Recommend re-enrolling on State/Region only.
- **This custom code action:** Add the custom code action detailed here.
- **Error handling branching:** 
  - Add a branching action. Select "Based on one property or action output". 
  - For the "Property or value to branch on", select "1. Custom code" > "match_found"
  - Select "Create a separate branch..." > "Next"
    - "true" means a match was found.
    - "false" means no match was found.
- **After Error handling branching:**
  - "true" branch: Add an **Edit Record** action and map `normalized_state_and_territory` output to your dropdown property.
  - "false" branch: no mapping was found. Recommend routing these records with unrecognized state values to a static list for logging, or if needed, creating a task to manually review the `unmatched_value`.

---



## Mapping New String Variations & Typos

All mappings live in the `STATE_AND_REGION_MAPPINGS` object near the top of the script, organized by state/territory with comments. To add a new variation:


> [!IMPORTANT]
> ⚠️ Before adding new mapping, make sure to search the file for your new key to confirm it doesn't already exist elsewhere in the object — **duplicate keys are silently overwritten by JavaScript with no warning!**


1. Find the relevant state or territory section
2. Add a new line: `"your variation": "Official Name",`
3. Ensure your key is **lowercase** — the script lowercases all input before lookup
4. Ensure the value **exactly matches** the enumeration option in your HubSpot property

---


## Compatibility Notes

- Tested on HubSpot's Node.js 18 runtime
- No external packages required — the `@hubspot/api-client` import is intentionally omitted since no API calls are made
- Compatible with Contact, Company, and Deal-based workflows (any object that has a state/region field)
