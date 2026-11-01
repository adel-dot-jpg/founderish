// Owner replies to the daily brief: "send 1 3", "approve 2", "skip 4", "reject 1, 2".
export function parseBriefCommands(text: string): { approve: number[]; reject: number[] } {
  // Only the owner's new text; ignore the quoted brief below it.
  const fresh = text.split(/\n\s*(>|On .+wrote:)/)[0];
  const grab = (re: RegExp) =>
    [...fresh.matchAll(re)].flatMap((m) => (m[1].match(/\d+/g) ?? []).map(Number)).filter((n) => n > 0 && n < 1000);
  const approve = grab(/\b(?:send|approve|yes)\s+((?:#?\d+[\s,&]*(?:and\s+)?)+)/gi);
  const reject = grab(/\b(?:skip|reject|no|drop)\s+((?:#?\d+[\s,&]*(?:and\s+)?)+)/gi).filter((n) => !approve.includes(n));
  return { approve: [...new Set(approve)], reject: [...new Set(reject)] };
}
