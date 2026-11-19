-- MenuFlow Seed Data (Casa Verde — Mexican / Modern Casual, Bengaluru)
-- Note: Local runtime automatically seeds SQLite on startup via server/db.ts.
-- Run this SQL in Supabase SQL Editor after running migrations 001 and 002.

insert into public.users (id, email, full_name, phone)
values
  ('11111111-1111-4111-8111-111111111101', 'owner@casaverde.in', 'Aarav Mehta', '+91 98450 11223'),
  ('11111111-1111-4111-8111-111111111102', 'chef@casaverde.in', 'Elena Morales', '+91 98450 44556'),
  ('11111111-1111-4111-8111-111111111103', 'floor@casaverde.in', 'Rohan Kapoor', '+91 98450 77889')
on conflict (email) do nothing;

insert into public.restaurants (id, owner_id, name, slug, tagline, cuisine_type, address, city, phone, email, opening_hours, is_open, onboarding_completed)
values (
  '22222222-2222-4222-8222-222222222201',
  '11111111-1111-4111-8111-111111111101',
  'Casa Verde',
  'casa-verde',
  'Heirloom Masa & Wood-Fired Mexican Kitchen',
  'Mexican / Modern Casual',
  '100 Feet Road, Indiranagar',
  'Bengaluru',
  '+91 80 4123 8890',
  'hola@casaverde.in',
  '12:00 PM - 11:30 PM',
  true,
  true
) on conflict (slug) do nothing;
