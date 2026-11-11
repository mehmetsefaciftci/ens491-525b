// Controlled-study logic, kept free of UI so it can be unit-tested (test/study.test.mjs).
// Design (proposal): within-subject 2 x 2, system (adaptive / fixed) x room (quiet / noise),
// each system's two blocks run back to back so SUS can follow each system.

export const SYSTEMS = ["adaptive", "fixed"];
export const ROOMS = ["quiet", "noise"];

// Four counterbalanced orders: system order AB/BA crossed with room order QN/NQ.
export function blockOrder(participantNumber) {
  const k = ((participantNumber % 4) + 4) % 4;
  const sys = k < 2 ? ["adaptive", "fixed"] : ["fixed", "adaptive"];
  const rooms = k % 2 === 0 ? ["quiet", "noise"] : ["noise", "quiet"];
  return sys.flatMap((s) => rooms.map((r) => ({ system: s, room: r })));
}

// Assign artworks to blocks so that each participant sees every artwork once and, across
// participants, each artwork appears in every condition (rotation by participant number).
export function assignArtworks(artworkIds, participantNumber, perBlock = 2) {
  const n = artworkIds.length;
  const rot = artworkIds.map((_, i) => artworkIds[(i + participantNumber * perBlock) % n]);
  return [0, 1, 2, 3].map((b) => Array.from({ length: perBlock }, (_, j) => rot[(b * perBlock + j) % n]));
}

// System Usability Scale (Brooke 1996): 10 items, answers 1..5.
export const SUS_ITEMS = [
  "I think that I would like to use this guide frequently.",
  "I found the guide unnecessarily complex.",
  "I thought the guide was easy to use.",
  "I think that I would need the support of a technical person to be able to use this guide.",
  "I found the various functions in this guide were well integrated.",
  "I thought there was too much inconsistency in this guide.",
  "I would imagine that most people would learn to use this guide very quickly.",
  "I found the guide very cumbersome to use.",
  "I felt very confident using the guide.",
  "I needed to learn a lot of things before I could get going with this guide.",
];
export function susScore(answers) {
  if (answers.length !== 10 || answers.some((a) => !(a >= 1 && a <= 5))) return null;
  const sum = answers.reduce((s, a, i) => s + (i % 2 === 0 ? a - 1 : 5 - a), 0);
  return sum * 2.5;
}

// Recall: an answer counts as correct if it contains every keyword group of the item
// (a group is a list of alternatives). Matching ignores case, accents and punctuation.
export function normalise(s) {
  return (s || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
export function scoreRecall(answer, keywordGroups) {
  const a = ` ${normalise(answer)} `;
  return keywordGroups.every((alts) => alts.some((k) => a.includes(` ${normalise(k)}`)));
}
