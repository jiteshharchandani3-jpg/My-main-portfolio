-- ============================================================
-- Supabase Schema for Developer Portfolio
-- Table: contact_messages
-- Description: Stores contact form submissions with RLS enabled
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT DEFAULT 'No subject',
    message TEXT NOT NULL,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
    ip_address TEXT DEFAULT 'unknown'
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow anyone (anonymous visitors) to submit contact messages
CREATE POLICY "Allow anonymous submission of contact messages"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 4. Policy: Allow only authenticated admin users to read contact messages
CREATE POLICY "Allow authenticated admins to read messages"
ON public.contact_messages
FOR SELECT
TO authenticated
USING (true);

-- 5. Create index for fast sorting by submission date
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
ON public.contact_messages (created_at DESC);
