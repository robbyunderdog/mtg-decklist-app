import { describe, expect, it } from "vitest";
import { detectFormat } from "../src/services/importParser/detectFormat.js";
import { parseLines } from "../src/services/importParser/parseLines.js";

const ARENA_TEXT = `Deck
4 Lightning Bolt (STA) 42
4 Mountain (M21) 259
2 Chandra, Torch of Defiance (KLD) 108

Sideboard
2 Abrade (AKH) 129
`;

const MOXFIELD_TEXT = `4 Lightning Bolt
4 Mountain
2 Chandra, Torch of Defiance

Sideboard:
2 Abrade
`;

const ARCHIDEKT_TEXT = `4 Lightning Bolt
4 Mountain
1 Sol Ring ^Foil^

[Maybeboard]
2 Abrade
`;

const PLAIN_TEXT = `4 Lightning Bolt
4x Mountain
2 Chandra, Torch of Defiance
`;

// Moxfield's "Copy for Arena" export marks foils with a trailing "*F*", which collides
// with Archidekt's own "*F*" foil token and previously caused this to be misdetected
// as archidekt (dropping the (SET) NUM stripping and leaving names unresolved).
const MOXFIELD_ARENA_FOIL_TEXT = `1 Sol Ring (MSC) 214
1 Heroic Intervention (MAR) 79 *F*
1 Three Tree City (BLB) 260 *F*
`;

describe("detectFormat", () => {
  it("detects arena format from set/collector-number suffix", () => {
    expect(detectFormat(ARENA_TEXT)).toBe("arena");
  });

  it("detects moxfield format from colon-terminated section headers", () => {
    expect(detectFormat(MOXFIELD_TEXT)).toBe("moxfield");
  });

  it("detects archidekt format from bracket headers and foil markers", () => {
    expect(detectFormat(ARCHIDEKT_TEXT)).toBe("archidekt");
  });

  it("falls back to plain text", () => {
    expect(detectFormat(PLAIN_TEXT)).toBe("plain");
  });

  it("detects arena format even when a *F* foil marker is present", () => {
    expect(detectFormat(MOXFIELD_ARENA_FOIL_TEXT)).toBe("arena");
  });
});

describe("parseLines", () => {
  it("parses arena lines, strips set annotations, and toggles to sideboard", () => {
    const { lines, skipped } = parseLines(ARENA_TEXT, "arena");
    expect(skipped).toHaveLength(0);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatchObject({ quantity: 4, parsedName: "Lightning Bolt", board: "main", setCode: "sta" });
    expect(lines[2]).toMatchObject({ quantity: 2, parsedName: "Chandra, Torch of Defiance", board: "main" });
    expect(lines[3]).toMatchObject({ quantity: 2, parsedName: "Abrade", board: "side", setCode: "akh" });
  });

  it("parses moxfield lines and switches board on colon headers", () => {
    const { lines, skipped } = parseLines(MOXFIELD_TEXT, "moxfield");
    expect(skipped).toHaveLength(0);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatchObject({ quantity: 4, parsedName: "Lightning Bolt", board: "main" });
    expect(lines[3]).toMatchObject({ quantity: 2, parsedName: "Abrade", board: "side" });
  });

  it("parses archidekt lines, strips the ^Foil^ marker without flagging foil, and switches board on bracket headers", () => {
    const { lines, skipped } = parseLines(ARCHIDEKT_TEXT, "archidekt");
    expect(skipped).toHaveLength(0);
    expect(lines).toHaveLength(4);
    expect(lines[2]).toMatchObject({ quantity: 1, parsedName: "Sol Ring", foil: false, board: "main" });
    expect(lines[3]).toMatchObject({ quantity: 2, parsedName: "Abrade", board: "maybe" });
  });

  it("parses plain text with optional x suffix on quantity, everything mainboard", () => {
    const { lines, skipped } = parseLines(PLAIN_TEXT, "plain");
    expect(skipped).toHaveLength(0);
    expect(lines).toHaveLength(3);
    expect(lines.every((l) => l.board === "main")).toBe(true);
    expect(lines[1]).toMatchObject({ quantity: 4, parsedName: "Mountain" });
  });

  it("strips (SET) NUM annotations and a trailing *F* foil marker without flagging foil on arena lines", () => {
    const { lines, skipped } = parseLines(MOXFIELD_ARENA_FOIL_TEXT, "arena");
    expect(skipped).toHaveLength(0);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ parsedName: "Sol Ring", setCode: "msc", foil: false });
    expect(lines[1]).toMatchObject({ parsedName: "Heroic Intervention", setCode: "mar", foil: false });
    expect(lines[2]).toMatchObject({ parsedName: "Three Tree City", setCode: "blb", foil: false });
  });

  it("records unparseable lines as skipped instead of throwing", () => {
    const { lines, skipped } = parseLines("not a card line\n4 Mountain", "plain");
    expect(lines).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].rawLine).toBe("not a card line");
  });
});
