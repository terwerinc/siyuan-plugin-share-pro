# Development Notes

## Mainline

This project is the professional authoring side of share-pro. Development should keep the authoring flow, persisted settings, and publish results aligned with the existing viewer experience.

## Configuration Direction

The current mainline keeps two user-facing switches in the product flow:

- AI assistant
- Info bar

Both switches must preserve historical default-on behavior for upgraded users.

## Share Flow

The share flow now follows a simple mainline:

- Global settings provide the baseline behavior.
- The new share UI can apply document-level AI assistant preferences.
- Published output remains compatible with the existing viewer contract.

## Documentation Scope

This document only describes the mainline design direction and compatibility goals.
Implementation details, field-level precedence, and low-level persistence rules should stay in code and tests rather than in README or DEVELOPMENT notes.
