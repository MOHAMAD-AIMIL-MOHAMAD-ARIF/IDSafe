# IDSafe
A browser-based zero-knowledge password manager using WebAuthn passwordless authentication and client-side AES-256-GCM authenticated-encryption.

## 1. Problem Statement
Modern password managers are expected to protect highly sensitive credentials while remaining convenient enough for everyday use. However, many traditional password manager designs still depend heavily on a master password for daily access. This creates a usability and security trade-off: users may choose weak or reused master passwords, forget them, or become vulnerable to phishing attacks that attempt to capture password-based login credentials.

IDSafe addresses this problem by designing a browser-based password manager that combines passwordless authentication with client-side encryption. End users authenticate using WebAuthn platform authenticators, such as device biometrics or screen unlock, while vault data is encrypted locally in the browser before it is sent to the server. The backend stores only ciphertext, WebAuthn credential metadata, recovery metadata, device-binding records, and audit/configuration data.

The goal of IDSafe is to provide a zero-knowledge password manager architecture where the server can authenticate users, manage sessions, support recovery workflows, and store encrypted vault records without being able to read users' plaintext passwords or cryptographic keys. Daily access is designed to be biometric-first, while account recovery is handled separately through an email verification flow and a recovery passphrase that is used only to recover the vault key on a new device.

## 2. Features
### 2.1 System Features
1. Zero-knowledge vault storage where **password entries are encrypted on the client** before being stored on the server. *(more on zero-knowledge concept at Section 6: Zero-Knowledge Model)*
2. WebAuthn-based **passwordless authentication** using platform authenticators such as biometric unlock or device screen lock.
3. **AES-256-GCM authenticated encryption** for vault entry encryption.
4. **Per-user vault Data Encryption Key (DEK)** generated during initial account setup. *(more on DEK at Section 6: Keys Hierarchy in IDSafe)*
5. Recovery passphrase flow using **Argon2id to derive a Key Encryption Key (KEK)** for wrapping the vault key backup. *(more on the recovery flow at Section 8: User Recovery Flow)*
6. **Device-bound key wrapping**, where each trusted device has its own device keypair and server-stored wrapped DEK. *(more on device-binding at Section 6: Device-Bound Key Wrapping)*
7. Secure session management using **server-side sessions and cookie-based** authentication.
8. **PostgreSQL-backed persistence** for users, WebAuthn credentials, encrypted vault entries, recovery data, device keys, sessions, audit logs, and system configuration.
9. **Audit logging** for security-relevant events **without recording plaintext** vault data, recovery passphrases, DEKs, or KEKs.
10. **Configurable security policies** such as session timeout and KDF parameters.
### 2.2 End-User Features
1. **Register** an account using **email and WebAuthn/passkey** authentication.
2. **Log in** using WebAuthn **without entering a master password** during normal use.
3. Create, view, update, and delete **(CRUD)** password vault entries.
4. Store vault fields such as title, username, password, URL, and optional notes.
5. **Decrypt vault entries locally** in the browser after successful authentication and device-key unlocking.
6. **Search and filter vault entries locally** without sending plaintext search terms to the server.
7. **Generate strong passwords** using configurable password-generation options.
8. **Copy** usernames or passwords to the clipboard.
9. Set up and change a **recovery passphrase**.
10. **Recover account access on a new device** using email magic-link verification and the recovery passphrase.
11. **Register a new WebAuthn credential** after successful recovery.
12. **View account profile** and registered authenticator/device metadata.
13. Ability to **remove vault access** on existing registered/bounded device through the user profile management page.
14. Log out and **clear sensitive in-memory** vault state.
### 2.3 Admin-User Features
1. Separate **administrator login** flow using **admin credentials and email OTP verification**.
2. **View user account metadata** such as email, role, status, registration time, and last login time.
3. View registered **WebAuthn credential metadata** without accessing private keys or vault contents.
4. View **audit logs** for authentication, recovery, vault metadata events, and administrative actions.
5. Export and download **system logs as a CSV** file for compliance-related tasks.
6. **Search and filter audit logs** by event type, status, date range.
7. **Lock, unlock, or deactivate** user accounts without decrypting user vault data.
8. **Configure security-related settings** such as session timeout, KDF parameters.
9. Monitor basic **system health and operational metrics.**


