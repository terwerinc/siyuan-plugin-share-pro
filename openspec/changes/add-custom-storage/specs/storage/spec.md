## ADDED Requirements

### Requirement: Storage Backend Type Definition
The system SHALL define a `StorageBackendType` union type to identify supported storage backends.

#### Scenario: Type safety for storage backends
- **WHEN** developers reference storage backend types
- **THEN** the type system SHALL allow: "default", "openlist", "rustfs"

### Requirement: Storage Configuration Interface
The system SHALL provide a `StorageConfig` interface to manage multiple storage backends.

#### Scenario: Storage configuration structure
- **GIVEN** a user wants to configure custom storage
- **WHEN** the configuration is saved
- **THEN** it SHALL include: enabled flag, activeBackendId, backends array, optional defaultConfig, optional migration info

### Requirement: OpenList Storage Backend Support
The system SHALL support OpenList as a custom storage backend with comprehensive configuration options.

#### Scenario: OpenList configuration
- **GIVEN** a user wants to use OpenList for storage
- **WHEN** configuring the backend
- **THEN** the system SHALL support: serverUrl, token, rootPath, storageDriver, storagePath, maxFileSize, useProxy
- **AND** the configuration SHALL include status and healthCheck fields managed by the backend

#### Scenario: OpenList health check
- **GIVEN** an OpenList backend is configured
- **WHEN** a health check is performed
- **THEN** the system SHALL return: healthy status, latency, availableSpace, totalSpace, lastCheckTime, optional errorMessage

### Requirement: RustFS Storage Backend Support
The system SHALL support RustFS as a custom storage backend with S3-compatible configuration.

#### Scenario: RustFS configuration
- **GIVEN** a user wants to use RustFS for storage
- **WHEN** configuring the backend
- **THEN** the system SHALL support: endpoint, port, consolePort, useSSL, accessKey, secretKey, bucket, region, rootPath, maxFileSize, urlExpiry
- **AND** the configuration SHALL include status and healthCheck fields managed by the backend

#### Scenario: RustFS health check
- **GIVEN** a RustFS backend is configured
- **WHEN** a health check is performed
- **THEN** the system SHALL return: healthy status, latency, availableSpace, totalSpace, lastCheckTime, optional errorMessage

### Requirement: File Size Limit Enforcement
The system SHALL enforce a 50MB file size limit for all custom storage backends.

#### Scenario: File size validation
- **GIVEN** a user attempts to upload a file
- **WHEN** the file size exceeds 50MB
- **THEN** the system SHALL reject the upload with error code STORAGE_FILE_TOO_LARGE
- **AND** display a user-friendly error message

### Requirement: Storage Backend Management API
The system SHALL provide a complete set of APIs for storage backend management.

#### Scenario: List storage backends
- **GIVEN** a user wants to view configured storage backends
- **WHEN** calling getStorageList API
- **THEN** the system SHALL return all backends with: id, name, type, status, healthCheck, createdAt, updatedAt
- **AND** include the activeBackendId

#### Scenario: Add storage backend
- **GIVEN** a user wants to add a new storage backend
- **WHEN** calling addStorageBackend API with type, name, and config
- **THEN** the system SHALL validate the configuration
- **AND** create the backend with inactive status
- **AND** return the created backend id

#### Scenario: Update storage backend
- **GIVEN** an existing storage backend
- **WHEN** calling updateStorageBackend API with id and partial config
- **THEN** the system SHALL update only the provided fields
- **AND** trigger a health check if connection-related fields changed

#### Scenario: Delete storage backend
- **GIVEN** an existing inactive storage backend
- **WHEN** calling deleteStorageBackend API
- **THEN** the system SHALL remove the backend configuration
- **AND** prevent deletion if it is the only backend and custom storage is enabled

#### Scenario: Switch active storage backend
- **GIVEN** multiple configured storage backends
- **WHEN** calling switchStorageBackend API with backendId
- **THEN** the system SHALL validate the target backend is healthy
- **AND** update the activeBackendId
- **AND** return success confirmation

### Requirement: Storage Health Check
The system SHALL provide health check functionality for storage backends.

#### Scenario: Single backend health check
- **GIVEN** a configured storage backend
- **WHEN** calling checkStorageHealth API with backendId
- **THEN** the system SHALL perform a connectivity test
- **AND** return health status, latency, and storage information

