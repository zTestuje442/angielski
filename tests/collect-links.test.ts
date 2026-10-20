import { describe, expect, it } from "vitest";
import { INDEX_PAGES, mapLinks, parseLinks, parseRobots, pickLessons, type Link } from "../scripts/collect-links.ts";
import { validateLinks } from "../scripts/validate-content.ts";
import curriculum from "../src/data/curriculum.json" with { type: "json" };
import externalLinks from "../src/data/external-links.json" with { type: "json" };

describe("parseLinks", () => {
  it("zamienia adresy na bezwzględne, czyści tekst i bierze nagłówek karty", () => {
    const html = `
      <a href="/gramatyka/czas/present-perfect" class="x">Present <b>Perfect</b></a>
      <a href="https://example.com/a?page=2#top">Rock &amp; Roll &#039;s</a>
      <a href="/kafel"><h3>Idiomy</h3><p>Opis ponad 500 idiomów</p></a>
      <a href="/pusty"><img src="x.png"></a>
      <a href="/gramatyka/czas/present-perfect">Duplikat</a>`;
    expect(parseLinks(html, "https://www.ang.pl/gramatyka/spis-tresci")).toEqual([
      { url: "https://www.ang.pl/gramatyka/czas/present-perfect", title: "Present Perfect" },
      { url: "https://example.com/a", title: "Rock & Roll 's" },
      { url: "https://www.ang.pl/kafel", title: "Idiomy" },
    ]);
  });
});

describe("pickLessons", () => {
  const ang = INDEX_PAGES.find(p => p.source === "ang.pl" && p.nested)!;
  const peg = INDEX_PAGES.find(p => p.source === "PEG")!;

  it("zostawia tylko lekcje i dokleja tytuł rodzica w spisie drzewiastym", () => {
    const html = `
      <a href="/gramatyka">Gramatyka</a>
      <a href="/gramatyka/czas/present-perfect">Present Perfect</a>
      <a href="/gramatyka/czas/present-perfect/for-since">for i since</a>
      <a href="/gramatyka/zaimki/osobowe">osobowe</a>
      <a href="/forum/watek">Forum</a>`;
    expect(pickLessons([{ page: ang, html }]).map(l => l.title)).toEqual([
      "Present Perfect", "Present Perfect: for i since", "Zaimki: osobowe",
    ]);
  });

  it("pomija nawigację serwisu i strony spisów treści", () => {
    const html = `
      <a href="https://www.perfect-english-grammar.com/membership.html">MEMBERSHIP</a>
      <a href="https://www.perfect-english-grammar.com/grammar-explanations.html">EXPLANATIONS</a>
      <a href="https://www.perfect-english-grammar.com/wish.html">Wish</a>`;
    expect(pickLessons([{ page: peg, html }])).toEqual([
      { title: "Wish", url: "https://www.perfect-english-grammar.com/wish.html", source: "PEG" },
    ]);
  });
});

describe("mapLinks", () => {
  const collected: Link[] = [
    { title: "Wish", url: "https://p/wish", source: "PEG" },
    { title: "Passive", url: "https://p/passive", source: "PEG" },
    { title: "Inne", url: "https://p/inne", source: "PEG" },
  ];

  it("przypisuje według reguł i wylicza niedopasowane, nieaktualne i tematy bez linków", () => {
    const m = mapLinks(collected, { "b2-wish": ["https://p/wish", "https://p/stary"], "b1-passive": ["https://p/passive"], "zz": [] },
      ["b2-wish", "b1-passive", "a1-to-be"]);
    expect(m.links).toEqual({
      "b2-wish": [{ title: "Wish", url: "https://p/wish", source: "PEG" }],
      "b1-passive": [{ title: "Passive", url: "https://p/passive", source: "PEG" }],
    });
    expect(m.unmatched.map(l => l.url)).toEqual(["https://p/inne"]);
    expect(m.stale).toEqual([{ topicId: "b2-wish", url: "https://p/stary" }]);
    expect(m.topicsWithout).toEqual(["a1-to-be"]);
    expect(m.unknownTopics).toEqual(["zz"]);
  });
});

describe("parseRobots", () => {
  it("czyta Disallow i Crawl-delay tylko dla User-agent: *", () => {
    const r = parseRobots(`
User-agent: Googlebot
Crawl-Delay: 10
Disallow: /tylko-google

User-Agent: *
Disallow: /forum/*/quote/*
Disallow: /mailbox*

User-agent: *
Crawl-Delay: 60`);
    expect(r.delayMs).toBe(60_000);
    expect(r.disallow.some(re => re.test("/forum/123/quote/9"))).toBe(true);
    expect(r.disallow.some(re => re.test("/mailbox/inbox"))).toBe(true);
    expect(r.disallow.some(re => re.test("/tylko-google"))).toBe(false);
    expect(r.disallow.some(re => re.test("/gramatyka/czas"))).toBe(false);
  });
});

describe("[Linki] validateLinks", () => {
  const ids = new Set(["b2-wish"]);
  const ok = { title: "Wish", url: "https://p/wish", source: "PEG" };

  it("przyjmuje poprawny plik", () => {
    expect(validateLinks({ "b2-wish": [ok] }, ids)).toEqual([]);
  });

  it("src/data/external-links.json zawiera tylko title, url, source dla znanych tematów", () => {
    expect(validateLinks(externalLinks, new Set(curriculum.map(t => t.id)))).toEqual([]);
  });

  it("odrzuca dodatkowe pola, zły source, adres bez https, duplikat i nieznany temat", () => {
    const errors = validateLinks({
      "b2-wish": [{ ...ok, extra: 1 }, { ...ok, url: "http://p/x" }, { ...ok, url: "https://p/y", source: "Wiki" }, ok],
      "zz": [ok],
    }, ids);
    expect(errors).toHaveLength(5);
    expect(errors.join("\n")).toMatch(/tylko title, url, source/);
    expect(errors.join("\n")).toMatch(/https/);
    expect(errors.join("\n")).toMatch(/source musi być/);
    expect(errors.join("\n")).toMatch(/powtórzony url/);
    expect(errors.join("\n")).toMatch(/nieznany temat/);
  });
});
