import type { NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";

export function GET(req: Request, res: Response) {
  return NextResponse.json({ message: "Success" }, { status: 200 });
}