## 3. Tech Stack

| Layer / Area                 | Technology                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Frontend framework           | Next.js with React                                                                                    |
| Frontend language            | TypeScript                                                                                            |
| Styling                      | Tailwind CSS                                                                                          |
| Backend runtime              | Node.js                                                                                               |
| Backend framework            | Express.js                                                                                            |
| Backend language             | TypeScript                                                                                            |
| Reverse proxy                | Caddy (with automatic HTTPS handling)                                                                 |
| Client-side cryptography     | Web Crypto API, AES-256-GCM, Argon2id-compatible client-side KDF flow                                 |
| Client-side storage          | IndexedDB for local device/private-key-related storage and encrypted client-side state where required |
| Authentication standard      | WebAuthn / Passkeys using platform authenticators                                                     |
| WebAuthn server verification | `@simplewebauthn/server`                                                                              |
| Database                     | PostgreSQL                                                                                            |
| ORM                          | Prisma 7                                                                                              |
| Session storage              | `express-session` with PostgreSQL-backed session storage                                              |
| Email delivery               | SMTP provider (Mailgun) for recovery magic links and admin OTP delivery                               |
| API style                    | REST/JSON APIs                                                                                        |
| Deployment target            | Linux VPS or cloud VM with HTTPS reverse proxy support                                                |

The stack is selected to support a full-stack TypeScript development workflow, browser-native cryptographic operations, server-side WebAuthn verification, relational data modelling, and a deployment model suitable for a final-year project prototype.

## 4. System Architecture
![[attachments/IDSafe-System-Architecture-Design.png]]

## 5. Database Design
### 5.1 Entity-Relationship Diagram
![[attachments/ERDiagram 4.1 - IDSafe.png]]


## 6. Encryption Model
The encryption model of IDSafe is designed to protect user vault data even if the backend database is compromised. The system follows a zero-knowledge architecture where vault encryption, vault decryption, key derivation, and key unwrapping are performed on the client side. The server stores only encrypted vault entries, WebAuthn public-key metadata, wrapped vault keys, device-binding records, and recovery metadata.
### 6.1 Keys Hierarchy in IDSafe
IDSafe uses several cryptographic keys and secrets, each with a separate role in authentication, encryption, device binding, and recovery.  
1. **WebAuthn Key Pair**  
	- Generated by the user’s platform authenticator, such as TPM, Secure Enclave, Android Keystore, or Windows Hello.  
	- The **private key** remains inside the authenticator and is not exposed to the browser or server.  
	- The **public key** and credential metadata are stored on the server.  
	- Used only for authentication by signing server-issued challenges.  
	- Not used to encrypt or decrypt vault data.  
2. **Data Encryption Key (DEK) / Vault Key**  
	- A random 256-bit symmetric key generated on the client during initial vault setup.  
	- Used to encrypt and decrypt all vault entries.  
	- Used with AES-256-GCM for client-side vault encryption.  
	- Must never be sent to or stored on the server in plaintext.  
	- Stored only in protected client-side form, such as through device-bound wrapping or recovery wrapping.  
3. **Key Encryption Key (KEK)**  
	- A 256-bit symmetric key derived from the user-chosen recovery passphrase using Argon2id.  
	- Used to encrypt, or “wrap”, the DEK for recovery purposes.  
	- Not stored directly by the client or server.  
	- Re-derived only when the user enters the recovery passphrase during account recovery or recovery passphrase change.  
4. **Device-Binding Key Pair**  
	- A separate asymmetric key pair generated by the client for each trusted device.  
	- The **device public key** is uploaded to the server and stored in the `DeviceKey` record.  
	- The **device private key** remains on the user’s device, such as in IndexedDB or browser-secured storage.  
	- The DEK is wrapped for each device so that only the device with the corresponding private key can unwrap it.  
	- Enables normal vault unlocking after WebAuthn login without requiring the recovery passphrase.  
