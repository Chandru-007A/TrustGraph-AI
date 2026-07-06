// frontend/hooks/use-auth.ts
// ─────────────────────────────────────────────────────────────────────────────
// Re-export of the useAuth hook from contexts/. Kept in /hooks so that
// components can `import { useAuth } from '@/hooks/use-auth'` matching the
// existing `use-toast` and `use-mobile` convention.
// ─────────────────────────────────────────────────────────────────────────────

export { useAuth } from '@/contexts/auth-context';
