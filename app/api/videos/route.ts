import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const hlsDir = path.join(__dirname, "hls");

if (!fs.existsSync(hlsDir)) {
  fs.mkdirSync(hlsDir);
}

export async function GET(req: Request, res: Response) {
  try {
    const files = await fs.promises.readdir(hlsDir);
    const videoUrls = files.map((file) => `${hlsDir}/${file}/index.m3u8`);
    return NextResponse.json({ urls: videoUrls });
  } catch (error) {
    console.error("Error in handler:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