5. **User-Chosen Recovery Passphrase**  
	- A human-memorable secret chosen by the user during account setup.  
	- Used only for account recovery or recovery passphrase changes.  
	- Never used for daily login.  
	- Never sent to the server.  
	- Converted into the KEK through Argon2id on the client side.  
6. **Key Relationship Summary**  
	- WebAuthn key pair authenticates the user.  
	- Device-binding key pair unlocks the DEK on a trusted device.  
	- DEK encrypts and decrypts vault entries.  
	- Recovery passphrase derives the KEK.  
	- KEK wraps and unwraps the DEK only during recovery.
### 6.2 Zero-Knowledge Model
- IDSafe follows a zero-knowledge design, meaning the server is not be able to read user vault contents.  
- The server never receives plaintext passwords, notes, vault entries, DEKs, KEKs, recovery passphrases, or device private keys.  
- Vault entries are encrypted before they leave the browser.  
- Vault entries are decrypted only after they return to the browser.  
- The backend is responsible for:  
	- Verifying WebAuthn authentication.  
	- Managing sessions.  
	- Storing encrypted vault entries.  
	- Storing WebAuthn public-key metadata.  
	- Storing wrapped DEKs and recovery metadata.  
	- Enforcing access control and audit logging.  
- Even a system administrator can only view metadata, logs, account status, and ciphertext, not plaintext vault data.
### 6.3 Client-Side Vault Encryption
- Vault encryption is performed entirely in the browser.  
- When a user creates or updates a vault entry, the client serializes the vault data into a structured format (JSON).  
- The client encrypts the vault entry using:  
	- **Algorithm:** AES-256-GCM  
	- **Key:** DEK  
	- **IV/nonce:** Unique random IV per encryption operation  
	- **Authentication tag:** Generated by AES-GCM to verify integrity  
- The encrypted result is sent to the server as ciphertext.  
- The server stores:  
	- `ciphertext_blob`  
	- `iv`  
	- `auth_tag`  
	- Optional non-sensitive metadata  
- When the user views vault entries, the client downloads the encrypted records and decrypts them locally using the DEK.  
- Local search and filtering happen after decryption in the browser, so plaintext search terms are not sent to the server.
### 6.4 Argon2id KDF
- Argon2id is used as the password-based key derivation function for recovery.  
- It derives the KEK from the user’s recovery passphrase.  
- The derivation input is:  
	- Recovery passphrase  
	- Random salt  
	- Configured Argon2id parameters  
- The derivation output is:  
	- 256-bit KEK  
- Example parameters (default):  
	- `algorithm = argon2id`  
	- `timeCost = 3`  
	- `memoryCostKiB = 65536`  
	- `parallelism = 1`  
	- `hashLenBytes = 32`  
- The salt and Argon2id parameters are stored on the server because they are required to re-derive the KEK during recovery.  
- The recovery passphrase and KEK are not stored on the server.  
- Argon2id makes offline guessing significantly more expensive if an attacker obtains the database and attempts to brute-force the wrapped recovery key.
### 6.5 Device-Bound Key Wrapping
- IDSafe uses device-bound key wrapping to make normal vault access dependent on both:  
	1. Successful WebAuthn authentication.  
	2. Possession of the device private key.  
- Each trusted device has its own device-binding key pair.  
- During device binding:  
	- The client generates a device-binding key pair.  
	- The device private key stays on the device.  
	- The device public key is sent to the server.  
	- The DEK is wrapped for that specific device.  
	- The server stores the device public key and wrapped DEK.  
- During normal login:  
	- The user completes WebAuthn login.  
	- The client fetches the wrapped DEK for the current device.  
	- The client uses the local device private key to unwrap the DEK.  
	- The unlocked DEK is used to decrypt vault entries.  
