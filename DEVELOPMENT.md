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

## Service Connection

Open **Share setting → General** to configure the sharing API address and Key. The API address is separate from the public reading address. Saving reloads the account status in the same dialog. Settings remain available when the service cannot be reached or authorization fails.

## Regression Tests

```sh
pnpm install --frozen-lockfile
pnpm test:run
pnpm build
```

The component suite covers service configuration, account refresh, and recovery controls. SiYuan installation and public-service sharing require separate host acceptance.
