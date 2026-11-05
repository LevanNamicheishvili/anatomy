/*
 * The desktop application with no internet: the same site, served from the computer itself, with no database. The person
 * is who they last signed in as (lib/auth.ts), and the pages that manage schools and accounts are not there (proxy.ts).
 * Set by the desktop application when it starts its own server; with internet it shows the real site instead.
 */
export const OFFLINE = process.env.ATLAS_OFFLINE === "1";