- If the device private key is missing, the wrapped DEK cannot be decrypted.  
- A new device must go through recovery flow before it can be bound to the account.
### 6.6 Local Key Derivation
- Local key derivation occurs only when the recovery passphrase is needed.  
- The recovery passphrase is entered into the browser during recovery or recovery passphrase change.  
- The client retrieves the stored recovery metadata:  
	- Wrapped vault key  
	- Argon2id salt  
	- Argon2id algorithm  
	- Time cost  
	- Memory cost  
	- Parallelism  
- The browser runs Argon2id locally to derive the KEK.  
- The KEK is then used to decrypt the wrapped vault key and recover the DEK.  
- After the DEK is recovered, the client can:  
	- Re-wrap the DEK for a new device.  
	- Re-wrap the DEK under a new KEK if the recovery passphrase is changed.  
	- Use the DEK to decrypt vault entries locally.  
- The KEK is kept only in memory and cleared when no longer needed.
### 6.7 Recovery Encryption Model
- The recovery model exists to restore vault access when the user loses access to a trusted device or WebAuthn credential.  
- During initial setup:  
	1. The client generates the DEK.  
	2. The user chooses a recovery passphrase.  
	3. The client generates a random Argon2id salt.  
	4. The client derives the KEK from the recovery passphrase.  
	5. The client encrypts the DEK using the KEK.  
	6. The server stores the wrapped vault key (encrypted DEK) and KDF metadata.  
- During account recovery:  
	1. The user verifies account ownership through a recovery email magic link.  
	2. The client downloads the wrapped vault key and KDF metadata.  
	3. The user enters the recovery passphrase.  
	4. The client derives the KEK using Argon2id.  
	5. The client decrypts the wrapped vault key to recover the DEK.  
	6. The client generates a new device-binding key pair.  
	7. The DEK is wrapped for the new device.  
	8. The new device public key and wrapped DEK are stored on the server.  
	9. The user registers a new WebAuthn credential.  
- If the recovery passphrase is incorrect, the KEK will be wrong and DEK unwrapping will fail.  
- IDSafe cannot recover the user’s vault if the user loses both trusted device access and the recovery passphrase.
### 6.8 Server Visibility
- The server can see and store:  
	- User account metadata, such as email, role, status, and timestamps.  
	- WebAuthn credential IDs, public keys, AAGUIDs, attestation format, and sign counters.  
	- Encrypted vault entries.  
	- AES-GCM IVs and authentication tags.  
	- Wrapped DEKs.  
	- Recovery KDF salts and Argon2id parameters.  
	- Device public keys and device labels.  
	- Audit logs and security event metadata.  
- The server cannot see:  
	- Plaintext vault entries.  
	- Plaintext passwords stored inside the vault.  
	- The DEK.  
	- The KEK.  
	- The recovery passphrase.  
	- WebAuthn private keys.  
	- Device private keys.  
- This separation allows the backend to support authentication, storage, recovery workflows, and administration without gaining access to the user’s decrypted vault data.

## 7. Users Usage Flowchart
### 7.1 End-User Usage Flowchart
![[attachments/End-User Flowchart - IDSafe.png]]
### 7.2 Admin-User Usage Flowchart
![[attachments/System Admin Flowchart 2 - IDSafe.png]]

## 8. Authentication Flows
The IDSafe authentication architecture combines WebAuthn passwordless authentication, device-bound key management, and recovery-based re-binding flows. End-users authenticate using platform authenticators such as biometrics or device screen unlock, while cryptographic vault access depends on successful DEK unwrapping on a trusted device.
### 8.1 User Registration Flow
The registration flow creates a new user account, generates the vault encryption keys, and binds the first trusted device.  
  
1. The user opens the IDSafe registration page.  
2. The user enters:  
	- Email address  
	- Recovery passphrase  
3. The client requests WebAuthn registration options from the backend.  
4. The backend:  
	- Creates a temporary registration challenge  
	- Returns WebAuthn creation options  
