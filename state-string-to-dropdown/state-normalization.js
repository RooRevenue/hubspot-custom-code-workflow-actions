// HubSpot Custom Code Workflow Action: State & Territory Normalization
// Purpose: Normalizes plaintext state/territory input to a standardized US name.
//          Accepts State/Region and IP State/Region as sources, with fallback logic.
// Handles: Abbreviations, misspellings, nicknames, mixed case, extra whitespace
//
// INPUTS (configure in HubSpot workflow action):
//   state    → Contact/Company "State/Region" property
//   ip_state → Contact "IP State/Region" property
//
// OUTPUTS:
//   normalized_state_and_territory → Matched US state or territory name (enumeration), or null
//   unmatched_value                → Original input if no match was found, or null
//   match_found                    → Boolean, true if a match was found
//   error_message                  → Populated only on error or Virginia IP issue

exports.main = async (event, callback) => {

  // =============================================================
  // ✏️  CONFIGURATION — EDIT HERE
  // =============================================================

  // Which field to check FIRST before falling back to the other.
  // Options: 'state' (default) | 'ip_state'
  //
  // 'state'    → Check State/Region first. Fall back to IP State/Region if null.
  // 'ip_state' → Check IP State/Region first. Fall back to State/Region if null.
  //
  // NOTE: Regardless of this setting, if IP State/Region returns "Virginia" or "VA",
  //       the script will always fall back to State/Region due to known IP attribution
  //       issues. See VIRGINIA IP NOTE below for details.

  const PREFER = 'state';

  // =============================================================
  // ✏️  EDITING GUIDE — STATE_AND_REGION_MAPPINGS
  // =============================================================
  //
  // This is the only other section you should need to edit.
  // All US states, territories, and Washington D.C. are combined
  // into a single mapping object for simplicity.
  //
  // Format:
  //   "input variation (lowercase)": "Official Enumeration Value"
  //
  // Rules:
  //   - All keys MUST be lowercase (input is lowercased before lookup)
  //   - Values must exactly match the enumeration option in your HubSpot property
  //   - Multi-word keys with spaces are supported: "new york": "New York"
  //   - Periods are stripped automatically before lookup, so "n.y." resolves as "ny"
  //   - To add a new variation, add a new key/value line in the appropriate section
  //   - ⚠️  Duplicate key warning: if you add a key that already exists elsewhere
  //     in this object, JavaScript will silently use the later definition. Search
  //     the file for your new key before adding it to avoid silent overwrites.

  const STATE_AND_REGION_MAPPINGS = {

    // ── US STATES ──────────────────────────────────────────────

    // Alabama
    "alabama": "Alabama",
    "al": "Alabama",
    "bama": "Alabama",
    "alabam": "Alabama",
    "alabma": "Alabama",

    // Alaska
    "alaska": "Alaska",
    "ak": "Alaska",
    "alsaka": "Alaska",
    "alask": "Alaska",

    // Arizona
    "arizona": "Arizona",
    "az": "Arizona",
    "ariz": "Arizona",
    "arizon": "Arizona",
    "arazona": "Arizona",

    // Arkansas
    "arkansas": "Arkansas",
    "ar": "Arkansas",
    "ark": "Arkansas",
    "arkansaw": "Arkansas",
    "arkensas": "Arkansas",

    // California
    "california": "California",
    "ca": "California",
    "cali": "California",
    "calif": "California",
    "cal": "California",
    "californa": "California",
    "californai": "California",
    "califronia": "California",

    // Colorado
    "colorado": "Colorado",
    "co": "Colorado",
    "colo": "Colorado",
    "colorodo": "Colorado",
    "colrado": "Colorado",

    // Connecticut
    "connecticut": "Connecticut",
    "ct": "Connecticut",
    "conn": "Connecticut",
    "conneticut": "Connecticut",
    "conecticut": "Connecticut",
    "connnecticut": "Connecticut",
    "connecticutt": "Connecticut",

    // Delaware
    "delaware": "Delaware",
    "de": "Delaware",
    "del": "Delaware",
    "deleware": "Delaware",
    "delawere": "Delaware",

    // Florida
    "florida": "Florida",
    "fl": "Florida",
    "fla": "Florida",
    "flor": "Florida",
    "flordia": "Florida",
    "floirda": "Florida",

    // Georgia
    "georgia": "Georgia",
    "ga": "Georgia",
    "geo": "Georgia",
    "gorgia": "Georgia",
    "gerogia": "Georgia",

    // Hawaii
    "hawaii": "Hawaii",
    "hi": "Hawaii",
    "hawai": "Hawaii",
    "hawaiii": "Hawaii",
    "hawii": "Hawaii",
    "hwaii": "Hawaii",

    // Idaho
    "idaho": "Idaho",
    "id": "Idaho",
    "idho": "Idaho",

    // Illinois
    "illinois": "Illinois",
    "il": "Illinois",
    "ill": "Illinois",
    "illnois": "Illinois",
    "illinios": "Illinois",
    "ilinois": "Illinois",
    "illinoi": "Illinois",

    // Indiana
    "indiana": "Indiana",
    "in": "Indiana",
    "ind": "Indiana",
    "indana": "Indiana",
    "indianna": "Indiana",

    // Iowa
    "iowa": "Iowa",
    "ia": "Iowa",
    "iawa": "Iowa",
    "iowah": "Iowa",

    // Kansas
    "kansas": "Kansas",
    "ks": "Kansas",
    "kan": "Kansas",
    "kans": "Kansas",
    "kanasas": "Kansas",
    "kensas": "Kansas",

    // Kentucky
    "kentucky": "Kentucky",
    "ky": "Kentucky",
    "ken": "Kentucky",
    "kent": "Kentucky",
    "kentuckey": "Kentucky",
    "kentuky": "Kentucky",

    // Louisiana
    "louisiana": "Louisiana",
    "la": "Louisiana",
    "lou": "Louisiana",
    "louis": "Louisiana",
    "louisianna": "Louisiana",
    "lousiana": "Louisiana",
    "louisana": "Louisiana",

    // Maine
    "maine": "Maine",
    "me": "Maine",
    "main": "Maine",
    "miane": "Maine",

    // Maryland
    "maryland": "Maryland",
    "md": "Maryland",
    "mary": "Maryland",
    "marland": "Maryland",
    "marryland": "Maryland",
    "maryalnd": "Maryland",

    // Massachusetts
    "massachusetts": "Massachusetts",
    "ma": "Massachusetts",
    "mass": "Massachusetts",
    "massachusets": "Massachusetts",
    "massachussetts": "Massachusetts",
    "massachsetts": "Massachusetts",
    "masachusetts": "Massachusetts",
    "massachusettes": "Massachusetts",

    // Michigan
    "michigan": "Michigan",
    "mi": "Michigan",
    "mich": "Michigan",
    "michagan": "Michigan",
    "michgan": "Michigan",
    "micigan": "Michigan",

    // Minnesota
    "minnesota": "Minnesota",
    "mn": "Minnesota",
    "minn": "Minnesota",
    "minne": "Minnesota",
    "minesota": "Minnesota",
    "minnesotta": "Minnesota",
    "minnestoa": "Minnesota",

    // Mississippi
    "mississippi": "Mississippi",
    "ms": "Mississippi",
    "miss": "Mississippi",
    "missisippi": "Mississippi",
    "missippi": "Mississippi",
    "mississipi": "Mississippi",
    "misissipi": "Mississippi",

    // Missouri
    "missouri": "Missouri",
    "mo": "Missouri",
    "missou": "Missouri",
    "missourie": "Missouri",
    "misouri": "Missouri",
    "mossouri": "Missouri",

    // Montana
    "montana": "Montana",
    "mt": "Montana",
    "mont": "Montana",
    "montna": "Montana",
    "motana": "Montana",

    // Nebraska
    "nebraska": "Nebraska",
    "ne": "Nebraska",
    "neb": "Nebraska",
    "nebr": "Nebraska",
    "nabraska": "Nebraska",
    "nebreska": "Nebraska",

    // Nevada
    "nevada": "Nevada",
    "nv": "Nevada",
    "nev": "Nevada",
    "nevda": "Nevada",
    "neveda": "Nevada",

    // New Hampshire
    "new hampshire": "New Hampshire",
    "newhampshire": "New Hampshire",
    "nh": "New Hampshire",
    "new hamshire": "New Hampshire",
    "new hampshir": "New Hampshire",
    "newhampshir": "New Hampshire",

    // New Jersey
    "new jersey": "New Jersey",
    "newjersey": "New Jersey",
    "nj": "New Jersey",
    "new jersy": "New Jersey",
    "new jerse": "New Jersey",
    "jersey": "New Jersey",

    // New Mexico
    "new mexico": "New Mexico",
    "newmexico": "New Mexico",
    "nm": "New Mexico",
    "new mex": "New Mexico",
    "new mexco": "New Mexico",
    "newmex": "New Mexico",

    // New York
    "new york": "New York",
    "newyork": "New York",
    "ny": "New York",
    "nyc": "New York",
    "new youk": "New York",
    "newyrok": "New York",

    // North Carolina
    "north carolina": "North Carolina",
    "northcarolina": "North Carolina",
    "nc": "North Carolina",
    "n carolina": "North Carolina",
    "ncarolina": "North Carolina",
    "north carolna": "North Carolina",

    // North Dakota
    "north dakota": "North Dakota",
    "northdakota": "North Dakota",
    "nd": "North Dakota",
    "n dakota": "North Dakota",
    "ndakota": "North Dakota",
    "north dakta": "North Dakota",

    // Ohio
    "ohio": "Ohio",
    "oh": "Ohio",
    "ohi": "Ohio",
    "ohoi": "Ohio",

    // Oklahoma
    "oklahoma": "Oklahoma",
    "ok": "Oklahoma",
    "okla": "Oklahoma",
    "oklahom": "Oklahoma",
    "okalhoma": "Oklahoma",
    "oaklahoma": "Oklahoma",

    // Oregon
    "oregon": "Oregon",
    "or": "Oregon",
    "ore": "Oregon",
    "oreg": "Oregon",
    "oregeon": "Oregon",
    "oregn": "Oregon",

    // Pennsylvania
    "pennsylvania": "Pennsylvania",
    "pa": "Pennsylvania",
    "penn": "Pennsylvania",
    "penna": "Pennsylvania",
    "pensylvania": "Pennsylvania",
    "pennsylvana": "Pennsylvania",
    "pensilvania": "Pennsylvania",
    "pennslvania": "Pennsylvania",

    // Rhode Island
    "rhode island": "Rhode Island",
    "rhodeisland": "Rhode Island",
    "ri": "Rhode Island",
    "rhode iland": "Rhode Island",
    "rode island": "Rhode Island",

    // South Carolina
    "south carolina": "South Carolina",
    "southcarolina": "South Carolina",
    "sc": "South Carolina",
    "s carolina": "South Carolina",
    "scarolina": "South Carolina",
    "south carolna": "South Carolina",

    // South Dakota
    "south dakota": "South Dakota",
    "southdakota": "South Dakota",
    "sd": "South Dakota",
    "s dakota": "South Dakota",
    "sdakota": "South Dakota",
    "south dakta": "South Dakota",

    // Tennessee
    "tennessee": "Tennessee",
    "tn": "Tennessee",
    "tenn": "Tennessee",
    "tennesee": "Tennessee",
    "tennesse": "Tennessee",
    "tenessee": "Tennessee",
    "tennissee": "Tennessee",

    // Texas
    "texas": "Texas",
    "tx": "Texas",
    "tex": "Texas",
    "texs": "Texas",
    "texa": "Texas",
    "texass": "Texas",

    // Utah
    "utah": "Utah",
    "ut": "Utah",
    "utha": "Utah",
    "utahh": "Utah",

    // Vermont
    "vermont": "Vermont",
    "vt": "Vermont",
    "verm": "Vermont",
    "vermot": "Vermont",
    "vermount": "Vermont",

    // Virginia
    "virginia": "Virginia",
    "va": "Virginia",
    "virg": "Virginia",
    "virgina": "Virginia",
    "verginia": "Virginia",
    "virgnia": "Virginia",
    "virginai": "Virginia",
    "virginaia": "Virginia",
    "virgenia": "Virginia",
    "virginnia": "Virginia",
    "vagina": "Virginia",
    

    // Washington (state — plain "washington" intentionally resolves to the state, not D.C.)
    "washington": "Washington",
    "wa": "Washington",
    "wash": "Washington",
    "washingtn": "Washington",
    "wahsington": "Washington",
    "washignton": "Washington",

    // West Virginia
    "west virginia": "West Virginia",
    "westvirginia": "West Virginia",
    "wv": "West Virginia",
    "w virginia": "West Virginia",
    "wvirginia": "West Virginia",
    "west virgina": "West Virginia",
    "w va": "West Virginia",
	"wva": "West Virginia",
	"west virg": "West Virginia",
	"west verginia": "West Virginia",
	"west virgnia": "West Virginia",
	"west virginai": "West Virginia",
	"west virginaia": "West Virginia",
	"west virgenia": "West Virginia",
	"west virginnia": "West Virginia",
	"west vagina": "West Virginia",
    "w virg": "West Virginia",
	"w verginia": "West Virginia",
	"w virgnia": "West Virginia",
	"w virginai": "West Virginia",
	"w virginaia": "West Virginia",
	"w virgenia": "West Virginia",
	"w virginnia": "West Virginia",

    // Wisconsin
    "wisconsin": "Wisconsin",
    "wi": "Wisconsin",
    "wis": "Wisconsin",
    "wisc": "Wisconsin",
    "wisconson": "Wisconsin",
    "wisconsn": "Wisconsin",
    "wiscosin": "Wisconsin",

    // Wyoming
    "wyoming": "Wyoming",
    "wy": "Wyoming",
    "wyo": "Wyoming",
    "wyomng": "Wyoming",
    "wyomin": "Wyoming",

    // ── US TERRITORIES & FEDERAL DISTRICT ──────────────────────

    // Washington D.C.
    "washington dc": "Washington D.C.",
    "washington d.c": "Washington D.C.",
    "district of columbia": "Washington D.C.",
    "dc": "Washington D.C.",
    "d.c": "Washington D.C.",
    "the district": "Washington D.C.",
    "washington district of columbia": "Washington D.C.",
    "washington, dc": "Washington D.C.",
    "washinton dc": "Washington D.C.",
    "washingon dc": "Washington D.C.",
    "washigton dc": "Washington D.C.",
    "dist of columbia": "Washington D.C.",
    "dist columbia": "Washington D.C.",
    "washingtondc": "Washington D.C.",

    // Puerto Rico
    "puerto rico": "Puerto Rico",
    "pr": "Puerto Rico",
    "puertorico": "Puerto Rico",
    "puerto ric": "Puerto Rico",
    "pureto rico": "Puerto Rico",
    "pueto rico": "Puerto Rico",
    "puerto rcio": "Puerto Rico",
    "porto rico": "Puerto Rico",

    // U.S. Virgin Islands
    "us virgin islands": "U.S. Virgin Islands",
    "u.s. virgin islands": "U.S. Virgin Islands",
    "united states virgin islands": "U.S. Virgin Islands",
    "virgin islands": "U.S. Virgin Islands",
    "vi": "U.S. Virgin Islands",
    "usvi": "U.S. Virgin Islands",
    "us vi": "U.S. Virgin Islands",
    "u.s.v.i": "U.S. Virgin Islands",
    "virgin ilands": "U.S. Virgin Islands",
    "virgin islnds": "U.S. Virgin Islands",
    "virgin islands us": "U.S. Virgin Islands",

    // Guam
    "guam": "Guam",
    "gu": "Guam",
    "guahan": "Guam",
    "guahon": "Guam",
    "guam island": "Guam",
    "guama": "Guam",
    "guam territory": "Guam",

    // American Samoa
    "american samoa": "American Samoa",
    "as": "American Samoa",
    "americansamoa": "American Samoa",
    "american somoa": "American Samoa",
    "american saoma": "American Samoa",
    "am samoa": "American Samoa",
    "amsamoa": "American Samoa",
    "samoa": "American Samoa",
    "american samao": "American Samoa",

    // Northern Mariana Islands
    "northern mariana islands": "Northern Mariana Islands",
    "mp": "Northern Mariana Islands",
    "cnmi": "Northern Mariana Islands",
    "commonwealth of the northern mariana islands": "Northern Mariana Islands",
    "n mariana islands": "Northern Mariana Islands",
    "northern marianas": "Northern Mariana Islands",
    "nmariana": "Northern Mariana Islands",
    "northern mariana ilands": "Northern Mariana Islands",
    "n mariana ilands": "Northern Mariana Islands",
    "mariana islands": "Northern Mariana Islands",
    "northern marianna islands": "Northern Mariana Islands"

  };

  // =============================================================
  // VIRGINIA IP NOTE
  // =============================================================
  // HubSpot's IP State/Region field disproportionately returns
  // "Virginia" because a large volume of US internet traffic routes
  // through Northern Virginia data centers (primarily AWS us-east-1).
  // This causes many non-Virginia contacts to be misattributed.
  //
  // This script handles Virginia from IP State as follows:
  //   - If IP State = Virginia/VA → fall back to State/Region
  //   - If State/Region = Virginia → the manual value is trusted; outputs "Virginia"
  //   - If State/Region is also null → match_found: false with error_message
  // =============================================================

  const VIRGINIA_IP_ERROR =
    'IP State/Region returned "Virginia" which cannot be trusted — a disproportionate ' +
    'amount of US internet traffic routes through Northern Virginia data centers ' +
    '(AWS us-east-1, etc.), causing many non-Virginia contacts to be misattributed. ' +
    'State/Region was null, so no reliable fallback was available.';

  // =============================================================
  // HELPER FUNCTIONS
  // =============================================================

  // Returns true if the input resolves to Virginia (used to flag the IP State issue)
  function isVirginiaValue(input) {
    if (!input || typeof input !== 'string') return false;
    const cleaned = input.trim().toLowerCase().replace(/\./g, '');
    return cleaned === 'virginia' || cleaned === 'va';
  }

  // Returns true if the input has a usable non-empty value
  function hasValue(input) {
    return input && typeof input === 'string' && input.trim() !== '';
  }

  // Cleans and looks up input against STATE_AND_REGION_MAPPINGS
  function normalizeInput(input) {
    if (!hasValue(input)) {
      return { matched: false, value: null, original: input || null };
    }

    const cleaned = input
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/\./g, '');

    if (Object.prototype.hasOwnProperty.call(STATE_AND_REGION_MAPPINGS, cleaned)) {
      return { matched: true, value: STATE_AND_REGION_MAPPINGS[cleaned], original: input };
    }

    return { matched: false, value: null, original: input };
  }

  // =============================================================
  // MAIN EXECUTION
  // =============================================================

  try {
    const stateValue   = event.inputFields['state'];
    const ipStateValue = event.inputFields['ip_state'];

    let result;
    let errorMessage = null;

    if (PREFER === 'state') {

      if (hasValue(stateValue)) {
        // Primary: use State/Region
        result = normalizeInput(stateValue);

      } else if (hasValue(ipStateValue)) {
        // Fallback: use IP State — but block Virginia due to attribution issue
        if (isVirginiaValue(ipStateValue)) {
          result = { matched: false, value: null, original: ipStateValue };
          errorMessage = VIRGINIA_IP_ERROR;
        } else {
          result = normalizeInput(ipStateValue);
        }

      } else {
        // Both fields are null
        result = { matched: false, value: null, original: null };
      }

    } else {
      // PREFER === 'ip_state'

      if (hasValue(ipStateValue) && isVirginiaValue(ipStateValue)) {
        // IP State is Virginia — always fall back to State/Region regardless of PREFER
        if (hasValue(stateValue)) {
          // Trust State/Region even if it also says Virginia
          result = normalizeInput(stateValue);
        } else {
          // No State/Region fallback available
          result = { matched: false, value: null, original: ipStateValue };
          errorMessage = VIRGINIA_IP_ERROR;
        }

      } else if (hasValue(ipStateValue)) {
        // Primary: use IP State (non-Virginia)
        result = normalizeInput(ipStateValue);

      } else if (hasValue(stateValue)) {
        // Fallback: IP State is null, use State/Region
        result = normalizeInput(stateValue);

      } else {
        // Both fields are null
        result = { matched: false, value: null, original: null };
      }
    }

    // Build and return output
    const output = {
      normalized_state_and_territory: result.matched ? result.value  : null,
      unmatched_value:                result.matched ? null           : (result.original || null),
      match_found:                    result.matched
    };

    if (errorMessage) {
      output.error_message = errorMessage;
    }

    callback({ outputFields: output });

  } catch (error) {
    console.error('State normalization error:', error.message);
    callback({
      outputFields: {
        normalized_state_and_territory: null,
        unmatched_value:                null,
        match_found:                    false,
        error_message:                  error.message
      }
    });
  }

};
