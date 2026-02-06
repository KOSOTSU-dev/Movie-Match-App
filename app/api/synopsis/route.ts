import { NextRequest, NextResponse } from "next/server";
import { getOneLineSynopsis } from "@/lib/synopsis";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  let body: { overview?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const overview = typeof body.overview === "string" ? body.overview : "";
  const title = typeof body.title === "string" ? body.title : "";

  if (!overview?.trim()) {
    return NextResponse.json(
      { synopsis: getOneLineSynopsis(overview) },
      { status: 200 }
    );
  }

  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { synopsis: getOneLineSynopsis(overview) },
      { status: 200 }
    );
  }

  const prompt = `以下の映画のあらすじを、感情が伝わる1文（50文字程度）に要約して。句点「。」で終える。日本語で。情報量は最小限に。人名はなるべく使わず、人柄やキャラの口調・立場（例：若い恋人、謎の老人、野心家の男など）で表現すること。例：「森で働く3人の男たちが、時代と愛に引き裂かれる。」

${title ? `タイトル: ${title}\n` : ""}あらすじ:
${overview}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 100,
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      // eslint-disable-next-line no-console
      console.error("OpenAI API error:", res.status, err);
      return NextResponse.json(
        { synopsis: getOneLineSynopsis(overview) },
        { status: 200 }
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    const synopsis =
      content && content.length > 0 && content.length <= 120
        ? content.replace(/\n/g, " ").replace(/^["']|["']$/g, "")
        : getOneLineSynopsis(overview);

    return NextResponse.json({ synopsis }, { status: 200 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Synopsis API error:", e);
    return NextResponse.json(
      { synopsis: getOneLineSynopsis(overview) },
      { status: 200 }
    );
  }
}
