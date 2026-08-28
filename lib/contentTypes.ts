// Shared vocabularies for the content tables.
//
// These live outside the route and "use server" modules on purpose: a Next.js
// route file may only export its HTTP handlers and route config, and a
// "use server" module may only export async functions. Exporting a constant
// from either fails the production build.

export const DOCUMENT_TYPES = [
  "Reports",
  "Annual General Meetings",
  "Policies",
  "Monthly Developmental Reports",
];

export const PERSON_GROUPS = ["board", "committee"];
