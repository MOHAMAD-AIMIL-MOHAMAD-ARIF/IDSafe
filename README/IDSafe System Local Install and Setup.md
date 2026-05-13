This file explains how you can clone, install, configure, and run the IDSafe system locally on your own machine.
## 1. Prerequisites
Before installing IDSafe locally, make sure the following software is installed:
- Git  
- Node.js 20 or later  
- npm  
- PostgreSQL  
- A modern browser that supports WebAuthn, such as:  
	- Google Chrome  
	- Microsoft Edge  
	- Mozilla Firefox  
	- Safari
## 2. Installation (Clone repository)
```bash
git clone https://github.com/MOHAMAD-AIMIL-MOHAMAD-ARIF/IDSafe.git
cd idsafe
```

## 3. Renaming and Editing Environment Files
1. Please rename these files before running the system:
	1. "C:\\...\IDSafe\backend\\.env(sample-for-local-development).txt" 
	    into: .env
	2. "C:\\...\IDSafe\frontend\env.local(sample).txt" 
	    into: .env.local
2. Edit these lines in .env
	- DATABASE_URL
	- EMAIL_SMTP_USER
	- EMAIL_SMTP_PASS
	- EMAIL_FROM
3. Leave the contents of .env.local as is.

## 4. Install Backend Dependencies
```bash
cd backend
npm install
```

## 5. Install Frontend Dependencies
```bash
cd ..
cd frontend
npm install
```

## 6. Set Up PostgreSQL Database
Create a local PostgreSQL database for IDSafe. (using `psql`)
```bash
psql -U postgres
```
Then run:
```sql
CREATE DATABASE idsafe_db;
CREATE USER idsafe_user WITH PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE idsafe_db TO idsafe_user;
--Exit PostgreSQL:
\q
```

## 7. Run Prisma Migration
From the `backend` directory, generate the Prisma client:
```bash
npx prisma generate
```
Run the database migrations:
```bash
npx prisma migrate dev
```
Run the project seed script:
```bash
npx prisma db seed
```
This creates the required database tables such as users, WebAuthn credentials, recovery data, vault entries, audit logs, system configuration, and device keys.

## 8. Start the Backend Server and Frontend Application
From the `backend` directory:
```bash
npm run dev
```
From the `frontend` directory:
```bash
npm run dev
```

## 9. Access the landing page
Open a web-browser and enter this address: http://localhost:3000

## 10. Test the Local WebAuthn Flow
For local development, WebAuthn can work on `localhost`, because browsers treat `localhost` as a secure context for development.

**Basic test flow:**
1. Register a new account, set a recovery passphrase.
2. Complete WebAuthn registration using your device authenticator.
3. Create a vault entry.
4. Log out.
5. Log in again using WebAuthn.
6. Confirm that the vault can be unlocked on the same device.

## 11. Optional: Create an Admin Credential (Manually)
Do this step if you want to enter into and test the admin portal.
1. From the `backend` directory, start Prisma Studio:
```bash
npx prisma studio
```
2. Prisma Studio will automatically open in the browser, if not, access it through http://localhost:51212
3. Select the "AdminCredential" table on the left.
4. Select "Insert row" on the top.
5. Fill these values in each corresponding column:

| Column            | Value                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| adminCredentialId | 1                                                                                                 |
| userId            | 1                                                                                                 |
| passwordHash      | $argon2id$v=19$m=65536,t=3,p=1$O8AT31GOIaZcbHT29Q4wxg$iqKPMPw2a5FB3XsIia69VF5aLxofBx+v9SeYRup+neI |
| passwordAlgo      | argon2id                                                                                          |
| failedAttempts    | 0                                                                                                 |
| lockedUntil       | null                                                                                              |
| createdAt         | 2025-12-28T03:55:08.100Z                                                                          |
| updatedAt         | 2025-12-29T23:43:06.035Z                                                                          |

6. Click on "Save" at the top.
7. You can now log into the admin portal with these credentials:
	- **Email**: admin@idsafe.local
	- **Password**: AdminPass333

## 12. Security Note for Local Development
The local development setup is only for testing and demonstration.
For production deployment:
- Use HTTPS.
- Set secure cookies.
- Use strong session secrets.
- Configure proper CORS origins.
- Use production-grade SMTP.
- Protect environment variables.
- Use a managed or properly secured PostgreSQL database.
- Run database backups.
- Use a reverse proxy such as Caddy or Nginx.
- Run the backend and frontend using a process manager such as PM2 or a container platform.