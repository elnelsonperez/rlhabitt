# Supabase Integration

This directory contains Supabase integration files for the RL HABITT frontend application.

## Files

- `client.ts` - Exports the Supabase client with proper typing
- `database.types.ts` - Contains TypeScript types generated from the Supabase database schema

## Type Generation

To get full TypeScript type safety with your Supabase database, you need to generate types from your database schema.

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Login to Supabase CLI:
   ```bash
   npx supabase login
   ```

3. Set up environment variables:
   Make sure you have a `.env` file with the following variables:
   ```
   VITE_SUPABASE_URL=https://your-project-url.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_PROJECT_ID=your-project-id
   ```

### Generating Types

There are two ways to generate types:

1. From the production database:
   ```bash
   npm run gen:types
   ```

2. From a local Supabase instance:
   ```bash
   npm run gen:types:local
   ```

### Using Generated Types

The types are automatically imported in the `client.ts` file:

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

You can use the generated types in your query hooks:

```typescript
import { supabase } from '../lib/supabase/client'
import type { Database } from '../lib/supabase/database.types'

// Type for a table row
type Building = Database['public']['Tables']['buildings']['Row']

// Getting data with full type safety
const { data, error } = await supabase
  .from('buildings')
  .select('*')

// data will be correctly typed as Building[]
```

For more information, see the [Supabase documentation](https://supabase.com/docs/guides/api/rest/generating-types).