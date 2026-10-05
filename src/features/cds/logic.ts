// Pure rules for the CDS / WebForFashion import (migration 029). No Supabase or
// Next.js imports, so they are unit-tested directly (tests/unit/cds.test.mts).

// Agency placeholder records in CDS, never imported as talent.
const EXCLUDED = new Set(["modelluxemedia", "42modelmanagement"]);
const letters = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export function isExcludedName(firstName: string, lastName: string) {
  return EXCLUDED.has(letters(`${firstName}${lastName}`));
}

// ---------------------------------------------------------------------------
// Matching a CDS talent to an existing dashboard talent (never create twice)
// ---------------------------------------------------------------------------

export type MatchCandidate = {
  id: string; firstName: string; lastName: string;
  email: string | null; phones: (string | null)[]; dateOfBirth: string | null;
};
export type MatchInput = { firstName: string; lastName: string; email: string | null; phone: string | null; dateOfBirth: string | null };
export type MatchResult = { kind: "match"; id: string; reason: string } | { kind: "review"; reason: string } | { kind: "none" };

const lastTen = (value: string | null | undefined) => {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
};
const same = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

// Priority: email + first name, phone + first name, then full name (unique, with
// no conflicting date of birth). Several candidates, or a name match whose date
// of birth disagrees, go to manual review instead of guessing.
export function matchTalent(input: MatchInput, candidates: MatchCandidate[]): MatchResult {
  const firstNameMatches = candidates.filter((c) => letters(c.firstName) === letters(input.firstName) && letters(input.firstName) !== "");

  const byEmail = input.email ? firstNameMatches.filter((c) => same(c.email, input.email)) : [];
  if (byEmail.length === 1) return { kind: "match", id: byEmail[0].id, reason: "email" };
  if (byEmail.length > 1) return { kind: "review", reason: "Several talents share this email" };

  const phone = lastTen(input.phone);
  const byPhone = phone ? firstNameMatches.filter((c) => c.phones.some((p) => lastTen(p) === phone)) : [];
  if (byPhone.length === 1) return { kind: "match", id: byPhone[0].id, reason: "phone" };
  if (byPhone.length > 1) return { kind: "review", reason: "Several talents share this phone number" };

  const byName = firstNameMatches.filter((c) => letters(c.lastName) === letters(input.lastName));
  if (byName.length > 1) return { kind: "review", reason: "Several talents have this name" };
  if (byName.length === 1) {
    const candidate = byName[0];
    if (input.dateOfBirth && candidate.dateOfBirth && input.dateOfBirth !== candidate.dateOfBirth) {
      return { kind: "review", reason: "Same name, different date of birth" };
    }
    return { kind: "match", id: candidate.id, reason: "name" };
  }
  return { kind: "none" };
}

// ---------------------------------------------------------------------------
// CDS portfolio name -> website board
// ---------------------------------------------------------------------------

export type BoardRef = { id: string; name: string; parentId: string | null; segment: string };
export type BoardPlan =
  | { portfolio: string; kind: "existing"; boardId: string }
  | { portfolio: string; kind: "create"; parentName: string | null; name: string };

const PARENTS: [RegExp, string][] = [
  [/\b(girls?|boys?|teens?)\b/i, "Teens"],
  [/\bwomen\b/i, "Women"],
  [/\bmen\b/i, "Men"],
];
const lastSegment = (name: string) => name.split("/").pop()!.trim();
const words = (value: string) => value.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
const title = (value: string) => value.replace(/\b\w/g, (c) => c.toUpperCase());

// "Fashion-Women" -> Women / Fashion, "Development - Men" -> Men / Development,
// "Teens - Girls" -> Teens / Girls, "Women" -> Women, "Curve" -> an existing board
// named Curve if there is exactly one, else a new top-level board. Existing boards
// are reused by name; anything missing is created (as a draft, by the caller).
export function planPortfolioBoard(portfolio: string, boards: BoardRef[]): BoardPlan {
  const clean = words(portfolio);
  const top = (name: string) => boards.find((b) => !b.parentId && letters(lastSegment(b.name)) === letters(name));
  const childOf = (parentId: string, name: string) => boards.find((b) => b.parentId === parentId && (letters(lastSegment(b.name)) === letters(name) || b.segment === letters(name)));

  const rule = PARENTS.find(([pattern]) => pattern.test(clean));
  if (rule) {
    const parentName = rule[1];
    let rest = clean.replace(rule[1] === "Teens" ? /\bteens?\b/i : rule[0], " ");
    if (parentName === "Teens") rest = rest.replace(/\bgirls?\b/i, " Girls ").replace(/\bboys?\b/i, " Boys ");
    rest = words(rest.replace(/[&]/g, " & "));
    const parent = top(parentName);
    if (!rest) return parent ? { portfolio, kind: "existing", boardId: parent.id } : { portfolio, kind: "create", parentName: null, name: parentName };
    const child = parent && childOf(parent.id, rest);
    if (child) return { portfolio, kind: "existing", boardId: child.id };
    return { portfolio, kind: "create", parentName, name: title(rest) };
  }

  const unique = boards.filter((b) => letters(lastSegment(b.name)) === letters(clean));
  if (unique.length === 1) return { portfolio, kind: "existing", boardId: unique[0].id };
  return { portfolio, kind: "create", parentName: null, name: clean };
}

// ---------------------------------------------------------------------------
// Measurements: "175 cm" / "5'9\"" / "39.5" -> dashboard columns
// ---------------------------------------------------------------------------

const number = (value: string | undefined) => {
  const match = (value ?? "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
};
const text = (value: string | undefined) => {
  const v = (value ?? "").trim();
  return v && v !== "..." && v !== "-" ? v : null;
};

export function measurementRow(stats: Record<string, string>) {
  const row = {
    height_cm: number(stats.height_cm),
    bust_chest_cm: number(stats.bust_cm),
    waist_cm: number(stats.waist_cm),
    hips_cm: number(stats.hips_cm),
    shoe_size_us: text(stats.shoe_us),
    hair_color: text(stats.hair_color),
    hair_length: text(stats.hair_length),
    hair_type: text(stats.hair_type),
    eye_color: text(stats.eyes_color),
    body_type: text(stats.body_type),
    dress_size: text(stats.dress_us),
    collar_cm: number(stats.collar_cm),
    head_cm: number(stats.head_cm),
  };
  return Object.values(row).some((value) => value !== null) ? row : null;
}