5. The browser invokes the platform authenticator.  
6. The authenticator:  
	- Generates a WebAuthn key pair  
	- Stores the private key securely inside the authenticator  
	- Returns the attestation response  
7. The client sends the WebAuthn registration response to the backend.  
8. The backend:  
	- Verifies the attestation response  
	- Stores:  
		- Credential ID  
		- WebAuthn public key  
		- AAGUID  
		- Attestation metadata  
9. The client generates:  
	- A random 256-bit DEK  
	- A random Argon2id salt  
10. The client derives the KEK using:  
	- Recovery passphrase  
	- Argon2id  
	- Random salt  
11. The client encrypts the DEK using the KEK, producing:  
	- `wrappedVaultKey`  
12. The client generates a device-binding key pair:  
	- `devicePublicKey`  
	- `devicePrivateKey`  
13. The client wraps the DEK using the device public key:  
	- Produces `wrappedDEK`  
14. The client sends the following to the backend:  
	- `wrappedVaultKey`  
	- Argon2id metadata  
	- `devicePublicKey`  
	- `wrappedDEK`  
15. The backend stores:  
	- Recovery metadata  
	- Device-binding record  
16. The client stores the device private key locally.  
17. Registration completes, user logs in and the vault session begins.
### 8.2 User Login Flow
The normal login flow uses WebAuthn authentication together with device-bound DEK unwrapping.  
  
1. The user opens the login page.  
2. The user enters their email address.  
3. The client requests WebAuthn authentication options from the backend.  
4. The backend:  
	- Generates a login challenge  
	- Returns WebAuthn request options  
5. The browser invokes the platform authenticator.  
6. The authenticator:  
	- Verifies the user through biometrics or device unlock  
	- Signs the challenge using the WebAuthn private key  
7. The client sends the authentication assertion to the backend.  
8. The backend:  
	- Verifies the challenge signature  
	- Verifies credential ownership  
	- Verifies signature counters  
	- Creates a secure authenticated session  
9. The client requests the device-bound wrapped DEK for the current device.  
10. The backend returns:  
	- `wrappedDEK`  
	- Device metadata  
11. The client loads the locally stored device private key.  
12. The client unwraps the DEK using the device private key.  
13. The client uses the recovered DEK to:  
	- Decrypt vault entries  
	- Unlock the vault interface  
14. The user can now:  
	- View entries  
	- Create entries  
	- Update entries  
	- Delete entries  
	- Generate passwords
	- Manage profile account
15. During logout:  
	- Session tokens are invalidated  
	- In-memory cryptographic material is cleared
### 8.3 User Recovery Flow
The recovery flow restores account access when the user loses access to a trusted device or WebAuthn credential.  
  
1. The user opens the recovery page.  
2. The user enters their registered email address.  
3. The backend:  
	- Generates a recovery token  
	- Sends a time-limited recovery link through email  
4. The user opens the recovery link.  
5. The backend verifies:  
	- Recovery token validity  
	- Expiration status  
	- Usage status  
6. A temporary recovery session is established.  
7. The client requests:  
	- `wrappedVaultKey`  
	- Argon2id metadata  
8. The backend returns:  
	- Wrapped vault key  
	- Salt  
	- Time cost  
	- Memory cost  
	- Parallelism  
9. The user enters the recovery passphrase.  
10. The client derives the KEK locally using Argon2id.  
11. The client decrypts the wrapped vault key (using KEK) to recover the DEK.  
12. If decryption fails:  
	- Recovery is rejected  
	- The user may retry  
13. If decryption succeeds:  
	- The client generates a new device-binding key pair  
14. The client:  
	- Wraps the DEK using the new device public key  
	- Stores the device private key locally  
15. The client sends:  
	- New device public key  
	- New wrapped DEK  
16. The backend stores the new device-binding record.  
17. The user registers a new WebAuthn credential on the device.  
18. The backend stores the new WebAuthn credential metadata.  
19. Recovery completes and the user regains vault access.
### 8.4 User Add New Device Flow
Adding a new device requires re-binding the DEK because the new device does not possess an existing device private key.  
  
