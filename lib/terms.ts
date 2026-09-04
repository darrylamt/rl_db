/**
 * What a player is asked to agree to before using their portal.
 *
 * Bumping TERMS_VERSION asks everybody again — app_users.terms_version is
 * compared against this string, so a change of substance needs a new date
 * here and nothing else. Do not bump it for a typo; that would make several
 * hundred people re-consent to nothing.
 */
export const TERMS_VERSION = "2026-09-04";

export type TermsSection = { heading: string; body: string[] };

export const TERMS: TermsSection[] = [
  {
    heading: "What this account is",
    body: [
      "This account is yours as a registered player of the Rugby League Federation Ghana. It lets you see your own record, answer contract offers from clubs, tell your club when you are available, and ask for a move.",
      "Do not share your password. Anything done from this account is treated as done by you.",
    ],
  },
  {
    heading: "What we hold about you",
    body: [
      "Your name, date of birth, club, playing position, squad number, photograph, height and weight, nationality, and contact details you or your club have given us.",
      "Your playing record: the matches you were named in, what was recorded against you in them, any cards or suspensions, and the contracts you have signed.",
    ],
  },
  {
    heading: "What is shown publicly",
    body: [
      "The federation runs a public website. Your name, club, position, squad number, photograph and playing statistics appear there, and so may your age. This is how the game is reported — league tables, match reports and record books all name the players in them.",
      "Your phone number and email address are never shown publicly.",
      "Your date of birth is held so we can confirm you are eligible for the grade you play in. It may be used to show your age.",
    ],
  },
  {
    heading: "Who else sees it",
    body: [
      "Your club sees your full record, including your availability and your contracts with them.",
      "A club that wants to sign you sees what any club sees on the public side, plus the fact that you are open to a move if you have said so.",
      "The federation sees everything, because it runs the register, decides eligibility and handles discipline.",
    ],
  },
  {
    heading: "Getting it corrected",
    body: [
      "If something here is wrong — your date of birth, a match you were not in, a statistic against your name — tell your club or the federation and it will be looked at. You can ask for a correction at any time.",
    ],
  },
  {
    heading: "If you do not agree",
    body: [
      "You do not have to agree, and you can say no below. Your playing registration is not affected — you remain a registered player and can still be selected.",
      "What you will not have is this portal. Without it you cannot answer contract offers or set your availability here, and your club will have to do those things with you directly.",
      "If you change your mind, sign in again and you will be asked once more.",
    ],
  },
];
