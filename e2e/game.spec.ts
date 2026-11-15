import { test, expect, chromium, webkit, devices, type Page, type Browser } from "@playwright/test";

/**
 * Canlı siteyi iki farklı tarayıcıyla uçtan uca oynar:
 *  A = masaüstü Chromium (fare + sürükleme), B = iPhone WebKit (dokunma).
 * Oda kurar, kodla katılır, 10 kart oynar (aynı anda cevap dahil), özet, yeni tur
 * senkronu, sürükleyerek seçim ve en sonda odayı siler.
 */
const BASE = (process.env.BASE_URL ?? "https://yer-misin-yemez-misin.vercel.app").replace(/\/$/, "");

let browsers: Browser[] = [];
test.afterAll(async () => {
  await Promise.all(browsers.map((b) => b.close()));
});

async function waitReveal(p: Page, label: string) {
  const r = p.getByTestId("reveal");
  await expect(r, `${label}: açılış animasyonu görünmeli`).toBeVisible({ timeout: 20_000 });
  const match = await r.getAttribute("data-match");
  await r.click({ force: true, timeout: 3_000 }).catch(() => {});
  await expect(r).toBeHidden({ timeout: 10_000 });
  return match;
}

async function cardIdx(p: Page) {
  return Number(await p.getByTestId("card").getAttribute("data-idx"));
}

test("iki oyuncu canlı sitede tam bir tur oynar", async () => {
  const ba = await chromium.launch();
  const bb = await webkit.launch();
  browsers = [ba, bb];
  const A = await (await ba.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const B = await (await bb.newContext({ ...devices["iPhone 13"] })).newPage();
  for (const [p, n] of [[A, "A"], [B, "B"]] as const) {
    p.on("pageerror", (e) => console.log(`[${n} pageerror]`, e.message));
    p.on("dialog", (d) => d.accept());
  }

  // 0) Sağlık: sayfa herkese açık (Vercel girişi yok) ve uyku önleyici çalışıyor
  const res = await A.goto(BASE + "/");
  expect(res?.status(), "ana sayfa 200 dönmeli").toBe(200);
  await expect(A.getByText("Sana ne diyelim?")).toBeVisible();
  const ka = await A.request.get(BASE + "/api/keepalive");
  expect(ka.status(), "keepalive 200").toBe(200);
  expect((await ka.json()).ok).toBe(true);

  // 1) A oda kurar
  await A.getByPlaceholder("Kullanıcı adın").fill("E2E A");
  await A.getByRole("button", { name: "Hadi başlayalım!" }).click();
  await A.getByRole("button", { name: /Oda kur/ }).click();
  const lobby = A.getByTestId("lobby");
  await expect(lobby).toBeVisible({ timeout: 30_000 });
  const code = (await lobby.getAttribute("data-code"))!;
  expect(code).toMatch(/^[A-Z0-9]{4}$/);
  console.log("oda kodu", code);

  // 2) B davet linkiyle katılır (iPhone, dokunma)
  await B.goto(`${BASE}/?kod=${code}`);
  await expect(B.getByText(`${code}`)).toBeVisible();
  await B.getByPlaceholder("Kullanıcı adın").fill("E2E B");
  await B.getByRole("button", { name: "Hadi başlayalım!" }).tap();

  // 3) İkisi de aynı ilk kartı görür, A'ya "katıldı" bilgisi gelir
  await expect(A.getByTestId("play")).toBeVisible({ timeout: 30_000 });
  await expect(B.getByTestId("play")).toBeVisible({ timeout: 30_000 });
  expect(await cardIdx(A)).toBe(0);
  expect(await cardIdx(B)).toBe(0);

  // 4) 10 kart
  const pattern: [number, number][] = [
    [1, 1], // sırayla, eşleşme
    [0, 1], // aynı anda, uyuşmazlık
    [2, 2], [1, 0], [1, 1], [0, 0], [2, 1], [1, 1], [0, 2], [1, 1],
  ];
  for (let i = 0; i < pattern.length; i++) {
    const [ca, cb] = pattern[i];
    await expect(A.getByTestId("card")).toHaveAttribute("data-idx", String(i), { timeout: 20_000 });
    await expect(B.getByTestId("card")).toHaveAttribute("data-idx", String(i), { timeout: 20_000 });

    if (i === 1) {
      // Aynı anda cevap: kaçan açılış hatası olmamalı
      await Promise.all([A.getByTestId(`choice-${ca}`).click(), B.getByTestId(`choice-${cb}`).tap()]);
    } else if (i % 2 === 0) {
      await A.getByTestId(`choice-${ca}`).click();
      // B ekranında A'nın cevabı gizli olmalı, sadece "seçti" yazmalı
      await expect(B.getByText(/seçti/)).toBeVisible({ timeout: 15_000 });
      await B.getByTestId(`choice-${cb}`).tap();
    } else {
      await B.getByTestId(`choice-${cb}`).tap();
      await expect(A.getByText(/seçti/)).toBeVisible({ timeout: 15_000 });
      await A.getByTestId(`choice-${ca}`).click();
    }
    const [ma, mb] = await Promise.all([waitReveal(A, `A kart ${i}`), waitReveal(B, `B kart ${i}`)]);
    const expected = String(ca === cb);
    expect(ma, `A kart ${i} eşleşme`).toBe(expected);
    expect(mb, `B kart ${i} eşleşme`).toBe(expected);
  }

  // 5) Özet: iki tarafta aynı skor
  const matches = pattern.filter(([a, b]) => a === b).length;
  await expect(A.getByTestId("summary")).toHaveAttribute("data-pct", String(matches * 10));
  await expect(B.getByTestId("summary")).toHaveAttribute("data-pct", String(matches * 10));

  // 6) A yeni tura geçer, B otomatik takip eder
  await A.getByRole("button", { name: /geç/ }).click();
  await expect(A.getByTestId("play")).toHaveAttribute("data-round", "2", { timeout: 20_000 });
  await expect(B.getByTestId("play")).toHaveAttribute("data-round", "2", { timeout: 20_000 });

  // 7) A kartı sağa sürükler (= Yerim), B dokunarak Yerim der
  const card = A.getByTestId("card-drag");
  const box = (await card.boundingBox())!;
  await A.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await A.mouse.down();
  for (let s = 1; s <= 12; s++) await A.mouse.move(box.x + box.width / 2 + s * 25, box.y + box.height / 2, { steps: 2 });
  await A.mouse.up();
  await expect(A.getByTestId("card")).toHaveAttribute("data-mine", "1", { timeout: 10_000 });
  await B.getByTestId("choice-1").tap();
  const [m1, m2] = await Promise.all([waitReveal(A, "A sürükleme"), waitReveal(B, "B sürükleme")]);
  expect(m1).toBe("true");
  expect(m2).toBe("true");

  // 8) Temizlik: A ana sayfadan odayı siler
  await A.goto(BASE + "/");
  const row = A.locator(`[data-testid="room-row"][data-code="${code}"]`);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByRole("button", { name: "Odayı sil" }).click();
  await expect(row).toBeHidden({ timeout: 15_000 });
});