1. User opens the IDSafe login page and clicks on "Add new device".
2. The user then goes through the entire recovery flow as described in subsection 8.3, starting from entering their registered email address.
3. Add new device flow completes and the new device now has the user's vault access.
### 8.5 Admin Login Flow
System administrators use a separate authentication flow from end-users to access administrative functionality.  
  
1. The administrator opens the admin login page.  
2. The administrator enters:  
	- Admin email
	- Admin password  
3. The backend:  
	- Retrieves the admin credential record  
	- Verifies account status  
	- Verifies the password using Argon2id password hashing  
4. If password verification fails:  
	- Failed-attempt counters increase  
	- Lockout rules may be triggered  
5. If password verification succeeds:  
	- The backend generates a one-time verification code or token  
6. The backend sends the verification code through email.  
7. The administrator enters the verification code.  
8. The backend verifies:  
	- OTP correctness  
	- Expiration status  
	- Usage status  
9. If verification succeeds:  
	- A secure admin session is created  
10. The administrator gains access to:  
	- User account management  
	- Audit logs  
	- Security policies  
	- Recovery event monitoring  
	- System configuration  
11. The admin session uses:  
	- Secure cookies  
	- Session timeout policies  
	- Access control enforcement  
12. During logout:  
	- The admin session is invalidated  
	- Authentication state is cleared


## 9. IDSafe APIs Overview
| Method | Endpoint                                   | Description                                          |
| ------ | ------------------------------------------ | ---------------------------------------------------- |
| POST   | `/auth/webauthn/register/start`            | Begin end-user WebAuthn registration challenge.      |
| POST   | `/auth/webauthn/register/finish`           | Complete end-user WebAuthn registration.             |
| POST   | `/auth/webauthn/login/start`               | Begin WebAuthn login challenge.                      |
| POST   | `/auth/webauthn/login/finish`              | Complete WebAuthn login verification.                |
| POST   | `/auth/webauthn/recovery/register/start`   | Begin WebAuthn re-registration after recovery.       |
| POST   | `/auth/webauthn/recovery/register/finish`  | Complete WebAuthn re-registration after recovery.    |
| GET    | `/auth/webauthn/credentials`               | List current user’s registered WebAuthn credentials. |
| DELETE | `/auth/webauthn/credentials/:credentialId` | Delete one WebAuthn credential for the user.         |
| GET    | `/auth/account/profile`                    | Get authenticated user profile information.          |
| POST   | `/admin/auth/login/start`                  | Start admin password + OTP login flow.               |
| POST   | `/admin/auth/login/verify-otp`             | Verify admin OTP and establish session.              |
| POST   | `/admin/auth/logout`                       | Logout admin and clear session state.                |
| GET    | `/admin/auth/session`                      | Return current admin session status.                 |
| GET    | `/auth/device/list`                        | List devices bound to the user account.              |
| POST   | `/auth/device/bind`                        | Bind/register a device to user account.              |
| GET    | `/auth/device/:deviceId/wrapped-dek`       | Fetch wrapped DEK for a specific device.             |
| DELETE | `/auth/device/:deviceId`                   | Remove a bound device.                               |
| GET    | `/admin/users/`                            | List users for admin management view.                |
| PATCH  | `/admin/users/:userId/status`              | Update user account status.                          |
| POST   | `/admin/users/:userId/sessions/invalidate` | Invalidate all sessions for a user.                  |
| GET    | `/admin/summary`                           | Fetch admin dashboard summary metrics.               |
| GET    | `/admin/recovery-events`                   | Fetch recovery-related events for admin feed.        |
| GET    | `/admin/audit-logs/`                       | Query/list audit log records.                        |
| GET    | `/admin/audit-logs/export`                 | Export audit logs as downloadable output.            |
| GET    | `/admin/config/kdf`                        | Get KDF policy configuration.                        |
| PUT    | `/admin/config/kdf`                        | Update KDF policy configuration.                     |
| GET    | `/admin/config/session`                    | Get session policy configuration.                    |
| PUT    | `/admin/config/session`                    | Update session policy configuration.                 |
| GET    | `/admin/system/config`                     | Get system-wide admin configuration.                 |
| PUT    | `/admin/system/config`                     | Update system-wide admin configuration.              |
| GET    | `/admin/system/health`                     | Get admin system health metrics.                     |
| POST   | `/recovery/request`                        | Request recovery magic link.                         |
| GET    | `/recovery/verify`                         | Verify recovery magic link/token.                    |
| GET    | `/recovery/params`                         | Get recovery cryptographic parameters.               |
| POST   | `/recovery/data`                           | Store recovery metadata for authenticated user.      |
| POST   | `/recovery/bind`                           | Bind recovery device/material after verification.    |
| GET    | `/vault/entries/`                          | List vault entries for user.                         |
| POST   | `/vault/entries/`                          | Create a new vault entry.                            |
| GET    | `/vault/entries/:entryId`                  | Get a specific vault entry.                          |
| PUT    | `/vault/entries/:entryId`                  | Update a specific vault entry.                       |
| DELETE | `/vault/entries/:entryId`                  | Soft-delete a vault entry.                           |
| GET    | `/auth/session`                            | Return authenticated user session info.              |
| POST   | `/auth/logout`                             | Logout authenticated user and destroy session.       |
| GET    | `/health`                                  | Basic health endpoint with DB connectivity check.    |

