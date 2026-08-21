import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = """    } else {
      const { text: tCtx, sources: trendSources } = await tavilySearchFull(activeTrendsFocus + ' ' + dateLabel, TREND_PORTALS);
      const tSys = 'Jestes analitykiem content. Trendy: ' + activeTrendsFocus + ' teraz. Odpowiedz TYLKO JSON po polsku, bez em-dash: {"hot_topics":["temat 1 - max 8 slow","temat 2","temat 3","temat 4"],"content_angles":["kat 1 - max 8 slow","kat 2","kat 3"],"action":"napisz post o: max 10 slow"}';
      results.push({ type: 'trends', name: 'Trendy', analysis: await claude(tSys, tCtx), sources: trendSources, checkedAt: dateLabel });
    }"""
assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"

NEW = """    } else {
      try {
        const trendsQuery = activeTrendsFocus.slice(0, 200);
        const { text: tCtx, sources: trendSources } = await tavilySearchFull(trendsQuery + ' ' + dateLabel, TREND_PORTALS);
        const tSys = 'Jestes analitykiem content. Trendy: ' + trendsQuery + ' teraz. Odpowiedz TYLKO JSON po polsku, bez em-dash: {"hot_topics":["temat 1 - max 8 slow","temat 2","temat 3","temat 4"],"content_angles":["kat 1 - max 8 slow","kat 2","kat 3"],"action":"napisz post o: max 10 slow"}';
        results.push({ type: 'trends', name: 'Trendy', analysis: await claude(tSys, tCtx), sources: trendSources, checkedAt: dateLabel });
      } catch (e) {
        console.error('trends search failed:', e.message);
        results.push({ type: 'trends_error', name: 'Trendy', error: e.message, checkedAt: dateLabel });
      }
    }"""

content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: research/auto nie 500-uje juz przy bledzie Tavily dla trendow (guard + limit 200 znakow na zapytanie)")
