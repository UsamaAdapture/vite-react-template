# D1 Database Setup Guide

## Step 1: Create D1 Database

Run the following command to create a new D1 database:

```bash
npx wrangler d1 create form-users
```

This will output something like:
```
✅ Successfully created DB 'form-users' in region APAC

[[d1_databases]]
binding = "DB"
database_name = "form-users"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## Step 2: Update wrangler.json

Copy the `database_id` from the output above and add it to `wrangler.json`:

```json
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "form-users",
    "database_id": "your-database-id-here"
  }
]
```

## Step 3: Initialize Database Schema

Run the schema migration to create the users table:

```bash
npx wrangler d1 execute form-users --file=./schema.sql
```

Or for local development:

```bash
npx wrangler d1 execute form-users --local --file=./schema.sql
```

## Step 4: Verify Setup

You can verify the database was created correctly:

```bash
npx wrangler d1 list
```

## Step 5: Test Locally

For local development, you can test with:

```bash
npm run dev
```

The database will be available locally. Make sure to run the schema migration for local as well.

## Step 6: Deploy

Once everything is set up:

```bash
npm run build
npm run deploy
```

## Notes

- The database schema creates a `users` table with `id`, `username`, `password_hash`, and `created_at` fields
- Passwords are hashed using SHA-256 before storage
- Usernames must be unique (enforced by database constraint)
- The authentication token is stored in localStorage on the client side
