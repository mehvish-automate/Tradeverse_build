import { NextRequest, NextResponse } from "next/server";

import { dailyQuestions } from "@/lib/questions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  const countParam = req.nextUrl.searchParams.get("count");

  const date = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json(
      { error: "Invalid ?date — expected YYYY-MM-DD." },
      { status: 400 },
    );
  }

  const count = Math.max(1, Math.min(10, Number(countParam) || 5));
  const questions = dailyQuestions(date, count);

  return NextResponse.json(
    {
      date: date.toISOString().slice(0, 10),
      count: questions.length,
      questions,
    },
    {
      headers: {
        // Questions are the same for every user on a given day — cache hard.
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    },
  );
}