#### Scenario: All backends health check
- **GIVEN** multiple configured storage backends
- **WHEN** calling checkAllStorageHealth API
- **THEN** the system SHALL check all backends in parallel
- **AND** return results for each backend

### Requirement: Storage Migration Support
The system SHALL support migrating files between storage backends.

#### Scenario: Start migration
- **GIVEN** source and target storage backends are configured
- **WHEN** calling startMigration API with sourceBackendId, targetBackendId, and options
- **THEN** the system SHALL validate both backends are accessible
- **AND** create a migration task
- **AND** return the task id

#### Scenario: Query migration status
- **GIVEN** a migration is in progress
- **WHEN** calling getMigrationStatus API
- **THEN** the system SHALL return: inProgress, sourceBackendId, targetBackendId, progress (0-100), totalFiles, migratedFiles, failedFiles, startTime, estimatedEndTime, errors array

#### Scenario: Cancel migration
- **GIVEN** a migration is in progress
- **WHEN** calling cancelMigration API
- **THEN** the system SHALL stop the migration process
- **AND** preserve already migrated files
- **AND** return cancellation confirmation

#### Scenario: Rollback migration
- **GIVEN** a completed or failed migration
- **WHEN** calling rollbackMigration API
- **THEN** the system SHALL restore the previous storage configuration
- **AND** optionally delete migrated files based on configuration

### Requirement: Storage Settings UI
The system SHALL provide a user interface for managing storage backends.

#### Scenario: Storage backend list display
- **GIVEN** a user opens storage settings
- **WHEN** the settings page loads
- **THEN** the system SHALL display: current active storage, file size limit, list of all backends with status indicators
- **AND** provide action buttons: switch, configure, health check, delete

#### Scenario: Add storage backend UI
- **GIVEN** a user wants to add a storage backend
- **WHEN** clicking the add button
- **THEN** the system SHALL show a dialog to select backend type (OpenList or RustFS)
- **AND** display type-specific configuration form
- **AND** provide "save and test connection" button

#### Scenario: OpenList configuration form
- **GIVEN** a user selected OpenList as backend type
- **WHEN** the configuration form displays
- **THEN** it SHALL include fields: name, serverUrl, token, storageDriver dropdown, storagePath
- **AND** optional advanced settings: useProxy, maxFileSize
- **AND** provide test connection button

#### Scenario: RustFS configuration form
- **GIVEN** a user selected RustFS as backend type
- **WHEN** the configuration form displays
- **THEN** it SHALL include fields: name, endpoint, port, consolePort, useSSL, accessKey, secretKey, bucket, region, rootPath
- **AND** optional advanced settings: urlExpiry
- **AND** provide test connection button

#### Scenario: Migration UI
- **GIVEN** multiple storage backends are configured
- **WHEN** the user expands migration section
- **THEN** the system SHALL show: source backend selector, target backend selector, start migration button
- **AND** during migration: progress bar, statistics, pause/cancel buttons, estimated time remaining

### Requirement: Sensitive Information Protection
The system SHALL protect sensitive storage configuration fields.

#### Scenario: Token and key encryption
- **GIVEN** a storage configuration contains sensitive fields (token, secretKey)
- **WHEN** the configuration is saved
- **THEN** the system SHALL encrypt these fields using backend encryption API
- **AND** never store or log plaintext values

#### Scenario: Masked display in UI
- **GIVEN** a configured storage backend with sensitive fields
- **WHEN** displaying the configuration in UI
- **THEN** sensitive fields SHALL be masked (e.g., "••••••••")
- **AND** provide a toggle to temporarily reveal values

### Requirement: Error Handling and User Feedback
The system SHALL provide clear error messages for storage-related failures.

#### Scenario: Configuration validation errors
- **GIVEN** a user submits invalid storage configuration
- **WHEN** validation fails
- **THEN** the system SHALL display field-specific error messages
- **AND** highlight invalid fields

#### Scenario: Connection errors
- **GIVEN** a storage backend connection fails
- **WHEN** the error occurs
- **THEN** the system SHALL map error codes to user-friendly messages
- **AND** suggest possible solutions (e.g., check network, verify credentials)

#### Scenario: Migration errors
- **GIVEN** a file migration fails
- **WHEN** the error occurs
- **THEN** the system SHALL record the error with file name and reason
- **AND** continue migrating other files
- **AND** provide a report after completion
