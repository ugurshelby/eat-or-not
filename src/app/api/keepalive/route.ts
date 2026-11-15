// Supabase ücretsiz planı ~1 hafta hareketsiz kalan projeyi uyutur.
// Vercel Cron bu adresi her gün çağırır; gerçek bir veritabanı sorgusu yapılır.
export const dynamic = "force-dynamic";

export async function GET() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/ping`;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { apikey: key, "content-type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    const body = await res.json();
    console.log("keepalive", res.status, JSON.stringify(body));
    return Response.json({ ok: res.ok, status: res.status, db: body }, { status: res.ok ? 200 : 502 });
  } catch (e) {
    console.error("keepalive failed", e);
    return Response.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
