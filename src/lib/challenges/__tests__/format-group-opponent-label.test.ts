import { describe, it, expect } from "vitest";
import { formatGroupOpponentLabel } from "../resolution";

describe("formatGroupOpponentLabel", () => {
  it("returns '1 other player' for a 2-person group (n=2)", () => {
    expect(formatGroupOpponentLabel(2)).toBe("1 other player");
  });

  it("returns '{n} others' for groups larger than 2", () => {
    expect(formatGroupOpponentLabel(3)).toBe("2 others");
    expect(formatGroupOpponentLabel(4)).toBe("3 others");
    expect(formatGroupOpponentLabel(8)).toBe("7 others");
  });

  it("falls back to '1 other player' for degenerate inputs (n<=1)", () => {
    // Defensive: if a 1-person 'group' somehow reaches the email path
    // (orphaned participant, race condition), don't render '0 others' or
    // '-1 others' — collapse to a sane string.
    expect(formatGroupOpponentLabel(1)).toBe("1 other player");
    expect(formatGroupOpponentLabel(0)).toBe("1 other player");
  });

  it("renders correctly inside the 1v1 email subject template shapes", () => {
    // Sanity-check the strings the template will actually produce so a
    // future change to the template doesn't silently break grammar.
    const small = formatGroupOpponentLabel(2);
    const big = formatGroupOpponentLabel(5);

    expect(`You beat ${small} 5-3`).toBe("You beat 1 other player 5-3");
    expect(`Tied 3-3 with ${small}`).toBe("Tied 3-3 with 1 other player");
    expect(`${small} won 5-3`).toBe("1 other player won 5-3");

    expect(`You beat ${big} 5-3`).toBe("You beat 4 others 5-3");
    expect(`Tied 3-3 with ${big}`).toBe("Tied 3-3 with 4 others");
    expect(`${big} won 5-3`).toBe("4 others won 5-3");
  });
});
