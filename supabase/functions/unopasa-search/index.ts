import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers })

  const url = new URL(req.url)
  const q = url.searchParams.get("q") || ""
  const id = url.searchParams.get("id") || ""

  // If id is provided, return direct PDF url for viewer
  if (id) {
    try {
      const pageHtml = await fetch(`https://unopasa.com/legacy/${id}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      }).then(r => r.text())
      // Find R2 link or pdf link
      const pdfMatch = pageHtml.match(/https:\/\/legacy-unopasa[^"']+\.pdf|https:\/\/[^"']+\.cloudflarestorage\.com\/[^"']+\.pdf|href="(\/api\/download\/[^"]+)"|src="(https:\/\/[^"]+\.pdf)"/i)
      let pdfUrl = pdfMatch?.[0] || pdfMatch?.[1] || pdfMatch?.[2] || ""
      if (pdfUrl && pdfUrl.startsWith("/")) pdfUrl = `https://unopasa.com${pdfUrl}`
      // Fallback - use unopasa viewer proxy
      if (!pdfUrl) pdfUrl = `https://unopasa.com/legacy/${id}`
      return new Response(JSON.stringify({ pdfUrl, viewerUrl: `https://unopasa.com/legacy/${id}` }), { headers })
    } catch {
      return new Response(JSON.stringify({ pdfUrl: `https://unopasa.com/legacy/${id}` }), { headers })
    }
  }

  if (!q) return new Response(JSON.stringify([]), { headers })

  try {
    const html = await fetch(`https://unopasa.com/search?q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "Mozilla/5.0" }
    }).then(r => r.text())

    const results: any[] = []
    const seen = new Set()

    // Get all /legacy/xxx links
    const re = /href="\/legacy\/([a-z0-9]+)"[^>]*>([\s\S]*?)<\/a>/gi
    let m
    while ((m = re.exec(html))!== null && results.length < 50) {
      const id = m[1].toLowerCase()
      if (seen.has(id)) continue
      seen.add(id)
      const title = m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
      if (title.length < 8) continue
      // Try get year/subject from nearby text
      const snippet = html.substring(m.index, m.index + 800)
      const year = snippet.match(/20\d{2}/)?.[0] || ""
      const subject = snippet.match(/Mathematics|Geography|Science|English|History|Biology|Physics|Chemistry|Shona|Commerce|Accounts/i)?.[0] || "ZIMSEC"

      results.push({
        id,
        title,
        meta: `ZIMSEC • ${subject} • ${year}`.replace(/ • $/, ""),
        year,
        file_url: `https://unopasa.com/legacy/${id}`,
        pdf_url: `https://unopasa.com/legacy/${id}`,
        source: "Unopasa"
      })
    }

    return new Response(JSON.stringify(results), { headers })
  } catch (e) {
    return new Response(JSON.stringify([]), { headers })
  }
})
