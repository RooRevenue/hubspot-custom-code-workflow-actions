# HubSpot Custom Code Workflow Actions

A growing library of Node.js scripts for use within HubSpot Custom Coded Workflow Actions. These actions follow best practices for error handling, API usage, and HubSpot data management — built for HubSpot admins and developers who want reliable, reusable automation.

## Prerequisites

- HubSpot account with **Operations Hub Professional or Enterprise** (required for Custom Code Workflow Actions)
- Basic familiarity with HubSpot Workflows and the Custom Code action type
- API key stored as a HubSpot Workflow Secret (recommended secret name is noted per action)

## How to Use

Each action lives in its own folder and contains:
- The `.js` script to paste into the Custom Code action
- A `README.md` with setup instructions, required inputs, and outputs

1. Browse to the action you need
2. Follow the folder-level README for configuration details
3. Paste the script into a Custom Code action in your HubSpot workflow
4. Configure the required input properties and secrets as documented

## Actions

| Action | Description |
|---|---|
| [State String to Dropdown](./state-string-to-dropdown/) | Converts a freeform state text field to a standardized dropdown value |

*More actions coming soon.*

## Contributing

This is a personal library, but if you spot a bug or have a suggestion, feel free to open an issue.

## License

[MIT](./LICENSE)
