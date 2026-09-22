import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers })

  const q = new URL(req.url).searchParams.get("q") || ""
  if (!q) return new Response(JSON.stringify([]), { headers })

  try {
    const html = await fetch(`https://unopasa.com/search?q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "Mozilla/5.0" }
    }).then(r => r.text())

    const results: any[] = []
    const re = /href="\/legacy\/([a-z0-9]+)"[^>]*>([\s\S]*?)<\/a>/gi
    let m
    while ((m = re.exec(html)) !== null && results.length < 15) {
      const id = m[1]
      const title = m[2].replace(/<[^>]*>/g, "").trim()
      if (title.length < 10) continue
      if (results.find(r => r.id === id)) continue
      results.push({
        id,
        title,
        meta: "Zimbabwe / ZIMSEC",
        year: html.substring(m.index, m.index+500).match(/20\d\d/)?.[0] || "",
        file_url: `https://unopasa.com/legacy/${id}`,
        source: "Unopasa"
      })
    }
    return new Response(JSON.stringify(results), { headers })
  } catch {
    return new Response(JSON.stringify([]), { headers })
  }
})