## 10. User Interface Screenshots
### 10.1 End-User UIs
Landing Page
![[0_Landing Page.png]]
Registration Page
![[1_Registration page.png]]
Login Page![[2_Login page.png]]
User Vault Page![[3_User Vault page.png]]
Password Generator Section![[4_Password Generator section.png]]
User Profile and Control Page![[5_User Profile and Control page.png]]
Recovery Request Page![[6_Recovery Request page.png]]
Recovery Page![[7_Recovery page.png]]

### 10.2 Admin-User UIs
Login Page![[0_Admin Login page.png]]
OTP Page![[1_Admin OTP page.png]]
Dashboard Page![[2_Admin Dashboard page.png]]
Users Control Page![[3_Admin User Control page.png]]
Audit Logs Page![[4_Admin Audit Logs page.png]]
KDF Control Page![[5_Admin KDF Control page.png]]
Session Control Page![[6_Admin Session Control page.png]]
System Health and Metrics Page![[7_Admin System Health and Metrics page.png]]

## 11. Known Limitations
1. IDSafe is a final-year project prototype and is not intended to be used as a production password manager without further security review, penetration testing, and operational hardening.
2. Browser storage security depends on the user's browser and device environment. If the device or browser profile is compromised, locally stored device keys or decrypted in-memory vault data may be at risk.
3. The server follows a zero-knowledge design for vault contents, but it still stores account metadata, WebAuthn credential metadata, device metadata, audit logs, and encrypted vault records.
4. Recovery depends on the user's recovery passphrase. If the user loses all trusted devices and forgets the recovery passphrase, the encrypted vault cannot be recovered.
5. Email-based recovery verifies account ownership but inherits the risks of the user's email account security and email delivery reliability.
6. WebAuthn availability and behavior may vary by browser, operating system, authenticator type, and device security capabilities.
7. Device binding improves vault-key protection, but adding a new device requires the recovery flow because a new device cannot decrypt an existing device-specific wrapped DEK.
8. Performance and scalability targets are suitable for demonstration scope and require further load testing before real-world deployment.
9. Advanced production features such as browser extension autofill, secure password sharing, enterprise SSO, hardware security module integration, and formal cryptographic audits are outside the current project scope.

## 12. License
MIT License

## 13. Author
Mohamad Aimil bin Mohamad Arif
Bachelor of Computer Science (Information Security) with Honors
Universiti Tun Hussein Onn Malaysia (UTHM), Johor, Malaysia.
Contact: m.aimil.m.arif@gmail.com