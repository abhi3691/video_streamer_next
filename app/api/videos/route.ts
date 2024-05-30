import { dbConnect } from "@/app/lib/db";
import VIdeoModel from "@/app/model/videoschema";
import { NextResponse } from "next/server";

export async function GET(req: Request, res: Response) {
  try {
    await dbConnect();
    // Fetch all videos from MongoDB
    const videos = await VIdeoModel.find({});
    return NextResponse.json({ urls: [...videos] });
  } catch (error) {
    console.error("Error in handler:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
